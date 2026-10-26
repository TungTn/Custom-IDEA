import React, { useState } from 'react';
import { 
  Database, 
  Table, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  RefreshCw, 
  Terminal, 
  Key, 
  Folder, 
  Layers, 
  MoreVertical, 
  ExternalLink, 
  Trash2, 
  FileCode,
  CheckCircle2,
  ListFilter
} from 'lucide-react';
import { DataSourceConnection, DbTable, DbColumn } from '../../types/database';

interface DatabaseExplorerProps {
  dataSources: DataSourceConnection[];
  onOpenTableData: (dataSourceId: string, schema: string, tableName: string) => void;
  onOpenSqlConsole: (dataSourceId: string) => void;
  onAddNewDataSource: () => void;
  onRemoveDataSource?: (id: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const DatabaseExplorer: React.FC<DatabaseExplorerProps> = ({
  dataSources,
  onOpenTableData,
  onOpenSqlConsole,
  onAddNewDataSource,
  onRemoveDataSource,
  onShowToast,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(['ds-sqlite-app', 'ds-sqlite-app/main', 'ds-pg-ecommerce', 'ds-pg-ecommerce/public'])
  );
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'table' | 'datasource';
    dataSourceId: string;
    schema?: string;
    tableName?: string;
  } | null>(null);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleTableContextMenu = (
    e: React.MouseEvent,
    dataSourceId: string,
    schema: string,
    tableName: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 200),
      y: Math.min(e.clientY, window.innerHeight - 200),
      type: 'table',
      dataSourceId,
      schema,
      tableName,
    });
  };

  const handleDataSourceContextMenu = (
    e: React.MouseEvent,
    dataSourceId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 200),
      y: Math.min(e.clientY, window.innerHeight - 200),
      type: 'datasource',
      dataSourceId,
    });
  };

  return (
    <div 
      className="h-full flex flex-col bg-[#1E1F22] select-none text-xs text-[#DFE1E5]"
      onClick={() => setContextMenu(null)}
    >
      {/* Database Explorer Toolbar */}
      <div className="h-7 bg-[#212225] border-b border-[#393B40] px-2 flex items-center justify-between text-[#868A91]">
        <span className="font-semibold text-[11px] text-[#A8ADBD] tracking-wide uppercase">Data Sources</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onAddNewDataSource}
            title="New Data Source..."
            className="p-1 hover:bg-[#35373B] hover:text-[#3574F0] rounded cursor-pointer transition-colors"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={() => {
              if (dataSources[0]) {
                onOpenSqlConsole(dataSources[0].id);
              }
            }}
            title="Open Query Console (Ctrl+Shift+F10)"
            className="p-1 hover:bg-[#35373B] hover:text-[#59A869] rounded cursor-pointer transition-colors"
          >
            <Terminal size={13} />
          </button>
          <button
            onClick={() => onShowToast?.('Database Refresh', 'Schemas and tables reloaded', 'success')}
            title="Refresh All Schemas (Ctrl+F5)"
            className="p-1 hover:bg-[#35373B] hover:text-white rounded cursor-pointer transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Explorer Tree */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1 font-mono text-[11.5px]">
        {dataSources.map(ds => {
          const isDsExpanded = expandedNodes.has(ds.id);
          return (
            <div key={ds.id} className="space-y-0.5">
              {/* Data Source Root Row */}
              <div
                onClick={() => toggleNode(ds.id)}
                onContextMenu={(e) => handleDataSourceContextMenu(e, ds.id)}
                className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-[#2B2D30] cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {isDsExpanded ? <ChevronDown size={12} className="text-[#868A91]" /> : <ChevronRight size={12} className="text-[#868A91]" />}
                  <Database 
                    size={13} 
                    className={
                      ds.engine === 'postgresql' ? 'text-[#3574F0]' :
                      ds.engine === 'mysql' ? 'text-[#E5B567]' :
                      ds.engine === 'duckdb' ? 'text-[#F1A23A]' : 'text-[#59A869]'
                    } 
                  />
                  <span className="font-sans font-semibold text-[#DFE1E5] truncate">{ds.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#59A869]" title="Connected" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSqlConsole(ds.id);
                    }}
                    title="Open SQL Console"
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#35373B] rounded text-[#868A91] hover:text-white"
                  >
                    <Terminal size={11} />
                  </button>
                </div>
              </div>

              {/* Schemas & Tables Tree */}
              {isDsExpanded && (
                <div className="pl-4 space-y-0.5 border-l border-[#393B40]/40 ml-2.5">
                  {ds.schemas.map(schema => {
                    const schemaKey = `${ds.id}/${schema.name}`;
                    const isSchemaExpanded = expandedNodes.has(schemaKey);
                    return (
                      <div key={schema.name} className="space-y-0.5">
                        {/* Schema Row */}
                        <div
                          onClick={() => toggleNode(schemaKey)}
                          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-[#2B2D30] cursor-pointer text-[#A8ADBD]"
                        >
                          {isSchemaExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          <Folder size={12} className="text-[#E5B567]" />
                          <span>{schema.name}</span>
                          <span className="text-[10px] text-[#868A91]">({schema.tables.length})</span>
                        </div>

                        {/* Tables */}
                        {isSchemaExpanded && (
                          <div className="pl-4 space-y-0.5 border-l border-[#393B40]/40 ml-2">
                            {schema.tables.map(table => {
                              const tableKey = `${schemaKey}/${table.name}`;
                              const isTableExpanded = expandedNodes.has(tableKey);
                              return (
                                <div key={table.name} className="space-y-0.5">
                                  {/* Table Row */}
                                  <div
                                    onDoubleClick={() => onOpenTableData(ds.id, schema.name, table.name)}
                                    onContextMenu={(e) => handleTableContextMenu(e, ds.id, schema.name, table.name)}
                                    onClick={() => toggleNode(tableKey)}
                                    className="flex items-center justify-between px-1.5 py-0.5 rounded hover:bg-[#2B2D30] cursor-pointer group text-[#DFE1E5]"
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      {isTableExpanded ? <ChevronDown size={10} className="text-[#868A91]" /> : <ChevronRight size={10} className="text-[#868A91]" />}
                                      <Table size={12} className="text-[#3574F0] flex-shrink-0" />
                                      <span className="truncate">{table.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] font-sans text-[#868A91] px-1 bg-[#2B2D30] rounded">
                                        {table.rowCount}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenTableData(ds.id, schema.name, table.name);
                                        }}
                                        title="Open Table Data (F4)"
                                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#3574F0]"
                                      >
                                        <ExternalLink size={10} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Columns Subtree */}
                                  {isTableExpanded && (
                                    <div className="pl-4 space-y-0.5 border-l border-[#393B40]/30 ml-2 text-[10.5px]">
                                      {table.columns.map(col => (
                                        <div 
                                          key={col.name}
                                          className="flex items-center justify-between px-1.5 py-0.5 text-[#868A91] hover:text-[#DFE1E5]"
                                        >
                                          <div className="flex items-center gap-1.5 truncate">
                                            {col.isPrimaryKey ? (
                                              <Key size={10} className="text-[#F1A23A] flex-shrink-0"  />
                                            ) : (
                                              <span className="w-2.5 inline-block" />
                                            )}
                                            <span className={col.isPrimaryKey ? 'text-[#DFE1E5] font-medium' : ''}>{col.name}</span>
                                          </div>
                                          <span className="text-[9.5px] font-mono text-[#4E5157]">{col.type}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Context Menu */}
      {contextMenu && (
        <div 
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 w-52 bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 text-xs text-[#DFE1E5] font-sans animate-in fade-in duration-75"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'table' && contextMenu.tableName && contextMenu.schema && (
            <>
              <div 
                onClick={() => {
                  onOpenTableData(contextMenu.dataSourceId, contextMenu.schema!, contextMenu.tableName!);
                  setContextMenu(null);
                }}
                className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <ExternalLink size={12} />
                  <span>Open Table Data</span>
                </div>
                <span className="text-[10px] text-[#868A91]">F4</span>
              </div>

              <div 
                onClick={() => {
                  onOpenSqlConsole(contextMenu.dataSourceId);
                  setContextMenu(null);
                }}
                className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Terminal size={12} />
                  <span>New SQL Console</span>
                </div>
                <span className="text-[10px] text-[#868A91]">Ctrl+Shift+F10</span>
              </div>

              <div className="border-t border-[#393B40] my-1" />

              <div 
                onClick={() => {
                  onShowToast?.('DDL Generated', `CREATE TABLE ${contextMenu.tableName} (...) copied to clipboard`, 'success');
                  setContextMenu(null);
                }}
                className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
              >
                <FileCode size={12} />
                <span>Generate DDL to Clipboard</span>
              </div>
            </>
          )}

          {contextMenu.type === 'datasource' && (
            <>
              <div 
                onClick={() => {
                  onOpenSqlConsole(contextMenu.dataSourceId);
                  setContextMenu(null);
                }}
                className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
              >
                <Terminal size={12} />
                <span>Open Query Console</span>
              </div>

              <div 
                onClick={() => {
                  onShowToast?.('Schema Refresh', 'Data Source refreshed', 'info');
                  setContextMenu(null);
                }}
                className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
              >
                <RefreshCw size={12} />
                <span>Refresh Schema</span>
              </div>

              {onRemoveDataSource && (
                <>
                  <div className="border-t border-[#393B40] my-1" />
                  <div 
                    onClick={() => {
                      onRemoveDataSource(contextMenu.dataSourceId);
                      setContextMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-[#E55353] hover:text-white cursor-pointer flex items-center gap-2 text-[#E55353]"
                  >
                    <Trash2 size={12} />
                    <span>Disconnect Data Source</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

