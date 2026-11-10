# Kế hoạch triển khai: Tích hợp Kết nối GitLab & Clone Repository trong Custom IDEA

## 1. Mục tiêu
Tích hợp khả năng kết nối tài khoản GitLab (hỗ trợ cả GitLab.com và self-hosted GitLab doanh nghiệp như `gitlab.mic.vn`) trực tiếp vào Custom IDEA:
- Quản lý tài khoản GitLab trong **Settings > Version Control > GitLab**.
- Duyệt và Clone Repository trực tiếp từ tài khoản GitLab trong modal **Get from Version Control**.

---

## 2. Kiến trúc & Các thành phần triển khai

### Phase 1: Rust Backend Engine (`crates/ide-vcs` & `src-tauri`)
- Cung cấp các Tauri IPC commands gọi qua `reqwest` (với timeout, headers `PRIVATE-TOKEN`, `danger_accept_invalid_certs(true)` cho server nội bộ):
  1. `gitlab_test_connection(host: String, token: String) -> Result<GitLabUserDto, String>`
     - Gọi `GET https://{host}/api/v4/user`
     - Trả về: `id`, `username`, `name`, `email`, `avatar_url`, `web_url`.
  2. `gitlab_list_projects(host: String, token: String, search: Option<String>, page: Option<u32>) -> Result<Vec<GitLabProjectDto>, String>`
     - Gọi `GET https://{host}/api/v4/projects?membership=true&simple=true&per_page=50&order_by=updated_at&sort=desc`
     - Hỗ trợ query `search` để tìm kiếm repository theo từ khóa.
     - Trả về: `id`, `name`, `name_with_namespace`, `path_with_namespace`, `http_url_to_repo`, `ssh_url_to_repo`, `default_branch`, `visibility`, `description`, `last_activity_at`.

### Phase 2: Frontend Data Models & Services (`src/types/gitlab.ts`, `src/services/gitlabService.ts`)
- TypeScript interfaces cho `GitLabAccount`, `GitLabUser`, `GitLabProject`.
- LocalStorage persistence quản lý thông tin tài khoản GitLab (`custom_idea_gitlab_accounts`, `custom_idea_gitlab_active_account`).
- Helper functions: `testGitLabConnection`, `getGitLabProjects`, `saveGitLabAccount`, `removeGitLabAccount`.

### Phase 3: Giao diện Cài đặt Tài khoản GitLab (`src/features/settings/panels/VersionControlPanel.tsx`)
- Thêm mục quản lý tài khoản **GitLab** trong giao diện Version Control.
- Form thêm/sửa tài khoản:
  - Trường **Server URL** (tự do nhập, placeholder `https://gitlab.mic.vn` hoặc `https://gitlab.com`).
  - Trường **Personal Access Token** (mask password).
  - Nút **Test Connection**: Kiểm tra và hiển thị badge trạng thái kết nối kèm Avatar, Name, Username.
  - Danh sách tài khoản đã kết nối, nút Remove, chuyển đổi tài khoản Active.

### Phase 4: Nâng cấp Modal "Get from Version Control" (`src/features/git/VcsCloneModal.tsx`)
- Thiết kế layout 2 tab chuẩn IntelliJ IDEA:
  - Sidebar bên trái:
    - **Repository URL**: Nhập link thủ công như hiện tại.
    - **GitLab**: Tab kết nối tài khoản GitLab.
  - Tab GitLab:
    - Nếu chưa có tài khoản: Hiển thị form đăng nhập nhanh (Server URL + Token) hoặc nút chuyển tới Settings.
    - Nếu đã có tài khoản:
      - Ô tìm kiếm Repository theo tên/namespace.
      - Danh sách Repository hiển thị namespace, visibility (public/private/internal), thời gian cập nhật.
      - Lựa chọn giao thức Clone: **HTTPS** hoặc **SSH**.
      - Nhấn chọn repo sẽ tự động điền URL và đường dẫn Directory đích.
      - Nút **Clone** tiến hành clone repo vào máy và mở workspace.

### Phase 5: Kiểm thử & Đóng gói
- Chạy `pnpm build` kiểm tra TypeScript & Vite bundle.
- Biên dịch lại bản Portable (`pnpm run build:portable`) để đảm bảo nhúng đầy đủ tính năng mới.

---

## 3. Tiêu chí nghiệm thu (Acceptance Criteria)
1. Thêm được tài khoản GitLab với bất kỳ server URL nào và Personal Access Token hợp lệ.
2. Kiểm tra kết nối thành công và hiển thị profile user.
3. Trong modal Clone ("Get from Version Control"), chuyển sang tab GitLab thấy danh sách dự án.
4. Tìm kiếm project nhanh chóng và click chọn project để tự động điền URL/thư mục.
5. Clone thành công repo về máy và tự động mở project.
6. Build `pnpm build` và `cargo check` không phát sinh lỗi.
