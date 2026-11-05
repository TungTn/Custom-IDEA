import React, { useState } from 'react';
import { Lightbulb, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface TipOfTheDayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const tips = [
  {
    title: 'Search Everywhere',
    shortcut: 'Double Shift',
    desc: 'You can find anything in your project (files, actions, classes, symbols, and settings) by pressing Shift twice in rapid succession.'
  },
  {
    title: 'Reformat Code',
    shortcut: 'Ctrl + Alt + L',
    desc: 'Keep your codebase clean and consistent. IntelliJ automatically formats your active code according to standard styling conventions.'
  },
  {
    title: 'Quick Line Navigation',
    shortcut: 'Ctrl + G',
    desc: 'Jump instantly to any line and column in your file by pressing Ctrl+G and entering the target line number.'
  },
  {
    title: 'Embedded Terminal',
    shortcut: 'Alt + F12',
    desc: 'Never leave your IDE to run commands. The built-in terminal opens a real PowerShell / CMD session directly at your project root.'
  },
  {
    title: 'Version Control Commit',
    shortcut: 'Ctrl + K',
    desc: 'Stage changed files and write commit messages in a single dedicated window without typing complex git commands.'
  },
  {
    title: 'Instant Build & Run',
    shortcut: 'Shift + F10',
    desc: 'Compile your native desktop target and execute it immediately with real-time process monitoring in the Run tool window.'
  }
];

export const TipOfTheDayModal: React.FC<TipOfTheDayModalProps> = ({ isOpen, onClose }) => {
  const [currentIdx, setCurrentIdx] = useState(0);

  if (!isOpen) return null;

  const tip = tips[currentIdx];

  const handleNext = () => {
    setCurrentIdx((prev) => (prev + 1) % tips.length);
  };

  const handlePrev = () => {
    setCurrentIdx((prev) => (prev - 1 + tips.length) % tips.length);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[460px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-10 border-b border-[#393B40] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#DFE1E5]">
            <Lightbulb size={16} className="text-[#EDA200]" />
            <span>Tip of the Day</span>
          </div>
          <button onClick={onClose} className="p-0.5 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5]">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 min-h-[140px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-white">{tip.title}</h4>
              <kbd className="px-2 py-0.5 rounded bg-[#1E1F22] border border-[#393B40] text-xs font-mono text-[#3574F0]">
                {tip.shortcut}
              </kbd>
            </div>
            <p className="text-xs text-[#868A91] leading-relaxed">
              {tip.desc}
            </p>
          </div>

          <div className="text-[11px] text-[#868A91] border-t border-[#393B40] pt-2">
            Tip {currentIdx + 1} of {tips.length}
          </div>
        </div>

        {/* Footer */}
        <div className="h-11 bg-[#26282E] border-t border-[#393B40] px-4 flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 text-[11px] text-[#868A91] cursor-pointer">
            <input type="checkbox" className="accent-[#3574F0] rounded" defaultChecked />
            <span>Don't show tips</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="p-1 hover:bg-[#35373B] text-[#DFE1E5] rounded flex items-center"
              title="Previous Tip"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              className="px-2.5 py-1 bg-[#1E1F22] hover:bg-[#35373B] border border-[#393B40] text-[#DFE1E5] rounded flex items-center gap-1 text-xs"
            >
              <span>Next Tip</span>
              <ChevronRight size={14} />
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-medium ml-1"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
