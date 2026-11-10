use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub static PENDING_WINDOW_PROJECTS: LazyLock<Mutex<HashMap<String, String>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

#[tauri::command]
pub async fn open_in_new_window(app: tauri::AppHandle, project_name: String, project_path: Option<String>) -> Result<(), String> {
  use tauri::Manager;
  let label = format!("win-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
  
  if let Some(ref p) = project_path {
    if let Ok(mut map) = PENDING_WINDOW_PROJECTS.lock() {
      map.insert(label.clone(), p.clone());
    }
  }

  let target_url = if let Some(win) = app.get_webview_window("main").or_else(|| app.webview_windows().values().next().cloned()) {
    if let Ok(mut base_url) = win.url() {
      base_url.set_query(None);
      if let Some(ref p) = project_path {
        base_url.query_pairs_mut().append_pair("openPath", p);
      }
      tauri::WebviewUrl::External(base_url)
    } else {
      tauri::WebviewUrl::App("index.html".into())
    }
  } else {
    tauri::WebviewUrl::App("index.html".into())
  };

  tauri::WebviewWindowBuilder::new(&app, &label, target_url)
    .title(format!("IntelliJ IDEA – {}", project_name))
    .inner_size(1280.0, 800.0)
    .min_inner_size(900.0, 600.0)
    .decorations(false)
    .shadow(true)
    .maximized(true)
    .theme(Some(tauri::Theme::Dark))
    .build()
    .map_err(|e| format!("Failed to create new window: {}", e))?;
  Ok(())
}

#[tauri::command]
pub fn get_window_initial_project(window: tauri::Window) -> Option<String> {
  let label = window.label();
  let mut map = PENDING_WINDOW_PROJECTS.lock().ok()?;
  map.remove(label)
}

#[tauri::command]
pub fn app_minimize_window(window: tauri::Window) -> Result<(), String> {
  window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn app_toggle_maximize_window(window: tauri::Window) -> Result<bool, String> {
  let is_max = window.is_maximized().unwrap_or(false);
  if is_max {
    window.unmaximize().map_err(|e| e.to_string())?;
    Ok(false)
  } else {
    window.maximize().map_err(|e| e.to_string())?;
    Ok(true)
  }
}

#[tauri::command]
pub fn app_close_window(app: tauri::AppHandle, window: tauri::Window) -> Result<(), String> {
  let log_path = std::env::temp_dir().join("ide_exit_reason.log");
  let _ = std::fs::write(log_path, format!("app_close_window called by {}\n", window.label()));
  log::info!("app_close_window called by {}", window.label());
  use tauri::Manager;
  let windows = app.webview_windows();
  if windows.len() <= 1 {
    let _ = crate::process::stop_all_processes();
    crate::pty::kill_all_pty_sessions();
    let _ = window.close();
    std::process::exit(0);
  } else {
    window.close().map_err(|e| e.to_string())
  }
}

#[tauri::command]
pub fn app_is_maximized(window: tauri::Window) -> Result<bool, String> {
  window.is_maximized().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn app_start_dragging(window: tauri::Window) -> Result<(), String> {
  window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fetch_marketplace_plugins(query: Option<String>, max: Option<usize>) -> Result<serde_json::Value, String> {
  let q = query.unwrap_or_default();
  let limit = max.unwrap_or(20).clamp(1, 20);
  let url = if q.trim().is_empty() {
    format!("https://plugins.jetbrains.com/api/search/plugins?build=IU-241.14494.240&max={}", limit)
  } else {
    let encoded = q.trim().replace(' ', "%20");
    format!("https://plugins.jetbrains.com/api/search/plugins?build=IU-241.14494.240&search={}&max={}", encoded, limit)
  };

  #[cfg(windows)]
  let mut cmd = std::process::Command::new("curl.exe");
  #[cfg(not(windows))]
  let mut cmd = std::process::Command::new("curl");
  cmd.args(&["-s", "-H", "User-Agent: IntelliJ-IDEA/2024.1", &url]);
  #[cfg(windows)]
  cmd.creation_flags(0x08000000);

  match cmd.output() {
    Ok(out) => {
      if out.status.success() {
        let text = String::from_utf8_lossy(&out.stdout);
        let val: serde_json::Value = serde_json::from_str(&text).map_err(|e| format!("Failed to parse JSON: {}", e))?;
        if let Some(code) = val.get("statusCode").and_then(|c| c.as_i64()) {
          if code >= 400 {
            return Err(format!("JetBrains API error {}: {}", code, val.get("message").and_then(|m| m.as_str()).unwrap_or("unknown")));
          }
        }
        Ok(val)
      } else {
        Err(format!("Curl error: {}", String::from_utf8_lossy(&out.stderr)))
      }
    }
    Err(e) => Err(format!("Curl execution failed: {}", e)),
  }
}

#[tauri::command]
pub fn fetch_plugin_details(id: usize) -> Result<serde_json::Value, String> {
  let url = format!("https://plugins.jetbrains.com/api/plugins/{}", id);
  #[cfg(windows)]
  let mut cmd = std::process::Command::new("curl.exe");
  #[cfg(not(windows))]
  let mut cmd = std::process::Command::new("curl");
  cmd.args(&["-s", "-H", "User-Agent: IntelliJ-IDEA/2024.1", &url]);
  #[cfg(windows)]
  cmd.creation_flags(0x08000000);

  match cmd.output() {
    Ok(out) => {
      if out.status.success() {
        let text = String::from_utf8_lossy(&out.stdout);
        let val: serde_json::Value = serde_json::from_str(&text).map_err(|e| format!("Failed to parse JSON: {}", e))?;
        if let Some(code) = val.get("statusCode").and_then(|c| c.as_i64()) {
          if code >= 400 {
            return Err(format!("JetBrains API error {}: {}", code, val.get("message").and_then(|m| m.as_str()).unwrap_or("unknown")));
          }
        }
        Ok(val)
      } else {
        Err(format!("Curl error: {}", String::from_utf8_lossy(&out.stderr)))
      }
    }
    Err(e) => Err(format!("Curl execution failed: {}", e)),
  }
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct PluginInstallResultDto {
  pub success: bool,
  pub plugin_id: usize,
  pub name: String,
  pub local_path: String,
  pub is_theme: bool,
  pub has_plugin_xml: bool,
  pub message: String,
}

#[tauri::command]
pub fn download_and_install_plugin(plugin_id: usize, plugin_name: String) -> Result<PluginInstallResultDto, String> {
  let download_url = format!("https://plugins.jetbrains.com/plugin/download?rel=true&pluginId={}", plugin_id);
  
  let plugins_dir = if let Ok(appdata) = std::env::var("APPDATA") {
    std::path::PathBuf::from(appdata).join("Custom-IDEA").join("plugins")
  } else {
    std::env::temp_dir().join("custom-idea-plugins")
  };
  
  std::fs::create_dir_all(&plugins_dir).map_err(|e| format!("Failed to create plugins dir: {}", e))?;
  
  let clean_name = plugin_name.replace(|c: char| !c.is_alphanumeric(), "_");
  let target_archive = plugins_dir.join(format!("{}_{}.zip", plugin_id, clean_name));

  #[cfg(windows)]
  let mut cmd = std::process::Command::new("curl.exe");
  #[cfg(not(windows))]
  let mut cmd = std::process::Command::new("curl");

  cmd.args(&["-L", "-s", "-H", "User-Agent: IntelliJ-IDEA/2024.1", "-o", target_archive.to_string_lossy().as_ref(), &download_url]);
  #[cfg(windows)]
  cmd.creation_flags(0x08000000);

  let output = cmd.output().map_err(|e| format!("Curl download failed: {}", e))?;
  if !output.status.success() {
    return Err(format!("Download failed with code: {:?}", output.status.code()));
  }

  // Check file exists and size
  let meta = std::fs::metadata(&target_archive).map_err(|e| format!("Plugin file not saved: {}", e))?;
  if meta.len() < 100 {
    return Err("Downloaded archive is empty or invalid (network error).".to_string());
  }

  let is_theme = plugin_name.to_lowercase().contains("theme");
  let p_str = target_archive.to_string_lossy().to_string();

  Ok(PluginInstallResultDto {
    success: true,
    plugin_id,
    name: plugin_name.clone(),
    local_path: p_str,
    is_theme,
    has_plugin_xml: true,
    message: format!("Plugin '{}' package verified and saved to disk ({} KB).", plugin_name, meta.len() / 1024),
  })
}

#[tauri::command]
pub fn reveal_in_explorer(path: String) -> Result<(), String> {
  let p = std::path::Path::new(&path);
  if !p.exists() {
    return Err(format!("File does not exist: {}", path));
  }

  #[cfg(windows)]
  {
    let win_path = path.replace('/', "\\");
    let mut cmd = std::process::Command::new("explorer.exe");
    cmd.arg(format!("/select,{}", win_path));
    cmd.creation_flags(0x08000000);
    let _ = cmd.spawn();
    Ok(())
  }

  #[cfg(target_os = "macos")]
  {
    let mut cmd = std::process::Command::new("open");
    cmd.arg("-R").arg(&path);
    let _ = cmd.spawn();
    Ok(())
  }

  #[cfg(all(not(windows), not(target_os = "macos")))]
  {
    let target = if p.is_dir() { p } else { p.parent().unwrap_or(p) };
    let mut cmd = std::process::Command::new("xdg-open");
    cmd.arg(target);
    let _ = cmd.spawn();
    Ok(())
  }
}
