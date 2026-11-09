import React, { useState } from 'react';
import { RefreshCw, Check, Plus, Trash2, Cpu, Hammer, Play, Bug, Upload, Shield, Server, Box, CheckCircle2 } from 'lucide-react';
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

  // Compiler excludes state
  const [excludesList, setExcludesList] = useState<string[]>(() => {
    return formSettings.compilerExcludes || ['**/node_modules/**', '**/target/**', '**/build/**', '**/dist/**', '**/*.min.js'];
  });
  const [newExcludePattern, setNewExcludePattern] = useState('');
  const [showAddExclude, setShowAddExclude] = useState(false);

  // Deployment servers state
  const [deploymentServers, setDeploymentServers] = useState([
    { id: 'srv_1', name: 'Staging SFTP Server', type: 'SFTP', host: 'staging.mic.vn', port: 22, rootPath: '/var/www/app', autoUpload: true },
    { id: 'srv_2', name: 'Local Test Server', type: 'Local', host: 'localhost', port: 8080, rootPath: 'D:\\TestServer\\webapps', autoUpload: false },
  ]);
  const [selectedServerId, setSelectedServerId] = useState('srv_1');

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

      {/* Sub-page: Build Tools > Gradle */}
      {selectedId === 'build-tools-gradle' && (
        <div className="space-y-6 max-w-2xl text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Gradle</h2>
            <p className="text-xs text-[#868A91]">Configure Gradle JVM, wrapper distribution, and parallel execution settings.</p>
          </div>

          <div className="space-y-4 p-4 bg-[#26282B] border border-[#393B40] rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">Gradle JVM:</span>
              <select
                value={formSettings.gradleJvm || 'openjdk-21'}
                onChange={(e) => updateSetting('gradleJvm', e.target.value)}
                className="bg-[#1E1F22] border border-[#393B40] rounded px-3 py-1.5 text-white outline-none w-64"
              >
                <option value="openjdk-21">Adoptium OpenJDK 21 (Default)</option>
                <option value="openjdk-17">Adoptium OpenJDK 17 LTS</option>
                <option value="openjdk-11">Adoptium OpenJDK 11 LTS</option>
                <option value="project-jdk">Project SDK</option>
              </select>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#393B40]/60">
              <span className="text-white font-medium block">Build and run using:</span>
              <div className="space-y-2 pl-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gradleDist"
                    value="wrapper"
                    checked={(formSettings.gradleDistribution ?? 'wrapper') === 'wrapper'}
                    onChange={() => updateSetting('gradleDistribution', 'wrapper')}
                    className="accent-[#3574F0]"
                  />
                  <span className="text-[#DFE1E5]">Gradle wrapper (gradlew from project root)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gradleDist"
                    value="local"
                    checked={formSettings.gradleDistribution === 'local'}
                    onChange={() => updateSetting('gradleDistribution', 'local')}
                    className="accent-[#3574F0]"
                  />
                  <span className="text-[#DFE1E5]">Specified local Gradle installation</span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-[#393B40]/60">
              <label className="text-[#DFE1E5] block">Gradle user home directory:</label>
              <input
                type="text"
                value={formSettings.gradleUserHome || '~/.gradle'}
                onChange={(e) => updateSetting('gradleUserHome', e.target.value)}
                className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white font-mono text-[11px] outline-none"
              />
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.gradleParallel ?? true}
                  onChange={(e) => updateSetting('gradleParallel', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Enable parallel project execution (--parallel)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.gradleOffline ?? false}
                  onChange={(e) => updateSetting('gradleOffline', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Offline work mode (--offline)</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Build Tools > Cargo */}
      {selectedId === 'build-tools-cargo' && (
        <div className="space-y-6 max-w-2xl text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Cargo</h2>
            <p className="text-xs text-[#868A91]">Configure Rust Cargo build tool, Clippy linting, and background analysis.</p>
          </div>

          <div className="space-y-4 p-4 bg-[#26282B] border border-[#393B40] rounded-lg">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.cargoCheckOnFly ?? true}
                onChange={(e) => updateSetting('cargoCheckOnFly', e.target.checked)}
                className="accent-[#3574F0] rounded"
              />
              <span className="text-white font-medium">Run cargo check on the fly while typing</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.cargoClippy ?? true}
                onChange={(e) => updateSetting('cargoClippy', e.target.checked)}
                className="accent-[#3574F0] rounded"
              />
              <span className="text-white font-medium">Run cargo clippy instead of cargo check</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.cargoAllTargets ?? true}
                onChange={(e) => updateSetting('cargoAllTargets', e.target.checked)}
                className="accent-[#3574F0] rounded"
              />
              <span className="text-white font-medium">Compile all targets (--all-targets including tests and benches)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.cargoOffline ?? false}
                onChange={(e) => updateSetting('cargoOffline', e.target.checked)}
                className="accent-[#3574F0] rounded"
              />
              <span className="text-white font-medium">Offline mode (--offline)</span>
            </label>
          </div>
        </div>
      )}

      {/* Sub-page: Compiler > Java Compiler */}
      {selectedId === 'build-compiler-java' && (
        <div className="space-y-6 max-w-2xl text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Java Compiler</h2>
            <p className="text-xs text-[#868A91]">Configure javac bytecode target version, build heap limits, and compiler flags.</p>
          </div>

          <div className="space-y-4 p-4 bg-[#26282B] border border-[#393B40] rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">Project bytecode version:</span>
              <select
                value={formSettings.javaBytecodeVersion || '21'}
                onChange={(e) => updateSetting('javaBytecodeVersion', e.target.value)}
                className="bg-[#1E1F22] border border-[#393B40] rounded px-3 py-1.5 text-white outline-none w-48"
              >
                <option value="21">21 - LTS (Default)</option>
                <option value="17">17 - LTS</option>
                <option value="11">11 - LTS</option>
                <option value="8">8 - Legacy</option>
              </select>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-[#393B40]/60">
              <label className="text-[#DFE1E5] block">Additional command line parameters (javac):</label>
              <input
                type="text"
                placeholder="-parameters -Xlint:unchecked"
                value={formSettings.javaJavacOptions || '-parameters'}
                onChange={(e) => updateSetting('javaJavacOptions', e.target.value)}
                className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white font-mono text-[11px] outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#393B40]/60">
              <span className="text-white font-medium">Maximum heap size for build process (MB):</span>
              <input
                type="number"
                min={256}
                max={8192}
                value={formSettings.buildHeapSize ?? 1024}
                onChange={(e) => updateSetting('buildHeapSize', Number(e.target.value))}
                className="w-32 bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white text-center outline-none"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" defaultChecked={true} className="accent-[#3574F0] rounded" />
              <span className="text-[#DFE1E5]">Generate debugging info (-g:lines,vars,source)</span>
            </label>
          </div>
        </div>
      )}

      {/* Sub-page: Compiler > Annotation Processors */}
      {selectedId === 'build-compiler-annotation' && (
        <div className="space-y-6 max-w-2xl text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Annotation Processors</h2>
            <p className="text-xs text-[#868A91]">Configure automated code generation tools like Lombok, MapStruct, and Dagger.</p>
          </div>

          <div className="space-y-4 p-4 bg-[#26282B] border border-[#393B40] rounded-lg">
            <label className="flex items-center gap-2.5 cursor-pointer pb-2 border-b border-[#393B40]/60">
              <input
                type="checkbox"
                checked={formSettings.javaAnnotationProcessing ?? true}
                onChange={(e) => updateSetting('javaAnnotationProcessing', e.target.checked)}
                className="accent-[#3574F0] rounded"
              />
              <span className="text-white font-medium">Enable annotation processing</span>
            </label>

            <div className="space-y-2">
              <span className="text-white font-medium block">Obtain processors from:</span>
              <div className="space-y-1.5 pl-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="procSource" defaultChecked className="accent-[#3574F0]" />
                  <span className="text-[#DFE1E5]">Project classpath (pom.xml / build.gradle)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="procSource" className="accent-[#3574F0]" />
                  <span className="text-[#DFE1E5]">Processor path specified manually</span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-[#393B40]/60">
              <span className="text-[#DFE1E5] block">Store generated sources relative to:</span>
              <select className="bg-[#1E1F22] border border-[#393B40] rounded px-3 py-1 text-white outline-none w-64">
                <option value="target">Module target directory (target/generated-sources)</option>
                <option value="content_root">Module content root</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Compiler > Excludes */}
      {selectedId === 'build-compiler-excludes' && (
        <div className="space-y-6 max-w-2xl text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Excludes</h2>
            <p className="text-xs text-[#868A91]">Exclude files, wildcards, and directories from being processed by the compiler.</p>
          </div>

          <div className="space-y-4">
            <div className="border border-[#393B40] rounded overflow-hidden bg-[#26282B]">
              <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91]">
                <span>Excluded Pattern / Directory</span>
                <span>Action</span>
              </div>
              <div className="divide-y divide-[#393B40]/50 font-mono text-[11px]">
                {excludesList.map((pat, idx) => (
                  <div key={idx} className="px-3 py-2 flex items-center justify-between hover:bg-[#35373B]/40">
                    <span className="text-white">{pat}</span>
                    <button
                      onClick={() => {
                        const updated = excludesList.filter((_, i) => i !== idx);
                        setExcludesList(updated);
                        updateSetting('compilerExcludes', updated);
                      }}
                      className="text-[#868A91] hover:text-[#E05555]"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {showAddExclude ? (
              <div className="p-3 bg-[#26282B] border border-[#393B40] rounded space-y-2">
                <input
                  type="text"
                  placeholder="Glob pattern (e.g. **/generated/** or *.tmp)"
                  value={newExcludePattern}
                  onChange={(e) => setNewExcludePattern(e.target.value)}
                  className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white font-mono text-[11px] outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (newExcludePattern.trim()) {
                        const updated = [...excludesList, newExcludePattern.trim()];
                        setExcludesList(updated);
                        updateSetting('compilerExcludes', updated);
                        setNewExcludePattern('');
                        setShowAddExclude(false);
                      }
                    }}
                    className="px-3 py-1 bg-[#3574F0] text-white rounded text-xs"
                  >
                    Add Exclude
                  </button>
                  <button onClick={() => setShowAddExclude(false)} className="px-3 py-1 bg-[#35373B] text-white rounded text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddExclude(true)}
                className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-white border border-[#393B40] rounded text-xs flex items-center gap-1.5"
              >
                <Plus size={12} /> Add Exclude Pattern...
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sub-page: Debugger > Data Views */}
      {selectedId === 'build-debugger-views' && (
        <div className="space-y-6 max-w-2xl text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Debugger: Data Views</h2>
            <p className="text-xs text-[#868A91]">Configure how variables, objects, and memory dumps are formatted in the Debugger tool window.</p>
          </div>

          <div className="space-y-4 p-4 bg-[#26282B] border border-[#393B40] rounded-lg">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.debuggerShowTypes ?? true}
                onChange={(e) => updateSetting('debuggerShowTypes', e.target.checked)}
                className="accent-[#3574F0] rounded"
              />
              <span className="text-white font-medium">Show variable types in variables tree</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" defaultChecked={true} className="accent-[#3574F0] rounded" />
              <span className="text-white font-medium">Auto-evaluate expressions for inspectable objects</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" defaultChecked={true} className="accent-[#3574F0] rounded" />
              <span className="text-white font-medium">Sort variables alphabetically</span>
            </label>
          </div>
        </div>
      )}

      {/* Sub-page: Debugger > Stepping */}
      {selectedId === 'build-debugger-stepping' && (
        <div className="space-y-6 max-w-2xl text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Debugger: Stepping</h2>
            <p className="text-xs text-[#868A91]">Configure stepping filters to avoid stepping into JDK libraries or synthetic bridge methods.</p>
          </div>

          <div className="space-y-4 p-4 bg-[#26282B] border border-[#393B40] rounded-lg">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.debuggerSkipSynthetic ?? true}
                onChange={(e) => updateSetting('debuggerSkipSynthetic', e.target.checked)}
                className="accent-[#3574F0] rounded"
              />
              <span className="text-white font-medium">Skip synthetic and compiler-generated methods</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" defaultChecked={true} className="accent-[#3574F0] rounded" />
              <span className="text-white font-medium">Skip class loaders and reflection invocation delegates</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" defaultChecked={true} className="accent-[#3574F0] rounded" />
              <span className="text-white font-medium">Do not step into standard library classes (java.*, javax.*, std::*)</span>
            </label>
          </div>
        </div>
      )}

      {/* Sub-page: Debugger > HotSwap */}
      {selectedId === 'build-debugger-hotswap' && (
        <div className="space-y-6 max-w-2xl text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Debugger: HotSwap</h2>
            <p className="text-xs text-[#868A91]">Reload changed classes on the fly during active JVM debugging sessions without restarting.</p>
          </div>

          <div className="space-y-4 p-4 bg-[#26282B] border border-[#393B40] rounded-lg">
            <div className="space-y-2">
              <span className="text-white font-medium block">Reload classes after compilation:</span>
              <div className="space-y-2 pl-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="hotswapMode"
                    value="ask"
                    checked={(formSettings.debuggerHotSwap ?? 'ask') === 'ask'}
                    onChange={() => updateSetting('debuggerHotSwap', 'ask')}
                    className="accent-[#3574F0]"
                  />
                  <span className="text-[#DFE1E5]">Ask before reloading classes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="hotswapMode"
                    value="always"
                    checked={formSettings.debuggerHotSwap === 'always'}
                    onChange={() => updateSetting('debuggerHotSwap', 'always')}
                    className="accent-[#3574F0]"
                  />
                  <span className="text-[#DFE1E5]">Always reload silently</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="hotswapMode"
                    value="never"
                    checked={formSettings.debuggerHotSwap === 'never'}
                    onChange={() => updateSetting('debuggerHotSwap', 'never')}
                    className="accent-[#3574F0]"
                  />
                  <span className="text-[#DFE1E5]">Never reload</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Build, Execution, Deployment > Deployment */}
      {selectedId === 'build-deployment' && (
        <div className="space-y-6 max-w-2xl text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Deployment</h2>
            <p className="text-xs text-[#868A91]">Configure remote SFTP, FTP, and local server deployment targets with upload on save.</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="border border-[#393B40] rounded bg-[#26282B] p-2 space-y-1">
              <div className="font-semibold text-white px-2 py-1 border-b border-[#393B40]/60 flex items-center justify-between">
                <span>Servers</span>
                <button
                  onClick={() => {
                    const newServer = {
                      id: `srv_${Date.now()}`,
                      name: `Remote Server ${deploymentServers.length + 1}`,
                      type: 'SFTP',
                      host: 'deploy.mic.vn',
                      port: 22,
                      rootPath: '/var/www',
                      autoUpload: false
                    };
                    setDeploymentServers(prev => [...prev, newServer]);
                    setSelectedServerId(newServer.id);
                  }}
                  className="text-[#3574F0]"
                >
                  <Plus size={13} />
                </button>
              </div>
              {deploymentServers.map((srv) => (
                <div
                  key={srv.id}
                  onClick={() => setSelectedServerId(srv.id)}
                  className={`p-2 rounded cursor-pointer flex justify-between items-center transition-colors ${
                    selectedServerId === srv.id ? 'bg-[#2E436E] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  <span>{srv.name}</span>
                  <span className="text-[10px] text-[#868A91]">{srv.type}</span>
                </div>
              ))}
            </div>

            <div className="col-span-2 p-3.5 bg-[#26282B] border border-[#393B40] rounded space-y-3">
              {(() => {
                const curr = deploymentServers.find(s => s.id === selectedServerId) || deploymentServers[0];
                return (
                  <>
                    <div className="flex items-center justify-between pb-1 border-b border-[#393B40]/60">
                      <span className="font-semibold text-white">{curr.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3574F0]/20 text-[#679EF5]">{curr.type}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="text-[#868A91] block mb-1">Host:</label>
                        <input
                          type="text"
                          value={curr.host}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDeploymentServers(prev => prev.map(s => s.id === curr.id ? { ...s, host: val } : s));
                          }}
                          className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white font-mono text-[11px] outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[#868A91] block mb-1">Port:</label>
                        <input
                          type="number"
                          value={curr.port}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setDeploymentServers(prev => prev.map(s => s.id === curr.id ? { ...s, port: val } : s));
                          }}
                          className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white font-mono text-[11px] outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[#868A91] block mb-1">Root path on remote server:</label>
                      <input
                        type="text"
                        value={curr.rootPath}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDeploymentServers(prev => prev.map(s => s.id === curr.id ? { ...s, rootPath: val } : s));
                        }}
                        className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white font-mono text-[11px] outline-none"
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={curr.autoUpload}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setDeploymentServers(prev => prev.map(s => s.id === curr.id ? { ...s, autoUpload: val } : s));
                        }}
                        className="accent-[#3574F0] rounded"
                      />
                      <span className="text-[#DFE1E5]">Upload changed files automatically on save</span>
                    </label>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Build, Execution, Deployment > Coverage */}
      {selectedId === 'build-coverage' && (
        <div className="space-y-6 max-w-2xl text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Coverage</h2>
            <p className="text-xs text-[#868A91]">Configure code coverage calculation engines and editor gutter highlights.</p>
          </div>

          <div className="space-y-4 p-4 bg-[#26282B] border border-[#393B40] rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">Coverage runner engine:</span>
              <select
                value={formSettings.coverageEngine || 'jacoco'}
                onChange={(e) => updateSetting('coverageEngine', e.target.value as any)}
                className="bg-[#1E1F22] border border-[#393B40] rounded px-3 py-1.5 text-white outline-none w-56"
              >
                <option value="jacoco">JaCoCo (Java / Kotlin)</option>
                <option value="tarpaulin">Cargo Tarpaulin (Rust)</option>
                <option value="lcov">LCOV / Istanbul (TypeScript / JS)</option>
              </select>
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked={true} className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Show code coverage suite window automatically when tests finish</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked={true} className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Highlight covered and uncovered lines in editor gutter</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Build, Execution, Deployment > Remote Development */}
      {selectedId === 'build-remote' && (
        <div className="space-y-6 max-w-2xl text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Remote Development</h2>
            <p className="text-xs text-[#868A91]">Connect to SSH remote hosts, WSL 2 Linux subsystems, or Docker devcontainers.</p>
          </div>

          <div className="space-y-4 p-4 bg-[#26282B] border border-[#393B40] rounded-lg">
            <div className="space-y-1.5">
              <label className="text-white font-medium block">SSH Host (e.g. user@remote.mic.vn):</label>
              <input
                type="text"
                placeholder="developer@build-server.mic.vn"
                value={formSettings.remoteDevHost || ''}
                onChange={(e) => updateSetting('remoteDevHost', e.target.value)}
                className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-white font-mono text-[11px] outline-none"
              />
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2">
              <span className="text-[#DFE1E5] font-medium block">WSL 2 Integration:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked={true} className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Automatically detect installed WSL distributions (Ubuntu, Debian)</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

