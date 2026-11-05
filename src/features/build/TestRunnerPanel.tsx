import React, { useState, useMemo } from 'react';
import { 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  Clock, 
  Search, 
  Filter, 
  ChevronRight, 
  ChevronDown, 
  ExternalLink, 
  Copy, 
  SlidersHorizontal, 
  Check, 
  Terminal, 
  Flame, 
  ArrowUpDown,
  FileCode,
  Layers
} from 'lucide-react';
import { TestRunSession, TestCaseItem, TestSuiteItem, TestCaseStatus } from '../../types/test';

interface TestRunnerPanelProps {
  session: TestRunSession;
  onRerunAll: () => void;
  onRerunFailed: () => void;
  onNavigateToCode?: (filePath: string, lineNumber: number) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const TestRunnerPanel: React.FC<TestRunnerPanelProps> = ({
  session,
  onRerunAll,
  onRerunFailed,
  onNavigateToCode,
  onShowToast,
}) => {
  const [selectedTestId, setSelectedTestId] = useState<string | null>(() => {
    // Default select first failed test, or first test
    const firstFailed = session.suites.flatMap(s => s.tests).find(t => t.status === 'failed');
    if (firstFailed) return firstFailed.id;
    return session.suites[0]?.tests[0]?.id || null;
  });

  const [expandedSuites, setExpandedSuites] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    session.suites.forEach(s => { init[s.id] = true; });
    return init;
  });

  const [filterQuery, setFilterQuery] = useState('');
  const [showPassed, setShowPassed] = useState(true);
  const [showFailed, setShowFailed] = useState(true);
  const [showIgnored, setShowIgnored] = useState(true);
  const [sortByDuration, setSortByDuration] = useState(false);
  const [viewMode, setViewMode] = useState<'structured' | 'console'>('structured');

  const toggleSuite = (suiteId: string) => {
    setExpandedSuites(prev => ({ ...prev, [suiteId]: !prev[suiteId] }));
  };

  // Find currently selected test
  const selectedTest = useMemo<TestCaseItem | null>(() => {
    for (const s of session.suites) {
      const found = s.tests.find(t => t.id === selectedTestId);
      if (found) return found;
    }
    return null;
  }, [session, selectedTestId]);

  // Filtered suites & tests
  const filteredSuites = useMemo(() => {
    return session.suites
      .map(suite => {
        let tests = suite.tests.filter(t => {
          if (t.status === 'passed' && !showPassed) return false;
          if (t.status === 'failed' && !showFailed) return false;
          if (t.status === 'ignored' && !showIgnored) return false;
          if (filterQuery && !t.name.toLowerCase().includes(filterQuery.toLowerCase())) return false;
          return true;
        });

        if (sortByDuration) {
          tests = [...tests].sort((a, b) => b.durationMs - a.durationMs);
        }

        return { ...suite, tests };
      })
      .filter(s => s.tests.length > 0);
  }, [session.suites, showPassed, showFailed, showIgnored, filterQuery, sortByDuration]);

  const hasFailed = session.failedTests > 0;
  const passPercentage = session.totalTests > 0 
    ? Math.round((session.passedTests / session.totalTests) * 100) 
    : 0;

  const renderStatusIcon = (status: TestCaseStatus, size = 14) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 size={size} className="text-[#59A869]" />;
      case 'failed':
        return <XCircle size={size} className="text-[#E05555]" />;
      case 'ignored':
        return <MinusCircle size={size} className="text-[#868A91]" />;
      case 'running':
        return <Clock size={size} className="text-[#3574F0] animate-spin" />;
      default:
        return <Clock size={size} className="text-[#868A91]" />;
    }
  };

  const handleCopyStackTrace = (text: string) => {
    navigator.clipboard.writeText(text);
    onShowToast?.('Copied to Clipboard', 'Test stack trace copied', 'info');
  };

  return (
    <div className="flex flex-col h-full bg-[#1E1F22] text-[#DFE1E5] select-none text-xs">
      {/* ─── Top Control Toolbar ─── */}
      <div className="h-9 bg-[#26282B] border-b border-[#393B40] px-3 flex items-center justify-between flex-shrink-0 gap-3">
        {/* Left: Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onRerunAll}
            className="p-1 px-2 hover:bg-[#35373B] text-white rounded flex items-center gap-1 text-[11px] font-medium transition-colors"
            title="Rerun All Tests (Shift+F10)"
          >
            <Play size={12} className="text-[#59A869] fill-[#59A869]" />
            <span>Rerun All</span>
          </button>

          <button
            onClick={onRerunFailed}
            disabled={session.failedTests === 0}
            className={`p-1 px-2 rounded flex items-center gap-1 text-[11px] font-medium transition-colors ${
              session.failedTests > 0
                ? 'hover:bg-[#35373B] text-white'
                : 'opacity-40 cursor-not-allowed text-[#868A91]'
            }`}
            title="Rerun Failed Tests Only"
          >
            <RotateCcw size={12} className="text-[#E05555]" />
            <span>Rerun Failed ({session.failedTests})</span>
          </button>

          <div className="h-4 w-[1px] bg-[#393B40] mx-1" />

          {/* Filter Status Toggles */}
          <button
            onClick={() => setShowPassed(!showPassed)}
            className={`p-1 px-2 rounded flex items-center gap-1 text-[11px] transition-colors ${
              showPassed ? 'bg-[#59A869]/20 text-[#59A869]' : 'text-[#868A91] hover:text-white'
            }`}
            title="Toggle Passed Tests"
          >
            <CheckCircle2 size={12} />
            <span>{session.passedTests}</span>
          </button>

          <button
            onClick={() => setShowFailed(!showFailed)}
            className={`p-1 px-2 rounded flex items-center gap-1 text-[11px] transition-colors ${
              showFailed ? 'bg-[#E05555]/20 text-[#E05555]' : 'text-[#868A91] hover:text-white'
            }`}
            title="Toggle Failed Tests"
          >
            <XCircle size={12} />
            <span>{session.failedTests}</span>
          </button>

          <button
            onClick={() => setShowIgnored(!showIgnored)}
            className={`p-1 px-2 rounded flex items-center gap-1 text-[11px] transition-colors ${
              showIgnored ? 'bg-[#35373B] text-white' : 'text-[#868A91] hover:text-white'
            }`}
            title="Toggle Ignored Tests"
          >
            <MinusCircle size={12} />
            <span>{session.ignoredTests}</span>
          </button>

          <button
            onClick={() => setSortByDuration(!sortByDuration)}
            className={`p-1 px-2 rounded flex items-center gap-1 text-[11px] transition-colors ${
              sortByDuration ? 'bg-[#3574F0]/20 text-[#3574F0]' : 'text-[#868A91] hover:text-white'
            }`}
            title="Sort by Duration"
          >
            <ArrowUpDown size={12} />
            <span>Duration</span>
          </button>
        </div>

        {/* Center: Search Filter */}
        <div className="flex items-center gap-1.5 bg-[#1E1F22] border border-[#393B40] rounded px-2 py-0.5 w-60">
          <Search size={12} className="text-[#868A91]" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search test cases..."
            className="bg-transparent border-0 outline-none text-xs text-[#DFE1E5] placeholder-[#868A91] w-full"
          />
        </div>

        {/* Right: Progress & View Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#868A91] font-mono">
              {session.passedTests}/{session.totalTests} passed ({passPercentage}%) in {session.durationMs}ms
            </span>
            <div className="w-24 h-1.5 bg-[#393B40] rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${hasFailed ? 'bg-[#E05555]' : 'bg-[#59A869]'}`}
                style={{ width: `${passPercentage}%` }}
              />
            </div>
          </div>

          <div className="h-4 w-[1px] bg-[#393B40]" />

          <div className="flex items-center bg-[#1E1F22] border border-[#393B40] rounded p-0.5">
            <button
              onClick={() => setViewMode('structured')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                viewMode === 'structured' ? 'bg-[#3574F0] text-white' : 'text-[#868A91] hover:text-white'
              }`}
            >
              Tree View
            </button>
            <button
              onClick={() => setViewMode('console')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                viewMode === 'console' ? 'bg-[#3574F0] text-white' : 'text-[#868A91] hover:text-white'
              }`}
            >
              Raw Console
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main Viewport ─── */}
      {viewMode === 'console' ? (
        /* Raw Console Output View */
        <div className="flex-1 p-3 font-mono text-[11px] overflow-auto select-text bg-[#1E1F22] leading-relaxed">
          <pre className="whitespace-pre-wrap">{session.rawOutput}</pre>
        </div>
      ) : (
        /* Split Dual-Pane View (Tree on Left, Details on Right) */
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Test Results Tree */}
          <div className="w-[380px] border-r border-[#393B40] bg-[#212226] flex flex-col flex-shrink-0">
            {/* Tree Summary Header */}
            <div className="p-2 border-b border-[#393B40] flex items-center justify-between text-[11px] text-[#868A91] font-mono bg-[#26282B]">
              <div className="flex items-center gap-1.5">
                <Layers size={13} className="text-[#3574F0]" />
                <span className="font-semibold text-white">{session.configName}</span>
              </div>
              <span>{session.totalTests} tests</span>
            </div>

            {/* Tree List */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {filteredSuites.map(suite => {
                const isExpanded = expandedSuites[suite.id] ?? true;
                const suitePassed = suite.tests.every(t => t.status === 'passed');
                const suiteFailed = suite.tests.some(t => t.status === 'failed');

                return (
                  <div key={suite.id} className="space-y-0.5">
                    {/* Suite Header */}
                    <div
                      onClick={() => toggleSuite(suite.id)}
                      className="px-2 py-1 rounded hover:bg-[#2B2D30] cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {isExpanded ? <ChevronDown size={13} className="text-[#868A91]" /> : <ChevronRight size={13} className="text-[#868A91]" />}
                        {renderStatusIcon(suiteFailed ? 'failed' : suitePassed ? 'passed' : 'running', 13)}
                        <span className="font-semibold text-white truncate">{suite.name}</span>
                      </div>
                      <span className="text-[10px] text-[#868A91] font-mono flex-shrink-0">
                        {suite.durationMs}ms
                      </span>
                    </div>

                    {/* Suite Tests */}
                    {isExpanded && (
                      <div className="pl-5 space-y-0.5">
                        {suite.tests.map(test => {
                          const isSelected = selectedTestId === test.id;

                          return (
                            <div
                              key={test.id}
                              onClick={() => setSelectedTestId(test.id)}
                              className={`px-2 py-1 rounded cursor-pointer flex items-center justify-between transition-colors ${
                                isSelected
                                  ? 'bg-[#3574F0]/20 text-white font-medium border-l-2 border-[#3574F0]'
                                  : 'hover:bg-[#2B2D30] text-[#DFE1E5]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 overflow-hidden">
                                {renderStatusIcon(test.status, 12)}
                                <span className="truncate font-mono text-[11px]">{test.name}</span>
                              </div>
                              <span className="text-[10px] text-[#868A91] font-mono flex-shrink-0">
                                {test.durationMs}ms
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredSuites.length === 0 && (
                <div className="p-6 text-center text-[#868A91]">
                  No test cases match the current filter criteria.
                </div>
              )}
            </div>
          </div>

          {/* Right: Selected Test Details, Assertion Diff & Stack Trace */}
          <div className="flex-1 flex flex-col bg-[#1E1F22] overflow-hidden">
            {selectedTest ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Test Detail Header Bar */}
                <div className="p-3 bg-[#26282B] border-b border-[#393B40] flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {renderStatusIcon(selectedTest.status, 16)}
                    <div>
                      <div className="font-semibold text-sm text-white flex items-center gap-2">
                        <span>{selectedTest.name}</span>
                        <span className="text-[10px] bg-[#393B40] text-[#DFE1E5] px-1.5 py-0.2 rounded font-mono">
                          {selectedTest.durationMs} ms
                        </span>
                      </div>
                      <div className="text-[11px] text-[#868A91] font-mono flex items-center gap-2">
                        <span>Suite: {selectedTest.suite}</span>
                        {selectedTest.filePath && (
                          <button
                            onClick={() => onNavigateToCode?.(selectedTest.filePath, selectedTest.lineNumber || 1)}
                            className="text-[#3574F0] hover:underline flex items-center gap-1"
                            title="Jump to source code"
                          >
                            <FileCode size={11} />
                            {selectedTest.filePath}:{selectedTest.lineNumber}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedTest.stackTrace && (
                      <button
                        onClick={() => handleCopyStackTrace(selectedTest.stackTrace || '')}
                        className="px-2 py-1 bg-[#35373B] hover:bg-[#43454A] rounded text-[11px] text-[#DFE1E5] flex items-center gap-1 transition-colors"
                      >
                        <Copy size={11} />
                        Copy Trace
                      </button>
                    )}
                    {selectedTest.filePath && (
                      <button
                        onClick={() => onNavigateToCode?.(selectedTest.filePath, selectedTest.lineNumber || 1)}
                        className="px-2.5 py-1 bg-[#3574F0] hover:bg-[#3574F0]/90 text-white rounded text-[11px] font-medium flex items-center gap-1 shadow-sm transition-colors"
                      >
                        <ExternalLink size={11} />
                        Jump to Code
                      </button>
                    )}
                  </div>
                </div>

                {/* Test Detail Content Body */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 select-text font-mono text-xs">
                  {/* Assertion Diff Comparison (If failed with Expected vs Actual) */}
                  {selectedTest.status === 'failed' && selectedTest.expected && selectedTest.actual && (
                    <div className="border border-[#E05555]/40 rounded-lg overflow-hidden bg-[#26282B]">
                      <div className="h-7 bg-[#E05555]/15 px-3 flex items-center justify-between border-b border-[#E05555]/30 text-[#E05555] font-semibold text-[11px]">
                        <span>Comparison Failure (Assertion Failed)</span>
                        <span className="text-[10px] text-[#868A91]">Left (Actual) vs Right (Expected)</span>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-[#393B40]">
                        <div className="p-3 bg-[#E05555]/5">
                          <div className="text-[10px] uppercase font-bold text-[#E05555] mb-1">Actual (Got)</div>
                          <pre className="text-[#E05555] whitespace-pre-wrap">{selectedTest.actual}</pre>
                        </div>
                        <div className="p-3 bg-[#59A869]/5">
                          <div className="text-[10px] uppercase font-bold text-[#59A869] mb-1">Expected</div>
                          <pre className="text-[#59A869] whitespace-pre-wrap">{selectedTest.expected}</pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Failure Message */}
                  {selectedTest.errorDetails && (
                    <div className="border border-[#E05555]/30 rounded-lg p-3 bg-[#E05555]/5 space-y-1">
                      <div className="text-[11px] font-bold text-[#E05555] uppercase">Failure Reason</div>
                      <div className="text-[#DFE1E5] font-mono leading-relaxed">{selectedTest.errorDetails}</div>
                    </div>
                  )}

                  {/* Stack Trace Box */}
                  {selectedTest.stackTrace && (
                    <div className="border border-[#393B40] rounded-lg overflow-hidden bg-[#1E1F22]">
                      <div className="h-7 bg-[#26282B] px-3 flex items-center justify-between border-b border-[#393B40] text-[11px] text-[#868A91]">
                        <span>Stack Trace</span>
                        <span className="text-[10px]">Clickable frames</span>
                      </div>
                      <div className="p-3 text-[11px] text-[#DFE1E5] leading-relaxed whitespace-pre-wrap">
                        {selectedTest.stackTrace.split('\n').map((line, idx) => {
                          const match = line.match(/([a-zA-Z0-9_\-\\/.]+):(\d+)(?::(\d+))?/);
                          if (match) {
                            const [fullMatch, file, lineNum] = match;
                            const parts = line.split(fullMatch);
                            return (
                              <div key={idx} className="hover:bg-[#2B2D30] rounded px-1 -mx-1">
                                <span>{parts[0]}</span>
                                <span 
                                  onClick={() => onNavigateToCode?.(file, parseInt(lineNum, 10))}
                                  className="text-[#3574F0] underline cursor-pointer hover:text-[#61AFEF] font-semibold"
                                >
                                  {fullMatch}
                                </span>
                                <span>{parts[1]}</span>
                              </div>
                            );
                          }
                          return <div key={idx}>{line}</div>;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Test Standard Output / Logs */}
                  {selectedTest.output && (
                    <div className="border border-[#393B40] rounded-lg overflow-hidden bg-[#1E1F22]">
                      <div className="h-7 bg-[#26282B] px-3 flex items-center gap-1.5 border-b border-[#393B40] text-[11px] text-[#868A91]">
                        <Terminal size={12} />
                        <span>Standard Output & Logs</span>
                      </div>
                      <div className="p-3 text-[11px] text-[#DFE1E5] leading-relaxed whitespace-pre-wrap">
                        {selectedTest.output}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[#868A91]">
                Select a test case from the left tree to inspect execution details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
