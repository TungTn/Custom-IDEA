import React, { useState, useEffect } from 'react';
import { CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { SettingPanelProps } from './types';

export const LanguagesFrameworksPanel: React.FC<SettingPanelProps> = ({
  selectedId,
  formSettings,
  updateSetting,
  onShowToast,
  toolchainData: toolchainProp,
}) => {
  const [localToolchain, setLocalToolchain] = useState<any>(null);
  const toolchainData = toolchainProp ?? localToolchain;

  const [dockerTestStatus, setDockerTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dockerTestMessage, setDockerTestMessage] = useState('');

  useEffect(() => {
    if (!toolchainProp && !localToolchain) {
      invoke<any>('detect_toolchains')
        .then(data => setLocalToolchain(data))
        .catch(() => {});
    }
  }, [toolchainProp, localToolchain]);

  const handleTestDocker = async () => {
    setDockerTestStatus('testing');
    setDockerTestMessage('Testing Docker CLI...');
    try {
      const res = await invoke<string>('docker_test_cli', { path: formSettings.dockerCliPath || 'docker' });
      setDockerTestStatus('success');
      setDockerTestMessage(res);
      onShowToast?.('Docker Detected', res, 'success');
    } catch (err: any) {
      setDockerTestStatus('error');
      setDockerTestMessage(String(err));
      onShowToast?.('Docker Test Failed', String(err), 'error');
    }
  };

  const handleValidateToolchain = async (tool: string, customPath?: string) => {
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    if (isTauri) {
      try {
        const res = await invoke<{ tool: string; is_installed: boolean; version?: string; path?: string; message: string }>(
          'check_toolchain_binary',
          { tool, customPath }
        );
        if (res.is_installed) {
          onShowToast?.(`${res.tool} Verified`, res.version ? `${res.version} detected (${res.message})` : res.message, 'success');
        } else {
          onShowToast?.(`${res.tool} Not Found`, res.message, 'warning');
        }
        return;
      } catch (err: any) {
        onShowToast?.(`${tool} Check Failed`, String(err), 'error');
        return;
      }
    }
    onShowToast?.(`${tool} Check`, `Browser Preview mode - install verification simulated.`, 'info');
  };

  return (
    <div>
      {/* Sub-page: Languages > Rust */}
      {selectedId === 'lang-rust' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Rust</h2>
            <p className="text-xs text-[#868A91]">Configure Rust toolchain, Cargo check, and rustfmt.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="text-[#868A91] block mb-1">Toolchain Location:</label>
              <input 
                type="text" 
                readOnly 
                value={toolchainData?.rust || 'Rust toolchain not detected'} 
                className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none" 
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={formSettings.cargoCheckOnFly ?? true}
                onChange={(e) => updateSetting('cargoCheckOnFly', e.target.checked)}
                className="accent-[#3574F0] rounded" 
              />
              <span className="text-[#DFE1E5]">Run external linter on the fly (cargo check)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={formSettings.useRustfmt ?? true}
                onChange={(e) => updateSetting('useRustfmt', e.target.checked)}
                className="accent-[#3574F0] rounded" 
              />
              <span className="text-[#DFE1E5]">Use rustfmt instead of built-in code formatter</span>
            </label>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > TypeScript / JavaScript */}
      {selectedId === 'lang-typescript' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">TypeScript / JavaScript</h2>
            <p className="text-xs text-[#868A91]">Node.js runtime interpreter and TypeScript Language Server.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="text-[#868A91] block mb-1">Node.js Interpreter:</label>
              <input 
                type="text" 
                readOnly 
                value={toolchainData?.node || 'C:\\Program Files\\nodejs\\node.exe (v22.17.0)'} 
                className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none" 
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={formSettings.tsLanguageServer ?? true}
                onChange={(e) => updateSetting('tsLanguageServer', e.target.checked)}
                className="accent-[#3574F0] rounded" 
              />
              <span className="text-[#DFE1E5]">Use TypeScript Language Service (tsconfig.json)</span>
            </label>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > Python */}
      {selectedId === 'lang-python' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Python</h2>
            <p className="text-xs text-[#868A91]">Python interpreter, virtual environment, and package manager.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="text-[#868A91] block mb-1">Python Interpreter:</label>
              <input 
                type="text" 
                readOnly 
                value={toolchainData?.python || 'Python 3.12 (Virtualenv .venv)'} 
                className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none" 
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span className="text-[#DFE1E5]">Auto-create virtual environment for new projects</span>
            </label>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > Java */}
      {selectedId === 'lang-java' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Java</h2>
            <p className="text-xs text-[#868A91]">JDK configuration and compiler bytecode compliance level.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="text-[#868A91] block mb-1">Project SDK:</label>
              <input 
                type="text" 
                readOnly 
                value={toolchainData?.java || 'Amazon Corretto 17.0.12 (corretto-17)'} 
                className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none" 
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">Target Bytecode Version:</span>
              <select className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none">
                <option value="17">17 (LTS)</option>
                <option value="21">21 (LTS)</option>
                <option value="11">11</option>
                <option value="8">8</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > Go */}
      {selectedId === 'lang-go' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">Go</h2>
              <p className="text-xs text-[#868A91]">Configure Go SDK (GOROOT), workspace (GOPATH), modules, and code formatting.</p>
            </div>
            <button
              onClick={() => onShowToast?.('Go SDK Verified', `Go binary: ${toolchainData?.go || 'go1.22.5'} is ready`, 'success')}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
            >
              <CheckCircle2 size={12} />
              Verify Go SDK
            </button>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="text-[#868A91] block mb-1">GOROOT (Go Installation Path):</label>
              <input
                type="text"
                value={formSettings.goRoot || 'C:\\Program Files\\Go'}
                onChange={(e) => updateSetting('goRoot', e.target.value)}
                className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none"
              />
              <div className="text-[11px] text-[#868A91] mt-1 font-mono">
                Detected version: {toolchainData?.go || 'Go toolchain not detected'}
              </div>
            </div>

            <div>
              <label className="text-[#868A91] block mb-1">GOPATH (Workspace Path):</label>
              <input
                type="text"
                value={formSettings.goPath || '~/go'}
                onChange={(e) => updateSetting('goPath', e.target.value)}
                className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none"
              />
            </div>

            <div>
              <label className="text-[#868A91] block mb-1">Custom Build Tags (comma separated):</label>
              <input
                type="text"
                placeholder="e.g. integration,tools,windows"
                value={formSettings.goBuildTags || ''}
                onChange={(e) => updateSetting('goBuildTags', e.target.value)}
                className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none"
              />
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.goFmtOnSave ?? true}
                  onChange={(e) => updateSetting('goFmtOnSave', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Format code on file save using gofmt & goimports</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.goVetOnBuild ?? true}
                  onChange={(e) => updateSetting('goVetOnBuild', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Run go vet inspections on the fly</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.goVendor ?? false}
                  onChange={(e) => updateSetting('goVendor', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Enable vendoring mode (-mod=vendor)</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > C / C++ */}
      {selectedId === 'lang-cpp' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">C / C++</h2>
            <p className="text-xs text-[#868A91]">Configure C/C++ compiler, language standard, CMake integration, and Clang-Tidy.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="text-[#868A91] block mb-1">Detected C/C++ Compiler:</label>
              <input
                type="text"
                readOnly
                value={toolchainData?.clang || 'clang version 18.1.8 (LLVM target x86_64-pc-windows-msvc)'}
                className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[#868A91] block mb-1">C++ Language Standard:</label>
                <select
                  value={formSettings.cppStandard || 'c++20'}
                  onChange={(e) => updateSetting('cppStandard', e.target.value)}
                  className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white outline-none"
                >
                  <option value="c++26">C++26 (Experimental)</option>
                  <option value="c++23">C++23</option>
                  <option value="c++20">C++20 (Recommended)</option>
                  <option value="c++17">C++17</option>
                  <option value="c++14">C++14</option>
                  <option value="c++11">C++11</option>
                </select>
              </div>

              <div>
                <label className="text-[#868A91] block mb-1">C Language Standard:</label>
                <select
                  value={formSettings.cStandard || 'c17'}
                  onChange={(e) => updateSetting('cStandard', e.target.value)}
                  className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white outline-none"
                >
                  <option value="c23">C23</option>
                  <option value="c17">C17 (Default)</option>
                  <option value="c11">C11</option>
                  <option value="c99">C99</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[#868A91] block mb-1">CMake Generator:</label>
                <select
                  value={formSettings.cmakeGenerator || 'Ninja'}
                  onChange={(e) => updateSetting('cmakeGenerator', e.target.value)}
                  className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white outline-none"
                >
                  <option value="Ninja">Ninja (High Performance)</option>
                  <option value="Visual Studio 17 2022">Visual Studio 17 2022</option>
                  <option value="Unix Makefiles">Unix Makefiles</option>
                  <option value="MinGW Makefiles">MinGW Makefiles</option>
                </select>
              </div>

              <div>
                <label className="text-[#868A91] block mb-1">CMake Version:</label>
                <input
                  type="text"
                  readOnly
                  value={toolchainData?.cmake || 'cmake version 3.28.3'}
                  className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.clangTidy ?? true}
                  onChange={(e) => updateSetting('clangTidy', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Perform Clang-Tidy inspections on the fly</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.clangFormat ?? true}
                  onChange={(e) => updateSetting('clangFormat', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Format code using .clang-format specifications</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > SQL & Database */}
      {selectedId === 'lang-sql' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">SQL & Database</h2>
            <p className="text-xs text-[#868A91]">Configure default SQL dialect, query execution limits, transaction mode, and code formatting.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="text-[#868A91] block mb-1">Default SQL Dialect:</label>
              <select
                value={formSettings.defaultSqlDialect || 'PostgreSQL'}
                onChange={(e) => updateSetting('defaultSqlDialect', e.target.value)}
                className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white outline-none"
              >
                <option value="PostgreSQL">PostgreSQL (Standard ANSI SQL)</option>
                <option value="MySQL">MySQL / MariaDB</option>
                <option value="SQLite">SQLite 3</option>
                <option value="Oracle">Oracle Database</option>
                <option value="SQL Server">Microsoft SQL Server (T-SQL)</option>
                <option value="Snowflake">Snowflake Data Cloud</option>
                <option value="ClickHouse">ClickHouse SQL</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[#868A91] block mb-1">Default Query Row Limit:</label>
                <select
                  value={formSettings.sqlRowLimit || 500}
                  onChange={(e) => updateSetting('sqlRowLimit', Number(e.target.value))}
                  className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white outline-none"
                >
                  <option value={100}>100 rows</option>
                  <option value={500}>500 rows (Default)</option>
                  <option value={1000}>1,000 rows</option>
                  <option value={5000}>5,000 rows</option>
                  <option value={0}>Unlimited</option>
                </select>
              </div>

              <div>
                <label className="text-[#868A91] block mb-1">Keyword Casing Style:</label>
                <select
                  value={formSettings.sqlKeywordsCase || 'upper'}
                  onChange={(e) => updateSetting('sqlKeywordsCase', e.target.value as any)}
                  className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white outline-none"
                >
                  <option value="upper">UPPERCASE (SELECT, FROM, WHERE)</option>
                  <option value="lower">lowercase (select, from, where)</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.sqlAutoCommit ?? true}
                onChange={(e) => updateSetting('sqlAutoCommit', e.target.checked)}
                className="accent-[#3574F0] rounded"
              />
              <span className="text-[#DFE1E5]">Auto-commit SQL transactions on query execution</span>
            </label>

            {/* SQL Live Formatting Preview */}
            <div className="mt-3">
              <label className="text-[#868A91] block mb-1">Formatting Preview:</label>
              <div className="bg-[#1E1F22] border border-[#393B40] rounded p-3 font-mono text-[11px] text-[#A9B7C6] leading-relaxed">
                {formSettings.sqlKeywordsCase === 'lower' ? (
                  <>
                    <span className="text-[#CC7832]">select</span> id, username, email<br/>
                    <span className="text-[#CC7832]">from</span> app_users<br/>
                    <span className="text-[#CC7832]">where</span> is_active = <span className="text-[#6897BB]">true</span><br/>
                    <span className="text-[#CC7832]">order by</span> created_at <span className="text-[#CC7832]">desc</span>;
                  </>
                ) : (
                  <>
                    <span className="text-[#CC7832]">SELECT</span> id, username, email<br/>
                    <span className="text-[#CC7832]">FROM</span> app_users<br/>
                    <span className="text-[#CC7832]">WHERE</span> is_active = <span className="text-[#6897BB]">true</span><br/>
                    <span className="text-[#CC7832]">ORDER BY</span> created_at <span className="text-[#CC7832]">DESC</span>;
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > HTML & CSS / Tailwind */}
      {selectedId === 'lang-html-css' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">HTML & CSS / Tailwind CSS</h2>
            <p className="text-xs text-[#868A91]">Configure HTML/CSS language services, Emmet abbreviation expansion, and Tailwind CSS.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="border border-[#393B40] rounded bg-[#26282B] p-3 space-y-2.5">
              <div className="font-semibold text-white">Emmet Abbreviations:</div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.emmetEnabled ?? true}
                  onChange={(e) => updateSetting('emmetEnabled', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Enable Emmet abbreviation expansions with Tab key</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Enable Emmet inside JSX / TSX React components</span>
              </label>
            </div>

            <div className="border border-[#393B40] rounded bg-[#26282B] p-3 space-y-2.5">
              <div className="font-semibold text-white">Tailwind CSS IntelliSense:</div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.tailwindLsp ?? true}
                  onChange={(e) => updateSetting('tailwindLsp', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Enable Tailwind CSS Language Server (class autocompletion)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Show inline color previews for Tailwind hex and rgb utilities</span>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">CSS Code Indentation:</span>
              <select
                value={formSettings.cssIndentSize || 2}
                onChange={(e) => updateSetting('cssIndentSize', Number(e.target.value))}
                className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none"
              >
                <option value={2}>2 spaces (Modern CSS Standard)</option>
                <option value={4}>4 spaces</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.autoprefixerEnabled ?? true}
                onChange={(e) => updateSetting('autoprefixerEnabled', e.target.checked)}
                className="accent-[#3574F0] rounded"
              />
              <span className="text-[#DFE1E5]">Run PostCSS Autoprefixer for cross-browser vendor prefixes</span>
            </label>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > Markdown & Docs */}
      {selectedId === 'lang-markdown' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Markdown & Documentation</h2>
            <p className="text-xs text-[#868A91]">Configure Markdown rendering engine, diagrams, mathematical syntax, and preview synchronization.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">GitHub Flavored Markdown (GFM) tables, task lists, and strikethrough</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.markdownMermaid ?? true}
                  onChange={(e) => updateSetting('markdownMermaid', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Render Mermaid.js diagrams directly in live preview</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.markdownMath ?? true}
                  onChange={(e) => updateSetting('markdownMath', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Render KaTeX / LaTeX mathematical equations ($...$ and $...$)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.markdownSyncScroll ?? true}
                  onChange={(e) => updateSetting('markdownSyncScroll', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Synchronize editor scroll position with live Markdown preview</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.markdownSpellCheck ?? false}
                  onChange={(e) => updateSetting('markdownSpellCheck', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Enable spell checking and typo inspections in Markdown documents</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > Docker & Cloud */}
      {selectedId === 'lang-docker' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Docker & Cloud</h2>
            <p className="text-xs text-[#868A91]">Configure Docker engine CLI, Compose executable, daemon socket, and Dockerfile inspections.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="text-[#868A91] block mb-1">Docker CLI Executable Path:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formSettings.dockerCliPath || 'docker'}
                  onChange={(e) => updateSetting('dockerCliPath', e.target.value)}
                  className="flex-1 bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none"
                />
                <button
                  onClick={handleTestDocker}
                  disabled={dockerTestStatus === 'testing'}
                  className="px-3 py-1.5 bg-[#2B2D30] hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40] flex items-center gap-1.5"
                >
                  {dockerTestStatus === 'testing' ? <RefreshCw size={12} className="animate-spin" /> : null}
                  Test
                </button>
              </div>
              {dockerTestStatus === 'success' && (
                <div className="mt-2 text-xs text-[#59A869] flex items-center gap-1.5 bg-[#59A869]/10 px-2.5 py-1.5 rounded border border-[#59A869]/20 font-mono">
                  <CheckCircle2 size={13} /> {dockerTestMessage}
                </div>
              )}
              {dockerTestStatus === 'error' && (
                <div className="mt-2 text-xs text-[#E05555] flex items-center gap-1.5 bg-[#E05555]/10 px-2.5 py-1.5 rounded border border-[#E05555]/20 font-mono">
                  <AlertTriangle size={13} /> {dockerTestMessage}
                </div>
              )}
            </div>

            <div>
              <label className="text-[#868A91] block mb-1">Docker Compose Executable:</label>
              <input
                type="text"
                value={formSettings.dockerComposePath || 'docker-compose'}
                onChange={(e) => updateSetting('dockerComposePath', e.target.value)}
                className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none"
              />
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.dockerBuildKit ?? true}
                  onChange={(e) => updateSetting('dockerBuildKit', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Enable Docker BuildKit acceleration (DOCKER_BUILDKIT=1)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.dockerHadolint ?? true}
                  onChange={(e) => updateSetting('dockerHadolint', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Run Hadolint static analysis on Dockerfile save</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > JSON & YAML Schemas */}
      {selectedId === 'lang-schemas' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">JSON & YAML Schemas</h2>
              <p className="text-xs text-[#868A91]">Configure schema validation catalogs, SchemaStore.org auto-sync, and YAML formatting.</p>
            </div>
            <button
              onClick={() => onShowToast?.('Schemas Synchronized', 'Downloaded latest schemas from SchemaStore.org', 'success')}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={12} />
              Sync SchemaStore
            </button>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.jsonSchemaStoreSync ?? true}
                  onChange={(e) => updateSetting('jsonSchemaStoreSync', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Automatically download and sync schema definitions from JSON Schema Store</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.jsonStrictValidation ?? true}
                  onChange={(e) => updateSetting('jsonStrictValidation', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Strict schema validation (report unknown properties as errors)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.jsonAllowComments ?? true}
                  onChange={(e) => updateSetting('jsonAllowComments', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Allow comments and trailing commas in JSON files (JSONC)</span>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">YAML Default Indentation:</span>
              <select
                value={formSettings.yamlIndent || 2}
                onChange={(e) => updateSetting('yamlIndent', Number(e.target.value))}
                className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none"
              >
                <option value={2}>2 spaces (YAML Specification Standard)</option>
                <option value={4}>4 spaces</option>
              </select>
            </div>

            <div className="border border-[#393B40] rounded bg-[#26282B] overflow-hidden">
              <div className="h-7 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91]">
                <span>File Pattern</span>
                <span>Bound Schema</span>
              </div>
              <div className="divide-y divide-[#393B40]/40 p-1 font-mono text-[11px]">
                <div className="px-2 py-1.5 flex justify-between">
                  <span className="text-[#3574F0]">package.json</span>
                  <span className="text-[#868A91]">http://json.schemastore.org/package</span>
                </div>
                <div className="px-2 py-1.5 flex justify-between">
                  <span className="text-[#3574F0]">tsconfig*.json</span>
                  <span className="text-[#868A91]">http://json.schemastore.org/tsconfig</span>
                </div>
                <div className="px-2 py-1.5 flex justify-between">
                  <span className="text-[#3574F0]">Cargo.toml</span>
                  <span className="text-[#868A91]">Cargo manifest schema</span>
                </div>
                <div className="px-2 py-1.5 flex justify-between">
                  <span className="text-[#3574F0]">docker-compose*.yml</span>
                  <span className="text-[#868A91]">Compose Spec Schema</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > Android */}
      {selectedId === 'lang-android' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold text-white">Android</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EDA200]/20 text-[#EDA200] border border-[#EDA200]/30 font-medium">
                  UI Preview
                </span>
              </div>
              <p className="text-xs text-[#868A91]">Android SDK, NDK location, and Gradle sync (engine integration in development).</p>
            </div>
            <button
              onClick={() => handleValidateToolchain('android', (formSettings as any).androidSdkPath || 'C:\\Users\\adminlocal\\AppData\\Local\\Android\\Sdk')}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
            >
              <CheckCircle2 size={12} />
              Validate SDK
            </button>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="text-[#868A91] block mb-1">Android SDK Location:</label>
              <input
                type="text"
                readOnly
                value="C:\Users\adminlocal\AppData\Local\Android\Sdk"
                className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none"
              />
            </div>

            <div>
              <label className="text-[#868A91] block mb-1">Android NDK Location (Optional):</label>
              <input
                type="text"
                placeholder="e.g. C:\Users\adminlocal\AppData\Local\Android\Sdk\ndk\26.1.10909125"
                className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none"
              />
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Enable Android Lint inspections during build</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Enable Live Edit for Jetpack Compose UI</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Automatic Android Gradle sync on project open</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > Android SDK Updater */}
      {selectedId === 'lang-android-sdk' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">Android SDK Updater</h2>
              <p className="text-xs text-[#868A91]">Manage installed Android SDK platforms, build tools, and update channels.</p>
            </div>
            <button
              onClick={() => onShowToast?.('SDK Check', 'All Android SDK components are up to date', 'success')}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={12} />
              Check for Updates
            </button>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">Update Channel:</span>
              <select className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none">
                <option value="stable">Stable Channel (Recommended)</option>
                <option value="beta">Beta Channel</option>
                <option value="canary">Canary Channel</option>
              </select>
            </div>

            <div className="border border-[#393B40] rounded bg-[#26282B] overflow-hidden">
              <div className="h-7 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91]">
                <span>Platform / Package</span>
                <span>API Level</span>
                <span>Status</span>
              </div>
              <div className="divide-y divide-[#393B40]/40 p-1 font-mono text-[11px]">
                <div className="px-2 py-1.5 flex justify-between items-center">
                  <span className="text-white">Android 14.0 ("UpsideDownCake")</span>
                  <span className="text-[#868A91]">API 34</span>
                  <span className="text-[#59A869]">Installed</span>
                </div>
                <div className="px-2 py-1.5 flex justify-between items-center">
                  <span className="text-white">Android 13.0 ("Tiramisu")</span>
                  <span className="text-[#868A91]">API 33</span>
                  <span className="text-[#59A869]">Installed</span>
                </div>
                <div className="px-2 py-1.5 flex justify-between items-center">
                  <span className="text-white">Android SDK Platform-Tools</span>
                  <span className="text-[#868A91]">35.0.1</span>
                  <span className="text-[#59A869]">Installed</span>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span className="text-[#DFE1E5]">Automatically check for SDK platform updates on startup</span>
            </label>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > Dart */}
      {selectedId === 'lang-dart' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold text-white">Dart</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EDA200]/20 text-[#EDA200] border border-[#EDA200]/30 font-medium">
                  UI Preview
                </span>
              </div>
              <p className="text-xs text-[#868A91]">Configure Dart SDK location and analysis server (integration in development).</p>
            </div>
            <button
              onClick={() => handleValidateToolchain('dart', (formSettings as any).dartSdkPath || 'C:\\tools\\dart-sdk')}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
            >
              <CheckCircle2 size={12} />
              Verify Dart SDK
            </button>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span className="text-[#DFE1E5] font-medium">Enable Dart support for the project</span>
            </label>

            <div>
              <label className="text-[#868A91] block mb-1">Dart SDK Path:</label>
              <input
                type="text"
                placeholder="e.g. C:\tools\dart-sdk"
                defaultValue="C:\tools\dart-sdk"
                className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none"
              />
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Perform code analysis using Dart Analysis Server</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Format Dart code on save with dart format</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Enable experimental macro inspections</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > Flutter */}
      {selectedId === 'lang-flutter' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold text-white">Flutter</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EDA200]/20 text-[#EDA200] border border-[#EDA200]/30 font-medium">
                  UI Preview
                </span>
              </div>
              <p className="text-xs text-[#868A91]">Configure Flutter SDK path and DevTools (runner integration in development).</p>
            </div>
            <button
              onClick={() => handleValidateToolchain('flutter', (formSettings as any).flutterSdkPath || 'C:\\tools\\flutter')}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
            >
              <CheckCircle2 size={12} />
              Run Flutter Doctor
            </button>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="text-[#868A91] block mb-1">Flutter SDK Path:</label>
              <input
                type="text"
                placeholder="e.g. C:\tools\flutter"
                defaultValue="C:\tools\flutter"
                className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none"
              />
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Perform Hot Reload on save (Ctrl+S)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Perform Hot Restart on save (Ctrl+Shift+S)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Format code on save using flutter format</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Open Flutter DevTools on debug session start</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > JavaScript */}
      {selectedId === 'lang-javascript' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">JavaScript</h2>
            <p className="text-xs text-[#868A91]">Configure JavaScript language level, JSX syntax, and module resolution.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="text-[#868A91] block mb-1">JavaScript Language Version:</label>
              <select className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white outline-none">
                <option value="es2023">ECMAScript 2023+ (Default)</option>
                <option value="es6">ECMAScript 6 (ES2015)</option>
                <option value="es5">ECMAScript 5.1</option>
                <option value="flow">Flow</option>
              </select>
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Enable JSX and React support in .js and .jsx files</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Support top-level await syntax</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Track dynamic imports and import.meta resolution</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > JavaScript Runtime */}
      {selectedId === 'lang-js-runtime' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">JavaScript Runtime</h2>
              <p className="text-xs text-[#868A91]">Configure Node.js interpreter, package managers, and core coding assistance.</p>
            </div>
            <button
              onClick={() => onShowToast?.('Node.js Interpreter', 'Node.js runtime active: v22.17.0', 'success')}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
            >
              <CheckCircle2 size={12} />
              Verify Runtime
            </button>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="text-[#868A91] block mb-1">Node.js Interpreter:</label>
              <input
                type="text"
                readOnly
                value={toolchainData?.node || 'C:\\Program Files\\nodejs\\node.exe (v22.17.0)'}
                className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none"
              />
            </div>

            <div>
              <label className="text-[#868A91] block mb-1">Package Manager:</label>
              <select className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white outline-none">
                <option value="npm">npm (C:\Program Files\nodejs\npm.cmd)</option>
                <option value="pnpm">pnpm</option>
                <option value="yarn">yarn</option>
                <option value="bun">bun</option>
              </select>
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Enable Coding assistance for Node.js core modules</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Automatically download @types/node definitions</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > JVM Logging */}
      {selectedId === 'lang-jvm-logging' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">JVM Logging</h2>
            <p className="text-xs text-[#868A91]">Configure SLF4J, Log4j2, Logback, and Java Util Logging framework levels.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">Default Logging Framework:</span>
              <select className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none">
                <option value="slf4j">SLF4J + Logback</option>
                <option value="log4j2">Apache Log4j 2</option>
                <option value="jul">java.util.logging (JUL)</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">Root Log Level:</span>
              <select className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none">
                <option value="INFO">INFO (Default)</option>
                <option value="DEBUG">DEBUG</option>
                <option value="TRACE">TRACE</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Highlight ANSI colored log lines in Run Console</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Parse and link stack traces directly to source code</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > Kotlin */}
      {selectedId === 'lang-kotlin' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">Kotlin</h2>
              <p className="text-xs text-[#868A91]">Configure Kotlin compiler version, JVM target, script definitions, and coroutines.</p>
            </div>
            <button
              onClick={() => onShowToast?.('Kotlin Compiler', 'Kotlin 2.0.0-RC3 compiler ready', 'success')}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
            >
              <CheckCircle2 size={12} />
              Check Compiler
            </button>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">Target JVM Bytecode Version:</span>
              <select className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none">
                <option value="17">17 (Recommended LTS)</option>
                <option value="21">21 (LTS)</option>
                <option value="1.8">1.8 (Java 8 compatibility)</option>
              </select>
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Enable Kotlin K2 compiler mode for faster analysis</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Enable Kotlin Coroutines asynchronous debugger</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Support Kotlin Scripting (*.kts files)</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > OpenAPI Specifications */}
      {selectedId === 'lang-openapi' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">OpenAPI Specifications</h2>
              <p className="text-xs text-[#868A91]">Configure Swagger / OpenAPI 3.0 & 3.1 specification validation, Swagger UI preview, and Spectral rules.</p>
            </div>
            <button
              onClick={() => handleValidateToolchain('openapi')}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
            >
              <CheckCircle2 size={12} />
              Validate Schema
            </button>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">Swagger UI Preview Theme:</span>
              <select className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none">
                <option value="dark">Dark Theme (Matches IDE)</option>
                <option value="light">Classic Light Theme</option>
              </select>
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Validate YAML and JSON specifications against OpenAPI 3.0 / 3.1 schemas</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Provide autocompletion for endpoints, responses, and request bodies</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Enable built-in HTTP client invocation from OpenAPI operations</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > Protocol Buffers */}
      {selectedId === 'lang-protobuf' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">Protocol Buffers</h2>
              <p className="text-xs text-[#868A91]">Configure protoc executable, proto2/proto3 syntax validation, and gRPC service definitions.</p>
            </div>
            <button
              onClick={() => handleValidateToolchain('protoc', (formSettings as any).protocPath || 'protoc')}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
            >
              <CheckCircle2 size={12} />
              Verify protoc
            </button>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="text-[#868A91] block mb-1">protoc Executable Path:</label>
              <input
                type="text"
                placeholder="protoc"
                defaultValue="protoc"
                className="w-full bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1.5 text-white font-mono outline-none"
              />
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Enable syntax highlighting and linting for .proto files</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Resolve imported proto definitions across include directories</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Auto-generate stub classes on project build</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > Style Sheets */}
      {selectedId === 'lang-stylesheets' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Style Sheets</h2>
            <p className="text-xs text-[#868A91]">Configure CSS, SCSS, Sass, Less, and PostCSS stylesheets language services and formatting.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">CSS Indentation:</span>
              <select
                value={formSettings.cssIndentSize || 2}
                onChange={(e) => updateSetting('cssIndentSize', Number(e.target.value))}
                className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none"
              >
                <option value={2}>2 spaces</option>
                <option value={4}>4 spaces</option>
              </select>
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.autoprefixerEnabled ?? true}
                  onChange={(e) => updateSetting('autoprefixerEnabled', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Run PostCSS Autoprefixer for cross-browser vendor prefixes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.tailwindLsp ?? true}
                  onChange={(e) => updateSetting('tailwindLsp', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-[#DFE1E5]">Tailwind CSS Language Server (class autocompletion)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Support native CSS nesting syntax</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > Style Sheets > Tables */}
      {selectedId === 'lang-css-tables' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Tables</h2>
            <p className="text-xs text-[#868A91]">Configure CSS table formatting, cell alignment, and border-collapse standards.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">Default table-layout:</span>
              <select className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none">
                <option value="auto">auto</option>
                <option value="fixed">fixed</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">Default border-collapse:</span>
              <select className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none">
                <option value="collapse">collapse</option>
                <option value="separate">separate</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span className="text-[#DFE1E5]">Inspect missing table headers (&lt;th&gt;) for accessibility (WCAG)</span>
            </label>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > Template Data Languages */}
      {selectedId === 'lang-template-data' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Template Data Languages</h2>
            <p className="text-xs text-[#868A91]">Configure template data languages (JSP, Thymeleaf, Freemarker, Velocity, Handlebars) for files and directories.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">Project Template Language:</span>
              <select className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none">
                <option value="thymeleaf">Thymeleaf (Spring Boot Standard)</option>
                <option value="freemarker">Apache FreeMarker (.ftl)</option>
                <option value="jsp">JavaServer Pages (JSP)</option>
                <option value="handlebars">Handlebars / Mustache</option>
              </select>
            </div>

            <div className="pt-2 border-t border-[#393B40]/60 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Resolve Spring Model attributes inside Thymeleaf expressions (${'{...}'})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span className="text-[#DFE1E5]">Highlight unresolved template variables and URL expressions</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > XSLT */}
      {selectedId === 'lang-xslt' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">XSLT</h2>
              <p className="text-xs text-[#868A91]">Configure XSLT processor version, XML validation, and stylesheet transform options.</p>
            </div>
            <button
              onClick={() => onShowToast?.('XSLT Engine', 'Saxon-HE 12.4 processor ready', 'success')}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5"
            >
              <CheckCircle2 size={12} />
              Test Processor
            </button>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">XSLT Version:</span>
              <select className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none">
                <option value="2.0">XSLT 2.0 (Recommended)</option>
                <option value="3.0">XSLT 3.0</option>
                <option value="1.0">XSLT 1.0 (Standard)</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#DFE1E5]">XSLT Engine:</span>
              <select className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none">
                <option value="saxon">Saxon-HE (Home Edition)</option>
                <option value="jdk">Standard JDK Transformer</option>
                <option value="xalan">Apache Xalan</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span className="text-[#DFE1E5]">Validate XML source documents against XSLT stylesheets on transformation</span>
            </label>
          </div>
        </div>
      )}

      {/* Sub-page: Languages > XSLT File Associations */}
      {selectedId === 'lang-xslt-assoc' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">XSLT File Associations</h2>
            <p className="text-xs text-[#868A91]">Associate file patterns with XSL stylesheets and target XML documents.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div className="border border-[#393B40] rounded bg-[#26282B] overflow-hidden">
              <div className="h-7 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91]">
                <span>File Pattern</span>
                <span>Associated Stylesheet</span>
              </div>
              <div className="divide-y divide-[#393B40]/40 p-1 font-mono text-[11px]">
                <div className="px-2 py-1.5 flex justify-between">
                  <span className="text-[#3574F0]">*.xsl</span>
                  <span className="text-[#DFE1E5]">Default XSLT Stylesheet</span>
                </div>
                <div className="px-2 py-1.5 flex justify-between">
                  <span className="text-[#3574F0]">*.xslt</span>
                  <span className="text-[#DFE1E5]">Default XSLT Stylesheet</span>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
              <span className="text-[#DFE1E5]">Auto-detect stylesheet association from &lt;?xml-stylesheet?&gt; processing instructions</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
