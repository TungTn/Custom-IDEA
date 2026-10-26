import { editor } from 'monaco-editor';
import { ThemeDefinition, IdeThemeId, SyntaxTokenColors } from '../types/theme';

export const IDE_THEMES: ThemeDefinition[] = [
  {
    id: 'intellij-new-ui-dark',
    name: 'IntelliJ New UI Dark',
    type: 'dark',
    description: 'The sleek, minimalist default theme for modern JetBrains IDEs with refined grays and soft blue accents.',
    badge: 'Default',
    colors: {
      bgPrimary: '#1E1F22',
      bgSecondary: '#2B2D30',
      bgTertiary: '#26282B',
      bgHover: '#35373B',
      borderColor: '#393B40',
      textPrimary: '#DFE1E5',
      textSecondary: '#868A91',
      accentColor: '#3574F0',
      selectionBg: '#214283',
      statusBarBg: '#2B2D30',
      gutterBg: '#1E1F22',
      badgeBg: '#3574F022',
    },
    syntaxColors: {
      keyword: '#CC7832',
      string: '#6A8759',
      number: '#6897BB',
      function: '#FFC66D',
      comment: '#7A7E85',
      type: '#299999',
      variable: '#9876AA',
      operator: '#A9B7C6',
      annotation: '#BBB529',
    }
  },
  {
    id: 'darcula-classic',
    name: 'Darcula Classic',
    type: 'dark',
    description: 'The iconic legendary dark theme that defined IntelliJ IDEA for a decade, featuring warm charcoal tones.',
    badge: 'Classic',
    colors: {
      bgPrimary: '#2B2B2B',
      bgSecondary: '#3C3F41',
      bgTertiary: '#313335',
      bgHover: '#4C5052',
      borderColor: '#515151',
      textPrimary: '#A9B7C6',
      textSecondary: '#808080',
      accentColor: '#CC7832',
      selectionBg: '#214283',
      statusBarBg: '#3C3F41',
      gutterBg: '#313335',
      badgeBg: '#CC783233',
    },
    syntaxColors: {
      keyword: '#CC7832',
      string: '#6A8759',
      number: '#6897BB',
      function: '#FFC66D',
      comment: '#808080',
      type: '#299999',
      variable: '#9876AA',
      operator: '#A9B7C6',
      annotation: '#BBB529',
    }
  },
  {
    id: 'intellij-light',
    name: 'IntelliJ Light',
    type: 'light',
    description: 'Clean, high-readability daylight theme crafted for bright environments with crisp contrast and blue highlights.',
    badge: 'Light',
    colors: {
      bgPrimary: '#FFFFFF',
      bgSecondary: '#F2F2F2',
      bgTertiary: '#EAEAEA',
      bgHover: '#DFDFDF',
      borderColor: '#D1D1D1',
      textPrimary: '#1F1F1F',
      textSecondary: '#6C707E',
      accentColor: '#2470B3',
      selectionBg: '#B5D6FD',
      statusBarBg: '#F2F2F2',
      gutterBg: '#FAFAFA',
      badgeBg: '#2470B322',
    },
    syntaxColors: {
      keyword: '#0033B3',
      string: '#067D17',
      number: '#1750EB',
      function: '#00627A',
      comment: '#8C8C8C',
      type: '#26747A',
      variable: '#871094',
      operator: '#000000',
      annotation: '#9E880D',
    }
  },
  {
    id: 'one-dark-pro',
    name: 'One Dark Pro',
    type: 'dark',
    description: 'Popular deep navy theme with vibrant pastel syntax coloring inspired by modern text editors.',
    badge: 'Popular',
    colors: {
      bgPrimary: '#282C34',
      bgSecondary: '#21252B',
      bgTertiary: '#1E2227',
      bgHover: '#2C313C',
      borderColor: '#3E4451',
      textPrimary: '#ABB2BF',
      textSecondary: '#5C6370',
      accentColor: '#61AFEF',
      selectionBg: '#3E4451',
      statusBarBg: '#21252B',
      gutterBg: '#282C34',
      badgeBg: '#61AFEF22',
    },
    syntaxColors: {
      keyword: '#C678DD',
      string: '#98C379',
      number: '#D19A66',
      function: '#61AFEF',
      comment: '#5C6370',
      type: '#E5C07B',
      variable: '#E06C75',
      operator: '#56B6C2',
      annotation: '#D19A66',
    }
  },
  {
    id: 'dracula',
    name: 'Dracula',
    type: 'dark',
    description: 'Famous gothic dark theme with prominent purple accents, neon pink strings, and cyan operators.',
    badge: 'Vibrant',
    colors: {
      bgPrimary: '#282A36',
      bgSecondary: '#21222C',
      bgTertiary: '#191A21',
      bgHover: '#44475A',
      borderColor: '#6272A4',
      textPrimary: '#F8F8F2',
      textSecondary: '#6272A4',
      accentColor: '#BD93F9',
      selectionBg: '#44475A',
      statusBarBg: '#21222C',
      gutterBg: '#282A36',
      badgeBg: '#BD93F933',
    },
    syntaxColors: {
      keyword: '#FF79C6',
      string: '#F1FA8C',
      number: '#BD93F9',
      function: '#50FA7B',
      comment: '#6272A4',
      type: '#8BE9FD',
      variable: '#F8F8F2',
      operator: '#FF79C6',
      annotation: '#FFB86C',
    }
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    type: 'dark',
    description: 'Authentic GitHub Dark appearance with high contrast text and signature GitHub blue accents.',
    badge: 'Modern',
    colors: {
      bgPrimary: '#0D1117',
      bgSecondary: '#161B22',
      bgTertiary: '#21262D',
      bgHover: '#30363D',
      borderColor: '#30363D',
      textPrimary: '#C9D1D9',
      textSecondary: '#8B949E',
      accentColor: '#58A6FF',
      selectionBg: '#1F6FEB44',
      statusBarBg: '#161B22',
      gutterBg: '#0D1117',
      badgeBg: '#58A6FF22',
    },
    syntaxColors: {
      keyword: '#FF7B72',
      string: '#A5D6FF',
      number: '#79C0FF',
      function: '#D2A8FF',
      comment: '#8B949E',
      type: '#FFA657',
      variable: '#C9D1D9',
      operator: '#79C0FF',
      annotation: '#FFA657',
    }
  }
];

export const getThemeById = (themeId: IdeThemeId): ThemeDefinition => {
  return IDE_THEMES.find(t => t.id === themeId) || IDE_THEMES[0];
};

export const buildMonacoTheme = (
  theme: ThemeDefinition,
  customSyntax?: Partial<SyntaxTokenColors>
): editor.IStandaloneThemeData => {
  const syn = { ...theme.syntaxColors, ...(customSyntax || {}) };
  const col = theme.colors;

  return {
    base: theme.type === 'light' ? 'vs' : 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: col.textPrimary.replace('#', ''), background: col.bgPrimary.replace('#', '') },
      { token: 'comment', foreground: syn.comment.replace('#', ''), fontStyle: 'italic' },
      { token: 'keyword', foreground: syn.keyword.replace('#', ''), fontStyle: 'bold' },
      { token: 'number', foreground: syn.number.replace('#', '') },
      { token: 'string', foreground: syn.string.replace('#', '') },
      { token: 'type', foreground: syn.type.replace('#', '') },
      { token: 'function', foreground: syn.function.replace('#', '') },
      { token: 'variable', foreground: syn.variable.replace('#', '') },
      { token: 'operator', foreground: syn.operator.replace('#', '') },
      { token: 'delimiter', foreground: syn.operator.replace('#', '') },
      { token: 'delimiter.bracket', foreground: syn.operator.replace('#', '') },
      { token: 'tag', foreground: syn.keyword.replace('#', '') },
      { token: 'tag.id', foreground: syn.variable.replace('#', '') },
      { token: 'tag.class', foreground: syn.variable.replace('#', '') },
      { token: 'attribute.name', foreground: col.textSecondary.replace('#', '') },
      { token: 'attribute.value', foreground: syn.string.replace('#', '') },
      { token: 'keyword.directive', foreground: syn.annotation.replace('#', ''), fontStyle: 'bold' },
      { token: 'metatag', foreground: syn.annotation.replace('#', '') },
      { token: 'identifier', foreground: col.textPrimary.replace('#', '') },
      { token: 'constant', foreground: syn.variable.replace('#', '') }
    ],
    colors: {
      'editor.background': col.bgPrimary,
      'editor.foreground': col.textPrimary,
      'editorLineNumber.foreground': col.textSecondary,
      'editorLineNumber.activeForeground': col.textPrimary,
      'editorCursor.foreground': col.accentColor,
      'editor.selectionBackground': col.selectionBg,
      'editor.inactiveSelectionBackground': col.selectionBg + '88',
      'editor.lineHighlightBackground': theme.type === 'light' ? '#EAEFF8' : '#26282E',
      'editorGutter.background': col.gutterBg,
      'editorGutter.modifiedBackground': '#59A869',
      'editorGutter.addedBackground': '#437EE3',
      'editorGutter.deletedBackground': '#E05555',
      'editorIndentGuide.background': theme.type === 'light' ? '#E5E5E5' : '#313438',
      'editorIndentGuide.activeBackground': theme.type === 'light' ? '#C0C0C0' : '#4E5157',
      'editorWhitespace.foreground': theme.type === 'light' ? '#E0E0E0' : '#313438',
      'editorBracketMatch.background': col.accentColor + '33',
      'editorBracketMatch.border': col.accentColor
    }
  };
};

export const applyIdeTheme = (
  themeId: IdeThemeId,
  customSyntax?: Partial<SyntaxTokenColors>
) => {
  const theme = getThemeById(themeId);
  const root = document.documentElement;

  // Apply CSS custom properties to the document root
  root.style.setProperty('--bg-primary', theme.colors.bgPrimary);
  root.style.setProperty('--bg-secondary', theme.colors.bgSecondary);
  root.style.setProperty('--bg-tertiary', theme.colors.bgTertiary);
  root.style.setProperty('--bg-hover', theme.colors.bgHover);
  root.style.setProperty('--border-color', theme.colors.borderColor);
  root.style.setProperty('--text-primary', theme.colors.textPrimary);
  root.style.setProperty('--text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--accent-color', theme.colors.accentColor);
  root.style.setProperty('--selection-bg', theme.colors.selectionBg);
  root.style.setProperty('--status-bar-bg', theme.colors.statusBarBg);
  root.style.setProperty('--gutter-bg', theme.colors.gutterBg);

  // Set color-scheme for native inputs
  root.style.colorScheme = theme.type;

  // Also apply class on body for Tailwind or scoped styles
  document.body.classList.remove(
    'theme-intellij-new-ui-dark',
    'theme-darcula-classic',
    'theme-intellij-light',
    'theme-one-dark-pro',
    'theme-dracula',
    'theme-github-dark'
  );
  document.body.classList.add(`theme-${theme.id}`);

  // Register theme in Monaco Editor if available
  if (typeof window !== 'undefined' && (window as any).monaco?.editor) {
    const monaco = (window as any).monaco;
    const monacoTheme = buildMonacoTheme(theme, customSyntax);
    monaco.editor.defineTheme(theme.id, monacoTheme);
    monaco.editor.setTheme(theme.id);
  }
};
