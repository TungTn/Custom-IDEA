---
phase: 2
title: "VFS, Indexer, HTTP & DB Integrity"
status: pending
priority: P1
effort: "5h"
dependencies: []
---

# Phase 2: VFS, Indexer, HTTP & DB Integrity

## Overview
Fix VFS path traversal / Zip Slip, ZIP bomb OOM, cyclic symlink stack overflow, recursive directory self-copy, broken ignore filters across VFS/Indexer/Coverage, stale & unbounded caches (`VFS_BUFFERS`, `IndexManager`, `POOL_CACHE`), HTTP SSRF/OOM/client churn, and SQL `WITH` CTE / dialect identifier bugs. (Covers audit findings #3, #4, #11, #14, #15, #16, and HTTP client reuse from #20.)

## Requirements
- **Functional:**
  - `create_project_on_disk` and ZIP settings import/export reject `..`, root/prefix paths, and cap uncompressed reads per entry.
  - `read_directory_tree` never loops infinitely on Windows junctions / cyclic symlinks; `copy_dir_all` / `vfs_copy_file` / `vfs_move_path` reject `dst` inside `src`.
  - `is_ignored_path` in `ide-vfs`, `ide-index`, and `ide-coverage` only evaluates paths relative to project `root` by exact path component match (never false-matching `D:\build\app` or `builder.rs`).
  - `read_file_content` reflects external disk modifications (`git checkout`, etc.) immediately and frees/bounds memory; `IndexManager` canonicalizes keys and avoids concurrent duplicate builds.
  - `http_execute_request` validates `http`/`https` schemes, blocks redirects into loopback/link-local/private ranges (SSRF protection), streams bodies up to a strict byte limit, and reuses one `reqwest::Client`.
  - `db_execute_query` routes `WITH ...` CTEs to `fetch_all` (after stripping leading comments/whitespace), escapes identifiers per dialect (`"` vs `` ` ``), and caps `POOL_CACHE`.
- **Non-functional:**
  - Search/text offset matching handles multi-byte UTF-8 safely (`search_project_text` UTF-8 column/offset alignment).

## Architecture
- **Shared Path Guard (`ide-vfs`):** Helper `resolve_confined_path(base: &Path, rel: &str)` rejecting `Component::ParentDir`, `Component::RootDir`, `Component::Prefix` and verifying target does not escape `base`.
- **Shared Ignore Filter Helper:** Exact component matching on `path.strip_prefix(root)` rather than `.to_string_lossy().contains(...)`.
- **Bounded & Fresh Caches:**
  - `VFS_BUFFERS`: Either drop read caching on `read_file_content` (reading directly from OS page cache outside locks) OR cache with `(len, modified)` metadata validation + `MAX_BUFFERS` eviction + invalidation in `vfs_delete_path`/`vfs_move_path`/`save_file_content`. Removing stale caching for `read_file_content` and releasing locks before disk I/O is simplest and prevents external-edit staleness cleanly.
  - `IndexManager`: Normalize keys via `std::fs::canonicalize` fallback, serialize concurrent builds per project key with a per-project `tokio`/`std` mutex or singleflight lock, and evict oldest entry above max workspaces (e.g., 5).
  - `POOL_CACHE`: Bound cached pools (e.g., max 16 URLs; call `pool.close().await` when evicting).

## Related Code Files
- Modify: `D:\IDE\crates\ide-vfs\src\commands.rs`
- Modify: `D:\IDE\crates\ide-index\src\indexer.rs`
- Modify: `D:\IDE\crates\ide-index\src\symbols.rs`
- Modify: `D:\IDE\crates\ide-coverage\src\commands.rs`
- Modify: `D:\IDE\crates\ide-http\src\commands.rs`
- Modify: `D:\IDE\crates\ide-http\src\parser.rs`
- Modify: `D:\IDE\crates\ide-db\src\commands.rs`
- Modify: `D:\IDE\src-tauri\src\commands.rs` (unregister dead `vfs_read_file` & `vfs_get_line_count` if moved here or in Phase 4)

## Implementation Steps
1. **`crates/ide-vfs/src/commands.rs`:**
   - Add `sanitize_relative_path(rel: &str)` and enforce it in `create_project_on_disk` (L195-201), `read_settings_from_zip_or_folder` (L540-549), and `export_settings_to_zip` (L597-603).
   - Bound ZIP entry reads using `.take(MAX_SETTINGS_ENTRY_BYTES)` (e.g., 10 MiB) and propagate read errors instead of `let _ = entry.read_to_string(...)`.
   - Update `read_directory_tree` (L84-145, L227, L240): check `std::fs::symlink_metadata` (`!file_type.is_symlink()`) before recursing and pass bounded `max_depth` (e.g., 64).
   - Update `copy_dir_all` / `vfs_copy_file` / `vfs_move_path` (L609-665): canonicalize parent paths and reject if `dst.starts_with(src)`; propagate `remove_dir_all`/`remove_file` errors in `vfs_move_path`.
   - Fix `is_ignored_path` (L147-169) by accepting `(root: &Path, path: &Path)` and stripping `root` first (`search_project_files`, `search_project_text`, `watch_project_directory`).
   - Fix `read_file_content` (L245-254) so it does not hold `VFS_BUFFERS` lock during disk I/O and does not return stale cached strings when disk contents changed (invalidation on `vfs_delete_path`/`vfs_move_path` or dropping read-side `Rope` cache completely since frontend already holds document text in CodeMirror).
   - Fix `search_project_text` (L414-425) byte-offset mismatch when `to_lowercase()` changes byte length (e.g. `İ` -> `i\u{307}`).
2. **`crates/ide-index/src/{indexer.rs, symbols.rs}` & `crates/ide-coverage/src/commands.rs`:**
   - Replace `.to_string_lossy().contains(...)` in `ide-index::is_ignored_path` (`indexer.rs:11-20`) and `coverage_detect_reports` (`ide-coverage/commands.rs:116-119`) with relative path component equality checks after stripping `root`.
   - In `IndexManager` (`indexer.rs:30-138`): canonicalize `project_path`, serialize per-project `build_index` calls, propagate `Result` in `get_or_build`, bound cache size (e.g., max 6 projects), and either add C/C++ parsing or drop unread `.c/.cpp/.h` file reads (`L82-96`).
   - Track multi-line `/* ... */` state & avoid comment `.contains(...)` kind misclassification in `symbols.rs` (small hygiene fix).
3. **`crates/ide-http/src/{commands.rs, parser.rs}`:**
   - Replace per-call `reqwest::Client::builder()` (`commands.rs:9-12`) with `static HTTP_CLIENT: LazyLock<reqwest::Client>` using custom `redirect::Policy` validating target URL scheme (`http`/`https`) and denying redirects/requests to loopback/private/link-local IPs unless explicitly targeting `localhost`/`127.0.0.1` *directly* requested by the user (block cross-origin public -> private/metadata SSRF redirects!).
   - Stream `response.chunk().await` with a hard 16 MiB cap (`commands.rs:57-63`) and preserve multi-value headers (e.g. `Set-Cookie`).
4. **`crates/ide-db/src/commands.rs`:**
   - Update `db_execute_query` (`L244-252`): strip leading `--` / `/* ... */` SQL comments before checking leading keyword (`SELECT`, `WITH`, `PRAGMA`, `EXPLAIN`, `SHOW`, `DESCRIBE`, `VALUES`).
   - Escape identifiers (`"..."` escaping `"` -> `""` for SQLite/Postgres; `` `...` `` escaping `` ` `` -> `` `` `` for MySQL) in `introspect_sqlite` (`L358-416`) and `db_get_table_data` (`L599-628`).
   - Bound `POOL_CACHE` (`L64-104`) to e.g. max 16 pools (closing evicted `AnyPool` cleanly) and add explicit `db_close_pool` / close-on-cap.

## Todo List
- [ ] Harden `ide-vfs` path confinement, ZIP read bounds, symlink-safe tree walk, self-copy check, and stale cache removal
- [ ] Fix `is_ignored_path` relative component matching in `ide-vfs`, `ide-index`, and `ide-coverage`
- [ ] Harden `IndexManager` canonicalization, build deduplication, and `symbols.rs` multi-line comment handling
- [ ] Harden `ide-http` pooled client, redirect SSRF guard, and streaming body cap
- [ ] Fix `ide-db` `WITH` CTE query routing, dialect identifier quoting, and bounded `POOL_CACHE`

## Success Criteria
- [ ] `create_project_on_disk` rejects `../escape.txt` and `C:\Windows\foo.txt`.
- [ ] Workspaces inside `D:\build\app` return matching search/index results instead of `[]`.
- [ ] Editing a file externally on disk causes `read_file_content` to return the updated content.
- [ ] `WITH c AS (SELECT 1 AS a) SELECT * FROM c` returns column `a` and row `[1]` via `db_execute_query`.
- [ ] Downloading a >16 MiB body or redirecting to `169.254.169.254` from an external URL fails cleanly in `ide-http`.

## Risk Assessment
- Blocking `localhost` completely in `ide-http` would break developers testing local APIs in `.http` files — mitigation: block *redirects* from non-loopback hosts into loopback/private/metadata IPs (`169.254.169.254`, `10.0.0.0/8`, `127.0.0.0/8`, etc.), while always blocking non-`http`/`https` schemes and link-local cloud metadata (`169.254.169.254`).
- Removing `VFS_BUFFERS` caching could slightly increase disk reads during workspace-wide Sonar scans — OS file cache handles rapid sequential reads well and eliminates stale-content bugs.

## Security Considerations
- Mitigates Path Traversal / Zip Slip (`ide-vfs`), ZIP Bomb DoS (`ide-vfs`), Symlink Recursion DoS (`ide-vfs`), SSRF redirect attacks & OOM (`ide-http`), and SQL identifier injection (`ide-db`).
