---
phase: 3
title: Frontend Feature Organization and Re-exports
status: completed
priority: P2
effort: 45m
dependencies:
  - '1'
---

# Phase 3: Frontend Feature Organization and Re-exports

## Overview

Rationalize single-file feature folders in `src/features/`, consolidate plugin marketplace domain files, and streamline the monolithic `src/features/index.ts` barrel export file to avoid circular dependencies and messy import paths.

## Requirements

- Functional:
  - All existing exports from `src/features` and `src/workbench` remain intact without breaking consumers (`App.tsx`, modals, panels).
  - Clear, predictable directory convention across features.
- Non-functional:
  - Eliminate shallow 1-file directories where unnecessary or provide standard barrel `index.ts` files for them.
  - Standardize plugin marketplace domain files (unify store, UI, and types).

## Architecture

Currently, `src/features/` has 20 directories, with 6 directories containing only 1 file:
- `src/features/coverage/CoverageGutter.tsx`
- `src/features/docker/DockerToolWindow.tsx`
- `src/features/endpoints/EndpointsToolWindow.tsx`
- `src/features/learn/LearnPanel.tsx`
- `src/features/profiler/ProfilerToolWindow.tsx`
- `src/features/todo/TodoToolWindow.tsx`

Additionally, plugin management is split across `src/stores/pluginStore.ts`, `src/workbench/plugins/`, and `src/types/`.

Standardizing each feature directory with its own local `index.ts` ensures that consumers can import either via `@/features` or `@/features/<feature-name>` predictably, following feature-sliced design best practices.

## Related Code Files

- Modify:
  - `src/features/index.ts`
  - `src/features/coverage/index.ts` (create)
  - `src/features/docker/index.ts` (create)
  - `src/features/endpoints/index.ts` (create)
  - `src/features/learn/index.ts` (create)
  - `src/features/profiler/index.ts` (create)
  - `src/features/todo/index.ts` (create)
  - `src/App.tsx` (verify clean imports)

## Implementation Steps

1. Add standard `index.ts` entry points to single-component feature folders:
   - `src/features/coverage/index.ts` -> export `CoverageGutter`
   - `src/features/docker/index.ts` -> export `DockerToolWindow`
   - `src/features/endpoints/index.ts` -> export `EndpointsToolWindow`
   - `src/features/learn/index.ts` -> export `LearnPanel`
   - `src/features/profiler/index.ts` -> export `ProfilerToolWindow`
   - `src/features/todo/index.ts` -> export `TodoToolWindow`
2. Audit `src/features/index.ts`:
   - Group re-exports cleanly by domain (Core Workbench, Navigation & Search, Language & Build, System & Tooling).
   - Ensure all types are explicitly exported with `export type { ... }` for Vite/TypeScript compatibility (`isolatedModules`).
3. Check `src/workbench/plugins`:
   - Ensure clean interface with `src/stores/pluginStore.ts`.
4. Run `pnpm exec tsc --noEmit` to verify all imports resolve without error.

## Success Criteria

- [ ] Every feature directory under `src/features/` has a clean `index.ts` entry point.
- [ ] `src/features/index.ts` uses type-only re-exports where appropriate.
- [ ] `pnpm exec tsc --noEmit` passes with 0 type errors.

## Risk Assessment

- **Risk:** Renaming or changing export paths breaks imports in `App.tsx` or other workbench components.
  - **Mitigation:** Keep all top-level exports in `src/features/index.ts` backwards-compatible.
