import { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

const RAINBOW_COLORS = [
  '#FFD700', // Gold
  '#DA70D6', // Orchid / Violet
  '#40A9FF', // Sky Blue
  '#FFA940', // Tangerine Orange
  '#52C41A', // Mint Green
];

const bracketDecorations = RAINBOW_COLORS.map((_, i) =>
  Decoration.mark({ class: `cm-rainbow-bracket-${i}` })
);

function buildRainbowDecorations(view: EditorView): DecorationSet {
  const decorations: any[] = [];
  const doc = view.state.doc;
  const tree = syntaxTree(view.state);

  for (const { from, to } of view.visibleRanges) {
    let depth = 0;
    const text = doc.sliceString(from, to);

    // Fast tokenizer scan for matching pairs
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const pos = from + i;

      if (char === '(' || char === '[' || char === '{') {
        const colorIdx = depth % RAINBOW_COLORS.length;
        decorations.push(bracketDecorations[colorIdx].range(pos, pos + 1));
        depth++;
      } else if (char === ')' || char === ']' || char === '}') {
        depth = Math.max(0, depth - 1);
        const colorIdx = depth % RAINBOW_COLORS.length;
        decorations.push(bracketDecorations[colorIdx].range(pos, pos + 1));
      }
    }
  }

  return Decoration.set(decorations, true);
}

const rainbowBracketPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildRainbowDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildRainbowDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const rainbowBracketTheme = EditorView.theme({
  '.cm-rainbow-bracket-0': { color: '#FFD700 !important', fontWeight: 'bold' },
  '.cm-rainbow-bracket-1': { color: '#DA70D6 !important', fontWeight: 'bold' },
  '.cm-rainbow-bracket-2': { color: '#40A9FF !important', fontWeight: 'bold' },
  '.cm-rainbow-bracket-3': { color: '#FFA940 !important', fontWeight: 'bold' },
  '.cm-rainbow-bracket-4': { color: '#52C41A !important', fontWeight: 'bold' },
});

export function createRainbowBracketsExtension(): Extension {
  return [rainbowBracketPlugin, rainbowBracketTheme];
}
