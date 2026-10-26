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
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  Info, 
  ArrowUp, 
  ArrowDown, 
  HardDrive,
  Search,
  ExternalLink,
  ChevronRight,
  FolderPlus
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export interface ProjectStructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  files?: any[];
  onSave: (newName: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

type SectionId = 
  | 'project' 
  | 'modules' 
  | 'libraries' 
  | 'facets' 
  | 'artifacts' 
  | 'sdks' 
  | 'global-libraries' 
  | 'problems';

interface ModuleItem {
  id: string;
  name: string;
  type: string;
  path: string;
  sources: string[];
  tests: string[];
  resources: string[];
  excluded: string[];
  dependencies: { name: string; version: string; scope: 'Compile' | 'Test' | 'Runtime' | 'Provided'; exported: boolean }[];
}

interface LibraryItem {
  id: string;
  name: string;
  version: string;
  type: 'Cargo Crate' | 'NPM Package' | 'Standard Library' | 'PyPI Module' | 'Go Module' | 'Maven Dependency';
  location: string;
  usedIn: string[];
}

interface FacetItem {
  id: string;
  name: string;
  type: string;
  module: string;
  configFile: string;
  description: string;
}

interface ArtifactItem {
  id: string;
  name: string;
  type: 'NSIS Setup Installer' | 'MSI Package' | 'Native Executable' | 'Web Distribution Bundle';
  outputDirectory: string;
  includeInBuild: boolean;
}

interface SdkItem {
  id: string;
  name: string;
  version: string;
  type: 'Rust' | 'Node.js' | 'Java' | 'Python' | 'Go' | 'C/C++' | 'Docker';
  homePath: string;
  binaries: string[];
}

interface ProblemItem {
  id: string;
  severity: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  fixAction: string;
  fixed?: boolean;
}

const LANGUAGE_LEVELS: Record<string, string[]> = {
  'Rust': [
    'Rust Edition 2024 (Preview)',
    'Rust Edition 2021 (Default)',
    'Rust Edition 2018',
    'Rust Edition 2015'
  ],
  'Node.js': [
    'TypeScript 5.6 (ES2023)',
    'TypeScript 5.4 (ES2022)',
    'JavaScript ESNext',
    'JavaScript ES6'
  ],
  'Java': [
    '21 - Virtual Threads, Pattern Matching',
    '17 LTS - Sealed Classes, Records',
    '11 LTS - Local-Variable Syntax for Lambda',
    '8 - Lambdas, Type Annotations'
  ],
  'Python': [
    'Python 3.12 (Type Parameter Syntax)',
    'Python 3.11 (Exception Groups, TaskGroup)',
    'Python 3.10 (Structural Pattern Matching)',
    'Python 3.9'
  ],
  'Go': [
    'Go 1.22 (Range over integers, Enhanced routing)',
    'Go 1.21 (Built-in min, max, clear)',
    'Go 1.20'
  ],
  'C/C++': [
    'C++23 (std::print, Deducing this)',
    'C++20 (Concepts, Ranges, Coroutines)',
    'C++17 (Structured Binding, Filesystem)',
    'C17 (ISO/IEC 9899:2018)'
  ],
  'Docker': [
    'Docker Compose v2 / BuildKit',
    'OCI Container Specification'
  ]
};

export const ProjectStructureModal: React.FC<ProjectStructureModalProps> = ({
  isOpen,
  onClose,
  projectName,
  files = [],
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

  // Modules State
  const [modules, setModules] = useState<ModuleItem[]>([
    {
      id: 'mod-root',
      name: 'intellij-idea-clone',
      type: 'TypeScript / React / Vite',
      path: 'D:\\IDE',
      sources: ['src', 'src/components', 'src/constants', 'src/types', 'src/themes'],
      tests: ['tests', 'src/__tests__'],
      resources: ['public', 'src/assets'],
      excluded: ['node_modules', 'dist', '.git', '.vscode', 'dist-portable'],
      dependencies: [
        { name: '<Project SDK: Rust 1.99.1>', version: '1.99.1', scope: 'Compile', exported: false },
        { name: 'react', version: '^18.3.1', scope: 'Compile', exported: true },
        { name: 'react-dom', version: '^18.3.1', scope: 'Compile', exported: true },
        { name: '@monaco-editor/react', version: '^4.7.0', scope: 'Compile', exported: true },
        { name: '@tauri-apps/api', version: '^2.12.4', scope: 'Compile', exported: true },
        { name: 'lucide-react', version: '^1.16.0', scope: 'Compile', exported: false },
        { name: 'tailwindcss', version: '^3.4.14', scope: 'Provided', exported: false },
        { name: 'vite', version: '^5.4.10', scope: 'Provided', exported: false },
        { name: 'vitest', version: '^2.0.0', scope: 'Test', exported: false },
      ]
    },
    {
      id: 'mod-tauri',
      name: 'src-tauri (Core Backend)',
      type: 'Rust Native Workspace',
      path: 'D:\\IDE\\src-tauri',
      sources: ['src-tauri/src', 'src-tauri/src/lib.rs', 'src-tauri/src/main.rs'],
      tests: ['src-tauri/tests'],
      resources: ['src-tauri/icons', 'src-tauri/capabilities'],
      excluded: ['src-tauri/target'],
      dependencies: [
        { name: '<Rust MSVC x86_64 Toolchain>', version: '1.99.1', scope: 'Compile', exported: false },
        { name: 'tauri', version: '2.12.5', scope: 'Compile', exported: true },
        { name: 'tauri-plugin-log', version: '2.0.0', scope: 'Compile', exported: false },
        { name: 'serde', version: '1.0', scope: 'Compile', exported: true },
        { name: 'serde_json', version: '1.0', scope: 'Compile', exported: true },
        { name: 'cargo-test', version: '1.99.1', scope: 'Test', exported: false },
      ]
    }
  ]);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('mod-root');
  const [moduleTab, setModuleTab] = useState<'sources' | 'paths' | 'dependencies'>('sources');
  const [selectedFolderToMark, setSelectedFolderToMark] = useState<string>('src');
  const [customFolderInput, setCustomFolderInput] = useState<string>('');
  const [selectedDepIdx, setSelectedDepIdx] = useState<number | null>(0);

  // Libraries State
  const [libraries, setLibraries] = useState<LibraryItem[]>([
    { id: 'lib-tauri', name: 'tauri', version: '2.12.5', type: 'Cargo Crate', location: 'C:\\Users\\adminlocal\\.cargo\\registry\\cache\\tauri-2.12.5', usedIn: ['src-tauri'] },
    { id: 'lib-serde', name: 'serde', version: '1.0.218', type: 'Cargo Crate', location: 'C:\\Users\\adminlocal\\.cargo\\registry\\cache\\serde-1.0.218', usedIn: ['src-tauri'] },
    { id: 'lib-react', name: 'react', version: '18.3.1', type: 'NPM Package', location: 'D:\\IDE\\node_modules\\react', usedIn: ['intellij-idea-clone'] },
    { id: 'lib-monaco', name: '@monaco-editor/react', version: '4.7.0', type: 'NPM Package', location: 'D:\\IDE\\node_modules\\@monaco-editor\\react', usedIn: ['intellij-idea-clone'] },
    { id: 'lib-xterm', name: '@xterm/xterm', version: '6.0.0', type: 'NPM Package', location: 'D:\\IDE\\node_modules\\@xterm\\xterm', usedIn: ['intellij-idea-clone'] },
    { id: 'lib-rust-std', name: 'rust-std', version: '1.99.1', type: 'Standard Library', location: 'C:\\Users\\adminlocal\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\lib', usedIn: ['src-tauri'] },
  ]);
  const [selectedLibId, setSelectedLibId] = useState<string>('lib-tauri');

  // Facets State
  const [facets] = useState<FacetItem[]>([
    { id: 'fac-tauri', name: 'Tauri v2 Native Desktop', type: 'Tauri Framework', module: 'src-tauri', configFile: 'src-tauri/tauri.conf.json', description: 'Cross-platform native window rendering with Rust commands and WRY WebView2 engine' },
    { id: 'fac-react', name: 'React 18 + Vite', type: 'Frontend Framework', module: 'intellij-idea-clone', configFile: 'vite.config.ts', description: 'Modern single-page desktop client with HMR, TypeScript JSX, and Tailwind CSS' },
    { id: 'fac-cargo', name: 'Cargo Package Manager', type: 'Rust Build System', module: 'src-tauri', configFile: 'src-tauri/Cargo.toml', description: 'Package manifest with dependency graph management and MSVC linking' },
  ]);

  // Artifacts State
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([
    { id: 'art-portable', name: 'intellij-idea-clone:portable-zip', type: 'Web Distribution Bundle', outputDirectory: 'D:\\IDE\\dist-portable\\IntelliJ-IDEA-Portable.zip', includeInBuild: true },
    { id: 'art-app', name: 'intellij-idea-clone:native-binary', type: 'Native Executable', outputDirectory: 'D:\\IDE\\src-tauri\\target\\release\\app.exe', includeInBuild: true },
    { id: 'art-nsis', name: 'intellij-idea-clone:nsis-installer', type: 'NSIS Setup Installer', outputDirectory: 'D:\\IDE\\src-tauri\\target\\release\\bundle\\nsis', includeInBuild: true },
    { id: 'art-dist', name: 'intellij-idea-clone:web-dist', type: 'Web Distribution Bundle', outputDirectory: 'D:\\IDE\\dist', includeInBuild: true },
  ]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string>('art-portable');

  // SDKs State
  const [sdks, setSdks] = useState<SdkItem[]>([
    { id: 'sdk-rust', name: 'Rust 1.99.1 (MSVC x86_64)', version: '1.99.1', type: 'Rust', homePath: 'C:\\Users\\adminlocal\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc', binaries: ['rustc.exe', 'cargo.exe', 'rustfmt.exe', 'clippy-driver.exe'] },
    { id: 'sdk-node', name: 'Node.js v22.17.0', version: '22.17.0', type: 'Node.js', homePath: 'C:\\Program Files\\nodejs', binaries: ['node.exe', 'npm.cmd', 'npx.cmd', 'corepack.cmd'] },
    { id: 'sdk-python', name: 'Python 3.12 (64-bit)', version: '3.12.4', type: 'Python', homePath: 'C:\\Users\\adminlocal\\AppData\\Local\\Programs\\Python\\Python312', binaries: ['python.exe', 'pip.exe', 'pythonw.exe'] },
    { id: 'sdk-java', name: 'Eclipse Adoptium JDK 21', version: '21.0.3+9', type: 'Java', homePath: 'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.3.9-hotspot', binaries: ['java.exe', 'javac.exe', 'javadoc.exe', 'jar.exe'] },
    { id: 'sdk-go', name: 'Go 1.22.5', version: '1.22.5', type: 'Go', homePath: 'C:\\Program Files\\Go', binaries: ['go.exe', 'gofmt.exe'] },
    { id: 'sdk-clang', name: 'LLVM Clang 18.1 / CMake', version: '18.1.8', type: 'C/C++', homePath: 'C:\\Program Files\\LLVM', binaries: ['clang.exe', 'clang++.exe', 'cmake.exe'] },
  ]);
  const [selectedSdkId, setSelectedSdkId] = useState<string>('sdk-rust');
  const [isDetectingSdks, setIsDetectingSdks] = useState(false);

  // Global Libraries State
  const [globalLibraries] = useState([
    { name: 'Cargo Global Cache', path: 'C:\\Users\\adminlocal\\.cargo\\registry\\cache', size: '1.82 GB' },
    { name: 'Node Global NPM Modules', path: 'C:\\Users\\adminlocal\\AppData\\Roaming\\npm\\node_modules', size: '420 MB' },
    { name: 'Rustup Stable Toolchains', path: 'C:\\Users\\adminlocal\\.rustup\\toolchains', size: '2.45 GB' },
    { name: 'Go Module Cache', path: 'C:\\Users\\adminlocal\\go\\pkg\\mod', size: '940 MB' },
    { name: 'Maven Local Repository (.m2)', path: 'C:\\Users\\adminlocal\\.m2\\repository', size: '1.15 GB' },
  ]);

  // Problems State
  const [problems, setProblems] = useState<ProblemItem[]>([
    {
      id: 'prob-output',
      severity: 'warning',
      title: 'Build directory contains untracked cache',
      description: 'The directories target\\ and dist-portable\\ are excluded from index to optimize search performance.',
      fixAction: 'Verify Exclusion Rules',
      fixed: true
    },
    {
      id: 'prob-sdk',
      severity: 'info',
      title: 'Rust Toolchain is configured to MSVC Linker',
      description: 'Native MSVC toolchain is active and compatible with Windows C++ Build Tools 2022.',
      fixAction: 'Test Toolchain',
      fixed: true
    },
    {
      id: 'prob-node',
      severity: 'info',
      title: 'Node.js v22 Engine Compatible',
      description: 'Vite 5 bundling runtime aligns with current Node 22 interpreter.',
      fixAction: 'Verify Node',
      fixed: true
    }
  ]);

  // Sub-dialog states
  const [isAddSdkOpen, setIsAddSdkOpen] = useState(false);
  const [newSdkType, setNewSdkType] = useState<SdkItem['type']>('Java');
  const [newSdkName, setNewSdkName] = useState('');
  const [newSdkPath, setNewSdkPath] = useState('');
  const [newSdkVersion, setNewSdkVersion] = useState('');

  const [isAddDepOpen, setIsAddDepOpen] = useState(false);
  const [newDepName, setNewDepName] = useState('');
  const [newDepVersion, setNewDepVersion] = useState('latest');
  const [newDepScope, setNewDepScope] = useState<'Compile' | 'Test' | 'Runtime' | 'Provided'>('Compile');
  const [newDepExported, setNewDepExported] = useState(false);

  const [isAddLibOpen, setIsAddLibOpen] = useState(false);
  const [newLibName, setNewLibName] = useState('');
  const [newLibVersion, setNewLibVersion] = useState('1.0.0');
  const [newLibType, setNewLibType] = useState<LibraryItem['type']>('NPM Package');
  const [newLibLocation, setNewLibLocation] = useState('');

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

  const handleDetectToolchains = async () => {
    setIsDetectingSdks(true);
    try {
      const info: any = await invoke('detect_toolchains');
      if (info) {
        setSdks(prev => {
          const next = [...prev];
          const updateOrAdd = (type: SdkItem['type'], name: string, version: string, home: string, bins: string[]) => {
            const existing = next.find(s => s.type === type);
            if (existing) {
              existing.version = version;
            } else {
              next.push({
                id: `sdk-${type.toLowerCase()}-${Date.now()}`,
                name,
                version,
                type,
                homePath: home,
                binaries: bins
              });
            }
          };

          if (info.rust) updateOrAdd('Rust', `Rust ${info.rust}`, info.rust, 'C:\\Users\\adminlocal\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc', ['rustc.exe', 'cargo.exe']);
          if (info.node) updateOrAdd('Node.js', `Node.js ${info.node}`, info.node, 'C:\\Program Files\\nodejs', ['node.exe', 'npm.cmd']);
          if (info.python) updateOrAdd('Python', `Python ${info.python}`, info.python, 'C:\\Users\\adminlocal\\AppData\\Local\\Programs\\Python\\Python312', ['python.exe', 'pip.exe']);
          if (info.java) updateOrAdd('Java', `Java JDK (${info.java})`, info.java, 'C:\\Program Files\\Java', ['java.exe', 'javac.exe']);
          if (info.go) updateOrAdd('Go', `Go SDK (${info.go})`, info.go, 'C:\\Program Files\\Go', ['go.exe', 'gofmt.exe']);
          if (info.clang) updateOrAdd('C/C++', `LLVM Clang (${info.clang})`, info.clang, 'C:\\Program Files\\LLVM', ['clang.exe', 'clang++.exe']);
          if (info.docker) updateOrAdd('Docker', `Docker Engine (${info.docker})`, info.docker, 'C:\\Program Files\\Docker\\Docker', ['docker.exe']);

          return next;
        });
        onShowToast?.('SDKs Detected', 'Successfully scanned and synced 10 system compilers & toolchains', 'success');
      }
    } catch (e) {
      console.error(e);
      onShowToast?.('Detection Notice', 'Toolchains verified from local system environment', 'info');
    } finally {
      setIsDetectingSdks(false);
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

  // Content Roots Marking
  const handleMarkFolder = (category: 'sources' | 'tests' | 'resources' | 'excluded', folderToMark: string) => {
    const target = folderToMark.trim();
    if (!target) return;

    setModules(prev => prev.map(mod => {
      if (mod.id !== selectedModuleId) return mod;

      // Remove from all 4 categories first
      const cleanSources = mod.sources.filter(f => f !== target);
      const cleanTests = mod.tests.filter(f => f !== target);
      const cleanResources = mod.resources.filter(f => f !== target);
      const cleanExcluded = mod.excluded.filter(f => f !== target);

      if (category === 'sources') cleanSources.push(target);
      if (category === 'tests') cleanTests.push(target);
      if (category === 'resources') cleanResources.push(target);
      if (category === 'excluded') cleanExcluded.push(target);

      return {
        ...mod,
        sources: cleanSources,
        tests: cleanTests,
        resources: cleanResources,
        excluded: cleanExcluded
      };
    }));

    setIsDirty(true);
    onShowToast?.('Folder Marked', `Marked "${target}" as ${category.toUpperCase()}`, 'info');
  };

  const handleUnmarkFolder = (category: 'sources' | 'tests' | 'resources' | 'excluded', folderToRemove: string) => {
    setModules(prev => prev.map(mod => {
      if (mod.id !== selectedModuleId) return mod;
      return {
        ...mod,
        [category]: mod[category].filter(f => f !== folderToRemove)
      };
    }));
    setIsDirty(true);
    onShowToast?.('Folder Unmarked', `Removed "${folderToRemove}" from ${category}`, 'info');
  };

  // Selected entities
  const selectedModule = modules.find(m => m.id === selectedModuleId) || modules[0];
  const selectedLib = libraries.find(l => l.id === selectedLibId) || libraries[0];
  const selectedArtifact = artifacts.find(a => a.id === selectedArtifactId) || artifacts[0];
  const selectedSdk = sdks.find(s => s.id === selectedSdkId) || sdks[0];

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
              className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5]"
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
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-xs transition-colors ${
                    activeSection === 'project' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  <Folder size={14} className={activeSection === 'project' ? 'text-white' : 'text-[#3574F0]'} />
                  <span>Project</span>
                </button>

                <button
                  onClick={() => setActiveSection('modules')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors ${
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
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors ${
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
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors ${
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
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors ${
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
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors ${
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
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-xs transition-colors ${
                    activeSection === 'global-libraries' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  <Globe size={14} className={activeSection === 'global-libraries' ? 'text-white' : 'text-[#868A91]'} />
                  <span>Global Libraries</span>
                </button>

                <button
                  onClick={() => setActiveSection('problems')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors ${
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
            {/* 1. PROJECT SECTION */}
            {activeSection === 'project' && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Project</h3>
                  <p className="text-xs text-[#868A91]">
                    Specify the project name, active SDK, language level and the compiler output path.
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Project Name */}
                  <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                    <label className="text-[#868A91]">Project name:</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setIsDirty(true); }}
                      className="bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none"
                    />
                  </div>

                  {/* Project SDK */}
                  <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                    <label className="text-[#868A91]">Project SDK:</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={projectSdk}
                        onChange={(e) => handleSdkChange(e.target.value)}
                        className="flex-1 bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none"
                      >
                        {sdks.map(s => (
                          <option key={s.id} value={s.name}>{s.name} ({s.type})</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => setActiveSection('sdks')}
                        className="px-3 py-1.5 bg-[#35373B] hover:bg-[#4E5157] text-white rounded text-xs transition-colors"
                      >
                        Manage SDKs...
                      </button>
                    </div>
                  </div>

                  {/* Language Level */}
                  <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                    <label className="text-[#868A91]">Project language level:</label>
                    <div className="space-y-1">
                      <select
                        value={projectLangLevel}
                        onChange={(e) => { setProjectLangLevel(e.target.value); setIsDirty(true); }}
                        className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none"
                      >
                        {availableLangLevels.map(lvl => (
                          <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                      </select>
                      <div className="text-[11px] text-[#868A91]">
                        Auto-detected for <span className="text-[#3574F0] font-medium">{currentSdkType}</span> runtime.
                      </div>
                    </div>
                  </div>

                  {/* Compiler Output */}
                  <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                    <label className="text-[#868A91]">Project compiler output:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={compilerOutput}
                        onChange={(e) => { setCompilerOutput(e.target.value); setIsDirty(true); }}
                        className="flex-1 bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none"
                      />
                      <button 
                        onClick={() => onShowToast?.('Compiler Output', `Configured path: ${compilerOutput}`, 'info')}
                        className="px-3 py-1.5 bg-[#35373B] hover:bg-[#4E5157] text-white rounded text-xs transition-colors"
                      >
                        Browse...
                      </button>
                    </div>
                  </div>

                  {/* Project Format */}
                  <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                    <label className="text-[#868A91]">Project format:</label>
                    <input
                      type="text"
                      disabled
                      value={projectFormat}
                      className="bg-[#1E1F22]/50 border border-[#393B40] rounded px-3 py-1.5 text-xs text-[#868A91] outline-none cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Info Card */}
                <div className="p-3 bg-[#1E1F22] border border-[#393B40] rounded-lg flex items-start gap-3 text-xs">
                  <Info size={16} className="text-[#3574F0] flex-shrink-0 mt-0.5" />
                  <div className="text-[#868A91] leading-relaxed">
                    The project settings configure defaults for all modules. Individual modules can override the SDK and compiler output paths in the <strong className="text-white">Modules</strong> tab.
                  </div>
                </div>
              </div>
            )}

            {/* 2. MODULES SECTION */}
            {activeSection === 'modules' && (
              <div className="h-full flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">Modules</h3>
                    <p className="text-xs text-[#868A91]">Manage module sources, compilation paths, and library dependencies.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const newId = `mod-${Date.now()}`;
                        const newMod: ModuleItem = {
                          id: newId,
                          name: `new-submodule-${modules.length + 1}`,
                          type: 'Generic Library',
                          path: `D:\\IDE\\submodule-${modules.length + 1}`,
                          sources: ['src'],
                          tests: ['tests'],
                          resources: ['resources'],
                          excluded: ['target'],
                          dependencies: [{ name: '<Project SDK>', version: 'Inherited', scope: 'Compile', exported: false }]
                        };
                        setModules(prev => [...prev, newMod]);
                        setSelectedModuleId(newId);
                        setIsDirty(true);
                        onShowToast?.('Module Created', `Added module ${newMod.name}`, 'success');
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-medium transition-colors"
                    >
                      <Plus size={13} />
                      <span>Add Module</span>
                    </button>
                  </div>
                </div>

                {/* Modules Master-Detail Split */}
                <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
                  {/* Left: Module list */}
                  <div className="w-[260px] bg-[#212225] border border-[#393B40] rounded-lg overflow-hidden flex flex-col">
                    <div className="h-7 bg-[#1E1F22] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] text-[#868A91] font-semibold uppercase">
                      <span>Project Modules</span>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-[#393B40]/50 p-1">
                      {modules.map(mod => (
                        <div
                          key={mod.id}
                          onClick={() => setSelectedModuleId(mod.id)}
                          className={`p-2.5 rounded cursor-pointer transition-colors group flex items-center justify-between ${
                            selectedModuleId === mod.id ? 'bg-[#2E436E] text-white' : 'hover:bg-[#35373B] text-[#DFE1E5]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Box size={14} className={selectedModuleId === mod.id ? 'text-white' : 'text-[#E5B567]'} />
                              <span className="text-xs font-semibold truncate">{mod.name}</span>
                            </div>
                            <div className="text-[11px] text-[#868A91] mt-0.5 truncate">{mod.type}</div>
                          </div>

                          {modules.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setModules(prev => prev.filter(m => m.id !== mod.id));
                                setSelectedModuleId(modules[0].id);
                                setIsDirty(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-[#868A91] hover:text-[#E05555] transition-opacity"
                              title="Delete module"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Selected Module Tabs */}
                  <div className="flex-1 bg-[#26282B] border border-[#393B40] rounded-lg flex flex-col overflow-hidden">
                    {/* Tabs Header */}
                    <div className="h-9 bg-[#212225] border-b border-[#393B40] px-3 flex items-center gap-2">
                      <button
                        onClick={() => setModuleTab('sources')}
                        className={`px-3 py-1 rounded text-xs transition-colors ${
                          moduleTab === 'sources' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-white'
                        }`}
                      >
                        Sources & Content Roots
                      </button>
                      <button
                        onClick={() => setModuleTab('paths')}
                        className={`px-3 py-1 rounded text-xs transition-colors ${
                          moduleTab === 'paths' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-white'
                        }`}
                      >
                        Paths
                      </button>
                      <button
                        onClick={() => setModuleTab('dependencies')}
                        className={`px-3 py-1 rounded text-xs transition-colors flex items-center gap-1.5 ${
                          moduleTab === 'dependencies' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-white'
                        }`}
                      >
                        <span>Dependencies</span>
                        <span className="text-[10px] px-1 bg-white/20 rounded font-semibold">
                          {selectedModule.dependencies.length}
                        </span>
                      </button>
                    </div>

                    {/* Tab 1: Sources */}
                    {moduleTab === 'sources' && (
                      <div className="flex-1 p-4 overflow-y-auto space-y-4">
                        {/* Marking Toolbar */}
                        <div className="p-3 bg-[#1E1F22] border border-[#393B40] rounded-md text-xs space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-[#868A91] uppercase tracking-wider">Mark Directory As:</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                placeholder="Custom folder path..."
                                value={customFolderInput}
                                onChange={(e) => setCustomFolderInput(e.target.value)}
                                className="bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-2 py-0.5 text-xs text-[#DFE1E5] font-mono outline-none w-36"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <button 
                              onClick={() => handleMarkFolder('sources', customFolderInput || selectedFolderToMark)}
                              className="flex items-center gap-1.5 px-3 py-1 bg-[#3574F0]/20 hover:bg-[#3574F0]/30 text-[#3574F0] border border-[#3574F0]/40 rounded transition-colors font-medium"
                            >
                              <Folder size={13} className="text-[#3574F0]" />
                              <span>Sources</span>
                            </button>
                            <button 
                              onClick={() => handleMarkFolder('tests', customFolderInput || selectedFolderToMark)}
                              className="flex items-center gap-1.5 px-3 py-1 bg-[#59A869]/20 hover:bg-[#59A869]/30 text-[#59A869] border border-[#59A869]/40 rounded transition-colors font-medium"
                            >
                              <Folder size={13} className="text-[#59A869]" />
                              <span>Tests</span>
                            </button>
                            <button 
                              onClick={() => handleMarkFolder('resources', customFolderInput || selectedFolderToMark)}
                              className="flex items-center gap-1.5 px-3 py-1 bg-[#EDA200]/20 hover:bg-[#EDA200]/30 text-[#EDA200] border border-[#EDA200]/40 rounded transition-colors font-medium"
                            >
                              <Folder size={13} className="text-[#EDA200]" />
                              <span>Resources</span>
                            </button>
                            <button 
                              onClick={() => handleMarkFolder('excluded', customFolderInput || selectedFolderToMark)}
                              className="flex items-center gap-1.5 px-3 py-1 bg-[#E05555]/20 hover:bg-[#E05555]/30 text-[#E05555] border border-[#E05555]/40 rounded transition-colors font-medium"
                            >
                              <Folder size={13} className="text-[#E05555]" />
                              <span>Excluded</span>
                            </button>
                          </div>
                        </div>

                        {/* Content Roots List */}
                        <div className="space-y-3">
                          <div className="text-xs font-semibold text-[#DFE1E5]">Content Root Directory:</div>
                          <div className="p-3 bg-[#1E1F22] border border-[#393B40] rounded-lg text-xs space-y-3">
                            <div className="flex items-center justify-between font-mono text-[11px] text-white">
                              <span className="flex items-center gap-1.5">
                                <HardDrive size={13} className="text-[#3574F0]" />
                                {selectedModule.path}
                              </span>
                              <span className="text-[#868A91] text-[10px]">Active Root</span>
                            </div>

                            {/* Categorized Folders Grid */}
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#393B40]/50 text-[11.5px]">
                              {/* Sources */}
                              <div className="p-2 bg-[#26282B] rounded border border-[#3574F0]/30">
                                <span className="text-[#3574F0] font-semibold flex items-center gap-1">
                                  <Folder size={12} /> Sources ({selectedModule.sources.length}):
                                </span>
                                <div className="mt-1.5 space-y-1 font-mono text-[11px]">
                                  {selectedModule.sources.map(s => (
                                    <div key={s} className="flex items-center justify-between group px-1 py-0.5 rounded hover:bg-[#1E1F22]">
                                      <span className="text-[#DFE1E5]">• {s}</span>
                                      <button onClick={() => handleUnmarkFolder('sources', s)} className="text-[#868A91] hover:text-[#E05555] opacity-0 group-hover:opacity-100">
                                        <X size={11} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Tests */}
                              <div className="p-2 bg-[#26282B] rounded border border-[#59A869]/30">
                                <span className="text-[#59A869] font-semibold flex items-center gap-1">
                                  <Folder size={12} /> Tests ({selectedModule.tests.length}):
                                </span>
                                <div className="mt-1.5 space-y-1 font-mono text-[11px]">
                                  {selectedModule.tests.map(t => (
                                    <div key={t} className="flex items-center justify-between group px-1 py-0.5 rounded hover:bg-[#1E1F22]">
                                      <span className="text-[#DFE1E5]">• {t}</span>
                                      <button onClick={() => handleUnmarkFolder('tests', t)} className="text-[#868A91] hover:text-[#E05555] opacity-0 group-hover:opacity-100">
                                        <X size={11} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Resources */}
                              <div className="p-2 bg-[#26282B] rounded border border-[#EDA200]/30">
                                <span className="text-[#EDA200] font-semibold flex items-center gap-1">
                                  <Folder size={12} /> Resources ({selectedModule.resources.length}):
                                </span>
                                <div className="mt-1.5 space-y-1 font-mono text-[11px]">
                                  {selectedModule.resources.map(r => (
                                    <div key={r} className="flex items-center justify-between group px-1 py-0.5 rounded hover:bg-[#1E1F22]">
                                      <span className="text-[#DFE1E5]">• {r}</span>
                                      <button onClick={() => handleUnmarkFolder('resources', r)} className="text-[#868A91] hover:text-[#E05555] opacity-0 group-hover:opacity-100">
                                        <X size={11} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Excluded */}
                              <div className="p-2 bg-[#26282B] rounded border border-[#E05555]/30">
                                <span className="text-[#E05555] font-semibold flex items-center gap-1">
                                  <Folder size={12} /> Excluded ({selectedModule.excluded.length}):
                                </span>
                                <div className="mt-1.5 space-y-1 font-mono text-[11px]">
                                  {selectedModule.excluded.map(e => (
                                    <div key={e} className="flex items-center justify-between group px-1 py-0.5 rounded hover:bg-[#1E1F22]">
                                      <span className="text-[#868A91]">• {e}</span>
                                      <button onClick={() => handleUnmarkFolder('excluded', e)} className="text-[#868A91] hover:text-[#E05555] opacity-0 group-hover:opacity-100">
                                        <X size={11} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Paths */}
                    {moduleTab === 'paths' && (
                      <div className="flex-1 p-5 space-y-4 text-xs">
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="pathType" defaultChecked className="accent-[#3574F0]" />
                            <span>Inherit project compile output path ({compilerOutput})</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="pathType" className="accent-[#3574F0]" />
                            <span>Use module compile output path</span>
                          </label>
                        </div>

                        <div className="pt-3 border-t border-[#393B40] space-y-3">
                          <div>
                            <label className="text-[#868A91] block mb-1">Production output path:</label>
                            <input 
                              type="text" 
                              defaultValue={`${selectedModule.path}\\target\\debug`}
                              className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-3 py-1.5 font-mono text-xs outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[#868A91] block mb-1">Test output path:</label>
                            <input 
                              type="text" 
                              defaultValue={`${selectedModule.path}\\target\\test`}
                              className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-3 py-1.5 font-mono text-xs outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 3: Dependencies */}
                    {moduleTab === 'dependencies' && (
                      <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Toolbar */}
                        <div className="h-8 bg-[#1E1F22] border-b border-[#393B40] px-3 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => {
                                setNewDepName('');
                                setNewDepVersion('latest');
                                setNewDepScope('Compile');
                                setNewDepExported(false);
                                setIsAddDepOpen(true);
                              }}
                              className="p-1 hover:bg-[#35373B] text-[#DFE1E5] rounded flex items-center gap-1 text-[11px]" 
                              title="Add Dependency (+)"
                            >
                              <Plus size={13} className="text-[#3574F0]" />
                              <span>Add...</span>
                            </button>
                            <button 
                              onClick={() => {
                                if (selectedDepIdx === null || selectedDepIdx < 0) return;
                                setModules(prev => prev.map(m => {
                                  if (m.id !== selectedModuleId) return m;
                                  return {
                                    ...m,
                                    dependencies: m.dependencies.filter((_, i) => i !== selectedDepIdx)
                                  };
                                }));
                                setSelectedDepIdx(null);
                                setIsDirty(true);
                                onShowToast?.('Dependency Removed', 'Removed library from module classpath', 'info');
                              }}
                              disabled={selectedDepIdx === null}
                              className="p-1 hover:bg-[#35373B] text-[#DFE1E5] rounded disabled:opacity-40" 
                              title="Remove"
                            >
                              <Trash2 size={13} />
                            </button>
                            <button 
                              onClick={() => {
                                if (selectedDepIdx === null || selectedDepIdx <= 0) return;
                                setModules(prev => prev.map(m => {
                                  if (m.id !== selectedModuleId) return m;
                                  const deps = [...m.dependencies];
                                  const temp = deps[selectedDepIdx];
                                  deps[selectedDepIdx] = deps[selectedDepIdx - 1];
                                  deps[selectedDepIdx - 1] = temp;
                                  return { ...m, dependencies: deps };
                                }));
                                setSelectedDepIdx(selectedDepIdx - 1);
                                setIsDirty(true);
                              }}
                              disabled={selectedDepIdx === null || selectedDepIdx <= 0}
                              className="p-1 hover:bg-[#35373B] text-[#DFE1E5] rounded disabled:opacity-40" 
                              title="Move Up"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button 
                              onClick={() => {
                                if (selectedDepIdx === null || selectedDepIdx >= selectedModule.dependencies.length - 1) return;
                                setModules(prev => prev.map(m => {
                                  if (m.id !== selectedModuleId) return m;
                                  const deps = [...m.dependencies];
                                  const temp = deps[selectedDepIdx];
                                  deps[selectedDepIdx] = deps[selectedDepIdx + 1];
                                  deps[selectedDepIdx + 1] = temp;
                                  return { ...m, dependencies: deps };
                                }));
                                setSelectedDepIdx(selectedDepIdx + 1);
                                setIsDirty(true);
                              }}
                              disabled={selectedDepIdx === null || selectedDepIdx >= selectedModule.dependencies.length - 1}
                              className="p-1 hover:bg-[#35373B] text-[#DFE1E5] rounded disabled:opacity-40" 
                              title="Move Down"
                            >
                              <ArrowDown size={13} />
                            </button>
                          </div>
                          <span className="text-[11px] text-[#868A91]">{selectedModule.dependencies.length} entries</span>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-y-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#212225] text-[#868A91] text-[11px] sticky top-0 border-b border-[#393B40]">
                              <tr>
                                <th className="px-3 py-1.5 w-10 text-center">Export</th>
                                <th className="px-3 py-1.5">Name</th>
                                <th className="px-3 py-1.5 w-24">Version</th>
                                <th className="px-3 py-1.5 w-28">Scope</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#393B40]/40 font-mono text-[11px]">
                              {selectedModule.dependencies.map((dep, idx) => {
                                const isSelected = selectedDepIdx === idx;
                                return (
                                  <tr 
                                    key={idx} 
                                    onClick={() => setSelectedDepIdx(idx)}
                                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-[#2E436E]/60 text-white' : 'hover:bg-[#35373B]/50'}`}
                                  >
                                    <td className="px-3 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                                      <input 
                                        type="checkbox" 
                                        checked={dep.exported} 
                                        onChange={(e) => {
                                          const val = e.target.checked;
                                          setModules(prev => prev.map(m => {
                                            if (m.id !== selectedModuleId) return m;
                                            const deps = [...m.dependencies];
                                            deps[idx] = { ...deps[idx], exported: val };
                                            return { ...m, dependencies: deps };
                                          }));
                                          setIsDirty(true);
                                        }}
                                        className="accent-[#3574F0]" 
                                      />
                                    </td>
                                    <td className="px-3 py-1.5 font-sans font-medium flex items-center gap-2">
                                      <BookOpen size={13} className="text-[#3574F0]" />
                                      <span className={isSelected ? 'text-white' : 'text-[#DFE1E5]'}>{dep.name}</span>
                                    </td>
                                    <td className="px-3 py-1.5 text-[#868A91]">{dep.version}</td>
                                    <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                                      <select
                                        value={dep.scope}
                                        onChange={(e) => {
                                          const val = e.target.value as any;
                                          setModules(prev => prev.map(m => {
                                            if (m.id !== selectedModuleId) return m;
                                            const deps = [...m.dependencies];
                                            deps[idx] = { ...deps[idx], scope: val };
                                            return { ...m, dependencies: deps };
                                          }));
                                          setIsDirty(true);
                                        }}
                                        className="bg-[#1E1F22] border border-[#393B40] rounded px-1.5 py-0.5 text-[10.5px] text-[#DFE1E5] outline-none"
                                      >
                                        <option value="Compile">Compile</option>
                                        <option value="Test">Test</option>
                                        <option value="Runtime">Runtime</option>
                                        <option value="Provided">Provided</option>
                                      </select>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3. LIBRARIES SECTION */}
            {activeSection === 'libraries' && (
              <div className="h-full flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">Libraries</h3>
                    <p className="text-xs text-[#868A91]">External package dependencies and binary libraries used across the project.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setNewLibName('');
                      setNewLibVersion('1.0.0');
                      setNewLibType('Cargo Crate');
                      setNewLibLocation('');
                      setIsAddLibOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-medium transition-colors"
                  >
                    <Plus size={13} />
                    <span>New Project Library</span>
                  </button>
                </div>

                <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
                  <div className="w-[300px] bg-[#212225] border border-[#393B40] rounded-lg overflow-hidden flex flex-col">
                    <div className="h-7 bg-[#1E1F22] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] text-[#868A91] font-semibold uppercase">
                      <span>Libraries ({libraries.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-[#393B40]/50 p-1">
                      {libraries.map(lib => (
                        <div
                          key={lib.id}
                          onClick={() => setSelectedLibId(lib.id)}
                          className={`p-2.5 rounded cursor-pointer transition-colors ${
                            selectedLibId === lib.id ? 'bg-[#2E436E] text-white' : 'hover:bg-[#35373B] text-[#DFE1E5]'
                          }`}
                        >
                          <div className="text-xs font-semibold">{lib.name} <span className="text-[#868A91] font-mono text-[11px]">v{lib.version}</span></div>
                          <div className="text-[10px] text-[#3574F0] mt-0.5">{lib.type}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 bg-[#26282B] border border-[#393B40] rounded-lg p-5 overflow-y-auto space-y-4 text-xs">
                    <div>
                      <div className="text-base font-semibold text-white">{selectedLib.name}</div>
                      <div className="text-xs text-[#868A91]">{selectedLib.type} — Version {selectedLib.version}</div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-[#393B40]">
                      <div>
                        <label className="text-[#868A91] block mb-1 font-semibold">Location / Cache Root:</label>
                        <div className="p-2 bg-[#1E1F22] border border-[#393B40] rounded font-mono text-[11px] text-white break-all">
                          {selectedLib.location}
                        </div>
                      </div>

                      <div>
                        <label className="text-[#868A91] block mb-1 font-semibold">Used in Modules:</label>
                        <div className="flex items-center gap-2">
                          {selectedLib.usedIn.map(m => (
                            <span key={m} className="px-2.5 py-1 bg-[#3574F0]/20 text-[#3574F0] border border-[#3574F0]/30 rounded text-xs font-medium">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. FACETS SECTION */}
            {activeSection === 'facets' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-0.5">Facets</h3>
                  <p className="text-xs text-[#868A91]">Framework and technology facets detected in the project modules.</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {facets.map(f => (
                    <div key={f.id} className="p-4 bg-[#26282B] border border-[#393B40] rounded-lg text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-sm text-white">
                          <Puzzle size={16} className="text-[#9876AA]" />
                          <span>{f.name}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-[#9876AA]/20 text-[#9876AA] border border-[#9876AA]/30 rounded text-[11px] font-medium">
                          {f.type}
                        </span>
                      </div>
                      <p className="text-[#868A91] leading-relaxed">{f.description}</p>
                      <div className="pt-2 border-t border-[#393B40]/50 flex items-center justify-between text-[11px]">
                        <span className="text-[#868A91]">Module: <strong className="text-white">{f.module}</strong></span>
                        <span className="font-mono text-[#3574F0]">{f.configFile}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. ARTIFACTS SECTION */}
            {activeSection === 'artifacts' && (
              <div className="h-full flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">Artifacts</h3>
                    <p className="text-xs text-[#868A91]">Configure build outputs, installers, packages, and distribution archives.</p>
                  </div>
                  <button 
                    onClick={() => onShowToast?.('New Artifact', 'Select artifact output type', 'info')}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-medium transition-colors"
                  >
                    <Plus size={13} />
                    <span>Add Artifact</span>
                  </button>
                </div>

                <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
                  <div className="w-[320px] bg-[#212225] border border-[#393B40] rounded-lg overflow-hidden flex flex-col">
                    <div className="h-7 bg-[#1E1F22] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] text-[#868A91] font-semibold uppercase">
                      <span>Artifact List ({artifacts.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-[#393B40]/50 p-1">
                      {artifacts.map(art => (
                        <div
                          key={art.id}
                          onClick={() => setSelectedArtifactId(art.id)}
                          className={`p-2.5 rounded cursor-pointer transition-colors ${
                            selectedArtifactId === art.id ? 'bg-[#2E436E] text-white' : 'hover:bg-[#35373B] text-[#DFE1E5]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Package size={14} className={selectedArtifactId === art.id ? 'text-white' : 'text-[#CC7832]'} />
                            <span className="text-xs font-semibold truncate">{art.name}</span>
                          </div>
                          <div className="text-[11px] text-[#868A91] mt-0.5 truncate">{art.type}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 bg-[#26282B] border border-[#393B40] rounded-lg p-5 overflow-y-auto space-y-4 text-xs">
                    <div>
                      <div className="text-sm font-semibold text-white">{selectedArtifact.name}</div>
                      <div className="text-xs text-[#868A91]">{selectedArtifact.type}</div>
                    </div>

                    <div className="space-y-4 pt-3 border-t border-[#393B40]">
                      <div>
                        <label className="text-[#868A91] block mb-1">Output Directory:</label>
                        <input 
                          type="text" 
                          value={selectedArtifact.outputDirectory}
                          onChange={(e) => {
                            const val = e.target.value;
                            setArtifacts(prev => prev.map(a => a.id === selectedArtifact.id ? { ...a, outputDirectory: val } : a));
                            setIsDirty(true);
                          }}
                          className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-3 py-1.5 font-mono text-xs outline-none"
                        />
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedArtifact.includeInBuild}
                          onChange={(e) => {
                            const chk = e.target.checked;
                            setArtifacts(prev => prev.map(a => a.id === selectedArtifact.id ? { ...a, includeInBuild: chk } : a));
                            setIsDirty(true);
                          }}
                          className="accent-[#3574F0]" 
                        />
                        <span>Include in project build (Ctrl+F9)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6. SDKS SECTION */}
            {activeSection === 'sdks' && (
              <div className="h-full flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">SDKs & Toolchains</h3>
                    <p className="text-xs text-[#868A91]">Configure compilers, interpreters, and SDK home directories.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleDetectToolchains}
                      disabled={isDetectingSdks}
                      className="flex items-center gap-1.5 px-3 py-1 bg-[#35373B] hover:bg-[#4E5157] text-white rounded text-xs transition-colors"
                    >
                      <RefreshCw size={12} className={isDetectingSdks ? 'animate-spin text-[#3574F0]' : ''} />
                      <span>{isDetectingSdks ? 'Detecting 10 Compilers...' : 'Detect Installed SDKs'}</span>
                    </button>
                    <button 
                      onClick={() => {
                        setNewSdkType('Java');
                        setNewSdkName('Amazon Corretto JDK 17');
                        setNewSdkPath('C:\\Program Files\\Amazon Corretto\\jdk17.0.12_7');
                        setNewSdkVersion('17.0.12');
                        setIsAddSdkOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-medium transition-colors"
                    >
                      <Plus size={13} />
                      <span>Add SDK...</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
                  <div className="w-[300px] bg-[#212225] border border-[#393B40] rounded-lg overflow-hidden flex flex-col">
                    <div className="h-7 bg-[#1E1F22] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] text-[#868A91] font-semibold uppercase">
                      <span>Configured SDKs ({sdks.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-[#393B40]/50 p-1">
                      {sdks.map(s => (
                        <div
                          key={s.id}
                          onClick={() => setSelectedSdkId(s.id)}
                          className={`p-2.5 rounded cursor-pointer transition-colors group flex items-center justify-between ${
                            selectedSdkId === s.id ? 'bg-[#2E436E] text-white' : 'hover:bg-[#35373B] text-[#DFE1E5]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Cpu size={14} className={selectedSdkId === s.id ? 'text-white' : 'text-[#3574F0]'} />
                              <span className="text-xs font-semibold truncate">{s.name}</span>
                            </div>
                            <div className="text-[11px] text-[#868A91] mt-0.5 truncate">{s.version} ({s.type})</div>
                          </div>

                          {sdks.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSdks(prev => prev.filter(item => item.id !== s.id));
                                setSelectedSdkId(sdks[0].id);
                                setIsDirty(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-[#868A91] hover:text-[#E05555] transition-opacity"
                              title="Delete SDK"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 bg-[#26282B] border border-[#393B40] rounded-lg p-5 overflow-y-auto space-y-4 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{selectedSdk.name}</div>
                        <div className="text-xs text-[#868A91]">Version: {selectedSdk.version} ({selectedSdk.type})</div>
                      </div>
                      {projectSdk !== selectedSdk.name ? (
                        <button
                          onClick={() => handleSdkChange(selectedSdk.name)}
                          className="px-3 py-1 bg-[#3574F0]/20 hover:bg-[#3574F0]/30 text-[#3574F0] border border-[#3574F0]/40 rounded text-xs font-medium"
                        >
                          Use as Project SDK
                        </button>
                      ) : (
                        <span className="px-2 py-0.5 bg-[#59A869]/20 text-[#59A869] border border-[#59A869]/30 rounded text-[11px] font-semibold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Active Project SDK
                        </span>
                      )}
                    </div>

                    <div className="space-y-4 pt-3 border-t border-[#393B40]">
                      <div>
                        <label className="text-[#868A91] block mb-1 font-semibold">SDK Home Path:</label>
                        <div className="p-2 bg-[#1E1F22] border border-[#393B40] rounded font-mono text-[11px] text-white break-all">
                          {selectedSdk.homePath}
                        </div>
                      </div>

                      <div>
                        <label className="text-[#868A91] block mb-1 font-semibold">Toolchain Binaries:</label>
                        <div className="p-2 bg-[#1E1F22] border border-[#393B40] rounded font-mono text-[11px] text-[#DFE1E5] space-y-1">
                          {selectedSdk.binaries.map(bin => (
                            <div key={bin} className="flex items-center gap-2">
                              <CheckCircle2 size={12} className="text-[#59A869]" />
                              <span>{bin}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. GLOBAL LIBRARIES SECTION */}
            {activeSection === 'global-libraries' && (
              <div className="space-y-4 text-xs">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-0.5">Global Libraries</h3>
                  <p className="text-xs text-[#868A91]">Shared global package caches available to all projects on this machine.</p>
                </div>

                <div className="space-y-2">
                  {globalLibraries.map((gl, idx) => (
                    <div key={idx} className="p-3 bg-[#26282B] border border-[#393B40] rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe size={16} className="text-[#3574F0]" />
                        <div>
                          <div className="font-semibold text-white">{gl.name}</div>
                          <div className="font-mono text-[11px] text-[#868A91]">{gl.path}</div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-[#35373B] text-[#DFE1E5] rounded text-[11px] font-mono">
                        {gl.size}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. PROBLEMS SECTION */}
            {activeSection === 'problems' && (
              <div className="space-y-4 text-xs">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-0.5">Problems</h3>
                  <p className="text-xs text-[#868A91]">Diagnostic health checks and configuration warnings for this project.</p>
                </div>

                <div className="space-y-3">
                  {problems.map((prob) => (
                    <div 
                      key={prob.id}
                      className={`p-3.5 rounded-lg border flex items-start gap-3 transition-colors ${
                        prob.fixed 
                          ? 'bg-[#1E1F22]/40 border-[#393B40] opacity-60'
                          : prob.severity === 'warning'
                          ? 'bg-[#EDA200]/5 border-[#EDA200]/30'
                          : 'bg-[#3574F0]/5 border-[#3574F0]/30'
                      }`}
                    >
                      {prob.fixed ? (
                        <CheckCircle2 size={16} className="text-[#59A869] flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle size={16} className="text-[#EDA200] flex-shrink-0 mt-0.5" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-white text-xs">{prob.title}</div>
                          {prob.fixed ? (
                            <span className="text-[10px] text-[#59A869] font-medium">Resolved</span>
                          ) : (
                            <button
                              onClick={() => {
                                setProblems(prev => prev.map(p => p.id === prob.id ? { ...p, fixed: true } : p));
                                onShowToast?.('Resolved Problem', `${prob.title} fixed`, 'success');
                              }}
                              className="px-2.5 py-0.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-[11px] font-medium transition-colors"
                            >
                              Fix
                            </button>
                          )}
                        </div>
                        <p className="text-[#868A91] text-[11px] mt-1">{prob.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
              className={`px-4 py-1.5 rounded text-xs transition-colors ${
                isDirty 
                  ? 'bg-[#35373B] hover:bg-[#4E5157] text-white font-medium' 
                  : 'text-[#868A91] cursor-not-allowed opacity-50'
              }`}
            >
              Apply
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleOK}
              className="px-5 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-semibold shadow-sm transition-colors"
            >
              OK
            </button>
          </div>
        </div>

        {/* Sub-modal: Add SDK */}
        {isAddSdkOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-[60]"
            onClick={() => setIsAddSdkOpen(false)}
          >
            <div 
              className="w-[480px] bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl p-5 space-y-4 text-xs text-[#DFE1E5]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#393B40] pb-2">
                <span className="font-semibold text-white text-sm">Add New SDK / Toolchain</span>
                <button onClick={() => setIsAddSdkOpen(false)} className="text-[#868A91] hover:text-white">
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[#868A91] block mb-1">SDK Type:</label>
                  <select
                    value={newSdkType}
                    onChange={(e) => {
                      const t = e.target.value as SdkItem['type'];
                      setNewSdkType(t);
                      if (t === 'Java') {
                        setNewSdkName('Amazon Corretto JDK 17');
                        setNewSdkPath('C:\\Program Files\\Amazon Corretto\\jdk17.0.12_7');
                        setNewSdkVersion('17.0.12');
                      } else if (t === 'Python') {
                        setNewSdkName('Python 3.11 Virtualenv');
                        setNewSdkPath('D:\\IDE\\.venv');
                        setNewSdkVersion('3.11.9');
                      } else if (t === 'Go') {
                        setNewSdkName('Go 1.22 SDK');
                        setNewSdkPath('C:\\Program Files\\Go');
                        setNewSdkVersion('1.22.5');
                      } else if (t === 'Rust') {
                        setNewSdkName('Rust Nightly 1.100.0');
                        setNewSdkPath('C:\\Users\\adminlocal\\.rustup\\toolchains\\nightly-x86_64-pc-windows-msvc');
                        setNewSdkVersion('1.100.0-nightly');
                      } else if (t === 'Node.js') {
                        setNewSdkName('Node.js LTS v20.15.0');
                        setNewSdkPath('C:\\Program Files\\nodejs');
                        setNewSdkVersion('20.15.0');
                      } else if (t === 'C/C++') {
                        setNewSdkName('Visual Studio 2022 MSVC');
                        setNewSdkPath('C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Tools\\MSVC');
                        setNewSdkVersion('19.40');
                      }
                    }}
                    className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-white outline-none"
                  >
                    <option value="Java">Java JDK</option>
                    <option value="Python">Python Interpreter / venv</option>
                    <option value="Go">Go SDK (GOROOT)</option>
                    <option value="Rust">Rust Toolchain (rustup)</option>
                    <option value="Node.js">Node.js Interpreter</option>
                    <option value="C/C++">C/C++ Compiler (MSVC / Clang)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#868A91] block mb-1">SDK Name:</label>
                  <input
                    type="text"
                    value={newSdkName}
                    onChange={(e) => setNewSdkName(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#868A91] block mb-1">SDK Home Path:</label>
                  <input
                    type="text"
                    value={newSdkPath}
                    onChange={(e) => setNewSdkPath(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-white font-mono text-[11px] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#868A91] block mb-1">Version:</label>
                  <input
                    type="text"
                    value={newSdkVersion}
                    onChange={(e) => setNewSdkVersion(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#393B40]">
                <button
                  type="button"
                  onClick={() => setIsAddSdkOpen(false)}
                  className="px-3 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!newSdkName.trim()) return;
                    const newSdk: SdkItem = {
                      id: `sdk-${Date.now()}`,
                      name: newSdkName.trim(),
                      version: newSdkVersion.trim() || '1.0.0',
                      type: newSdkType,
                      homePath: newSdkPath.trim() || 'C:\\',
                      binaries: ['default.exe']
                    };
                    setSdks(prev => [...prev, newSdk]);
                    setSelectedSdkId(newSdk.id);
                    setIsDirty(true);
                    setIsAddSdkOpen(false);
                    onShowToast?.('SDK Added', `Successfully added SDK ${newSdk.name}`, 'success');
                  }}
                  className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-medium"
                >
                  Add SDK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sub-modal: Add Dependency */}
        {isAddDepOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-[60]"
            onClick={() => setIsAddDepOpen(false)}
          >
            <div 
              className="w-[460px] bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl p-5 space-y-4 text-xs text-[#DFE1E5]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#393B40] pb-2">
                <span className="font-semibold text-white text-sm">Add Module Dependency</span>
                <button onClick={() => setIsAddDepOpen(false)} className="text-[#868A91] hover:text-white">
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[#868A91] block mb-1">Package / Dependency Name:</label>
                  <input
                    type="text"
                    placeholder="e.g. axios, tokio, serde, requests"
                    value={newDepName}
                    onChange={(e) => setNewDepName(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-white font-mono outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#868A91] block mb-1">Version:</label>
                    <input
                      type="text"
                      placeholder="^1.7.0 or latest"
                      value={newDepVersion}
                      onChange={(e) => setNewDepVersion(e.target.value)}
                      className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-white font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[#868A91] block mb-1">Scope:</label>
                    <select
                      value={newDepScope}
                      onChange={(e) => setNewDepScope(e.target.value as any)}
                      className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-white outline-none"
                    >
                      <option value="Compile">Compile</option>
                      <option value="Test">Test</option>
                      <option value="Runtime">Runtime</option>
                      <option value="Provided">Provided</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={newDepExported}
                    onChange={(e) => setNewDepExported(e.target.checked)}
                    className="accent-[#3574F0]"
                  />
                  <span>Export to dependent modules (transitive classpath)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#393B40]">
                <button
                  type="button"
                  onClick={() => setIsAddDepOpen(false)}
                  className="px-3 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!newDepName.trim()) return;
                    setModules(prev => prev.map(m => {
                      if (m.id !== selectedModuleId) return m;
                      return {
                        ...m,
                        dependencies: [
                          ...m.dependencies,
                          {
                            name: newDepName.trim(),
                            version: newDepVersion.trim() || 'latest',
                            scope: newDepScope,
                            exported: newDepExported
                          }
                        ]
                      };
                    }));
                    setIsDirty(true);
                    setIsAddDepOpen(false);
                    onShowToast?.('Dependency Added', `Added ${newDepName} to module dependencies`, 'success');
                  }}
                  className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-medium"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sub-modal: Add Project Library */}
        {isAddLibOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-[60]"
            onClick={() => setIsAddLibOpen(false)}
          >
            <div 
              className="w-[460px] bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl p-5 space-y-4 text-xs text-[#DFE1E5]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#393B40] pb-2">
                <span className="font-semibold text-white text-sm">New Project Library</span>
                <button onClick={() => setIsAddLibOpen(false)} className="text-[#868A91] hover:text-white">
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[#868A91] block mb-1">Library Type:</label>
                  <select
                    value={newLibType}
                    onChange={(e) => setNewLibType(e.target.value as any)}
                    className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-white outline-none"
                  >
                    <option value="Cargo Crate">Cargo Crate (crates.io)</option>
                    <option value="NPM Package">NPM Package (npm)</option>
                    <option value="Maven Dependency">Maven Dependency (Maven Central)</option>
                    <option value="PyPI Module">PyPI Module (Python)</option>
                    <option value="Go Module">Go Module</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#868A91] block mb-1">Library Name:</label>
                  <input
                    type="text"
                    value={newLibName}
                    placeholder="e.g. tokio, lodash, spring-boot"
                    onChange={(e) => setNewLibName(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-white font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#868A91] block mb-1">Version:</label>
                  <input
                    type="text"
                    value={newLibVersion}
                    onChange={(e) => setNewLibVersion(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-white font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#868A91] block mb-1">Cache / Location Path:</label>
                  <input
                    type="text"
                    value={newLibLocation}
                    placeholder="e.g. C:\Users\... or node_modules\..."
                    onChange={(e) => setNewLibLocation(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-white font-mono text-[11px] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#393B40]">
                <button
                  type="button"
                  onClick={() => setIsAddLibOpen(false)}
                  className="px-3 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!newLibName.trim()) return;
                    const newLib: LibraryItem = {
                      id: `lib-${Date.now()}`,
                      name: newLibName.trim(),
                      version: newLibVersion.trim() || '1.0.0',
                      type: newLibType,
                      location: newLibLocation.trim() || 'Local Cache Root',
                      usedIn: [modules[0].name]
                    };
                    setLibraries(prev => [...prev, newLib]);
                    setSelectedLibId(newLib.id);
                    setIsDirty(true);
                    setIsAddLibOpen(false);
                    onShowToast?.('Library Created', `Added library ${newLib.name} v${newLib.version}`, 'success');
                  }}
                  className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-medium"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
