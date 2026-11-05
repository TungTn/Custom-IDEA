use std::collections::HashMap;
use std::fs;
use std::path::Path;
use crate::types::{CoverageStatus, FileCoverageDto, LineCoverageDto};

pub fn parse_lcov(content: &str) -> HashMap<String, FileCoverageDto> {
    let mut result = HashMap::new();
    let mut current_file: Option<String> = None;
    let mut lines_map: HashMap<usize, u32> = HashMap::new();
    let mut lf = 0;
    let mut lh = 0;

    for raw_line in content.lines() {
        let line = raw_line.trim();
        if line.starts_with("SF:") {
            // Source file
            current_file = Some(line[3..].trim().replace('\\', "/"));
            lines_map.clear();
            lf = 0;
            lh = 0;
        } else if line.starts_with("DA:") {
            // Line execution: DA:<line number>,<execution count>
            let parts: Vec<&str> = line[3..].split(',').collect();
            if parts.len() >= 2 {
                if let (Ok(line_num), Ok(count)) = (parts[0].trim().parse::<usize>(), parts[1].trim().parse::<u32>()) {
                    lines_map.insert(line_num, count);
                }
            }
        } else if line.starts_with("LF:") {
            if let Ok(val) = line[3..].trim().parse::<usize>() {
                lf = val;
            }
        } else if line.starts_with("LH:") {
            if let Ok(val) = line[3..].trim().parse::<usize>() {
                lh = val;
            }
        } else if line == "end_of_record" {
            if let Some(file_path) = current_file.take() {
                let mut line_details = Vec::new();
                let mut calc_lf = 0;
                let mut calc_lh = 0;

                for (&line_num, &hits) in &lines_map {
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

                let final_lf = if lf > 0 { lf } else { calc_lf };
                let final_lh = if lh > 0 { lh } else { calc_lh };
                let percent = if final_lf > 0 {
                    (final_lh as f32 / final_lf as f32) * 100.0
                } else {
                    100.0
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
        }
    }

    result
}

pub fn parse_file(file_path: &Path) -> Result<HashMap<String, FileCoverageDto>, String> {
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read coverage file {}: {}", file_path.display(), e))?;

    let name = file_path.file_name().and_then(|f| f.to_str()).unwrap_or("").to_lowercase();
    if name.ends_with(".info") || name.ends_with(".lcov") || content.starts_with("TN:") || content.contains("SF:") {
        Ok(parse_lcov(&content))
    } else {
        // Fallback try LCOV format
        Ok(parse_lcov(&content))
    }
}
