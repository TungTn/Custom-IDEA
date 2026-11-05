// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  std::panic::set_hook(Box::new(|info| {
    let msg = format!("Panic: {:?}\n", info);
    let crash_path = std::env::temp_dir().join("ide_crash.log");
    let _ = std::fs::write(crash_path, &msg);
    eprintln!("{}", msg);
  }));
  app_lib::run();
}
