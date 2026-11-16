---
title: Codebase Structure Optimization and Cleanup
description: >-
  Remediate architectural and repository structural findings from
  ponytail-review: purge tracked binary maven distribution, remove orphaned
  files, eliminate duplicate Cargo.lock, relocate profiler domain into ide-run
  crate, rationalize frontend feature organization, and establish frontend unit
  test infrastructure.
status: completed
priority: P2
branch: master
tags:
  - cleanup
  - architecture
  - refactoring
  - tests
  - frontend
  - rust
blockedBy: []
blocks: []
created: '2026-11-16T10:16:50.890Z'
createdBy: 'ck:plan'
source: skill
---

# Codebase Structure Optimization and Cleanup

## Overview

This plan executes a comprehensive optimization of the project codebase structure following the `/ponytail-review` audit. It addresses tracked binary bloat in Git, consolidates workspace lockfile authority, moves business logic out of the Tauri application shell into domain crates, cleans up frontend single-file feature folders, and establishes the missing frontend unit test infrastructure.

## Scope & Locked Decisions

- **Maven Binary Purge:** `tools/maven` (~40MB, 50+ JARs/DLLs) is not referenced by any build or runtime code (`ide-run` and `useProcessRunner` use PATH, project wrapper `mvnw`, or user-specified custom path). It will be completely removed from Git and gitignored.
- **Root Artifact Cleanup:** Delete unreferenced test payload `resp.json` and single-icon orphan directory `expui/`.
- **Lockfile Unification:** `src-tauri/Cargo.lock` is deleted; root `Cargo.lock` retains exclusive lockfile authority for the entire Cargo workspace.
- **Profiler Subsystem Relocation:** `src-tauri/src/profiler.rs` is migrated into `crates/ide-run/src/profiler.rs`, keeping `src-tauri` strictly as an IPC and window management shell.
- **Frontend Test Suite:** Introduce `vitest` + `jsdom` to test critical frontend state machines (`editorStore`, `layoutStore`, `pathUtils`) without impacting Vite production build size.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Repository Cleanup and Lockfile Standardization](./phase-01-repository-cleanup-and-lockfile-standardization.md) | Completed |
| 2 | [Architectural Decoupling of Profiler Subsystem](./phase-02-architectural-decoupling-of-profiler-subsystem.md) | Completed |
| 3 | [Frontend Feature Organization and Re-exports](./phase-03-frontend-feature-organization-and-re-exports.md) | Completed |
| 4 | [Frontend Test Infrastructure and Critical Store Tests](./phase-04-frontend-test-infrastructure-and-critical-store-tests.md) | Completed |
| 5 | [Full Workspace Verification Gates and Build Sanity](./phase-05-full-workspace-verification-gates-and-build-sanity.md) | Completed |

## Dependencies

- **Pre-requisite:** Clean working tree on `master` branch.
- **Execution Order:**
  - Phase 1 (Repository Cleanup) is independent and should land first to keep diffs clean.
  - Phase 2 (Backend Decoupling) cleans Rust crate boundaries and passes `cargo check --workspace`.
  - Phase 3 (Frontend Organization) refines feature directory consistency before Phase 4 adds tests.
  - Phase 4 (Test Infrastructure) establishes `pnpm test` for frontend regression prevention.
  - Phase 5 (Verification Gates) validates all Cargo, TypeScript, Vitest, and Vite build pipelines.
