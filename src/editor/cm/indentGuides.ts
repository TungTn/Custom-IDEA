import { Extension } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';

export function createIndentGuides(tabSize: number = 4): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet
        ) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const { state } = view;
        const decos: any[] = [];
        const head = state.selection.main.head;
        const currentLineNum = state.doc.lineAt(head).number;

        for (const { from, to } of view.visibleRanges) {
          let pos = from;
          while (pos <= to) {
            const line = state.doc.lineAt(pos);
            const lineText = line.text;

            // Find leading whitespace (spaces or tabs)
            let leadingSpaces = 0;
            let index = 0;
            while (index < lineText.length) {
              const ch = lineText[index];
              if (ch === ' ') {
                leadingSpaces++;
                index++;
              } else if (ch === '\t') {
                leadingSpaces += tabSize;
                index++;
              } else {
                break;
              }
            }

            // Only draw guides if line has at least 1 indent level and is not completely empty
            if (index > 0 && lineText.trim().length > 0) {
              const isCurrentLine = line.number === currentLineNum;
              const levels = Math.floor(leadingSpaces / tabSize);

              // Step through character positions to apply inset indent lines
              let charIdx = 0;
              let currentSpaces = 0;
              let currentLevel = 0;

              while (charIdx < index && currentLevel < levels) {
                const ch = lineText[charIdx];
                const charLen = ch === '\t' ? tabSize : 1;

                if (currentSpaces % tabSize === 0) {
                  currentLevel++;
                  const fromPos = line.from + charIdx;
                  const toPos = Math.min(line.from + index, line.from + charIdx + (ch === '\t' ? 1 : tabSize));

                  const isActive = isCurrentLine && currentLevel === levels;
                  decos.push(
                    Decoration.mark({
                      class: isActive ? 'cm-indent-guide cm-indent-guide-active' : 'cm-indent-guide',
                    }).range(fromPos, toPos)
                  );
                }

                currentSpaces += charLen;
                charIdx++;
              }
            }

            pos = line.to + 1;
          }
        }

        return Decoration.set(decos, true);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );

  return [
    plugin,
    EditorView.theme({
      '.cm-indent-guide': {
        boxShadow: 'inset 1px 0 0 rgba(255, 255, 255, 0.08)',
      },
      '.cm-indent-guide.cm-indent-guide-active': {
        boxShadow: 'inset 1px 0 0 rgba(255, 255, 255, 0.22) !important',
      },
      'body.theme-intellij-light .cm-indent-guide, .theme-intellij-light .cm-indent-guide': {
        boxShadow: 'inset 1px 0 0 rgba(0, 0, 0, 0.1) !important',
      },
      'body.theme-intellij-light .cm-indent-guide.cm-indent-guide-active, .theme-intellij-light .cm-indent-guide.cm-indent-guide-active': {
        boxShadow: 'inset 1px 0 0 rgba(0, 0, 0, 0.28) !important',
      },
    }),
  ];
}
