use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::{Deserialize, Serialize};
use tauri::Emitter;

static PTY_INSTANCE_COUNTER: AtomicU64 = AtomicU64::new(1);

pub struct PtySession {
  pub instance_id: u64,
  pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
  pub master: Arc<Mutex<Box<dyn portable_pty::MasterPty + Send>>>,
  pub child: Box<dyn portable_pty::Child + Send>,
}

pub static PTY_SESSIONS: LazyLock<Mutex<HashMap<String, PtySession>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn kill_all_pty_sessions() {
  let drained: Vec<PtySession> = if let Ok(mut map) = PTY_SESSIONS.lock() {
    map.drain().map(|(_id, s)| s).collect()
  } else {
    Vec::new()
  };
  for mut session in drained {
    let _ = session.child.kill();
    let _ = session.child.wait();
  }
}

/// Removes `session_id` only if the current map entry still belongs to `instance_id`
/// (prevents a closing reader thread from deleting a newer replacement session).
fn remove_session_if_owned(
  map: &mut HashMap<String, PtySession>,
  session_id: &str,
  instance_id: u64,
) -> Option<PtySession> {
  if map.get(session_id).is_some_and(|s| s.instance_id == instance_id) {
    map.remove(session_id)
  } else {
    None
  }
}

fn executable_exists_in_path(exe: &str) -> bool {
  let p = std::path::Path::new(exe);
  #[cfg(windows)]
  let exts: Vec<String> = if p.extension().is_some() {
    vec![String::new()]
  } else {
    std::env::var("PATHEXT")
      .unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".to_string())
      .split(';')
      .filter(|e| !e.is_empty())
      .map(|e| e.to_string())
      .collect()
  };
  #[cfg(not(windows))]
  let exts: Vec<String> = vec![String::new()];

  if p.components().count() > 1 || p.is_absolute() {
    return exts.iter().any(|ext| {
      let candidate = if ext.is_empty() {
        p.to_path_buf()
      } else {
        std::path::PathBuf::from(format!("{}{}", exe, ext))
      };
      candidate.is_file()
    });
  }
  if let Some(paths) = std::env::var_os("PATH") {
    for dir in std::env::split_paths(&paths) {
      for ext in &exts {
        if dir.join(format!("{}{}", exe, ext)).is_file() {
          return true;
        }
      }
    }
  }
  false
}

use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AvailableShell {
  pub id: String,
  pub name: String,
  pub command: String,
  pub is_available: bool,
}

#[tauri::command]
pub fn get_available_shells() -> Result<Vec<AvailableShell>, String> {
  let mut shells = Vec::new();

  #[cfg(windows)]
  {
    shells.push(AvailableShell {
      id: "powershell".into(),
      name: "PowerShell".into(),
      command: "powershell.exe".into(),
      is_available: executable_exists_in_path("powershell.exe"),
    });
    shells.push(AvailableShell {
      id: "cmd".into(),
      name: "Command Prompt".into(),
      command: "cmd.exe".into(),
      is_available: executable_exists_in_path("cmd.exe"),
    });

    let git_bash_path = if std::path::Path::new(r"C:\Program Files\Git\bin\bash.exe").is_file() {
      r"C:\Program Files\Git\bin\bash.exe".to_string()
    } else if std::path::Path::new(r"C:\Program Files (x86)\Git\bin\bash.exe").is_file() {
      r"C:\Program Files (x86)\Git\bin\bash.exe".to_string()
    } else {
      "bash.exe".to_string()
    };
    let git_bash_ok = executable_exists_in_path(&git_bash_path);
    shells.push(AvailableShell {
      id: "git-bash".into(),
      name: "Git Bash".into(),
      command: git_bash_path,
      is_available: git_bash_ok,
    });

    shells.push(AvailableShell {
      id: "wsl".into(),
      name: "WSL (Linux)".into(),
      command: "wsl.exe".into(),
      is_available: executable_exists_in_path("wsl.exe"),
    });
  }

  #[cfg(not(windows))]
  {
    let current_shell = std::env::var("SHELL").unwrap_or_else(|_| "bash".to_string());
    let shell_ok = executable_exists_in_path(&current_shell);
    shells.push(AvailableShell {
      id: "default".into(),
      name: "Default Shell".into(),
      command: current_shell,
      is_available: shell_ok,
    });
  }

  Ok(shells)
}

#[tauri::command]
pub fn terminal_kill(session_id: String) -> Result<(), String> {
  let removed = {
    let mut map = PTY_SESSIONS.lock().map_err(|e| e.to_string())?;
    map.remove(&session_id)
  };
  if let Some(mut session) = removed {
    let _ = session.child.kill();
    let _ = session.child.wait();
  }
  Ok(())
}

fn drain_utf8_chunks(pending_buf: &mut Vec<u8>, flush_incomplete_lossy: bool) -> Vec<String> {
  let mut out = Vec::new();
  loop {
    match std::str::from_utf8(pending_buf) {
      Ok(valid) => {
        if !valid.is_empty() {
          out.push(valid.to_string());
        }
        pending_buf.clear();
        break;
      }
      Err(err) => {
        let valid_up_to = err.valid_up_to();
        if valid_up_to > 0 {
          if let Ok(valid) = std::str::from_utf8(&pending_buf[..valid_up_to]) {
            out.push(valid.to_string());
          }
          pending_buf.drain(..valid_up_to);
        }
        if let Some(error_len) = err.error_len() {
          out.push(String::from_utf8_lossy(&pending_buf[..error_len]).to_string());
          pending_buf.drain(..error_len);
        } else if flush_incomplete_lossy {
          if !pending_buf.is_empty() {
            out.push(String::from_utf8_lossy(pending_buf).to_string());
            pending_buf.clear();
          }
          break;
        } else {
          // Incomplete multi-byte UTF-8 sequence at read boundary; wait for next chunk
          break;
        }
      }
    }
  }
  out
}

#[tauri::command]
pub fn terminal_spawn(
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
      if p.is_dir() {
        cmd.cwd(&p);
      }
    }
  }

  let mut child = pair
    .slave
    .spawn_command(cmd)
    .map_err(|e| format!("Failed to spawn shell '{}': {}", target_shell, e))?;
  drop(pair.slave);

  let mut reader = match pair.master.try_clone_reader() {
    Ok(r) => r,
    Err(e) => {
      let _ = child.kill();
      let _ = child.wait();
      return Err(format!("Failed to clone PTY reader: {}", e));
    }
  };
  let writer = match pair.master.take_writer() {
    Ok(w) => Arc::new(Mutex::new(w)),
    Err(e) => {
      let _ = child.kill();
      let _ = child.wait();
      return Err(format!("Failed to take PTY writer: {}", e));
    }
  };
  let master = Arc::new(Mutex::new(pair.master));
  let instance_id = PTY_INSTANCE_COUNTER.fetch_add(1, Ordering::SeqCst);

  let replaced = {
    match PTY_SESSIONS.lock() {
      Ok(mut map) => map.insert(session_id.clone(), PtySession {
        instance_id,
        writer,
        master,
        child,
      }),
      Err(e) => {
        let _ = child.kill();
        let _ = child.wait();
        return Err(e.to_string());
      }
    }
  };
  if let Some(mut old_session) = replaced {
    let _ = old_session.child.kill();
    let _ = old_session.child.wait();
  }

  let (tx, rx) = std::sync::mpsc::sync_channel::<Vec<u8>>(64);
  std::thread::spawn(move || {
    let mut buf = [0u8; 4096];
    loop {
      match reader.read(&mut buf) {
        Ok(0) | Err(_) => break,
        Ok(n) => {
          if tx.send(buf[..n].to_vec()).is_err() {
            break;
          }
        }
      }
    }
  });

  let app_clone = app.clone();
  let s_id = session_id.clone();
  std::thread::spawn(move || {
    const COALESCE_WINDOW: std::time::Duration = std::time::Duration::from_millis(16);
    const MAX_BATCH_BYTES: usize = 32 * 1024;

    let mut pending: Vec<u8> = Vec::with_capacity(8192);

    let emit_utf8_text = |text: String| {
      if !text.is_empty() {
        let _ = app_clone.emit("terminal-data", serde_json::json!({
          "session_id": s_id,
          "data": text
        }));
      }
    };

    loop {
      match rx.recv() {
        Ok(first_chunk) => {
          pending.extend_from_slice(&first_chunk);
          let deadline = std::time::Instant::now() + COALESCE_WINDOW;
          let mut disconnected = false;
          while pending.len() < MAX_BATCH_BYTES {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            if remaining.is_zero() {
              break;
            }
            match rx.recv_timeout(remaining) {
              Ok(more) => pending.extend_from_slice(&more),
              Err(std::sync::mpsc::RecvTimeoutError::Timeout) => break,
              Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                disconnected = true;
                break;
              }
            }
          }
          for text in drain_utf8_chunks(&mut pending, false) {
            emit_utf8_text(text);
          }
          if disconnected {
            break;
          }
        }
        Err(_) => break,
      }
    }

    for text in drain_utf8_chunks(&mut pending, true) {
      emit_utf8_text(text);
    }

    let removed_own = if let Ok(mut map) = PTY_SESSIONS.lock() {
      remove_session_if_owned(&mut map, &s_id, instance_id)
    } else {
      None
    };

    if let Some(mut sess) = removed_own {
      let _ = sess.child.wait();
      let _ = app_clone.emit("terminal-exit", serde_json::json!({
        "session_id": s_id
      }));
    }
  });

  Ok(())
}

#[tauri::command]
pub fn terminal_write(session_id: String, data: String) -> Result<(), String> {
  let writer = {
    let map = PTY_SESSIONS.lock().map_err(|e| e.to_string())?;
    map
      .get(&session_id)
      .map(|s| Arc::clone(&s.writer))
      .ok_or_else(|| format!("Session {} not found", session_id))?
  };
  let mut w = writer.lock().map_err(|e| e.to_string())?;
  w.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
  w.flush().map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
pub fn terminal_resize(session_id: String, cols: u16, rows: u16) -> Result<(), String> {
  let master = {
    let map = PTY_SESSIONS.lock().map_err(|e| e.to_string())?;
    map
      .get(&session_id)
      .map(|s| Arc::clone(&s.master))
      .ok_or_else(|| format!("Session {} not found", session_id))?
  };
  let m = master.lock().map_err(|e| e.to_string())?;
  m.resize(PtySize {
    rows,
    cols,
    pixel_width: 0,
    pixel_height: 0,
  })
  .map_err(|e| e.to_string())?;
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_drain_utf8_chunks_preserves_multibyte_boundaries() {
    let text = "xin chào 🚀";
    let bytes = text.as_bytes();
    let split = "xin ch".len() + 1; // inside 'à'

    let mut pending = Vec::new();
    pending.extend_from_slice(&bytes[..split]);
    let first = drain_utf8_chunks(&mut pending, false);
    assert_eq!(first.concat(), "xin ch");
    assert_eq!(pending.len(), 1);

    pending.extend_from_slice(&bytes[split..bytes.len() - 2]); // inside '🚀'
    let second = drain_utf8_chunks(&mut pending, false);
    assert_eq!(second.concat(), "ào ");
    assert_eq!(pending.len(), 2);

    pending.extend_from_slice(&bytes[bytes.len() - 2..]);
    let third = drain_utf8_chunks(&mut pending, false);
    assert_eq!(third.concat(), "🚀");
    assert!(pending.is_empty());

    // Invalid trailing byte flushed lossily at EOF
    pending.extend_from_slice(b"abc\xF0\x9F");
    let eof = drain_utf8_chunks(&mut pending, true);
    assert_eq!(eof[0], "abc");
    assert!(eof[1].contains('\u{FFFD}'));
    assert!(pending.is_empty());
  }

  #[test]
  fn test_executable_exists_in_path_and_session_replacement() {
    assert!(!executable_exists_in_path("definitely_nonexistent_shell_binary_9999"));
    #[cfg(windows)]
    assert!(executable_exists_in_path("cmd.exe"));

    struct PtyCleanupGuard;
    impl Drop for PtyCleanupGuard {
      fn drop(&mut self) {
        kill_all_pty_sessions();
      }
    }
    let _guard = PtyCleanupGuard;

    fn spawn_dummy_pty(instance_id: u64) -> PtySession {
      let pty_system = NativePtySystem::default();
      let pair = pty_system
        .openpty(PtySize {
          rows: 24,
          cols: 80,
          pixel_width: 0,
          pixel_height: 0,
        })
        .expect("openpty");
      #[cfg(windows)]
      let cmd = {
        let mut c = CommandBuilder::new("cmd.exe");
        c.args(["/c", "exit 0"]);
        c
      };
      #[cfg(not(windows))]
      let cmd = {
        let mut c = CommandBuilder::new("sh");
        c.args(["-c", "true"]);
        c
      };
      let child = pair.slave.spawn_command(cmd).expect("spawn dummy child");
      drop(pair.slave);
      let writer = pair.master.take_writer().expect("take_writer");
      PtySession {
        instance_id,
        writer: Arc::new(Mutex::new(writer)),
        master: Arc::new(Mutex::new(pair.master)),
        child,
      }
    }

    let id1 = PTY_INSTANCE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let id2 = PTY_INSTANCE_COUNTER.fetch_add(1, Ordering::Relaxed);
    assert!(id2 > id1);

    let session_key = "test_race_session".to_string();
    {
      let mut map = PTY_SESSIONS.lock().unwrap();
      let _replaced = map.insert(session_key.clone(), spawn_dummy_pty(id1));
      if let Some(mut old) = map.insert(session_key.clone(), spawn_dummy_pty(id2)) {
        let _ = old.child.kill();
        let _ = old.child.wait();
      }

      // Stale reader thread for `id1` must NOT remove replacement session `id2`
      assert!(remove_session_if_owned(&mut map, &session_key, id1).is_none());
      assert_eq!(map.get(&session_key).map(|s| s.instance_id), Some(id2));

      // Active owner `id2` DOES remove the session
      let mut owned = remove_session_if_owned(&mut map, &session_key, id2).expect("active owner removed");
      let _ = owned.child.kill();
      let _ = owned.child.wait();
      assert!(!map.contains_key(&session_key));

      // Non-empty map is drained and killed by kill_all_pty_sessions()
      let id3 = PTY_INSTANCE_COUNTER.fetch_add(1, Ordering::Relaxed);
      map.insert("test_kill_all_session".to_string(), spawn_dummy_pty(id3));
    }

    assert_eq!(PTY_SESSIONS.lock().unwrap().len(), 1);
    kill_all_pty_sessions();
    assert!(PTY_SESSIONS.lock().unwrap().is_empty());
  }
}
