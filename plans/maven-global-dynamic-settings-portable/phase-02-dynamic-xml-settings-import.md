---
phase: 2
title: "Dynamic XML Settings Importer (Fix Islands Dark)"
status: completed
priority: P1
effort: "2h"
dependencies: []
---

# Phase 2: Dynamic XML Settings Importer (Fix Islands Dark)

## Overview
Xóa bỏ hoàn toàn hardcode trong bộ import cấu hình XML. Nhận diện chuẩn xác theme "Islands Dark" / "Islands Darcula" của New UI sang `intellij-new-ui-dark`, tự động đọc động font, code styles, keymaps, và JDK từ file `settings.zip`.

## Requirements
- Functional:
  - Khi `laf.xml` / `colors.scheme.xml` chứa `Islands Dark` hoặc `Islands Darcula`: áp dụng `intellij-new-ui-dark`.
  - Đọc động toàn bộ cặp `option` trong `editor.xml`, `editor-font.xml`.
  - Tự động nạp profile `nampa.xml` từ thư mục `keymaps/` và kích hoạt.
  - Tự động phân tích `jdk.table.xml`, trích xuất JDKs thực tế (`graalvm-jdk-21`), giải mã `$USER_HOME$`.
  - Tự động trích xuất cấu hình Maven Wrapper từ `options/windows/maven.wrapper.mapping.xml`.

## Related Code Files
- Modify: `src/services/intellijSettingsService.ts`
- Modify: `src/features/settings/ImportSettingsModal.tsx`
- Modify: `src/App.tsx`

## Success Criteria
- [x] Chạy kiểm thử parse với file `C:\Users\adminlocal\Downloads\settings.zip` trả về đúng theme New UI Dark, không bị ngả sang màu nâu cam `darcula-classic`.
- [x] Profile phím tắt `nampa` và JDK `graalvm-jdk-21` được nạp đầy đủ.
