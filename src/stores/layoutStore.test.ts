import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from './layoutStore';

describe('layoutStore', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      activeSideTab: 'project',
      isSideBarOpen: true,
      sideBarWidth: 320,
      activeRightPanel: null,
      bottomTab: 'run',
      isBottomOpen: true,
      bottomHeight: 240,
      hasOpenedTerminal: false,
      powerSaveMode: false,
      isStatusBarVisible: true,
    });
  });

  it('toggles sidebar visibility', () => {
    const { toggleSideBar } = useLayoutStore.getState();
    expect(useLayoutStore.getState().isSideBarOpen).toBe(true);

    toggleSideBar();
    expect(useLayoutStore.getState().isSideBarOpen).toBe(false);

    toggleSideBar();
    expect(useLayoutStore.getState().isSideBarOpen).toBe(true);
  });

  it('changes active side tab and opens sidebar automatically', () => {
    useLayoutStore.setState({ isSideBarOpen: false });
    const { setActiveSideTab } = useLayoutStore.getState();

    setActiveSideTab('git');
    const state = useLayoutStore.getState();
    expect(state.activeSideTab).toBe('git');
    expect(state.isSideBarOpen).toBe(true);
  });

  it('switches bottom tab and opens bottom panel', () => {
    useLayoutStore.setState({ isBottomOpen: false });
    const { setBottomTab } = useLayoutStore.getState();

    setBottomTab('terminal');
    const state = useLayoutStore.getState();
    expect(state.bottomTab).toBe('terminal');
    expect(state.isBottomOpen).toBe(true);
  });

  it('toggles right panel correctly', () => {
    const { toggleRightPanel } = useLayoutStore.getState();
    expect(useLayoutStore.getState().activeRightPanel).toBeNull();

    toggleRightPanel('database');
    expect(useLayoutStore.getState().activeRightPanel).toBe('database');

    // Toggling same panel closes it
    toggleRightPanel('database');
    expect(useLayoutStore.getState().activeRightPanel).toBeNull();

    // Toggling another panel switches to it
    toggleRightPanel('ai');
    expect(useLayoutStore.getState().activeRightPanel).toBe('ai');
  });

  it('toggles status bar visibility', () => {
    const { toggleStatusBar } = useLayoutStore.getState();
    expect(useLayoutStore.getState().isStatusBarVisible).toBe(true);

    toggleStatusBar();
    expect(useLayoutStore.getState().isStatusBarVisible).toBe(false);
  });
});
