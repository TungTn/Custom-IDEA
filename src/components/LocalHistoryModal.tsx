import React, { useState } from 'react';
import { History, X, RotateCcw, Clock, FileCode, Check } from 'lucide-react';

interface LocalHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  currentContent: string;
  onRevert: (content: string) => void;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  label: string;
  content: string;
}

export const LocalHistoryModal: React.FC<LocalHistoryModalProps> = ({
  isOpen,
  onClose,
  fileName,
  currentContent,
  onRevert,
}) => {
  const [history] = useState<HistoryEntry[]>([
    {
      id: 'rev-3',
      timestamp: 'Today 11:06 AM',
      label: 'Current Workspace State',
      content: currentContent,
    },
    {
      id: 'rev-2',
      timestamp: 'Today 10:45 AM',
      label: 'Saved (Auto-save)',
      content: currentContent.split('\n').slice(0, Math.max(5, currentContent.split('\n').length - 4)).join('\n') + '\n// Previous checkpoint auto-saved',
    },
    {
      id: 'rev-1',
      timestamp: 'Today 10:15 AM',
      label: 'Initial File Revision',
      content: `// Initial revision of ${fileName}\n// Created by IntelliJ IDEA Clone\n`,
    },
  ]);

  const [selectedEntryId, setSelectedEntryId] = useState<string>('rev-3');

  if (!isOpen) return null;

  const selectedEntry = history.find(h => h.id === selectedEntryId) || history[0];

  const handleRevertClick = () => {
    onRevert(selectedEntry.content);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[840px] h-[520px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-11 bg-[#212225] border-b border-[#393B40] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <History size={16} className="text-[#3574F0]" />
            <span className="text-xs font-semibold text-[#DFE1E5]">
              Local History: <span className="font-mono text-[#3574F0]">{fileName}</span>
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5]">
            <X size={15} />
          </button>
        </div>

        {/* Body: Left Timeline & Right Snapshot View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Timeline */}
          <div className="w-[280px] bg-[#26282B] border-r border-[#393B40] flex flex-col">
            <div className="p-2.5 text-[10px] uppercase font-bold tracking-wider text-[#868A91] border-b border-[#393B40]">
              Revision Timeline
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {history.map((item) => {
                const isSelected = selectedEntryId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedEntryId(item.id)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors ${
                      isSelected 
                        ? 'bg-[#3574F0] text-white shadow-sm' 
                        : 'text-[#DFE1E5] hover:bg-[#35373B]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[11.5px] truncate">{item.label}</span>
                      <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-[#868A91]'}`}>
                        {item.timestamp.split(' ')[1]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] opacity-80">
                      <Clock size={11} />
                      <span>{item.timestamp}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Snapshot Preview */}
          <div className="flex-1 flex flex-col bg-[#1E1F22] overflow-hidden">
            <div className="h-9 border-b border-[#393B40] px-4 flex items-center justify-between text-xs text-[#868A91]">
              <div className="flex items-center gap-2">
                <FileCode size={14} className="text-[#3574F0]" />
                <span className="text-[#DFE1E5] font-mono">{selectedEntry.label}</span>
              </div>
              <button
                onClick={handleRevertClick}
                className="px-3 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={12} />
                <span>Revert to this Revision</span>
              </button>
            </div>
            <div className="flex-1 p-4 font-mono text-[11.5px] text-[#DFE1E5] overflow-auto whitespace-pre leading-relaxed select-text bg-[#1E1F22]">
              {selectedEntry.content}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-10 bg-[#212225] border-t border-[#393B40] flex items-center justify-between px-4 text-xs text-[#868A91]">
          <span>Tip: Local History records snapshots without needing git commits.</span>
          <button
            onClick={onClose}
            className="px-4 py-1 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
