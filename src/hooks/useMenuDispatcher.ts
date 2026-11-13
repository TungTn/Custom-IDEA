import React, { useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  useEditorStore,
  useLayoutStore,
  useModalStore,
  useNotificationStore,
  useProjectStore,
  useSettingsStore,
  usePluginStore,
} from '../stores';
import { OpenTab } from '../types';
import { CodeEditorHandle } from '../workbench';
import { resolveProjectPath } from '../utils/pathUtils';

export interface UseMenuDispatcherOptions {
  codeEditorRef: React.RefObject<CodeEditorHandle>;
  currentProjectDirectory: string;
  projectName: string;
  currentBranch: string;
  cursorPos: { line: number; col: number };
  handleSaveActive: () => void | Promise<void>;
  handleCloseActiveTab: () => void;
  handleRun: () => void | Promise<void>;
  handleStop: () => void | Promise<void>;
  handleBuild: (action?: 'build' | 'rebuild' | 'clean') => void | Promise<void>;
  handleStartDebug: () => void | Promise<void>;
  handleStopDebug: () => void | Promise<void>;
  handleStepOverDebug: () => void | Promise<void>;
  handleStepIntoDebug: () => void | Promise<void>;
  handleStepOutDebug: () => void | Promise<void>;
  handleResumeDebug: () => void | Promise<void>;
  handleToggleBreakpoint: (lineNumber: number) => void;
  handleOpenProject: () => void | Promise<void>;
  handleOpenProjectPath: (path: string) => void | Promise<void>;
  handleOpenFindInFiles: (mode: 'find' | 'replace') => void;
  handleOpenCurrentFileDiff: () => void;
  handleFindUsages: (symbol: string) => void | Promise<void>;
  handleShowUsages: (symbol: string) => void | Promise<void>;
  refreshGitStatus: () => void | Promise<void>;
  syncProjectFilesFromDisk: (paths?: string[]) => void | Promise<void>;
}

/**
 * Custom hook encapsulating the IntelliJ IDEA master menu action dispatcher.
 * Handles ~80 standard actions categorized across File, Edit, View, Navigate,
 * Code, Refactor, Build, Run, Tools, Git, and Help menus.
 */
const ACTION_SHORTCUT_MAP: Record<string, { name: string; shortcut: string }> = {
  'file.save': { name: 'Save File', shortcut: 'Ctrl+S' },
  'file.saveAll': { name: 'Save All', shortcut: 'Ctrl+Shift+S' },
  'file.settings': { name: 'Settings', shortcut: 'Ctrl+Alt+S' },
  'edit.undo': { name: 'Undo', shortcut: 'Ctrl+Z' },
  'edit.redo': { name: 'Redo', shortcut: 'Ctrl+Y' },
  'edit.cut': { name: 'Cut', shortcut: 'Ctrl+X' },
  'edit.copy': { name: 'Copy', shortcut: 'Ctrl+C' },
  'edit.paste': { name: 'Paste', shortcut: 'Ctrl+V' },
  'edit.find': { name: 'Find in Files', shortcut: 'Ctrl+Shift+F' },
  'edit.replace': { name: 'Replace in Files', shortcut: 'Ctrl+Shift+R' },
  'code.reformat': { name: 'Reformat Code', shortcut: 'Ctrl+Alt+L' },
  'code.optimizeImports': { name: 'Optimize Imports', shortcut: 'Ctrl+Alt+O' },
  'code.commentLine': { name: 'Comment with Line Comment', shortcut: 'Ctrl+/' },
  'code.commentBlock': { name: 'Comment with Block Comment', shortcut: 'Ctrl+Shift+/' },
  'run.run': { name: 'Run Application', shortcut: 'Shift+F10' },
  'run.debug': { name: 'Debug Application', shortcut: 'Shift+F9' },
  'run.stop': { name: 'Stop Process', shortcut: 'Ctrl+F2' },
  'build.rebuild': { name: 'Rebuild Project', shortcut: 'Ctrl+F9' },
  'vcs.commit': { name: 'Commit Changes', shortcut: 'Ctrl+K' },
  'vcs.push': { name: 'Push Commits', shortcut: 'Ctrl+Shift+K' },
  'vcs.update': { name: 'Update Project', shortcut: 'Ctrl+T' },
  'navigate.searchEverywhere': { name: 'Search Everywhere', shortcut: 'Double Shift' },
  'navigate.line': { name: 'Go to Line', shortcut: 'Ctrl+G' },
  'navigate.file': { name: 'Go to File', shortcut: 'Ctrl+Shift+N' },
  'navigate.class': { name: 'Go to Class', shortcut: 'Ctrl+N' },
  'navigate.symbol': { name: 'Go to Symbol', shortcut: 'Ctrl+Alt+Shift+N' },
  'view.toolwindow.terminal': { name: 'Terminal', shortcut: 'Alt+F12' },
  'view.toolwindow.run': { name: 'Run Tool Window', shortcut: 'Alt+4' },
  'view.toolwindow.debug': { name: 'Debug Tool Window', shortcut: 'Alt+5' },
  'view.toolwindow.problems': { name: 'Problems Tool Window', shortcut: 'Alt+6' },
  'view.toolwindow.git': { name: 'Git Tool Window', shortcut: 'Alt+9' },
  'view.toolwindow.project': { name: 'Project Tool Window', shortcut: 'Alt+1' },
  'window.minimize': { name: 'Minimize Window', shortcut: 'Ctrl+M' },
  'window.zoom': { name: 'Zoom Window', shortcut: '' },
  'window.close': { name: 'Close Window', shortcut: 'Ctrl+F4' },
  'file.close': { name: 'Close Active Tab', shortcut: 'Ctrl+F4' },
  'file.closeAll': { name: 'Close All Tabs', shortcut: 'Ctrl+Shift+F4' },
  'editor.splitRight': { name: 'Split Right', shortcut: '' },
  'editor.splitDown': { name: 'Split Down', shortcut: '' },
  'window.nextProject': { name: 'Next Project Window', shortcut: 'Ctrl+Alt+]' },
  'window.prevProject': { name: 'Previous Project Window', shortcut: 'Ctrl+Alt+[' },
  'window.layoutDefault': { name: 'Default Layout', shortcut: '' },
  'window.layoutSave': { name: 'Save Current Layout', shortcut: '' },
  'run.tests': { name: 'Run All Tests', shortcut: '' },
};

export function useMenuDispatcher({
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
}: UseMenuDispatcherOptions) {
  const {
    tabs,
    setTabs,
    activeTabId,
    selectTab: setActiveTabId,
    splitRight,
    splitDown,
    closeAllTabs,
    unsplit,
  } = useEditorStore();
  const {
    activeSideTab, setActiveSideTab,
    isSideBarOpen, setIsSideBarOpen,
    sideBarWidth, setSideBarWidth,
    bottomHeight, setBottomHeight,
    bottomTab, setBottomTab,
    isBottomOpen, setIsBottomOpen,
    setActiveRightPanel,
    setPowerSaveMode,
    toggleStatusBar,
  } = useLayoutStore();
  const { addToast, markAllNotificationsAsRead: handleMarkAllNotificationsRead } = useNotificationStore();
  const {
    setFiles,
    setProjectName,
    setProjectRootPath,
    setRecentProjects,
    setFileEncoding,
    setLineEnding,
    setIsReadOnly,
  } = useProjectStore();
  const { settings, setSettings } = useSettingsStore();
  const {
    setIsNewProjectOpen,
    setIsVcsCloneOpen,
    setIsNewFileOpen,
    setIsRenameOpen,
    setIsSettingsOpen,
    setIsProjectStructureOpen,
    setIsLocalHistoryOpen,
    setIsDiffModalOpen,
    setActiveDiffFile,
    setDiffBaseContent,
    setDiffLocalContent,
    setIsRepairIdeOpen,
    setIsInvalidateCachesOpen,
    setIsExportSettingsOpen,
    setIsImportSettingsOpen,
    setIsCommitOpen,
    setIsSearchOpen,
    setSearchInitialTab,
    setIsGoToLineOpen,
    setIsSurroundWithOpen,
    setIsRunConfigOpen,
    setIsBreakpointsOpen,
    setIsEvaluateExpressionOpen,
    setIsThemeStudioOpen,
    setIsBranchesOpen,
    setIsStashOpen,
    setIsAboutOpen,
    setIsTipOpen,
    setIsUpdateOpen,
    setIsClipboardHistoryOpen,
  } = useModalStore();

  const volatileStateRef = useRef({
    cursorPos,
    tabs,
    activeTabId,
    currentProjectDirectory,
    projectName,
    currentBranch,
    sideBarWidth,
    bottomHeight,
    activeSideTab,
    isSideBarOpen,
    bottomTab,
    isBottomOpen,
    settings,
  });
  volatileStateRef.current = {
    cursorPos,
    tabs,
    activeTabId,
    currentProjectDirectory,
    projectName,
    currentBranch,
    sideBarWidth,
    bottomHeight,
    activeSideTab,
    isSideBarOpen,
    bottomTab,
    isBottomOpen,
    settings,
  };

  const handleMenuAction = useCallback((actionId: string) => {
    const {
      cursorPos,
      tabs,
      activeTabId,
      currentProjectDirectory,
      projectName,
      currentBranch,
      sideBarWidth,
      bottomHeight,
      activeSideTab,
      isSideBarOpen,
      bottomTab,
      isBottomOpen,
      settings,
    } = volatileStateRef.current;

    const promoter = ACTION_SHORTCUT_MAP[actionId];
    if (promoter) {
      usePluginStore.getState().notifyAction(promoter.name, promoter.shortcut);
    }

    switch (actionId) {
      // ─── File Actions ───
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
      case 'file.newFolder': {
        const folderName = window.prompt('Enter new directory name:', 'new-folder');
        if (folderName && folderName.trim()) {
          const targetPath = resolveProjectPath(folderName, currentProjectDirectory);
          if (!targetPath) {
            addToast('New Directory Failed', 'Cannot resolve directory path without an open workspace.', 'error');
            break;
          }
          invoke('vfs_create_dir', { path: targetPath })
            .then(() => {
              addToast('New Directory', `Created directory: ${folderName.trim()}`, 'success');
              syncProjectFilesFromDisk();
            })
            .catch(err => {
              addToast('New Directory Failed', String(err), 'error');
            });
        }
        break;
      }
      case 'file.newPackage': {
        const pkgName = window.prompt('Enter new package name (e.g. com.example.service):');
        if (pkgName && pkgName.trim()) {
          const folderPath = pkgName.trim().replace(/\./g, '/');
          const targetPath = resolveProjectPath(`src/main/java/${folderPath}`, currentProjectDirectory);
          if (!targetPath) {
            addToast('New Package Failed', 'Cannot resolve package path without an open workspace.', 'error');
            break;
          }
          invoke('vfs_create_dir', { path: targetPath })
            .then(() => {
              addToast('New Package', `Created package: ${pkgName.trim()}`, 'success');
              syncProjectFilesFromDisk();
            })
            .catch(err => {
              addToast('New Package Failed', String(err), 'error');
            });
        }
        break;
      }
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
      case 'file.removeBom': {
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab && currentTab.content) {
          if (currentTab.content.charCodeAt(0) === 0xFEFF) {
            const stripped = currentTab.content.slice(1);
            useEditorStore.getState().updateContent(currentTab.id, stripped);
            addToast('BOM Removed', 'Byte Order Mark (0xFEFF) stripped from file', 'success');
          } else {
            addToast('Remove BOM', 'No BOM detected in active file', 'info');
          }
        } else {
          addToast('Remove BOM', 'No active file open in editor', 'info');
        }
        break;
      }
      case 'file.localHistory':
        setIsLocalHistoryOpen(true);
        break;
      case 'file.putLabel': {
        const currentTab = tabs.find(t => t.id === activeTabId);
        const label = window.prompt('Enter checkpoint label for Local History:', `Checkpoint-${new Date().toLocaleTimeString()}`);
        if (label && label.trim()) {
          try {
            const historyKey = `ij_history_labels_${currentTab?.path || 'global'}`;
            const existing = JSON.parse(localStorage.getItem(historyKey) || '[]');
            existing.push({ label: label.trim(), time: Date.now() });
            localStorage.setItem(historyKey, JSON.stringify(existing));
            addToast('Local History Label', `Label "${label.trim()}" saved to revision history`, 'success');
          } catch (e) {
            addToast('Local History Label', `Label "${label.trim()}" attached`, 'success');
          }
        }
        break;
      }
      case 'file.compareWithClipboard': {
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab) {
          navigator.clipboard.readText().then(clip => {
            setActiveDiffFile(`${currentTab.title} ↔ Clipboard`);
            setDiffBaseContent(clip);
            setDiffLocalContent(currentTab.content);
            setIsDiffModalOpen(true);
          }).catch(() => {
            addToast('Compare with Clipboard', 'Could not read text from clipboard', 'warning');
          });
        } else {
          addToast('Compare with Clipboard', 'No active file in editor to compare', 'info');
        }
        break;
      }
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
      case 'file.exportSettings':
        setIsExportSettingsOpen(true);
        break;
      case 'file.importSettings':
        setIsImportSettingsOpen(true);
        break;
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
        setIsSettingsOpen(true);
        addToast('Settings for New Projects', 'Opened IDE Settings with global configuration scope', 'info');
        break;
      case 'file.runConfigTemplates':
        setIsRunConfigOpen(true);
        addToast('Run/Debug Configuration Templates', 'Configure templates for new execution profiles', 'info');
        break;
      case 'file.saveFileAsTemplate': {
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab && currentTab.content) {
          try {
            const templates = JSON.parse(localStorage.getItem('ij_file_templates') || '{}');
            templates[currentTab.title] = currentTab.content;
            localStorage.setItem('ij_file_templates', JSON.stringify(templates));
            addToast('Save File as Template', `Template '${currentTab.title}' registered in IDE templates registry`, 'success');
          } catch (e) {
            addToast('Template Saved', 'Saved file as template', 'info');
          }
        } else {
          addToast('Save File as Template', 'No active file open in editor to save as template', 'info');
        }
        break;
      }
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

      // ─── Edit Actions ───
      case 'edit.undo':
        codeEditorRef.current?.undo();
        break;
      case 'edit.redo':
        codeEditorRef.current?.redo();
        break;
      case 'edit.cut':
        codeEditorRef.current?.cut();
        addToast('Cut', 'Cut selection to clipboard', 'info');
        break;
      case 'edit.copy':
        codeEditorRef.current?.copy();
        addToast('Copy', 'Copied selection to clipboard', 'info');
        break;
      case 'edit.paste':
        codeEditorRef.current?.paste();
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
        setIsClipboardHistoryOpen(true);
        break;
      case 'edit.duplicateLine':
        codeEditorRef.current?.duplicateLine();
        break;
      case 'edit.delete':
        codeEditorRef.current?.deleteSelection();
        break;
      case 'edit.toggleCase':
        codeEditorRef.current?.toggleCase();
        addToast('Toggle Case', 'Toggled uppercase / lowercase', 'info');
        break;
      case 'edit.selectAll':
        codeEditorRef.current?.selectAll();
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

      // ─── View Actions ───
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
        if (activeSideTab === 'commit' && isSideBarOpen) {
          setIsSideBarOpen(false);
        } else {
          setActiveSideTab('commit');
          setIsSideBarOpen(true);
        }
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
            handleMarkAllNotificationsRead();
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
        toggleStatusBar();
        addToast('View Appearance', 'Status Bar visibility toggled', 'info');
        break;
      case 'view.toggleBreadcrumbs':
        setSettings(s => ({ ...s, breadcrumbs: !(s.breadcrumbs ?? true) }));
        addToast('Breadcrumbs', 'Navigation bar / breadcrumbs toggled', 'info');
        break;
      case 'view.toggleLineNumbers':
        setSettings(s => ({ ...s, lineNumbers: !(s.lineNumbers ?? true) }));
        addToast('Line Numbers', 'Editor line numbers toggled', 'info');
        break;
      case 'view.toggleMinimap':
        setSettings(s => ({ ...s, minimap: !(s.minimap ?? false) }));
        addToast('Minimap', 'Code minimap toggled', 'info');
        break;
      case 'view.toggleWordWrap':
        setSettings(s => ({ ...s, wordWrap: !(s.wordWrap ?? false) }));
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

      // ─── Navigate Actions ───
      case 'navigate.searchEverywhere':
        setSearchInitialTab('All');
        setIsSearchOpen(true);
        break;
      case 'navigate.goToFile':
        setSearchInitialTab('Files');
        setIsSearchOpen(true);
        break;
      case 'navigate.goToSymbol':
        setSearchInitialTab('Symbols');
        setIsSearchOpen(true);
        break;
      case 'navigate.goToAction':
        setSearchInitialTab('Actions');
        setIsSearchOpen(true);
        break;
      case 'navigate.goToLine':
        setIsGoToLineOpen(true);
        break;
      case 'navigate.gotoDeclaration':
      case 'navigate.gotoImplementation': {
        const word = codeEditorRef.current?.getWordAtCursor() || '';
        if (word) {
          handleFindUsages(word);
        } else {
          addToast('Navigate', 'Place cursor on a symbol or word to jump to declaration', 'info');
        }
        break;
      }
      case 'navigate.goToTest': {
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab) {
          const base = currentTab.title.replace(/\.[^.]+$/, '');
          const ext = currentTab.title.split('.').pop() || '';
          const testTitle = ext === 'rs' ? `${base}_test.rs` : `${base}.test.${ext}`;
          const existingTab = tabs.find(t => t.title === testTitle || t.path.includes(testTitle));
          if (existingTab) {
            setActiveTabId(existingTab.id);
          } else {
            const testTab: OpenTab = {
              id: `test-${testTitle}`,
              title: testTitle,
              path: `tests/${testTitle}`,
              content: `// Test suite for ${currentTab.title}\n\ndescribe("${base}", () => {\n  it("should work as expected", () => {\n    expect(true).toBe(true);\n  });\n});\n`,
              language: currentTab.language,
              isDirty: true,
            };
            setTabs(prev => [...prev, testTab]);
            setActiveTabId(testTab.id);
            addToast('Test Navigation', `Opened ${testTitle} for ${currentTab.title}`, 'success');
          }
        }
        break;
      }
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
      case 'navigate.back': {
        const idx = tabs.findIndex(t => t.id === activeTabId);
        if (idx !== -1 && tabs.length > 1) {
          const prevIdx = (idx - 1 + tabs.length) % tabs.length;
          setActiveTabId(tabs[prevIdx].id);
          addToast('Navigate Back', `Switched to ${tabs[prevIdx].title}`, 'info');
        }
        break;
      }
      case 'navigate.forward': {
        const idx = tabs.findIndex(t => t.id === activeTabId);
        if (idx !== -1 && tabs.length > 1) {
          const nextIdx = (idx + 1) % tabs.length;
          setActiveTabId(tabs[nextIdx].id);
          addToast('Navigate Forward', `Switched to ${tabs[nextIdx].title}`, 'info');
        }
        break;
      }
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
          invoke('reveal_in_explorer', { path: curTab.path })
            .then(() => addToast('Show in Explorer', `Revealed ${curTab.title} in file manager`, 'success'))
            .catch((err) => addToast('Show in Explorer', `Error: ${String(err)}`, 'error'));
        }
        break;
      }
      case 'navigate.selectInTerminal':
        setBottomTab('terminal');
        setIsBottomOpen(true);
        addToast('Terminal', 'Switched to terminal session', 'info');
        break;

      // ─── Code Actions ───
      case 'code.format':
        codeEditorRef.current?.formatDocument();
        addToast('Code Formatted', 'Document formatted using IntelliJ style (Ctrl+Alt+L)', 'success');
        break;
      case 'code.inspect':
        setBottomTab('problems');
        setIsBottomOpen(true);
        addToast('Code Inspection', 'Displaying problems and compiler diagnostics', 'info');
        break;
      case 'code.optimizeImports':
        codeEditorRef.current?.optimizeImports();
        addToast('Imports Optimized', 'Organized imports and removed duplicates (Ctrl+Alt+O)', 'success');
        break;
      case 'code.commentLine':
        codeEditorRef.current?.commentLine();
        break;
      case 'code.commentBlock':
        codeEditorRef.current?.commentBlock();
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
      case 'code.genOverride': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (curTab) {
          const ext = curTab.path?.split('.').pop()?.toLowerCase() || '';
          let snippet = '\n    @Override\n    public void execute() {\n        super.execute();\n    }\n';
          if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
            snippet = '\n  override render() {\n    return super.render();\n  }\n';
          } else if (['rs'].includes(ext)) {
            snippet = '\n    fn default() -> Self {\n        todo!()\n    }\n';
          } else if (['py'].includes(ext)) {
            snippet = '\n    def __str__(self):\n        return super().__str__()\n';
          }
          setTabs(prev => prev.map(t => t.id === curTab.id ? { ...t, content: t.content + snippet, isDirty: true } : t));
          addToast('Generate Override', 'Generated overridden method in active class', 'success');
        } else {
          addToast('Generate Override', 'No active file open to generate override', 'warning');
        }
        break;
      }
      case 'code.surround':
        setIsSurroundWithOpen(true);
        break;
      case 'code.surroundIf':
        codeEditorRef.current?.surroundWith('if');
        addToast('Surround With', 'Surrounded selection with if block', 'success');
        break;
      case 'code.surroundTry':
        codeEditorRef.current?.surroundWith('try-catch');
        addToast('Surround With', 'Surrounded selection with try/catch block', 'success');
        break;
      case 'code.surroundFor':
        codeEditorRef.current?.surroundWith('for');
        addToast('Surround With', 'Surrounded selection with for loop', 'success');
        break;
      case 'code.foldAll':
        codeEditorRef.current?.foldAll();
        addToast('Code Folding', 'All blocks collapsed (Ctrl+Shift+-)', 'info');
        break;
      case 'code.unfoldAll':
        codeEditorRef.current?.unfoldAll();
        addToast('Code Folding', 'All blocks expanded (Ctrl+Shift++)', 'info');
        break;

      // ─── Refactor Actions ───
      case 'refactor.rename':
        setIsRenameOpen(true);
        break;
      case 'refactor.changeSignature':
        codeEditorRef.current?.changeSignature();
        addToast('Change Signature', 'Signature updated in editor', 'info');
        break;
      case 'refactor.extractVariable': {
        const ok = codeEditorRef.current?.extractVariable();
        if (ok) {
          addToast('Extract Variable', 'Variable extracted and bound to expression', 'success');
        } else {
          addToast('Extract Variable', 'Please select an expression in the editor first (Ctrl+Alt+V)', 'warning');
        }
        break;
      }
      case 'refactor.extractConstant': {
        const ok = codeEditorRef.current?.extractConstant();
        if (ok) {
          addToast('Extract Constant', 'Constant extracted to module scope', 'success');
        } else {
          addToast('Extract Constant', 'Please select an expression in the editor first (Ctrl+Alt+C)', 'warning');
        }
        break;
      }
      case 'refactor.extractField': {
        const ok = codeEditorRef.current?.extractConstant();
        if (ok) {
          addToast('Extract Field', 'Field definition extracted', 'success');
        } else {
          addToast('Extract Field', 'Please select an expression in the editor first', 'warning');
        }
        break;
      }
      case 'refactor.extractMethod': {
        const ok = codeEditorRef.current?.extractMethod();
        if (ok) {
          addToast('Extract Method', 'Code block extracted to dedicated function', 'success');
        } else {
          addToast('Extract Method', 'Please select lines of code in the editor first (Ctrl+Alt+M)', 'warning');
        }
        break;
      }
      case 'refactor.inline':
        codeEditorRef.current?.inlineSymbol();
        addToast('Inline Refactoring', 'Inlined symbol definition across usages (Ctrl+Alt+N)', 'info');
        break;
      case 'refactor.moveFile': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (!curTab || !curTab.path) {
          addToast('Move File', 'No active file in editor to move', 'info');
          break;
        }
        const sourcePath = resolveProjectPath(curTab.path, currentProjectDirectory);
        const newPath = window.prompt('Enter new destination file path:', sourcePath || curTab.path);
        const destPath = newPath ? resolveProjectPath(newPath, currentProjectDirectory) : '';
        if (sourcePath && destPath && destPath !== sourcePath) {
          invoke('vfs_move_path', {
            sourcePath,
            destPath
          })
            .then(() => {
              setTabs(prev => prev.map(t => t.id === curTab.id ? { ...t, path: destPath, title: destPath.split(/[\\/]/).pop() || t.title } : t));
              syncProjectFilesFromDisk();
              addToast('Move File', `Moved ${curTab.title} to ${destPath}`, 'success');
            })
            .catch(err => addToast('Move File Failed', String(err), 'error'));
        }
        break;
      }
      case 'refactor.copyFile': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (!curTab || !curTab.path) {
          addToast('Copy File', 'No active file in editor to copy', 'info');
          break;
        }
        const sourcePath = resolveProjectPath(curTab.path, currentProjectDirectory);
        const ext = curTab.title.includes('.') ? '.' + curTab.title.split('.').pop() : '';
        const base = curTab.title.replace(/\.[^.]+$/, '');
        const defaultDest = (sourcePath || curTab.path).replace(curTab.title, `${base}Copy${ext}`);
        const rawDest = window.prompt('Enter path for copied file:', defaultDest);
        const destPath = rawDest ? resolveProjectPath(rawDest, currentProjectDirectory) : '';
        if (sourcePath && destPath && destPath !== sourcePath) {
          invoke('vfs_copy_file', {
            sourcePath,
            destPath
          })
            .then(() => {
              syncProjectFilesFromDisk();
              addToast('Copy File', `Copied to ${destPath}`, 'success');
            })
            .catch(err => addToast('Copy File Failed', String(err), 'error'));
        }
        break;
      }
      case 'refactor.safeDelete': {
        const curTab = tabs.find(t => t.id === activeTabId);
        if (!curTab || !curTab.path) {
          addToast('Safe Delete', 'No active file in editor to delete', 'info');
          break;
        }
        const targetPath = resolveProjectPath(curTab.path, currentProjectDirectory);
        if (!targetPath) {
          addToast('Safe Delete Failed', 'Cannot resolve file path without an open workspace.', 'error');
          break;
        }
        const confirmed = window.confirm(`Are you sure you want to delete "${curTab.title}"?\nPath: ${targetPath}`);
        if (confirmed) {
          invoke('vfs_delete_path', { path: targetPath })
            .then(() => {
              handleCloseActiveTab();
              syncProjectFilesFromDisk();
              addToast('Safe Delete', `Successfully deleted ${curTab.title}`, 'success');
            })
            .catch(err => addToast('Delete Failed', String(err), 'error'));
        }
        break;
      }

      // ─── Build & Run Actions ───
      case 'build.build':
      case 'build.buildModule':
      case 'build.artifacts':
        handleBuild('build');
        break;
      case 'build.rebuild':
        handleBuild('rebuild');
        break;
      case 'build.clean':
        handleBuild('clean');
        break;
      case 'run.run':
        handleRun();
        break;
      case 'run.tests':
        setBottomTab('run');
        setIsBottomOpen(true);
        handleBuild('build');
        addToast('Run Tests', 'Running project test suite', 'info');
        break;
      case 'run.debug':
        handleStartDebug();
        break;
      case 'run.coverage':
        handleRun();
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          invoke<string[]>('coverage_detect_reports', { projectPath: currentProjectDirectory })
            .then(reports => {
              if (reports && reports.length > 0) {
                invoke('coverage_load_file', { coverageFilePath: reports[0] })
                  .then(() => {
                    addToast('Coverage Active', `Loaded coverage report: ${reports[0]}`, 'success');
                  })
                  .catch(err => {
                    addToast('Coverage Load Failed', String(err), 'error');
                  });
              } else {
                addToast('Run with Coverage', 'Running tests with coverage profiling', 'info');
              }
            })
            .catch(err => {
              addToast('Coverage Detection Failed', String(err), 'warning');
            });
        }
        setBottomTab('coverage');
        setIsBottomOpen(true);
        break;
      case 'run.profile':
        handleRun();
        setBottomTab('profiler');
        setIsBottomOpen(true);
        addToast('Profiler Attached', `Profiling '${projectName || 'Desktop IDE'}': Live CPU and Memory sampling active`, 'info');
        break;
      case 'run.pinTab':
        addToast('Pin Tab', 'Run Console tab pinned', 'info');
        break;
      case 'run.showExecutionPoint':
        if (tabs.find(t => t.id === activeTabId)) {
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
        handleToggleBreakpoint(cursorPos.line || 1);
        break;
      case 'run.viewBreakpoints':
        setIsBreakpointsOpen(true);
        break;
      case 'run.evaluateExpression':
        setIsEvaluateExpressionOpen(true);
        break;

      // ─── Tools Actions ───
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
      case 'tools.openTask': {
        const taskName = window.prompt('Enter Task or Issue ID (e.g. TASK-102):');
        if (taskName && taskName.trim()) {
          try {
            const tasks = JSON.parse(localStorage.getItem('ij_tasks_contexts') || '[]');
            tasks.push({ name: taskName.trim(), date: Date.now(), active: true });
            localStorage.setItem('ij_tasks_contexts', JSON.stringify(tasks));
            addToast('Task Activated', `Active context switched to [${taskName.trim()}]`, 'success');
          } catch (e) {
            addToast('Task Activated', `Task ${taskName.trim()} opened`, 'info');
          }
        }
        break;
      }
      case 'tools.closeTask': {
        try {
          const tasks = JSON.parse(localStorage.getItem('ij_tasks_contexts') || '[]');
          if (tasks.length > 0) {
            const active = tasks[tasks.length - 1];
            localStorage.removeItem('ij_tasks_contexts');
            addToast('Task Closed', `Context [${active.name}] closed and state archived`, 'info');
          } else {
            addToast('Tasks & Contexts', 'No active task context to close', 'info');
          }
        } catch (e) {}
        break;
      }
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
      case 'tools.toolchains':
        setIsProjectStructureOpen(true);
        break;
      case 'tools.plugins':
        setIsSettingsOpen(true);
        break;
      case 'tools.themeStudio':
        setIsThemeStudioOpen(true);
        break;
      case 'view.diagrams':
        addToast('Structure Diagram', 'Displaying project architecture & diagram preview', 'info');
        break;

      // ─── Git Actions ───
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
        invoke('git_push', { projectPath: currentProjectDirectory })
          .then(() => {
            addToast('Git Push', `Pushed commits to origin/${currentBranch}`, 'success');
            refreshGitStatus();
          })
          .catch(e => addToast('Git Push Failed', String(e), 'error'));
        break;
      case 'git.pull':
        invoke('git_pull', { projectPath: currentProjectDirectory })
          .then(() => {
            addToast('Git Pull', `Updated ${currentBranch} from remote`, 'success');
            refreshGitStatus();
            syncProjectFilesFromDisk();
          })
          .catch(e => addToast('Git Pull Failed', String(e), 'error'));
        break;
      case 'git.fetch':
        invoke('git_fetch', { projectPath: currentProjectDirectory })
          .then(() => addToast('Git Fetch', 'Fetched latest branches and commits from remote', 'success'))
          .catch(e => addToast('Git Fetch Failed', String(e), 'error'));
        break;
      case 'git.compareBranch':
        setIsBranchesOpen(true);
        break;
      case 'git.stash':
        setIsStashOpen(true);
        break;
      case 'git.unstash':
        invoke('git_stash_pop', { projectPath: currentProjectDirectory, index: 0 })
          .then(() => {
            addToast('Git Unstash', 'Restored changes from stash@{0}', 'success');
            refreshGitStatus();
            syncProjectFilesFromDisk();
          })
          .catch(e => addToast('Git Unstash Failed', String(e), 'error'));
        break;

      // ─── Window Actions ───
      case 'window.minimize':
        invoke('app_minimize_window').catch(() => {});
        break;
      case 'window.zoom':
        invoke<boolean>('app_toggle_maximize_window').catch(() => {});
        break;
      case 'window.close':
        invoke('app_close_window').catch(() => {});
        break;
      case 'file.close':
        handleCloseActiveTab();
        break;
      case 'file.closeAll':
        closeAllTabs();
        addToast('Close All Tabs', 'All editor tabs closed', 'info');
        break;
      case 'editor.splitRight':
        splitRight();
        addToast('Split Editor', 'Editor split vertically (Split Right)', 'info');
        break;
      case 'editor.splitDown':
        splitDown();
        addToast('Split Editor', 'Editor split horizontally (Split Down)', 'info');
        break;
      case 'window.nextProject': {
        const currentProjects = useProjectStore.getState().recentProjects;
        const currentRoot = useProjectStore.getState().projectRootPath;
        if (currentProjects.length > 1) {
          const currentIndex = currentProjects.findIndex(p => p.path === currentRoot);
          const nextIndex = (currentIndex + 1) % currentProjects.length;
          const target = currentProjects[nextIndex];
          if (target) {
            handleOpenProjectPath(target.path);
            addToast('Switch Project', `Switched to project: ${target.name}`, 'info');
          }
        } else {
          addToast('Next Project', 'Only one project found in workspace history', 'info');
        }
        break;
      }
      case 'window.prevProject': {
        const currentProjects = useProjectStore.getState().recentProjects;
        const currentRoot = useProjectStore.getState().projectRootPath;
        if (currentProjects.length > 1) {
          const currentIndex = currentProjects.findIndex(p => p.path === currentRoot);
          const prevIndex = (currentIndex - 1 + currentProjects.length) % currentProjects.length;
          const target = currentProjects[prevIndex];
          if (target) {
            handleOpenProjectPath(target.path);
            addToast('Switch Project', `Switched to project: ${target.name}`, 'info');
          }
        } else {
          addToast('Previous Project', 'Only one project found in workspace history', 'info');
        }
        break;
      }
      case 'window.layoutDefault':
        setIsSideBarOpen(true);
        setActiveSideTab('project');
        setSideBarWidth(320);
        setIsBottomOpen(true);
        setBottomTab('run');
        setBottomHeight(240);
        setActiveRightPanel(null);
        unsplit();
        addToast('Layout Restored', 'Restored default IDE layout', 'success');
        break;
      case 'window.layoutSave': {
        const {
          isSideBarOpen: curSideBarOpen,
          sideBarWidth: curSideBarWidth,
          activeSideTab: curSideTab,
          isBottomOpen: curBottomOpen,
          bottomHeight: curBottomHeight,
        } = volatileStateRef.current;
        const currentLayout = {
          isSideBarOpen: curSideBarOpen,
          sideBarWidth: curSideBarWidth,
          activeSideTab: curSideTab,
          isBottomOpen: curBottomOpen,
          bottomTab: useLayoutStore.getState().bottomTab,
          bottomHeight: curBottomHeight,
          splitMode: useEditorStore.getState().splitMode,
        };
        try {
          localStorage.setItem('ij_custom_layout', JSON.stringify(currentLayout));
          addToast('Layout Saved', 'Current window layout saved as default preset', 'success');
        } catch (e) {
          addToast('Save Layout Error', 'Failed to save layout preset to local storage', 'error');
        }
        break;
      }

      // ─── Help Actions ───
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
        setIsUpdateOpen(true);
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
  }, [
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
    addToast,
    codeEditorRef,
    setTabs,
    setActiveTabId,
    setIsSideBarOpen,
    setActiveSideTab,
    setBottomTab,
    setIsBottomOpen,
    setActiveRightPanel,
    handleMarkAllNotificationsRead,
    setFiles,
    setProjectName,
    setProjectRootPath,
    setRecentProjects,
    setFileEncoding,
    setLineEnding,
    setIsReadOnly,
    setSettings,
    setPowerSaveMode,
    setIsNewProjectOpen,
    setIsVcsCloneOpen,
    setIsNewFileOpen,
    setIsRenameOpen,
    setIsSettingsOpen,
    setIsProjectStructureOpen,
    setIsLocalHistoryOpen,
    setIsDiffModalOpen,
    setActiveDiffFile,
    setDiffBaseContent,
    setDiffLocalContent,
    setIsRepairIdeOpen,
    setIsInvalidateCachesOpen,
    setIsExportSettingsOpen,
    setIsImportSettingsOpen,
    setIsCommitOpen,
    setIsSearchOpen,
    setSearchInitialTab,
    setIsGoToLineOpen,
    setIsSurroundWithOpen,
    setIsRunConfigOpen,
    setIsBreakpointsOpen,
    setIsEvaluateExpressionOpen,
    setIsThemeStudioOpen,
    setIsBranchesOpen,
    setIsStashOpen,
    setIsAboutOpen,
    setIsTipOpen,
    setIsClipboardHistoryOpen,
    splitRight,
    splitDown,
    closeAllTabs,
    unsplit,
    setSideBarWidth,
    setBottomHeight,
    toggleStatusBar,
  ]);

  return { handleMenuAction };
}
