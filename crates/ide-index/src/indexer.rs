use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, RwLock};
use std::time::Instant;
use walkdir::WalkDir;
use nucleo_matcher::{Config, Matcher, Utf32Str};

use crate::types::{IndexStatsDto, IndexedFile, IndexedSymbol, SearchResultItem};
use crate::symbols::extract_symbols_from_content;

fn strip_verbatim_prefix(p: &Path) -> std::borrow::Cow<'_, Path> {
    let s = p.to_string_lossy();
    if let Some(rest) = s.strip_prefix(r"\\?\UNC\").or_else(|| s.strip_prefix("//?/UNC/")) {
        return std::borrow::Cow::Owned(std::path::PathBuf::from(format!(r"\\{}", rest)));
    }
    if let Some(rest) = s.strip_prefix(r"\\?\").or_else(|| s.strip_prefix("//?/")) {
        return std::borrow::Cow::Owned(std::path::PathBuf::from(rest.to_string()));
    }
    std::borrow::Cow::Borrowed(p)
}

fn is_ignored_relative_path(root: &Path, path: &Path) -> bool {
    let root_norm = strip_verbatim_prefix(root);
    let path_norm = strip_verbatim_prefix(path);

    let root_comps: Vec<std::path::Component<'_>> = root_norm.components().collect();
    let path_comps: Vec<std::path::Component<'_>> = path_norm.components().collect();

    if !root_comps.is_empty() && path_comps.len() >= root_comps.len() {
        let prefix_matches = root_comps.iter().zip(path_comps.iter()).all(|(rc, pc)| {
            std::mem::discriminant(rc) == std::mem::discriminant(pc)
                && rc.as_os_str().to_string_lossy().to_lowercase()
                    == pc.as_os_str().to_string_lossy().to_lowercase()
        });
        if prefix_matches {
            let mut rel = std::path::PathBuf::new();
            for comp in &path_comps[root_comps.len()..] {
                rel.push(comp.as_os_str());
            }
            return check_components(&rel);
        }
    }

    check_components(&path_norm)
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
        self.build_index_internal(project_path, true)
    }

    fn build_index_internal(&self, project_path: &str, force_rebuild: bool) -> Result<IndexStatsDto, String> {
        let start = Instant::now();
        let root = Path::new(project_path);
        if !root.exists() {
            return Err(format!("Project path does not exist: {}", project_path));
        }

        let key = canonicalize_project_key(project_path);
        let _guard = self.build_mutex.lock().map_err(|e| e.to_string())?;

        // Double-checked re-validation when called from get_or_build (non-forced)
        if !force_rebuild {
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
        let _ = self.build_index_internal(project_path, false);
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_ignored_relative_path_component_matching() {
        let root = Path::new("D:/build/my_app");
        // Files whose names contain ignored substrings should NOT be ignored
        assert!(!is_ignored_relative_path(root, Path::new("D:/build/my_app/src/builder.rs")));
        assert!(!is_ignored_relative_path(root, Path::new("D:/build/my_app/src/distribution.ts")));
        assert!(!is_ignored_relative_path(root, Path::new("D:/build/my_app/.github/workflows/ci.yml")));

        // Actual ignored directory components MUST be ignored
        assert!(is_ignored_relative_path(root, Path::new("D:/build/my_app/node_modules/pkg/index.js")));
        assert!(is_ignored_relative_path(root, Path::new("D:/build/my_app/target/debug/app.exe")));
        assert!(is_ignored_relative_path(root, Path::new("D:/build/my_app/.git/HEAD")));
        assert!(is_ignored_relative_path(root, Path::new("D:/build/my_app/Build/output.js")));
    }

    #[test]
    fn test_index_manager_build_index_forces_fresh_rebuild() {
        struct TempDir(std::path::PathBuf);
        impl Drop for TempDir {
            fn drop(&mut self) {
                let _ = std::fs::remove_dir_all(&self.0);
            }
        }
        let uniq = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("ide_index_refresh_{}_{}", std::process::id(), uniq));
        std::fs::create_dir_all(&dir).unwrap();
        let _guard = TempDir(dir.clone());
        let dir_str = dir.to_string_lossy().to_string();

        let src = dir.join("lib.rs");
        std::fs::write(&src, "pub fn initial_symbol() {}\n").unwrap();

        let mgr = IndexManager::new();
        let stats1 = mgr.build_index(&dir_str).unwrap();
        assert_eq!(stats1.total_files, 1);

        // Add another function and file, then verify build_index rebuilds instead of returning stale cache
        std::fs::write(&src, "pub fn initial_symbol() {}\npub fn added_later_symbol() {}\n").unwrap();
        std::fs::write(dir.join("extra.kt"), "fun kotlinHelper() {}\n").unwrap();

        let stats2 = mgr.build_index(&dir_str).unwrap();
        assert_eq!(stats2.total_files, 2);
        let hits = mgr.search(&dir_str, "added_later_symbol", Some("Symbols"), Some(10));
        assert!(!hits.is_empty(), "forced rebuild must reflect updated symbols");
    }
}
