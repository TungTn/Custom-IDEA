import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  GitCommit, 
  X, 
  CheckSquare, 
  Square, 
  ArrowUpRight, 
  FileCode, 
  RefreshCw,
  RotateCcw,
  Columns,
  Maximize2
} from 'lucide-react';
import { DiffViewerModal } from './DiffViewerModal';

interface GitCommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: string;
  projectPath?: string;
  onCommit: (message: string, andPush: boolean, files: string[], amend?: boolean) => void;
}

export const GitCommitModal: React.FC<GitCommitModalProps> = ({
  isOpen,
  onClose,
  branch,
  projectPath = 'D:\\IDE',
  onCommit,
}) => {
  const [message, setMessage] = useState('');
  const [isAmend, setIsAmend] = useState(false);
  const [changedFiles, setChangedFiles] = useState<Array<{ path: string; status: string }>>([]);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>({});
  const [activeFileForDiff, setActiveFileForDiff] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Side-by-Side Diff Viewer Modal state
  const [isFullDiffOpen, setIsFullDiffOpen] = useState(false);
  const [fullDiffBase, setFullDiffBase] = useState('');
  const [fullDiffLocal, setFullDiffLocal] = useState('');

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const res = await invoke<{ branch: string; changes: Array<{ path: string; status: string }>; is_clean: boolean }>('git_get_status', { projectPath });
        if (res && Array.isArray(res.changes)) {
          setChangedFiles(res.changes);
          const sel: Record<string, boolean> = {};
          res.changes.forEach(c => { sel[c.path] = true; });
          setSelectedFiles(sel);
          if (res.changes.length > 0) {
            setActiveFileForDiff(res.changes[0].path);
          } else {
            setActiveFileForDiff(null);
          }
        }
      } else {
        setChangedFiles([]);
        setSelectedFiles({});
        setActiveFileForDiff(null);
      }
    } catch (e) {
      console.warn('git_get_status error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setIsAmend(false);
      fetchStatus();
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen, projectPath]);

  // Fetch diff when activeFileForDiff changes
  useEffect(() => {
    if (!activeFileForDiff || !isOpen) {
      setDiffContent('');
      return;
    }

    const fetchDiff = async () => {
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          const diff = await invoke<string>('git_get_diff', { projectPath, filePath: activeFileForDiff });
          setDiffContent(diff || 'No textual changes or new untracked file.');
        } else {
          setDiffContent(`--- a/${activeFileForDiff}\n+++ b/${activeFileForDiff}\n@@ -1,5 +1,6 @@\n+ // Real git integration connected`);
        }
      } catch (e) {
        setDiffContent(String(e));
      }
    };

    fetchDiff();
  }, [activeFileForDiff, isOpen, projectPath]);

  // Rollback file
  const handleRollbackFile = async (filePath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_rollback_file', { projectPath, filePath });
      }
      fetchStatus();
    } catch (err) {
      console.warn('Rollback failed:', err);
    }
  };

  // Open 2-Way Side-by-Side Diff Viewer
  const handleOpenSideBySideDiff = async () => {
    if (!activeFileForDiff) return;
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const base = await invoke<string>('git_get_file_content_at_head', { projectPath, filePath: activeFileForDiff }).catch(() => '');
        const local = await invoke<string>('read_file_content', { filePath: `${projectPath}/${activeFileForDiff}` }).catch(() => '');
        setFullDiffBase(base);
        setFullDiffLocal(local);
        setIsFullDiffOpen(true);
      } else {
        setFullDiffBase('');
        setFullDiffLocal('');
        setIsFullDiffOpen(false);
      }
    } catch (e) {
      console.warn('handleOpenSideBySideDiff error:', e);
    }
  };

  if (!isOpen) return null;

  const filesList = changedFiles.map(c => c.path);
  const selectedCount = Object.values(selectedFiles).filter(Boolean).length;
  const selectedFilesList = Object.keys(selectedFiles).filter(k => selectedFiles[k]);

  const toggleFile = (f: string) => {
    setSelectedFiles(prev => ({ ...prev, [f]: !prev[f] }));
  };

  const handleCommitOnly = () => {
    if (!message.trim() || selectedCount === 0) return;
    onCommit(message.trim(), false, selectedFilesList, isAmend);
    onClose();
  };

  const handleCommitAndPush = () => {
    if (!message.trim() || selectedCount === 0) return;
    onCommit(message.trim(), true, selectedFilesList, isAmend);
    onClose();
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
        onClick={onClose}
      >
        <div 
          className="w-[880px] max-h-[85vh] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="h-10 border-b border-[#393B40] px-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#DFE1E5]">
              <GitCommit size={15} className="text-[#3574F0]" />
              <span>Commit Changes to <strong className="text-white">[{branch}]</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchStatus} title="Refresh Git Status" className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5] cursor-pointer">
                <RefreshCw size={13} className={isLoading ? 'animate-spin text-[#3574F0]' : ''} />
              </button>
              <button onClick={onClose} className="p-0.5 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5] cursor-pointer">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Content (Split Pane: Left Files + Message, Right Live Diff) */}
          <div className="flex-1 flex overflow-hidden p-4 gap-4 text-[12px] text-[#DFE1E5]">
            {/* Left Column */}
            <div className="w-[380px] flex flex-col space-y-3">
              {/* Changed Files */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center text-[11px] text-[#868A91] mb-1.5">
                  <span className="font-medium">Changes ({selectedCount} of {filesList.length})</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const allSelected = selectedCount === filesList.length;
                        const next: Record<string, boolean> = {};
                        filesList.forEach(f => next[f] = !allSelected);
                        setSelectedFiles(next);
                      }}
                      className="hover:text-[#3574F0] cursor-pointer"
                    >
                      Toggle All
                    </button>
                  </div>
                </div>

                <div className="flex-1 bg-[#1E1F22] border border-[#393B40] rounded-lg p-1.5 overflow-y-auto space-y-1">
                  {filesList.length === 0 ? (
                    <div className="text-[#868A91] text-center py-8 italic text-xs">
                      No changes detected in working tree.
                    </div>
                  ) : (
                    changedFiles.map((c) => {
                      const file = c.path;
                      const isChecked = selectedFiles[file] ?? false;
                      const isActive = activeFileForDiff === file;

                      return (
                        <div 
                          key={file}
                          onClick={() => setActiveFileForDiff(file)}
                          className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                            isActive ? 'bg-[#2E436E]' : 'hover:bg-[#2B2D30]'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate flex-1">
                            <div onClick={(e) => { e.stopPropagation(); toggleFile(file); }}>
                              {isChecked ? (
                                <CheckSquare size={13} className="text-[#3574F0]" />
                              ) : (
                                <Square size={13} className="text-[#868A91]" />
                              )}
                            </div>
                            <span className="font-mono text-[11px] truncate">{file}</span>
                          </div>

                          <div className="flex items-center gap-1.5 ml-2">
                            {/* Rollback file */}
                            <button
                              onClick={(e) => handleRollbackFile(file, e)}
                              title="Rollback Changes (Revert file)"
                              className="p-1 rounded hover:bg-[#393B40] text-[#868A91] hover:text-[#E05555] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              <RotateCcw size={11} />
                            </button>

                            <span className={`text-[10px] font-semibold px-1 rounded ${
                              c.status === 'M' ? 'text-[#3574F0] bg-[#3574F0]/10' :
                              c.status === 'A' || c.status === '??' ? 'text-[#59A869] bg-[#59A869]/10' :
                              'text-[#E05555] bg-[#E05555]/10'
                            }`}>
                              {c.status}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Commit Message Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-[#868A91]">Commit Message:</label>
                  <label className="flex items-center gap-1 cursor-pointer text-[11px] text-[#868A91] hover:text-[#DFE1E5]">
                    <input 
                      type="checkbox" 
                      checked={isAmend} 
                      onChange={(e) => setIsAmend(e.target.checked)} 
                      className="rounded accent-[#3574F0]"
                    />
                    <span>Amend</span>
                  </label>
                </div>

                <textarea
                  ref={textareaRef}
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleCommitOnly();
                    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
                      handleCommitAndPush();
                    }
                  }}
                  placeholder="Commit message (Ctrl+Enter to commit)..."
                  className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded p-2 text-xs text-[#DFE1E5] font-sans outline-none resize-none"
                />
              </div>
            </div>

            {/* Right Column: Live Diff View */}
            <div className="flex-1 flex flex-col border border-[#393B40] rounded-lg bg-[#1E1F22] overflow-hidden">
              <div className="h-7 bg-[#26282E] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] text-[#868A91]">
                <span className="flex items-center gap-1.5 font-medium truncate">
                  <FileCode size={13} className="text-[#3574F0]" />
                  {activeFileForDiff || 'Diff Viewer'}
                </span>
                
                {activeFileForDiff && (
                  <button
                    onClick={handleOpenSideBySideDiff}
                    title="Open Side-by-Side 2-Way Diff Viewer (Ctrl+D)"
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[#35373B] text-[#3574F0] cursor-pointer"
                  >
                    <Columns size={12} />
                    <span className="text-[10px]">Side-by-side</span>
                  </button>
                )}
              </div>

              <div className="flex-1 p-2 overflow-auto font-mono text-[11px] leading-relaxed select-text bg-[#1E1F22]">
                {!activeFileForDiff ? (
                  <div className="text-[#868A91] text-center py-10 italic">Select a file to inspect diff</div>
                ) : diffContent ? (
                  diffContent.split('\n').map((line, idx) => {
                    let lineClass = 'text-[#DFE1E5]';
                    if (line.startsWith('+') && !line.startsWith('+++')) lineClass = 'text-[#59A869] bg-[#59A869]/10 px-1 rounded-sm';
                    if (line.startsWith('-') && !line.startsWith('---')) lineClass = 'text-[#E05555] bg-[#E05555]/10 px-1 rounded-sm';
                    if (line.startsWith('@@')) lineClass = 'text-[#85B1F8] font-semibold';

                    return (
                      <div key={idx} className={`${lineClass} whitespace-pre`}>
                        {line}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[#868A91] text-center py-10 italic">No diff available</div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="h-11 bg-[#26282E] border-t border-[#393B40] px-4 flex items-center justify-between text-xs">
            <span className="text-[11px] text-[#868A91]">
              <kbd className="px-1 py-0.5 bg-[#1E1F22] border border-[#393B40] rounded text-[#DFE1E5]">Ctrl+Enter</kbd> to commit
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCommitOnly}
                disabled={!message.trim() || selectedCount === 0}
                className="px-3.5 py-1.5 bg-[#2B2D30] border border-[#393B40] hover:bg-[#35373B] disabled:opacity-40 text-[#DFE1E5] rounded text-xs font-medium cursor-pointer"
              >
                {isAmend ? 'Amend Commit' : 'Commit'}
              </button>
              <button
                onClick={handleCommitAndPush}
                disabled={!message.trim() || selectedCount === 0}
                className="px-3.5 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-40 text-white rounded text-xs font-medium shadow flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isAmend ? 'Amend & Push' : 'Commit & Push'}</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Diff Modal */}
      <DiffViewerModal
        isOpen={isFullDiffOpen}
        onClose={() => setIsFullDiffOpen(false)}
        fileName={activeFileForDiff || ''}
        baseContent={fullDiffBase}
        localContent={fullDiffLocal}
        onRollback={() => {
          if (activeFileForDiff) {
            handleRollbackFile(activeFileForDiff);
            setIsFullDiffOpen(false);
          }
        }}
      />
    </>
  );
};

