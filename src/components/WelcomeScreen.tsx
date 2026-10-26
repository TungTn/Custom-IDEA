import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Plus, 
  FolderOpen, 
  GitBranch, 
  Search, 
  X, 
  Settings as SettingsIcon, 
  Sliders, 
  Puzzle, 
  BookOpen, 
  Globe, 
  Layers, 
  Minus, 
  Square as WindowSquare, 
  Copy, 
  Folder, 
  ChevronRight, 
  Check, 
  Terminal, 
  HelpCircle,
  ExternalLink,
  Code2,
  Cpu,
  Monitor
} from 'lucide-react';
import { RecentProjectItem } from './TopBar';
import { IdeSettings } from './SettingsModal';

interface WelcomeScreenProps {
  recentProjects: RecentProjectItem[];
  onOpenProject: () => void;
  onOpenRecentProject: (path: string) => void;
  onRemoveRecentProject: (path: string) => void;
  onNewProject: () => void;
  onCloneVcs: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onOpenTip: () => void;
  settings: IdeSettings;
  onUpdateSettings: (settings: IdeSettings) => void;
  onShowToast: (title: string, message?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

type WelcomeTab = 'projects' | 'remote' | 'customize' | 'plugins' | 'learn';

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  recentProjects,
  onOpenProject,
  onOpenRecentProject,
  onRemoveRecentProject,
  onNewProject,
  onCloneVcs,
  onOpenSettings,
  onOpenAbout,
  onOpenTip,
  settings,
  onUpdateSettings,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<WelcomeTab>('projects');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isGearMenuOpen, setIsGearMenuOpen] = useState(false);
  const gearMenuRef = useRef<HTMLDivElement>(null);

  // Plugin state for Welcome screen plugins tab
  const [pluginSearch, setPluginSearch] = useState('');
  const [installedPlugins, setInstalledPlugins] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('intellij_installed_plugins');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return ['Rust', 'Python Community Edition', 'GitToolBox'];
  });

  // Track window maximization
  useEffect(() => {
    const updateMax = () => {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        invoke<boolean>('app_is_maximized').then(val => {
          if (typeof val === 'boolean') setIsMaximized(val);
        }).catch(() => {});
      }
    };
    updateMax();
    window.addEventListener('resize', updateMax);
    return () => window.removeEventListener('resize', updateMax);
  }, []);

  // Close gear menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (gearMenuRef.current && !gearMenuRef.current.contains(e.target as Node)) {
        setIsGearMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseDownDrag = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('app_start_dragging');
      }
    } catch (err) {
      console.warn(err);
    }
  };

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

  const togglePlugin = (name: string) => {
    setInstalledPlugins(prev => {
      const exists = prev.includes(name);
      const next = exists ? prev.filter(p => p !== name) : [...prev, name];
      try {
        localStorage.setItem('intellij_installed_plugins', JSON.stringify(next));
      } catch (e) {}
      onShowToast(exists ? 'Plugin Uninstalled' : 'Plugin Installed', `${name} ${exists ? 'removed' : 'installed'}`, 'info');
      return next;
    });
  };

  const filteredProjects = recentProjects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availablePlugins = [
    { name: 'Rust', desc: 'Rust language support with Cargo integration, syntax analysis and debugging.', author: 'JetBrains', downloads: '14.2M' },
    { name: 'Python Community Edition', desc: 'Python code assistance, inspections, and debugger.', author: 'JetBrains', downloads: '28.1M' },
    { name: 'GitToolBox', desc: 'Inline blame annotations, status bar git status, ahead/behind tracking.', author: 'Lukasz', downloads: '9.8M' },
    { name: 'Rainbow Brackets', desc: 'Color matching brackets and parentheses for visual clarity.', author: 'izhangzhihao', downloads: '18.4M' },
    { name: 'Docker', desc: 'Docker container management, compose runner and Dockerfile support.', author: 'JetBrains', downloads: '12.6M' },
    { name: 'Markdown', desc: 'Markdown document viewer, live editor preview and table formatters.', author: 'JetBrains', downloads: '25.0M' },
    { name: 'Database Tools and SQL', desc: 'Smart SQL editor, schema explorer, database connections.', author: 'JetBrains', downloads: '19.3M' },
    { name: 'Lombok', desc: 'Annotation processing for Java bytecode generation.', author: 'JetBrains', downloads: '15.9M' },
  ].filter(p => p.name.toLowerCase().includes(pluginSearch.toLowerCase()) || p.desc.toLowerCase().includes(pluginSearch.toLowerCase()));

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1E1F22] text-[#DFE1E5] select-none font-sans overflow-hidden">
      {/* IntelliJ Window Title Bar */}
      <div 
        onMouseDown={handleMouseDownDrag}
        onDoubleClick={handleToggleMaximize}
        className="h-10 bg-[#1E1F22] border-b border-[#2B2D30] flex items-center justify-between px-3 select-none flex-shrink-0 cursor-default"
      >
        {/* Left: JetBrains IntelliJ Logo & App Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-gradient-to-tr from-[#F93570] via-[#FC801D] to-[#21D789] flex items-center justify-center p-[2px] shadow-sm">
            <div className="w-full h-full bg-[#1E1F22] rounded-[2px] flex items-center justify-center text-[9px] font-black tracking-tighter text-white">
              IJ
            </div>
          </div>
          <span className="text-xs font-semibold text-[#DFE1E5] tracking-tight">
            Welcome to IntelliJ IDEA
          </span>
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-center h-full -mr-3" onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={handleMinimize}
            className="w-11 h-full flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30] transition-colors"
            title="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={handleToggleMaximize}
            className="w-11 h-full flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30] transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Copy size={12} className="rotate-180" /> : <WindowSquare size={12} />}
          </button>
          <button
            onClick={handleClose}
            className="w-11 h-full flex items-center justify-center text-[#868A91] hover:text-white hover:bg-[#E05555] transition-colors"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 bg-[#1E1F22] border-r border-[#2B2D30] flex flex-col justify-between p-3 flex-shrink-0 select-none">
          <div className="flex flex-col gap-6">
            {/* Logo & Product Heading */}
            <div className="px-2 pt-2 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-[#F93570] via-[#FC801D] to-[#21D789] p-[2.5px] shadow-md flex-shrink-0">
                <div className="w-full h-full bg-[#1E1F22] rounded-[6px] flex items-center justify-center text-sm font-black text-white tracking-tighter">
                  IJ
                </div>
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-bold text-sm text-white tracking-tight">IntelliJ IDEA</span>
                <span className="text-[11px] text-[#868A91]">2024.3 (New UI)</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex flex-col gap-1">
              <button
                onClick={() => setActiveTab('projects')}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                  activeTab === 'projects'
                    ? 'bg-[#2B2D30] text-white font-semibold'
                    : 'text-[#868A91] hover:bg-[#2B2D30]/60 hover:text-[#DFE1E5]'
                }`}
              >
                <Layers size={16} className={activeTab === 'projects' ? 'text-[#3574F0]' : 'text-[#868A91]'} />
                <span>Projects</span>
              </button>

              <button
                onClick={() => setActiveTab('remote')}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                  activeTab === 'remote'
                    ? 'bg-[#2B2D30] text-white font-semibold'
                    : 'text-[#868A91] hover:bg-[#2B2D30]/60 hover:text-[#DFE1E5]'
                }`}
              >
                <Globe size={16} className={activeTab === 'remote' ? 'text-[#3574F0]' : 'text-[#868A91]'} />
                <span>Remote Development</span>
              </button>

              <button
                onClick={() => setActiveTab('customize')}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                  activeTab === 'customize'
                    ? 'bg-[#2B2D30] text-white font-semibold'
                    : 'text-[#868A91] hover:bg-[#2B2D30]/60 hover:text-[#DFE1E5]'
                }`}
              >
                <Sliders size={16} className={activeTab === 'customize' ? 'text-[#3574F0]' : 'text-[#868A91]'} />
                <span>Customize</span>
              </button>

              <button
                onClick={() => setActiveTab('plugins')}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                  activeTab === 'plugins'
                    ? 'bg-[#2B2D30] text-white font-semibold'
                    : 'text-[#868A91] hover:bg-[#2B2D30]/60 hover:text-[#DFE1E5]'
                }`}
              >
                <Puzzle size={16} className={activeTab === 'plugins' ? 'text-[#3574F0]' : 'text-[#868A91]'} />
                <span>Plugins</span>
              </button>

              <button
                onClick={() => setActiveTab('learn')}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                  activeTab === 'learn'
                    ? 'bg-[#2B2D30] text-white font-semibold'
                    : 'text-[#868A91] hover:bg-[#2B2D30]/60 hover:text-[#DFE1E5]'
                }`}
              >
                <BookOpen size={16} className={activeTab === 'learn' ? 'text-[#3574F0]' : 'text-[#868A91]'} />
                <span>Learn IntelliJ IDEA</span>
              </button>
            </nav>
          </div>

          {/* Bottom Gear / Settings Menu */}
          <div className="relative" ref={gearMenuRef}>
            {isGearMenuOpen && (
              <div className="absolute bottom-11 left-0 bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 w-48 text-xs z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => { setIsGearMenuOpen(false); onOpenSettings(); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between"
                >
                  <span>Settings...</span>
                  <span className="text-[10px] text-[#868A91]">Ctrl+Alt+S</span>
                </button>
                <button
                  onClick={() => { setIsGearMenuOpen(false); setActiveTab('plugins'); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3574F0] hover:text-white"
                >
                  Plugins
                </button>
                <div className="h-px bg-[#393B40] my-1" />
                <button
                  onClick={() => { setIsGearMenuOpen(false); onOpenTip(); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3574F0] hover:text-white"
                >
                  Tip of the Day
                </button>
                <button
                  onClick={() => { setIsGearMenuOpen(false); onOpenAbout(); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#3574F0] hover:text-white"
                >
                  About IntelliJ IDEA
                </button>
              </div>
            )}
            <button
              onClick={() => setIsGearMenuOpen(prev => !prev)}
              className="p-2 text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30] rounded-md transition-colors flex items-center gap-2 text-xs"
              title="Settings and Options"
            >
              <SettingsIcon size={16} />
              <span>Options</span>
            </button>
          </div>
        </div>

        {/* Right Main Content Area */}
        <div className="flex-1 flex flex-col bg-[#1E1F22] overflow-hidden">
          {/* TAB 1: PROJECTS */}
          {activeTab === 'projects' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header Action Bar */}
              <div className="h-16 px-8 border-b border-[#2B2D30] flex items-center justify-between gap-4 flex-shrink-0">
                {/* Search Bar */}
                <div className="relative w-80">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#868A91]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] focus:outline-none rounded-md pl-9 pr-8 py-1.5 text-xs text-[#DFE1E5] placeholder-[#868A91]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#868A91] hover:text-[#DFE1E5]"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Top Action Buttons (New Project, Open, Get from VCS) */}
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={onNewProject}
                    className="flex items-center gap-2 px-4 py-1.5 bg-[#3574F0] hover:bg-[#3064D0] text-white rounded-md text-xs font-medium shadow-sm transition-colors"
                  >
                    <Plus size={15} />
                    <span>New Project</span>
                  </button>

                  <button
                    onClick={onOpenProject}
                    className="flex items-center gap-2 px-4 py-1.5 bg-[#2B2D30] hover:bg-[#393B40] text-[#DFE1E5] border border-[#393B40] rounded-md text-xs font-medium transition-colors"
                  >
                    <FolderOpen size={15} />
                    <span>Open</span>
                  </button>

                  <button
                    onClick={onCloneVcs}
                    className="flex items-center gap-2 px-4 py-1.5 bg-[#2B2D30] hover:bg-[#393B40] text-[#DFE1E5] border border-[#393B40] rounded-md text-xs font-medium transition-colors"
                  >
                    <GitBranch size={15} />
                    <span>Get from VCS</span>
                  </button>
                </div>
              </div>

              {/* Projects List or Empty State */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                {recentProjects.length > 0 ? (
                  <div className="flex flex-col gap-1 max-w-4xl">
                    <div className="text-[11px] font-semibold uppercase text-[#868A91] tracking-wider mb-2 px-3">
                      Recent Projects ({filteredProjects.length})
                    </div>
                    {filteredProjects.length === 0 ? (
                      <div className="text-center py-16 text-[#868A91] text-xs">
                        No projects match "{searchQuery}"
                      </div>
                    ) : (
                      filteredProjects.map((project, idx) => (
                        <div
                          key={`${project.path}-${idx}`}
                          onClick={() => onOpenRecentProject(project.path)}
                          className="group flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[#2B2D30] cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded bg-[#2B2D30] group-hover:bg-[#393B40] border border-[#393B40] flex items-center justify-center text-[#3574F0] flex-shrink-0">
                              <Folder size={18} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold text-[#DFE1E5] group-hover:text-white truncate">
                                {project.name}
                              </span>
                              <span className="text-[11px] text-[#868A91] truncate" title={project.path}>
                                {project.path}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-[#606366] opacity-0 group-hover:opacity-100 transition-opacity">
                              Open Project
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveRecentProject(project.path);
                              }}
                              className="p-1 rounded text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#393B40] opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove from Recent Projects"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  /* FRESH INSTALL EMPTY STATE */
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#F93570] via-[#FC801D] to-[#21D789] p-[3px] shadow-xl mb-4">
                      <div className="w-full h-full bg-[#1E1F22] rounded-[13px] flex items-center justify-center text-2xl font-black text-white">
                        IJ
                      </div>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Welcome to IntelliJ IDEA</h2>
                    <p className="text-xs text-[#868A91] max-w-sm mb-8 leading-relaxed">
                      Create a new project to start from scratch, or open an existing directory from disk or version control.
                    </p>

                    <div className="grid grid-cols-3 gap-3 w-full">
                      <button
                        onClick={onNewProject}
                        className="flex flex-col items-center p-4 bg-[#2B2D30]/60 hover:bg-[#2B2D30] border border-[#393B40] rounded-xl text-center group transition-all"
                      >
                        <div className="w-10 h-10 rounded-lg bg-[#3574F0]/20 text-[#3574F0] flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                          <Plus size={20} />
                        </div>
                        <span className="text-xs font-semibold text-[#DFE1E5] mb-1">New Project</span>
                        <span className="text-[10px] text-[#868A91]">Java, Rust, Python, React</span>
                      </button>

                      <button
                        onClick={onOpenProject}
                        className="flex flex-col items-center p-4 bg-[#2B2D30]/60 hover:bg-[#2B2D30] border border-[#393B40] rounded-xl text-center group transition-all"
                      >
                        <div className="w-10 h-10 rounded-lg bg-[#59A869]/20 text-[#59A869] flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                          <FolderOpen size={20} />
                        </div>
                        <span className="text-xs font-semibold text-[#DFE1E5] mb-1">Open</span>
                        <span className="text-[10px] text-[#868A91]">From local drive</span>
                      </button>

                      <button
                        onClick={onCloneVcs}
                        className="flex flex-col items-center p-4 bg-[#2B2D30]/60 hover:bg-[#2B2D30] border border-[#393B40] rounded-xl text-center group transition-all"
                      >
                        <div className="w-10 h-10 rounded-lg bg-[#E08D3C]/20 text-[#E08D3C] flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                          <GitBranch size={20} />
                        </div>
                        <span className="text-xs font-semibold text-[#DFE1E5] mb-1">Get from VCS</span>
                        <span className="text-[10px] text-[#868A91]">Git, GitHub URL</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: REMOTE DEVELOPMENT */}
          {activeTab === 'remote' && (
            <div className="flex-1 p-8 overflow-y-auto max-w-3xl">
              <h2 className="text-lg font-bold text-white mb-2">Remote Development</h2>
              <p className="text-xs text-[#868A91] mb-6">
                Develop remotely on powerful servers, cloud instances, or WSL while enjoying local responsiveness.
              </p>

              <div className="flex flex-col gap-3">
                <div className="p-4 bg-[#2B2D30] border border-[#393B40] rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-[#1E1F22] flex items-center justify-center text-[#3574F0]">
                      <Terminal size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#DFE1E5]">SSH Connection</div>
                      <div className="text-[11px] text-[#868A91]">Connect to any Linux machine via SSH and run IDE backend remotely.</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => onShowToast('Remote SSH', 'Configuring SSH connection wizard...', 'info')}
                    className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3064D0] text-white rounded text-xs font-medium"
                  >
                    New Connection
                  </button>
                </div>

                <div className="p-4 bg-[#2B2D30] border border-[#393B40] rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-[#1E1F22] flex items-center justify-center text-[#59A869]">
                      <Monitor size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#DFE1E5]">WSL (Windows Subsystem for Linux)</div>
                      <div className="text-[11px] text-[#868A91]">Run code in WSL 2 distributions while keeping GUI smooth.</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => onShowToast('WSL', 'Detecting installed WSL distros...', 'info')}
                    className="px-3 py-1.5 bg-[#393B40] hover:bg-[#4E5157] text-[#DFE1E5] rounded text-xs font-medium"
                  >
                    Open in WSL
                  </button>
                </div>

                <div className="p-4 bg-[#2B2D30] border border-[#393B40] rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-[#1E1F22] flex items-center justify-center text-[#E08D3C]">
                      <Cpu size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#DFE1E5]">Dev Containers</div>
                      <div className="text-[11px] text-[#868A91]">Standardized containerized environments matching your production dependencies.</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => onShowToast('Dev Containers', 'Scanning Docker daemon...', 'info')}
                    className="px-3 py-1.5 bg-[#393B40] hover:bg-[#4E5157] text-[#DFE1E5] rounded text-xs font-medium"
                  >
                    Clone in Container
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMIZE */}
          {activeTab === 'customize' && (
            <div className="flex-1 p-8 overflow-y-auto max-w-2xl">
              <h2 className="text-lg font-bold text-white mb-2">Customize IntelliJ IDEA</h2>
              <p className="text-xs text-[#868A91] mb-6">
                Personalize your workspace appearance, font sizing, and keyboard shortcuts.
              </p>

              <div className="flex flex-col gap-6 text-xs">
                {/* Theme Selector */}
                <div>
                  <label className="block text-[#DFE1E5] font-semibold mb-2">Color Theme</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'intellij-new-ui-dark', label: 'Dark (New UI)', desc: 'Modern high-contrast dark palette' },
                      { id: 'darcula', label: 'Darcula', desc: 'Classic JetBrains Darcula look' },
                      { id: 'light', label: 'Light', desc: 'Clean bright daylight theme' },
                      { id: 'high-contrast', label: 'High Contrast', desc: 'Maximum legibility and crisp edges' },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          onUpdateSettings({ ...settings, theme: t.id as any });
                          onShowToast('Theme Changed', `Switched theme to ${t.label}`, 'success');
                        }}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          settings.theme === t.id
                            ? 'bg-[#2B2D30] border-[#3574F0] text-white shadow-sm'
                            : 'bg-[#2B2D30]/50 border-[#393B40] text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs">{t.label}</span>
                          {settings.theme === t.id && <Check size={14} className="text-[#3574F0]" />}
                        </div>
                        <span className="text-[10px] text-[#868A91]">{t.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size & Preview */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[#DFE1E5] font-semibold">IDE & Editor Font Size</label>
                    <span className="text-[#868A91] font-mono">{settings.fontSize || 13} px</span>
                  </div>
                  <input
                    type="range"
                    min="11"
                    max="20"
                    value={settings.fontSize || 13}
                    onChange={(e) => {
                      const sz = parseInt(e.target.value, 10);
                      onUpdateSettings({ ...settings, fontSize: sz, uiFontSize: sz });
                    }}
                    className="w-full accent-[#3574F0] bg-[#2B2D30] h-1.5 rounded-lg cursor-pointer"
                  />
                  <div 
                    style={{ fontSize: `${settings.fontSize || 13}px`, fontFamily: settings.fontFamily || 'JetBrains Mono' }}
                    className="mt-3 p-3 bg-[#2B2D30] border border-[#393B40] rounded font-mono text-[#DFE1E5]"
                  >
                    fn main() &#123; println!("Welcome to IntelliJ IDEA!"); &#125;
                  </div>
                </div>

                {/* Open all settings button */}
                <div className="pt-2">
                  <button
                    onClick={onOpenSettings}
                    className="px-4 py-2 bg-[#2B2D30] hover:bg-[#393B40] text-[#DFE1E5] border border-[#393B40] rounded-md font-medium text-xs transition-colors flex items-center gap-2"
                  >
                    <SettingsIcon size={14} />
                    <span>All settings...</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PLUGINS */}
          {activeTab === 'plugins' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden p-8">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-white">Plugins</h2>
                  <p className="text-xs text-[#868A91]">Discover and install tools from JetBrains Marketplace</p>
                </div>
                <div className="relative w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#868A91]" />
                  <input
                    type="text"
                    value={pluginSearch}
                    onChange={(e) => setPluginSearch(e.target.value)}
                    placeholder="Search plugins in Marketplace..."
                    className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] focus:outline-none rounded-md pl-9 pr-3 py-1.5 text-xs text-[#DFE1E5]"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2.5">
                {availablePlugins.map(plugin => {
                  const isInstalled = installedPlugins.includes(plugin.name);
                  return (
                    <div
                      key={plugin.name}
                      className="p-3.5 bg-[#2B2D30] border border-[#393B40] rounded-lg flex items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded bg-[#1E1F22] flex items-center justify-center text-[#3574F0] flex-shrink-0 mt-0.5">
                          <Puzzle size={18} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white">{plugin.name}</span>
                            <span className="text-[10px] text-[#868A91]">{plugin.author}</span>
                            <span className="text-[10px] text-[#606366]">• {plugin.downloads} downloads</span>
                          </div>
                          <span className="text-[11px] text-[#868A91] mt-0.5 leading-snug line-clamp-1">
                            {plugin.desc}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => togglePlugin(plugin.name)}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                          isInstalled
                            ? 'bg-[#393B40] text-[#DFE1E5] hover:bg-[#E05555]/20 hover:text-[#E05555]'
                            : 'bg-[#3574F0] hover:bg-[#3064D0] text-white shadow-sm'
                        }`}
                      >
                        {isInstalled ? 'Installed' : 'Install'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: LEARN INTELLIJ IDEA */}
          {activeTab === 'learn' && (
            <div className="flex-1 p-8 overflow-y-auto max-w-3xl">
              <h2 className="text-lg font-bold text-white mb-2">Learn IntelliJ IDEA</h2>
              <p className="text-xs text-[#868A91] mb-6">
                Master productivity features, code refactorings, and essential keyboard shortcuts.
              </p>

              {/* Quick Shortcuts Cheat Sheet */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#868A91] mb-3">
                  Essential Shortcuts (JetBrains Default)
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[#2B2D30] border border-[#393B40] rounded-lg flex items-center justify-between">
                    <span className="text-[#DFE1E5]">Search Everywhere</span>
                    <kbd className="px-2 py-0.5 bg-[#1E1F22] border border-[#393B40] rounded text-[11px] font-mono text-[#3574F0]">
                      Shift Shift
                    </kbd>
                  </div>

                  <div className="p-3 bg-[#2B2D30] border border-[#393B40] rounded-lg flex items-center justify-between">
                    <span className="text-[#DFE1E5]">Find in Files</span>
                    <kbd className="px-2 py-0.5 bg-[#1E1F22] border border-[#393B40] rounded text-[11px] font-mono text-[#3574F0]">
                      Ctrl + Shift + F
                    </kbd>
                  </div>

                  <div className="p-3 bg-[#2B2D30] border border-[#393B40] rounded-lg flex items-center justify-between">
                    <span className="text-[#DFE1E5]">Show Context Actions / Intention</span>
                    <kbd className="px-2 py-0.5 bg-[#1E1F22] border border-[#393B40] rounded text-[11px] font-mono text-[#3574F0]">
                      Alt + Enter
                    </kbd>
                  </div>

                  <div className="p-3 bg-[#2B2D30] border border-[#393B40] rounded-lg flex items-center justify-between">
                    <span className="text-[#DFE1E5]">Reformat Code</span>
                    <kbd className="px-2 py-0.5 bg-[#1E1F22] border border-[#393B40] rounded text-[11px] font-mono text-[#3574F0]">
                      Ctrl + Alt + L
                    </kbd>
                  </div>

                  <div className="p-3 bg-[#2B2D30] border border-[#393B40] rounded-lg flex items-center justify-between">
                    <span className="text-[#DFE1E5]">Rename Refactoring</span>
                    <kbd className="px-2 py-0.5 bg-[#1E1F22] border border-[#393B40] rounded text-[11px] font-mono text-[#3574F0]">
                      Shift + F6
                    </kbd>
                  </div>

                  <div className="p-3 bg-[#2B2D30] border border-[#393B40] rounded-lg flex items-center justify-between">
                    <span className="text-[#DFE1E5]">Run Configuration</span>
                    <kbd className="px-2 py-0.5 bg-[#1E1F22] border border-[#393B40] rounded text-[11px] font-mono text-[#3574F0]">
                      Shift + F10
                    </kbd>
                  </div>
                </div>
              </div>

              {/* Onboarding buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={onOpenTip}
                  className="px-4 py-2 bg-[#3574F0] hover:bg-[#3064D0] text-white rounded-md text-xs font-medium transition-colors"
                >
                  View Tip of the Day
                </button>
                <button
                  onClick={() => onShowToast('Documentation', 'Opening IntelliJ IDEA Documentation...', 'info')}
                  className="px-4 py-2 bg-[#2B2D30] hover:bg-[#393B40] text-[#DFE1E5] border border-[#393B40] rounded-md text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink size={13} />
                  <span>Online Help & Docs</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
