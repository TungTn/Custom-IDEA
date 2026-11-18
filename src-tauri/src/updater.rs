use serde::Serialize;
use sha2::{Digest, Sha256};

/// Verifies update executable integrity (64-hex SHA-256 match and Windows MZ header).
pub fn verify_update_payload(bytes: &[u8], expected_sha256: &str) -> Result<(), String> {
    if bytes.is_empty() {
        return Err("Update payload cannot be empty".to_string());
    }
    let trimmed_sha = expected_sha256.trim();
    if trimmed_sha.len() != 64 || !trimmed_sha.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("Invalid expected SHA-256 digest format".to_string());
    }
    #[cfg(target_os = "windows")]
    if !bytes.starts_with(b"MZ") {
        return Err("Invalid Windows executable payload (missing MZ header)".to_string());
    }
    let digest = Sha256::digest(bytes);
    let mut actual_hex = String::with_capacity(64);
    for byte in digest {
        use std::fmt::Write;
        let _ = write!(&mut actual_hex, "{:02x}", byte);
    }
    if actual_hex != trimmed_sha.to_ascii_lowercase() {
        return Err(format!(
            "Update SHA-256 checksum mismatch: expected {}, got {}",
            trimmed_sha.to_ascii_lowercase(),
            actual_hex
        ));
    }
    Ok(())
}

#[derive(Debug, Serialize, Clone)]
pub struct AppVersionInfo {
    pub version: String,
    pub is_portable: bool,
    pub exe_path: String,
    pub build_commit: Option<String>,
    pub build_date: Option<String>,
    pub target: String,
}

#[tauri::command]
pub fn get_app_version_info() -> Result<AppVersionInfo, String> {
    let current_exe = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown.exe".to_string());

    let is_portable = current_exe.to_lowercase().contains("portable")
        || !current_exe.to_lowercase().contains("program files");

    Ok(AppVersionInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        is_portable,
        exe_path: current_exe,
        build_commit: option_env!("GIT_HASH").map(|s| s.to_string()),
        build_date: Some(chrono_like_now()),
        target: std::env::consts::ARCH.to_string(),
    })
}

fn chrono_like_now() -> String {
    chrono::Local::now().format("%B %Y").to_string()
}

fn get_temp_exe_path() -> std::path::PathBuf {
    let current_pid = std::process::id();
    std::env::temp_dir()
        .join("custom-idea-updates")
        .join(format!("custom-idea-latest-{}.exe", current_pid))
}

fn execute_swapper_and_exit(temp_exe: &std::path::Path) -> Result<(), String> {
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get current executable path: {}", e))?;

    let temp_dir = std::env::temp_dir().join("custom-idea-updates");
    let _ = std::fs::create_dir_all(&temp_dir);

    let current_pid = std::process::id();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let bat_path = temp_dir.join(format!("update_{}_{}.bat", current_pid, timestamp));

    let bat_content = format!(
        r#"@echo off
chcp 65001 > nul
timeout /t 1 /nobreak > nul
:wait_exit
tasklist /FI "PID eq {pid}" 2>NUL | find /I "{pid}" >NUL
if not errorlevel 1 (
    timeout /t 1 /nobreak > nul
    goto wait_exit
)
move /y "%TEMP_EXE%" "%TARGET_EXE%" > nul
start "" "%TARGET_EXE%"
del /f /q "%~f0" > nul 2>&1
"#,
        pid = current_pid
    );

    std::fs::write(&bat_path, bat_content)
        .map_err(|e| format!("Failed to write update batch script: {}", e))?;

    log::info!("Spawning updater script at {:?}", bat_path);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let _ = std::process::Command::new("cmd.exe")
            .args(&["/c", &bat_path.to_string_lossy()])
            .env("TEMP_EXE", temp_exe)
            .env("TARGET_EXE", &current_exe)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to execute update batch script: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::fs::copy(temp_exe, &current_exe);
    }

    // Clean up subsystems before terminating
    crate::cleanup_ide_subsystems();

    std::process::exit(0);
}

#[derive(Debug, Serialize, Clone)]
pub struct UpdateProgressPayload {
    pub percent: u32,
    pub received_bytes: u64,
    pub total_bytes: u64,
    pub speed_bytes_per_sec: f64,
}

#[tauri::command]
pub async fn check_update_metadata(
    url: String,
    private_token: Option<String>,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut req = client.get(&url);
    if let Some(token) = private_token {
        let trimmed = token.trim();
        if !trimmed.is_empty() {
            req = req.header("PRIVATE-TOKEN", trimmed);
        }
    }

    let resp = req.send().await.map_err(|e| format!("HTTP request error: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("Server returned HTTP {}", resp.status()));
    }

    let body = resp.text().await.map_err(|e| format!("Failed to read response body: {}", e))?;
    Ok(body)
}

#[tauri::command]
pub async fn download_update_binary(
    app: tauri::AppHandle,
    download_url: String,
    expected_sha256: String,
    private_token: Option<String>,
) -> Result<(), String> {
    use std::io::Write;
    use tauri::Emitter;

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut req = client.get(&download_url);
    if let Some(token) = private_token {
        let trimmed = token.trim();
        if !trimmed.is_empty() {
            req = req.header("PRIVATE-TOKEN", trimmed);
        }
    }

    let mut resp = req.send().await.map_err(|e| format!("Failed to connect to update server: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("Update download server returned HTTP {}", resp.status()));
    }

    let total_size = resp.content_length().unwrap_or(0);
    let temp_exe = get_temp_exe_path();
    if let Some(parent) = temp_exe.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut file = std::fs::File::create(&temp_exe)
        .map_err(|e| format!("Failed to create temp update file: {}", e))?;

    let mut hasher = Sha256::new();
    let mut downloaded: u64 = 0;
    let start_time = std::time::Instant::now();
    let mut last_emit = std::time::Instant::now();
    let mut first_bytes = Vec::new();

    while let Some(chunk) = resp.chunk().await.map_err(|e| format!("Error downloading update chunk: {}", e))? {
        if first_bytes.len() < 2 {
            first_bytes.extend_from_slice(&chunk[..chunk.len().min(2 - first_bytes.len())]);
        }
        hasher.update(&chunk);
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write chunk to disk: {}", e))?;

        downloaded = downloaded.saturating_add(chunk.len() as u64);

        if last_emit.elapsed().as_millis() > 80 || (total_size > 0 && downloaded == total_size) {
            let elapsed_sec = start_time.elapsed().as_secs_f64();
            let speed = if elapsed_sec > 0.0 { downloaded as f64 / elapsed_sec } else { 0.0 };
            let percent = if total_size > 0 {
                ((downloaded as f64 / total_size as f64) * 100.0).min(100.0) as u32
            } else {
                0
            };

            let _ = app.emit("update-download-progress", UpdateProgressPayload {
                percent,
                received_bytes: downloaded,
                total_bytes: total_size,
                speed_bytes_per_sec: speed,
            });
            last_emit = std::time::Instant::now();
        }
    }

    file.flush().map_err(|e| format!("Failed to flush temp update file: {}", e))?;

    #[cfg(target_os = "windows")]
    if !first_bytes.starts_with(b"MZ") {
        let _ = std::fs::remove_file(&temp_exe);
        return Err("Invalid Windows executable payload (missing MZ header)".to_string());
    }

    let digest = hasher.finalize();
    let mut actual_hex = String::with_capacity(64);
    for byte in digest {
        use std::fmt::Write;
        let _ = write!(&mut actual_hex, "{:02x}", byte);
    }

    let trimmed_sha = expected_sha256.trim().to_ascii_lowercase();
    if actual_hex != trimmed_sha {
        let _ = std::fs::remove_file(&temp_exe);
        return Err(format!(
            "Update SHA-256 checksum mismatch: expected {}, got {}",
            trimmed_sha,
            actual_hex
        ));
    }

    Ok(())
}

#[tauri::command]
pub async fn apply_downloaded_update(
    expected_sha256: String,
) -> Result<(), String> {
    let temp_exe = get_temp_exe_path();
    if !temp_exe.exists() {
        return Err("No downloaded update file found to apply.".to_string());
    }

    let bytes = std::fs::read(&temp_exe)
        .map_err(|e| format!("Failed to read downloaded update file: {}", e))?;
    verify_update_payload(&bytes, &expected_sha256)?;

    execute_swapper_and_exit(&temp_exe)
}

#[tauri::command]
pub async fn apply_update_and_restart(
    new_exe_bytes: Vec<u8>,
    expected_sha256: String,
) -> Result<(), String> {
    verify_update_payload(&new_exe_bytes, &expected_sha256)?;

    let temp_exe = get_temp_exe_path();
    if let Some(parent) = temp_exe.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&temp_exe, new_exe_bytes)
        .map_err(|e| format!("Failed to write downloaded executable to temp: {}", e))?;

    execute_swapper_and_exit(&temp_exe)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sha256_hex(data: &[u8]) -> String {
        let digest = Sha256::digest(data);
        let mut s = String::with_capacity(64);
        for b in digest {
            use std::fmt::Write;
            let _ = write!(&mut s, "{:02x}", b);
        }
        s
    }

    #[test]
    fn test_verify_update_payload_validation() {
        let payload = b"MZ\x90\x00dummy-pe-payload".to_vec();
        let valid_sha = sha256_hex(&payload);
        assert!(verify_update_payload(&payload, &valid_sha).is_ok());

        // Uppercase with surrounding whitespace also accepted
        assert!(verify_update_payload(&payload, &format!("  {}  ", valid_sha.to_uppercase())).is_ok());

        // Mismatch rejected
        let wrong_sha = "0".repeat(64);
        let err_mismatch = verify_update_payload(&payload, &wrong_sha).unwrap_err();
        assert!(err_mismatch.contains("checksum mismatch"));

        // Invalid hex rejected
        assert!(verify_update_payload(&payload, &"z".repeat(64)).unwrap_err().contains("Invalid expected SHA-256"));
        assert!(verify_update_payload(&payload, "abcd").unwrap_err().contains("Invalid expected SHA-256"));

        // Empty payload rejected
        assert!(verify_update_payload(&[], &valid_sha).is_err());

        // Missing MZ header rejected on Windows
        #[cfg(target_os = "windows")]
        {
            let non_mz = b"NOT_AN_EXE_PAYLOAD";
            let non_mz_sha = sha256_hex(non_mz);
            let err_mz = verify_update_payload(non_mz, &non_mz_sha).unwrap_err();
            assert!(err_mz.contains("MZ header"));
        }
    }
}
