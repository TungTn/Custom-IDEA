import React, { useState } from 'react';
import { RotateCcw, CheckCircle2, Plus, Trash2, Code, Eye, Key, Layers, FileCode, Sparkles, Sliders, Check } from 'lucide-react';
import { SettingPanelProps } from './types';
import { loadLiveTemplates, LiveTemplate } from '../../../editor/cm/snippetEngine';

export const EditorSettingsPanel: React.FC<SettingPanelProps> = ({
  selectedId,
  formSettings,
  updateSetting,
  setIsDirty,
  onShowToast,
  liveTemplates: liveTemplatesProp,
  setLiveTemplates: setLiveTemplatesProp,
}) => {
  // Local state for font preview
  const [fontPreviewText, setFontPreviewText] = useState(`fn main() {\n    // IntelliJ IDEA Typography Preview\n    let count = 42;\n    if count >= 0 {\n        println!("=> Hello, World! ligatures: == != =>");\n    }\n}`);

  // Color scheme state
  const [colorSchemePreset, setColorSchemePreset] = useState('IntelliJ New UI Dark');
  const [tokenColors, setTokenColors] = useState({
    keyword: '#CC7832',
    string: '#6A8759',
    number: '#6897BB',
    function: '#FFC66D',
    comment: '#808080',
    type: '#A9B7C6',
  });

  // Code style state
  const [codeStyleLang, setCodeStyleLang] = useState<'Rust' | 'TypeScript' | 'Java' | 'Python' | 'Go' | 'JSON'>('Rust');
  const [codeStyleRules, setCodeStyleRules] = useState<Record<string, {
    tabSize: number;
    indentSize: number;
    continuationIndent: number;
    rightMargin: number;
    bracePlacement: 'same_line' | 'next_line';
    spaceAroundOperators: boolean;
    spaceBeforeParens: boolean;
  }>>({
    Rust: { tabSize: 4, indentSize: 4, continuationIndent: 8, rightMargin: 100, bracePlacement: 'same_line', spaceAroundOperators: true, spaceBeforeParens: true },
    TypeScript: { tabSize: 2, indentSize: 2, continuationIndent: 4, rightMargin: 120, bracePlacement: 'same_line', spaceAroundOperators: true, spaceBeforeParens: true },
    Java: { tabSize: 4, indentSize: 4, continuationIndent: 8, rightMargin: 120, bracePlacement: 'same_line', spaceAroundOperators: true, spaceBeforeParens: true },
    Python: { tabSize: 4, indentSize: 4, continuationIndent: 8, rightMargin: 88, bracePlacement: 'same_line', spaceAroundOperators: true, spaceBeforeParens: false },
    Go: { tabSize: 4, indentSize: 4, continuationIndent: 8, rightMargin: 100, bracePlacement: 'same_line', spaceAroundOperators: true, spaceBeforeParens: false },
    JSON: { tabSize: 2, indentSize: 2, continuationIndent: 2, rightMargin: 100, bracePlacement: 'same_line', spaceAroundOperators: false, spaceBeforeParens: false },
  });

  // Inspections state
  const [selectedInspectionId, setSelectedInspectionId] = useState<string>('i1');
  const [inspectionsList, setInspectionsList] = useState([
    { id: 'i1', name: 'Syntax and semantic compiler errors', severity: 'Error', enabled: true },
    { id: 'i2', name: 'Unused variable and import elimination', severity: 'Warning', enabled: true },
    { id: 'i3', name: 'Deprecated symbol and API warnings', severity: 'Warning', enabled: true },
    { id: 'i4', name: 'Typo and dictionary spelling checks', severity: 'Typo', enabled: true },
    { id: 'i5', name: 'Unreachable code branch detection', severity: 'Warning', enabled: true },
    { id: 'i6', name: 'Implicit type coercion anomalies', severity: 'Weak Warning', enabled: true },
  ]);

  // Fallback local live templates if not supplied by props
  const [localLiveTemplates, setLocalLiveTemplates] = useState<LiveTemplate[]>(() => loadLiveTemplates());
  const liveTemplates = liveTemplatesProp ?? localLiveTemplates;
  const setLiveTemplates = setLiveTemplatesProp ?? setLocalLiveTemplates;
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => (liveTemplates[0]?.id || 'lt_sout'));

  // File and Code Templates state
  const [fileTemplates, setFileTemplates] = useState([
    { id: 'ft_java_class', name: 'Java Class', ext: 'java', body: 'package ${PACKAGE_NAME};\n\npublic class ${NAME} {\n}' },
    { id: 'ft_java_interface', name: 'Java Interface', ext: 'java', body: 'package ${PACKAGE_NAME};\n\npublic interface ${NAME} {\n}' },
    { id: 'ft_java_record', name: 'Java Record', ext: 'java', body: 'package ${PACKAGE_NAME};\n\npublic record ${NAME}() {\n}' },
    { id: 'ft_ts_comp', name: 'React Component', ext: 'tsx', body: 'import React from \'react\';\n\ninterface ${NAME}Props {}\n\nexport const ${NAME}: React.FC<${NAME}Props> = () => {\n  return <div>${NAME}</div>;\n};' },
    { id: 'ft_rust_mod', name: 'Rust Module', ext: 'rs', body: '//! ${NAME} module\n\npub struct ${NAME} {\n}\n\nimpl ${NAME} {\n    pub fn new() -> Self {\n        Self {}\n    }\n}' },
    { id: 'ft_html5', name: 'HTML5 Boilerplate', ext: 'html', body: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${NAME}</title>\n</head>\n<body>\n</body>\n</html>' },
  ]);
  const [selectedFileTemplateId, setSelectedFileTemplateId] = useState('ft_java_class');

  // Language Injections state
  const [languageInjections, setLanguageInjections] = useState([
    { id: 'inj_sql', name: 'SQL in String Literals', lang: 'SQL', prefix: 'SELECT|INSERT|UPDATE|DELETE', enabled: true },
    { id: 'inj_regex', name: 'RegExp in Pattern Strings', lang: 'RegExp', prefix: 'regex:|pattern:', enabled: true },
    { id: 'inj_json', name: 'JSON in Strings', lang: 'JSON', prefix: 'json:', enabled: true },
    { id: 'inj_html', name: 'HTML in Template Literals', lang: 'HTML', prefix: 'html`|<div', enabled: true },
  ]);

  return (
    <div>
      {/* Sub-page: Editor (Parent Node Overview) or Editor > General */}
      {(selectedId === 'editor' || selectedId === 'editor-general') && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">General Editor Settings</h2>
            <p className="text-xs text-[#868A91]">Control line numbers, minimap, formatting indents, and soft wrapping.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[#868A91] block mb-1">Tab Size (Spaces):</label>
                <select
                  value={formSettings.tabSize}
                  onChange={(e) => updateSetting('tabSize', Number(e.target.value))}
                  className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none"
                >
                  <option value="2">2 spaces</option>
                  <option value="4">4 spaces (IntelliJ Standard)</option>
                  <option value="8">8 spaces</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-[#393B40] space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.lineNumbers}
                  onChange={(e) => updateSetting('lineNumbers', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Show line numbers</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.minimap}
                  onChange={(e) => updateSetting('minimap', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Show code minimap</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.wordWrap}
                  onChange={(e) => updateSetting('wordWrap', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Soft-wrap long lines (Wrap text)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formSettings.codeFolding ?? true}
                  onChange={(e) => updateSetting('codeFolding', e.target.checked)}
                  className="accent-[#3574F0] rounded" 
                />
                <span className="text-[#DFE1E5]">Show code folding outline controls</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formSettings.bracketPairs ?? true}
                  onChange={(e) => updateSetting('bracketPairs', e.target.checked)}
                  className="accent-[#3574F0] rounded" 
                />
                <span className="text-[#DFE1E5]">Highlight matching bracket pairs with colors</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-[#393B40]">
                <input 
                  type="checkbox" 
                  checked={!!formSettings.vimMode} 
                  onChange={(e) => updateSetting('vimMode', e.target.checked)} 
                  className="accent-[#3574F0] rounded" 
                />
                <span className="text-[#3574F0] font-medium">Enable Vim Emulation Mode (IdeaVim / Modal Editing)</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Editor > Font */}
      {selectedId === 'editor-font' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Editor Font</h2>
            <p className="text-xs text-[#868A91]">Customize typeface typography, sizing, line height, and programming ligatures.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
            {/* Left Column: Controls */}
            <div className="space-y-4">
              {/* Font Family */}
              <div className="flex items-center justify-between">
                <label className="text-[#DFE1E5] text-xs">Font:</label>
                <select
                  value={formSettings.fontFamily || 'JetBrains Mono'}
                  onChange={(e) => updateSetting('fontFamily', e.target.value)}
                  className="bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none w-56 font-mono"
                >
                  <option value="JetBrains Mono">JetBrains Mono (Recommended)</option>
                  <option value="Fira Code">Fira Code</option>
                  <option value="Cascadia Code">Cascadia Code</option>
                  <option value="Consolas">Consolas</option>
                  <option value="Source Code Pro">Source Code Pro</option>
                  <option value="Monaco">Monaco</option>
                  <option value="Courier New">Courier New</option>
                </select>
              </div>

              {/* Font Size */}
              <div className="flex items-center justify-between">
                <label className="text-[#DFE1E5] text-xs">Size (pt):</label>
                <div className="flex items-center gap-2 w-56">
                  <input
                    type="number"
                    min={9}
                    max={32}
                    step={1}
                    value={formSettings.fontSize || 13}
                    onChange={(e) => updateSetting('fontSize', Math.max(9, Math.min(32, Number(e.target.value))))}
                    className="w-20 bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1 text-xs text-[#DFE1E5] outline-none"
                  />
                  <span className="text-xs text-[#868A91]">Default: 13.0 pt</span>
                </div>
              </div>

              {/* Line Height / Spacing */}
              <div className="flex items-center justify-between">
                <label className="text-[#DFE1E5] text-xs">Line height:</label>
                <div className="flex items-center gap-2 w-56">
                  <input
                    type="number"
                    min={1.0}
                    max={2.5}
                    step={0.1}
                    value={formSettings.lineHeight || 1.4}
                    onChange={(e) => updateSetting('lineHeight', Number(e.target.value))}
                    className="w-20 bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1 text-xs text-[#DFE1E5] outline-none"
                  />
                  <span className="text-xs text-[#868A91]">1.0 – 2.5 (Default: 1.4)</span>
                </div>
              </div>

              {/* Ligatures */}
              <div className="pt-3 border-t border-[#393B40] space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSettings.ligatures ?? true}
                    onChange={(e) => updateSetting('ligatures', e.target.checked)}
                    className="accent-[#3574F0] rounded"
                  />
                  <span className="text-xs text-[#DFE1E5]">Enable font ligatures (e.g. =&gt;, ===, !=, &lt;=&gt;)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSettings.smoothScrolling ?? true}
                    onChange={(e) => updateSetting('smoothScrolling', e.target.checked)}
                    className="accent-[#3574F0] rounded"
                  />
                  <span className="text-xs text-[#DFE1E5]">Smooth scrolling animations</span>
                </label>
              </div>

              {/* Reset Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    updateSetting('fontFamily', 'JetBrains Mono');
                    updateSetting('fontSize', 13);
                    updateSetting('lineHeight', 1.4);
                    updateSetting('ligatures', true);
                    onShowToast?.('Font Reset', 'Restored JetBrains standard typography', 'info');
                  }}
                  className="px-3 py-1.5 bg-[#2B2D30] hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40] flex items-center gap-1.5"
                >
                  <RotateCcw size={12} />
                  <span>Restore Defaults</span>
                </button>
              </div>
            </div>

            {/* Right Column: Authentic IntelliJ Live Preview Box */}
            <div className="space-y-2">
              <label className="text-xs text-[#868A91] block">Live Preview:</label>
              <div 
                className="p-4 bg-[#141517] border border-[#393B40] rounded-lg shadow-inner h-64 overflow-auto select-none"
                style={{
                  fontFamily: `'${formSettings.fontFamily || 'JetBrains Mono'}', monospace`,
                  fontSize: `${formSettings.fontSize || 13}px`,
                  lineHeight: formSettings.lineHeight || 1.4,
                  fontVariantLigatures: formSettings.ligatures ? 'normal' : 'none',
                }}
              >
                <pre className="text-[#DFE1E5] m-0">
                  <span className="text-[#CC7832] font-bold">package</span> main;{'\n\n'}
                  <span className="text-[#7A7E85] italic">// JetBrains Mono font demonstration</span>{'\n'}
                  <span className="text-[#CC7832] font-bold">public class</span> <span className="text-[#299999] font-bold">OrderManager</span> {'{'}{'\n'}
                  {'  '}<span className="text-[#CC7832] font-bold">public static void</span> <span className="text-[#FFC66D]">main</span>(String[] args) {'{'}{'\n'}
                  {'    '}<span className="text-[#299999]">int</span> quantity = <span className="text-[#6897BB]">42</span>;{'\n'}
                  {'    '}<span className="text-[#299999]">boolean</span> isValid = quantity &gt;= <span className="text-[#6897BB]">10</span> &amp;&amp; quantity != <span className="text-[#6897BB]">0</span>;{'\n'}
                  {'    '}<span className="text-[#299999]">String</span> arrow = <span className="text-[#6A8759]">"=&gt; === &lt;= != ==="</span>;{'\n'}
                  {'    '}System.out.<span className="text-[#FFC66D]">println</span>(<span className="text-[#6A8759]">"Total: "</span> + quantity);{'\n'}
                  {'  '}&#125;{'\n'}
                  &#125;
                </pre>
              </div>
              <span className="text-[11px] text-[#868A91]">
                Ligature sample: {'=>'} {'==='} {'!='} {'<='} {'->'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Editor > Color Scheme */}
      {selectedId === 'editor-color-scheme' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Color Scheme</h2>
            <p className="text-xs text-[#868A91]">Syntax highlighting color tokens for keywords, functions, types, and strings.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="flex items-center gap-3">
              <label className="text-[#868A91]">Scheme:</label>
              <select
                value={colorSchemePreset}
                onChange={(e) => setColorSchemePreset(e.target.value)}
                className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none"
              >
                <option value="IntelliJ New UI Dark">IntelliJ New UI Dark</option>
                <option value="Darcula">Darcula Classic</option>
                <option value="High Contrast">High Contrast</option>
                <option value="Light">IntelliJ Light</option>
              </select>
            </div>

            <div className="border border-[#393B40] rounded bg-[#26282B] overflow-hidden">
              <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
                <span>Token Type</span>
                <span>Color Customization</span>
              </div>
              <div className="divide-y divide-[#393B40]/50 p-2 space-y-1">
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#DFE1E5]">Keywords (`fn`, `let`, `class`)</span>
                  <input
                    type="color"
                    value={tokenColors.keyword}
                    onChange={(e) => { setTokenColors(prev => ({ ...prev, keyword: e.target.value })); setIsDirty(true); }}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#DFE1E5]">Strings (`"Hello"`)</span>
                  <input
                    type="color"
                    value={tokenColors.string}
                    onChange={(e) => { setTokenColors(prev => ({ ...prev, string: e.target.value })); setIsDirty(true); }}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#DFE1E5]">Numbers (`42`, `3.14`)</span>
                  <input
                    type="color"
                    value={tokenColors.number}
                    onChange={(e) => { setTokenColors(prev => ({ ...prev, number: e.target.value })); setIsDirty(true); }}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#DFE1E5]">Functions & Methods (`run()`)</span>
                  <input
                    type="color"
                    value={tokenColors.function}
                    onChange={(e) => { setTokenColors(prev => ({ ...prev, function: e.target.value })); setIsDirty(true); }}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                </div>
              </div>
            </div>

            {/* Syntax Preview */}
            <div className="p-3 bg-[#141517] border border-[#393B40] rounded font-mono text-xs">
              <span style={{ color: tokenColors.keyword }}>fn</span> <span style={{ color: tokenColors.function }}>calculate</span>() &#123;{'\n'}
              {'    '}<span style={{ color: tokenColors.keyword }}>let</span> score = <span style={{ color: tokenColors.number }}>100</span>;{'\n'}
              {'    '}<span style={{ color: tokenColors.keyword }}>let</span> msg = <span style={{ color: tokenColors.string }}>"Active"</span>;{'\n'}
              &#125;
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Editor > Code Style */}
      {selectedId === 'editor-code-style' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Code Style</h2>
            <p className="text-xs text-[#868A91]">Configure indentation, spacing rules, and brace wrapping with live syntax preview.</p>
          </div>

          <div className="space-y-4 max-w-2xl text-xs">
            {/* Language Selector */}
            <div className="flex gap-1.5 border-b border-[#393B40] pb-2 overflow-x-auto">
              {(['Rust', 'TypeScript', 'Java', 'Python', 'Go', 'JSON'] as const).map(lang => (
                <button
                  key={lang}
                  onClick={() => setCodeStyleLang(lang)}
                  className={`px-3 py-1 rounded transition-colors ${codeStyleLang === lang ? 'bg-[#3574F0] text-white font-medium shadow-sm' : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B]'}`}
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* Settings Controls Grid */}
            <div className="grid grid-cols-2 gap-4 bg-[#26282B] p-4 rounded border border-[#393B40]">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[#DFE1E5]">Tab size:</span>
                  <input 
                    type="number" 
                    value={codeStyleRules[codeStyleLang]?.tabSize || 4} 
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCodeStyleRules(prev => ({ ...prev, [codeStyleLang]: { ...prev[codeStyleLang], tabSize: val } }));
                      setIsDirty(true);
                    }}
                    className="w-20 bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none font-mono text-center" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#DFE1E5]">Indent:</span>
                  <input 
                    type="number" 
                    value={codeStyleRules[codeStyleLang]?.indentSize || 4} 
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCodeStyleRules(prev => ({ ...prev, [codeStyleLang]: { ...prev[codeStyleLang], indentSize: val } }));
                      setIsDirty(true);
                    }}
                    className="w-20 bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none font-mono text-center" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#DFE1E5]">Continuation indent:</span>
                  <input 
                    type="number" 
                    value={codeStyleRules[codeStyleLang]?.continuationIndent || 8} 
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCodeStyleRules(prev => ({ ...prev, [codeStyleLang]: { ...prev[codeStyleLang], continuationIndent: val } }));
                      setIsDirty(true);
                    }}
                    className="w-20 bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none font-mono text-center" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#DFE1E5]">Right margin (columns):</span>
                  <input 
                    type="number" 
                    value={codeStyleRules[codeStyleLang]?.rightMargin || 120} 
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCodeStyleRules(prev => ({ ...prev, [codeStyleLang]: { ...prev[codeStyleLang], rightMargin: val } }));
                      setIsDirty(true);
                    }}
                    className="w-20 bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none font-mono text-center" 
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[#868A91] block mb-1">Braces placement:</label>
                  <select
                    value={codeStyleRules[codeStyleLang]?.bracePlacement || 'same_line'}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setCodeStyleRules(prev => ({ ...prev, [codeStyleLang]: { ...prev[codeStyleLang], bracePlacement: val } }));
                      setIsDirty(true);
                    }}
                    className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none"
                  >
                    <option value="same_line">At end of line (1TBS / K&R)</option>
                    <option value="next_line">Next line (Allman style)</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1 text-[#DFE1E5]">
                  <input 
                    type="checkbox" 
                    checked={codeStyleRules[codeStyleLang]?.spaceAroundOperators ?? true} 
                    onChange={(e) => {
                      const val = e.target.checked;
                      setCodeStyleRules(prev => ({ ...prev, [codeStyleLang]: { ...prev[codeStyleLang], spaceAroundOperators: val } }));
                      setIsDirty(true);
                    }}
                    className="accent-[#3574F0] rounded" 
                  />
                  <span>Spaces around binary operators (+, =, ==)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-[#DFE1E5]">
                  <input 
                    type="checkbox" 
                    checked={codeStyleRules[codeStyleLang]?.spaceBeforeParens ?? true} 
                    onChange={(e) => {
                      const val = e.target.checked;
                      setCodeStyleRules(prev => ({ ...prev, [codeStyleLang]: { ...prev[codeStyleLang], spaceBeforeParens: val } }));
                      setIsDirty(true);
                    }}
                    className="accent-[#3574F0] rounded" 
                  />
                  <span>Space before method parentheses</span>
                </label>
              </div>
            </div>

            {/* Live Code Preview */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-[#868A91] uppercase tracking-wider">Live Formatting Preview ({codeStyleLang})</span>
                <span className="text-[11px] text-[#59A869]">Updated in real-time</span>
              </div>
              <div className="bg-[#1E1F22] border border-[#393B40] rounded p-3 font-mono text-[11px] text-[#A9B7C6] leading-relaxed overflow-x-auto">
                {codeStyleLang === 'Rust' && (
                  <div className="space-y-0.5">
                    <div><span className="text-[#CC7832]">pub struct</span> Point &#123;</div>
                    <div>{' '.repeat(codeStyleRules.Rust.indentSize)}x: <span className="text-[#6897BB]">f64</span>,</div>
                    <div>{' '.repeat(codeStyleRules.Rust.indentSize)}y: <span className="text-[#6897BB]">f64</span>,</div>
                    <div>&#125;</div>
                    <div className="pt-2"><span className="text-[#CC7832]">impl</span> Point {codeStyleRules.Rust.bracePlacement === 'next_line' ? '' : ' {'}</div>
                    {codeStyleRules.Rust.bracePlacement === 'next_line' && <div>&#123;</div>}
                    <div>{' '.repeat(codeStyleRules.Rust.indentSize)}<span className="text-[#CC7832]">pub fn</span> new(x: <span className="text-[#6897BB]">f64</span>, y: <span className="text-[#6897BB]">f64</span>) -&gt; <span className="text-[#CC7832]">Self</span> &#123;</div>
                    <div>{' '.repeat(codeStyleRules.Rust.indentSize * 2)}<span className="text-[#CC7832]">Self</span> &#123; x, y &#125;</div>
                    <div>{' '.repeat(codeStyleRules.Rust.indentSize)}&#125;</div>
                    <div>&#125;</div>
                  </div>
                )}
                {codeStyleLang === 'TypeScript' && (
                  <div className="space-y-0.5">
                    <div><span className="text-[#CC7832]">interface</span> UserProfile &#123;</div>
                    <div>{' '.repeat(codeStyleRules.TypeScript.indentSize)}id: <span className="text-[#A5C0EE]">string</span>;</div>
                    <div>{' '.repeat(codeStyleRules.TypeScript.indentSize)}isActive: <span className="text-[#A5C0EE]">boolean</span>;</div>
                    <div>&#125;</div>
                    <div className="pt-2"><span className="text-[#CC7832]">export function</span> getUser(id: <span className="text-[#A5C0EE]">string</span>) {codeStyleRules.TypeScript.bracePlacement === 'next_line' ? '' : ' {'}</div>
                    {codeStyleRules.TypeScript.bracePlacement === 'next_line' && <div>&#123;</div>}
                    <div>{' '.repeat(codeStyleRules.TypeScript.indentSize)}<span className="text-[#CC7832]">const</span> result = fetchUser(id);</div>
                    <div>{' '.repeat(codeStyleRules.TypeScript.indentSize)}<span className="text-[#CC7832]">return</span> result;</div>
                    <div>&#125;</div>
                  </div>
                )}
                {codeStyleLang === 'Java' && (
                  <div className="space-y-0.5">
                    <div><span className="text-[#CC7832]">public class</span> Calculator &#123;</div>
                    <div>{' '.repeat(codeStyleRules.Java.indentSize)}<span className="text-[#CC7832]">public int</span> add(<span className="text-[#CC7832]">int</span> a, <span className="text-[#CC7832]">int</span> b) {codeStyleRules.Java.bracePlacement === 'next_line' ? '' : ' {'}</div>
                    {codeStyleRules.Java.bracePlacement === 'next_line' && <div>{' '.repeat(codeStyleRules.Java.indentSize)}&#123;</div>}
                    <div>{' '.repeat(codeStyleRules.Java.indentSize * 2)}<span className="text-[#CC7832]">return</span> a + b;</div>
                    <div>{' '.repeat(codeStyleRules.Java.indentSize)}&#125;</div>
                    <div>&#125;</div>
                  </div>
                )}
                {codeStyleLang === 'Python' && (
                  <div className="space-y-0.5">
                    <div><span className="text-[#CC7832]">class</span> Vector:</div>
                    <div>{' '.repeat(codeStyleRules.Python.indentSize)}<span className="text-[#CC7832]">def</span> __init__(self, x, y):</div>
                    <div>{' '.repeat(codeStyleRules.Python.indentSize * 2)}self.x = x</div>
                    <div>{' '.repeat(codeStyleRules.Python.indentSize * 2)}self.y = y</div>
                    <div className="pt-1">{' '.repeat(codeStyleRules.Python.indentSize)}<span className="text-[#CC7832]">def</span> magnitude(self):</div>
                    <div>{' '.repeat(codeStyleRules.Python.indentSize * 2)}<span className="text-[#CC7832]">return</span> (self.x**2 + self.y**2) ** 0.5</div>
                  </div>
                )}
                {codeStyleLang === 'Go' && (
                  <div className="space-y-0.5">
                    <div><span className="text-[#CC7832]">package</span> main</div>
                    <div className="pt-1"><span className="text-[#CC7832]">type</span> Server <span className="text-[#CC7832]">struct</span> &#123;</div>
                    <div>{' '.repeat(codeStyleRules.Go.indentSize)}Port <span className="text-[#6897BB]">int</span></div>
                    <div>&#125;</div>
                    <div className="pt-1"><span className="text-[#CC7832]">func</span> (s *Server) Start() &#123;</div>
                    <div>{' '.repeat(codeStyleRules.Go.indentSize)}println(<span className="text-[#6A8759]">"Server started"</span>)</div>
                    <div>&#125;</div>
                  </div>
                )}
                {codeStyleLang === 'JSON' && (
                  <div className="space-y-0.5">
                    <div>&#123;</div>
                    <div>{' '.repeat(codeStyleRules.JSON.indentSize)}<span className="text-[#6A8759]">"name"</span>: <span className="text-[#6A8759]">"intellij-app"</span>,</div>
                    <div>{' '.repeat(codeStyleRules.JSON.indentSize)}<span className="text-[#6A8759]">"version"</span>: <span className="text-[#6A8759]">"1.0.0"</span>,</div>
                    <div>{' '.repeat(codeStyleRules.JSON.indentSize)}<span className="text-[#6A8759]">"private"</span>: <span className="text-[#CC7832]">true</span></div>
                    <div>&#125;</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Editor > Inspections */}
      {selectedId === 'editor-inspections' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">Inspections</h2>
              <p className="text-xs text-[#868A91]">Configure static code analysis rules, severity levels, and on-the-fly highlighting.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#868A91]">Profile:</span>
              <select className="bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-xs text-white outline-none">
                <option value="project">Project Default</option>
                <option value="ide">IDE Global Profile</option>
                <option value="strict">Strict Security Profile</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4 max-w-2xl text-xs">
            {/* Left: Inspections List */}
            <div className="col-span-3 border border-[#393B40] rounded bg-[#26282B] overflow-hidden flex flex-col">
              <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
                <span>Inspection Rule</span>
                <span>Severity</span>
              </div>
              <div className="divide-y divide-[#393B40]/40 overflow-y-auto max-h-[340px]">
                {inspectionsList.map((insp) => {
                  const isSelected = selectedInspectionId === insp.id;
                  return (
                    <div 
                      key={insp.id}
                      onClick={() => setSelectedInspectionId(insp.id)} 
                      className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${isSelected ? 'bg-[#2E436E]/60 text-white' : 'hover:bg-[#35373B] text-[#DFE1E5]'}`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={insp.enabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setInspectionsList(prev => prev.map(p => p.id === insp.id ? { ...p, enabled: val } : p));
                            setIsDirty(true);
                          }}
                          className="accent-[#3574F0] rounded" 
                        />
                        <span className="text-[11.5px] truncate max-w-[180px]" title={insp.name}>{insp.name}</span>
                      </label>

                      <select
                        value={insp.severity}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const sev = e.target.value as any;
                          setInspectionsList(prev => prev.map(p => p.id === insp.id ? { ...p, severity: sev } : p));
                          setIsDirty(true);
                        }}
                        className="bg-[#1E1F22] border border-[#393B40] rounded px-1.5 py-0.5 text-[10.5px] text-white outline-none"
                      >
                        <option value="Error">Error</option>
                        <option value="Warning">Warning</option>
                        <option value="Weak Warning">Weak Warning</option>
                        <option value="Info">Info</option>
                        <option value="Typo">Typo</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Inspection Rule Details */}
            <div className="col-span-2 border border-[#393B40] rounded bg-[#26282B] p-3 flex flex-col justify-between">
              {(() => {
                const cur = inspectionsList.find(i => i.id === selectedInspectionId) || inspectionsList[0];
                return (
                  <div className="space-y-3">
                    <div>
                      <div className="font-semibold text-white text-xs">{cur.name}</div>
                      <div className="text-[11px] text-[#868A91] mt-0.5">Category: Code Quality & Analysis</div>
                    </div>
                    <div className="p-2 bg-[#1E1F22] rounded border border-[#393B40]/60 text-[11px] text-[#A9B7C6] leading-relaxed">
                      {cur.severity === 'Error' && 'Flags broken syntax, unresolved symbols, and fatal compilation faults.'}
                      {cur.severity === 'Warning' && 'Warns against dead code, unused imports, redundant variables, and potential memory leaks.'}
                      {cur.severity === 'Weak Warning' && 'Identifies style convention deviations (such as PEP-8 naming or missing function return types).'}
                      {cur.severity === 'Typo' && 'Checks spelling mistakes in identifiers, strings, and code comments.'}
                      {cur.severity === 'Info' && 'Provides informational suggestions and refactoring opportunities.'}
                    </div>
                    <div className="pt-2 border-t border-[#393B40]/60 space-y-1.5">
                      <span className="text-[11px] text-[#868A91]">Status:</span>
                      <div className="flex items-center gap-1.5 text-xs text-[#59A869]">
                        <CheckCircle2 size={13} /> Active in editor highlight
                      </div>
                    </div>
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={() => onShowToast?.('Inspections Reset', 'Restored default JetBrains inspection settings', 'info')}
                className="w-full mt-4 py-1 bg-[#1E1F22] hover:bg-[#35373B] text-[#DFE1E5] rounded border border-[#393B40] text-[11px]"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Editor > Editor Tabs */}
      {selectedId === 'editor-tabs' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Editor Tabs</h2>
            <p className="text-xs text-[#868A91]">Configure tab appearance, placement, limit, and closing policy.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            {/* Tab Placement */}
            <div className="flex items-center justify-between">
              <label className="text-[#DFE1E5]">Tab placement:</label>
              <select
                value={formSettings.tabPlacement || 'top'}
                onChange={(e) => updateSetting('tabPlacement', e.target.value as any)}
                className="bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none w-48"
              >
                <option value="top">Top (Default)</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="none">None</option>
              </select>
            </div>

            {/* Tab Limit */}
            <div className="flex items-center justify-between">
              <label className="text-[#DFE1E5]">Tab limit:</label>
              <div className="flex items-center gap-2 w-48">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={formSettings.tabLimit || 20}
                  onChange={(e) => updateSetting('tabLimit', Number(e.target.value))}
                  className="w-20 bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1 text-xs text-[#DFE1E5] outline-none"
                />
                <span className="text-[#868A91]">tabs (Default: 20)</span>
              </div>
            </div>

            {/* Tab Options */}
            <div className="pt-3 border-t border-[#393B40] space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.markModifiedTabs ?? true}
                  onChange={(e) => updateSetting('markModifiedTabs', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Mark modified tabs with asterisk (*)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.enableFileColors ?? true}
                  onChange={(e) => updateSetting('enableFileColors', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Enable File Colors in editor tab headers</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Close tab on middle mouse click</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Show close button on active tab</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Editor > File Encodings */}
      {selectedId === 'editor-file-encodings' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">File Encodings</h2>
            <p className="text-xs text-[#868A91]">Configure character encoding standards for workspace files.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">Global Encoding:</span>
              <select
                value={formSettings.globalEncoding || 'UTF-8'}
                onChange={(e) => updateSetting('globalEncoding', e.target.value)}
                className="bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1 text-white w-48 outline-none"
              >
                <option value="UTF-8">UTF-8 (Default)</option>
                <option value="US-ASCII">US-ASCII</option>
                <option value="ISO-8859-1">ISO-8859-1</option>
                <option value="UTF-16">UTF-16</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">Project Encoding:</span>
              <select
                value={formSettings.projectEncoding || 'UTF-8'}
                onChange={(e) => updateSetting('projectEncoding', e.target.value)}
                className="bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1 text-white w-48 outline-none"
              >
                <option value="UTF-8">UTF-8</option>
                <option value="windows-1252">windows-1252</option>
                <option value="Shift_JIS">Shift_JIS</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span className="text-[#DFE1E5]">Create new files without Byte Order Mark (BOM)</span>
            </label>
          </div>
        </div>
      )}

      {/* Sub-page: Editor > Live Templates */}
      {selectedId === 'editor-live-templates' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">Live Templates</h2>
              <p className="text-xs text-[#868A91]">Insert frequently-used boilerplate snippets by typing abbreviations and pressing Tab.</p>
            </div>
            <button
              onClick={() => {
                const newId = `lt_${Date.now()}`;
                const newTemplate = {
                  id: newId,
                  abbr: `snippet${liveTemplates.length + 1}`,
                  desc: 'Custom user template',
                  body: '// Your code here\n$END$',
                };
                setLiveTemplates(prev => [...prev, newTemplate]);
                setSelectedTemplateId(newId);
                setIsDirty(true);
                onShowToast?.('Template Created', `Added template ${newTemplate.abbr}`, 'success');
              }}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
            >
              <Plus size={12} />
              Add Template (+)
            </button>
          </div>

          <div className="grid grid-cols-5 gap-4 max-w-2xl text-xs">
            {/* Left: Template List */}
            <div className="col-span-2 border border-[#393B40] rounded bg-[#26282B] overflow-hidden flex flex-col">
              <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
                <span>Abbreviation</span>
                <span>Actions</span>
              </div>
              <div className="divide-y divide-[#393B40]/50 overflow-y-auto max-h-[340px] font-mono text-[11.5px]">
                {liveTemplates.map((lt) => (
                  <div
                    key={lt.id}
                    onClick={() => setSelectedTemplateId(lt.id)}
                    className={`px-3 py-2 cursor-pointer flex justify-between items-center group transition-colors ${
                      selectedTemplateId === lt.id ? 'bg-[#2E436E] text-white font-medium' : 'hover:bg-[#35373B] text-[#DFE1E5]'
                    }`}
                  >
                    <span>{lt.abbr}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (liveTemplates.length <= 1) return;
                        setLiveTemplates(prev => prev.filter(t => t.id !== lt.id));
                        setSelectedTemplateId(liveTemplates[0]?.id || '');
                        setIsDirty(true);
                      }}
                      className="text-[#868A91] hover:text-[#E05555] opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                      title="Delete template"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Template Editor */}
            <div className="col-span-3 border border-[#393B40] rounded bg-[#26282B] p-3.5 space-y-3">
              {(() => {
                const curr = liveTemplates.find(t => t.id === selectedTemplateId) || liveTemplates[0];
                if (!curr) return null;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[#868A91] block mb-1">Abbreviation:</label>
                        <input
                          type="text"
                          value={curr.abbr}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLiveTemplates(prev => prev.map(t => t.id === curr.id ? { ...t, abbr: val } : t));
                            setIsDirty(true);
                          }}
                          className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1 text-white font-mono outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[#868A91] block mb-1">Expand with:</label>
                        <select className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white outline-none">
                          <option value="tab">Tab</option>
                          <option value="space">Space</option>
                          <option value="enter">Enter</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[#868A91] block mb-1">Description:</label>
                      <input
                        type="text"
                        value={curr.desc}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLiveTemplates(prev => prev.map(t => t.id === curr.id ? { ...t, desc: val } : t));
                          setIsDirty(true);
                        }}
                        className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2.5 py-1 text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[#868A91] block mb-1">Template Code (Use $VAR$ and $END$):</label>
                      <textarea
                        rows={5}
                        value={curr.body}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLiveTemplates(prev => prev.map(t => t.id === curr.id ? { ...t, body: val } : t));
                          setIsDirty(true);
                        }}
                        className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded p-2.5 text-white font-mono text-[11.5px] outline-none resize-none leading-relaxed"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-[#868A91]">Context: Applicable in all files</span>
                      <span className="text-[11px] text-[#3574F0] hover:underline cursor-pointer">Change...</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Editor > General > Appearance */}
      {selectedId === 'editor-appearance' && (
        <div className="space-y-6 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Appearance</h2>
            <p className="text-xs text-[#868A91]">Configure editor visual elements, line numbers, caret behavior, and whitespace rendering.</p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="p-4 bg-[#26282B] border border-[#393B40] rounded space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.lineNumbers ?? true}
                  onChange={(e) => updateSetting('lineNumbers', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white font-medium">Show line numbers</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.editorCaretBlinking ?? true}
                  onChange={(e) => updateSetting('editorCaretBlinking', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white font-medium">Caret blinking</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.editorSmoothScrolling ?? true}
                  onChange={(e) => updateSetting('editorSmoothScrolling', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white font-medium">Smooth scrolling</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.editorShowWhitespaces ?? false}
                  onChange={(e) => updateSetting('editorShowWhitespaces', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white font-medium">Show whitespaces (dots for spaces, arrows for tabs)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.editorShowIndentGuides ?? true}
                  onChange={(e) => updateSetting('editorShowIndentGuides', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white font-medium">Show indent guides</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.minimap ?? false}
                  onChange={(e) => updateSetting('minimap', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white font-medium">Show code minimap scrollbar</span>
              </label>
            </div>

            <div className="p-3.5 bg-[#26282B] border border-[#393B40] rounded flex items-center justify-between">
              <span className="text-[#DFE1E5]">Hard wrap guide column:</span>
              <input
                type="number"
                min={60}
                max={200}
                value={formSettings.editorHardWrapGuide ?? 120}
                onChange={(e) => updateSetting('editorHardWrapGuide', Number(e.target.value))}
                className="w-24 bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white text-center outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Editor > General > Smart Keys */}
      {selectedId === 'editor-smart-keys' && (
        <div className="space-y-6 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Smart Keys</h2>
            <p className="text-xs text-[#868A91]">Configure automatic bracket pairing, quote matching, and smart indentation behaviors.</p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="p-4 bg-[#26282B] border border-[#393B40] rounded space-y-3">
              <div className="font-semibold text-white pb-1 border-b border-[#393B40]/60">Auto-insert and Matching:</div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.editorAutoCloseBrackets ?? true}
                  onChange={(e) => updateSetting('editorAutoCloseBrackets', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white">Insert paired brackets (), [], {}</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.editorAutoCloseQuotes ?? true}
                  onChange={(e) => updateSetting('editorAutoCloseQuotes', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white">Insert paired quotes "" and ''</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.editorSurroundSelection ?? true}
                  onChange={(e) => updateSetting('editorSurroundSelection', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white">Surround selection on typing quotes or brackets</span>
              </label>
            </div>

            <div className="p-4 bg-[#26282B] border border-[#393B40] rounded space-y-3">
              <div className="font-semibold text-white pb-1 border-b border-[#393B40]/60">Enter & Backspace:</div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.editorSmartIndent ?? true}
                  onChange={(e) => updateSetting('editorSmartIndent', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white">Smart indent on Enter</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={true}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white">Unindent on Backspace to previous indentation level</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Editor > General > Code Completion */}
      {selectedId === 'editor-code-completion' && (
        <div className="space-y-6 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Code Completion</h2>
            <p className="text-xs text-[#868A91]">Configure autocomplete popup timing, case matching, and suggestion insertion.</p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="p-4 bg-[#26282B] border border-[#393B40] rounded space-y-3.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={true}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white font-medium">Show suggestions as you type (Basic Completion)</span>
              </label>

              <div className="flex items-center justify-between pl-6">
                <span className="text-[#868A91]">Completion popup delay (ms):</span>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={formSettings.editorCompletionDelay ?? 50}
                  onChange={(e) => updateSetting('editorCompletionDelay', Number(e.target.value))}
                  className="w-24 bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white text-center outline-none"
                />
              </div>

              <div className="flex items-center justify-between pl-6">
                <span className="text-[#868A91]">Match case:</span>
                <select
                  value={formSettings.editorMatchCase || 'first'}
                  onChange={(e) => updateSetting('editorMatchCase', e.target.value as any)}
                  className="bg-[#1E1F22] border border-[#393B40] rounded px-3 py-1 text-white outline-none"
                >
                  <option value="first">First letter only</option>
                  <option value="all">All letters</option>
                  <option value="none">None (Case-insensitive)</option>
                </select>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer pl-6">
                <input
                  type="checkbox"
                  checked={formSettings.editorInsertOnSpace ?? false}
                  onChange={(e) => updateSetting('editorInsertOnSpace', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white">Insert selected suggestion by Space key</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer pl-6">
                <input
                  type="checkbox"
                  defaultChecked={true}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white">Show parameter name and type hints</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer pl-6">
                <input
                  type="checkbox"
                  defaultChecked={true}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white">Sort completion items based on machine learning & relevance</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Editor > General > Code Folding */}
      {selectedId === 'editor-code-folding' && (
        <div className="space-y-6 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Code Folding</h2>
            <p className="text-xs text-[#868A91]">Configure code folding outlines and default initial folding states on file open.</p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="p-4 bg-[#26282B] border border-[#393B40] rounded space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer pb-2 border-b border-[#393B40]/60">
                <input
                  type="checkbox"
                  checked={formSettings.codeFolding ?? true}
                  onChange={(e) => updateSetting('codeFolding', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white font-medium">Show code folding outline in gutter</span>
              </label>

              <div className="font-semibold text-white pt-1">Fold by default:</div>
              <label className="flex items-center gap-2.5 cursor-pointer pl-2">
                <input
                  type="checkbox"
                  checked={formSettings.editorFoldImports ?? true}
                  onChange={(e) => updateSetting('editorFoldImports', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white">File header comments & imports</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer pl-2">
                <input
                  type="checkbox"
                  checked={formSettings.editorFoldDocComments ?? false}
                  onChange={(e) => updateSetting('editorFoldDocComments', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white">Documentation comments (Javadoc, Rustdoc, TSDoc)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer pl-2">
                <input
                  type="checkbox"
                  checked={formSettings.editorFoldMethodBodies ?? false}
                  onChange={(e) => updateSetting('editorFoldMethodBodies', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white">Method bodies</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Editor > General > Breadcrumbs */}
      {selectedId === 'editor-breadcrumbs' && (
        <div className="space-y-6 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Breadcrumbs</h2>
            <p className="text-xs text-[#868A91]">Show navigation hierarchy breadcrumbs for classes, functions, and tags.</p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="p-4 bg-[#26282B] border border-[#393B40] rounded space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">Breadcrumbs placement:</span>
                <select
                  value={formSettings.editorBreadcrumbsPosition || 'bottom'}
                  onChange={(e) => updateSetting('editorBreadcrumbsPosition', e.target.value as any)}
                  className="bg-[#1E1F22] border border-[#393B40] rounded px-3 py-1.5 text-white outline-none"
                >
                  <option value="bottom">At the bottom (IntelliJ Default)</option>
                  <option value="top">At the top</option>
                  <option value="none">Don't show</option>
                </select>
              </div>

              <div className="pt-2 border-t border-[#393B40]/60 space-y-2">
                <span className="text-[#868A91] block">Show breadcrumbs for languages:</span>
                <div className="grid grid-cols-2 gap-2 pl-1">
                  {['Java', 'TypeScript / JavaScript', 'Rust', 'Python', 'Go', 'HTML / XML', 'CSS / SCSS', 'JSON / YAML'].map((lang) => (
                    <label key={lang} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked={true} className="accent-[#3574F0] rounded" />
                      <span className="text-[#DFE1E5]">{lang}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Editor > File and Code Templates */}
      {selectedId === 'editor-file-templates' && (
        <div className="space-y-5 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">File and Code Templates</h2>
            <p className="text-xs text-[#868A91]">Customize the boilerplate structure generated when creating new files.</p>
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-2xl">
            <div className="border border-[#393B40] rounded bg-[#26282B] p-2 space-y-1">
              <div className="font-semibold text-white px-2 py-1 border-b border-[#393B40]/60">Templates</div>
              {fileTemplates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedFileTemplateId(t.id)}
                  className={`p-2 rounded cursor-pointer flex justify-between items-center transition-colors ${
                    selectedFileTemplateId === t.id ? 'bg-[#2E436E] text-white font-medium' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  <span>{t.name}</span>
                  <span className="text-[10px] text-[#868A91] font-mono">.{t.ext}</span>
                </div>
              ))}
            </div>

            <div className="col-span-2 p-3 bg-[#26282B] border border-[#393B40] rounded space-y-3">
              {(() => {
                const curr = fileTemplates.find(t => t.id === selectedFileTemplateId) || fileTemplates[0];
                return (
                  <>
                    <div className="flex items-center justify-between pb-1 border-b border-[#393B40]/60">
                      <span className="font-semibold text-white">{curr.name}</span>
                      <span className="text-[11px] text-[#868A91] font-mono">Extension: {curr.ext}</span>
                    </div>

                    <div>
                      <label className="text-[#868A91] block mb-1">Template Content (${`{NAME}`}, ${`{PACKAGE_NAME}`}):</label>
                      <textarea
                        rows={10}
                        value={curr.body}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFileTemplates(prev => prev.map(t => t.id === curr.id ? { ...t, body: val } : t));
                          setIsDirty(true);
                        }}
                        className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded p-2.5 text-white font-mono text-[11.5px] outline-none resize-none leading-relaxed"
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Editor > Emmet */}
      {selectedId === 'editor-emmet' && (
        <div className="space-y-6 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Emmet</h2>
            <p className="text-xs text-[#868A91]">Configure high-speed HTML and CSS abbreviation expansions.</p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="p-4 bg-[#26282B] border border-[#393B40] rounded space-y-3.5">
              <label className="flex items-center gap-2.5 cursor-pointer pb-2 border-b border-[#393B40]/60">
                <input
                  type="checkbox"
                  checked={formSettings.emmetEnabled ?? true}
                  onChange={(e) => updateSetting('emmetEnabled', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white font-medium">Enable Emmet abbreviations</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer pl-2">
                <input
                  type="checkbox"
                  checked={formSettings.editorEmmetTabExpand ?? true}
                  onChange={(e) => updateSetting('editorEmmetTabExpand', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white">Expand abbreviation with Tab key</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer pl-2">
                <input type="checkbox" defaultChecked={true} className="accent-[#3574F0] rounded" />
                <span className="text-white">Enable in JSX and TSX templates</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer pl-2">
                <input type="checkbox" defaultChecked={true} className="accent-[#3574F0] rounded" />
                <span className="text-white">Automatically close generated XML / HTML tags</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Editor > Language Injections */}
      {selectedId === 'editor-injections' && (
        <div className="space-y-5 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Language Injections</h2>
            <p className="text-xs text-[#868A91]">Provide syntax highlighting and autocomplete for embedded code snippets (SQL, RegExp, JSON) inside strings.</p>
          </div>

          <div className="space-y-3 max-w-xl">
            <div className="border border-[#393B40] rounded overflow-hidden bg-[#26282B]">
              <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91]">
                <span>Name & Target</span>
                <span>Injected Language</span>
                <span>Active</span>
              </div>
              <div className="divide-y divide-[#393B40]/50">
                {languageInjections.map((inj) => (
                  <div key={inj.id} className="px-3 py-2.5 flex items-center justify-between hover:bg-[#35373B]/50 transition-colors">
                    <div>
                      <div className="text-white font-medium">{inj.name}</div>
                      <div className="text-[10px] text-[#868A91] font-mono">Trigger: {inj.prefix}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-[#3574F0]/20 text-[#679EF5] font-mono">{inj.lang}</span>
                    <input
                      type="checkbox"
                      checked={inj.enabled}
                      onChange={(e) => {
                        setLanguageInjections(prev => prev.map(item => item.id === inj.id ? { ...item, enabled: e.target.checked } : item));
                        setIsDirty(true);
                      }}
                      className="accent-[#3574F0] rounded"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
