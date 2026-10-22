---
phase: 3
title: "Connect Actions & Shortcuts"
status: pending
priority: P1
effort: "2h"
dependencies: ["phase-02-dropdown-ui-submenus"]
---

# Phase 3: Connect Actions & Shortcuts

<!-- Updated: Validation Session 1 - Thêm Toast Notification Balloon và cơ chế VFS save của IntelliJ -->

## Overview
Liên kết tất cả các hành động (`actionId`) từ hệ thống menu vào logic nghiệp vụ và state của IDE trong `App.tsx`, đồng thời tạo dialog **About IntelliJ IDEA Clone**, tích hợp hệ thống **Toast Notification Balloon** ở góc dưới phải và lắng nghe phím tắt toàn cục (Global Keyboard Shortcuts).

## Requirements
- Khi click vào bất kỳ item nào trong menu, IDE phải thực thi đúng hành động:
  * `file.new`: Bật modal nhập tên file, tự động thêm vào cây thư mục và mở tab mới sẵn sàng soạn thảo.
  * `file.save` (`Ctrl+S`): Lưu buffer, xóa trạng thái dirty (`isDirty: false`) và hiển thị Toast "All files saved" theo đúng phong cách IntelliJ.
  * `file.close` (`Ctrl+W`): Đóng tab hiện tại.
  * `code.format` (`Ctrl+Alt+L`): Format code trong Monaco Editor và xuất Toast "Code formatted".
  * `view.toggleProject` (`Alt+1`): Ẩn / hiện cây thư mục bên trái.
  * `view.toggleRun` (`Alt+4`): Mở tab Run Console ở panel dưới.
  * `view.toggleTerminal` (`Alt+F12`): Mở tab Terminal ở panel dưới.
  * `navigate.searchEverywhere`: Mở modal Search Everywhere (Double Shift).
  * `build.rebuild` (`Ctrl+F9`): Kích hoạt quy trình build & run console.
  * `run.run` (`Shift+F10`): Kích hoạt lệnh chạy ứng dụng.
  * `help.about`: Mở modal giới thiệu phiên bản IntelliJ IDEA Clone.
- Tạo component `ToastContainer.tsx`: Hiển thị thông báo dạng bong bóng (balloon) ở góc dưới phải màn hình với icon thông báo, tự động ẩn sau 3 giây.
- Đăng ký listener phím tắt toàn cục (`keydown`) trên `window` cho các phím tắt phổ biến (`Ctrl+S`, `Ctrl+W`, `Ctrl+Alt+L`, `Alt+1`, `Alt+F12`, `Ctrl+F9`, `Shift+F10`).

## Architecture
- `src/components/AboutModal.tsx`: Hộp thoại About phong cách JetBrains (Logo, phiên bản, Build runtime, thông tin hệ thống).
- `src/components/ToastContainer.tsx`: Hộp thoại Toast notification balloon.
- `src/components/NewFileModal.tsx`: Hộp thoại tạo file mới nhanh chóng.
- `handleMenuAction(actionId: string)` trong `App.tsx`: Bộ điều phối hành động tập trung.

## Related Code Files
- Create: `src/components/AboutModal.tsx`
- Create: `src/components/ToastContainer.tsx`
- Create: `src/components/NewFileModal.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/TopBar.tsx`

## Success Criteria
- [ ] Bấm `File > Save` hoặc ấn `Ctrl+S` file được lưu và hiện Toast "All files saved".
- [ ] Bấm `File > New File` mở modal tạo file, sau khi nhập tên file sẽ xuất hiện trên Project Tree và mở tab.
- [ ] Bấm `View > Tool Windows > Terminal` panel Terminal lập tức mở ra.
- [ ] Bấm `Build > Rebuild Project` hoặc `Run > Run` console build chạy và xuất log.
- [ ] Bấm `Help > About` modal thông tin ứng dụng hiển thị đẹp mắt.
