import React from 'react';
import { Info } from 'lucide-react';
import { SdkItem } from '../types';

export interface ProjectSettingsPanelProps {
  name: string;
  setName: (name: string) => void;
  projectSdk: string;
  handleSdkChange: (sdk: string) => void;
  projectLangLevel: string;
  setProjectLangLevel: (lvl: string) => void;
  compilerOutput: string;
  setCompilerOutput: (out: string) => void;
  projectFormat: string;
  sdks: SdkItem[];
  availableLangLevels: string[];
  currentSdkType: string;
  setIsDirty: (dirty: boolean) => void;
  onNavigateToSdks: () => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ProjectSettingsPanel: React.FC<ProjectSettingsPanelProps> = ({
  name,
  setName,
  projectSdk,
  handleSdkChange,
  projectLangLevel,
  setProjectLangLevel,
  compilerOutput,
  setCompilerOutput,
  projectFormat,
  sdks,
  availableLangLevels,
  currentSdkType,
  setIsDirty,
  onNavigateToSdks,
  onShowToast,
}) => {
  return (
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
              onClick={onNavigateToSdks}
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
  );
};
