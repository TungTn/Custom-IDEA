import React, { useRef, useImperativeHandle, forwardRef } from 'react';
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
  File
} from 'lucide-react';
import { OpenTab } from '../types';
import { intellijNewUIDarkTheme } from '../themes/intellijTheme';
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
}

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
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(({
  tabs,
  activeTabId,
  settings,
  isReadOnly = false,
  onSelectTab,
  onCloseTab,
  onChangeContent,
  onCursorChange,
  onShowToast,
}, ref) => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  const editorRef = useRef<any>(null);

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
    }
  }));

  const handleEditorWillMount = (monaco: Monaco) => {
    monaco.editor.defineTheme('intellij-new-ui-dark', intellijNewUIDarkTheme);
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e: any) => {
      if (onCursorChange) {
        onCursorChange(e.position.lineNumber, e.position.column);
      }
    });
  };

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
  const minimapEnabled = settings?.minimap ?? true;
  const lineNumbersMode = (settings?.lineNumbers ?? true) ? 'on' : 'off';
  const wordWrapMode = (settings?.wordWrap ?? false) ? 'on' : 'off';
  const theme = settings?.theme || 'intellij-new-ui-dark';
  const fontFamily = settings?.fontFamily ? `"${settings.fontFamily}", Consolas, monospace` : '"JetBrains Mono", Consolas, monospace';
  const lineHeight = settings?.lineHeight ? Math.round(fontSize * settings.lineHeight) : Math.round(fontSize * 1.55);
  const fontLigatures = settings?.ligatures ?? true;

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] overflow-hidden">
      {/* ─── 1. Editor Tabs Bar (New UI) ─── */}
      <div className="h-9 bg-[#2B2D30] border-b border-[#393B40] flex items-center justify-between select-none overflow-x-auto">
        <div className="flex items-center h-full">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 px-3 h-full cursor-pointer text-[12px] border-r border-[#393B40] transition-colors relative group ${
                  isActive
                    ? 'bg-[#1E1F22] text-[#DFE1E5] font-medium'
                    : 'bg-[#2B2D30] text-[#868A91] hover:bg-[#35373B] hover:text-[#DFE1E5]'
                }`}
              >
                {/* Active Indicator Top/Bottom */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3574F0]" />
                )}

                {/* File Icon */}
                {getTabIcon(tab.title)}

                {/* File Name */}
                <span className="truncate max-w-[140px]">{tab.title}</span>

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
                  className="p-0.5 rounded hover:bg-[#393B40] text-[#868A91] hover:text-[#DFE1E5] opacity-70 group-hover:opacity-100 transition-opacity"
                  title="Close (Ctrl+W)"
                >
                  <X size={12} />
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
            className="p-1 hover:bg-[#35373B] hover:text-[#DFE1E5] rounded transition-colors"
          >
            <Split size={13} />
          </button>
          <button 
            onClick={() => onShowToast?.('Inspections', 'No errors found in file', 'success')}
            title="Code Analysis: No problems found" 
            className="p-1 hover:bg-[#35373B] text-[#59A869] rounded transition-colors flex items-center gap-1"
          >
            <CheckCircle2 size={13} />
          </button>
          <button 
            title="More Options" 
            className="p-1 hover:bg-[#35373B] hover:text-[#DFE1E5] rounded transition-colors"
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

      {/* ─── 3. Monaco Editor Core ─── */}
      <div className="flex-1 relative">
        <Editor
          height="100%"
          language={activeTab.language}
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
            lineHeight,
            fontLigatures,
            minimap: { enabled: minimapEnabled },
            lineNumbers: lineNumbersMode,
            wordWrap: wordWrapMode,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            renderLineHighlight: 'all',
            bracketPairColorization: { enabled: true },
            formatOnPaste: true,
            formatOnType: true,
            automaticLayout: true,
            contextmenu: true,
            cursorSmoothCaretAnimation: 'on',
            folding: true,
          }}
        />
      </div>
    </div>
  );
});

CodeEditor.displayName = 'CodeEditor';
