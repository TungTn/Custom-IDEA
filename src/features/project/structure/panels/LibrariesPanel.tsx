import React, { useState } from 'react';
import { Plus, X, FolderOpen } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { LibraryItem, ModuleItem } from '../types';

export interface LibrariesPanelProps {
  libraries: LibraryItem[];
  setLibraries: React.Dispatch<React.SetStateAction<LibraryItem[]>>;
  selectedLibId: string;
  setSelectedLibId: (id: string) => void;
  modules: ModuleItem[];
  setIsDirty: (dirty: boolean) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const LibrariesPanel: React.FC<LibrariesPanelProps> = ({
  libraries,
  setLibraries,
  selectedLibId,
  setSelectedLibId,
  modules,
  setIsDirty,
  onShowToast,
}) => {
  const [isAddLibOpen, setIsAddLibOpen] = useState(false);
  const [newLibName, setNewLibName] = useState('');
  const [newLibVersion, setNewLibVersion] = useState('1.0.0');
  const [newLibType, setNewLibType] = useState<LibraryItem['type']>('NPM Package');
  const [newLibLocation, setNewLibLocation] = useState('');

  const selectedLib = libraries.find(l => l.id === selectedLibId) || libraries[0];

  const handleBrowseLibLocation = async () => {
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const selected = await invoke<string | null>('select_directory', {
          defaultPath: newLibLocation || null,
        });
        if (selected) {
          setNewLibLocation(selected);
        }
      } else {
        onShowToast?.('Browse Directory', 'Native directory browser is active in desktop app.', 'info');
      }
    } catch (e) {
      console.error('Failed to browse library folder:', e);
      onShowToast?.('Folder Selection Error', String(e), 'error');
    }
  };

  return (
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

        {selectedLib && (
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
        )}
      </div>

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
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newLibLocation}
                    placeholder="e.g. C:\Users\... or node_modules\..."
                    onChange={(e) => setNewLibLocation(e.target.value)}
                    className="flex-1 bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-white font-mono text-[11px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseLibLocation}
                    title="Select library cache directory"
                    className="px-2.5 py-1.5 bg-[#35373B] hover:bg-[#43454A] text-[#DFE1E5] hover:text-white border border-[#4E5157] rounded flex items-center gap-1.5 transition-colors cursor-pointer text-xs flex-shrink-0"
                  >
                    <FolderOpen size={13} className="text-[#3574F0]" />
                    <span>Browse...</span>
                  </button>
                </div>
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
  );
};
