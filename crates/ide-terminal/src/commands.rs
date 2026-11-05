use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{LazyLock, Mutex};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::{Deserialize, Serialize};
use tauri::Emitter;

pub struct PtySession {
  pub writer: Box<dyn Write + Send>,
  pub master: Box<dyn portable_pty::MasterPty + Send>,
  pub child: Box<dyn portable_pty::Child + Send>,
}

pub static PTY_SESSIONS: LazyLock<Mutex<HashMap<String, PtySession>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn kill_all_pty_sessions() {
  if let Ok(mut map) = PTY_SESSIONS.lock() {
    for (_id, mut session) in map.drain() {
      let _ = session.child.kill();
    }
  }
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
pub fn terminal_kill(session_id: String) -> Result<(), String> {
  let mut map = PTY_SESSIONS.lock().map_err(|e| e.to_string())?;
  if let Some(mut session) = map.remove(&session_id) {
    let _ = session.child.kill();
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
pub fn terminal_write(session_id: String, data: String) -> Result<(), String> {
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
pub fn terminal_resize(session_id: String, cols: u16, rows: u16) -> Result<(), String> {
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
