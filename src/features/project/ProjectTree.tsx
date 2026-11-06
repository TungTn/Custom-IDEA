import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  FileCode, 
  FileJson, 
  FileText, 
  MoreVertical,
  Minus,
  File,
  Crosshair,
  FoldHorizontal,
  UnfoldHorizontal,
  Settings,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  Scissors,
  Clipboard,
  Search,
  Bookmark,
  Sparkles,
  Split,
  History,
  GitBranch,
  RotateCw,
  Wrench,
  Layers,
  FileSpreadsheet,
  Globe,
  Share2,
  FolderPlus,
  FilePlus,
  Edit3
} from 'lucide-react';
import { SonarIcon } from '../sonar/SonarToolWindow';
import { FileNode } from '../../types';

export interface ProjectTreeProps {
  files: FileNode[];
  activeFileId: string | null;
  onFileSelect: (file: FileNode) => void;
  onNewFile?: (parentPath?: string, fileName?: string, content?: string) => void;
  onNewFolder?: (parentPath?: string, folderName?: string) => void;
  onDeleteFile?: (file: FileNode) => void;
  onRenameFile?: (file: FileNode, newName?: string) => void;
  onOpenSplit?: (file: FileNode) => void;
  onLocalHistory?: (file: FileNode) => void;
  onGitCommit?: (file: FileNode) => void;
  onGitBlame?: (file: FileNode) => void;
  onReformatCode?: (file: FileNode) => void;
  onOptimizeImports?: (file: FileNode) => void;
  onRepairIde?: () => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onFindUsages?: (symbol: string) => void;
  onCompareWith?: (file: FileNode) => void;
  onOpenTerminal?: (path?: string) => void;
  onReloadFromDisk?: (file: FileNode) => void;
  onSelectMenuAction?: (actionId: string) => void;
  projectRootPath?: string;
  onPasteFile?: (sourceNode: FileNode, targetParentPath: string, op: 'cut' | 'copy') => void;
  onCopyFileRefactor?: (sourceNode: FileNode, newName: string, targetDir: string) => void;
  onMoveFileRefactor?: (sourceNode: FileNode, targetDir: string) => void;
  bookmarks?: string[];
  onToggleBookmark?: (filePath: string, mnemonic?: string) => void;
  onShowBookmarksModal?: () => void;
  onCloseFile?: (filePath: string) => void;
  onFindInFolder?: (folderPath: string, mode: 'find' | 'replace') => void;
  onAnalyzeSonarPath?: (path: string, isFolder: boolean) => void;
  onExcludeSonarPath?: (path: string) => void;
}

export const IntelliJExpandAllIcon: React.FC<{ size?: number; className?: string }> = ({ size = 13, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M2.5 8H13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M5 5.5L8 2.5L11 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 10.5L8 13.5L11 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const IntelliJCollapseAllIcon: React.FC<{ size?: number; className?: string }> = ({ size = 13, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M2.5 8H13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M5 4.5L8 7.5L11 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 11.5L8 8.5L11 11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const ProjectTree: React.FC<ProjectTreeProps> = ({
  files,
  activeFileId,
  onFileSelect,
  onNewFile,
  onNewFolder,
  onDeleteFile,
  onRenameFile,
  onOpenSplit,
  onLocalHistory,
  onGitCommit,
  onGitBlame,
  onReformatCode,
  onOptimizeImports,
  onRepairIde,
  onShowToast,
  onFindUsages,
  onCompareWith,
  onOpenTerminal,
  onReloadFromDisk,
  onSelectMenuAction,
  projectRootPath,
  onPasteFile,
  onCopyFileRefactor,
  onMoveFileRefactor,
  bookmarks = [],
  onToggleBookmark,
  onShowBookmarksModal,
  onCloseFile,
  onFindInFolder,
  onAnalyzeSonarPath,
  onExcludeSonarPath,
}) => {
  // IDE File Clipboard State
  const [clipboardItem, setClipboardItem] = useState<{ node: FileNode; op: 'cut' | 'copy'; timestamp: number } | null>(null);
  const [clipboardHistory, setClipboardHistory] = useState<Array<{ node: FileNode; op: 'cut' | 'copy'; timestamp: number }>>([]);
  const [isPasteHistoryOpen, setIsPasteHistoryOpen] = useState(false);

  // Refactor Modals State
  const [copyModalData, setCopyModalData] = useState<{ isOpen: boolean; node: FileNode | null; newName: string; destFolder: string }>({
    isOpen: false,
    node: null,
    newName: '',
    destFolder: '',
  });
  const [moveModalData, setMoveModalData] = useState<{ isOpen: boolean; node: FileNode | null; destFolder: string }>({
    isOpen: false,
    node: null,
    destFolder: '',
  });
  const [deleteModalData, setDeleteModalData] = useState<{
    isOpen: boolean;
    node: FileNode | null;
    safeDelete: boolean;
    searchComments: boolean;
  }>({
    isOpen: false,
    node: null,
    safeDelete: true,
    searchComments: true,
  });
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'root': true,
    'src': true,
    'src-tauri': true,
    'src-tauri-src': true,
  });

  const [scopeView, setScopeView] = useState<'Project' | 'Open Files' | 'Scratches'>('Project');
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [compactPackages, setCompactPackages] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ij_project_tree_compact_packages');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleCompactPackages = (nextVal?: boolean) => {
    const next = nextVal !== undefined ? nextVal : !compactPackages;
    setCompactPackages(next);
    try {
      localStorage.setItem('ij_project_tree_compact_packages', String(next));
    } catch {}
    onShowToast?.(
      'Project View',
      next ? 'Compact Middle Packages enabled' : 'Compact Middle Packages disabled',
      'info'
    );
  };
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    try {
      return (localStorage.getItem('ij_project_tree_sort_order') as 'asc' | 'desc') || 'asc';
    } catch {
      return 'asc';
    }
  });
  const [foldersFirst, setFoldersFirst] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ij_project_tree_folders_first');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleSortOrder = () => {
    const next = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(next);
    try {
      localStorage.setItem('ij_project_tree_sort_order', next);
    } catch {}
    onShowToast?.('Project Tree Sorting', `Sorted ${next === 'asc' ? 'Alphabetically (A-Z)' : 'Reverse Alphabetically (Z-A)'}`, 'info');
  };

  const toggleFoldersFirst = () => {
    const next = !foldersFirst;
    setFoldersFirst(next);
    try {
      localStorage.setItem('ij_project_tree_folders_first', String(next));
    } catch {}
    onShowToast?.('Project Tree Sorting', next ? 'Folders on top enabled' : 'Folders on top disabled', 'info');
  };

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode;
  } | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // IntelliJ New File / Directory Dialog State
  const [newFileDialogData, setNewFileDialogData] = useState<{
    isOpen: boolean;
    parentPath: string;
    fileType: string;
    title: string;
    name: string;
    defaultExt: string;
    isFolder: boolean;
  }>({
    isOpen: false,
    parentPath: '',
    fileType: 'file',
    title: 'New File',
    name: '',
    defaultExt: '',
    isFolder: false,
  });

  // IntelliJ Rename Modal State (Shift+F6)
  const [renameModalData, setRenameModalData] = useState<{
    isOpen: boolean;
    node: FileNode | null;
    newName: string;
  }>({
    isOpen: false,
    node: null,
    newName: '',
  });

  const getParentPath = (node: FileNode) => {
    if (node.isFolder) return node.path;
    return node.path.includes('/') || node.path.includes('\\')
      ? node.path.replace(/[\\/][^\\/]+$/, '')
      : '';
  };

  // Close context menu on any outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleOutsideDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setActiveSubmenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setActiveSubmenu(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // Adjust menu position dynamically after DOM render to ensure it NEVER overflows window
  useLayoutEffect(() => {
    if (contextMenu && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newY = menuPos.y;
      let newX = menuPos.x;

      // Bottom overflow: shift UP so bottom is cleanly within view
      if (rect.bottom > window.innerHeight - 12) {
        const overflow = rect.bottom - (window.innerHeight - 12);
        newY = Math.max(8, newY - overflow);
      }
      // Top overflow: if shifted too far up, clamp at top
      if (newY < 8) {
        newY = 8;
      }
      // Right overflow
      if (rect.right > window.innerWidth - 12) {
        const overflowX = rect.right - (window.innerWidth - 12);
        newX = Math.max(8, newX - overflowX);
      }

      if (newY !== menuPos.y || newX !== menuPos.x) {
        setMenuPos({ x: newX, y: newY });
      }
    }
  }, [contextMenu, menuPos]);

  const toggleFolder = (
    id: string,
    isCurrentlyExpanded: boolean,
    e: React.MouseEvent,
    compactedIds?: string[]
  ) => {
    e.stopPropagation();
    const nextVal = !isCurrentlyExpanded;
    setExpandedFolders((prev) => {
      const updated = {
        ...prev,
        [id]: nextVal,
      };
      if (compactedIds && compactedIds.length > 0) {
        for (const cid of compactedIds) {
          updated[cid] = nextVal;
        }
      }
      return updated;
    });
  };

  const handleCollapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    const collect = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.isFolder) {
          allCollapsed[node.id] = false;
          if (node.children) collect(node.children);
        }
      }
    };
    collect(files);
    setExpandedFolders(allCollapsed);
    onShowToast?.('Project View', 'All folders collapsed', 'info');
  };

  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    const collect = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.isFolder) {
          allExpanded[node.id] = true;
          if (node.children) collect(node.children);
        }
      }
    };
    collect(files);
    setExpandedFolders(allExpanded);
    onShowToast?.('Project View', 'All folders expanded', 'info');
  };

  const handleLocateFile = () => {
    if (!activeFileId) return;
    setExpandedFolders(prev => ({
      ...prev,
      'root': true,
      'src': true,
      'src-tauri': true,
      'src-tauri-src': true,
    }));
    onShowToast?.('Locate in Project', 'Navigated to active editor file', 'info');
  };

  const getFileIcon = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower === '.gitignore') {
      return <GitBranch size={13} className="text-[#F05032] flex-shrink-0" />;
    }
    if (lower.endsWith('.rs')) {
      return (
        <span className="w-4 h-4 rounded bg-[#CE422B]/20 border border-[#CE422B]/50 text-[#EDA200] font-bold text-[8.5px] flex items-center justify-center flex-shrink-0">
          RS
        </span>
      );
    }
    if (lower.endsWith('.tsx') || lower.endsWith('.ts')) {
      return (
        <span className="w-4 h-4 rounded bg-[#3574F0]/20 border border-[#3574F0]/50 text-[#3574F0] font-bold text-[8.5px] flex items-center justify-center flex-shrink-0">
          TS
        </span>
      );
    }
    if (lower.endsWith('.vue')) {
      return (
        <span className="w-4 h-4 rounded bg-[#42B883]/20 border border-[#42B883]/50 text-[#42B883] font-bold text-[8.5px] flex items-center justify-center flex-shrink-0">
          V
        </span>
      );
    }
    if (lower.endsWith('.jsx') || lower.endsWith('.js')) {
      return (
        <span className="w-4 h-4 rounded bg-[#F7DF1E]/20 border border-[#F7DF1E]/50 text-[#F7DF1E] font-bold text-[8.5px] flex items-center justify-center flex-shrink-0">
          JS
        </span>
      );
    }
    if (lower.endsWith('.json')) {
      return <FileJson size={14} className="text-[#E5A83B] flex-shrink-0" />;
    }
    if (lower.endsWith('.toml')) {
      return (
        <span className="w-4 h-4 rounded bg-[#EDA200]/20 border border-[#EDA200]/40 text-[#EDA200] font-bold text-[8px] flex items-center justify-center flex-shrink-0">
          TOML
        </span>
      );
    }
    if (lower.endsWith('.lock')) {
      return <FileText size={13} className="text-[#868A91] flex-shrink-0" />;
    }
    if (lower.endsWith('.md') || lower.endsWith('.txt')) {
      return (
        <span className="w-4 h-4 rounded bg-[#6897BB]/20 border border-[#6897BB]/40 text-[#6897BB] font-bold text-[8.5px] flex items-center justify-center flex-shrink-0">
          MD
        </span>
      );
    }
    if (lower.endsWith('.css') || lower.endsWith('.scss')) {
      return <FileCode size={14} className="text-[#437EE3] flex-shrink-0" />;
    }
    if (lower.endsWith('.html')) {
      return <FileCode size={14} className="text-[#E06C75] flex-shrink-0" />;
    }
    return <File size={14} className="text-[#868A91] flex-shrink-0" />;
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();

    const clickX = e.clientX;
    const clickY = e.clientY;
    const estimatedHeight = 680;
    const estimatedWidth = 240;

    let posX = Math.min(clickX, window.innerWidth - estimatedWidth - 16);
    let posY = clickY;

    // If opening downwards would overflow window bottom, shift UPWARDS!
    if (clickY + estimatedHeight > window.innerHeight - 16) {
      posY = Math.max(8, window.innerHeight - estimatedHeight - 16);
    }

    setMenuPos({ x: posX, y: posY });
    setContextMenu({ x: posX, y: posY, node });
    setActiveSubmenu(null);
  };

  // Source root names that should act as compaction boundaries (never merge with parent or child)
  const SOURCE_ROOT_NAMES = useMemo(
    () =>
      new Set([
        'java',
        'kotlin',
        'scala',
        'groovy',
        'src',
        'main',
        'test',
        'resources',
        'target',
        'build',
        'dist',
        'node_modules',
        '.idea',
        '.git',
        '.github',
      ]),
    []
  );

  const compactTreeNodes = useCallback(
    (nodes: FileNode[], isRoot: boolean = true): FileNode[] => {
      const result: FileNode[] = [];

      for (const node of nodes) {
        if (!node.isFolder || !node.children) {
          result.push(node);
          continue;
        }

        // Recursively compact children
        const compactedChildren = compactTreeNodes(node.children, false);
        const isSourceRoot = SOURCE_ROOT_NAMES.has(node.name.toLowerCase());

        // A folder is compacted if:
        // 1. It is not root level of project
        // 2. It is not a source root boundary like 'java', 'src', 'main'
        // 3. It has exactly 1 child
        // 4. That single child is also a folder (no sibling files)
        if (!isRoot && !isSourceRoot && compactedChildren.length === 1 && compactedChildren[0].isFolder) {
          const child = compactedChildren[0];
          const mergedNode: FileNode & { compactedIds?: string[] } = {
            ...child,
            name: `${node.name}.${child.name}`,
            // Leaf id & path so file operations target the real deepest directory
            id: child.id,
            path: child.path,
            children: child.children,
            isFolder: true,
            compactedIds: [node.id, ...((child as any).compactedIds || [child.id])],
          };
          result.push(mergedNode);
        } else {
          result.push({
            ...node,
            children: compactedChildren,
          });
        }
      }

      return result;
    },
    [SOURCE_ROOT_NAMES]
  );

  const getFolderIcon = (nodeName: string, isExpanded: boolean) => {
    const lower = nodeName.toLowerCase();
    if (lower === 'java' || lower === 'kotlin' || lower === 'scala') {
      return isExpanded ? (
        <FolderOpen size={14} className="text-[#3574F0] fill-[#3574F0]/25 flex-shrink-0" />
      ) : (
        <Folder size={14} className="text-[#3574F0] fill-[#3574F0]/25 flex-shrink-0" />
      );
    }
    if (lower === 'resources') {
      return isExpanded ? (
        <FolderOpen size={14} className="text-[#9876AA] fill-[#9876AA]/25 flex-shrink-0" />
      ) : (
        <Folder size={14} className="text-[#9876AA] fill-[#9876AA]/25 flex-shrink-0" />
      );
    }
    if (lower === 'test') {
      return isExpanded ? (
        <FolderOpen size={14} className="text-[#59A869] fill-[#59A869]/25 flex-shrink-0" />
      ) : (
        <Folder size={14} className="text-[#59A869] fill-[#59A869]/25 flex-shrink-0" />
      );
    }
    return isExpanded ? (
      <FolderOpen size={14} className="text-[#E5A83B] fill-[#E5A83B]/25 flex-shrink-0" />
    ) : (
      <Folder size={14} className="text-[#E5A83B] fill-[#E5A83B]/25 flex-shrink-0" />
    );
  };

  const flattenedNodes = useMemo(() => {
    const list: Array<{
      node: FileNode;
      depth: number;
      isFolder: boolean;
      isExpanded: boolean;
    }> = [];

    const sortNodes = (nodes: FileNode[]): FileNode[] => {
      const copy = [...nodes];
      copy.sort((a, b) => {
        const aIsFolder = !!a.isFolder;
        const bIsFolder = !!b.isFolder;
        if (foldersFirst && aIsFolder !== bIsFolder) {
          return aIsFolder ? -1 : 1;
        }
        const cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        return sortOrder === 'asc' ? cmp : -cmp;
      });
      return copy;
    };

    const treeToRender = compactPackages ? compactTreeNodes(files, true) : files;

    const flatten = (nodes: FileNode[], depth: number) => {
      const sorted = sortNodes(nodes);
      for (const node of sorted) {
        const compactedIds = (node as any).compactedIds as string[] | undefined;
        let isExpanded: boolean;
        if (expandedFolders[node.id] !== undefined) {
          isExpanded = expandedFolders[node.id];
        } else if (compactedIds && compactedIds.some((id) => expandedFolders[id] !== undefined)) {
          const found = compactedIds.find((id) => expandedFolders[id] !== undefined);
          isExpanded = !!expandedFolders[found!];
        } else {
          isExpanded = depth <= 1;
        }

        list.push({
          node,
          depth,
          isFolder: !!node.isFolder,
          isExpanded,
        });
        if (node.isFolder && isExpanded && node.children) {
          flatten(node.children, depth + 1);
        }
      }
    };
    flatten(treeToRender, 0);
    return list;
  }, [files, expandedFolders, sortOrder, foldersFirst, compactPackages, compactTreeNodes]);

  const treeParentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: flattenedNodes.length,
    getScrollElement: () => treeParentRef.current,
    estimateSize: () => 26,
    overscan: 12,
  });

  const isBottomHalf = menuPos.y > (typeof window !== 'undefined' ? window.innerHeight / 2 : 400);

  return (
    <div 
      className="h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5] select-none border-r border-[#2B2D30] overflow-hidden"
      onClick={() => { setContextMenu(null); setIsScopeDropdownOpen(false); setIsOptionsOpen(false); }}
    >
      {/* ─── Official IntelliJ Tool Window Header (Project ▾ + Actions) ─── */}
      <div className="h-8 bg-[#1E1F22] border-b border-[#2B2D30] px-2.5 flex items-center justify-between text-xs">
        {/* Scope Dropdown */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setIsScopeDropdownOpen(!isScopeDropdownOpen); }}
            className="flex items-center gap-1 text-[12px] font-semibold text-[#DFE1E5] hover:text-white cursor-pointer"
          >
            <span>{scopeView}</span>
            <ChevronDown size={11} className="text-[#868A91]" />
          </button>

          {isScopeDropdownOpen && (
            <div className="absolute left-0 top-full mt-1 w-44 bg-[#222427] border border-[#323438] rounded shadow-2xl py-1 z-50 text-xs">
              {(['Project', 'Open Files', 'Scratches'] as const).map(sc => (
                <div
                  key={sc}
                  onClick={() => { setScopeView(sc); setIsScopeDropdownOpen(false); }}
                  className={`px-3 py-1.5 hover:bg-[#2B2D30] cursor-pointer flex items-center justify-between ${
                    scopeView === sc ? 'text-[#3574F0] font-medium' : 'text-[#DFE1E5]'
                  }`}
                >
                  <span>{sc}</span>
                  {scopeView === sc && <span>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons: Locate, Collapse All, Options, Minimize */}
        <div className="flex items-center gap-0.5 text-[#868A91]">
          <button
            onClick={handleLocateFile}
            className="p-1 hover:bg-[#2B2D30] hover:text-[#DFE1E5] rounded transition-colors cursor-pointer"
            title="Always Select Opened File"
          >
            <Crosshair size={13} />
          </button>

          <button
            onClick={handleExpandAll}
            className="p-1 hover:bg-[#2B2D30] hover:text-[#DFE1E5] rounded transition-colors cursor-pointer flex items-center justify-center"
            title="Expand All"
          >
            <IntelliJExpandAllIcon size={13} />
          </button>

          <button
            onClick={handleCollapseAll}
            className="p-1 hover:bg-[#2B2D30] hover:text-[#DFE1E5] rounded transition-colors cursor-pointer flex items-center justify-center"
            title="Collapse All"
          >
            <IntelliJCollapseAllIcon size={13} />
          </button>

          {/* View Options Gear */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setIsOptionsOpen(!isOptionsOpen); }}
              className="p-1 hover:bg-[#35373B] hover:text-[#DFE1E5] rounded transition-colors"
              title="Show Options Menu"
            >
              <Settings size={13} />
            </button>

            {isOptionsOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-[#2B2D30] border border-[#393B40] rounded shadow-2xl py-1 z-50 text-xs text-[#DFE1E5]">
                <label className="px-3 py-1.5 hover:bg-[#35373B] flex items-center justify-between cursor-pointer">
                  <span>Folders Always on Top</span>
                  <input 
                    type="checkbox" 
                    checked={foldersFirst} 
                    onChange={toggleFoldersFirst} 
                    className="accent-[#3574F0]" 
                  />
                </label>
                <div 
                  onClick={toggleSortOrder}
                  className="px-3 py-1.5 hover:bg-[#35373B] cursor-pointer flex items-center justify-between"
                >
                  <span>Sort by Name</span>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-[#3574F0]/20 text-[#85B1F8] border border-[#3574F0]/40 rounded">
                    {sortOrder === 'asc' ? 'A → Z' : 'Z → A'}
                  </span>
                </div>
                <div className="border-t border-[#393B40] my-1" />
                <label className="px-3 py-1.5 hover:bg-[#35373B] flex items-center justify-between cursor-pointer">
                  <span>Compact Middle Packages</span>
                  <input 
                    type="checkbox" 
                    checked={compactPackages} 
                    onChange={(e) => toggleCompactPackages(e.target.checked)} 
                    className="accent-[#3574F0]" 
                  />
                </label>
                <div 
                  onClick={() => onShowToast?.('Tree Settings', 'Sort by type view applied', 'info')}
                  className="px-3 py-1.5 hover:bg-[#35373B] cursor-pointer text-[#868A91] hover:text-[#DFE1E5]"
                >
                  Sort by Type
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => onShowToast?.('Tool Window', 'Project tool window docked on left', 'info')}
            className="p-1 hover:bg-[#35373B] hover:text-[#DFE1E5] rounded transition-colors"
            title="Hide"
          >
            <Minus size={13} />
          </button>
        </div>
      </div>

      {/* ─── Tree Content (Virtualized) ─── */}
      <div ref={treeParentRef} className="flex-1 overflow-y-auto py-1 font-sans">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = flattenedNodes[virtualRow.index];
            if (!item) return null;
            const { node, depth, isFolder, isExpanded } = item;
            const isActive = activeFileId === node.id;
            const isCut = clipboardItem?.op === 'cut' && clipboardItem.node.id === node.id;
            const isBookmarked = bookmarks?.includes(node.path);

            return (
              <div
                key={node.id}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {isFolder ? (
                  <div
                    className={`flex items-center gap-1.5 h-full px-2 hover:bg-[#2B2D30] cursor-pointer text-[13px] text-[#DFE1E5] select-none transition-colors group ${
                      isCut ? 'opacity-40 italic' : ''
                    }`}
                    style={{ paddingLeft: `${depth * 14 + 8}px` }}
                    onClick={(e) => toggleFolder(node.id, isExpanded, e, (node as any).compactedIds)}
                    onContextMenu={(e) => handleContextMenu(e, node)}
                  >
                    <span className="text-[#868A91] hover:text-white flex-shrink-0">
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                    {getFolderIcon(node.name, isExpanded)}
                    <span className="truncate font-normal">{node.name}</span>
                    {isBookmarked && (
                      <Bookmark size={11} className="text-[#3574F0] fill-[#3574F0] ml-auto flex-shrink-0" />
                    )}
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-1.5 h-full px-2 cursor-pointer text-[13px] select-none transition-colors ${
                      isActive 
                        ? 'bg-[#2E436E] text-white font-medium' 
                        : 'text-[#DFE1E5] hover:bg-[#2B2D30]'
                    } ${isCut ? 'opacity-40 italic' : ''}`}
                    style={{ paddingLeft: `${depth * 14 + 20}px` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileSelect(node);
                    }}
                    onMouseDown={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        e.stopPropagation();
                        onCloseFile?.(node.path);
                      }
                    }}
                    onAuxClick={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        e.stopPropagation();
                        onCloseFile?.(node.path);
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, node)}
                  >
                    {getFileIcon(node.name)}
                    <span className="truncate">{node.name}</span>
                    {isBookmarked && (
                      <Bookmark size={11} className="text-[#3574F0] fill-[#3574F0] ml-auto flex-shrink-0" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Backdrop overlay so clicking anywhere (code editor, status bar, tabs) immediately closes menu ─── */}
      {contextMenu && (
        <div 
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => { setContextMenu(null); setActiveSubmenu(null); }}
          onContextMenu={(e) => {
            setContextMenu(null);
            setActiveSubmenu(null);
          }}
        />
      )}

      {/* ─── JetBrains New UI Authentic Context Menu ─── */}
      {contextMenu && (
        <div 
          ref={menuRef}
          className="fixed bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-60 overflow-visible select-none"
          style={{ 
            top: `${menuPos.y}px`, 
            left: `${menuPos.x}px` 
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. New > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveSubmenu('new')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between transition-colors">
              <div className="flex items-center gap-2">
                <Plus size={13} className="text-[#59A869] group-hover:text-white" />
                <span>New</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {/* Submenu New */}
            {activeSubmenu === 'new' && (
              <div 
                className={`absolute ${menuPos.x + 240 + 220 > window.innerWidth ? 'right-full -mr-0.5' : 'left-full -ml-0.5'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-[60] text-[12px] text-[#DFE1E5] w-56 max-h-[80vh] overflow-y-auto`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div 
                  onClick={() => {
                    setNewFileDialogData({
                      isOpen: true,
                      parentPath: getParentPath(contextMenu.node),
                      fileType: 'file',
                      title: 'New File',
                      name: '',
                      defaultExt: '',
                      isFolder: false,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <File size={13} className="text-[#868A91]" />
                    <span>File</span>
                  </div>
                </div>
                <div 
                  onClick={() => {
                    setNewFileDialogData({
                      isOpen: true,
                      parentPath: getParentPath(contextMenu.node),
                      fileType: 'scratch',
                      title: 'New Scratch File',
                      name: 'scratch.txt',
                      defaultExt: 'txt',
                      isFolder: false,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-[#59A869]" />
                    <span>Scratch File</span>
                  </div>
                  <span className="text-[10px] text-[#868A91] group-hover:text-white">Ctrl+Alt+Shift+Insert</span>
                </div>
                <div 
                  onClick={() => {
                    setNewFileDialogData({
                      isOpen: true,
                      parentPath: getParentPath(contextMenu.node),
                      fileType: 'dir',
                      title: 'New Directory',
                      name: '',
                      defaultExt: '',
                      isFolder: true,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <Folder size={13} className="text-[#3574F0]" />
                  <span>Directory</span>
                </div>
                <div className="border-t border-[#393B40] my-1" />
                <div 
                  onClick={() => {
                    setNewFileDialogData({
                      isOpen: true,
                      parentPath: getParentPath(contextMenu.node),
                      fileType: 'kts',
                      title: 'New Kotlin Script',
                      name: '',
                      defaultExt: 'kts',
                      isFolder: false,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <span className="w-3.5 h-3.5 rounded bg-[#CE422B]/20 text-[#EDA200] font-bold text-[8px] flex items-center justify-center">KS</span>
                  <span>Kotlin Script</span>
                </div>
                <div 
                  onClick={() => {
                    setNewFileDialogData({
                      isOpen: true,
                      parentPath: getParentPath(contextMenu.node),
                      fileType: 'ipynb',
                      title: 'New Kotlin Notebook',
                      name: '',
                      defaultExt: 'ipynb',
                      isFolder: false,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <span className="w-3.5 h-3.5 rounded bg-[#3574F0]/20 text-[#3574F0] font-bold text-[8px] flex items-center justify-center">KN</span>
                  <span>Kotlin Notebook</span>
                </div>
                <div 
                  onClick={() => {
                    setNewFileDialogData({
                      isOpen: true,
                      parentPath: getParentPath(contextMenu.node),
                      fileType: 'js',
                      title: 'New JavaScript File',
                      name: '',
                      defaultExt: 'js',
                      isFolder: false,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <span className="w-3.5 h-3.5 rounded bg-[#F7DF1E]/20 text-[#F7DF1E] font-bold text-[8px] flex items-center justify-center">JS</span>
                  <span>JavaScript File</span>
                </div>
                <div 
                  onClick={() => {
                    setNewFileDialogData({
                      isOpen: true,
                      parentPath: getParentPath(contextMenu.node),
                      fileType: 'ts',
                      title: 'New TypeScript File',
                      name: '',
                      defaultExt: 'ts',
                      isFolder: false,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <span className="w-3.5 h-3.5 rounded bg-[#3574F0]/20 text-[#3574F0] font-bold text-[8px] flex items-center justify-center">TS</span>
                  <span>TypeScript File</span>
                </div>
                <div 
                  onClick={() => {
                    setNewFileDialogData({
                      isOpen: true,
                      parentPath: getParentPath(contextMenu.node),
                      fileType: 'html',
                      title: 'New HTML File',
                      name: '',
                      defaultExt: 'html',
                      isFolder: false,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <FileCode size={13} className="text-[#E06C75]" />
                  <span>HTML File</span>
                </div>
                <div 
                  onClick={() => {
                    setNewFileDialogData({
                      isOpen: true,
                      parentPath: getParentPath(contextMenu.node),
                      fileType: 'css',
                      title: 'New Stylesheet',
                      name: '',
                      defaultExt: 'css',
                      isFolder: false,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <FileCode size={13} className="text-[#437EE3]" />
                  <span>Stylesheet</span>
                </div>
                <div 
                  onClick={() => {
                    setNewFileDialogData({
                      isOpen: true,
                      parentPath: getParentPath(contextMenu.node),
                      fileType: 'http',
                      title: 'New HTTP Request',
                      name: '',
                      defaultExt: 'http',
                      isFolder: false,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <Globe size={13} className="text-[#59A869]" />
                  <span>HTTP Request</span>
                </div>
                <div 
                  onClick={() => {
                    setNewFileDialogData({
                      isOpen: true,
                      parentPath: getParentPath(contextMenu.node),
                      fileType: 'yaml',
                      title: 'New OpenAPI Specification',
                      name: '',
                      defaultExt: 'yaml',
                      isFolder: false,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <FileJson size={13} className="text-[#E5C07B]" />
                  <span>OpenAPI Specification</span>
                </div>
                <div 
                  onClick={() => {
                    setNewFileDialogData({
                      isOpen: true,
                      parentPath: getParentPath(contextMenu.node),
                      fileType: 'properties',
                      title: 'New Resource Bundle',
                      name: '',
                      defaultExt: 'properties',
                      isFolder: false,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <FileSpreadsheet size={13} className="text-[#868A91]" />
                  <span>Resource Bundle</span>
                </div>
                <div 
                  onClick={() => {
                    setNewFileDialogData({
                      isOpen: true,
                      parentPath: getParentPath(contextMenu.node),
                      fileType: 'editorconfig',
                      title: 'New EditorConfig File',
                      name: '.editorconfig',
                      defaultExt: '',
                      isFolder: false,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <FileText size={13} className="text-[#868A91]" />
                  <span>EditorConfig File</span>
                </div>
                <div className="border-t border-[#393B40] my-1" />
                <div 
                  onClick={() => { onShowToast?.('File Icon', 'Changed icon pack', 'info'); setContextMenu(null); }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 text-[#868A91] hover:text-white"
                >
                  <Plus size={13} />
                  <span>Change File Icon</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 2. Cut / Copy / Copy Path / Paste */}
          <div 
            onClick={() => {
              navigator.clipboard?.writeText(contextMenu.node.path);
              const item = { node: contextMenu.node, op: 'cut' as const, timestamp: Date.now() };
              setClipboardItem(item);
              setClipboardHistory(prev => [item, ...prev.filter(p => p.node.id !== item.node.id).slice(0, 9)]);
              onShowToast?.('Cut', `Cut ${contextMenu.node.name} to IDE clipboard`, 'info');
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Scissors size={13} className="text-[#868A91]" />
              <span>Cut</span>
            </div>
            <span className="text-[10px] text-[#868A91]">Ctrl+X</span>
          </div>

          <div 
            onClick={() => {
              navigator.clipboard?.writeText(contextMenu.node.path);
              const item = { node: contextMenu.node, op: 'copy' as const, timestamp: Date.now() };
              setClipboardItem(item);
              setClipboardHistory(prev => [item, ...prev.filter(p => p.node.id !== item.node.id).slice(0, 9)]);
              onShowToast?.('Copied', `Copied ${contextMenu.node.name} to IDE clipboard`, 'info');
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Copy size={13} className="text-[#868A91]" />
              <span>Copy</span>
            </div>
            <span className="text-[10px] text-[#868A91]">Ctrl+C</span>
          </div>

          {/* Copy Path/Reference > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveSubmenu('copy-path')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Copy size={13} className="text-[#868A91]" />
                <span>Copy Path/Reference</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeSubmenu === 'copy-path' && (
              <div 
                className={`absolute ${menuPos.x + 240 + 220 > window.innerWidth ? 'right-full -mr-0.5' : 'left-full -ml-0.5'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-[60] text-[12px] text-[#DFE1E5] w-52`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div 
                  onClick={() => {
                    navigator.clipboard?.writeText(contextMenu.node.path);
                    onShowToast?.('Copied', `Absolute Path: ${contextMenu.node.path}`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Absolute Path</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+Shift+C</span>
                </div>
                <div 
                  onClick={() => {
                    navigator.clipboard?.writeText(contextMenu.node.name);
                    onShowToast?.('Copied', `File Name: ${contextMenu.node.name}`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>File Name</span>
                </div>
                <div 
                  onClick={() => {
                    const norm = (p: string) => p.replace(/\\/g, '/');
                    const full = norm(contextMenu.node.path);
                    const root = norm(projectRootPath || files[0]?.path || '');
                    let rel = full;
                    if (root && full.startsWith(root)) {
                      rel = full.slice(root.length).replace(/^\/+/, '');
                    } else {
                      const rootName = files[0]?.name || '';
                      const idx = full.indexOf('/' + rootName + '/');
                      if (idx !== -1) rel = full.slice(idx + rootName.length + 2);
                    }
                    navigator.clipboard?.writeText(rel);
                    onShowToast?.('Copied', `Content Root: ${rel}`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Path From Content Root</span>
                </div>
                <div 
                  onClick={() => {
                    const norm = (p: string) => p.replace(/\\/g, '/');
                    const full = norm(contextMenu.node.path);
                    const srcIdx = full.indexOf('/src/');
                    let srcRel = full;
                    if (srcIdx !== -1) {
                      srcRel = full.slice(srcIdx + 5);
                    } else if (full.startsWith('src/')) {
                      srcRel = full.slice(4);
                    } else {
                      srcRel = contextMenu.node.name;
                    }
                    navigator.clipboard?.writeText(srcRel);
                    onShowToast?.('Copied', `Source Root: ${srcRel}`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Path From Source Root</span>
                </div>
                <div 
                  onClick={() => {
                    const norm = (p: string) => p.replace(/\\/g, '/');
                    const full = norm(contextMenu.node.path);
                    const srcIdx = full.indexOf('/src/');
                    let srcRel = full;
                    if (srcIdx !== -1) srcRel = full.slice(srcIdx + 5);
                    const baseName = contextMenu.node.name.replace(/\.[^/.]+$/, '');
                    const ref = `import { ${baseName} } from './${srcRel.replace(/\.[^/.]+$/, '')}';`;
                    navigator.clipboard?.writeText(ref);
                    onShowToast?.('Copied', `Reference: ${ref}`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Copy Reference</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+Alt+Shift+C</span>
                </div>
              </div>
            )}
          </div>

          <div 
            onClick={() => {
              if (!clipboardItem) {
                onShowToast?.('Paste', 'Clipboard is empty. Copy or Cut a file first.', 'warning');
                setContextMenu(null);
                return;
              }
              const targetParent = contextMenu.node.isFolder 
                ? contextMenu.node.path 
                : (contextMenu.node.path.includes('/') || contextMenu.node.path.includes('\\')
                    ? contextMenu.node.path.replace(/[\\/][^\\/]+$/, '')
                    : '');
              onPasteFile?.(clipboardItem.node, targetParent, clipboardItem.op);
              if (clipboardItem.op === 'cut') {
                setClipboardItem(null);
              }
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Clipboard size={13} className="text-[#868A91]" />
              <span>Paste</span>
            </div>
            <span className="text-[10px] text-[#868A91]">Ctrl+V</span>
          </div>

          <div 
            onClick={() => {
              if (clipboardHistory.length === 0) {
                onShowToast?.('Paste from History', 'History buffer empty', 'info');
              } else {
                setIsPasteHistoryOpen(true);
              }
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2 pl-5">
              <span>Paste from History...</span>
            </div>
            <span className="text-[10px] text-[#868A91]">Ctrl+Shift+V</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* Find in Files / Replace in Files */}
          <div 
            onClick={() => {
              const targetFolder = contextMenu.node.isFolder ? contextMenu.node.path : getParentPath(contextMenu.node);
              onFindInFolder ? onFindInFolder(targetFolder, 'find') : onSelectMenuAction?.('edit.findInFiles');
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Search size={13} className="text-[#868A91]" />
              <span>Find in Files...</span>
            </div>
            <span className="text-[10px] text-[#868A91]">Ctrl+Shift+F</span>
          </div>

          <div 
            onClick={() => {
              const targetFolder = contextMenu.node.isFolder ? contextMenu.node.path : getParentPath(contextMenu.node);
              onFindInFolder ? onFindInFolder(targetFolder, 'replace') : onSelectMenuAction?.('edit.replaceInFiles');
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2 pl-5">
              <span>Replace in Files...</span>
            </div>
            <span className="text-[10px] text-[#868A91]">Ctrl+Shift+R</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* 3. Find Usages / Refactor / Rename / Delete */}
          <div 
            onClick={() => {
              const baseName = contextMenu.node.name.replace(/\.[^/.]+$/, '');
              onFindUsages?.(baseName);
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Search size={13} className="text-[#868A91]" />
              <span>Find Usages</span>
            </div>
            <span className="text-[10px] text-[#868A91]">Alt+F7</span>
          </div>

          {/* Refactor > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveSubmenu('refactor')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-[#868A91]" />
                <span>Refactor</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeSubmenu === 'refactor' && (
              <div 
                className={`absolute ${menuPos.x + 240 + 220 > window.innerWidth ? 'right-full -mr-0.5' : 'left-full -ml-0.5'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-[60] text-[12px] text-[#DFE1E5] w-48`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div 
                  onClick={() => {
                    setRenameModalData({
                      isOpen: true,
                      node: contextMenu.node,
                      newName: contextMenu.node.name,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Rename...</span>
                  <span className="text-[10px] text-[#868A91]">Shift+F6</span>
                </div>
                <div 
                  onClick={() => {
                    const parent = contextMenu.node.path.includes('/') || contextMenu.node.path.includes('\\')
                      ? contextMenu.node.path.replace(/[\\/][^\\/]+$/, '')
                      : '';
                    setMoveModalData({
                      isOpen: true,
                      node: contextMenu.node,
                      destFolder: parent,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Move...</span>
                  <span className="text-[10px] text-[#868A91]">F6</span>
                </div>
                <div 
                  onClick={() => {
                    const parent = contextMenu.node.path.includes('/') || contextMenu.node.path.includes('\\')
                      ? contextMenu.node.path.replace(/[\\/][^\\/]+$/, '')
                      : '';
                    const ext = contextMenu.node.name.includes('.') ? '.' + contextMenu.node.name.split('.').pop() : '';
                    const base = contextMenu.node.name.replace(/\.[^/.]+$/, '');
                    setCopyModalData({
                      isOpen: true,
                      node: contextMenu.node,
                      newName: `${base}_copy${ext}`,
                      destFolder: parent,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Copy File...</span>
                  <span className="text-[10px] text-[#868A91]">F5</span>
                </div>
                <div 
                  onClick={() => {
                    setDeleteModalData({
                      isOpen: true,
                      node: contextMenu.node,
                      safeDelete: true,
                      searchComments: true,
                    });
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#E05555] hover:text-white cursor-pointer flex items-center justify-between text-[#E05555]"
                >
                  <span>Safe Delete...</span>
                  <span className="text-[10px] text-[#868A91]">Alt+Delete</span>
                </div>
              </div>
            )}
          </div>

          <div 
            onClick={() => {
              setRenameModalData({
                isOpen: true,
                node: contextMenu.node,
                newName: contextMenu.node.name,
              });
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2 pl-5">
              <span>Rename...</span>
            </div>
            <span className="text-[10px] text-[#868A91]">Shift+F6</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* Bookmarks > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveSubmenu('bookmarks')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark size={13} className="text-[#868A91]" />
                <span>Bookmarks</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeSubmenu === 'bookmarks' && (
              <div 
                className={`absolute ${menuPos.x + 240 + 220 > window.innerWidth ? 'right-full -mr-0.5' : 'left-full -ml-0.5'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-[60] text-[12px] text-[#DFE1E5] w-52`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div 
                  onClick={() => {
                    onToggleBookmark?.(contextMenu.node.path);
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Add Bookmark</span>
                  <span className="text-[10px] text-[#868A91]">F11</span>
                </div>
                <div 
                  onClick={() => {
                    const mnemonic = window.prompt(`Enter mnemonic bookmark for ${contextMenu.node.name} (0-9 or A-Z):`, '1');
                    if (mnemonic) {
                      onToggleBookmark?.(contextMenu.node.path, mnemonic.trim().toUpperCase());
                    }
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Add Mnemonic Bookmark...</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+F11</span>
                </div>
                <div 
                  onClick={() => {
                    onShowBookmarksModal?.();
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Show Bookmarks</span>
                  <span className="text-[10px] text-[#868A91]">Shift+F11</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* Reformat Code / Optimize Imports / Delete / Override File Type */}
          <div 
            onClick={() => {
              onReformatCode?.(contextMenu.node);
              onShowToast?.('Reformat Code', `Reformatted ${contextMenu.node.name}`, 'success');
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2 pl-5">
              <span>Reformat Code</span>
            </div>
            <span className="text-[10px] text-[#868A91]">Ctrl+Alt+L</span>
          </div>

          <div 
            onClick={() => {
              onOptimizeImports?.(contextMenu.node);
              onShowToast?.('Optimize Imports', `Optimized imports for ${contextMenu.node.name}`, 'success');
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2 pl-5">
              <span>Optimize Imports</span>
            </div>
            <span className="text-[10px] text-[#868A91]">Ctrl+Alt+O</span>
          </div>

          <div 
            onClick={() => {
              setDeleteModalData({
                isOpen: true,
                node: contextMenu.node,
                safeDelete: false,
                searchComments: false,
              });
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#E05555] hover:text-white cursor-pointer flex items-center justify-between text-[#E05555]"
          >
            <div className="flex items-center gap-2">
              <Trash2 size={13} />
              <span>Delete...</span>
            </div>
            <span className="text-[10px] text-[#868A91]">Delete</span>
          </div>

          <div 
            onClick={() => {
              onShowToast?.('File Type', `Overriding file type for ${contextMenu.node.name}`, 'info');
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 pl-5"
          >
            <span>Override File Type</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* Open in Right Split */}
          <div 
            onClick={() => {
              onOpenSplit?.(contextMenu.node);
              onShowToast?.('Split Right', `Opened ${contextMenu.node.name} in right split`, 'info');
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Split size={13} className="text-[#868A91]" />
              <span>Open in Right Split</span>
            </div>
            <span className="text-[10px] text-[#868A91]">Shift+Enter</span>
          </div>

          {/* Open In > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveSubmenu('open-in')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ExternalLink size={13} className="text-[#868A91]" />
                <span>Open In</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeSubmenu === 'open-in' && (
              <div 
                className={`absolute ${menuPos.x + 240 + 220 > window.innerWidth ? 'right-full -mr-0.5' : 'left-full -ml-0.5'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-[60] text-[12px] text-[#DFE1E5] w-48`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div 
                  onClick={() => {
                    const targetPath = contextMenu.node.path;
                    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
                      invoke('reveal_in_explorer', { path: targetPath })
                        .then(() => onShowToast?.('Explorer', `Revealed ${contextMenu.node.name} in Windows Explorer`, 'success'))
                        .catch((err) => onShowToast?.('Explorer Error', String(err), 'error'));
                    } else {
                      onShowToast?.('Explorer', `Revealing ${contextMenu.node.name} in Windows Explorer`, 'info');
                    }
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <Folder size={13} className="text-[#3574F0]" />
                  <span>Explorer</span>
                </div>
                <div 
                  onClick={() => {
                    onOpenTerminal?.(contextMenu.node.path);
                    onShowToast?.('Terminal', `Navigated to directory in terminal`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <span className="text-[#59A869] font-mono text-[10px] font-bold">&gt;_</span>
                  <span>Terminal</span>
                </div>
              </div>
            )}
          </div>

          {/* Local History > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveSubmenu('local-history')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={13} className="text-[#868A91]" />
                <span>Local History</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeSubmenu === 'local-history' && (
              <div 
                className={`absolute ${menuPos.x + 240 + 220 > window.innerWidth ? 'right-full -mr-0.5' : 'left-full -ml-0.5'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-[60] text-[12px] text-[#DFE1E5] w-48`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div 
                  onClick={() => {
                    onLocalHistory?.(contextMenu.node);
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <span>Show History</span>
                </div>
                <div 
                  onClick={() => {
                    const label = window.prompt(`Enter checkpoint label for ${contextMenu.node.name}:`, `Checkpoint-${new Date().toLocaleTimeString()}`);
                    if (label) {
                      onShowToast?.('Local History', `Saved label "${label}" for ${contextMenu.node.name}`, 'success');
                    }
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <span>Put Label...</span>
                </div>
              </div>
            )}
          </div>

          {/* Git > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveSubmenu('git')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch size={13} className="text-[#868A91]" />
                <span>Git</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeSubmenu === 'git' && (
              <div 
                className={`absolute ${menuPos.x + 240 + 220 > window.innerWidth ? 'right-full -mr-0.5' : 'left-full -ml-0.5'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-[60] text-[12px] text-[#DFE1E5] w-52`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div 
                  onClick={() => {
                    onGitCommit?.(contextMenu.node);
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Commit File...</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+K</span>
                </div>
                <div 
                  onClick={() => {
                    const rootPath = files[0]?.path || '';
                    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
                      invoke('git_add', { projectPath: rootPath, files: [contextMenu.node.path] })
                        .then(() => onShowToast?.('Git Add', `Staged ${contextMenu.node.name}`, 'success'))
                        .catch((err) => onShowToast?.('Git Add Error', String(err), 'error'));
                    } else {
                      onShowToast?.('Git Add', `Staged ${contextMenu.node.name}`, 'success');
                    }
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Add</span>
                </div>
                <div 
                  onClick={() => {
                    onGitBlame?.(contextMenu.node);
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Annotate with Git Blame</span>
                </div>
                <div 
                  onClick={() => {
                    onSelectMenuAction?.('git.compareBranch');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Compare with Branch...</span>
                </div>
                <div 
                  onClick={() => {
                    onSelectMenuAction?.('git.log');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Show History</span>
                </div>
              </div>
            )}
          </div>

          {/* Mark Directory as > (Only for folders) */}
          {contextMenu.node.isFolder && (
            <div 
              className="relative group"
              onMouseEnter={() => setActiveSubmenu('mark-dir')}
            >
              <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder size={13} className="text-[#868A91]" />
                  <span>Mark Directory as</span>
                </div>
                <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
              </div>

              {activeSubmenu === 'mark-dir' && (
                <div 
                  className={`absolute ${menuPos.x + 240 + 220 > window.innerWidth ? 'right-full -mr-0.5' : 'left-full -ml-0.5'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-[60] text-[12px] text-[#DFE1E5] w-52`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div 
                    onClick={() => {
                      onShowToast?.('Sources Root', `Marked ${contextMenu.node.name} as Sources Root`, 'success');
                      setContextMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                  >
                    <Folder size={13} className="text-[#3574F0]" />
                    <span>Sources Root</span>
                  </div>
                  <div 
                    onClick={() => {
                      onShowToast?.('Test Sources Root', `Marked ${contextMenu.node.name} as Test Sources Root`, 'success');
                      setContextMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                  >
                    <Folder size={13} className="text-[#59A869]" />
                    <span>Test Sources Root</span>
                  </div>
                  <div 
                    onClick={() => {
                      onShowToast?.('Resources Root', `Marked ${contextMenu.node.name} as Resources Root`, 'success');
                      setContextMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                  >
                    <Folder size={13} className="text-[#9876AA]" />
                    <span>Resources Root</span>
                  </div>
                  <div 
                    onClick={() => {
                      onShowToast?.('Excluded', `Marked ${contextMenu.node.name} as Excluded`, 'warning');
                      setContextMenu(null);
                    }}
                    className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                  >
                    <Folder size={13} className="text-[#868A91]" />
                    <span>Excluded</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div 
            onClick={() => {
              onRepairIde?.();
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 pl-5"
          >
            <Wrench size={13} className="text-[#868A91]" />
            <span>Repair IDE on File</span>
          </div>

          <div 
            onClick={() => {
              onReloadFromDisk?.(contextMenu.node);
              onShowToast?.('Reload Disk', `Reloaded ${contextMenu.node.name} from disk`, 'success');
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 pl-5"
          >
            <RotateCw size={13} className="text-[#868A91]" />
            <span>Reload from Disk</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* Compare With / Diagrams / Create Gist */}
          <div 
            onClick={() => {
              onCompareWith?.(contextMenu.node);
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2 pl-5">
              <span>Compare With...</span>
            </div>
            <span className="text-[10px] text-[#868A91]">Ctrl+D</span>
          </div>

          {/* Diagrams > */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveSubmenu('diagrams')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2 pl-5">
                <Layers size={13} className="text-[#868A91]" />
                <span>Diagrams</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeSubmenu === 'diagrams' && (
              <div 
                className={`absolute ${menuPos.x + 240 + 220 > window.innerWidth ? 'right-full -mr-0.5' : 'left-full -ml-0.5'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-[60] text-[12px] text-[#DFE1E5] w-48`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div 
                  onClick={() => {
                    onSelectMenuAction?.('view.diagrams');
                    onShowToast?.('Diagrams', `Displaying structure diagram for ${contextMenu.node.name}`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Show Diagram...</span>
                </div>
              </div>
            )}
          </div>

          {/* SonarQube for IDE > (Matching IntelliJ IDEA Context Menu 100%) */}
          <div 
            className="relative group"
            onMouseEnter={() => setActiveSubmenu('sonarqube')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2 pl-5">
                <SonarIcon size={13} />
                <span>SonarQube for IDE</span>
              </div>
              <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
            </div>

            {activeSubmenu === 'sonarqube' && (
              <div 
                className={`absolute ${menuPos.x + 240 + 260 > window.innerWidth ? 'right-full -mr-0.5' : 'left-full -ml-0.5'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-[60] text-[12px] text-[#DFE1E5] w-72`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div 
                  onClick={() => {
                    const targetPath = contextMenu.node.path || contextMenu.node.name;
                    onAnalyzeSonarPath?.(targetPath, Boolean(contextMenu.node.isFolder));
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Analyze with SonarQube for IDE</span>
                  <span className="text-[10px] text-[#868A91] font-mono">Ctrl+Shift+S</span>
                </div>
                <div 
                  onClick={() => {
                    const targetPath = contextMenu.node.path || contextMenu.node.name;
                    onExcludeSonarPath?.(targetPath);
                    onShowToast?.('SonarQube for IDE', `Excluded "${contextMenu.node.name}" from SonarQube analysis`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Exclude from SonarQube for IDE Analysis</span>
                </div>
              </div>
            )}
          </div>

          <div 
            onClick={async () => {
              if (contextMenu.node.content) {
                await navigator.clipboard.writeText(contextMenu.node.content);
                onShowToast?.('GitHub Gist', `Copied content of ${contextMenu.node.name} to clipboard for Gist`, 'success');
              } else {
                onShowToast?.('GitHub Gist', `Created Gist snippet reference for ${contextMenu.node.name}`, 'success');
              }
              setContextMenu(null);
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 pl-5"
          >
            <Share2 size={13} className="text-[#868A91]" />
            <span>Create Gist...</span>
          </div>
        </div>
      )}

      {/* ─── IntelliJ New File / Directory Modal ─── */}
      {newFileDialogData.isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 select-none animate-in fade-in duration-100"
          onClick={() => setNewFileDialogData(prev => ({ ...prev, isOpen: false }))}
        >
          <div 
            className="bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl w-[440px] p-4 text-[#DFE1E5] space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#393B40] pb-2 font-semibold text-xs">
              <div className="flex items-center gap-2">
                {newFileDialogData.isFolder ? (
                  <FolderPlus size={15} className="text-[#3574F0]" />
                ) : (
                  <FilePlus size={15} className="text-[#59A869]" />
                )}
                <span className="text-white">{newFileDialogData.title}</span>
              </div>
              <button 
                onClick={() => setNewFileDialogData(prev => ({ ...prev, isOpen: false }))} 
                className="text-[#868A91] hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="text-[11px] text-[#868A91] bg-[#1E1F22] px-2.5 py-1.5 rounded border border-[#393B40]/60 break-all">
                <span className="text-[#6C707E]">Directory: </span>
                <span className="text-[#DFE1E5]">{newFileDialogData.parentPath || 'project root'}</span>
              </div>

              <div>
                <label className="text-[#868A91] block mb-1">
                  {newFileDialogData.isFolder ? 'Directory name:' : 'File name:'}
                  {newFileDialogData.defaultExt && (
                    <span className="text-[#6C707E] ml-1">(.{newFileDialogData.defaultExt})</span>
                  )}
                </label>
                <input
                  type="text"
                  value={newFileDialogData.name}
                  onChange={(e) => setNewFileDialogData(prev => ({ ...prev, name: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const trimmed = newFileDialogData.name.trim();
                      if (!trimmed) return;
                      let finalName = trimmed;
                      if (!newFileDialogData.isFolder && newFileDialogData.defaultExt && !finalName.endsWith('.' + newFileDialogData.defaultExt)) {
                        finalName = `${finalName}.${newFileDialogData.defaultExt}`;
                      }
                      if (newFileDialogData.isFolder) {
                        onNewFolder?.(newFileDialogData.parentPath, finalName);
                      } else {
                        onNewFile?.(newFileDialogData.parentPath, finalName);
                      }
                      setNewFileDialogData(prev => ({ ...prev, isOpen: false }));
                    } else if (e.key === 'Escape') {
                      setNewFileDialogData(prev => ({ ...prev, isOpen: false }));
                    }
                  }}
                  placeholder={newFileDialogData.isFolder ? "e.g. components, utils, assets" : (newFileDialogData.defaultExt ? `e.g. index.${newFileDialogData.defaultExt}` : "e.g. App.tsx, styles.css")}
                  className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-white outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#393B40]">
              <button
                onClick={() => setNewFileDialogData(prev => ({ ...prev, isOpen: false }))}
                className="px-3 py-1 bg-[#1E1F22] hover:bg-[#35373B] text-xs text-[#868A91] rounded border border-[#393B40]"
              >
                Cancel
              </button>
              <button
                disabled={!newFileDialogData.name.trim()}
                onClick={() => {
                  const trimmed = newFileDialogData.name.trim();
                  if (!trimmed) return;
                  let finalName = trimmed;
                  if (!newFileDialogData.isFolder && newFileDialogData.defaultExt && !finalName.endsWith('.' + newFileDialogData.defaultExt)) {
                    finalName = `${finalName}.${newFileDialogData.defaultExt}`;
                  }
                  if (newFileDialogData.isFolder) {
                    onNewFolder?.(newFileDialogData.parentPath, finalName);
                  } else {
                    onNewFile?.(newFileDialogData.parentPath, finalName);
                  }
                  setNewFileDialogData(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-1 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-40 text-xs text-white rounded font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── IntelliJ Refactor Rename Modal (Shift+F6) ─── */}
      {renameModalData.isOpen && renameModalData.node && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 select-none animate-in fade-in duration-100"
          onClick={() => setRenameModalData({ isOpen: false, node: null, newName: '' })}
        >
          <div 
            className="bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl w-[440px] p-4 text-[#DFE1E5] space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#393B40] pb-2 font-semibold text-xs">
              <div className="flex items-center gap-2">
                <Edit3 size={15} className="text-[#3574F0]" />
                <span className="text-white">Rename (Shift+F6)</span>
              </div>
              <button 
                onClick={() => setRenameModalData({ isOpen: false, node: null, newName: '' })} 
                className="text-[#868A91] hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="text-[11px] text-[#868A91]">
                Rename {renameModalData.node.isFolder ? 'directory' : 'file'}: <span className="text-white font-medium">{renameModalData.node.name}</span>
              </div>

              <div>
                <label className="text-[#868A91] block mb-1">New name:</label>
                <input
                  type="text"
                  value={renameModalData.newName}
                  onChange={(e) => setRenameModalData(prev => ({ ...prev, newName: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const trimmed = renameModalData.newName.trim();
                      if (trimmed && renameModalData.node && trimmed !== renameModalData.node.name) {
                        onRenameFile?.(renameModalData.node, trimmed);
                      }
                      setRenameModalData({ isOpen: false, node: null, newName: '' });
                    } else if (e.key === 'Escape') {
                      setRenameModalData({ isOpen: false, node: null, newName: '' });
                    }
                  }}
                  className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-white outline-none font-mono"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#393B40]">
              <button
                onClick={() => setRenameModalData({ isOpen: false, node: null, newName: '' })}
                className="px-3 py-1 bg-[#1E1F22] hover:bg-[#35373B] text-xs text-[#868A91] rounded border border-[#393B40]"
              >
                Cancel
              </button>
              <button
                disabled={!renameModalData.newName.trim() || renameModalData.newName.trim() === renameModalData.node.name}
                onClick={() => {
                  const trimmed = renameModalData.newName.trim();
                  if (trimmed && renameModalData.node && trimmed !== renameModalData.node.name) {
                    onRenameFile?.(renameModalData.node, trimmed);
                  }
                  setRenameModalData({ isOpen: false, node: null, newName: '' });
                }}
                className="px-4 py-1 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-40 text-xs text-white rounded font-medium"
              >
                Refactor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Refactor Copy File Modal (F5) ─── */}
      {copyModalData.isOpen && copyModalData.node && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 select-none"
          onClick={() => setCopyModalData(prev => ({ ...prev, isOpen: false }))}
        >
          <div 
            className="bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl w-[440px] p-4 text-[#DFE1E5] space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#393B40] pb-2 font-semibold text-xs">
              <span className="text-white">Copy File (F5)</span>
              <button onClick={() => setCopyModalData(prev => ({ ...prev, isOpen: false }))} className="text-[#868A91] hover:text-white">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#868A91] block mb-1">New name:</label>
                <input
                  type="text"
                  value={copyModalData.newName}
                  onChange={(e) => setCopyModalData(prev => ({ ...prev, newName: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && copyModalData.node && copyModalData.newName) {
                      onCopyFileRefactor?.(copyModalData.node, copyModalData.newName, copyModalData.destFolder);
                      setCopyModalData(prev => ({ ...prev, isOpen: false }));
                    }
                  }}
                  className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-white outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[#868A91] block mb-1">To directory:</label>
                <input
                  type="text"
                  value={copyModalData.destFolder}
                  onChange={(e) => setCopyModalData(prev => ({ ...prev, destFolder: e.target.value }))}
                  className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-white outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#393B40]">
              <button
                onClick={() => setCopyModalData(prev => ({ ...prev, isOpen: false }))}
                className="px-3 py-1 bg-[#1E1F22] hover:bg-[#35373B] text-xs text-[#868A91] rounded border border-[#393B40]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (copyModalData.node && copyModalData.newName) {
                    onCopyFileRefactor?.(copyModalData.node, copyModalData.newName, copyModalData.destFolder);
                    setCopyModalData(prev => ({ ...prev, isOpen: false }));
                  }
                }}
                className="px-4 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-xs text-white rounded font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Refactor Move Modal (F6) ─── */}
      {moveModalData.isOpen && moveModalData.node && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 select-none"
          onClick={() => setMoveModalData(prev => ({ ...prev, isOpen: false }))}
        >
          <div 
            className="bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl w-[440px] p-4 text-[#DFE1E5] space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#393B40] pb-2 font-semibold text-xs">
              <span className="text-white">Move (F6)</span>
              <button onClick={() => setMoveModalData(prev => ({ ...prev, isOpen: false }))} className="text-[#868A91] hover:text-white">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[#868A91] mb-1">
                  Move <span className="text-white font-medium">{moveModalData.node.name}</span>
                </div>
                <label className="text-[#868A91] block mb-1">To directory:</label>
                <input
                  type="text"
                  value={moveModalData.destFolder}
                  onChange={(e) => setMoveModalData(prev => ({ ...prev, destFolder: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && moveModalData.node && moveModalData.destFolder) {
                      onMoveFileRefactor?.(moveModalData.node, moveModalData.destFolder);
                      setMoveModalData(prev => ({ ...prev, isOpen: false }));
                    }
                  }}
                  className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-white outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#393B40]">
              <button
                onClick={() => setMoveModalData(prev => ({ ...prev, isOpen: false }))}
                className="px-3 py-1 bg-[#1E1F22] hover:bg-[#35373B] text-xs text-[#868A91] rounded border border-[#393B40]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (moveModalData.node && moveModalData.destFolder) {
                    onMoveFileRefactor?.(moveModalData.node, moveModalData.destFolder);
                    setMoveModalData(prev => ({ ...prev, isOpen: false }));
                  }
                }}
                className="px-4 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-xs text-white rounded font-medium"
              >
                Refactor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Paste from History Modal ─── */}
      {isPasteHistoryOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 select-none"
          onClick={() => setIsPasteHistoryOpen(false)}
        >
          <div 
            className="bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl w-[480px] p-4 text-[#DFE1E5] space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#393B40] pb-2 font-semibold text-xs">
              <span className="text-white">Paste from History</span>
              <button onClick={() => setIsPasteHistoryOpen(false)} className="text-[#868A91] hover:text-white">✕</button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {clipboardHistory.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setClipboardItem(item);
                    setIsPasteHistoryOpen(false);
                    onShowToast?.('Clipboard Active', `Selected ${item.node.name} for paste`, 'info');
                  }}
                  className="p-2 bg-[#1E1F22] hover:bg-[#35373B] rounded cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      item.op === 'cut' ? 'bg-[#E05555]/20 text-[#E05555]' : 'bg-[#3574F0]/20 text-[#3574F0]'
                    }`}>
                      {item.op}
                    </span>
                    <span className="font-medium text-white truncate">{item.node.name}</span>
                    <span className="text-[10px] text-[#868A91] truncate font-mono">{item.node.path}</span>
                  </div>
                  <button className="px-2 py-0.5 bg-[#3574F0] text-white text-[11px] rounded">Select</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Safe Delete Modal ─── */}
      {deleteModalData.isOpen && deleteModalData.node && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 select-none"
          onClick={() => setDeleteModalData(prev => ({ ...prev, isOpen: false }))}
        >
          <div 
            className="bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl w-[460px] p-4 text-[#DFE1E5] space-y-4 animate-in fade-in zoom-in-95 duration-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#393B40] pb-2 font-semibold text-xs">
              <div className="flex items-center gap-2 text-white">
                <Trash2 size={14} className="text-[#E05555]" />
                <span>{deleteModalData.safeDelete ? 'Safe Delete' : 'Delete'}</span>
              </div>
              <button 
                onClick={() => setDeleteModalData(prev => ({ ...prev, isOpen: false }))} 
                className="text-[#868A91] hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="text-sm text-white font-medium">
                {deleteModalData.node.isFolder 
                  ? `Delete directory '${deleteModalData.node.name}' and all its contents?`
                  : `Delete file '${deleteModalData.node.name}'?`
                }
              </div>
              <div className="text-[#868A91] text-[11px] font-mono break-all bg-[#1E1F22] p-2 rounded border border-[#393B40]">
                {deleteModalData.node.path}
              </div>

              <div className="space-y-2 pt-2 border-t border-[#393B40]">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deleteModalData.safeDelete}
                    onChange={(e) => setDeleteModalData(prev => ({ ...prev, safeDelete: e.target.checked }))}
                    className="accent-[#3574F0] rounded"
                  />
                  <span>Safe delete (search for usages before delete)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deleteModalData.searchComments}
                    onChange={(e) => setDeleteModalData(prev => ({ ...prev, searchComments: e.target.checked }))}
                    className="accent-[#3574F0] rounded"
                  />
                  <span>Search in comments and strings</span>
                </label>
              </div>

              <div className="text-[11px] text-[#E05555] bg-[#E05555]/10 border border-[#E05555]/20 p-2 rounded">
                Warning: This file will be removed permanently from your disk and project workspace.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#393B40]">
              <button
                type="button"
                onClick={() => setDeleteModalData(prev => ({ ...prev, isOpen: false }))}
                className="px-3 py-1 bg-[#1E1F22] hover:bg-[#35373B] text-xs text-[#868A91] rounded border border-[#393B40]"
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  if (deleteModalData.node) {
                    onDeleteFile?.(deleteModalData.node);
                    setDeleteModalData(prev => ({ ...prev, isOpen: false }));
                  }
                }}
                className="px-4 py-1 bg-[#E05555] hover:bg-[#C94545] text-xs text-white rounded font-medium shadow-sm transition-colors"
              >
                OK (Delete)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
