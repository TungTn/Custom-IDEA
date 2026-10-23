import { editor } from 'monaco-editor';

export const intellijNewUIDarkTheme: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'DFE1E5', background: '1E1F22' },
    { token: 'comment', foreground: '7A7E85', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'CC7832', fontStyle: 'bold' },
    { token: 'number', foreground: '6897BB' },
    { token: 'string', foreground: '6A8759' },
    { token: 'type', foreground: '299999' },
    { token: 'function', foreground: 'FFC66D' },
    { token: 'variable', foreground: '9876AA' },
    { token: 'operator', foreground: 'A9B7C6' },
    { token: 'delimiter', foreground: 'A9B7C6' },
    { token: 'delimiter.bracket', foreground: 'A9B7C6' },
    { token: 'tag', foreground: 'E8BF6A' },
    { token: 'tag.id', foreground: '9876AA' },
    { token: 'tag.class', foreground: '9876AA' },
    { token: 'attribute.name', foreground: 'BABABA' },
    { token: 'attribute.value', foreground: '6A8759' },
    { token: 'keyword.directive', foreground: 'E8BF6A', fontStyle: 'bold' },
    { token: 'metatag', foreground: 'BBB529' },
    { token: 'identifier', foreground: 'DFE1E5' },
    { token: 'constant', foreground: '9876AA' }
  ],
  colors: {
    'editor.background': '#1E1F22',
    'editor.foreground': '#DFE1E5',
    'editorLineNumber.foreground': '#4E5157',
    'editorLineNumber.activeForeground': '#A1A3A8',
    'editorCursor.foreground': '#A7A7A7',
    'editor.selectionBackground': '#214283',
    'editor.inactiveSelectionBackground': '#2E436E',
    'editor.lineHighlightBackground': '#26282E',
    'editorGutter.background': '#1E1F22',
    'editorGutter.modifiedBackground': '#59A869',
    'editorGutter.addedBackground': '#437EE3',
    'editorGutter.deletedBackground': '#E05555',
    'editorIndentGuide.background': '#313438',
    'editorIndentGuide.activeBackground': '#4E5157',
    'editorWhitespace.foreground': '#313438',
    'editorBracketMatch.background': '#3B514D',
    'editorBracketMatch.border': '#3B514D'
  }
};
