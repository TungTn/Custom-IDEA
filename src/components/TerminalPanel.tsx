import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Plus, Trash2, Split, Maximize2, RefreshCw } from 'lucide-react';

interface TerminalPanelProps {
  cwd?: string;
  onClear?: () => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ cwd }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string>(`term-${Date.now()}`);

  const startTerminalSession = async (term: Terminal, fitAddon: FitAddon) => {
    const sessionId = `term-${Date.now()}`;
    sessionIdRef.current = sessionId;

    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

    if (isTauri) {
      try {
        const cols = term.cols || 80;
        const rows = term.rows || 24;
        const targetDir = cwd || 'D:\\IDE';

        await invoke('terminal_spawn', {
          sessionId,
          cwd: targetDir,
          cols,
          rows,
        });

        term.onData((data) => {
          invoke('terminal_write', { sessionId, data }).catch(e => console.warn('Terminal write err:', e));
        });
      } catch (err) {
        term.writeln(`\x1b[31mFailed to start PowerShell session: ${err}\x1b[0m`);
      }
    } else {
      // Browser preview fallback
      term.writeln('\x1b[38;2;53;116;240mIntelliJ Terminal\x1b[0m [Browser Preview]');
      term.writeln('Connect with Desktop App for live native Windows PowerShell.\n');
      term.write('\x1b[32mPS D:\\IDE>\x1b[0m ');
      let currentLine = '';
      term.onData((data) => {
        if (data === '\r') {
          term.write('\r\n');
          term.writeln(`Executed: ${currentLine.trim()}`);
          currentLine = '';
          term.write('\x1b[32mPS D:\\IDE>\x1b[0m ');
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
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 12,
      fontFamily: '"JetBrains Mono", Consolas, monospace',
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
      },
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    // Fit after container mount
    setTimeout(() => {
      try { fitAddon.fit(); } catch (e) {}
    }, 50);

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    let unlistenData: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          unlistenData = await listen<{ session_id: string; data: string }>('terminal-data', (event) => {
            if (event.payload.session_id === sessionIdRef.current) {
              term.write(event.payload.data);
            }
          });

          unlistenExit = await listen<{ session_id: string }>('terminal-exit', (event) => {
            if (event.payload.session_id === sessionIdRef.current) {
              term.writeln('\r\n\x1b[33m[Session terminated]\x1b[0m');
            }
          });
        }
      } catch (e) {
        console.warn('Terminal listen error:', e);
      }
    };

    setupListeners();
    startTerminalSession(term, fitAddon);

    const handleResize = () => {
      try {
        fitAddon.fit();
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          invoke('terminal_resize', {
            sessionId: sessionIdRef.current,
            cols: term.cols || 80,
            rows: term.rows || 24,
          }).catch(() => {});
        }
      } catch (e) {}
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (unlistenData) unlistenData();
      if (unlistenExit) unlistenExit();
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        invoke('terminal_kill', { sessionId: sessionIdRef.current }).catch(() => {});
      }
      term.dispose();
    };
  }, [cwd]);

  const handleRestart = () => {
    if (xtermInstance.current && fitAddonInstance.current) {
      xtermInstance.current.clear();
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        invoke('terminal_kill', { sessionId: sessionIdRef.current }).catch(() => {});
      }
      startTerminalSession(xtermInstance.current, fitAddonInstance.current);
    }
  };

  const handleClear = () => {
    if (xtermInstance.current) {
      xtermInstance.current.clear();
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        invoke('terminal_write', { sessionId: sessionIdRef.current, data: '\x0c' }).catch(() => {});
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1F22]">
      {/* Terminal Internal Toolbar (Authentic IntelliJ IDEA Terminal Tool Window Header) */}
      <div className="h-6 bg-[#1E1F22] border-b border-[#2B2D30] px-3 flex items-center justify-between text-[11px] text-[#868A91]">
        <div className="flex items-center gap-2">
          <span className="text-[#DFE1E5] font-medium flex items-center gap-1.5 px-2 py-0.5 bg-[#2B2D30] rounded text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#59A869]" />
            Local 1
          </span>
          <button 
            onClick={handleRestart}
            title="Restart Session" 
            className="p-1 hover:text-[#DFE1E5] hover:bg-[#2B2D30] rounded flex items-center gap-1 text-[10px] cursor-pointer"
          >
            <RefreshCw size={11} /> Restart
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={handleClear} title="Clear Terminal (Ctrl+L)" className="p-1 hover:text-[#DFE1E5] hover:bg-[#2B2D30] rounded cursor-pointer">
            <Trash2 size={12} />
          </button>
          <button 
            onClick={() => {
              if (fitAddonInstance.current) {
                fitAddonInstance.current.fit();
              }
            }} 
            title="Fit to Window" 
            className="p-1 hover:text-[#DFE1E5] hover:bg-[#2B2D30] rounded cursor-pointer"
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      {/* Terminal View Container */}
      <div ref={terminalRef} className="flex-1 p-2 overflow-hidden" />
    </div>
  );
};
