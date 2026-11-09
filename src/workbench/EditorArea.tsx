import React, { useRef, useImperativeHandle, forwardRef, useMemo, useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { HttpResponseDto, GitBlameLineDto } from '../bindings';

const EMPTY_BLAME_DATA: GitBlameLineDto[] = [];
import { HttpResponsePreview, HttpEditorOverlay } from '../features/http';
import { CmEditor, CmEditorHandle } from '../editor';
import { OpenTab, Breakpoint, ProblemItem } from '../types';
import { DataSourceConnection, getDataSourceUrl } from '../types/database';
import { IdeSettings } from '../features/settings/SettingsModal';
import { useEditorStore } from '../stores/editorStore';
import { DatabaseTableGrid } from '../features/database/DatabaseTableGrid';
const RenameModal = React.lazy(() => import('../features/project/RenameModal').then(m => ({ default: m.RenameModal })));
import { lspService, LspPosition } from '../services/lspService';
import { SqlQueryConsole } from '../features/database/SqlQueryConsole';
import { DiffEditorTab } from '../features/git/DiffEditorTab';

import {
  X,
  ChevronRight,
  Folder,
  FileCode,
  FileJson,
  FileText,
  File,
  Lock,
  CheckCircle2,
  Table,
  Terminal,
  MoreHorizontal,
  Columns2,
  Rows2,
  Grid2X2,
  Maximize2,
  GitCommit,
  Check,
  Pin,
  Copy,
  ExternalLink,
  History,
  GitBranch,
  Bookmark,
} from 'lucide-react';

export interface EditorAreaHandle {
  formatDocument: () => void;
  commentLine: () => void;
  commentBlock: () => void;
  foldAll: () => void;
  unfoldAll: () => void;
  goToLine: (line: number, column?: number) => void;
  triggerFind: () => void;
  triggerReplace: () => void;
  duplicateLine: () => void;
  deleteLine: () => void;
  getMaxLine: () => number;
  toggleGitBlame: () => void;
  getWordAtCursor: () => string;
  revealPosition: (line: number, column: number, selectLength?: number) => void;
  optimizeImports: () => void;
  surroundWith: (type: any) => void;
  showContextActions: () => void;
  showParameterInfo: () => void;
  goToNextProblem: () => void;
  goToPrevProblem: () => void;
  insertSnippet: (code: string) => void;
  openAiPromptBar: () => void;
  undo: () => void;
  redo: () => void;
  cut: () => void;
  copy: () => void;
  paste: (text?: string) => void;
  selectAll: () => void;
  toggleCase: () => void;
  deleteSelection: () => void;
  extractVariable: (name?: string) => boolean;
  extractConstant: (name?: string) => boolean;
  extractMethod: (name?: string) => boolean;
  inlineSymbol: () => void;
  changeSignature: () => void;
}

// Alias for backwards compatibility
export type CodeEditorHandle = EditorAreaHandle;

export interface EditorAreaProps {
  projectPath?: string;
  tabs: OpenTab[];
  activeTabId: string | null;
  settings?: IdeSettings;
  isReadOnly?: boolean;
  breakpoints?: Breakpoint[];
  activePausedLine?: { filePath: string; line: number } | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onChangeContent: (tabId: string, newContent: string) => void;
  onCursorChange?: (line: number, column: number) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onSelectMenuAction?: (actionId: string) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseAllTabs?: () => void;
  onCloseUnmodifiedTabs?: () => void;
  onCloseTabsLeft?: (tabId: string) => void;
  onCloseTabsRight?: (tabId: string) => void;
  onRunFile?: () => void;
  onFindUsages?: (symbol: string) => void;
  onShowUsages?: (symbol: string) => void;
  onRenameSymbol?: (currentSymbol: string) => void;
  onOpenGoToLine?: () => void;
  onToggleBreakpoint?: (lineNumber: number) => void;
  onUpdateBreakpoint?: (bp: Breakpoint) => void;
  onRemoveBreakpoint?: (id: string) => void;
  problems?: ProblemItem[];
  onToggleProblems?: () => void;
  onOpenSurroundWith?: () => void;
  onOpenAiDrawer?: (initialPrompt?: string) => void;
  dataSources?: DataSourceConnection[];
  onUpdateTableData?: (dataSourceId: string, schema: string, tableName: string, newRows: Record<string, any>[]) => void;
  onRunTestAtLine?: (lineNumber: number, testName?: string) => void;
  onOpenGitCommit?: (commitHash: string) => void;
  onOpenFileAtLocation?: (filePath: string, line: number, col: number) => void;
  onTogglePinTab?: (tabId: string) => void;
  onReopenClosedTab?: () => void;
  onRenameFile?: (tabId: string) => void;
  onLocalHistory?: (filePath: string) => void;
  onToggleBookmark?: (filePath: string, mnemonic?: string) => void;
  onShowBookmarksModal?: () => void;
}

export type CodeEditorProps = EditorAreaProps;

export const getTabIcon = (fileName: string, tab?: OpenTab) => {
  if (tab?.tabType === 'diff') {
    return <GitCommit size={13} className="text-[#3574F0] flex-shrink-0" />;
  }
  if (tab?.tabType === 'db-table') {
    return <Table size={13} className="text-[#3574F0] flex-shrink-0" />;
  }
  if (tab?.tabType === 'sql-console') {
    return <Terminal size={13} className="text-[#59A869] flex-shrink-0" />;
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.http') || lower.endsWith('.rest')) {
    return (
      <span className="w-3.5 h-3.5 rounded bg-[#59A869]/20 border border-[#59A869]/40 text-[#59A869] font-bold text-[8px] flex items-center justify-center flex-shrink-0">
        HTTP
      </span>
    );
  }
  if (lower.endsWith('.sql')) {
    return <Terminal size={13} className="text-[#59A869] flex-shrink-0" />;
  }
  if (lower.endsWith('.rs')) {
    return (
      <span className="w-3.5 h-3.5 rounded bg-[#CE422B]/20 border border-[#CE422B]/40 text-[#EDA200] font-bold text-[8px] flex items-center justify-center flex-shrink-0">
        RS
      </span>
    );
  }
  if (lower.endsWith('.tsx') || lower.endsWith('.ts')) {
    return (
      <span className="w-3.5 h-3.5 rounded bg-[#3574F0]/20 border border-[#3574F0]/40 text-[#3574F0] font-bold text-[8px] flex items-center justify-center flex-shrink-0">
        TS
      </span>
    );
  }
  if (lower.endsWith('.vue')) {
    return (
      <span className="w-3.5 h-3.5 rounded bg-[#42B883]/20 border border-[#42B883]/50 text-[#42B883] font-bold text-[8px] flex items-center justify-center flex-shrink-0">
        V
      </span>
    );
  }
  if (lower.endsWith('.jsx') || lower.endsWith('.js')) {
    return (
      <span className="w-3.5 h-3.5 rounded bg-[#F7DF1E]/20 border border-[#F7DF1E]/40 text-[#F7DF1E] font-bold text-[8px] flex items-center justify-center flex-shrink-0">
        JS
      </span>
    );
  }
  if (lower.endsWith('.json') || lower.endsWith('.toml')) {
    return <FileJson size={13} className="text-[#E5C07B] flex-shrink-0" />;
  }
  if (lower.endsWith('.md')) {
    return (
      <span className="w-3.5 h-3.5 rounded bg-[#6897BB]/20 border border-[#6897BB]/40 text-[#6897BB] font-bold text-[8px] flex items-center justify-center flex-shrink-0">
        MD
      </span>
    );
  }
  if (lower.endsWith('.html')) {
    return <FileCode size={13} className="text-[#E06C75] flex-shrink-0" />;
  }
  if (lower.endsWith('.css') || lower.endsWith('.scss')) {
    return <FileCode size={13} className="text-[#42A5F5] flex-shrink-0" />;
  }
  if (lower.endsWith('.py')) {
    return (
      <span className="w-3.5 h-3.5 rounded bg-[#3776AB]/20 border border-[#3776AB]/40 text-[#FFD43B] font-bold text-[8px] flex items-center justify-center flex-shrink-0">
        PY
      </span>
    );
  }
  if (lower.endsWith('.go')) {
    return (
      <span className="w-3.5 h-3.5 rounded bg-[#00ADD8]/20 border border-[#00ADD8]/40 text-[#00ADD8] font-bold text-[8px] flex items-center justify-center flex-shrink-0">
        GO
      </span>
    );
  }
  if (lower.endsWith('.txt') || lower.endsWith('.log')) {
    return <FileText size={13} className="text-[#868A91] flex-shrink-0" />;
  }
  return <File size={13} className="text-[#868A91] flex-shrink-0" />;
};

export const EditorArea = forwardRef<EditorAreaHandle, EditorAreaProps>(
  (
    {
      tabs,
      activeTabId,
      settings,
      isReadOnly = false,
      breakpoints = [],
      activePausedLine = null,
      onSelectTab,
      onCloseTab,
      onChangeContent,
      onCursorChange,
      onShowToast,
      onSelectMenuAction,
      onToggleBreakpoint,
      dataSources = [],
      onUpdateTableData,
      problems = [],
      projectPath,
      onOpenGitCommit,
      onFindUsages,
      onOpenSurroundWith,
      onRunFile,
      onOpenAiDrawer,
      onOpenFileAtLocation,
      onCloseOtherTabs,
      onCloseAllTabs,
      onCloseUnmodifiedTabs,
      onCloseTabsLeft,
      onCloseTabsRight,
      onTogglePinTab,
      onReopenClosedTab,
      onRenameFile,
      onLocalHistory,
      onToggleBookmark,
      onShowBookmarksModal,
    },
    ref
  ) => {
    const cmEditorRef = useRef<CmEditorHandle>(null);

    const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId), [tabs, activeTabId]);

    // Path segments for breadcrumbs
    const pathParts = useMemo(() => {
      if (!activeTab) return [];
      const cleanPath = activeTab.path.replace(/\\/g, '/');
      return cleanPath.split('/').filter(Boolean);
    }, [activeTab]);

    // HTTP REST Client State
    const [httpResponse, setHttpResponse] = useState<HttpResponseDto | null>(null);
    const [isHttpLoading, setIsHttpLoading] = useState(false);
    const [httpError, setHttpError] = useState<string | null>(null);
    const [runningHttpBlockId, setRunningHttpBlockId] = useState<string | null>(null);

    // Git Blame State (Per-file tracking)
    const [blameOpenFiles, setBlameOpenFiles] = useState<Record<string, boolean>>({});
    const [blameDataByFile, setBlameDataByFile] = useState<Record<string, GitBlameLineDto[]>>({});
    const isCurrentBlameOpen = Boolean(activeTab?.path && blameOpenFiles[activeTab.path]);

    // Code Coverage State (ide-coverage)
    const [showCoverage, setShowCoverage] = useState(true);
    const [coverageDataByFile, setCoverageDataByFile] = useState<Record<string, any>>({});

    const fetchCoverageForFile = useCallback(async (filePath: string) => {
      if (!filePath) return null;
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          const data = await invoke<any>('coverage_get_for_file', { filePath });
          if (data) {
            setCoverageDataByFile(prev => ({ ...prev, [filePath]: data }));
          }
          return data;
        }
      } catch (err) {
        console.debug('Coverage check for file:', filePath, err);
      }
      return null;
    }, []);

    useEffect(() => {
      if (activeTab?.path) {
        fetchCoverageForFile(activeTab.path);
      }
    }, [activeTab?.path, fetchCoverageForFile]);

    const fetchBlameForFile = useCallback(async (filePath: string) => {
      if (!filePath) return null;
      try {
        const projectDir = projectPath || (filePath.includes('\\')
          ? filePath.substring(0, filePath.lastIndexOf('\\'))
          : '.');
        const data = await invoke<GitBlameLineDto[]>('git_get_blame', {
          projectPath: projectDir,
          filePath,
        });
        setBlameDataByFile(prev => ({ ...prev, [filePath]: data }));
        return data;
      } catch (err) {
        console.warn('Failed to load git blame for', filePath, err);
        return null;
      }
    }, [projectPath]);

    const toggleGitBlame = useCallback(async (explicitFilePath?: string) => {
      const targetPath = explicitFilePath || activeTab?.path;
      if (!targetPath) return;

      const currentlyOpen = Boolean(blameOpenFiles[targetPath]);
      const next = !currentlyOpen;

      setBlameOpenFiles(prev => ({ ...prev, [targetPath]: next }));

      if (next) {
        if (!blameDataByFile[targetPath]) {
          onShowToast?.('Git Blame', 'Loading git annotations...', 'info');
          const data = await fetchBlameForFile(targetPath);
          if (data && data.length > 0) {
            onShowToast?.('Git Blame', `Annotated ${data.length} lines`, 'success');
          } else {
            onShowToast?.('Git Blame', 'No git blame available for this file', 'warning');
          }
        } else {
          onShowToast?.('Git Blame', 'Git annotations enabled', 'info');
        }
      } else {
        onShowToast?.('Git Blame', 'Git annotations closed', 'info');
      }
    }, [activeTab?.path, blameOpenFiles, blameDataByFile, fetchBlameForFile, onShowToast]);

    useEffect(() => {
      if (activeTab?.path && blameOpenFiles[activeTab.path] && !blameDataByFile[activeTab.path]) {
        fetchBlameForFile(activeTab.path);
      }
    }, [activeTab?.path, blameOpenFiles, blameDataByFile, fetchBlameForFile]);

    // Editor Store Split State
    const {
      splitMode,
      setSplitMode,
      splitRight,
      splitDown,
      splitGrid,
      unsplit,
      secondaryTabId,
      tertiaryTabId,
      quaternaryTabId,
      setPaneTabId,
    } = useEditorStore();

    // Symbol Rename State (Shift+F6)
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState<{ symbol: string; line: number; character: number } | null>(null);

    const handleOpenRename = useCallback((symbol: string, line: number, character: number) => {
      setRenameTarget({ symbol, line, character });
      setIsRenameOpen(true);
    }, []);

    const handleExecuteRename = useCallback(async (newName: string) => {
      if (!activeTab || !renameTarget) return;
      onShowToast?.('Rename Symbol', `Renaming '${renameTarget.symbol}' to '${newName}'...`, 'info');
      const pos: LspPosition = {
        line: Math.max(0, renameTarget.line - 1),
        character: Math.max(0, renameTarget.character - 1),
      };
      try {
        const edit = await lspService.renameSymbol(activeTab.path, pos, newName);
        if (edit) {
          const res = await lspService.applyWorkspaceEdit(edit);
          onShowToast?.(
            'Rename Complete',
            `Renamed ${res.appliedCount} occurrence(s) across ${res.filesChanged.length} file(s)`,
            'success'
          );
        } else {
          onShowToast?.('Rename Symbol', 'No references found to rename or language server returned no edits', 'warning');
        }
      } catch (err) {
        console.warn('LSP Rename error:', err);
        onShowToast?.('Rename Symbol', 'Rename failed: ' + String(err), 'error');
      }
    }, [activeTab, renameTarget, onShowToast]);

    const [tabContextMenu, setTabContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
    const [activeTabSubmenu, setActiveTabSubmenu] = useState<string | null>(null);
    const [gutterContextMenu, setGutterContextMenu] = useState<{
      x: number;
      y: number;
      lineNumber: number;
      filePath: string;
    } | null>(null);

    const handleGutterContextMenu = useCallback((e: MouseEvent, lineNumber: number) => {
      if (!activeTab) return;
      setGutterContextMenu({
        x: e.clientX,
        y: e.clientY,
        lineNumber,
        filePath: activeTab.path,
      });
    }, [activeTab]);

    // Resolve active tabs for each pane
    const secondaryTab = useMemo(() => {
      return tabs.find(t => t.id === secondaryTabId) || tabs.find(t => t.id !== activeTabId) || activeTab;
    }, [tabs, secondaryTabId, activeTabId, activeTab]);

    const tertiaryTab = useMemo(() => {
      return tabs.find(t => t.id === tertiaryTabId) || tabs[2] || activeTab;
    }, [tabs, tertiaryTabId, activeTab]);

    const quaternaryTab = useMemo(() => {
      return tabs.find(t => t.id === quaternaryTabId) || tabs[3] || secondaryTab || activeTab;
    }, [tabs, quaternaryTabId, secondaryTab, activeTab]);

    const isHttpFile = useMemo(() => {
      if (!activeTab) return false;
      const lower = activeTab.path.toLowerCase();
      const titleLower = activeTab.title.toLowerCase();
      return (
        lower.endsWith('.http') ||
        lower.endsWith('.rest') ||
        titleLower.endsWith('.http') ||
        titleLower.endsWith('.rest')
      );
    }, [activeTab]);

    const handleRunHttpBlock = useCallback(
      (blockId: string) => {
        if (!activeTab) return;
        setIsHttpLoading(true);
        setHttpError(null);
        setRunningHttpBlockId(blockId);

        invoke<HttpResponseDto>('http_execute_file_block', {
          content: activeTab.content,
          blockId,
        })
          .then((res) => {
            setHttpResponse(res);
            setHttpError(null);
          })
          .catch((err) => {
            setHttpError(String(err));
          })
          .finally(() => {
            setIsHttpLoading(false);
            setRunningHttpBlockId(null);
          });
      },
      [activeTab]
    );

    // Expose actions to parent / ref
    useImperativeHandle(ref, () => ({
      formatDocument: () => {
        cmEditorRef.current?.formatDocument();
      },
      commentLine: () => {
        cmEditorRef.current?.commentLine();
      },
      commentBlock: () => {
        cmEditorRef.current?.commentBlock();
      },
      foldAll: () => {
        cmEditorRef.current?.foldAll();
      },
      unfoldAll: () => {
        cmEditorRef.current?.unfoldAll();
      },
      goToLine: (line: number, column: number = 1) => {
        cmEditorRef.current?.goToLine(line, column);
      },
      triggerFind: () => {
        cmEditorRef.current?.triggerFind();
      },
      triggerReplace: () => {
        cmEditorRef.current?.triggerReplace();
      },
      duplicateLine: () => {
        cmEditorRef.current?.duplicateLine();
      },
      deleteLine: () => {
        cmEditorRef.current?.deleteLine();
      },
      getMaxLine: () => {
        if (!activeTab?.content) return 1;
        return activeTab.content.split('\n').length;
      },
      toggleGitBlame: () => {
        toggleGitBlame();
      },
      getWordAtCursor: () => {
        return cmEditorRef.current?.getWordAtCursor() || '';
      },
      revealPosition: (line: number, column: number) => {
        cmEditorRef.current?.goToLine(line, column);
      },
      optimizeImports: () => {
        cmEditorRef.current?.optimizeImports();
      },
      surroundWith: (type: any) => {
        cmEditorRef.current?.surroundWith(type);
      },
      showContextActions: () => {
        cmEditorRef.current?.showContextActions();
      },
      showParameterInfo: () => {},
      goToNextProblem: () => {},
      goToPrevProblem: () => {},
      insertSnippet: (code: string) => {
        cmEditorRef.current?.insertSnippet(code);
      },
      openAiPromptBar: () => {},
      undo: () => {
        cmEditorRef.current?.undo();
      },
      redo: () => {
        cmEditorRef.current?.redo();
      },
      cut: () => {
        cmEditorRef.current?.cut();
      },
      copy: () => {
        cmEditorRef.current?.copy();
      },
      paste: (text) => {
        cmEditorRef.current?.paste(text);
      },
      selectAll: () => {
        cmEditorRef.current?.selectAll();
      },
      toggleCase: () => {
        cmEditorRef.current?.toggleCase();
      },
      deleteSelection: () => {
        cmEditorRef.current?.deleteSelection();
      },
      extractVariable: (name) => {
        return cmEditorRef.current?.extractVariable(name) ?? false;
      },
      extractConstant: (name) => {
        return cmEditorRef.current?.extractConstant(name) ?? false;
      },
      extractMethod: (name) => {
        return cmEditorRef.current?.extractMethod(name) ?? false;
      },
      inlineSymbol: () => {
        cmEditorRef.current?.inlineSymbol();
      },
      changeSignature: () => {
        cmEditorRef.current?.changeSignature();
      },
    }));

    if (!activeTab || tabs.length === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-[#1E1F22] text-[#868A91] select-none p-6">
          <div className="w-12 h-12 rounded-2xl bg-[#2B2D30]/60 flex items-center justify-center mb-4 border border-[#393B40]/50 shadow-inner">
            <span className="text-[#3574F0] font-black text-xl">IJ</span>
          </div>
          <p className="text-sm font-medium text-[#DFE1E5] mb-1">No Open Files in Editor</p>
          <p className="text-xs text-[#868A91] mb-6">Open a file from the Project Tree or use quick shortcuts:</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono">
            <div className="text-right text-[#868A91]">Search Everywhere:</div>
            <div className="text-[#DFE1E5] font-semibold">Shift + Shift</div>
            <div className="text-right text-[#868A91]">Find in Files:</div>
            <div className="text-[#DFE1E5] font-semibold">Ctrl + Shift + F</div>
            <div className="text-right text-[#868A91]">Go to Line:</div>
            <div className="text-[#DFE1E5] font-semibold">Ctrl + G</div>
            <div className="text-right text-[#868A91]">Settings:</div>
            <div className="text-[#DFE1E5] font-semibold">Ctrl + Alt + S</div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col bg-[#1E1F22] overflow-hidden">
        {/* ─── 1. Editor Tabs Bar (IntelliJ New UI) ─── */}
        <div
          onContextMenu={(e) => e.preventDefault()}
          className="h-[34px] bg-[#1E1F22] border-b border-[#2B2D30] flex items-center justify-between select-none overflow-x-auto flex-shrink-0"
        >
          <div className="flex items-center h-full">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }
                  }}
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTabContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                    setActiveTabSubmenu(null);
                  }}
                  className={`flex items-center gap-2 px-3 h-full cursor-pointer text-[12px] border-r border-[#2B2D30] transition-colors relative group ${
                    isActive
                      ? 'bg-[#1E1F22] text-[#DFE1E5] font-medium'
                      : 'bg-[#1E1F22] text-[#868A91] hover:bg-[#2B2D30]/60 hover:text-[#DFE1E5]'
                  }`}
                >
                  {/* Active Indicator Bottom Accent */}
                  {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3574F0]" />}

                  {/* File Icon */}
                  {getTabIcon(tab.title, tab)}

                  {/* File Name */}
                  <span className="truncate max-w-[140px] tracking-tight">{tab.title}</span>

                  {/* Pinned Indicator */}
                  {tab.isPinned && (
                    <span title="Pinned Tab" className="flex items-center">
                      <Pin size={10} className="text-[#3574F0] rotate-45 flex-shrink-0" />
                    </span>
                  )}

                  {/* Dirty indicator */}
                  {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-[#3574F0] flex-shrink-0" />}

                  {/* Close Button */}
                  {!tab.isPinned && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(tab.id);
                      }}
                      className="p-0.5 rounded hover:bg-[#323438] text-[#868A91] hover:text-[#DFE1E5] opacity-60 group-hover:opacity-100 transition-opacity"
                      title="Close (Ctrl+W / Middle-Click)"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Tab Actions: Problems Status & More */}
          <div className="flex items-center gap-1 px-3 text-[#868A91] flex-shrink-0">
            <button
              onClick={() => {
                onSelectMenuAction?.('view.toggleProblems');
                onShowToast?.('Problems', `Inspections: ${problems.length} issues found`, 'info');
              }}
              title={`Code Analysis: ${problems.length} problems (Alt+6)`}
              className="px-1.5 py-0.5 hover:bg-[#2B2D30] text-[#59A869] rounded transition-colors flex items-center gap-1 text-[11px] font-sans cursor-pointer"
            >
              <CheckCircle2 size={13} />
              <span className="text-[10.5px] text-[#868A91] font-medium hidden sm:inline">
                {problems.length === 0 ? 'No problems' : `${problems.length} problems`}
              </span>
            </button>
            <button
              title="More Options"
              className="p-1 hover:bg-[#2B2D30] hover:text-[#DFE1E5] rounded transition-colors cursor-pointer"
            >
              <MoreHorizontal size={13} />
            </button>
            {/* Git Blame Action Button */}
            <button
              onClick={() => toggleGitBlame()}
              title={isCurrentBlameOpen ? 'Close Annotations (Blame)' : 'Annotate with Git Blame'}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isCurrentBlameOpen ? 'bg-[#3574F0]/25 text-[#56A8F5]' : 'hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5]'
              }`}
            >
              <GitCommit size={13} />
            </button>

            {/* Split Controls */}
            <div className="flex items-center gap-0.5 border-l border-[#2B2D30] pl-1 ml-1">
              <button
                onClick={() => splitRight(activeTabId || undefined)}
                title="Split Right (Vertical Split)"
                className={`p-1 rounded transition-colors cursor-pointer ${splitMode === 'vertical' ? 'bg-[#3574F0]/20 text-[#3574F0]' : 'hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5]'}`}
              >
                <Columns2 size={13} />
              </button>
              <button
                onClick={() => splitDown(activeTabId || undefined)}
                title="Split Down (Horizontal Split)"
                className={`p-1 rounded transition-colors cursor-pointer ${splitMode === 'horizontal' ? 'bg-[#3574F0]/20 text-[#3574F0]' : 'hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5]'}`}
              >
                <Rows2 size={13} />
              </button>
              <button
                onClick={splitGrid}
                title="Split 4-Grid"
                className={`p-1 rounded transition-colors cursor-pointer ${splitMode === 'grid' ? 'bg-[#3574F0]/20 text-[#3574F0]' : 'hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5]'}`}
              >
                <Grid2X2 size={13} />
              </button>
              {splitMode !== 'none' && (
                <button
                  onClick={unsplit}
                  title="Unsplit All (Single Editor)"
                  className="p-1 hover:bg-[#2B2D30] text-[#EDA200] hover:text-white rounded transition-colors cursor-pointer"
                >
                  <Maximize2 size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

                {/* Helper function to render an editor pane */}
        {(() => {
          const renderPaneContent = (paneTab: OpenTab | undefined, isSecondary: boolean, paneId: 'primary' | 'secondary' | 'tertiary' | 'quaternary') => {
            if (!paneTab) {
              return (
                <div className="h-full flex flex-col items-center justify-center bg-[#1E1F22] text-[#868A91] p-4 text-xs">
                  <span>No file selected for this pane</span>
                </div>
              );
            }

            const paneIsHttp = paneTab.path.toLowerCase().endsWith('.http') || paneTab.path.toLowerCase().endsWith('.rest');

            return (
              <div className="h-full flex flex-col bg-[#1E1F22] overflow-hidden relative">
                {/* Pane sub-header when in split mode */}
                {splitMode !== 'none' && (
                  <div className="h-6 bg-[#25272B] border-b border-[#2B2D30] px-2.5 flex items-center justify-between text-[11px] text-[#DFE1E5] flex-shrink-0 select-none">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {getTabIcon(paneTab.title, paneTab)}
                      <select
                        value={paneTab.id}
                        onChange={(e) => setPaneTabId(paneId, e.target.value)}
                        className="bg-transparent text-[#DFE1E5] font-medium outline-none cursor-pointer truncate max-w-[180px]"
                      >
                        {tabs.map((t) => (
                          <option key={t.id} value={t.id} className="bg-[#2B2D30] text-[#DFE1E5]">
                            {t.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1 text-[#868A91]">
                      <span className="text-[9px] uppercase px-1 rounded bg-[#1E1F22] text-[#868A91] border border-[#393B40]">
                        {paneId}
                      </span>
                    </div>
                  </div>
                )}

                {/* Breadcrumbs */}
                {settings?.breadcrumbs !== false && (
                  <div className="h-5 bg-[#1E1F22] border-b border-[#2B2D30] px-3 flex items-center justify-between text-[10.5px] text-[#868A91] select-none flex-shrink-0">
                    <div className="flex items-center gap-1.5 font-sans overflow-hidden">
                      {paneTab.path.replace(/\\/g, '/').split('/').filter(Boolean).map((part, index, arr) => {
                        const isLast = index === arr.length - 1;
                        return (
                          <React.Fragment key={index}>
                            {index > 0 && <ChevronRight size={9} className="text-[#4E5157]" />}
                            <span className={isLast ? 'text-[#DFE1E5] font-medium' : 'hover:text-[#DFE1E5]'}>
                              {part}
                            </span>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 relative h-full overflow-hidden">
                  {paneTab.tabType === 'db-table' ? (
                    <div className="h-full overflow-hidden relative">
                      {(() => {
                        const targetDs = dataSources.find(ds => ds.id === paneTab.dbMetadata?.dataSourceId);
                        const tableName = paneTab.dbMetadata?.tableName || paneTab.title;
                        const targetTable = targetDs?.schemas.flatMap(s => s.tables).find(t => t.name.toLowerCase() === tableName.toLowerCase());

                        return (
                          <DatabaseTableGrid
                            table={targetTable || {
                              name: tableName,
                              schema: paneTab.dbMetadata?.schema || 'main',
                              columns: [],
                              rowCount: 0,
                              data: [],
                            }}
                            dataSourceName={targetDs?.name || paneTab.title}
                            dataSourceUrl={targetDs ? getDataSourceUrl(targetDs) : undefined}
                            onUpdateTableData={(newRows) => {
                              if (paneTab.dbMetadata) {
                                onUpdateTableData?.(
                                  paneTab.dbMetadata.dataSourceId,
                                  paneTab.dbMetadata.schema || 'main',
                                  paneTab.dbMetadata.tableName!,
                                  newRows
                                );
                              }
                            }}
                            onShowToast={onShowToast}
                          />
                        );
                      })()}
                    </div>
                  ) : paneTab.tabType === 'sql-console' ? (
                    <div className="h-full overflow-hidden relative">
                      <SqlQueryConsole
                        dataSources={dataSources}
                        initialDataSourceId={paneTab.dbMetadata?.dataSourceId}
                        initialQuery={paneTab.dbMetadata?.query}
                        onShowToast={onShowToast}
                      />
                    </div>
                  ) : paneTab.tabType === 'diff' && paneTab.diffData ? (
                    <div className="h-full overflow-hidden relative">
                      <DiffEditorTab
                        diffData={paneTab.diffData}
                        projectPath={projectPath}
                        onOpenFile={(fp) => onOpenFileAtLocation?.(fp, 1, 1)}
                        onChangeLocal={(newContent) => onChangeContent(paneTab.id, newContent)}
                      />
                    </div>
                  ) : (
                    <div className="h-full flex flex-col overflow-hidden">
                      {paneIsHttp && (
                        <HttpEditorOverlay
                          content={paneTab.content}
                          onRunBlock={handleRunHttpBlock}
                          runningBlockId={runningHttpBlockId}
                        />
                      )}
                      <div className="flex-1 flex overflow-hidden">
                        <div
                          className={`h-full ${
                            paneIsHttp && (httpResponse || isHttpLoading || httpError) ? 'w-3/5' : 'w-full'
                          }`}
                        >
                          <CmEditor
                            ref={isSecondary ? undefined : cmEditorRef}
                            filePath={paneTab.path}
                            content={paneTab.content}
                            language={paneTab.language}
                            isReadOnly={isReadOnly}
                            lineNumbers={settings?.lineNumbers ?? true}
                            wordWrap={settings?.wordWrap ?? false}
                            theme={settings?.theme}
                            fontSize={settings?.fontSize || 14}
                            fontFamily={settings?.fontFamily}
                            lineHeight={settings?.lineHeight || 1.45}
                            ligatures={settings?.ligatures}
                            tabSize={settings?.tabSize || 4}
                            vimMode={settings?.vimMode}
                            keymapProfile={settings?.keymapProfile}
                            customThemeJson={settings?.customThemeJson}
                            breakpoints={breakpoints}
                            activePausedLine={activePausedLine}
                            onToggleBreakpoint={onToggleBreakpoint}
                            onChange={(value) => onChangeContent(paneTab.id, value)}
                            onCursorChange={(line, col) => onCursorChange?.(line, col)}
                            showGitBlame={Boolean(paneTab.path && blameOpenFiles[paneTab.path])}
                            blameData={blameDataByFile[paneTab.path] || EMPTY_BLAME_DATA}
                            coverageData={showCoverage ? coverageDataByFile[paneTab.path] : null}
                            onGutterContextMenu={handleGutterContextMenu}
                            onTriggerRename={(word, line, col) => handleOpenRename(word, line, col)}
                            onOpenGitCommit={onOpenGitCommit}
                            onFindUsages={onFindUsages}
                            onOpenSurroundWith={onOpenSurroundWith}
                            onRunFile={onRunFile}
                            onToggleGitBlame={() => toggleGitBlame(paneTab.path)}
                            onOpenAiDrawer={onOpenAiDrawer}
                            onSelectMenuAction={onSelectMenuAction}
                            onShowToast={onShowToast}
                            projectPath={projectPath}
                            onOpenFileAtLocation={onOpenFileAtLocation}
                          />
                        </div>
                        {paneIsHttp && (httpResponse || isHttpLoading || httpError) && (
                          <div className="w-2/5 h-full">
                            <HttpResponsePreview
                              response={httpResponse}
                              isLoading={isHttpLoading}
                              error={httpError}
                              onClose={() => {
                                setHttpResponse(null);
                                setHttpError(null);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          };

          return (
            <div className="flex-1 relative h-full overflow-hidden">
              {splitMode === 'none' && renderPaneContent(activeTab, false, 'primary')}

              {splitMode === 'vertical' && (
                <div className="flex flex-row h-full w-full overflow-hidden divide-x divide-[#2B2D30]">
                  <div className="w-1/2 h-full overflow-hidden">{renderPaneContent(activeTab, false, 'primary')}</div>
                  <div className="w-1/2 h-full overflow-hidden">{renderPaneContent(secondaryTab, true, 'secondary')}</div>
                </div>
              )}

              {splitMode === 'horizontal' && (
                <div className="flex flex-col h-full w-full overflow-hidden divide-y divide-[#2B2D30]">
                  <div className="h-1/2 w-full overflow-hidden">{renderPaneContent(activeTab, false, 'primary')}</div>
                  <div className="h-1/2 w-full overflow-hidden">{renderPaneContent(secondaryTab, true, 'secondary')}</div>
                </div>
              )}

              {splitMode === 'grid' && (
                <div className="grid grid-cols-2 grid-rows-2 h-full w-full overflow-hidden divide-x divide-y divide-[#2B2D30]">
                  <div className="h-full w-full overflow-hidden">{renderPaneContent(activeTab, false, 'primary')}</div>
                  <div className="h-full w-full overflow-hidden">{renderPaneContent(secondaryTab, true, 'secondary')}</div>
                  <div className="h-full w-full overflow-hidden">{renderPaneContent(tertiaryTab, true, 'tertiary')}</div>
                  <div className="h-full w-full overflow-hidden">{renderPaneContent(quaternaryTab, true, 'quaternary')}</div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Gutter Context Menu (IntelliJ Style) */}
        {gutterContextMenu && (
          <div
            className="fixed inset-0 z-50"
            onClick={() => setGutterContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setGutterContextMenu(null);
            }}
          >
            <div
              style={{
                top: Math.min(gutterContextMenu.y, window.innerHeight - 180),
                left: Math.min(gutterContextMenu.x, window.innerWidth - 240),
              }}
              className="absolute bg-[#2B2D30] border border-[#393B40] rounded shadow-2xl py-1 w-56 text-xs text-[#DFE1E5] z-50 select-none animate-in fade-in zoom-in-95 duration-100 font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 1. Annotate with Git Blame / Close Annotations */}
              <button
                onClick={() => {
                  toggleGitBlame(gutterContextMenu.filePath);
                  setGutterContextMenu(null);
                }}
                className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors text-left cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className="w-4 flex items-center justify-center text-[#59A869]">
                    {Boolean(blameOpenFiles[gutterContextMenu.filePath || activeTab?.path || '']) && <Check size={13} />}
                  </span>
                  <span>
                    {Boolean(blameOpenFiles[gutterContextMenu.filePath || activeTab?.path || ''])
                      ? 'Close Annotations'
                      : 'Annotate with Git Blame'}
                  </span>
                </span>
              </button>

              <div className="h-[1px] bg-[#393B40] my-1" />

              {/* 2. Toggle Breakpoint on this line */}
              <button
                onClick={() => {
                  onToggleBreakpoint?.(gutterContextMenu.lineNumber);
                  setGutterContextMenu(null);
                }}
                className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors text-left"
              >
                <span className="flex items-center gap-2">
                  <span className="w-4 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-[#E5534B]" />
                  </span>
                  <span>Toggle Breakpoint</span>
                </span>
                <span className="text-[10px] text-[#868A91]">Line {gutterContextMenu.lineNumber}</span>
              </button>

              {/* 3. Copy Line Reference */}
              <button
                onClick={() => {
                  const fileName = gutterContextMenu.filePath.split(/[/\\]/).pop() || gutterContextMenu.filePath;
                  const refText = `${fileName}:${gutterContextMenu.lineNumber}`;
                  navigator.clipboard.writeText(refText);
                  onShowToast?.('Clipboard', `Copied '${refText}'`, 'info');
                  setGutterContextMenu(null);
                }}
                className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors text-left"
              >
                <span className="flex items-center gap-2">
                  <span className="w-4" />
                  <span>Copy Line Reference</span>
                </span>
                <span className="text-[10px] text-[#868A91]">Line {gutterContextMenu.lineNumber}</span>
              </button>
            </div>
          </div>
        )}
        {/* Project-Wide Symbol Rename Modal (Shift+F6) */}
        {isRenameOpen && renameTarget && (
          <React.Suspense fallback={null}>
            <RenameModal
              isOpen={isRenameOpen}
              onClose={() => {
                setIsRenameOpen(false);
                setRenameTarget(null);
              }}
              currentName={renameTarget.symbol}
              onRename={handleExecuteRename}
            />
          </React.Suspense>
        )}
        {/* IntelliJ Authentic Tab Context Menu */}
        {tabContextMenu && (() => {
          const targetTab = tabs.find((t) => t.id === tabContextMenu.tabId);
          if (!targetTab) return null;

          const estimatedHeight = 560;
          const estimatedWidth = 230;
          let posX = Math.min(tabContextMenu.x, window.innerWidth - estimatedWidth - 16);
          let posY = tabContextMenu.y;
          if (posY + estimatedHeight > window.innerHeight - 16) {
            posY = Math.max(8, window.innerHeight - estimatedHeight - 16);
          }
          const isSubmenuLeft = posX + estimatedWidth + 210 > window.innerWidth;
          const submenuPositionClass = `absolute ${isSubmenuLeft ? 'right-full -mr-0.5' : 'left-full -ml-0.5'} -top-1 bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-[60] text-[12px] text-[#DFE1E5] w-52`;

          return (
            <div
              className="fixed inset-0 z-50"
              onClick={() => {
                setTabContextMenu(null);
                setActiveTabSubmenu(null);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setTabContextMenu(null);
                setActiveTabSubmenu(null);
              }}
            >
              <div
                style={{ top: `${posY}px`, left: `${posX}px` }}
                className="absolute bg-[#2B2D30] border border-[#393B40] rounded shadow-2xl py-1 w-56 text-[12px] text-[#DFE1E5] z-50 select-none animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 1. Close */}
                <div
                  onClick={() => {
                    onCloseTab(targetTab.id);
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Close</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+F4</span>
                </div>

                {/* 2. Close Other Tabs */}
                <div
                  onClick={() => {
                    onCloseOtherTabs?.(targetTab.id);
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Close Other Tabs</span>
                </div>

                {/* 3. Close All Tabs */}
                <div
                  onClick={() => {
                    onCloseAllTabs?.();
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Close All Tabs</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+Shift+W</span>
                </div>

                {/* 4. Close Unmodified Tabs */}
                <div
                  onClick={() => {
                    onCloseUnmodifiedTabs?.();
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Close Unmodified Tabs</span>
                </div>

                {/* 5. Close Tabs to the Left */}
                <div
                  onClick={() => {
                    onCloseTabsLeft?.(targetTab.id);
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Close Tabs to the Left</span>
                </div>

                {/* 6. Close Tabs to the Right */}
                <div
                  onClick={() => {
                    onCloseTabsRight?.(targetTab.id);
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Close Tabs to the Right</span>
                </div>

                <div className="border-t border-[#393B40] my-1" />

                {/* 7. Copy Path/Reference... > */}
                <div
                  className="relative group"
                  onMouseEnter={() => setActiveTabSubmenu('copy-path')}
                >
                  <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Copy size={13} className="text-[#868A91]" />
                      <span>Copy Path/Reference...</span>
                    </div>
                    <ChevronRight size={13} className="text-[#868A91]" />
                  </div>

                  {activeTabSubmenu === 'copy-path' && (
                    <div
                      className={submenuPositionClass}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        onClick={() => {
                          navigator.clipboard?.writeText(targetTab.path);
                          onShowToast?.('Copied', `Absolute Path: ${targetTab.path}`, 'info');
                          setTabContextMenu(null);
                        }}
                        className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                      >
                        <span>Absolute Path</span>
                        <span className="text-[10px] text-[#868A91]">Ctrl+Shift+C</span>
                      </div>
                      <div
                        onClick={() => {
                          navigator.clipboard?.writeText(targetTab.title);
                          onShowToast?.('Copied', `File Name: ${targetTab.title}`, 'info');
                          setTabContextMenu(null);
                        }}
                        className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                      >
                        <span>File Name</span>
                      </div>
                      <div
                        onClick={() => {
                          const norm = (p: string) => p.replace(/\\/g, '/');
                          const full = norm(targetTab.path);
                          const root = norm(projectPath || '');
                          let rel = full;
                          if (root && full.startsWith(root)) {
                            rel = full.slice(root.length).replace(/^\/+/, '');
                          }
                          navigator.clipboard?.writeText(rel);
                          onShowToast?.('Copied', `Content Root: ${rel}`, 'info');
                          setTabContextMenu(null);
                        }}
                        className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                      >
                        <span>Path From Content Root</span>
                      </div>
                      <div
                        onClick={() => {
                          const norm = (p: string) => p.replace(/\\/g, '/');
                          const full = norm(targetTab.path);
                          const srcIdx = full.indexOf('/src/');
                          let srcRel = full;
                          if (srcIdx !== -1) srcRel = full.slice(srcIdx + 5);
                          else if (full.startsWith('src/')) srcRel = full.slice(4);
                          else srcRel = targetTab.title;
                          navigator.clipboard?.writeText(srcRel);
                          onShowToast?.('Copied', `Source Root: ${srcRel}`, 'info');
                          setTabContextMenu(null);
                        }}
                        className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                      >
                        <span>Path From Source Root</span>
                      </div>
                      <div
                        onClick={() => {
                          const norm = (p: string) => p.replace(/\\/g, '/');
                          const full = norm(targetTab.path);
                          const srcIdx = full.indexOf('/src/');
                          let srcRel = full;
                          if (srcIdx !== -1) srcRel = full.slice(srcIdx + 5);
                          const baseName = targetTab.title.replace(/\.[^/.]+$/, '');
                          const ref = `import { ${baseName} } from './${srcRel.replace(/\.[^/.]+$/, '')}';`;
                          navigator.clipboard?.writeText(ref);
                          onShowToast?.('Copied', `Reference: ${ref}`, 'info');
                          setTabContextMenu(null);
                        }}
                        className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                      >
                        <span>Copy Reference</span>
                        <span className="text-[10px] text-[#868A91]">Ctrl+Alt+Shift+C</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-[#393B40] my-1" />

                {/* 8. Split Right */}
                <div
                  onClick={() => {
                    splitRight(targetTab.id);
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Columns2 size={13} className="text-[#3574F0]" />
                    <span>Split Right</span>
                  </div>
                </div>

                {/* 9. Split and Move Right */}
                <div
                  onClick={() => {
                    splitRight(targetTab.id);
                    const remaining = tabs.filter((t) => t.id !== targetTab.id);
                    if (remaining.length > 0) onSelectTab(remaining[0].id);
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-7"
                >
                  <span>Split and Move Right</span>
                </div>

                {/* 10. Split Down */}
                <div
                  onClick={() => {
                    splitDown(targetTab.id);
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Rows2 size={13} className="text-[#3574F0]" />
                    <span>Split Down</span>
                  </div>
                </div>

                {/* 11. Split and Move Down */}
                <div
                  onClick={() => {
                    splitDown(targetTab.id);
                    const remaining = tabs.filter((t) => t.id !== targetTab.id);
                    if (remaining.length > 0) onSelectTab(remaining[0].id);
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-7"
                >
                  <span>Split and Move Down</span>
                </div>

                <div className="border-t border-[#393B40] my-1" />

                {/* 12. Pin Tab */}
                <div
                  onClick={() => {
                    onTogglePinTab?.(targetTab.id);
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <Pin size={13} className={targetTab.isPinned ? 'text-[#3574F0] rotate-45' : 'text-[#868A91]'} />
                  <span>{targetTab.isPinned ? 'Unpin Tab' : 'Pin Tab'}</span>
                </div>

                {/* 13. Open Tab in New Window */}
                <div
                  onClick={() => {
                    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
                      invoke('open_new_window', { path: targetTab.path }).catch(() => {
                        onShowToast?.('New Window', `Opened ${targetTab.title} in new window`, 'info');
                      });
                    } else {
                      onShowToast?.('New Window', `Opened ${targetTab.title} in new window`, 'info');
                    }
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Open Tab in New Window</span>
                  <span className="text-[10px] text-[#868A91]">Shift+F4</span>
                </div>

                {/* 14. Configure Editor Tabs... */}
                <div
                  onClick={() => {
                    onShowToast?.('Editor Tabs Settings', 'Tabs Placement: Top | Tabs Limit: 10', 'info');
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Configure Editor Tabs...</span>
                </div>

                <div className="border-t border-[#393B40] my-1" />

                {/* 15. Reopen Closed Tab */}
                <div
                  onClick={() => {
                    onReopenClosedTab?.();
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Reopen Closed Tab</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+Shift+T</span>
                </div>

                {/* 16. Bookmarks > */}
                <div
                  className="relative group"
                  onMouseEnter={() => setActiveTabSubmenu('bookmarks')}
                >
                  <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bookmark size={13} className="text-[#868A91]" />
                      <span>Bookmarks</span>
                    </div>
                    <ChevronRight size={13} className="text-[#868A91]" />
                  </div>

                  {activeTabSubmenu === 'bookmarks' && (
                    <div
                      className={submenuPositionClass}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        onClick={() => {
                          onToggleBookmark?.(targetTab.path);
                          setTabContextMenu(null);
                        }}
                        className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                      >
                        <span>Add Bookmark</span>
                        <span className="text-[10px] text-[#868A91]">F11</span>
                      </div>
                      <div
                        onClick={() => {
                          const mnemonic = window.prompt(`Enter mnemonic bookmark for ${targetTab.title} (0-9 or A-Z):`, '1');
                          if (mnemonic) onToggleBookmark?.(targetTab.path, mnemonic.trim().toUpperCase());
                          setTabContextMenu(null);
                        }}
                        className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                      >
                        <span>Add Mnemonic Bookmark...</span>
                        <span className="text-[10px] text-[#868A91]">Ctrl+F11</span>
                      </div>
                      <div
                        onClick={() => {
                          onShowBookmarksModal?.();
                          setTabContextMenu(null);
                        }}
                        className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                      >
                        <span>Show Bookmarks</span>
                        <span className="text-[10px] text-[#868A91]">Shift+F11</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-[#393B40] my-1" />

                {/* 17. Override File Type */}
                <div
                  onClick={() => {
                    onShowToast?.('Override File Type', `Current file syntax: ${targetTab.language}`, 'info');
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Override File Type</span>
                </div>

                {/* 18. Open In > */}
                <div
                  className="relative group"
                  onMouseEnter={() => setActiveTabSubmenu('open-in')}
                >
                  <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ExternalLink size={13} className="text-[#868A91]" />
                      <span>Open In</span>
                    </div>
                    <ChevronRight size={13} className="text-[#868A91]" />
                  </div>

                  {activeTabSubmenu === 'open-in' && (
                    <div
                      className={submenuPositionClass}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        onClick={() => {
                          if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
                            invoke('reveal_in_explorer', { path: targetTab.path })
                              .then(() => onShowToast?.('Explorer', `Revealed ${targetTab.title} in Windows Explorer`, 'success'))
                              .catch((err) => onShowToast?.('Explorer Error', String(err), 'error'));
                          } else {
                            onShowToast?.('Explorer', `Revealing ${targetTab.title} in Windows Explorer`, 'info');
                          }
                          setTabContextMenu(null);
                        }}
                        className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                      >
                        <Folder size={13} className="text-[#3574F0]" />
                        <span>Explorer</span>
                      </div>
                      <div
                        onClick={() => {
                          onSelectMenuAction?.('view.toggleTerminal');
                          onShowToast?.('Terminal', `Navigated to terminal`, 'info');
                          setTabContextMenu(null);
                        }}
                        className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                      >
                        <Terminal size={13} className="text-[#59A869]" />
                        <span>Terminal</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 19. Local History > */}
                <div
                  className="relative group"
                  onMouseEnter={() => setActiveTabSubmenu('local-history')}
                >
                  <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History size={13} className="text-[#868A91]" />
                      <span>Local History</span>
                    </div>
                    <ChevronRight size={13} className="text-[#868A91]" />
                  </div>

                  {activeTabSubmenu === 'local-history' && (
                    <div
                      className={submenuPositionClass}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        onClick={() => {
                          onLocalHistory?.(targetTab.path);
                          setTabContextMenu(null);
                        }}
                        className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                      >
                        <span>Show History</span>
                      </div>
                      <div
                        onClick={() => {
                          const label = window.prompt(`Enter checkpoint label for ${targetTab.title}:`, `Checkpoint-${new Date().toLocaleTimeString()}`);
                          if (label) onShowToast?.('Local History', `Saved label "${label}" for ${targetTab.title}`, 'success');
                          setTabContextMenu(null);
                        }}
                        className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                      >
                        <span>Put Label...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 20. Git > */}
                <div
                  className="relative group"
                  onMouseEnter={() => setActiveTabSubmenu('git')}
                >
                  <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch size={13} className="text-[#868A91]" />
                      <span>Git</span>
                    </div>
                    <ChevronRight size={13} className="text-[#868A91]" />
                  </div>

                  {activeTabSubmenu === 'git' && (
                    <div
                      className={submenuPositionClass}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        onClick={() => {
                          onSelectMenuAction?.('git.compareBranch');
                          setTabContextMenu(null);
                        }}
                        className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                      >
                        <span>Compare with Branch...</span>
                      </div>
                      <div
                        onClick={() => {
                          onSelectMenuAction?.('git.log');
                          setTabContextMenu(null);
                        }}
                        className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                      >
                        <span>Show History</span>
                      </div>
                      <div
                        onClick={() => {
                          toggleGitBlame(targetTab.path);
                          setTabContextMenu(null);
                        }}
                        className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                      >
                        <span>
                          {Boolean(targetTab.path && blameOpenFiles[targetTab.path])
                            ? 'Close Annotations'
                            : 'Annotate with Git Blame'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-[#393B40] my-1" />

                {/* 21. Rename File... */}
                <div
                  onClick={() => {
                    onRenameFile?.(targetTab.id);
                    setTabContextMenu(null);
                  }}
                  onMouseEnter={() => setActiveTabSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Rename File...</span>
                  <span className="text-[10px] text-[#868A91]">Shift+F6</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }
);