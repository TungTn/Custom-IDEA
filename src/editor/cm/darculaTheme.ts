import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Authentic JetBrains Darcula / IntelliJ New UI Dark Color Palette
export const darculaEditorTheme = EditorView.theme(
  {
    '&': {
      color: '#BCBEC4',
      backgroundColor: '#1E1F22',
      fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
      fontSize: '13px',
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#A8ADBD',
      fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
      padding: '4px 0',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#A8ADBD',
      borderLeftWidth: '2px',
    },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
      backgroundColor: '#214283 !important',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: '#214283 !important',
    },
    '.cm-selectionBackground': {
      backgroundColor: '#214283cc !important',
    },
    '.cm-content ::selection': {
      backgroundColor: '#214283 !important',
    },
    '.cm-panels': {
      backgroundColor: '#2B2D30',
      color: '#BCBEC4',
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: '1px solid #1E1F22',
    },
    '.cm-panels.cm-panels-bottom': {
      borderTop: '1px solid #1E1F22',
    },
    '.cm-searchMatch': {
      backgroundColor: '#32593D',
      outline: '1px solid #3E6E4B',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: '#3E6E4B',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.045)',
    },
    '.cm-selectionMatch': {
      backgroundColor: 'rgba(33, 66, 131, 0.4)',
      outline: '1px solid rgba(88, 157, 246, 0.35)',
      borderRadius: '2px',
    },
    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: '#3B514D',
      outline: '1px solid #4D6E67',
    },
    '.cm-gutters': {
      backgroundColor: '#1E1F22',
      color: '#4E5157',
      borderRight: '1px solid #2B2D30',
      paddingRight: '6px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#26282E',
      color: '#A1A3AB',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#2B2D30',
      border: 'none',
      color: '#6F737A',
    },
    '.cm-tooltip': {
      border: '1px solid #393B40',
      backgroundColor: '#2B2D30',
      color: '#DFE1E5',
      borderRadius: '4px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    },
    '.cm-tooltip .cm-tooltip-arrow:before': {
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: '#2E436E',
        color: '#DFE1E5',
      },
      '& > ul > li': {
        padding: '3px 8px',
        fontSize: '12px',
      },
    },
  },
  { dark: true }
);

export const darculaHighlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.modifier], color: '#CC7832', fontWeight: 'bold' }, // JetBrains Darcula orange
  { tag: [t.typeName, t.namespace, t.changed], color: '#A9B7C6', fontWeight: 'bold' },
  { tag: [t.className], color: '#E8BF6A' }, // JetBrains Class / CSS Class Selector (.btn, .box)
  { tag: [t.propertyName, t.definition(t.propertyName)], color: '#9876AA' }, // lavender purple (CSS properties)
  { tag: [t.definition(t.variableName), t.constant(t.name), t.standard(t.name), t.variableName], color: '#9876AA' }, // purple (CSS vars --color, SCSS $var)
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#FFC66D' }, // warm yellow
  { tag: [t.labelName], color: '#FFC66D' }, // CSS ID selector (#app) / label
  { tag: [t.number], color: '#6897BB' }, // soft blue
  { tag: [t.color], color: '#6897BB' }, // CSS color literals (#ffffff, rgb)
  { tag: [t.unit], color: '#CC7832' }, // CSS units (px, rem, em, %, vh, deg, s)
  { tag: [t.string, t.special(t.string), t.inserted, t.processingInstruction], color: '#6A8759' }, // JetBrains Darcula green
  { tag: [t.atom, t.bool, t.null], color: '#CC7832', fontWeight: 'bold' }, // CSS keywords (flex, block, none, solid)
  { tag: [t.meta, t.comment, t.lineComment, t.blockComment, t.docComment], color: '#808080', fontStyle: 'italic' },
  { tag: [t.annotation], color: '#BBB529' },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp], color: '#A9B7C6' },
  { tag: [t.separator, t.punctuation, t.bracket, t.paren, t.brace], color: '#A9B7C6' },
  { tag: [t.name, t.character], color: '#A9B7C6' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#56A8F5', textDecoration: 'underline' },
  { tag: t.heading, fontWeight: 'bold', color: '#56A8F5' },
  { tag: [t.tagName], color: '#E8BF6A', fontWeight: '500' }, // JSX / HTML / CSS element tags (div, span, body)
  { tag: [t.angleBracket], color: '#E8BF6A' }, // < > </ />
  { tag: [t.attributeName], color: '#BABABA' }, // JSX / HTML attributes
  { tag: [t.attributeValue], color: '#6A8759' },
  { tag: t.invalid, color: '#FA6675' },
]);

export const darculaTheme: Extension = [
  darculaEditorTheme,
  syntaxHighlighting(darculaHighlightStyle),
];
