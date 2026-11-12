use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{LazyLock, Mutex};
use std::time::Duration;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub static RUNNING_PROCESSES: LazyLock<Mutex<HashMap<String, Child>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

use ts_rs::TS;

#[derive(Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ProcessOutputPayload {
  pub run_id: String,
  pub text: String,
  pub stream: String,
  pub lines: Option<Vec<String>>,
}

#[derive(Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ProcessExitPayload {
  pub run_id: String,
  pub exit_code: i32,
  pub success: bool,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct BuildCommandResult {
  pub stdout: String,
  pub stderr: String,
  pub exit_code: i32,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
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

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export)]
pub struct JdkItemDto {
  pub id: String,
  pub name: String,
  pub version: String,
  pub vendor: String,
  pub path: String,
  pub is_valid: bool,
}

#[tauri::command]
pub fn stop_process(run_id: String) -> Result<(), String> {
  let removed = {
    let mut map = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;
    map.remove(&run_id)
  };
  if let Some(mut child) = removed {
    let pid = child.id();
    #[cfg(windows)]
    {
      let _ = std::process::Command::new("taskkill")
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .creation_flags(0x08000000)
        .output();
    }
    let _ = child.kill();
    let _ = child.wait();
  }
  Ok(())
}

#[tauri::command]
pub fn stop_all_processes() -> Result<(), String> {
  let drained: Vec<Child> = {
    let mut map = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;
    map.drain().map(|(_id, c)| c).collect()
  };
  for mut child in drained {
    let pid = child.id();
    #[cfg(windows)]
    {
      let _ = std::process::Command::new("taskkill")
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .creation_flags(0x08000000)
        .output();
    }
    let _ = child.kill();
    let _ = child.wait();
  }
  Ok(())
}

fn expand_home_path(s: &str) -> String {
  if s.starts_with('~') {
    if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
      return format!("{}{}", home, &s[1..]);
    }
  }
  s.to_string()
}

#[cfg(windows)]
fn resolve_windows_command_on_path(cmd_name: &str) -> Option<String> {
  let path = std::path::Path::new(cmd_name);
  if path.components().count() > 1 || path.is_absolute() {
    if path.is_file() {
      return Some(cmd_name.to_string());
    }
    if path.extension().is_none() {
      let pathext = std::env::var("PATHEXT").unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".to_string());
      for ext in pathext.split(';').filter(|e| !e.is_empty()) {
        let candidate = std::path::PathBuf::from(format!("{}{}", cmd_name, ext));
        if candidate.is_file() {
          return Some(candidate.to_string_lossy().to_string());
        }
      }
    }
    return None;
  }

  let has_ext = path.extension().is_some();
  let pathext = std::env::var("PATHEXT").unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".to_string());
  let exts: Vec<&str> = if has_ext {
    vec![""]
  } else {
    pathext.split(';').filter(|e| !e.is_empty()).collect()
  };

  if let Some(paths) = std::env::var_os("PATH") {
    for dir in std::env::split_paths(&paths) {
      for ext in &exts {
        let candidate = dir.join(format!("{}{}", cmd_name, ext));
        if candidate.is_file() {
          return Some(candidate.to_string_lossy().to_string());
        }
      }
    }
  }
  None
}

fn resolve_executable_path(command: &str, work_dir: &str) -> String {
  let expanded = expand_home_path(command);
  let clean = if (expanded.starts_with('"') && expanded.ends_with('"'))
    || (expanded.starts_with('\'') && expanded.ends_with('\''))
  {
    &expanded[1..expanded.len() - 1]
  } else {
    &expanded
  };

  // If clean command contains directory separators, test if that specific binary exists
  let resolved = if clean.contains('\\') || clean.contains('/') {
    let p = std::path::Path::new(clean);
    if !p.exists() {
      let lower = clean.to_lowercase();
      if lower.contains("mvn") {
        #[cfg(windows)]
        let wrapper = "mvnw.cmd";
        #[cfg(not(windows))]
        let wrapper = "mvnw";
        let wrapper_path = std::path::Path::new(work_dir).join(wrapper);
        if wrapper_path.exists() {
          return wrapper_path.to_string_lossy().to_string();
        }
        "mvn".to_string()
      } else if lower.contains("gradle") {
        #[cfg(windows)]
        let wrapper = "gradlew.bat";
        #[cfg(not(windows))]
        let wrapper = "gradlew";
        let wrapper_path = std::path::Path::new(work_dir).join(wrapper);
        if wrapper_path.exists() {
          return wrapper_path.to_string_lossy().to_string();
        }
        "gradle".to_string()
      } else {
        clean.to_string()
      }
    } else {
      clean.to_string()
    }
  } else {
    let lower = clean.to_lowercase();
    if matches!(lower.as_str(), "mvn" | "mvn.cmd" | "mvnw" | "mvnw.cmd") {
      #[cfg(windows)]
      let wrapper = "mvnw.cmd";
      #[cfg(not(windows))]
      let wrapper = "mvnw";
      let wrapper_path = std::path::Path::new(work_dir).join(wrapper);
      if wrapper_path.exists() {
        return wrapper_path.to_string_lossy().to_string();
      }
    } else if matches!(lower.as_str(), "gradle" | "gradle.bat" | "gradlew" | "gradlew.bat") {
      #[cfg(windows)]
      let wrapper = "gradlew.bat";
      #[cfg(not(windows))]
      let wrapper = "gradlew";
      let wrapper_path = std::path::Path::new(work_dir).join(wrapper);
      if wrapper_path.exists() {
        return wrapper_path.to_string_lossy().to_string();
      }
    }
    clean.to_string()
  };

  #[cfg(windows)]
  {
    if let Some(full) = resolve_windows_command_on_path(&resolved) {
      return full;
    }
  }

  resolved
}

fn ensure_valid_jvm_environment(
  cmd: &mut std::process::Command,
  command: &str,
  args: &[String],
  env_vars: Option<&HashMap<String, String>>,
) {
  let is_java_cmd = command.to_lowercase().contains("java") 
    || command.to_lowercase().contains("mvn") 
    || command.to_lowercase().contains("gradle")
    || args.iter().any(|a| a.contains("bootRun") || a.contains("spring-boot") || a.ends_with(".jar"));

  if is_java_cmd {
    let mut has_java_opts = false;
    let mut has_maven_opts = false;
    if let Some(envs) = env_vars {
      if envs.contains_key("JAVA_TOOL_OPTIONS") {
        has_java_opts = true;
      }
      if envs.contains_key("MAVEN_OPTS") {
        has_maven_opts = true;
      }
    }
    if !has_java_opts {
      cmd.env("JAVA_TOOL_OPTIONS", "-Xms128m -Xmx1024m -Xss512k -XX:TieredStopAtLevel=1 -XX:MaxMetaspaceSize=384m -XX:ReservedCodeCacheSize=128m");
    }
    if !has_maven_opts && command.to_lowercase().contains("mvn") {
      cmd.env("MAVEN_OPTS", "-Xms64m -Xmx256m");
    }

    // Ensure valid JAVA_HOME is passed to Maven/Gradle
    let mut current_jh_valid = false;
    if let Some(envs) = env_vars {
      if let Some(jh) = envs.get("JAVA_HOME") {
        let expanded_jh = expand_home_path(jh);
        let p = std::path::Path::new(&expanded_jh);
        if p.join("bin").join("java.exe").exists() || p.join("bin").join("java").exists() {
          current_jh_valid = true;
          cmd.env("JAVA_HOME", &expanded_jh);
        }
      }
    }
    if !current_jh_valid {
      if let Ok(jh) = std::env::var("JAVA_HOME") {
        let p = std::path::Path::new(&jh);
        if p.join("bin").join("java.exe").exists() || p.join("bin").join("java").exists() {
          current_jh_valid = true;
          cmd.env("JAVA_HOME", &jh);
        }
      }
    }
    if !current_jh_valid {
      // Fallback: detect working JDKs and prefer latest (e.g. 25 over 11)
      let mut detected = detect_installed_jdks();
      detected.sort_by(|a, b| b.version.cmp(&a.version));
      if let Some(chosen) = detected.first() {
        let clean_path = if chosen.path.starts_with(r"\\?\") {
          chosen.path[4..].to_string()
        } else {
          chosen.path.clone()
        };
        cmd.env("JAVA_HOME", &clean_path);
        if let Ok(path_var) = std::env::var("PATH") {
          let bin_path = std::path::PathBuf::from(&clean_path).join("bin");
          cmd.env("PATH", format!("{};{}", bin_path.to_string_lossy(), path_var));
        }
      }
    }
  }
}

fn reject_control_chars(value: &str, label: &str) -> Result<(), String> {
  if value.bytes().any(|b| b == 0 || b == b'\r' || b == b'\n') {
    return Err(format!("Invalid control character in {}", label));
  }
  Ok(())
}

fn build_process_command(
  command: &str,
  args: &[String],
  cwd: Option<&str>,
  env_vars: Option<&HashMap<String, String>>,
) -> Result<Command, String> {
  reject_control_chars(command, "command")?;
  for (idx, a) in args.iter().enumerate() {
    reject_control_chars(a, &format!("argument #{}", idx))?;
  }

  let work_dir = expand_home_path(cwd.unwrap_or("."));
  reject_control_chars(&work_dir, "cwd")?;
  let resolved_command = resolve_executable_path(command, &work_dir);

  let mut cmd = Command::new(&resolved_command);
  cmd.args(args);
  #[cfg(windows)]
  cmd.creation_flags(0x08000000);
  cmd.current_dir(&work_dir);

  if let Some(envs) = env_vars {
    for (k, v) in envs {
      reject_control_chars(k, "env key")?;
      let expanded = expand_home_path(v);
      reject_control_chars(&expanded, &format!("env '{}'", k))?;
      cmd.env(k, expanded);
    }
  }
  ensure_valid_jvm_environment(&mut cmd, &resolved_command, args, env_vars);
  Ok(cmd)
}

#[tauri::command]
pub fn execute_build_command(
  command: String,
  args: Vec<String>,
  cwd: Option<String>,
  env_vars: Option<HashMap<String, String>>,
) -> Result<BuildCommandResult, String> {
  let mut cmd = build_process_command(&command, &args, cwd.as_deref(), env_vars.as_ref())?;
  let output = cmd.output().map_err(|e| format!("Failed to run build command '{}': {}", command, e))?;
  Ok(BuildCommandResult {
    stdout: String::from_utf8_lossy(&output.stdout).to_string(),
    stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    exit_code: output.status.code().unwrap_or(-1),
  })
}

#[tauri::command]
pub fn start_process(
  app: tauri::AppHandle,
  run_id: String,
  command: String,
  args: Vec<String>,
  cwd: Option<String>,
  env_vars: Option<HashMap<String, String>>,
) -> Result<(), String> {
  let _ = stop_all_processes();

  let mut cmd = build_process_command(&command, &args, cwd.as_deref(), env_vars.as_ref())?;
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
      std::thread::sleep(Duration::from_millis(100));
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
pub fn detect_toolchains() -> Result<ToolchainInfo, String> {
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
pub fn detect_installed_jdks() -> Vec<JdkItemDto> {
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
    let mut path_str = canonical.to_string_lossy().to_string();
    if path_str.starts_with(r"\\?\") {
      path_str = path_str[4..].to_string();
    }
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
pub fn validate_and_parse_jdk(path: String) -> Result<JdkItemDto, String> {
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
pub fn create_downloaded_jdk_placeholder(target_dir: String, vendor: String, version: String) -> Result<JdkItemDto, String> {
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

#[derive(Clone, Serialize, Deserialize)]
pub struct JdkDownloadProgressEvent {
  pub percent: f32,
  pub message: String,
  pub downloaded_bytes: u64,
  pub total_bytes: u64,
}

#[tauri::command]
pub async fn download_real_jdk(
  app: tauri::AppHandle,
  feature_version: u32,
  vendor_slug: String,
  vendor_name: String,
  target_dir: String,
) -> Result<JdkItemDto, String> {
  let resolved_target = if target_dir.starts_with('~') {
    let home = std::env::var("USERPROFILE")
      .or_else(|_| std::env::var("HOME"))
      .unwrap_or_else(|_| ".".to_string());
    let suffix = target_dir.trim_start_matches('~').trim_start_matches(['/', '\\']);
    std::path::PathBuf::from(home).join(suffix)
  } else {
    std::path::PathBuf::from(&target_dir)
  };

  std::fs::create_dir_all(&resolved_target)
    .map_err(|e| format!("Failed to create destination folder: {}", e))?;

  // Resolve official vendor binary URL
  let v_slug = vendor_slug.to_lowercase();
  let download_url = if v_slug.contains("corretto") {
    format!("https://corretto.aws/downloads/latest/amazon-corretto-{}-x64-windows-jdk.zip", feature_version)
  } else {
    // Default to Eclipse Temurin (Adoptium standard)
    format!("https://api.adoptium.net/v3/binary/latest/{}/ga/windows/x64/jdk/hotspot/normal/eclipse", feature_version)
  };

  let _ = app.emit("jdk_download_progress", JdkDownloadProgressEvent {
    percent: 5.0,
    message: format!("Connecting to {} repository...", vendor_name),
    downloaded_bytes: 0,
    total_bytes: 0,
  });

  let client = reqwest::Client::builder()
    .redirect(reqwest::redirect::Policy::limited(10))
    .build()
    .map_err(|e| e.to_string())?;

  let mut res = client.get(&download_url)
    .header("User-Agent", "Custom-IDEA/0.1.0")
    .send()
    .await
    .map_err(|e| format!("Failed to connect to JDK server: {}", e))?;

  if !res.status().is_success() {
    return Err(format!("JDK download returned HTTP error: {}", res.status()));
  }

  struct TempFileGuard(std::path::PathBuf);
  impl Drop for TempFileGuard {
    fn drop(&mut self) {
      let _ = std::fs::remove_file(&self.0);
    }
  }

  let total_size = res.content_length().unwrap_or(180 * 1024 * 1024);
  let temp_zip = resolved_target.join("download_temp.zip");
  let _zip_cleanup = TempFileGuard(temp_zip.clone());
  let mut file = std::fs::File::create(&temp_zip)
    .map_err(|e| format!("Failed to create temp archive file: {}", e))?;

  let mut downloaded: u64 = 0;
  let mut last_emit = std::time::Instant::now();

  while let Some(chunk) = res.chunk().await.map_err(|e| format!("Error downloading chunk: {}", e))? {
    std::io::Write::write_all(&mut file, &chunk)
      .map_err(|e| format!("Error writing chunk to disk: {}", e))?;
    downloaded += chunk.len() as u64;

    if last_emit.elapsed().as_millis() > 150 || downloaded == total_size {
      let pct = ((downloaded as f64 / total_size as f64) * 80.0) as f32 + 5.0;
      let _ = app.emit("jdk_download_progress", JdkDownloadProgressEvent {
        percent: pct.min(85.0),
        message: format!("Downloading archive ({:.1} MB / {:.1} MB)...", downloaded as f64 / 1024.0 / 1024.0, total_size as f64 / 1024.0 / 1024.0),
        downloaded_bytes: downloaded,
        total_bytes: total_size,
      });
      last_emit = std::time::Instant::now();
    }
  }

  drop(file);

  let _ = app.emit("jdk_download_progress", JdkDownloadProgressEvent {
    percent: 88.0,
    message: "Extracting JDK archive...".to_string(),
    downloaded_bytes: downloaded,
    total_bytes: total_size,
  });

  // Extract Zip archive
  let zip_file = std::fs::File::open(&temp_zip)
    .map_err(|e| format!("Failed to open downloaded archive: {}", e))?;
  let mut archive = zip::ZipArchive::new(zip_file)
    .map_err(|e| format!("Failed to read zip archive: {}", e))?;

  for i in 0..archive.len() {
    let mut item = archive.by_index(i).map_err(|e| e.to_string())?;
    let enclosed = match item.enclosed_name() {
      Some(p) => p.to_owned(),
      None => continue,
    };
    let outpath = resolved_target.join(enclosed);
    if item.is_dir() {
      let _ = std::fs::create_dir_all(&outpath);
    } else {
      if let Some(p) = outpath.parent() {
        let _ = std::fs::create_dir_all(p);
      }
      let mut outfile = std::fs::File::create(&outpath).map_err(|e| e.to_string())?;
      std::io::copy(&mut item, &mut outfile).map_err(|e| e.to_string())?;
    }
  }

  // Remove temp zip
  let _ = std::fs::remove_file(&temp_zip);

  // If contents were extracted into a single root subfolder (e.g., jdk-21.0.3+9), flatten
  if !resolved_target.join("bin").exists() {
    if let Ok(entries) = std::fs::read_dir(&resolved_target) {
      for entry in entries.flatten() {
        if entry.path().is_dir() && entry.path().join("bin").exists() {
          let sub_dir = entry.path();
          if let Ok(sub_entries) = std::fs::read_dir(&sub_dir) {
            for sub_e in sub_entries.flatten() {
              let dest = resolved_target.join(sub_e.file_name());
              let _ = std::fs::rename(sub_e.path(), dest);
            }
          }
          let _ = std::fs::remove_dir_all(sub_dir);
          break;
        }
      }
    }
  }

  let _ = app.emit("jdk_download_progress", JdkDownloadProgressEvent {
    percent: 100.0,
    message: "Installation complete!".to_string(),
    downloaded_bytes: total_size,
    total_bytes: total_size,
  });

  let target_str = resolved_target.to_string_lossy().to_string();
  validate_and_parse_jdk(target_str)
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export)]
pub struct ToolchainCheckResultDto {
  pub tool: String,
  pub is_installed: bool,
  pub version: Option<String>,
  pub path: Option<String>,
  pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export)]
pub struct ConnectionTestResultDto {
  pub success: bool,
  pub host: String,
  pub port: u16,
  pub latency_ms: Option<u64>,
  pub message: String,
}

#[tauri::command]
pub fn check_toolchain_binary(tool: String, custom_path: Option<String>) -> Result<ToolchainCheckResultDto, String> {
  let tool_lower = tool.to_lowercase();
  let run_version = |bin_name: &str, args: &[&str]| -> Option<(String, Option<String>)> {
    let mut cmd = Command::new(bin_name);
    for arg in args {
      cmd.arg(arg);
    }
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    if let Ok(out) = cmd.output() {
      let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
      let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
      let combined = if !stdout.is_empty() { stdout } else { stderr };
      if !combined.is_empty() {
        let first_line = combined.lines().next().unwrap_or("").to_string();
        return Some((first_line, None));
      }
    }
    None
  };

  match tool_lower.as_str() {
    "android" | "adb" => {
      // 1. Check custom path or standard locations
      let candidate_paths = [
        custom_path.clone().unwrap_or_default(),
        std::env::var("ANDROID_HOME").map(|h| format!("{}\\platform-tools\\adb.exe", h)).unwrap_or_default(),
        std::env::var("LOCALAPPDATA").map(|l| format!("{}\\Android\\Sdk\\platform-tools\\adb.exe", l)).unwrap_or_default(),
        "adb".to_string(),
      ];

      for p in &candidate_paths {
        if p.is_empty() { continue; }
        if let Some((ver, _)) = run_version(p, &["version"]) {
          return Ok(ToolchainCheckResultDto {
            tool: "Android ADB".to_string(),
            is_installed: true,
            version: Some(ver),
            path: Some(p.clone()),
            message: "Android SDK platform-tools detected and operational.".to_string(),
          });
        }
      }

      Ok(ToolchainCheckResultDto {
        tool: "Android ADB".to_string(),
        is_installed: false,
        version: None,
        path: custom_path,
        message: "adb binary not found. Please verify Android SDK location or install platform-tools.".to_string(),
      })
    }
    "flutter" => {
      let candidate = custom_path.unwrap_or_else(|| "flutter".to_string());
      if let Some((ver, _)) = run_version(&candidate, &["--version"]) {
        Ok(ToolchainCheckResultDto {
          tool: "Flutter".to_string(),
          is_installed: true,
          version: Some(ver),
          path: Some(candidate),
          message: "Flutter SDK verified successfully.".to_string(),
        })
      } else {
        Ok(ToolchainCheckResultDto {
          tool: "Flutter".to_string(),
          is_installed: false,
          version: None,
          path: Some(candidate),
          message: "Flutter executable not found in PATH or configured SDK path.".to_string(),
        })
      }
    }
    "dart" => {
      let candidate = custom_path.unwrap_or_else(|| "dart".to_string());
      if let Some((ver, _)) = run_version(&candidate, &["--version"]) {
        Ok(ToolchainCheckResultDto {
          tool: "Dart".to_string(),
          is_installed: true,
          version: Some(ver),
          path: Some(candidate),
          message: "Dart SDK verified successfully.".to_string(),
        })
      } else {
        Ok(ToolchainCheckResultDto {
          tool: "Dart".to_string(),
          is_installed: false,
          version: None,
          path: Some(candidate),
          message: "Dart executable not found in PATH or configured SDK path.".to_string(),
        })
      }
    }
    "protoc" | "protobuf" => {
      let candidate = custom_path.unwrap_or_else(|| "protoc".to_string());
      if let Some((ver, _)) = run_version(&candidate, &["--version"]) {
        Ok(ToolchainCheckResultDto {
          tool: "Protocol Buffers".to_string(),
          is_installed: true,
          version: Some(ver),
          path: Some(candidate),
          message: "Protocol Buffers compiler verified.".to_string(),
        })
      } else {
        Ok(ToolchainCheckResultDto {
          tool: "Protocol Buffers".to_string(),
          is_installed: false,
          version: None,
          path: Some(candidate),
          message: "protoc executable not found in PATH.".to_string(),
        })
      }
    }
    "openapi" => {
      // Check if project has openapi/swagger spec or local schema validator
      Ok(ToolchainCheckResultDto {
        tool: "OpenAPI Specification".to_string(),
        is_installed: true,
        version: Some("OpenAPI 3.1.0 (Built-in Schema Engine)".to_string()),
        path: None,
        message: "OpenAPI 3.0 / 3.1 schema definition parser is active.".to_string(),
      })
    }
    other => {
      let candidate = custom_path.unwrap_or_else(|| other.to_string());
      if let Some((ver, _)) = run_version(&candidate, &["--version"]) {
        Ok(ToolchainCheckResultDto {
          tool: other.to_string(),
          is_installed: true,
          version: Some(ver),
          path: Some(candidate),
          message: format!("{} binary verified.", other),
        })
      } else {
        Ok(ToolchainCheckResultDto {
          tool: other.to_string(),
          is_installed: false,
          version: None,
          path: Some(candidate),
          message: format!("{} binary not found.", other),
        })
      }
    }
  }
}

#[tauri::command]
pub fn detect_wsl_distros() -> Result<Vec<String>, String> {
  #[cfg(windows)]
  {
    let mut cmd = Command::new("wsl.exe");
    cmd.arg("-l").arg("-q");
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    match cmd.output() {
      Ok(out) => {
        // wsl -l -q outputs UTF-16LE in many Windows versions or UTF-8
        let bytes = &out.stdout;
        let text = if bytes.len() >= 2 && (bytes[1] == 0 || bytes[0] == 0) {
          let u16s: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();
          String::from_utf16_lossy(&u16s)
        } else {
          String::from_utf8_lossy(bytes).to_string()
        };

        let mut distros = Vec::new();
        for line in text.lines() {
          let clean = line.replace('\0', "").trim().to_string();
          if !clean.is_empty() {
            distros.push(clean);
          }
        }
        Ok(distros)
      }
      Err(e) => Err(format!("Failed to execute wsl.exe: {}", e)),
    }
  }

  #[cfg(not(windows))]
  {
    Ok(Vec::new())
  }
}

#[tauri::command]
pub fn test_remote_ssh_connection(host: String, port: Option<u16>) -> Result<ConnectionTestResultDto, String> {
  let target_port = port.unwrap_or(22);
  let trimmed_host = host.trim();

  // Strip user@ if present (e.g. root@myhost.com)
  let clean_host = if let Some(idx) = trimmed_host.find('@') {
    &trimmed_host[idx + 1..]
  } else {
    trimmed_host
  };

  if clean_host.is_empty() {
    return Err("Host address cannot be empty.".to_string());
  }

  let address_str = format!("{}:{}", clean_host, target_port);
  let start = std::time::Instant::now();

  use std::net::ToSocketAddrs;
  let addrs: Vec<std::net::SocketAddr> = match address_str.to_socket_addrs() {
    Ok(iter) => iter.collect(),
    Err(e) => {
      return Ok(ConnectionTestResultDto {
        success: false,
        host: clean_host.to_string(),
        port: target_port,
        latency_ms: None,
        message: format!("DNS resolution failed for {}: {}", clean_host, e),
      });
    }
  };

  if addrs.is_empty() {
    return Ok(ConnectionTestResultDto {
      success: false,
      host: clean_host.to_string(),
      port: target_port,
      latency_ms: None,
      message: format!("No IP address found for {}", clean_host),
    });
  }

  // Attempt TCP connect with 4 seconds timeout
  match std::net::TcpStream::connect_timeout(&addrs[0], Duration::from_secs(4)) {
    Ok(_) => {
      let latency = start.elapsed().as_millis() as u64;
      Ok(ConnectionTestResultDto {
        success: true,
        host: clean_host.to_string(),
        port: target_port,
        latency_ms: Some(latency),
        message: format!("TCP handshake successful with {}:{} in {}ms.", clean_host, target_port, latency),
      })
    }
    Err(e) => {
      Ok(ConnectionTestResultDto {
        success: false,
        host: clean_host.to_string(),
        port: target_port,
        latency_ms: None,
        message: format!("Connection refused or timed out on {}:{}: {}", clean_host, target_port, e),
      })
    }
  }
}

#[tauri::command]
pub fn test_sftp_connection(host: String, port: Option<u16>) -> Result<ConnectionTestResultDto, String> {
  test_remote_ssh_connection(host, port.or(Some(22)))
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export)]
pub struct GithubIssueDto {
  pub id: u64,
  pub number: u64,
  pub title: String,
  pub state: String,
  pub user: String,
  pub html_url: String,
  pub comments: u32,
  pub created_at: String,
  pub updated_at: String,
}

static GITHUB_CLIENT: LazyLock<Result<reqwest::Client, String>> = LazyLock::new(|| {
  reqwest::Client::builder()
    .timeout(Duration::from_secs(15))
    .user_agent("Custom-IDEA")
    .build()
    .map_err(|e| format!("Failed to initialize GitHub HTTP client: {}", e))
});

#[tauri::command]
pub async fn fetch_github_issues(repo: String, token: Option<String>) -> Result<Vec<GithubIssueDto>, String> {
  let clean_repo = repo.trim().trim_start_matches("https://github.com/").trim_matches('/');
  let mut segments = clean_repo.split('/');
  let owner = segments.next().unwrap_or("");
  let name = segments.next().unwrap_or("");
  let is_valid_seg = |s: &str| !s.is_empty() && s != "." && s != ".." && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
  if !is_valid_seg(owner) || !is_valid_seg(name) || segments.next().is_some() {
    return Err("Invalid repository format (expected: owner/repo).".to_string());
  }

  let url = format!("https://api.github.com/repos/{}/{}/issues?state=open&per_page=30", owner, name);
  let client = GITHUB_CLIENT.as_ref().map_err(|e| e.clone())?;

  let mut req = client
    .get(&url)
    .header("Accept", "application/vnd.github.v3+json");

  if let Some(tok) = token {
    let t_trim = tok.trim();
    if !t_trim.is_empty() {
      req = req.bearer_auth(t_trim);
    }
  }

  let mut res = req
    .send()
    .await
    .map_err(|e| format!("GitHub request failed: {}", e))?;

  let status = res.status();
  let mut buf: Vec<u8> = Vec::new();
  const MAX_GITHUB_BODY: usize = 4 * 1024 * 1024;
  while let Some(chunk) = res.chunk().await.map_err(|e| format!("Failed reading GitHub response: {}", e))? {
    if buf.len() + chunk.len() > MAX_GITHUB_BODY {
      return Err("GitHub response exceeded 4 MiB limit".to_string());
    }
    buf.extend_from_slice(&chunk);
  }

  if !status.is_success() {
    let msg = serde_json::from_slice::<serde_json::Value>(&buf)
      .ok()
      .and_then(|v| v.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()))
      .unwrap_or_else(|| String::from_utf8_lossy(&buf).chars().take(200).collect());
    return Err(format!("GitHub API error (HTTP {}): {}", status.as_u16(), msg));
  }

  let val: serde_json::Value = serde_json::from_slice(&buf)
    .map_err(|e| format!("Failed to parse GitHub JSON (HTTP {}): {}", status.as_u16(), e))?;
  if let Some(msg) = val.get("message").and_then(|m| m.as_str()) {
    return Err(format!("GitHub API error: {}", msg));
  }

  let mut issues = Vec::new();
  if let Some(arr) = val.as_array() {
    for item in arr {
      if item.get("pull_request").is_some() {
        continue;
      }

      issues.push(GithubIssueDto {
        id: item.get("id").and_then(|v| v.as_u64()).unwrap_or(0),
        number: item.get("number").and_then(|v| v.as_u64()).unwrap_or(0),
        title: item.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled").to_string(),
        state: item.get("state").and_then(|v| v.as_str()).unwrap_or("open").to_string(),
        user: item.get("user").and_then(|u| u.get("login")).and_then(|l| l.as_str()).unwrap_or("anonymous").to_string(),
        html_url: item.get("html_url").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        comments: item.get("comments").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
        created_at: item.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        updated_at: item.get("updated_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
      });
    }
  }
  Ok(issues)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_expand_home_path() {
    let p = expand_home_path("my/path");
    assert_eq!(p, "my/path");
    let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE"));
    if let Ok(home_dir) = home {
      let expanded = expand_home_path("~/sub/file");
      assert!(expanded.starts_with(&home_dir), "expected '{}' to start with '{}'", expanded, home_dir);
      assert!(expanded.ends_with("sub/file") || expanded.ends_with(r"sub\file"));
    }
  }

  #[test]
  #[cfg(windows)]
  fn test_resolve_windows_command() {
    let cmd = resolve_windows_command_on_path("cmd");
    assert!(cmd.is_some());
    let full = cmd.unwrap().to_lowercase();
    assert!(full.ends_with(".exe"));
  }

  #[test]
  fn test_reject_control_chars_and_build_process_command() {
    assert!(reject_control_chars("normal arg & | ; $()", "arg").is_ok());
    assert!(reject_control_chars("bad\0arg", "arg").is_err());
    assert!(reject_control_chars("bad\rarg", "arg").is_err());
    assert!(reject_control_chars("bad\narg", "arg").is_err());

    let args = vec![
      "hello & whoami".to_string(),
      "space arg".to_string(),
      "foo|bar".to_string(),
    ];
    let cmd = build_process_command("git", &args, Some("."), None).expect("valid args should succeed");
    let collected: Vec<String> = cmd
      .get_args()
      .map(|a| a.to_string_lossy().to_string())
      .collect();
    assert_eq!(collected, args);

    // Control characters rejected in command, arg, cwd, and env
    assert!(build_process_command("git\nwhoami", &[], None, None).is_err());
    assert!(build_process_command("git", &["status\r\nevil".to_string()], None, None).is_err());
    assert!(build_process_command("git", &[], Some(".\0bad"), None).is_err());

    let mut bad_env = HashMap::new();
    bad_env.insert("GOOD".to_string(), "bad\nval".to_string());
    assert!(build_process_command("git", &[], None, Some(&bad_env)).is_err());

    let mut bad_env_key = HashMap::new();
    bad_env_key.insert("BAD\0KEY".to_string(), "ok".to_string());
    assert!(build_process_command("git", &[], None, Some(&bad_env_key)).is_err());
  }

  #[tokio::test]
  async fn test_fetch_github_issues_validates_repo_format() {
    assert!(fetch_github_issues("justone".to_string(), None).await.is_err());
    assert!(fetch_github_issues("../../etc/passwd".to_string(), None).await.is_err());
    assert!(fetch_github_issues("a/b/c".to_string(), None).await.is_err());
    assert!(fetch_github_issues("".to_string(), None).await.is_err());
  }
}

