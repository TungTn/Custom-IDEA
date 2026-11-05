import React, { useState, useEffect, useRef } from 'react';
import { Edit3, X } from 'lucide-react';

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onRename: (newName: string) => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  currentName,
  onRename,
}) => {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setTimeout(() => {
        inputRef.current?.focus();
        // select filename without extension
        const dotIndex = currentName.lastIndexOf('.');
        if (dotIndex > 0) {
          inputRef.current?.setSelectionRange(0, dotIndex);
        } else {
          inputRef.current?.select();
        }
      }, 50);
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed && trimmed !== currentName) {
      onRename(trimmed);
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
            <Edit3 size={15} className="text-[#3574F0]" />
            <span>Rename File or Symbol (Shift+F6)</span>
          </div>
          <button onClick={onClose} className="p-0.5 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5]">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] text-[#868A91] block mb-1">New name:</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || name.trim() === currentName}
              className="px-3 py-1 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-40 text-white rounded text-xs font-medium"
            >
              Refactor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
