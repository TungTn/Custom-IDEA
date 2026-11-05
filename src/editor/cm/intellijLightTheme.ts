import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Authentic JetBrains IntelliJ Light Color Palette
export const intellijLightEditorTheme = EditorView.theme(
  {
    '&': {
      color: '#080808',
      backgroundColor: '#FFFFFF',
      fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
      fontSize: '13px',
      lineHeight: '1.5',
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#000000',
      fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
      padding: '4px 0',
      lineHeight: '1.5',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#000000',
      borderLeftWidth: '2px',
    },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
      backgroundColor: '#A6D2FF !important',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: '#A6D2FF !important',
    },
    '.cm-selectionBackground': {
      backgroundColor: '#A6D2FFcc !important',
    },
    '.cm-content ::selection': {
      backgroundColor: '#A6D2FF !important',
    },
    '.cm-panels': {
      backgroundColor: '#F2F2F2',
      color: '#080808',
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: '1px solid #E2E2E2',
    },
    '.cm-panels.cm-panels-bottom': {
      borderTop: '1px solid #E2E2E2',
    },
    '.cm-searchMatch': {
      backgroundColor: '#FFE8A8',
      outline: '1px solid #E5C365',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: '#FFCC66',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(0, 80, 200, 0.04)',
    },
    '.cm-selectionMatch': {
      backgroundColor: 'rgba(166, 210, 255, 0.6)',
      outline: '1px solid #70ACFF',
      borderRadius: '2px',
    },
    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: '#D8EDFF',
      outline: '1px solid #99CCFF',
    },
    '.cm-gutters': {
      backgroundColor: '#F8F9FA',
      color: '#8A8A8A',
      borderRight: '1px solid #E8E8E8',
      paddingRight: '6px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#F5F8FE',
      color: '#262626',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#EAEAEA',
      border: 'none',
      color: '#8A8A8A',
    },
    '.cm-tooltip': {
      border: '1px solid #D1D1D1',
      backgroundColor: '#F8F9FA',
      color: '#1F1F1F',
      borderRadius: '4px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    },
    '.cm-tooltip .cm-tooltip-arrow:before': {
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: '#3574F0',
        color: '#FFFFFF',
      },
      '& > ul > li': {
        padding: '3px 8px',
        fontSize: '12px',
      },
    },
  },
  { dark: false }
);

export const intellijLightHighlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.modifier], color: '#0033B3', fontWeight: 'bold' },
  { tag: [t.typeName, t.namespace, t.changed], color: '#267F99', fontWeight: 'bold' },
  { tag: [t.className], color: '#26747A' }, // CSS Class selector
  { tag: [t.propertyName, t.definition(t.propertyName)], color: '#660E7A' }, // CSS properties
  { tag: [t.definition(t.variableName), t.constant(t.name), t.standard(t.name), t.variableName], color: '#660E7A' }, // CSS / SCSS variables
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#00627A' },
  { tag: [t.labelName], color: '#00627A' }, // CSS ID selector (#app)
  { tag: [t.number], color: '#1750EB' },
  { tag: [t.color], color: '#1750EB' }, // CSS hex/rgb color
  { tag: [t.unit], color: '#0033B3' }, // CSS units (px, rem, em, %)
  { tag: [t.string, t.special(t.string), t.inserted, t.processingInstruction], color: '#067D17' },
  { tag: [t.atom, t.bool, t.null], color: '#0033B3', fontWeight: 'bold' },
  { tag: [t.meta, t.comment, t.lineComment, t.blockComment, t.docComment], color: '#8C8C8C', fontStyle: 'italic' },
  { tag: [t.annotation], color: '#9E880D' },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp], color: '#000000' },
  { tag: [t.separator, t.punctuation, t.bracket, t.paren, t.brace], color: '#080808' },
  { tag: [t.name, t.character], color: '#080808' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#2470B3', textDecoration: 'underline' },
  { tag: [t.tagName], color: '#0033B3', fontWeight: '500' },
  { tag: [t.angleBracket], color: '#0033B3' },
  { tag: [t.attributeName], color: '#174AD4' },
  { tag: [t.attributeValue], color: '#067D17' },
  { tag: t.invalid, color: '#D92626' },
]);

export const intellijLightTheme: Extension = [
  intellijLightEditorTheme,
  syntaxHighlighting(intellijLightHighlightStyle),
];
