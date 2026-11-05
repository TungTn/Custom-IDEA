import React, { useState } from 'react';
import { Search, X, AlertTriangle } from 'lucide-react';
import { SettingPanelProps } from './types';
import { getKeymapsForProfile } from '../SettingsModal';

export const KeymapPanel: React.FC<SettingPanelProps> = ({
  setIsDirty,
  onShowToast,
  keymaps = [],
  setKeymaps,
  keymapProfile = 'windows',
  setKeymapProfile,
}) => {
  const [keymapSearch, setKeymapSearch] = useState('');
  const [recordingKeymapIdx, setRecordingKeymapIdx] = useState<number | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<string>('');
  const [keymapConflict, setKeymapConflict] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[#393B40] pb-3">
        <div>
          <h2 className="text-base font-semibold text-white">Keymap</h2>
          <p className="text-xs text-[#868A91]">Customize shortcuts with interactive keyboard recorder and profile switcher.</p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={keymapProfile}
            onChange={(e) => {
              const val = e.target.value as any;
              setKeymapProfile?.(val);
              setKeymaps?.(getKeymapsForProfile(val));
              setIsDirty(true);
              onShowToast?.('Keymap Profile', `Switched to ${val.toUpperCase()} keymap scheme`, 'info');
            }}
            className="bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-xs text-[#DFE1E5] outline-none"
          >
            <option value="windows">Windows / Linux (Default)</option>
            <option value="netbeans">NetBeans Scheme (Alt+Shift+F)</option>
            <option value="macos">macOS (Cmd / Option)</option>
            <option value="vscode">VS Code Compatible</option>
            <option value="eclipse">Eclipse Scheme</option>
          </select>
          <div className="flex items-center gap-1.5 bg-[#2B2D30] border border-[#393B40] rounded px-2 py-1">
            <Search size={12} className="text-[#868A91]" />
            <input
              type="text"
              placeholder="Search action or key..."
              value={keymapSearch}
              onChange={(e) => setKeymapSearch(e.target.value)}
              className="bg-transparent text-xs text-[#DFE1E5] outline-none w-40"
            />
          </div>
        </div>
      </div>

      <div className="border border-[#393B40] rounded-lg overflow-hidden bg-[#26282B]">
        <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
          <span>Action Name</span>
          <span>Assigned Shortcut (Click to Record)</span>
        </div>
        <div className="max-h-[380px] overflow-y-auto divide-y divide-[#393B40]/50 text-xs">
          {keymaps
            .filter(k => 
              !keymapSearch || 
              k.action.toLowerCase().includes(keymapSearch.toLowerCase()) || 
              k.shortcut.toLowerCase().includes(keymapSearch.toLowerCase())
            )
            .map((k, idx) => (
              <div 
                key={idx} 
                onClick={() => {
                  setRecordingKeymapIdx(idx);
                  setRecordedKeys(k.shortcut);
                  setKeymapConflict(null);
                }}
                className="flex items-center justify-between px-3 py-2 hover:bg-[#35373B] transition-colors cursor-pointer group"
              >
                <div>
                  <div className="text-[#DFE1E5] font-normal group-hover:text-white transition-colors">{k.action}</div>
                  <div className="text-[10px] text-[#868A91]">{k.category}</div>
                </div>

                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-0.5 rounded bg-[#1E1F22] border border-[#393B40] font-mono text-[#3574F0] text-[11px] font-semibold group-hover:border-[#3574F0] transition-colors">
                    {k.shortcut}
                  </kbd>
                  <span className="text-[11px] text-[#868A91] opacity-0 group-hover:opacity-100 transition-opacity">
                    Edit...
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Interactive Keymap Shortcut Recorder Modal */}
      {recordingKeymapIdx !== null && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-50 animate-in fade-in duration-100"
          onClick={() => setRecordingKeymapIdx(null)}
        >
          <div 
            className="w-[460px] bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl p-5 space-y-4 text-xs text-[#DFE1E5]"
            onClick={(e) => e.stopPropagation()}
            tabIndex={0}
            onKeyDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.key === 'Escape') {
                setRecordingKeymapIdx(null);
                return;
              }
              if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

              const parts = [];
              if (e.ctrlKey) parts.push('Ctrl');
              if (e.altKey) parts.push('Alt');
              if (e.shiftKey) parts.push('Shift');
              
              let keyName = e.key;
              if (keyName === ' ') keyName = 'Space';
              else if (keyName.length === 1) keyName = keyName.toUpperCase();
              parts.push(keyName);

              const combo = parts.join('+');
              setRecordedKeys(combo);

              // Check conflict
              const conflict = keymaps.find((item, i) => i !== recordingKeymapIdx && item.shortcut.toLowerCase() === combo.toLowerCase());
              if (conflict) {
                setKeymapConflict(`Already assigned to: "${conflict.action}"`);
              } else {
                setKeymapConflict(null);
              }
            }}
          >
            <div className="flex items-center justify-between border-b border-[#393B40] pb-2">
              <span className="font-semibold text-white text-sm">Keyboard Shortcut</span>
              <button onClick={() => setRecordingKeymapIdx(null)} className="text-[#868A91] hover:text-white">
                <X size={15} />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-[11.5px] text-[#868A91]">
                Action: <span className="text-white font-medium">{keymaps[recordingKeymapIdx]?.action}</span>
              </div>

              <div className="p-4 bg-[#1E1F22] border-2 border-dashed border-[#3574F0]/60 rounded text-center space-y-2">
                <div className="text-[11px] text-[#868A91]">Press keys on your keyboard...</div>
                <div className="font-mono text-base font-bold text-[#3574F0] tracking-wider">
                  {recordedKeys || 'Press shortcut keys'}
                </div>
              </div>

              {keymapConflict && (
                <div className="text-[11px] text-[#EDA200] flex items-center gap-1.5 pt-1">
                  <AlertTriangle size={13} />
                  <span>{keymapConflict}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#393B40]">
              <button
                type="button"
                onClick={() => {
                  setKeymaps?.(prev => prev.map((k, i) => i === recordingKeymapIdx ? { ...k, shortcut: 'None' } : k));
                  setRecordingKeymapIdx(null);
                  setIsDirty(true);
                }}
                className="px-3 py-1 text-xs text-[#E05555] hover:bg-[#E05555]/10 rounded border border-[#E05555]/40"
              >
                Remove
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRecordingKeymapIdx(null)}
                  className="px-3 py-1 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (recordedKeys) {
                      setKeymaps?.(prev => prev.map((k, i) => i === recordingKeymapIdx ? { ...k, shortcut: recordedKeys } : k));
                      setIsDirty(true);
                      onShowToast?.('Shortcut Updated', `Assigned ${recordedKeys} to ${keymaps[recordingKeymapIdx]?.action}`, 'success');
                    }
                    setRecordingKeymapIdx(null);
                  }}
                  className="px-4 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-medium"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
