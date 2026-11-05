import React, { useState, useEffect, useRef } from 'react';
import { FilePlus, X } from 'lucide-react';

interface NewFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (fileName: string) => void;
}

export const NewFileModal: React.FC<NewFileModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFileName('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = fileName.trim();
    if (trimmed) {
      onCreate(trimmed);
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[420px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl overflow-hidden p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#393B40] pb-2 mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#DFE1E5]">
            <FilePlus size={16} className="text-[#3574F0]" />
            <span>New File</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5]">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] text-[#868A91] block mb-1">Enter file name with extension:</label>
            <input
              ref={inputRef}
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="e.g. index.ts, utils.rs, config.json..."
              className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-[12px] text-[#DFE1E5] outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!fileName.trim()}
              className="px-3 py-1 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-40 text-white rounded text-xs font-medium"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
