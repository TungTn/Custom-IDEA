---
phase: 1
title: "Menu Schema & Registry"
status: pending
priority: P1
effort: "1.5h"
dependencies: []
---

# Phase 1: Menu Schema & Registry

## Overview
Xác định kiểu dữ liệu (TypeScript Interfaces) cho hệ thống menu IntelliJ và xây dựng toàn bộ cơ sở dữ liệu menu tĩnh (Menu Registry) bao gồm 11 menu chính: `File`, `Edit`, `View`, `Navigate`, `Code`, `Refactor`, `Build`, `Run`, `Tools`, `Git`, `Help`.

## Requirements
- Hỗ trợ các thuộc tính menu: `id`, `label`, `shortcut` (ví dụ `Ctrl+S`, `Shift+F10`), `icon`, `disabled`, `isSeparator`, `children` (submenu).
- Định nghĩa rõ danh mục hành động (actionId) để Phase 3 dễ dàng liên kết với hàm thực thi.

## Architecture
Tạo file `src/types/menu.ts` và `src/constants/menuRegistry.ts`:
- `MenuItem`: Định nghĩa một mục trong menu hoặc phân cách divider.
- `MenuCategory`: Danh mục menu trên top bar.
- `menuRegistry`: Danh sách hoàn chỉnh ánh xạ từng menu name sang danh sách menu items tương ứng theo chuẩn JetBrains.

## Related Code Files
- Create: `src/types/menu.ts`
- Create: `src/constants/menuRegistry.ts`

## Implementation Steps
1. Định nghĩa `MenuItem` interface:
   ```typescript
   export interface MenuItem {
     id: string;
     label?: string;
     shortcut?: string;
     icon?: React.ComponentType<{ size?: number; className?: string }>;
     disabled?: boolean;
     isSeparator?: boolean;
     children?: MenuItem[];
     actionId?: string;
   }
   ```
2. Khai báo danh mục chi tiết cho từng menu:
   - **File:** New File, New Folder, Open File..., Separator, Save, Save All, Separator, Close Tab, Close All, Separator, Exit.
   - **Edit:** Undo, Redo, Cut, Copy, Paste, Find..., Find in Files..., Replace...
   - **View:** Tool Windows (Project, Run, Terminal, Problems), Appearance (Toggle Full Screen, Toggle Status Bar).
   - **Navigate:** Search Everywhere (Double Shift), Go to File..., Go to Line...
   - **Code:** Format Code (Ctrl+Alt+L), Inspect Code, Optimize Imports.
   - **Build:** Build Project (Ctrl+F9), Rebuild Project, Clean.
   - **Run:** Run 'Desktop IDE' (Shift+F10), Debug, Stop (Ctrl+F2).
   - **Tools:** Terminal (Alt+F12), Task Manager.
   - **Git:** Commit (Ctrl+K), Push (Ctrl+Shift+K), Pull, Branch...
   - **Help:** Documentation, Keyboard Shortcuts, About IntelliJ IDEA Clone.

## Success Criteria
- [ ] File `src/types/menu.ts` chứa đầy đủ schema và type an toàn.
- [ ] File `src/constants/menuRegistry.ts` cung cấp đầy đủ dữ liệu menu cho cả 11 menu mục.
- [ ] TypeScript biên dịch không có lỗi type.
