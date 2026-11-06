---
phase: 3
title: "Giao Diện JetBrains Update Modal, Progress Stream & Force Update"
status: pending
priority: P1
effort: "2.5h"
dependencies: [2]
---

# Phase 3: Giao Diện JetBrains Update Modal, Progress Stream & Force Update

## Overview
Thiết kế và xây dựng giao diện Modal cập nhật phần mềm chuẩn JetBrains New UI & Darcula (`src/features/update/UpdateModal.tsx`), tích hợp hook quản lý trạng thái tự động (`useAutoUpdate.ts`), bộ xem trước Release Notes định dạng Markdown có thể cuộn, thanh tiến trình tải xuống chi tiết (MB, %, tốc độ), và cơ chế khóa cứng giao diện khi kích hoạt chế độ bắt buộc cập nhật (`forceUpdate: true`).

## Requirements
- **Functional:**
  - **Component `UpdateModal.tsx`:**
    - Tông màu JetBrains Darcula: nền `#2B2D30`, viền `#43454A`, điểm nhấn `#3574F0`.
    - 6 trạng thái giao diện:
      1. `checking`: Spinner động, text *"Checking for updates from gitlab.mic.vn..."*.
      2. `upToDate`: Biểu tượng tích xanh, text *"You have the latest version of Custom IDEA (v1.0.0)"*, *"Last checked: Today at 15:30"*.
      3. `available`:
         - Tiêu đề: *"New Version Available: Custom IDEA v1.0.1"*.
         - Thông tin phát hành: Ngày phát hành, dung lượng tệp (`15.4 MB`).
         - Khung xem trước Release Notes (Markdown format): hiển thị các gạch đầu dòng tính năng mới, sửa lỗi, có thanh cuộn tinh tế.
         - Nút hành động:
           - Nút chính: *"Update and Restart"* (màu xanh JetBrains `#3574F0`).
           - Nút phụ: *"Download in Background"*.
           - Nút hoãn: *"Remind Me Later"*, *"Ignore This Version"*.
      4. `downloading`:
         - Thanh progress bar đôi thể hiện % và dung lượng thực tế (ví dụ: `8.2 MB / 15.4 MB - 53%`).
         - Hiển thị tốc độ tải ước tính (`MB/s`).
         - Nút *"Cancel"*.
      5. `readyRestart`:
         - Thông báo: *"Update downloaded and verified with SHA-256 successfully. Restart Custom IDEA to apply changes"*.
         - Nút *"Restart Now"* và *"Restart Later"*.
      6. `error`:
         - Cảnh báo lỗi tải hoặc sai mã băm `SHA-256 Hash Mismatch`.
         - Nút *"Retry"* và link tải thủ công trực tiếp từ GitLab.
  - **Chế độ Bắt Buộc Cập Nhật (`forceUpdate: true`):**
    - Khi metadata có `forceUpdate: true`:
      - Ẩn toàn bộ nút đóng `X`, nút *"Remind Me Later"*, nút *"Ignore This Version"*.
      - Chặn sự kiện click outside / ESC để thoát modal.
      - Hiển thị badge đỏ: `🔴 Mandatory Update - Please update to continue using Custom IDEA`.
  - **Hook `useAutoUpdate.ts`:**
    - Tự động kiểm tra silent khi khởi động ứng dụng dựa trên cấu hình người dùng.
    - Không làm phiền nếu không có bản mới.
    - Nếu có bản mới: hiển thị Toast thông báo ở góc màn hình + gắn badge thông báo (chấm xanh) trên TopBar.
    - Quản lý phiên bản đã bấm bỏ qua (`ignoredVersions`).
- **Non-functional:**
  - Z-index cao nhất (`z-[60]`), hiển thị rõ ràng trên mọi cửa sổ khác của IDE.

## Architecture
```
[App Startup / TopBar Menu]
            │
            ▼
    [useAutoUpdate Hook]
            │ (checkUpdate)
            ▼
    [GitLab Package Registry: version.json?t=...]
            │
      ┌─────┴─────────────────────┐
      ▼                           ▼
[Up-to-Date]              [New Version Found]
                                  │
                   ┌──────────────┴──────────────┐
                   ▼                             ▼
         [forceUpdate = false]         [forceUpdate = true]
         - Show Toast & Badge          - Open Modal immediately
         - User can postpone           - Lock screen, hide close
                   │                             │
                   └──────────────┬──────────────┘
                                  ▼
                         [<UpdateModal />]
                           ├── Markdown Notes Viewer
                           ├── Download Progress Bar
                           ├── SHA-256 Hash Verifier
                           └── Trigger Atomic Swapper
```

## Related Code Files
- Create: `src/features/update/UpdateModal.tsx`
- Create: `src/features/update/useAutoUpdate.ts`
- Create: `src/features/update/index.ts`
- Modify: `src/App.tsx` (Mount `<UpdateModal />` ở cấp root và kích hoạt `useAutoUpdate`)

## Implementation Steps
1. **Dựng component `UpdateModal.tsx`:**
   - Tạo các view tương ứng với 6 state.
   - Thêm bộ hiển thị Markdown nhẹ nhàng cho release notes.
   - Áp dụng logic khóa màn hình khi `metadata?.forceUpdate === true`.
2. **Xây dựng hook `useAutoUpdate.ts`:**
   - Gọi `updaterService.checkUpdate()` khi app mount.
   - Lưu trữ state: `isChecking`, `updateInfo`, `downloadProgress`, `error`.
   - Kết nối hàm tải và kích hoạt restart.
3. **Mount tại `App.tsx`:**
   - Render modal ở tầng ngoài cùng của ứng dụng.

## Success Criteria
- [ ] Giao diện modal đạt chuẩn New UI JetBrains Darcula với font chữ và màu sắc sắc nét.
- [ ] Khi metadata có `forceUpdate: true`, modal không thể bị đóng hoặc bỏ qua.
- [ ] Thanh progress bar chạy mượt mà từ 0% đến 100% khi tải file vá.
- [ ] Release notes hiển thị chuẩn định dạng danh sách và tiêu đề.

## Risk Assessment
- **Lỗi hiển thị Markdown phức tạp:** Bộ parser Markdown chỉ cần hỗ trợ các cú pháp cơ bản (tiêu đề, bullet points, bold, code block), tránh import thư viện nặng làm phình bundle frontend.
