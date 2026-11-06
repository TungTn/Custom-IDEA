---
phase: 1
title: "Maven Global Configuration & Runner VM Options"
status: pending
priority: P1
effort: "2h"
dependencies: []
---

# Phase 1: Maven Global Configuration & Runner VM Options

## Overview
Xây dựng mô hình dữ liệu cấu hình Maven toàn cục và giao diện cấu hình chuẩn IntelliJ IDEA trong `Settings -> Build Tools -> Maven` & `Runner`, tự động chèn flags `-gs`, `-s`, `-Dmaven.repo.local` và `JAVA_HOME`.

## Requirements
- Functional:
  - Cho phép cấu hình Global settings file (`conf/settings.xml`), User settings file (`~/.m2/settings.xml`), Local repository (`~/.m2/repository`).
  - Cho phép cấu hình Runner VM Options (`-Xmx4096m -Dfile.encoding=UTF-8`).
  - Cho phép chọn Runner JRE / JDK phiên bản cụ thể (tự động inject vào `JAVA_HOME`).
  - Hỗ trợ checkbox Override độc lập cho từng mục giống IntelliJ IDEA.
- Non-functional:
  - Tự động bọc dấu ngoặc kép đường dẫn có chứa dấu cách.

## Related Code Files
- Modify: `src/features/settings/SettingsModal.tsx`
- Modify: `src/features/settings/panels/BuildExecutionPanel.tsx`
- Modify: `src/features/build/MavenPanel.tsx`
- Modify: `src/hooks/useProcessRunner.ts`

## Success Criteria
- [ ] Giao diện `Build Tools -> Maven` hiển thị đầy đủ các trường cấu hình.
- [ ] Các lệnh chạy Maven trong `MavenPanel` và `useProcessRunner` tự động thừa hưởng cờ `-gs`, `-s`, `-Dmaven.repo.local` và biến môi trường `JAVA_HOME`, `MAVEN_OPTS`.
