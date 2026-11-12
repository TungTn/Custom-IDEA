use ide_db::*;

#[tokio::test]
async fn test_sqlite_engine_full_workflow() {
    let db_url = "sqlite::memory:";

    // 1. Test connection
    let conn_res = db_test_connection(db_url.to_string()).await.expect("db_test_connection should succeed");
    assert!(conn_res.success, "Connection should be successful: {}", conn_res.message);
    println!("Connection test passed: {:?}", conn_res);

    // 2. Create table and insert data
    let ddl = "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, email TEXT, active INTEGER DEFAULT 1);";
    let ddl_res = db_execute_query(db_url.to_string(), ddl.to_string(), None).await.expect("DDL execution failed");

    assert!(ddl_res.error.is_none(), "DDL should have no error: {:?}", ddl_res.error);

    let insert = "INSERT INTO users (username, email, active) VALUES ('tungtn', 'tung.tn@local.dev', 1), ('admin', 'admin@local.dev', 0);";
    let insert_res = db_execute_query(db_url.to_string(), insert.to_string(), None).await.expect("Insert execution failed");
    assert_eq!(insert_res.affected_rows, 2);

    // 3. Introspect schema
    let schemas = db_introspect_schema(db_url.to_string(), Some("sqlite".into())).await.expect("Introspection failed");
    assert_eq!(schemas.len(), 1);
    let main_schema = &schemas[0];
    assert_eq!(main_schema.name, "main");
    
    let users_table = main_schema.tables.iter().find(|t| t.name == "users").expect("users table should exist");
    assert_eq!(users_table.row_count, 2);
    assert_eq!(users_table.columns.len(), 4);
    assert!(users_table.columns.iter().any(|c| c.name == "id" && c.is_primary_key));
    assert!(users_table.columns.iter().any(|c| c.name == "username" && !c.is_nullable));

    // 4. Select query execution
    let select = "SELECT id, username, email, active FROM users ORDER BY id ASC";
    let select_res = db_execute_query(db_url.to_string(), select.to_string(), None).await.expect("Select query failed");
    assert_eq!(select_res.rows.len(), 2);


    assert_eq!(select_res.columns, vec!["id", "username", "email", "active"]);
    assert_eq!(select_res.rows[0]["username"], "tungtn");

    // 5. Get table data with pagination
    let grid_data = db_get_table_data(
        db_url.to_string(),
        Some("main".into()),
        "users".into(),
        Some(1),
        Some(0),
        Some("id ASC".into()),
        None,
    ).await.expect("db_get_table_data failed");
    assert_eq!(grid_data.rows.len(), 1);
    assert_eq!(grid_data.rows[0]["username"], "tungtn");

    // 6. Test WITH CTE with leading comments
    let cte_query = "-- leading comment\n/* block comment */\nWITH c AS (SELECT 42 AS num, 'cte_val' AS txt) SELECT * FROM c";
    let cte_res = db_execute_query(db_url.to_string(), cte_query.to_string(), None).await.expect("CTE query failed");
    assert_eq!(cte_res.columns, vec!["num", "txt"]);
    assert_eq!(cte_res.rows.len(), 1);
    assert_eq!(cte_res.rows[0]["txt"], "cte_val");

    // 7. Test db_close_pool
    let close_res = db_close_pool(db_url.to_string()).await;
    assert!(close_res.is_ok());

    println!("All SQLite engine tests PASSED!");
}

#[test]
fn test_escape_sql_identifier_and_comment_stripping() {
    // SQLite / Postgres double-quote escaping
    assert_eq!(escape_sql_identifier("users", false), "\"users\"");
    assert_eq!(escape_sql_identifier("weird\"name", false), "\"weird\"\"name\"");

    // MySQL backtick escaping
    assert_eq!(escape_sql_identifier("users", true), "`users`");
    assert_eq!(escape_sql_identifier("weird`name", true), "`weird``name`");

    // Comment and whitespace stripping
    assert_eq!(
        strip_leading_sql_comments_and_whitespace("  -- line comment\r\n  /* block /* nested-text */ SELECT 1"),
        "SELECT 1"
    );
    assert_eq!(
        strip_leading_sql_comments_and_whitespace("-- first\n-- second\n\tWITH x AS (SELECT 1) SELECT * FROM x"),
        "WITH x AS (SELECT 1) SELECT * FROM x"
    );
    assert_eq!(
        strip_leading_sql_comments_and_whitespace("/* unterminated comment"),
        ""
    );
}

#[tokio::test]
async fn test_db_get_table_data_with_quoted_table_name() {
    struct TempDbFile(std::path::PathBuf);
    impl Drop for TempDbFile {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }

    let unique = format!(
        "ide_db_quoted_test_{}.sqlite",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    );
    let tmp = TempDbFile(std::env::temp_dir().join(unique));
    let db_url = format!("sqlite:///{}", tmp.0.to_string_lossy().replace('\\', "/"));

    let test_res: Result<(), String> = async {
        let setup = db_execute_query(
            db_url.clone(),
            r#"CREATE TABLE "odd""table" (id INTEGER PRIMARY KEY, label TEXT); INSERT INTO "odd""table" (id, label) VALUES (1, 'safe');"#.to_string(),
            None,
        )
        .await?;
        if setup.error.is_some() {
            return Err(format!("setup SQL error: {:?}", setup.error));
        }

        let data = db_get_table_data(
            db_url.clone(),
            Some("main".into()),
            r#"odd"table"#.to_string(),
            Some(10),
            Some(0),
            None,
            None,
        )
        .await?;

        if data.error.is_some() {
            return Err(format!("query SQL error: {:?}", data.error));
        }
        if data.rows.len() != 1 {
            return Err(format!("expected 1 row, got {}", data.rows.len()));
        }
        if data.rows[0]["label"] != "safe" {
            return Err(format!("unexpected label: {:?}", data.rows[0]["label"]));
        }
        Ok(())
    }
    .await;

    // Always close the pooled SQLite handle before asserting or dropping TempDbFile on Windows
    let _ = db_close_pool(db_url).await;
    test_res.expect("quoted table query test failed");
}
