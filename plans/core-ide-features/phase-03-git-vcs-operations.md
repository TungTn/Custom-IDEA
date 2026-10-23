---
phase: 3
title: Git VCS Operations
status: completed
effort: 2.5h
priority: P1
dependencies: []
---

# Phase 3: Git VCS Operations

## Overview
Kết nối các modal và menu Git (`Ctrl+K` Commit, `Ctrl+Shift+K` Push, Branch Switcher trên Status Bar) với Git CLI thật của hệ thống. Hiển thị danh sách file thay đổi thật, xem Diff thời gian thực và thực thi commit/push trực tiếp vào Git repository.

## Requirements
- Đọc trạng thái thay đổi: Danh sách file modified, untracked, deleted từ `git status --porcelain`.
- Xem nội dung Diff: Hiển thị các dòng thêm (xanh lá) và xóa (đỏ) của từng file qua `git diff`.
- Thực hiện Commit: Nhập commit message, chọn file và chạy `git commit`.
- Thực hiện Push: Đẩy commit lên remote repository (`git push`).
- Quản lý nhánh: Liệt kê các branch từ `git branch -a`, cho phép checkout hoặc tạo branch mới.

## Architecture
- Backend Rust: Tận dụng `git.exe` thông qua `std::process::Command` trong thư mục dự án `project_path`.
- Trả về JSON có cấu trúc cho frontend: danh sách file thay đổi, thông tin nhánh, mã lỗi chi tiết nếu merge conflict hoặc auth error.

## Related Code Files
- Modify: `src-tauri/src/lib.rs` (thêm `git_get_status`, `git_get_diff`, `git_commit`, `git_push`, `git_branches`, `git_checkout`)
- Modify: `src/components/GitCommitModal.tsx` (hiển thị danh sách file thật và live diff)
- Modify: `src/components/GitBranchesModal.tsx` (danh sách nhánh thật và checkout)
- Modify: `src/components/StatusBar.tsx` (hiển thị tên nhánh thực tế)

## Implementation Steps
1. Viết các hàm Rust wrapper cho Git trong `src-tauri/src/lib.rs`.
2. Trong `App.tsx`, tạo hàm `refreshGitStatus()` tự động tải trạng thái Git khi mở dự án hoặc sau khi lưu file.
3. Kết nối `GitCommitModal` với dữ liệu trả về từ `git_get_status` và gọi `git_commit` khi bấm Commit.
4. Kết nối `GitBranchesModal` với `git_branches` và `git_checkout`.

## Success Criteria
- [x] Chỉnh sửa file trong IDE, mở `Git Commit` (`Ctrl+K`) thấy đúng file bị sửa.
- [x] Click vào file xem được nội dung diff chi tiết.
- [x] Commit thành công, Git log ghi nhận commit mới.
- [x] Đổi nhánh trên status bar thành công, cây thư mục cập nhật theo nhánh mới.

