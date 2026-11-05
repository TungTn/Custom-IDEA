import React, { useState } from 'react';
import { 
  Box, 
  Folder, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  HardDrive, 
  BookOpen, 
  X 
} from 'lucide-react';
import { ModuleItem } from '../types';

export interface ModulesPanelProps {
  modules: ModuleItem[];
  setModules: React.Dispatch<React.SetStateAction<ModuleItem[]>>;
  selectedModuleId: string;
  setSelectedModuleId: (id: string) => void;
  compilerOutput: string;
  setIsDirty: (dirty: boolean) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ModulesPanel: React.FC<ModulesPanelProps> = ({
  modules,
  setModules,
  selectedModuleId,
  setSelectedModuleId,
  compilerOutput,
  setIsDirty,
  onShowToast,
}) => {
  const [moduleTab, setModuleTab] = useState<'sources' | 'paths' | 'dependencies'>('sources');
  const [selectedFolderToMark] = useState<string>('src');
  const [customFolderInput, setCustomFolderInput] = useState<string>('');
  const [selectedDepIdx, setSelectedDepIdx] = useState<number | null>(0);

  // Sub-modal state for Add Dependency
  const [isAddDepOpen, setIsAddDepOpen] = useState(false);
  const [newDepName, setNewDepName] = useState('');
  const [newDepVersion, setNewDepVersion] = useState('latest');
  const [newDepScope, setNewDepScope] = useState<'Compile' | 'Test' | 'Runtime' | 'Provided'>('Compile');
  const [newDepExported, setNewDepExported] = useState(false);

  const selectedModule = modules.find(m => m.id === selectedModuleId) || modules[0];

  const handleMarkFolder = (category: 'sources' | 'tests' | 'resources' | 'excluded', folderToMark: string) => {
    const target = folderToMark.trim();
    if (!target) return;

    setModules(prev => prev.map(mod => {
      if (mod.id !== selectedModuleId) return mod;

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

  return (
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
        {selectedModule && (
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
        )}
      </div>

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
    </div>
  );
};
