import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TopBar, RecentProjectItem } from './components/TopBar';
import { ActivityBar } from './components/ActivityBar';
import { ProjectTree } from './components/ProjectTree';
import { CodeEditor, CodeEditorHandle } from './components/CodeEditor';
import { TerminalPanel } from './components/TerminalPanel';
import { RunConsolePanel } from './components/RunConsolePanel';
import { StatusBar } from './components/StatusBar';
import { SearchEverywhereModal } from './components/SearchEverywhereModal';
import { AboutModal } from './components/AboutModal';
import { NewFileModal } from './components/NewFileModal';
import { SettingsModal, IdeSettings } from './components/SettingsModal';
import { GoToLineModal } from './components/GoToLineModal';
import { GitCommitModal } from './components/GitCommitModal';
import { GitBranchesModal } from './components/GitBranchesModal';
import { RenameModal } from './components/RenameModal';
import { TipOfTheDayModal } from './components/TipOfTheDayModal';
import { RunConfigModal } from './components/RunConfigModal';
import { NewProjectModal } from './components/NewProjectModal';
import { ProjectStructureModal } from './components/ProjectStructureModal';
import { InvalidateCachesModal } from './components/InvalidateCachesModal';
import { LocalHistoryModal } from './components/LocalHistoryModal';
import { RepairIdeModal } from './components/RepairIdeModal';
import { ToastContainer, ToastItem } from './components/ToastContainer';
import { OpenProjectDialog } from './components/OpenProjectDialog';
import { RightActivityBar } from './components/RightActivityBar';
import { FileNode, OpenTab, RunLog, ActionItem } from './types';
import { Terminal, PlaySquare, AlertCircle } from 'lucide-react';

const initialFiles: FileNode[] = [
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

export const App: React.FC = () => {
  const [files, setFiles] = useState<FileNode[]>(initialFiles);
  const [activeSideTab, setActiveSideTab] = useState('project');
  const [isSideBarOpen, setIsSideBarOpen] = useState(true);
  const [activeRightPanel, setActiveRightPanel] = useState<string | null>(null);
  const [sideBarWidth] = useState(260);

  const [bottomTab, setBottomTab] = useState<'run' | 'terminal' | 'problems'>('run');
  const [isBottomOpen, setIsBottomOpen] = useState(true);
  const [bottomHeight] = useState(220);

  // Git branch
  const [currentBranch, setCurrentBranch] = useState('main');

  // Ide Settings
  const [settings, setSettings] = useState<IdeSettings>(() => {
    try {
      const saved = localStorage.getItem('intellij_ide_settings');
      if (saved) {
        return {
          theme: 'intellij-new-ui-dark',
          fontSize: 13,
          tabSize: 4,
          minimap: true,
          lineNumbers: true,
          wordWrap: false,
          fontFamily: 'JetBrains Mono',
          lineHeight: 1.4,
          ligatures: true,
          bracketPairs: true,
          codeFolding: true,
          projectOpenMode: 'ask',
          confirmExit: true,
          reopenProjectsOnStartup: true,
          syncFilesOnFrameActivation: true,
          terminalShell: 'powershell.exe',
          gitPath: 'git',
          doubleShiftTimeout: 350,
          recentFilesLimit: 50,
          terminalScrollback: 10000,
          compactMode: false,
          enableFileColors: true,
          soundOnFailure: true,
          dataEditorPageSize: 500,
          dataEditorNullValue: '<null>',
          dataEditorGroupDigits: true,
          defaultBrowser: 'chrome',
          cargoCheckOnFly: true,
          useRustfmt: true,
          tsLanguageServer: true,
          buildHeapSize: 1024,
          uiFontSize: 13,
          ...JSON.parse(saved),
        };
      }
    } catch (e) {
      console.error('Failed to parse saved settings', e);
    }
    return {
      theme: 'intellij-new-ui-dark',
      fontSize: 13,
      tabSize: 4,
      minimap: true,
      lineNumbers: true,
      wordWrap: false,
      fontFamily: 'JetBrains Mono',
      lineHeight: 1.4,
      ligatures: true,
      bracketPairs: true,
      codeFolding: true,
      projectOpenMode: 'ask',
      confirmExit: true,
      reopenProjectsOnStartup: true,
      syncFilesOnFrameActivation: true,
      terminalShell: 'powershell.exe',
      gitPath: 'git',
      doubleShiftTimeout: 350,
      recentFilesLimit: 50,
      terminalScrollback: 10000,
      compactMode: false,
      enableFileColors: true,
      soundOnFailure: true,
      dataEditorPageSize: 500,
      dataEditorNullValue: '<null>',
      dataEditorGroupDigits: true,
      defaultBrowser: 'chrome',
      cargoCheckOnFly: true,
      useRustfmt: true,
      tsLanguageServer: true,
      buildHeapSize: 1024,
      uiFontSize: 13,
    };
  });

  // Open tabs in Monaco Editor
  const [tabs, setTabs] = useState<OpenTab[]>([
    {
      id: 'main-rs',
      title: 'main.rs',
      path: 'src-tauri/src/main.rs',
      content: initialFiles[0].children![0].children![0].content!,
      language: 'rust',
      isDirty: false
    },
    {
      id: 'cargo-toml',
      title: 'Cargo.toml',
      path: 'src-tauri/Cargo.toml',
      content: initialFiles[0].children![1].content!,
      language: 'ini',
      isDirty: false
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string | null>('main-rs');

  // Code editor ref for direct actions
  const codeEditorRef = useRef<CodeEditorHandle>(null);

  // Status bar cursor info
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  // Project & File system states
  const [projectName, setProjectName] = useState('intellij-idea-clone');
  const [powerSaveMode, setPowerSaveMode] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [lineEnding, setLineEnding] = useState<'CRLF' | 'LF'>('CRLF');
  const [fileEncoding, setFileEncoding] = useState('UTF-8');

  // Modals state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isNewFileOpen, setIsNewFileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGoToLineOpen, setIsGoToLineOpen] = useState(false);
  const [isCommitOpen, setIsCommitOpen] = useState(false);
  const [isBranchesOpen, setIsBranchesOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isTipOpen, setIsTipOpen] = useState(false);
  const [isRunConfigOpen, setIsRunConfigOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isProjectStructureOpen, setIsProjectStructureOpen] = useState(false);
  const [isInvalidateCachesOpen, setIsInvalidateCachesOpen] = useState(false);
  const [isLocalHistoryOpen, setIsLocalHistoryOpen] = useState(false);
  const [isRepairIdeOpen, setIsRepairIdeOpen] = useState(false);
  const [isOpenProjectPromptOpen, setIsOpenProjectPromptOpen] = useState(false);
  const [pendingTargetProject, setPendingTargetProject] = useState<FileNode | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((title: string, message?: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = String(Date.now() + Math.random());
    setToasts(prev => [...prev, { id, title, message, type }]);

    // Auto dismiss after 3.5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Recent Projects
  const [recentProjects, setRecentProjects] = useState<RecentProjectItem[]>(() => {
    try {
      const saved = localStorage.getItem('ij_recent_projects');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load recent projects:', e);
    }
    return [
      { name: 'intellij-idea-clone', path: 'D:\\IDE' },
      { name: 'test', path: 'D:\\test\\test' },
    ];
  });

  const saveRecentProject = useCallback((name: string, path: string) => {
    setRecentProjects(prev => {
      const filtered = prev.filter(p => p.path !== path);
      const updated = [{ name, path }, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('ij_recent_projects', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save recent projects:', e);
      }
      return updated;
    });
  }, []);

  const loadProjectIntoIde = useCallback((tree: FileNode) => {
    setProjectName(tree.name);
    setFiles([tree]);
    saveRecentProject(tree.name, tree.path);

    // Recursively find first openable file
    const findFirstFile = (node: FileNode): FileNode | null => {
      if (!node.isFolder && node.content !== undefined) return node;
      if (node.children) {
        for (const child of node.children) {
          const f = findFirstFile(child);
          if (f) return f;
        }
      }
      return null;
    };

    const first = findFirstFile(tree);
    if (first) {
      setTabs([{
        id: first.id,
        title: first.name,
        path: first.path,
        content: first.content || '',
        language: first.language || 'plaintext',
        isDirty: false,
      }]);
      setActiveTabId(first.id);
    } else {
      setTabs([]);
      setActiveTabId(null);
    }

    addToast('Project Opened', `Loaded project [${tree.name}] from ${tree.path}`, 'success');
  }, [saveRecentProject, addToast]);

  const handleOpenNewWindow = useCallback(async (tree: FileNode) => {
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('open_in_new_window', { 
          projectName: tree.name,
          projectPath: tree.path 
        });
      }
      saveRecentProject(tree.name, tree.path);
      addToast('New Window Opened', `Launched new IntelliJ window for [${tree.name}]`, 'success');
    } catch (err) {
      console.error('Failed to open new window:', err);
      addToast('Open Failed', String(err), 'error');
    }
  }, [saveRecentProject, addToast]);

  const handleAttachProject = useCallback((tree: FileNode) => {
    setFiles(prev => [...prev, tree]);
    saveRecentProject(tree.name, tree.path);
    addToast('Project Attached', `Attached [${tree.name}] to current workspace`, 'success');
  }, [saveRecentProject, addToast]);

  const requestOpenProject = useCallback((tree: FileNode) => {
    if (files.length > 0 && projectName !== 'Welcome') {
      const savedMode = localStorage.getItem('ij_project_open_mode');
      if (savedMode === 'this_window') {
        loadProjectIntoIde(tree);
      } else if (savedMode === 'new_window') {
        handleOpenNewWindow(tree);
      } else {
        setPendingTargetProject(tree);
        setIsOpenProjectPromptOpen(true);
      }
    } else {
      loadProjectIntoIde(tree);
    }
  }, [files.length, projectName, loadProjectIntoIde, handleOpenNewWindow]);

  const handleOpenProject = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const result = await invoke<FileNode | null>('open_project_dialog', { defaultPath: null });
        if (result) {
          requestOpenProject(result);
        }
      } else {
        addToast('Open Project', 'Select a file or project folder from disk', 'info');
      }
    } catch (err) {
      console.error('Failed to open project:', err);
      addToast('Open Failed', String(err), 'error');
    }
  }, [requestOpenProject, addToast]);

  const handleOpenProjectPath = useCallback(async (projectPath: string) => {
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const result = await invoke<FileNode>('open_project_by_path', { projectPath });
        if (result) {
          requestOpenProject(result);
        }
      } else {
        addToast('Open Project', `Opening ${projectPath}`, 'info');
      }
    } catch (err) {
      console.error('Failed to open project by path:', err);
      addToast('Open Failed', String(err), 'error');
    }
  }, [requestOpenProject, addToast]);

  // Automatically open project if opened via query parameter (e.g. from New Window)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const openPath = params.get('openPath');
    if (openPath && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      invoke<FileNode>('open_project_by_path', { projectPath: openPath })
        .then(tree => {
          if (tree) {
            loadProjectIntoIde(tree);
          }
        })
        .catch(err => console.error('Failed to auto-load project in new window:', err));
    }
  }, [loadProjectIntoIde]);

  // Run / Build state & logs
  const [isRunning, setIsRunning] = useState(false);
  const [runLogs, setRunLogs] = useState<RunLog[]>([
    {
      id: '1',
      text: 'C:\\Users\\adminlocal\\.cargo\\bin\\cargo.exe run --package intellij-idea-clone',
      type: 'cmd',
      timestamp: '10:00:01'
    },
    {
      id: '2',
      text: '   Compiling intellij-idea-clone v0.1.0 (D:\\IDE)',
      type: 'info',
      timestamp: '10:00:02'
    },
    {
      id: '3',
      text: '    Finished `dev` profile [optimized + debuginfo] in 0.42s',
      type: 'success',
      timestamp: '10:00:03'
    },
    {
      id: '4',
      text: '     Running `target\\debug\\intellij-idea-clone.exe`',
      type: 'info',
      timestamp: '10:00:03'
    },
    {
      id: '5',
      text: 'IntelliJ IDE UI initialized successfully on Windows.',
      type: 'success',
      timestamp: '10:00:04'
    }
  ]);

  const handleRun = useCallback(() => {
    setIsRunning(true);
    setBottomTab('run');
    setIsBottomOpen(true);

    const startTime = new Date().toLocaleTimeString();
    setRunLogs(prev => [
      ...prev,
      {
        id: String(Date.now()),
        text: 'C:\\Users\\adminlocal\\.cargo\\bin\\cargo.exe check --all-targets',
        type: 'cmd',
        timestamp: startTime
      },
      {
        id: String(Date.now() + 1),
        text: 'Checking intellij-idea-clone v0.1.0 (D:\\IDE)...',
        type: 'info',
        timestamp: startTime
      }
    ]);

    setTimeout(() => {
      setRunLogs(prev => [
        ...prev,
        {
          id: String(Date.now() + 2),
          text: 'Finished `dev` profile [optimized + debuginfo] in 0.38s',
          type: 'success',
          timestamp: new Date().toLocaleTimeString()
        },
        {
          id: String(Date.now() + 3),
          text: 'Process finished with exit code 0',
          type: 'success',
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      setIsRunning(false);
      addToast('Build Finished', 'Process finished with exit code 0', 'success');
    }, 1200);
  }, [addToast]);

  const handleStop = useCallback(() => {
    setIsRunning(false);
    setRunLogs(prev => [
      ...prev,
      {
        id: String(Date.now()),
        text: 'Process terminated by user with exit code 1',
        type: 'error',
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
    addToast('Process Terminated', 'Stopped Desktop IDE run task', 'warning');
  }, [addToast]);

  // Handle Save
  const handleSaveActive = useCallback(async () => {
    const current = tabs.find(t => t.id === activeTabId);
    if (current && typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      if (current.path && (current.path.includes('/') || current.path.includes('\\'))) {
        try {
          await invoke('save_file_content', { path: current.path, content: current.content });
        } catch (e) {
          console.error('Failed to save to disk:', e);
        }
      }
    }
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isDirty: false } : t));
    addToast('All files saved', 'Virtual File System synchronized', 'success');
  }, [activeTabId, tabs, addToast]);

  // Handle Close Active Tab
  const handleCloseActiveTab = useCallback(() => {
    if (!activeTabId) return;
    const nextTabs = tabs.filter(t => t.id !== activeTabId);
    setTabs(nextTabs);
    setActiveTabId(nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].id : null);
  }, [activeTabId, tabs]);

  // Go to Line
  const handleGoToLine = (line: number, column: number) => {
    codeEditorRef.current?.goToLine(line, column);
    setCursorPos({ line, col: column });
    addToast('Jumped to Line', `Line ${line}, Column ${column}`, 'info');
  };

  // Rename File
  const handleRenameActive = (newName: string) => {
    if (!activeTabId) return;

    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const pathParts = t.path.split('/');
        pathParts[pathParts.length - 1] = newName;
        return { ...t, title: newName, path: pathParts.join('/') };
      }
      return t;
    }));

    // Update in files tree
    setFiles(prev => prev.map(f => {
      if (f.id === activeTabId) {
        return { ...f, name: newName };
      }
      if (f.children) {
        return {
          ...f,
          children: f.children.map(c => c.id === activeTabId ? { ...c, name: newName } : c)
        };
      }
      return f;
    }));

    addToast('Renamed', `File renamed to ${newName}`, 'success');
  };

  // Git Commit
  const handleCommit = (message: string, andPush: boolean) => {
    addToast('Committed', `[${currentBranch}] ${message}`, 'success');
    if (andPush) {
      setTimeout(() => {
        addToast('Pushed', `Branch ${currentBranch} up to date on remote origin`, 'success');
      }, 800);
    }
  };

  // Central Menu Action Dispatcher
  const handleMenuAction = useCallback((actionId: string) => {
    switch (actionId) {
      // File actions
      case 'file.newProject':
      case 'file.newFromExisting':
      case 'file.newFromVcs':
        setIsNewProjectOpen(true);
        break;
      case 'file.new':
        setIsNewFileOpen(true);
        break;
      case 'file.newScratch': {
        const scratchId = `scratch-${Date.now()}`;
        const newTab: OpenTab = {
          id: scratchId,
          title: 'scratch_1.ts',
          path: 'scratches/scratch_1.ts',
          content: '// IntelliJ IDEA Scratch Buffer (Ctrl+Alt+Shift+Insert)\n// You can draft temporary code here without creating a project file.\n\nconst greeting: string = "Hello, IntelliJ Clone!";\nconsole.log(greeting);\n',
          language: 'typescript',
          isDirty: true,
        };
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(scratchId);
        addToast('Scratch Buffer Created', 'scratch_1.ts opened in editor', 'info');
        break;
      }
      case 'file.newFolder':
        addToast('New Directory', 'Directory created in workspace root', 'info');
        break;
      case 'file.newPackage':
        addToast('New Package', 'Package module initialized', 'info');
        break;
      case 'file.newRust': {
        const id = `rust-${Date.now()}`;
        setTabs(prev => [...prev, { id, title: 'mod.rs', path: 'src/mod.rs', content: 'pub fn init() {\n    println!("Module initialized");\n}\n', language: 'rust', isDirty: true }]);
        setActiveTabId(id);
        addToast('Rust File Created', 'mod.rs opened', 'success');
        break;
      }
      case 'file.newTs': {
        const id = `ts-${Date.now()}`;
        setTabs(prev => [...prev, { id, title: 'Component.tsx', path: 'src/Component.tsx', content: 'import React from "react";\n\nexport const Component = () => <div>Hello from Component</div>;\n', language: 'typescript', isDirty: true }]);
        setActiveTabId(id);
        addToast('TypeScript Component Created', 'Component.tsx opened', 'success');
        break;
      }
      case 'file.newHtml': {
        const id = `html-${Date.now()}`;
        setTabs(prev => [...prev, { id, title: 'index.html', path: 'index.html', content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>IntelliJ Clone</title>\n</head>\n<body>\n  <h1>Welcome</h1>\n</body>\n</html>', language: 'html', isDirty: true }]);
        setActiveTabId(id);
        addToast('HTML File Created', 'index.html opened', 'success');
        break;
      }
      case 'file.newCss': {
        const id = `css-${Date.now()}`;
        setTabs(prev => [...prev, { id, title: 'style.css', path: 'style.css', content: '/* IntelliJ IDEA Clone Styles */\nbody {\n  margin: 0;\n  background-color: #1E1F22;\n}\n', language: 'css', isDirty: true }]);
        setActiveTabId(id);
        addToast('Style Sheet Created', 'style.css opened', 'success');
        break;
      }
      case 'file.open':
        handleOpenProject();
        break;
      case 'file.openRecent.ide':
        handleOpenProjectPath('D:\\IDE');
        break;
      case 'file.openRecent.web':
        handleOpenProjectPath('D:\\Projects\\Web');
        break;
      case 'file.openRecent.api':
        handleOpenProjectPath('D:\\Projects\\Api');
        break;
      case 'file.manageProjects':
        setIsNewProjectOpen(true);
        break;
      case 'file.closeProject':
        setTabs([]);
        setActiveTabId(null);
        setFiles([]);
        setProjectName('Welcome');
        addToast('Project Closed', `${projectName} closed`, 'info');
        break;
      case 'file.renameProject':
        setIsRenameOpen(true);
        break;
      case 'file.settings':
        setIsSettingsOpen(true);
        break;
      case 'file.projectStructure':
        setIsProjectStructureOpen(true);
        break;
      case 'file.encoding.utf8':
        setFileEncoding('UTF-8');
        addToast('File Encoding', 'Encoding set to UTF-8', 'info');
        break;
      case 'file.encoding.ascii':
        setFileEncoding('US-ASCII');
        addToast('File Encoding', 'Encoding set to US-ASCII', 'info');
        break;
      case 'file.encoding.iso':
        setFileEncoding('ISO-8859-1');
        addToast('File Encoding', 'Encoding set to ISO-8859-1', 'info');
        break;
      case 'file.line.crlf':
        setLineEnding('CRLF');
        addToast('Line Separators', 'Switched to CRLF - Windows (\\r\\n)', 'info');
        break;
      case 'file.line.lf':
        setLineEnding('LF');
        addToast('Line Separators', 'Switched to LF - Unix/macOS (\\n)', 'info');
        break;
      case 'file.toggleReadOnly':
        setIsReadOnly(prev => {
          const next = !prev;
          addToast('File Permissions', next ? 'File set to Read-Only mode' : 'File unlocked for editing', next ? 'warning' : 'success');
          return next;
        });
        break;
      case 'file.removeBom':
        addToast('BOM Removed', 'Byte Order Mark removed from active file', 'success');
        break;
      case 'file.localHistory':
        setIsLocalHistoryOpen(true);
        break;
      case 'file.putLabel':
        addToast('Local History Label', 'Label "v0.1-checkpoint" attached to current file revision', 'success');
        break;
      case 'file.save':
      case 'file.saveAll':
        setTabs(prev => prev.map(t => ({ ...t, isDirty: false })));
        addToast('All Files Saved', 'All open files flushed to disk (Ctrl+S)', 'success');
        break;
      case 'file.reloadFromDisk':
        addToast('Reload from Disk', 'Active file reloaded from disk (Ctrl+Alt+Y)', 'info');
        break;
      case 'file.repairIde':
        setIsRepairIdeOpen(true);
        break;
      case 'file.invalidateCaches':
        setIsInvalidateCachesOpen(true);
        break;
      case 'file.exportSettings': {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "intellij-settings.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        addToast('Settings Exported', 'Saved as intellij-settings.json', 'success');
        break;
      }
      case 'file.importSettings':
      case 'file.restoreDefaultSettings':
        setSettings({
          theme: 'intellij-new-ui-dark',
          fontSize: 13,
          tabSize: 4,
          minimap: true,
          lineNumbers: true,
          wordWrap: false,
        });
        addToast('Settings Restored', 'JetBrains defaults restored', 'success');
        break;
      case 'file.settingsForNewProjects':
      case 'file.runConfigTemplates':
      case 'file.saveFileAsTemplate':
        addToast('Template Manager', 'Configuration saved as IDE template', 'info');
        break;
      case 'file.syncFileSystem':
        addToast('VFS Synced', 'Virtual File System synchronized with disk changes', 'success');
        break;
      case 'file.closeTab':
        handleCloseActiveTab();
        break;
      case 'file.closeAllTabs':
        setTabs([]);
        setActiveTabId(null);
        addToast('Tabs Closed', 'All editor tabs have been closed', 'info');
        break;
      case 'file.togglePowerSave':
        setPowerSaveMode(prev => {
          const next = !prev;
          if (next) {
            setSettings(s => ({ ...s, minimap: false }));
            addToast('Power Save Mode', 'Enabled: Minimap paused to save battery', 'warning');
          } else {
            setSettings(s => ({ ...s, minimap: true }));
            addToast('Power Save Mode', 'Disabled: Full IDE services active', 'success');
          }
          return next;
        });
        break;
      case 'file.exit':
      case 'app.exit':
        addToast('Exit IDE', 'Closing IntelliJ IDEA...', 'info');
        window.close();
        break;

      // Edit actions
      case 'edit.undo':
      case 'edit.redo':
      case 'edit.cut':
      case 'edit.copy':
      case 'edit.paste':
        addToast('Clipboard Action', `Executed ${actionId}`, 'info');
        break;
      case 'edit.find':
        codeEditorRef.current?.triggerFind();
        break;
      case 'edit.replace':
        codeEditorRef.current?.triggerReplace();
        break;

      // View actions
      case 'view.toggleProject':
        setActiveSideTab('project');
        setIsSideBarOpen(prev => !prev);
        break;
      case 'view.toggleRun':
        setBottomTab('run');
        setIsBottomOpen(true);
        break;
      case 'view.toggleTerminal':
        setBottomTab('terminal');
        setIsBottomOpen(true);
        break;
      case 'view.toggleProblems':
        setBottomTab('problems');
        setIsBottomOpen(true);
        break;
      case 'view.toggleLeftSidebar':
        setIsSideBarOpen(prev => !prev);
        break;
      case 'view.toggleBottomPanel':
        setIsBottomOpen(prev => !prev);
        break;
      case 'view.aiAssistant':
        setActiveRightPanel(prev => prev === 'ai' ? null : 'ai');
        break;
      case 'view.notifications':
        setActiveRightPanel(prev => prev === 'notifications' ? null : 'notifications');
        break;
      case 'view.database':
        setActiveRightPanel(prev => prev === 'database' ? null : 'database');
        break;

      // Navigate actions
      case 'navigate.searchEverywhere':
        setIsSearchOpen(true);
        break;
      case 'navigate.goToFile':
        setIsSearchOpen(true);
        break;
      case 'navigate.goToLine':
        setIsGoToLineOpen(true);
        break;

      // Code actions
      case 'code.format':
        codeEditorRef.current?.formatDocument();
        addToast('Code Formatted', 'Document formatted using IntelliJ style (Ctrl+Alt+L)', 'success');
        break;
      case 'code.inspect':
        addToast('Inspection Clean', 'Code analysis found 0 warnings', 'success');
        break;
      case 'code.optimizeImports':
        addToast('Imports Optimized', 'Unused imports removed (Ctrl+Alt+O)', 'info');
        break;
      case 'code.commentLine':
        codeEditorRef.current?.commentLine();
        break;

      // Refactor actions
      case 'refactor.rename':
        setIsRenameOpen(true);
        break;

      // Build & Run actions
      case 'build.build':
      case 'build.rebuild':
        handleRun();
        break;
      case 'run.run':
        handleRun();
        break;
      case 'run.debug':
        addToast('Debugger Ready', 'Connected to debug session on port 9229', 'info');
        handleRun();
        break;
      case 'run.stop':
        handleStop();
        break;

      // Tools actions
      case 'tools.terminal':
        setBottomTab('terminal');
        setIsBottomOpen(true);
        break;

      // Git actions
      case 'git.commit':
        setIsCommitOpen(true);
        break;
      case 'git.branches':
        setIsBranchesOpen(true);
        break;
      case 'git.push':
        addToast('Git Push', `Pushed commits to origin/${currentBranch}`, 'success');
        break;
      case 'git.pull':
        addToast('Git Pull', `Updated ${currentBranch} from remote`, 'success');
        break;

      // Help actions
      case 'help.about':
        setIsAboutOpen(true);
        break;
      case 'help.tip':
        setIsTipOpen(true);
        break;
      case 'help.keymap':
        setIsSettingsOpen(true);
        break;

      default:
        if (actionId.startsWith('file.openRecent:')) {
          const targetPath = actionId.replace('file.openRecent:', '');
          handleOpenProjectPath(targetPath);
          return;
        }
        addToast('Menu Action', `Action [${actionId}] triggered`, 'info');
        break;
    }
  }, [handleSaveActive, handleCloseActiveTab, handleRun, handleStop, handleOpenProject, handleOpenProjectPath, addToast, currentBranch]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    let lastShiftTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Double Shift
      if (e.key === 'Shift') {
        const now = Date.now();
        const timeout = settings.doubleShiftTimeout || 350;
        if (now - lastShiftTime < timeout) {
          setIsSearchOpen(true);
        }
        lastShiftTime = now;
        return;
      }

      // Ctrl + Alt + S (Settings)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsSettingsOpen(true);
        return;
      }

      // Ctrl + G (Go to Line)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setIsGoToLineOpen(true);
        return;
      }

      // Shift + F6 (Rename)
      if (e.shiftKey && e.key === 'F6') {
        e.preventDefault();
        setIsRenameOpen(true);
        return;
      }

      // Ctrl + O (Open Project)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenProject();
        return;
      }

      // Ctrl + K (Git Commit)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommitOpen(true);
        return;
      }

      // Ctrl + S (Save)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveActive();
        return;
      }

      // Ctrl + W (Close active tab)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        handleCloseActiveTab();
        return;
      }

      // Ctrl + Alt + L (Format code)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleMenuAction('code.format');
        return;
      }

      // Ctrl + / (Comment line)
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        codeEditorRef.current?.commentLine();
        return;
      }

      // Ctrl + D (Duplicate line)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        codeEditorRef.current?.duplicateLine();
        return;
      }

      // Alt + 1 (Toggle Project sidebar)
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        handleMenuAction('view.toggleProject');
        return;
      }

      // Alt + 4 (Toggle Run console)
      if (e.altKey && e.key === '4') {
        e.preventDefault();
        handleMenuAction('view.toggleRun');
        return;
      }

      // Alt + F12 (Toggle Terminal)
      if (e.altKey && e.key === 'F12') {
        e.preventDefault();
        handleMenuAction('view.toggleTerminal');
        return;
      }

      // Shift + F10 (Run)
      if (e.shiftKey && e.key === 'F10') {
        e.preventDefault();
        handleRun();
        return;
      }

      // Ctrl + F9 (Build)
      if ((e.ctrlKey || e.metaKey) && e.key === 'F9') {
        e.preventDefault();
        handleRun();
        return;
      }

      // Ctrl + F2 (Stop)
      if ((e.ctrlKey || e.metaKey) && e.key === 'F2') {
        e.preventDefault();
        handleStop();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveActive, handleCloseActiveTab, handleMenuAction, handleRun, handleStop]);

  // Create New File logic
  const handleCreateNewFile = (fileName: string) => {
    let language = 'plaintext';
    if (fileName.endsWith('.rs')) language = 'rust';
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) language = 'typescript';
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) language = 'javascript';
    if (fileName.endsWith('.json') || fileName.endsWith('.toml')) language = 'json';
    if (fileName.endsWith('.md')) language = 'markdown';
    if (fileName.endsWith('.css')) language = 'css';

    const newId = `file-${Date.now()}`;
    const newPath = `src/${fileName}`;
    const newContent = `// ${fileName}\n\n`;

    const newFileNode: FileNode = {
      id: newId,
      name: fileName,
      path: newPath,
      isFolder: false,
      language,
      content: newContent
    };

    // Add to project tree under src folder
    setFiles(prev => prev.map(f => {
      if (f.id === 'src' && f.children) {
        return { ...f, children: [...f.children, newFileNode] };
      }
      return f;
    }));

    // Open immediately in tab
    const newTab: OpenTab = {
      id: newId,
      title: fileName,
      path: newPath,
      content: newContent,
      language,
      isDirty: false
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    addToast('File Created', `Created ${fileName} and opened in editor`, 'success');
  };

  const handleFileSelect = async (file: FileNode) => {
    if (file.isFolder) return;

    const existingTab = tabs.find(t => t.id === file.id);
    if (existingTab) {
      setActiveTabId(file.id);
    } else {
      let content = file.content;
      if (content === undefined || content === null) {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) && file.path) {
          try {
            content = await invoke<string>('read_file_content', { path: file.path });
          } catch (e) {
            console.warn('Failed to read file from disk:', e);
            content = '';
          }
        } else {
          content = '';
        }
      }

      const newTab: OpenTab = {
        id: file.id,
        title: file.name,
        path: file.path,
        content: content || '',
        language: file.language || 'plaintext',
        isDirty: false
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(file.id);
    }
  };

  const handleCloseTab = (tabId: string) => {
    const nextTabs = tabs.filter(t => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      setActiveTabId(nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].id : null);
    }
  };

  const handleChangeContent = (tabId: string, newContent: string) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, content: newContent, isDirty: true } : t));
  };

  const handleSelectSearchAction = (item: ActionItem) => {
    if (item.category === 'Files') {
      const match = files.flatMap(f => f.isFolder ? (f.children || []) : [f])
                         .find(f => f.name === item.title);
      if (match) handleFileSelect(match);
    } else if (item.title === 'Run Desktop IDE') {
      handleRun();
    } else if (item.title === 'Toggle Terminal') {
      setBottomTab('terminal');
      setIsBottomOpen(true);
    }
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1E1F22] text-[#DFE1E5] overflow-hidden">
      {/* Top Main Navigation Bar with Interactive Menus */}
      <TopBar
        projectName={projectName}
        gitBranch={currentBranch}
        isRunning={isRunning}
        recentProjects={recentProjects}
        onRun={handleRun}
        onStop={handleStop}
        onOpenSearch={() => setIsSearchOpen(true)}
        onSelectMenuAction={handleMenuAction}
        onOpenProjectDialog={handleOpenProject}
        onOpenBranches={() => setIsBranchesOpen(true)}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Activity Bar (Icon Stripe) */}
        <ActivityBar
          activeTab={isSideBarOpen ? activeSideTab : ''}
          onTabChange={(tabId) => {
            if (activeSideTab === tabId && isSideBarOpen) {
              setIsSideBarOpen(false);
            } else {
              setActiveSideTab(tabId);
              setIsSideBarOpen(true);
            }
          }}
        />

        {/* Left Tool Window (Project Tree) */}
        {isSideBarOpen && (
          <div 
            style={{ width: `${sideBarWidth}px` }} 
            className="h-full border-r border-[#393B40] flex-shrink-0 flex flex-col overflow-hidden"
          >
            {activeSideTab === 'project' && (
              <ProjectTree
                files={files}
                activeFileId={activeTabId}
                onFileSelect={handleFileSelect}
                onNewFile={() => setIsNewFileOpen(true)}
                onNewFolder={() => setIsNewFileOpen(true)}
                onShowToast={addToast}
              />
            )}
            {activeSideTab !== 'project' && (
              <div className="h-full bg-[#2B2D30] p-4 text-xs text-[#868A91]">
                Tool Window: <span className="text-[#DFE1E5] font-semibold">{activeSideTab}</span>
              </div>
            )}
          </div>
        )}

        {/* Center & Bottom: Editor and Tool Windows */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Monaco Editor Zone */}
          <div className="flex-1 min-h-0">
            <CodeEditor
              ref={codeEditorRef}
              tabs={tabs}
              activeTabId={activeTabId}
              settings={settings}
              isReadOnly={isReadOnly}
              onSelectTab={setActiveTabId}
              onCloseTab={handleCloseTab}
              onChangeContent={handleChangeContent}
              onCursorChange={(line, col) => setCursorPos({ line, col })}
              onShowToast={addToast}
            />
          </div>

          {/* Bottom Tool Window (Run / Terminal / Problems) */}
          {isBottomOpen && (
            <div 
              style={{ height: `${bottomHeight}px` }}
              className="border-t border-[#393B40] flex flex-col bg-[#1E1F22] flex-shrink-0"
            >
              {/* Bottom Tool Window Tabs Header */}
              <div className="h-7 bg-[#2B2D30] border-b border-[#393B40] px-2 flex items-center justify-between text-[11px] select-none">
                <div className="flex items-center gap-1 h-full">
                  <button
                    onClick={() => setBottomTab('run')}
                    className={`flex items-center gap-1.5 px-2.5 h-full transition-colors relative ${
                      bottomTab === 'run'
                        ? 'text-[#DFE1E5] font-medium bg-[#1E1F22]'
                        : 'text-[#868A91] hover:text-[#DFE1E5]'
                    }`}
                  >
                    {bottomTab === 'run' && (
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#3574F0]" />
                    )}
                    <PlaySquare size={13} className={isRunning ? 'text-[#3574F0] animate-spin' : 'text-[#59A869]'} />
                    <span>Run</span>
                  </button>

                  <button
                    onClick={() => setBottomTab('terminal')}
                    className={`flex items-center gap-1.5 px-2.5 h-full transition-colors relative ${
                      bottomTab === 'terminal'
                        ? 'text-[#DFE1E5] font-medium bg-[#1E1F22]'
                        : 'text-[#868A91] hover:text-[#DFE1E5]'
                    }`}
                  >
                    {bottomTab === 'terminal' && (
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#3574F0]" />
                    )}
                    <Terminal size={13} className="text-[#3574F0]" />
                    <span>Terminal</span>
                  </button>

                  <button
                    onClick={() => setBottomTab('problems')}
                    className={`flex items-center gap-1.5 px-2.5 h-full transition-colors relative ${
                      bottomTab === 'problems'
                        ? 'text-[#DFE1E5] font-medium bg-[#1E1F22]'
                        : 'text-[#868A91] hover:text-[#DFE1E5]'
                    }`}
                  >
                    {bottomTab === 'problems' && (
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#3574F0]" />
                    )}
                    <AlertCircle size={13} className="text-[#59A869]" />
                    <span>Problems (0)</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsBottomOpen(false)} 
                    title="Hide Window (Shift+Esc)"
                    className="text-[#868A91] hover:text-[#DFE1E5] px-1 py-0.5 rounded text-[10px]"
                  >
                    Hide ✕
                  </button>
                </div>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-hidden">
                {bottomTab === 'run' && (
                  <RunConsolePanel
                    logs={runLogs}
                    isRunning={isRunning}
                    onRerun={handleRun}
                    onStop={handleStop}
                    onClear={() => setRunLogs([])}
                  />
                )}
                {bottomTab === 'terminal' && (
                  <TerminalPanel />
                )}
                {bottomTab === 'problems' && (
                  <div className="h-full flex items-center justify-center text-xs text-[#868A91]">
                    No problems found in workspace. Code analysis clean.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Tool Window Activity Bar */}
        <RightActivityBar
          activeRightPanel={activeRightPanel}
          onToggleRightPanel={setActiveRightPanel}
          onShowToast={addToast}
        />
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        branch={currentBranch}
        cursorLine={cursorPos.line}
        cursorCol={cursorPos.col}
        encoding={fileEncoding}
        lineEnding={lineEnding}
        isIndexing={false}
        onOpenBranches={() => setIsBranchesOpen(true)}
        onShowToast={addToast}
      />

      {/* Search Everywhere (Shift+Shift) Modal */}
      <SearchEverywhereModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectAction={handleSelectSearchAction}
      />

      {/* About IntelliJ IDEA Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      {/* New File Creation Modal */}
      <NewFileModal
        isOpen={isNewFileOpen}
        onClose={() => setIsNewFileOpen(false)}
        onCreate={handleCreateNewFile}
      />

      {/* Settings Modal (Ctrl+Alt+S) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          setSettings(newSettings);
          try {
            localStorage.setItem('intellij_ide_settings', JSON.stringify(newSettings));
          } catch (e) {
            console.error('Failed to save settings to localStorage', e);
          }
          if (newSettings.projectOpenMode) {
            localStorage.setItem('ij_project_open_mode', newSettings.projectOpenMode);
          }
          addToast('Settings Saved', 'Applied custom editor & appearance preferences', 'success');
        }}
        onShowToast={(title, msg, type) => addToast(title, msg, type)}
      />

      {/* Go to Line Modal (Ctrl+G) */}
      <GoToLineModal
        isOpen={isGoToLineOpen}
        onClose={() => setIsGoToLineOpen(false)}
        maxLine={codeEditorRef.current?.getMaxLine() || 100}
        onGoToLine={handleGoToLine}
      />

      {/* Git Commit Modal (Ctrl+K) */}
      <GitCommitModal
        isOpen={isCommitOpen}
        onClose={() => setIsCommitOpen(false)}
        branch={currentBranch}
        onCommit={handleCommit}
      />

      {/* Git Branches Modal */}
      <GitBranchesModal
        isOpen={isBranchesOpen}
        onClose={() => setIsBranchesOpen(false)}
        currentBranch={currentBranch}
        onSwitchBranch={(b) => {
          setCurrentBranch(b);
          addToast('Switched Branch', `Checked out branch [${b}]`, 'info');
        }}
        onCreateBranch={(b) => {
          addToast('Branch Created', `Created and checked out [${b}]`, 'success');
        }}
      />

      {/* Rename Modal (Shift+F6) */}
      <RenameModal
        isOpen={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        currentName={activeTab?.title || ''}
        onRename={handleRenameActive}
      />

      {/* Tip of the Day Modal */}
      <TipOfTheDayModal
        isOpen={isTipOpen}
        onClose={() => setIsTipOpen(false)}
      />

      {/* Run Configurations Modal */}
      <RunConfigModal
        isOpen={isRunConfigOpen}
        onClose={() => setIsRunConfigOpen(false)}
        onSaveAndRun={(cfg) => {
          addToast('Configuration Updated', `Running '${cfg.name}': ${cfg.command} ${cfg.args}`, 'info');
          handleRun();
        }}
      />

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onCreateProject={async (name, cat, loc, createGit, addSampleCode) => {
          setProjectName(name);
          const fullDir = loc ? `${loc}\\${name}` : `D:\\IDE\\projects\\${name}`;
          const sampleId = `file-${Date.now()}`;
          let fileName = 'Main.java';
          let lang = 'java';
          let content = `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World from ${name}!");\n    }\n}\n`;
          let filesToCreate: [string, string][] = [];

          if (cat === 'rust') {
            fileName = 'main.rs';
            lang = 'rust';
            content = `fn main() {\n    println!("Hello, World from ${name}!");\n}\n`;
            filesToCreate = [
              ['src/main.rs', content],
              ['Cargo.toml', `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n`],
              ['.gitignore', '/target\nCargo.lock\n'],
            ];
          } else if (cat === 'python') {
            fileName = 'main.py';
            lang = 'python';
            content = `def main():\n    print("Hello from ${name}!")\n\nif __name__ == "__main__":\n    main()\n`;
            filesToCreate = [
              ['src/main.py', content],
              ['requirements.txt', '# Project dependencies\n'],
              ['.gitignore', '__pycache__/\n*.pyc\n.venv/\n'],
            ];
          } else if (cat === 'react') {
            fileName = 'App.tsx';
            lang = 'typescript';
            content = `import React from 'react';\n\nexport function App() {\n    return <h1>Hello from ${name}</h1>;\n}\n`;
            filesToCreate = [
              ['src/App.tsx', content],
              ['package.json', `{\n  "name": "${name}",\n  "private": true,\n  "version": "0.1.0"\n}\n`],
              ['.gitignore', 'node_modules/\ndist/\n'],
            ];
          } else if (cat === 'node') {
            fileName = 'index.js';
            lang = 'javascript';
            content = `console.log("Hello from ${name}!");\n`;
            filesToCreate = [
              ['src/index.js', content],
              ['package.json', `{\n  "name": "${name}",\n  "version": "1.0.0",\n  "main": "src/index.js"\n}\n`],
            ];
          } else if (cat === 'kotlin') {
            fileName = 'Main.kt';
            lang = 'kotlin';
            content = `fun main() {\n    println("Hello, World from ${name}!")\n}\n`;
            filesToCreate = [
              ['src/Main.kt', content],
            ];
          } else if (cat === 'html') {
            fileName = 'index.html';
            lang = 'html';
            content = `<!DOCTYPE html>\n<html>\n<head>\n  <title>${name}</title>\n</head>\n<body>\n  <h1>Welcome to ${name}</h1>\n</body>\n</html>\n`;
            filesToCreate = [
              ['index.html', content],
              ['style.css', '/* Styles */\nbody { margin: 0; }\n'],
            ];
          } else {
            // default java
            filesToCreate = [
              ['src/Main.java', content],
              ['.gitignore', '*.class\n*.jar\nout/\n'],
            ];
          }

          if (!addSampleCode) {
            filesToCreate = [['README.md', `# ${name}\n\nProject initialized.`]];
          }

          // Write to physical disk using Tauri Rust command
          try {
            if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
              await invoke('create_project_on_disk', {
                projectPath: fullDir,
                filesToCreate,
                initGit: createGit,
              });
            }
          } catch (err) {
            console.error('Failed to create project on disk:', err);
          }

          // Update ProjectTree files state
          const newProjectNode: FileNode = {
            id: `proj-${Date.now()}`,
            name,
            path: fullDir,
            isFolder: true,
            children: filesToCreate.map(([relPath, fileContent], idx) => {
              const parts = relPath.split('/');
              return {
                id: `proj-file-${idx}-${Date.now()}`,
                name: parts[parts.length - 1],
                path: `${fullDir}\\${relPath.replace(/\//g, '\\')}`,
                isFolder: false,
                language: lang,
                content: fileContent,
              };
            }),
          };
          saveRecentProject(name, fullDir);
          addToast('Project Created on Disk', `Created project files in ${fullDir}`, 'success');
          requestOpenProject(newProjectNode);
        }}
      />

      {/* Project Structure Modal (Ctrl+Alt+Shift+S) */}
      <ProjectStructureModal
        isOpen={isProjectStructureOpen}
        onClose={() => setIsProjectStructureOpen(false)}
        projectName={projectName}
        files={files}
        onSave={(newName) => {
          setProjectName(newName);
          addToast('Project Structure', `Updated project name to [${newName}]`, 'success');
        }}
        onShowToast={(title, message, type) => addToast(title, message, type)}
      />

      {/* Invalidate Caches Modal */}
      <InvalidateCachesModal
        isOpen={isInvalidateCachesOpen}
        onClose={() => setIsInvalidateCachesOpen(false)}
        onInvalidate={() => {
          addToast('Invalidating Caches', 'Caches cleared. Project index re-scanned in 120ms.', 'success');
        }}
      />

      {/* Local History Modal */}
      <LocalHistoryModal
        isOpen={isLocalHistoryOpen}
        onClose={() => setIsLocalHistoryOpen(false)}
        fileName={activeTab?.title || 'workspace'}
        currentContent={activeTab?.content || ''}
        onRevert={(revertedContent) => {
          if (activeTabId) {
            handleChangeContent(activeTabId, revertedContent);
            addToast('Local History Reverted', `Reverted ${activeTab?.title} to selected revision`, 'success');
          }
        }}
      />

      {/* Repair IDE Assistant Modal */}
      <RepairIdeModal
        isOpen={isRepairIdeOpen}
        onClose={() => setIsRepairIdeOpen(false)}
        onComplete={() => {
          addToast('IDE Repaired', 'Virtual File System and toolchains verified successfully', 'success');
        }}
      />

      {/* Open Project Confirmation / Choice Dialog (This Window / New Window / Attach) */}
      <OpenProjectDialog
        isOpen={isOpenProjectPromptOpen}
        onClose={() => {
          setIsOpenProjectPromptOpen(false);
          setPendingTargetProject(null);
        }}
        targetProject={pendingTargetProject}
        currentProjectName={projectName}
        hasRunningProcess={isRunning}
        dirtyFiles={tabs.filter(t => t.isDirty).map(t => t.title)}
        onOpenThisWindow={(target) => {
          if (isRunning) {
            handleStop();
          }
          if (tabs.some(t => t.isDirty)) {
            handleSaveActive();
          }
          loadProjectIntoIde(target);
        }}
        onOpenNewWindow={(target) => {
          handleOpenNewWindow(target);
        }}
        onAttachProject={(target) => {
          handleAttachProject(target);
        }}
      />

      {/* Toast Notification Balloon System */}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </div>
  );
};

export default App;
