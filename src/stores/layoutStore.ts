import { create } from 'zustand';

export type BottomTabType = 'find' | 'run' | 'debug' | 'terminal' | 'problems' | 'git' | 'tests' | 'sonar';

export interface LayoutState {
  activeSideTab: string;
  isSideBarOpen: boolean;
  sideBarWidth: number;
  activeRightPanel: string | null;
  bottomTab: BottomTabType;
  isBottomOpen: boolean;
  bottomHeight: number;
  hasOpenedTerminal: boolean;
  powerSaveMode: boolean;

  setActiveSideTab: (tab: string) => void;
  toggleSideBar: () => void;
  setIsSideBarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setSideBarWidth: (width: number | ((prev: number) => number)) => void;
  setActiveRightPanel: (panel: string | null | ((prev: string | null) => string | null)) => void;
  toggleRightPanel: (panel: string) => void;
  setBottomTab: (tab: BottomTabType) => void;
  setIsBottomOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggleBottom: () => void;
  setBottomHeight: (height: number | ((prev: number) => number)) => void;
  setHasOpenedTerminal: (opened: boolean) => void;
  setPowerSaveMode: (mode: boolean | ((prev: boolean) => boolean)) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  activeSideTab: 'project',
  isSideBarOpen: true,
  sideBarWidth: 320,
  activeRightPanel: null,
  bottomTab: 'run',
  isBottomOpen: true,
  bottomHeight: 240,
  hasOpenedTerminal: false,
  powerSaveMode: false,

  setActiveSideTab: (tab) => set({ activeSideTab: tab, isSideBarOpen: true }),
  toggleSideBar: () => set((state) => ({ isSideBarOpen: !state.isSideBarOpen })),
  setIsSideBarOpen: (openOrUpdater) =>
    set((state) => ({
      isSideBarOpen:
        typeof openOrUpdater === 'function' ? openOrUpdater(state.isSideBarOpen) : openOrUpdater,
    })),
  setSideBarWidth: (widthOrUpdater) =>
    set((state) => ({
      sideBarWidth:
        typeof widthOrUpdater === 'function' ? widthOrUpdater(state.sideBarWidth) : widthOrUpdater,
    })),

  setActiveRightPanel: (panelOrUpdater) =>
    set((state) => ({
      activeRightPanel:
        typeof panelOrUpdater === 'function'
          ? panelOrUpdater(state.activeRightPanel)
          : panelOrUpdater,
    })),
  toggleRightPanel: (panel) =>
    set((state) => ({
      activeRightPanel: state.activeRightPanel === panel ? null : panel,
    })),

  setBottomTab: (tab) => set({ bottomTab: tab, isBottomOpen: true }),
  setIsBottomOpen: (openOrUpdater) =>
    set((state) => ({
      isBottomOpen:
        typeof openOrUpdater === 'function' ? openOrUpdater(state.isBottomOpen) : openOrUpdater,
    })),
  toggleBottom: () => set((state) => ({ isBottomOpen: !state.isBottomOpen })),
  setBottomHeight: (heightOrUpdater) =>
    set((state) => ({
      bottomHeight:
        typeof heightOrUpdater === 'function' ? heightOrUpdater(state.bottomHeight) : heightOrUpdater,
    })),
  setHasOpenedTerminal: (opened) => set({ hasOpenedTerminal: opened }),
  setPowerSaveMode: (modeOrUpdater) =>
    set((state) => ({
      powerSaveMode:
        typeof modeOrUpdater === 'function' ? modeOrUpdater(state.powerSaveMode) : modeOrUpdater,
    })),
}));
