use std::collections::HashMap;
use std::fs;
use std::path::Path;
use crate::types::{CoverageStatus, FileCoverageDto, LineCoverageDto};

fn merge_line_hits(
    result: &mut HashMap<String, FileCoverageDto>,
    file_path: String,
    lines_map: &HashMap<usize, u32>,
    explicit_counts: Option<(usize, usize)>,
) {
    let mut merged_hits: HashMap<usize, u32> = HashMap::new();
    if let Some(existing) = result.get(&file_path) {
        for ld in &existing.line_details {
            merged_hits.insert(ld.line_number, ld.hits);
        }
    }
    for (&line_num, &hits) in lines_map {
        merged_hits
            .entry(line_num)
            .and_modify(|h| *h = (*h).saturating_add(hits))
            .or_insert(hits);
    }

    let mut line_details = Vec::with_capacity(merged_hits.len());
    let mut calc_lf = 0usize;
    let mut calc_lh = 0usize;

    for (&line_num, &hits) in &merged_hits {
        calc_lf += 1;
        let status = if hits > 0 {
            calc_lh += 1;
            CoverageStatus::Covered
        } else {
            CoverageStatus::Uncovered
        };
        line_details.push(LineCoverageDto {
            line_number: line_num,
            hits,
            status,
        });
    }
    line_details.sort_by_key(|k| k.line_number);

    let (final_lf, final_lh) = match explicit_counts {
        // Only apply explicit LF/LH when this is a standalone LCOV block without prior merge
        Some((lf, lh)) if !result.contains_key(&file_path) && lf > 0 => (lf, lh),
        _ => (calc_lf, calc_lh),
    };
    let percent = if final_lf > 0 {
        (final_lh as f32 / final_lf as f32) * 100.0
    } else {
        0.0
    };

    result.insert(
        file_path.clone(),
        FileCoverageDto {
            file_path,
            lines_found: final_lf,
            lines_hit: final_lh,
            coverage_percent: (percent * 10.0).round() / 10.0,
            line_details,
        },
    );
}

pub fn parse_lcov(content: &str) -> HashMap<String, FileCoverageDto> {
    let mut result = HashMap::new();
    let mut current_file: Option<String> = None;
    let mut lines_map: HashMap<usize, u32> = HashMap::new();
    let mut lf = 0usize;
    let mut lh = 0usize;

    let flush_current = |current_file: &mut Option<String>,
                         lines_map: &mut HashMap<usize, u32>,
                         lf: &mut usize,
                         lh: &mut usize,
                         result: &mut HashMap<String, FileCoverageDto>| {
        if let Some(file_path) = current_file.take() {
            merge_line_hits(result, file_path, lines_map, Some((*lf, *lh)));
        }
        lines_map.clear();
        *lf = 0;
        *lh = 0;
    };

    for raw_line in content.lines() {
        let line = raw_line.trim();
        if let Some(rest) = line.strip_prefix("SF:") {
            // Flush prior record if a new SF: starts without an explicit end_of_record
            flush_current(&mut current_file, &mut lines_map, &mut lf, &mut lh, &mut result);
            current_file = Some(rest.trim().replace('\\', "/"));
        } else if let Some(rest) = line.strip_prefix("DA:") {
            let parts: Vec<&str> = rest.split(',').collect();
            if parts.len() >= 2 {
                if let (Ok(line_num), Ok(count)) = (
                    parts[0].trim().parse::<usize>(),
                    parts[1].trim().parse::<u32>(),
                ) {
                    lines_map
                        .entry(line_num)
                        .and_modify(|h| *h = (*h).saturating_add(count))
                        .or_insert(count);
                }
            }
        } else if let Some(rest) = line.strip_prefix("LF:") {
            if let Ok(val) = rest.trim().parse::<usize>() {
                lf = val;
            }
        } else if let Some(rest) = line.strip_prefix("LH:") {
            if let Ok(val) = rest.trim().parse::<usize>() {
                lh = val;
            }
        } else if line == "end_of_record" {
            flush_current(&mut current_file, &mut lines_map, &mut lf, &mut lh, &mut result);
        }
    }

    // Flush trailing record at EOF even if `end_of_record` was omitted
    flush_current(&mut current_file, &mut lines_map, &mut lf, &mut lh, &mut result);

    result
}

fn next_xml_tag(xml: &str, mut pos: usize) -> Option<(usize, &str)> {
    let bytes = xml.as_bytes();
    while pos < bytes.len() {
        let rel_open = xml[pos..].find('<')?;
        let start = pos + rel_open;
        if xml[start..].starts_with("<!--") {
            if let Some(end_c) = xml[start + 4..].find("-->") {
                pos = start + 4 + end_c + 3;
                continue;
            }
            return None;
        }
        if xml[start..].starts_with("<![CDATA[") {
            if let Some(end_cd) = xml[start + 9..].find("]]>") {
                pos = start + 9 + end_cd + 3;
                continue;
            }
            return None;
        }
        // Find matching '>' outside attribute quotes
        let mut i = start + 1;
        let mut quote: Option<u8> = None;
        while i < bytes.len() {
            let b = bytes[i];
            if let Some(q) = quote {
                if b == q {
                    quote = None;
                }
            } else if b == b'"' || b == b'\'' {
                quote = Some(b);
            } else if b == b'>' {
                return Some((i + 1, &xml[start + 1..i]));
            }
            i += 1;
        }
        return None;
    }
    None
}

fn extract_xml_attr(tag_inner: &str, attr_name: &str) -> Option<String> {
    let bytes = tag_inner.as_bytes();
    let mut i = 0;
    // Skip tag name
    while i < bytes.len() && !bytes[i].is_ascii_whitespace() {
        i += 1;
    }
    while i < bytes.len() {
        while i < bytes.len() && bytes[i].is_ascii_whitespace() {
            i += 1;
        }
        if i >= bytes.len() || bytes[i] == b'/' {
            break;
        }
        let name_start = i;
        while i < bytes.len() && !bytes[i].is_ascii_whitespace() && bytes[i] != b'=' && bytes[i] != b'/' {
            i += 1;
        }
        let name = &tag_inner[name_start..i];
        while i < bytes.len() && bytes[i].is_ascii_whitespace() {
            i += 1;
        }
        if i < bytes.len() && bytes[i] == b'=' {
            i += 1;
            while i < bytes.len() && bytes[i].is_ascii_whitespace() {
                i += 1;
            }
            if i < bytes.len() && (bytes[i] == b'"' || bytes[i] == b'\'') {
                let q = bytes[i];
                i += 1;
                let val_start = i;
                while i < bytes.len() && bytes[i] != q {
                    i += 1;
                }
                let val = &tag_inner[val_start..i];
                if i < bytes.len() {
                    i += 1;
                }
                if name == attr_name {
                    return Some(val.to_string());
                }
            }
        }
    }
    None
}

fn xml_tag_name(tag_inner: &str) -> (&str, bool, bool) {
    let trimmed = tag_inner.trim();
    if let Some(rest) = trimmed.strip_prefix('/') {
        let name = rest.split(|c: char| c.is_ascii_whitespace()).next().unwrap_or("");
        return (name, true, false);
    }
    if trimmed.starts_with('?') || trimmed.starts_with('!') {
        return ("", false, true);
    }
    let self_closing = trimmed.ends_with('/');
    let name = trimmed
        .trim_end_matches('/')
        .split(|c: char| c.is_ascii_whitespace())
        .next()
        .unwrap_or("");
    (name, false, self_closing)
}

pub fn parse_jacoco(content: &str) -> HashMap<String, FileCoverageDto> {
    let mut result = HashMap::new();
    let mut pos = 0usize;
    let mut current_package = String::new();
    let mut current_file: Option<String> = None;
    let mut lines_map: HashMap<usize, u32> = HashMap::new();

    while let Some((next_pos, tag_inner)) = next_xml_tag(content, pos) {
        pos = next_pos;
        let (tag_name, is_close, is_self_closing) = xml_tag_name(tag_inner);
        match (tag_name, is_close) {
            ("package", false) => {
                if !is_self_closing {
                    current_package = extract_xml_attr(tag_inner, "name")
                        .unwrap_or_default()
                        .replace('\\', "/")
                        .trim_matches('/')
                        .to_string();
                }
            }
            ("package", true) => {
                if let Some(fp) = current_file.take() {
                    merge_line_hits(&mut result, fp, &lines_map, None);
                    lines_map.clear();
                }
                current_package.clear();
            }
            ("sourcefile", false) => {
                if let Some(fp) = current_file.take() {
                    merge_line_hits(&mut result, fp, &lines_map, None);
                    lines_map.clear();
                }
                if let Some(sf_name) = extract_xml_attr(tag_inner, "name") {
                    let clean_sf = sf_name.replace('\\', "/").trim_start_matches('/').to_string();
                    let full_path = if current_package.is_empty() {
                        clean_sf
                    } else {
                        format!("{}/{}", current_package, clean_sf)
                    };
                    if is_self_closing {
                        merge_line_hits(&mut result, full_path, &HashMap::new(), None);
                    } else {
                        current_file = Some(full_path);
                    }
                }
            }
            ("sourcefile", true) => {
                if let Some(fp) = current_file.take() {
                    merge_line_hits(&mut result, fp, &lines_map, None);
                    lines_map.clear();
                }
            }
            ("line", false) => {
                if current_file.is_some() {
                    if let Some(nr_str) = extract_xml_attr(tag_inner, "nr") {
                        if let Ok(line_num) = nr_str.trim().parse::<usize>() {
                            let ci = extract_xml_attr(tag_inner, "ci")
                                .and_then(|s| s.trim().parse::<u32>().ok())
                                .unwrap_or(0);
                            lines_map
                                .entry(line_num)
                                .and_modify(|h| *h = (*h).saturating_add(ci))
                                .or_insert(ci);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    if let Some(fp) = current_file.take() {
        merge_line_hits(&mut result, fp, &lines_map, None);
    }

    result
}

pub fn parse_cobertura(content: &str) -> HashMap<String, FileCoverageDto> {
    let mut result = HashMap::new();
    let mut pos = 0usize;
    let mut current_file: Option<String> = None;
    let mut lines_map: HashMap<usize, u32> = HashMap::new();
    let mut methods_depth: usize = 0;

    while let Some((next_pos, tag_inner)) = next_xml_tag(content, pos) {
        pos = next_pos;
        let (tag_name, is_close, is_self_closing) = xml_tag_name(tag_inner);
        match (tag_name, is_close) {
            ("methods", false) => {
                if !is_self_closing {
                    methods_depth += 1;
                }
            }
            ("methods", true) => {
                methods_depth = methods_depth.saturating_sub(1);
            }
            ("class", false) => {
                if let Some(fp) = current_file.take() {
                    merge_line_hits(&mut result, fp, &lines_map, None);
                    lines_map.clear();
                }
                if let Some(filename) = extract_xml_attr(tag_inner, "filename") {
                    let clean = filename.trim().replace('\\', "/");
                    if !clean.is_empty() {
                        if is_self_closing {
                            merge_line_hits(&mut result, clean, &HashMap::new(), None);
                        } else {
                            current_file = Some(clean);
                        }
                    }
                }
            }
            ("class", true) => {
                if let Some(fp) = current_file.take() {
                    merge_line_hits(&mut result, fp, &lines_map, None);
                    lines_map.clear();
                }
            }
            ("line", false) => {
                // Ignore duplicate `<line>` elements inside nested `<methods>` blocks
                if methods_depth == 0 && current_file.is_some() {
                    if let Some(num_str) = extract_xml_attr(tag_inner, "number") {
                        if let Ok(line_num) = num_str.trim().parse::<usize>() {
                            let hits = extract_xml_attr(tag_inner, "hits")
                                .and_then(|s| s.trim().parse::<u32>().ok())
                                .unwrap_or(0);
                            lines_map
                                .entry(line_num)
                                .and_modify(|h| *h = (*h).saturating_add(hits))
                                .or_insert(hits);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    if let Some(fp) = current_file.take() {
        merge_line_hits(&mut result, fp, &lines_map, None);
    }

    result
}

pub fn parse_file(file_path: &Path) -> Result<HashMap<String, FileCoverageDto>, String> {
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read coverage file {}: {}", file_path.display(), e))?;

    let name = file_path.file_name().and_then(|f| f.to_str()).unwrap_or("").to_lowercase();
    if name.ends_with(".info") || name.ends_with(".lcov") || content.starts_with("TN:") || content.contains("SF:") {
        Ok(parse_lcov(&content))
    } else if name.contains("jacoco") || content.contains("<sourcefile") {
        Ok(parse_jacoco(&content))
    } else if name.contains("cobertura") || (content.contains("<coverage") && content.contains("<class")) {
        Ok(parse_cobertura(&content))
    } else if content.trim_start().starts_with('<') {
        Err(format!("Unsupported XML coverage report format: {}", file_path.display()))
    } else {
        Ok(parse_lcov(&content))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_jacoco_and_cobertura_without_methods_double_count() {
        let jacoco = r#"<?xml version="1.0"?>
<report name="demo">
  <package name="com/example">
    <sourcefile name="Main.java">
      <line nr="10" mi="0" ci="3"/>
      <line nr="11" mi="2" ci="0"/>
    </sourcefile>
    <sourcefile name="Empty.java"/>
  </package>
</report>"#;
        let parsed_j = parse_jacoco(jacoco);
        let main = parsed_j.get("com/example/Main.java").unwrap();
        assert_eq!(main.lines_found, 2);
        assert_eq!(main.lines_hit, 1);
        assert_eq!(main.coverage_percent, 50.0);
        let empty = parsed_j.get("com/example/Empty.java").unwrap();
        assert_eq!(empty.lines_found, 0);
        assert_eq!(empty.coverage_percent, 0.0);

        let cobertura = r#"<?xml version="1.0"?>
<coverage>
  <packages><package><classes>
    <class name="App" filename="src/app.py">
      <methods>
        <method name="run">
          <lines><line number="5" hits="1"/><line number="6" hits="0"/></lines>
        </method>
      </methods>
      <lines>
        <line number="5" hits="1"/>
        <line number="6" hits="0"/>
      </lines>
    </class>
  </classes></package></packages>
</coverage>"#;
        let parsed_c = parse_cobertura(cobertura);
        let app = parsed_c.get("src/app.py").unwrap();
        assert_eq!(app.lines_found, 2);
        assert_eq!(app.lines_hit, 1);
        assert_eq!(app.coverage_percent, 50.0);
    }

    #[test]
    fn test_parse_lcov_eof_flush_duplicate_merge_and_zero_lines() {
        let lcov = "\
SF:src/utils.ts
DA:1,2
DA:2,0
SF:src/utils.ts
DA:2,3
DA:3,0
SF:src/empty.ts";
        let parsed = parse_lcov(lcov);
        let utils = parsed.get("src/utils.ts").unwrap();
        assert_eq!(utils.lines_found, 3);
        assert_eq!(utils.lines_hit, 2);
        assert_eq!(utils.line_details.iter().find(|l| l.line_number == 2).unwrap().hits, 3);

        let empty = parsed.get("src/empty.ts").unwrap();
        assert_eq!(empty.lines_found, 0);
        assert_eq!(empty.lines_hit, 0);
        assert_eq!(empty.coverage_percent, 0.0);
    }
}
