import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { EditorState, Extension, Compartment, Transaction } from '@codemirror/state';
import {
  EditorView,
  keymap,
  highlightSpecialChars,
  drawSelection,
  highlightActiveLine,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  lineNumbers,
  highlightActiveLineGutter,
} from '@codemirror/view';
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap,
  foldAll,
  unfoldAll,
  foldCode,
  unfoldCode,
} from '@codemirror/language';
import { defaultKeymap, history, historyKeymap, blockComment, undo, redo } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, snippet } from '@codemirror/autocomplete';
import { languages } from '@codemirror/language-data';
import { vim } from '@replit/codemirror-vim';
import { darculaTheme } from './cm/darculaTheme';
import { intellijLightTheme } from './cm/intellijLightTheme';
import { importIntelliJTheme } from './cm/themeImporter';
import { intellijCustomKeymap } from './cm/intellijKeymap';
import { IdeThemeId } from '../types/theme';
import { getThemeById, buildCodeMirrorTheme } from '../themes/themeManager';
import {
  createLspAutocompletion,
  createLspHoverTooltip,
  createLspSignatureHelp,
  createLspDiagnostics,
  createLspKeymap,
  createLspCodeActionKeymap,
  createLspRenameKeymap,
  createLspMouseHandler,
  triggerGoToDefinition,
} from './cm/lspExtension';
import { LspCodeAction, LspTextEdit, LspRange, pathToUri } from '../services/lspService';
import { createCoverageGutter, FileCoverageData } from './cm/coverageGutter';
import { createIndentGuides } from './cm/indentGuides';
import { createOccurrencesHighlighter } from './cm/occurrencesHighlighter';
import { ErrorStripeBar, StripeDiagnostic, StripeOccurrence } from './cm/ErrorStripeBar';
import { EditorBreadcrumbs } from './EditorBreadcrumbs';
import {
  Sparkles,
  Code,
  Search,
  Edit3,
  AlignLeft,
  Scissors,
  Copy,
  Clipboard,
  Undo,
  Redo,
  Layers,
  Lightbulb,
  ChevronRight,
  Play,
  Bug,
  Settings,
  History,
  GitBranch,
  Columns,
  FoldHorizontal,
  Plus,
  Check,
  X,
} from 'lucide-react';
import { lspService } from '../services/lspService';
import { useEditorStore } from '../stores/editorStore';
import { Breakpoint, OpenTab } from '../types';
import { createBreakpointGutter, createActiveLineHighlighter } from './cm/breakpointGutter';
import { createGitBlameGutter } from './cm/gitBlameGutter';
import { createGitDiffGutter, parseGitDiff, GitDiffType } from './cm/gitDiffGutter';
import { colorPickerExtension } from './cm/colorPickerExtension';
import { GitBlameLineDto } from '../bindings';
import { createLocalAiExtension } from './cm/localAiExtension';
import { createCodeLensExtension } from './cm/codeLensExtension';
import { AiInlinePromptBar } from '../features/ai/AiInlinePromptBar';
import { StickyScope, getEnclosingScopes } from './cm/stickyScroll';
import { createRainbowBracketsExtension } from './cm/rainbowBrackets';
import { createSonarLinterExtension } from './cm/sonarLinter';
import { usePluginStore } from '../stores/pluginStore';

export interface CmEditorHandle {
  goToLine: (line: number, col?: number) => void;
  formatDocument: () => void | Promise<void>;
  commentLine: () => void;
  commentBlock: () => void;
  optimizeImports: () => void;
  duplicateLine: () => void;
  deleteLine: () => void;
  triggerFind: () => void;
  triggerReplace: () => void;
  triggerInlineAi: () => void;
  getWordAtCursor: () => string;
  getContent: () => string;
  focus: () => void;
  showContextActions: () => void;
  triggerRename: () => void;
  surroundWith: (type: string) => void;
  insertSnippet: (code: string) => void;
  foldAll: () => void;
  unfoldAll: () => void;
  undo: () => void;
  redo: () => void;
}

interface CmEditorProps {
  content: string;
  filePath: string;
  language?: string;
  isReadOnly?: boolean;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  ligatures?: boolean;
  tabSize?: number;
  vimMode?: boolean;
  theme?: IdeThemeId;
  customThemeJson?: string;
  showGitBlame?: boolean;
  blameData?: GitBlameLineDto[];
  coverageData?: FileCoverageData | null;
  onOpenGitCommit?: (commitHash: string) => void;
  breakpoints?: Breakpoint[];
  activePausedLine?: { filePath: string; line: number } | null;
  onChange?: (newContent: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  onSave?: () => void;
  onToggleBreakpoint?: (lineNumber: number) => void;
  onGutterContextMenu?: (e: MouseEvent, lineNumber: number) => void;
  onTriggerRename?: (word: string, line: number, character: number) => void;
  onFindUsages?: (symbol: string) => void;
  onOpenSurroundWith?: () => void;
  onRunFile?: () => void;
  onToggleGitBlame?: () => void;
  projectPath?: string;
  onOpenFileAtLocation?: (filePath: string, line: number, col: number) => void;
  onOpenAiDrawer?: (initialPrompt?: string) => void;
  onSelectMenuAction?: (actionId: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  keymapProfile?: 'windows' | 'macos' | 'vscode' | 'eclipse' | 'netbeans';
}

function resolveEditorTheme(themeId?: IdeThemeId, customThemeJsonStr?: string): Extension {
  if (customThemeJsonStr) {
    const imported = importIntelliJTheme(customThemeJsonStr);
    if (imported?.extension) return imported.extension;
  }
  const themeDef = getThemeById(themeId || 'intellij-new-ui-dark');
  return buildCodeMirrorTheme(themeDef);
}

export const CmEditor = forwardRef<CmEditorHandle, CmEditorProps>(
  (
    {
      content,
      filePath,
      language,
      projectPath,
      isReadOnly = false,
      fontSize = 14,
      fontFamily = 'JetBrains Mono',
      lineHeight = 1.45,
      ligatures = true,
      tabSize = 4,
      vimMode = false,
      theme,
      customThemeJson,
      showGitBlame = false,
      blameData = [],
      coverageData = null,
      onOpenGitCommit,
      breakpoints = [],
      activePausedLine = null,
      onChange,
      onCursorChange,
      onSave,
      onToggleBreakpoint,
      onGutterContextMenu,
      onTriggerRename,
      onFindUsages,
      onOpenSurroundWith,
      onRunFile,
      onToggleGitBlame,
      onOpenFileAtLocation,
      onOpenAiDrawer,
      onSelectMenuAction,
      onShowToast,
      keymapProfile,
    },
    ref
  ) => {
    const activeKeymap = keymapProfile || (typeof window !== 'undefined' ? (localStorage.getItem('intellij_keymap_profile') as any) : 'windows') || 'windows';
    const formatShortcutLabel = activeKeymap === 'netbeans' ? 'Alt+Shift+F' : activeKeymap === 'vscode' ? 'Shift+Alt+F' : activeKeymap === 'eclipse' ? 'Ctrl+Shift+F' : 'Ctrl+Alt+L';

    const isPluginActive = usePluginStore((s) => s.isPluginActive);
    const isRainbowActive = isPluginActive('rainbow-brackets');
    const isSonarActive = isPluginActive('sonar') || isPluginActive('sonarqube') || isPluginActive('sonarlint');

    const [editorContextMenu, setEditorContextMenu] = useState<{
      x: number;
      y: number;
      word: string;
    } | null>(null);
    const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
    const [isColumnSelectionMode, setIsColumnSelectionMode] = useState(false);
    const [codeActionsPopup, setCodeActionsPopup] = useState<{
      actions: LspCodeAction[];
      x: number;
      y: number;
      diagnostic?: StripeDiagnostic | null;
    } | null>(null);
    const [fileDiagnostics, setFileDiagnostics] = useState<StripeDiagnostic[]>([]);
    const [occurrences, setOccurrences] = useState<StripeOccurrence[]>([]);
    const [cursorLine, setCursorLine] = useState(1);
    const [totalDocLines, setTotalDocLines] = useState(1);

    const [stickyScopes, setStickyScopes] = useState<StickyScope[]>([]);
    const [inPlaceRename, setInPlaceRename] = useState<{
      isOpen: boolean;
      word: string;
      newName: string;
      from: number;
      to: number;
      position: { top: number; left: number };
    }>({
      isOpen: false,
      word: '',
      newName: '',
      from: 0,
      to: 0,
      position: { top: 20, left: 20 },
    });

    const startInPlaceRename = useCallback((explicitWord?: string, explicitFrom?: number, explicitTo?: number) => {
      const view = viewRef.current;
      if (!view) return;
      const head = view.state.selection.main.head;
      const wordRange = explicitWord ? { from: explicitFrom ?? head, to: explicitTo ?? head } : view.state.wordAt(head);
      const word = explicitWord || (wordRange ? view.state.sliceDoc(wordRange.from, wordRange.to) : '');
      if (!word.trim()) return;

      const coords = view.coordsAtPos(wordRange?.from ?? head);
      const containerRect = editorContainerRef.current?.getBoundingClientRect();
      const top = coords && containerRect ? Math.max(10, coords.top - containerRect.top - 36) : 20;
      const left = coords && containerRect ? Math.max(10, coords.left - containerRect.left) : 60;

      setInPlaceRename({
        isOpen: true,
        word,
        newName: word,
        from: wordRange?.from ?? head,
        to: wordRange?.to ?? head,
        position: { top, left },
      });
    }, []);

    const handleCommitInPlaceRename = useCallback(async () => {
      const { word, newName, from } = inPlaceRename;
      setInPlaceRename((prev) => ({ ...prev, isOpen: false }));
      if (!word || !newName || word === newName) {
        viewRef.current?.focus();
        return;
      }

      const view = viewRef.current;
      if (view) {
        const line = view.state.doc.lineAt(from);
        onTriggerRename?.(word, line.number, from - line.from + 1);

        const docText = view.state.doc.toString();
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
        const replaced = docText.replace(regex, newName);
        if (replaced !== docText) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: replaced },
          });
          onChange?.(replaced);
        }
        view.focus();
      }
    }, [inPlaceRename, onTriggerRename, onChange]);

    useEffect(() => {
      const handleInPlaceRenameEvent = (e: any) => {
        const { word, from, to } = e.detail || {};
        startInPlaceRename(word, from, to);
      };
      window.addEventListener('intellij:inplace-rename', handleInPlaceRenameEvent);
      return () => {
        window.removeEventListener('intellij:inplace-rename', handleInPlaceRenameEvent);
      };
    }, [startInPlaceRename]);

    const [inlineAiBar, setInlineAiBar] = useState<{
      isOpen: boolean;
      position: { top: number; left: number };
      selectedText: string;
      from: number;
      to: number;
    }>({
      isOpen: false,
      position: { top: 60, left: 100 },
      selectedText: '',
      from: 0,
      to: 0,
    });

    const triggerInlineAi = useCallback((view?: EditorView) => {
      const v = view || viewRef.current;
      if (!v) return;
      const { state } = v;
      const sel = state.selection.main;
      const selectedText = sel.empty ? '' : state.sliceDoc(sel.from, sel.to);
      const coords = v.coordsAtPos(sel.head);
      const rect = v.dom.getBoundingClientRect();
      const top = coords ? coords.bottom - rect.top : 80;
      const left = coords ? coords.left - rect.left : 120;

      setInlineAiBar({
        isOpen: true,
        position: { top, left },
        selectedText,
        from: sel.from,
        to: sel.to,
      });
    }, []);

    const handleAcceptInlineAi = useCallback((generatedCode: string) => {
      const v = viewRef.current;
      if (!v) return;
      const { from, to } = inlineAiBar;
      isDispatchingRef.current = true;
      v.dispatch({
        changes: { from, to, insert: generatedCode },
        selection: { anchor: from + generatedCode.length },
      });
      isDispatchingRef.current = false;
      setInlineAiBar(p => ({ ...p, isOpen: false }));
      onChange?.(v.state.doc.toString());
      v.focus();
    }, [inlineAiBar, onChange]);

    const triggerCodeActions = useCallback((view?: EditorView) => {
      const v = view || viewRef.current;
      if (!v) return;
      const { state } = v;
      const head = state.selection.main.head;
      const line = state.doc.lineAt(head);
      const character = head - line.from;
      const lineZero = line.number - 1;

      const range: LspRange = {
        start: { line: lineZero, character },
        end: { line: lineZero, character },
      };

      const coords = v.coordsAtPos(head);
      const clientX = coords ? coords.left : 120;
      const clientY = coords ? coords.bottom + 4 : 120;

      const diag = fileDiagnostics.find((d) => d.line === line.number) || null;
      const wordRange = state.wordAt(head);
      const word = wordRange ? state.sliceDoc(wordRange.from, wordRange.to) : '';

      lspService
        .getCodeActions(filePath, range)
        .then((actions) => {
          let list: LspCodeAction[] = actions ? [...actions] : [];
          if (diag && diag.message.toLowerCase().includes('cannot find name') && word) {
            list.unshift({
              title: `Create variable '${word}'`,
              isPreferred: true,
              command: { title: 'createVar', command: 'editor.createVar' },
            });
          }
          if (list.length === 0) {
            list = [
              {
                title: `Reformat Code (${formatShortcutLabel})`,
                command: { title: 'format', command: 'editor.format' },
              },
              {
                title: 'Optimize Imports (Ctrl+Alt+O)',
                command: { title: 'optimize', command: 'editor.optimizeImports' },
              },
            ];
          }
          setCodeActionsPopup({ actions: list, x: clientX, y: clientY, diagnostic: diag });
        })
        .catch(() => {});
    }, [filePath, fileDiagnostics]);

    const handleSelectCodeAction = async (action: LspCodeAction) => {
      setCodeActionsPopup(null);
      const view = viewRef.current;
      if (!view) return;

      if (action.command?.command === 'editor.format') {
        handleFormatDocument();
        return;
      }
      if (action.command?.command === 'editor.optimizeImports') {
        handleOptimizeImports();
        return;
      }
      if (action.command?.command === 'editor.createVar') {
        const match = /Create variable '([^']+)'/.exec(action.title);
        const varName = match ? match[1] : '';
        if (varName) {
          const docText = view.state.doc.toString();
          let insertPos = 0;
          const scriptSetupMatch = /<script\s+[^>]*setup[^>]*>/i.exec(docText);
          if (scriptSetupMatch) {
            insertPos = scriptSetupMatch.index + scriptSetupMatch[0].length;
          }
          const snippetToInsert = `\nconst ${varName} = ref(false);\n`;
          isDispatchingRef.current = true;
          view.dispatch({
            changes: { from: insertPos, to: insertPos, insert: snippetToInsert },
          });
          isDispatchingRef.current = false;
          onChange?.(view.state.doc.toString());
        }
        return;
      }

      if (action.edit) {
        const currentUri = pathToUri(filePath).toLowerCase();
        let currentEdits: LspTextEdit[] = [];

        if (action.edit.changes) {
          for (const [uri, edits] of Object.entries(action.edit.changes)) {
            if (uri.toLowerCase() === currentUri) {
              currentEdits = edits;
            }
          }
        } else if (action.edit.documentChanges) {
          for (const dc of action.edit.documentChanges) {
            if (dc.textDocument?.uri.toLowerCase() === currentUri) {
              currentEdits = dc.edits;
            }
          }
        }

        if (currentEdits.length > 0 && view) {
          const doc = view.state.doc;
          const sortedEdits = [...currentEdits].sort((a, b) => {
            if (b.range.start.line !== a.range.start.line) {
              return b.range.start.line - a.range.start.line;
            }
            return b.range.start.character - a.range.start.character;
          });

          const changes = sortedEdits.map((e) => {
            const startLineNum = Math.max(1, Math.min(e.range.start.line + 1, doc.lines));
            const endLineNum = Math.max(1, Math.min(e.range.end.line + 1, doc.lines));
            const startLine = doc.line(startLineNum);
            const endLine = doc.line(endLineNum);
            const from = Math.min(startLine.from + e.range.start.character, startLine.to);
            const to = Math.max(from, Math.min(endLine.from + e.range.end.character, endLine.to));
            return { from, to, insert: e.newText };
          });

          isDispatchingRef.current = true;
          view.dispatch({ changes });
          isDispatchingRef.current = false;
          onChange?.(view.state.doc.toString());
        }

        await lspService.applyWorkspaceEdit(action.edit);
      }
    };

    const editorContainerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const gitBlameCompartmentRef = useRef<Compartment>(new Compartment());
    const breakpointCompartmentRef = useRef<Compartment>(new Compartment());
    const coverageCompartmentRef = useRef<Compartment>(new Compartment());
    const gitDiffCompartmentRef = useRef<Compartment>(new Compartment());
    const themeCompartmentRef = useRef<Compartment>(new Compartment());
    const [gitDiffMap, setGitDiffMap] = useState<Map<number, GitDiffType> | null>(null);
    const isDispatchingRef = useRef(false);

    const handleFormatDocument = useCallback(async () => {
      const view = viewRef.current;
      if (!view) return;

      const doc = view.state.doc;
      const text = doc.toString();

      // 1. Fast & reliable formatting for JSON files
      if (filePath.endsWith('.json')) {
        try {
          const parsed = JSON.parse(text);
          const formatted = JSON.stringify(parsed, null, tabSize || 2);
          if (formatted !== text) {
            isDispatchingRef.current = true;
            view.dispatch({
              changes: { from: 0, to: text.length, insert: formatted },
            });
            isDispatchingRef.current = false;
            onChange?.(formatted);
          }
          return;
        } catch {
          // Ignore parse errors, proceed to fallback
        }
      }

      // 2. Try LSP formatDocument if an LSP server is active
      try {
        const edits = await lspService.formatDocument(filePath, { tabSize, insertSpaces: true });
        if (edits && edits.length > 0) {
          const sortedEdits = [...edits].sort((a, b) => {
            if (b.range.start.line !== a.range.start.line) {
              return b.range.start.line - a.range.start.line;
            }
            return b.range.start.character - a.range.start.character;
          });

          const changes = sortedEdits.map((e) => {
            const startLineNum = Math.max(1, Math.min(e.range.start.line + 1, doc.lines));
            const endLineNum = Math.max(1, Math.min(e.range.end.line + 1, doc.lines));
            const startLine = doc.line(startLineNum);
            const endLine = doc.line(endLineNum);
            const from = Math.min(startLine.from + e.range.start.character, startLine.to);
            const to = Math.max(from, Math.min(endLine.from + e.range.end.character, endLine.to));
            return { from, to, insert: e.newText };
          });

          isDispatchingRef.current = true;
          view.dispatch({ changes });
          isDispatchingRef.current = false;
          onChange?.(view.state.doc.toString());
          return;
        }
      } catch {
        // Fallback to indentation formatter
      }

      // 3. Fallback smart indentation formatter (IntelliJ style with full Vue SFC & DOM support)
      const indentUnit = ' '.repeat(tabSize || 2);
      const lines = text.split('\n');
      let currentIndent = 0;
      let section: 'root' | 'template' | 'script' | 'style' = filePath.endsWith('.html') ? 'template' : 'root';

      const VOID_TAGS = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 
        'link', 'meta', 'param', 'source', 'track', 'wbr'
      ]);

      const formattedLines = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return '';

        // Vue SFC Section boundaries
        if (/^<template\b/i.test(trimmed)) {
          const prevIndent = currentIndent;
          section = 'template';
          currentIndent = 1; // Content inside template indented at 1 level
          return indentUnit.repeat(prevIndent) + trimmed;
        }
        if (/^<\/template>/i.test(trimmed)) {
          section = 'root';
          currentIndent = 0;
          return trimmed;
        }
        if (/^<script\b/i.test(trimmed)) {
          const prevIndent = currentIndent;
          section = 'script';
          currentIndent = 0;
          return indentUnit.repeat(prevIndent) + trimmed;
        }
        if (/^<\/script>/i.test(trimmed)) {
          section = 'root';
          currentIndent = 0;
          return trimmed;
        }
        if (/^<style\b/i.test(trimmed)) {
          const prevIndent = currentIndent;
          section = 'style';
          currentIndent = 0;
          return indentUnit.repeat(prevIndent) + trimmed;
        }
        if (/^<\/style>/i.test(trimmed)) {
          section = 'root';
          currentIndent = 0;
          return trimmed;
        }

        // HTML/DOM Template Indentation
        if (section === 'template') {
          let preDecr = 0;
          // Line starts with closing tag </tag>
          if (/^<\/[a-zA-Z0-9_$-]+>/.test(trimmed)) {
            preDecr = 1;
          }
          // Line starts with multiline tag closure: ">" or "/>"
          if (/^(\/?>)/.test(trimmed)) {
            preDecr = 1;
          }

          const effectiveIndent = Math.max(0, currentIndent - preDecr);
          const result = indentUnit.repeat(effectiveIndent) + trimmed;

          // Calculate indent change for next lines
          let delta = 0;

          // Multiline tag start: <tag ... without > or /> at end of line
          const openTagMatch = trimmed.match(/<([a-zA-Z0-9_$-]+)(?:\s+[^>]*)?$/);
          if (openTagMatch && !trimmed.endsWith('>') && !trimmed.endsWith('/>')) {
            delta += 1;
          }

          // Complete opening tags on this line (excluding self-closing and void tags)
          const openTags = (trimmed.match(/<([a-zA-Z0-9_$-]+)(?:\s+[^>]*?)?>/g) || []).filter(t => {
            if (t.startsWith('</')) return false;
            if (t.endsWith('/>')) return false;
            const tagName = t.replace(/[<>]/g, '').trim().split(/\s+/)[0].toLowerCase();
            return !VOID_TAGS.has(tagName);
          });

          // Complete closing tags on this line
          const closeTags = (trimmed.match(/<\/([a-zA-Z0-9_$-]+)>/g) || []);

          // Closing of multiline tag attributes
          if (/^[^<].*\/?>$/.test(trimmed) && !trimmed.startsWith('</')) {
            if (trimmed.endsWith('/>')) {
              delta -= 1;
            }
          }

          delta += (openTags.length - closeTags.length);
          currentIndent = Math.max(0, currentIndent + delta);

          return result;
        }

        // Script, Style, and General Code (Brace-based indenter)
        let preDecr = 0;
        for (let i = 0; i < trimmed.length; i++) {
          if (trimmed[i] === '}' || trimmed[i] === ']' || trimmed[i] === ')') {
            preDecr++;
          } else {
            break;
          }
        }

        const effectiveIndent = Math.max(0, currentIndent - preDecr);
        const indented = indentUnit.repeat(effectiveIndent) + trimmed;

        let net = 0;
        for (let i = 0; i < trimmed.length; i++) {
          const ch = trimmed[i];
          if (ch === '{' || ch === '[' || ch === '(') net++;
          else if (ch === '}' || ch === ']' || ch === ')') net--;
        }
        currentIndent = Math.max(0, currentIndent + net);

        return indented;
      });

      const newContent = formattedLines.join('\n');
      if (newContent !== text) {
        isDispatchingRef.current = true;
        view.dispatch({
          changes: { from: 0, to: text.length, insert: newContent },
        });
        isDispatchingRef.current = false;
        onChange?.(newContent);
      }
    }, [filePath, tabSize, onChange]);

    const handleOptimizeImports = useCallback(() => {
      const view = viewRef.current;
      if (!view) return;
      const text = view.state.doc.toString();
      const lines = text.split('\n');

      const importLines: string[] = [];
      const otherLines: string[] = [];
      let inTopBlock = true;

      for (const line of lines) {
        const trimmed = line.trim();
        if (inTopBlock && (trimmed.startsWith('import ') || trimmed.startsWith('use ') || (trimmed.startsWith('from ') && trimmed.includes('import')))) {
          if (!importLines.includes(trimmed)) {
            importLines.push(trimmed);
          }
        } else {
          if (trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
            inTopBlock = false;
          }
          otherLines.push(line);
        }
      }

      if (importLines.length > 0) {
        importLines.sort((a, b) => a.localeCompare(b));
        const newDoc = importLines.join('\n') + '\n\n' + otherLines.join('\n').trimStart();
        isDispatchingRef.current = true;
        view.dispatch({
          changes: { from: 0, to: text.length, insert: newDoc },
        });
        isDispatchingRef.current = false;
        onChange?.(newDoc);
      }
    }, [onChange]);

    // Expose actions to parent / ref
    useImperativeHandle(ref, () => ({
      goToLine: (line: number, col: number = 1) => {
        const view = viewRef.current;
        if (!view) return;
        const validLine = Math.max(1, Math.min(line, view.state.doc.lines));
        const linePos = view.state.doc.line(validLine);
        const targetPos = Math.min(linePos.from + Math.max(0, col - 1), linePos.to);
        view.dispatch({
          selection: { anchor: targetPos, head: targetPos },
          scrollIntoView: true,
        });
        view.focus();
      },
      formatDocument: handleFormatDocument,
      commentLine: () => {
        const view = viewRef.current;
        if (view) {
          const binding = intellijCustomKeymap.find((k) => k.key === 'Mod-/');
          if (binding && typeof binding.run === 'function') {
            binding.run(view);
          }
        }
      },
      commentBlock: () => {
        const view = viewRef.current;
        if (view) {
          blockComment(view);
        }
      },
      optimizeImports: handleOptimizeImports,
      duplicateLine: () => {
        const view = viewRef.current;
        if (view) {
          const binding = intellijCustomKeymap.find((k) => k.key === 'Mod-d');
          if (binding && typeof binding.run === 'function') {
            binding.run(view);
          }
        }
      },
      deleteLine: () => {
        const view = viewRef.current;
        if (view) {
          const binding = intellijCustomKeymap.find((k) => k.key === 'Mod-y');
          if (binding && typeof binding.run === 'function') {
            binding.run(view);
          }
        }
      },
      triggerFind: () => {
        const view = viewRef.current;
        if (view) {
          const binding = intellijCustomKeymap.find((k) => k.key === 'Mod-f');
          if (binding && typeof binding.run === 'function') {
            binding.run(view);
          }
        }
      },
      triggerReplace: () => {
        const view = viewRef.current;
        if (view) {
          const binding = intellijCustomKeymap.find((k) => k.key === 'Mod-r');
          if (binding && typeof binding.run === 'function') {
            binding.run(view);
          }
        }
      },
      triggerInlineAi: () => {
        triggerInlineAi();
      },
      getWordAtCursor: () => {
        const view = viewRef.current;
        if (!view) return '';
        const { state } = view;
        const range = state.selection.main;
        if (!range.empty) {
          return state.sliceDoc(range.from, range.to);
        }
        const word = state.wordAt(range.head);
        return word ? state.sliceDoc(word.from, word.to) : '';
      },
      getContent: () => {
        return viewRef.current ? viewRef.current.state.doc.toString() : '';
      },
      focus: () => {
        viewRef.current?.focus();
      },
      showContextActions: () => {
        triggerCodeActions();
      },
      triggerRename: () => {
        startInPlaceRename();
      },
      surroundWith: (type: string) => {
        const view = viewRef.current;
        if (!view) return;
        const { state } = view;
        const sel = state.selection.main;
        const selectedText = state.sliceDoc(sel.from, sel.to) || '';

        // Indent lines of selectedText for cleaner block structure
        const indentStr = '    ';
        const indentedContent = selectedText
          ? selectedText
              .split('\n')
              .map((l) => (l.trim() ? indentStr + l : l))
              .join('\n')
          : `${indentStr}// TODO: implementation\n`;

        let templateSnippet = '';
        switch (type) {
          case 'if':
            templateSnippet = `if (\${condition}) {\n${indentedContent}\n}\${}`;
            break;
          case 'if-else':
            templateSnippet = `if (\${condition}) {\n${indentedContent}\n} else {\n${indentStr}\${}\n}`;
            break;
          case 'while':
            templateSnippet = `while (\${condition}) {\n${indentedContent}\n}\${}`;
            break;
          case 'for':
            templateSnippet = `for (let \${i} = 0; \${i} < \${len}; \${i}++) {\n${indentedContent}\n}\${}`;
            break;
          case 'try-catch':
            templateSnippet = `try {\n${indentedContent}\n} catch (\${error}) {\n${indentStr}console.error(\${error});\n}\${}`;
            break;
          case 'try-catch-finally':
            templateSnippet = `try {\n${indentedContent}\n} catch (\${error}) {\n${indentStr}console.error(\${error});\n} finally {\n${indentStr}\${}\n}`;
            break;
          case 'block':
            templateSnippet = `{\n${indentedContent}\n}\${}`;
            break;
          case 'region':
            templateSnippet = `// #region \${region_name}\n${selectedText || indentedContent}\n// #endregion\${}`;
            break;
          default:
            templateSnippet = `if (\${condition}) {\n${indentedContent}\n}\${}`;
        }

        snippet(templateSnippet)(view, undefined as any, sel.from, sel.to);
      },
      insertSnippet: (code: string) => {
        const view = viewRef.current;
        if (!view) return;
        const sel = view.state.selection.main;
        snippet(code)(view, undefined as any, sel.from, sel.to);
      },
      foldAll: () => {
        const view = viewRef.current;
        if (view) foldAll(view);
      },
      unfoldAll: () => {
        const view = viewRef.current;
        if (view) unfoldAll(view);
      },
      undo: () => {
        const view = viewRef.current;
        if (view) undo(view);
      },
      redo: () => {
        const view = viewRef.current;
        if (view) redo(view);
      },
    }));

    // Find and load language dynamically from extension or language prop
    const getLanguageExtension = useCallback(async (): Promise<Extension[]> => {
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const langName = (language || '').toLowerCase();

      // First-class deterministic loaders for CSS, SCSS, SASS, LESS
      if (ext === 'css' || langName === 'css') {
        try {
          const { css } = await import('@codemirror/lang-css');
          return [css()];
        } catch (e) {
          console.warn('Failed to load CM6 CSS grammar:', e);
        }
      }
      if (ext === 'scss' || ext === 'sass' || langName === 'scss' || langName === 'sass') {
        try {
          const { sass } = await import('@codemirror/lang-sass');
          return [sass({ indented: ext === 'sass' })];
        } catch (e) {
          console.warn('Failed to load CM6 SASS/SCSS grammar:', e);
        }
      }
      if (ext === 'less' || langName === 'less') {
        try {
          const { less } = await import('@codemirror/lang-less');
          return [less()];
        } catch (e) {
          console.warn('Failed to load CM6 LESS grammar:', e);
        }
      }

      // First-class deterministic loader for Vue Single File Components with SCSS/SASS/LESS/TypeScript nested parsing
      if (ext === 'vue' || langName === 'vue') {
        try {
          const [htmlMod, vueMod, sassMod, lessMod, jsMod] = await Promise.all([
            import('@codemirror/lang-html'),
            import('@codemirror/lang-vue'),
            import('@codemirror/lang-sass'),
            import('@codemirror/lang-less'),
            import('@codemirror/lang-javascript'),
          ]);
          const sassSup = sassMod.sass();
          const lessSup = lessMod.less();
          const tsSup = jsMod.javascript({ typescript: true });
          const baseHtml = htmlMod.html({
            nestedLanguages: [
              { tag: 'style', attrs: (attrs) => /scss|sass/.test(attrs.lang || ''), parser: sassSup.language.parser },
              { tag: 'style', attrs: (attrs) => /less/.test(attrs.lang || ''), parser: lessSup.language.parser },
              { tag: 'script', attrs: (attrs) => /ts|typescript/.test(attrs.lang || ''), parser: tsSup.language.parser },
            ],
          });
          return [vueMod.vue({ base: baseHtml })];
        } catch (e) {
          console.warn('Failed to load CM6 Vue grammar with nested languages:', e);
        }
      }

      const desc = languages.find(
        (l) =>
          l.name.toLowerCase() === langName ||
          l.alias.some((a) => a.toLowerCase() === langName) ||
          l.extensions.includes(ext)
      );

      if (desc) {
        try {
          const support = await desc.load();
          return [support];
        } catch (e) {
          console.warn('Failed to load CM6 language grammar:', e);
        }
      }
      return [];
    }, [filePath, language]);

    // Initialize or re-create EditorView
    useEffect(() => {
      if (!editorContainerRef.current) return;

      let isMounted = true;

      const initEditor = async () => {
        const langExtensions = await getLanguageExtension();
        if (!isMounted) return;

        // Cleanup existing view
        if (viewRef.current) {
          viewRef.current.destroy();
        }

        let unlistenDiagnostics = () => {};

        const updateListener = EditorView.updateListener.of((update) => {
          if (update.docChanged && !isDispatchingRef.current) {
            const newDoc = update.state.doc.toString();
            onChange?.(newDoc);
            lspService.notifyChange(filePath, newDoc);
            setTotalDocLines(update.state.doc.lines);
          }
          if (update.selectionSet || update.docChanged) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            const col = head - line.from + 1;
            setCursorLine(line.number);
            onCursorChange?.(line.number, col);
          }
        });

        const saveKeymap: Extension = keymap.of([
          {
            key: 'Mod-s',
            run: () => {
              onSave?.();
              return true;
            },
          },
        ]);

        const lspNavHandler = async (targetPath: string, line: number, col: number) => {
          if (onOpenFileAtLocation) {
            onOpenFileAtLocation(targetPath, line, col);
            return;
          }
          const store = useEditorStore.getState();
          const targetTab = store.tabs.find((t: OpenTab) => t.path === targetPath || t.id === targetPath);
          if (targetTab) {
            store.selectTab(targetTab.id);
          } else {
            let fileContent = '';
            if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
              try {
                fileContent = await invoke<string>('read_file_content', { path: targetPath });
              } catch (e) {
                console.warn('Failed to read file content for target:', e);
              }
            }
            const title = targetPath.split(/[\\/]/).pop() || targetPath;
            const ext = title.split('.').pop()?.toLowerCase() || '';
            store.openTab({
              id: targetPath,
              title,
              path: targetPath,
              content: fileContent,
              language: ext,
              isDirty: false,
            });
          }
          setTimeout(() => {
            const activeView = viewRef.current;
            if (activeView) {
              const validLine = Math.max(1, Math.min(line, activeView.state.doc.lines));
              const linePos = activeView.state.doc.line(validLine);
              const targetPos = Math.min(linePos.from + Math.max(0, col - 1), linePos.to);
              activeView.dispatch({
                selection: { anchor: targetPos, head: targetPos },
                scrollIntoView: true,
              });
              activeView.focus();
            }
          }, 80);
        };

        const lspNavKeymap = createLspKeymap(filePath, lspNavHandler, projectPath);
        const lspMouseHandler = createLspMouseHandler(filePath, lspNavHandler, projectPath);

        const startState = EditorState.create({
          doc: content,
          extensions: [
            ...(vimMode ? [vim()] : []),
            gitBlameCompartmentRef.current.of(
              showGitBlame && blameData && blameData.length > 0
                ? createGitBlameGutter(blameData, onOpenGitCommit)
                : []
            ),
            breakpointCompartmentRef.current.of([
              createBreakpointGutter(filePath, breakpoints, activePausedLine, onToggleBreakpoint),
              createActiveLineHighlighter(filePath, activePausedLine),
            ]),
            coverageCompartmentRef.current.of(createCoverageGutter(coverageData)),
            themeCompartmentRef.current.of(resolveEditorTheme(theme, customThemeJson)),
            createIndentGuides(tabSize || 4),
            createOccurrencesHighlighter((occs) => {
              setOccurrences(occs);
            }),
            colorPickerExtension,
            lineNumbers(),
            gitDiffCompartmentRef.current.of(createGitDiffGutter(gitDiffMap)),
            highlightActiveLineGutter(),
            highlightSpecialChars(),
            history(),
            foldGutter(),
            drawSelection(),
            dropCursor(),
            EditorState.allowMultipleSelections.of(true),
            indentOnInput(),
            bracketMatching(),
            closeBrackets(),
            isRainbowActive ? createRainbowBracketsExtension() : [],
            isSonarActive ? createSonarLinterExtension(filePath) : [],
            createLspAutocompletion(filePath, language),
            createLspHoverTooltip(filePath),
            createLspSignatureHelp(filePath),
            createLocalAiExtension(filePath, language),
            createCodeLensExtension(onFindUsages),
            rectangularSelection(),
            crosshairCursor(),
            highlightActiveLine(),
            highlightSelectionMatches(),
            lspMouseHandler,
            EditorState.readOnly.of(isReadOnly),
            EditorState.tabSize.of(tabSize),
            keymap.of([
              {
                key: 'Alt-F7',
                run: (view) => {
                  const head = view.state.selection.main.head;
                  const word = view.state.wordAt(head);
                  const sym = word ? view.state.sliceDoc(word.from, word.to) : '';
                  if (sym && onFindUsages) {
                    onFindUsages(sym);
                    return true;
                  }
                  return false;
                },
              },
              {
                key: 'Ctrl-Alt-F7',
                run: (view) => {
                  const head = view.state.selection.main.head;
                  const word = view.state.wordAt(head);
                  const sym = word ? view.state.sliceDoc(word.from, word.to) : '';
                  if (sym && onFindUsages) {
                    onFindUsages(sym);
                    return true;
                  }
                  return false;
                },
              },
              {
                key: 'Alt-Shift-f',
                run: () => {
                  handleFormatDocument();
                  return true;
                },
              },
              {
                key: 'Mod-Alt-l',
                run: () => {
                  handleFormatDocument();
                  return true;
                },
              },
              {
                key: 'Shift-Alt-f',
                run: () => {
                  handleFormatDocument();
                  return true;
                },
              },
              {
                key: 'Mod-Alt-o',
                run: () => {
                  handleOptimizeImports();
                  return true;
                },
              },
              {
                key: 'Mod-\\',
                run: (view) => {
                  triggerInlineAi(view);
                  return true;
                },
              },
              ...intellijCustomKeymap,
              ...closeBracketsKeymap,
              ...defaultKeymap,
              ...searchKeymap,
              ...historyKeymap,
              ...foldKeymap,
              ...completionKeymap,
            ]),
            saveKeymap,
            lspNavKeymap,
            createLspCodeActionKeymap(filePath, (actions, x, y) => {
              setCodeActionsPopup({ actions, x, y });
            }),
            createLspRenameKeymap(() => {
              const view = viewRef.current;
              if (!view) return;
              const head = view.state.selection.main.head;
              const word = view.state.wordAt(head);
              const name = word ? view.state.sliceDoc(word.from, word.to) : '';
              const line = view.state.doc.lineAt(head);
              onTriggerRename?.(name, line.number, head - line.from + 1);
            }),
            updateListener,
            ...langExtensions,
          ],
        });

        const view = new EditorView({
          state: startState,
          parent: editorContainerRef.current!,
        });

        viewRef.current = view;

        // Auto-scroll to paused line if active
        if (activePausedLine && activePausedLine.line > 0) {
          const validLine = Math.max(1, Math.min(activePausedLine.line, view.state.doc.lines));
          const linePos = view.state.doc.line(validLine);
          view.dispatch({
            selection: { anchor: linePos.from, head: linePos.from },
            scrollIntoView: true,
          });
        }

        // Initialize document with LSP Server
        const lspProjectRoot = projectPath || (filePath.includes('\\')
          ? filePath.substring(0, filePath.lastIndexOf('\\'))
          : (filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '.'));
        lspService.openDocument(filePath, content, lspProjectRoot);
        unlistenDiagnostics = createLspDiagnostics(viewRef, filePath, (diags) => {
          setFileDiagnostics(diags);
        });
        setTotalDocLines(view.state.doc.lines);

        // Sticky Scroll listener
        const handleScroll = () => {
          if (!viewRef.current) return;
          try {
            const topBlock = viewRef.current.lineBlockAtHeight(0);
            const lineNum = viewRef.current.state.doc.lineAt(topBlock.from).number;
            const scopes = getEnclosingScopes(viewRef.current.state.doc.toString(), lineNum);
            setStickyScopes(scopes);
          } catch (e) {}
        };
        view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true });
        // Initial scan
        setTimeout(handleScroll, 100);
      };

      initEditor();

      return () => {
        isMounted = false;
        lspService.closeDocument(filePath);
        if (viewRef.current) {
          viewRef.current.destroy();
          viewRef.current = null;
        }
      };
    }, [filePath, isReadOnly, tabSize, vimMode, customThemeJson]);


    // Dynamically reconfigure Git Blame gutter without destroying EditorView
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const blameExt =
        showGitBlame && blameData && blameData.length > 0
          ? createGitBlameGutter(blameData, onOpenGitCommit)
          : [];
      view.dispatch({
        effects: gitBlameCompartmentRef.current.reconfigure(blameExt),
      });
    }, [showGitBlame, blameData, onOpenGitCommit]);

    // Dynamically reconfigure Breakpoints without destroying EditorView
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: breakpointCompartmentRef.current.reconfigure([
          createBreakpointGutter(filePath, breakpoints, activePausedLine, onToggleBreakpoint),
          createActiveLineHighlighter(filePath, activePausedLine),
        ]),
      });
    }, [filePath, breakpoints, activePausedLine, onToggleBreakpoint]);

    // Dynamically reconfigure Code Coverage gutter without destroying EditorView
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: coverageCompartmentRef.current.reconfigure(createCoverageGutter(coverageData)),
      });
    }, [coverageData]);

    // Dynamically reconfigure Theme without destroying EditorView
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: themeCompartmentRef.current.reconfigure(resolveEditorTheme(theme, customThemeJson)),
      });
    }, [theme, customThemeJson]);

    // Fetch and track Git Diff for change markers (Blue/Green stripes on Gutter)
    useEffect(() => {
      if (!filePath || !projectPath) {
        setGitDiffMap(null);
        return;
      }
      let isMounted = true;
      invoke<string>('git_get_diff', { projectPath, filePath })
        .then((diffText) => {
          if (isMounted) {
            setGitDiffMap(parseGitDiff(diffText));
          }
        })
        .catch(() => {
          if (isMounted) setGitDiffMap(null);
        });
      return () => {
        isMounted = false;
      };
    }, [filePath, projectPath, content]);

    // Dynamically reconfigure Git Diff gutter
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: gitDiffCompartmentRef.current.reconfigure(createGitDiffGutter(gitDiffMap)),
      });
    }, [gitDiffMap]);

    // Handle external content updates (e.g., file reloaded from disk)
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const currentDoc = view.state.doc.toString();
      const normalizedContent = (content || '').replace(/\r\n/g, '\n');
      if (normalizedContent !== currentDoc) {
        isDispatchingRef.current = true;
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: normalizedContent },
          annotations: Transaction.addToHistory.of(false),
        });
        isDispatchingRef.current = false;
      }
    }, [content]);

    const handleContextMenu = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement | null;
        const gutterEl = target?.closest('.cm-gutters');
        const view = viewRef.current;
        if (!view) return;

        if (gutterEl) {
          e.preventDefault();
          e.stopPropagation();
          setEditorContextMenu(null);
          let lineNum = 1;
          try {
            const lineNumEl = target?.closest('.cm-gutterElement');
            if (lineNumEl && lineNumEl.textContent && /^\d+$/.test(lineNumEl.textContent.trim())) {
              lineNum = parseInt(lineNumEl.textContent.trim(), 10);
            } else {
              const lineBlock = view.lineBlockAtHeight(e.clientY - view.documentTop);
              lineNum = view.state.doc.lineAt(lineBlock.from).number;
            }
          } catch {
            lineNum = 1;
          }
          onGutterContextMenu?.(e.nativeEvent, lineNum);
        } else {
          // Right-clicked inside code editor
          e.preventDefault();
          e.stopPropagation();
          const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
          if (pos !== null) {
            view.dispatch({ selection: { anchor: pos, head: pos } });
          }
          const word = view.state.wordAt(pos ?? view.state.selection.main.head);
          const wordText = word ? view.state.sliceDoc(word.from, word.to) : '';
          setActiveSubmenu(null);
          setEditorContextMenu({
            x: e.clientX,
            y: e.clientY,
            word: wordText,
          });
        }
      },
      [onGutterContextMenu]
    );

    const fileName = filePath ? filePath.split(/[\\/]/).pop() || filePath : 'file';
    const MENU_HEIGHT = 640;
    const MENU_WIDTH = 260;
    const openLeft = editorContextMenu ? editorContextMenu.x + MENU_WIDTH + 240 > window.innerWidth : false;
    const contextMenuTop = editorContextMenu
      ? Math.max(8, Math.min(editorContextMenu.y, window.innerHeight - MENU_HEIGHT - 12))
      : 0;
    const contextMenuLeft = editorContextMenu
      ? Math.max(8, Math.min(editorContextMenu.x, window.innerWidth - MENU_WIDTH - 12))
      : 0;

    const handleGoToNextError = useCallback(() => {
      const view = viewRef.current;
      if (!view) return;
      if (fileDiagnostics.length === 0) return;
      const current = cursorLine;
      const next = fileDiagnostics.find((d) => d.line > current) || fileDiagnostics[0];
      if (next) {
        const validLine = Math.max(1, Math.min(next.line, view.state.doc.lines));
        const linePos = view.state.doc.line(validLine);
        view.dispatch({
          selection: { anchor: linePos.from, head: linePos.from },
          scrollIntoView: true,
        });
        view.focus();
      }
    }, [fileDiagnostics, cursorLine]);

    const handleNavigateToLine = useCallback((line: number) => {
      const view = viewRef.current;
      if (!view) return;
      const validLine = Math.max(1, Math.min(line, view.state.doc.lines));
      const linePos = view.state.doc.line(validLine);
      view.dispatch({
        selection: { anchor: linePos.from, head: linePos.from },
        scrollIntoView: true,
      });
      view.focus();
    }, []);

    return (
      <div className="relative w-full h-full flex flex-col overflow-hidden">
        {/* Main Editor Zone + Error Stripe Bar */}
        <div className="relative flex-1 flex overflow-hidden">
          {/* IntelliJ Sticky Scroll Header */}
          {stickyScopes.length > 0 && (
            <div className="absolute top-0 left-0 right-4 z-20 bg-[#1E1F22]/95 backdrop-blur-sm border-b border-[#2B2D30] text-xs font-mono px-3 py-1 flex items-center gap-2 shadow-sm select-none">
              {stickyScopes.map((scope, idx) => (
                <React.Fragment key={scope.line}>
                  {idx > 0 && <span className="text-[#6F737A]">&gt;</span>}
                  <button
                    onClick={() => {
                      const view = viewRef.current;
                      if (view) {
                        const linePos = view.state.doc.line(Math.min(scope.line, view.state.doc.lines));
                        view.dispatch({
                          selection: { anchor: linePos.from, head: linePos.from },
                          scrollIntoView: true,
                        });
                        view.focus();
                      }
                    }}
                    title={`Click to scroll to line ${scope.line}`}
                    className="flex items-center gap-1.5 hover:bg-[#2B2D30] px-1.5 py-0.5 rounded cursor-pointer transition-colors text-[#DFE1E5] hover:text-white"
                  >
                    {scope.kind === 'class' ? (
                      <span className="w-3.5 h-3.5 rounded bg-[#3574F0]/20 text-[#3574F0] text-[9.5px] font-bold flex items-center justify-center font-sans">
                        C
                      </span>
                    ) : scope.kind === 'interface' ? (
                      <span className="w-3.5 h-3.5 rounded bg-[#59A869]/20 text-[#59A869] text-[9.5px] font-bold flex items-center justify-center font-sans">
                        I
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 rounded bg-[#9876AA]/20 text-[#9876AA] text-[9.5px] font-bold flex items-center justify-center font-sans">
                        f
                      </span>
                    )}
                    <span className="text-[11px] truncate max-w-[200px]">{scope.text}</span>
                    <span className="text-[9.5px] text-[#6F737A]">:{scope.line}</span>
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* IntelliJ In-Place Rename Floating Overlay (Shift+F6) */}
          {inPlaceRename.isOpen && (
            <div
              style={{ top: inPlaceRename.position.top, left: inPlaceRename.position.left }}
              className="absolute z-40 bg-[#2B2D30] border border-[#F5C242] rounded shadow-2xl p-1 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100 font-sans"
            >
              <div className="w-1.5 h-4 bg-[#F5C242] rounded-sm" />
              <input
                autoFocus
                type="text"
                value={inPlaceRename.newName}
                onChange={(e) => setInPlaceRename((prev) => ({ ...prev, newName: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCommitInPlaceRename();
                  } else if (e.key === 'Escape') {
                    setInPlaceRename((prev) => ({ ...prev, isOpen: false }));
                    viewRef.current?.focus();
                  }
                }}
                className="bg-[#1E1F22] text-[#DFE1E5] font-mono text-xs px-2 py-0.5 rounded border border-[#4E5157] focus:border-[#3574F0] outline-none min-w-[140px]"
              />
              <button
                onClick={handleCommitInPlaceRename}
                title="Rename in document and workspace (Enter)"
                className="p-1 hover:bg-[#3574F0] text-[#59A869] hover:text-white rounded cursor-pointer"
              >
                <Check size={13} />
              </button>
              <button
                onClick={() => {
                  setInPlaceRename((prev) => ({ ...prev, isOpen: false }));
                  viewRef.current?.focus();
                }}
                title="Cancel (Esc)"
                className="p-1 hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] rounded cursor-pointer"
              >
                <X size={13} />
              </button>
              <span className="text-[10px] text-[#868A91] px-1 font-mono">Shift+F6</span>
            </div>
          )}

          <div
            ref={editorContainerRef}
            onContextMenu={handleContextMenu}
            className="flex-1 h-full overflow-hidden text-left"
            style={{
              fontSize: `${fontSize}px`,
              fontFamily: fontFamily ? `'${fontFamily}', monospace` : "'JetBrains Mono', Consolas, monospace",
              lineHeight: lineHeight,
              fontVariantLigatures: ligatures ? 'normal' : 'none',
            }}
          />
          <ErrorStripeBar
            totalLines={totalDocLines}
            currentLine={cursorLine}
            diagnostics={fileDiagnostics}
            occurrences={occurrences}
            onNavigateToLine={handleNavigateToLine}
            onNextError={handleGoToNextError}
          />
        </div>

        {/* IntelliJ Breadcrumbs Bar */}
        <EditorBreadcrumbs
          filePath={filePath}
          content={content}
          currentLine={cursorLine}
          onNavigateToLine={handleNavigateToLine}
        />
      {/* IntelliJ Multi-level Right-Click Code Context Menu */}
      {editorContextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => {
            setEditorContextMenu(null);
            setActiveSubmenu(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setEditorContextMenu(null);
            setActiveSubmenu(null);
          }}
        >
          <div
            style={{
              top: contextMenuTop,
              left: contextMenuLeft,
            }}
            className="absolute bg-[#2B2D30] border border-[#4E5157] rounded-md shadow-2xl py-1 w-64 max-h-[calc(100vh-20px)] overflow-y-auto text-xs text-[#DFE1E5] z-50 select-none animate-in fade-in zoom-in-95 duration-100 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ─── 1. Show Context Actions ─── */}
            <button
              onClick={() => {
                setEditorContextMenu(null);
                setActiveSubmenu(null);
                triggerCodeActions();
              }}
              onMouseEnter={() => setActiveSubmenu(null)}
              className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors cursor-pointer text-left group"
            >
              <span className="flex items-center gap-2">
                <Lightbulb size={13} className="text-[#F5C242]" />
                <span className="font-medium text-[#DFE1E5] group-hover:text-white">Show Context Actions</span>
              </span>
              <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Alt+Enter</span>
            </button>

            {/* ─── 2. AI Actions (Submenu) ─── */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('ai')}
            >
              <div className={`w-full px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer text-left group ${activeSubmenu === 'ai' ? 'bg-[#3574F0] text-white' : 'hover:bg-[#3574F0] hover:text-white'}`}>
                <span className="flex items-center gap-2">
                  <Sparkles size={13} className="text-[#A78BFA] group-hover:text-white" />
                  <span className="group-hover:text-white">AI Actions</span>
                </span>
                <ChevronRight size={12} className="text-[#868A91] group-hover:text-white" />
              </div>
              {activeSubmenu === 'ai' && (
                <div
                  className={`absolute top-[-4px] ${openLeft ? 'right-[calc(100%-2px)]' : 'left-[calc(100%-2px)]'} bg-[#2B2D30] border border-[#4E5157] rounded-md shadow-2xl py-1 w-52 text-xs text-[#DFE1E5] z-50 animate-in fade-in zoom-in-95 duration-75`}
                >
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      onOpenAiDrawer?.(`Generate code for ${editorContextMenu.word || 'this context'}`);
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Generate Code...</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      onOpenAiDrawer?.(`Explain the following code: ${editorContextMenu.word}`);
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Explain Code</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      onOpenAiDrawer?.(`Find problems and bugs in ${fileName}`);
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Find Problems</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      onOpenAiDrawer?.(`Refactor this code: ${editorContextMenu.word}`);
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Refactor Code</span>
                  </button>
                </div>
              )}
            </div>

            <div className="my-1 border-t border-[#393B40]" />

            {/* ─── 3. Cut / Copy / Special / Paste ─── */}
            <button
              onClick={() => {
                setEditorContextMenu(null);
                setActiveSubmenu(null);
                document.execCommand('cut');
              }}
              onMouseEnter={() => setActiveSubmenu(null)}
              className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors cursor-pointer text-left group"
            >
              <span className="flex items-center gap-2">
                <Scissors size={13} className="text-[#868A91] group-hover:text-white" />
                <span>Cut</span>
              </span>
              <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+X</span>
            </button>

            <button
              onClick={() => {
                setEditorContextMenu(null);
                setActiveSubmenu(null);
                document.execCommand('copy');
              }}
              onMouseEnter={() => setActiveSubmenu(null)}
              className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors cursor-pointer text-left group"
            >
              <span className="flex items-center gap-2">
                <Copy size={13} className="text-[#868A91] group-hover:text-white" />
                <span>Copy</span>
              </span>
              <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+C</span>
            </button>

            {/* Copy / Paste Special Submenu */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('copyspecial')}
            >
              <div className={`w-full px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer text-left group ${activeSubmenu === 'copyspecial' ? 'bg-[#3574F0] text-white' : 'hover:bg-[#3574F0] hover:text-white'}`}>
                <span className="flex items-center gap-2">
                  <Clipboard size={13} className="text-[#868A91] group-hover:text-white" />
                  <span>Copy / Paste Special</span>
                </span>
                <ChevronRight size={12} className="text-[#868A91] group-hover:text-white" />
              </div>
              {activeSubmenu === 'copyspecial' && (
                <div
                  className={`absolute top-[-4px] ${openLeft ? 'right-[calc(100%-2px)]' : 'left-[calc(100%-2px)]'} bg-[#2B2D30] border border-[#4E5157] rounded-md shadow-2xl py-1 w-60 text-xs text-[#DFE1E5] z-50 animate-in fade-in zoom-in-95 duration-75`}
                >
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      const view = viewRef.current;
                      if (view) {
                        const sel = view.state.selection.main;
                        const txt = view.state.sliceDoc(sel.from, sel.to);
                        navigator.clipboard.writeText(txt);
                      }
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Copy as Plain Text</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      const view = viewRef.current;
                      if (view) {
                        const head = view.state.selection.main.head;
                        const line = view.state.doc.lineAt(head).number;
                        navigator.clipboard.writeText(`${filePath}:${line}`);
                      }
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Copy Reference</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+Alt+Shift+C</span>
                  </button>
                  <button
                    onClick={async () => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      const clip = await navigator.clipboard.readText();
                      const view = viewRef.current;
                      if (view && clip) {
                        const sel = view.state.selection.main;
                        view.dispatch({ changes: { from: sel.from, to: sel.to, insert: clip } });
                      }
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Paste from History...</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+Shift+V</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={async () => {
                setEditorContextMenu(null);
                setActiveSubmenu(null);
                try {
                  const clip = await navigator.clipboard.readText();
                  const view = viewRef.current;
                  if (view && clip) {
                    const sel = view.state.selection.main;
                    view.dispatch({ changes: { from: sel.from, to: sel.to, insert: clip } });
                  }
                } catch {
                  document.execCommand('paste');
                }
              }}
              onMouseEnter={() => setActiveSubmenu(null)}
              className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors cursor-pointer text-left group"
            >
              <span className="flex items-center gap-2">
                <Clipboard size={13} className="text-[#868A91] group-hover:text-white" />
                <span>Paste</span>
              </span>
              <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+V</span>
            </button>

            <button
              onClick={() => {
                setEditorContextMenu(null);
                setActiveSubmenu(null);
                setIsColumnSelectionMode((prev) => {
                  const next = !prev;
                  onShowToast?.(
                    'Column Selection Mode',
                    next ? 'Column Selection Mode enabled (Shift+Alt+Insert)' : 'Column Selection Mode disabled',
                    'info'
                  );
                  return next;
                });
              }}
              onMouseEnter={() => setActiveSubmenu(null)}
              className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors cursor-pointer text-left group"
            >
              <span className="flex items-center gap-2">
                <Columns size={13} className="text-[#868A91] group-hover:text-white" />
                <span>Column Selection Mode</span>
              </span>
              <div className="flex items-center gap-1.5">
                {isColumnSelectionMode && <span className="text-[#59A869] text-xs font-bold">✓</span>}
                <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Shift+Alt+Insert</span>
              </div>
            </button>

            <div className="my-1 border-t border-[#393B40]" />

            {/* ─── 4. Find Usages ─── */}
            <button
              onClick={() => {
                const sym = editorContextMenu.word;
                setEditorContextMenu(null);
                setActiveSubmenu(null);
                if (sym) {
                  onFindUsages?.(sym);
                }
              }}
              onMouseEnter={() => setActiveSubmenu(null)}
              className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors cursor-pointer text-left group"
            >
              <span className="flex items-center gap-2">
                <Search size={13} className="text-[#868A91] group-hover:text-white" />
                <span>Find Usages</span>
              </span>
              <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Alt+F7</span>
            </button>

            {/* ─── 5. Go To (Submenu) ─── */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('goto')}
            >
              <div className={`w-full px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer text-left group ${activeSubmenu === 'goto' ? 'bg-[#3574F0] text-white' : 'hover:bg-[#3574F0] hover:text-white'}`}>
                <span className="flex items-center gap-2">
                  <Code size={13} className="text-[#56A8F5] group-hover:text-white" />
                  <span>Go To</span>
                </span>
                <ChevronRight size={12} className="text-[#868A91] group-hover:text-white" />
              </div>
              {activeSubmenu === 'goto' && (
                <div
                  className={`absolute top-[-4px] ${openLeft ? 'right-[calc(100%-2px)]' : 'left-[calc(100%-2px)]'} bg-[#2B2D30] border border-[#4E5157] rounded-md shadow-2xl py-1 w-64 text-xs text-[#DFE1E5] z-50 animate-in fade-in zoom-in-95 duration-75`}
                >
                  <button
                    onClick={() => {
                      const view = viewRef.current;
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      if (view) {
                        triggerGoToDefinition(filePath, view, undefined, (targetPath, line, col) => {
                          const store = useEditorStore.getState();
                          const targetTab = store.tabs.find((t: OpenTab) => t.path === targetPath);
                          if (targetTab) {
                            store.selectTab(targetTab.id);
                          } else {
                            const title = targetPath.split(/[\\/]/).pop() || targetPath;
                            const ext = title.split('.').pop()?.toLowerCase() || '';
                            store.openTab({ id: targetPath, title, path: targetPath, content: '', language: ext });
                          }
                          setTimeout(() => {
                            const activeView = viewRef.current;
                            if (activeView) {
                              const validLine = Math.max(1, Math.min(line, activeView.state.doc.lines));
                              const linePos = activeView.state.doc.line(validLine);
                              const targetPos = Math.min(linePos.from + Math.max(0, col - 1), linePos.to);
                              activeView.dispatch({ selection: { anchor: targetPos, head: targetPos }, scrollIntoView: true });
                              activeView.focus();
                            }
                          }, 80);
                        });
                      }
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Declaration or Usages</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+B</span>
                  </button>
                  <button
                    onClick={() => {
                      const view = viewRef.current;
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      if (view) {
                        triggerGoToDefinition(filePath, view, undefined, (targetPath) => {
                          const store = useEditorStore.getState();
                          const targetTab = store.tabs.find((t: OpenTab) => t.path === targetPath);
                          if (targetTab) store.selectTab(targetTab.id);
                        });
                      }
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Implementation(s)</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+Alt+B</span>
                  </button>
                  <button
                    onClick={() => {
                      const view = viewRef.current;
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      if (view) {
                        triggerGoToDefinition(filePath, view, undefined, (targetPath) => {
                          const store = useEditorStore.getState();
                          const targetTab = store.tabs.find((t: OpenTab) => t.path === targetPath);
                          if (targetTab) store.selectTab(targetTab.id);
                        });
                      }
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Type Declaration</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+Shift+B</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      onSelectMenuAction?.('navigate.gotoDeclaration');
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Super Method</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+U</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      onSelectMenuAction?.('navigate.goToTest');
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Test</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+Shift+T</span>
                  </button>
                  <div className="my-1 border-t border-[#393B40]" />
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      onSelectMenuAction?.('navigate.goToSymbol');
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Related Symbol...</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+Alt+Home</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      onSelectMenuAction?.('navigate.back');
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Back</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+Alt+Left</span>
                  </button>
                </div>
              )}
            </div>

            {/* ─── 6. Generate... ─── */}
            <button
              onClick={() => {
                setEditorContextMenu(null);
                setActiveSubmenu(null);
                onOpenSurroundWith?.();
              }}
              onMouseEnter={() => setActiveSubmenu(null)}
              className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors cursor-pointer text-left group"
            >
              <span className="flex items-center gap-2">
                <Plus size={13} className="text-[#868A91] group-hover:text-white" />
                <span>Generate...</span>
              </span>
              <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Alt+Insert</span>
            </button>

            <div className="my-1 border-t border-[#393B40]" />

            {/* ─── 7. Refactor (Submenu) ─── */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('refactor')}
            >
              <div className={`w-full px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer text-left group ${activeSubmenu === 'refactor' ? 'bg-[#3574F0] text-white' : 'hover:bg-[#3574F0] hover:text-white'}`}>
                <span className="flex items-center gap-2">
                  <Edit3 size={13} className="text-[#868A91] group-hover:text-white" />
                  <span>Refactor</span>
                </span>
                <ChevronRight size={12} className="text-[#868A91] group-hover:text-white" />
              </div>
              {activeSubmenu === 'refactor' && (
                <div
                  className={`absolute top-[-4px] ${openLeft ? 'right-[calc(100%-2px)]' : 'left-[calc(100%-2px)]'} bg-[#2B2D30] border border-[#4E5157] rounded-md shadow-2xl py-1 w-56 text-xs text-[#DFE1E5] z-50 animate-in fade-in zoom-in-95 duration-75`}
                >
                  <button
                    onClick={() => {
                      const view = viewRef.current;
                      const sym = editorContextMenu.word;
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      if (view && sym) {
                        const head = view.state.selection.main.head;
                        const line = view.state.doc.lineAt(head);
                        onTriggerRename?.(sym, line.number, head - line.from + 1);
                      }
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Rename...</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Shift+F6</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      handleFormatDocument();
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Reformat Code</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">{formatShortcutLabel}</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      handleOptimizeImports();
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Optimize Imports</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+Alt+O</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      onOpenSurroundWith?.();
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Surround With...</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+Alt+T</span>
                  </button>
                </div>
              )}
            </div>

            {/* ─── 8. Folding (Submenu) ─── */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('folding')}
            >
              <div className={`w-full px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer text-left group ${activeSubmenu === 'folding' ? 'bg-[#3574F0] text-white' : 'hover:bg-[#3574F0] hover:text-white'}`}>
                <span className="flex items-center gap-2">
                  <FoldHorizontal size={13} className="text-[#868A91] group-hover:text-white" />
                  <span>Folding</span>
                </span>
                <ChevronRight size={12} className="text-[#868A91] group-hover:text-white" />
              </div>
              {activeSubmenu === 'folding' && (
                <div
                  className={`absolute top-[-4px] ${openLeft ? 'right-[calc(100%-2px)]' : 'left-[calc(100%-2px)]'} bg-[#2B2D30] border border-[#4E5157] rounded-md shadow-2xl py-1 w-56 text-xs text-[#DFE1E5] z-50 animate-in fade-in zoom-in-95 duration-75`}
                >
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      const view = viewRef.current;
                      if (view) unfoldCode(view);
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Expand</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+NumPad +</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      const view = viewRef.current;
                      if (view) foldCode(view);
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Collapse</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+NumPad -</span>
                  </button>
                  <div className="my-1 border-t border-[#393B40]" />
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      const view = viewRef.current;
                      if (view) unfoldAll(view);
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Expand All</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+Shift+NumPad +</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      const view = viewRef.current;
                      if (view) foldAll(view);
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Collapse All</span>
                    <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono">Ctrl+Shift+NumPad -</span>
                  </button>
                </div>
              )}
            </div>

            <div className="my-1 border-t border-[#393B40]" />

            {/* ─── 9. Run '<fileName>' & Debug '<fileName>' ─── */}
            <button
              onClick={() => {
                setEditorContextMenu(null);
                setActiveSubmenu(null);
                onRunFile?.();
              }}
              onMouseEnter={() => setActiveSubmenu(null)}
              className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors cursor-pointer text-left group"
            >
              <span className="flex items-center gap-2 truncate pr-2">
                <Play size={13} className="text-[#59A869] fill-[#59A869] flex-shrink-0" />
                <span className="truncate">Run '{fileName}'</span>
              </span>
              <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono flex-shrink-0">Ctrl+Shift+F10</span>
            </button>

            <button
              onClick={() => {
                setEditorContextMenu(null);
                setActiveSubmenu(null);
                onRunFile?.();
              }}
              onMouseEnter={() => setActiveSubmenu(null)}
              className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors cursor-pointer text-left group"
            >
              <span className="flex items-center gap-2 truncate pr-2">
                <Bug size={13} className="text-[#59A869] flex-shrink-0" />
                <span className="truncate">Debug '{fileName}'</span>
              </span>
              <span className="text-[10px] text-[#868A91] group-hover:text-white font-mono flex-shrink-0">Shift+F9</span>
            </button>

            <button
              onClick={() => {
                setEditorContextMenu(null);
                setActiveSubmenu(null);
                onSelectMenuAction?.('run.editConfig');
              }}
              onMouseEnter={() => setActiveSubmenu(null)}
              className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors cursor-pointer text-left group"
            >
              <span className="flex items-center gap-2">
                <Settings size={13} className="text-[#868A91] group-hover:text-white" />
                <span>Modify Run Configuration...</span>
              </span>
            </button>

            <div className="my-1 border-t border-[#393B40]" />

            {/* ─── 10. Git (Submenu) ─── */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('git')}
            >
              <div className={`w-full px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer text-left group ${activeSubmenu === 'git' ? 'bg-[#3574F0] text-white' : 'hover:bg-[#3574F0] hover:text-white'}`}>
                <span className="flex items-center gap-2">
                  <GitBranch size={13} className="text-[#868A91] group-hover:text-white" />
                  <span>Git</span>
                </span>
                <ChevronRight size={12} className="text-[#868A91] group-hover:text-white" />
              </div>
              {activeSubmenu === 'git' && (
                <div
                  className={`absolute bottom-[-4px] ${openLeft ? 'right-[calc(100%-2px)]' : 'left-[calc(100%-2px)]'} bg-[#2B2D30] border border-[#4E5157] rounded-md shadow-2xl py-1 w-56 text-xs text-[#DFE1E5] z-50 animate-in fade-in zoom-in-95 duration-75`}
                >
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      onToggleGitBlame?.();
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      {showGitBlame && <Check size={12} className="text-[#3574F0] group-hover:text-white" />}
                      <span>{showGitBlame ? 'Close Annotations' : 'Annotate with Git Blame'}</span>
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      onSelectMenuAction?.('git.compareBranch');
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Compare with Branch...</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      onSelectMenuAction?.('git.log');
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Show History</span>
                  </button>
                </div>
              )}
            </div>

            {/* ─── 11. Local History (Submenu) ─── */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('localhistory')}
            >
              <div className={`w-full px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer text-left group ${activeSubmenu === 'localhistory' ? 'bg-[#3574F0] text-white' : 'hover:bg-[#3574F0] hover:text-white'}`}>
                <span className="flex items-center gap-2">
                  <History size={13} className="text-[#868A91] group-hover:text-white" />
                  <span>Local History</span>
                </span>
                <ChevronRight size={12} className="text-[#868A91] group-hover:text-white" />
              </div>
              {activeSubmenu === 'localhistory' && (
                <div
                  className={`absolute bottom-[-4px] ${openLeft ? 'right-[calc(100%-2px)]' : 'left-[calc(100%-2px)]'} bg-[#2B2D30] border border-[#4E5157] rounded-md shadow-2xl py-1 w-52 text-xs text-[#DFE1E5] z-50 animate-in fade-in zoom-in-95 duration-75`}
                >
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      onSelectMenuAction?.('file.localHistory');
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Show History</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditorContextMenu(null);
                      setActiveSubmenu(null);
                      onSelectMenuAction?.('file.putLabel');
                    }}
                    className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between text-left group cursor-pointer"
                  >
                    <span>Put Label...</span>
                  </button>
                </div>
              )}
            </div>

            <div className="my-1 border-t border-[#393B40]" />

            {/* ─── 12. Compare with Clipboard ─── */}
            <button
              onClick={() => {
                setEditorContextMenu(null);
                setActiveSubmenu(null);
                onSelectMenuAction?.('file.compareWithClipboard');
              }}
              onMouseEnter={() => setActiveSubmenu(null)}
              className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors cursor-pointer text-left group"
            >
              <span className="flex items-center gap-2">
                <Clipboard size={13} className="text-[#868A91] group-hover:text-white" />
                <span>Compare with Clipboard</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {/* IntelliJ Alt+Enter Context Actions / Quick-Fix Popup */}
      {codeActionsPopup && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setCodeActionsPopup(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setCodeActionsPopup(null);
          }}
        >
          <div
            style={{
              top: Math.min(codeActionsPopup.y, window.innerHeight - 250),
              left: Math.min(codeActionsPopup.x, window.innerWidth - 320),
            }}
            className="absolute bg-[#2B2D30] border border-[#4E5157] rounded-lg shadow-2xl py-1.5 w-72 text-xs text-[#DFE1E5] z-50 select-none animate-in fade-in zoom-in-95 duration-100 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* IntelliJ Diagnostic Banner (if error or warning on current line) */}
            {codeActionsPopup.diagnostic && (
              <div className="px-3 py-2 bg-[#E55353]/15 border-b border-[#393B40] text-xs text-[#FF8585] flex items-start gap-2 leading-relaxed">
                <span className="w-2 h-2 rounded-full bg-[#E55353] flex-shrink-0 mt-1" />
                <span className="font-sans break-words select-text">{codeActionsPopup.diagnostic.message}</span>
              </div>
            )}

            <div className="px-3 py-1 text-[10.5px] font-semibold text-[#868A91] uppercase tracking-wider border-b border-[#393B40] flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5 text-[#F5C242]">
                <Sparkles size={12} />
                <span>Show Context Actions</span>
              </span>
              <span className="text-[9.5px] font-mono text-[#6F737A]">Alt+Enter</span>
            </div>

            <div className="max-h-60 overflow-y-auto py-0.5">
              {codeActionsPopup.actions.map((act: LspCodeAction, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleSelectCodeAction(act)}
                  className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center gap-2 text-left transition-colors cursor-pointer group"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3574F0] group-hover:bg-white flex-shrink-0" />
                  <span className="truncate flex-1">{act.title}</span>
                  {act.isPreferred && (
                    <span className="text-[9px] px-1 rounded bg-[#59A869]/20 text-[#59A869] group-hover:text-white font-medium">
                      Fix
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* IntelliJ Inline AI Assistant Prompt Bar (Ctrl+\ / Mod+\) */}
      <AiInlinePromptBar
        isOpen={inlineAiBar.isOpen}
        position={inlineAiBar.position}
        activeLanguage={language}
        selectedText={inlineAiBar.selectedText}
        onAccept={handleAcceptInlineAi}
        onClose={() => {
          setInlineAiBar((p) => ({ ...p, isOpen: false }));
          viewRef.current?.focus();
        }}
      />
      </div>
    );
  }
);

CmEditor.displayName = 'CmEditor';
