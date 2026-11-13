---
phase: 3
title: Runtime Integrity and Protocol Fixes
status: completed
priority: P1
effort: 4h
dependencies:
  - 2
---

# Phase 3: Runtime Integrity and Protocol Fixes

## Overview
Eliminates runtime panics, frozen search indices, LSP/DAP protocol hangs & leaked child processes, Git stdout misparsing on spaces/empty trailing lines, and inaccurate coverage parsing/reporting.

## Requirements
- **Functional:**
  - **Unicode & slice panic fixes (`ide-vfs`, `ide-index`, `ide-run`):**
    - Replace raw `&path_clean[root_clean.len()..]` byte slicing in `is_ignored_relative_path` in BOTH `crates/ide-vfs/src/commands.rs` and `crates/ide-index/src/indexer.rs` using identical case-insensitive `Path::components()` prefix stripping (keeping crates decoupled — avoiding pulling `zip`/`rfd`/`notify` into `ide-index`).
    - Fix `ide-run/src/commands.rs:160-166` `resolve_executable_path` quote trimming to require `expanded.len() >= 2`.
    - Fix `ide-run` child stdout/stderr readers (`:392-395, 427-430`) to use `read_until(b'\n')` (capped) + `String::from_utf8_lossy`, fix `detect_installed_jdks` numeric version sorting + `std::env::join_paths` without clobbering caller `PATH`, fix `create_downloaded_jdk_placeholder` extra `;`, fix `download_real_jdk` rename error handling before `remove_dir_all`, and fix `test_remote_ssh_connection` IPv6 formatting / multi-addr dial.
    - Fix `ide-vfs/src/commands.rs:791-794` `vfs_delete_path` to use `p.symlink_metadata().is_err()` for dangling symlink deletion, and add size cap on folder settings reads.
    - Fix concurrent `start_process` / `terminal_spawn` race (`ide-run`, `ide-terminal`) by killing/waiting any replaced process returned by `map.insert(...)`, and throttle `terminal_spawn` `"terminal-data"` emissions (short buffer/flush window).
  - **Fresh index rebuild (`ide-index`):**
    - Update `IndexManager` so `index_project` always rebuilds/refreshes the cached index (or accepts `force_rebuild`) rather than serving stale symbols forever, and include `"kt"` / `"vue"` comment handling in `symbols.rs`.
  - **LSP & DAP protocol correctness & cleanup (`ide-lsp`, `ide-dap`, `dapService.ts`):**
    - Run blocking handshake/wait portions of `ide-lsp` / `ide-dap` inside `tauri::async_runtime::spawn_blocking` (keeping `std::sync::Mutex` guards strictly synchronous inside the blocking closure and avoiding extra `tokio` crate dependencies).
    - `ide-lsp`: Distinguish client responses (`val.get("method").is_none()`) from server->client requests before matching `pending_requests` (replying `{ jsonrpc: "2.0", id, result: null }` to server requests like `client/registerCapability`), use `read_until(b'\n')` + `from_utf8_lossy` for headers, remove exited server entries from `ACTIVE_SERVERS` on reader EOF/error, enforce `p.is_absolute()` on custom non-bare paths, and skip unconditional `--stdio` for `pylsp`.
    - `ide-dap`: Wait cleanly for `initialized` event (with bounded timeout) and send `configurationDone`, remove exited sessions from `ACTIVE_DAP_SESSIONS` on reader EOF, stop faking verified breakpoints when the adapter returns `[]` (`:373-383`), and update `dapService.ts:96` default `debugType` away from `'node'` + clean session state cleanly.
  - **Git stdout parsing (`ide-vcs`):**
    - Preserve leading/trailing whitespace on raw outputs for `git_get_status` and `git_get_blame` (only trimming error formatting, parsing `R  old -> new` and preserving empty trailing lines in blame), split `git_get_commit_details` and `git_stash_get_files` `--name-status` lines on `'\t'`, and propagate `git_add` failure in `git_commit`.
  - **Coverage XML & path matching (`ide-coverage`):**
    - Implement lightweight `jacoco.xml` (joining `<package name>` + `<sourcefile name>`, `<line nr ci>`) and `cobertura.xml` (extracting `<class filename>` line hits while ignoring nested `<methods>` duplicate `<line>` entries) in `crates/ide-coverage/src/parser.rs`; remove unsupported `clover.xml` from `coverage_detect_reports`.
    - Flush trailing LCOV records at EOF without `end_of_record`, merge duplicate `SF:` entries, return `0.0` (not `100.0`) when zero lines exist in BOTH `parser.rs:65` AND `commands.rs:45`, and match `coverage_get_for_file` on normalized path-component suffix boundaries (case-insensitive on Windows).
    - Offload `coverage_load_file` / `coverage_detect_reports` via `tauri::async_runtime::spawn_blocking` if made `async fn`.
- **Non-functional:**
  - `cargo test --workspace` and `pnpm exec tsc --noEmit` pass cleanly.

## Architecture
- Keep `ide-vfs` and `ide-index` free of cross-crate dependency cycles/bloat; match exact component-stripping implementation in both and test both cleanly.
- Use `tauri::async_runtime::spawn_blocking` (already provided by `tauri`) so blocking mutexes stay completely outside async `.await` points.

## Related Code Files
- Modify: `d:/IDE/crates/ide-vfs/src/commands.rs`
- Modify: `d:/IDE/crates/ide-index/src/indexer.rs`, `d:/IDE/crates/ide-index/src/symbols.rs`
- Modify: `d:/IDE/crates/ide-run/src/commands.rs`, `d:/IDE/crates/ide-terminal/src/commands.rs`
- Modify: `d:/IDE/crates/ide-lsp/src/commands.rs`, `d:/IDE/crates/ide-dap/src/commands.rs`
- Modify: `d:/IDE/src/services/dapService.ts`
- Modify: `d:/IDE/crates/ide-vcs/src/commands.rs`
- Modify: `d:/IDE/crates/ide-coverage/src/parser.rs`, `d:/IDE/crates/ide-coverage/src/commands.rs`

## Implementation Steps
1. Fix Unicode path slicing & prefix collisions in `ide-vfs` + `ide-index`, dangling symlink deletion in `vfs_delete_path`, folder import size limit, index rebuild freshness in `ide-index`, and Kotlin/Vue comments in `symbols.rs`.
2. Fix `ide-run` (`resolve_executable_path` len >= 2, lossy line reader, JDK sort/`PATH` join/placeholder/rename, IPv6 SSH target, race kill on `map.insert`) and `ide-terminal` concurrent spawn race + batched IPC emissions.
3. Fix `ide-lsp` (`method` absence check + server request reply, `read_until(b'\n')` headers, `ACTIVE_SERVERS` exit cleanup, `pylsp` args, absolute path check, `spawn_blocking`) and `ide-dap` (`configurationDone`, `ACTIVE_DAP_SESSIONS` cleanup, real verified breakpoints, `dapService.ts` default).
4. Fix `ide-vcs` status/commit/stash/blame parsing (`\t` splitting, whitespace preservation, `git_commit` error check) and `ide-coverage` (`jacoco.xml` & `cobertura.xml` parser without `<methods>` double count, drop `clover.xml`, LCOV EOF flush, `0.0%` rule in `parser.rs` & `commands.rs`, boundary path match).
5. Run `cargo test --workspace`, `pnpm exec tsc --noEmit`, and `pnpm build`.

## Success Criteria
- [ ] Paths containing `'İ'`/`'K'` or prefix lookalikes (`app.git`) never panic or misclassify in `ide-vfs`/`ide-index`.
- [ ] Opening Search Everywhere after editing files reflects new symbols (`index_project` refreshes cache).
- [ ] LSP server requests never collide with pending client requests; DAP sends `configurationDone` and cleans up exited sessions.
- [ ] Git files with spaces parse cleanly; `jacoco.xml` & `cobertura.xml` parse accurately and 0-line files report `0.0%`.

## Risk Assessment
- XML parsing in `ide-coverage` without adding an external XML crate must handle multiline `<sourcefile>`/`<class>` attributes and self-closing `<line .../>` tags cleanly using small deterministic scanning helpers.
