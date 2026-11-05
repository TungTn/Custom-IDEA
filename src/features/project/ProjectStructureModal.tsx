import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  X, 
  Box, 
  Folder, 
  Cpu, 
  BookOpen, 
  Package, 
  Puzzle, 
  Globe, 
  AlertTriangle, 
  Search,
} from 'lucide-react';
import { 
  SectionId, 
  ModuleItem, 
  LibraryItem, 
  FacetItem, 
  ArtifactItem, 
  SdkItem, 
  ProblemItem, 
  GlobalLibraryItem,
  LANGUAGE_LEVELS, 
  INITIAL_MODULES, 
  INITIAL_LIBRARIES, 
  INITIAL_FACETS, 
  INITIAL_ARTIFACTS, 
  INITIAL_SDKS, 
  INITIAL_GLOBAL_LIBRARIES 
} from './structure/types';
import {
  ProjectSettingsPanel,
  ModulesPanel,
  LibrariesPanel,
  FacetsPanel,
  ArtifactsPanel,
  SdksPanel,
  GlobalLibrariesPanel,
  ProblemsStructurePanel,
} from './structure/panels';

export interface ProjectStructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  files?: any[];
  problems?: any[];
  onSave: (newName: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export type { SectionId, ModuleItem, LibraryItem, FacetItem, ArtifactItem, SdkItem, ProblemItem, GlobalLibraryItem };

export const ProjectStructureModal: React.FC<ProjectStructureModalProps> = ({
  isOpen,
  onClose,
  projectName,
  files = [],
  problems: incomingProblems = [],
  onSave,
  onShowToast,
}) => {
  const [activeSection, setActiveSection] = useState<SectionId>('project');
  const [searchFilter, setSearchFilter] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Project Settings State
  const [name, setName] = useState(projectName);
  const [projectSdk, setProjectSdk] = useState('Rust 1.99.1 (MSVC x86_64)');
  const [projectLangLevel, setProjectLangLevel] = useState('Rust Edition 2021 (Default)');
  const [compilerOutput, setCompilerOutput] = useState('D:\\IDE\\target\\debug');
  const [projectFormat] = useState('.idea (directory based)');

  // Domain Entities State
  const [modules, setModules] = useState<ModuleItem[]>(INITIAL_MODULES);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('mod-root');

  const [libraries, setLibraries] = useState<LibraryItem[]>(INITIAL_LIBRARIES);
  const [selectedLibId, setSelectedLibId] = useState<string>('lib-tauri');

  const [facets] = useState<FacetItem[]>(INITIAL_FACETS);

  const [artifacts, setArtifacts] = useState<ArtifactItem[]>(INITIAL_ARTIFACTS);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string>('art-portable');

  const [sdks, setSdks] = useState<SdkItem[]>(INITIAL_SDKS);
  const [selectedSdkId, setSelectedSdkId] = useState<string>('sdk-rust');

  const [globalLibraries] = useState<GlobalLibraryItem[]>(INITIAL_GLOBAL_LIBRARIES);
  const [problems, setProblems] = useState<ProblemItem[]>([]);

  // Sync incoming LSP diagnostics to problems
  useEffect(() => {
    if (incomingProblems && incomingProblems.length > 0) {
      setProblems(incomingProblems.map((p: any, idx: number) => ({
        id: p.id || `prob-${idx}`,
        severity: p.severity || 'info',
        title: `${p.fileName || 'file'}:${p.line || 1} - ${p.source || 'Diagnostic'}`,
        description: p.message || 'Issue detected in project source',
        fixAction: 'Jump to Source',
        fixed: false,
      })));
    } else {
      setProblems([]);
    }
  }, [incomingProblems, isOpen]);

  // Load persistence
  useEffect(() => {
    try {
      const saved = localStorage.getItem('intellij_project_structure');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.projectName) setName(parsed.projectName);
        if (parsed.projectSdk) setProjectSdk(parsed.projectSdk);
        if (parsed.projectLangLevel) setProjectLangLevel(parsed.projectLangLevel);
        if (parsed.compilerOutput) setCompilerOutput(parsed.compilerOutput);
        if (parsed.modules) setModules(parsed.modules);
        if (parsed.sdks) setSdks(parsed.sdks);
        if (parsed.libraries) setLibraries(parsed.libraries);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Update Language Level dropdown when Project SDK changes
  const handleSdkChange = (sdkName: string) => {
    setProjectSdk(sdkName);
    setIsDirty(true);
    const targetSdk = sdks.find(s => s.name === sdkName);
    if (targetSdk && LANGUAGE_LEVELS[targetSdk.type]) {
      const options = LANGUAGE_LEVELS[targetSdk.type];
      if (!options.includes(projectLangLevel)) {
        setProjectLangLevel(options[0]);
      }
    }
  };

  const handleApply = () => {
    if (name.trim()) {
      onSave(name.trim());
    }
    try {
      const data = {
        projectName: name.trim(),
        projectSdk,
        projectLangLevel,
        compilerOutput,
        modules,
        sdks,
        libraries,
      };
      localStorage.setItem('intellij_project_structure', JSON.stringify(data));
      setIsDirty(false);
      onShowToast?.('Project Structure Applied', 'Project settings saved successfully', 'success');
    } catch (e) {
      console.error(e);
    }
  };

  const handleOK = () => {
    handleApply();
    onClose();
  };

  const currentSdkType = sdks.find(s => s.name === projectSdk)?.type || 'Rust';
  const availableLangLevels = LANGUAGE_LEVELS[currentSdkType] || LANGUAGE_LEVELS['Rust'];
  const unfixedProblemsCount = problems.filter(p => !p.fixed).length;

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[980px] h-[660px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl flex flex-col overflow-hidden text-[#DFE1E5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="h-11 bg-[#212225] border-b border-[#393B40] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[#3574F0]" />
            <span className="text-xs font-semibold text-[#DFE1E5]">Project Structure (Ctrl+Alt+Shift+S)</span>
            <span className="text-[11px] text-[#868A91]">— {name}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex items-center">
              <Search size={12} className="absolute left-2 text-[#868A91]" />
              <input 
                type="text" 
                placeholder="Search settings..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded pl-7 pr-2 py-0.5 text-xs text-[#DFE1E5] placeholder:text-[#868A91] outline-none w-44"
              />
            </div>
            <button 
              onClick={onClose} 
              className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5] cursor-pointer"
              title="Close (Esc)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Modal Body: Left Tree Nav + Right Detail Pane */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation Tree */}
          <div className="w-[220px] bg-[#26282B] border-r border-[#393B40] flex flex-col p-2 space-y-4 overflow-y-auto">
            {/* Project Settings Group */}
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[#868A91] px-2 py-1">
                Project Settings
              </div>
              <div className="space-y-0.5 mt-1">
                <button
                  onClick={() => setActiveSection('project')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                    activeSection === 'project' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  <Folder size={14} className={activeSection === 'project' ? 'text-white' : 'text-[#3574F0]'} />
                  <span>Project</span>
                </button>

                <button
                  onClick={() => setActiveSection('modules')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                    activeSection === 'modules' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Box size={14} className={activeSection === 'modules' ? 'text-white' : 'text-[#E5B567]'} />
                    <span>Modules</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                    activeSection === 'modules' ? 'bg-white/20 text-white' : 'bg-[#35373B] text-[#868A91]'
                  }`}>
                    {modules.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveSection('libraries')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                    activeSection === 'libraries' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen size={14} className={activeSection === 'libraries' ? 'text-white' : 'text-[#59A869]'} />
                    <span>Libraries</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                    activeSection === 'libraries' ? 'bg-white/20 text-white' : 'bg-[#35373B] text-[#868A91]'
                  }`}>
                    {libraries.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveSection('facets')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                    activeSection === 'facets' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Puzzle size={14} className={activeSection === 'facets' ? 'text-white' : 'text-[#9876AA]'} />
                    <span>Facets</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                    activeSection === 'facets' ? 'bg-white/20 text-white' : 'bg-[#35373B] text-[#868A91]'
                  }`}>
                    {facets.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveSection('artifacts')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                    activeSection === 'artifacts' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Package size={14} className={activeSection === 'artifacts' ? 'text-white' : 'text-[#CC7832]'} />
                    <span>Artifacts</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                    activeSection === 'artifacts' ? 'bg-white/20 text-white' : 'bg-[#35373B] text-[#868A91]'
                  }`}>
                    {artifacts.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Platform Settings Group */}
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[#868A91] px-2 py-1">
                Platform Settings
              </div>
              <div className="space-y-0.5 mt-1">
                <button
                  onClick={() => setActiveSection('sdks')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                    activeSection === 'sdks' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Cpu size={14} className={activeSection === 'sdks' ? 'text-white' : 'text-[#3574F0]'} />
                    <span>SDKs</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                    activeSection === 'sdks' ? 'bg-white/20 text-white' : 'bg-[#35373B] text-[#868A91]'
                  }`}>
                    {sdks.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveSection('global-libraries')}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                    activeSection === 'global-libraries' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  <Globe size={14} className={activeSection === 'global-libraries' ? 'text-white' : 'text-[#868A91]'} />
                  <span>Global Libraries</span>
                </button>

                <button
                  onClick={() => setActiveSection('problems')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                    activeSection === 'problems' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle size={14} className={unfixedProblemsCount > 0 ? 'text-[#EDA200]' : 'text-[#59A869]'} />
                    <span>Problems</span>
                  </div>
                  {unfixedProblemsCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#EDA200]/20 text-[#EDA200] font-bold">
                      {unfixedProblemsCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 bg-[#2B2D30] overflow-y-auto p-6">
            {activeSection === 'project' && (
              <ProjectSettingsPanel
                name={name}
                setName={setName}
                projectSdk={projectSdk}
                handleSdkChange={handleSdkChange}
                projectLangLevel={projectLangLevel}
                setProjectLangLevel={setProjectLangLevel}
                compilerOutput={compilerOutput}
                setCompilerOutput={setCompilerOutput}
                projectFormat={projectFormat}
                sdks={sdks}
                availableLangLevels={availableLangLevels}
                currentSdkType={currentSdkType}
                setIsDirty={setIsDirty}
                onNavigateToSdks={() => setActiveSection('sdks')}
                onShowToast={onShowToast}
              />
            )}

            {activeSection === 'modules' && (
              <ModulesPanel
                modules={modules}
                setModules={setModules}
                selectedModuleId={selectedModuleId}
                setSelectedModuleId={setSelectedModuleId}
                compilerOutput={compilerOutput}
                setIsDirty={setIsDirty}
                onShowToast={onShowToast}
              />
            )}

            {activeSection === 'libraries' && (
              <LibrariesPanel
                libraries={libraries}
                setLibraries={setLibraries}
                selectedLibId={selectedLibId}
                setSelectedLibId={setSelectedLibId}
                modules={modules}
                setIsDirty={setIsDirty}
                onShowToast={onShowToast}
              />
            )}

            {activeSection === 'facets' && (
              <FacetsPanel
                facets={facets}
              />
            )}

            {activeSection === 'artifacts' && (
              <ArtifactsPanel
                artifacts={artifacts}
                setArtifacts={setArtifacts}
                selectedArtifactId={selectedArtifactId}
                setSelectedArtifactId={setSelectedArtifactId}
                setIsDirty={setIsDirty}
              />
            )}

            {activeSection === 'sdks' && (
              <SdksPanel
                sdks={sdks}
                setSdks={setSdks}
                selectedSdkId={selectedSdkId}
                setSelectedSdkId={setSelectedSdkId}
                projectSdk={projectSdk}
                onSdkChange={handleSdkChange}
                setIsDirty={setIsDirty}
                onShowToast={onShowToast}
              />
            )}

            {activeSection === 'global-libraries' && (
              <GlobalLibrariesPanel
                globalLibraries={globalLibraries}
              />
            )}

            {activeSection === 'problems' && (
              <ProblemsStructurePanel
                problems={problems}
                setProblems={setProblems}
                onShowToast={onShowToast}
              />
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-12 bg-[#212225] border-t border-[#393B40] flex items-center justify-between px-5">
          <div className="text-[11px] text-[#868A91] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#59A869]" />
            <span>Project SDK: <strong className="text-white">{projectSdk}</strong></span>
            <span className="text-[#393B40]">|</span>
            <span>Language Level: <strong className="text-[#3574F0]">{projectLangLevel}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApply}
              disabled={!isDirty}
              className={`px-4 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                isDirty 
                  ? 'bg-[#35373B] hover:bg-[#4E5157] text-white font-medium' 
                  : 'text-[#868A91] cursor-not-allowed opacity-50'
              }`}
            >
              Apply
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleOK}
              className="px-5 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ProjectStructureModal;
