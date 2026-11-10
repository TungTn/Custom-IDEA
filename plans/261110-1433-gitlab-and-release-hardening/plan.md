---
title: 'GitLab Security, Clone Reliability & Release Script Hardening'
description: >-
  Fix all 13 findings from /ponytail-review on commit 6bc41ae: move GitLab
  tokens to OS keyring, enforce TLS by default with opt-in self-signed SSL, fix
  private HTTPS cloning and URL crashes, sanitize internal domains, harden
  release cleanup, and add tests.
status: completed
priority: P1
branch: master
tags:
  - security
  - gitlab
  - vcs
  - updater
  - review-fixes
blockedBy: []
blocks: []
created: '2026-11-10T07:33:31.402Z'
createdBy: 'ck:plan'
source: skill
---

# GitLab Security, Clone Reliability & Release Script Hardening

## Overview

Kế hoạch khắc phục triệt để toàn bộ **13 phát hiện** từ đợt `/ponytail-review` trên commit `6bc41ae`, gồm:
- Bảo mật xác thực: đưa GitLab Personal Access Token vào **Windows Credential Manager (`keyring`)**, bật kiểm tra chứng chỉ **TLS mặc định** kèm tùy chọn `"Allow self-signed SSL"` theo từng server, và gỡ bỏ tên miền nội bộ `gitlab.mic.vn`.
- Sửa lỗi chức năng: sửa crash `Invalid URL` khi host thiếu `https://`, hỗ trợ clone repo GitLab Private qua HTTPS bằng `GIT_CONFIG_COUNT` + header `Authorization: Basic`, debounce tìm kiếm & chống race condition, reset selection khi đổi tài khoản, giữ thư mục cha do người dùng chọn.
- Tinh gọn & kiểm thử: xóa dead code và báo `[OK]` giả trong `scripts/publish-update.cjs`, gộp HTTP client dùng chung trong `ide-vcs`, đồng bộ `ts-rs` bindings, và bổ sung unit tests cho Rust + Node release script.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Rust Backend Security & Keyring](./phase-01-rust-backend-security-keyring.md) | Completed |
| 2 | [Frontend GitLab Service & UI Fixes](./phase-02-frontend-gitlab-service-ui-fixes.md) | Completed |
| 3 | [Release Script Hardening & Cleanup](./phase-03-release-script-hardening-cleanup.md) | Completed |
| 4 | [Verification & Bindings Sync](./phase-04-verification-bindings-sync.md) | Completed |

## Mapping 13 Review Findings to Phases

| # | Severity | Finding | Phase |
|---|----------|---------|-------|
| 1 | Must fix | Account dropdown crashes on host without `https://` (`new URL`) | Completed |
| 2 | Must fix | Cloning private GitLab repo over HTTPS fails (no auth/TLS config) | Completed |
| 3 | Must fix | TLS cert verification disabled globally (`danger_accept_invalid_certs(true)`) | Completed |
| 4 | Must fix | GitLab PAT stored in plain-text `localStorage` | Completed |
| 5 | Must fix | Internal domain `gitlab.mic.vn` reintroduced into public UI | Phase 2 |
| 6 | Must fix | `publish-update.cjs` reports `[OK]` when GitLab returns 403 on delete | Phase 3 |
| 7 | Should fix | Search input fires unthrottled requests causing stale out-of-order results | Phase 2 |
| 8 | Should fix | Switching GitLab account keeps previous repo URL selected | Phase 2 |
| 9 | Should fix | Missing tests for Rust GitLab helpers & Node release purge logic | Phase 1, 3 & 4 |
| 10 | Should fix | Dead functions `getPackageFiles` & `deletePackageFile` in `publish-update.cjs` | Phase 3 |
| 11 | Should fix | Duplicate `reqwest::Client` setup & error handling in `ide-vcs` | Phase 1 |
| 12 | Should fix | `GitLabUserDto`/`GitLabProjectDto` skipped in `export_bindings.rs` | Phase 1 & 2 |
| 13 | Nice to have | Clicking GitLab repo overwrites user-browsed parent folder | Phase 2 |

## Dependencies

- `plans/gitlab-integration/plan.md`: **completed** (Phase 1-5 `[x]`); kế hoạch này nâng cấp trực tiếp các module vừa triển khai mà không xung đột với plan đang dở nào.

## Red Team Review

### Session — 2026-11-10
**Findings:** 12 (12 accepted, 0 rejected)
**Severity breakdown:** 5 Critical, 6 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Sync-vs-async `localStorage` migration race & permanent token loss | Critical | Accept | Completed |
| 2 | `saveGitLabAccount` async contract breakage & missed `VcsCloneModal` callers | Critical | Accept | Completed |
| 3 | Unbound `account_id`, cleartext `http://` PAT leak & missing `--` guard in `git_clone` | Critical | Accept | Completed |
| 4 | `reqwest` `rustls-tls` missing Windows native root CAs for corporate TLS | Critical | Accept (modified) | Completed |
| 5 | `publish-update.cjs` hardcodes `rejectUnauthorized: false` & swallows list/delete errors | Critical | Accept | Phase 3 |
| 6 | Re-adding same GitLab host generates new `id` and orphans old keyring PAT | High | Accept | Phase 2 |
| 7 | `git_clone` missing fail-fast, prompt guards, env cleanup & stderr redaction | High | Accept | Phase 1, Phase 2 |
| 8 | `#[ts(type = "number")]` on `Option<i64>` strips `| null` & shifts optionality | High | Accept | Phase 1, Phase 2, Phase 4 |
| 9 | Contradictory `gitlab_list_projects` signature (`token_override` vs `token` vs omitted) | High | Accept | Phase 1, Phase 2 |
| 10 | Search debounce timer leaks across account switch + unguarded `finally` spinner | High | Accept | Phase 2 |
| 11 | Contradictory directory preservation rule & unsafe `proj.name` folder path | High | Accept | Phase 2 |
| 12 | `GITLAB.MIC.VN` remnants in `publish-update.cjs` & non-Windows keyring features | Medium | Accept | Phase 1, Phase 3, Phase 4 |

### Whole-Plan Consistency Sweep
- Files reread: `plan.md`, `phase-01-rust-backend-security-keyring.md`, `phase-02-frontend-gitlab-service-ui-fixes.md`, `phase-03-release-script-hardening-cleanup.md`, `phase-04-verification-bindings-sync.md`
- Decision deltas checked: 12
- Reconciled stale references: 2 (`normalize_gitlab_base_url` HTTPS-only wording in Phase 1 & matching `normalizeGitLabHost` check in Phase 2)
- Unresolved contradictions: 0
