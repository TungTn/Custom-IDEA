use std::process::Command;
use std::sync::{LazyLock, RwLock};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use crate::types::{DockerContainerDto, DockerDaemonStatusDto, DockerImageDto};

static CUSTOM_DOCKER_CLI: LazyLock<RwLock<Option<String>>> = LazyLock::new(|| RwLock::new(None));
static CUSTOM_DOCKER_SOCKET: LazyLock<RwLock<Option<String>>> = LazyLock::new(|| RwLock::new(None));

pub fn set_docker_configuration(cli_path: Option<String>, socket_path: Option<String>) {
    if let Ok(mut g) = CUSTOM_DOCKER_CLI.write() {
        *g = cli_path;
    }
    if let Ok(mut g) = CUSTOM_DOCKER_SOCKET.write() {
        *g = socket_path;
    }
}

pub fn create_docker_command() -> Command {
    let cli = if let Ok(g) = CUSTOM_DOCKER_CLI.read() {
        if let Some(ref p) = *g {
            let trimmed = p.trim();
            if !trimmed.is_empty() {
                trimmed.to_string()
            } else {
                "docker".to_string()
            }
        } else {
            "docker".to_string()
        }
    } else {
        "docker".to_string()
    };

    let mut cmd = Command::new(&cli);
    if let Ok(g) = CUSTOM_DOCKER_SOCKET.read() {
        if let Some(ref s) = *g {
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                cmd.args(&["-H", trimmed]);
            }
        }
    }
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    cmd
}

pub fn test_docker_cli(path: Option<String>) -> Result<String, String> {
    let target = path.as_deref().unwrap_or("docker");
    let bin = if target.trim().is_empty() { "docker" } else { target.trim() };
    let mut cmd = Command::new(bin);
    cmd.arg("--version");
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    match cmd.output() {
        Ok(out) => {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                Ok(if stdout.is_empty() { "Docker CLI detected successfully".to_string() } else { stdout })
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                Err(format!("Docker returned error: {}", if stderr.is_empty() { "Unknown error".to_string() } else { stderr }))
            }
        }
        Err(e) => Err(format!("Failed to execute '{}': {}", bin, e)),
    }
}

pub fn check_docker_available() -> DockerDaemonStatusDto {
    let mut cmd = create_docker_command();
    cmd.args(&["info", "--format", "{{json .}}"]);

    match cmd.output() {
        Ok(out) => {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&stdout) {
                    let version = json_val.get("ServerVersion").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let containers = json_val.get("Containers").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
                    let images = json_val.get("Images").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
                    return DockerDaemonStatusDto {
                        is_available: true,
                        version,
                        containers_count: containers,
                        images_count: images,
                        error_message: None,
                    };
                }
                return DockerDaemonStatusDto {
                    is_available: true,
                    version: None,
                    containers_count: 0,
                    images_count: 0,
                    error_message: None,
                };
            } else {
                let err = String::from_utf8_lossy(&out.stderr);
                DockerDaemonStatusDto {
                    is_available: false,
                    version: None,
                    containers_count: 0,
                    images_count: 0,
                    error_message: Some(err.trim().to_string()),
                }
            }
        }
        Err(e) => DockerDaemonStatusDto {
            is_available: false,
            version: None,
            containers_count: 0,
            images_count: 0,
            error_message: Some(format!("Failed to execute docker CLI: {}", e)),
        },
    }
}

pub fn list_containers(all: bool) -> Result<Vec<DockerContainerDto>, String> {
    let mut cmd = create_docker_command();
    let format = r#"{"id":"{{.ID}}","names":["{{.Names}}"],"image":"{{.Image}}","state":"{{.State}}","status":"{{.Status}}","ports":["{{.Ports}}"],"created":0}"#;
    let mut args = vec!["ps", "--format", format];
    if all {
        args.push("-a");
    }
    cmd.args(&args);

    let output = cmd.output().map_err(|e| format!("Failed to run docker ps: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Docker error: {}", err));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut containers = Vec::new();
    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(dto) = serde_json::from_str::<DockerContainerDto>(trimmed) {
            containers.push(dto);
        }
    }
    Ok(containers)
}

pub fn list_images() -> Result<Vec<DockerImageDto>, String> {
    let mut cmd = create_docker_command();
    let format = r#"{"id":"{{.ID}}","repository":"{{.Repository}}","tag":"{{.Tag}}","size":"{{.Size}}","created_since":"{{.CreatedSince}}"}"#;
    cmd.args(&["images", "--format", format]);

    let output = cmd.output().map_err(|e| format!("Failed to run docker images: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Docker error: {}", err));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut images = Vec::new();
    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(dto) = serde_json::from_str::<DockerImageDto>(trimmed) {
            images.push(dto);
        }
    }
    Ok(images)
}

pub fn run_container_action(action: &str, container_id: &str) -> Result<(), String> {
    let mut cmd = create_docker_command();
    cmd.args(&[action, container_id]);

    let out = cmd.output().map_err(|e| format!("Failed to run docker {}: {}", action, e))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("Docker {} failed: {}", action, err));
    }
    Ok(())
}

pub fn remove_container(container_id: &str, force: bool) -> Result<(), String> {
    let mut cmd = create_docker_command();
    let mut args = vec!["rm"];
    if force {
        args.push("-f");
    }
    args.push(container_id);
    cmd.args(&args);

    let out = cmd.output().map_err(|e| format!("Failed to run docker rm: {}", e))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("Docker rm failed: {}", err));
    }
    Ok(())
}

pub fn get_container_logs(container_id: &str, tail: Option<usize>) -> Result<Vec<String>, String> {
    let mut cmd = create_docker_command();
    let tail_str = tail.unwrap_or(100).to_string();
    cmd.args(&["logs", "--tail", &tail_str, container_id]);

    let out = cmd.output().map_err(|e| format!("Failed to fetch docker logs: {}", e))?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);
    
    let mut lines = Vec::new();
    for l in stdout.lines() {
        lines.push(l.to_string());
    }
    for l in stderr.lines() {
        lines.push(format!("[stderr] {}", l));
    }
    Ok(lines)
}
