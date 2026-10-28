import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
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
  Share2
} from 'lucide-react';
import { FileNode } from '../types';

export interface ProjectTreeProps {
  files: FileNode[];
  activeFileId: string | null;
  onFileSelect: (file: FileNode) => void;
  onNewFile?: (parentPath?: string, defaultExt?: string) => void;
  onNewFolder?: (parentPath?: string) => void;
  onDeleteFile?: (file: FileNode) => void;
  onRenameFile?: (file: FileNode) => void;
  onOpenSplit?: (file: FileNode) => void;
  onLocalHistory?: (file: FileNode) => void;
  onGitCommit?: (file: FileNode) => void;
  onGitBlame?: (file: FileNode) => void;
  onReformatCode?: (file: FileNode) => void;
  onOptimizeImports?: (file: FileNode) => void;
  onRepairIde?: () => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onFindUsages?: (symbol: string) => void;
}

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
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'root': true,
    'src': true,
    'src-tauri': true,
    'src-tauri-src': true,
  });

  const [scopeView, setScopeView] = useState<'Project' | 'Open Files' | 'Scratches'>('Project');
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [compactPackages, setCompactPackages] = useState(true);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode;
  } | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

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
    // Use capture phase so clicks on Monaco Editor, Tabs, etc. trigger immediate dismissal
    window.addEventListener('mousedown', handleOutsideDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideDown, true);
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

  const toggleFolder = (id: string, isCurrentlyExpanded: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({ 
      ...prev, 
      [id]: !isCurrentlyExpanded 
    }));
  };

  const handleCollapseAll = () => {
    setExpandedFolders({ 'root': true });
    onShowToast?.('Project View', 'All folders collapsed to root', 'info');
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

  const renderTree = (nodes: FileNode[], depth: number = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders[node.id] !== undefined 
        ? expandedFolders[node.id] 
        : (depth <= 1);
      const isActive = activeFileId === node.id;

      if (node.isFolder) {
        return (
          <div key={node.id}>
            <div
              className={`flex items-center gap-1.5 py-1 px-2 hover:bg-[#2B2D30] cursor-pointer text-[12px] text-[#DFE1E5] select-none transition-colors group`}
              style={{ paddingLeft: `${depth * 14 + 8}px` }}
              onClick={(e) => toggleFolder(node.id, isExpanded, e)}
              onContextMenu={(e) => handleContextMenu(e, node)}
            >
              <span className="text-[#868A91] hover:text-white">
                {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </span>
              {isExpanded ? (
                <FolderOpen size={14} className="text-[#E5A83B] fill-[#E5A83B]/25 flex-shrink-0" />
              ) : (
                <Folder size={14} className="text-[#E5A83B] fill-[#E5A83B]/25 flex-shrink-0" />
              )}
              <span className="truncate font-normal tracking-tight">{node.name}</span>
            </div>
            {isExpanded && node.children && (
              <div>{renderTree(node.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      return (
        <div
          key={node.id}
          className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer text-[12px] select-none transition-colors ${
            isActive 
              ? 'bg-[#2E436E] text-white font-medium' 
              : 'text-[#DFE1E5] hover:bg-[#2B2D30]'
          }`}
          style={{ paddingLeft: `${depth * 14 + 20}px` }}
          onClick={(e) => {
            e.stopPropagation();
            onFileSelect(node);
          }}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          {getFileIcon(node.name)}
          <span className="truncate tracking-tight">{node.name}</span>
        </div>
      );
    });
  };

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
            className="flex items-center gap-1 text-[11px] font-semibold text-[#DFE1E5] hover:text-white cursor-pointer"
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
            onClick={handleCollapseAll}
            className="p-1 hover:bg-[#2B2D30] hover:text-[#DFE1E5] rounded transition-colors cursor-pointer"
            title="Collapse All"
          >
            <FoldHorizontal size={13} />
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
              <div className="absolute right-0 top-full mt-1 w-52 bg-[#2B2D30] border border-[#393B40] rounded shadow-2xl py-1 z-50 text-xs text-[#DFE1E5]">
                <label className="px-3 py-1.5 hover:bg-[#35373B] flex items-center justify-between cursor-pointer">
                  <span>Compact Middle Packages</span>
                  <input 
                    type="checkbox" 
                    checked={compactPackages} 
                    onChange={(e) => setCompactPackages(e.target.checked)} 
                    className="accent-[#3574F0]" 
                  />
                </label>
                <div className="border-t border-[#393B40] my-1" />
                <div 
                  onClick={() => onShowToast?.('Tree Settings', 'Displaying flattened packages', 'info')}
                  className="px-3 py-1.5 hover:bg-[#35373B] cursor-pointer"
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

      {/* ─── Tree Content ─── */}
      <div className="flex-1 overflow-y-auto py-1 font-sans">
        {renderTree(files)}
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
          className="fixed bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-60 max-h-[calc(100vh-24px)] overflow-y-auto select-none"
          style={{ 
            top: `${menuPos.y}px`, 
            left: `${menuPos.x}px` 
          }}
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
                className={`absolute ${menuPos.x + 240 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-56 max-h-[80vh] overflow-y-auto`}
              >
                <div 
                  onClick={() => { onNewFile?.(contextMenu.node.path); setContextMenu(null); }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <File size={13} className="text-[#868A91]" />
                    <span>File</span>
                  </div>
                </div>
                <div 
                  onClick={() => { onNewFile?.(contextMenu.node.path); setContextMenu(null); }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-[#59A869]" />
                    <span>Scratch File</span>
                  </div>
                  <span className="text-[10px] text-[#868A91] group-hover:text-white">Ctrl+Alt+Shift+Insert</span>
                </div>
                <div 
                  onClick={() => { onNewFolder?.(contextMenu.node.path); setContextMenu(null); }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <Folder size={13} className="text-[#3574F0]" />
                  <span>Directory</span>
                </div>
                <div className="border-t border-[#393B40] my-1" />
                <div 
                  onClick={() => { onNewFile?.(contextMenu.node.path, 'kts'); setContextMenu(null); }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <span className="w-3.5 h-3.5 rounded bg-[#CE422B]/20 text-[#EDA200] font-bold text-[8px] flex items-center justify-center">KS</span>
                  <span>Kotlin Script</span>
                </div>
                <div 
                  onClick={() => { onNewFile?.(contextMenu.node.path, 'ipynb'); setContextMenu(null); }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <span className="w-3.5 h-3.5 rounded bg-[#3574F0]/20 text-[#3574F0] font-bold text-[8px] flex items-center justify-center">KN</span>
                  <span>Kotlin Notebook</span>
                </div>
                <div 
                  onClick={() => { onNewFile?.(contextMenu.node.path, 'js'); setContextMenu(null); }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <span className="w-3.5 h-3.5 rounded bg-[#F7DF1E]/20 text-[#F7DF1E] font-bold text-[8px] flex items-center justify-center">JS</span>
                  <span>JavaScript File</span>
                </div>
                <div 
                  onClick={() => { onNewFile?.(contextMenu.node.path, 'ts'); setContextMenu(null); }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <span className="w-3.5 h-3.5 rounded bg-[#3574F0]/20 text-[#3574F0] font-bold text-[8px] flex items-center justify-center">TS</span>
                  <span>TypeScript File</span>
                </div>
                <div 
                  onClick={() => { onNewFile?.(contextMenu.node.path, 'html'); setContextMenu(null); }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <FileCode size={13} className="text-[#E06C75]" />
                  <span>HTML File</span>
                </div>
                <div 
                  onClick={() => { onNewFile?.(contextMenu.node.path, 'css'); setContextMenu(null); }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <FileCode size={13} className="text-[#437EE3]" />
                  <span>Stylesheet</span>
                </div>
                <div 
                  onClick={() => { onNewFile?.(contextMenu.node.path, 'http'); setContextMenu(null); }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <Globe size={13} className="text-[#59A869]" />
                  <span>HTTP Request</span>
                </div>
                <div 
                  onClick={() => { onNewFile?.(contextMenu.node.path, 'yaml'); setContextMenu(null); }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <FileJson size={13} className="text-[#E5C07B]" />
                  <span>OpenAPI Specification</span>
                </div>
                <div 
                  onClick={() => { onNewFile?.(contextMenu.node.path, 'properties'); setContextMenu(null); }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <FileSpreadsheet size={13} className="text-[#868A91]" />
                  <span>Resource Bundle</span>
                </div>
                <div 
                  onClick={() => { onNewFile?.(contextMenu.node.path, 'editorconfig'); setContextMenu(null); }}
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
              navigator.clipboard?.writeText(contextMenu.node.name);
              onShowToast?.('Cut', `Cut ${contextMenu.node.name}`, 'info');
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
              navigator.clipboard?.writeText(contextMenu.node.name);
              onShowToast?.('Copied', `Copied ${contextMenu.node.name}`, 'info');
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
              <div className={`absolute ${menuPos.x + 240 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-52`}>
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
                    navigator.clipboard?.writeText(contextMenu.node.path);
                    onShowToast?.('Copied', `Content Root: ${contextMenu.node.path}`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Path From Content Root</span>
                </div>
                <div 
                  onClick={() => {
                    navigator.clipboard?.writeText(contextMenu.node.path);
                    onShowToast?.('Copied', `Source Root: ${contextMenu.node.path}`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Path From Source Root</span>
                </div>
                <div 
                  onClick={() => {
                    navigator.clipboard?.writeText(contextMenu.node.name);
                    onShowToast?.('Copied', `Reference: ${contextMenu.node.name}`, 'info');
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
              onShowToast?.('Paste', 'Pasted content from clipboard', 'info');
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
              onShowToast?.('Paste from History', 'History buffer empty', 'info');
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
              <div className={`absolute ${menuPos.x + 240 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-48`}>
                <div 
                  onClick={() => {
                    onRenameFile?.(contextMenu.node);
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Rename...</span>
                  <span className="text-[10px] text-[#868A91]">Shift+F6</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Refactor Move', `Move ${contextMenu.node.name}`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Move...</span>
                  <span className="text-[10px] text-[#868A91]">F6</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Refactor Copy', `Copying ${contextMenu.node.name}`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Copy File...</span>
                  <span className="text-[10px] text-[#868A91]">F5</span>
                </div>
                <div 
                  onClick={() => {
                    onDeleteFile?.(contextMenu.node);
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
              onRenameFile?.(contextMenu.node);
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
              <div className={`absolute ${menuPos.x + 240 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-52`}>
                <div 
                  onClick={() => {
                    onShowToast?.('Bookmark', `Added bookmark to ${contextMenu.node.name}`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Add Bookmark</span>
                  <span className="text-[10px] text-[#868A91]">F11</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Mnemonic Bookmark', `Set mnemonic bookmark on ${contextMenu.node.name}`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Add Mnemonic Bookmark...</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+F11</span>
                </div>
                <div 
                  onClick={() => {
                    onShowToast?.('Bookmarks', 'Showing project bookmarks', 'info');
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
              onDeleteFile?.(contextMenu.node);
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
              <div className={`absolute ${menuPos.x + 240 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-48`}>
                <div 
                  onClick={() => {
                    onShowToast?.('Explorer', `Revealing ${contextMenu.node.path} in Windows Explorer`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <Folder size={13} className="text-[#3574F0]" />
                  <span>Explorer</span>
                </div>
                <div 
                  onClick={() => {
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
              <div className={`absolute ${menuPos.x + 240 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-48`}>
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
                    onShowToast?.('Local History', `Saved label for ${contextMenu.node.name}`, 'info');
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
              <div className={`absolute ${menuPos.x + 240 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-52`}>
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
                    onShowToast?.('Git Add', `Staged ${contextMenu.node.name}`, 'success');
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
                    onShowToast?.('Git Compare', `Comparing ${contextMenu.node.name} with origin/main`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Compare with Branch...</span>
                </div>
                <div 
                  onClick={() => {
                    onLocalHistory?.(contextMenu.node);
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Show History</span>
                </div>
              </div>
            )}
          </div>

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
              onShowToast?.('Reload Disk', `Reloaded ${contextMenu.node.name} from disk`, 'info');
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
              onShowToast?.('Compare', `Comparing ${contextMenu.node.name} with clipboard`, 'info');
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
              <div className={`absolute ${menuPos.x + 240 + 210 > window.innerWidth ? 'right-full mr-1' : 'left-full ml-1'} ${isBottomHalf ? 'bottom-0' : '-top-1'} bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] text-[#DFE1E5] w-48`}>
                <div 
                  onClick={() => {
                    onShowToast?.('Diagrams', 'Generating class & module diagram...', 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Show Diagram...</span>
                </div>
              </div>
            )}
          </div>

          <div 
            onClick={() => {
              onShowToast?.('GitHub Gist', `Created Gist for ${contextMenu.node.name}`, 'success');
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
    </div>
  );
};
