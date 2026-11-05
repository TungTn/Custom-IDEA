import React from 'react';
import { SettingPanelProps } from './types';

export const AdvancedSettingsPanel: React.FC<SettingPanelProps> = ({
  formSettings,
  updateSetting,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Advanced Settings</h2>
        <p className="text-xs text-[#868A91]">Fine-tune low-level IDE mechanics, memory buffers, and experimental features.</p>
      </div>

      <div className="space-y-6 max-w-xl text-xs">
        {/* Editor Group */}
        <div className="space-y-3">
          <h3 className="font-semibold text-white border-b border-[#393B40] pb-1.5 text-xs">Editor</h3>
          <div className="space-y-2.5 pl-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span>Show inline intention bulb suggestions</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span>Enable parameter name hints in function calls</span>
            </label>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[#DFE1E5]">Recent files limit:</span>
              <input 
                type="number" 
                value={formSettings.recentFilesLimit || 50} 
                onChange={(e) => updateSetting('recentFilesLimit', Number(e.target.value))}
                className="w-24 bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none" 
              />
            </div>
          </div>
        </div>

        {/* Terminal Group */}
        <div className="space-y-3">
          <h3 className="font-semibold text-white border-b border-[#393B40] pb-1.5 text-xs">Terminal</h3>
          <div className="space-y-2.5 pl-1">
            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">Buffer scrollback lines:</span>
              <input 
                type="number" 
                value={formSettings.terminalScrollback || 10000} 
                onChange={(e) => updateSetting('terminalScrollback', Number(e.target.value))}
                className="w-24 bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none" 
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span>Use ConPTY terminal engine on Windows</span>
            </label>
          </div>
        </div>

        {/* Search Everywhere Group */}
        <div className="space-y-3">
          <h3 className="font-semibold text-white border-b border-[#393B40] pb-1.5 text-xs">Search Everywhere</h3>
          <div className="space-y-2.5 pl-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span>Show recently opened files first in search results</span>
            </label>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[#DFE1E5]">Double Shift activation timeout (ms):</span>
              <input 
                type="number" 
                value={formSettings.doubleShiftTimeout || 350} 
                onChange={(e) => updateSetting('doubleShiftTimeout', Number(e.target.value))}
                className="w-24 bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none" 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
