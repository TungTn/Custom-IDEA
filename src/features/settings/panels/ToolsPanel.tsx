import React from 'react';
import { Plus, Check, Link as LinkIcon, Search, Settings as SettingsIcon, Trash2, Globe, ShieldCheck, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { SettingPanelProps } from './types';
import { LocalAiSettingsPanel } from '../../ai/LocalAiSettingsPanel';
import { 
  SonarConnection, 
  SonarProjectBinding, 
  getSavedSonarConnections, 
  saveSonarConnections, 
  getSavedSonarBinding, 
  saveSonarBinding, 
  checkSonarServer, 
  searchSonarProjects 
} from '../../sonar/sonarService';

export const ToolsPanel: React.FC<SettingPanelProps> = ({
  selectedId,
  formSettings,
  updateSetting,
  onShowToast,
}) => {
  const [fileWatchersList, setFileWatchersList] = React.useState([
    { id: 'w1', name: 'Prettier Formatter', pattern: '*.{ts,tsx,js,json,css}', enabled: true },
    { id: 'w2', name: 'Rustfmt Auto', pattern: '*.rs', enabled: true },
    { id: 'w3', name: 'Gofmt & Goimports', pattern: '*.go', enabled: true },
  ]);
  const [isAddWatcherOpen, setIsAddWatcherOpen] = React.useState(false);
  const [newWatcherName, setNewWatcherName] = React.useState('');
  const [newWatcherPattern, setNewWatcherPattern] = React.useState('');

  const [externalToolsList, setExternalToolsList] = React.useState([
    { id: 't1', name: 'Git Bash Terminal', exec: 'git-bash.exe', menu: 'Tools | External Tools' },
    { id: 't2', name: 'Postman CLI', exec: 'postman.cmd', menu: 'Tools | External Tools' },
  ]);
  const [isAddToolOpen, setIsAddToolOpen] = React.useState(false);
  const [newToolName, setNewToolName] = React.useState('');
  const [newToolExec, setNewToolExec] = React.useState('');
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
              onClick={() => setIsAddWatcherOpen(true)}
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
                <span>Status & Actions</span>
              </div>
              <div className="divide-y divide-[#393B40]/40 p-1">
                {fileWatchersList.map((watcher) => (
                  <div key={watcher.id} className="px-2 py-2 flex items-center justify-between hover:bg-[#35373B]/40">
                    <span className="font-medium text-white">{watcher.name}</span>
                    <span className="text-[#868A91] font-mono text-[11px]">{watcher.pattern}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[#59A869] text-[11px] flex items-center gap-1"><Check size={11} /> Active</span>
                      <button
                        onClick={() => setFileWatchersList(prev => prev.filter(w => w.id !== watcher.id))}
                        className="text-[#868A91] hover:text-[#E05555]"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {isAddWatcherOpen && (
              <div className="p-3 bg-[#26282B] border border-[#393B40] rounded space-y-2.5">
                <div className="font-semibold text-white">Add New File Watcher</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Watcher Name (e.g. ESLint Auto-Fix)"
                    value={newWatcherName}
                    onChange={(e) => setNewWatcherName(e.target.value)}
                    className="bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none"
                  />
                  <input
                    type="text"
                    placeholder="File Glob (e.g. *.ts,*.tsx)"
                    value={newWatcherPattern}
                    onChange={(e) => setNewWatcherPattern(e.target.value)}
                    className="bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none font-mono text-[11px]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (newWatcherName.trim() && newWatcherPattern.trim()) {
                        setFileWatchersList(prev => [...prev, { id: `w_${Date.now()}`, name: newWatcherName.trim(), pattern: newWatcherPattern.trim(), enabled: true }]);
                        setNewWatcherName('');
                        setNewWatcherPattern('');
                        setIsAddWatcherOpen(false);
                      }
                    }}
                    className="px-3 py-1 bg-[#3574F0] text-white rounded text-xs"
                  >
                    Save Watcher
                  </button>
                  <button onClick={() => setIsAddWatcherOpen(false)} className="px-3 py-1 bg-[#35373B] text-white rounded text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            )}
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
              onClick={() => setIsAddToolOpen(true)}
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
                <span>Menu Location & Actions</span>
              </div>
              <div className="divide-y divide-[#393B40]/40 p-1">
                {externalToolsList.map((tool) => (
                  <div key={tool.id} className="px-2 py-2 flex items-center justify-between hover:bg-[#35373B]/40">
                    <span className="font-medium text-white">{tool.name}</span>
                    <span className="text-[#868A91] font-mono text-[11px]">{tool.exec}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[#A5C0EE] text-[11px]">{tool.menu}</span>
                      <button
                        onClick={() => setExternalToolsList(prev => prev.filter(t => t.id !== tool.id))}
                        className="text-[#868A91] hover:text-[#E05555]"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {isAddToolOpen && (
              <div className="p-3 bg-[#26282B] border border-[#393B40] rounded space-y-2.5">
                <div className="font-semibold text-white">Add New External Tool</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Tool Name (e.g. Docker CLI)"
                    value={newToolName}
                    onChange={(e) => setNewToolName(e.target.value)}
                    className="bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Program executable (e.g. docker.exe)"
                    value={newToolExec}
                    onChange={(e) => setNewToolExec(e.target.value)}
                    className="bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none font-mono text-[11px]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (newToolName.trim() && newToolExec.trim()) {
                        setExternalToolsList(prev => [...prev, { id: `t_${Date.now()}`, name: newToolName.trim(), exec: newToolExec.trim(), menu: 'Tools | External Tools' }]);
                        setNewToolName('');
                        setNewToolExec('');
                        setIsAddToolOpen(false);
                      }
                    }}
                    className="px-3 py-1 bg-[#3574F0] text-white rounded text-xs"
                  >
                    Save Tool
                  </button>
                  <button onClick={() => setIsAddToolOpen(false)} className="px-3 py-1 bg-[#35373B] text-white rounded text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-page: Tools > SonarQube for IDE > Project Settings */}
      {(selectedId === 'tools-sonarqube' || selectedId === 'tools-sonarqube-parent') && (
        <SonarQubeSettingsPanel onShowToast={onShowToast} />
      )}
    </div>
  );
};

const SonarQubeSettingsPanel: React.FC<{ onShowToast?: (t: string, m: string, type?: any) => void }> = ({ onShowToast }) => {
  const [topTab, setTopTab] = React.useState<'analysis' | 'languages'>('analysis');
  const [subTab, setSubTab] = React.useState<'bind' | 'exclusions'>('bind');

  const [connections, setConnections] = React.useState<SonarConnection[]>(getSavedSonarConnections);
  const [binding, setBinding] = React.useState<SonarProjectBinding>(getSavedSonarBinding);

  // Configure Connection Modal
  const [isConfigConnOpen, setIsConfigConnOpen] = React.useState(false);
  const [editingConn, setEditingConn] = React.useState<SonarConnection | null>(null);
  const [testingConn, setTestingConn] = React.useState(false);
  const [connTestResult, setConnTestResult] = React.useState<{ success: boolean; message: string } | null>(null);

  // Search Project in List Modal
  const [isSearchProjectOpen, setIsSearchProjectOpen] = React.useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = React.useState('');
  const [searchingProjects, setSearchingProjects] = React.useState(false);
  const [projectList, setProjectList] = React.useState<Array<{ key: string; name: string }>>([
    { key: 'mic-fe-personal-pre', name: 'mic-fe-personal-pre (Frontend Portal)' },
    { key: 'mic-vehicles', name: 'ins-vehicles (Vehicles Backend Service)' },
    { key: 'mic-core', name: 'mic-core (Core Banking & Insurance)' },
    { key: 'mic-bpm-engine', name: 'mic-bpm-engine (Workflow BPMN Service)' },
  ]);

  // Exclusion pattern state
  const [newExclusionPattern, setNewExclusionPattern] = React.useState('');

  const activeConnection = connections.find(c => c.id === binding.connectionId) || connections[0];

  const handleUpdateBinding = (updates: Partial<SonarProjectBinding>) => {
    const next = { ...binding, ...updates };
    setBinding(next);
    saveSonarBinding(next);
  };

  const handleOpenConfigConn = () => {
    setEditingConn(activeConnection ? { ...activeConnection } : {
      id: `conn-${Date.now()}`,
      name: 'Sonar',
      serverUrl: 'https://sonar-dev-bpm.mic.vn',
      token: '',
    });
    setConnTestResult(null);
    setIsConfigConnOpen(true);
  };

  const handleSaveConnection = () => {
    if (!editingConn) return;
    const exists = connections.some(c => c.id === editingConn.id);
    let updated: SonarConnection[];
    if (exists) {
      updated = connections.map(c => c.id === editingConn.id ? editingConn : c);
    } else {
      updated = [...connections, editingConn];
    }
    setConnections(updated);
    saveSonarConnections(updated);
    handleUpdateBinding({ connectionId: editingConn.id });
    setIsConfigConnOpen(false);
    onShowToast?.('Connection Saved', `SonarQube connection "${editingConn.name}" saved.`, 'success');
  };

  const handleTestConnection = async () => {
    if (!editingConn) return;
    setTestingConn(true);
    setConnTestResult(null);
    try {
      const res = await checkSonarServer(editingConn.serverUrl);
      setConnTestResult({
        success: true,
        message: `Connected successfully to SonarQube ${res.version || ''} (Server Status: ${res.status || 'UP'})`,
      });
      onShowToast?.('SonarQube Connected', `Server is UP (version ${res.version})`, 'success');
    } catch (e: any) {
      setConnTestResult({
        success: false,
        message: `Connection failed: ${String(e.message || e)}`,
      });
      onShowToast?.('Connection Failed', String(e), 'error');
    } finally {
      setTestingConn(false);
    }
  };

  const handleOpenSearchProjects = async () => {
    setIsSearchProjectOpen(true);
    setSearchingProjects(true);
    try {
      if (activeConnection) {
        const found = await searchSonarProjects(activeConnection.serverUrl, activeConnection.token);
        if (found.length > 0) {
          setProjectList(found);
        }
      }
    } catch (_) {}
    finally {
      setSearchingProjects(false);
    }
  };

  const handleAddExclusion = () => {
    const trimmed = newExclusionPattern.trim();
    if (!trimmed) return;
    const current = binding.fileExclusions || [];
    if (!current.includes(trimmed)) {
      handleUpdateBinding({ fileExclusions: [...current, trimmed] });
      setNewExclusionPattern('');
      onShowToast?.('Exclusion Added', `Added exclusion pattern "${trimmed}"`, 'info');
    }
  };

  const handleRemoveExclusion = (pattern: string) => {
    const current = binding.fileExclusions || [];
    handleUpdateBinding({ fileExclusions: current.filter(p => p !== pattern) });
  };

  return (
    <div className="text-xs text-[#DFE1E5] flex flex-col h-full font-sans max-w-4xl">
      {/* ─── Top Tabs: Analysis Properties / Supported Languages & Analyzers (Image 1) ─── */}
      <div className="flex items-center gap-6 border-b border-[#2B2D30] pb-1.5 mb-4 select-none">
        <button
          onClick={() => setTopTab('analysis')}
          className={`text-xs font-semibold pb-1 cursor-pointer transition-colors ${
            topTab === 'analysis'
              ? 'text-white border-b-2 border-[#3574F0]'
              : 'text-[#868A91] hover:text-[#DFE1E5]'
          }`}
        >
          Analysis Properties
        </button>
        <button
          onClick={() => setTopTab('languages')}
          className={`text-xs font-semibold pb-1 cursor-pointer transition-colors ${
            topTab === 'languages'
              ? 'text-white border-b-2 border-[#3574F0]'
              : 'text-[#868A91] hover:text-[#DFE1E5]'
          }`}
        >
          Supported Languages & Analyzers
        </button>
      </div>

      {/* ─── Tab Content: Analysis Properties ─── */}
      {topTab === 'analysis' && (
        <div className="space-y-4">
          {/* Sub-tabs: Bind to SonarQube / File Exclusions (Image 1) */}
          <div className="flex items-center gap-6 border-b border-[#2B2D30] pb-1 select-none">
            <button
              onClick={() => setSubTab('bind')}
              className={`text-xs pb-1 cursor-pointer transition-colors ${
                subTab === 'bind'
                  ? 'text-[#DFE1E5] font-semibold border-b-2 border-[#3574F0]'
                  : 'text-[#868A91] hover:text-[#DFE1E5]'
              }`}
            >
              Bind to SonarQube (Server, Cloud)
            </button>
            <button
              onClick={() => setSubTab('exclusions')}
              className={`text-xs pb-1 cursor-pointer transition-colors ${
                subTab === 'exclusions'
                  ? 'text-[#DFE1E5] font-semibold border-b-2 border-[#3574F0]'
                  : 'text-[#868A91] hover:text-[#DFE1E5]'
              }`}
            >
              File Exclusions
            </button>
          </div>

          {/* Sub-tab 1: Bind to SonarQube (Server, Cloud) */}
          {subTab === 'bind' && (
            <div className="space-y-4 pt-1">
              {/* Description matching Image 1 */}
              <p className="text-[#868A91] text-xs leading-relaxed">
                Complete your Connected Mode setup by binding your local project to your SonarQube (Server, Cloud) project to benefit from the same rules and settings that are used to inspect the project on the server.
              </p>

              {/* Checkbox: Bind project to SonarQube (Server, Cloud) */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={binding.bindEnabled}
                    onChange={(e) => handleUpdateBinding({ bindEnabled: e.target.checked })}
                    className="accent-[#3574F0] w-4 h-4 rounded cursor-pointer"
                  />
                  <span className="text-xs text-[#DFE1E5] font-medium">Bind project to SonarQube (Server, Cloud)</span>
                </label>

                <button
                  onClick={() => {
                    onShowToast?.('Connected Mode', 'Project binding configuration shared to .sonarlint/connectedMode.json', 'success');
                  }}
                  disabled={!binding.bindEnabled}
                  className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] disabled:opacity-40 text-[#DFE1E5] border border-[#393B40] rounded text-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  Share configuration...
                </button>
              </div>

              {/* Form Controls: Connection and Project Key (Image 1 Red Box) */}
              <div className={`space-y-3 pt-2 ${!binding.bindEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                {/* Connection Row */}
                <div className="flex items-center gap-3">
                  <span className="w-24 text-right text-xs text-[#868A91] shrink-0">Connection:</span>
                  <div className="flex-1 relative flex items-center">
                    <div className="absolute left-2.5 text-[#868A91]">
                      <LinkIcon size={13} className="rotate-45 text-[#3574F0]" />
                    </div>
                    <select
                      value={binding.connectionId}
                      onChange={(e) => handleUpdateBinding({ connectionId: e.target.value })}
                      className="w-full bg-[#2B2D30] border border-[#393B40] rounded pl-8 pr-3 py-1.5 text-xs text-[#DFE1E5] outline-none focus:border-[#3574F0]"
                    >
                      {connections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.serverUrl})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleOpenConfigConn}
                    className="px-3 py-1.5 bg-[#2B2D30] hover:bg-[#35373B] text-[#DFE1E5] border border-[#393B40] rounded text-xs transition-colors cursor-pointer shrink-0"
                  >
                    Configure the connection...
                  </button>
                </div>

                {/* Project Key Row */}
                <div className="flex items-center gap-3">
                  <span className="w-24 text-right text-xs text-[#868A91] shrink-0">Project key:</span>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={binding.projectKey}
                      onChange={(e) => handleUpdateBinding({ projectKey: e.target.value })}
                      placeholder="e.g. mic-fe-personal-pre or mic-vehicles"
                      className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none focus:border-[#3574F0]"
                    />
                  </div>
                  <button
                    onClick={handleOpenSearchProjects}
                    className="px-3 py-1.5 bg-[#2B2D30] hover:bg-[#35373B] text-[#DFE1E5] border border-[#393B40] rounded text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                  >
                    <Search size={12} className="text-[#868A91]" />
                    <span>Search in list...</span>
                  </button>
                </div>
              </div>

              {/* Connection Status Badge */}
              {activeConnection && (
                <div className="mt-4 p-3 bg-[#25272B] border border-[#393B40] rounded flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#59A869]" />
                    <span className="text-[#DFE1E5] font-medium">Bound Server:</span>
                    <span className="text-[#85B1F8] font-mono">{activeConnection.serverUrl}</span>
                  </div>
                  <span className="text-[#868A91] font-mono text-[11px]">
                    Project: <b className="text-white">{binding.projectKey}</b>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 2: File Exclusions */}
          {subTab === 'exclusions' && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-[#868A91]">
                Files matching these glob patterns will be excluded from SonarQube on-the-fly and background inspections:
              </p>

              <div className="border border-[#393B40] rounded bg-[#25272B] overflow-hidden">
                <div className="h-7 bg-[#2B2D30] px-3 flex items-center text-[11px] font-semibold text-[#868A91] border-b border-[#393B40]">
                  <span>Pattern Exclusions</span>
                </div>
                <div className="divide-y divide-[#393B40] max-h-48 overflow-y-auto">
                  {(binding.fileExclusions || []).map((pat) => (
                    <div key={pat} className="px-3 py-1.5 flex items-center justify-between hover:bg-[#2B2D30] text-xs">
                      <span className="font-mono text-[#DFE1E5]">{pat}</span>
                      <button
                        onClick={() => handleRemoveExclusion(pat)}
                        className="text-[#868A91] hover:text-[#E05555] p-1 rounded"
                        title="Remove pattern"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newExclusionPattern}
                  onChange={(e) => setNewExclusionPattern(e.target.value)}
                  placeholder="e.g. **/*.min.js or **/generated/**"
                  className="flex-1 bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none focus:border-[#3574F0]"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddExclusion()}
                />
                <button
                  onClick={handleAddExclusion}
                  className="px-3 py-1.5 bg-[#2B2D30] hover:bg-[#35373B] text-white border border-[#393B40] rounded text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} />
                  <span>Add Pattern</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab Content: Supported Languages & Analyzers ─── */}
      {topTab === 'languages' && (
        <div className="space-y-4 pt-1">
          <p className="text-xs text-[#868A91]">
            SonarQube for IDE natively supports real-time analysis for multiple languages directly in the editor:
          </p>

          <div className="border border-[#393B40] rounded bg-[#25272B] overflow-hidden">
            <div className="grid grid-cols-3 h-8 bg-[#2B2D30] px-3 items-center text-[11px] font-semibold text-[#868A91] border-b border-[#393B40]">
              <span>Language / Framework</span>
              <span>Active Analyzer</span>
              <span className="text-right">Rules Count</span>
            </div>
            <div className="divide-y divide-[#393B40] text-xs">
              {[
                { lang: 'Java (Spring Boot / Jakarta EE)', analyzer: 'SonarJava (Embedded AST Engine)', rules: '620+ rules' },
                { lang: 'JavaScript & TypeScript (Vue, React, Node)', analyzer: 'SonarJS / TypeScript Analyzer', rules: '380+ rules' },
                { lang: 'HTML & Vue Templates', analyzer: 'SonarHTML / Vue Component Inspector', rules: '95+ rules' },
                { lang: 'CSS, SCSS & Less', analyzer: 'SonarCSS Linter', rules: '85+ rules' },
                { lang: 'XML & Maven POM', analyzer: 'SonarXML Syntax & Structure Inspector', rules: '45+ rules' },
                { lang: 'SQL / PLSQL', analyzer: 'SonarSQL Security & Syntax Analyzer', rules: '120+ rules' },
                { lang: 'Docker & Kubernetes Manifests', analyzer: 'SonarIaC / Dockerfile Rules', rules: '60+ rules' },
                { lang: 'Rust', analyzer: 'Rust Analyzer / Clippy Bridge', rules: '450+ lints' },
              ].map((item) => (
                <div key={item.lang} className="grid grid-cols-3 px-3 py-2 items-center hover:bg-[#2B2D30]">
                  <span className="font-medium text-white flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-[#59A869]" />
                    <span>{item.lang}</span>
                  </span>
                  <span className="text-[#868A91] text-[11px] font-mono">{item.analyzer}</span>
                  <span className="text-right text-[#59A869] font-mono text-[11px]">{item.rules}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 1: Configure Connection Dialog ─── */}
      {isConfigConnOpen && editingConn && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
            <div className="h-10 px-4 bg-[#25272B] border-b border-[#393B40] flex items-center justify-between">
              <span className="font-semibold text-xs text-white">SonarQube Server Connection</span>
              <button
                onClick={() => setIsConfigConnOpen(false)}
                className="text-[#868A91] hover:text-white p-1 rounded"
              >
                <X size={13} />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="text-[#868A91] block mb-1">Connection Name:</label>
                <input
                  type="text"
                  value={editingConn.name}
                  onChange={(e) => setEditingConn({ ...editingConn, name: e.target.value })}
                  placeholder="e.g. Sonar"
                  className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#3574F0]"
                />
              </div>

              <div>
                <label className="text-[#868A91] block mb-1">SonarQube Server URL:</label>
                <input
                  type="text"
                  value={editingConn.serverUrl}
                  onChange={(e) => setEditingConn({ ...editingConn, serverUrl: e.target.value })}
                  placeholder="https://sonar-dev-bpm.mic.vn"
                  className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-[#3574F0]"
                />
              </div>

              <div>
                <label className="text-[#868A91] block mb-1">User Authentication Token:</label>
                <input
                  type="password"
                  value={editingConn.token}
                  onChange={(e) => setEditingConn({ ...editingConn, token: e.target.value })}
                  placeholder="sqp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-[#3574F0]"
                />
                <span className="text-[10px] text-[#868A91] mt-1 block">
                  Generate in SonarQube &gt; My Account &gt; Security &gt; Tokens
                </span>
              </div>

              {connTestResult && (
                <div
                  className={`p-2.5 rounded text-[11px] font-mono border ${
                    connTestResult.success
                      ? 'bg-[#59A869]/10 border-[#59A869]/30 text-[#71C482]'
                      : 'bg-[#E05555]/10 border-[#E05555]/30 text-[#FF8585]'
                  }`}
                >
                  {connTestResult.message}
                </div>
              )}
            </div>

            <div className="h-12 bg-[#25272B] border-t border-[#393B40] px-4 flex items-center justify-between">
              <button
                onClick={handleTestConnection}
                disabled={testingConn}
                className="px-3 py-1.5 bg-[#1E1F22] hover:bg-[#35373B] text-white border border-[#393B40] rounded text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {testingConn ? 'Testing...' : 'Test Connection'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsConfigConnOpen(false)}
                  className="px-3 py-1.5 hover:bg-[#35373B] text-[#DFE1E5] rounded text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConnection}
                  className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#3068D9] text-white rounded text-xs font-medium transition-colors cursor-pointer"
                >
                  Save Connection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 2: Search Project in List Dialog ─── */}
      {isSearchProjectOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 max-h-[80vh]">
            <div className="h-10 px-4 bg-[#25272B] border-b border-[#393B40] flex items-center justify-between">
              <span className="font-semibold text-xs text-white">Select SonarQube Project</span>
              <button
                onClick={() => setIsSearchProjectOpen(false)}
                className="text-[#868A91] hover:text-white p-1 rounded"
              >
                <X size={13} />
              </button>
            </div>

            <div className="p-3 border-b border-[#393B40]">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-[#868A91]" />
                <input
                  type="text"
                  value={projectSearchQuery}
                  onChange={(e) => setProjectSearchQuery(e.target.value)}
                  placeholder="Filter projects by key or name..."
                  className="w-full bg-[#1E1F22] border border-[#393B40] rounded pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-[#3574F0]"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#393B40] p-1 text-xs">
              {searchingProjects ? (
                <div className="p-6 text-center text-[#868A91]">Fetching projects from server...</div>
              ) : (
                projectList
                  .filter(
                    (p) =>
                      !projectSearchQuery ||
                      p.key.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                      p.name.toLowerCase().includes(projectSearchQuery.toLowerCase())
                  )
                  .map((p) => (
                    <div
                      key={p.key}
                      onClick={() => {
                        handleUpdateBinding({ projectKey: p.key });
                        setIsSearchProjectOpen(false);
                        onShowToast?.('Project Bound', `Selected project key: ${p.key}`, 'success');
                      }}
                      className="p-2.5 hover:bg-[#3574F0] hover:text-white rounded cursor-pointer transition-colors group flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-white group-hover:text-white">{p.name}</div>
                        <div className="text-[11px] text-[#868A91] group-hover:text-blue-100 font-mono">{p.key}</div>
                      </div>
                      {binding.projectKey === p.key && (
                        <Check size={14} className="text-[#59A869] group-hover:text-white" />
                      )}
                    </div>
                  ))
              )}
            </div>

            <div className="h-11 bg-[#25272B] border-t border-[#393B40] px-4 flex items-center justify-end">
              <button
                onClick={() => setIsSearchProjectOpen(false)}
                className="px-3 py-1.5 hover:bg-[#35373B] text-[#DFE1E5] rounded text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
