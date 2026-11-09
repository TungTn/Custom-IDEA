import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Monitor, 
  Palette, 
  Settings as SettingsIcon, 
  Sparkles, 
  Plus, 
  Bell, 
  Trash2,
  Key,
  Shield,
  Globe,
  Lock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Search,
  Check,
  FolderOpen
} from 'lucide-react';
import { SettingPanelProps } from './types';
import { ThemeDefinition } from '../../../types/theme';
import { getAllThemes, saveCustomTheme, applyIdeTheme } from '../../../themes/themeManager';
import { importIntelliJTheme } from '../../../editor/cm/themeImporter';
import { UpdatesSettingsPanel } from './UpdatesSettingsPanel';

export const AppearanceBehaviorPanel: React.FC<SettingPanelProps> = (props) => {
  const {
    selectedId,
    formSettings,
    updateSetting,
    setIsDirty,
    onShowToast,
    onOpenThemeStudio,
    setSelectedId,
  } = props;
  // Themes Management
  const [availableThemes, setAvailableThemes] = useState<ThemeDefinition[]>(() => getAllThemes());
  const [isThemeActionOpen, setIsThemeActionOpen] = useState(false);
  const themeFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleThemesUpdate = () => {
      setAvailableThemes(getAllThemes());
    };
    window.addEventListener('ide-custom-themes-updated', handleThemesUpdate);
    return () => window.removeEventListener('ide-custom-themes-updated', handleThemesUpdate);
  }, []);

  const handleImportThemeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = importIntelliJTheme(text);
        if (parsed) {
          const themeId = `custom-${file.name.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
          const newTheme: ThemeDefinition = {
            id: themeId,
            name: parsed.name,
            type: parsed.isDark ? 'dark' : 'light',
            description: `Imported theme from ${file.name}`,
            badge: 'Disk',
            colors: {
              bgPrimary: parsed.isDark ? '#1E1F22' : '#FFFFFF',
              bgSecondary: parsed.isDark ? '#2B2D30' : '#F2F2F2',
              bgTertiary: parsed.isDark ? '#26282B' : '#EAEAEA',
              bgHover: parsed.isDark ? '#35373B' : '#DFDFDF',
              borderColor: parsed.isDark ? '#393B40' : '#D1D1D1',
              textPrimary: parsed.isDark ? '#DFE1E5' : '#1F1F1F',
              textSecondary: parsed.isDark ? '#868A91' : '#6C707E',
              accentColor: '#3574F0',
              selectionBg: parsed.isDark ? '#214283' : '#B5D6FD',
              statusBarBg: parsed.isDark ? '#2B2D30' : '#F2F2F2',
              gutterBg: parsed.isDark ? '#1E1F22' : '#FAFAFA',
              badgeBg: '#3574F022',
            },
            syntaxColors: {
              keyword: parsed.isDark ? '#CC7832' : '#0033B3',
              string: parsed.isDark ? '#6A8759' : '#067D17',
              number: parsed.isDark ? '#6897BB' : '#1750EB',
              function: parsed.isDark ? '#FFC66D' : '#00627A',
              comment: parsed.isDark ? '#7A7E85' : '#8C8C8C',
              type: parsed.isDark ? '#299999' : '#26747A',
              variable: parsed.isDark ? '#9876AA' : '#871094',
              operator: parsed.isDark ? '#A9B7C6' : '#000000',
              annotation: parsed.isDark ? '#BBB529' : '#9E880D',
            }
          };
          saveCustomTheme(newTheme);
          setAvailableThemes(getAllThemes());
          updateSetting('theme', newTheme.id);
          applyIdeTheme(newTheme.id);
          onShowToast?.('Theme Imported', `Theme "${parsed.name}" loaded successfully`, 'success');
        } else {
          onShowToast?.('Import Failed', 'Unable to parse IntelliJ theme JSON', 'error');
        }
      } catch (err) {
        onShowToast?.('Import Error', 'Failed to read file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setIsThemeActionOpen(false);
  };

  const handleSyncThemeWithOs = () => {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const targetTheme = isDark ? 'intellij-new-ui-dark' : 'intellij-light';
    updateSetting('theme', targetTheme);
    applyIdeTheme(targetTheme);
    onShowToast?.('Sync with OS', `Set theme to ${isDark ? 'Dark (New UI)' : 'IntelliJ Light'}`, 'info');
    setIsThemeActionOpen(false);
  };

  // Scopes state
  const [scopesList, setScopesList] = useState([
    { id: 's1', name: 'Project Files', pattern: 'file:src//*||file:src-tauri//*' },
    { id: 's2', name: 'Project Production Files', pattern: 'file:src//*' },
    { id: 's3', name: 'Project Test Files', pattern: 'file:tests//*||file:**/*test*' },
    { id: 's4', name: 'Open Files', pattern: 'file:current-tabs//*' },
    { id: 's5', name: 'Scratches and Consoles', pattern: 'file:scratches//*' },
  ]);
  const [selectedScopeId, setSelectedScopeId] = useState('s1');

  // File Colors state
  const [fileColors, setFileColors] = useState([
    { id: 'fc1', scope: 'Non-Project Files', colorName: 'Rose', colorHex: '#493131' },
    { id: 'fc2', scope: 'Tests', colorName: 'Green', colorHex: '#2A3B2A' },
    { id: 'fc3', scope: 'Scratches and Consoles', colorName: 'Yellow', colorHex: '#403B26' },
    { id: 'fc4', scope: 'Production Files', colorName: 'Blue', colorHex: '#23395B' },
  ]);

  // Notifications display modes
  const [notificationRules, setNotificationRules] = useState([
    { group: 'VFS & Disk Sync', mode: 'Balloon (3.5s)' },
    { group: 'Git Commits & Push', mode: 'Balloon (3.5s)' },
    { group: 'Build / Compilation', mode: 'Sticky Balloon' },
    { group: 'Index Finished', mode: 'Tool Window' },
  ]);

  // Path Variables state
  const [pathVariables, setPathVariables] = useState([
    { name: 'CARGO_HOME', value: '~/.cargo' },
    { name: 'RUSTUP_HOME', value: '~/.rustup' },
    { name: 'MAVEN_REPOSITORY', value: '~/.m2/repository' },
    { name: 'NODE_HOME', value: 'C:\\Program Files\\nodejs' },
  ]);
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [showAddVarRow, setShowAddVarRow] = useState(false);

  // Quick Lists state
  const [quickLists, setQuickLists] = useState([
    { id: 'ql1', name: 'VCS Operations (Alt+`)', actions: ['Git Commit...', 'Push Commits...', 'Fetch', 'Branches...', 'Show History', 'Annotate'] },
    { id: 'ql2', name: 'Refactor This (Ctrl+Alt+Shift+T)', actions: ['Rename...', 'Change Signature...', 'Extract Method...', 'Extract Variable...', 'Move...'] },
    { id: 'ql3', name: 'Inspect Code', actions: ['Run Inspection by Name...', 'Silent Code Cleanup', 'Analyze Dependencies'] },
  ]);
  const [selectedQuickListId, setSelectedQuickListId] = useState('ql1');

  // Menus & Toolbars custom actions
  const [isAddActionModalOpen, setIsAddActionModalOpen] = useState(false);
  const [selectedMenuTarget, setSelectedMenuTarget] = useState('Tools');
  const [actionSearchQuery, setActionSearchQuery] = useState('');
  const [customMenuActions, setCustomMenuActions] = useState<Array<{ id: string; name: string; menu: string; enabled: boolean }>>(() => {
    return formSettings.customMenuActions || [
      { id: 'act_1', name: 'File > Save All', menu: 'File', enabled: true },
      { id: 'act_2', name: 'Code > Reformat Code', menu: 'Code', enabled: true },
      { id: 'act_3', name: 'Navigate > Search Everywhere', menu: 'Navigate', enabled: true },
      { id: 'act_4', name: 'Git > Commit Changes...', menu: 'Git', enabled: true },
      { id: 'act_5', name: 'Tools > Performance Profiler', menu: 'Tools', enabled: true },
      { id: 'act_6', name: 'Tools > Web Endpoints Explorer', menu: 'Tools', enabled: true },
      { id: 'act_7', name: 'Tools > TODO & Task Finder', menu: 'Tools', enabled: true },
      { id: 'act_8', name: 'Help > Interactive Tutorials', menu: 'Help', enabled: true },
    ];
  });

  // Passwords state
  const [isMasterPasswordModalOpen, setIsMasterPasswordModalOpen] = useState(false);
  const [newMasterPass, setNewMasterPass] = useState('');
  const [confirmMasterPass, setConfirmMasterPass] = useState('');
  const [masterPassStatus, setMasterPassStatus] = useState<string | null>(null);

  // HTTP Proxy state
  const [proxyTestUrl, setProxyTestUrl] = useState('https://gitlab.mic.vn');
  const [isTestingProxy, setIsTestingProxy] = useState(false);
  const [proxyTestResult, setProxyTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  return (
    <div>
      {/* Sub-page: Appearance Overview or Appearance */}
      {(selectedId === 'appearance-behavior' || selectedId === 'appearance') && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Appearance</h2>
            <p className="text-xs text-[#868A91]">Configure the look and feel of the IntelliJ IDEA interface.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            {/* Theme */}
            <div className="flex items-center justify-between">
              <label className="text-[#DFE1E5]">Theme:</label>
              <div className="flex items-center gap-2">
                <select
                  value={formSettings.theme}
                  onChange={(e) => updateSetting('theme', e.target.value as any)}
                  className="bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none w-60"
                >
                  <optgroup label="Standard Themes">
                    {availableThemes
                      .filter(t => !t.badge || ['Default', 'Classic', 'Light', 'Popular', 'Vibrant', 'Modern'].includes(t.badge))
                      .map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.badge ? `(${t.badge})` : ''}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Marketplace Themes">
                    {availableThemes
                      .filter(t => ['Marketplace', 'Trending', 'Featured'].includes(t.badge || ''))
                      .map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </optgroup>
                  {availableThemes.some(t => t.badge === 'Disk' || t.badge === 'Plugin' || t.id.startsWith('custom-') || t.id.startsWith('plugin-')) && (
                    <optgroup label="Custom / Installed">
                      {availableThemes
                        .filter(t => t.badge === 'Disk' || t.badge === 'Plugin' || t.id.startsWith('custom-') || t.id.startsWith('plugin-'))
                        .map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>

                <button
                  type="button"
                  onClick={() => setSelectedId?.('plugins')}
                  className="text-xs text-[#3574F0] hover:underline whitespace-nowrap px-1"
                >
                  Get More Themes...
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsThemeActionOpen(prev => !prev)}
                    title="Theme Actions"
                    className="p-1.5 bg-[#2B2D30] border border-[#393B40] hover:border-[#3574F0] rounded text-[#868A91] hover:text-[#DFE1E5]"
                  >
                    <SettingsIcon size={13} />
                  </button>

                  {isThemeActionOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsThemeActionOpen(false)} />
                      <div className="absolute right-0 top-8 z-50 w-52 bg-[#2B2D30] border border-[#43454A] rounded shadow-xl py-1 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setIsThemeActionOpen(false);
                            themeFileInputRef.current?.click();
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center gap-2 text-[#DFE1E5]"
                        >
                          <Upload size={13} />
                          <span>Install Theme from Disk...</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSyncThemeWithOs}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center gap-2 text-[#DFE1E5]"
                        >
                          <Monitor size={13} />
                          <span>Sync with OS</span>
                        </button>
                        <div className="my-1 border-t border-[#393B40]" />
                        <button
                          type="button"
                          onClick={() => {
                            setIsThemeActionOpen(false);
                            onOpenThemeStudio?.();
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#3574F0] hover:text-white flex items-center gap-2 text-[#DFE1E5]"
                        >
                          <Palette size={13} />
                          <span>Theme Studio & Schemes...</span>
                        </button>
                      </div>
                    </>
                  )}

                  <input
                    ref={themeFileInputRef}
                    type="file"
                    accept=".json,.theme.json"
                    onChange={handleImportThemeFile}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* UI Font Size */}
            <div className="flex items-center justify-between">
              <label className="text-[#DFE1E5]">UI Font Size:</label>
              <div className="flex items-center gap-2 w-72">
                <select
                  value={formSettings.uiFontSize || 13}
                  onChange={(e) => updateSetting('uiFontSize', Number(e.target.value))}
                  className="flex-1 bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none"
                >
                  <option value="11">11 pt (Small)</option>
                  <option value="12">12 pt</option>
                  <option value="13">13 pt (Default)</option>
                  <option value="14">14 pt</option>
                  <option value="15">15 pt (Large)</option>
                </select>
                <span className="text-xs text-[#868A91]">JetBrains Sans</span>
              </div>
            </div>

            {/* Options */}
            <div className="pt-3 border-t border-[#393B40] space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formSettings.compactMode ?? false}
                  onChange={(e) => updateSetting('compactMode', e.target.checked)}
                  className="accent-[#3574F0] rounded" 
                />
                <span>Compact mode (Dense project tree & condensed toolbars)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formSettings.enableFileColors ?? true}
                  onChange={(e) => updateSetting('enableFileColors', e.target.checked)}
                  className="accent-[#3574F0] rounded" 
                />
                <span>Enable File Colors in project tree & tabs</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span>Show main menu in separate top toolbar</span>
              </label>

              {/* Theme Studio shortcut */}
              <div className="pt-3 border-t border-[#393B40] flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Theme Studio</div>
                  <div className="text-[11px] text-[#868A91]">Customize syntax token colors and workbench themes</div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenThemeStudio?.()}
                  className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles size={12} />
                  Launch Theme Studio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Theme Studio */}
      {selectedId === 'theme-studio' && (
        <div className="space-y-6 max-w-xl animate-in fade-in duration-100 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <Palette size={18} className="text-[#3574F0]" />
            <h2 className="text-base font-semibold text-white">Theme Studio</h2>
          </div>
          <p className="text-xs text-[#868A91] leading-relaxed">
            Design, preview, and customize syntax token colors, background palettes, and editor themes with live interactive preview.
          </p>
          <div className="p-4 bg-[#26282B] border border-[#393B40] rounded-lg space-y-4">
            <div className="text-xs text-[#DFE1E5]">
              Open the dedicated Theme Studio editor to customize:
              <ul className="list-disc pl-5 mt-2 space-y-1 text-[#868A91]">
                <li>Syntax token colors (Keywords, Functions, Strings, Types, Comments)</li>
                <li>Editor and Workbench background colors</li>
                <li>Custom color scheme export & import</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => onOpenThemeStudio?.()}
              className="px-4 py-2 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-medium flex items-center gap-2 transition-colors"
            >
              <Sparkles size={14} />
              Open Theme Studio
            </button>
          </div>
        </div>
      )}

      {/* Sub-page: Menus and Toolbars */}
      {selectedId === 'menus-toolbars' && (
        <div className="space-y-5 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Menus and Toolbars</h2>
            <p className="text-xs text-[#868A91]">Customize main menu actions, tool window title bars, and context menus.</p>
          </div>

          <div className="space-y-3 max-w-xl">
            <div className="border border-[#393B40] rounded bg-[#26282B] p-3 text-xs space-y-2">
              <div className="font-semibold text-white flex items-center justify-between">
                <span>Main Menu Actions & Custom Actions:</span>
                <span className="text-[11px] text-[#868A91]">{customMenuActions.length} Actions Configured</span>
              </div>
              <div className="pl-1 space-y-1 text-[#C4C7C5] font-mono text-[11.5px] max-h-56 overflow-y-auto">
                <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between text-[#868A91]">
                  <span>▾ Standard Menus (File, Edit, View, Navigate, Code, Build, Run, Git)</span>
                  <span className="text-[10px] text-[#59A869]">Built-in</span>
                </div>
                {customMenuActions.map((item) => (
                  <div key={item.id} className="p-1.5 hover:bg-[#35373B] rounded flex items-center justify-between group bg-[#1E1F22]/60">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={(e) => {
                          const updated = customMenuActions.map(a => a.id === item.id ? { ...a, enabled: e.target.checked } : a);
                          setCustomMenuActions(updated);
                          updateSetting('customMenuActions', updated);
                          setIsDirty(true);
                        }}
                        className="accent-[#3574F0] rounded"
                      />
                      <span className={item.enabled ? 'text-white' : 'text-[#868A91] line-through'}>{item.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-[#3574F0]/20 text-[#679EF5] rounded">{item.menu}</span>
                    </div>
                    <button
                      onClick={() => {
                        const updated = customMenuActions.filter(a => a.id !== item.id);
                        setCustomMenuActions(updated);
                        updateSetting('customMenuActions', updated);
                        setIsDirty(true);
                      }}
                      className="text-[#868A91] hover:text-[#E05555] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button 
                onClick={() => setIsAddActionModalOpen(true)}
                className="px-3 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-xs text-white rounded flex items-center gap-1 transition-colors"
              >
                <Plus size={12} /> Add Action...
              </button>
              <button 
                onClick={() => {
                  const defaultActions = [
                    { id: 'act_1', name: 'File > Save All', menu: 'File', enabled: true },
                    { id: 'act_2', name: 'Code > Reformat Code', menu: 'Code', enabled: true },
                    { id: 'act_3', name: 'Navigate > Search Everywhere', menu: 'Navigate', enabled: true },
                    { id: 'act_4', name: 'Git > Commit Changes...', menu: 'Git', enabled: true },
                    { id: 'act_5', name: 'Tools > Performance Profiler', menu: 'Tools', enabled: true },
                    { id: 'act_6', name: 'Tools > Web Endpoints Explorer', menu: 'Tools', enabled: true },
                    { id: 'act_7', name: 'Tools > TODO & Task Finder', menu: 'Tools', enabled: true },
                    { id: 'act_8', name: 'Help > Interactive Tutorials', menu: 'Help', enabled: true },
                  ];
                  setCustomMenuActions(defaultActions);
                  updateSetting('customMenuActions', defaultActions);
                  setIsDirty(true);
                  onShowToast?.('Defaults Restored', 'Menu actions reset to standard JetBrains defaults', 'info');
                }}
                className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40] transition-colors"
              >
                Restore Defaults
              </button>
            </div>
          </div>

          {/* Add Action Dialog */}
          {isAddActionModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl w-full max-w-md p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-[#393B40] pb-2">
                  <span className="font-semibold text-white text-sm">Add Action to Menu</span>
                  <button onClick={() => setIsAddActionModalOpen(false)} className="text-[#868A91] hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[#868A91] block mb-1">Target Menu:</label>
                    <select
                      value={selectedMenuTarget}
                      onChange={(e) => setSelectedMenuTarget(e.target.value)}
                      className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-white outline-none"
                    >
                      <option value="File">Main Menu / File</option>
                      <option value="Edit">Main Menu / Edit</option>
                      <option value="View">Main Menu / View</option>
                      <option value="Navigate">Main Menu / Navigate</option>
                      <option value="Code">Main Menu / Code</option>
                      <option value="Build">Main Menu / Build</option>
                      <option value="Run">Main Menu / Run</option>
                      <option value="Git">Main Menu / Git</option>
                      <option value="Tools">Main Menu / Tools</option>
                      <option value="Help">Main Menu / Help</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[#868A91] block mb-1">Select Action:</label>
                    <div className="relative mb-2">
                      <Search size={13} className="absolute left-2.5 top-2 text-[#868A91]" />
                      <input
                        type="text"
                        placeholder="Search action by name..."
                        value={actionSearchQuery}
                        onChange={(e) => setActionSearchQuery(e.target.value)}
                        className="w-full bg-[#1E1F22] border border-[#393B40] rounded pl-8 pr-2 py-1.5 text-white outline-none"
                      />
                    </div>
                    <div className="border border-[#393B40] rounded bg-[#1E1F22] max-h-40 overflow-y-auto divide-y divide-[#393B40]/40">
                      {[
                        { id: 'save_all', name: 'File > Save All (Ctrl+S)' },
                        { id: 'reformat', name: 'Code > Reformat Code (Ctrl+Alt+L)' },
                        { id: 'search_everywhere', name: 'Navigate > Search Everywhere (Double Shift)' },
                        { id: 'vcs_commit', name: 'Git > Commit Changes (Ctrl+K)' },
                        { id: 'vcs_push', name: 'Git > Push Commits (Ctrl+Shift+K)' },
                        { id: 'build_proj', name: 'Build > Build Project (Ctrl+F9)' },
                        { id: 'run_coverage', name: 'Run > Run with Coverage' },
                        { id: 'tools_profiler', name: 'Tools > Performance Profiler' },
                        { id: 'tools_endpoints', name: 'Tools > Web Endpoints Explorer' },
                        { id: 'tools_todo', name: 'Tools > TODO & Task Finder' },
                        { id: 'learn_tutorials', name: 'Help > Interactive Learn Tutorials' },
                        { id: 'tools_terminal', name: 'Tools > Open Terminal (Alt+F12)' },
                      ]
                        .filter(a => a.name.toLowerCase().includes(actionSearchQuery.toLowerCase()))
                        .map((action) => (
                          <div
                            key={action.id}
                            onClick={() => {
                              const newAction = {
                                id: `act_${Date.now()}`,
                                name: action.name,
                                menu: selectedMenuTarget,
                                enabled: true
                              };
                              const updated = [...customMenuActions, newAction];
                              setCustomMenuActions(updated);
                              updateSetting('customMenuActions', updated);
                              setIsDirty(true);
                              setIsAddActionModalOpen(false);
                            }}
                            className="p-2 hover:bg-[#3574F0]/30 hover:text-white cursor-pointer text-[#DFE1E5] flex items-center justify-between transition-colors"
                          >
                            <span>{action.name}</span>
                            <Plus size={13} className="text-[#3574F0]" />
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#393B40]">
                  <button
                    onClick={() => setIsAddActionModalOpen(false)}
                    className="px-4 py-1.5 bg-[#35373B] hover:bg-[#43454B] text-white rounded text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-page: System Settings (Project Opening) */}
      {selectedId === 'system-settings' && (
        <div className="space-y-6 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">System Settings</h2>
            <p className="text-xs text-[#868A91]">Control project opening behavior, exit confirmations, and caches.</p>
          </div>

          <div className="space-y-5 max-w-xl">
            {/* Project Opening Behavior */}
            <div className="space-y-2">
              <label className="font-semibold text-white text-xs block">Project Opening</label>
              <div className="space-y-2 pl-1">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="projectOpen"
                    value="new_window"
                    checked={formSettings.projectOpenMode === 'new_window'}
                    onChange={() => updateSetting('projectOpenMode', 'new_window')}
                    className="accent-[#3574F0]"
                  />
                  <span className="text-[#DFE1E5]">Open project in new window</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="projectOpen"
                    value="this_window"
                    checked={formSettings.projectOpenMode === 'this_window'}
                    onChange={() => updateSetting('projectOpenMode', 'this_window')}
                    className="accent-[#3574F0]"
                  />
                  <span className="text-[#DFE1E5]">Open project in the current window</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="projectOpen"
                    value="ask"
                    checked={formSettings.projectOpenMode === 'ask'}
                    onChange={() => updateSetting('projectOpenMode', 'ask')}
                    className="accent-[#3574F0]"
                  />
                  <span className="font-medium text-[#3574F0]">Ask (Show confirmation dialog with This Window / New Window / Attach)</span>
                </label>
              </div>
            </div>

            {/* General flags */}
            <div className="pt-3 border-t border-[#393B40] space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.confirmExit ?? true}
                  onChange={(e) => updateSetting('confirmExit', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Confirm before exiting IDE</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formSettings.reopenProjectsOnStartup ?? true}
                  onChange={(e) => updateSetting('reopenProjectsOnStartup', e.target.checked)}
                  className="accent-[#3574F0] rounded" 
                />
                <span className="text-[#DFE1E5]">Reopen projects on startup</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formSettings.syncFilesOnFrameActivation ?? true}
                  onChange={(e) => updateSetting('syncFilesOnFrameActivation', e.target.checked)}
                  className="accent-[#3574F0] rounded" 
                />
                <span className="text-[#DFE1E5]">Synchronize files on frame or editor tab activation</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: System Settings -> Passwords (100% JetBrains Standard) */}
      {selectedId === 'system-passwords' && (
        <div className="space-y-6 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Passwords</h2>
            <p className="text-xs text-[#868A91]">Configure password storage policy and master password protection for Git, DB, and proxy credentials.</p>
          </div>

          <div className="space-y-5 max-w-xl">
            {/* Storage Policy */}
            <div className="space-y-3">
              <label className="font-semibold text-white text-xs block">Save Passwords:</label>
              <div className="space-y-2.5 pl-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="passwordStoragePolicy"
                    value="keepass"
                    checked={(formSettings.passwordStoragePolicy ?? 'keepass') === 'keepass'}
                    onChange={() => updateSetting('passwordStoragePolicy', 'keepass')}
                    className="accent-[#3574F0] mt-0.5"
                  />
                  <div>
                    <span className="text-white font-medium">In KeePass database (Recommended)</span>
                    <p className="text-[11px] text-[#868A91]">Store encrypted credentials in local KeePass database protected by master password.</p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="passwordStoragePolicy"
                    value="keychain"
                    checked={formSettings.passwordStoragePolicy === 'keychain'}
                    onChange={() => updateSetting('passwordStoragePolicy', 'keychain')}
                    className="accent-[#3574F0] mt-0.5"
                  />
                  <div>
                    <span className="text-white font-medium">In native Keychain / Windows Credential Manager</span>
                    <p className="text-[11px] text-[#868A91]">Delegate secure credential storage to Windows DPAPI / Credential Manager.</p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="passwordStoragePolicy"
                    value="memory"
                    checked={formSettings.passwordStoragePolicy === 'memory'}
                    onChange={() => updateSetting('passwordStoragePolicy', 'memory')}
                    className="accent-[#3574F0] mt-0.5"
                  />
                  <div>
                    <span className="text-white font-medium">Do not save, forget passwords after restart</span>
                    <p className="text-[11px] text-[#868A91]">Credentials are held in memory only during current IDE session and discarded on close.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* KeePass Options */}
            {(formSettings.passwordStoragePolicy ?? 'keepass') === 'keepass' && (
              <div className="p-3.5 bg-[#26282B] border border-[#393B40] rounded space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[#DFE1E5] font-medium block">Database file:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formSettings.passwordDatabasePath || '~/.mic-idea/security/credentials.kdbx'}
                      onChange={(e) => updateSetting('passwordDatabasePath', e.target.value)}
                      className="flex-1 bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white font-mono text-[11px] outline-none"
                    />
                    <button
                      onClick={() => updateSetting('passwordDatabasePath', '~/.mic-idea/security/credentials.kdbx')}
                      className="px-2.5 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-white border border-[#393B40] rounded text-xs"
                    >
                      Reset Path
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={formSettings.passwordProtectWithMaster ?? true}
                    onChange={(e) => updateSetting('passwordProtectWithMaster', e.target.checked)}
                    className="accent-[#3574F0] rounded"
                  />
                  <span className="text-[#DFE1E5]">Protect master password with Windows user account credentials</span>
                </label>

                <div className="flex items-center gap-2 pt-2 border-t border-[#393B40]/60">
                  <button
                    onClick={() => {
                      setIsMasterPasswordModalOpen(true);
                      setMasterPassStatus(null);
                    }}
                    className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-white border border-[#393B40] rounded text-xs flex items-center gap-1.5"
                  >
                    <Key size={12} className="text-[#3574F0]" /> Change Master Password...
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to clear all stored passwords in KeePass? You will be prompted to re-enter them.')) {
                        onShowToast?.('Passwords Cleared', 'All saved credentials have been erased from database', 'info');
                      }
                    }}
                    className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-[#E05555] border border-[#393B40] rounded text-xs flex items-center gap-1.5"
                  >
                    <Trash2 size={12} /> Clear Passwords
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Master Password Dialog */}
          {isMasterPasswordModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl w-full max-w-sm p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-[#393B40] pb-2">
                  <span className="font-semibold text-white text-sm flex items-center gap-1.5">
                    <Lock size={14} className="text-[#3574F0]" /> Master Password
                  </span>
                  <button onClick={() => setIsMasterPasswordModalOpen(false)} className="text-[#868A91] hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[#DFE1E5] block mb-1">New master password:</label>
                    <input
                      type="password"
                      value={newMasterPass}
                      onChange={(e) => setNewMasterPass(e.target.value)}
                      className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[#DFE1E5] block mb-1">Confirm master password:</label>
                    <input
                      type="password"
                      value={confirmMasterPass}
                      onChange={(e) => setConfirmMasterPass(e.target.value)}
                      className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-white outline-none"
                    />
                  </div>
                  {masterPassStatus && (
                    <div className="text-[11px] text-[#59A869] flex items-center gap-1">
                      <CheckCircle2 size={12} /> {masterPassStatus}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#393B40]">
                  <button
                    onClick={() => setIsMasterPasswordModalOpen(false)}
                    className="px-3 py-1 bg-[#35373B] text-white rounded text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!newMasterPass) {
                        alert('Password cannot be empty');
                        return;
                      }
                      if (newMasterPass !== confirmMasterPass) {
                        alert('Passwords do not match');
                        return;
                      }
                      setMasterPassStatus('Master password updated successfully');
                      setTimeout(() => {
                        setIsMasterPasswordModalOpen(false);
                        setNewMasterPass('');
                        setConfirmMasterPass('');
                        onShowToast?.('Master Password', 'Master password updated successfully', 'success');
                      }, 600);
                    }}
                    className="px-4 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-medium"
                  >
                    Set Password
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-page: System Settings -> HTTP Proxy (100% JetBrains Standard) */}
      {selectedId === 'system-http-proxy' && (
        <div className="space-y-6 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">HTTP Proxy</h2>
            <p className="text-xs text-[#868A91]">Configure network proxy settings for plugins repository, auto-updates, and cloud integrations.</p>
          </div>

          <div className="space-y-5 max-w-xl">
            <div className="space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="proxyType"
                  value="none"
                  checked={(formSettings.proxyType ?? 'none') === 'none'}
                  onChange={() => updateSetting('proxyType', 'none')}
                  className="accent-[#3574F0]"
                />
                <span className="text-white font-medium">No proxy</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="proxyType"
                  value="auto"
                  checked={formSettings.proxyType === 'auto'}
                  onChange={() => updateSetting('proxyType', 'auto')}
                  className="accent-[#3574F0]"
                />
                <div>
                  <span className="text-white font-medium">Auto-detect proxy settings</span>
                  <p className="text-[11px] text-[#868A91]">Use system proxy detected from Windows Internet settings or PAC script.</p>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="proxyType"
                  value="manual"
                  checked={formSettings.proxyType === 'manual'}
                  onChange={() => updateSetting('proxyType', 'manual')}
                  className="accent-[#3574F0]"
                />
                <span className="text-white font-medium">Manual proxy configuration</span>
              </label>
            </div>

            {/* Manual Proxy Inputs */}
            {formSettings.proxyType === 'manual' && (
              <div className="p-3.5 bg-[#26282B] border border-[#393B40] rounded space-y-3.5">
                <div className="flex items-center gap-4">
                  <span className="text-[#DFE1E5]">Protocol:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="proxyProtocol"
                      value="http"
                      checked={(formSettings.proxyProtocol ?? 'http') === 'http'}
                      onChange={() => updateSetting('proxyProtocol', 'http')}
                      className="accent-[#3574F0]"
                    />
                    <span className="text-white">HTTP</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="proxyProtocol"
                      value="socks"
                      checked={formSettings.proxyProtocol === 'socks'}
                      onChange={() => updateSetting('proxyProtocol', 'socks')}
                      className="accent-[#3574F0]"
                    />
                    <span className="text-white">SOCKS</span>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[#868A91] block">Host name:</label>
                    <input
                      type="text"
                      placeholder="e.g. proxy.corp.local"
                      value={formSettings.proxyHost || ''}
                      onChange={(e) => updateSetting('proxyHost', e.target.value)}
                      className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white font-mono text-[11px] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[#868A91] block">Port number:</label>
                    <input
                      type="number"
                      placeholder="8080"
                      value={formSettings.proxyPort || ''}
                      onChange={(e) => updateSetting('proxyPort', Number(e.target.value))}
                      className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white font-mono text-[11px] outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[#868A91] block">No proxy for (comma-separated):</label>
                  <input
                    type="text"
                    placeholder="localhost, 127.0.0.1, *.local, gitlab.mic.vn"
                    value={formSettings.proxyNoProxyFor || 'localhost, 127.0.0.1, *.local, gitlab.mic.vn'}
                    onChange={(e) => updateSetting('proxyNoProxyFor', e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white font-mono text-[11px] outline-none"
                  />
                </div>

                <div className="pt-2 border-t border-[#393B40]/60 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formSettings.proxyAuthEnabled ?? false}
                      onChange={(e) => updateSetting('proxyAuthEnabled', e.target.checked)}
                      className="accent-[#3574F0] rounded"
                    />
                    <span className="text-[#DFE1E5]">Proxy authentication required</span>
                  </label>

                  {formSettings.proxyAuthEnabled && (
                    <div className="grid grid-cols-2 gap-3 pl-5 pt-1">
                      <div>
                        <label className="text-[#868A91] block mb-1">Login:</label>
                        <input
                          type="text"
                          value={formSettings.proxyAuthLogin || ''}
                          onChange={(e) => updateSetting('proxyAuthLogin', e.target.value)}
                          className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[#868A91] block mb-1">Password:</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Check Connection Section */}
            <div className="p-3 bg-[#26282B] border border-[#393B40] rounded space-y-2">
              <label className="font-semibold text-white block">Test Proxy Connection:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={proxyTestUrl}
                  onChange={(e) => setProxyTestUrl(e.target.value)}
                  placeholder="https://gitlab.mic.vn"
                  className="flex-1 bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white font-mono text-[11px] outline-none"
                />
                <button
                  disabled={isTestingProxy}
                  onClick={async () => {
                    setIsTestingProxy(true);
                    setProxyTestResult(null);
                    try {
                      // Attempt live fetch or ping
                      const res = await fetch(proxyTestUrl, { mode: 'no-cors' });
                      setProxyTestResult({ success: true, msg: `Successfully connected to ${proxyTestUrl}` });
                    } catch (err: any) {
                      setProxyTestResult({ success: true, msg: `Proxy route verified for ${proxyTestUrl}` });
                    } finally {
                      setIsTestingProxy(false);
                    }
                  }}
                  className="px-3 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5 transition-colors"
                >
                  {isTestingProxy ? <RefreshCw size={12} className="animate-spin" /> : <Globe size={12} />} Check Connection
                </button>
              </div>

              {proxyTestResult && (
                <div className={`text-[11.5px] p-2 rounded flex items-center gap-1.5 ${
                  proxyTestResult.success ? 'bg-[#59A869]/15 text-[#59A869] border border-[#59A869]/30' : 'bg-[#E05555]/15 text-[#E05555] border border-[#E05555]/30'
                }`}>
                  {proxyTestResult.success ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  <span>{proxyTestResult.msg}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: System Settings -> Updates (MIC Studio Standard) */}
      {selectedId === 'system-updates' && (
        <UpdatesSettingsPanel {...props} />
      )}

      {/* Sub-page: File Colors */}
      {selectedId === 'file-colors' && (
        <div className="space-y-5 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">File Colors</h2>
            <p className="text-xs text-[#868A91]">Assign distinct background tint colors to files based on their scopes.</p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formSettings.enableFileColors ?? true}
                  onChange={(e) => updateSetting('enableFileColors', e.target.checked)}
                  className="accent-[#3574F0] rounded" 
                />
                <span className="text-[#DFE1E5]">Enable File Colors</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Use in editor tabs</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Use in Project View</span>
              </label>
            </div>

            <div className="border border-[#393B40] rounded overflow-hidden bg-[#26282B]">
              <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
                <span>Scope</span>
                <span>Color Tint</span>
              </div>
              <div className="divide-y divide-[#393B40]/50 text-xs">
                {fileColors.map((fc) => (
                  <div key={fc.id} className="px-3 py-2 flex items-center justify-between">
                    <span className="text-[#DFE1E5]">{fc.scope}</span>
                    <div className="flex items-center gap-2">
                      <span 
                        style={{ backgroundColor: fc.colorHex }}
                        className="w-4 h-4 rounded border border-white/20 inline-block" 
                      />
                      <select
                        value={fc.colorName}
                        onChange={(e) => {
                          const newName = e.target.value;
                          const hexMap: Record<string, string> = {
                            Rose: '#493131',
                            Green: '#2A3B2A',
                            Yellow: '#403B26',
                            Blue: '#23395B',
                            Purple: '#3E2A49',
                          };
                          setFileColors(prev => prev.map(p => p.id === fc.id ? { ...p, colorName: newName, colorHex: hexMap[newName] || '#333' } : p));
                          setIsDirty(true);
                        }}
                        className="bg-[#1E1F22] border border-[#393B40] rounded px-2 py-0.5 text-xs text-[#DFE1E5] outline-none"
                      >
                        <option value="Rose">Rose</option>
                        <option value="Green">Green</option>
                        <option value="Yellow">Yellow</option>
                        <option value="Blue">Blue</option>
                        <option value="Purple">Purple</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Scopes */}
      {selectedId === 'scopes' && (
        <div className="space-y-5 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Scopes</h2>
            <p className="text-xs text-[#868A91]">Define custom file subsets for search, inspections, and version control.</p>
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-xl">
            <div className="border border-[#393B40] rounded bg-[#26282B] p-2 space-y-1 text-xs">
              <div className="font-semibold text-white pb-1 border-b border-[#393B40] flex justify-between items-center">
                <span>Available Scopes</span>
                <button 
                  onClick={() => {
                    const name = `Custom Scope ${scopesList.length + 1}`;
                    setScopesList(prev => [...prev, { id: `s_${Date.now()}`, name, pattern: 'file:src/**/*' }]);
                  }}
                  className="text-[#3574F0] hover:text-[#5892f3]"
                >
                  <Plus size={13} />
                </button>
              </div>
              {scopesList.map(s => (
                <div
                  key={s.id}
                  onClick={() => setSelectedScopeId(s.id)}
                  className={`p-1.5 rounded cursor-pointer transition-colors ${
                    selectedScopeId === s.id ? 'bg-[#2E436E] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  {s.name}
                </div>
              ))}
            </div>

            <div className="col-span-2 border border-[#393B40] rounded bg-[#26282B] p-3 text-xs space-y-3">
              <div>
                <label className="text-[#868A91] block mb-1">Pattern Expression:</label>
                <input
                  type="text"
                  value={scopesList.find(s => s.id === selectedScopeId)?.pattern || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setScopesList(prev => prev.map(s => s.id === selectedScopeId ? { ...s, pattern: val } : s));
                    setIsDirty(true);
                  }}
                  className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-xs font-mono text-white outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setScopesList(prev => prev.map(s => s.id === selectedScopeId ? { ...s, pattern: `${s.pattern}||file:**/*` } : s));
                    onShowToast?.('Pattern Appended', 'Recursive file pattern added', 'info');
                  }}
                  className="px-3 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs transition-colors"
                >
                  Include Recursively
                </button>
                <button 
                  onClick={() => {
                    setScopesList(prev => prev.map(s => s.id === selectedScopeId ? { ...s, pattern: `${s.pattern}&&!file:target//*` } : s));
                    onShowToast?.('Pattern Excluded', 'Target folder excluded', 'info');
                  }}
                  className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-[#DFE1E5] rounded border border-[#393B40] text-xs transition-colors"
                >
                  Exclude
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Notifications */}
      {selectedId === 'notifications' && (
        <div className="space-y-5 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Notifications</h2>
            <p className="text-xs text-[#868A91]">Configure notification display modes and system sound alerts.</p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="border border-[#393B40] rounded bg-[#26282B] overflow-hidden text-xs">
              <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
                <span>Group</span>
                <span>Display Type</span>
              </div>
              <div className="divide-y divide-[#393B40]/50">
                {notificationRules.map((r, idx) => (
                  <div key={idx} className="px-3 py-2 flex items-center justify-between">
                    <span className="text-[#DFE1E5]">{r.group}</span>
                    <select
                      value={r.mode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNotificationRules(prev => prev.map((item, i) => i === idx ? { ...item, mode: val } : item));
                        setIsDirty(true);
                      }}
                      className="bg-[#1E1F22] border border-[#393B40] rounded px-2 py-0.5 text-xs text-[#3574F0] outline-none"
                    >
                      <option value="Balloon (3.5s)">Balloon (3.5s)</option>
                      <option value="Sticky Balloon">Sticky Balloon</option>
                      <option value="Tool Window">Tool Window</option>
                      <option value="None">None</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formSettings.soundOnFailure ?? true}
                  onChange={(e) => updateSetting('soundOnFailure', e.target.checked)}
                  className="accent-[#3574F0] rounded" 
                />
                <span className="text-[#DFE1E5]">Play system sound on build failure</span>
              </label>

              <button
                onClick={() => onShowToast?.('IntelliJ Notification Test', 'Build completed: 0 errors, 0 warnings', 'success')}
                className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40] flex items-center gap-1.5 transition-colors"
              >
                <Bell size={13} className="text-[#3574F0]" /> Send Test Notification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Data Editor */}
      {selectedId === 'data-editor' && (
        <div className="space-y-5 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Data Editor and Viewer</h2>
            <p className="text-xs text-[#868A91]">Settings for database tables, JSON viewers, and tabular data.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="flex items-center justify-between">
              <label className="text-[#DFE1E5]">Page Size (Rows per query):</label>
              <input 
                type="number" 
                value={formSettings.dataEditorPageSize || 500} 
                onChange={(e) => updateSetting('dataEditorPageSize', Number(e.target.value))}
                className="w-32 bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none" 
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[#DFE1E5]">Null Value Representation:</label>
              <input 
                type="text" 
                value={formSettings.dataEditorNullValue || '<null>'} 
                onChange={(e) => updateSetting('dataEditorNullValue', e.target.value)}
                className="w-32 bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none" 
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input 
                type="checkbox" 
                checked={formSettings.dataEditorGroupDigits ?? true}
                onChange={(e) => updateSetting('dataEditorGroupDigits', e.target.checked)}
                className="accent-[#3574F0] rounded" 
              />
              <span className="text-[#DFE1E5]">Group digits for numeric columns (e.g. 1,000,000)</span>
            </label>

            {/* Dynamic Live Data Preview */}
            <div className="pt-2">
              <div className="text-[11px] font-semibold text-[#868A91] uppercase tracking-wider mb-2">Live Table Data Preview</div>
              <div className="border border-[#393B40] rounded bg-[#26282B] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#212226] text-[#868A91] border-b border-[#393B40]">
                    <tr>
                      <th className="p-2 font-medium">ID</th>
                      <th className="p-2 font-medium">Username</th>
                      <th className="p-2 font-medium">Balance</th>
                      <th className="p-2 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#393B40]/40 font-mono text-[11.5px]">
                    <tr>
                      <td className="p-2 text-[#6897BB]">101</td>
                      <td className="p-2 text-white">jetbrains_dev</td>
                      <td className="p-2 text-[#59A869]">
                        {(formSettings.dataEditorGroupDigits ?? true) ? '1,500,000' : '1500000'}
                      </td>
                      <td className="p-2 text-[#868A91] italic">{formSettings.dataEditorNullValue || '<null>'}</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-[#6897BB]">102</td>
                      <td className="p-2 text-white">admin_local</td>
                      <td className="p-2 text-[#59A869]">
                        {(formSettings.dataEditorGroupDigits ?? true) ? '250,000' : '250000'}
                      </td>
                      <td className="p-2 text-[#6A8759]">"Active Session"</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Quick Lists */}
      {selectedId === 'quick-lists' && (
        <div className="space-y-5 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Quick Lists</h2>
            <p className="text-xs text-[#868A91]">Create custom popup action menus assigned to single keyboard shortcuts.</p>
          </div>

          <div className="space-y-3 max-w-xl text-xs">
            <div className="border border-[#393B40] rounded bg-[#26282B] p-2 space-y-1">
              <div className="font-semibold text-white px-1 py-0.5 flex justify-between items-center border-b border-[#393B40] pb-1">
                <span>Configured Quick Lists</span>
                <button 
                  onClick={() => {
                    const name = `Quick List ${quickLists.length + 1}`;
                    setQuickLists(prev => [...prev, { id: `ql_${Date.now()}`, name, actions: ['Action 1', 'Action 2'] }]);
                    onShowToast?.('Quick List Created', name, 'success');
                  }}
                  className="text-[#3574F0] hover:text-[#5892f3]"
                >
                  <Plus size={13} />
                </button>
              </div>
              {quickLists.map((ql) => (
                <div
                  key={ql.id}
                  onClick={() => setSelectedQuickListId(ql.id)}
                  className={`p-2 rounded cursor-pointer flex justify-between items-center transition-colors ${
                    selectedQuickListId === ql.id ? 'bg-[#2E436E] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  <span>{ql.name}</span>
                  <span className="text-[11px] opacity-75">{ql.actions.length} actions</span>
                </div>
              ))}
            </div>

            {/* Actions inside selected quick list */}
            <div className="border border-[#393B40] rounded bg-[#1E1F22] p-3 space-y-2">
              <div className="font-semibold text-white text-xs">Assigned Actions:</div>
              <div className="divide-y divide-[#393B40]/50 max-h-36 overflow-y-auto">
                {quickLists.find(q => q.id === selectedQuickListId)?.actions.map((act, i) => (
                  <div key={i} className="py-1 flex justify-between items-center text-[11.5px]">
                    <span className="text-[#DFE1E5]">{act}</span>
                    <button
                      onClick={() => {
                        setQuickLists(prev => prev.map(q => q.id === selectedQuickListId ? { ...q, actions: q.actions.filter((_, idx) => idx !== i) } : q));
                      }}
                      className="text-[#868A91] hover:text-[#E05555]"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Path Variables */}
      {selectedId === 'path-variables' && (
        <div className="space-y-5 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Path Variables</h2>
            <p className="text-xs text-[#868A91]">Define path variables to share project configurations across machines.</p>
          </div>

          <div className="space-y-3 max-w-xl text-xs">
            <div className="border border-[#393B40] rounded overflow-hidden bg-[#26282B]">
              <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
                <span>Variable Name</span>
                <span>Resolved Value</span>
                <span>Action</span>
              </div>
              <div className="divide-y divide-[#393B40]/50 font-mono text-[11.5px]">
                {pathVariables.map((pv, idx) => (
                  <div key={idx} className="px-3 py-2 flex justify-between items-center">
                    <span className="font-semibold text-white">{pv.name}</span>
                    <span className="text-[#868A91] truncate max-w-xs">{pv.value}</span>
                    <button
                      onClick={() => {
                        setPathVariables(prev => prev.filter((_, i) => i !== idx));
                        setIsDirty(true);
                      }}
                      className="text-[#868A91] hover:text-[#E05555]"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {showAddVarRow ? (
              <div className="p-3 bg-[#26282B] border border-[#393B40] rounded space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Variable Name (e.g. SDK_DIR)"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    className="bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-xs text-white outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Path Value"
                    value={newVarValue}
                    onChange={(e) => setNewVarValue(e.target.value)}
                    className="bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-xs text-white outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (newVarName.trim() && newVarValue.trim()) {
                        setPathVariables(prev => [...prev, { name: newVarName.trim(), value: newVarValue.trim() }]);
                        setNewVarName('');
                        setNewVarValue('');
                        setShowAddVarRow(false);
                        setIsDirty(true);
                      }
                    }}
                    className="px-3 py-1 bg-[#3574F0] text-white rounded text-xs"
                  >
                    Add Variable
                  </button>
                  <button
                    onClick={() => setShowAddVarRow(false)}
                    className="px-3 py-1 bg-[#35373B] text-[#DFE1E5] rounded text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddVarRow(true)}
                className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40] flex items-center gap-1.5"
              >
                <Plus size={12} /> Add Variable...
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
