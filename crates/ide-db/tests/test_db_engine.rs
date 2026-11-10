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
