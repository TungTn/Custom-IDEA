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
  Download,
  ShieldCheck,
  Globe,
  Settings,
  MoreVertical,
  Cpu,
  Folder
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export interface MavenTask {
  id: string;
  name: string;
  command: string;
  group: 'lifecycle' | 'plugin';
  pluginName?: string;
  description?: string;
}

export interface MavenDependency {
  groupId: string;
  artifactId: string;
  version?: string;
  scope?: string;
}

interface MavenPanelProps {
  projectPath?: string;
  onExecuteTask: (tool: string, taskName: string, command: string) => void;
  onExecuteCustomGoal?: (command: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onClose?: () => void;
}

export const MavenIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
    <rect width="16" height="16" rx="3" fill="#C75C5C" fillOpacity="0.25" />
    <text x="8" y="11.5" textAnchor="middle" fill="#E06C75" fontSize="10.5" fontWeight="bold" fontFamily="sans-serif">M</text>
  </svg>
);

export const MavenPanel: React.FC<MavenPanelProps> = ({
  projectPath = 'D:\\IDE',
  onExecuteTask,
  onExecuteCustomGoal,
  onShowToast,
  onClose,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'maven-root': true,
    'maven-lifecycle': true,
    'maven-plugins': true,
    'plugin-spring-boot': true,
    'maven-dependencies': false,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [customGoalText, setCustomGoalText] = useState('');
  const [skipTests, setSkipTests] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  
  const [projectName, setProjectName] = useState('maven-project');
  const [dependencies, setDependencies] = useState<MavenDependency[]>([]);
  const [hasPomFile, setHasPomFile] = useState(false);

  // Maven Lifecycle Goals (Standard Apache Maven)
  const lifecycleGoals: MavenTask[] = [
    { id: 'mvn-clean', name: 'clean', command: 'mvn clean', group: 'lifecycle', description: 'Remove target build directory and generated files' },
    { id: 'mvn-validate', name: 'validate', command: 'mvn validate', group: 'lifecycle', description: 'Validate project is correct and all info available' },
    { id: 'mvn-compile', name: 'compile', command: 'mvn compile', group: 'lifecycle', description: 'Compile the source code of the project' },
    { id: 'mvn-test', name: 'test', command: 'mvn test', group: 'lifecycle', description: 'Test compiled source code with Surefire' },
    { id: 'mvn-package', name: 'package', command: 'mvn package', group: 'lifecycle', description: 'Package compiled code into distributable JAR/WAR' },
    { id: 'mvn-verify', name: 'verify', command: 'mvn verify', group: 'lifecycle', description: 'Run checks on integration test results' },
    { id: 'mvn-install', name: 'install', command: 'mvn install', group: 'lifecycle', description: 'Install package into local repository (~/.m2)' },
    { id: 'mvn-site', name: 'site', command: 'mvn site', group: 'lifecycle', description: 'Generate project site documentation' },
    { id: 'mvn-deploy', name: 'deploy', command: 'mvn deploy', group: 'lifecycle', description: 'Copies final package to remote repository' },
  ];

  // Maven Plugin Goals (Spring Boot, Compiler, Surefire, Jar)
  const pluginGroups = [
    {
      id: 'plugin-spring-boot',
      name: 'spring-boot',
      goals: [
        { id: 'mvn-sb-run', name: 'spring-boot:run', command: 'mvn spring-boot:run', group: 'plugin' as const, pluginName: 'spring-boot', description: 'Run Spring Boot application locally' },
        { id: 'mvn-sb-repackage', name: 'spring-boot:repackage', command: 'mvn spring-boot:repackage', group: 'plugin' as const, pluginName: 'spring-boot', description: 'Repackage existing JAR into executable uber-JAR' },
        { id: 'mvn-sb-start', name: 'spring-boot:start', command: 'mvn spring-boot:start', group: 'plugin' as const, pluginName: 'spring-boot', description: 'Start Spring Boot in background' },
        { id: 'mvn-sb-stop', name: 'spring-boot:stop', command: 'mvn spring-boot:stop', group: 'plugin' as const, pluginName: 'spring-boot', description: 'Stop running Spring Boot instance' },
      ]
    },
    {
      id: 'plugin-compiler',
      name: 'compiler',
      goals: [
        { id: 'mvn-comp-compile', name: 'compiler:compile', command: 'mvn compiler:compile', group: 'plugin' as const, pluginName: 'compiler', description: 'Compile main java sources' },
        { id: 'mvn-comp-test', name: 'compiler:testCompile', command: 'mvn compiler:testCompile', group: 'plugin' as const, pluginName: 'compiler', description: 'Compile test java sources' },
      ]
    },
    {
      id: 'plugin-surefire',
      name: 'surefire',
      goals: [
        { id: 'mvn-surefire-test', name: 'surefire:test', command: 'mvn surefire:test', group: 'plugin' as const, pluginName: 'surefire', description: 'Run test classes with Surefire test runner' },
      ]
    },
    {
      id: 'plugin-jar',
      name: 'jar',
      goals: [
        { id: 'mvn-jar-jar', name: 'jar:jar', command: 'mvn jar:jar', group: 'plugin' as const, pluginName: 'jar', description: 'Build jar archive from compiled classes' },
      ]
    },
    {
      id: 'plugin-clean',
      name: 'clean',
      goals: [
        { id: 'mvn-clean-clean', name: 'clean:clean', command: 'mvn clean:clean', group: 'plugin' as const, pluginName: 'clean', description: 'Delete all generated build artifacts' },
      ]
    }
  ];

  // Scan project pom.xml
  const scanMavenProject = async () => {
    setIsRefreshing(true);
    let foundPom = false;
    let projTitle = 'backend-service';
    let deps: MavenDependency[] = [];

    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      try {
        const pomContent = await invoke<string>('read_file_content', { path: `${projectPath}\\pom.xml` })
          .catch(() => invoke<string>('read_file_content', { path: `${projectPath}/pom.xml` }));

        if (pomContent) {
          foundPom = true;
          // Extract artifactId or name
          const artMatch = pomContent.match(/<artifactId>([^<]+)<\/artifactId>/);
          if (artMatch) projTitle = artMatch[1];
          const nameMatch = pomContent.match(/<name>([^<]+)<\/name>/);
          if (nameMatch) projTitle = nameMatch[1];

          // Extract dependencies
          const depRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
          let match;
          while ((match = depRegex.exec(pomContent)) !== null) {
            const block = match[1];
            const g = block.match(/<groupId>([^<]+)<\/groupId>/)?.[1] || '';
            const a = block.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1] || '';
            const v = block.match(/<version>([^<]+)<\/version>/)?.[1];
            const s = block.match(/<scope>([^<]+)<\/scope>/)?.[1];
            if (g && a) {
              deps.push({ groupId: g, artifactId: a, version: v, scope: s });
            }
          }
        }
      } catch (e) {
        // Pom not found on disk
      }
    }

    if (!foundPom || deps.length === 0) {
      // Provide default enterprise Spring Boot backend starter dependencies
      deps = [
        { groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-web', version: '3.2.4', scope: 'compile' },
        { groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-data-jpa', version: '3.2.4', scope: 'compile' },
        { groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-validation', version: '3.2.4', scope: 'compile' },
        { groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-security', version: '3.2.4', scope: 'compile' },
        { groupId: 'org.postgresql', artifactId: 'postgresql', version: '42.7.2', scope: 'runtime' },
        { groupId: 'com.mysql', artifactId: 'mysql-connector-j', version: '8.3.0', scope: 'runtime' },
        { groupId: 'org.projectlombok', artifactId: 'lombok', version: '1.18.30', scope: 'provided' },
        { groupId: 'org.springdoc', artifactId: 'springdoc-openapi-starter-webmvc-ui', version: '2.3.0', scope: 'compile' },
        { groupId: 'org.springframework.boot', artifactId: 'spring-boot-starter-test', version: '3.2.4', scope: 'test' },
      ];
    }

    setHasPomFile(foundPom);
    setProjectName(projTitle);
    setDependencies(deps);
    setIsRefreshing(false);
  };

  useEffect(() => {
    scanMavenProject();
  }, [projectPath]);

  const toggleNode = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const map: Record<string, boolean> = {
      'maven-root': true,
      'maven-lifecycle': true,
      'maven-plugins': true,
      'maven-dependencies': true,
    };
    pluginGroups.forEach(g => { map[g.id] = true; });
    setExpandedNodes(map);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  const handleRunGoal = (cmd: string, taskName: string) => {
    let finalCmd = cmd;
    if (skipTests && !finalCmd.includes('-DskipTests')) {
      finalCmd += ' -DskipTests';
    }
    if (offlineMode && !finalCmd.includes('-o')) {
      finalCmd += ' -o';
    }
    onExecuteTask('maven', taskName, finalCmd);
    onShowToast?.('Maven Goal', `Running: ${finalCmd}`, 'info');
  };

  const handleCustomGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoalText.trim()) return;
    let fullCmd = customGoalText.trim().startsWith('mvn') 
      ? customGoalText.trim() 
      : `mvn ${customGoalText.trim()}`;
    if (skipTests && !fullCmd.includes('-DskipTests')) {
      fullCmd += ' -DskipTests';
    }
    if (offlineMode && !fullCmd.includes('-o')) {
      fullCmd += ' -o';
    }
    onExecuteCustomGoal?.(fullCmd);
    onShowToast?.('Maven Goal', `Executing: ${fullCmd}`, 'info');
    setShowGoalInput(false);
    setCustomGoalText('');
  };

  const filteredGoals = useMemo(() => {
    if (!filterQuery.trim()) return lifecycleGoals;
    const q = filterQuery.toLowerCase();
    return lifecycleGoals.filter(g => 
      g.name.toLowerCase().includes(q) || 
      g.command.toLowerCase().includes(q) || 
      (g.description && g.description.toLowerCase().includes(q))
    );
  }, [filterQuery]);

  const filteredDeps = useMemo(() => {
    if (!filterQuery.trim()) return dependencies;
    const q = filterQuery.toLowerCase();
    return dependencies.filter(d => 
      d.artifactId.toLowerCase().includes(q) || 
      d.groupId.toLowerCase().includes(q)
    );
  }, [dependencies, filterQuery]);

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] select-none text-xs text-[#DFE1E5]">
      {/* Maven Toolbar */}
      <div className="h-8 px-2.5 bg-[#2B2D30]/60 border-b border-[#2B2D30] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1.5 font-semibold text-xs tracking-wide text-[#DFE1E5]">
          <MavenIcon size={14} />
          <span>Maven</span>
          {hasPomFile ? (
            <span className="text-[10px] text-[#59A869] font-normal px-1 rounded bg-[#59A869]/10">pom.xml</span>
          ) : (
            <span className="text-[10px] text-[#E5B567] font-normal px-1 rounded bg-[#E5B567]/10">default</span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {/* Reload / Reimport */}
          <button 
            onClick={() => {
              scanMavenProject();
              onShowToast?.('Maven Sync', 'Reimported all Maven projects and dependencies', 'success');
            }}
            title="Reload All Maven Projects (Sync pom.xml)"
            className="w-6 h-6 rounded flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B] transition-colors cursor-pointer"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-[#3574F0]' : ''} />
          </button>

          {/* Execute Goal */}
          <button 
            onClick={() => setShowGoalInput(prev => !prev)}
            title="Execute Maven Goal (mvn ...)"
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
              showGoalInput ? 'bg-[#3574F0] text-white' : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B]'
            }`}
          >
            <Terminal size={12} />
          </button>

          {/* Skip Tests Toggle */}
          <button 
            onClick={() => {
              setSkipTests(prev => !prev);
              onShowToast?.('Skip Tests Mode', !skipTests ? 'Enabled (-DskipTests)' : 'Disabled', 'info');
            }}
            title={skipTests ? 'Skip Tests: ON (-DskipTests)' : 'Skip Tests: OFF'}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer text-[10px] font-bold ${
              skipTests ? 'bg-[#E5B567] text-[#1E1F22]' : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B]'
            }`}
          >
            -T
          </button>

          {/* Offline Mode Toggle */}
          <button 
            onClick={() => {
              setOfflineMode(prev => !prev);
              onShowToast?.('Offline Mode', !offlineMode ? 'Work Offline (-o)' : 'Online', 'info');
            }}
            title={offlineMode ? 'Offline Mode: ON (-o)' : 'Offline Mode: OFF'}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
              offlineMode ? 'bg-[#3574F0] text-white' : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B]'
            }`}
          >
            <Globe size={12} />
          </button>

          {/* Download Sources */}
          <button 
            onClick={() => handleRunGoal('mvn dependency:sources dependency:resolve -Dclassifier=javadoc', 'download-sources')}
            title="Download Sources and Documentation"
            className="w-6 h-6 rounded flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B] transition-colors cursor-pointer"
          >
            <Download size={12} />
          </button>

          {/* Expand All */}
          <button 
            onClick={expandAll}
            title="Expand All"
            className="w-6 h-6 rounded flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B] transition-colors cursor-pointer"
          >
            <ChevronsUpDown size={12} />
          </button>

          {/* Collapse All */}
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
              title="Hide Maven Window"
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
          <Terminal size={12} className="text-[#E06C75] flex-shrink-0" />
          <input 
            type="text"
            autoFocus
            value={customGoalText}
            onChange={(e) => setCustomGoalText(e.target.value)}
            placeholder="Execute goal (e.g. clean install, spring-boot:run)..."
            className="flex-1 bg-[#1E1F22] text-[#DFE1E5] text-[11px] rounded px-2 py-1 border border-[#393B40] focus:border-[#3574F0] outline-none font-mono"
          />
          <button 
            type="submit"
            className="px-2.5 py-1 bg-[#3574F0] hover:bg-[#3064D0] text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
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
            placeholder="Filter Maven goals & dependencies..."
            className="w-full bg-[#2B2D30] text-[#DFE1E5] text-[11px] rounded pl-7 pr-6 py-1 border border-transparent focus:border-[#3574F0] focus:outline-none placeholder-[#6E7278]"
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

      {/* Maven Project Tree */}
      <div className="flex-1 overflow-y-auto p-1 font-mono text-[11.5px] select-none">
        {/* Root Project Node */}
        <div className="space-y-0.5">
          <div 
            onClick={(e) => toggleNode('maven-root', e)}
            className="flex items-center gap-1.5 px-2 py-1 hover:bg-[#2B2D30] rounded cursor-pointer text-[#DFE1E5] font-semibold font-sans"
          >
            {expandedNodes['maven-root'] ? <ChevronDown size={13} className="text-[#868A91]" /> : <ChevronRight size={13} className="text-[#868A91]" />}
            <MavenIcon size={14} />
            <span className="truncate">{projectName}</span>
            <span className="text-[10px] text-[#868A91] font-normal ml-auto">(root)</span>
          </div>

          {expandedNodes['maven-root'] && (
            <div className="pl-4 space-y-1">
              {/* 1. Lifecycle Folder */}
              <div>
                <div 
                  onClick={(e) => toggleNode('maven-lifecycle', e)}
                  className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-[#2B2D30] rounded cursor-pointer text-[#868A91] hover:text-[#DFE1E5]"
                >
                  {expandedNodes['maven-lifecycle'] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <Folder size={12} className="text-[#3574F0]" />
                  <span className="font-semibold text-[11px]">Lifecycle</span>
                  <span className="text-[10px] text-[#6E7278] ml-auto">({filteredGoals.length})</span>
                </div>

                {expandedNodes['maven-lifecycle'] && (
                  <div className="pl-4 space-y-0.5">
                    {filteredGoals.map((goal) => (
                      <div 
                        key={goal.id}
                        onDoubleClick={() => handleRunGoal(goal.command, goal.name)}
                        className="group flex items-center justify-between px-2 py-0.5 hover:bg-[#2B2D30] rounded cursor-pointer text-[#DFE1E5]"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#868A91] group-hover:bg-[#3574F0] flex-shrink-0" />
                          <span className="font-medium text-[11px] truncate group-hover:text-white">{goal.name}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRunGoal(goal.command, goal.name);
                            }}
                            title={`Execute: ${goal.command}`}
                            className="p-0.5 hover:bg-[#35373B] text-[#59A869] rounded cursor-pointer"
                          >
                            <Play size={11} fill="currentColor" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Plugins Folder */}
              <div>
                <div 
                  onClick={(e) => toggleNode('maven-plugins', e)}
                  className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-[#2B2D30] rounded cursor-pointer text-[#868A91] hover:text-[#DFE1E5]"
                >
                  {expandedNodes['maven-plugins'] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <Folder size={12} className="text-[#E5B567]" />
                  <span className="font-semibold text-[11px]">Plugins</span>
                </div>

                {expandedNodes['maven-plugins'] && (
                  <div className="pl-4 space-y-0.5">
                    {pluginGroups.map((pg) => (
                      <div key={pg.id}>
                        <div 
                          onClick={(e) => toggleNode(pg.id, e)}
                          className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-[#2B2D30] rounded cursor-pointer text-[#DFE1E5]"
                        >
                          {expandedNodes[pg.id] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          <Package size={11} className="text-[#E06C75]" />
                          <span className="font-semibold text-[11px]">{pg.name}</span>
                        </div>

                        {expandedNodes[pg.id] && (
                          <div className="pl-4 space-y-0.5">
                            {pg.goals.map((g) => (
                              <div 
                                key={g.id}
                                onDoubleClick={() => handleRunGoal(g.command, g.name)}
                                className="group flex items-center justify-between px-2 py-0.5 hover:bg-[#2B2D30] rounded cursor-pointer text-[#DFE1E5]"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5B567] flex-shrink-0" />
                                  <span className="text-[11px] truncate group-hover:text-white">{g.name}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRunGoal(g.command, g.name);
                                    }}
                                    title={`Execute: ${g.command}`}
                                    className="p-0.5 hover:bg-[#35373B] text-[#59A869] rounded cursor-pointer"
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

              {/* 3. Dependencies Folder */}
              <div>
                <div 
                  onClick={(e) => toggleNode('maven-dependencies', e)}
                  className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-[#2B2D30] rounded cursor-pointer text-[#868A91] hover:text-[#DFE1E5]"
                >
                  {expandedNodes['maven-dependencies'] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <Folder size={12} className="text-[#9876AA]" />
                  <span className="font-semibold text-[11px]">Dependencies</span>
                  <span className="text-[10px] text-[#6E7278] ml-auto">({filteredDeps.length})</span>
                </div>

                {expandedNodes['maven-dependencies'] && (
                  <div className="pl-4 space-y-0.5">
                    {filteredDeps.map((dep, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between px-2 py-0.5 hover:bg-[#2B2D30] rounded cursor-pointer text-[#DFE1E5] text-[10.5px]"
                        title={`${dep.groupId}:${dep.artifactId}:${dep.version || ''} (${dep.scope || 'compile'})`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Box size={10} className="text-[#868A91] flex-shrink-0" />
                          <span className="text-white truncate">{dep.artifactId}</span>
                          {dep.version && (
                            <span className="text-[#868A91] text-[9.5px]">:{dep.version}</span>
                          )}
                        </div>
                        {dep.scope && (
                          <span className={`text-[9px] px-1 rounded uppercase ${
                            dep.scope === 'test' ? 'text-[#E5B567] bg-[#E5B567]/10' :
                            dep.scope === 'runtime' ? 'text-[#59A869] bg-[#59A869]/10' :
                            'text-[#868A91] bg-[#2B2D30]'
                          }`}>
                            {dep.scope}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
