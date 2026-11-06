---
phase: 1
title: "Kịch Bản Đóng Gói, Dọn Dẹp & Tải Lên GitLab Package Registry"
status: pending
priority: P1
effort: "2.5h"
dependencies: []
---

# Phase 1: Kịch Bản Đóng Gói, Dọn Dẹp & Tải Lên GitLab Package Registry

## Overview
Xây dựng kịch bản đóng gói và xuất bản tự động `scripts/publish-update.cjs` tuân thủ 100% **Ba Thiết Luật** của MIC Studio: tự động dọn dẹp (Purge) toàn bộ tệp cũ và package cũ trên `gitlab.mic.vn`, chuẩn hóa tên tệp thành `custom-idea-latest.exe`, tính mã băm SHA-256 dạng stream, sinh file chỉ dẫn `version.json`, và upload lên GitLab Generic Package Registry độc lập dưới gói `latest`.

## Requirements
- **Functional:**
  - Viết script `scripts/publish-update.cjs` bằng **Node.js thuần** (chỉ sử dụng `https`, `crypto`, `fs`, `path`, `child_process`, không phụ thuộc external npm packages).
  - Đọc cấu hình từ `.env`:
    - `GITLAB_HOST=gitlab.mic.vn`
    - `GITLAB_PROJECT_ID=<project-id>`
    - `GITLAB_TOKEN=<token>`
    - `PACKAGE_NAME=custom-idea`
  - Đảm bảo tệp `.env` được khai báo trong `.gitignore`.
  - Tự động kiểm tra file thực thi sau build: `dist-portable/Custom-IDEA-Portable.exe` hoặc `release/custom-idea.exe`.
  - Chuẩn hóa tên file theo **Thiết luật 3**: copy sang `release/custom-idea-latest.exe`.
  - Triển khai hàm `purgeOldReleases(config)`:
    - Lấy danh sách package của dự án qua GitLab API.
    - Xóa các package phiên bản cũ khác `latest`.
    - Xóa sạch toàn bộ tệp tin hiện hữu trong package `latest`.
  - Tính mã băm SHA-256 dạng stream của file `.exe` phát hành.
  - Sinh tệp `version.json` chuẩn schema MIC Studio:
    - `version`: chuỗi SemVer nhận từ tham số CLI (ví dụ `1.0.1`).
    - `releaseDate`: thời điểm ISO 8601 UTC.
    - `notes`: changelog nhận từ tham số CLI.
    - `sha256`: chuỗi hex 64 ký tự của file `-latest.exe`.
    - `downloadUrl`: URL trực tiếp đến `custom-idea-latest.exe` trong package `latest`.
    - `size`: dung lượng bytes.
    - `forceUpdate`: boolean cờ bắt buộc cập nhật.
    - `requireSetup`: boolean (mặc định `false`, `true` khi có bộ cài Setup).
  - Tải cả 2 tệp (`custom-idea-latest.exe` và `version.json`) lên GitLab Generic Package Registry với cơ chế retry tối đa 3 lần.
  - Đăng ký script trong `package.json`: `"publish:update": "node scripts/publish-update.cjs"`.
- **Non-functional:**
  - Không làm phình to repository Git (Thiết luật 1).
  - Tốc độ xử lý nhanh, tối ưu RAM khi tính hash SHA-256 và streaming upload.

## Related Code Files
- Create: `scripts/publish-update.cjs`
- Create: `.env.example` (Template mẫu cấu hình biến môi trường GitLab)
- Modify: `.gitignore` (Đảm bảo `.env` và thư mục `release/` không bị commit vào Git)
- Modify: `package.json` (Thêm lệnh `publish:update`)

## Implementation Steps
1. **Thiết lập `.env.example` và `.gitignore`:**
   - Tạo `.env.example` chứa các biến mẫu `GITLAB_HOST`, `GITLAB_PROJECT_ID`, `GITLAB_TOKEN`, `PACKAGE_NAME`.
   - Kiểm tra và thêm `release/` cùng `.env` vào `.gitignore`.
2. **Hiện thực hóa `scripts/publish-update.cjs`:**
   - Triển khai hàm đọc `.env` thủ công.
   - Triển khai hàm tính toán SHA-256 bằng `crypto.createHash('sha256')`.
   - Triển khai các hàm gọi GitLab REST API v4 qua HTTPS:
     - `GET /api/v4/projects/:id/packages`
     - `DELETE /api/v4/projects/:id/packages/:package_id`
     - `GET /api/v4/projects/:id/packages/:package_id/package_files`
     - `DELETE /api/v4/projects/:id/packages/:package_id/package_files/:file_id`
     - `PUT /api/v4/projects/:id/packages/generic/:package_name/latest/:file_name`
3. **Tích hợp Pipeline:**
   - Thêm lệnh `"build:release"` và `"publish:update"` vào `package.json`.
4. **Kiểm thử script cục bộ:**
   - Chạy thử chế độ dry-run / kiểm tra tính hash và sinh `version.json`.

## Success Criteria
- [ ] Chạy `npm run publish:update 1.0.1 "Test release"` sinh đúng file `version.json` chuẩn schema MIC Studio.
- [ ] Tên file xuất bản luôn tuân thủ chuẩn `custom-idea-latest.exe` (không chứa version trong tên file).
- [ ] Cơ chế Purge dọn sạch tệp cũ trên GitLab API trước khi tải tệp mới.
- [ ] Tệp `.env` và thư mục `release/` được chặn trong `.gitignore`.

## Risk Assessment
- **Token không đủ quyền:** Cần thông báo lỗi rõ ràng hướng dẫn tạo Project Access Token với quyền Maintainer/Developer và scope `api`.
