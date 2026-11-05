import { create } from 'zustand';
import { OpenTab } from '../types';

export type CursorPos = { line: number; col: number };
export type CursorPosUpdater = (prev: CursorPos) => CursorPos;
export type SplitMode = 'none' | 'vertical' | 'horizontal' | 'grid';
export type PaneId = 'primary' | 'secondary' | 'tertiary' | 'quaternary';

export interface EditorState {
  tabs: OpenTab[];
  activeTabId: string | null;
  cursorPos: CursorPos;
  activePausedLine: { filePath: string; line: number } | null;
  editorEngine: 'monaco' | 'codemirror';

  // Split state
  splitMode: SplitMode;
  activePane: PaneId;
  secondaryTabId: string | null;
  tertiaryTabId: string | null;
  quaternaryTabId: string | null;

  // Actions
  setSplitMode: (mode: SplitMode) => void;
  setActivePane: (pane: PaneId) => void;
  setPaneTabId: (pane: PaneId, tabId: string | null) => void;
  splitRight: (targetTabId?: string) => void;
  splitDown: (targetTabId?: string) => void;
  splitGrid: () => void;
  unsplit: () => void;
  setTabs: (tabs: OpenTab[] | ((prev: OpenTab[]) => OpenTab[])) => void;
  openTab: (tab: OpenTab) => void;
  selectTab: (tabId: string | null) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  closeUnmodifiedTabs: () => void;
  closeTabsLeft: (tabId: string) => void;
  closeTabsRight: (tabId: string) => void;
  updateContent: (tabId: string, newContent: string) => void;
  setCursorPos: (lineOrPosOrUpdater: number | CursorPos | CursorPosUpdater, maybeCol?: number) => void;
  setActivePausedLine: (paused: { filePath: string; line: number } | null) => void;
  setEditorEngine: (engine: 'monaco' | 'codemirror') => void;
  toggleEditorEngine: () => void;
  getActiveTab: () => OpenTab | undefined;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  cursorPos: { line: 1, col: 1 },
  activePausedLine: null,
  editorEngine: (localStorage.getItem('ij_editor_engine') as 'monaco' | 'codemirror') || 'codemirror',
  splitMode: 'none',
  activePane: 'primary',
  secondaryTabId: null,
  tertiaryTabId: null,
  quaternaryTabId: null,

  setSplitMode: (mode) => set({ splitMode: mode }),
  setActivePane: (pane) => set({ activePane: pane }),
  setPaneTabId: (pane, tabId) => {
    if (pane === 'primary') set({ activeTabId: tabId });
    else if (pane === 'secondary') set({ secondaryTabId: tabId });
    else if (pane === 'tertiary') set({ tertiaryTabId: tabId });
    else if (pane === 'quaternary') set({ quaternaryTabId: tabId });
  },

  splitRight: (targetTabId) => {
    const state = get();
    const candidate = targetTabId || state.tabs.find(t => t.id !== state.activeTabId)?.id || state.activeTabId;
    set({
      splitMode: 'vertical',
      secondaryTabId: candidate,
      activePane: 'secondary',
    });
  },

  splitDown: (targetTabId) => {
    const state = get();
    const candidate = targetTabId || state.tabs.find(t => t.id !== state.activeTabId)?.id || state.activeTabId;
    set({
      splitMode: 'horizontal',
      secondaryTabId: candidate,
      activePane: 'secondary',
    });
  },

  splitGrid: () => {
    const state = get();
    const tabs = state.tabs;
    set({
      splitMode: 'grid',
      secondaryTabId: tabs[1]?.id || state.activeTabId,
      tertiaryTabId: tabs[2]?.id || tabs[0]?.id || null,
      quaternaryTabId: tabs[3]?.id || tabs[1]?.id || null,
    });
  },

  unsplit: () => {
    set({
      splitMode: 'none',
      secondaryTabId: null,
      tertiaryTabId: null,
      quaternaryTabId: null,
      activePane: 'primary',
    });
  },

  setTabs: (tabsOrUpdater) => {
    set((state) => ({
      tabs: typeof tabsOrUpdater === 'function' ? tabsOrUpdater(state.tabs) : tabsOrUpdater,
    }));
  },

  openTab: (newTab) => {
    set((state) => {
      const existing = state.tabs.find((t) => t.id === newTab.id || t.path === newTab.path);
      if (existing) {
        return { activeTabId: existing.id };
      }
      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      };
    });
  },

  selectTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  closeTab: (tabId) => {
    set((state) => {
      const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
      if (tabIndex === -1) return state;

      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      let newActiveId = state.activeTabId;

      if (state.activeTabId === tabId) {
        if (newTabs.length === 0) {
          newActiveId = null;
        } else if (tabIndex < newTabs.length) {
          newActiveId = newTabs[tabIndex].id;
        } else {
          newActiveId = newTabs[newTabs.length - 1].id;
        }
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveId,
      };
    });
  },

  closeOtherTabs: (tabId) => {
    set((state) => ({
      tabs: state.tabs.filter((t) => t.id === tabId),
      activeTabId: tabId,
    }));
  },

  closeAllTabs: () => {
    set({
      tabs: [],
      activeTabId: null,
    });
  },

  closeUnmodifiedTabs: () => {
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.isDirty);
      const newActiveId = newTabs.some((t) => t.id === state.activeTabId)
        ? state.activeTabId
        : newTabs[0]?.id || null;
      return {
        tabs: newTabs,
        activeTabId: newActiveId,
      };
    });
  },

  closeTabsLeft: (tabId) => {
    set((state) => {
      const idx = state.tabs.findIndex((t) => t.id === tabId);
      if (idx <= 0) return state;
      const newTabs = state.tabs.slice(idx);
      const newActiveId = newTabs.some((t) => t.id === state.activeTabId)
        ? state.activeTabId
        : tabId;
      return {
        tabs: newTabs,
        activeTabId: newActiveId,
      };
    });
  },

  closeTabsRight: (tabId) => {
    set((state) => {
      const idx = state.tabs.findIndex((t) => t.id === tabId);
      if (idx === -1 || idx === state.tabs.length - 1) return state;
      const newTabs = state.tabs.slice(0, idx + 1);
      const newActiveId = newTabs.some((t) => t.id === state.activeTabId)
        ? state.activeTabId
        : tabId;
      return {
        tabs: newTabs,
        activeTabId: newActiveId,
      };
    });
  },

  updateContent: (tabId, newContent) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, content: newContent, isDirty: true } : tab
      ),
    }));
  },

  setCursorPos: (lineOrPosOrUpdater, maybeCol) => {
    set((state) => {
      if (typeof lineOrPosOrUpdater === 'function') {
        return { cursorPos: lineOrPosOrUpdater(state.cursorPos) };
      }
      if (typeof lineOrPosOrUpdater === 'object' && lineOrPosOrUpdater !== null) {
        return { cursorPos: lineOrPosOrUpdater };
      }
      return { cursorPos: { line: lineOrPosOrUpdater, col: maybeCol ?? 1 } };
    });
  },

  setActivePausedLine: (paused) => {
    set({ activePausedLine: paused });
  },

  setEditorEngine: (engine) => {
    localStorage.setItem('ij_editor_engine', engine);
    set({ editorEngine: engine });
  },

  toggleEditorEngine: () => {
    set((state) => {
      const next = state.editorEngine === 'monaco' ? 'codemirror' : 'monaco';
      localStorage.setItem('ij_editor_engine', next);
      return { editorEngine: next };
    });
  },

  getActiveTab: () => {
    const state = get();
    return state.tabs.find((t) => t.id === state.activeTabId);
  },
}));
