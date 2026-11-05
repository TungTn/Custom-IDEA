import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Monitor, 
  Palette, 
  Settings as SettingsIcon, 
  Sparkles, 
  Plus, 
  Bell, 
  Trash2 
} from 'lucide-react';
import { SettingPanelProps } from './types';
import { ThemeDefinition } from '../../../types/theme';
import { getAllThemes, saveCustomTheme, applyIdeTheme } from '../../../themes/themeManager';
import { importIntelliJTheme } from '../../../editor/cm/themeImporter';

export const AppearanceBehaviorPanel: React.FC<SettingPanelProps> = ({
  selectedId,
  formSettings,
  updateSetting,
  setIsDirty,
  onShowToast,
  onOpenThemeStudio,
  setSelectedId,
}) => {
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
                <span>Main Menu Actions:</span>
                <span className="text-[11px] text-[#868A91]">8 Top-level Menus</span>
              </div>
              <div className="pl-2 space-y-1 text-[#C4C7C5] font-mono text-[11.5px] max-h-48 overflow-y-auto">
                <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                  <span>▾ File (New, Open, Recent, Close, Settings...)</span>
                  <span className="text-[10px] text-[#868A91]">Enabled</span>
                </div>
                <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                  <span>▾ Edit (Undo, Redo, Cut, Copy, Paste, Find...)</span>
                  <span className="text-[10px] text-[#868A91]">Enabled</span>
                </div>
                <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                  <span>▾ View (Tool Windows, Appearance, Quick Definition...)</span>
                  <span className="text-[10px] text-[#868A91]">Enabled</span>
                </div>
                <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                  <span>▾ Navigate (Search Everywhere, Go to Line, File...)</span>
                  <span className="text-[10px] text-[#868A91]">Enabled</span>
                </div>
                <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                  <span>▾ Code (Inspect Code, Code Style, Reformat...)</span>
                  <span className="text-[10px] text-[#868A91]">Enabled</span>
                </div>
                <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                  <span>▾ Build (Build Project, Recompile, Clean...)</span>
                  <span className="text-[10px] text-[#868A91]">Enabled</span>
                </div>
                <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                  <span>▾ Run (Run, Debug, Stop, Edit Configurations...)</span>
                  <span className="text-[10px] text-[#868A91]">Enabled</span>
                </div>
                <div className="p-1 hover:bg-[#35373B] rounded flex items-center justify-between">
                  <span>▾ Git (Commit, Push, Pull, Branches, History...)</span>
                  <span className="text-[10px] text-[#868A91]">Enabled</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button 
                onClick={() => onShowToast?.('Menu Customized', 'New action added to Main Menu / Tools', 'success')}
                className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40] flex items-center gap-1 transition-colors"
              >
                <Plus size={12} /> Add Action...
              </button>
              <button 
                onClick={() => onShowToast?.('Defaults Restored', 'Menu layout reset to IntelliJ default', 'info')}
                className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40] transition-colors"
              >
                Restore Defaults
              </button>
            </div>
          </div>
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
