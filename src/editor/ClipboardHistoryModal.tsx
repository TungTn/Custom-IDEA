import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clipboard, X, Search, Trash2, Check, CornerDownLeft, FileText, Clock } from 'lucide-react';
import { clipboardHistoryService, ClipboardEntry } from '../services/clipboardHistoryService';

export interface ClipboardHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaste: (text: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ClipboardHistoryModal: React.FC<ClipboardHistoryModalProps> = ({
  isOpen,
  onClose,
  onPaste,
  onShowToast,
}) => {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      const current = clipboardHistoryService.getEntries();
      setEntries(current);
      if (current.length > 0) {
        setSelectedId(current[0].id);
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter((e) => e.text.toLowerCase().includes(q));
  }, [entries, searchQuery]);

  const selectedEntry = useMemo(() => {
    return filteredEntries.find((e) => e.id === selectedId) || filteredEntries[0] || null;
  }, [filteredEntries, selectedId]);

  const handlePaste = (textToPaste?: string) => {
    const text = textToPaste || selectedEntry?.text;
    if (text) {
      onPaste(text);
      onClose();
    }
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    clipboardHistoryService.removeEntry(id);
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    if (selectedId === id && updated.length > 0) {
      setSelectedId(updated[0].id);
    }
  };

  const handleClearAll = () => {
    if (confirm('Clear all clipboard history?')) {
      clipboardHistoryService.clearHistory();
      setEntries([]);
      setSelectedId('');
      onShowToast?.('Clipboard History', 'Clipboard history cleared', 'info');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedEntry) {
        handlePaste(selectedEntry.text);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = filteredEntries.findIndex((e) => e.id === selectedId);
      if (idx !== -1 && idx < filteredEntries.length - 1) {
        setSelectedId(filteredEntries[idx + 1].id);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = filteredEntries.findIndex((e) => e.id === selectedId);
      if (idx > 0) {
        setSelectedId(filteredEntries[idx - 1].id);
      }
    } else if (e.key === 'Delete') {
      if (selectedEntry && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        handleDelete(selectedEntry.id);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100 font-sans"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-[820px] h-[500px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs text-[#DFE1E5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-10 bg-[#212225] border-b border-[#393B40] flex items-center justify-between px-3.5">
          <div className="flex items-center gap-2">
            <Clipboard size={15} className="text-[#3574F0]" />
            <span className="font-semibold text-white">Choose Content to Paste</span>
            <span className="text-[10px] text-[#868A91] font-mono px-1.5 py-0.5 rounded bg-[#1E1F22] border border-[#393B40]">
              Ctrl+Shift+V
            </span>
          </div>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] text-[#868A91] hover:text-[#E55353] flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-[#35373B] cursor-pointer"
                title="Clear clipboard history"
              >
                <Trash2 size={12} />
                <span>Clear All</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-white cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-2 bg-[#26282B] border-b border-[#393B40] flex items-center gap-2">
          <Search size={14} className="text-[#868A91] ml-1" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              const found = entries.filter((item) =>
                item.text.toLowerCase().includes(e.target.value.toLowerCase())
              );
              if (found.length > 0) setSelectedId(found[0].id);
            }}
            placeholder="Search clipboard snippets (press Up/Down to navigate, Enter to paste)..."
            className="flex-1 bg-transparent text-white outline-none text-xs placeholder:text-[#6F737A]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[#868A91] hover:text-white p-0.5 rounded"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Main Split: Left Snippet List, Right Full Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left list */}
          <div ref={listRef} className="w-[340px] bg-[#26282B] border-r border-[#393B40] overflow-y-auto p-1.5 space-y-1">
            {filteredEntries.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#868A91]">
                {entries.length === 0
                  ? 'Clipboard history is empty. Copy text anywhere in the editor to record.'
                  : 'No matching snippets found.'}
              </div>
            ) : (
              filteredEntries.map((item, idx) => {
                const isSelected = item.id === (selectedEntry?.id || '');
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    onDoubleClick={() => handlePaste(item.text)}
                    className={`p-2 rounded-lg text-xs transition-colors cursor-pointer group flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#3574F0] text-white shadow-sm'
                        : 'text-[#DFE1E5] hover:bg-[#35373B]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[9.5px] font-mono px-1 rounded ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[#1E1F22] text-[#868A91]'
                        }`}>
                          #{idx + 1}
                        </span>
                        <span className="font-mono text-[11px] truncate flex-1 block">
                          {item.preview}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] opacity-75">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {item.displayTime}
                        </span>
                        <span>•</span>
                        <span>{item.lineCount} {item.lineCount === 1 ? 'line' : 'lines'}</span>
                        <span>•</span>
                        <span>{item.charCount} chars</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      title="Delete item"
                      className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/20 transition-opacity ${
                        isSelected ? 'text-white' : 'text-[#868A91] hover:text-[#E55353]'
                      }`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Right preview */}
          <div className="flex-1 flex flex-col bg-[#1E1F22] overflow-hidden">
            {selectedEntry ? (
              <>
                <div className="h-8 border-b border-[#393B40] px-3.5 flex items-center justify-between text-[11px] text-[#868A91] bg-[#212225]">
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-[#3574F0]" />
                    <span className="text-[#DFE1E5]">Preview</span>
                    <span>({selectedEntry.lineCount} lines, {selectedEntry.charCount} characters)</span>
                  </div>
                  <span className="text-[10px] text-[#6F737A]">Double-click or press Enter to paste</span>
                </div>
                <div className="flex-1 p-3.5 font-mono text-[11.5px] text-[#DFE1E5] overflow-auto whitespace-pre leading-relaxed select-text bg-[#1E1F22]">
                  {selectedEntry.text}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-[#868A91]">
                Select an item on the left to preview
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-11 bg-[#212225] border-t border-[#393B40] flex items-center justify-between px-3.5 text-xs text-[#868A91]">
          <div className="flex items-center gap-3 text-[11px]">
            <span><kbd className="px-1.5 py-0.5 rounded bg-[#2B2D30] border border-[#393B40] font-mono text-[10px] text-[#DFE1E5]">Enter</kbd> Paste</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-[#2B2D30] border border-[#393B40] font-mono text-[10px] text-[#DFE1E5]">↑/↓</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-[#2B2D30] border border-[#393B40] font-mono text-[10px] text-[#DFE1E5]">Del</kbd> Delete</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-[#2B2D30] border border-[#393B40] font-mono text-[10px] text-[#DFE1E5]">Esc</kbd> Close</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => handlePaste()}
              disabled={!selectedEntry}
              className="px-3.5 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-40 text-white font-medium rounded text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <CornerDownLeft size={13} />
              <span>Paste</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
