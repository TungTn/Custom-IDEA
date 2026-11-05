use ide_http::parser::parse_http_file;
use ide_http::{http_execute_request, HttpRequestDto};
use std::collections::HashMap;

#[test]
fn test_parse_http_file_multiple_blocks() {
    let content = r#"
### Get All Posts
GET https://jsonplaceholder.typicode.com/posts
Accept: application/json
User-Agent: Local-IDEA

### Create Post
POST https://jsonplaceholder.typicode.com/posts
Content-Type: application/json

{
  "title": "foo",
  "body": "bar",
  "userId": 1
}

### Simple Delete
DELETE https://jsonplaceholder.typicode.com/posts/1
"#;

    let blocks = parse_http_file(content);
    assert_eq!(blocks.len(), 3);

    // Block 1
    assert_eq!(blocks[0].name.as_deref(), Some("Get All Posts"));
    assert_eq!(blocks[0].method, "GET");
    assert_eq!(blocks[0].url, "https://jsonplaceholder.typicode.com/posts");
    assert_eq!(blocks[0].headers.get("Accept").map(String::as_str), Some("application/json"));
    assert!(blocks[0].body.is_none());

    // Block 2
    assert_eq!(blocks[1].name.as_deref(), Some("Create Post"));
    assert_eq!(blocks[1].method, "POST");
    assert_eq!(blocks[1].url, "https://jsonplaceholder.typicode.com/posts");
    assert_eq!(blocks[1].headers.get("Content-Type").map(String::as_str), Some("application/json"));
    assert!(blocks[1].body.is_some());
    let body = blocks[1].body.as_ref().unwrap();
    assert!(body.contains("\"title\": \"foo\""));

    // Block 3
    assert_eq!(blocks[2].name.as_deref(), Some("Simple Delete"));
    assert_eq!(blocks[2].method, "DELETE");
    assert_eq!(blocks[2].url, "https://jsonplaceholder.typicode.com/posts/1");
    assert!(blocks[2].body.is_none());
}

#[test]
fn test_parse_http_file_without_delimiter() {
    let content = r#"
GET https://api.example.com/v1/health
Authorization: Bearer token123
"#;

    let blocks = parse_http_file(content);
    assert_eq!(blocks.len(), 1);
    assert_eq!(blocks[0].method, "GET");
    assert_eq!(blocks[0].url, "https://api.example.com/v1/health");
    assert_eq!(blocks[0].headers.get("Authorization").map(String::as_str), Some("Bearer token123"));
}

#[tokio::test]
async fn test_http_execute_request_error() {
    let req = HttpRequestDto {
        id: Some("test".into()),
        method: "GET".into(),
        url: "http://127.0.0.1:59999/unreachable_non_existent".into(),
        headers: HashMap::new(),
        body: None,
    };

    let result = http_execute_request(req).await;
    assert!(result.is_err());
}
