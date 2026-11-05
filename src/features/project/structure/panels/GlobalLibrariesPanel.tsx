import React from 'react';
import { Globe } from 'lucide-react';
import { GlobalLibraryItem } from '../types';

export interface GlobalLibrariesPanelProps {
  globalLibraries: GlobalLibraryItem[];
}

export const GlobalLibrariesPanel: React.FC<GlobalLibrariesPanelProps> = ({
  globalLibraries,
}) => {
  return (
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
  );
};
