---
phase: 2
title: Interactive Shell Terminal
status: completed
effort: 3.5h
priority: P1
dependencies:
  - 1
---

# Phase 2: Interactive Shell Terminal

## Overview
Kết nối XTerm.js với phiên làm việc thực sự của hệ điều hành Windows (`powershell.exe` hoặc `cmd.exe`) qua cơ chế bidirectional pipe/PTY, cho phép người dùng gõ lệnh, di chuyển con trỏ, tab-completion, xem output màu và chạy các tác vụ terminal ngay trong IDE.

## Requirements
- Khởi tạo phiên PowerShell tương tác với working directory mặc định là thư mục dự án đang mở.
- Hai chiều dữ liệu (bi-directional): phím gõ từ XTerm.js gửi xuống stdin của PowerShell, byte in ra từ stdout/stderr gửi ngược lại XTerm.js.
- Hỗ trợ phím đặc biệt: Mũi tên lên/xuống (lịch sử lệnh), Tab (gợi ý đường dẫn), Ctrl+C (ngắt lệnh), Ctrl+L (xóa màn hình).
- Tự động thay đổi kích thước (terminal resize / fit addon) khi người dùng co giãn thanh công cụ dưới.

## Architecture
- Backend Rust: Tạo child process `powershell.exe -NoLogo -NoExit` với pipes cho stdin và stdout.
- Một thread nền liên tục đọc luồng byte từ stdout và phát qua Tauri event `terminal-out`.
- Tauri command `terminal_send_input(data: String)` ghi trực tiếp vào stdin.

## Related Code Files
- Modify: `src-tauri/src/lib.rs` (quản lý phiên shell tương tác, stdin/stdout streams)
- Modify: `src/components/TerminalPanel.tsx` (gỡ bỏ các lệnh hardcode mock, gắn kết trực tiếp với Tauri event)

## Implementation Steps
1. Xây dựng struct quản lý terminal session trong Rust với `stdin: Arc<Mutex<ChildStdin>>`.
2. Tạo command `init_terminal_session(cwd: String)` khởi động PowerShell.
3. Tạo command `send_terminal_input(input: String)` gửi phím bấm.
4. Trong `TerminalPanel.tsx`, khi mount thì gọi `init_terminal_session`, lắng nghe dữ liệu trả về bằng `listen('terminal-out')` và ghi vào `term.write(data)`.
5. Đăng ký hàm `term.onData` gửi byte trực tiếp qua `send_terminal_input`.

## Success Criteria
- [ ] Gõ bất kỳ lệnh nào (`dir`, `git status`, `npm -v`, `cargo --version`) đều cho kết quả thật từ hệ thống.
- [ ] Tab tự động hoàn thành đường dẫn file và thư mục.
- [ ] Bấm `Ctrl+C` hủy được lệnh đang chạy trong terminal.
- [ ] Màu sắc hiển thị chuẩn xác (PowerShell blue/yellow/green prompts).

