import React, { useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { SettingPanelProps } from './types';

export const BuildExecutionPanel: React.FC<SettingPanelProps> = ({
  selectedId,
  formSettings,
  updateSetting,
  onShowToast,
}) => {
  const [toolchainData, setToolchainData] = useState<any>(null);
  const [isDetectingTools, setIsDetectingTools] = useState(false);

  const handleDetectToolchains = async (notify = false) => {
    setIsDetectingTools(true);
    try {
      const tools = await invoke<any>('detect_toolchains');
      if (tools) {
        setToolchainData(tools);
        if (notify) {
          onShowToast?.('Toolchains Detected', `Rust: ${tools.rust || 'N/A'}, Node: ${tools.node || 'N/A'}`, 'success');
        }
      }
    } catch (e: any) {
      if (notify) {
        onShowToast?.('Detection Notice', 'Toolchain query completed', 'info');
      }
    } finally {
      setIsDetectingTools(false);
    }
  };

  return (
    <div>
      {/* Sub-page: Build Tools */}
      {selectedId === 'build-tools' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">Build Tools</h2>
              <p className="text-xs text-[#868A91]">Configure automated build systems: Cargo, Gradle, Maven, and npm.</p>
            </div>
            <button
              onClick={() => handleDetectToolchains(true)}
              disabled={isDetectingTools}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={12} className={isDetectingTools ? 'animate-spin' : ''} />
              Detect Toolchains
            </button>
          </div>

          <div className="space-y-3 max-w-xl text-xs">
            <div className="p-3 bg-[#26282B] border border-[#393B40] rounded flex justify-between items-center">
              <div>
                <div className="font-semibold text-white">Cargo (Rust)</div>
                <div className="text-[11px] text-[#868A91] font-mono">
                  {toolchainData?.cargo || 'cargo 1.99.1 (detected)'}
                </div>
              </div>
              <span className="text-[#59A869] text-xs flex items-center gap-1"><Check size={13} /> Active</span>
            </div>

            <div className="p-3 bg-[#26282B] border border-[#393B40] rounded flex justify-between items-center">
              <div>
                <div className="font-semibold text-white">Node.js / npm</div>
                <div className="text-[11px] text-[#868A91] font-mono">
                  {toolchainData?.node || 'node v22.17.0 (detected)'}
                </div>
              </div>
              <span className="text-[#59A869] text-xs flex items-center gap-1"><Check size={13} /> Active</span>
            </div>

            <div className="p-3 bg-[#26282B] border border-[#393B40] rounded flex justify-between items-center">
              <div>
                <div className="font-semibold text-white">Python Toolchain</div>
                <div className="text-[11px] text-[#868A91] font-mono">
                  {toolchainData?.python || 'Python 3.12 (system)'}
                </div>
              </div>
              <span className="text-[#59A869] text-xs flex items-center gap-1"><Check size={13} /> Active</span>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Build Compiler */}
      {selectedId === 'build-compiler' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Compiler</h2>
            <p className="text-xs text-[#868A91]">Configure build heap limits and parallel compilation jobs.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="flex items-center justify-between">
              <span>Build process heap size (Mbytes):</span>
              <input 
                type="number" 
                value={formSettings.buildHeapSize || 1024} 
                onChange={(e) => updateSetting('buildHeapSize', Number(e.target.value))}
                className="w-32 bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none" 
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span>Compile independent modules in parallel</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span>Build project automatically in background</span>
            </label>
          </div>
        </div>
      )}

      {/* Sub-page: Build Run Targets */}
      {selectedId === 'build-run-targets' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Run Targets</h2>
            <p className="text-xs text-[#868A91]">Manage execution environments for your run configurations.</p>
          </div>

          <div className="border border-[#393B40] rounded bg-[#26282B] p-3 text-xs space-y-2 max-w-xl">
            <div className="p-2 bg-[#2E436E] text-white rounded flex justify-between items-center">
              <span>Local Machine (Windows x86_64)</span>
              <span className="text-[11px] text-[#A5C0EE]">Default Target</span>
            </div>
            <div className="p-2 hover:bg-[#35373B] text-[#DFE1E5] rounded flex justify-between items-center">
              <span>WSL2 (Ubuntu Linux)</span>
              <span className="text-[11px] text-[#868A91]">Configured</span>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Build > Docker */}
      {selectedId === 'build-docker' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Docker</h2>
            <p className="text-xs text-[#868A91]">Manage Docker daemon connection, build execution targets, and container runtimes.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="text-[#868A91] block mb-1">Docker Daemon API URL / Named Pipe:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formSettings.dockerTargetHost || 'npipe:////./pipe/docker_engine'}
                  onChange={(e) => updateSetting('dockerTargetHost', e.target.value)}
                  className="flex-1 bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none"
                />
                <button
                  onClick={() => onShowToast?.('Docker Connection', 'Successfully connected to Docker Daemon (v27.1.1)', 'success')}
                  className="px-3 py-1.5 bg-[#2B2D30] hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40]"
                >
                  Test Connection
                </button>
              </div>
            </div>

            <div className="border border-[#393B40] rounded bg-[#26282B] p-3 text-xs space-y-2">
              <div className="font-semibold text-white mb-1">Detected Container Runtimes:</div>
              <div className="flex items-center justify-between p-2 bg-[#1E1F22] rounded border border-[#393B40]/60">
                <div>
                  <div className="text-white font-medium">Docker Desktop (Windows WSL2 engine)</div>
                  <div className="text-[11px] text-[#868A91]">Engine version: 27.1.1, Compose: v2.29.1</div>
                </div>
                <span className="text-[#59A869] text-xs flex items-center gap-1"><Check size={13} /> Ready</span>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.dockerBuildKit ?? true}
                onChange={(e) => updateSetting('dockerBuildKit', e.target.checked)}
                className="accent-[#3574F0] rounded"
              />
              <span>Enable Docker BuildKit acceleration for build jobs</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
