# IntelliJ IDEA Desktop Clone (Tauri + Rust + React + TypeScript)

Ứng dụng IDE Desktop tự phát triển từ đầu với giao diện và trải nghiệm mô phỏng **JetBrains IntelliJ IDEA (New UI)**, xây dựng trên kiến trúc lai hiện đại: **Tauri v2 + Rust (Backend hiệu năng cao) + React 18 / TypeScript / Tailwind CSS (Frontend linh hoạt)**.

---

## 🚀 Quick Start (Chạy thử nghiệm Giao diện Frontend)

Hiện tại toàn bộ giao diện Frontend đã được hoàn thiện và sẵn sàng để trải nghiệm:

```powershell
# 1. Cài đặt các dependencies (nếu chưa cài)
npm install

# 2. Khởi chạy máy chủ phát triển
npm run dev
```

Sau khi chạy lệnh trên, truy cập đường dẫn cục bộ (ví dụ: `http://localhost:5173`) trên trình duyệt để trải nghiệm:
* 📁 **Project Tree**: Duyệt cây thư mục và mở file.
* 📝 **Monaco Editor**: Trình soạn thảo chuẩn cú pháp với theme JetBrains Darcula.
* 🪟 **Dockview Panels**: Kéo thả, chia cửa sổ đa nhiệm linh hoạt.
* 🔍 **Search Everywhere**: Nhấn phím `Shift + Shift` hoặc nút tìm kiếm trên TopBar.
* ▶️ **Run / Build Console**: Bấm nút Play (▶ xanh) để xem mô phỏng quá trình build/run.
* 💻 **Interactive Terminal**: Tab Terminal nhúng hỗ trợ gõ lệnh giả lập.

---

## 🛠️ Công Nghệ Sử Dụng

* **Frontend:** React 18, TypeScript, Vite, Tailwind CSS.
* **Layout & Docking:** `dockview` (Hệ thống dock panel kéo thả chuyên nghiệp).
* **Code Editor:** `@monaco-editor/react` (Theme Darcula, JetBrains Mono font).
* **Terminal:** `@xterm/xterm` + `@xterm/addon-fit`.
* **Icons:** `lucide-react`.
* **Desktop Core (Sắp ghép nối):** Tauri v2, Rust (Tokio, portable-pty, notify).

---

## 📚 Tài Liệu Chi Tiết Dự Án & Bộ Kỹ Năng Cần Thiết

Mọi thông tin tổng hợp về:
1. **Lịch sử các phiên thảo luận & bối cảnh dự án**.
2. **Hướng dẫn cài đặt môi trường (Visual Studio C++ Build Tools & Rust checklist)**.
3. **Danh sách chi tiết các Kỹ năng (Developer Skills, IDE Architecture, và AI Agent Skills)**.
4. **Lộ trình phát triển 5 giai đoạn (Roadmap)**.

👉 Xem chi tiết tại tệp: [**`SKILLS_AND_REQUIREMENTS.md`**](./SKILLS_AND_REQUIREMENTS.md)
