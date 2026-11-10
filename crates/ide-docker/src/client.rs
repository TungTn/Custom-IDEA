use tokio::process::Command;
use std::sync::{LazyLock, RwLock};
use std::time::Duration;
use crate::types::{DockerContainerDto, DockerDaemonStatusDto, DockerImageDto};

static CUSTOM_DOCKER_CLI: LazyLock<RwLock<Option<String>>> = LazyLock::new(|| RwLock::new(None));
static CUSTOM_DOCKER_SOCKET: LazyLock<RwLock<Option<String>>> = LazyLock::new(|| RwLock::new(None));

const DOCKER_CMD_TIMEOUT: Duration = Duration::from_secs(15);

fn validate_docker_cli_path(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Docker CLI path cannot be empty".to_string());
    }
    if trimmed == "docker" || trimmed == "docker.exe" {
        return Ok(trimmed.to_string());
    }
    if trimmed.starts_with(r"\\") || trimmed.starts_with("//") {
        return Err("UNC/network executable paths are not allowed for Docker CLI".to_string());
    }
    let p = std::path::Path::new(trimmed);
    if !p.is_file() {
        return Err(format!("Docker CLI file does not exist: {}", trimmed));
    }
    let fname = p
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();
    if fname != "docker" && fname != "docker.exe" {
        return Err("Docker CLI path must point to docker or docker.exe".to_string());
    }
    Ok(trimmed.to_string())
}

fn validate_docker_socket_path(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Docker socket path cannot be empty".to_string());
    }
    if trimmed.starts_with('-') || trimmed.bytes().any(|b| b == 0 || b == b'\r' || b == b'\n' || b.is_ascii_whitespace()) {
        return Err("Invalid characters in Docker socket path".to_string());
    }
    if !(trimmed.starts_with("npipe://") || trimmed.starts_with("unix://") || trimmed.starts_with("tls://")) {
        return Err("Unsupported Docker socket scheme (allowed: npipe://, unix://, tls://)".to_string());
    }
    Ok(trimmed.to_string())
}

pub fn validate_container_id(container_id: &str) -> Result<(), String> {
    if container_id.is_empty() || container_id.len() > 128 {
        return Err("Invalid container ID length".to_string());
    }
    let mut chars = container_id.chars();
    let first_ok = chars.next().is_some_and(|c| c.is_ascii_alphanumeric());
    let rest_ok = chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-'));
    if !first_ok || !rest_ok {
        return Err(format!("Invalid container ID '{}'", container_id));
    }
    Ok(())
}

pub fn set_docker_configuration(cli_path: Option<String>, socket_path: Option<String>) -> Result<(), String> {
    let valid_cli = match cli_path {
        Some(ref p) if !p.trim().is_empty() => Some(validate_docker_cli_path(p)?),
        _ => None,
    };
    let valid_socket = match socket_path {
        Some(ref s) if !s.trim().is_empty() => Some(validate_docker_socket_path(s)?),
        _ => None,
    };
    if let Ok(mut g) = CUSTOM_DOCKER_CLI.write() {
        *g = valid_cli;
    }
    if let Ok(mut g) = CUSTOM_DOCKER_SOCKET.write() {
        *g = valid_socket;
    }
    Ok(())
}

pub fn create_docker_command() -> Command {
    let cli = if let Ok(g) = CUSTOM_DOCKER_CLI.read() {
        g.clone().unwrap_or_else(|| "docker".to_string())
    } else {
        "docker".to_string()
    };

    let mut cmd = Command::new(&cli);
    cmd.kill_on_drop(true);
    if let Ok(g) = CUSTOM_DOCKER_SOCKET.read() {
        if let Some(ref s) = *g {
            cmd.args(["-H", s.as_str()]);
        }
    }
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    cmd
}

async fn run_docker_output(mut cmd: Command, context: &str) -> Result<std::process::Output, String> {
    match tokio::time::timeout(DOCKER_CMD_TIMEOUT, cmd.output()).await {
        Ok(Ok(out)) => Ok(out),
        Ok(Err(e)) => Err(format!("Failed to run {}: {}", context, e)),
        Err(_) => Err(format!("Timed out waiting for {} ({}s)", context, DOCKER_CMD_TIMEOUT.as_secs())),
    }
}

pub async fn test_docker_cli(path: Option<String>) -> Result<String, String> {
    let bin = match path {
        Some(ref p) if !p.trim().is_empty() => validate_docker_cli_path(p)?,
        _ => "docker".to_string(),
    };
    let mut cmd = Command::new(&bin);
    cmd.kill_on_drop(true);
    cmd.arg("--version");
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    let out = run_docker_output(cmd, &format!("'{}'", bin)).await?;
    if out.status.success() {
        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
        Ok(if stdout.is_empty() { "Docker CLI detected successfully".to_string() } else { stdout })
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        Err(format!("Docker returned error: {}", if stderr.is_empty() { "Unknown error".to_string() } else { stderr }))
    }
}

pub async fn check_docker_available() -> DockerDaemonStatusDto {
    let mut cmd = create_docker_command();
    cmd.args(["info", "--format", "{{json .}}"]);

    match run_docker_output(cmd, "docker info").await {
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
                DockerDaemonStatusDto {
                    is_available: true,
                    version: None,
                    containers_count: 0,
                    images_count: 0,
                    error_message: None,
                }
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
            error_message: Some(e),
        },
    }
}

pub async fn list_containers(all: bool) -> Result<Vec<DockerContainerDto>, String> {
    let mut cmd = create_docker_command();
    let format = r#"{"id":{{json .ID}},"names":[{{json .Names}}],"image":{{json .Image}},"state":{{json .State}},"status":{{json .Status}},"ports":[{{json .Ports}}],"created":0}"#;
    let mut args = vec!["ps", "--format", format];
    if all {
        args.push("-a");
    }
    cmd.args(&args);

    let output = run_docker_output(cmd, "docker ps").await?;
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

pub async fn list_images() -> Result<Vec<DockerImageDto>, String> {
    let mut cmd = create_docker_command();
    let format = r#"{"id":{{json .ID}},"repository":{{json .Repository}},"tag":{{json .Tag}},"size":{{json .Size}},"created_since":{{json .CreatedSince}}}"#;
    cmd.args(["images", "--format", format]);

    let output = run_docker_output(cmd, "docker images").await?;
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

pub async fn run_container_action(action: &str, container_id: &str) -> Result<(), String> {
    validate_container_id(container_id)?;
    let mut cmd = create_docker_command();
    cmd.args([action, "--", container_id]);

    let out = run_docker_output(cmd, &format!("docker {}", action)).await?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("Docker {} failed: {}", action, err));
    }
    Ok(())
}

pub async fn remove_container(container_id: &str, force: bool) -> Result<(), String> {
    validate_container_id(container_id)?;
    let mut cmd = create_docker_command();
    let mut args = vec!["rm"];
    if force {
        args.push("-f");
    }
    args.push("--");
    args.push(container_id);
    cmd.args(&args);

    let out = run_docker_output(cmd, "docker rm").await?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("Docker rm failed: {}", err));
    }
    Ok(())
}

pub async fn get_container_logs(container_id: &str, tail: Option<usize>) -> Result<Vec<String>, String> {
    validate_container_id(container_id)?;
    let mut cmd = create_docker_command();
    let tail_str = tail.unwrap_or(100).min(10_000).to_string();
    cmd.args(["logs", "--tail", &tail_str, "--", container_id]);

    let out = run_docker_output(cmd, "docker logs").await?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(format!("Docker logs failed: {}", if err.is_empty() { "unknown error".to_string() } else { err }));
    }
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
