import { Extension } from '@codemirror/state';
import { gutter, GutterMarker, EditorView } from '@codemirror/view';

class ColorGutterMarker extends GutterMarker {
  constructor(
    readonly color: string,
    readonly lineFrom: number
  ) {
    super();
  }

  eq(other: ColorGutterMarker) {
    return other.color === this.color && other.lineFrom === this.lineFrom;
  }

  toDOM(view: EditorView) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-color-swatch-container';
    wrapper.style.cssText = 'width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; position: relative;';

    const swatch = document.createElement('div');
    swatch.className = 'cm-color-swatch';
    swatch.style.cssText = `
      width: 10px;
      height: 10px;
      border-radius: 2px;
      background-color: ${this.color};
      border: 1px solid rgba(255, 255, 255, 0.35);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
      transition: transform 0.1s ease;
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
        const line = view.state.doc.lineAt(this.lineFrom);
        const lineText = line.text;
        const match = lineText.match(/#(?:[0-9a-fA-F]{3,4}){1,2}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+\s*)?\)/i);
        if (match && match.index !== undefined) {
          const from = line.from + match.index;
          const to = from + match[0].length;
          view.dispatch({
            changes: { from, to, insert: newColor },
          });
        }
      } catch (err) {
        console.warn('Failed to update color from gutter:', err);
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
}

const colorRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+\s*)?\)/i;

export const colorPickerExtension: Extension = [
  gutter({
    class: 'cm-color-gutter select-none bg-[#1E1F22]',
    lineMarker(view, line) {
      const lineText = view.state.doc.sliceString(line.from, line.to);
      const match = lineText.match(colorRegex);
      if (match) {
        return new ColorGutterMarker(match[0], line.from);
      }
      return null;
    },
  }),
  EditorView.theme({
    '.cm-color-gutter': {
      width: '18px',
      minWidth: '18px',
      maxWidth: '18px',
      backgroundColor: '#1E1F22',
      borderRight: 'none',
    },
    '.cm-color-gutter .cm-gutterElement': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
    },
  }),
];
