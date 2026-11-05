import { create } from 'zustand';
import { InstalledPluginItem } from '../features/settings/SettingsModal';
import { KeyPromoterItem } from '../workbench/plugins/KeyPromoterXToast';

export interface PluginStoreState {
  installedPlugins: InstalledPluginItem[];
  keyPromoterItem: KeyPromoterItem | null;
  missedShortcutsCount: Record<string, number>;

  // Actions
  isPluginActive: (idOrKeyword: string) => boolean;
  togglePlugin: (id: string | number) => void;
  installPlugin: (plugin: InstalledPluginItem) => void;
  uninstallPlugin: (id: string | number) => void;
  notifyAction: (actionName: string, shortcut: string) => void;
  dismissKeyPromoter: () => void;
  disableKeyPromoter: () => void;
  setInstalledPlugins: (plugins: InstalledPluginItem[]) => void;
}

const DEFAULT_PLUGINS: InstalledPluginItem[] = [
  {
    id: 'sonarqube',
    name: 'SonarQube for IDE (SonarLint)',
    author: 'SonarSource',
    version: '10.4.2',
    desc: 'Deep static code analysis, security hotspots, code smells, and quality gates for Java, TS, JS, and Rust.',
    installed: true,
    enabled: true,
    downloads: 12500000,
    rating: 4.9,
  },
  {
    id: 'rainbow-brackets',
    name: 'Rainbow Brackets',
    author: 'izhangzhihao',
    version: '2025.2.0',
    desc: 'Colorizes matching parenthesis, brackets, and braces with distinctive vivid rainbow palettes.',
    installed: true,
    enabled: true,
    downloads: 15200000,
    rating: 4.8,
  },
  {
    id: 'key-promoter-x',
    name: 'Key Promoter X',
    author: 'Dmitry Batkovich & JetBrains Community',
    version: '2025.1.2',
    desc: 'Helps to learn essential IntelliJ shortcuts by displaying a notification toast when mouse clicks are used.',
    installed: true,
    enabled: true,
    downloads: 8400000,
    rating: 4.9,
  },
  {
    id: 'nyan-progress',
    name: 'Nyan Progress Bar',
    author: 'Dmitry Minaev',
    version: '1.14.0',
    desc: 'Replaces standard compilation and run progress bars with an animated retro 8-bit Nyan Cat.',
    installed: true,
    enabled: true,
    downloads: 3100000,
    rating: 4.9,
  },
  {
    id: 'git-toolbox',
    name: 'GitToolBox',
    author: 'Lukasz Zielinski',
    version: '2025.1.0',
    desc: 'Inline git blame annotations, commit status, and branch indicators.',
    installed: true,
    enabled: true,
    downloads: 9600000,
    rating: 4.8,
  },
  {
    id: 'atom-material-icons',
    name: 'Atom Material Icons',
    author: 'Elior Boukhobza',
    version: '95.0.0',
    desc: 'Vibrant handcrafted file and folder icons for project trees matching exact file types.',
    installed: true,
    enabled: true,
    downloads: 12800000,
    rating: 4.9,
  },
  {
    id: 'bundled-rust',
    name: 'Rust (IntelliJ Native)',
    author: 'JetBrains',
    version: '0.4.195',
    desc: 'Official Rust language support with cargo and rust-analyzer.',
    installed: true,
    enabled: true,
  },
  {
    id: 'bundled-git',
    name: 'Git Integration',
    author: 'JetBrains',
    version: '241.14494',
    desc: 'Advanced VCS tool windows, log viewer, and interactive rebase.',
    installed: true,
    enabled: true,
  },
  {
    id: 'bundled-terminal',
    name: 'Terminal',
    author: 'JetBrains',
    version: '241.14494',
    desc: 'Embedded powershell/bash terminal with xterm.js emulation.',
    installed: true,
    enabled: true,
  },
  {
    id: 'bundled-toml',
    name: 'TOML & Cargo Support',
    author: 'JetBrains',
    version: '0.2.164',
    desc: 'Syntax highlighting and schema validation for Cargo.toml files.',
    installed: true,
    enabled: true,
  },
];

const loadInitialPlugins = (): InstalledPluginItem[] => {
  try {
    const saved = localStorage.getItem('intellij_installed_plugins');
    if (saved) {
      const parsed: InstalledPluginItem[] = JSON.parse(saved);
      const existingIds = new Set(parsed.map(p => String(p.id).toLowerCase()));
      const merged = [...parsed];
      for (const def of DEFAULT_PLUGINS) {
        if (!existingIds.has(String(def.id).toLowerCase())) {
          merged.push(def);
        }
      }
      return merged;
    }
  } catch (e) {
    console.error('Failed to load intellij_installed_plugins from localStorage:', e);
  }
  return DEFAULT_PLUGINS;
};

const savePlugins = (plugins: InstalledPluginItem[]) => {
  try {
    localStorage.setItem('intellij_installed_plugins', JSON.stringify(plugins));
  } catch (e) {
    console.error('Failed to save plugins to localStorage:', e);
  }
};

export const usePluginStore = create<PluginStoreState>((set, get) => ({
  installedPlugins: loadInitialPlugins(),
  keyPromoterItem: null,
  missedShortcutsCount: {},

  isPluginActive: (idOrKeyword: string): boolean => {
    const kw = idOrKeyword.toLowerCase();
    const plugins = get().installedPlugins;
    return plugins.some(p => {
      if (!p.enabled) return false;
      const pid = String(p.id).toLowerCase();
      const pname = (p.name || '').toLowerCase();
      return pid === kw || pid.includes(kw) || pname.includes(kw);
    });
  },

  togglePlugin: (id: string | number) => {
    set(state => {
      const next = state.installedPlugins.map(p => 
        p.id === id ? { ...p, enabled: !p.enabled } : p
      );
      savePlugins(next);
      return { installedPlugins: next };
    });
  },

  installPlugin: (plugin: InstalledPluginItem) => {
    set(state => {
      const next = [...state.installedPlugins.filter(p => p.id !== plugin.id), plugin];
      savePlugins(next);
      return { installedPlugins: next };
    });
  },

  uninstallPlugin: (id: string | number) => {
    set(state => {
      const next = state.installedPlugins.filter(p => p.id !== id);
      savePlugins(next);
      return { installedPlugins: next };
    });
  },

  setInstalledPlugins: (plugins: InstalledPluginItem[]) => {
    savePlugins(plugins);
    set({ installedPlugins: plugins });
  },

  notifyAction: (actionName: string, shortcut: string) => {
    if (!get().isPluginActive('key-promoter-x')) return;
    if (!shortcut) return;

    set(state => {
      const currentCount = (state.missedShortcutsCount[actionName] || 0) + 1;
      const updatedCounts = {
        ...state.missedShortcutsCount,
        [actionName]: currentCount,
      };

      return {
        missedShortcutsCount: updatedCounts,
        keyPromoterItem: {
          id: `${actionName}-${Date.now()}`,
          actionName,
          shortcut,
          count: currentCount,
        },
      };
    });
  },

  dismissKeyPromoter: () => {
    set({ keyPromoterItem: null });
  },

  disableKeyPromoter: () => {
    set(state => {
      const next = state.installedPlugins.map(p => {
        const pid = String(p.id).toLowerCase();
        const pname = (p.name || '').toLowerCase();
        if (pid.includes('key-promoter') || pname.includes('key promoter')) {
          return { ...p, enabled: false };
        }
        return p;
      });
      savePlugins(next);
      return { installedPlugins: next, keyPromoterItem: null };
    });
  },
}));
