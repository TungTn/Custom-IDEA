import { create } from 'zustand';
import { IdeSettings } from '../features/settings/SettingsModal';
import { IdeThemeId, SyntaxTokenColors } from '../types/theme';
import { applyIdeTheme } from '../themes/themeManager';

export interface SettingsState {
  settings: IdeSettings;
  setSettings: (settings: IdeSettings | ((prev: IdeSettings) => IdeSettings)) => void;
  updateSettings: (partial: Partial<IdeSettings>) => void;
  applyTheme: (themeId: IdeThemeId, customSyntax?: Partial<SyntaxTokenColors>) => void;
  restoreDefaultSettings: () => void;
}

const DEFAULT_SETTINGS: IdeSettings = {
  theme: 'intellij-new-ui-dark',
  fontSize: 14,
  tabSize: 4,
  minimap: false,
  lineNumbers: true,
  wordWrap: false,
  fontFamily: 'JetBrains Mono',
  lineHeight: 1.45,
  ligatures: true,
  bracketPairs: true,
  codeFolding: true,
  projectOpenMode: 'ask',
  confirmExit: true,
  reopenProjectsOnStartup: true,
  syncFilesOnFrameActivation: true,
  terminalShell: 'powershell.exe',
  gitPath: 'git',
  doubleShiftTimeout: 350,
  recentFilesLimit: 50,
  terminalScrollback: 10000,
  compactMode: false,
  enableFileColors: true,
  soundOnFailure: true,
  dataEditorPageSize: 500,
  dataEditorNullValue: '<null>',
  dataEditorGroupDigits: true,
  defaultBrowser: 'chrome',
  cargoCheckOnFly: true,
  useRustfmt: true,
  tsLanguageServer: true,
  buildHeapSize: 1024,
  uiFontSize: 13,
  keymapProfile: ((typeof window !== 'undefined' ? localStorage.getItem('intellij_keymap_profile') : null) as any) || 'windows',
  customKeymaps: {},
};

const getInitialSettings = (): IdeSettings => {
  try {
    const saved = localStorage.getItem('intellij_ide_settings');
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Failed to parse saved settings, falling back to defaults:', e);
  }
  return DEFAULT_SETTINGS;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: getInitialSettings(),

  setSettings: (settingsOrUpdater) => {
    set((state) => {
      const next = typeof settingsOrUpdater === 'function' ? settingsOrUpdater(state.settings) : settingsOrUpdater;
      try {
        localStorage.setItem('intellij_ide_settings', JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to persist settings:', e);
      }
      return { settings: next };
    });
  },

  updateSettings: (partial) => {
    set((state) => {
      const next = { ...state.settings, ...partial };
      try {
        localStorage.setItem('intellij_ide_settings', JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to persist settings:', e);
      }
      return { settings: next };
    });
  },

  applyTheme: (themeId, customSyntax) => {
    applyIdeTheme(themeId, customSyntax);
    get().updateSettings({ theme: themeId });
    try {
      localStorage.setItem('intellij_theme', themeId);
    } catch (e) {
      console.warn('Failed to persist theme:', e);
    }
  },

  restoreDefaultSettings: () => {
    set({ settings: DEFAULT_SETTINGS });
    try {
      localStorage.setItem('intellij_ide_settings', JSON.stringify(DEFAULT_SETTINGS));
    } catch (e) {
      console.warn('Failed to persist settings:', e);
    }
  },
}));
