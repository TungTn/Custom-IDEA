import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editorStore';
import { OpenTab } from '../types';

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.setState({
      tabs: [],
      activeTabId: null,
      cursorPos: { line: 1, col: 1 },
      activePausedLine: null,
      splitMode: 'none',
      activePane: 'primary',
      secondaryTabId: null,
      tertiaryTabId: null,
      quaternaryTabId: null,
    });
  });

  const sampleTab1: OpenTab = {
    id: 'tab-1',
    title: 'main.rs',
    path: '/project/src/main.rs',
    content: 'fn main() {}',
    language: 'rust',
  };

  const sampleTab2: OpenTab = {
    id: 'tab-2',
    title: 'lib.rs',
    path: '/project/src/lib.rs',
    content: 'pub fn run() {}',
    language: 'rust',
  };

  it('opens a new tab and activates it', () => {
    const { openTab } = useEditorStore.getState();
    openTab(sampleTab1);

    const state = useEditorStore.getState();
    expect(state.tabs.length).toBe(1);
    expect(state.tabs[0].id).toBe('tab-1');
    expect(state.activeTabId).toBe('tab-1');
  });

  it('selects existing tab instead of duplicating', () => {
    const { openTab } = useEditorStore.getState();
    openTab(sampleTab1);
    openTab(sampleTab2);
    expect(useEditorStore.getState().tabs.length).toBe(2);

    // Re-open tab 1
    openTab({ ...sampleTab1, content: 'updated content' });
    const state = useEditorStore.getState();
    expect(state.tabs.length).toBe(2);
    expect(state.activeTabId).toBe('tab-1');
  });

  it('updates tab content and dirty state', () => {
    const { openTab, updateContent } = useEditorStore.getState();
    openTab(sampleTab1);

    updateContent('tab-1', 'fn main() { println!("hi"); }');
    const tab = useEditorStore.getState().tabs.find(t => t.id === 'tab-1');
    expect(tab?.content).toBe('fn main() { println!("hi"); }');
    expect(tab?.isDirty).toBe(true);
  });

  it('closes active tab and selects adjacent tab', () => {
    const { openTab, closeTab } = useEditorStore.getState();
    openTab(sampleTab1);
    openTab(sampleTab2);
    expect(useEditorStore.getState().activeTabId).toBe('tab-2');

    closeTab('tab-2');
    const state = useEditorStore.getState();
    expect(state.tabs.length).toBe(1);
    expect(state.activeTabId).toBe('tab-1');
  });

  it('closes all tabs and clears activeTabId', () => {
    const { openTab, closeAllTabs } = useEditorStore.getState();
    openTab(sampleTab1);
    openTab(sampleTab2);

    closeAllTabs();
    const state = useEditorStore.getState();
    expect(state.tabs.length).toBe(0);
    expect(state.activeTabId).toBeNull();
  });
});
