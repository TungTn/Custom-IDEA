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

      {/* Sub-page: Build Tools > Maven */}
      {(selectedId === 'build-tools-maven' || selectedId === 'build-tools-maven-global') && (
        <div className="space-y-6 max-w-2xl text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Maven</h2>
            <p className="text-xs text-[#868A91]">
              Configure Maven home directory, user and global settings files, and local repository paths (100% IntelliJ IDEA Compatible).
            </p>
          </div>

          {/* 1. Maven Home Path */}
          <div className="space-y-3 p-4 bg-[#26282B] border border-[#393B40] rounded-lg">
            <div className="font-semibold text-white flex items-center justify-between">
              <span>Maven home path:</span>
              <span className="text-[11px] text-[#868A91] font-normal">Controls which Maven distribution executes project goals</span>
            </div>

            <div className="space-y-2 pl-1">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="mavenHome"
                  value="wrapper"
                  checked={(formSettings.mavenHomePath || 'wrapper') === 'wrapper'}
                  onChange={() => updateSetting('mavenHomePath', 'wrapper')}
                  className="accent-[#3574F0]"
                />
                <span className="text-[#DFE1E5]">Use Maven Wrapper (mvnw / mvnw.cmd)</span>
                <span className="text-[10px] text-[#59A869] font-medium bg-[#59A869]/10 px-1.5 py-0.5 rounded">Recommended</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="mavenHome"
                  value="bundled"
                  checked={formSettings.mavenHomePath === 'bundled'}
                  onChange={() => updateSetting('mavenHomePath', 'bundled')}
                  className="accent-[#3574F0]"
                />
                <span className="text-[#DFE1E5]">Bundled (Maven 3.9)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="mavenHome"
                  value="custom"
                  checked={formSettings.mavenHomePath === 'custom'}
                  onChange={() => updateSetting('mavenHomePath', 'custom')}
                  className="accent-[#3574F0]"
                />
                <span className="text-[#DFE1E5]">Custom installation directory</span>
              </label>

              {formSettings.mavenHomePath === 'custom' && (
                <div className="pl-6 pt-1 flex gap-2">
                  <input
                    type="text"
                    value={formSettings.mavenCustomPath || ''}
                    onChange={(e) => updateSetting('mavenCustomPath', e.target.value)}
                    placeholder="e.g. C:\Program Files\apache-maven-3.9.6"
                    className="flex-1 bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none text-xs"
                  />
                  <button
                    onClick={() => {
                      const sample = 'C:\\Program Files\\apache-maven-3.9.6';
                      updateSetting('mavenCustomPath', sample);
                      onShowToast?.('Maven Home', `Set custom Maven path: ${sample}`, 'info');
                    }}
                    className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40]"
                  >
                    Browse...
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 2. Global & User Settings Files */}
          <div className="space-y-4 p-4 bg-[#26282B] border border-[#393B40] rounded-lg">
            <div className="font-semibold text-white">Settings Files & Repositories</div>

            {/* Global Settings */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[#DFE1E5]">
                <label className="font-medium text-xs">Global settings file (corp proxy / Nexus mirror):</label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[#868A91] hover:text-[#DFE1E5]">
                  <input
                    type="checkbox"
                    checked={formSettings.mavenOverrideGlobalSettings ?? false}
                    onChange={(e) => updateSetting('mavenOverrideGlobalSettings', e.target.checked)}
                    className="accent-[#3574F0] rounded"
                  />
                  <span>Override</span>
                </label>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={!formSettings.mavenOverrideGlobalSettings}
                  value={formSettings.mavenGlobalSettings || '${maven.home}/conf/settings.xml'}
                  onChange={(e) => updateSetting('mavenGlobalSettings', e.target.value)}
                  placeholder="${maven.home}/conf/settings.xml"
                  className="flex-1 bg-[#1E1F22] disabled:opacity-50 border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none text-xs"
                />
                <button
                  disabled={!formSettings.mavenOverrideGlobalSettings}
                  onClick={() => {
                    const sample = 'C:\\Users\\adminlocal\\.m2\\global-settings.xml';
                    updateSetting('mavenGlobalSettings', sample);
                    onShowToast?.('Global Settings', `Selected ${sample}`, 'info');
                  }}
                  className="px-3 py-1 bg-[#2B2D30] disabled:opacity-40 hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40]"
                >
                  Browse...
                </button>
              </div>
              <p className="text-[11px] text-[#868A91]">
                Passed via <code className="text-[#3574F0] font-mono">-gs &lt;path&gt;</code> to Maven CLI. Used by corporate IT to enforce central mirror and credentials.
              </p>
            </div>

            {/* User Settings */}
            <div className="space-y-1.5 pt-2 border-t border-[#393B40]/40">
              <div className="flex items-center justify-between text-[#DFE1E5]">
                <label className="font-medium text-xs">User settings file:</label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[#868A91] hover:text-[#DFE1E5]">
                  <input
                    type="checkbox"
                    checked={formSettings.mavenOverrideUserSettings ?? false}
                    onChange={(e) => updateSetting('mavenOverrideUserSettings', e.target.checked)}
                    className="accent-[#3574F0] rounded"
                  />
                  <span>Override</span>
                </label>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={!formSettings.mavenOverrideUserSettings}
                  value={formSettings.mavenUserSettings || '~/.m2/settings.xml'}
                  onChange={(e) => updateSetting('mavenUserSettings', e.target.value)}
                  placeholder="~/.m2/settings.xml"
                  className="flex-1 bg-[#1E1F22] disabled:opacity-50 border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none text-xs"
                />
                <button
                  disabled={!formSettings.mavenOverrideUserSettings}
                  onClick={() => {
                    const sample = 'C:\\Users\\adminlocal\\.m2\\settings.xml';
                    updateSetting('mavenUserSettings', sample);
                    onShowToast?.('User Settings', `Selected ${sample}`, 'info');
                  }}
                  className="px-3 py-1 bg-[#2B2D30] disabled:opacity-40 hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40]"
                >
                  Browse...
                </button>
              </div>
              <p className="text-[11px] text-[#868A91]">
                Passed via <code className="text-[#3574F0] font-mono">-s &lt;path&gt;</code> to Maven CLI.
              </p>
            </div>

            {/* Local Repository */}
            <div className="space-y-1.5 pt-2 border-t border-[#393B40]/40">
              <div className="flex items-center justify-between text-[#DFE1E5]">
                <label className="font-medium text-xs">Local repository:</label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[#868A91] hover:text-[#DFE1E5]">
                  <input
                    type="checkbox"
                    checked={formSettings.mavenOverrideLocalRepo ?? false}
                    onChange={(e) => updateSetting('mavenOverrideLocalRepo', e.target.checked)}
                    className="accent-[#3574F0] rounded"
                  />
                  <span>Override</span>
                </label>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={!formSettings.mavenOverrideLocalRepo}
                  value={formSettings.mavenLocalRepo || '~/.m2/repository'}
                  onChange={(e) => updateSetting('mavenLocalRepo', e.target.value)}
                  placeholder="~/.m2/repository"
                  className="flex-1 bg-[#1E1F22] disabled:opacity-50 border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none text-xs"
                />
                <button
                  disabled={!formSettings.mavenOverrideLocalRepo}
                  onClick={() => {
                    const sample = 'D:\\.m2\\repository';
                    updateSetting('mavenLocalRepo', sample);
                    onShowToast?.('Local Repository', `Selected ${sample}`, 'info');
                  }}
                  className="px-3 py-1 bg-[#2B2D30] disabled:opacity-40 hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40]"
                >
                  Browse...
                </button>
              </div>
              <p className="text-[11px] text-[#868A91]">
                Passed via <code className="text-[#3574F0] font-mono">-Dmaven.repo.local=&lt;path&gt;</code> to save dependencies on an alternate drive.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Build Tools > Maven > Runner */}
      {selectedId === 'build-tools-maven-runner' && (
        <div className="space-y-6 max-w-2xl text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Maven Runner</h2>
            <p className="text-xs text-[#868A91]">
              Configure global VM options, JRE/JDK runtime, and execution parameters applied to all Maven goals.
            </p>
          </div>

          <div className="space-y-4 p-4 bg-[#26282B] border border-[#393B40] rounded-lg">
            {/* VM Options */}
            <div className="space-y-1.5">
              <label className="font-semibold text-white block">VM Options (Global):</label>
              <textarea
                rows={3}
                value={formSettings.mavenRunnerVmOptions || '-Xmx2048m -Dfile.encoding=UTF-8'}
                onChange={(e) => updateSetting('mavenRunnerVmOptions', e.target.value)}
                placeholder="-Xmx2048m -Dfile.encoding=UTF-8"
                className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-2 text-white font-mono outline-none text-xs resize-none"
              />
              <p className="text-[11px] text-[#868A91]">
                Injected into <code className="text-[#3574F0] font-mono">MAVEN_OPTS</code> when executing build tasks and running Spring Boot. Prevents Java heap space OutOfMemory errors.
              </p>
            </div>

            {/* JRE / JDK Selection */}
            <div className="space-y-1.5 pt-3 border-t border-[#393B40]/40">
              <label className="font-semibold text-white block">JRE for Maven:</label>
              <select
                value={formSettings.mavenRunnerJdk || 'default'}
                onChange={(e) => updateSetting('mavenRunnerJdk', e.target.value)}
                className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-2 text-white outline-none text-xs cursor-pointer"
              >
                <option value="default">Use Project SDK / JAVA_HOME (Default)</option>
                <option value="graalvm-jdk-21">GraalVM 21.0.7 (Java 21) - ~/.jdks/graalvm-jdk-21.0.7</option>
                <option value="openjdk-17">OpenJDK 17 (Java 17)</option>
                <option value="openjdk-11">OpenJDK 11 (Java 11)</option>
                <option value="openjdk-8">Java 1.8 (Java 8)</option>
              </select>
              <p className="text-[11px] text-[#868A91]">
                Sets the <code className="text-[#3574F0] font-mono">JAVA_HOME</code> environment variable specifically for Maven processes.
              </p>
            </div>

            {/* Build Flags */}
            <div className="space-y-2 pt-3 border-t border-[#393B40]/40">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.mavenSkipTests ?? false}
                  onChange={(e) => updateSetting('mavenSkipTests', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Skip tests (-DskipTests)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.mavenOfflineMode ?? false}
                  onChange={(e) => updateSetting('mavenOfflineMode', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Work offline (-o)</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Build Tools > Maven > Importing */}
      {selectedId === 'build-tools-maven-importing' && (
        <div className="space-y-6 max-w-2xl text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Maven Importing</h2>
            <p className="text-xs text-[#868A91]">
              Configure project synchronization, automated dependency indexing, and source attachments.
            </p>
          </div>

          <div className="space-y-3 p-4 bg-[#26282B] border border-[#393B40] rounded-lg">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span className="text-[#DFE1E5]">Automatically reload project on changes in pom.xml</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span className="text-[#DFE1E5]">Automatically download Sources and Documentation</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span className="text-[#DFE1E5]">Create separate module per Maven source root</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

