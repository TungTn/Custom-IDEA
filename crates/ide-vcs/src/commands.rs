use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{LazyLock, RwLock};
use serde::{Deserialize, Serialize};

static REBASE_TMP_SEQ: AtomicU64 = AtomicU64::new(1);

fn validate_git_ref_arg<'a>(arg: &'a str, label: &str) -> Result<&'a str, String> {
  let trimmed = arg.trim();
  if trimmed.is_empty() {
    return Err(format!("Invalid {}: cannot be empty", label));
  }
  if trimmed.starts_with('-') {
    return Err(format!("Invalid {}: cannot start with '-'", label));
  }
  if trimmed.chars().any(|c| c.is_ascii_control() || c.is_whitespace()) {
    return Err(format!("Invalid {}: contains whitespace or control characters", label));
  }
  Ok(trimmed)
}

fn validate_repo_relative_path(
  project_path: &str,
  rel_path: &str,
) -> Result<(String, std::path::PathBuf), String> {
  let trimmed_proj = project_path.trim();
  if trimmed_proj.is_empty() {
    return Err("Project path cannot be empty".to_string());
  }
  let clean_norm = rel_path.trim().replace('\\', "/");
  if clean_norm.is_empty()
    || clean_norm.chars().any(|c| c.is_ascii_control())
    || clean_norm.starts_with('/')
  {
    return Err(format!("Invalid repository-relative path: '{}'", rel_path));
  }

  let mut normalized_parts: Vec<String> = Vec::new();
  for comp in std::path::Path::new(&clean_norm).components() {
    match comp {
      std::path::Component::Normal(seg) => {
        let s = seg.to_string_lossy();
        if s.contains(':') {
          return Err(format!("Invalid repository-relative path: '{}'", rel_path));
        }
        normalized_parts.push(s.into_owned());
      }
      std::path::Component::CurDir => {}
      std::path::Component::ParentDir
      | std::path::Component::RootDir
      | std::path::Component::Prefix(_) => {
        return Err(format!("Path traversal or absolute path is not allowed: '{}'", rel_path));
      }
    }
  }
  if normalized_parts.is_empty() {
    return Err(format!("Invalid repository-relative path: '{}'", rel_path));
  }

  let root_canon = std::fs::canonicalize(trimmed_proj)
    .map_err(|e| format!("Invalid repository root path: {}", e))?;
  let rel_str = normalized_parts.join("/");
  let full_path = root_canon.join(&rel_str);

  // Reject dangling or live symlinks at target path or intermediate relative directories
  let mut cursor_check = root_canon.clone();
  for seg in &normalized_parts {
    cursor_check.push(seg);
    if let Ok(meta) = std::fs::symlink_metadata(&cursor_check) {
      if meta.file_type().is_symlink() {
        return Err(format!("Symlink components are not allowed in repository paths: '{}'", rel_path));
      }
    }
  }

  if full_path.exists() {
    let canon_target = std::fs::canonicalize(&full_path)
      .map_err(|e| format!("Failed to resolve target path: {}", e))?;
    if !canon_target.starts_with(&root_canon) {
      return Err(format!("Path escapes repository root: '{}'", rel_path));
    }
  } else {
    let mut anc = full_path.parent();
    while let Some(dir) = anc {
      if dir.exists() {
        let canon_dir = std::fs::canonicalize(dir)
          .map_err(|e| format!("Failed to resolve parent directory: {}", e))?;
        if !canon_dir.starts_with(&root_canon) {
          return Err(format!("Path escapes repository root: '{}'", rel_path));
        }
        break;
      }
      anc = dir.parent();
    }
  }

  Ok((rel_str, full_path))
}

#[cfg(windows)]
use std::os::windows::process::CommandExt;

static CUSTOM_GIT_PATH: LazyLock<RwLock<Option<String>>> = LazyLock::new(|| RwLock::new(None));

pub fn get_git_executable() -> String {
  if let Ok(guard) = CUSTOM_GIT_PATH.read() {
    if let Some(ref path) = *guard {
      let trimmed = path.trim();
      if !trimmed.is_empty() {
        return trimmed.to_string();
      }
    }
  }
  "git".to_string()
}

pub fn run_git_cmd(cwd: &str, args: &[&str]) -> Result<String, String> {
  run_git_cmd_raw(cwd, args).map(|out| out.trim().to_string())
}

pub fn run_git_cmd_raw(cwd: &str, args: &[&str]) -> Result<String, String> {
  let git_bin = get_git_executable();
  let mut cmd = Command::new(&git_bin);
  cmd.args(args);
  let work_dir = if cwd.trim().is_empty() { "." } else { cwd.trim() };
  cmd.current_dir(work_dir);
  #[cfg(windows)]
  cmd.creation_flags(0x08000000);

  match cmd.output() {
    Ok(out) => {
      if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
      } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
      }
    }
    Err(e) => Err(format!("Failed to execute '{}': {}", git_bin, e)),
  }
}

#[tauri::command]
pub fn set_git_executable_path(path: Option<String>) -> Result<(), String> {
  if let Ok(mut guard) = CUSTOM_GIT_PATH.write() {
    *guard = path;
  }
  Ok(())
}

#[tauri::command]
pub fn test_git_executable(path: Option<String>) -> Result<String, String> {
  let git_exe = path.unwrap_or_else(|| "git".to_string());
  let target = if git_exe.trim().is_empty() { "git" } else { git_exe.trim() };
  let mut cmd = Command::new(target);
  cmd.arg("--version");
  #[cfg(windows)]
  cmd.creation_flags(0x08000000);

  match cmd.output() {
    Ok(output) => {
      if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(if stdout.is_empty() { "Git executable detected successfully".to_string() } else { stdout })
      } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!("Git returned error: {}", if stderr.is_empty() { "Unknown error".to_string() } else { stderr }))
      }
    }
    Err(e) => Err(format!("Failed to execute '{}': {}", target, e)),
  }
}

use ts_rs::TS;

#[derive(Debug, serde::Serialize, serde::Deserialize, TS)]
#[ts(export)]
pub struct GitFileChangeDto {
  pub path: String,
  pub status: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, TS)]
#[ts(export)]
pub struct GitStatusDto {
  pub branch: String,
  pub changes: Vec<GitFileChangeDto>,
  pub is_clean: bool,
}

fn parse_name_status_lines(output: &str) -> Vec<GitFileChangeDto> {
  let mut files = Vec::new();
  for raw_line in output.lines() {
    let line = raw_line.trim_end_matches('\r');
    if line.is_empty() {
      continue;
    }
    let parts: Vec<&str> = line.split('\t').collect();
    if parts.len() >= 3 {
      // Rename/copy format: R100\told_path\tnew_path
      files.push(GitFileChangeDto {
        status: parts[0].trim().to_string(),
        path: unquote_git_path(parts[2]),
      });
    } else if parts.len() >= 2 {
      files.push(GitFileChangeDto {
        status: parts[0].trim().to_string(),
        path: unquote_git_path(parts[1]),
      });
    }
  }
  files
}

/// Decodes Git's C-style quoted paths (spaces, quotes, control escapes, and `\NNN` UTF-8 octal bytes).
fn unquote_git_path(raw: &str) -> String {
  if raw.starts_with('"') && raw.ends_with('"') && raw.len() >= 2 {
    let bytes = &raw.as_bytes()[1..raw.len() - 1];
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
      if bytes[i] == b'\\' && i + 1 < bytes.len() {
        let next = bytes[i + 1];
        if (b'0'..=b'3').contains(&next)
          && i + 3 < bytes.len()
          && (b'0'..=b'7').contains(&bytes[i + 2])
          && (b'0'..=b'7').contains(&bytes[i + 3])
        {
          let oct = ((next - b'0') << 6) | ((bytes[i + 2] - b'0') << 3) | (bytes[i + 3] - b'0');
          out.push(oct);
          i += 4;
          continue;
        }
        let decoded = match next {
          b'a' => Some(0x07),
          b'b' => Some(0x08),
          b't' => Some(b'\t'),
          b'n' => Some(b'\n'),
          b'v' => Some(0x0b),
          b'f' => Some(0x0c),
          b'r' => Some(b'\r'),
          b'\\' => Some(b'\\'),
          b'"' => Some(b'"'),
          _ => None,
        };
        if let Some(ch) = decoded {
          out.push(ch);
        } else {
          out.push(b'\\');
          out.push(next);
        }
        i += 2;
      } else {
        out.push(bytes[i]);
        i += 1;
      }
    }
    String::from_utf8(out).unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).into_owned())
  } else {
    raw.to_string()
  }
}

fn parse_git_status_porcelain(status_out: &str) -> Vec<GitFileChangeDto> {
  let mut changes = Vec::new();
  for raw_line in status_out.lines() {
    let line = raw_line.trim_end_matches('\r');
    if line.len() >= 4 && line.as_bytes()[2] == b' ' {
      let code = line[..2].trim().to_string();
      let raw_path = &line[3..];
      let target = if code.starts_with('R') || code.starts_with('C') {
        raw_path
          .split_once(" -> ")
          .map(|(_, new_p)| new_p)
          .unwrap_or(raw_path)
      } else {
        raw_path
      };
      changes.push(GitFileChangeDto {
        status: code,
        path: unquote_git_path(target),
      });
    }
  }
  changes
}

#[tauri::command]
pub fn git_get_status(project_path: String) -> Result<GitStatusDto, String> {
  let branch = run_git_cmd(&project_path, &["branch", "--show-current"])
    .unwrap_or_else(|_| "main".to_string());

  let status_out = run_git_cmd_raw(&project_path, &["status", "--porcelain=v1", "-uall"])
    .unwrap_or_default();

  let changes = parse_git_status_porcelain(&status_out);
  let is_clean = changes.is_empty();
  Ok(GitStatusDto {
    branch,
    changes,
    is_clean,
  })
}

#[tauri::command]
pub fn git_get_diff(project_path: String, file_path: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["diff", "HEAD", "--", &file_path])
    .or_else(|_| run_git_cmd(&project_path, &["diff", "--", &file_path]))
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, TS)]
#[ts(export)]
pub struct GitCommitItemDto {
  pub hash: String,
  pub short_hash: String,
  pub parents: Vec<String>,
  pub author: String,
  pub email: String,
  pub date: String,
  pub subject: String,
  pub branches: Vec<String>,
  pub tags: Vec<String>,
  pub is_head: bool,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, TS)]
#[ts(export)]
pub struct GitCommitDetailsDto {
  pub hash: String,
  pub author: String,
  pub email: String,
  pub date: String,
  pub message: String,
  pub files: Vec<GitFileChangeDto>,
}

#[tauri::command]
pub fn git_commit(project_path: String, message: String, files: Vec<String>, amend: Option<bool>) -> Result<String, String> {
  if files.is_empty() {
    run_git_cmd(&project_path, &["add", "-A"])?;
  } else {
    for f in &files {
      run_git_cmd(&project_path, &["add", "--", f])?;
    }
  }
  if amend.unwrap_or(false) {
    run_git_cmd(&project_path, &["commit", "--amend", "-m", &message])
  } else {
    run_git_cmd(&project_path, &["commit", "-m", &message])
  }
}

#[tauri::command]
pub fn git_add(project_path: String, files: Vec<String>) -> Result<String, String> {
  if files.is_empty() {
    run_git_cmd(&project_path, &["add", "-A"])
  } else {
    let mut args = vec!["add", "--"];
    for f in &files {
      args.push(f.as_str());
    }
    run_git_cmd(&project_path, &args)
  }
}

#[tauri::command]
pub fn git_get_log(project_path: String, max_count: Option<usize>) -> Result<Vec<GitCommitItemDto>, String> {
  let count_arg = format!("-n{}", max_count.unwrap_or(80));
  let mut commits = Vec::new();

  // If working tree has uncommitted modifications, add Working Tree item at top (JetBrains style)
  if let Ok(status) = git_get_status(project_path.clone()) {
    if !status.is_clean {
      commits.push(GitCommitItemDto {
        hash: "0000000000000000000000000000000000000000".to_string(),
        short_hash: "worktree".to_string(),
        parents: Vec::new(),
        author: "You (Local Changes)".to_string(),
        email: "".to_string(),
        date: "Now".to_string(),
        subject: format!("Working Tree ({} changed files)", status.changes.len()),
        branches: vec!["Working Tree".to_string()],
        tags: Vec::new(),
        is_head: true,
      });
    }
  }

  let out = run_git_cmd(&project_path, &[
    "log",
    &count_arg,
    "--all",
    "--date=short",
    "--pretty=format:%H\x1f%h\x1f%P\x1f%an\x1f%ae\x1f%ad\x1f%s\x1f%D",
  ])?;
  for line in out.lines() {
    let parts: Vec<&str> = line.split('\x1f').collect();
    if parts.len() >= 7 {
      let hash = parts[0].to_string();
      let short_hash = parts[1].to_string();
      let parents: Vec<String> = if !parts[2].trim().is_empty() {
        parts[2].split_whitespace().map(|s| s.to_string()).collect()
      } else {
        Vec::new()
      };
      let author = parts[3].to_string();
      let email = parts[4].to_string();
      let date = parts[5].to_string();
      let subject = parts[6].to_string();
      let mut branches = Vec::new();
      let mut tags = Vec::new();
      let mut is_head = false;
      if parts.len() >= 8 && !parts[7].trim().is_empty() {
        for ref_item in parts[7].split(',') {
          let r = ref_item.trim();
          if r.starts_with("HEAD -> ") {
            is_head = true;
            branches.push(r[8..].to_string());
          } else if r == "HEAD" {
            is_head = true;
          } else if r.starts_with("tag: ") {
            tags.push(r[5..].to_string());
          } else if !r.is_empty() {
            branches.push(r.to_string());
          }
        }
      }

      commits.push(GitCommitItemDto {
        hash,
        short_hash,
        parents,
        author,
        email,
        date,
        subject,
        branches,
        tags,
        is_head,
      });
    }
  }
  Ok(commits)
}

#[tauri::command]
pub fn git_get_commit_details(project_path: String, commit_hash: String) -> Result<GitCommitDetailsDto, String> {
  // Handle Working Tree (uncommitted changes)
  if commit_hash.starts_with("0000000") || commit_hash == "worktree" {
    let status = git_get_status(project_path)?;
    return Ok(GitCommitDetailsDto {
      hash: "0000000000000000000000000000000000000000".to_string(),
      author: "You (Local Changes)".to_string(),
      email: "".to_string(),
      date: "Now".to_string(),
      message: "Uncommitted changes in local working tree".to_string(),
      files: status.changes,
    });
  }

  let valid_hash = validate_git_ref_arg(&commit_hash, "commit_hash")?;
  let meta_out = run_git_cmd(&project_path, &["show", "-s", "--pretty=format:%H\t%an\t%ae\t%ad\t%B", "--date=short", valid_hash, "--"])?;
  let parts: Vec<&str> = meta_out.splitn(5, '\t').collect();
  let (hash, author, email, date, message) = if parts.len() >= 5 {
    (parts[0].to_string(), parts[1].to_string(), parts[2].to_string(), parts[3].to_string(), parts[4].trim().to_string())
  } else {
    (valid_hash.to_string(), "Unknown".to_string(), "".to_string(), "".to_string(), "".to_string())
  };

  let files_out = run_git_cmd_raw(&project_path, &["diff-tree", "--no-commit-id", "--name-status", "-r", valid_hash, "--"])
    .unwrap_or_default();
  let files = parse_name_status_lines(&files_out);

  Ok(GitCommitDetailsDto {
    hash,
    author,
    email,
    date,
    message,
    files,
  })
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, TS)]
#[ts(export)]
pub struct GitBlameLineDto {
  pub line: usize,
  pub commit_hash: String,
  pub short_hash: String,
  pub author: String,
  pub email: String,
  pub date: String,
  pub relative_time: String,
  pub summary: String,
}

#[derive(Default, Clone)]
struct CommitMeta {
  author: String,
  email: String,
  time: i64,
  summary: String,
}

#[tauri::command]
pub fn git_get_blame(project_path: String, file_path: String) -> Result<Vec<GitBlameLineDto>, String> {
  let clean_file = file_path.replace('\\', "/");
  let out = run_git_cmd_raw(&project_path, &["blame", "--line-porcelain", "--", &clean_file])?;
  
  let now_secs = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_secs() as i64)
    .unwrap_or(0);

  let mut commit_cache: std::collections::HashMap<String, CommitMeta> = std::collections::HashMap::new();
  let mut lines_result = Vec::new();

  let mut cur_hash = String::new();
  let mut cur_line_num: usize = 0;
  let mut cur_meta = CommitMeta::default();

  for line in out.lines() {
    if line.starts_with('\t') {
      if !cur_hash.is_empty() && cur_line_num > 0 {
        commit_cache.insert(cur_hash.clone(), cur_meta.clone());

        let diff = if now_secs > cur_meta.time && cur_meta.time > 0 {
          now_secs - cur_meta.time
        } else {
          0
        };

        let relative_time = if cur_meta.time == 0 {
          "Not committed".to_string()
        } else if diff < 60 {
          "just now".to_string()
        } else if diff < 3600 {
          format!("{}m ago", diff / 60)
        } else if diff < 86400 {
          format!("{}h ago", diff / 3600)
        } else if diff < 7 * 86400 {
          format!("{}d ago", diff / 86400)
        } else if diff < 30 * 86400 {
          format!("{}w ago", diff / (7 * 86400))
        } else {
          format!("{}mo ago", diff / (30 * 86400))
        };

        let short_hash = if cur_hash.len() >= 7 {
          cur_hash[..7].to_string()
        } else {
          cur_hash.clone()
        };

        lines_result.push(GitBlameLineDto {
          line: cur_line_num,
          commit_hash: cur_hash.clone(),
          short_hash,
          author: if cur_meta.author.is_empty() { "Unknown".to_string() } else { cur_meta.author.clone() },
          email: cur_meta.email.clone(),
          date: format!("{}", cur_meta.time),
          relative_time,
          summary: if cur_meta.summary.is_empty() { "Commit".to_string() } else { cur_meta.summary.clone() },
        });
      }
      cur_hash.clear();
      cur_line_num = 0;
      cur_meta = CommitMeta::default();
    } else if let Some(space_idx) = line.find(' ') {
      let first_token = &line[..space_idx];
      if first_token.len() == 40 && first_token.chars().all(|c| c.is_ascii_hexdigit()) {
        cur_hash = first_token.to_string();
        let rest = line[space_idx + 1..].trim();
        let parts: Vec<&str> = rest.split_whitespace().collect();
        if parts.len() >= 2 {
          if let Ok(ln) = parts[1].parse::<usize>() {
            cur_line_num = ln;
          }
        }
        if let Some(cached) = commit_cache.get(&cur_hash) {
          cur_meta = cached.clone();
        }
      } else if line.starts_with("author ") {
        cur_meta.author = line[7..].trim().to_string();
      } else if line.starts_with("author-mail ") {
        cur_meta.email = line[12..].trim().trim_matches(|c| c == '<' || c == '>').to_string();
      } else if line.starts_with("author-time ") {
        if let Ok(t) = line[12..].trim().parse::<i64>() {
          cur_meta.time = t;
        }
      } else if line.starts_with("summary ") {
        cur_meta.summary = line[8..].trim().to_string();
      }
    }
  }

  Ok(lines_result)
}

#[tauri::command]
pub fn git_get_file_content_at_head(project_path: String, file_path: String) -> Result<String, String> {
  let (clean_path, _) = validate_repo_relative_path(&project_path, &file_path)?;
  let target = format!("HEAD:{}", clean_path);
  run_git_cmd(&project_path, &["show", &target])
}

#[tauri::command]
pub fn git_get_file_content_at_revision(project_path: String, revision: String, file_path: String) -> Result<String, String> {
  let (trimmed_rel, full_path) = validate_repo_relative_path(&project_path, &file_path)?;
  if revision == "WORKING_TREE" {
    std::fs::read_to_string(&full_path).map_err(|e| format!("Failed to read file: {}", e))
  } else {
    let valid_rev = validate_git_ref_arg(&revision, "revision")?;
    let target = format!("{}:{}", valid_rev, trimmed_rel);
    run_git_cmd(&project_path, &["show", &target])
  }
}

#[tauri::command]
pub fn git_rollback_file(project_path: String, file_path: String) -> Result<String, String> {
  let (clean_rel, _) = validate_repo_relative_path(&project_path, &file_path)?;
  run_git_cmd(&project_path, &["checkout", "HEAD", "--", &clean_rel])
    .or_else(|_| run_git_cmd(&project_path, &["restore", "--", &clean_rel]))
}

#[tauri::command]
pub fn git_fetch(project_path: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["fetch", "--all", "--prune"])
}

#[tauri::command]
pub fn git_pull(project_path: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["pull"])
}

#[tauri::command]
pub fn git_push(project_path: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["push"])
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, TS)]
#[ts(export)]
pub struct GitBranchInfoDto {
  pub name: String,
  pub short_name: String,
  pub is_current: bool,
  pub is_remote: bool,
  pub upstream: Option<String>,
}

#[tauri::command]
pub fn git_list_branches(project_path: String) -> Result<Vec<GitBranchInfoDto>, String> {
  let out = run_git_cmd(&project_path, &[
    "for-each-ref",
    "--format=%(refname)|%(refname:short)|%(HEAD)|%(upstream:short)",
    "refs/heads/",
    "refs/remotes/",
  ])?;
  let mut list = Vec::new();
  for line in out.lines() {
    let parts: Vec<&str> = line.split('|').collect();
    if parts.len() >= 3 {
      let refname = parts[0].trim();
      let short_name = parts[1].trim().to_string();
      let is_current = parts[2].trim() == "*";
      let upstream = if parts.len() >= 4 && !parts[3].trim().is_empty() {
        Some(parts[3].trim().to_string())
      } else {
        None
      };
      let is_remote = refname.starts_with("refs/remotes/");
      
      if short_name.ends_with("/HEAD") || short_name == "origin" {
        continue;
      }

      list.push(GitBranchInfoDto {
        name: short_name.clone(),
        short_name,
        is_current,
        is_remote,
        upstream,
      });
    }
  }
  if list.is_empty() {
    list.push(GitBranchInfoDto {
      name: "main".to_string(),
      short_name: "main".to_string(),
      is_current: true,
      is_remote: false,
      upstream: None,
    });
  }
  Ok(list)
}

#[tauri::command]
pub fn git_get_tags(project_path: String) -> Result<Vec<String>, String> {
  let out = run_git_cmd(&project_path, &["tag", "--list", "--sort=-creatordate"])?;
  let tags: Vec<String> = out.lines()
    .map(|l| l.trim().to_string())
    .filter(|l| !l.is_empty())
    .collect();
  Ok(tags)
}

#[tauri::command]
pub fn git_checkout_branch(project_path: String, branch: String, create_new: bool) -> Result<String, String> {
  let valid_branch = validate_git_ref_arg(&branch, "branch")?;
  if create_new {
    run_git_cmd(&project_path, &["checkout", "-b", valid_branch])
  } else {
    run_git_cmd(&project_path, &["checkout", valid_branch])
  }
}

fn validate_clone_url(url: &str) -> Result<(), String> {
  let trimmed = url.trim();
  if trimmed.is_empty() {
    return Err("Repository URL cannot be empty".to_string());
  }
  if trimmed.starts_with('-') {
    return Err("Invalid repository URL: cannot start with '-'".to_string());
  }
  let lower = trimmed.to_ascii_lowercase();
  if lower.starts_with("ext::") || lower.starts_with("file://") {
    return Err("Unsupported repository protocol".to_string());
  }
  Ok(())
}

fn extract_http_origin(url: &str) -> Option<(String, String)> {
  let trimmed = url.trim();
  let (scheme, rest) = if let Some(r) = trimmed.strip_prefix("https://").or_else(|| {
    if trimmed.len() >= 8 && trimmed[..8].eq_ignore_ascii_case("https://") {
      Some(&trimmed[8..])
    } else {
      None
    }
  }) {
    ("https".to_string(), r)
  } else if let Some(r) = trimmed.strip_prefix("http://").or_else(|| {
    if trimmed.len() >= 7 && trimmed[..7].eq_ignore_ascii_case("http://") {
      Some(&trimmed[7..])
    } else {
      None
    }
  }) {
    ("http".to_string(), r)
  } else {
    return None;
  };

  let authority = rest.split(['/', '?', '#']).next()?.trim();
  if authority.is_empty() || authority.contains('@') || authority.contains('\\') {
    return None;
  }
  Some((scheme.clone(), format!("{}://{}", scheme, authority.to_ascii_lowercase())))
}

fn encode_base64(input: &[u8]) -> String {
  const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let mut out = String::with_capacity(input.len().div_ceil(3) * 4);
  for chunk in input.chunks(3) {
    let b0 = chunk[0] as u32;
    let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
    let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
    let triple = (b0 << 16) | (b1 << 8) | b2;
    out.push(TABLE[((triple >> 18) & 0x3F) as usize] as char);
    out.push(TABLE[((triple >> 12) & 0x3F) as usize] as char);
    out.push(if chunk.len() > 1 { TABLE[((triple >> 6) & 0x3F) as usize] as char } else { '=' });
    out.push(if chunk.len() > 2 { TABLE[(triple & 0x3F) as usize] as char } else { '=' });
  }
  out
}

fn build_git_clone_config_env(
  url: &str,
  token: Option<&str>,
  expected_host: Option<&str>,
  allow_self_signed: bool,
) -> Result<Vec<(String, String)>, String> {
  let mut configs: Vec<(String, String)> = Vec::new();
  let origin_info = extract_http_origin(url);

  if let Some(tok) = token {
    let trimmed_tok = tok.trim();
    if trimmed_tok.is_empty() {
      return Err("Stored GitLab token is empty. Please reconnect your account.".to_string());
    }
    let (scheme, origin) = origin_info
      .as_ref()
      .ok_or_else(|| "GitLab token authentication requires an HTTPS repository URL".to_string())?;
    if scheme != "https" {
      return Err("Refusing to send GitLab token over insecure http:// URL. Use https:// or SSH.".to_string());
    }
    if let Some(host) = expected_host {
      let (_, expected_origin) = extract_http_origin(host)
        .ok_or_else(|| "Invalid stored GitLab account host".to_string())?;
      if *origin != expected_origin {
        return Err(format!(
          "Repository origin '{}' does not match saved GitLab account host '{}'",
          origin, expected_origin
        ));
      }
    }
    let basic = encode_base64(format!("oauth2:{}", trimmed_tok).as_bytes());
    configs.push((
      format!("http.{}.extraHeader", origin),
      format!("Authorization: Basic {}", basic),
    ));
  }

  if allow_self_signed {
    if let Some((_, origin)) = origin_info {
      configs.push((format!("http.{}.sslVerify", origin), "false".to_string()));
    }
  }

  if configs.is_empty() {
    return Ok(Vec::new());
  }

  let mut envs = vec![("GIT_CONFIG_COUNT".to_string(), configs.len().to_string())];
  for (idx, (k, v)) in configs.into_iter().enumerate() {
    envs.push((format!("GIT_CONFIG_KEY_{}", idx), k));
    envs.push((format!("GIT_CONFIG_VALUE_{}", idx), v));
  }
  Ok(envs)
}

fn scrub_url_credentials(line: &str) -> String {
  let mut out = String::with_capacity(line.len());
  let lower = line.to_ascii_lowercase();
  let mut cursor = 0usize;

  while cursor < line.len() {
    let rest_lower = &lower[cursor..];
    let http_pos = rest_lower.find("http://");
    let https_pos = rest_lower.find("https://");
    let next_rel = match (http_pos, https_pos) {
      (Some(a), Some(b)) => Some(a.min(b)),
      (Some(a), None) => Some(a),
      (None, Some(b)) => Some(b),
      (None, None) => None,
    };

    let Some(rel) = next_rel else {
      out.push_str(&line[cursor..]);
      break;
    };
    let url_start = cursor + rel;
    out.push_str(&line[cursor..url_start]);

    let scheme_len = if lower[url_start..].starts_with("https://") { 8 } else { 7 };
    let after_scheme = url_start + scheme_len;
    let auth_end_rel = line[after_scheme..]
      .find(|c: char| c == '/' || c == '?' || c == '#' || c.is_whitespace() || c == '\'' || c == '"' || c == '>')
      .unwrap_or(line.len() - after_scheme);
    let authority = &line[after_scheme..after_scheme + auth_end_rel];

    out.push_str(&line[url_start..after_scheme]);
    if let Some(at_pos) = authority.rfind('@') {
      out.push_str("[REDACTED]@");
      out.push_str(&authority[at_pos + 1..]);
    } else {
      out.push_str(authority);
    }
    cursor = after_scheme + auth_end_rel;
  }

  out
}

fn redact_secrets(text: &str) -> String {
  text
    .lines()
    .map(|line| {
      if line.to_ascii_lowercase().contains("authorization:") {
        "Authorization: [REDACTED]".to_string()
      } else {
        scrub_url_credentials(line)
      }
    })
    .collect::<Vec<_>>()
    .join("\n")
}

#[tauri::command]
pub fn git_clone(
  url: String,
  target_dir: String,
  account_id: Option<String>,
  allow_self_signed: Option<bool>,
) -> Result<String, String> {
  let trimmed_url = url.trim();
  let trimmed_dir = target_dir.trim();
  validate_clone_url(trimmed_url)?;
  if trimmed_dir.is_empty() {
    return Err("Target directory cannot be empty".to_string());
  }

  let git_bin = get_git_executable();
  if git_bin != "git" && !std::path::Path::new(&git_bin).is_file() {
    return Err(format!("Configured Git executable not found: {}", git_bin));
  }

  let secret = if let Some(ref acc_id) = account_id {
    let trimmed_id = acc_id.trim();
    if trimmed_id.is_empty() {
      None
    } else {
      Some(load_gitlab_secret(trimmed_id)?)
    }
  } else {
    None
  };

  let envs = build_git_clone_config_env(
    trimmed_url,
    secret.as_ref().map(|s| s.token.as_str()),
    secret.as_ref().map(|s| s.host.as_str()),
    allow_self_signed.unwrap_or(false),
  )?;

  let target = std::path::Path::new(trimmed_dir);
  if let Some(parent) = target.parent() {
    let _ = std::fs::create_dir_all(parent);
  }

  let mut cmd = Command::new(&git_bin);
  for (k, _) in std::env::vars() {
    let upper = k.to_ascii_uppercase();
    if upper.starts_with("GIT_CONFIG_")
      || upper.starts_with("GIT_TRACE2")
      || matches!(upper.as_str(), "GIT_TRACE" | "GIT_TRACE_CURL" | "GIT_CURL_VERBOSE")
    {
      cmd.env_remove(&k);
    }
  }
  cmd.env("GIT_TERMINAL_PROMPT", "0");
  cmd.env("GCM_INTERACTIVE", "never");
  for (k, v) in envs {
    cmd.env(k, v);
  }
  cmd.args(["clone", "--", trimmed_url, trimmed_dir]);
  #[cfg(windows)]
  cmd.creation_flags(0x08000000);

  let output = cmd.output().map_err(|e| format!("Failed to run git clone: {}", e))?;
  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    return Err(redact_secrets(&format!("Git clone failed: {}\n{}", stderr, stdout)));
  }
  Ok(trimmed_dir.to_string())
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct GitStashItemDto {
  pub index: usize,
  pub hash: String,
  pub branch: String,
  pub date: String,
  pub message: String,
}

#[tauri::command]
pub fn git_get_stash_list(project_path: String) -> Result<Vec<GitStashItemDto>, String> {
  let out = run_git_cmd(&project_path, &["stash", "list", "--pretty=format:%gd%x09%h%x09%cr%x09%gs"])?;
  let mut list = Vec::new();
  for line in out.lines() {
    let parts: Vec<&str> = line.split('\t').collect();
    if parts.len() >= 4 {
      let idx_str = parts[0].trim().replace("stash@{", "").replace("}", "");
      let index = idx_str.parse::<usize>().unwrap_or(0);
      let hash = parts[1].trim().to_string();
      let date = parts[2].trim().to_string();
      let full_msg = parts[3].trim().to_string();
      let mut branch = "main".to_string();
      let mut message = full_msg.clone();
      if let Some(pos) = full_msg.find(": ") {
        let b = &full_msg[..pos];
        if b.starts_with("WIP on ") {
          branch = b.replace("WIP on ", "");
        } else if b.starts_with("On ") {
          branch = b.replace("On ", "");
        }
        message = full_msg[pos + 2..].to_string();
      }
      list.push(GitStashItemDto {
        index,
        hash,
        branch,
        date,
        message,
      });
    }
  }
  Ok(list)
}

#[tauri::command]
pub fn git_stash_save(project_path: String, message: String, keep_index: bool) -> Result<String, String> {
  if keep_index {
    run_git_cmd(&project_path, &["stash", "push", "--keep-index", "-m", &message])
  } else {
    run_git_cmd(&project_path, &["stash", "push", "-m", &message])
  }
}

#[tauri::command]
pub fn git_stash_pop(project_path: String, index: usize) -> Result<String, String> {
  let target = format!("stash@{{{}}}", index);
  run_git_cmd(&project_path, &["stash", "pop", &target])
}

#[tauri::command]
pub fn git_stash_apply(project_path: String, index: usize) -> Result<String, String> {
  let target = format!("stash@{{{}}}", index);
  run_git_cmd(&project_path, &["stash", "apply", &target])
}

#[tauri::command]
pub fn git_stash_drop(project_path: String, index: usize) -> Result<String, String> {
  let target = format!("stash@{{{}}}", index);
  run_git_cmd(&project_path, &["stash", "drop", &target])
}

#[tauri::command]
pub fn git_stash_clear(project_path: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["stash", "clear"])
}

#[tauri::command]
pub fn git_stash_get_files(project_path: String, index: usize) -> Result<Vec<GitFileChangeDto>, String> {
  let target = format!("stash@{{{}}}", index);
  let files_out = run_git_cmd_raw(&project_path, &["stash", "show", "--name-status", &target])?;
  Ok(parse_name_status_lines(&files_out))
}

#[tauri::command]
pub fn git_reset_branch(project_path: String, commit_hash: String, mode: String) -> Result<String, String> {
  let valid_hash = validate_git_ref_arg(&commit_hash, "commit_hash")?;
  let flag = match mode.to_lowercase().as_str() {
    "soft" => "--soft",
    "hard" => "--hard",
    "keep" => "--keep",
    _ => "--mixed",
  };
  run_git_cmd(&project_path, &["reset", flag, valid_hash])
}

#[tauri::command]
pub fn git_cherry_pick(project_path: String, commit_hash: String) -> Result<String, String> {
  let valid_hash = validate_git_ref_arg(&commit_hash, "commit_hash")?;
  run_git_cmd(&project_path, &["cherry-pick", valid_hash])
}

#[tauri::command]
pub fn git_revert_commit(project_path: String, commit_hash: String) -> Result<String, String> {
  let valid_hash = validate_git_ref_arg(&commit_hash, "commit_hash")?;
  run_git_cmd(&project_path, &["revert", "--no-edit", valid_hash])
}

#[tauri::command]
pub fn git_create_tag(project_path: String, tag_name: String, commit_hash: Option<String>) -> Result<String, String> {
  let valid_tag = validate_git_ref_arg(&tag_name, "tag_name")?;
  if let Some(ref hash) = commit_hash {
    let valid_hash = validate_git_ref_arg(hash, "commit_hash")?;
    run_git_cmd(&project_path, &["tag", valid_tag, valid_hash])
  } else {
    run_git_cmd(&project_path, &["tag", valid_tag])
  }
}

#[tauri::command]
pub fn git_create_branch_from(project_path: String, new_branch: String, start_point: String, checkout: bool) -> Result<String, String> {
  let valid_new = validate_git_ref_arg(&new_branch, "new_branch")?;
  let valid_start = validate_git_ref_arg(&start_point, "start_point")?;
  if checkout {
    run_git_cmd(&project_path, &["checkout", "-b", valid_new, valid_start])
  } else {
    run_git_cmd(&project_path, &["branch", valid_new, valid_start])
  }
}

#[tauri::command]
pub fn git_delete_branch(project_path: String, branch: String, force: bool) -> Result<String, String> {
  let valid_branch = validate_git_ref_arg(&branch, "branch")?;
  let flag = if force { "-D" } else { "-d" };
  run_git_cmd(&project_path, &["branch", flag, valid_branch])
}

#[tauri::command]
pub fn git_rename_branch(project_path: String, old_name: String, new_name: String) -> Result<String, String> {
  let valid_old = validate_git_ref_arg(&old_name, "old_name")?;
  let valid_new = validate_git_ref_arg(&new_name, "new_name")?;
  run_git_cmd(&project_path, &["branch", "-m", valid_old, valid_new])
}

#[tauri::command]
pub fn git_merge_branch(project_path: String, branch: String) -> Result<String, String> {
  let valid_branch = validate_git_ref_arg(&branch, "branch")?;
  run_git_cmd(&project_path, &["merge", valid_branch])
}

#[tauri::command]
pub fn git_rebase_branch(project_path: String, upstream: String) -> Result<String, String> {
  let valid_upstream = validate_git_ref_arg(&upstream, "upstream")?;
  run_git_cmd(&project_path, &["rebase", valid_upstream])
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitRebaseItemDto {
  pub hash: String,
  pub action: String,
  pub subject: Option<String>,
}

#[tauri::command]
pub fn git_interactive_rebase(
  project_path: String,
  base_commit: String,
  items: Vec<GitRebaseItemDto>,
) -> Result<String, String> {
  let valid_base = validate_git_ref_arg(&base_commit, "base_commit")?;
  let git_bin = get_git_executable();
  let temp_dir = std::env::temp_dir();
  let timestamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default()
    .as_millis();
  let unique_id = format!(
    "{}-{}-{}",
    std::process::id(),
    REBASE_TMP_SEQ.fetch_add(1, Ordering::Relaxed),
    timestamp
  );

  let todo_file = temp_dir.join(format!("git-rebase-todo-{}.txt", unique_id));
  let mut todo_content = String::new();
  for item in &items {
    let valid_hash = validate_git_ref_arg(&item.hash, "rebase item hash")?;
    let act = match item.action.to_lowercase().as_str() {
      "squash" | "s" => "squash",
      "fixup" | "f" => "fixup",
      "drop" | "d" => "drop",
      "reword" | "r" => "reword",
      "edit" | "e" => "edit",
      _ => "pick",
    };
    let subj = item.subject.as_deref().unwrap_or("");
    if subj.contains(['\r', '\n', '\0']) {
      return Err("Invalid rebase item subject: newline or NUL character not allowed".to_string());
    }
    todo_content.push_str(&format!("{} {} {}\n", act, valid_hash, subj));
  }
  std::fs::write(&todo_file, &todo_content)
    .map_err(|e| format!("Failed to create rebase todo file: {}", e))?;

  #[cfg(windows)]
  let script_file = temp_dir.join(format!("seq-editor-{}.bat", unique_id));
  #[cfg(not(windows))]
  let script_file = temp_dir.join(format!("seq-editor-{}.sh", unique_id));

  #[cfg(windows)]
  {
    let todo_str = todo_file.to_string_lossy().replace('/', "\\");
    let script_content = format!("@echo off\r\ncopy /y \"{}\" \"%~1\" >nul\r\n", todo_str);
    if let Err(e) = std::fs::write(&script_file, script_content) {
      let _ = std::fs::remove_file(&todo_file);
      return Err(format!("Failed to write sequence editor script: {}", e));
    }
  }
  #[cfg(not(windows))]
  {
    let script_content = format!("#!/bin/sh\ncp -f \"{}\" \"$1\"\n", todo_file.to_string_lossy());
    if let Err(e) = std::fs::write(&script_file, script_content) {
      let _ = std::fs::remove_file(&todo_file);
      return Err(format!("Failed to write sequence editor script: {}", e));
    }
    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      if let Err(e) = std::fs::set_permissions(&script_file, std::fs::Permissions::from_mode(0o755)) {
        let _ = std::fs::remove_file(&todo_file);
        let _ = std::fs::remove_file(&script_file);
        return Err(format!("Failed to mark sequence editor script executable: {}", e));
      }
    }
  }

  let work_dir = if project_path.trim().is_empty() { "." } else { project_path.trim() };
  let mut cmd = Command::new(&git_bin);
  cmd.args(&["rebase", "-i", valid_base]);
  cmd.current_dir(work_dir);
  #[cfg(windows)]
  {
    cmd.env("GIT_SEQUENCE_EDITOR", format!("\"{}\"", script_file.to_string_lossy().replace('/', "\\")));
    cmd.env("GIT_EDITOR", "cmd /c exit 0");
    cmd.creation_flags(0x08000000);
  }
  #[cfg(not(windows))]
  {
    cmd.env("GIT_SEQUENCE_EDITOR", format!("\"{}\"", script_file.to_string_lossy()));
    cmd.env("GIT_EDITOR", "true");
  }

  let output = cmd.output();

  // Cleanup temp files
  let _ = std::fs::remove_file(&todo_file);
  let _ = std::fs::remove_file(&script_file);

  match output {
    Ok(out) => {
      if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
      } else {
        let err_msg = String::from_utf8_lossy(&out.stderr).trim().to_string();
        let out_msg = String::from_utf8_lossy(&out.stdout).trim().to_string();
        let combined = if err_msg.is_empty() { out_msg } else { format!("{}\n{}", err_msg, out_msg) };
        Err(combined)
      }
    }
    Err(e) => Err(format!("Failed to execute git rebase: {}", e)),
  }
}

#[tauri::command]
pub fn git_create_patch(project_path: String, commit_hash: String) -> Result<String, String> {
  let valid_hash = validate_git_ref_arg(&commit_hash, "commit_hash")?;
  run_git_cmd(&project_path, &["format-patch", "-1", "--stdout", valid_hash])
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitConflictFileDto {
  pub path: String,
  pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitConflictStagesDto {
  pub file_path: String,
  pub base: String,
  pub ours: String,
  pub theirs: String,
  pub current: String,
}

#[tauri::command]
pub fn git_get_conflicts(project_path: String) -> Result<Vec<GitConflictFileDto>, String> {
  let out = run_git_cmd(&project_path, &["status", "--porcelain=v1"]).unwrap_or_default();
  let mut conflicts = Vec::new();
  for line in out.lines() {
    let trimmed = line.trim();
    if trimmed.len() >= 3 {
      let code = &trimmed[..2];
      // Unmerged codes in git status: UU, AA, UD, UY, DU, AU, DD
      if code.contains('U') || code == "AA" || code == "DD" {
        let path = trimmed[2..].trim().to_string();
        conflicts.push(GitConflictFileDto {
          path,
          status: code.to_string(),
        });
      }
    }
  }
  Ok(conflicts)
}

#[tauri::command]
pub fn git_get_conflict_stages(project_path: String, file_path: String) -> Result<GitConflictStagesDto, String> {
  let (trimmed, full_path) = validate_repo_relative_path(&project_path, &file_path)?;

  // Stage 1: Common Ancestor (Base)
  let base = run_git_cmd(&project_path, &["show", &format!(":1:{}", trimmed)]).unwrap_or_default();
  // Stage 2: Target branch / Ours (Yours)
  let ours = run_git_cmd(&project_path, &["show", &format!(":2:{}", trimmed)]).unwrap_or_default();
  // Stage 3: Source branch / Theirs (Incoming)
  let theirs = run_git_cmd(&project_path, &["show", &format!(":3:{}", trimmed)]).unwrap_or_default();

  // Read current working tree file (which may contain <<<<<<< markers)
  let current = std::fs::read_to_string(&full_path).unwrap_or_default();

  Ok(GitConflictStagesDto {
    file_path: file_path.clone(),
    base,
    ours,
    theirs,
    current,
  })
}

#[tauri::command]
pub fn git_resolve_conflict(project_path: String, file_path: String, resolved_content: String) -> Result<String, String> {
  let (trimmed, full_path) = validate_repo_relative_path(&project_path, &file_path)?;

  // Write resolved content to disk
  std::fs::write(&full_path, resolved_content)
    .map_err(|e| format!("Failed to write resolved file {}: {}", file_path, e))?;

  // Mark conflict as resolved via git add
  run_git_cmd(&project_path, &["add", "--", &trimmed])
}

const GITLAB_KEYRING_SERVICE: &str = "custom-idea-gitlab";

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct StoredGitLabSecret {
  host: String,
  token: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, TS)]
#[ts(export)]
pub struct GitLabUserDto {
  #[ts(type = "number")]
  pub id: i64,
  pub username: String,
  pub name: String,
  pub email: Option<String>,
  pub avatar_url: Option<String>,
  pub web_url: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, TS)]
#[ts(export)]
pub struct GitLabProjectDto {
  #[ts(type = "number")]
  pub id: i64,
  pub name: String,
  pub name_with_namespace: String,
  pub path_with_namespace: String,
  pub http_url_to_repo: String,
  pub ssh_url_to_repo: String,
  pub default_branch: Option<String>,
  pub visibility: Option<String>,
  pub description: Option<String>,
  pub last_activity_at: Option<String>,
  pub web_url: Option<String>,
  #[ts(type = "number | null")]
  pub star_count: Option<i64>,
}

fn normalize_gitlab_base_url(host: &str) -> Result<String, String> {
  let trimmed = host.trim();
  if trimmed.is_empty() {
    return Err("GitLab Server URL cannot be empty".to_string());
  }
  if trimmed.contains(['?', '#']) {
    return Err("Invalid GitLab Server URL: query string and fragment are not allowed".to_string());
  }
  let lower = trimmed.to_ascii_lowercase();
  let candidate = if lower.starts_with("http://") {
    return Err("HTTPS is required for GitLab authentication".to_string());
  } else if let Some(scheme_sep) = lower.find("://") {
    if &lower[..scheme_sep] != "https" {
      return Err("Unsupported GitLab URL scheme (https:// required)".to_string());
    }
    trimmed.trim_end_matches('/').to_string()
  } else if lower.ends_with(':') {
    return Err("Invalid GitLab Server URL".to_string());
  } else {
    format!("https://{}", trimmed.trim_end_matches('/'))
  };

  if extract_http_origin(&candidate).is_none() {
    return Err("Invalid GitLab Server URL".to_string());
  }
  Ok(candidate)
}

fn save_gitlab_secret(account_id: &str, host: &str, token: &str) -> Result<(), String> {
  let entry = keyring::Entry::new(GITLAB_KEYRING_SERVICE, account_id)
    .map_err(|e| format!("Failed to access OS credential manager: {}", e))?;
  let payload = serde_json::to_string(&StoredGitLabSecret {
    host: host.to_string(),
    token: token.to_string(),
  })
  .map_err(|e| format!("Failed to serialize GitLab credential: {}", e))?;
  entry
    .set_password(&payload)
    .map_err(|e| format!("Failed to save GitLab token in OS credential manager: {}", e))
}

fn load_gitlab_secret(account_id: &str) -> Result<StoredGitLabSecret, String> {
  let entry = keyring::Entry::new(GITLAB_KEYRING_SERVICE, account_id)
    .map_err(|e| format!("Failed to access OS credential manager: {}", e))?;
  let raw = entry.get_password().map_err(|e| match e {
    keyring::Error::NoEntry => {
      "GitLab token not found in OS Credential Manager. Please reconnect your account.".to_string()
    }
    other => format!("Failed to read GitLab token from OS credential manager: {}", other),
  })?;
  serde_json::from_str::<StoredGitLabSecret>(&raw).map_err(|e| {
    format!(
      "Stored GitLab credential is corrupted ({}). Please reconnect your account.",
      e
    )
  })
}

fn delete_gitlab_secret(account_id: &str) -> Result<(), String> {
  let entry = keyring::Entry::new(GITLAB_KEYRING_SERVICE, account_id)
    .map_err(|e| format!("Failed to access OS credential manager: {}", e))?;
  match entry.delete_credential() {
    Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
    Err(e) => Err(format!("Failed to delete GitLab token from OS credential manager: {}", e)),
  }
}

#[tauri::command]
pub fn gitlab_save_token(account_id: String, host: String, token: String) -> Result<(), String> {
  let trimmed_id = account_id.trim();
  let trimmed_token = token.trim();
  if trimmed_id.is_empty() {
    return Err("Account ID cannot be empty".to_string());
  }
  if trimmed_token.is_empty() {
    return Err("Personal Access Token cannot be empty".to_string());
  }
  let norm_host = normalize_gitlab_base_url(&host)?;
  save_gitlab_secret(trimmed_id, &norm_host, trimmed_token)
}

#[tauri::command]
pub fn gitlab_delete_token(account_id: String) -> Result<(), String> {
  let trimmed_id = account_id.trim();
  if trimmed_id.is_empty() {
    return Ok(());
  }
  delete_gitlab_secret(trimmed_id)
}

static GITLAB_CLIENT_VERIFIED: LazyLock<Result<reqwest::Client, String>> = LazyLock::new(|| {
  reqwest::Client::builder()
    .danger_accept_invalid_certs(false)
    .timeout(std::time::Duration::from_secs(15))
    .build()
    .map_err(|e| format!("Failed to create HTTP client: {}", e))
});

static GITLAB_CLIENT_INSECURE: LazyLock<Result<reqwest::Client, String>> = LazyLock::new(|| {
  reqwest::Client::builder()
    .danger_accept_invalid_certs(true)
    .timeout(std::time::Duration::from_secs(15))
    .build()
    .map_err(|e| format!("Failed to create insecure HTTP client: {}", e))
});

fn get_gitlab_http_client(allow_self_signed: bool) -> Result<&'static reqwest::Client, String> {
  let slot = if allow_self_signed {
    &*GITLAB_CLIENT_INSECURE
  } else {
    &*GITLAB_CLIENT_VERIFIED
  };
  slot.as_ref().map_err(|e| e.clone())
}

async fn gitlab_get<T: serde::de::DeserializeOwned>(
  base_url: &str,
  path: &str,
  token: &str,
  allow_self_signed: bool,
  query: &[(&str, &str)],
) -> Result<T, String> {
  let client = get_gitlab_http_client(allow_self_signed)?;
  let api_url = format!("{}{}", base_url, path);

  let mut req = client
    .get(&api_url)
    .header("PRIVATE-TOKEN", token.trim())
    .header("User-Agent", "Custom-IDEA-GitLab/1.0");
  if !query.is_empty() {
    req = req.query(query);
  }

  let res = req
    .send()
    .await
    .map_err(|e| format!("Connection error to GitLab ({}): {}", base_url, e))?;

  if !res.status().is_success() {
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    return Err(format!("GitLab returned HTTP {}: {}", status, body));
  }

  res
    .json::<T>()
    .await
    .map_err(|e| format!("Failed to parse GitLab response: {}", e))
}

#[tauri::command]
pub async fn gitlab_test_connection(
  host: String,
  token: String,
  allow_self_signed: Option<bool>,
) -> Result<GitLabUserDto, String> {
  let base_url = normalize_gitlab_base_url(&host)?;
  gitlab_get(
    &base_url,
    "/api/v4/user",
    token.trim(),
    allow_self_signed.unwrap_or(false),
    &[],
  )
  .await
}

#[tauri::command]
pub async fn gitlab_list_projects(
  host: String,
  account_id: String,
  allow_self_signed: Option<bool>,
  search: Option<String>,
  page: Option<u32>,
  per_page: Option<u32>,
) -> Result<Vec<GitLabProjectDto>, String> {
  let base_url = normalize_gitlab_base_url(&host)?;
  let trimmed_id = account_id.trim();
  if trimmed_id.is_empty() {
    return Err("GitLab account ID is required".to_string());
  }
  let secret = load_gitlab_secret(trimmed_id)?;
  let req_origin = extract_http_origin(&base_url);
  let saved_origin = extract_http_origin(&secret.host);
  if req_origin != saved_origin {
    return Err("GitLab host does not match saved credential origin".to_string());
  }

  let p = page.unwrap_or(1).to_string();
  let pp = per_page.unwrap_or(50).to_string();

  let mut query_params = vec![
    ("membership", "true"),
    ("simple", "true"),
    ("per_page", &pp),
    ("page", &p),
    ("order_by", "updated_at"),
    ("sort", "desc"),
  ];

  let search_val;
  if let Some(ref q) = search {
    let trimmed = q.trim();
    if !trimmed.is_empty() {
      search_val = trimmed;
      query_params.push(("search", search_val));
    }
  }

  gitlab_get(
    &base_url,
    "/api/v4/projects",
    &secret.token,
    allow_self_signed.unwrap_or(false),
    &query_params,
  )
  .await
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_normalize_gitlab_base_url() {
    assert_eq!(normalize_gitlab_base_url("gitlab.com/").unwrap(), "https://gitlab.com");
    assert_eq!(normalize_gitlab_base_url(" https://gitlab.example.com/// ").unwrap(), "https://gitlab.example.com");
    assert!(normalize_gitlab_base_url("").is_err());
    assert!(normalize_gitlab_base_url("https://").is_err());
    assert!(normalize_gitlab_base_url("https:").is_err());
    assert!(normalize_gitlab_base_url("http://gitlab.example.com").is_err());
    assert!(normalize_gitlab_base_url("ftp://gitlab.example.com").is_err());
    assert!(extract_http_origin("https://evil.com\\@gitlab.example.com/group/app.git").is_none());
    assert!(extract_http_origin("https://user@/repo").is_none());
  }

  #[test]
  fn test_validate_clone_url() {
    assert!(validate_clone_url("https://gitlab.example.com/team/app.git").is_ok());
    assert!(validate_clone_url("git@gitlab.example.com:team/app.git").is_ok());
    assert!(validate_clone_url("--upload-pack=calc.exe").is_err());
    assert!(validate_clone_url(" -c core.sshCommand=evil").is_err());
    assert!(validate_clone_url("ext::sh -c id").is_err());
    assert!(validate_clone_url("file:///C:/repo").is_err());
  }

  #[test]
  fn test_encode_base64() {
    assert_eq!(encode_base64(b"oauth2:glpat-123"), "b2F1dGgyOmdscGF0LTEyMw==");
  }

  #[test]
  fn test_build_git_clone_config_env() {
    let envs = build_git_clone_config_env(
      "https://gitlab.example.com/group/app.git",
      Some("secret-pat"),
      Some("https://gitlab.example.com"),
      true,
    )
    .unwrap();
    assert_eq!(envs[0], ("GIT_CONFIG_COUNT".to_string(), "2".to_string()));
    assert_eq!(envs[1], ("GIT_CONFIG_KEY_0".to_string(), "http.https://gitlab.example.com.extraHeader".to_string()));
    assert!(envs[2].1.starts_with("Authorization: Basic "));
    assert_eq!(envs[3], ("GIT_CONFIG_KEY_1".to_string(), "http.https://gitlab.example.com.sslVerify".to_string()));
    assert_eq!(envs[4], ("GIT_CONFIG_VALUE_1".to_string(), "false".to_string()));

    // Origin mismatch fails
    assert!(build_git_clone_config_env(
      "https://evil.example.com/group/app.git",
      Some("secret-pat"),
      Some("https://gitlab.example.com"),
      false,
    ).is_err());

    // Cleartext http:// rejects token
    assert!(build_git_clone_config_env(
      "http://gitlab.example.com/group/app.git",
      Some("secret-pat"),
      Some("https://gitlab.example.com"),
      false,
    ).is_err());

    // SSH URL without token gets no HTTP env config
    let ssh_envs = build_git_clone_config_env("git@gitlab.example.com:group/app.git", None, None, true).unwrap();
    assert!(ssh_envs.is_empty());
  }

  #[test]
  fn test_redact_secrets() {
    let raw = "fatal: header\n> Authorization: Basic b2F1dGgyOnNlY3JldA==\nfatal: https://alice:glpat-secret123@gitlab.example.com/group/app.git failed";
    let safe = redact_secrets(raw);
    assert!(!safe.contains("b2F1dGgy"));
    assert!(safe.contains("Authorization: [REDACTED]"));
    assert!(!safe.contains("glpat-secret123"));
    assert!(safe.contains("https://[REDACTED]@gitlab.example.com/group/app.git"));
  }

  #[test]
  fn test_porcelain_and_name_status_parsing_with_spaces_and_renames() {
    let porcelain = concat!(
      " M src/app.ts\n",
      "R  \"old name.txt\" -> \"new name.txt\"\n",
      "?? untracked file.md\n",
      " M \"caf\\303\\240\\\\\\\"q\\\"\\t1.txt\"\n",
      " M \"unclosed.txt\n",
    );
    let parsed = parse_git_status_porcelain(porcelain);
    assert_eq!(parsed.len(), 5);
    assert_eq!(parsed[0].status, "M");
    assert_eq!(parsed[0].path, "src/app.ts");
    assert_eq!(parsed[1].status, "R");
    assert_eq!(parsed[1].path, "new name.txt");
    assert_eq!(parsed[2].status, "??");
    assert_eq!(parsed[2].path, "untracked file.md");
    assert_eq!(parsed[3].path, "cafà\\\"q\"\t1.txt");
    assert_eq!(parsed[4].path, "\"unclosed.txt");

    let name_status = "M\tsrc/my file.rs\nR100\told folder/a b.rs\tnew folder/c d.rs\nM\t\"caf\\303\\251.rs\"\n";
    let files = parse_name_status_lines(name_status);
    assert_eq!(files.len(), 3);
    assert_eq!(files[0].path, "src/my file.rs");
    assert_eq!(files[1].status, "R100");
    assert_eq!(files[1].path, "new folder/c d.rs");
    assert_eq!(files[2].path, "café.rs");
  }

  #[test]
  fn test_git_offline_repo_status_commit_stash_and_blame() {
    struct TempRepo(std::path::PathBuf);
    impl Drop for TempRepo {
      fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
      }
    }

    let uniq = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .unwrap_or_default()
      .as_nanos();
    let repo_dir = std::env::temp_dir().join(format!("ide_vcs_test_{}_{}", std::process::id(), uniq));
    std::fs::create_dir_all(&repo_dir).unwrap();
    let _guard = TempRepo(repo_dir.clone());
    let repo_str = repo_dir.to_string_lossy().to_string();

    assert!(run_git_cmd(&repo_str, &["init"]).is_ok());
    assert!(run_git_cmd(&repo_str, &["config", "user.name", "Test User"]).is_ok());
    assert!(run_git_cmd(&repo_str, &["config", "user.email", "test@example.com"]).is_ok());

    std::fs::write(repo_dir.join("seed.txt"), "seed\n").unwrap();
    assert!(run_git_cmd(&repo_str, &["add", "seed.txt"]).is_ok());
    assert!(run_git_cmd(&repo_str, &["commit", "-m", "root commit"]).is_ok());

    let spaced = repo_dir.join("hello world.txt");
    std::fs::write(&spaced, "line 1\n\n").unwrap();
    assert!(run_git_cmd(&repo_str, &["add", "hello world.txt"]).is_ok());
    assert!(run_git_cmd(&repo_str, &["commit", "-m", "init commit"]).is_ok());
    let head = run_git_cmd(&repo_str, &["rev-parse", "HEAD"]).unwrap();

    // Blame preserves trailing empty line (`\t` at EOF)
    let blame = git_get_blame(repo_str.clone(), "hello world.txt".to_string()).unwrap();
    assert_eq!(blame.len(), 2);
    assert_eq!(blame[0].line, 1);
    assert_eq!(blame[1].line, 2);
    assert_eq!(blame[1].summary, "init commit");

    // Commit details splits `--name-status` by `\t` so spaced filename stays intact
    let details = git_get_commit_details(repo_str.clone(), head).unwrap();
    assert_eq!(details.files.len(), 1);
    assert_eq!(details.files[0].path, "hello world.txt");

    // Stash with spaced path + working tree leading-space status
    std::fs::write(&spaced, "line 1\nmodified\n").unwrap();
    let st = git_get_status(repo_str.clone()).unwrap();
    assert_eq!(st.changes.len(), 1);
    assert_eq!(st.changes[0].status, "M");
    assert_eq!(st.changes[0].path, "hello world.txt");

    assert!(run_git_cmd(&repo_str, &["stash", "push", "-m", "wip"]).is_ok());
    let stash_files = git_stash_get_files(repo_str.clone(), 0).unwrap();
    assert_eq!(stash_files.len(), 1);
    assert_eq!(stash_files[0].path, "hello world.txt");

    // Live git mv rename in status + commit details
    assert!(run_git_cmd(&repo_str, &["mv", "hello world.txt", "renamed file.txt"]).is_ok());
    let rename_st = git_get_status(repo_str.clone()).unwrap();
    assert_eq!(rename_st.changes.len(), 1);
    assert_eq!(rename_st.changes[0].status, "R");
    assert_eq!(rename_st.changes[0].path, "renamed file.txt");
    assert!(run_git_cmd(&repo_str, &["commit", "-m", "rename commit"]).is_ok());
    let head2 = run_git_cmd(&repo_str, &["rev-parse", "HEAD"]).unwrap();
    let rename_details = git_get_commit_details(repo_str.clone(), head2).unwrap();
    assert!(rename_details.files.iter().any(|f| f.path == "renamed file.txt"));
  }

  #[test]
  fn test_vcs_security_validations() {
    let dir = std::env::temp_dir().to_string_lossy().to_string();
    assert!(validate_repo_relative_path(&dir, "../../etc/passwd").is_err());
    assert!(validate_repo_relative_path(&dir, "/C:/Windows/win.ini").is_err());
    assert!(validate_repo_relative_path(&dir, "src/main.rs").is_ok());

    assert!(git_interactive_rebase(dir.clone(), "--exec=calc".into(), vec![]).is_err());
    let bad_item = GitRebaseItemDto {
      hash: "abc1234".into(),
      action: "pick".into(),
      subject: Some("msg\nexec calc".into()),
    };
    assert!(git_interactive_rebase(dir, "HEAD~1".into(), vec![bad_item]).is_err());

    assert!(normalize_gitlab_base_url("https://gitlab.example.com?token=1").is_err());
    assert!(normalize_gitlab_base_url("https://gitlab.example.com#frag").is_err());
  }

  #[test]
  fn test_gitlab_project_dto_deserialize_with_nulls() {
    let raw = r#"{
      "id": 42,
      "name": "Custom IDEA",
      "name_with_namespace": "Tools / Custom IDEA",
      "path_with_namespace": "tools/custom-idea",
      "http_url_to_repo": "https://gitlab.example.com/tools/custom-idea.git",
      "ssh_url_to_repo": "git@gitlab.example.com:tools/custom-idea.git",
      "default_branch": null,
      "visibility": "private",
      "description": null,
      "last_activity_at": "2026-11-10T01:00:00Z",
      "web_url": "https://gitlab.example.com/tools/custom-idea",
      "star_count": null
    }"#;
    let dto: GitLabProjectDto = serde_json::from_str(raw).unwrap();
    assert_eq!(dto.id, 42);
    assert_eq!(dto.star_count, None);
    assert_eq!(dto.path_with_namespace, "tools/custom-idea");
  }
}


