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
    // Bind and immediately drop an ephemeral listener so the port is guaranteed unbound
    let addr = {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        listener.local_addr().unwrap()
    };
    let req = HttpRequestDto {
        id: Some("test".into()),
        method: "GET".into(),
        url: format!("http://{}/unreachable_non_existent", addr),
        headers: HashMap::new(),
        body: None,
    };

    let result = http_execute_request(req).await;
    assert!(result.is_err());

    let ftp_req = HttpRequestDto {
        id: Some("test_ftp".into()),
        method: "GET".into(),
        url: "ftp://example.com/file.txt".into(),
        headers: HashMap::new(),
        body: None,
    };
    assert!(http_execute_request(ftp_req).await.is_err());
}

#[tokio::test]
async fn test_http_execute_blocks_invalid_schemes() {
    let req = HttpRequestDto {
        id: Some("test_file".into()),
        method: "GET".into(),
        url: "file:///C:/Windows/System32/drivers/etc/hosts".into(),
        headers: HashMap::new(),
        body: None,
    };

    let result = http_execute_request(req).await;
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.contains("Unsupported URL scheme"));
}

#[tokio::test]
async fn test_http_execute_blocks_metadata_ip() {
    let req = HttpRequestDto {
        id: Some("test_meta".into()),
        method: "GET".into(),
        url: "http://169.254.169.254/latest/meta-data/".into(),
        headers: HashMap::new(),
        body: None,
    };

    let result = http_execute_request(req).await;
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.contains("cloud metadata"));
}

#[tokio::test]
async fn test_http_execute_local_roundtrip() {
    use std::io::{Read, Write};
    use std::net::TcpListener;

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();

    let server = std::thread::spawn(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut req_buf = [0u8; 1024];
            let _ = stream.read(&mut req_buf);
            let resp = b"HTTP/1.1 200 OK\r\nX-Test: local-ok\r\nContent-Type: text/plain\r\nContent-Length: 5\r\nConnection: close\r\n\r\nhello";
            let _ = stream.write_all(resp);
        }
    });

    let req = HttpRequestDto {
        id: Some("test_local".into()),
        method: "GET".into(),
        url: format!("http://{}/ping", addr),
        headers: HashMap::new(),
        body: None,
    };

    let res = http_execute_request(req).await.expect("local roundtrip should succeed");
    assert_eq!(res.status, 200);
    assert_eq!(res.body, "hello");
    assert_eq!(res.size_bytes, 5);
    assert_eq!(res.headers.get("x-test").map(String::as_str), Some("local-ok"));
    let _ = server.join();
}

#[tokio::test]
async fn test_http_execute_blocks_redirect_to_metadata_ip() {
    use std::io::{Read, Write};
    use std::net::TcpListener;

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();

    let server = std::thread::spawn(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut req_buf = [0u8; 1024];
            let _ = stream.read(&mut req_buf);
            let resp = b"HTTP/1.1 302 Found\r\nLocation: http://169.254.169.254/latest/meta-data/\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
            let _ = stream.write_all(resp);
        }
    });

    let req = HttpRequestDto {
        id: Some("test_redir_meta".into()),
        method: "GET".into(),
        url: format!("http://{}/redir", addr),
        headers: HashMap::new(),
        body: None,
    };

    let err = http_execute_request(req).await.unwrap_err();
    assert!(
        err.to_lowercase().contains("redirect") || err.contains("metadata"),
        "expected redirect SSRF block error, got: {}",
        err
    );
    let _ = server.join();
}

#[tokio::test]
async fn test_http_execute_rejects_oversized_response() {
    use std::io::{Read, Write};
    use std::net::TcpListener;

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();

    let server = std::thread::spawn(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut req_buf = [0u8; 1024];
            let _ = stream.read(&mut req_buf);
            let total_len = 16 * 1024 * 1024 + 4096;
            let header = format!(
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                total_len
            );
            if stream.write_all(header.as_bytes()).is_ok() {
                let chunk = vec![b'x'; 64 * 1024];
                let mut sent = 0;
                while sent < total_len {
                    let to_send = (total_len - sent).min(chunk.len());
                    if stream.write_all(&chunk[..to_send]).is_err() {
                        break;
                    }
                    sent += to_send;
                }
            }
        }
    });

    let req = HttpRequestDto {
        id: Some("test_oversized".into()),
        method: "GET".into(),
        url: format!("http://{}/huge", addr),
        headers: HashMap::new(),
        body: None,
    };

    let err = http_execute_request(req).await.unwrap_err();
    assert!(
        err.contains("Response body exceeded"),
        "expected size-limit error, got: {}",
        err
    );
    let _ = server.join();
}

#[test]
fn test_parse_http_file_unknown_method_and_markdown_body_edge_cases() {
    let content = "\
### Invalid Block Should Be Ignored
FOOBAR https://example.com/ignored

### Markdown Heading Inside Body
POST https://example.com/docs
Content-Type: text/markdown

Hello
### not a block split because previous line is not blank
World

### Second Request
GET https://example.com/second
";
    let blocks = parse_http_file(content);
    assert_eq!(blocks.len(), 2);
    assert_eq!(blocks[0].method, "POST");
    let body = blocks[0].body.as_deref().unwrap();
    assert!(body.contains("### not a block split"));
    assert_eq!(blocks[1].method, "GET");
    assert_eq!(blocks[1].url, "https://example.com/second");
}

#[tokio::test]
async fn test_http_execute_binary_and_multi_header_response() {
    use std::io::{Read, Write};
    use std::net::TcpListener;

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();

    let server = std::thread::spawn(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut req_buf = [0u8; 1024];
            let _ = stream.read(&mut req_buf);
            let mut resp = Vec::new();
            resp.extend_from_slice(
                b"HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nSet-Cookie: a=1\r\nSet-Cookie: b=2\r\nContent-Length: 4\r\nConnection: close\r\n\r\n",
            );
            resp.extend_from_slice(&[0xFF, 0x00, 0xFE, 0x41]);
            let _ = stream.write_all(&resp);
        }
    });

    let req = HttpRequestDto {
        id: Some("test_binary_multi_hdr".into()),
        method: "GET".into(),
        url: format!("http://{}/bin", addr),
        headers: HashMap::new(),
        body: None,
    };

    let res = http_execute_request(req).await.expect("binary response should succeed");
    assert_eq!(res.status, 200);
    assert_eq!(res.size_bytes, 4);
    let cookies = res.headers.get("set-cookie").map(String::as_str).unwrap_or("");
    assert!(cookies.contains("a=1") && cookies.contains("b=2"), "cookies={}", cookies);
    assert!(res.body.contains('\u{FFFD}') && res.body.ends_with('A'));
    let _ = server.join();
}
