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

static DAP_REQUEST_COUNTER: AtomicU64 = AtomicU64::new(1);
static DAP_INSTANCE_COUNTER: AtomicU64 = AtomicU64::new(1);
const MAX_DAP_CONTENT_LENGTH: usize = 16 * 1024 * 1024;
const MAX_DAP_HEADER_LINE_BYTES: usize = 64 * 1024;

struct DapSession {
  instance_id: u64,
  child: Child,
  writer: Arc<Mutex<Box<dyn Write + Send>>>,
  pending_requests: Arc<Mutex<HashMap<u64, Sender<Result<Value, String>>>>>,
  current_thread_id: Arc<AtomicU64>,
}

static ACTIVE_DAP_SESSIONS: LazyLock<Mutex<HashMap<String, DapSession>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn stop_all_dap_sessions() {
  let drained: Vec<DapSession> = if let Ok(mut map) = ACTIVE_DAP_SESSIONS.lock() {
    map.drain().map(|(_id, s)| s).collect()
  } else {
    Vec::new()
  };
  for mut sess in drained {
    let _ = sess.child.kill();
    let _ = sess.child.wait();
  }
}

fn get_dap_session_handles(
  session_id: &str,
) -> Result<(Arc<Mutex<Box<dyn Write + Send>>>, Arc<Mutex<HashMap<u64, Sender<Result<Value, String>>>>>, Arc<AtomicU64>), String> {
  let map = ACTIVE_DAP_SESSIONS.lock().map_err(|e| e.to_string())?;
  let session = map.get(session_id).ok_or_else(|| "Session not found".to_string())?;
  Ok((
    Arc::clone(&session.writer),
    Arc::clone(&session.pending_requests),
    Arc::clone(&session.current_thread_id),
  ))
}

fn write_dap_message(writer: &mut dyn Write, msg: &Value) -> Result<(), String> {
  let json_str = serde_json::to_string(msg).map_err(|e| e.to_string())?;
  let content = format!("Content-Length: {}\r\n\r\n{}", json_str.len(), json_str);
  writer.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
  writer.flush().map_err(|e| e.to_string())?;
  Ok(())
}

fn send_dap_request_internal(
  writer: &Arc<Mutex<Box<dyn Write + Send>>>,
  pending_requests: &Arc<Mutex<HashMap<u64, Sender<Result<Value, String>>>>>,
  command: &str,
  arguments: Value,
) -> Result<Value, String> {
  let seq = DAP_REQUEST_COUNTER.fetch_add(1, Ordering::SeqCst);
  let (tx, rx) = channel();

  {
    let mut pending = pending_requests.lock().map_err(|e| e.to_string())?;
    pending.insert(seq, tx);
  }

  let req = serde_json::json!({
    "seq": seq,
    "type": "request",
    "command": command,
    "arguments": arguments,
  });

  let write_res = {
    let mut w = writer.lock().map_err(|e| e.to_string())?;
    write_dap_message(&mut **w, &req)
  };
  if let Err(e) = write_res {
    if let Ok(mut pending) = pending_requests.lock() {
      pending.remove(&seq);
    }
    return Err(e);
  }

  match rx.recv_timeout(Duration::from_secs(5)) {
    Ok(Ok(val)) => Ok(val),
    Ok(Err(e)) => Err(e),
    Err(_) => {
      if let Ok(mut pending) = pending_requests.lock() {
        pending.remove(&seq);
      }
      Err(format!("DAP command '{}' timed out", command))
    }
  }
}

fn validate_dap_frame_size(len: usize) -> Result<(), String> {
  if len > MAX_DAP_CONTENT_LENGTH {
    Err("DAP message exceeded maximum size limit".to_string())
  } else {
    Ok(())
  }
}

fn find_debugger_executable(debug_type: &str) -> Result<(String, Vec<String>), String> {
  let dt = debug_type.to_lowercase();
  match dt.as_str() {
    "python" | "py" => Ok((
      "python".to_string(),
      vec!["-m".to_string(), "debugpy.adapter".to_string()],
    )),
    "lldb" | "rust" | "cpp" | "c" => {
      #[cfg(windows)]
      {
        Ok(("lldb-dap.exe".to_string(), vec![]))
      }
      #[cfg(not(windows))]
      {
        Ok(("lldb-dap".to_string(), vec![]))
      }
    }
    "node" | "javascript" | "typescript" | "js" | "ts" => Err(
      "JavaScript/TypeScript debugging requires a DAP adapter (js-debug); bare Node REPL is not supported."
        .to_string(),
    ),
    other => Err(format!("Unsupported debug type '{}'", other)),
  }
}

fn remove_exited_dap_session(session_id: &str, instance_id: u64) {
  let removed = if let Ok(mut map) = ACTIVE_DAP_SESSIONS.lock() {
    if map.get(session_id).is_some_and(|s| s.instance_id == instance_id) {
      map.remove(session_id)
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
pub async fn dap_start_session(
  app: tauri::AppHandle,
  session_id: String,
  program: String,
  args: Vec<String>,
  cwd: Option<String>,
  debug_type: String,
) -> Result<String, String> {
  tauri::async_runtime::spawn_blocking(move || {
    dap_start_session_sync(app, session_id, program, args, cwd, debug_type)
  })
  .await
  .map_err(|e| format!("DAP start task failed: {}", e))?
}

fn dap_start_session_sync(
  app: tauri::AppHandle,
  session_id: String,
  program: String,
  args: Vec<String>,
  cwd: Option<String>,
  debug_type: String,
) -> Result<String, String> {
  let _ = dap_stop(session_id.clone());

  let work_dir = cwd.unwrap_or_else(|| ".".to_string());
  if !std::path::Path::new(&work_dir).is_dir() {
    return Err(format!("Debugger working directory does not exist: {}", work_dir));
  }
  let (exe, dap_args) = find_debugger_executable(&debug_type)?;

  let mut cmd = Command::new(&exe);
  cmd.args(&dap_args);
  cmd.current_dir(&work_dir);
  cmd.stdin(Stdio::piped());
  cmd.stdout(Stdio::piped());
  cmd.stderr(Stdio::null());

  #[cfg(windows)]
  cmd.creation_flags(0x08000000);

  let mut child = cmd
    .spawn()
    .map_err(|e| format!("Failed to spawn DAP adapter '{}': {}", exe, e))?;

  let stdin = match child.stdin.take() {
    Some(s) => s,
    None => {
      let _ = child.kill();
      let _ = child.wait();
      return Err("Failed to open DAP stdin".to_string());
    }
  };
  let stdout = match child.stdout.take() {
    Some(s) => s,
    None => {
      let _ = child.kill();
      let _ = child.wait();
      return Err("Failed to open DAP stdout".to_string());
    }
  };

  let instance_id = DAP_INSTANCE_COUNTER.fetch_add(1, Ordering::SeqCst);
  let writer: Arc<Mutex<Box<dyn Write + Send>>> = Arc::new(Mutex::new(Box::new(stdin)));
  let pending_requests: Arc<Mutex<HashMap<u64, Sender<Result<Value, String>>>>> = Arc::new(Mutex::new(HashMap::new()));
  let current_thread_id = Arc::new(AtomicU64::new(1));
  let (init_tx, init_rx) = channel::<()>();
  let init_signal = Arc::new(Mutex::new(Some(init_tx)));

  let app_clone = app.clone();
  let pending_clone = pending_requests.clone();
  let sess_id_clone = session_id.clone();
  let thread_id_clone = current_thread_id.clone();
  let init_signal_clone = init_signal.clone();

  // Background thread parsing DAP JSON messages from stdout
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
      let mut header_buf: Vec<u8> = Vec::with_capacity(128);
      let mut content_length: Option<usize> = None;

      loop {
        header_buf.clear();
        match reader.read_until(b'\n', &mut header_buf) {
          Ok(0) | Err(_) => {
            drain_pending("DAP adapter disconnected");
            remove_exited_dap_session(&sess_id_clone, instance_id);
            return;
          }
          Ok(_) => {
            if header_buf.len() > MAX_DAP_HEADER_LINE_BYTES {
              drain_pending("DAP header line exceeded limit");
              remove_exited_dap_session(&sess_id_clone, instance_id);
              return;
            }
            let line = String::from_utf8_lossy(&header_buf);
            let trimmed = line.trim();
            if trimmed.is_empty() {
              break;
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

      if let Some(len) = content_length {
        if validate_dap_frame_size(len).is_err() {
          drain_pending("DAP message exceeded maximum size limit");
          remove_exited_dap_session(&sess_id_clone, instance_id);
          return;
        }
        let mut body_buf = vec![0u8; len];
        if reader.read_exact(&mut body_buf).is_err() {
          drain_pending("DAP adapter stream ended unexpectedly");
          remove_exited_dap_session(&sess_id_clone, instance_id);
          return;
        }
        if let Ok(val) = serde_json::from_slice::<Value>(&body_buf) {
            let msg_type = val.get("type").and_then(|t| t.as_str()).unwrap_or("");

            if msg_type == "response" {
              if let Some(req_seq) = val.get("request_seq").and_then(|s| s.as_u64()) {
                let mut map = match pending_clone.lock() {
                  Ok(m) => m,
                  Err(_) => continue,
                };
                if let Some(tx) = map.remove(&req_seq) {
                  let success = val.get("success").and_then(|s| s.as_bool()).unwrap_or(true);
                  if success {
                    let body = val.get("body").cloned().unwrap_or(Value::Null);
                    let _ = tx.send(Ok(body));
                  } else {
                    let err_msg = val.get("message").and_then(|m| m.as_str()).unwrap_or("DAP request failed");
                    let _ = tx.send(Err(err_msg.to_string()));
                  }
                  continue;
                }
              }
            } else if msg_type == "event" {
              let event_name = val.get("event").and_then(|e| e.as_str()).unwrap_or("");
              let body = val.get("body").cloned().unwrap_or(Value::Null);

              if event_name == "initialized" {
                if let Ok(mut slot) = init_signal_clone.lock() {
                  if let Some(tx) = slot.take() {
                    let _ = tx.send(());
                  }
                }
              } else if event_name == "stopped" {
                if let Some(tid) = body.get("threadId").and_then(|t| t.as_u64()) {
                  thread_id_clone.store(tid, Ordering::SeqCst);
                }
                let _ = app_clone.emit("dap-stopped", serde_json::json!({
                  "session_id": sess_id_clone,
                  "body": body,
                }));
              } else if event_name == "continued" {
                let _ = app_clone.emit("dap-continued", serde_json::json!({
                  "session_id": sess_id_clone,
                }));
              } else if event_name == "terminated" || event_name == "exited" {
                let _ = app_clone.emit("dap-terminated", serde_json::json!({
                  "session_id": sess_id_clone,
                }));
              } else if event_name == "output" {
                let _ = app_clone.emit("dap-output", serde_json::json!({
                  "session_id": sess_id_clone,
                  "output": body.get("output").and_then(|o| o.as_str()).unwrap_or(""),
                }));
              }
            }
        }
      }
    }
  });

  // 1. Send initialize request and wait for response
  let init_res = match send_dap_request_internal(
    &writer,
    &pending_requests,
    "initialize",
    serde_json::json!({
      "clientID": "custom-idea",
      "clientName": "Custom IDEA",
      "adapterID": debug_type,
      "linesStartAt1": true,
      "columnsStartAt1": true,
      "pathFormat": "path",
    }),
  ) {
    Ok(v) => v,
    Err(err) => {
      let _ = child.kill();
      let _ = child.wait();
      return Err(format!("DAP initialize failed: {}", err));
    }
  };
  let supports_config_done = init_res
    .get("supportsConfigurationDoneRequest")
    .and_then(|v| v.as_bool())
    .or_else(|| {
      init_res
        .get("capabilities")
        .and_then(|c| c.get("supportsConfigurationDoneRequest"))
        .and_then(|v| v.as_bool())
    })
    .unwrap_or(true);

  // 2. Send launch request asynchronously so we can handle `initialized` -> `configurationDone` without deadlocking
  let launch_seq = DAP_REQUEST_COUNTER.fetch_add(1, Ordering::SeqCst);
  let (launch_tx, launch_rx) = channel();
  {
    let mut pending = pending_requests.lock().map_err(|e| e.to_string())?;
    pending.insert(launch_seq, launch_tx);
  }
  let launch_req = serde_json::json!({
    "seq": launch_seq,
    "type": "request",
    "command": "launch",
    "arguments": {
      "program": program,
      "args": args,
      "cwd": work_dir,
      "stopOnEntry": false,
    },
  });
  let write_launch_res = {
    let mut w = writer.lock().map_err(|e| e.to_string())?;
    write_dap_message(&mut **w, &launch_req)
  };
  if let Err(err) = write_launch_res {
    if let Ok(mut pending) = pending_requests.lock() {
      pending.remove(&launch_seq);
    }
    let _ = child.kill();
    let _ = child.wait();
    return Err(format!("DAP launch write failed: {}", err));
  }

  // 3. Wait for `initialized` event (bounded 3s) while watching `launch` for early response/failure
  let wait_start = std::time::Instant::now();
  let mut launch_result: Option<Result<Value, String>> = None;
  let mut got_initialized = false;
  while wait_start.elapsed() < Duration::from_secs(3) {
    if init_rx.try_recv().is_ok() {
      got_initialized = true;
      break;
    }
    match launch_rx.try_recv() {
      Ok(res) => {
        launch_result = Some(res);
        // Check once briefly in case `initialized` was emitted alongside `launch` response
        if init_rx.recv_timeout(Duration::from_millis(100)).is_ok() {
          got_initialized = true;
        }
        break;
      }
      Err(std::sync::mpsc::TryRecvError::Disconnected) => {
        launch_result = Some(Err("DAP adapter disconnected during launch".to_string()));
        break;
      }
      Err(std::sync::mpsc::TryRecvError::Empty) => {
        std::thread::sleep(Duration::from_millis(20));
      }
    }
  }

  // 4. Send `configurationDone` when initialized (or if adapter supports it and launch succeeded without early error)
  if got_initialized && supports_config_done {
    if let Err(err) = send_dap_request_internal(
      &writer,
      &pending_requests,
      "configurationDone",
      serde_json::json!({}),
    ) {
      let _ = child.kill();
      let _ = child.wait();
      return Err(format!("DAP configurationDone failed: {}", err));
    }
  }

  // 5. Ensure launch completed cleanly
  let final_launch = match launch_result {
    Some(r) => r,
    None => match launch_rx.recv_timeout(Duration::from_secs(5)) {
      Ok(r) => r,
      Err(_) => {
        if let Ok(mut pending) = pending_requests.lock() {
          pending.remove(&launch_seq);
        }
        Err("DAP command 'launch' timed out".to_string())
      }
    },
  };
  if let Err(err) = final_launch {
    let _ = child.kill();
    let _ = child.wait();
    return Err(format!("DAP launch failed: {}", err));
  }

  // Store active session (kill/wait child if map lock fails; reap any replaced session)
  let replaced = match ACTIVE_DAP_SESSIONS.lock() {
    Ok(mut map) => map.insert(session_id.clone(), DapSession {
      instance_id,
      child,
      writer,
      pending_requests,
      current_thread_id,
    }),
    Err(e) => {
      let _ = child.kill();
      let _ = child.wait();
      return Err(e.to_string());
    }
  };
  if let Some(mut old) = replaced {
    let _ = old.child.kill();
    let _ = old.child.wait();
  }

  Ok(format!("DAP session '{}' running with {}", session_id, exe))
}

#[tauri::command]
pub async fn dap_set_breakpoints(
  session_id: String,
  file_path: String,
  lines: Vec<usize>,
) -> Result<Vec<usize>, String> {
  tauri::async_runtime::spawn_blocking(move || dap_set_breakpoints_sync(session_id, file_path, lines))
    .await
    .map_err(|e| format!("DAP breakpoints task failed: {}", e))?
}

fn extract_verified_breakpoint_lines(res: &Value) -> Vec<usize> {
  if let Some(arr) = res.get("breakpoints").and_then(|b| b.as_array()) {
    arr
      .iter()
      .filter(|b| b.get("verified").and_then(|v| v.as_bool()).unwrap_or(false))
      .filter_map(|b| b.get("line").and_then(|l| l.as_u64()).map(|l| l as usize))
      .collect()
  } else {
    Vec::new()
  }
}

fn dap_set_breakpoints_sync(
  session_id: String,
  file_path: String,
  lines: Vec<usize>,
) -> Result<Vec<usize>, String> {
  let (writer, pending_requests, _) = get_dap_session_handles(&session_id)?;

  let bp_items: Vec<Value> = lines.iter().map(|l| serde_json::json!({ "line": l })).collect();

  let res = send_dap_request_internal(
    &writer,
    &pending_requests,
    "setBreakpoints",
    serde_json::json!({
      "source": { "path": file_path },
      "breakpoints": bp_items,
    }),
  )?;

  Ok(extract_verified_breakpoint_lines(&res))
}

#[tauri::command]
pub async fn dap_continue(session_id: String) -> Result<(), String> {
  tauri::async_runtime::spawn_blocking(move || {
    let (writer, pending_requests, current_thread_id) = get_dap_session_handles(&session_id)?;
    let thread_id = current_thread_id.load(Ordering::SeqCst);

    send_dap_request_internal(
      &writer,
      &pending_requests,
      "continue",
      serde_json::json!({ "threadId": thread_id }),
    )?;
    Ok(())
  })
  .await
  .map_err(|e| format!("DAP continue task failed: {}", e))?
}

#[tauri::command]
pub async fn dap_step_over(session_id: String) -> Result<(), String> {
  tauri::async_runtime::spawn_blocking(move || {
    let (writer, pending_requests, current_thread_id) = get_dap_session_handles(&session_id)?;
    let thread_id = current_thread_id.load(Ordering::SeqCst);

    send_dap_request_internal(
      &writer,
      &pending_requests,
      "next",
      serde_json::json!({ "threadId": thread_id }),
    )?;
    Ok(())
  })
  .await
  .map_err(|e| format!("DAP step_over task failed: {}", e))?
}

#[tauri::command]
pub async fn dap_step_into(session_id: String) -> Result<(), String> {
  tauri::async_runtime::spawn_blocking(move || {
    let (writer, pending_requests, current_thread_id) = get_dap_session_handles(&session_id)?;
    let thread_id = current_thread_id.load(Ordering::SeqCst);

    send_dap_request_internal(
      &writer,
      &pending_requests,
      "stepIn",
      serde_json::json!({ "threadId": thread_id }),
    )?;
    Ok(())
  })
  .await
  .map_err(|e| format!("DAP step_into task failed: {}", e))?
}

#[tauri::command]
pub async fn dap_step_out(session_id: String) -> Result<(), String> {
  tauri::async_runtime::spawn_blocking(move || {
    let (writer, pending_requests, current_thread_id) = get_dap_session_handles(&session_id)?;
    let thread_id = current_thread_id.load(Ordering::SeqCst);

    send_dap_request_internal(
      &writer,
      &pending_requests,
      "stepOut",
      serde_json::json!({ "threadId": thread_id }),
    )?;
    Ok(())
  })
  .await
  .map_err(|e| format!("DAP step_out task failed: {}", e))?
}

#[tauri::command]
pub async fn dap_pause(session_id: String) -> Result<(), String> {
  tauri::async_runtime::spawn_blocking(move || {
    let (writer, pending_requests, current_thread_id) = get_dap_session_handles(&session_id)?;
    let thread_id = current_thread_id.load(Ordering::SeqCst);

    send_dap_request_internal(
      &writer,
      &pending_requests,
      "pause",
      serde_json::json!({ "threadId": thread_id }),
    )?;
    Ok(())
  })
  .await
  .map_err(|e| format!("DAP pause task failed: {}", e))?
}

#[tauri::command]
pub fn dap_stop(session_id: String) -> Result<(), String> {
  let removed = {
    let mut map = ACTIVE_DAP_SESSIONS.lock().map_err(|e| e.to_string())?;
    map.remove(&session_id)
  };
  if let Some(mut session) = removed {
    // Best-effort non-blocking disconnect notification before killing process
    if let Ok(mut w) = session.writer.lock() {
      let seq = DAP_REQUEST_COUNTER.fetch_add(1, Ordering::SeqCst);
      let req = serde_json::json!({
        "seq": seq,
        "type": "request",
        "command": "disconnect",
        "arguments": { "terminateDebuggee": true },
      });
      let _ = write_dap_message(&mut **w, &req);
    }
    let _ = session.child.kill();
    let _ = session.child.wait();
  }
  Ok(())
}

#[tauri::command]
pub async fn dap_get_stack_trace(session_id: String) -> Result<Vec<Value>, String> {
  tauri::async_runtime::spawn_blocking(move || {
    let (writer, pending_requests, current_thread_id) = get_dap_session_handles(&session_id)?;
    let thread_id = current_thread_id.load(Ordering::SeqCst);

    let res = send_dap_request_internal(
      &writer,
      &pending_requests,
      "stackTrace",
      serde_json::json!({
        "threadId": thread_id,
        "startFrame": 0,
        "levels": 20,
      }),
    )?;

    if let Some(frames) = res.get("stackFrames").and_then(|f| f.as_array()) {
      Ok(frames.clone())
    } else {
      Ok(Vec::new())
    }
  })
  .await
  .map_err(|e| format!("DAP stack_trace task failed: {}", e))?
}

#[tauri::command]
pub async fn dap_get_scopes(session_id: String, frame_id: usize) -> Result<Vec<Value>, String> {
  tauri::async_runtime::spawn_blocking(move || {
    let (writer, pending_requests, _) = get_dap_session_handles(&session_id)?;

    let res = send_dap_request_internal(
      &writer,
      &pending_requests,
      "scopes",
      serde_json::json!({ "frameId": frame_id }),
    )?;

    if let Some(scopes) = res.get("scopes").and_then(|s| s.as_array()) {
      Ok(scopes.clone())
    } else {
      Ok(Vec::new())
    }
  })
  .await
  .map_err(|e| format!("DAP scopes task failed: {}", e))?
}

#[tauri::command]
pub async fn dap_get_variables(session_id: String, variables_reference: usize) -> Result<Vec<Value>, String> {
  tauri::async_runtime::spawn_blocking(move || {
    let (writer, pending_requests, _) = get_dap_session_handles(&session_id)?;

    let res = send_dap_request_internal(
      &writer,
      &pending_requests,
      "variables",
      serde_json::json!({ "variablesReference": variables_reference }),
    )?;

    if let Some(vars) = res.get("variables").and_then(|v| v.as_array()) {
      Ok(vars.clone())
    } else {
      Ok(Vec::new())
    }
  })
  .await
  .map_err(|e| format!("DAP variables task failed: {}", e))?
}

#[tauri::command]
pub async fn dap_evaluate(session_id: String, expression: String, frame_id: Option<usize>) -> Result<Value, String> {
  tauri::async_runtime::spawn_blocking(move || {
    let (writer, pending_requests, _) = get_dap_session_handles(&session_id)?;

    let mut args = serde_json::json!({
      "expression": expression,
      "context": "repl",
    });
    if let Some(fid) = frame_id {
      args["frameId"] = serde_json::json!(fid);
    }

    send_dap_request_internal(
      &writer,
      &pending_requests,
      "evaluate",
      args,
    )
  })
  .await
  .map_err(|e| format!("DAP evaluate task failed: {}", e))?
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_find_debugger_executable() {
    let (py_cmd, py_args) = find_debugger_executable("python").unwrap();
    assert_eq!(py_cmd, "python");
    assert_eq!(py_args, vec!["-m", "debugpy.adapter"]);
    assert!(find_debugger_executable("PY").is_ok());

    let (rust_cmd, _) = find_debugger_executable("rust").unwrap();
    assert!(rust_cmd.starts_with("lldb-dap"));
    assert!(find_debugger_executable("lldb").is_ok());

    for js_type in ["node", "js", "ts", "javascript", "typescript"] {
      let err = find_debugger_executable(js_type).unwrap_err();
      assert!(err.contains("js-debug"), "expected js-debug guidance for {}", js_type);
    }

    let unknown_err = find_debugger_executable("ruby").unwrap_err();
    assert!(unknown_err.contains("Unsupported debug type"));
  }

  #[test]
  fn test_validate_dap_frame_size() {
    assert!(validate_dap_frame_size(0).is_ok());
    assert!(validate_dap_frame_size(MAX_DAP_CONTENT_LENGTH).is_ok());
    let err = validate_dap_frame_size(MAX_DAP_CONTENT_LENGTH + 1).unwrap_err();
    assert!(err.contains("maximum size limit"));
  }

  #[test]
  fn test_extract_verified_breakpoint_lines_filters_unverified_and_empty() {
    let empty = serde_json::json!({});
    assert!(extract_verified_breakpoint_lines(&empty).is_empty());

    let none_verified = serde_json::json!({
      "breakpoints": [
        { "line": 10, "verified": false },
        { "line": 20 }
      ]
    });
    assert!(extract_verified_breakpoint_lines(&none_verified).is_empty());

    let mixed = serde_json::json!({
      "breakpoints": [
        { "line": 5, "verified": false },
        { "line": 12, "verified": true },
        { "line": 25, "verified": true }
      ]
    });
    assert_eq!(extract_verified_breakpoint_lines(&mixed), vec![12, 25]);
  }
}

