import { 
  FilePlus, 
  FolderPlus, 
  FolderOpen, 
  Save, 
  X, 
  Minus,
  RotateCcw, 
  Scissors, 
  Copy, 
  Clipboard, 
  Search, 
  Replace, 
  CheckSquare, 
  Terminal, 
  Play, 
  Bug, 
  Square, 
  Hammer, 
  GitCommit, 
  GitPullRequest, 
  Info, 
  Sparkles,
  Layout,
  AlignLeft,
  RefreshCw,
  FolderTree,
  PlaySquare,
  Settings,
  Edit3,
  Sliders,
  History,
  FoldHorizontal,
  UnfoldHorizontal,
  Plus,
  FileCode,
  FileText,
  Package,
  FolderGit2,
  Layers,
  Clock,
  Wrench,
  Trash2,
  Download,
  Upload,
  Zap,
  Coffee,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize,
  Shield,
  Globe,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  AlertCircle,
  GitBranch,
  Database,
  ArrowUpFromLine,
  ArrowDownToLine,
  Columns,
  CheckCircle2,
  Palette,
  Calculator
} from 'lucide-react';
import { MenuRegistry, MenuItem } from '../types/menu';

export interface FileMenuOptions {
  powerSaveMode?: boolean;
  isReadOnly?: boolean;
  fileEncoding?: string;
  lineEnding?: 'CRLF' | 'LF';
  recentProjects?: Array<{ name: string; path: string }>;
}

export function getFileMenuItems(options: FileMenuOptions = {}): MenuItem[] {
  const {
    powerSaveMode = false,
    isReadOnly = false,
    fileEncoding = 'UTF-8',
    lineEnding = 'CRLF',
    recentProjects = []
  } = options;

  return [
    {
      id: 'f-new',
      label: 'New',
      icon: Plus,
      children: [
        { id: 'f-new-project', label: 'Project...', icon: FolderGit2, actionId: 'file.newProject' },
        { id: 'f-new-existing', label: 'Project from Existing Sources...', icon: FolderOpen, actionId: 'file.newFromExisting' },
        { id: 'f-new-vcs', label: 'Project from Version Control...', icon: FolderGit2, actionId: 'file.newFromVcs' },
        { id: 'f-new-module', label: 'Module...', actionId: 'file.newProject' },
        { id: 'f-new-module-existing', label: 'Module from Existing Sources...', actionId: 'file.newFromExisting' },
        { id: 'f-new-sep-1', isSeparator: true },
        { id: 'f-new-file', label: 'File', shortcut: 'Ctrl+N', icon: FilePlus, actionId: 'file.new' },
        { id: 'f-new-scratch', label: 'Scratch File', shortcut: 'Ctrl+Alt+Shift+Insert', icon: FileCode, actionId: 'file.newScratch' },
        { id: 'f-new-dir', label: 'Directory', icon: FolderPlus, actionId: 'file.newFolder' },
        { id: 'f-new-package', label: 'Package', icon: Package, actionId: 'file.newPackage' },
        { id: 'f-new-sep-2', isSeparator: true },
        { id: 'f-new-java', label: 'Java Class', icon: Coffee, actionId: 'file.newJavaClass' },
        { id: 'f-new-kotlin', label: 'Kotlin Class/File', icon: FileCode, actionId: 'file.newKotlin' },
        { id: 'f-new-rust', label: 'Rust File', icon: FileCode, actionId: 'file.newRust' },
        { id: 'f-new-ts', label: 'TypeScript / React Component', icon: FileCode, actionId: 'file.newTs' },
        { id: 'f-new-html', label: 'HTML File', icon: FileText, actionId: 'file.newHtml' },
        { id: 'f-new-css', label: 'Style Sheet', icon: FileText, actionId: 'file.newCss' },
      ]
    },
    { id: 'f-open', label: 'Open...', shortcut: 'Ctrl+O', icon: FolderOpen, actionId: 'file.open' },
    { 
      id: 'f-recent', 
      label: 'Recent Projects', 
      icon: History,
      children: recentProjects.length > 0 ? [
        ...recentProjects.map((p, idx) => ({
          id: `recent-p-${idx}`,
          label: `${p.name} (${p.path})`,
          actionId: `file.openRecent:${p.path}`,
        })),
        { id: 'f-rec-sep', isSeparator: true },
        { id: 'f-rec-clear', label: 'Clear List...', icon: Trash2, actionId: 'file.clearRecentProjects' },
        { id: 'f-rec-manage', label: 'Manage Projects...', actionId: 'file.manageProjects' },
      ] : [
        { id: 'f-rec-empty', label: 'No Recent Projects', disabled: true },
        { id: 'f-rec-sep-2', isSeparator: true },
        { id: 'f-rec-manage-empty', label: 'Manage Projects...', actionId: 'file.manageProjects' },
      ]
    },
    { id: 'f-close-project', label: 'Close Project', actionId: 'file.closeProject' },
    { id: 'f-rename-project', label: 'Rename Project...', actionId: 'file.renameProject' },
    { id: 'f-sep-1', isSeparator: true },
    { id: 'f-settings', label: 'Settings...', shortcut: 'Ctrl+Alt+S', icon: Settings, actionId: 'file.settings' },
    { id: 'f-project-structure', label: 'Project Structure...', shortcut: 'Ctrl+Alt+Shift+S', icon: Layers, actionId: 'file.projectStructure' },
    {
      id: 'f-file-props',
      label: 'File Properties',
      icon: Sliders,
      children: [
        { 
          id: 'f-props-enc', 
          label: 'File Encoding', 
          children: [
            { id: 'f-enc-utf8', label: 'UTF-8', actionId: 'file.encoding.utf8', checked: fileEncoding.toUpperCase() === 'UTF-8' },
            { id: 'f-enc-ascii', label: 'US-ASCII', actionId: 'file.encoding.ascii', checked: fileEncoding.toUpperCase() === 'US-ASCII' },
            { id: 'f-enc-iso', label: 'ISO-8859-1', actionId: 'file.encoding.iso', checked: fileEncoding.toUpperCase() === 'ISO-8859-1' },
            { id: 'f-enc-win', label: 'Windows-1252', actionId: 'file.encoding.win1252', checked: fileEncoding.toUpperCase() === 'WINDOWS-1252' },
          ]
        },
        { 
          id: 'f-props-crlf', 
          label: 'Line Separators', 
          children: [
            { id: 'f-line-crlf', label: 'CRLF - Windows (\\r\\n)', actionId: 'file.line.crlf', checked: lineEnding === 'CRLF' },
            { id: 'f-line-lf', label: 'LF - Unix and macOS (\\n)', actionId: 'file.line.lf', checked: lineEnding === 'LF' },
          ]
        },
        { id: 'f-props-readonly', label: isReadOnly ? 'Make File Writable' : 'Make File Read-Only', actionId: 'file.toggleReadOnly', checked: isReadOnly },
        { id: 'f-props-bom', label: 'Remove BOM', actionId: 'file.removeBom' },
      ]
    },
    {
      id: 'f-local-history',
      label: 'Local History',
      icon: Clock,
      children: [
        { id: 'f-lh-show', label: 'Show History...', actionId: 'file.localHistory' },
        { id: 'f-lh-label', label: 'Put Label...', actionId: 'file.putLabel' },
      ]
    },
    { id: 'f-sep-2', isSeparator: true },
    { id: 'f-save-all', label: 'Save All', shortcut: 'Ctrl+S', icon: Save, actionId: 'file.saveAll' },
    { id: 'f-reload', label: 'Reload from Disk', shortcut: 'Ctrl+Alt+Y', icon: RefreshCw, actionId: 'file.reloadFromDisk' },
    { id: 'f-repair', label: 'Repair IDE...', icon: Wrench, actionId: 'file.repairIde' },
    { id: 'f-invalidate', label: 'Invalidate Caches...', icon: Trash2, actionId: 'file.invalidateCaches' },
    { id: 'f-sep-3', isSeparator: true },
    {
      id: 'f-manage-settings',
      label: 'Manage IDE Settings',
      children: [
        { id: 'f-sett-export', label: 'Export Settings...', icon: Download, actionId: 'file.exportSettings' },
        { id: 'f-sett-import', label: 'Import Settings...', icon: Upload, actionId: 'file.importSettings' },
        { id: 'f-sett-restore', label: 'Restore Default Settings...', icon: RotateCcw, actionId: 'file.restoreDefaultSettings' },
      ]
    },
    {
      id: 'f-new-setup',
      label: 'New Projects Setup',
      children: [
        { id: 'f-nps-settings', label: 'Settings for New Projects...', actionId: 'file.settingsForNewProjects' },
        { id: 'f-nps-templates', label: 'Run Configuration Templates...', actionId: 'file.runConfigTemplates' },
      ]
    },
    { id: 'f-save-template', label: 'Save File as Template...', actionId: 'file.saveFileAsTemplate' },
    { id: 'f-sync', label: 'Sync with File System', icon: RefreshCw, actionId: 'file.syncFileSystem' },
    { id: 'f-sep-4', isSeparator: true },
    { id: 'f-close', label: 'Close', shortcut: 'Ctrl+F4', icon: X, actionId: 'file.closeTab' },
    { id: 'f-close-all', label: 'Close All Tabs', shortcut: 'Ctrl+Shift+F4', actionId: 'file.closeAllTabs' },
    { id: 'f-sep-5', isSeparator: true },
    { id: 'f-power-save', label: 'Power Save Mode', icon: Zap, actionId: 'file.togglePowerSave', checked: powerSaveMode },
    { id: 'f-sep-6', isSeparator: true },
    { id: 'f-exit', label: 'Exit', shortcut: 'Alt+F4', actionId: 'app.exit' },
  ];
}

export const menuRegistry: MenuRegistry = {
  File: getFileMenuItems(),

  Edit: [
    { id: 'e-undo', label: 'Undo', shortcut: 'Ctrl+Z', icon: RotateCcw, actionId: 'edit.undo' },
    { id: 'e-redo', label: 'Redo', shortcut: 'Ctrl+Y', actionId: 'edit.redo' },
    { id: 'e-sep-1', isSeparator: true },
    { id: 'e-cut', label: 'Cut', shortcut: 'Ctrl+X', icon: Scissors, actionId: 'edit.cut' },
    { id: 'e-copy', label: 'Copy', shortcut: 'Ctrl+C', icon: Copy, actionId: 'edit.copy' },
    { 
      id: 'e-copy-path', 
      label: 'Copy Path/Reference', 
      icon: FolderOpen,
      children: [
        { id: 'e-cp-abs', label: 'Absolute Path', shortcut: 'Ctrl+Shift+C', actionId: 'edit.copyAbsolutePath' },
        { id: 'e-cp-rel', label: 'Path from Content Root', actionId: 'edit.copyRelativePath' },
        { id: 'e-cp-filename', label: 'Filename', actionId: 'edit.copyFilename' },
      ]
    },
    { id: 'e-paste', label: 'Paste', shortcut: 'Ctrl+V', icon: Clipboard, actionId: 'edit.paste' },
    { id: 'e-paste-history', label: 'Paste from History...', shortcut: 'Ctrl+Shift+V', icon: History, actionId: 'edit.pasteHistory' },
    { id: 'e-sep-2', isSeparator: true },
    { id: 'e-dup', label: 'Duplicate Line or Selection', shortcut: 'Ctrl+D', actionId: 'edit.duplicateLine' },
    { id: 'e-del', label: 'Delete', shortcut: 'Delete', icon: Trash2, actionId: 'edit.delete' },
    { id: 'e-toggle-case', label: 'Toggle Case', shortcut: 'Ctrl+Shift+U', actionId: 'edit.toggleCase' },
    { id: 'e-sep-3', isSeparator: true },
    { 
      id: 'e-find-menu', 
      label: 'Find', 
      icon: Search,
      children: [
        { id: 'e-find', label: 'Find in Editor...', shortcut: 'Ctrl+F', actionId: 'edit.find' },
        { id: 'e-replace', label: 'Replace in Editor...', shortcut: 'Ctrl+R', icon: Replace, actionId: 'edit.replace' },
        { id: 'e-find-files', label: 'Find in Files...', shortcut: 'Ctrl+Shift+F', actionId: 'edit.findInFiles' },
        { id: 'e-replace-files', label: 'Replace in Files...', shortcut: 'Ctrl+Shift+R', actionId: 'edit.replaceInFiles' },
      ]
    },
    { id: 'e-select-all', label: 'Select All', shortcut: 'Ctrl+A', actionId: 'edit.selectAll' },
  ],

  View: [
    { 
      id: 'v-tool-windows', 
      label: 'Tool Windows',
      icon: Layout,
      children: [
        { id: 'v-tw-project', label: 'Project', shortcut: 'Alt+1', icon: FolderTree, actionId: 'view.toggleProject' },
        { id: 'v-tw-structure', label: 'Structure', shortcut: 'Alt+7', icon: Layers, actionId: 'view.toggleStructure' },
        { id: 'v-tw-commit', label: 'Commit', shortcut: 'Alt+0', icon: GitCommit, actionId: 'view.toggleCommit' },
        { id: 'v-tw-run', label: 'Run', shortcut: 'Alt+4', icon: PlaySquare, actionId: 'view.toggleRun' },
        { id: 'v-tw-terminal', label: 'Terminal', shortcut: 'Alt+F12', icon: Terminal, actionId: 'view.toggleTerminal' },
        { id: 'v-tw-git', label: 'Git', shortcut: 'Alt+9', icon: GitBranch, actionId: 'view.toggleGit' },
        { id: 'v-tw-problems', label: 'Problems', icon: AlertCircle, actionId: 'view.toggleProblems' },
        { id: 'v-tw-find', label: 'Find Usages', shortcut: 'Alt+F7', icon: Search, actionId: 'view.toggleFind' },
        { id: 'v-tw-database', label: 'Database', icon: Database, actionId: 'view.toggleDatabase' },
        { id: 'v-tw-build', label: 'Build Tools', icon: Package, actionId: 'view.toggleBuildTools' },
      ]
    },
    { 
      id: 'v-appearance', 
      label: 'Appearance',
      icon: Eye,
      children: [
        { id: 'v-app-statusbar', label: 'Status Bar', actionId: 'view.toggleStatusBar', checked: true },
        { id: 'v-app-breadcrumbs', label: 'Navigation Bar / Breadcrumbs', actionId: 'view.toggleBreadcrumbs', checked: true },
        { id: 'v-app-lineno', label: 'Line Numbers', actionId: 'view.toggleLineNumbers', checked: true },
        { id: 'v-app-minimap', label: 'Minimap', actionId: 'view.toggleMinimap', checked: true },
        { id: 'v-app-wordwrap', label: 'Soft-Wrap Lines', actionId: 'view.toggleWordWrap' },
        { id: 'v-app-annotate', label: 'Annotate with Git Blame', shortcut: 'Alt+Shift+B', icon: History, actionId: 'git.annotate' },
        { id: 'v-app-sep-1', isSeparator: true },
        { id: 'v-app-fullscreen', label: 'Enter Full Screen', shortcut: 'F11', icon: Maximize, actionId: 'view.toggleFullScreen' },
      ]
    },
    { id: 'v-sep-1', isSeparator: true },
    { id: 'v-recent-files', label: 'Recent Files...', shortcut: 'Ctrl+E', icon: Clock, actionId: 'view.recentFiles' },
    { id: 'v-recent-locations', label: 'Recent Locations...', shortcut: 'Ctrl+Shift+E', actionId: 'view.recentLocations' },
    { id: 'v-compare', label: 'Compare with HEAD / Diff', shortcut: 'Ctrl+Alt+D', icon: Columns, actionId: 'git.compareWithHead' },
    { id: 'v-sep-2', isSeparator: true },
    { id: 'v-zoom-in', label: 'Zoom In', shortcut: 'Ctrl+=', icon: ZoomIn, actionId: 'view.zoomIn' },
    { id: 'v-zoom-out', label: 'Zoom Out', shortcut: 'Ctrl+-', icon: ZoomOut, actionId: 'view.zoomOut' },
    { id: 'v-zoom-reset', label: 'Reset Zoom', shortcut: 'Ctrl+0', actionId: 'view.resetZoom' },
  ],

  Navigate: [
    { id: 'n-search-everywhere', label: 'Search Everywhere', shortcut: 'Double Shift', icon: Sparkles, actionId: 'navigate.searchEverywhere' },
    { id: 'n-go-file', label: 'File...', shortcut: 'Ctrl+Shift+N', icon: FileCode, actionId: 'navigate.goToFile' },
    { id: 'n-go-class', label: 'Class...', shortcut: 'Ctrl+N', actionId: 'navigate.goToFile' },
    { id: 'n-go-symbol', label: 'Symbol...', shortcut: 'Ctrl+Alt+Shift+N', actionId: 'navigate.goToSymbol' },
    { id: 'n-go-action', label: 'Action...', shortcut: 'Ctrl+Shift+A', actionId: 'navigate.goToAction' },
    { id: 'n-go-line', label: 'Line:Column...', shortcut: 'Ctrl+G', actionId: 'navigate.goToLine' },
    { id: 'n-sep-1', isSeparator: true },
    { id: 'n-decl', label: 'Declaration or Usages', shortcut: 'Ctrl+B', actionId: 'navigate.gotoDeclaration' },
    { id: 'n-impl', label: 'Implementation(s)', shortcut: 'Ctrl+Alt+B', actionId: 'navigate.gotoImplementation' },
    { id: 'n-find-usages', label: 'Find Usages', shortcut: 'Alt+F7', icon: Search, actionId: 'navigate.findUsages' },
    { id: 'n-show-usages', label: 'Show Usages', shortcut: 'Ctrl+Alt+F7', actionId: 'navigate.showUsages' },
    { id: 'n-sep-2', isSeparator: true },
    { id: 'n-back', label: 'Back', shortcut: 'Ctrl+Alt+Left', icon: ArrowLeft, actionId: 'navigate.back' },
    { id: 'n-forward', label: 'Forward', shortcut: 'Ctrl+Alt+Right', icon: ArrowRight, actionId: 'navigate.forward' },
    { id: 'n-next-tab', label: 'Next Tab', shortcut: 'Alt+Right', actionId: 'navigate.nextTab' },
    { id: 'n-prev-tab', label: 'Previous Tab', shortcut: 'Alt+Left', actionId: 'navigate.prevTab' },
    { id: 'n-sep-3', isSeparator: true },
    {
      id: 'n-select-in',
      label: 'Select in...',
      icon: ExternalLink,
      children: [
        { id: 'n-sel-proj', label: 'Project View', shortcut: 'Alt+F1, 1', actionId: 'navigate.selectInProject' },
        { id: 'n-sel-exp', label: 'File Explorer / Finder', actionId: 'navigate.selectInExplorer' },
        { id: 'n-sel-term', label: 'Terminal', actionId: 'navigate.selectInTerminal' },
      ]
    }
  ],

  Code: [
    { id: 'c-format', label: 'Reformat Code', shortcut: 'Ctrl+Alt+L', icon: AlignLeft, actionId: 'code.format' },
    { id: 'c-optimize', label: 'Optimize Imports', shortcut: 'Ctrl+Alt+O', actionId: 'code.optimizeImports' },
    { id: 'c-sep-1', isSeparator: true },
    { 
      id: 'c-generate', 
      label: 'Generate...', 
      shortcut: 'Alt+Insert',
      icon: Plus,
      children: [
        { id: 'c-gen-const', label: 'Constructor', actionId: 'code.genConstructor' },
        { id: 'c-gen-getset', label: 'Getters and Setters', actionId: 'code.genGetterSetter' },
        { id: 'c-gen-tostr', label: 'toString() Method', actionId: 'code.genToString' },
        { id: 'c-gen-over', label: 'Override Methods...', shortcut: 'Ctrl+O', actionId: 'code.genOverride' },
      ]
    },
    { id: 'c-comment-line', label: 'Comment with Line Comment', shortcut: 'Ctrl+/', actionId: 'code.commentLine' },
    { id: 'c-comment-block', label: 'Comment with Block Comment', shortcut: 'Ctrl+Shift+/', actionId: 'code.commentBlock' },
    { id: 'c-sep-2', isSeparator: true },
    { 
      id: 'c-surround', 
      label: 'Surround With...', 
      shortcut: 'Ctrl+Alt+T',
      actionId: 'code.surround',
      icon: Layers,
      children: [
        { id: 'c-surr-if', label: 'if / else Block', actionId: 'code.surroundIf' },
        { id: 'c-surr-try', label: 'try / catch Block', actionId: 'code.surroundTry' },
        { id: 'c-surr-for', label: 'for Loop', actionId: 'code.surroundFor' },
      ]
    },
    { id: 'c-inspect', label: 'Inspect Code...', icon: CheckSquare, actionId: 'code.inspect' },
    { id: 'c-sep-3', isSeparator: true },
    { 
      id: 'c-folding', 
      label: 'Folding',
      icon: FoldHorizontal,
      children: [
        { id: 'c-fold-all', label: 'Collapse All', shortcut: 'Ctrl+Shift+-', actionId: 'code.foldAll' },
        { id: 'c-unfold-all', label: 'Expand All', shortcut: 'Ctrl+Shift++', actionId: 'code.unfoldAll' },
      ]
    },
  ],

  Refactor: [
    { id: 'r-rename', label: 'Rename...', shortcut: 'Shift+F6', icon: Edit3, actionId: 'refactor.rename' },
    { id: 'r-sig', label: 'Change Signature...', shortcut: 'Ctrl+F6', actionId: 'refactor.changeSignature' },
    { id: 'r-sep-1', isSeparator: true },
    { 
      id: 'r-extract', 
      label: 'Extract / Introduce', 
      icon: Sliders,
      children: [
        { id: 'r-ext-var', label: 'Variable...', shortcut: 'Ctrl+Alt+V', actionId: 'refactor.extractVariable' },
        { id: 'r-ext-const', label: 'Constant...', shortcut: 'Ctrl+Alt+C', actionId: 'refactor.extractConstant' },
        { id: 'r-ext-field', label: 'Field...', shortcut: 'Ctrl+Alt+F', actionId: 'refactor.extractField' },
        { id: 'r-ext-fn', label: 'Method / Function...', shortcut: 'Ctrl+Alt+M', actionId: 'refactor.extractMethod' },
      ]
    },
    { id: 'r-inline', label: 'Inline...', shortcut: 'Ctrl+Alt+N', actionId: 'refactor.inline' },
    { id: 'r-sep-2', isSeparator: true },
    { id: 'r-move', label: 'Move File...', shortcut: 'F6', icon: FolderOpen, actionId: 'refactor.moveFile' },
    { id: 'r-copy', label: 'Copy File...', shortcut: 'F5', icon: Copy, actionId: 'refactor.copyFile' },
    { id: 'r-safe-del', label: 'Safe Delete...', shortcut: 'Alt+Delete', icon: Trash2, actionId: 'refactor.safeDelete' },
  ],

  Build: [
    { id: 'b-build', label: 'Build Project', shortcut: 'Ctrl+F9', icon: Hammer, actionId: 'build.build' },
    { id: 'b-rebuild', label: 'Rebuild Project', icon: RefreshCw, actionId: 'build.rebuild' },
    { id: 'b-clean', label: 'Clean Project Cache', icon: Trash2, actionId: 'build.clean' },
    { id: 'b-sep-1', isSeparator: true },
    { id: 'b-mod', label: 'Build Module \'Main\'', actionId: 'build.buildModule' },
    { id: 'b-artifacts', label: 'Generate Artifacts / Dist...', icon: Package, actionId: 'build.artifacts' },
  ],

  Run: [
    { id: 'rn-run', label: 'Run \'Desktop IDE\'', shortcut: 'Shift+F10', icon: Play, actionId: 'run.run' },
    { id: 'rn-debug', label: 'Debug \'Desktop IDE\'', shortcut: 'Shift+F9', icon: Bug, actionId: 'run.debug' },
    { id: 'rn-run-tests', label: 'Run All Tests', shortcut: 'Ctrl+Shift+F10', icon: CheckCircle2, actionId: 'run.tests' },
    { id: 'rn-coverage', label: 'Run with Coverage', icon: Shield, actionId: 'run.coverage' },
    { id: 'rn-stop', label: 'Stop', shortcut: 'Ctrl+F2', icon: Square, actionId: 'run.stop' },
    { id: 'rn-sep-1', isSeparator: true },
    { id: 'rn-edit-cfg', label: 'Edit Configurations...', shortcut: 'Alt+Shift+F10', icon: Sliders, actionId: 'run.editConfig' },
    { id: 'rn-sep-2', isSeparator: true },
    { 
      id: 'rn-debug-actions', 
      label: 'Debugging Actions', 
      icon: Bug,
      children: [
        { id: 'rn-step-over', label: 'Step Over', shortcut: 'F8', actionId: 'run.stepOver' },
        { id: 'rn-step-into', label: 'Step Into', shortcut: 'F7', actionId: 'run.stepInto' },
        { id: 'rn-step-out', label: 'Step Out', shortcut: 'Shift+F8', actionId: 'run.stepOut' },
        { id: 'rn-resume', label: 'Resume Program', shortcut: 'F9', actionId: 'run.resume' },
      ]
    },
    { id: 'rn-toggle-bp', label: 'Toggle Line Breakpoint', shortcut: 'Ctrl+F8', actionId: 'run.toggleBreakpoint' },
    { id: 'rn-view-bp', label: 'View Breakpoints...', shortcut: 'Ctrl+Shift+F8', actionId: 'run.viewBreakpoints' },
    { id: 'rn-evaluate-expr', label: 'Evaluate Expression...', shortcut: 'Alt+F8', icon: Calculator, actionId: 'run.evaluateExpression' },
  ],

  Tools: [
    { id: 't-terminal', label: 'Open Terminal', shortcut: 'Alt+F12', icon: Terminal, actionId: 'tools.terminal' },
    { id: 't-theme-studio', label: 'Theme Studio...', icon: Palette, actionId: 'tools.themeStudio' },
    { 
      id: 't-http', 
      label: 'HTTP Client', 
      icon: Globe,
      children: [
        { id: 't-http-new', label: 'Create Request in Scratch Buffer', actionId: 'tools.httpScratch' },
      ]
    },
    { 
      id: 't-tasks', 
      label: 'Tasks & Contexts', 
      icon: CheckSquare,
      children: [
        { id: 't-task-open', label: 'Open Task...', actionId: 'tools.openTask' },
        { id: 't-task-close', label: 'Close Active Task', actionId: 'tools.closeTask' },
      ]
    },
    { id: 't-sep-1', isSeparator: true },
    { 
      id: 't-json', 
      label: 'XML / JSON Actions', 
      icon: FileCode,
      children: [
        { id: 't-json-fmt', label: 'Format JSON Buffer', actionId: 'tools.formatJson' },
        { id: 't-json-val', label: 'Validate Syntax', actionId: 'tools.validateJson' },
      ]
    },
    { id: 't-toolchains', label: 'Build Toolchains & SDKs...', icon: Hammer, actionId: 'tools.toolchains' },
    { id: 't-plugins', label: 'Plugins Marketplace...', icon: Layout, actionId: 'tools.plugins' },
  ],

  Git: [
    { id: 'g-commit', label: 'Commit Changes...', shortcut: 'Ctrl+K', icon: GitCommit, actionId: 'git.commit' },
    { id: 'g-push', label: 'Push...', shortcut: 'Ctrl+Shift+K', icon: ArrowUpFromLine, actionId: 'git.push' },
    { id: 'g-pull', label: 'Update Project / Pull', shortcut: 'Ctrl+T', icon: ArrowDownToLine, actionId: 'git.pull' },
    { id: 'g-fetch', label: 'Fetch', actionId: 'git.fetch' },
    { id: 'g-sep-1', isSeparator: true },
    { id: 'g-log', label: 'Show Git Log', shortcut: 'Alt+9', icon: GitBranch, actionId: 'git.log' },
    { id: 'g-annotate', label: 'Annotate with Git Blame', shortcut: 'Alt+Shift+B', icon: History, actionId: 'git.annotate' },
    { id: 'g-branches', label: 'Branches...', icon: GitPullRequest, actionId: 'git.branches' },
    { id: 'g-compare', label: 'Compare with Branch...', actionId: 'git.compareBranch' },
    { id: 'g-sep-2', isSeparator: true },
    { id: 'g-stash', label: 'Stash Changes...', actionId: 'git.stash' },
    { id: 'g-unstash', label: 'UnStash Changes...', actionId: 'git.unstash' },
  ],

  Window: [
    { id: 'w-min', label: 'Minimize', shortcut: 'Ctrl+M', icon: Minus, actionId: 'window.minimize' },
    { id: 'w-zoom', label: 'Zoom', icon: Maximize, actionId: 'window.zoom' },
    { id: 'w-close', label: 'Close Window', shortcut: 'Ctrl+F4', icon: X, actionId: 'window.close' },
    { id: 'w-sep-1', isSeparator: true },
    { id: 'w-next', label: 'Next Project Window', shortcut: 'Ctrl+Alt+]', actionId: 'window.nextProject' },
    { id: 'w-prev', label: 'Previous Project Window', shortcut: 'Ctrl+Alt+[', actionId: 'window.prevProject' },
    { id: 'w-sep-2', isSeparator: true },
    { 
      id: 'w-tabs', 
      label: 'Editor Tabs', 
      icon: Layers,
      children: [
        { id: 'w-tab-close', label: 'Close', shortcut: 'Ctrl+F4', actionId: 'file.close' },
        { id: 'w-tab-close-all', label: 'Close All Tabs', shortcut: 'Ctrl+Shift+F4', actionId: 'file.closeAll' },
        { id: 'w-tab-split-v', label: 'Split Right', actionId: 'editor.splitRight' },
        { id: 'w-tab-split-h', label: 'Split Down', actionId: 'editor.splitDown' },
      ]
    },
    { 
      id: 'w-layouts', 
      label: 'Layouts', 
      icon: Layout,
      children: [
        { id: 'w-layout-default', label: 'Default', actionId: 'window.layoutDefault' },
        { id: 'w-layout-save', label: 'Save Current Layout as New...', actionId: 'window.layoutSave' },
      ]
    },
  ],

  Help: [
    { id: 'h-action', label: 'Find Action...', shortcut: 'Ctrl+Shift+A', icon: Search, actionId: 'help.findAction' },
    { id: 'h-tip', label: 'Tip of the Day', icon: Sparkles, actionId: 'help.tip' },
    { id: 'h-keymap', label: 'Keymap Reference (Cheatsheet)', icon: FileText, actionId: 'help.keymap' },
    { id: 'h-sep-1', isSeparator: true },
    { id: 'h-updates', label: 'Check for Updates...', icon: RefreshCw, actionId: 'help.checkUpdates' },
    { id: 'h-about', label: 'About IntelliJ IDEA Clone', icon: Info, actionId: 'help.about' },
  ],
};
