import React, { useState, useRef } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
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
  FileCode
} from 'lucide-react';
import { DataSourceConnection, DbQueryResult, DbTable } from '../../types/database';

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
  const [queryHistory, setQueryHistory] = useState<string[]>([
    'SELECT * FROM projects ORDER BY last_opened DESC;',
    'SELECT * FROM users WHERE is_active = 1;',
    'SELECT product_id, title, price, stock_quantity FROM products WHERE price > 100;',
  ]);

  const activeDataSource = dataSources.find(ds => ds.id === selectedDsId) || dataSources[0];

  const executeSql = () => {
    if (!activeDataSource) return;
    setIsExecuting(true);
    const start = performance.now();

    setTimeout(() => {
      setIsExecuting(false);
      const executionTime = Math.round(performance.now() - start + Math.random() * 8 + 4);

      // Clean query
      const trimmed = queryText.trim().replace(/^--.*$/gm, '').trim();
      const selectMatch = trimmed.match(/SELECT\s+(.*?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.*?))?(?:\s+ORDER\s+BY\s+(.*?))?(?:\s+LIMIT\s+(\d+))?;?/i);

      if (!selectMatch) {
        setQueryResult({
          columns: ['status', 'message'],
          rows: [{ status: 'OK', message: `Executed non-query statement successfully (${executionTime}ms)` }],
          executionTimeMs: executionTime,
          affectedRows: 1,
        });
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
      setQueryHistory(prev => {
        const next = [trimmed, ...prev.filter(q => q !== trimmed)].slice(0, 10);
        return next;
      });

      onShowToast?.('Query Completed', `${resultRows.length} rows retrieved in ${executionTime}ms`, 'success');
    }, 180);
  };

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    // Register Ctrl+Enter command to execute query
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      executeSql();
    });
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

          {/* Query History Dropdown */}
          <div className="flex items-center gap-1 text-[11px] ml-2">
            <History size={12} className="text-[#868A91]" />
            <select
              onChange={(e) => {
                if (e.target.value) setQueryText(e.target.value);
              }}
              defaultValue=""
              className="bg-[#2B2D30] border border-[#393B40] text-[#868A91] hover:text-[#DFE1E5] rounded px-2 py-0.5 outline-none text-[10.5px] cursor-pointer max-w-[180px] truncate"
            >
              <option value="" disabled>Recent Queries...</option>
              {queryHistory.map((q, idx) => (
                <option key={idx} value={q}>
                  {q.replace(/\n/g, ' ')}
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

      {/* ─── 2. Monaco SQL Editor ─── */}
      <div className="h-[220px] border-b border-[#393B40] relative">
        <Editor
          height="100%"
          language="sql"
          theme="intellij-new-ui-dark"
          value={queryText}
          onChange={(val) => setQueryText(val || '')}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 13,
            fontFamily: '"JetBrains Mono", Consolas, monospace',
            lineNumbers: 'on',
            minimap: { enabled: false },
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
          }}
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
    </div>
  );
};
