---
title: 'Audit Remediation, Security Hardening & Bloat Cleanup'
description: >-
  Remediate all 20 findings (13 Must Fix, 5 Should Fix, 2 Nice to Have) from the
  2026-11-10 /ponytail-audit across Rust crates and React frontend.
status: pending
priority: P1
branch: master
tags:
  - security
  - bugfix
  - refactor
  - tech-debt
  - backend
  - frontend
blockedBy: []
blocks: []
created: '2026-11-10T09:27:31.156Z'
createdBy: 'ck:plan'
source: skill
---

# Audit Remediation, Security Hardening & Bloat Cleanup

## Overview

End-to-end remediation plan addressing all 20 verified findings from the 2026-11-10 `/ponytail-audit` report across the Tauri v2 / Rust workspace (`crates/*`, `src-tauri/*`) and React 18 / TypeScript frontend (`src/*`, `package.json`).

**Scope Selected:** All 3 audit tiers (13 Phải sửa + 5 Nên sửa + 2 Có thì tốt) organized into 5 sequential/modular phases with clear file boundaries:
1. **Phase 1 — Process & Execution Hardening:** `cmd.exe` injection fix, ConPTY/DAP mutex deadlock elimination, PTY/LSP/DAP zombie & orphaned child cleanup, LSP/Docker executable & argument validation, delete fake `deploy_files_to_server` stub, replace 4 `curl.exe` spawns with `reqwest` + real `plugin.xml` verification.
2. **Phase 2 — VFS, Indexer, HTTP & DB Integrity:** Path Traversal / Zip Slip & ZIP bomb bounds, symlink-safe bounded tree traversal & self-copy guards, fixed relative-path ignore filters, bounded/fresh caches (`VFS_BUFFERS`, `IndexManager`, `POOL_CACHE`), HTTP SSRF/size bounds + pooled client, SQL `WITH` CTE routing + dialect-safe identifier escaping.
3. **Phase 3 — WebView Security & Credential Storage:** Remove `new Function` in debugger evaluator, enable strict Tauri CSP, migrate SonarQube / Local AI / GitHub secrets from `localStorage` to OS `keyring`, enforce HTTPS & env-var token passing for Sonar Maven runner.
4. **Phase 4 — Frontend Lifecycle, Speed & Dead Code Cleanup:** Fix LSP/Terminal/Editor listener & timer leaks, cancel stale `didChange` timers on `closeDocument`, rAF-throttle Sticky Scroll, deduplicate SQL history persistence, remove 8 dead frontend files (1,247 lines), 3 unused npm packages (`clsx`, `tailwind-merge`, `dockview`), dead CSS, and unused Tauri IPC handlers.
5. **Phase 5 — Regression & Security Test Suite:** Remove hardcoded `test_cmd_mvn`, add focused unit/regression tests covering every fixed invariant across Rust crates, and validate workspace compile, TypeScript check, test suite, and build.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Process and Execution Hardening](./phase-01-process-and-execution-hardening.md) | Completed |
| 2 | [VFS Indexer HTTP and DB Integrity](./phase-02-vfs-indexer-http-and-db-integrity.md) | Completed |
| 3 | [WebView Security and Credential Storage](./phase-03-webview-security-and-credential-storage.md) | Pending |
| 4 | [Frontend Lifecycle Speed and Dead Code Cleanup](./phase-04-frontend-lifecycle-speed-and-dead-code-cleanup.md) | Pending |
| 5 | [Regression and Security Test Suite](./phase-05-regression-and-security-test-suite.md) | Pending |

## Dependencies

- No blocking dependencies on existing plans (all prior plans in `D:\IDE\plans\` are completed).
- Phase 5 depends on Phases 1–4 completing so tests validate the final hardened interfaces.
- Phases 1 and 2 touch disjoint crates (`ide-run`, `ide-terminal`, `ide-lsp`, `ide-dap`, `ide-docker`, `window.rs` vs `ide-vfs`, `ide-index`, `ide-coverage`, `ide-http`, `ide-db`) except minor `src-tauri/Cargo.toml` / `src-tauri/src/commands.rs` wiring, best executed sequentially to keep builds green at every checkpoint.
