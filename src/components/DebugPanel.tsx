import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCw, 
  CornerDownRight, 
  ArrowDownRight, 
  ArrowUpRight, 
  MapPin, 
  Calculator, 
  Eye, 
  VolumeX, 
  Volume2, 
  Trash2, 
  Plus, 
  X, 
  ChevronRight, 
  ChevronDown, 
  Terminal as TerminalIcon, 
  Layers, 
  ListTree, 
  Search
} from 'lucide-react';
import { StackFrame, VariableItem, WatchItem, DebugState } from '../types';

interface DebugPanelProps {
  debugState: DebugState;
  frames: StackFrame[];
  activeFrameId: string | null;
  variables: VariableItem[];
  watches: WatchItem[];
  areBreakpointsMuted: boolean;
  consoleOutput: string[];
  onRerun: () => void;
  onResume: () => void;
  onPause: () => void;
  onStop: () => void;
  onStepOver: () => void;
  onStepInto: () => void;
  onStepOut: () => void;
  onRunToCursor: () => void;
  onEvaluateExpression: () => void;
  onViewBreakpoints: () => void;
  onToggleMuteBreakpoints: () => void;
  onSelectFrame: (frame: StackFrame) => void;
  onAddWatch: (expr: string) => void;
  onRemoveWatch: (id: string) => void;
  onClearConsole: () => void;
  onConsoleInput?: (input: string) => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  debugState,
  frames,
  activeFrameId,
  variables,
  watches,
  areBreakpointsMuted,
  consoleOutput,
  onRerun,
  onResume,
  onPause,
  onStop,
  onStepOver,
  onStepInto,
  onStepOut,
  onRunToCursor,
  onEvaluateExpression,
  onViewBreakpoints,
  onToggleMuteBreakpoints,
  onSelectFrame,
  onAddWatch,
  onRemoveWatch,
  onClearConsole,
  onConsoleInput,
}) => {
  const [activeTab, setActiveTab] = useState<'debugger' | 'console'>('debugger');
  const [variableFilter, setVariableFilter] = useState('');
  const [expandedVarNames, setExpandedVarNames] = useState<Set<string>>(new Set(['this', 'locals', 'arguments']));
  const [newWatchText, setNewWatchText] = useState('');
  const [isAddingWatch, setIsAddingWatch] = useState(false);
  const [consoleInputText, setConsoleInputText] = useState('');

  const isPaused = debugState === 'paused';
  const isRunning = debugState === 'running';
  const isActive = isPaused || isRunning;

  const toggleVarExpanded = (varName: string) => {
    setExpandedVarNames(prev => {
      const next = new Set(prev);
      if (next.has(varName)) {
        next.delete(varName);
      } else {
        next.add(varName);
      }
      return next;
    });
  };

  const filteredVariables = variables.filter(v => 
    !variableFilter || v.name.toLowerCase().includes(variableFilter.toLowerCase()) || v.value.toLowerCase().includes(variableFilter.toLowerCase())
  );

  const renderVariableTree = (item: VariableItem, path = '') => {
    const fullPath = path ? `${path}.${item.name}` : item.name;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedVarNames.has(fullPath) || expandedVarNames.has(item.name);

    return (
      <div key={fullPath} className="flex flex-col select-none">
        <div 
          onClick={() => hasChildren && toggleVarExpanded(fullPath)}
          className="flex items-center gap-1.5 py-0.5 px-2 hover:bg-[#2E436E]/40 rounded cursor-pointer text-[12px] group transition-colors"
        >
          {hasChildren ? (
            <span className="text-[#868A91] group-hover:text-white p-0.5">
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          ) : (
            <span className="w-3" />
          )}

          {/* Variable Name */}
          <span className="text-[#DFE1E5] font-mono font-medium">{item.name}</span>
          <span className="text-[#868A91]">=</span>

          {/* Variable Value (Color-coded) */}
          <span className={`font-mono truncate ${
            item.type === 'number' 
              ? 'text-[#2AACB8]' 
              : item.type === 'string' 
                ? 'text-[#6AAB73]' 
                : item.type === 'boolean' 
                  ? 'text-[#CF8E6D]' 
                  : item.type === 'object' || item.type === 'array'
                    ? 'text-[#BCBEC4]'
                    : 'text-[#DFE1E5]'
          }`}>
            {item.value}
          </span>

          {/* Type Badge */}
          {item.type && (
            <span className="text-[10px] text-[#6C707E] font-mono ml-auto opacity-70 group-hover:opacity-100">
              {item.type}
            </span>
          )}
        </div>

        {/* Children Properties */}
        {hasChildren && isExpanded && (
          <div className="pl-4 border-l border-[#393B40]/50 ml-3.5 my-0.5 flex flex-col gap-0.5">
            {item.children!.map(child => renderVariableTree(child, fullPath))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5] text-xs font-sans select-none overflow-hidden">
      {/* ─── 1. Main Debug Toolbar ─── */}
      <div className="h-8 bg-[#222427] border-b border-[#2B2D30] px-2 flex items-center justify-between flex-shrink-0">
        {/* Left: Tab Switcher (Debugger / Console) */}
        <div className="flex items-center h-full">
          <button
            onClick={() => setActiveTab('debugger')}
            className={`h-full px-3 flex items-center gap-1.5 transition-colors relative cursor-pointer ${
              activeTab === 'debugger' 
                ? 'text-white font-medium bg-[#1E1F22]' 
                : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
            }`}
          >
            {activeTab === 'debugger' && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#3574F0]" />
            )}
            <ListTree size={13} className="text-[#3574F0]" />
            <span>Debugger</span>
            {isPaused && (
              <span className="w-2 h-2 rounded-full bg-[#E55353] animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('console')}
            className={`h-full px-3 flex items-center gap-1.5 transition-colors relative cursor-pointer ${
              activeTab === 'console' 
                ? 'text-white font-medium bg-[#1E1F22]' 
                : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
            }`}
          >
            {activeTab === 'console' && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#3574F0]" />
            )}
            <TerminalIcon size={13} className="text-[#59A869]" />
            <span>Console</span>
          </button>
        </div>

        {/* Center/Right: Stepping Controls (Step Over, Step Into, Step Out, Run to Cursor, Evaluate) */}
        <div className="flex items-center gap-0.5">
          {/* Step Over (F8) */}
          <button
            onClick={onStepOver}
            disabled={!isPaused}
            title="Step Over (F8)"
            className={`p-1.5 rounded transition-colors flex items-center gap-1 ${
              isPaused 
                ? 'text-[#DFE1E5] hover:bg-[#2B2D30] hover:text-white cursor-pointer' 
                : 'text-[#5A5D63] cursor-not-allowed opacity-50'
            }`}
          >
            <CornerDownRight size={14} className="text-[#3574F0]" />
            <span className="text-[11px] font-mono hidden md:inline">Step Over</span>
          </button>

          {/* Step Into (F7) */}
          <button
            onClick={onStepInto}
            disabled={!isPaused}
            title="Step Into (F7)"
            className={`p-1.5 rounded transition-colors flex items-center gap-1 ${
              isPaused 
                ? 'text-[#DFE1E5] hover:bg-[#2B2D30] hover:text-white cursor-pointer' 
                : 'text-[#5A5D63] cursor-not-allowed opacity-50'
            }`}
          >
            <ArrowDownRight size={14} className="text-[#3574F0]" />
            <span className="text-[11px] font-mono hidden md:inline">Step Into</span>
          </button>

          {/* Step Out (Shift+F8) */}
          <button
            onClick={onStepOut}
            disabled={!isPaused}
            title="Step Out (Shift+F8)"
            className={`p-1.5 rounded transition-colors flex items-center gap-1 ${
              isPaused 
                ? 'text-[#DFE1E5] hover:bg-[#2B2D30] hover:text-white cursor-pointer' 
                : 'text-[#5A5D63] cursor-not-allowed opacity-50'
            }`}
          >
            <ArrowUpRight size={14} className="text-[#3574F0]" />
            <span className="text-[11px] font-mono hidden md:inline">Step Out</span>
          </button>

          {/* Run to Cursor (Alt+F9) */}
          <button
            onClick={onRunToCursor}
            disabled={!isPaused}
            title="Run to Cursor (Alt+F9)"
            className={`p-1.5 rounded transition-colors ${
              isPaused 
                ? 'text-[#DFE1E5] hover:bg-[#2B2D30] hover:text-white cursor-pointer' 
                : 'text-[#5A5D63] cursor-not-allowed opacity-50'
            }`}
          >
            <MapPin size={14} className="text-[#E08D3C]" />
          </button>

          <div className="h-4 w-[1px] bg-[#393B40] mx-1" />

          {/* Evaluate Expression (Alt+F8) */}
          <button
            onClick={onEvaluateExpression}
            disabled={!isPaused}
            title="Evaluate Expression... (Alt+F8)"
            className={`p-1.5 rounded transition-colors flex items-center gap-1 ${
              isPaused 
                ? 'text-[#DFE1E5] hover:bg-[#2B2D30] hover:text-white cursor-pointer' 
                : 'text-[#5A5D63] cursor-not-allowed opacity-50'
            }`}
          >
            <Calculator size={14} className="text-[#9876AA]" />
            <span className="text-[11px] font-mono hidden sm:inline">Evaluate...</span>
          </button>

          <div className="h-4 w-[1px] bg-[#393B40] mx-1" />

          {/* View Breakpoints (Ctrl+Shift+F8) */}
          <button
            onClick={onViewBreakpoints}
            title="View Breakpoints... (Ctrl+Shift+F8)"
            className="p-1.5 rounded hover:bg-[#2B2D30] text-[#DFE1E5] hover:text-white transition-colors cursor-pointer"
          >
            <Eye size={14} />
          </button>

          {/* Mute Breakpoints Toggle */}
          <button
            onClick={onToggleMuteBreakpoints}
            title={areBreakpointsMuted ? "Unmute Breakpoints" : "Mute Breakpoints"}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              areBreakpointsMuted ? 'bg-[#E55353]/20 text-[#E55353]' : 'hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5]'
            }`}
          >
            {areBreakpointsMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>
      </div>

      {/* ─── 2. Body Area (Dual Layout: Left Toolstrip + Content) ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side Toolstrip: Rerun, Resume, Pause, Stop */}
        <div className="w-9 bg-[#1E1F22] border-r border-[#2B2D30] flex flex-col items-center py-2 gap-1.5 flex-shrink-0">
          {/* Rerun (Shift+F9) */}
          <button
            onClick={onRerun}
            title="Rerun 'Debug' (Shift+F9)"
            className="p-1.5 rounded hover:bg-[#2B2D30] text-[#59A869] hover:text-[#76C286] transition-colors cursor-pointer"
          >
            <RotateCw size={14} />
          </button>

          {/* Resume Program (F9) */}
          <button
            onClick={onResume}
            disabled={!isPaused}
            title="Resume Program (F9)"
            className={`p-1.5 rounded transition-colors ${
              isPaused 
                ? 'text-[#59A869] hover:bg-[#2B2D30] hover:text-[#76C286] cursor-pointer' 
                : 'text-[#5A5D63] cursor-not-allowed opacity-40'
            }`}
          >
            <Play size={14} className={isPaused ? "fill-[#59A869]" : ""} />
          </button>

          {/* Pause Program */}
          <button
            onClick={onPause}
            disabled={!isRunning}
            title="Pause Program"
            className={`p-1.5 rounded transition-colors ${
              isRunning 
                ? 'text-[#E08D3C] hover:bg-[#2B2D30] cursor-pointer' 
                : 'text-[#5A5D63] cursor-not-allowed opacity-40'
            }`}
          >
            <Pause size={14} />
          </button>

          {/* Stop Process (Ctrl+F2) */}
          <button
            onClick={onStop}
            disabled={!isActive}
            title="Stop Process (Ctrl+F2)"
            className={`p-1.5 rounded transition-colors ${
              isActive 
                ? 'text-[#E05555] hover:bg-[#2B2D30] cursor-pointer' 
                : 'text-[#5A5D63] cursor-not-allowed opacity-40'
            }`}
          >
            <Square size={13} className={isActive ? "fill-[#E05555]" : ""} />
          </button>

          <div className="w-5 h-[1px] bg-[#323438] my-1" />

          {/* Clear Console */}
          <button
            onClick={onClearConsole}
            title="Clear Console"
            className="p-1.5 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Content Pane */}
        {activeTab === 'debugger' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* ─── Column A: Frames (Call Stack) ─── */}
            <div className="w-72 bg-[#1E1F22] border-r border-[#2B2D30] flex flex-col flex-shrink-0">
              {/* Header */}
              <div className="h-7 bg-[#26282B] border-b border-[#2B2D30] px-2.5 flex items-center justify-between text-[11px] text-[#868A91] font-semibold">
                <div className="flex items-center gap-1.5">
                  <Layers size={12} className="text-[#3574F0]" />
                  <span>Frames (Threads & Stack)</span>
                </div>
                {isPaused && (
                  <span className="text-[10px] text-[#E08D3C] bg-[#332520] px-1.5 py-0.2 rounded border border-[#5E3A2F]">
                    Suspended
                  </span>
                )}
              </div>

              {/* Stack Trace List */}
              <div className="flex-1 overflow-y-auto p-1 flex flex-col gap-0.5">
                {frames.length > 0 ? (
                  frames.map((frame) => {
                    const isSelected = frame.id === activeFrameId;
                    return (
                      <div
                        key={frame.id}
                        onClick={() => onSelectFrame(frame)}
                        className={`flex flex-col px-2.5 py-1.5 rounded cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-[#2E436E] text-white' 
                            : 'hover:bg-[#2B2D30] text-[#DFE1E5]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium text-[12px] truncate">{frame.name}</span>
                          <span className="text-[10px] text-[#868A91] font-mono">:{frame.line}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#868A91] truncate font-mono">
                          <span>{frame.file}</span>
                          <span>(line {frame.line})</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-[#6C707E] italic text-xs">
                    {debugState === 'running' ? 'Program running...' : 'No suspended frames. Hit a breakpoint to inspect.'}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Column B: Variables & Watches ─── */}
            <div className="flex-1 flex flex-col bg-[#1E1F22] overflow-hidden">
              {/* Header with Search and Add Watch */}
              <div className="h-7 bg-[#26282B] border-b border-[#2B2D30] px-2.5 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 font-semibold text-[#868A91]">
                  <ListTree size={12} className="text-[#59A869]" />
                  <span>Variables</span>
                </div>

                {/* Filter Variables Input */}
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center">
                    <Search size={11} className="absolute left-2 text-[#868A91]" />
                    <input
                      type="text"
                      value={variableFilter}
                      onChange={(e) => setVariableFilter(e.target.value)}
                      placeholder="Filter variables..."
                      className="bg-[#1E1F22] border border-[#393B40] rounded pl-6 pr-2 py-0.5 text-[11px] text-[#DFE1E5] w-36 focus:border-[#3574F0] outline-none"
                    />
                  </div>

                  <button
                    onClick={() => setIsAddingWatch(true)}
                    title="Add New Watch Expression"
                    className="p-1 rounded hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={12} className="text-[#3574F0]" />
                    <span className="text-[10px]">New Watch</span>
                  </button>
                </div>
              </div>

              {/* Variables & Watches Scroll View */}
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                {/* ── Watches Section ── */}
                <div className="border border-[#2B2D30] rounded-md bg-[#222427]/50 p-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#868A91]">
                    <span>Watches</span>
                    <button 
                      onClick={() => setIsAddingWatch(prev => !prev)}
                      className="text-[#3574F0] hover:underline cursor-pointer text-[10px]"
                    >
                      {isAddingWatch ? 'Cancel' : '+ Add'}
                    </button>
                  </div>

                  {/* Add Watch Input Bar */}
                  {isAddingWatch && (
                    <div className="flex items-center gap-1.5 my-1">
                      <input
                        type="text"
                        autoFocus
                        value={newWatchText}
                        onChange={(e) => setNewWatchText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newWatchText.trim()) {
                            onAddWatch(newWatchText.trim());
                            setNewWatchText('');
                            setIsAddingWatch(false);
                          } else if (e.key === 'Escape') {
                            setIsAddingWatch(false);
                          }
                        }}
                        placeholder="Expression to watch (e.g. items.length)..."
                        className="flex-1 bg-[#1E1F22] border border-[#3574F0] rounded px-2 py-1 text-xs text-[#DFE1E5] font-mono outline-none"
                      />
                      <button
                        onClick={() => {
                          if (newWatchText.trim()) {
                            onAddWatch(newWatchText.trim());
                            setNewWatchText('');
                            setIsAddingWatch(false);
                          }
                        }}
                        className="px-2 py-1 bg-[#3574F0] hover:bg-[#3574F0]/85 text-white rounded text-xs cursor-pointer font-medium"
                      >
                        Add
                      </button>
                    </div>
                  )}

                  {/* Watches List */}
                  {watches.length > 0 ? (
                    watches.map(w => (
                      <div key={w.id} className="flex items-center justify-between py-0.5 px-1.5 hover:bg-[#2B2D30] rounded font-mono text-[11px] group">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[#DFE1E5] font-semibold">{w.expression}:</span>
                          <span className="text-[#6AAB73] truncate">{w.value || '(evaluating...)'}</span>
                        </div>
                        <button
                          onClick={() => onRemoveWatch(w.id)}
                          className="opacity-0 group-hover:opacity-100 text-[#868A91] hover:text-[#E05555] p-0.5 transition-opacity cursor-pointer"
                          title="Remove Watch"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))
                  ) : (
                    !isAddingWatch && (
                      <span className="text-[10px] text-[#6C707E] italic">No active watch expressions</span>
                    )
                  )}
                </div>

                {/* ── Variables Tree ── */}
                <div className="flex flex-col gap-0.5">
                  <div className="text-[11px] font-semibold text-[#868A91] mb-1">
                    Locals & Scope
                  </div>
                  {filteredVariables.length > 0 ? (
                    filteredVariables.map(v => renderVariableTree(v))
                  ) : (
                    <div className="p-3 text-center text-[#6C707E] italic text-xs">
                      {isPaused ? 'No variables match filter' : 'Suspend at breakpoint to view local variables'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ─── Console Tab ─── */
          <div className="flex-1 flex flex-col bg-[#1A1B1D] font-mono text-xs overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1 text-[#DFE1E5]">
              {consoleOutput.length > 0 ? (
                consoleOutput.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                    {line}
                  </div>
                ))
              ) : (
                <div className="text-[#6C707E] italic">
                  Debugger attached to localhost:9229. Console output will appear here.
                </div>
              )}
            </div>

            {/* Interactive Console REPL Input */}
            <div className="h-8 border-t border-[#2B2D30] bg-[#1E1F22] px-2 flex items-center gap-2 flex-shrink-0">
              <span className="text-[#3574F0] font-bold">&gt;</span>
              <input
                type="text"
                value={consoleInputText}
                onChange={(e) => setConsoleInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && consoleInputText.trim()) {
                    onConsoleInput?.(consoleInputText.trim());
                    setConsoleInputText('');
                  }
                }}
                placeholder="Type expression or command to evaluate in suspended context..."
                className="flex-1 bg-transparent text-[#DFE1E5] text-xs font-mono outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
