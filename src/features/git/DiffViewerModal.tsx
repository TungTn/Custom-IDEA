import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Columns, 
  Rows, 
  ArrowDown, 
  ArrowUp, 
  FileCode, 
  Copy, 
  Check, 
  RotateCcw,
  Save
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
import { resolveProjectPath } from '../../utils/pathUtils';

export interface DiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  baseContent: string;
  localContent: string;
  baseTitle?: string;
  localTitle?: string;
  projectPath?: string;
  onRollback?: () => void;
  onSave?: (newContent: string) => Promise<void> | void;
  readOnly?: boolean;
}

// Authentic IntelliJ IDEA New UI theme for CodeMirror 6 MergeView
const intellijDiffStyles = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: '#1E1F22',
    color: '#DFE1E5',
    fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
    fontSize: '12.5px',
  },
  '.cm-content': {
    fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
    padding: '4px 0',
    userSelect: 'text !important',
    WebkitUserSelect: 'text !important',
    cursor: 'text',
  },
  '.cm-line': {
    userSelect: 'text !important',
    WebkitUserSelect: 'text !important',
  },
  // MergeView root styling - Must be scrollable
  '.cm-mergeView': {
    height: '100% !important',
    maxHeight: '100% !important',
    overflowY: 'auto !important',
    overflowX: 'hidden',
  },
  '.cm-mergeViewEditors': {
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'row',
  },
  '.cm-mergeViewEditor': {
    flex: '1 1 50%',
    minWidth: '0',
    height: '100%',
  },
  '.cm-mergeViewEditor .cm-editor': {
    height: '100%',
  },
  '.cm-mergeViewEditor .cm-scroller': {
    overflow: 'visible !important',
  },
  // Unified single editor styles
  '&.cm-editor': {
    height: '100% !important',
  },
  '.cm-scroller': {
    fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
    lineHeight: '1.5',
    overflowY: 'auto !important',
    overflowX: 'auto !important',
  },
  // Revert buttons gutter (IntelliJ style)
  '.cm-merge-revert': {
    width: '26px',
    backgroundColor: '#25272B',
    borderLeft: '1px solid #323438',
    borderRight: '1px solid #323438',
    flexShrink: '0',
    position: 'relative',
  },
  '.cm-merge-revert button': {
    position: 'absolute',
    width: '20px',
    height: '18px',
    left: '3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2B2D30',
    border: '1px solid #3E4147',
    color: '#3574F0',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold',
    transition: 'all 0.15s ease',
    '&:hover': {
      backgroundColor: '#3574F0',
      borderColor: '#3574F0',
      color: '#FFFFFF',
    },
  },
  // Gutters and line numbers
  '.cm-gutters': {
    backgroundColor: '#1E1F22',
    color: '#6F737A',
    borderRight: '1px solid #2B2D30',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#2B2D30',
    color: '#DFE1E5',
  },
  // Diff highlights - Side A (Removed / Original)
  '.cm-merge-a .cm-changedLine': {
    backgroundColor: 'rgba(224, 85, 85, 0.16) !important',
  },
  '.cm-merge-a .cm-changedText': {
    backgroundColor: 'rgba(224, 85, 85, 0.38) !important',
    borderRadius: '2px',
  },
  // Diff highlights - Side B (Added / Modified)
  '.cm-merge-b .cm-changedLine': {
    backgroundColor: 'rgba(89, 168, 105, 0.16) !important',
  },
  '.cm-merge-b .cm-changedText': {
    backgroundColor: 'rgba(89, 168, 105, 0.38) !important',
    borderRadius: '2px',
  },
  // Unified mode decorations
  '.cm-deletedChunk': {
    backgroundColor: 'rgba(224, 85, 85, 0.16) !important',
  },
  '.cm-insertedChunk': {
    backgroundColor: 'rgba(89, 168, 105, 0.16) !important',
  },
  '.cm-deletedChunk .cm-changedText': {
    backgroundColor: 'rgba(224, 85, 85, 0.38) !important',
  },
  '.cm-insertedChunk .cm-changedText': {
    backgroundColor: 'rgba(89, 168, 105, 0.38) !important',
  },
  // Scrollbar styling for a sleek IntelliJ look
  '.cm-mergeView::-webkit-scrollbar, .cm-scroller::-webkit-scrollbar': {
    width: '10px',
    height: '10px',
  },
  '.cm-mergeView::-webkit-scrollbar-track, .cm-scroller::-webkit-scrollbar-track': {
    backgroundColor: '#1E1F22',
  },
  '.cm-mergeView::-webkit-scrollbar-thumb, .cm-scroller::-webkit-scrollbar-thumb': {
    backgroundColor: '#393B40',
    borderRadius: '4px',
    border: '2px solid #1E1F22',
  },
  '.cm-mergeView::-webkit-scrollbar-thumb:hover, .cm-scroller::-webkit-scrollbar-thumb:hover': {
    backgroundColor: '#4E5157',
  },
});

export const DiffViewerModal: React.FC<DiffViewerModalProps> = ({
  isOpen,
  onClose,
  fileName,
  baseContent,
  localContent,
  baseTitle,
  localTitle,
  projectPath,
  onRollback,
  onSave,
  readOnly = false,
}) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
  const [copied, setCopied] = useState(false);
  const [activeChunkIndex, setActiveChunkIndex] = useState(0);
  const [chunksCount, setChunksCount] = useState(0);
  const [hasModified, setHasModified] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);
  const unifiedViewRef = useRef<EditorView | null>(null);
  const currentLocalRef = useRef<string>(localContent || '');

  // Keep local reference in sync when incoming props change
  useEffect(() => {
    currentLocalRef.current = localContent || '';
    setHasModified(false);
  }, [localContent]);

  // Load language extension based on file extension
  const [langExtension, setLangExtension] = useState<Extension | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const loadLang = async () => {
      const ext = fileName.split('.').pop()?.toLowerCase();
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
  }, [fileName]);

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

  // Mount CodeMirror MergeView or Unified EditorView
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    destroyViews();

    const commonExts: Extension[] = [
      lineNumbers(),
      darculaTheme,
      intellijDiffStyles,
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
              currentLocalRef.current = update.state.doc.toString();
              if (mergeViewRef.current) {
                setChunksCount(mergeViewRef.current.chunks.length);
              }
            }
          }),
        ];
        if (readOnly) {
          sideBExtensions.push(EditorState.readOnly.of(true));
        }

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
          highlightChanges: true,
          gutter: true,
          revertControls: readOnly ? undefined : 'a-to-b',
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
      } catch (err) {
        console.error('Failed to create Side-by-Side MergeView:', err);
      }
    } else {
      try {
        const unifiedExtensions: Extension[] = [
          ...commonExts,
          unifiedMergeView({
            original: baseContent || '',
            highlightChanges: true,
            gutter: true,
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setHasModified(true);
              currentLocalRef.current = update.state.doc.toString();
              const chunkInfo = getChunks(update.state);
              setChunksCount(chunkInfo?.chunks?.length ?? 0);
            }
          }),
        ];
        if (readOnly) {
          unifiedExtensions.push(EditorState.readOnly.of(true));
        }

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
        console.error('Failed to create Unified MergeView:', err);
      }
    }

    // Auto-focus editor so user can immediately scroll / navigate with keys
    const focusTimer = setTimeout(() => {
      if (viewMode === 'side-by-side' && mergeViewRef.current) {
        mergeViewRef.current.b.focus();
      } else if (unifiedViewRef.current) {
        unifiedViewRef.current.focus();
      }
    }, 60);

    return () => {
      clearTimeout(focusTimer);
      destroyViews();
    };
  }, [isOpen, viewMode, baseContent, langExtension, readOnly]);

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

  // Save modified working copy
  const handleSave = async () => {
    if (saveStatus === 'saving') return;
    setSaveStatus('saving');
    try {
      if (onSave) {
        await onSave(currentLocalRef.current);
      } else if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const fullPath = resolveProjectPath(fileName, projectPath);
        if (!fullPath) {
          throw new Error('Cannot resolve file path without an active projectPath');
        }
        await invoke('save_file_content', { path: fullPath, content: currentLocalRef.current });
      }
      setHasModified(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save file from diff viewer:', err);
      setSaveStatus('idle');
    }
  };

  const keyHandlersRef = useRef({ onClose, handleNextChunk, handlePrevChunk, handleSave });
  keyHandlersRef.current = { onClose, handleNextChunk, handlePrevChunk, handleSave };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        keyHandlersRef.current.onClose();
      } else if (e.key === 'F7' && !e.shiftKey) {
        e.preventDefault();
        keyHandlersRef.current.handleNextChunk();
      } else if (e.key === 'F7' && e.shiftKey) {
        e.preventDefault();
        keyHandlersRef.current.handlePrevChunk();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        keyHandlersRef.current.handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const isLoading = baseContent === 'Loading...' || localContent === 'Loading...';

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[94vw] h-[90vh] max-w-[1450px] bg-[#1E1F22] border border-[#393B40] rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs font-sans text-[#DFE1E5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Top Header Bar (Authentic IntelliJ IDEA Diff Viewer) ─── */}
        <div className="h-10 bg-[#2B2D30] border-b border-[#393B40] px-4 flex items-center justify-between flex-shrink-0 select-none">
          {/* File Name & Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FileCode size={16} className="text-[#3574F0]" />
              <span className="font-semibold text-[13px] text-white font-mono">{fileName}</span>
            </div>

            <div className="flex items-center gap-2 text-[11px] px-2 py-0.5 rounded bg-[#1E1F22] border border-[#393B40]">
              <span className="text-[#3574F0] font-semibold">
                {chunksCount} difference{chunksCount !== 1 ? 's' : ''}
              </span>
            </div>

            {hasModified && (
              <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-[#3574F0]/20 text-[#3574F0] border border-[#3574F0]/40 font-medium">
                Modified
              </span>
            )}
          </div>

          {/* Controls: Next/Prev Difference & Mode Switcher */}
          <div className="flex items-center gap-2">
            {/* Save Button (when modified) */}
            {hasModified && (
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-[#3574F0] hover:bg-[#3068D9] text-white rounded text-[11px] font-medium transition-colors cursor-pointer shadow-sm"
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

            {/* Diff Chunk Stepper (Next/Prev Difference) */}
            <div className="flex items-center bg-[#1E1F22] border border-[#393B40] rounded px-1 py-0.5 gap-1">
              <button
                onClick={handlePrevChunk}
                disabled={chunksCount === 0}
                title="Previous Difference (Shift+F7)"
                className="p-1 rounded hover:bg-[#35373B] text-[#DFE1E5] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ArrowUp size={13} />
              </button>
              <span className="text-[10.5px] px-1 font-mono text-[#A8ADBD]">
                {chunksCount > 0 ? `${activeChunkIndex}/${chunksCount}` : '0/0'}
              </span>
              <button
                onClick={handleNextChunk}
                disabled={chunksCount === 0}
                title="Next Difference (F7)"
                className="p-1 rounded hover:bg-[#35373B] text-[#DFE1E5] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ArrowDown size={13} />
              </button>
            </div>

            {/* View Mode Toggle: Side-by-Side vs Unified */}
            <div className="flex items-center bg-[#1E1F22] border border-[#393B40] rounded p-0.5">
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                  viewMode === 'side-by-side'
                    ? 'bg-[#3574F0] text-white font-semibold'
                    : 'text-[#868A91] hover:text-[#DFE1E5]'
                }`}
                title="Side-by-Side Diff"
              >
                <Columns size={12} />
                <span>Side-by-Side</span>
              </button>
              <button
                onClick={() => setViewMode('unified')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                  viewMode === 'unified'
                    ? 'bg-[#3574F0] text-white font-semibold'
                    : 'text-[#868A91] hover:text-[#DFE1E5]'
                }`}
                title="Unified Diff"
              >
                <Rows size={12} />
                <span>Unified</span>
              </button>
            </div>

            {/* Rollback changes button if onRollback exists */}
            {onRollback && (
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to rollback all changes in ${fileName}?`)) {
                    onRollback();
                    onClose();
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#E05555]/20 hover:bg-[#E05555]/30 text-[#E05555] border border-[#E05555]/40 rounded text-[11px] font-medium transition-colors cursor-pointer"
                title="Rollback (Revert) this file"
              >
                <RotateCcw size={12} />
                <span>Rollback</span>
              </button>
            )}

            {/* Copy full modified code */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentLocalRef.current);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              title="Copy working file content (Ctrl+C)"
              className="p-1.5 rounded hover:bg-[#35373B] text-[#868A91] hover:text-white transition-colors cursor-pointer"
            >
              {copied ? <Check size={14} className="text-[#59A869]" /> : <Copy size={14} />}
            </button>

            {/* Close Modal Button */}
            <button
              onClick={onClose}
              title="Close (Esc)"
              className="p-1.5 rounded hover:bg-[#E05555] hover:text-white text-[#868A91] transition-colors cursor-pointer ml-1"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ─── Column Sub-Headers (Base vs Your Version) ─── */}
        {viewMode === 'side-by-side' && (
          <div className="h-6 bg-[#25272B] border-b border-[#323438] flex text-[11px] text-[#868A91] select-none flex-shrink-0">
            <div className="flex-1 px-4 flex items-center justify-between border-r border-[#323438]">
              <span className="font-semibold text-[#DFE1E5]">{baseTitle || 'Base Revision (HEAD)'}</span>
              <span className="text-[10px] text-[#868A91]">Repository (Read-Only)</span>
            </div>
            <div className="w-[26px] bg-[#25272B] border-r border-[#323438]" />
            <div className="flex-1 px-4 flex items-center justify-between">
              <span className="font-semibold text-[#DFE1E5]">{localTitle || 'Your Version (Working Tree)'}</span>
              <span className="text-[10px] text-[#59A869]">Local Changes (Editable)</span>
            </div>
          </div>
        )}

        {/* ─── CodeMirror Diff Viewport (Scrollable, Virtualized, Selectable) ─── */}
        <div className="flex-1 overflow-hidden relative select-text font-mono text-[12.5px] flex flex-col min-h-0 bg-[#1E1F22]">
          {isLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-xs text-[#868A91] gap-2">
              <div className="w-5 h-5 border-2 border-[#3574F0] border-t-transparent rounded-full animate-spin" />
              <span>Loading diff comparisons...</span>
            </div>
          ) : (
            <div 
              ref={containerRef} 
              className="w-full h-full min-h-0 flex-1 relative select-text" 
              style={{ minHeight: 0, height: '100%' }}
            />
          )}
        </div>

        {/* ─── Bottom Status Bar ─── */}
        <div className="h-6 bg-[#2B2D30] border-t border-[#393B40] px-3 flex items-center justify-between text-[11px] text-[#868A91] select-none flex-shrink-0">
          <div className="flex items-center gap-3">
            <span>
              Press <kbd className="px-1 py-0.5 bg-[#1E1F22] rounded border border-[#393B40] text-[10px] text-[#DFE1E5]">F7</kbd> / <kbd className="px-1 py-0.5 bg-[#1E1F22] rounded border border-[#393B40] text-[10px] text-[#DFE1E5]">Shift+F7</kbd> to jump between changes
            </span>
            <span>·</span>
            <span>
              Press <kbd className="px-1 py-0.5 bg-[#1E1F22] rounded border border-[#393B40] text-[10px] text-[#DFE1E5]">Ctrl+S</kbd> to save
            </span>
          </div>
          <div className="text-[10px] text-[#6F737A]">
            CodeMirror 6 Engine · {fileName}
          </div>
        </div>
      </div>
    </div>
  );
};
