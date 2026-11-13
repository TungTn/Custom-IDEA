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
static LSP_INSTANCE_COUNTER: AtomicU64 = AtomicU64::new(1);
const MAX_LSP_CONTENT_LENGTH: usize = 64 * 1024 * 1024;
const MAX_LSP_HEADER_LINE_BYTES: usize = 64 * 1024;

struct LspProcess {
  instance_id: u64,
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
  if !p.is_absolute() {
    return Err(format!("Custom LSP server path must be an absolute path: {}", trimmed));
  }
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
        let stem = std::path::Path::new(custom_path)
          .file_stem()
          .and_then(|s| s.to_str())
          .map(|s| s.to_ascii_lowercase())
          .unwrap_or_default();
        let args = match lang_lower.as_str() {
          "typescript" | "javascript" | "ts" | "js" | "tsx" | "jsx" => vec!["--stdio".to_string()],
          "python" | "py" if !matches!(stem.as_str(), "pylsp" | "python-lsp-server") => {
            vec!["--stdio".to_string()]
          }
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

#[derive(Debug, PartialEq, Eq)]
enum LspMessageKind {
  ClientResponse(u64),
  ServerRequest,
  Notification,
  Ignored,
}

fn read_next_content_length<R: BufRead>(reader: &mut R) -> Result<Option<usize>, String> {
  let mut header_buf: Vec<u8> = Vec::with_capacity(128);
  let mut content_length: Option<usize> = None;
  loop {
    header_buf.clear();
    match reader.read_until(b'\n', &mut header_buf) {
      Ok(0) => return Err("LSP stream closed".to_string()),
      Err(e) => return Err(format!("LSP header read error: {}", e)),
      Ok(_) => {
        if header_buf.len() > MAX_LSP_HEADER_LINE_BYTES {
          return Err("LSP header line exceeded limit".to_string());
        }
        let line = String::from_utf8_lossy(&header_buf);
        let trimmed = line.trim();
        if trimmed.is_empty() {
          return Ok(content_length);
        }
        if trimmed.to_ascii_lowercase().starts_with("content-length:") {
          if let Some(val) = trimmed.split(':').nth(1) {
            if let Ok(len) = val.trim().parse::<usize>() {
              content_length = Some(len);
            }
          }
        }
      }
    }
  }
}

fn classify_lsp_message(val: &Value) -> LspMessageKind {
  let has_method = val.get("method").and_then(|m| m.as_str()).is_some();
  let id_opt = val.get("id").filter(|id| !id.is_null());
  if !has_method {
    match id_opt.and_then(|v| v.as_u64()) {
      Some(id) => LspMessageKind::ClientResponse(id),
      None => LspMessageKind::Ignored,
    }
  } else if id_opt.is_some() {
    LspMessageKind::ServerRequest
  } else {
    LspMessageKind::Notification
  }
}

fn remove_exited_lsp_server(lang_key: &str, instance_id: u64) {
  let removed = if let Ok(mut map) = ACTIVE_SERVERS.lock() {
    if map.get(lang_key).is_some_and(|p| p.instance_id == instance_id) {
      map.remove(lang_key)
    } else {
      None
    }
  } else {
    None
  };
  if let Some(mut dead) = removed {
    let _ = dead.child.wait();
  }
}

#[tauri::command]
pub async fn lsp_start_server(
  app: tauri::AppHandle,
  lang: String,
  project_path: String,
) -> Result<String, String> {
  tauri::async_runtime::spawn_blocking(move || lsp_start_server_sync(app, lang, project_path))
    .await
    .map_err(|e| format!("LSP start task failed: {}", e))?
}

fn lsp_start_server_sync(
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
  let stale_proc = {
    let mut map = ACTIVE_SERVERS.lock().map_err(|e| e.to_string())?;
    if let Some(proc) = map.get_mut(&lang_key) {
      if let Ok(None) = proc.child.try_wait() {
        return Ok(format!("Active: {}", proc.server_name));
      }
      map.remove(&lang_key)
    } else {
      None
    }
  };
  if let Some(mut dead) = stale_proc {
    let _ = dead.child.wait();
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

  let instance_id = LSP_INSTANCE_COUNTER.fetch_add(1, Ordering::SeqCst);
  let writer: Arc<Mutex<Box<dyn Write + Send>>> = Arc::new(Mutex::new(Box::new(stdin)));
  let pending_requests: Arc<Mutex<HashMap<u64, Sender<Result<Value, String>>>>> = Arc::new(Mutex::new(HashMap::new()));

  let app_clone = app.clone();
  let pending_clone = pending_requests.clone();
  let writer_clone = writer.clone();
  let lang_key_clone = lang_key.clone();
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
      // Read header lines until empty line
      let content_length = match read_next_content_length(&mut reader) {
        Ok(cl) => cl,
        Err(reason) => {
          let msg = if reason.contains("limit") {
            "LSP header line exceeded limit"
          } else {
            "LSP server disconnected"
          };
          drain_pending(msg);
          remove_exited_lsp_server(&lang_key_clone, instance_id);
          return;
        }
      };

      if let Some(len) = content_length {
        if validate_lsp_frame_size(len).is_err() {
          drain_pending("LSP message exceeded maximum size limit");
          remove_exited_lsp_server(&lang_key_clone, instance_id);
          return;
        }
        let mut body_buf = vec![0u8; len];
        if reader.read_exact(&mut body_buf).is_err() {
          drain_pending("LSP stream ended unexpectedly");
          remove_exited_lsp_server(&lang_key_clone, instance_id);
          return;
        }
        if let Ok(val) = serde_json::from_slice::<Value>(&body_buf) {
          match classify_lsp_message(&val) {
            LspMessageKind::ClientResponse(id) => {
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
              }
            }
            LspMessageKind::ServerRequest => {
              if let Some(req_id) = val.get("id").filter(|id| !id.is_null()) {
                let reply = serde_json::json!({
                  "jsonrpc": "2.0",
                  "id": req_id,
                  "result": Value::Null,
                });
                if let Ok(mut w) = writer_clone.lock() {
                  let _ = write_jsonrpc_message(&mut **w, &reply);
                }
              }
            }
            LspMessageKind::Notification => {
              if let Some(method) = val.get("method").and_then(|m| m.as_str()) {
                if method == "textDocument/publishDiagnostics" {
                  if let Some(params) = val.get("params") {
                    let _ = app_clone.emit("lsp-diagnostics", params);
                  }
                }
              }
            }
            LspMessageKind::Ignored => {}
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
  let replaced = {
    let mut map = match ACTIVE_SERVERS.lock() {
      Ok(m) => m,
      Err(e) => {
        let _ = child.kill();
        let _ = child.wait();
        return Err(e.to_string());
      }
    };
    map.insert(lang_key, LspProcess {
      instance_id,
      server_name: server_name.clone(),
      child,
      writer,
      pending_requests,
    })
  };
  if let Some(mut old) = replaced {
    let _ = old.child.kill();
    let _ = old.child.wait();
  }

  let name_output = init_res
    .get("serverInfo")
    .and_then(|info| info.get("name"))
    .and_then(|n| n.as_str())
    .unwrap_or(&server_name);

  Ok(name_output.to_string())
}

#[tauri::command]
pub async fn lsp_send_request(
  lang: String,
  method: String,
  params: Value,
) -> Result<Value, String> {
  tauri::async_runtime::spawn_blocking(move || lsp_send_request_sync(lang, method, params))
    .await
    .map_err(|e| format!("LSP request task failed: {}", e))?
}

fn lsp_send_request_sync(
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

    assert!(!CUSTOM_LSP_PATHS.read().unwrap().contains_key("test_lang_invalid"));
    assert!(!ACTIVE_SERVERS.lock().unwrap().contains_key("test_lang_invalid"));
  }

  #[test]
  fn test_jsonrpc_classification_header_recovery_and_custom_pylsp_args() {
    // 1. Server -> client request with colliding id=1 must NOT resolve pending client request 1
    let server_req = serde_json::json!({
      "jsonrpc": "2.0",
      "id": 1,
      "method": "workspace/configuration",
      "params": {}
    });
    assert_eq!(classify_lsp_message(&server_req), LspMessageKind::ServerRequest);

    let client_resp = serde_json::json!({
      "jsonrpc": "2.0",
      "id": 1,
      "result": {"ok": true}
    });
    assert_eq!(classify_lsp_message(&client_resp), LspMessageKind::ClientResponse(1));

    let notif = serde_json::json!({
      "jsonrpc": "2.0",
      "method": "textDocument/publishDiagnostics",
      "params": {}
    });
    assert_eq!(classify_lsp_message(&notif), LspMessageKind::Notification);

    // 2. Non-UTF-8 header recovery still extracts Content-Length
    let mut raw: &[u8] = b"X-Garbage: \xFF\xFE\r\nContent-Length: 42\r\n\r\n";
    assert_eq!(read_next_content_length(&mut raw).unwrap(), Some(42));

    // 3. Relative custom path rejected; custom pylsp path omits --stdio
    assert!(validate_custom_lsp_path("relative/bin/pylsp.exe").is_err());

    struct CustomPathGuard(&'static str);
    impl Drop for CustomPathGuard {
      fn drop(&mut self) {
        let _ = lsp_set_server_path(self.0.to_string(), None);
      }
    }

    let tmp = TempLspDir::new("pylsp_args");
    let pylsp_exe = tmp.0.join("pylsp.exe");
    std::fs::write(&pylsp_exe, b"MZ").unwrap();
    // Temporarily configure "python" and guarantee cleanup on unwind
    lsp_set_server_path("python".into(), Some(pylsp_exe.to_string_lossy().into())).unwrap();
    let _path_guard = CustomPathGuard("python");
    let (resolved, args) = find_lsp_executable("python").unwrap();
    assert_eq!(resolved, pylsp_exe.to_string_lossy());
    assert!(args.is_empty(), "pylsp must not receive --stdio: {:?}", args);
  }
}
