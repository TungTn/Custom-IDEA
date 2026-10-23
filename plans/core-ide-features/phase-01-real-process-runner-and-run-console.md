---
phase: 1
title: Real Process Runner and Run Console
status: completed
effort: 3h
priority: P1
dependencies: []
---

# Phase 1: Real Process Runner and Run Console

## Overview
Thay thế cơ chế giả lập `setTimeout` bằng luồng thực thi tiến trình thực tế trên hệ thống (Cargo, npm, node, python, shell command), truyền trực tiếp stdout/stderr theo thời gian thực (streaming) về IntelliJ Run Console với định dạng màu ANSI và khả năng ngắt tiến trình (Stop Process `Ctrl+F2`).

## Requirements
- Chạy được lệnh biên dịch / thực thi thật trong thư mục dự án đang mở (`cwd`).
- Luồng streaming thời gian thực: Khi tiến trình in ra console, giao diện Run Console nhận ngay lập tức, không chờ kết thúc mới in.
- Hỗ trợ dừng tiến trình: Khi người dùng bấm nút Stop đỏ (`Ctrl+F2`), tiến trình con được kết thúc dứt điểm.
- Hỗ trợ cấu hình Run Configuration: Chọn tên cấu hình, câu lệnh, tham số và thư mục làm việc.

## Architecture
- Backend Rust: Quản lý active processes qua `Arc<Mutex<HashMap<String, Child>>>`.
- Sử dụng background thread đọc `BufReader` từ `stdout` và `stderr` của `Child`, phát event Tauri `run-process-stdout` và `run-process-stderr`.
- Khi tiến trình kết thúc, phát event `run-process-exit` với `exit_code`.

## Related Code Files
- Modify: `src-tauri/src/lib.rs` (thêm `start_process`, `stop_process`)
- Modify: `src/App.tsx` (lắng nghe event stream, cập nhật `runLogs`)
- Modify: `src/components/RunConsolePanel.tsx` (hỗ trợ hiển thị ANSI colors và tự động scroll)
- Modify: `src/components/RunConfigModal.tsx` (chỉnh sửa cấu hình thực thi)

## Implementation Steps
1. Trong `src-tauri/src/lib.rs`, tạo struct `ProcessManager` lưu trữ các tiến trình đang chạy.
2. Thêm command `run_command_stream(app: AppHandle, id: String, cmd: String, args: Vec<String>, cwd: String)`.
3. Thêm command `stop_command_process(id: String)`.
4. Trong `src/App.tsx`, thay thế nội dung hàm `handleRun` để gọi `run_command_stream` với dự án đang mở.
5. Cập nhật `RunConsolePanel.tsx` để render ANSI sequences chuẩn giao diện console IntelliJ IDEA.

## Success Criteria
- [ ] Bấm Run (`Shift+F10`) thực sự chạy câu lệnh (ví dụ `cargo check` hoặc `npm run build`).
- [ ] Log in ra từng dòng theo thời gian thực trong panel `Run`.
- [ ] Bấm nút Stop (`Ctrl+F2`) hủy tiến trình ngay lập tức.
- [ ] Trả về đúng exit code (0 khi thành công, mã lỗi khi thất bại).

