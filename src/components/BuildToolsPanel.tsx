import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  Play, 
  RefreshCw, 
  Terminal, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  X, 
  CheckCircle2, 
  Clock, 
  Folder, 
  ChevronsUpDown, 
  ChevronsDownUp,
  Settings,
  MoreVertical,
  Cpu,
  Layers,
  FileCode,
  Box,
  ExternalLink,
  Bug
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export interface BuildTask {
  id: string;
  name: string;
  command: string;
  tool: 'cargo' | 'npm' | 'maven' | 'gradle' | 'make';
  group: 'build' | 'test' | 'run' | 'lifecycle' | 'other';
  description?: string;
}

export interface BuildDependency {
  name: string;
  version?: string;
  scope?: string;
}

export interface BuildModule {
  id: string;
  name: string;
  tool: 'cargo' | 'npm' | 'maven' | 'gradle' | 'make';
  path: string;
  tasks: BuildTask[];
  dependencies: BuildDependency[];
}

interface BuildToolsPanelProps {
  projectPath?: string;
  onExecuteTask: (tool: string, taskName: string, command: string) => void;
  onExecuteCustomGoal?: (command: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onClose?: () => void;
}

export const BuildToolsPanel: React.FC<BuildToolsPanelProps> = ({
  projectPath = 'D:\\IDE',
  onExecuteTask,
  onExecuteCustomGoal,
  onShowToast,
  onClose,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'module-cargo': true,
    'cargo-tasks': true,
    'module-npm': true,
    'npm-tasks': true,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [customGoalText, setCustomGoalText] = useState('');
  const [modules, setModules] = useState<BuildModule[]>([]);

  // Scan project build configurations
  const scanBuildModules = async () => {
    setIsRefreshing(true);
    const discovered: BuildModule[] = [];

    // 1. Cargo module
    const cargoTasks: BuildTask[] = [
      { id: 'cargo-check', name: 'check', command: 'cargo check', tool: 'cargo', group: 'build', description: 'Analyze project for errors without code generation' },
      { id: 'cargo-build', name: 'build', command: 'cargo build', tool: 'cargo', group: 'build', description: 'Compile debug binaries' },
      { id: 'cargo-build-release', name: 'build --release', command: 'cargo build --release', tool: 'cargo', group: 'build', description: 'Compile optimized production binary' },
      { id: 'cargo-test', name: 'test', command: 'cargo test', tool: 'cargo', group: 'test', description: 'Run all unit and integration tests' },
      { id: 'cargo-clippy', name: 'clippy', command: 'cargo clippy', tool: 'cargo', group: 'test', description: 'Run Rust linter for idioms and bug discovery' },
      { id: 'cargo-doc', name: 'doc', command: 'cargo doc --no-deps', tool: 'cargo', group: 'lifecycle', description: 'Generate rustdoc documentation' },
      { id: 'cargo-clean', name: 'clean', command: 'cargo clean', tool: 'cargo', group: 'lifecycle', description: 'Remove target build directory' },
    ];

    let cargoDeps: BuildDependency[] = [
      { name: 'tauri', version: '^2.12.5' },
      { name: 'serde', version: '1.0' },
      { name: 'serde_json', version: '1.0' },
      { name: 'portable-pty', version: '0.8' },
      { name: 'notify', version: '6.1' },
      { name: 'tauri-build', version: '2.7.4', scope: 'build' },
    ];

    // Try reading Cargo.toml from disk if Tauri available
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      try {
        const cargoContent = await invoke<string>('read_file_content', { path: `${projectPath}\\src-tauri\\Cargo.toml` })
          .catch(() => invoke<string>('read_file_content', { path: `${projectPath}\\Cargo.toml` }));
        if (cargoContent) {
          const parsedDeps: BuildDependency[] = [];
          const depMatches = cargoContent.matchAll(/^([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]+)"|{[^}]*version\s*=\s*"([^"]+)")/gm);
          for (const m of depMatches) {
            parsedDeps.push({ name: m[1], version: m[2] || m[3] || 'latest' });
          }
          if (parsedDeps.length > 0) cargoDeps = parsedDeps;
        }
      } catch (e) {
        // fallback to standard deps
      }
    }

    discovered.push({
      id: 'module-cargo',
      name: 'Cargo (Rust)',
      tool: 'cargo',
      path: 'src-tauri/Cargo.toml',
      tasks: cargoTasks,
      dependencies: cargoDeps,
    });

    // 2. NPM module
    let npmTasks: BuildTask[] = [
      { id: 'npm-dev', name: 'dev', command: 'npm run dev', tool: 'npm', group: 'run', description: 'Vite development server' },
      { id: 'npm-build', name: 'build', command: 'npm run build', tool: 'npm', group: 'build', description: 'TypeScript check & Vite production build' },
      { id: 'npm-preview', name: 'preview', command: 'npm run preview', tool: 'npm', group: 'run', description: 'Preview production build locally' },
      { id: 'npm-test', name: 'test', command: 'npm test', tool: 'npm', group: 'test', description: 'Run test suite' },
      { id: 'npm-lint', name: 'lint', command: 'npm run lint', tool: 'npm', group: 'test', description: 'Run ESLint' },
    ];

    let npmDeps: BuildDependency[] = [
      { name: 'react', version: '^18.3.1' },
      { name: 'react-dom', version: '^18.3.1' },
      { name: '@monaco-editor/react', version: '^4.6.0' },
      { name: '@tauri-apps/api', version: '^2.12.0' },
      { name: 'lucide-react', version: '^0.446.0' },
      { name: 'vite', version: '^5.4.21', scope: 'dev' },
      { name: 'typescript', version: '^5.6.2', scope: 'dev' },
      { name: 'tailwindcss', version: '^3.4.13', scope: 'dev' },
    ];

    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      try {
        const pkgRaw = await invoke<string>('read_file_content', { path: `${projectPath}\\package.json` });
        if (pkgRaw) {
          const pkg = JSON.parse(pkgRaw);
          if (pkg.scripts) {
            npmTasks = Object.entries(pkg.scripts).map(([name, cmd]) => ({
              id: `npm-${name}`,
              name,
              command: `npm run ${name}`,
              tool: 'npm',
              group: name === 'build' ? 'build' : name === 'test' ? 'test' : 'run',
              description: String(cmd),
            }));
          }
          if (pkg.dependencies || pkg.devDependencies) {
            const allDeps: BuildDependency[] = [];
            if (pkg.dependencies) {
              Object.entries(pkg.dependencies).forEach(([n, v]) => allDeps.push({ name: n, version: String(v) }));
            }
            if (pkg.devDependencies) {
              Object.entries(pkg.devDependencies).forEach(([n, v]) => allDeps.push({ name: n, version: String(v), scope: 'dev' }));
            }
            npmDeps = allDeps;
          }
        }
      } catch (e) {
        // fallback
      }
    }

    discovered.push({
      id: 'module-npm',
      name: 'npm (Node.js)',
      tool: 'npm',
      path: 'package.json',
      tasks: npmTasks,
      dependencies: npmDeps,
    });

    setModules(discovered);
    setIsRefreshing(false);
  };

  useEffect(() => {
    scanBuildModules();
  }, [projectPath]);

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const map: Record<string, boolean> = {};
    modules.forEach(m => {
      map[m.id] = true;
      map[`${m.tool}-tasks`] = true;
      map[`${m.tool}-deps`] = true;
    });
    setExpandedNodes(map);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  const handleRunGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoalText.trim()) return;
    onExecuteCustomGoal?.(customGoalText.trim());
    onShowToast?.('Build Goal', `Executing: ${customGoalText.trim()}`, 'info');
    setShowGoalInput(false);
    setCustomGoalText('');
  };

  const filteredModules = useMemo(() => {
    if (!filterQuery.trim()) return modules;
    const q = filterQuery.toLowerCase();
    return modules.map(m => {
      const matchModule = m.name.toLowerCase().includes(q);
      const filteredTasks = m.tasks.filter(t => 
        t.name.toLowerCase().includes(q) || 
        t.command.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
      const filteredDeps = m.dependencies.filter(d => 
        d.name.toLowerCase().includes(q)
      );

      if (matchModule || filteredTasks.length > 0 || filteredDeps.length > 0) {
        return {
          ...m,
          tasks: matchModule ? m.tasks : filteredTasks,
          dependencies: matchModule ? m.dependencies : filteredDeps,
        };
      }
      return null;
    }).filter((m): m is BuildModule => m !== null);
  }, [modules, filterQuery]);

  const getToolBadge = (tool: string) => {
    switch (tool) {
      case 'cargo':
        return <span className="w-4 h-4 rounded bg-[#E8833A] text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">🦀</span>;
      case 'npm':
        return <span className="w-4 h-4 rounded bg-[#CB3837] text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">npm</span>;
      case 'maven':
        return <span className="w-4 h-4 rounded bg-[#3574F0] text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">M</span>;
      case 'gradle':
        return <span className="w-4 h-4 rounded bg-[#02303A] text-[#00DE7A] font-bold text-[10px] flex items-center justify-center flex-shrink-0">G</span>;
      default:
        return <Package size={14} className="text-[#868A91]" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] select-none text-xs text-[#DFE1E5]">
      {/* Toolbar */}
      <div className="h-8 px-2.5 bg-[#2B2D30]/60 border-b border-[#2B2D30] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1.5 font-semibold text-xs tracking-wide text-[#DFE1E5]">
          <Package size={13} className="text-[#E5B567] flex-shrink-0" />
          <span>Build Tools</span>
        </div>

        <div className="flex items-center gap-0.5">
          <button 
            onClick={() => scanBuildModules()}
            title="Reload All Projects (Sync build files)"
            className="w-6 h-6 rounded flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B] transition-colors cursor-pointer"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-[#3574F0]' : ''} />
          </button>

          <button 
            onClick={() => setShowGoalInput(prev => !prev)}
            title="Execute Arbitrary Build Goal / Command"
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
              showGoalInput ? 'bg-[#3574F0] text-white' : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B]'
            }`}
          >
            <Terminal size={12} />
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
              title="Hide Build Window"
              className="w-6 h-6 rounded flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B] transition-colors cursor-pointer ml-0.5"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Goal command input overlay */}
      {showGoalInput && (
        <form onSubmit={handleRunGoal} className="p-2 bg-[#2B2D30] border-b border-[#393B40] flex items-center gap-1.5 animate-in fade-in duration-100">
          <Terminal size={12} className="text-[#E5B567] flex-shrink-0" />
          <input 
            type="text"
            autoFocus
            value={customGoalText}
            onChange={(e) => setCustomGoalText(e.target.value)}
            placeholder="Execute goal (e.g. cargo check, npm test)..."
            className="flex-1 bg-[#1E1F22] text-[#DFE1E5] text-[11px] rounded px-2 py-1 border border-[#393B40] focus:border-[#3574F0] outline-none font-mono"
          />
          <button 
            type="submit"
            className="px-2 py-1 bg-[#3574F0] hover:bg-[#3064D0] text-white rounded text-[11px] font-medium transition-colors"
          >
            Run
          </button>
          <button 
            type="button" 
            onClick={() => setShowGoalInput(false)}
            className="p-1 text-[#868A91] hover:text-[#DFE1E5]"
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
            placeholder="Filter tasks..."
            className="w-full bg-[#2B2D30] text-[#DFE1E5] text-[11px] rounded pl-7 pr-6 py-1 border border-transparent focus:border-[#3574F0] focus:outline-none placeholder-[#6E7278]"
          />
          {filterQuery && (
            <button 
              onClick={() => setFilterQuery('')}
              className="absolute right-1.5 text-[#868A91] hover:text-[#DFE1E5]"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Modules Tree */}
      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-[#35373B] scrollbar-track-transparent">
        {filteredModules.length === 0 ? (
          <div className="p-4 text-center text-[#868A91] text-xs">
            No build tasks found
          </div>
        ) : (
          filteredModules.map(module => {
            const isModExpanded = Boolean(expandedNodes[module.id]);
            const isTasksExpanded = Boolean(expandedNodes[`${module.tool}-tasks`]);
            const isDepsExpanded = Boolean(expandedNodes[`${module.tool}-deps`]);

            return (
              <div key={module.id} className="flex flex-col mb-1">
                {/* Module Header */}
                <div 
                  onClick={() => toggleExpand(module.id)}
                  className="flex items-center gap-1.5 px-2 py-1 hover:bg-[#2B2D30] cursor-pointer text-xs font-semibold text-[#DFE1E5]"
                >
                  <button className="text-[#868A91]">
                    {isModExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  {getToolBadge(module.tool)}
                  <span className="truncate">{module.name}</span>
                  <span className="text-[10px] text-[#868A91] font-mono ml-auto opacity-70">
                    {module.path}
                  </span>
                </div>

                {/* Module Children */}
                {isModExpanded && (
                  <div className="flex flex-col pl-3">
                    {/* Tasks folder */}
                    <div 
                      onClick={() => toggleExpand(`${module.tool}-tasks`)}
                      className="flex items-center gap-1.5 px-2 py-1 hover:bg-[#2B2D30]/60 cursor-pointer text-[11.5px] text-[#A8ADBD]"
                    >
                      <button className="text-[#868A91]">
                        {isTasksExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </button>
                      <Folder size={12} className="text-[#E5B567] fill-[#E5B567]/20" />
                      <span className="font-medium">Tasks ({module.tasks.length})</span>
                    </div>

                    {/* Task Items */}
                    {isTasksExpanded && (
                      <div className="flex flex-col pl-4">
                        {module.tasks.map(task => (
                          <div 
                            key={task.id}
                            onDoubleClick={() => onExecuteTask(task.tool, task.name, task.command)}
                            className="group flex items-center justify-between px-2 py-1 rounded hover:bg-[#2B2D30] cursor-pointer text-[11.5px] transition-colors"
                            title={`${task.command}${task.description ? ' — ' + task.description : ''}\n(Double-click to run)`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#59A869]" />
                              <span className="font-mono text-[#DFE1E5] font-medium group-hover:text-white">
                                {task.name}
                              </span>
                              {task.description && (
                                <span className="text-[10px] text-[#6E7278] truncate hidden group-hover:inline">
                                  {task.description}
                                </span>
                              )}
                            </div>

                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onExecuteTask(task.tool, task.name, task.command);
                              }}
                              title={`Run ${task.command}`}
                              className="w-5 h-5 rounded flex items-center justify-center text-[#59A869] hover:bg-[#59A869]/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0"
                            >
                              <Play size={10} className="fill-[#59A869]" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dependencies folder */}
                    <div 
                      onClick={() => toggleExpand(`${module.tool}-deps`)}
                      className="flex items-center gap-1.5 px-2 py-1 hover:bg-[#2B2D30]/60 cursor-pointer text-[11.5px] text-[#A8ADBD] mt-0.5"
                    >
                      <button className="text-[#868A91]">
                        {isDepsExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </button>
                      <Layers size={12} className="text-[#3574F0]" />
                      <span className="font-medium">Dependencies ({module.dependencies.length})</span>
                    </div>

                    {/* Dependency Items */}
                    {isDepsExpanded && (
                      <div className="flex flex-col pl-4">
                        {module.dependencies.map((dep, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center justify-between px-2 py-0.5 rounded text-[11px] text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/40 font-mono"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <Box size={10} className="text-[#6E7278] flex-shrink-0" />
                              <span className="truncate">{dep.name}</span>
                            </div>
                            {dep.version && (
                              <span className="text-[10px] text-[#6E7278] ml-2 flex-shrink-0 font-sans">
                                {dep.version}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer status */}
      <div className="h-5 px-2.5 bg-[#2B2D30]/40 border-t border-[#2B2D30] flex items-center justify-between text-[10px] text-[#868A91] flex-shrink-0 font-mono">
        <span>{modules.length} build module{modules.length !== 1 ? 's' : ''}</span>
        <span className="text-[#59A869]">Ready</span>
      </div>
    </div>
  );
};
