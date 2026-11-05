import React from 'react';
import {
  useModalStore,
  useSettingsStore,
  useProjectStore,
  useEditorStore,
  useDebuggerStore,
  useNotificationStore,
} from '../stores';
import { OpenTab, RunConfiguration, FileNode, ActionItem, VariableItem, Breakpoint } from '../types';
import { DataSourceConnection } from '../types/database';
import { IdeThemeId, SyntaxTokenColors } from '../types/theme';
import { ModalErrorBoundary } from './ModalErrorBoundary';

// Lazy-loaded Dialogs & Modals
const SearchEverywhereModal = React.lazy(() => import('../features/search/SearchEverywhereModal').then(m => ({ default: m.SearchEverywhereModal })));
const FindInFilesModal = React.lazy(() => import('../features/search/FindInFilesModal').then(m => ({ default: m.FindInFilesModal })));
const AboutModal = React.lazy(() => import('./AboutModal').then(m => ({ default: m.AboutModal })));
const NewFileModal = React.lazy(() => import('../features/project/NewFileModal').then(m => ({ default: m.NewFileModal })));
const SettingsModal = React.lazy(() => import('../features/settings/SettingsModal').then(m => ({ default: m.SettingsModal })));
const GoToLineModal = React.lazy(() => import('../features/search/GoToLineModal').then(m => ({ default: m.GoToLineModal })));
const GitCommitModal = React.lazy(() => import('../features/git/GitCommitModal').then(m => ({ default: m.GitCommitModal })));
const RenameModal = React.lazy(() => import('../features/project/RenameModal').then(m => ({ default: m.RenameModal })));
const TipOfTheDayModal = React.lazy(() => import('../features/settings/TipOfTheDayModal').then(m => ({ default: m.TipOfTheDayModal })));
const RunConfigModal = React.lazy(() => import('../features/build/RunConfigModal').then(m => ({ default: m.RunConfigModal })));
const NewProjectModal = React.lazy(() => import('../features/project/NewProjectModal').then(m => ({ default: m.NewProjectModal })));
const ProjectStructureModal = React.lazy(() => import('../features/project/ProjectStructureModal').then(m => ({ default: m.ProjectStructureModal })));
const InvalidateCachesModal = React.lazy(() => import('../features/settings/InvalidateCachesModal').then(m => ({ default: m.InvalidateCachesModal })));
const LocalHistoryModal = React.lazy(() => import('../features/project/LocalHistoryModal').then(m => ({ default: m.LocalHistoryModal })));
const RepairIdeModal = React.lazy(() => import('../features/settings/RepairIdeModal').then(m => ({ default: m.RepairIdeModal })));
const VcsCloneModal = React.lazy(() => import('../features/git/VcsCloneModal').then(m => ({ default: m.VcsCloneModal })));
const DiffViewerModal = React.lazy(() => import('../features/git/DiffViewerModal').then(m => ({ default: m.DiffViewerModal })));
const AddDataSourceModal = React.lazy(() => import('../features/database/AddDataSourceModal').then(m => ({ default: m.AddDataSourceModal })));
const ThemeStudioModal = React.lazy(() => import('../features/settings/ThemeStudioModal').then(m => ({ default: m.ThemeStudioModal })));
const BreakpointsModal = React.lazy(() => import('../features/debugger/BreakpointsModal').then(m => ({ default: m.BreakpointsModal })));
const StashModal = React.lazy(() => import('../features/git/StashModal').then(m => ({ default: m.StashModal })));
const EvaluateExpressionModal = React.lazy(() => import('../features/debugger/EvaluateExpressionModal').then(m => ({ default: m.EvaluateExpressionModal })));
const ClipboardHistoryModal = React.lazy(() => import('../editor/ClipboardHistoryModal').then(m => ({ default: m.ClipboardHistoryModal })));
const StructuralSearchModal = React.lazy(() => import('../features/search/StructuralSearchModal').then(m => ({ default: m.StructuralSearchModal })));

export interface OverlayHostProps {
  // Callbacks & Handlers
  handleOpenFileAtLocation?: (path: string, line: number, col: number) => void;
  handleSelectSearchAction?: (item: ActionItem) => void;
  handleCreateNewFile?: (fileName: string) => void;
  handleGoToLine?: (line: number, col: number) => void;
  handleCommit?: (message: string, andPush: boolean, filesToCommit: string[], amend?: boolean) => void;
  handleRenameUnified?: (newName: string) => void;
  handleCreateNewProject?: (name: string, cat: string, loc: string, createGit: boolean, addSample: boolean) => void;
  loadProjectIntoIde?: (tree: FileNode) => void;
  handleRun?: (config?: RunConfiguration) => void;
  handleAddDataSource?: (ds: DataSourceConnection) => void;
  handleStash?: (message: string, keepIndex: boolean) => void;
  onPasteSnippet?: (text: string) => void;
  onAddWatch?: (expr: string) => void;
  handleChangeContent?: (tabId: string, content: string) => void;

  // Optional overrides
  currentBranch?: string;
  runConfigurations?: RunConfiguration[];
  activeConfigId?: string | null;
  setRunConfigurations?: (configs: RunConfiguration[]) => void;
  setActiveConfigId?: (id: string) => void;
  refreshGitStatus?: () => void;
  maxLine?: number;
  activeTabTitle?: string;
  problems?: any[];
  addToast?: (title: string, message?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onApplyTheme?: (themeId: IdeThemeId, customSyntax?: Partial<SyntaxTokenColors>) => void;
}

export const OverlayHost: React.FC<OverlayHostProps> = (props) => {
  const modalStore = useModalStore();
  const settingsStore = useSettingsStore();
  const projectStore = useProjectStore();
  const editorStore = useEditorStore();
  const debuggerStore = useDebuggerStore();
  const notificationStore = useNotificationStore();

  const addToast = props.addToast || notificationStore.addToast;
  const activeTab = editorStore.getActiveTab();

  return (
    <ModalErrorBoundary onError={(err) => addToast('Modal Dismissed', err.message || 'Error in dialog component', 'error')}>
      <React.Suspense fallback={null}>
        {/* Find / Replace in Files Modal */}
        <FindInFilesModal
          isOpen={modalStore.isFindInFilesOpen}
          onClose={modalStore.closeFindInFiles}
          projectPath={projectStore.projectRootPath}
          initialMode={modalStore.findInFilesMode}
          initialQuery={modalStore.findInFilesInitialQuery}
          initialDirectory={modalStore.findInFilesDirectory}
          openFiles={editorStore.tabs.map((t) => ({ path: t.path || t.id, name: t.title }))}
          onOpenFileAtLocation={props.handleOpenFileAtLocation || (() => {})}
          onShowToast={addToast}
        />

        {/* Search Everywhere Modal */}
        <SearchEverywhereModal
          isOpen={modalStore.isSearchOpen}
          onClose={modalStore.closeSearch}
          projectPath={projectStore.projectRootPath}
          initialTab={modalStore.searchInitialTab}
          onSelectAction={props.handleSelectSearchAction || (() => {})}
        />

        {/* About Modal */}
        <AboutModal
          isOpen={modalStore.isAboutOpen}
          onClose={() => modalStore.setIsAboutOpen(false)}
        />

        {/* New File Modal */}
        <NewFileModal
          isOpen={modalStore.isNewFileOpen}
          onClose={() => modalStore.setIsNewFileOpen(false)}
          onCreate={props.handleCreateNewFile || (() => {})}
        />

        {/* Settings Modal */}
        {modalStore.isSettingsOpen && (
          <SettingsModal
            isOpen={modalStore.isSettingsOpen}
            onClose={() => modalStore.setIsSettingsOpen(false)}
            settings={settingsStore.settings}
            onOpenThemeStudio={() => {
              modalStore.setIsSettingsOpen(false);
              modalStore.setIsThemeStudioOpen(true);
            }}
            onSaveSettings={(newSettings) => {
              settingsStore.setSettings(newSettings);
              if (newSettings.theme) {
                if (props.onApplyTheme) {
                  props.onApplyTheme(newSettings.theme);
                } else {
                  settingsStore.applyTheme(newSettings.theme);
                }
              }
              addToast('Settings Saved', 'Applied preferences', 'success');
            }}
            onShowToast={addToast}
          />
        )}

        {/* Go to Line Modal */}
        <GoToLineModal
          isOpen={modalStore.isGoToLineOpen}
          onClose={() => modalStore.setIsGoToLineOpen(false)}
          maxLine={props.maxLine || 1000}
          onGoToLine={props.handleGoToLine || (() => {})}
        />

        {/* Git Commit Modal */}
        <GitCommitModal
          isOpen={modalStore.isCommitOpen}
          onClose={() => modalStore.setIsCommitOpen(false)}
          branch={props.currentBranch || 'main'}
          onCommit={props.handleCommit || (() => {})}
        />

        {/* Global Diff Viewer Modal */}
        <DiffViewerModal
          isOpen={modalStore.isDiffModalOpen}
          onClose={modalStore.closeDiffModal}
          fileName={modalStore.activeDiffFile || ''}
          baseContent={modalStore.diffBaseContent}
          localContent={modalStore.diffLocalContent}
        />

        {/* Rename Modal */}
        <RenameModal
          isOpen={modalStore.isRenameOpen}
          onClose={modalStore.closeRenameModal}
          currentName={modalStore.renameTarget.name || props.activeTabTitle || ''}
          onRename={props.handleRenameUnified || (() => {})}
        />

        {/* Tip of the Day Modal */}
        <TipOfTheDayModal
          isOpen={modalStore.isTipOpen}
          onClose={() => modalStore.setIsTipOpen(false)}
        />

        {/* New Project Modal */}
        <NewProjectModal
          isOpen={modalStore.isNewProjectOpen}
          onClose={() => modalStore.setIsNewProjectOpen(false)}
          onCreateProject={props.handleCreateNewProject || (() => {})}
        />

        {/* VCS Get from Version Control Modal */}
        <VcsCloneModal
          isOpen={modalStore.isVcsCloneOpen}
          onClose={() => modalStore.setIsVcsCloneOpen(false)}
          onProjectCloned={props.loadProjectIntoIde || (() => {})}
          onShowToast={addToast}
        />

        {/* Run / Debug Configurations Modal */}
        <RunConfigModal
          isOpen={modalStore.isRunConfigOpen}
          onClose={() => modalStore.setIsRunConfigOpen(false)}
          configurations={props.runConfigurations || []}
          activeConfigId={props.activeConfigId || ''}
          projectRootPath={projectStore.projectRootPath}
          onSaveConfigurations={(configs, selectedId) => {
            props.setRunConfigurations?.(configs);
            props.setActiveConfigId?.(selectedId);
            try {
              localStorage.setItem('intellij_run_configurations', JSON.stringify(configs));
              localStorage.setItem('intellij_active_run_config_id', selectedId);
            } catch (e) {
              console.warn(e);
            }
            addToast('Configurations Saved', 'Run configurations updated', 'success');
          }}
          onRunSelected={(config) => {
            props.setActiveConfigId?.(config.id);
            try {
              localStorage.setItem('intellij_active_run_config_id', config.id);
            } catch (e) {}
            modalStore.setIsRunConfigOpen(false);
            if (props.handleRun) {
              setTimeout(() => props.handleRun?.(config), 60);
            }
          }}
        />

        {/* Project Structure Modal */}
        <ProjectStructureModal
          isOpen={modalStore.isProjectStructureOpen}
          onClose={() => modalStore.setIsProjectStructureOpen(false)}
          projectName={projectStore.projectName}
          files={projectStore.files}
          problems={props.problems}
          onSave={(newName) => {
            projectStore.setProjectName(newName);
            addToast('Project Structure', `Updated project name to [${newName}]`, 'success');
          }}
          onShowToast={addToast}
        />

        {/* Invalidate Caches Modal */}
        <InvalidateCachesModal
          isOpen={modalStore.isInvalidateCachesOpen}
          onClose={() => modalStore.setIsInvalidateCachesOpen(false)}
          onInvalidate={() => {
            try {
              sessionStorage.clear();
              localStorage.removeItem('ij_symbols_cache');
              localStorage.removeItem('ij_file_index_cache');
            } catch (_) {}
            window.dispatchEvent(new CustomEvent('intellij:sync-vfs'));
            addToast('Invalidating Caches', 'Caches cleared. Project index re-scanned.', 'success');
          }}
        />

        {/* Local History Modal */}
        <LocalHistoryModal
          isOpen={modalStore.isLocalHistoryOpen}
          onClose={() => modalStore.setIsLocalHistoryOpen(false)}
          fileName={activeTab?.title || 'workspace'}
          filePath={activeTab?.path}
          currentContent={activeTab?.content || ''}
          onShowToast={addToast}
          onRevert={(revertedContent) => {
            if (activeTab?.id) {
              if (props.handleChangeContent) {
                props.handleChangeContent(activeTab.id, revertedContent);
              } else {
                editorStore.updateContent(activeTab.id, revertedContent);
              }
              addToast('Local History Reverted', `Reverted ${activeTab.title}`, 'success');
            }
          }}
        />

        {/* Repair IDE Assistant Modal */}
        <RepairIdeModal
          isOpen={modalStore.isRepairIdeOpen}
          onClose={() => modalStore.setIsRepairIdeOpen(false)}
          onComplete={() => {
            window.dispatchEvent(new CustomEvent('intellij:sync-vfs'));
            addToast('IDE Repaired', 'Virtual File System synchronized & toolchains verified', 'success');
          }}
        />

        {/* Database Connection Modal */}
        <AddDataSourceModal
          isOpen={modalStore.isAddDataSourceOpen}
          onClose={() => modalStore.setIsAddDataSourceOpen(false)}
          onSave={(newDs) => {
            props.handleAddDataSource?.(newDs);
            modalStore.setIsAddDataSourceOpen(false);
          }}
          onShowToast={addToast}
        />

        {/* Theme Studio Modal */}
        {modalStore.isThemeStudioOpen && (
          <ThemeStudioModal
            isOpen={modalStore.isThemeStudioOpen}
            onClose={() => modalStore.setIsThemeStudioOpen(false)}
            currentThemeId={settingsStore.settings.theme}
            onApplyTheme={(themeId, customSyntax) => {
              if (props.onApplyTheme) {
                props.onApplyTheme(themeId, customSyntax);
              } else {
                settingsStore.applyTheme(themeId, customSyntax);
              }
            }}
            onShowToast={addToast}
          />
        )}

        {/* Breakpoints Modal (Ctrl+Shift+F8) */}
        {modalStore.isBreakpointsOpen && (
          <BreakpointsModal
            isOpen={modalStore.isBreakpointsOpen}
            onClose={() => modalStore.setIsBreakpointsOpen(false)}
            breakpoints={debuggerStore.breakpoints}
            areBreakpointsMuted={debuggerStore.areBreakpointsMuted}
            onToggleMuteBreakpoints={() => debuggerStore.setAreBreakpointsMuted(prev => !prev)}
            onUpdateBreakpoint={debuggerStore.updateBreakpoint}
            onRemoveBreakpoint={debuggerStore.removeBreakpoint}
            onShowToast={addToast}
          />
        )}

        {/* Git Stash Changes Modal */}
        {modalStore.isStashOpen && (
          <StashModal
            isOpen={modalStore.isStashOpen}
            currentBranch={props.currentBranch || 'main'}
            onClose={() => modalStore.setIsStashOpen(false)}
            onStash={(message, keepIndex) => {
              props.handleStash?.(message, keepIndex);
            }}
          />
        )}

        {/* Evaluate Expression Modal (Alt+F8) */}
        {modalStore.isEvaluateExpressionOpen && (
          <EvaluateExpressionModal
            isOpen={modalStore.isEvaluateExpressionOpen}
            onClose={() => modalStore.setIsEvaluateExpressionOpen(false)}
            variables={debuggerStore.dapVariables}
            onAddWatch={props.onAddWatch || debuggerStore.addWatch}
            onShowToast={addToast}
          />
        )}

        {/* Clipboard History Modal (Ctrl+Shift+V) */}
        {modalStore.isClipboardHistoryOpen && (
          <ClipboardHistoryModal
            isOpen={modalStore.isClipboardHistoryOpen}
            onClose={() => modalStore.setIsClipboardHistoryOpen(false)}
            onPaste={(text) => {
              props.onPasteSnippet?.(text);
              modalStore.setIsClipboardHistoryOpen(false);
            }}
            onShowToast={addToast}
          />
        )}

        {/* Structural Search Modal (Ctrl+Shift+S) */}
        {modalStore.isStructuralSearchOpen && (
          <StructuralSearchModal
            isOpen={modalStore.isStructuralSearchOpen}
            onClose={() => modalStore.setIsStructuralSearchOpen(false)}
            currentContent={activeTab?.content || ''}
            currentFilePath={activeTab?.path || activeTab?.title}
            onNavigateToLine={(filePath, line) => {
              props.handleOpenFileAtLocation?.(filePath, line, 1);
            }}
            onShowToast={addToast}
          />
        )}
      </React.Suspense>
    </ModalErrorBoundary>
  );
};
