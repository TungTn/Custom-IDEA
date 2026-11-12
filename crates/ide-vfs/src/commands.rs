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

pub fn sanitize_relative_path(rel: &str) -> Result<std::path::PathBuf, String> {
  let trimmed = rel.trim();
  if trimmed.is_empty() {
    return Err("Path cannot be empty".to_string());
  }
  let path = std::path::Path::new(trimmed);
  if path.is_absolute() {
    return Err(format!("Absolute paths not allowed: {}", trimmed));
  }
  for comp in path.components() {
    match comp {
      std::path::Component::ParentDir => {
        return Err(format!("Path traversal ('..') not allowed: {}", trimmed));
      }
      std::path::Component::RootDir | std::path::Component::Prefix(_) => {
        return Err(format!("Root or prefix components not allowed: {}", trimmed));
      }
      _ => {}
    }
  }
  if trimmed.contains('\0') || trimmed.contains(':') {
    return Err(format!("Invalid characters in path: {}", trimmed));
  }
  Ok(path.to_path_buf())
}

pub fn is_ignored_relative_path(root: &Path, path: &Path) -> bool {
  let root_str = root.to_string_lossy().replace('\\', "/");
  let root_clean = root_str.strip_prefix("//?/").or_else(|| root_str.strip_prefix(r"\\?\")).unwrap_or(&root_str);
  let path_str = path.to_string_lossy().replace('\\', "/");
  let path_clean = path_str.strip_prefix("//?/").or_else(|| path_str.strip_prefix(r"\\?\")).unwrap_or(&path_str);

  let rel_str = if !root_clean.is_empty() && path_clean.to_lowercase().starts_with(&root_clean.to_lowercase()) {
    let rem = &path_clean[root_clean.len()..];
    rem.trim_start_matches('/')
  } else {
    match path.strip_prefix(root) {
      Ok(p) => return check_components(p),
      Err(_) => path_clean,
    }
  };

  check_components(Path::new(rel_str))
}

fn check_components(rel: &Path) -> bool {
  for comp in rel.components() {
    let s = comp.as_os_str().to_string_lossy().to_lowercase();
    if s == ".git" || s == "node_modules" || s == "target" || s == "dist" 
      || s == "build" || s == ".idea" || s == ".vscode" || s == "__pycache__" 
      || s == ".ds_store" || s == "_mf_temp" || s == ".vite" || s == ".next"
      || s == ".nuxt" || s == ".turbo" || s == ".output" || s == ".cache"
      || s == "temp" || s == "tmp" || s == ".scannerwork" || s == ".sonartmp"
      || s == ".gradle" || s == "bin" || s == "out" || s == "logs" || s == "log"
      || s == ".m2" || s == ".settings" || s == ".metadata" || s == ".project" 
      || s == ".classpath" || s == "classes" {
      return true;
    }
  }
  if let Some(ext) = rel.extension() {
    let ext_s = ext.to_string_lossy().to_lowercase();
    if ext_s == "class" || ext_s == "jar" || ext_s == "war" || ext_s == "log" 
      || ext_s == "lock" || ext_s == "tmp" || ext_s == "swp" || ext_s == "hprof" {
      return true;
    }
  }
  false
}

pub fn is_ignored_path(path: &Path) -> bool {
  is_ignored_relative_path(Path::new(""), path)
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
          if let Ok(file_type) = entry.file_type() {
            if file_type.is_symlink() {
              // Skip recursing through symlinks/junctions to prevent infinite loops
              continue;
            }
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
    let safe_rel = sanitize_relative_path(&rel_path)
      .map_err(|e| format!("Invalid relative path '{}': {}", rel_path, e))?;
    let full_path = base.join(safe_rel);
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
    let tree = read_directory_tree(&folder, 0, 64);
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
  let tree = read_directory_tree(path, 0, 64);
  Ok(tree)
}

#[tauri::command]
pub fn read_file_content(path: String) -> Result<String, String> {
  let content = std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;
  if let Ok(mut buffers) = VFS_BUFFERS.lock() {
    buffers.insert(path, Rope::from_str(&content));
  }
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
  {
    let buffers = VFS_BUFFERS.lock().map_err(|e| e.to_string())?;
    if let Some(rope) = buffers.get(&path) {
      return Ok(rope.len_lines());
    }
  }
  if let Ok(content) = std::fs::read_to_string(&path) {
    let rope = Rope::from_str(&content);
    let count = rope.len_lines();
    if let Ok(mut buffers) = VFS_BUFFERS.lock() {
      buffers.insert(path, rope);
    }
    Ok(count)
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
    .filter_entry(|e| !is_ignored_relative_path(root, e.path()))
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
  let regex_pattern = regex::escape(q);
  let re = regex::RegexBuilder::new(&regex_pattern)
    .case_insensitive(!case_sensitive)
    .build()
    .map_err(|e| format!("Failed to build search regex: {}", e))?;

  let mut results = Vec::new();

  for entry in walkdir::WalkDir::new(root)
    .into_iter()
    .filter_entry(|e| !is_ignored_relative_path(root, e.path()))
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
        if let Some(m) = re.find(line) {
          results.push(SearchTextResultDto {
            file_name: file_name.clone(),
            file_path: p.to_string_lossy().to_string(),
            relative_path: rel_path.clone(),
            line_number: idx + 1,
            line_content: line.trim_end().to_string(),
            match_start: m.start(),
            match_end: m.end(),
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

  let root_clone = path.clone();
  let app_clone = app.clone();
  let mut debouncer = new_debouncer(
    Duration::from_millis(150),
    None,
    move |res: Result<Vec<DebouncedEvent>, _>| {
      if let Ok(events) = res {
        let paths: Vec<String> = events
          .into_iter()
          .map(|e| e.path)
          .filter(|p| !is_ignored_relative_path(&root_clone, p))
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

    const MAX_ENTRY_BYTES: u64 = 10 * 1024 * 1024; // 10 MiB
    const MAX_TOTAL_BYTES: usize = 50 * 1024 * 1024; // 50 MiB
    let mut total_bytes = 0usize;

    for i in 0..archive.len() {
      let mut entry = archive.by_index(i).map_err(|e| format!("Zip entry read error: {}", e))?;
      if entry.is_file() {
        let name = entry.name().replace('\\', "/");
        if name.contains("..") || name.starts_with('/') {
          continue;
        }
        if name.ends_with(".xml") || name == "IntelliJ IDEA Global Settings" || name.ends_with(".json") {
          let mut content = String::new();
          let mut limited = Read::take(&mut entry, MAX_ENTRY_BYTES + 1);
          limited.read_to_string(&mut content).map_err(|e| format!("Failed to read zip entry '{}': {}", name, e))?;
          if content.len() as u64 > MAX_ENTRY_BYTES {
            return Err(format!("Settings entry '{}' exceeds 10 MiB limit", name));
          }
          total_bytes += content.len();
          if total_bytes > MAX_TOTAL_BYTES {
            return Err("Settings archive exceeds 50 MiB uncompressed limit".to_string());
          }
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
    let safe_rel = sanitize_relative_path(&name)
      .map_err(|e| format!("Invalid export path '{}': {}", name, e))?;
    let norm_name = safe_rel.to_string_lossy().replace('\\', "/");
    zip.start_file(&norm_name, options)
      .map_err(|e| format!("Failed to add file {} to zip: {}", norm_name, e))?;
    zip.write_all(content.as_bytes())
      .map_err(|e| format!("Failed to write content for {}: {}", norm_name, e))?;
  }

  zip.finish().map_err(|e| format!("Failed to finalize zip archive: {}", e))?;
  Ok(())
}

fn is_subpath(parent: &Path, child: &Path) -> bool {
  if let (Ok(p_canon), Ok(c_canon)) = (parent.canonicalize(), child.canonicalize()) {
    c_canon.starts_with(p_canon)
  } else {
    let mut curr = child;
    while !curr.exists() {
      if let Some(p) = curr.parent() {
        curr = p;
      } else {
        break;
      }
    }
    if let (Ok(p_canon), Ok(c_canon)) = (parent.canonicalize(), curr.canonicalize()) {
      c_canon.starts_with(p_canon)
    } else {
      child.starts_with(parent)
    }
  }
}

fn is_same_or_child_path(prefix: &str, target: &str) -> bool {
  let p_norm = prefix.replace('\\', "/").trim_end_matches('/').to_lowercase();
  let t_norm = target.replace('\\', "/").to_lowercase();
  if t_norm == p_norm {
    return true;
  }
  t_norm.starts_with(&format!("{}/", p_norm))
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
  std::fs::create_dir_all(dst)?;
  for entry in std::fs::read_dir(src)? {
    let entry = entry?;
    let ty = entry.file_type()?;
    if ty.is_symlink() {
      // Skip symlinks and directory junctions to avoid OS error 5 or recursion
      continue;
    }
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
  if src.is_dir() && is_subpath(src, dst) {
    return Err(format!("Cannot copy directory '{}' into itself or a subdirectory of itself", source_path));
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
  if src.is_dir() && is_subpath(src, dst) {
    return Err(format!("Cannot move directory '{}' into itself or a subdirectory of itself", source_path));
  }
  if let Some(parent) = dst.parent() {
    let _ = std::fs::create_dir_all(parent);
  }
  if std::fs::rename(src, dst).is_err() {
    if src.is_dir() {
      copy_dir_all(src, dst).map_err(|e| format!("Failed to move directory: {}", e))?;
      std::fs::remove_dir_all(src).map_err(|e| format!("Failed to remove source directory: {}", e))?;
    } else {
      std::fs::copy(src, dst).map_err(|e| format!("Failed to move file: {}", e))?;
      std::fs::remove_file(src).map_err(|e| format!("Failed to remove source file: {}", e))?;
    }
  }
  if let Ok(mut buffers) = VFS_BUFFERS.lock() {
    buffers.retain(|k, _| !is_same_or_child_path(&source_path, k));
  }
  Ok(())
}

#[tauri::command]
pub fn vfs_delete_path(path: String) -> Result<(), String> {
  let p = Path::new(&path);
  if !p.exists() {
    return Ok(());
  }
  if let Ok(mut buffers) = VFS_BUFFERS.lock() {
    buffers.retain(|k, _| !is_same_or_child_path(&path, k));
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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_sanitize_relative_path() {
    assert!(sanitize_relative_path("src/main.rs").is_ok());
    assert!(sanitize_relative_path("nested/dir/file.txt").is_ok());

    assert!(sanitize_relative_path("../escape.txt").is_err());
    assert!(sanitize_relative_path("foo/../../bar").is_err());
    assert!(sanitize_relative_path("/root/test.txt").is_err());
    assert!(sanitize_relative_path("C:\\Windows\\test.txt").is_err());
    assert!(sanitize_relative_path("   ").is_err());
  }

  #[test]
  fn test_is_ignored_relative_path() {
    let root = Path::new("D:/build/app");
    let safe_file = Path::new("D:/build/app/src/main.rs");
    assert!(!is_ignored_relative_path(root, safe_file));

    let git_file = Path::new("D:/build/app/.git/config");
    assert!(is_ignored_relative_path(root, git_file));

    let node_modules_file = Path::new("D:/build/app/node_modules/pkg/index.js");
    assert!(is_ignored_relative_path(root, node_modules_file));

    // Case insensitivity test on Windows (Build, Target)
    let target_file = Path::new("D:/build/app/Target/debug/app.exe");
    assert!(is_ignored_relative_path(root, target_file));

    // Verbatim prefix test on Windows
    let verbatim_root = Path::new(r"\\?\D:\build\app");
    let verbatim_file = Path::new(r"\\?\D:\build\app\src\lib.rs");
    assert!(!is_ignored_relative_path(verbatim_root, verbatim_file));
  }

  #[test]
  fn test_is_same_or_child_path() {
    assert!(is_same_or_child_path("D:/project/src/main", "D:/project/src/main"));
    assert!(is_same_or_child_path("D:/project/src/main", "D:/project/src/main/foo.rs"));
    assert!(!is_same_or_child_path("D:/project/src/main", "D:/project/src/main.rs"));
    assert!(!is_same_or_child_path("D:/project/src/main", "D:/project/src/main_test.go"));
  }

  struct TempTestDir(std::path::PathBuf);
  impl TempTestDir {
    fn new(prefix: &str) -> Self {
      let uniq = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
      let p = std::env::temp_dir().join(format!("{}_{}_{}", prefix, std::process::id(), uniq));
      std::fs::create_dir_all(&p).unwrap();
      Self(p)
    }
  }
  impl Drop for TempTestDir {
    fn drop(&mut self) {
      let _ = std::fs::remove_dir_all(&self.0);
    }
  }

  #[test]
  fn test_copy_and_move_reject_self_subpath() {
    let dir = TempTestDir::new("vfs_subpath");
    let src_dir = dir.0.join("parent");
    std::fs::create_dir_all(&src_dir).unwrap();
    std::fs::write(src_dir.join("file.txt"), "hello").unwrap();

    let nested_dst = src_dir.join("sub").join("parent_copy");
    let copy_res = vfs_copy_file(
      src_dir.to_string_lossy().to_string(),
      nested_dst.to_string_lossy().to_string(),
    );
    assert!(copy_res.is_err());
    assert!(copy_res.unwrap_err().contains("into itself"));

    let move_res = vfs_move_path(
      src_dir.to_string_lossy().to_string(),
      nested_dst.to_string_lossy().to_string(),
    );
    assert!(move_res.is_err());
    assert!(move_res.unwrap_err().contains("into itself"));
  }

  #[test]
  fn test_read_file_reflects_external_disk_edits() {
    let dir = TempTestDir::new("vfs_fresh");
    let file_path = dir.0.join("sample.txt");
    let path_str = file_path.to_string_lossy().to_string();

    save_file_content(path_str.clone(), "v1".to_string()).unwrap();
    assert_eq!(read_file_content(path_str.clone()).unwrap(), "v1");

    // External writer modifies file on disk
    std::fs::write(&file_path, "v2-updated").unwrap();
    assert_eq!(read_file_content(path_str.clone()).unwrap(), "v2-updated");
  }

  #[test]
  fn test_search_project_text_utf8_case_insensitive() {
    let dir = TempTestDir::new("vfs_utf8");
    let file_path = dir.0.join("utf8.txt");
    // Multi-byte UTF-8 chars whose lowercase/uppercase byte lengths differ or are multi-byte
    std::fs::write(&file_path, "Prefix İSTANBUL and Tiếng Việt ĐẶC BIỆT suffix\n").unwrap();

    let hits_vi = search_project_text(
      dir.0.to_string_lossy().to_string(),
      "đặc biệt".to_string(),
      false,
      Some(10),
    ).unwrap();
    assert_eq!(hits_vi.len(), 1);
    assert_eq!(hits_vi[0].line_number, 1);
    assert!(hits_vi[0].match_end <= hits_vi[0].line_content.len());
    assert!(hits_vi[0].line_content.is_char_boundary(hits_vi[0].match_start));
    assert!(hits_vi[0].line_content.is_char_boundary(hits_vi[0].match_end));
    assert_eq!(
      &hits_vi[0].line_content[hits_vi[0].match_start..hits_vi[0].match_end],
      "ĐẶC BIỆT"
    );

    let hits_suffix = search_project_text(
      dir.0.to_string_lossy().to_string(),
      "SUFFIX".to_string(),
      false,
      Some(10),
    ).unwrap();
    assert_eq!(hits_suffix.len(), 1);
    assert!(hits_suffix[0].line_content.is_char_boundary(hits_suffix[0].match_start));
    assert!(hits_suffix[0].line_content.is_char_boundary(hits_suffix[0].match_end));
    assert_eq!(
      &hits_suffix[0].line_content[hits_suffix[0].match_start..hits_suffix[0].match_end],
      "suffix"
    );
  }

  #[test]
  fn test_zip_import_skips_traversal_and_rejects_oversized_entry() {
    use std::io::Write;
    let dir = TempTestDir::new("vfs_zip");
    let zip_ok = dir.0.join("safe.zip");
    {
      let file = std::fs::File::create(&zip_ok).unwrap();
      let mut writer = zip::ZipWriter::new(file);
      let opts = zip::write::SimpleFileOptions::default();
      writer.start_file("../evil.xml", opts).unwrap();
      writer.write_all(b"<bad/>").unwrap();
      writer.start_file("options/editor.xml", opts).unwrap();
      writer.write_all(b"<ok/>").unwrap();
      writer.finish().unwrap();
    }
    let imported = read_settings_from_zip_or_folder(zip_ok.to_string_lossy().to_string()).unwrap();
    assert!(!imported.contains_key("../evil.xml"));
    assert_eq!(imported.get("options/editor.xml").map(String::as_str), Some("<ok/>"));

    let zip_bomb = dir.0.join("oversize.zip");
    {
      let file = std::fs::File::create(&zip_bomb).unwrap();
      let mut writer = zip::ZipWriter::new(file);
      let opts = zip::write::SimpleFileOptions::default();
      writer.start_file("options/huge.xml", opts).unwrap();
      // > 10 MiB uncompressed
      let chunk = vec![b'a'; 1024 * 1024];
      for _ in 0..11 {
        writer.write_all(&chunk).unwrap();
      }
      writer.finish().unwrap();
    }
    let bomb_res = read_settings_from_zip_or_folder(zip_bomb.to_string_lossy().to_string());
    assert!(bomb_res.is_err());
    assert!(bomb_res.unwrap_err().contains("exceeds 10 MiB limit"));
  }

  #[test]
  fn test_read_directory_tree_max_depth() {
    let dir = TempTestDir::new("vfs_depth");
    let deep_dir = dir.0.join("d0").join("d1").join("d2");
    std::fs::create_dir_all(&deep_dir).unwrap();
    std::fs::write(deep_dir.join("leaf.txt"), "hi").unwrap();

    // depth 0 (root) -> depth 1 (d0) -> depth 2 (d1 stops before d2)
    let shallow = read_directory_tree(&dir.0, 0, 2);
    let d0 = shallow
      .children
      .as_ref()
      .unwrap()
      .iter()
      .find(|c| c.name == "d0")
      .unwrap();
    let d1 = d0
      .children
      .as_ref()
      .unwrap()
      .iter()
      .find(|c| c.name == "d1")
      .unwrap();
    assert!(d1.children.as_ref().unwrap().is_empty(), "max_depth=2 must stop at d1");

    // depth 4 reaches leaf.txt
    let full = read_directory_tree(&dir.0, 0, 4);
    let d0_f = &full.children.as_ref().unwrap()[0];
    let d1_f = &d0_f.children.as_ref().unwrap()[0];
    let d2_f = &d1_f.children.as_ref().unwrap()[0];
    assert_eq!(d2_f.children.as_ref().unwrap()[0].name, "leaf.txt");
  }
}

