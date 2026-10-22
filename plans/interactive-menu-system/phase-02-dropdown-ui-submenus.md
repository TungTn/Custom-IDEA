---
phase: 2
title: "Dropdown UI & Submenus"
status: pending
priority: P1
effort: "2.5h"
dependencies: ["phase-01-menu-schema-registry"]
---

# Phase 2: Dropdown UI & Submenus

## Overview
Xây dựng component hiển thị menu thả xuống (`MenuDropdown.tsx`) và menu con lồng nhau (`Submenu`), hỗ trợ bắt sự kiện click ra ngoài (Click Outside listener), rê chuột chuyển menu ngang mượt mà khi đang mở, và style chuẩn IntelliJ New UI.

## Requirements
- Giao diện chuẩn IntelliJ New UI: nền `#2B2D30`, viền `#4E5157`, bóng đổ `shadow-2xl`, bo tròn nhẹ (`rounded-md`).
- Mục menu khi hover đổi màu sang `#2E436E` (hoặc `#35373B`), văn bản màu trắng `#DFE1E5`, phím tắt hiển thị mờ ở cột phải (`#868A91`).
- Khi menu đang mở, rê chuột qua menu khác trên TopBar sẽ tự động chuyển menu ngay (không cần click lại).
- Hỗ trợ menu con (Submenu) mở sang phải khi rê chuột vào item có `children`.
- Tự động đóng menu khi nhấp chuột ra ngoài cửa sổ menu hoặc khi bấm phím `Escape`.

## Architecture
- `src/components/MenuDropdown.tsx`: Component đệm render danh sách `MenuItem`.
- Tích hợp trực tiếp vào `src/components/TopBar.tsx`.
- Hook `useClickOutside` hoặc event listener trên `document`.

## Related Code Files
- Create: `src/components/MenuDropdown.tsx`
- Modify: `src/components/TopBar.tsx`

## Implementation Steps
1. Xây dựng component `MenuDropdown`:
   - Nhận props: `items: MenuItem[]`, `onSelectAction: (actionId: string) => void`, `onClose: () => void`.
   - Render từng item: nếu `isSeparator` -> render đường kẻ ngang `<div className="h-[1px] bg-[#393B40] my-1" />`.
   - Nếu có `children` -> render icon `ChevronRight` và quản lý state mở submenu sang phải (`left-full top-0`).
2. Tích hợp vào `TopBar.tsx`:
   - Quản lý state `openMenu: string | null`.
   - Khi `openMenu !== null`, gắn sự kiện `onMouseEnter` vào các nút menu khác để chuyển dropdown tức thì.
   - Thêm listener bắt phím `Escape` và click outside để reset `openMenu = null`.

## Success Criteria
- [ ] Bấm vào bất kỳ menu nào trên TopBar (`File`, `Edit`, `View`...) sẽ thả menu xuống với đầy đủ items và phím tắt.
- [ ] Rê chuột sang menu lân cận khi đang mở sẽ chuyển menu tự nhiên như ứng dụng desktop chuẩn.
- [ ] Click ra ngoài hoặc bấm Escape menu tự đóng lại.
