import React, { useState } from 'react';
import { GitBranch, Plus, Check, X, ArrowRight } from 'lucide-react';

interface GitBranchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBranch: string;
  onSwitchBranch: (branch: string) => void;
  onCreateBranch: (branch: string) => void;
}

export const GitBranchesModal: React.FC<GitBranchesModalProps> = ({
  isOpen,
  onClose,
  currentBranch,
  onSwitchBranch,
  onCreateBranch,
}) => {
  const [branches, setBranches] = useState(['main', 'dev', 'feature/intellij-ui']);
  const [isCreating, setIsCreating] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBranchName.trim();
    if (trimmed && !branches.includes(trimmed)) {
      setBranches([...branches, trimmed]);
      onCreateBranch(trimmed);
      onSwitchBranch(trimmed);
      setIsCreating(false);
      setNewBranchName('');
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[380px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl overflow-hidden p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#393B40] pb-2 mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#DFE1E5]">
            <GitBranch size={15} className="text-[#3574F0]" />
            <span>Git Branches</span>
          </div>
          <button onClick={onClose} className="p-0.5 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5]">
            <X size={14} />
          </button>
        </div>

        {/* New Branch Trigger */}
        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full mb-3 flex items-center gap-2 px-3 py-1.5 bg-[#1E1F22] hover:bg-[#35373B] border border-[#393B40] rounded text-xs text-[#3574F0] font-medium transition-colors"
          >
            <Plus size={14} />
            <span>New Branch...</span>
          </button>
        ) : (
          <form onSubmit={handleCreate} className="mb-3 space-y-2 bg-[#1E1F22] p-2.5 rounded border border-[#3574F0]/40">
            <input
              type="text"
              autoFocus
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="e.g. bugfix/editor-cursor"
              className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-xs text-[#DFE1E5] outline-none"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-2 py-0.5 text-xs text-[#868A91] hover:text-[#DFE1E5]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newBranchName.trim()}
                className="px-2.5 py-0.5 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-40 text-white rounded text-xs font-medium"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {/* Branches List */}
        <div className="space-y-1 max-h-56 overflow-y-auto">
          <div className="text-[11px] text-[#868A91] font-semibold uppercase px-1 mb-1">Local Branches</div>
          {branches.map((b) => {
            const isCurrent = b === currentBranch;
            return (
              <div
                key={b}
                onClick={() => {
                  onSwitchBranch(b);
                  onClose();
                }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                  isCurrent 
                    ? 'bg-[#2E436E] text-white font-medium' 
                    : 'text-[#DFE1E5] hover:bg-[#35373B]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <GitBranch size={13} className={isCurrent ? 'text-[#3574F0]' : 'text-[#868A91]'} />
                  <span className="truncate">{b}</span>
                </div>
                {isCurrent ? (
                  <Check size={13} className="text-[#59A869]" />
                ) : (
                  <span className="text-[10px] text-[#868A91] flex items-center gap-1 hover:text-[#DFE1E5]">
                    Checkout <ArrowRight size={10} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
