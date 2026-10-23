import React, { useState, useMemo } from 'react';
import { 
  RotateCw, 
  X, 
  PlusSquare, 
  MinusSquare, 
  Columns, 
  FileCode, 
  ChevronRight, 
  ChevronDown, 
  ExternalLink 
} from 'lucide-react';
import { FindUsagesResult, UsageOccurrence } from '../types';

interface FindUsagesPanelProps {
  result: FindUsagesResult;
  onJumpToOccurrence: (occurrence: UsageOccurrence) => void;
  onRerun: () => void;
  onClose: () => void;
}

export const FindUsagesPanel: React.FC<FindUsagesPanelProps> = ({
  result,
  onJumpToOccurrence,
  onRerun,
  onClose,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'import' | 'usage' | 'declaration'>('all');
  const [showPreview, setShowPreview] = useState(true);
  const [selectedId, setSelectedId] = useState<string>(() => result.occurrences[0]?.id || '');
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});

  // Filter occurrences
  const filteredOccurrences = useMemo(() => {
    if (filterType === 'all') return result.occurrences;
    return result.occurrences.filter(o => o.usageType === filterType);
  }, [result.occurrences, filterType]);

  // Group by file
  const grouped = useMemo(() => {
    const map = new Map<string, UsageOccurrence[]>();
    for (const occ of filteredOccurrences) {
      const list = map.get(occ.filePath) || [];
      list.push(occ);
      map.set(occ.filePath, list);
    }
    return Array.from(map.entries());
  }, [filteredOccurrences]);

  const uniqueFilesCount = grouped.length;

  const counts = useMemo(() => {
    let imports = 0;
    let declarations = 0;
    let usages = 0;
    for (const o of result.occurrences) {
      if (o.usageType === 'import') imports++;
      else if (o.usageType === 'declaration') declarations++;
      else usages++;
    }
    return { all: result.occurrences.length, imports, declarations, usages };
  }, [result.occurrences]);

  const selectedOccurrence = useMemo(() => {
    return result.occurrences.find(o => o.id === selectedId) || result.occurrences[0] || null;
  }, [result.occurrences, selectedId]);

  const toggleFile = (path: string) => {
    setCollapsedFiles(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const expandAll = () => setCollapsedFiles({});
  const collapseAll = () => {
    const all: Record<string, boolean> = {};
    for (const [path] of grouped) {
      all[path] = true;
    }
    setCollapsedFiles(all);
  };

  const renderHighlightedSnippet = (lineContent: string, matchText: string) => {
    if (!matchText) return <span>{lineContent}</span>;
    const parts = lineContent.split(new RegExp(`(${matchText.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'g'));
    return (
      <span className="font-mono text-[11.5px]">
        {parts.map((part, i) =>
          part === matchText ? (
            <mark 
              key={i} 
              className="bg-[#544322] text-[#F5C254] font-semibold px-0.5 rounded border border-[#6B552B]/60"
            >
              {part}
            </mark>
          ) : (
            <span key={i} className="text-[#DFE1E5]">{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5] select-none text-xs">
      {/* Top Bar: Search Scope & Summary */}
      <div className="h-7 bg-[#2B2D30] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-3">
          <span className="text-[#868A91] font-medium">Usages of:</span>
          <span className="font-mono font-semibold text-[#DFE1E5] bg-[#393B40]/70 px-1.5 py-0.5 rounded">
            {result.symbol}
          </span>
          <span className="text-[#868A91]">
            ({result.occurrences.length} {result.occurrences.length === 1 ? 'usage' : 'usages'} in {uniqueFilesCount} {uniqueFilesCount === 1 ? 'file' : 'files'})
          </span>
          <span className="text-[10px] bg-[#3574F0]/20 text-[#3574F0] border border-[#3574F0]/40 px-1.5 py-0.2 rounded font-medium">
            Project Files
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2 py-0.5 rounded text-[10.5px] transition-colors ${
              filterType === 'all'
                ? 'bg-[#3574F0] text-white font-medium'
                : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#393B40]'
            }`}
          >
            All ({counts.all})
          </button>
          {counts.imports > 0 && (
            <button
              onClick={() => setFilterType('import')}
              className={`px-2 py-0.5 rounded text-[10.5px] transition-colors ${
                filterType === 'import'
                  ? 'bg-[#3574F0] text-white font-medium'
                  : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#393B40]'
              }`}
            >
              Imports ({counts.imports})
            </button>
          )}
          {counts.declarations > 0 && (
            <button
              onClick={() => setFilterType('declaration')}
              className={`px-2 py-0.5 rounded text-[10.5px] transition-colors ${
                filterType === 'declaration'
                  ? 'bg-[#3574F0] text-white font-medium'
                  : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#393B40]'
              }`}
            >
              Declarations ({counts.declarations})
            </button>
          )}
          <button
            onClick={() => setFilterType('usage')}
            className={`px-2 py-0.5 rounded text-[10.5px] transition-colors ${
              filterType === 'usage'
                ? 'bg-[#3574F0] text-white font-medium'
                : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#393B40]'
            }`}
          >
            Usages ({counts.usages})
          </button>
        </div>
      </div>

      {/* Main Area: Toolbar + Tree + Preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar (JetBrains Tool Window Strip) */}
        <div className="w-8 bg-[#2B2D30] border-r border-[#393B40] flex flex-col items-center py-2 gap-2 text-[#868A91]">
          <button
            onClick={onRerun}
            title="Rerun Search (Ctrl+F5)"
            className="p-1 hover:text-[#DFE1E5] hover:bg-[#393B40] rounded transition-colors"
          >
            <RotateCw size={13} />
          </button>
          <button
            onClick={onClose}
            title="Close Find Tab (Ctrl+Shift+F4)"
            className="p-1 hover:text-[#DFE1E5] hover:bg-[#393B40] rounded transition-colors"
          >
            <X size={13} />
          </button>

          <div className="w-4 border-t border-[#393B40] my-0.5" />

          <button
            onClick={expandAll}
            title="Expand All"
            className="p-1 hover:text-[#DFE1E5] hover:bg-[#393B40] rounded transition-colors"
          >
            <PlusSquare size={13} />
          </button>
          <button
            onClick={collapseAll}
            title="Collapse All"
            className="p-1 hover:text-[#DFE1E5] hover:bg-[#393B40] rounded transition-colors"
          >
            <MinusSquare size={13} />
          </button>

          <div className="w-4 border-t border-[#393B40] my-0.5" />

          <button
            onClick={() => setShowPreview(prev => !prev)}
            title="Toggle Preview Pane"
            className={`p-1 rounded transition-colors ${
              showPreview ? 'text-[#3574F0] bg-[#3574F0]/15' : 'hover:text-[#DFE1E5] hover:bg-[#393B40]'
            }`}
          >
            <Columns size={13} />
          </button>
        </div>

        {/* Center: Usages Tree */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-1 space-y-1">
          {grouped.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#868A91] text-xs">
              No usages found for symbol "{result.symbol}"
            </div>
          ) : (
            grouped.map(([filePath, occs]) => {
              const isCollapsed = !!collapsedFiles[filePath];

              return (
                <div key={filePath} className="select-none">
                  {/* File Node */}
                  <div
                    onClick={() => toggleFile(filePath)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#2B2D30] cursor-pointer text-[#DFE1E5] font-medium"
                  >
                    <span className="text-[#868A91]">
                      {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    </span>
                    <FileCode size={13} className="text-[#3574F0]" />
                    <span className="truncate">{filePath}</span>
                    <span className="text-[10px] text-[#868A91] font-normal ml-1">
                      ({occs.length} {occs.length === 1 ? 'usage' : 'usages'})
                    </span>
                  </div>

                  {/* Occurrences under File */}
                  {!isCollapsed && (
                    <div className="pl-6 space-y-0.5 mt-0.5">
                      {occs.map((occ) => {
                        const isSelected = occ.id === selectedId;

                        return (
                          <div
                            key={occ.id}
                            onClick={() => setSelectedId(occ.id)}
                            onDoubleClick={() => onJumpToOccurrence(occ)}
                            className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer group text-xs transition-colors ${
                              isSelected
                                ? 'bg-[#214283] text-white font-medium'
                                : 'hover:bg-[#2E436E]/40 text-[#DFE1E5]'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden mr-2">
                              {/* Line Number */}
                              <span className={`font-mono text-[11px] w-9 text-right flex-shrink-0 ${
                                isSelected ? 'text-white/80' : 'text-[#868A91]'
                              }`}>
                                {occ.lineNumber}:
                              </span>

                              {/* Highlighted Line Content */}
                              <div className="truncate">
                                {renderHighlightedSnippet(occ.lineContent, result.symbol)}
                              </div>
                            </div>

                            {/* Badge */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`text-[9.5px] uppercase tracking-wider px-1 py-0.2 rounded font-mono ${
                                occ.usageType === 'import'
                                  ? 'bg-[#7B61FF]/20 text-[#A28FFF] border border-[#7B61FF]/30'
                                  : occ.usageType === 'declaration'
                                  ? 'bg-[#00B4D8]/20 text-[#00B4D8] border border-[#00B4D8]/30'
                                  : 'bg-[#393B40] text-[#868A91]'
                              }`}>
                                {occ.usageType}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Preview Pane (IntelliJ Style) */}
        {showPreview && selectedOccurrence && (
          <div className="w-[420px] border-l border-[#393B40] flex flex-col bg-[#1A1B1E] flex-shrink-0 overflow-hidden">
            <div className="h-7 bg-[#2B2D30] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px]">
              <span className="text-[#868A91] font-mono truncate">
                {selectedOccurrence.fileName}:{selectedOccurrence.lineNumber}
              </span>
              <button
                onClick={() => onJumpToOccurrence(selectedOccurrence)}
                className="flex items-center gap-1 text-[#3574F0] hover:text-[#5B8DF5] font-medium text-[10.5px]"
              >
                <span>Jump to Source</span>
                <ExternalLink size={11} />
              </button>
            </div>

            <div className="flex-1 p-3 font-mono text-[11px] overflow-auto leading-relaxed bg-[#1E1F22]">
              <div className="text-[10px] text-[#868A91] mb-2 font-sans italic">
                Double-click occurrence or click "Jump to Source" to navigate in editor
              </div>

              {/* Context Preview */}
              <div className="bg-[#18191B] border border-[#393B40] rounded p-2.5 space-y-1">
                <div className="flex gap-2">
                  <span className="text-[#868A91] select-none w-7 text-right">{selectedOccurrence.lineNumber}</span>
                  <div className="overflow-x-auto whitespace-pre">
                    {renderHighlightedSnippet(selectedOccurrence.lineContent, result.symbol)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
