use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../src/bindings.ts", rename_all = "camelCase")]
pub struct DbColumnDto {
    pub name: String,
    #[serde(rename = "type")]
    #[ts(rename = "type")]
    pub data_type: String,
    pub is_primary_key: bool,
    pub is_nullable: bool,
    pub default_value: Option<String>,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../src/bindings.ts", rename_all = "camelCase")]
pub struct DbIndexDto {
    pub name: String,
    pub columns: Vec<String>,
    pub is_unique: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../src/bindings.ts", rename_all = "camelCase")]
pub struct DbTableDto {
    pub name: String,
    pub schema: String,
    pub row_count: i64,
    pub columns: Vec<DbColumnDto>,
    pub indexes: Vec<DbIndexDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../src/bindings.ts", rename_all = "camelCase")]
pub struct DbSchemaDto {
    pub name: String,
    pub tables: Vec<DbTableDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../src/bindings.ts", rename_all = "camelCase")]
pub struct DbQueryResultDto {
    pub columns: Vec<String>,
    #[ts(type = "Record<string, any>[]")]
    pub rows: Vec<serde_json::Value>,
    pub execution_time_ms: u64,
    pub affected_rows: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../src/bindings.ts", rename_all = "camelCase")]
pub struct DbTestConnectionResultDto {
    pub success: bool,
    pub message: String,
    pub latency_ms: u64,
    pub server_version: Option<String>,
}
