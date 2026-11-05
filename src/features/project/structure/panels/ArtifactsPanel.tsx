import React from 'react';
import { Package, Plus, FolderOpen } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { ArtifactItem } from '../types';

export interface ArtifactsPanelProps {
  artifacts: ArtifactItem[];
  setArtifacts: React.Dispatch<React.SetStateAction<ArtifactItem[]>>;
  selectedArtifactId: string;
  setSelectedArtifactId: (id: string) => void;
  setIsDirty: (dirty: boolean) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ArtifactsPanel: React.FC<ArtifactsPanelProps> = ({
  artifacts,
  setArtifacts,
  selectedArtifactId,
  setSelectedArtifactId,
  setIsDirty,
  onShowToast,
}) => {
  const selectedArtifact = artifacts.find(a => a.id === selectedArtifactId) || artifacts[0];

  const handleBrowseArtifactOutputDir = async (artifactId: string, currentVal: string) => {
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const selected = await invoke<string | null>('select_directory', {
          defaultPath: currentVal || null,
        });
        if (selected) {
          setArtifacts(prev => prev.map(a => a.id === artifactId ? { ...a, outputDirectory: selected } : a));
          setIsDirty(true);
        }
      }
    } catch (e) {
      console.error('Failed to browse artifact folder:', e);
    }
  };

  return (
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

        {selectedArtifact && (
          <div className="flex-1 bg-[#26282B] border border-[#393B40] rounded-lg p-5 overflow-y-auto space-y-4 text-xs">
            <div>
              <div className="text-sm font-semibold text-white">{selectedArtifact.name}</div>
              <div className="text-xs text-[#868A91]">{selectedArtifact.type}</div>
            </div>

            <div className="space-y-4 pt-3 border-t border-[#393B40]">
              <div>
                <label className="text-[#868A91] block mb-1">Output Directory:</label>
                <div className="flex items-center gap-1.5">
                  <input 
                    type="text" 
                    value={selectedArtifact.outputDirectory}
                    onChange={(e) => {
                      const val = e.target.value;
                      setArtifacts(prev => prev.map(a => a.id === selectedArtifact.id ? { ...a, outputDirectory: val } : a));
                      setIsDirty(true);
                    }}
                    className="flex-1 bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 font-mono text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleBrowseArtifactOutputDir(selectedArtifact.id, selectedArtifact.outputDirectory)}
                    title="Select output directory"
                    className="px-2.5 py-1.5 bg-[#35373B] hover:bg-[#43454A] text-[#DFE1E5] hover:text-white border border-[#4E5157] rounded flex items-center gap-1.5 transition-colors cursor-pointer text-xs flex-shrink-0"
                  >
                    <FolderOpen size={13} className="text-[#3574F0]" />
                    <span>Browse...</span>
                  </button>
                </div>
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
        )}
      </div>
    </div>
  );
};
