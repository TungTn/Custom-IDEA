import React, { useState } from 'react';
import { Trash2, X, AlertTriangle, RefreshCw } from 'lucide-react';

interface InvalidateCachesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvalidate: () => void;
}

export const InvalidateCachesModal: React.FC<InvalidateCachesModalProps> = ({
  isOpen,
  onClose,
  onInvalidate,
}) => {
  const [clearVfs, setClearVfs] = useState(true);
  const [clearVcs, setClearVcs] = useState(true);
  const [clearBrowser, setClearBrowser] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onInvalidate();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[500px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl overflow-hidden p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#393B40] pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#DFE1E5]">
            <Trash2 size={16} className="text-[#E5534B]" />
            <span>Invalidate Caches</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5]">
            <X size={15} />
          </button>
        </div>

        {/* Warning & Description */}
        <div className="text-xs text-[#DFE1E5] space-y-2">
          <p className="leading-relaxed">
            The caches will be invalidated and optionally indexes rebuilt on the next startup.
          </p>
          <div className="p-3 bg-[#332520] border border-[#5E3A2F] rounded-lg text-[11.5px] text-[#F0A07B] flex items-start gap-2.5">
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            <span>Invalidating caches will temporarily require CPU to re-index source symbols.</span>
          </div>
        </div>

        {/* Checkbox Options */}
        <div className="space-y-2.5 py-1">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#DFE1E5]">
            <input
              type="checkbox"
              checked={clearVfs}
              onChange={(e) => setClearVfs(e.target.checked)}
              className="accent-[#3574F0] w-4 h-4 rounded cursor-pointer"
            />
            <span>Clear file system cache and Local History</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#DFE1E5]">
            <input
              type="checkbox"
              checked={clearVcs}
              onChange={(e) => setClearVcs(e.target.checked)}
              className="accent-[#3574F0] w-4 h-4 rounded cursor-pointer"
            />
            <span>Clear VCS Log caches and git index</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#DFE1E5]">
            <input
              type="checkbox"
              checked={clearBrowser}
              onChange={(e) => setClearBrowser(e.target.checked)}
              className="accent-[#3574F0] w-4 h-4 rounded cursor-pointer"
            />
            <span>Delete embedded WebView2 cache and session cookies</span>
          </label>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#393B40]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-1.5 bg-[#E5534B] hover:bg-[#D64239] text-white rounded text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={13} />
            <span>Invalidate and Restart</span>
          </button>
        </div>
      </div>
    </div>
  );
};
