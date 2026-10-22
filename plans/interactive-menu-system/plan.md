---
title: "Interactive IntelliJ Menu System"
description: "Thiết kế và triển khai toàn bộ hệ thống menu xổ xuống (Dropdown Menu) và menu con (Submenu) chuẩn phong cách JetBrains IntelliJ IDEA New UI, kết nối phím tắt toàn cục và kích hoạt các hành động thực tế của IDE."
status: completed
priority: P1
branch: "main"
tags: [ui, menu, intellij, shortcuts, actions]
blockedBy: []
blocks: []
created: "2026-10-22T03:33:22.134Z"
createdBy: "ck-cli"
source: skill
---

# Interactive IntelliJ Menu System

## Overview

Hiện tại trên thanh `TopBar.tsx`, các mục menu (`File`, `Edit`, `View`, `Navigate`, `Code`, `Refactor`, `Build`, `Run`, `Tools`, `Git`, `Help`) chỉ là các nhãn văn bản có hiệu ứng hover đổi màu nhưng chưa có menu dropdown thực sự. 

Kế hoạch này cung cấp giải pháp toàn diện để xây dựng hệ thống menu đa tầng chuẩn phong cách JetBrains IntelliJ IDEA New UI:
- **Cấu trúc dữ liệu Menu Registry phân cấp:** Hỗ trợ item thường, checkbox/toggle, divider ngăn cách, submenu cấp 2, shortcut gợi ý và icon.
- **Giao diện Menu Dropdown & Submenu:** Thiết kế tối màu đặc trưng (`#2B2D30`, viền `#4E5157`), hỗ trợ hover chuyển menu ngang, click ra ngoài đóng menu (Click Outside), và phím tắt điều hướng bàn phím.
- **Hệ thống Toast Notification Balloon:** Thông báo nhỏ góc dưới màn hình khi thực hiện các hành vi như `Save All`, `Format Code`, `Rebuild`.
- **Liên kết hành động (Action Handlers) theo cơ chế chuẩn IntelliJ:**
  * Cơ chế lưu như IntelliJ: Bấm `Ctrl+S` hoặc `File > Save` sẽ tự động đồng bộ buffer, xóa trạng thái dirty và xuất toast thông báo (không popup phiền phức).
  * `File > New File`: Bật modal tạo file nhanh và thêm vào cây thư mục + mở tab.
  * `File > Close Active Tab (Ctrl+W)` / `Close All Tabs`: Quản lý tabs.
  * `Edit > Format Code (Ctrl+Alt+L)`: Tự động format code trong Monaco.
  * `View > Toggle Left Sidebar (Alt+1)`: Ẩn/hiện panel cây thư mục.
  * `View > Toggle Bottom Tool Window (Alt+4 / Alt+F12)`: Ẩn/hiện panel Run / Terminal.
  * `Build > Rebuild Project (Ctrl+F9)`: Chạy build project và xuất log ra Console.
  * `Run > Run 'Desktop IDE' (Shift+F10)`: Kích hoạt nút Run.
  * `Tools > Open Terminal (Alt+F12)`: Chuyển thẳng vào Terminal nhúng.
  * `Help > About IntelliJ IDEA Clone`: Hiển thị modal thông tin phiên bản chuẩn JetBrains.

---

## Phases

| Phase | Name | Priority | Effort | Status |
|-------|------|----------|--------|--------|
| 1 | [Menu Schema & Registry](./phase-01-menu-schema-registry.md) | P1 | 1.5h | Completed |
| 2 | [Dropdown UI & Submenus](./phase-02-dropdown-ui-submenus.md) | P1 | 2.5h | Completed |
| 3 | [Connect Actions & Shortcuts](./phase-03-connect-actions-shortcuts.md) | P1 | 2h | Completed |

---

## Architecture & Data Flow

```
[ TopBar Navigation Bar ]
       │
       ├── Hover / Click Menu Title (e.g. "File")
       │         │
       │         ▼
       └── [ MenuDropdown Component ]
                 │
                 ├── Menu Item (Label, Shortcut, Icon) ──> onClick() ──> [ IDE Action Dispatcher ]
                 ├── Separator Divider                                          │
                 └── Submenu Item (ChevronRight)                                ├── Project Tree (New file)
                           │                                                    ├── Monaco Editor (Save/Format/Close)
                           ▼                                                    ├── Bottom Panel (Toggle Terminal/Run)
                     [ Submenu Dropdown ]                                       ├── Toast Notification Balloon
                                                                                └── Global Modals (Search / About)
```

---

## Validation Log

### Session 1 - 2026-10-22
- **Q1: Cơ chế lưu/mở file của Menu File:**
  * Xác nhận mô phỏng cơ chế Virtual File System (VFS) của IntelliJ: `Ctrl+S` tự động flush buffer, xóa trạng thái dirty, thông báo Toast góc dưới mà không bật popup làm gián đoạn người dùng.
- **Q2: Phím tắt bàn phím (Shortcuts):**
  * Xác nhận: Đăng ký toàn bộ phím tắt toàn cục (`Ctrl+S`, `Ctrl+W`, `Ctrl+Alt+L`, `Alt+1`, `Alt+F12`, `Shift+F10`, `Ctrl+F9`).
- **Q3: Phạm vi menu:**
  * Xác nhận: Triển khai đầy đủ cả 11 menu chuẩn JetBrains IntelliJ. Các action trọng tâm hoạt động thực tế, các action phụ phát thông báo Toast.
- **Q4: Thông báo Notification Balloon:**
  * Xác nhận: Tích hợp Toast Balloon góc dưới phải màn hình chuẩn giao diện thông báo của JetBrains.

### Whole-Plan Consistency Sweep
- Đã đồng bộ các quyết định thẩm định vào Phase 1, Phase 2, Phase 3.
- Không còn mâu thuẫn hay giả định chưa được kiểm chứng. Kế hoạch sẵn sàng chuyển sang giai đoạn thực thi.
