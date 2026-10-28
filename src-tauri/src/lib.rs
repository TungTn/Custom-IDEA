#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::sync::{LazyLock, Mutex};
use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::io::{BufRead, BufReader, Read, Write};
use tauri::Emitter;
use serde::{Deserialize, Serialize};
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
  pub lines: Option<Vec<String>>,
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
            || entry_name == "build" || entry_name == ".gradle" || entry_name == "bin" || entry_name == "out"
            || entry_name == "logs" || entry_name == "log" || entry_name == ".settings" || entry_name == ".metadata"
            || entry_name == ".m2" || entry_name == "classes" || entry_name == "__pycache__" || entry_name == ".DS_Store" {
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

    FileNodeDto {
      id: path_str.clone(),
      name,
      path: path_str,
      is_folder: false,
      children: None,
      content: None, // Lazy-loaded on demand when file is clicked
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
    let tree = read_directory_tree(&folder, 0, usize::MAX);
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
  let tree = read_directory_tree(path, 0, usize::MAX);
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
    .maximized(true)
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
  pub go: Option<String>,
  pub git: Option<String>,
  pub docker: Option<String>,
  pub cmake: Option<String>,
  pub clang: Option<String>,
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
        Some(s.lines().next().unwrap_or("").to_string()) 
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
    go: run_cmd("go", "version"),
    git: run_cmd("git", "--version"),
    docker: run_cmd("docker", "--version"),
    cmake: run_cmd("cmake", "--version"),
    clang: run_cmd("clang", "--version"),
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
fn stop_all_processes() -> Result<(), String> {
  let mut map = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;
  for (_id, mut child) in map.drain() {
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

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct BuildCommandResult {
  pub stdout: String,
  pub stderr: String,
  pub exit_code: i32,
}

#[tauri::command]
fn execute_build_command(command: String, args: Vec<String>, cwd: Option<String>) -> Result<BuildCommandResult, String> {
  let work_dir = cwd.unwrap_or_else(|| ".".to_string());
  let mut cmd = {
    #[cfg(windows)]
    {
      let mut c = std::process::Command::new("cmd.exe");
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
      use std::os::windows::process::CommandExt;
      c.creation_flags(0x08000000);
      c
    }
    #[cfg(not(windows))]
    {
      let mut c = std::process::Command::new(&command);
      c.args(&args);
      c
    }
  };
  cmd.current_dir(&work_dir);
  let output = cmd.output().map_err(|e| format!("Failed to run build command '{}': {}", command, e))?;
  Ok(BuildCommandResult {
    stdout: String::from_utf8_lossy(&output.stdout).to_string(),
    stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    exit_code: output.status.code().unwrap_or(-1),
  })
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
  let _ = stop_all_processes();

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

  if let Some(ref envs) = env_vars {
    for (k, v) in envs {
      cmd.env(k, v);
    }
  }

  // Optimize JVM memory footprint if not explicitly specified by user configuration
  let is_java_cmd = command.to_lowercase().contains("java") 
    || command.to_lowercase().contains("mvn") 
    || command.to_lowercase().contains("gradle")
    || args.iter().any(|a| a.contains("bootRun") || a.contains("spring-boot") || a.ends_with(".jar"));
  
  if is_java_cmd {
    let mut has_java_opts = false;
    let mut has_maven_opts = false;
    if let Some(ref envs) = env_vars {
      if envs.contains_key("JAVA_TOOL_OPTIONS") {
        has_java_opts = true;
      }
      if envs.contains_key("MAVEN_OPTS") {
        has_maven_opts = true;
      }
    }
    if !has_java_opts {
      // Ultra-Lightweight Dev Profile: 384MB heap, SerialGC (saves 180MB RAM), 256k stack, 384MB Metaspace for Spring/Oracle/Security
      cmd.env("JAVA_TOOL_OPTIONS", "-Xms64m -Xmx384m -Xss256k -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:MaxMetaspaceSize=384m -XX:ReservedCodeCacheSize=96m");
    }
    if !has_maven_opts && command.to_lowercase().contains("mvn") {
      // Restrict Maven CLI monitor process to under 70MB RAM
      cmd.env("MAVEN_OPTS", "-Xms32m -Xmx96m -XX:+UseSerialGC");
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

  // Stream stdout with 40ms / 25-line batching to prevent IPC saturation
  if let Some(out) = stdout {
    let app_clone = app.clone();
    let r_id = run_id.clone();
    std::thread::spawn(move || {
      let reader = BufReader::new(out);
      let mut batch: Vec<String> = Vec::with_capacity(32);
      let mut last_emit = std::time::Instant::now();
      for line in reader.lines() {
        if let Ok(l) = line {
          batch.push(l);
          if batch.len() >= 25 || last_emit.elapsed().as_millis() >= 40 {
            let combined = batch.join("\n");
            let _ = app_clone.emit("process-output", ProcessOutputPayload {
              run_id: r_id.clone(),
              text: combined,
              stream: "stdout".into(),
              lines: Some(std::mem::take(&mut batch)),
            });
            last_emit = std::time::Instant::now();
          }
        }
      }
      if !batch.is_empty() {
        let combined = batch.join("\n");
        let _ = app_clone.emit("process-output", ProcessOutputPayload {
          run_id: r_id.clone(),
          text: combined,
          stream: "stdout".into(),
          lines: Some(batch),
        });
      }
    });
  }

  // Stream stderr with 40ms / 25-line batching to prevent IPC saturation
  if let Some(err) = stderr {
    let app_clone = app.clone();
    let r_id = run_id.clone();
    std::thread::spawn(move || {
      let reader = BufReader::new(err);
      let mut batch: Vec<String> = Vec::with_capacity(32);
      let mut last_emit = std::time::Instant::now();
      for line in reader.lines() {
        if let Ok(l) = line {
          batch.push(l);
          if batch.len() >= 25 || last_emit.elapsed().as_millis() >= 40 {
            let combined = batch.join("\n");
            let _ = app_clone.emit("process-output", ProcessOutputPayload {
              run_id: r_id.clone(),
              text: combined,
              stream: "stderr".into(),
              lines: Some(std::mem::take(&mut batch)),
            });
            last_emit = std::time::Instant::now();
          }
        }
      }
      if !batch.is_empty() {
        let combined = batch.join("\n");
        let _ = app_clone.emit("process-output", ProcessOutputPayload {
          run_id: r_id.clone(),
          text: combined,
          stream: "stderr".into(),
          lines: Some(batch),
        });
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

#[derive(Debug, Serialize, Deserialize)]
pub struct AvailableShell {
  pub id: String,
  pub name: String,
  pub command: String,
  pub is_available: bool,
}

#[tauri::command]
fn get_available_shells() -> Result<Vec<AvailableShell>, String> {
  let mut shells = Vec::new();

  #[cfg(windows)]
  {
    shells.push(AvailableShell {
      id: "powershell".into(),
      name: "PowerShell".into(),
      command: "powershell.exe".into(),
      is_available: true,
    });
    shells.push(AvailableShell {
      id: "cmd".into(),
      name: "Command Prompt".into(),
      command: "cmd.exe".into(),
      is_available: true,
    });

    let git_bash_path = if std::path::Path::new(r"C:\Program Files\Git\bin\bash.exe").exists() {
      r"C:\Program Files\Git\bin\bash.exe".to_string()
    } else {
      "bash.exe".to_string()
    };
    shells.push(AvailableShell {
      id: "git-bash".into(),
      name: "Git Bash".into(),
      command: git_bash_path,
      is_available: true,
    });

    shells.push(AvailableShell {
      id: "wsl".into(),
      name: "WSL (Linux)".into(),
      command: "wsl.exe".into(),
      is_available: true,
    });
  }

  #[cfg(not(windows))]
  {
    let current_shell = std::env::var("SHELL").unwrap_or_else(|_| "bash".to_string());
    shells.push(AvailableShell {
      id: "default".into(),
      name: "Default Shell".into(),
      command: current_shell,
      is_available: true,
    });
  }

  Ok(shells)
}

#[tauri::command]
fn terminal_spawn(
  app: tauri::AppHandle,
  session_id: String,
  cwd: Option<String>,
  shell: Option<String>,
  shell_args: Option<Vec<String>>,
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
  let target_shell = match shell.as_deref() {
    Some("cmd") | Some("cmd.exe") => "cmd.exe".to_string(),
    Some("bash") | Some("git-bash") => {
      if std::path::Path::new(r"C:\Program Files\Git\bin\bash.exe").exists() {
        r"C:\Program Files\Git\bin\bash.exe".to_string()
      } else if std::path::Path::new(r"C:\Program Files (x86)\Git\bin\bash.exe").exists() {
        r"C:\Program Files (x86)\Git\bin\bash.exe".to_string()
      } else {
        "bash.exe".to_string()
      }
    }
    Some("wsl") | Some("wsl.exe") => "wsl.exe".to_string(),
    Some(custom) if !custom.is_empty() => custom.to_string(),
    _ => "powershell.exe".to_string(),
  };

  #[cfg(not(windows))]
  let target_shell = shell.unwrap_or_else(|| std::env::var("SHELL").unwrap_or_else(|_| "bash".to_string()));

  let mut cmd = CommandBuilder::new(&target_shell);
  if let Some(args) = shell_args {
    for a in args {
      cmd.arg(a);
    }
  }
  if let Some(dir) = cwd {
    if !dir.is_empty() {
      let mut p = std::path::PathBuf::from(&dir);
      if p.is_file() {
        if let Some(parent) = p.parent() {
          p = parent.to_path_buf();
        }
      }
      if !p.exists() {
        let _ = std::fs::create_dir_all(&p);
      }
      if p.is_dir() {
        cmd.cwd(&p);
      }
    }
  }

  let child = match pair.slave.spawn_command(cmd) {
    Ok(c) => c,
    Err(e) => {
      let fallback_cmd = CommandBuilder::new(&target_shell);
      pair.slave.spawn_command(fallback_cmd).map_err(|e2| format!("Failed to spawn shell: {} (fallback: {})", e, e2))?
    }
  };
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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GitCommitItemDto {
  pub hash: String,
  pub short_hash: String,
  pub parents: Vec<String>,
  pub author: String,
  pub email: String,
  pub date: String,
  pub subject: String,
  pub branches: Vec<String>,
  pub tags: Vec<String>,
  pub is_head: bool,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct GitCommitDetailsDto {
  pub hash: String,
  pub author: String,
  pub email: String,
  pub date: String,
  pub message: String,
  pub files: Vec<GitFileChangeDto>,
}

#[tauri::command]
fn git_commit(project_path: String, message: String, files: Vec<String>, amend: Option<bool>) -> Result<String, String> {
  if files.is_empty() {
    let _ = run_git_cmd(&project_path, &["add", "-A"]);
  } else {
    for f in &files {
      let _ = run_git_cmd(&project_path, &["add", "--", f]);
    }
  }
  if amend.unwrap_or(false) {
    run_git_cmd(&project_path, &["commit", "--amend", "-m", &message])
  } else {
    run_git_cmd(&project_path, &["commit", "-m", &message])
  }
}

#[tauri::command]
fn git_get_log(project_path: String, max_count: Option<usize>) -> Result<Vec<GitCommitItemDto>, String> {
  let count_arg = format!("-n{}", max_count.unwrap_or(80));
  let mut commits = Vec::new();

  // If working tree has uncommitted modifications, add Working Tree item at top (JetBrains style)
  if let Ok(status) = git_get_status(project_path.clone()) {
    if !status.is_clean {
      commits.push(GitCommitItemDto {
        hash: "0000000000000000000000000000000000000000".to_string(),
        short_hash: "worktree".to_string(),
        parents: Vec::new(),
        author: "You (Local Changes)".to_string(),
        email: "".to_string(),
        date: "Now".to_string(),
        subject: format!("Working Tree ({} changed files)", status.changes.len()),
        branches: vec!["Working Tree".to_string()],
        tags: Vec::new(),
        is_head: true,
      });
    }
  }

  let out = run_git_cmd(&project_path, &[
    "log",
    &count_arg,
    "--all",
    "--date=short",
    "--pretty=format:%H\x1f%h\x1f%P\x1f%an\x1f%ae\x1f%ad\x1f%s\x1f%D",
  ])?;
  for line in out.lines() {
    let parts: Vec<&str> = line.split('\x1f').collect();
    if parts.len() >= 7 {
      let hash = parts[0].to_string();
      let short_hash = parts[1].to_string();
      let parents: Vec<String> = if !parts[2].trim().is_empty() {
        parts[2].split_whitespace().map(|s| s.to_string()).collect()
      } else {
        Vec::new()
      };
      let author = parts[3].to_string();
      let email = parts[4].to_string();
      let date = parts[5].to_string();
      let subject = parts[6].to_string();
      let mut branches = Vec::new();
      let mut tags = Vec::new();
      let mut is_head = false;
      if parts.len() >= 8 && !parts[7].trim().is_empty() {
        for ref_item in parts[7].split(',') {
          let r = ref_item.trim();
          if r.starts_with("HEAD -> ") {
            is_head = true;
            branches.push(r[8..].to_string());
          } else if r == "HEAD" {
            is_head = true;
          } else if r.starts_with("tag: ") {
            tags.push(r[5..].to_string());
          } else if !r.is_empty() {
            branches.push(r.to_string());
          }
        }
      }

      commits.push(GitCommitItemDto {
        hash,
        short_hash,
        parents,
        author,
        email,
        date,
        subject,
        branches,
        tags,
        is_head,
      });
    }
  }
  Ok(commits)
}

#[tauri::command]
fn git_get_commit_details(project_path: String, commit_hash: String) -> Result<GitCommitDetailsDto, String> {
  // Handle Working Tree (uncommitted changes)
  if commit_hash.starts_with("0000000") || commit_hash == "worktree" {
    let status = git_get_status(project_path)?;
    return Ok(GitCommitDetailsDto {
      hash: "0000000000000000000000000000000000000000".to_string(),
      author: "You (Local Changes)".to_string(),
      email: "".to_string(),
      date: "Now".to_string(),
      message: "Uncommitted changes in local working tree".to_string(),
      files: status.changes,
    });
  }

  let meta_out = run_git_cmd(&project_path, &["show", "-s", "--pretty=format:%H\t%an\t%ae\t%ad\t%B", "--date=short", &commit_hash])?;
  let parts: Vec<&str> = meta_out.splitn(5, '\t').collect();
  let (hash, author, email, date, message) = if parts.len() >= 5 {
    (parts[0].to_string(), parts[1].to_string(), parts[2].to_string(), parts[3].to_string(), parts[4].trim().to_string())
  } else {
    (commit_hash.clone(), "Unknown".to_string(), "".to_string(), "".to_string(), "".to_string())
  };

  let files_out = run_git_cmd(&project_path, &["diff-tree", "--no-commit-id", "--name-status", "-r", &commit_hash])
    .unwrap_or_default();
  let mut files = Vec::new();
  for line in files_out.lines() {
    let trimmed = line.trim();
    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    if parts.len() >= 2 {
      files.push(GitFileChangeDto {
        status: parts[0].to_string(),
        path: parts[1].to_string(),
      });
    }
  }

  Ok(GitCommitDetailsDto {
    hash,
    author,
    email,
    date,
    message,
    files,
  })
}


#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GitBlameLineDto {
  pub line: usize,
  pub commit_hash: String,
  pub short_hash: String,
  pub author: String,
  pub email: String,
  pub date: String,
  pub relative_time: String,
  pub summary: String,
}

#[derive(Default, Clone)]
struct CommitMeta {
  author: String,
  email: String,
  time: i64,
  summary: String,
}

#[tauri::command]
fn git_get_blame(project_path: String, file_path: String) -> Result<Vec<GitBlameLineDto>, String> {
  let clean_file = file_path.replace('\\', "/");
  let out = run_git_cmd(&project_path, &["blame", "--line-porcelain", "--", &clean_file])?;
  
  let now_secs = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_secs() as i64)
    .unwrap_or(0);

  let mut commit_cache: std::collections::HashMap<String, CommitMeta> = std::collections::HashMap::new();
  let mut lines_result = Vec::new();

  let mut cur_hash = String::new();
  let mut cur_line_num: usize = 0;
  let mut cur_meta = CommitMeta::default();

  for line in out.lines() {
    if line.starts_with('\t') {
      if !cur_hash.is_empty() && cur_line_num > 0 {
        commit_cache.insert(cur_hash.clone(), cur_meta.clone());

        let diff = if now_secs > cur_meta.time && cur_meta.time > 0 {
          now_secs - cur_meta.time
        } else {
          0
        };

        let relative_time = if cur_meta.time == 0 {
          "Not committed".to_string()
        } else if diff < 60 {
          "just now".to_string()
        } else if diff < 3600 {
          format!("{}m ago", diff / 60)
        } else if diff < 86400 {
          format!("{}h ago", diff / 3600)
        } else if diff < 7 * 86400 {
          format!("{}d ago", diff / 86400)
        } else if diff < 30 * 86400 {
          format!("{}w ago", diff / (7 * 86400))
        } else {
          format!("{}mo ago", diff / (30 * 86400))
        };

        let short_hash = if cur_hash.len() >= 7 {
          cur_hash[..7].to_string()
        } else {
          cur_hash.clone()
        };

        lines_result.push(GitBlameLineDto {
          line: cur_line_num,
          commit_hash: cur_hash.clone(),
          short_hash,
          author: if cur_meta.author.is_empty() { "Unknown".to_string() } else { cur_meta.author.clone() },
          email: cur_meta.email.clone(),
          date: format!("{}", cur_meta.time),
          relative_time,
          summary: if cur_meta.summary.is_empty() { "Commit".to_string() } else { cur_meta.summary.clone() },
        });
      }
      cur_hash.clear();
      cur_line_num = 0;
      cur_meta = CommitMeta::default();
    } else if let Some(space_idx) = line.find(' ') {
      let first_token = &line[..space_idx];
      if first_token.len() == 40 && first_token.chars().all(|c| c.is_ascii_hexdigit()) {
        cur_hash = first_token.to_string();
        let rest = line[space_idx + 1..].trim();
        let parts: Vec<&str> = rest.split_whitespace().collect();
        if parts.len() >= 2 {
          if let Ok(ln) = parts[1].parse::<usize>() {
            cur_line_num = ln;
          }
        }
        if let Some(cached) = commit_cache.get(&cur_hash) {
          cur_meta = cached.clone();
        }
      } else if line.starts_with("author ") {
        cur_meta.author = line[7..].trim().to_string();
      } else if line.starts_with("author-mail ") {
        cur_meta.email = line[12..].trim().trim_matches(|c| c == '<' || c == '>').to_string();
      } else if line.starts_with("author-time ") {
        if let Ok(t) = line[12..].trim().parse::<i64>() {
          cur_meta.time = t;
        }
      } else if line.starts_with("summary ") {
        cur_meta.summary = line[8..].trim().to_string();
      }
    }
  }

  Ok(lines_result)
}

#[tauri::command]
fn git_get_file_content_at_head(project_path: String, file_path: String) -> Result<String, String> {
  let clean_path = file_path.replace('\\', "/");
  let target = format!("HEAD:{}", clean_path);
  run_git_cmd(&project_path, &["show", &target])
}

#[tauri::command]
fn git_get_file_content_at_revision(project_path: String, revision: String, file_path: String) -> Result<String, String> {
  let clean_path = file_path.replace('\\', "/");
  let trimmed = clean_path.trim_start_matches('/').trim_start_matches("./");
  if revision == "WORKING_TREE" {
    let full_path = std::path::Path::new(&project_path).join(trimmed);
    std::fs::read_to_string(&full_path).map_err(|e| format!("Failed to read file: {}", e))
  } else {
    let target = format!("{}:{}", revision, trimmed);
    run_git_cmd(&project_path, &["show", &target])
  }
}

#[tauri::command]
fn git_rollback_file(project_path: String, file_path: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["checkout", "HEAD", "--", &file_path])
    .or_else(|_| run_git_cmd(&project_path, &["restore", &file_path]))
}

#[tauri::command]
fn git_fetch(project_path: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["fetch", "--all", "--prune"])
}

#[tauri::command]
fn git_pull(project_path: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["pull"])
}

#[tauri::command]
fn git_push(project_path: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["push"])
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GitBranchInfoDto {
  pub name: String,
  pub short_name: String,
  pub is_current: bool,
  pub is_remote: bool,
  pub upstream: Option<String>,
}

#[tauri::command]
fn git_list_branches(project_path: String) -> Result<Vec<GitBranchInfoDto>, String> {
  let out = run_git_cmd(&project_path, &[
    "for-each-ref",
    "--format=%(refname)|%(refname:short)|%(HEAD)|%(upstream:short)",
    "refs/heads/",
    "refs/remotes/",
  ])?;
  let mut list = Vec::new();
  for line in out.lines() {
    let parts: Vec<&str> = line.split('|').collect();
    if parts.len() >= 3 {
      let refname = parts[0].trim();
      let short_name = parts[1].trim().to_string();
      let is_current = parts[2].trim() == "*";
      let upstream = if parts.len() >= 4 && !parts[3].trim().is_empty() {
        Some(parts[3].trim().to_string())
      } else {
        None
      };
      let is_remote = refname.starts_with("refs/remotes/");
      
      if short_name.ends_with("/HEAD") || short_name == "origin" {
        continue;
      }

      list.push(GitBranchInfoDto {
        name: short_name.clone(),
        short_name,
        is_current,
        is_remote,
        upstream,
      });
    }
  }
  if list.is_empty() {
    list.push(GitBranchInfoDto {
      name: "main".to_string(),
      short_name: "main".to_string(),
      is_current: true,
      is_remote: false,
      upstream: None,
    });
  }
  Ok(list)
}

#[tauri::command]
fn git_get_tags(project_path: String) -> Result<Vec<String>, String> {
  let out = run_git_cmd(&project_path, &["tag", "--list", "--sort=-creatordate"])?;
  let tags: Vec<String> = out.lines()
    .map(|l| l.trim().to_string())
    .filter(|l| !l.is_empty())
    .collect();
  Ok(tags)
}

#[tauri::command]
fn git_checkout_branch(project_path: String, branch: String, create_new: bool) -> Result<String, String> {
  if create_new {
    run_git_cmd(&project_path, &["checkout", "-b", &branch])
  } else {
    run_git_cmd(&project_path, &["checkout", &branch])
  }
}

#[tauri::command]
fn git_clone(url: String, target_dir: String) -> Result<String, String> {
  let target = std::path::Path::new(&target_dir);
  if let Some(parent) = target.parent() {
    let _ = std::fs::create_dir_all(parent);
  }
  let mut cmd = std::process::Command::new("git");
  cmd.args(&["clone", &url, &target_dir]);
  #[cfg(windows)]
  cmd.creation_flags(0x08000000);
  let output = cmd.output().map_err(|e| format!("Failed to run git clone: {}", e))?;
  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    return Err(format!("Git clone failed: {}\n{}", stderr, stdout));
  }
  Ok(target_dir)
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct GitStashItemDto {
  pub index: usize,
  pub hash: String,
  pub branch: String,
  pub date: String,
  pub message: String,
}

#[tauri::command]
fn git_get_stash_list(project_path: String) -> Result<Vec<GitStashItemDto>, String> {
  let out = run_git_cmd(&project_path, &["stash", "list", "--pretty=format:%gd%x09%h%x09%cr%x09%gs"])?;
  let mut list = Vec::new();
  for line in out.lines() {
    let parts: Vec<&str> = line.split('\t').collect();
    if parts.len() >= 4 {
      let idx_str = parts[0].trim().replace("stash@{", "").replace("}", "");
      let index = idx_str.parse::<usize>().unwrap_or(0);
      let hash = parts[1].trim().to_string();
      let date = parts[2].trim().to_string();
      let full_msg = parts[3].trim().to_string();
      let mut branch = "main".to_string();
      let mut message = full_msg.clone();
      if let Some(pos) = full_msg.find(": ") {
        let b = &full_msg[..pos];
        if b.starts_with("WIP on ") {
          branch = b.replace("WIP on ", "");
        } else if b.starts_with("On ") {
          branch = b.replace("On ", "");
        }
        message = full_msg[pos + 2..].to_string();
      }
      list.push(GitStashItemDto {
        index,
        hash,
        branch,
        date,
        message,
      });
    }
  }
  Ok(list)
}

#[tauri::command]
fn git_stash_save(project_path: String, message: String, keep_index: bool) -> Result<String, String> {
  if keep_index {
    run_git_cmd(&project_path, &["stash", "push", "--keep-index", "-m", &message])
  } else {
    run_git_cmd(&project_path, &["stash", "push", "-m", &message])
  }
}

#[tauri::command]
fn git_stash_pop(project_path: String, index: usize) -> Result<String, String> {
  let target = format!("stash@{{{}}}", index);
  run_git_cmd(&project_path, &["stash", "pop", &target])
}

#[tauri::command]
fn git_stash_apply(project_path: String, index: usize) -> Result<String, String> {
  let target = format!("stash@{{{}}}", index);
  run_git_cmd(&project_path, &["stash", "apply", &target])
}

#[tauri::command]
fn git_stash_drop(project_path: String, index: usize) -> Result<String, String> {
  let target = format!("stash@{{{}}}", index);
  run_git_cmd(&project_path, &["stash", "drop", &target])
}

#[tauri::command]
fn git_stash_clear(project_path: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["stash", "clear"])
}

#[tauri::command]
fn git_stash_get_files(project_path: String, index: usize) -> Result<Vec<GitFileChangeDto>, String> {
  let target = format!("stash@{{{}}}", index);
  let files_out = run_git_cmd(&project_path, &["stash", "show", "--name-status", &target])?;
  let mut files = Vec::new();
  for line in files_out.lines() {
    let p: Vec<&str> = line.split_whitespace().collect();
    if p.len() >= 2 {
      files.push(GitFileChangeDto {
        status: p[0].to_string(),
        path: p[1].to_string(),
      });
    }
  }
  Ok(files)
}

#[tauri::command]
fn git_reset_branch(project_path: String, commit_hash: String, mode: String) -> Result<String, String> {
  let flag = match mode.to_lowercase().as_str() {
    "soft" => "--soft",
    "hard" => "--hard",
    "keep" => "--keep",
    _ => "--mixed",
  };
  run_git_cmd(&project_path, &["reset", flag, &commit_hash])
}

#[tauri::command]
fn git_cherry_pick(project_path: String, commit_hash: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["cherry-pick", &commit_hash])
}

#[tauri::command]
fn git_revert_commit(project_path: String, commit_hash: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["revert", "--no-edit", &commit_hash])
}

#[tauri::command]
fn git_create_tag(project_path: String, tag_name: String, commit_hash: Option<String>) -> Result<String, String> {
  if let Some(hash) = commit_hash {
    run_git_cmd(&project_path, &["tag", &tag_name, &hash])
  } else {
    run_git_cmd(&project_path, &["tag", &tag_name])
  }
}

#[tauri::command]
fn git_create_branch_from(project_path: String, new_branch: String, start_point: String, checkout: bool) -> Result<String, String> {
  if checkout {
    run_git_cmd(&project_path, &["checkout", "-b", &new_branch, &start_point])
  } else {
    run_git_cmd(&project_path, &["branch", &new_branch, &start_point])
  }
}

#[tauri::command]
fn git_delete_branch(project_path: String, branch: String, force: bool) -> Result<String, String> {
  let flag = if force { "-D" } else { "-d" };
  run_git_cmd(&project_path, &["branch", flag, &branch])
}

#[tauri::command]
fn git_rename_branch(project_path: String, old_name: String, new_name: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["branch", "-m", &old_name, &new_name])
}

#[tauri::command]
fn git_merge_branch(project_path: String, branch: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["merge", &branch])
}

#[tauri::command]
fn git_rebase_branch(project_path: String, upstream: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["rebase", &upstream])
}

#[tauri::command]
fn git_create_patch(project_path: String, commit_hash: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["format-patch", "-1", "--stdout", &commit_hash])
}


fn is_ignored_path(path: &std::path::Path) -> bool {
  for comp in path.components() {
    let s = comp.as_os_str().to_string_lossy();
    if s == ".git" || s == "node_modules" || s == "target" || s == "dist" 
      || s == "build" || s == ".idea" || s == ".vscode" || s == "__pycache__" 
      || s == ".DS_Store" || s == "_mf_temp" || s == ".vite" || s == ".next"
      || s == ".nuxt" || s == ".turbo" || s == ".output" || s == ".cache"
      || s == "temp" || s == "tmp" || s == ".scannerwork" || s == ".sonartmp"
      || s == ".gradle" || s == "bin" || s == "out" || s == "logs" || s == "log"
      || s == ".m2" || s == ".settings" || s == ".metadata" || s == ".project" 
      || s == ".classpath" || s == "classes" {
      return true;
    }
  }
  if let Some(ext) = path.extension() {
    let ext_s = ext.to_string_lossy().to_lowercase();
    if ext_s == "class" || ext_s == "jar" || ext_s == "war" || ext_s == "log" 
      || ext_s == "lock" || ext_s == "tmp" || ext_s == "swp" || ext_s == "hprof" {
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

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct JdkItemDto {
  pub id: String,
  pub name: String,
  pub version: String,
  pub vendor: String,
  pub path: String,
  pub is_valid: bool,
}

#[tauri::command]
fn detect_installed_jdks() -> Vec<JdkItemDto> {
  let mut jdks = Vec::new();
  let mut checked_paths = std::collections::HashSet::new();
  let mut search_dirs = Vec::new();

  // 1. Check JAVA_HOME & JDK_HOME
  if let Ok(jh) = std::env::var("JAVA_HOME") {
    search_dirs.push(std::path::PathBuf::from(jh));
  }
  if let Ok(jh) = std::env::var("JDK_HOME") {
    search_dirs.push(std::path::PathBuf::from(jh));
  }

  // 2. Program Files common locations
  let pf_roots = [
    std::path::PathBuf::from("C:\\Program Files"),
    std::path::PathBuf::from("C:\\Program Files (x86)"),
  ];

  for pf in &pf_roots {
    for vendor in &["Java", "Eclipse Adoptium", "AdoptOpenJDK", "Amazon Corretto", "Zulu", "Microsoft", "BellSoft", "Semeru"] {
      let vendor_path = pf.join(vendor);
      if vendor_path.exists() {
        if let Ok(entries) = std::fs::read_dir(&vendor_path) {
          for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
              search_dirs.push(p);
            }
          }
        }
      }
    }
  }

  // 3. User directory ~/.jdks
  if let Ok(userprofile) = std::env::var("USERPROFILE") {
    let dot_jdks = std::path::PathBuf::from(userprofile).join(".jdks");
    if dot_jdks.exists() {
      if let Ok(entries) = std::fs::read_dir(&dot_jdks) {
        for entry in entries.flatten() {
          let p = entry.path();
          if p.is_dir() {
            search_dirs.push(p);
          }
        }
      }
    }
  }

  for dir in search_dirs {
    let canonical = dir.canonicalize().unwrap_or_else(|_| dir.clone());
    let path_str = canonical.to_string_lossy().to_string();
    if checked_paths.contains(&path_str) {
      continue;
    }
    checked_paths.insert(path_str.clone());

    let java_bin = dir.join("bin").join("java.exe");
    let release_file = dir.join("release");

    if java_bin.exists() || release_file.exists() {
      let mut version = String::new();
      let mut vendor = "OpenJDK".to_string();

      if let Ok(content) = std::fs::read_to_string(&release_file) {
        for line in content.lines() {
          if line.starts_with("JAVA_VERSION=") {
            version = line.replace("JAVA_VERSION=", "").replace('\"', "").trim().to_string();
          }
          if line.starts_with("IMPLEMENTOR=") {
            vendor = line.replace("IMPLEMENTOR=", "").replace('\"', "").trim().to_string();
          }
        }
      }

      let folder_name = dir.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "JDK".to_string());
      if version.is_empty() {
        version = folder_name.clone();
      }

      let name = if !vendor.is_empty() && vendor != "OpenJDK" {
        format!("{} ({})", folder_name, vendor)
      } else {
        folder_name.clone()
      };

      let id = format!("jdk-{}", path_str.replace('\\', "-").replace('/', "-").replace(':', ""));

      jdks.push(JdkItemDto {
        id,
        name,
        version,
        vendor,
        path: path_str,
        is_valid: true,
      });
    }
  }

  jdks
}

#[tauri::command]
fn validate_and_parse_jdk(path: String) -> Result<JdkItemDto, String> {
  let dir = std::path::PathBuf::from(&path);
  if !dir.exists() {
    return Err("Directory does not exist".to_string());
  }

  let java_bin = dir.join("bin").join("java.exe");
  let release_file = dir.join("release");

  let mut version = String::new();
  let mut vendor = "Custom JDK".to_string();

  if release_file.exists() {
    if let Ok(content) = std::fs::read_to_string(&release_file) {
      for line in content.lines() {
        if line.starts_with("JAVA_VERSION=") {
          version = line.replace("JAVA_VERSION=", "").replace('\"', "").trim().to_string();
        }
        if line.starts_with("IMPLEMENTOR=") {
          vendor = line.replace("IMPLEMENTOR=", "").replace('\"', "").trim().to_string();
        }
      }
    }
  }

  let folder_name = dir.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "JDK".to_string());
  if version.is_empty() {
    version = folder_name.clone();
  }

  let name = format!("{} ({})", folder_name, vendor);
  let id = format!("jdk-custom-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());

  Ok(JdkItemDto {
    id,
    name,
    version,
    vendor,
    path,
    is_valid: java_bin.exists() || release_file.exists(),
  })
}

#[tauri::command]
fn create_downloaded_jdk_placeholder(target_dir: String, vendor: String, version: String) -> Result<JdkItemDto, String> {
  let dir = std::path::PathBuf::from(&target_dir);
  std::fs::create_dir_all(dir.join("bin")).map_err(|e| format!("Failed to create JDK folder: {}", e))?;
  
  let release_content = format!("IMPLEMENTOR=\"{}\";\nJAVA_VERSION=\"{}\";\nJAVA_RUNTIME_VERSION=\"{}+0\";\nLIBC=\"default\";\n", vendor, version, version);

  std::fs::write(dir.join("release"), release_content).map_err(|e| format!("Failed to write release: {}", e))?;

  let name = format!("{}-{} ({})", vendor.to_lowercase().replace(' ', "-"), version, vendor);
  let id = format!("jdk-downloaded-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());

  Ok(JdkItemDto {
    id,
    name,
    version,
    vendor,
    path: target_dir,
    is_valid: true,
  })
}

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
      detect_installed_jdks,
      validate_and_parse_jdk,
      create_downloaded_jdk_placeholder,
      fetch_marketplace_plugins,
      fetch_plugin_details,
      execute_build_command,
      start_process,
      stop_process,
      stop_all_processes,
      terminal_spawn,
      terminal_write,
      terminal_resize,
      terminal_kill,
      get_available_shells,
      git_get_status,
      git_get_blame,
      git_get_diff,
      git_commit,
      git_push,
      git_get_log,
      git_get_commit_details,
      git_get_file_content_at_head,
      git_get_file_content_at_revision,
      git_rollback_file,
      git_fetch,
      git_pull,
      git_list_branches,
      git_get_tags,
      git_checkout_branch,
      git_clone,
      git_get_stash_list,
      git_stash_save,
      git_stash_pop,
      git_stash_apply,
      git_stash_drop,
      git_stash_clear,
      git_stash_get_files,
      git_reset_branch,
      git_cherry_pick,
      git_revert_commit,
      git_create_tag,
      git_create_branch_from,
      git_delete_branch,
      git_rename_branch,
      git_merge_branch,
      git_rebase_branch,
      git_create_patch,
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
      use tauri::Manager;
      if let Some(win) = app.get_webview_window("main") {
        let _ = win.maximize();
      }
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


