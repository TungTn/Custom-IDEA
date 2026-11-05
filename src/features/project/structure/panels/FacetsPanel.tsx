import React from 'react';
import { Puzzle } from 'lucide-react';
import { FacetItem } from '../types';

export interface FacetsPanelProps {
  facets: FacetItem[];
}

export const FacetsPanel: React.FC<FacetsPanelProps> = ({ facets }) => {
  return (
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
  );
};
