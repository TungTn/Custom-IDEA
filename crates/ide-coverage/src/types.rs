use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export)]
pub enum CoverageStatus {
    Covered,
    Uncovered,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct LineCoverageDto {
    pub line_number: usize,
    pub hits: u32,
    pub status: CoverageStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FileCoverageDto {
    pub file_path: String,
    pub lines_found: usize,
    pub lines_hit: usize,
    pub coverage_percent: f32,
    pub line_details: Vec<LineCoverageDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct CoverageSummaryDto {
    pub report_file: String,
    pub total_files: usize,
    pub total_lines: usize,
    pub covered_lines: usize,
    pub coverage_percent: f32,
}
