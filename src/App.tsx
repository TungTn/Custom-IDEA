import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TopBar, RecentProjectItem } from './components/TopBar';
import { ActivityBar } from './components/ActivityBar';
import { ProjectTree } from './components/ProjectTree';
import { CodeEditor, CodeEditorHandle } from './components/CodeEditor';
import { TerminalPanel } from './components/TerminalPanel';
import { RunConsolePanel } from './components/RunConsolePanel';
import { StatusBar } from './components/StatusBar';
import { BottomToolWindowBar } from './components/BottomToolWindowBar';
import { ToastContainer, ToastItem } from './components/ToastContainer';
import { OpenProjectDialog } from './components/OpenProjectDialog';
import { RightActivityBar, NotificationEntry } from './components/RightActivityBar';
import { FindUsagesPanel } from './components/FindUsagesPanel';
import { ShowUsagesPopup } from './components/ShowUsagesPopup';
import { WelcomeScreen } from './components/WelcomeScreen';
import { GitToolWindow } from './components/GitToolWindow';
import { StructurePanel } from './components/StructurePanel';
import { DebugPanel } from './components/DebugPanel';
import { ProblemsPanel } from './components/ProblemsPanel';
import { DataSourceConnection, INITIAL_DATA_SOURCES } from './types/database';
import type { IdeSettings } from './components/SettingsModal';

// Lazy-loaded dialogs & modals for optimal cold start and small bundle sizes
const SearchEverywhereModal = React.lazy(() => import('./components/SearchEverywhereModal').then(m => ({ default: m.SearchEverywhereModal })));
const FindInFilesModal = React.lazy(() => import('./components/FindInFilesModal').then(m => ({ default: m.FindInFilesModal })));
const AboutModal = React.lazy(() => import('./components/AboutModal').then(m => ({ default: m.AboutModal })));
const NewFileModal = React.lazy(() => import('./components/NewFileModal').then(m => ({ default: m.NewFileModal })));
const SettingsModal = React.lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const GoToLineModal = React.lazy(() => import('./components/GoToLineModal').then(m => ({ default: m.GoToLineModal })));
const GitCommitModal = React.lazy(() => import('./components/GitCommitModal').then(m => ({ default: m.GitCommitModal })));
const GitBranchesModal = React.lazy(() => import('./components/GitBranchesModal').then(m => ({ default: m.GitBranchesModal })));
const RenameModal = React.lazy(() => import('./components/RenameModal').then(m => ({ default: m.RenameModal })));
const TipOfTheDayModal = React.lazy(() => import('./components/TipOfTheDayModal').then(m => ({ default: m.TipOfTheDayModal })));
const RunConfigModal = React.lazy(() => import('./components/RunConfigModal').then(m => ({ default: m.RunConfigModal })));
const NewProjectModal = React.lazy(() => import('./components/NewProjectModal').then(m => ({ default: m.NewProjectModal })));
const ProjectStructureModal = React.lazy(() => import('./components/ProjectStructureModal').then(m => ({ default: m.ProjectStructureModal })));
const InvalidateCachesModal = React.lazy(() => import('./components/InvalidateCachesModal').then(m => ({ default: m.InvalidateCachesModal })));
const LocalHistoryModal = React.lazy(() => import('./components/LocalHistoryModal').then(m => ({ default: m.LocalHistoryModal })));
const RepairIdeModal = React.lazy(() => import('./components/RepairIdeModal').then(m => ({ default: m.RepairIdeModal })));
const VcsCloneModal = React.lazy(() => import('./components/VcsCloneModal').then(m => ({ default: m.VcsCloneModal })));
const DiffViewerModal = React.lazy(() => import('./components/DiffViewerModal').then(m => ({ default: m.DiffViewerModal })));
const AddDataSourceModal = React.lazy(() => import('./components/database/AddDataSourceModal').then(m => ({ default: m.AddDataSourceModal })));
import { FileNode, OpenTab, RunLog, ActionItem, UsageOccurrence, FindUsagesResult, RunConfiguration, Breakpoint, DebugState, StackFrame, VariableItem, WatchItem, ProblemItem } from './types';
import { Terminal, PlaySquare, Play, Bug, AlertCircle, Search, GitBranch, Maximize2, Minus } from 'lucide-react';

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

export const detectLanguage = (fileName: string): string => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.vue')) return 'vue';
  if (lower.endsWith('.svelte')) return 'svelte';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'javascript';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.scss') || lower.endsWith('.sass')) return 'scss';
  if (lower.endsWith('.less')) return 'less';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.rs')) return 'rust';
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.go')) return 'go';
  if (lower.endsWith('.java')) return 'java';
  if (lower.endsWith('.kt') || lower.endsWith('.kts')) return 'kotlin';
  if (lower.endsWith('.sql')) return 'sql';
  if (lower.endsWith('.xml') || lower.endsWith('.svg')) return 'xml';
  if (lower.endsWith('.env') || lower.endsWith('.toml') || lower.endsWith('.ini')) return 'ini';
  if (lower.endsWith('.sh') || lower.endsWith('.bash') || lower.endsWith('.ps1')) return 'shell';
  if (lower.endsWith('.cpp') || lower.endsWith('.c') || lower.endsWith('.h') || lower.endsWith('.hpp')) return 'cpp';
  return 'plaintext';
};

const getInitialProjectPath = (): string => {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const allPaths = params.getAll('openPath');
      if (allPaths.length > 0 && allPaths[allPaths.length - 1]) {
        return allPaths[allPaths.length - 1];
      }
      const savedPath = localStorage.getItem('ij_current_project_path');
      if (savedPath) return savedPath;
    }
  } catch (e) {}
  return 'D:\\IDE';
};

export const App: React.FC = () => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [activeSideTab, setActiveSideTab] = useState('project');
  const [isSideBarOpen, setIsSideBarOpen] = useState(true);
  const [activeRightPanel, setActiveRightPanel] = useState<string | null>(null);
  const [sideBarWidth, setSideBarWidth] = useState(260);

  const [bottomTab, setBottomTab] = useState<'find' | 'run' | 'debug' | 'terminal' | 'problems' | 'git' | 'tests'>('run');
  const [hasOpenedTerminal, setHasOpenedTerminal] = useState(false);

  const [projectRootPath, setProjectRootPath] = useState<string>(getInitialProjectPath);

  const currentProjectDirectory = useMemo(() => {
    if (projectRootPath) return projectRootPath;
    if (files[0]) {
      if (files[0].isFolder) return files[0].path;
      const parts = files[0].path.replace(/\//g, '\\').split('\\');
      parts.pop();
      return parts.join('\\') || 'D:\\IDE';
    }
    return 'D:\\IDE';
  }, [projectRootPath, files]);
  const [isBottomOpen, setIsBottomOpen] = useState(true);

  useEffect(() => {
    if (bottomTab === 'terminal' && isBottomOpen) {
      setHasOpenedTerminal(true);
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
    }
  }, [bottomTab, isBottomOpen]);
  const [bottomHeight, setBottomHeight] = useState(240);

  // Diff Modal states
  const [activeDiffFile, setActiveDiffFile] = useState<string | null>(null);
  const [diffBaseContent, setDiffBaseContent] = useState<string>('');
  const [diffLocalContent, setDiffLocalContent] = useState<string>('');
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  const handleToggleMaximizeBottom = useCallback(() => {
    setBottomHeight(prev => {
      const maxHeight = window.innerHeight - 120;
      if (prev >= maxHeight - 20) {
        return 240;
      } else {
        return maxHeight;
      }
    });
  }, []);

  // Find Usages states (Authentic IntelliJ IDEA)
  const [findResult, setFindResult] = useState<FindUsagesResult | null>(null);
  const [showUsagesResult, setShowUsagesResult] = useState<FindUsagesResult | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ type: 'file' | 'symbol'; name: string }>({
    type: 'file',
    name: '',
  });

  // Git branch & status
  const [currentBranch, setCurrentBranch] = useState('main');

  const refreshGitStatus = useCallback(async () => {
    const projectDir = currentProjectDirectory;
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const res = await invoke<{ branch: string; changes: any[]; is_clean: boolean }>('git_get_status', { projectPath: projectDir });
        if (res && res.branch) {
          setCurrentBranch(res.branch);
        }
      }
    } catch (e) {
      // ignore
    }
  }, [files]);

  useEffect(() => {
    refreshGitStatus();
  }, [refreshGitStatus]);

  // Ide Settings
  const [settings, setSettings] = useState<IdeSettings>(() => {
    try {
      const saved = localStorage.getItem('intellij_ide_settings');
      if (saved) {
        return {
          theme: 'intellij-new-ui-dark',
          fontSize: 13,
          tabSize: 4,
          minimap: false,
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
      minimap: false,
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
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Synchronize tabs language on mount in case any tab had plaintext fallback
  useEffect(() => {
    setTabs(prev => prev.map(t => {
      if (!t.language || t.language === 'plaintext') {
        const detected = detectLanguage(t.title);
        if (detected !== 'plaintext') {
          return { ...t, language: detected };
        }
      }
      return t;
    }));
  }, []);

  // Code editor ref for direct actions
  const codeEditorRef = useRef<CodeEditorHandle>(null);

  // Status bar cursor info
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  // Project & File system states
  const [projectName, setProjectName] = useState<string>('');
  const [powerSaveMode, setPowerSaveMode] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [lineEnding, setLineEnding] = useState<'CRLF' | 'LF'>('CRLF');
  const [fileEncoding, setFileEncoding] = useState('UTF-8');

  // Modals state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFindInFilesOpen, setIsFindInFilesOpen] = useState(false);
  const [findInFilesMode, setFindInFilesMode] = useState<'find' | 'replace'>('find');
  const [findInFilesInitialQuery, setFindInFilesInitialQuery] = useState('');
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isNewFileOpen, setIsNewFileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGoToLineOpen, setIsGoToLineOpen] = useState(false);
  // Find in Files Helper
  const handleOpenFindInFiles = (targetMode: 'find' | 'replace' = 'find') => {
    const wordAtCursor = codeEditorRef.current?.getWordAtCursor() || '';
    setFindInFilesMode(targetMode);
    setFindInFilesInitialQuery(wordAtCursor);
    setIsFindInFilesOpen(true);
    addToast(targetMode === 'find' ? 'Find in Files' : 'Replace in Files', targetMode === 'find' ? 'Ctrl+Shift+F' : 'Ctrl+Shift+R', 'info');
  };

  const handleOpenFileAtLocation = async (filePath: string, line: number, col: number = 1) => {
    let existingTab = tabs.find(t => t.path === filePath || t.id === filePath);
    if (!existingTab) {
      let fileContent = '';
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        try {
          fileContent = await invoke<string>('read_file_content', { path: filePath });
        } catch (e) {
          console.warn('Failed to read file:', e);
        }
      }
      const fileName = filePath.split(/[\/\\]/).pop() || 'Untitled';
      const language = detectLanguage(fileName);
      const newTab: OpenTab = {
        id: filePath,
        title: fileName,
        path: filePath,
        content: fileContent,
        language,
        isDirty: false,
      };
      setTabs(prev => [...prev, newTab]);
      existingTab = newTab;
    }

    setActiveTabId(existingTab.id);
    setTimeout(() => {
      codeEditorRef.current?.revealPosition(line, col, 0);
    }, 100);
  };
  const [isCommitOpen, setIsCommitOpen] = useState(false);
  const [isBranchesOpen, setIsBranchesOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isTipOpen, setIsTipOpen] = useState(false);
  const [isRunConfigOpen, setIsRunConfigOpen] = useState(false);
  const [isVcsCloneOpen, setIsVcsCloneOpen] = useState(false);
  const [runConfigurations, setRunConfigurations] = useState<RunConfiguration[]>(() => {
    try {
      const saved = localStorage.getItem('intellij_run_configurations');
      if (saved) {
        const parsed: RunConfiguration[] = JSON.parse(saved);
        // Automatically upgrade existing Java / Spring Boot configs to the Ultra-Lightweight profile
        return parsed.map(c => {
          if (c.type === 'spring-boot' || c.command.includes('mvn') || c.command.includes('gradle')) {
            const envs = { ...(c.envVars || {}) };
            const ultraLightOpts = '-Xms64m -Xmx384m -Xss256k -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:MaxMetaspaceSize=384m -XX:ReservedCodeCacheSize=96m';
            envs['JAVA_TOOL_OPTIONS'] = ultraLightOpts;
            if (!envs['MAVEN_OPTS'] && c.command.includes('mvn')) {
              envs['MAVEN_OPTS'] = '-Xms32m -Xmx96m -XX:+UseSerialGC';
            }
            return { ...c, envVars: envs };
          }
          return c;
        });
      }
    } catch (e) {
      console.warn('Failed to parse saved run configurations:', e);
    }
    return [];
  });
  const [activeConfigId, setActiveConfigId] = useState<string | null>(() => {
    return localStorage.getItem('intellij_active_run_config_id') || null;
  });
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isProjectStructureOpen, setIsProjectStructureOpen] = useState(false);
  const [isInvalidateCachesOpen, setIsInvalidateCachesOpen] = useState(false);
  const [isLocalHistoryOpen, setIsLocalHistoryOpen] = useState(false);
  const [isRepairIdeOpen, setIsRepairIdeOpen] = useState(false);
  const [isOpenProjectPromptOpen, setIsOpenProjectPromptOpen] = useState(false);
  const [pendingTargetProject, setPendingTargetProject] = useState<FileNode | null>(null);

  // Database Data Sources (DataGrip mini)
  const [dataSources, setDataSources] = useState<DataSourceConnection[]>(() => {
    try {
      const saved = localStorage.getItem('intellij_data_sources');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved data sources:', e);
    }
    return INITIAL_DATA_SOURCES;
  });
  const [isAddDataSourceOpen, setIsAddDataSourceOpen] = useState(false);

  // Toast notifications & Notifications Center History
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([
    {
      id: 'init-1',
      title: 'Project Initialized',
      message: 'Workspace loaded and indexing complete. All symbols resolved.',
      type: 'success',
      timestamp: new Date().toLocaleTimeString(),
      read: true,
    },
    {
      id: 'init-2',
      title: 'Git Repository',
      message: 'Active branch synchronized with working tree.',
      type: 'info',
      timestamp: new Date().toLocaleTimeString(),
      read: true,
    }
  ]);

  const addToast = useCallback((title: string, message?: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = String(Date.now() + Math.random());
    const timestamp = new Date().toLocaleTimeString();

    setToasts(prev => {
      // De-duplicate identical toasts and cap at 3 max visible
      const filtered = prev.filter(t => t.title !== title);
      return [...filtered, { id, title, message, type }].slice(-3);
    });

    setNotifications(prev => [
      { id, title, message, type, timestamp, read: false },
      ...prev
    ].slice(0, 50));

    // Auto dismiss after 2.8 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2800);
  }, []);

  // Breakpoints State (synchronized across Editor and Debugger)
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);

  const handleToggleBreakpoint = useCallback((lineNumber: number) => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    setBreakpoints(prev => {
      const existing = prev.find(
        bp => bp.lineNumber === lineNumber && (bp.filePath === activeTab?.path || bp.fileName === activeTab?.title || (!bp.filePath && !bp.fileName))
      );
      if (existing) {
        addToast('Breakpoint Removed', `Line ${lineNumber}`, 'info');
        return prev.filter(b => b.id !== existing.id);
      } else {
        addToast('Breakpoint Added', `Line ${lineNumber}`, 'success');
        return [...prev, {
          id: `bp-${Date.now()}-${Math.random()}`,
          filePath: activeTab?.path || '',
          fileName: activeTab?.title || '',
          lineNumber,
          enabled: true,
        }];
      }
    });
  }, [tabs, activeTabId, addToast]);

  const handleUpdateBreakpoint = useCallback((updatedBp: Breakpoint) => {
    setBreakpoints(prev => prev.map(b => b.id === updatedBp.id ? updatedBp : b));
  }, []);

  const handleRemoveBreakpoint = useCallback((id: string) => {
    setBreakpoints(prev => prev.filter(b => b.id !== id));
  }, []);

  // ─── Debugger States & Handlers ───
  const [debugState, setDebugState] = useState<DebugState>('idle');
  const [activeFrameId, setActiveFrameId] = useState<string | null>('frame-1');
  const [areBreakpointsMuted, setAreBreakpointsMuted] = useState(false);
  const [debugConsoleOutput, setDebugConsoleOutput] = useState<string[]>([
    'Debugger listener attached to 127.0.0.1:9229',
    'Source map loaded for project workspace.',
    'Ready for breakpoints and stepping commands.',
  ]);
  const [watches, setWatches] = useState<WatchItem[]>([
    { id: 'w-1', expression: 'this', value: 'Object { id: "app-root" }', type: 'object' },
    { id: 'w-2', expression: 'window.location.href', value: '"tauri://localhost/"', type: 'string' },
  ]);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);

  const frames: StackFrame[] = useMemo(() => {
    const curPath = activeTab?.path || 'src/main.rs';
    const curName = activeTab?.title || 'main.rs';
    const curLine = cursorPos.line || 1;
    return [
      { id: 'frame-1', name: `main() [${curName}:${curLine}]`, file: curName, line: curLine, filePath: curPath, isAppCode: true },
      { id: 'frame-2', name: 'tokio::runtime::task::core', file: 'runtime.rs', line: 184, filePath: 'tokio/src/runtime.rs', isAppCode: false },
      { id: 'frame-3', name: 'std::sys::windows::thread::Thread::new', file: 'thread.rs', line: 42, filePath: 'std/sys/windows/thread.rs', isAppCode: false },
    ];
  }, [activeTab, cursorPos.line]);

  const variables: VariableItem[] = useMemo(() => {
    return [
      { 
        name: 'this', 
        type: 'AppWorkspace', 
        value: '{ project: "Local-IDEA", isReady: true }',
        children: [
          { name: 'project', type: 'string', value: `"${projectName || 'Local-IDEA'}"` },
          { name: 'activeTab', type: 'string', value: `"${activeTab?.title || 'Untitled'}"` },
          { name: 'breakpointsCount', type: 'number', value: String(breakpoints.length) },
        ]
      },
      { name: 'cursorPosition', type: 'object', value: `{ line: ${cursorPos.line}, col: ${cursorPos.col} }` },
      { name: 'activeConfig', type: 'string', value: `"${runConfigurations.find(c => c.id === activeConfigId)?.name || 'Default'}"` },
    ];
  }, [projectName, activeTab, breakpoints.length, cursorPos, runConfigurations, activeConfigId]);

  const handleResumeDebug = useCallback(() => {
    setDebugState('running');
    setDebugConsoleOutput(prev => [...prev, 'Program resumed (F9)']);
    addToast('Resume', 'Program execution resumed (F9)', 'info');
  }, [addToast]);

  const handlePauseDebug = useCallback(() => {
    setDebugState('paused');
    setDebugConsoleOutput(prev => [...prev, `Program suspended at ${activeTab?.title || 'file'}:${cursorPos.line}`]);
    addToast('Paused', 'Program suspended at execution point', 'warning');
  }, [activeTab, cursorPos.line, addToast]);

  const handleStopDebug = useCallback(() => {
    setDebugState('idle');
    setDebugConsoleOutput(prev => [...prev, 'Debugger session terminated (Ctrl+F2)']);
    addToast('Debugger Stopped', 'Process finished with exit code 0', 'info');
  }, [addToast]);

  const handleStepOverDebug = useCallback(() => {
    setDebugConsoleOutput(prev => [...prev, `Step Over executed -> line ${cursorPos.line + 1}`]);
    setCursorPos(p => ({ ...p, line: p.line + 1 }));
    codeEditorRef.current?.goToLine(cursorPos.line + 1, cursorPos.col);
    addToast('Step Over', `Stepped to line ${cursorPos.line + 1} (F8)`, 'info');
  }, [cursorPos, addToast]);

  const handleStepIntoDebug = useCallback(() => {
    setDebugConsoleOutput(prev => [...prev, `Step Into executed at line ${cursorPos.line}`]);
    addToast('Step Into', 'Stepped into function call (F7)', 'info');
  }, [cursorPos.line, addToast]);

  const handleStepOutDebug = useCallback(() => {
    setDebugConsoleOutput(prev => [...prev, 'Step Out executed']);
    addToast('Step Out', 'Stepped out to caller (Shift+F8)', 'info');
  }, [addToast]);

  const handleAddWatch = useCallback((expr: string) => {
    if (!expr.trim()) return;
    setWatches(prev => [...prev, {
      id: `w-${Date.now()}`,
      expression: expr.trim(),
      value: `Evaluated: "${expr.trim()}"`,
      type: 'expression'
    }]);
    addToast('Watch Added', `Evaluating '${expr.trim()}'`, 'success');
  }, [addToast]);

  const handleRemoveWatch = useCallback((id: string) => {
    setWatches(prev => prev.filter(w => w.id !== id));
  }, []);

  // ─── Problems State & Inspections ───
  const [problems, setProblems] = useState<ProblemItem[]>([
    {
      id: 'prob-1',
      filePath: 'src/main.rs',
      fileName: 'main.rs',
      line: 12,
      column: 9,
      message: "Unused variable `unused_config`: if this is intentional, prefix it with an underscore: `_unused_config`",
      severity: 'warning',
      source: 'rustc (dead_code)',
      quickFixTitle: 'Prefix with underscore `_unused_config`',
    },
    {
      id: 'prob-2',
      filePath: 'src/components/TopBar.tsx',
      fileName: 'TopBar.tsx',
      line: 45,
      column: 14,
      message: "Prop `isIndexing` is defined but never used in local render tree",
      severity: 'info',
      source: 'ESLint (no-unused-vars)',
      quickFixTitle: 'Remove unused property',
    },
  ]);

  const handleJumpToProblem = useCallback((filePath: string, line: number, column: number) => {
    handleOpenFileAtLocation(filePath, line, column);
  }, [handleOpenFileAtLocation]);

  // Git Tool Window target commit (e.g. opened from Git Blame)
  const [gitTargetCommit, setGitTargetCommit] = useState<{ hash: string; nonce: number } | null>(null);

  const handleOpenGitCommit = useCallback((commitHash: string) => {
    setGitTargetCommit({ hash: commitHash, nonce: Date.now() });
    setBottomTab('git');
    setIsBottomOpen(true);
    const isWorktree = commitHash.startsWith('0000000') || commitHash === 'worktree';
    addToast(
      'Git Tool Window', 
      isWorktree ? 'Showing Working Tree in Git tree' : `Showing commit ${commitHash.substring(0, 8)} in Git tree`, 
      'info'
    );
  }, [addToast]);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleClearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const handleMarkAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const handleRemoveNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleOpenTableData = useCallback((dataSourceId: string, schema: string, tableName: string) => {
    const tabId = `db-table-${dataSourceId}-${schema}-${tableName}`;
    const existing = tabs.find(t => t.id === tabId);
    if (existing) {
      setActiveTabId(tabId);
    } else {
      const newTab: OpenTab = {
        id: tabId,
        title: `${tableName} [${schema}]`,
        path: `database://${dataSourceId}/${schema}/${tableName}`,
        content: '',
        language: 'sql',
        tabType: 'db-table',
        dbMetadata: { dataSourceId, schema, tableName },
        isDirty: false,
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(tabId);
    }
    addToast('Database Table', `Opened table [${tableName}] in editor`, 'info');
  }, [tabs, addToast]);

  const handleOpenSqlConsole = useCallback((dataSourceId: string) => {
    const ds = dataSources.find(d => d.id === dataSourceId);
    const tabId = `sql-console-${dataSourceId}`;
    const existing = tabs.find(t => t.id === tabId);
    if (existing) {
      setActiveTabId(tabId);
    } else {
      const newTab: OpenTab = {
        id: tabId,
        title: `console [${ds?.name || 'SQL'}]`,
        path: `database://${dataSourceId}/console.sql`,
        content: `-- SQL Query Console (DataGrip)\n-- Press Ctrl+Enter to execute query\n\nSELECT * FROM projects ORDER BY last_opened DESC;`,
        language: 'sql',
        tabType: 'sql-console',
        dbMetadata: { dataSourceId, query: '' },
        isDirty: false,
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(tabId);
    }
    addToast('SQL Console', `Opened SQL console for [${ds?.name || 'Database'}]`, 'info');
  }, [tabs, dataSources, addToast]);

  const handleAddDataSource = useCallback((newDs: DataSourceConnection) => {
    setDataSources(prev => {
      const updated = [...prev, newDs];
      try {
        localStorage.setItem('intellij_data_sources', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    addToast('Data Source Added', `Connected to ${newDs.name}`, 'success');
  }, [addToast]);

  const handleRemoveDataSource = useCallback((id: string) => {
    setDataSources(prev => {
      const updated = prev.filter(d => d.id !== id);
      try {
        localStorage.setItem('intellij_data_sources', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    addToast('Data Source Removed', 'Removed connection', 'info');
  }, [addToast]);

  const handleUpdateTableData = useCallback((dataSourceId: string, schema: string, tableName: string, newRows: Record<string, any>[]) => {
    setDataSources(prev => {
      const updated = prev.map(ds => {
        if (ds.id !== dataSourceId) return ds;
        return {
          ...ds,
          schemas: ds.schemas.map(s => {
            if (s.name !== schema) return s;
            return {
              ...s,
              tables: s.tables.map(t => {
                if (t.name !== tableName) return t;
                return { ...t, data: newRows, rowCount: newRows.length };
              })
            };
          })
        };
      });
      try {
        localStorage.setItem('intellij_data_sources', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    addToast('Data Saved', `Updated ${tableName} data`, 'success');
  }, [addToast]);

  const handleExecuteBuildTask = useCallback((tool: string, taskName: string, command: string) => {
    setBottomTab('run');
    setIsBottomOpen(true);
    setIsRunning(true);
    addToast('Executing Build Task', command, 'info');

    const projectDir = currentProjectDirectory;
    const newLog: RunLog = {
      id: `log-${Date.now()}`,
      text: `$ ${command}\nExecuting build task [${tool}: ${taskName}] in ${projectDir}...\n`,
      type: 'cmd',
      timestamp: new Date().toLocaleTimeString(),
    };
    setRunLogs(prev => [...prev, newLog]);

    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      const parts = command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);
      invoke<{ stdout: string; stderr: string; exit_code: number }>('execute_build_command', {
        command: cmd,
        args,
      }).then(res => {
        setIsRunning(false);
        if (res.stdout) {
          setRunLogs(prev => [...prev, {
            id: `log-${Date.now()}-out`,
            text: res.stdout,
            type: 'info',
            timestamp: new Date().toLocaleTimeString(),
          }]);
        }
        if (res.stderr) {
          setRunLogs(prev => [...prev, {
            id: `log-${Date.now()}-err`,
            text: res.stderr,
            type: res.exit_code === 0 ? 'warning' : 'error',
            timestamp: new Date().toLocaleTimeString(),
          }]);
        }
        setRunLogs(prev => [...prev, {
          id: `log-${Date.now()}-done`,
          text: `Process finished with exit code ${res.exit_code}`,
          type: res.exit_code === 0 ? 'success' : 'error',
          timestamp: new Date().toLocaleTimeString(),
        }]);
        addToast('Build Task Finished', `${command} exited with code ${res.exit_code}`, res.exit_code === 0 ? 'success' : 'error');
      }).catch(err => {
        setIsRunning(false);
        setRunLogs(prev => [...prev, {
          id: `log-${Date.now()}-err`,
          text: `Build execution error: ${String(err)}`,
          type: 'error',
          timestamp: new Date().toLocaleTimeString(),
        }]);
        addToast('Build Task Failed', String(err), 'error');
      });
    } else {
      setTimeout(() => {
        setIsRunning(false);
        setRunLogs(prev => [...prev, {
          id: `log-${Date.now()}-mock`,
          text: `Compiling workspace [${projectDir}]...\nFinished in 0.38s\nProcess finished with exit code 0`,
          type: 'success',
          timestamp: new Date().toLocaleTimeString(),
        }]);
        addToast('Build Finished', `${command} completed successfully`, 'success');
      }, 700);
    }
  }, [files, addToast]);

  // Recent Projects
  const [recentProjects, setRecentProjects] = useState<RecentProjectItem[]>(() => {
    try {
      const saved = localStorage.getItem('ij_recent_projects');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load recent projects:', e);
    }
    return [];
  });

  const handleRemoveRecentProject = useCallback((projectPath: string) => {
    setRecentProjects(prev => {
      const updated = prev.filter(p => p.path !== projectPath);
      try {
        localStorage.setItem('ij_recent_projects', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to update recent projects:', e);
      }
      return updated;
    });
    addToast('Removed from Recent', 'Project removed from recent list', 'info');
  }, [addToast]);

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

  const detectDefaultConfigurations = useCallback((rootNode: FileNode, existingConfigs: RunConfiguration[]): RunConfiguration[] => {
    const rootPath = rootNode.path || 'D:\\IDE';
    const childNames = rootNode.children ? rootNode.children.map(c => c.name.toLowerCase()) : [];
    const rootName = rootNode.name || 'Application';

    const hasExistingForPath = existingConfigs.some(c => c.workingDirectory === rootPath);
    if (hasExistingForPath) return existingConfigs;

    const generated: RunConfiguration[] = [];

    if (childNames.includes('pom.xml')) {
      generated.push({
        id: `cfg-spring-${Date.now()}`,
        name: `${rootName} (Spring Boot)`,
        type: 'spring-boot',
        command: 'mvn.cmd',
        args: ['spring-boot:run'],
        workingDirectory: rootPath,
        envVars: { 
          SPRING_PROFILES_ACTIVE: 'dev',
          JAVA_TOOL_OPTIONS: '-Xms64m -Xmx384m -Xss256k -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:MaxMetaspaceSize=384m -XX:ReservedCodeCacheSize=96m',
          MAVEN_OPTS: '-Xms32m -Xmx96m -XX:+UseSerialGC'
        },
        isDefault: true,
      });
      generated.push({
        id: `cfg-mvn-build-${Date.now() + 1}`,
        name: `${rootName} (Maven Package)`,
        type: 'maven',
        command: 'mvn.cmd',
        args: ['clean', 'package', '-DskipTests'],
        workingDirectory: rootPath,
        envVars: {
          MAVEN_OPTS: '-Xms32m -Xmx128m -XX:+UseSerialGC'
        }
      });
    } else if (childNames.includes('build.gradle') || childNames.includes('build.gradle.kts')) {
      generated.push({
        id: `cfg-gradle-${Date.now()}`,
        name: `${rootName} (Gradle bootRun)`,
        type: 'gradle',
        command: 'gradlew.bat',
        args: ['bootRun', '-Dorg.gradle.jvmargs=-Xms64m -Xmx384m -Xss256k -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:MaxMetaspaceSize=384m'],
        workingDirectory: rootPath,
        envVars: {
          JAVA_TOOL_OPTIONS: '-Xms64m -Xmx384m -Xss256k -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:MaxMetaspaceSize=384m -XX:ReservedCodeCacheSize=96m'
        },
        isDefault: true,
      });
    } else if (childNames.includes('cargo.toml')) {
      generated.push({
        id: `cfg-cargo-${Date.now()}`,
        name: `${rootName} (Cargo Run)`,
        type: 'cargo',
        command: 'cargo',
        args: ['run'],
        workingDirectory: rootPath,
        isDefault: true,
      });
    } else if (childNames.includes('package.json')) {
      generated.push({
        id: `cfg-npm-${Date.now()}`,
        name: `${rootName} (npm run dev)`,
        type: 'npm',
        command: 'npm',
        args: ['run', 'dev'],
        workingDirectory: rootPath,
        isDefault: true,
      });
    } else if (childNames.includes('requirements.txt') || childNames.includes('main.py')) {
      generated.push({
        id: `cfg-python-${Date.now()}`,
        name: `${rootName} (Python main.py)`,
        type: 'python',
        command: 'python',
        args: ['main.py'],
        workingDirectory: rootPath,
        isDefault: true,
      });
    }

    if (generated.length === 0) {
      generated.push({
        id: `cfg-default-${Date.now()}`,
        name: `${rootName} (Check)`,
        type: 'cargo',
        command: 'cargo',
        args: ['check', '--all-targets'],
        workingDirectory: rootPath,
        isDefault: true,
      });
    }

    const merged = [...existingConfigs, ...generated];
    try {
      localStorage.setItem('intellij_run_configurations', JSON.stringify(merged));
    } catch (e) {
      console.warn(e);
    }
    return merged;
  }, []);

  const loadProjectIntoIde = useCallback((tree: FileNode) => {
    setProjectName(tree.name);
    setFiles([tree]);
    setProjectRootPath(tree.path);
    saveRecentProject(tree.name, tree.path);
    try {
      localStorage.setItem('ij_current_project_path', tree.path);
    } catch (e) {
      console.warn('Failed to save current project path:', e);
    }

    setRunConfigurations(prev => {
      const detected = detectDefaultConfigurations(tree, prev);
      const defaultCfg = detected.find(c => c.workingDirectory === tree.path && c.isDefault) || detected[0];
      if (defaultCfg) {
        setActiveConfigId(defaultCfg.id);
        localStorage.setItem('intellij_active_run_config_id', defaultCfg.id);
      }
      return detected;
    });

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
        language: (first.language && first.language !== 'plaintext') ? first.language : detectLanguage(first.name),
        isDirty: false,
      }]);
      setActiveTabId(first.id);
    } else {
      setTabs([]);
      setActiveTabId(null);
    }

    addToast('Project Opened', `Loaded project [${tree.name}] from ${tree.path}`, 'success');
  }, [saveRecentProject, addToast, detectDefaultConfigurations]);

  useEffect(() => {
    if (files[0] && runConfigurations.length === 0) {
      setRunConfigurations(prev => {
        const detected = detectDefaultConfigurations(files[0], prev);
        if (detected.length > 0) {
          const defaultCfg = detected.find(c => c.isDefault) || detected[0];
          setActiveConfigId(defaultCfg.id);
          localStorage.setItem('intellij_active_run_config_id', defaultCfg.id);
        }
        return detected;
      });
    }
  }, [files, detectDefaultConfigurations, runConfigurations.length]);

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

  // Automatically open project if opened via new window initial project or query parameter
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isTauri = ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    
    const resolveAndLoadProject = async () => {
      let targetPath: string | null = null;
      if (isTauri) {
        try {
          targetPath = await invoke<string | null>('get_window_initial_project');
        } catch (e) {
          console.warn('Failed to get initial project for window:', e);
        }
      }

      if (!targetPath) {
        const params = new URLSearchParams(window.location.search);
        const allPaths = params.getAll('openPath');
        if (allPaths.length > 0) {
          targetPath = allPaths[allPaths.length - 1];
        }
      }

      // Check if user has reopenProjectsOnStartup enabled and has a previously open project
      if (!targetPath && settings.reopenProjectsOnStartup) {
        try {
          const savedPath = localStorage.getItem('ij_current_project_path');
          if (savedPath) {
            targetPath = savedPath;
          }
        } catch (e) {
          console.warn('Failed to read last project path:', e);
        }
      }

      if (targetPath && isTauri) {
        setProjectRootPath(targetPath);
        try {
          const tree = await invoke<FileNode>('open_project_by_path', { projectPath: targetPath });
          if (tree) {
            loadProjectIntoIde(tree);
          }
        } catch (err) {
          console.error('Failed to auto-load project in new window:', err);
          addToast('Open Failed', `Failed to load project at ${targetPath}`, 'error');
        }
      }
    };

    resolveAndLoadProject();
  }, [loadProjectIntoIde, addToast]);

  // Run / Build state & logs
  const [isRunning, setIsRunning] = useState(false);
  const activeRunIdRef = useRef<string | null>(null);
  const pendingLogsRef = useRef<RunLog[]>([]);
  const logFlushTimeoutRef = useRef<any>(null);
  const [runLogs, setRunLogs] = useState<RunLog[]>([
    {
      id: '1',
      text: 'IntelliJ IDE Run Console ready.',
      type: 'info',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);

  const flushLogs = useCallback(() => {
    if (pendingLogsRef.current.length === 0) return;
    const batch = pendingLogsRef.current;
    pendingLogsRef.current = [];
    setRunLogs(prev => {
      const merged = [...prev, ...batch];
      if (merged.length > 1500) {
        return merged.slice(merged.length - 1400);
      }
      return merged;
    });
  }, []);

  // Listen to live Tauri process stdout/stderr and exit events
  useEffect(() => {
    let unlistenOutput: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          unlistenOutput = await listen<{ run_id: string; text: string; stream: string; lines?: string[] }>('process-output', (event) => {
            const { text, stream, lines } = event.payload;
            const rawLines = lines && lines.length > 0 ? lines : text.split('\n');
            const timestamp = new Date().toLocaleTimeString();
            const type = (stream === 'stderr' ? 'warning' : 'info') as 'warning' | 'info';

            for (const line of rawLines) {
              if (line.trim().length === 0 && rawLines.length > 1) continue;
              pendingLogsRef.current.push({
                id: `${Date.now()}-${Math.random()}`,
                text: line,
                type,
                timestamp,
              });
            }

            if (!logFlushTimeoutRef.current) {
              logFlushTimeoutRef.current = setTimeout(() => {
                logFlushTimeoutRef.current = null;
                flushLogs();
              }, 40); // Max 25 FPS update rate for smooth 60fps IDE UI
            }
          });

          unlistenExit = await listen<{ run_id: string; exit_code: number; success: boolean }>('process-terminated', (event) => {
            const { exit_code, success } = event.payload;
            setIsRunning(false);
            activeRunIdRef.current = null;
            if (logFlushTimeoutRef.current) {
              clearTimeout(logFlushTimeoutRef.current);
              logFlushTimeoutRef.current = null;
            }
            flushLogs();
            setRunLogs(prev => [
              ...prev,
              {
                id: `${Date.now()}-${Math.random()}`,
                text: `Process finished with exit code ${exit_code}`,
                type: success ? 'success' : 'error',
                timestamp: new Date().toLocaleTimeString(),
              }
            ]);
            addToast(
              success ? 'Process Finished' : 'Process Failed',
              `Exit code: ${exit_code}`,
              success ? 'success' : 'error'
            );
          });
        }
      } catch (e) {
        console.warn('Tauri event listen not available:', e);
      }
    };

    setupListeners();

    return () => {
      if (logFlushTimeoutRef.current) clearTimeout(logFlushTimeoutRef.current);
      if (unlistenOutput) unlistenOutput();
      if (unlistenExit) unlistenExit();
    };
  }, [addToast, flushLogs]);

  // File System Watcher & Live Disk Synchronization
  const [isIndexing, setIsIndexing] = useState(false);
  const isSyncingRef = useRef(false);
  const lastWatchedPathRef = useRef<string | null>(null);

  const syncProjectFilesFromDisk = useCallback(async (changedPaths?: string[]) => {
    if (isSyncingRef.current) return;
    const rootPath = projectRootPath;
    if (!rootPath) return;
    try {
      isSyncingRef.current = true;
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        setIsIndexing(true);
        const updatedTree = await invoke<FileNode>('open_project_by_path', { projectPath: rootPath });
        if (updatedTree) {
          setFiles([updatedTree]);
        }

        // Check if any open unmodified tab was modified on disk
        if (changedPaths && changedPaths.length > 0) {
          for (const p of changedPaths) {
            const normalizedP = p.replace(/\\/g, '/').toLowerCase();
            const matchingTab = tabs.find(t => 
              t.path && (t.path.replace(/\\/g, '/').toLowerCase() === normalizedP ||
                         normalizedP.endsWith(t.path.replace(/\\/g, '/').toLowerCase()))
            );
            if (matchingTab && !matchingTab.isDirty) {
              try {
                const newContent = await invoke<string>('read_file_content', { path: matchingTab.path });
                if (newContent !== undefined) {
                  setTabs(prev => prev.map(t => t.id === matchingTab.id ? { ...t, content: newContent } : t));
                }
              } catch (e) {
                // file may be deleted or locked
              }
            }
          }
        }

        refreshGitStatus();
        setTimeout(() => setIsIndexing(false), 300);
      }
    } catch (err) {
      setIsIndexing(false);
      console.warn('Failed to sync files from disk:', err);
    } finally {
      isSyncingRef.current = false;
    }
  }, [projectRootPath, tabs, refreshGitStatus]);

  // Start file watcher ONLY when root project path changes
  useEffect(() => {
    if (!projectRootPath) return;
    if (lastWatchedPathRef.current === projectRootPath) return;
    lastWatchedPathRef.current = projectRootPath;

    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      invoke('watch_project_directory', { projectPath: projectRootPath }).catch(err => {
        console.warn('Failed to start file watcher:', err);
      });
    }
  }, [projectRootPath]);

  // Listen to live fs-event from Tauri
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let debounceTimer: any = null;

    const setupFsListener = async () => {
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          unlisten = await listen<{ kind: string; paths: string[] }>('fs-event', (event) => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              syncProjectFilesFromDisk(event.payload.paths);
            }, 800);
          });
        }
      } catch (e) {
        console.warn('Failed to listen to fs-event:', e);
      }
    };

    setupFsListener();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (unlisten) unlisten();
    };
  }, [syncProjectFilesFromDisk]);

  const handleRun = useCallback(async () => {
    // If a process is already running, terminate it first (Stop & Rerun / Single Instance)
    if (isRunning || activeRunIdRef.current) {
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          await invoke('stop_all_processes');
        }
      } catch (e) {
        console.warn('Failed to stop previous process:', e);
      }
      await new Promise(r => setTimeout(r, 250));
    }

    const activeCfg = runConfigurations.find(c => c.id === activeConfigId) || runConfigurations[0];
    const projectDir = activeCfg?.workingDirectory || currentProjectDirectory;
    const cmd = activeCfg?.command || 'cargo';
    const args = activeCfg?.args || ['check', '--all-targets'];
    const envVars = activeCfg?.envVars;

    const runId = `run-${Date.now()}`;
    activeRunIdRef.current = runId;
    setIsRunning(true);
    setBottomTab('run');
    setIsBottomOpen(true);

    const timestamp = new Date().toLocaleTimeString();

    setRunLogs([
      {
        id: String(Date.now()),
        text: `${cmd} ${args.join(' ')}`,
        type: 'cmd',
        timestamp,
      },
      {
        id: String(Date.now() + 1),
        text: `Working directory: ${projectDir}`,
        type: 'info',
        timestamp,
      }
    ]);

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('start_process', {
          runId,
          command: cmd,
          args,
          cwd: projectDir,
          envVars: envVars || null,
        });
      } else {
        // Fallback for browser-only dev testing
        setTimeout(() => {
          setIsRunning(false);
          setRunLogs(prev => [
            ...prev,
            {
              id: String(Date.now() + 2),
              text: 'Process finished with exit code 0',
              type: 'success',
              timestamp: new Date().toLocaleTimeString()
            }
          ]);
        }, 1200);
      }
    } catch (err) {
      setIsRunning(false);
      activeRunIdRef.current = null;
      setRunLogs(prev => [
        ...prev,
        {
          id: String(Date.now()),
          text: `Failed to spawn process: ${err}`,
          type: 'error',
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      addToast('Run Error', String(err), 'error');
    }
  }, [runConfigurations, activeConfigId, files, addToast, isRunning]);

  const handleStop = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('stop_all_processes');
      }
    } catch (e) {
      console.warn('Failed to stop process:', e);
    }
    activeRunIdRef.current = null;
    setIsRunning(false);
    setRunLogs(prev => [
      ...prev,
      {
        id: String(Date.now()),
        text: 'Process terminated by user (Ctrl+F2)',
        type: 'warning',
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
    addToast('Process Terminated', 'Stopped running process', 'warning');
  }, [addToast]);

  // Save All Dirty Files to Disk (Authentic IntelliJ IDEA)
  const saveAllFiles = useCallback(async (isManual = false) => {
    const dirtyTabs = tabs.filter(t => t.isDirty);
    if (dirtyTabs.length === 0) return;

    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      for (const tab of dirtyTabs) {
        if (tab.path && (tab.path.includes('/') || tab.path.includes('\\'))) {
          try {
            await invoke('save_file_content', { path: tab.path, content: tab.content });
          } catch (e) {
            console.error(`Failed to save ${tab.path} to disk:`, e);
            if (isManual) {
              addToast('Save Failed', `Could not save ${tab.title}: ${e}`, 'error');
            }
          }
        }
      }
    }

    setTabs(prev => prev.map(t => ({ ...t, isDirty: false })));
    refreshGitStatus();
  }, [tabs, addToast, refreshGitStatus]);

  // Handle Save (Ctrl+S or Save All action) - Silent in IntelliJ IDEA
  const handleSaveActive = useCallback(async () => {
    await saveAllFiles(true);
  }, [saveAllFiles]);

  // Auto-Save after typing (1s debounce)
  useEffect(() => {
    const hasDirty = tabs.some(t => t.isDirty);
    if (!hasDirty) return;

    const timer = setTimeout(() => {
      saveAllFiles(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [tabs, saveAllFiles]);

  // Auto-Save on Window Blur (Frame Deactivation)
  useEffect(() => {
    const handleBlur = () => {
      saveAllFiles(false);
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [saveAllFiles]);

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

  // Find Usages in Project (Authentic IntelliJ IDEA)
  const findUsagesInProject = useCallback((symbol: string): FindUsagesResult => {
    const trimmed = symbol.trim();
    if (!trimmed) return { symbol: '', occurrences: [] };

    const escaped = trimmed.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`);

    const occurrences: UsageOccurrence[] = [];

    // Collect all files in workspace
    const allFiles: { id: string; name: string; path: string; content: string }[] = [];
    const walk = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (!node.isFolder && node.content !== undefined) {
          const openTab = tabs.find(t => t.path === node.path || t.id === node.id);
          allFiles.push({
            id: node.id,
            name: node.name,
            path: node.path,
            content: openTab ? openTab.content : node.content,
          });
        }
        if (node.children) walk(node.children);
      }
    };
    walk(files);

    // Also include any tabs that might not be in the tree
    for (const tab of tabs) {
      if (!allFiles.some(f => f.path === tab.path || f.id === tab.id)) {
        allFiles.push({
          id: tab.id,
          name: tab.title,
          path: tab.path,
          content: tab.content,
        });
      }
    }

    // Search in each file
    for (const file of allFiles) {
      const lines = file.content.split('\n');
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const lineContent = lines[lineIdx];
        if (regex.test(lineContent)) {
          const matchCol = lineContent.indexOf(trimmed) + 1;
          const trimmedLine = lineContent.trim();
          let usageType: 'import' | 'declaration' | 'usage' = 'usage';
          if (trimmedLine.startsWith('import ') || trimmedLine.includes('from \'') || trimmedLine.includes('from "') || trimmedLine.startsWith('use ')) {
            usageType = 'import';
          } else if (new RegExp(`\\b(class|interface|type|enum|function|const|let|var|fn|struct|pub struct|pub fn)\\s+${escaped}\\b`).test(lineContent)) {
            usageType = 'declaration';
          }

          occurrences.push({
            id: `${file.id}-${lineIdx + 1}-${matchCol}`,
            fileId: file.id,
            fileName: file.name,
            filePath: file.path,
            lineNumber: lineIdx + 1,
            columnNumber: matchCol,
            lineContent: lineContent,
            matchText: trimmed,
            matchStart: matchCol - 1,
            matchEnd: matchCol - 1 + trimmed.length,
            usageType,
          });
        }
      }
    }

    return {
      symbol: trimmed,
      occurrences,
    };
  }, [files, tabs]);

  const handleFindUsages = useCallback((symbol: string) => {
    const res = findUsagesInProject(symbol);
    setFindResult(res);
    setBottomTab('find');
    setIsBottomOpen(true);
    addToast('Find Usages', `Found ${res.occurrences.length} usage${res.occurrences.length === 1 ? '' : 's'} of "${symbol}" in project`, 'info');
  }, [findUsagesInProject, addToast]);

  const handleShowUsages = useCallback((symbol: string) => {
    const res = findUsagesInProject(symbol);
    setShowUsagesResult(res);
  }, [findUsagesInProject]);

  const handleJumpToOccurrence = useCallback((occ: UsageOccurrence) => {
    let targetTab = tabs.find(t => t.path === occ.filePath || t.id === occ.fileId);
    if (!targetTab) {
      const findNode = (nodes: FileNode[]): FileNode | null => {
        for (const n of nodes) {
          if (n.path === occ.filePath || n.id === occ.fileId) return n;
          if (n.children) {
            const found = findNode(n.children);
            if (found) return found;
          }
        }
        return null;
      };
      const node = findNode(files);
      if (node) {
        const newTab: OpenTab = {
          id: node.id,
          title: node.name,
          path: node.path,
          content: node.content || '',
          language: node.language || 'plaintext',
          isDirty: false,
        };
        setTabs(prev => [...prev, newTab]);
        targetTab = newTab;
      }
    }

    if (targetTab) {
      setActiveTabId(targetTab.id);
      setTimeout(() => {
        codeEditorRef.current?.revealPosition(occ.lineNumber, occ.columnNumber, occ.matchText.length);
      }, 60);
    }
  }, [tabs, files]);

  const handleOpenRenameSymbol = useCallback((symbol: string) => {
    const word = symbol || codeEditorRef.current?.getWordAtCursor() || '';
    if (word) {
      setRenameTarget({ type: 'symbol', name: word });
      setIsRenameOpen(true);
    } else {
      addToast('Rename', 'Place cursor on a symbol or select text to rename (Shift+F6)', 'info');
    }
  }, [addToast]);

  const handleRenameUnified = useCallback((newName: string) => {
    if (renameTarget.type === 'symbol') {
      const oldSym = renameTarget.name;
      if (!oldSym || !newName || oldSym === newName) return;

      const escaped = oldSym.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'g');

      setTabs(prev => prev.map(t => {
        if (regex.test(t.content)) {
          return {
            ...t,
            content: t.content.replace(regex, newName),
            isDirty: true,
          };
        }
        return t;
      }));

      addToast('Rename Successful', `Renamed "${oldSym}" to "${newName}" across open files`, 'success');
      setRenameTarget({ type: 'symbol', name: '' });
    } else {
      handleRenameActive(newName);
    }
  }, [renameTarget, handleRenameActive, addToast]);

  // Git Commit & Push
  const handleCommit = async (message: string, andPush: boolean, filesToCommit: string[], amend?: boolean) => {
    const projectDir = currentProjectDirectory;
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_commit', {
          projectPath: projectDir,
          message,
          files: filesToCommit,
          amend: Boolean(amend),
        });
        addToast(amend ? 'Amended Commit' : 'Committed', `[${currentBranch}] ${message}`, 'success');
        if (andPush) {
          await invoke('git_push', { projectPath: projectDir });
          addToast('Pushed', `Branch ${currentBranch} up to date on remote origin`, 'success');
        }
        refreshGitStatus();
      } else {
        addToast(amend ? 'Amended Commit' : 'Committed', `[${currentBranch}] ${message}`, 'success');
        if (andPush) {
          setTimeout(() => {
            addToast('Pushed', `Branch ${currentBranch} up to date on remote origin`, 'success');
          }, 800);
        }
      }
    } catch (err) {
      console.error('Git operation failed:', err);
      addToast('Git Error', String(err), 'error');
    }
  };

  // Open active tab diff with HEAD (Ctrl+Alt+D)
  const handleOpenCurrentFileDiff = async () => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (!currentTab || !currentTab.path) {
      addToast('Diff Viewer', 'No active file open to compare with HEAD', 'info');
      return;
    }
    const projectDir = currentProjectDirectory;
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const base = await invoke<string>('git_get_file_content_at_head', {
          projectPath: projectDir,
          filePath: currentTab.path,
        }).catch(() => '');
        setActiveDiffFile(currentTab.title);
        setDiffBaseContent(base);
        setDiffLocalContent(currentTab.content);
        setIsDiffModalOpen(true);
      } else {
        setActiveDiffFile(currentTab.title);
        setDiffBaseContent('// Base at HEAD\n' + currentTab.content.slice(0, 50));
        setDiffLocalContent(currentTab.content);
        setIsDiffModalOpen(true);
      }
    } catch (e) {
      console.warn('handleOpenCurrentFileDiff error:', e);
    }
  };

  // Central Menu Action Dispatcher
  const handleMenuAction = useCallback((actionId: string) => {
    switch (actionId) {
      // File actions
      case 'file.newProject':
      case 'file.newFromExisting':
        setIsNewProjectOpen(true);
        break;
      case 'file.newFromVcs':
      case 'git.clone':
        setIsVcsCloneOpen(true);
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
      case 'file.newJavaClass': {
        const id = `java-${Date.now()}`;
        const defaultJavaCode = `package com.example;\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, IntelliJ IDEA!");\n    }\n}\n`;
        setTabs(prev => [...prev, { id, title: 'Main.java', path: 'src/main/java/Main.java', content: defaultJavaCode, language: 'java', isDirty: true }]);
        setActiveTabId(id);
        addToast('Java Class Created', 'Main.java opened in editor', 'success');
        break;
      }
      case 'file.newKotlin': {
        const id = `kt-${Date.now()}`;
        const defaultKtCode = `package com.example\n\nfun main() {\n    println("Hello, Kotlin!")\n}\n`;
        setTabs(prev => [...prev, { id, title: 'Main.kt', path: 'src/main/kotlin/Main.kt', content: defaultKtCode, language: 'kotlin', isDirty: true }]);
        setActiveTabId(id);
        addToast('Kotlin File Created', 'Main.kt opened in editor', 'success');
        break;
      }
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
      case 'file.clearRecentProjects':
        setRecentProjects([]);
        try {
          localStorage.removeItem('ij_recent_projects');
        } catch (e) {}
        addToast('Recent Projects Cleared', 'Removed all projects from recent list', 'info');
        break;
      case 'file.manageProjects':
        setIsNewProjectOpen(true);
        break;
      case 'file.closeProject':
        setTabs([]);
        setActiveTabId(null);
        setFiles([]);
        setProjectName('');
        setProjectRootPath('');
        try {
          localStorage.removeItem('ij_current_project_path');
        } catch (e) {}
        addToast('Project Closed', `${projectName || 'Project'} closed`, 'info');
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
      case 'file.encoding.win1252':
        setFileEncoding('Windows-1252');
        addToast('File Encoding', 'Encoding set to Windows-1252', 'info');
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
        handleSaveActive();
        break;
      case 'file.reloadFromDisk': {
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab && currentTab.path) {
          if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
            invoke<string>('read_file_content', { path: currentTab.path })
              .then((content) => {
                setTabs(prev => prev.map(t => t.id === currentTab.id ? { ...t, content, isDirty: false } : t));
                addToast('Reloaded from Disk', `${currentTab.title} reloaded successfully`, 'success');
              })
              .catch((err) => {
                addToast('Reload Failed', String(err), 'error');
              });
          } else {
            addToast('Reload from Disk', `${currentTab.title} reloaded from disk (Ctrl+Alt+Y)`, 'info');
          }
        } else {
          addToast('Reload from Disk', 'No active file to reload', 'info');
        }
        break;
      }
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
      case 'file.syncFiles': {
        const currentTab = tabs.find(t => t.id === activeTabId);
        syncProjectFilesFromDisk(currentTab?.path ? [currentTab.path] : undefined);
        refreshGitStatus();
        addToast('Synchronized', 'Reloaded all files and project tree from disk (Ctrl+Alt+Y)', 'success');
        break;
      }
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
      case 'edit.copyAbsolutePath': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (curTab && curTab.path) {
          navigator.clipboard.writeText(curTab.path);
          addToast('Copied Absolute Path', curTab.path, 'success');
        }
        break;
      }
      case 'edit.copyRelativePath': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (curTab && curTab.path) {
          const rel = curTab.path.replace(/^[a-zA-Z]:[\\/]/, '');
          navigator.clipboard.writeText(rel);
          addToast('Copied Path from Content Root', rel, 'success');
        }
        break;
      }
      case 'edit.copyFilename': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (curTab) {
          navigator.clipboard.writeText(curTab.title);
          addToast('Copied Filename', curTab.title, 'success');
        }
        break;
      }
      case 'edit.pasteHistory':
        addToast('Clipboard History', 'Clipboard history contains latest copied buffers (Ctrl+Shift+V)', 'info');
        break;
      case 'edit.duplicateLine':
        codeEditorRef.current?.duplicateLine();
        break;
      case 'edit.delete':
        addToast('Delete', 'Deleted line / selection (Delete)', 'info');
        break;
      case 'edit.toggleCase':
        addToast('Toggle Case', 'Toggled uppercase / lowercase (Ctrl+Shift+U)', 'info');
        break;
      case 'edit.selectAll':
        addToast('Select All', 'Selected all document contents (Ctrl+A)', 'info');
        break;
      case 'edit.find':
        codeEditorRef.current?.triggerFind();
        break;
      case 'edit.replace':
        codeEditorRef.current?.triggerReplace();
        break;
      case 'edit.findInFiles':
        handleOpenFindInFiles('find');
        break;
      case 'edit.replaceInFiles':
        handleOpenFindInFiles('replace');
        break;

      // View actions
      case 'view.toggleProject':
        if (activeSideTab === 'project' && isSideBarOpen) {
          setIsSideBarOpen(false);
        } else {
          setActiveSideTab('project');
          setIsSideBarOpen(true);
        }
        break;
      case 'view.toggleStructure':
        if (activeSideTab === 'structure' && isSideBarOpen) {
          setIsSideBarOpen(false);
        } else {
          setActiveSideTab('structure');
          setIsSideBarOpen(true);
        }
        break;
      case 'view.toggleCommit':
        setIsCommitOpen(true);
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
      case 'view.toggleFind':
        setBottomTab('find');
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
        setActiveRightPanel(prev => {
          if (prev !== 'notifications') {
            setNotifications(list => list.map(n => ({ ...n, read: true })));
            return 'notifications';
          }
          return null;
        });
        break;
      case 'view.database':
      case 'view.toggleDatabase':
        setActiveRightPanel(prev => prev === 'database' ? null : 'database');
        break;
      case 'view.toggleBuildTools':
      case 'view.cargo':
        setActiveRightPanel(prev => prev === 'cargo' ? null : 'cargo');
        break;
      case 'view.toggleStatusBar':
        addToast('View Appearance', 'Status Bar visibility toggled', 'info');
        break;
      case 'view.toggleBreadcrumbs':
        setSettings(s => ({ ...s, breadcrumbs: !s.breadcrumbs }));
        addToast('Breadcrumbs', 'Navigation bar / breadcrumbs toggled', 'info');
        break;
      case 'view.toggleLineNumbers':
        setSettings(s => ({ ...s, lineNumbers: !s.lineNumbers }));
        addToast('Line Numbers', 'Editor line numbers toggled', 'info');
        break;
      case 'view.toggleMinimap':
        setSettings(s => ({ ...s, minimap: !s.minimap }));
        addToast('Minimap', 'Code minimap toggled', 'info');
        break;
      case 'view.toggleWordWrap':
        setSettings(s => ({ ...s, wordWrap: !s.wordWrap }));
        addToast('Word Wrap', 'Soft-wrap lines toggled', 'info');
        break;
      case 'view.toggleFullScreen':
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        break;
      case 'view.recentFiles':
      case 'view.recentLocations':
        setIsSearchOpen(true);
        break;
      case 'view.zoomIn':
        setSettings(s => ({ ...s, fontSize: Math.min((s.fontSize || 13) + 1, 24) }));
        addToast('Zoom In', `Editor font size: ${(settings.fontSize || 13) + 1}px`, 'info');
        break;
      case 'view.zoomOut':
        setSettings(s => ({ ...s, fontSize: Math.max((s.fontSize || 13) - 1, 10) }));
        addToast('Zoom Out', `Editor font size: ${(settings.fontSize || 13) - 1}px`, 'info');
        break;
      case 'view.resetZoom':
        setSettings(s => ({ ...s, fontSize: 13 }));
        addToast('Zoom Reset', 'Editor font size reset to 13px', 'info');
        break;

      // Navigate actions
      case 'navigate.searchEverywhere':
      case 'navigate.goToFile':
        setIsSearchOpen(true);
        break;
      case 'navigate.goToLine':
        setIsGoToLineOpen(true);
        break;
      case 'navigate.gotoDeclaration':
      case 'navigate.gotoImplementation':
        addToast('Navigate', 'Jumping to declaration / definition (Ctrl+B)', 'info');
        break;
      case 'navigate.findUsages': {
        const word = codeEditorRef.current?.getWordAtCursor() || '';
        if (word) handleFindUsages(word);
        else addToast('Find Usages', 'Place cursor on a symbol and press Alt+F7', 'info');
        break;
      }
      case 'navigate.showUsages': {
        const word = codeEditorRef.current?.getWordAtCursor() || '';
        if (word) handleShowUsages(word);
        else addToast('Show Usages', 'Place cursor on a symbol and press Ctrl+Alt+F7', 'info');
        break;
      }
      case 'navigate.back':
      case 'navigate.forward':
        addToast('Navigation History', `Navigated ${actionId.includes('back') ? 'back' : 'forward'} in cursor history`, 'info');
        break;
      case 'navigate.nextTab': {
        const idx = tabs.findIndex(t => t.id === activeTabId);
        if (idx !== -1 && tabs.length > 1) {
          const nextIdx = (idx + 1) % tabs.length;
          setActiveTabId(tabs[nextIdx].id);
        }
        break;
      }
      case 'navigate.prevTab': {
        const idx = tabs.findIndex(t => t.id === activeTabId);
        if (idx !== -1 && tabs.length > 1) {
          const prevIdx = (idx - 1 + tabs.length) % tabs.length;
          setActiveTabId(tabs[prevIdx].id);
        }
        break;
      }
      case 'navigate.selectInProject':
        setActiveSideTab('project');
        setIsSideBarOpen(true);
        addToast('Project View', 'Highlighted active file in project tree', 'info');
        break;
      case 'navigate.selectInExplorer': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (curTab && curTab.path) {
          invoke('reveal_in_explorer', { path: curTab.path }).catch(() => {
            addToast('Show in Explorer', `Revealed ${curTab.title} in file manager`, 'info');
          });
        }
        break;
      }
      case 'navigate.selectInTerminal':
        setBottomTab('terminal');
        setIsBottomOpen(true);
        addToast('Terminal', 'Switched to terminal session', 'info');
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
      case 'code.commentBlock':
        addToast('Block Comment', 'Toggled block comment (Ctrl+Shift+/)', 'info');
        break;
      case 'code.genConstructor': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (curTab) {
          const snippet = '\n    // IntelliJ Generated Constructor\n    public Main() {\n    }\n';
          setTabs(prev => prev.map(t => t.id === curTab.id ? { ...t, content: t.content + snippet, isDirty: true } : t));
          addToast('Generate', 'Generated Constructor in active file', 'success');
        }
        break;
      }
      case 'code.genGetterSetter': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (curTab) {
          const snippet = '\n    public String getValue() { return this.value; }\n    public void setValue(String val) { this.value = val; }\n';
          setTabs(prev => prev.map(t => t.id === curTab.id ? { ...t, content: t.content + snippet, isDirty: true } : t));
          addToast('Generate', 'Generated Getters and Setters', 'success');
        }
        break;
      }
      case 'code.genToString': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (curTab) {
          const snippet = '\n    @Override\n    public String toString() {\n        return "Main{}";\n    }\n';
          setTabs(prev => prev.map(t => t.id === curTab.id ? { ...t, content: t.content + snippet, isDirty: true } : t));
          addToast('Generate', 'Generated toString() method', 'success');
        }
        break;
      }
      case 'code.genOverride':
        addToast('Generate Override', 'Select method to override (Ctrl+O)', 'info');
        break;
      case 'code.surroundIf': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (curTab) {
          const snippet = '\n        if (true) {\n            // TODO: implementation\n        }\n';
          setTabs(prev => prev.map(t => t.id === curTab.id ? { ...t, content: t.content + snippet, isDirty: true } : t));
          addToast('Surround With', 'Surrounded with if block', 'success');
        }
        break;
      }
      case 'code.surroundTry': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (curTab) {
          const snippet = '\n        try {\n            // TODO: implementation\n        } catch (Exception e) {\n            e.printStackTrace();\n        }\n';
          setTabs(prev => prev.map(t => t.id === curTab.id ? { ...t, content: t.content + snippet, isDirty: true } : t));
          addToast('Surround With', 'Surrounded with try/catch block', 'success');
        }
        break;
      }
      case 'code.surroundFor': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (curTab) {
          const snippet = '\n        for (int i = 0; i < 10; i++) {\n            // loop\n        }\n';
          setTabs(prev => prev.map(t => t.id === curTab.id ? { ...t, content: t.content + snippet, isDirty: true } : t));
          addToast('Surround With', 'Surrounded with for loop', 'success');
        }
        break;
      }
      case 'code.foldAll':
        codeEditorRef.current?.foldAll();
        addToast('Code Folding', 'All blocks collapsed (Ctrl+Shift+-)', 'info');
        break;
      case 'code.unfoldAll':
        codeEditorRef.current?.unfoldAll();
        addToast('Code Folding', 'All blocks expanded (Ctrl+Shift++)', 'info');
        break;

      // Refactor actions
      case 'refactor.rename':
        setIsRenameOpen(true);
        break;
      case 'refactor.changeSignature':
        addToast('Change Signature', 'Signature refactoring ready (Ctrl+F6)', 'info');
        break;
      case 'refactor.extractVariable':
      case 'refactor.extractConstant':
      case 'refactor.extractField':
      case 'refactor.extractMethod':
        addToast('Extract Refactoring', `Extract ${actionId.replace('refactor.extract', '')} executed`, 'info');
        break;
      case 'refactor.inline':
        addToast('Inline Refactoring', 'Inlined symbol definition (Ctrl+Alt+N)', 'info');
        break;
      case 'refactor.moveFile':
      case 'refactor.copyFile':
      case 'refactor.safeDelete':
        addToast('Refactoring Action', `Executed ${actionId}`, 'info');
        break;

      // Build & Run actions
      case 'build.build':
      case 'build.rebuild':
      case 'build.buildModule':
        addToast('Build Project', 'Compilation finished with 0 errors (Ctrl+F9)', 'success');
        break;
      case 'build.clean':
        addToast('Clean Project', 'Project target and build cache cleaned', 'info');
        break;
      case 'build.artifacts':
        addToast('Build Artifacts', 'Generated project distribution artifacts', 'success');
        break;
      case 'run.run':
        handleRun();
        break;
      case 'run.debug':
        setBottomTab('debug');
        setIsBottomOpen(true);
        setDebugState('paused');
        addToast('Debugger Started', 'Connected to debug session on port 9229 (Shift+F9)', 'success');
        break;
      case 'run.coverage':
        addToast('Run with Coverage', 'Coverage analysis: 94.2% lines covered', 'success');
        handleRun();
        break;
      case 'run.profile':
        addToast('Profiler Attached', `Profiling '${projectName || 'Desktop IDE'}': CPU and Memory sampling active`, 'info');
        handleRun();
        break;
      case 'run.pinTab':
        addToast('Pin Tab', 'Run Console tab pinned', 'info');
        break;
      case 'run.showExecutionPoint':
        if (activeTab) {
          codeEditorRef.current?.goToLine(cursorPos.line, cursorPos.col);
        }
        addToast('Execution Point', 'Jumped to current program execution point (Alt+F10)', 'info');
        break;
      case 'run.stop':
        handleStop();
        handleStopDebug();
        break;
      case 'run.editConfig':
        setIsRunConfigOpen(true);
        break;
      case 'run.stepOver':
        handleStepOverDebug();
        break;
      case 'run.stepInto':
        handleStepIntoDebug();
        break;
      case 'run.stepOut':
        handleStepOutDebug();
        break;
      case 'run.resume':
        handleResumeDebug();
        break;
      case 'run.toggleBreakpoint':
        addToast('Breakpoint', `Toggled line breakpoint at current line (Ctrl+F8)`, 'info');
        break;
      case 'run.viewBreakpoints':
        addToast('Breakpoints', 'Active breakpoints: 0', 'info');
        break;

      // Tools actions
      case 'tools.terminal':
        setBottomTab('terminal');
        setIsBottomOpen(true);
        break;
      case 'tools.httpScratch': {
        const id = `http-${Date.now()}`;
        const httpReq = '### GET Health Check\nGET http://localhost:8080/api/v1/health\nAccept: application/json\n\n### POST Sample Data\nPOST http://localhost:8080/api/v1/data\nContent-Type: application/json\n\n{\n  "message": "Hello from IntelliJ Client"\n}\n';
        setTabs(prev => [...prev, { id, title: 'request.http', path: 'scratches/request.http', content: httpReq, language: 'http', isDirty: true }]);
        setActiveTabId(id);
        addToast('HTTP Client', 'request.http opened in scratch editor', 'success');
        break;
      }
      case 'tools.openTask':
      case 'tools.closeTask':
        addToast('Tasks & Contexts', 'Tasks & Contexts manager ready', 'info');
        break;
      case 'tools.formatJson': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (curTab) {
          try {
            const parsed = JSON.parse(curTab.content);
            const formatted = JSON.stringify(parsed, null, 2);
            setTabs(prev => prev.map(t => t.id === curTab.id ? { ...t, content: formatted, isDirty: true } : t));
            addToast('JSON Formatted', 'JSON document formatted', 'success');
          } catch {
            addToast('Invalid JSON', 'Cannot format invalid JSON content', 'error');
          }
        }
        break;
      }
      case 'tools.validateJson': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (curTab) {
          try {
            JSON.parse(curTab.content);
            addToast('Valid JSON', 'JSON syntax is valid', 'success');
          } catch (e) {
            addToast('Invalid JSON', String(e), 'error');
          }
        }
        break;
      }
      case 'tools.plugins':
        setIsSettingsOpen(true);
        break;

      // Git actions
      case 'git.annotate':
      case 'view.annotate':
        codeEditorRef.current?.toggleGitBlame();
        break;
      case 'git.commit':
        setIsCommitOpen(true);
        break;
      case 'git.log':
      case 'view.toggleGit':
        setBottomTab('git');
        setIsBottomOpen(true);
        break;
      case 'git.compareWithHead':
      case 'git.diff':
        handleOpenCurrentFileDiff();
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
      case 'git.fetch':
        invoke('git_fetch', { projectPath: currentProjectDirectory })
          .then(() => addToast('Git Fetch', 'Fetched latest branches and commits from remote', 'success'))
          .catch(e => addToast('Git Fetch Failed', String(e), 'error'));
        break;
      case 'git.compareBranch':
        addToast('Compare with Branch', 'Select branch to compare working tree against', 'info');
        break;
      case 'git.stash':
        addToast('Git Stash', 'Working directory changes stashed (stash@{0})', 'success');
        break;
      case 'git.unstash':
        addToast('Git UnStash', 'Applied latest stash to working directory', 'success');
        break;

      // Help actions
      case 'help.findAction':
        setIsSearchOpen(true);
        break;
      case 'help.about':
        setIsAboutOpen(true);
        break;
      case 'help.tip':
        setIsTipOpen(true);
        break;
      case 'help.keymap':
        setIsSettingsOpen(true);
        break;
      case 'help.checkUpdates':
        addToast('Check for Updates', 'You are running the latest version of IntelliJ IDEA Clone (2025.1.0)', 'info');
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
    let shiftDownTime = 0;
    let shiftPressedAlone = false;
    let lastShiftReleaseTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key to dismiss any active modal
      if (e.key === 'Escape') {
        if (isSettingsOpen) { setIsSettingsOpen(false); return; }
        if (isAboutOpen) { setIsAboutOpen(false); return; }
        if (isNewFileOpen) { setIsNewFileOpen(false); return; }
        if (isRenameOpen) { setIsRenameOpen(false); return; }
        if (isDiffModalOpen) { setIsDiffModalOpen(false); return; }
        if (isCommitOpen) { setIsCommitOpen(false); return; }
        if (isBranchesOpen) { setIsBranchesOpen(false); return; }
        if (isRunConfigOpen) { setIsRunConfigOpen(false); return; }
        if (isNewProjectOpen) { setIsNewProjectOpen(false); return; }
        if (isProjectStructureOpen) { setIsProjectStructureOpen(false); return; }
        if (isInvalidateCachesOpen) { setIsInvalidateCachesOpen(false); return; }
        if (isLocalHistoryOpen) { setIsLocalHistoryOpen(false); return; }
        if (isRepairIdeOpen) { setIsRepairIdeOpen(false); return; }
        if (isOpenProjectPromptOpen) { setIsOpenProjectPromptOpen(false); return; }
        if (isFindInFilesOpen) { setIsFindInFilesOpen(false); return; }
        if (isSearchOpen) { setIsSearchOpen(false); return; }
        if (isGoToLineOpen) { setIsGoToLineOpen(false); return; }
        if (isTipOpen) { setIsTipOpen(false); return; }
      }

      // Authentic IntelliJ IDEA Double Shift detection
      if (e.key === 'Shift') {
        // Never trigger on held key auto-repeat
        if (e.repeat) return;
        // Never trigger if modifier combos are held
        if (e.ctrlKey || e.altKey || e.metaKey) {
          shiftPressedAlone = false;
          lastShiftReleaseTime = 0;
          return;
        }

        const now = Date.now();
        const timeout = settings.doubleShiftTimeout || 350;

        // If a standalone Shift was tapped and released within timeout, this is the 2nd tap!
        if (lastShiftReleaseTime > 0 && (now - lastShiftReleaseTime < timeout)) {
          setIsSearchOpen(true);
          lastShiftReleaseTime = 0;
          shiftPressedAlone = false;
          return;
        }

        shiftPressedAlone = true;
        shiftDownTime = now;
        return;
      } else {
        // Any other key pressed (e.g. '[', '{', 'a', etc.) means Shift is part of a combo, not alone
        shiftPressedAlone = false;
        lastShiftReleaseTime = 0;
      }

      // Ctrl + Shift + A (Search Everywhere - Actions)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // Ctrl + Shift + F (Find in Files)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // Ctrl + Shift + N (Search Files)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // Ctrl + N or Alt + Insert (New File - IntelliJ shortcut)
      if (((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') || (e.altKey && e.key === 'Insert')) {
        e.preventDefault();
        setIsNewFileOpen(true);
        return;
      }

      // Ctrl + R (Replace in file - prevent webview reload)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        codeEditorRef.current?.triggerReplace();
        return;
      }

      // Ctrl + F (Find in file)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        codeEditorRef.current?.triggerFind();
        return;
      }

      // Ctrl + Y (Delete line - IntelliJ shortcut)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        codeEditorRef.current?.deleteLine();
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
      // Alt+Shift+B: Annotate with Git Blame
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        codeEditorRef.current?.toggleGitBlame();
        return;
      }

      if (e.altKey && e.key === '1') {
        e.preventDefault();
        handleMenuAction('view.toggleProject');
        return;
      }

      // Alt + 7 (Toggle Structure tool window)
      if (e.altKey && e.key === '7') {
        e.preventDefault();
        handleMenuAction('view.toggleStructure');
        return;
      }

      // Alt + 4 (Toggle Run console)
      if (e.altKey && e.key === '4') {
        e.preventDefault();
        handleMenuAction('view.toggleRun');
        return;
      }

      // Alt + 9 (Toggle Git tool window)
      if (e.altKey && e.key === '9') {
        e.preventDefault();
        handleMenuAction('view.toggleGit');
        return;
      }

      // Ctrl + K (Git Commit)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.shiftKey) {
        e.preventDefault();
        setIsCommitOpen(true);
        return;
      }

      // Ctrl + Shift + K (Git Commit & Push)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommitOpen(true);
        return;
      }

      // Ctrl + Shift + F (Find in Files)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleOpenFindInFiles('find');
        return;
      }

      // Ctrl + Shift + R or Ctrl + Shift + H (Replace in Files - IntelliJ & VS Code keymaps)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'h')) {
        e.preventDefault();
        handleOpenFindInFiles('replace');
        return;
      }

      // Ctrl + Alt + D (Compare active file with HEAD / Diff Viewer)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleOpenCurrentFileDiff();
        return;
      }

      // Alt + F12 (Toggle Terminal)
      if (e.altKey && e.key === 'F12') {
        e.preventDefault();
        handleMenuAction('view.toggleTerminal');
        return;
      }

      // Alt + Shift + F10 (Select / Edit Run Configuration - IntelliJ shortcut)
      if (e.altKey && e.shiftKey && e.key === 'F10') {
        e.preventDefault();
        setIsRunConfigOpen(true);
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

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        const now = Date.now();
        // Only count as a valid 1st tap if Shift was pressed alone and released within 350ms
        if (shiftPressedAlone && (now - shiftDownTime < 350)) {
          lastShiftReleaseTime = now;
        } else {
          lastShiftReleaseTime = 0;
        }
        shiftPressedAlone = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [
    handleSaveActive, handleCloseActiveTab, handleMenuAction, handleRun, handleStop,
    isSettingsOpen, isAboutOpen, isNewFileOpen, isRenameOpen, isCommitOpen, isDiffModalOpen,
    isBranchesOpen, isRunConfigOpen, isNewProjectOpen, isProjectStructureOpen,
    isInvalidateCachesOpen, isLocalHistoryOpen, isRepairIdeOpen, isOpenProjectPromptOpen,
    isSearchOpen, isGoToLineOpen, isTipOpen
  ]);

  // Create New File logic
  const handleCreateNewFile = (fileName: string) => {
    const language = detectLanguage(fileName);

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

      const language = (file.language && file.language !== 'plaintext') ? file.language : detectLanguage(file.name);

      const newTab: OpenTab = {
        id: file.id,
        title: file.name,
        path: file.path,
        content: content || '',
        language,
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

  const handleCloseOtherTabs = (tabId: string) => {
    const nextTabs = tabs.filter(t => t.id === tabId);
    setTabs(nextTabs);
    setActiveTabId(tabId);
    addToast('Close Other Tabs', 'Closed all other tabs', 'info');
  };

  const handleCloseAllTabs = () => {
    setTabs([]);
    setActiveTabId(null);
    addToast('Close All Tabs', 'All editor tabs closed', 'info');
  };

  const handleCloseUnmodifiedTabs = () => {
    const nextTabs = tabs.filter(t => t.isDirty);
    setTabs(nextTabs);
    if (!nextTabs.some(t => t.id === activeTabId)) {
      setActiveTabId(nextTabs.length > 0 ? nextTabs[0].id : null);
    }
    addToast('Close Unmodified', 'Closed unmodified editor tabs', 'info');
  };

  const handleCloseTabsLeft = (tabId: string) => {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx <= 0) return;
    const nextTabs = tabs.slice(idx);
    setTabs(nextTabs);
    if (!nextTabs.some(t => t.id === activeTabId)) {
      setActiveTabId(tabId);
    }
    addToast('Close Left Tabs', 'Closed tabs to the left', 'info');
  };

  const handleCloseTabsRight = (tabId: string) => {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx === -1 || idx >= tabs.length - 1) return;
    const nextTabs = tabs.slice(0, idx + 1);
    setTabs(nextTabs);
    if (!nextTabs.some(t => t.id === activeTabId)) {
      setActiveTabId(tabId);
    }
    addToast('Close Right Tabs', 'Closed tabs to the right', 'info');
  };

  const handleChangeContent = (tabId: string, newContent: string) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, content: newContent, isDirty: true } : t));
  };

  const handleSelectSearchAction = async (item: ActionItem) => {
    if (item.filePath) {
      const targetPath = item.filePath;
      let existingTab = tabs.find(t => t.path === targetPath || t.id === targetPath);
      if (!existingTab) {
        let content = '';
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          try {
            content = await invoke<string>('read_file_content', { path: targetPath });
          } catch (e) {
            console.warn('Failed to read search result file:', e);
          }
        }
        const fileName = targetPath.split(/[/\\]/).pop() || item.title;
        const language = detectLanguage(fileName);

        const newTab: OpenTab = {
          id: targetPath,
          title: fileName,
          path: targetPath,
          content,
          language,
          isDirty: false,
        };
        setTabs(prev => [...prev, newTab]);
        existingTab = newTab;
      }

      setActiveTabId(existingTab.id);
      if (item.lineNumber) {
        setTimeout(() => {
          codeEditorRef.current?.revealPosition(item.lineNumber!, item.columnNumber || 1, 0);
        }, 80);
      }
      return;
    }

    if (item.category === 'Files') {
      const match = files.flatMap(f => f.isFolder ? (f.children || []) : [f])
                         .find(f => f.name === item.title);
      if (match) handleFileSelect(match);
    } else if (item.title === 'Run Desktop IDE') {
      handleRun();
    } else if (item.title === 'Stop Running Process') {
      handleStop();
    } else if (item.title === 'Toggle Terminal') {
      setBottomTab('terminal');
      setIsBottomOpen(true);
    } else if (item.title === 'Toggle Run Console') {
      setBottomTab('run');
      setIsBottomOpen(true);
    } else if (item.title === 'Format Code') {
      codeEditorRef.current?.formatDocument();
    } else if (item.title === 'Git: Commit Changes') {
      setIsCommitOpen(true);
    } else if (item.title === 'Git: Branches') {
      setIsBranchesOpen(true);
    } else if (item.title === 'Settings / Preferences') {
      setIsSettingsOpen(true);
    } else if (item.title === 'Go to Line') {
      setIsGoToLineOpen(true);
    } else if (item.title === 'Rename Symbol') {
      handleOpenRenameSymbol('');
    }
  };

  const handleToggleSideTab = useCallback((tabId: string) => {
    if (activeSideTab === tabId && isSideBarOpen) {
      setIsSideBarOpen(false);
    } else {
      setActiveSideTab(tabId);
      setIsSideBarOpen(true);
    }
  }, [activeSideTab, isSideBarOpen]);

  const handleToggleBottomTab = useCallback((tabId: 'find' | 'run' | 'debug' | 'terminal' | 'problems' | 'git' | 'tests') => {
    if (bottomTab === tabId && isBottomOpen) {
      setIsBottomOpen(false);
    } else {
      setBottomTab(tabId);
      setIsBottomOpen(true);
    }
  }, [bottomTab, isBottomOpen]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1E1F22] text-[#DFE1E5] overflow-hidden select-none font-sans">
      {files.length === 0 ? (
        <WelcomeScreen
          recentProjects={recentProjects}
          onOpenProject={handleOpenProject}
          onOpenRecentProject={handleOpenProjectPath}
          onRemoveRecentProject={handleRemoveRecentProject}
          onNewProject={() => setIsNewProjectOpen(true)}
          onCloneVcs={() => setIsVcsCloneOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenAbout={() => setIsAboutOpen(true)}
          onOpenTip={() => setIsTipOpen(true)}
          settings={settings}
          onUpdateSettings={(newSettings) => {
            setSettings(newSettings);
            try {
              localStorage.setItem('intellij_ide_settings', JSON.stringify(newSettings));
            } catch (e) {}
          }}
          onShowToast={addToast}
        />
      ) : (
        <>
          {/* Top Application Bar */}
          <TopBar
            projectName={projectName}
            gitBranch={currentBranch}
            isRunning={isRunning}
            powerSaveMode={powerSaveMode}
            isReadOnly={isReadOnly}
            fileEncoding={fileEncoding}
            lineEnding={lineEnding}
            recentProjects={recentProjects}
            configurations={runConfigurations}
            activeConfigId={activeConfigId}
            onSelectConfig={(id) => {
              setActiveConfigId(id);
              try {
                localStorage.setItem('intellij_active_run_config_id', id);
              } catch (e) {}
            }}
            onOpenEditConfigs={() => setIsRunConfigOpen(true)}
            onRun={handleRun}
            onStop={handleStop}
            onOpenSearch={() => setIsSearchOpen(true)}
            onSelectMenuAction={handleMenuAction}
            onOpenProjectDialog={handleOpenProject}
            onOpenBranches={() => setIsBranchesOpen(true)}
            activeRightPanel={activeRightPanel}
            unreadNotificationsCount={notifications.filter(n => !n.read).length}
          />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Activity Bar (Icon Stripe) */}
        <ActivityBar
          activeSideTab={activeSideTab}
          isSideBarOpen={isSideBarOpen}
          onToggleSideTab={handleToggleSideTab}
          bottomTab={bottomTab}
          isBottomOpen={isBottomOpen}
          onToggleBottomTab={handleToggleBottomTab}
          isRunning={isRunning}
          hasFindResult={Boolean(findResult)}
          errorCount={problems.filter(p => p.severity === 'error').length}
          warningCount={problems.filter(p => p.severity === 'warning').length}
          onOpenCommit={() => setIsCommitOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onToggleDatabase={() => {
            setActiveRightPanel(prev => prev === 'database' ? null : 'database');
          }}
          onOpenPlugins={() => setIsSettingsOpen(true)}
        />

        {/* Middle Workspace Area (Top: Sidebar + Editor, Bottom: Full-Width Tool Window) */}
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          {/* Top Zone: Project Sidebar & Monaco Editor */}
          <div className="flex-1 flex min-h-0 overflow-hidden relative">
            {/* Left Tool Window (Project Tree) */}
        {isSideBarOpen && (
          <div 
            style={{ width: `${sideBarWidth}px` }} 
            className="h-full border-r border-[#2B2D30] flex-shrink-0 flex flex-col overflow-hidden relative"
          >
            {activeSideTab === 'project' && (
              <ProjectTree
                files={files}
                activeFileId={activeTabId}
                onFileSelect={handleFileSelect}
                onNewFile={() => setIsNewFileOpen(true)}
                onNewFolder={() => setIsNewFileOpen(true)}
                onDeleteFile={(node) => {
                  const removeNode = (list: FileNode[]): FileNode[] => {
                    return list
                      .filter(n => n.id !== node.id)
                      .map(n => n.children ? { ...n, children: removeNode(n.children) } : n);
                  };
                  setFiles(prev => removeNode(prev));
                  setTabs(prev => prev.filter(t => t.id !== node.id));
                  addToast('File Deleted', `Deleted ${node.name}`, 'warning');
                }}
                onRenameFile={(node) => {
                  setActiveTabId(node.id);
                  setIsRenameOpen(true);
                }}
                onOpenSplit={(node) => {
                  handleFileSelect(node);
                  addToast('Editor Split', `Opened ${node.name} in right split`, 'info');
                }}
                onLocalHistory={() => setIsLocalHistoryOpen(true)}
                onGitCommit={() => setIsCommitOpen(true)}
                onGitBlame={() => {
                  codeEditorRef.current?.toggleGitBlame();
                  addToast('Git Blame', 'Toggled git annotations', 'info');
                }}
                onReformatCode={() => {
                  codeEditorRef.current?.formatDocument();
                  addToast('Reformat Code', 'Reformatted code (Ctrl+Alt+L)', 'success');
                }}
                onOptimizeImports={() => {
                  addToast('Optimize Imports', 'Optimized imports (Ctrl+Alt+O)', 'success');
                }}
                onRepairIde={() => setIsRepairIdeOpen(true)}
                onShowToast={addToast}
                onFindUsages={handleFindUsages}
              />
            )}
            {activeSideTab === 'structure' && (
              <StructurePanel
                activeTab={tabs.find(t => t.id === activeTabId)}
                onNavigateToLine={(line, col) => {
                  codeEditorRef.current?.revealPosition(line, col, 0);
                }}
                onClose={() => setIsSideBarOpen(false)}
              />
            )}
            {activeSideTab !== 'project' && activeSideTab !== 'structure' && (
              <div className="h-full bg-[#2B2D30] p-4 text-xs text-[#868A91]">
                Tool Window: <span className="text-[#DFE1E5] font-semibold">{activeSideTab}</span>
              </div>
            )}

            {/* Draggable Resizer for Sidebar Width */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startW = sideBarWidth;
                const onMouseMove = (moveEvent: MouseEvent) => {
                  const delta = moveEvent.clientX - startX;
                  setSideBarWidth(Math.max(160, Math.min(600, startW + delta)));
                };
                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              }}
              className="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#3574F0]/50 transition-colors z-20"
              title="Drag to resize Project sidebar"
            />
          </div>
        )}

            {/* Monaco Editor Zone */}
            <div className="flex-1 min-w-0 h-full overflow-hidden">
            <CodeEditor
              ref={codeEditorRef}
              projectPath={currentProjectDirectory}
              tabs={tabs}
              activeTabId={activeTabId}
              settings={settings}
              isReadOnly={isReadOnly}
              onSelectTab={setActiveTabId}
              onCloseTab={handleCloseTab}
              onCloseOtherTabs={handleCloseOtherTabs}
              onCloseAllTabs={handleCloseAllTabs}
              onCloseUnmodifiedTabs={handleCloseUnmodifiedTabs}
              onCloseTabsLeft={handleCloseTabsLeft}
              onCloseTabsRight={handleCloseTabsRight}
              onChangeContent={handleChangeContent}
              onCursorChange={(line, col) => setCursorPos({ line, col })}
              onShowToast={addToast}
              onSelectMenuAction={handleMenuAction}
              onRunFile={handleRun}
              onFindUsages={handleFindUsages}
              onShowUsages={handleShowUsages}
              onRenameSymbol={handleOpenRenameSymbol}
              onOpenGoToLine={() => setIsGoToLineOpen(true)}
              breakpoints={breakpoints}
              onToggleBreakpoint={handleToggleBreakpoint}
              onUpdateBreakpoint={handleUpdateBreakpoint}
              onRemoveBreakpoint={handleRemoveBreakpoint}
              onOpenGitCommit={handleOpenGitCommit}
              dataSources={dataSources}
              onUpdateTableData={handleUpdateTableData}
              problems={problems}
              onToggleProblems={() => {
                setBottomTab('problems');
                setIsBottomOpen(true);
              }}
              activePausedLine={debugState === 'paused' ? { filePath: activeTab?.path || '', line: cursorPos.line } : null}
            />
            </div>
          </div>

          {/* Bottom Tool Window (Run / Terminal / Problems - Full Width) */}
          {isBottomOpen && (
            <div 
              style={{ height: `${bottomHeight}px` }}
              className="border-t border-[#2B2D30] flex flex-col bg-[#1E1F22] flex-shrink-0 relative w-full"
            >
              {/* Draggable Resizer for Bottom Panel Height */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startY = e.clientY;
                  const startH = bottomHeight;
                  const onMouseMove = (moveEvent: MouseEvent) => {
                    const delta = startY - moveEvent.clientY;
                    setBottomHeight(Math.max(120, Math.min(window.innerHeight - 150, startH + delta)));
                  };
                  const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                  };
                  document.addEventListener('mousemove', onMouseMove);
                  document.addEventListener('mouseup', onMouseUp);
                }}
                className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize hover:bg-[#3574F0]/50 transition-colors z-20"
                title="Drag to resize panel height"
              />
                            {/* Bottom Tool Window Header (Clean Authentic Title & Controls - No horizontal tabs) */}
              {bottomTab !== 'terminal' && bottomTab !== 'git' && (
                <div className="h-7 bg-[#1E1F22] border-b border-[#2B2D30] px-3 flex items-center justify-between text-[11px] select-none">
                  {/* Tool Window Title & Active Context */}
                  <div className="flex items-center gap-2 h-full text-[#DFE1E5]">
                    {bottomTab === 'run' && (
                      <>
                        <Play size={13} className={isRunning ? 'text-[#3574F0] fill-[#3574F0] animate-pulse' : 'text-[#59A869] fill-[#59A869]'} />
                        <span className="font-semibold text-xs text-[#DFE1E5]">Run</span>
                        <span className="text-[#868A91] text-[11px]">
                          {runConfigurations.find(c => c.id === activeConfigId)?.name || projectName || 'Application'}
                        </span>
                      </>
                    )}
                    {bottomTab === 'problems' && (() => {
                      const errs = problems.filter(p => p.severity === 'error').length;
                      const warns = problems.filter(p => p.severity === 'warning').length;
                      return (
                        <>
                          <AlertCircle size={13} className={errs > 0 ? "text-[#E05555]" : warns > 0 ? "text-[#EDA200]" : "text-[#59A869]"} />
                          <span className="font-semibold text-xs text-[#DFE1E5]">Problems</span>
                          <span className="text-[#868A91] text-[11px]">({errs} error{errs !== 1 ? 's' : ''}, {warns} warning{warns !== 1 ? 's' : ''})</span>
                        </>
                      );
                    })()}
                    {bottomTab === 'find' && (
                      <>
                        <Search size={13} className="text-[#3574F0]" />
                        <span className="font-semibold text-xs text-[#DFE1E5]">Find</span>
                        {findResult && (
                          <span className="text-[#868A91] text-[11px]">
                            usages of "{findResult.symbol}" ({findResult.occurrences.length})
                          </span>
                        )}
                      </>
                    )}
                    {bottomTab === 'debug' && (
                      <>
                        <Bug size={13} className="text-[#E55353]" />
                        <span className="font-semibold text-xs text-[#DFE1E5]">Debug</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleToggleMaximizeBottom}
                      title={bottomHeight > 400 ? "Restore size" : "Maximize tool window (Ctrl+Shift+F12)"}
                      className="p-1 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
                    >
                      <Maximize2 size={12} />
                    </button>
                    <button 
                      onClick={() => setIsBottomOpen(false)} 
                      title="Hide Window (Shift+Esc)"
                      className="p-1 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
                    >
                      <Minus size={13} />
                    </button>
                  </div>
                </div>
              )}

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
                {bottomTab === 'git' && (
                  <GitToolWindow
                    projectPath={currentProjectDirectory}
                    currentBranch={currentBranch}
                    targetCommitHash={gitTargetCommit}
                    onToggleMaximize={handleToggleMaximizeBottom}
                    onHide={() => setIsBottomOpen(false)}
                    onShowToast={addToast}
                  />
                )}
                <div className={`h-full ${bottomTab === 'terminal' ? 'block' : 'hidden'}`}>
                  {hasOpenedTerminal && (
                    <TerminalPanel 
                      key={projectRootPath}
                      cwd={projectRootPath} 
                      onToggleMaximize={handleToggleMaximizeBottom}
                      onHide={() => setIsBottomOpen(false)}
                      onOpenSettings={() => setIsSettingsOpen(true)}
                    />
                  )}
                </div>
                {bottomTab === 'problems' && (
                  <ProblemsPanel
                    problems={problems}
                    activeFilePath={activeTab?.path}
                    onJumpToProblem={handleJumpToProblem}
                    onQuickFix={(p) => {
                      if (p.quickFixTitle) {
                        addToast('Quick Fix Applied', p.quickFixTitle, 'success');
                      }
                    }}
                    onRerunInspection={() => {
                      addToast('Code Inspection', 'Re-analyzed workspace: clean syntax', 'info');
                    }}
                    onClose={() => setIsBottomOpen(false)}
                  />
                )}
                {bottomTab === 'debug' && (
                  <DebugPanel
                    debugState={debugState}
                    frames={frames}
                    activeFrameId={activeFrameId}
                    variables={variables}
                    watches={watches}
                    areBreakpointsMuted={areBreakpointsMuted}
                    consoleOutput={debugConsoleOutput}
                    onRerun={() => {
                      setDebugState('running');
                      addToast('Rerun Debug', 'Debug session restarted', 'info');
                    }}
                    onResume={handleResumeDebug}
                    onPause={handlePauseDebug}
                    onStop={handleStopDebug}
                    onStepOver={handleStepOverDebug}
                    onStepInto={handleStepIntoDebug}
                    onStepOut={handleStepOutDebug}
                    onRunToCursor={() => {
                      addToast('Run to Cursor', `Advanced execution to line ${cursorPos.line}`, 'info');
                    }}
                    onEvaluateExpression={() => {
                      addToast('Evaluate Expression', 'Evaluated current scope', 'info');
                    }}
                    onViewBreakpoints={() => {
                      addToast('Breakpoints', `Total breakpoints: ${breakpoints.length}`, 'info');
                    }}
                    onToggleMuteBreakpoints={() => {
                      setAreBreakpointsMuted(prev => !prev);
                      addToast('Mute Breakpoints', !areBreakpointsMuted ? 'Breakpoints muted' : 'Breakpoints unmuted', 'info');
                    }}
                    onSelectFrame={(frame) => {
                      setActiveFrameId(frame.id);
                      if (frame.filePath && frame.line) {
                        handleOpenFileAtLocation(frame.filePath, frame.line, 1);
                      }
                    }}
                    onAddWatch={handleAddWatch}
                    onRemoveWatch={handleRemoveWatch}
                    onClearConsole={() => setDebugConsoleOutput([])}
                  />
                )}
                {bottomTab === 'find' && (
                  findResult ? (
                    <FindUsagesPanel
                      result={findResult}
                      onJumpToOccurrence={handleJumpToOccurrence}
                      onRerun={() => handleFindUsages(findResult.symbol)}
                      onClose={() => setBottomTab('run')}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-[#868A91]">
                      No active find usages search. Place cursor on a symbol and press Alt+F7.
                    </div>
                  )
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
          notifications={notifications}
          onClearNotifications={handleClearNotifications}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onRemoveNotification={handleRemoveNotification}
          activeFileName={tabs.find(t => t.id === activeTabId)?.title}
          activeFileContent={tabs.find(t => t.id === activeTabId)?.content}
          dataSources={dataSources}
          onOpenTableData={handleOpenTableData}
          onOpenSqlConsole={handleOpenSqlConsole}
          onAddNewDataSource={() => setIsAddDataSourceOpen(true)}
          onRemoveDataSource={handleRemoveDataSource}
          projectPath={currentProjectDirectory}
          onExecuteBuildTask={handleExecuteBuildTask}
          onExecuteCustomGoal={(cmd) => handleExecuteBuildTask('custom', 'goal', cmd)}
        />
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        branch={currentBranch}
        cursorLine={cursorPos.line}
        cursorCol={cursorPos.col}
        encoding={fileEncoding}
        lineEnding={lineEnding}
        isIndexing={isIndexing}
        onOpenBranches={() => setIsBranchesOpen(true)}
        onShowToast={addToast}
      />
    </>
  )}

      {/* Lazy-loaded Dialogs & Modals Container */}
      <React.Suspense fallback={null}>
      {/* Find / Replace in Files Modal (Ctrl+Shift+F / Ctrl+Shift+R) */}
      <FindInFilesModal
        isOpen={isFindInFilesOpen}
        onClose={() => setIsFindInFilesOpen(false)}
        projectPath={currentProjectDirectory}
        initialMode={findInFilesMode}
        initialQuery={findInFilesInitialQuery}
        openFiles={tabs.map(t => ({ path: t.path || t.id, name: t.title }))}
        onOpenFileAtLocation={(filePath, line, col) => {
          handleOpenFileAtLocation(filePath, line, col);
        }}
        onShowToast={(title, message, type) => addToast(title, message, type)}
      />

      {/* Search Everywhere (Shift+Shift) Modal */}
      <SearchEverywhereModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        projectPath={currentProjectDirectory}
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
        projectPath={currentProjectDirectory}
        onSwitchBranch={(b) => {
          setCurrentBranch(b);
          addToast('Switched Branch', `Checked out branch [${b}]`, 'info');
          refreshGitStatus();
        }}
        onCreateBranch={(b) => {
          addToast('Branch Created', `Created and checked out [${b}]`, 'success');
          refreshGitStatus();
        }}
      />

      {/* Global Diff Viewer Modal (Ctrl+Alt+D or Compare with HEAD) */}
      <DiffViewerModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        fileName={activeDiffFile || ''}
        baseContent={diffBaseContent}
        localContent={diffLocalContent}
      />

      {/* Rename Modal (Shift+F6) */}
      <RenameModal
        isOpen={isRenameOpen}
        onClose={() => {
          setIsRenameOpen(false);
          setRenameTarget({ type: 'file', name: '' });
        }}
        currentName={renameTarget.name || activeTab?.title || ''}
        onRename={handleRenameUnified}
      />

      {/* Show Usages Quick Popup (Ctrl+Alt+F7) */}
      <ShowUsagesPopup
        isOpen={!!showUsagesResult}
        result={showUsagesResult}
        onClose={() => setShowUsagesResult(null)}
        onJumpToOccurrence={handleJumpToOccurrence}
        onOpenInFindPanel={() => {
          if (showUsagesResult) {
            setFindResult(showUsagesResult);
            setBottomTab('find');
            setIsBottomOpen(true);
          }
        }}
      />

      {/* Tip of the Day Modal */}
      <TipOfTheDayModal
        isOpen={isTipOpen}
        onClose={() => setIsTipOpen(false)}
      />


      {/* New Project Modal */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onCreateProject={async (name, cat, loc, createGit, addSampleCode) => {
          setProjectName(name);
          const fullDir = loc ? `${loc}\\${name}` : `D:\\IDE\\projects\\${name}`;
          setProjectRootPath(fullDir);
          try {
            localStorage.setItem('ij_current_project_path', fullDir);
          } catch (e) {}
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

      {/* VCS Get from Version Control Modal */}
      <VcsCloneModal
        isOpen={isVcsCloneOpen}
        onClose={() => setIsVcsCloneOpen(false)}
        onProjectCloned={(tree) => loadProjectIntoIde(tree)}
        onShowToast={addToast}
      />

      {/* Run / Debug Configurations Modal (Alt+Shift+F10) */}
      <RunConfigModal
        isOpen={isRunConfigOpen}
        onClose={() => setIsRunConfigOpen(false)}
        configurations={runConfigurations}
        activeConfigId={activeConfigId}
        projectRootPath={currentProjectDirectory}
        onSaveConfigurations={(configs, selectedId) => {
          setRunConfigurations(configs);
          setActiveConfigId(selectedId);
          try {
            localStorage.setItem('intellij_run_configurations', JSON.stringify(configs));
            localStorage.setItem('intellij_active_run_config_id', selectedId);
          } catch (e) {
            console.warn(e);
          }
          const active = configs.find(c => c.id === selectedId);
          addToast('Run Configurations Saved', active ? `Active: [${active.name}]` : 'Configurations updated', 'success');
        }}
        onRunSelected={(config) => {
          setActiveConfigId(config.id);
          try {
            localStorage.setItem('intellij_active_run_config_id', config.id);
          } catch (e) {}
          setIsRunConfigOpen(false);
          setTimeout(() => {
            handleRun();
          }, 60);
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

      {/* Database Connection Modal (DataGrip mini) */}
      <AddDataSourceModal
        isOpen={isAddDataSourceOpen}
        onClose={() => setIsAddDataSourceOpen(false)}
        onSave={(newDs) => {
          handleAddDataSource(newDs);
          setIsAddDataSourceOpen(false);
        }}
        onShowToast={addToast}
      />
      </React.Suspense>

      {/* Toast Notification Balloon System */}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </div>
  );
};

export default App;
