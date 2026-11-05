import { Extension } from '@codemirror/state';
import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';

class ColorSwatchWidget extends WidgetType {
  constructor(
    readonly color: string,
    readonly pos: number
  ) {
    super();
  }

  eq(other: ColorSwatchWidget) {
    return other.color === this.color && other.pos === this.pos;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-color-swatch-wrapper inline-flex items-center align-middle mx-1 select-none';
    wrapper.style.cssText = 'display: inline-flex; vertical-align: middle; margin: 0 3px 0 1px; cursor: pointer;';

    const swatch = document.createElement('span');
    swatch.className = 'cm-color-swatch';
    swatch.style.cssText = `
      width: 10px;
      height: 10px;
      border-radius: 2px;
      display: inline-block;
      background-color: ${this.color};
      border: 1px solid rgba(255, 255, 255, 0.4);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      vertical-align: middle;
    `;
    swatch.title = `Color: ${this.color} (Click to change)`;

    const input = document.createElement('input');
    input.type = 'color';
    input.style.cssText = 'opacity: 0; position: absolute; pointer-events: none; width: 0; height: 0;';
    input.value = this.toStandardHex(this.color);

    wrapper.appendChild(swatch);
    wrapper.appendChild(input);

    wrapper.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.click();
    });

    input.addEventListener('input', (e) => {
      const newColor = (e.target as HTMLInputElement).value;
      swatch.style.backgroundColor = newColor;

      try {
        const line = view.state.doc.lineAt(this.pos);
        const match = line.text.match(colorRegex);
        if (match && match.index !== undefined) {
          const from = line.from + match.index;
          const to = from + match[0].length;
          view.dispatch({
            changes: { from, to, insert: newColor },
          });
        }
      } catch (err) {
        console.warn('Failed to update color from swatch:', err);
      }
    });

    return wrapper;
  }

  private toStandardHex(color: string): string {
    if (color.startsWith('#')) {
      if (color.length === 4) {
        return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
      }
      if (color.length === 5) {
        return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
      }
      if (color.length >= 7) {
        return color.slice(0, 7);
      }
    }
    return '#000000';
  }

  ignoreEvent() {
    return true;
  }
}

const colorRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+\s*)?\)/gi;

function buildColorDecorations(view: EditorView): DecorationSet {
  const widgets: { from: number; deco: Decoration }[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    colorRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = colorRegex.exec(text)) !== null) {
      const pos = from + match.index;
      widgets.push({
        from: pos,
        deco: Decoration.widget({
          widget: new ColorSwatchWidget(match[0], pos),
          side: -1,
        }),
      });
    }
  }

  // Sort by from position
  widgets.sort((a, b) => a.from - b.from);
  return Decoration.set(widgets.map((w) => w.deco.range(w.from)));
}

export const colorPickerExtension: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildColorDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildColorDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
