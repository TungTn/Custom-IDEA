import { EditorView, WidgetType, Decoration, DecorationSet } from '@codemirror/view';
import { RangeSetBuilder, Extension, StateField, EditorState } from '@codemirror/state';

class CodeLensWidget extends WidgetType {
  constructor(
    readonly symbol: string,
    readonly onFindUsages: (symbol: string) => void
  ) {
    super();
  }

  toDOM() {
    const span = document.createElement('span');
    span.className =
      'cm-codelens-inline ml-3 px-1.5 py-0.5 rounded text-[10.5px] font-sans text-[#868A91] hover:text-[#56A8F5] hover:bg-[#35373B] cursor-pointer inline-flex items-center gap-1 transition-colors select-none font-normal opacity-75 hover:opacity-100';
    span.textContent = 'usages';
    span.title = `Find Usages for '${this.symbol}' (Alt+F7)`;

    span.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    span.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onFindUsages(this.symbol);
    };

    return span;
  }

  eq(other: CodeLensWidget) {
    return this.symbol === other.symbol;
  }

  ignoreEvent() {
    return false;
  }
}

// Regex to detect top-level or scoped declarations (functions, classes, interfaces, types, exported variables)
const DECLARATION_REGEX =
  /^\s*(?:export\s+(?:default\s+)?)?(?:declare\s+)?(?:async\s+)?(?:pub\s+)?(?:const|let|var|function\*?|class|interface|type|enum|fn|struct|trait|def)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/;

function buildCodeLensDeco(state: EditorState, onFindUsages?: (symbol: string) => void): DecorationSet {
  if (!onFindUsages) return Decoration.none;
  const builder = new RangeSetBuilder<Decoration>();
  const doc = state.doc;
  const maxLines = Math.min(doc.lines, 2500);

  for (let l = 1; l <= maxLines; l++) {
    const line = doc.line(l);
    const text = line.text;
    const match = text.match(DECLARATION_REGEX);
    if (match && match[1]) {
      const symbol = match[1];
      // Attach inline at the end of the line (line.to) to keep line numbers and mouse coordinates 100% aligned
      builder.add(
        line.to,
        line.to,
        Decoration.widget({
          widget: new CodeLensWidget(symbol, onFindUsages),
          side: 1,
        })
      );
    }
  }

  return builder.finish();
}

export function createCodeLensExtension(onFindUsages?: (symbol: string) => void): Extension {
  if (!onFindUsages) return [];

  const codeLensField = StateField.define<DecorationSet>({
    create(state) {
      return buildCodeLensDeco(state, onFindUsages);
    },
    update(decorations, tr) {
      if (tr.docChanged) {
        return buildCodeLensDeco(tr.state, onFindUsages);
      }
      return decorations.map(tr.changes);
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  return [codeLensField];
}
