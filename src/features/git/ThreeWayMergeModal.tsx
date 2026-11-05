import React, { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  GitMerge,
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCcw,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minimize2,
  FileCode,
  ShieldCheck,
  CheckCheck,
} from 'lucide-react';

export interface ConflictChunk {
  id: number;
  oursStart: number;
  oursEnd: number;
  theirsStart: number;
  theirsEnd: number;
  oursLines: string[];
  theirsLines: string[];
  status: 'unresolved' | 'accepted-ours' | 'accepted-theirs' | 'accepted-both';
}

interface ThreeWayMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  projectPath?: string;
  onResolved?: (filePath: string) => void;
  onShowToast?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ThreeWayMergeModal: React.FC<ThreeWayMergeModalProps> = ({
  isOpen,
  onClose,
  filePath,
  projectPath = 'D:\\IDE',
  onResolved,
  onShowToast,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [baseContent, setBaseContent] = useState('');
  const [oursContent, setOursContent] = useState('');
  const [theirsContent, setTheirsContent] = useState('');
  const [resultContent, setResultContent] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Synchronized scroll refs
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const centerScrollRef = useRef<HTMLTextAreaElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  // Fetch conflict stages from backend
  useEffect(() => {
    if (!isOpen || !filePath) return;

    let isMounted = true;
    setIsLoading(true);

    const loadStages = async () => {
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          const res = await invoke<{
            file_path: string;
            base: string;
            ours: string;
            theirs: string;
            current: string;
          }>('git_get_conflict_stages', { projectPath, filePath });

          if (!isMounted) return;

          setBaseContent(res.base);
          setOursContent(res.ours);
          setTheirsContent(res.theirs);
          setResultContent(res.current || res.ours);
        } else {
          setBaseContent('');
          setOursContent('');
          setTheirsContent('');
          setResultContent('');
        }
      } catch (e) {
        console.warn('Failed to load conflict stages:', e);
        onShowToast?.('Conflict Resolver', `Error: ${e}`, 'error');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadStages();
    return () => {
      isMounted = false;
    };
  }, [isOpen, filePath, projectPath]);

  // Synchronize scrolling across panes
  const handleScroll = (source: 'left' | 'center' | 'right') => {
    let top = 0;
    if (source === 'left' && leftScrollRef.current) {
      top = leftScrollRef.current.scrollTop;
    } else if (source === 'center' && centerScrollRef.current) {
      top = centerScrollRef.current.scrollTop;
    } else if (source === 'right' && rightScrollRef.current) {
      top = rightScrollRef.current.scrollTop;
    }

    if (source !== 'left' && leftScrollRef.current) leftScrollRef.current.scrollTop = top;
    if (source !== 'center' && centerScrollRef.current) centerScrollRef.current.scrollTop = top;
    if (source !== 'right' && rightScrollRef.current) rightScrollRef.current.scrollTop = top;
  };

  // Detect conflict markers in result content
  const hasUnresolvedMarkers = useMemo(() => {
    return (
      resultContent.includes('<<<<<<<') ||
      resultContent.includes('=======') ||
      resultContent.includes('>>>>>>>')
    );
  }, [resultContent]);

  // Accept all from Left (Yours)
  const handleAcceptAllLeft = () => {
    setResultContent(oursContent);
    onShowToast?.('Merge Conflict', 'Accepted all changes from Yours (Left)', 'info');
  };

  // Accept all from Right (Theirs)
  const handleAcceptAllRight = () => {
    setResultContent(theirsContent);
    onShowToast?.('Merge Conflict', 'Accepted all changes from Theirs (Right)', 'info');
  };

  // Strip standard git conflict markers and combine both sides
  const handleAcceptBoth = () => {
    const cleaned = `${oursContent.trimEnd()}\n\n${theirsContent.trimStart()}`;
    setResultContent(cleaned);
    onShowToast?.('Merge Conflict', 'Combined both Yours and Theirs', 'info');
  };

  // Save resolved content and git add
  const handleSaveResolved = async () => {
    if (hasUnresolvedMarkers) {
      const confirmSave = window.confirm(
        'The result still contains Git conflict markers (<<<<<<< / ======= / >>>>>>>). Are you sure you want to save anyway?'
      );
      if (!confirmSave) return;
    }

    setIsSaving(true);
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_resolve_conflict', {
          projectPath,
          filePath,
          resolvedContent: resultContent,
        });
      }
      onShowToast?.('Conflict Resolved', `Saved and staged ${filePath}`, 'success');
      onResolved?.(filePath);
      onClose();
    } catch (e) {
      onShowToast?.('Resolve Error', `Failed to save resolved file: ${e}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const fileName = filePath.split(/[\/\\]/).pop() || filePath;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-4 animate-in fade-in duration-150">
      <div
        className={`bg-[#1E1F22] border border-[#393B40] rounded-lg shadow-2xl flex flex-col overflow-hidden text-[#DFE1E5] font-sans ${
          isMaximized ? 'w-full h-full rounded-none m-0' : 'w-[96vw] h-[92vh] max-w-[1700px]'
        }`}
      >
        {/* Header (IntelliJ 3-Way Merge style) */}
        <div className="h-10 bg-[#2B2D30] border-b border-[#393B40] px-4 flex items-center justify-between select-none">
          <div className="flex items-center gap-2.5">
            <GitMerge size={16} className="text-[#3574F0]" />
            <span className="font-semibold text-xs text-white">Conflicts in {fileName}</span>
            <span className="text-[11px] text-[#868A91] font-mono px-1.5 py-0.5 bg-[#1E1F22] rounded border border-[#393B40]/60">
              {filePath}
            </span>
            {hasUnresolvedMarkers ? (
              <span className="text-[11px] px-2 py-0.5 rounded bg-[#E05555]/20 text-[#E05555] font-medium flex items-center gap-1 border border-[#E05555]/40">
                <AlertTriangle size={11} /> Unresolved Markers
              </span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 rounded bg-[#59A869]/20 text-[#59A869] font-medium flex items-center gap-1 border border-[#59A869]/40">
                <ShieldCheck size={11} /> Clean / Ready to Apply
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1 hover:bg-[#393B40] rounded text-[#868A91] hover:text-[#DFE1E5]"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#E05555] rounded text-[#868A91] hover:text-white transition-colors"
              title="Close (Esc)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="h-9 bg-[#212226] border-b border-[#393B40] px-4 flex items-center justify-between text-xs select-none">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAcceptAllLeft}
              className="px-2.5 py-1 bg-[#2E436E]/40 hover:bg-[#2E436E] text-[#589DF6] hover:text-white border border-[#3574F0]/40 rounded flex items-center gap-1.5 transition-colors"
              title="Take entire left file into result"
            >
              <ArrowLeft size={12} />
              <span>Accept All Left (Yours)</span>
            </button>
            <button
              onClick={handleAcceptAllRight}
              className="px-2.5 py-1 bg-[#2E436E]/40 hover:bg-[#2E436E] text-[#589DF6] hover:text-white border border-[#3574F0]/40 rounded flex items-center gap-1.5 transition-colors"
              title="Take entire right file into result"
            >
              <span>Accept All Right (Theirs)</span>
              <ArrowRight size={12} />
            </button>
            <button
              onClick={handleAcceptBoth}
              className="px-2.5 py-1 bg-[#35373B] hover:bg-[#393B40] text-[#DFE1E5] rounded flex items-center gap-1.5 transition-colors"
              title="Concatenate both changes into result"
            >
              <CheckCheck size={12} />
              <span>Combine Both</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#868A91]">
            <span>Tip: Edit directly in the center panel to fine-tune the final code.</span>
          </div>
        </div>

        {/* 3-Pane Body */}
        <div className="flex-1 grid grid-cols-3 divide-x divide-[#393B40] overflow-hidden bg-[#1E1F22]">
          {/* Left Column: Yours (Local) */}
          <div className="flex flex-col h-full overflow-hidden">
            <div className="h-7 bg-[#26282B] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#589DF6] select-none">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3574F0]" />
                Yours (Current Branch)
              </span>
              <button
                onClick={handleAcceptAllLeft}
                className="text-[10px] text-[#868A91] hover:text-white hover:underline flex items-center gap-0.5"
              >
                Accept «
              </button>
            </div>
            <div
              ref={leftScrollRef}
              onScroll={() => handleScroll('left')}
              className="flex-1 p-3 font-mono text-[11.5px] leading-relaxed overflow-y-auto whitespace-pre select-text text-[#DFE1E5] bg-[#1E1F22]"
            >
              {isLoading ? 'Loading stage 2 (Yours)...' : oursContent || '(Empty file in Yours)'}
            </div>
          </div>

          {/* Center Column: Result (Editable) */}
          <div className="flex flex-col h-full overflow-hidden bg-[#18191B]">
            <div className="h-7 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#59A869] select-none">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#59A869]" />
                Result (Merge Output - Editable)
              </span>
              <span className="text-[10px] text-[#868A91]">
                {resultContent.split('\n').length} lines
              </span>
            </div>
            <textarea
              ref={centerScrollRef}
              value={resultContent}
              onChange={(e) => setResultContent(e.target.value)}
              onScroll={() => handleScroll('center')}
              spellCheck={false}
              className="flex-1 w-full p-3 font-mono text-[11.5px] leading-relaxed bg-[#18191B] text-white resize-none outline-none border-none selection:bg-[#2E436E]"
              placeholder="Edit merged result here..."
            />
          </div>

          {/* Right Column: Theirs (Incoming) */}
          <div className="flex flex-col h-full overflow-hidden">
            <div className="h-7 bg-[#26282B] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#EDA200] select-none">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#EDA200]" />
                Theirs (Incoming Branch)
              </span>
              <button
                onClick={handleAcceptAllRight}
                className="text-[10px] text-[#868A91] hover:text-white hover:underline flex items-center gap-0.5"
              >
                » Accept
              </button>
            </div>
            <div
              ref={rightScrollRef}
              onScroll={() => handleScroll('right')}
              className="flex-1 p-3 font-mono text-[11.5px] leading-relaxed overflow-y-auto whitespace-pre select-text text-[#DFE1E5] bg-[#1E1F22]"
            >
              {isLoading ? 'Loading stage 3 (Theirs)...' : theirsContent || '(Empty file in Theirs)'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-11 bg-[#26282B] border-t border-[#393B40] px-4 flex items-center justify-between select-none">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#868A91]">Resolve action:</span>
            <span className="text-[11px] text-white font-mono bg-[#1E1F22] px-2 py-0.5 rounded border border-[#393B40]">
              git add {fileName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-[#35373B] hover:bg-[#393B40] text-white rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveResolved}
              disabled={isSaving}
              className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-50 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow transition-colors"
            >
              <Check size={13} />
              <span>{isSaving ? 'Staging...' : 'Apply & Mark Resolved'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
