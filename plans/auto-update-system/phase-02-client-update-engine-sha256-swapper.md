---
phase: 2
title: "Client Update Engine: Metadata Check, SHA-256 & Atomic Swapper"
status: pending
priority: P1
effort: "3h"
dependencies: [1]
---

# Phase 2: Client Update Engine: Metadata Check, SHA-256 & Atomic Swapper

## Overview
Xây dựng module xử lý cập nhật cốt lõi (Client Update Engine) kết hợp giữa Frontend TypeScript (`updaterService.ts`) và Backend Rust (`src-tauri/src/updater.rs`): gửi yêu cầu kiểm tra phiên bản kèm timestamp chống cache, tải bản vá nhị phân kèm streaming progress, tính toán và xác thực mã băm SHA-256 nguyên vẹn, sinh kịch bản `.bat` tự hủy trong `%TEMP%`, đóng an toàn các tiến trình con và thực hiện hoán đổi file `.exe` nguyên tử (Atomic Swapper) trên Windows.

## Requirements
- **Functional:**
  - **Kiểm tra phiên bản (`checkUpdate`):**
    - Gọi GET tới `https://gitlab.mic.vn/api/v4/projects/:projectId/packages/generic/:packageName/latest/version.json?t=${Date.now()}`.
    - So sánh SemVer giữa `remoteVersion` và `currentVersion`.
    - Trích xuất metadata: `version`, `releaseDate`, `notes`, `sha256`, `downloadUrl`, `size`, `forceUpdate`, `requireSetup`.
  - **Tải bản vá có tiến trình (`downloadUpdateWithProgress`):**
    - Đọc stream chunks từ Fetch response.
    - Tính toán chính xác phần trăm tiến độ `%` và dung lượng đã tải (`receivedBytes` / `totalBytes`).
    - Lưu dữ liệu nhị phân tải về vào tệp tạm `%TEMP%\custom-idea-updates\custom-idea-latest.exe`.
  - **Xác thực tính toàn vẹn SHA-256 (`verifySha256`):**
    - Sử dụng `crypto.subtle.digest('SHA-256', buffer)` hoặc Rust backend SHA-256 hasher.
    - Đối chiếu mã băm tính được với trường `sha256` trong metadata.
    - Nếu sai lệch: hủy bỏ ngay lập tức, xóa tệp tạm, trả lỗi `Sha256Mismatch`.
  - **Kịch bản hoán đổi tệp tự hủy (`applyUpdateAndRestart`):**
    - Lấy đường dẫn thực thi của ứng dụng hiện tại (`std::env::current_exe()`).
    - Lấy Process ID (PID) hiện tại (`std::process::id()`).
    - Tạo tệp kịch bản `%TEMP%\update_<timestamp>.bat`:
      ```cmd
      @echo off
      timeout /t 1 /nobreak > nul
      :wait_exit
      tasklist /FI "PID eq %1" 2>NUL | find /I "%1" >NUL
      if not errorlevel 1 (
          timeout /t 1 /nobreak > nul
          goto wait_exit
      )
      move /y "%~2" "%~3"
      start "" "%~3"
      del /f /q "%~f0"
      ```
    - Thực thi script ngầm qua `cmd.exe /c start "" "%TEMP%\update_xxx.bat" <PID> <TempExePath> <TargetExePath>`.
    - Gọi dọn dẹp hệ thống `cleanup_ide_subsystems()` (đóng PTY, LSP, DAP, Runner).
    - Thoát ứng dụng an toàn với mã `0`.
- **Non-functional:**
  - Hoạt động ổn định trên mọi phiên bản Windows 10/11.
  - Không để lại tệp rác trong `%TEMP%` sau khi hoàn tất.

## Related Code Files
- Create: `src/services/updaterService.ts` (Client update service cho TypeScript)
- Create: `src-tauri/src/updater.rs` (Rust backend atomic swapper, process cleanup & launcher)
- Modify: `src-tauri/src/lib.rs` (Đăng ký hàm `cleanup_ide_subsystems()`)
- Modify: `src-tauri/src/commands.rs` (Đăng ký IPC command: `apply_update_and_restart`, `get_app_version_info`)
- Create: `src/types/updater.ts` (TypeScript interfaces cho `VersionMetadata`, `UpdateProgress`)

## Implementation Steps
1. **Định nghĩa kiểu dữ liệu `src/types/updater.ts`:**
   - Khai báo interface `VersionMetadata` chuẩn theo schema MIC Studio.
   - Khai báo interface `UpdateProgressPayload`.
2. **Xây dựng `src/services/updaterService.ts`:**
   - Hàm so sánh SemVer `isNewerVersion(currentVer, remoteVer)`.
   - Hàm `checkUpdate(currentVer)`.
   - Hàm `downloadUpdateWithProgress(url, totalBytes, onProgress)`.
   - Hàm `verifySha256(buffer, expectedHash)`.
3. **Xây dựng Backend Rust Swapper (`src-tauri/src/updater.rs`):**
   - Viết hàm `apply_update_and_restart(new_exe_bytes: Vec<u8>)`:
     - Ghi bytes vào thư mục temp.
     - Sinh script batch tự hủy.
     - Kích hoạt batch và gọi `cleanup_ide_subsystems()`.
     - `std::process::exit(0)`.
4. **Đăng ký IPC Commands trong `commands.rs`:**
   - Export lệnh sang frontend và test gọi IPC.

## Success Criteria
- [ ] Hàm `checkUpdate` gọi API GitLab thành công kèm timestamp chống cache.
- [ ] Hàm `verifySha256` phát hiện chính xác khi hash khớp và chặn đứng khi hash sai.
- [ ] Kịch bản `.bat` hoán đổi file `.exe` thành công mà không bị lỗi Windows File Lock.
- [ ] Các tiến trình PTY và LSP được giải phóng sạch sẽ trước khi app khởi động lại.

## Risk Assessment
- **Quyền ghi thư mục cài đặt (UAC/Permissions):** Nếu app cài trong `C:\Program Files`, script `.bat` cần quyền Administrator. Với bản Portable (mặc định), người dùng có toàn quyền ghi trong thư mục chứa file `.exe`.
