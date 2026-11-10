pub use ide_vfs as vfs;
pub use ide_terminal as pty;
pub use ide_run as process;
pub use ide_vcs as git;
pub use ide_lsp as lsp;
pub use ide_dap as dap;
pub use ide_db as db;
pub use ide_http as http;
pub use ide_index as index;
pub use ide_docker as docker;
pub use ide_coverage as coverage;

pub mod window;
pub mod commands;
pub mod updater;
pub mod profiler;
pub mod secrets;

pub fn cleanup_ide_subsystems() {
  let _ = process::stop_all_processes();
  pty::kill_all_pty_sessions();
  lsp::stop_all_lsp_servers();
  dap::stop_all_dap_sessions();
}

pub fn run() {
  tauri::Builder::default()
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { .. } = event {
        let log_path = std::env::temp_dir().join("ide_exit_reason.log");
        let _ = std::fs::write(log_path, format!("CloseRequested event received on window: {}\n", window.label()));
        log::info!("CloseRequested event received on window: {}", window.label());
        use tauri::Manager;
        let app = window.app_handle();
        let windows = app.webview_windows();
        if windows.len() <= 1 {
          cleanup_ide_subsystems();
          std::process::exit(0);
        }
      }
    })
    .invoke_handler(commands::get_ipc_handler())
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
