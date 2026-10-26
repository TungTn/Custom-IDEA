import React, { useState, useMemo } from 'react';
import { 
  Table as TableIcon, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Check, 
  Download, 
  Filter, 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  Key,
  Copy,
  FileSpreadsheet
} from 'lucide-react';
import { DbTable } from '../../types/database';

interface DatabaseTableGridProps {
  table: DbTable;
  dataSourceName: string;
  onUpdateTableData?: (updatedRows: Record<string, any>[]) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const DatabaseTableGrid: React.FC<DatabaseTableGridProps> = ({
  table,
  dataSourceName,
  onUpdateTableData,
  onShowToast,
}) => {
  const [rows, setRows] = useState<Record<string, any>[]>(table.data);
  const [dirtyCells, setDirtyCells] = useState<Record<string, any>>({});
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colName: string } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);

  // Filters & Sorting
  const [whereFilter, setWhereFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ colName: string; direction: 'asc' | 'desc' } | null>(null);

  // Pagination
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Filter & Sort Logic
  const processedRows = useMemo(() => {
    let result = [...rows];

    // 1. Quick search across all columns
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(row => 
        Object.values(row).some(val => String(val ?? '').toLowerCase().includes(q))
      );
    }

    // 2. WHERE filter (supports simple expressions like: status = 'completed', id > 2, name = ...)
    if (whereFilter.trim()) {
      try {
        const rawFilter = whereFilter.trim();
        const match = rawFilter.match(/([a-zA-Z0-9_]+)\s*(=|>|<|>=|<=|!=|like)\s*['"]?([^'"]+)['"]?/i);
        if (match) {
          const [, col, op, val] = match;
          result = result.filter(row => {
            const rowVal = row[col];
            if (rowVal === undefined) return true;
            const targetVal = isNaN(Number(val)) ? val : Number(val);
            const currentVal = isNaN(Number(rowVal)) ? String(rowVal) : Number(rowVal);

            switch (op.toLowerCase()) {
              case '=': return String(currentVal).toLowerCase() === String(targetVal).toLowerCase();
              case '!=': return String(currentVal).toLowerCase() !== String(targetVal).toLowerCase();
              case '>': return Number(currentVal) > Number(targetVal);
              case '<': return Number(currentVal) < Number(targetVal);
              case '>=': return Number(currentVal) >= Number(targetVal);
              case '<=': return Number(currentVal) <= Number(targetVal);
              case 'like': return String(currentVal).toLowerCase().includes(String(val).toLowerCase());
              default: return true;
            }
          });
        }
      } catch (e) {
        // ignore filter error while typing
      }
    }

    // 3. Sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.colName];
        const bVal = b[sortConfig.colName];
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        let cmp = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          cmp = aVal - bVal;
        } else {
          cmp = String(aVal).localeCompare(String(bVal));
        }
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [rows, searchQuery, whereFilter, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, currentPage, pageSize]);

  const handleSort = (colName: string) => {
    if (!sortConfig || sortConfig.colName !== colName) {
      setSortConfig({ colName, direction: 'asc' });
    } else if (sortConfig.direction === 'asc') {
      setSortConfig({ colName, direction: 'desc' });
    } else {
      setSortConfig(null);
    }
  };

  const startEditCell = (rowIdx: number, colName: string, initialVal: any) => {
    setEditingCell({ rowIdx, colName });
    setEditingValue(initialVal === null || initialVal === undefined ? '' : String(initialVal));
  };

  const confirmEditCell = () => {
    if (!editingCell) return;
    const { rowIdx, colName } = editingCell;
    const key = `${rowIdx}:${colName}`;

    setRows(prev => {
      const copy = [...prev];
      copy[rowIdx] = { ...copy[rowIdx], [colName]: editingValue };
      return copy;
    });

    setDirtyCells(prev => ({ ...prev, [key]: editingValue }));
    setEditingCell(null);
  };

  const handleAddRow = () => {
    const newId = rows.length > 0 ? Math.max(...rows.map(r => Number(r.id || 0))) + 1 : 1;
    const newRow: Record<string, any> = {};
    table.columns.forEach(col => {
      if (col.name === 'id') newRow[col.name] = newId;
      else if (col.defaultValue) newRow[col.name] = col.defaultValue.replace(/'/g, '');
      else newRow[col.name] = null;
    });

    setRows(prev => [newRow, ...prev]);
    onShowToast?.('New Row', 'Added new blank row at top (Pending submit)', 'info');
  };

  const handleDeleteRow = () => {
    if (selectedRowIdx === null) return;
    setRows(prev => prev.filter((_, idx) => idx !== selectedRowIdx));
    setSelectedRowIdx(null);
    onShowToast?.('Delete Row', 'Row marked for deletion (Pending submit)', 'info');
  };

  const handleRevert = () => {
    setRows(table.data);
    setDirtyCells({});
    onShowToast?.('Reverted', 'Reverted all unsaved changes', 'info');
  };

  const handleSubmitChanges = () => {
    const dirtyCount = Object.keys(dirtyCells).length;
    onUpdateTableData?.(rows);
    setDirtyCells({});
    onShowToast?.('Changes Submitted', `Committed ${dirtyCount} cell change(s) to ${table.name}`, 'success');
  };

  const handleExport = (format: 'csv' | 'json' | 'sql') => {
    setIsExportMenuOpen(false);
    let output = '';

    if (format === 'csv') {
      const headers = table.columns.map(c => c.name).join(',');
      const dataRows = processedRows.map(row => 
        table.columns.map(c => `"${String(row[c.name] ?? '').replace(/"/g, '""')}"`).join(',')
      );
      output = [headers, ...dataRows].join('\n');
    } else if (format === 'json') {
      output = JSON.stringify(processedRows, null, 2);
    } else if (format === 'sql') {
      const cols = table.columns.map(c => c.name).join(', ');
      output = processedRows.map(r => {
        const vals = table.columns.map(c => {
          const v = r[c.name];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return v;
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');
        return `INSERT INTO ${table.name} (${cols}) VALUES (${vals});`;
      }).join('\n');
    }

    navigator.clipboard?.writeText(output);
    onShowToast?.('Exported', `Copied ${format.toUpperCase()} dataset to clipboard (${processedRows.length} rows)`, 'success');
  };

  const hasDirtyCells = Object.keys(dirtyCells).length > 0;

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5] font-sans select-none overflow-hidden">
      {/* ─── 1. DataGrip Table Header Toolbar ─── */}
      <div className="h-9 bg-[#212225] border-b border-[#393B40] px-3 flex items-center justify-between text-xs">
        {/* Left: Table title + Quick WHERE Filter */}
        <div className="flex items-center gap-2.5 flex-1 max-w-2xl">
          <div className="flex items-center gap-1.5 font-semibold text-[#DFE1E5] flex-shrink-0">
            <TableIcon size={14} className="text-[#3574F0]" />
            <span>{table.name}</span>
            <span className="text-[10px] text-[#868A91] font-mono px-1.5 py-0.2 bg-[#2B2D30] rounded">
              {processedRows.length} rows
            </span>
          </div>

          <div className="flex-1 flex items-center gap-1.5 bg-[#1E1F22] border border-[#393B40] focus-within:border-[#3574F0] rounded px-2 py-1">
            <Filter size={11} className="text-[#868A91]" />
            <input 
              type="text"
              placeholder="Filter WHERE clause (e.g. status = 'completed', id > 2)..."
              value={whereFilter}
              onChange={(e) => setWhereFilter(e.target.value)}
              className="flex-1 bg-transparent text-[11.5px] font-mono text-[#DFE1E5] placeholder:text-[#868A91] outline-none"
            />
            {whereFilter && (
              <button onClick={() => setWhereFilter('')} className="text-[#868A91] hover:text-white text-xs">×</button>
            )}
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Quick search */}
          <div className="flex items-center gap-1 bg-[#1E1F22] border border-[#393B40] rounded px-2 py-0.5 w-36">
            <Search size={11} className="text-[#868A91]" />
            <input 
              type="text"
              placeholder="Find in cells..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-[11px] text-[#DFE1E5] placeholder:text-[#868A91] outline-none"
            />
          </div>

          <button
            onClick={handleAddRow}
            title="Add New Row"
            className="p-1 hover:bg-[#35373B] text-[#59A869] rounded transition-colors cursor-pointer"
          >
            <Plus size={14} />
          </button>

          <button
            onClick={handleDeleteRow}
            disabled={selectedRowIdx === null}
            title="Delete Selected Row"
            className="p-1 hover:bg-[#35373B] disabled:opacity-30 text-[#E55353] rounded transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
          </button>

          <button
            onClick={handleRevert}
            disabled={!hasDirtyCells}
            title="Revert All Changes"
            className="p-1 hover:bg-[#35373B] disabled:opacity-30 text-[#868A91] hover:text-white rounded transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
          </button>

          <button
            onClick={handleSubmitChanges}
            disabled={!hasDirtyCells}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer shadow-sm ${
              hasDirtyCells 
                ? 'bg-[#59A869] hover:bg-[#4E935B] text-white animate-pulse' 
                : 'bg-[#2B2D30] text-[#868A91] opacity-50 cursor-not-allowed'
            }`}
          >
            <Check size={12} />
            <span>Submit</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              title="Export Dataset"
              className="flex items-center gap-1 p-1 hover:bg-[#35373B] text-[#868A91] hover:text-white rounded cursor-pointer transition-colors"
            >
              <Download size={13} />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-[#2B2D30] border border-[#393B40] rounded shadow-2xl py-1 z-50 text-[11px] text-[#DFE1E5]">
                <div 
                  onClick={() => handleExport('csv')}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <FileSpreadsheet size={12} />
                  <span>Copy as CSV</span>
                </div>
                <div 
                  onClick={() => handleExport('json')}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <Copy size={12} />
                  <span>Copy as JSON</span>
                </div>
                <div 
                  onClick={() => handleExport('sql')}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <TableIcon size={12} />
                  <span>Copy as SQL INSERT</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2. Interactive Data Grid ─── */}
      <div className="flex-1 overflow-auto bg-[#1E1F22]">
        <table className="w-full border-collapse font-mono text-[11.5px] text-left">
          {/* Table Header */}
          <thead className="sticky top-0 z-10 bg-[#26282B] border-b border-[#393B40] text-[#868A91] select-none shadow-sm">
            <tr>
              {/* Row number gutter header */}
              <th className="w-10 px-2 py-1.5 text-center font-normal border-r border-[#393B40]/60 bg-[#26282B]">
                #
              </th>

              {table.columns.map(col => {
                const isSorted = sortConfig?.colName === col.name;
                return (
                  <th 
                    key={col.name}
                    onClick={() => handleSort(col.name)}
                    className="px-3 py-1.5 font-normal border-r border-[#393B40]/60 hover:bg-[#2F3136] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {col.isPrimaryKey && (
                          <Key size={10} className="text-[#F1A23A]"  />
                        )}
                        <span className={`font-semibold ${col.isPrimaryKey ? 'text-white' : 'text-[#DFE1E5]'}`}>
                          {col.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="text-[#4E5157] font-normal">{col.type}</span>
                        {isSorted ? (
                          sortConfig?.direction === 'asc' ? (
                            <ArrowUp size={11} className="text-[#3574F0]" />
                          ) : (
                            <ArrowDown size={11} className="text-[#3574F0]" />
                          )
                        ) : (
                          <ArrowUpDown size={10} className="text-[#4E5157] opacity-0 hover:opacity-100" />
                        )}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={table.columns.length + 1} className="p-8 text-center text-[#868A91] font-sans text-xs">
                  No records match current filter or table is empty.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, rowIdx) => {
                const globalRowIdx = (currentPage - 1) * pageSize + rowIdx;
                const isSelected = selectedRowIdx === globalRowIdx;

                return (
                  <tr 
                    key={globalRowIdx}
                    onClick={() => setSelectedRowIdx(globalRowIdx)}
                    className={`border-b border-[#2B2D30] hover:bg-[#2E436E]/20 transition-colors ${
                      isSelected ? 'bg-[#2E436E]/40' : ''
                    }`}
                  >
                    {/* Row index number */}
                    <td className="px-2 py-1 text-center text-[#868A91] text-[10.5px] border-r border-[#393B40]/60 bg-[#212225]/50 select-none">
                      {globalRowIdx + 1}
                    </td>

                    {/* Columns */}
                    {table.columns.map(col => {
                      const val = row[col.name];
                      const isEditing = editingCell?.rowIdx === globalRowIdx && editingCell?.colName === col.name;
                      const isDirty = `${globalRowIdx}:${col.name}` in dirtyCells;

                      return (
                        <td 
                          key={col.name}
                          onDoubleClick={() => startEditCell(globalRowIdx, col.name, val)}
                          className={`px-3 py-1 border-r border-[#2B2D30] truncate max-w-[260px] relative ${
                            isDirty ? 'bg-[#28384D] text-[#70B0FF] font-medium' : ''
                          }`}
                        >
                          {isEditing ? (
                            <input 
                              type="text"
                              autoFocus
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmEditCell();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              onBlur={confirmEditCell}
                              className="w-full bg-[#1E1F22] border border-[#3574F0] rounded px-1 py-0.5 text-xs text-white outline-none -my-1"
                            />
                          ) : (
                            <span className={val === null || val === undefined ? 'text-[#868A91] italic text-[10.5px]' : ''}>
                              {val === null || val === undefined ? '<null>' : typeof val === 'boolean' ? (val ? 'true' : 'false') : String(val)}
                            </span>
                          )}

                          {isDirty && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#3574F0]" title="Unsaved edit" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ─── 3. Pagination Footer ─── */}
      <div className="h-7 bg-[#212225] border-t border-[#393B40] px-3 flex items-center justify-between text-[11px] text-[#868A91]">
        <div className="flex items-center gap-2">
          <span>Source: <strong className="text-[#DFE1E5]">{dataSourceName}</strong></span>
          <span>•</span>
          <span>Showing {paginatedRows.length} of {processedRows.length} rows</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span>Page size:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-[#2B2D30] border border-[#393B40] text-[#DFE1E5] rounded px-1.5 py-0.5 outline-none cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-[#35373B] disabled:opacity-30 disabled:hover:bg-transparent text-white cursor-pointer"
            >
              <ChevronLeft size={12} />
            </button>
            <span>{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 rounded hover:bg-[#35373B] disabled:opacity-30 disabled:hover:bg-transparent text-white cursor-pointer"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

