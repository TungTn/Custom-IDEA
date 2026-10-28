export type SupportedDbEngine = 
  | 'postgresql' 
  | 'mysql' 
  | 'mariadb'
  | 'oracle'
  | 'sqlserver' 
  | 'sqlite' 
  | 'redis' 
  | 'mongodb' 
  | 'clickhouse' 
  | 'duckdb' 
  | 'h2' 
  | 'cassandra' 
  | 'snowflake';

export interface DbColumn {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isNullable?: boolean;
  defaultValue?: string;
  comment?: string;
}

export interface DbIndex {
  name: string;
  columns: string[];
  isUnique?: boolean;
}

export interface DbTable {
  name: string;
  schema: string;
  rowCount: number;
  columns: DbColumn[];
  indexes?: DbIndex[];
  data: Record<string, any>[];
}

export interface DbSchema {
  name: string;
  tables: DbTable[];
}

export interface DataSourceConnection {
  id: string;
  name: string;
  engine: SupportedDbEngine;
  host?: string;
  port?: number;
  databaseName: string;
  filePath?: string;
  user?: string;
  isConnected: boolean;
  schemas: DbSchema[];
}

export interface DbQueryResult {
  columns: string[];
  rows: Record<string, any>[];
  executionTimeMs: number;
  affectedRows?: number;
  error?: string;
}

export const INITIAL_DATA_SOURCES: DataSourceConnection[] = [
  {
    id: 'ds-sqlite-app',
    name: 'app_database.sqlite',
    engine: 'sqlite',
    filePath: 'D:\\IDE\\data\\app_database.sqlite',
    databaseName: 'main',
    isConnected: true,
    schemas: [
      {
        name: 'main',
        tables: [
          {
            name: 'projects',
            schema: 'main',
            rowCount: 4,
            columns: [
              { name: 'id', type: 'INTEGER', isPrimaryKey: true, isNullable: false },
              { name: 'name', type: 'VARCHAR(255)', isNullable: false },
              { name: 'path', type: 'VARCHAR(500)', isNullable: false },
              { name: 'framework', type: 'VARCHAR(50)', isNullable: true },
              { name: 'last_opened', type: 'DATETIME', isNullable: false },
              { name: 'is_pinned', type: 'BOOLEAN', defaultValue: '0', isNullable: false },
            ],
            indexes: [
              { name: 'idx_projects_name', columns: ['name'], isUnique: false },
            ],
            data: [
              { id: 1, name: 'intellij-idea-clone', path: 'D:\\IDE', framework: 'Tauri + React', last_opened: '2026-10-26 10:15:00', is_pinned: 1 },
              { id: 2, name: 'api-gateway', path: 'D:\\Work\\api-gateway', framework: 'Rust / Actix-web', last_opened: '2026-10-24 16:40:12', is_pinned: 1 },
              { id: 3, name: 'admin-dashboard', path: 'D:\\Web\\admin-dashboard', framework: 'Next.js 15', last_opened: '2026-10-22 09:30:00', is_pinned: 0 },
              { id: 4, name: 'mobile-client', path: 'D:\\Mobile\\flutter-client', framework: 'Flutter', last_opened: '2026-10-18 14:22:15', is_pinned: 0 },
            ]
          },
          {
            name: 'users',
            schema: 'main',
            rowCount: 5,
            columns: [
              { name: 'id', type: 'INTEGER', isPrimaryKey: true, isNullable: false },
              { name: 'username', type: 'VARCHAR(64)', isNullable: false },
              { name: 'email', type: 'VARCHAR(128)', isNullable: false },
              { name: 'role', type: 'VARCHAR(32)', defaultValue: "'developer'", isNullable: false },
              { name: 'is_active', type: 'BOOLEAN', defaultValue: '1', isNullable: false },
              { name: 'created_at', type: 'TIMESTAMP', isNullable: false },
            ],
            indexes: [
              { name: 'idx_users_email_unique', columns: ['email'], isUnique: true },
            ],
            data: [
              { id: 1, username: 'adminlocal', email: 'admin@ide.local', role: 'admin', is_active: 1, created_at: '2026-01-10 08:00:00' },
              { id: 2, username: 'tungtn', email: 'tung.tn@company.com', role: 'lead-dev', is_active: 1, created_at: '2026-02-15 09:12:30' },
              { id: 3, username: 'sarah_backend', email: 'sarah@cloud.io', role: 'developer', is_active: 1, created_at: '2026-03-01 11:20:00' },
              { id: 4, username: 'alex_frontend', email: 'alex@design.dev', role: 'developer', is_active: 1, created_at: '2026-04-12 14:05:00' },
              { id: 5, username: 'ci_bot', email: 'bot@ci.github.com', role: 'service', is_active: 1, created_at: '2026-01-01 00:00:00' },
            ]
          },
          {
            name: 'settings',
            schema: 'main',
            rowCount: 4,
            columns: [
              { name: 'key', type: 'VARCHAR(128)', isPrimaryKey: true, isNullable: false },
              { name: 'value', type: 'TEXT', isNullable: false },
              { name: 'category', type: 'VARCHAR(64)', isNullable: false },
              { name: 'updated_at', type: 'TIMESTAMP', isNullable: false },
            ],
            data: [
              { key: 'editor.theme', value: 'intellij-new-ui-dark', category: 'appearance', updated_at: '2026-10-25 18:20:00' },
              { key: 'editor.fontSize', value: '13', category: 'editor', updated_at: '2026-10-25 18:20:00' },
              { key: 'git.autoFetch', value: 'true', category: 'vcs', updated_at: '2026-10-20 12:00:00' },
              { key: 'ai.completionEnabled', value: 'true', category: 'ai-assistant', updated_at: '2026-10-26 09:00:00' },
            ]
          },
          {
            name: 'audit_logs',
            schema: 'main',
            rowCount: 4,
            columns: [
              { name: 'id', type: 'INTEGER', isPrimaryKey: true, isNullable: false },
              { name: 'action', type: 'VARCHAR(100)', isNullable: false },
              { name: 'actor', type: 'VARCHAR(64)', isNullable: false },
              { name: 'target', type: 'VARCHAR(255)', isNullable: true },
              { name: 'status', type: 'VARCHAR(32)', isNullable: false },
              { name: 'created_at', type: 'DATETIME', isNullable: false },
            ],
            data: [
              { id: 101, action: 'GIT_COMMIT', actor: 'tungtn', target: 'feat: Visual Debugger tool window', status: 'SUCCESS', created_at: '2026-10-26 02:10:00' },
              { id: 102, action: 'GIT_REBASE', actor: 'tungtn', target: 'interactive rebase on main', status: 'SUCCESS', created_at: '2026-10-26 02:30:15' },
              { id: 103, action: 'AI_PROMPT', actor: 'adminlocal', target: 'generate unit test for App.tsx', status: 'SUCCESS', created_at: '2026-10-26 03:00:00' },
              { id: 104, action: 'BUILD_TASK', actor: 'ci_bot', target: 'cargo check --release', status: 'SUCCESS', created_at: '2026-10-26 03:10:00' },
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'ds-pg-ecommerce',
    name: 'ecommerce_prod (PostgreSQL)',
    engine: 'postgresql',
    host: 'db.prod.internal',
    port: 5432,
    databaseName: 'ecommerce_prod',
    user: 'postgres_admin',
    isConnected: true,
    schemas: [
      {
        name: 'public',
        tables: [
          {
            name: 'products',
            schema: 'public',
            rowCount: 5,
            columns: [
              { name: 'product_id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
              { name: 'sku', type: 'VARCHAR(32)', isNullable: false },
              { name: 'title', type: 'VARCHAR(255)', isNullable: false },
              { name: 'price', type: 'NUMERIC(10,2)', isNullable: false },
              { name: 'stock_quantity', type: 'INTEGER', isNullable: false },
              { name: 'is_published', type: 'BOOLEAN', defaultValue: 'true', isNullable: false },
            ],
            data: [
              { product_id: 1, sku: 'JB-IDEA-ULT-1Y', title: 'IntelliJ IDEA Ultimate 1-Year License', price: 599.00, stock_quantity: 9999, is_published: true },
              { product_id: 2, sku: 'JB-ALL-PACK-1Y', title: 'JetBrains All Products Pack', price: 779.00, stock_quantity: 9999, is_published: true },
              { product_id: 3, sku: 'JB-DATAGRIP-1Y', title: 'DataGrip Standalone License', price: 229.00, stock_quantity: 500, is_published: true },
              { product_id: 4, sku: 'JB-AI-PRO-1M', title: 'JetBrains AI Assistant Pro Monthly', price: 10.00, stock_quantity: 10000, is_published: true },
              { product_id: 5, sku: 'DEV-KEYBOARD-RGB', title: 'JetBrains Mechanical Keyboard Brown Switch', price: 149.50, stock_quantity: 42, is_published: true },
            ]
          },
          {
            name: 'orders',
            schema: 'public',
            rowCount: 4,
            columns: [
              { name: 'order_id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
              { name: 'customer_email', type: 'VARCHAR(128)', isNullable: false },
              { name: 'total_amount', type: 'NUMERIC(12,2)', isNullable: false },
              { name: 'currency', type: 'VARCHAR(3)', defaultValue: "'USD'", isNullable: false },
              { name: 'status', type: 'VARCHAR(32)', defaultValue: "'completed'", isNullable: false },
              { name: 'order_date', type: 'TIMESTAMP WITH TIME ZONE', isNullable: false },
            ],
            data: [
              { order_id: 1001, customer_email: 'tung.tn@company.com', total_amount: 599.00, currency: 'USD', status: 'completed', order_date: '2026-10-25 14:00:00+07' },
              { order_id: 1002, customer_email: 'sarah@cloud.io', total_amount: 779.00, currency: 'USD', status: 'completed', order_date: '2026-10-25 15:30:12+07' },
              { order_id: 1003, customer_email: 'alex@design.dev', total_amount: 229.00, currency: 'USD', status: 'pending', order_date: '2026-10-26 08:45:00+07' },
              { order_id: 1004, customer_email: 'admin@ide.local', total_amount: 159.50, currency: 'USD', status: 'processing', order_date: '2026-10-26 09:20:00+07' },
            ]
          }
        ]
      }
    ]
  }
];
