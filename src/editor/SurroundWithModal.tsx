import React, { useEffect, useState } from 'react';
import { X, Code2, ShieldAlert, RefreshCw, Layers } from 'lucide-react';

export type SurroundType = 
  | 'if'
  | 'if-else'
  | 'while'
  | 'for'
  | 'try-catch'
  | 'try-catch-finally'
  | 'block'
  | 'region';

interface SurroundOption {
  key: string;
  type: SurroundType;
  label: string;
  description: string;
  icon?: React.ReactNode;
}

interface SurroundWithModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSurround: (type: SurroundType) => void;
}

export const SurroundWithModal: React.FC<SurroundWithModalProps> = ({
  isOpen,
  onClose,
  onSelectSurround,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const options: SurroundOption[] = [
    {
      key: '1',
      type: 'if',
      label: 'if (expr) { ... }',
      description: 'Wrap in conditional if block',
    },
    {
      key: '2',
      type: 'if-else',
      label: 'if (expr) { ... } else { ... }',
      description: 'Wrap in if / else conditional branches',
    },
    {
      key: '3',
      type: 'while',
      label: 'while (condition) { ... }',
      description: 'Wrap in while loop statement',
    },
    {
      key: '4',
      type: 'for',
      label: 'for (let i = 0; i < len; i++) { ... }',
      description: 'Wrap in indexed for loop statement',
    },
    {
      key: '5',
      type: 'try-catch',
      label: 'try { ... } catch (e) { ... }',
      description: 'Wrap in try / catch error handling block',
    },
    {
      key: '6',
      type: 'try-catch-finally',
      label: 'try { ... } catch (e) { ... } finally { ... }',
      description: 'Wrap in try / catch / finally block',
    },
    {
      key: '7',
      type: 'block',
      label: '{ ... } (Block Scope)',
      description: 'Wrap statements inside isolated block scope',
    },
    {
      key: '8',
      type: 'region',
      label: '// #region ... // #endregion',
      description: 'Wrap code in collapsible IDE region fold',
    },
  ];

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Direct numeric keys 1 - 8
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= options.length) {
        e.preventDefault();
        e.stopPropagation();
        onSelectSurround(options[num - 1].type);
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % options.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + options.length) % options.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onSelectSurround(options[selectedIndex].type);
        onClose();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, selectedIndex, options, onSelectSurround, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div 
        className="w-[360px] bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl overflow-hidden text-[#DFE1E5] font-sans animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-8 bg-[#212327] border-b border-[#393B40] px-3 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <Code2 size={14} className="text-[#3574F0]" />
            <span className="text-[12px] font-semibold tracking-wide">Surround With</span>
            <span className="text-[10px] text-[#868A91] font-mono bg-[#1E1F22] px-1.5 py-0.5 rounded">Ctrl+Alt+T</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#393B40] rounded p-0.5 transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        {/* Options List */}
        <div className="p-1 max-h-[380px] overflow-y-auto">
          {options.map((opt, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={opt.key}
                onClick={() => {
                  onSelectSurround(opt.type);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition-colors text-[12px] ${
                  isSelected 
                    ? 'bg-[#3574F0] text-white' 
                    : 'hover:bg-[#3574F0]/20 text-[#DFE1E5]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[11px] font-mono font-bold flex-shrink-0 ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#1E1F22] text-[#868A91]'
                  }`}>
                    {opt.key}
                  </span>
                  <span className="font-mono text-[12px] truncate">{opt.label}</span>
                </div>
                <span className={`text-[10px] font-mono ml-2 flex-shrink-0 ${
                  isSelected ? 'text-white/80' : 'text-[#868A91]'
                }`}>
                  [{opt.key}]
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer Hint */}
        <div className="px-3 py-1.5 bg-[#1E1F22] border-t border-[#393B40] flex items-center justify-between text-[11px] text-[#868A91] select-none">
          <span>Press <kbd className="font-mono text-white bg-[#2B2D30] px-1 rounded text-[10px]">1</kbd> - <kbd className="font-mono text-white bg-[#2B2D30] px-1 rounded text-[10px]">8</kbd> or <kbd className="font-mono text-white bg-[#2B2D30] px-1 rounded text-[10px]">Enter</kbd></span>
          <span><kbd className="font-mono text-white bg-[#2B2D30] px-1 rounded text-[10px]">Esc</kbd> to cancel</span>
        </div>
      </div>
    </div>
  );
};
