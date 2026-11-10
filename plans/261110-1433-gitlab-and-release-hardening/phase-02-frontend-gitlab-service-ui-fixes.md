---
phase: 2
title: Frontend GitLab Service & UI Fixes
status: completed
priority: P1
effort: 2.5h
dependencies:
  - 1
---

# Phase 2: Frontend GitLab Service & UI Fixes

## Overview

Cập nhật lớp service và giao diện GitLab trong `src/types/gitlab.ts`, `src/services/gitlabService.ts`, `VersionControlPanel.tsx` và `VcsCloneModal.tsx`: chuyển sang migrate token bất đồng bộ an toàn trước khi dùng, đồng bộ toàn bộ chữ ký `async` tại các điểm gọi, tái sử dụng `id` khi cập nhật cùng server tránh mồ côi token trong keyring, thêm `"Allow self-signed SSL"`, khử sạch `gitlab.mic.vn`, chống race khi tìm kiếm & đổi tài khoản, và giữ thư mục cha an toàn qua repo slug từ `path_with_namespace`.

## Requirements

- **Functional:**
  - `src/types/gitlab.ts`: re-export `GitLabUserDto as GitLabUser` và `GitLabProjectDto as GitLabProject` từ `../bindings`; `GitLabAccount` bỏ field `token` và thêm `allowSelfSigned?: boolean`. [Red-Team #8]
  - `gitlabService.ts`:
    - `getGitLabAccounts()` đọc thuần túy (pure read), KHÔNG gọi ngầm IPC hay tự xóa `token`. [Red-Team #1]
    - Bổ sung `async migrateLegacyGitLabTokens(): Promise<GitLabAccount[]>` chạy tuần tự (`await`) từng account còn sót `token` trong `localStorage`: gọi `await invoke('gitlab_save_token', { accountId: acc.id, host: normHost, token: acc.token })`; CHỈ xóa `token` khỏi `localStorage` cho account nào ghi keyring thành công (giữ nguyên nếu chạy ngoài Tauri hoặc keyring lỗi để tránh mất trắng token). [Red-Team #1]
    - `saveGitLabAccount(account, token)` và `removeGitLabAccount(id)` đều là `async Promise<GitLabAccount[]>`. Khi `saveGitLabAccount` thấy host chuẩn hóa trùng với tài khoản cũ có `id` khác, **tái sử dụng `id` cũ** (hoặc `await invoke('gitlab_delete_token', { accountId: oldId })` trước khi ghi đè) để không bao giờ bỏ quên token mồ côi trong Windows Credential Manager. [Red-Team #2, #6]
    - `testGitLabConnection(host, token, allowSelfSigned = false)` và `fetchGitLabProjects(host, accountId, allowSelfSigned = false, search?, page?, perPage?)` khớp 100% với chữ ký Rust ở Phase 1. [Red-Team #9]
  - `VersionControlPanel.tsx` & `VcsCloneModal.tsx`:
    - `await` `migrateLegacyGitLabTokens()` khi mount / mở modal trước khi gọi `fetchGitLabProjects`. [Red-Team #1]
    - `await saveGitLabAccount(...)` và `await removeGitLabAccount(...)` tại mọi điểm gọi (`VersionControlPanel.tsx:67, 82`, `VcsCloneModal.tsx:132`), cập nhật `VcsCloneModal.tsx:105` và `L123-135` theo chữ ký mới. [Red-Team #2]
    - Thêm checkbox `"Allow self-signed SSL"` trong Settings, Tab 2 Quick Login, và cả Tab 1 `Repository URL` của `VcsCloneModal.tsx`. [Red-Team #7]
    - Gỡ sạch toàn bộ `gitlab.mic.vn` sang `https://gitlab.example.com` / `https://gitlab.com`.
    - Hủy `searchDebounceRef` khi đổi tài khoản, đổi tab, hoặc đóng modal; kiểm tra `reqId === requestSeqRef.current` trong cả `try`/`catch` lẫn `finally`. [Red-Team #10]
    - Giữ thư mục cha bằng `baseParentDir` (chỉ cập nhật khi user bấm Browse), extract slug sạch từ `proj.path_with_namespace` (thay vì `proj.name`), và áp dụng chung cho cả `handleSelectProject` lẫn `handleUrlChange` (kèm `setSelectedProject(null)` trong `handleUrlChange`). [Red-Team #7, #11]

## Architecture

### Safe URL, Slug & Base Parent Helpers
```ts
export function normalizeGitLabHost(host: string): string {
  const trimmed = host.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^http:\/\//i.test(trimmed)) {
    throw new Error('HTTPS is required for GitLab authentication.');
  }
  return /^https:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function getGitLabHostname(host: string): string {
  try {
    const withScheme = /^https?:\/\//i.test(host.trim()) ? host.trim() : `https://${host.trim()}`;
    return new URL(withScheme).hostname;
  } catch {
    return host.trim() || 'gitlab';
  }
}

export function sanitizeRepoFolderName(pathWithNamespaceOrName: string): string {
  const slug = (pathWithNamespaceOrName.split('/').pop() || 'repo')
    .replace(/\.git$/i, '')
    .replace(/\.\./g, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .trim();
  return slug || 'repo';
}
```

### Luồng Async An Toàn Khi Mở Modal / Đổi Tài Khoản
1. Modal mở (`isOpen === true`): chạy `await migrateLegacyGitLabTokens()` (nếu có legacy token trong `localStorage`), sau đó mới set `accounts` & `selectedAccount` (cờ `isMigratedRef` đảm bảo không chạy `loadProjects` trước khi migration hoàn tất).
2. Khi đổi account / tab / đóng modal: `clearTimeout(searchDebounceRef.current)`, tăng `requestSeqRef.current` để hủy mọi response đang bay, reset `selectedProject`, `url`, `searchQuery`.
3. Trong `loadProjects`: tăng `const reqId = ++requestSeqRef.current`; bên trong `try`/`catch`/`finally`, chỉ cập nhật state (`setProjects`, `setProjectError`, `setIsLoadingProjects(false)`) khi `reqId === requestSeqRef.current`.

## Related Code Files

- Modify: `src/types/gitlab.ts`
- Modify: `src/services/gitlabService.ts`
- Modify: `src/features/settings/panels/VersionControlPanel.tsx`
- Modify: `src/features/git/VcsCloneModal.tsx`

## Implementation Steps

1. **Cập nhật `src/types/gitlab.ts` (Red-Team #8):**
   - Re-export `GitLabUserDto as GitLabUser`, `GitLabProjectDto as GitLabProject` từ `../bindings`.
   - Sửa `GitLabAccount`: xóa `token: string;`, thêm `allowSelfSigned?: boolean;`.
   - Kiểm tra toàn repo bằng `tsc` xem có caller/mock nào tạo object `GitLabUser`/`GitLabProject` thiếu các field `| null` bắt buộc từ `ts-rs` không (hiện tại chỉ có `VersionControlPanel.tsx` và `VcsCloneModal.tsx` đọc từ backend).
2. **Nâng cấp `src/services/gitlabService.ts` (Red-Team #1, #2, #6, #9):**
   - Thêm `normalizeGitLabHost`, `getGitLabHostname`, `isTauriRuntime()`.
   - `getGitLabAccounts()`: đọc `localStorage`, giữ nguyên trả về đồng bộ cho render khởi tạo mà không sửa `localStorage`.
   - `async migrateLegacyGitLabTokens()`: duyệt các account còn field `token` (legacy type), nếu trong Tauri thì gọi `await invoke('gitlab_save_token', { accountId, host: normalizeGitLabHost(host), token })`, sau đó xóa field `token` khỏi các phần tử đã lưu thành công rồi mới ghi lại `localStorage`.
   - `async saveGitLabAccount(account: Omit<GitLabAccount, 'id'> & { id?: string }, token: string)`: chuẩn hóa `host`, nếu tìm thấy account cũ trùng `normalizeGitLabHost(a.host)` thì tái sử dụng `id` cũ (`targetId`), gọi `await invoke('gitlab_save_token', { accountId: targetId, host: normHost, token })` trước rồi mới lưu metadata vào `localStorage` (kèm rollback `gitlab_delete_token` nếu tạo mới mà `localStorage.setItem` lỗi).
   - `async removeGitLabAccount(id: string)`: trong Tauri gọi `await invoke('gitlab_delete_token', { accountId: id })`, sau đó xóa khỏi `localStorage`.
   - `testGitLabConnection(host, token, allowSelfSigned = false)` -> `invoke('gitlab_test_connection', { host: normalizeGitLabHost(host), token: token.trim(), allowSelfSigned })`.
   - `fetchGitLabProjects(host, accountId, allowSelfSigned = false, search?, page?, perPage?)` -> `invoke('gitlab_list_projects', { host: normalizeGitLabHost(host), accountId, allowSelfSigned, search, page, perPage })`.
3. **Cập nhật `src/features/settings/panels/VersionControlPanel.tsx` (Red-Team #1, #2, #3, #5):**
   - Trong `useEffect` on mount: gọi `migrateLegacyGitLabTokens().then(setGitlabAccounts)`.
   - Sửa text/placeholder `L286, 292, 324`: bỏ `gitlab.mic.vn`, dùng `https://gitlab.example.com` / `https://gitlab.com`.
   - Thêm `glAllowSelfSigned` state + checkbox `"Allow self-signed SSL certificate (internal servers)"` trong form Add Account; hiển thị badge `Self-signed SSL` cạnh host nếu bật.
   - Đổi `handleAddGitLabAccount` truyền `glAllowSelfSigned` vào `testGitLabConnection`, `await saveGitLabAccount({ host, user, createdAt, lastVerifiedAt, allowSelfSigned: glAllowSelfSigned }, glToken.trim())`.
   - Đổi `handleRemoveGitLabAccount` thành `async` và `await removeGitLabAccount(id)` với `try/catch` thông báo toast nếu lỗi.
4. **Cập nhật `src/features/git/VcsCloneModal.tsx` (Red-Team #1, #2, #3, #6, #7, #10, #11):**
   - Sửa `quickHost` default (`L71`) và placeholders (`L310, 373`) thành `https://gitlab.example.com` / `https://github.com/user/repo.git`.
   - Dùng `getGitLabHostname(acc.host)` tại `L432`.
   - Thêm `urlAllowSelfSigned` (cho Tab 1) và `quickAllowSelfSigned` (cho Tab 2 quick login).
   - Trong `useEffect([isOpen])`: reset states, chạy `await migrateLegacyGitLabTokens()`, khởi tạo `baseParentDir` = `getBaseDir()`.
   - Sửa `handleBrowseDirectory`: `const picked` -> set `baseParentDir = picked`, nếu đang có `selectedProject` hoặc URL slug thì đặt `directory = "${picked}\\${slug}"`, ngược lại `setDirectory(picked)`.
   - Sửa `handleSelectProject(proj)` và `handleUrlChange(newUrl)`: dùng `baseParentDir || getBaseDir()` + `sanitizeRepoFolderName(...)` (từ `proj.path_with_namespace` hoặc URL path); trong `handleUrlChange` gọi thêm `setSelectedProject(null)`.
   - Sửa `handleQuickAddAccount`: truyền `quickAllowSelfSigned` vào `testGitLabConnection`, gọi `await saveGitLabAccount(...)` đúng chữ ký mới.
   - Sửa `loadProjects` (`L101-113`): gọi `fetchGitLabProjects(account.host, account.id, Boolean(account.allowSelfSigned), search)`; bảo vệ `setProjects`, `setProjectError`, VÀ `setIsLoadingProjects(false)` bằng `if (reqId === requestSeqRef.current)`.
   - Sửa account selector `onChange` (`L421-427`) & tab switch: `clearTimeout(searchDebounceRef.current)`, tăng `requestSeqRef.current`, reset `selectedProject`, `url`, `errorMessage`, `searchQuery`.
   - Sửa search `<input>` `onChange` (`L443-448`): debounce 250ms trước khi gọi `loadProjects` (lấy `selectedAccount` hiện tại từ ref/state qua `useEffect` hoặc cancel khi đổi account).
   - Sửa `handleClone` (`L215-218`): truyền `accountId: (activeTab === 'gitlab' && cloneProtocol === 'https' && selectedAccount) ? selectedAccount.id : null` và `allowSelfSigned: activeTab === 'gitlab' ? Boolean(selectedAccount?.allowSelfSigned) : urlAllowSelfSigned`.

## Success Criteria

- [x] `tsc` pass 100% ở tất cả callers (`VersionControlPanel.tsx`, `VcsCloneModal.tsx`, `gitlabService.ts`).
- [x] Không còn `token` trong `localStorage` sau migration; legacy accounts migrate an toàn không bị mất token hay race.
- [x] Đăng nhập với `gitlab.com` (không có `https://`) không crash dropdown `VcsCloneModal`.
- [x] Không còn `gitlab.mic.vn` trong `src/`.
- [x] Debounce search 250ms hủy timer khi đổi tài khoản; spinner `finally` kiểm tra `reqId`.
- [x] Browse folder trước khi chọn repo hoặc dán URL đều giữ đúng thư mục cha và tạo folder slug an toàn từ `path_with_namespace`.

## Risk Assessment

- **Rủi ro tài khoản trùng với URL từ Tab 1:** Khi người dùng dán URL của GitLab private vào Tab 1 (`Repository URL`) mà không dùng Tab 2 (`GitLab`), `accountId` là `null` nên chỉ hỗ trợ `urlAllowSelfSigned` hoặc Git Credential Manager hệ thống (đúng kỳ vọng phân tách giữa URL thủ công và tài khoản GitLab).
