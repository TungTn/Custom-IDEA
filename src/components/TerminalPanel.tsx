import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Plus, Trash2, Split, Maximize2 } from 'lucide-react';

interface TerminalPanelProps {
  onClear?: () => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);

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
    fitAddon.fit();

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    term.writeln('\x1b[38;2;53;116;240mIntelliJ Terminal\x1b[0m [Local PowerShell Session]');
    term.writeln('Microsoft Windows [Version 10.0.19045.5487]');
    term.writeln('Type commands to execute (e.g. \x1b[33mcargo --version\x1b[0m, \x1b[33mnpm list\x1b[0m, \x1b[33mclear\x1b[0m)\n');
    term.write('\x1b[32mPS D:\\IDE>\x1b[0m ');

    let currentLine = '';

    term.onData((data) => {
      // Handle Enter
      if (data === '\r') {
        term.write('\r\n');
        const trimmed = currentLine.trim();
        if (trimmed === 'clear') {
          term.clear();
        } else if (trimmed === 'cargo --version') {
          term.writeln('cargo 1.99.1 (5f94df478 2026-08-27)');
        } else if (trimmed === 'rustc --version') {
          term.writeln('rustc 1.99.1 (58cf8f9c3 2026-10-13)');
        } else if (trimmed === 'node -v' || trimmed === 'node --version') {
          term.writeln('v22.17.0');
        } else if (trimmed === 'git status') {
          term.writeln('On branch main\nNothing to commit, working tree clean');
        } else if (trimmed === 'help') {
          term.writeln('Available sample commands: cargo --version, node -v, git status, clear');
        } else if (trimmed.length > 0) {
          term.writeln(`Executed: ${trimmed}`);
        }
        currentLine = '';
        term.write('\x1b[32mPS D:\\IDE>\x1b[0m ');
      } 
      // Handle Backspace
      else if (data === '\u007F' || data === '\b') {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          term.write('\b \b');
        }
      } 
      // Handle Normal characters
      else if (data >= ' ') {
        currentLine += data;
        term.write(data);
      }
    });

    const handleResize = () => {
      fitAddon.fit();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  const handleClear = () => {
    if (xtermInstance.current) {
      xtermInstance.current.clear();
      xtermInstance.current.write('\x1b[32mPS D:\\IDE>\x1b[0m ');
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1F22]">
      {/* Terminal Internal Toolbar */}
      <div className="h-7 bg-[#2B2D30] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] text-[#868A91]">
        <div className="flex items-center gap-2">
          <span className="text-[#DFE1E5] font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#59A869]" />
            Local 1 (PowerShell)
          </span>
          <button title="New Session" className="p-0.5 hover:text-[#DFE1E5] hover:bg-[#35373B] rounded">
            <Plus size={12} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={handleClear} title="Clear Terminal" className="p-1 hover:text-[#DFE1E5] hover:bg-[#35373B] rounded">
            <Trash2 size={12} />
          </button>
          <button title="Split Terminal" className="p-1 hover:text-[#DFE1E5] hover:bg-[#35373B] rounded">
            <Split size={12} />
          </button>
          <button title="Maximize" className="p-1 hover:text-[#DFE1E5] hover:bg-[#35373B] rounded">
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      {/* Terminal View Container */}
      <div ref={terminalRef} className="flex-1 p-2 overflow-hidden" />
    </div>
  );
};
