import React, { useState, useEffect, useRef } from 'react';
import { ArrowDown, X } from 'lucide-react';

interface GoToLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  maxLine: number;
  onGoToLine: (line: number, column: number) => void;
}

export const GoToLineModal: React.FC<GoToLineModalProps> = ({
  isOpen,
  onClose,
  maxLine,
  onGoToLine,
}) => {
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setVal('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!val.trim()) return;

    // Parse line:col or line
    const parts = val.trim().split(':');
    const line = parseInt(parts[0], 10);
    const col = parts[1] ? parseInt(parts[1], 10) : 1;

    if (!isNaN(line)) {
      onGoToLine(line, col);
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-start justify-center pt-32 z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[360px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl p-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#393B40] pb-2 mb-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#DFE1E5]">
            <ArrowDown size={14} className="text-[#3574F0]" />
            <span>Go to Line:Column</span>
          </div>
          <button onClick={onClose} className="p-0.5 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5]">
            <X size={13} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <div className="flex justify-between text-[11px] text-[#868A91] mb-1">
              <span>Enter line:col</span>
              <span>1 to {maxLine}</span>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="e.g. 24 or 24:5"
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
              disabled={!val.trim()}
              className="px-3 py-1 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-40 text-white rounded text-xs font-medium"
            >
              Go to Line
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
