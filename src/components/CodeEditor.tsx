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
  Pin
} from 'lucide-react';
import { OpenTab } from '../types';
import { intellijNewUIDarkTheme } from '../themes/intellijTheme';
import { vueLanguageConfiguration, vueMonarchTokensProvider } from '../languages/vue';
import { IdeSettings } from './SettingsModal';

export interface CodeEditorHandle {
  formatDocument: () => void;
  commentLine: () => void;
  foldAll: () => void;
  unfoldAll: () => void;
  goToLine: (line: number, column: number) => void;
  triggerFind: () => void;
  triggerReplace: () => void;
  duplicateLine: () => void;
  getMaxLine: () => number;
  toggleGitBlame: () => void;
  getWordAtCursor: () => string;
  revealPosition: (line: number, column: number, selectLength?: number) => void;
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

interface CodeEditorProps {
  tabs: OpenTab[];
  activeTabId: string | null;
  settings?: IdeSettings;
  isReadOnly?: boolean;
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
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(({
  tabs,
  activeTabId,
  settings,
  isReadOnly = false,
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
}, ref) => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Gutter & Blame States
  const [isGitBlameActive, setIsGitBlameActive] = useState(false);
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

  // JetBrains Authentic Tab Context Menu State (media_1792661560023.png)
  const [tabMenu, setTabMenu] = useState<{
    x: number;
    y: number;
    tab: OpenTab;
  } | null>(null);
  const [activeTabSubmenu, setActiveTabSubmenu] = useState<string | null>(null);
  const tabMenuRef = useRef<HTMLDivElement>(null);
  const [pinnedTabs, setPinnedTabs] = useState<Set<string>>(new Set());

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
      editorRef.current?.getAction('editor.action.copyLinesDownAction')?.run();
    },
    getMaxLine: () => {
      return editorRef.current?.getModel()?.getLineCount() || 1;
    },
    toggleGitBlame: () => {
      setIsGitBlameActive(prev => !prev);
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
    }
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

  const handleEditorWillMount = (monaco: Monaco) => {
    monaco.editor.defineTheme('intellij-new-ui-dark', intellijNewUIDarkTheme);

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

    // Add IntelliJ keyboard shortcuts directly to Monaco editor
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.F7, () => {
      const sym = getWordUnderCursor();
      if (sym) onFindUsages?.(sym);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.F7, () => {
      const sym = getWordUnderCursor();
      if (sym) onShowUsages?.(sym);
    });

    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F6, () => {
      const sym = getWordUnderCursor();
      onRenameSymbol?.(sym);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => {
      onOpenGoToLine?.();
    });

    const lh = editor.getOption(monaco.editor.EditorOption.lineHeight);
    if (lh) setLineHeightPx(lh);

    editor.onDidChangeCursorPosition((e: any) => {
      if (onCursorChange) {
        onCursorChange(e.position.lineNumber, e.position.column);
      }
    });

    editor.onDidScrollChange((e: any) => {
      setScrollTop(e.scrollTop);
    });

    // Intercept right-click on Monaco editor (gutter vs code)
    editor.onContextMenu((e: any) => {
      e.event?.preventDefault?.();
      e.event?.stopPropagation?.();

      const targetType = e.target?.type;
      const isGutter = targetType === 2 || targetType === 3 || targetType === 4 ||
        e.target?.element?.classList?.contains('line-numbers') ||
        e.target?.element?.closest?.('.margin');

      const line = e.target?.position?.lineNumber || 1;
      const col = e.target?.position?.column || 1;

      if (isGutter) {
        setEditorMenu(null);
        setGutterMenu({
          x: e.event.posx,
          y: e.event.posy,
          lineNumber: line,
        });
        setActiveGutterSubmenu(null);
      } else {
        setGutterMenu(null);
        const estimatedHeight = 650;
        const estimatedWidth = 260;
        let posX = Math.min(e.event.posx, window.innerWidth - estimatedWidth - 16);
        let posY = e.event.posy;
        if (e.event.posy + estimatedHeight > window.innerHeight - 16) {
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
      if (editorMenuRef.current && !editorMenuRef.current.contains(e.target as Node)) {
        setEditorMenu(null);
        setActiveEditorSubmenu(null);
      }
      if (tabMenuRef.current && !tabMenuRef.current.contains(e.target as Node)) {
        setTabMenu(null);
        setActiveTabSubmenu(null);
      }
      setGutterMenu(null);
      setActiveGutterSubmenu(null);
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

  // Update Monaco decorations for bookmarks
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    try {
      const decorations = Array.from(bookmarks).map(line => ({
        range: new monacoRef.current!.Range(line, 1, line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: 'monaco-bookmark-indicator',
          glyphMarginHoverMessage: { value: `**Bookmark** on line ${line}` },
        }
      }));
      editorRef.current.createDecorationsCollection?.(decorations);
    } catch (err) {
      // ignore
    }
  }, [bookmarks]);

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

  const getTabIcon = (fileName: string) => {
    const lower = fileName.toLowerCase();
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
                {getTabIcon(tab.title)}

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
            onClick={() => onShowToast?.('Editor Split', 'Split view toggled', 'info')}
            title="Split Right" 
            className="p-1 hover:bg-[#2B2D30] hover:text-[#DFE1E5] rounded transition-colors cursor-pointer"
          >
            <Split size={13} />
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

      {/* ─── 3. Monaco Editor Core & Git Blame Column ─── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Git Blame Annotation Column (Annotate with Git Blame) */}
        {isGitBlameActive && (
          <div 
            className="w-56 bg-[#212225] border-r border-[#393B40] flex flex-col select-none relative overflow-hidden text-[11px] font-mono z-10 flex-shrink-0"
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
            {/* Blame Header */}
            <div className="h-6 bg-[#2B2D30] border-b border-[#393B40] px-2 flex items-center justify-between text-[10px] text-[#868A91] font-sans">
              <span className="font-semibold text-[#DFE1E5] truncate">Git Blame: {activeTab.title}</span>
              <button 
                onClick={() => {
                  setIsGitBlameActive(false);
                  onShowToast?.('Git Blame', 'Annotation closed', 'info');
                }}
                className="hover:text-white px-1 text-sm leading-none"
                title="Close Annotations"
              >
                ×
              </button>
            </div>

            {/* Scrolling Lines */}
            <div className="flex-1 relative overflow-hidden">
              <div 
                className="absolute left-0 right-0 top-0 will-change-transform"
                style={{ transform: `translateY(-${scrollTop}px)` }}
              >
                {getBlameDataForFile(activeTab.title, activeTab.content.split('\n').length || 1).map((entry) => {
                  const isBookmarked = bookmarks.has(entry.line);
                  const isHovered = hoveredBlameLine === entry.line;
                  return (
                    <div
                      key={entry.line}
                      onMouseEnter={() => setHoveredBlameLine(entry.line)}
                      onMouseLeave={() => setHoveredBlameLine(null)}
                      style={{ height: `${lineHeightPx}px` }}
                      className={`flex items-center justify-between px-2 text-[11px] cursor-pointer transition-colors relative group ${
                        isHovered ? 'bg-[#2E436E] text-white' : 'text-[#868A91] hover:text-[#DFE1E5]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {isBookmarked && (
                          <Bookmark size={10} className="text-[#3574F0] fill-[#3574F0] flex-shrink-0" />
                        )}
                        <span className="text-[#A8ADBD] font-medium text-[10px] w-12 truncate flex-shrink-0">{entry.relativeTime}</span>
                        <span className="truncate max-w-[80px]">{entry.author}</span>
                      </div>
                      <span className="text-[10px] text-[#59A869] font-mono opacity-70 group-hover:opacity-100 flex-shrink-0">
                        {entry.commitHash.substring(0, 7)}
                      </span>

                      {/* JetBrains Commit Info Tooltip Balloon */}
                      {isHovered && (
                        <div 
                          className="fixed ml-2 w-72 bg-[#2B2D30] border border-[#393B40] rounded shadow-2xl p-2.5 z-50 text-xs font-sans text-[#DFE1E5] pointer-events-none"
                          style={{
                            left: `${gutterMenu ? gutterMenu.x : 280}px`,
                            top: `${Math.min(window.innerHeight - 150, Math.max(100, entry.line * lineHeightPx - scrollTop + 80))}px`,
                          }}
                        >
                          <div className="flex items-center justify-between mb-1 text-[11px]">
                            <span className="text-[#3574F0] font-semibold">Commit {entry.commitHash}</span>
                            <span className="text-[#868A91] text-[10px]">{entry.dateStr}</span>
                          </div>
                          <div className="text-[11px] text-[#A8ADBD] mb-1">
                            Author: <span className="text-white font-medium">{entry.author}</span> &lt;{entry.email}&gt;
                          </div>
                          <div className="text-[11px] text-[#DFE1E5] bg-[#1E1F22] p-1.5 rounded border border-[#393B40]/50 my-1 font-mono text-[10.5px]">
                            {entry.message}
                          </div>
                          <div className="text-[10px] text-[#868A91] italic mt-1">
                            Right-click gutter to configure annotations
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Monaco Editor Core */}
        <div className="flex-1 relative h-full">
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
        </div>
      </div>

      {/* ─── JetBrains Gutter Context Menu (media_1792658742200.png) ─── */}
      {gutterMenu && (
        <div 
          className="fixed bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-64 select-none"
          style={{ 
            top: `${Math.max(10, Math.min(gutterMenu.y, window.innerHeight - 340))}px`, 
            left: `${Math.min(gutterMenu.x, window.innerWidth - 270)}px` 
          }}
          onClick={(e) => e.stopPropagation()}
        >
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

          {/* 2. Disable Recording Time with Run to Cursor */}
          <div 
            onClick={() => {
              onShowToast?.('Run to Cursor', 'Recording time disabled', 'info');
              setGutterMenu(null);
            }}
            onMouseEnter={() => setActiveGutterSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8 text-[#A8ADBD] hover:text-white"
          >
            <span>Disable Recording Time with Run to Cursor</span>
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
              onShowToast?.('Mnemonic Bookmark', `Set mnemonic bookmark on line ${gutterMenu.lineNumber}`, 'info');
              setGutterMenu(null);
            }}
            onMouseEnter={() => setActiveGutterSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between pl-8 group"
          >
            <span>Add Mnemonic Bookmark...</span>
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
                    onShowToast?.('Method Separators', 'Method separators toggled', 'info');
                    setGutterMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-7"
                >
                  <span>Show Method Separators</span>
                </div>

                <div 
                  onClick={() => {
                    onShowToast?.('Code Lens', 'Code Lens references enabled', 'info');
                    setGutterMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-7"
                >
                  <span>Show Code Lens</span>
                </div>
              </div>
            )}
          </div>

          {/* 8. Configure Gutter Icons... */}
          <div 
            onClick={() => {
              onShowToast?.('Gutter Icons', 'All gutter icons enabled (run, tests, breakpoints, bookmarks)', 'info');
              setGutterMenu(null);
            }}
            onMouseEnter={() => setActiveGutterSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer pl-8"
          >
            <span>Configure Gutter Icons...</span>
          </div>
        </div>
      )}

      {/* ─── Backdrop overlay so clicking anywhere immediately closes context menus ─── */}
      {(editorMenu || gutterMenu || tabMenu) && (
        <div 
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => {
            setEditorMenu(null);
            setActiveEditorSubmenu(null);
            setGutterMenu(null);
            setActiveGutterSubmenu(null);
            setTabMenu(null);
            setActiveTabSubmenu(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setEditorMenu(null);
            setActiveEditorSubmenu(null);
            setGutterMenu(null);
            setActiveGutterSubmenu(null);
            setTabMenu(null);
            setActiveTabSubmenu(null);
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
              onShowToast?.('Split Right', `Split ${tabMenu.tab.title} right`, 'info');
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
              onShowToast?.('Split Down', `Split ${tabMenu.tab.title} down`, 'info');
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
              onShowToast?.('Split and Move Down', `Moved ${tabMenu.tab.title} down`, 'info');
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
    </div>
  );
});

CodeEditor.displayName = 'CodeEditor';
