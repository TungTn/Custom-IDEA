import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, 
  RotateCw, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  FileCode, 
  Filter,
  CheckCircle2,
  FolderOpen,
  Tag
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { OpenTab } from '../../types';

export interface SearchTextResultDto {
  file_name: string;
  file_path: string;
  relative_path: string;
  line_number: number;
  column_number?: number;
  match_start?: number;
  line_content?: string;
  line_text?: string;
}

export interface TodoItem {
  id: string;
  type: 'TODO' | 'FIXME' | 'NOTE' | 'HACK';
  message: string;
  fileName: string;
  filePath: string;
  relativePath: string;
  line: number;
  col: number;
}

interface TodoToolWindowProps {
  projectPath: string;
  activeTab?: OpenTab;
  onOpenFileAtLocation: (filePath: string, line: number, col?: number) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const TodoToolWindow: React.FC<TodoToolWindowProps> = ({
  projectPath,
  activeTab,
  onOpenFileAtLocation,
  onShowToast,
}) => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [scope, setScope] = useState<'project' | 'current'>('project');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});

  const scanTodos = async () => {
    setIsScanning(true);
    const collected: TodoItem[] = [];

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        // Query TODO and FIXME via search_project_text
        const [todoResults, fixmeResults] = await Promise.all([
          invoke<SearchTextResultDto[]>('search_project_text', {
            projectPath,
            query: 'TODO',
            caseSensitive: false,
            limit: 200,
          }).catch(() => []),
          invoke<SearchTextResultDto[]>('search_project_text', {
            projectPath,
            query: 'FIXME',
            caseSensitive: false,
            limit: 100,
          }).catch(() => []),
        ]);

        const rawList = [...(todoResults || []), ...(fixmeResults || [])];
        const seen = new Set<string>();

        for (const item of rawList) {
          const key = `${item.file_path}:${item.line_number}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const rawLine = item.line_content ?? item.line_text ?? '';
          const trimmed = rawLine.trim();
          if (!trimmed) continue;
          let type: 'TODO' | 'FIXME' | 'NOTE' | 'HACK' = 'TODO';
          if (/fixme/i.test(trimmed)) type = 'FIXME';
          else if (/hack/i.test(trimmed)) type = 'HACK';
          else if (/note/i.test(trimmed)) type = 'NOTE';

          // Extract clean message after comment marker
          const match = trimmed.match(/(?:\/\/|#|\/\*|\*)\s*(?:todo|fixme|hack|note)[:\s]*(.*)/i);
          const message = match && match[1]?.trim() ? match[1].trim() : trimmed;

          collected.push({
            id: `todo-${key}`,
            type,
            message,
            fileName: item.file_name,
            filePath: item.file_path,
            relativePath: item.relative_path,
            line: item.line_number,
            col: (item.match_start !== undefined ? item.match_start + 1 : item.column_number) || 1,
          });
        }
      } else if (activeTab?.content) {
        // Fallback for current active tab content
        const lines = activeTab.content.split(/\r?\n/);
        lines.forEach((line, idx) => {
          const match = line.match(/(?:\/\/|#|\/\*|\*)\s*(TODO|FIXME|HACK|NOTE)[:\s]*(.*)/i);
          if (match) {
            collected.push({
              id: `todo-tab-${idx}`,
              type: match[1].toUpperCase() as any,
              message: match[2]?.trim() || line.trim(),
              fileName: activeTab.title,
              filePath: activeTab.path || activeTab.title,
              relativePath: activeTab.title,
              line: idx + 1,
              col: match.index || 1,
            });
          }
        });
      }

      setTodos(collected);

      // Auto expand all discovered files
      const autoExpand: Record<string, boolean> = {};
      collected.forEach((t) => {
        autoExpand[t.filePath] = true;
      });
      setExpandedFiles(autoExpand);
    } catch (err: any) {
      console.warn('Scan TODO error:', err);
      onShowToast?.('TODO Scanner', String(err), 'error');
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    scanTodos();
  }, [projectPath]);

  // Group and filter items
  const groupedTodos = useMemo(() => {
    let filtered = todos;

    if (scope === 'current' && activeTab?.path) {
      filtered = filtered.filter((t) => t.filePath === activeTab.path || t.fileName === activeTab.title);
    }

    if (filterType !== 'ALL') {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((t) => t.message.toLowerCase().includes(q) || t.fileName.toLowerCase().includes(q));
    }

    const map = new Map<string, { fileName: string; filePath: string; items: TodoItem[] }>();
    for (const item of filtered) {
      if (!map.has(item.filePath)) {
        map.set(item.filePath, { fileName: item.fileName, filePath: item.filePath, items: [] });
      }
      map.get(item.filePath)!.items.push(item);
    }

    return Array.from(map.values());
  }, [todos, scope, filterType, searchQuery, activeTab]);

  const totalCount = useMemo(() => {
    return groupedTodos.reduce((acc, g) => acc + g.items.length, 0);
  }, [groupedTodos]);

  const toggleExpand = (path: string) => {
    setExpandedFiles((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5] text-xs select-none">
      {/* Top Toolbar */}
      <div className="h-8 border-b border-[#2B2D30] px-3 flex items-center justify-between bg-[#1E1F22] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-white">
            <CheckSquare size={14} className="text-[#3574F0]" />
            <span>TODO</span>
            <span className="px-1.5 py-0.2 bg-[#2B2D30] text-[#85B1F8] rounded text-[10px] font-mono border border-[#393B40]">
              {totalCount} items
            </span>
          </div>

          <div className="flex items-center gap-1 bg-[#2B2D30] rounded p-0.5 border border-[#393B40]">
            <button
              onClick={() => setScope('project')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                scope === 'project' ? 'bg-[#3574F0] text-white' : 'text-[#868A91] hover:text-[#DFE1E5]'
              }`}
            >
              Project ({todos.length})
            </button>
            <button
              onClick={() => setScope('current')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                scope === 'current' ? 'bg-[#3574F0] text-white' : 'text-[#868A91] hover:text-[#DFE1E5]'
              }`}
            >
              Current File
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-[#2B2D30] border border-[#393B40] rounded px-2 py-0.5 text-xs text-[#DFE1E5] focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="TODO">TODO only</option>
            <option value="FIXME">FIXME only</option>
            <option value="NOTE">NOTE only</option>
          </select>

          {/* Search box */}
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1.5 text-[#868A91]" />
            <input
              type="text"
              placeholder="Search comments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-6 pr-2 py-0.5 bg-[#2B2D30] border border-[#393B40] rounded text-xs text-[#DFE1E5] focus:outline-none focus:border-[#3574F0] w-36"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={scanTodos}
            disabled={isScanning}
            className="p-1 hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] rounded transition-colors"
            title="Rescan project for TODOs"
          >
            <RotateCw size={13} className={isScanning ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-2">
        {groupedTodos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#868A91] space-y-2">
            <CheckCircle2 size={30} className="text-[#5BB974]" />
            <p className="font-medium text-[#DFE1E5]">No TODO items found</p>
            <p className="text-xs">
              Add <code className="text-[#85B1F8]">// TODO: ...</code> or <code className="text-[#E06C75]">// FIXME: ...</code> comments in your code to track tasks.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {groupedTodos.map((group) => {
              const isExpanded = expandedFiles[group.filePath] ?? true;
              return (
                <div key={group.filePath} className="border border-[#2B2D30] rounded bg-[#1E1F22] overflow-hidden">
                  {/* File Node Header */}
                  <div
                    onClick={() => toggleExpand(group.filePath)}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-[#2B2D30]/60 hover:bg-[#2B2D30] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isExpanded ? <ChevronDown size={13} className="text-[#868A91]" /> : <ChevronRight size={13} className="text-[#868A91]" />}
                      <FileCode size={13} className="text-[#3574F0]" />
                      <span className="font-medium text-white text-xs">{group.fileName}</span>
                      <span className="text-[11px] text-[#868A91] font-mono truncate">{group.filePath}</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#868A91] ml-2">
                      {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  {/* Todo Items in File */}
                  {isExpanded && (
                    <div className="divide-y divide-[#2B2D30]/40 pl-5 pr-2 py-1">
                      {group.items.map((item) => {
                        const isFixme = item.type === 'FIXME';
                        const badgeColor = isFixme
                          ? 'bg-[#E05555]/20 text-[#E05555] border-[#E05555]/40'
                          : 'bg-[#3574F0]/20 text-[#85B1F8] border-[#3574F0]/40';

                        return (
                          <div
                            key={item.id}
                            onDoubleClick={() => onOpenFileAtLocation(item.filePath, item.line, item.col)}
                            onClick={() => onOpenFileAtLocation(item.filePath, item.line, item.col)}
                            className="py-1 px-2 hover:bg-[#2B2D30] rounded cursor-pointer group flex items-start gap-2.5 transition-colors"
                          >
                            <span className="font-mono text-[11px] text-[#868A91] w-10 flex-shrink-0 pt-0.5">
                              line {item.line}
                            </span>

                            <span
                              className={`text-[9px] px-1 py-0.2 rounded border font-mono font-semibold flex-shrink-0 ${badgeColor}`}
                            >
                              {item.type}
                            </span>

                            <span className="text-xs text-[#DFE1E5] group-hover:text-white leading-relaxed break-all">
                              {item.message}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
