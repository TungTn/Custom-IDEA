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
  Palette,
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
  Flame,
  Shield,
  Activity,
  Pin,
  Crosshair,
  Sliders,
  AlertTriangle
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { MenuDropdown } from './MenuDropdown';
import { IntelliJHamburgerMenu } from './IntelliJHamburgerMenu';
import { menuRegistry, getFileMenuItems } from '../constants/menuRegistry';
import { MenuCategoryName, MenuItem } from '../types/menu';
import { GitBranchPopup } from '../features/git/GitBranchPopup';
import { RunConfiguration } from '../types';

export interface RecentProjectItem {
  name: string;
  path: string;
}

interface TopBarProps {
  projectName: string;
  gitBranch: string;
  isRunning: boolean;
  powerSaveMode?: boolean;
  isReadOnly?: boolean;
  fileEncoding?: string;
  lineEnding?: 'CRLF' | 'LF';
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
  activeRightPanel?: string | null;
  unreadNotificationsCount?: number;
  isBranchesOpen?: boolean;
  onCloseBranches?: () => void;
  currentProjectDirectory?: string;
  onSwitchBranch?: (branch: string) => void;
  onCreateBranch?: (branch: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onRefreshGitStatus?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  projectName,
  gitBranch,
  isRunning,
  powerSaveMode = false,
  isReadOnly = false,
  fileEncoding = 'UTF-8',
  lineEnding = 'CRLF',
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
  activeRightPanel,
  unreadNotificationsCount = 0,
  isBranchesOpen = false,
  onCloseBranches,
  currentProjectDirectory,
  onSwitchBranch,
  onCreateBranch,
  onShowToast,
  onRefreshGitStatus,
}) => {
  const [isMainMenuActive, setIsMainMenuActive] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuCategoryName | null>(null);
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1400
  );
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isRunConfigOpen, setIsRunConfigOpen] = useState(false);
  const [isMoreRunMenuOpen, setIsMoreRunMenuOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [selectedRunTarget, setSelectedRunTarget] = useState('Current File');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isConfirmExitOpen, setIsConfirmExitOpen] = useState(false);

  const mainMenuRef = useRef<HTMLDivElement>(null);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const runConfigRef = useRef<HTMLDivElement>(null);
  const moreRunMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Auto-collapse horizontal menus into Hamburger Menu when window is shrunk
  const isMenuCollapsed = windowWidth < 1250;

  useEffect(() => {
    const handleWindowResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

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
        return <TerminalIcon size={12} className="text-[#59A869]" />;
    }
  };

  const menus: MenuCategoryName[] = [
    'File', 'Edit', 'View', 'Navigate', 'Code', 'Refactor', 'Build', 'Run', 'Tools', 'Git', 'Window', 'Help'
  ];

  const getMenuItems = (menu: MenuCategoryName): MenuItem[] => {
    if (menu === 'File') {
      return getFileMenuItems({
        powerSaveMode,
        isReadOnly,
        fileEncoding,
        lineEnding,
        recentProjects,
      });
    }
    return menuRegistry[menu] || [];
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mainMenuRef.current && !mainMenuRef.current.contains(e.target as Node)) {
        setIsMainMenuActive(false);
        setActiveMenu(null);
        setIsHamburgerOpen(false);
      }
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
      if (runConfigRef.current && !runConfigRef.current.contains(e.target as Node)) {
        setIsRunConfigOpen(false);
      }
      if (moreRunMenuRef.current && !moreRunMenuRef.current.contains(e.target as Node)) {
        setIsMoreRunMenuOpen(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setIsSettingsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === '\\' || e.key === '|')) {
        e.preventDefault();
        setIsMainMenuActive(prev => {
          const next = !prev;
          setActiveMenu(next ? 'File' : null);
          return next;
        });
      } else if (e.key === 'Escape') {
        setIsMainMenuActive(false);
        setActiveMenu(null);
        setIsHamburgerOpen(false);
        setIsProjectDropdownOpen(false);
        setIsRunConfigOpen(false);
        setIsMoreRunMenuOpen(false);
        setIsSettingsMenuOpen(false);
      } else if (isMainMenuActive) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const currIdx = activeMenu ? menus.indexOf(activeMenu) : -1;
          const nextIdx = (currIdx + 1) % menus.length;
          setActiveMenu(menus[nextIdx]);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const currIdx = activeMenu ? menus.indexOf(activeMenu) : 0;
          const prevIdx = (currIdx - 1 + menus.length) % menus.length;
          setActiveMenu(menus[prevIdx]);
        }
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
    if (isRunning) {
      setIsConfirmExitOpen(true);
      return;
    }
    try {
      await invoke('app_close_window');
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmExit = async () => {
    setIsConfirmExitOpen(false);
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

  const projectInitials = React.useMemo(() => {
    const name = projectName || 'custom-idea';
    const parts = name.split(/[-_\s.]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [projectName]);

  return (
    <div 
      className="h-10 bg-[#1E1F22] border-b border-[#2B2D30] flex items-center justify-between pl-2 pr-0 select-none text-[12px] text-[#DFE1E5] relative z-40 w-full"
    >
      {/* ─── LEFT: Horizontal Menu Bar when active, or [≡] + [MP] + [Git] + [↻] when collapsed ─── */}
      <div 
        className="flex items-center gap-1 min-w-0 flex-shrink-0" 
        ref={mainMenuRef} 
        onMouseDown={(e) => e.stopPropagation()} 
        onDoubleClick={(e) => e.stopPropagation()}
        data-tauri-drag-region="false"
      >
        {/* Main Menu Hamburger Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMainMenuActive(prev => {
              const next = !prev;
              setActiveMenu(next ? 'File' : null);
              return next;
            });
            setIsHamburgerOpen(false);
          }}
          title="Main Menu (Alt+\)"
          className={`p-1.5 rounded transition-colors flex-shrink-0 cursor-pointer ${
            isMainMenuActive
              ? 'bg-[#35373B] text-white' 
              : 'hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5]'
          }`}
        >
          <Menu size={16} />
        </button>

        {/* When Main Menu is active: Show Horizontal Menu Bar (File, Edit, View, ... Help) exactly like IntelliJ */}
        {isMainMenuActive ? (
          <div className="flex items-center gap-0.5 animate-in fade-in duration-75">
            {menus.map((menu) => (
              <div key={menu} className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeMenu === menu) {
                      setActiveMenu(null);
                      setIsMainMenuActive(false);
                    } else {
                      setActiveMenu(menu);
                    }
                  }}
                  onMouseEnter={() => {
                    if (isMainMenuActive) {
                      setActiveMenu(menu);
                    }
                  }}
                  className={`px-2.5 py-1 text-[12px] rounded transition-colors cursor-pointer select-none ${
                    activeMenu === menu
                      ? 'bg-[#35373B] text-white font-medium shadow-sm'
                      : 'text-[#DFE1E5] hover:bg-[#2B2D30] hover:text-white font-normal'
                  }`}
                >
                  {menu}
                </button>

                {activeMenu === menu && (
                  <MenuDropdown
                    items={getMenuItems(menu)}
                    onSelectAction={(actionId) => {
                      onSelectMenuAction(actionId);
                      setIsMainMenuActive(false);
                      setActiveMenu(null);
                    }}
                    onClose={() => {
                      setIsMainMenuActive(false);
                      setActiveMenu(null);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Normal Collapsed State: [MP mic-fe-personal ▼] [Git Branch ▼] [↻ Sync] */
          <>
            {/* Project Selector Widget: [MP] mic-fe-personal ▼ */}
            <div className="relative" ref={projectDropdownRef}>
              <button
                onClick={() => setIsProjectDropdownOpen(prev => !prev)}
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#2B2D30] transition-colors cursor-pointer group"
                title={`Active Project: ${projectName || 'Untitled'} (Click to switch project)`}
              >
                <span className="w-5 h-5 rounded bg-[#E58A2B] text-white flex items-center justify-center font-bold text-[10px] shadow-sm flex-shrink-0">
                  {projectInitials}
                </span>
                <span className="text-[12px] font-semibold text-[#DFE1E5] max-w-[170px] truncate">
                  {projectName || 'custom-idea'}
                </span>
                <ChevronDown size={11} className="text-[#868A91] group-hover:text-[#DFE1E5]" />
              </button>

              {isProjectDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl py-1 z-50 text-xs text-[#DFE1E5] animate-in fade-in duration-100">
                  <div className="px-3 py-1 text-[10px] uppercase font-semibold text-[#868A91] border-b border-[#393B40]">
                    Recent Projects
                  </div>
                  <div className="py-1 max-h-48 overflow-y-auto">
                    {recentProjects.length > 0 ? (
                      recentProjects.map((p) => (
                        <div
                          key={p.path}
                          onClick={() => {
                            setIsProjectDropdownOpen(false);
                            onSelectMenuAction('file.openRecent');
                          }}
                          className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <span className="truncate">{p.name}</span>
                          {p.name === projectName && <Check size={12} className="text-[#59A869]" />}
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-1.5 text-xs text-[#868A91] italic">
                        {projectName || 'Current Project'}
                      </div>
                    )}
                  </div>
                  <div className="border-t border-[#393B40] my-1" />
                  <div
                    onClick={() => {
                      setIsProjectDropdownOpen(false);
                      if (onOpenProjectDialog) onOpenProjectDialog();
                      else onSelectMenuAction('file.open');
                    }}
                    className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer text-[#56A8F5] transition-colors"
                  >
                    Open Project...
                  </div>
                </div>
              )}
            </div>

            {/* Git Branch Widget: [FolderGit2] feature/personal-tungtn ▼ (Matching IntelliJ New UI) */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isBranchesOpen) {
                    if (onCloseBranches) onCloseBranches();
                  } else {
                    if (onOpenBranches) onOpenBranches();
                    else onSelectMenuAction('git.branches');
                  }
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors cursor-pointer group ${
                  isBranchesOpen ? 'bg-[#35373B] text-white' : 'hover:bg-[#2B2D30] text-[#DFE1E5]'
                }`}
                title={`Current Git Branch: ${gitBranch || 'main'} (Click to switch or create branch)`}
              >
                <FolderGit2 size={13} className="text-[#3574F0] flex-shrink-0" />
                <span className="text-[12px] font-normal text-[#DFE1E5] max-w-[170px] truncate">
                  {gitBranch || 'main'}
                </span>
                <ChevronDown size={11} className={`text-[#868A91] group-hover:text-[#DFE1E5] transition-transform ${isBranchesOpen ? 'rotate-180 text-[#DFE1E5]' : ''}`} />
              </button>

              {isBranchesOpen && (
                <GitBranchPopup
                  isOpen={isBranchesOpen}
                  onClose={() => {
                    if (onCloseBranches) onCloseBranches();
                  }}
                  currentBranch={gitBranch || 'main'}
                  projectPath={currentProjectDirectory}
                  onSwitchBranch={(b) => {
                    if (onSwitchBranch) onSwitchBranch(b);
                  }}
                  onCreateBranch={(b) => {
                    if (onCreateBranch) onCreateBranch(b);
                  }}
                  onShowToast={onShowToast}
                  onRefreshGitStatus={onRefreshGitStatus}
                />
              )}
            </div>

            {/* Reload / Sync All from Disk (Ctrl+Alt+Y) */}
            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              title="Reload All from Disk (Ctrl+Alt+Y)"
              className={`p-1.5 rounded transition-all cursor-pointer ${
                isRefreshing 
                  ? 'bg-[#3574F0]/20 text-[#3574F0]' 
                  : 'hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5]'
              }`}
            >
              <RotateCw size={13} className={isRefreshing ? 'animate-spin text-[#3574F0]' : ''} />
            </button>
          </>
        )}
      </div>

      {/* Draggable spacer Left-Center */}
      <div 
        onMouseDown={handleMouseDownDrag}
        onDoubleClick={handleToggleMaximize}
        className="flex-1 h-full min-w-[8px] cursor-default" 
      />

      {/* ─── CENTER: Centered Run / Debug Configuration Widget (New UI) ─── */}
      <div 
        className="flex items-center gap-1.5 flex-shrink min-w-0" 
        onMouseDown={(e) => e.stopPropagation()} 
        onDoubleClick={(e) => e.stopPropagation()}
        data-tauri-drag-region="false"
      >
        {/* Target Selector Pill */}
        <div className="relative" ref={runConfigRef}>
          <button
            onClick={() => setIsRunConfigOpen(prev => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 bg-[#222427] hover:bg-[#2B2D30] border ${
              isRunning ? 'border-[#59A869]/60 shadow-[0_0_8px_rgba(89,168,105,0.18)]' : 'border-[#323438]'
            } rounded text-xs text-[#DFE1E5] transition-all cursor-pointer`}
            title="Edit Run/Debug Configurations"
          >
            {/* Live Process Execution Indicator */}
            {isRunning && (
              <span className="relative flex h-2 w-2 mr-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#59A869] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#59A869]"></span>
              </span>
            )}
            {renderConfigIcon(activeConfig?.type)}
            <span className="text-[11px] font-medium max-w-[100px] sm:max-w-[140px] md:max-w-[180px] lg:max-w-[220px] truncate">
              {projectName 
                ? (activeConfig ? `${projectName} (${activeConfig.name})` : projectName) 
                : (activeConfig ? activeConfig.name : selectedRunTarget)}
            </span>
            <ChevronDown size={11} className="text-[#868A91]" />
          </button>

          {isRunConfigOpen && (
            <div className="absolute left-0 top-full mt-1 w-64 bg-[#222427] border border-[#393B40] rounded-lg shadow-2xl py-1 z-50 text-xs">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[#868A91] font-semibold">
                Run Configurations
              </div>
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
                      {isSelected && <span className="text-[#59A869] text-xs font-bold">✓</span>}
                    </div>
                  );
                })
              ) : (
                <>
                  <div 
                    onClick={() => { setSelectedRunTarget('Current File'); setIsRunConfigOpen(false); }}
                    className="px-3 py-1.5 hover:bg-[#2B2D30] cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <TerminalIcon size={12} className="text-[#59A869]" />
                      <span>Current File</span>
                    </div>
                    {selectedRunTarget === 'Current File' && <span className="text-[#59A869]">✓</span>}
                  </div>
                  <div 
                    onClick={() => { setSelectedRunTarget(`${projectName} (Release)`); setIsRunConfigOpen(false); }}
                    className="px-3 py-1.5 hover:bg-[#2B2D30] cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Package size={12} className="text-[#E08D3C]" />
                      <span>{projectName} (Release)</span>
                    </div>
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
                className="px-3 py-1.5 hover:bg-[#2B2D30] text-[#3574F0] cursor-pointer font-medium flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sliders size={13} className="text-[#3574F0]" />
                  <span>Edit Configurations...</span>
                </div>
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

        {/* Run Button (Green Play Icon) */}
        <button 
          onClick={onRun}
          title={isRunning ? `Rerun '${projectName || 'Project'}' (Shift+F10)` : `Run '${projectName || 'Project'}' (Shift+F10)`}
          className="p-1.5 rounded hover:bg-[#2B2D30] transition-colors flex items-center justify-center cursor-pointer group"
        >
          <Play size={15} className="fill-[#59A869] text-[#59A869] group-hover:scale-105 transition-transform" />
        </button>

        {/* Debug Button (Green Bug) */}
        <button 
          onClick={() => onSelectMenuAction('run.debug')}
          title={`Debug '${projectName || 'Project'}' (Shift+F9)`}
          className="p-1.5 rounded hover:bg-[#2B2D30] text-[#59A869] transition-colors cursor-pointer group"
        >
          <Bug size={15} className="group-hover:scale-105 transition-transform" />
        </button>

        {/* Run with Coverage (Shield Icon) */}
        <button 
          onClick={() => onSelectMenuAction('run.coverage')}
          title={`Run '${projectName || 'Project'}' with Coverage`}
          className="p-1.5 rounded hover:bg-[#2B2D30] text-[#59A869] transition-colors cursor-pointer group"
        >
          <Shield size={14} className="fill-[#59A869]/20 group-hover:scale-105 transition-transform" />
        </button>

        {/* Stop Button */}
        <button 
          onClick={onStop}
          title={isRunning ? "Stop (Ctrl+F2)" : "Stop (Not running)"}
          className={`p-1.5 rounded transition-colors ${
            isRunning ? 'text-[#E05555] hover:bg-[#2B2D30] cursor-pointer' : 'text-[#5A5D63] cursor-not-allowed opacity-60'
          }`}
          disabled={!isRunning}
        >
          <Square size={13} className={isRunning ? 'fill-[#E05555]' : ''} />
        </button>

        {/* More Run Actions Dropdown */}
        <div className="relative" ref={moreRunMenuRef}>
          <button 
            onClick={() => setIsMoreRunMenuOpen(prev => !prev)}
            title="More Run/Debug Actions"
            className={`p-1.5 rounded hover:bg-[#2B2D30] transition-colors cursor-pointer ${
              isMoreRunMenuOpen ? 'bg-[#2B2D30] text-[#DFE1E5]' : 'text-[#868A91] hover:text-[#DFE1E5]'
            }`}
          >
            <MoreVertical size={13} />
          </button>

          {isMoreRunMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-[#222427] border border-[#393B40] rounded-lg shadow-2xl py-1 z-50 text-xs">
              {/* Edit Configurations... */}
              <div 
                onClick={() => {
                  setIsMoreRunMenuOpen(false);
                  if (onOpenEditConfigs) onOpenEditConfigs();
                  else onSelectMenuAction('run.editConfig');
                }}
                className="px-3 py-1.5 hover:bg-[#2B2D30] text-[#DFE1E5] cursor-pointer flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sliders size={13} className="text-[#868A91]" />
                  <span>Edit Configurations...</span>
                </div>
                <span className="text-[10px] text-[#868A91]">Shift+Alt+F10</span>
              </div>

              {/* Run with Coverage */}
              <div 
                onClick={() => {
                  setIsMoreRunMenuOpen(false);
                  onSelectMenuAction('run.coverage');
                }}
                className="px-3 py-1.5 hover:bg-[#2B2D30] text-[#DFE1E5] cursor-pointer flex items-center gap-2 transition-colors"
              >
                <Shield size={13} className="text-[#59A869]" />
                <span>Run with Coverage</span>
              </div>

              {/* Profile Application */}
              <div 
                onClick={() => {
                  setIsMoreRunMenuOpen(false);
                  onSelectMenuAction('run.profile');
                }}
                className="px-3 py-1.5 hover:bg-[#2B2D30] text-[#DFE1E5] cursor-pointer flex items-center gap-2 transition-colors"
              >
                <Activity size={13} className="text-[#3574F0]" />
                <span>Profile '{projectName || 'Application'}'</span>
              </div>

              {/* Stop Background Processes */}
              <div 
                onClick={() => {
                  setIsMoreRunMenuOpen(false);
                  if (isRunning) onStop();
                }}
                className={`px-3 py-1.5 flex items-center justify-between transition-colors ${
                  isRunning ? 'hover:bg-[#2B2D30] text-[#DFE1E5] cursor-pointer' : 'text-[#6C707E] cursor-not-allowed opacity-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Square size={13} className={isRunning ? 'text-[#E05555] fill-[#E05555]' : 'text-[#6C707E]'} />
                  <span>Stop Background Processes</span>
                </div>
                <span className="text-[10px] text-[#868A91]">Ctrl+F2</span>
              </div>

              <div className="border-t border-[#323438] my-1" />

              {/* Pin Run Console Tab */}
              <div 
                onClick={() => {
                  setIsMoreRunMenuOpen(false);
                  onSelectMenuAction('run.pinTab');
                }}
                className="px-3 py-1.5 hover:bg-[#2B2D30] text-[#DFE1E5] cursor-pointer flex items-center gap-2 transition-colors"
              >
                <Pin size={13} className="text-[#868A91]" />
                <span>Pin Run Console Tab</span>
              </div>

              {/* Show Execution Point */}
              <div 
                onClick={() => {
                  setIsMoreRunMenuOpen(false);
                  onSelectMenuAction('run.showExecutionPoint');
                }}
                className="px-3 py-1.5 hover:bg-[#2B2D30] text-[#DFE1E5] cursor-pointer flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Crosshair size={13} className="text-[#868A91]" />
                  <span>Show Execution Point</span>
                </div>
                <span className="text-[10px] text-[#868A91]">Alt+F10</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Draggable spacer Center-Right */}
      <div 
        onMouseDown={handleMouseDownDrag}
        onDoubleClick={handleToggleMaximize}
        className="flex-1 h-full min-w-[8px] cursor-default" 
      />

      {/* ─── RIGHT: Search Everywhere, Code With Me, Settings & Window Buttons ─── */}
      <div 
        className="flex items-center gap-1 flex-shrink-0" 
        onMouseDown={(e) => e.stopPropagation()} 
        onDoubleClick={(e) => e.stopPropagation()}
        data-tauri-drag-region="false"
      >
        {/* JetBrains Account Profile */}
        <button 
          onClick={() => onSelectMenuAction('help.about')}
          title="JetBrains Account & Profile"
          className="p-1.5 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
        >
          <User size={14} />
        </button>

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
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            activeRightPanel === 'ai' 
              ? 'bg-[#2B2D30] text-[#B388FF]' 
              : 'hover:bg-[#2B2D30] text-[#9876AA] hover:text-[#B388FF]'
          }`}
        >
          <Sparkles size={14} />
        </button>

        {/* Quick Settings Dropdown (Ctrl+Alt+S) */}
        <div className="relative" ref={settingsMenuRef}>
          <button 
            onClick={() => setIsSettingsMenuOpen(prev => !prev)}
            title="Settings (Ctrl+Alt+S)"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isSettingsMenuOpen 
                ? 'bg-[#2B2D30] text-[#DFE1E5]' 
                : 'hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5]'
            }`}
          >
            <Settings size={14} />
          </button>

          {isSettingsMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-60 bg-[#222427] border border-[#393B40] rounded-lg shadow-2xl py-1 z-50 text-xs">
              <div 
                onClick={() => {
                  setIsSettingsMenuOpen(false);
                  onSelectMenuAction('file.settings');
                }}
                className="px-3 py-1.5 hover:bg-[#2B2D30] text-[#DFE1E5] cursor-pointer flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings size={13} className="text-[#868A91]" />
                  <span>Settings...</span>
                </div>
                <span className="text-[10px] text-[#868A91]">Ctrl+Alt+S</span>
              </div>

              <div 
                onClick={() => {
                  setIsSettingsMenuOpen(false);
                  onSelectMenuAction('tools.plugins');
                }}
                className="px-3 py-1.5 hover:bg-[#2B2D30] text-[#DFE1E5] cursor-pointer flex items-center gap-2 transition-colors"
              >
                <Package size={13} className="text-[#868A91]" />
                <span>Plugins...</span>
              </div>

              <div 
                onClick={() => {
                  setIsSettingsMenuOpen(false);
                  onSelectMenuAction('help.keymap');
                }}
                className="px-3 py-1.5 hover:bg-[#2B2D30] text-[#DFE1E5] cursor-pointer flex items-center gap-2 transition-colors"
              >
                <FileCode size={13} className="text-[#868A91]" />
                <span>Keymap Reference...</span>
              </div>

              <div className="border-t border-[#323438] my-1" />

              <div 
                onClick={() => {
                  setIsSettingsMenuOpen(false);
                  onSelectMenuAction('tools.themeStudio');
                }}
                className="px-3 py-1.5 hover:bg-[#2B2D30] text-[#DFE1E5] cursor-pointer flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-[#868A91]" />
                  <span>Theme Studio & Schemes...</span>
                </div>
                <span className="text-[#59A869] text-xs font-bold">✓</span>
              </div>

              <div 
                onClick={() => {
                  setIsSettingsMenuOpen(false);
                  handleToggleMaximize();
                }}
                className="px-3 py-1.5 hover:bg-[#2B2D30] text-[#DFE1E5] cursor-pointer flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <WindowSquare size={13} className="text-[#868A91]" />
                  <span>{isMaximized ? 'Exit Full Screen' : 'Enter Full Screen'}</span>
                </div>
                <span className="text-[10px] text-[#868A91]">F11</span>
              </div>

              <div className="border-t border-[#323438] my-1" />

              <div 
                onClick={() => {
                  setIsSettingsMenuOpen(false);
                  onSelectMenuAction('help.checkUpdates');
                }}
                className="px-3 py-1.5 hover:bg-[#2B2D30] text-[#DFE1E5] cursor-pointer flex items-center gap-2 transition-colors"
              >
                <RotateCw size={13} className="text-[#868A91]" />
                <span>Check for Updates...</span>
              </div>

              <div 
                onClick={() => {
                  setIsSettingsMenuOpen(false);
                  onSelectMenuAction('help.about');
                }}
                className="px-3 py-1.5 hover:bg-[#2B2D30] text-[#DFE1E5] cursor-pointer flex items-center gap-2 transition-colors"
              >
                <span className="text-[10px] font-bold text-[#62B543]">ID</span>
                <span>About IntelliJ IDEA</span>
              </div>
            </div>
          )}
        </div>

        {/* Notifications Bell */}
        <button 
          onClick={() => onSelectMenuAction('view.notifications')}
          title={unreadNotificationsCount > 0 ? `Notifications (${unreadNotificationsCount} unread)` : "Notifications"}
          className={`p-1.5 rounded transition-colors cursor-pointer relative ${
            activeRightPanel === 'notifications' 
              ? 'bg-[#2B2D30] text-[#DFE1E5]' 
              : 'hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5]'
          }`}
        >
          <Bell size={14} />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#3574F0] ring-2 ring-[#1E1F22] animate-pulse" />
          )}
        </button>

        {/* Edge-to-Edge Desktop Window Buttons */}
        <div className="flex items-center h-10 ml-2" data-tauri-drag-region="false" onDoubleClick={(e) => e.stopPropagation()}>
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
      {/* Confirm Exit Modal */}
      {isConfirmExitOpen && (
        <div 
          className="fixed inset-0 bg-black/65 backdrop-blur-[2px] flex items-center justify-center z-[100] select-none text-[12.5px]"
          onClick={() => setIsConfirmExitOpen(false)}
        >
          <div 
            className="w-[440px] bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl overflow-hidden flex flex-col text-[#DFE1E5]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-9 bg-[#26282B] border-b border-[#393B40] flex items-center justify-between px-3.5 flex-shrink-0">
              <span className="font-medium text-[#DFE1E5]">Confirm Exit</span>
              <button 
                onClick={() => setIsConfirmExitOpen(false)} 
                className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#E05555]/15 text-[#E05555] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle size={18} />
                </div>
                <div className="space-y-1">
                  <div className="font-medium text-[#DFE1E5]">Processes are still running.</div>
                  <div className="text-[#868A91] text-[12px] leading-relaxed">
                    A background build or run process is still active. If you exit now, running processes will be terminated.
                  </div>
                </div>
              </div>
            </div>
            <div className="h-11 bg-[#26282B] border-t border-[#393B40] flex items-center justify-end px-3.5 gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsConfirmExitOpen(false)}
                className="px-3 py-1.5 hover:bg-[#35373B] text-[#DFE1E5] rounded text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="px-4 py-1.5 bg-[#E05555] hover:bg-[#C74040] text-white rounded text-xs font-medium transition-colors cursor-pointer shadow-sm"
              >
                Terminate and Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
