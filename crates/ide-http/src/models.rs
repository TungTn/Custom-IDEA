use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct HttpRequestDto {
    pub id: Option<String>,
    pub method: String,
    pub url: String,
    #[ts(type = "Record<string, string>")]
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct HttpResponseDto {
    pub status: u16,
    pub status_text: String,
    #[ts(type = "Record<string, string>")]
    pub headers: HashMap<String, String>,
    pub body: String,
    pub latency_ms: u64,
    pub size_bytes: usize,
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct HttpBlockDto {
    pub id: String,
    pub name: Option<String>,
    pub method: String,
    pub url: String,
    #[ts(type = "Record<string, string>")]
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub start_line: usize,
    pub end_line: usize,
}
