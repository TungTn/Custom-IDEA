use std::path::Path;
use regex::Regex;
use std::sync::LazyLock;
use crate::types::{IndexedSymbol, SymbolKind};

static RUST_FN_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\s*(?:pub(?:\([^\)]+\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)").unwrap()
});
static RUST_STRUCT_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\s*(?:pub(?:\([^\)]+\))?\s+)?(?:struct|enum|trait)\s+([a-zA-Z0-9_]+)").unwrap()
});

static JS_TS_FN_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\s*(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)").unwrap()
});
static JS_TS_CLASS_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\s*(?:export\s+)?(?:class|interface|type|enum)\s+([a-zA-Z0-9_]+)").unwrap()
});
static JS_TS_CONST_FN_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\s*(?:export\s+)?(?:const|let)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>").unwrap()
});

static PY_DEF_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\s*(?:async\s+)?def\s+([a-zA-Z0-9_]+)").unwrap()
});
static PY_CLASS_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\s*class\s+([a-zA-Z0-9_]+)").unwrap()
});

static GO_FUNC_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\s*func\s+(?:\([^\)]+\)\s+)?([a-zA-Z0-9_]+)").unwrap()
});
static GO_TYPE_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\s*type\s+([a-zA-Z0-9_]+)\s+(?:struct|interface)").unwrap()
});

pub fn extract_symbols_from_content(
    file_path: &str,
    relative_path: &str,
    content: &str,
) -> Vec<IndexedSymbol> {
    let mut symbols = Vec::new();
    let ext = Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    for (idx, line) in content.lines().enumerate() {
        let line_num = idx + 1;
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("//") || trimmed.starts_with('#') || trimmed.starts_with("/*") {
            continue;
        }

        match ext.as_str() {
            "rs" => {
                if let Some(caps) = RUST_FN_RE.captures(line) {
                    if let Some(m) = caps.get(1) {
                        symbols.push(IndexedSymbol {
                            name: m.as_str().to_string(),
                            kind: SymbolKind::Function,
                            file_path: file_path.to_string(),
                            relative_path: relative_path.to_string(),
                            line_number: line_num,
                            column_number: m.start() + 1,
                            snippet: Some(trimmed.to_string()),
                        });
                    }
                } else if let Some(caps) = RUST_STRUCT_RE.captures(line) {
                    if let Some(m) = caps.get(1) {
                        let kind = if line.contains("enum ") {
                            SymbolKind::Enum
                        } else if line.contains("trait ") {
                            SymbolKind::Interface
                        } else {
                            SymbolKind::Struct
                        };
                        symbols.push(IndexedSymbol {
                            name: m.as_str().to_string(),
                            kind,
                            file_path: file_path.to_string(),
                            relative_path: relative_path.to_string(),
                            line_number: line_num,
                            column_number: m.start() + 1,
                            snippet: Some(trimmed.to_string()),
                        });
                    }
                }
            }
            "ts" | "tsx" | "js" | "jsx" => {
                if let Some(caps) = JS_TS_CLASS_RE.captures(line) {
                    if let Some(m) = caps.get(1) {
                        let kind = if line.contains("interface ") {
                            SymbolKind::Interface
                        } else if line.contains("enum ") {
                            SymbolKind::Enum
                        } else {
                            SymbolKind::Class
                        };
                        symbols.push(IndexedSymbol {
                            name: m.as_str().to_string(),
                            kind,
                            file_path: file_path.to_string(),
                            relative_path: relative_path.to_string(),
                            line_number: line_num,
                            column_number: m.start() + 1,
                            snippet: Some(trimmed.to_string()),
                        });
                    }
                } else if let Some(caps) = JS_TS_FN_RE.captures(line) {
                    if let Some(m) = caps.get(1) {
                        symbols.push(IndexedSymbol {
                            name: m.as_str().to_string(),
                            kind: SymbolKind::Function,
                            file_path: file_path.to_string(),
                            relative_path: relative_path.to_string(),
                            line_number: line_num,
                            column_number: m.start() + 1,
                            snippet: Some(trimmed.to_string()),
                        });
                    }
                } else if let Some(caps) = JS_TS_CONST_FN_RE.captures(line) {
                    if let Some(m) = caps.get(1) {
                        symbols.push(IndexedSymbol {
                            name: m.as_str().to_string(),
                            kind: SymbolKind::Function,
                            file_path: file_path.to_string(),
                            relative_path: relative_path.to_string(),
                            line_number: line_num,
                            column_number: m.start() + 1,
                            snippet: Some(trimmed.to_string()),
                        });
                    }
                }
            }
            "py" => {
                if let Some(caps) = PY_CLASS_RE.captures(line) {
                    if let Some(m) = caps.get(1) {
                        symbols.push(IndexedSymbol {
                            name: m.as_str().to_string(),
                            kind: SymbolKind::Class,
                            file_path: file_path.to_string(),
                            relative_path: relative_path.to_string(),
                            line_number: line_num,
                            column_number: m.start() + 1,
                            snippet: Some(trimmed.to_string()),
                        });
                    }
                } else if let Some(caps) = PY_DEF_RE.captures(line) {
                    if let Some(m) = caps.get(1) {
                        symbols.push(IndexedSymbol {
                            name: m.as_str().to_string(),
                            kind: SymbolKind::Function,
                            file_path: file_path.to_string(),
                            relative_path: relative_path.to_string(),
                            line_number: line_num,
                            column_number: m.start() + 1,
                            snippet: Some(trimmed.to_string()),
                        });
                    }
                }
            }
            "go" => {
                if let Some(caps) = GO_TYPE_RE.captures(line) {
                    if let Some(m) = caps.get(1) {
                        let kind = if line.contains("interface") {
                            SymbolKind::Interface
                        } else {
                            SymbolKind::Struct
                        };
                        symbols.push(IndexedSymbol {
                            name: m.as_str().to_string(),
                            kind,
                            file_path: file_path.to_string(),
                            relative_path: relative_path.to_string(),
                            line_number: line_num,
                            column_number: m.start() + 1,
                            snippet: Some(trimmed.to_string()),
                        });
                    }
                } else if let Some(caps) = GO_FUNC_RE.captures(line) {
                    if let Some(m) = caps.get(1) {
                        symbols.push(IndexedSymbol {
                            name: m.as_str().to_string(),
                            kind: SymbolKind::Function,
                            file_path: file_path.to_string(),
                            relative_path: relative_path.to_string(),
                            line_number: line_num,
                            column_number: m.start() + 1,
                            snippet: Some(trimmed.to_string()),
                        });
                    }
                }
            }
            _ => {}
        }
    }

    symbols
}
#[cfg(test)]
mod tests {
    use crate::symbols::extract_symbols_from_content;
    use crate::types::SymbolKind;

    #[test]
    fn test_extract_rust_symbols() {
        let code = r#"
            pub fn handle_action() {}
            pub async fn search_everywhere() {}
            pub struct SearchIndex {}
            pub enum AppEvent {}
            pub trait Tokenizer {}
        "#;
        let symbols = extract_symbols_from_content("main.rs", "src/main.rs", code);
        assert_eq!(symbols.len(), 5);
        assert_eq!(symbols[0].name, "handle_action");
        assert_eq!(symbols[0].kind, SymbolKind::Function);
        assert_eq!(symbols[1].name, "search_everywhere");
        assert_eq!(symbols[1].kind, SymbolKind::Function);
        assert_eq!(symbols[2].name, "SearchIndex");
        assert_eq!(symbols[2].kind, SymbolKind::Struct);
        assert_eq!(symbols[3].name, "AppEvent");
        assert_eq!(symbols[3].kind, SymbolKind::Enum);
        assert_eq!(symbols[4].name, "Tokenizer");
        assert_eq!(symbols[4].kind, SymbolKind::Interface);
    }

    #[test]
    fn test_extract_typescript_symbols() {
        let code = r#"
            export function processItem() {}
            export const calculateTotal = () => {}
            export class EditorEngine {}
            export interface TabProps {}
        "#;
        let symbols = extract_symbols_from_content("app.tsx", "src/app.tsx", code);
        assert_eq!(symbols.len(), 4);
        assert_eq!(symbols[0].name, "processItem");
        assert_eq!(symbols[1].name, "calculateTotal");
        assert_eq!(symbols[2].name, "EditorEngine");
        assert_eq!(symbols[2].kind, SymbolKind::Class);
        assert_eq!(symbols[3].name, "TabProps");
        assert_eq!(symbols[3].kind, SymbolKind::Interface);
    }
}
