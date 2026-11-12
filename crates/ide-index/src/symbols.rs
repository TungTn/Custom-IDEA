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

static JAVA_CLASS_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\s*(?:public|protected|private)?\s*(?:abstract|final|sealed|non-sealed)?\s*(?:class|interface|enum|record)\s+([a-zA-Z0-9_]+)").unwrap()
});
static JAVA_FIELD_CONST_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\s*(?:public|protected|private)\s+(?:static\s+)?(?:final\s+)?[a-zA-Z0-9_<>\[\]]+\s+([a-zA-Z0-9_]+)\s*(?:=|;)").unwrap()
});
static JAVA_METHOD_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\s*(?:public|protected|private)\s+(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:<[^>]+>\s+)?[a-zA-Z0-9_<>\[\],\s]+\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?:throws\s+[^{;]+)?\s*[\{;]").unwrap()
});

fn strip_trailing_line_comment(s: &str) -> &str {
    let bytes = s.as_bytes();
    let mut quote: Option<u8> = None;
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        if let Some(q) = quote {
            if b == b'\\' {
                i += 2;
                continue;
            }
            if b == q {
                quote = None;
            }
        } else if b == b'"' || b == b'\'' {
            quote = Some(b);
        } else if b == b'/' && i + 1 < bytes.len() && bytes[i + 1] == b'/' {
            return &s[..i];
        }
        i += 1;
    }
    s
}

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

    let is_c_family = matches!(ext.as_str(), "rs" | "ts" | "tsx" | "js" | "jsx" | "java" | "go" | "cs");
    let mut in_block_comment = false;

    for (idx, line) in content.lines().enumerate() {
        let line_num = idx + 1;
        let trimmed = line.trim();

        let line_to_parse = if is_c_family {
            if in_block_comment {
                if let Some(pos) = trimmed.find("*/") {
                    in_block_comment = false;
                    trimmed[pos + 2..].trim()
                } else {
                    continue;
                }
            } else if trimmed.starts_with("/*") {
                if let Some(pos) = trimmed.find("*/") {
                    trimmed[pos + 2..].trim()
                } else {
                    in_block_comment = true;
                    continue;
                }
            } else {
                trimmed
            }
        } else {
            trimmed
        };

        if line_to_parse.is_empty() || line_to_parse.starts_with("//") || line_to_parse.starts_with('#') {
            continue;
        }

        let base_eval = if line_to_parse != trimmed { line_to_parse } else { line };
        let eval_line = if is_c_family {
            strip_trailing_line_comment(base_eval)
        } else {
            base_eval
        };
        if eval_line.trim().is_empty() {
            continue;
        }

        match ext.as_str() {
            "rs" => {
                if let Some(caps) = RUST_FN_RE.captures(eval_line) {
                    if let Some(m) = caps.get(1) {
                        symbols.push(IndexedSymbol {
                            name: m.as_str().to_string(),
                            kind: SymbolKind::Function,
                            file_path: file_path.to_string(),
                            relative_path: relative_path.to_string(),
                            line_number: line_num,
                            column_number: m.start() + 1,
                            snippet: Some(eval_line.to_string()),
                        });
                    }
                } else if let Some(caps) = RUST_STRUCT_RE.captures(eval_line) {
                    if let Some(m) = caps.get(1) {
                        let kind = if eval_line.contains("enum ") {
                            SymbolKind::Enum
                        } else if eval_line.contains("trait ") {
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
                            snippet: Some(eval_line.to_string()),
                        });
                    }
                }
            }
            "ts" | "tsx" | "js" | "jsx" | "vue" => {
                if let Some(caps) = JS_TS_CLASS_RE.captures(eval_line) {
                    if let Some(m) = caps.get(1) {
                        let kind = if eval_line.contains("interface ") {
                            SymbolKind::Interface
                        } else if eval_line.contains("enum ") {
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
                } else if let Some(caps) = JS_TS_FN_RE.captures(eval_line) {
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
                } else if let Some(caps) = JS_TS_CONST_FN_RE.captures(eval_line) {
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
                if let Some(caps) = GO_TYPE_RE.captures(eval_line) {
                    if let Some(m) = caps.get(1) {
                        let kind = if eval_line.contains("interface") {
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
                } else if let Some(caps) = GO_FUNC_RE.captures(eval_line) {
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
            "java" | "kt" | "cs" => {
                if let Some(caps) = JAVA_CLASS_RE.captures(eval_line) {
                    if let Some(m) = caps.get(1) {
                        let kind = if eval_line.contains("interface ") {
                            SymbolKind::Interface
                        } else if eval_line.contains("enum ") {
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
                } else if let Some(caps) = JAVA_FIELD_CONST_RE.captures(eval_line) {
                    if let Some(m) = caps.get(1) {
                        let kind = if eval_line.contains("final ") {
                            SymbolKind::Constant
                        } else {
                            SymbolKind::Property
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
                } else if let Some(caps) = JAVA_METHOD_RE.captures(eval_line) {
                    if let Some(m) = caps.get(1) {
                        symbols.push(IndexedSymbol {
                            name: m.as_str().to_string(),
                            kind: SymbolKind::Method,
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

    #[test]
    fn test_comments_block_and_trailing() {
        let code = r#"
/*
 * pub fn commented_out() {}
 * pub struct FakeStruct {}
 */
/* note */ pub fn after_comment() {}
pub struct Foo {} // enum FakeEnum {}
// pub fn line_commented() {}
"#;
        let symbols = extract_symbols_from_content("lib.rs", "src/lib.rs", code);
        let names: Vec<&str> = symbols.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(names, vec!["after_comment", "Foo"]);
        assert_eq!(symbols[0].kind, SymbolKind::Function);
        assert_eq!(symbols[1].kind, SymbolKind::Struct);

        let ts_code = "export class RealClass {} // interface FakeInterface {}\n";
        let ts_symbols = extract_symbols_from_content("app.ts", "src/app.ts", ts_code);
        assert_eq!(ts_symbols.len(), 1);
        assert_eq!(ts_symbols[0].name, "RealClass");
        assert_eq!(ts_symbols[0].kind, SymbolKind::Class);
    }
}
