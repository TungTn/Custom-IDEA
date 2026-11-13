---
phase: 5
title: Regression Tests and Verification Gates
status: completed
priority: P1
effort: 3h
dependencies:
  - 1
  - 2
  - 3
  - 4
---

# Phase 5: Regression Tests and Verification Gates

## Overview
Adds deterministic, offline unit and integration tests for every bug, security boundary, and parser fixed in Phases 1–4 (including previously untested modules `ide-terminal`, `ide-vcs`, and `ide-coverage`), then runs full workspace verification gates.

## Requirements
- **Functional:**
  - `ide-vcs`: add offline tests for `git_get_status` (working-tree leading space & renames), `git_get_commit_details` & `git_stash_get_files` (paths containing spaces split by `\t`), `git_get_blame` (trailing blank line), path traversal rejection (`../../`, `/C:/...`), `git_interactive_rebase` `\nexec` injection & `-` flag rejection, GitLab `?`/`#` URL rejection, and URL-embedded credential redaction.
  - `ide-terminal`: add unit tests covering UTF-8 multi-byte chunk buffering/flush helper, `executable_exists_in_path`, and concurrent session replacement cleanup.
  - `ide-coverage`: add tests covering `jacoco.xml`, `cobertura.xml` (without `<methods>` double counting), missing `end_of_record` EOF flush, duplicate `SF:` merging, `0` lines returning `0.0%` across parser + `coverage_load_file`, and `coverage_get_for_file` boundary matching (`my_utils.ts` vs `utils.ts`).
  - `ide-db`: add tests for `normalize_connection_url` preserving `?cache=shared` / `&mode=ro`, `(SELECT 1) UNION (SELECT 2)` & `RETURNING *` classification, `WITH ... DELETE` routing, and `db_get_table_data` rejecting SQLi in `where_clause`/`order_by`.
  - `ide-http`: add tests covering IPv6-mapped metadata/loopback (`[::ffff:169.254.169.254]`, `[::ffff:127.0.0.1]`), `localhost.` / `*.localhost`, custom DNS IP blocking logic, unknown method parsing error & `###` body edge cases in `parser.rs`, and binary/multi-header handling.
  - `ide-lsp` / `ide-dap`: add tests covering JSON-RPC server->client request vs client response ID collision, non-UTF-8 header recovery, custom `pylsp` args & absolute path enforcement, and DAP empty verified breakpoint handling.
  - `ide-vfs` / `ide-index` / `ide-run`: add tests for `is_ignored_relative_path` with `'İ'`/`'K'` Unicode paths and `D:/app.git` prefix lookalike, `IndexManager` rebuild freshness after change, `vfs_delete_path` dangling symlink check, `resolve_executable_path("\"")` non-panic, and JDK numeric version sorting.
  - `src-tauri` & `scripts`: add Rust unit tests in `updater.rs` verifying SHA-256 mismatch rejection, invalid hex rejection, and `MZ` header validation cleanly; add assertions in `scripts/publish-update.test.cjs` verifying URL-encoded `downloadUrl` + `sha256` emission; run `node --test scripts/publish-update.test.cjs` and `node --test scripts/e2e-update.test.mjs`.
- **Non-functional:**
  - All tests run deterministically offline in <30s after incremental build, with 0 ignored or failed tests and zero leaked temp files.

## Architecture
- Keep test helpers local inside each crate's `#[cfg(test)] mod tests` / integration test file with RAII `Drop` cleanup guards.

## Related Code Files
- Modify: `d:/IDE/crates/ide-vcs/src/commands.rs`
- Modify: `d:/IDE/crates/ide-terminal/src/commands.rs`
- Modify: `d:/IDE/crates/ide-coverage/src/parser.rs`, `d:/IDE/crates/ide-coverage/src/commands.rs`
- Modify: `d:/IDE/crates/ide-db/tests/test_db_engine.rs`
- Modify: `d:/IDE/crates/ide-http/src/commands.rs`, `d:/IDE/crates/ide-http/tests/test_http_client.rs`
- Modify: `d:/IDE/crates/ide-lsp/src/commands.rs`, `d:/IDE/crates/ide-dap/src/commands.rs`
- Modify: `d:/IDE/crates/ide-vfs/src/commands.rs`, `d:/IDE/crates/ide-index/src/indexer.rs`, `d:/IDE/crates/ide-run/src/commands.rs`
- Modify: `d:/IDE/src-tauri/src/updater.rs`
- Modify: `d:/IDE/scripts/publish-update.test.cjs`

## Implementation Steps
1. Write unit tests across `ide-vcs`, `ide-terminal`, and `ide-coverage`.
2. Write unit/integration tests across `ide-db`, `ide-http`, `ide-lsp`, `ide-dap`, `ide-vfs`, `ide-index`, `ide-run`, `src-tauri/src/updater.rs`, and `scripts/publish-update.test.cjs`.
3. Run full verification gates after final edit:
   - `cargo test --workspace`
   - `pnpm exec tsc --noEmit`
   - `pnpm build`
   - `node --test scripts/publish-update.test.cjs`
   - `node --test scripts/e2e-update.test.mjs`
4. Verify `git status` confirms clean `crates/*/bindings` and `src/bindings.ts` with zero unintended diffs.

## Success Criteria
- [ ] `cargo test --workspace` passes 100% with 0 failed and 0 ignored tests.
- [ ] `pnpm exec tsc --noEmit`, `pnpm build`, and Node update tests pass cleanly.
- [ ] Every Critical/Warning fix from Phases 1–4 has an automated regression test failing if reverted.

## Risk Assessment
- Any binding regeneration during `cargo test --workspace` (`crates/*/bindings`) must match intentional Phase 4 DTO changes cleanly.
