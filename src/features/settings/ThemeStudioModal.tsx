import React, { useState } from 'react';
import { 
  X, 
  Palette, 
  Check, 
  Sparkles, 
  Download, 
  Upload, 
  RotateCcw, 
  Eye, 
  Code2, 
  CheckCircle2, 
  Sun, 
  Moon 
} from 'lucide-react';
import { IdeThemeId, SyntaxTokenColors, ThemeDefinition } from '../../types/theme';
import { IDE_THEMES, getThemeById, applyIdeTheme } from '../../themes/themeManager';

interface ThemeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentThemeId: IdeThemeId;
  onApplyTheme: (themeId: IdeThemeId, customSyntax?: Partial<SyntaxTokenColors>) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const renderHighlightedCode = (lang: string, syntax: SyntaxTokenColors) => {
  if (lang === 'typescript') {
    return [
      { text: '// TypeScript Sample\n', color: syntax.comment },
      { text: 'interface ', color: syntax.keyword },
      { text: 'UserProfile', color: syntax.type },
      { text: ' {\n  id: ' },
      { text: 'number', color: syntax.type },
      { text: ';\n  username: ' },
      { text: 'string', color: syntax.type },
      { text: ';\n  isActive: ' },
      { text: 'boolean', color: syntax.type },
      { text: ';\n}\n\n' },
      { text: 'export function ', color: syntax.keyword },
      { text: 'getUserGreeting', color: syntax.function },
      { text: '(user: ' },
      { text: 'UserProfile', color: syntax.type },
      { text: '): ' },
      { text: 'string', color: syntax.type },
      { text: ' {\n  ' },
      { text: 'if ', color: syntax.keyword },
      { text: '(user.isActive) {\n    ' },
      { text: 'const ', color: syntax.keyword },
      { text: 'greeting = ' },
      { text: '`Welcome back, ${user.username}!`', color: syntax.string },
      { text: ';\n    ' },
      { text: 'console.log', color: syntax.function },
      { text: '(greeting);\n    ' },
      { text: 'return ', color: syntax.keyword },
      { text: 'greeting;\n  }\n  ' },
      { text: 'return ', color: syntax.keyword },
      { text: '"Account inactive"', color: syntax.string },
      { text: ';\n}' }
    ];
  } else if (lang === 'rust') {
    return [
      { text: '// Rust Sample\n', color: syntax.comment },
      { text: '#[derive(Debug, Clone)]\n', color: syntax.annotation },
      { text: 'pub struct ', color: syntax.keyword },
      { text: 'ProjectConfig', color: syntax.type },
      { text: ' {\n  ' },
      { text: 'pub ', color: syntax.keyword },
      { text: 'name: ' },
      { text: 'String', color: syntax.type },
      { text: ',\n  ' },
      { text: 'pub ', color: syntax.keyword },
      { text: 'max_workers: ' },
      { text: 'usize', color: syntax.type },
      { text: ',\n}\n\n' },
      { text: 'impl ', color: syntax.keyword },
      { text: 'ProjectConfig', color: syntax.type },
      { text: ' {\n  ' },
      { text: 'pub fn ', color: syntax.keyword },
      { text: 'new', color: syntax.function },
      { text: '(name: &' },
      { text: 'str', color: syntax.type },
      { text: ') -> ' },
      { text: 'Self', color: syntax.type },
      { text: ' {\n    ' },
      { text: 'println!', color: syntax.function },
      { text: '("Initializing: {}", name);\n    ' },
      { text: 'Self', color: syntax.type },
      { text: ' {\n      name: name.' },
      { text: 'to_string', color: syntax.function },
      { text: '(),\n      max_workers: ' },
      { text: '4', color: syntax.number },
      { text: ',\n    }\n  }\n}' }
    ];
  } else if (lang === 'java') {
    return [
      { text: '// Java Sample\n', color: syntax.comment },
      { text: 'package ', color: syntax.keyword },
      { text: 'com.intellij.clone;\n\n' },
      { text: 'public class ', color: syntax.keyword },
      { text: 'ApplicationService', color: syntax.type },
      { text: ' {\n  ' },
      { text: 'private static final int ', color: syntax.keyword },
      { text: 'PORT = ' },
      { text: '8080', color: syntax.number },
      { text: ';\n\n  ' },
      { text: 'public static void ', color: syntax.keyword },
      { text: 'main', color: syntax.function },
      { text: '(' },
      { text: 'String', color: syntax.type },
      { text: '[] args) {\n    ' },
      { text: 'String', color: syntax.type },
      { text: ' status = ' },
      { text: '"Online"', color: syntax.string },
      { text: ';\n    ' },
      { text: 'System.out.println', color: syntax.function },
      { text: '("Server online on: " + PORT);\n  }\n}' }
    ];
  } else {
    return [
      { text: '-- SQL Sample\n', color: syntax.comment },
      { text: 'SELECT\n', color: syntax.keyword },
      { text: '  p.id,\n  p.name ' },
      { text: 'AS ', color: syntax.keyword },
      { text: 'project_name,\n  ' },
      { text: 'COUNT', color: syntax.function },
      { text: '(u.id) ' },
      { text: 'AS ', color: syntax.keyword },
      { text: 'contributor_count\n' },
      { text: 'FROM ', color: syntax.keyword },
      { text: 'projects p\n' },
      { text: 'JOIN ', color: syntax.keyword },
      { text: 'users u ' },
      { text: 'ON ', color: syntax.keyword },
      { text: 'p.owner_id = u.id\n' },
      { text: 'WHERE ', color: syntax.keyword },
      { text: 'p.status = ' },
      { text: "'active'\n", color: syntax.string },
      { text: 'GROUP BY ', color: syntax.keyword },
      { text: 'p.id, p.name\n' },
      { text: 'ORDER BY ', color: syntax.keyword },
      { text: 'contributor_count ' },
      { text: 'DESC', color: syntax.keyword },
      { text: ';' }
    ];
  }
};

export const ThemeStudioModal: React.FC<ThemeStudioModalProps> = ({
  isOpen,
  onClose,
  currentThemeId,
  onApplyTheme,
  onShowToast
}) => {
  const [selectedThemeId, setSelectedThemeId] = useState<IdeThemeId>(currentThemeId);
  const [activeTab, setActiveTab] = useState<'gallery' | 'customizer'>('gallery');
  const [sampleLang, setSampleLang] = useState<'typescript' | 'rust' | 'java' | 'sql'>('typescript');

  const currentDef = getThemeById(selectedThemeId);
  const [customSyntax, setCustomSyntax] = useState<SyntaxTokenColors>({ ...currentDef.syntaxColors });
  const [isDirty, setIsDirty] = useState(false);

  // Sync custom syntax when selecting a different theme in gallery
  const handleSelectTheme = (id: IdeThemeId) => {
    setSelectedThemeId(id);
    const def = getThemeById(id);
    setCustomSyntax({ ...def.syntaxColors });
    setIsDirty(false);
  };

  const handleColorChange = (key: keyof SyntaxTokenColors, val: string) => {
    setCustomSyntax(prev => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  const handleResetColors = () => {
    const def = getThemeById(selectedThemeId);
    setCustomSyntax({ ...def.syntaxColors });
    setIsDirty(false);
    onShowToast?.('Reset Scheme', 'Restored default syntax palette', 'info');
  };

  const handleApply = () => {
    onApplyTheme(selectedThemeId, isDirty ? customSyntax : undefined);
    applyIdeTheme(selectedThemeId, isDirty ? customSyntax : undefined);
    onShowToast?.('Theme Applied', `Activated ${currentDef.name}`, 'success');
    onClose();
  };

  const handleExportJson = () => {
    const exportData = {
      name: `${currentDef.name} Custom`,
      baseTheme: selectedThemeId,
      version: '2025.1',
      exportedAt: new Date().toISOString(),
      colors: currentDef.colors,
      syntaxColors: customSyntax
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedThemeId}-scheme.icls.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast?.('Export Color Scheme', 'Exported scheme to .icls.json', 'success');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.syntaxColors) {
          setCustomSyntax(prev => ({ ...prev, ...parsed.syntaxColors }));
          setIsDirty(true);
          setActiveTab('customizer');
          onShowToast?.('Import Success', 'Imported custom syntax color scheme', 'success');
        }
      } catch (err) {
        onShowToast?.('Import Failed', 'Invalid scheme JSON format', 'error');
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[960px] h-[640px] bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl flex flex-col overflow-hidden text-[#DFE1E5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-10 bg-[#212226] border-b border-[#393B40] px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-[#3574F0]" />
            <span className="text-sm font-semibold text-white">IntelliJ Theme Studio & Color Schemes</span>
            <span className="text-[10px] bg-[#3574F0]/20 text-[#3574F0] px-2 py-0.5 rounded font-mono font-medium">
              Ecosystem 2025.1
            </span>
          </div>
          <button 
            onClick={onClose}
            className="text-[#868A91] hover:text-white p-1 rounded hover:bg-[#35373B] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="h-10 border-b border-[#393B40] bg-[#26282B] px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
                activeTab === 'gallery'
                  ? 'bg-[#3574F0] text-white font-medium shadow-sm'
                  : 'text-[#868A91] hover:text-white hover:bg-[#35373B]'
              }`}
            >
              <Palette size={13} />
              Theme Gallery ({IDE_THEMES.length})
            </button>
            <button
              onClick={() => setActiveTab('customizer')}
              className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
                activeTab === 'customizer'
                  ? 'bg-[#3574F0] text-white font-medium shadow-sm'
                  : 'text-[#868A91] hover:text-white hover:bg-[#35373B]'
              }`}
            >
              <Code2 size={13} />
              Syntax Customizer & Live Preview
              {isDirty && <span className="w-2 h-2 rounded-full bg-[#F1A23A]" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="px-2.5 py-1 text-xs bg-[#35373B] hover:bg-[#43454A] text-[#DFE1E5] rounded cursor-pointer flex items-center gap-1 transition-colors">
              <Upload size={12} />
              Import Scheme
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>
            <button
              onClick={handleExportJson}
              className="px-2.5 py-1 text-xs bg-[#35373B] hover:bg-[#43454A] text-[#DFE1E5] rounded flex items-center gap-1 transition-colors"
            >
              <Download size={12} />
              Export .icls.json
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        {activeTab === 'gallery' ? (
          /* Theme Gallery View */
          <div className="flex-1 p-5 overflow-y-auto">
            <div className="grid grid-cols-3 gap-4">
              {IDE_THEMES.map((t) => {
                const isCurrent = t.id === currentThemeId;
                const isSelected = t.id === selectedThemeId;

                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTheme(t.id)}
                    className={`rounded-lg border p-4 cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#3574F0] bg-[#3574F0]/10 ring-1 ring-[#3574F0] shadow-lg'
                        : 'border-[#393B40] bg-[#212226] hover:border-[#4E5157]'
                    }`}
                  >
                    <div>
                      {/* Title & Badge */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{t.name}</span>
                          {t.type === 'dark' ? (
                            <Moon size={12} className="text-[#868A91]" />
                          ) : (
                            <Sun size={12} className="text-[#F1A23A]" />
                          )}
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] bg-[#59A869]/20 text-[#59A869] px-2 py-0.5 rounded font-mono font-medium">
                            Active
                          </span>
                        )}
                        {t.badge && !isCurrent && (
                          <span className="text-[10px] bg-white/10 text-[#DFE1E5] px-1.5 py-0.5 rounded font-mono">
                            {t.badge}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#868A91] mb-3 line-clamp-2 leading-relaxed">
                        {t.description}
                      </p>

                      {/* Color Palette Preview Swatches */}
                      <div className="border border-[#393B40] rounded p-2 bg-[#1E1F22] mb-3 space-y-1.5">
                        <div className="text-[10px] font-mono text-[#868A91] flex justify-between">
                          <span>UI Palette</span>
                          <span className="uppercase">{t.type}</span>
                        </div>
                        <div className="flex h-5 rounded overflow-hidden border border-white/10">
                          <div style={{ backgroundColor: t.colors.bgPrimary }} className="flex-1" title="Editor Background" />
                          <div style={{ backgroundColor: t.colors.bgSecondary }} className="flex-1" title="Tool Windows" />
                          <div style={{ backgroundColor: t.colors.accentColor }} className="flex-1" title="Accent Accent" />
                          <div style={{ backgroundColor: t.colors.textPrimary }} className="flex-1" title="Text Primary" />
                          <div style={{ backgroundColor: t.colors.selectionBg }} className="flex-1" title="Selection" />
                        </div>

                        <div className="text-[10px] font-mono text-[#868A91] pt-1">Syntax Tokens</div>
                        <div className="flex h-3 rounded overflow-hidden">
                          <div style={{ backgroundColor: t.syntaxColors.keyword }} className="flex-1" title="Keywords" />
                          <div style={{ backgroundColor: t.syntaxColors.string }} className="flex-1" title="Strings" />
                          <div style={{ backgroundColor: t.syntaxColors.number }} className="flex-1" title="Numbers" />
                          <div style={{ backgroundColor: t.syntaxColors.function }} className="flex-1" title="Functions" />
                          <div style={{ backgroundColor: t.syntaxColors.type }} className="flex-1" title="Types" />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#393B40]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTheme(t.id);
                          setActiveTab('customizer');
                        }}
                        className="text-xs text-[#3574F0] hover:underline flex items-center gap-1 font-medium"
                      >
                        <Eye size={12} />
                        Customize
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedThemeId(t.id);
                          onApplyTheme(t.id);
                          applyIdeTheme(t.id);
                          onShowToast?.('Theme Applied', `Applied ${t.name}`, 'success');
                        }}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                          isCurrent
                            ? 'bg-[#59A869]/20 text-[#59A869] cursor-default'
                            : 'bg-[#3574F0] hover:bg-[#3574F0]/90 text-white'
                        }`}
                      >
                        {isCurrent ? <Check size={12} /> : null}
                        {isCurrent ? 'Current' : 'Apply'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Syntax Token Customizer & Live Code Preview View */
          <div className="flex-1 flex overflow-hidden">
            {/* Left Column: Token Pickers */}
            <div className="w-[340px] border-r border-[#393B40] bg-[#26282B] p-4 overflow-y-auto flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                    Token Colors
                  </span>
                  <button
                    onClick={handleResetColors}
                    className="text-[11px] text-[#868A91] hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw size={11} />
                    Reset
                  </button>
                </div>

                <div className="divide-y divide-[#393B40] border border-[#393B40] rounded bg-[#212226] overflow-hidden text-xs">
                  {[
                    { key: 'keyword', label: 'Keywords (fn, let, class, pub)', sample: '#CC7832' },
                    { key: 'string', label: 'Strings ("Hello World")', sample: '#6A8759' },
                    { key: 'number', label: 'Numbers (42, 3.14)', sample: '#6897BB' },
                    { key: 'function', label: 'Functions (println, run)', sample: '#FFC66D' },
                    { key: 'type', label: 'Types (String, Self, bool)', sample: '#299999' },
                    { key: 'comment', label: 'Comments (// remarks)', sample: '#7A7E85' },
                    { key: 'annotation', label: 'Annotations (#[derive], @Override)', sample: '#BBB529' },
                    { key: 'variable', label: 'Variables / Fields', sample: '#9876AA' },
                  ].map(({ key, label }) => {
                    const colorVal = (customSyntax as any)[key] || '#DFE1E5';

                    return (
                      <div key={key} className="flex items-center justify-between p-2 hover:bg-[#2B2D30] transition-colors">
                        <span className="text-[#DFE1E5] font-mono text-[11px]">{label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#868A91] font-mono">{colorVal}</span>
                          <input
                            type="color"
                            value={colorVal}
                            onChange={(e) => handleColorChange(key as keyof SyntaxTokenColors, e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status info */}
              <div className="pt-3 border-t border-[#393B40] text-[11px] text-[#868A91] flex items-center justify-between font-mono">
                <span>Base: {currentDef.name}</span>
                {isDirty && <span className="text-[#F1A23A]">• Unsaved Changes</span>}
              </div>
            </div>

            {/* Right Column: Multi-Language Live Preview */}
            <div className="flex-1 flex flex-col bg-[#1E1F22] p-4 overflow-hidden">
              {/* Language Selector Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-[#393B40] mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#868A91] mr-1">Preview Language:</span>
                  {(['typescript', 'rust', 'java', 'sql'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSampleLang(lang)}
                      className={`px-2.5 py-0.5 rounded text-xs font-mono transition-colors uppercase ${
                        sampleLang === lang
                          ? 'bg-[#3574F0] text-white font-medium'
                          : 'bg-[#2B2D30] text-[#868A91] hover:text-white'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-[#868A91] flex items-center gap-1">
                  <Sparkles size={11} className="text-[#3574F0]" />
                  JetBrains Dynamic Monarch Engine
                </div>
              </div>

              {/* Styled Code Box */}
              <div className="flex-1 rounded-lg border border-[#393B40] bg-[#1E1F22] p-4 font-mono text-[12.5px] leading-relaxed overflow-auto select-text">
                <pre className="whitespace-pre font-mono">
                  {renderHighlightedCode(sampleLang, customSyntax).map((token, i) => (
                    <span key={i} style={{ color: token.color }}>
                      {token.text}
                    </span>
                  ))}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="h-12 bg-[#26282B] border-t border-[#393B40] px-4 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-[#868A91]">
            Selected: <span className="text-white font-medium">{currentDef.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-1.5 rounded text-xs bg-[#3574F0] hover:bg-[#3574F0]/90 text-white font-medium shadow-sm transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 size={13} />
              Apply Scheme
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
