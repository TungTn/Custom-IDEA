export interface StickyScope {
  line: number;
  kind: 'class' | 'function' | 'method' | 'struct' | 'interface' | 'namespace';
  text: string;
  signature: string;
}

/**
 * Extracts the enclosing class/function/method scopes for the line at the top of the viewport.
 * Traverses upwards tracking curly braces to determine which blocks wrap the given line.
 */
export function getEnclosingScopes(docText: string, topLine: number): StickyScope[] {
  if (topLine <= 2) return [];

  const lines = docText.split('\n');
  if (topLine > lines.length) return [];

  // Patterns for scopes across TS/JS, Java, Rust, Go, Python, C#
  const classRegex = /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?(?:public|private|protected)?\s*(?:class|struct|interface|trait|enum|impl|record)\s+([A-Za-z0-9_]+)/;
  const funcRegex = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|fn|def|func)\s+([A-Za-z0-9_]+)/;
  const methodRegex = /^\s*(?:public|private|protected|static|async|override|virtual)?\s*([A-Za-z0-9_]+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{?$/;
  const arrowFuncRegex = /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^{]+)?\s*=>/;

  const scopes: StickyScope[] = [];
  let braceBalance = 0;

  // Scan backwards from the line just above topLine towards the top
  for (let i = topLine - 1; i >= 0; i--) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    // Count braces in this line
    for (let charIdx = 0; charIdx < rawLine.length; charIdx++) {
      const c = rawLine[charIdx];
      if (c === '}') braceBalance++;
      else if (c === '{') braceBalance--;
    }

    // If braceBalance is negative, it means a block opened at or before this line that has NOT been closed
    if (braceBalance < 0) {
      // Check if this line is a recognizable scope definition
      let kind: StickyScope['kind'] | null = null;
      let name = '';

      const classMatch = rawLine.match(classRegex);
      if (classMatch) {
        kind = 'class';
        name = classMatch[0].trim().replace(/\s*\{$/, '');
      } else {
        const funcMatch = rawLine.match(funcRegex);
        if (funcMatch) {
          kind = 'function';
          name = funcMatch[0].trim().replace(/\s*\{$/, '');
        } else {
          const arrowMatch = rawLine.match(arrowFuncRegex);
          if (arrowMatch) {
            kind = 'function';
            name = arrowMatch[0].trim().replace(/\s*\{$/, '');
          } else {
            const methodMatch = rawLine.match(methodRegex);
            if (methodMatch && !trimmed.startsWith('if') && !trimmed.startsWith('for') && !trimmed.startsWith('while') && !trimmed.startsWith('switch')) {
              kind = 'method';
              name = methodMatch[0].trim().replace(/\s*\{$/, '');
            }
          }
        }
      }

      if (kind && name) {
        scopes.unshift({
          line: i + 1,
          kind,
          text: name,
          signature: name.length > 50 ? name.slice(0, 48) + '...' : name,
        });

        // Reset balance for the next outer enclosing scope
        braceBalance = 0;

        // Cap at 3 levels to maintain IDE vertical space
        if (scopes.length >= 3) break;
      }
    }
  }

  return scopes;
}
