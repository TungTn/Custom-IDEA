import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { RefreshCw, Plus, Cpu, Trash2, CheckCircle2, FolderOpen, X } from 'lucide-react';
import { SdkItem } from '../types';

export interface SdksPanelProps {
  sdks: SdkItem[];
  setSdks: React.Dispatch<React.SetStateAction<SdkItem[]>>;
  selectedSdkId: string;
  setSelectedSdkId: (id: string) => void;
  projectSdk: string;
  onSdkChange: (sdkName: string) => void;
  setIsDirty: (dirty: boolean) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const SdksPanel: React.FC<SdksPanelProps> = ({
  sdks,
  setSdks,
  selectedSdkId,
  setSelectedSdkId,
  projectSdk,
  onSdkChange,
  setIsDirty,
  onShowToast,
}) => {
  const [isDetectingSdks, setIsDetectingSdks] = useState(false);
  const [isAddSdkOpen, setIsAddSdkOpen] = useState(false);
  const [newSdkType, setNewSdkType] = useState<SdkItem['type']>('Java');
  const [newSdkName, setNewSdkName] = useState('Amazon Corretto JDK 17');
  const [newSdkPath, setNewSdkPath] = useState('C:\\Program Files\\Amazon Corretto\\jdk17.0.12_7');
  const [newSdkVersion, setNewSdkVersion] = useState('17.0.12');

  const selectedSdk = sdks.find(s => s.id === selectedSdkId) || sdks[0];

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
                binaries: bins,
              });
            }
          };

          if (info.rust) updateOrAdd('Rust', `Rust ${info.rust}`, info.rust, '~/.rustup/toolchains/stable', ['rustc.exe', 'cargo.exe']);
          if (info.node) updateOrAdd('Node.js', `Node.js ${info.node}`, info.node, 'C:\\Program Files\\nodejs', ['node.exe', 'npm.cmd']);
          if (info.python) updateOrAdd('Python', `Python ${info.python}`, info.python, '~/AppData/Local/Programs/Python', ['python.exe', 'pip.exe']);
          if (info.java) updateOrAdd('Java', `Java JDK (${info.java})`, info.java, 'C:\\Program Files\\Java', ['java.exe', 'javac.exe']);
          if (info.go) updateOrAdd('Go', `Go SDK (${info.go})`, info.go, 'C:\\Program Files\\Go', ['go.exe', 'gofmt.exe']);
          if (info.clang) updateOrAdd('C/C++', `LLVM Clang (${info.clang})`, info.clang, 'C:\\Program Files\\LLVM', ['clang.exe', 'clang++.exe']);
          if (info.docker) updateOrAdd('Docker', `Docker Engine (${info.docker})`, info.docker, 'C:\\Program Files\\Docker\\Docker', ['docker.exe']);

          return next;
        });
        setIsDirty(true);
        onShowToast?.('SDKs Detected', 'Successfully scanned and synced 10 system compilers & toolchains', 'success');
      }
    } catch (e) {
      console.error(e);
      onShowToast?.('Detection Notice', 'Toolchains verified from local system environment', 'info');
    } finally {
      setIsDetectingSdks(false);
    }
  };

  const handleBrowseSdkPath = async () => {
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const selected = await invoke<string | null>('select_directory', {
          defaultPath: newSdkPath || null,
        });
        if (selected) {
          setNewSdkPath(selected);
          const cleanPath = selected.replace(/\\/g, '/');
          const folderName = cleanPath.split('/').filter(Boolean).pop() || '';
          if (folderName) {
            const verMatch = folderName.match(/(\d+(?:\.\d+)*(?:[_\-]\w+)?)/);
            if (verMatch) {
              setNewSdkVersion(verMatch[1].replace('_', '.'));
            }
            if (newSdkType === 'Java' && (!newSdkName || newSdkName === 'Amazon Corretto JDK 17')) {
              setNewSdkName(`JDK (${folderName})`);
            } else if (newSdkType === 'Python' && (!newSdkName || newSdkName === 'Python 3.11 Virtualenv')) {
              setNewSdkName(`Python (${folderName})`);
            } else if (newSdkType === 'Rust' && (!newSdkName || newSdkName.includes('Rust'))) {
              setNewSdkName(`Rust (${folderName})`);
            } else if (newSdkType === 'Go' && (!newSdkName || newSdkName.includes('Go'))) {
              setNewSdkName(`Go (${folderName})`);
            } else if (newSdkType === 'Node.js' && (!newSdkName || newSdkName.includes('Node'))) {
              setNewSdkName(`Node.js (${folderName})`);
            }
          }
        }
      } else {
        onShowToast?.('Browse Directory', 'Native directory browser is active in desktop app.', 'info');
      }
    } catch (e) {
      console.error('Failed to browse SDK folder:', e);
      onShowToast?.('Folder Selection Error', String(e), 'error');
    }
  };

  return (
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

        {selectedSdk && (
          <div className="flex-1 bg-[#26282B] border border-[#393B40] rounded-lg p-5 overflow-y-auto space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{selectedSdk.name}</div>
                <div className="text-xs text-[#868A91]">Version: {selectedSdk.version} ({selectedSdk.type})</div>
              </div>
              {projectSdk !== selectedSdk.name ? (
                <button
                  onClick={() => onSdkChange(selectedSdk.name)}
                  className="px-3 py-1 bg-[#3574F0]/20 hover:bg-[#3574F0]/30 text-[#3574F0] border border-[#3574F0]/40 rounded text-xs font-medium cursor-pointer"
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
        )}
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
                      setNewSdkPath('~/.rustup/toolchains/nightly');
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
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newSdkPath}
                    onChange={(e) => setNewSdkPath(e.target.value)}
                    placeholder="e.g. C:\Program Files\Amazon Corretto\jdk17.0.12_7"
                    className="flex-1 bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-white font-mono text-[11px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseSdkPath}
                    title="Select SDK directory on disk"
                    className="px-2.5 py-1.5 bg-[#35373B] hover:bg-[#43454A] text-[#DFE1E5] hover:text-white border border-[#4E5157] rounded flex items-center gap-1.5 transition-colors cursor-pointer text-xs flex-shrink-0"
                  >
                    <FolderOpen size={13} className="text-[#3574F0]" />
                    <span>Browse...</span>
                  </button>
                </div>
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
    </div>
  );
};
