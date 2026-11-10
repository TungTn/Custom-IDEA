use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, RwLock};
use std::time::Instant;
use walkdir::WalkDir;
use nucleo_matcher::{Config, Matcher, Utf32Str};

use crate::types::{IndexStatsDto, IndexedFile, IndexedSymbol, SearchResultItem};
use crate::symbols::extract_symbols_from_content;

fn is_ignored_relative_path(root: &Path, path: &Path) -> bool {
    let root_str = root.to_string_lossy().replace('\\', "/");
    let root_clean = root_str.strip_prefix("//?/").or_else(|| root_str.strip_prefix(r"\\?\")).unwrap_or(&root_str);
    let path_str = path.to_string_lossy().replace('\\', "/");
    let path_clean = path_str.strip_prefix("//?/").or_else(|| path_str.strip_prefix(r"\\?\")).unwrap_or(&path_str);

    let rel_str = if !root_clean.is_empty() && path_clean.to_lowercase().starts_with(&root_clean.to_lowercase()) {
        let rem = &path_clean[root_clean.len()..];
        rem.trim_start_matches('/')
    } else {
        match path.strip_prefix(root) {
            Ok(p) => return check_components(p),
            Err(_) => path_clean,
        }
    };

    check_components(Path::new(rel_str))
}

fn check_components(rel: &Path) -> bool {
    for comp in rel.components() {
        let s = comp.as_os_str().to_string_lossy().to_lowercase();
        if s == ".git"
            || s == "node_modules"
            || s == "target"
            || s == "dist"
            || s == ".idea"
            || s == ".vscode"
            || s == "build"
            || s == "out"
            || s == "bin"
            || s == ".gradle"
            || s == "__pycache__"
        {
            return true;
        }
    }
    false
}

fn canonicalize_project_key(path: &str) -> String {
    let p = Path::new(path);
    if let Ok(canon) = p.canonicalize() {
        canon.to_string_lossy().to_string()
    } else {
        path.trim_end_matches(['/', '\\']).to_string()
    }
}

#[derive(Default)]
pub struct ProjectIndex {
    pub project_path: String,
    pub files: Vec<IndexedFile>,
    pub symbols: Vec<IndexedSymbol>,
}

pub struct IndexManager {
    indices: RwLock<HashMap<String, Arc<ProjectIndex>>>,
    build_mutex: std::sync::Mutex<()>,
}

impl IndexManager {
    pub fn new() -> Self {
        Self {
            indices: RwLock::new(HashMap::new()),
            build_mutex: std::sync::Mutex::new(()),
        }
    }

    pub fn build_index(&self, project_path: &str) -> Result<IndexStatsDto, String> {
        let start = Instant::now();
        let root = Path::new(project_path);
        if !root.exists() {
            return Err(format!("Project path does not exist: {}", project_path));
        }

        let key = canonicalize_project_key(project_path);
        let _guard = self.build_mutex.lock().map_err(|e| e.to_string())?;

        // Double-checked re-validation: return cached index if another thread just built it
        if let Ok(lock) = self.indices.read() {
            if let Some(existing) = lock.get(&key) {
                return Ok(IndexStatsDto {
                    project_path: project_path.to_string(),
                    total_files: existing.files.len(),
                    total_symbols: existing.symbols.len(),
                    duration_ms: 0,
                });
            }
        }

        let mut indexed_files = Vec::new();
        let mut indexed_symbols = Vec::new();

        for entry in WalkDir::new(root)
            .into_iter()
            .filter_entry(|e| !is_ignored_relative_path(root, e.path()))
            .filter_map(Result::ok)
        {
            if entry.depth() == 0 {
                continue;
            }

            let path = entry.path();
            let is_folder = path.is_dir();
            let name = entry.file_name().to_string_lossy().to_string();
            let rel_path = path
                .strip_prefix(root)
                .map(|p| p.to_string_lossy().replace('\\', "/"))
                .unwrap_or_else(|_| name.clone());

            let extension = path.extension().and_then(|e| e.to_str()).map(|s| s.to_string());

            let file_path_str = path.to_string_lossy().to_string();

            indexed_files.push(IndexedFile {
                name: name.clone(),
                path: file_path_str.clone(),
                relative_path: rel_path.clone(),
                is_folder,
                extension: extension.clone(),
            });

            if !is_folder {
                if let Some(ref ext) = extension {
                    let ext_lower = ext.to_lowercase();
                    if matches!(ext_lower.as_str(), "rs" | "ts" | "tsx" | "js" | "jsx" | "vue" | "py" | "go" | "java" | "kt" | "cs") {
                        if let Ok(metadata) = entry.metadata() {
                            if metadata.len() < 1_000_000 {
                                if let Ok(content) = std::fs::read_to_string(path) {
                                    let file_symbols = extract_symbols_from_content(
                                        &file_path_str,
                                        &rel_path,
                                        &content,
                                    );
                                    indexed_symbols.extend(file_symbols);
                                }
                            }
                        }
                    }
                }
            }
        }

        let total_files = indexed_files.len();
        let total_symbols = indexed_symbols.len();
        let duration_ms = start.elapsed().as_millis() as u64;

        let project_index = ProjectIndex {
            project_path: project_path.to_string(),
            files: indexed_files,
            symbols: indexed_symbols,
        };

        {
            let mut lock = self.indices.write().map_err(|e| e.to_string())?;
            // Bound index cache to max 8 projects to avoid unbounded memory growth
            if lock.len() >= 8 && !lock.contains_key(&key) {
                if let Some(old_key) = lock.keys().next().cloned() {
                    lock.remove(&old_key);
                }
            }
            lock.insert(key, Arc::new(project_index));
        }

        Ok(IndexStatsDto {
            project_path: project_path.to_string(),
            total_files,
            total_symbols,
            duration_ms,
        })
    }

    pub fn get_or_build(&self, project_path: &str) -> Arc<ProjectIndex> {
        let key = canonicalize_project_key(project_path);
        {
            if let Ok(lock) = self.indices.read() {
                if let Some(index) = lock.get(&key) {
                    return Arc::clone(index);
                }
            }
        }
        let _ = self.build_index(project_path);
        if let Ok(lock) = self.indices.read() {
            if let Some(index) = lock.get(&key) {
                return Arc::clone(index);
            }
        }
        Arc::new(ProjectIndex::default())
    }

    pub fn search(
        &self,
        project_path: &str,
        query: &str,
        category: Option<&str>,
        limit: Option<usize>,
    ) -> Vec<SearchResultItem> {
        let max_results = limit.unwrap_or(40);
        let q_trim = query.trim();
        if q_trim.is_empty() {
            return Vec::new();
        }

        let index = self.get_or_build(project_path);
        let mut matcher = Matcher::new(Config::DEFAULT);
        let mut query_buf = Vec::new();
        let needle = Utf32Str::new(q_trim, &mut query_buf);

        let mut scored_items: Vec<(u32, SearchResultItem)> = Vec::new();
        let cat = category.unwrap_or("All");

        // 1. Search Files
        if cat == "All" || cat == "Files" {
            for f in &index.files {
                let mut name_buf = Vec::new();
                let name_haystack = Utf32Str::new(&f.name, &mut name_buf);
                let name_score = matcher.fuzzy_match(name_haystack, needle);

                let score = if let Some(s) = name_score {
                    (s as u32) + 200
                } else {
                    let mut path_buf = Vec::new();
                    let path_haystack = Utf32Str::new(&f.relative_path, &mut path_buf);
                    match matcher.fuzzy_match(path_haystack, needle) {
                        Some(s) => s.into(),
                        None => continue,
                    }
                };

                scored_items.push((
                    score,
                    SearchResultItem {
                        id: format!("file-{}", f.path),
                        title: f.name.clone(),
                        subtitle: Some(f.relative_path.clone()),
                        category: "Files".to_string(),
                        file_path: Some(f.path.clone()),
                        line_number: None,
                        column_number: None,
                        snippet: None,
                        symbol_kind: None,
                        score,
                    },
                ));
            }
        }

        // 2. Search Symbols
        if cat == "All" || cat == "Symbols" {
            for s in &index.symbols {
                let mut name_buf = Vec::new();
                let name_haystack = Utf32Str::new(&s.name, &mut name_buf);
                let name_score = matcher.fuzzy_match(name_haystack, needle);

                let score = match name_score {
                    Some(score_val) => (score_val as u32) + 250,
                    None => {
                        let mut snippet_buf = Vec::new();
                        let snippet_haystack = Utf32Str::new(
                            s.snippet.as_deref().unwrap_or(""),
                            &mut snippet_buf,
                        );
                        match matcher.fuzzy_match(snippet_haystack, needle) {
                            Some(sc) => sc.into(),
                            None => continue,
                        }
                    }
                };

                scored_items.push((
                    score,
                    SearchResultItem {
                        id: format!("sym-{}-{}-{}", s.file_path, s.line_number, s.name),
                        title: s.name.clone(),
                        subtitle: Some(format!("{}:{}", s.relative_path, s.line_number)),
                        category: "Symbols".to_string(),
                        file_path: Some(s.file_path.clone()),
                        line_number: Some(s.line_number),
                        column_number: Some(s.column_number),
                        snippet: s.snippet.clone(),
                        symbol_kind: Some(s.kind.clone()),
                        score,
                    },
                ));
            }
        }

        scored_items.sort_by(|a, b| b.0.cmp(&a.0));

        scored_items
            .into_iter()
            .take(max_results)
            .map(|(_, item)| item)
            .collect()
    }
}
