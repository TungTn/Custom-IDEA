---
title: 'Audit Round 2 Remediation, Hardening and Cleanup'
description: >-
  Remediate all 20 findings from the 2026-11-12 /ponytail-audit across
  React/TypeScript frontend, Tauri shell, Rust domain crates, and release
  scripts.
status: completed
priority: P1
branch: master
tags:
  - security
  - bugfix
  - ipc
  - performance
  - cleanup
  - tests
blockedBy: []
blocks: []
created: '2026-11-12T04:34:58.198Z'
createdBy: 'ck:plan'
source: skill
---

# Audit Round 2 Remediation, Hardening and Cleanup

## Overview

Remediates all 20 verified findings (12 Phải sửa, 6 Nên sửa, 2 Có thì tốt) plus relevant minor items identified in the 2026-11-12 `/ponytail-audit`. Organized into 5 sequential, low-risk phases with clear file ownership boundaries across the Tauri v2 / Rust workspace (`crates/*`, `src-tauri/*`), React 18 / TypeScript frontend (`src/*`), and release scripts (`scripts/*`).

## Scope & Locked Decisions
- **Scope:** All 20 audit findings (Phải sửa 1–12, Nên sửa 13–18, Có thì tốt 19–20).
- **Coverage XML (`ide-coverage`):** Implement lightweight `jacoco.xml` and `cobertura.xml` parsing alongside LCOV, return `0.0%` on zero-line files, flush trailing records at EOF, and match paths on normalized path-component boundaries (case-insensitive on Windows).
- **Updater Integrity (`src-tauri/src/updater.rs` + `scripts/publish-update.cjs`):** Require `expected_sha256: String` in `apply_update_and_restart` (verified on Rust side via `sha2` before overwriting `.exe`), pass batch script paths safely via env vars, and URL-encode `downloadUrl` components in `publish-update.cjs`.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Frontend IPC Contract and Save Integrity](./phase-01-frontend-ipc-contract-and-save-integrity.md) | Completed |
| 2 | [Backend Security Hardening](./phase-02-backend-security-hardening.md) | Completed |
| 3 | [Runtime Integrity and Protocol Fixes](./phase-03-runtime-integrity-and-protocol-fixes.md) | Completed |
| 4 | [Performance Lifecycle and Dead Code Cleanup](./phase-04-performance-lifecycle-and-dead-code-cleanup.md) | Completed |
| 5 | [Regression Tests and Verification Gates](./phase-05-regression-tests-and-verification-gates.md) | Completed |

## Dependencies

- Prior plan `261110-1626-audit-remediation-and-hardening` is completed and committed (`57f11f7`).
- Phases 1–4 isolate frontend IPC fixes, backend security fixes, protocol/parser fixes, and cleanup/perf before Phase 5 adds the comprehensive regression suite and verifies all workspace gates (`cargo test --workspace`, `pnpm exec tsc --noEmit`, `pnpm build`, `node --test scripts/publish-update.test.cjs`).
