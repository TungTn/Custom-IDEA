pub mod types;
pub mod parser;
pub mod commands;

pub use types::*;
pub use parser::*;
pub use commands::*;

#[cfg(test)]
mod tests {
    use crate::parser::parse_lcov;
    use crate::types::CoverageStatus;

    #[test]
    fn test_parse_lcov_sample() {
        let sample = r#"
TN:
SF:src/utils.ts
DA:1,3
DA:2,3
DA:3,0
DA:5,1
LF:4
LH:3
end_of_record
"#;
        let map = parse_lcov(sample);
        assert_eq!(map.len(), 1);
        let file = map.get("src/utils.ts").expect("Found file");
        assert_eq!(file.lines_found, 4);
        assert_eq!(file.lines_hit, 3);
        assert_eq!(file.coverage_percent, 75.0);

        let details = &file.line_details;
        assert_eq!(details.len(), 4);
        assert_eq!(details[0].line_number, 1);
        assert_eq!(details[0].hits, 3);
        assert_eq!(details[0].status, CoverageStatus::Covered);

        assert_eq!(details[2].line_number, 3);
        assert_eq!(details[2].hits, 0);
        assert_eq!(details[2].status, CoverageStatus::Uncovered);
    }
}
