import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useDebuggerStore } from '../stores';
import { dapService } from '../services/dapService';
import { Breakpoint, OpenTab, RunConfiguration, StackFrame, VariableItem } from '../types';
import { CodeEditorHandle } from '../workbench';

export interface UseIdeDebuggerOptions {
  activeTab?: OpenTab;
  cursorPos: { line: number; col: number };
  setCursorPos: React.Dispatch<React.SetStateAction<{ line: number; col: number }>>;
  codeEditorRef: React.RefObject<CodeEditorHandle>;
  currentProjectDirectory: string;
  runConfigurations: RunConfiguration[];
  activeConfigId: string | null;
  handleOpenFileAtLocation: (filePath: string, line: number, col?: number) => Promise<void> | void;
  addToast: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  setBottomTab: (tab: 'find' | 'run' | 'debug' | 'terminal' | 'problems' | 'git' | 'tests') => void;
  setIsBottomOpen: (open: boolean) => void;
}

export function useIdeDebugger({
  activeTab,
  cursorPos,
  setCursorPos,
  codeEditorRef,
  currentProjectDirectory,
  runConfigurations,
  activeConfigId,
  handleOpenFileAtLocation,
  addToast,
  setBottomTab,
  setIsBottomOpen,
}: UseIdeDebuggerOptions) {
  const {
    breakpoints,
    setBreakpoints,
    debugState,
    setDebugState,
    activeFrameId,
    setActiveFrameId,
    areBreakpointsMuted,
    setAreBreakpointsMuted,
    debugConsoleOutput,
    setDebugConsoleOutput,
    watches,
    setWatches,
  } = useDebuggerStore();

  const [dapFrames, setDapFrames] = useState<StackFrame[]>([]);
  const [dapVariables, setDapVariables] = useState<VariableItem[]>([]);

  const frames: StackFrame[] = useMemo(() => dapFrames, [dapFrames]);
  const variables: VariableItem[] = useMemo(() => dapVariables, [dapVariables]);

  // ─── 1. Breakpoint CRUD Handlers ───
  const handleToggleBreakpoint = useCallback((lineNumber: number) => {
    setBreakpoints(prev => {
      const existing = prev.find(
        bp => bp.lineNumber === lineNumber && (bp.filePath === activeTab?.path || bp.fileName === activeTab?.title || (!bp.filePath && !bp.fileName))
      );
      if (existing) {
        addToast('Breakpoint Removed', `Line ${lineNumber}`, 'info');
        return prev.filter(b => b.id !== existing.id);
      } else {
        addToast('Breakpoint Added', `Line ${lineNumber}`, 'success');
        return [
          ...prev,
          {
            id: `bp-${Date.now()}-${Math.random()}`,
            filePath: activeTab?.path || '',
            fileName: activeTab?.title || '',
            lineNumber,
            enabled: true,
          },
        ];
      }
    });
  }, [activeTab, setBreakpoints, addToast]);

  const handleUpdateBreakpoint = useCallback((updatedBp: Breakpoint) => {
    setBreakpoints(prev => prev.map(b => (b.id === updatedBp.id ? updatedBp : b)));
  }, [setBreakpoints]);

  const handleRemoveBreakpoint = useCallback((id: string) => {
    setBreakpoints(prev => prev.filter(b => b.id !== id));
  }, [setBreakpoints]);

  // ─── 2. Execution Stepping Actions ───
  const handleResumeDebug = useCallback(async () => {
    setDebugState('running');
    setDebugConsoleOutput(prev => [...prev, 'Program resumed (F9)']);
    addToast('Resume', 'Program execution resumed (F9)', 'info');
    try {
      await dapService.continue();
    } catch (e) {
      console.warn('DAP continue error:', e);
    }
  }, [setDebugState, setDebugConsoleOutput, addToast]);

  const handlePauseDebug = useCallback(async () => {
    setDebugState('paused');
    setDebugConsoleOutput(prev => [...prev, `Program suspended at ${activeTab?.title || 'file'}:${cursorPos.line}`]);
    addToast('Paused', 'Program suspended at execution point', 'warning');
    try {
      await dapService.pause();
    } catch (e) {
      console.warn('DAP pause error:', e);
    }
  }, [activeTab, cursorPos.line, setDebugState, setDebugConsoleOutput, addToast]);

  const handleStopDebug = useCallback(async () => {
    setDebugState('idle');
    setDebugConsoleOutput(prev => [...prev, 'Debugger session terminated (Ctrl+F2)']);
    addToast('Debugger Stopped', 'Process finished with exit code 0', 'info');
    try {
      await dapService.stop();
    } catch (e) {
      console.warn('DAP stop error:', e);
    }
  }, [setDebugState, setDebugConsoleOutput, addToast]);

  const handleStepOverDebug = useCallback(async () => {
    setDebugConsoleOutput(prev => [...prev, `Step Over executed -> line ${cursorPos.line + 1}`]);
    setCursorPos(p => ({ ...p, line: p.line + 1 }));
    codeEditorRef.current?.goToLine(cursorPos.line + 1, cursorPos.col);
    addToast('Step Over', `Stepped to line ${cursorPos.line + 1} (F8)`, 'info');
    try {
      await dapService.stepOver();
    } catch (e) {
      console.warn('DAP stepOver error:', e);
    }
  }, [cursorPos, setCursorPos, codeEditorRef, setDebugConsoleOutput, addToast]);

  const handleStepIntoDebug = useCallback(async () => {
    setDebugConsoleOutput(prev => [...prev, `Step Into executed at line ${cursorPos.line}`]);
    addToast('Step Into', 'Stepped into function call (F7)', 'info');
    try {
      await dapService.stepInto();
    } catch (e) {
      console.warn('DAP stepInto error:', e);
    }
  }, [cursorPos.line, setDebugConsoleOutput, addToast]);

  const handleStepOutDebug = useCallback(async () => {
    setDebugConsoleOutput(prev => [...prev, 'Step Out executed']);
    addToast('Step Out', 'Stepped out to caller (Shift+F8)', 'info');
    try {
      await dapService.stepOut();
    } catch (e) {
      console.warn('DAP stepOut error:', e);
    }
  }, [setDebugConsoleOutput, addToast]);

  // ─── 3. Synchronize Breakpoints with DAP ───
  useEffect(() => {
    if (activeTab?.path && dapService.isDebugging()) {
      const fileBps = breakpoints
        .filter(b => b.enabled && (b.filePath === activeTab.path || b.fileName === activeTab.title))
        .map(b => b.lineNumber);
      dapService.setBreakpoints(activeTab.path, fileBps).catch(e => {
        console.warn('Failed to sync DAP breakpoints:', e);
      });
    }
  }, [breakpoints, activeTab?.path, activeTab?.title]);

  // ─── 4. Listen to DAP Background Events ───
  useEffect(() => {
    const unsubStopped = dapService.onStopped(async (event) => {
      setDebugState('paused');
      const threadId = event.body.threadId ?? 1;
      setDebugConsoleOutput(prev => [
        ...prev,
        `[DAP] Thread #${threadId} stopped (${event.body.reason || 'breakpoint'}).`,
      ]);
      addToast('Debugger Paused', `Execution suspended: ${event.body.reason || 'breakpoint'}`, 'warning');

      try {
        const rawFrames = await dapService.getStackTrace();
        if (rawFrames && rawFrames.length > 0) {
          const mappedFrames: StackFrame[] = rawFrames.map(f => ({
            id: `frame-${f.id}`,
            name: f.name || `frame #${f.id}`,
            file: f.source?.name || f.source?.path?.split(/[\\/]/).pop() || 'unknown',
            line: f.line || 1,
            filePath: f.source?.path || '',
            isAppCode: !f.source?.path?.includes('node_modules') && !f.source?.path?.includes('.cargo'),
          }));
          setDapFrames(mappedFrames);

          const top = rawFrames[0];
          if (top.source?.path) {
            handleOpenFileAtLocation(top.source.path, top.line || 1, top.column || 1);
          } else if (top.line) {
            codeEditorRef.current?.goToLine(top.line, top.column || 1);
          }

          // Fetch real variables from scopes
          const scopes = await dapService.getScopes(top.id);
          if (scopes && scopes.length > 0) {
            const primaryScope = scopes.find((s: any) => s.name?.toLowerCase().includes('local')) || scopes[0];
            if (primaryScope.variablesReference) {
              const rawVars = await dapService.getVariables(primaryScope.variablesReference);
              setDapVariables((rawVars || []).map((v: any) => ({
                name: v.name,
                value: v.value,
                type: v.type || 'variable',
              })));
            }
          }

          // Re-evaluate active watches against current frame
          setWatches(prevWatches => {
            if (prevWatches.length === 0) return prevWatches;
            prevWatches.forEach(async (w) => {
              try {
                const evalRes = await dapService.evaluate(w.expression, top.id);
                setWatches(curr =>
                  curr.map(item =>
                    item.id === w.id
                      ? {
                          ...item,
                          value: evalRes.result,
                          type: evalRes.type || 'result',
                        }
                      : item
                  )
                );
              } catch (e: any) {
                setWatches(curr =>
                  curr.map(item =>
                    item.id === w.id
                      ? {
                          ...item,
                          value: `Error: ${e?.message || String(e)}`,
                          type: 'error',
                        }
                      : item
                  )
                );
              }
            });
            return prevWatches;
          });
        }
      } catch (err) {
        console.warn('Failed to fetch DAP stack/vars:', err);
      }
    });

    const unsubTerminated = dapService.onTerminated(() => {
      setDebugState('idle');
      setDapFrames([]);
      setDapVariables([]);
      setDebugConsoleOutput(prev => [...prev, '[DAP] Debug session terminated.']);
      addToast('Debugger Terminated', 'Debug process exited.', 'info');
    });

    const unsubOutput = dapService.onOutput((output) => {
      setDebugConsoleOutput(prev => [...prev, output.trimEnd()]);
    });

    return () => {
      unsubStopped();
      unsubTerminated();
      unsubOutput();
    };
  }, [handleOpenFileAtLocation, codeEditorRef, setDebugState, setDebugConsoleOutput, setWatches, addToast]);

  // ─── 5. Start Debug Action (Shift+F9 / Toolbar Debug) ───
  const handleStartDebug = useCallback(async () => {
    setBottomTab('debug');
    setIsBottomOpen(true);
    setDebugState('running');
    setDapFrames([]);
    setDapVariables([]);

    const activeCfg = runConfigurations.find(c => c.id === activeConfigId) || runConfigurations[0];
    const projectDir = activeCfg?.workingDirectory || currentProjectDirectory;
    const curPath = activeTab?.path || '';
    const isPy = curPath.endsWith('.py');
    const isJsTs = curPath.endsWith('.js') || curPath.endsWith('.ts') || curPath.endsWith('.tsx') || curPath.endsWith('.jsx');
    const isRs = curPath.endsWith('.rs');

    const cmd = activeCfg?.command || (isPy ? 'python' : isJsTs ? 'node' : isRs ? 'cargo' : 'node');
    const args = activeCfg?.args || (curPath ? [curPath] : []);

    let debugType = 'node';
    if (cmd.includes('python') || isPy) debugType = 'python';
    else if (cmd.includes('cargo') || cmd.includes('lldb') || isRs) debugType = 'lldb';

    setDebugConsoleOutput([
      `[DAP] Starting debug session...`,
      `[DAP] Target: ${cmd} ${args.join(' ')}`,
      `[DAP] Adapter type: ${debugType}`,
      `[DAP] Working directory: ${projectDir}`,
    ]);

    try {
      const sessionId = await dapService.startSession(
        curPath || cmd,
        args,
        projectDir,
        debugType
      );
      // Sync breakpoints to DAP
      const enabledBps = breakpoints.filter(b => b.enabled);
      const filesWithBps = Array.from(new Set(enabledBps.map(b => b.filePath).filter(Boolean)));
      for (const fp of filesWithBps) {
        const lines = enabledBps.filter(b => b.filePath === fp).map(b => b.lineNumber);
        await dapService.setBreakpoints(fp, lines);
      }
      setDebugConsoleOutput(prev => [...prev, `[DAP] Session attached (${sessionId}). Breakpoints synchronized.`]);
      addToast('Debugger Started', `DAP session attached (${debugType})`, 'success');
    } catch (err: any) {
      console.warn('Failed to start DAP session:', err);
      setDebugConsoleOutput(prev => [
        ...prev,
        `[DAP Notice] ${err?.message || String(err)}. Waiting for debug adapter...`,
      ]);
      addToast('Debugger Notice', `Debug session active`, 'info');
    }
  }, [
    setBottomTab,
    setIsBottomOpen,
    setDebugState,
    runConfigurations,
    activeConfigId,
    currentProjectDirectory,
    activeTab?.path,
    setDebugConsoleOutput,
    breakpoints,
    addToast,
  ]);

  // ─── 6. Run To Cursor Action (Alt+F9) ───
  const handleRunToCursor = useCallback(async () => {
    if (!activeTab?.path) return;
    const targetLine = cursorPos.line;
    setDebugConsoleOutput(prev => [...prev, `[DAP] Run to cursor at line ${targetLine}`]);
    addToast('Run to Cursor', `Advancing execution to line ${targetLine}`, 'info');
    try {
      if (dapService.isDebugging()) {
        const fileBps = breakpoints
          .filter(b => b.enabled && (b.filePath === activeTab.path || b.fileName === activeTab.title))
          .map(b => b.lineNumber);
        await dapService.setBreakpoints(activeTab.path, [...fileBps, targetLine]);
        await dapService.continue();
      }
    } catch (e) {
      console.warn('Failed to run to cursor:', e);
    }
  }, [activeTab?.path, activeTab?.title, cursorPos.line, setDebugConsoleOutput, addToast, breakpoints]);

  // ─── 7. Watch Expressions Handlers ───
  const handleAddWatch = useCallback(async (expr: string) => {
    const trimmed = expr.trim();
    if (!trimmed) return;
    const id = `w-${Date.now()}`;
    let val = 'not available (debugger not suspended)';
    let valType = 'expression';

    if (dapService.isDebugging()) {
      try {
        const evalRes = await dapService.evaluate(trimmed);
        val = evalRes.result;
        valType = evalRes.type || 'result';
      } catch (e: any) {
        val = `Error: ${e?.message || String(e)}`;
        valType = 'error';
      }
    }

    setWatches(prev => [
      ...prev.filter(w => w.expression !== trimmed),
      {
        id,
        expression: trimmed,
        value: val,
        type: valType,
      },
    ]);
    addToast('Watch Added', `Tracking '${trimmed}'`, 'success');
  }, [setWatches, addToast]);

  const handleRemoveWatch = useCallback((id: string) => {
    setWatches(prev => prev.filter(w => w.id !== id));
  }, [setWatches]);

  return {
    dapFrames,
    setDapFrames,
    dapVariables,
    setDapVariables,
    frames,
    variables,
    breakpoints,
    setBreakpoints,
    debugState,
    setDebugState,
    activeFrameId,
    setActiveFrameId,
    areBreakpointsMuted,
    setAreBreakpointsMuted,
    debugConsoleOutput,
    setDebugConsoleOutput,
    watches,
    setWatches,
    handleToggleBreakpoint,
    handleUpdateBreakpoint,
    handleRemoveBreakpoint,
    handleResumeDebug,
    handlePauseDebug,
    handleStopDebug,
    handleStepOverDebug,
    handleStepIntoDebug,
    handleStepOutDebug,
    handleStartDebug,
    handleRunToCursor,
    handleAddWatch,
    handleRemoveWatch,
  };
}
