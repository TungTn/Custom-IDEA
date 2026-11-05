import React, { useState } from 'react';
import { GitBranch, Archive, X } from 'lucide-react';

interface StashModalProps {
  isOpen: boolean;
  currentBranch?: string;
  onClose: () => void;
  onStash: (message: string, keepIndex: boolean) => void;
}

export const StashModal: React.FC<StashModalProps> = ({
  isOpen,
  currentBranch = 'main',
  onClose,
  onStash,
}) => {
  const [message, setMessage] = useState('');
  const [keepIndex, setKeepIndex] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStash(message.trim() || `WIP on ${currentBranch}: ${new Date().toLocaleTimeString()}`, keepIndex);
    setMessage('');
    setKeepIndex(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-100">
      <div 
        className="w-[460px] bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl overflow-hidden text-[#DFE1E5] font-sans select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="h-9 px-3 bg-[#25272B] border-b border-[#393B40] flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <Archive size={14} className="text-[#3574F0]" />
            <span>Stash Changes</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          {/* Branch Info */}
          <div className="flex items-center gap-2 text-[#868A91]">
            <span>Current Branch:</span>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1E1F22] border border-[#393B40] text-[#DFE1E5] font-mono text-[11px]">
              <GitBranch size={11} className="text-[#59A869]" />
              <span>{currentBranch}</span>
            </div>
          </div>

          {/* Message input */}
          <div className="space-y-1.5">
            <label className="block text-[11px] text-[#868A91] font-medium">
              Message:
            </label>
            <input
              type="text"
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`WIP on ${currentBranch} (leave empty for auto-generated)`}
              className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none transition-colors"
            />
          </div>

          {/* Keep Index checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-[11.5px] text-[#A8ADBD]">
            <input
              type="checkbox"
              checked={keepIndex}
              onChange={(e) => setKeepIndex(e.target.checked)}
              className="accent-[#3574F0] rounded cursor-pointer"
            />
            <span>Keep index (stash only uncommitted and unstaged files)</span>
          </label>

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
              type="submit"
              className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#3574F0]/85 text-white font-medium rounded text-xs transition-colors cursor-pointer shadow-sm"
            >
              Create Stash
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
