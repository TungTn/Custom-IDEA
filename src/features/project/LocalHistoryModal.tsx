import React, { useState, useEffect } from 'react';
import { History, X, RotateCcw, Clock, FileCode, Check, Tag, Plus, Trash2 } from 'lucide-react';
import { localHistoryService, HistoryRevision } from '../../services/localHistoryService';

interface LocalHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  filePath?: string;
  currentContent: string;
  onRevert: (content: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const LocalHistoryModal: React.FC<LocalHistoryModalProps> = ({
  isOpen,
  onClose,
  fileName,
  filePath,
  currentContent,
  onRevert,
  onShowToast,
}) => {
  const activeKey = filePath || fileName;
  const [revisions, setRevisions] = useState<HistoryRevision[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string>('');
  const [newLabelInput, setNewLabelInput] = useState('');
  const [showLabelInput, setShowLabelInput] = useState(false);

  useEffect(() => {
    if (isOpen && activeKey) {
      let list = localHistoryService.getRevisions(activeKey);
      if (list.length === 0) {
        // Record current state as baseline
        const baseRev = localHistoryService.recordSnapshot(activeKey, currentContent, 'Initial Revision');
        list = baseRev ? [baseRev] : [];
      } else {
        // Ensure current state is included if different from latest
        if (list[0].content !== currentContent) {
          list = [
            {
              id: 'current-unsaved',
              filePath: activeKey,
              timestamp: new Date().toISOString(),
              displayTime: 'Current (Unsaved changes)',
              label: 'Active Workspace Buffer',
              content: currentContent,
              lineCount: currentContent.split('\n').length,
            },
            ...list,
          ];
        }
      }
      setRevisions(list);
      if (list.length > 0) {
        setSelectedEntryId(list[0].id);
      }
    }
  }, [isOpen, activeKey, currentContent]);

  if (!isOpen) return null;

  const selectedEntry = revisions.find((h) => h.id === selectedEntryId) || revisions[0] || {
    id: 'empty',
    label: 'No Revisions Found',
    displayTime: 'Now',
    content: currentContent,
    lineCount: currentContent.split('\n').length,
  };

  const handleRevertClick = () => {
    onRevert(selectedEntry.content);
    localHistoryService.recordSnapshot(activeKey, selectedEntry.content, `Reverted to ${selectedEntry.label}`);
    onShowToast?.('Local History', `Reverted ${fileName} to checkpoint "${selectedEntry.label}"`, 'success');
    onClose();
  };

  const handleAddLabel = () => {
    if (!newLabelInput.trim()) return;
    localHistoryService.putLabel(activeKey, newLabelInput.trim(), currentContent);
    const updated = localHistoryService.getRevisions(activeKey);
    setRevisions(updated);
    setNewLabelInput('');
    setShowLabelInput(false);
    onShowToast?.('Local History', `Created label "${newLabelInput.trim()}"`, 'info');
  };

  const handleClearHistory = () => {
    if (confirm(`Clear all local history snapshots for ${fileName}?`)) {
      localHistoryService.clearHistory(activeKey);
      setRevisions([]);
      onShowToast?.('Local History', 'History snapshots cleared', 'info');
    }
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
          <div className="w-[300px] bg-[#26282B] border-r border-[#393B40] flex flex-col">
            <div className="p-2.5 text-[10px] uppercase font-bold tracking-wider text-[#868A91] border-b border-[#393B40] flex items-center justify-between">
              <span>Revision Timeline ({revisions.length})</span>
              <button
                onClick={() => setShowLabelInput(!showLabelInput)}
                title="Put Label on current snapshot..."
                className="hover:text-white flex items-center gap-1 text-[10px] text-[#3574F0] cursor-pointer"
              >
                <Tag size={11} />
                <span>Put Label</span>
              </button>
            </div>

            {showLabelInput && (
              <div className="p-2 bg-[#212225] border-b border-[#393B40] flex items-center gap-1.5 animate-in fade-in">
                <input
                  type="text"
                  value={newLabelInput}
                  onChange={(e) => setNewLabelInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLabel()}
                  placeholder="Label name (e.g. Before refactor)..."
                  autoFocus
                  className="flex-1 bg-[#1E1F22] border border-[#393B40] rounded px-2 py-1 text-xs text-white outline-none font-sans"
                />
                <button
                  onClick={handleAddLabel}
                  className="px-2 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs"
                >
                  Save
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {revisions.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#868A91]">
                  No local history checkpoints recorded yet. Changes will be automatically tracked when you save.
                </div>
              ) : (
                revisions.map((item) => {
                  const isSelected = selectedEntryId === item.id;
                  const diff = localHistoryService.computeLineDiff(item.content, currentContent);
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedEntryId(item.id)}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        isSelected 
                          ? 'bg-[#3574F0] text-white shadow-sm' 
                          : 'text-[#DFE1E5] hover:bg-[#35373B]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[11.5px] truncate max-w-[170px]">{item.label}</span>
                        <div className="flex items-center gap-1 text-[10px]">
                          {diff.added > 0 && (
                            <span className={isSelected ? 'text-[#A8FFB2]' : 'text-[#59A869]'}>+{diff.added}</span>
                          )}
                          {diff.removed > 0 && (
                            <span className={isSelected ? 'text-[#FFA8A8]' : 'text-[#E55353]'}>-{diff.removed}</span>
                          )}
                          {diff.added === 0 && diff.removed === 0 && (
                            <span className="opacity-60 text-[9px]">(same)</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10.5px] opacity-80">
                        <div className="flex items-center gap-1.5 truncate">
                          <Clock size={11} className="flex-shrink-0" />
                          <span>{item.displayTime}</span>
                        </div>
                        <span className="text-[10px] opacity-75">{item.lineCount} lines</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {revisions.length > 0 && (
              <div className="p-2 border-t border-[#393B40] flex justify-end">
                <button
                  onClick={handleClearHistory}
                  className="text-[10.5px] text-[#868A91] hover:text-[#E55353] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 size={11} />
                  <span>Clear History</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Snapshot Preview */}
          <div className="flex-1 flex flex-col bg-[#1E1F22] overflow-hidden">
            <div className="h-9 border-b border-[#393B40] px-4 flex items-center justify-between text-xs text-[#868A91]">
              <div className="flex items-center gap-2 truncate">
                <FileCode size={14} className="text-[#3574F0] flex-shrink-0" />
                <span className="text-[#DFE1E5] font-mono truncate">{selectedEntry.label}</span>
                <span className="text-[10.5px] text-[#868A91]">({selectedEntry.lineCount} lines)</span>
              </div>
              <button
                onClick={handleRevertClick}
                disabled={selectedEntry.id === 'current-unsaved'}
                className="px-3 py-1 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
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
          <span>Tip: Local History records snapshots automatically every time you save, test or label code.</span>
          <button
            onClick={onClose}
            className="px-4 py-1 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
