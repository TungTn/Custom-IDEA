import { ThemeDefinition, IdeThemeId, SyntaxTokenColors } from '../types/theme';
import { MARKETPLACE_THEMES } from './marketplaceThemes';
import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export { MARKETPLACE_THEMES };

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
      keyword: '#CF8E6D',
      string: '#6AAB73',
      number: '#2AACB8',
      function: '#56A8F5',
      comment: '#7A7E85',
      type: '#2AACB8',
      variable: '#BCBEC4',
      operator: '#BCBEC4',
      annotation: '#B3AE60',
      tagName: '#56A8F5',
      attributeName: '#BCBEC4',
      tagBracket: '#7A7E85',
      vueDirective: '#CF8E6D',
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
      tagName: '#E8BF6A',
      attributeName: '#BABABA',
      tagBracket: '#E8BF6A',
      vueDirective: '#CC7832',
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
      tagName: '#0033B3',
      attributeName: '#174AD4',
      tagBracket: '#0033B3',
      vueDirective: '#0033B3',
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

export const getCustomThemes = (): ThemeDefinition[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('intellij_custom_themes');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse custom themes:', e);
  }
  return [];
};

export const saveCustomTheme = (theme: ThemeDefinition): void => {
  if (typeof window === 'undefined') return;
  try {
    const existing = getCustomThemes().filter(t => t.id !== theme.id);
    const updated = [...existing, theme];
    localStorage.setItem('intellij_custom_themes', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('ide-custom-themes-updated'));
  } catch (e) {
    console.error('Failed to save custom theme:', e);
  }
};

export const removeCustomTheme = (id: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const existing = getCustomThemes().filter(t => t.id !== id);
    localStorage.setItem('intellij_custom_themes', JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent('ide-custom-themes-updated'));
  } catch (e) {
    console.error('Failed to remove custom theme:', e);
  }
};

export const getAllThemes = (): ThemeDefinition[] => {
  const custom = getCustomThemes();
  return [...IDE_THEMES, ...MARKETPLACE_THEMES, ...custom];
};

export const getThemeById = (themeId: IdeThemeId | string): ThemeDefinition => {
  const all = getAllThemes();
  return all.find(t => t.id === themeId) || IDE_THEMES[0];
};

export const buildCodeMirrorTheme = (
  theme: ThemeDefinition,
  customSyntax?: Partial<SyntaxTokenColors>
): Extension => {
  const col = theme.colors;
  const syn = { ...theme.syntaxColors, ...(customSyntax || {}) };
  const isDark = theme.type === 'dark';

  const cmTheme = EditorView.theme(
    {
      '&': {
        color: col.textPrimary,
        backgroundColor: col.bgPrimary,
        fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
        fontSize: '13px',
        height: '100%',
      },
      '.cm-content': {
        caretColor: col.accentColor,
        fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
        padding: '4px 0',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: col.accentColor,
        borderLeftWidth: '2px',
      },
      // CodeMirror selection background - high specificity to override CM defaults
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
        backgroundColor: `${col.selectionBg} !important`,
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: `${col.selectionBg} !important`,
      },
      '.cm-selectionBackground': {
        backgroundColor: `${col.selectionBg}cc !important`,
      },
      '.cm-content ::selection': {
        backgroundColor: `${col.selectionBg} !important`,
      },
      '.cm-selectionMatch': {
        backgroundColor: isDark ? 'rgba(33, 66, 131, 0.4)' : 'rgba(166, 210, 255, 0.6)',
        outline: isDark ? '1px solid rgba(88, 157, 246, 0.35)' : '1px solid #70ACFF',
        borderRadius: '2px',
      },
      '.cm-panels': {
        backgroundColor: col.bgSecondary,
        color: col.textPrimary,
      },
      '.cm-panels.cm-panels-top': {
        borderBottom: `1px solid ${col.borderColor}`,
      },
      '.cm-panels.cm-panels-bottom': {
        borderTop: `1px solid ${col.borderColor}`,
      },
      // Active line MUST be translucent so .cm-selectionBackground (at z-index: -1) shows through
      '.cm-activeLine': {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : 'rgba(0, 80, 200, 0.04)',
      },
      '.cm-gutters': {
        backgroundColor: col.gutterBg || col.bgPrimary,
        color: col.textSecondary,
        borderRight: `1px solid ${col.borderColor}`,
        paddingRight: '6px',
      },
      '.cm-activeLineGutter': {
        backgroundColor: isDark ? (col.bgTertiary || '#26282E') : '#E6EEFA',
        color: col.textPrimary,
      },
      '.cm-tooltip': {
        border: `1px solid ${col.borderColor}`,
        backgroundColor: col.bgSecondary,
        color: col.textPrimary,
        borderRadius: '4px',
        boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      '.cm-tooltip-autocomplete': {
        '& > ul > li[aria-selected]': {
          backgroundColor: col.selectionBg,
          color: col.textPrimary,
        },
      },
    },
    { dark: isDark }
  );

  const highlightStyle = HighlightStyle.define([
    { tag: [t.keyword, t.modifier], color: syn.keyword, fontWeight: 'bold' },
    { tag: [t.typeName, t.namespace, t.changed], color: syn.type, fontWeight: 'bold' },
    { tag: [t.className], color: syn.type }, // CSS Class selector
    { tag: [t.propertyName, t.definition(t.propertyName)], color: syn.variable }, // CSS property
    { tag: [t.definition(t.variableName), t.constant(t.name), t.standard(t.name), t.variableName], color: syn.variable }, // CSS vars and SCSS $var
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: syn.function },
    { tag: [t.labelName], color: syn.function }, // CSS ID selector (#id)
    { tag: [t.number], color: syn.number },
    { tag: [t.color], color: syn.number }, // CSS color literals (#hex, rgb)
    { tag: [t.unit], color: syn.keyword }, // CSS units (px, rem, em, %, vh, deg, s)
    { tag: [t.string, t.special(t.string), t.inserted, t.processingInstruction], color: syn.string },
    { tag: [t.atom, t.bool, t.null], color: syn.keyword, fontWeight: 'bold' },
    { tag: [t.meta, t.comment, t.lineComment, t.blockComment, t.docComment], color: syn.comment, fontStyle: 'italic' },
    { tag: [t.annotation], color: syn.annotation },
    { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp], color: syn.operator },
    { tag: [t.separator, t.punctuation, t.bracket, t.paren, t.brace], color: syn.operator },
    { tag: [t.name, t.character], color: col.textPrimary },
    { tag: t.strong, fontWeight: 'bold' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.link, color: col.accentColor, textDecoration: 'underline' },
    { tag: t.heading, fontWeight: 'bold', color: col.accentColor },
    // HTML / XML / Vue tags, brackets & attributes (Authentic JetBrains New UI)
    { tag: [t.tagName], color: syn.tagName || (isDark ? '#56A8F5' : '#0033B3'), fontWeight: '500' }, // HTML / XML / Vue element tags (template, div, span, img)
    { tag: [t.angleBracket], color: syn.tagBracket || (isDark ? '#7A7E85' : '#8C8C8C') }, // < > </ />
    { tag: [t.attributeName], color: syn.attributeName || (isDark ? '#BCBEC4' : '#174AD4') }, // HTML / XML attributes (class, id, style)
    { tag: [t.attributeValue], color: syn.string },
    { tag: t.invalid, color: '#FA6675' },
  ]);

  return [cmTheme, syntaxHighlighting(highlightStyle)];
};

export const applyIdeTheme = (
  themeId: IdeThemeId | string,
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

  // Clean up all existing theme-* classes and add new one
  const classesToRemove = Array.from(document.body.classList).filter(c => c.startsWith('theme-'));
  classesToRemove.forEach(c => document.body.classList.remove(c));
  document.body.classList.add(`theme-${theme.id}`);

  // Notify listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ide-theme-applied', { detail: theme }));
  }
};

