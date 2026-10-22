#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[tauri::command]
fn select_directory(default_path: Option<String>) -> Result<Option<String>, String> {
  let mut dialog = rfd::FileDialog::new()
    .set_title("Select project File Directory");

  if let Some(ref p) = default_path {
    if !p.is_empty() {
      dialog = dialog.set_directory(p);
    }
  }

  let folder = dialog.pick_folder();
  Ok(folder.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn create_project_on_disk(
  project_path: String,
  files_to_create: Vec<(String, String)>,
  init_git: bool,
) -> Result<String, String> {
  use std::fs;
  use std::path::Path;

  let base = Path::new(&project_path);
  fs::create_dir_all(base).map_err(|e| format!("Failed to create project directory: {}", e))?;

  for (rel_path, content) in files_to_create {
    let full_path = base.join(rel_path);
    if let Some(parent) = full_path.parent() {
      fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory structure: {}", e))?;
    }
    fs::write(&full_path, content).map_err(|e| format!("Failed to write file {}: {}", full_path.display(), e))?;
  }

  if init_git {
    let mut git_cmd = std::process::Command::new("git");
    git_cmd.args(&["init"]);
    git_cmd.current_dir(base);
    #[cfg(windows)]
    git_cmd.creation_flags(0x08000000);
    let _ = git_cmd.output();
  }

  Ok(project_path)
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct FileNodeDto {
  pub id: String,
  pub name: String,
  pub path: String,
  #[serde(rename = "isFolder")]
  pub is_folder: bool,
  pub children: Option<Vec<FileNodeDto>>,
  pub content: Option<String>,
  pub language: Option<String>,
}

fn get_language_from_ext(ext: &str) -> String {
  match ext {
    "rs" => "rust".to_string(),
    "ts" | "tsx" => "typescript".to_string(),
    "js" | "jsx" => "javascript".to_string(),
    "java" => "java".to_string(),
    "kt" => "kotlin".to_string(),
    "py" => "python".to_string(),
    "json" => "json".to_string(),
    "html" => "html".to_string(),
    "css" => "css".to_string(),
    "md" => "markdown".to_string(),
    "toml" | "ini" => "ini".to_string(),
    "xml" => "xml".to_string(),
    "sql" => "sql".to_string(),
    "sh" | "bash" | "ps1" => "shell".to_string(),
    _ => "plaintext".to_string(),
  }
}

fn read_directory_tree(path: &std::path::Path, current_depth: usize, max_depth: usize) -> FileNodeDto {
  let name = path.file_name()
    .map(|n| n.to_string_lossy().to_string())
    .filter(|s| !s.is_empty())
    .unwrap_or_else(|| path.to_string_lossy().to_string());
  let path_str = path.to_string_lossy().to_string();

  if path.is_dir() {
    let mut children = Vec::new();
    if current_depth < max_depth {
      if let Ok(entries) = std::fs::read_dir(path) {
        let mut dir_entries: Vec<std::fs::DirEntry> = entries.filter_map(Result::ok).collect();
        dir_entries.sort_by(|a, b| {
          let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
          let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
          if a_is_dir != b_is_dir {
            b_is_dir.cmp(&a_is_dir)
          } else {
            a.file_name().cmp(&b.file_name())
          }
        });

        for entry in dir_entries {
          let entry_name = entry.file_name().to_string_lossy().to_string();
          if entry_name == ".git" || entry_name == ".idea" || entry_name == ".vscode" 
            || entry_name == "node_modules" || entry_name == "target" || entry_name == "dist" 
            || entry_name == "__pycache__" || entry_name == ".DS_Store" {
            continue;
          }
          children.push(read_directory_tree(&entry.path(), current_depth + 1, max_depth));
        }
      }
    }

    FileNodeDto {
      id: path_str.clone(),
      name,
      path: path_str,
      is_folder: true,
      children: Some(children),
      content: None,
      language: None,
    }
  } else {
    let ext = path.extension().unwrap_or_default().to_string_lossy().to_lowercase();
    let lang = get_language_from_ext(&ext);
    let content = if let Ok(meta) = path.metadata() {
      if meta.len() < 500_000 {
        std::fs::read_to_string(path).ok()
      } else {
        Some("// File exceeds 500KB - preview truncated".to_string())
      }
    } else {
      None
    };

    FileNodeDto {
      id: path_str.clone(),
      name,
      path: path_str,
      is_folder: false,
      children: None,
      content,
      language: Some(lang),
    }
  }
}

#[tauri::command]
fn open_project_dialog(default_path: Option<String>) -> Result<Option<FileNodeDto>, String> {
  let mut dialog = rfd::FileDialog::new()
    .set_title("Open File or Project");

  if let Some(ref p) = default_path {
    if !p.is_empty() {
      dialog = dialog.set_directory(p);
    }
  }

  if let Some(folder) = dialog.pick_folder() {
    let tree = read_directory_tree(&folder, 0, 8);
    Ok(Some(tree))
  } else {
    Ok(None)
  }
}

#[tauri::command]
fn open_project_by_path(project_path: String) -> Result<FileNodeDto, String> {
  let path = std::path::Path::new(&project_path);
  if !path.exists() {
    return Err(format!("Path does not exist: {}", project_path));
  }
  let tree = read_directory_tree(path, 0, 8);
  Ok(tree)
}

#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
  std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn save_file_content(path: String, content: String) -> Result<(), String> {
  std::fs::write(&path, content).map_err(|e| format!("Failed to save file: {}", e))
}

#[tauri::command]
async fn open_in_new_window(app: tauri::AppHandle, project_name: String, project_path: Option<String>) -> Result<(), String> {
  use tauri::Manager;
  let label = format!("win-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
  
  let target_url = if let Some(win) = app.get_webview_window("main").or_else(|| app.webview_windows().values().next().cloned()) {
    if let Ok(mut base_url) = win.url() {
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
    .theme(Some(tauri::Theme::Dark))
    .build()
    .map_err(|e| format!("Failed to create new window: {}", e))?;
  Ok(())
}

#[tauri::command]
fn app_minimize_window(window: tauri::Window) -> Result<(), String> {
  window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn app_toggle_maximize_window(window: tauri::Window) -> Result<bool, String> {
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
fn app_close_window(window: tauri::Window) -> Result<(), String> {
  window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn app_is_maximized(window: tauri::Window) -> Result<bool, String> {
  window.is_maximized().map_err(|e| e.to_string())
}

#[tauri::command]
fn test_git_executable(path: Option<String>) -> Result<String, String> {
  let git_exe = path.unwrap_or_else(|| "git".to_string());
  let target = if git_exe.trim().is_empty() { "git" } else { git_exe.trim() };
  let mut cmd = std::process::Command::new(target);
  cmd.arg("--version");
  #[cfg(windows)]
  cmd.creation_flags(0x08000000);

  match cmd.output() {
    Ok(output) => {
      if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(if stdout.is_empty() { "Git executable detected successfully".to_string() } else { stdout })
      } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!("Git returned error: {}", if stderr.is_empty() { "Unknown error".to_string() } else { stderr }))
      }
    }
    Err(e) => Err(format!("Failed to execute '{}': {}", target, e)),
  }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ToolchainInfo {
  pub rust: Option<String>,
  pub cargo: Option<String>,
  pub node: Option<String>,
  pub python: Option<String>,
  pub java: Option<String>,
}

#[tauri::command]
fn detect_toolchains() -> Result<ToolchainInfo, String> {
  let run_cmd = |exe: &str, arg: &str| -> Option<String> {
    let mut cmd = std::process::Command::new(exe);
    cmd.arg(arg);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    cmd.output().ok().and_then(|out| {
      let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
      let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
      if out.status.success() && !s.is_empty() { 
        Some(s) 
      } else if !err.is_empty() && (err.contains("version") || err.contains("openjdk") || err.contains("java")) { 
        Some(err.lines().next().unwrap_or("").to_string()) 
      } else { 
        None 
      }
    })
  };

  Ok(ToolchainInfo {
    rust: run_cmd("rustc", "--version"),
    cargo: run_cmd("cargo", "--version"),
    node: run_cmd("node", "--version"),
    python: run_cmd("python", "--version"),
    java: run_cmd("java", "-version"),
  })
}

#[tauri::command]
fn fetch_marketplace_plugins(query: Option<String>, max: Option<usize>) -> Result<serde_json::Value, String> {
  let q = query.unwrap_or_default();
  let limit = max.unwrap_or(25);
  let url = if q.trim().is_empty() {
    format!("https://plugins.jetbrains.com/api/searchPlugins?max={}", limit)
  } else {
    let encoded = q.trim().replace(' ', "%20");
    format!("https://plugins.jetbrains.com/api/searchPlugins?query={}&max={}", encoded, limit)
  };

  let mut cmd = std::process::Command::new("curl.exe");
  cmd.args(&["-s", "-H", "User-Agent: IntelliJ-IDEA/2024.1", &url]);
  #[cfg(windows)]
  cmd.creation_flags(0x08000000);

  match cmd.output() {
    Ok(out) => {
      if out.status.success() {
        let text = String::from_utf8_lossy(&out.stdout);
        let val: serde_json::Value = serde_json::from_str(&text).map_err(|e| format!("Failed to parse JSON: {}", e))?;
        Ok(val)
      } else {
        Err(format!("Curl error: {}", String::from_utf8_lossy(&out.stderr)))
      }
    }
    Err(e) => Err(format!("Curl execution failed: {}", e)),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      select_directory, 
      create_project_on_disk, 
      open_project_dialog, 
      open_project_by_path,
      read_file_content,
      save_file_content,
      open_in_new_window,
      test_git_executable,
      detect_toolchains,
      fetch_marketplace_plugins,
      app_minimize_window,
      app_toggle_maximize_window,
      app_close_window,
      app_is_maximized
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}


