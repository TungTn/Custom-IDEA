import React, { useState, useRef } from 'react';
import { CmEditor } from '../../editor';
import { 
  Play, 
  Terminal, 
  Database, 
  History, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Clock, 
  Layers,
  FileCode,
  ChevronDown
} from 'lucide-react';
import { DataSourceConnection, DbQueryResult, DbTable, getDataSourceUrl } from '../../types/database';
import { safeInvoke, isTauriEnvironment } from '../../platform';
import { DbQueryResultDto } from '../../bindings';
import { loadSqlHistory, saveSqlHistory, SqlHistoryEntry, SqlQueryHistoryModal } from './SqlQueryHistoryModal';

interface SqlQueryConsoleProps {
  dataSources: DataSourceConnection[];
  initialDataSourceId?: string;
  initialQuery?: string;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const SqlQueryConsole: React.FC<SqlQueryConsoleProps> = ({
  dataSources,
  initialDataSourceId,
  initialQuery,
  onShowToast,
}) => {
  const [selectedDsId, setSelectedDsId] = useState<string>(
    initialDataSourceId || dataSources[0]?.id || ''
  );
  const [queryText, setQueryText] = useState<string>(
    initialQuery || `-- SQL Query Console (DataGrip)\n-- Press Ctrl+Enter to execute query\n\nSELECT * FROM projects ORDER BY last_opened DESC;`
  );

  const [queryResult, setQueryResult] = useState<DbQueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [queryHistory, setQueryHistory] = useState<SqlHistoryEntry[]>(() => loadSqlHistory());

  const activeDataSource = dataSources.find(ds => ds.id === selectedDsId) || dataSources[0];

  const executeSql = async () => {
    if (!activeDataSource) return;
    setIsExecuting(true);
    const start = performance.now();

    const trimmed = queryText.trim().replace(/^--.*$/gm, '').trim();
    if (!trimmed) {
      setIsExecuting(false);
      return;
    }

    if (isTauriEnvironment()) {
      try {
        const url = getDataSourceUrl(activeDataSource);
        const res = await safeInvoke<DbQueryResultDto>('db_execute_query', {
          url,
          query: trimmed,
          maxRows: 500,
        });

        setIsExecuting(false);
        const execTime = res ? Number(res.executionTimeMs) : Math.round(performance.now() - start);
        if (res) {
          if (res.error) {
            setQueryResult({
              columns: ['error'],
              rows: [],
              executionTimeMs: execTime,
              error: res.error,
            });
            const newEntry: SqlHistoryEntry = {
              id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              query: trimmed,
              timestamp: new Date().toLocaleTimeString(),
              executionTimeMs: execTime,
              dataSourceName: activeDataSource.name,
              status: 'error',
              error: res.error,
            };
            const updated = [newEntry, ...queryHistory.filter(h => h.query !== trimmed)].slice(0, 100);
            setQueryHistory(updated);
            saveSqlHistory(updated);
            onShowToast?.('Query Error', res.error, 'error');
          } else {
            setQueryResult({
              columns: res.columns,
              rows: res.rows,
              executionTimeMs: execTime,
              affectedRows: Number(res.affectedRows),
            });
            const newEntry: SqlHistoryEntry = {
              id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              query: trimmed,
              timestamp: new Date().toLocaleTimeString(),
              executionTimeMs: execTime,
              dataSourceName: activeDataSource.name,
              status: 'success',
              rowCount: res.rows.length,
            };
            const updated = [newEntry, ...queryHistory.filter(h => h.query !== trimmed)].slice(0, 100);
            setQueryHistory(updated);
            saveSqlHistory(updated);
            onShowToast?.(
              'Query Executed',
              res.columns.includes('status')
                ? `Statement executed in ${execTime}ms`
                : `${res.rows.length} rows retrieved in ${execTime}ms`,
              'success'
            );
          }
          return;
        }
      } catch (err: any) {
        setIsExecuting(false);
        const errMsg = err?.message || String(err);
        const execTime = Math.round(performance.now() - start);
        setQueryResult({
          columns: ['error'],
          rows: [],
          executionTimeMs: execTime,
          error: errMsg,
        });
        const newEntry: SqlHistoryEntry = {
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          query: trimmed,
          timestamp: new Date().toLocaleTimeString(),
          executionTimeMs: execTime,
          dataSourceName: activeDataSource.name,
          status: 'error',
          error: errMsg,
        };
        const updated = [newEntry, ...queryHistory.filter(h => h.query !== trimmed)].slice(0, 100);
        setQueryHistory(updated);
        saveSqlHistory(updated);
        onShowToast?.('Query Error', errMsg, 'error');
        return;
      }
    }

    setTimeout(() => {
      setIsExecuting(false);
      const executionTime = Math.round(performance.now() - start + Math.random() * 8 + 4);

      // Clean query
      const selectMatch = trimmed.match(/SELECT\s+(.*?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.*?))?(?:\s+ORDER\s+BY\s+(.*?))?(?:\s+LIMIT\s+(\d+))?;?/i);

      if (!selectMatch) {
        setQueryResult({
          columns: ['status', 'message'],
          rows: [{ status: 'OK', message: `Executed non-query statement successfully (${executionTime}ms)` }],
          executionTimeMs: executionTime,
          affectedRows: 1,
        });
        const newEntry: SqlHistoryEntry = {
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          query: trimmed,
          timestamp: new Date().toLocaleTimeString(),
          executionTimeMs: executionTime,
          dataSourceName: activeDataSource.name,
          status: 'success',
          rowCount: 1,
        };
        const updated = [newEntry, ...queryHistory.filter(h => h.query !== trimmed)].slice(0, 100);
        setQueryHistory(updated);
        saveSqlHistory(updated);
        onShowToast?.('Query Executed', `Executed statement in ${executionTime}ms`, 'success');
        return;
      }

      const [, rawCols, tableName, rawWhere, rawOrder, rawLimit] = selectMatch;

      // Find table in active schema
      let foundTable: DbTable | undefined;
      for (const s of activeDataSource.schemas) {
        foundTable = s.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
        if (foundTable) break;
      }

      if (!foundTable) {
        setQueryResult({
          columns: ['error'],
          rows: [],
          executionTimeMs: executionTime,
          error: `Table "${tableName}" not found in current schema for ${activeDataSource.name}`
        });
        const newEntry: SqlHistoryEntry = {
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          query: trimmed,
          timestamp: new Date().toLocaleTimeString(),
          executionTimeMs: executionTime,
          dataSourceName: activeDataSource.name,
          status: 'error',
          error: `Table "${tableName}" not found`,
        };
        const updated = [newEntry, ...queryHistory.filter(h => h.query !== trimmed)].slice(0, 100);
        setQueryHistory(updated);
        saveSqlHistory(updated);
        onShowToast?.('Query Error', `Table "${tableName}" does not exist`, 'error');
        return;
      }

      let resultRows = [...foundTable.data];

      // Simple WHERE filter simulation
      if (rawWhere) {
        const whereCond = rawWhere.match(/([a-zA-Z0-9_]+)\s*(=|>|<|>=|<=|!=|like)\s*['"]?([^'"]+)['"]?/i);
        if (whereCond) {
          const [, col, op, val] = whereCond;
          resultRows = resultRows.filter(row => {
            const currentVal = row[col];
            if (currentVal === undefined) return true;
            const targetVal = isNaN(Number(val)) ? val : Number(val);
            switch (op.toLowerCase()) {
              case '=': return String(currentVal).toLowerCase() === String(targetVal).toLowerCase();
              case '!=': return String(currentVal).toLowerCase() !== String(targetVal).toLowerCase();
              case '>': return Number(currentVal) > Number(targetVal);
              case '<': return Number(currentVal) < Number(targetVal);
              case 'like': return String(currentVal).toLowerCase().includes(String(val).toLowerCase());
              default: return true;
            }
          });
        }
      }

      // Column projection
      const columns = rawCols.trim() === '*' 
        ? foundTable.columns.map(c => c.name) 
        : rawCols.split(',').map(c => c.trim().replace(/^.*?\./, ''));

      // Limit
      if (rawLimit) {
        resultRows = resultRows.slice(0, Number(rawLimit));
      }

      setQueryResult({
        columns,
        rows: resultRows,
        executionTimeMs: executionTime,
      });

      // Update history
      const newEntry: SqlHistoryEntry = {
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        query: trimmed,
        timestamp: new Date().toLocaleTimeString(),
        executionTimeMs: executionTime,
        dataSourceName: activeDataSource.name,
        status: 'success',
        rowCount: resultRows.length,
      };
      const updated = [newEntry, ...queryHistory.filter(h => h.query !== trimmed)].slice(0, 100);
      setQueryHistory(updated);
      saveSqlHistory(updated);

      onShowToast?.('Query Completed', `${resultRows.length} rows retrieved in ${executionTime}ms`, 'success');
    }, 180);
  };




  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const handleExportData = (format: 'csv' | 'json' | 'sql') => {
    setIsExportMenuOpen(false);
    if (!queryResult || queryResult.rows.length === 0) return;

    let output = '';
    const tableName = selectedDsId ? 'query_results' : 'results';

    if (format === 'csv') {
      const headers = queryResult.columns.join(',');
      const dataRows = queryResult.rows.map(row => 
        queryResult.columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return '';
          const str = String(val);
          return str.includes(',') || str.includes('\n') || str.includes('"') 
            ? `"${str.replace(/"/g, '""')}"` 
            : str;
        }).join(',')
      );
      output = [headers, ...dataRows].join('\n');
    } else if (format === 'json') {
      output = JSON.stringify(queryResult.rows, null, 2);
    } else if (format === 'sql') {
      const cols = queryResult.columns.join(', ');
      const inserts = queryResult.rows.map(row => {
        const vals = queryResult.columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return val;
          return `'${String(val).replace(/'/g, "''")}'`;
        }).join(', ');
        return `INSERT INTO ${tableName} (${cols}) VALUES (${vals});`;
      });
      output = inserts.join('\n');
    }

    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tableName}_${Date.now()}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
    onShowToast?.('Export Completed', `Exported ${queryResult.rows.length} row(s) to ${format.toUpperCase()}`, 'success');
  };

  const copyResultToClipboard = () => {
    if (!queryResult || queryResult.rows.length === 0) return;
    const headers = queryResult.columns.join('\t');
    const dataLines = queryResult.rows.map(r => 
      queryResult.columns.map(c => String(r[c] ?? '')).join('\t')
    );
    navigator.clipboard?.writeText([headers, ...dataLines].join('\n'));
    onShowToast?.('Copied', 'Query results copied as TSV to clipboard', 'info');
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5] font-sans select-none overflow-hidden">
      {/* ─── 1. SQL Console Toolbar ─── */}
      <div className="h-9 bg-[#212225] border-b border-[#393B40] px-3 flex items-center justify-between text-xs">
        {/* Left: Run button & Connection selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={executeSql}
            disabled={isExecuting}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#59A869] hover:bg-[#4E935B] disabled:opacity-50 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer shadow-sm"
            title="Execute Statement (Ctrl+Enter)"
          >
            <Play size={12} className="fill-white" />
            <span>Run (Ctrl+Enter)</span>
          </button>

          <div className="h-4 w-px bg-[#393B40] mx-1" />

          {/* Data Source Selector */}
          <div className="flex items-center gap-1 text-[11px]">
            <Database size={12} className="text-[#3574F0]" />
            <select
              value={selectedDsId}
              onChange={(e) => setSelectedDsId(e.target.value)}
              className="bg-[#2B2D30] border border-[#393B40] text-[#DFE1E5] rounded px-2 py-0.5 outline-none font-mono cursor-pointer"
            >
              {dataSources.map(ds => (
                <option key={ds.id} value={ds.id}>
                  {ds.name}
                </option>
              ))}
            </select>
          </div>

          {/* Export Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              disabled={!queryResult || queryResult.rows.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#2B2D30] hover:bg-[#323438] disabled:opacity-40 text-[#DFE1E5] rounded text-[11px] font-medium transition-colors border border-[#393B40] cursor-pointer"
              title="Export Query Results"
            >
              <Download size={12} className="text-[#3574F0]" />
              <span>Export</span>
              <ChevronDown size={11} className="text-[#868A91]" />
            </button>

            {isExportMenuOpen && (
              <div
                className="absolute top-full left-0 mt-1 bg-[#2B2D30] border border-[#393B40] rounded shadow-xl py-1 w-44 text-xs text-[#DFE1E5] z-50 select-none animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => handleExportData('csv')}
                  className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors text-left"
                >
                  <span>Export as CSV</span>
                  <span className="text-[10px] text-[#868A91]">.csv</span>
                </button>
                <button
                  onClick={() => handleExportData('json')}
                  className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors text-left"
                >
                  <span>Export as JSON</span>
                  <span className="text-[10px] text-[#868A91]">.json</span>
                </button>
                <button
                  onClick={() => handleExportData('sql')}
                  className="w-full px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors text-left"
                >
                  <span>Export as SQL Insert</span>
                  <span className="text-[10px] text-[#868A91]">.sql</span>
                </button>
              </div>
            )}
          </div>

          {/* Query History Inspector & Dropdown */}
          <div className="flex items-center gap-1.5 text-[11px] ml-2">
            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="flex items-center gap-1.5 px-2 py-0.5 bg-[#2B2D30] hover:bg-[#323438] text-[#DFE1E5] rounded text-[11px] font-medium transition-colors border border-[#393B40] cursor-pointer"
              title="Open SQL Query History Inspector"
            >
              <History size={12} className="text-[#3574F0]" />
              <span>History</span>
            </button>
            <select
              onChange={(e) => {
                if (e.target.value) setQueryText(e.target.value);
              }}
              value=""
              className="bg-[#2B2D30] border border-[#393B40] text-[#868A91] hover:text-[#DFE1E5] rounded px-2 py-0.5 outline-none text-[10.5px] cursor-pointer max-w-[180px] truncate"
            >
              <option value="" disabled>Recent Queries ({queryHistory.length})...</option>
              {queryHistory.slice(0, 15).map((entry) => (
                <option key={entry.id} value={entry.query}>
                  {entry.query.replace(/\s+/g, ' ').substring(0, 45)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right tools */}
        <div className="flex items-center gap-2 text-[11px] text-[#868A91]">
          <button
            onClick={() => setQueryText('')}
            title="Clear Editor"
            className="p-1 hover:bg-[#35373B] hover:text-white rounded transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* ─── 2. SQL Editor (CodeMirror 6) ─── */}
      <div 
        className="h-[220px] border-b border-[#393B40] relative"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            executeSql();
          }
        }}
      >
        <CmEditor
          filePath="query.sql"
          language="sql"
          content={queryText}
          onChange={(val: string) => setQueryText(val)}
        />
      </div>

      {/* ─── 3. Results Header Status Bar ─── */}
      <div className="h-7 bg-[#212225] border-b border-[#393B40] px-3 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-2">
          {queryResult?.error ? (
            <div className="flex items-center gap-1.5 text-[#E55353] text-[11px]">
              <AlertCircle size={13} />
              <span>Query Failed: {queryResult.error}</span>
            </div>
          ) : queryResult ? (
            <div className="flex items-center gap-1.5 text-[#59A869] text-[11px]">
              <CheckCircle2 size={13} />
              <span className="font-medium">
                Completed in {queryResult.executionTimeMs}ms • {queryResult.rows.length} rows returned
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-[#868A91]">
              Ready. Press <kbd className="px-1 py-0.5 rounded bg-[#2B2D30] border border-[#393B40] text-white">Ctrl+Enter</kbd> to execute
            </span>
          )}
        </div>

        {queryResult && queryResult.rows.length > 0 && (
          <button
            onClick={copyResultToClipboard}
            className="flex items-center gap-1 text-[10.5px] text-[#868A91] hover:text-[#DFE1E5] px-1.5 py-0.5 rounded hover:bg-[#35373B] cursor-pointer transition-colors"
          >
            <Download size={11} />
            <span>Copy TSV</span>
          </button>
        )}
      </div>

      {/* ─── 4. Query Results Grid ─── */}
      <div className="flex-1 overflow-auto bg-[#1E1F22]">
        {!queryResult ? (
          <div className="h-full flex flex-col items-center justify-center text-[#868A91] text-xs">
            <Terminal size={24} className="text-[#393B40] mb-2" />
            <span>Query output will appear here</span>
          </div>
        ) : queryResult.error ? (
          <div className="p-4 bg-[#2A1E1E] text-[#FF8585] font-mono text-xs border-l-2 border-[#E55353] m-3 rounded">
            {queryResult.error}
          </div>
        ) : (
          <table className="w-full border-collapse font-mono text-[11.5px] text-left">
            <thead className="sticky top-0 bg-[#26282B] border-b border-[#393B40] text-[#868A91] shadow-sm">
              <tr>
                <th className="w-10 px-2 py-1.5 text-center font-normal border-r border-[#393B40]/60 bg-[#26282B]">
                  #
                </th>
                {queryResult.columns.map(col => (
                  <th key={col} className="px-3 py-1.5 font-semibold text-[#DFE1E5] border-r border-[#393B40]/60">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queryResult.rows.length === 0 ? (
                <tr>
                  <td colSpan={queryResult.columns.length + 1} className="p-6 text-center text-[#868A91]">
                    No rows returned by query.
                  </td>
                </tr>
              ) : (
                queryResult.rows.map((row, idx) => (
                  <tr key={idx} className="border-b border-[#2B2D30] hover:bg-[#2E436E]/20 transition-colors">
                    <td className="px-2 py-1 text-center text-[#868A91] text-[10.5px] border-r border-[#393B40]/60 bg-[#212225]/40 select-none">
                      {idx + 1}
                    </td>
                    {queryResult.columns.map(col => {
                      const val = row[col];
                      return (
                        <td key={col} className="px-3 py-1 border-r border-[#2B2D30] truncate max-w-[280px]">
                          {val === null || val === undefined ? (
                            <span className="text-[#868A91] italic text-[10.5px]">&lt;null&gt;</span>
                          ) : typeof val === 'boolean' ? (
                            <span className={val ? 'text-[#59A869]' : 'text-[#E55353]'}>{val ? 'true' : 'false'}</span>
                          ) : (
                            String(val)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <SqlQueryHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onSelectQuery={(q) => {
          setQueryText(q);
          setIsHistoryModalOpen(false);
          onShowToast?.('Query Selected', 'Query pasted into editor console', 'info');
        }}
        onShowToast={onShowToast}
      />
    </div>
  );
};
