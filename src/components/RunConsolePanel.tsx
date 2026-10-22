import React from 'react';
import { 
  Play, 
  Square, 
  Ban, 
  WrapText, 
  ArrowDown, 
  CheckCircle2, 
  AlertTriangle, 
  Clock 
} from 'lucide-react';
import { RunLog } from '../types';

interface RunConsolePanelProps {
  logs: RunLog[];
  isRunning: boolean;
  onRerun: () => void;
  onStop: () => void;
  onClear: () => void;
}

export const RunConsolePanel: React.FC<RunConsolePanelProps> = ({
  logs,
  isRunning,
  onRerun,
  onStop,
  onClear,
}) => {
  return (
    <div className="h-full flex bg-[#1E1F22] text-[#DFE1E5] font-mono text-[12px]">
      {/* Left Control Bar for Run Window (Classic IntelliJ Run Toolbar) */}
      <div className="w-8 bg-[#2B2D30] border-r border-[#393B40] flex flex-col items-center py-2 gap-2 text-[#868A91]">
        <button
          onClick={onRerun}
          disabled={isRunning}
          title="Rerun 'Desktop IDE' (Ctrl+F5)"
          className={`p-1.5 rounded transition-colors ${
            isRunning ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#35373B] text-[#59A869]'
          }`}
        >
          <Play size={13} className="fill-[#59A869]" />
        </button>

        <button
          onClick={onStop}
          disabled={!isRunning}
          title="Stop (Ctrl+F2)"
          className={`p-1.5 rounded transition-colors ${
            isRunning ? 'hover:bg-[#35373B] text-[#E05555]' : 'opacity-40 cursor-not-allowed'
          }`}
        >
          <Square size={12} className={isRunning ? 'fill-[#E05555]' : ''} />
        </button>

        <div className="w-4 h-[1px] bg-[#393B40] my-0.5" />

        <button
          onClick={onClear}
          title="Clear All"
          className="p-1.5 rounded hover:bg-[#35373B] hover:text-[#DFE1E5]"
        >
          <Ban size={13} />
        </button>

        <button
          title="Soft-Wrap"
          className="p-1.5 rounded hover:bg-[#35373B] hover:text-[#DFE1E5]"
        >
          <WrapText size={13} />
        </button>

        <button
          title="Scroll to the End"
          className="p-1.5 rounded hover:bg-[#35373B] hover:text-[#DFE1E5]"
        >
          <ArrowDown size={13} />
        </button>
      </div>

      {/* Main Console Output Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Status header banner */}
        <div className="h-6 bg-[#26282E] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] text-[#868A91] select-none font-sans">
          <div className="flex items-center gap-2">
            {isRunning ? (
              <span className="flex items-center gap-1.5 text-[#3574F0] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#3574F0] animate-pulse" />
                Compiling and running 'Desktop IDE'...
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[#59A869] font-medium">
                <CheckCircle2 size={13} />
                Process finished with exit code 0
              </span>
            )}
          </div>
          <span className="text-[10px] text-[#868A91] flex items-center gap-1">
            <Clock size={11} /> 0.42s
          </span>
        </div>

        {/* Logs Stream */}
        <div className="flex-1 p-3 overflow-y-auto space-y-1 select-text">
          {logs.map((log) => {
            let textColor = 'text-[#DFE1E5]';
            if (log.type === 'cmd') textColor = 'text-[#3574F0] font-semibold';
            if (log.type === 'success') textColor = 'text-[#59A869] font-medium';
            if (log.type === 'warning') textColor = 'text-[#EDA200]';
            if (log.type === 'error') textColor = 'text-[#E05555] font-semibold';

            return (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-[#4E5157] text-[11px] select-none">{log.timestamp}</span>
                <span className={`${textColor} flex-1 whitespace-pre-wrap break-all`}>
                  {log.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
