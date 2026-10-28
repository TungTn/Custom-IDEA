import React, { useRef, useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  RotateCw, 
  Square, 
  Trash2, 
  WrapText, 
  ArrowDown, 
  CheckCircle2, 
  AlertTriangle, 
  Clock,
  Search,
  Copy,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink
} from 'lucide-react';
import { RunLog } from '../types';

interface RunConsolePanelProps {
  logs: RunLog[];
  isRunning: boolean;
  onRerun: () => void;
  onStop: () => void;
  onClear: () => void;
}

interface AnsiChunk {
  text: string;
  color?: string;
  bold?: boolean;
}

function parseAnsi(input: string): AnsiChunk[] {
  const regex = /\u001b\[([0-9;]+)m/g;
  const chunks: AnsiChunk[] = [];
  let lastIndex = 0;
  let currentColor: string | undefined = undefined;
  let currentBold = false;

  let match;
  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      chunks.push({
        text: input.slice(lastIndex, match.index),
        color: currentColor,
        bold: currentBold,
      });
    }
    const codes = match[1].split(';');
    for (const code of codes) {
      switch (code) {
        case '0':
          currentColor = undefined;
          currentBold = false;
          break;
        case '1':
          currentBold = true;
          break;
        case '31':
          currentColor = '#E05555';
          break;
        case '32':
          currentColor = '#59A869';
          break;
        case '33':
          currentColor = '#EDA200';
          break;
        case '34':
          currentColor = '#3574F0';
          break;
        case '35':
          currentColor = '#B388FF';
          break;
        case '36':
          currentColor = '#2AACB8';
          break;
        case '37':
          currentColor = '#DFE1E5';
          break;
        case '39':
          currentColor = undefined;
          break;
      }
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < input.length) {
    chunks.push({
      text: input.slice(lastIndex),
      color: currentColor,
      bold: currentBold,
    });
  }

  return chunks.length > 0 ? chunks : [{ text: input }];
}

interface LogLineRowProps {
  log: RunLog;
  softWrap: boolean;
}

const LogLineRow: React.FC<LogLineRowProps> = React.memo(({ log, softWrap }) => {
  let defaultColor = '#DFE1E5';
  let isSpecial = false;

  if (log.type === 'cmd') {
    defaultColor = '#3574F0';
    isSpecial = true;
  } else if (log.type === 'success') {
    defaultColor = '#59A869';
    isSpecial = true;
  } else if (log.type === 'warning') {
    defaultColor = '#EDA200';
  } else if (log.type === 'error') {
    defaultColor = '#E05555';
  }

  const chunks = useMemo(() => parseAnsi(log.text), [log.text]);

  return (
    <div className="flex items-start gap-2 leading-relaxed hover:bg-[#2B2D30]/25 px-1 py-0.5 rounded transition-colors font-mono">
      <span className="text-[#4E5157] text-[10.5px] select-none flex-shrink-0 pt-0.5">{log.timestamp}</span>
      <div className={`flex-1 ${softWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'} ${isSpecial ? 'font-semibold' : ''}`}>
        {chunks.map((chunk, idx) => (
          <span 
            key={idx}
            style={{ color: chunk.color || defaultColor }}
            className={chunk.bold ? 'font-bold' : ''}
          >
            {chunk.text}
          </span>
        ))}
      </div>
    </div>
  );
});

export const RunConsolePanel: React.FC<RunConsolePanelProps> = ({
  logs,
  isRunning,
  onRerun,
  onStop,
  onClear,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [softWrap, setSoftWrap] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const lastLog = logs[logs.length - 1];
  const isFinished = !isRunning && logs.length > 0;
  const isFailed = isFinished && lastLog && (lastLog.text.includes('exit code') && !lastLog.text.includes('code 0') || lastLog.type === 'error');

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(l => l.text.toLowerCase().includes(q));
  }, [logs, searchQuery]);

  const handleCopyAll = () => {
    const fullText = logs.map(l => l.text).join('\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-full flex bg-[#1E1F22] text-[#DFE1E5] font-mono text-[12px] select-none">
      {/* ─── Left Control Bar for Run Window (Authentic IntelliJ Toolbar) ─── */}
      <div className="w-8 bg-[#1E1F22] border-r border-[#2B2D30] flex flex-col items-center py-2 gap-1.5 text-[#868A91]">
        {/* Rerun Button */}
        <button
          onClick={onRerun}
          disabled={isRunning}
          title="Rerun (Shift+F10)"
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isRunning ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[#2B2D30] text-[#59A869]'
          }`}
        >
          <RotateCw size={13} className={isRunning ? 'animate-spin text-[#3574F0]' : ''} />
        </button>

        {/* Stop Button */}
        <button
          onClick={onStop}
          disabled={!isRunning}
          title="Stop (Ctrl+F2)"
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isRunning ? 'hover:bg-[#2B2D30] text-[#E05555]' : 'opacity-30 cursor-not-allowed'
          }`}
        >
          <Square size={12} className={isRunning ? 'fill-[#E05555] text-[#E05555]' : 'text-[#4E5157]'} />
        </button>

        <div className="w-4 h-[1px] bg-[#2B2D30] my-1" />

        {/* Soft Wrap Toggle */}
        <button
          onClick={() => setSoftWrap(prev => !prev)}
          title={softWrap ? 'Disable Soft-Wrap' : 'Enable Soft-Wrap'}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            softWrap ? 'bg-[#3574F0]/20 text-[#3574F0]' : 'hover:bg-[#2B2D30] hover:text-[#DFE1E5]'
          }`}
        >
          <WrapText size={13} />
        </button>

        {/* Scroll to the End Toggle */}
        <button
          onClick={() => {
            setAutoScroll(prev => !prev);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          title={autoScroll ? 'Auto-scroll to bottom active' : 'Scroll to bottom'}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            autoScroll ? 'bg-[#3574F0]/20 text-[#3574F0]' : 'hover:bg-[#2B2D30] hover:text-[#DFE1E5]'
          }`}
        >
          <ArrowDown size={13} />
        </button>

        {/* Search in Console Toggle */}
        <button
          onClick={() => setIsSearchOpen(prev => !prev)}
          title="Find in Console (Ctrl+F)"
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isSearchOpen ? 'bg-[#3574F0]/20 text-[#3574F0]' : 'hover:bg-[#2B2D30] hover:text-[#DFE1E5]'
          }`}
        >
          <Search size={13} />
        </button>

        {/* Copy All Output */}
        <button
          onClick={handleCopyAll}
          title={copied ? 'Copied to clipboard!' : 'Copy Entire Output'}
          className="p-1.5 rounded hover:bg-[#2B2D30] hover:text-[#DFE1E5] transition-colors cursor-pointer"
        >
          {copied ? <CheckCircle2 size={13} className="text-[#59A869]" /> : <Copy size={13} />}
        </button>

        {/* Clear Output */}
        <button
          onClick={onClear}
          title="Clear Console Output"
          className="p-1.5 rounded hover:bg-[#2B2D30] hover:text-[#DFE1E5] transition-colors cursor-pointer mt-auto"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* ─── Main Console Content Area ─── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#1E1F22]">
        {/* Status header banner */}
        <div className="h-6 bg-[#1E1F22] border-b border-[#2B2D30] px-3 flex items-center justify-between text-[11px] text-[#868A91] select-none font-sans">
          <div className="flex items-center gap-2">
            {isRunning ? (
              <span className="flex items-center gap-1.5 text-[#3574F0] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3574F0] animate-pulse" />
                Executing process...
              </span>
            ) : isFailed ? (
              <span className="flex items-center gap-1.5 text-[#E05555] font-medium">
                <AlertTriangle size={12} />
                Process terminated with exit code
              </span>
            ) : isFinished ? (
              <span className="flex items-center gap-1.5 text-[#59A869] font-medium">
                <CheckCircle2 size={12} />
                Process finished with exit code 0
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[#868A91]">
                Run Console ready. Press Shift+F10 to run.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {searchQuery && (
              <span className="text-[10px] text-[#868A91]">
                {filteredLogs.length} matching lines
              </span>
            )}
            {logs.length > 0 && (
              <span className="text-[10px] text-[#868A91] flex items-center gap-1">
                <Clock size={11} /> {logs[logs.length - 1].timestamp}
              </span>
            )}
          </div>
        </div>

        {/* Inline Search Bar */}
        {isSearchOpen && (
          <div className="h-7 bg-[#222427] border-b border-[#2B2D30] px-3 flex items-center gap-2 text-xs font-sans">
            <Search size={12} className="text-[#868A91]" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find in console..."
              className="flex-1 bg-transparent text-xs text-[#DFE1E5] placeholder:text-[#868A91] outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-0.5 hover:text-white text-[#868A91]">
                <X size={12} />
              </button>
            )}
            <button 
              onClick={() => setIsSearchOpen(false)} 
              className="p-0.5 hover:text-white text-[#868A91] ml-1"
              title="Close Search (Esc)"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Logs Stream with ANSI Rendering */}
        <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto space-y-0.5 select-text">
          {filteredLogs.length === 0 ? (
            <div className="text-[#868A91] italic text-xs py-4 select-none">
              {searchQuery ? `No logs matching "${searchQuery}"` : 'No execution logs.'}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <LogLineRow key={log.id} log={log} softWrap={softWrap} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
