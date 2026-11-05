import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  RefreshCw, 
  Terminal, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  X, 
  ChevronsUpDown, 
  ChevronsDownUp,
  Package,
  Layers,
  FileCode,
  Box,
  CheckCircle2,
  Folder,
  Globe
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export interface GradleTask {
  id: string;
  name: string;
  command: string;
  group: 'build' | 'application' | 'verification' | 'help' | 'other';
  description?: string;
}

export interface GradleDependency {
  name: string;
  configuration: string;
  version?: string;
}

interface GradlePanelProps {
  projectPath?: string;
  onExecuteTask: (tool: string, taskName: string, command: string) => void;
  onExecuteCustomGoal?: (command: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onClose?: () => void;
}

export const GradleIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
    <rect width="16" height="16" rx="3" fill="#02303A" fillOpacity="0.4" />
    <text x="8" y="11.5" textAnchor="middle" fill="#00DE7A" fontSize="10.5" fontWeight="bold" fontFamily="sans-serif">G</text>
  </svg>
);

export const GradlePanel: React.FC<GradlePanelProps> = ({
  projectPath = 'D:\\IDE',
  onExecuteTask,
  onExecuteCustomGoal,
  onShowToast,
  onClose,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'gradle-root': true,
    'gradle-tasks': true,
    'task-build': true,
    'task-application': true,
    'gradle-dependencies': false,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [customGoalText, setCustomGoalText] = useState('');
  const [skipTests, setSkipTests] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  const [projectName, setProjectName] = useState('gradle-project');
  const [dependencies, setDependencies] = useState<GradleDependency[]>([]);
  const [hasGradleFile, setHasGradleFile] = useState(false);

  const taskGroups = [
    {
      id: 'task-build',
      name: 'build',
      tasks: [
        { id: 'gr-assemble', name: 'assemble', command: 'gradle assemble', group: 'build' as const, description: 'Assembles the outputs of this project' },
        { id: 'gr-bootJar', name: 'bootJar', command: 'gradle bootJar', group: 'build' as const, description: 'Assembles an executable jar archive' },
        { id: 'gr-build', name: 'build', command: 'gradle build', group: 'build' as const, description: 'Assembles and tests this project' },
        { id: 'gr-buildDependents', name: 'buildDependents', command: 'gradle buildDependents', group: 'build' as const, description: 'Assembles and tests project and dependents' },
        { id: 'gr-classes', name: 'classes', command: 'gradle classes', group: 'build' as const, description: 'Assembles main classes' },
        { id: 'gr-clean', name: 'clean', command: 'gradle clean', group: 'build' as const, description: 'Deletes the build directory' },
        { id: 'gr-jar', name: 'jar', command: 'gradle jar', group: 'build' as const, description: 'Assembles a jar archive containing the main classes' },
      ]
    },
    {
      id: 'task-application',
      name: 'application',
      tasks: [
        { id: 'gr-bootRun', name: 'bootRun', command: 'gradle bootRun', group: 'application' as const, description: 'Runs Spring Boot application locally' },
        { id: 'gr-run', name: 'run', command: 'gradle run', group: 'application' as const, description: 'Runs this project as a JVM application' },
      ]
    },
    {
      id: 'task-verification',
      name: 'verification',
      tasks: [
        { id: 'gr-check', name: 'check', command: 'gradle check', group: 'verification' as const, description: 'Runs all checks and tests' },
        { id: 'gr-test', name: 'test', command: 'gradle test', group: 'verification' as const, description: 'Runs the test suite' },
      ]
    },
    {
      id: 'task-help',
      name: 'help',
      tasks: [
        { id: 'gr-dependencies', name: 'dependencies', command: 'gradle dependencies', group: 'help' as const, description: 'Displays all dependencies declared in root project' },
        { id: 'gr-projects', name: 'projects', command: 'gradle projects', group: 'help' as const, description: 'Displays the sub-projects of root project' },
        { id: 'gr-tasks', name: 'tasks', command: 'gradle tasks', group: 'help' as const, description: 'Displays the tasks runnable from root project' },
      ]
    }
  ];

  const scanGradleProject = async () => {
    setIsRefreshing(true);
    let found = false;
    let projTitle = 'gradle-backend';
    let deps: GradleDependency[] = [];

    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      try {
        const content = await invoke<string>('read_file_content', { path: `${projectPath}\\build.gradle` })
          .catch(() => invoke<string>('read_file_content', { path: `${projectPath}\\build.gradle.kts` }));

        if (content) {
          found = true;
          // Extract project name if defined
          const nameMatch = content.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
          if (nameMatch) projTitle = nameMatch[1];

          // Extract dependencies like implementation '...'
          const depRegex = /(implementation|compileOnly|runtimeOnly|testImplementation|api)\s*\(?['"]([^'"]+)['"]\)?/g;
          let match;
          while ((match = depRegex.exec(content)) !== null) {
            deps.push({
              configuration: match[1],
              name: match[2],
            });
          }
        }
      } catch (e) {
        // Gradle not found on disk
      }
    }

    setHasGradleFile(found);
    setProjectName(found ? projTitle : 'No Gradle Project');
    setDependencies(deps);
    setIsRefreshing(false);
  };

  useEffect(() => {
    scanGradleProject();
  }, [projectPath]);

  const toggleNode = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const map: Record<string, boolean> = {
      'gradle-root': true,
      'gradle-tasks': true,
      'gradle-dependencies': true,
    };
    taskGroups.forEach(g => { map[g.id] = true; });
    setExpandedNodes(map);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  const handleRunTask = (cmd: string, taskName: string) => {
    let finalCmd = cmd;
    if (skipTests && !finalCmd.includes('-x test')) {
      finalCmd += ' -x test';
    }
    if (offlineMode && !finalCmd.includes('--offline')) {
      finalCmd += ' --offline';
    }
    onExecuteTask('gradle', taskName, finalCmd);
    onShowToast?.('Gradle Task', `Running: ${finalCmd}`, 'info');
  };

  const handleCustomGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoalText.trim()) return;
    let fullCmd = customGoalText.trim().startsWith('gradle') || customGoalText.trim().startsWith('./gradlew')
      ? customGoalText.trim()
      : `gradle ${customGoalText.trim()}`;
    if (skipTests && !fullCmd.includes('-x test')) {
      fullCmd += ' -x test';
    }
    if (offlineMode && !fullCmd.includes('--offline')) {
      fullCmd += ' --offline';
    }
    onExecuteCustomGoal?.(fullCmd);
    onShowToast?.('Gradle Task', `Executing: ${fullCmd}`, 'info');
    setShowGoalInput(false);
    setCustomGoalText('');
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] select-none text-xs text-[#DFE1E5]">
      {/* Gradle Toolbar */}
      <div className="h-8 px-2.5 bg-[#2B2D30]/60 border-b border-[#2B2D30] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1.5 font-semibold text-xs tracking-wide text-[#DFE1E5]">
          <GradleIcon size={14} />
          <span>Gradle</span>
          {hasGradleFile ? (
            <span className="text-[10px] text-[#00DE7A] font-normal px-1 rounded bg-[#00DE7A]/10">build.gradle</span>
          ) : (
            <span className="text-[10px] text-[#868A91] font-normal px-1 rounded bg-[#2B2D30]">default</span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <button 
            onClick={() => {
              scanGradleProject();
              onShowToast?.('Gradle Sync', 'Reloaded Gradle build configuration', 'success');
            }}
            title="Reload All Gradle Projects"
            className="w-6 h-6 rounded flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B] transition-colors cursor-pointer"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-[#00DE7A]' : ''} />
          </button>

          <button 
            onClick={() => setShowGoalInput(prev => !prev)}
            title="Execute Gradle Task..."
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
              showGoalInput ? 'bg-[#00DE7A] text-[#1E1F22]' : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B]'
            }`}
          >
            <Terminal size={12} />
          </button>

          <button 
            onClick={() => {
              setSkipTests(prev => !prev);
              onShowToast?.('Skip Tests Mode', !skipTests ? 'Enabled (-x test)' : 'Disabled', 'info');
            }}
            title={skipTests ? 'Skip Tests: ON (-x test)' : 'Skip Tests: OFF'}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer text-[10px] font-bold ${
              skipTests ? 'bg-[#E5B567] text-[#1E1F22]' : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B]'
            }`}
          >
            -T
          </button>

          <button 
            onClick={() => {
              setOfflineMode(prev => !prev);
              onShowToast?.('Offline Mode', !offlineMode ? 'Work Offline (--offline)' : 'Online', 'info');
            }}
            title={offlineMode ? 'Offline Mode: ON (--offline)' : 'Offline Mode: OFF'}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
              offlineMode ? 'bg-[#00DE7A] text-[#1E1F22]' : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B]'
            }`}
          >
            <Globe size={12} />
          </button>

          <button 
            onClick={expandAll}
            title="Expand All"
            className="w-6 h-6 rounded flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B] transition-colors cursor-pointer"
          >
            <ChevronsUpDown size={12} />
          </button>

          <button 
            onClick={collapseAll}
            title="Collapse All"
            className="w-6 h-6 rounded flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B] transition-colors cursor-pointer"
          >
            <ChevronsDownUp size={12} />
          </button>

          {onClose && (
            <button 
              onClick={onClose}
              title="Hide Gradle Window"
              className="w-6 h-6 rounded flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B] transition-colors cursor-pointer ml-0.5"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Goal command input overlay */}
      {showGoalInput && (
        <form onSubmit={handleCustomGoalSubmit} className="p-2 bg-[#2B2D30] border-b border-[#393B40] flex items-center gap-1.5 animate-in fade-in duration-100">
          <Terminal size={12} className="text-[#00DE7A] flex-shrink-0" />
          <input 
            type="text"
            autoFocus
            value={customGoalText}
            onChange={(e) => setCustomGoalText(e.target.value)}
            placeholder="Execute Gradle task (e.g. bootRun, build -x test)..."
            className="flex-1 bg-[#1E1F22] text-[#DFE1E5] text-[11px] rounded px-2 py-1 border border-[#393B40] focus:border-[#00DE7A] outline-none font-mono"
          />
          <button 
            type="submit"
            className="px-2.5 py-1 bg-[#00DE7A] hover:bg-[#00C06A] text-[#1E1F22] font-semibold rounded text-[11px] transition-colors cursor-pointer"
          >
            Run
          </button>
          <button 
            type="button" 
            onClick={() => setShowGoalInput(false)}
            className="p-1 text-[#868A91] hover:text-[#DFE1E5] cursor-pointer"
          >
            <X size={12} />
          </button>
        </form>
      )}

      {/* Filter search box */}
      <div className="p-1.5 border-b border-[#2B2D30] bg-[#1E1F22]">
        <div className="relative flex items-center">
          <Search size={12} className="absolute left-2 text-[#868A91] pointer-events-none" />
          <input 
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter Gradle tasks & dependencies..."
            className="w-full bg-[#2B2D30] text-[#DFE1E5] text-[11px] rounded pl-7 pr-6 py-1 border border-transparent focus:border-[#00DE7A] focus:outline-none placeholder-[#6E7278]"
          />
          {filterQuery && (
            <button 
              onClick={() => setFilterQuery('')}
              className="absolute right-1.5 text-[#868A91] hover:text-[#DFE1E5] p-0.5"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Gradle Project Tree or Empty State */}
      {!hasGradleFile ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#868A91]">
          <GradleIcon size={40} className="opacity-40 mb-3" />
          <div className="text-xs font-semibold text-[#DFE1E5] mb-1">No Gradle Projects Found</div>
          <p className="text-[11px] text-[#868A91] leading-relaxed max-w-[220px] mb-4">
            No <span className="text-[#DFE1E5] font-mono">build.gradle</span> or <span className="text-[#DFE1E5] font-mono">build.gradle.kts</span> was detected in the active workspace.
          </p>
          <button
            onClick={() => scanGradleProject()}
            className="px-3 py-1.5 rounded bg-[#00DE7A] hover:bg-[#00C06A] text-[#1E1F22] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            Scan Project
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-1 font-mono text-[11.5px] select-none">
          <div className="space-y-0.5">
            <div 
              onClick={(e) => toggleNode('gradle-root', e)}
              className="flex items-center gap-1.5 px-2 py-1 hover:bg-[#2B2D30] rounded cursor-pointer text-[#DFE1E5] font-semibold font-sans"
            >
              {expandedNodes['gradle-root'] ? <ChevronDown size={13} className="text-[#868A91]" /> : <ChevronRight size={13} className="text-[#868A91]" />}
              <GradleIcon size={14} />
              <span className="truncate">{projectName}</span>
              <span className="text-[10px] text-[#868A91] font-normal ml-auto">(root)</span>
            </div>

            {expandedNodes['gradle-root'] && (
              <div className="pl-4 space-y-1">
                {/* Tasks Folder */}
                <div>
                  <div 
                    onClick={(e) => toggleNode('gradle-tasks', e)}
                    className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-[#2B2D30] rounded cursor-pointer text-[#868A91] hover:text-[#DFE1E5]"
                  >
                    {expandedNodes['gradle-tasks'] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <Folder size={12} className="text-[#00DE7A]" />
                  <span className="font-semibold text-[11px]">Tasks</span>
                </div>

                {expandedNodes['gradle-tasks'] && (
                  <div className="pl-4 space-y-0.5">
                    {taskGroups.map((tg) => (
                      <div key={tg.id}>
                        <div 
                          onClick={(e) => toggleNode(tg.id, e)}
                          className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-[#2B2D30] rounded cursor-pointer text-[#DFE1E5]"
                        >
                          {expandedNodes[tg.id] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          <Package size={11} className="text-[#00DE7A]" />
                          <span className="font-semibold text-[11px]">{tg.name}</span>
                        </div>

                        {expandedNodes[tg.id] && (
                          <div className="pl-4 space-y-0.5">
                            {tg.tasks.map((t) => (
                              <div 
                                key={t.id}
                                onDoubleClick={() => handleRunTask(t.command, t.name)}
                                className="group flex items-center justify-between px-2 py-0.5 hover:bg-[#2B2D30] rounded cursor-pointer text-[#DFE1E5]"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#00DE7A] flex-shrink-0" />
                                  <span className="text-[11px] truncate group-hover:text-white">{t.name}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRunTask(t.command, t.name);
                                    }}
                                    title={`Execute: ${t.command}`}
                                    className="p-0.5 hover:bg-[#35373B] text-[#00DE7A] rounded cursor-pointer"
                                  >
                                    <Play size={11} fill="currentColor" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dependencies Folder */}
              <div>
                <div 
                  onClick={(e) => toggleNode('gradle-dependencies', e)}
                  className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-[#2B2D30] rounded cursor-pointer text-[#868A91] hover:text-[#DFE1E5]"
                >
                  {expandedNodes['gradle-dependencies'] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <Folder size={12} className="text-[#3574F0]" />
                  <span className="font-semibold text-[11px]">Dependencies</span>
                  <span className="text-[10px] text-[#6E7278] ml-auto">({dependencies.length})</span>
                </div>

                {expandedNodes['gradle-dependencies'] && (
                  <div className="pl-4 space-y-0.5">
                    {dependencies.map((dep, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between px-2 py-0.5 hover:bg-[#2B2D30] rounded cursor-pointer text-[#DFE1E5] text-[10.5px]"
                        title={`${dep.name} (${dep.configuration})`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Box size={10} className="text-[#868A91] flex-shrink-0" />
                          <span className="text-white truncate">{dep.name}</span>
                        </div>
                        <span className="text-[9px] px-1 rounded text-[#868A91] bg-[#2B2D30]">
                          {dep.configuration}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);
};
