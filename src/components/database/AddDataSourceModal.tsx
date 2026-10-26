import React, { useState } from 'react';
import { X, Database, CheckCircle2, AlertCircle, Loader2, HardDrive, Server, FileText } from 'lucide-react';
import { SupportedDbEngine, DataSourceConnection } from '../../types/database';

interface AddDataSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (connection: DataSourceConnection) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const AddDataSourceModal: React.FC<AddDataSourceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onShowToast,
}) => {
  const [engine, setEngine] = useState<SupportedDbEngine>('sqlite');
  const [name, setName] = useState('new_database');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState<number>(5432);
  const [databaseName, setDatabaseName] = useState('main');
  const [filePath, setFilePath] = useState('D:\\IDE\\data\\database.sqlite');
  const [user, setUser] = useState('postgres');
  const [password, setPassword] = useState('');
  
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleEngineChange = (newEngine: SupportedDbEngine) => {
    setEngine(newEngine);
    setTestStatus(null);
    if (newEngine === 'sqlite') {
      setName('sqlite_local');
      setFilePath('D:\\IDE\\data\\local.sqlite');
      setDatabaseName('main');
    } else if (newEngine === 'postgresql') {
      setName('postgres_local');
      setHost('localhost');
      setPort(5432);
      setDatabaseName('postgres');
      setUser('postgres');
    } else if (newEngine === 'mysql') {
      setName('mysql_local');
      setHost('localhost');
      setPort(3306);
      setDatabaseName('app_db');
      setUser('root');
    } else if (newEngine === 'duckdb') {
      setName('duckdb_analytics');
      setFilePath('D:\\IDE\\data\\analytics.duckdb');
      setDatabaseName('main');
    }
  };

  const handleTestConnection = () => {
    setIsTesting(true);
    setTestStatus(null);

    setTimeout(() => {
      setIsTesting(false);
      setTestStatus({
        success: true,
        message: engine === 'sqlite' || engine === 'duckdb'
          ? `Connected to local file: ${databaseName} (Driver ready)`
          : `Connected to ${host}:${port}/${databaseName} (v16.2 protocol)`
      });
      onShowToast?.('Database Connection', 'Connection test succeeded', 'success');
    }, 600);
  };

  const handleSave = () => {
    const newConnection: DataSourceConnection = {
      id: `ds-${engine}-${Date.now()}`,
      name: name.trim() || `${engine}_db`,
      engine,
      host: engine === 'postgresql' || engine === 'mysql' ? host : undefined,
      port: engine === 'postgresql' || engine === 'mysql' ? port : undefined,
      databaseName: databaseName.trim() || 'main',
      filePath: engine === 'sqlite' || engine === 'duckdb' ? filePath : undefined,
      user: engine === 'postgresql' || engine === 'mysql' ? user : undefined,
      isConnected: true,
      schemas: [
        {
          name: engine === 'postgresql' ? 'public' : 'main',
          tables: [
            {
              name: 'example_table',
              schema: engine === 'postgresql' ? 'public' : 'main',
              rowCount: 3,
              columns: [
                { name: 'id', type: 'INTEGER', isPrimaryKey: true, isNullable: false },
                { name: 'title', type: 'VARCHAR(255)', isNullable: false },
                { name: 'created_at', type: 'DATETIME', isNullable: false },
              ],
              data: [
                { id: 1, title: 'Sample row 1', created_at: '2026-10-26 10:00:00' },
                { id: 2, title: 'Sample row 2', created_at: '2026-10-26 10:05:00' },
                { id: 3, title: 'Sample row 3', created_at: '2026-10-26 10:10:00' },
              ]
            }
          ]
        }
      ]
    };

    onSave(newConnection);
    onShowToast?.('Data Source Added', `Connected to ${newConnection.name}`, 'success');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[520px] bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl overflow-hidden font-sans text-xs text-[#DFE1E5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#212225] border-b border-[#393B40]">
          <div className="flex items-center gap-2">
            <Database size={15} className="text-[#3574F0]" />
            <span className="font-semibold text-sm text-white">New Data Source (DataGrip)</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Engine Tabs */}
        <div className="flex border-b border-[#393B40] bg-[#1E1F22] px-3 pt-2 gap-1">
          {[
            { id: 'sqlite', label: 'SQLite', icon: HardDrive },
            { id: 'postgresql', label: 'PostgreSQL', icon: Server },
            { id: 'mysql', label: 'MySQL', icon: Database },
            { id: 'duckdb', label: 'DuckDB', icon: FileText },
          ].map((item) => {
            const isActive = engine === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleEngineChange(item.id as SupportedDbEngine)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t border-t border-x transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#2B2D30] border-[#393B40] text-[#3574F0] font-medium border-b-0'
                    : 'bg-transparent border-transparent text-[#868A91] hover:text-[#DFE1E5]'
                }`}
              >
                <Icon size={13} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Form */}
        <div className="p-4 space-y-3">
          {/* Connection Name */}
          <div>
            <label className="block text-[11px] font-medium text-[#868A91] mb-1">Data Source Name</label>
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-xs text-[#DFE1E5] outline-none font-mono"
            />
          </div>

          {/* SQLite & DuckDB File Path */}
          {(engine === 'sqlite' || engine === 'duckdb') && (
            <div>
              <label className="block text-[11px] font-medium text-[#868A91] mb-1">Database File Path</label>
              <div className="flex items-center gap-2">
                <input 
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  className="flex-1 bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-xs text-[#DFE1E5] outline-none font-mono"
                />
                <button 
                  onClick={() => onShowToast?.('Browse File', 'Selected default project data directory', 'info')}
                  className="px-2.5 py-1.5 bg-[#35373B] hover:bg-[#4E5157] text-white rounded text-xs transition-colors cursor-pointer"
                >
                  Browse...
                </button>
              </div>
            </div>
          )}

          {/* PostgreSQL & MySQL Host, Port, Database, User, Password */}
          {(engine === 'postgresql' || engine === 'mysql') && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-[#868A91] mb-1">Host</label>
                  <input 
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-xs text-[#DFE1E5] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#868A91] mb-1">Port</label>
                  <input 
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-xs text-[#DFE1E5] outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#868A91] mb-1">Database Name</label>
                  <input 
                    type="text"
                    value={databaseName}
                    onChange={(e) => setDatabaseName(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-xs text-[#DFE1E5] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#868A91] mb-1">User</label>
                  <input 
                    type="text"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-xs text-[#DFE1E5] outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#868A91] mb-1">Password</label>
                <input 
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-xs text-[#DFE1E5] outline-none font-mono"
                />
              </div>
            </>
          )}

          {/* Test Status Feedback */}
          {testStatus && (
            <div className={`p-2 rounded flex items-center gap-2 text-xs border ${
              testStatus.success 
                ? 'bg-[#1E2E20] border-[#59A869]/50 text-[#78D389]' 
                : 'bg-[#332020] border-[#E55353]/50 text-[#FF8585]'
            }`}>
              {testStatus.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span>{testStatus.message}</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#212225] border-t border-[#393B40]">
          <button 
            type="button"
            disabled={isTesting}
            onClick={handleTestConnection}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#35373B] hover:bg-[#4E5157] disabled:opacity-50 text-white rounded text-xs font-medium transition-colors cursor-pointer"
          >
            {isTesting && <Loader2 size={12} className="animate-spin" />}
            <span>Test Connection</span>
          </button>

          <div className="flex items-center gap-2">
            <button 
              onClick={onClose}
              className="px-3 py-1.5 rounded hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#3064D0] text-white rounded text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Save & Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
