import React, { useState, useEffect } from 'react';
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
  HelpCircle,
} from 'lucide-react';
import { IdeThemeId } from '../../types/theme';
import { applyIdeTheme } from '../../themes/themeManager';
import { loadLiveTemplates, saveLiveTemplates, LiveTemplate } from '../../editor/cm/snippetEngine';
import {
  SettingPanelProps,
  AppearanceBehaviorPanel,
  KeymapPanel,
  EditorSettingsPanel,
  PluginsPanel,
  VersionControlPanel,
  BuildExecutionPanel,
  LanguagesFrameworksPanel,
  ToolsPanel,
  BackupSyncPanel,
  AdvancedSettingsPanel,
} from './panels';

export interface IdeSettings {
  theme: IdeThemeId;
  fontSize: number;
  tabSize: number;
  minimap: boolean;
  lineNumbers: boolean;
  wordWrap: boolean;
  vimMode?: boolean;
  customThemeJson?: string;
  breadcrumbs?: boolean;
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
  tabPlacement?: 'top' | 'bottom' | 'left' | 'right' | 'none';
  tabLimit?: number;
  markModifiedTabs?: boolean;
  globalEncoding?: string;
  projectEncoding?: string;
  propertiesEncoding?: string;
  // Go Settings
  goRoot?: string;
  goPath?: string;
  goVendor?: boolean;
  goVetOnBuild?: boolean;
  goFmtOnSave?: boolean;
  goBuildTags?: string;
  // C / C++ Settings
  cppCompiler?: string;
  cppStandard?: string;
  cStandard?: string;
  cmakePath?: string;
  cmakeGenerator?: string;
  clangTidy?: boolean;
  clangFormat?: boolean;
  // SQL & Databases Settings
  defaultSqlDialect?: string;
  sqlRowLimit?: number;
  sqlAutoCommit?: boolean;
  sqlKeywordsCase?: 'upper' | 'lower';
  sqlFormatComma?: 'leading' | 'trailing';
  // HTML & CSS / Tailwind Settings
  emmetEnabled?: boolean;
  tailwindLsp?: boolean;
  autoprefixerEnabled?: boolean;
  scssCompileOnSave?: boolean;
  cssIndentSize?: number;
  // Markdown & Documentation Settings
  markdownMermaid?: boolean;
  markdownMath?: boolean;
  markdownSyncScroll?: boolean;
  markdownSpellCheck?: boolean;
  // Docker & Cloud Settings
  dockerCliPath?: string;
  dockerComposePath?: string;
  dockerSocketPath?: string;
  dockerBuildKit?: boolean;
  dockerHadolint?: boolean;
  // JSON & YAML Schemas Settings
  jsonStrictValidation?: boolean;
  jsonSchemaStoreSync?: boolean;
  yamlIndent?: number;
  jsonAllowComments?: boolean;
  // File Watchers & External Tools
  fileWatchersEnabled?: boolean;
  autoFormatOnSave?: boolean;
  externalToolsEnabled?: boolean;
  // VCS GitHub
  githubEnterpriseUrl?: string;
  gitAuthType?: 'token' | 'ssh' | 'oauth';
  gitDefaultBranch?: string;
  gitAutoFetch?: boolean;
  gitGpgSigning?: boolean;
  // Build Docker Target
  dockerTargetHost?: string;
  // Keymaps
  keymapProfile?: 'windows' | 'macos' | 'vscode' | 'eclipse' | 'netbeans';
  customKeymaps?: Record<string, string>;
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: IdeSettings;
  onSaveSettings: (newSettings: IdeSettings) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onOpenThemeStudio?: () => void;
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

export interface TreeItem {
  id: string;
  label: string;
  icon?: any;
  badge?: string | number;
  children?: TreeItem[];
  description?: string;
}

export function findNodeById(nodes: TreeItem[], id: string): TreeItem | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function findNodePath(nodes: TreeItem[], id: string, currentPath: TreeItem[] = []): TreeItem[] | null {
  for (const node of nodes) {
    const nextPath = [...currentPath, node];
    if (node.id === id) return nextPath;
    if (node.children) {
      const found = findNodePath(node.children, id, nextPath);
      if (found) return found;
    }
  }
  return null;
}

export function getAllDescendants(node: TreeItem): TreeItem[] {
  if (!node.children || node.children.length === 0) {
    return [];
  }
  const result: TreeItem[] = [];
  for (const child of node.children) {
    result.push(child);
    if (child.children && child.children.length > 0) {
      result.push(...getAllDescendants(child));
    }
  }
  return result;
}

export const getAllDescendantLeaves = getAllDescendants;

export function nodeMatchesSearch(node: TreeItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (node.label.toLowerCase().includes(q)) return true;
  if (node.children && node.children.some(child => nodeMatchesSearch(child, query))) {
    return true;
  }
  return false;
}

export const SETTINGS_TREE: TreeItem[] = [
  {
    id: 'appearance-behavior',
    label: 'Appearance & Behavior',
    icon: Palette,
    description: 'Customize IDE appearance and behavior: change themes and font sizes, tune the keymap, configure plugins and system settings, such as password policies, HTTP proxy, and updates.',
    children: [
      { id: 'appearance', label: 'Appearance' },
      { id: 'theme-studio', label: 'Theme Studio' },
      { id: 'menus-toolbars', label: 'Menus and Toolbars' },
      {
        id: 'system-settings',
        label: 'System Settings',
        description: 'Configure general system settings, password management, HTTP proxy, synchronization, and software updates.',
        children: [
          { id: 'system-passwords', label: 'Passwords' },
          { id: 'system-http-proxy', label: 'HTTP Proxy' },
          { id: 'system-updates', label: 'Updates' },
        ]
      },
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
    description: 'Configure code editor options, fonts, syntax highlighting colors, formatting styles, code completion, inspections, and templates.',
    children: [
      {
        id: 'editor-general',
        label: 'General',
        description: 'Configure general editor behavior, tabs, appearance, code completion, folding, and smart keys.',
        children: [
          { id: 'editor-tabs', label: 'Editor Tabs' },
          { id: 'editor-appearance', label: 'Appearance' },
          { id: 'editor-smart-keys', label: 'Smart Keys' },
          { id: 'editor-code-completion', label: 'Code Completion' },
          { id: 'editor-code-folding', label: 'Code Folding' },
          { id: 'editor-breadcrumbs', label: 'Breadcrumbs' },
        ]
      },
      { id: 'editor-font', label: 'Font' },
      { id: 'editor-color-scheme', label: 'Color Scheme' },
      { id: 'editor-code-style', label: 'Code Style' },
      { id: 'editor-inspections', label: 'Inspections' },
      { id: 'editor-file-templates', label: 'File and Code Templates' },
      { id: 'editor-file-encodings', label: 'File Encodings' },
      { id: 'editor-live-templates', label: 'Live Templates' },
      { id: 'editor-emmet', label: 'Emmet' },
      { id: 'editor-injections', label: 'Language Injections' },
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
      { id: 'vcs-github', label: 'GitHub & Cloud VCS' },
      { id: 'vcs-directory-mappings', label: 'Directory Mappings' },
      { id: 'vcs-confirmation', label: 'Confirmation' },
      { id: 'vcs-issue-navigation', label: 'Issue Navigation' },
      { id: 'vcs-changelists', label: 'Changelists' },
      { id: 'vcs-shelve', label: 'Shelve' },
    ]
  },
  {
    id: 'build-exec',
    label: 'Build, Execution, Deployment',
    icon: Hammer,
    description: 'Configure build toolchains, compiler options, run/debug configurations, Docker, and cloud deployments.',
    children: [
      {
        id: 'build-tools',
        label: 'Build Tools',
        description: 'Configure Maven, Gradle, Cargo, and package manager integrations.',
        children: [
          { id: 'build-tools-maven', label: 'Maven' },
          { id: 'build-tools-gradle', label: 'Gradle' },
          { id: 'build-tools-cargo', label: 'Cargo' },
        ]
      },
      {
        id: 'build-compiler',
        label: 'Compiler',
        description: 'Configure Java compiler, Rust compiler, resource patterns, annotation processors, and excludes.',
        children: [
          { id: 'build-compiler-java', label: 'Java Compiler' },
          { id: 'build-compiler-annotation', label: 'Annotation Processors' },
          { id: 'build-compiler-excludes', label: 'Excludes' },
        ]
      },
      {
        id: 'build-debugger',
        label: 'Debugger',
        description: 'Configure debugger stepping, data views, hotswap, and breakpoints.',
        children: [
          { id: 'build-debugger-views', label: 'Data Views' },
          { id: 'build-debugger-stepping', label: 'Stepping' },
          { id: 'build-debugger-hotswap', label: 'HotSwap' },
        ]
      },
      { id: 'build-docker', label: 'Docker' },
      { id: 'build-deployment', label: 'Deployment' },
      { id: 'build-coverage', label: 'Coverage' },
      { id: 'build-remote', label: 'Remote Development' },
    ]
  },
  {
    id: 'languages',
    label: 'Languages & Frameworks',
    icon: Cpu,
    description: 'Configure the settings related to specific frameworks and technologies used in your project',
    children: [
      { id: 'lang-rust', label: 'Rust' },
      { id: 'lang-android', label: 'Android (Experimental)' },
      { id: 'lang-android-sdk', label: 'Android SDK Updater' },
      { id: 'lang-dart', label: 'Dart' },
      { id: 'lang-flutter', label: 'Flutter' },
      {
        id: 'lang-javascript',
        label: 'JavaScript',
        description: 'Configure JavaScript language version, JSX, and package managers.',
        children: [
          { id: 'lang-js-runtime', label: 'JavaScript Runtime' },
          { id: 'lang-jvm-logging', label: 'JVM Logging' },
        ]
      },
      { id: 'lang-kotlin', label: 'Kotlin' },
      { id: 'lang-markdown', label: 'Markdown' },
      { id: 'lang-openapi', label: 'OpenAPI Specifications' },
      { id: 'lang-protobuf', label: 'Protocol Buffers' },
      { id: 'lang-schemas', label: 'Schemas and DTDs' },
      {
        id: 'lang-stylesheets',
        label: 'Style Sheets',
        description: 'Configure CSS, Sass, Less, PostCSS, and template styles.',
        children: [
          { id: 'lang-css-tables', label: 'Tables' },
          { id: 'lang-template-data', label: 'Template Data Languages' },
        ]
      },
      { id: 'lang-typescript', label: 'TypeScript' },
      {
        id: 'lang-xslt',
        label: 'XSLT',
        description: 'Configure XSLT processors, XML transformation engines, and file associations.',
        children: [
          { id: 'lang-xslt-assoc', label: 'XSLT File Associations' },
        ]
      },
      { id: 'lang-java', label: 'Java' },
      { id: 'lang-python', label: 'Python' },
      { id: 'lang-go', label: 'Go' },
      { id: 'lang-cpp', label: 'C / C++' },
      { id: 'lang-sql', label: 'SQL & Databases' },
      { id: 'lang-docker', label: 'Docker & Cloud' },
    ]
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: Terminal,
    description: 'Configure embedded terminal shell, external tools, tasks, web browsers, and file watchers.',
    children: [
      { id: 'tools-ai', label: 'AI Assistant (Local LLM)' },
      { id: 'tools-terminal', label: 'Terminal' },
      { id: 'tools-web-browsers', label: 'Web Browsers and Previews' },
      { id: 'tools-external-tools', label: 'External Tools' },
      { id: 'tools-file-watchers', label: 'File Watchers' },
      {
        id: 'tools-tasks',
        label: 'Tasks',
        description: 'Configure issue tracking servers, JIRA/GitHub issue sync, and time tracking.',
        children: [
          { id: 'tools-tasks-servers', label: 'Servers' },
          { id: 'tools-tasks-time', label: 'Time Tracking' },
        ]
      },
      {
        id: 'tools-database',
        label: 'Database',
        description: 'Configure DataGrip database viewer, CSV delimiters, and table layout.',
        children: [
          { id: 'tools-database-data', label: 'Data Editor and Viewer' },
          { id: 'tools-database-csv', label: 'CSV Format' },
        ]
      },
      { id: 'tools-http-client', label: 'HTTP Client' },
      { id: 'tools-ssh', label: 'SSH Configurations' },
      { id: 'tools-sonarqube', label: 'SonarQube / SonarLint' },
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
  },
];

export interface KeymapActionItem {
  action: string;
  shortcut: string;
  category: string;
}

export const DEFAULT_KEYMAPS: KeymapActionItem[] = [
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
  { action: 'Duplicate Line or Selection', shortcut: 'Ctrl+D', category: 'Main Menu / Edit' },
  { action: 'Move Line Down', shortcut: 'Alt+Shift+Down', category: 'Main Menu / Edit' },
  { action: 'Move Line Up', shortcut: 'Alt+Shift+Up', category: 'Main Menu / Edit' },
  { action: 'Delete Line', shortcut: 'Ctrl+Y', category: 'Main Menu / Edit' },
  { action: 'Open Settings Dialog', shortcut: 'Ctrl+Alt+S', category: 'Main Menu / File' },
  { action: 'Project Structure Dialog', shortcut: 'Ctrl+Alt+Shift+S', category: 'Main Menu / File' },
];

export const getKeymapsForProfile = (
  profile: 'windows' | 'macos' | 'vscode' | 'eclipse' | 'netbeans',
  customMap?: Record<string, string>
): KeymapActionItem[] => {
  return DEFAULT_KEYMAPS.map(item => {
    let shortcut = item.shortcut;
    if (profile === 'netbeans') {
      if (item.action === 'Reformat Code') shortcut = 'Alt+Shift+F';
      else if (item.action === 'Run \'Desktop IDE\'') shortcut = 'F6';
      else if (item.action === 'Debug \'Desktop IDE\'') shortcut = 'Ctrl+F5';
      else if (item.action === 'Build Project') shortcut = 'F11';
      else if (item.action === 'Open Project / File...') shortcut = 'Ctrl+Shift+O';
    } else if (profile === 'macos') {
      shortcut = shortcut.replace(/Ctrl\+/g, 'Cmd+').replace(/Alt\+/g, 'Option+');
    } else if (profile === 'vscode') {
      if (item.action === 'Reformat Code') shortcut = 'Shift+Alt+F';
      else if (item.action === 'Search Everywhere') shortcut = 'Ctrl+P';
      else if (item.action === 'Toggle Terminal') shortcut = 'Ctrl+`';
    } else if (profile === 'eclipse') {
      if (item.action === 'Reformat Code') shortcut = 'Ctrl+Shift+F';
    }

    if (customMap && customMap[item.action]) {
      shortcut = customMap[item.action];
    }
    return { ...item, shortcut };
  });
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onShowToast,
  onOpenThemeStudio,
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
    goRoot: 'C:\\Program Files\\Go',
    goPath: '~/go',
    goVendor: false,
    goVetOnBuild: true,
    goFmtOnSave: true,
    goBuildTags: '',
    cppCompiler: 'clang++',
    cppStandard: 'c++20',
    cStandard: 'c17',
    cmakePath: 'cmake',
    cmakeGenerator: 'Ninja',
    clangTidy: true,
    clangFormat: true,
    defaultSqlDialect: 'PostgreSQL',
    sqlRowLimit: 500,
    sqlAutoCommit: true,
    sqlKeywordsCase: 'upper',
    sqlFormatComma: 'leading',
    emmetEnabled: true,
    tailwindLsp: true,
    autoprefixerEnabled: true,
    scssCompileOnSave: false,
    cssIndentSize: 2,
    markdownMermaid: true,
    markdownMath: true,
    markdownSyncScroll: true,
    markdownSpellCheck: false,
    dockerCliPath: 'docker',
    dockerComposePath: 'docker-compose',
    dockerSocketPath: 'npipe:////./pipe/docker_engine',
    dockerBuildKit: true,
    dockerHadolint: true,
    jsonStrictValidation: true,
    jsonSchemaStoreSync: true,
    yamlIndent: 2,
    jsonAllowComments: true,
    fileWatchersEnabled: true,
    autoFormatOnSave: true,
    externalToolsEnabled: true,
    githubEnterpriseUrl: 'https://github.com',
    gitAuthType: 'token',
    gitDefaultBranch: 'main',
    gitAutoFetch: true,
    gitGpgSigning: false,
    dockerTargetHost: 'unix:///var/run/docker.sock',
    keymapProfile: 'windows',
    customKeymaps: {},
    ...settings,
  });

  const [isDirty, setIsDirty] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [keymapProfile, setKeymapProfile] = useState<'windows' | 'macos' | 'vscode' | 'eclipse' | 'netbeans'>(() => {
    return (settings.keymapProfile || (localStorage.getItem('intellij_keymap_profile') as any) || 'windows');
  });

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

  // Live Templates state
  const [liveTemplates, setLiveTemplates] = useState<LiveTemplate[]>(() => loadLiveTemplates());

  // Keymaps list
  const [keymaps, setKeymaps] = useState<KeymapActionItem[]>(() => {
    const profile = (settings.keymapProfile || (localStorage.getItem('intellij_keymap_profile') as any) || 'windows');
    let custom: Record<string, string> = settings.customKeymaps || {};
    try {
      const savedCustom = localStorage.getItem('intellij_custom_keymap');
      if (savedCustom) {
        custom = { ...custom, ...JSON.parse(savedCustom) };
      }
    } catch (e) {
      console.error(e);
    }
    return getKeymapsForProfile(profile, custom);
  });

  // Sync internal state if props change
  useEffect(() => {
    setFormSettings(prev => ({
      ...prev,
      ...settings,
    }));
  }, [settings]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateSetting = <K extends keyof IdeSettings>(key: K, value: IdeSettings[K]) => {
    setFormSettings(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
    if (key === 'theme') {
      applyIdeTheme(value as any);
    }
  };

  const handleApply = () => {
    const customKeymapMap = Object.fromEntries(keymaps.map(k => [k.action, k.shortcut]));
    const updatedSettings: IdeSettings = {
      ...formSettings,
      keymapProfile,
      customKeymaps: customKeymapMap,
    };
    onSaveSettings(updatedSettings);
    applyIdeTheme(updatedSettings.theme);
    saveLiveTemplates(liveTemplates);
    if (updatedSettings.projectOpenMode) {
      localStorage.setItem('ij_project_open_mode', updatedSettings.projectOpenMode);
    }
    try {
      localStorage.setItem('intellij_keymap_profile', keymapProfile);
      localStorage.setItem('intellij_custom_keymap', JSON.stringify(customKeymapMap));
      localStorage.setItem('intellij_ide_settings', JSON.stringify(updatedSettings));
    } catch (e) {
      console.warn('Failed to save keymaps to localStorage:', e);
    }
    window.dispatchEvent(new CustomEvent('ide-keymap-changed', {
      detail: { profile: keymapProfile, keymaps: customKeymapMap }
    }));
    setIsDirty(false);
  };

  const handleOk = () => {
    handleApply();
    onClose();
  };

  // Active node and breadcrumbs for hierarchical navigation
  const activeNode = findNodeById(SETTINGS_TREE, selectedId) || SETTINGS_TREE[0];
  const activeBreadcrumbs = findNodePath(SETTINGS_TREE, selectedId) || [activeNode];
  const isCategoryOverview = ['appearance-behavior', 'editor', 'version-control', 'build-exec', 'languages', 'tools'].includes(selectedId);

  const installedPluginCount = installedPlugins.filter(p => p.enabled).length;

  const renderTreeNode = (item: TreeItem, depth: number = 0): React.ReactNode => {
    const hasChildren = Boolean(item.children && item.children.length > 0);
    const isExpanded = searchQuery ? true : Boolean(expandedNodes[item.id]);
    const isSelected = selectedId === item.id;
    const Icon = item.icon;

    if (!nodeMatchesSearch(item, searchQuery)) {
      return null;
    }

    return (
      <div key={item.id} className="space-y-0.5">
        <div
          onClick={() => {
            setSelectedId(item.id);
            if (hasChildren && !expandedNodes[item.id]) {
              setExpandedNodes(prev => ({ ...prev, [item.id]: true }));
            }
          }}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          className={`flex items-center justify-between pr-2 py-1.5 rounded-[4px] cursor-pointer text-xs transition-colors ${
            isSelected
              ? 'bg-[#2E436E] text-white font-medium'
              : 'text-[#DFE1E5] hover:bg-[#35373B]'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {hasChildren ? (
              <button
                onClick={(e) => toggleExpand(item.id, e)}
                className="p-0.5 hover:bg-[#393B40] rounded text-[#868A91] shrink-0"
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            {Icon && <Icon size={14} className={isSelected ? 'text-white shrink-0' : 'text-[#868A91] shrink-0'} />}
            <span className="truncate">{item.label}</span>
          </div>

          {item.id === 'plugins' && (
            <span className="px-1.5 py-0.2 bg-[#3574F0]/30 text-[#85B1F8] border border-[#3574F0]/40 rounded text-[10px] font-mono shrink-0">
              {installedPluginCount}
            </span>
          )}
        </div>

        {/* Recursive Children */}
        {hasChildren && isExpanded && (
          <div className="space-y-0.5">
            {item.children!.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  const panelProps: SettingPanelProps = {
    selectedId,
    formSettings,
    updateSetting,
    setFormSettings,
    setIsDirty,
    onShowToast,
    onOpenThemeStudio,
    setSelectedId,
    keymaps,
    setKeymaps,
    keymapProfile,
    setKeymapProfile,
    liveTemplates,
    setLiveTemplates,
  };

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
              {SETTINGS_TREE.map((item) => renderTreeNode(item, 0))}
            </div>
          </div>

          {/* Right Configuration Detail Pane */}
          <div className="flex-1 bg-[#1E1F22] p-6 overflow-y-auto text-[12.5px]">
            {/* IntelliJ Top Breadcrumb Bar */}
            <div className="flex items-center gap-1.5 pb-3 mb-5 border-b border-[#393B40]/50 text-xs text-[#868A91]">
              {activeBreadcrumbs.map((crumb, idx) => {
                const isLast = idx === activeBreadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb.id}>
                    {idx > 0 && <ChevronRight size={12} className="text-[#5A5D63]" />}
                    <span
                      className={isLast ? 'text-[#DFE1E5] font-medium' : 'hover:text-[#DFE1E5] cursor-pointer transition-colors'}
                      onClick={() => {
                        if (!isLast) setSelectedId(crumb.id);
                      }}
                    >
                      {crumb.label}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Overview Screen for Top-level Categories */}
            {isCategoryOverview && (
              <div className="space-y-4 animate-in fade-in duration-100 mb-6">
                <div>
                  <h2 className="text-base font-semibold text-white mb-1.5">
                    {activeNode.label}
                  </h2>
                  <p className="text-xs text-[#868A91] leading-relaxed max-w-2xl">
                    {activeNode.description || 'Configure the settings related to specific frameworks and technologies used in your project'}
                  </p>
                </div>

                {activeNode.children && activeNode.children.length > 0 && (
                  <div className="pt-2 flex flex-col space-y-2 max-w-md">
                    {getAllDescendants(activeNode).map(leaf => (
                      <span
                        key={leaf.id}
                        onClick={() => {
                          setSelectedId(leaf.id);
                          const path = findNodePath(SETTINGS_TREE, leaf.id);
                          if (path) {
                            setExpandedNodes(prev => ({
                              ...prev,
                              ...Object.fromEntries(path.map(p => [p.id, true]))
                            }));
                          }
                        }}
                        className="text-[#4B9FD5] hover:underline cursor-pointer text-xs py-0.5 inline-block w-fit"
                      >
                        {leaf.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Domain Panel Dispatcher */}
            {(selectedId === 'appearance' || [
              'theme-studio', 
              'menus-toolbars', 
              'system-settings', 
              'file-colors', 
              'scopes', 
              'notifications', 
              'data-editor', 
              'quick-lists', 
              'path-variables'
            ].includes(selectedId)) && (
              <AppearanceBehaviorPanel {...panelProps} />
            )}

            {selectedId === 'keymap' && (
              <KeymapPanel {...panelProps} />
            )}

            {selectedId.startsWith('editor-') && (
              <EditorSettingsPanel {...panelProps} />
            )}

            {selectedId === 'plugins' && (
              <PluginsPanel {...panelProps} />
            )}

            {selectedId.startsWith('vcs-') && (
              <VersionControlPanel {...panelProps} />
            )}

            {selectedId.startsWith('build-') && (
              <BuildExecutionPanel {...panelProps} />
            )}

            {selectedId.startsWith('lang-') && (
              <LanguagesFrameworksPanel {...panelProps} />
            )}

            {selectedId.startsWith('tools-') && (
              <ToolsPanel {...panelProps} />
            )}

            {selectedId === 'backup-sync' && (
              <BackupSyncPanel {...panelProps} />
            )}

            {selectedId === 'advanced-settings' && (
              <AdvancedSettingsPanel {...panelProps} />
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
