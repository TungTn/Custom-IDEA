export interface AstSymbol {
  id: string;
  name: string;
  kind: 'class' | 'interface' | 'function' | 'method' | 'variable' | 'enum' | 'struct' | 'import';
  line: number;
  col: number;
  detail?: string;
  children?: AstSymbol[];
}

export interface StructuralMatch {
  id: string;
  filePath: string;
  line: number;
  snippet: string;
  captures: Record<string, string>;
}

export interface StructuralTemplate {
  id: string;
  title: string;
  pattern: string;
  description: string;
}

export const PRESET_STRUCTURAL_TEMPLATES: StructuralTemplate[] = [
  {
    id: 'try-catch',
    title: 'Try-Catch Statements',
    pattern: 'try { $body$ } catch ($err$) { $handler$ }',
    description: 'Find all error handling try-catch blocks',
  },
  {
    id: 'console-log',
    title: 'Console Log / Debug Prints',
    pattern: 'console.log($args$)',
    description: 'Find console debugging calls',
  },
  {
    id: 'async-await',
    title: 'Async Function Declarations',
    pattern: 'async function $name$($params$) { $body$ }',
    description: 'Find all async functions across codebase',
  },
  {
    id: 'react-use-effect',
    title: 'React useEffect Hooks',
    pattern: 'useEffect(() => { $effect$ }, [$deps$])',
    description: 'Find all React useEffect lifecycle hooks',
  },
  {
    id: 'if-statement',
    title: 'If Statements',
    pattern: 'if ($condition$) { $then$ }',
    description: 'Find conditional branching blocks',
  },
  {
    id: 'class-def',
    title: 'Class Declarations',
    pattern: 'class $name$ { $members$ }',
    description: 'Find object-oriented class definitions',
  },
];

class AstSearchService {
  /**
   * Extracts symbols from document text using deterministic lexical analysis
   */
  extractSymbols(content: string, fileName: string): AstSymbol[] {
    const lines = content.split('\n');
    const symbols: AstSymbol[] = [];

    const isRust = fileName.endsWith('.rs');
    const isJava = fileName.endsWith('.java');

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmed = lineText.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        return;
      }

      // 1. Classes / Interfaces / Structs
      const classMatch = lineText.match(/(?:export\s+)?(?:default\s+)?(?:abstract\s+)?(?:public|private)?\s*(class|interface|struct|enum|trait|impl)\s+([A-Za-z0-9_]+)/);
      if (classMatch) {
        symbols.push({
          id: `sym-${lineNum}-${classMatch[2]}`,
          name: classMatch[2],
          kind: classMatch[1] === 'interface' ? 'interface' : classMatch[1] === 'struct' ? 'struct' : 'class',
          line: lineNum,
          col: lineText.indexOf(classMatch[2]),
          detail: lineText.trim().replace(/\s*\{$/, ''),
        });
        return;
      }

      // 2. Functions (async, fn, function, def)
      const funcMatch = lineText.match(/(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|fn|def|func)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
      if (funcMatch) {
        symbols.push({
          id: `sym-${lineNum}-${funcMatch[1]}`,
          name: funcMatch[1],
          kind: 'function',
          line: lineNum,
          col: lineText.indexOf(funcMatch[1]),
          detail: `(${funcMatch[2].trim()})`,
        });
        return;
      }

      // 3. Arrow functions or const methods
      const arrowMatch = lineText.match(/(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^{]+)?\s*=>/);
      if (arrowMatch) {
        symbols.push({
          id: `sym-${lineNum}-${arrowMatch[1]}`,
          name: arrowMatch[1],
          kind: 'function',
          line: lineNum,
          col: lineText.indexOf(arrowMatch[1]),
          detail: `(${arrowMatch[2].trim()}) =>`,
        });
        return;
      }

      // 4. Methods inside classes
      const methodMatch = lineText.match(/^\s*(?:public|private|protected|static|async)?\s*([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\s*\{?$/);
      if (methodMatch && !trimmed.startsWith('if') && !trimmed.startsWith('for') && !trimmed.startsWith('while') && !trimmed.startsWith('switch')) {
        symbols.push({
          id: `sym-${lineNum}-${methodMatch[1]}`,
          name: methodMatch[1],
          kind: 'method',
          line: lineNum,
          col: lineText.indexOf(methodMatch[1]),
          detail: `(${methodMatch[2].trim()})`,
        });
        return;
      }

      // 5. Imports
      if (trimmed.startsWith('import ') || trimmed.startsWith('use ') || trimmed.startsWith('require(')) {
        const importName = trimmed.length > 40 ? trimmed.slice(0, 38) + '...' : trimmed;
        symbols.push({
          id: `sym-${lineNum}-import`,
          name: importName,
          kind: 'import',
          line: lineNum,
          col: 0,
        });
      }
    });

    return symbols;
  }

  /**
   * Performs structural pattern matching against source code.
   * Converts a template with variables like `$args$` or `$name$` into a structural regex.
   */
  searchStructural(
    content: string,
    filePath: string,
    pattern: string
  ): StructuralMatch[] {
    if (!pattern.trim()) return [];

    const matches: StructuralMatch[] = [];
    const lines = content.split('\n');

    // Extract placeholders $variable$
    const placeholderRegex = /\$([A-Za-z0-9_]+)\$/g;
    const placeholders: string[] = [];
    let pMatch;
    while ((pMatch = placeholderRegex.exec(pattern)) !== null) {
      if (!placeholders.includes(pMatch[1])) {
        placeholders.push(pMatch[1]);
      }
    }

    // Escape regex characters outside of placeholders
    let escapedRegexStr = pattern
      .replace(/[.+*?^}{()[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+');

    // Replace $var$ with capture group ([\s\S]*?)
    placeholders.forEach((ph) => {
      escapedRegexStr = escapedRegexStr.split(`\\$${ph}\\$`).join(`(?<${ph}>[\\s\\S]*?)`);
    });

    try {
      const regex = new RegExp(escapedRegexStr, 'g');
      let m;
      while ((m = regex.exec(content)) !== null) {
        const matchIndex = m.index;
        // Determine line number
        const preText = content.slice(0, matchIndex);
        const lineNum = preText.split('\n').length;
        const lineSnippet = lines[lineNum - 1] || m[0].split('\n')[0];

        const captures: Record<string, string> = {};
        if (m.groups) {
          for (const key in m.groups) {
            captures[key] = m.groups[key]?.trim() || '';
          }
        }

        matches.push({
          id: `match-${lineNum}-${matchIndex}`,
          filePath,
          line: lineNum,
          snippet: lineSnippet.trim(),
          captures,
        });

        // Prevent infinite loops on zero-length matches
        if (regex.lastIndex === matchIndex) {
          regex.lastIndex++;
        }
      }
    } catch (e) {
      // Regex compilation fallback (e.g. invalid syntax)
      console.warn('Structural pattern parse error:', e);
    }

    return matches;
  }
}

export const astSearchService = new AstSearchService();
