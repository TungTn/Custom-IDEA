import { Extension, StateEffect, StateField } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet, ViewUpdate, ViewPlugin } from '@codemirror/view';

export const setOccurrencesEffect = StateEffect.define<{
  ranges: { from: number; to: number; line: number }[];
  word: string;
}>();

// Common programming language keywords to ignore for occurrences highlighting
const IGNORED_KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'return', 'function', 'class', 'const', 'let', 'var', 'import', 'from',
  'export', 'default', 'async', 'await', 'try', 'catch', 'finally', 'throw',
  'new', 'typeof', 'instanceof', 'in', 'of', 'null', 'undefined', 'true',
  'false', 'this', 'super', 'interface', 'type', 'enum', 'pub', 'fn', 'struct',
  'impl', 'mut', 'use', 'mod', 'crate', 'self', 'void', 'int', 'string', 'boolean'
]);

export const occurrencesField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const e of tr.effects) {
      if (e.is(setOccurrencesEffect)) {
        if (!e.value.ranges || e.value.ranges.length <= 1) {
          return Decoration.none;
        }
        const decos = e.value.ranges.map((r) =>
          Decoration.mark({
            class: 'cm-occurrence-match',
            attributes: { 'data-occurrence': e.value.word },
          }).range(r.from, r.to)
        );
        return Decoration.set(decos);
      }
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

export interface OccurrencesListener {
  (occurrences: { line: number; from: number; to: number }[], word: string): void;
}

export function createOccurrencesHighlighter(onOccurrencesChange?: OccurrencesListener): Extension {
  let lastWord = '';
  let debounceTimer: any = null;

  const plugin = ViewPlugin.fromClass(
    class {
      constructor(readonly view: EditorView) {}

      update(update: ViewUpdate) {
        if (update.selectionSet || update.docChanged) {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            this.recomputeOccurrences(update.view);
          }, 150);
        }
      }

      destroy() {
        clearTimeout(debounceTimer);
      }

      recomputeOccurrences(view: EditorView) {
        const { state } = view;
        const head = state.selection.main.head;
        const wordRange = state.wordAt(head);

        if (!wordRange || wordRange.from === wordRange.to) {
          if (lastWord !== '') {
            lastWord = '';
            view.dispatch({
              effects: setOccurrencesEffect.of({ ranges: [], word: '' }),
            });
            onOccurrencesChange?.([], '');
          }
          return;
        }

        const word = state.sliceDoc(wordRange.from, wordRange.to).trim();

        // Check if valid identifier and not a short or reserved keyword
        if (word.length < 2 || IGNORED_KEYWORDS.has(word) || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(word)) {
          if (lastWord !== '') {
            lastWord = '';
            view.dispatch({
              effects: setOccurrencesEffect.of({ ranges: [], word: '' }),
            });
            onOccurrencesChange?.([], '');
          }
          return;
        }

        if (word === lastWord) {
          return;
        }
        lastWord = word;

        // Scan document for exact word boundary matches
        const docText = state.doc.toString();
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'g');
        const ranges: { from: number; to: number; line: number }[] = [];

        let match: RegExpExecArray | null;
        let count = 0;
        // Limit to 200 occurrences for optimal performance
        while ((match = regex.exec(docText)) !== null && count < 200) {
          const from = match.index;
          const to = match.index + word.length;
          const line = state.doc.lineAt(from).number;
          ranges.push({ from, to, line });
          count++;
        }

        view.dispatch({
          effects: setOccurrencesEffect.of({ ranges, word }),
        });

        onOccurrencesChange?.(ranges, word);
      }
    }
  );

  return [
    occurrencesField,
    plugin,
    EditorView.theme({
      '.cm-occurrence-match': {
        backgroundColor: 'rgba(33, 66, 131, 0.45)',
        borderRadius: '2px',
        outline: '1px solid rgba(88, 157, 246, 0.3)',
      },
      '.cm-editor.theme-intellij-light .cm-occurrence-match, body.theme-intellij-light .cm-occurrence-match': {
        backgroundColor: 'rgba(166, 210, 255, 0.6) !important',
        outline: '1px solid #70ACFF !important',
      },
    }),
  ];
}
