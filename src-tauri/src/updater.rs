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

#[tauri::command]
pub async fn apply_update_and_restart(
    new_exe_bytes: Vec<u8>,
    expected_sha256: String,
) -> Result<(), String> {
    verify_update_payload(&new_exe_bytes, &expected_sha256)?;

    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get current executable path: {}", e))?;

    let temp_dir = std::env::temp_dir().join("custom-idea-updates");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp update dir: {}", e))?;

    let current_pid = std::process::id();
    let temp_exe = temp_dir.join(format!("custom-idea-latest-{}.exe", current_pid));
    std::fs::write(&temp_exe, new_exe_bytes)
        .map_err(|e| format!("Failed to write downloaded executable to temp: {}", e))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let bat_path = temp_dir.join(format!("update_{}_{}.bat", current_pid, timestamp));

    // Pass target & temp paths via environment variables instead of raw format! interpolation
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
            .env("TEMP_EXE", &temp_exe)
            .env("TARGET_EXE", &current_exe)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to execute update batch script: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::fs::copy(&temp_exe, &current_exe);
    }

    // Dọn sạch toàn bộ tiến trình con PTY, LSP, DAP trước khi thoát
    crate::cleanup_ide_subsystems();

    // Thoát tiến trình ngay lập tức để script batch không bị khóa file
    std::process::exit(0);
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
