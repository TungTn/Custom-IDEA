use crate::models::HttpBlockDto;
use std::collections::HashMap;

pub fn parse_http_file(content: &str) -> Vec<HttpBlockDto> {
    let mut blocks = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() {
        return blocks;
    }

    let mut current_start = 0;
    let mut current_name: Option<String> = None;
    let mut current_lines: Vec<(usize, &str)> = Vec::new();

    let flush_block = |blocks: &mut Vec<HttpBlockDto>,
                       name: Option<String>,
                       raw_lines: &[(usize, &str)],
                       block_idx: usize| {
        if raw_lines.is_empty() {
            return;
        }

        let start_line = raw_lines.first().map(|(n, _)| *n).unwrap_or(1);
        let end_line = raw_lines.last().map(|(n, _)| *n).unwrap_or(start_line);

        // Find request line (skip comments & blank lines)
        let mut req_line_idx = None;
        for (idx, &(_, line)) in raw_lines.iter().enumerate() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with("//") {
                continue;
            }
            req_line_idx = Some(idx);
            break;
        }

        let req_line_idx = match req_line_idx {
            Some(i) => i,
            None => return, // No executable request in this block
        };

        let req_line = raw_lines[req_line_idx].1.trim();
        let parts: Vec<&str> = req_line.split_whitespace().collect();
        if parts.is_empty() {
            return;
        }

        let (method, url) = if parts.len() >= 2 {
            let m = parts[0].to_uppercase();
            if is_http_method(&m) {
                (m, parts[1].to_string())
            } else if parts[0].starts_with("http://") || parts[0].starts_with("https://") {
                ("GET".to_string(), parts[0].to_string())
            } else {
                ("GET".to_string(), parts[0].to_string())
            }
        } else {
            let p = parts[0];
            if p.starts_with("http://") || p.starts_with("https://") {
                ("GET".to_string(), p.to_string())
            } else {
                ("GET".to_string(), p.to_string())
            }
        };

        // Parse headers until empty line
        let mut headers = HashMap::new();
        let mut body_start_idx = None;

        for idx in (req_line_idx + 1)..raw_lines.len() {
            let line = raw_lines[idx].1;
            let trimmed = line.trim();

            if trimmed.is_empty() {
                // Header section ends
                body_start_idx = Some(idx + 1);
                break;
            }

            if trimmed.starts_with('#') || trimmed.starts_with("//") {
                continue;
            }

            if let Some(colon_pos) = line.find(':') {
                let key = line[..colon_pos].trim().to_string();
                let value = line[colon_pos + 1..].trim().to_string();
                if !key.is_empty() {
                    headers.insert(key, value);
                }
            }
        }

        // Parse body
        let body = if let Some(b_idx) = body_start_idx {
            if b_idx < raw_lines.len() {
                let body_lines: Vec<&str> = raw_lines[b_idx..].iter().map(|(_, l)| *l).collect();
                let joined = body_lines.join("\n").trim().to_string();
                if joined.is_empty() {
                    None
                } else {
                    Some(joined)
                }
            } else {
                None
            }
        } else {
            None
        };

        let block_id = format!("req_{}_{}", block_idx + 1, start_line);

        blocks.push(HttpBlockDto {
            id: block_id,
            name,
            method,
            url,
            headers,
            body,
            start_line,
            end_line,
        });
    };

    let mut block_idx = 0;
    for (i, line) in lines.iter().enumerate() {
        let line_num = i + 1;
        let trimmed = line.trim();

        if trimmed.starts_with("###") {
            // Flush existing block
            flush_block(&mut blocks, current_name.take(), &current_lines, block_idx);
            current_lines.clear();
            block_idx += 1;

            // Optional title after ###
            let rest = trimmed.trim_start_matches('#').trim();
            if !rest.is_empty() {
                current_name = Some(rest.to_string());
            }
            current_start = line_num;
        } else {
            if current_lines.is_empty() && current_start == 0 {
                current_start = line_num;
            }
            current_lines.push((line_num, line));
        }
    }

    // Flush last block
    flush_block(&mut blocks, current_name, &current_lines, block_idx);

    blocks
}

fn is_http_method(s: &str) -> bool {
    matches!(
        s,
        "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS" | "TRACE" | "CONNECT"
    )
}
