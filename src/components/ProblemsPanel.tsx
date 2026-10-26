import React, { useState, useMemo } from 'react';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Search, 
  RotateCw, 
  ChevronRight, 
  ChevronDown, 
  FileCode, 
  CheckCircle2, 
  Lightbulb, 
  MapPin, 
  X,
  Filter
} from 'lucide-react';
import { ProblemItem } from '../types';

interface ProblemsPanelProps {
  problems: ProblemItem[];
  activeFilePath?: string;
  onJumpToProblem: (filePath: string, line: number, column: number) => void;
  onQuickFix?: (problem: ProblemItem) => void;
  onRerunInspection?: () => void;
  onClose?: () => void;
}

export const ProblemsPanel: React.FC<ProblemsPanelProps> = ({
  problems,
  activeFilePath,
  onJumpToProblem,
  onQuickFix,
  onRerunInspection,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'project'>('current');
  const [searchQuery, setSearchQuery] = useState('');
  const [showErrors, setShowErrors] = useState(true);
  const [showWarnings, setShowWarnings] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [autoScrollToSource, setAutoScrollToSource] = useState(true);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Filter problems by active file if 'current'
  const scopedProblems = useMemo(() => {
    if (activeTab === 'current') {
      if (!activeFilePath) return [];
      const normActive = activeFilePath.replace(/\\/g, '/');
      return problems.filter(p => {
        const normP = p.filePath.replace(/\\/g, '/');
        return normP === normActive || normP.endsWith(normActive) || normActive.endsWith(normP);
      });
    }
    return problems;
  }, [problems, activeTab, activeFilePath]);

  // Apply severity and text filters
  const filteredProblems = useMemo(() => {
    return scopedProblems.filter(p => {
      if (p.severity === 'error' && !showErrors) return false;
      if (p.severity === 'warning' && !showWarnings) return false;
      if (p.severity === 'info' && !showInfo) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.message.toLowerCase().includes(q) ||
          p.fileName.toLowerCase().includes(q) ||
          p.source?.toLowerCase().includes(q) ||
          p.code?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scopedProblems, showErrors, showWarnings, showInfo, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    const errorCount = scopedProblems.filter(p => p.severity === 'error').length;
    const warnCount = scopedProblems.filter(p => p.severity === 'warning').length;
    const infoCount = scopedProblems.filter(p => p.severity === 'info').length;
    return { errorCount, warnCount, infoCount, total: scopedProblems.length };
  }, [scopedProblems]);

  // Group by file
  const groupedByFile = useMemo(() => {
    const map = new Map<string, { fileName: string; filePath: string; items: ProblemItem[] }>();
    filteredProblems.forEach(p => {
      const key = p.filePath;
      if (!map.has(key)) {
        map.set(key, { fileName: p.fileName, filePath: p.filePath, items: [] });
      }
      map.get(key)!.items.push(p);
    });
    return Array.from(map.values());
  }, [filteredProblems]);

  const toggleFile = (filePath: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  };

  const handleSelectProblem = (p: ProblemItem, isDoubleClick = false) => {
    if (autoScrollToSource || isDoubleClick) {
      onJumpToProblem(p.filePath, p.line, p.column);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5] font-sans select-none overflow-hidden">
      {/* Top Header Bar */}
      <div className="h-7 bg-[#2B2D30] border-b border-[#393B40] px-2 flex items-center justify-between text-[11px] select-none flex-shrink-0">
        <div className="flex items-center gap-1 h-full">
          {/* Sub-tabs */}
          <button
            onClick={() => setActiveTab('current')}
            className={`px-2.5 h-full flex items-center gap-1.5 transition-colors relative cursor-pointer ${
              activeTab === 'current'
                ? 'text-[#DFE1E5] font-medium bg-[#1E1F22]'
                : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#393B40]/50'
            }`}
          >
            {activeTab === 'current' && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#3574F0]" />
            )}
            <span>Current File</span>
            <span className="bg-[#393B40] text-[#DFE1E5] px-1.5 py-0.2 rounded-full text-[10px]">
              {problems.filter(p => {
                if (!activeFilePath) return false;
                const normActive = activeFilePath.replace(/\\/g, '/');
                const normP = p.filePath.replace(/\\/g, '/');
                return normP === normActive || normP.endsWith(normActive) || normActive.endsWith(normP);
              }).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('project')}
            className={`px-2.5 h-full flex items-center gap-1.5 transition-colors relative cursor-pointer ${
              activeTab === 'project'
                ? 'text-[#DFE1E5] font-medium bg-[#1E1F22]'
                : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#393B40]/50'
            }`}
          >
            {activeTab === 'project' && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#3574F0]" />
            )}
            <span>Project Errors</span>
            <span className="bg-[#393B40] text-[#DFE1E5] px-1.5 py-0.2 rounded-full text-[10px]">
              {problems.length}
            </span>
          </button>
        </div>

        {/* Severity Toggle Chips & Actions */}
        <div className="flex items-center gap-2">
          {/* Error filter toggle */}
          <button
            onClick={() => setShowErrors(prev => !prev)}
            title="Toggle Errors"
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] cursor-pointer transition-colors ${
              showErrors ? 'bg-[#E55353]/20 text-[#E55353] border border-[#E55353]/40' : 'text-[#868A91] opacity-50'
            }`}
          >
            <AlertCircle size={12} />
            <span>{counts.errorCount}</span>
          </button>

          {/* Warning filter toggle */}
          <button
            onClick={() => setShowWarnings(prev => !prev)}
            title="Toggle Warnings"
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] cursor-pointer transition-colors ${
              showWarnings ? 'bg-[#F1A23A]/20 text-[#F1A23A] border border-[#F1A23A]/40' : 'text-[#868A91] opacity-50'
            }`}
          >
            <AlertTriangle size={12} />
            <span>{counts.warnCount}</span>
          </button>

          {/* Info filter toggle */}
          <button
            onClick={() => setShowInfo(prev => !prev)}
            title="Toggle Info"
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] cursor-pointer transition-colors ${
              showInfo ? 'bg-[#3574F0]/20 text-[#3574F0] border border-[#3574F0]/40' : 'text-[#868A91] opacity-50'
            }`}
          >
            <Info size={12} />
            <span>{counts.infoCount}</span>
          </button>

          <div className="w-[1px] h-3.5 bg-[#393B40] mx-0.5" />

          {/* Search Input */}
          <div className="flex items-center gap-1 bg-[#1E1F22] border border-[#393B40] rounded px-1.5 py-0.5">
            <Search size={11} className="text-[#868A91]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter problems..."
              className="bg-transparent text-[11px] text-[#DFE1E5] placeholder-[#868A91] outline-none w-28"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[#868A91] hover:text-[#DFE1E5]">
                <X size={10} />
              </button>
            )}
          </div>

          {/* Auto Scroll to Source Toggle */}
          <button
            onClick={() => setAutoScrollToSource(prev => !prev)}
            title={`Autoscroll to Source: ${autoScrollToSource ? 'ON' : 'OFF'}`}
            className={`p-1 rounded cursor-pointer transition-colors ${
              autoScrollToSource ? 'text-[#3574F0] bg-[#3574F0]/10' : 'text-[#868A91] hover:text-[#DFE1E5]'
            }`}
          >
            <MapPin size={12} />
          </button>

          {/* Rerun Inspection */}
          <button
            onClick={onRerunInspection}
            title="Rerun Inspection (Ctrl+F5)"
            className="p-1 text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#393B40] rounded cursor-pointer transition-colors"
          >
            <RotateCw size={12} />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              title="Close Panel"
              className="text-[#868A91] hover:text-[#DFE1E5] p-1 rounded hover:bg-[#393B40]"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto text-[12px]">
        {filteredProblems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#868A91]">
            <CheckCircle2 size={32} className="text-[#59A869] mb-2 animate-in zoom-in duration-200" />
            <span className="text-[13px] font-medium text-[#DFE1E5]">No problems found</span>
            <span className="text-[11px] text-[#868A91] mt-1">
              {activeTab === 'current' 
                ? 'Current file inspection passed. No syntax or type errors detected.' 
                : 'All files in workspace are clean. Code analysis passing.'}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-[#2B2D30]">
            {groupedByFile.map(group => {
              const isExpanded = !expandedFiles.has(group.filePath); // default expanded
              return (
                <div key={group.filePath} className="bg-[#1E1F22]">
                  {/* File Header */}
                  <div
                    onClick={() => toggleFile(group.filePath)}
                    className="flex items-center justify-between px-3 py-1.5 bg-[#26282B] hover:bg-[#2F3136] cursor-pointer text-[12px] font-medium"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isExpanded ? <ChevronDown size={13} className="text-[#868A91]" /> : <ChevronRight size={13} className="text-[#868A91]" />}
                      <FileCode size={14} className="text-[#3574F0] flex-shrink-0" />
                      <span className="text-[#DFE1E5] truncate font-mono">{group.fileName}</span>
                      <span className="text-[10px] text-[#868A91] truncate hidden sm:inline">{group.filePath}</span>
                    </div>
                    <span className="text-[10px] font-mono bg-[#393B40] text-[#DFE1E5] px-1.5 py-0.5 rounded-full">
                      {group.items.length} {group.items.length === 1 ? 'problem' : 'problems'}
                    </span>
                  </div>

                  {/* Problem rows */}
                  {isExpanded && (
                    <div className="divide-y divide-[#26282B]/60">
                      {group.items.map(item => {
                        let severityIcon = <Info size={13} className="text-[#3574F0] flex-shrink-0" />;
                        if (item.severity === 'error') {
                          severityIcon = <AlertCircle size={13} className="text-[#E55353] flex-shrink-0" />;
                        } else if (item.severity === 'warning') {
                          severityIcon = <AlertTriangle size={13} className="text-[#F1A23A] flex-shrink-0" />;
                        }

                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectProblem(item, false)}
                            onDoubleClick={() => handleSelectProblem(item, true)}
                            className="group flex items-center justify-between px-4 py-1.5 hover:bg-[#2B2D30] cursor-pointer transition-colors text-[12px]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {severityIcon}
                              <span className="text-[#868A91] font-mono text-[11px] flex-shrink-0">
                                {item.line}:{item.column}
                              </span>
                              <span className="text-[#DFE1E5] truncate">{item.message}</span>
                              {item.code && (
                                <span className="text-[10px] text-[#868A91] font-mono bg-[#2B2D30] border border-[#393B40] px-1 rounded flex-shrink-0">
                                  {item.source ? `${item.source}(${item.code})` : item.code}
                                </span>
                              )}
                            </div>

                            {/* Quick Fix Button (Alt+Enter) */}
                            {onQuickFix && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onQuickFix(item);
                                }}
                                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] text-[#EDA200] hover:bg-[#EDA200]/10 px-2 py-0.5 rounded transition-all cursor-pointer flex-shrink-0"
                                title="Show Context Actions (Alt+Enter)"
                              >
                                <Lightbulb size={12} className="text-[#EDA200]" />
                                <span>{item.quickFixTitle || 'Quick Fix'}</span>
                                <span className="text-[9px] text-[#868A91]">Alt+Enter</span>
                              </button>
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
    </div>
  );
};
