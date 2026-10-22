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
    { token: 'delimiter', foreground: 'A9B7C6' }
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
