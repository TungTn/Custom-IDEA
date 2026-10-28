import React, { useState, useMemo } from 'react';
import { 
  X, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  HardDrive, 
  Server, 
  FileText,
  Search,
  Key,
  Layers,
  Cpu,
  ShieldCheck,
  Check,
  Globe,
  Settings2,
  Terminal,
  ExternalLink
} from 'lucide-react';
import { SupportedDbEngine, DataSourceConnection, DbSchema, DbTable } from '../../types/database';

interface AddDataSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (connection: DataSourceConnection) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export interface DbEngineMeta {
  id: SupportedDbEngine;
  name: string;
  category: 'relational' | 'nosql' | 'olap';
  defaultPort?: number;
  badge: string;
  badgeColor: string;
  description: string;
  defaultDbName: string;
  defaultUser: string;
  isFileSystem?: boolean;
}

export const DB_ENGINES: DbEngineMeta[] = [
  // Relational Databases
  { id: 'postgresql', name: 'PostgreSQL', category: 'relational', defaultPort: 5432, badge: 'PG', badgeColor: '#3574F0', description: 'Advanced open-source relational database with JSONB and extensions', defaultDbName: 'postgres', defaultUser: 'postgres' },
  { id: 'mysql', name: 'MySQL', category: 'relational', defaultPort: 3306, badge: 'MY', badgeColor: '#E5B567', description: 'World\'s most popular open-source transactional database', defaultDbName: 'app_db', defaultUser: 'root' },
  { id: 'mariadb', name: 'MariaDB', category: 'relational', defaultPort: 3306, badge: 'MA', badgeColor: '#003545', description: 'Drop-in enterprise replacement for MySQL with Galera cluster', defaultDbName: 'production', defaultUser: 'root' },
  { id: 'oracle', name: 'Oracle Database', category: 'relational', defaultPort: 1521, badge: 'ORA', badgeColor: '#F80000', description: 'Mission-critical enterprise RDBMS with PL/SQL and multi-tenant', defaultDbName: 'ORCL', defaultUser: 'system' },
  { id: 'sqlserver', name: 'Microsoft SQL Server', category: 'relational', defaultPort: 1433, badge: 'MS', badgeColor: '#0078D4', description: 'Microsoft enterprise database engine with T-SQL and SSMS support', defaultDbName: 'master', defaultUser: 'sa' },
  { id: 'sqlite', name: 'SQLite', category: 'relational', isFileSystem: true, badge: 'SL', badgeColor: '#30A5D6', description: 'Self-contained, serverless, zero-configuration SQL database engine', defaultDbName: 'main', defaultUser: '' },
  { id: 'h2', name: 'H2 Database', category: 'relational', defaultPort: 9092, isFileSystem: true, badge: 'H2', badgeColor: '#43853D', description: 'Fast Java embedded and in-memory SQL database for Spring Boot testing', defaultDbName: 'testdb', defaultUser: 'sa' },

  // NoSQL & In-Memory
  { id: 'redis', name: 'Redis', category: 'nosql', defaultPort: 6379, badge: 'RD', badgeColor: '#DC382D', description: 'In-memory data structure store used as a cache, broker and streaming engine', defaultDbName: '0', defaultUser: 'default' },
  { id: 'mongodb', name: 'MongoDB', category: 'nosql', defaultPort: 27017, badge: 'MG', badgeColor: '#13AA52', description: 'Document-oriented database with flexible BSON schema and aggregation pipeline', defaultDbName: 'admin', defaultUser: 'mongo' },
  { id: 'cassandra', name: 'Apache Cassandra', category: 'nosql', defaultPort: 9042, badge: 'CA', badgeColor: '#1287B1', description: 'High-performance decentralized NoSQL for massive linear scalability', defaultDbName: 'system', defaultUser: 'cassandra' },

  // Analytical & OLAP & Cloud
  { id: 'clickhouse', name: 'ClickHouse', category: 'olap', defaultPort: 8123, badge: 'CH', badgeColor: '#FFAE00', description: 'Ultra-fast column-oriented DBMS for real-time analytical reporting', defaultDbName: 'default', defaultUser: 'default' },
  { id: 'duckdb', name: 'DuckDB', category: 'olap', isFileSystem: true, badge: 'DK', badgeColor: '#FFF000', description: 'In-process SQL OLAP database management system for analytics and Parquet', defaultDbName: 'main', defaultUser: '' },
  { id: 'snowflake', name: 'Snowflake', category: 'olap', defaultPort: 443, badge: 'SF', badgeColor: '#29B5E8', description: 'Cloud data warehouse and analytical compute platform', defaultDbName: 'SNOWFLAKE_SAMPLE_DATA', defaultUser: 'SNOW_USER' },
];

export const AddDataSourceModal: React.FC<AddDataSourceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onShowToast,
}) => {
  const [selectedEngine, setSelectedEngine] = useState<SupportedDbEngine>('postgresql');
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'relational' | 'nosql' | 'olap'>('all');

  // Form Fields
  const [name, setName] = useState('localhost_postgres');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState<number>(5432);
  const [databaseName, setDatabaseName] = useState('postgres');
  const [filePath, setFilePath] = useState('D:\\IDE\\data\\database.sqlite');
  const [user, setUser] = useState('postgres');
  const [password, setPassword] = useState('');
  const [useSsl, setUseSsl] = useState(false);
  const [oracleSidType, setOracleSidType] = useState<'sid' | 'service'>('sid');
  const [redisDbIndex, setRedisDbIndex] = useState(0);

  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);

  const activeMeta = DB_ENGINES.find(e => e.id === selectedEngine) || DB_ENGINES[0];

  const handleSelectEngine = (engine: DbEngineMeta) => {
    setSelectedEngine(engine.id);
    setTestStatus(null);
    setName(`${engine.id}_local`);
    setDatabaseName(engine.defaultDbName);
    setUser(engine.defaultUser);
    if (engine.defaultPort) {
      setPort(engine.defaultPort);
    }
    if (engine.isFileSystem) {
      if (engine.id === 'sqlite') {
        setFilePath('D:\\IDE\\data\\local.sqlite');
      } else if (engine.id === 'duckdb') {
        setFilePath('D:\\IDE\\data\\analytics.duckdb');
      } else if (engine.id === 'h2') {
        setFilePath('D:\\IDE\\data\\embedded.mv.db');
      }
    }
  };

  const filteredEngines = useMemo(() => {
    return DB_ENGINES.filter(e => {
      const matchCat = categoryFilter === 'all' || e.category === categoryFilter;
      const matchText = searchFilter.trim() === '' || 
        e.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        e.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
        e.badge.toLowerCase().includes(searchFilter.toLowerCase());
      return matchCat && matchText;
    });
  }, [categoryFilter, searchFilter]);

  const handleTestConnection = () => {
    setIsTesting(true);
    setTestStatus(null);

    const latency = Math.floor(Math.random() * 25) + 8;
    setTimeout(() => {
      setIsTesting(false);
      let msg = '';
      if (activeMeta.isFileSystem) {
        msg = `Connected to file: ${filePath} (Driver verified in ${latency}ms)`;
      } else if (selectedEngine === 'redis') {
        msg = `PONG received from ${host}:${port} [db: ${redisDbIndex}] (${latency}ms)`;
      } else if (selectedEngine === 'mongodb') {
        msg = `Connected to MongoDB 7.0 replicaSet at ${host}:${port}/${databaseName} (${latency}ms)`;
      } else if (selectedEngine === 'oracle') {
        msg = `Connected to Oracle Database 21c Express (${oracleSidType.toUpperCase()}: ${databaseName}) (${latency}ms)`;
      } else if (selectedEngine === 'sqlserver') {
        msg = `Connected to Microsoft SQL Server 2022 at ${host}:${port} [db: ${databaseName}] (${latency}ms)`;
      } else {
        msg = `Connected to ${activeMeta.name} server at ${host}:${port}/${databaseName} (${latency}ms)`;
      }

      setTestStatus({
        success: true,
        message: msg,
        latencyMs: latency,
      });
      onShowToast?.('Database Connection', msg, 'success');
    }, 500);
  };

  // Generate realistic default schemas and tables for each engine
  const generateEngineSchemas = (): DbSchema[] => {
    switch (selectedEngine) {
      case 'redis':
        return [
          {
            name: `db${redisDbIndex}`,
            tables: [
              {
                name: 'session:user:1001 (hash)',
                schema: `db${redisDbIndex}`,
                rowCount: 5,
                columns: [
                  { name: 'field', type: 'VARCHAR(64)', isPrimaryKey: true },
                  { name: 'value', type: 'TEXT' },
                ],
                data: [
                  { field: 'username', value: 'admin' },
                  { field: 'role', value: 'superadmin' },
                  { field: 'token', value: 'jwt_ey748a1c...' },
                  { field: 'last_login', value: '2026-10-26 17:30:00' },
                  { field: 'ip', value: '127.0.0.1' },
                ]
              },
              {
                name: 'cache:product:featured (json)',
                schema: `db${redisDbIndex}`,
                rowCount: 3,
                columns: [
                  { name: 'key', type: 'STRING', isPrimaryKey: true },
                  { name: 'ttl', type: 'INTEGER' },
                  { name: 'value', type: 'JSON' },
                ],
                data: [
                  { key: 'featured:1', ttl: 3600, value: '{"id": 1, "name": "Laptop Pro", "price": 1299}' },
                  { key: 'featured:2', ttl: 3600, value: '{"id": 2, "name": "4K Monitor", "price": 499}' },
                  { key: 'featured:3', ttl: 1800, value: '{"id": 3, "name": "Mechanical Keyboard", "price": 149}' },
                ]
              }
            ]
          }
        ];

      case 'mongodb':
        return [
          {
            name: databaseName || 'app_db',
            tables: [
              {
                name: 'users (collection)',
                schema: databaseName || 'app_db',
                rowCount: 4,
                columns: [
                  { name: '_id', type: 'ObjectId', isPrimaryKey: true },
                  { name: 'email', type: 'String' },
                  { name: 'status', type: 'String' },
                  { name: 'createdAt', type: 'ISODate' },
                ],
                data: [
                  { _id: '652a1b2c3d4e5f', email: 'admin@local.dev', status: 'active', createdAt: '2026-10-26T10:00:00Z' },
                  { _id: '652a1b2c3d4e60', email: 'dev@local.dev', status: 'active', createdAt: '2026-10-26T10:05:00Z' },
                  { _id: '652a1b2c3d4e61', email: 'tester@local.dev', status: 'pending', createdAt: '2026-10-26T10:10:00Z' },
                  { _id: '652a1b2c3d4e62', email: 'guest@local.dev', status: 'inactive', createdAt: '2026-10-26T10:15:00Z' },
                ]
              },
              {
                name: 'orders (collection)',
                schema: databaseName || 'app_db',
                rowCount: 2,
                columns: [
                  { name: '_id', type: 'ObjectId', isPrimaryKey: true },
                  { name: 'orderNumber', type: 'String' },
                  { name: 'totalAmount', type: 'Double' },
                  { name: 'items', type: 'Array' },
                ],
                data: [
                  { _id: '652a1b2c3d4e70', orderNumber: 'ORD-2026-001', totalAmount: 1899.99, items: '[{"sku": "SKU-99", "qty": 1}]' },
                  { _id: '652a1b2c3d4e71', orderNumber: 'ORD-2026-002', totalAmount: 49.50, items: '[{"sku": "SKU-12", "qty": 2}]' },
                ]
              }
            ]
          }
        ];

      case 'oracle':
        return [
          {
            name: 'HR',
            tables: [
              {
                name: 'EMPLOYEES',
                schema: 'HR',
                rowCount: 4,
                columns: [
                  { name: 'EMPLOYEE_ID', type: 'NUMBER(6)', isPrimaryKey: true },
                  { name: 'FIRST_NAME', type: 'VARCHAR2(20)' },
                  { name: 'LAST_NAME', type: 'VARCHAR2(25)' },
                  { name: 'SALARY', type: 'NUMBER(8,2)' },
                  { name: 'HIRE_DATE', type: 'DATE' },
                ],
                data: [
                  { EMPLOYEE_ID: 100, FIRST_NAME: 'Steven', LAST_NAME: 'King', SALARY: 24000, HIRE_DATE: '2018-06-17' },
                  { EMPLOYEE_ID: 101, FIRST_NAME: 'Neena', LAST_NAME: 'Kochhar', SALARY: 17000, HIRE_DATE: '2019-09-21' },
                  { EMPLOYEE_ID: 102, FIRST_NAME: 'Lex', LAST_NAME: 'De Haan', SALARY: 17000, HIRE_DATE: '2020-01-13' },
                  { EMPLOYEE_ID: 103, FIRST_NAME: 'Alexander', LAST_NAME: 'Hunold', SALARY: 9000, HIRE_DATE: '2021-01-03' },
                ]
              },
              {
                name: 'DEPARTMENTS',
                schema: 'HR',
                rowCount: 3,
                columns: [
                  { name: 'DEPARTMENT_ID', type: 'NUMBER(4)', isPrimaryKey: true },
                  { name: 'DEPARTMENT_NAME', type: 'VARCHAR2(30)' },
                  { name: 'MANAGER_ID', type: 'NUMBER(6)' },
                ],
                data: [
                  { DEPARTMENT_ID: 10, DEPARTMENT_NAME: 'Administration', MANAGER_ID: 200 },
                  { DEPARTMENT_ID: 20, DEPARTMENT_NAME: 'Marketing', MANAGER_ID: 201 },
                  { DEPARTMENT_ID: 30, DEPARTMENT_NAME: 'Purchasing', MANAGER_ID: 114 },
                ]
              }
            ]
          }
        ];

      case 'sqlserver':
        return [
          {
            name: 'dbo',
            tables: [
              {
                name: 'Customers',
                schema: 'dbo',
                rowCount: 3,
                columns: [
                  { name: 'CustomerID', type: 'INT', isPrimaryKey: true },
                  { name: 'CompanyName', type: 'NVARCHAR(100)' },
                  { name: 'ContactName', type: 'NVARCHAR(100)' },
                  { name: 'Country', type: 'NVARCHAR(50)' },
                ],
                data: [
                  { CustomerID: 1, CompanyName: 'Alfreds Futterkiste', ContactName: 'Maria Anders', Country: 'Germany' },
                  { CustomerID: 2, CompanyName: 'Ana Trujillo Emparedados', ContactName: 'Ana Trujillo', Country: 'Mexico' },
                  { CustomerID: 3, CompanyName: 'Antonio Moreno Taquería', ContactName: 'Antonio Moreno', Country: 'Mexico' },
                ]
              },
              {
                name: 'Orders',
                schema: 'dbo',
                rowCount: 3,
                columns: [
                  { name: 'OrderID', type: 'INT', isPrimaryKey: true },
                  { name: 'CustomerID', type: 'INT' },
                  { name: 'OrderDate', type: 'DATETIME2' },
                  { name: 'Freight', type: 'MONEY' },
                ],
                data: [
                  { OrderID: 10248, CustomerID: 1, OrderDate: '2026-07-04', Freight: 32.38 },
                  { OrderID: 10249, CustomerID: 2, OrderDate: '2026-07-05', Freight: 11.61 },
                  { OrderID: 10250, CustomerID: 3, OrderDate: '2026-07-08', Freight: 65.83 },
                ]
              }
            ]
          }
        ];

      case 'clickhouse':
        return [
          {
            name: 'default',
            tables: [
              {
                name: 'events_log',
                schema: 'default',
                rowCount: 1450200,
                columns: [
                  { name: 'timestamp', type: 'DateTime', isPrimaryKey: true },
                  { name: 'event_type', type: 'LowCardinality(String)' },
                  { name: 'user_id', type: 'UInt64' },
                  { name: 'payload', type: 'String' },
                ],
                data: [
                  { timestamp: '2026-10-26 17:00:01', event_type: 'page_view', user_id: 88472, payload: '{"path": "/products"}' },
                  { timestamp: '2026-10-26 17:00:02', event_type: 'click', user_id: 88472, payload: '{"btn": "checkout"}' },
                  { timestamp: '2026-10-26 17:00:03', event_type: 'api_call', user_id: 19482, payload: '{"method": "GET"}' },
                ]
              }
            ]
          }
        ];

      default:
        // Standard relational default (PostgreSQL, MySQL, MariaDB, SQLite, DuckDB, H2, Snowflake)
        return [
          {
            name: selectedEngine === 'postgresql' ? 'public' : selectedEngine === 'sqlite' || selectedEngine === 'duckdb' ? 'main' : 'app_db',
            tables: [
              {
                name: 'users',
                schema: selectedEngine === 'postgresql' ? 'public' : selectedEngine === 'sqlite' || selectedEngine === 'duckdb' ? 'main' : 'app_db',
                rowCount: 4,
                columns: [
                  { name: 'id', type: 'BIGINT', isPrimaryKey: true },
                  { name: 'username', type: 'VARCHAR(100)' },
                  { name: 'email', type: 'VARCHAR(255)' },
                  { name: 'created_at', type: 'TIMESTAMP' },
                ],
                data: [
                  { id: 1, username: 'admin', email: 'admin@example.com', created_at: '2026-10-26 10:00:00' },
                  { id: 2, username: 'developer', email: 'dev@example.com', created_at: '2026-10-26 10:05:00' },
                  { id: 3, username: 'tester', email: 'qa@example.com', created_at: '2026-10-26 10:10:00' },
                  { id: 4, username: 'guest_user', email: 'guest@example.com', created_at: '2026-10-26 10:15:00' },
                ]
              },
              {
                name: 'projects',
                schema: selectedEngine === 'postgresql' ? 'public' : selectedEngine === 'sqlite' || selectedEngine === 'duckdb' ? 'main' : 'app_db',
                rowCount: 3,
                columns: [
                  { name: 'project_id', type: 'VARCHAR(64)', isPrimaryKey: true },
                  { name: 'name', type: 'VARCHAR(200)' },
                  { name: 'status', type: 'VARCHAR(50)' },
                ],
                data: [
                  { project_id: 'PRJ-01', name: 'Microservice Gateway', status: 'ACTIVE' },
                  { project_id: 'PRJ-02', name: 'Billing Service', status: 'ACTIVE' },
                  { project_id: 'PRJ-03', name: 'Notification Center', status: 'PENDING' },
                ]
              }
            ]
          }
        ];
    }
  };

  const handleSave = () => {
    const newConnection: DataSourceConnection = {
      id: `ds-${selectedEngine}-${Date.now()}`,
      name: name.trim() || `${selectedEngine}_db`,
      engine: selectedEngine,
      host: !activeMeta.isFileSystem ? host : undefined,
      port: !activeMeta.isFileSystem ? port : undefined,
      databaseName: databaseName.trim() || activeMeta.defaultDbName,
      filePath: activeMeta.isFileSystem ? filePath : undefined,
      user: !activeMeta.isFileSystem ? user : undefined,
      isConnected: true,
      schemas: generateEngineSchemas(),
    };

    onSave(newConnection);
    onShowToast?.('Data Source Added', `Connected to ${newConnection.name} (${activeMeta.name})`, 'success');
    onClose();
  };

  // Preview Connection URL
  const connectionUrlPreview = useMemo(() => {
    if (activeMeta.isFileSystem) {
      return `${selectedEngine}://${filePath}`;
    }
    if (selectedEngine === 'redis') {
      return `redis://${user ? user + ':' : ''}••••••@${host}:${port}/${redisDbIndex}`;
    }
    if (selectedEngine === 'mongodb') {
      return `mongodb://${user}:••••••@${host}:${port}/${databaseName}?authSource=admin`;
    }
    if (selectedEngine === 'oracle') {
      return `jdbc:oracle:thin:@${host}:${port}${oracleSidType === 'sid' ? ':' : '/'}${databaseName}`;
    }
    if (selectedEngine === 'sqlserver') {
      return `jdbc:sqlserver://${host}:${port};databaseName=${databaseName};encrypt=${useSsl}`;
    }
    return `jdbc:${selectedEngine}://${host}:${port}/${databaseName}`;
  }, [selectedEngine, activeMeta, filePath, user, host, port, redisDbIndex, databaseName, oracleSidType, useSsl]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-[2px] animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[820px] h-[580px] bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl overflow-hidden font-sans text-xs text-[#DFE1E5] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Title Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#212225] border-b border-[#393B40] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Database size={15} className="text-[#3574F0]" />
            <span className="font-semibold text-sm text-white">Data Sources and Drivers (DataGrip)</span>
            <span className="text-[11px] text-[#868A91]">({DB_ENGINES.length} database engines supported)</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Main Split: Left DB Engine List & Right Form */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Engine Selector & Filters */}
          <div className="w-[260px] bg-[#1E1F22] border-r border-[#393B40] flex flex-col">
            {/* Search */}
            <div className="p-2 border-b border-[#2B2D30]">
              <div className="relative flex items-center">
                <Search size={12} className="absolute left-2.5 text-[#868A91] pointer-events-none" />
                <input 
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search databases..."
                  className="w-full bg-[#2B2D30] text-[#DFE1E5] text-[11px] rounded pl-7 pr-6 py-1 border border-transparent focus:border-[#3574F0] focus:outline-none placeholder-[#6E7278]"
                />
                {searchFilter && (
                  <button 
                    onClick={() => setSearchFilter('')}
                    className="absolute right-1.5 text-[#868A91] hover:text-[#DFE1E5]"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex p-1.5 gap-1 border-b border-[#2B2D30] text-[10px] overflow-x-auto">
              {[
                { id: 'all', label: 'All' },
                { id: 'relational', label: 'SQL' },
                { id: 'nosql', label: 'NoSQL' },
                { id: 'olap', label: 'Analytics' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id as any)}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    categoryFilter === cat.id
                      ? 'bg-[#3574F0] text-white font-medium'
                      : 'text-[#868A91] hover:bg-[#2B2D30] hover:text-[#DFE1E5]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Engine List */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {filteredEngines.map((engine) => {
                const isSelected = selectedEngine === engine.id;
                return (
                  <div
                    key={engine.id}
                    onClick={() => handleSelectEngine(engine)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-[#2B2D30] text-white border-l-2 border-[#3574F0]' 
                        : 'text-[#DFE1E5] hover:bg-[#25272B]'
                    }`}
                  >
                    {/* Badge */}
                    <span 
                      style={{ backgroundColor: engine.badgeColor }}
                      className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 shadow-sm"
                    >
                      {engine.badge}
                    </span>
                    
                    <div className="flex-1 truncate">
                      <div className="font-medium text-[11.5px] truncate">{engine.name}</div>
                      <div className="text-[9.5px] text-[#868A91] truncate">{engine.isFileSystem ? 'File DB' : `Port ${engine.defaultPort}`}</div>
                    </div>

                    {isSelected && <Check size={12} className="text-[#3574F0] flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Area: Connection Settings Form */}
          <div className="flex-1 flex flex-col bg-[#2B2D30] overflow-y-auto">
            {/* Header info */}
            <div className="p-3.5 border-b border-[#393B40] bg-[#25272B] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span 
                  style={{ backgroundColor: activeMeta.badgeColor }}
                  className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold text-white shadow"
                >
                  {activeMeta.badge}
                </span>
                <div>
                  <div className="font-semibold text-sm text-white flex items-center gap-2">
                    <span>{activeMeta.name}</span>
                    <span className="text-[10px] font-normal text-[#59A869] px-1.5 py-0.2 rounded bg-[#59A869]/15 flex items-center gap-1">
                      <ShieldCheck size={11} />
                      <span>Driver: Ready</span>
                    </span>
                  </div>
                  <div className="text-[10.5px] text-[#868A91]">{activeMeta.description}</div>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {/* Name */}
              <div>
                <label className="block text-[11px] font-medium text-[#868A91] mb-1">Data Source Name</label>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-xs text-[#DFE1E5] outline-none font-mono"
                />
              </div>

              {/* File-based engines: SQLite, DuckDB, H2 */}
              {activeMeta.isFileSystem ? (
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
                      onClick={() => onShowToast?.('Browse Database File', 'Selected default project database path', 'info')}
                      className="px-3 py-1.5 bg-[#35373B] hover:bg-[#4E5157] text-white rounded text-xs transition-colors cursor-pointer"
                    >
                      Browse...
                    </button>
                  </div>
                </div>
              ) : (
                /* Network databases */
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-3">
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

                  {/* Engine Specific: Oracle SID or Service, Redis DB index, Mongo Auth */}
                  {selectedEngine === 'oracle' ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-[#868A91] mb-1">Connection Type</label>
                        <select 
                          value={oracleSidType}
                          onChange={(e) => setOracleSidType(e.target.value as any)}
                          className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2 py-1.5 text-xs text-[#DFE1E5] outline-none"
                        >
                          <option value="sid">SID</option>
                          <option value="service">Service Name</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-[#868A91] mb-1">
                          {oracleSidType === 'sid' ? 'SID (e.g. ORCL, XE)' : 'Service Name (e.g. orcl.local)'}
                        </label>
                        <input 
                          type="text"
                          value={databaseName}
                          onChange={(e) => setDatabaseName(e.target.value)}
                          className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-xs text-[#DFE1E5] outline-none font-mono"
                        />
                      </div>
                    </div>
                  ) : selectedEngine === 'redis' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-[#868A91] mb-1">Database Index (0 - 15)</label>
                        <input 
                          type="number"
                          min={0}
                          max={15}
                          value={redisDbIndex}
                          onChange={(e) => setRedisDbIndex(Number(e.target.value))}
                          className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-xs text-[#DFE1E5] outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#868A91] mb-1">Auth Username (optional)</label>
                        <input 
                          type="text"
                          value={user}
                          onChange={(e) => setUser(e.target.value)}
                          placeholder="default"
                          className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-xs text-[#DFE1E5] outline-none font-mono"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-medium text-[#868A91] mb-1">
                        {selectedEngine === 'cassandra' ? 'Keyspace' : selectedEngine === 'snowflake' ? 'Warehouse / Database' : 'Database Name'}
                      </label>
                      <input 
                        type="text"
                        value={databaseName}
                        onChange={(e) => setDatabaseName(e.target.value)}
                        className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-xs text-[#DFE1E5] outline-none font-mono"
                      />
                    </div>
                  )}

                  {/* User & Password */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-[#868A91] mb-1">User / Account</label>
                      <input 
                        type="text"
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-xs text-[#DFE1E5] outline-none font-mono"
                      />
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
                  </div>
                </>
              )}

              {/* Live Connection URL Preview */}
              <div className="p-2 bg-[#1E1F22] rounded border border-[#393B40] font-mono text-[10px] text-[#868A91] flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <Terminal size={11} className="text-[#3574F0] flex-shrink-0" />
                  <span className="truncate">{connectionUrlPreview}</span>
                </div>
                <span className="text-[9.5px] text-[#59A869] uppercase font-bold flex-shrink-0">URL</span>
              </div>

              {/* Test Status Banner */}
              {testStatus && (
                <div className={`p-2.5 rounded flex items-center gap-2 text-xs border ${
                  testStatus.success 
                    ? 'bg-[#1E2E20] border-[#59A869]/50 text-[#78D389]' 
                    : 'bg-[#332020] border-[#E55353]/50 text-[#FF8585]'
                }`}>
                  {testStatus.success ? <CheckCircle2 size={14} className="flex-shrink-0 text-[#59A869]" /> : <AlertCircle size={14} className="flex-shrink-0 text-[#E55353]" />}
                  <span className="font-mono text-[11px]">{testStatus.message}</span>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#212225] border-t border-[#393B40] flex-shrink-0">
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
      </div>
    </div>
  );
};
