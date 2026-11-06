import React from 'react';
import { 
  Play, 
  AlertCircle, 
  Search, 
  Bug, 
  Maximize2, 
  Minus, 
  X 
} from 'lucide-react';
import { 
  RunConsolePanel, 
  GitToolWindow, 
  TerminalPanel, 
  ProblemsPanel, 
  DebugPanel, 
  FindUsagesPanel 
} from '../features';
import { SonarToolWindow, SonarIcon, SonarAnalysisProgress } from '../features/sonar/SonarToolWindow';
import { BottomTabType } from '../stores/layoutStore';
import { 
  FindUsagesResult, 
  OpenTab, 
  ProblemItem, 
  RunConfiguration, 
  RunLog, 
  StackFrame, 
  UsageOccurrence, 
  VariableItem, 
  WatchItem, 
  DebugState 
} from '../types';

export interface BottomToolWindowProps {
  isBottomOpen: boolean;
  setIsBottomOpen: (open: boolean) => void;
  bottomTab: BottomTabType;
  setBottomTab: (tab: BottomTabType) => void;
  onExecuteMavenGoal?: (goal: string) => void;
  bottomHeight: number;
  setBottomHeight: React.Dispatch<React.SetStateAction<number>>;
  handleToggleMaximizeBottom: () => void;

  // Run panel props
  isRunning: boolean;
  runLogs: RunLog[];
  setRunLogs: React.Dispatch<React.SetStateAction<RunLog[]>>;
  runConfigurations: RunConfiguration[];
  activeConfigId: string | null;
  projectName: string;
  handleRun: () => void | Promise<void>;
  handleStop: () => void | Promise<void>;

  // Git panel props
  currentProjectDirectory: string;
  currentBranch: string;
  gitTargetCommit?: string | { hash: string; nonce: number } | null;

  // Terminal props
  hasOpenedTerminal: boolean;
  projectRootPath: string;
  setIsSettingsOpen: (open: boolean) => void;

  // Problems panel props
  problems: ProblemItem[];
  activeTab?: OpenTab;
  handleJumpToProblem: (filePath: string, line: number, column: number) => void;
  runProjectInspection: () => void;

  // Debug panel props
  debugState: DebugState;
  frames: StackFrame[];
  activeFrameId: string | null;
  setActiveFrameId: (id: string | null) => void;
  variables: VariableItem[];
  watches: WatchItem[];
  areBreakpointsMuted: boolean;
  setAreBreakpointsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  debugConsoleOutput: string[];
  setDebugConsoleOutput: React.Dispatch<React.SetStateAction<string[]>>;
  handleStartDebug: () => void | Promise<void>;
  handleResumeDebug: () => void | Promise<void>;
  handlePauseDebug: () => void | Promise<void>;
  handleStopDebug: () => void | Promise<void>;
  handleStepOverDebug: () => void | Promise<void>;
  handleStepIntoDebug: () => void | Promise<void>;
  handleStepOutDebug: () => void | Promise<void>;
  handleRunToCursor: () => void | Promise<void>;
  handleAddWatch: (expr: string) => void | Promise<void>;
  handleRemoveWatch: (id: string) => void;
  setIsEvaluateExpressionOpen: (open: boolean) => void;
  setIsBreakpointsOpen: (open: boolean) => void;
  handleOpenFileAtLocation: (filePath: string, line: number, col?: number) => void | Promise<void>;

  // Find Usages props
  findResult: FindUsagesResult | null;
  setFindResult: (res: FindUsagesResult | null) => void;
  handleFindUsages: (symbol: string) => void | Promise<void>;
  handleJumpToOccurrence: (occ: UsageOccurrence) => void;

  // Toast notification
  addToast: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;

  // SonarQube props
  onSonarAnalysisStateChange?: (state: SonarAnalysisProgress | null) => void;
  sonarTargetScanPath?: { path: string; isFolder: boolean; timestamp: number } | null;
  sonarCancelSignal?: number;
}

export const BottomToolWindow: React.FC<BottomToolWindowProps> = ({
  isBottomOpen,
  setIsBottomOpen,
  bottomTab,
  setBottomTab,
  bottomHeight,
  setBottomHeight,
  handleToggleMaximizeBottom,
  isRunning,
  runLogs,
  setRunLogs,
  runConfigurations,
  activeConfigId,
  projectName,
  handleRun,
  handleStop,
  currentProjectDirectory,
  currentBranch,
  gitTargetCommit,
  hasOpenedTerminal,
  projectRootPath,
  setIsSettingsOpen,
  problems,
  activeTab,
  handleJumpToProblem,
  runProjectInspection,
  debugState,
  frames,
  activeFrameId,
  setActiveFrameId,
  variables,
  watches,
  areBreakpointsMuted,
  setAreBreakpointsMuted,
  debugConsoleOutput,
  setDebugConsoleOutput,
  handleStartDebug,
  handleResumeDebug,
  handlePauseDebug,
  handleStopDebug,
  handleStepOverDebug,
  handleStepIntoDebug,
  handleStepOutDebug,
  handleRunToCursor,
  handleAddWatch,
  handleRemoveWatch,
  setIsEvaluateExpressionOpen,
  setIsBreakpointsOpen,
  handleOpenFileAtLocation,
  findResult,
  setFindResult,
  handleFindUsages,
  handleJumpToOccurrence,
  onExecuteMavenGoal,
  addToast,
  onSonarAnalysisStateChange,
  sonarTargetScanPath,
  sonarCancelSignal,
}) => {
  if (!isBottomOpen) return null;

  return (
    <div
      style={{ height: `${bottomHeight}px` }}
      className="border-t border-[#2B2D30] flex flex-col bg-[#1E1F22] flex-shrink-0 relative w-full"
    >
      {/* Draggable Resizer for Bottom Panel Height */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          const startY = e.clientY;
          const startH = bottomHeight;
          const onMouseMove = (moveEvent: MouseEvent) => {
            const delta = startY - moveEvent.clientY;
            setBottomHeight(Math.max(120, Math.min(window.innerHeight - 120, startH + delta)));
          };
          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
          };
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }}
        className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize hover:bg-[#3574F0]/50 transition-colors z-20"
        title="Drag to resize panel height"
      />

      {/* Bottom Tool Window Header (Clean Authentic Title & Controls - No horizontal tabs) */}
      {bottomTab !== 'terminal' && bottomTab !== 'git' && bottomTab !== 'sonar' && (
        <div className="h-7 bg-[#1E1F22] border-b border-[#2B2D30] px-3 flex items-center justify-between text-[11px] select-none">
          {/* Tool Window Title & Active Context */}
          <div className="flex items-center gap-2 h-full text-[#DFE1E5]">
            {bottomTab === 'run' && (
              <>
                <Play size={13} className={isRunning ? 'text-[#3574F0] fill-[#3574F0] animate-pulse' : 'text-[#59A869] fill-[#59A869]'} />
                <span className="font-semibold text-xs text-[#DFE1E5]">Run</span>
                <span className="text-[#868A91] text-[11px]">
                  {runConfigurations.find(c => c.id === activeConfigId)?.name || projectName || 'Application'}
                </span>
              </>
            )}
            {bottomTab === 'problems' && (() => {
              const errs = problems.filter(p => p.severity === 'error').length;
              const warns = problems.filter(p => p.severity === 'warning').length;
              return (
                <>
                  <AlertCircle size={13} className={errs > 0 ? "text-[#E05555]" : warns > 0 ? "text-[#EDA200]" : "text-[#59A869]"} />
                  <span className="font-semibold text-xs text-[#DFE1E5]">Problems</span>
                  <span className="text-[#868A91] text-[11px]">({errs} error{errs !== 1 ? 's' : ''}, {warns} warning{warns !== 1 ? 's' : ''})</span>
                </>
              );
            })()}
            {bottomTab === 'find' && (
              <div className="flex items-center gap-1.5">
                <Search size={13} className="text-[#3574F0]" />
                <span className="font-semibold text-xs text-[#DFE1E5]">Find</span>
                {findResult && (
                  <div className="flex items-center gap-1.5 ml-2 bg-[#1E1F22] border border-[#393B40] px-2 py-0.5 rounded text-[11px] text-[#DFE1E5]">
                    <span className="text-[#868A91]">Usages of</span>
                    <span className="font-mono font-medium text-[#DFE1E5]">"{findResult.symbol}"</span>
                    <span className="text-[#868A91]">in Project Files ({findResult.occurrences.length})</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFindResult(null);
                        setBottomTab('run');
                      }}
                      className="ml-1 text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#393B40] rounded p-0.5 transition-colors cursor-pointer"
                      title="Close tab"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}
              </div>
            )}
            {bottomTab === 'debug' && (
              <>
                <Bug size={13} className="text-[#E55353]" />
                <span className="font-semibold text-xs text-[#DFE1E5]">Debug</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleMaximizeBottom}
              title={bottomHeight > 400 ? "Restore size" : "Maximize tool window (Ctrl+Shift+F12)"}
              className="p-1 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
            >
              <Maximize2 size={12} />
            </button>
            <button
              onClick={() => setIsBottomOpen(false)}
              title="Hide Window (Shift+Esc)"
              className="p-1 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
            >
              <Minus size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Panel Content Router */}
      <div className="flex-1 overflow-hidden">
        {bottomTab === 'run' && (
          <RunConsolePanel
            logs={runLogs}
            isRunning={isRunning}
            onRerun={handleRun}
            onStop={handleStop}
            onClear={() => setRunLogs([])}
          />
        )}
        {bottomTab === 'git' && (
          <GitToolWindow
            projectPath={currentProjectDirectory}
            currentBranch={currentBranch}
            targetCommitHash={gitTargetCommit}
            onToggleMaximize={handleToggleMaximizeBottom}
            onHide={() => setIsBottomOpen(false)}
            onShowToast={addToast}
          />
        )}
        <div className={`h-full ${bottomTab === 'terminal' ? 'block' : 'hidden'}`}>
          {hasOpenedTerminal && (
            <TerminalPanel
              key={projectRootPath}
              cwd={projectRootPath}
              onToggleMaximize={handleToggleMaximizeBottom}
              onHide={() => setIsBottomOpen(false)}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}
        </div>
        {bottomTab === 'problems' && (
          <ProblemsPanel
            problems={problems}
            activeFilePath={activeTab?.path}
            onJumpToProblem={handleJumpToProblem}
            onQuickFix={(p) => {
              if (p.quickFixTitle) {
                addToast('Quick Fix Applied', p.quickFixTitle, 'success');
              }
            }}
            onRerunInspection={runProjectInspection}
            onClose={() => setIsBottomOpen(false)}
          />
        )}
        {bottomTab === 'debug' && (
          <DebugPanel
            debugState={debugState}
            frames={frames}
            activeFrameId={activeFrameId}
            variables={variables}
            watches={watches}
            areBreakpointsMuted={areBreakpointsMuted}
            consoleOutput={debugConsoleOutput}
            onRerun={handleStartDebug}
            onResume={handleResumeDebug}
            onPause={handlePauseDebug}
            onStop={handleStopDebug}
            onStepOver={handleStepOverDebug}
            onStepInto={handleStepIntoDebug}
            onStepOut={handleStepOutDebug}
            onRunToCursor={handleRunToCursor}
            onEvaluateExpression={() => {
              setIsEvaluateExpressionOpen(true);
            }}
            onViewBreakpoints={() => {
              setIsBreakpointsOpen(true);
            }}
            onToggleMuteBreakpoints={() => {
              setAreBreakpointsMuted(prev => !prev);
              addToast('Mute Breakpoints', !areBreakpointsMuted ? 'Breakpoints muted' : 'Breakpoints unmuted', 'info');
            }}
            onSelectFrame={(frame) => {
              setActiveFrameId(frame.id);
              if (frame.filePath && frame.line) {
                handleOpenFileAtLocation(frame.filePath, frame.line, 1);
              }
            }}
            onAddWatch={handleAddWatch}
            onRemoveWatch={handleRemoveWatch}
            onClearConsole={() => setDebugConsoleOutput([])}
          />
        )}
        {bottomTab === 'find' && (
          findResult ? (
            <FindUsagesPanel
              result={findResult}
              onJumpToOccurrence={handleJumpToOccurrence}
              onRerun={() => handleFindUsages(findResult.symbol)}
              onClose={() => setBottomTab('run')}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-[#868A91]">
              No active find usages search. Place cursor on a symbol and press Alt+F7.
            </div>
          )
        )}
        {bottomTab === 'sonar' && (
          <SonarToolWindow
            activeTab={activeTab}
            currentProjectDirectory={currentProjectDirectory}
            onOpenFileAtLocation={handleOpenFileAtLocation}
            onExecuteMavenGoal={onExecuteMavenGoal}
            onShowToast={addToast}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onToggleMaximize={handleToggleMaximizeBottom}
            onHide={() => setIsBottomOpen(false)}
            onAnalysisStateChange={onSonarAnalysisStateChange}
            targetScanPath={sonarTargetScanPath}
            cancelSignal={sonarCancelSignal}
          />
        )}
      </div>
    </div>
  );
};
