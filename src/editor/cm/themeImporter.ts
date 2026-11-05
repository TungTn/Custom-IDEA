import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t, Tag } from '@lezer/highlight';

export interface ParsedThemeResult {
  name: string;
  isDark: boolean;
  extension: Extension;
}

export function importIntelliJTheme(jsonStr: string): ParsedThemeResult | null {
  try {
    const raw = JSON.parse(jsonStr);
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const name = raw.name || raw.themeName || 'Custom Imported Theme';
    const isDark = raw.dark ?? (raw.themeType === 'dark' || !raw.light);

    // Extract colors
    const colors = raw.colors || {};
    const ui = raw.ui || {};
    const editor = raw.editor || {};

    const bgColor =
      colors['editor.background'] ||
      editor.background ||
      (raw.background) ||
      (isDark ? '#1E1F22' : '#FFFFFF');

    const fgColor =
      colors['editor.foreground'] ||
      editor.foreground ||
      (raw.foreground) ||
      (isDark ? '#BCBEC4' : '#080808');

    const selectionColor =
      colors['editor.selection'] ||
      colors['editor.selectionBackground'] ||
      (isDark ? '#214283' : '#A6D2FF');

    const lineHighlightColor =
      colors['editor.lineHighlight'] ||
      colors['editor.lineHighlightBackground'] ||
      (isDark ? '#26282E' : '#F2F2F2');

    const gutterBg =
      colors['editorGutter.background'] ||
      colors['gutter.background'] ||
      bgColor;

    const gutterFg =
      colors['editorGutter.foreground'] ||
      colors['gutter.foreground'] ||
      (isDark ? '#4E5157' : '#999999');

    const cursorColor =
      colors['editorCursor.foreground'] ||
      colors['cursor'] ||
      (isDark ? '#A8ADBD' : '#000000');

    // Create EditorView theme
    const customEditorTheme = EditorView.theme(
      {
        '&': {
          color: fgColor,
          backgroundColor: bgColor,
          fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
          fontSize: '13px',
          height: '100%',
        },
        '.cm-content': {
          caretColor: cursorColor,
          fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
          padding: '4px 0',
        },
        '.cm-cursor, .cm-dropCursor': {
          borderLeftColor: cursorColor,
          borderLeftWidth: '2px',
        },
        '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
          backgroundColor: `${selectionColor} !important`,
        },
        '&.cm-focused .cm-selectionBackground': {
          backgroundColor: `${selectionColor} !important`,
        },
        '.cm-selectionBackground': {
          backgroundColor: `${selectionColor}cc !important`,
        },
        '.cm-content ::selection': {
          backgroundColor: `${selectionColor} !important`,
        },
        '.cm-activeLine': {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : 'rgba(0, 80, 200, 0.04)',
        },
        '.cm-gutters': {
          backgroundColor: gutterBg,
          color: gutterFg,
          borderRight: `1px solid ${isDark ? '#2B2D30' : '#E0E0E0'}`,
          paddingRight: '6px',
        },
        '.cm-activeLineGutter': {
          backgroundColor: lineHighlightColor,
          color: isDark ? '#A1A3AB' : '#333333',
        },
      },
      { dark: isDark }
    );

    // Parse token colors
    // Support IntelliJ attribute maps or tokenColors list
    const tokenRules: Array<{ tag: Tag | Tag[]; color?: string; fontStyle?: string; fontWeight?: string }> = [];

    // Helper to find color by scope/key
    const findTokenColor = (keys: string[]): string | undefined => {
      // 1. Look in tokenColors array
      if (Array.isArray(raw.tokenColors)) {
        for (const item of raw.tokenColors) {
          if (!item.settings?.foreground) continue;
          const scopes = Array.isArray(item.scope)
            ? item.scope
            : typeof item.scope === 'string'
            ? item.scope.split(',').map((s: string) => s.trim())
            : [];
          if (scopes.some((s: string) => keys.some((k) => s.toLowerCase().includes(k.toLowerCase())))) {
            return item.settings.foreground;
          }
        }
      }
      // 2. Look in attributes or editor / syntax map
      const attr = raw.attributes || raw.syntax || {};
      for (const k of keys) {
        if (attr[k]?.foreground) return attr[k].foreground;
        if (typeof attr[k] === 'string') return attr[k];
      }
      return undefined;
    };

    const keywordColor = findTokenColor(['keyword', 'KEYWORD']) || (isDark ? '#CF8E6D' : '#0033B3');
    const stringColor = findTokenColor(['string', 'STRING']) || (isDark ? '#6AAB73' : '#067D17');
    const numberColor = findTokenColor(['number', 'NUMBER']) || (isDark ? '#2AACB8' : '#1750EB');
    const commentColor = findTokenColor(['comment', 'COMMENT', 'LINE_COMMENT']) || (isDark ? '#7A7E85' : '#8C8C8C');
    const functionColor = findTokenColor(['function', 'method', 'FUNCTION_CALL']) || (isDark ? '#56A8F5' : '#00627A');
    const typeColor = findTokenColor(['type', 'class', 'CLASS_NAME']) || (isDark ? '#BCBEC4' : '#000000');
    const variableColor = findTokenColor(['variable', 'identifier', 'IDENTIFIER']) || fgColor;

    tokenRules.push(
      { tag: t.keyword, color: keywordColor, fontWeight: 'bold' },
      { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: variableColor },
      { tag: [t.function(t.variableName), t.labelName], color: functionColor },
      { tag: [t.color, t.constant(t.name), t.standard(t.name), t.atom, t.bool], color: keywordColor },
      { tag: [t.typeName, t.className, t.annotation, t.modifier, t.namespace], color: typeColor, fontWeight: 'bold' },
      { tag: [t.number], color: numberColor },
      { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp], color: fgColor },
      { tag: [t.meta, t.comment], color: commentColor, fontStyle: 'italic' },
      { tag: [t.processingInstruction, t.string, t.inserted], color: stringColor },
      { tag: t.invalid, color: '#FA6675' }
    );

    const customHighlightStyle = HighlightStyle.define(tokenRules);
    const extension: Extension = [customEditorTheme, syntaxHighlighting(customHighlightStyle)];

    return {
      name,
      isDark,
      extension,
    };
  } catch (err) {
    console.error('Failed to parse IntelliJ custom theme JSON:', err);
    return null;
  }
}
