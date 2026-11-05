import React from 'react';
import { Plus, Check } from 'lucide-react';
import { SettingPanelProps } from './types';
import { LocalAiSettingsPanel } from '../../ai/LocalAiSettingsPanel';

export const ToolsPanel: React.FC<SettingPanelProps> = ({
  selectedId,
  formSettings,
  updateSetting,
  onShowToast,
}) => {
  return (
    <div>
      {/* Sub-page: Tools > AI Assistant */}
      {selectedId === 'tools-ai' && (
        <LocalAiSettingsPanel />
      )}

      {/* Sub-page: Tools > Terminal */}
      {selectedId === 'tools-terminal' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Terminal</h2>
            <p className="text-xs text-[#868A91]">Configure embedded shell environment and options.</p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div>
              <label className="text-[#868A91] block mb-1">Shell Path:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={formSettings.terminalShell || 'powershell.exe'}
                  onChange={(e) => updateSetting('terminalShell', e.target.value)}
                  className="flex-1 bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none"
                />
                <select
                  onChange={(e) => updateSetting('terminalShell', e.target.value)}
                  className="bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1.5 text-xs text-[#DFE1E5] outline-none"
                >
                  <option value="powershell.exe">PowerShell</option>
                  <option value="cmd.exe">Command Prompt</option>
                  <option value="bash.exe">Git Bash</option>
                  <option value="wsl.exe">WSL (Ubuntu)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-[#393B40] space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span>Start in current project root directory</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span>Audible bell</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span>Close session when it ends with exit code 0</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Tools > File Watchers */}
      {selectedId === 'tools-file-watchers' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">File Watchers</h2>
              <p className="text-xs text-[#868A91]">Automatically run external formatters, transpilers, or build scripts when files are modified.</p>
            </div>
            <button
              onClick={() => onShowToast?.('Watcher Added', 'Custom file watcher template created', 'info')}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
            >
              <Plus size={12} />
              Add Watcher...
            </button>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.fileWatchersEnabled ?? true}
                onChange={(e) => updateSetting('fileWatchersEnabled', e.target.checked)}
                className="accent-[#3574F0] rounded"
              />
              <span>Enable background file watchers</span>
            </label>

            <div className="border border-[#393B40] rounded bg-[#26282B] overflow-hidden">
              <div className="h-7 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91]">
                <span>Watcher Name</span>
                <span>Target Files</span>
                <span>Status</span>
              </div>
              <div className="divide-y divide-[#393B40]/40 p-1">
                <div className="px-2 py-2 flex items-center justify-between">
                  <span className="font-medium text-white">Prettier Formatter</span>
                  <span className="text-[#868A91] font-mono text-[11px]">*.{'{'}ts,tsx,js,json,css{'}'}</span>
                  <span className="text-[#59A869] text-[11px] flex items-center gap-1"><Check size={11} /> Active</span>
                </div>
                <div className="px-2 py-2 flex items-center justify-between">
                  <span className="font-medium text-white">Rustfmt Auto</span>
                  <span className="text-[#868A91] font-mono text-[11px]">*.rs</span>
                  <span className="text-[#59A869] text-[11px] flex items-center gap-1"><Check size={11} /> Active</span>
                </div>
                <div className="px-2 py-2 flex items-center justify-between">
                  <span className="font-medium text-white">Gofmt & Goimports</span>
                  <span className="text-[#868A91] font-mono text-[11px]">*.go</span>
                  <span className="text-[#59A869] text-[11px] flex items-center gap-1"><Check size={11} /> Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Tools > Tasks */}
      {selectedId === 'tools-tasks' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Tasks</h2>
            <p className="text-xs text-[#868A91]">Integrate issue trackers (Jira, GitHub Issues, YouTrack) with IDE changelists.</p>
          </div>

          <div className="space-y-3 max-w-xl text-xs">
            <div className="border border-[#393B40] rounded bg-[#26282B] p-3 space-y-2">
              <div className="font-semibold text-white">Configured Task Servers:</div>
              <div className="text-[#868A91]">GitHub Issues (api.github.com)</div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span>Create changelist automatically when opening a task</span>
            </label>
          </div>
        </div>
      )}

      {/* Sub-page: Tools > Web Browsers */}
      {selectedId === 'tools-web-browsers' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Web Browsers</h2>
            <p className="text-xs text-[#868A91]">Configure web browsers for HTML preview and live editing.</p>
          </div>

          <div className="border border-[#393B40] rounded bg-[#26282B] overflow-hidden text-xs max-w-xl">
            <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
              <span>Browser</span>
              <span>Selection</span>
            </div>
            <div className="divide-y divide-[#393B40]/50 p-2 space-y-2">
              {['Google Chrome', 'Microsoft Edge', 'Mozilla Firefox', 'Brave'].map(b => (
                <label key={b} className="flex items-center justify-between cursor-pointer px-2 py-1 hover:bg-[#35373B] rounded">
                  <span>{b}</span>
                  <input
                    type="radio"
                    name="browserSelect"
                    checked={formSettings.defaultBrowser === b.toLowerCase()}
                    onChange={() => updateSetting('defaultBrowser', b.toLowerCase())}
                    className="accent-[#3574F0]"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Tools > External Tools */}
      {selectedId === 'tools-external-tools' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">External Tools</h2>
              <p className="text-xs text-[#868A91]">Define custom external commands, CLI utilities, and scripts to invoke from context menus and keybindings.</p>
            </div>
            <button
              onClick={() => onShowToast?.('New External Tool', 'Tool configuration dialog ready', 'info')}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
            >
              <Plus size={12} />
              Add Tool...
            </button>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.externalToolsEnabled ?? true}
                onChange={(e) => updateSetting('externalToolsEnabled', e.target.checked)}
                className="accent-[#3574F0] rounded"
              />
              <span>Enable external tools integration</span>
            </label>

            <div className="border border-[#393B40] rounded bg-[#26282B] overflow-hidden">
              <div className="h-7 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91]">
                <span>Tool Name</span>
                <span>Executable</span>
                <span>Menu Location</span>
              </div>
              <div className="divide-y divide-[#393B40]/40 p-1">
                <div className="px-2 py-2 flex items-center justify-between">
                  <span className="font-medium text-white">Git Bash Terminal</span>
                  <span className="text-[#868A91] font-mono text-[11px]">git-bash.exe</span>
                  <span className="text-[#A5C0EE] text-[11px]">Tools | External Tools</span>
                </div>
                <div className="px-2 py-2 flex items-center justify-between">
                  <span className="font-medium text-white">Postman CLI</span>
                  <span className="text-[#868A91] font-mono text-[11px]">postman.cmd</span>
                  <span className="text-[#A5C0EE] text-[11px]">Tools | External Tools</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Tools > SonarQube */}
      {selectedId === 'tools-sonarqube' && (
        <SonarQubeSettingsPanel onShowToast={onShowToast} />
      )}
    </div>
  );
};

const SonarQubeSettingsPanel: React.FC<{ onShowToast?: (t: string, m: string, type?: any) => void }> = ({ onShowToast }) => {
  const [config, setConfig] = React.useState(() => {
    try {
      const raw = localStorage.getItem('intellij_sonarqube_config');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      serverUrl: 'https://sonar-dev-bpm.mic.vn',
      projectKey: 'mic-vehicles',
      token: '',
    };
  });

  const [testing, setTesting] = React.useState(false);
  const [serverStatus, setServerStatus] = React.useState<string | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setServerStatus('Connecting...');
    try {
      const res = await fetch(`${config.serverUrl.replace(/\/+$/, '')}/api/system/status`);
      const json = await res.json();
      setServerStatus(`Connected: SonarQube ${json.version || ''} (Status: ${json.status || 'UP'})`);
      onShowToast?.('SonarQube Connected', `Server is UP (version ${json.version})`, 'success');
    } catch (e: any) {
      setServerStatus(`Connection failed: ${String(e)}`);
      onShowToast?.('Connection Failed', String(e), 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem('intellij_sonarqube_config', JSON.stringify(config));
      onShowToast?.('Settings Saved', 'SonarQube server settings saved.', 'success');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 text-xs max-w-xl">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">SonarQube / SonarLint</h2>
        <p className="text-xs text-[#868A91]">Configure SonarQube server endpoint, Connected Mode project binding, and credentials.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-[#868A91] block mb-1">SonarQube Server URL:</label>
          <input
            type="text"
            value={config.serverUrl}
            onChange={(e) => setConfig({ ...config, serverUrl: e.target.value })}
            placeholder="https://sonar-dev-bpm.mic.vn"
            className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none"
          />
        </div>

        <div>
          <label className="text-[#868A91] block mb-1">Project Key:</label>
          <input
            type="text"
            value={config.projectKey}
            onChange={(e) => setConfig({ ...config, projectKey: e.target.value })}
            placeholder="mic-vehicles"
            className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none"
          />
        </div>

        <div>
          <label className="text-[#868A91] block mb-1">User Authentication Token:</label>
          <input
            type="password"
            value={config.token}
            onChange={(e) => setConfig({ ...config, token: e.target.value })}
            placeholder="sqp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none"
          />
        </div>

        {serverStatus && (
          <div className="p-2.5 rounded bg-[#18191B] border border-[#393B40] text-[11px] font-mono text-[#A5C0EE]">
            {serverStatus}
          </div>
        )}

        <div className="pt-2 flex items-center justify-between border-t border-[#393B40]">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-3 py-1.5 bg-[#2B2D30] hover:bg-[#35373B] text-white rounded border border-[#393B40] cursor-pointer"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white font-medium rounded cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
