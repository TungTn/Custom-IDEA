---
phase: 3
title: Release Script Hardening & Cleanup
status: completed
priority: P1
effort: 1h
dependencies: []
---

# Phase 3: Release Script Hardening & Cleanup

## Overview

Dọn sạch 2 hàm chết (`getPackageFiles`, `deletePackageFile`) và chuỗi nội bộ `GITLAB.MIC.VN` trong `scripts/publish-update.cjs`; bật kiểm tra chứng chỉ TLS mặc định (`rejectUnauthorized: true`, chỉ tắt khi có biến môi trường opt-in cho dev); sửa `getGitLabPackages` & `deletePackage` để phát hiện và chặn upload trùng asset khi API xóa bị từ chối (`403 Forbidden`); và bổ sung unit test Node cho các nhánh lỗi.

## Requirements

- **Functional:**
  - Xóa `getPackageFiles` (`L88-111`) và `deletePackageFile` (`L114-132`) khỏi `scripts/publish-update.cjs`.
  - Xóa/thay thế toàn bộ chuỗi `GITLAB.MIC.VN` (`L3, L349, L457`) thành `GitLab Package Registry` / `${config.host}`. [Red-Team #12]
  - Bỏ `rejectUnauthorized: false` cứng tại `L70, L143, L195`: mặc định bật TLS verification (`rejectUnauthorized: !config.allowSelfSignedTls`), chỉ tắt khi set `ALLOW_SELF_SIGNED_TLS=true` hoặc truyền CA qua `NODE_EXTRA_CA_CERTS`. [Red-Team #5]
  - Sửa `getGitLabPackages(config, httpClient = https)`: trả về `{ ok: true, packages }` nếu 2xx, và `{ ok: false, statusCode, message }` khi HTTP `>= 300` hoặc lỗi mạng (không nuốt lỗi thành `[]` như cũ). [Red-Team #5]
  - Sửa `deletePackage(config, packageId, version, httpClient = https)`: đọc hết response, trả `{ ok: true, statusCode }` cho `2xx` / `404`, và `{ ok: false, statusCode, message }` cho lỗi khác (`403`, `5xx`, network error).
  - Sửa `purgeOldReleases(config, httpClient = https)`: trả `{ ok: boolean, reason?: string }`; nếu `getGitLabPackages` lỗi hoặc có package xóa thất bại (`403`), **dừng quy trình phát hành** (`process.exit(1)`) trừ khi người dùng truyền rõ cờ `--allow-dirty-registry` (tránh upload đè tạo asset trùng lặp làm lệch SHA-256). [Red-Team #5]
  - Xuất `{ getGitLabPackages, deletePackage, purgeOldReleases }` khi `require.main !== module` và thêm `scripts/publish-update.test.cjs` test đầy đủ các case `204`, `403`, `getGitLabPackages` lỗi 401/network, và hành vi abort của `purgeOldReleases`. [Red-Team #5]
- **Non-functional:**
  - Chỉ dùng Node built-in modules (`node:test`, `node:assert/strict`, `https`).

## Architecture

```
purgeOldReleases(config, httpClient = https)
  ├── getGitLabPackages(config, httpClient)
  │     ├── !ok -> return { ok: false, reason: "list_failed", statusCode, message }
  │     └── ok  -> existingPackages
  └── for each pkg:
        deletePackage(config, pkg.id, pkg.version, httpClient)
          ├── 2xx / 404 -> { ok: true }
          └── 403 / err -> { ok: false, statusCode, message }
  └── Summary:
        ├── failed.length > 0 -> warn clearly (403 -> cần quyền Maintainer), return { ok: false }
        └── failed.length === 0 -> log [OK], return { ok: true }

main():
  if (!purgeResult.ok && !hasFlag('--allow-dirty-registry')) -> throw / exit(1)
```

## Related Code Files

- Modify: `scripts/publish-update.cjs`
- Create: `scripts/publish-update.test.cjs`

## Implementation Steps

1. **Dọn dead code & tên miền nội bộ trong `scripts/publish-update.cjs` (Red-Team #12):**
   - Xóa `getPackageFiles` và `deletePackageFile`.
   - Đổi `GITLAB.MIC.VN` tại `L3, L349, L457` thành `GitLab Package Registry` hoặc `${config.host}`.
   - Trong `loadEnv()`: thêm `allowSelfSignedTls: env.ALLOW_SELF_SIGNED_TLS === 'true'`.
2. **Bật TLS verification mặc định & sửa `getGitLabPackages`, `deletePackage`, `purgeOldReleases` (Red-Team #5):**
   - Dùng `rejectUnauthorized: !config.allowSelfSignedTls` ở cả `getGitLabPackages`, `deletePackage`, và `uploadFileToGitLab`.
   - `getGitLabPackages(config, httpClient = https)`: gom response data, kiểm tra `res.statusCode >= 200 && res.statusCode < 300`, trả `{ ok: true, packages }` hoặc `{ ok: false, statusCode: res.statusCode, message: data }`.
   - `deletePackage(config, packageId, version, httpClient = https)`: trả `{ ok: true, statusCode }` nếu 2xx hoặc 404, ngược lại `{ ok: false, statusCode, message: data }`.
   - `purgeOldReleases(config, httpClient = https)`: nhận `httpClient` và truyền xuyên suốt vào `getGitLabPackages` lẫn `deletePackage`; nếu thất bại trả `{ ok: false, ... }` thay vì in `[OK]`.
   - Tại `main()`: kiểm tra kết quả `purgeOldReleases`, nếu `ok === false` và không có `--allow-dirty-registry`, in lỗi hướng dẫn nâng quyền Maintainer (hoặc dùng `--allow-dirty-registry`) và `process.exit(1)`.
3. **Export module & viết unit test:**
   - Guard entrypoint bằng `if (require.main === module) { main(); }` và export `{ getGitLabPackages, deletePackage, purgeOldReleases }`.
   - Tạo `scripts/publish-update.test.cjs` test bằng mock `httpClient` (EventEmitter giả lập request/response):
     1. `deletePackage` nhận `204` -> `{ ok: true }`.
     2. `deletePackage` nhận `403` `{"message":"403 Forbidden"}` -> `{ ok: false, statusCode: 403 }`.
     3. `getGitLabPackages` nhận `401`/`500` -> `{ ok: false, statusCode }` (không trả `[]` im lặng).
     4. `purgeOldReleases` khi `deletePackage` gặp `403` -> trả `{ ok: false }` và không in `[OK]`.

## Success Criteria

- [x] Không còn `getPackageFiles`, `deletePackageFile`, `GITLAB.MIC.VN`, hay `rejectUnauthorized: false` mặc định trong `scripts/publish-update.cjs`.
- [x] Gặp `401`/`403` khi list hoặc delete package trả `ok: false` và dừng upload trừ khi truyền `--allow-dirty-registry`.
- [x] `node --test scripts/publish-update.test.cjs` pass 100%.

## Risk Assessment

- **Rủi ro máy build chạy GitLab nội bộ dùng chứng chỉ tự ký:** Người phát hành cần cài CA nội bộ vào OS / `NODE_EXTRA_CA_CERTS`, hoặc đặt `ALLOW_SELF_SIGNED_TLS=true` trong `.env` cục bộ (nằm ngoài Git). Vì vậy cần ghi chú rõ trong log lỗi TLS nếu xảy ra.
