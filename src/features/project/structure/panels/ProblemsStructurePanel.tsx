import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ProblemItem } from '../types';

export interface ProblemsStructurePanelProps {
  problems: ProblemItem[];
  setProblems: React.Dispatch<React.SetStateAction<ProblemItem[]>>;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ProblemsStructurePanel: React.FC<ProblemsStructurePanelProps> = ({
  problems,
  setProblems,
  onShowToast,
}) => {
  return (
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
                    className="px-2.5 py-0.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
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
  );
};
