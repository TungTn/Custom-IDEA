use serde::Serialize;

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
    "2026.1".to_string()
}

#[tauri::command]
pub async fn apply_update_and_restart(new_exe_bytes: Vec<u8>) -> Result<(), String> {
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get current executable path: {}", e))?;

    let temp_dir = std::env::temp_dir().join("custom-idea-updates");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp update dir: {}", e))?;

    let temp_exe = temp_dir.join("custom-idea-latest.exe");
    std::fs::write(&temp_exe, new_exe_bytes)
        .map_err(|e| format!("Failed to write downloaded executable to temp: {}", e))?;

    let current_pid = std::process::id();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let bat_path = temp_dir.join(format!("update_{}.bat", timestamp));

    // Kịch bản Batch tự hủy trên Windows theo chuẩn MIC Studio
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
move /y "{temp_exe}" "{target_exe}" > nul
start "" "{target_exe}"
del /f /q "%~f0" > nul 2>&1
"#,
        pid = current_pid,
        temp_exe = temp_exe.to_string_lossy(),
        target_exe = current_exe.to_string_lossy()
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
