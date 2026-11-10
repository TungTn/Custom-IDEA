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
    crate::cleanup_ide_subsystems();
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

static MARKETPLACE_CLIENT: LazyLock<Result<reqwest::Client, String>> = LazyLock::new(|| {
  reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(30))
    .user_agent("IntelliJ-IDEA/2024.1")
    .build()
    .map_err(|e| format!("Failed to initialize Marketplace HTTP client: {}", e))
});

async fn fetch_marketplace_json(url: &str, query: &[(&str, String)]) -> Result<serde_json::Value, String> {
  let client = MARKETPLACE_CLIENT.as_ref().map_err(|e| e.clone())?;
  let mut req = client.get(url);
  if !query.is_empty() {
    req = req.query(query);
  }
  let mut res = req.send().await.map_err(|e| format!("Marketplace request failed: {}", e))?;
  let status = res.status();
  let mut buf: Vec<u8> = Vec::new();
  const MAX_JSON_BYTES: usize = 4 * 1024 * 1024;
  while let Some(chunk) = res.chunk().await.map_err(|e| format!("Failed reading marketplace response: {}", e))? {
    if buf.len() + chunk.len() > MAX_JSON_BYTES {
      return Err("Marketplace response exceeded 4 MiB limit".to_string());
    }
    buf.extend_from_slice(&chunk);
  }
  if !status.is_success() {
    let msg = serde_json::from_slice::<serde_json::Value>(&buf)
      .ok()
      .and_then(|v| v.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()))
      .unwrap_or_else(|| String::from_utf8_lossy(&buf).chars().take(200).collect());
    return Err(format!("JetBrains API error {}: {}", status.as_u16(), msg));
  }
  let val: serde_json::Value = serde_json::from_slice(&buf)
    .map_err(|e| format!("Failed to parse JSON (HTTP {}): {}", status.as_u16(), e))?;
  if let Some(code) = val.get("statusCode").and_then(|c| c.as_i64()) {
    if code >= 400 {
      return Err(format!(
        "JetBrains API error {}: {}",
        code,
        val.get("message").and_then(|m| m.as_str()).unwrap_or("unknown")
      ));
    }
  }
  Ok(val)
}

#[tauri::command]
pub async fn fetch_marketplace_plugins(query: Option<String>, max: Option<usize>) -> Result<serde_json::Value, String> {
  let q = query.unwrap_or_default();
  let limit = max.unwrap_or(20).clamp(1, 20);
  let mut params = vec![
    ("build", "IU-241.14494.240".to_string()),
    ("max", limit.to_string()),
  ];
  if !q.trim().is_empty() {
    params.push(("search", q.trim().to_string()));
  }
  fetch_marketplace_json("https://plugins.jetbrains.com/api/search/plugins", &params).await
}

#[tauri::command]
pub async fn fetch_plugin_details(id: usize) -> Result<serde_json::Value, String> {
  let url = format!("https://plugins.jetbrains.com/api/plugins/{}", id);
  fetch_marketplace_json(&url, &[]).await
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
pub async fn download_and_install_plugin(plugin_id: usize, plugin_name: String) -> Result<PluginInstallResultDto, String> {
  let download_url = format!("https://plugins.jetbrains.com/plugin/download?rel=true&pluginId={}", plugin_id);

  let plugins_dir = if let Ok(appdata) = std::env::var("APPDATA") {
    std::path::PathBuf::from(appdata).join("Custom-IDEA").join("plugins")
  } else {
    std::env::temp_dir().join("custom-idea-plugins")
  };

  std::fs::create_dir_all(&plugins_dir).map_err(|e| format!("Failed to create plugins dir: {}", e))?;

  let clean_name = plugin_name.replace(|c: char| !c.is_alphanumeric(), "_");
  let target_archive = plugins_dir.join(format!("{}_{}.zip", plugin_id, clean_name));
  let part_archive = plugins_dir.join(format!("{}_{}.zip.part", plugin_id, clean_name));

  struct PartGuard(std::path::PathBuf);
  impl Drop for PartGuard {
    fn drop(&mut self) {
      let _ = std::fs::remove_file(&self.0);
    }
  }
  let _part_guard = PartGuard(part_archive.clone());

  let client = MARKETPLACE_CLIENT.as_ref().map_err(|e| e.clone())?;
  let mut res = client
    .get(&download_url)
    .send()
    .await
    .map_err(|e| format!("Plugin download failed: {}", e))?;
  if !res.status().is_success() {
    return Err(format!("Plugin download failed with HTTP {}", res.status()));
  }

  let mut total_written: u64 = 0;
  const MAX_PLUGIN_BYTES: u64 = 256 * 1024 * 1024;
  {
    use std::io::Write;
    let mut file = std::fs::File::create(&part_archive)
      .map_err(|e| format!("Failed to create plugin temp file: {}", e))?;
    while let Some(chunk) = res.chunk().await.map_err(|e| format!("Failed downloading plugin chunk: {}", e))? {
      total_written += chunk.len() as u64;
      if total_written > MAX_PLUGIN_BYTES {
        return Err("Plugin archive exceeded 256 MiB limit".to_string());
      }
      file.write_all(&chunk).map_err(|e| format!("Failed writing plugin archive: {}", e))?;
    }
  }

  if total_written < 100 {
    return Err("Downloaded archive is empty or invalid (network error).".to_string());
  }

  // Validate ZIP structure and inspect actual META-INF/plugin.xml presence
  let has_plugin_xml = {
    let f = std::fs::File::open(&part_archive)
      .map_err(|e| format!("Failed to reopen downloaded plugin archive: {}", e))?;
    let archive = zip::ZipArchive::new(f)
      .map_err(|e| format!("Downloaded plugin is not a valid ZIP archive: {}", e))?;
    let found = archive
      .file_names()
      .any(|name| name.replace('\\', "/").eq_ignore_ascii_case("META-INF/plugin.xml")
        || name.replace('\\', "/").to_ascii_lowercase().ends_with("/meta-inf/plugin.xml"));
    found
  };

  std::fs::rename(&part_archive, &target_archive)
    .map_err(|e| format!("Failed to finalize plugin archive: {}", e))?;

  let is_theme = plugin_name.to_lowercase().contains("theme");
  let p_str = target_archive.to_string_lossy().to_string();

  Ok(PluginInstallResultDto {
    success: true,
    plugin_id,
    name: plugin_name.clone(),
    local_path: p_str,
    is_theme,
    has_plugin_xml,
    message: format!("Plugin '{}' package verified and saved to disk ({} KB).", plugin_name, total_written / 1024),
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
