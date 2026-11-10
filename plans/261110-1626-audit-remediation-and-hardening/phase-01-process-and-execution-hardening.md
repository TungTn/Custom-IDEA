---
phase: 1
title: Process and Execution Hardening
status: completed
priority: P1
effort: 6h
dependencies: []
---

# Phase 1: Process and Execution Hardening

## Overview
Eliminate Windows shell injection in build/process execution, remove global mutex deadlocks in ConPTY terminal and DAP debugger, prevent child/zombie leaks on window exit or init failures, enforce strict executable/argument validation for LSP and Docker, delete the unused fake `deploy_files_to_server` stub, and replace all 4 `curl.exe` CLI spawns with `reqwest` + real plugin archive validation. (Covers audit findings #1, #5, #6, #7, #8, #9, #10, #13, and backend `curl`/`cmd.exe` dedup from #19.)

## Requirements
- **Functional:**
  - Build/run tasks (`execute_build_command`, `start_process`) preserve exact arguments on Windows without `cmd.exe` metacharacter interpretation.
  - ConPTY tabs isolate I/O locks per session so a stalled shell never freezes other tabs, resize, or app shutdown.
  - Exiting via `app_close_window` cleans up Processes, PTYs, LSPs, and DAP sessions uniformly.
  - `dap_start_session` fails cleanly on missing/unsupported debuggers instead of running bare `node` REPL or partial mocks; in-flight timeouts never block `dap_stop`.
  - `lsp_start_server` cleans up `ACTIVE_SERVERS` and kills/waits `child` when `initialize`/`initialized` fails or times out.
  - Marketplace/plugin fetching & GitHub issues fetching use workspace `reqwest` (never exposing `Authorization` tokens on CLI args) and inspect ZIP contents for `META-INF/plugin.xml`.
  - Unused mock `deploy_files_to_server` (zero callers in `src/`) is removed cleanly rather than misleadingly claiming deployment success.
- **Non-functional:**
  - Zero new external crates (`reqwest`, `zip`, `tokio` already in workspace `Cargo.toml`).
  - No mutex held across blocking read/write/wait calls or subprocess waits >10ms.

## Architecture
- **Shared Windows Process Helper (`ide-run`):** Single `build_command(resolved_command, args, work_dir, env_vars)` helper that executes binaries directly via `Command::new(&resolved_command).args(&args)` on Windows unless target ends with `.cmd`/`.bat` (for batch files like `mvn.cmd`, use `Command::new("cmd.exe")` with `raw_arg` / validated batch argument escaping and reject control/newline bytes).
- **Per-Session Handles (`ide-terminal`, `ide-dap`, `ide-lsp`):** Global maps (`PTY_SESSIONS`, `ACTIVE_DAP_SESSIONS`, `ACTIVE_SERVERS`) only store lightweight structs containing `Arc<Mutex<...>>` handles for `writer`/`master`/`pending_requests`. Commands lock the global map briefly to clone `Arc`s, release the global lock, then perform I/O or `kill()`/`wait()`.
- **Executable & ID Allowlisting (`ide-docker`, `ide-lsp`):** Validate custom executable paths (`Path::is_file()`, disallow `.bat`/`.cmd`/UNC paths unless explicitly expected, enforce basename allowlist or known server binary checks), allowlist Docker socket schemes (`npipe://`, `unix://`, `tls://`), and validate `container_id` with `^[A-Za-z0-9][A-Za-z0-9_.-]*$`.

## Related Code Files
- Modify: `D:\IDE\crates\ide-run\src\commands.rs`
- Modify: `D:\IDE\crates\ide-terminal\src\commands.rs`
- Modify: `D:\IDE\crates\ide-dap\src\commands.rs`
- Modify: `D:\IDE\crates\ide-lsp\src\commands.rs`
- Modify: `D:\IDE\crates\ide-docker\src\client.rs`
- Modify: `D:\IDE\crates\ide-docker\src\commands.rs`
- Modify: `D:\IDE\src-tauri\Cargo.toml`
- Modify: `D:\IDE\src-tauri\src\window.rs`
- Modify: `D:\IDE\src-tauri\src\commands.rs`

## Implementation Steps
1. **`crates/ide-run/src/commands.rs`:**
   - Extract one `prepare_spawn_command` helper used by both `execute_build_command` (L240-292) and `start_process` (L294-345). On Windows, run executables directly via `Command::new(&resolved_command).args(&args)`; only route `.bat`/`.cmd` through `cmd.exe /d /s /c` with per-argument quoting (`raw_arg` + reject `\r`/`\n`/`\0` and escape cmd metacharacters inside quoted arguments).
   - Remove unused mock `deploy_files_to_server` and `DeploymentResultDto` (L1111-1166) and unregister `process::deploy_files_to_server` in `src-tauri/src/commands.rs:92`. Also ensure `download_real_jdk` (L746-805) cleans up `temp_zip` on all error paths via a small drop guard.
   - Refactor `fetch_github_issues` (L1183-1261) from `curl.exe` CLI (which exposes `Bearer <token>` in process args) to async `reqwest::Client` (`CLIENT: LazyLock<reqwest::Client>`) with `status().is_success()` check and bounded response handling.
2. **`src-tauri/Cargo.toml` & `src-tauri/src/window.rs`:**
   - Add `reqwest = { workspace = true }` and `zip = { workspace = true }` to `src-tauri/Cargo.toml`.
   - Fix `app_close_window` (`window.rs:78-82`) to call `crate::cleanup_ide_subsystems()` before closing/exiting so LSP & DAP processes never orphan.
   - Refactor `fetch_marketplace_plugins`, `fetch_plugin_details`, and `download_and_install_plugin` (`window.rs:99-224`) to use a shared `reqwest` helper (`http_get`), verify HTTP `2xx` status, stream download to temp file then rename, and open the ZIP with `zip::ZipArchive` to compute actual `has_plugin_xml` (returning error if archive is invalid ZIP).
3. **`crates/ide-terminal/src/commands.rs`:**
   - Wrap `writer` (`Arc<Mutex<Box<dyn Write + Send>>>`) and `master` (`Arc<Mutex<Box<dyn MasterPty + Send>>>`) inside `PtySession` alongside a monotonic `instance_id: u64`.
   - In `terminal_write`, `terminal_resize`, `terminal_kill`, and `kill_all_pty_sessions` (L16-22, L89-95, L209-234): unlock `PTY_SESSIONS` immediately after cloning `Arc`s / removing session, then perform `write_all`/`flush`/`resize`/`kill` + `child.wait()`.
   - In `terminal_spawn` reader loop (L185-203): on EOF/error, remove entry ONLY if `entry.instance_id == my_id`, call `child.wait()`, then emit `terminal-exit`. Also buffer incomplete trailing UTF-8 bytes across 4096-byte reads and validate `cwd.is_dir()` without `create_dir_all`.
4. **`crates/ide-dap/src/commands.rs`:**
   - Wrap `DapSession` fields as needed (`Arc<Mutex<...>>`) and update all commands (`dap_set_breakpoints`, `dap_continue`, `dap_step_*`, `dap_pause`, `dap_stop`, `dap_get_*`, `dap_evaluate` at L274-485) to drop `ACTIVE_DAP_SESSIONS` mutex before calling `send_dap_request_internal` or `kill()`/`wait()`.
   - In `find_debugger_executable` (L79-100) and `dap_start_session` (L114-270): stop mapping `"js"|"ts"|"node"|_` to bare `node` REPL; return clear `Err` for unsupported/uninstalled adapters, propagate `initialize`/`launch` failures after killing+waiting `child`, cap `Content-Length` (e.g., 16 MiB), exit reader loop on `read_exact` error while draining `pending_requests`, and call `child.wait()` in `stop_all_dap_sessions` (L25-31).
5. **`crates/ide-lsp/src/commands.rs`:**
   - Validate `custom_path` (`lsp_set_server_path` / `find_lsp_executable` at L47-73, L126-141) with `is_file()` and reject `.bat`/`.cmd` or UNC paths; validate `project_path.is_dir()` and build `rootUri` via `url::Url::from_file_path` (or safe URI helper if `url` isn't direct dep — check Cargo deps first).
   - Move `ACTIVE_SERVERS.insert(...)` AFTER `initialize` + `initialized` succeed (or rollback + `kill()`/`wait()` on failure/timeout); check `child.try_wait()` before returning `"Active"`; drop `ACTIVE_SERVERS` guard before `kill()`/`wait()` in `lsp_stop_server`; add `child.wait()` in `stop_all_lsp_servers` (L25-31); cap `Content-Length` and drain `pending_requests` on EOF/`read_exact` error.
6. **`crates/ide-docker/src/{client.rs, commands.rs}`:**
   - Validate `cli_path` (`is_file()`, basename `docker` or `docker.exe`, reject UNC) and allowlist `socket_path` prefixes (`npipe://`, `unix://`, `tls://`).
   - Add `validate_container_id(id)` (`^[A-Za-z0-9][A-Za-z0-9_.-]*$`, max len check) for `start`/`stop`/`restart`/`rm`/`logs` (`client.rs:173-206`) so `--follow` or CLI flags cannot be injected. Check `out.status.success()` in `get_container_logs` and convert sync `docker_*` commands to async with `tokio::process::Command` + timeout (e.g., 15s) or `tokio::time::timeout`.

## Todo List
- [ ] Unify Windows command execution helper in `ide-run` without unsafe `cmd.exe` string concatenation
- [ ] Delete fake `deploy_files_to_server`, fix `download_real_jdk` temp zip cleanup, migrate `fetch_github_issues` to `reqwest`
- [ ] Fix `window.rs` shutdown cleanup + migrate JetBrains marketplace/plugin calls to `reqwest` + ZIP verification
- [ ] Fix `ide-terminal` mutex deadlock, `instance_id` race/wait zombie leak, UTF-8 chunk buffering, and `cwd` validation
- [ ] Fix `ide-dap` mutex deadlock, Node REPL misrouting, mock fallback removal, reader EOF cleanup, and `wait()`
- [ ] Fix `ide-lsp` init rollback, `Content-Length` bound, EOF drain, executable validation, and `wait()`
- [ ] Fix `ide-docker` CLI/socket/container_id validation, `logs` status check, and async timeout

## Success Criteria
- [ ] `cargo check --workspace` succeeds with zero new warnings.
- [ ] Closing IDE via titlebar close button leaves zero orphan `powershell`/`rust-analyzer`/`debugpy` child processes.
- [ ] Launching JS/TS DAP without a real adapter returns `Err(...)` immediately instead of hanging 10s on `node` REPL.
- [ ] Running `docker_get_logs("--follow", ...)` returns validation error immediately instead of stalling IPC.

## Risk Assessment
- Breaking Maven/Gradle `.cmd` invocations on Windows paths containing spaces if `cmd.exe /d /s /c` quoting misses edge cases — mitigate by keeping batch wrapper isolated to `.bat`/`.cmd` and unit-testing paths with spaces & `&` in Phase 5.
- Switching `ide-docker` / `window.rs` / `fetch_github_issues` commands to `async` is compatible with Tauri v2 `#[tauri::command]` because frontend uses `await invoke(...)`.

## Security Considerations
- Eliminates Windows command injection, arbitrary binary execution via `docker`/`lsp` paths, GitHub PAT exposure in process arguments, and silent acceptance of invalid/corrupted plugin ZIP responses.
