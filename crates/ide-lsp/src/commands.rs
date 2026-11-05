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

struct LspProcess {
  server_name: String,
  child: Child,
  writer: Arc<Mutex<Box<dyn Write + Send>>>,
  pending_requests: Arc<Mutex<HashMap<u64, Sender<Result<Value, String>>>>>,
}

static ACTIVE_SERVERS: LazyLock<Mutex<HashMap<String, LspProcess>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn stop_all_lsp_servers() {
  if let Ok(mut map) = ACTIVE_SERVERS.lock() {
    for (_lang, mut proc) in map.drain() {
      let _ = proc.child.kill();
    }
  }
}

fn write_jsonrpc_message(writer: &mut dyn Write, msg: &Value) -> Result<(), String> {
  let json_str = serde_json::to_string(msg).map_err(|e| e.to_string())?;
  let content = format!("Content-Length: {}\r\n\r\n{}", json_str.len(), json_str);
  writer.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
  writer.flush().map_err(|e| e.to_string())?;
  Ok(())
}

static CUSTOM_LSP_PATHS: LazyLock<std::sync::RwLock<HashMap<String, String>>> = LazyLock::new(|| std::sync::RwLock::new(HashMap::new()));

fn find_lsp_executable(lang: &str) -> Option<(String, Vec<String>)> {
  let lang_lower = lang.to_lowercase();

  #[cfg(windows)]
  let check_cmd = |exe: &str| -> bool {
    let mut cmd = Command::new("where.exe");
    cmd.arg(exe);
    cmd.creation_flags(0x08000000);
    cmd.output().map(|o| o.status.success()).unwrap_or(false)
  };

  #[cfg(not(windows))]
  let check_cmd = |exe: &str| -> bool {
    let mut cmd = Command::new("which");
    cmd.arg(exe);
    cmd.output().map(|o| o.status.success()).unwrap_or(false)
  };

  // Check custom configured path first
  if let Ok(guard) = CUSTOM_LSP_PATHS.read() {
    if let Some(custom_path) = guard.get(&lang_lower) {
      let p = std::path::Path::new(custom_path);
      if p.exists() || check_cmd(custom_path) {
        let args = match lang_lower.as_str() {
          "typescript" | "javascript" | "ts" | "js" | "tsx" | "jsx" | "python" | "py" => vec!["--stdio".to_string()],
          _ => vec![],
        };
        return Some((custom_path.clone(), args));
      }
    }
  }

  match lang_lower.as_str() {
    "rust" | "rs" => {
      if check_cmd("rust-analyzer") {
        Some(("rust-analyzer".to_string(), vec![]))
      } else {
        None
      }
    }
    "typescript" | "javascript" | "ts" | "js" | "tsx" | "jsx" => {
      if check_cmd("typescript-language-server") {
        Some(("typescript-language-server".to_string(), vec!["--stdio".to_string()]))
      } else if check_cmd("vtsls") {
        Some(("vtsls".to_string(), vec!["--stdio".to_string()]))
      } else {
        None
      }
    }
    "python" | "py" => {
      if check_cmd("pyright-langserver") {
        Some(("pyright-langserver".to_string(), vec!["--stdio".to_string()]))
      } else if check_cmd("pylsp") {
        Some(("pylsp".to_string(), vec![]))
      } else {
        None
      }
    }
    "go" => {
      if check_cmd("gopls") {
        Some(("gopls".to_string(), vec![]))
      } else {
        None
      }
    }
    "c" | "cpp" | "c++" => {
      if check_cmd("clangd") {
        Some(("clangd".to_string(), vec![]))
      } else {
        None
      }
    }
    "java" => {
      if check_cmd("jdtls") {
        Some(("jdtls".to_string(), vec![]))
      } else {
        None
      }
    }
    _ => None,
  }
}

#[tauri::command]
pub fn lsp_set_server_path(lang: String, custom_path: Option<String>) -> Result<(), String> {
  if let Ok(mut guard) = CUSTOM_LSP_PATHS.write() {
    let lang_lower = lang.to_lowercase();
    if let Some(p) = custom_path {
      if p.trim().is_empty() {
        guard.remove(&lang_lower);
      } else {
        guard.insert(lang_lower, p.trim().to_string());
      }
    } else {
      guard.remove(&lang_lower);
    }
  }
  Ok(())
}

#[tauri::command]
pub fn lsp_start_server(
  app: tauri::AppHandle,
  lang: String,
  project_path: String,
) -> Result<String, String> {
  let lang_key = lang.to_lowercase();

  // If already active, return success
  {
    let map = ACTIVE_SERVERS.lock().map_err(|e| e.to_string())?;
    if let Some(proc) = map.get(&lang_key) {
      return Ok(format!("Active: {}", proc.server_name));
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
  let stdin = child.stdin.take().ok_or_else(|| "Failed to open LSP stdin".to_string())?;
  let stdout = child.stdout.take().ok_or_else(|| "Failed to open LSP stdout".to_string())?;

  let writer: Arc<Mutex<Box<dyn Write + Send>>> = Arc::new(Mutex::new(Box::new(stdin)));
  let pending_requests: Arc<Mutex<HashMap<u64, Sender<Result<Value, String>>>>> = Arc::new(Mutex::new(HashMap::new()));

  let app_clone = app.clone();
  let pending_clone = pending_requests.clone();
  let server_name = exe.clone();

  // Background thread parsing JSON-RPC messages from LSP stdout
  std::thread::spawn(move || {
    let mut reader = BufReader::new(stdout);
    loop {
      let mut line = String::new();
      let mut content_length: Option<usize> = None;

      // Read header lines until empty line
      loop {
        line.clear();
        match reader.read_line(&mut line) {
          Ok(0) => return, // EOF
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
          Err(_) => return,
        }
      }

      if let Some(len) = content_length {
        let mut body_buf = vec![0u8; len];
        if reader.read_exact(&mut body_buf).is_ok() {
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
    }
  });

  // Store active process
  {
    let mut map = ACTIVE_SERVERS.lock().map_err(|e| e.to_string())?;
    map.insert(lang_key.clone(), LspProcess {
      server_name: server_name.clone(),
      child,
      writer: writer.clone(),
      pending_requests: pending_requests.clone(),
    });
  }

  // Send initialize request
  let init_id = REQUEST_COUNTER.fetch_add(1, Ordering::SeqCst);
  let root_uri = format!("file:///{}", project_path.replace('\\', "/"));

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

  {
    let mut w = writer.lock().map_err(|e| e.to_string())?;
    write_jsonrpc_message(&mut **w, &init_req)?;
  }

  // Wait briefly for initialize response
  let init_res = match rx.recv_timeout(Duration::from_secs(5)) {
    Ok(Ok(res)) => res,
    Ok(Err(err)) => return Err(format!("LSP init error: {}", err)),
    Err(_) => return Err("LSP initialize timed out".to_string()),
  };

  // Send initialized notification
  let initialized_notif = serde_json::json!({
    "jsonrpc": "2.0",
    "method": "initialized",
    "params": {}
  });

  {
    let mut w = writer.lock().map_err(|e| e.to_string())?;
    write_jsonrpc_message(&mut **w, &initialized_notif)?;
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

  {
    let mut w = writer.lock().map_err(|e| e.to_string())?;
    write_jsonrpc_message(&mut **w, &req)?;
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
  let mut map = ACTIVE_SERVERS.lock().map_err(|e| e.to_string())?;
  if let Some(mut proc) = map.remove(&lang_key) {
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
