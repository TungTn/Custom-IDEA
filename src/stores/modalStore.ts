import { create } from 'zustand';
import { FileNode } from '../types';

export interface ModalState {
  // Find in files
  isFindInFilesOpen: boolean;
  findInFilesMode: 'find' | 'replace';
  findInFilesInitialQuery: string;
  findInFilesDirectory: string;
  setIsFindInFilesOpen: (open: boolean) => void;
  setFindInFilesMode: (mode: 'find' | 'replace') => void;
  setFindInFilesInitialQuery: (q: string) => void;
  setFindInFilesDirectory: (dir: string) => void;
  openFindInFiles: (mode?: 'find' | 'replace', initialQuery?: string, directory?: string) => void;
  closeFindInFiles: () => void;

  // Search everywhere
  isSearchOpen: boolean;
  searchInitialTab: 'All' | 'Files' | 'Symbols' | 'Actions' | 'Text';
  setIsSearchOpen: (open: boolean) => void;
  setSearchInitialTab: (tab: 'All' | 'Files' | 'Symbols' | 'Actions' | 'Text') => void;
  openSearch: (tab?: 'All' | 'Files' | 'Symbols' | 'Actions' | 'Text') => void;
  closeSearch: () => void;

  // About & New file
  isAboutOpen: boolean;
  setIsAboutOpen: (open: boolean) => void;
  isNewFileOpen: boolean;
  setIsNewFileOpen: (open: boolean) => void;

  // Settings & Theme Studio
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isThemeStudioOpen: boolean;
  setIsThemeStudioOpen: (open: boolean) => void;
  isImportSettingsOpen: boolean;
  setIsImportSettingsOpen: (open: boolean) => void;
  isExportSettingsOpen: boolean;
  setIsExportSettingsOpen: (open: boolean) => void;

  // Go to line
  isGoToLineOpen: boolean;
  setIsGoToLineOpen: (open: boolean) => void;

  // Git Modals
  isCommitOpen: boolean;
  setIsCommitOpen: (open: boolean) => void;
  isBranchesOpen: boolean;
  setIsBranchesOpen: (open: boolean) => void;
  isStashOpen: boolean;
  setIsStashOpen: (open: boolean) => void;
  isVcsCloneOpen: boolean;
  setIsVcsCloneOpen: (open: boolean) => void;

  // Diff Modal
  isDiffModalOpen: boolean;
  activeDiffFile: string | null;
  diffBaseContent: string;
  diffLocalContent: string;
  setIsDiffModalOpen: (open: boolean) => void;
  setActiveDiffFile: (file: string | null) => void;
  setDiffBaseContent: (content: string) => void;
  setDiffLocalContent: (content: string) => void;
  openDiffModal: (fileName: string, baseContent: string, localContent: string) => void;
  closeDiffModal: () => void;

  // Rename Modal
  isRenameOpen: boolean;
  renameTarget: { type: 'file' | 'symbol'; name: string };
  setIsRenameOpen: (open: boolean) => void;
  setRenameTarget: (target: { type: 'file' | 'symbol'; name: string }) => void;
  openRenameModal: (target: { type: 'file' | 'symbol'; name: string }) => void;
  closeRenameModal: () => void;

  // Project Modals
  isNewProjectOpen: boolean;
  setIsNewProjectOpen: (open: boolean) => void;
  isProjectStructureOpen: boolean;
  setIsProjectStructureOpen: (open: boolean) => void;
  isInvalidateCachesOpen: boolean;
  setIsInvalidateCachesOpen: (open: boolean) => void;
  isLocalHistoryOpen: boolean;
  setIsLocalHistoryOpen: (open: boolean) => void;
  isRepairIdeOpen: boolean;
  setIsRepairIdeOpen: (open: boolean) => void;
  isOpenProjectPromptOpen: boolean;
  setIsOpenProjectPromptOpen: (open: boolean) => void;
  pendingTargetProject: FileNode | null;
  setPendingTargetProject: (node: FileNode | null) => void;

  // Run Config
  isRunConfigOpen: boolean;
  setIsRunConfigOpen: (open: boolean) => void;

  // Database
  isAddDataSourceOpen: boolean;
  setIsAddDataSourceOpen: (open: boolean) => void;

  // Debugger
  isBreakpointsOpen: boolean;
  setIsBreakpointsOpen: (open: boolean) => void;
  isEvaluateExpressionOpen: boolean;
  setIsEvaluateExpressionOpen: (open: boolean) => void;

  // Editor
  isClipboardHistoryOpen: boolean;
  setIsClipboardHistoryOpen: (open: boolean) => void;
  isStructuralSearchOpen: boolean;
  setIsStructuralSearchOpen: (open: boolean) => void;
  isSurroundWithOpen: boolean;
  setIsSurroundWithOpen: (open: boolean) => void;
  isTipOpen: boolean;
  setIsTipOpen: (open: boolean) => void;
}

export const useModalStore = create<ModalState>((set) => ({
  // Find in files
  isFindInFilesOpen: false,
  findInFilesMode: 'find',
  findInFilesInitialQuery: '',
  findInFilesDirectory: '',
  setIsFindInFilesOpen: (open) => set({ isFindInFilesOpen: open }),
  setFindInFilesMode: (mode) => set({ findInFilesMode: mode }),
  setFindInFilesInitialQuery: (q) => set({ findInFilesInitialQuery: q }),
  setFindInFilesDirectory: (dir) => set({ findInFilesDirectory: dir }),
  openFindInFiles: (mode = 'find', initialQuery = '', directory = '') =>
    set({
      isFindInFilesOpen: true,
      findInFilesMode: mode,
      findInFilesInitialQuery: initialQuery,
      findInFilesDirectory: directory,
    }),
  closeFindInFiles: () => set({ isFindInFilesOpen: false }),

  // Search everywhere
  isSearchOpen: false,
  searchInitialTab: 'All',
  setIsSearchOpen: (open) => set({ isSearchOpen: open }),
  setSearchInitialTab: (tab) => set({ searchInitialTab: tab }),
  openSearch: (tab = 'All') => set({ isSearchOpen: true, searchInitialTab: tab }),
  closeSearch: () => set({ isSearchOpen: false }),

  // About & New file
  isAboutOpen: false,
  setIsAboutOpen: (open) => set({ isAboutOpen: open }),
  isNewFileOpen: false,
  setIsNewFileOpen: (open) => set({ isNewFileOpen: open }),

  // Settings & Theme Studio
  isSettingsOpen: false,
  setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
  isThemeStudioOpen: false,
  setIsThemeStudioOpen: (open) => set({ isThemeStudioOpen: open }),
  isImportSettingsOpen: false,
  setIsImportSettingsOpen: (open) => set({ isImportSettingsOpen: open }),
  isExportSettingsOpen: false,
  setIsExportSettingsOpen: (open) => set({ isExportSettingsOpen: open }),

  // Go to line
  isGoToLineOpen: false,
  setIsGoToLineOpen: (open) => set({ isGoToLineOpen: open }),

  // Git Modals
  isCommitOpen: false,
  setIsCommitOpen: (open) => set({ isCommitOpen: open }),
  isBranchesOpen: false,
  setIsBranchesOpen: (open) => set({ isBranchesOpen: open }),
  isStashOpen: false,
  setIsStashOpen: (open) => set({ isStashOpen: open }),
  isVcsCloneOpen: false,
  setIsVcsCloneOpen: (open) => set({ isVcsCloneOpen: open }),

  // Diff Modal
  isDiffModalOpen: false,
  activeDiffFile: null,
  diffBaseContent: '',
  diffLocalContent: '',
  setIsDiffModalOpen: (open) => set({ isDiffModalOpen: open }),
  setActiveDiffFile: (file) => set({ activeDiffFile: file }),
  setDiffBaseContent: (content) => set({ diffBaseContent: content }),
  setDiffLocalContent: (content) => set({ diffLocalContent: content }),
  openDiffModal: (fileName, baseContent, localContent) =>
    set({
      isDiffModalOpen: true,
      activeDiffFile: fileName,
      diffBaseContent: baseContent,
      diffLocalContent: localContent,
    }),
  closeDiffModal: () => set({ isDiffModalOpen: false, activeDiffFile: null }),

  // Rename Modal
  isRenameOpen: false,
  renameTarget: { type: 'file', name: '' },
  setIsRenameOpen: (open) => set({ isRenameOpen: open }),
  setRenameTarget: (target) => set({ renameTarget: target }),
  openRenameModal: (target) => set({ isRenameOpen: true, renameTarget: target }),
  closeRenameModal: () => set({ isRenameOpen: false }),

  // Project Modals
  isNewProjectOpen: false,
  setIsNewProjectOpen: (open) => set({ isNewProjectOpen: open }),
  isProjectStructureOpen: false,
  setIsProjectStructureOpen: (open) => set({ isProjectStructureOpen: open }),
  isInvalidateCachesOpen: false,
  setIsInvalidateCachesOpen: (open) => set({ isInvalidateCachesOpen: open }),
  isLocalHistoryOpen: false,
  setIsLocalHistoryOpen: (open) => set({ isLocalHistoryOpen: open }),
  isRepairIdeOpen: false,
  setIsRepairIdeOpen: (open) => set({ isRepairIdeOpen: open }),
  isOpenProjectPromptOpen: false,
  setIsOpenProjectPromptOpen: (open) => set({ isOpenProjectPromptOpen: open }),
  pendingTargetProject: null,
  setPendingTargetProject: (node) => set({ pendingTargetProject: node }),

  // Run Config
  isRunConfigOpen: false,
  setIsRunConfigOpen: (open) => set({ isRunConfigOpen: open }),

  // Database
  isAddDataSourceOpen: false,
  setIsAddDataSourceOpen: (open) => set({ isAddDataSourceOpen: open }),

  // Debugger
  isBreakpointsOpen: false,
  setIsBreakpointsOpen: (open) => set({ isBreakpointsOpen: open }),
  isEvaluateExpressionOpen: false,
  setIsEvaluateExpressionOpen: (open) => set({ isEvaluateExpressionOpen: open }),

  // Editor
  isClipboardHistoryOpen: false,
  setIsClipboardHistoryOpen: (open) => set({ isClipboardHistoryOpen: open }),
  isStructuralSearchOpen: false,
  setIsStructuralSearchOpen: (open) => set({ isStructuralSearchOpen: open }),
  isSurroundWithOpen: false,
  setIsSurroundWithOpen: (open) => set({ isSurroundWithOpen: open }),
  isTipOpen: false,
  setIsTipOpen: (open) => set({ isTipOpen: open }),
}));
