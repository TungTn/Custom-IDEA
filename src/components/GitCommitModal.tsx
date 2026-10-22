import React, { useState, useEffect, useRef } from 'react';
import { GitCommit, X, CheckSquare, Square, ArrowUpRight } from 'lucide-react';

interface GitCommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: string;
  onCommit: (message: string, andPush: boolean) => void;
}

export const GitCommitModal: React.FC<GitCommitModalProps> = ({
  isOpen,
  onClose,
  branch,
  onCommit,
}) => {
  const [message, setMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>({
    'src-tauri/src/main.rs': true,
    'src/App.tsx': true,
    'src/components/TopBar.tsx': true,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filesList = Object.keys(selectedFiles);
  const selectedCount = Object.values(selectedFiles).filter(Boolean).length;

  const toggleFile = (f: string) => {
    setSelectedFiles(prev => ({ ...prev, [f]: !prev[f] }));
  };

  const handleCommitOnly = () => {
    if (!message.trim()) return;
    onCommit(message.trim(), false);
    onClose();
  };

  const handleCommitAndPush = () => {
    if (!message.trim()) return;
    onCommit(message.trim(), true);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[560px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-10 border-b border-[#393B40] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#DFE1E5]">
            <GitCommit size={15} className="text-[#3574F0]" />
            <span>Commit Changes to <strong className="text-white">[{branch}]</strong></span>
          </div>
          <button onClick={onClose} className="p-0.5 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5]">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5 text-[12px] text-[#DFE1E5]">
          {/* Changed Files */}
          <div>
            <div className="flex justify-between text-[11px] text-[#868A91] mb-1.5">
              <span>Changed Files ({selectedCount} of {filesList.length} staged)</span>
              <button 
                onClick={() => {
                  const allSelected = selectedCount === filesList.length;
                  const next: Record<string, boolean> = {};
                  filesList.forEach(f => next[f] = !allSelected);
                  setSelectedFiles(next);
                }}
                className="hover:text-[#3574F0]"
              >
                Toggle All
              </button>
            </div>
            <div className="bg-[#1E1F22] border border-[#393B40] rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
              {filesList.map((file) => {
                const isChecked = selectedFiles[file] ?? false;
                return (
                  <div 
                    key={file}
                    onClick={() => toggleFile(file)}
                    className="flex items-center gap-2 px-1.5 py-1 hover:bg-[#2B2D30] rounded cursor-pointer text-xs"
                  >
                    {isChecked ? (
                      <CheckSquare size={13} className="text-[#3574F0]" />
                    ) : (
                      <Square size={13} className="text-[#868A91]" />
                    )}
                    <span className="font-mono text-[11px] truncate flex-1">{file}</span>
                    <span className="text-[10px] text-[#59A869]">Modified</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Commit Message Textarea */}
          <div>
            <label className="text-[11px] text-[#868A91] block mb-1">Commit Message:</label>
            <textarea
              ref={textareaRef}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="feat: implement interactive menu system with submenus and shortcuts"
              className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded p-2.5 text-xs text-[#DFE1E5] font-sans outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="h-11 bg-[#26282E] border-t border-[#393B40] px-4 flex items-center justify-between text-xs">
          <span className="text-[11px] text-[#868A91]">Press Ctrl+Enter to commit</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B]"
            >
              Cancel
            </button>
            <button
              onClick={handleCommitOnly}
              disabled={!message.trim() || selectedCount === 0}
              className="px-3 py-1.5 bg-[#2B2D30] border border-[#393B40] hover:bg-[#35373B] disabled:opacity-40 text-[#DFE1E5] rounded text-xs font-medium"
            >
              Commit
            </button>
            <button
              onClick={handleCommitAndPush}
              disabled={!message.trim() || selectedCount === 0}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-40 text-white rounded text-xs font-medium flex items-center gap-1.5"
            >
              <span>Commit & Push</span>
              <ArrowUpRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
