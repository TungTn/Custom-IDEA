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

export function getDataSourceUrl(ds: DataSourceConnection): string {
  if (ds.engine === 'sqlite') {
    return ds.filePath || 'sqlite::memory:';
  }
  if (ds.engine === 'postgresql') {
    const host = ds.host || 'localhost';
    const port = ds.port || 5432;
    const user = ds.user ? encodeURIComponent(ds.user) : 'postgres';
    const db = ds.databaseName || 'postgres';
    return `postgres://${user}@${host}:${port}/${db}`;
  }
  if (ds.engine === 'mysql' || ds.engine === 'mariadb') {
    const host = ds.host || 'localhost';
    const port = ds.port || 3306;
    const user = ds.user ? encodeURIComponent(ds.user) : 'root';
    const db = ds.databaseName || '';
    return `mysql://${user}@${host}:${port}/${db}`;
  }
  return ds.filePath || '';
}

export const INITIAL_DATA_SOURCES: DataSourceConnection[] = [];

