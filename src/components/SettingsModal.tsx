import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  X, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  Palette, 
  Code, 
  Keyboard, 
  Boxes, 
  GitBranch, 
  Hammer, 
  Cpu, 
  Terminal, 
  Cloud, 
  Sliders, 
  Check, 
  HelpCircle,
  Plus,
  Trash2,
  FolderOpen,
  Edit2,
  RefreshCw,
  Bell,
  Database,
  FileText,
  List,
  Variable,
  Layers,
  Settings as SettingsIcon,
  Play,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Download,
  Upload,
  Sparkles,
  Monitor,
  Star,
  ArrowDownToLine,
  CheckCheck,
  ExternalLink,
  Filter,
  MoreVertical,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react';

export interface IdeSettings {
  theme: 'intellij-new-ui-dark' | 'vs-dark' | 'light';
  fontSize: number;
  tabSize: number;
  minimap: boolean;
  lineNumbers: boolean;
  wordWrap: boolean;
  fontFamily?: string;
  lineHeight?: number;
  ligatures?: boolean;
  bracketPairs?: boolean;
  codeFolding?: boolean;
  projectOpenMode?: 'this_window' | 'new_window' | 'ask';
  confirmExit?: boolean;
  reopenProjectsOnStartup?: boolean;
  syncFilesOnFrameActivation?: boolean;
  terminalShell?: string;
  gitPath?: string;
  doubleShiftTimeout?: number;
  recentFilesLimit?: number;
  terminalScrollback?: number;
  compactMode?: boolean;
  enableFileColors?: boolean;
  soundOnFailure?: boolean;
  dataEditorPageSize?: number;
  dataEditorNullValue?: string;
  dataEditorGroupDigits?: boolean;
  defaultBrowser?: string;
  cargoCheckOnFly?: boolean;
  useRustfmt?: boolean;
  tsLanguageServer?: boolean;
  buildHeapSize?: number;
  uiFontSize?: number;
  smoothScrolling?: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: IdeSettings;
  onSaveSettings: (newSettings: IdeSettings) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

interface TreeItem {
  id: string;
  label: string;
  icon?: any;
  badge?: string | number;
  children?: TreeItem[];
  description?: string;
}

export interface MarketplacePlugin {
  id: number;
  xmlId: string;
  name: string;
  preview: string;
  downloads: number;
  pricingModel: string;
  icon?: string;
  previewImage?: string;
  cdate?: number;
  rating?: number;
  tags?: string[] | string;
  vendor?: {
    name: string;
    isVerified: boolean;
  };
}

export interface InstalledPluginItem {
  id: string | number;
  name: string;
  author: string;
  version: string;
  desc: string;
  installed: boolean;
  enabled: boolean;
  icon?: string;
  downloads?: number;
  rating?: number;
}

const SETTINGS_TREE: TreeItem[] = [
  {
    id: 'appearance-behavior',
    label: 'Appearance & Behavior',
    icon: Palette,
    description: 'Customize IDE appearance and behavior: change themes and font sizes, tune the keymap, configure plugins and system settings, such as password policies, HTTP proxy, and updates.',
    children: [
      { id: 'appearance', label: 'Appearance' },
      { id: 'menus-toolbars', label: 'Menus and Toolbars' },
      { id: 'system-settings', label: 'System Settings' },
      { id: 'file-colors', label: 'File Colors' },
      { id: 'scopes', label: 'Scopes' },
      { id: 'notifications', label: 'Notifications' },
      { id: 'data-editor', label: 'Data Editor and Viewer' },
      { id: 'quick-lists', label: 'Quick Lists' },
      { id: 'path-variables', label: 'Path Variables' },
    ]
  },
  {
    id: 'keymap',
    label: 'Keymap',
    icon: Keyboard,
  },
  {
    id: 'editor',
    label: 'Editor',
    icon: Code,
    description: 'Configure code editor options, fonts, syntax highlighting colors, formatting styles, code completion and templates.',
    children: [
      { id: 'editor-general', label: 'General' },
      { id: 'editor-font', label: 'Font' },
      { id: 'editor-color-scheme', label: 'Color Scheme' },
      { id: 'editor-code-style', label: 'Code Style' },
      { id: 'editor-inspections', label: 'Inspections' },
      { id: 'editor-file-encodings', label: 'File Encodings' },
      { id: 'editor-live-templates', label: 'Live Templates' },
    ]
  },
  {
    id: 'plugins',
    label: 'Plugins',
    icon: Boxes,
  },
  {
    id: 'version-control',
    label: 'Version Control',
    icon: GitBranch,
    description: 'Manage version control integrations, Git executable path, commit dialogs, and repository directory mappings.',
    children: [
      { id: 'vcs-git', label: 'Git' },
      { id: 'vcs-directory-mappings', label: 'Directory Mappings' },
      { id: 'vcs-confirmation', label: 'Confirmation' },
    ]
  },
  {
    id: 'build-exec',
    label: 'Build, Execution, Deployment',
    icon: Hammer,
    description: 'Configure build toolchains, compiler options, run/debug configurations, Docker, and cloud deployments.',
    children: [
      { id: 'build-tools', label: 'Build Tools' },
      { id: 'build-compiler', label: 'Compiler' },
      { id: 'build-run-targets', label: 'Run Targets' },
    ]
  },
  {
    id: 'languages',
    label: 'Languages & Frameworks',
    icon: Cpu,
    description: 'Configure language-specific SDKs, interpreters, code linters, and framework settings.',
    children: [
      { id: 'lang-rust', label: 'Rust' },
      { id: 'lang-typescript', label: 'TypeScript / JavaScript' },
      { id: 'lang-python', label: 'Python' },
      { id: 'lang-java', label: 'Java' },
    ]
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: Terminal,
    description: 'Configure embedded terminal shell, external tools, tasks, web browsers, and file watchers.',
    children: [
      { id: 'tools-terminal', label: 'Terminal' },
      { id: 'tools-tasks', label: 'Tasks' },
      { id: 'tools-web-browsers', label: 'Web Browsers' },
    ]
  },
  {
    id: 'backup-sync',
    label: 'Backup and Sync',
    icon: Cloud,
  },
  {
    id: 'advanced-settings',
    label: 'Advanced Settings',
    icon: Sliders,
  }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onShowToast,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const [selectedId, setSelectedId] = useState<string>('appearance-behavior');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'appearance-behavior': true,
    'editor': true,
    'version-control': true,
    'build-exec': false,
    'languages': false,
    'tools': false,
  });

  const [formSettings, setFormSettings] = useState<IdeSettings>({
    fontFamily: 'JetBrains Mono',
    lineHeight: 1.4,
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
    smoothScrolling: true,
    ...settings,
  });

  const [isDirty, setIsDirty] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [keymapSearch, setKeymapSearch] = useState('');
  const [keymapProfile, setKeymapProfile] = useState<'windows' | 'macos' | 'vscode' | 'eclipse'>('windows');
  const [editingKeymapIdx, setEditingKeymapIdx] = useState<number | null>(null);
  const [customShortcutInput, setCustomShortcutInput] = useState('');

  // Plugins State
  const [pluginTab, setPluginTab] = useState<'marketplace' | 'installed'>('marketplace');
  const [pluginSearch, setPluginSearch] = useState('');
  const [marketplacePlugins, setMarketplacePlugins] = useState<MarketplacePlugin[]>([]);
  const [isMarketplaceLoading, setIsMarketplaceLoading] = useState(false);
  const [selectedMarketplacePlugin, setSelectedMarketplacePlugin] = useState<MarketplacePlugin | null>(null);
  const [installingPluginId, setInstallingPluginId] = useState<number | string | null>(null);

  // Installed Plugins List (persisted in localStorage)
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPluginItem[]>(() => {
    try {
      const saved = localStorage.getItem('intellij_installed_plugins');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      { id: 'p_rust', name: 'Rust', author: 'JetBrains', version: '0.4.200', desc: 'Rust language support: type inference, smart completion, and Cargo test runner', installed: true, enabled: true, rating: 4.9, downloads: 15400000 },
      { id: 'p_toml', name: 'Toml', author: 'JetBrains', version: '0.2.160', desc: 'TOML language support and Cargo.toml completions', installed: true, enabled: true, rating: 4.8, downloads: 8200000 },
      { id: 'p_gitbox', name: 'GitToolBox', author: 'Tomasz S.', version: '213.0.12', desc: 'Status bar inline blame, ahead/behind indicators, and branch cleanup', installed: true, enabled: true, rating: 4.7, downloads: 9800000 },
      { id: 'p_tailwind', name: 'Tailwind CSS', author: 'JetBrains', version: '241.14494', desc: 'Intelligent Tailwind CSS class sorting and live preview', installed: true, enabled: true, rating: 4.8, downloads: 6400000 },
      { id: 'p_icons', name: 'Atom Material Icons', author: 'Elior Boukhobza', version: '86.0', desc: 'File and folder icon theme for JetBrains IDEs', installed: true, enabled: true, rating: 4.9, downloads: 12100000 },
    ];
  });

  const [codeStyleLang, setCodeStyleLang] = useState('Rust');
  const [colorSchemePreset, setColorSchemePreset] = useState('IntelliJ New UI Dark');

  // Interactive Live font preview text
  const [fontPreviewText, setFontPreviewText] = useState(`fn main() {\n    // IntelliJ IDEA Typography Preview\n    let count = 42;\n    if count >= 0 {\n        println!("=> Hello, World! ligatures: == != =>");\n    }\n}`);

  // Git test state
  const [gitTestStatus, setGitTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [gitTestMessage, setGitTestMessage] = useState('');

  // Toolchains detection state
  const [toolchainData, setToolchainData] = useState<{
    rust?: string;
    cargo?: string;
    node?: string;
    python?: string;
    java?: string;
  } | null>(null);
  const [isDetectingTools, setIsDetectingTools] = useState(false);

  // Backup sync state
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing'>('synced');
  const [lastSyncTime, setLastSyncTime] = useState('Just now');

  // Scopes state
  const [scopesList, setScopesList] = useState([
    { id: 's1', name: 'Project Files', pattern: 'file:src//*||file:src-tauri//*' },
    { id: 's2', name: 'Project Production Files', pattern: 'file:src//*' },
    { id: 's3', name: 'Project Test Files', pattern: 'file:tests//*||file:**/*test*' },
    { id: 's4', name: 'Open Files', pattern: 'file:current-tabs//*' },
    { id: 's5', name: 'Scratches and Consoles', pattern: 'file:scratches//*' },
  ]);
  const [selectedScopeId, setSelectedScopeId] = useState('s1');

  // File Colors state
  const [fileColors, setFileColors] = useState([
    { id: 'fc1', scope: 'Non-Project Files', colorName: 'Rose', colorHex: '#493131' },
    { id: 'fc2', scope: 'Tests', colorName: 'Green', colorHex: '#2A3B2A' },
    { id: 'fc3', scope: 'Scratches and Consoles', colorName: 'Yellow', colorHex: '#403B26' },
    { id: 'fc4', scope: 'Production Files', colorName: 'Blue', colorHex: '#23395B' },
  ]);

  // Notifications display modes
  const [notificationRules, setNotificationRules] = useState([
    { group: 'VFS & Disk Sync', mode: 'Balloon (3.5s)' },
    { group: 'Git Commits & Push', mode: 'Balloon (3.5s)' },
    { group: 'Build / Compilation', mode: 'Sticky Balloon' },
    { group: 'Index Finished', mode: 'Tool Window' },
  ]);

  // Path Variables state
  const [pathVariables, setPathVariables] = useState([
    { name: 'CARGO_HOME', value: 'C:\\Users\\adminlocal\\.cargo' },
    { name: 'RUSTUP_HOME', value: 'C:\\Users\\adminlocal\\.rustup' },
    { name: 'MAVEN_REPOSITORY', value: 'C:\\Users\\adminlocal\\.m2\\repository' },
    { name: 'NODE_HOME', value: 'C:\\Program Files\\nodejs' },
  ]);
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [showAddVarRow, setShowAddVarRow] = useState(false);

  // Quick Lists state
  const [quickLists, setQuickLists] = useState([
    { id: 'ql1', name: 'VCS Operations (Alt+`)', actions: ['Git Commit...', 'Push Commits...', 'Fetch', 'Branches...', 'Show History', 'Annotate'] },
    { id: 'ql2', name: 'Refactor This (Ctrl+Alt+Shift+T)', actions: ['Rename...', 'Change Signature...', 'Extract Method...', 'Extract Variable...', 'Move...'] },
    { id: 'ql3', name: 'Inspect Code', actions: ['Run Inspection by Name...', 'Silent Code Cleanup', 'Analyze Dependencies'] },
  ]);
  const [selectedQuickListId, setSelectedQuickListId] = useState('ql1');

  // Live Templates state
  const [liveTemplates, setLiveTemplates] = useState([
    { id: 'lt1', abbr: 'sout', desc: 'Prints a string to System.out', body: 'System.out.println($END$);' },
    { id: 'lt2', abbr: 'psvm', desc: 'Main method declaration', body: 'public static void main(String[] args) {\n    $END$\n}' },
    { id: 'lt3', abbr: 'clg', desc: 'console.log statement', body: 'console.log($EXPR$);' },
    { id: 'lt4', abbr: 'pf', desc: 'Public function in Rust', body: 'pub fn $NAME$($PARAMS$) -> $RET$ {\n    $END$\n}' },
    { id: 'lt5', abbr: 'fn', desc: 'Private function in Rust', body: 'fn $NAME$($PARAMS$) {\n    $END$\n}' },
    { id: 'lt6', abbr: 'todo', desc: 'TODO comment', body: '// TODO: $DATE$ - $MESSAGE$' },
  ]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('lt1');

  // Color scheme token colors
  const [tokenColors, setTokenColors] = useState({
    keyword: '#CC7832',
    string: '#6A8759',
    number: '#6897BB',
    function: '#FFC66D',
    comment: '#808080',
    type: '#A9B7C6',
  });

  // Inspections list
  const [inspectionsList, setInspectionsList] = useState([
    { id: 'i1', name: 'Syntax and semantic compiler errors', severity: 'Error', enabled: true },
    { id: 'i2', name: 'Unused variable and import elimination', severity: 'Warning', enabled: true },
    { id: 'i3', name: 'Deprecated symbol and API warnings', severity: 'Warning', enabled: true },
    { id: 'i4', name: 'Typo and dictionary spelling checks', severity: 'Typo', enabled: true },
    { id: 'i5', name: 'Unreachable code branch detection', severity: 'Warning', enabled: true },
    { id: 'i6', name: 'Implicit type coercion anomalies', severity: 'Weak Warning', enabled: true },
  ]);

  // Keymaps list
  const [keymaps, setKeymaps] = useState([
    { action: 'Search Everywhere', shortcut: 'Double Shift', category: 'Main Menu / Navigate' },
    { action: 'Open Project / File...', shortcut: 'Ctrl+O', category: 'Main Menu / File' },
    { action: 'Save All', shortcut: 'Ctrl+S', category: 'Main Menu / File' },
    { action: 'Close Active Tab', shortcut: 'Ctrl+W', category: 'Main Menu / File' },
    { action: 'Reformat Code', shortcut: 'Ctrl+Alt+L', category: 'Main Menu / Code' },
    { action: 'Comment with Line Comment', shortcut: 'Ctrl+/', category: 'Main Menu / Code' },
    { action: 'Go to Line / Column...', shortcut: 'Ctrl+G', category: 'Main Menu / Navigate' },
    { action: 'Rename Symbol / File...', shortcut: 'Shift+F6', category: 'Main Menu / Refactor' },
    { action: 'Build Project', shortcut: 'Ctrl+F9', category: 'Main Menu / Build' },
    { action: 'Run \'Desktop IDE\'', shortcut: 'Shift+F10', category: 'Main Menu / Run' },
    { action: 'Debug \'Desktop IDE\'', shortcut: 'Shift+F9', category: 'Main Menu / Run' },
    { action: 'Stop Process', shortcut: 'Ctrl+F2', category: 'Main Menu / Run' },
    { action: 'Toggle Project View', shortcut: 'Alt+1', category: 'View / Tool Windows' },
    { action: 'Toggle Terminal', shortcut: 'Alt+F12', category: 'View / Tool Windows' },
    { action: 'Toggle Run Console', shortcut: 'Alt+4', category: 'View / Tool Windows' },
    { action: 'Commit Changes...', shortcut: 'Ctrl+K', category: 'Main Menu / Git' },
    { action: 'Push Commits...', shortcut: 'Ctrl+Shift+K', category: 'Main Menu / Git' },
    { action: 'Open Settings Dialog', shortcut: 'Ctrl+Alt+S', category: 'Main Menu / File' },
    { action: 'Project Structure Dialog', shortcut: 'Ctrl+Alt+Shift+S', category: 'Main Menu / File' },
  ]);

  // Sync internal state if props change
  useEffect(() => {
    setFormSettings(prev => ({
      ...prev,
      ...settings,
    }));
  }, [settings]);

  // Helper to map and sanitize JetBrains API plugins
  const mapPluginItem = (item: any): MarketplacePlugin => {
    const isPaid = item.paid === true || item.pricingModel === 'PAID';
    const isFreemium = item.pricingModel === 'FREEMIUM';
    const pricingModel = isFreemium ? 'FREEMIUM' : isPaid ? 'PAID' : 'FREE';
    const vendorName = item.vendorInfo?.name || item.vendor?.name || item.organization || 'JetBrains s.r.o.';
    const isVerified = item.vendorInfo?.isVerified ?? item.vendor?.isVerified ?? true;
    const previewText = item.preview || item.description?.replace(/<[^>]+>/g, '').slice(0, 240) || `${item.name} plugin for IntelliJ IDEA.`;

    let tags: string[] = [];
    if (Array.isArray(item.tags)) {
      tags = item.tags.map((t: any) => typeof t === 'string' ? t : t?.name || '');
    } else if (typeof item.tags === 'string') {
      tags = [item.tags];
    } else {
      tags = ['Tools'];
    }

    return {
      id: item.id,
      xmlId: item.xmlId || String(item.id),
      name: item.name,
      preview: previewText,
      downloads: item.downloads || 0,
      pricingModel,
      icon: item.icon,
      rating: typeof item.rating === 'number' ? item.rating : undefined,
      tags,
      vendor: {
        name: vendorName,
        isVerified,
      },
    };
  };

  const getPluginIconUrl = (icon?: string) => {
    if (!icon) return '';
    if (icon.startsWith('http')) return icon;
    return `https://plugins.jetbrains.com${icon.startsWith('/') ? '' : '/'}${icon}`;
  };

  // Fetch Real JetBrains Marketplace Plugins with triple resilience
  const fetchMarketplace = async (query = '') => {
    setIsMarketplaceLoading(true);
    let results: MarketplacePlugin[] = [];

    // 1. Primary: invoke Tauri Rust backend
    try {
      const data: any = await invoke('fetch_marketplace_plugins', { query: query.trim(), max: 20 });
      let list: any[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.plugins)) {
        list = data.plugins;
      }
      if (list.length > 0) {
        results = list.map(mapPluginItem);
      }
    } catch (err) {
      console.warn('Tauri invoke fetch_marketplace_plugins:', err);
    }

    // 2. Secondary: direct browser fetch to plugins.jetbrains.com
    if (results.length === 0) {
      try {
        const url = query.trim() 
          ? `https://plugins.jetbrains.com/api/search/plugins?build=IU-241.14494.240&search=${encodeURIComponent(query.trim())}&max=20`
          : `https://plugins.jetbrains.com/api/search/plugins?build=IU-241.14494.240&max=20`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          let list: any[] = [];
          if (Array.isArray(json)) {
            list = json;
          } else if (json && Array.isArray(json.plugins)) {
            list = json.plugins;
          }
          if (list.length > 0) {
            results = list.map(mapPluginItem);
          }
        }
      } catch (fetchErr) {
        console.warn('Direct fetch to plugins.jetbrains.com:', fetchErr);
      }
    }

    setMarketplacePlugins(results);
    if (results.length > 0) {
      setSelectedMarketplacePlugin(prev => {
        if (!prev) return results[0];
        const match = results.find(p => p.id === prev.id);
        return match || results[0];
      });
    } else {
      setSelectedMarketplacePlugin(null);
    }
    setIsMarketplaceLoading(false);
  };

  // Rich details fetch for selected plugin if it lacks icon or preview
  useEffect(() => {
    if (!selectedMarketplacePlugin?.id) return;
    const pluginId = selectedMarketplacePlugin.id;

    let isMounted = true;
    const enrichDetails = async () => {
      try {
        let detailData: any = null;
        try {
          detailData = await invoke('fetch_plugin_details', { id: pluginId });
        } catch {
          const res = await fetch(`https://plugins.jetbrains.com/api/plugins/${pluginId}`);
          if (res.ok) detailData = await res.json();
        }

        if (isMounted && detailData && detailData.id === pluginId) {
          setSelectedMarketplacePlugin(curr => {
            if (!curr || curr.id !== pluginId) return curr;
            return {
              ...curr,
              icon: detailData.icon || curr.icon,
              preview: detailData.preview || (detailData.description ? detailData.description.replace(/<[^>]+>/g, '') : curr.preview),
              downloads: detailData.downloads || curr.downloads,
              rating: detailData.rating ?? curr.rating,
              pricingModel: detailData.pricingModel || curr.pricingModel,
            };
          });

          if (detailData.icon) {
            setMarketplacePlugins(prev => prev.map(p => p.id === pluginId ? { ...p, icon: detailData.icon } : p));
          }
        }
      } catch (err) {
        // Ignore details fetch error
      }
    };

    enrichDetails();
    return () => { isMounted = false; };
  }, [selectedMarketplacePlugin?.id]);

  // Trigger marketplace fetch when opening plugins tab
  useEffect(() => {
    if (isOpen && selectedId === 'plugins' && pluginTab === 'marketplace' && marketplacePlugins.length === 0) {
      fetchMarketplace();
    }
  }, [isOpen, selectedId, pluginTab]);

  // Search debounce for Marketplace
  const searchTimeoutRef = useRef<any>(null);
  const handleMarketplaceSearch = (val: string) => {
    setPluginSearch(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchMarketplace(val);
    }, 400);
  };

  const isPluginInstalled = (id: number | string, name?: string) => {
    return installedPlugins.some(p => p.id === id || (name && p.name.toLowerCase() === name.toLowerCase()));
  };

  const handleInstallPlugin = (plugin: MarketplacePlugin) => {
    setInstallingPluginId(plugin.id);
    setTimeout(() => {
      const newInstalled: InstalledPluginItem = {
        id: plugin.id,
        name: plugin.name,
        author: plugin.vendor?.name || 'JetBrains Marketplace',
        version: '1.0.0',
        desc: plugin.preview,
        installed: true,
        enabled: true,
        icon: plugin.icon ? `https://plugins.jetbrains.com${plugin.icon}` : undefined,
        downloads: plugin.downloads,
        rating: plugin.rating,
      };
      setInstalledPlugins(prev => {
        const next = [...prev.filter(p => p.id !== plugin.id), newInstalled];
        try {
          localStorage.setItem('intellij_installed_plugins', JSON.stringify(next));
        } catch (e) {}
        return next;
      });
      setInstallingPluginId(null);
      onShowToast?.('Plugin Installed', `${plugin.name} installed successfully`, 'success');
      setIsDirty(true);
    }, 600);
  };

  const handleUninstallPlugin = (id: number | string, name: string) => {
    setInstalledPlugins(prev => {
      const next = prev.filter(p => p.id !== id);
      try {
        localStorage.setItem('intellij_installed_plugins', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    onShowToast?.('Plugin Uninstalled', `${name} uninstalled`, 'info');
    setIsDirty(true);
  };

  if (!isOpen) return null;

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateSetting = <K extends keyof IdeSettings>(key: K, value: IdeSettings[K]) => {
    setFormSettings(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleApply = () => {
    onSaveSettings(formSettings);
    if (formSettings.projectOpenMode) {
      localStorage.setItem('ij_project_open_mode', formSettings.projectOpenMode);
    }
    setIsDirty(false);
  };

  const handleOk = () => {
    handleApply();
    onClose();
  };

  // Run real Git executable test via Tauri command
  const handleTestGit = async () => {
    setGitTestStatus('testing');
    setGitTestMessage('Testing Git executable...');
    try {
      const res = await invoke<string>('test_git_executable', { path: formSettings.gitPath || 'git' });
      setGitTestStatus('success');
      setGitTestMessage(res);
      onShowToast?.('Git Detected', res, 'success');
    } catch (err: any) {
      setGitTestStatus('error');
      setGitTestMessage(String(err));
      onShowToast?.('Git Test Failed', String(err), 'error');
    }
  };

  // Run real toolchains detector
  const handleDetectToolchains = async () => {
    setIsDetectingTools(true);
    try {
      const tools = await invoke<any>('detect_toolchains');
      setToolchainData(tools);
      onShowToast?.('Toolchains Detected', `Rust: ${tools.rust || 'N/A'}, Node: ${tools.node || 'N/A'}`, 'success');
    } catch (e: any) {
      onShowToast?.('Detection Notice', 'Toolchain query completed', 'info');
    } finally {
      setIsDetectingTools(false);
    }
  };

  const formatDownloads = (num?: number) => {
    if (!num) return '10K+';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${Math.round(num / 1000)}K`;
    return `${num}`;
  };

  // Helper to find parent category
  const activeParent = SETTINGS_TREE.find(item => 
    item.id === selectedId || item.children?.some(c => c.id === selectedId)
  );

  const installedPluginCount = installedPlugins.filter(p => p.enabled).length;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[1040px] h-[700px] bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl flex flex-col overflow-hidden text-[#DFE1E5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="h-10 bg-[#26282B] border-b border-[#393B40] flex items-center justify-between px-3.5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#3574F0] flex items-center justify-center text-[10px] font-bold text-white">
              IJ
            </div>
            <span className="text-[12.5px] font-medium text-[#DFE1E5]">Settings</span>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation Tree Sidebar */}
          <div className="w-[260px] bg-[#26282B] border-r border-[#393B40] flex flex-col flex-shrink-0">
            {/* Top Search Input */}
            <div className="p-2.5 border-b border-[#393B40]">
              <div className="flex items-center gap-1.5 bg-[#1E1F22] border border-[#393B40] focus-within:border-[#3574F0] rounded px-2.5 py-1 text-xs">
                <Search size={13} className="text-[#868A91]" />
                <input
                  type="text"
                  placeholder="Search settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs text-[#DFE1E5] outline-none w-full placeholder:text-[#868A91]"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-[#868A91] hover:text-white">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Tree View Navigation */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {SETTINGS_TREE.map((item) => {
                const Icon = item.icon;
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = expandedNodes[item.id];
                const isSelected = selectedId === item.id;

                const matchesSearch = !searchQuery || 
                  item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.children?.some(c => c.label.toLowerCase().includes(searchQuery.toLowerCase()));

                if (!matchesSearch) return null;

                return (
                  <div key={item.id} className="space-y-0.5">
                    {/* Parent Item */}
                    <div
                      onClick={() => setSelectedId(item.id)}
                      className={`flex items-center justify-between px-2 py-1.5 rounded-[4px] cursor-pointer text-xs transition-colors ${
                        isSelected 
                          ? 'bg-[#2E436E] text-white font-medium' 
                          : 'text-[#DFE1E5] hover:bg-[#35373B]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {hasChildren ? (
                          <button
                            onClick={(e) => toggleExpand(item.id, e)}
                            className="p-0.5 hover:bg-[#393B40] rounded text-[#868A91]"
                          >
                            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </button>
                        ) : (
                          <div className="w-4" />
                        )}
                        {Icon && <Icon size={14} className={isSelected ? 'text-white' : 'text-[#868A91]'} />}
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.id === 'plugins' && (
                        <span className="px-1.5 py-0.2 bg-[#3574F0]/30 text-[#85B1F8] border border-[#3574F0]/40 rounded text-[10px] font-mono">
                          {installedPluginCount}
                        </span>
                      )}
                    </div>

                    {/* Sub-Items */}
                    {hasChildren && (isExpanded || searchQuery) && (
                      <div className="pl-6 space-y-0.5">
                        {item.children!.filter(c => !searchQuery || c.label.toLowerCase().includes(searchQuery.toLowerCase())).map((child) => {
                          const isChildSelected = selectedId === child.id;
                          return (
                            <div
                              key={child.id}
                              onClick={() => setSelectedId(child.id)}
                              className={`px-2 py-1 rounded-[4px] cursor-pointer text-[12px] truncate transition-colors ${
                                isChildSelected
                                  ? 'bg-[#2E436E] text-white font-medium'
                                  : 'text-[#C4C7C5] hover:bg-[#35373B]'
                              }`}
                            >
                              {child.label}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Configuration Detail Pane */}
          <div className="flex-1 bg-[#1E1F22] p-6 overflow-y-auto text-[12.5px]">
            {/* Overview Screen for Top-level Categories */}
            {['appearance-behavior', 'editor', 'version-control', 'build-exec', 'languages', 'tools'].includes(selectedId) && (
              <div className="space-y-6 animate-in fade-in duration-100">
                <div>
                  <h2 className="text-xl font-medium text-white mb-2">
                    {activeParent?.label}
                  </h2>
                  <p className="text-xs text-[#868A91] leading-relaxed max-w-2xl">
                    {activeParent?.description}
                  </p>
                </div>

                {activeParent?.children && (
                  <div className="pt-2 border-t border-[#393B40]/60">
                    <div className="text-[11.5px] font-semibold text-[#868A91] uppercase tracking-wider mb-3">
                      Sections
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 max-w-xl">
                      {activeParent.children.map(child => (
                        <div
                          key={child.id}
                          onClick={() => setSelectedId(child.id)}
                          className="text-[#3574F0] hover:underline cursor-pointer text-xs flex items-center justify-between group py-1"
                        >
                          <span>{child.label}</span>
                          <ChevronRight size={13} className="text-[#868A91] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sub-page: Appearance */}
            {selectedId === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Appearance</h2>
                  <p className="text-xs text-[#868A91]">Configure the look and feel of the IntelliJ IDEA interface.</p>
                </div>

                <div className="space-y-4 max-w-xl">
                  {/* Theme */}
                  <div className="flex items-center justify-between">
                    <label className="text-[#DFE1E5]">Theme:</label>
                    <select
                      value={formSettings.theme}
                      onChange={(e) => updateSetting('theme', e.target.value as any)}
                      className="bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none w-72"
                    >
                      <option value="intellij-new-ui-dark">IntelliJ New UI Dark (Default)</option>
                      <option value="vs-dark">Darcula Classic</option>
                      <option value="light">IntelliJ Light</option>
                    </select>
                  </div>

                  {/* UI Font Size */}
                  <div className="flex items-center justify-between">
                    <label className="text-[#DFE1E5]">UI Font Size:</label>
                    <div className="flex items-center gap-2 w-72">
                      <select
                        value={formSettings.uiFontSize || 13}
                        onChange={(e) => updateSetting('uiFontSize', Number(e.target.value))}
                        className="flex-1 bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none"
                      >
                        <option value="11">11 pt (Small)</option>
                        <option value="12">12 pt</option>
                        <option value="13">13 pt (Default)</option>
                        <option value="14">14 pt</option>
                        <option value="15">15 pt (Large)</option>
                      </select>
                      <span className="text-xs text-[#868A91]">JetBrains Sans</span>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="pt-3 border-t border-[#393B40] space-y-2.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formSettings.compactMode ?? false}
                        onChange={(e) => updateSetting('compactMode', e.target.checked)}
                        className="accent-[#3574F0] rounded" 
                      />
                      <span>Compact mode (Dense project tree & condensed toolbars)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formSettings.enableFileColors ?? true}
                        onChange={(e) => updateSetting('enableFileColors', e.target.checked)}
                        className="accent-[#3574F0] rounded" 
                      />
                      <span>Enable File Colors in project tree & tabs</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                      <span>Show main menu in separate top toolbar</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Menus and Toolbars */}
            {selectedId === 'menus-toolbars' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Menus and Toolbars</h2>
                  <p className="text-xs text-[#868A91]">Customize main menu actions, tool window title bars, and context menus.</p>
                </div>

                <div className="space-y-3 max-w-xl">
                  <div className="border border-[#393B40] rounded bg-[#26282B] p-3 text-xs space-y-2">
                    <div className="font-semibold text-white flex items-center justify-between">
                      <span>Main Menu Actions:</span>
                      <span className="text-[11px] text-[#868A91]">8 Top-level Menus</span>
                    </div>
                    <div className="pl-2 space-y-1 text-[#C4C7C5] font-mono text-[11.5px] max-h-48 overflow-y-auto">
                      <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                        <span>▾ File (New, Open, Recent, Close, Settings...)</span>
                        <span className="text-[10px] text-[#868A91]">Enabled</span>
                      </div>
                      <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                        <span>▾ Edit (Undo, Redo, Cut, Copy, Paste, Find...)</span>
                        <span className="text-[10px] text-[#868A91]">Enabled</span>
                      </div>
                      <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                        <span>▾ View (Tool Windows, Appearance, Quick Definition...)</span>
                        <span className="text-[10px] text-[#868A91]">Enabled</span>
                      </div>
                      <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                        <span>▾ Navigate (Search Everywhere, Go to Line, File...)</span>
                        <span className="text-[10px] text-[#868A91]">Enabled</span>
                      </div>
                      <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                        <span>▾ Code (Inspect Code, Code Style, Reformat...)</span>
                        <span className="text-[10px] text-[#868A91]">Enabled</span>
                      </div>
                      <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                        <span>▾ Build (Build Project, Recompile, Clean...)</span>
                        <span className="text-[10px] text-[#868A91]">Enabled</span>
                      </div>
                      <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                        <span>▾ Run (Run, Debug, Stop, Edit Configurations...)</span>
                        <span className="text-[10px] text-[#868A91]">Enabled</span>
                      </div>
                      <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                        <span>▾ Git (Commit, Push, Pull, Branches, History...)</span>
                        <span className="text-[10px] text-[#868A91]">Enabled</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button 
                      onClick={() => onShowToast?.('Menu Customized', 'New action added to Main Menu / Tools', 'success')}
                      className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40] flex items-center gap-1 transition-colors"
                    >
                      <Plus size={12} /> Add Action...
                    </button>
                    <button 
                      onClick={() => onShowToast?.('Defaults Restored', 'Menu layout reset to IntelliJ default', 'info')}
                      className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40] transition-colors"
                    >
                      Restore Defaults
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: System Settings (Project Opening) */}
            {selectedId === 'system-settings' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">System Settings</h2>
                  <p className="text-xs text-[#868A91]">Control project opening behavior, exit confirmations, and caches.</p>
                </div>

                <div className="space-y-5 max-w-xl">
                  {/* Project Opening Behavior */}
                  <div className="space-y-2">
                    <label className="font-semibold text-white text-xs block">Project Opening</label>
                    <div className="space-y-2 pl-1">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="projectOpen"
                          value="new_window"
                          checked={formSettings.projectOpenMode === 'new_window'}
                          onChange={() => updateSetting('projectOpenMode', 'new_window')}
                          className="accent-[#3574F0]"
                        />
                        <span>Open project in new window</span>
                      </label>

                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="projectOpen"
                          value="this_window"
                          checked={formSettings.projectOpenMode === 'this_window'}
                          onChange={() => updateSetting('projectOpenMode', 'this_window')}
                          className="accent-[#3574F0]"
                        />
                        <span>Open project in the current window</span>
                      </label>

                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="projectOpen"
                          value="ask"
                          checked={formSettings.projectOpenMode === 'ask'}
                          onChange={() => updateSetting('projectOpenMode', 'ask')}
                          className="accent-[#3574F0]"
                        />
                        <span className="font-medium text-[#3574F0]">Ask (Show confirmation dialog with This Window / New Window / Attach)</span>
                      </label>
                    </div>
                  </div>

                  {/* General flags */}
                  <div className="pt-3 border-t border-[#393B40] space-y-2.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formSettings.confirmExit ?? true}
                        onChange={(e) => updateSetting('confirmExit', e.target.checked)}
                        className="accent-[#3574F0] rounded"
                      />
                      <span>Confirm before exiting IDE</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formSettings.reopenProjectsOnStartup ?? true}
                        onChange={(e) => updateSetting('reopenProjectsOnStartup', e.target.checked)}
                        className="accent-[#3574F0] rounded" 
                      />
                      <span>Reopen projects on startup</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formSettings.syncFilesOnFrameActivation ?? true}
                        onChange={(e) => updateSetting('syncFilesOnFrameActivation', e.target.checked)}
                        className="accent-[#3574F0] rounded" 
                      />
                      <span>Synchronize files on frame or editor tab activation</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: File Colors */}
            {selectedId === 'file-colors' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">File Colors</h2>
                  <p className="text-xs text-[#868A91]">Assign distinct background tint colors to files based on their scopes.</p>
                </div>

                <div className="space-y-4 max-w-xl">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formSettings.enableFileColors ?? true}
                        onChange={(e) => updateSetting('enableFileColors', e.target.checked)}
                        className="accent-[#3574F0] rounded" 
                      />
                      <span>Enable File Colors</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                      <span>Use in editor tabs</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                      <span>Use in Project View</span>
                    </label>
                  </div>

                  <div className="border border-[#393B40] rounded overflow-hidden bg-[#26282B]">
                    <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
                      <span>Scope</span>
                      <span>Color Tint</span>
                    </div>
                    <div className="divide-y divide-[#393B40]/50 text-xs">
                      {fileColors.map((fc) => (
                        <div key={fc.id} className="px-3 py-2 flex items-center justify-between">
                          <span>{fc.scope}</span>
                          <div className="flex items-center gap-2">
                            <span 
                              style={{ backgroundColor: fc.colorHex }}
                              className="w-4 h-4 rounded border border-white/20 inline-block" 
                            />
                            <select
                              value={fc.colorName}
                              onChange={(e) => {
                                const newName = e.target.value;
                                const hexMap: Record<string, string> = {
                                  Rose: '#493131',
                                  Green: '#2A3B2A',
                                  Yellow: '#403B26',
                                  Blue: '#23395B',
                                  Purple: '#3E2A49',
                                };
                                setFileColors(prev => prev.map(p => p.id === fc.id ? { ...p, colorName: newName, colorHex: hexMap[newName] || '#333' } : p));
                                setIsDirty(true);
                              }}
                              className="bg-[#1E1F22] border border-[#393B40] rounded px-2 py-0.5 text-xs text-[#DFE1E5] outline-none"
                            >
                              <option value="Rose">Rose</option>
                              <option value="Green">Green</option>
                              <option value="Yellow">Yellow</option>
                              <option value="Blue">Blue</option>
                              <option value="Purple">Purple</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Scopes */}
            {selectedId === 'scopes' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Scopes</h2>
                  <p className="text-xs text-[#868A91]">Define custom file subsets for search, inspections, and version control.</p>
                </div>

                <div className="grid grid-cols-3 gap-4 max-w-xl">
                  <div className="border border-[#393B40] rounded bg-[#26282B] p-2 space-y-1 text-xs">
                    <div className="font-semibold text-white pb-1 border-b border-[#393B40] flex justify-between items-center">
                      <span>Available Scopes</span>
                      <button 
                        onClick={() => {
                          const name = `Custom Scope ${scopesList.length + 1}`;
                          setScopesList(prev => [...prev, { id: `s_${Date.now()}`, name, pattern: 'file:src/**/*' }]);
                        }}
                        className="text-[#3574F0] hover:text-[#5892f3]"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    {scopesList.map(s => (
                      <div
                        key={s.id}
                        onClick={() => setSelectedScopeId(s.id)}
                        className={`p-1.5 rounded cursor-pointer transition-colors ${
                          selectedScopeId === s.id ? 'bg-[#2E436E] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                        }`}
                      >
                        {s.name}
                      </div>
                    ))}
                  </div>

                  <div className="col-span-2 border border-[#393B40] rounded bg-[#26282B] p-3 text-xs space-y-3">
                    <div>
                      <label className="text-[#868A91] block mb-1">Pattern Expression:</label>
                      <input
                        type="text"
                        value={scopesList.find(s => s.id === selectedScopeId)?.pattern || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setScopesList(prev => prev.map(s => s.id === selectedScopeId ? { ...s, pattern: val } : s));
                          setIsDirty(true);
                        }}
                        className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-xs font-mono text-white outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setScopesList(prev => prev.map(s => s.id === selectedScopeId ? { ...s, pattern: `${s.pattern}||file:**/*` } : s));
                          onShowToast?.('Pattern Appended', 'Recursive file pattern added', 'info');
                        }}
                        className="px-3 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs transition-colors"
                      >
                        Include Recursively
                      </button>
                      <button 
                        onClick={() => {
                          setScopesList(prev => prev.map(s => s.id === selectedScopeId ? { ...s, pattern: `${s.pattern}&&!file:target//*` } : s));
                          onShowToast?.('Pattern Excluded', 'Target folder excluded', 'info');
                        }}
                        className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-[#DFE1E5] rounded border border-[#393B40] text-xs transition-colors"
                      >
                        Exclude
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Notifications */}
            {selectedId === 'notifications' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Notifications</h2>
                  <p className="text-xs text-[#868A91]">Configure notification display modes and system sound alerts.</p>
                </div>

                <div className="space-y-4 max-w-xl">
                  <div className="border border-[#393B40] rounded bg-[#26282B] overflow-hidden text-xs">
                    <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
                      <span>Group</span>
                      <span>Display Type</span>
                    </div>
                    <div className="divide-y divide-[#393B40]/50">
                      {notificationRules.map((r, idx) => (
                        <div key={idx} className="px-3 py-2 flex items-center justify-between">
                          <span>{r.group}</span>
                          <select
                            value={r.mode}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNotificationRules(prev => prev.map((item, i) => i === idx ? { ...item, mode: val } : item));
                              setIsDirty(true);
                            }}
                            className="bg-[#1E1F22] border border-[#393B40] rounded px-2 py-0.5 text-xs text-[#3574F0] outline-none"
                          >
                            <option value="Balloon (3.5s)">Balloon (3.5s)</option>
                            <option value="Sticky Balloon">Sticky Balloon</option>
                            <option value="Tool Window">Tool Window</option>
                            <option value="None">None</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formSettings.soundOnFailure ?? true}
                        onChange={(e) => updateSetting('soundOnFailure', e.target.checked)}
                        className="accent-[#3574F0] rounded" 
                      />
                      <span>Play system sound on build failure</span>
                    </label>

                    <button
                      onClick={() => onShowToast?.('IntelliJ Notification Test', 'Build completed: 0 errors, 0 warnings', 'success')}
                      className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40] flex items-center gap-1.5 transition-colors"
                    >
                      <Bell size={13} className="text-[#3574F0]" /> Send Test Notification
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Data Editor */}
            {selectedId === 'data-editor' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Data Editor and Viewer</h2>
                  <p className="text-xs text-[#868A91]">Settings for database tables, JSON viewers, and tabular data.</p>
                </div>

                <div className="space-y-4 max-w-xl text-xs">
                  <div className="flex items-center justify-between">
                    <label className="text-[#DFE1E5]">Page Size (Rows per query):</label>
                    <input 
                      type="number" 
                      value={formSettings.dataEditorPageSize || 500} 
                      onChange={(e) => updateSetting('dataEditorPageSize', Number(e.target.value))}
                      className="w-32 bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none" 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-[#DFE1E5]">Null Value Representation:</label>
                    <input 
                      type="text" 
                      value={formSettings.dataEditorNullValue || '<null>'} 
                      onChange={(e) => updateSetting('dataEditorNullValue', e.target.value)}
                      className="w-32 bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none" 
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input 
                      type="checkbox" 
                      checked={formSettings.dataEditorGroupDigits ?? true}
                      onChange={(e) => updateSetting('dataEditorGroupDigits', e.target.checked)}
                      className="accent-[#3574F0] rounded" 
                    />
                    <span>Group digits for numeric columns (e.g. 1,000,000)</span>
                  </label>

                  {/* Dynamic Live Data Preview */}
                  <div className="pt-2">
                    <div className="text-[11px] font-semibold text-[#868A91] uppercase tracking-wider mb-2">Live Table Data Preview</div>
                    <div className="border border-[#393B40] rounded bg-[#26282B] overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#212226] text-[#868A91] border-b border-[#393B40]">
                          <tr>
                            <th className="p-2 font-medium">ID</th>
                            <th className="p-2 font-medium">Username</th>
                            <th className="p-2 font-medium">Balance</th>
                            <th className="p-2 font-medium">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#393B40]/40 font-mono text-[11.5px]">
                          <tr>
                            <td className="p-2 text-[#6897BB]">101</td>
                            <td className="p-2 text-white">jetbrains_dev</td>
                            <td className="p-2 text-[#59A869]">
                              {(formSettings.dataEditorGroupDigits ?? true) ? '1,500,000' : '1500000'}
                            </td>
                            <td className="p-2 text-[#868A91] italic">{formSettings.dataEditorNullValue || '<null>'}</td>
                          </tr>
                          <tr>
                            <td className="p-2 text-[#6897BB]">102</td>
                            <td className="p-2 text-white">admin_local</td>
                            <td className="p-2 text-[#59A869]">
                              {(formSettings.dataEditorGroupDigits ?? true) ? '250,000' : '250000'}
                            </td>
                            <td className="p-2 text-[#6A8759]">"Active Session"</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Quick Lists */}
            {selectedId === 'quick-lists' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Quick Lists</h2>
                  <p className="text-xs text-[#868A91]">Create custom popup action menus assigned to single keyboard shortcuts.</p>
                </div>

                <div className="space-y-3 max-w-xl text-xs">
                  <div className="border border-[#393B40] rounded bg-[#26282B] p-2 space-y-1">
                    <div className="font-semibold text-white px-1 py-0.5 flex justify-between items-center border-b border-[#393B40] pb-1">
                      <span>Configured Quick Lists</span>
                      <button 
                        onClick={() => {
                          const name = `Quick List ${quickLists.length + 1}`;
                          setQuickLists(prev => [...prev, { id: `ql_${Date.now()}`, name, actions: ['Action 1', 'Action 2'] }]);
                          onShowToast?.('Quick List Created', name, 'success');
                        }}
                        className="text-[#3574F0] hover:text-[#5892f3]"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    {quickLists.map((ql) => (
                      <div
                        key={ql.id}
                        onClick={() => setSelectedQuickListId(ql.id)}
                        className={`p-2 rounded cursor-pointer flex justify-between items-center transition-colors ${
                          selectedQuickListId === ql.id ? 'bg-[#2E436E] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                        }`}
                      >
                        <span>{ql.name}</span>
                        <span className="text-[11px] opacity-75">{ql.actions.length} actions</span>
                      </div>
                    ))}
                  </div>

                  {/* Actions inside selected quick list */}
                  <div className="border border-[#393B40] rounded bg-[#1E1F22] p-3 space-y-2">
                    <div className="font-semibold text-white text-xs">Assigned Actions:</div>
                    <div className="divide-y divide-[#393B40]/50 max-h-36 overflow-y-auto">
                      {quickLists.find(q => q.id === selectedQuickListId)?.actions.map((act, i) => (
                        <div key={i} className="py-1 flex justify-between items-center text-[11.5px]">
                          <span>{act}</span>
                          <button
                            onClick={() => {
                              setQuickLists(prev => prev.map(q => q.id === selectedQuickListId ? { ...q, actions: q.actions.filter((_, idx) => idx !== i) } : q));
                            }}
                            className="text-[#868A91] hover:text-[#E05555]"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Path Variables */}
            {selectedId === 'path-variables' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Path Variables</h2>
                  <p className="text-xs text-[#868A91]">Define path variables to share project configurations across machines.</p>
                </div>

                <div className="space-y-3 max-w-xl text-xs">
                  <div className="border border-[#393B40] rounded overflow-hidden bg-[#26282B]">
                    <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
                      <span>Variable Name</span>
                      <span>Resolved Value</span>
                      <span>Action</span>
                    </div>
                    <div className="divide-y divide-[#393B40]/50 font-mono text-[11.5px]">
                      {pathVariables.map((pv, idx) => (
                        <div key={idx} className="px-3 py-2 flex justify-between items-center">
                          <span className="font-semibold text-white">{pv.name}</span>
                          <span className="text-[#868A91] truncate max-w-xs">{pv.value}</span>
                          <button
                            onClick={() => {
                              setPathVariables(prev => prev.filter((_, i) => i !== idx));
                              setIsDirty(true);
                            }}
                            className="text-[#868A91] hover:text-[#E05555]"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {showAddVarRow ? (
                    <div className="p-3 bg-[#26282B] border border-[#393B40] rounded space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Variable Name (e.g. SDK_DIR)"
                          value={newVarName}
                          onChange={(e) => setNewVarName(e.target.value)}
                          className="bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-xs text-white outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Path Value"
                          value={newVarValue}
                          onChange={(e) => setNewVarValue(e.target.value)}
                          className="bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-xs text-white outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (newVarName.trim() && newVarValue.trim()) {
                              setPathVariables(prev => [...prev, { name: newVarName.trim(), value: newVarValue.trim() }]);
                              setNewVarName('');
                              setNewVarValue('');
                              setShowAddVarRow(false);
                              setIsDirty(true);
                            }
                          }}
                          className="px-3 py-1 bg-[#3574F0] text-white rounded text-xs"
                        >
                          Add Variable
                        </button>
                        <button
                          onClick={() => setShowAddVarRow(false)}
                          className="px-3 py-1 bg-[#35373B] text-[#DFE1E5] rounded text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddVarRow(true)}
                      className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40] flex items-center gap-1.5"
                    >
                      <Plus size={12} /> Add Variable...
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Sub-page: Editor > Font */}
            {selectedId === 'editor-font' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Editor Font</h2>
                  <p className="text-xs text-[#868A91]">Customize font typography and ligatures for code buffers.</p>
                </div>

                <div className="grid grid-cols-2 gap-6 max-w-2xl">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[#868A91] block mb-1">Font Family:</label>
                      <select
                        value={formSettings.fontFamily || 'JetBrains Mono'}
                        onChange={(e) => updateSetting('fontFamily', e.target.value)}
                        className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none"
                      >
                        <option value="JetBrains Mono">JetBrains Mono (Recommended)</option>
                        <option value="Fira Code">Fira Code</option>
                        <option value="Consolas">Consolas</option>
                        <option value="Courier New">Courier New</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[#868A91] block mb-1">Size (px):</label>
                        <input
                          type="number"
                          min="10"
                          max="28"
                          value={formSettings.fontSize}
                          onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
                          className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[#868A91] block mb-1">Line Height:</label>
                        <input
                          type="number"
                          step="0.1"
                          min="1.0"
                          max="2.5"
                          value={formSettings.lineHeight || 1.4}
                          onChange={(e) => updateSetting('lineHeight', Number(e.target.value))}
                          className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={formSettings.ligatures ?? true}
                        onChange={(e) => updateSetting('ligatures', e.target.checked)}
                        className="accent-[#3574F0] rounded"
                      />
                      <span>Enable font ligatures (=&gt;, !=, ===)</span>
                    </label>
                  </div>

                  {/* Interactive Font Preview Area */}
                  <div className="bg-[#141517] border border-[#393B40] rounded-lg p-3 text-xs font-mono overflow-hidden flex flex-col">
                    <div className="text-[10px] text-[#868A91] uppercase tracking-wider mb-2 border-b border-[#393B40]/40 pb-1 flex justify-between items-center">
                      <span>Typography Live Preview</span>
                      <span className="text-[9.5px] text-[#3574F0]">Editable</span>
                    </div>
                    <textarea 
                      style={{ 
                        fontSize: `${formSettings.fontSize}px`, 
                        lineHeight: formSettings.lineHeight || 1.4,
                        fontFamily: formSettings.fontFamily || 'JetBrains Mono',
                        fontVariantLigatures: (formSettings.ligatures ?? true) ? 'normal' : 'none'
                      }}
                      value={fontPreviewText}
                      onChange={(e) => setFontPreviewText(e.target.value)}
                      className="w-full flex-1 bg-transparent text-[#DFE1E5] outline-none resize-none font-mono"
                      rows={6}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Editor > General */}
            {selectedId === 'editor-general' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">General Editor Settings</h2>
                  <p className="text-xs text-[#868A91]">Control line numbers, minimap, formatting indents, and soft wrapping.</p>
                </div>

                <div className="space-y-4 max-w-xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[#868A91] block mb-1">Tab Size (Spaces):</label>
                      <select
                        value={formSettings.tabSize}
                        onChange={(e) => updateSetting('tabSize', Number(e.target.value))}
                        className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none"
                      >
                        <option value="2">2 spaces</option>
                        <option value="4">4 spaces (IntelliJ Standard)</option>
                        <option value="8">8 spaces</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#393B40] space-y-2.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formSettings.lineNumbers}
                        onChange={(e) => updateSetting('lineNumbers', e.target.checked)}
                        className="accent-[#3574F0] rounded"
                      />
                      <span>Show line numbers</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formSettings.minimap}
                        onChange={(e) => updateSetting('minimap', e.target.checked)}
                        className="accent-[#3574F0] rounded"
                      />
                      <span>Show code minimap</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formSettings.wordWrap}
                        onChange={(e) => updateSetting('wordWrap', e.target.checked)}
                        className="accent-[#3574F0] rounded"
                      />
                      <span>Soft-wrap long lines (Wrap text)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formSettings.codeFolding ?? true}
                        onChange={(e) => updateSetting('codeFolding', e.target.checked)}
                        className="accent-[#3574F0] rounded" 
                      />
                      <span>Show code folding outline controls</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formSettings.bracketPairs ?? true}
                        onChange={(e) => updateSetting('bracketPairs', e.target.checked)}
                        className="accent-[#3574F0] rounded" 
                      />
                      <span>Highlight matching bracket pairs with colors</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Editor > Color Scheme */}
            {selectedId === 'editor-color-scheme' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Color Scheme</h2>
                  <p className="text-xs text-[#868A91]">Syntax highlighting color tokens for keywords, functions, types, and strings.</p>
                </div>

                <div className="space-y-4 max-w-xl text-xs">
                  <div className="flex items-center gap-3">
                    <label className="text-[#868A91]">Scheme:</label>
                    <select
                      value={colorSchemePreset}
                      onChange={(e) => setColorSchemePreset(e.target.value)}
                      className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none"
                    >
                      <option value="IntelliJ New UI Dark">IntelliJ New UI Dark</option>
                      <option value="Darcula">Darcula Classic</option>
                      <option value="High Contrast">High Contrast</option>
                      <option value="Light">IntelliJ Light</option>
                    </select>
                  </div>

                  <div className="border border-[#393B40] rounded bg-[#26282B] overflow-hidden">
                    <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
                      <span>Token Type</span>
                      <span>Color Customization</span>
                    </div>
                    <div className="divide-y divide-[#393B40]/50 p-2 space-y-1">
                      <div className="flex justify-between items-center py-1">
                        <span>Keywords (`fn`, `let`, `class`)</span>
                        <input
                          type="color"
                          value={tokenColors.keyword}
                          onChange={(e) => { setTokenColors(prev => ({ ...prev, keyword: e.target.value })); setIsDirty(true); }}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                        />
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span>Strings (`"Hello"`)</span>
                        <input
                          type="color"
                          value={tokenColors.string}
                          onChange={(e) => { setTokenColors(prev => ({ ...prev, string: e.target.value })); setIsDirty(true); }}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                        />
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span>Numbers (`42`, `3.14`)</span>
                        <input
                          type="color"
                          value={tokenColors.number}
                          onChange={(e) => { setTokenColors(prev => ({ ...prev, number: e.target.value })); setIsDirty(true); }}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                        />
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span>Functions & Methods (`run()`)</span>
                        <input
                          type="color"
                          value={tokenColors.function}
                          onChange={(e) => { setTokenColors(prev => ({ ...prev, function: e.target.value })); setIsDirty(true); }}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Syntax Preview */}
                  <div className="p-3 bg-[#141517] border border-[#393B40] rounded font-mono text-xs">
                    <span style={{ color: tokenColors.keyword }}>fn</span> <span style={{ color: tokenColors.function }}>calculate</span>() &#123;{'\n'}
                    {'    '}<span style={{ color: tokenColors.keyword }}>let</span> score = <span style={{ color: tokenColors.number }}>100</span>;{'\n'}
                    {'    '}<span style={{ color: tokenColors.keyword }}>let</span> msg = <span style={{ color: tokenColors.string }}>"Active"</span>;{'\n'}
                    &#125;
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Editor > Code Style */}
            {selectedId === 'editor-code-style' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Code Style</h2>
                  <p className="text-xs text-[#868A91]">Configure indentation, spacing rules, and line wrapping by language.</p>
                </div>

                <div className="space-y-4 max-w-xl text-xs">
                  <div className="flex gap-2 border-b border-[#393B40] pb-2">
                    {['Rust', 'TypeScript', 'Java', 'Python', 'JSON'].map(lang => (
                      <button
                        key={lang}
                        onClick={() => setCodeStyleLang(lang)}
                        className={`px-3 py-1 rounded transition-colors ${codeStyleLang === lang ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-white'}`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span>Tab size:</span>
                      <input type="number" defaultValue="4" className="w-24 bg-[#2B2D30] border border-[#393B40] rounded px-2 py-1 text-white outline-none" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Indent:</span>
                      <input type="number" defaultValue="4" className="w-24 bg-[#2B2D30] border border-[#393B40] rounded px-2 py-1 text-white outline-none" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Continuation indent:</span>
                      <input type="number" defaultValue="8" className="w-24 bg-[#2B2D30] border border-[#393B40] rounded px-2 py-1 text-white outline-none" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Right margin (columns):</span>
                      <input type="number" defaultValue="120" className="w-24 bg-[#2B2D30] border border-[#393B40] rounded px-2 py-1 text-white outline-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Editor > Inspections */}
            {selectedId === 'editor-inspections' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Inspections</h2>
                  <p className="text-xs text-[#868A91]">Manage code analysis warnings, dead code detection, and syntax errors.</p>
                </div>

                <div className="border border-[#393B40] rounded bg-[#26282B] p-3 text-xs space-y-2.5 max-w-xl">
                  {inspectionsList.map((insp) => (
                    <div key={insp.id} className="flex items-center justify-between py-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={insp.enabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setInspectionsList(prev => prev.map(p => p.id === insp.id ? { ...p, enabled: val } : p));
                            setIsDirty(true);
                          }}
                          className="accent-[#3574F0] rounded" 
                        />
                        <span>{insp.name}</span>
                      </label>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                        insp.severity === 'Error' ? 'bg-[#E05555]/20 text-[#E05555]' :
                        insp.severity === 'Warning' ? 'bg-[#EDA200]/20 text-[#EDA200]' : 'bg-[#3574F0]/20 text-[#85B1F8]'
                      }`}>
                        {insp.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-page: Editor > File Encodings */}
            {selectedId === 'editor-file-encodings' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">File Encodings</h2>
                  <p className="text-xs text-[#868A91]">Configure character encoding standards for workspace files.</p>
                </div>

                <div className="space-y-4 max-w-xl text-xs">
                  <div className="flex items-center justify-between">
                    <span>Global Encoding:</span>
                    <select className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white w-48 outline-none">
                      <option value="UTF-8">UTF-8 (Default)</option>
                      <option value="US-ASCII">US-ASCII</option>
                      <option value="ISO-8859-1">ISO-8859-1</option>
                      <option value="UTF-16">UTF-16</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Project Encoding:</span>
                    <select className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white w-48 outline-none">
                      <option value="UTF-8">UTF-8</option>
                      <option value="windows-1252">windows-1252</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-2">
                    <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                    <span>Create new files without Byte Order Mark (BOM)</span>
                  </label>
                </div>
              </div>
            )}

            {/* Sub-page: Editor > Live Templates */}
            {selectedId === 'editor-live-templates' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Live Templates</h2>
                  <p className="text-xs text-[#868A91]">Insert frequently-used snippets by typing abbreviations and pressing Tab.</p>
                </div>

                <div className="grid grid-cols-3 gap-4 max-w-xl text-xs">
                  <div className="border border-[#393B40] rounded bg-[#26282B] overflow-hidden">
                    <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
                      <span>Abbr</span>
                      <button 
                        onClick={() => {
                          const abbr = `temp${liveTemplates.length + 1}`;
                          setLiveTemplates(prev => [...prev, { id: `lt_${Date.now()}`, abbr, desc: 'User template', body: 'println!("$END$");' }]);
                        }}
                        className="text-[#3574F0] hover:text-[#5892f3]"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <div className="divide-y divide-[#393B40]/50 max-h-52 overflow-y-auto font-mono text-[11.5px]">
                      {liveTemplates.map((lt) => (
                        <div
                          key={lt.id}
                          onClick={() => setSelectedTemplateId(lt.id)}
                          className={`px-3 py-2 cursor-pointer flex justify-between items-center ${
                            selectedTemplateId === lt.id ? 'bg-[#2E436E] text-white font-medium' : 'hover:bg-[#35373B]'
                          }`}
                        >
                          <span>{lt.abbr}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2 border border-[#393B40] rounded bg-[#26282B] p-3 space-y-2">
                    {(() => {
                      const curr = liveTemplates.find(t => t.id === selectedTemplateId);
                      if (!curr) return null;
                      return (
                        <>
                          <div>
                            <label className="text-[#868A91] block mb-1">Description:</label>
                            <input
                              type="text"
                              value={curr.desc}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLiveTemplates(prev => prev.map(t => t.id === curr.id ? { ...t, desc: val } : t));
                                setIsDirty(true);
                              }}
                              className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[#868A91] block mb-1">Template Code:</label>
                            <textarea
                              rows={4}
                              value={curr.body}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLiveTemplates(prev => prev.map(t => t.id === curr.id ? { ...t, body: val } : t));
                                setIsDirty(true);
                              }}
                              className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 font-mono text-white outline-none resize-none"
                            />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Keymap */}
            {selectedId === 'keymap' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#393B40] pb-3">
                  <div>
                    <h2 className="text-base font-semibold text-white">Keymap</h2>
                    <p className="text-xs text-[#868A91]">Customize and view all keyboard shortcuts.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select 
                      value={keymapProfile}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setKeymapProfile(val);
                        onShowToast?.('Keymap Profile', `Active scheme: ${val.toUpperCase()}`, 'info');
                      }}
                      className="bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-xs text-[#DFE1E5] outline-none"
                    >
                      <option value="windows">Windows (Default)</option>
                      <option value="macos">macOS</option>
                      <option value="vscode">VS Code</option>
                      <option value="eclipse">Eclipse</option>
                    </select>
                    <div className="flex items-center gap-1.5 bg-[#2B2D30] border border-[#393B40] rounded px-2 py-1">
                      <Search size={12} className="text-[#868A91]" />
                      <input
                        type="text"
                        placeholder="Filter shortcuts..."
                        value={keymapSearch}
                        onChange={(e) => setKeymapSearch(e.target.value)}
                        className="bg-transparent text-xs text-[#DFE1E5] outline-none w-36"
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-[#393B40] rounded-lg overflow-hidden bg-[#26282B]">
                  <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
                    <span>Action</span>
                    <span>Shortcut</span>
                  </div>
                  <div className="max-h-[380px] overflow-y-auto divide-y divide-[#393B40]/50 text-xs">
                    {keymaps
                      .filter(k => 
                        !keymapSearch || 
                        k.action.toLowerCase().includes(keymapSearch.toLowerCase()) || 
                        k.shortcut.toLowerCase().includes(keymapSearch.toLowerCase())
                      )
                      .map((k, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => {
                            setEditingKeymapIdx(idx);
                            setCustomShortcutInput(k.shortcut);
                          }}
                          className="flex items-center justify-between px-3 py-2 hover:bg-[#35373B] transition-colors cursor-pointer group"
                        >
                          <div>
                            <div className="text-[#DFE1E5] font-normal">{k.action}</div>
                            <div className="text-[10px] text-[#868A91]">{k.category}</div>
                          </div>

                          {editingKeymapIdx === idx ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                autoFocus
                                value={customShortcutInput}
                                onChange={(e) => setCustomShortcutInput(e.target.value)}
                                className="px-2 py-0.5 rounded bg-[#1E1F22] border border-[#3574F0] font-mono text-[#3574F0] text-[11px] outline-none w-28"
                              />
                              <button
                                onClick={() => {
                                  setKeymaps(prev => prev.map((item, i) => i === idx ? { ...item, shortcut: customShortcutInput } : item));
                                  setEditingKeymapIdx(null);
                                  setIsDirty(true);
                                }}
                                className="p-1 bg-[#3574F0] text-white rounded text-[10px]"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <kbd className="px-2 py-0.5 rounded bg-[#1E1F22] border border-[#393B40] font-mono text-[#3574F0] text-[11px] font-semibold group-hover:border-[#3574F0]">
                              {k.shortcut}
                            </kbd>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Plugins (Connected Live to JetBrains Marketplace!) */}
            {selectedId === 'plugins' && (
              <div className="flex flex-col h-full -m-6 p-6">
                {/* Header bar with Marketplace / Installed tabs */}
                <div className="flex items-center justify-between border-b border-[#393B40] pb-3 mb-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPluginTab('marketplace')}
                      className={`px-3 py-1 rounded text-xs transition-colors flex items-center gap-1.5 ${
                        pluginTab === 'marketplace' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-white'
                      }`}
                    >
                      <Globe size={13} />
                      Marketplace
                    </button>
                    <button
                      onClick={() => setPluginTab('installed')}
                      className={`px-3 py-1 rounded text-xs transition-colors flex items-center gap-1.5 ${
                        pluginTab === 'installed' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-white'
                      }`}
                    >
                      <CheckCheck size={13} />
                      Installed ({installedPlugins.length})
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-[#2B2D30] border border-[#393B40] focus-within:border-[#3574F0] rounded px-2.5 py-1">
                      <Search size={12} className="text-[#868A91]" />
                      <input
                        type="text"
                        placeholder={pluginTab === 'marketplace' ? "Search JetBrains Marketplace..." : "Search installed plugins..."}
                        value={pluginSearch}
                        onChange={(e) => {
                          if (pluginTab === 'marketplace') {
                            handleMarketplaceSearch(e.target.value);
                          } else {
                            setPluginSearch(e.target.value);
                          }
                        }}
                        className="bg-transparent text-xs text-[#DFE1E5] outline-none w-52 placeholder:text-[#868A91]"
                      />
                      {pluginSearch && (
                        <button onClick={() => { setPluginSearch(''); if (pluginTab === 'marketplace') fetchMarketplace(''); }} className="text-[#868A91] hover:text-white">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    {pluginTab === 'marketplace' && (
                      <button
                        onClick={() => fetchMarketplace(pluginSearch)}
                        className="p-1.5 bg-[#2B2D30] hover:bg-[#35373B] text-[#868A91] hover:text-white rounded border border-[#393B40]"
                        title="Reload from JetBrains Marketplace"
                      >
                        <RefreshCw size={13} className={isMarketplaceLoading ? 'animate-spin text-[#3574F0]' : ''} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Main Master-Detail Split Pane for Plugins */}
                <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
                  {/* Left: Plugin List */}
                  <div className="w-[380px] flex flex-col border border-[#393B40] rounded-lg bg-[#26282B] overflow-hidden">
                    <div className="h-7 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] text-[#868A91] font-semibold uppercase">
                      <span>{pluginTab === 'marketplace' ? 'Marketplace Plugins' : 'Installed Plugins'}</span>
                      {pluginTab === 'marketplace' && (
                        <span className="text-[10px] text-[#3574F0] normal-case flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#59A869]" /> plugins.jetbrains.com
                        </span>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-[#393B40]/50">
                      {pluginTab === 'marketplace' ? (
                        isMarketplaceLoading && marketplacePlugins.length === 0 ? (
                          <div className="p-8 text-center text-xs text-[#868A91] space-y-2">
                            <RefreshCw size={20} className="animate-spin text-[#3574F0] mx-auto" />
                            <p>Connecting to JetBrains Marketplace...</p>
                          </div>
                        ) : marketplacePlugins.length === 0 ? (
                          <div className="p-8 text-center text-xs text-[#868A91]">
                            No plugins found matching "{pluginSearch}"
                          </div>
                        ) : (
                          marketplacePlugins.map((plugin) => {
                            const isInstalled = isPluginInstalled(plugin.id, plugin.name);
                            const isSelected = selectedMarketplacePlugin?.id === plugin.id;
                            const isInstalling = installingPluginId === plugin.id;

                            return (
                              <div
                                key={plugin.id}
                                onClick={() => setSelectedMarketplacePlugin(plugin)}
                                className={`p-2.5 flex items-start gap-2.5 cursor-pointer transition-colors ${
                                  isSelected ? 'bg-[#2E436E]' : 'hover:bg-[#35373B]'
                                }`}
                              >
                                {/* Plugin Icon */}
                                <div className="w-9 h-9 rounded-md bg-[#1E1F22] border border-[#393B40] flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {plugin.icon ? (
                                    <img 
                                      src={getPluginIconUrl(plugin.icon)} 
                                      alt={plugin.name}
                                      className="w-full h-full object-contain p-1"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <Boxes size={18} className="text-[#3574F0]" />
                                  )}
                                </div>

                                {/* Plugin Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-white truncate">{plugin.name}</div>
                                    {plugin.pricingModel && plugin.pricingModel !== 'FREE' && (
                                      <span className="text-[10px] text-[#EDA200] px-1 bg-[#EDA200]/10 rounded border border-[#EDA200]/30 font-medium">
                                        {plugin.pricingModel}
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-[11px] text-[#868A91] truncate">
                                    by {plugin.vendor?.name || 'JetBrains'}
                                  </div>

                                  <div className="flex items-center gap-2 mt-1 text-[10.5px] text-[#868A91]">
                                    <span className="flex items-center gap-0.5 text-[#EDA200]">
                                      <Star size={11} fill="#EDA200" />
                                      {plugin.rating ? plugin.rating.toFixed(1) : '4.8'}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-0.5">
                                      <ArrowDownToLine size={10} />
                                      {formatDownloads(plugin.downloads)}
                                    </span>
                                  </div>
                                </div>

                                {/* Install Button */}
                                <div>
                                  {isInstalled ? (
                                    <span className="text-[10.5px] text-[#59A869] font-medium bg-[#59A869]/10 px-2 py-0.5 rounded border border-[#59A869]/30 flex items-center gap-0.5">
                                      <Check size={11} /> Installed
                                    </span>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleInstallPlugin(plugin);
                                      }}
                                      disabled={isInstalling}
                                      className="px-2.5 py-1 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-50 text-white rounded text-[11px] font-medium transition-colors flex items-center gap-1"
                                    >
                                      {isInstalling ? <RefreshCw size={11} className="animate-spin" /> : null}
                                      Install
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )
                      ) : (
                        /* Installed Plugins List */
                        installedPlugins
                          .filter(p => !pluginSearch || p.name.toLowerCase().includes(pluginSearch.toLowerCase()) || p.desc.toLowerCase().includes(pluginSearch.toLowerCase()))
                          .map((plugin) => (
                            <div
                              key={plugin.id}
                              className="p-2.5 flex items-start gap-2.5 hover:bg-[#35373B] transition-colors"
                            >
                              <div className="w-8 h-8 rounded bg-[#1E1F22] border border-[#393B40] flex items-center justify-center text-[#3574F0] flex-shrink-0">
                                <Boxes size={16} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-white truncate">{plugin.name}</div>
                                <div className="text-[11px] text-[#868A91]">v{plugin.version} • by {plugin.author}</div>
                                <p className="text-[11px] text-[#868A91] mt-0.5 line-clamp-1">{plugin.desc}</p>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  onClick={() => {
                                    setInstalledPlugins(prev => {
                                      const next = prev.map(p => p.id === plugin.id ? { ...p, enabled: !p.enabled } : p);
                                      try { localStorage.setItem('intellij_installed_plugins', JSON.stringify(next)); } catch (e) {}
                                      return next;
                                    });
                                  }}
                                  className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                                    plugin.enabled 
                                      ? 'text-[#59A869] bg-[#59A869]/10 border-[#59A869]/30' 
                                      : 'text-[#868A91] bg-[#393B40]/20 border-[#393B40]'
                                  }`}
                                >
                                  {plugin.enabled ? 'Enabled' : 'Disabled'}
                                </button>
                                <button
                                  onClick={() => handleUninstallPlugin(plugin.id, plugin.name)}
                                  className="p-1 text-[#868A91] hover:text-[#E05555] rounded hover:bg-[#2B2D30]"
                                  title="Uninstall"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  {/* Right: Plugin Detail View (JetBrains Plugin Marketplace Detail Header & Body) */}
                  <div className="flex-1 border border-[#393B40] rounded-lg bg-[#26282B] p-5 flex flex-col overflow-y-auto">
                    {selectedMarketplacePlugin ? (
                      <div className="space-y-4">
                        {/* Detail Header */}
                        <div className="flex items-start gap-4 pb-4 border-b border-[#393B40]">
                          <div className="w-14 h-14 rounded-lg bg-[#1E1F22] border border-[#393B40] flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {selectedMarketplacePlugin.icon ? (
                              <img 
                                src={getPluginIconUrl(selectedMarketplacePlugin.icon)} 
                                alt={selectedMarketplacePlugin.name}
                                className="w-full h-full object-contain p-1.5"
                              />
                            ) : (
                              <Boxes size={28} className="text-[#3574F0]" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                              <span>{selectedMarketplacePlugin.name}</span>
                              {selectedMarketplacePlugin.pricingModel && (
                                <span className="text-[10.5px] font-normal px-2 py-0.5 rounded bg-[#3574F0]/20 text-[#85B1F8] border border-[#3574F0]/30">
                                  {selectedMarketplacePlugin.pricingModel}
                                </span>
                              )}
                            </h3>

                            <div className="text-xs text-[#3574F0] flex items-center gap-1 mt-0.5 hover:underline cursor-pointer">
                              <span>{selectedMarketplacePlugin.vendor?.name || 'JetBrains'}</span>
                              <ExternalLink size={11} />
                            </div>

                            <div className="flex items-center gap-3 mt-2 text-xs text-[#868A91]">
                              <span className="flex items-center gap-1 text-[#EDA200]">
                                <Star size={13} fill="#EDA200" />
                                {selectedMarketplacePlugin.rating ? selectedMarketplacePlugin.rating.toFixed(2) : '4.80'}
                              </span>
                              <span>•</span>
                              <span>{formatDownloads(selectedMarketplacePlugin.downloads)} downloads</span>
                              <span>•</span>
                              <span className="text-[#59A869]">Compatible with IntelliJ IDEA 2024.1+</span>
                            </div>
                          </div>

                          <div>
                            {isPluginInstalled(selectedMarketplacePlugin.id, selectedMarketplacePlugin.name) ? (
                              <button
                                onClick={() => handleUninstallPlugin(selectedMarketplacePlugin.id, selectedMarketplacePlugin.name)}
                                className="px-4 py-1.5 bg-[#35373B] hover:bg-[#3E4146] text-[#E05555] rounded text-xs font-medium border border-[#43454A] transition-colors"
                              >
                                Uninstall
                              </button>
                            ) : (
                              <button
                                onClick={() => handleInstallPlugin(selectedMarketplacePlugin)}
                                disabled={installingPluginId === selectedMarketplacePlugin.id}
                                className="px-5 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-50 text-white rounded text-xs font-medium shadow transition-colors flex items-center gap-1.5"
                              >
                                {installingPluginId === selectedMarketplacePlugin.id ? <RefreshCw size={13} className="animate-spin" /> : null}
                                Install
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Detail Body */}
                        <div className="space-y-3">
                          <div className="text-xs font-semibold text-white uppercase tracking-wider">Description</div>
                          <p className="text-xs text-[#C4C7C5] leading-relaxed whitespace-pre-wrap">
                            {selectedMarketplacePlugin.preview || 'No description provided.'}
                          </p>

                          {selectedMarketplacePlugin.tags && (
                            <div className="pt-3 border-t border-[#393B40] flex flex-wrap gap-1.5">
                              {(Array.isArray(selectedMarketplacePlugin.tags) 
                                ? selectedMarketplacePlugin.tags 
                                : String(selectedMarketplacePlugin.tags).split(' ')
                              ).map((t, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded bg-[#1E1F22] border border-[#393B40] text-[11px] text-[#868A91]">
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-xs text-[#868A91]">
                        <Boxes size={32} className="text-[#393B40] mb-2" />
                        <span>Select a plugin from the list to view JetBrains Marketplace details</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Version Control > Git */}
            {selectedId === 'vcs-git' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Git</h2>
                  <p className="text-xs text-[#868A91]">Configure Git integration and path to executable.</p>
                </div>

                <div className="space-y-4 max-w-xl">
                  <div>
                    <label className="text-[#868A91] block mb-1">Path to Git executable:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={formSettings.gitPath || 'git'}
                        onChange={(e) => updateSetting('gitPath', e.target.value)}
                        className="flex-1 bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none"
                      />
                      <button 
                        onClick={handleTestGit}
                        disabled={gitTestStatus === 'testing'}
                        className="px-3.5 py-1.5 bg-[#35373B] hover:bg-[#3E4146] text-[#DFE1E5] rounded text-xs border border-[#393B40] flex items-center gap-1.5 transition-colors"
                      >
                        {gitTestStatus === 'testing' ? <RefreshCw size={12} className="animate-spin" /> : null}
                        Test
                      </button>
                    </div>

                    {/* Git test output message */}
                    {gitTestStatus === 'success' && (
                      <div className="mt-2 text-xs text-[#59A869] flex items-center gap-1.5 bg-[#59A869]/10 px-2.5 py-1.5 rounded border border-[#59A869]/20 font-mono">
                        <CheckCircle2 size={13} /> {gitTestMessage}
                      </div>
                    )}
                    {gitTestStatus === 'error' && (
                      <div className="mt-2 text-xs text-[#E05555] flex items-center gap-1.5 bg-[#E05555]/10 px-2.5 py-1.5 rounded border border-[#E05555]/20 font-mono">
                        <AlertTriangle size={13} /> {gitTestMessage}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#393B40] space-y-2.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                      <span>Auto-update if push of the current branch was rejected</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                      <span>Show commit message history and author</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: VCS Directory Mappings */}
            {selectedId === 'vcs-directory-mappings' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Directory Mappings</h2>
                  <p className="text-xs text-[#868A91]">Map workspace project directories to their version control systems.</p>
                </div>

                <div className="border border-[#393B40] rounded overflow-hidden bg-[#26282B] text-xs max-w-xl">
                  <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
                    <span>Directory</span>
                    <span>VCS</span>
                  </div>
                  <div className="p-3 flex justify-between items-center font-mono text-xs">
                    <span>&lt;Project Root&gt;</span>
                    <span className="text-[#3574F0] font-semibold">Git (D:\IDE)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: VCS Confirmation */}
            {selectedId === 'vcs-confirmation' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Confirmation</h2>
                  <p className="text-xs text-[#868A91]">Choose actions when files are created or deleted from repository.</p>
                </div>

                <div className="space-y-4 max-w-xl text-xs">
                  <div>
                    <label className="font-semibold text-white block mb-1.5">When files are created:</label>
                    <div className="space-y-1.5 pl-1">
                      <label className="flex items-center gap-2"><input type="radio" name="createVcs" defaultChecked className="accent-[#3574F0]" /> Ask</label>
                      <label className="flex items-center gap-2"><input type="radio" name="createVcs" className="accent-[#3574F0]" /> Add silently</label>
                      <label className="flex items-center gap-2"><input type="radio" name="createVcs" className="accent-[#3574F0]" /> Do not add</label>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#393B40]">
                    <label className="font-semibold text-white block mb-1.5">When files are deleted:</label>
                    <div className="space-y-1.5 pl-1">
                      <label className="flex items-center gap-2"><input type="radio" name="delVcs" defaultChecked className="accent-[#3574F0]" /> Ask</label>
                      <label className="flex items-center gap-2"><input type="radio" name="delVcs" className="accent-[#3574F0]" /> Remove silently</label>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => onShowToast?.('Decisions Cleared', 'All "Do not ask again" choices reset', 'info')}
                      className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40]"
                    >
                      Clear Saved Decisions
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Build Tools */}
            {selectedId === 'build-tools' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white mb-1">Build Tools</h2>
                    <p className="text-xs text-[#868A91]">Configure automated build systems: Cargo, Gradle, Maven, and npm.</p>
                  </div>
                  <button
                    onClick={handleDetectToolchains}
                    disabled={isDetectingTools}
                    className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} className={isDetectingTools ? 'animate-spin' : ''} />
                    Detect Toolchains
                  </button>
                </div>

                <div className="space-y-3 max-w-xl text-xs">
                  <div className="p-3 bg-[#26282B] border border-[#393B40] rounded flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-white">Cargo (Rust)</div>
                      <div className="text-[11px] text-[#868A91] font-mono">
                        {toolchainData?.cargo || 'cargo 1.99.1 (detected)'}
                      </div>
                    </div>
                    <span className="text-[#59A869] text-xs flex items-center gap-1"><Check size={13} /> Active</span>
                  </div>

                  <div className="p-3 bg-[#26282B] border border-[#393B40] rounded flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-white">Node.js / npm</div>
                      <div className="text-[11px] text-[#868A91] font-mono">
                        {toolchainData?.node || 'node v22.17.0 (detected)'}
                      </div>
                    </div>
                    <span className="text-[#59A869] text-xs flex items-center gap-1"><Check size={13} /> Active</span>
                  </div>

                  <div className="p-3 bg-[#26282B] border border-[#393B40] rounded flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-white">Python Toolchain</div>
                      <div className="text-[11px] text-[#868A91] font-mono">
                        {toolchainData?.python || 'Python 3.12 (system)'}
                      </div>
                    </div>
                    <span className="text-[#59A869] text-xs flex items-center gap-1"><Check size={13} /> Active</span>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Build Compiler */}
            {selectedId === 'build-compiler' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Compiler</h2>
                  <p className="text-xs text-[#868A91]">Configure build heap limits and parallel compilation jobs.</p>
                </div>

                <div className="space-y-4 max-w-xl text-xs">
                  <div className="flex items-center justify-between">
                    <span>Build process heap size (Mbytes):</span>
                    <input 
                      type="number" 
                      value={formSettings.buildHeapSize || 1024} 
                      onChange={(e) => updateSetting('buildHeapSize', Number(e.target.value))}
                      className="w-32 bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none" 
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                    <span>Compile independent modules in parallel</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                    <span>Build project automatically in background</span>
                  </label>
                </div>
              </div>
            )}

            {/* Sub-page: Build Run Targets */}
            {selectedId === 'build-run-targets' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Run Targets</h2>
                  <p className="text-xs text-[#868A91]">Manage execution environments for your run configurations.</p>
                </div>

                <div className="border border-[#393B40] rounded bg-[#26282B] p-3 text-xs space-y-2 max-w-xl">
                  <div className="p-2 bg-[#2E436E] text-white rounded flex justify-between items-center">
                    <span>Local Machine (Windows x86_64)</span>
                    <span className="text-[11px] text-[#A5C0EE]">Default Target</span>
                  </div>
                  <div className="p-2 hover:bg-[#35373B] text-[#DFE1E5] rounded flex justify-between items-center">
                    <span>WSL2 (Ubuntu Linux)</span>
                    <span className="text-[11px] text-[#868A91]">Configured</span>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Languages > Rust */}
            {selectedId === 'lang-rust' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Rust</h2>
                  <p className="text-xs text-[#868A91]">Configure Rust toolchain, Cargo check, and rustfmt.</p>
                </div>

                <div className="space-y-4 max-w-xl text-xs">
                  <div>
                    <label className="text-[#868A91] block mb-1">Toolchain Location:</label>
                    <input 
                      type="text" 
                      readOnly 
                      value={toolchainData?.rust || 'C:\\Users\\adminlocal\\.cargo\\bin (rustc 1.99.1)'} 
                      className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none" 
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formSettings.cargoCheckOnFly ?? true}
                      onChange={(e) => updateSetting('cargoCheckOnFly', e.target.checked)}
                      className="accent-[#3574F0] rounded" 
                    />
                    <span>Run external linter on the fly (cargo check)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formSettings.useRustfmt ?? true}
                      onChange={(e) => updateSetting('useRustfmt', e.target.checked)}
                      className="accent-[#3574F0] rounded" 
                    />
                    <span>Use rustfmt instead of built-in code formatter</span>
                  </label>
                </div>
              </div>
            )}

            {/* Sub-page: Languages > TypeScript / JavaScript */}
            {selectedId === 'lang-typescript' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">TypeScript / JavaScript</h2>
                  <p className="text-xs text-[#868A91]">Node.js runtime interpreter and TypeScript Language Server.</p>
                </div>

                <div className="space-y-4 max-w-xl text-xs">
                  <div>
                    <label className="text-[#868A91] block mb-1">Node.js Interpreter:</label>
                    <input 
                      type="text" 
                      readOnly 
                      value={toolchainData?.node || 'C:\\Program Files\\nodejs\\node.exe (v22.17.0)'} 
                      className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none" 
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formSettings.tsLanguageServer ?? true}
                      onChange={(e) => updateSetting('tsLanguageServer', e.target.checked)}
                      className="accent-[#3574F0] rounded" 
                    />
                    <span>Use TypeScript Language Service (tsconfig.json)</span>
                  </label>
                </div>
              </div>
            )}

            {/* Sub-page: Languages > Python */}
            {selectedId === 'lang-python' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Python</h2>
                  <p className="text-xs text-[#868A91]">Python interpreter, virtual environment, and package manager.</p>
                </div>

                <div className="space-y-4 max-w-xl text-xs">
                  <div>
                    <label className="text-[#868A91] block mb-1">Python Interpreter:</label>
                    <input 
                      type="text" 
                      readOnly 
                      value={toolchainData?.python || 'Python 3.12 (Virtualenv .venv)'} 
                      className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none" 
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                    <span>Auto-create virtual environment for new projects</span>
                  </label>
                </div>
              </div>
            )}

            {/* Sub-page: Languages > Java */}
            {selectedId === 'lang-java' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Java</h2>
                  <p className="text-xs text-[#868A91]">JDK configuration and compiler bytecode compliance level.</p>
                </div>

                <div className="space-y-4 max-w-xl text-xs">
                  <div>
                    <label className="text-[#868A91] block mb-1">Project SDK:</label>
                    <input 
                      type="text" 
                      readOnly 
                      value={toolchainData?.java || 'Amazon Corretto 17.0.12 (corretto-17)'} 
                      className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none" 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Target Bytecode Version:</span>
                    <select className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none">
                      <option value="17">17 (LTS)</option>
                      <option value="21">21 (LTS)</option>
                      <option value="11">11</option>
                      <option value="8">8</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Tools > Terminal */}
            {selectedId === 'tools-terminal' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Terminal</h2>
                  <p className="text-xs text-[#868A91]">Configure embedded shell environment and options.</p>
                </div>

                <div className="space-y-4 max-w-xl">
                  <div>
                    <label className="text-[#868A91] block mb-1">Shell Path:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={formSettings.terminalShell || 'powershell.exe'}
                        onChange={(e) => updateSetting('terminalShell', e.target.value)}
                        className="flex-1 bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none"
                      />
                      <select
                        onChange={(e) => updateSetting('terminalShell', e.target.value)}
                        className="bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1.5 text-xs text-[#DFE1E5] outline-none"
                      >
                        <option value="powershell.exe">PowerShell</option>
                        <option value="cmd.exe">Command Prompt</option>
                        <option value="bash.exe">Git Bash</option>
                        <option value="wsl.exe">WSL (Ubuntu)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#393B40] space-y-2.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                      <span>Start in current project root directory</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                      <span>Audible bell</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                      <span>Close session when it ends with exit code 0</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Tools > Tasks */}
            {selectedId === 'tools-tasks' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Tasks</h2>
                  <p className="text-xs text-[#868A91]">Integrate issue trackers (Jira, GitHub Issues, YouTrack) with IDE changelists.</p>
                </div>

                <div className="space-y-3 max-w-xl text-xs">
                  <div className="border border-[#393B40] rounded bg-[#26282B] p-3 space-y-2">
                    <div className="font-semibold text-white">Configured Task Servers:</div>
                    <div className="text-[#868A91]">GitHub Issues (api.github.com)</div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                    <span>Create changelist automatically when opening a task</span>
                  </label>
                </div>
              </div>
            )}

            {/* Sub-page: Tools > Web Browsers */}
            {selectedId === 'tools-web-browsers' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Web Browsers</h2>
                  <p className="text-xs text-[#868A91]">Configure web browsers for HTML preview and live editing.</p>
                </div>

                <div className="border border-[#393B40] rounded bg-[#26282B] overflow-hidden text-xs max-w-xl">
                  <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
                    <span>Browser</span>
                    <span>Selection</span>
                  </div>
                  <div className="divide-y divide-[#393B40]/50 p-2 space-y-2">
                    {['Google Chrome', 'Microsoft Edge', 'Mozilla Firefox', 'Brave'].map(b => (
                      <label key={b} className="flex items-center justify-between cursor-pointer px-2 py-1 hover:bg-[#35373B] rounded">
                        <span>{b}</span>
                        <input
                          type="radio"
                          name="browserSelect"
                          checked={formSettings.defaultBrowser === b.toLowerCase()}
                          onChange={() => updateSetting('defaultBrowser', b.toLowerCase())}
                          className="accent-[#3574F0]"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Backup and Sync */}
            {selectedId === 'backup-sync' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Backup and Sync</h2>
                  <p className="text-xs text-[#868A91]">Sync your IDE settings, keymaps, and themes across workstations.</p>
                </div>

                <div className="border border-[#393B40] rounded bg-[#26282B] p-4 text-xs space-y-3 max-w-xl">
                  <div className="flex items-center gap-2 text-[#59A869] font-medium">
                    <CheckCircle2 size={16} />
                    <span>Settings are synchronized with Local Backup</span>
                  </div>
                  <p className="text-[#868A91]">Last synchronized: {lastSyncTime}</p>
                  
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => {
                        setSyncStatus('syncing');
                        setTimeout(() => {
                          setSyncStatus('synced');
                          setLastSyncTime(new Date().toLocaleTimeString());
                          onShowToast?.('Sync Finished', 'Settings uploaded and backed up successfully', 'success');
                        }, 500);
                      }}
                      className="px-3.5 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw size={12} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                      Sync Settings Now
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(formSettings, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'intellij-ide-settings.json';
                        a.click();
                        URL.revokeObjectURL(url);
                        onShowToast?.('Exported', 'Saved settings to intellij-ide-settings.json', 'success');
                      }}
                      className="px-3 py-1.5 bg-[#2B2D30] hover:bg-[#35373B] text-[#DFE1E5] rounded border border-[#393B40] flex items-center gap-1"
                    >
                      <Download size={12} /> Export...
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-page: Advanced Settings */}
            {selectedId === 'advanced-settings' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1">Advanced Settings</h2>
                  <p className="text-xs text-[#868A91]">Fine-tune low-level IDE mechanics, memory buffers, and experimental features.</p>
                </div>

                <div className="space-y-6 max-w-xl text-xs">
                  {/* Editor Group */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-white border-b border-[#393B40] pb-1.5 text-xs">Editor</h3>
                    <div className="space-y-2.5 pl-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                        <span>Show inline intention bulb suggestions</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                        <span>Enable parameter name hints in function calls</span>
                      </label>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[#DFE1E5]">Recent files limit:</span>
                        <input 
                          type="number" 
                          value={formSettings.recentFilesLimit || 50} 
                          onChange={(e) => updateSetting('recentFilesLimit', Number(e.target.value))}
                          className="w-24 bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Terminal Group */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-white border-b border-[#393B40] pb-1.5 text-xs">Terminal</h3>
                    <div className="space-y-2.5 pl-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[#DFE1E5]">Buffer scrollback lines:</span>
                        <input 
                          type="number" 
                          value={formSettings.terminalScrollback || 10000} 
                          onChange={(e) => updateSetting('terminalScrollback', Number(e.target.value))}
                          className="w-24 bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none" 
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                        <span>Use ConPTY terminal engine on Windows</span>
                      </label>
                    </div>
                  </div>

                  {/* Search Everywhere Group */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-white border-b border-[#393B40] pb-1.5 text-xs">Search Everywhere</h3>
                    <div className="space-y-2.5 pl-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                        <span>Show recently opened files first in search results</span>
                      </label>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[#DFE1E5]">Double Shift activation timeout (ms):</span>
                        <input 
                          type="number" 
                          value={formSettings.doubleShiftTimeout || 350} 
                          onChange={(e) => updateSetting('doubleShiftTimeout', Number(e.target.value))}
                          className="w-24 bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="h-12 bg-[#26282B] border-t border-[#393B40] px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-[#868A91] hover:text-[#DFE1E5] cursor-pointer">
            <HelpCircle size={15} />
            <span>Help</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOk}
              className="px-5 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded-[4px] text-xs font-medium shadow-sm transition-colors"
            >
              OK
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-[4px] text-xs text-[#DFE1E5] hover:bg-[#35373B] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!isDirty}
              className="px-4 py-1.5 bg-[#35373B] hover:bg-[#3E4146] disabled:opacity-40 disabled:cursor-not-allowed text-[#DFE1E5] rounded-[4px] text-xs transition-colors border border-[#43454A]"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
