import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { 
  Plus, 
  AlertTriangle,
  Trash2, 
  Columns, 
  Rows, 
  Square,
  Search, 
  X, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight,
  MoreVertical,
  Minus,
  Settings,
  Check,
  Terminal as TerminalIcon,
} from 'lucide-react';

export interface AvailableShell {
  id: string;
  name: string;
  command: string;
  is_available: boolean;
}

export interface TerminalPaneItem {
  id: string;
  sessionId: string;
  shell: string;
  shellName: string;
}

export interface TerminalTabItem {
  id: string;
  title: string;
  isCustomTitle?: boolean;
  layout: 'single' | 'horizontal' | 'vertical';
  panes: TerminalPaneItem[];
  activePaneId: string;
}

interface TerminalPanelProps {
  cwd?: string;
  onClear?: () => void;
  onToggleMaximize?: () => void;
  onHide?: () => void;
  onOpenSettings?: () => void;
}

// Single Terminal Pane Component
interface PaneViewProps {
  pane: TerminalPaneItem;
  isActive: boolean;
  isSplit: boolean;
  initialCwd?: string;
  onFocus: () => void;
  onClosePane?: () => void;
  searchQuery: string;
  searchTrigger: { count: number; dir: 'next' | 'prev' };
}

const TerminalPaneView: React.FC<PaneViewProps> = ({
  pane,
  isActive,
  isSplit,
  initialCwd,
  onFocus,
  onClosePane,
  searchQuery,
  searchTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 12,
      fontFamily: '"JetBrains Mono", Consolas, "Fira Code", monospace',
      lineHeight: 1.25,
      theme: {
        background: '#1E1F22',
        foreground: '#DFE1E5',
        cursor: '#A7A7A7',
        selectionBackground: '#2E436E',
        black: '#1E1F22',
        red: '#E05555',
        green: '#59A869',
        yellow: '#EDA200',
        blue: '#3574F0',
        magenta: '#9876AA',
        cyan: '#299999',
        white: '#DFE1E5',
        brightBlack: '#5A5D63',
        brightRed: '#F46B6B',
        brightGreen: '#68B778',
        brightYellow: '#F5B014',
        brightBlue: '#56A8F5',
        brightMagenta: '#B388D6',
        brightCyan: '#38B2B2',
        brightWhite: '#FFFFFF',
      },
      convertEol: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    term.open(containerRef.current);
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    let fitTimeout: any = null;
    let spawnTimeout: any = null;

    fitTimeout = setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {}
    }, 60);

    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    let isMounted = true;
    let unlistenData: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    let onDataDisposable: { dispose: () => void } | undefined;

    const startSession = async () => {
      let isSpawned = false;
      const targetDir = initialCwd || 'D:\\IDE';

      try {
        const cols = term.cols || 80;
        const rows = term.rows || 24;

        // 1. Listen for events BEFORE spawn so initial prompt isn't dropped
        const dataListener = await listen<{ session_id: string; data: string }>('terminal-data', (event) => {
          if (event.payload.session_id === pane.sessionId) {
            term.write(event.payload.data);
          }
        });
        if (!isMounted) {
          dataListener();
          return;
        }
        unlistenData = dataListener;

        const exitListener = await listen<{ session_id: string }>('terminal-exit', (event) => {
          if (event.payload.session_id === pane.sessionId) {
            term.writeln('\r\n\x1b[33m[Process completed. Press Enter to restart or close tab]\x1b[0m');
          }
        });
        if (!isMounted) {
          exitListener();
          return;
        }
        unlistenExit = exitListener;

        // 2. Wire up input handler
        onDataDisposable = term.onData((data) => {
          invoke('terminal_write', { sessionId: pane.sessionId, data }).catch(() => {});
        });

        // 3. Spawn real process
        await invoke('terminal_spawn', {
          sessionId: pane.sessionId,
          cwd: targetDir,
          shell: pane.shell,
          shellArgs: null,
          cols,
          rows,
        });

        if (!isMounted) {
          if (isTauri) {
            invoke('terminal_kill', { sessionId: pane.sessionId }).catch(() => {});
          }
          return;
        }

        isSpawned = true;

        spawnTimeout = setTimeout(() => {
          try {
            fitAddon.fit();
            invoke('terminal_resize', {
              sessionId: pane.sessionId,
              cols: term.cols || 80,
              rows: term.rows || 24,
            }).catch(() => {});
          } catch (e) {}
          term.focus();
        }, 100);

      } catch (err) {
        if (!isMounted) return;
        console.warn(`Real terminal spawn failed (${err}), using interactive fallback:`, err);
        if (!isSpawned) {
          if (onDataDisposable) {
            onDataDisposable.dispose();
            onDataDisposable = undefined;
          }
          if (pane.shell === 'cmd') {
            term.writeln('Microsoft Windows [Version 10.0.22631.4317]');
            term.writeln('(c) Microsoft Corporation. All rights reserved.\r\n');
            term.write(`${targetDir}>`);
          } else if (pane.shell === 'git-bash') {
            term.writeln('MINGW64 /d/IDE (main)');
            term.write('$ ');
          } else {
            term.writeln('Windows PowerShell');
            term.writeln('Copyright (C) Microsoft Corporation. All rights reserved.\r\n');
            term.write(`PS ${targetDir}> `);
          }

          let currentLine = '';
          onDataDisposable = term.onData((data) => {
            if (data === '\r') {
              term.write('\r\n');
              if (currentLine.trim()) {
                term.writeln(`Executed: ${currentLine}`);
              }
              currentLine = '';
              if (pane.shell === 'cmd') {
                term.write(`${targetDir}>`);
              } else if (pane.shell === 'git-bash') {
                term.write('$ ');
              } else {
                term.write(`PS ${targetDir}> `);
              }
            } else if (data === '\u007F' || data === '\b') {
              if (currentLine.length > 0) {
                currentLine = currentLine.slice(0, -1);
                term.write('\b \b');
              }
            } else if (data >= ' ') {
              currentLine += data;
              term.write(data);
            }
          });
        }
      }
    };

    startSession();

    const handleResize = () => {
      try {
        fitAddon.fit();
        if (isTauri) {
          invoke('terminal_resize', {
            sessionId: pane.sessionId,
            cols: term.cols || 80,
            rows: term.rows || 24,
          }).catch(() => {});
        }
      } catch (e) {}
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      if (fitTimeout) clearTimeout(fitTimeout);
      if (spawnTimeout) clearTimeout(spawnTimeout);
      window.removeEventListener('resize', handleResize);
      if (onDataDisposable) onDataDisposable.dispose();
      if (unlistenData) unlistenData();
      if (unlistenExit) unlistenExit();
      if (isTauri) {
        invoke('terminal_kill', { sessionId: pane.sessionId }).catch(() => {});
      }
      term.dispose();
    };
  }, [pane.sessionId, pane.shell, pane.shellName]);

  // Handle focus and fit
  useEffect(() => {
    let focusTimer: any = null;
    if (isActive && xtermRef.current) {
      focusTimer = setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch (e) {}
        xtermRef.current?.focus();
      }, 50);
    }
    return () => {
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, [isActive]);

  // Perform search on trigger change
  useEffect(() => {
    if (!searchAddonRef.current || !searchQuery) return;
    if (searchTrigger.dir === 'next') {
      searchAddonRef.current.findNext(searchQuery, { caseSensitive: false, incremental: true });
    } else {
      searchAddonRef.current.findPrevious(searchQuery, { caseSensitive: false });
    }
  }, [searchQuery, searchTrigger]);

  return (
    <div 
      onClick={onFocus}
      className={`relative flex-1 flex flex-col h-full bg-[#1E1F22] overflow-hidden ${
        isSplit ? (isActive ? 'ring-1 ring-[#3574F0]' : 'border border-[#2B2D30]') : ''
      }`}
    >
      {isSplit && (
        <div className="h-5 bg-[#222427] border-b border-[#2B2D30] px-2 flex items-center justify-between text-[10px] text-[#868A91]">
          <span className="flex items-center gap-1 font-mono text-[#DFE1E5]">
            <TerminalIcon size={10} className="text-[#3574F0]" />
            {pane.shellName}
          </span>
          {onClosePane && (
            <button 
              onClick={(e) => { e.stopPropagation(); onClosePane(); }}
              title="Close Split"
              className="hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X size={10} />
            </button>
          )}
        </div>
      )}
      <div ref={containerRef} onClick={() => xtermRef.current?.focus()} className="flex-1 p-2 overflow-hidden cursor-text" /></div>
  );
};

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ 
  cwd, 
  onToggleMaximize, 
  onHide,
  onOpenSettings 
}) => {
  const [shells, setShells] = useState<AvailableShell[]>([
    { id: 'powershell', name: 'Windows PowerShell', command: 'powershell.exe', is_available: true },
    { id: 'cmd', name: 'Command Prompt', command: 'cmd.exe', is_available: true },
    { id: 'git-bash', name: 'Git Bash', command: 'bash.exe', is_available: true },
    { id: 'wsl', name: 'WSL (Linux)', command: 'wsl.exe', is_available: true },
  ]);

  const [tabs, setTabs] = useState<TerminalTabItem[]>(() => {
    const firstSessionId = `term-${Date.now()}`;
    return [
      {
        id: 'tab-1',
        title: 'Local',
        layout: 'single',
        activePaneId: 'pane-1',
        panes: [
          {
            id: 'pane-1',
            sessionId: firstSessionId,
            shell: 'powershell',
            shellName: 'Windows PowerShell',
          }
        ]
      }
    ];
  });

  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [exitedSessions, setExitedSessions] = useState<Set<string>>(new Set());
  const [tabToTerminate, setTabToTerminate] = useState<TerminalTabItem | null>(null);
  const [closeAction, setCloseAction] = useState<'single' | 'all'>('single');
  const [doNotAskAgain, setDoNotAskAgain] = useState(false);

  // Listen to terminal exit events to track which processes finished
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupExitTracker = async () => {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        try {
          unlisten = await listen<{ session_id: string }>('terminal-exit', (e) => {
            setExitedSessions(prev => new Set(prev).add(e.payload.session_id));
          });
        } catch (err) {
          console.warn('Failed to listen to terminal-exit:', err);
        }
      }
    };
    setupExitTracker();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTrigger, setSearchTrigger] = useState<{ count: number; dir: 'next' | 'prev' }>({ count: 0, dir: 'next' });
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Floating menus positions (immune to overflow clipping)
  const [addMenuPos, setAddMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [moreMenuPos, setMoreMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

  const addBtnRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

  // Load available shells from Tauri backend on mount
  useEffect(() => {
    const loadShells = async () => {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        try {
          const list = await invoke<AvailableShell[]>('get_available_shells');
          if (list && list.length > 0) {
            setShells(list);
          }
        } catch (e) {
          console.warn('Failed to get available shells:', e);
        }
      }
    };
    loadShells();
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // Toggle Add Menu (+ ⌄)
  const handleToggleAddMenu = () => {
    if (addMenuPos) {
      setAddMenuPos(null);
    } else if (addBtnRef.current) {
      const rect = addBtnRef.current.getBoundingClientRect();
      setMoreMenuPos(null);
      setContextMenu(null);
      setAddMenuPos({ top: rect.bottom + 4, left: rect.left });
    }
  };

  // Toggle More Options Menu (⋮)
  const handleToggleMoreMenu = () => {
    if (moreMenuPos) {
      setMoreMenuPos(null);
    } else if (moreBtnRef.current) {
      const rect = moreBtnRef.current.getBoundingClientRect();
      setAddMenuPos(null);
      setContextMenu(null);
      setMoreMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
  };

  // Create new tab with specific shell
  const handleCreateTab = (shellId: string = 'powershell') => {
    const foundShell = shells.find(s => s.id === shellId) || shells[0];
    const newTabId = `tab-${Date.now()}`;
    const newSessionId = `term-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newPaneId = `pane-${Date.now()}`;

    const newTabNumber = tabs.length + 1;
    const newTitle = newTabNumber === 1 ? 'Local' : `Local (${newTabNumber})`;

    const newTab: TerminalTabItem = {
      id: newTabId,
      title: newTitle,
      layout: 'single',
      activePaneId: newPaneId,
      panes: [
        {
          id: newPaneId,
          sessionId: newSessionId,
          shell: foundShell.id,
          shellName: foundShell.name,
        }
      ]
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
    setAddMenuPos(null);
  };

  // Perform actual close of tab and kill its process
  const performCloseTab = (tabId: string) => {
    const targetTab = tabs.find(t => t.id === tabId);
    if (targetTab && typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      targetTab.panes.forEach(p => {
        invoke('terminal_kill', { sessionId: p.sessionId }).catch(() => {});
      });
    }

    if (tabs.length <= 1) {
      const newSessionId = `term-${Date.now()}`;
      setTabs([
        {
          id: 'tab-1',
          title: 'Local',
          layout: 'single',
          activePaneId: 'pane-1',
          panes: [
            {
              id: 'pane-1',
              sessionId: newSessionId,
              shell: 'powershell',
              shellName: 'Windows PowerShell',
            }
          ]
        }
      ]);
      setActiveTabId('tab-1');
      return;
    }

    const filtered = tabs.filter(t => t.id !== tabId);
    setTabs(filtered);
    if (activeTabId === tabId) {
      setActiveTabId(filtered[filtered.length - 1].id);
    }
  };

  // Close tab with confirmation if process is running
  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetTab = tabs.find(t => t.id === tabId);
    if (!targetTab) return;

    const hasRunningProcess = targetTab.panes.some(p => !exitedSessions.has(p.sessionId));
    const skipPrompt = localStorage.getItem('ij_confirm_terminal_kill') === 'false';

    if (hasRunningProcess && !skipPrompt) {
      setTabToTerminate(targetTab);
      setCloseAction('single');
      return;
    }

    performCloseTab(tabId);
  };

  const performCloseAllTabs = () => {
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      tabs.forEach(t => t.panes.forEach(p => {
        invoke('terminal_kill', { sessionId: p.sessionId }).catch(() => {});
      }));
    }
    const newSessionId = `term-${Date.now()}`;
    setTabs([
      {
        id: 'tab-1',
        title: 'Local',
        layout: 'single',
        activePaneId: 'pane-1',
        panes: [
          {
            id: 'pane-1',
            sessionId: newSessionId,
            shell: 'powershell',
            shellName: 'Windows PowerShell',
          }
        ]
      }
    ]);
    setActiveTabId('tab-1');
  };

  // Close all tabs (IntelliJ shortcut Ctrl+Shift+W)
  const handleCloseAllTabs = () => {
    const hasAnyRunning = tabs.some(t => t.panes.some(p => !exitedSessions.has(p.sessionId)));
    const skipPrompt = localStorage.getItem('ij_confirm_terminal_kill') === 'false';
    if (hasAnyRunning && !skipPrompt) {
      setTabToTerminate(tabs[0]);
      setCloseAction('all');
      return;
    }
    performCloseAllTabs();
  };

  const handleConfirmTerminate = () => {
    if (doNotAskAgain) {
      try {
        localStorage.setItem('ij_confirm_terminal_kill', 'false');
      } catch (e) {}
    }
    if (closeAction === 'single' && tabToTerminate) {
      performCloseTab(tabToTerminate.id);
    } else if (closeAction === 'all') {
      performCloseAllTabs();
    }
    setTabToTerminate(null);
  };

  // Split active tab horizontally or vertically
  const handleSplitActiveTab = (direction: 'horizontal' | 'vertical') => {
    if (!activeTab) return;
    if (activeTab.panes.length >= 2) return;

    const currentShell = activeTab.panes[0]?.shell || 'powershell';
    const currentShellName = activeTab.panes[0]?.shellName || 'Windows PowerShell';
    const newPaneId = `pane-${Date.now()}`;
    const newSessionId = `term-${Date.now()}-split`;

    const newPane: TerminalPaneItem = {
      id: newPaneId,
      sessionId: newSessionId,
      shell: currentShell,
      shellName: currentShellName,
    };

    setTabs(prev => prev.map(t => {
      if (t.id === activeTab.id) {
        return {
          ...t,
          layout: direction,
          panes: [...t.panes, newPane],
          activePaneId: newPaneId,
        };
      }
      return t;
    }));
  };

  // Close a specific split pane
  const handleClosePane = (tabId: string, paneId: string) => {
    setTabs(prev => prev.map(t => {
      if (t.id === tabId) {
        const remainingPanes = t.panes.filter(p => p.id !== paneId);
        if (remainingPanes.length === 0) return t;
        return {
          ...t,
          layout: 'single',
          panes: remainingPanes,
          activePaneId: remainingPanes[0].id,
        };
      }
      return t;
    }));
  };

  // Rename session
  const handleStartRename = (tab: TerminalTabItem) => {
    setEditingTabId(tab.id);
    setEditingTitle(tab.title);
    setContextMenu(null);
  };

  const handleSaveRename = (tabId: string) => {
    if (editingTitle.trim()) {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, title: editingTitle.trim(), isCustomTitle: true } : t));
    }
    setEditingTabId(null);
  };

  // Find next/prev in terminal
  const handleSearchNext = () => {
    setSearchTrigger(prev => ({ count: prev.count + 1, dir: 'next' }));
  };

  const handleSearchPrev = () => {
    setSearchTrigger(prev => ({ count: prev.count + 1, dir: 'prev' }));
  };

  // Global keydown within terminal panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'W' || e.key === 'w')) {
        e.preventDefault();
        handleCloseTab(activeTabId);
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        handleSplitActiveTab('horizontal');
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        handleSplitActiveTab('vertical');
      } else if (e.shiftKey && e.key === 'Escape') {
        e.preventDefault();
        onHide?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, onHide]);

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] select-none font-sans relative">
      {/* ─── Top Terminal Header Bar (Authentic IntelliJ IDEA New UI) ─── */}
      <div className="h-[30px] bg-[#1E1F22] border-b border-[#2B2D30] px-2 flex items-center justify-between text-xs text-[#868A91] select-none flex-shrink-0">
        {/* Left: Tool Window Title + Session Tabs + Dropdown Add Button */}
        <div className="flex items-center gap-1.5 h-full overflow-x-auto no-scrollbar">
          {/* Tool Window Title (IntelliJ IDEA New UI) */}
          <span className="font-semibold text-[12px] text-[#DFE1E5] tracking-tight mr-1 cursor-default">
            Terminal
          </span>

          {/* Session Tabs Stripe */}
          {tabs.map((tab) => {
            const isTabActive = tab.id === activeTabId;
            const isEditing = editingTabId === tab.id;

            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                onDoubleClick={() => handleStartRename(tab)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setAddMenuPos(null);
                  setMoreMenuPos(null);
                  setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                }}
                className={`group flex items-center gap-1.5 px-2.5 h-[26px] rounded-t text-[11px] cursor-pointer transition-colors relative border-b-2 ${
                  isTabActive
                    ? 'bg-[#2B2D30] border-[#3574F0] text-[#DFE1E5] font-medium'
                    : 'bg-transparent border-transparent text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/50'
                }`}
              >
                {isEditing ? (
                  <input
                    type="text"
                    value={editingTitle}
                    autoFocus
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => handleSaveRename(tab.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(tab.id);
                      if (e.key === 'Escape') setEditingTabId(null);
                    }}
                    className="bg-[#1E1F22] text-[#DFE1E5] px-1 py-0.5 rounded text-[11px] outline-none border border-[#3574F0] w-20"
                  />
                ) : (
                  <span className="truncate max-w-[130px]">{tab.title}</span>
                )}

                {/* Close Tab Icon */}
                <button
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  title="Close Terminal Session (Ctrl+Shift+W)"
                  className="p-0.5 rounded hover:bg-[#393B40] text-[#868A91] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ml-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}

          {/* Add Tab '+' with Shell Dropdown '⌄' */}
          <div className="flex items-center rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] ml-0.5" ref={addBtnRef}>
            <button
              onClick={() => handleCreateTab('powershell')}
              title="New Session (Default Shell)"
              className="p-1 hover:text-white cursor-pointer"
            >
              <Plus size={13} />
            </button>
            <button
              onClick={handleToggleAddMenu}
              title="Select Shell (PowerShell, Command Prompt, Git Bash, WSL)"
              className="p-1 pr-1.5 hover:text-white cursor-pointer"
            >
              <ChevronDown size={11} />
            </button>
          </div>
        </div>

        {/* Right Toolbar: Split, Search, Maximize, Minimize, More Options */}
        <div className="flex items-center gap-0.5">
          {/* Split Right (Vertical divider) */}
          <button
            onClick={() => handleSplitActiveTab('horizontal')}
            disabled={activeTab && activeTab.panes.length >= 2}
            title="Split Right (Ctrl+Shift+D)"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              activeTab && activeTab.panes.length >= 2
                ? 'opacity-30 cursor-not-allowed text-[#5A5D63]'
                : 'hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5]'
            }`}
          >
            <Columns size={13} />
          </button>

          {/* Split Down (Horizontal divider) */}
          <button
            onClick={() => handleSplitActiveTab('vertical')}
            disabled={activeTab && activeTab.panes.length >= 2}
            title="Split Down (Ctrl+Shift+E)"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              activeTab && activeTab.panes.length >= 2
                ? 'opacity-30 cursor-not-allowed text-[#5A5D63]'
                : 'hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5]'
            }`}
          >
            <Rows size={13} />
          </button>

          <div className="w-[1px] h-3 bg-[#2B2D30] mx-0.5" />

          {/* Find in Terminal (Ctrl+F) */}
          <button
            onClick={() => setIsSearchOpen(prev => !prev)}
            title="Find in Terminal (Ctrl+F)"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isSearchOpen ? 'bg-[#3574F0]/20 text-[#3574F0]' : 'hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5]'
            }`}
          >
            <Search size={13} />
          </button>

          {/* Maximize / Restore Tool Window */}
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              title="Maximize / Restore Tool Window (Ctrl+Shift+Quote)"
              className="p-1.5 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
            >
              <Square size={12} />
            </button>
          )}

          {/* Minimize / Hide Tool Window */}
          {onHide && (
            <button
              onClick={onHide}
              title="Hide Tool Window (Shift+Esc)"
              className="p-1.5 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
            >
              <Minus size={13} />
            </button>
          )}

          {/* More Options (⋮) */}
          <button
            ref={moreBtnRef}
            onClick={handleToggleMoreMenu}
            title="More Options"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              moreMenuPos ? 'bg-[#2B2D30] text-[#DFE1E5]' : 'hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5]'
            }`}
          >
            <MoreVertical size={13} />
          </button>
        </div>
      </div>

      {/* ─── Inline Search Bar (Ctrl+F) ─── */}
      {isSearchOpen && (
        <div className="h-7 bg-[#222427] border-b border-[#2B2D30] px-3 flex items-center gap-2 text-xs font-sans">
          <Search size={12} className="text-[#868A91]" />
          <input
            type="text"
            value={searchQuery}
            autoFocus
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchTrigger(prev => ({ count: prev.count + 1, dir: 'next' }));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.shiftKey) handleSearchPrev();
                else handleSearchNext();
              }
              if (e.key === 'Escape') setIsSearchOpen(false);
            }}
            placeholder="Search terminal output..."
            className="flex-1 bg-transparent text-[#DFE1E5] placeholder-[#5A5D63] outline-none text-xs"
          />
          <div className="flex items-center gap-1">
            <button
              onClick={handleSearchPrev}
              title="Previous occurrence (Shift+Enter)"
              className="p-1 hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] rounded cursor-pointer"
            >
              <ChevronUp size={12} />
            </button>
            <button
              onClick={handleSearchNext}
              title="Next occurrence (Enter)"
              className="p-1 hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] rounded cursor-pointer"
            >
              <ChevronDown size={12} />
            </button>
            <button
              onClick={() => setIsSearchOpen(false)}
              title="Close Search (Escape)"
              className="p-1 hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] rounded ml-1 cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ─── Terminal Body (Panes with Split Layout) ─── */}
      <div className="flex-1 overflow-hidden relative flex">
        {tabs.map((tab) => {
          const isTabActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`flex-1 h-full flex ${
                tab.layout === 'vertical' ? 'flex-col' : 'flex-row'
              } ${isTabActive ? '' : 'hidden'}`}
              style={{ display: isTabActive ? 'flex' : 'none' }}
            >
              {tab.panes.map((pane) => (
                <TerminalPaneView
                  key={pane.id}
                  pane={pane}
                  isActive={isTabActive && pane.id === tab.activePaneId}
                  isSplit={tab.panes.length > 1}
                  initialCwd={cwd}
                  onFocus={() => {
                    setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, activePaneId: pane.id } : t));
                  }}
                  onClosePane={() => handleClosePane(tab.id, pane.id)}
                  searchQuery={searchQuery}
                  searchTrigger={searchTrigger}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* ─── Floating Menus Backdrop (Universal Click Dismiss) ─── */}
      {(addMenuPos || moreMenuPos || contextMenu) && (
        <div
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => {
            setAddMenuPos(null);
            setMoreMenuPos(null);
            setContextMenu(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setAddMenuPos(null);
            setMoreMenuPos(null);
            setContextMenu(null);
          }}
        />
      )}

      {/* ─── Shell Selection Dropdown Menu (+ ⌄) (Authentic IntelliJ IDEA) ─── */}
      {addMenuPos && (
        <div
          style={{ top: addMenuPos.top, left: addMenuPos.left }}
          className="fixed z-50 w-56 bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 text-xs text-[#DFE1E5]"
        >
          {shells.map((sh) => (
            <button
              key={sh.id}
              onClick={() => {
                handleCreateTab(sh.id);
                setAddMenuPos(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <TerminalIcon size={12} className="opacity-80" />
                <span>{sh.name}</span>
              </div>
            </button>
          ))}

          <div className="border-t border-[#393B40] my-1" />

          <button
            onClick={() => {
              setAddMenuPos(null);
              onOpenSettings?.();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Settings size={12} className="opacity-80" />
            <span>Settings</span>
          </button>
        </div>
      )}

      {/* ─── More Options Menu (⋮) (Authentic IntelliJ IDEA) ─── */}
      {moreMenuPos && (
        <div
          style={{ top: moreMenuPos.top, right: moreMenuPos.right }}
          className="fixed z-50 w-64 bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 text-xs text-[#DFE1E5]"
        >
          {/* Terminal Engine Submenu */}
          <div className="group relative">
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between cursor-pointer">
              <span>Terminal Engine</span>
              <ChevronRight size={12} className="opacity-70" />
            </div>
            <div className="hidden group-hover:block absolute right-full top-0 mr-1 w-56 bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1">
              <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between cursor-pointer opacity-70">
                <span>Reworked (Early Access 2025)</span>
              </div>
              <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between cursor-pointer text-[#59A869]">
                <span>Classic</span>
                <Check size={12} />
              </div>
            </div>
          </div>

          {/* Settings */}
          <div
            onClick={() => {
              setMoreMenuPos(null);
              onOpenSettings?.();
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between cursor-pointer"
          >
            <span>Settings</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* Close All */}
          <div
            onClick={() => {
              handleCloseAllTabs();
              setMoreMenuPos(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between cursor-pointer"
          >
            <span>Close All</span>
            <span className="text-[10px] text-[#868A91] group-hover:text-white">Ctrl+Shift+W</span>
          </div>

          {/* Group Tabs */}
          <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between cursor-pointer opacity-60">
            <span>Group Tabs</span>
          </div>

          {/* View Mode > */}
          <div className="group relative">
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between cursor-pointer">
              <span>View Mode</span>
              <ChevronRight size={12} className="opacity-70" />
            </div>
            <div className="hidden group-hover:block absolute right-full top-0 mr-1 w-44 bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1">
              <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between text-[#59A869]">
                <span>Dock Pinned</span>
                <Check size={12} />
              </div>
              <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer">
                <span>Dock Unpinned</span>
              </div>
              <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer">
                <span>Undock</span>
              </div>
              <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer">
                <span>Float</span>
              </div>
              <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer">
                <span>Window</span>
              </div>
            </div>
          </div>

          {/* Move to > */}
          <div className="group relative">
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between cursor-pointer">
              <span>Move to</span>
              <ChevronRight size={12} className="opacity-70" />
            </div>
            <div className="hidden group-hover:block absolute right-full top-0 mr-1 w-40 bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1">
              <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between text-[#59A869]">
                <span>Bottom</span>
                <Check size={12} />
              </div>
              <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer">
                <span>Left</span>
              </div>
              <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer">
                <span>Right</span>
              </div>
            </div>
          </div>

          {/* Resize > */}
          <div className="group relative">
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between cursor-pointer">
              <span>Resize</span>
              <ChevronRight size={12} className="opacity-70" />
            </div>
            <div className="hidden group-hover:block absolute right-full top-0 mr-1 w-44 bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1">
              <div 
                onClick={() => {
                  setMoreMenuPos(null);
                  onToggleMaximize?.();
                }}
                className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
              >
                <span>Stretch to Top</span>
              </div>
            </div>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* Remove from Sidebar */}
          <div
            onClick={() => {
              setMoreMenuPos(null);
              onHide?.();
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center justify-between cursor-pointer"
          >
            <span>Remove from Sidebar</span>
          </div>
        </div>
      )}

      {/* ─── Tab Context Menu (Right Click on Tab) ─── */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-xs w-48 font-sans text-[#DFE1E5]"
        >
          <div
            onClick={() => {
              const target = tabs.find(t => t.id === contextMenu.tabId);
              if (target) handleStartRename(target);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <span>Rename Session...</span>
            <span className="text-[10px] text-[#868A91]">F2</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          <div
            onClick={() => {
              setActiveTabId(contextMenu.tabId);
              handleSplitActiveTab('horizontal');
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <span>Split Right</span>
          </div>

          <div
            onClick={() => {
              setActiveTabId(contextMenu.tabId);
              handleSplitActiveTab('vertical');
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <span>Split Down</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          <div
            onClick={() => {
              handleCloseTab(contextMenu.tabId);
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#E05555] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <span>Close Session</span>
            <span className="text-[10px] text-[#868A91]">Ctrl+Shift+W</span>
          </div>

          <div
            onClick={() => {
              setTabs(prev => prev.filter(t => t.id === contextMenu.tabId));
              setActiveTabId(contextMenu.tabId);
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
          >
            <span>Close Other Sessions</span>
          </div>
        </div>
      )}

      {/* ─── Terminate Process Confirmation Modal (Authentic IntelliJ IDEA) ─── */}
      {tabToTerminate && (
        <div 
          className="fixed inset-0 bg-black/65 backdrop-blur-[2px] flex items-center justify-center z-[100] select-none animate-in fade-in duration-100"
          onClick={() => setTabToTerminate(null)}
        >
          <div 
            className="w-[450px] bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl overflow-hidden flex flex-col text-[12.5px] font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title Bar */}
            <div className="h-9 bg-[#26282B] border-b border-[#393B40] flex items-center justify-between px-3.5 flex-shrink-0">
              <span className="font-medium text-[#DFE1E5]">
                {closeAction === 'all' ? 'Terminate All Processes' : 'Terminate Process'}
              </span>
              <button 
                onClick={() => setTabToTerminate(null)} 
                className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#E05555]/15 text-[#E05555] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle size={18} />
                </div>
                <div className="space-y-1">
                  <div className="font-medium text-[#DFE1E5]">
                    {closeAction === 'all' 
                      ? 'Processes in open terminal sessions are still running.'
                      : `Process '${tabToTerminate.title}' is still running.`
                    }
                  </div>
                  <div className="text-[#868A91] text-[12px] leading-relaxed">
                    Do you want to terminate the process? Any active tasks (such as dev servers or long-running commands) will be stopped.
                  </div>
                </div>
              </div>

              {/* Do not ask again checkbox */}
              <div className="pt-2 border-t border-[#393B40]/60 flex items-center">
                <label className="flex items-center gap-2 cursor-pointer text-[#868A91] hover:text-[#DFE1E5] text-[11.5px]">
                  <input
                    type="checkbox"
                    checked={doNotAskAgain}
                    onChange={(e) => setDoNotAskAgain(e.target.checked)}
                    className="accent-[#3574F0] w-3.5 h-3.5 rounded cursor-pointer"
                  />
                  <span>Do not ask again</span>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="h-11 bg-[#26282B] border-t border-[#393B40] flex items-center justify-end px-3.5 gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setTabToTerminate(null)}
                className="px-3.5 py-1.5 hover:bg-[#35373B] text-[#DFE1E5] rounded text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTerminate}
                className="px-4 py-1.5 bg-[#E05555] hover:bg-[#C74040] text-white rounded text-xs font-medium transition-colors shadow-sm cursor-pointer"
              >
                Terminate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};