use std::collections::HashMap;
use std::path::Path;
use std::sync::{LazyLock, RwLock};
use walkdir::WalkDir;

use crate::parser;
use crate::types::{CoverageSummaryDto, FileCoverageDto};

struct CoverageStore {
    reports: RwLock<HashMap<String, FileCoverageDto>>,
    current_summary: RwLock<Option<CoverageSummaryDto>>,
}

impl CoverageStore {
    fn new() -> Self {
        Self {
            reports: RwLock::new(HashMap::new()),
            current_summary: RwLock::new(None),
        }
    }
}

static STORE: LazyLock<CoverageStore> = LazyLock::new(CoverageStore::new);

#[tauri::command]
pub async fn coverage_load_file(coverage_file_path: String) -> Result<CoverageSummaryDto, String> {
    tauri::async_runtime::spawn_blocking(move || coverage_load_file_sync(coverage_file_path))
        .await
        .map_err(|e| format!("Coverage load task failed: {}", e))?
}

fn coverage_load_file_sync(coverage_file_path: String) -> Result<CoverageSummaryDto, String> {
    let path = Path::new(&coverage_file_path);
    if !path.exists() {
        return Err(format!("Coverage file not found: {}", coverage_file_path));
    }

    let files_map = parser::parse_file(path)?;
    let total_files = files_map.len();
    let mut total_lines = 0;
    let mut covered_lines = 0;

    for file in files_map.values() {
        total_lines += file.lines_found;
        covered_lines += file.lines_hit;
    }

    let coverage_percent = if total_lines > 0 {
        ((covered_lines as f32 / total_lines as f32) * 1000.0).round() / 10.0
    } else {
        0.0
    };

    let summary = CoverageSummaryDto {
        report_file: coverage_file_path.clone(),
        total_files,
        total_lines,
        covered_lines,
        coverage_percent,
    };

    {
        let mut store = STORE.reports.write().map_err(|e| e.to_string())?;
        store.clear();
        for (k, v) in files_map {
            store.insert(k, v);
        }
    }
    {
        let mut sum_store = STORE.current_summary.write().map_err(|e| e.to_string())?;
        *sum_store = Some(summary.clone());
    }

    Ok(summary)
}

fn normalize_cov_path(p: &str) -> String {
    let replaced = p.trim().replace('\\', "/");
    let stripped = replaced.trim_start_matches("./").trim_start_matches('/');
    #[cfg(windows)]
    {
        stripped.to_lowercase()
    }
    #[cfg(not(windows))]
    {
        stripped.to_string()
    }
}

fn path_matches_component_suffix(haystack: &str, needle: &str) -> bool {
    let h = normalize_cov_path(haystack);
    let n = normalize_cov_path(needle);
    if h.is_empty() || n.is_empty() {
        return false;
    }
    h == n || h.ends_with(&format!("/{}", n))
}

#[tauri::command]
pub fn coverage_get_for_file(file_path: String) -> Result<Option<FileCoverageDto>, String> {
    let normalized = file_path.replace('\\', "/");
    let store = STORE.reports.read().map_err(|e| e.to_string())?;

    // 1. Direct match
    if let Some(dto) = store.get(&normalized) {
        return Ok(Some(dto.clone()));
    }

    // 2. Path-component boundary suffix match (case-insensitive on Windows)
    for (k, v) in store.iter() {
        if path_matches_component_suffix(&normalized, k) || path_matches_component_suffix(k, &normalized) {
            return Ok(Some(v.clone()));
        }
    }

    Ok(None)
}

#[tauri::command]
pub fn coverage_get_summary() -> Result<Option<CoverageSummaryDto>, String> {
    let store = STORE.current_summary.read().map_err(|e| e.to_string())?;
    Ok(store.clone())
}

#[tauri::command]
pub fn coverage_get_all_files() -> Result<Vec<FileCoverageDto>, String> {
    let store = STORE.reports.read().map_err(|e| e.to_string())?;
    let mut list: Vec<FileCoverageDto> = store.values().cloned().collect();
    list.sort_by(|a, b| a.file_path.cmp(&b.file_path));
    Ok(list)
}

#[tauri::command]
pub async fn coverage_detect_reports(project_path: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || coverage_detect_reports_sync(project_path))
        .await
        .map_err(|e| format!("Coverage detection task failed: {}", e))?
}

fn coverage_detect_reports_sync(project_path: String) -> Result<Vec<String>, String> {
    let root = Path::new(&project_path);
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut found = Vec::new();
    for entry in WalkDir::new(root)
        .max_depth(5)
        .into_iter()
        .filter_entry(|e| {
            let rel = match e.path().strip_prefix(root) {
                Ok(p) => p,
                Err(_) => e.path(),
            };
            for comp in rel.components() {
                let s = comp.as_os_str().to_string_lossy().to_lowercase();
                if s == ".git" || s == "node_modules" || s == ".idea" || s == ".vscode" {
                    return false;
                }
            }
            true
        })
        .filter_map(Result::ok)
    {
        if entry.file_type().is_file() {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if name == "lcov.info"
                || name == "coverage.lcov"
                || name.ends_with(".lcov")
                || name == "jacoco.xml"
                || name == "cobertura.xml"
            {
                found.push(entry.path().to_string_lossy().to_string());
            }
        }
    }
    Ok(found)
}

#[cfg(test)]
mod tests {
    use super::*;

    static STORE_TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    #[test]
    fn test_coverage_zero_line_summary_and_component_boundary_match() {
        let _store_guard = STORE_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        struct TempFile(std::path::PathBuf);
        impl Drop for TempFile {
            fn drop(&mut self) {
                let _ = std::fs::remove_file(&self.0);
            }
        }

        let uniq = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("ide_cov_zero_{}_{}.info", std::process::id(), uniq));
        std::fs::write(&path, "SF:src/empty.ts\nend_of_record\n").unwrap();
        let _guard = TempFile(path.clone());

        let summary = coverage_load_file_sync(path.to_string_lossy().to_string()).unwrap();
        assert_eq!(summary.total_files, 1);
        assert_eq!(summary.total_lines, 0);
        assert_eq!(summary.coverage_percent, 0.0);

        // Component boundary matching: `utils.ts` must NOT match `src/my_utils.ts`
        assert!(path_matches_component_suffix("D:/proj/src/utils.ts", "src/utils.ts"));
        assert!(!path_matches_component_suffix("D:/proj/src/my_utils.ts", "utils.ts"));

        // Direct command lookup checks loaded store boundaries
        std::fs::write(&path, "SF:utils.ts\nDA:1,1\nend_of_record\n").unwrap();
        coverage_load_file_sync(path.to_string_lossy().to_string()).unwrap();
        assert!(coverage_get_for_file("D:/proj/src/utils.ts".into()).unwrap().is_some());
        assert!(coverage_get_for_file("D:/proj/src/my_utils.ts".into()).unwrap().is_none());
    }
}
