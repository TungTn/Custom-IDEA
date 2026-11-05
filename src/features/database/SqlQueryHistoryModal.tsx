import React, { useState, useMemo } from 'react';
import {
  X,
  History,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Trash2,
  ArrowRight,
  Database,
  Terminal,
} from 'lucide-react';

export interface SqlHistoryEntry {
  id: string;
  query: string;
  timestamp: string;
  executionTimeMs: number;
  dataSourceName?: string;
  status: 'success' | 'error';
  rowCount?: number;
  error?: string;
}

export const STORAGE_KEY_SQL_HISTORY = 'ij_sql_query_history_v2';

export function loadSqlHistory(): SqlHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SQL_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed to load SQL history:', e);
  }
  return [
    {
      id: 'h1',
      query: 'SELECT * FROM projects ORDER BY last_opened DESC;',
      timestamp: new Date().toLocaleTimeString(),
      executionTimeMs: 14,
      status: 'success',
      rowCount: 8,
    },
    {
      id: 'h2',
      query: 'SELECT * FROM users WHERE is_active = 1;',
      timestamp: new Date().toLocaleTimeString(),
      executionTimeMs: 22,
      status: 'success',
      rowCount: 25,
    },
    {
      id: 'h3',
      query: 'SELECT product_id, title, price, stock_quantity FROM products WHERE price > 100;',
      timestamp: new Date().toLocaleTimeString(),
      executionTimeMs: 9,
      status: 'success',
      rowCount: 12,
    },
  ];
}

export function saveSqlHistory(entries: SqlHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SQL_HISTORY, JSON.stringify(entries.slice(0, 100)));
  } catch (e) {
    console.error('Failed to save SQL history:', e);
  }
}

interface SqlQueryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuery: (query: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const SqlQueryHistoryModal: React.FC<SqlQueryHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectQuery,
  onShowToast,
}) => {
  const [history, setHistory] = useState<SqlHistoryEntry[]>(() => loadSqlHistory());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const q = searchQuery.toLowerCase();
    return history.filter(
      (h) =>
        h.query.toLowerCase().includes(q) ||
        (h.dataSourceName && h.dataSourceName.toLowerCase().includes(q))
    );
  }, [history, searchQuery]);

  const activeEntry = useMemo(() => {
    return history.find((h) => h.id === selectedEntryId) || filteredHistory[0];
  }, [history, selectedEntryId, filteredHistory]);

  const handleClear = () => {
    setHistory([]);
    saveSqlHistory([]);
    onShowToast?.('History Cleared', 'SQL query history has been erased', 'info');
  };

  const handleUseQuery = (q: string) => {
    onSelectQuery(q);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-4 animate-in fade-in duration-150">
      <div className="bg-[#1E1F22] border border-[#393B40] rounded-lg shadow-2xl w-[850px] max-w-[95vw] h-[550px] max-h-[90vh] flex flex-col overflow-hidden text-[#DFE1E5] font-sans">
        {/* Header */}
        <div className="h-10 bg-[#2B2D30] border-b border-[#393B40] px-4 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <History size={16} className="text-[#3574F0]" />
            <span className="font-semibold text-xs text-white">SQL Query History (DataGrip)</span>
            <span className="text-[11px] text-[#868A91]">({history.length} queries)</span>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={handleClear}
                className="text-[11px] text-[#868A91] hover:text-[#E05555] flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#393B40] transition-colors"
                title="Clear all history"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#E05555] rounded text-[#868A91] hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="h-9 bg-[#212226] border-b border-[#393B40] px-3 flex items-center gap-2 text-xs">
          <Search size={13} className="text-[#868A91]" />
          <input
            type="text"
            placeholder="Filter recent queries by keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-white outline-none text-[11.5px] placeholder:text-[#868A91]"
            autoFocus
          />
        </div>

        {/* Content: Left list, Right preview */}
        <div className="flex-1 grid grid-cols-5 divide-x divide-[#393B40] overflow-hidden bg-[#1E1F22]">
          {/* List */}
          <div className="col-span-2 overflow-y-auto divide-y divide-[#393B40]/40 font-mono text-[11px]">
            {filteredHistory.length === 0 ? (
              <div className="p-6 text-center text-[#868A91] font-sans text-xs">
                No matching queries found in history.
              </div>
            ) : (
              filteredHistory.map((item) => {
                const isSelected = activeEntry?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedEntryId(item.id)}
                    onDoubleClick={() => handleUseQuery(item.query)}
                    className={`p-2.5 cursor-pointer transition-colors flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-[#2E436E] text-white font-medium'
                        : 'hover:bg-[#2B2D30] text-[#DFE1E5]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#868A91]">
                      <span className="flex items-center gap-1 font-sans">
                        {item.status === 'success' ? (
                          <CheckCircle2 size={11} className="text-[#59A869]" />
                        ) : (
                          <AlertCircle size={11} className="text-[#E05555]" />
                        )}
                        <span>{item.timestamp}</span>
                      </span>
                      <span>{item.executionTimeMs}ms</span>
                    </div>
                    <div className="truncate text-[11px] leading-tight">
                      {item.query.replace(/\n/g, ' ')}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Preview / Detail */}
          <div className="col-span-3 flex flex-col h-full overflow-hidden bg-[#18191B] p-4">
            {activeEntry ? (
              <>
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#393B40]">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#868A91]">Executed at:</span>
                    <span className="text-white font-mono text-[11px]">{activeEntry.timestamp}</span>
                    <span className="text-[#868A91]">•</span>
                    <span className="text-[#59A869] font-mono text-[11px]">{activeEntry.executionTimeMs}ms</span>
                  </div>

                  <button
                    onClick={() => handleUseQuery(activeEntry.query)}
                    className="px-3 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow"
                  >
                    <span>Insert into Console</span>
                    <ArrowRight size={12} />
                  </button>
                </div>

                <div className="flex-1 overflow-auto rounded bg-[#1E1F22] border border-[#393B40] p-3 font-mono text-xs text-white whitespace-pre-wrap leading-relaxed select-text">
                  {activeEntry.query}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[#868A91] text-xs">
                <Terminal size={24} className="mb-2 text-[#393B40]" />
                <span>Select a query from the left to view details</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-9 bg-[#26282B] border-t border-[#393B40] px-4 flex items-center justify-between text-xs select-none">
          <span className="text-[11px] text-[#868A91]">Double-click any entry to insert immediately.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#35373B] hover:bg-[#393B40] text-white rounded text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
