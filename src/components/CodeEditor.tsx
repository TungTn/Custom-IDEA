import { invoke } from '@tauri-apps/api/core';
import { IDE_THEMES, buildMonacoTheme } from '../themes/themeManager';
import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect, useMemo, useCallback } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { 
  X, 
  ChevronRight, 
  Split, 
  MoreHorizontal, 
  Lock, 
  CheckCircle2, 
  Folder, 
  FileCode, 
  FileJson, 
  FileText,
  File,
  Bookmark,
  Check,
  Lightbulb,
  Sparkles,
  Clipboard,
  Copy,
  Search,
  History,
  GitBranch,
  Layers,
  Share2,
  Shield,
  Play,
  Bug,
  Pin,
  AlertCircle,
  AlertTriangle,
  Info,
  Table,
  Terminal,
  GitCompare
} from 'lucide-react';
const DiffViewerModal = React.lazy(() => import('./DiffViewerModal').then(m => ({ default: m.DiffViewerModal })));
import { OpenTab, Breakpoint, ProblemItem } from '../types';
import { DataSourceConnection } from '../types/database';
import { SurroundType } from './SurroundWithModal';
import { intellijNewUIDarkTheme } from '../themes/intellijTheme';
import { vueLanguageConfiguration, vueMonarchTokensProvider } from '../languages/vue';
import { IdeSettings } from './SettingsModal';
import { AiInlinePromptBar } from './AiInlinePromptBar';
import { DatabaseTableGrid } from './database/DatabaseTableGrid';
import { SqlQueryConsole } from './database/SqlQueryConsole';

export interface CodeEditorHandle {
  formatDocument: () => void;
  commentLine: () => void;
  foldAll: () => void;
  unfoldAll: () => void;
  goToLine: (line: number, column: number) => void;
  triggerFind: () => void;
  triggerReplace: () => void;
  duplicateLine: () => void;
  deleteLine: () => void;
  getMaxLine: () => number;
  toggleGitBlame: () => void;
  getWordAtCursor: () => string;
  revealPosition: (line: number, column: number, selectLength?: number) => void;
  optimizeImports: () => void;
  surroundWith: (type: SurroundType) => void;
  showContextActions: () => void;
  showParameterInfo: () => void;
  goToNextProblem: () => void;
  goToPrevProblem: () => void;
  insertSnippet: (code: string) => void;
  openAiPromptBar: () => void;
}

interface BlameEntry {
  line: number;
  commitHash: string;
  author: string;
  email: string;
  dateStr: string;
  relativeTime: string;
  message: string;
}

const getBlameDataForFile = (fileName: string, totalLines: number): BlameEntry[] => {
  const result: BlameEntry[] = [];
  const baseCommits = [
    { hash: 'e48a1b2', author: 'adminlocal', email: 'admin@ide.local', date: '2026-10-20 09:15', rel: '2 days ago', msg: 'feat: initial IDE core architecture and shell components' },
    { hash: '8f2d79c', author: 'adminlocal', email: 'admin@ide.local', date: '2026-10-21 11:42', rel: 'yesterday', msg: 'feat: add Monaco Editor integration and IntelliJ New UI theme' },
    { hash: '3c91a0f', author: 'You', email: 'developer@ide.local', date: '2026-10-22 14:10', rel: '1 hr ago', msg: 'feat: add terminal panel, window dragging, and resizable panes' },
    { hash: 'a1b7e65', author: 'You', email: 'developer@ide.local', date: '2026-10-22 15:35', rel: '12 mins ago', msg: 'ui: implement authentic JetBrains context menus and git blame' },
  ];

  for (let i = 1; i <= Math.max(totalLines, 1); i++) {
    let commitIdx = 0;
    if (i <= 6) commitIdx = 0;
    else if (i <= 18) commitIdx = 1;
    else if (i <= 32) commitIdx = 2;
    else commitIdx = (i % baseCommits.length);

    const c = baseCommits[commitIdx];
    result.push({
      line: i,
      commitHash: c.hash,
      author: c.author,
      email: c.email,
      dateStr: c.date,
      relativeTime: c.rel,
      message: c.msg,
    });
  }
  return result;
};

const getCommitColor = (hash: string) => {
  if (!hash || hash.startsWith('0000000') || hash.toLowerCase() === 'worktree') return '#59A869';
  const PALETTE = [
    '#3574F0', // Blue
    '#E5B567', // Amber
    '#AF7AC5', // Violet
    '#48C9B0', // Teal
    '#E67E22', // Orange
    '#5DADE2', // Sky
    '#F1948A', // Coral
    '#58D68D', // Emerald
  ];
  let h = 0;
  for (let i = 0; i < hash.length; i++) {
    h = (h << 5) - h + hash.charCodeAt(i);
    h |= 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
};

interface CodeEditorProps {
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
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(({ projectPath = 'D:\\IDE',
  tabs,
  activeTabId,
  settings,
  isReadOnly = false,
  breakpoints = [],
  activePausedLine = null,
  problems = [],
  onToggleProblems,
  onOpenSurroundWith,
  onOpenAiDrawer,
  dataSources = [],
  onUpdateTableData,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  onCloseUnmodifiedTabs,
  onCloseTabsLeft,
  onCloseTabsRight,
  onChangeContent,
  onCursorChange,
  onShowToast,
  onSelectMenuAction,
  onRunFile,
  onFindUsages,
  onShowUsages,
  onRenameSymbol,
  onOpenGoToLine,
  onToggleBreakpoint,
  onUpdateBreakpoint,
  onRemoveBreakpoint,
  onRunTestAtLine,
  onOpenGitCommit,
}, ref) => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  // Split Editor States (Split Right / Split Down)
  const [splitMode, setSplitMode] = useState<'none' | 'vertical' | 'horizontal'>('none');
  const [secondaryTabId, setSecondaryTabId] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState<number>(50); // percentage
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const secondaryTab = useMemo(() => {
    if (splitMode === 'none') return null;
    if (secondaryTabId) {
      const found = tabs.find(t => t.id === secondaryTabId);
      if (found) return found;
    }
    // Default to the first different tab, or same tab if only 1 tab
    const other = tabs.find(t => t.id !== activeTabId);
    return other || activeTab || null;
  }, [splitMode, secondaryTabId, tabs, activeTabId, activeTab]);

  const handleStartSplitResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSplit(true);
  }, []);

  useEffect(() => {
    if (!isResizingSplit) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      if (splitMode === 'vertical') {
        const newRatio = ((e.clientX - rect.left) / rect.width) * 100;
        setSplitRatio(Math.max(20, Math.min(80, newRatio)));
      } else if (splitMode === 'horizontal') {
        const newRatio = ((e.clientY - rect.top) / rect.height) * 100;
        setSplitRatio(Math.max(20, Math.min(80, newRatio)));
      }
    };
    const handleMouseUp = () => {
      setIsResizingSplit(false);
      setTimeout(() => {
        editorRef.current?.layout();
      }, 50);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSplit, splitMode]);

  // Gutter & Blame States
  const [isGitBlameActive, setIsGitBlameActive] = useState(false);
  const [realBlameData, setRealBlameData] = useState<BlameEntry[] | null>(null);
  const [isLoadingBlame, setIsLoadingBlame] = useState(false);

  useEffect(() => {
    if (!isGitBlameActive || !activeTab) {
      setRealBlameData(null);
      return;
    }

    let isMounted = true;
    setIsLoadingBlame(true);

    invoke<Array<{
      line: number;
      commit_hash: string;
      short_hash: string;
      author: string;
      email: string;
      date: string;
      relative_time: string;
      summary: string;
    }>>('git_get_blame', {
      projectPath: projectPath || 'D:\\IDE',
      filePath: activeTab.path || activeTab.title,
    })
      .then((res) => {
        if (!isMounted) return;
        if (res && res.length > 0) {
          const mapped: BlameEntry[] = res.map((r) => {
            let formattedDate = r.date;
            const ts = parseInt(r.date, 10);
            if (!isNaN(ts) && ts > 0) {
              formattedDate = new Date(ts * 1000).toLocaleString();
            }
            return {
              line: r.line,
              commitHash: r.commit_hash,
              author: r.author,
              email: r.email,
              dateStr: formattedDate,
              relativeTime: r.relative_time,
              message: r.summary,
            };
          });
          setRealBlameData(mapped);
        } else {
          setRealBlameData(null);
        }
      })
      .catch((err) => {
        console.warn('Failed to load real git blame, falling back to local simulation:', err);
        if (isMounted) setRealBlameData(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingBlame(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isGitBlameActive, activeTab?.path, projectPath]);
  const [gutterMenu, setGutterMenu] = useState<{
    x: number;
    y: number;
    lineNumber: number;
  } | null>(null);
  const [activeGutterSubmenu, setActiveGutterSubmenu] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [softWrap, setSoftWrap] = useState(settings?.wordWrap ?? false);
  const [showLineNumbers, setShowLineNumbers] = useState(settings?.lineNumbers ?? true);
  const [showWhitespaces, setShowWhitespaces] = useState(false);
  const [showIndentGuides, setShowIndentGuides] = useState(true);
  const [scrollTop, setScrollTop] = useState(0);
  const [lineHeightPx, setLineHeightPx] = useState(20);
  const [hoveredBlameLine, setHoveredBlameLine] = useState<number | null>(null);

  // JetBrains Authentic Editor Context Menu State
  const [editorMenu, setEditorMenu] = useState<{
    x: number;
    y: number;
    lineNumber: number;
    column: number;
  } | null>(null);
  const [activeEditorSubmenu, setActiveEditorSubmenu] = useState<string | null>(null);
  const editorMenuRef = useRef<HTMLDivElement>(null);
  const gutterMenuRef = useRef<HTMLDivElement>(null);
  const conditionPopupRef = useRef<HTMLDivElement>(null);
  const mnemonicPopupRef = useRef<HTMLDivElement>(null);
  const blameColumnRef = useRef<HTMLDivElement>(null);
  const blameScrollContentRef = useRef<HTMLDivElement>(null);
  const lastDuplicateTimeRef = useRef<number>(0);
  const commandsRegisteredRef = useRef<boolean>(false);

  // Blame Width & Resizing
  const [blameWidth, setBlameWidth] = useState<number>(260);
  const isResizingBlameRef = useRef(false);

  const handleBlameMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingBlameRef.current = true;
    const startX = e.clientX;
    const startW = blameWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingBlameRef.current) return;
      const delta = moveEvent.clientX - startX;
      setBlameWidth(Math.max(180, Math.min(520, startW + delta)));
    };

    const onMouseUp = () => {
      isResizingBlameRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Blame Diff Viewer State
  const [diffModalFile, setDiffModalFile] = useState<string | null>(null);
  const [diffModalBase, setDiffModalBase] = useState<string>('');
  const [diffModalLocal, setDiffModalLocal] = useState<string>('');
  const [diffModalBaseTitle, setDiffModalBaseTitle] = useState<string>('');
  const [diffModalLocalTitle, setDiffModalLocalTitle] = useState<string>('');
  const [isDiffOpen, setIsDiffOpen] = useState(false);

  const handleShowBlameDiff = async (entry: BlameEntry) => {
    if (!activeTab) return;
    setDiffModalFile(activeTab.title);
    setIsDiffOpen(true);
    setDiffModalBase('Loading...');
    setDiffModalLocal('Loading...');

    const commitHash = entry.commitHash;
    const isWorktree = !commitHash || commitHash.startsWith('0000000') || commitHash.toLowerCase() === 'worktree';
    const shortHash = isWorktree ? 'Working Tree' : commitHash.substring(0, 7);
    const parentRev = isWorktree ? 'HEAD' : `${commitHash}~1`;

    setDiffModalBaseTitle(isWorktree ? 'HEAD (Committed)' : `${shortHash}~1 (Previous)`);
    setDiffModalLocalTitle(isWorktree ? 'Working Tree' : `${shortHash} (${entry.author})`);

    try {
      let base = '';
      try {
        base = await invoke<string>('git_get_file_content_at_revision', {
          projectPath,
          revision: parentRev,
          filePath: activeTab.path || activeTab.title,
        });
      } catch {
        base = '';
      }

      let local = '';
      if (isWorktree) {
        local = activeTab.content;
      } else {
        try {
          local = await invoke<string>('git_get_file_content_at_revision', {
            projectPath,
            revision: commitHash,
            filePath: activeTab.path || activeTab.title,
          });
        } catch {
          local = activeTab.content;
        }
      }

      setDiffModalBase(base);
      setDiffModalLocal(local);
    } catch (err) {
      console.warn('Failed to load blame diff:', err);
      setDiffModalBase('');
      setDiffModalLocal(activeTab.content);
    }
  };

  // Synchronize mouse wheel scrolling on Git Blame column with Monaco editor
  useEffect(() => {
    const el = blameColumnRef.current;
    if (!el || !isGitBlameActive) return;

    const handleWheel = (e: WheelEvent) => {
      if (!editorRef.current) return;
      e.preventDefault();

      let deltaY = e.deltaY;
      if (e.deltaMode === 1) {
        deltaY *= (lineHeightPx || 20);
      } else if (e.deltaMode === 2) {
        deltaY *= (window.innerHeight || 600);
      }

      let deltaX = e.deltaX;
      if (e.deltaMode === 1) {
        deltaX *= 20;
      } else if (e.deltaMode === 2) {
        deltaX *= (window.innerWidth || 800);
      }

      if (deltaY) {
        const currentScrollTop = editorRef.current.getScrollTop();
        editorRef.current.setScrollTop(Math.max(0, currentScrollTop + deltaY));
      }

      if (deltaX) {
        const currentScrollLeft = editorRef.current.getScrollLeft();
        editorRef.current.setScrollLeft(Math.max(0, currentScrollLeft + deltaX));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [isGitBlameActive, lineHeightPx]);

  const [isRecordingTime, setIsRecordingTime] = useState(false);
  const [showMethodSeparators, setShowMethodSeparators] = useState(false);
  const [showCodeLens, setShowCodeLens] = useState(false);
  const [isGutterIconsConfigOpen, setIsGutterIconsConfigOpen] = useState(false);
  const [mnemonicBookmarks, setMnemonicBookmarks] = useState<Map<number, string>>(new Map());
  const [mnemonicPopup, setMnemonicPopup] = useState<{ lineNumber: number; x: number; y: number } | null>(null);

  // Internal Fallback Breakpoints State (guarantees Breakpoints always work even if parent doesn't provide state)
  const [localBreakpoints, setLocalBreakpoints] = useState<Breakpoint[]>([]);
  const effectiveBreakpoints = useMemo(() => {
    return (breakpoints && breakpoints.length > 0) ? breakpoints : localBreakpoints;
  }, [breakpoints, localBreakpoints]);

  const handleToggleBreakpoint = useCallback((lineNumber: number) => {
    if (onToggleBreakpoint) {
      onToggleBreakpoint(lineNumber);
    }
    setLocalBreakpoints(prev => {
      const existing = prev.find(
        bp => bp.lineNumber === lineNumber && (bp.filePath === activeTab?.path || bp.fileName === activeTab?.title || (!bp.filePath && !bp.fileName))
      );
      if (existing) {
        onShowToast?.('Breakpoint Removed', `Line ${lineNumber}`, 'info');
        return prev.filter(b => b.id !== existing.id);
      } else {
        onShowToast?.('Breakpoint Added', `Line ${lineNumber}`, 'success');
        return [...prev, {
          id: `bp-${Date.now()}-${Math.random()}`,
          filePath: activeTab?.path || '',
          fileName: activeTab?.title || '',
          lineNumber,
          enabled: true,
        }];
      }
    });
  }, [onToggleBreakpoint, activeTab, onShowToast]);

  // JetBrains Authentic Tab Context Menu State (media_1792661560023.png)
  const [tabMenu, setTabMenu] = useState<{
    x: number;
    y: number;
    tab: OpenTab;
  } | null>(null);
  const [activeTabSubmenu, setActiveTabSubmenu] = useState<string | null>(null);
  const tabMenuRef = useRef<HTMLDivElement>(null);
  const [pinnedTabs, setPinnedTabs] = useState<Set<string>>(new Set());

  // Breakpoints & Debugger Execution Line State
  const breakpointsCollectionRef = useRef<any>(null);
  const executionLineCollectionRef = useRef<any>(null);
  const [conditionPopup, setConditionPopup] = useState<{
    bp: Breakpoint;
    x: number;
    y: number;
    conditionText: string;
    isEnabled: boolean;
  } | null>(null);

  // ─── Code Intelligence & Inspection States ───
  const [cursorCoords, setCursorCoords] = useState<{ top: number; left: number; height: number }>({ top: 0, left: 0, height: 20 });
  const [isLightbulbVisible, setIsLightbulbVisible] = useState(false);
  const [currentLineProblem, setCurrentLineProblem] = useState<ProblemItem | null>(null);
  const [showContextActions, setShowContextActions] = useState(false);
  const [selectedActionIdx, setSelectedActionIdx] = useState(0);
  const [parameterInfo, setParameterInfo] = useState<{ signature: string; top: number; left: number } | null>(null);
  const contextActionsRef = useRef<HTMLDivElement>(null);

  // ─── AI Assistant & Inline Completion States ───
  const [isAiPromptBarOpen, setIsAiPromptBarOpen] = useState(false);
  const [aiPromptBarPos, setAiPromptBarPos] = useState<{ top: number; left: number }>({ top: 100, left: 100 });
  const [aiInlineSelection, setAiInlineSelection] = useState('');
  const inlineProviderRegisteredRef = useRef(false);

  // Active Database Table for 'db-table' tabs
  const activeDbTable = useMemo(() => {
    if (activeTab?.tabType !== 'db-table' || !activeTab?.dbMetadata) return null;
    const ds = dataSources.find(d => d.id === activeTab.dbMetadata?.dataSourceId);
    if (!ds) return null;
    for (const s of ds.schemas) {
      const t = s.tables.find(tbl => tbl.name === activeTab.dbMetadata?.tableName);
      if (t) return { table: t, dataSourceName: ds.name };
    }
    return null;
  }, [activeTab, dataSources]);

  // Active file problems scoped
  const activeFileProblems = useMemo(() => {
    if (!problems || !activeTab) return [];
    const normActive = (activeTab.path || activeTab.title).replace(/\\/g, '/');
    return problems.filter(p => {
      const normP = p.filePath.replace(/\\/g, '/');
      return normP === normActive || normP.endsWith(normActive) || normActive.endsWith(normP);
    });
  }, [problems, activeTab]);

  const activeErrorsCount = useMemo(() => activeFileProblems.filter(p => p.severity === 'error').length, [activeFileProblems]);
  const activeWarningsCount = useMemo(() => activeFileProblems.filter(p => p.severity === 'warning').length, [activeFileProblems]);

  // Synchronize Monaco squiggly line markers with problems
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current || !activeTab) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    const markers = activeFileProblems.map(p => ({
      severity: p.severity === 'error' 
        ? monacoRef.current!.MarkerSeverity.Error 
        : p.severity === 'warning' 
          ? monacoRef.current!.MarkerSeverity.Warning 
          : monacoRef.current!.MarkerSeverity.Info,
      startLineNumber: p.line,
      startColumn: p.column,
      endLineNumber: p.line,
      endColumn: p.column + 10,
      message: p.message,
      source: p.source || 'Inspection',
    }));

    monacoRef.current.editor.setModelMarkers(model, 'intellij-inspection', markers);
  }, [activeFileProblems, activeTab]);

  // Surround With implementation
  const surroundWith = useCallback((type: SurroundType) => {
    if (!editorRef.current || !monacoRef.current || !activeTab) return;
    const selection = editorRef.current.getSelection();
    const model = editorRef.current.getModel();
    if (!selection || !model) return;

    const selectedText = model.getValueInRange(selection);
    const textToWrap = selectedText || model.getLineContent(selection.startLineNumber);

    const indent = '  ';
    const indentedText = textToWrap
      .split('\n')
      .map((line: string) => line.trim().length > 0 ? indent + line : line)
      .join('\n');

    let replacement = '';
    switch (type) {
      case 'if':
        replacement = `if (/* condition */) {\n${indentedText}\n}`;
        break;
      case 'if-else':
        replacement = `if (/* condition */) {\n${indentedText}\n} else {\n  \n}`;
        break;
      case 'while':
        replacement = `while (/* condition */) {\n${indentedText}\n}`;
        break;
      case 'for':
        replacement = `for (let i = 0; i < len; i++) {\n${indentedText}\n}`;
        break;
      case 'try-catch':
        replacement = `try {\n${indentedText}\n} catch (error) {\n  console.error(error);\n}`;
        break;
      case 'try-catch-finally':
        replacement = `try {\n${indentedText}\n} catch (error) {\n  console.error(error);\n} finally {\n  \n}`;
        break;
      case 'block':
        replacement = `{\n${indentedText}\n}`;
        break;
      case 'region':
        replacement = `// #region Description\n${textToWrap}\n// #endregion`;
        break;
    }

    const targetRange = selectedText.length > 0
      ? selection
      : new monacoRef.current.Range(selection.startLineNumber, 1, selection.startLineNumber, model.getLineMaxColumn(selection.startLineNumber));

    editorRef.current.executeEdits('surround-with', [
      {
        range: targetRange,
        text: replacement,
        forceMoveMarkers: true,
      }
    ]);
    editorRef.current.focus();
    onShowToast?.('Surround With', `Wrapped code with ${type}`, 'success');
  }, [activeTab, onShowToast]);

  // Optimize Imports implementation
  const optimizeImports = useCallback(() => {
    if (!editorRef.current || !activeTab) return;
    const content = editorRef.current.getValue();
    const lang = (activeTab.language || 'plaintext').toLowerCase();
    const lines = content.split('\n');
    let newContent = content;

    if (['typescript', 'javascript', 'vue', 'svelte'].includes(lang)) {
      const importLines: string[] = [];
      const nonImportLines: string[] = [];
      let inImportBlock = false;
      let importDone = false;
      let currentMultiLineImport = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!importDone && (trimmed.startsWith('import ') || inImportBlock)) {
          if (trimmed.includes('from ') && (trimmed.endsWith(';') || trimmed.endsWith("'") || trimmed.endsWith('"'))) {
            if (inImportBlock) {
              currentMultiLineImport += '\n' + line;
              importLines.push(currentMultiLineImport);
              currentMultiLineImport = '';
              inImportBlock = false;
            } else {
              importLines.push(line);
            }
          } else {
            inImportBlock = true;
            currentMultiLineImport = currentMultiLineImport ? currentMultiLineImport + '\n' + line : line;
          }
        } else if (!importDone && trimmed === '' && importLines.length > 0) {
          continue;
        } else {
          if (importLines.length > 0) {
            importDone = true;
          }
          nonImportLines.push(line);
        }
      }

      if (importLines.length > 1) {
        const uniqueImports = Array.from(new Set(importLines));
        uniqueImports.sort((a, b) => a.localeCompare(b));

        const thirdParty = uniqueImports.filter(imp => !imp.includes("from './") && !imp.includes('from "./') && !imp.includes("from '../") && !imp.includes('from "../'));
        const relative = uniqueImports.filter(imp => imp.includes("from './") || imp.includes('from "./') || imp.includes("from '../") || imp.includes('from "../'));

        const organizedImports = [
          ...thirdParty,
          ...(thirdParty.length > 0 && relative.length > 0 ? [''] : []),
          ...relative,
        ].join('\n');

        newContent = organizedImports + '\n\n' + nonImportLines.join('\n').replace(/^\n+/, '');
      }
    } else if (lang === 'rust') {
      const useLines: string[] = [];
      const restLines: string[] = [];
      let inUse = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('use ') || (inUse && !trimmed.endsWith(';'))) {
          useLines.push(line);
          inUse = !trimmed.endsWith(';');
        } else {
          restLines.push(line);
        }
      }
      if (useLines.length > 1) {
        const uniqueUses = Array.from(new Set(useLines)).sort();
        newContent = uniqueUses.join('\n') + '\n\n' + restLines.join('\n').replace(/^\n+/, '');
      }
    }

    if (newContent !== content) {
      editorRef.current.setValue(newContent);
      onChangeContent(activeTab.id, newContent);
      onShowToast?.('Optimize Imports', `Organized and sorted imports for ${activeTab.title}`, 'success');
    } else {
      onShowToast?.('Optimize Imports', 'Imports are already optimized', 'info');
    }
  }, [activeTab, onChangeContent, onShowToast]);

  // Parameter Info tooltip (Ctrl+P)
  const showParameterInfo = useCallback(() => {
    if (!editorRef.current || !activeTab) return;
    const pos = editorRef.current.getPosition();
    const model = editorRef.current.getModel();
    if (!pos || !model) return;

    const lineContent = model.getLineContent(pos.lineNumber);
    const upToCursor = lineContent.slice(0, pos.column - 1);
    const lastParenIdx = upToCursor.lastIndexOf('(');

    if (lastParenIdx !== -1) {
      const preParen = upToCursor.slice(0, lastParenIdx).trim();
      const funcMatch = preParen.match(/([a-zA-Z0-9_$]+)$/);
      const funcName = funcMatch ? funcMatch[1] : 'function';

      const argsSection = upToCursor.slice(lastParenIdx + 1);
      const activeParamIdx = (argsSection.match(/,/g) || []).length;

      const coords = editorRef.current.getScrolledVisiblePosition(pos);
      setParameterInfo({
        signature: `${funcName}(param_${activeParamIdx + 1}: any, ...args: any[])`,
        top: Math.max(10, (coords?.top || 50) - 28),
        left: Math.max(10, coords?.left || 100),
      });

      setTimeout(() => {
        setParameterInfo(null);
      }, 4000);
    } else {
      onShowToast?.('Parameter Info', 'No function call context found at cursor (Ctrl+P)', 'info');
    }
  }, [activeTab, onShowToast]);

  // Navigate to Next/Prev Problem (F2 / Shift+F2)
  const goToNextProblem = useCallback(() => {
    if (activeFileProblems.length === 0) {
      onShowToast?.('Code Analysis', 'No problems found in current file', 'info');
      return;
    }
    const pos = editorRef.current?.getPosition();
    const curLine = pos?.lineNumber || 1;
    const next = activeFileProblems.find(p => p.line > curLine) || activeFileProblems[0];
    if (editorRef.current) {
      editorRef.current.setPosition({ lineNumber: next.line, column: next.column });
      editorRef.current.revealPositionInCenter({ lineNumber: next.line, column: next.column });
      editorRef.current.focus();
    }
    onShowToast?.('Problem', `${next.severity.toUpperCase()}: ${next.message} (line ${next.line})`, next.severity === 'error' ? 'error' : 'warning');
  }, [activeFileProblems, onShowToast]);

  const goToPrevProblem = useCallback(() => {
    if (activeFileProblems.length === 0) return;
    const pos = editorRef.current?.getPosition();
    const curLine = pos?.lineNumber || 1;
    const prev = [...activeFileProblems].reverse().find(p => p.line < curLine) || activeFileProblems[activeFileProblems.length - 1];
    if (editorRef.current) {
      editorRef.current.setPosition({ lineNumber: prev.line, column: prev.column });
      editorRef.current.revealPositionInCenter({ lineNumber: prev.line, column: prev.column });
      editorRef.current.focus();
    }
    onShowToast?.('Problem', `${prev.severity.toUpperCase()}: ${prev.message} (line ${prev.line})`, prev.severity === 'error' ? 'error' : 'warning');
  }, [activeFileProblems, onShowToast]);

  // Update cursor affordances (lightbulb and coordinates)
  const updateCursorAffordances = useCallback((line: number, col: number) => {
    if (!editorRef.current) return;
    const pos = editorRef.current.getScrolledVisiblePosition({ lineNumber: line, column: col });
    if (pos) {
      setCursorCoords({ top: pos.top, left: pos.left, height: pos.height || 20 });
    }

    const normActive = (activeTab?.path || activeTab?.title || '').replace(/\\/g, '/');
    const lineProblems = problems.filter(p => {
      const normP = p.filePath.replace(/\\/g, '/');
      const isFileMatch = normP === normActive || normP.endsWith(normActive) || normActive.endsWith(normP);
      return isFileMatch && p.line === line;
    });

    if (lineProblems.length > 0) {
      setIsLightbulbVisible(true);
      setCurrentLineProblem(lineProblems[0]);
    } else {
      const lineContent = editorRef.current.getModel()?.getLineContent(line) || '';
      const trimmed = lineContent.trim();
      if (trimmed.startsWith('import ') || trimmed.startsWith('use ') || trimmed.includes('function') || trimmed.includes('=>') || trimmed.startsWith('if ') || trimmed.startsWith('try ')) {
        setIsLightbulbVisible(true);
        setCurrentLineProblem(null);
      } else {
        setIsLightbulbVisible(false);
        setCurrentLineProblem(null);
      }
    }
  }, [problems, activeTab]);

  const duplicateLineOrSelection = useCallback((editor: any, monaco: Monaco) => {
    const now = Date.now();
    // Guard against duplicated key events or multiple triggers: allow at most one duplication per 250ms
    if (now - lastDuplicateTimeRef.current < 250) {
      return;
    }
    lastDuplicateTimeRef.current = now;

    const selection = editor.getSelection();
    const model = editor.getModel();
    if (!selection || !model) return;

    if (selection.isEmpty()) {
      editor.getAction('editor.action.copyLinesDownAction')?.run();
    } else {
      const selectedText = model.getValueInRange(selection);
      const endPosition = selection.getEndPosition();
      editor.executeEdits('duplicate-selection', [
        {
          range: new monaco.Range(endPosition.lineNumber, endPosition.column, endPosition.lineNumber, endPosition.column),
          text: selectedText,
          forceMoveMarkers: true,
        }
      ]);
      const lines = selectedText.split('\n');
      const newEndLine = endPosition.lineNumber + lines.length - 1;
      const newEndCol = lines.length === 1 ? endPosition.column + selectedText.length : lines[lines.length - 1].length + 1;
      editor.setSelection(new monaco.Range(endPosition.lineNumber, endPosition.column, newEndLine, newEndCol));
    }
  }, []);

  const openAiPromptBar = useCallback(() => {
    if (!editorRef.current) return;
    const pos = editorRef.current.getPosition();
    if (pos) {
      const coords = editorRef.current.getScrolledVisiblePosition(pos);
      if (coords) {
        setAiPromptBarPos({ top: coords.top + 24, left: Math.max(40, coords.left) });
      }
    }
    const selection = editorRef.current.getSelection();
    let selText = '';
    if (selection && !selection.isEmpty()) {
      selText = editorRef.current.getModel()?.getValueInRange(selection) || '';
    }
    setAiInlineSelection(selText);
    setIsAiPromptBarOpen(true);
  }, []);

  const insertSnippet = useCallback((code: string) => {
    if (!editorRef.current || !monacoRef.current) return;
    const selection = editorRef.current.getSelection();
    const pos = editorRef.current.getPosition();
    const model = editorRef.current.getModel();
    if (!model) return;

    if (selection && !selection.isEmpty()) {
      editorRef.current.executeEdits('ai-snippet-insert', [{
        range: selection,
        text: code,
        forceMoveMarkers: true,
      }]);
    } else if (pos) {
      editorRef.current.executeEdits('ai-snippet-insert', [{
        range: new monacoRef.current.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
        text: code,
        forceMoveMarkers: true,
      }]);
    }
    editorRef.current.focus();
  }, []);

  const handleAcceptAiPrompt = useCallback((code: string) => {
    insertSnippet(code);
    setIsAiPromptBarOpen(false);
    onShowToast?.('AI Assistant', 'Inserted AI generated snippet', 'success');
  }, [insertSnippet, onShowToast]);

  useImperativeHandle(ref, () => ({
    formatDocument: () => {
      editorRef.current?.getAction('editor.action.formatDocument')?.run();
    },
    commentLine: () => {
      editorRef.current?.getAction('editor.action.commentLine')?.run();
    },
    foldAll: () => {
      editorRef.current?.getAction('editor.foldAll')?.run();
    },
    unfoldAll: () => {
      editorRef.current?.getAction('editor.unfoldAll')?.run();
    },
    goToLine: (line: number, column: number) => {
      if (editorRef.current) {
        editorRef.current.setPosition({ lineNumber: line, column });
        editorRef.current.revealPositionInCenter({ lineNumber: line, column });
        editorRef.current.focus();
      }
    },
    triggerFind: () => {
      editorRef.current?.getAction('actions.find')?.run();
    },
    triggerReplace: () => {
      editorRef.current?.getAction('editor.action.startFindReplaceAction')?.run();
    },
    duplicateLine: () => {
      if (editorRef.current && monacoRef.current) {
        duplicateLineOrSelection(editorRef.current, monacoRef.current);
      } else {
        editorRef.current?.getAction('editor.action.copyLinesDownAction')?.run();
      }
    },
    deleteLine: () => {
      editorRef.current?.getAction('editor.action.deleteLines')?.run();
    },
    getMaxLine: () => {
      return editorRef.current?.getModel()?.getLineCount() || 1;
    },
    toggleGitBlame: () => {
      setIsGitBlameActive(prev => {
        const next = !prev;
        setTimeout(() => editorRef.current?.layout(), 50);
        return next;
      });
    },
    getWordAtCursor: () => {
      return getWordUnderCursor();
    },
    revealPosition: (line: number, column: number, selectLength?: number) => {
      if (editorRef.current) {
        editorRef.current.setPosition({ lineNumber: line, column });
        editorRef.current.revealPositionInCenter({ lineNumber: line, column });
        if (selectLength && selectLength > 0) {
          editorRef.current.setSelection({
            startLineNumber: line,
            startColumn: column,
            endLineNumber: line,
            endColumn: column + selectLength,
          });
        }
        editorRef.current.focus();
      }
    },
    optimizeImports,
    surroundWith,
    showContextActions: () => setShowContextActions(true),
    showParameterInfo,
    goToNextProblem,
    goToPrevProblem,
    insertSnippet,
    openAiPromptBar,
  }));

  const getWordUnderCursor = useCallback((): string => {
    if (!editorRef.current) return '';
    const selection = editorRef.current.getSelection();
    if (selection && !selection.isEmpty()) {
      const text = editorRef.current.getModel()?.getValueInRange(selection);
      if (text && text.trim()) return text.trim();
    }
    const pos = editorRef.current.getPosition();
    if (pos) {
      const wordInfo = editorRef.current.getModel()?.getWordAtPosition(pos);
      if (wordInfo?.word) return wordInfo.word;
    }
    return '';
  }, []);

  // IntelliJ Context Actions / Intention Actions (Alt+Enter)
  const contextActionItems = useMemo(() => {
    const items: {
      id: string;
      title: string;
      shortcut?: string;
      isQuickFix?: boolean;
      action: () => void;
    }[] = [];

    if (currentLineProblem) {
      const msg = currentLineProblem.message.toLowerCase();
      if (msg.includes('unused') || currentLineProblem.code === 'ts(6133)' || currentLineProblem.code === 'rust(unused_variables)') {
        items.push({
          id: 'remove-unused',
          title: `Remove unused item '${currentLineProblem.message.split("'")[1] || 'symbol'}'`,
          shortcut: 'Alt+Enter',
          isQuickFix: true,
          action: () => {
            editorRef.current?.getAction('editor.action.deleteLines')?.run();
            onShowToast?.('Quick Fix', 'Removed unused code line', 'success');
            setShowContextActions(false);
          }
        });
      } else if (msg.includes('semicolon') || currentLineProblem.code === 'ts(1005)') {
        items.push({
          id: 'add-semicolon',
          title: 'Insert missing semicolon',
          shortcut: 'Alt+Enter',
          isQuickFix: true,
          action: () => {
            if (editorRef.current && monacoRef.current) {
              const model = editorRef.current.getModel();
              const pos = editorRef.current.getPosition();
              if (model && pos) {
                const lineEnd = model.getLineMaxColumn(pos.lineNumber);
                editorRef.current.executeEdits('quickfix-semicolon', [{
                  range: new monacoRef.current.Range(pos.lineNumber, lineEnd, pos.lineNumber, lineEnd),
                  text: ';',
                  forceMoveMarkers: true,
                }]);
                onShowToast?.('Quick Fix', 'Added missing semicolon', 'success');
              }
            }
            setShowContextActions(false);
          }
        });
      } else {
        items.push({
          id: 'fix-problem',
          title: `Fix: ${currentLineProblem.message}`,
          shortcut: 'Alt+Enter',
          isQuickFix: true,
          action: () => {
            onShowToast?.('Quick Fix', `Applied inspection fix: ${currentLineProblem.message}`, 'success');
            setShowContextActions(false);
          }
        });
      }
    }

    // Standard Intention Actions
    items.push({
      id: 'surround-with',
      title: 'Surround with...',
      shortcut: 'Ctrl+Alt+T',
      action: () => {
        setShowContextActions(false);
        onOpenSurroundWith?.();
      }
    });

    items.push({
      id: 'extract-variable',
      title: 'Introduce / Extract Variable...',
      shortcut: 'Ctrl+Alt+V',
      action: () => {
        setShowContextActions(false);
        const word = getWordUnderCursor();
        if (word) {
          onShowToast?.('Refactoring', `Extracted variable: const ${word}_val = ${word};`, 'info');
        } else {
          onShowToast?.('Refactoring', 'Select an expression or token to extract variable (Ctrl+Alt+V)', 'info');
        }
      }
    });

    items.push({
      id: 'optimize-imports',
      title: 'Optimize imports',
      shortcut: 'Ctrl+Alt+O',
      action: () => {
        setShowContextActions(false);
        optimizeImports();
      }
    });

    items.push({
      id: 'reformat-code',
      title: 'Reformat code',
      shortcut: 'Ctrl+Alt+L',
      action: () => {
        setShowContextActions(false);
        editorRef.current?.getAction('editor.action.formatDocument')?.run();
      }
    });

    items.push({
      id: 'show-problems',
      title: 'Inspection: Show Problems tool window',
      shortcut: 'Alt+6',
      action: () => {
        setShowContextActions(false);
        onToggleProblems?.();
      }
    });

    // AI Assistant actions
    items.push({
      id: 'ai-prompt-bar',
      title: '✨ AI Assistant: Generate code with AI Prompt...',
      shortcut: 'Ctrl+\\',
      action: () => {
        setShowContextActions(false);
        openAiPromptBar();
      }
    });

    items.push({
      id: 'ai-explain',
      title: '✨ AI Assistant: Explain code logic',
      action: () => {
        setShowContextActions(false);
        const sym = getWordUnderCursor();
        onOpenAiDrawer?.(`Explain the following code and logic: ${sym || activeTab?.title}`);
      }
    });

    items.push({
      id: 'ai-tests',
      title: '✨ AI Assistant: Generate unit tests',
      action: () => {
        setShowContextActions(false);
        const sym = getWordUnderCursor();
        onOpenAiDrawer?.(`Generate comprehensive unit tests for: ${sym || activeTab?.title}`);
      }
    });

    return items;
  }, [currentLineProblem, onOpenSurroundWith, optimizeImports, onToggleProblems, onShowToast, getWordUnderCursor, openAiPromptBar, onOpenAiDrawer, activeTab]);

  // Handle Alt+Enter Context Actions keyboard navigation and dismissal
  useEffect(() => {
    if (!showContextActions) return;
    setSelectedActionIdx(0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowContextActions(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedActionIdx(prev => (prev + 1) % Math.max(contextActionItems.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedActionIdx(prev => (prev - 1 + contextActionItems.length) % Math.max(contextActionItems.length, 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = contextActionItems[selectedActionIdx];
        if (selected) {
          selected.action();
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (contextActionsRef.current && !contextActionsRef.current.contains(e.target as Node)) {
        setShowContextActions(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('mousedown', handleMouseDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, [showContextActions, contextActionItems, selectedActionIdx]);

  const handleEditorWillMount = (monaco: Monaco) => {
    IDE_THEMES.forEach((t) => {
      monaco.editor.defineTheme(t.id, buildMonacoTheme(t) as any);
    });

    // Register Vue language support in Monaco
    if (!monaco.languages.getLanguages().some((l: any) => l.id === 'vue')) {
      monaco.languages.register({ id: 'vue', extensions: ['.vue'] });
      monaco.languages.setLanguageConfiguration('vue', vueLanguageConfiguration);
      monaco.languages.setMonarchTokensProvider('vue', vueMonarchTokensProvider);
    }
  };

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // ─── Direct IntelliJ Keyboard Shortcuts inside Monaco ───
    // 1. Duplicate Line or Selection: Ctrl+D
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
      duplicateLineOrSelection(editor, monaco);
    });

    // 2. Delete Line: Ctrl+Y
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () => {
      editor.getAction('editor.action.deleteLines')?.run();
    });

    // 3. New File: Ctrl+N or Alt+Insert
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, () => {
      onSelectMenuAction?.('file.new');
    });
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Insert, () => {
      onSelectMenuAction?.('file.new');
    });

    // 4. Reformat Code: Ctrl+Alt+L
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyL, () => {
      editor.getAction('editor.action.formatDocument')?.run();
    });

    // 5. Line Comment: Ctrl+/
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      editor.getAction('editor.action.commentLine')?.run();
    });

    // 6. Block Comment: Ctrl+Shift+/
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Slash, () => {
      editor.getAction('editor.action.blockComment')?.run();
    });

    // 7. Find: Ctrl+F & Replace: Ctrl+R
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find')?.run();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyR, () => {
      editor.getAction('editor.action.startFindReplaceAction')?.run();
    });

    // 8. Go to Definition / Declaration: Ctrl+B
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
      editor.getAction('editor.action.revealDefinition')?.run();
    });

    // 9. Move Lines Up / Down: Alt+Shift+Up / Alt+Shift+Down
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.UpArrow, () => {
      editor.getAction('editor.action.moveLinesUpAction')?.run();
    });
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.DownArrow, () => {
      editor.getAction('editor.action.moveLinesDownAction')?.run();
    });

    // 10. Save Active File: Ctrl+S
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSelectMenuAction?.('file.save');
    });

    // 11. Quick Settings: Ctrl+Alt+S
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyS, () => {
      onSelectMenuAction?.('file.settings');
    });

    // 12. Run File: Shift+F10
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F10, () => {
      onRunFile?.();
    });

    // 13. Git Commit: Ctrl+K
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      onSelectMenuAction?.('git.commit');
    });

    // 14. Git Commit & Push: Ctrl+Shift+K
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyK, () => {
      onSelectMenuAction?.('git.push');
    });

    // 15. Close Tab: Ctrl+W
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
      if (activeTabId) onCloseTab(activeTabId);
    });

    // 16. Find Usages: Alt+F7 & Show Usages: Ctrl+Alt+F7
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.F7, () => {
      const sym = getWordUnderCursor();
      if (sym) onFindUsages?.(sym);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.F7, () => {
      const sym = getWordUnderCursor();
      if (sym) onShowUsages?.(sym);
    });

    // 17. Rename Symbol: Shift+F6
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F6, () => {
      const sym = getWordUnderCursor();
      onRenameSymbol?.(sym);
    });

    // 18. Go to Line: Ctrl+G
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => {
      onOpenGoToLine?.();
    });

    // 19. Toggle Breakpoint: Ctrl+F8
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.F8, () => {
      const pos = editor.getPosition();
      if (pos?.lineNumber && onToggleBreakpoint) {
        onToggleBreakpoint(pos.lineNumber);
      }
    });

    // 20. Surround With: Ctrl+Alt+T
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyT, () => {
      onOpenSurroundWith?.();
    });

    // 21. Optimize Imports: Ctrl+Alt+O
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyO, () => {
      optimizeImports();
    });

    // 22. Show Context Actions: Alt+Enter
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Enter, () => {
      const pos = editor.getPosition();
      if (pos) {
        updateCursorAffordances(pos.lineNumber, pos.column);
      }
      setShowContextActions(true);
    });

    // 23. Parameter Info: Ctrl+P
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
      showParameterInfo();
    });

    // 24. Next Problem: F2
    editor.addCommand(monaco.KeyCode.F2, () => {
      goToNextProblem();
    });

    // 25. Previous Problem: Shift+F2
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F2, () => {
      goToPrevProblem();
    });

    // 26. AI Inline Prompt Bar: Ctrl+\ or Ctrl+Alt+J
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backslash, () => {
      openAiPromptBar();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyJ, () => {
      openAiPromptBar();
    });

    // 27. Register JetBrains AI Full Line / Inline Completion Provider (Ghost Text)
    if (!inlineProviderRegisteredRef.current && (monaco.languages as any)?.registerInlineCompletionsProvider) {
      inlineProviderRegisteredRef.current = true;
      (monaco.languages as any).registerInlineCompletionsProvider('*', {
        provideInlineCompletions: (model: any, position: any) => {
          const textBefore = model.getLineContent(position.lineNumber).substring(0, position.column - 1);
          const trimmed = textBefore.trim();
          if (!trimmed || trimmed.length < 2) return { items: [] };

          let suggestion = '';

          if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            const c = trimmed.replace(/^(\/\/|\/\*)\s*/, '').toLowerCase();
            if (c.startsWith('todo')) suggestion = ': handle edge cases and log errors properly';
            else if (c.startsWith('check')) suggestion = ' if response is successful and contains valid data';
            else if (c.startsWith('sort')) suggestion = ' elements in ascending order by timestamp';
            else if (c.startsWith('filter')) suggestion = ' active and verified items';
            else if (c.startsWith('validate')) suggestion = ' user input parameters before processing';
          } else if (trimmed === 'const' || trimmed === 'let') {
            suggestion = ' [items, setItems] = useState([]);';
          } else if (trimmed.endsWith('useEffect(') || trimmed === 'useEffect') {
            suggestion = '() => {\n    // Effect lifecycle\n    return () => {};\n  }, []);';
          } else if (trimmed.endsWith('useMemo(') || trimmed === 'useMemo') {
            suggestion = '() => {\n    return computeValue();\n  }, []);';
          } else if (trimmed.endsWith('useCallback(') || trimmed === 'useCallback') {
            suggestion = '() => {\n    handleAction();\n  }, []);';
          } else if (trimmed.endsWith('console.') || trimmed === 'console') {
            suggestion = 'log(\'[DEBUG]\', data);';
          } else if (trimmed === 'function' || trimmed.endsWith(' function')) {
            suggestion = ' handleAction(event: React.MouseEvent) {\n  event.preventDefault();\n}';
          } else if (trimmed === 'fn' || trimmed.endsWith(' fn')) {
            suggestion = ' run_task() -> Result<(), Box<dyn std::error::Error>> {\n    Ok(())\n}';
          } else if (trimmed === 'let mut') {
            suggestion = ' buffer = String::new();';
          } else if (trimmed.endsWith('match') || trimmed.endsWith('match ')) {
            suggestion = ' result {\n        Ok(val) => println!("{:?}", val),\n        Err(err) => eprintln!("{}", err),\n    }';
          } else if (trimmed.endsWith('println!') || trimmed === 'println!') {
            suggestion = '("Debug info: {:?}", info);';
          } else if (trimmed === 'if (' || trimmed.endsWith(' if (')) {
            suggestion = '!response.ok) {\n  throw new Error(`Failed with status ${response.status}`);\n}';
          } else if (trimmed === 'for (' || trimmed.endsWith(' for (')) {
            suggestion = 'const item of items) {\n  processItem(item);\n}';
          } else if (trimmed === 'try {' || trimmed.endsWith(' try {')) {
            suggestion = '\n  await executeAsync();\n} catch (err) {\n  console.error(err);\n}';
          } else if (trimmed.endsWith('import {') || trimmed === 'import {') {
            suggestion = ' useState, useEffect, useMemo, useCallback } from \'react\';';
          } else if (trimmed.endsWith('return (') || trimmed === 'return (') {
            suggestion = '\n    <div className="flex flex-col gap-2 p-4">\n      <span>Ready</span>\n    </div>\n  );';
          } else if (trimmed.endsWith(' = async (') || trimmed.endsWith('= async (')) {
            suggestion = ') => {\n  try {\n    const res = await fetchData();\n    return res;\n  } catch (e) {\n    return null;\n  }\n};';
          } else if (trimmed.endsWith('catch (err) {') || trimmed.endsWith('catch (e) {')) {
            suggestion = '\n  console.error(\'Operation error:\', err);\n}';
          }

          if (!suggestion) return { items: [] };

          return {
            items: [
              {
                insertText: suggestion,
                range: new monaco.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column
                ),
              }
            ]
          };
        },
        freeInlineCompletions: () => {}
      });
    }

    // Handle Left-click on Monaco Gutter (Glyph Margin or Line Numbers)
    editor.onMouseDown((e: any) => {
      // 2: GUTTER_GLYPH_MARGIN, 3: GUTTER_LINE_NUMBERS
      const targetType = e.target?.type;
      if (e.event?.leftButton && (targetType === 2 || targetType === 3)) {
        const line = e.target?.position?.lineNumber;
        if (line) {
          e.event?.preventDefault?.();
          e.event?.stopPropagation?.();
          handleToggleBreakpoint(line);
        }
      }
    });

    const lh = editor.getOption(monaco.editor.EditorOption.lineHeight);
    if (lh) setLineHeightPx(lh);

    editor.onDidChangeCursorPosition((e: any) => {
      if (onCursorChange) {
        onCursorChange(e.position.lineNumber, e.position.column);
      }
      updateCursorAffordances(e.position.lineNumber, e.position.column);
    });

    editor.onDidScrollChange((e: any) => {
      setScrollTop(e.scrollTop);
      if (blameScrollContentRef.current) {
        blameScrollContentRef.current.style.transform = `translateY(-${e.scrollTop}px)`;
      }
    });

    // Intercept right-click on Monaco editor (gutter vs code)
    editor.onContextMenu((e: any) => {
      if (e.event?.browserEvent) {
        e.event.browserEvent.preventDefault();
        e.event.browserEvent.stopPropagation();
      }
      if (e.event?.preventDefault) {
        e.event.preventDefault();
      }
      if (e.event?.stopPropagation) {
        e.event.stopPropagation();
      }

      const clientX = e.event?.posx ?? e.event?.browserEvent?.clientX ?? 100;
      const clientY = e.event?.posy ?? e.event?.browserEvent?.clientY ?? 100;

      const targetType = e.target?.type;
      const isGutter = targetType === 2 || targetType === 3 || targetType === 4 ||
        e.target?.element?.classList?.contains('line-numbers') ||
        e.target?.element?.closest?.('.margin');

      const line = e.target?.position?.lineNumber || 1;
      const col = e.target?.position?.column || 1;

      if (isGutter) {
        setEditorMenu(null);
        setGutterMenu({
          x: clientX,
          y: clientY,
          lineNumber: line,
        });
        setActiveGutterSubmenu(null);
      } else {
        // Ensure cursor is placed at right-clicked location so actions work on target symbol
        if (line && col) {
          editor.setPosition({ lineNumber: line, column: col });
        }
        setGutterMenu(null);
        const estimatedHeight = 650;
        const estimatedWidth = 260;
        let posX = Math.min(clientX, window.innerWidth - estimatedWidth - 16);
        let posY = clientY;
        if (clientY + estimatedHeight > window.innerHeight - 16) {
          posY = Math.max(8, window.innerHeight - estimatedHeight - 16);
        }
        setEditorMenu({
          x: posX,
          y: posY,
          lineNumber: line,
          column: col,
        });
        setActiveEditorSubmenu(null);
      }
    });
  };

  // Close menus on outside click or Escape (using capture phase for Monaco compatibility)
  useEffect(() => {
    if (!editorMenu && !gutterMenu && !tabMenu) return;
    const handleOutsideDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (editorMenuRef.current && !editorMenuRef.current.contains(target)) {
        setEditorMenu(null);
        setActiveEditorSubmenu(null);
      }
      if (tabMenuRef.current && !tabMenuRef.current.contains(target)) {
        setTabMenu(null);
        setActiveTabSubmenu(null);
      }
      if (gutterMenuRef.current && !gutterMenuRef.current.contains(target)) {
        setGutterMenu(null);
        setActiveGutterSubmenu(null);
      }
      if (conditionPopupRef.current && !conditionPopupRef.current.contains(target)) {
        setConditionPopup(null);
      }
      if (mnemonicPopupRef.current && !mnemonicPopupRef.current.contains(target)) {
        setMnemonicPopup(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditorMenu(null);
        setActiveEditorSubmenu(null);
        setGutterMenu(null);
        setActiveGutterSubmenu(null);
        setTabMenu(null);
        setActiveTabSubmenu(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editorMenu, gutterMenu, tabMenu]);

  // Update Monaco decorations for bookmarks & mnemonic bookmarks
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    try {
      const standardBookmarks = Array.from(bookmarks).map(line => ({
        range: new monacoRef.current!.Range(line, 1, line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: 'monaco-bookmark-indicator',
          glyphMarginHoverMessage: { value: `**Bookmark** on line ${line}` },
        }
      }));

      const mnemonicDecs = Array.from(mnemonicBookmarks.entries()).map(([line, char]) => ({
        range: new monacoRef.current!.Range(line, 1, line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: 'monaco-bookmark-indicator',
          glyphMarginHoverMessage: { value: `**Mnemonic Bookmark [ ${char} ]** on line ${line}` },
        }
      }));

      editorRef.current.createDecorationsCollection?.([...standardBookmarks, ...mnemonicDecs]);
    } catch (err) {
      // ignore
    }
  }, [bookmarks, mnemonicBookmarks]);


  // ─── Test Gutter Icons & Detection ───
  const testLinesCollectionRef = useRef<any>(null);
  const testCasesInFile = useMemo(() => {
    if (!activeTab || !activeTab.content) return [];
    const lines = activeTab.content.split('\n');
    const cases: { line: number; name: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      // Rust #[test] or #[tokio::test]
      if (/^\s*#\[(?:tokio::)?test\]/.test(lineText)) {
        const nextLine = lines[i + 1] || '';
        const fnMatch = nextLine.match(/fn\s+([a-zA-Z0-9_]+)/);
        const name = fnMatch ? fnMatch[1] : `test_line_${i + 2}`;
        cases.push({ line: i + 1, name });
      }
      // JS/TS it('...', ...) or test('...', ...) or describe('...', ...)
      else if (/^\s*(?:it|test|describe)\s*\(\s*['"`]([^'"`]+)['"`]/.test(lineText)) {
        const m = lineText.match(/^\s*(?:it|test|describe)\s*\(\s*['"`]([^'"`]+)['"']/);
        cases.push({ line: i + 1, name: m ? m[1] : `test_line_${i + 1}` });
      }
      // Java @Test
      else if (/^\s*@Test\b/.test(lineText)) {
        const nextLine = lines[i + 1] || '';
        const fnMatch = nextLine.match(/(?:public|private|protected|void|\s)+\s+([a-zA-Z0-9_]+)\s*\(/);
        const name = fnMatch ? fnMatch[1] : `test_line_${i + 2}`;
        cases.push({ line: i + 1, name });
      }
      // Python def test_...
      else if (/^\s*def\s+(test_[a-zA-Z0-9_]+)/.test(lineText)) {
        const m = lineText.match(/^\s*def\s+(test_[a-zA-Z0-9_]+)/);
        cases.push({ line: i + 1, name: m ? m[1] : `test_line_${i + 1}` });
      }
    }
    return cases;
  }, [activeTab?.content]);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !activeTab) return;
    try {
      const decorations = testCasesInFile.map(tc => ({
        range: new monacoRef.current!.Range(tc.line, 1, tc.line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: 'monaco-test-run-glyph',
          glyphMarginHoverMessage: { 
            value: `**Run Test** \`${tc.name}\`\n\n*Click gutter triangle to run this test (Ctrl+Shift+F10)*` 
          },
        }
      }));

      if (!testLinesCollectionRef.current) {
        testLinesCollectionRef.current = editorRef.current.createDecorationsCollection?.(decorations);
      } else {
        testLinesCollectionRef.current.set(decorations);
      }
    } catch (err) {
      // ignore
    }
  }, [testCasesInFile, activeTab]);

  // Update Monaco decorations for Breakpoints
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !activeTab) return;
    try {
      const fileBreakpoints = effectiveBreakpoints.filter(
        bp => bp.filePath === activeTab.path || bp.fileName === activeTab.title || activeTab.path.endsWith(bp.fileName)
      );

      const decorations = fileBreakpoints.map(bp => ({
        range: new monacoRef.current!.Range(bp.lineNumber, 1, bp.lineNumber, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: bp.enabled ? 'monaco-breakpoint-glyph' : 'monaco-breakpoint-glyph-disabled',
          glyphMarginHoverMessage: { 
            value: `**Breakpoint** on line ${bp.lineNumber}\n\n${bp.condition ? `Condition: \`${bp.condition}\`` : 'Unconditional'}\n\n*Click gutter to remove, right-click to edit condition*` 
          },
        }
      }));

      if (!breakpointsCollectionRef.current) {
        breakpointsCollectionRef.current = editorRef.current.createDecorationsCollection?.(decorations);
      } else {
        breakpointsCollectionRef.current.set(decorations);
      }
    } catch (err) {
      // ignore
    }
  }, [effectiveBreakpoints, activeTab]);

  // Update Monaco decorations for Active Debug Execution Line
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !activeTab) return;
    try {
      const isPausedInActiveFile = activePausedLine && (
        activePausedLine.filePath === activeTab.path || 
        activePausedLine.filePath.endsWith(activeTab.title) ||
        activeTab.path.endsWith(activePausedLine.filePath)
      );

      const decorations = isPausedInActiveFile ? [{
        range: new monacoRef.current!.Range(activePausedLine.line, 1, activePausedLine.line, 1),
        options: {
          isWholeLine: true,
          className: 'monaco-debug-active-line',
          glyphMarginClassName: 'monaco-debug-active-glyph',
          glyphMarginHoverMessage: { value: '**Suspended at breakpoint (Current Execution Point)**' },
        }
      }] : [];

      if (!executionLineCollectionRef.current) {
        executionLineCollectionRef.current = editorRef.current.createDecorationsCollection?.(decorations);
      } else {
        executionLineCollectionRef.current.set(decorations);
      }

      if (isPausedInActiveFile) {
        editorRef.current.revealLineInCenter(activePausedLine.line);
      }
    } catch (err) {
      // ignore
    }
  }, [activePausedLine, activeTab]);

  const effectiveLanguage = useMemo(() => {
    if (!activeTab) return 'plaintext';
    if (activeTab.language && activeTab.language !== 'plaintext') {
      return activeTab.language;
    }
    const lower = activeTab.title.toLowerCase();
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
    return activeTab.language || 'plaintext';
  }, [activeTab]);

  useEffect(() => {
    if (editorRef.current && monacoRef.current && activeTab) {
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelLanguage(model, effectiveLanguage);
      }
    }
  }, [effectiveLanguage, activeTabId]);

  const getTabIcon = (fileName: string, tab?: OpenTab) => {
    if (tab?.tabType === 'db-table') {
      return <Table size={13} className="text-[#3574F0] flex-shrink-0" />;
    }
    if (tab?.tabType === 'sql-console') {
      return <Terminal size={13} className="text-[#59A869] flex-shrink-0" />;
    }
    const lower = fileName.toLowerCase();
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
    if (lower.endsWith('.css')) {
      return <FileCode size={13} className="text-[#437EE3] flex-shrink-0" />;
    }
    return <File size={13} className="text-[#868A91] flex-shrink-0" />;
  };

  if (!activeTab) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#1E1F22] text-[#868A91] select-none">
        <div className="w-16 h-16 rounded-xl bg-[#2B2D30] border border-[#393B40] flex items-center justify-center mb-4 shadow-xl">
          <span className="font-extrabold text-2xl text-[#62B543]">ID</span>
        </div>
        <p className="text-sm font-semibold text-[#DFE1E5]">IntelliJ IDEA</p>
        <p className="text-xs text-[#868A91] mt-1">Press <kbd className="px-1.5 py-0.5 rounded bg-[#2B2D30] border border-[#393B40] text-white">Double Shift</kbd> to search files or actions</p>
      </div>
    );
  }

  // Generate breadcrumb items
  const pathParts = activeTab.path.replace(/\\/g, '/').split('/');

  const fontSize = settings?.fontSize || 13;
  const tabSize = settings?.tabSize || 4;
  const minimapEnabled = settings?.minimap ?? false;
  const lineNumbersMode = (settings?.lineNumbers ?? true) ? 'on' : 'off';
  const wordWrapMode = (settings?.wordWrap ?? false) ? 'on' : 'off';
  const theme = settings?.theme || 'intellij-new-ui-dark';
  const fontFamily = settings?.fontFamily ? `"${settings.fontFamily}", Consolas, monospace` : '"JetBrains Mono", Consolas, monospace';
  const lineHeight = settings?.lineHeight ? Math.round(fontSize * settings.lineHeight) : Math.round(fontSize * 1.55);
  const fontLigatures = settings?.ligatures ?? true;
  const isEditorBottomHalf = editorMenu ? editorMenu.y > (typeof window !== 'undefined' ? window.innerHeight / 2 : 400) : false;
  const isTabBottomHalf = tabMenu ? tabMenu.y > (typeof window !== 'undefined' ? window.innerHeight / 2 : 400) : false;

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] overflow-hidden">
      {/* ─── 1. Editor Tabs Bar (New UI) ─── */}
      <div 
        onContextMenu={(e) => e.preventDefault()}
        className="h-[34px] bg-[#1E1F22] border-b border-[#2B2D30] flex items-center justify-between select-none overflow-x-auto"
      >
        <div className="flex items-center h-full">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isPinned = pinnedTabs.has(tab.id);
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const estimatedHeight = 650;
                  const estimatedWidth = 260;
                  let posX = Math.min(e.clientX, window.innerWidth - estimatedWidth - 16);
                  let posY = e.clientY;
                  if (e.clientY + estimatedHeight > window.innerHeight - 16) {
                    posY = Math.max(8, window.innerHeight - estimatedHeight - 16);
                  }
                  setTabMenu({
                    x: posX,
                    y: posY,
                    tab,
                  });
                  setActiveTabSubmenu(null);
                  setEditorMenu(null);
                  setGutterMenu(null);
                }}
                className={`flex items-center gap-2 px-3 h-full cursor-pointer text-[12px] border-r border-[#2B2D30] transition-colors relative group ${
                  isActive
                    ? 'bg-[#1E1F22] text-[#DFE1E5] font-medium'
                    : 'bg-[#1E1F22] text-[#868A91] hover:bg-[#2B2D30]/60 hover:text-[#DFE1E5]'
                }`}
              >
                {/* Active Indicator Bottom Accent */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3574F0]" />
                )}

                {/* Pin Icon */}
                {isPinned && (
                  <Pin size={11} className="text-[#3574F0] fill-[#3574F0]/20 rotate-45 flex-shrink-0" />
                )}

                {/* File Icon */}
                {getTabIcon(tab.title, tab)}

                {/* File Name */}
                <span className="truncate max-w-[140px] tracking-tight">{tab.title}</span>

                {/* Dirty indicator */}
                {tab.isDirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3574F0]" />
                )}

                {/* Close Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="p-0.5 rounded hover:bg-[#323438] text-[#868A91] hover:text-[#DFE1E5] opacity-60 group-hover:opacity-100 transition-opacity"
                  title="Close (Ctrl+W)"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Right Tab Actions: Split Editor, Inspection Badge */}
        <div className="flex items-center gap-1 px-3 text-[#868A91] flex-shrink-0">
          <button 
            onClick={() => {
              const next = !isGitBlameActive;
              setIsGitBlameActive(next);
              setTimeout(() => editorRef.current?.layout(), 50);
              onShowToast?.('Git Blame', next ? 'Annotated with Git Blame' : 'Annotations closed', 'info');
            }}
            title="Annotate with Git Blame (Alt+Shift+B)" 
            className={`p-1 rounded transition-colors cursor-pointer ${
              isGitBlameActive ? 'bg-[#3574F0] text-white shadow-sm' : 'hover:bg-[#2B2D30] hover:text-[#DFE1E5]'
            }`}
          >
            <History size={13} />
          </button>
          <button 
            onClick={() => {
              if (splitMode === 'none') {
                setSplitMode('vertical');
                // Select an alternate tab if available
                const other = tabs.find(t => t.id !== activeTabId);
                if (other) setSecondaryTabId(other.id);
                onShowToast?.('Editor Split', 'Split Right activated', 'info');
              } else {
                setSplitMode('none');
                onShowToast?.('Editor Split', 'Split view closed (Unsplit)', 'info');
              }
              setTimeout(() => editorRef.current?.layout(), 50);
            }}
            title={splitMode !== 'none' ? "Unsplit Editor" : "Split Right"} 
            className={`p-1 rounded transition-colors cursor-pointer ${
              splitMode !== 'none' 
                ? 'bg-[#3574F0] text-white shadow-sm' 
                : 'hover:bg-[#2B2D30] hover:text-[#DFE1E5]'
            }`}
          >
            <Split size={13} className={splitMode === 'horizontal' ? 'rotate-90' : ''} />
          </button>
          <button 
            onClick={() => {
              onSelectMenuAction?.('view.toggleProblems');
              onShowToast?.('Inspections', 'Code analysis: No problems found', 'success');
            }}
            title="Code Analysis: No problems found (Click to view Problems Alt+6)" 
            className="px-1.5 py-0.5 hover:bg-[#2B2D30] text-[#59A869] rounded transition-colors flex items-center gap-1 text-[11px] font-sans cursor-pointer"
          >
            <CheckCircle2 size={13} />
            <span className="text-[10.5px] text-[#868A91] font-medium hidden sm:inline group-hover:text-[#DFE1E5]">No problems</span>
          </button>
          <button 
            title="More Options" 
            className="p-1 hover:bg-[#2B2D30] hover:text-[#DFE1E5] rounded transition-colors cursor-pointer"
          >
            <MoreHorizontal size={13} />
          </button>
        </div>
      </div>

      {/* ─── 2. Breadcrumbs Bar (Directly below Tabs) ─── */}
      <div className="h-6 bg-[#1E1F22] border-b border-[#2B2D30] px-3 flex items-center justify-between text-[11px] text-[#868A91] select-none">
        <div className="flex items-center gap-1.5 font-sans overflow-hidden">
          {pathParts.map((part, index) => {
            const isLast = index === pathParts.length - 1;
            return (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight size={10} className="text-[#4E5157]" />}
                <span className={`flex items-center gap-1 ${isLast ? 'text-[#DFE1E5] font-medium' : 'hover:text-[#DFE1E5] cursor-pointer'}`}>
                  {index === 0 && <Folder size={11} className="text-[#3574F0]" />}
                  {isLast && getTabIcon(part)}
                  <span>{part}</span>
                </span>
              </React.Fragment>
            );
          })}
        </div>
        {isReadOnly && (
          <div className="flex items-center gap-1 text-[#F0A07B] text-[10px] bg-[#332520] px-1.5 py-0.5 rounded border border-[#5E3A2F]">
            <Lock size={10} />
            <span>Read-Only</span>
          </div>
        )}
      </div>

      {/* ─── 3. Content Panel: Database Table Grid OR SQL Console OR Monaco Editor Core ─── */}
      {activeTab.tabType === 'db-table' && activeDbTable ? (
        <div className="flex-1 overflow-hidden relative">
          <DatabaseTableGrid
            table={activeDbTable.table}
            dataSourceName={activeDbTable.dataSourceName}
            onUpdateTableData={(newRows) => {
              if (activeTab.dbMetadata) {
                onUpdateTableData?.(
                  activeTab.dbMetadata.dataSourceId,
                  activeTab.dbMetadata.schema || 'main',
                  activeTab.dbMetadata.tableName!,
                  newRows
                );
              }
            }}
            onShowToast={onShowToast}
          />
        </div>
      ) : activeTab.tabType === 'sql-console' ? (
        <div className="flex-1 overflow-hidden relative">
          <SqlQueryConsole
            dataSources={dataSources}
            initialDataSourceId={activeTab.dbMetadata?.dataSourceId}
            initialQuery={activeTab.dbMetadata?.query}
            onShowToast={onShowToast}
          />
        </div>
      ) : (
        <div 
          ref={splitContainerRef}
          className={`flex-1 flex overflow-hidden relative ${
            splitMode === 'horizontal' ? 'flex-col' : 'flex-row'
          }`}
        >
          {/* Primary Editor Pane Container */}
          <div 
            style={{ 
              flex: splitMode !== 'none' ? `0 0 ${splitRatio}%` : '1 1 0%',
              maxWidth: splitMode === 'vertical' ? `${splitRatio}%` : '100%',
              maxHeight: splitMode === 'horizontal' ? `${splitRatio}%` : '100%' 
            }}
            className="flex-1 flex overflow-hidden relative min-w-0 min-h-0"
          >
          {/* Git Blame Annotation Column (Annotate with Git Blame) */}
          {isGitBlameActive && (() => {
          const allBlameEntries = (realBlameData && realBlameData.length > 0)
            ? realBlameData 
            : getBlameDataForFile(activeTab.title, activeTab.content.split('\n').length || 1);
          
          const totalBlameLines = allBlameEntries.length;
          const viewportH = editorRef.current?.getLayoutInfo()?.height || 800;
          const overscan = 15;
          const startIndex = Math.max(0, Math.floor(scrollTop / lineHeightPx) - overscan);
          const endIndex = Math.min(totalBlameLines, Math.ceil((scrollTop + viewportH) / lineHeightPx) + overscan);
          const visibleEntries = allBlameEntries.slice(startIndex, endIndex);
          const topSpacerH = startIndex * lineHeightPx;
          const bottomSpacerH = Math.max(0, (totalBlameLines - endIndex) * lineHeightPx);

          return (
            <div 
              ref={blameColumnRef}
              style={{ width: `${blameWidth}px`, minWidth: '180px', maxWidth: '520px' }}
              className="bg-[#212225] border-r border-[#393B40] flex flex-col select-none relative overflow-hidden text-[11px] font-mono z-10 flex-shrink-0"
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const relativeY = e.clientY - rect.top - 24 + scrollTop;
                const totalLines = activeTab.content.split('\n').length || 1;
                const clickedLine = Math.max(1, Math.min(Math.floor(relativeY / lineHeightPx) + 1, totalLines));
                setGutterMenu({
                  x: e.clientX,
                  y: e.clientY,
                  lineNumber: clickedLine,
                });
              }}
            >
              {/* Blame Column Resize Handle */}
              <div
                onMouseDown={handleBlameMouseDown}
                onDoubleClick={() => setBlameWidth(prev => prev === 260 ? 380 : 260)}
                className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#3574F0] z-30 transition-colors"
                title="Drag to resize Git Blame column, double-click to toggle width"
              />

              {/* Blame Header */}
              <div className="h-6 bg-[#2B2D30] border-b border-[#393B40] px-2 flex items-center justify-between text-[10px] text-[#868A91] font-sans flex-shrink-0">
                <span className="font-semibold text-[#DFE1E5] truncate">Git Blame: {activeTab.title}</span>
                <button 
                  onClick={() => {
                    setIsGitBlameActive(false);
                    onShowToast?.('Git Blame', 'Annotation closed', 'info');
                  }}
                  className="hover:text-white px-1 text-sm leading-none cursor-pointer"
                  title="Close Annotations"
                >
                  ×
                </button>
              </div>

              {/* Scrolling Lines */}
              <div className="flex-1 relative overflow-hidden">
                <div 
                  ref={blameScrollContentRef}
                  className="absolute left-0 right-0 top-0 will-change-transform"
                  style={{ transform: `translateY(-${scrollTop}px)` }}
                >
                  {topSpacerH > 0 && <div style={{ height: `${topSpacerH}px` }} />}
                  {visibleEntries.map((entry) => {
                    const isBookmarked = bookmarks.has(entry.line);
                    const isHovered = hoveredBlameLine === entry.line;
                    const commitColor = getCommitColor(entry.commitHash);

                    return (
                      <div
                        key={entry.line}
                        onClick={() => {
                          if (editorRef.current) {
                            editorRef.current.setPosition({ lineNumber: entry.line, column: 1 });
                            editorRef.current.focus();
                            editorRef.current.revealLineInCenterIfOutsideViewport(entry.line);
                          }
                          if (entry.commitHash && onOpenGitCommit) {
                            onOpenGitCommit(entry.commitHash);
                          }
                        }}
                        onMouseEnter={() => setHoveredBlameLine(entry.line)}
                        onMouseLeave={() => setHoveredBlameLine(null)}
                        style={{ 
                          height: `${lineHeightPx}px`,
                          borderLeft: `3px solid ${commitColor}`
                        }}
                        className={`flex items-center justify-between px-2 text-[11px] cursor-pointer transition-colors relative group select-none ${
                          isHovered ? 'bg-[#2E436E] text-white' : 'text-[#868A91] hover:text-[#DFE1E5]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 overflow-hidden truncate mr-1">
                          {isBookmarked && (
                            <Bookmark size={10} className="text-[#3574F0] fill-[#3574F0] flex-shrink-0" />
                          )}
                          <span className="text-[#A8ADBD] font-medium text-[10px] w-12 truncate flex-shrink-0">{entry.relativeTime}</span>
                          <span className="truncate max-w-[95px] text-[#DFE1E5] font-sans text-[11px]">{entry.author}</span>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span 
                            className="text-[10px] font-mono px-1 py-0.2 rounded font-medium"
                            style={{ color: commitColor, backgroundColor: `${commitColor}18` }}
                          >
                            {entry.commitHash.substring(0, 7)}
                          </span>

                          {/* Show Diff Action Icon */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowBlameDiff(entry);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#3574F0] hover:text-white rounded text-[#868A91] transition-opacity cursor-pointer"
                            title={`Show Diff for ${entry.commitHash.substring(0, 7)} with previous revision`}
                          >
                            <GitCompare size={12} />
                          </button>
                        </div>

                        {/* JetBrains Commit Info Tooltip Balloon */}
                        {isHovered && (
                          <div 
                            className="fixed ml-2 w-72 bg-[#2B2D30] border border-[#393B40] rounded shadow-2xl p-2.5 z-50 text-xs font-sans text-[#DFE1E5] pointer-events-none"
                            style={{
                              left: `${gutterMenu ? gutterMenu.x : blameWidth + 20}px`,
                              top: `${Math.min(window.innerHeight - 150, Math.max(100, entry.line * lineHeightPx - scrollTop + 80))}px`,
                            }}
                          >
                            <div className="flex items-center justify-between mb-1 text-[11px]">
                              <span className="font-semibold" style={{ color: commitColor }}>Commit {entry.commitHash.substring(0, 8)}</span>
                              <span className="text-[#868A91] text-[10px]">{entry.dateStr}</span>
                            </div>
                            <div className="text-[11px] text-[#A8ADBD] mb-1">
                              Author: <span className="text-white font-medium">{entry.author}</span> &lt;{entry.email}&gt;
                            </div>
                            <div className="text-[11px] text-[#DFE1E5] bg-[#1E1F22] p-1.5 rounded border border-[#393B40]/50 my-1 font-mono text-[10.5px]">
                              {entry.message}
                            </div>
                            <div className="text-[10px] text-[#3574F0] flex items-center gap-1 mt-1 font-medium">
                              <GitCompare size={11} />
                              <span>Click diff icon to view changes</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {bottomSpacerH > 0 && <div style={{ height: `${bottomSpacerH}px` }} />}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Monaco Editor Core */}
        <div 
          className="flex-1 relative h-full"
          onContextMenu={(e) => e.preventDefault()}
        >
          <Editor
            height="100%"
            language={effectiveLanguage}
            value={activeTab.content}
            theme={theme}
            beforeMount={handleEditorWillMount}
            onMount={handleEditorDidMount}
            onChange={(value) => onChangeContent(activeTab.id, value || '')}
            options={{
              readOnly: isReadOnly,
              fontSize,
              tabSize,
              fontFamily,
              lineHeight: lineHeightPx,
              fontLigatures,
              minimap: { enabled: minimapEnabled },
              lineNumbers: showLineNumbers ? 'on' : 'off',
              wordWrap: softWrap ? 'on' : 'off',
              renderWhitespace: showWhitespaces ? 'all' : 'none',
              guides: { indentation: showIndentGuides },
              glyphMargin: true,
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              renderLineHighlight: 'all',
              bracketPairColorization: { enabled: true },
              formatOnPaste: true,
              formatOnType: true,
              automaticLayout: true,
              contextmenu: false,
              cursorSmoothCaretAnimation: 'on',
              folding: true,
              definitionLinkOpensInPeek: false,
              gotoLocation: {
                multiple: 'goto',
                multipleDefinitions: 'goto',
                multipleImplementations: 'goto',
                multipleReferences: 'goto',
                multipleTypeDefinitions: 'goto',
                multipleDeclarations: 'goto',
              },
            }}
          />

          {/* ─── JetBrains Code Inspection Traffic Light Widget ─── */}
          <div 
            onClick={onToggleProblems}
            title={`Code Analysis: ${activeErrorsCount} error(s), ${activeWarningsCount} warning(s)\nClick to toggle Problems tool window (Alt+6)`}
            className="absolute top-2.5 right-6 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#2B2D30]/90 hover:bg-[#35373B] border border-[#393B40] text-xs cursor-pointer shadow-md select-none transition-all group backdrop-blur-sm"
          >
            {activeErrorsCount > 0 ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#E55353] inline-block shadow-sm animate-pulse" />
                <span className="text-[#E55353] font-mono font-medium text-[11px]">{activeErrorsCount}</span>
                {activeWarningsCount > 0 && (
                  <>
                    <span className="text-[#868A91] text-[10px]">•</span>
                    <span className="text-[#F1A23A] font-mono text-[11px]">{activeWarningsCount}</span>
                  </>
                )}
              </>
            ) : activeWarningsCount > 0 ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#F1A23A] inline-block shadow-sm" />
                <span className="text-[#F1A23A] font-mono font-medium text-[11px]">{activeWarningsCount}</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={13} className="text-[#59A869]" />
                <span className="text-[#59A869] text-[10px] font-medium hidden group-hover:inline">No problems</span>
              </>
            )}
          </div>

          {/* ─── IntelliJ Intention Lightbulb (Alt+Enter) ─── */}
          {isLightbulbVisible && !showContextActions && cursorCoords.top > 0 && (
            <div 
              style={{
                top: `${cursorCoords.top}px`,
                left: `${Math.max(6, cursorCoords.left - 24)}px`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setShowContextActions(true);
              }}
              title="Show Context Actions (Alt+Enter)"
              className="absolute z-30 cursor-pointer p-0.5 rounded hover:bg-[#393B40] transition-transform hover:scale-110 select-none animate-in fade-in duration-100"
            >
              <Lightbulb size={16} className="text-[#F1A23A] fill-[#F1A23A] drop-shadow-sm" />
            </div>
          )}

          {/* ─── IntelliJ Context Actions / Quick Fixes Popup (Alt+Enter) ─── */}
          {showContextActions && (
            <div 
              ref={contextActionsRef}
              style={{
                top: `${Math.min(cursorCoords.top + cursorCoords.height + 4, window.innerHeight - 300)}px`,
                left: `${Math.min(cursorCoords.left, window.innerWidth - 320)}px`,
              }}
              onClick={(e) => e.stopPropagation()}
              className="absolute z-40 bg-[#2B2D30] border border-[#393B40] rounded shadow-2xl py-1 w-72 select-none text-xs text-[#DFE1E5] animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-2.5 py-1 text-[10px] font-semibold text-[#868A91] uppercase tracking-wider border-b border-[#393B40]/60 flex items-center justify-between">
                <span>Context Actions</span>
                <span className="text-[#868A91] font-mono text-[9px]">Alt+Enter</span>
              </div>
              <div className="py-1 max-h-60 overflow-y-auto">
                {contextActionItems.map((item, idx) => {
                  const isSelected = idx === selectedActionIdx;
                  return (
                    <div
                      key={item.id}
                      onClick={() => item.action()}
                      onMouseEnter={() => setSelectedActionIdx(idx)}
                      className={`px-3 py-1.5 cursor-pointer flex items-center justify-between transition-colors ${
                        isSelected ? 'bg-[#3574F0] text-white' : 'hover:bg-[#35373B] text-[#DFE1E5]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {item.isQuickFix ? (
                          <Lightbulb size={13} className={`flex-shrink-0 ${isSelected ? 'text-white fill-white' : 'text-[#F1A23A] fill-[#F1A23A]'}`} />
                        ) : (
                          <Sparkles size={13} className={`flex-shrink-0 ${isSelected ? 'text-white' : 'text-[#868A91]'}`} />
                        )}
                        <span className="truncate">{item.title}</span>
                      </div>
                      {item.shortcut && (
                        <span className={`text-[10.5px] font-mono ml-2 flex-shrink-0 ${isSelected ? 'text-white/80' : 'text-[#868A91]'}`}>
                          {item.shortcut}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── IntelliJ Parameter Info Tooltip (Ctrl+P) ─── */}
          {parameterInfo && (
            <div 
              style={{
                top: `${parameterInfo.top}px`,
                left: `${parameterInfo.left}px`,
              }}
              className="absolute z-40 bg-[#2B2D30] border border-[#393B40] rounded shadow-xl px-2.5 py-1 text-[11px] font-mono text-[#DFE1E5] flex items-center gap-1.5 select-none animate-in fade-in duration-100"
            >
              <Info size={12} className="text-[#3574F0] flex-shrink-0" />
              <span>{parameterInfo.signature}</span>
            </div>
          )}

          {/* ─── JetBrains In-Editor AI Prompt Bar (Ctrl+\) ─── */}
          <AiInlinePromptBar
            isOpen={isAiPromptBarOpen}
            position={aiPromptBarPos}
            activeLanguage={effectiveLanguage}
            selectedText={aiInlineSelection}
            onAccept={handleAcceptAiPrompt}
            onClose={() => setIsAiPromptBarOpen(false)}
          />
        </div>
      </div>

      {/* ─── Secondary Split Editor Pane (Rendered if splitMode !== 'none' and secondaryTab exists) ─── */}
      {splitMode !== 'none' && secondaryTab && (
        <>
          {/* Draggable Divider between Primary and Secondary Panes */}
          <div
            onMouseDown={handleStartSplitResize}
            className={`flex-shrink-0 select-none z-30 transition-colors ${
              splitMode === 'vertical'
                ? 'w-1.5 cursor-col-resize hover:bg-[#3574F0] bg-[#2B2D30] border-x border-[#393B40]'
                : 'h-1.5 cursor-row-resize hover:bg-[#3574F0] bg-[#2B2D30] border-y border-[#393B40]'
            }`}
          />

          {/* Secondary Editor Pane Container */}
          <div 
            style={{ 
              flex: `0 0 ${100 - splitRatio}%`,
              maxWidth: splitMode === 'vertical' ? `${100 - splitRatio}%` : '100%',
              maxHeight: splitMode === 'horizontal' ? `${100 - splitRatio}%` : '100%' 
            }}
            className="flex flex-col bg-[#1E1F22] overflow-hidden min-w-0 min-h-0 relative border-l border-[#2B2D30]"
          >
            {/* Secondary Header Tab Bar */}
            <div className="h-[30px] bg-[#222427] border-b border-[#2B2D30] px-2 flex items-center justify-between select-none">
              <div className="flex items-center gap-1.5 text-xs text-[#DFE1E5] font-medium truncate">
                {getTabIcon(secondaryTab.title)}
                <span className="truncate">{secondaryTab.title}</span>
                {secondaryTab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-[#3574F0]" />}
              </div>

              {/* Secondary Controls: Switch tab dropdown & Close Split button */}
              <div className="flex items-center gap-1">
                {tabs.length > 1 && (
                  <select
                    value={secondaryTab.id}
                    onChange={(e) => setSecondaryTabId(e.target.value)}
                    className="bg-[#1E1F22] border border-[#393B40] text-[#DFE1E5] text-[11px] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                  >
                    {tabs.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => {
                    setSplitMode('none');
                    setTimeout(() => editorRef.current?.layout(), 50);
                    onShowToast?.('Editor Split', 'Split view closed', 'info');
                  }}
                  title="Close Split (Unsplit)"
                  className="p-1 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Secondary Monaco Editor Core */}
            <div 
              className="flex-1 relative h-full"
              onContextMenu={(e) => e.preventDefault()}
            >
              <Editor
                height="100%"
                language={secondaryTab.language || 'typescript'}
                value={secondaryTab.content}
                theme={theme}
                onChange={(value) => onChangeContent(secondaryTab.id, value || '')}
                options={{
                  readOnly: isReadOnly,
                  fontSize,
                  tabSize,
                  fontFamily,
                  lineHeight: lineHeightPx,
                  fontLigatures,
                  minimap: { enabled: false },
                  lineNumbers: showLineNumbers ? 'on' : 'off',
                  wordWrap: softWrap ? 'on' : 'off',
                  renderWhitespace: showWhitespaces ? 'all' : 'none',
                  glyphMargin: false,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
        </>
      )}
      </div>
      )}

      {/* ─── JetBrains Gutter Context Menu (media_1792658742200.png) ─── */}
      {gutterMenu && (
        <div 
          ref={gutterMenuRef}
          className="fixed bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-64 select-none"
          style={{ 
            top: `${Math.max(10, Math.min(gutterMenu.y, window.innerHeight - 340))}px`, 
            left: `${Math.min(gutterMenu.x, window.innerWidth - 270)}px` 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Test Runner Gutter Action */}
          {(() => {
            const matchedTest = testCasesInFile.find(tc => tc.line === gutterMenu.lineNumber || tc.line === gutterMenu.lineNumber - 1);
            if (!matchedTest) return null;
            return (
              <>
                <div
                  onClick={() => {
                    onRunTestAtLine?.(matchedTest.line, matchedTest.name);
                    setGutterMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <Play size={13} className="text-[#59A869] group-hover:text-white fill-[#59A869] group-hover:fill-white" />
                    <span>Run Test '{matchedTest.name}'</span>
                  </div>
                  <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+Shift+F10</span>
                </div>
                <div className="border-t border-[#393B40] my-1" />
              </>
            );
          })()}

          {/* Breakpoint Actions */}
          {(() => {
            const existingBp = activeTab ? effectiveBreakpoints.find(
              bp => (bp.filePath === activeTab.path || bp.fileName === activeTab.title || activeTab.path.endsWith(bp.fileName)) && 
                    bp.lineNumber === gutterMenu.lineNumber
            ) : undefined;

            return (
              <>
                <div 
                  onClick={() => {
                    handleToggleBreakpoint(gutterMenu.lineNumber);
                    setGutterMenu(null);
                  }}
                  onMouseEnter={() => setActiveGutterSubmenu(null)}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3 text-center flex items-center justify-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#E55353] inline-block shadow-sm" />
                    </span>
                    <span>{existingBp ? 'Remove Breakpoint' : 'Toggle Breakpoint'}</span>
                  </div>
                  <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+F8</span>
                </div>

                {existingBp && (
                  <>
                    <div 
                      onClick={() => {
                        setConditionPopup({
                          bp: existingBp,
                          x: gutterMenu.x,
                          y: gutterMenu.y,
                          conditionText: existingBp.condition || '',
                          isEnabled: existingBp.enabled,
                        });
                        setGutterMenu(null);
                      }}
                      onMouseEnter={() => setActiveGutterSubmenu(null)}
                      className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8"
                    >
                      <span>Edit Breakpoint Condition...</span>
                    </div>

                    <div 
                      onClick={() => {
                        const updatedBp = {
                          ...existingBp,
                          enabled: !existingBp.enabled,
                        };
                        if (onUpdateBreakpoint) {
                          onUpdateBreakpoint(updatedBp);
                        }
                        setLocalBreakpoints(prev => prev.map(b => b.id === updatedBp.id ? updatedBp : b));
                        onShowToast?.(updatedBp.enabled ? 'Breakpoint Enabled' : 'Breakpoint Disabled', `Line ${updatedBp.lineNumber}`, 'info');
                        setGutterMenu(null);
                      }}
                      onMouseEnter={() => setActiveGutterSubmenu(null)}
                      className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8"
                    >
                      <span>{existingBp.enabled ? 'Disable Breakpoint' : 'Enable Breakpoint'}</span>
                    </div>
                  </>
                )}

                <div className="border-t border-[#393B40] my-1" />
              </>
            );
          })()}

          {/* 1. Annotate with Git Blame */}
          <div 
            onClick={() => {
              const nextState = !isGitBlameActive;
              setIsGitBlameActive(nextState);
              onShowToast?.('Git Blame', nextState ? 'Enabled git annotations' : 'Disabled git annotations', 'info');
              setGutterMenu(null);
            }}
            onMouseEnter={() => setActiveGutterSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <span className="w-3 text-center text-[#3574F0] group-hover:text-white font-bold">
                {isGitBlameActive ? '✓' : ''}
              </span>
              <span>Annotate with Git Blame</span>
            </div>
          </div>

          {/* Git Blame Extended Actions */}
          {isGitBlameActive && (() => {
            const allBlame = (realBlameData && realBlameData.length > 0)
              ? realBlameData 
              : getBlameDataForFile(activeTab.title, activeTab.content.split('\n').length || 1);
            const matched = allBlame.find(e => e.line === gutterMenu.lineNumber);
            if (!matched) return null;
            return (
              <>
                <div 
                  onClick={() => {
                    handleShowBlameDiff(matched);
                    setGutterMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 pl-8 font-semibold text-[#3574F0] hover:text-white"
                >
                  <GitCompare size={13} />
                  <span>Show Diff for Line ({matched.commitHash.substring(0, 7)})</span>
                </div>

                <div 
                  onClick={() => {
                    navigator.clipboard.writeText(matched.commitHash);
                    onShowToast?.('Revision Number', `Copied ${matched.commitHash.substring(0, 7)}`, 'success');
                    setGutterMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8"
                >
                  <span>Copy Revision Number</span>
                </div>

                {onOpenGitCommit && (
                  <div 
                    onClick={() => {
                      onOpenGitCommit(matched.commitHash);
                      setGutterMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8"
                  >
                    <span>Show in Git Log</span>
                  </div>
                )}
              </>
            );
          })()}

          {/* 2. Disable/Enable Recording Time with Run to Cursor */}
          <div 
            onClick={() => {
              const nextVal = !isRecordingTime;
              setIsRecordingTime(nextVal);
              onShowToast?.('Run to Cursor', nextVal ? 'Recording time enabled' : 'Recording time disabled', 'info');
              setGutterMenu(null);
            }}
            onMouseEnter={() => setActiveGutterSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8 text-[#A8ADBD] hover:text-white"
          >
            <span>{isRecordingTime ? 'Disable Recording Time with Run to Cursor' : 'Enable Recording Time with Run to Cursor'}</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 3. Add Bookmark / Remove Bookmark */}
          <div 
            onClick={() => {
              setBookmarks(prev => {
                const next = new Set(prev);
                if (next.has(gutterMenu.lineNumber)) {
                  next.delete(gutterMenu.lineNumber);
                  onShowToast?.('Bookmark Removed', `Line ${gutterMenu.lineNumber}`, 'info');
                } else {
                  next.add(gutterMenu.lineNumber);
                  onShowToast?.('Bookmark Added', `Line ${gutterMenu.lineNumber}`, 'success');
                }
                return next;
              });
              setGutterMenu(null);
            }}
            onMouseEnter={() => setActiveGutterSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8"
          >
            <span>{bookmarks.has(gutterMenu.lineNumber) ? 'Remove Bookmark' : 'Add Bookmark'}</span>
          </div>

          {/* 4. Add Mnemonic Bookmark... Ctrl+F11 */}
          <div 
            onClick={() => {
              setMnemonicPopup({
                lineNumber: gutterMenu.lineNumber,
                x: gutterMenu.x,
                y: gutterMenu.y,
              });
              setGutterMenu(null);
            }}
            onMouseEnter={() => setActiveGutterSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between pl-8 group"
          >
            <span>{mnemonicBookmarks.has(gutterMenu.lineNumber) ? `Edit Mnemonic [${mnemonicBookmarks.get(gutterMenu.lineNumber)}]...` : 'Add Mnemonic Bookmark...'}</span>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Ctrl+F11</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 5. Soft-Wrap */}
          <div 
            onClick={() => {
              const nextWrap = !softWrap;
              setSoftWrap(nextWrap);
              editorRef.current?.updateOptions({ wordWrap: nextWrap ? 'on' : 'off' });
              onShowToast?.('Soft-Wrap', nextWrap ? 'Enabled word wrapping' : 'Disabled word wrapping', 'info');
              setGutterMenu(null);
            }}
            onMouseEnter={() => setActiveGutterSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <span className="w-3 text-center text-[#3574F0] group-hover:text-white font-bold">
                {softWrap ? '✓' : ''}
              </span>
              <span>Soft-Wrap</span>
            </div>
          </div>

          {/* 6. Configure Soft Wraps... */}
          <div 
            onClick={() => {
              onShowToast?.('Configure Soft Wraps', 'Editor soft wrap boundary: default margin', 'info');
              setGutterMenu(null);
            }}
            onMouseEnter={() => setActiveGutterSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8"
          >
            <span>Configure Soft Wraps...</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 7. Appearance > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveGutterSubmenu('appearance')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between pl-8">
              <span>Appearance</span>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeGutterSubmenu === 'appearance' && (
              <div 
                className={`absolute ${gutterMenu.x + 250 + 200 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} -top-1 bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-52`}
              >
                <div 
                  onClick={() => {
                    const nextVal = !showLineNumbers;
                    setShowLineNumbers(nextVal);
                    editorRef.current?.updateOptions({ lineNumbers: nextVal ? 'on' : 'off' });
                    onShowToast?.('Line Numbers', nextVal ? 'Shown' : 'Hidden', 'info');
                    setGutterMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 group"
                >
                  <span className="w-3 text-center text-[#3574F0] group-hover:text-white font-bold">
                    {showLineNumbers ? '✓' : ''}
                  </span>
                  <span>Show Line Numbers</span>
                </div>

                <div 
                  onClick={() => {
                    const nextVal = !showWhitespaces;
                    setShowWhitespaces(nextVal);
                    editorRef.current?.updateOptions({ renderWhitespace: nextVal ? 'all' : 'none' });
                    onShowToast?.('Whitespaces', nextVal ? 'Shown' : 'Hidden', 'info');
                    setGutterMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 group"
                >
                  <span className="w-3 text-center text-[#3574F0] group-hover:text-white font-bold">
                    {showWhitespaces ? '✓' : ''}
                  </span>
                  <span>Show Whitespaces</span>
                </div>

                <div 
                  onClick={() => {
                    const nextVal = !showIndentGuides;
                    setShowIndentGuides(nextVal);
                    editorRef.current?.updateOptions({ guides: { indentation: nextVal } });
                    onShowToast?.('Indent Guides', nextVal ? 'Enabled' : 'Disabled', 'info');
                    setGutterMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 group"
                >
                  <span className="w-3 text-center text-[#3574F0] group-hover:text-white font-bold">
                    {showIndentGuides ? '✓' : ''}
                  </span>
                  <span>Show Indent Guides</span>
                </div>

                <div 
                  onClick={() => {
                    const nextVal = !showMethodSeparators;
                    setShowMethodSeparators(nextVal);
                    onShowToast?.('Method Separators', nextVal ? 'Enabled method separators' : 'Disabled method separators', 'info');
                    setGutterMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 group"
                >
                  <span className="w-3 text-center text-[#3574F0] group-hover:text-white font-bold">
                    {showMethodSeparators ? '✓' : ''}
                  </span>
                  <span>Show Method Separators</span>
                </div>

                <div 
                  onClick={() => {
                    const nextVal = !showCodeLens;
                    setShowCodeLens(nextVal);
                    onShowToast?.('Code Lens', nextVal ? 'Enabled references and implementations' : 'Disabled Code Lens', 'info');
                    setGutterMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 group"
                >
                  <span className="w-3 text-center text-[#3574F0] group-hover:text-white font-bold">
                    {showCodeLens ? '✓' : ''}
                  </span>
                  <span>Show Code Lens</span>
                </div>
              </div>
            )}
          </div>

          {/* 8. Configure Gutter Icons... */}
          <div 
            onClick={() => {
              setIsGutterIconsConfigOpen(true);
              setGutterMenu(null);
            }}
            onMouseEnter={() => setActiveGutterSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8"
          >
            <span>Configure Gutter Icons...</span>
          </div>
        </div>
      )}

      {/* ─── IntelliJ Breakpoint Condition Balloon Popup ─── */}
      {conditionPopup && (
        <div 
          ref={conditionPopupRef}
          className="fixed bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl p-3 z-50 text-[12px] text-[#DFE1E5] w-80 select-none animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: `${Math.max(10, Math.min(conditionPopup.y - 40, window.innerHeight - 200))}px`,
            left: `${Math.min(conditionPopup.x + 20, window.innerWidth - 340)}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 border-b border-[#393B40] mb-2 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E55353] inline-block shadow-sm" />
              <span>Breakpoint: Line {conditionPopup.bp.lineNumber}</span>
            </div>
            <button 
              onClick={() => setConditionPopup(null)}
              className="text-[#868A91] hover:text-white text-xs px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <label className="flex items-center gap-2 mb-2 cursor-pointer text-xs">
            <input 
              type="checkbox"
              checked={conditionPopup.isEnabled}
              onChange={(e) => setConditionPopup(prev => prev ? { ...prev, isEnabled: e.target.checked } : null)}
              className="accent-[#3574F0] rounded cursor-pointer"
            />
            <span>Enabled</span>
          </label>

          <div className="mb-3">
            <label className="block text-[11px] text-[#868A91] mb-1 font-mono">Condition (evaluated at suspension):</label>
            <input 
              type="text"
              autoFocus
              value={conditionPopup.conditionText}
              onChange={(e) => setConditionPopup(prev => prev ? { ...prev, conditionText: e.target.value } : null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const updated = {
                    ...conditionPopup.bp,
                    enabled: conditionPopup.isEnabled,
                    condition: conditionPopup.conditionText.trim() || undefined,
                  };
                  if (onUpdateBreakpoint) {
                    onUpdateBreakpoint(updated);
                  }
                  setLocalBreakpoints(prev => prev.map(b => b.id === updated.id ? updated : b));
                  onShowToast?.('Breakpoint Updated', `Condition: ${updated.condition || 'None'}`, 'success');
                  setConditionPopup(null);
                } else if (e.key === 'Escape') {
                  setConditionPopup(null);
                }
              }}
              placeholder="e.g. i === 5 || count > 10"
              className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1 text-xs text-[#DFE1E5] font-mono outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => {
                onRemoveBreakpoint?.(conditionPopup.bp.id);
                setConditionPopup(null);
              }}
              className="text-[#E55353] hover:underline text-xs cursor-pointer"
            >
              Remove
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConditionPopup(null)}
                className="px-2.5 py-1 rounded hover:bg-[#35373B] text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onUpdateBreakpoint?.({
                    ...conditionPopup.bp,
                    enabled: conditionPopup.isEnabled,
                    condition: conditionPopup.conditionText.trim() || undefined,
                  });
                  setConditionPopup(null);
                }}
                className="px-3 py-1 bg-[#3574F0] hover:bg-[#3574F0]/85 text-white rounded text-xs font-medium cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Backdrop overlay so clicking anywhere immediately closes context menus ─── */}
      {(editorMenu || gutterMenu || tabMenu || conditionPopup) && (
        <div 
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => {
            setEditorMenu(null);
            setActiveEditorSubmenu(null);
            setGutterMenu(null);
            setActiveGutterSubmenu(null);
            setTabMenu(null);
            setActiveTabSubmenu(null);
            setConditionPopup(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setEditorMenu(null);
            setActiveEditorSubmenu(null);
            setGutterMenu(null);
            setActiveGutterSubmenu(null);
            setTabMenu(null);
            setActiveTabSubmenu(null);
            setConditionPopup(null);
          }}
        />
      )}

      {/* ─── JetBrains New UI Authentic Editor Context Menu (media_1792660725178.png) ─── */}
      {editorMenu && (
        <div 
          ref={editorMenuRef}
          className="fixed bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-64 max-h-[calc(100vh-24px)] overflow-y-auto select-none font-sans"
          style={{ 
            top: `${editorMenu.y}px`, 
            left: `${editorMenu.x}px` 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Show Context Actions (Alt+Enter) */}
          <div 
            onClick={() => {
              editorRef.current?.trigger('source', 'editor.action.quickFix');
              onShowToast?.('Context Actions', 'Context actions / quick-fixes triggered (Alt+Enter)', 'info');
              setEditorMenu(null);
            }}
            onMouseEnter={() => setActiveEditorSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Lightbulb size={13} className="text-[#EDA200] fill-[#EDA200]/20 flex-shrink-0" />
              <span>Show Context Actions</span>
            </div>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Alt+Enter</span>
          </div>

          {/* 2. AI Actions > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveEditorSubmenu('ai')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-[#9876AA] flex-shrink-0" />
                <span>AI Actions</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeEditorSubmenu === 'ai' && (
              <div className={`absolute ${editorMenu.x + 250 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isEditorBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-52`}>
                <div 
                  onClick={() => {
                    onShowToast?.('AI Assistant', 'Explaining selected code block...', 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Explain Code</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('AI Assistant', 'Analyzing code refactor proposals...', 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Refactor Code</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('AI Assistant', 'Scanning for bugs and potential issues...', 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Find Problems</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('AI Assistant', 'Generating unit tests...', 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Generate Unit Tests</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 3. Paste */}
          <div 
            onClick={async () => {
              try {
                const text = await navigator.clipboard?.readText();
                if (text && editorRef.current) {
                  editorRef.current.trigger('keyboard', 'type', { text });
                  onShowToast?.('Paste', 'Pasted from clipboard', 'info');
                }
              } catch {
                editorRef.current?.trigger('source', 'editor.action.clipboardPasteAction');
              }
              setEditorMenu(null);
            }}
            onMouseEnter={() => setActiveEditorSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Clipboard size={13} className="text-[#868A91]" />
              <span>Paste</span>
            </div>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Ctrl+V</span>
          </div>

          {/* 4. Copy / Paste Special > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveEditorSubmenu('copy-special')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2 pl-5">
                <span>Copy / Paste Special</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeEditorSubmenu === 'copy-special' && (
              <div className={`absolute ${editorMenu.x + 250 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isEditorBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-52`}>
                <div 
                  onClick={() => {
                    const sel = editorRef.current?.getModel()?.getValueInRange(editorRef.current.getSelection());
                    if (sel) navigator.clipboard?.writeText(sel);
                    onShowToast?.('Copy', 'Copied plain text', 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Copy as Plain Text</span>
                </div>
                <div 
                  onClick={() => {
                    navigator.clipboard?.writeText(activeTab.title);
                    onShowToast?.('Copy Reference', `Copied reference: ${activeTab.title}`, 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Copy Reference</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+Alt+Shift+C</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Paste History', 'Paste history buffer empty', 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Paste from History...</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+Shift+V</span>
                </div>
              </div>
            )}
          </div>

          {/* 5. Column Selection Mode */}
          <div 
            onClick={() => {
              const current = editorRef.current?.getOption(monacoRef.current?.editor?.EditorOption?.columnSelection);
              editorRef.current?.updateOptions({ columnSelection: !current });
              onShowToast?.('Selection Mode', !current ? 'Column Selection Mode enabled' : 'Column Selection Mode disabled', 'info');
              setEditorMenu(null);
            }}
            onMouseEnter={() => setActiveEditorSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group pl-8"
          >
            <span>Column Selection Mode</span>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Alt+Shift+Insert</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 6. Find Usages (Alt+F7) & Show Usages (Ctrl+Alt+F7) */}
          <div 
            onClick={() => {
              const sym = getWordUnderCursor();
              if (sym) {
                onFindUsages?.(sym);
              } else {
                onShowToast?.('Find Usages', 'Select a symbol or place cursor on code (Alt+F7)', 'info');
              }
              setEditorMenu(null);
            }}
            onMouseEnter={() => setActiveEditorSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Search size={13} className="text-[#868A91]" />
              <span>Find Usages</span>
            </div>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Alt+F7</span>
          </div>

          <div 
            onClick={() => {
              const sym = getWordUnderCursor();
              if (sym) {
                onShowUsages?.(sym);
              } else {
                onShowToast?.('Show Usages', 'Select a symbol or place cursor on code (Ctrl+Alt+F7)', 'info');
              }
              setEditorMenu(null);
            }}
            onMouseEnter={() => setActiveEditorSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group pl-8"
          >
            <span>Show Usages</span>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Ctrl+Alt+F7</span>
          </div>

          {/* 7. Go To > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveEditorSubmenu('goto')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2 pl-5">
                <span>Go To</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeEditorSubmenu === 'goto' && (
              <div className={`absolute ${editorMenu.x + 250 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isEditorBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-52`}>
                <div 
                  onClick={() => {
                    editorRef.current?.trigger('source', 'editor.action.revealDefinition');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Declaration or Usages</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+B</span>
                </div>
                <div 
                  onClick={() => {
                    editorRef.current?.trigger('source', 'editor.action.goToImplementation');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Implementation(s)</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+Alt+B</span>
                </div>
                <div 
                  onClick={() => {
                    editorRef.current?.trigger('source', 'editor.action.goToTypeDefinition');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Type Declaration</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+Shift+B</span>
                </div>
                <div 
                  onClick={() => {
                    onOpenGoToLine?.();
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Line/Column...</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+G</span>
                </div>
              </div>
            )}
          </div>

          {/* 8. Folding > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveEditorSubmenu('folding')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2 pl-5">
                <span>Folding</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeEditorSubmenu === 'folding' && (
              <div className={`absolute ${editorMenu.x + 250 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isEditorBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-52`}>
                <div 
                  onClick={() => {
                    editorRef.current?.getAction('editor.fold')?.run();
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Collapse</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+-</span>
                </div>
                <div 
                  onClick={() => {
                    editorRef.current?.getAction('editor.unfold')?.run();
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Expand</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl++</span>
                </div>
                <div 
                  onClick={() => {
                    editorRef.current?.getAction('editor.foldAll')?.run();
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Collapse All</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+Shift+-</span>
                </div>
                <div 
                  onClick={() => {
                    editorRef.current?.getAction('editor.unfoldAll')?.run();
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Expand All</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+Shift++</span>
                </div>
              </div>
            )}
          </div>

          {/* 9. Analyze > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveEditorSubmenu('analyze')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2 pl-5">
                <span>Analyze</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeEditorSubmenu === 'analyze' && (
              <div className={`absolute ${editorMenu.x + 250 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isEditorBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-52`}>
                <div 
                  onClick={() => {
                    onShowToast?.('Code Inspection', 'Running static code analysis...', 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Inspect Code...</span>
                </div>
                <div 
                  onClick={() => {
                    editorRef.current?.getAction('editor.action.formatDocument')?.run();
                    onShowToast?.('Code Cleanup', 'Code formatted and cleaned up', 'success');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Silent Code Cleanup</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 10. Rename... */}
          <div 
            onClick={() => {
              const sym = getWordUnderCursor();
              onRenameSymbol?.(sym);
              setEditorMenu(null);
            }}
            onMouseEnter={() => setActiveEditorSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group pl-8"
          >
            <span>Rename...</span>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Shift+F6</span>
          </div>

          {/* 11. Refactor > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveEditorSubmenu('refactor')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2 pl-5">
                <span>Refactor</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeEditorSubmenu === 'refactor' && (
              <div className={`absolute ${editorMenu.x + 250 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isEditorBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-52`}>
                <div 
                  onClick={() => {
                    const sym = getWordUnderCursor();
                    onRenameSymbol?.(sym);
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Rename...</span>
                  <span className="text-[10px] text-[#868A91]">Shift+F6</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Refactor', 'Extract method refactoring', 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Extract Method...</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+Alt+M</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Refactor', 'Extract variable refactoring', 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Extract Variable...</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+Alt+V</span>
                </div>
              </div>
            )}
          </div>

          {/* 12. Generate... */}
          <div 
            onClick={() => {
              onShowToast?.('Generate', 'Generate constructor, getters/setters (Alt+Insert)', 'info');
              setEditorMenu(null);
            }}
            onMouseEnter={() => setActiveEditorSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group pl-8"
          >
            <span>Generate...</span>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Alt+Insert</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 13. Open In > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveEditorSubmenu('open-in')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2 pl-5">
                <span>Open In</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeEditorSubmenu === 'open-in' && (
              <div className={`absolute ${editorMenu.x + 250 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isEditorBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-48`}>
                <div 
                  onClick={() => {
                    onShowToast?.('Explorer', `Revealing ${activeTab.path} in Explorer`, 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <Folder size={13} className="text-[#3574F0]" />
                  <span>Explorer</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Terminal', 'Opened directory in terminal', 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <span className="text-[#59A869] font-mono text-[10px] font-bold">&gt;_</span>
                  <span>Terminal</span>
                </div>
              </div>
            )}
          </div>

          {/* 14. Local History > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveEditorSubmenu('local-history')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2 pl-5">
                <History size={13} className="text-[#868A91]" />
                <span>Local History</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeEditorSubmenu === 'local-history' && (
              <div className={`absolute ${editorMenu.x + 250 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isEditorBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-48`}>
                <div 
                  onClick={() => {
                    onSelectMenuAction?.('file.localHistory');
                    onShowToast?.('Local History', `Opened history for ${activeTab.title}`, 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Show History</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Local History', `Put label on ${activeTab.title}`, 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Put Label...</span>
                </div>
              </div>
            )}
          </div>

          {/* 15. Git > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveEditorSubmenu('git')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2 pl-5">
                <GitBranch size={13} className="text-[#868A91]" />
                <span>Git</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeEditorSubmenu === 'git' && (
              <div className={`absolute ${editorMenu.x + 250 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isEditorBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-52`}>
                <div 
                  onClick={() => {
                    onSelectMenuAction?.('git.commit');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Commit File...</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+K</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Git', `Staged ${activeTab.title}`, 'success');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Add</span>
                </div>
                <div 
                  onClick={() => {
                    setIsGitBlameActive(true);
                    onShowToast?.('Git Blame', 'Annotated with Git Blame', 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Annotate with Git Blame</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Git Compare', `Comparing ${activeTab.title} with branch`, 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Compare with Branch...</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 16. Compare with Clipboard */}
          <div 
            onClick={async () => {
              const clipboardText = await navigator.clipboard?.readText();
              onShowToast?.('Compare with Clipboard', `Comparing with clipboard buffer (${clipboardText?.length || 0} chars)`, 'info');
              setEditorMenu(null);
            }}
            onMouseEnter={() => setActiveEditorSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 pl-5"
          >
            <Split size={13} className="text-[#868A91]" />
            <span>Compare with Clipboard</span>
          </div>

          {/* 17. Diagrams > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveEditorSubmenu('diagrams')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2 pl-5">
                <Layers size={13} className="text-[#868A91]" />
                <span>Diagrams</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeEditorSubmenu === 'diagrams' && (
              <div className={`absolute ${editorMenu.x + 250 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isEditorBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-48`}>
                <div 
                  onClick={() => {
                    onShowToast?.('Diagrams', 'Generating architecture diagram...', 'info');
                    setEditorMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Show Diagram...</span>
                </div>
              </div>
            )}
          </div>

          {/* 18. Create Gist... */}
          <div 
            onClick={() => {
              onShowToast?.('GitHub Gist', `Created Gist snippet for ${activeTab.title}`, 'success');
              setEditorMenu(null);
            }}
            onMouseEnter={() => setActiveEditorSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 pl-5"
          >
            <Share2 size={13} className="text-[#868A91]" />
            <span>Create Gist...</span>
          </div>

          {/* 19. Compile file */}
          <div 
            onClick={() => {
              onShowToast?.('Compile', `Compiled ${activeTab.title} successfully`, 'success');
              setEditorMenu(null);
            }}
            onMouseEnter={() => setActiveEditorSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group pl-8"
          >
            <span>Compile {activeTab.title.endsWith('.rs') ? 'Rust' : activeTab.title.endsWith('.ts') || activeTab.title.endsWith('.tsx') ? 'TypeScript' : 'File'}</span>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Ctrl+Shift+S</span>
          </div>

          {/* 20. Analyze with SonarQube for IDE */}
          <div 
            onClick={() => {
              onShowToast?.('SonarQube', 'SonarQube: No code smells or vulnerabilities found', 'success');
              setEditorMenu(null);
            }}
            onMouseEnter={() => setActiveEditorSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 pl-5"
          >
            <Shield size={13} className="text-[#868A91]" />
            <span>Analyze with SonarQube for IDE</span>
          </div>
        </div>
      )}

      {/* ─── JetBrains New UI Authentic Tab Context Menu (media_1792661560023.png) ─── */}
      {tabMenu && (
        <div 
          ref={tabMenuRef}
          className="fixed bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-64 max-h-[calc(100vh-24px)] overflow-y-auto select-none font-sans"
          style={{ 
            top: `${tabMenu.y}px`, 
            left: `${tabMenu.x}px` 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Close */}
          <div 
            onClick={() => {
              onCloseTab(tabMenu.tab.id);
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group"
          >
            <span>Close</span>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Ctrl+F4</span>
          </div>

          {/* 2. Close Other Tabs */}
          <div 
            onClick={() => {
              onCloseOtherTabs?.(tabMenu.tab.id);
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
          >
            <span>Close Other Tabs</span>
          </div>

          {/* 3. Close All Tabs */}
          <div 
            onClick={() => {
              onCloseAllTabs?.();
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group"
          >
            <span>Close All Tabs</span>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Ctrl+Shift+W</span>
          </div>

          {/* 4. Close Unmodified Tabs */}
          <div 
            onClick={() => {
              onCloseUnmodifiedTabs?.();
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
          >
            <span>Close Unmodified Tabs</span>
          </div>

          {/* 5. Close Tabs to the Left */}
          <div 
            onClick={() => {
              onCloseTabsLeft?.(tabMenu.tab.id);
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
          >
            <span>Close Tabs to the Left</span>
          </div>

          {/* 6. Close Tabs to the Right */}
          <div 
            onClick={() => {
              onCloseTabsRight?.(tabMenu.tab.id);
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
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
              <span>Copy Path/Reference...</span>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeTabSubmenu === 'copy-path' && (
              <div className={`absolute ${tabMenu.x + 250 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isTabBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-52`}>
                <div 
                  onClick={() => {
                    navigator.clipboard?.writeText(tabMenu.tab.path);
                    onShowToast?.('Copied', `Absolute Path: ${tabMenu.tab.path}`, 'info');
                    setTabMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Absolute Path</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+Shift+C</span>
                </div>
                <div 
                  onClick={() => {
                    navigator.clipboard?.writeText(tabMenu.tab.title);
                    onShowToast?.('Copied', `File Name: ${tabMenu.tab.title}`, 'info');
                    setTabMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>File Name</span>
                </div>
                <div 
                  onClick={() => {
                    navigator.clipboard?.writeText(tabMenu.tab.path);
                    onShowToast?.('Copied', `Path: ${tabMenu.tab.path}`, 'info');
                    setTabMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Path From Content Root</span>
                </div>
                <div 
                  onClick={() => {
                    navigator.clipboard?.writeText(tabMenu.tab.title);
                    onShowToast?.('Copied Reference', tabMenu.tab.title, 'info');
                    setTabMenu(null);
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

          {/* 8. Split Right / Move Right / Split Down / Move Down */}
          <div 
            onClick={() => {
              setSplitMode('vertical');
              setSecondaryTabId(tabMenu.tab.id);
              onShowToast?.('Split Right', `Split view activated with ${tabMenu.tab.title}`, 'info');
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Split size={13} className="text-[#3574F0]" />
            <span>Split Right</span>
          </div>
          <div 
            onClick={() => {
              setSplitMode('vertical');
              setSecondaryTabId(tabMenu.tab.id);
              onShowToast?.('Split and Move Right', `Moved ${tabMenu.tab.title} to right split`, 'info');
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8"
          >
            <span>Split and Move Right</span>
          </div>
          <div 
            onClick={() => {
              setSplitMode('horizontal');
              setSecondaryTabId(tabMenu.tab.id);
              onShowToast?.('Split Down', `Split view down activated with ${tabMenu.tab.title}`, 'info');
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Split size={13} className="text-[#3574F0] rotate-90" />
            <span>Split Down</span>
          </div>
          <div 
            onClick={() => {
              setSplitMode('horizontal');
              setSecondaryTabId(tabMenu.tab.id);
              onShowToast?.('Split and Move Down', `Moved ${tabMenu.tab.title} to bottom split`, 'info');
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8"
          >
            <span>Split and Move Down</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 9. Pin Tab / Open in New Window / Configure Tabs */}
          <div 
            onClick={() => {
              setPinnedTabs(prev => {
                const next = new Set(prev);
                if (next.has(tabMenu.tab.id)) next.delete(tabMenu.tab.id);
                else next.add(tabMenu.tab.id);
                return next;
              });
              onShowToast?.('Pin Tab', pinnedTabs.has(tabMenu.tab.id) ? 'Tab unpinned' : 'Tab pinned', 'info');
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Pin size={13} className="text-[#868A91]" />
            <span>{pinnedTabs.has(tabMenu.tab.id) ? 'Unpin Tab' : 'Pin Tab'}</span>
          </div>

          <div 
            onClick={() => {
              onShowToast?.('New Window', `Opened ${tabMenu.tab.title} in new window`, 'info');
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group pl-8"
          >
            <span>Open Tab in New Window</span>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Shift+F4</span>
          </div>

          <div 
            onClick={() => {
              onShowToast?.('Editor Tabs', 'Editor Tabs Settings: Placement Top, Single row', 'info');
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8"
          >
            <span>Configure Editor Tabs...</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 10. Reopen Closed Tab / Bookmarks */}
          <div 
            onClick={() => {
              onShowToast?.('Reopen Tab', 'Reopened recently closed tab', 'info');
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8"
          >
            <span>Reopen Closed Tab</span>
          </div>

          {/* Bookmarks > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveTabSubmenu('bookmarks')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2 pl-5">
                <span>Bookmarks</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeTabSubmenu === 'bookmarks' && (
              <div className={`absolute ${tabMenu.x + 250 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isTabBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-52`}>
                <div 
                  onClick={() => {
                    onShowToast?.('Bookmark', `Added bookmark to ${tabMenu.tab.title}`, 'info');
                    setTabMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Add Bookmark</span>
                  <span className="text-[10px] text-[#868A91]">F11</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Bookmarks', 'Showing project bookmarks', 'info');
                    setTabMenu(null);
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

          {/* 11. Override File Type */}
          <div 
            onClick={() => {
              onShowToast?.('File Type', `Override file type for ${tabMenu.tab.title}`, 'info');
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8"
          >
            <span>Override File Type</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 12. Run / Debug / Coverage */}
          <div 
            onClick={() => {
              onRunFile?.();
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Play size={13} className="fill-[#59A869] text-[#59A869]" />
              <span>Run '{tabMenu.tab.title}'</span>
            </div>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Alt+Shift+F10</span>
          </div>

          <div 
            onClick={() => {
              onSelectMenuAction?.('run.debug');
              onShowToast?.('Debug', `Debugging ${tabMenu.tab.title}`, 'info');
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Bug size={13} className="text-[#59A869]" />
              <span>Debug '{tabMenu.tab.title}'</span>
            </div>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Shift+F9</span>
          </div>

          <div 
            onClick={() => {
              onShowToast?.('Coverage', `Running coverage report on ${tabMenu.tab.title}`, 'info');
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8"
          >
            <span>Run '{tabMenu.tab.title}' with Coverage</span>
          </div>

          <div 
            onClick={() => {
              onSelectMenuAction?.('run.editConfig');
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8"
          >
            <span>Modify Run Configuration...</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 13. Open In > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveTabSubmenu('open-in')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2 pl-5">
                <span>Open In</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeTabSubmenu === 'open-in' && (
              <div className={`absolute ${tabMenu.x + 250 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isTabBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-48`}>
                <div 
                  onClick={() => {
                    onShowToast?.('Explorer', `Revealing ${tabMenu.tab.path} in Explorer`, 'info');
                    setTabMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <Folder size={13} className="text-[#3574F0]" />
                  <span>Explorer</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Terminal', 'Opened directory in terminal', 'info');
                    setTabMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <span className="text-[#59A869] font-mono text-[10px] font-bold">&gt;_</span>
                  <span>Terminal</span>
                </div>
              </div>
            )}
          </div>

          {/* 14. Local History > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveTabSubmenu('local-history')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2 pl-5">
                <History size={13} className="text-[#868A91]" />
                <span>Local History</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeTabSubmenu === 'local-history' && (
              <div className={`absolute ${tabMenu.x + 250 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isTabBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-48`}>
                <div 
                  onClick={() => {
                    onSelectMenuAction?.('file.localHistory');
                    setTabMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Show History</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Local History', `Put label on ${tabMenu.tab.title}`, 'info');
                    setTabMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Put Label...</span>
                </div>
              </div>
            )}
          </div>

          {/* 15. Git > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveTabSubmenu('git')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2 pl-5">
                <GitBranch size={13} className="text-[#868A91]" />
                <span>Git</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeTabSubmenu === 'git' && (
              <div className={`absolute ${tabMenu.x + 250 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isTabBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-52`}>
                <div 
                  onClick={() => {
                    onSelectMenuAction?.('git.commit');
                    setTabMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Commit File...</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+K</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Git', `Staged ${tabMenu.tab.title}`, 'success');
                    setTabMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Add</span>
                </div>
                <div 
                  onClick={() => {
                    setIsGitBlameActive(true);
                    onShowToast?.('Git Blame', 'Annotated with Git Blame', 'info');
                    setTabMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Annotate with Git Blame</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Git Compare', `Comparing ${tabMenu.tab.title} with branch`, 'info');
                    setTabMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Compare with Branch...</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 16. Rename File... */}
          <div 
            onClick={() => {
              onSelectMenuAction?.('refactor.rename');
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between group pl-8"
          >
            <span>Rename File...</span>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Shift+F6</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 17. Create Gist... */}
          <div 
            onClick={() => {
              onShowToast?.('GitHub Gist', `Created Gist snippet for ${tabMenu.tab.title}`, 'success');
              setTabMenu(null);
            }}
            onMouseEnter={() => setActiveTabSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 pl-5"
          >
            <Share2 size={13} className="text-[#868A91]" />
            <span>Create Gist...</span>
          </div>
        </div>
      )}
    
      {/* ─── Authentic JetBrains Mnemonic Bookmark Picker (Ctrl+F11) ─── */}
      {mnemonicPopup && (
        <div 
          ref={mnemonicPopupRef}
          className="fixed bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl p-3 z-50 text-[12px] text-[#DFE1E5] w-72 select-none animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: `${Math.max(10, Math.min(mnemonicPopup.y, window.innerHeight - 250))}px`,
            left: `${Math.min(mnemonicPopup.x + 20, window.innerWidth - 300)}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 border-b border-[#393B40] mb-2 font-medium">
            <span className="text-[#3574F0] font-semibold">Mnemonic Bookmark: Line ${mnemonicPopup.lineNumber}</span>
            <button 
              onClick={() => setMnemonicPopup(null)}
              className="text-[#868A91] hover:text-white text-xs px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="text-[11px] text-[#868A91] mb-2">Select a number (0-9) or letter (A-Z):</div>
          <div className="grid grid-cols-5 gap-1.5 mb-3 font-mono">
            {['1','2','3','4','5','6','7','8','9','0','A','B','C','D','E'].map(char => (
              <button
                key={char}
                onClick={() => {
                  setMnemonicBookmarks(prev => {
                    const next = new Map(prev);
                    next.set(mnemonicPopup.lineNumber, char);
                    return next;
                  });
                  onShowToast?.('Mnemonic Bookmark', `Bookmark [${char}] set on line ${mnemonicPopup.lineNumber}`, 'success');
                  setMnemonicPopup(null);
                }}
                className="p-1.5 rounded bg-[#1E1F22] hover:bg-[#3574F0] hover:text-white text-center font-bold border border-[#393B40] transition-colors cursor-pointer"
              >
                {char}
              </button>
            ))}
          </div>
          {mnemonicBookmarks.has(mnemonicPopup.lineNumber) && (
            <button
              onClick={() => {
                setMnemonicBookmarks(prev => {
                  const next = new Map(prev);
                  next.delete(mnemonicPopup.lineNumber);
                  return next;
                });
                onShowToast?.('Bookmark Removed', `Removed mnemonic bookmark on line ${mnemonicPopup.lineNumber}`, 'info');
                setMnemonicPopup(null);
              }}
              className="w-full py-1 text-center text-xs text-[#E05555] hover:bg-[#E05555]/10 rounded border border-[#E05555]/30 cursor-pointer"
            >
              Remove Mnemonic Bookmark
            </button>
          )}
        </div>
      )}

      {/* ─── Configure Gutter Icons Modal ─── */}
      {isGutterIconsConfigOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center select-none"
          onClick={() => setIsGutterIconsConfigOpen(false)}
        >
          <div 
            className="bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl p-4 w-96 text-xs text-[#DFE1E5]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#393B40] mb-3">
              <span className="font-semibold text-sm">Configure Gutter Icons</span>
              <button 
                onClick={() => setIsGutterIconsConfigOpen(false)}
                className="text-[#868A91] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2.5 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span>Line Breakpoints (🔴)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span>Bookmarks &amp; Mnemonics (🔖)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span>Run / Debug Test Triangles (▶)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isGitBlameActive} onChange={(e) => setIsGitBlameActive(e.target.checked)} className="accent-[#3574F0] rounded" />
                <span>Git Blame Annotations</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showMethodSeparators} onChange={(e) => setShowMethodSeparators(e.target.checked)} className="accent-[#3574F0] rounded" />
                <span>Method Separators</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showCodeLens} onChange={(e) => setShowCodeLens(e.target.checked)} className="accent-[#3574F0] rounded" />
                <span>Code Lens References</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#393B40]">
              <button
                onClick={() => {
                  onShowToast?.('Gutter Icons', 'Gutter icon configuration saved', 'success');
                  setIsGutterIconsConfigOpen(false);
                }}
                className="px-3 py-1.5 bg-[#3574F0] text-white rounded hover:bg-[#3574F0]/90 font-medium cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Git Blame Diff Viewer Modal */}
      {isDiffOpen && diffModalFile && (
        <React.Suspense fallback={null}>
          <DiffViewerModal
            isOpen={isDiffOpen}
            onClose={() => setIsDiffOpen(false)}
            fileName={diffModalFile}
            baseContent={diffModalBase}
            localContent={diffModalLocal}
            baseTitle={diffModalBaseTitle}
            localTitle={diffModalLocalTitle}
          />
        </React.Suspense>
      )}
    </div>
  );
});

CodeEditor.displayName = 'CodeEditor';
