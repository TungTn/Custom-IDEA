export type IdeThemeId = 
  | 'intellij-new-ui-dark'
  | 'darcula-classic'
  | 'intellij-light'
  | 'one-dark-pro'
  | 'dracula'
  | 'github-dark';

export interface ThemeColors {
  bgPrimary: string;      // Main background (#1E1F22, #2B2B2B, #FFFFFF)
  bgSecondary: string;    // Tool windows, dialogs, activity bar (#2B2D30, #3C3F41, #F2F2F2)
  bgTertiary: string;     // Inner panels, cards, inputs (#26282B, #313335, #EAEAEA)
  bgHover: string;        // Item hover background (#35373B, #4C5052, #E0E0E0)
  borderColor: string;    // Dividers and borders (#393B40, #515151, #D1D1D1)
  textPrimary: string;    // Main text color (#DFE1E5, #BBBBBB, #1F1F1F)
  textSecondary: string;  // Subtitle / muted text (#868A91, #808080, #6C707E)
  accentColor: string;    // JetBrains blue / selection (#3574F0, #2470B3, #CC7832)
  selectionBg: string;    // Active selection background (#214283, #113275, #B5D6FD)
  statusBarBg: string;    // Bottom status bar background
  gutterBg: string;       // Monaco editor line number gutter
  badgeBg: string;        // Pills and count badges
}

export interface SyntaxTokenColors {
  keyword: string;
  string: string;
  number: string;
  function: string;
  comment: string;
  type: string;
  variable: string;
  operator: string;
  annotation: string;
}

export interface ThemeDefinition {
  id: IdeThemeId;
  name: string;
  type: 'dark' | 'light';
  description: string;
  badge?: string;
  colors: ThemeColors;
  syntaxColors: SyntaxTokenColors;
}

export interface CustomColorScheme {
  id: string;
  name: string;
  baseTheme: IdeThemeId;
  tokens: Partial<SyntaxTokenColors>;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}
