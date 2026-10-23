#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::sync::{LazyLock, Mutex};
use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::io::{BufRead, BufReader, Read, Write};
use tauri::Emitter;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use notify::{Watcher, RecursiveMode, Event};

static RUNNING_PROCESSES: LazyLock<Mutex<HashMap<String, Child>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

struct PtySession {
  pub writer: Box<dyn Write + Send>,
  pub master: Box<dyn portable_pty::MasterPty + Send>,
  pub child: Box<dyn portable_pty::Child + Send>,
}

static PTY_SESSIONS: LazyLock<Mutex<HashMap<String, PtySession>>> = LazyLock::new(|| Mutex::new(HashMap::new()));
static FS_WATCHER: LazyLock<Mutex<Option<notify::RecommendedWatcher>>> = LazyLock::new(|| Mutex::new(None));
static PENDING_WINDOW_PROJECTS: LazyLock<Mutex<HashMap<String, String>>> = LazyLock::new(|| Mutex::new(HashMap::new()));


#[derive(Clone, serde::Serialize)]
pub struct ProcessOutputPayload {
  pub run_id: String,
  pub text: String,
  pub stream: String,
}

#[derive(Clone, serde::Serialize)]
pub struct ProcessExitPayload {
  pub run_id: String,
  pub exit_code: i32,
  pub success: bool,
}

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
    "js" | "jsx" | "mjs" | "cjs" => "javascript".to_string(),
    "vue" => "vue".to_string(),
    "svelte" => "svelte".to_string(),
    "java" => "java".to_string(),
    "kt" | "kts" => "kotlin".to_string(),
    "py" => "python".to_string(),
    "json" => "json".to_string(),
    "html" | "htm" => "html".to_string(),
    "css" => "css".to_string(),
    "scss" | "sass" => "scss".to_string(),
    "less" => "less".to_string(),
    "md" | "markdown" => "markdown".to_string(),
    "toml" | "ini" | "env" => "ini".to_string(),
    "yaml" | "yml" => "yaml".to_string(),
    "xml" | "svg" => "xml".to_string(),
    "sql" => "sql".to_string(),
    "sh" | "bash" | "zsh" | "ps1" => "shell".to_string(),
    "go" => "go".to_string(),
    "php" => "php".to_string(),
    "c" | "h" | "cpp" | "hpp" | "cc" => "cpp".to_string(),
    "cs" => "csharp".to_string(),
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
    .theme(Some(tauri::Theme::Dark))
    .build()
    .map_err(|e| format!("Failed to create new window: {}", e))?;
  Ok(())
}

#[tauri::command]
fn get_window_initial_project(window: tauri::Window) -> Option<String> {
  let label = window.label();
  let mut map = PENDING_WINDOW_PROJECTS.lock().ok()?;
  map.remove(label)
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
fn app_start_dragging(window: tauri::Window) -> Result<(), String> {
  window.start_dragging().map_err(|e| e.to_string())
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
  let limit = max.unwrap_or(20).clamp(1, 20);
  let url = if q.trim().is_empty() {
    format!("https://plugins.jetbrains.com/api/search/plugins?build=IU-241.14494.240&max={}", limit)
  } else {
    let encoded = q.trim().replace(' ', "%20");
    format!("https://plugins.jetbrains.com/api/search/plugins?build=IU-241.14494.240&search={}&max={}", encoded, limit)
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
fn fetch_plugin_details(id: usize) -> Result<serde_json::Value, String> {
  let url = format!("https://plugins.jetbrains.com/api/plugins/{}", id);
  let mut cmd = std::process::Command::new("curl.exe");
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
fn stop_process(run_id: String) -> Result<(), String> {
  let mut map = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;
  if let Some(mut child) = map.remove(&run_id) {
    let pid = child.id();
    #[cfg(windows)]
    {
      let _ = std::process::Command::new("taskkill")
        .args(&["/F", "/T", "/PID", &pid.to_string()])
        .creation_flags(0x08000000)
        .output();
    }
    let _ = child.kill();
    let _ = child.wait();
  }
  Ok(())
}

#[tauri::command]
fn start_process(
  app: tauri::AppHandle,
  run_id: String,
  command: String,
  args: Vec<String>,
  cwd: Option<String>,
  env_vars: Option<HashMap<String, String>>,
) -> Result<(), String> {
  let _ = stop_process(run_id.clone());

  let work_dir = cwd.unwrap_or_else(|| ".".to_string());

  #[cfg(windows)]
  let mut cmd = {
    let mut c = Command::new("cmd.exe");
    c.arg("/d").arg("/c");
    let mut full_cmd = command.clone();
    for a in &args {
      full_cmd.push(' ');
      if a.contains(' ') {
        full_cmd.push('"');
        full_cmd.push_str(a);
        full_cmd.push('"');
      } else {
        full_cmd.push_str(a);
      }
    }
    c.arg(&full_cmd);
    c.creation_flags(0x08000000);
    c
  };

  #[cfg(not(windows))]
  let mut cmd = {
    let mut c = Command::new(&command);
    c.args(&args);
    c
  };

  if let Some(envs) = env_vars {
    for (k, v) in envs {
      cmd.env(k, v);
    }
  }

  cmd.current_dir(&work_dir);
  cmd.stdout(Stdio::piped());
  cmd.stderr(Stdio::piped());

  let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn process '{}': {}", command, e))?;

  let stdout = child.stdout.take();
  let stderr = child.stderr.take();

  {
    let mut map = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;
    map.insert(run_id.clone(), child);
  }

  // Stream stdout
  if let Some(out) = stdout {
    let app_clone = app.clone();
    let r_id = run_id.clone();
    std::thread::spawn(move || {
      let reader = BufReader::new(out);
      for line in reader.lines() {
        if let Ok(l) = line {
          let _ = app_clone.emit("process-output", ProcessOutputPayload {
            run_id: r_id.clone(),
            text: l,
            stream: "stdout".into(),
          });
        }
      }
    });
  }

  // Stream stderr
  if let Some(err) = stderr {
    let app_clone = app.clone();
    let r_id = run_id.clone();
    std::thread::spawn(move || {
      let reader = BufReader::new(err);
      for line in reader.lines() {
        if let Ok(l) = line {
          let _ = app_clone.emit("process-output", ProcessOutputPayload {
            run_id: r_id.clone(),
            text: l,
            stream: "stderr".into(),
          });
        }
      }
    });
  }

  // Background monitor for completion
  let app_clone = app.clone();
  let r_id = run_id.clone();
  std::thread::spawn(move || {
    loop {
      std::thread::sleep(std::time::Duration::from_millis(100));
      let mut map = match RUNNING_PROCESSES.lock() {
        Ok(m) => m,
        Err(_) => break,
      };

      let mut is_done = false;
      let mut code = 0;
      let mut success = false;

      if let Some(child) = map.get_mut(&r_id) {
        match child.try_wait() {
          Ok(Some(status)) => {
            is_done = true;
            code = status.code().unwrap_or(-1);
            success = status.success();
          }
          Ok(None) => {}
          Err(_) => {
            is_done = true;
            code = -1;
          }
        }
      } else {
        // Stopped or removed
        break;
      }

      if is_done {
        map.remove(&r_id);
        let _ = app_clone.emit("process-terminated", ProcessExitPayload {
          run_id: r_id.clone(),
          exit_code: code,
          success,
        });
        break;
      }
    }
  });

  Ok(())
}

#[tauri::command]
fn terminal_kill(session_id: String) -> Result<(), String> {
  let mut map = PTY_SESSIONS.lock().map_err(|e| e.to_string())?;
  if let Some(mut session) = map.remove(&session_id) {
    let _ = session.child.kill();
  }
  Ok(())
}

#[tauri::command]
fn terminal_spawn(
  app: tauri::AppHandle,
  session_id: String,
  cwd: Option<String>,
  cols: Option<u16>,
  rows: Option<u16>,
) -> Result<(), String> {
  let _ = terminal_kill(session_id.clone());

  let pty_system = NativePtySystem::default();
  let pair = pty_system
    .openpty(PtySize {
      rows: rows.unwrap_or(24),
      cols: cols.unwrap_or(80),
      pixel_width: 0,
      pixel_height: 0,
    })
    .map_err(|e| format!("Failed to open PTY: {}", e))?;

  #[cfg(windows)]
  let shell = "powershell.exe";
  #[cfg(not(windows))]
  let shell = std::env::var("SHELL").unwrap_or_else(|_| "bash".to_string());

  let mut cmd = CommandBuilder::new(shell);
  if let Some(dir) = cwd {
    if !dir.is_empty() {
      cmd.cwd(dir);
    }
  }

  let child = pair.slave.spawn_command(cmd).map_err(|e| format!("Failed to spawn shell: {}", e))?;
  drop(pair.slave);

  let mut reader = pair.master.try_clone_reader().map_err(|e| format!("Failed to clone PTY reader: {}", e))?;
  let writer = pair.master.take_writer().map_err(|e| format!("Failed to take PTY writer: {}", e))?;

  {
    let mut map = PTY_SESSIONS.lock().map_err(|e| e.to_string())?;
    map.insert(session_id.clone(), PtySession {
      writer,
      master: pair.master,
      child,
    });
  }

  let app_clone = app.clone();
  let s_id = session_id.clone();
  std::thread::spawn(move || {
    let mut buf = [0u8; 4096];
    loop {
      match reader.read(&mut buf) {
        Ok(0) => break,
        Ok(n) => {
          let text = String::from_utf8_lossy(&buf[..n]).to_string();
          let _ = app_clone.emit("terminal-data", serde_json::json!({
            "session_id": s_id,
            "data": text
          }));
        }
        Err(_) => break,
      }
    }
    let _ = app_clone.emit("terminal-exit", serde_json::json!({
      "session_id": s_id
    }));
  });

  Ok(())
}

#[tauri::command]
fn terminal_write(session_id: String, data: String) -> Result<(), String> {
  let mut map = PTY_SESSIONS.lock().map_err(|e| e.to_string())?;
  if let Some(session) = map.get_mut(&session_id) {
    session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())?;
    Ok(())
  } else {
    Err(format!("Session {} not found", session_id))
  }
}

#[tauri::command]
fn terminal_resize(session_id: String, cols: u16, rows: u16) -> Result<(), String> {
  let map = PTY_SESSIONS.lock().map_err(|e| e.to_string())?;
  if let Some(session) = map.get(&session_id) {
    session.master.resize(PtySize {
      rows,
      cols,
      pixel_width: 0,
      pixel_height: 0,
    }).map_err(|e| e.to_string())?;
    Ok(())
  } else {
    Err(format!("Session {} not found", session_id))
  }
}

fn run_git_cmd(cwd: &str, args: &[&str]) -> Result<String, String> {
  let mut cmd = Command::new("git");
  cmd.args(args);
  cmd.current_dir(cwd);
  #[cfg(windows)]
  cmd.creation_flags(0x08000000);

  match cmd.output() {
    Ok(out) => {
      if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
      } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
      }
    }
    Err(e) => Err(format!("Failed to execute git: {}", e)),
  }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct GitFileChangeDto {
  pub path: String,
  pub status: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct GitStatusDto {
  pub branch: String,
  pub changes: Vec<GitFileChangeDto>,
  pub is_clean: bool,
}

#[tauri::command]
fn git_get_status(project_path: String) -> Result<GitStatusDto, String> {
  let branch = run_git_cmd(&project_path, &["branch", "--show-current"])
    .unwrap_or_else(|_| "main".to_string());

  let status_out = run_git_cmd(&project_path, &["status", "--porcelain=v1"])
    .unwrap_or_default();

  let mut changes = Vec::new();
  for line in status_out.lines() {
    let trimmed = line.trim();
    if trimmed.len() >= 3 {
      let code = trimmed[..2].trim();
      let path = trimmed[2..].trim().to_string();
      changes.push(GitFileChangeDto {
        status: code.to_string(),
        path,
      });
    }
  }

  let is_clean = changes.is_empty();
  Ok(GitStatusDto {
    branch,
    changes,
    is_clean,
  })
}

#[tauri::command]
fn git_get_diff(project_path: String, file_path: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["diff", "HEAD", "--", &file_path])
    .or_else(|_| run_git_cmd(&project_path, &["diff", "--", &file_path]))
}

#[tauri::command]
fn git_commit(project_path: String, message: String, files: Vec<String>) -> Result<String, String> {
  if files.is_empty() {
    let _ = run_git_cmd(&project_path, &["add", "-A"]);
  } else {
    for f in &files {
      let _ = run_git_cmd(&project_path, &["add", "--", f]);
    }
  }
  run_git_cmd(&project_path, &["commit", "-m", &message])
}

#[tauri::command]
fn git_push(project_path: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["push"])
}

#[tauri::command]
fn git_list_branches(project_path: String) -> Result<Vec<String>, String> {
  let out = run_git_cmd(&project_path, &["branch", "--list"])?;
  let mut list = Vec::new();
  for line in out.lines() {
    let clean = line.replace('*', "").trim().to_string();
    if !clean.is_empty() && !list.contains(&clean) {
      list.push(clean);
    }
  }
  if list.is_empty() {
    list.push("main".to_string());
  }
  Ok(list)
}

#[tauri::command]
fn git_checkout_branch(project_path: String, branch: String, create_new: bool) -> Result<String, String> {
  if create_new {
    run_git_cmd(&project_path, &["checkout", "-b", &branch])
  } else {
    run_git_cmd(&project_path, &["checkout", &branch])
  }
}

fn is_ignored_path(path: &std::path::Path) -> bool {
  for comp in path.components() {
    let s = comp.as_os_str().to_string_lossy();
    if s == ".git" || s == "node_modules" || s == "target" || s == "dist" 
      || s == "build" || s == ".idea" || s == ".vscode" || s == "__pycache__" 
      || s == ".DS_Store" {
      return true;
    }
  }
  false
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SearchFileResultDto {
  pub name: String,
  pub path: String,
  pub relative_path: String,
  pub is_folder: bool,
}

#[tauri::command]
fn search_project_files(project_path: String, query: String, limit: Option<usize>) -> Result<Vec<SearchFileResultDto>, String> {
  let root = std::path::Path::new(&project_path);
  if !root.exists() {
    return Err("Project directory does not exist".to_string());
  }

  let max_results = limit.unwrap_or(50);
  let q_lower = query.trim().to_lowercase();
  let mut results = Vec::new();

  for entry in walkdir::WalkDir::new(root)
    .into_iter()
    .filter_entry(|e| !is_ignored_path(e.path()))
    .filter_map(Result::ok)
  {
    if entry.depth() == 0 {
      continue;
    }
    let p = entry.path();
    let name = entry.file_name().to_string_lossy().to_string();
    let rel_path = p.strip_prefix(root)
      .map(|r| r.to_string_lossy().replace('\\', "/"))
      .unwrap_or_else(|_| name.clone());

    if q_lower.is_empty() || name.to_lowercase().contains(&q_lower) || rel_path.to_lowercase().contains(&q_lower) {
      results.push(SearchFileResultDto {
        name,
        path: p.to_string_lossy().to_string(),
        relative_path: rel_path,
        is_folder: entry.file_type().is_dir(),
      });
      if results.len() >= max_results {
        break;
      }
    }
  }

  Ok(results)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SearchTextResultDto {
  pub file_name: String,
  pub file_path: String,
  pub relative_path: String,
  pub line_number: usize,
  pub line_content: String,
  pub match_start: usize,
  pub match_end: usize,
}

#[tauri::command]
fn search_project_text(
  project_path: String,
  query: String,
  case_sensitive: bool,
  limit: Option<usize>,
) -> Result<Vec<SearchTextResultDto>, String> {
  let root = std::path::Path::new(&project_path);
  if !root.exists() {
    return Err("Project directory does not exist".to_string());
  }

  let q = query.trim();
  if q.is_empty() {
    return Ok(Vec::new());
  }

  let max_results = limit.unwrap_or(80);
  let q_cmp = if case_sensitive { q.to_string() } else { q.to_lowercase() };
  let mut results = Vec::new();

  for entry in walkdir::WalkDir::new(root)
    .into_iter()
    .filter_entry(|e| !is_ignored_path(e.path()))
    .filter_map(Result::ok)
  {
    if !entry.file_type().is_file() {
      continue;
    }

    let p = entry.path();
    if let Ok(meta) = p.metadata() {
      if meta.len() > 1_500_000 {
        continue;
      }
    }

    if let Ok(content) = std::fs::read_to_string(p) {
      let file_name = entry.file_name().to_string_lossy().to_string();
      let rel_path = p.strip_prefix(root)
        .map(|r| r.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| file_name.clone());

      for (idx, line) in content.lines().enumerate() {
        let line_cmp = if case_sensitive { line.to_string() } else { line.to_lowercase() };
        if let Some(pos) = line_cmp.find(&q_cmp) {
          results.push(SearchTextResultDto {
            file_name: file_name.clone(),
            file_path: p.to_string_lossy().to_string(),
            relative_path: rel_path.clone(),
            line_number: idx + 1,
            line_content: line.trim_end().to_string(),
            match_start: pos,
            match_end: pos + q.len(),
          });

          if results.len() >= max_results {
            return Ok(results);
          }
        }
      }
    }
  }

  Ok(results)
}

#[tauri::command]
fn watch_project_directory(app: tauri::AppHandle, project_path: String) -> Result<(), String> {
  let mut watcher_guard = FS_WATCHER.lock().map_err(|e| e.to_string())?;
  *watcher_guard = None;

  let path = std::path::PathBuf::from(&project_path);
  if !path.exists() {
    return Err("Path does not exist".to_string());
  }

  let app_clone = app.clone();
  let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
    if let Ok(event) = res {
      let paths: Vec<String> = event.paths.iter()
        .filter(|p| !is_ignored_path(p))
        .map(|p| p.to_string_lossy().to_string())
        .collect();

      if !paths.is_empty() {
        let kind = format!("{:?}", event.kind);
        let _ = app_clone.emit("fs-event", serde_json::json!({
          "kind": kind,
          "paths": paths,
        }));
      }
    }
  }).map_err(|e| format!("Failed to create watcher: {}", e))?;

  watcher.watch(&path, RecursiveMode::Recursive).map_err(|e| format!("Failed to watch: {}", e))?;
  *watcher_guard = Some(watcher);

  Ok(())
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
      get_window_initial_project,
      test_git_executable,
      detect_toolchains,
      fetch_marketplace_plugins,
      fetch_plugin_details,
      start_process,
      stop_process,
      terminal_spawn,
      terminal_write,
      terminal_resize,
      terminal_kill,
      git_get_status,
      git_get_diff,
      git_commit,
      git_push,
      git_list_branches,
      git_checkout_branch,
      search_project_files,
      search_project_text,
      watch_project_directory,
      app_minimize_window,
      app_toggle_maximize_window,
      app_close_window,
      app_is_maximized,
      app_start_dragging
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


