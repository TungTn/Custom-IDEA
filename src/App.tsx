import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
// ─── 1. Workbench Shell Layer ───
import {
  TopBar,
  RecentProjectItem,
  ActivityBar,
  StatusBar,
  BottomToolWindowBar,
  ToastContainer,
  ToastItem,
  RightActivityBar,
  NotificationEntry,
  WelcomeScreen,
  EditorArea as CodeEditor,
  CodeEditorHandle,
  OverlayHost,
  BottomToolWindow,
} from './workbench';
import { SurroundWithModal, SurroundType } from './editor';

// ─── 2. Feature Modules Layer ───
import {
  ProjectTree,
  OpenProjectDialog,
  TerminalPanel,
  RunConsolePanel,
  FindUsagesPanel,
  ShowUsagesPopup,
  GitToolWindow,
  StructurePanel,
  DebugPanel,
  ProblemsPanel,
  CommitPanel,
} from './features';
import type { IdeSettings } from './features';
import type { SonarAnalysisProgress } from './features/sonar/SonarToolWindow';
import { ImportSettingsModal, ExportSettingsModal } from './features/settings';
import { UpdateModal, useAutoUpdate } from './features/update';
import type { ImportedSettingsResult } from './services/intellijSettingsService';
import {
  useEditorStore,
  useModalStore,
  useLayoutStore,
  useProjectStore,
  useSettingsStore,
  useDebuggerStore,
  useNotificationStore,
  usePluginStore,
  BottomTabType,
} from './stores';
import { KeyPromoterXToast } from './workbench/plugins/KeyPromoterXToast';
import { FileNode, OpenTab, RunLog, ActionItem, UsageOccurrence, FindUsagesResult, RunConfiguration, Breakpoint, DebugState, StackFrame, VariableItem, WatchItem, ProblemItem } from './types';
import { DataSourceConnection, INITIAL_DATA_SOURCES } from './types/database';
import { lspService, uriToPath } from './services/lspService';
import { localHistoryService } from './services/localHistoryService';
import { applyIdeTheme } from './themes/themeManager';
import { IdeThemeId, SyntaxTokenColors } from './types/theme';
import { Terminal, PlaySquare, Play, Bug, AlertCircle, Search, GitBranch, Maximize2, Minus, X, Bookmark, Trash2 } from 'lucide-react';
import { detectLanguage } from './utils/languageDetector';
export { detectLanguage } from './utils/languageDetector';
import { useIdeKeybindings, useMenuDispatcher, useProcessRunner, useIdeDebugger, useProjectWorkspace } from './hooks';

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
  return '';
};

export const App: React.FC = () => {
  // ─── Domain Zustand Stores ───
  const {
    files, setFiles,
    projectRootPath, setProjectRootPath,
    projectName, setProjectName,
    recentProjects, setRecentProjects, addRecentProject,
    isReadOnly, setIsReadOnly,
    lineEnding, setLineEnding,
    fileEncoding, setFileEncoding,
  } = useProjectStore();

  const {
    activeSideTab, setActiveSideTab,
    isSideBarOpen, setIsSideBarOpen, toggleSideBar,
    sideBarWidth, setSideBarWidth,
    activeRightPanel, setActiveRightPanel,
    bottomTab, setBottomTab,
    isBottomOpen, setIsBottomOpen, toggleBottom,
    bottomHeight, setBottomHeight,
    hasOpenedTerminal, setHasOpenedTerminal,
    powerSaveMode, setPowerSaveMode,
    isStatusBarVisible,
  } = useLayoutStore();

  const {
    toasts,
    notifications,
    addToast,
    dismissToast,
    removeNotification: handleRemoveNotification,
    markAllNotificationsAsRead: handleMarkAllNotificationsRead,
    clearNotifications: handleClearNotifications,
  } = useNotificationStore();

  const { settings, setSettings } = useSettingsStore();

  const {
    keyPromoterItem,
    dismissKeyPromoter,
    disableKeyPromoter,
    notifyAction,
  } = usePluginStore();

  const {
    isSearchOpen, setIsSearchOpen,
    searchInitialTab, setSearchInitialTab,
    isFindInFilesOpen, setIsFindInFilesOpen,
    findInFilesMode, setFindInFilesMode,
    findInFilesInitialQuery, setFindInFilesInitialQuery,
    findInFilesDirectory, setFindInFilesDirectory,
    isAboutOpen, setIsAboutOpen,
    isNewFileOpen, setIsNewFileOpen,
    isSettingsOpen, setIsSettingsOpen,
    isGoToLineOpen, setIsGoToLineOpen,
    isCommitOpen, setIsCommitOpen,
    isBranchesOpen, setIsBranchesOpen,
    isRenameOpen, setIsRenameOpen,
    renameTarget, setRenameTarget,
    isSurroundWithOpen, setIsSurroundWithOpen,
    isTipOpen, setIsTipOpen,
    isRunConfigOpen, setIsRunConfigOpen,
    isVcsCloneOpen, setIsVcsCloneOpen,
    isNewProjectOpen, setIsNewProjectOpen,
    isProjectStructureOpen, setIsProjectStructureOpen,
    isInvalidateCachesOpen, setIsInvalidateCachesOpen,
    isLocalHistoryOpen, setIsLocalHistoryOpen,
    isRepairIdeOpen, setIsRepairIdeOpen,
    isImportSettingsOpen, setIsImportSettingsOpen,
    isExportSettingsOpen, setIsExportSettingsOpen,
    isThemeStudioOpen, setIsThemeStudioOpen,
    isBreakpointsOpen, setIsBreakpointsOpen,
    isStashOpen, setIsStashOpen,
    isEvaluateExpressionOpen, setIsEvaluateExpressionOpen,
    isClipboardHistoryOpen, setIsClipboardHistoryOpen,
    isStructuralSearchOpen, setIsStructuralSearchOpen,
    isOpenProjectPromptOpen, setIsOpenProjectPromptOpen,
    pendingTargetProject, setPendingTargetProject,
    isAddDataSourceOpen, setIsAddDataSourceOpen,
    activeDiffFile, setActiveDiffFile,
    diffBaseContent, setDiffBaseContent,
    diffLocalContent, setDiffLocalContent,
    isDiffModalOpen, setIsDiffModalOpen,
    isUpdateOpen, setIsUpdateOpen,
  } = useModalStore();

  const autoUpdate = useAutoUpdate(addToast);

  useEffect(() => {
    if (isUpdateOpen) {
      if (autoUpdate.status !== 'readyRestart' && autoUpdate.status !== 'downloading') {
        autoUpdate.checkNow(true);
      } else {
        autoUpdate.setIsModalOpen(true);
      }
    }
  }, [isUpdateOpen]);

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

  useEffect(() => {
      if (bottomTab === 'terminal' && isBottomOpen) {
        setHasOpenedTerminal(true);
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
          }, 50);
      }
    }, [bottomTab, isBottomOpen]);

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

  // Git branch & status
  const [currentBranch, setCurrentBranch] = useState('main');

  // SonarQube for IDE Analysis States
  const [sonarAnalysisState, setSonarAnalysisState] = useState<SonarAnalysisProgress | null>(null);
  const [sonarTargetScanPath, setSonarTargetScanPath] = useState<{ path: string; isFolder: boolean; timestamp: number } | null>(null);
  const [sonarCancelSignal, setSonarCancelSignal] = useState(0);

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

  // Listen to keymap profile and shortcut customization changes
  useEffect(() => {
    const handleKeymapChanged = (e: any) => {
      const { profile, keymaps } = e.detail || {};
      setSettings(prev => ({
        ...prev,
        keymapProfile: profile,
        customKeymaps: keymaps,
      }));
    };
    window.addEventListener('ide-keymap-changed', handleKeymapChanged);
    return () => window.removeEventListener('ide-keymap-changed', handleKeymapChanged);
  }, []);

  // Synchronize settings with backend daemons (Git binary, Docker CLI/socket, LSP server paths)
  useEffect(() => {
      if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        return;
      }

      // 1. Sync custom git executable path
      if (settings.gitPath) {
        invoke('set_git_executable_path', { path: settings.gitPath.trim() || null }).catch((e) =>
          console.warn('Failed to sync git path to backend:', e)
        );
      }

      // 2. Sync custom docker configuration
      invoke('docker_set_config', {
          cliPath: settings.dockerCliPath ? settings.dockerCliPath.trim() || null : null,
          socketPath: settings.dockerSocketPath ? settings.dockerSocketPath.trim() || null : null,
      }).catch((e) => console.warn('Failed to sync docker config to backend:', e));

      // 3. Sync custom toolchains to ide-lsp if configured
      if (settings.goRoot) {
        invoke('lsp_set_server_path', { lang: 'go', customPath: `${settings.goRoot}\\bin\\gopls.exe` }).catch(() => {});
      }
    }, [settings.gitPath, settings.dockerCliPath, settings.dockerSocketPath, settings.goRoot]);

  // Synchronize active theme with document styles, body class and Monaco Editor
  useEffect(() => {
    if (settings.theme) {
      applyIdeTheme(settings.theme);
    }
  }, [settings.theme]);

  // Zustand Editor Store
  const {
    tabs,
    activeTabId,
    setTabs,
    selectTab: setActiveTabId,
    cursorPos,
    setCursorPos,
    editorEngine,
    toggleEditorEngine,
  } = useEditorStore();

  const handleAnalyzeWithSonar = useCallback((path?: string, isFolder?: boolean) => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    const targetPath = path || activeTab?.path || activeTab?.title;
    if (!targetPath) {
      addToast('SonarQube for IDE', 'No file selected to analyze.', 'info');
      return;
    }
    setIsBottomOpen(true);
    setBottomTab('sonar');
    setSonarTargetScanPath({
      path: targetPath,
      isFolder: Boolean(isFolder),
      timestamp: Date.now(),
    });
  }, [tabs, activeTabId, setIsBottomOpen, setBottomTab, addToast]);

  const handleExcludeSonarPath = useCallback((targetPath: string) => {
    addToast('SonarQube for IDE', `Excluded "${targetPath}" from Sonar analysis`, 'info');
  }, [addToast]);


    // Save All Dirty Files to Disk (Authentic IntelliJ IDEA)
  const saveAllFiles = useCallback(async (isManual = false) => {
      if (settings.autoFormatOnSave) {
        try {
          await codeEditorRef.current?.formatDocument();
        } catch (e) {
          console.warn('Auto-format on save failed:', e);
        }
      }

      const dirtyTabs = tabs.filter(t => t.isDirty);
      if (dirtyTabs.length === 0) return;

      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        for (const tab of dirtyTabs) {
          if (tab.path && (tab.path.includes('/') || tab.path.includes('\\'))) {
            try {
              await invoke('save_file_content', { path: tab.path, content: tab.content });
              localHistoryService.recordSnapshot(tab.path, tab.content, isManual ? 'Manual Save (Ctrl+S)' : 'Auto-save');
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
    }, [tabs, settings.autoFormatOnSave, addToast, refreshGitStatus]);

  // Handle Save (Ctrl+S or Save All action) - Silent in IntelliJ IDEA
  const handleSaveActive = useCallback(async () => {
      await saveAllFiles(true);
    }, [saveAllFiles]);




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
  const handleReopenClosedTabRef = useRef<() => void>(() => {});

  // Find in Files Helper
  const handleOpenFindInFiles = (targetMode: 'find' | 'replace' = 'find', folderPath?: string) => {
    const wordAtCursor = codeEditorRef.current?.getWordAtCursor() || '';
    setFindInFilesMode(targetMode);
    setFindInFilesInitialQuery(wordAtCursor);
    setFindInFilesDirectory(folderPath || '');
    setIsFindInFilesOpen(true);
    addToast(targetMode === 'find' ? 'Find in Files' : 'Replace in Files', targetMode === 'find' ? 'Ctrl+Shift+F' : 'Ctrl+Shift+R', 'info');
  };

  const handleOpenFileAtLocation = async (filePath: string, line: number, col: number = 1) => {
    const normProj = (currentProjectDirectory || 'D:/IDE').replace(/\\/g, '/');
    const normFile = filePath.replace(/\\/g, '/');
    const fullPath = filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath) ? filePath : `${normProj}/${normFile}`;

    let existingTab = tabs.find(t => t.path === fullPath || t.id === fullPath || t.path === filePath || t.id === filePath);
    
    // Always ensure file content is loaded if tab is empty
    if (!existingTab || !existingTab.content) {
      let fileContent = '';
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        try {
          fileContent = await invoke<string>('read_file_content', { path: fullPath });
        } catch (e) {
          console.warn('Failed to read file at:', fullPath, e);
        }
      }
      const fileName = filePath.split(/[\/\\]/).pop() || 'Untitled';
      const language = detectLanguage(fileName);
      
      if (existingTab) {
        setTabs(prev => prev.map(t => t.id === existingTab!.id ? { ...t, content: fileContent, path: fullPath } : t));
      } else {
        const newTab: OpenTab = {
          id: fullPath,
          title: fileName,
          path: fullPath,
          content: fileContent,
          language,
          isDirty: false,
        };
        setTabs(prev => [...prev, newTab]);
        existingTab = newTab;
      }
    }

    setActiveTabId(existingTab ? existingTab.id : fullPath);
    setTimeout(() => {
      codeEditorRef.current?.revealPosition(line, col, 0);
    }, 100);
  };

  // Database Data Sources (DataGrip mini)
  const [dataSources, setDataSources] = useState<DataSourceConnection[]>(() => {
      try {
        const saved = localStorage.getItem('intellij_data_sources');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return parsed.filter((d: any) => d.id !== 'ds-sqlite-app' && d.id !== 'ds-pg-ecommerce');
          }
        }
      } catch (e) {
        console.warn('Failed to parse saved data sources:', e);
      }
      return [];
  });

  const handleSelectTabSize = useCallback((newSize: number) => {
    setSettings(prev => {
      const updated = { ...prev, tabSize: newSize };
      try {
        localStorage.setItem('intellij_ide_settings', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    addToast('Indentation Changed', `Indentation set to ${newSize} spaces`, 'info');
  }, [addToast]);

  const handleSelectLineEnding = useCallback((newLe: 'CRLF' | 'LF') => {
    setLineEnding(newLe);
    if (activeTabId) {
      setTabs(prev => prev.map(t => {
        if (t.id === activeTabId && t.content) {
          const converted = newLe === 'CRLF' 
            ? t.content.replace(/\r?\n/g, '\r\n') 
            : t.content.replace(/\r\n/g, '\n');
          return { ...t, content: converted, isDirty: true };
        }
        return t;
      }));
    }
    addToast('Line Separator', `Changed to ${newLe}`, 'info');
  }, [activeTabId, addToast, setTabs]);

  const handleSelectEncoding = useCallback((newEnc: string) => {
    setFileEncoding(newEnc);
    addToast('File Encoding', `Encoding changed to ${newEnc}`, 'info');
  }, [addToast]);


  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);

  // ─── Process Execution & Build Runner Hook (Extracted in Phase 7) ───
  const {
    isRunning,
    setIsRunning,
    runLogs,
    setRunLogs,
    runConfigurations,
    setRunConfigurations,
    activeConfigId,
    setActiveConfigId,
    handleRun,
    handleStop,
    handleBuild,
    handleExecuteBuildTask,
    detectDefaultConfigurations,
  } = useProcessRunner({
    currentProjectDirectory,
    files,
    saveAllFiles,
    addToast,
    setBottomTab,
    setIsBottomOpen,
  });

  // ─── Workspace & Project Operations Hook (Extracted in Phase 8) ───
  const {
    saveRecentProject,
    handleRemoveRecentProject,
    loadProjectIntoIde,
    handleOpenNewWindow,
    handleAttachProject,
    requestOpenProject,
    handleOpenProject,
    handleOpenProjectPath,
    isIndexing,
    syncProjectFilesFromDisk,
    handleCreateNewProject,
    handleCreateFile,
    handleCreateFolder,
    handleDeleteFile,
    handleRenameFile,
  } = useProjectWorkspace({
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    reopenProjectsOnStartup: !!settings.reopenProjectsOnStartup,
    refreshGitStatus,
    detectDefaultConfigurations,
    setRunConfigurations,
    setActiveConfigId,
    runConfigurationsLength: runConfigurations.length,
    setPendingTargetProject,
    setIsOpenProjectPromptOpen,
    addToast,
  });

  // ─── Debugger DAP Orchestration Hook (Extracted in Phase 7) ───
  const {
    frames,
    variables,
    breakpoints,
    setBreakpoints,
    debugState,
    setDebugState,
    activeFrameId,
    setActiveFrameId,
    areBreakpointsMuted,
    setAreBreakpointsMuted,
    debugConsoleOutput,
    setDebugConsoleOutput,
    watches,
    setWatches,
    handleToggleBreakpoint,
    handleUpdateBreakpoint,
    handleRemoveBreakpoint,
    handleResumeDebug,
    handlePauseDebug,
    handleStopDebug,
    handleStepOverDebug,
    handleStepIntoDebug,
    handleStepOutDebug,
    handleStartDebug,
    handleRunToCursor,
    handleAddWatch,
    handleRemoveWatch,
  } = useIdeDebugger({
    activeTab,
    cursorPos,
    setCursorPos,
    codeEditorRef,
    currentProjectDirectory,
    runConfigurations,
    activeConfigId,
    handleOpenFileAtLocation,
    addToast,
    setBottomTab,
    setIsBottomOpen,
  });



  const handleGoToTest = useCallback(async () => {
    if (!activeTab || !activeTab.path) {
      handleReopenClosedTabRef.current();
      return;
    }

    const curPath = activeTab.path;
    const isTestFile =
      curPath.includes('.test.') ||
      curPath.includes('.spec.') ||
      curPath.includes('_test.rs') ||
      curPath.includes('Test.java');

    if (isTestFile) {
      // Jump back to source file
      const sourcePath = curPath
        .replace(/\.test\./, '.')
        .replace(/\.spec\./, '.')
        .replace(/_test\.rs$/, '.rs')
        .replace(/Test\.java$/, '.java')
        .replace(/[\\/]tests[\\/]/, '/src/')
        .replace(/[\\/]src[\\/]test[\\/]/, '/src/main/');

      handleOpenFileAtLocation(sourcePath, 1, 1);
      addToast('Navigated to Source', sourcePath.split(/[\/\\]/).pop(), 'info');
      return;
    }

    // Current is source file -> find or suggest creating test file
    let candidateTestPath = '';
    if (curPath.endsWith('.ts') || curPath.endsWith('.tsx') || curPath.endsWith('.js') || curPath.endsWith('.jsx')) {
      candidateTestPath = curPath.replace(/\.(tsx?|jsx?)$/, '.test.$1');
    } else if (curPath.endsWith('.rs')) {
      candidateTestPath = curPath.replace(/\.rs$/, '_test.rs');
    } else if (curPath.endsWith('.java')) {
      candidateTestPath = curPath.replace(/\.java$/, 'Test.java');
    } else {
      candidateTestPath = `${curPath}.test`;
    }

    // Try reading candidate test file from disk or creating boilerplate
    try {
      const content = await invoke<string>('read_file_content', { path: candidateTestPath });
      if (content !== undefined) {
        handleOpenFileAtLocation(candidateTestPath, 1, 1);
        addToast('Navigated to Test', candidateTestPath.split(/[\/\\]/).pop(), 'success');
        return;
      }
    } catch (e) {
      // Create boilerplate test file
      const testFileName = candidateTestPath.split(/[\/\\]/).pop() || 'test';
      const baseName = activeTab.title.replace(/\.[^/.]+$/, '');
      const boilerplate =
        curPath.endsWith('.ts') || curPath.endsWith('.tsx')
          ? `import { describe, it, expect } from 'vitest';\n\ndescribe('${baseName}', () => {\n  it('should work correctly', () => {\n    expect(true).toBe(true);\n  });\n});\n`
          : curPath.endsWith('.rs')
          ? `#[cfg(test)]\nmod tests {\n    #[test]\n    fn test_${baseName.toLowerCase()}() {\n        assert_eq!(2 + 2, 4);\n    }\n}\n`
          : `// Test suite for ${baseName}\n`;

      try {
        await invoke('write_file_content', { path: candidateTestPath, content: boilerplate });
      } catch (_) {}

      handleOpenFileAtLocation(candidateTestPath, 1, 1);
      addToast('Created Test', testFileName, 'success');
    }
  }, [activeTab, handleOpenFileAtLocation, addToast]);


  // ─── Problems State & Inspections (Real LSP Diagnostics + Workspace Inspection) ───
  const [diagnosticsMap, setDiagnosticsMap] = useState<Map<string, ProblemItem[]>>(new Map());
  const [inspectionProblems, setInspectionProblems] = useState<ProblemItem[]>([]);
  const [isInspecting, setIsInspecting] = useState(false);

  // Merge diagnostics from open files and workspace inspection
  const problems = useMemo<ProblemItem[]>(() => {
    const combined: ProblemItem[] = [];
    const seen = new Set<string>();

    // Add LSP diagnostics
    for (const items of diagnosticsMap.values()) {
      for (const item of items) {
        const key = `${item.filePath}:${item.line}:${item.column}:${item.message}`;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(item);
        }
      }
    }

    // Add background inspection problems (rustc / tsc)
    for (const item of inspectionProblems) {
      const key = `${item.filePath}:${item.line}:${item.column}:${item.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(item);
      }
    }

    return combined;
  }, [diagnosticsMap, inspectionProblems]);

  // Subscribe to real-time LSP diagnostics
  useEffect(() => {
    const unsub = lspService.onDiagnostics((params) => {
      const filePath = uriToPath(params.uri);
      const fileName = filePath.split(/[\\/]/).pop() || 'file';

      const items: ProblemItem[] = (params.diagnostics || []).map((d, index) => {
        let severity: 'error' | 'warning' | 'info' = 'info';
        if (d.severity === 1) severity = 'error';
        else if (d.severity === 2) severity = 'warning';

        return {
          id: `lsp-${filePath}-${d.range.start.line}-${d.range.start.character}-${index}`,
          filePath,
          fileName,
          line: d.range.start.line + 1,
          column: d.range.start.character + 1,
          message: d.message,
          severity,
          source: d.source || 'LSP',
          code: d.code !== undefined ? String(d.code) : undefined,
        };
      });

      setDiagnosticsMap(prev => {
        const next = new Map(prev);
        if (items.length > 0) {
          next.set(filePath, items);
        } else {
          next.delete(filePath);
        }
        return next;
      });
    });

    return () => unsub();
  }, []);

  // Run real workspace-wide compiler inspection (e.g. cargo check or tsc)
  const runProjectInspection = useCallback(async () => {
    if (!currentProjectDirectory || isInspecting) return;
    setIsInspecting(true);
    addToast('Inspection', 'Inspecting project files...', 'info');

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        // Detect project type by presence of Cargo.toml or tsconfig.json / package.json
        const hasCargo = files.some(f => f.name === 'Cargo.toml');
        const hasTs = files.some(f => f.name === 'tsconfig.json' || f.name === 'package.json');

        const newProblems: ProblemItem[] = [];

        if (hasCargo) {
          const res = await invoke<{ stdout: string; stderr: string; exit_code: number }>('execute_build_command', {
            command: 'cargo',
            args: ['check', '--message-format=json'],
            cwd: currentProjectDirectory,
          }).catch(() => null);

          if (res?.stdout) {
            const lines = res.stdout.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('{')) continue;
              try {
                const parsed = JSON.parse(trimmed);
                if (parsed.reason === 'compiler-message' && parsed.message) {
                  const msg = parsed.message;
                  const primarySpan = msg.spans?.find((s: any) => s.is_primary) || msg.spans?.[0];
                  if (primarySpan) {
                    const filePath = primarySpan.file_name.startsWith('/') || /^[a-zA-Z]:/.test(primarySpan.file_name)
                      ? primarySpan.file_name
                      : `${currentProjectDirectory}/${primarySpan.file_name}`.replace(/\\/g, '/');
                    const fileName = filePath.split(/[\\/]/).pop() || '';
                    newProblems.push({
                      id: `cargo-${filePath}-${primarySpan.line_start}-${primarySpan.column_start}`,
                      filePath,
                      fileName,
                      line: primarySpan.line_start,
                      column: primarySpan.column_start,
                      message: msg.rendered || msg.message,
                      severity: msg.level === 'error' ? 'error' : msg.level === 'warning' ? 'warning' : 'info',
                      source: `rustc (${msg.code?.code || 'check'})`,
                    });
                  }
                }
              } catch (_) {}
            }
          }
        } else if (hasTs) {
          const res = await invoke<{ stdout: string; stderr: string; exit_code: number }>('execute_build_command', {
            command: 'npx',
            args: ['tsc', '--noEmit', '--pretty', 'false'],
            cwd: currentProjectDirectory,
          }).catch(() => null);

          if (res?.stdout) {
            // Parse tsc format: path/to/file.ts(line,col): error TS1234: Message
            const tscRegex = /^(.+)\((\d+),(\d+)\):\s*(error|warning)\s*([A-Za-z0-9]+):\s*(.+)$/gm;
            let match;
            while ((match = tscRegex.exec(res.stdout)) !== null) {
              const relPath = match[1].trim();
              const fullPath = relPath.startsWith('/') || /^[a-zA-Z]:/.test(relPath)
                ? relPath
                : `${currentProjectDirectory}/${relPath}`.replace(/\\/g, '/');
              const fileName = fullPath.split(/[\\/]/).pop() || '';
              newProblems.push({
                id: `tsc-${fullPath}-${match[2]}-${match[3]}`,
                filePath: fullPath,
                fileName,
                line: parseInt(match[2], 10),
                column: parseInt(match[3], 10),
                message: match[6].trim(),
                severity: match[4] === 'error' ? 'error' : 'warning',
                source: `tsc (${match[5]})`,
                code: match[5],
              });
            }
          }
        }

        setInspectionProblems(newProblems);
        addToast(
          'Inspection Completed',
          newProblems.length === 0
            ? 'No problems found in workspace'
            : `Found ${newProblems.length} problem${newProblems.length === 1 ? '' : 's'}`,
          newProblems.length === 0 ? 'success' : 'info'
        );
      }
    } catch (e) {
      console.warn('Project inspection error:', e);
      addToast('Inspection Warning', 'Unable to complete workspace inspection', 'warning');
    } finally {
      setIsInspecting(false);
    }
  }, [currentProjectDirectory, files, isInspecting, addToast]);

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
                schemas: ds.schemas.map((s: any) => {
                    if (s.name !== schema) return s;
                    return {
                      ...s,
                      tables: s.tables.map((t: any) => {
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




  const handleApplyTheme = useCallback((themeId: IdeThemeId, customSyntax?: Partial<SyntaxTokenColors>) => {
    applyIdeTheme(themeId, customSyntax);
    setSettings(prev => {
      const updated = { ...prev, theme: themeId };
      try {
        localStorage.setItem('intellij_ide_settings', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save settings', e);
      }
      return updated;
    });
    addToast('Theme Applied', `Theme switched to ${themeId}`, 'success');
  }, [addToast]);

  const handleApplyImportedSettings = useCallback((result: ImportedSettingsResult) => {
    setSettings(prev => {
      const merged = { ...prev, ...result.updatedSettings };
      try {
        localStorage.setItem('intellij_ide_settings', JSON.stringify(merged));
      } catch (e) {
        console.warn('Failed to persist imported settings:', e);
      }
      return merged;
    });

    if (result.updatedSettings.theme) {
      handleApplyTheme(result.updatedSettings.theme);
    }

    if (result.customJdks && result.customJdks.length > 0) {
      try {
        localStorage.setItem('intellij_custom_jdks', JSON.stringify(result.customJdks));
      } catch (e) {
        console.warn('Failed to save imported custom JDKs:', e);
      }
    }

    if (result.customKeymap && Object.keys(result.customKeymap).length > 0) {
      try {
        localStorage.setItem('intellij_custom_keymap', JSON.stringify(result.customKeymap));
      } catch (e) {
        console.warn('Failed to save imported custom keymaps:', e);
      }

      const flattened: Record<string, string> = {};
      for (const [actionId, shortcuts] of Object.entries(result.customKeymap)) {
        if (shortcuts && shortcuts.length > 0) {
          flattened[actionId] = shortcuts[0];
        }
      }

      setSettings(prev => {
        const updated = {
          ...prev,
          customKeymaps: { ...(prev.customKeymaps || {}), ...flattened },
        };
        try {
          localStorage.setItem('intellij_ide_settings', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      window.dispatchEvent(
        new CustomEvent('ide-keymap-changed', {
          detail: {
            profile: result.updatedSettings.keymapProfile || 'custom',
            keymaps: flattened,
          },
        })
      );
    }

    addToast(
      'Settings Imported',
      `Applied components: ${result.appliedCategories.join(', ')}`,
      'success'
    );
  }, [handleApplyTheme, addToast]);

  const handleStash = useCallback((message: string, keepIndex: boolean) => {
    invoke('git_stash_save', {
      projectPath: currentProjectDirectory,
      message,
      keepIndex,
    })
    .then(() => {
      addToast('Git Stash', `Changes stashed: "${message}"`, 'success');
      refreshGitStatus();
      syncProjectFilesFromDisk();
    })
    .catch(e => addToast('Git Stash Failed', String(e), 'error'));
  }, [currentProjectDirectory, refreshGitStatus, syncProjectFilesFromDisk, addToast]);




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

  // Rename File (Real VFS disk move)
  const handleRenameActive = useCallback(async (newName: string) => {
    if (!activeTabId || !newName) return;
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (!currentTab || currentTab.title === newName) return;

    const oldPath = currentTab.path;
    const normSource = oldPath.replace(/\\/g, '/');
    const parentPath = normSource.includes('/') ? normSource.replace(/\/[^/]+$/, '') : '';
    const destPath = parentPath ? `${parentPath}/${newName}` : newName;

    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      try {
        await invoke('vfs_move_path', { sourcePath: oldPath, destPath });
      } catch (err) {
        console.warn('VFS rename error:', err);
        addToast('Rename Error', `Failed to rename file on disk: ${err}`, 'error');
        return;
      }
    }

    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId || t.path === oldPath) {
        return { ...t, id: destPath, title: newName, path: destPath };
      }
      return t;
    }));
    setActiveTabId(destPath);

    // Update in files tree
    const renameInTree = (list: FileNode[]): FileNode[] => {
      return list.map(item => {
        if (item.id === currentTab.id || item.path === oldPath) {
          return { ...item, id: destPath, name: newName, path: destPath };
        }
        if (item.children) {
          return { ...item, children: renameInTree(item.children) };
        }
        return item;
      });
    };
    setFiles(prev => renameInTree(prev));

    addToast('Renamed', `File renamed to ${newName}`, 'success');
  }, [activeTabId, tabs, addToast]);

  // Find Usages in Project (Authentic IntelliJ IDEA)
  const findUsagesInProject = useCallback(async (symbol: string): Promise<FindUsagesResult> => {
    const trimmed = symbol.trim();
    if (!trimmed) return { symbol: '', occurrences: [] };

    const escaped = trimmed.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const wordRegex = new RegExp(`\\b${escaped}\\b`);

    const occurrences: UsageOccurrence[] = [];
    const seenMap = new Set<string>();

    const projectRoot = currentProjectDirectory || (tabs[0]?.path ? (tabs[0].path.includes('\\') ? tabs[0].path.substring(0, tabs[0].path.lastIndexOf('\\')) : '.') : '.');

    // Helper to detect enclosing scope (e.g. buildMonacoTheme, getThemeById)
    const detectEnclosingScope = (lines: string[], lineIndex: number): string | undefined => {
      for (let i = Math.max(0, lineIndex - 1); i >= Math.max(0, lineIndex - 60); i--) {
        const l = lines[i].trim();
        const arrowMatch = l.match(/(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)?\s*=>/);
        if (arrowMatch) return arrowMatch[1];

        const fnMatch = l.match(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/);
        if (fnMatch) return fnMatch[1];

        const methodMatch = l.match(/^([a-zA-Z0-9_$]+)\s*(?::\s*(?:async\s*)?\([^)]*\)\s*=>|\([^)]*\)\s*(?::\s*[^={]+)?\s*\{)/);
        if (methodMatch && !['if', 'for', 'while', 'switch', 'catch'].includes(methodMatch[1])) {
          return methodMatch[1];
        }

        const classMatch = l.match(/(?:export\s+)?(?:class|interface)\s+([a-zA-Z0-9_$]+)/);
        if (classMatch) return classMatch[1];
      }
      return undefined;
    };

    // Cache file lines for scope detection
    const fileLinesCache: Record<string, string[]> = {};

    // 1. First attempt semantic LSP references if file and cursor context are available
    const activeTab = tabs.find(t => t.id === activeTabId);
    let lspReferencesFound = false;

    if (activeTab && cursorPos) {
      try {
        const refs = await lspService.getReferences(
          activeTab.path,
          { line: Math.max(0, cursorPos.line - 1), character: Math.max(0, cursorPos.col - 1) },
          true
        );

        if (refs && refs.length > 0) {
          lspReferencesFound = true;
          for (const ref of refs) {
            const filePath = uriToPath(ref.uri);
            const fileName = filePath.split(/[\\/]/).pop() || '';
            const relPath = filePath.replace(projectRoot, '').replace(/^[\\/]/, '');
            const lineNum = ref.range.start.line + 1;
            const colNum = ref.range.start.character + 1;
            const key = `${filePath}:${lineNum}:${colNum}`;

            if (seenMap.has(key)) continue;
            seenMap.add(key);

            // Fetch line content
            let fileLines = fileLinesCache[filePath];
            if (!fileLines) {
              const openTab = tabs.find(t => t.path === filePath);
              if (openTab && openTab.content) {
                fileLines = openTab.content.split('\n');
              } else if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
                try {
                  const content = await invoke<string>('read_file_content', { path: filePath });
                  fileLines = content.split('\n');
                } catch (_) {
                  fileLines = [];
                }
              } else {
                fileLines = [];
              }
              fileLinesCache[filePath] = fileLines;
            }

            const rawLine = fileLines[ref.range.start.line] || '';
            const trimmedLine = rawLine.trim();

            let usageType: 'import' | 'declaration' | 'usage' = 'usage';
            let declarationKind: string | undefined;

            if (trimmedLine.startsWith('import ') || trimmedLine.includes('from \'') || trimmedLine.includes('from "') || trimmedLine.startsWith('use ')) {
              usageType = 'import';
            } else {
              const declMatch = trimmedLine.match(new RegExp(`\\b(class|interface|type|enum|function|const|let|var|fn|struct|pub struct|pub fn)\\s+${escaped}\\b`));
              if (declMatch) {
                usageType = 'declaration';
                declarationKind = declMatch[1].replace('pub ', '');
              }
            }

            const enclosingScope = detectEnclosingScope(fileLines, ref.range.start.line);

            occurrences.push({
              id: `${filePath}-${lineNum}-${colNum}`,
              fileId: filePath,
              fileName,
              filePath,
              relativePath: relPath,
              lineNumber: lineNum,
              columnNumber: colNum,
              lineContent: rawLine,
              matchText: trimmed,
              matchStart: colNum - 1,
              matchEnd: colNum - 1 + trimmed.length,
              usageType,
              declarationKind,
              enclosingScope,
            });
          }
        }
      } catch (e) {
        console.warn('LSP getReferences error, falling back to disk search:', e);
      }
    }

    // 2. Search disk files via Rust Tauri command (if LSP not used or fallback needed)
    let backendHits: Array<{
      file_name: string;
      file_path: string;
      relative_path: string;
      line_number: number;
      line_content: string;
      match_start: number;
      match_end: number;
    }> = [];

    if (!lspReferencesFound && typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) && projectRoot) {
      try {
        backendHits = await invoke<any[]>('search_project_text', {
          projectPath: projectRoot,
          query: trimmed,
          caseSensitive: true,
          limit: 300,
        }).catch(() => []);
      } catch (e) {
        console.warn('Backend search_project_text error:', e);
      }
    }

    for (const hit of backendHits) {
      if (!wordRegex.test(hit.line_content)) continue;

      const trimmedLine = hit.line_content.trim();
      let usageType: 'import' | 'declaration' | 'usage' = 'usage';
      let declarationKind: string | undefined;

      if (trimmedLine.startsWith('import ') || trimmedLine.includes('from \'') || trimmedLine.includes('from "') || trimmedLine.startsWith('use ')) {
        usageType = 'import';
      } else {
        const declMatch = trimmedLine.match(new RegExp(`\\b(class|interface|type|enum|function|const|let|var|fn|struct|pub struct|pub fn)\\s+${escaped}\\b`));
        if (declMatch) {
          usageType = 'declaration';
          declarationKind = declMatch[1].replace('pub ', '');
        }
      }

      // Check scope
      if (!fileLinesCache[hit.file_path]) {
        const openTab = tabs.find(t => t.path === hit.file_path);
        if (openTab && openTab.content) {
          fileLinesCache[hit.file_path] = openTab.content.split('\n');
        }
      }

      let enclosingScope: string | undefined;
      const lines = fileLinesCache[hit.file_path];
      if (lines && hit.line_number > 0 && hit.line_number <= lines.length) {
        enclosingScope = detectEnclosingScope(lines, hit.line_number - 1);
      }

      const matchCol = hit.match_start + 1;
      const key = `${hit.file_path}:${hit.line_number}:${matchCol}`;
      seenMap.add(key);

      occurrences.push({
        id: `${hit.file_path}-${hit.line_number}-${matchCol}`,
        fileId: hit.file_path,
        fileName: hit.file_name,
        filePath: hit.file_path,
        relativePath: hit.relative_path,
        lineNumber: hit.line_number,
        columnNumber: matchCol,
        lineContent: hit.line_content,
        matchText: trimmed,
        matchStart: hit.match_start,
        matchEnd: hit.match_end,
        usageType,
        declarationKind,
        enclosingScope,
      });
    }

    // 2. Also search all currently open tabs (including unsaved edits)
    for (const tab of tabs) {
      if (!tab.content) continue;
      const lines = tab.content.split('\n');
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const lineContent = lines[lineIdx];
        if (wordRegex.test(lineContent)) {
          const matchCol = lineContent.indexOf(trimmed) + 1;
          const key = `${tab.path}:${lineIdx + 1}:${matchCol}`;
          if (seenMap.has(key)) continue;
          seenMap.add(key);

          const trimmedLine = lineContent.trim();
          let usageType: 'import' | 'declaration' | 'usage' = 'usage';
          let declarationKind: string | undefined;

          if (trimmedLine.startsWith('import ') || trimmedLine.includes('from \'') || trimmedLine.includes('from "') || trimmedLine.startsWith('use ')) {
            usageType = 'import';
          } else {
            const declMatch = trimmedLine.match(new RegExp(`\\b(class|interface|type|enum|function|const|let|var|fn|struct|pub struct|pub fn)\\s+${escaped}\\b`));
            if (declMatch) {
              usageType = 'declaration';
              declarationKind = declMatch[1].replace('pub ', '');
            }
          }

          const enclosingScope = detectEnclosingScope(lines, lineIdx);
          const relPath = tab.path.replace(projectRoot, '').replace(/^[\\/]/, '');

          occurrences.push({
            id: `${tab.id}-${lineIdx + 1}-${matchCol}`,
            fileId: tab.id,
            fileName: tab.title,
            filePath: tab.path,
            relativePath: relPath,
            lineNumber: lineIdx + 1,
            columnNumber: matchCol,
            lineContent: lineContent,
            matchText: trimmed,
            matchStart: matchCol - 1,
            matchEnd: matchCol - 1 + trimmed.length,
            usageType,
            declarationKind,
            enclosingScope,
          });
        }
      }
    }

    // Sort occurrences: declarations first, then usages by path, then imports
    occurrences.sort((a, b) => {
      const typeOrder = { declaration: 0, usage: 1, import: 2 };
      if (typeOrder[a.usageType] !== typeOrder[b.usageType]) {
        return typeOrder[a.usageType] - typeOrder[b.usageType];
      }
      if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath);
      return a.lineNumber - b.lineNumber;
    });

    return {
      symbol: trimmed,
      occurrences,
    };
  }, [currentProjectDirectory, tabs, activeTabId, cursorPos]);

  const handleFindUsages = useCallback(async (symbol: string) => {
    const res = await findUsagesInProject(symbol);
    setFindResult(res);
    setBottomTab('find');
    setIsBottomOpen(true);
    addToast('Find Usages', `Found ${res.occurrences.length} usage${res.occurrences.length === 1 ? '' : 's'} of "${symbol}" in project`, 'info');
  }, [findUsagesInProject, addToast]);

  const handleShowUsages = useCallback(async (symbol: string) => {
    const res = await findUsagesInProject(symbol);
    setShowUsagesResult(res);
  }, [findUsagesInProject]);

  const handleJumpToOccurrence = useCallback(async (occ: UsageOccurrence) => {
    let targetTab = tabs.find(t => t.path === occ.filePath || t.id === occ.fileId);
    if (!targetTab) {
      let content = '';
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) && occ.filePath) {
        try {
          content = await invoke<string>('read_file_content', { path: occ.filePath });
        } catch (e) {
          console.warn('Failed to read file for occurrence:', e);
        }
      }
      const title = occ.fileName || occ.filePath.split(/[\\/]/).pop() || 'Untitled';
      const ext = title.split('.').pop()?.toLowerCase() || 'plaintext';
      const newTab: OpenTab = {
        id: occ.filePath,
        title,
        path: occ.filePath,
        content,
        language: ext,
        isDirty: false,
      };
      setTabs(prev => [...prev, newTab]);
      targetTab = newTab;
    }

    if (targetTab) {
      setActiveTabId(targetTab.id);
      setTimeout(() => {
        codeEditorRef.current?.revealPosition(occ.lineNumber, occ.columnNumber, occ.matchText.length);
      }, 80);
    }
  }, [tabs]);

  const handleOpenRenameSymbol = useCallback((symbol: string) => {
      const word = symbol || codeEditorRef.current?.getWordAtCursor() || '';
      if (word) {
        setRenameTarget({ type: 'symbol', name: word });
        setIsRenameOpen(true);
      } else {
        addToast('Rename', 'Place cursor on a symbol or select text to rename (Shift+F6)', 'info');
      }
    }, [addToast]);

  const handleRenameUnified = useCallback(async (newName: string) => {
      if (renameTarget.type === 'symbol') {
        const oldSym = renameTarget.name;
        if (!oldSym || !newName || oldSym === newName) return;

        let appliedViaLsp = false;
        const currentTab = tabs.find(t => t.id === activeTabId);

        if (currentTab && cursorPos) {
          try {
            const lspEdit = await lspService.renameSymbol(
              currentTab.path,
              { line: Math.max(0, cursorPos.line - 1), character: Math.max(0, cursorPos.col - 1) },
              newName
            );

            if (lspEdit && (lspEdit.changes || lspEdit.documentChanges)) {
              const { appliedCount, filesChanged } = await lspService.applyWorkspaceEdit(lspEdit);
              if (appliedCount > 0) {
                appliedViaLsp = true;
                // Reload any modified tabs that are currently open
                for (const fPath of filesChanged) {
                  try {
                    const content = await invoke<string>('read_file_content', { path: fPath });
                    setTabs(prev => prev.map(t => t.path === fPath ? { ...t, content, isDirty: false } : t));
                  } catch (_) {}
                }
                addToast('Rename Successful', `Renamed "${oldSym}" to "${newName}" across ${filesChanged.length} file(s) via LSP`, 'success');
              }
            }
          } catch (err) {
            console.warn('LSP rename error, falling back to lexical replace:', err);
          }
        }

        if (!appliedViaLsp) {
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
        }

        setRenameTarget({ type: 'symbol', name: '' });
      } else {
        handleRenameActive(newName);
      }
    }, [renameTarget, tabs, activeTabId, cursorPos, handleRenameActive, addToast]);

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

  // Master Menu Dispatcher & Global Keybindings
  const { handleMenuAction } = useMenuDispatcher({
    codeEditorRef,
    currentProjectDirectory,
    projectName,
    currentBranch,
    cursorPos,
    handleSaveActive,
    handleCloseActiveTab,
    handleRun,
    handleStop,
    handleBuild,
    handleStartDebug,
    handleStopDebug,
    handleStepOverDebug,
    handleStepIntoDebug,
    handleStepOutDebug,
    handleResumeDebug,
    handleToggleBreakpoint,
    handleOpenProject,
    handleOpenProjectPath,
    handleOpenFindInFiles,
    handleOpenCurrentFileDiff,
    handleFindUsages,
    handleShowUsages,
    refreshGitStatus,
    syncProjectFilesFromDisk,
  });

  useIdeKeybindings({
    codeEditorRef,
    handleSaveActive,
    handleCloseActiveTab,
    handleMenuAction,
    handleRun,
    handleStop,
    handleGoToTest,
    handleOpenProject,
    handleOpenFindInFiles,
    handleOpenCurrentFileDiff,
    onAnalyzeWithSonar: () => handleAnalyzeWithSonar(),
  });

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

      // ─── Tab Stacks: Closed Tabs History & Pinned Tabs ───
      const [recentlyClosedTabs, setRecentlyClosedTabs] = useState<OpenTab[]>([]);

      const handleCloseTab = (tabId: string) => {
        const tabToClose = tabs.find(t => t.id === tabId);
        if (tabToClose) {
          setRecentlyClosedTabs(prev => [tabToClose, ...prev.filter(t => t.id !== tabId).slice(0, 20)]);
        }
        const nextTabs = tabs.filter(t => t.id !== tabId);
        setTabs(nextTabs);
        if (activeTabId === tabId) {
          setActiveTabId(nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].id : null);
        }
      };

      const handleTogglePinTab = (tabId: string) => {
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, isPinned: !t.isPinned } : t));
        const target = tabs.find(t => t.id === tabId);
        if (target) {
          addToast('Tab Pin', target.isPinned ? `Unpinned ${target.title}` : `Pinned ${target.title}`, 'info');
        }
      };

      const handleReopenClosedTab = useCallback(() => {
        if (recentlyClosedTabs.length === 0) {
          addToast('Reopen Tab', 'No recently closed tabs to reopen', 'info');
          return;
        }
        const [tabToReopen, ...rest] = recentlyClosedTabs;
        setRecentlyClosedTabs(rest);
        setTabs(prev => {
          if (prev.some(t => t.id === tabToReopen.id)) return prev;
          return [...prev, tabToReopen];
        });
        setActiveTabId(tabToReopen.id);
        addToast('Reopened Tab', `Reopened ${tabToReopen.title}`, 'info');
      }, [recentlyClosedTabs, addToast]);

      handleReopenClosedTabRef.current = handleReopenClosedTab;

      const handleCloseFileByPath = (filePath: string) => {
        const norm = (p: string) => p.replace(/\\/g, '/');
        const target = tabs.find(t => norm(t.path) === norm(filePath));
        if (target) {
          handleCloseTab(target.id);
        }
      };

      const handleCloseOtherTabs = (tabId: string) => {
        const nextTabs = tabs.filter(t => t.id === tabId || t.isPinned);
        setTabs(nextTabs);
        setActiveTabId(tabId);
        addToast('Close Other Tabs', 'Closed other unpinned tabs', 'info');
      };

      const handleCloseAllTabs = () => {
        const nextTabs = tabs.filter(t => t.isPinned);
        setTabs(nextTabs);
        if (!nextTabs.some(t => t.id === activeTabId)) {
          setActiveTabId(nextTabs.length > 0 ? nextTabs[0].id : null);
        }
        addToast('Close All Tabs', nextTabs.length > 0 ? 'Closed all unpinned tabs' : 'All editor tabs closed', 'info');
      };

      // ─── Bookmarks System ───
      const [bookmarks, setBookmarks] = useState<Array<{ id: string; path: string; name: string; mnemonic?: string; timestamp: number }>>(() => {
        try {
          const saved = localStorage.getItem('intellij_bookmarks');
          if (saved) return JSON.parse(saved);
        } catch (e) {}
        return [];
      });

      const handleToggleBookmark = useCallback((filePath: string, mnemonic?: string) => {
        setBookmarks(prev => {
          const exists = prev.find(b => b.path === filePath);
          let next: typeof prev;
          if (exists) {
            next = prev.filter(b => b.path !== filePath);
            addToast('Bookmark Removed', `Removed bookmark from ${exists.name}`, 'info');
          } else {
            const fileName = filePath.replace(/[\\/]/g, '/').split('/').pop() || filePath;
            const newBm = {
              id: Date.now().toString(),
              path: filePath,
              name: fileName,
              mnemonic,
              timestamp: Date.now(),
            };
            next = [newBm, ...prev];
            addToast('Bookmark Added', `Bookmarked ${fileName}${mnemonic ? ` [${mnemonic}]` : ''}`, 'success');
          }
          try {
            localStorage.setItem('intellij_bookmarks', JSON.stringify(next));
          } catch (e) {}
          return next;
        });
      }, [addToast]);

      // ─── IDE File Operations (Paste / Copy Refactor / Move Refactor) ───
      const handlePasteFile = useCallback(async (sourceNode: FileNode, targetParentPath: string, op: 'cut' | 'copy') => {
        const normSource = sourceNode.path.replace(/\\/g, '/');
        const normTargetParent = targetParentPath.replace(/\\/g, '/');

        let newName = sourceNode.name;
        if (op === 'copy' && normTargetParent && normSource.startsWith(normTargetParent + '/')) {
          const ext = sourceNode.name.includes('.') ? '.' + sourceNode.name.split('.').pop() : '';
          const base = sourceNode.name.replace(/\.[^/.]+$/, '');
          newName = `${base}_copy${ext}`;
        }

        const destPath = normTargetParent ? `${normTargetParent}/${newName}` : newName;

        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          try {
            if (op === 'cut') {
              await invoke('vfs_move_path', { sourcePath: sourceNode.path, destPath });
            } else {
              await invoke('vfs_copy_file', { sourcePath: sourceNode.path, destPath });
            }
          } catch (err) {
            console.warn('VFS paste operation failed on disk:', err);
          }
        }

        setFiles(prev => {
          const removeNode = (list: FileNode[]): FileNode[] => {
            return list
              .filter(n => n.id !== sourceNode.id)
              .map(n => n.children ? { ...n, children: removeNode(n.children) } : n);
          };

          const baseList = op === 'cut' ? removeNode(prev) : prev;

          const newNode: FileNode = {
            ...sourceNode,
            id: destPath,
            name: newName,
            path: destPath,
          };

          if (!normTargetParent) {
            return [...baseList, newNode];
          }

          const insertNode = (list: FileNode[]): FileNode[] => {
            return list.map(item => {
              const itemNorm = item.path.replace(/\\/g, '/');
              if (itemNorm === normTargetParent && item.isFolder) {
                const children = item.children ? [...item.children, newNode] : [newNode];
                return { ...item, children };
              }
              if (item.children) {
                return { ...item, children: insertNode(item.children) };
              }
              return item;
            });
          };

          return insertNode(baseList);
        });

        if (op === 'cut') {
          setTabs(prev => prev.map(t => {
            if (t.id === sourceNode.id || t.path === sourceNode.path) {
              return { ...t, id: destPath, path: destPath, title: newName };
            }
            return t;
          }));
          if (activeTabId === sourceNode.id) {
            setActiveTabId(destPath);
          }
          addToast('File Moved', `Moved ${sourceNode.name} to ${normTargetParent || 'root'}`, 'success');
        } else {
          addToast('File Pasted', `Pasted ${newName} into ${normTargetParent || 'root'}`, 'success');
        }
      }, [activeTabId, addToast]);

      const handleCopyFileRefactor = useCallback(async (sourceNode: FileNode, newName: string, targetDir: string) => {
        const normTarget = targetDir.replace(/\\/g, '/');
        const destPath = normTarget ? `${normTarget}/${newName}` : newName;

        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          try {
            await invoke('vfs_copy_file', { sourcePath: sourceNode.path, destPath });
          } catch (err) {
            console.warn('VFS copy error:', err);
          }
        }

        const newNode: FileNode = {
          ...sourceNode,
          id: destPath,
          name: newName,
          path: destPath,
        };

        setFiles(prev => {
          if (!normTarget) return [...prev, newNode];
          const insertNode = (list: FileNode[]): FileNode[] => {
            return list.map(item => {
              const itemNorm = item.path.replace(/\\/g, '/');
              if (itemNorm === normTarget && item.isFolder) {
                return { ...item, children: [...(item.children || []), newNode] };
              }
              if (item.children) {
                return { ...item, children: insertNode(item.children) };
              }
              return item;
            });
          };
          return insertNode(prev);
        });

        addToast('Refactor Copy', `Created copy: ${newName}`, 'success');
      }, [addToast]);

      const handleMoveFileRefactor = useCallback(async (sourceNode: FileNode, targetDir: string) => {
        const normTarget = targetDir.replace(/\\/g, '/');
        const destPath = normTarget ? `${normTarget}/${sourceNode.name}` : sourceNode.name;

        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          try {
            await invoke('vfs_move_path', { sourcePath: sourceNode.path, destPath });
          } catch (err) {
            console.warn('VFS move error:', err);
          }
        }

        setFiles(prev => {
          const removeNode = (list: FileNode[]): FileNode[] => {
            return list
              .filter(n => n.id !== sourceNode.id)
              .map(n => n.children ? { ...n, children: removeNode(n.children) } : n);
          };
          const cleaned = removeNode(prev);

          const newNode: FileNode = {
            ...sourceNode,
            id: destPath,
            path: destPath,
          };

          if (!normTarget) return [...cleaned, newNode];
          const insertNode = (list: FileNode[]): FileNode[] => {
            return list.map(item => {
              const itemNorm = item.path.replace(/\\/g, '/');
              if (itemNorm === normTarget && item.isFolder) {
                return { ...item, children: [...(item.children || []), newNode] };
              }
              if (item.children) {
                return { ...item, children: insertNode(item.children) };
              }
              return item;
            });
          };
          return insertNode(cleaned);
        });

        setTabs(prev => prev.map(t => {
          if (t.id === sourceNode.id || t.path === sourceNode.path) {
            return { ...t, id: destPath, path: destPath };
          }
          return t;
        }));
        if (activeTabId === sourceNode.id) {
          setActiveTabId(destPath);
        }

        addToast('Refactor Move', `Moved ${sourceNode.name} to ${normTarget || 'root'}`, 'success');
      }, [activeTabId, addToast]);

      const handleCloseUnmodifiedTabs = () => {
        const closed = tabs.filter(t => !t.isDirty && !t.isPinned);
        if (closed.length > 0) {
          setRecentlyClosedTabs(prev => [...closed, ...prev].slice(0, 20));
        }
        const nextTabs = tabs.filter(t => t.isDirty || t.isPinned);
        setTabs(nextTabs);
        if (!nextTabs.some(t => t.id === activeTabId)) {
          setActiveTabId(nextTabs.length > 0 ? nextTabs[0].id : null);
        }
        addToast('Close Unmodified', 'Closed unmodified editor tabs', 'info');
      };

      const handleCloseTabsLeft = (tabId: string) => {
        const idx = tabs.findIndex(t => t.id === tabId);
        if (idx <= 0) return;
        const closed = tabs.filter((t, i) => i < idx && !t.isPinned);
        if (closed.length > 0) {
          setRecentlyClosedTabs(prev => [...closed, ...prev].slice(0, 20));
        }
        const nextTabs = tabs.filter((t, i) => i >= idx || t.isPinned);
        setTabs(nextTabs);
        if (!nextTabs.some(t => t.id === activeTabId)) {
          setActiveTabId(tabId);
        }
        addToast('Close Left Tabs', 'Closed tabs to the left', 'info');
      };

      const handleCloseTabsRight = (tabId: string) => {
        const idx = tabs.findIndex(t => t.id === tabId);
        if (idx === -1 || idx >= tabs.length - 1) return;
        const closed = tabs.filter((t, i) => i > idx && !t.isPinned);
        if (closed.length > 0) {
          setRecentlyClosedTabs(prev => [...closed, ...prev].slice(0, 20));
        }
        const nextTabs = tabs.filter((t, i) => i <= idx || t.isPinned);
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

      const handleToggleBottomTab = useCallback((tabId: BottomTabType) => {
          if (tabId === 'run') notifyAction('Run Tool Window', 'Alt+4');
          if (tabId === 'terminal') notifyAction('Terminal Tool Window', 'Alt+F12');
          if (tabId === 'debug') notifyAction('Debug Tool Window', 'Alt+5');
          if (tabId === 'problems') notifyAction('Problems Tool Window', 'Alt+6');
          if (tabId === 'git') notifyAction('Git Tool Window', 'Alt+9');
          if (tabId === 'sonar') notifyAction('SonarLint Tool Window', 'Alt+8');
          if (tabId === 'coverage') notifyAction('Coverage Tool Window', 'Ctrl+Alt+C');
          if (tabId === 'todo') notifyAction('TODO Tool Window', 'Alt+7');
          if (tabId === 'endpoints') notifyAction('Endpoints Tool Window', 'Alt+E');
          if (tabId === 'profiler') notifyAction('Profiler Tool Window', 'Alt+P');

          if (bottomTab === tabId && isBottomOpen) {
            setIsBottomOpen(false);
          } else {
            setBottomTab(tabId);
            setIsBottomOpen(true);
          }
        }, [bottomTab, isBottomOpen, notifyAction, setBottomTab, setIsBottomOpen]);



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
            onImportSettings={() => setIsImportSettingsOpen(true)}
            onExportSettings={() => setIsExportSettingsOpen(true)}
            onRestoreDefaultSettings={() => {
              setSettings({
                theme: 'intellij-new-ui-dark',
                fontSize: 14,
                tabSize: 4,
                minimap: true,
                lineNumbers: true,
                wordWrap: false,
              });
              addToast('Settings Restored', 'JetBrains defaults restored', 'success');
            }}
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
            isBranchesOpen={isBranchesOpen}
            onOpenBranches={() => setIsBranchesOpen(true)}
            onCloseBranches={() => setIsBranchesOpen(false)}
            currentProjectDirectory={currentProjectDirectory}
            onSwitchBranch={(b) => {
              setCurrentBranch(b);
              addToast('Switched Branch', `Checked out branch [${b}]`, 'info');
              refreshGitStatus();
            }}
            onCreateBranch={(b) => {
              addToast('Branch Created', `Created and checked out [${b}]`, 'success');
              refreshGitStatus();
            }}
            onShowToast={addToast}
            onRefreshGitStatus={refreshGitStatus}
            activeRightPanel={activeRightPanel}
            unreadNotificationsCount={notifications.filter(n => !n.read).length}
            hasUpdateAvailable={autoUpdate.hasUpdateAvailable}
            />

            {/* Main Workspace Body */}
            <div className="flex-1 flex overflow-hidden relative">
            {/* Activity Bar (Icon Stripe) */}
            <ActivityBar
              activeSideTab={activeSideTab}
              isSideBarOpen={isSideBarOpen}
              onToggleSideTab={handleToggleSideTab}
              activeRightPanel={activeRightPanel}
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
              onSelectMoreTool={(toolId) => {
                if (toolId === 'find') {
                  setIsSearchOpen(true);
                } else if (toolId === 'run') {
                  handleToggleBottomTab('run');
                } else if (toolId === 'debug') {
                  handleToggleBottomTab('debug');
                } else if (toolId === 'sonar') {
                  handleToggleBottomTab('sonar');
                } else if (toolId === 'todo') {
                  handleToggleBottomTab('todo');
                } else if (toolId === 'bookmarks') {
                  setActiveSideTab('bookmarks');
                  setIsSideBarOpen(true);
                } else if (toolId === 'hierarchy') {
                  setActiveSideTab('structure');
                  setIsSideBarOpen(true);
                } else if (toolId === 'coverage') {
                  handleToggleBottomTab('coverage');
                } else if (toolId === 'endpoints') {
                  handleToggleBottomTab('endpoints');
                } else if (toolId === 'learn') {
                  useModalStore.getState().setIsLearnOpen(true);
                } else if (toolId === 'profiler') {
                  handleToggleBottomTab('profiler');
                }
              }}
            />

            {/* Middle Workspace Area (Top: Left Sidebar + Editor; Bottom: Full Width Tool Window - 100% IntelliJ Standard) */}
            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
              {/* Upper Section: Left Tool Window (Project Tree) + Center Editor Area */}
              <div className="flex-1 flex flex-row min-h-0 overflow-hidden min-w-0">
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
                    onNewFile={handleCreateFile}
                    onNewFolder={handleCreateFolder}
                    onDeleteFile={handleDeleteFile}
                    onRenameFile={handleRenameFile}
                    onOpenSplit={(node) => {
                        handleFileSelect(node);
                        useEditorStore.getState().splitRight(node.id);
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
                    onCompareWith={async (node) => {
                      const curTab = tabs.find(t => t.id === activeTabId);
                      let targetContent = node.content || '';
                      if (!targetContent && node.path && typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
                        try {
                          targetContent = await invoke<string>('read_file_content', { path: node.path });
                        } catch (e) {}
                      }
                      setActiveDiffFile(node.name);
                      setDiffBaseContent(targetContent);
                      setDiffLocalContent(curTab?.content || '');
                      setIsDiffModalOpen(true);
                    }}
                    onOpenTerminal={() => {
                      setBottomTab('terminal');
                      setIsBottomOpen(true);
                    }}
                    onReloadFromDisk={(node) => {
                      if (node.path && typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
                        invoke<string>('read_file_content', { path: node.path })
                          .then((content) => {
                            setTabs(prev => prev.map(t => t.path === node.path ? { ...t, content, isDirty: false } : t));
                            addToast('Reloaded from Disk', `${node.name} reloaded successfully`, 'success');
                          })
                          .catch((err) => addToast('Reload Failed', String(err), 'error'));
                      }
                    }}
                    onSelectMenuAction={handleMenuAction}
                    projectRootPath={currentProjectDirectory}
                    onPasteFile={handlePasteFile}
                    onCopyFileRefactor={handleCopyFileRefactor}
                    onMoveFileRefactor={handleMoveFileRefactor}
                    bookmarks={bookmarks.map(b => b.path)}
                    onToggleBookmark={handleToggleBookmark}
                    onShowBookmarksModal={() => {
                      setActiveSideTab('bookmarks');
                      setIsSideBarOpen(true);
                    }}
                    onCloseFile={handleCloseFileByPath}
                    onFindInFolder={(folderPath, mode) => handleOpenFindInFiles(mode, folderPath)}
                    onAnalyzeSonarPath={(path, isFolder) => handleAnalyzeWithSonar(path, isFolder)}
                    onExcludeSonarPath={handleExcludeSonarPath}
                    />
                )}
                {activeSideTab === 'commit' && (
                  <CommitPanel
                    projectPath={currentProjectDirectory}
                    currentBranch={currentBranch}
                    onClose={() => setIsSideBarOpen(false)}
                    onOpenFile={(filePath) => {
                      handleOpenFileAtLocation(filePath, 1, 1);
                    }}
                    onCommitSuccess={() => {
                      refreshGitStatus();
                      syncProjectFilesFromDisk();
                    }}
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
                {activeSideTab === 'bookmarks' && (
                    <div className="h-full bg-[#1E1F22] flex flex-col text-[#DFE1E5]">
                      <div className="h-8 bg-[#1E1F22] border-b border-[#2B2D30] px-3 flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Bookmark size={13} className="text-[#3574F0] fill-[#3574F0]" />
                          <span>Bookmarks ({bookmarks.length})</span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {bookmarks.length === 0 ? (
                          <div className="p-4 text-center text-xs text-[#868A91]">
                            No bookmarks yet. Right click a file or press F11 to add bookmark.
                          </div>
                        ) : (
                          bookmarks.map(bm => (
                            <div
                              key={bm.id}
                              onClick={() => {
                                const node = files.find(f => f.path === bm.path) || { id: bm.path, name: bm.name, path: bm.path, isFolder: false };
                                handleFileSelect(node);
                              }}
                              className="flex items-center justify-between p-2 rounded hover:bg-[#2B2D30] cursor-pointer group text-xs transition-colors"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Bookmark size={13} className="text-[#3574F0] fill-[#3574F0] flex-shrink-0" />
                                <div className="truncate">
                                  <div className="font-medium text-white flex items-center gap-1">
                                    <span>{bm.name}</span>
                                    {bm.mnemonic && (
                                      <span className="px-1 bg-[#3574F0]/30 text-[#85B1F8] border border-[#3574F0]/50 rounded text-[9px] font-mono">
                                        {bm.mnemonic}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-[#868A91] truncate font-mono">{bm.path}</div>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleBookmark(bm.path);
                                }}
                                className="text-[#868A91] hover:text-[#E05555] opacity-0 group-hover:opacity-100 p-1 transition-opacity"
                                title="Delete bookmark"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                )}
                {activeSideTab !== 'project' && activeSideTab !== 'structure' && activeSideTab !== 'bookmarks' && activeSideTab !== 'commit' && (
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
                title={`Drag to resize ${activeSideTab === 'commit' ? 'Commit tool window' : activeSideTab === 'project' ? 'Project sidebar' : 'sidebar'}`}
                />
                </div>
            )}

                {/* Center Zone: Editor */}
                <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
            <CodeEditor
            ref={codeEditorRef}
            projectPath={currentProjectDirectory}
            tabs={tabs}
            activeTabId={activeTabId}
            settings={settings}
            isReadOnly={isReadOnly}
            onOpenFileAtLocation={handleOpenFileAtLocation}
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
            onTogglePinTab={handleTogglePinTab}
            onReopenClosedTab={handleReopenClosedTab}
            onRenameFile={(tabId) => {
              const target = tabs.find(t => t.id === tabId);
              if (target) {
                setRenameTarget({ type: 'file', name: target.title });
                setIsRenameOpen(true);
              }
            }}
            onLocalHistory={() => setIsLocalHistoryOpen(true)}
            onToggleBookmark={handleToggleBookmark}
            onShowBookmarksModal={() => {
              setActiveSideTab('bookmarks');
              setIsSideBarOpen(true);
            }}
            activePausedLine={debugState === 'paused' ? { filePath: activeTab?.path || '', line: cursorPos.line } : null}
            />
                </div>
              </div>

              {/* Bottom Tool Window (Full Width across Left Sidebar and Editor - 100% IntelliJ Standard) */}
            <BottomToolWindow
              isBottomOpen={isBottomOpen}
              setIsBottomOpen={setIsBottomOpen}
              bottomTab={bottomTab}
              setBottomTab={setBottomTab}
              bottomHeight={bottomHeight}
              setBottomHeight={setBottomHeight}
              handleToggleMaximizeBottom={handleToggleMaximizeBottom}
              isRunning={isRunning}
              runLogs={runLogs}
              setRunLogs={setRunLogs}
              runConfigurations={runConfigurations}
              activeConfigId={activeConfigId}
              projectName={projectName}
              handleRun={handleRun}
              handleStop={handleStop}
              currentProjectDirectory={currentProjectDirectory}
              currentBranch={currentBranch}
              gitTargetCommit={gitTargetCommit}
              hasOpenedTerminal={hasOpenedTerminal}
              projectRootPath={projectRootPath}
              setIsSettingsOpen={setIsSettingsOpen}
              problems={problems}
              activeTab={activeTab}
              handleJumpToProblem={handleJumpToProblem}
              runProjectInspection={runProjectInspection}
              debugState={debugState}
              frames={frames}
              activeFrameId={activeFrameId}
              setActiveFrameId={setActiveFrameId}
              variables={variables}
              watches={watches}
              areBreakpointsMuted={areBreakpointsMuted}
              setAreBreakpointsMuted={setAreBreakpointsMuted}
              debugConsoleOutput={debugConsoleOutput}
              setDebugConsoleOutput={setDebugConsoleOutput}
              handleStartDebug={handleStartDebug}
              handleResumeDebug={handleResumeDebug}
              handlePauseDebug={handlePauseDebug}
              handleStopDebug={handleStopDebug}
              handleStepOverDebug={handleStepOverDebug}
              handleStepIntoDebug={handleStepIntoDebug}
              handleStepOutDebug={handleStepOutDebug}
              handleRunToCursor={handleRunToCursor}
              handleAddWatch={handleAddWatch}
              handleRemoveWatch={handleRemoveWatch}
              setIsEvaluateExpressionOpen={setIsEvaluateExpressionOpen}
              setIsBreakpointsOpen={setIsBreakpointsOpen}
              handleOpenFileAtLocation={handleOpenFileAtLocation}
              findResult={findResult}
              setFindResult={setFindResult}
              handleFindUsages={handleFindUsages}
              handleJumpToOccurrence={handleJumpToOccurrence}
              onExecuteMavenGoal={(goal) => handleExecuteBuildTask('maven', goal, `mvn ${goal}`)}
              addToast={addToast}
              onSonarAnalysisStateChange={setSonarAnalysisState}
              sonarTargetScanPath={sonarTargetScanPath}
              sonarCancelSignal={sonarCancelSignal}
            />
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
            {isStatusBarVisible && (
              <StatusBar
                branch={currentBranch}
                cursorLine={cursorPos.line}
                cursorCol={cursorPos.col}
                encoding={fileEncoding}
                lineEnding={lineEnding}
                tabSize={settings.tabSize || 4}
                isIndexing={isIndexing}
                onOpenBranches={() => setIsBranchesOpen(true)}
                onShowToast={addToast}
                editorEngine={editorEngine}
                onToggleEngine={toggleEditorEngine}
                onSelectTabSize={handleSelectTabSize}
                onSelectLineEnding={handleSelectLineEnding}
                onSelectEncoding={handleSelectEncoding}
                onOpenGoToLine={() => setIsGoToLineOpen(true)}
                isReadOnly={isReadOnly}
                onToggleReadOnly={() => {
                  setIsReadOnly(prev => {
                    const next = !prev;
                    addToast('Read-Only Status', next ? 'File locked as Read-Only' : 'File unlocked (Editable)', 'info');
                    return next;
                  });
                }}
                languageName={(() => {
                  const active = tabs.find(t => t.id === activeTabId);
                  if (!active) return 'Code';
                  const ext = (active.path || active.title).split('.').pop()?.toLowerCase();
                  if (ext === 'vue') return 'Vue template';
                  if (ext === 'ts' || ext === 'tsx') return 'TypeScript';
                  if (ext === 'js' || ext === 'jsx') return 'JavaScript';
                  if (ext === 'rs') return 'Rust';
                  if (ext === 'java') return 'Java';
                  if (ext === 'css' || ext === 'scss') return 'CSS/SCSS';
                  return active.language || 'Code';
                })()}
                filePath={tabs.find(t => t.id === activeTabId)?.path || tabs.find(t => t.id === activeTabId)?.title}
                projectName={projectName || 'mic-fe-personal'}
                projectTree={files}
                onSelectFile={handleFileSelect}
                sonarAnalysisState={sonarAnalysisState}
                onStopSonarAnalysis={() => setSonarCancelSignal(prev => prev + 1)}
              />
            )}
            </>
        )}

        {/* Centralized Modals Host */}
        <OverlayHost
          handleOpenFileAtLocation={handleOpenFileAtLocation}
          handleSelectSearchAction={handleSelectSearchAction}
          handleCreateNewFile={handleCreateNewFile}
          handleGoToLine={handleGoToLine}
          maxLine={codeEditorRef.current?.getMaxLine() || 100}
          handleCommit={handleCommit}
          currentBranch={currentBranch}
          refreshGitStatus={refreshGitStatus}
          handleRenameUnified={handleRenameUnified}
          activeTabTitle={activeTab?.title}
          handleCreateNewProject={handleCreateNewProject}
          loadProjectIntoIde={loadProjectIntoIde}
          runConfigurations={runConfigurations}
          activeConfigId={activeConfigId}
          setRunConfigurations={setRunConfigurations}
          setActiveConfigId={setActiveConfigId}
          handleRun={handleRun}
          problems={problems}
          handleChangeContent={handleChangeContent}
          handleAddDataSource={handleAddDataSource}
          onApplyTheme={handleApplyTheme}
          handleStash={handleStash}
          onAddWatch={handleAddWatch}
          onPasteSnippet={(snippetText) => {
            codeEditorRef.current?.insertSnippet(snippetText);
            addToast('Pasted from History', undefined, 'info');
          }}
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

        {/* Surround With Modal (Ctrl+Alt+T) */}
        <SurroundWithModal
        isOpen={isSurroundWithOpen}
        onClose={() => setIsSurroundWithOpen(false)}
        onSelectSurround={(type: SurroundType) => {
            codeEditorRef.current?.surroundWith(type);
            addToast('Surround With', `Surrounded with ${type}`, 'success');
        }}
        />

        {/* Import Settings Modal (File > Manage IDE Settings > Import Settings) */}
        <ImportSettingsModal
          isOpen={isImportSettingsOpen}
          onClose={() => setIsImportSettingsOpen(false)}
          currentSettings={settings}
          onApplyImport={handleApplyImportedSettings}
        />

        {/* Export Settings Modal (File > Manage IDE Settings > Export Settings) */}
        <ExportSettingsModal
          isOpen={isExportSettingsOpen}
          onClose={() => setIsExportSettingsOpen(false)}
          currentSettings={settings}
          onSuccessToast={(title, msg) => addToast(title, msg, 'success')}
        />

        {/* Auto Update Modal */}
        <UpdateModal
          isOpen={isUpdateOpen || autoUpdate.isModalOpen}
          onClose={() => {
            setIsUpdateOpen(false);
            autoUpdate.setIsModalOpen(false);
          }}
          status={autoUpdate.status}
          metadata={autoUpdate.metadata}
          currentVersion={autoUpdate.currentVersion}
          progress={autoUpdate.progress}
          errorMessage={autoUpdate.errorMessage}
          onCheckAgain={() => autoUpdate.checkNow(true)}
          onStartDownload={autoUpdate.startDownload}
          onCancelDownload={autoUpdate.cancelDownload}
          onApplyRestart={autoUpdate.applyRestart}
          onIgnoreVersion={autoUpdate.ignoreVersion}
        />

        {/* Key Promoter X Toast Notification (learn IntelliJ shortcuts) */}
        <KeyPromoterXToast
          item={keyPromoterItem}
          onDismiss={dismissKeyPromoter}
          onDisable={disableKeyPromoter}
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
