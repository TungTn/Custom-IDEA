import { IdeSettings } from '../features/settings/SettingsModal';
import { IdeThemeId } from '../types/theme';

export interface ComponentOption {
  id: string;
  label: string;
  description: string;
  iconName: string;
  category: 'ui' | 'editor' | 'system' | 'tools' | 'sdk';
  files: string[];
  present: boolean;
  summary?: string;
}

export interface ImportedSettingsResult {
  updatedSettings: Partial<IdeSettings>;
  customJdks?: Array<{ name: string; path: string; version?: string }>;
  customKeymap?: Record<string, string[]>;
  liveTemplates?: any[];
  dataSources?: any[];
  appliedCategories: string[];
}

/**
 * Native XML parsing helpers using DOMParser
 */
function getXmlDoc(xmlStr: string): Document | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'text/xml');
    if (doc.querySelector('parsererror')) {
      return null;
    }
    return doc;
  } catch {
    return null;
  }
}

function getOptionValue(root: Element | Document, name: string): string | null {
  const opt = root.querySelector(`option[name="${name}"]`);
  return opt ? opt.getAttribute('value') : null;
}

/**
 * Resolve $USER_HOME$ in path strings
 */
function resolveUserHome(pathStr: string): string {
  return pathStr.replace(/[$]USER_HOME[$]/g, '~').replace(/\\/g, '/');
}

export function normalizeKeystroke(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map(token => {
      const lower = token.toLowerCase();
      switch (lower) {
        case 'ctrl':
        case 'control':
          return 'Ctrl';
        case 'alt':
          return 'Alt';
        case 'shift':
          return 'Shift';
        case 'meta':
        case 'cmd':
        case 'command':
          return 'Meta';
        case 'down':
          return 'ArrowDown';
        case 'up':
          return 'ArrowUp';
        case 'left':
          return 'ArrowLeft';
        case 'right':
          return 'ArrowRight';
        case 'enter':
          return 'Enter';
        case 'escape':
        case 'esc':
          return 'Escape';
        case 'back_space':
        case 'backspace':
          return 'Backspace';
        case 'delete':
        case 'del':
          return 'Delete';
        case 'tab':
          return 'Tab';
        case 'space':
          return 'Space';
        default:
          return token.length === 1 ? token.toUpperCase() : token.charAt(0).toUpperCase() + token.slice(1);
      }
    })
    .join('+');
}

export const INTELLIJ_ACTION_MAP: Record<string, { internalId: string; label: string }> = {
  'EditorDuplicate': { internalId: 'edit.duplicateLine', label: 'Duplicate Line or Selection' },
  'MoveLineDown': { internalId: 'edit.moveLineDown', label: 'Move Line Down' },
  'MoveLineUp': { internalId: 'edit.moveLineUp', label: 'Move Line Up' },
  'Editor Cut': { internalId: 'edit.cut', label: 'Cut' },
  'Editor Redo': { internalId: 'edit.redo', label: 'Redo' },
  'EditorDeleteLine': { internalId: 'edit.deleteLine', label: 'Delete Line' },
  'FindUsages': { internalId: 'find.usages', label: 'Find Usages' },
  'RenameElement': { internalId: 'refactor.rename', label: 'Rename Symbol / File...' },
  'ShowIntentionActions': { internalId: 'editor.quickFix', label: 'Show Intention Actions' },
  'ReformatCode': { internalId: 'code.reformat', label: 'Reformat Code' },
  'GotoLine': { internalId: 'navigate.goToLine', label: 'Go to Line / Column...' },
  'SearchEverywhere': { internalId: 'navigate.searchEverywhere', label: 'Search Everywhere' },
  'SaveAll': { internalId: 'file.saveAll', label: 'Save All' },
  'CloseContent': { internalId: 'file.closeActiveTab', label: 'Close Active Tab' },
  'CommentByLineComment': { internalId: 'code.commentLine', label: 'Comment with Line Comment' },
  'CompileDirty': { internalId: 'build.buildProject', label: 'Build Project' },
  'Run': { internalId: 'run.runActive', label: 'Run \'Desktop IDE\'' },
  'Debug': { internalId: 'run.debugActive', label: 'Debug \'Desktop IDE\'' },
  'Stop': { internalId: 'run.stop', label: 'Stop Process' },
  'ActivateProjectToolWindow': { internalId: 'view.toggleProject', label: 'Toggle Project View' },
  'ActivateTerminalToolWindow': { internalId: 'view.toggleTerminal', label: 'Toggle Terminal' },
  'ActivateRunToolWindow': { internalId: 'view.toggleRun', label: 'Toggle Run Console' },
  'CheckinProject': { internalId: 'git.commit', label: 'Commit Changes...' },
  'ShowSettings': { internalId: 'file.settings', label: 'Open Settings Dialog' },
};

/**
 * IntelliJ Settings Service
 */
export class IntelliJSettingsService {
  /**
   * Scan imported raw XML entries and determine which components are available
   */
  static analyzeImportedEntries(entries: Record<string, string>): ComponentOption[] {
    const keys = Object.keys(entries);
    const has = (prefix: string) => keys.some(k => k.toLowerCase().includes(prefix.toLowerCase()));

    // 1. UI & Theme
    const hasLaf = has('options/laf.xml') || has('options/colors.scheme.xml') || has('options/ui.lnf.xml');
    let lafSummary = 'Default Look & Feel';
    let themeDisplay = '';
    if (entries['options/colors.scheme.xml']) {
      const doc = getXmlDoc(entries['options/colors.scheme.xml']);
      themeDisplay = doc?.querySelector('global_color_scheme')?.getAttribute('name') || '';
    }
    if (!themeDisplay && entries['options/laf.xml']) {
      const doc = getXmlDoc(entries['options/laf.xml']);
      themeDisplay = doc?.querySelector('preferred-dark-laf')?.getAttribute('themeId') 
        || doc?.querySelector('preferred-light-laf')?.getAttribute('themeId') || '';
    }
    if (themeDisplay) {
      lafSummary = `Theme: ${themeDisplay} (Mapped to IntelliJ New UI Dark)`;
    }

    // 2. Editor & Fonts
    const hasEditor = has('options/editor-font.xml') || has('options/editor.xml');
    let editorSummary = 'Editor font and typography options';
    if (entries['options/editor-font.xml']) {
      const doc = getXmlDoc(entries['options/editor-font.xml']);
      const font = doc?.querySelector('option[name="FONT_FAMILY"]')?.getAttribute('value');
      const size = doc?.querySelector('option[name="FONT_SIZE"]')?.getAttribute('value');
      if (font || size) editorSummary = `${font || 'Default'} ${size ? size + 'px' : ''}`;
    }

    // 3. Code Style & Formatter
    const hasCodeStyle = keys.some(k => k.startsWith('codestyles/') || k.includes('code.style.schemes.xml'));
    let codeStyleSummary = 'Tab size, indent, line wrap rules';
    let csScheme = '';
    if (entries['options/code.style.schemes.xml']) {
      const doc = getXmlDoc(entries['options/code.style.schemes.xml']);
      csScheme = doc?.querySelector('option[name="CURRENT_SCHEME_NAME"]')?.getAttribute('value') || '';
    }
    const csKey = (csScheme && keys.find(k => k.toLowerCase() === `codestyles/${csScheme.toLowerCase()}.xml`))
      || keys.find(k => k.startsWith('codestyles/'));
    if (csKey && entries[csKey]) {
      const doc = getXmlDoc(entries[csKey]);
      const schemeName = doc?.querySelector('code_scheme')?.getAttribute('name') || csScheme || 'Custom';
      codeStyleSummary = `Scheme: ${schemeName}`;
    }

    // 4. Keymaps (Shortcuts)
    const hasKeymap = keys.some(k => k.startsWith('keymaps/') || k.includes('keymap.xml') || k.includes('keymapFlags.xml'));
    let keymapSummary = 'Keyboard action shortcuts';
    let activeKm = '';
    const optKm = entries['options/windows/keymap.xml'] || entries['options/keymap.xml'];
    if (optKm) {
      const doc = getXmlDoc(optKm);
      activeKm = doc?.querySelector('active_keymap')?.getAttribute('name') || '';
    }
    const kmKey = (activeKm && keys.find(k => k.toLowerCase() === `keymaps/${activeKm.toLowerCase()}.xml`))
      || keys.find(k => k.startsWith('keymaps/'));
    if (kmKey && entries[kmKey]) {
      const kmDoc = getXmlDoc(entries[kmKey]);
      const kmName = kmDoc?.querySelector('keymap')?.getAttribute('name') || activeKm || 'Custom Keymap';
      const actionCount = kmDoc?.querySelectorAll('action').length || 0;
      keymapSummary = `${kmName} (${actionCount} customized actions)`;
    }

    // 5. Terminal Options
    const hasTerminal = has('options/terminal.xml') || has('options/terminal-font.xml') || has('options/terminal-local.xml');
    let termSummary = 'Shell path and terminal environment';
    if (entries['options/terminal.xml']) {
      const doc = getXmlDoc(entries['options/terminal.xml']);
      const shell = doc?.querySelector('option[name="myShellPath"]')?.getAttribute('value');
      if (shell) termSummary = `Shell: ${shell}`;
    }

    // 6. System & General Settings
    const hasGeneral = has('options/ide.general.xml') || has('options/advancedSettings.xml');
    let genSummary = 'Exit confirmation, project open mode';
    if (entries['options/ide.general.xml']) {
      const doc = getXmlDoc(entries['options/ide.general.xml']);
      const confirmExit = doc?.querySelector('option[name="confirmExit"]')?.getAttribute('value');
      const openMode = doc?.querySelector('option[name="confirmOpenNewProject2"]')?.getAttribute('value');
      genSummary = `Confirm Exit: ${confirmExit ?? 'true'}, Open Mode: ${openMode === '0' ? 'This Window' : 'Ask'}`;
    }

    // 7. Project View & Tree
    const hasProjectView = has('options/projectView.xml');
    let pvSummary = 'Compact middle packages, autoscroll from source';
    if (entries['options/projectView.xml']) {
      const doc = getXmlDoc(entries['options/projectView.xml']);
      const autoscroll = doc?.querySelector('option[name="autoscrollFromSource"]')?.getAttribute('value');
      if (autoscroll) pvSummary = `Autoscroll: ${autoscroll}`;
    }

    // 8. Database Tools
    const hasDatabase = has('options/databaseSettings.xml') || has('options/databaseDrivers.xml') || has('options/csvSettings.xml');
    let dbSummary = 'Data editor paging, query execution, CSV format';
    if (entries['options/databaseSettings.xml']) {
      dbSummary = 'Paging, parameter patterns, CSV/TSV table formats';
    }

    // 9. SDKs & JDKs
    const hasJdk = has('options/jdk.table.xml');
    let jdkSummary = 'Configured Java SDKs & toolchains';
    if (entries['options/jdk.table.xml']) {
      const doc = getXmlDoc(entries['options/jdk.table.xml']);
      const jdks = doc?.querySelectorAll('jdk');
      const firstJdk = jdks?.[0]?.querySelector('name')?.getAttribute('value');
      jdkSummary = `${jdks?.length || 0} installed JDK(s) (e.g. ${firstJdk || 'JavaSDK'})`;
    }

    // 10. Maven Configuration & Wrapper
    const hasMaven = has('options/windows/maven.wrapper.mapping.xml') || has('options/maven.wrapper.mapping.xml');
    let mavenSummary = 'Maven wrapper mappings and distribution paths';
    const mvnMapping = entries['options/windows/maven.wrapper.mapping.xml'] || entries['options/maven.wrapper.mapping.xml'];
    if (mvnMapping) {
      const doc = getXmlDoc(mvnMapping);
      const val = doc?.querySelector('map > entry')?.getAttribute('value');
      if (val) {
        const parts = val.split(/[/\\]/);
        mavenSummary = `Discovered Maven distribution: ${parts[parts.length - 1] || val}`;
      }
    }

    return [
      {
        id: 'ui',
        label: 'UI & Theme',
        description: 'Look and feel, dark/light theme, UI elements',
        iconName: 'Palette',
        category: 'ui',
        files: ['options/laf.xml', 'options/colors.scheme.xml', 'options/ui.lnf.xml'],
        present: hasLaf,
        summary: lafSummary
      },
      {
        id: 'editor',
        label: 'Editor & Fonts',
        description: 'Font family, font size, line spacing, code formatting',
        iconName: 'Type',
        category: 'editor',
        files: ['options/editor-font.xml', 'options/editor.xml'],
        present: hasEditor,
        summary: editorSummary
      },
      {
        id: 'codestyle',
        label: 'Code Style Schemes',
        description: 'Language indentation, tab size, line margins and wraps',
        iconName: 'AlignLeft',
        category: 'editor',
        files: ['codestyles/', 'options/code.style.schemes.xml'],
        present: hasCodeStyle,
        summary: codeStyleSummary
      },
      {
        id: 'keymap',
        label: 'Keymaps & Shortcuts',
        description: 'Keyboard shortcuts configuration and key bindings',
        iconName: 'Keyboard',
        category: 'system',
        files: ['keymaps/', 'options/windows/keymap.xml'],
        present: hasKeymap,
        summary: keymapSummary
      },
      {
        id: 'terminal',
        label: 'Terminal Shell',
        description: 'Configured shell executable path and terminal fonts',
        iconName: 'Terminal',
        category: 'tools',
        files: ['options/terminal.xml', 'options/terminal-font.xml', 'options/terminal-local.xml'],
        present: hasTerminal,
        summary: termSummary
      },
      {
        id: 'general',
        label: 'System & General',
        description: 'Confirm on exit, project opening behaviors, tips on startup',
        iconName: 'Settings',
        category: 'system',
        files: ['options/ide.general.xml', 'options/advancedSettings.xml'],
        present: hasGeneral,
        summary: genSummary
      },
      {
        id: 'projectView',
        label: 'Project View',
        description: 'Compact middle packages, autoscroll from source',
        iconName: 'FolderTree',
        category: 'ui',
        files: ['options/projectView.xml'],
        present: hasProjectView,
        summary: pvSummary
      },
      {
        id: 'database',
        label: 'Database Tools & SQL',
        description: 'Data editor page size, CSV/TSV formats, query row limits',
        iconName: 'Database',
        category: 'tools',
        files: ['options/databaseSettings.xml', 'options/csvSettings.xml'],
        present: hasDatabase,
        summary: dbSummary
      },
      {
        id: 'jdk',
        label: 'Installed SDKs / JDKs',
        description: 'Discovered JDK home paths, GraalVM, OpenJDK instances',
        iconName: 'Cpu',
        category: 'sdk',
        files: ['options/jdk.table.xml'],
        present: hasJdk,
        summary: jdkSummary
      },
      {
        id: 'maven',
        label: 'Maven Build Tools',
        description: 'Maven distribution paths, wrapper mapping, runner JDK',
        iconName: 'Hammer',
        category: 'tools',
        files: ['options/windows/maven.wrapper.mapping.xml', 'options/maven.wrapper.mapping.xml'],
        present: hasMaven,
        summary: mavenSummary
      }
    ];
  }

  /**
   * Parse and convert selected components into state updates
   */
  static parseSelectedComponents(
    selectedIds: string[],
    entries: Record<string, string>,
    _currentSettings: IdeSettings
  ): ImportedSettingsResult {
    const updatedSettings: Partial<IdeSettings> = {};
    let customJdks: Array<{ name: string; path: string; version?: string }> | undefined;
    let customKeymap: Record<string, string[]> | undefined;
    const appliedCategories: string[] = [];

    // 1. UI & Theme
    if (selectedIds.includes('ui')) {
      let matchedTheme: IdeThemeId = 'intellij-new-ui-dark';
      let themeFound = false;

      // Check colors.scheme.xml first
      let colorSchemeName = '';
      if (entries['options/colors.scheme.xml']) {
        const doc = getXmlDoc(entries['options/colors.scheme.xml']);
        colorSchemeName = doc?.querySelector('global_color_scheme')?.getAttribute('name') || '';
      }

      // Check laf.xml
      let darkTheme = '';
      let lightTheme = '';
      if (entries['options/laf.xml']) {
        const doc = getXmlDoc(entries['options/laf.xml']);
        darkTheme = doc?.querySelector('preferred-dark-laf')?.getAttribute('themeId') || '';
        lightTheme = doc?.querySelector('preferred-light-laf')?.getAttribute('themeId') || '';
      }

      const candidate = (colorSchemeName || darkTheme || lightTheme).toLowerCase();
      if (candidate) {
        themeFound = true;
        // In JetBrains New UI, "Islands Darcula" and "Islands Dark" are the modern flat dark themes
        if (candidate.includes('islands') || candidate.includes('new ui') || candidate === 'dark' || candidate.includes('darcula')) {
          if (candidate.includes('darcula-classic') || candidate === 'classic' || candidate === 'darcula') {
            matchedTheme = 'darcula-classic';
          } else {
            matchedTheme = 'intellij-new-ui-dark';
          }
        } else if (candidate.includes('light')) {
          matchedTheme = 'intellij-light';
        } else if (candidate.includes('one dark') || candidate.includes('onedark')) {
          matchedTheme = 'one-dark-pro';
        } else if (candidate.includes('dracula')) {
          matchedTheme = 'dracula';
        } else if (candidate.includes('github')) {
          matchedTheme = 'github-dark';
        } else {
          matchedTheme = 'intellij-new-ui-dark';
        }
      }

      // Check UI font and compact mode in ui.lnf.xml
      if (entries['options/ui.lnf.xml']) {
        const doc = getXmlDoc(entries['options/ui.lnf.xml']);
        if (doc) {
          const fontSize = doc.querySelector('option[name="FONT_SIZE"]')?.getAttribute('value');
          if (fontSize) {
            const sz = parseInt(fontSize, 10);
            if (!isNaN(sz) && sz >= 8 && sz <= 32) updatedSettings.uiFontSize = sz;
          }
          const compact = doc.querySelector('option[name="COMPACT_MODE"]')?.getAttribute('value');
          if (compact !== null && compact !== undefined) {
            updatedSettings.compactMode = compact === 'true';
          }
        }
      }

      if (themeFound) {
        updatedSettings.theme = matchedTheme;
        appliedCategories.push(`UI & Theme (${matchedTheme})`);
      }
    }

    // 2. Editor & Fonts
    if (selectedIds.includes('editor')) {
      if (entries['options/editor-font.xml']) {
        const doc = getXmlDoc(entries['options/editor-font.xml']);
        const fontFamily = getOptionValue(doc!, 'FONT_FAMILY');
        const fontSizeStr = getOptionValue(doc!, 'FONT_SIZE');
        const lineSpacingStr = getOptionValue(doc!, 'LINE_SPACING');
        const ligaturesStr = getOptionValue(doc!, 'USE_LIGATURES');
        if (fontFamily) updatedSettings.fontFamily = fontFamily;
        if (fontSizeStr) {
          const sz = parseInt(fontSizeStr, 10);
          if (!isNaN(sz) && sz >= 8 && sz <= 40) updatedSettings.fontSize = sz;
        }
        if (lineSpacingStr) {
          const ls = parseFloat(lineSpacingStr);
          if (!isNaN(ls) && ls >= 1.0 && ls <= 2.5) updatedSettings.lineHeight = ls;
        }
        if (ligaturesStr !== null) {
          updatedSettings.ligatures = ligaturesStr === 'true';
        }
      }
      if (entries['options/editor.xml']) {
        const doc = getXmlDoc(entries['options/editor.xml']);
        if (doc) {
          const tabSizeStr = getOptionValue(doc, 'TAB_SIZE');
          if (tabSizeStr) {
            const ts = parseInt(tabSizeStr, 10);
            if (!isNaN(ts)) updatedSettings.tabSize = ts;
          }
          const lineNums = getOptionValue(doc, 'ARE_LINE_NUMBERS_SHOWN') || getOptionValue(doc, 'IS_LINE_NUMBERS_SHOWN');
          if (lineNums !== null) updatedSettings.lineNumbers = lineNums === 'true';

          const folding = getOptionValue(doc, 'IS_FOLDING_OUTLINE_SHOWN');
          if (folding !== null) updatedSettings.codeFolding = folding === 'true';

          const reformat = getOptionValue(doc, 'ENABLE_SECOND_REFORMAT');
          if (reformat !== null) updatedSettings.autoFormatOnSave = reformat === 'true';

          const smoothScroll = getOptionValue(doc, 'SMOOTH_SCROLLING');
          if (smoothScroll !== null) updatedSettings.smoothScrolling = smoothScroll === 'true';
        }
      }
      appliedCategories.push('Editor & Fonts');
    }

    // 3. Code Style
    if (selectedIds.includes('codestyle')) {
      let currentScheme = 'Default';
      if (entries['options/code.style.schemes.xml']) {
        const doc = getXmlDoc(entries['options/code.style.schemes.xml']);
        currentScheme = doc?.querySelector('option[name="CURRENT_SCHEME_NAME"]')?.getAttribute('value') || 'Default';
      }

      const csKey = Object.keys(entries).find(k => k.toLowerCase() === `codestyles/${currentScheme.toLowerCase()}.xml`) 
        || Object.keys(entries).find(k => k.startsWith('codestyles/'));

      if (csKey && entries[csKey]) {
        const doc = getXmlDoc(entries[csKey]);
        if (doc) {
          const indentOpts = doc.querySelector('indentOptions');
          if (indentOpts) {
            const indentSize = indentOpts.querySelector('option[name="INDENT_SIZE"]')?.getAttribute('value');
            const contSize = indentOpts.querySelector('option[name="CONTINUATION_INDENT_SIZE"]')?.getAttribute('value');
            const tabSize = indentSize || contSize;
            if (tabSize) {
              const ts = parseInt(tabSize, 10);
              if (!isNaN(ts)) updatedSettings.tabSize = ts;
            }
          }
        }
      }
      appliedCategories.push(`Code Style (${currentScheme})`);
    }

    // 4. Keymaps
    if (selectedIds.includes('keymap')) {
      let activeKmName = '';
      const optKeymap = entries['options/windows/keymap.xml'] || entries['options/keymap.xml'];
      if (optKeymap) {
        const optDoc = getXmlDoc(optKeymap);
        activeKmName = optDoc?.querySelector('active_keymap')?.getAttribute('name') || '';
      }

      const kmKey = (activeKmName && Object.keys(entries).find(k => k.toLowerCase() === `keymaps/${activeKmName.toLowerCase()}.xml`))
        || Object.keys(entries).find(k => k.startsWith('keymaps/'));

      if (kmKey && entries[kmKey]) {
        const doc = getXmlDoc(entries[kmKey]);
        if (doc) {
          const fileKmName = doc.querySelector('keymap')?.getAttribute('name') || activeKmName || kmKey.replace(/^keymaps\//, '').replace(/\.xml$/, '');
          updatedSettings.keymapProfile = fileKmName;

          customKeymap = {};
          const actions = doc.querySelectorAll('action');
          actions.forEach(act => {
            const actId = act.getAttribute('id');
            if (actId) {
              const shortcuts: string[] = [];
              act.querySelectorAll('keyboard-shortcut').forEach(kb => {
                const first = kb.getAttribute('first-keystroke');
                const second = kb.getAttribute('second-keystroke');
                if (first) {
                  const normalized = normalizeKeystroke(first);
                  const normalizedSecond = second ? normalizeKeystroke(second) : '';
                  shortcuts.push(normalizedSecond ? `${normalized} ${normalizedSecond}` : normalized);
                }
              });
              if (shortcuts.length > 0) {
                // Store original JetBrains action ID
                customKeymap![actId] = shortcuts;

                // Also store mapped internal ID and label
                const mapping = INTELLIJ_ACTION_MAP[actId];
                if (mapping) {
                  customKeymap![mapping.internalId] = shortcuts;
                  customKeymap![mapping.label] = shortcuts;
                }
              }
            }
          });
        }
      }
      appliedCategories.push(`Keymaps (${updatedSettings.keymapProfile || 'custom'})`);
    }

    // 5. Terminal
    if (selectedIds.includes('terminal')) {
      if (entries['options/terminal.xml']) {
        const doc = getXmlDoc(entries['options/terminal.xml']);
        const shell = doc?.querySelector('option[name="myShellPath"]')?.getAttribute('value');
        if (shell && shell.trim()) {
          updatedSettings.terminalShell = shell.trim();
        }
      }
      appliedCategories.push('Terminal Shell');
    }

    // 6. System & General
    if (selectedIds.includes('general')) {
      if (entries['options/ide.general.xml']) {
        const doc = getXmlDoc(entries['options/ide.general.xml']);
        const confirmExit = doc?.querySelector('option[name="confirmExit"]')?.getAttribute('value');
        if (confirmExit !== null && confirmExit !== undefined) {
          updatedSettings.confirmExit = confirmExit === 'true';
        }
        const openNewProj = doc?.querySelector('option[name="confirmOpenNewProject2"]')?.getAttribute('value');
        if (openNewProj === '0') {
          updatedSettings.projectOpenMode = 'this_window';
        } else if (openNewProj === '1') {
          updatedSettings.projectOpenMode = 'new_window';
        } else if (openNewProj === '2') {
          updatedSettings.projectOpenMode = 'ask';
        }
        const reopenLast = doc?.querySelector('option[name="reopenLastProject"]')?.getAttribute('value');
        if (reopenLast !== null && reopenLast !== undefined) {
          updatedSettings.reopenProjectsOnStartup = reopenLast === 'true';
        }
        const showTips = doc?.querySelector('option[name="showTipsOnStartup"]')?.getAttribute('value');
        if (showTips !== null && showTips !== undefined) {
          try {
            localStorage.setItem('ij_show_tips_on_startup', showTips);
          } catch {
            // ignore
          }
        }
      }
      appliedCategories.push('System & General');
    }

    // 7. Project View
    if (selectedIds.includes('projectView')) {
      if (entries['options/projectView.xml']) {
        const doc = getXmlDoc(entries['options/projectView.xml']);
        const autoscroll = doc?.querySelector('option[name="autoscrollFromSource"]')?.getAttribute('value');
        if (autoscroll !== null && autoscroll !== undefined) {
          try {
            localStorage.setItem('ij_project_tree_autoscroll', autoscroll);
          } catch {
            // ignore
          }
        }
        try {
          localStorage.setItem('ij_project_tree_compact_packages', 'true');
        } catch {
          // ignore
        }
      }
      appliedCategories.push('Project View');
    }

    // 8. Database Tools
    if (selectedIds.includes('database')) {
      if (entries['options/databaseSettings.xml']) {
        const doc = getXmlDoc(entries['options/databaseSettings.xml']);
        const pageSize = doc?.querySelector('option[name="pageSize"]')?.getAttribute('value');
        const rowLimit = doc?.querySelector('option[name="rowLimit"]')?.getAttribute('value');
        if (pageSize) {
          const ps = parseInt(pageSize, 10);
          if (!isNaN(ps)) updatedSettings.dataEditorPageSize = ps;
        }
        if (rowLimit) {
          const rl = parseInt(rowLimit, 10);
          if (!isNaN(rl)) updatedSettings.sqlRowLimit = rl;
        }
      }
      appliedCategories.push('Database Tools');
    }

    // 9. Installed JDKs & Runner JDK
    if (selectedIds.includes('jdk')) {
      if (entries['options/jdk.table.xml']) {
        const doc = getXmlDoc(entries['options/jdk.table.xml']);
        if (doc) {
          const jdkNodes = doc.querySelectorAll('jdk');
          customJdks = [];
          jdkNodes.forEach(node => {
            const name = node.querySelector('name')?.getAttribute('value');
            const homePath = node.querySelector('homePath')?.getAttribute('value');
            const version = node.querySelector('version')?.getAttribute('value');
            if (name && homePath) {
              const resolvedPath = resolveUserHome(homePath);
              customJdks!.push({
                name,
                path: resolvedPath,
                version: version || name
              });
            }
          });

          // Automatically configure the best JDK for Maven Runner
          // Only configure mavenRunnerJdk if it doesn't point to a foreign user directory
          if (customJdks.length > 0) {
            const bestJdk = customJdks.find(j => j.name.toLowerCase().includes('graalvm') || j.name.includes('21'))
              || customJdks.find(j => j.name.includes('17'))
              || customJdks[0];
            if (bestJdk && !bestJdk.path.toLowerCase().includes('/users/') && !bestJdk.path.toLowerCase().includes('\\users\\')) {
              updatedSettings.mavenRunnerJdk = bestJdk.path;
            }
          }
        }
      }
      appliedCategories.push(`JDKs & SDKs (${customJdks?.length || 0} installed)`);
    }

    // 10. Maven Configuration & Wrapper
    if (selectedIds.includes('maven') || selectedIds.includes('general')) {
      // In IntelliJ IDEA, the default and recommended Maven Home is WRAPPER (Project Maven Wrapper: mvnw/mvnw.cmd)
      // Never force custom path to foreign downloaded dist paths from other machines (e.g. C:\Users\nampa)
      updatedSettings.mavenHomePath = 'wrapper';
      appliedCategories.push('Maven (Project Wrapper)');
    }

    return {
      updatedSettings,
      customJdks,
      customKeymap,
      appliedCategories
    };
  }

  /**
   * Generate IntelliJ-compatible XML files map from current IDE settings
   */
  static generateExportEntries(
    settings: IdeSettings,
    selectedIds: string[],
    customJdks?: Array<{ name: string; path: string; version?: string }>,
    customKeymap?: Record<string, string[]>
  ): Record<string, string> {
    const entries: Record<string, string> = {
      'IntelliJ IDEA Global Settings': ''
    };

    // 1. UI & Theme
    if (selectedIds.includes('ui')) {
      const themeId = settings.theme === 'darcula-classic' ? 'Islands Darcula' : 'IntelliJ Light';
      entries['options/laf.xml'] = `<application>\n  <component name="LafManager">\n    <preferred-dark-laf themeId="${themeId}" />\n  </component>\n</application>`;
      entries['options/colors.scheme.xml'] = `<application>\n  <component name="EditorColorsManagerImpl">\n    <global_color_scheme name="${themeId}" />\n  </component>\n</application>`;
    }

    // 2. Editor & Fonts
    if (selectedIds.includes('editor')) {
      entries['options/editor-font.xml'] = `<application>\n  <component name="DefaultFont">\n    <option name="VERSION" value="1" />\n    <option name="FONT_SIZE" value="${settings.fontSize || 13}" />\n    <option name="FONT_FAMILY" value="${settings.fontFamily || 'JetBrains Mono'}" />\n    <option name="LINE_SPACING" value="${settings.lineHeight || 1.4}" />\n  </component>\n</application>`;
      entries['options/editor.xml'] = `<application>\n  <component name="CodeInsightSettings">\n    <option name="TAB_SIZE" value="${settings.tabSize || 4}" />\n    <option name="ENABLE_SECOND_REFORMAT" value="true" />\n  </component>\n</application>`;
    }

    // 3. Code Style
    if (selectedIds.includes('codestyle')) {
      entries['codestyles/Default.xml'] = `<code_scheme name="Default" version="173">\n  <indentOptions>\n    <option name="INDENT_SIZE" value="${settings.tabSize || 4}" />\n    <option name="CONTINUATION_INDENT_SIZE" value="${settings.tabSize || 4}" />\n  </indentOptions>\n</code_scheme>`;
    }

    // 4. Keymaps
    if (selectedIds.includes('keymap') && customKeymap) {
      let keymapXml = '<keymap version="1" name="custom-idea" parent="$default">\n';
      for (const [actionId, shortcuts] of Object.entries(customKeymap)) {
        keymapXml += `  <action id="${actionId}">\n`;
        shortcuts.forEach(sc => {
          keymapXml += `    <keyboard-shortcut first-keystroke="${sc}" />\n`;
        });
        keymapXml += '  </action>\n';
      }
      keymapXml += '</keymap>';
      entries['keymaps/custom-idea.xml'] = keymapXml;
    }

    // 5. Terminal
    if (selectedIds.includes('terminal')) {
      entries['options/terminal.xml'] = `<application>\n  <component name="TerminalOptionsProvider">\n    <option name="myShellPath" value="${settings.terminalShell || 'powershell.exe'}" />\n  </component>\n</application>`;
    }

    // 6. System & General
    if (selectedIds.includes('general')) {
      const openModeVal = settings.projectOpenMode === 'this_window' ? '0' : settings.projectOpenMode === 'new_window' ? '1' : '2';
      entries['options/ide.general.xml'] = `<application>\n  <component name="GeneralSettings">\n    <option name="showTipsOnStartup" value="false" />\n    <option name="confirmExit" value="${settings.confirmExit ? 'true' : 'false'}" />\n    <option name="confirmOpenNewProject2" value="${openModeVal}" />\n  </component>\n</application>`;
    }

    // 7. Project View
    if (selectedIds.includes('projectView')) {
      entries['options/projectView.xml'] = `<application>\n  <component name="ProjectViewSharedSettings">\n    <option name="autoscrollFromSource" value="true" />\n    <option name="compactMiddlePackages" value="true" />\n  </component>\n</application>`;
    }

    // 8. Database Tools
    if (selectedIds.includes('database')) {
      entries['options/databaseSettings.xml'] = `<application>\n  <component name="DatabaseSettings" version="10">\n    <option name="pageSize" value="${settings.dataEditorPageSize || 500}" />\n    <option name="rowLimit" value="${settings.sqlRowLimit || 500}" />\n  </component>\n</application>`;
    }

    // 9. Installed JDKs
    if (selectedIds.includes('jdk') && customJdks && customJdks.length > 0) {
      let jdkXml = '<application>\n  <component name="ProjectJdkTable">\n';
      for (const jdk of customJdks) {
        jdkXml += `    <jdk version="2">\n      <name value="${jdk.name}" />\n      <type value="JavaSDK" />\n      <version value="${jdk.version || jdk.name}" />\n      <homePath value="${jdk.path}" />\n    </jdk>\n`;
      }
      jdkXml += '  </component>\n</application>';
      entries['options/jdk.table.xml'] = jdkXml;
    }

    return entries;
  }
}
