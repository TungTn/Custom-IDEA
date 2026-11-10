import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Code2, Sparkles, CornerDownLeft, FileText, ChevronRight, Check, Globe, FileCode2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import {
  astSearchService,
  StructuralMatch,
  PRESET_STRUCTURAL_TEMPLATES,
  StructuralTemplate,
} from '../../services/astSearchService';

export interface StructuralSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentContent?: string;
  currentFilePath?: string;
  projectPath?: string;
  onNavigateToLine: (filePath: string, line: number) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const StructuralSearchModal: React.FC<StructuralSearchModalProps> = ({
  isOpen,
  onClose,
  currentContent = '',
  currentFilePath = 'active-file',
  projectPath,
  onNavigateToLine,
  onShowToast,
}) => {
  const [pattern, setPattern] = useState('$func$($args$)');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('all');
  const [scope, setScope] = useState<'file' | 'project'>('file');
  const [isSearching, setIsSearching] = useState(false);
  const [matches, setMatches] = useState<StructuralMatch[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      handleSearch(pattern, scope);
    }
  }, [isOpen]);

  const handleSearch = async (searchPattern: string, searchScope: 'file' | 'project' = scope) => {
    const trimmed = searchPattern.trim();
    if (!trimmed) {
      setMatches([]);
      return;
    }

    if (searchScope === 'file') {
      if (!currentContent) {
        setMatches([]);
        return;
      }
      const results = astSearchService.searchStructural(currentContent, currentFilePath, trimmed);
      setMatches(results);
      if (results.length > 0) setSelectedMatchId(results[0].id);
      else setSelectedMatchId('');
      return;
    }

    // Whole Project Structural Search
    setIsSearching(true);
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    const allMatches: StructuralMatch[] = [];

    if (isTauri && projectPath) {
      try {
        // Extract non-variable literal tokens to narrow down files via ripgrep
        const tokens = trimmed.replace(/\$[a-zA-Z0-9_]+\$/g, ' ').match(/[a-zA-Z0-9_]{3,}/g);
        const searchToken = tokens && tokens.length > 0 ? tokens[0] : '';

        if (searchToken) {
          const hits = await invoke<any[]>('search_project_text', {
            projectPath,
            query: searchToken,
            caseSensitive: false,
            limit: 120,
          }).catch(() => []);

          const uniqueFiles = Array.from(new Set(hits.map((h: any) => h.file_path).filter(Boolean)));
          for (const fPath of uniqueFiles.slice(0, 30)) {
            try {
              const fContent = await invoke<string>('read_file_content', { path: fPath });
              if (fContent) {
                const fResults = astSearchService.searchStructural(fContent, fPath, trimmed);
                allMatches.push(...fResults);
              }
            } catch (_) {}
          }
        } else if (currentContent) {
          allMatches.push(...astSearchService.searchStructural(currentContent, currentFilePath, trimmed));
        }
      } catch (err) {
        console.warn('Whole project structural search error:', err);
      }
    } else if (currentContent) {
      allMatches.push(...astSearchService.searchStructural(currentContent, currentFilePath, trimmed));
    }

    setMatches(allMatches);
    if (allMatches.length > 0) setSelectedMatchId(allMatches[0].id);
    else setSelectedMatchId('');
    setIsSearching(false);
  };

  const handleApplyTemplate = (tpl: StructuralTemplate) => {
    setSelectedTemplate(tpl.id);
    setPattern(tpl.pattern);
    handleSearch(tpl.pattern, scope);
  };

  const selectedMatch = matches.find((m) => m.id === selectedMatchId) || matches[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="flex flex-col h-[75vh] w-[80vw] max-w-5xl rounded-lg border border-[#43454a] bg-[#1e1f22] text-[#bcbec4] shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#323438] bg-[#2b2d30] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-[#3574f0]" />
            <span className="text-xs font-semibold text-[#dfe1e5]">
              Structural Search (AST Pattern Matching)
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3574f0]/20 text-[#3574f0] font-mono">
              IntelliJ SS&R
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-[#393b40] text-[#868a91] hover:text-[#dfe1e5] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Pattern Input and Presets */}
        <div className="p-3 bg-[#25262a] border-b border-[#323438] space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#868a91]" />
              <input
                ref={inputRef}
                type="text"
                value={pattern}
                onChange={(e) => {
                  setPattern(e.target.value);
                  handleSearch(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && selectedMatch) {
                    onNavigateToLine(selectedMatch.filePath, selectedMatch.line);
                    onClose();
                  } else if (e.key === 'Escape') {
                    onClose();
                  }
                }}
                placeholder="Enter AST pattern (e.g. try { $body$ } catch ($e$) { $handler$ })..."
                className="w-full rounded bg-[#1e1f22] pl-8 pr-3 py-1.5 text-xs text-[#dfe1e5] border border-[#43454a] focus:border-[#3574f0] outline-none font-mono placeholder:text-[#6f737a]"
              />
            </div>

            {/* Scope Selector */}
            <div className="flex items-center bg-[#1e1f22] border border-[#393b40] rounded p-0.5 text-[11px] shrink-0">
              <button
                type="button"
                onClick={() => {
                  setScope('file');
                  handleSearch(pattern, 'file');
                }}
                className={`px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer ${
                  scope === 'file' ? 'bg-[#3574f0] text-white font-medium' : 'text-[#868a91] hover:text-[#dfe1e5]'
                }`}
                title="Search structural pattern in currently active file"
              >
                <FileCode2 size={12} />
                <span>Active File</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScope('project');
                  handleSearch(pattern, 'project');
                }}
                className={`px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer ${
                  scope === 'project' ? 'bg-[#3574f0] text-white font-medium' : 'text-[#868a91] hover:text-[#dfe1e5]'
                }`}
                title="Search structural pattern across all project files"
              >
                <Globe size={12} />
                <span>Project</span>
              </button>
            </div>

            <button
              onClick={() => handleSearch(pattern, scope)}
              disabled={isSearching}
              className="px-3 py-1.5 rounded bg-[#3574f0] hover:bg-[#3369d6] text-white text-xs font-medium transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pb-1">
            <span className="text-[#6f737a] flex items-center gap-1 flex-shrink-0 mr-1">
              <Sparkles className="h-3 w-3 text-[#f5c242]" />
              Presets:
            </span>
            {PRESET_STRUCTURAL_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleApplyTemplate(tpl)}
                className={`px-2 py-0.5 rounded border transition-colors flex-shrink-0 cursor-pointer ${
                  selectedTemplate === tpl.id
                    ? 'bg-[#2e436e] border-[#3574f0] text-white font-medium'
                    : 'bg-[#1e1f22] border-[#393b40] text-[#868a91] hover:text-[#dfe1e5] hover:border-[#4e5157]'
                }`}
              >
                {tpl.title}
              </button>
            ))}
          </div>
        </div>

        {/* Results Body: 2 Columns */}
        <div className="flex flex-1 min-h-0 divide-x divide-[#323438]">
          {/* Left panel: Occurrences List */}
          <div className="w-80 flex flex-col bg-[#25262a]">
            <div className="px-3 py-2 border-b border-[#323438] text-[11px] font-semibold text-[#6f737a] uppercase tracking-wider flex items-center justify-between">
              <span>Occurrences</span>
              <span className="text-white font-mono bg-[#323438] px-1.5 py-0.5 rounded text-[10px]">
                {matches.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {matches.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#6f737a]">
                  No structural matches found for this pattern.
                </div>
              ) : (
                matches.map((m) => {
                  const isSelected = m.id === selectedMatchId;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMatchId(m.id)}
                      onDoubleClick={() => {
                        onNavigateToLine(m.filePath, m.line);
                        onClose();
                      }}
                      className={`w-full text-left p-2 rounded flex flex-col gap-1 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#2e436e] text-[#dfe1e5]'
                          : 'hover:bg-[#2b2d30] text-[#bcbec4]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-medium truncate">
                          Line {m.line}
                        </span>
                        <ChevronRight className="h-3 w-3 text-[#6f737a]" />
                      </div>
                      <div className="font-mono text-[10.5px] text-[#868a91] truncate">
                        {m.snippet}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel: Match Details & Captures */}
          <div className="flex-1 flex flex-col bg-[#1e1f22]">
            {selectedMatch ? (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b border-[#323438] bg-[#25262a]">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#3574f0]" />
                    <span className="text-xs font-medium text-[#dfe1e5]">
                      Line {selectedMatch.line}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      onNavigateToLine(selectedMatch.filePath, selectedMatch.line);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#3574f0] hover:bg-[#3369d6] text-white text-xs font-medium transition-colors shadow-sm cursor-pointer"
                  >
                    <CornerDownLeft className="h-3.5 w-3.5" />
                    Jump to Source
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-4">
                  {/* Code snippet */}
                  <div>
                    <div className="text-[11px] font-semibold text-[#6f737a] uppercase mb-1.5">
                      Matched Code
                    </div>
                    <div className="p-3 bg-[#18191c] rounded border border-[#323438] font-mono text-xs text-[#dfe1e5] whitespace-pre-wrap select-text">
                      {selectedMatch.snippet}
                    </div>
                  </div>

                  {/* Captured Variables */}
                  {Object.keys(selectedMatch.captures).length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-[#6f737a] uppercase mb-1.5">
                        Captured Template Variables
                      </div>
                      <div className="border border-[#323438] rounded overflow-hidden">
                        <table className="w-full text-xs font-mono">
                          <thead className="bg-[#25262a] text-[#868a91] text-[10.5px]">
                            <tr>
                              <th className="px-3 py-1.5 text-left font-semibold">Variable</th>
                              <th className="px-3 py-1.5 text-left font-semibold">Bound Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#323438]">
                            {Object.entries(selectedMatch.captures).map(([k, v]) => (
                              <tr key={k} className="hover:bg-[#25262a]/50">
                                <td className="px-3 py-1.5 text-[#3574f0] font-semibold">${k}$</td>
                                <td className="px-3 py-1.5 text-[#dfe1e5] break-words">{v || '(empty)'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-[#6f737a]">
                Select a match from the left panel to preview details.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#323438] bg-[#2b2d30] px-4 py-2 text-xs text-[#6f737a]">
          <span>Pattern variables use <code className="text-[#dfe1e5]">$name$</code> syntax. Press Enter to jump to selected match.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded border border-[#43454a] hover:bg-[#393b40] text-[#dfe1e5] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
