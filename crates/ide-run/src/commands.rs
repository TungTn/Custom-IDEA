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
pub fn stop_all_processes() -> Result<(), String> {
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

fn expand_home_path(s: &str) -> String {
  if s.starts_with('~') {
    if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
      return format!("{}{}", home, &s[1..]);
    }
  }
  s.to_string()
}

fn resolve_executable_path(command: &str, work_dir: &str) -> String {
  let expanded = expand_home_path(command);
  let clean = if (expanded.starts_with('"') && expanded.ends_with('"')) 
    || (expanded.starts_with('\'') && expanded.ends_with('\'')) {
    &expanded[1..expanded.len() - 1]
  } else {
    &expanded
  };

  // If clean command contains directory separators, test if that specific binary exists
  if clean.contains('\\') || clean.contains('/') {
    let p = std::path::Path::new(clean);
    if !p.exists() {
      // Path does not exist on this machine! Fallback to project wrapper or system executable
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
        return "mvn".to_string();
      } else if lower.contains("gradle") {
        #[cfg(windows)]
        let wrapper = "gradlew.bat";
        #[cfg(not(windows))]
        let wrapper = "gradlew";
        let wrapper_path = std::path::Path::new(work_dir).join(wrapper);
        if wrapper_path.exists() {
          return wrapper_path.to_string_lossy().to_string();
        }
        return "gradle".to_string();
      }
    }
  } else {
    // Command is just "mvn" or "mvn.cmd"
    let lower = clean.to_lowercase();
    if lower == "mvn" || lower == "mvn.cmd" {
      #[cfg(windows)]
      let wrapper = "mvnw.cmd";
      #[cfg(not(windows))]
      let wrapper = "mvnw";
      let wrapper_path = std::path::Path::new(work_dir).join(wrapper);
      if wrapper_path.exists() {
        return wrapper_path.to_string_lossy().to_string();
      }
    }
  }

  expanded
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

#[tauri::command]
pub fn execute_build_command(
  command: String, 
  args: Vec<String>, 
  cwd: Option<String>,
  env_vars: Option<HashMap<String, String>>,
) -> Result<BuildCommandResult, String> {
  let work_dir = expand_home_path(&cwd.unwrap_or_else(|| ".".to_string()));
  let resolved_command = resolve_executable_path(&command, &work_dir);

  let mut cmd = {
    #[cfg(windows)]
    {
      let mut c = std::process::Command::new("cmd.exe");
      c.arg("/d").arg("/c");
      let mut full_cmd = if resolved_command.contains(' ') && !resolved_command.starts_with('"') {
        format!("\"{}\"", resolved_command)
      } else {
        resolved_command.clone()
      };
      for a in &args {
        full_cmd.push(' ');
        if a.contains(' ') && !a.starts_with('"') {
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
    }
    #[cfg(not(windows))]
    {
      let mut c = std::process::Command::new(&resolved_command);
      c.args(&args);
      c
    }
  };
  cmd.current_dir(&work_dir);
  if let Some(ref envs) = env_vars {
    for (k, v) in envs {
      cmd.env(k, expand_home_path(v));
    }
  }
  ensure_valid_jvm_environment(&mut cmd, &resolved_command, &args, env_vars.as_ref());

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

  let work_dir = expand_home_path(&cwd.unwrap_or_else(|| ".".to_string()));
  let resolved_command = resolve_executable_path(&command, &work_dir);

  #[cfg(windows)]
  let mut cmd = {
    let mut c = Command::new("cmd.exe");
    c.arg("/d").arg("/c");
    let mut full_cmd = if resolved_command.contains(' ') && !resolved_command.starts_with('"') {
      format!("\"{}\"", resolved_command)
    } else {
      resolved_command.clone()
    };
    for a in &args {
      full_cmd.push(' ');
      if a.contains(' ') && !a.starts_with('"') {
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
    let mut c = Command::new(&resolved_command);
    c.args(&args);
    c
  };

  if let Some(ref envs) = env_vars {
    for (k, v) in envs {
      cmd.env(k, expand_home_path(v));
    }
  }

  ensure_valid_jvm_environment(&mut cmd, &resolved_command, &args, env_vars.as_ref());

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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_cmd_mvn() {
    let mut c = std::process::Command::new("cmd.exe");
    c.arg("/d").arg("/c").arg("mvn.cmd -v");
    c.env("JAVA_HOME", "C:\\Program Files\\Java\\jdk-25.0.5.0.3");
    let out = c.output().unwrap();
    println!("STATUS: {:?}", out.status);
    println!("STDOUT: {}", String::from_utf8_lossy(&out.stdout));
    println!("STDERR: {}", String::from_utf8_lossy(&out.stderr));
  }
}

