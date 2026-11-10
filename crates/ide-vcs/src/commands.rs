use std::process::Command;
use std::sync::{LazyLock, RwLock};
use serde::{Deserialize, Serialize};

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
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
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

#[tauri::command]
pub fn git_get_status(project_path: String) -> Result<GitStatusDto, String> {
  let branch = run_git_cmd(&project_path, &["branch", "--show-current"])
    .unwrap_or_else(|_| "main".to_string());

  let status_out = run_git_cmd(&project_path, &["status", "--porcelain=v1", "-uall"])
    .unwrap_or_default();

  let mut changes = Vec::new();
  for line in status_out.lines() {
    let trimmed = line.trim();
    if trimmed.len() >= 3 {
      let code = trimmed[..2].trim();
      let path = trimmed[2..].trim().to_string();
      changes.push(GitFileChangeDto {
        status: code.to_string(),
        path,
      });
    }
  }

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
    let _ = run_git_cmd(&project_path, &["add", "-A"]);
  } else {
    for f in &files {
      let _ = run_git_cmd(&project_path, &["add", "--", f]);
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

  let meta_out = run_git_cmd(&project_path, &["show", "-s", "--pretty=format:%H\t%an\t%ae\t%ad\t%B", "--date=short", &commit_hash])?;
  let parts: Vec<&str> = meta_out.splitn(5, '\t').collect();
  let (hash, author, email, date, message) = if parts.len() >= 5 {
    (parts[0].to_string(), parts[1].to_string(), parts[2].to_string(), parts[3].to_string(), parts[4].trim().to_string())
  } else {
    (commit_hash.clone(), "Unknown".to_string(), "".to_string(), "".to_string(), "".to_string())
  };

  let files_out = run_git_cmd(&project_path, &["diff-tree", "--no-commit-id", "--name-status", "-r", &commit_hash])
    .unwrap_or_default();
  let mut files = Vec::new();
  for line in files_out.lines() {
    let trimmed = line.trim();
    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    if parts.len() >= 2 {
      files.push(GitFileChangeDto {
        status: parts[0].to_string(),
        path: parts[1].to_string(),
      });
    }
  }

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
  let out = run_git_cmd(&project_path, &["blame", "--line-porcelain", "--", &clean_file])?;
  
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
  let clean_path = file_path.replace('\\', "/");
  let target = format!("HEAD:{}", clean_path);
  run_git_cmd(&project_path, &["show", &target])
}

#[tauri::command]
pub fn git_get_file_content_at_revision(project_path: String, revision: String, file_path: String) -> Result<String, String> {
  let clean_path = file_path.replace('\\', "/");
  let trimmed = clean_path.trim_start_matches('/').trim_start_matches("./");
  if revision == "WORKING_TREE" {
    let full_path = std::path::Path::new(&project_path).join(trimmed);
    std::fs::read_to_string(&full_path).map_err(|e| format!("Failed to read file: {}", e))
  } else {
    let target = format!("{}:{}", revision, trimmed);
    run_git_cmd(&project_path, &["show", &target])
  }
}

#[tauri::command]
pub fn git_rollback_file(project_path: String, file_path: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["checkout", "HEAD", "--", &file_path])
    .or_else(|_| run_git_cmd(&project_path, &["restore", &file_path]))
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
  if create_new {
    run_git_cmd(&project_path, &["checkout", "-b", &branch])
  } else {
    run_git_cmd(&project_path, &["checkout", &branch])
  }
}

#[tauri::command]
pub fn git_clone(url: String, target_dir: String) -> Result<String, String> {
  let target = std::path::Path::new(&target_dir);
  if let Some(parent) = target.parent() {
    let _ = std::fs::create_dir_all(parent);
  }
  let mut cmd = Command::new("git");
  cmd.args(&["clone", &url, &target_dir]);
  #[cfg(windows)]
  cmd.creation_flags(0x08000000);
  let output = cmd.output().map_err(|e| format!("Failed to run git clone: {}", e))?;
  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    return Err(format!("Git clone failed: {}\n{}", stderr, stdout));
  }
  Ok(target_dir)
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
  let files_out = run_git_cmd(&project_path, &["stash", "show", "--name-status", &target])?;
  let mut files = Vec::new();
  for line in files_out.lines() {
    let p: Vec<&str> = line.split_whitespace().collect();
    if p.len() >= 2 {
      files.push(GitFileChangeDto {
        status: p[0].to_string(),
        path: p[1].to_string(),
      });
    }
  }
  Ok(files)
}

#[tauri::command]
pub fn git_reset_branch(project_path: String, commit_hash: String, mode: String) -> Result<String, String> {
  let flag = match mode.to_lowercase().as_str() {
    "soft" => "--soft",
    "hard" => "--hard",
    "keep" => "--keep",
    _ => "--mixed",
  };
  run_git_cmd(&project_path, &["reset", flag, &commit_hash])
}

#[tauri::command]
pub fn git_cherry_pick(project_path: String, commit_hash: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["cherry-pick", &commit_hash])
}

#[tauri::command]
pub fn git_revert_commit(project_path: String, commit_hash: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["revert", "--no-edit", &commit_hash])
}

#[tauri::command]
pub fn git_create_tag(project_path: String, tag_name: String, commit_hash: Option<String>) -> Result<String, String> {
  if let Some(hash) = commit_hash {
    run_git_cmd(&project_path, &["tag", &tag_name, &hash])
  } else {
    run_git_cmd(&project_path, &["tag", &tag_name])
  }
}

#[tauri::command]
pub fn git_create_branch_from(project_path: String, new_branch: String, start_point: String, checkout: bool) -> Result<String, String> {
  if checkout {
    run_git_cmd(&project_path, &["checkout", "-b", &new_branch, &start_point])
  } else {
    run_git_cmd(&project_path, &["branch", &new_branch, &start_point])
  }
}

#[tauri::command]
pub fn git_delete_branch(project_path: String, branch: String, force: bool) -> Result<String, String> {
  let flag = if force { "-D" } else { "-d" };
  run_git_cmd(&project_path, &["branch", flag, &branch])
}

#[tauri::command]
pub fn git_rename_branch(project_path: String, old_name: String, new_name: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["branch", "-m", &old_name, &new_name])
}

#[tauri::command]
pub fn git_merge_branch(project_path: String, branch: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["merge", &branch])
}

#[tauri::command]
pub fn git_rebase_branch(project_path: String, upstream: String) -> Result<String, String> {
  run_git_cmd(&project_path, &["rebase", &upstream])
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
  let git_bin = get_git_executable();
  let temp_dir = std::env::temp_dir();
  let timestamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default()
    .as_millis();

  let todo_file = temp_dir.join(format!("git-rebase-todo-{}.txt", timestamp));
  let mut todo_content = String::new();
  for item in &items {
    let act = match item.action.to_lowercase().as_str() {
      "squash" | "s" => "squash",
      "fixup" | "f" => "fixup",
      "drop" | "d" => "drop",
      "reword" | "r" => "reword",
      "edit" | "e" => "edit",
      _ => "pick",
    };
    let subj = item.subject.as_deref().unwrap_or("");
    todo_content.push_str(&format!("{} {} {}\n", act, item.hash, subj));
  }
  std::fs::write(&todo_file, &todo_content)
    .map_err(|e| format!("Failed to create rebase todo file: {}", e))?;

  #[cfg(windows)]
  let script_file = temp_dir.join(format!("seq-editor-{}.bat", timestamp));
  #[cfg(not(windows))]
  let script_file = temp_dir.join(format!("seq-editor-{}.sh", timestamp));

  #[cfg(windows)]
  {
    let todo_str = todo_file.to_string_lossy().replace('/', "\\");
    let script_content = format!("@echo off\r\ncopy /y \"{}\" \"%~1\" >nul\r\n", todo_str);
    let _ = std::fs::write(&script_file, script_content);
  }
  #[cfg(not(windows))]
  {
    let script_content = format!("#!/bin/sh\ncp -f \"{}\" \"$1\"\n", todo_file.to_string_lossy());
    let _ = std::fs::write(&script_file, script_content);
    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      let _ = std::fs::set_permissions(&script_file, std::fs::Permissions::from_mode(0o755));
    }
  }

  let work_dir = if project_path.trim().is_empty() { "." } else { project_path.trim() };
  let mut cmd = Command::new(&git_bin);
  cmd.args(&["rebase", "-i", &base_commit]);
  cmd.current_dir(work_dir);
  cmd.env("GIT_SEQUENCE_EDITOR", format!("\"{}\"", script_file.to_string_lossy().replace('/', "\\")));
  #[cfg(windows)]
  cmd.env("GIT_EDITOR", "cmd /c exit 0");
  #[cfg(not(windows))]
  cmd.env("GIT_EDITOR", "true");

  #[cfg(windows)]
  cmd.creation_flags(0x08000000);

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
  run_git_cmd(&project_path, &["format-patch", "-1", "--stdout", &commit_hash])
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
  let clean_path = file_path.replace('\\', "/");
  let trimmed = clean_path.trim_start_matches('/').trim_start_matches("./");

  // Stage 1: Common Ancestor (Base)
  let base = run_git_cmd(&project_path, &["show", &format!(":1:{}", trimmed)]).unwrap_or_default();
  // Stage 2: Target branch / Ours (Yours)
  let ours = run_git_cmd(&project_path, &["show", &format!(":2:{}", trimmed)]).unwrap_or_default();
  // Stage 3: Source branch / Theirs (Incoming)
  let theirs = run_git_cmd(&project_path, &["show", &format!(":3:{}", trimmed)]).unwrap_or_default();

  // Read current working tree file (which may contain <<<<<<< markers)
  let full_path = std::path::Path::new(&project_path).join(trimmed);
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
  let clean_path = file_path.replace('\\', "/");
  let trimmed = clean_path.trim_start_matches('/').trim_start_matches("./");
  let full_path = std::path::Path::new(&project_path).join(trimmed);

  // Write resolved content to disk
  std::fs::write(&full_path, resolved_content)
    .map_err(|e| format!("Failed to write resolved file {}: {}", file_path, e))?;

  // Mark conflict as resolved via git add
  run_git_cmd(&project_path, &["add", "--", trimmed])
}

#[derive(Debug, serde::Serialize, serde::Deserialize, TS)]
#[ts(export)]
pub struct GitLabUserDto {
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
  pub star_count: Option<i64>,
}

fn normalize_gitlab_base_url(host: &str) -> String {
  let trimmed = host.trim().trim_end_matches('/');
  if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
    format!("https://{}", trimmed)
  } else {
    trimmed.to_string()
  }
}

#[tauri::command]
pub async fn gitlab_test_connection(host: String, token: String) -> Result<GitLabUserDto, String> {
  let base_url = normalize_gitlab_base_url(&host);
  let api_url = format!("{}/api/v4/user", base_url);

  let client = reqwest::Client::builder()
    .danger_accept_invalid_certs(true)
    .timeout(std::time::Duration::from_secs(12))
    .build()
    .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

  let res = client
    .get(&api_url)
    .header("PRIVATE-TOKEN", token.trim())
    .header("User-Agent", "Custom-IDEA-GitLab/1.0")
    .send()
    .await
    .map_err(|e| format!("Connection error to GitLab ({}): {}", base_url, e))?;

  if !res.status().is_success() {
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    return Err(format!("GitLab returned HTTP {}: {}", status, body));
  }

  let user: GitLabUserDto = res
    .json()
    .await
    .map_err(|e| format!("Failed to parse GitLab user response: {}", e))?;

  Ok(user)
}

#[tauri::command]
pub async fn gitlab_list_projects(
  host: String,
  token: String,
  search: Option<String>,
  page: Option<u32>,
  per_page: Option<u32>,
) -> Result<Vec<GitLabProjectDto>, String> {
  let base_url = normalize_gitlab_base_url(&host);
  let api_url = format!("{}/api/v4/projects", base_url);
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

  let client = reqwest::Client::builder()
    .danger_accept_invalid_certs(true)
    .timeout(std::time::Duration::from_secs(15))
    .build()
    .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

  let res = client
    .get(&api_url)
    .query(&query_params)
    .header("PRIVATE-TOKEN", token.trim())
    .header("User-Agent", "Custom-IDEA-GitLab/1.0")
    .send()
    .await
    .map_err(|e| format!("Connection error to GitLab ({}): {}", base_url, e))?;

  if !res.status().is_success() {
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    return Err(format!("GitLab returned HTTP {}: {}", status, body));
  }

  let projects: Vec<GitLabProjectDto> = res
    .json()
    .await
    .map_err(|e| format!("Failed to parse GitLab projects response: {}", e))?;

  Ok(projects)
}


