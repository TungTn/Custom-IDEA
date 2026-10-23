---
phase: 4
title: "Find in Files and Search Everywhere"
status: completed
effort: "2h"
priority: P2
dependencies: []
---

# Phase 4: Find in Files and Search Everywhere

## Overview
Nâng cấp Search Everywhere (`Double Shift`) và Find in Files (`Ctrl+Shift+F`) để tìm kiếm chuỗi văn bản (full-text search) và tìm kiếm tên file trên toàn bộ thư mục dự án thực tế trên đĩa, thay thế việc chỉ lọc qua danh sách tệp tin mẫu trong RAM.

## Requirements
- Tìm kiếm tệp tin (Tab Files): Tìm kiếm nhanh theo tên file/thư mục tương tự `Shift+Command+O` / `Double Shift`.
- Tìm kiếm toàn văn bản (Tab Text): Tìm kiếm chuỗi code trong tất cả các file của dự án, hỗ trợ phân biệt hoa/thường, nguyên từ (whole word), và file mask.
- Tự động bỏ qua các thư mục rác/build: `node_modules`, `target`, `.git`, `dist`.
- Điều hướng: Nhấn vào kết quả tìm kiếm sẽ mở tab file tương ứng và di chuyển con trỏ Monaco Editor đến chính xác dòng chứa kết quả.

## Architecture
- Backend Rust: Viết hàm quét đĩa nhanh hoặc tích hợp `ripgrep` (có sẵn trên máy) để đạt tốc độ tìm kiếm dưới 100ms cho dự án lớn.
- Trả về danh sách kết quả chứa đường dẫn tương đối, tên file, số dòng và đoạn text chứa kết quả.

## Related Code Files
- Modify: `src-tauri/src/lib.rs` (thêm `search_in_files`, `find_files_by_name`)
- Modify: `src/components/SearchEverywhereModal.tsx` (gọi backend search và hiển thị kết quả thời gian thực)
- Modify: `src/App.tsx` (xử lý sự kiện mở file và jump tới số dòng khi click vào kết quả)

## Implementation Steps
1. Thêm command `search_project_text(project_path: String, query: String, case_sensitive: bool)` trong Rust.
2. Thêm command `find_project_files(project_path: String, query: String)` trong Rust.
3. Trong `SearchEverywhereModal.tsx`, gắn debounce 250ms cho ô input tìm kiếm để gọi backend.
4. Render kết quả theo phong cách IntelliJ IDEA (hiển thị tên file bên trái, dòng code và số dòng bên phải).

## Success Criteria
- [x] Bấm Double Shift gõ tên bất kỳ file nào trong dự án đều xuất hiện ngay lập tức.
- [x] Tìm kiếm từ khóa mã nguồn bất kỳ (ví dụ `fetchMarketplace`) trả về danh sách các file và dòng tương ứng.
- [x] Nhấn Enter hoặc click kết quả mở đúng file và cuộn tới đúng dòng trong editor.

