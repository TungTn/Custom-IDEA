import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DownloadJdkModal, JdkItem } from './DownloadJdkModal';
import { 
  X, 
  Download,
  Plus,
  Coffee,
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  Puzzle,
  Box,
  FileCode,
  Globe,
  Terminal,
  Code2,
  Cpu,
  Layers,
  Sparkles
} from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (
    projectName: string,
    template: string,
    location: string,
    createGit: boolean,
    addSampleCode: boolean
  ) => void;
}

interface ProjectCategory {
  id: string;
  name: string;
  icon: any;
  defaultBuildSystem: string;
  defaultSdk: string;
  defaultName: string;
}

const standardProjects: ProjectCategory[] = [
  { id: 'java', name: 'Java', icon: FileCode, defaultBuildSystem: 'IntelliJ', defaultSdk: 'corretto-17 (Amazon Corretto 17.0.12)', defaultName: 'java-app' },
  { id: 'kotlin', name: 'Kotlin', icon: Code2, defaultBuildSystem: 'Gradle', defaultSdk: 'corretto-17 (Amazon Corretto 17.0.12)', defaultName: 'kotlin-app' },
  { id: 'rust', name: 'Rust', icon: Box, defaultBuildSystem: 'Cargo', defaultSdk: 'Rust 1.99.1 (MSVC x86_64)', defaultName: 'rust-project' },
  { id: 'go', name: 'Go', icon: Terminal, defaultBuildSystem: 'Go Modules', defaultSdk: 'Go 1.22.5', defaultName: 'go-project' },
  { id: 'cpp', name: 'C / C++', icon: Cpu, defaultBuildSystem: 'CMake', defaultSdk: 'Clang 18.1.8', defaultName: 'cpp-project' },
  { id: 'empty', name: 'Empty Project', icon: FolderOpen, defaultBuildSystem: 'None', defaultSdk: 'None', defaultName: 'empty-workspace' },
];

const generators: ProjectCategory[] = [
  { id: 'python', name: 'Python', icon: Code2, defaultBuildSystem: 'Virtualenv', defaultSdk: 'Python 3.12 (venv)', defaultName: 'python-app' },
  { id: 'react', name: 'React', icon: Globe, defaultBuildSystem: 'Vite', defaultSdk: 'Node.js v22.17.0', defaultName: 'react-app' },
  { id: 'vue', name: 'Vue.js', icon: Globe, defaultBuildSystem: 'Vite', defaultSdk: 'Node.js v22.17.0', defaultName: 'vue-app' },
  { id: 'node', name: 'Node.js', icon: Terminal, defaultBuildSystem: 'npm', defaultSdk: 'Node.js v22.17.0', defaultName: 'node-service' },
  { id: 'html', name: 'HTML', icon: Globe, defaultBuildSystem: 'Vite', defaultSdk: 'Node.js v22.17.0', defaultName: 'html5-boilerplate' },
];

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('java');
  const [name, setName] = useState<string>('java-app');
  const [location, setLocation] = useState<string>('D:\\IDE\\projects');
  const [createGit, setCreateGit] = useState<boolean>(true);
  const [addSampleCode, setAddSampleCode] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [moduleName, setModuleName] = useState<string>('java-app');

  // Generic build & SDK
  const [buildSystem, setBuildSystem] = useState<string>('IntelliJ');
  const [sdk, setSdk] = useState<string>('openjdk-25');
  const [isDownloadJdkOpen, setIsDownloadJdkOpen] = useState(false);
  const [isDetectingJdks, setIsDetectingJdks] = useState(false);
  const [availableJdks, setAvailableJdks] = useState<JdkItem[]>([
    { id: 'default-25', name: 'openjdk-25 (Oracle Corporation 25.0.4.1)', version: '25.0.4.1', vendor: 'Oracle Corporation', path: 'C:\\Program Files\\Java\\jdk-25.0.4.1', is_valid: true },
    { id: 'default-11', name: 'jdk-11 (Oracle Corporation 11.0.11)', version: '11.0.11', vendor: 'Oracle Corporation', path: 'C:\\Program Files\\Java\\jdk-11.0.11', is_valid: true },
    { id: 'default-17', name: 'corretto-17 (Amazon Corretto 17.0.12)', version: '17.0.12', vendor: 'Amazon Corretto', path: 'C:\\Program Files\\Amazon Corretto\\jdk17.0.12_7', is_valid: true },
  ]);

  // Load and detect JDKs from disk
  useEffect(() => {
    if (!isOpen) return;

    const detectJdks = async () => {
      try {
        setIsDetectingJdks(true);
        let customJdks: JdkItem[] = [];
        try {
          const raw = localStorage.getItem('intellij_custom_jdks');
          if (raw) customJdks = JSON.parse(raw);
        } catch (e) {}

        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          const detected = await invoke<JdkItem[]>('detect_installed_jdks');
          if (detected && detected.length > 0) {
            const map = new Map<string, JdkItem>();
            detected.forEach(j => map.set(j.path.toLowerCase(), j));
            customJdks.forEach(j => map.set(j.path.toLowerCase(), j));
            const merged = Array.from(map.values());
            setAvailableJdks(merged);
            if (merged.length > 0) {
              setSdk(merged[0].name);
            }
            return;
          }
        }

        if (customJdks.length > 0) {
          setAvailableJdks(prev => {
            const map = new Map<string, JdkItem>();
            prev.forEach(j => map.set(j.path.toLowerCase(), j));
            customJdks.forEach(j => map.set(j.path.toLowerCase(), j));
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.warn('Failed to detect installed JDKs:', err);
      } finally {
        setIsDetectingJdks(false);
      }
    };

    detectJdks();
  }, [isOpen]);

  const handleAddJdk = async () => {
    try {
      const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
      if (isTauri) {
        const selected = await invoke<string | null>('select_directory', { defaultPath: 'C:\\Program Files\\Java' });
        if (selected) {
          const parsed = await invoke<JdkItem>('validate_and_parse_jdk', { path: selected });
          if (parsed) {
            setAvailableJdks(prev => {
              const updated = [parsed, ...prev.filter(j => j.path.toLowerCase() !== parsed.path.toLowerCase())];
              try {
                localStorage.setItem('intellij_custom_jdks', JSON.stringify(updated));
              } catch (e) {}
              return updated;
            });
            setSdk(parsed.name);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to add JDK from disk:', err);
    }
  };

  const handleJdkDownloaded = (newJdk: JdkItem) => {
    setAvailableJdks(prev => {
      const updated = [newJdk, ...prev.filter(j => j.path.toLowerCase() !== newJdk.path.toLowerCase())];
      try {
        localStorage.setItem('intellij_custom_jdks', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    setSdk(newJdk.name);
  };

  // Python specific state
  const [pythonEnvType, setPythonEnvType] = useState<'Virtualenv' | 'Poetry' | 'Conda' | 'Pipenv'>('Virtualenv');
  const [pythonInterpreter, setPythonInterpreter] = useState<string>('Python 3.12 (C:\\Program Files\\Python312\\python.exe)');
  const [inheritSitePackages, setInheritSitePackages] = useState<boolean>(false);

  // Node & Web specific state
  const [packageManager, setPackageManager] = useState<'npm' | 'pnpm' | 'yarn' | 'bun'>('npm');
  const [webLanguage, setWebLanguage] = useState<'TypeScript' | 'JavaScript'>('TypeScript');
  const [styling, setStyling] = useState<'Tailwind CSS' | 'CSS Modules' | 'Plain CSS'>('Tailwind CSS');

  // Go specific state
  const [goModulePath, setGoModulePath] = useState<string>('example.com/go-project');
  const [goSdk, setGoSdk] = useState<string>('Go 1.22.5 (C:\\Program Files\\Go)');

  // C / C++ specific state
  const [cppStandard, setCppStandard] = useState<string>('c++20');
  const [cppProjectType, setCppProjectType] = useState<'Executable' | 'Static Library' | 'Shared Library'>('Executable');

  // Rust specific state
  const [rustType, setRustType] = useState<'bin' | 'lib'>('bin');

  useEffect(() => {
    if (isOpen && !location) {
      setLocation('D:\\IDE\\projects');
    }
  }, [isOpen, location]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBrowseLocation = async () => {
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    if (isTauri) {
      try {
        const selected = await invoke<string | null>('select_directory', { defaultPath: location });
        if (selected) {
          setLocation(selected);
        }
      } catch (err) {
        console.error('Failed to open native directory picker:', err);
      }
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDirectorySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      // @ts-ignore
      const fullPath = file.path || file.webkitRelativePath;
      if (fullPath) {
        const normalized = fullPath.replace(/\//g, '\\');
        const dir = normalized.substring(0, normalized.lastIndexOf('\\'));
        if (dir) {
          setLocation(dir);
          return;
        }
      }
      if (files[0].name) {
        setLocation(`D:\\IDE\\projects\\${files[0].name}`);
      }
    }
  };

  const handleSelectCategory = (cat: ProjectCategory) => {
    setSelectedCategory(cat.id);
    setName(cat.defaultName);
    setModuleName(cat.defaultName);
    setBuildSystem(cat.defaultBuildSystem);
    setSdk(cat.defaultSdk);
    if (cat.id === 'go') {
      setGoModulePath(`example.com/${cat.defaultName}`);
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    setModuleName(val);
    if (selectedCategory === 'go') {
      setGoModulePath(`example.com/${val}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreateProject(name.trim(), selectedCategory, location, createGit, addSampleCode);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[820px] h-[580px] bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="h-10 bg-[#26282B] border-b border-[#393B40] flex items-center justify-between px-3.5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#3574F0] flex items-center justify-center text-[10px] font-bold text-white">
              IJ
            </div>
            <span className="text-[12.5px] font-medium text-[#DFE1E5]">New Project</span>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Category Sidebar */}
          <div className="w-[210px] bg-[#26282B] border-r border-[#393B40] flex flex-col justify-between flex-shrink-0">
            <div className="p-2 overflow-y-auto space-y-3">
              {/* Standard New Project */}
              <div>
                <div className="text-[11px] font-semibold text-[#868A91] px-2 py-1 uppercase tracking-wider">
                  New Project
                </div>
                <div className="space-y-0.5">
                  {standardProjects.map((item) => {
                    const isSelected = selectedCategory === item.id;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectCategory(item)}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-[4px] text-[12.5px] cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-[#3574F0] text-white font-medium' 
                            : 'text-[#DFE1E5] hover:bg-[#35373B]'
                        }`}
                      >
                        <Icon size={14} className={isSelected ? 'text-white' : 'text-[#868A91]'} />
                        <span>{item.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Generators */}
              <div>
                <div className="text-[11px] font-semibold text-[#868A91] px-2 py-1 uppercase tracking-wider">
                  Generators
                </div>
                <div className="space-y-0.5">
                  {generators.map((item) => {
                    const isSelected = selectedCategory === item.id;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectCategory(item)}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-[4px] text-[12.5px] cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-[#3574F0] text-white font-medium' 
                            : 'text-[#DFE1E5] hover:bg-[#35373B]'
                        }`}
                      >
                        <Icon size={14} className={isSelected ? 'text-white' : 'text-[#868A91]'} />
                        <span>{item.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Plugins Link */}
            <div className="p-3 border-t border-[#393B40] text-[11px] text-[#3574F0] hover:underline cursor-pointer flex items-center gap-1.5">
              <Puzzle size={13} />
              <span>More plugins...</span>
            </div>
          </div>

          {/* Right Configuration Form */}
          <div className="flex-1 bg-[#2B2D30] p-6 overflow-y-auto flex flex-col justify-between text-[12px]">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: Name */}
              <div className="flex items-center">
                <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                  Name:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="flex-1 bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-[#DFE1E5] text-[12.5px] outline-none"
                  autoFocus
                />
              </div>

              {/* Row 2: Location */}
              <div>
                <div className="flex items-center">
                  <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                    Location:
                  </label>
                  <div className="flex-1 flex items-center bg-[#1E1F22] border border-[#393B40] rounded overflow-hidden">
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="flex-1 bg-transparent px-3 py-1.5 text-[#DFE1E5] text-[12px] outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleBrowseLocation}
                      className="px-2.5 py-1.5 hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] border-l border-[#393B40] transition-colors"
                      title="Browse project location"
                    >
                      <FolderOpen size={14} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      // @ts-ignore
                      webkitdirectory=""
                      // @ts-ignore
                      directory=""
                      className="hidden"
                      onChange={handleDirectorySelect}
                    />
                  </div>
                </div>
                <div className="pl-[110px] pt-1 text-[11px] text-[#868A91]">
                  Project will be created in: {location}\{name}
                </div>
              </div>

              {/* Row 3: Git checkbox */}
              <div className="pl-[110px]">
                <label className="inline-flex items-center gap-2 cursor-pointer text-[#DFE1E5]">
                  <input
                    type="checkbox"
                    checked={createGit}
                    onChange={(e) => setCreateGit(e.target.checked)}
                    className="accent-[#3574F0] w-3.5 h-3.5 rounded cursor-pointer"
                  />
                  <span>Create Git repository</span>
                </label>
              </div>

              {/* LANGUAGE-SPECIFIC CONFIGURATION SECTION */}

              {/* A. PYTHON SPECIFIC FORM */}
              {selectedCategory === 'python' && (
                <div className="space-y-4 pt-1 border-t border-[#393B40]/60">
                  {/* Environment Type */}
                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      Environment:
                    </label>
                    <div className="flex items-center border border-[#393B40] rounded overflow-hidden bg-[#1E1F22]">
                      {(['Virtualenv', 'Poetry', 'Conda', 'Pipenv'] as const).map((env, i) => (
                        <button
                          key={env}
                          type="button"
                          onClick={() => setPythonEnvType(env)}
                          className={`px-3 py-1 text-xs transition-colors ${i > 0 ? 'border-l border-[#393B40]' : ''} ${
                            pythonEnvType === env ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                          }`}
                        >
                          {env}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Base Interpreter */}
                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      Base Interpreter:
                    </label>
                    <div className="flex-1">
                      <select
                        value={pythonInterpreter}
                        onChange={(e) => setPythonInterpreter(e.target.value)}
                        className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-[#DFE1E5] text-[12px] outline-none"
                      >
                        <option value="Python 3.12 (C:\Program Files\Python312\python.exe)">Python 3.12 (C:\Program Files\Python312\python.exe)</option>
                        <option value="Python 3.11 (Virtualenv)">Python 3.11 (system)</option>
                        <option value="Python 3.10">Python 3.10 (AppData\Local\Programs\Python)</option>
                        <option value="add">Add Local Interpreter...</option>
                      </select>
                    </div>
                  </div>

                  {/* Environment Location */}
                  <div className="flex items-center">
                    <label className="w-[110px] text-[#868A91] font-normal flex-shrink-0 text-[11px]">
                      Environment location:
                    </label>
                    <div className="flex-1 text-[11px] text-[#868A91] font-mono bg-[#1E1F22]/40 px-2 py-1 rounded border border-[#393B40]/40">
                      {location}\{name}\.venv
                    </div>
                  </div>

                  {/* Inherit packages */}
                  <div className="pl-[110px] space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-[#DFE1E5]">
                      <input
                        type="checkbox"
                        checked={inheritSitePackages}
                        onChange={(e) => setInheritSitePackages(e.target.checked)}
                        className="accent-[#3574F0] w-3.5 h-3.5 rounded cursor-pointer"
                      />
                      <span>Inherit global site-packages</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-[#DFE1E5]">
                      <input
                        type="checkbox"
                        checked={addSampleCode}
                        onChange={(e) => setAddSampleCode(e.target.checked)}
                        className="accent-[#3574F0] w-3.5 h-3.5 rounded cursor-pointer"
                      />
                      <span>Create a main.py welcome script</span>
                    </label>
                  </div>
                </div>
              )}

              {/* B. JAVA / KOTLIN SPECIFIC FORM */}
              {(selectedCategory === 'java' || selectedCategory === 'kotlin') && (
                <div className="space-y-4 pt-1 border-t border-[#393B40]/60">
                  {/* Build system */}
                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      Build system:
                    </label>
                    <div className="flex items-center border border-[#393B40] rounded overflow-hidden bg-[#1E1F22]">
                      {['IntelliJ', 'Maven', 'Gradle'].map((bs, i) => (
                        <button
                          key={bs}
                          type="button"
                          onClick={() => setBuildSystem(bs)}
                          className={`px-3.5 py-1 text-xs transition-colors ${i > 0 ? 'border-l border-[#393B40]' : ''} ${
                            buildSystem === bs ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                          }`}
                        >
                          {bs}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* JDK Selection */}
                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0 flex items-center gap-1.5">
                      <Coffee size={14} className="text-[#EDA200]" />
                      <span>JDK:</span>
                    </label>
                    <div className="flex-1 flex items-center gap-1.5">
                      <select
                        value={sdk}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__download__') {
                            setIsDownloadJdkOpen(true);
                          } else if (val === '__add__') {
                            handleAddJdk();
                          } else {
                            setSdk(val);
                          }
                        }}
                        className="flex-1 bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-[#DFE1E5] text-[12px] outline-none"
                      >
                        <optgroup label="Detected & Configured JDKs">
                          {availableJdks.map(j => (
                            <option key={j.id} value={j.name}>
                              {j.name} {j.path ? `[${j.path}]` : ''}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Actions">
                          <option value="__download__">📥 Download JDK...</option>
                          <option value="__add__">📁 Add JDK from Disk...</option>
                        </optgroup>
                      </select>

                      {/* Quick Action Buttons */}
                      <button
                        type="button"
                        onClick={() => setIsDownloadJdkOpen(true)}
                        title="Download JDK from vendor (Adoptium, Corretto, Oracle)..."
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1E1F22] hover:bg-[#35373B] border border-[#393B40] text-[#DFE1E5] hover:text-white rounded text-[11.5px] transition-colors flex-shrink-0"
                      >
                        <Download size={12} className="text-[#3574F0]" />
                        <span>Download...</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAddJdk}
                        title="Browse and add JDK from computer..."
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1E1F22] hover:bg-[#35373B] border border-[#393B40] text-[#DFE1E5] hover:text-white rounded text-[11.5px] transition-colors flex-shrink-0"
                      >
                        <Plus size={12} className="text-[#59A869]" />
                        <span>Add...</span>
                      </button>
                    </div>
                  </div>

                  {/* Sample code */}
                  <div className="pl-[110px]">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-[#DFE1E5]">
                      <input
                        type="checkbox"
                        checked={addSampleCode}
                        onChange={(e) => setAddSampleCode(e.target.checked)}
                        className="accent-[#3574F0] w-3.5 h-3.5 rounded cursor-pointer"
                      />
                      <span>Add sample code</span>
                    </label>
                  </div>
                </div>
              )}

              {/* C. RUST SPECIFIC FORM */}
              {selectedCategory === 'rust' && (
                <div className="space-y-4 pt-1 border-t border-[#393B40]/60">
                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      Build system:
                    </label>
                    <div className="px-3 py-1 bg-[#1E1F22] border border-[#393B40] text-white rounded text-xs font-medium">
                      Cargo
                    </div>
                  </div>

                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      Toolchain:
                    </label>
                    <div className="flex-1">
                      <select
                        value={sdk}
                        onChange={(e) => setSdk(e.target.value)}
                        className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-[#DFE1E5] text-[12px] outline-none font-mono"
                      >
                        <option value="Rust 1.99.1 (MSVC x86_64)">Rust 1.99.1 (MSVC x86_64-pc-windows-msvc)</option>
                        <option value="Rust Beta">Rust Beta (1.100.0)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      Template:
                    </label>
                    <div className="flex items-center border border-[#393B40] rounded overflow-hidden bg-[#1E1F22]">
                      <button
                        type="button"
                        onClick={() => setRustType('bin')}
                        className={`px-3.5 py-1 text-xs transition-colors ${
                          rustType === 'bin' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                        }`}
                      >
                        Binary (Application --bin)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRustType('lib')}
                        className={`px-3.5 py-1 text-xs border-l border-[#393B40] transition-colors ${
                          rustType === 'lib' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                        }`}
                      >
                        Library (--lib)
                      </button>
                    </div>
                  </div>

                  <div className="pl-[110px]">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-[#DFE1E5]">
                      <input
                        type="checkbox"
                        checked={addSampleCode}
                        onChange={(e) => setAddSampleCode(e.target.checked)}
                        className="accent-[#3574F0] w-3.5 h-3.5 rounded cursor-pointer"
                      />
                      <span>Add sample code (main.rs)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* D. GO SPECIFIC FORM */}
              {selectedCategory === 'go' && (
                <div className="space-y-4 pt-1 border-t border-[#393B40]/60">
                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      Build system:
                    </label>
                    <div className="px-3 py-1 bg-[#1E1F22] border border-[#393B40] text-white rounded text-xs font-medium">
                      Go Modules
                    </div>
                  </div>

                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      GOROOT / SDK:
                    </label>
                    <div className="flex-1">
                      <select
                        value={goSdk}
                        onChange={(e) => setGoSdk(e.target.value)}
                        className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-[#DFE1E5] text-[12px] outline-none"
                      >
                        <option value="Go 1.22.5 (C:\Program Files\Go)">Go 1.22.5 (C:\Program Files\Go)</option>
                        <option value="Go 1.21.0">Go 1.21.0</option>
                        <option value="add">Add Go SDK...</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      Module path:
                    </label>
                    <input
                      type="text"
                      value={goModulePath}
                      onChange={(e) => setGoModulePath(e.target.value)}
                      className="flex-1 bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1 text-[#DFE1E5] text-[12px] outline-none font-mono"
                    />
                  </div>

                  <div className="pl-[110px]">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-[#DFE1E5]">
                      <input
                        type="checkbox"
                        checked={addSampleCode}
                        onChange={(e) => setAddSampleCode(e.target.checked)}
                        className="accent-[#3574F0] w-3.5 h-3.5 rounded cursor-pointer"
                      />
                      <span>Create main.go welcome file</span>
                    </label>
                  </div>
                </div>
              )}

              {/* E. C / C++ SPECIFIC FORM */}
              {selectedCategory === 'cpp' && (
                <div className="space-y-4 pt-1 border-t border-[#393B40]/60">
                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      Build system:
                    </label>
                    <div className="px-3 py-1 bg-[#1E1F22] border border-[#393B40] text-white rounded text-xs font-medium">
                      CMake
                    </div>
                  </div>

                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      C++ Standard:
                    </label>
                    <div className="flex-1">
                      <select
                        value={cppStandard}
                        onChange={(e) => setCppStandard(e.target.value)}
                        className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-[#DFE1E5] text-[12px] outline-none"
                      >
                        <option value="c++20">C++20 (ISO/IEC 14882:2020 - Recommended)</option>
                        <option value="c++23">C++23</option>
                        <option value="c++17">C++17</option>
                        <option value="c17">C17 (Pure C Standard)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      Project type:
                    </label>
                    <div className="flex items-center border border-[#393B40] rounded overflow-hidden bg-[#1E1F22]">
                      {(['Executable', 'Static Library', 'Shared Library'] as const).map((pt, i) => (
                        <button
                          key={pt}
                          type="button"
                          onClick={() => setCppProjectType(pt)}
                          className={`px-3 py-1 text-xs transition-colors ${i > 0 ? 'border-l border-[#393B40]' : ''} ${
                            cppProjectType === pt ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                          }`}
                        >
                          {pt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pl-[110px]">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-[#DFE1E5]">
                      <input
                        type="checkbox"
                        checked={addSampleCode}
                        onChange={(e) => setAddSampleCode(e.target.checked)}
                        className="accent-[#3574F0] w-3.5 h-3.5 rounded cursor-pointer"
                      />
                      <span>Generate main.cpp and CMakeLists.txt</span>
                    </label>
                  </div>
                </div>
              )}

              {/* F. NODE / REACT / VUE SPECIFIC FORM */}
              {['react', 'vue', 'node'].includes(selectedCategory) && (
                <div className="space-y-4 pt-1 border-t border-[#393B40]/60">
                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      Package manager:
                    </label>
                    <div className="flex items-center border border-[#393B40] rounded overflow-hidden bg-[#1E1F22]">
                      {(['npm', 'pnpm', 'yarn', 'bun'] as const).map((pm, i) => (
                        <button
                          key={pm}
                          type="button"
                          onClick={() => setPackageManager(pm)}
                          className={`px-3 py-1 text-xs transition-colors ${i > 0 ? 'border-l border-[#393B40]' : ''} ${
                            packageManager === pm ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                          }`}
                        >
                          {pm}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      Language:
                    </label>
                    <div className="flex items-center border border-[#393B40] rounded overflow-hidden bg-[#1E1F22]">
                      {(['TypeScript', 'JavaScript'] as const).map((lang, i) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setWebLanguage(lang)}
                          className={`px-3.5 py-1 text-xs transition-colors ${i > 0 ? 'border-l border-[#393B40]' : ''} ${
                            webLanguage === lang ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(selectedCategory === 'react' || selectedCategory === 'vue') && (
                    <div className="flex items-center">
                      <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                        Styling:
                      </label>
                      <div className="flex items-center border border-[#393B40] rounded overflow-hidden bg-[#1E1F22]">
                        {(['Tailwind CSS', 'CSS Modules', 'Plain CSS'] as const).map((st, i) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setStyling(st)}
                            className={`px-3 py-1 text-xs transition-colors ${i > 0 ? 'border-l border-[#393B40]' : ''} ${
                              styling === st ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      Node Interpreter:
                    </label>
                    <div className="flex-1">
                      <select
                        value={sdk}
                        onChange={(e) => setSdk(e.target.value)}
                        className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-[#DFE1E5] text-[12px] outline-none"
                      >
                        <option value="Node.js v22.17.0">Node.js v22.17.0 (C:\Program Files\nodejs\node.exe)</option>
                        <option value="Node.js v20.14.0">Node.js v20.14.0</option>
                      </select>
                    </div>
                  </div>

                  <div className="pl-[110px]">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-[#DFE1E5]">
                      <input
                        type="checkbox"
                        checked={addSampleCode}
                        onChange={(e) => setAddSampleCode(e.target.checked)}
                        className="accent-[#3574F0] w-3.5 h-3.5 rounded cursor-pointer"
                      />
                      <span>Generate starter template code</span>
                    </label>
                  </div>
                </div>
              )}

              {/* G. HTML SPECIFIC FORM */}
              {selectedCategory === 'html' && (
                <div className="space-y-4 pt-1 border-t border-[#393B40]/60">
                  <div className="flex items-center">
                    <label className="w-[110px] text-[#DFE1E5] font-normal flex-shrink-0">
                      CSS Framework:
                    </label>
                    <div className="flex items-center border border-[#393B40] rounded overflow-hidden bg-[#1E1F22]">
                      <button
                        type="button"
                        onClick={() => setStyling('Tailwind CSS')}
                        className={`px-3 py-1 text-xs transition-colors ${
                          styling === 'Tailwind CSS' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                        }`}
                      >
                        Tailwind CSS
                      </button>
                      <button
                        type="button"
                        onClick={() => setStyling('Plain CSS')}
                        className={`px-3 py-1 text-xs border-l border-[#393B40] transition-colors ${
                          styling === 'Plain CSS' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                        }`}
                      >
                        Standard CSS
                      </button>
                    </div>
                  </div>

                  <div className="pl-[110px]">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-[#DFE1E5]">
                      <input
                        type="checkbox"
                        checked={addSampleCode}
                        onChange={(e) => setAddSampleCode(e.target.checked)}
                        className="accent-[#3574F0] w-3.5 h-3.5 rounded cursor-pointer"
                      />
                      <span>Generate index.html, style.css, script.js</span>
                    </label>
                  </div>
                </div>
              )}

              {/* H. EMPTY WORKSPACE */}
              {selectedCategory === 'empty' && (
                <div className="p-4 bg-[#1E1F22]/50 border border-[#393B40] rounded text-xs text-[#868A91] leading-relaxed">
                  Creates an empty workspace directory at the specified location without pre-configured SDKs or template files. You can configure libraries and SDKs later in <span className="text-[#DFE1E5] font-medium">Project Structure (Ctrl+Alt+Shift+S)</span>.
                </div>
              )}

              {/* Advanced Settings (Collapsible) */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(prev => !prev)}
                  className="flex items-center gap-1.5 text-[11.5px] text-[#DFE1E5] hover:text-white"
                >
                  {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="font-medium">Advanced Settings</span>
                </button>

                {showAdvanced && (
                  <div className="pl-5 pt-3 space-y-3 border-l border-[#393B40] ml-1.5 mt-1.5">
                    <div className="flex items-center">
                      <label className="w-[100px] text-[#868A91] text-[11px]">Module name:</label>
                      <input
                        type="text"
                        value={moduleName}
                        onChange={(e) => setModuleName(e.target.value)}
                        className="flex-1 bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-xs text-[#DFE1E5] outline-none"
                      />
                    </div>
                    <div className="flex items-center">
                      <label className="w-[100px] text-[#868A91] text-[11px]">Content root:</label>
                      <input
                        type="text"
                        value={`${location}\\${name}`}
                        readOnly
                        className="flex-1 bg-[#1E1F22]/70 border border-[#393B40] rounded px-2.5 py-1 text-xs text-[#868A91] outline-none cursor-default font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </form>

            {/* Bottom Buttons (IntelliJ order: Create, Cancel) */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#393B40]">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!name.trim()}
                className="px-5 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-40 text-white rounded-[4px] text-xs font-medium shadow-sm transition-colors"
              >
                Create
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-[4px] text-xs text-[#DFE1E5] hover:bg-[#35373B] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
        {/* Download JDK Dialog */}
        <DownloadJdkModal
          isOpen={isDownloadJdkOpen}
          onClose={() => setIsDownloadJdkOpen(false)}
          onDownloaded={handleJdkDownloaded}
        />
      </div>
    </div>
  );
};

export default NewProjectModal;
