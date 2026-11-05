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
pub fn coverage_load_file(coverage_file_path: String) -> Result<CoverageSummaryDto, String> {
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
        100.0
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

#[tauri::command]
pub fn coverage_get_for_file(file_path: String) -> Result<Option<FileCoverageDto>, String> {
    let normalized = file_path.replace('\\', "/");
    let store = STORE.reports.read().map_err(|e| e.to_string())?;

    // 1. Direct match
    if let Some(dto) = store.get(&normalized) {
        return Ok(Some(dto.clone()));
    }

    // 2. Suffix / Subpath match
    for (k, v) in store.iter() {
        if normalized.ends_with(k) || k.ends_with(&normalized) {
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
pub fn coverage_detect_reports(project_path: String) -> Result<Vec<String>, String> {
    let root = Path::new(&project_path);
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut found = Vec::new();
    for entry in WalkDir::new(root)
        .max_depth(5)
        .into_iter()
        .filter_entry(|e| {
            let s = e.path().to_string_lossy();
            !s.contains(".git") && !s.contains("node_modules") && !s.contains(".idea")
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
                || name == "clover.xml"
            {
                found.push(entry.path().to_string_lossy().to_string());
            }
        }
    }
    Ok(found)
}
