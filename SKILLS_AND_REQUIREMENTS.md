# KẾ HOẠCH DỰ ÁN CUSTOM IDEA & TỔNG HỢP CÁC SKILLS CẦN THIẾT

> **Tài liệu tổng hợp bối cảnh, lịch sử phát triển, kiến trúc hệ thống Multi-Crate Rust, và ma trận kỹ năng (Developer, Architecture & AI Agent Skills) phục vụ phát triển ứng dụng Desktop IDE phong cách JetBrains IntelliJ IDEA (Custom IDEA).**

---

## 1. Tóm Tắt Cuộc Hội Thoại & Tiến Trình Dự Án (Conversation Recap & Milestones)

Dự án **Custom IDEA** (IntelliJ IDEA Desktop Clone) đã trải qua quá trình phát triển vượt bậc từ ý tưởng giao diện ban đầu đến một ứng dụng Desktop hoàn chỉnh, hiệu năng cao và giàu tính năng:

1. **Ý tưởng khởi nguồn:**
   * Xây dựng công cụ IDE desktop hoàn chỉnh từ đầu, tái hiện trung thực giao diện và trải nghiệm **JetBrains IntelliJ IDEA (New UI & Darcula)**.
   * Lựa chọn kiến trúc: **Tauri v2 + Rust Multi-Crate Backend + React 18 / TypeScript / CodeMirror 6 Frontend**.
   * Ưu điểm: Hiệu năng native, khởi động nhanh, chiếm ít RAM hơn đáng kể so với Java/Swing nguyên bản hay Electron, đồng thời giao diện cực kỳ linh hoạt và hiện đại.

2. **Các giai đoạn hoàn thiện thực tế:**
   * **Giai đoạn 1 (Mockup UI):** Dựng khung giao diện New UI với TopBar, Activity Bar, Tool Windows, Dockview đa nhiệm, theme Darcula.
   * **Giai đoạn 2 (Tauri v2 Core & Environment):** Thiết lập môi trường biên dịch Visual Studio C++ Build Tools & Rust toolchain, cấu hình Tauri v2.
   * **Giai đoạn 3 (Core Native Systems):**
     - Xây dựng VFS (`crates/ide-vfs`) đọc/ghi file bất đồng bộ và bộ giám sát thay đổi tệp debounced (`notify-debouncer-mini`).
     - Tích hợp Terminal ConPTY thực thụ (`crates/ide-terminal` + `portable-pty` + `@xterm/xterm`) hỗ trợ PowerShell, CMD, Git Bash, WSL.
     - Bộ Process Runner thực tế (`crates/ide-run`) thực thi lệnh build/run và streaming log thời gian thực ra Run Console.
   * **Giai đoạn 4 (VCS & Navigation & Editor):**
     - Tích hợp Git VCS chuyên sâu (`crates/ide-vcs`): Commit, Push, Fetch, Pull, Branch, Stash, Diff, Blame, Interactive Rebase và bộ giải quyết xung đột 3-way conflict.
     - Tìm kiếm nhanh Search Everywhere & Find in Files với thuật toán Nucleo Fuzzy Matcher siêu tốc (`crates/ide-index`).
     - Nâng cấp bộ soạn thảo sang **CodeMirror 6** kèm tiện ích mở rộng Vim Mode (`@replit/codemirror-vim`), syntax highlighting Lezer, breadcrumbs, gutter icons.
     - Hệ thống Interactive Menu Registry chuẩn JetBrains (File, Edit, View, Git, Run, Tools, Window, Help) với phím tắt đầy đủ.
   * **Giai đoạn 5 (Enterprise Developer Tools):**
     - **Database Explorer & SQL Console (`crates/ide-db`):** Sử dụng `sqlx` kết nối PostgreSQL, MySQL, SQLite; soi chiếu lược đồ bảng/cột và lưới hiển thị dữ liệu ảo hóa (`@tanstack/react-virtual`).
     - **Docker Container Management (`crates/ide-docker`):** Kiểm tra daemon, quản lý containers/images, stream log container.
     - **HTTP REST Client (`crates/ide-http`):** Soạn thảo cú pháp RFC 7230, phân tích cú pháp và chạy file `.http` / `.rest`.
     - **Code Coverage (`crates/ide-coverage`):** Đọc báo cáo LCOV/JaCoCo và tô màu gutter trạng thái dòng mã được cover.
     - **LSP Client (`crates/ide-lsp`) & DAP Debugger (`crates/ide-dap`):** Kết nối Language Server Protocol và Debug Adapter Protocol.
     - **Build Tools Integration:** Tự động phát hiện JDK, panel quản lý Maven và Gradle.
     - **Settings Sync & Local History:** Xuất/nhập cấu hình IDE ra tệp ZIP, lưu lịch sử sửa đổi cục bộ.
   * **Giai đoạn 6 (Packaging & Portable Binary):**
     - Hỗ trợ đóng gói ứng dụng Windows Portable độc lập: `dist-portable/Custom-IDEA-Portable.exe`.
     - Cơ chế sinh tự động TypeScript IPC Bindings từ Rust structs (`npm run gen:bindings`).

---

## 2. Hướng Dẫn Cài Đặt Môi Trường & Thao Tác Dự Án (Prerequisites & Commands)

### 2.1. Yêu cầu Môi trường (Prerequisites Checklist)
* **Visual Studio C++ Build Tools:**
  * Chọn Workload: *Desktop development with C++*.
  * Chi tiết cài đặt: `MSVC v143+ C++ x64/x86 build tools`, `Windows 10/11 SDK`, `C++ CMake tools`.
* **Rust Toolchain:**
  * Rust phiên bản mới nhất (`1.80+`), target `x86_64-pc-windows-msvc`.
  * Cài đặt qua `rustup.rs`.
* **Node.js & npm:**
  * Node.js `>= 18.0.0` (khuyên dùng Node 20 LTS).

### 2.2. Các Lệnh Điều Khiển Dự Án (Key Scripts)

| Lệnh thực thi | Mục đích |
| :--- | :--- |
| `npm run dev` | Khởi chạy máy chủ phát triển Web Frontend (Vite) tại `http://localhost:5173` |
| `npm run tauri dev` | Khởi chạy ứng dụng Desktop Tauri v2 hoàn chỉnh (kèm Backend Rust & hot reload) |
| `npm run build:portable` | Biên dịch bản phát hành độc lập `dist-portable/Custom-IDEA-Portable.exe` không cần cài đặt |
| `npm run gen:bindings` | Chạy test xuất tự động TypeScript type definitions từ struct Rust (`ts-rs`) |
| `npm run build` | Kiểm tra lỗi TypeScript và build bundle frontend |
| `cargo check --workspace` | Kiểm tra nhanh cú pháp và kiểu dữ liệu trên cả 11 Rust crates |
| `cargo test --workspace` | Chạy toàn bộ bộ kiểm thử tự động của backend Rust |

---

## 3. Các Skill / Kỹ Năng Chuyên Môn Cần Thiết (Core Skills Matrix)

Để phát triển, mở rộng và bảo trì hệ thống IDE phức tạp như Custom IDEA, cần sự phối hợp chặt chẽ của 3 trụ cột kỹ năng: **Developer Competencies**, **IDE Architecture & System Design**, và **AI Agent Skills**.

```
┌────────────────────────────────────────────────────────────────────────┐
│               MA TRẬN KỸ NĂNG DỰ ÁN CUSTOM IDEA (INTELLIJ CLONE)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
     ┌──────────────────────────────┼──────────────────────────────┐
     ▼                              ▼                              ▼
┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐
│  DEVELOPER SKILLS      │ │  IDE ARCHITECTURE      │ │  AI AGENT SKILLS       │
├────────────────────────┤ ├────────────────────────┤ ├────────────────────────┤
│• Rust Multi-Crate      │ │• Modular Crate Design  │ │• custom-idea-dev(Custom)│
│• Tokio Async & Channels│ │• Async VFS & Watcher   │ │• ck:frontend-dev & UI  │
│• Tauri v2 IPC & Windows│ │• Inverted Fuzzy Index  │ │• ck:backend-development│
│• CodeMirror 6 & Vim    │ │• ConPTY Session Mgmt   │ │• ck:databases (SQLx)   │
│• Dockview & Zustand    │ │• Git 3-Way Engine      │ │• ck:debug & ck:fix     │
│• SQLx (Pg/MySQL/SQLite)│ │• LSP & DAP Protocols   │ │• ck:test & web-testing │
│• Docker CLI & HTTP RFC │ │• Process Lifecycle     │ │• ck:plan & devops      │
└────────────────────────┘ └────────────────────────┘ └────────────────────────┘
```

---

### 3.1. Kỹ Năng Lập Trình Viên (Developer Competencies)

#### Nhóm 1: Lập trình Hệ thống với Rust (Systems Programming)
1. **Rust Workspace & Multi-Crate Architecture:**
   * Tổ chức mã nguồn thành các crate độc lập (`crates/*`), giảm thời gian biên dịch lại và nâng cao tính tái sử dụng.
   * Xử lý đa luồng bất đồng bộ với **Tokio** (`mpsc::channel`, `broadcast`, `Arc<Mutex<T>>`).
   * Quản lý lỗi hệ thống chi tiết qua `thiserror` và `anyhow`.
2. **Tauri v2 IPC & Window Management:**
   * Định nghĩa commands `#[tauri::command]` có kiểu dữ liệu chặt chẽ qua `serde` và `ts-rs`.
   * Quản lý vòng đời ứng dụng: hook `CloseRequested` để dọn dẹp triệt để tiến trình con (child processes, PTY, LSP servers, DAP debuggers), tránh rò rỉ bộ nhớ hoặc process zombie.
   * Quản lý đa cửa sổ (`src-tauri/src/window.rs`), tùy biến frame cửa sổ không viền (frameless) với nút điều khiển thu nhỏ, phóng to, đóng tùy biến.
3. **PTY & Process Execution:**
   * Tương tác với Windows ConPTY qua `portable-pty`, hỗ trợ thay đổi kích thước terminal (resize rows/cols) động.
   * Khởi chạy và điều khiển tiến trình con (spawn child processes) cho các công cụ biên dịch (JDK javac/java, Maven mvn, Gradle, Cargo, npm).
4. **Cơ sở dữ liệu & Mạng (Database & Network):**
   * Sử dụng `sqlx` kết nối không chặn (non-blocking) tới PostgreSQL, MySQL, và SQLite.
   * Phân tích cú pháp HTTP RFC 7230 và thực thi yêu cầu mạng với `reqwest` streaming.

#### Nhóm 2: Lập trình Frontend & Giao diện IDE (Frontend Engineering)
1. **Trình soạn thảo CodeMirror 6 nâng cao:**
   * Nắm vững kiến trúc State, View, Compartment và Facet của CodeMirror 6.
   * Tích hợp chế độ bàn phím Vim (`@replit/codemirror-vim`).
   * Tùy biến theme JetBrains Darcula, syntax highlighting đa ngôn ngữ, font JetBrains Mono, tab size, minimap, ruler.
2. **Hệ thống Dockview & Layout Đa Nhiệm:**
   * Quản lý lưới panel chia màn hình (split panels dọc/ngang) linh hoạt, hỗ trợ kéo thả tab qua lại giữa các khu vực.
   * Lưu trữ và phục hồi trạng thái layout của người dùng qua LocalStorage.
3. **Quản lý Trạng Thái Toàn Cục (Zustand):**
   * Quản lý các store tập trung: tệp đang mở, dirty flags, project path hiện tại, trạng thái terminal, cấu hình run/debug.
4. **Hiển thị Dữ liệu Lớn với Virtualization:**
   * Sử dụng `@tanstack/react-virtual` để hiển thị hàng chục nghìn dòng dữ liệu trong Database Table Grid mà không gây giật lag UI.

---

### 3.2. Kỹ Năng Thiết Kế Kiến Trúc IDE (IDE Architecture & System Design)

Kiến trúc backend của Custom IDEA được chia thành 11 Rust crates chuyên trách:

| Crate | Trách Nhiệm Chính | Thư Viện Cốt Lõi |
| :--- | :--- | :--- |
| **`ide-vfs`** | Hệ thống tệp ảo bất đồng bộ, đọc/ghi tệp, tìm kiếm tệp, watcher debounced, xuất/nhập settings ZIP. | `notify-debouncer-mini`, `walkdir`, `zip` |
| **`ide-index`** | Lập chỉ mục cây thư mục, tìm kiếm xâu ký tự mờ tốc độ cao cho Search Everywhere. | `nucleo-matcher`, `regex` |
| **`ide-terminal`** | Khởi tạo và quản lý phiên PTY hai chiều, streaming I/O, điều chỉnh kích thước terminal. | `portable-pty` |
| **`ide-run`** | Tự động phát hiện toolchains (JDK, Cargo, Maven, Gradle, Node), chạy tiến trình và bắt log stdout/stderr. | `tokio::process` |
| **`ide-vcs`** | Thao tác Git chuyên sâu: status, diff, blame, branch, stash, commit, push, pull, 3-way conflict resolve. | `git CLI / process` |
| **`ide-db`** | Quản lý kết nối database, soi chiếu cấu trúc bảng/cột, thực thi truy vấn SQL đa hệ quản trị. | `sqlx` (sqlite, postgres, mysql) |
| **`ide-http`** | Phân tích cú pháp tệp `.http`/`.rest`, thực thi HTTP requests và trả về phản hồi định dạng. | `reqwest` |
| **`ide-docker`** | Giao tiếp với Docker Engine qua CLI: trạng thái daemon, danh sách container/image, logs. | `tokio::process` |
| **`ide-coverage`** | Phân tích tệp báo cáo độ bao phủ mã nguồn (LCOV, JaCoCo, Cobertura) và ánh xạ tới dòng code. | `serde_json`, `regex` |
| **`ide-lsp`** | Quản lý vòng đời Language Server qua JSON-RPC (khởi động, chẩn đoán diagnostics, completion). | `serde_json`, `tokio::io` |
| **`ide-dap`** | Quản lý phiên Debug Adapter Protocol (đặt breakpoint, step over/into/out, inspect biến, evaluate). | `serde_json`, `tokio::io` |

---

### 3.3. Bộ Kỹ Năng Trợ Lý AI (Antigravity & ClaudeKit Agent Skills)

Trong môi trường Antigravity IDE, ma trận kỹ năng sau được sử dụng để phát triển dự án hiệu quả nhất:

| Kỹ Năng (Agent Skill) | Vai Trò Trong Dự Án Custom IDEA |
| :--- | :--- |
| **`custom-idea-dev` (Custom)** | **Skill chuyên trách chính của dự án:** Nắm toàn bộ kiến trúc 11 crates, lệnh build portable, quy ước IPC và CodeMirror 6. |
| **`ck:frontend-development`** | Phát triển các component React 18, nâng cấp CodeMirror 6, Dockview panels và Zustand stores. |
| **`ck:frontend-design` & `ck:ui-styling`** | Tinh chỉnh chuẩn xác pixel theo phong cách JetBrains New UI & Darcula (màu sắc, border, icons Lucide). |
| **`ck:backend-development`** | Lập trình các crate Rust trong `crates/*`, tối ưu hóa async Tokio, quản lý luồng dữ liệu IPC. |
| **`ck:databases`** | Thiết kế và tối ưu module `crates/ide-db`, xử lý các câu truy vấn schema introspection và SQL console. |
| **`ck:devops`** | Tối ưu hóa cấu hình Docker (`crates/ide-docker`), quy trình đóng gói Windows portable binary. |
| **`ck:git`** | Quản lý mã nguồn dự án, hỗ trợ phát triển các tính năng Git VCS (`crates/ide-vcs`). |
| **`ck:debug` & `ck:fix`** | Khắc phục lỗi biên dịch Rust (borrow checker, lifetimes), lỗi C++ linkers, hoặc lỗi runtime frontend. |
| **`ck:test` & `ck:web-testing`** | Viết và chạy unit test cho backend Rust (`cargo test`) và kiểm thử tự động giao diện. |
| **`ck:plan` & `ck:project-management`** | Lên kế hoạch chi tiết cho các tính năng mới (như Plugin Marketplace hay AI Copilot). |

---

## 4. Lộ Trình Phát Triển (Roadmap) & Thành Tựu Đã Đạt Được

```mermaid
gantt
    title LỘ TRÌNH PHÁT TRIỂN DỰ ÁN CUSTOM IDEA
    dateFormat  YYYY-MM-DD
    section Giai đoạn Đã Hoàn Thành
    Phase 1: JetBrains New UI & Dockview & Monaco     :done, p1, 2026-10-20, 2026-10-22
    Phase 2: Tauri v2 Core & Visual Studio MSVC Setup :done, p2, 2026-10-22, 2026-10-24
    Phase 3: Real Process Runner & ConPTY Terminal    :done, p3, 2026-10-24, 2026-10-26
    Phase 4: Git VCS, Nucleo Index & Menu Registry    :done, p4, 2026-10-26, 2026-10-28
    Phase 5: CodeMirror 6, Vim Mode & 11 Rust Crates  :done, p5, 2026-10-28, 2026-10-31
    Phase 6: Database Tools, Docker, HTTP, Coverage   :done, p6, 2026-10-31, 2026-11-03
    Phase 7: Windows Portable (.exe) & TS Bindings    :done, p7, 2026-11-03, 2026-11-04
    section Giai đoạn Tiếp Theo
    Phase 8: Plugin Marketplace Ecosystem             :active, p8, 2026-11-04, 2026-11-15
    Phase 9: Tích hợp AI Copilot / LLM Assistant      :        p9, after p8, 10d
    Phase 10: Remote Development via SSH              :        p10, after p9, 10d
```

### Các nhiệm vụ trọng tâm tiếp theo:
1. **Plugin Marketplace Ecosystem:** Hiện thực hóa tải và nạp plugin động theo định dạng tiêu chuẩn.
2. **AI Assistant / Copilot nhúng:** Tích hợp trợ lý lập trình thông minh trực tiếp trong editor (inline code completion, chat panel với context dự án).
3. **Tối ưu hóa LSP & DAP:** Mở rộng danh sách Language Server được hỗ trợ sẵn (Java jdtls, Python pyright, C/C++ clangd, Go gopls) kèm tính năng tự động tải về.
