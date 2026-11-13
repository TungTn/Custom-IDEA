use std::path::Path;
use std::sync::Once;
use std::time::{Duration, Instant};

use futures_util::StreamExt;
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
    let lower = trimmed.to_ascii_lowercase();
    if lower == "sqlite::memory:" || lower == "sqlite::memory" || lower == ":memory:" {
        return "sqlite::memory:".to_string();
    }
    let append_sqlite_mode = |norm_path: &str| -> String {
        if let Some((_, query)) = norm_path.split_once('?') {
            let has_mode = query
                .split('&')
                .any(|kv| kv == "mode" || kv.starts_with("mode="));
            if has_mode {
                format!("sqlite://{}", norm_path)
            } else if query.is_empty() {
                format!("sqlite://{}mode=rwc", norm_path)
            } else {
                format!("sqlite://{}&mode=rwc", norm_path)
            }
        } else {
            format!("sqlite://{}?mode=rwc", norm_path)
        }
    };
    if lower.starts_with("sqlite:") {
        let path_part = if lower.starts_with("sqlite://") {
            &trimmed[9..]
        } else {
            &trimmed[7..]
        };
        let path_without_query = path_part.split('?').next().unwrap_or(path_part);
        if path_without_query == ":memory:" || path_without_query == ":memory" {
            return "sqlite::memory:".to_string();
        }
        append_sqlite_mode(&path_part.replace('\\', "/"))
    } else if lower.starts_with("postgres://")
        || lower.starts_with("postgresql://")
        || lower.starts_with("mysql://")
    {
        trimmed.to_string()
    } else if lower.ends_with(".sqlite") || lower.ends_with(".db") || trimmed.contains('\\') || trimmed.contains('/') {
        append_sqlite_mode(&trimmed.replace('\\', "/"))
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
    if norm_url.starts_with("sqlite://") && norm_url != "sqlite::memory:" {
        let clean_path = norm_url.trim_start_matches("sqlite://");
        let path_without_query = clean_path.split('?').next().unwrap_or(clean_path);
        let bytes = path_without_query.as_bytes();
        // Handle Windows `/D:/...` path from `sqlite:///D:/...`
        let fs_path = if bytes.len() >= 3
            && bytes[0] == b'/'
            && bytes[1].is_ascii_alphabetic()
            && bytes[2] == b':'
        {
            &path_without_query[1..]
        } else {
            path_without_query
        };
        if let Some(parent) = Path::new(fs_path).parent() {
            if !parent.as_os_str().is_empty() {
                let _ = std::fs::create_dir_all(parent);
            }
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

    let (pool_to_return, duplicate_to_close) = {
        let mut writer = cache.write().await;
        if let Some(existing) = writer.get(&norm_url) {
            (existing.clone(), Some(pool))
        } else {
            let mut evicted = None;
            if writer.len() >= 16 {
                if let Some(old_key) = writer.keys().next().cloned() {
                    evicted = writer.remove(&old_key);
                }
            }
            writer.insert(norm_url, pool.clone());
            (pool, evicted)
        }
    };

    if let Some(to_close) = duplicate_to_close {
        tokio::spawn(async move {
            let _ = to_close.close().await;
        });
    }
    Ok(pool_to_return)
}

pub fn escape_sql_identifier(ident: &str, is_mysql: bool) -> String {
    if is_mysql {
        format!("`{}`", ident.replace('`', "``"))
    } else {
        format!("\"{}\"", ident.replace('"', "\"\""))
    }
}

pub fn strip_leading_sql_comments_and_whitespace(mut sql: &str) -> &str {
    loop {
        sql = sql.trim_start();
        if sql.starts_with("--") {
            if let Some(pos) = sql.find('\n') {
                sql = &sql[pos + 1..];
            } else {
                return "";
            }
        } else if sql.starts_with("/*") {
            if let Some(pos) = sql.find("*/") {
                sql = &sql[pos + 2..];
            } else {
                return "";
            }
        } else {
            break;
        }
    }
    sql
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
            return match serde_json::Number::from_f64(f) {
                Some(n) => Value::Number(n),
                None => Value::String(f.to_string()),
            };
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
        return match serde_json::Number::from_f64(f) {
            Some(n) => Value::Number(n),
            None => Value::String(f.to_string()),
        };
    }
    if let Ok(bytes) = row.try_get::<Vec<u8>, _>(col_idx) {
        return match String::from_utf8(bytes) {
            Ok(s) => Value::String(s),
            Err(e) => Value::String(format!("<BLOB {} bytes>", e.into_bytes().len())),
        };
    }

    Value::Null
}

/// Top-level keyword & paren classification to distinguish row-returning queries
/// (`SELECT`, `(SELECT ...)`, `VALUES`, `WITH ... SELECT`, `INSERT ... RETURNING`) from DML.
pub fn sql_returns_rows(sql: &str) -> bool {
    #[derive(Clone, Debug, PartialEq, Eq)]
    enum Tok {
        LParen,
        RParen,
        Word(String),
        Other,
    }

    let bytes = sql.as_bytes();
    let mut i = 0usize;
    let mut toks: Vec<Tok> = Vec::new();
    while i < bytes.len() {
        let b = bytes[i];
        if b.is_ascii_whitespace() {
            i += 1;
            continue;
        }
        // Comments
        if b == b'-' && bytes.get(i + 1) == Some(&b'-') {
            i += 2;
            while i < bytes.len() && bytes[i] != b'\n' {
                i += 1;
            }
            continue;
        }
        if b == b'/' && bytes.get(i + 1) == Some(&b'*') {
            i += 2;
            while i + 1 < bytes.len() && !(bytes[i] == b'*' && bytes[i + 1] == b'/') {
                i += 1;
            }
            i = (i + 2).min(bytes.len());
            continue;
        }
        // Quoted literals/identifiers
        if b == b'\'' || b == b'"' || b == b'`' {
            let quote = b;
            i += 1;
            while i < bytes.len() {
                if b == b'\'' && bytes[i] == b'\\' {
                    i = (i + 2).min(bytes.len());
                    continue;
                }
                if bytes[i] == quote {
                    if bytes.get(i + 1) == Some(&quote) {
                        i += 2;
                        continue;
                    }
                    i += 1;
                    break;
                }
                i += 1;
            }
            toks.push(Tok::Other);
            continue;
        }
        if b == b'(' {
            toks.push(Tok::LParen);
            i += 1;
            continue;
        }
        if b == b')' {
            toks.push(Tok::RParen);
            i += 1;
            continue;
        }
        if b.is_ascii_alphabetic() || b == b'_' {
            let start = i;
            i += 1;
            while i < bytes.len() && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'_') {
                i += 1;
            }
            toks.push(Tok::Word(sql[start..i].to_ascii_uppercase()));
            continue;
        }
        toks.push(Tok::Other);
        i += 1;
    }

    let first_non_paren = toks.iter().position(|t| *t != Tok::LParen);
    let Some(idx) = first_non_paren else {
        return false;
    };

    let has_top_level_returning = |slice: &[Tok]| -> bool {
        let mut depth = 0i32;
        for t in slice {
            match t {
                Tok::LParen => depth += 1,
                Tok::RParen => depth = (depth - 1).max(0),
                Tok::Word(w) if depth == 0 && w == "RETURNING" => return true,
                _ => {}
            }
        }
        false
    };

    match &toks[idx] {
        Tok::Word(w) => match w.as_str() {
            "SELECT" | "PRAGMA" | "EXPLAIN" | "SHOW" | "DESCRIBE" | "VALUES" => true,
            "INSERT" | "UPDATE" | "DELETE" | "REPLACE" => has_top_level_returning(&toks[idx + 1..]),
            "WITH" => {
                // Find the main top-level verb after CTE definitions
                let mut depth = 0i32;
                let mut main_verb: Option<&str> = None;
                let mut verb_pos = idx + 1;
                for (offset, t) in toks[idx + 1..].iter().enumerate() {
                    match t {
                        Tok::LParen => depth += 1,
                        Tok::RParen => depth = (depth - 1).max(0),
                        Tok::Word(kw) if depth == 0 => {
                            if matches!(
                                kw.as_str(),
                                "SELECT" | "VALUES" | "INSERT" | "UPDATE" | "DELETE" | "REPLACE"
                            ) {
                                main_verb = Some(kw.as_str());
                                verb_pos = idx + 1 + offset;
                                break;
                            }
                        }
                        _ => {}
                    }
                }
                match main_verb {
                    Some("SELECT") | Some("VALUES") => true,
                    Some("INSERT") | Some("UPDATE") | Some("DELETE") | Some("REPLACE") => {
                        has_top_level_returning(&toks[verb_pos + 1..])
                    }
                    _ => false,
                }
            }
            _ => false,
        },
        _ => false,
    }
}

fn validate_sql_col_ident(ident: &str) -> Result<&str, String> {
    let trimmed = ident.trim();
    if trimmed.is_empty() {
        return Err("Column identifier cannot be empty".into());
    }
    let mut chars = trimmed.chars();
    let Some(first) = chars.next() else {
        return Err("Column identifier cannot be empty".into());
    };
    if !(first.is_ascii_alphabetic() || first == '_')
        || !chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
    {
        return Err(format!("Invalid SQL column identifier: '{}'", trimmed));
    }
    let upper = trimmed.to_ascii_uppercase();
    if matches!(
        upper.as_str(),
        "SELECT" | "UNION" | "DROP" | "DELETE" | "INSERT" | "UPDATE" | "WHERE" | "FROM" | "AND" | "OR"
    ) {
        return Err(format!("Reserved keyword cannot be used as unquoted column identifier: '{}'", trimmed));
    }
    Ok(trimmed)
}

/// Validates and re-serializes an ORDER BY clause strictly as `col [ASC|DESC], ...`.
pub fn sanitize_order_by(raw: &str, is_mysql: bool) -> Result<String, String> {
    let mut out = Vec::new();
    for part in raw.split(',') {
        let trimmed = part.trim();
        if trimmed.is_empty() {
            return Err("Invalid empty clause in ORDER BY".into());
        }
        let tokens: Vec<&str> = trimmed.split_whitespace().collect();
        if tokens.is_empty() || tokens.len() > 2 {
            return Err(format!("Invalid ORDER BY clause: '{}'", trimmed));
        }
        let col = validate_sql_col_ident(tokens[0])?;
        let escaped_col = escape_sql_identifier(col, is_mysql);
        if tokens.len() == 2 {
            let dir = tokens[1].to_ascii_uppercase();
            if dir != "ASC" && dir != "DESC" {
                return Err(format!("Invalid sort direction '{}' in ORDER BY", tokens[1]));
            }
            out.push(format!("{} {}", escaped_col, dir));
        } else {
            out.push(escaped_col);
        }
    }
    if out.is_empty() {
        return Err("ORDER BY cannot be empty".into());
    }
    Ok(out.join(", "))
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum WhereTok {
    Ident(String),
    Keyword(String),
    StrLit(String),
    NumLit(String),
    Op(String),
}

fn tokenize_where_clause(raw: &str) -> Result<Vec<WhereTok>, String> {
    let bytes = raw.as_bytes();
    let mut i = 0usize;
    let mut toks = Vec::new();

    while i < bytes.len() {
        let b = bytes[i];
        if b.is_ascii_whitespace() {
            i += 1;
            continue;
        }
        if b == b'\0'
            || b == b';'
            || b == b'('
            || b == b')'
            || b == b'"'
            || b == b'`'
            || b == b','
            || (b == b'-' && bytes.get(i + 1) == Some(&b'-'))
            || (b == b'/' && bytes.get(i + 1) == Some(&b'*'))
        {
            return Err("Unsafe or unsupported syntax in WHERE filter".into());
        }
        // Single-quoted string literal
        if b == b'\'' {
            i += 1;
            let mut val = String::new();
            let mut closed = false;
            while i < bytes.len() {
                if bytes[i] == b'\0' {
                    return Err("NUL byte not allowed in WHERE string literal".into());
                }
                if bytes[i] == b'\'' {
                    if bytes.get(i + 1) == Some(&b'\'') {
                        val.push('\'');
                        i += 2;
                        continue;
                    }
                    i += 1;
                    closed = true;
                    break;
                }
                let ch = raw[i..].chars().next().ok_or_else(|| "Invalid UTF-8 in WHERE".to_string())?;
                val.push(ch);
                i += ch.len_utf8();
            }
            if !closed {
                return Err("Unterminated string literal in WHERE filter".into());
            }
            toks.push(WhereTok::StrLit(val));
            continue;
        }
        // Comparison operators
        if (b == b'!' && bytes.get(i + 1) == Some(&b'='))
            || (b == b'<' && bytes.get(i + 1) == Some(&b'>'))
            || (b == b'<' && bytes.get(i + 1) == Some(&b'='))
            || (b == b'>' && bytes.get(i + 1) == Some(&b'='))
        {
            toks.push(WhereTok::Op(raw[i..i + 2].to_string()));
            i += 2;
            continue;
        }
        if b == b'=' || b == b'<' || b == b'>' {
            toks.push(WhereTok::Op(raw[i..i + 1].to_string()));
            i += 1;
            continue;
        }
        // Numeric literal: optional '-' + digits + optional '.' + digits
        if b.is_ascii_digit()
            || (b == b'-' && bytes.get(i + 1).map_or(false, |d| d.is_ascii_digit()))
        {
            let start = i;
            if b == b'-' {
                i += 1;
            }
            while i < bytes.len() && bytes[i].is_ascii_digit() {
                i += 1;
            }
            if bytes.get(i) == Some(&b'.') {
                i += 1;
                if i >= bytes.len() || !bytes[i].is_ascii_digit() {
                    return Err("Invalid numeric literal in WHERE filter".into());
                }
                while i < bytes.len() && bytes[i].is_ascii_digit() {
                    i += 1;
                }
            }
            if i < bytes.len() && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'_' || bytes[i] == b'.') {
                return Err("Invalid numeric literal in WHERE filter".into());
            }
            toks.push(WhereTok::NumLit(raw[start..i].to_string()));
            continue;
        }
        // Word token
        if b.is_ascii_alphabetic() || b == b'_' {
            let start = i;
            i += 1;
            while i < bytes.len() && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'_') {
                i += 1;
            }
            let word = &raw[start..i];
            let upper = word.to_ascii_uppercase();
            if matches!(
                upper.as_str(),
                "AND" | "OR" | "IS" | "NOT" | "NULL" | "LIKE" | "TRUE" | "FALSE"
            ) {
                toks.push(WhereTok::Keyword(upper));
            } else {
                toks.push(WhereTok::Ident(word.to_string()));
            }
            continue;
        }
        return Err(format!("Unsupported character '{}' in WHERE filter", b as char));
    }

    Ok(toks)
}

fn format_sql_string_literal(s: &str, is_mysql: bool) -> String {
    let escaped = if is_mysql {
        s.replace('\\', "\\\\").replace('\'', "''")
    } else {
        s.replace('\'', "''")
    };
    format!("'{}'", escaped)
}

/// Strictly validates and re-serializes simple `col OP literal [AND|OR ...]` filters.
pub fn sanitize_where_clause(raw: &str, is_mysql: bool) -> Result<String, String> {
    let toks = tokenize_where_clause(raw)?;
    if toks.is_empty() {
        return Err("WHERE clause cannot be empty".into());
    }

    let mut idx = 0usize;
    let mut parts = Vec::new();

    loop {
        let Some(WhereTok::Ident(col)) = toks.get(idx) else {
            return Err("Expected column name in WHERE predicate".into());
        };
        let valid_col = validate_sql_col_ident(col)?;
        let escaped_col = escape_sql_identifier(valid_col, is_mysql);
        idx += 1;

        match toks.get(idx) {
            Some(WhereTok::Keyword(kw)) if kw == "IS" => {
                idx += 1;
                if let Some(WhereTok::Keyword(not_kw)) = toks.get(idx) {
                    if not_kw == "NOT" {
                        idx += 1;
                        let Some(WhereTok::Keyword(null_kw)) = toks.get(idx) else {
                            return Err("Expected NULL after IS NOT in WHERE".into());
                        };
                        if null_kw != "NULL" {
                            return Err("Expected NULL after IS NOT in WHERE".into());
                        }
                        idx += 1;
                        parts.push(format!("{} IS NOT NULL", escaped_col));
                    } else if not_kw == "NULL" {
                        idx += 1;
                        parts.push(format!("{} IS NULL", escaped_col));
                    } else {
                        return Err("Expected NULL or NOT NULL after IS in WHERE".into());
                    }
                } else {
                    return Err("Expected NULL or NOT NULL after IS in WHERE".into());
                }
            }
            Some(WhereTok::Keyword(kw)) if kw == "LIKE" => {
                idx += 1;
                let Some(WhereTok::StrLit(s)) = toks.get(idx) else {
                    return Err("LIKE requires a string literal in WHERE".into());
                };
                idx += 1;
                parts.push(format!("{} LIKE {}", escaped_col, format_sql_string_literal(s, is_mysql)));
            }
            Some(WhereTok::Keyword(kw)) if kw == "NOT" => {
                idx += 1;
                let Some(WhereTok::Keyword(like_kw)) = toks.get(idx) else {
                    return Err("Expected LIKE after NOT in WHERE".into());
                };
                if like_kw != "LIKE" {
                    return Err("Expected LIKE after NOT in WHERE".into());
                }
                idx += 1;
                let Some(WhereTok::StrLit(s)) = toks.get(idx) else {
                    return Err("NOT LIKE requires a string literal in WHERE".into());
                };
                idx += 1;
                parts.push(format!("{} NOT LIKE {}", escaped_col, format_sql_string_literal(s, is_mysql)));
            }
            Some(WhereTok::Op(op)) => {
                let op_str = op.clone();
                idx += 1;
                let rhs = match toks.get(idx) {
                    Some(WhereTok::StrLit(s)) => format_sql_string_literal(s, is_mysql),
                    Some(WhereTok::NumLit(n)) => n.clone(),
                    Some(WhereTok::Keyword(b)) if b == "TRUE" || b == "FALSE" => b.clone(),
                    _ => return Err("Comparison operator in WHERE requires a string, number, or boolean literal".into()),
                };
                idx += 1;
                parts.push(format!("{} {} {}", escaped_col, op_str, rhs));
            }
            _ => return Err("Expected comparison operator, LIKE, or IS [NOT] NULL in WHERE predicate".into()),
        }

        match toks.get(idx) {
            None => break,
            Some(WhereTok::Keyword(conj)) if conj == "AND" || conj == "OR" => {
                parts.push(conj.clone());
                idx += 1;
            }
            _ => return Err("Expected AND or OR between WHERE predicates".into()),
        }
    }

    Ok(parts.join(" "))
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
    let is_select = sql_returns_rows(trimmed);

    if is_select {
        let limit = max_rows.unwrap_or(500);
        let mut columns: Vec<String> = Vec::new();
        let mut json_rows: Vec<Value> = Vec::new();
        let mut stream = sqlx::query(trimmed).fetch(&pool);

        while let Some(item) = stream.next().await {
            match item {
                Ok(row) => {
                    if columns.is_empty() {
                        columns = row.columns().iter().map(|c| c.name().to_string()).collect();
                    }
                    if json_rows.len() < limit {
                        json_rows.push(any_row_to_json(&row));
                    }
                    if json_rows.len() >= limit {
                        break;
                    }
                }
                Err(e) => {
                    let execution_time_ms = start.elapsed().as_millis() as u64;
                    return Ok(DbQueryResultDto {
                        columns: vec!["error".into()],
                        rows: vec![],
                        execution_time_ms,
                        affected_rows: 0,
                        error: Some(e.to_string()),
                    });
                }
            }
        }

        let execution_time_ms = start.elapsed().as_millis() as u64;
        Ok(DbQueryResultDto {
            columns,
            rows: json_rows,
            execution_time_ms,
            affected_rows: 0,
            error: None,
        })
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
        let safe_table = escape_sql_identifier(&table_name, false);

        // 1. Columns via PRAGMA table_info
        let pragma_cols_query = format!("PRAGMA table_info({})", safe_table);
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
        let pragma_idx_query = format!("PRAGMA index_list({})", safe_table);
        let idx_rows = sqlx::query(&pragma_idx_query)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

        let mut indexes = Vec::new();
        for idx_row in idx_rows {
            let idx_name: String = idx_row.try_get("name").unwrap_or_default();
            let unique: i64 = idx_row.try_get("unique").unwrap_or(0);
            let safe_idx = escape_sql_identifier(&idx_name, false);

            let pragma_idx_info = format!("PRAGMA index_info({})", safe_idx);
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
        let count_query = format!("SELECT CAST(COUNT(*) AS INTEGER) as cnt FROM {}", safe_table);
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
    if table.trim().is_empty() || table.contains('\0') {
        return Err("Invalid table name".into());
    }
    let limit_val = limit.unwrap_or(25).min(10_000);
    let offset_val = offset.unwrap_or(0);

    let norm_url = normalize_connection_url(&url);
    let is_mysql = norm_url.to_lowercase().starts_with("mysql");
    let safe_table = escape_sql_identifier(&table, is_mysql);
    let qualified_name = if let Some(ref s) = schema {
        if s.contains('\0') {
            return Err("Invalid schema name".into());
        }
        if s.is_empty() || s == "main" || s == "public" || s == "default" {
            safe_table
        } else {
            let safe_schema = escape_sql_identifier(s, is_mysql);
            format!("{}.{}", safe_schema, safe_table)
        }
    } else {
        safe_table
    };

    let mut query = format!("SELECT * FROM {}", qualified_name);

    if let Some(w) = where_clause {
        let trimmed_w = w.trim();
        if !trimmed_w.is_empty() {
            let safe_where = sanitize_where_clause(trimmed_w, is_mysql)?;
            query.push_str(&format!(" WHERE {}", safe_where));
        }
    }

    if let Some(o) = order_by {
        let trimmed_o = o.trim();
        if !trimmed_o.is_empty() {
            let safe_order = sanitize_order_by(trimmed_o, is_mysql)?;
            query.push_str(&format!(" ORDER BY {}", safe_order));
        }
    }

    query.push_str(&format!(" LIMIT {} OFFSET {}", limit_val, offset_val));

    db_execute_query(norm_url, query, Some(limit_val)).await
}

#[tauri::command]
pub async fn db_close_pool(url: String) -> Result<(), String> {
    let norm_url = normalize_connection_url(&url);
    let cache = get_pool_cache();
    let pool_opt = {
        let mut writer = cache.write().await;
        writer.remove(&norm_url)
    };
    if let Some(pool) = pool_opt {
        let _ = pool.close().await;
    }
    Ok(())
}
