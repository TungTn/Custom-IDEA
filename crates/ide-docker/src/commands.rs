use crate::client;
use crate::types::{DockerContainerDto, DockerDaemonStatusDto};

#[tauri::command]
pub async fn docker_get_daemon_status() -> Result<DockerDaemonStatusDto, String> {
    Ok(client::check_docker_available().await)
}

#[tauri::command]
pub async fn docker_list_containers(all: Option<bool>) -> Result<Vec<DockerContainerDto>, String> {
    client::list_containers(all.unwrap_or(true)).await
}

#[tauri::command]
pub async fn docker_start_container(container_id: String) -> Result<(), String> {
    client::run_container_action("start", &container_id).await
}

#[tauri::command]
pub async fn docker_stop_container(container_id: String) -> Result<(), String> {
    client::run_container_action("stop", &container_id).await
}

#[tauri::command]
pub async fn docker_restart_container(container_id: String) -> Result<(), String> {
    client::run_container_action("restart", &container_id).await
}

#[tauri::command]
pub async fn docker_remove_container(container_id: String, force: Option<bool>) -> Result<(), String> {
    client::remove_container(&container_id, force.unwrap_or(false)).await
}

#[tauri::command]
pub async fn docker_get_logs(container_id: String, tail: Option<usize>) -> Result<Vec<String>, String> {
    client::get_container_logs(&container_id, tail).await
}

#[tauri::command]
pub fn docker_set_config(cli_path: Option<String>, socket_path: Option<String>) -> Result<(), String> {
    client::set_docker_configuration(cli_path, socket_path)
}

#[tauri::command]
pub async fn docker_test_cli(path: Option<String>) -> Result<String, String> {
    client::test_docker_cli(path).await
}

