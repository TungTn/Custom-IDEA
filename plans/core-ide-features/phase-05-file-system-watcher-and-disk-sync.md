---
phase: 5
title: "File System Watcher and Disk Sync"
status: completed
effort: "2h"
priority: P2
dependencies: []
---

# Phase 5: File System Watcher and Disk Sync

## Overview
Cài đặt cơ chế tự động theo dõi cây thư mục của dự án đang mở (File System Watcher) bằng crate `notify` trong Rust, phát hiện ngay lập tức các sự kiện tạo file, xóa file, đổi tên hoặc sửa file từ bên ngoài IDE và tự động làm mới cây thư mục `ProjectTree` cũng như cảnh báo/reload tab đang mở.

## Requirements
- Tự động bắt đầu theo dõi khi người dùng mở hoặc chuyển đổi dự án.
- Bỏ qua các sự kiện rác trong `.git`, `node_modules`, `target`, `dist` để không tốn CPU/RAM.
- Khi có file mới tạo hoặc xóa, tự động cập nhật cây thư mục `ProjectTree` thời gian thực mà không làm mất trạng thái đóng/mở của các thư mục.
- Nếu file đang mở trong editor bị sửa đổi ở ứng dụng khác, tự động đồng bộ nội dung mới vào Monaco editor nếu tab chưa dirty.

## Architecture
- Backend Rust: Tích hợp crate `notify` (sử dụng ReadDirectoryChangesW native trên Windows) trong một thread nền.
- Gửi event Tauri `fs-event` `{ kind: 'create'|'modify'|'remove', path: String }` lên frontend với debounce 200ms.

## Related Code Files
- Modify: `src-tauri/Cargo.toml` (thêm dependency `notify = "6.1.1"`)
- Modify: `src-tauri/src/lib.rs` (thêm file watcher service và commands `watch_directory`, `unwatch_directory`)
- Modify: `src/App.tsx` (lắng nghe event `fs-event` và refresh file tree)

## Implementation Steps
1. Thêm `notify` vào `src-tauri/Cargo.toml`.
2. Tạo module `watcher` trong Rust khởi động watcher theo đường dẫn dự án.
3. Trong `App.tsx`, khi `currentProjectPath` thay đổi, gọi `watch_directory(path)`.
4. Lắng nghe `fs-event` và kích hoạt hàm tải lại cây thư mục ngầm.

## Success Criteria
- [x] Tạo file mới từ Explorer bên ngoài hoặc qua terminal, file xuất hiện ngay trong cây thư mục của IDE.
- [x] Xóa file bên ngoài, file lập tức biến mất khỏi cây thư mục.
- [x] Không gây giật lag hay treo CPU khi có build output.

