import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  Columns, 
  Rows, 
  Settings, 
  HelpCircle, 
  Save, 
  Check, 
  ChevronDown
} from 'lucide-react';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { 
  MergeView, 
  unifiedMergeView, 
  getChunks, 
  goToNextChunk, 
  goToPreviousChunk 
} from '@codemirror/merge';
import { languages } from '@codemirror/language-data';
import { darculaTheme } from '../../editor/cm/darculaTheme';
import { invoke } from '@tauri-apps/api/core';

export interface DiffEditorTabProps {
  diffData: {
    filePath: string;
    baseContent: string;
    localContent: string;
    baseHash?: string;
    baseTitle?: string;
    localTitle?: string;
  };
  projectPath?: string;
  onOpenFile?: (filePath: string) => void;
  onChangeLocal?: (newContent: string) => void;
}

interface DiffStripe {
  fromLine: number;
  toLine: number;
  topPercent: number;
  heightPercent: number;
  color: string;
}

export const DiffEditorTab: React.FC<DiffEditorTabProps> = ({
  diffData,
  projectPath,
  onOpenFile,
  onChangeLocal,
}) => {
  const { filePath, baseContent, localContent, baseHash, baseTitle, localTitle } = diffData;

  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
  const [whitespacePolicy, setWhitespacePolicy] = useState<'do-not-ignore' | 'ignore' | 'trim'>('do-not-ignore');
  const [highlightPolicy, setHighlightPolicy] = useState<'words' | 'lines' | 'split' | 'none'>('words');
  const [activeChunkIndex, setActiveChunkIndex] = useState(0);
  const [chunksCount, setChunksCount] = useState(0);
  const [hasModified, setHasModified] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [diffStripes, setDiffStripes] = useState<DiffStripe[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);
  const unifiedViewRef = useRef<EditorView | null>(null);
  const currentLocalRef = useRef<string>(localContent || '');

  // Keep local reference in sync when incoming diffData changes
  useEffect(() => {
    currentLocalRef.current = localContent || '';
    setHasModified(false);
  }, [localContent, filePath]);

  // Load language extension based on file extension
  const [langExtension, setLangExtension] = useState<Extension | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const loadLang = async () => {
      const ext = filePath.split('.').pop()?.toLowerCase();
      if (!ext) {
        setLangExtension(null);
        return;
      }
      const desc = languages.find(l => l.extensions.includes(ext));
      if (desc) {
        try {
          const support = await desc.load();
          if (!isCancelled) {
            setLangExtension(support);
          }
        } catch {
          if (!isCancelled) setLangExtension(null);
        }
      } else {
        setLangExtension(null);
      }
    };
    loadLang();
    return () => {
      isCancelled = true;
    };
  }, [filePath]);

  // Clean up previous views
  const destroyViews = () => {
    if (mergeViewRef.current) {
      mergeViewRef.current.destroy();
      mergeViewRef.current = null;
    }
    if (unifiedViewRef.current) {
      unifiedViewRef.current.destroy();
      unifiedViewRef.current = null;
    }
  };

  // Helper to calculate Overview Ruler diff stripes
  const updateStripesFromMergeView = (mv: MergeView) => {
    try {
      const viewB = mv.b;
      const doc = viewB.state.doc;
      const totalLines = Math.max(1, doc.lines);
      const chunks = mv.chunks;

      const stripes: DiffStripe[] = chunks.map((chunk) => {
        const fromPos = Math.min(chunk.fromB, doc.length);
        const toPos = Math.min(chunk.toB, doc.length);
        const fromLine = doc.lineAt(fromPos).number;
        const toLine = doc.lineAt(toPos).number;
        const topPercent = ((fromLine - 1) / totalLines) * 100;
        const lineCount = Math.max(1, toLine - fromLine + 1);
        const heightPercent = Math.max(0.8, (lineCount / totalLines) * 100);
        const isDeletion = chunk.fromB === chunk.toB;
        return {
          fromLine,
          toLine,
          topPercent,
          heightPercent,
          color: isDeletion ? '#E05555' : '#59A869',
        };
      });
      setDiffStripes(stripes);
    } catch (e) {
      console.warn('Failed to compute diff stripes:', e);
    }
  };

  // Mount CodeMirror MergeView or Unified EditorView
  useEffect(() => {
    if (!containerRef.current) return;
    destroyViews();

    const commonExts: Extension[] = [
      lineNumbers(),
      darculaTheme,
    ];
    if (langExtension) {
      commonExts.push(langExtension);
    }

    if (viewMode === 'side-by-side') {
      try {
        const sideBExtensions: Extension[] = [
          ...commonExts,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setHasModified(true);
              const text = update.state.doc.toString();
              currentLocalRef.current = text;
              onChangeLocal?.(text);
              if (mergeViewRef.current) {
                setChunksCount(mergeViewRef.current.chunks.length);
                updateStripesFromMergeView(mergeViewRef.current);
              }
            }
          }),
        ];

        const mv = new MergeView({
          a: {
            doc: baseContent || '',
            extensions: [
              ...commonExts,
              EditorState.readOnly.of(true),
            ],
          },
          b: {
            doc: currentLocalRef.current || '',
            extensions: sideBExtensions,
          },
          parent: containerRef.current,
          highlightChanges: highlightPolicy !== 'none',
          gutter: true,
          revertControls: 'a-to-b',
          renderRevertControl: () => {
            const btn = document.createElement('button');
            btn.className = 'cm-revert-intellij-btn';
            btn.innerHTML = '&raquo;';
            btn.title = 'Revert this hunk';
            return btn;
          },
        });

        // Ensure proper height & scrollability
        mv.dom.style.height = '100%';
        mv.dom.style.maxHeight = '100%';
        mv.dom.style.overflowY = 'auto';
        mv.dom.style.flex = '1';
        mv.dom.style.minHeight = '0';

        mergeViewRef.current = mv;
        const count = mv.chunks.length;
        setChunksCount(count);
        setActiveChunkIndex(count > 0 ? 1 : 0);
        updateStripesFromMergeView(mv);
      } catch (err) {
        console.error('Failed to create Side-by-Side MergeView in DiffEditorTab:', err);
      }
    } else {
      try {
        const unifiedExtensions: Extension[] = [
          ...commonExts,
          unifiedMergeView({
            original: baseContent || '',
            highlightChanges: highlightPolicy !== 'none',
            gutter: true,
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setHasModified(true);
              const text = update.state.doc.toString();
              currentLocalRef.current = text;
              onChangeLocal?.(text);
              const chunkInfo = getChunks(update.state);
              setChunksCount(chunkInfo?.chunks?.length ?? 0);
            }
          }),
        ];

        const state = EditorState.create({
          doc: currentLocalRef.current || '',
          extensions: unifiedExtensions,
        });

        const uv = new EditorView({
          state,
          parent: containerRef.current,
        });

        uv.dom.style.height = '100%';
        uv.dom.style.flex = '1';
        uv.dom.style.minHeight = '0';

        unifiedViewRef.current = uv;
        const chunkInfo = getChunks(state);
        const count = chunkInfo?.chunks?.length ?? 0;
        setChunksCount(count);
        setActiveChunkIndex(count > 0 ? 1 : 0);
      } catch (err) {
        console.error('Failed to create Unified MergeView in DiffEditorTab:', err);
      }
    }

    // Auto-focus editor so user can immediately scroll / navigate with keys
    const focusTimer = setTimeout(() => {
      if (viewMode === 'side-by-side' && mergeViewRef.current) {
        mergeViewRef.current.b.focus();
        updateStripesFromMergeView(mergeViewRef.current);
      } else if (unifiedViewRef.current) {
        unifiedViewRef.current.focus();
      }
    }, 80);

    return () => {
      clearTimeout(focusTimer);
      destroyViews();
    };
  }, [viewMode, baseContent, langExtension, highlightPolicy, filePath]);

  // Navigate difference chunks (F7 / Shift+F7)
  const handleNextChunk = () => {
    const targetView = viewMode === 'side-by-side' ? mergeViewRef.current?.b : unifiedViewRef.current;
    if (targetView) {
      targetView.focus();
      goToNextChunk(targetView);
      setActiveChunkIndex(prev => (chunksCount > 0 ? (prev % chunksCount) + 1 : 0));
    }
  };

  const handlePrevChunk = () => {
    const targetView = viewMode === 'side-by-side' ? mergeViewRef.current?.b : unifiedViewRef.current;
    if (targetView) {
      targetView.focus();
      goToPreviousChunk(targetView);
      setActiveChunkIndex(prev => (chunksCount > 0 ? (prev <= 1 ? chunksCount : prev - 1) : 0));
    }
  };

  // Click on Overview Ruler to scroll directly to the change
  const handleOverviewRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const ratio = Math.max(0, Math.min(1, clickY / rect.height));
    const targetView = viewMode === 'side-by-side' ? mergeViewRef.current?.b : unifiedViewRef.current;
    if (!targetView) return;
    const totalLines = targetView.state.doc.lines;
    const targetLineNum = Math.max(1, Math.min(totalLines, Math.round(ratio * totalLines)));
    const line = targetView.state.doc.line(targetLineNum);
    targetView.dispatch({
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
    targetView.focus();
  };

  // Save modified working copy (Ctrl+S)
  const handleSave = async () => {
    if (saveStatus === 'saving') return;
    setSaveStatus('saving');
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const normProj = (projectPath || 'D:\\IDE').replace(/\\/g, '/');
        const normFile = filePath.replace(/\\/g, '/');
        const fullPath = filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath) ? filePath : `${normProj}/${normFile}`;
        await invoke('write_file_content', { path: fullPath, content: currentLocalRef.current });
      }
      setHasModified(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      console.error('Failed to save file in DiffEditorTab:', e);
      setSaveStatus('idle');
    }
  };

  // Keyboard shortcuts (F7, Shift+F7, Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F7' && !e.shiftKey) {
        e.preventDefault();
        handleNextChunk();
      } else if (e.key === 'F7' && e.shiftKey) {
        e.preventDefault();
        handlePrevChunk();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chunksCount]);

  const displayHash = baseHash || '3b5775c8';
  const displayLocalTitle = localTitle || 'Current version';

  return (
    <div className="intellij-diff-wrapper w-full h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5] overflow-hidden select-none font-sans relative">
      {/* ─── INJECTED GLOBAL STYLES GUARANTEEING INTELLIJ DIFF LOOK ─── */}
      <style>{/* css */`
        .intellij-diff-wrapper .cm-mergeView {
          height: 100% !important;
          max-height: 100% !important;
          background-color: #1E1F22 !important;
          color: #DFE1E5 !important;
          font-family: 'JetBrains Mono', Consolas, Monaco, monospace !important;
          font-size: 12.5px !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }

        .intellij-diff-wrapper .cm-mergeViewEditors {
          min-height: 100% !important;
          display: flex !important;
          flex-direction: row !important;
        }

        .intellij-diff-wrapper .cm-mergeViewEditor {
          flex: 1 1 50% !important;
          min-width: 0 !important;
          height: 100% !important;
        }

        .intellij-diff-wrapper .cm-editor {
          height: 100% !important;
          background-color: #1E1F22 !important;
          color: #DFE1E5 !important;
          font-family: 'JetBrains Mono', Consolas, Monaco, monospace !important;
          font-size: 12.5px !important;
        }

        .intellij-diff-wrapper .cm-content {
          font-family: 'JetBrains Mono', Consolas, Monaco, monospace !important;
          padding: 4px 0 !important;
          user-select: text !important;
          -webkit-user-select: text !important;
          cursor: text !important;
        }

        .intellij-diff-wrapper .cm-line {
          user-select: text !important;
          -webkit-user-select: text !important;
        }

        .intellij-diff-wrapper .cm-scroller {
          font-family: 'JetBrains Mono', Consolas, Monaco, monospace !important;
          line-height: 1.5 !important;
          overflow-y: auto !important;
          overflow-x: auto !important;
        }

        .intellij-diff-wrapper .cm-gutters {
          background-color: #1E1F22 !important;
          color: #6F737A !important;
          border-right: 1px solid #2B2D30 !important;
        }

        .intellij-diff-wrapper .cm-activeLineGutter {
          background-color: #2B2D30 !important;
          color: #DFE1E5 !important;
        }

        /* ─── SIDE A (HEAD Revision - Removed/Deleted) ─── */
        .intellij-diff-wrapper .cm-merge-a .cm-changedLine {
          background-color: rgba(186, 56, 56, 0.28) !important;
          border: none !important;
          outline: none !important;
        }
        .intellij-diff-wrapper .cm-merge-a .cm-changedText {
          background: transparent !important;
          background-image: none !important;
          border: none !important;
          outline: none !important;
          text-decoration: none !important;
        }

        /* ─── SIDE B (Working Tree - Added/Modified - Smooth Flat IntelliJ Green) ─── */
        .intellij-diff-wrapper .cm-merge-b .cm-changedLine {
          background-color: rgba(42, 85, 52, 0.44) !important;
          border: none !important;
          outline: none !important;
        }
        /* Clear default underline and token box to preserve full syntax highlighting */
        .intellij-diff-wrapper .cm-merge-b .cm-changedText {
          background: transparent !important;
          background-image: none !important;
          border: none !important;
          outline: none !important;
          text-decoration: none !important;
        }

        /* ─── Change Gutter Indicator (IntelliJ vertical stripe) ─── */
        .intellij-diff-wrapper .cm-changeGutter {
          width: 5px !important;
          background-color: #1E1F22 !important;
        }
        .intellij-diff-wrapper .cm-merge-b .cm-changedLineGutter {
          background-color: #59A869 !important;
          width: 5px !important;
        }
        .intellij-diff-wrapper .cm-merge-a .cm-changedLineGutter {
          background-color: #E05555 !important;
          width: 5px !important;
        }

        /* Unified mode fallback */
        .intellij-diff-wrapper .cm-deletedChunk {
          background-color: rgba(186, 56, 56, 0.28) !important;
        }
        .intellij-diff-wrapper .cm-deletedChunk .cm-changedText {
          background: transparent !important;
          background-image: none !important;
        }
        .intellij-diff-wrapper .cm-insertedChunk {
          background-color: rgba(42, 85, 52, 0.44) !important;
        }
        .intellij-diff-wrapper .cm-insertedChunk .cm-changedText {
          background: transparent !important;
          background-image: none !important;
        }

        /* ─── Spacers (IntelliJ blank alignment filler) ─── */
        .intellij-diff-wrapper .cm-mergeSpacer {
          background-color: #1E1F22 !important;
        }

        /* ─── Middle Revert Gutter ─── */
        .intellij-diff-wrapper .cm-merge-revert {
          width: 26px !important;
          background-color: #25272B !important;
          border-left: 1px solid #323438 !important;
          border-right: 1px solid #323438 !important;
          position: relative !important;
          flex-shrink: 0 !important;
        }

        .intellij-diff-wrapper .cm-merge-revert button {
          position: absolute !important;
          width: 20px !important;
          height: 18px !important;
          left: 3px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background-color: transparent !important;
          border: none !important;
          color: #59A869 !important;
          cursor: pointer !important;
          font-size: 15px !important;
          font-weight: 800 !important;
          line-height: 1 !important;
          padding: 0 !important;
          transition: transform 0.15s ease, color 0.15s ease !important;
        }

        .intellij-diff-wrapper .cm-merge-revert button:hover {
          color: #72C081 !important;
          transform: scale(1.3) !important;
        }

        /* Sleek IntelliJ Scrollbars */
        .intellij-diff-wrapper .cm-mergeView::-webkit-scrollbar,
        .intellij-diff-wrapper .cm-scroller::-webkit-scrollbar {
          width: 14px;
          height: 10px;
        }
        .intellij-diff-wrapper .cm-mergeView::-webkit-scrollbar-track,
        .intellij-diff-wrapper .cm-scroller::-webkit-scrollbar-track {
          background-color: #1E1F22;
        }
        .intellij-diff-wrapper .cm-mergeView::-webkit-scrollbar-thumb,
        .intellij-diff-wrapper .cm-scroller::-webkit-scrollbar-thumb {
          background-color: #393B40;
          border-radius: 4px;
          border: 2px solid #1E1F22;
        }
        .intellij-diff-wrapper .cm-mergeView::-webkit-scrollbar-thumb:hover,
        .intellij-diff-wrapper .cm-scroller::-webkit-scrollbar-thumb:hover {
          background-color: #4E5157;
        }
      `}</style>

      {/* ─── Top Control Toolbar (Matching Image 2 Red Box 2) ─── */}
      <div className="h-8 bg-[#2B2D30] border-b border-[#323438] px-2 flex items-center justify-between text-xs text-[#868A91] select-none flex-shrink-0">
        <div className="flex items-center gap-1">
          {/* Previous Difference (Shift+F7) */}
          <button
            onClick={handlePrevChunk}
            title="Previous Difference (Shift+F7)"
            className="p-1 rounded hover:bg-[#35373B] hover:text-[#DFE1E5] transition-colors cursor-pointer"
          >
            <ArrowUp size={13} />
          </button>

          {/* Next Difference (F7) */}
          <button
            onClick={handleNextChunk}
            title="Next Difference (F7)"
            className="p-1 rounded hover:bg-[#35373B] hover:text-[#DFE1E5] transition-colors cursor-pointer"
          >
            <ArrowDown size={13} />
          </button>

          <div className="w-px h-3.5 bg-[#3E4147] mx-1" />

          {/* Dropdown 1: Side-by-side viewer / Unified */}
          <div className="relative">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as any)}
              className="bg-[#2B2D30] hover:bg-[#35373B] text-[#DFE1E5] text-[11px] px-2 py-1 rounded border border-[#393B40] outline-none cursor-pointer pr-5 appearance-none font-sans"
            >
              <option value="side-by-side">Side-by-side viewer</option>
              <option value="unified">Unified viewer</option>
            </select>
            <ChevronDown size={10} className="absolute right-1.5 top-2.5 text-[#868A91] pointer-events-none" />
          </div>

          {/* Dropdown 2: Whitespace Policy */}
          <div className="relative">
            <select
              value={whitespacePolicy}
              onChange={(e) => setWhitespacePolicy(e.target.value as any)}
              className="bg-[#2B2D30] hover:bg-[#35373B] text-[#DFE1E5] text-[11px] px-2 py-1 rounded border border-[#393B40] outline-none cursor-pointer pr-5 appearance-none font-sans"
            >
              <option value="do-not-ignore">Do not ignore</option>
              <option value="ignore">Ignore whitespaces</option>
              <option value="trim">Ignore leading/trailing</option>
            </select>
            <ChevronDown size={10} className="absolute right-1.5 top-2.5 text-[#868A91] pointer-events-none" />
          </div>

          {/* Dropdown 3: Highlight Words / Lines */}
          <div className="relative">
            <select
              value={highlightPolicy}
              onChange={(e) => setHighlightPolicy(e.target.value as any)}
              className="bg-[#2B2D30] hover:bg-[#35373B] text-[#DFE1E5] text-[11px] px-2 py-1 rounded border border-[#393B40] outline-none cursor-pointer pr-5 appearance-none font-sans"
            >
              <option value="words">Highlight words</option>
              <option value="lines">Highlight lines</option>
              <option value="split">Highlight split</option>
              <option value="none">Do not highlight</option>
            </select>
            <ChevronDown size={10} className="absolute right-1.5 top-2.5 text-[#868A91] pointer-events-none" />
          </div>

          <div className="w-px h-3.5 bg-[#3E4147] mx-1" />

          {/* Settings Menu Gear */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              title="Diff View Settings"
              className="p-1 rounded hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
            >
              <Settings size={13} />
            </button>
            {showSettingsMenu && (
              <div 
                className="absolute left-0 top-full mt-1 w-52 bg-[#2B2D30] border border-[#393B40] rounded shadow-xl py-1 z-50 text-[11px]"
                onMouseLeave={() => setShowSettingsMenu(false)}
              >
                <div className="px-3 py-1 font-semibold text-[#868A91] uppercase text-[9px] tracking-wider">Settings</div>
                <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
                  <span>Synchronize Scrolling</span>
                  <Check size={12} />
                </div>
                <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
                  <span>Collapse Unchanged</span>
                </div>
                <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
                  <span>Align Changes</span>
                </div>
              </div>
            )}
          </div>

          {/* Help Button */}
          <button
            title="Diff Viewer Help"
            className="p-1 rounded hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
          >
            <HelpCircle size={13} />
          </button>
        </div>

        {/* Right Info: Save button & Clean Differences Count (Matching Image 2) */}
        <div className="flex items-center gap-3 pr-4">
          {hasModified && (
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#3574F0] hover:bg-[#3068D9] text-white rounded text-[11px] font-medium transition-colors cursor-pointer shadow-sm"
              title="Save changes (Ctrl+S)"
            >
              <Save size={12} />
              <span>{saveStatus === 'saving' ? 'Saving...' : 'Save'}</span>
            </button>
          )}

          {saveStatus === 'saved' && (
            <div className="flex items-center gap-1 text-[11px] text-[#59A869] font-medium px-2 py-0.5 rounded bg-[#59A869]/10 border border-[#59A869]/20">
              <Check size={12} />
              <span>Saved</span>
            </div>
          )}

          <div className="text-[11px] font-mono text-[#868A91]">
            <span className="text-[#3574F0] font-semibold">{chunksCount}</span> difference{chunksCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* ─── Sub-Header Bar (Revision Hash, File Path, CRLF/LF) Matching Image 2 ─── */}
      <div className="h-6 bg-[#25272B] border-b border-[#323438] flex items-center text-[11px] text-[#868A91] select-none flex-shrink-0 font-mono pr-4">
        {/* Left Side: Revision Hash + File Path */}
        <div className="flex-1 px-3 flex items-center justify-between border-r border-[#323438] truncate min-w-0">
          <div className="flex items-center gap-2 truncate">
            <span className="text-[#59A869] font-semibold">{displayHash}</span>
            <span className="text-[#CED0D6] truncate">{filePath.replace(/\\/g, '/')}</span>
          </div>
          <span className="text-[10px] text-[#6F737A] ml-2 flex-shrink-0">CRLF</span>
        </div>

        {/* Center Gap for Middle Gutter */}
        {viewMode === 'side-by-side' && (
          <div className="w-[26px] bg-[#25272B] border-r border-[#323438] flex-shrink-0" />
        )}

        {/* Right Side: Current Version + LF */}
        <div className="flex-1 px-3 flex items-center justify-between truncate min-w-0">
          <div className="flex items-center gap-2 truncate">
            <span className="text-[#DFE1E5] font-semibold">{displayLocalTitle}</span>
          </div>
          <span className="text-[10px] text-[#6F737A] ml-2 flex-shrink-0">LF</span>
        </div>
      </div>

      {/* ─── Core Diff Editor Container with Right Overview Ruler ─── */}
      <div className="flex-1 relative min-h-0 w-full overflow-hidden flex flex-row">
        {/* Editor Main Canvas */}
        <div ref={containerRef} className="flex-1 relative h-full overflow-hidden" />

        {/* ─── Authentic IntelliJ Overview Ruler / Error Stripe Bar (Matching Image 2 Red Box Right) ─── */}
        <div
          onClick={handleOverviewRulerClick}
          className="w-[14px] h-full bg-[#1E1F22] border-l border-[#2B2D30] relative flex-shrink-0 cursor-pointer select-none overflow-hidden"
          title="Click to jump to change"
        >
          {diffStripes.map((stripe, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                top: `${stripe.topPercent}%`,
                height: `${stripe.heightPercent}%`,
                minHeight: '4px',
                left: '2px',
                right: '2px',
                backgroundColor: stripe.color,
                borderRadius: '1px',
                opacity: 0.85,
              }}
              title={`Diff lines ${stripe.fromLine} - ${stripe.toLine}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
