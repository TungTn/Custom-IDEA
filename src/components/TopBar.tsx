import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Bug, 
  Square, 
  Hammer, 
  Search, 
  Settings, 
  ChevronDown, 
  FolderGit2, 
  Minus, 
  Square as WindowSquare, 
  Copy,
  X,
  Layers,
  Sparkles,
  Menu,
  RotateCw,
  MoreVertical,
  Bell,
  User,
  ExternalLink,
  ChevronRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Folder,
  Coffee,
  Package,
  Terminal as TerminalIcon,
  FileCode,
  Flame
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { MenuDropdown } from './MenuDropdown';
import { menuRegistry } from '../constants/menuRegistry';
import { MenuCategoryName, MenuItem } from '../types/menu';
import { RunConfiguration } from '../types';

export interface RecentProjectItem {
  name: string;
  path: string;
}

interface TopBarProps {
  projectName: string;
  gitBranch: string;
  isRunning: boolean;
  recentProjects?: RecentProjectItem[];
  configurations?: RunConfiguration[];
  activeConfigId?: string | null;
  onSelectConfig?: (id: string) => void;
  onOpenEditConfigs?: () => void;
  onRun: () => void;
  onStop: () => void;
  onOpenSearch: () => void;
  onSelectMenuAction: (actionId: string) => void;
  onOpenProjectDialog?: () => void;
  onOpenBranches?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  projectName,
  gitBranch,
  isRunning,
  recentProjects = [],
  configurations = [],
  activeConfigId,
  onSelectConfig,
  onOpenEditConfigs,
  onRun,
  onStop,
  onOpenSearch,
  onSelectMenuAction,
  onOpenProjectDialog,
  onOpenBranches,
}) => {
  const [isMainMenuActive, setIsMainMenuActive] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuCategoryName | null>(null);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isRunConfigOpen, setIsRunConfigOpen] = useState(false);
  const [selectedRunTarget, setSelectedRunTarget] = useState('Current File');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const mainMenuRef = useRef<HTMLDivElement>(null);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const runConfigRef = useRef<HTMLDivElement>(null);

  const activeConfig = configurations.find(c => c.id === activeConfigId) || configurations[0];

  const renderConfigIcon = (type?: string) => {
    switch (type) {
      case 'spring-boot':
        return <Coffee size={12} className="text-[#59A869]" />;
      case 'maven':
        return <Package size={12} className="text-[#E05555]" />;
      case 'gradle':
        return <Flame size={12} className="text-[#3574F0]" />;
      case 'cargo':
        return <Package size={12} className="text-[#E08D3C]" />;
      case 'npm':
        return <TerminalIcon size={12} className="text-[#CB3837]" />;
      case 'python':
        return <FileCode size={12} className="text-[#3574F0]" />;
      default:
        return <span className="w-1.5 h-1.5 rounded-full bg-[#59A869]" />;
    }
  };

  const menus: MenuCategoryName[] = [
    'File', 'Edit', 'View', 'Navigate', 'Code', 'Refactor', 'Build', 'Run', 'Tools', 'Git', 'Help'
  ];

  const getMenuItems = (menu: MenuCategoryName): MenuItem[] => {
    const rawItems = menuRegistry[menu] || [];
    if (menu === 'File' && recentProjects.length > 0) {
      return rawItems.map(item => {
        if (item.id === 'f-recent') {
          return {
            ...item,
            children: [
              ...recentProjects.map((p, idx) => ({
                id: `recent-p-${idx}`,
                label: `${p.name} (${p.path})`,
                actionId: `file.openRecent:${p.path}`,
              })),
              { id: 'f-rec-sep', isSeparator: true },
              { id: 'f-rec-manage', label: 'Manage Projects...', actionId: 'file.manageProjects' },
            ]
          };
        }
        return item;
      });
    }
    return rawItems;
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mainMenuRef.current && !mainMenuRef.current.contains(e.target as Node)) {
        setIsMainMenuActive(false);
        setActiveMenu(null);
      }
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
      if (runConfigRef.current && !runConfigRef.current.contains(e.target as Node)) {
        setIsRunConfigOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMainMenuActive(false);
        setActiveMenu(null);
        setIsProjectDropdownOpen(false);
        setIsRunConfigOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const lastClickTimeRef = useRef<number>(0);
  const lastToggleRef = useRef<number>(0);

  // Window state initialization and dynamic resize tracking
  useEffect(() => {
    const updateMaximized = () => {
      invoke<boolean>('app_is_maximized').then(val => {
        if (typeof val === 'boolean') setIsMaximized(val);
      }).catch(() => {});
    };

    updateMaximized();
    window.addEventListener('resize', updateMaximized);
    return () => window.removeEventListener('resize', updateMaximized);
  }, []);

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('app_minimize_window');
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMaximize = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const now = Date.now();
    if (now - lastToggleRef.current < 350) {
      return;
    }
    lastToggleRef.current = now;

    try {
      const nowMax = await invoke<boolean>('app_toggle_maximize_window');
      setIsMaximized(nowMax);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('app_close_window');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      onSelectMenuAction('file.syncFiles');
    }, 600);
  };

  const handleMouseDownDrag = async (e: React.MouseEvent) => {
    // Only primary button (left click)
    if (e.button !== 0) return;

    const now = Date.now();
    const elapsed = now - lastClickTimeRef.current;
    lastClickTimeRef.current = now;

    // Detect double-click: either e.detail >= 2 or two clicks within 400ms
    if (e.detail >= 2 || elapsed < 400) {
      lastClickTimeRef.current = 0;
      handleToggleMaximize();
      return;
    }

    try {
      await invoke('app_start_dragging');
    } catch {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().startDragging();
      } catch (err) {
        console.error('Drag failed:', err);
      }
    }
  };

  return (
    <div 
      onDoubleClick={handleToggleMaximize}
      className="h-10 bg-[#1E1F22] border-b border-[#2B2D30] flex items-center justify-between pl-2 pr-0 select-none text-[12px] text-[#DFE1E5] relative z-40"
    >
      {/* ─── LEFT: [ID] Logo, Hamburger Toggle (expands 11 Menus), Project Widget, VCS Widget, Refresh ─── */}
      <div 
        className="flex items-center gap-1.5" 
        ref={mainMenuRef} 
        onMouseDown={(e) => e.stopPropagation()} 
        data-tauri-drag-region="false"
      >
        {/* IntelliJ ID Badge */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            setIsMainMenuActive(prev => {
              const next = !prev;
              setActiveMenu(next ? 'File' : null);
              return next;
            });
          }}
          className="w-7 h-7 rounded bg-[#2B2D30] border border-[#393B40] hover:border-[#4E5157] flex items-center justify-center cursor-pointer transition-colors shadow-inner flex-shrink-0"
          title="IntelliJ IDEA Menu"
        >
          <span className="font-extrabold text-[11px] text-[#62B543] tracking-tighter">ID</span>
        </div>

        {/* Hamburger Menu Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMainMenuActive(prev => {
              const next = !prev;
              setActiveMenu(next ? 'File' : null);
              return next;
            });
          }}
          title="Main Menu"
          className={`p-1.5 rounded transition-colors flex-shrink-0 ${
            isMainMenuActive ? 'bg-[#35373B] text-white' : 'hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5]'
          }`}
        >
          <Menu size={15} />
        </button>

        {/* When Hamburger is CLICKED / ACTIVE:
            Hide Project / VCS / Refresh, and show the 11 Menu categories inline horizontally! */}
        {isMainMenuActive ? (
          <div className="flex items-center ml-0.5 animate-in fade-in duration-75">
            {menus.map((menu) => {
              const isOpen = activeMenu === menu;
              return (
                <div key={menu} className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu(isOpen ? null : menu);
                    }}
                    onMouseEnter={() => {
                      if (activeMenu !== null) {
                        setActiveMenu(menu);
                      }
                    }}
                    className={`px-2.5 py-1 rounded text-[12px] font-normal transition-colors cursor-pointer select-none ${
                      isOpen ? 'bg-[#3574F0] text-white' : 'text-[#DFE1E5] hover:bg-[#2B2D30] hover:text-white'
                    }`}
                  >
                    {menu}
                  </button>

                  {/* Dropdown Menu directly below this category */}
                  {isOpen && (
                    <div className="absolute left-0 top-full mt-1 z-50">
                      <MenuDropdown
                        items={getMenuItems(menu)}
                        onSelectAction={(actionId) => {
                          onSelectMenuAction(actionId);
                          setActiveMenu(null);
                          setIsMainMenuActive(false);
                        }}
                        onClose={() => {
                          setActiveMenu(null);
                          setIsMainMenuActive(false);
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* When NOT interacting with menu: Normal state with Project, VCS, and Sync widgets */
          <div className="flex items-center gap-1.5 animate-in fade-in duration-100">
            {/* Project Selector Widget: [Folder] <projectName> ▾ */}
            <div className="relative" ref={projectDropdownRef}>
              <button
                onClick={() => setIsProjectDropdownOpen(prev => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#222427] hover:bg-[#2B2D30] border border-[#323438] text-[#DFE1E5] text-xs transition-colors cursor-pointer"
                title={`Active Project: ${projectName}`}
              >
                <Folder size={13} className="text-[#E5A83B] fill-[#E5A83B]/20 flex-shrink-0" />
                <span className="font-semibold text-white tracking-tight">{projectName}</span>
                <ChevronDown size={11} className="text-[#868A91]" />
              </button>

              {/* Project Switcher Dropdown */}
              {isProjectDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-72 bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl py-1 z-50 text-xs">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-[#868A91] tracking-wider border-b border-[#393B40]/50">
                    Recent Projects
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-[#393B40]/30">
                    {recentProjects.length > 0 ? (
                      recentProjects.map((p, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            onSelectMenuAction(`file.openRecent:${p.path}`);
                            setIsProjectDropdownOpen(false);
                          }}
                          className="px-3 py-2 hover:bg-[#35373B] cursor-pointer transition-colors"
                        >
                          <div className="font-semibold text-[#DFE1E5]">{p.name}</div>
                          <div className="text-[11px] text-[#868A91] font-mono truncate">{p.path}</div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-[#868A91] text-center">No recent projects</div>
                    )}
                  </div>
                  <div className="p-1 border-t border-[#393B40]/50">
                    <button
                      onClick={() => {
                        onOpenProjectDialog?.();
                        setIsProjectDropdownOpen(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-[#35373B] text-[#3574F0] font-medium"
                    >
                      Open or Create Project...
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Version Control / Branch Selector Widget */}
            <button
              onClick={() => {
                if (onOpenBranches) onOpenBranches();
                else onSelectMenuAction('git.branches');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#222427] hover:bg-[#2B2D30] border border-[#323438] text-xs text-[#DFE1E5] transition-colors cursor-pointer"
              title={`Git Branch: ${gitBranch} (Click to manage)`}
            >
              <FolderGit2 size={13} className="text-[#3574F0]" />
              <span className="font-medium">{gitBranch || 'Version Control'}</span>
              <ChevronDown size={11} className="text-[#868A91]" />
            </button>

            {/* VCS Quick Action Icons (Update Project, Commit, Push, Sync) */}
            <div className="flex items-center gap-0.5 ml-0.5">
              <button
                onClick={() => onSelectMenuAction('git.update')}
                className="p-1.5 rounded hover:bg-[#2B2D30] text-[#3574F0] hover:text-[#56A8F5] transition-colors cursor-pointer"
                title="Update Project (Ctrl+T)"
              >
                <ArrowDownToLine size={13} />
              </button>
              <button
                onClick={() => onSelectMenuAction('git.commit')}
                className="p-1.5 rounded hover:bg-[#2B2D30] text-[#3574F0] hover:text-[#56A8F5] transition-colors cursor-pointer"
                title="Commit (Ctrl+K)"
              >
                <Check size={13} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => onSelectMenuAction('git.push')}
                className="p-1.5 rounded hover:bg-[#2B2D30] text-[#3574F0] hover:text-[#56A8F5] transition-colors cursor-pointer"
                title="Push (Ctrl+Shift+K)"
              >
                <ArrowUpFromLine size={13} />
              </button>
              <button
                onClick={handleRefreshClick}
                className="p-1.5 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-white transition-colors cursor-pointer"
                title="Synchronize Files from Disk (Ctrl+Alt+Y)"
              >
                <RotateCw size={12} className={isRefreshing ? 'animate-spin text-[#3574F0]' : ''} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Draggable spacer Left-Center */}
      <div 
        onMouseDown={handleMouseDownDrag}
        onDoubleClick={handleToggleMaximize}
        className="flex-1 h-full min-w-[20px] cursor-default" 
      />

      {/* ─── CENTER: Centered Run / Debug Configuration Widget (New UI) ─── */}
      <div 
        className="flex items-center gap-1.5" 
        onMouseDown={(e) => e.stopPropagation()} 
        data-tauri-drag-region="false"
      >
        {/* Target Selector Pill */}
        <div className="relative" ref={runConfigRef}>
          <button
            onClick={() => setIsRunConfigOpen(prev => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#222427] hover:bg-[#2B2D30] border border-[#323438] rounded text-xs text-[#DFE1E5] transition-colors cursor-pointer"
            title="Edit Run/Debug Configurations"
          >
            {renderConfigIcon(activeConfig?.type)}
            <span className="text-[11px] font-medium max-w-[140px] truncate">
              {activeConfig ? activeConfig.name : selectedRunTarget}
            </span>
            <ChevronDown size={11} className="text-[#868A91]" />
          </button>

          {isRunConfigOpen && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-[#222427] border border-[#323438] rounded-lg shadow-2xl py-1 z-50 text-xs">
              {configurations.length > 0 ? (
                configurations.map((cfg) => {
                  const isSelected = cfg.id === (activeConfig?.id || activeConfigId);
                  return (
                    <div
                      key={cfg.id}
                      onClick={() => {
                        onSelectConfig?.(cfg.id);
                        setIsRunConfigOpen(false);
                      }}
                      className={`px-3 py-1.5 hover:bg-[#2B2D30] cursor-pointer flex items-center justify-between transition-colors ${
                        isSelected ? 'text-white font-medium bg-[#2B2D30]/70' : 'text-[#DFE1E5]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        {renderConfigIcon(cfg.type)}
                        <span className="truncate">{cfg.name}</span>
                      </div>
                      {isSelected && <span className="text-[#59A869] text-xs">✓</span>}
                    </div>
                  );
                })
              ) : (
                <>
                  <div 
                    onClick={() => { setSelectedRunTarget('Current File'); setIsRunConfigOpen(false); }}
                    className="px-3 py-1.5 hover:bg-[#2B2D30] cursor-pointer flex items-center justify-between"
                  >
                    <span>Current File</span>
                    {selectedRunTarget === 'Current File' && <span className="text-[#59A869]">✓</span>}
                  </div>
                  <div 
                    onClick={() => { setSelectedRunTarget(`${projectName} (Release)`); setIsRunConfigOpen(false); }}
                    className="px-3 py-1.5 hover:bg-[#2B2D30] cursor-pointer flex items-center justify-between"
                  >
                    <span>{projectName} (Release)</span>
                    {selectedRunTarget.includes('Release') && <span className="text-[#59A869]">✓</span>}
                  </div>
                </>
              )}
              <div className="border-t border-[#323438] my-1" />
              <div 
                onClick={() => { 
                  if (onOpenEditConfigs) onOpenEditConfigs();
                  else onSelectMenuAction('run.editConfig');
                  setIsRunConfigOpen(false); 
                }}
                className="px-3 py-1.5 hover:bg-[#2B2D30] text-[#3574F0] cursor-pointer font-medium flex items-center justify-between"
              >
                <span>Edit Configurations...</span>
                <span className="text-[10px] text-[#868A91]">Shift+Alt+F10</span>
              </div>
            </div>
          )}
        </div>

        {/* Build Hammer */}
        <button 
          onClick={() => onSelectMenuAction('build.rebuild')}
          title="Build Project (Ctrl+F9)"
          className="p-1.5 rounded hover:bg-[#2B2D30] text-[#DFE1E5] transition-colors cursor-pointer"
        >
          <Hammer size={14} />
        </button>

        {/* Run Button (Green Play Icon in New UI Pill) */}
        <button 
          onClick={onRun}
          title="Run 'Desktop IDE' (Shift+F10)"
          className={`p-1.5 rounded transition-colors flex items-center justify-center cursor-pointer ${
            isRunning ? 'opacity-50 cursor-not-allowed bg-[#2B2D30]' : 'hover:bg-[#2B2D30]'
          }`}
          disabled={isRunning}
        >
          <Play size={15} className="fill-[#59A869] text-[#59A869]" />
        </button>

        {/* Debug Button (Green Bug) */}
        <button 
          onClick={() => onSelectMenuAction('run.debug')}
          title="Debug 'Desktop IDE' (Shift+F9)"
          className="p-1.5 rounded hover:bg-[#2B2D30] text-[#59A869] transition-colors cursor-pointer"
        >
          <Bug size={15} />
        </button>

        {/* Stop Button */}
        <button 
          onClick={onStop}
          title="Stop (Ctrl+F2)"
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isRunning ? 'text-[#E05555] hover:bg-[#2B2D30]' : 'text-[#5A5D63] cursor-not-allowed'
          }`}
          disabled={!isRunning}
        >
          <Square size={13} className={isRunning ? 'fill-[#E05555]' : ''} />
        </button>

        {/* More Run Actions */}
        <button 
          onClick={() => onSelectMenuAction('run.editConfig')}
          title="More Run/Debug Actions"
          className="p-1.5 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
        >
          <MoreVertical size={13} />
        </button>
      </div>

      {/* Draggable spacer Center-Right */}
      <div 
        onMouseDown={handleMouseDownDrag}
        onDoubleClick={handleToggleMaximize}
        className="flex-1 h-full min-w-[20px] cursor-default" 
      />

      {/* ─── RIGHT: Search Everywhere, Code With Me, Settings & Window Buttons ─── */}
      <div 
        className="flex items-center gap-1" 
        onMouseDown={(e) => e.stopPropagation()} 
        data-tauri-drag-region="false"
      >
        {/* Search Everywhere (Double Shift) */}
        <button 
          onClick={onOpenSearch}
          title="Search Everywhere (Double Shift)"
          className="p-1.5 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
        >
          <Search size={14} />
        </button>

        {/* AI Assistant */}
        <button 
          onClick={() => onSelectMenuAction('view.aiAssistant')}
          title="AI Assistant (Alt+Enter)"
          className="p-1.5 rounded hover:bg-[#2B2D30] text-[#9876AA] hover:text-[#B388FF] transition-colors cursor-pointer"
        >
          <Sparkles size={14} />
        </button>

        {/* Settings Button (Ctrl+Alt+S) */}
        <button 
          onClick={() => onSelectMenuAction('file.settings')}
          title="Settings (Ctrl+Alt+S)"
          className="p-1.5 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
        >
          <Settings size={14} />
        </button>

        {/* Notifications Bell */}
        <button 
          onClick={() => onSelectMenuAction('view.notifications')}
          title="Notifications"
          className="p-1.5 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
        >
          <Bell size={14} />
        </button>

        {/* Edge-to-Edge Desktop Window Buttons */}
        <div className="flex items-center h-10 ml-2" data-tauri-drag-region="false">
          <button 
            onClick={handleMinimize}
            title="Minimize"
            className="w-11 h-10 flex items-center justify-center hover:bg-[#2B2D30] text-[#A1A3A8] hover:text-white transition-colors cursor-default"
          >
            <Minus size={13} />
          </button>
          <button 
            onClick={handleToggleMaximize}
            title={isMaximized ? "Restore Down" : "Maximize"}
            className="w-11 h-10 flex items-center justify-center hover:bg-[#2B2D30] text-[#A1A3A8] hover:text-white transition-colors cursor-default"
          >
            {isMaximized ? (
              <Copy size={12} className="rotate-90" />
            ) : (
              <WindowSquare size={12} />
            )}
          </button>
          <button 
            onClick={handleClose}
            title="Close (Alt+F4)"
            className="w-11 h-10 flex items-center justify-center hover:bg-[#E81123] hover:text-white text-[#A1A3A8] transition-colors cursor-default"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
