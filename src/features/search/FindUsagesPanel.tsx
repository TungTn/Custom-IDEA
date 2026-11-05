import React, { useState, useMemo, useEffect } from 'react';
import {
  RotateCw,
  X,
  PlusSquare,
  MinusSquare,
  Columns,
  FileCode,
  Folder,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Pin,
  Box,
  Code,
  Tag,
} from 'lucide-react';
import { FindUsagesResult, UsageOccurrence } from '../../types';

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
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    if (result.occurrences.length > 0 && !result.occurrences.some((o) => o.id === selectedId)) {
      setSelectedId(result.occurrences[0].id);
    }
  }, [result, selectedId]);

  // Filter occurrences based on active filter button
  const filteredOccurrences = useMemo(() => {
    if (filterType === 'all') return result.occurrences;
    return result.occurrences.filter((o: UsageOccurrence) => o.usageType === filterType);
  }, [result.occurrences, filterType]);

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
    return (
      result.occurrences.find((o: UsageOccurrence) => o.id === selectedId) ||
      result.occurrences[0] ||
      null
    );
  }, [result.occurrences, selectedId]);

  // Separate into IntelliJ-style groups:
  // 1. Declarations (Interface, Class, Function, etc.)
  // 2. Usages in Project Files (Grouped by Folder -> File -> Scope)
  // 3. Usage in import
  const declarations = useMemo(() => {
    return filteredOccurrences.filter((o) => o.usageType === 'declaration');
  }, [filteredOccurrences]);

  const projectUsages = useMemo(() => {
    return filteredOccurrences.filter((o) => o.usageType === 'usage');
  }, [filteredOccurrences]);

  const importUsages = useMemo(() => {
    return filteredOccurrences.filter((o) => o.usageType === 'import');
  }, [filteredOccurrences]);

  // Group usages by: Folder -> File -> Enclosing Scope
  const groupedProjectUsages = useMemo(() => {
    const folderMap = new Map<
      string,
      Map<string, Map<string, UsageOccurrence[]>>
    >();

    for (const occ of projectUsages) {
      const cleanPath = (occ.relativePath || occ.filePath).replace(/\\/g, '/');
      const parts = cleanPath.split('/');
      const fileName = parts.pop() || occ.fileName;
      const folderPath = parts.length > 0 ? parts.join('/') : 'Project Root';
      const scope = occ.enclosingScope || 'Unclassified';

      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, new Map());
      }
      const fileMap = folderMap.get(folderPath)!;

      if (!fileMap.has(fileName)) {
        fileMap.set(fileName, new Map());
      }
      const scopeMap = fileMap.get(fileName)!;

      if (!scopeMap.has(scope)) {
        scopeMap.set(scope, []);
      }
      scopeMap.get(scope)!.push(occ);
    }

    return folderMap;
  }, [projectUsages]);

  // Group imports by File
  const groupedImportUsages = useMemo(() => {
    const fileMap = new Map<string, UsageOccurrence[]>();
    for (const occ of importUsages) {
      const name = occ.fileName || occ.filePath.split(/[\\/]/).pop() || 'File';
      const list = fileMap.get(name) || [];
      list.push(occ);
      fileMap.set(name, list);
    }
    return Array.from(fileMap.entries());
  }, [importUsages]);

  const toggleNode = (key: string) => {
    setCollapsedNodes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => setCollapsedNodes({});
  const collapseAll = () => {
    const all: Record<string, boolean> = {
      'group-decl': true,
      'group-project': true,
      'group-import': true,
    };
    for (const [folder, files] of groupedProjectUsages.entries()) {
      all[`folder-${folder}`] = true;
      for (const [file] of files.entries()) {
        all[`file-${folder}-${file}`] = true;
      }
    }
    setCollapsedNodes(all);
  };

  // Up/Down occurrence navigation
  const handlePrevOccurrence = () => {
    if (filteredOccurrences.length === 0) return;
    const idx = filteredOccurrences.findIndex((o) => o.id === selectedId);
    const prevIdx = idx <= 0 ? filteredOccurrences.length - 1 : idx - 1;
    const target = filteredOccurrences[prevIdx];
    setSelectedId(target.id);
    onJumpToOccurrence(target);
  };

  const handleNextOccurrence = () => {
    if (filteredOccurrences.length === 0) return;
    const idx = filteredOccurrences.findIndex((o) => o.id === selectedId);
    const nextIdx = idx === -1 || idx >= filteredOccurrences.length - 1 ? 0 : idx + 1;
    const target = filteredOccurrences[nextIdx];
    setSelectedId(target.id);
    onJumpToOccurrence(target);
  };

  const renderHighlightedSnippet = (lineContent: string, matchText: string) => {
    if (!matchText) return <span>{lineContent}</span>;
    const parts = lineContent.split(
      new RegExp(`(${matchText.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'g')
    );
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
            <span key={i} className="text-[#DFE1E5]">
              {part}
            </span>
          )
        )}
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5] select-none text-xs">
      {/* Top Bar: Scope & Filters */}
      <div className="h-7 bg-[#2B2D30] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#868A91]">Usages of:</span>
          <span className="font-mono font-semibold text-[#DFE1E5] bg-[#393B40]/70 px-1.5 py-0.5 rounded">
            {result.symbol}
          </span>
          <span className="text-[#868A91]">
            ({result.occurrences.length} {result.occurrences.length === 1 ? 'usage' : 'usages'} in project)
          </span>
        </div>

        {/* Filter Badges */}
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
          {counts.usages > 0 && (
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
          )}
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
        </div>
      </div>

      {/* Main Area: Toolbar + Tree + Preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar (JetBrains Tool Window Strip) */}
        <div className="w-8 bg-[#2B2D30] border-r border-[#393B40] flex flex-col items-center py-2 gap-1.5 text-[#868A91] flex-shrink-0">
          <button
            onClick={onRerun}
            title="Rerun Search (Ctrl+F5)"
            className="p-1 hover:text-[#DFE1E5] hover:bg-[#393B40] rounded transition-colors cursor-pointer"
          >
            <RotateCw size={13} />
          </button>

          <button
            onClick={() => setIsPinned((prev) => !prev)}
            title={isPinned ? 'Unpin Tab' : 'Pin Tab'}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isPinned ? 'text-[#3574F0] bg-[#3574F0]/15' : 'hover:text-[#DFE1E5] hover:bg-[#393B40]'
            }`}
          >
            <Pin size={13} />
          </button>

          <div className="w-4 border-t border-[#393B40] my-0.5" />

          <button
            onClick={handlePrevOccurrence}
            title="Previous Occurrence (Ctrl+Alt+Up)"
            className="p-1 hover:text-[#DFE1E5] hover:bg-[#393B40] rounded transition-colors cursor-pointer"
          >
            <ArrowUp size={13} />
          </button>
          <button
            onClick={handleNextOccurrence}
            title="Next Occurrence (Ctrl+Alt+Down)"
            className="p-1 hover:text-[#DFE1E5] hover:bg-[#393B40] rounded transition-colors cursor-pointer"
          >
            <ArrowDown size={13} />
          </button>

          <div className="w-4 border-t border-[#393B40] my-0.5" />

          <button
            onClick={expandAll}
            title="Expand All"
            className="p-1 hover:text-[#DFE1E5] hover:bg-[#393B40] rounded transition-colors cursor-pointer"
          >
            <PlusSquare size={13} />
          </button>
          <button
            onClick={collapseAll}
            title="Collapse All"
            className="p-1 hover:text-[#DFE1E5] hover:bg-[#393B40] rounded transition-colors cursor-pointer"
          >
            <MinusSquare size={13} />
          </button>

          <div className="w-4 border-t border-[#393B40] my-0.5" />

          <button
            onClick={() => setShowPreview((prev) => !prev)}
            title="Toggle Preview Pane"
            className={`p-1 rounded transition-colors cursor-pointer ${
              showPreview ? 'text-[#3574F0] bg-[#3574F0]/15' : 'hover:text-[#DFE1E5] hover:bg-[#393B40]'
            }`}
          >
            <Columns size={13} />
          </button>

          <button
            onClick={onClose}
            title="Close Find Tab (Ctrl+Shift+F4)"
            className="p-1 hover:text-[#DFE1E5] hover:bg-[#393B40] rounded transition-colors mt-auto cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        {/* Center: IntelliJ Hierarchical Tree */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1 font-sans text-xs">
          {filteredOccurrences.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#868A91] text-xs">
              No usages found for symbol "{result.symbol}"
            </div>
          ) : (
            <>
              {/* ─── 1. Interface / Declaration Group ─── */}
              {declarations.length > 0 && (
                <div>
                  <div
                    onClick={() => toggleNode('group-decl')}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[#2B2D30] cursor-pointer text-[#DFE1E5] font-semibold"
                  >
                    <span className="text-[#868A91]">
                      {collapsedNodes['group-decl'] ? (
                        <ChevronRight size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                    </span>
                    <Box size={13} className="text-[#299999]" />
                    <span>
                      {declarations[0]?.declarationKind
                        ? declarations[0].declarationKind.charAt(0).toUpperCase() +
                          declarations[0].declarationKind.slice(1)
                        : 'Declaration'}
                    </span>
                    <span className="text-[10px] text-[#868A91] font-normal">
                      ({declarations.length})
                    </span>
                  </div>

                  {!collapsedNodes['group-decl'] && (
                    <div className="pl-6 space-y-0.5 mt-0.5">
                      {declarations.map((decl) => {
                        const isSelected = decl.id === selectedId;
                        return (
                          <div
                            key={decl.id}
                            onClick={() => setSelectedId(decl.id)}
                            onDoubleClick={() => onJumpToOccurrence(decl)}
                            className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[#214283] text-white font-medium'
                                : 'hover:bg-[#2E436E]/40 text-[#DFE1E5]'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate mr-2">
                              <Box size={12} className="text-[#299999] flex-shrink-0" />
                              <span className="font-semibold text-[#DFE1E5]">{result.symbol}</span>
                              <span className="text-[#868A91] font-mono text-[11px] truncate">
                                ({decl.relativePath || decl.filePath}:{decl.lineNumber})
                              </span>
                            </div>
                            <span className="text-[9.5px] px-1 py-0.2 rounded bg-[#00B4D8]/20 text-[#00B4D8] border border-[#00B4D8]/30 font-mono">
                              def
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ─── 2. Usages in Project Files Group ─── */}
              {projectUsages.length > 0 && (
                <div>
                  <div
                    onClick={() => toggleNode('group-project')}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[#2B2D30] cursor-pointer text-[#DFE1E5] font-semibold"
                  >
                    <span className="text-[#868A91]">
                      {collapsedNodes['group-project'] ? (
                        <ChevronRight size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                    </span>
                    <Folder size={13} className="text-[#E5C07B]" />
                    <span>Usages in Project Files</span>
                    <span className="text-[10px] text-[#868A91] font-normal">
                      ({projectUsages.length} {projectUsages.length === 1 ? 'result' : 'results'})
                    </span>
                  </div>

                  {!collapsedNodes['group-project'] && (
                    <div className="pl-4 space-y-1 mt-0.5">
                      {Array.from(groupedProjectUsages.entries()).map(([folder, fileMap]) => {
                        const folderKey = `folder-${folder}`;
                        const isFolderCollapsed = !!collapsedNodes[folderKey];

                        let folderTotal = 0;
                        for (const scopes of fileMap.values()) {
                          for (const occs of scopes.values()) {
                            folderTotal += occs.length;
                          }
                        }

                        return (
                          <div key={folder} className="select-none">
                            {/* Folder Node */}
                            <div
                              onClick={() => toggleNode(folderKey)}
                              className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[#2B2D30] cursor-pointer text-[#DFE1E5] font-medium"
                            >
                              <span className="text-[#868A91]">
                                {isFolderCollapsed ? (
                                  <ChevronRight size={12} />
                                ) : (
                                  <ChevronDown size={12} />
                                )}
                              </span>
                              <Folder size={13} className="text-[#868A91]" />
                              <span className="font-mono text-[11.5px]">{folder}</span>
                              <span className="text-[10px] text-[#868A91] font-normal">
                                ({folderTotal})
                              </span>
                            </div>

                            {/* Files under Folder */}
                            {!isFolderCollapsed && (
                              <div className="pl-4 space-y-1 mt-0.5">
                                {Array.from(fileMap.entries()).map(([fileName, scopeMap]) => {
                                  const fileKey = `file-${folder}-${fileName}`;
                                  const isFileCollapsed = !!collapsedNodes[fileKey];

                                  let fileTotal = 0;
                                  for (const occs of scopeMap.values()) {
                                    fileTotal += occs.length;
                                  }

                                  return (
                                    <div key={fileName}>
                                      {/* File Node */}
                                      <div
                                        onClick={() => toggleNode(fileKey)}
                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[#2B2D30] cursor-pointer text-[#DFE1E5]"
                                      >
                                        <span className="text-[#868A91]">
                                          {isFileCollapsed ? (
                                            <ChevronRight size={12} />
                                          ) : (
                                            <ChevronDown size={12} />
                                          )}
                                        </span>
                                        <FileCode size={13} className="text-[#3574F0]" />
                                        <span className="font-semibold">{fileName}</span>
                                        <span className="text-[10px] text-[#868A91] font-normal">
                                          ({fileTotal})
                                        </span>
                                      </div>

                                      {/* Scopes under File */}
                                      {!isFileCollapsed && (
                                        <div className="pl-4 space-y-0.5 mt-0.5">
                                          {Array.from(scopeMap.entries()).map(
                                            ([scopeName, occs]) => {
                                              const scopeKey = `scope-${folder}-${fileName}-${scopeName}`;
                                              const isScopeCollapsed = !!collapsedNodes[scopeKey];

                                              return (
                                                <div key={scopeName}>
                                                  {/* Scope / Method Node */}
                                                  {scopeName !== 'Unclassified' && (
                                                    <div
                                                      onClick={() => toggleNode(scopeKey)}
                                                      className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[#2B2D30] cursor-pointer text-[#DFE1E5] text-[11px]"
                                                    >
                                                      <span className="text-[#868A91]">
                                                        {isScopeCollapsed ? (
                                                          <ChevronRight size={11} />
                                                        ) : (
                                                          <ChevronDown size={11} />
                                                        )}
                                                      </span>
                                                      <Code size={12} className="text-[#FFC66D]" />
                                                      <span className="font-mono text-[#FFC66D]">
                                                        {scopeName}
                                                      </span>
                                                      <span className="text-[10px] text-[#868A91]">
                                                        ({occs.length})
                                                      </span>
                                                    </div>
                                                  )}

                                                  {/* Occurrences Leaf Nodes */}
                                                  {!isScopeCollapsed && (
                                                    <div
                                                      className={
                                                        scopeName !== 'Unclassified'
                                                          ? 'pl-4 space-y-0.5'
                                                          : 'space-y-0.5'
                                                      }
                                                    >
                                                      {occs.map((occ) => {
                                                        const isSelected = occ.id === selectedId;

                                                        return (
                                                          <div
                                                            key={occ.id}
                                                            onClick={() => setSelectedId(occ.id)}
                                                            onDoubleClick={() =>
                                                              onJumpToOccurrence(occ)
                                                            }
                                                            className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer group text-xs transition-colors ${
                                                              isSelected
                                                                ? 'bg-[#214283] text-white font-medium'
                                                                : 'hover:bg-[#2E436E]/40 text-[#DFE1E5]'
                                                            }`}
                                                          >
                                                            <div className="flex items-center gap-2 overflow-hidden mr-2">
                                                              {/* Line Number */}
                                                              <span
                                                                className={`font-mono text-[11px] w-9 text-right flex-shrink-0 ${
                                                                  isSelected
                                                                    ? 'text-white/80'
                                                                    : 'text-[#868A91]'
                                                                }`}
                                                              >
                                                                {occ.lineNumber}:
                                                              </span>

                                                              {/* Highlighted Snippet */}
                                                              <div className="truncate">
                                                                {renderHighlightedSnippet(
                                                                  occ.lineContent,
                                                                  result.symbol
                                                                )}
                                                              </div>
                                                            </div>
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            }
                                          )}
                                        </div>
                                      )}
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
              )}

              {/* ─── 3. Usage in Import Group ─── */}
              {importUsages.length > 0 && (
                <div>
                  <div
                    onClick={() => toggleNode('group-import')}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[#2B2D30] cursor-pointer text-[#DFE1E5] font-semibold"
                  >
                    <span className="text-[#868A91]">
                      {collapsedNodes['group-import'] ? (
                        <ChevronRight size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                    </span>
                    <Tag size={13} className="text-[#A28FFF]" />
                    <span>Usage in import</span>
                    <span className="text-[10px] text-[#868A91] font-normal">
                      ({importUsages.length} {importUsages.length === 1 ? 'result' : 'results'})
                    </span>
                  </div>

                  {!collapsedNodes['group-import'] && (
                    <div className="pl-4 space-y-1 mt-0.5">
                      {groupedImportUsages.map(([fileName, occs]) => {
                        const fileKey = `import-${fileName}`;
                        const isFileCollapsed = !!collapsedNodes[fileKey];

                        return (
                          <div key={fileName}>
                            <div
                              onClick={() => toggleNode(fileKey)}
                              className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[#2B2D30] cursor-pointer text-[#DFE1E5]"
                            >
                              <span className="text-[#868A91]">
                                {isFileCollapsed ? (
                                  <ChevronRight size={12} />
                                ) : (
                                  <ChevronDown size={12} />
                                )}
                              </span>
                              <FileCode size={13} className="text-[#7B61FF]" />
                              <span className="font-semibold">{fileName}</span>
                              <span className="text-[10px] text-[#868A91]">({occs.length})</span>
                            </div>

                            {!isFileCollapsed && (
                              <div className="pl-4 space-y-0.5 mt-0.5">
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
                                        <span
                                          className={`font-mono text-[11px] w-9 text-right flex-shrink-0 ${
                                            isSelected ? 'text-white/80' : 'text-[#868A91]'
                                          }`}
                                        >
                                          {occ.lineNumber}:
                                        </span>
                                        <div className="truncate">
                                          {renderHighlightedSnippet(
                                            occ.lineContent,
                                            result.symbol
                                          )}
                                        </div>
                                      </div>
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
              )}
            </>
          )}
        </div>

        {/* Right Preview Pane (IntelliJ Style) */}
        {showPreview && selectedOccurrence && (
          <div className="w-[440px] border-l border-[#393B40] flex flex-col bg-[#1A1B1E] flex-shrink-0 overflow-hidden">
            <div className="h-7 bg-[#2B2D30] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px]">
              <span className="text-[#868A91] font-mono truncate">
                {selectedOccurrence.fileName}:{selectedOccurrence.lineNumber}
              </span>
              <button
                onClick={() => onJumpToOccurrence(selectedOccurrence)}
                className="flex items-center gap-1 text-[#3574F0] hover:text-[#5B8DF5] font-medium text-[10.5px] cursor-pointer"
              >
                <span>Jump to Source</span>
                <ExternalLink size={11} />
              </button>
            </div>

            <div className="flex-1 p-3 font-mono text-[11px] overflow-auto leading-relaxed bg-[#1E1F22]">
              <div className="text-[10px] text-[#868A91] mb-2 font-sans italic">
                Double-click or press Enter to navigate to source in editor
              </div>

              {/* Context Preview */}
              <div className="bg-[#18191B] border border-[#393B40] rounded p-2.5 space-y-1">
                <div className="flex gap-2">
                  <span className="text-[#868A91] select-none w-7 text-right">
                    {selectedOccurrence.lineNumber}
                  </span>
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
