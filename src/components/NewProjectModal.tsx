import React, { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  X, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Settings, 
  Puzzle,
  Box,
  FileCode,
  Globe,
  Terminal,
  Code2
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
  { id: 'java', name: 'Java', icon: FileCode, defaultBuildSystem: 'IntelliJ', defaultSdk: 'corretto-17 (Amazon Corretto 17.0.12)', defaultName: 'Untitled' },
  { id: 'kotlin', name: 'Kotlin', icon: Code2, defaultBuildSystem: 'IntelliJ', defaultSdk: 'corretto-17 (Amazon Corretto 17.0.12)', defaultName: 'kotlin-app' },
  { id: 'rust', name: 'Rust', icon: Box, defaultBuildSystem: 'Cargo', defaultSdk: 'Rust 1.99.1 (MSVC x86_64)', defaultName: 'rust-project' },
  { id: 'empty', name: 'Empty Project', icon: FolderOpen, defaultBuildSystem: 'None', defaultSdk: 'None', defaultName: 'empty-workspace' },
];

const generators: ProjectCategory[] = [
  { id: 'html', name: 'HTML', icon: Globe, defaultBuildSystem: 'Vite', defaultSdk: 'Node.js v22.17.0', defaultName: 'html5-boilerplate' },
  { id: 'react', name: 'React', icon: Globe, defaultBuildSystem: 'Vite', defaultSdk: 'Node.js v22.17.0', defaultName: 'react-app' },
  { id: 'node', name: 'Node.js', icon: Terminal, defaultBuildSystem: 'npm', defaultSdk: 'Node.js v22.17.0', defaultName: 'node-service' },
  { id: 'vue', name: 'Vue.js', icon: Globe, defaultBuildSystem: 'Vite', defaultSdk: 'Node.js v22.17.0', defaultName: 'vue-app' },
  { id: 'python', name: 'Python', icon: Code2, defaultBuildSystem: 'pip', defaultSdk: 'Python 3.11', defaultName: 'python-app' },
];

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('java');
  const [name, setName] = useState<string>('Untitled');
  const [location, setLocation] = useState<string>('D:\\IDE\\projects');
  const [createGit, setCreateGit] = useState<boolean>(true);
  const [buildSystem, setBuildSystem] = useState<string>('IntelliJ');
  const [sdk, setSdk] = useState<string>('corretto-17 (Amazon Corretto 17.0.12)');
  const [addSampleCode, setAddSampleCode] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [moduleName, setModuleName] = useState<string>('Untitled');

  React.useEffect(() => {
    if (isOpen && !location) {
      setLocation('D:\\IDE\\projects');
    }
  }, [isOpen, location]);

  const currentCategoryObj = 
    standardProjects.find(p => p.id === selectedCategory) || 
    generators.find(g => g.id === selectedCategory) || 
    standardProjects[0];

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
      return; // Always return in Tauri desktop app, never fall through to web input
    }

    // Web fallback only when running in a pure web browser
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
  };

  const handleNameChange = (val: string) => {
    setName(val);
    setModuleName(val);
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
        className="w-[780px] h-[550px] bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="h-10 bg-[#26282B] border-b border-[#393B40] flex items-center justify-between px-3.5">
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
          <div className="w-[200px] bg-[#26282B] border-r border-[#393B40] flex flex-col justify-between">
            <div className="p-2 overflow-y-auto space-y-3">
              {/* Standard New Project */}
              <div>
                <div className="text-[11px] font-semibold text-[#868A91] px-2 py-1">
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
                <div className="text-[11px] font-semibold text-[#868A91] px-2 py-1">
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
          <div className="flex-1 bg-[#2B2D30] p-6 overflow-y-auto flex flex-col justify-between">
            <form onSubmit={handleSubmit} className="space-y-4 text-[12px]">
              {/* Row 1: Name */}
              <div className="flex items-center">
                <label className="w-[100px] text-[#DFE1E5] font-normal flex-shrink-0">
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
                  <label className="w-[100px] text-[#DFE1E5] font-normal flex-shrink-0">
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
                <div className="pl-[100px] pt-1 text-[11px] text-[#868A91]">
                  Project will be created in: {location}\{name}
                </div>
              </div>

              {/* Row 3: Git checkbox */}
              <div className="pl-[100px] pt-0.5">
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

              {/* Row 4: Build system */}
              <div className="flex items-center pt-1">
                <label className="w-[100px] text-[#DFE1E5] font-normal flex-shrink-0">
                  Build system:
                </label>
                <div className="flex items-center border border-[#393B40] rounded overflow-hidden bg-[#1E1F22]">
                  {selectedCategory === 'rust' ? (
                    <button
                      type="button"
                      className="px-3.5 py-1 text-xs bg-[#3574F0] text-white font-medium"
                    >
                      Cargo
                    </button>
                  ) : ['react', 'vue', 'html'].includes(selectedCategory) ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setBuildSystem('Vite')}
                        className={`px-3.5 py-1 text-xs transition-colors ${
                          buildSystem === 'Vite' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                        }`}
                      >
                        Vite
                      </button>
                      <button
                        type="button"
                        onClick={() => setBuildSystem('npm')}
                        className={`px-3.5 py-1 text-xs border-l border-[#393B40] transition-colors ${
                          buildSystem === 'npm' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                        }`}
                      >
                        npm
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setBuildSystem('IntelliJ')}
                        className={`px-3.5 py-1 text-xs transition-colors ${
                          buildSystem === 'IntelliJ' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                        }`}
                      >
                        IntelliJ
                      </button>
                      <button
                        type="button"
                        onClick={() => setBuildSystem('Gradle')}
                        className={`px-3.5 py-1 text-xs border-l border-[#393B40] transition-colors ${
                          buildSystem === 'Gradle' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'
                        }`}
                      >
                        Gradle
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Row 5: JDK / SDK */}
              <div className="flex items-center pt-1">
                <label className="w-[100px] text-[#DFE1E5] font-normal flex-shrink-0">
                  {selectedCategory === 'rust' ? 'Toolchain:' : selectedCategory === 'java' || selectedCategory === 'kotlin' ? 'JDK:' : 'SDK:'}
                </label>
                <div className="flex-1">
                  <select
                    value={sdk}
                    onChange={(e) => setSdk(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-[#DFE1E5] text-[12px] outline-none"
                  >
                    {selectedCategory === 'rust' ? (
                      <>
                        <option value="Rust 1.99.1 (MSVC x86_64)">Rust 1.99.1 (MSVC x86_64-pc-windows-msvc)</option>
                        <option value="Rust Beta">Rust Beta (1.100.0)</option>
                      </>
                    ) : ['react', 'node', 'vue', 'html'].includes(selectedCategory) ? (
                      <>
                        <option value="Node.js v22.17.0">Node.js v22.17.0 (C:\Program Files\nodejs)</option>
                        <option value="Node.js v20.14.0">Node.js v20.14.0</option>
                      </>
                    ) : (
                      <>
                        <option value="corretto-17 (Amazon Corretto 17.0.12)">corretto-17 Amazon Corretto 17.0.12</option>
                        <option value="openjdk-21">openjdk-21 Oracle OpenJDK 21.0.2</option>
                        <option value="download">Download JDK...</option>
                        <option value="add">Add JDK...</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Row 6: Sample code checkbox */}
              <div className="pl-[100px] pt-1">
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

              {/* Row 7: Advanced Settings (Collapsible) */}
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
                      <label className="w-[90px] text-[#868A91] text-[11px]">Module name:</label>
                      <input
                        type="text"
                        value={moduleName}
                        onChange={(e) => setModuleName(e.target.value)}
                        className="flex-1 bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-xs text-[#DFE1E5] outline-none"
                      />
                    </div>
                    <div className="flex items-center">
                      <label className="w-[90px] text-[#868A91] text-[11px]">Content root:</label>
                      <input
                        type="text"
                        value={`${location}\\${name}`}
                        readOnly
                        className="flex-1 bg-[#1E1F22]/70 border border-[#393B40] rounded px-2.5 py-1 text-xs text-[#868A91] outline-none cursor-default"
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
      </div>
    </div>
  );
};
