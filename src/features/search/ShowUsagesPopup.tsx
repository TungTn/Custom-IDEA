import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileCode, ExternalLink } from 'lucide-react';
import { FindUsagesResult, UsageOccurrence } from '../../types';

interface ShowUsagesPopupProps {
  isOpen: boolean;
  result: FindUsagesResult | null;
  onClose: () => void;
  onJumpToOccurrence: (occ: UsageOccurrence) => void;
  onOpenInFindPanel: () => void;
}

export const ShowUsagesPopup: React.FC<ShowUsagesPopupProps> = ({
  isOpen,
  result,
  onClose,
  onJumpToOccurrence,
  onOpenInFindPanel,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'import' | 'usage'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setFilterType('all');
    }
  }, [isOpen, result]);

  // Global Esc and outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    const handleOutsideClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('mousedown', handleOutsideClick, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('mousedown', handleOutsideClick, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !result) return null;

  const filtered = result.occurrences.filter((o: UsageOccurrence) => {
    if (filterType === 'all') return true;
    return o.usageType === filterType;
  });

  const handleKeyNavigation = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onJumpToOccurrence(filtered[selectedIndex]);
        onClose();
      }
    }
  };

  const renderHighlightedSnippet = (lineContent: string, matchText: string) => {
    if (!matchText) return <span>{lineContent}</span>;
    const parts = lineContent.split(new RegExp(`(${matchText.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'g'));
    return (
      <span className="font-mono text-[11.5px]">
        {parts.map((part, i) =>
          part === matchText ? (
            <mark 
              key={i} 
              className="bg-[#544322] text-[#F5C254] font-semibold px-0.5 rounded border border-[#6B552B]/60"
            >
              {part}
            </mark>
          ) : (
            <span key={i} className="text-[#DFE1E5]">{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center select-none animate-in fade-in duration-100"
      tabIndex={0}
      onKeyDown={handleKeyNavigation}
    >
      <div 
        ref={popupRef}
        className="w-[640px] max-h-[480px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs text-[#DFE1E5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-10 bg-[#2B2D30] border-b border-[#393B40] px-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search size={14} className="text-[#3574F0]" />
            <span className="font-semibold text-[12.5px] text-[#DFE1E5]">
              Usages of '{result.symbol}'
            </span>
            <span className="text-[11px] text-[#868A91] font-normal">
              ({result.occurrences.length} found)
            </span>
            <span className="text-[10px] bg-[#393B40] text-[#DFE1E5] px-1.5 py-0.5 rounded border border-[#4E5157]/50 ml-1">
              Project Files
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-[#1E1F22] p-0.5 rounded border border-[#393B40]">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2 py-0.5 rounded text-[10px] ${
                  filterType === 'all' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('import')}
                className={`px-2 py-0.5 rounded text-[10px] ${
                  filterType === 'import' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                }`}
              >
                Imports
              </button>
              <button
                onClick={() => setFilterType('usage')}
                className={`px-2 py-0.5 rounded text-[10px] ${
                  filterType === 'usage' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                }`}
              >
                Usages
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-[#868A91] hover:text-[#DFE1E5] p-1 hover:bg-[#393B40] rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Occurrences List */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 max-h-[360px] bg-[#1E1F22]">
          {filtered.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-[#868A91] text-xs">
              No matching usages found
            </div>
          ) : (
            filtered.map((occ: UsageOccurrence, idx: number) => {
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={occ.id}
                  onClick={() => setSelectedIndex(idx)}
                  onDoubleClick={() => {
                    onJumpToOccurrence(occ);
                    onClose();
                  }}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#214283] text-white'
                      : 'hover:bg-[#2B2D30] text-[#DFE1E5]'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                    <FileCode size={13} className={isSelected ? 'text-white' : 'text-[#3574F0]'} />
                    <span className={`text-[11px] font-medium truncate ${isSelected ? 'text-white' : 'text-[#A8ADBD]'}`}>
                      {occ.fileName}
                    </span>
                    <span className={`font-mono text-[11px] ${isSelected ? 'text-white/80' : 'text-[#868A91]'}`}>
                      {occ.lineNumber}:
                    </span>
                    <div className="truncate">
                      {renderHighlightedSnippet(occ.lineContent, result.symbol)}
                    </div>
                  </div>

                  <span className={`text-[9.5px] uppercase font-mono px-1 py-0.2 rounded flex-shrink-0 ${
                    occ.usageType === 'import'
                      ? 'bg-[#7B61FF]/20 text-[#A28FFF]'
                      : 'bg-[#393B40] text-[#868A91]'
                  }`}>
                    {occ.usageType}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="h-9 bg-[#2B2D30] border-t border-[#393B40] px-3.5 flex items-center justify-between text-[11px] text-[#868A91]">
          <div className="flex items-center gap-2">
            <span>Use ↑↓ to navigate, <strong>Enter</strong> to jump, <strong>Esc</strong> to close</span>
          </div>

          <button
            onClick={() => {
              onOpenInFindPanel();
              onClose();
            }}
            className="flex items-center gap-1.5 text-[#3574F0] hover:text-[#5B8DF5] font-medium transition-colors"
          >
            <span>Open in Find Tool Window</span>
            <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
