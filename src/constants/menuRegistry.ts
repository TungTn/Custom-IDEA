import { 
  FilePlus, 
  FolderPlus, 
  FolderOpen, 
  Save, 
  X, 
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
  Zap
} from 'lucide-react';
import { MenuRegistry } from '../types/menu';

export const menuRegistry: MenuRegistry = {
  File: [
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
        { id: 'f-new-scratch', label: 'Scratch File', shortcut: 'Ctrl+Alt+Shift+Insert', icon: FileCode, actionId: 'file.newScratch' },
        { id: 'f-new-file', label: 'File', shortcut: 'Ctrl+N', icon: FilePlus, actionId: 'file.new' },
        { id: 'f-new-dir', label: 'Directory', icon: FolderPlus, actionId: 'file.newFolder' },
        { id: 'f-new-package', label: 'Package', icon: Package, actionId: 'file.newPackage' },
        { id: 'f-new-sep-2', isSeparator: true },
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
      children: [
        { id: 'f-rec-1', label: 'intellij-idea-clone (D:\\IDE)', actionId: 'file.openRecent.ide' },
        { id: 'f-rec-2', label: 'frontend-web (D:\\Projects\\Web)', actionId: 'file.openRecent.web' },
        { id: 'f-rec-3', label: 'backend-api (D:\\Projects\\Api)', actionId: 'file.openRecent.api' },
        { id: 'f-rec-sep', isSeparator: true },
        { id: 'f-rec-manage', label: 'Manage Projects...', actionId: 'file.manageProjects' },
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
            { id: 'f-enc-utf8', label: 'UTF-8', actionId: 'file.encoding.utf8', checked: true },
            { id: 'f-enc-ascii', label: 'US-ASCII', actionId: 'file.encoding.ascii' },
            { id: 'f-enc-iso', label: 'ISO-8859-1', actionId: 'file.encoding.iso' },
          ]
        },
        { 
          id: 'f-props-crlf', 
          label: 'Line Separators', 
          children: [
            { id: 'f-line-crlf', label: 'CRLF - Windows (\\r\\n)', actionId: 'file.line.crlf' },
            { id: 'f-line-lf', label: 'LF - Unix and macOS (\\n)', actionId: 'file.line.lf' },
          ]
        },
        { id: 'f-props-readonly', label: 'Make File Read-Only', actionId: 'file.toggleReadOnly' },
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
    { id: 'f-power-save', label: 'Power Save Mode', icon: Zap, actionId: 'file.togglePowerSave' },
    { id: 'f-sep-6', isSeparator: true },
    { id: 'f-exit', label: 'Exit', shortcut: 'Alt+F4', actionId: 'app.exit' },
  ],

  Edit: [
    { id: 'e-undo', label: 'Undo', shortcut: 'Ctrl+Z', icon: RotateCcw, actionId: 'edit.undo' },
    { id: 'e-redo', label: 'Redo', shortcut: 'Ctrl+Y', actionId: 'edit.redo' },
    { id: 'e-sep-1', isSeparator: true },
    { id: 'e-cut', label: 'Cut', shortcut: 'Ctrl+X', icon: Scissors, actionId: 'edit.cut' },
    { id: 'e-copy', label: 'Copy', shortcut: 'Ctrl+C', icon: Copy, actionId: 'edit.copy' },
    { id: 'e-paste', label: 'Paste', shortcut: 'Ctrl+V', icon: Clipboard, actionId: 'edit.paste' },
    { id: 'e-dup', label: 'Duplicate Line or Selection', shortcut: 'Ctrl+D', actionId: 'edit.duplicateLine' },
    { id: 'e-sep-2', isSeparator: true },
    { id: 'e-find', label: 'Find in Editor...', shortcut: 'Ctrl+F', icon: Search, actionId: 'edit.find' },
    { id: 'e-replace', label: 'Replace in Editor...', shortcut: 'Ctrl+R', icon: Replace, actionId: 'edit.replace' },
    { id: 'e-find-files', label: 'Find in Files...', shortcut: 'Ctrl+Shift+F', actionId: 'edit.findInFiles' },
  ],

  View: [
    { 
      id: 'v-tool-windows', 
      label: 'Tool Windows',
      children: [
        { id: 'v-tw-project', label: 'Project', shortcut: 'Alt+1', icon: FolderTree, actionId: 'view.toggleProject' },
        { id: 'v-tw-run', label: 'Run', shortcut: 'Alt+4', icon: PlaySquare, actionId: 'view.toggleRun' },
        { id: 'v-tw-terminal', label: 'Terminal', shortcut: 'Alt+F12', icon: Terminal, actionId: 'view.toggleTerminal' },
        { id: 'v-tw-problems', label: 'Problems', actionId: 'view.toggleProblems' },
      ]
    },
    { id: 'v-sep-1', isSeparator: true },
    { id: 'v-toggle-sidebar', label: 'Toggle Left Sidebar', actionId: 'view.toggleLeftSidebar' },
    { id: 'v-toggle-bottom', label: 'Toggle Bottom Panel', actionId: 'view.toggleBottomPanel' },
    { id: 'v-sep-2', isSeparator: true },
    { id: 'v-zoom-in', label: 'Zoom In', shortcut: 'Ctrl+=', actionId: 'view.zoomIn' },
    { id: 'v-zoom-out', label: 'Zoom Out', shortcut: 'Ctrl+-', actionId: 'view.zoomOut' },
    { id: 'v-zoom-reset', label: 'Reset Zoom', shortcut: 'Ctrl+0', actionId: 'view.resetZoom' },
  ],

  Navigate: [
    { id: 'n-search-everywhere', label: 'Search Everywhere', shortcut: 'Double Shift', icon: Sparkles, actionId: 'navigate.searchEverywhere' },
    { id: 'n-go-file', label: 'Go to File...', shortcut: 'Ctrl+Shift+N', actionId: 'navigate.goToFile' },
    { id: 'n-go-line', label: 'Go to Line / Column...', shortcut: 'Ctrl+G', actionId: 'navigate.goToLine' },
    { id: 'n-sep-1', isSeparator: true },
    { id: 'n-next-tab', label: 'Next Tab', shortcut: 'Alt+Right', actionId: 'navigate.nextTab' },
    { id: 'n-prev-tab', label: 'Previous Tab', shortcut: 'Alt+Left', actionId: 'navigate.prevTab' },
  ],

  Code: [
    { id: 'c-format', label: 'Reformat Code', shortcut: 'Ctrl+Alt+L', icon: AlignLeft, actionId: 'code.format' },
    { id: 'c-comment-line', label: 'Comment with Line Comment', shortcut: 'Ctrl+/', actionId: 'code.commentLine' },
    { id: 'c-inspect', label: 'Inspect Code...', icon: CheckSquare, actionId: 'code.inspect' },
    { id: 'c-optimize', label: 'Optimize Imports', shortcut: 'Ctrl+Alt+O', actionId: 'code.optimizeImports' },
    { id: 'c-sep-1', isSeparator: true },
    { id: 'c-fold-all', label: 'Fold All', icon: FoldHorizontal, actionId: 'code.foldAll' },
    { id: 'c-unfold-all', label: 'Unfold All', icon: UnfoldHorizontal, actionId: 'code.unfoldAll' },
  ],

  Refactor: [
    { id: 'r-rename', label: 'Rename...', shortcut: 'Shift+F6', icon: Edit3, actionId: 'refactor.rename' },
    { id: 'r-extract-fn', label: 'Extract Method...', shortcut: 'Ctrl+Alt+M', actionId: 'refactor.extractMethod' },
    { id: 'r-extract-var', label: 'Extract Variable...', shortcut: 'Ctrl+Alt+V', actionId: 'refactor.extractVariable' },
  ],

  Build: [
    { id: 'b-build', label: 'Build Project', shortcut: 'Ctrl+F9', icon: Hammer, actionId: 'build.build' },
    { id: 'b-rebuild', label: 'Rebuild Project', icon: RefreshCw, actionId: 'build.rebuild' },
    { id: 'b-clean', label: 'Clean Project Cache', actionId: 'build.clean' },
  ],

  Run: [
    { id: 'rn-run', label: 'Run \'Desktop IDE\'', shortcut: 'Shift+F10', icon: Play, actionId: 'run.run' },
    { id: 'rn-debug', label: 'Debug \'Desktop IDE\'', shortcut: 'Shift+F9', icon: Bug, actionId: 'run.debug' },
    { id: 'rn-stop', label: 'Stop', shortcut: 'Ctrl+F2', icon: Square, actionId: 'run.stop' },
    { id: 'rn-sep-1', isSeparator: true },
    { id: 'rn-edit-cfg', label: 'Edit Configurations...', icon: Sliders, actionId: 'run.editConfig' },
  ],

  Tools: [
    { id: 't-terminal', label: 'Open Terminal', shortcut: 'Alt+F12', icon: Terminal, actionId: 'tools.terminal' },
    { id: 't-tasks', label: 'Tasks & Contexts', actionId: 'tools.tasks' },
    { id: 't-plugins', label: 'Plugins Marketplace...', icon: Layout, actionId: 'tools.plugins' },
  ],

  Git: [
    { id: 'g-commit', label: 'Commit Changes...', shortcut: 'Ctrl+K', icon: GitCommit, actionId: 'git.commit' },
    { id: 'g-branches', label: 'Branches...', icon: GitPullRequest, actionId: 'git.branches' },
    { id: 'g-push', label: 'Push...', shortcut: 'Ctrl+Shift+K', actionId: 'git.push' },
    { id: 'g-pull', label: 'Pull / Update Project', shortcut: 'Ctrl+T', actionId: 'git.pull' },
    { id: 'g-log', label: 'Show Git Log', actionId: 'git.log' },
  ],

  Help: [
    { id: 'h-tip', label: 'Tip of the Day', icon: Sparkles, actionId: 'help.tip' },
    { id: 'h-keymap', label: 'Keymap Reference', actionId: 'help.keymap' },
    { id: 'h-sep-1', isSeparator: true },
    { id: 'h-updates', label: 'Check for Updates...', actionId: 'help.checkUpdates' },
    { id: 'h-about', label: 'About IntelliJ IDEA Clone', icon: Info, actionId: 'help.about' },
  ],
};
