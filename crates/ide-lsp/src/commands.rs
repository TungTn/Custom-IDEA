use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Duration;
use serde_json::Value;
use tauri::Emitter;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

static REQUEST_COUNTER: AtomicU64 = AtomicU64::new(1);
const MAX_LSP_CONTENT_LENGTH: usize = 64 * 1024 * 1024;

struct LspProcess {
  server_name: String,
  child: Child,
  writer: Arc<Mutex<Box<dyn Write + Send>>>,
  pending_requests: Arc<Mutex<HashMap<u64, Sender<Result<Value, String>>>>>,
}

static ACTIVE_SERVERS: LazyLock<Mutex<HashMap<String, LspProcess>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn stop_all_lsp_servers() {
  let drained: Vec<LspProcess> = if let Ok(mut map) = ACTIVE_SERVERS.lock() {
    map.drain().map(|(_lang, p)| p).collect()
  } else {
    Vec::new()
  };
  for mut proc in drained {
    let _ = proc.child.kill();
    let _ = proc.child.wait();
  }
}

fn validate_lsp_frame_size(len: usize) -> Result<(), String> {
  if len > MAX_LSP_CONTENT_LENGTH {
    Err("LSP message exceeded maximum size limit".to_string())
  } else {
    Ok(())
  }
}

fn validate_custom_lsp_path(path: &str) -> Result<String, String> {
  let trimmed = path.trim();
  if trimmed.is_empty() {
    return Err("LSP server path cannot be empty".to_string());
  }
  if trimmed.starts_with(r"\\") || trimmed.starts_with("//") {
    return Err("UNC/network executable paths are not allowed for LSP servers".to_string());
  }
  let p = std::path::Path::new(trimmed);
  if !p.is_file() {
    return Err(format!("LSP executable does not exist or is not a file: {}", trimmed));
  }
  if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
    let ext_lower = ext.to_ascii_lowercase();
    if matches!(ext_lower.as_str(), "bat" | "cmd" | "ps1" | "vbs" | "vbe" | "js" | "jse" | "wsf") {
      return Err(format!("Script extension '.{}' is not allowed for custom LSP path", ext));
    }
  }
  Ok(trimmed.to_string())
}

fn path_to_file_uri(project_path: &str) -> String {
  let abs = std::fs::canonicalize(project_path).unwrap_or_else(|_| std::path::PathBuf::from(project_path));
  let mut raw = abs.to_string_lossy().replace('\\', "/");
  if let Some(stripped) = raw.strip_prefix("//?/") {
    raw = stripped.to_string();
  }
  let mut out = if raw.starts_with('/') {
    String::from("file://")
  } else {
    String::from("file:///")
  };
  for b in raw.as_bytes() {
    match b {
      b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' | b':' => {
        out.push(*b as char);
      }
      _ => out.push_str(&format!("%{:02X}", b)),
    }
  }
  out
}

fn write_jsonrpc_message(writer: &mut dyn Write, msg: &Value) -> Result<(), String> {
  let json_str = serde_json::to_string(msg).map_err(|e| e.to_string())?;
  let content = format!("Content-Length: {}\r\n\r\n{}", json_str.len(), json_str);
  writer.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
  writer.flush().map_err(|e| e.to_string())?;
  Ok(())
}

static CUSTOM_LSP_PATHS: LazyLock<std::sync::RwLock<HashMap<String, String>>> = LazyLock::new(|| std::sync::RwLock::new(HashMap::new()));
static LSP_START_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

fn find_lsp_executable(lang: &str) -> Option<(String, Vec<String>)> {
  let lang_lower = lang.to_lowercase();

  #[cfg(windows)]
  let resolve_cmd = |exe: &str| -> Option<String> {
    let mut cmd = Command::new("where.exe");
    cmd.arg(exe);
    cmd.creation_flags(0x08000000);
    let out = cmd.output().ok()?;
    if !out.status.success() {
      return None;
    }
    let stdout = String::from_utf8_lossy(&out.stdout);
    let candidates: Vec<&str> = stdout
      .lines()
      .map(|l| l.trim())
      .filter(|l| !l.is_empty() && std::path::Path::new(l).is_file())
      .collect();
    candidates
      .iter()
      .find(|l| {
        matches!(
          std::path::Path::new(l).extension().and_then(|e| e.to_str()).map(|s| s.to_ascii_lowercase()).as_deref(),
          Some("exe" | "cmd" | "bat" | "com")
        )
      })
      .or_else(|| candidates.first())
      .map(|s| (*s).to_string())
  };

  #[cfg(not(windows))]
  let resolve_cmd = |exe: &str| -> Option<String> {
    let mut cmd = Command::new("which");
    cmd.arg(exe);
    let out = cmd.output().ok()?;
    if !out.status.success() {
      return None;
    }
    let stdout = String::from_utf8_lossy(&out.stdout);
    stdout
      .lines()
      .map(|l| l.trim())
      .find(|l| !l.is_empty())
      .map(|s| s.to_string())
  };

  // Check custom configured path first
  if let Ok(guard) = CUSTOM_LSP_PATHS.read() {
    if let Some(custom_path) = guard.get(&lang_lower) {
      if validate_custom_lsp_path(custom_path).is_ok() {
        let args = match lang_lower.as_str() {
          "typescript" | "javascript" | "ts" | "js" | "tsx" | "jsx" | "python" | "py" => vec!["--stdio".to_string()],
          _ => vec![],
        };
        return Some((custom_path.clone(), args));
      }
    }
  }

  match lang_lower.as_str() {
    "rust" | "rs" => resolve_cmd("rust-analyzer").map(|p| (p, vec![])),
    "typescript" | "javascript" | "ts" | "js" | "tsx" | "jsx" => resolve_cmd("typescript-language-server")
      .or_else(|| resolve_cmd("vtsls"))
      .map(|p| (p, vec!["--stdio".to_string()])),
    "python" | "py" => resolve_cmd("pyright-langserver")
      .map(|p| (p, vec!["--stdio".to_string()]))
      .or_else(|| resolve_cmd("pylsp").map(|p| (p, vec![]))),
    "go" => resolve_cmd("gopls").map(|p| (p, vec![])),
    "c" | "cpp" | "c++" => resolve_cmd("clangd").map(|p| (p, vec![])),
    "java" => resolve_cmd("jdtls").map(|p| (p, vec![])),
    _ => None,
  }
}

#[tauri::command]
pub fn lsp_set_server_path(lang: String, custom_path: Option<String>) -> Result<(), String> {
  let lang_lower = lang.to_lowercase();
  let validated = match custom_path {
    Some(ref p) if !p.trim().is_empty() => Some(validate_custom_lsp_path(p)?),
    _ => None,
  };
  let mut guard = CUSTOM_LSP_PATHS.write().map_err(|e| e.to_string())?;
  if let Some(valid_path) = validated {
    guard.insert(lang_lower, valid_path);
  } else {
    guard.remove(&lang_lower);
  }
  Ok(())
}

#[tauri::command]
pub fn lsp_start_server(
  app: tauri::AppHandle,
  lang: String,
  project_path: String,
) -> Result<String, String> {
  // Serialize concurrent server starts (independent of request/stop locks)
  let _start_guard = LSP_START_LOCK.lock().map_err(|e| e.to_string())?;
  let lang_key = lang.to_lowercase();

  if !std::path::Path::new(&project_path).is_dir() {
    return Err(format!("Project path is not a directory: {}", project_path));
  }

  // If already active and still running, return success; remove dead exited entries
  {
    let mut map = ACTIVE_SERVERS.lock().map_err(|e| e.to_string())?;
    if let Some(proc) = map.get_mut(&lang_key) {
      if let Ok(None) = proc.child.try_wait() {
        return Ok(format!("Active: {}", proc.server_name));
      }
      if let Some(mut dead) = map.remove(&lang_key) {
        let _ = dead.child.wait();
      }
    }
  }

  let (exe, args) = find_lsp_executable(&lang_key).ok_or_else(|| {
    format!("No Language Server found for '{}' (checked standard binaries)", lang)
  })?;

  let mut cmd = Command::new(&exe);
  cmd.args(&args);
  cmd.current_dir(&project_path);
  cmd.stdin(Stdio::piped());
  cmd.stdout(Stdio::piped());
  cmd.stderr(Stdio::null());

  #[cfg(windows)]
  cmd.creation_flags(0x08000000);

  let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn {}: {}", exe, e))?;
  let stdin = match child.stdin.take() {
    Some(s) => s,
    None => {
      let _ = child.kill();
      let _ = child.wait();
      return Err("Failed to open LSP stdin".to_string());
    }
  };
  let stdout = match child.stdout.take() {
    Some(s) => s,
    None => {
      let _ = child.kill();
      let _ = child.wait();
      return Err("Failed to open LSP stdout".to_string());
    }
  };

  let writer: Arc<Mutex<Box<dyn Write + Send>>> = Arc::new(Mutex::new(Box::new(stdin)));
  let pending_requests: Arc<Mutex<HashMap<u64, Sender<Result<Value, String>>>>> = Arc::new(Mutex::new(HashMap::new()));

  let app_clone = app.clone();
  let pending_clone = pending_requests.clone();
  let server_name = exe.clone();

  // Background thread parsing JSON-RPC messages from LSP stdout
  std::thread::spawn(move || {
    let mut reader = BufReader::new(stdout);
    let drain_pending = |msg: &str| {
      if let Ok(mut map) = pending_clone.lock() {
        for (_, tx) in map.drain() {
          let _ = tx.send(Err(msg.to_string()));
        }
      }
    };

    loop {
      let mut line = String::new();
      let mut content_length: Option<usize> = None;

      // Read header lines until empty line
      loop {
        line.clear();
        match reader.read_line(&mut line) {
          Ok(0) | Err(_) => {
            drain_pending("LSP server disconnected");
            return;
          }
          Ok(_) => {
            let trimmed = line.trim();
            if trimmed.is_empty() {
              break; // Header boundary
            }
            if trimmed.to_lowercase().starts_with("content-length:") {
              if let Some(val) = trimmed.split(':').nth(1) {
                if let Ok(len) = val.trim().parse::<usize>() {
                  content_length = Some(len);
                }
              }
            }
          }
        }
      }

      if let Some(len) = content_length {
        if validate_lsp_frame_size(len).is_err() {
          drain_pending("LSP message exceeded maximum size limit");
          return;
        }
        let mut body_buf = vec![0u8; len];
        if reader.read_exact(&mut body_buf).is_err() {
          drain_pending("LSP stream ended unexpectedly");
          return;
        }
        if let Ok(val) = serde_json::from_slice::<Value>(&body_buf) {
          // Check if this is a response to a pending request
          if let Some(id_val) = val.get("id") {
            if let Some(id) = id_val.as_u64() {
              let mut map = match pending_clone.lock() {
                Ok(m) => m,
                Err(_) => continue,
              };
              if let Some(tx) = map.remove(&id) {
                if let Some(err) = val.get("error") {
                  let _ = tx.send(Err(err.to_string()));
                } else {
                  let res = val.get("result").cloned().unwrap_or(Value::Null);
                  let _ = tx.send(Ok(res));
                }
                continue;
              }
            }
          }

          // Check if this is a server notification (e.g., publishDiagnostics)
          if let Some(method) = val.get("method").and_then(|m| m.as_str()) {
            if method == "textDocument/publishDiagnostics" {
              if let Some(params) = val.get("params") {
                let _ = app_clone.emit("lsp-diagnostics", params);
              }
            }
          }
        }
      }
    }
  });

  // Send initialize BEFORE registering in ACTIVE_SERVERS so timeout/failure cleans up cleanly
  let init_id = REQUEST_COUNTER.fetch_add(1, Ordering::SeqCst);
  let root_uri = path_to_file_uri(&project_path);

  let init_params = serde_json::json!({
    "processId": std::process::id(),
    "rootUri": root_uri,
    "capabilities": {
      "textDocument": {
        "completion": {
          "completionItem": {
            "snippetSupport": true,
            "documentationFormat": ["markdown", "plaintext"]
          }
        },
        "hover": {
          "contentFormat": ["markdown", "plaintext"]
        },
        "definition": {
          "linkSupport": true
        },
        "publishDiagnostics": {
          "relatedInformation": true
        }
      }
    }
  });

  let (tx, rx) = channel();
  {
    let mut map = pending_requests.lock().map_err(|e| e.to_string())?;
    map.insert(init_id, tx);
  }

  let init_req = serde_json::json!({
    "jsonrpc": "2.0",
    "id": init_id,
    "method": "initialize",
    "params": init_params,
  });

  let write_init_res = {
    let mut w = writer.lock().map_err(|e| e.to_string())?;
    write_jsonrpc_message(&mut **w, &init_req)
  };
  if let Err(err) = write_init_res {
    let _ = child.kill();
    let _ = child.wait();
    return Err(err);
  }

  // Wait briefly for initialize response
  let init_res = match rx.recv_timeout(Duration::from_secs(5)) {
    Ok(Ok(res)) => res,
    Ok(Err(err)) => {
      let _ = child.kill();
      let _ = child.wait();
      return Err(format!("LSP init error: {}", err));
    }
    Err(_) => {
      if let Ok(mut pending) = pending_requests.lock() {
        pending.remove(&init_id);
      }
      let _ = child.kill();
      let _ = child.wait();
      return Err("LSP initialize timed out".to_string());
    }
  };

  // Send initialized notification
  let initialized_notif = serde_json::json!({
    "jsonrpc": "2.0",
    "method": "initialized",
    "params": {}
  });

  let write_notif_res = {
    let mut w = writer.lock().map_err(|e| e.to_string())?;
    write_jsonrpc_message(&mut **w, &initialized_notif)
  };
  if let Err(err) = write_notif_res {
    let _ = child.kill();
    let _ = child.wait();
    return Err(err);
  }

  // Store active process after successful handshake
  {
    let mut map = match ACTIVE_SERVERS.lock() {
      Ok(m) => m,
      Err(e) => {
        let _ = child.kill();
        let _ = child.wait();
        return Err(e.to_string());
      }
    };
    map.insert(lang_key, LspProcess {
      server_name: server_name.clone(),
      child,
      writer,
      pending_requests,
    });
  }

  let name_output = init_res
    .get("serverInfo")
    .and_then(|info| info.get("name"))
    .and_then(|n| n.as_str())
    .unwrap_or(&server_name);

  Ok(name_output.to_string())
}

#[tauri::command]
pub fn lsp_send_request(
  lang: String,
  method: String,
  params: Value,
) -> Result<Value, String> {
  let lang_key = lang.to_lowercase();
  let (writer, pending_requests) = {
    let map = ACTIVE_SERVERS.lock().map_err(|e| e.to_string())?;
    let proc = map.get(&lang_key).ok_or_else(|| format!("LSP server for '{}' not running", lang))?;
    (proc.writer.clone(), proc.pending_requests.clone())
  };

  let req_id = REQUEST_COUNTER.fetch_add(1, Ordering::SeqCst);
  let (tx, rx) = channel();

  {
    let mut pending = pending_requests.lock().map_err(|e| e.to_string())?;
    pending.insert(req_id, tx);
  }

  let req = serde_json::json!({
    "jsonrpc": "2.0",
    "id": req_id,
    "method": method,
    "params": params,
  });

  let write_res = {
    let mut w = writer.lock().map_err(|e| e.to_string())?;
    write_jsonrpc_message(&mut **w, &req)
  };
  if let Err(e) = write_res {
    if let Ok(mut pending) = pending_requests.lock() {
      pending.remove(&req_id);
    }
    return Err(e);
  }

  match rx.recv_timeout(Duration::from_secs(4)) {
    Ok(Ok(val)) => Ok(val),
    Ok(Err(e)) => Err(e),
    Err(_) => {
      // Remove stale request
      if let Ok(mut pending) = pending_requests.lock() {
        pending.remove(&req_id);
      }
      Err("LSP request timed out".to_string())
    }
  }
}

#[tauri::command]
pub fn lsp_send_notification(
  lang: String,
  method: String,
  params: Value,
) -> Result<(), String> {
  let lang_key = lang.to_lowercase();
  let writer = {
    let map = ACTIVE_SERVERS.lock().map_err(|e| e.to_string())?;
    let proc = map.get(&lang_key).ok_or_else(|| format!("LSP server for '{}' not running", lang))?;
    proc.writer.clone()
  };

  let notif = serde_json::json!({
    "jsonrpc": "2.0",
    "method": method,
    "params": params,
  });

  let mut w = writer.lock().map_err(|e| e.to_string())?;
  write_jsonrpc_message(&mut **w, &notif)
}

#[tauri::command]
pub fn lsp_stop_server(lang: String) -> Result<(), String> {
  let lang_key = lang.to_lowercase();
  let removed = {
    let mut map = ACTIVE_SERVERS.lock().map_err(|e| e.to_string())?;
    map.remove(&lang_key)
  };
  if let Some(mut proc) = removed {
    let _ = proc.child.kill();
    let _ = proc.child.wait();
  }
  Ok(())
}

#[tauri::command]
pub fn lsp_get_active_servers() -> Result<HashMap<String, String>, String> {
  let map = ACTIVE_SERVERS.lock().map_err(|e| e.to_string())?;
  let mut result = HashMap::new();
  for (lang, proc) in map.iter() {
    result.insert(lang.clone(), proc.server_name.clone());
  }
  Ok(result)
}

#[cfg(test)]
mod tests {
  use super::*;

  struct TempLspDir(std::path::PathBuf);

  impl TempLspDir {
    fn new(tag: &str) -> Self {
      let unique = format!(
        "ide_lsp_test_{}_{}",
        tag,
        std::time::SystemTime::now()
          .duration_since(std::time::UNIX_EPOCH)
          .unwrap()
          .as_nanos()
      );
      let dir = std::env::temp_dir().join(unique);
      std::fs::create_dir_all(&dir).unwrap();
      Self(dir)
    }
  }

  impl Drop for TempLspDir {
    fn drop(&mut self) {
      let _ = std::fs::remove_dir_all(&self.0);
    }
  }

  #[test]
  fn test_validate_custom_lsp_path() {
    assert!(validate_custom_lsp_path("").is_err());
    assert!(validate_custom_lsp_path("   ").is_err());
    assert!(validate_custom_lsp_path(r"\\attacker\share\lsp.exe").is_err());
    assert!(validate_custom_lsp_path("//attacker/share/lsp").is_err());

    let tmp = TempLspDir::new("validate");
    let missing = tmp.0.join("rust-analyzer.exe");
    assert!(validate_custom_lsp_path(&missing.to_string_lossy()).is_err());

    for ext in ["bat", "cmd", "ps1", "vbs", "js"] {
      let script = tmp.0.join(format!("server.{}", ext));
      std::fs::write(&script, b"echo").unwrap();
      let err = validate_custom_lsp_path(&script.to_string_lossy()).unwrap_err();
      assert!(err.contains("Script extension"), "unexpected error for {}: {}", ext, err);
    }

    let valid_exe = tmp.0.join("rust-analyzer.exe");
    std::fs::write(&valid_exe, b"mz").unwrap();
    assert_eq!(
      validate_custom_lsp_path(&format!(" {} ", valid_exe.display())).unwrap(),
      valid_exe.to_string_lossy()
    );
  }

  #[test]
  fn test_path_to_file_uri() {
    let tmp = TempLspDir::new("uri dir");
    let sub = tmp.0.join("my project");
    std::fs::create_dir_all(&sub).unwrap();
    let uri = path_to_file_uri(&sub.to_string_lossy());
    assert!(uri.starts_with("file:///") || uri.starts_with("file://"));
    assert!(!uri.contains("//?/"), "UNC prefix must be stripped: {}", uri);
    assert!(uri.contains("uri%20dir"), "spaces must be percent-encoded: {}", uri);
    assert!(uri.contains("my%20project"), "spaces must be percent-encoded: {}", uri);
  }

  #[test]
  fn test_validate_lsp_frame_size() {
    assert!(validate_lsp_frame_size(0).is_ok());
    assert!(validate_lsp_frame_size(MAX_LSP_CONTENT_LENGTH).is_ok());
    let err = validate_lsp_frame_size(MAX_LSP_CONTENT_LENGTH + 1).unwrap_err();
    assert!(err.contains("maximum size limit"));
  }

  #[test]
  fn test_lsp_registry_and_custom_path_setter() {
    // Rejecting invalid script must not pollute CUSTOM_LSP_PATHS or ACTIVE_SERVERS
    let tmp = TempLspDir::new("setter");
    let bad_script = tmp.0.join("fake-ls.bat");
    std::fs::write(&bad_script, b"@echo off").unwrap();
    let err = lsp_set_server_path("test_lang_invalid".into(), Some(bad_script.to_string_lossy().into()));
    assert!(err.is_err());

    let active = lsp_get_active_servers().unwrap();
    assert!(!active.contains_key("test_lang_invalid"));
    assert!(lsp_stop_server("test_lang_invalid".into()).is_ok());
  }
}
