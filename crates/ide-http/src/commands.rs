use crate::models::{HttpBlockDto, HttpRequestDto, HttpResponseDto};
use crate::parser::parse_http_file;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Instant;

#[tauri::command]
pub async fn http_execute_request(req: HttpRequestDto) -> Result<HttpResponseDto, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    let method = reqwest::Method::from_str(&req.method.to_uppercase())
        .map_err(|e| format!("Invalid HTTP method '{}': {e}", req.method))?;

    let mut request_builder = client.request(method, &req.url);

    for (k, v) in &req.headers {
        let header_name = reqwest::header::HeaderName::from_str(k)
            .map_err(|e| format!("Invalid header name '{k}': {e}"))?;
        let header_value = reqwest::header::HeaderValue::from_str(v)
            .map_err(|e| format!("Invalid header value for '{k}': {e}"))?;
        request_builder = request_builder.header(header_name, header_value);
    }

    if let Some(body) = req.body {
        request_builder = request_builder.body(body);
    }

    let start = Instant::now();
    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    let latency_ms = start.elapsed().as_millis() as u64;
    let status = response.status().as_u16();
    let status_text = response
        .status()
        .canonical_reason()
        .unwrap_or("")
        .to_string();

    let mut headers = HashMap::new();
    let mut content_type = None;

    for (k, v) in response.headers() {
        let key_str = k.as_str().to_string();
        let val_str = v.to_str().unwrap_or("").to_string();
        if key_str.to_lowercase() == "content-type" {
            content_type = Some(val_str.clone());
        }
        headers.insert(key_str, val_str);
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response body: {e}"))?;

    let size_bytes = bytes.len();
    let body = String::from_utf8_lossy(&bytes).to_string();

    Ok(HttpResponseDto {
        status,
        status_text,
        headers,
        body,
        latency_ms,
        size_bytes,
        content_type,
    })
}

#[tauri::command]
pub fn http_parse_file(content: String) -> Result<Vec<HttpBlockDto>, String> {
    Ok(parse_http_file(&content))
}

#[tauri::command]
pub async fn http_execute_file_block(
    content: String,
    block_id: String,
) -> Result<HttpResponseDto, String> {
    let blocks = parse_http_file(&content);
    let block = blocks
        .into_iter()
        .find(|b| b.id == block_id)
        .ok_or_else(|| format!("HTTP request block with id '{block_id}' not found"))?;

    let req = HttpRequestDto {
        id: Some(block.id),
        method: block.method,
        url: block.url,
        headers: block.headers,
        body: block.body,
    };

    http_execute_request(req).await
}
