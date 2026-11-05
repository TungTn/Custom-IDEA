import { create } from 'zustand';
import { Breakpoint, DebugState, StackFrame, VariableItem, WatchItem } from '../types';

export interface DebuggerState {
  breakpoints: Breakpoint[];
  debugState: DebugState;
  activeFrameId: string | null;
  areBreakpointsMuted: boolean;
  debugConsoleOutput: string[];
  watches: WatchItem[];
  dapFrames: StackFrame[];
  dapVariables: VariableItem[];

  setBreakpoints: (breakpoints: Breakpoint[] | ((prev: Breakpoint[]) => Breakpoint[])) => void;
  toggleBreakpoint: (bp: Breakpoint) => void;
  updateBreakpoint: (bp: Breakpoint) => void;
  removeBreakpoint: (id: string) => void;
  setDebugState: (state: DebugState) => void;
  setActiveFrameId: (frameId: string | null) => void;
  setAreBreakpointsMuted: (muted: boolean | ((prev: boolean) => boolean)) => void;
  setDebugConsoleOutput: (output: string[] | ((prev: string[]) => string[])) => void;
  addDebugConsoleLine: (line: string) => void;
  clearDebugConsole: () => void;
  setWatches: (watches: WatchItem[] | ((prev: WatchItem[]) => WatchItem[])) => void;
  addWatch: (expr: string) => void;
  removeWatch: (id: string) => void;
  setDapFrames: (frames: StackFrame[]) => void;
  setDapVariables: (variables: VariableItem[]) => void;
}

export const useDebuggerStore = create<DebuggerState>((set) => ({
  breakpoints: [],
  debugState: 'idle',
  activeFrameId: 'frame-1',
  areBreakpointsMuted: false,
  debugConsoleOutput: [
    'Connected to DAP debugger agent on localhost:5005',
    'Debugger initialized. Target architecture: x86_64-pc-windows-msvc',
    'All breakpoints registered and validated.',
  ],
  watches: [],
  dapFrames: [],
  dapVariables: [],

  setBreakpoints: (breakpointsOrUpdater) =>
    set((state) => ({
      breakpoints:
        typeof breakpointsOrUpdater === 'function'
          ? breakpointsOrUpdater(state.breakpoints)
          : breakpointsOrUpdater,
    })),

  toggleBreakpoint: (bp) =>
    set((state) => {
      const exists = state.breakpoints.some(
        (b) => b.filePath === bp.filePath && b.lineNumber === bp.lineNumber
      );
      if (exists) {
        return {
          breakpoints: state.breakpoints.filter(
            (b) => !(b.filePath === bp.filePath && b.lineNumber === bp.lineNumber)
          ),
        };
      }
      return { breakpoints: [...state.breakpoints, bp] };
    }),

  updateBreakpoint: (bp) =>
    set((state) => ({
      breakpoints: state.breakpoints.map((b) => (b.id === bp.id ? bp : b)),
    })),

  removeBreakpoint: (id) =>
    set((state) => ({
      breakpoints: state.breakpoints.filter((b) => b.id !== id),
    })),

  setDebugState: (debugState) => set({ debugState }),
  setActiveFrameId: (activeFrameId) => set({ activeFrameId }),
  setAreBreakpointsMuted: (mutedOrUpdater) =>
    set((state) => ({
      areBreakpointsMuted:
        typeof mutedOrUpdater === 'function'
          ? mutedOrUpdater(state.areBreakpointsMuted)
          : mutedOrUpdater,
    })),

  setDebugConsoleOutput: (outputOrUpdater) =>
    set((state) => ({
      debugConsoleOutput:
        typeof outputOrUpdater === 'function'
          ? outputOrUpdater(state.debugConsoleOutput)
          : outputOrUpdater,
    })),

  addDebugConsoleLine: (line) =>
    set((state) => ({
      debugConsoleOutput: [...state.debugConsoleOutput, line],
    })),

  clearDebugConsole: () => set({ debugConsoleOutput: [] }),

  setWatches: (watchesOrUpdater) =>
    set((state) => ({
      watches:
        typeof watchesOrUpdater === 'function'
          ? watchesOrUpdater(state.watches)
          : watchesOrUpdater,
    })),

  addWatch: (expr) =>
    set((state) => ({
      watches: [
        ...state.watches,
        {
          id: `watch-${Date.now()}`,
          expression: expr,
          value: 'pending...',
          type: 'evaluating',
        },
      ],
    })),

  removeWatch: (id) =>
    set((state) => ({
      watches: state.watches.filter((w) => w.id !== id),
    })),

  setDapFrames: (dapFrames) => set({ dapFrames }),
  setDapVariables: (dapVariables) => set({ dapVariables }),
}));
