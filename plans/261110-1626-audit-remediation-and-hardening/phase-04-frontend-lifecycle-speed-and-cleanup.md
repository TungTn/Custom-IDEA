---
phase: 4
title: "Frontend Lifecycle, Speed and Dead Code Cleanup"
status: pending
priority: P2
effort: "4h"
dependencies: [1, 2]
---

# Phase 4: Frontend Lifecycle, Speed and Dead Code Cleanup

## Overview
Fix leaked CodeMirror/LSP/Terminal/hook event listeners and timers, eliminate Sticky Scroll per-pixel full-document stringification, deduplicate SQL query history updates, remove all 8 verified dead frontend files (1,247 lines), drop 3 unused npm packages (`clsx`, `tailwind-merge`, `dockview`) + orphaned CSS, and unregister 4 dead Tauri IPC commands. (Covers audit findings #17, #19, and #20.)

## Requirements
- **Functional:**
  - `CmEditor` cleanup always unsubscribes `unlistenDiagnostics`, removes the DOM `scroll` listener, cancels pending `setTimeout`, and aborts initialization cleanly if unmounted mid-`await`.
  - `lspService.closeDocument` clears any debounced `changeTimers` entry before sending `didClose`.
  - `TerminalPanel` tracks an `isCancelled` flag across `await listen(...)` and `await invoke('terminal_spawn')`, preventing listener leaks, duplicate `term.onData` handlers, and orphaned shell processes on rapid tab close.
  - `useProcessRunner` and `useProjectWorkspace` clean up async `listen(...)` handles if unmounted before resolution; document drag listeners in `App.tsx`, `BottomToolWindow.tsx`, `CommitPanel.tsx` unregister cleanly on unmount.
  - Dead files, unused npm deps, unused CSS rules, and dead Tauri handlers are removed cleanly with zero broken imports or bindings.
- **Non-functional:**
  - Scrolling large files (5,000+ lines) avoids synchronous `doc.toString()` + scope re-parse on every raw scroll event.
  - Re-check unused exports with `git grep` before deleting any file.

## Architecture
- **Editor & LSP Lifecycle:** Store `scrollDOM`, `scrollListener`, `scanTimer`, and `unlistenDiagnostics` inside `useEffect` closure scope so cleanup reliably releases all of them even if `viewRef.current` is cleared; throttle `handleScroll` with `requestAnimationFrame` + line-number cache so `getEnclosingScopes` only runs when top visible line changes.
- **Tauri Listener Cancellation Pattern:** Small helper `subscribeTauriEvent(event, handler, isCancelledRef)` (or local `let cancelled = false` guard in `TerminalPanel` / hooks) ensuring `if (cancelled) { unlisten(); return; }` runs immediately after `await listen(...)`.
- **SQL History Dedup (`SqlQueryConsole.tsx`):** Extract one `appendSqlHistory(entry)` helper replacing 6 repeated copies across `executeSql`.

## Related Code Files
- Modify: `D:\IDE\package.json` (and lockfile via `pnpm install` if run, or remove unused pkgs cleanly)
- Modify: `D:\IDE\src\index.css`
- Modify: `D:\IDE\src\editor\CmEditor.tsx`
- Modify: `D:\IDE\src\services\lspService.ts`
- Modify: `D:\IDE\src\features\terminal\TerminalPanel.tsx`
- Modify: `D:\IDE\src\hooks\useProcessRunner.ts`
- Modify: `D:\IDE\src\hooks\useProjectWorkspace.ts`
- Modify: `D:\IDE\src\App.tsx`
- Modify: `D:\IDE\src\workbench\BottomToolWindow.tsx`
- Modify: `D:\IDE\src\features\git\CommitPanel.tsx`
- Modify: `D:\IDE\src\features\database\SqlQueryConsole.tsx`
- Modify: `D:\IDE\src\editor\index.ts`, `D:\IDE\src\features\build\index.ts`, `D:\IDE\src\features\git\index.ts`, `D:\IDE\src\stores\index.ts` (remove barrel re-exports of deleted files)
- Modify: `D:\IDE\crates\ide-vfs\src\commands.rs`, `D:\IDE\crates\ide-lsp\src\commands.rs`, `D:\IDE\src-tauri\src\commands.rs` (remove dead `vfs_read_file`, `vfs_get_line_count`, `lsp_stop_server`, `lsp_get_active_servers` + unused `FileNodeDto.content` if safe, or check bindings)
- Delete: `D:\IDE\src\editor\cm\templateExtension.ts`
- Delete: `D:\IDE\src\themes\intellijTheme.ts`
- Delete: `D:\IDE\src\languages\vue.ts`
- Delete: `D:\IDE\src\editor\CmDiffViewer.tsx`
- Delete: `D:\IDE\src\features\build\TestRunnerPanel.tsx`
- Delete: `D:\IDE\src\features\build\ToolchainsModal.tsx`
- Delete: `D:\IDE\src\features\git\GitBranchesModal.tsx`
- Delete: `D:\IDE\src\stores\problemsStore.ts`

## Implementation Steps
1. **Fix Resource & Listener Leaks (`CmEditor.tsx`, `lspService.ts`, `TerminalPanel.tsx`, hooks, drag handlers):**
   - In `CmEditor.tsx:1449-1478`: check `if (!isMounted)` after async init steps, save `unlistenDiagnostics`, invoke `unlistenDiagnostics?.()`, remove `view.scrollDOM` `scroll` listener, and cancel `setTimeout`/`rAF` in cleanup.
   - Throttle `handleScroll` in `CmEditor.tsx:1455-1467` via `requestAnimationFrame` and skip `getEnclosingScopes` if `lineNum === lastScannedLine && docVersion === lastDocVersion`.
   - In `lspService.ts:245-263`: clear & delete `this.changeTimers.get(uri)` inside `closeDocument`.
   - In `TerminalPanel.tsx:133-275`: add `let isCancelled = false;` flag; after `await listen(...)` call `unlisten()` immediately if cancelled; after `await invoke('terminal_spawn')` call `invoke('terminal_kill', ...)` if cancelled; avoid double-registering `term.onData` on spawn error fallback; clear all `setTimeout` timers on unmount.
   - Apply `isCancelled` guard to async `listen(...)` calls in `useProcessRunner.ts:150-224` and `useProjectWorkspace.ts:378-403`, and clean up active `document` drag listeners on unmount in `App.tsx`, `BottomToolWindow.tsx`, `CommitPanel.tsx`.
2. **Deduplicate SQL History (`SqlQueryConsole.tsx`):**
   - Extract `recordQueryHistory(query, status, extra)` helper replacing the 6 repeated `SqlHistoryEntry` + `saveSqlHistory` blocks (`L79-262`).
3. **Purge Verified Dead Code, CSS, Deps & Unused IPC Handlers:**
   - Remove barrel exports in `src/editor/index.ts`, `src/features/build/index.ts`, `src/features/git/index.ts`, `src/stores/index.ts` and delete the 8 dead files (1,247 lines total).
   - Remove `@import 'dockview/dist/styles/dockview.css';` and `.dockview-theme-dark` rules from `src/index.css:1, 171-197`.
   - Remove `"clsx"`, `"tailwind-merge"`, `"dockview"` from `package.json` (`pnpm remove clsx tailwind-merge dockview`).
   - Remove unused `vfs_read_file` & `vfs_get_line_count` (`ide-vfs/src/commands.rs:271-300`), `lsp_stop_server` & `lsp_get_active_servers` (`ide-lsp/src/commands.rs:405-423`), and their registrations in `src-tauri/src/commands.rs`.

## Todo List
- [ ] Fix `CmEditor.tsx` diagnostics/scroll/timeout cleanup & rAF-throttle Sticky Scroll
- [ ] Clear debounce timers in `lspService.closeDocument`
- [ ] Fix `TerminalPanel.tsx`, `useProcessRunner.ts`, `useProjectWorkspace.ts`, and drag listener unmount leaks
- [ ] Extract `recordQueryHistory` helper in `SqlQueryConsole.tsx`
- [ ] Delete 8 dead frontend files, remove barrel exports, remove 3 unused npm packages & dockview CSS, remove 4 dead Tauri IPC commands

## Success Criteria
- [ ] `pnpm exec tsc --noEmit` and `pnpm build` pass with zero errors.
- [ ] Opening/closing 20 editor tabs or rapidly toggling terminal tabs produces constant listener counts without orphan shell processes or post-close `didChange` console warnings.
- [ ] Diff shows >=1,247 lines of dead code and 3 npm dependencies removed cleanly.

## Risk Assessment
- Deleting `pnpm` packages offline/behind proxy could update `pnpm-lock.yaml` unexpectedly — check `pnpm remove` cleanly or confirm registry-free lockfile update (`--offline` if supported).
- Double-check `git grep` on each of the 8 deleted symbols and 4 deleted Tauri commands immediately before deleting in case another branch/phase referenced them.

## Security Considerations
- Reduces WebView attack surface by dropping unused third-party npm packages (`dockview`, `clsx`, `tailwind-merge`) and dead components.
