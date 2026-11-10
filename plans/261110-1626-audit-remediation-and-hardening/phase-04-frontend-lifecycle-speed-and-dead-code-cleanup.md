---
phase: 4
title: Frontend Lifecycle Speed and Dead Code Cleanup
status: completed
effort: medium
---

# Phase 4: Frontend Lifecycle Speed and Dead Code Cleanup

## Overview
Remediate memory leaks, uncleaned listeners/timers, unthrottled scroll handlers, duplicated logic, and remove dead files/unused packages across the React/TypeScript frontend.

## Implementation Steps
- [ ] 1. Remove 3 unused npm dependencies (`clsx`, `tailwind-merge`, `dockview`) and purge dockview CSS from `src/index.css`.
- [ ] 2. Remove 8 dead files and update their re-exports (`templateExtension.ts`, `intellijTheme.ts`, `vue.ts`, `CmDiffViewer.tsx`, `TestRunnerPanel.tsx`, `ToolchainsModal.tsx`, `GitBranchesModal.tsx`, `problemsStore.ts`).
- [ ] 3. Fix CodeMirror & LSP leaks in `CmEditor.tsx` (call `unlistenDiagnostics`, clean up scroll listener & timer, verify `isMounted`).
- [ ] 4. Cancel pending `changeTimers` on `closeDocument` in `src/services/lspService.ts`.
- [ ] 5. Fix Terminal listener/timer race in `TerminalPanel.tsx`.
- [ ] 6. Throttle scroll handling via `requestAnimationFrame` in `src/features/editor/StickyScroll.tsx` (Finding #10).
- [ ] 7. Add mounted checks to async `listen` in `useProcessRunner.ts` and `useProjectWorkspace.ts`.
- [ ] 8. Clean up drag listeners on unmount in `App.tsx`, `BottomToolWindow.tsx`, `CommitPanel.tsx`.
- [ ] 9. Deduplicate SQL history persistence in `src/features/database/SqlQueryConsole.tsx`.

## Success Criteria
- [ ] `package.json` cleaned of unused dependencies.
- [ ] All 8 dead files deleted with index exports cleaned.
- [ ] Zero listener or timer leaks in LSP, Editor, and Terminal.
- [ ] Sticky scroll throttled with rAF.
- [ ] Full `pnpm exec tsc --noEmit` and `cargo test --workspace` pass.
