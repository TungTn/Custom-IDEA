use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export)]
pub enum SymbolKind {
    Function,
    Method,
    Class,
    Struct,
    Interface,
    Enum,
    Variable,
    Constant,
    Property,
    Module,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct IndexedFile {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub is_folder: bool,
    pub extension: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct IndexedSymbol {
    pub name: String,
    pub kind: SymbolKind,
    pub file_path: String,
    pub relative_path: String,
    pub line_number: usize,
    pub column_number: usize,
    pub snippet: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SearchResultItem {
    pub id: String,
    pub title: String,
    pub subtitle: Option<String>,
    pub category: String, // "Files" | "Symbols" | "Actions" | "Text"
    pub file_path: Option<String>,
    pub line_number: Option<usize>,
    pub column_number: Option<usize>,
    pub snippet: Option<String>,
    pub symbol_kind: Option<SymbolKind>,
    pub score: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct IndexStatsDto {
    pub project_path: String,
    pub total_files: usize,
    pub total_symbols: usize,
    pub duration_ms: u64,
}
