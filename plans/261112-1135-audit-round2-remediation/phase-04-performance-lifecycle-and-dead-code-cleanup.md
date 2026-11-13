---
phase: 4
title: Performance Lifecycle and Dead Code Cleanup
status: completed
priority: P2
effort: 4h
dependencies:
  - 3
---

# Phase 4: Performance Lifecycle and Dead Code Cleanup

## Overview
Eliminates per-keystroke CPU/subprocess spikes, `sessionStorage` token exposure, unescaped XML settings exports, unbounded `VFS_BUFFERS` memory growth, blocking async disk I/O, window lifecycle leaks (`exit(0)` / timestamp labels), and leftover dead Monaco/barrel/crate code and unused dependencies.

## Requirements
- **Functional:**
  - **Frontend speed, timers & secret hygiene:**
    - `CmEditor.tsx:1559-1577`: debounce `git_get_diff` (`500ms`, cancelling timer on cleanup) instead of spawning a git subprocess on every keystroke; replace deprecated `document.execCommand` fallback where safe.
    - `SonarToolWindow.tsx`: merge duplicate static analysis effects (`597-614` & `967-974`) into one debounced (`400ms`) effect, cap `sonarLogs` length, batch project file reads cleanly, and stop storing `SONAR_TOKEN` in `sessionStorage` (`:1154-1156`).
    - `useProcessRunner.ts:627-699`: convert `handleExecuteBuildTask` cleanly to `async` so it resolves active `SONAR_TOKEN` directly from `secretService.getSecret('sonar', connectionId || 'default')` without `sessionStorage`.
    - `intellijSettingsService.ts:716-773`: wrap interpolated XML attributes in an `escapeXmlAttr()` helper.
    - Clear unmount timeouts in `lspExtension.ts:334-336`, `PluginsPanel.tsx:187-194`, `AppearanceBehaviorPanel.tsx:852-857`, and store volatile state in a ref in `useMenuDispatcher.ts:1390-1410` to stop re-attaching `window.keydown` on every cursor movement.
    - Fix UI state disconnects: `SettingsModal.tsx:723-737` plugin count via `usePluginStore()`, `AppearanceBehaviorPanel.tsx:1037-1041` fake proxy test success in `catch`, and deduplicate `getInitialProjectPath` (`App.tsx` vs `projectStore.ts`).
  - **Backend resource & window lifecycle (`ide-vfs`, `ide-run`, `src-tauri`):**
    - Remove unbounded `VFS_BUFFERS` map and verify-unused VFS commands (`vfs_read_file`, `vfs_get_line_count`, and `write_file_content` migrated in Phase 1).
    - Move `download_real_jdk` (`ide-run`) and `download_and_install_plugin` (`window.rs`) file writes + ZIP extraction into `spawn_blocking`, adding decompression size cap to `download_real_jdk`.
    - Fix `src-tauri/src/window.rs` & `lib.rs`: replace `as_millis()` window labels with an `AtomicU64` counter, insert into `PENDING_WINDOW_PROJECTS` only after `WebviewWindowBuilder::build()` succeeds, clean stale entry if window closes early, replace `std::process::exit(0)` in `window.rs` / `lib.rs` with `app.exit(0)` (invoking `cleanup_ide_subsystems()` cleanly via single guarded `Once` or `RunEvent::Exit`, while **preserving** `updater.rs:103`'s `std::process::exit(0)` so Windows releases `.exe` lock for `update_*.bat`), and remove unconditional `ide_exit_reason.log` temp file writes.
    - Fix `src-tauri/src/profiler.rs`: prune stale PIDs in `CPU_SAMPLES`, handle poisoned mutexes cleanly, and run blocking `jps`/`jcmd` via `spawn_blocking`.
  - **Dead code & unused dependency cleanup (re-verified via workspace grep before deletion):**
    - Delete `.monaco-*` CSS rules in `src/index.css:169-243`, `buildMonacoTheme` + Monaco block in `src/themes/themeManager.ts:240-314,463-469`, 6 unused barrel `index.ts` files (`coverage`, `docker`, `endpoints`, `learn`, `profiler`, `todo`), `src/types/plugin.ts`, `src/types/test.ts`, empty `crates/ide-terminal/src/terminal.rs`, and verified unused exports (`IjNotificationsIcon`, `getAllDescendantLeaves`, `GradleTask`, `ConflictChunk`, `DapVariable`, `IntentionAction`, `GitGraphCommit`, `CustomColorScheme`, `CodeEditorProps`, etc.).
    - Remove dead Tauri commands/DTOs verified unused across `src/` & `crates/*/tests`: `docker_list_images` + `DockerImageDto` (deleting stale `crates/ide-docker/bindings/DockerImageDto.ts`), `lsp_stop_server` & `lsp_get_active_servers` (updating `ide-lsp`'s inline unit test to assert `ACTIVE_SERVERS` / `CUSTOM_LSP_PATHS` directly without keeping dead IPC commands), `CoverageStatus::PartiallyCovered` (updating `crates/ide-coverage/bindings/CoverageStatus.ts` via `cargo test --workspace`), `vfs_read_file`, `vfs_get_line_count`, `write_file_content`.
    - Clean Cargo dependencies carefully: move `ts-rs` to `[dev-dependencies]` in `src-tauri/Cargo.toml` ONLY (domain crates deriving `#[derive(TS)]` keep `ts-rs`); move `tokio` to `[dev-dependencies]` in `ide-http` & `ide-run` (or keep where `async fn` / tests require); remove truly unused `log`/`serde` entries (`ide-lsp` unused `serde`, `ide-dap` unused `serde`, `ide-docker` unused `log`, `ide-http` unused `log`, `ide-db` unused `log`, `ide-coverage` unused `log`/`tokio`, `ide-index` unused `log`/`serde_json`); delete stale `package-lock.json`.
- **Non-functional:**
  - `cargo test --workspace`, `pnpm exec tsc --noEmit`, `pnpm build` pass cleanly with regenerated bindings committed/consistent.

## Architecture
- Perform a quick repo-wide grep immediately before each deletion so zero callers break.
- Run `cargo test --workspace` to refresh `ts-rs` bindings (`CoverageStatus.ts`, etc.) and remove obsolete binding files (`DockerImageDto.ts`).

## Related Code Files
- Modify: `d:/IDE/src/editor/CmEditor.tsx`, `d:/IDE/src/editor/cm/lspExtension.ts`
- Modify: `d:/IDE/src/features/sonar/SonarToolWindow.tsx`, `d:/IDE/src/hooks/useProcessRunner.ts`, `d:/IDE/src/hooks/useMenuDispatcher.ts`
- Modify: `d:/IDE/src/services/intellijSettingsService.ts`
- Modify: `d:/IDE/src/features/settings/SettingsModal.tsx`, `d:/IDE/src/features/settings/panels/PluginsPanel.tsx`, `d:/IDE/src/features/settings/panels/AppearanceBehaviorPanel.tsx`
- Modify: `d:/IDE/src/App.tsx`, `d:/IDE/src/stores/projectStore.ts`, `d:/IDE/src/index.css`, `d:/IDE/src/themes/themeManager.ts`
- Delete: `d:/IDE/src/features/{coverage,docker,endpoints,learn,profiler,todo}/index.ts`, `d:/IDE/src/types/plugin.ts`, `d:/IDE/src/types/test.ts`, `d:/IDE/crates/ide-terminal/src/terminal.rs`, `d:/IDE/crates/ide-docker/bindings/DockerImageDto.ts`, `d:/IDE/package-lock.json`
- Modify: `d:/IDE/src-tauri/src/{lib.rs,commands.rs,window.rs,profiler.rs}`, `d:/IDE/src-tauri/Cargo.toml`
- Modify: `d:/IDE/crates/{ide-vfs,ide-run,ide-lsp,ide-dap,ide-docker,ide-http,ide-db,ide-coverage,ide-index}/Cargo.toml` & `src/`

## Implementation Steps
1. Frontend performance & timer cleanup (`CmEditor.tsx`, `SonarToolWindow.tsx`, async `useProcessRunner.ts` + `secretService`, `intellijSettingsService.ts` XML escaping, unmount timers, `useMenuDispatcher.ts` keydown ref, `SettingsModal.tsx`, `AppearanceBehaviorPanel.tsx`).
2. Delete dead frontend CSS, Monaco theme builder, unused barrels/types/exports, consolidate `getInitialProjectPath`, and remove `package-lock.json`.
3. Backend resource & window lifecycle fixes (`VFS_BUFFERS` removal, `spawn_blocking` + ZIP cap in `download_real_jdk` & `download_and_install_plugin`, `AtomicU64` window labels + `PENDING_WINDOW_PROJECTS` cleanup + `app.exit(0)` in `window.rs`/`lib.rs` while keeping `updater.rs` `exit(0)`, `profiler.rs` pruning).
4. Delete verified dead Tauri commands/DTOs (updating `ide-lsp` unit tests & deleting `DockerImageDto.ts`) and trim verified unused Cargo deps (`serde`/`log`/`tokio`/`ts-rs` in `src-tauri`).
5. Run `cargo test --workspace`, `pnpm exec tsc --noEmit`, `pnpm build`.

## Success Criteria
- [ ] Zero `sessionStorage('SONAR_TOKEN')` occurrences; `intellijSettingsService` exports valid escaped XML.
- [ ] `git_get_diff` and Sonar static analysis are debounced; `window.keydown` listener stays stable across cursor moves.
- [ ] Unbounded `VFS_BUFFERS`, dead Monaco code/CSS, dead barrels/commands, and unused Cargo deps removed cleanly.
- [ ] `cargo test --workspace`, `pnpm exec tsc --noEmit`, `pnpm build` pass cleanly with consistent `ts-rs` bindings.

## Risk Assessment
- Verify whether `esbuild` test (`scripts/e2e-update.test.mjs`) relies on anything affected by `package-lock.json` removal (it uses `node_modules` installed by `pnpm`!).
- Ensure `cleanup_ide_subsystems()` in `updater.rs` and `RunEvent::Exit` never panics if run during update shutdown.
