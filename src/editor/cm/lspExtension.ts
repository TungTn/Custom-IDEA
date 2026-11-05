import { invoke } from '@tauri-apps/api/core';
import { Extension, StateEffect, StateField } from '@codemirror/state';
import { EditorView, hoverTooltip, showTooltip, Tooltip, keymap, Decoration, DecorationSet } from '@codemirror/view';
import { autocompletion, CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete';
import { setDiagnostics, Diagnostic, lintGutter } from '@codemirror/lint';
import { lspService, pathToUri, uriToPath, LspCompletionItem, LspCodeAction, LspRange, LspSignatureHelp } from '../../services/lspService';
import { extractStringLiteralAtPos, isLikelyPathString, resolveImportPath } from './pathResolver';

// Map LSP CompletionItemKind to CodeMirror completion type
function mapLspKindToCmType(kind?: number): string {
  switch (kind) {
    case 1:
      return 'text';
    case 2:
      return 'method';
    case 3:
      return 'function';
    case 4:
      return 'type'; // Constructor
    case 5:
      return 'property'; // Field
    case 6:
      return 'variable';
    case 7:
      return 'class';
    case 8:
      return 'interface';
    case 9:
      return 'namespace'; // Module
    case 10:
      return 'property';
    case 14:
      return 'keyword';
    case 15:
      return 'snippet';
    case 21:
      return 'constant';
    case 22:
      return 'enum';
    case 25:
      return 'type';
    default:
      return 'variable';
  }
}

import { getLiveTemplateCompletions } from './snippetEngine';
import { getPostfixCompletions } from './postfixEngine';

// Common programming language keywords to ignore for Go to Definition & Underline
const IGNORED_KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'return', 'function', 'class', 'const', 'let', 'var', 'import', 'from',
  'export', 'default', 'async', 'await', 'try', 'catch', 'finally', 'throw',
  'new', 'typeof', 'instanceof', 'in', 'of', 'null', 'undefined', 'true',
  'false', 'this', 'super', 'interface', 'type', 'enum', 'pub', 'fn', 'struct',
  'impl', 'mut', 'use', 'mod', 'crate', 'self', 'void', 'int', 'string', 'boolean'
]);

// Browser & JavaScript built-in globals that should not trigger arbitrary project symbol search
const BUILTIN_GLOBALS = new Set([
  'window', 'document', 'console', 'globalThis', 'self', 'navigator', 'location', 'history',
  'screen', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'alert', 'prompt', 'confirm',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'addEventListener', 'removeEventListener', 'dispatchEvent',
  'CustomEvent', 'Event', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt', 'Function', 'Promise',
  'Date', 'RegExp', 'Error', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError',
  'TypeError', 'URIError', 'Math', 'JSON', 'Map', 'Set', 'WeakMap', 'WeakSet',
  'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Intl', 'Reflect', 'Proxy', 'NaN', 'Infinity'
]);

export function createLspAutocompletion(filePath: string, language?: string): Extension {
  const ext = filePath.split('.').pop() || language || '';

  return autocompletion({
    override: [
      async (context: CompletionContext): Promise<CompletionResult | null> => {
        const { state, pos } = context;
        const line = state.doc.lineAt(pos);
        const cursorInLine = pos - line.from;

        // 1. Check for Postfix completions first (e.g. expr.sout, arr.for, val.if)
        const postfixRes = getPostfixCompletions(line.text, cursorInLine, line.from, ext);
        if (postfixRes && postfixRes.options.length > 0) {
          return {
            from: postfixRes.from,
            options: postfixRes.options,
            validFor: /^\.[a-zA-Z0-9_]*$/,
          };
        }

        const character = cursorInLine;
        const word = context.matchBefore(/[\w$]+/);
        if (!context.explicit && (!word || word.from === word.to)) {
          return null;
        }

        // 2. Fetch Live Templates for this language
        const templateOptions = getLiveTemplateCompletions(ext);
        const prefix = word ? word.text.toLowerCase() : '';
        const matchingTemplates = prefix
          ? templateOptions.filter((t) => t.label.toLowerCase().startsWith(prefix))
          : templateOptions;

        // 3. Fetch LSP completions
        let lspOptions: Completion[] = [];
        try {
          const items: LspCompletionItem[] = await lspService.getCompletion(filePath, {
            line: line.number - 1,
            character,
          });

          if (items && items.length > 0) {
            lspOptions = items.map((item) => {
              let docStr: string | undefined = undefined;
              if (typeof item.documentation === 'string') {
                docStr = item.documentation;
              } else if (item.documentation && typeof item.documentation.value === 'string') {
                docStr = item.documentation.value;
              }

              return {
                label: item.label,
                type: mapLspKindToCmType(item.kind),
                detail: item.detail,
                info: docStr,
                apply: item.insertText || item.label,
              };
            });
          }
        } catch (e) {
          // If LSP fails, continue with templates
        }

        const allOptions = [...matchingTemplates, ...lspOptions];
        if (allOptions.length === 0) {
          return null;
        }

        return {
          from: word ? word.from : pos,
          options: allOptions,
          validFor: /^[\w$]*$/,
        };
      },
    ],
  });
}

export function createLspHoverTooltip(filePath: string): Extension {
  return hoverTooltip(async (view: EditorView, pos: number): Promise<Tooltip | null> => {
    const { state } = view;
    const line = state.doc.lineAt(pos);
    const character = pos - line.from;

    const res = await lspService.getHover(filePath, {
      line: line.number - 1,
      character,
    });

    if (!res || !res.contents) return null;

    let textContent = '';
    if (typeof res.contents === 'string') {
      textContent = res.contents;
    } else if ('value' in res.contents) {
      textContent = res.contents.value;
    } else if (Array.isArray(res.contents)) {
      textContent = res.contents
        .map((c: any) => (typeof c === 'string' ? c : c.value))
        .join('\n\n');
    }

    if (!textContent.trim()) return null;

    return {
      pos,
      above: true,
      create() {
        const dom = document.createElement('div');
        dom.className =
          'bg-[#2B2D30] border border-[#3E4044] rounded shadow-2xl p-2.5 text-xs text-[#DFE1E5] font-mono max-w-lg max-h-64 overflow-y-auto z-50 whitespace-pre-wrap select-text';
        dom.textContent = textContent;
        return { dom };
      },
    };
  });
}

// ─── Parameter Info / Signature Help (IntelliJ Ctrl+P) ───
export const setSignatureHelpTooltip = StateEffect.define<Tooltip | null>();

export const signatureHelpField = StateField.define<Tooltip | null>({
  create: () => null,
  update: (tooltip, tr) => {
    for (const e of tr.effects) {
      if (e.is(setSignatureHelpTooltip)) return e.value;
    }
    return tr.docChanged ? null : tooltip;
  },
  provide: (f) => showTooltip.from(f, (val) => val),
});

export async function triggerSignatureHelp(filePath: string, view: EditorView): Promise<boolean> {
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  const character = head - line.from;

  try {
    const help = await lspService.getSignatureHelp(filePath, {
      line: line.number - 1,
      character,
    });

    if (!help || !help.signatures || help.signatures.length === 0) {
      view.dispatch({ effects: setSignatureHelpTooltip.of(null) });
      return false;
    }

    const activeSigIdx = help.activeSignature ?? 0;
    const sig = help.signatures[activeSigIdx] || help.signatures[0];
    const activeParamIdx = help.activeParameter ?? sig.activeParameter ?? 0;

    const tooltip: Tooltip = {
      pos: head,
      above: true,
      strictSide: true,
      create() {
        const dom = document.createElement('div');
        dom.className =
          'bg-[#2B2D30] border border-[#3574F0]/60 rounded shadow-2xl px-3 py-1.5 text-xs text-[#DFE1E5] font-mono z-50 flex flex-col gap-1 select-text max-w-lg';

        // Render signature label with active parameter highlighted in bold blue
        const sigLine = document.createElement('div');
        sigLine.className = 'flex items-center flex-wrap gap-1';

        if (sig.parameters && sig.parameters.length > 0) {
          const prefix = sig.label.substring(0, sig.label.indexOf('(') + 1) || '';
          const prefixSpan = document.createElement('span');
          prefixSpan.className = 'text-[#DFE1E5]';
          prefixSpan.textContent = prefix;
          sigLine.appendChild(prefixSpan);

          sig.parameters.forEach((param, pIdx) => {
            const pLabel = typeof param.label === 'string'
              ? param.label
              : sig.label.substring(param.label[0], param.label[1]);

            const pSpan = document.createElement('span');
            const isActive = pIdx === activeParamIdx;
            pSpan.className = isActive
              ? 'font-bold text-[#56A8F5] underline underline-offset-2'
              : 'text-[#868A91]';
            pSpan.textContent = pLabel;
            sigLine.appendChild(pSpan);

            if (pIdx < sig.parameters!.length - 1) {
              const sep = document.createElement('span');
              sep.textContent = ', ';
              sep.className = 'text-[#868A91]';
              sigLine.appendChild(sep);
            }
          });

          const suffixSpan = document.createElement('span');
          suffixSpan.className = 'text-[#DFE1E5]';
          suffixSpan.textContent = ')';
          sigLine.appendChild(suffixSpan);
        } else {
          sigLine.textContent = sig.label;
        }

        dom.appendChild(sigLine);

        // Render documentation if present
        if (sig.documentation) {
          const docText = typeof sig.documentation === 'string' ? sig.documentation : sig.documentation.value;
          if (docText) {
            const docEl = document.createElement('div');
            docEl.className = 'text-[11px] text-[#868A91] border-t border-[#3E4044] pt-1 mt-0.5';
            docEl.textContent = docText;
            dom.appendChild(docEl);
          }
        }

        return { dom };
      },
    };

    view.dispatch({ effects: setSignatureHelpTooltip.of(tooltip) });
    return true;
  } catch (err) {
    console.warn('Signature help error:', err);
    view.dispatch({ effects: setSignatureHelpTooltip.of(null) });
    return false;
  }
}

export function createLspSignatureHelp(filePath: string): Extension {
  return [
    signatureHelpField,
    keymap.of([
      {
        key: 'Mod-p', // IntelliJ Parameter Info
        run: (view: EditorView) => {
          triggerSignatureHelp(filePath, view);
          return true;
        },
      },
      {
        key: 'Escape',
        run: (view: EditorView) => {
          if (view.state.field(signatureHelpField, false)) {
            view.dispatch({ effects: setSignatureHelpTooltip.of(null) });
            return true;
          }
          return false;
        },
      },
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        // Automatically check if user just typed '(' or ','
        for (const tr of update.transactions) {
          tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
            const text = inserted.toString();
            if (text.includes('(') || text.includes(',')) {
              setTimeout(() => {
                triggerSignatureHelp(filePath, update.view);
              }, 50);
            }
          });
        }
      }
    }),
  ];
}

export function createLspDiagnostics(
  viewRef: React.MutableRefObject<EditorView | null>,
  filePath: string,
  onDiagnosticsUpdate?: (diagnostics: { line: number; severity: 'error' | 'warning' | 'info' | 'hint'; message: string }[]) => void
): () => void {
  const currentUri = pathToUri(filePath);

  return lspService.onDiagnostics((params: any) => {
    const view = viewRef.current;
    if (!view) return;

    if (params.uri.toLowerCase() !== currentUri.toLowerCase()) {
      return;
    }

    const { doc } = view.state;
    const diagnostics: Diagnostic[] = [];
    const stripeDiags: { line: number; severity: 'error' | 'warning' | 'info' | 'hint'; message: string }[] = [];

    for (const diag of params.diagnostics) {
      const startLineNum = Math.max(1, Math.min(diag.range.start.line + 1, doc.lines));
      const endLineNum = Math.max(1, Math.min(diag.range.end.line + 1, doc.lines));

      const startLine = doc.line(startLineNum);
      const endLine = doc.line(endLineNum);

      const from = Math.min(startLine.from + diag.range.start.character, startLine.to);
      const to = Math.max(from, Math.min(endLine.from + diag.range.end.character, endLine.to));

      let severity: 'error' | 'warning' | 'info' | 'hint' = 'error';
      if (diag.severity === 2) severity = 'warning';
      else if (diag.severity === 3) severity = 'info';
      else if (diag.severity === 4) severity = 'hint';

      diagnostics.push({
        from,
        to: Math.max(from + 1, to),
        severity,
        message: diag.message,
      });

      stripeDiags.push({
        line: startLineNum,
        severity,
        message: diag.message,
      });
    }

    onDiagnosticsUpdate?.(stripeDiags);

    try {
      view.dispatch(setDiagnostics(view.state, diagnostics));
    } catch (e) {
      console.warn('Failed to dispatch LSP diagnostics to CM6:', e);
    }
  });
}

export const setCtrlLinkRange = StateEffect.define<{ from: number; to: number } | null>();

export const ctrlLinkField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(links, tr) {
    for (const e of tr.effects) {
      if (e.is(setCtrlLinkRange)) {
        if (!e.value) return Decoration.none;
        return Decoration.set([
          Decoration.mark({
            class: 'cm-ctrl-clickable-link',
          }).range(e.value.from, e.value.to),
        ]);
      }
    }
    return links.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Scans the document text for an import statement importing the given symbol.
 * Handles single-line and multiline imports:
 * - import { foo, bar } from 'path'
 * - import foo from 'path'
 * - import * as foo from 'path'
 * - const { foo } = require('path')
 */
export function findImportSourceForSymbol(docText: string, sym: string): string | null {
  const escaped = sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 1. Named imports: import { ... sym ... } from '...' (supports multiline)
  const namedRegex = new RegExp(
    `import\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`,
    'm'
  );
  const namedMatch = namedRegex.exec(docText);
  if (namedMatch) return namedMatch[1];

  // 2. Default import: import sym from '...' or import sym, { ... } from '...'
  const defaultRegex = new RegExp(
    `import\\s+${escaped}\\s*(?:,\\s*\\{[^}]*\\})?\\s+from\\s*['"]([^'"]+)['"]`,
    'm'
  );
  const defaultMatch = defaultRegex.exec(docText);
  if (defaultMatch) return defaultMatch[1];

  // 3. Namespace import: import * as sym from '...'
  const namespaceRegex = new RegExp(
    `import\\s*\\*\\s*as\\s+${escaped}\\s+from\\s*['"]([^'"]+)['"]`,
    'm'
  );
  const nsMatch = namespaceRegex.exec(docText);
  if (nsMatch) return nsMatch[1];

  // 4. Require pattern: const { ... sym ... } = require('...')
  const requireRegex = new RegExp(
    `(?:const|let|var)\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}\\s*=\\s*require\\(['"]([^'"]+)['"]\\)`,
    'm'
  );
  const reqMatch = requireRegex.exec(docText);
  if (reqMatch) return reqMatch[1];

  // 5. Default require: const sym = require('...')
  const defaultReqRegex = new RegExp(
    `(?:const|let|var)\\s+${escaped}\\s*=\\s*require\\(['"]([^'"]+)['"]\\)`,
    'm'
  );
  const defReqMatch = defaultReqRegex.exec(docText);
  if (defReqMatch) return defReqMatch[1];

  return null;
}

/**
 * Searches a file's content for the definition line of the symbol.
 */
export function findSymbolLineInFile(content: string, sym: string): { line: number; col: number } | null {
  const lines = content.split('\n');
  const escaped = sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Priority 1: export (async) function / const / let / var / class / interface / type / enum
  const exportPattern = new RegExp(`^\\s*export\\s+(?:async\\s+)?(?:function\\*?|const|let|var|class|interface|type|enum)\\s+${escaped}\\b`);
  for (let i = 0; i < lines.length; i++) {
    if (exportPattern.test(lines[i])) {
      const col = lines[i].indexOf(sym) + 1;
      return { line: i + 1, col: Math.max(1, col) };
    }
  }

  // Priority 2: regular declaration (function / const / let / class / fn / pub fn)
  const defPattern = new RegExp(`^\\s*(?:async\\s+)?(?:function\\*?|const|let|var|class|interface|type|enum|fn|pub\\s+fn)\\s+${escaped}\\b`);
  for (let i = 0; i < lines.length; i++) {
    if (defPattern.test(lines[i])) {
      const col = lines[i].indexOf(sym) + 1;
      return { line: i + 1, col: Math.max(1, col) };
    }
  }

  // Priority 3: export default function sym / export default sym
  const exportDefaultPattern = new RegExp(`^\\s*export\\s+default\\s+(?:(?:async\\s+)?function\\s+)?${escaped}\\b`);
  for (let i = 0; i < lines.length; i++) {
    if (exportDefaultPattern.test(lines[i])) {
      const col = lines[i].indexOf(sym) + 1;
      return { line: i + 1, col: Math.max(1, col) };
    }
  }

  // Priority 4: export { ... sym ... }
  const exportListPattern = new RegExp(`^\\s*export\\s*\\{[^}]*\\b${escaped}\\b`);
  for (let i = 0; i < lines.length; i++) {
    if (exportListPattern.test(lines[i])) {
      const col = lines[i].indexOf(sym) + 1;
      return { line: i + 1, col: Math.max(1, col) };
    }
  }

  // Priority 5: object method / function property (e.g. sym() { or sym: () => or sym: function)
  const methodPattern = new RegExp(`^\\s*(?:async\\s+)?${escaped}\\s*\\(`);
  for (let i = 0; i < lines.length; i++) {
    if (methodPattern.test(lines[i])) {
      const col = lines[i].indexOf(sym) + 1;
      return { line: i + 1, col: Math.max(1, col) };
    }
  }

  return null;
}

/**
 * Searches the current document for a local definition of the symbol
 * (skipping the line where the user clicked).
 */
export function findLocalDefinitionInDoc(
  doc: any,
  sym: string,
  currentHeadPos: number
): { line: number; col: number } | null {
  const currentLine = doc.lineAt(currentHeadPos).number;
  const escaped = sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const patterns = [
    new RegExp(`(?:export\\s+)?(?:async\\s+)?(?:function\\*?|const|let|var|class|interface|type|enum|struct|fn|trait)\\s+${escaped}\\b`),
    new RegExp(`^\\s*(?:async\\s+)?${escaped}\\s*\\([^)]*\\)\\s*\\{`),
    new RegExp(`^\\s*${escaped}\\s*[:=]\\s*(?:async\\s*)?(?:function|\\([^)]*\\)\\s*=>|\\w+\\s*=>)`),
  ];

  for (const pattern of patterns) {
    for (let i = 1; i <= doc.lines; i++) {
      if (i === currentLine) continue;
      const lineText = doc.line(i).text;
      if (pattern.test(lineText)) {
        const col = lineText.indexOf(sym) + 1;
        return { line: i, col: Math.max(1, col) };
      }
    }
  }

  return null;
}

export async function triggerGoToDefinition(
  filePath: string,
  view: EditorView,
  pos?: number,
  onNavigate?: (targetPath: string, line: number, col: number) => void,
  projectPath?: string
): Promise<boolean> {
  const head = pos !== undefined ? pos : view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  const character = head - line.from;

  // 1. Check if cursor is within a file path string literal (import, require, href, etc.)
  const literal = extractStringLiteralAtPos(line.text, character);
  if (literal && isLikelyPathString(literal.text)) {
    try {
      const resolved = await resolveImportPath(literal.text, filePath, projectPath);
      if (resolved) {
        onNavigate?.(resolved, 1, 1);
        return true;
      }
    } catch (err) {
      console.warn('Failed to resolve file path for Go to Definition:', err);
    }
  }

  // 2. LSP Go to Definition
  try {
    const locations: any = await lspService.getDefinition(filePath, {
      line: line.number - 1,
      character,
    });
    if (locations && locations.length > 0) {
      const target = locations[0];
      const targetPath = uriToPath(target.uri);
      const targetLine = (target.range?.start?.line ?? 0) + 1;
      const targetCol = (target.range?.start?.character ?? 0) + 1;
      onNavigate?.(targetPath, targetLine, targetCol);
      return true;
    }
  } catch (err: any) {
    console.warn('LSP Go to Definition error:', err);
  }

  // 3. Word / Symbol Resolution
  const word = view.state.wordAt(head);
  if (word && word.from < word.to) {
    const sym = view.state.sliceDoc(word.from, word.to);
    const docText = view.state.doc.toString();

    // Ignore programming language keywords (if, return, const, etc.)
    if (IGNORED_KEYWORDS.has(sym)) {
      return false;
    }

    // 3a. Search in current document for local definition (excluding current line)
    const localDef = findLocalDefinitionInDoc(view.state.doc, sym, head);
    if (localDef) {
      onNavigate?.(filePath, localDef.line, localDef.col);
      return true;
    }

    // If it's a built-in browser/JS global (window, document, console, etc.) with no local declaration, do not navigate
    if (BUILTIN_GLOBALS.has(sym)) {
      return false;
    }

    // 3b. Search import statements in current file to trace across files
    const importSource = findImportSourceForSymbol(docText, sym);
    if (importSource) {
      try {
        const resolvedTarget = await resolveImportPath(importSource, filePath, projectPath);
        if (resolvedTarget) {
          let targetLine = 1;
          let targetCol = 1;

          if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
            try {
              const fileContent = await invoke<string>('read_file_content', { path: resolvedTarget });
              if (fileContent) {
                const found = findSymbolLineInFile(fileContent, sym);
                if (found) {
                  targetLine = found.line;
                  targetCol = found.col;
                }
              }
            } catch (readErr) {
              console.warn('Failed to read target file content for symbol search:', readErr);
            }
          }

          onNavigate?.(resolvedTarget, targetLine, targetCol);
          return true;
        }
      } catch (impErr) {
        console.warn('Failed to resolve imported symbol:', impErr);
      }
    }

    // 3c. Fallback to ide-index Rust symbol search across project
    // CRITICAL: MUST be an exact match on symbol name! Never fallback to fuzzy partial match!
    if (projectPath && typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      try {
        const results = await invoke<any[]>('search_project_index', {
          projectPath,
          query: sym,
          category: 'Symbols',
          limit: 15,
        });
        if (results && results.length > 0) {
          const exactMatch = results.find(
            (r) => (r.title === sym || r.title.toLowerCase() === sym.toLowerCase()) && r.file_path
          );
          if (exactMatch && exactMatch.file_path) {
            onNavigate?.(
              exactMatch.file_path,
              exactMatch.line_number || 1,
              exactMatch.column_number || 1
            );
            return true;
          }
        }
      } catch (idxErr) {
        console.warn('Index symbol search fallback error:', idxErr);
      }
    }
  }

  return false;
}

export function createLspKeymap(
  filePath: string,
  onNavigate?: (targetPath: string, line: number, col: number) => void,
  projectPath?: string
): Extension {
  return keymap.of([
    {
      key: 'Mod-b', // IntelliJ Go to Definition
      run: (view: EditorView) => {
        triggerGoToDefinition(filePath, view, undefined, onNavigate, projectPath);
        return true;
      },
    },
    {
      key: 'Mod-q', // IntelliJ Quick Documentation
      run: (view: EditorView) => {
        const head = view.state.selection.main.head;
        const line = view.state.doc.lineAt(head);
        const character = head - line.from;

        lspService.getHover(filePath, {
          line: line.number - 1,
          character,
        }).then((res) => {
          if (!res || !res.contents) return;
          let text = '';
          if (typeof res.contents === 'string') text = res.contents;
          else if ('value' in res.contents) text = res.contents.value;
          else if (Array.isArray(res.contents)) text = res.contents.map((c: any) => typeof c === 'string' ? c : c.value).join('\n\n');

          if (!text.trim()) return;

          const tooltip: Tooltip = {
            pos: head,
            above: true,
            strictSide: true,
            create() {
              const dom = document.createElement('div');
              dom.className =
                'bg-[#2B2D30] border border-[#3E4044] rounded shadow-2xl p-3 text-xs text-[#DFE1E5] font-mono max-w-xl max-h-72 overflow-y-auto z-50 whitespace-pre-wrap select-text';
              dom.textContent = text;
              return { dom };
            },
          };
          view.dispatch({ effects: setSignatureHelpTooltip.of(tooltip) });
        }).catch((err) => console.warn('LSP QuickDoc error:', err));

        return true;
      },
    },
  ]);
}

function getExactPosFromMouseEvent(view: EditorView, event: MouseEvent): number | null {
  // 1. Browser native hit-testing on actual text nodes
  if (typeof document !== 'undefined') {
    let textNode: Node | null = null;
    let textOffset = 0;
    if ((document as any).caretPositionFromPoint) {
      const pos = (document as any).caretPositionFromPoint(event.clientX, event.clientY);
      if (pos && pos.offsetNode && pos.offsetNode.nodeType === Node.TEXT_NODE && view.contentDOM.contains(pos.offsetNode)) {
        textNode = pos.offsetNode;
        textOffset = pos.offset;
      }
    } else if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(event.clientX, event.clientY);
      if (range && range.startContainer && range.startContainer.nodeType === Node.TEXT_NODE && view.contentDOM.contains(range.startContainer)) {
        textNode = range.startContainer;
        textOffset = range.startOffset;
      }
    }
    if (textNode) {
      try {
        const domPos = view.posAtDOM(textNode, textOffset);
        if (typeof domPos === 'number') {
          return domPos;
        }
      } catch {}
    }
  }

  // 2. CodeMirror standard coordinate calculation
  const coordsPos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (coordsPos !== null) {
    return coordsPos;
  }

  return null;
}

export function createLspMouseHandler(
  filePath: string,
  onNavigate?: (targetPath: string, line: number, col: number) => void,
  projectPath?: string
): Extension {
  let currentHoverRange: { from: number; to: number } | null = null;

  return [
    ctrlLinkField,
    EditorView.theme({
      '.cm-ctrl-clickable-link': {
        textDecoration: 'underline !important',
        color: '#589DF6 !important',
        cursor: 'pointer !important',
      },
    }),
    EditorView.domEventHandlers({
      click(event, view) {
        if (event.ctrlKey || event.metaKey) {
          const pos = getExactPosFromMouseEvent(view, event);
          if (pos !== null) {
            triggerGoToDefinition(filePath, view, pos, onNavigate, projectPath);
            return true;
          }
        }
        return false;
      },
      mousemove(event, view) {
        if (event.ctrlKey || event.metaKey) {
          const pos = getExactPosFromMouseEvent(view, event);
          if (pos !== null) {
            const line = view.state.doc.lineAt(pos);
            const col = pos - line.from;

            // 1. Hover on import path literal
            const literal = extractStringLiteralAtPos(line.text, col);
            if (literal && isLikelyPathString(literal.text)) {
              const from = line.from + literal.from;
              const to = line.from + literal.to;
              if (
                !currentHoverRange ||
                currentHoverRange.from !== from ||
                currentHoverRange.to !== to
              ) {
                currentHoverRange = { from, to };
                view.dispatch({ effects: setCtrlLinkRange.of({ from, to }) });
              }
              view.dom.style.cursor = 'pointer';
              return;
            }

            // 2. Hover on word / identifier
            const word = view.state.wordAt(pos);
            if (word && word.from < word.to) {
              const sym = view.state.sliceDoc(word.from, word.to);
              // Do not underline keywords or built-in globals (window, document, console)
              if (!IGNORED_KEYWORDS.has(sym) && !BUILTIN_GLOBALS.has(sym)) {
                const from = word.from;
                const to = word.to;
                if (
                  !currentHoverRange ||
                  currentHoverRange.from !== from ||
                  currentHoverRange.to !== to
                ) {
                  currentHoverRange = { from, to };
                  view.dispatch({ effects: setCtrlLinkRange.of({ from, to }) });
                }
                view.dom.style.cursor = 'pointer';
                return;
              }
            }
          }
        }
        if (currentHoverRange) {
          currentHoverRange = null;
          view.dispatch({ effects: setCtrlLinkRange.of(null) });
        }
        if (view.dom.style.cursor === 'pointer') {
          view.dom.style.cursor = '';
        }
      },
      keyup(event, view) {
        if (!event.ctrlKey && !event.metaKey) {
          if (currentHoverRange) {
            currentHoverRange = null;
            view.dispatch({ effects: setCtrlLinkRange.of(null) });
          }
          if (view.dom.style.cursor === 'pointer') {
            view.dom.style.cursor = '';
          }
        }
      },
      mouseleave(_event, view) {
        if (currentHoverRange) {
          currentHoverRange = null;
          view.dispatch({ effects: setCtrlLinkRange.of(null) });
        }
        if (view.dom.style.cursor === 'pointer') {
          view.dom.style.cursor = '';
        }
      },
    }),
  ];
}

export function createLspCodeActionKeymap(
  filePath: string,
  onTriggerCodeActions?: (actions: LspCodeAction[], clientX: number, clientY: number) => void
): Extension {
  return keymap.of([
    {
      key: 'Alt-Enter',
      run: (view: EditorView) => {
        const { state } = view;
        const head = state.selection.main.head;
        const line = state.doc.lineAt(head);
        const character = head - line.from;
        const lineZero = line.number - 1;

        const range: LspRange = {
          start: { line: lineZero, character },
          end: { line: lineZero, character },
        };

        const coords = view.coordsAtPos(head);
        const clientX = coords ? coords.left : 120;
        const clientY = coords ? coords.bottom + 4 : 120;

        lspService
          .getCodeActions(filePath, range)
          .then((actions) => {
            if (actions && actions.length > 0) {
              onTriggerCodeActions?.(actions, clientX, clientY);
            }
          })
          .catch((err) => console.warn('LSP CodeAction error:', err));

        return true;
      },
    },
  ]);
}

export function createLspRenameKeymap(
  onTriggerRename?: () => void
): Extension {
  return keymap.of([
    {
      key: 'Shift-F6',
      run: () => {
        onTriggerRename?.();
        return true;
      },
    },
  ]);
}
