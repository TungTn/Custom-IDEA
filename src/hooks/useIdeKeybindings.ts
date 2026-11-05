import React, { useEffect } from 'react';
import { useModalStore, useSettingsStore } from '../stores';
import { CodeEditorHandle } from '../workbench';

export interface UseIdeKeybindingsOptions {
  codeEditorRef: React.RefObject<CodeEditorHandle>;
  handleSaveActive: () => void | Promise<void>;
  handleCloseActiveTab: () => void;
  handleMenuAction: (actionId: string) => void;
  handleRun: () => void | Promise<void>;
  handleStop: () => void | Promise<void>;
  handleGoToTest: () => void | Promise<void>;
  handleOpenProject: () => void | Promise<void>;
  handleOpenFindInFiles: (mode: 'find' | 'replace') => void;
  handleOpenCurrentFileDiff: () => void;
}

/**
 * Custom hook managing IntelliJ IDEA global keyboard shortcuts and event listeners.
 * Handles Double Shift detection (Search Everywhere), modal dismissals via Escape,
 * editor shortcuts, and tool window toggling.
 */
export function useIdeKeybindings({
  codeEditorRef,
  handleSaveActive,
  handleCloseActiveTab,
  handleMenuAction,
  handleRun,
  handleStop,
  handleGoToTest,
  handleOpenProject,
  handleOpenFindInFiles,
  handleOpenCurrentFileDiff,
}: UseIdeKeybindingsOptions) {
  const { settings } = useSettingsStore();
  const {
    isSettingsOpen, setIsSettingsOpen,
    isAboutOpen, setIsAboutOpen,
    isNewFileOpen, setIsNewFileOpen,
    isRenameOpen, setIsRenameOpen,
    isDiffModalOpen, setIsDiffModalOpen,
    isCommitOpen, setIsCommitOpen,
    isBranchesOpen, setIsBranchesOpen,
    isRunConfigOpen, setIsRunConfigOpen,
    isNewProjectOpen, setIsNewProjectOpen,
    isProjectStructureOpen, setIsProjectStructureOpen,
    isInvalidateCachesOpen, setIsInvalidateCachesOpen,
    isLocalHistoryOpen, setIsLocalHistoryOpen,
    isRepairIdeOpen, setIsRepairIdeOpen,
    isOpenProjectPromptOpen, setIsOpenProjectPromptOpen,
    isFindInFilesOpen, setIsFindInFilesOpen,
    isSearchOpen, setIsSearchOpen,
    isGoToLineOpen, setIsGoToLineOpen,
    isTipOpen, setIsTipOpen,
    isClipboardHistoryOpen, setIsClipboardHistoryOpen,
    isStructuralSearchOpen, setIsStructuralSearchOpen,
    setSearchInitialTab,
  } = useModalStore();

  useEffect(() => {
    let shiftDownTime = 0;
    let shiftPressedAlone = false;
    let lastShiftReleaseTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key to dismiss any active modal
      if (e.key === 'Escape') {
        if (isSettingsOpen) { setIsSettingsOpen(false); return; }
        if (isAboutOpen) { setIsAboutOpen(false); return; }
        if (isNewFileOpen) { setIsNewFileOpen(false); return; }
        if (isRenameOpen) { setIsRenameOpen(false); return; }
        if (isDiffModalOpen) { setIsDiffModalOpen(false); return; }
        if (isCommitOpen) { setIsCommitOpen(false); return; }
        if (isBranchesOpen) { setIsBranchesOpen(false); return; }
        if (isRunConfigOpen) { setIsRunConfigOpen(false); return; }
        if (isNewProjectOpen) { setIsNewProjectOpen(false); return; }
        if (isProjectStructureOpen) { setIsProjectStructureOpen(false); return; }
        if (isInvalidateCachesOpen) { setIsInvalidateCachesOpen(false); return; }
        if (isLocalHistoryOpen) { setIsLocalHistoryOpen(false); return; }
        if (isRepairIdeOpen) { setIsRepairIdeOpen(false); return; }
        if (isOpenProjectPromptOpen) { setIsOpenProjectPromptOpen(false); return; }
        if (isFindInFilesOpen) { setIsFindInFilesOpen(false); return; }
        if (isSearchOpen) { setIsSearchOpen(false); return; }
        if (isGoToLineOpen) { setIsGoToLineOpen(false); return; }
        if (isTipOpen) { setIsTipOpen(false); return; }
        if (isClipboardHistoryOpen) { setIsClipboardHistoryOpen(false); return; }
        if (isStructuralSearchOpen) { setIsStructuralSearchOpen(false); return; }
      }

      // Authentic IntelliJ IDEA Double Shift detection
      if (e.key === 'Shift') {
        // Never trigger on held key auto-repeat
        if (e.repeat) return;
        // Never trigger if modifier combos are held
        if (e.ctrlKey || e.altKey || e.metaKey) {
          shiftPressedAlone = false;
          lastShiftReleaseTime = 0;
          return;
        }

        const now = Date.now();
        const timeout = settings.doubleShiftTimeout || 350;

        // If a standalone Shift was tapped and released within timeout, this is the 2nd tap!
        if (lastShiftReleaseTime > 0 && (now - lastShiftReleaseTime < timeout)) {
          setSearchInitialTab('All');
          setIsSearchOpen(true);
          lastShiftReleaseTime = 0;
          shiftPressedAlone = false;
          return;
        }

        shiftPressedAlone = true;
        shiftDownTime = now;
        return;
      } else {
        // Any other key pressed means Shift is part of a combo, not alone
        shiftPressedAlone = false;
        lastShiftReleaseTime = 0;
      }

      // Ctrl + Shift + A (Search Everywhere - Actions)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSearchInitialTab('Actions');
        setIsSearchOpen(true);
        return;
      }

      // Ctrl + Alt + Shift + N (Search Everywhere - Symbols)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setSearchInitialTab('Symbols');
        setIsSearchOpen(true);
        return;
      }

      // Ctrl + Shift + N (Search Files)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setSearchInitialTab('Files');
        setIsSearchOpen(true);
        return;
      }

      // Ctrl + Shift + T (Navigate to Test / Create Test)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleGoToTest();
        return;
      }

      // Ctrl + Shift + V (Paste from History)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setIsClipboardHistoryOpen(true);
        return;
      }

      // Ctrl + Shift + S (Structural Search)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsStructuralSearchOpen(true);
        return;
      }

      // Ctrl + Shift + F (Find in Files)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleOpenFindInFiles('find');
        return;
      }

      // Ctrl + N or Alt + Insert (New File)
      if (((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') || (e.altKey && e.key === 'Insert')) {
        e.preventDefault();
        setIsNewFileOpen(true);
        return;
      }

      // Ctrl + R (Replace in file - prevent webview reload)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        codeEditorRef.current?.triggerReplace();
        return;
      }

      // Ctrl + F (Find in file)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        codeEditorRef.current?.triggerFind();
        return;
      }

      // Ctrl + Y (Delete line)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        codeEditorRef.current?.deleteLine();
        return;
      }

      // Ctrl + Alt + S (Settings)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsSettingsOpen(true);
        return;
      }

      // Ctrl + G (Go to Line)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setIsGoToLineOpen(true);
        return;
      }

      // Shift + F6 (Rename)
      if (e.shiftKey && e.key === 'F6') {
        e.preventDefault();
        setIsRenameOpen(true);
        return;
      }

      // Ctrl + O (Open Project)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenProject();
        return;
      }

      // Ctrl + K (Git Commit)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.shiftKey) {
        e.preventDefault();
        setIsCommitOpen(true);
        return;
      }

      // Ctrl + Shift + K (Git Commit & Push)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommitOpen(true);
        return;
      }

      // Ctrl + S (Save)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveActive();
        return;
      }

      // Ctrl + W (Close active tab)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        handleCloseActiveTab();
        return;
      }

      // Reformat code: Ctrl + Alt + L OR Alt + Shift + F
      if (
        ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'l') ||
        (e.altKey && e.shiftKey && e.key.toLowerCase() === 'f')
      ) {
        e.preventDefault();
        handleMenuAction('code.format');
        return;
      }

      // Ctrl + / (Comment line)
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        codeEditorRef.current?.commentLine();
        return;
      }

      // Duplicate line: Ctrl + D or Ctrl + Alt + Down
      const isCtrlD = (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'd';
      const isCtrlAltDown = (e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'ArrowDown' || e.key === 'Down');
      if (isCtrlD || isCtrlAltDown) {
        e.preventDefault();
        codeEditorRef.current?.duplicateLine();
        return;
      }

      // Alt+Shift+B: Annotate with Git Blame
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        codeEditorRef.current?.toggleGitBlame();
        return;
      }

      // Alt + 1 (Toggle Project sidebar)
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        handleMenuAction('view.toggleProject');
        return;
      }

      // Alt + 7 (Toggle Structure tool window)
      if (e.altKey && e.key === '7') {
        e.preventDefault();
        handleMenuAction('view.toggleStructure');
        return;
      }

      // Alt + 4 (Toggle Run console)
      if (e.altKey && e.key === '4') {
        e.preventDefault();
        handleMenuAction('view.toggleRun');
        return;
      }

      // Alt + 9 (Toggle Git tool window)
      if (e.altKey && e.key === '9') {
        e.preventDefault();
        handleMenuAction('view.toggleGit');
        return;
      }

      // Ctrl + Shift + R or Ctrl + Shift + H (Replace in Files)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'h')) {
        e.preventDefault();
        handleOpenFindInFiles('replace');
        return;
      }

      // Ctrl + Alt + D (Compare active file with HEAD / Diff Viewer)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleOpenCurrentFileDiff();
        return;
      }

      // Alt + F12 (Toggle Terminal)
      if (e.altKey && e.key === 'F12') {
        e.preventDefault();
        handleMenuAction('view.toggleTerminal');
        return;
      }

      // Alt + Shift + F10 (Select / Edit Run Configuration)
      if (e.altKey && e.shiftKey && e.key === 'F10') {
        e.preventDefault();
        setIsRunConfigOpen(true);
        return;
      }

      // Shift + F10 (Run)
      if (e.shiftKey && e.key === 'F10') {
        e.preventDefault();
        handleRun();
        return;
      }

      // Ctrl + F9 (Build)
      if ((e.ctrlKey || e.metaKey) && e.key === 'F9') {
        e.preventDefault();
        handleRun();
        return;
      }

      // Ctrl + F2 (Stop)
      if ((e.ctrlKey || e.metaKey) && e.key === 'F2') {
        e.preventDefault();
        handleStop();
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        const now = Date.now();
        // Only count as a valid 1st tap if Shift was pressed alone and released within 350ms
        if (shiftPressedAlone && (now - shiftDownTime < 350)) {
          lastShiftReleaseTime = now;
        } else {
          lastShiftReleaseTime = 0;
        }
        shiftPressedAlone = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [
    handleSaveActive, handleCloseActiveTab, handleMenuAction, handleRun, handleStop,
    handleGoToTest, isClipboardHistoryOpen, isStructuralSearchOpen,
    isSettingsOpen, isAboutOpen, isNewFileOpen, isRenameOpen, isCommitOpen, isDiffModalOpen,
    isBranchesOpen, isRunConfigOpen, isNewProjectOpen, isProjectStructureOpen,
    isInvalidateCachesOpen, isLocalHistoryOpen, isRepairIdeOpen, isOpenProjectPromptOpen,
    isSearchOpen, isGoToLineOpen, isTipOpen, settings.doubleShiftTimeout,
  ]);

  // Custom IntelliJ Editor Events (dispatched from CodeMirror keymaps)
  useEffect(() => {
    const handleOpenClip = () => setIsClipboardHistoryOpen(true);
    const handleGoTest = () => handleGoToTest();
    window.addEventListener('intellij:open-clipboard-history', handleOpenClip);
    window.addEventListener('intellij:goto-test', handleGoTest);
    return () => {
      window.removeEventListener('intellij:open-clipboard-history', handleOpenClip);
      window.removeEventListener('intellij:goto-test', handleGoTest);
    };
  }, [handleGoToTest, setIsClipboardHistoryOpen]);
}
