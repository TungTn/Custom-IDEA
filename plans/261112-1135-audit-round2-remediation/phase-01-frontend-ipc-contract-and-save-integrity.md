---
phase: 1
title: Frontend IPC Contract and Save Integrity
status: completed
priority: P1
effort: 3h
dependencies: []
---

# Phase 1: Frontend IPC Contract and Save Integrity

## Overview
Fixes broken Tauri v2 IPC command names and camelCase argument contracts, eliminates silent fake-success fallbacks on failed disk/git/window actions, prevents `saveAllFiles` from clearing `isDirty` when writes fail, resolves relative workspace path hazards on disk saves/moves, and fixes stale UI closures.

## Requirements
- **Functional:**
  - Fix `EditorArea.tsx:1335` (`open_new_window` -> `open_in_new_window` with `{ projectName, projectPath }`, deriving `projectName` from `projectPath` or prop — keeping workspace `projectPath`, never passing a `src/` file subdirectory as `openPath` — and surfacing errors on failure instead of fake success toast).
  - Fix `useMenuDispatcher.ts:224,242` (`create_directory` -> `vfs_create_dir` and real error toasts), `:979-982` (`{ sourcePath, destPath }`), `:1003-1006` (`{ sourcePath, destPath }`), `:1023` (`vfs_delete_path`), resolving relative paths against `currentProjectDirectory` where needed, and `:1064` (`{ filePath }` -> `{ coverageFilePath }`).
  - Fix `CommitPanel.tsx:1326` (`delete_file` -> `vfs_delete_path` with resolved absolute path inside `projectPath`, surfacing errors) and `GitCommitModal.tsx:126` (`{ filePath }` -> `{ path }`).
  - Fix `DiffEditorTab.tsx:325-328` (`write_file_content` -> `save_file_content`, removing hardcoded `'D:\\IDE'` fallback).
  - Fix `App.tsx:341-358` `saveAllFiles` so `isDirty` is cleared ONLY for `tab.id` values whose disk save succeeded (or non-Tauri browser mode), and update `handleCreateNewFile` (`:1608-1645`) to resolve `newPath` against `currentProjectDirectory` before saving to disk or preserve `isDirty: true` when unsaved.
  - Fix `GitToolWindow.tsx:497-519` (`handleFetch`, `handlePull`, `handlePush`) to return early on `.catch()` so warning isn't overwritten by green `'success'` toast.
  - Fix UI logic bugs in the touched git/diff files: `DiffEditorTab.tsx:340-355` stale shortcut closure, `GitBranchPopup.tsx:729,853-860` literal prefix strip + awaited checkout before rebase, `GitCommitModal.tsx:287-291` `Ctrl+Shift+Enter` ordering, and `InteractiveRebaseModal.tsx:36-41` reset when `initialCommits` is empty.
- **Non-functional:**
  - `pnpm exec tsc --noEmit` and `pnpm build` pass cleanly.

## Architecture
- Direct call-site fixes in `src/` matching Rust Tauri v2 command names and camelCase parameter serialization.
- Consolidate all file saves onto `save_file_content` so Phase 4 can safely delete the duplicate `write_file_content` command.

## Related Code Files
- Modify: `d:/IDE/src/workbench/EditorArea.tsx`
- Modify: `d:/IDE/src/hooks/useMenuDispatcher.ts`
- Modify: `d:/IDE/src/features/git/CommitPanel.tsx`
- Modify: `d:/IDE/src/features/git/GitCommitModal.tsx`
- Modify: `d:/IDE/src/features/git/GitToolWindow.tsx`
- Modify: `d:/IDE/src/features/git/DiffEditorTab.tsx`
- Modify: `d:/IDE/src/features/git/GitBranchPopup.tsx`
- Modify: `d:/IDE/src/features/git/InteractiveRebaseModal.tsx`
- Modify: `d:/IDE/src/App.tsx`

## Implementation Steps
1. Fix Tauri IPC command names & camelCase payloads in `EditorArea.tsx`, `useMenuDispatcher.ts`, `CommitPanel.tsx`, `GitCommitModal.tsx`, and `DiffEditorTab.tsx`; verify every call against `src-tauri/src/commands.rs` and Rust parameter names.
2. Update `App.tsx` `saveAllFiles` (`savedIds` `Set<string>`) and `handleCreateNewFile` (absolute project-relative resolution before disk save or keeping `isDirty: true`).
3. Fix `GitToolWindow.tsx` early return on fetch/pull/push errors, `DiffEditorTab.tsx` keydown ref/dependencies, `GitBranchPopup.tsx` literal prefix + awaited checkout, `GitCommitModal.tsx` `Shift+Enter` precedence, and `InteractiveRebaseModal.tsx` empty reset.
4. Run `pnpm exec tsc --noEmit` and `pnpm build` to verify zero TypeScript or bundling regressions.

## Success Criteria
- [ ] Every Tauri `invoke` modified in Phase 1 matches exact command name and camelCase parameter schema in `src-tauri/src/commands.rs` & Rust crates.
- [ ] `write_file_content` has zero callers left in `src/` (migrated to `save_file_content`).
- [ ] Failed disk saves keep `isDirty: true`; failed folder/file/git operations display real error/warning feedback without fake success toasts.
- [ ] `pnpm exec tsc --noEmit` and `pnpm build` pass cleanly.

## Risk Assessment
- `open_in_new_window` must receive the workspace `projectPath` (with derived basename for `projectName`) so the new window initializes the project workspace instead of a nested subfolder.
