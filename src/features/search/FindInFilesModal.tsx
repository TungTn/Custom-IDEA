import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Replace, 
  X, 
  Filter, 
  Folder, 
  FileCode, 
  FolderGit2, 
  ArrowRight, 
  Check, 
  Trash2, 
  ChevronRight, 
  ChevronDown, 
  RotateCcw, 
  Layers, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  HardDrive,
  Copy,
  Plus
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export interface FindInFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  initialMode?: 'find' | 'replace';
  initialQuery?: string;
  initialDirectory?: string;
  openFiles?: Array<{ path: string; name: string }>;
  onOpenFileAtLocation: (filePath: string, line: number, col: number) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export interface SearchMatchItem {
  id: string;
  file_name: string;
  file_path: string;
  relative_path: string;
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
}

interface FileGroupedMatches {
  relative_path: string;
  file_name: string;
  file_path: string;
  matches: SearchMatchItem[];
  isExpanded: boolean;
}

type ScopeTab = 'in_project' | 'module' | 'directory' | 'scope';

export const FindInFilesModal: React.FC<FindInFilesModalProps> = ({
  isOpen,
  onClose,
  projectPath,
  initialMode = 'find',
  initialQuery = '',
  initialDirectory = '',
  openFiles = [],
  onOpenFileAtLocation,
  onShowToast,
}) => {
  const [mode, setMode] = useState<'find' | 'replace'>(initialMode);
  const [query, setQuery] = useState(initialQuery);
  const [replaceText, setReplaceText] = useState('');
  
  // Options
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWords, setWholeWords] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [fileMask, setFileMask] = useState('');
  const [isFileMaskEnabled, setIsFileMaskEnabled] = useState(false);

  // Scope
  const [scopeTab, setScopeTab] = useState<ScopeTab>(initialDirectory ? 'directory' : 'in_project');
  const [selectedModule, setSelectedModule] = useState<'all' | 'intellij-idea-clone' | 'src-tauri'>('all');
  const [directoryPath, setDirectoryPath] = useState(initialDirectory || projectPath);
  const [scopeType, setScopeType] = useState<'open_files' | 'all'>('open_files');

  // Search Results
  const [isSearching, setIsSearching] = useState(false);
  const [rawResults, setRawResults] = useState<SearchMatchItem[]>([]);
  const [selectedMatchIdx, setSelectedMatchIdx] = useState<number>(0);
  const [excludedMatchIds, setExcludedMatchIds] = useState<Set<string>>(new Set());

  // Context Preview
  const [previewContent, setPreviewContent] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Ref
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize upon open
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      if (initialQuery) {
        setQuery(initialQuery);
      }
      if (initialDirectory) {
        setDirectoryPath(initialDirectory);
        setScopeTab('directory');
      }
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen, initialMode, initialQuery, initialDirectory]);

  // Execute Search
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setRawResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        let searchPath = projectPath;
        if (scopeTab === 'directory' && directoryPath) {
          searchPath = directoryPath;
        } else if (scopeTab === 'module') {
          searchPath = selectedModule === 'src-tauri' ? `${projectPath}\\src-tauri` : projectPath;
        }

        let results: SearchMatchItem[] = [];
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          const res = await invoke<any[]>('search_project_text', {
            projectPath: searchPath,
            query: trimmed,
            caseSensitive: matchCase,
            limit: 150,
          }).catch(() => []);

          results = res.map((r, i) => ({
            id: `match-${r.file_path}-${r.line_number}-${r.match_start}-${i}`,
            file_name: r.file_name,
            file_path: r.file_path,
            relative_path: r.relative_path,
            line_number: r.line_number,
            line_content: r.line_content,
            match_start: r.match_start,
            match_end: r.match_end,
          }));
        } else {
          // Web fallback simulated matches
          results = [
            { id: 'm1', file_name: 'App.tsx', file_path: `${projectPath}\\src\\App.tsx`, relative_path: 'src/App.tsx', line_number: 142, line_content: `const [activeTab, setActiveTab] = useState('${trimmed}');`, match_start: 35, match_end: 35 + trimmed.length },
            { id: 'm2', file_name: 'App.tsx', file_path: `${projectPath}\\src\\App.tsx`, relative_path: 'src/App.tsx', line_number: 285, line_content: `if (query === '${trimmed}') handleSearch();`, match_start: 16, match_end: 16 + trimmed.length },
            { id: 'm3', file_name: 'lib.rs', file_path: `${projectPath}\\src-tauri\\src\\lib.rs`, relative_path: 'src-tauri/src/lib.rs', line_number: 89, line_content: `pub fn run_${trimmed}() -> Result<(), String> {`, match_start: 11, match_end: 11 + trimmed.length }
          ];
        }

        // Apply Whole Words filtering if enabled
        if (wholeWords) {
          const wordRegex = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, matchCase ? '' : 'i');
          results = results.filter(r => wordRegex.test(r.line_content));
        }

        // Apply File Mask filtering if enabled
        if (isFileMaskEnabled && fileMask.trim()) {
          const masks = fileMask.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
          results = results.filter(r => {
            return masks.some(mask => {
              if (mask.startsWith('!*.')) {
                return !r.file_name.toLowerCase().endsWith(mask.slice(2));
              }
              if (mask.startsWith('*.')) {
                return r.file_name.toLowerCase().endsWith(mask.slice(1));
              }
              return r.file_name.toLowerCase().includes(mask.replace(/\*/g, ''));
            });
          });
        }

        // Apply Scope tab filtering for open files
        if (scopeTab === 'scope' && scopeType === 'open_files' && openFiles.length > 0) {
          const openPaths = new Set(openFiles.map(f => f.path.replace(/\\/g, '/').toLowerCase()));
          results = results.filter(r => openPaths.has(r.file_path.replace(/\\/g, '/').toLowerCase()));
        }

        setRawResults(results);
        setSelectedMatchIdx(0);
        setExcludedMatchIds(new Set());
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, matchCase, wholeWords, isRegex, fileMask, isFileMaskEnabled, scopeTab, selectedModule, directoryPath, scopeType, projectPath, isOpen, openFiles]);

  // Load preview context for selected match
  useEffect(() => {
    const curMatch = rawResults[selectedMatchIdx];
    if (!curMatch) {
      setPreviewContent([]);
      return;
    }

    let isMounted = true;
    setPreviewLoading(true);

    const loadContext = async () => {
      try {
        let content = '';
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          content = await invoke<string>('read_file_content', { path: curMatch.file_path });
        } else {
          content = curMatch.line_content;
        }

        if (!isMounted) return;

        const allLines = content.split(/\r?\n/);
        const center = curMatch.line_number - 1;
        const start = Math.max(0, center - 6);
        const end = Math.min(allLines.length, center + 7);
        const sliced = allLines.slice(start, end);
        setPreviewContent(sliced);
      } catch (err) {
        if (isMounted) setPreviewContent([curMatch.line_content]);
      } finally {
        if (isMounted) setPreviewLoading(false);
      }
    };

    loadContext();

    return () => {
      isMounted = false;
    };
  }, [selectedMatchIdx, rawResults]);

  // Group matches by file
  const groupedMatches: FileGroupedMatches[] = useMemo(() => {
    const map = new Map<string, SearchMatchItem[]>();
    for (const r of rawResults) {
      if (!map.has(r.file_path)) {
        map.set(r.file_path, []);
      }
      map.get(r.file_path)!.push(r);
    }

    const groups: FileGroupedMatches[] = [];
    for (const [fPath, matches] of map.entries()) {
      groups.push({
        file_path: fPath,
        file_name: matches[0].file_name,
        relative_path: matches[0].relative_path,
        matches,
        isExpanded: true,
      });
    }
    return groups;
  }, [rawResults]);

  const activeMatch = rawResults[selectedMatchIdx];

  // Replace Single
  const handleReplaceCurrent = async () => {
    if (!activeMatch || !query) return;

    try {
      let fileText = await invoke<string>('read_file_content', { path: activeMatch.file_path });
      const lines = fileText.split(/\r?\n/);
      const lineIdx = activeMatch.line_number - 1;
      if (lineIdx >= 0 && lineIdx < lines.length) {
        const line = lines[lineIdx];
        const replacedLine = line.substring(0, activeMatch.match_start) + replaceText + line.substring(activeMatch.match_end);
        lines[lineIdx] = replacedLine;
        await invoke('save_file_content', { path: activeMatch.file_path, content: lines.join('\n') });

        onShowToast?.('Replaced Occurrence', `Updated ${activeMatch.file_name}:${activeMatch.line_number}`, 'success');

        // Remove from current results list
        setRawResults(prev => prev.filter((_, i) => i !== selectedMatchIdx));
      }
    } catch (e: any) {
      console.error(e);
      onShowToast?.('Replace Failed', String(e), 'error');
    }
  };

  // Replace All
  const handleReplaceAll = async () => {
    const validMatches = rawResults.filter(r => !excludedMatchIds.has(r.id));
    if (validMatches.length === 0 || !query) return;

    try {
      // Group by file
      const fileMap = new Map<string, SearchMatchItem[]>();
      for (const m of validMatches) {
        if (!fileMap.has(m.file_path)) fileMap.set(m.file_path, []);
        fileMap.get(m.file_path)!.push(m);
      }

      let totalReplaced = 0;
      for (const [filePath, matches] of fileMap.entries()) {
        let content = await invoke<string>('read_file_content', { path: filePath });
        const lines = content.split(/\r?\n/);

        // Sort descending by line and position so replacements don't shift earlier positions
        matches.sort((a, b) => {
          if (a.line_number !== b.line_number) return b.line_number - a.line_number;
          return b.match_start - a.match_start;
        });

        for (const m of matches) {
          const lIdx = m.line_number - 1;
          if (lIdx >= 0 && lIdx < lines.length) {
            const line = lines[lIdx];
            lines[lIdx] = line.substring(0, m.match_start) + replaceText + line.substring(m.match_end);
            totalReplaced++;
          }
        }

        await invoke('save_file_content', { path: filePath, content: lines.join('\n') });
      }

      onShowToast?.(
        'Replace All Completed',
        `Replaced ${totalReplaced} occurrences across ${fileMap.size} files`,
        'success'
      );
      setRawResults([]);
      onClose();
    } catch (err: any) {
      console.error(err);
      onShowToast?.('Replace All Failed', String(err), 'error');
    }
  };

  // Toggle Exclude match
  const handleToggleExclude = (id: string) => {
    setExcludedMatchIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Keydown shortcuts inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMatchIdx(prev => Math.min(prev + 1, Math.max(0, rawResults.length - 1)));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMatchIdx(prev => Math.max(0, prev - 1));
      return;
    }

    if (e.key === 'Enter' && e.ctrlKey && mode === 'replace') {
      e.preventDefault();
      handleReplaceCurrent();
      return;
    }

    if (e.key === 'Enter' && activeMatch) {
      e.preventDefault();
      onOpenFileAtLocation(activeMatch.file_path, activeMatch.line_number, activeMatch.match_start + 1);
      onClose();
      return;
    }

    if (e.key === 'Delete' && activeMatch) {
      e.preventDefault();
      handleToggleExclude(activeMatch.id);
      return;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[1040px] h-[680px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl flex flex-col overflow-hidden text-[#DFE1E5]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Top Header: Title, Search/Replace inputs & options */}
        <div className="bg-[#212225] border-b border-[#393B40] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                {mode === 'find' ? (
                  <>
                    <Search size={15} className="text-[#3574F0]" />
                    <span>Find in Files (Ctrl+Shift+F)</span>
                  </>
                ) : (
                  <>
                    <Replace size={15} className="text-[#59A869]" />
                    <span>Replace in Files (Ctrl+Shift+R)</span>
                  </>
                )}
              </div>
              <span className="text-[#868A91] text-[11px]">— {projectPath}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Mode switch pills */}
              <div className="flex bg-[#1E1F22] p-0.5 rounded border border-[#393B40] text-xs">
                <button
                  type="button"
                  onClick={() => setMode('find')}
                  className={`px-3 py-0.5 rounded transition-colors ${mode === 'find' ? 'bg-[#3574F0] text-white font-medium shadow-sm' : 'text-[#868A91] hover:text-[#DFE1E5]'}`}
                >
                  Find
                </button>
                <button
                  type="button"
                  onClick={() => setMode('replace')}
                  className={`px-3 py-0.5 rounded transition-colors ${mode === 'replace' ? 'bg-[#59A869] text-white font-medium shadow-sm' : 'text-[#868A91] hover:text-[#DFE1E5]'}`}
                >
                  Replace
                </button>
              </div>

              <button 
                onClick={onClose}
                className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5]"
                title="Close (Esc)"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Search Input Row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative flex items-center">
              <Search size={13} className="absolute left-3 text-[#868A91]" />
              <input 
                ref={inputRef}
                type="text"
                placeholder="Search phrase, symbol or regex..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded pl-8 pr-24 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none"
              />

              {/* Toggles inside Search Box */}
              <div className="absolute right-2 flex items-center gap-1 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setMatchCase(prev => !prev)}
                  className={`px-1.5 py-0.5 rounded border transition-colors ${
                    matchCase ? 'bg-[#3574F0]/30 border-[#3574F0] text-[#3574F0] font-bold' : 'border-transparent text-[#868A91] hover:text-[#DFE1E5]'
                  }`}
                  title="Match Case (Alt+C)"
                >
                  Cc
                </button>
                <button
                  type="button"
                  onClick={() => setWholeWords(prev => !prev)}
                  className={`px-1.5 py-0.5 rounded border transition-colors ${
                    wholeWords ? 'bg-[#3574F0]/30 border-[#3574F0] text-[#3574F0] font-bold' : 'border-transparent text-[#868A91] hover:text-[#DFE1E5]'
                  }`}
                  title="Whole Words (Alt+W)"
                >
                  W
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegex(prev => !prev)}
                  className={`px-1.5 py-0.5 rounded border transition-colors ${
                    isRegex ? 'bg-[#3574F0]/30 border-[#3574F0] text-[#3574F0] font-bold' : 'border-transparent text-[#868A91] hover:text-[#DFE1E5]'
                  }`}
                  title="Regular Expression (Alt+X)"
                >
                  .*
                </button>
              </div>
            </div>

            {/* File Mask Filter Input */}
            <div className="flex items-center gap-1.5 bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#868A91]">
                <input 
                  type="checkbox" 
                  checked={isFileMaskEnabled}
                  onChange={(e) => setIsFileMaskEnabled(e.target.checked)}
                  className="accent-[#3574F0] rounded" 
                />
                <span className="text-[11px]">File mask:</span>
              </label>
              <input 
                type="text" 
                placeholder="*.ts, *.rs"
                value={fileMask}
                disabled={!isFileMaskEnabled}
                onChange={(e) => setFileMask(e.target.value)}
                className="bg-transparent text-xs text-[#DFE1E5] font-mono outline-none w-28 disabled:opacity-40"
              />
            </div>
          </div>

          {/* Replace Input Row (if in Replace mode) */}
          {mode === 'replace' && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-100">
              <div className="flex-1 relative flex items-center">
                <Replace size={13} className="absolute left-3 text-[#59A869]" />
                <input 
                  type="text"
                  placeholder="Replace with..."
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#59A869] rounded pl-8 pr-4 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleReplaceCurrent}
                disabled={!activeMatch}
                className="px-3 py-1.5 bg-[#35373B] hover:bg-[#4E5157] text-white rounded text-xs transition-colors font-medium disabled:opacity-40"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleReplaceAll}
                disabled={rawResults.length === 0}
                className="px-4 py-1.5 bg-[#59A869] hover:bg-[#4D945B] text-white rounded text-xs transition-colors font-semibold disabled:opacity-40 shadow-sm"
              >
                Replace All ({rawResults.filter(r => !excludedMatchIds.has(r.id)).length})
              </button>
            </div>
          )}

          {/* Scope Tabs Navigation */}
          <div className="flex items-center justify-between border-t border-[#393B40]/60 pt-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#868A91] mr-1">Scope:</span>
              <button
                onClick={() => setScopeTab('in_project')}
                className={`px-2.5 py-1 rounded transition-colors ${scopeTab === 'in_project' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'}`}
              >
                In Project
              </button>
              <button
                onClick={() => setScopeTab('module')}
                className={`px-2.5 py-1 rounded transition-colors ${scopeTab === 'module' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'}`}
              >
                Module
              </button>
              <button
                onClick={() => setScopeTab('directory')}
                className={`px-2.5 py-1 rounded transition-colors ${scopeTab === 'directory' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'}`}
              >
                Directory
              </button>
              <button
                onClick={() => setScopeTab('scope')}
                className={`px-2.5 py-1 rounded transition-colors ${scopeTab === 'scope' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-[#DFE1E5]'}`}
              >
                Open Files
              </button>
            </div>

            {/* Sub-scope details selector */}
            <div className="flex items-center gap-2 text-[11px] text-[#868A91]">
              {scopeTab === 'module' && (
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value as any)}
                  className="bg-[#1E1F22] border border-[#393B40] rounded px-2 py-0.5 text-xs text-[#DFE1E5] outline-none"
                >
                  <option value="all">All Modules</option>
                  <option value="intellij-idea-clone">intellij-idea-clone (Frontend)</option>
                  <option value="src-tauri">src-tauri (Rust Backend)</option>
                </select>
              )}

              {scopeTab === 'directory' && (
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <span>Dir:</span>
                  <input
                    type="text"
                    value={directoryPath}
                    onChange={(e) => setDirectoryPath(e.target.value)}
                    className="bg-[#1E1F22] border border-[#393B40] rounded px-2 py-0.5 text-xs text-[#DFE1E5] outline-none w-56 truncate"
                  />
                </div>
              )}

              {isSearching ? (
                <span className="flex items-center gap-1 text-[#3574F0]">
                  <Loader2 size={12} className="animate-spin" /> Searching...
                </span>
              ) : (
                <span>
                  {rawResults.length} matches in {groupedMatches.length} files
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Center: Split Left (Matches List) / Right (Code Preview) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Matches List Grouped by File */}
          <div className="w-[440px] bg-[#26282B] border-r border-[#393B40] flex flex-col overflow-hidden">
            <div className="h-7 bg-[#212225] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] text-[#868A91] font-semibold uppercase">
              <span>Matching Files & Lines</span>
              <span className="text-[10px] text-[#868A91]">Enter to open • Del to exclude</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#393B40]/40 text-xs">
              {groupedMatches.length === 0 ? (
                <div className="p-8 text-center text-[#868A91] space-y-2">
                  <Search size={24} className="mx-auto opacity-30 text-white" />
                  <div>{query.trim() ? 'No matches found in project scope' : 'Type a search phrase to find in files'}</div>
                </div>
              ) : (
                groupedMatches.map((group) => (
                  <div key={group.file_path} className="border-b border-[#393B40]/40">
                    {/* File Header */}
                    <div className="px-3 py-1.5 bg-[#212225]/80 flex items-center justify-between text-[11.5px] font-semibold text-white sticky top-0 z-10">
                      <div className="flex items-center gap-1.5 truncate">
                        <FileCode size={13} className="text-[#3574F0] flex-shrink-0" />
                        <span className="truncate">{group.relative_path}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#35373B] text-[#868A91]">
                        {group.matches.length}
                      </span>
                    </div>

                    {/* Match Lines */}
                    <div className="divide-y divide-[#393B40]/20">
                      {group.matches.map((match) => {
                        const globalIdx = rawResults.findIndex(r => r.id === match.id);
                        const isSelected = selectedMatchIdx === globalIdx;
                        const isExcluded = excludedMatchIds.has(match.id);

                        return (
                          <div
                            key={match.id}
                            onClick={() => setSelectedMatchIdx(globalIdx)}
                            onDoubleClick={() => {
                              onOpenFileAtLocation(match.file_path, match.line_number, match.match_start + 1);
                              onClose();
                            }}
                            className={`px-3 py-2 cursor-pointer flex items-start gap-2.5 transition-colors group ${
                              isSelected ? 'bg-[#2E436E] text-white' : 'hover:bg-[#35373B]/60 text-[#DFE1E5]'
                            } ${isExcluded ? 'opacity-40 line-through' : ''}`}
                          >
                            <span className="font-mono text-[10.5px] text-[#868A91] flex-shrink-0 w-8 text-right pt-0.5">
                              {match.line_number}:
                            </span>

                            <div className="flex-1 min-w-0 font-mono text-[11px] leading-relaxed truncate">
                              {match.line_content.substring(0, match.match_start)}
                              <span className="bg-[#EDA200]/30 text-white font-bold rounded-sm px-0.5 border border-[#EDA200]/60">
                                {match.line_content.substring(match.match_start, match.match_end)}
                              </span>
                              {match.line_content.substring(match.match_end)}
                            </div>

                            {mode === 'replace' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleExclude(match.id);
                                }}
                                className="text-[#868A91] hover:text-white p-0.5 opacity-0 group-hover:opacity-100"
                                title={isExcluded ? 'Include in replace' : 'Exclude from replace'}
                              >
                                {isExcluded ? <Plus size={12} /> : <X size={12} />}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Code Context & Diff Preview */}
          <div className="flex-1 bg-[#1E1F22] flex flex-col overflow-hidden">
            <div className="h-7 bg-[#212225] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] text-[#868A91] font-semibold uppercase">
              <span>Code Context Preview</span>
              {activeMatch && (
                <span className="font-mono text-white text-[11px] truncate max-w-[320px]">
                  {activeMatch.relative_path} : {activeMatch.line_number}
                </span>
              )}
            </div>

            <div className="flex-1 p-4 overflow-auto font-mono text-xs leading-relaxed">
              {previewLoading ? (
                <div className="flex items-center justify-center h-full text-[#868A91] gap-2">
                  <Loader2 size={16} className="animate-spin text-[#3574F0]" /> Loading file context...
                </div>
              ) : !activeMatch ? (
                <div className="flex items-center justify-center h-full text-[#868A91]">
                  Select a match to preview code
                </div>
              ) : (
                <div className="space-y-1">
                  {previewContent.map((line, idx) => {
                    const isTargetLine = idx === Math.min(6, Math.floor(previewContent.length / 2)) || line === activeMatch.line_content;

                    return (
                      <div 
                        key={idx}
                        className={`flex items-start gap-4 px-2 py-0.5 rounded ${
                          isTargetLine ? 'bg-[#2B2D30] border-l-2 border-[#3574F0]' : 'text-[#868A91]'
                        }`}
                      >
                        <span className="w-8 text-right select-none text-[10.5px] opacity-50 flex-shrink-0">
                          {isTargetLine ? activeMatch.line_number : ''}
                        </span>

                        <div className="flex-1 text-[#DFE1E5] whitespace-pre overflow-x-auto">
                          {isTargetLine ? (
                            mode === 'replace' ? (
                              <div className="space-y-1">
                                <div className="line-through text-[#E05555] bg-[#E05555]/10 px-1 rounded">
                                  {line}
                                </div>
                                <div className="text-[#59A869] bg-[#59A869]/10 px-1 rounded font-bold">
                                  {line.substring(0, activeMatch.match_start)}
                                  <span className="bg-[#59A869]/30 text-white px-0.5 rounded border border-[#59A869]">
                                    {replaceText}
                                  </span>
                                  {line.substring(activeMatch.match_end)}
                                </div>
                              </div>
                            ) : (
                              <div>
                                {line.substring(0, activeMatch.match_start)}
                                <span className="bg-[#EDA200]/30 text-white font-bold rounded-sm px-0.5 border border-[#EDA200]">
                                  {line.substring(activeMatch.match_start, activeMatch.match_end)}
                                </span>
                                {line.substring(activeMatch.match_end)}
                              </div>
                            )
                          ) : (
                            line
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer: Open in Editor / Replace actions */}
        <div className="h-11 bg-[#212225] border-t border-[#393B40] px-4 flex items-center justify-between text-xs">
          <div className="text-[11px] text-[#868A91] flex items-center gap-2">
            <span>Press <kbd className="px-1.5 py-0.2 bg-[#1E1F22] border border-[#393B40] rounded font-mono text-white">Enter</kbd> to open in editor</span>
            <span>•</span>
            <span><kbd className="px-1.5 py-0.2 bg-[#1E1F22] border border-[#393B40] rounded font-mono text-white">↑ / ↓</kbd> to navigate</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!activeMatch}
              onClick={() => {
                if (activeMatch) {
                  onOpenFileAtLocation(activeMatch.file_path, activeMatch.line_number, activeMatch.match_start + 1);
                  onClose();
                }
              }}
              className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-semibold shadow-sm transition-colors disabled:opacity-40"
            >
              Open in Editor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
