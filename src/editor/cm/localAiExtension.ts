import { Extension, StateField, StateEffect } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet, WidgetType, keymap } from '@codemirror/view';
import { localAiService } from '../../features/ai/localAiService';

// Effect to set or clear ghost text
export const setGhostText = StateEffect.define<{ text: string; pos: number } | null>();

class GhostTextWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-ai-ghost-text select-none pointer-events-none text-[#7A7E85] italic opacity-65 font-mono';
    span.textContent = this.text;
    span.title = 'Local AI Suggestion (Press Tab to accept, Esc to reject)';
    return span;
  }
}

export const ghostTextField = StateField.define<{ text: string; pos: number } | null>({
  create() {
    return null;
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setGhostText)) {
        return e.value;
      }
    }
    if (tr.docChanged && value) {
      // Clear if doc changed without setting new ghost text
      return null;
    }
    return value;
  },
  provide: (f) =>
    EditorView.decorations.from(f, (val) => {
      if (!val || !val.text) return Decoration.none;
      const widget = Decoration.widget({
        widget: new GhostTextWidget(val.text),
        side: 1,
      });
      return Decoration.set([widget.range(val.pos)]);
    }),
});

export function createLocalAiExtension(filePath: string, language?: string): Extension {
  let debounceTimeout: any = null;

  const viewListener = EditorView.updateListener.of((update) => {
    if (!localAiService.getConfig().enabled) return;

    if (update.selectionSet || update.docChanged) {
      if (debounceTimeout) clearTimeout(debounceTimeout);

      const state = update.state;
      const pos = state.selection.main.head;

      // Only suggest when at an empty or typing position without selection range
      if (!state.selection.main.empty) {
        update.view.dispatch({ effects: setGhostText.of(null) });
        return;
      }

      // Fetch suggestion after 650ms idle typing
      debounceTimeout = setTimeout(async () => {
        const doc = update.view.state.doc;
        const currentPos = update.view.state.selection.main.head;
        if (currentPos !== pos) return;

        // Context slice (up to 1500 chars before and 500 chars after)
        const prefix = doc.sliceString(Math.max(0, currentPos - 1500), currentPos);
        const suffix = doc.sliceString(currentPos, Math.min(doc.length, currentPos + 500));

        // Skip if prefix is completely empty or just whitespace
        if (!prefix.trim()) {
          update.view.dispatch({ effects: setGhostText.of(null) });
          return;
        }

        const lang = language || filePath.split('.').pop() || 'typescript';
        const suggestion = await localAiService.generateInlineCompletion(prefix, suffix, lang);

        if (suggestion && update.view.state.selection.main.head === currentPos) {
          update.view.dispatch({
            effects: setGhostText.of({ text: suggestion, pos: currentPos }),
          });
        }
      }, 650);
    }
  });

  const aiKeymap = keymap.of([
    {
      key: 'Tab',
      run: (view) => {
        const ghost = view.state.field(ghostTextField, false);
        if (ghost && ghost.text) {
          view.dispatch({
            changes: { from: ghost.pos, insert: ghost.text },
            selection: { anchor: ghost.pos + ghost.text.length },
            effects: setGhostText.of(null),
          });
          return true; // Consume Tab
        }
        return false;
      },
    },
    {
      key: 'Escape',
      run: (view) => {
        const ghost = view.state.field(ghostTextField, false);
        if (ghost && ghost.text) {
          view.dispatch({ effects: setGhostText.of(null) });
          return true;
        }
        return false;
      },
    },
  ]);

  return [ghostTextField, viewListener, aiKeymap];
}
