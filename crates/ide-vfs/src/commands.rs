use std::collections::HashMap;
use std::path::Path;
use std::sync::{LazyLock, Mutex};
use std::time::Duration;
use notify_debouncer_mini::{new_debouncer, DebouncedEvent, Debouncer};
use ropey::Rope;
use tauri::Emitter;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub static VFS_BUFFERS: LazyLock<Mutex<HashMap<String, Rope>>> = LazyLock::new(|| Mutex::new(HashMap::new()));
pub static FS_DEBOUNCER: LazyLock<Mutex<Option<Debouncer<notify::RecommendedWatcher>>>> = LazyLock::new(|| Mutex::new(None));

use ts_rs::TS;

#[derive(Debug, serde::Serialize, serde::Deserialize, TS)]
pub struct FileNodeDto {
  pub id: String,
  pub name: String,
  pub path: String,
  #[serde(rename = "isFolder")]
  pub is_folder: bool,
  pub children: Option<Vec<FileNodeDto>>,
  pub content: Option<String>,
  pub language: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, TS)]
pub struct SearchFileResultDto {
  pub name: String,
  pub path: String,
  pub relative_path: String,
  pub is_folder: bool,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, TS)]
pub struct SearchTextResultDto {
  pub file_name: String,
  pub file_path: String,
  pub relative_path: String,
  pub line_number: usize,
  pub line_content: String,
  pub match_start: usize,
  pub match_end: usize,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, TS)]
pub struct VfsChangeEventDto {
  pub kind: String,
  pub paths: Vec<String>,
  pub timestamp: u64,
}

pub fn get_language_from_ext(ext: &str) -> String {
  match ext {
    "rs" => "rust".to_string(),
    "ts" | "tsx" => "typescript".to_string(),
    "js" | "jsx" | "mjs" | "cjs" => "javascript".to_string(),
    "vue" => "vue".to_string(),
    "svelte" => "svelte".to_string(),
    "java" => "java".to_string(),
    "kt" | "kts" => "kotlin".to_string(),
    "py" => "python".to_string(),
    "json" => "json".to_string(),
    "html" | "htm" => "html".to_string(),
    "css" => "css".to_string(),
    "scss" | "sass" => "scss".to_string(),
    "less" => "less".to_string(),
    "md" | "markdown" => "markdown".to_string(),
    "toml" | "ini" | "env" => "ini".to_string(),
    "yaml" | "yml" => "yaml".to_string(),
    "xml" | "svg" => "xml".to_string(),
    "sql" => "sql".to_string(),
    "sh" | "bash" | "zsh" | "ps1" => "shell".to_string(),
    "go" => "go".to_string(),
    "php" => "php".to_string(),
    "c" | "h" | "cpp" | "hpp" | "cc" => "cpp".to_string(),
    "cs" => "csharp".to_string(),
    _ => "plaintext".to_string(),
  }
}

pub fn read_directory_tree(path: &Path, current_depth: usize, max_depth: usize) -> FileNodeDto {
  let name = path.file_name()
    .map(|n| n.to_string_lossy().to_string())
    .filter(|s| !s.is_empty())
    .unwrap_or_else(|| path.to_string_lossy().to_string());
  let path_str = path.to_string_lossy().to_string();

  if path.is_dir() {
    let mut children = Vec::new();
    if current_depth < max_depth {
      if let Ok(entries) = std::fs::read_dir(path) {
        let mut dir_entries: Vec<std::fs::DirEntry> = entries.filter_map(Result::ok).collect();
        dir_entries.sort_by(|a, b| {
          let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
          let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
          if a_is_dir != b_is_dir {
            b_is_dir.cmp(&a_is_dir)
          } else {
            let a_name = a.file_name().to_string_lossy().to_lowercase();
            let b_name = b.file_name().to_string_lossy().to_lowercase();
            a_name.cmp(&b_name)
          }
        });

        for entry in dir_entries {
          let entry_name = entry.file_name().to_string_lossy().to_string();
          if entry_name == ".git" || entry_name == ".idea" || entry_name == ".vscode" 
            || entry_name == "node_modules" || entry_name == "target" || entry_name == "dist" 
            || entry_name == "build" || entry_name == ".gradle" || entry_name == "bin" || entry_name == "out"
            || entry_name == "logs" || entry_name == "log" || entry_name == ".settings" || entry_name == ".metadata"
            || entry_name == ".m2" || entry_name == "classes" || entry_name == "__pycache__" || entry_name == ".DS_Store" {
            continue;
          }
          children.push(read_directory_tree(&entry.path(), current_depth + 1, max_depth));
        }
      }
    }

    FileNodeDto {
      id: path_str.clone(),
      name,
      path: path_str,
      is_folder: true,
      children: Some(children),
      content: None,
      language: None,
    }
  } else {
    let ext = path.extension().unwrap_or_default().to_string_lossy().to_lowercase();
    let lang = get_language_from_ext(&ext);

    FileNodeDto {
      id: path_str.clone(),
      name,
      path: path_str,
      is_folder: false,
      children: None,
      content: None,
      language: Some(lang),
    }
  }
}

pub fn is_ignored_path(path: &Path) -> bool {
  for comp in path.components() {
    let s = comp.as_os_str().to_string_lossy();
    if s == ".git" || s == "node_modules" || s == "target" || s == "dist" 
      || s == "build" || s == ".idea" || s == ".vscode" || s == "__pycache__" 
      || s == ".DS_Store" || s == "_mf_temp" || s == ".vite" || s == ".next"
      || s == ".nuxt" || s == ".turbo" || s == ".output" || s == ".cache"
      || s == "temp" || s == "tmp" || s == ".scannerwork" || s == ".sonartmp"
      || s == ".gradle" || s == "bin" || s == "out" || s == "logs" || s == "log"
      || s == ".m2" || s == ".settings" || s == ".metadata" || s == ".project" 
      || s == ".classpath" || s == "classes" {
      return true;
    }
  }
  if let Some(ext) = path.extension() {
    let ext_s = ext.to_string_lossy().to_lowercase();
    if ext_s == "class" || ext_s == "jar" || ext_s == "war" || ext_s == "log" 
      || ext_s == "lock" || ext_s == "tmp" || ext_s == "swp" || ext_s == "hprof" {
      return true;
    }
  }
  false
}

#[tauri::command]
pub fn select_directory(default_path: Option<String>) -> Result<Option<String>, String> {
  let mut dialog = rfd::FileDialog::new()
    .set_title("Select project File Directory");

  if let Some(ref p) = default_path {
    if !p.is_empty() {
      dialog = dialog.set_directory(p);
    }
  }

  let folder = dialog.pick_folder();
  Ok(folder.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn create_project_on_disk(
  project_path: String,
  files_to_create: Vec<(String, String)>,
  init_git: bool,
) -> Result<String, String> {
  let base = Path::new(&project_path);
  std::fs::create_dir_all(base).map_err(|e| format!("Failed to create project directory: {}", e))?;

  for (rel_path, content) in files_to_create {
    let full_path = base.join(rel_path);
    if let Some(parent) = full_path.parent() {
      std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory structure: {}", e))?;
    }
    std::fs::write(&full_path, content).map_err(|e| format!("Failed to write file {}: {}", full_path.display(), e))?;
  }

  if init_git {
    let mut git_cmd = std::process::Command::new("git");
    git_cmd.args(&["init"]);
    git_cmd.current_dir(base);
    #[cfg(windows)]
    git_cmd.creation_flags(0x08000000);
    let _ = git_cmd.output();
  }

  Ok(project_path)
}

#[tauri::command]
pub fn open_project_dialog(default_path: Option<String>) -> Result<Option<FileNodeDto>, String> {
  let mut dialog = rfd::FileDialog::new()
    .set_title("Open File or Project");

  if let Some(ref p) = default_path {
    if !p.is_empty() {
      dialog = dialog.set_directory(p);
    }
  }

  if let Some(folder) = dialog.pick_folder() {
    let tree = read_directory_tree(&folder, 0, usize::MAX);
    Ok(Some(tree))
  } else {
    Ok(None)
  }
}

#[tauri::command]
pub fn open_project_by_path(project_path: String) -> Result<FileNodeDto, String> {
  let path = Path::new(&project_path);
  if !path.exists() {
    return Err(format!("Path does not exist: {}", project_path));
  }
  let tree = read_directory_tree(path, 0, usize::MAX);
  Ok(tree)
}

#[tauri::command]
pub fn read_file_content(path: String) -> Result<String, String> {
  let mut buffers = VFS_BUFFERS.lock().map_err(|e| e.to_string())?;
  if let Some(rope) = buffers.get(&path) {
    return Ok(rope.to_string());
  }
  let content = std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;
  let rope = Rope::from_str(&content);
  buffers.insert(path, rope);
  Ok(content)
}

#[tauri::command]
pub fn save_file_content(path: String, content: String) -> Result<(), String> {
  {
    let mut buffers = VFS_BUFFERS.lock().map_err(|e| e.to_string())?;
    let rope = Rope::from_str(&content);
    buffers.insert(path.clone(), rope);
  }
  let p = std::path::Path::new(&path);
  if let Some(parent) = p.parent() {
    let _ = std::fs::create_dir_all(parent);
  }
  std::fs::write(&path, content).map_err(|e| format!("Failed to save file: {}", e))
}

#[tauri::command]
pub fn vfs_read_file(path: String) -> Result<String, String> {
  read_file_content(path)
}

#[tauri::command]
pub fn vfs_write_file(path: String, content: String) -> Result<(), String> {
  save_file_content(path, content)
}

#[tauri::command]
pub fn write_file_content(path: String, content: String) -> Result<(), String> {
  save_file_content(path, content)
}

#[tauri::command]
pub fn file_exists(path: String) -> bool {
  std::path::Path::new(&path).is_file()
}

#[tauri::command]
pub fn vfs_get_line_count(path: String) -> Result<usize, String> {
  let buffers = VFS_BUFFERS.lock().map_err(|e| e.to_string())?;
  if let Some(rope) = buffers.get(&path) {
    Ok(rope.len_lines())
  } else if let Ok(content) = std::fs::read_to_string(&path) {
    let rope = Rope::from_str(&content);
    Ok(rope.len_lines())
  } else {
    Err(format!("File not found in VFS: {}", path))
  }
}

#[tauri::command]
pub fn search_project_files(project_path: String, query: String, limit: Option<usize>) -> Result<Vec<SearchFileResultDto>, String> {
  let root = Path::new(&project_path);
  if !root.exists() {
    return Err("Project directory does not exist".to_string());
  }

  let max_results = limit.unwrap_or(50);
  let q_trim = query.trim();

  if q_trim.is_empty() {
    return Ok(Vec::new());
  }

  let mut matcher = nucleo_matcher::Matcher::new(nucleo_matcher::Config::DEFAULT);
  let mut query_buf = Vec::new();
  let needle = nucleo_matcher::Utf32Str::new(q_trim, &mut query_buf);

  let mut scored_results: Vec<(u32, SearchFileResultDto)> = Vec::new();

  for entry in walkdir::WalkDir::new(root)
    .into_iter()
    .filter_entry(|e| !is_ignored_path(e.path()))
    .filter_map(Result::ok)
  {
    if entry.depth() == 0 {
      continue;
    }
    let p = entry.path();
    let name = entry.file_name().to_string_lossy().to_string();
    let rel_path = p.strip_prefix(root)
      .map(|r| r.to_string_lossy().replace('\\', "/"))
      .unwrap_or_else(|_| name.clone());

    let mut name_buf = Vec::new();
    let name_haystack = nucleo_matcher::Utf32Str::new(&name, &mut name_buf);
    let name_score = matcher.fuzzy_match(name_haystack, needle);

    let score = if let Some(s) = name_score {
      (s as u32) + 200
    } else {
      let mut path_buf = Vec::new();
      let path_haystack = nucleo_matcher::Utf32Str::new(&rel_path, &mut path_buf);
      match matcher.fuzzy_match(path_haystack, needle) {
        Some(s) => s.into(),
        None => continue,
      }
    };

    scored_results.push((score, SearchFileResultDto {
      name,
      path: p.to_string_lossy().to_string(),
      relative_path: rel_path,
      is_folder: p.is_dir(),
    }));
  }

  scored_results.sort_by(|a, b| b.0.cmp(&a.0));

  let results = scored_results
    .into_iter()
    .take(max_results)
    .map(|(_, item)| item)
    .collect();

  Ok(results)
}

#[tauri::command]
pub fn search_project_text(
  project_path: String,
  query: String,
  case_sensitive: bool,
  limit: Option<usize>,
) -> Result<Vec<SearchTextResultDto>, String> {
  let root = Path::new(&project_path);
  if !root.exists() {
    return Err("Project directory does not exist".to_string());
  }

  let q = query.trim();
  if q.is_empty() {
    return Ok(Vec::new());
  }

  let max_results = limit.unwrap_or(80);
  let q_cmp = if case_sensitive { q.to_string() } else { q.to_lowercase() };
  let mut results = Vec::new();

  for entry in walkdir::WalkDir::new(root)
    .into_iter()
    .filter_entry(|e| !is_ignored_path(e.path()))
    .filter_map(Result::ok)
  {
    if !entry.file_type().is_file() {
      continue;
    }

    let p = entry.path();
    if let Ok(meta) = p.metadata() {
      if meta.len() > 1_500_000 {
        continue;
      }
    }

    if let Ok(content) = std::fs::read_to_string(p) {
      let file_name = entry.file_name().to_string_lossy().to_string();
      let rel_path = p.strip_prefix(root)
        .map(|r| r.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| file_name.clone());

      for (idx, line) in content.lines().enumerate() {
        let line_cmp = if case_sensitive { line.to_string() } else { line.to_lowercase() };
        if let Some(pos) = line_cmp.find(&q_cmp) {
          results.push(SearchTextResultDto {
            file_name: file_name.clone(),
            file_path: p.to_string_lossy().to_string(),
            relative_path: rel_path.clone(),
            line_number: idx + 1,
            line_content: line.trim_end().to_string(),
            match_start: pos,
            match_end: pos + q.len(),
          });

          if results.len() >= max_results {
            return Ok(results);
          }
        }
      }
    }
  }

  Ok(results)
}

#[tauri::command]
pub fn watch_project_directory(app: tauri::AppHandle, project_path: String) -> Result<(), String> {
  let mut debouncer_guard = FS_DEBOUNCER.lock().map_err(|e| e.to_string())?;
  *debouncer_guard = None;

  let path = std::path::PathBuf::from(&project_path);
  if !path.exists() {
    return Err("Path does not exist".to_string());
  }

  let app_clone = app.clone();
  let mut debouncer = new_debouncer(
    Duration::from_millis(150),
    None,
    move |res: Result<Vec<DebouncedEvent>, _>| {
      if let Ok(events) = res {
        let paths: Vec<String> = events
          .into_iter()
          .map(|e| e.path)
          .filter(|p| !is_ignored_path(p))
          .map(|p| p.to_string_lossy().to_string())
          .collect();

        if !paths.is_empty() {
          let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

          let vfs_payload = VfsChangeEventDto {
            kind: "Modify".to_string(),
            paths: paths.clone(),
            timestamp: now,
          };

          let _ = app_clone.emit("vfs:change", &vfs_payload);
          let _ = app_clone.emit("fs-event", serde_json::json!({
            "kind": "Modify",
            "paths": paths,
          }));
        }
      }
    },
  ).map_err(|e| format!("Failed to create debouncer: {}", e))?;

  debouncer
    .watcher()
    .watch(&path, notify::RecursiveMode::Recursive)
    .map_err(|e| format!("Failed to watch: {}", e))?;

  *debouncer_guard = Some(debouncer);
  Ok(())
}

#[tauri::command]
pub fn pick_settings_file() -> Result<Option<String>, String> {
  let file = rfd::FileDialog::new()
    .set_title("Select IntelliJ Settings Archive")
    .add_filter("IntelliJ Settings (*.zip, *.jar)", &["zip", "jar"])
    .pick_file();
  Ok(file.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn pick_settings_folder() -> Result<Option<String>, String> {
  let folder = rfd::FileDialog::new()
    .set_title("Select IntelliJ Settings Directory (options, keymaps, etc.)")
    .pick_folder();
  Ok(folder.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn pick_settings_export_path(default_name: Option<String>) -> Result<Option<String>, String> {
  let mut dialog = rfd::FileDialog::new()
    .set_title("Export IDE Settings to Archive")
    .add_filter("ZIP Archive (*.zip)", &["zip"]);

  if let Some(name) = default_name {
    dialog = dialog.set_file_name(&name);
  } else {
    dialog = dialog.set_file_name("settings.zip");
  }

  let file = dialog.save_file();
  Ok(file.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn read_settings_from_zip_or_folder(source_path: String) -> Result<HashMap<String, String>, String> {
  use std::io::Read;
  let path = Path::new(&source_path);
  if !path.exists() {
    return Err(format!("Path does not exist: {}", source_path));
  }

  let mut result_map: HashMap<String, String> = HashMap::new();

  if path.is_file() {
    // Treat as ZIP archive (settings.zip or .jar)
    let file = std::fs::File::open(path).map_err(|e| format!("Failed to open archive: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    for i in 0..archive.len() {
      let mut entry = archive.by_index(i).map_err(|e| format!("Zip entry read error: {}", e))?;
      if entry.is_file() {
        let name = entry.name().replace('\\', "/");
        if name.ends_with(".xml") || name == "IntelliJ IDEA Global Settings" || name.ends_with(".json") {
          let mut content = String::new();
          let _ = entry.read_to_string(&mut content);
          result_map.insert(name, content);
        }
      }
    }
  } else if path.is_dir() {
    let folder_name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
    let is_direct_options = folder_name == "options";

    for entry in walkdir::WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
      if entry.file_type().is_file() {
        let entry_path = entry.path();
        let rel = entry_path.strip_prefix(path).unwrap_or(entry_path);
        let mut rel_str = rel.to_string_lossy().replace('\\', "/");

        if rel_str.ends_with(".xml") || rel_str == "IntelliJ IDEA Global Settings" || rel_str.ends_with(".json") {
          // If user picked "options" directory directly, ensure paths start with options/
          if is_direct_options && !rel_str.starts_with("options/") {
            rel_str = format!("options/{}", rel_str);
          }
          if let Ok(content) = std::fs::read_to_string(entry_path) {
            result_map.insert(rel_str, content);
          }
        }
      }
    }
  }

  Ok(result_map)
}

#[tauri::command]
pub fn export_settings_to_zip(zip_path: String, entries: HashMap<String, String>) -> Result<(), String> {
  use std::io::Write;
  let path = Path::new(&zip_path);
  if let Some(parent) = path.parent() {
    let _ = std::fs::create_dir_all(parent);
  }

  let file = std::fs::File::create(path).map_err(|e| format!("Failed to create zip file: {}", e))?;
  let mut zip = zip::ZipWriter::new(file);

  let options = zip::write::SimpleFileOptions::default()
    .compression_method(zip::CompressionMethod::Deflated);

  // Write IntelliJ IDEA marker file if not present
  if !entries.contains_key("IntelliJ IDEA Global Settings") {
    zip.start_file("IntelliJ IDEA Global Settings", options)
      .map_err(|e| format!("Failed to write marker file: {}", e))?;
  }

  for (name, content) in entries {
    let norm_name = name.replace('\\', "/");
    zip.start_file(&norm_name, options)
      .map_err(|e| format!("Failed to add file {} to zip: {}", norm_name, e))?;
    zip.write_all(content.as_bytes())
      .map_err(|e| format!("Failed to write content for {}: {}", norm_name, e))?;
  }

  zip.finish().map_err(|e| format!("Failed to finalize zip archive: {}", e))?;
  Ok(())
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
  std::fs::create_dir_all(dst)?;
  for entry in std::fs::read_dir(src)? {
    let entry = entry?;
    let ty = entry.file_type()?;
    let dest_child = dst.join(entry.file_name());
    if ty.is_dir() {
      copy_dir_all(&entry.path(), &dest_child)?;
    } else {
      std::fs::copy(entry.path(), dest_child)?;
    }
  }
  Ok(())
}

#[tauri::command]
pub fn vfs_copy_file(source_path: String, dest_path: String) -> Result<(), String> {
  let src = Path::new(&source_path);
  let dst = Path::new(&dest_path);
  if !src.exists() {
    return Err(format!("Source path does not exist: {}", source_path));
  }
  if let Some(parent) = dst.parent() {
    let _ = std::fs::create_dir_all(parent);
  }
  if src.is_dir() {
    copy_dir_all(src, dst).map_err(|e| format!("Failed to copy directory: {}", e))
  } else {
    std::fs::copy(src, dst).map_err(|e| format!("Failed to copy file: {}", e))?;
    Ok(())
  }
}

#[tauri::command]
pub fn vfs_move_path(source_path: String, dest_path: String) -> Result<(), String> {
  let src = Path::new(&source_path);
  let dst = Path::new(&dest_path);
  if !src.exists() {
    return Err(format!("Source path does not exist: {}", source_path));
  }
  if let Some(parent) = dst.parent() {
    let _ = std::fs::create_dir_all(parent);
  }
  if std::fs::rename(src, dst).is_err() {
    if src.is_dir() {
      copy_dir_all(src, dst).map_err(|e| format!("Failed to move directory: {}", e))?;
      let _ = std::fs::remove_dir_all(src);
    } else {
      std::fs::copy(src, dst).map_err(|e| format!("Failed to move file: {}", e))?;
      let _ = std::fs::remove_file(src);
    }
  }
  Ok(())
}

#[tauri::command]
pub fn vfs_delete_path(path: String) -> Result<(), String> {
  let p = Path::new(&path);
  if !p.exists() {
    return Ok(());
  }
  if p.is_dir() {
    std::fs::remove_dir_all(p).map_err(|e| format!("Failed to delete directory: {}", e))?;
  } else {
    std::fs::remove_file(p).map_err(|e| format!("Failed to delete file: {}", e))?;
  }
  Ok(())
}

#[tauri::command]
pub fn vfs_create_dir(path: String) -> Result<(), String> {
  let p = Path::new(&path);
  std::fs::create_dir_all(p).map_err(|e| format!("Failed to create directory: {}", e))
}

