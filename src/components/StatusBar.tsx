import { NyanProgressBar } from './plugins/NyanProgressBar';
import React, { useState, useEffect } from 'react';
import { GitBranch, Bell, CheckCircle2, RotateCw, ShieldCheck, Sparkles } from 'lucide-react';

interface StatusBarProps {
  branch: string;
  cursorLine: number;
  cursorCol: number;
  encoding?: string;
  lineEnding?: string;
  isIndexing?: boolean;
  isRunning?: boolean;
  onOpenBranches?: () => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onToggleAi?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  branch,
  cursorLine,
  cursorCol,
  encoding = 'UTF-8',
  lineEnding = 'LF',
  isIndexing = false,
  isRunning = false,
  onOpenBranches,
  onShowToast,
  onToggleAi,
}) => {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hours}:${mins}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-6 bg-[#1E1F22] border-t border-[#2B2D30] px-3 flex items-center justify-between text-[11px] text-[#868A91] select-none z-10">
      {/* ─── Left items ─── */}
      <div className="flex items-center gap-3">
        {/* Git branch */}
        <div 
          onClick={onOpenBranches}
          className="flex items-center gap-1.5 hover:text-[#DFE1E5] cursor-pointer"
          title={`Current Git Branch: ${branch}`}
        >
          <GitBranch size={12} className="text-[#3574F0]" />
          <span>{branch || 'main'}</span>
        </div>

        {/* Nyan Progress Bar during execution */}
        {isRunning && (
          <div className="border-l border-[#2B2D30] pl-3">
            <NyanProgressBar label="Running..." />
          </div>
        )}

        {/* Indexing status indicator */}
        <div className="flex items-center gap-1.5 border-l border-[#2B2D30] pl-3">
          {isIndexing ? (
            <span className="flex items-center gap-1.5 text-[#3574F0]">
              <RotateCw size={11} className="animate-spin" />
              Scanning project files...
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[#59A869]">
              <CheckCircle2 size={11} />
              All files indexed
            </span>
          )}
        </div>
      </div>

      {/* ─── Right items (Matching IntelliJ) ─── */}
      <div className="flex items-center gap-3 font-mono text-[11px]">
        {/* Time */}
        {currentTime && (
          <span className="text-[#868A91] font-sans">
            {currentTime}
          </span>
        )}

        {/* Cursor Position */}
        <span 
          onClick={() => onShowToast?.('Cursor Position', `Line ${cursorLine}, Column ${cursorCol}`, 'info')}
          className="border-l border-[#2B2D30] pl-3 hover:text-[#DFE1E5] cursor-pointer"
        >
          {cursorLine}:{cursorCol}
        </span>

        {/* Indent Spaces */}
        <span className="border-l border-[#2B2D30] pl-3 hover:text-[#DFE1E5] cursor-pointer font-sans">
          4 spaces
        </span>

        {/* Line Ending */}
        <span className="border-l border-[#2B2D30] pl-3 hover:text-[#DFE1E5] cursor-pointer">
          {lineEnding}
        </span>

        {/* File Encoding */}
        <span className="border-l border-[#2B2D30] pl-3 hover:text-[#DFE1E5] cursor-pointer">
          {encoding}
        </span>

        {/* Inspections Status */}
        <div 
          onClick={() => onShowToast?.('Code Analysis', 'No problems found in current file', 'success')}
          className="border-l border-[#2B2D30] pl-3 flex items-center gap-1 text-[#59A869] hover:text-[#78D389] cursor-pointer"
          title="Analysis finished: No errors found"
        >
          <ShieldCheck size={12} />
        </div>

        {/* JetBrains AI Assistant Status Badge */}
        <div 
          onClick={onToggleAi}
          className="border-l border-[#2B2D30] pl-3 flex items-center gap-1.5 text-[#9876AA] hover:text-[#B292C4] cursor-pointer font-sans"
          title="JetBrains AI Assistant: Ready (Click to open or press Alt+\)"
        >
          <Sparkles size={11} className="text-[#9876AA]" />
          <span className="text-[10px] font-medium hidden sm:inline">AI: Ready</span>
        </div>
      </div>
    </div>
  );
};
