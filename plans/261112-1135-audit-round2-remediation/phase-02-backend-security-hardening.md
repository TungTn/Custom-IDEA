---
phase: 2
title: Backend Security Hardening
status: completed
priority: P1
effort: 4h
dependencies:
  - 1
---

# Phase 2: Backend Security Hardening

## Overview
Closes remaining injection, path traversal, SSRF, and self-update tampering vulnerabilities across `ide-db` + `DatabaseTableGrid.tsx`, `ide-vcs`, `ide-http`, `src-tauri/src/updater.rs`, and `scripts/publish-update.cjs`.

## Requirements
- **Functional:**
  - **SQLi & DataGrid safety (`ide-db` + `DatabaseTableGrid.tsx`):**
    - Keep `db_get_table_data` parameter signature backward-compatible (`order_by: Option<String>`, `where_clause: Option<String>`), enforcing strict validation inside Rust:
      - `order_by`: parse comma-separated `column [ASC|DESC]` clauses, validating identifier syntax + re-escaping via `escape_sql_identifier` (rejecting arbitrary expressions, subqueries, or `;`).
      - `where_clause`: parse safe simple predicates (`column OP value` joined by `AND`/`OR`, where `OP` in `=`, `!=`, `<>`, `<`, `<=`, `>`, `>=`, `LIKE`, `IS NULL`, `IS NOT NULL` and values are single-quoted string/numeric literals), rejecting `;`, comments `--`/`/*`, subqueries `(`, `UNION`, etc., and re-serializing with `escape_sql_identifier` + sanitized literals (or bound args).
    - Fix `normalize_connection_url` query-param handling (`?cache=shared` / `&mode=ro`), `url.trim()` before `starts_with("mysql")`, Windows `sqlite:///D:/...` parent dir creation, `(SELECT ...)` / `RETURNING *` / `WITH ... DELETE` SQL classification, `NaN`/non-UTF-8 extraction, and streamed `fetch` capped at `limit`.
    - Fix all `DatabaseTableGrid.tsx` bugs: add `whereFilter` dependency cleanly (debounced or triggered properly), make `handleAddRow` populate from `activeColumns` (not stale `table.columns`), track stable `_rowKey` + `_isNew` per row so `handleAddRow` never shifts `dirtyCells`, quote identifiers safely, emit `INSERT` for new rows, and execute per-statement updates individually via `db_execute_query` (never stacked multi-statement `\n` strings).
  - **Git traversal, rebase exec & flag injection (`ide-vcs`):**
    - Add `validate_repo_relative_path(project_path, rel_path)` validating relative components (no `..`, root/drive prefixes, NUL) + canonical containment inside `project_path`; apply to `git_get_file_content_at_revision`, `git_get_conflict_stages`, and `git_resolve_conflict`.
    - Harden `git_interactive_rebase`: reject `\r`, `\n`, `\0` in `item.hash` and `item.subject`, reject leading `-` in `base_commit`, use PID + `AtomicU64` unique temp files, and fail on script write errors.
    - Guard `commit_hash`, `branch`, `tag_name`, `upstream` across `ide-vcs` commands against leading `-` option injection and control chars, inserting `--` before refs/paths where supported.
    - Guard `normalize_gitlab_base_url` against `?`/`#`, clear `GIT_TRACE2*` in `git_clone`, and expand `redact_secrets` to scrub URL-embedded credentials (`https://user:token@host`).
  - **HTTP SSRF DNS/IPv6 hardening (`ide-http`):**
    - Extract SSRF IP/host validation handling `url::Host::Ipv6` / stripped brackets (`IpAddr`, including `Ipv6Addr::to_ipv4_mapped()` for `[::ffff:169.254.169.254]` and `[::ffff:127.0.0.1]`, `fe80::/10`, `fc00::/7`, normalized `localhost.`, `*.localhost`).
    - Attach a custom `reqwest::dns::Resolve` wrapper on `HTTP_CLIENT` enforcing metadata/link-local blocks for all resolved IPs and blocking remote hostnames whose DNS resolves to loopback/private metadata IPs (while preserving local `http://127.0.0.1:<port>` loopback tests when initial URL is explicitly loopback).
    - Fix `parser.rs` unknown HTTP method handling (return error or clean method parse instead of turning `FOO` into `url = "FOO"`), block `###` inside non-empty bodies unless separated cleanly, and preserve multi-headers / handle non-UTF-8 bodies cleanly.
  - **Self-updater SHA-256 & Batch hardening (`updater.rs`, `updaterService.ts`, `useAutoUpdate.ts`, `publish-update.cjs`):**
    - Add `sha2` (`0.10.9` already in `Cargo.lock`) to `src-tauri/Cargo.toml`. Update `apply_update_and_restart(new_exe_bytes: Vec<u8>, expected_sha256: String)` in `src-tauri/src/updater.rs` to verify valid 64-hex SHA-256 digest matches `new_exe_bytes` and Windows `MZ` header check before writing temp `.exe`. Pass `TEMP_EXE` / `TARGET_EXE` to `.bat` via `Command::env(...)` (`%TEMP_EXE%`, `%TARGET_EXE%`). Keep `updater.rs`'s immediate `std::process::exit(0)` so `update_*.bat` can replace the running `.exe`.
    - Update `updaterService.ts:178-180` + `useAutoUpdate.ts:273-282` (including `metadata` in `useCallback` dependencies!) and `scripts/e2e-update.test.mjs` mock assertions so `expectedSha256` is always passed and tested.
    - Update `scripts/publish-update.cjs:398` to apply `encodeURIComponent(...)` to `config.packageName` and `latestExeFileName` in `downloadUrl`.
- **Non-functional:**
  - `cargo check --workspace`, `cargo test --workspace`, `pnpm exec tsc --noEmit`, `pnpm build`, and `node --test scripts/publish-update.test.cjs` pass cleanly.

## Architecture
- Preserve existing Tauri IPC command names (`db_get_table_data`, `apply_update_and_restart`) while strengthening Rust validation and threading `expectedSha256` explicitly from `useAutoUpdate.ts` (`[metadata]`).

## Related Code Files
- Modify: `d:/IDE/crates/ide-db/src/commands.rs`, `d:/IDE/src/features/database/DatabaseTableGrid.tsx`
- Modify: `d:/IDE/crates/ide-vcs/src/commands.rs`
- Modify: `d:/IDE/crates/ide-http/src/commands.rs`, `d:/IDE/crates/ide-http/src/parser.rs`
- Modify: `d:/IDE/src-tauri/Cargo.toml`, `d:/IDE/src-tauri/src/updater.rs`
- Modify: `d:/IDE/src/services/updaterService.ts`, `d:/IDE/src/features/update/useAutoUpdate.ts`
- Modify: `d:/IDE/scripts/publish-update.cjs`, `d:/IDE/scripts/e2e-update.test.mjs`

## Implementation Steps
1. Harden `ide-db` (`db_get_table_data` strict SQL predicate/order validator, `normalize_connection_url`, Windows dir creation, SQL classifier, streamed `fetch`) and fix `DatabaseTableGrid.tsx` (`activeColumns`, stable row key, separate `INSERT`/`UPDATE` queries, escaped identifiers, `whereFilter` dependency).
2. Harden `ide-vcs` path containment, `git_interactive_rebase` (`\r`/`\n`/`\0` & PID/Atomic counter), `-` flag checks + `--`, `GIT_TRACE2*`, GitLab `?`/`#`, and `redact_secrets`.
3. Harden `ide-http` (`url::Host::Ipv6` + `to_ipv4_mapped` + ULA/link-local + custom `reqwest::dns::Resolve`, `parser.rs` unknown method & `###` body rule, multi-headers).
4. Add Rust `sha2` verification & env-var `.bat` execution in `src-tauri/src/updater.rs`, pass `metadata.sha256` from `useAutoUpdate.ts` (fix `[metadata]` deps!) -> `updaterService.ts` -> Tauri, update `scripts/e2e-update.test.mjs`, and `encodeURIComponent` `downloadUrl` in `scripts/publish-update.cjs`.
5. Run verification gates (`cargo test --workspace`, `pnpm exec tsc --noEmit`, `pnpm build`, `node --test scripts/publish-update.test.cjs`).

## Success Criteria
- [ ] `db_get_table_data` rejects stacked `;` SQL, arbitrary expressions in `order_by`/`where_clause`; `DatabaseTableGrid` `INSERT`/`UPDATE`/filter work without row-index drift.
- [ ] `ide-vcs` blocks `../../`, `/C:/...`, `\nexec` rebase injection, and `-` flag injection.
- [ ] `ide-http` blocks IPv6-mapped metadata/loopback addresses and DNS-rebound loopback/link-local IPs without breaking direct loopback tests.
- [ ] `apply_update_and_restart` fails on SHA-256 mismatch or missing hash and `useAutoUpdate.ts` passes live `metadata.sha256`.

## Risk Assessment
- Keep direct loopback HTTP requests (`http://127.0.0.1:<port>`) working for local dev servers and tests while blocking remote-to-loopback DNS/redirect SSRF and all metadata/link-local IPs (`169.254.*`, `fe80::`, `[::ffff:169.254.169.254]`).
