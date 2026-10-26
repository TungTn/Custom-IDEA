import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Columns, 
  Rows, 
  ArrowDown, 
  ArrowUp, 
  FileCode, 
  Copy, 
  Check, 
  RotateCcw,
  Sparkles
} from 'lucide-react';

interface DiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  baseContent: string;
  localContent: string;
  onRollback?: () => void;
}

interface DiffLine {
  type: 'same' | 'added' | 'removed' | 'modified';
  baseLineNo?: number;
  baseText?: string;
  localLineNo?: number;
  localText?: string;
}

export const DiffViewerModal: React.FC<DiffViewerModalProps> = ({
  isOpen,
  onClose,
  fileName,
  baseContent,
  localContent,
  onRollback,
}) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
  const [copied, setCopied] = useState(false);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  // Synchronized scrolling for side-by-side
  const handleScroll = (source: 'left' | 'right') => {
    if (viewMode !== 'side-by-side') return;
    if (source === 'left' && leftScrollRef.current && rightScrollRef.current) {
      rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
      rightScrollRef.current.scrollLeft = leftScrollRef.current.scrollLeft;
    } else if (source === 'right' && leftScrollRef.current && rightScrollRef.current) {
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
      leftScrollRef.current.scrollLeft = rightScrollRef.current.scrollLeft;
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute Diff Lines (Longest Common Subsequence or line-by-line diff)
  const diffLines = useMemo<DiffLine[]>(() => {
    const baseLines = baseContent ? baseContent.split('\n') : [];
    const localLines = localContent ? localContent.split('\n') : [];

    // Simple robust LCS-based diff
    const m = baseLines.length;
    const n = localLines.length;

    // Fast path: if identical
    if (baseContent === localContent) {
      return baseLines.map((line, idx) => ({
        type: 'same',
        baseLineNo: idx + 1,
        baseText: line,
        localLineNo: idx + 1,
        localText: line,
      }));
    }

    // Build LCS table (cap to 1500 lines for instant performance)
    const limitM = Math.min(m, 1500);
    const limitN = Math.min(n, 1500);

    const dp: number[][] = Array.from({ length: limitM + 1 }, () => new Array(limitN + 1).fill(0));
    for (let i = 1; i <= limitM; i++) {
      for (let j = 1; j <= limitN; j++) {
        if (baseLines[i - 1] === localLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to generate diff
    let i = limitM;
    let j = limitN;
    const result: DiffLine[] = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && baseLines[i - 1] === localLines[j - 1]) {
        result.push({
          type: 'same',
          baseLineNo: i,
          baseText: baseLines[i - 1],
          localLineNo: j,
          localText: localLines[j - 1],
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.push({
          type: 'added',
          localLineNo: j,
          localText: localLines[j - 1],
        });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        result.push({
          type: 'removed',
          baseLineNo: i,
          baseText: baseLines[i - 1],
        });
        i--;
      }
    }

    return result.reverse();
  }, [baseContent, localContent]);

  // Statistics
  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    diffLines.forEach(l => {
      if (l.type === 'added') added++;
      if (l.type === 'removed') removed++;
    });
    return { added, removed, totalChanges: added + removed };
  }, [diffLines]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[92vw] h-[88vh] max-w-[1400px] bg-[#1E1F22] border border-[#393B40] rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs font-sans text-[#DFE1E5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Top Header Bar (Authentic IntelliJ IDEA Diff Viewer) ─── */}
        <div className="h-10 bg-[#2B2D30] border-b border-[#393B40] px-4 flex items-center justify-between flex-shrink-0">
          {/* File Name & Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FileCode size={16} className="text-[#3574F0]" />
              <span className="font-semibold text-[13px] text-white font-mono">{fileName}</span>
            </div>

            <div className="flex items-center gap-2 text-[11px] px-2 py-0.5 rounded bg-[#1E1F22] border border-[#393B40]">
              <span className="text-[#59A869] font-medium">+{stats.added}</span>
              <span className="text-[#E05555] font-medium">-{stats.removed}</span>
            </div>
          </div>

          {/* Controls: Mode Switcher & Navigation */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Side-by-Side vs Unified */}
            <div className="flex items-center bg-[#1E1F22] border border-[#393B40] rounded p-0.5">
              <button
                onClick={() => setViewMode('side-by-side')}
                title="Side-by-Side Diff"
                className={`px-2 py-1 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'side-by-side'
                    ? 'bg-[#3574F0] text-white font-medium shadow'
                    : 'text-[#868A91] hover:text-[#DFE1E5]'
                }`}
              >
                <Columns size={12} />
                <span className="text-[11px]">Side-by-Side</span>
              </button>
              <button
                onClick={() => setViewMode('unified')}
                title="Unified Diff"
                className={`px-2 py-1 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'unified'
                    ? 'bg-[#3574F0] text-white font-medium shadow'
                    : 'text-[#868A91] hover:text-[#DFE1E5]'
                }`}
              >
                <Rows size={12} />
                <span className="text-[11px]">Unified</span>
              </button>
            </div>

            {onRollback && (
              <button
                onClick={onRollback}
                title="Rollback Changes (Revert file to HEAD)"
                className="px-2.5 py-1 rounded bg-[#2B2D30] border border-[#4E5157] hover:bg-[#E05555]/20 hover:border-[#E05555] text-[#DFE1E5] hover:text-[#E05555] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Rollback</span>
              </button>
            )}

            <div className="w-[1px] h-4 bg-[#393B40] mx-1" />

            {/* Close Button */}
            <button
              onClick={onClose}
              title="Close (Escape)"
              className="p-1 hover:bg-[#35373B] text-[#868A91] hover:text-white rounded transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ─── Column Sub-Headers (Base vs Your Version) ─── */}
        {viewMode === 'side-by-side' && (
          <div className="h-6 bg-[#25272B] border-b border-[#323438] flex text-[11px] text-[#868A91] select-none flex-shrink-0">
            <div className="flex-1 px-4 flex items-center justify-between border-r border-[#323438]">
              <span className="font-semibold text-[#DFE1E5]">Base Revision (HEAD)</span>
              <span className="text-[10px] text-[#868A91]">Repository</span>
            </div>
            <div className="flex-1 px-4 flex items-center justify-between">
              <span className="font-semibold text-[#DFE1E5]">Your Version (Working Tree)</span>
              <span className="text-[10px] text-[#59A869]">Local Changes</span>
            </div>
          </div>
        )}

        {/* ─── Diff Content Area ─── */}
        <div className="flex-1 overflow-hidden relative select-text font-mono text-[12px] leading-5">
          {viewMode === 'side-by-side' ? (
            /* Side-by-Side 2-Way View */
            <div className="w-full h-full flex">
              {/* Left Pane: Base Revision (HEAD) */}
              <div 
                ref={leftScrollRef}
                onScroll={() => handleScroll('left')}
                className="flex-1 h-full overflow-auto bg-[#1E1F22] border-r border-[#2B2D30]"
              >
                <div className="min-w-max">
                  {diffLines.map((line, idx) => {
                    const isRemoved = line.type === 'removed';
                    const isAdded = line.type === 'added';
                    return (
                      <div 
                        key={idx} 
                        className={`flex items-center h-5 ${
                          isRemoved 
                            ? 'bg-[#E05555]/20 text-[#DFE1E5]' 
                            : isAdded 
                            ? 'bg-[#25272B]/50 text-transparent select-none' 
                            : 'text-[#DFE1E5]'
                        }`}
                      >
                        <div className="w-12 pr-2 text-right text-[11px] text-[#5A5D63] select-none bg-[#1E1F22]/80 border-r border-[#2B2D30]">
                          {line.baseLineNo ?? ''}
                        </div>
                        <div className="w-4 flex items-center justify-center text-[10px] select-none text-[#E05555]">
                          {isRemoved ? '-' : ''}
                        </div>
                        <pre className="px-2 truncate">
                          {line.baseText ?? ' '}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Pane: Local Working Version */}
              <div 
                ref={rightScrollRef}
                onScroll={() => handleScroll('right')}
                className="flex-1 h-full overflow-auto bg-[#1E1F22]"
              >
                <div className="min-w-max">
                  {diffLines.map((line, idx) => {
                    const isAdded = line.type === 'added';
                    const isRemoved = line.type === 'removed';
                    return (
                      <div 
                        key={idx} 
                        className={`flex items-center h-5 ${
                          isAdded 
                            ? 'bg-[#59A869]/20 text-[#DFE1E5]' 
                            : isRemoved 
                            ? 'bg-[#25272B]/50 text-transparent select-none' 
                            : 'text-[#DFE1E5]'
                        }`}
                      >
                        <div className="w-12 pr-2 text-right text-[11px] text-[#5A5D63] select-none bg-[#1E1F22]/80 border-r border-[#2B2D30]">
                          {line.localLineNo ?? ''}
                        </div>
                        <div className="w-4 flex items-center justify-center text-[10px] select-none text-[#59A869]">
                          {isAdded ? '+' : ''}
                        </div>
                        <pre className="px-2 truncate">
                          {line.localText ?? ' '}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Unified Diff View */
            <div className="w-full h-full overflow-auto p-3 bg-[#1E1F22]">
              {diffLines.map((line, idx) => {
                if (line.type === 'added') {
                  return (
                    <div key={idx} className="flex items-center h-5 bg-[#59A869]/15 text-[#59A869]">
                      <div className="w-10 pr-2 text-right text-[#5A5D63] select-none">+{line.localLineNo}</div>
                      <span className="w-4 text-center select-none">+</span>
                      <pre className="px-2 text-[#DFE1E5] truncate">{line.localText}</pre>
                    </div>
                  );
                }
                if (line.type === 'removed') {
                  return (
                    <div key={idx} className="flex items-center h-5 bg-[#E05555]/15 text-[#E05555]">
                      <div className="w-10 pr-2 text-right text-[#5A5D63] select-none">-{line.baseLineNo}</div>
                      <span className="w-4 text-center select-none">-</span>
                      <pre className="px-2 text-[#DFE1E5] truncate">{line.baseText}</pre>
                    </div>
                  );
                }
                return (
                  <div key={idx} className="flex items-center h-5 text-[#DFE1E5]">
                    <div className="w-10 pr-2 text-right text-[#5A5D63] select-none">{line.localLineNo}</div>
                    <span className="w-4 text-center select-none text-[#5A5D63]"> </span>
                    <pre className="px-2 text-[#868A91] truncate">{line.localText}</pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Bottom Footer Bar ─── */}
        <div className="h-8 bg-[#25272B] border-t border-[#323438] px-4 flex items-center justify-between text-[11px] text-[#868A91]">
          <span>Press <kbd className="px-1 py-0.5 bg-[#1E1F22] border border-[#393B40] rounded text-[#DFE1E5]">Escape</kbd> to exit Diff Viewer</span>
          <div className="flex items-center gap-2">
            <span className="text-[#3574F0]">{fileName}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
