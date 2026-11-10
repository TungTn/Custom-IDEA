---
phase: 5
title: "Regression and Security Test Suite"
status: pending
priority: P1
effort: "4h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Regression and Security Test Suite

## Overview
Replace author-specific hardcoded tests (`test_cmd_mvn`) with real deterministic unit & integration regression tests covering all high-risk invariants hardened in Phases 1–4, ensuring any regression in path safety, command escaping, ignore filters, cache freshness, locking, SQL routing, or HTTP bounds immediately fails CI/local checks. (Covers audit finding #18.)

## Requirements
- **Functional:**
  - Remove `test_cmd_mvn` (`crates/ide-run/src/commands.rs:1264-1277`) which hardcodes `C:\Program Files\Java\jdk-25.0.5.0.3` and has zero assertions.
  - Add targeted, fast, deterministic Rust unit tests (`#[test]` / `#[tokio::test]`) requiring no external network, Docker daemon, or author-specific local SDK paths:
    - `ide-vfs`: `sanitize_relative_path` rejects `../`, `C:\...`, `/etc/...`; `copy_dir_all` / `vfs_move_path` rejects `dst` inside `src`; `is_ignored_path` strips `root` (does not fail on `C:\tmp\build\proj`); `read_file_content` reflects updated disk edits; `search_project_text` handles multi-byte UTF-8 case changes without invalid offsets; ZIP read caps oversized entries.
    - `ide-index`: `is_ignored_path` allows files named `builder.rs`, `distribution.ts`, `.github/workflows/ci.yml` while ignoring `node_modules` / `target` / `.git`; `symbols.rs` ignores multi-line `/* ... */` blocks and trailing comments like `pub struct Foo {} // enum`.
    - `ide-run`: Windows command preparation handles spaces & preserves metacharacters safely without splitting injection tokens; `download_real_jdk` error path cleans temp file (if testable with temp dir/mock).
    - `ide-docker`: `validate_container_id` rejects `--follow`, `-v`, empty/whitespace, and allows valid IDs/names; `socket_path` rejects `ssh://` and arbitrary binary validation rejects `.bat`/missing files.
    - `ide-lsp` / `ide-dap`: unsupported `debug_type` fails cleanly without `node` REPL hang; `Content-Length` oversize limit rejects OOM payload; init failure cleans active registry.
    - `ide-http`: URL validator rejects `file://` / `ftp://` and SSRF redirect checker blocks hops into `169.254.169.254` / `127.0.0.1` from public hosts; streaming body cap enforces size limit.
    - `ide-db`: query classifier routes `WITH cte AS (SELECT 1) SELECT * FROM cte` (and commented queries `-- comment\nSELECT 1`) as result-set queries; identifier escaping handles embedded quotes (`"` / `` ` ``) per dialect.
  - Verify existing Node tests (`scripts/publish-update.test.cjs`, etc.), Rust workspace tests (`cargo test --workspace`), TypeScript typecheck (`pnpm exec tsc --noEmit`), and production frontend/Tauri check (`pnpm build` & `cargo check --workspace`).
- **Non-functional:**
  - All tests run deterministically offline in <30s after compilation.

## Architecture
- Keep test helpers local inside `#[cfg(test)] mod tests` of each touched crate module (avoiding cross-crate test harness bloat).
- Where external binaries/servers would otherwise be needed (`ide-http` local loopback test server via `tokio::net::TcpListener`, temp directories via `std::env::temp_dir()` with unique per-test folder & Drop cleanup), spin up lightweight ephemeral fixtures inside tests.

## Related Code Files
- Modify: `D:\IDE\crates\ide-run\src\commands.rs`
- Modify: `D:\IDE\crates\ide-vfs\src\commands.rs`
- Modify: `D:\IDE\crates\ide-index\src\indexer.rs`
- Modify: `D:\IDE\crates\ide-index\src\symbols.rs`
- Modify: `D:\IDE\crates\ide-docker\src\client.rs`
- Modify: `D:\IDE\crates\ide-dap\src\commands.rs`
- Modify: `D:\IDE\crates\ide-lsp\src\commands.rs`
- Modify: `D:\IDE\crates\ide-http\tests\test_http_client.rs`
- Modify: `D:\IDE\crates\ide-db\tests\test_db_engine.rs`

## Implementation Steps
1. Delete `test_cmd_mvn` from `crates/ide-run/src/commands.rs:1263-1277` and add unit tests for Windows process argument quoting/rejection.
2. Add `#[cfg(test)]` tests for `ide-vfs` (path traversal rejection, cyclic symlink / max depth guard, `copy_dir_all` self-copy rejection, relative `is_ignored_path`, UTF-8 `search_project_text`, disk edit freshness, ZIP cap).
3. Add `#[cfg(test)]` tests for `ide-index` (`is_ignored_path` component match, `symbols.rs` multi-line block comment & trailing comment cases) and `ide-docker` (`validate_container_id`, CLI/socket validation).
4. Add `#[cfg(test)]` tests for `ide-dap` & `ide-lsp` (`find_debugger_executable`, oversized `Content-Length` frame rejection, init rollback).
5. Expand `crates/ide-http/tests/test_http_client.rs` (SSRF scheme/redirect policy & body size cap via ephemeral `TcpListener`) and `crates/ide-db/tests/test_db_engine.rs` (`WITH ... SELECT`, `-- comment\nSELECT`, SQLite table name containing quotes `"`).
6. Run full verification gates:
   - `cargo test --workspace`
   - `pnpm exec tsc --noEmit`
   - `pnpm build`
   - `node --test scripts/publish-update.test.cjs`

## Todo List
- [ ] Replace `test_cmd_mvn` with command-preparation security tests in `ide-run`
- [ ] Add VFS path safety, symlink, self-copy, ignore filter, UTF-8, and freshness tests in `ide-vfs`
- [ ] Add indexer component-filter and parser edge-case tests in `ide-index`
- [ ] Add Docker/DAP/LSP input validation & framing limit tests
- [ ] Expand `test_http_client.rs` and `test_db_engine.rs` for SSRF/caps and CTE/identifier escaping
- [ ] Run full Rust + TypeScript + Node test and build verification gates

## Success Criteria
- [ ] `cargo test --workspace` passes 100% with 0 ignored/failed tests across all 11 crates + `src-tauri`.
- [ ] `pnpm exec tsc --noEmit` and `pnpm build` pass cleanly.
- [ ] Zero tests depend on machine-specific JDK paths or external internet connectivity.

## Risk Assessment
- `export_bindings` tests run alongside `cargo test --workspace` and write TypeScript files under `crates/*/bindings` — run `git status` after `cargo test --workspace` to ensure bindings match current DTOs without unexpected diffs (especially after removing `DeploymentResultDto`).

## Security Considerations
- Ensures every security invariant introduced in Phases 1–4 has an automated test preventing silent future regressions.
