---
phase: 4
title: "Tích Hợp System Settings, Menu TopBar & Kiểm Thử E2E Cục Bộ"
status: pending
priority: P2
effort: "2h"
dependencies: [1, 2, 3]
---

# Phase 4: Tích Hợp System Settings, Menu TopBar & Kiểm Thử E2E Cục Bộ

## Overview
Hoàn thiện toàn bộ các điểm chạm giao diện người dùng (User Touchpoints): kích hoạt panel cấu hình `Settings -> Appearance & Behavior -> System Settings -> Updates` (`UpdatesSettingsPanel.tsx`), gắn huy hiệu cập nhật cạnh icon Settings và menu `Help -> Check for Updates...` trên `TopBar.tsx`, cùng script kiểm thử End-to-End (E2E) cục bộ giả lập máy chủ `gitlab.mic.vn` để nghiệm thu tính năng hoàn chỉnh mà không cần phụ thuộc vào mạng thật.

## Requirements
- **Functional:**
  - **Cấu hình `System Settings -> Updates`:**
    - Hiện thực hóa panel `src/features/settings/panels/UpdatesSettingsPanel.tsx` (tương ứng với ID `system-updates` trong `SETTINGS_TREE`).
    - Tùy chọn tần suất tự động kiểm tra:
      - `On Every Startup` (Mỗi lần khởi động)
      - `Daily` (Mỗi ngày một lần - mặc định)
      - `Weekly` (Mỗi tuần một lần)
      - `Never` (Tắt tự động kiểm tra)
    - Tùy chọn `Auto-download updates in background` (Tự động tải ngầm khi có bản mới).
    - Bảng thông tin hệ thống chuẩn JetBrains:
      - Tên ứng dụng & phiên bản: `Custom IDEA v1.0.0`
      - Máy chủ cập nhật: `gitlab.mic.vn (Package Registry)`
      - Package ID: `custom-idea (Generic: latest)`
      - Thời điểm kiểm tra gần nhất: `Just now` / `Today at 15:30`
    - Nút bấm `Check Now...`: kích hoạt mở `UpdateModal` để kiểm tra phiên bản mới ngay lập tức.
    - Quản lý danh sách các phiên bản đã bấm bỏ qua (`Ignored Versions`) kèm nút khôi phục `Reset Ignored Versions`.
  - **Tích hợp Menu & TopBar:**
    - Kết nối hành động `help.checkUpdates` trong `src/hooks/useMenuDispatcher.ts` mở `UpdateModal`.
    - Kết nối mục `Check for Updates...` trong popup menu bánh răng của `src/workbench/TopBar.tsx`.
    - Gắn chấm xanh thông báo (Update Badge) cạnh icon bánh răng Settings trên `TopBar.tsx` khi có bản mới đang chờ.
  - **Bộ kịch bản kiểm thử E2E cục bộ (`scripts/mock-update-server.mjs`):**
    - Chạy server HTTP local nhẹ tại cổng `http://localhost:3344`.
    - Phục vụ endpoint `/version.json` giả lập phiên bản mới (ví dụ `1.0.1`) kèm mã băm SHA-256 chính xác của file `.exe` test.
    - Phục vụ endpoint download `/custom-idea-latest.exe`.
    - Cho phép kiểm tra toàn diện chu trình 4 bước: Kiểm tra -> Xem Changelog -> Tải có % -> Đối chiếu SHA-256 -> Sinh `update.bat` và hoán đổi file.
- **Non-functional:**
  - Cấu hình lưu trữ an toàn trong `localStorage` và tự động đồng bộ khi export/import settings.

## Related Code Files
- Create: `src/features/settings/panels/UpdatesSettingsPanel.tsx`
- Create: `scripts/mock-update-server.mjs` (Local mock server phục vụ kiểm thử)
- Modify: `src/features/settings/panels/AppearanceBehaviorPanel.tsx` (Route `selectedId === 'system-updates'`)
- Modify: `src/features/settings/panels/index.ts` (Export `UpdatesSettingsPanel`)
- Modify: `src/features/settings/SettingsModal.tsx` (Mở rộng state `autoUpdateInterval`, `autoDownloadUpdates`)
- Modify: `src/hooks/useMenuDispatcher.ts` (Trigger mở modal khi chọn `help.checkUpdates`)
- Modify: `src/workbench/TopBar.tsx` (Update badge indicator & menu trigger)

## Implementation Steps
1. **Tạo `UpdatesSettingsPanel.tsx`:**
   - Dựng layout chuẩn JetBrains với các controls tần suất và nút `Check Now...`.
   - Kết nối vào `AppearanceBehaviorPanel.tsx` khi `selectedId === 'system-updates'`.
2. **Liên kết TopBar & Menu Dispatcher:**
   - Trong `useMenuDispatcher.ts`, xử lý case `help.checkUpdates`.
   - Trong `TopBar.tsx`, thêm badge hiển thị khi `hasUpdateAvailable === true`.
3. **Xây dựng `scripts/mock-update-server.mjs`:**
   - Viết server nodejs giả lập endpoint metadata GitLab và file download.
   - Thử nghiệm các trường hợp: (1) Đã ở bản mới nhất, (2) Có bản mới thường, (3) Bản mới bắt buộc `forceUpdate: true`, (4) Sai mã băm SHA-256.
4. **Kiểm thử nghiệm thu toàn diện (End-to-End Validation):**
   - Chạy mock server và xác nhận toàn bộ quy trình hoạt động trơn tru.

## Success Criteria
- [ ] Mở `Settings -> Appearance & Behavior -> System Settings -> Updates` hiển thị đầy đủ giao diện cấu hình và nút `Check Now...`.
- [ ] Bấm `Help -> Check for Updates...` từ thanh menu TopBar mở ngay `UpdateModal`.
- [ ] TopBar hiển thị badge thông báo khi có bản cập nhật mới trong nền.
- [ ] Chạy kịch bản `mock-update-server.mjs`, client tải và xác thực SHA-256 thành công.

## Risk Assessment
- **Cấu hình nhầm endpoint trong môi trường dev:** Sử dụng biến môi trường hoặc fallback thông minh để khi dev có thể trỏ về mock server cục bộ, khi release thì trỏ về `gitlab.mic.vn`.
