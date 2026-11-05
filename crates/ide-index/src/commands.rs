use std::sync::LazyLock;
use crate::indexer::IndexManager;
use crate::types::{IndexStatsDto, SearchResultItem};

static INDEX_MANAGER: LazyLock<IndexManager> = LazyLock::new(IndexManager::new);

#[tauri::command]
pub async fn index_project(project_path: String) -> Result<IndexStatsDto, String> {
    tokio::task::spawn_blocking(move || {
        INDEX_MANAGER.build_index(&project_path)
    })
    .await
    .map_err(|e| format!("Task execution error: {}", e))?
}

#[tauri::command]
pub fn search_project_index(
    project_path: String,
    query: String,
    category: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<SearchResultItem>, String> {
    Ok(INDEX_MANAGER.search(
        &project_path,
        &query,
        category.as_deref(),
        limit,
    ))
}
