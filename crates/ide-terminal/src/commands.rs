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

  {
    match PTY_SESSIONS.lock() {
      Ok(mut map) => {
        map.insert(session_id.clone(), PtySession {
          instance_id,
          writer,
          master,
          child,
        });
      }
      Err(e) => {
        let _ = child.kill();
        let _ = child.wait();
        return Err(e.to_string());
      }
    }
  }

  let app_clone = app.clone();
  let s_id = session_id.clone();
  std::thread::spawn(move || {
    let mut buf = [0u8; 4096];
    let mut pending: Vec<u8> = Vec::with_capacity(8);

    let emit_utf8_chunk = |data: &[u8]| {
      if !data.is_empty() {
        let text = String::from_utf8_lossy(data).to_string();
        let _ = app_clone.emit("terminal-data", serde_json::json!({
          "session_id": s_id,
          "data": text
        }));
      }
    };

    loop {
      match reader.read(&mut buf) {
        Ok(0) => break,
        Ok(n) => {
          pending.extend_from_slice(&buf[..n]);
          loop {
            match std::str::from_utf8(&pending) {
              Ok(valid) => {
                if !valid.is_empty() {
                  let _ = app_clone.emit("terminal-data", serde_json::json!({
                    "session_id": s_id,
                    "data": valid
                  }));
                }
                pending.clear();
                break;
              }
              Err(err) => {
                let valid_up_to = err.valid_up_to();
                if valid_up_to > 0 {
                  if let Ok(valid) = std::str::from_utf8(&pending[..valid_up_to]) {
                    let _ = app_clone.emit("terminal-data", serde_json::json!({
                      "session_id": s_id,
                      "data": valid
                    }));
                  }
                  pending.drain(..valid_up_to);
                }
                if let Some(error_len) = err.error_len() {
                  emit_utf8_chunk(&pending[..error_len]);
                  pending.drain(..error_len);
                } else {
                  // Incomplete multi-byte UTF-8 sequence at read boundary; wait for next chunk
                  break;
                }
              }
            }
          }
        }
        Err(_) => break,
      }
    }

    if !pending.is_empty() {
      emit_utf8_chunk(&pending);
    }

    let removed_own = if let Ok(mut map) = PTY_SESSIONS.lock() {
      if map.get(&s_id).is_some_and(|s| s.instance_id == instance_id) {
        map.remove(&s_id)
      } else {
        None
      }
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
