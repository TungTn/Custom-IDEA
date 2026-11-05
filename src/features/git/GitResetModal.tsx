import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, X, GitCommit } from 'lucide-react';
import { GitResetMode } from '../../types';

interface GitResetModalProps {
  isOpen: boolean;
  commitHash: string;
  commitSubject: string;
  commitAuthor: string;
  currentBranch?: string;
  onClose: () => void;
  onReset: (mode: GitResetMode) => void;
}

export const GitResetModal: React.FC<GitResetModalProps> = ({
  isOpen,
  commitHash,
  commitSubject,
  commitAuthor,
  currentBranch = 'main',
  onClose,
  onReset,
}) => {
  const [selectedMode, setSelectedMode] = useState<GitResetMode>('mixed');

  if (!isOpen) return null;

  const modes: Array<{
    mode: GitResetMode;
    label: string;
    description: string;
    isDanger?: boolean;
  }> = [
    {
      mode: 'soft',
      label: 'Soft',
      description: "Files won't change, differences will be staged for commit.",
    },
    {
      mode: 'mixed',
      label: 'Mixed',
      description: "Files won't change, differences will remain unstaged.",
    },
    {
      mode: 'hard',
      label: 'Hard',
      description: 'Files will be reverted to the state of the selected commit. Warning: local changes will be lost!',
      isDanger: true,
    },
    {
      mode: 'keep',
      label: 'Keep',
      description: 'Files will be reverted, but uncommitted local changes will be kept intact.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-100">
      <div 
        className="w-[500px] bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl overflow-hidden text-[#DFE1E5] font-sans select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="h-9 px-3 bg-[#25272B] border-b border-[#393B40] flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <RotateCcw size={14} className="text-[#E55353]" />
            <span>Reset Current Branch to Here ({currentBranch})</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        {/* Target Commit Info */}
        <div className="p-4 space-y-4 text-xs">
          <div className="bg-[#1E1F22] border border-[#393B40] rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-[11px] text-[#3574F0]">
              <GitCommit size={13} />
              <span className="font-semibold">{commitHash.substring(0, 8)}</span>
              <span className="text-[#868A91] font-sans">• {commitAuthor}</span>
            </div>
            <div className="text-[11.5px] text-[#DFE1E5] truncate">
              {commitSubject}
            </div>
          </div>

          {/* Reset Type selection */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-[#868A91] uppercase tracking-wider">
              Reset Type:
            </span>

            <div className="space-y-1.5">
              {modes.map((m) => {
                const isSelected = selectedMode === m.mode;
                return (
                  <label
                    key={m.mode}
                    onClick={() => setSelectedMode(m.mode)}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? m.isDanger
                          ? 'bg-[#3F2022] border-[#E55353]'
                          : 'bg-[#2E3C56] border-[#3574F0]'
                        : 'bg-[#1E1F22]/60 border-[#393B40] hover:bg-[#25272B]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="resetMode"
                      checked={isSelected}
                      onChange={() => setSelectedMode(m.mode)}
                      className="mt-0.5 accent-[#3574F0] cursor-pointer"
                    />
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-1.5 font-medium text-xs">
                        <span className={m.isDanger ? 'text-[#E55353]' : 'text-[#DFE1E5]'}>
                          {m.label}
                        </span>
                        {m.isDanger && (
                          <AlertTriangle size={12} className="text-[#E55353]" />
                        )}
                      </div>
                      <div className="text-[11px] text-[#868A91] leading-relaxed">
                        {m.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#393B40]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded hover:bg-[#35373B] text-xs text-[#DFE1E5] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onReset(selectedMode);
                onClose();
              }}
              className={`px-4 py-1.5 font-medium rounded text-xs transition-colors cursor-pointer shadow-sm ${
                selectedMode === 'hard'
                  ? 'bg-[#E55353] hover:bg-[#E55353]/85 text-white'
                  : 'bg-[#3574F0] hover:bg-[#3574F0]/85 text-white'
              }`}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
