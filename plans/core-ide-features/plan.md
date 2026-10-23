---
title: IntelliJ Core Features Implementation
description: >-
  Triển khai 5 tính năng cốt lõi của IntelliJ IDEA: Process Runner & Run Console
  thật, Interactive PowerShell Terminal, Git VCS operations thật, Find in
  Files/Search Everywhere toàn dự án, và File System Watcher.
status: completed
priority: P1
branch: main
tags:
  - core
  - runner
  - terminal
  - git
  - search
  - watcher
blockedBy: []
blocks: []
created: '2026-10-22T10:17:17.085Z'
createdBy: 'ck:plan'
source: skill
---

# IntelliJ Core Features Implementation

## Overview

Kế hoạch chuyển đổi toàn diện từ giao diện mô phỏng sang hệ thống tính năng thực thi thực tế (Core Features) của IntelliJ IDEA:
1. **Real Process Runner & Run Console**: Chạy tiến trình thật (cargo, npm, python, custom command), stream log trực tiếp về console, hỗ trợ ngắt tiến trình (Stop).
2. **Interactive Shell Terminal**: Terminal nhúng tương tác thật dựa trên XTerm.js kết nối với PowerShell/CMD qua backend.
3. **Git VCS Operations**: Đọc trạng thái Git thật, xem Diff, Commit, Push, và chuyển đổi nhánh.
4. **Find in Files & Search Everywhere**: Tìm kiếm chuỗi và tên file siêu tốc trên toàn bộ thư mục dự án thực tế trên đĩa.
5. **File System Watcher & Disk Sync**: Tự động phát hiện thay đổi file trên ổ đĩa và cập nhật cây thư mục thời gian thực.

## Phases

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| 1 | [Real Process Runner and Run Console](./phase-01-real-process-runner-and-run-console.md) | Completed | Completed |
| 2 | [Interactive Shell Terminal](./phase-02-interactive-shell-terminal.md) | Completed | Completed |
| 3 | [Git VCS Operations](./phase-03-git-vcs-operations.md) | Completed | Completed |
| 4 | [Find in Files and Search Everywhere](./phase-04-find-in-files-and-search-everywhere.md) | Completed | Completed |
| 5 | [File System Watcher and Disk Sync](./phase-05-file-system-watcher-and-disk-sync.md) | Completed | Completed |

## Architecture & Data Flow

```
[ Frontend: React / Monaco / Xterm ]
       │
       ├── Run/Debug Trigger (Shift+F10) ──> invoke('run_process') ──> [ Tauri Rust Backend ]
       │                                                                      │
       ├── Terminal Input (onData) ────────> invoke('terminal_write') ────────┤──> [ System OS ]
       │                                                                      │    - PowerShell / CMD
       ├── Git Actions (Commit, Push) ─────> invoke('git_*') ─────────────────┤    - Git CLI
       │                                                                      │    - Compiler (Cargo/Node)
       ├── Find in Files (Ctrl+Shift+F) ───> invoke('search_in_files') ───────┤    - File System
       │                                                                      │
       └── Events (stdout, stderr, git, fs) <── app_handle.emit() ────────────┘
```

