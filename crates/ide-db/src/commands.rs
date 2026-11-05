use std::path::Path;
use std::sync::Once;
use std::time::{Duration, Instant};

use serde_json::{json, Value};
use sqlx::any::{AnyPoolOptions, AnyRow};
use sqlx::{Any, Column, Pool, Row, TypeInfo, ValueRef};

pub type AnyPool = Pool<Any>;


use crate::models::{
    DbColumnDto, DbIndexDto, DbQueryResultDto, DbSchemaDto, DbTableDto,
    DbTestConnectionResultDto,
};

static INIT_DRIVERS: Once = Once::new();

pub fn ensure_drivers_installed() {
    INIT_DRIVERS.call_once(|| {
        sqlx::any::install_default_drivers();
    });
}

/// Normalizes connection URLs for SQLite, Postgres, MySQL.
/// For example: "D:\IDE\data\test.sqlite" -> "sqlite://D:/IDE/data/test.sqlite?mode=rwc"
pub fn normalize_connection_url(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed == "sqlite::memory:" || trimmed == "sqlite::memory" || trimmed == ":memory:" {
        return "sqlite::memory:".to_string();
    }
    if trimmed.starts_with("sqlite:") {
        let path_part = trimmed.trim_start_matches("sqlite://").trim_start_matches("sqlite:");
        if path_part == ":memory:" || path_part == ":memory" {
            return "sqlite::memory:".to_string();
        }
        let norm_path = path_part.replace('\\', "/");


        if !norm_path.contains("?mode=") {
            format!("sqlite://{}?mode=rwc", norm_path)
        } else {
            format!("sqlite://{}", norm_path)
        }
    } else if trimmed.starts_with("postgres://") 

        || trimmed.starts_with("postgresql://") 
        || trimmed.starts_with("mysql://") 
    {
        trimmed.to_string()
    } else if trimmed.ends_with(".sqlite") || trimmed.ends_with(".db") || trimmed.contains('\\') || trimmed.contains('/') {
        // Bare file path, assume SQLite
        let norm_path = trimmed.replace('\\', "/");
        // Ensure directory exists
        if let Some(parent) = Path::new(trimmed).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        format!("sqlite://{}?mode=rwc", norm_path)
    } else {
        trimmed.to_string()
    }
}

static POOL_CACHE: std::sync::OnceLock<std::sync::Arc<tokio::sync::RwLock<std::collections::HashMap<String, AnyPool>>>> = std::sync::OnceLock::new();

fn get_pool_cache() -> std::sync::Arc<tokio::sync::RwLock<std::collections::HashMap<String, AnyPool>>> {
    POOL_CACHE.get_or_init(|| std::sync::Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new()))).clone()
}

async fn get_connection_pool(url: &str) -> Result<AnyPool, String> {
    ensure_drivers_installed();
    let norm_url = normalize_connection_url(url);

    let cache = get_pool_cache();
    {
        let reader = cache.read().await;
        if let Some(pool) = reader.get(&norm_url) {
            return Ok(pool.clone());
        }
    }
    
    // If it's a sqlite file URL, ensure parent directory exists
    if norm_url.starts_with("sqlite://") {
        let clean_path = norm_url.trim_start_matches("sqlite://");
        let path_without_query = clean_path.split('?').next().unwrap_or(clean_path);
        if let Some(parent) = Path::new(path_without_query).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    let is_memory_sqlite = norm_url.starts_with("sqlite:") && norm_url.contains("memory");
    let max_conns = if is_memory_sqlite { 1 } else { 5 };

    let pool = AnyPoolOptions::new()
        .max_connections(max_conns)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&norm_url)
        .await
        .map_err(|e| format!("Failed to connect to {}: {}", norm_url, e))?;

    let mut writer = cache.write().await;
    writer.insert(norm_url, pool.clone());
    Ok(pool)
}


fn extract_any_value(row: &AnyRow, col_idx: usize) -> Value {
    // Check for NULL
    if let Ok(raw_val) = row.try_get_raw(col_idx) {
        if raw_val.is_null() {
            return Value::Null;
        }
    }

    let col = &row.columns()[col_idx];
    let type_name = col.type_info().name().to_uppercase();

    // Check bool
    if type_name.contains("BOOL") {
        if let Ok(b) = row.try_get::<bool, _>(col_idx) {
            return Value::Bool(b);
        }
    }

    // Check integers
    if type_name.contains("INT") || type_name.contains("SERIAL") {
        if let Ok(i) = row.try_get::<i64, _>(col_idx) {
            return Value::Number(i.into());
        }
        if let Ok(i) = row.try_get::<i32, _>(col_idx) {
            return Value::Number(i.into());
        }
    }

    // Check floats
    if type_name.contains("FLOAT") || type_name.contains("DOUBLE") || type_name.contains("REAL") || type_name.contains("NUMERIC") || type_name.contains("DECIMAL") {
        if let Ok(f) = row.try_get::<f64, _>(col_idx) {
            if let Some(n) = serde_json::Number::from_f64(f) {
                return Value::Number(n);
            }
        }
    }

    // Check string
    if let Ok(s) = row.try_get::<String, _>(col_idx) {
        return Value::String(s);
    }

    // Fallbacks
    if let Ok(b) = row.try_get::<bool, _>(col_idx) {
        return Value::Bool(b);
    }
    if let Ok(i) = row.try_get::<i64, _>(col_idx) {
        return Value::Number(i.into());
    }
    if let Ok(f) = row.try_get::<f64, _>(col_idx) {
        if let Some(n) = serde_json::Number::from_f64(f) {
            return Value::Number(n);
        }
    }
    if let Ok(bytes) = row.try_get::<Vec<u8>, _>(col_idx) {
        if let Ok(s) = String::from_utf8(bytes) {
            return Value::String(s);
        }
    }

    Value::Null
}

fn any_row_to_json(row: &AnyRow) -> Value {
    let mut map = serde_json::Map::new();
    for (i, col) in row.columns().iter().enumerate() {
        let name = col.name().to_string();
        let val = extract_any_value(row, i);
        map.insert(name, val);
    }
    Value::Object(map)
}

#[tauri::command]
pub async fn db_test_connection(url: String) -> Result<DbTestConnectionResultDto, String> {
    let start = Instant::now();
    let norm_url = normalize_connection_url(&url);

    match get_connection_pool(&norm_url).await {
        Ok(pool) => {
            // Run a ping query
            let is_sqlite = norm_url.starts_with("sqlite:");
            let ping_query = if is_sqlite {
                "SELECT sqlite_version() as version"
            } else if norm_url.starts_with("postgres") {
                "SELECT version() as version"
            } else {
                "SELECT VERSION() as version"
            };

            let version: Option<String> = match sqlx::query(ping_query).fetch_optional(&pool).await {
                Ok(Some(row)) => row.try_get::<String, _>(0).ok(),
                _ => None,
            };

            let latency = start.elapsed().as_millis() as u64;
            Ok(DbTestConnectionResultDto {
                success: true,
                message: format!("Connection established successfully ({}ms)", latency),
                latency_ms: latency,
                server_version: version,
            })
        }
        Err(e) => {
            let latency = start.elapsed().as_millis() as u64;
            Ok(DbTestConnectionResultDto {
                success: false,
                message: e,
                latency_ms: latency,
                server_version: None,
            })
        }
    }
}

#[tauri::command]
pub async fn db_execute_query(
    url: String,
    query: String,
    max_rows: Option<usize>,
) -> Result<DbQueryResultDto, String> {
    let start = Instant::now();
    let norm_url = normalize_connection_url(&url);

    let pool = match get_connection_pool(&norm_url).await {
        Ok(p) => p,
        Err(e) => {
            return Ok(DbQueryResultDto {
                columns: vec!["error".into()],
                rows: vec![],
                execution_time_ms: start.elapsed().as_millis() as u64,
                affected_rows: 0,
                error: Some(e),
            });
        }
    };

    let trimmed = query.trim();
    let is_select = trimmed.to_uppercase().starts_with("SELECT")
        || trimmed.to_uppercase().starts_with("PRAGMA")
        || trimmed.to_uppercase().starts_with("EXPLAIN")
        || trimmed.to_uppercase().starts_with("SHOW")
        || trimmed.to_uppercase().starts_with("DESCRIBE");

    if is_select {
        match sqlx::query(trimmed).fetch_all(&pool).await {
            Ok(rows) => {
                let limit = max_rows.unwrap_or(500);
                let columns: Vec<String> = if let Some(first) = rows.first() {
                    first.columns().iter().map(|c| c.name().to_string()).collect()
                } else {
                    vec![]
                };

                let json_rows: Vec<Value> = rows
                    .iter()
                    .take(limit)
                    .map(any_row_to_json)
                    .collect();

                let execution_time_ms = start.elapsed().as_millis() as u64;
                Ok(DbQueryResultDto {
                    columns,
                    rows: json_rows,
                    execution_time_ms,
                    affected_rows: 0,
                    error: None,
                })
            }
            Err(e) => {
                let execution_time_ms = start.elapsed().as_millis() as u64;
                Ok(DbQueryResultDto {
                    columns: vec!["error".into()],
                    rows: vec![],
                    execution_time_ms,
                    affected_rows: 0,
                    error: Some(e.to_string()),
                })
            }
        }
    } else {
        match sqlx::query(trimmed).execute(&pool).await {
            Ok(res) => {
                let affected = res.rows_affected();
                let execution_time_ms = start.elapsed().as_millis() as u64;
                Ok(DbQueryResultDto {
                    columns: vec!["status".into(), "message".into()],
                    rows: vec![json!({
                        "status": "OK",
                        "message": format!("Statement executed successfully. Affected {} rows.", affected)
                    })],
                    execution_time_ms,
                    affected_rows: affected,
                    error: None,
                })
            }
            Err(e) => {
                let execution_time_ms = start.elapsed().as_millis() as u64;
                Ok(DbQueryResultDto {
                    columns: vec!["error".into()],
                    rows: vec![],
                    execution_time_ms,
                    affected_rows: 0,
                    error: Some(e.to_string()),
                })
            }
        }
    }
}

#[tauri::command]
pub async fn db_introspect_schema(
    url: String,
    engine: Option<String>,
) -> Result<Vec<DbSchemaDto>, String> {
    let norm_url = normalize_connection_url(&url);
    let pool = get_connection_pool(&norm_url).await?;

    let eng = engine
        .unwrap_or_else(|| {
            if norm_url.starts_with("sqlite:") {
                "sqlite".to_string()
            } else if norm_url.starts_with("postgres") {
                "postgresql".to_string()
            } else {
                "mysql".to_string()
            }
        })
        .to_lowercase();

    if eng == "sqlite" {
        introspect_sqlite(&pool).await
    } else if eng == "postgresql" || eng == "postgres" {
        introspect_postgres(&pool).await
    } else {
        introspect_mysql(&pool).await
    }
}

async fn introspect_sqlite(pool: &AnyPool) -> Result<Vec<DbSchemaDto>, String> {
    let tables_query = "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
    let rows = sqlx::query(tables_query)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to fetch SQLite tables: {}", e))?;

    let mut tables = Vec::new();
    for row in rows {
        let table_name: String = row.try_get(0).map_err(|e| e.to_string())?;

        // 1. Columns via PRAGMA table_info
        let pragma_cols_query = format!("PRAGMA table_info(\"{}\")", table_name);
        let col_rows = sqlx::query(&pragma_cols_query)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

        let mut columns = Vec::new();
        for col_row in col_rows {
            // cid, name, type, notnull, dflt_value, pk
            let col_name: String = col_row.try_get("name").unwrap_or_default();
            let col_type: String = col_row.try_get("type").unwrap_or_else(|_| "TEXT".into());
            let notnull: i64 = col_row.try_get("notnull").unwrap_or(0);
            let dflt_value: Option<String> = col_row.try_get("dflt_value").ok();
            let pk: i64 = col_row.try_get("pk").unwrap_or(0);

            columns.push(DbColumnDto {
                name: col_name,
                data_type: if col_type.is_empty() { "TEXT".into() } else { col_type },
                is_primary_key: pk > 0,
                is_nullable: notnull == 0,
                default_value: dflt_value,
                comment: None,
            });
        }

        // 2. Indexes via PRAGMA index_list
        let pragma_idx_query = format!("PRAGMA index_list(\"{}\")", table_name);
        let idx_rows = sqlx::query(&pragma_idx_query)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

        let mut indexes = Vec::new();
        for idx_row in idx_rows {
            let idx_name: String = idx_row.try_get("name").unwrap_or_default();
            let unique: i64 = idx_row.try_get("unique").unwrap_or(0);

            let pragma_idx_info = format!("PRAGMA index_info(\"{}\")", idx_name);
            let idx_col_rows = sqlx::query(&pragma_idx_info)
                .fetch_all(pool)
                .await
                .unwrap_or_default();

            let mut idx_cols = Vec::new();
            for col in idx_col_rows {
                if let Ok(cname) = col.try_get::<String, _>("name") {
                    idx_cols.push(cname);
                }
            }

            indexes.push(DbIndexDto {
                name: idx_name,
                columns: idx_cols,
                is_unique: unique > 0,
            });
        }

        // 3. Row count
        let count_query = format!("SELECT CAST(COUNT(*) AS INTEGER) as cnt FROM \"{}\"", table_name);
        let count_res = sqlx::query(&count_query).fetch_one(pool).await;
        let row_count: i64 = match count_res {
            Ok(r) => {
                if let Ok(val) = r.try_get::<i64, _>("cnt") {
                    val
                } else if let Ok(val) = r.try_get::<i32, _>("cnt") {
                    val as i64
                } else if let Value::Number(num) = extract_any_value(&r, 0) {
                    num.as_i64().unwrap_or(0)
                } else {
                    0
                }
            }
            Err(_) => 0,
        };






        tables.push(DbTableDto {
            name: table_name,
            schema: "main".into(),
            row_count,
            columns,
            indexes,
        });
    }

    Ok(vec![DbSchemaDto {
        name: "main".into(),
        tables,
    }])
}

async fn introspect_postgres(pool: &AnyPool) -> Result<Vec<DbSchemaDto>, String> {
    let query = r#"
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog') 
          AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name;
    "#;

    let rows = sqlx::query(query)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to introspect PostgreSQL tables: {}", e))?;

    let mut schemas_map: std::collections::HashMap<String, Vec<DbTableDto>> =
        std::collections::HashMap::new();

    for row in rows {
        let schema_name: String = row.try_get("table_schema").unwrap_or_else(|_| "public".into());
        let table_name: String = row.try_get("table_name").unwrap_or_default();

        // Columns
        let col_query = r#"
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position;
        "#;
        let col_rows = sqlx::query(col_query)
            .bind(&schema_name)
            .bind(&table_name)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

        let mut columns = Vec::new();
        for cr in col_rows {
            let col_name: String = cr.try_get("column_name").unwrap_or_default();
            let col_type: String = cr.try_get("data_type").unwrap_or_else(|_| "text".into());
            let is_nullable: String = cr.try_get("is_nullable").unwrap_or_else(|_| "YES".into());
            let col_default: Option<String> = cr.try_get("column_default").ok();

            columns.push(DbColumnDto {
                name: col_name,
                data_type: col_type,
                is_primary_key: false,
                is_nullable: is_nullable.to_uppercase() == "YES",
                default_value: col_default,
                comment: None,
            });
        }

        let table_dto = DbTableDto {
            name: table_name,
            schema: schema_name.clone(),
            row_count: 0,
            columns,
            indexes: vec![],
        };

        schemas_map.entry(schema_name).or_default().push(table_dto);
    }

    let schemas = schemas_map
        .into_iter()
        .map(|(name, tables)| DbSchemaDto { name, tables })
        .collect();

    Ok(schemas)
}

async fn introspect_mysql(pool: &AnyPool) -> Result<Vec<DbSchemaDto>, String> {
    let query = r#"
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    "#;

    let rows = sqlx::query(query)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to introspect MySQL tables: {}", e))?;

    let mut tables = Vec::new();
    for row in rows {
        let table_name: String = row.try_get("table_name").unwrap_or_default();

        let col_query = r#"
            SELECT column_name, data_type, is_nullable, column_default, column_key
            FROM information_schema.columns 
            WHERE table_schema = DATABASE() AND table_name = ?
            ORDER BY ordinal_position;
        "#;
        let col_rows = sqlx::query(col_query)
            .bind(&table_name)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

        let mut columns = Vec::new();
        for cr in col_rows {
            let col_name: String = cr.try_get("column_name").unwrap_or_default();
            let col_type: String = cr.try_get("data_type").unwrap_or_else(|_| "varchar".into());
            let is_nullable: String = cr.try_get("is_nullable").unwrap_or_else(|_| "YES".into());
            let col_default: Option<String> = cr.try_get("column_default").ok();
            let col_key: String = cr.try_get("column_key").unwrap_or_default();

            columns.push(DbColumnDto {
                name: col_name,
                data_type: col_type,
                is_primary_key: col_key == "PRI",
                is_nullable: is_nullable.to_uppercase() == "YES",
                default_value: col_default,
                comment: None,
            });
        }

        tables.push(DbTableDto {
            name: table_name,
            schema: "default".into(),
            row_count: 0,
            columns,
            indexes: vec![],
        });
    }

    Ok(vec![DbSchemaDto {
        name: "default".into(),
        tables,
    }])
}

#[tauri::command]
pub async fn db_get_table_data(
    url: String,
    schema: Option<String>,
    table: String,
    limit: Option<usize>,
    offset: Option<usize>,
    order_by: Option<String>,
    where_clause: Option<String>,
) -> Result<DbQueryResultDto, String> {
    let limit_val = limit.unwrap_or(25);
    let offset_val = offset.unwrap_or(0);

    let qualified_name = if let Some(ref s) = schema {
        if s.is_empty() || s == "main" || s == "public" || s == "default" {
            format!("\"{}\"", table)
        } else {
            format!("\"{}\".\"{}\"", s, table)
        }
    } else {
        format!("\"{}\"", table)
    };

    let mut query = format!("SELECT * FROM {}", qualified_name);

    if let Some(w) = where_clause {
        let trimmed_w = w.trim();
        if !trimmed_w.is_empty() {
            query.push_str(&format!(" WHERE {}", trimmed_w));
        }
    }

    if let Some(o) = order_by {
        let trimmed_o = o.trim();
        if !trimmed_o.is_empty() {
            query.push_str(&format!(" ORDER BY {}", trimmed_o));
        }
    }

    query.push_str(&format!(" LIMIT {} OFFSET {}", limit_val, offset_val));

    db_execute_query(url, query, Some(limit_val)).await
}
