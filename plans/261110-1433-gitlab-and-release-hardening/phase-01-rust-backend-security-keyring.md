---
phase: 1
title: Rust Backend Security & Keyring
status: completed
priority: P1
effort: 2.5h
dependencies: []
---

# Phase 1: Rust Backend Security & Keyring

## Overview

Bảo mật lưu trữ GitLab Token vào OS Credential Manager (`keyring`) gắn chặt theo `(account_id, normalized_origin)`, bật kiểm tra chứng chỉ **TLS gốc của hệ điều hành (`rustls-tls-native-roots`)** mặc định kèm cờ `allow_self_signed` theo từng host, sửa `git_clone` hỗ trợ private HTTPS repo an toàn (chống command/protocol injection, chặn prompt treo, redact auth header), gom HTTP client dùng chung, đồng bộ `ts-rs`, và thêm unit test cho `crates/ide-vcs`.

## Requirements

- **Functional:**
  - Lưu/đọc/xóa secret GitLab dạng JSON `{ "host": "<https://origin>", "token": "<PAT>" }` theo `account_id` trong OS keyring (`service = "custom-idea-gitlab"`) qua `gitlab_save_token(account_id, host, token)` và `gitlab_delete_token(account_id)`. [Red-Team #3]
  - `gitlab_test_connection(host, token, allow_self_signed)` chuẩn hóa URL (bắt buộc `https://` trừ khi cho phép rõ), kiểm tra kết nối qua TLS chuẩn mặc định. [Red-Team #3, #4]
  - `gitlab_list_projects(host, account_id, allow_self_signed, search, page, per_page)` đọc `{ host, token }` từ keyring theo `account_id`, xác minh `normalize_gitlab_base_url(&host)` khớp `record.host`, fail-fast nếu thiếu credential hoặc mismatch origin. [Red-Team #3, #9]
  - `git_clone(url, target_dir, account_id, allow_self_signed)`:
    - Kiểm tra `url` an toàn: từ chối nếu bắt đầu bằng `-`, chứa khoảng trắng đầu/cuối nguy hiểm, hoặc dùng protocol nguy hiểm (`ext::`, `file://`); luôn chèn `"--"` trước `url` và `target_dir`. [Red-Team #3]
    - Dùng `validate_git_executable()` / `get_git_executable()` (từ chối đường dẫn tương đối đáng ngờ nếu `CUSTOM_GIT_PATH` không phải binary hợp lệ). [Red-Team #7]
    - Nếu `account_id` là `Some(id)`: fail-fast nếu `load_gitlab_secret(&id)` lỗi; chỉ cấp token khi `url` là `https://` và origin trùng khớp `record.host` (cấm tuyệt đối gửi PAT qua `http://` chữ trần). [Red-Team #3, #7]
    - Đặt `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, dọn sạch biến kế thừa `GIT_CONFIG_*`, `GIT_TRACE*`, `GIT_CURL_VERBOSE` trước khi truyền `GIT_CONFIG_COUNT` với key scoped `http.<origin>.extraHeader` và `http.<origin>.sslVerify=false` (chỉ khi `allow_self_signed == Some(true)`). [Red-Team #7]
    - Redact mọi chuỗi `Authorization: Basic ...` khỏi `stderr`/`stdout` trước khi trả `Err` lên frontend. [Red-Team #7]
  - Đồng bộ `GitLabUserDto` và `GitLabProjectDto` qua `src-tauri/tests/export_bindings.rs` với `#[ts(type = "number | null")]` cho `star_count: Option<i64>`. [Red-Team #8]
- **Non-functional:**
  - Bật `rustls-tls-native-roots` trong `Cargo.toml` để chứng chỉ Enterprise Root CA trên Windows Store hoạt động chuẩn mà không cần tắt TLS. [Red-Team #4]
  - Hỗ trợ `keyring` đa nền tảng qua `#[cfg]` / features (`windows-native`, `apple-native`, `sync-secret-service`). [Red-Team #12]
  - Tái sử dụng 2 static `LazyLock<reqwest::Client>` (verified với native roots & opt-in self-signed).

## Architecture

```
Frontend (React)
  ├── Migrate legacy (Phase 2 chạy async trước khi dùng):
  │     invoke("gitlab_save_token", { accountId, host, token }) -> Keyring JSON { host, token }
  ├── Test connect:
  │     invoke("gitlab_test_connection", { host, token, allowSelfSigned })
  ├── Load projects:
  │     invoke("gitlab_list_projects", { host, accountId, allowSelfSigned, search, page, perPage })
  │       └─ Rust load secret(accountId) -> check origin(host) == secret.host -> gitlab_get(...)
  └── Clone repo:
        invoke("git_clone", { url, targetDir, accountId, allowSelfSigned })
          └─ Guard: url không bắt đầu '-', không ext::/file://
             Nếu có accountId: fail-fast nếu thiếu secret; ép url phải là https:// cùng origin với secret.host
             env_remove: GIT_CONFIG_*, GIT_TRACE*, GIT_CURL_VERBOSE
             env: GIT_TERMINAL_PROMPT=0, GCM_INTERACTIVE=never, GIT_CONFIG_COUNT=...
             args: ["clone", "--", &url, &target_dir]
```

## Related Code Files

- Modify: `Cargo.toml` (`reqwest` thêm `rustls-tls-native-roots`; thêm `keyring` đa nền tảng)
- Modify: `crates/ide-vcs/Cargo.toml` (thêm `keyring.workspace = true`)
- Modify: `crates/ide-vcs/src/commands.rs`
- Modify: `src-tauri/src/commands.rs` (đăng ký `gitlab_save_token`, `gitlab_delete_token`)
- Modify: `src-tauri/tests/export_bindings.rs` (thêm `GitLabUserDto`, `GitLabProjectDto`)

## Implementation Steps

1. **Cập nhật `Cargo.toml` & `crates/ide-vcs/Cargo.toml` (Red-Team #4, #12):**
   - Tại `Cargo.toml:44`: đổi `features = ["rustls-tls", "json", "stream"]` thành `features = ["rustls-tls-native-roots", "json", "stream"]`.
   - Thêm `keyring = { version = "3.6", features = ["windows-native", "apple-native", "sync-secret-service"] }` vào `[workspace.dependencies]` và `crates/ide-vcs/Cargo.toml`.
2. **Tạo Keyring helpers bound theo host & Tauri commands trong `crates/ide-vcs/src/commands.rs` (Red-Team #3, #6):**
   - `const GITLAB_KEYRING_SERVICE: &str = "custom-idea-gitlab";`
   - Struct nội bộ `#[derive(Serialize, Deserialize)] struct StoredGitLabSecret { host: String, token: String }`.
   - `save_gitlab_secret(account_id, host, token)`, `load_gitlab_secret(account_id) -> Result<StoredGitLabSecret, String>`, `delete_gitlab_secret(account_id)`.
   - `#[tauri::command] pub fn gitlab_save_token(account_id: String, host: String, token: String) -> Result<(), String>` (chuẩn hóa `host` bằng `normalize_gitlab_base_url` trước khi lưu).
   - `#[tauri::command] pub fn gitlab_delete_token(account_id: String) -> Result<(), String>` (coi `keyring::Error::NoEntry` là `Ok(())`).
   - Đăng ký 2 commands vào `src-tauri/src/commands.rs`.
3. **Chuẩn hóa URL, HTTP Client & `gitlab_get<T>` (Red-Team #3, #4, #9):**
   - Cập nhật `normalize_gitlab_base_url(host: &str) -> Result<String, String>`: từ chối chuỗi rỗng, trả `Err("HTTPS is required for GitLab authentication")` nếu người dùng nhập `http://` hoặc scheme khác `https://`, và tự động thêm `https://` khi thiếu scheme.
   - Tạo `GITLAB_CLIENT_VERIFIED` (`danger_accept_invalid_certs(false)`) và `GITLAB_CLIENT_INSECURE` (`danger_accept_invalid_certs(true)`).
   - Viết `async fn gitlab_get<T: DeserializeOwned>(...) -> Result<T, String>`.
   - Signature duy nhất cho `gitlab_list_projects(host: String, account_id: String, allow_self_signed: Option<bool>, search: Option<String>, page: Option<u32>, per_page: Option<u32>)`: đọc `StoredGitLabSecret` từ keyring, verify `extract_origin(&norm_host) == extract_origin(&secret.host)`.
4. **Hardening `git_clone` (Red-Team #3, #7):**
   - Signature: `pub fn git_clone(url: String, target_dir: String, account_id: Option<String>, allow_self_signed: Option<bool>) -> Result<String, String>`.
   - Viết `validate_clone_url(url: &str) -> Result<(), String>`: cấm bắt đầu bằng `-`, cấm `ext::`, cấm `file://`.
   - Viết `extract_http_origin(url: &str) -> Option<(String, String)>` trả `(scheme, origin)` như `("https", "https://gitlab.example.com")`.
   - Khi `account_id` là `Some(id)`: bắt buộc `load_gitlab_secret(&id)` thành công (fail-fast nếu lỗi), kiểm tra `extract_http_origin(&url)` phải là `https` và khớp `extract_http_origin(&secret.host)` trước khi tạo header `Authorization: Basic <base64("oauth2:" + token)>`.
   - Viết tiny Base64 encoder (~20 dòng) + `build_git_clone_config_env(url, token_opt, allow_self_signed)` dùng key scoped `http.<origin>.extraHeader` và `http.<origin>.sslVerify=false`.
   - Khi build `Command`: dùng `get_git_executable()` (verify executable exists/valid nếu là custom path), xóa toàn bộ biến `GIT_CONFIG_*` (0..10 hoặc scan `std::env::vars()`), `GIT_TRACE`, `GIT_TRACE_CURL`, `GIT_CURL_VERBOSE`, set `GIT_TERMINAL_PROMPT=0` và `GCM_INTERACTIVE=never`, gọi `.args(["clone", "--", url.trim(), target_dir.trim()])`.
   - Viết `redact_secrets(text: &str) -> String` che mọi `Authorization: Basic <...>` trước khi trả lỗi.
5. **Đồng bộ `ts-rs` DTO annotations (Red-Team #8):**
   - Trong `GitLabUserDto` và `GitLabProjectDto`: gắn `#[ts(type = "number")]` lên `id: i64` và `#[ts(type = "number | null")]` lên `star_count: Option<i64>`.
   - Đăng ký `GitLabUserDto`, `GitLabProjectDto` trong `src-tauri/tests/export_bindings.rs`.
6. **Thêm Rust unit tests:**
   - Test `normalize_gitlab_base_url` (reject `http://`, bare host -> `https://`, trailing slash).
   - Test `validate_clone_url` (reject `--upload-pack=...`, `ext::sh -c ...`, `file:///...`, accept `https://` & `git@...`).
   - Test `build_git_clone_config_env` (origin match, mismatch fails, `http://` rejects PAT, `sslVerify` scoped theo origin, SSH không gắn HTTP header).
   - Test `redact_secrets` và JSON deserialization cho `GitLabProjectDto` (kể cả `star_count: null`).

## Success Criteria

- [x] `reqwest` dùng `rustls-tls-native-roots` hỗ trợ Enterprise Root CA trên Windows.
- [x] Token lưu theo `{ host, token }` trong OS Keyring; `gitlab_list_projects` và `git_clone` kiểm tra khớp origin trước khi dùng secret.
- [x] `git_clone` chặn CLI injection (`--`), chặn `http://` PAT leak, không treo prompt Windows, và ẩn `Authorization:` khi báo lỗi.
- [x] `cargo test -p ide-vcs` pass 100%.

## Risk Assessment

- **Rủi ro môi trường dev chạy server HTTP thuần cục bộ:** Nếu thực sự có GitLab lab chạy `http://` không có TLS, việc ép `https://` cho PAT sẽ từ chối (theo đúng nguyên tắc bảo mật không gửi token plaintext). Nếu cần, có thể clone SSH thay thế.
