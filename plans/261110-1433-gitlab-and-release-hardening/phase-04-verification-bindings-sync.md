---
phase: 4
title: Verification & Bindings Sync
status: completed
priority: P1
effort: 30m
dependencies:
  - 1
  - 2
  - 3
---

# Phase 4: Verification & Bindings Sync

## Overview

Đồng bộ lại TypeScript bindings tự động từ Rust DTOs, chạy toàn bộ bộ kiểm thử Rust, TypeScript, Vite build, Node test cho release script, và rà soát lại toàn repo (bao gồm `src/`, `crates/`, `src-tauri/`, `scripts/`) để đảm bảo không còn `mic.vn`, không còn token trong `localStorage`, và mọi đường dẫn gọi đều khớp.

## Requirements

- **Functional:**
  - Sinh lại `src/bindings.ts` từ `export_bindings.rs` để đồng bộ `GitLabUserDto` và `GitLabProjectDto` (có `id: number` và `star_count: number | null`). [Red-Team #8]
  - Xác nhận tất cả 13 điểm từ `/ponytail-review` + 12 điểm tăng cường từ Red Team đã được giải quyết và kiểm chứng bằng lệnh thật.
- **Non-functional:**
  - Zero TypeScript errors, zero Rust compile errors, toàn bộ unit tests xanh 100%.

## Architecture

Quy trình kiểm thử khép kín sau khi hoàn tất Phase 1, 2, 3:
1. Sync bindings -> `pnpm gen:bindings`
2. Backend tests -> `cargo test -p ide-vcs`
3. Frontend build -> `pnpm build` (`tsc && vite build`)
4. Release script test -> `node --test scripts/publish-update.test.cjs`
5. Security grep sweep -> kiểm tra `mic.vn`, `danger_accept_invalid_certs(true)` không điều kiện, và `rejectUnauthorized: false` không điều kiện trên toàn `src/`, `crates/`, `src-tauri/`, `scripts/` [Red-Team #12]

## Related Code Files

- Generated: `src/bindings.ts`
- Verify: `crates/ide-vcs/src/commands.rs`, `src/features/git/VcsCloneModal.tsx`, `src/features/settings/panels/VersionControlPanel.tsx`, `src/services/gitlabService.ts`, `scripts/publish-update.cjs`

## Implementation Steps

1. Chạy `pnpm gen:bindings` (`cargo test -p app --test export_bindings`) để cập nhật `src/bindings.ts`.
2. Kiểm tra `src/bindings.ts` xem `GitLabUserDto` có `id: number` và `GitLabProjectDto` có `star_count: number | null`.
3. Kiểm tra `src/types/gitlab.ts` import đúng từ `../bindings` và `pnpm build` không phát sinh lỗi type.
4. Chạy `cargo test -p ide-vcs` và kiểm tra kết quả 100% pass.
5. Chạy `node --test scripts/publish-update.test.cjs` và kiểm tra 100% pass.
6. Chạy `git grep -in "mic\.vn" src/ crates/ src-tauri/ scripts/` để chắc chắn trả về 0 kết quả.
7. Chạy `cargo check --workspace` để đảm bảo toàn bộ Tauri app biên dịch sạch.

## Success Criteria

- [x] `pnpm gen:bindings` chạy thành công, `src/bindings.ts` có `GitLabUserDto` (`id: number`) và `GitLabProjectDto` (`star_count: number | null`).
- [x] `cargo test -p ide-vcs` pass 100%.
- [x] `node --test scripts/publish-update.test.cjs` pass 100%.
- [x] `pnpm build` (`tsc && vite build`) và `cargo check --workspace` thành công với exit code 0.
- [x] `git grep -in "mic\.vn" src/ crates/ src-tauri/ scripts/` trả về 0 kết quả.

## Risk Assessment

- **Rủi ro `export_bindings` ghi sai đường dẫn trên Windows:** Đảm bảo chạy từ `D:\IDE` qua `pnpm gen:bindings` (test chạy từ `src-tauri/` và ghi ra `../src/bindings.ts`).
