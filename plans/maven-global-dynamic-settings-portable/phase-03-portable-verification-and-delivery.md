---
phase: 3
title: "Portable Verification & Distribution Package"
status: pending
priority: P2
effort: "1h"
dependencies: ["1", "2"]
---

# Phase 3: Portable Verification & Distribution Package

## Overview
Xác thực chất lượng toàn diện (Typecheck, Build Portable binary, Test import thực tế) và cập nhật tài liệu bàn giao cho đội Backend Java.

## Implementation Steps
1. Chạy `npx tsc --noEmit` xác nhận 0 lỗi.
2. Dọn dẹp tiến trình cũ và build `npm run build:portable`.
3. Kiểm tra tính toàn vẹn của file `dist-portable/Custom-IDEA-Portable.exe`.
4. Cập nhật `walkthrough.md` hướng dẫn sử dụng cấu hình Maven Global và Import Settings.

## Success Criteria
- [ ] TypeScript typecheck: 0 errors.
- [ ] Binary `Custom-IDEA-Portable.exe` sinh ra đầy đủ tính năng mới, sẵn sàng gửi cho BE Java.
