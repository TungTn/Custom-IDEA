import React, { useState } from 'react';
import { X, Eye, Trash2, Plus, Check, VolumeX, Volume2, FileCode, Circle } from 'lucide-react';
import { Breakpoint } from '../types';

interface BreakpointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  breakpoints: Breakpoint[];
  areBreakpointsMuted: boolean;
  onToggleMuteBreakpoints: () => void;
  onUpdateBreakpoint: (bp: Breakpoint) => void;
  onRemoveBreakpoint: (id: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const BreakpointsModal: React.FC<BreakpointsModalProps> = ({
  isOpen,
  onClose,
  breakpoints,
  areBreakpointsMuted,
  onToggleMuteBreakpoints,
  onUpdateBreakpoint,
  onRemoveBreakpoint,
  onShowToast,
}) => {
  const [selectedBpId, setSelectedBpId] = useState<string | null>(
    breakpoints[0]?.id || null
  );

  if (!isOpen) return null;

  const selectedBp = breakpoints.find(b => b.id === selectedBpId) || breakpoints[0];

  // Group breakpoints by file
  const groupedBreakpoints: Record<string, Breakpoint[]> = {};
  breakpoints.forEach(bp => {
    const key = bp.fileName || bp.filePath || 'Unknown File';
    if (!groupedBreakpoints[key]) groupedBreakpoints[key] = [];
    groupedBreakpoints[key].push(bp);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div 
        className="w-[720px] h-[480px] bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl flex flex-col text-xs text-[#DFE1E5] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-9 bg-[#26282B] border-b border-[#393B40] px-3.5 flex items-center justify-between font-semibold flex-shrink-0">
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-[#3574F0]" />
            <span>Breakpoints</span>
            <span className="text-[10px] text-[#868A91] font-mono">(Ctrl+Shift+F8)</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#868A91] hover:text-white p-1 rounded hover:bg-[#35373B] transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body (2-Column Layout) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Breakpoints Tree */}
          <div className="w-64 bg-[#222427] border-r border-[#393B40] flex flex-col flex-shrink-0">
            {/* Top Toolbar */}
            <div className="h-7 bg-[#26282B] border-b border-[#393B40] px-2 flex items-center justify-between text-[11px] text-[#868A91]">
              <span className="font-semibold">Line Breakpoints ({breakpoints.length})</span>
              <button
                onClick={onToggleMuteBreakpoints}
                title={areBreakpointsMuted ? "Unmute Breakpoints" : "Mute Breakpoints"}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  areBreakpointsMuted ? 'text-[#E55353] bg-[#E55353]/15' : 'hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5]'
                }`}
              >
                {areBreakpointsMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-1">
              {Object.entries(groupedBreakpoints).map(([fileName, bps]) => (
                <div key={fileName} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[#868A91] font-semibold text-[11px]">
                    <FileCode size={12} className="text-[#3574F0]" />
                    <span className="truncate">{fileName}</span>
                  </div>

                  {bps.map(bp => {
                    const isSelected = bp.id === selectedBp?.id;
                    return (
                      <div
                        key={bp.id}
                        onClick={() => setSelectedBpId(bp.id)}
                        className={`flex items-center justify-between px-3 py-1 rounded cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#3574F0] text-white' : 'hover:bg-[#2B2D30] text-[#DFE1E5]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={bp.enabled}
                            onChange={(e) => {
                              e.stopPropagation();
                              onUpdateBreakpoint({ ...bp, enabled: e.target.checked });
                            }}
                            className="accent-[#3574F0] rounded cursor-pointer"
                          />
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${bp.enabled ? 'bg-[#E55353]' : 'border border-[#E55353]'}`} />
                          <span className="font-mono text-[11px]">line {bp.lineNumber}</span>
                        </div>

                        {bp.condition && (
                          <span className="text-[10px] opacity-75 truncate max-w-[50px] font-mono">
                            ?
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {breakpoints.length === 0 && (
                <div className="p-4 text-center text-[#6C707E] italic text-xs">
                  No breakpoints set. Click on the editor gutter to add breakpoints.
                </div>
              )}
            </div>

            {/* Bottom Actions for List */}
            <div className="h-7 bg-[#26282B] border-t border-[#393B40] px-2 flex items-center gap-1">
              {selectedBp && (
                <button
                  onClick={() => {
                    onRemoveBreakpoint(selectedBp.id);
                    onShowToast?.('Breakpoint Removed', `Line ${selectedBp.lineNumber}`, 'info');
                  }}
                  title="Remove Selected Breakpoint"
                  className="p-1 rounded hover:bg-[#35373B] text-[#868A91] hover:text-[#E05555] transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Breakpoint Settings */}
          <div className="flex-1 bg-[#1E1F22] p-4 flex flex-col gap-4 overflow-y-auto">
            {selectedBp ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#2B2D30]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E55353] inline-block shadow-sm" />
                    <span className="font-semibold text-sm">
                      {selectedBp.fileName}:{selectedBp.lineNumber}
                    </span>
                  </div>
                  <span className="text-[#868A91] font-mono text-[11px] truncate max-w-[200px]">
                    {selectedBp.filePath}
                  </span>
                </div>

                {/* Enabled Toggle */}
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={selectedBp.enabled}
                    onChange={(e) => onUpdateBreakpoint({ ...selectedBp, enabled: e.target.checked })}
                    className="accent-[#3574F0] rounded cursor-pointer"
                  />
                  <span className="font-medium">Enabled</span>
                </label>

                {/* Condition Box */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] text-[#868A91] font-medium">Condition:</span>
                  <input
                    type="text"
                    value={selectedBp.condition || ''}
                    onChange={(e) => onUpdateBreakpoint({ ...selectedBp, condition: e.target.value || undefined })}
                    placeholder="e.g. i === 10 || count > 0"
                    className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1 text-xs font-mono text-[#DFE1E5] outline-none"
                  />
                  <span className="text-[10px] text-[#6C707E]">
                    Execution suspends only when this expression evaluates to true.
                  </span>
                </div>

                {/* Log message */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] text-[#868A91] font-medium">Log message:</span>
                  <input
                    type="text"
                    value={selectedBp.logMessage || ''}
                    onChange={(e) => onUpdateBreakpoint({ ...selectedBp, logMessage: e.target.value || undefined })}
                    placeholder="e.g. Hit breakpoint in processing loop"
                    className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1 text-xs font-mono text-[#DFE1E5] outline-none"
                  />
                </div>

                {/* Hit count info */}
                <div className="pt-2 text-[11px] text-[#868A91] flex items-center justify-between">
                  <span>Hit Count:</span>
                  <span className="font-mono text-[#DFE1E5]">{selectedBp.hitCount || 0} times</span>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-[#6C707E] italic">
                Select a breakpoint from the left panel to inspect details
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-10 bg-[#26282B] border-t border-[#393B40] px-4 flex items-center justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1 bg-[#3574F0] hover:bg-[#3574F0]/85 text-white rounded text-xs font-medium cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
