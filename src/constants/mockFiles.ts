import { FileNode } from '../types';

export const initialFiles: FileNode[] = [
  {
    id: 'src-tauri',
    name: 'src-tauri',
    path: 'src-tauri',
    isFolder: true,
    children: [
      {
        id: 'src-tauri-src',
        name: 'src',
        path: 'src-tauri/src',
        isFolder: true,
        children: [
          {
            id: 'main-rs',
            name: 'main.rs',
            path: 'src-tauri/src/main.rs',
            isFolder: false,
            language: 'rust',
            content: `// Prevents additional console window on Windows in release, DO NOT REMOVE!!
            #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

            use tauri::{AppHandle, Manager};
            use serde::{Deserialize, Serialize};

            #[derive(Debug, Serialize, Deserialize)]
            pub struct CommandOutput {
              pub stdout: String,
              pub stderr: String,
              pub exit_code: i32,
            }

            // IntelliJ IDE Core Service: Execute Command in workspace
            #[tauri::command]
            fn execute_build_command(command: String, args: Vec<String>) -> Result<CommandOutput, String> {
              println!("Executing IDE Build Task: {} {:?}", command, args);
              Ok(CommandOutput {
                  stdout: "Compiling my-project v0.1.0 (D:\\\\IDE)\\\\nFinished dev [optimized + debuginfo] in 0.42s".into(),
                  stderr: "".into(),
                  exit_code: 0,
              })
            }

            fn main() {
              tauri::Builder::default()
              .invoke_handler(tauri::generate_handler![execute_build_command])
              .run(tauri::generate_context!())
              .expect("error while running IntelliJ IDE application");
            }
            `
          }
        ]
      },
      {
        id: 'cargo-toml',
        name: 'Cargo.toml',
        path: 'src-tauri/Cargo.toml',
        isFolder: false,
        language: 'ini',
        content: `[package]
        name = "intellij-idea-clone"
        version = "0.1.0"
        description = "A lightweight, modern IDE built with Tauri, Rust, React and Monaco"
        authors = ["Admin <admin@local>"]
        edition = "2021"

        [build-dependencies]
        tauri-build = { version = "2.7.4", features = [] }

        [dependencies]
        tauri = { version = "2.12.5", features = [] }
        serde = { version = "1", features = ["derive"] }
        serde_json = "1"
        portable-pty = "0.8"
        notify = "6.1"
        `
      }
    ]
  },
  {
    id: 'src',
    name: 'src',
    path: 'src',
    isFolder: true,
    children: [
      {
        id: 'app-tsx',
        name: 'App.tsx',
        path: 'src/App.tsx',
        isFolder: false,
        language: 'typescript',
        content: `// IntelliJ IDEA Clone - Main App Shell
        import React from 'react';

        export function App() {
          return (
            <div className="intellij-shell">
            <h1>IntelliJ IDEA Desktop</h1>
            </div>
          );
        }
        `
      },
      {
        id: 'main-tsx',
        name: 'main.tsx',
        path: 'src/main.tsx',
        isFolder: false,
        language: 'typescript',
        content: `import React from 'react';
        import ReactDOM from 'react-dom/client';
        import App from './App';
        import './index.css';

        ReactDOM.createRoot(document.getElementById('root')!).render(
          <React.StrictMode>
          <App />
          </React.StrictMode>
        );
        `
      }
    ]
  },
  {
    id: 'package-json',
    name: 'package.json',
    path: 'package.json',
    isFolder: false,
    language: 'json',
    content: `{
      "name": "intellij-idea-clone",
      "private": true,
      "version": "0.1.0",
      "type": "module"
    }
    `
  },
  {
    id: 'readme-md',
    name: 'README.md',
    path: 'README.md',
    isFolder: false,
    language: 'markdown',
    content: `# IntelliJ IDEA Clone

    Một trình biên soạn mã nguồn và IDE phong cách JetBrains IntelliJ IDEA New UI.

    ### Tính năng
    * **Giao diện JetBrains New UI & Darcula:** Chuẩn bảng màu, font JetBrains Mono.
    * **Monaco Editor:** Syntax highlighting cho Rust, TypeScript, JSON, Markdown.
    * **Terminal nhúng:** PowerShell xterm.js tích hợp sẵn.
    * **Search Everywhere:** Nhấn phím \`Double Shift\` để tìm kiếm nhanh.
    * **Run / Build Console:** Giả lập bảng điều khiển biên dịch tiến trình của IntelliJ.
    `
  }
];
