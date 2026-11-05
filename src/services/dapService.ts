import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface DapStoppedEvent {
  session_id: string;
  body: {
    reason: string;
    description?: string;
    threadId?: number;
    text?: string;
    allThreadsStopped?: boolean;
    hitBreakpointIds?: number[];
  };
}

export interface DapOutputEvent {
  session_id: string;
  output: string;
}

export interface DapStackFrame {
  id: number;
  name: string;
  line: number;
  column: number;
  source?: {
    name?: string;
    path?: string;
  };
}

export interface DapVariable {
  name: string;
  value: string;
  type?: string;
  variablesReference?: number;
}

class DapService {
  private activeSessionId: string | null = null;
  private stoppedListeners = new Set<(event: DapStoppedEvent) => void>();
  private terminatedListeners = new Set<() => void>();
  private outputListeners = new Set<(output: string) => void>();
  private unlisteners: UnlistenFn[] = [];

  constructor() {
    this.initEventListeners();
  }

  private async initEventListeners() {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      return;
    }
    try {
      const u1 = await listen<DapStoppedEvent>('dap-stopped', (e) => {
        for (const l of this.stoppedListeners) {
          l(e.payload);
        }
      });
      const u2 = await listen('dap-terminated', () => {
        this.activeSessionId = null;
        for (const l of this.terminatedListeners) {
          l();
        }
      });
      const u3 = await listen<DapOutputEvent>('dap-output', (e) => {
        for (const l of this.outputListeners) {
          l(e.payload.output);
        }
      });
      this.unlisteners.push(u1, u2, u3);
    } catch (e) {
      console.warn('Failed to listen to DAP events:', e);
    }
  }

  public onStopped(cb: (event: DapStoppedEvent) => void): () => void {
    this.stoppedListeners.add(cb);
    return () => this.stoppedListeners.delete(cb);
  }

  public onTerminated(cb: () => void): () => void {
    this.terminatedListeners.add(cb);
    return () => this.terminatedListeners.delete(cb);
  }

  public onOutput(cb: (output: string) => void): () => void {
    this.outputListeners.add(cb);
    return () => this.outputListeners.delete(cb);
  }

  public async startSession(
    program: string,
    args: string[] = [],
    cwd?: string,
    debugType: string = 'node'
  ): Promise<string> {
    const sessionId = `dap-${Date.now()}`;
    await invoke<string>('dap_start_session', {
      sessionId,
      program,
      args,
      cwd,
      debugType,
    });
    this.activeSessionId = sessionId;
    return sessionId;
  }

  public async setBreakpoints(filePath: string, lines: number[]): Promise<number[]> {
    if (!this.activeSessionId) return lines;
    return await invoke<number[]>('dap_set_breakpoints', {
      sessionId: this.activeSessionId,
      filePath,
      lines,
    });
  }

  public async continue(): Promise<void> {
    if (!this.activeSessionId) return;
    await invoke('dap_continue', { sessionId: this.activeSessionId });
  }

  public async stepOver(): Promise<void> {
    if (!this.activeSessionId) return;
    await invoke('dap_step_over', { sessionId: this.activeSessionId });
  }

  public async stepInto(): Promise<void> {
    if (!this.activeSessionId) return;
    await invoke('dap_step_into', { sessionId: this.activeSessionId });
  }

  public async stepOut(): Promise<void> {
    if (!this.activeSessionId) return;
    await invoke('dap_step_out', { sessionId: this.activeSessionId });
  }

  public async pause(): Promise<void> {
    if (!this.activeSessionId) return;
    await invoke('dap_pause', { sessionId: this.activeSessionId });
  }

  public async stop(): Promise<void> {
    if (!this.activeSessionId) return;
    const sid = this.activeSessionId;
    this.activeSessionId = null;
    await invoke('dap_stop', { sessionId: sid });
  }

  public async getStackTrace(): Promise<DapStackFrame[]> {
    if (!this.activeSessionId) return [];
    return await invoke<DapStackFrame[]>('dap_get_stack_trace', { sessionId: this.activeSessionId });
  }

  public async getScopes(frameId: number): Promise<any[]> {
    if (!this.activeSessionId) return [];
    return await invoke<any[]>('dap_get_scopes', {
      sessionId: this.activeSessionId,
      frameId,
    });
  }

  public async getVariables(variablesReference: number): Promise<any[]> {
    if (!this.activeSessionId) return [];
    return await invoke<any[]>('dap_get_variables', {
      sessionId: this.activeSessionId,
      variablesReference,
    });
  }

  public async evaluate(
    expression: string,
    frameId?: number
  ): Promise<{ result: string; type?: string; variablesReference?: number }> {
    if (!this.activeSessionId) throw new Error('No active DAP session');
    const res = await invoke<any>('dap_evaluate', {
      sessionId: this.activeSessionId,
      expression,
      frameId: frameId ?? null,
    });
    return {
      result: res.result || res.value || JSON.stringify(res),
      type: res.type,
      variablesReference: res.variablesReference,
    };
  }

  public isDebugging(): boolean {
    return this.activeSessionId !== null;
  }
}

export const dapService = new DapService();
