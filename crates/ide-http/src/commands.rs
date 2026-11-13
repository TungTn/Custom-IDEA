use crate::models::{HttpBlockDto, HttpRequestDto, HttpResponseDto};
use crate::parser::parse_http_file;
use std::collections::HashMap;
use std::net::{IpAddr, ToSocketAddrs};
use std::str::FromStr;
use std::sync::LazyLock;
use std::time::Instant;

const MAX_HTTP_RESPONSE_BYTES: usize = 16 * 1024 * 1024; // 16 MiB

fn unwrap_ipv4_mapped(ip: IpAddr) -> IpAddr {
    match ip {
        IpAddr::V6(v6) => v6.to_ipv4_mapped().map(IpAddr::V4).unwrap_or(IpAddr::V6(v6)),
        IpAddr::V4(v4) => IpAddr::V4(v4),
    }
}

pub fn is_metadata_or_link_local_ip(ip: IpAddr) -> bool {
    match unwrap_ipv4_mapped(ip) {
        IpAddr::V4(v4) => {
            v4.is_link_local() || (v4.octets()[0] == 169 && v4.octets()[1] == 254)
        }
        IpAddr::V6(v6) => (v6.segments()[0] & 0xffc0) == 0xfe80,
    }
}

fn is_loopback_or_unspecified_ip(ip: IpAddr) -> bool {
    match unwrap_ipv4_mapped(ip) {
        IpAddr::V4(v4) => v4.is_loopback() || v4.is_unspecified(),
        IpAddr::V6(v6) => v6.is_loopback() || v6.is_unspecified(),
    }
}

fn is_private_or_ula_ip(ip: IpAddr) -> bool {
    match unwrap_ipv4_mapped(ip) {
        IpAddr::V4(v4) => v4.is_private() || v4.is_link_local(),
        IpAddr::V6(v6) => {
            let seg0 = v6.segments()[0];
            (seg0 & 0xfe00) == 0xfc00 || (seg0 & 0xffc0) == 0xfe80
        }
    }
}

fn strip_ipv6_brackets(host: &str) -> &str {
    let trimmed = host.trim();
    trimmed
        .strip_prefix('[')
        .and_then(|s| s.strip_suffix(']'))
        .unwrap_or(trimmed)
}

fn parse_url_ip(url: &reqwest::Url) -> Option<IpAddr> {
    let host_str = url.host_str()?;
    IpAddr::from_str(strip_ipv6_brackets(host_str)).ok()
}

fn is_loopback_hostname(host: &str) -> bool {
    let norm = strip_ipv6_brackets(host)
        .trim_end_matches('.')
        .to_ascii_lowercase();
    norm == "localhost" || norm.ends_with(".localhost")
}

pub fn is_loopback_host(host: &str) -> bool {
    if is_loopback_hostname(host) {
        return true;
    }
    if let Ok(ip) = IpAddr::from_str(strip_ipv6_brackets(host)) {
        return is_loopback_or_unspecified_ip(ip);
    }
    false
}

pub fn is_blocked_ssrf_resolved_ip(ip: IpAddr, allow_loopback: bool) -> bool {
    if is_metadata_or_link_local_ip(ip) || is_private_or_ula_ip(ip) {
        return true;
    }
    if allow_loopback && is_loopback_or_unspecified_ip(ip) {
        return false;
    }
    is_loopback_or_unspecified_ip(ip)
}

pub fn validate_initial_http_url(parsed_url: &reqwest::Url) -> Result<(), String> {
    if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
        return Err(format!(
            "Unsupported URL scheme '{}'. Only http and https are allowed.",
            parsed_url.scheme()
        ));
    }
    if let Some(ip) = parse_url_ip(parsed_url) {
        if is_metadata_or_link_local_ip(ip) {
            return Err("Requests to cloud metadata link-local address are blocked".to_string());
        }
    }
    Ok(())
}

fn validate_redirect_target(
    target_url: &reqwest::Url,
    previous: &[reqwest::Url],
) -> Result<(), &'static str> {
    if previous.len() >= 10 {
        return Err("Too many redirects (max 10)");
    }
    if target_url.scheme() != "http" && target_url.scheme() != "https" {
        return Err("Redirect to non-http/https scheme is blocked");
    }
    if let Some(ip) = parse_url_ip(target_url) {
        if is_metadata_or_link_local_ip(ip) {
            return Err("Redirect to link-local/cloud metadata address is blocked");
        }
        if is_private_or_ula_ip(ip) {
            return Err("Redirect to private or ULA network address is blocked (SSRF protection)");
        }
        if let Some(initial_url) = previous.first() {
            let initial_host = initial_url.host_str().unwrap_or("");
            if !is_loopback_host(initial_host) && is_loopback_or_unspecified_ip(ip) {
                return Err("Redirect from remote host to private/localhost address is blocked (SSRF protection)");
            }
        }
    } else if let Some(host) = target_url.host_str() {
        if let Some(initial_url) = previous.first() {
            let initial_host = initial_url.host_str().unwrap_or("");
            if !is_loopback_host(initial_host) && is_loopback_host(host) {
                return Err("Redirect from remote host to localhost is blocked (SSRF protection)");
            }
        }
    }
    Ok(())
}

struct SsrfSafeDnsResolver;

impl reqwest::dns::Resolve for SsrfSafeDnsResolver {
    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
        let host = name.as_str().to_string();
        Box::pin(async move {
            let allow_loopback = is_loopback_hostname(&host);
            let lookup_host = host.clone();
            let addrs = tokio::task::spawn_blocking(move || {
                (lookup_host.as_str(), 0)
                    .to_socket_addrs()
                    .map(|it| it.collect::<Vec<_>>())
            })
            .await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

            for addr in &addrs {
                if is_blocked_ssrf_resolved_ip(addr.ip(), allow_loopback) {
                    return Err(Box::new(std::io::Error::new(
                        std::io::ErrorKind::PermissionDenied,
                        format!(
                            "DNS resolution to restricted IP {} blocked (SSRF protection)",
                            addr.ip()
                        ),
                    )) as Box<dyn std::error::Error + Send + Sync>);
                }
            }
            let iter: reqwest::dns::Addrs = Box::new(addrs.into_iter());
            Ok(iter)
        })
    }
}

static HTTP_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    let redirect_policy = reqwest::redirect::Policy::custom(|attempt| {
        if let Err(msg) = validate_redirect_target(attempt.url(), attempt.previous()) {
            return attempt.error(msg);
        }
        attempt.follow()
    });

    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .dns_resolver(std::sync::Arc::new(SsrfSafeDnsResolver))
        .redirect(redirect_policy)
        .build()
        .expect("Failed to initialize static HTTP client")
});

#[tauri::command]
pub async fn http_execute_request(req: HttpRequestDto) -> Result<HttpResponseDto, String> {
    let parsed_url = reqwest::Url::parse(&req.url)
        .map_err(|e| format!("Invalid URL '{}': {e}", req.url))?;

    validate_initial_http_url(&parsed_url)?;

    let method = reqwest::Method::from_str(&req.method.to_uppercase())
        .map_err(|e| format!("Invalid HTTP method '{}': {e}", req.method))?;

    let mut request_builder = HTTP_CLIENT.request(method, parsed_url);

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
        let val_str = String::from_utf8_lossy(v.as_bytes()).into_owned();
        if key_str.eq_ignore_ascii_case("content-type") {
            content_type = Some(val_str.clone());
        }
        headers
            .entry(key_str)
            .and_modify(|existing: &mut String| {
                existing.push_str(", ");
                existing.push_str(&val_str);
            })
            .or_insert(val_str);
    }

    let mut mut_resp = response;
    let mut body_bytes = Vec::new();

    while let Some(chunk) = mut_resp
        .chunk()
        .await
        .map_err(|e| format!("Failed to read response body: {e}"))?
    {
        if body_bytes.len() + chunk.len() > MAX_HTTP_RESPONSE_BYTES {
            return Err("Response body exceeded maximum allowed limit of 16 MiB".to_string());
        }
        body_bytes.extend_from_slice(&chunk);
    }

    let size_bytes = body_bytes.len();
    let body = String::from_utf8_lossy(&body_bytes).to_string();

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_redirect_target_ssrf_and_schemes() {
        let remote = [reqwest::Url::parse("https://api.example.com/start").unwrap()];
        let local = [reqwest::Url::parse("http://127.0.0.1:8080/start").unwrap()];

        // Remote -> loopback blocked
        let to_local = reqwest::Url::parse("http://127.0.0.1:9000/secret").unwrap();
        let err = validate_redirect_target(&to_local, &remote).unwrap_err();
        assert!(
            err == "Redirect from remote host to localhost is blocked (SSRF protection)"
                || err == "Redirect from remote host to private/localhost address is blocked (SSRF protection)",
            "unexpected error: {}",
            err
        );
        let to_localhost = reqwest::Url::parse("http://localhost:3000/").unwrap();
        assert!(validate_redirect_target(&to_localhost, &remote).is_err());

        // Loopback -> loopback allowed (e.g. local test redirects)
        assert!(validate_redirect_target(&to_local, &local).is_ok());

        // Remote -> metadata IP blocked
        let to_meta = reqwest::Url::parse("http://169.254.169.254/latest/meta-data/").unwrap();
        assert!(validate_redirect_target(&to_meta, &remote).is_err());

        // Non-http/https schemes blocked
        let to_file = reqwest::Url::parse("file:///etc/passwd").unwrap();
        assert!(validate_redirect_target(&to_file, &local).is_err());
        let to_ftp = reqwest::Url::parse("ftp://example.com/a").unwrap();
        assert!(validate_redirect_target(&to_ftp, &local).is_err());

        // Hop cap enforced
        let ten_hops = vec![remote[0].clone(); 10];
        let to_remote = reqwest::Url::parse("https://cdn.example.com/next").unwrap();
        assert!(validate_redirect_target(&to_remote, &ten_hops).is_err());
    }

    #[test]
    fn test_ssrf_ipv6_mapped_and_localhost_subdomains() {
        use std::net::IpAddr;

        // IPv6-mapped IPv4 addresses must unwrap before SSRF evaluation
        let mapped_meta: IpAddr = "::ffff:169.254.169.254".parse().unwrap();
        assert!(is_metadata_or_link_local_ip(mapped_meta));
        assert!(is_blocked_ssrf_resolved_ip(mapped_meta, true));

        let mapped_loopback: IpAddr = "::ffff:127.0.0.1".parse().unwrap();
        assert!(is_blocked_ssrf_resolved_ip(mapped_loopback, false));
        assert!(!is_blocked_ssrf_resolved_ip(mapped_loopback, true));

        // Loopback hostname trailing dot & subdomains
        assert!(is_loopback_host("localhost."));
        assert!(is_loopback_host("sub.localhost"));
        assert!(is_loopback_host("[::ffff:127.0.0.1]"));
        assert!(!is_loopback_host("example.com"));

        // Public IP passes, private IP blocked
        let public_ip: IpAddr = "93.184.216.34".parse().unwrap();
        let private_ip: IpAddr = "10.0.0.5".parse().unwrap();
        assert!(!is_blocked_ssrf_resolved_ip(public_ip, false));
        assert!(is_blocked_ssrf_resolved_ip(private_ip, false));
    }
}
