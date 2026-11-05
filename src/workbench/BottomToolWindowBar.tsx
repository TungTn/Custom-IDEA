import React from 'react';
import { 
  Play, 
  Terminal, 
  AlertCircle, 
  Search, 
  GitBranch, 
  ChevronUp, 
  ChevronDown,
  Hammer,
  Bug,
  CheckCircle2
} from 'lucide-react';

interface BottomToolWindowBarProps {
  bottomTab: 'run' | 'debug' | 'terminal' | 'problems' | 'find' | 'git' | 'tests';
  isBottomOpen: boolean;
  isRunning: boolean;
  isDebugActive?: boolean;
  isPaused?: boolean;
  hasFindResult?: boolean;
  findSymbol?: string;
  errorCount?: number;
  warningCount?: number;
  testStats?: { total: number; passed: number; failed: number };
  onSelectTab: (tabId: 'run' | 'debug' | 'terminal' | 'problems' | 'find' | 'git' | 'tests') => void;
  onToggleOpen: (open: boolean) => void;
}

/**
 * Authentic IntelliJ IDEA New UI - Bottom Tool Window Dock Bar
 * Always displayed above the Status Bar to provide instant access
 * to 4: Run, 5: Debug (Alt+5), Git (Alt+9), Terminal (Alt+F12), 6: Problems (Alt+6), and 4: Find.
 */
export const BottomToolWindowBar: React.FC<BottomToolWindowBarProps> = ({
  bottomTab,
  isBottomOpen,
  isRunning,
  isDebugActive = false,
  isPaused = false,
  hasFindResult,
  findSymbol,
  errorCount = 0,
  warningCount = 0,
  testStats,
  onSelectTab,
  onToggleOpen,
}) => {
  const problemsTotal = errorCount + warningCount;
  const problemsIcon = errorCount > 0 ? (
    <AlertCircle size={12} className="text-[#E55353]" />
  ) : warningCount > 0 ? (
    <AlertCircle size={12} className="text-[#F1A23A]" />
  ) : (
    <AlertCircle size={12} className="text-[#59A869]" />
  );

  const tabs = [
    {
      id: 'run' as const,
      label: '4: Run',
      icon: (
        <Play 
          size={12} 
          className={isRunning ? 'text-[#3574F0] fill-[#3574F0] animate-pulse' : 'text-[#59A869] fill-[#59A869]'} 
        />
      ),
      shortcut: 'Alt+4',
    },
    {
      id: 'debug' as const,
      label: '5: Debug',
      icon: (
        <Bug 
          size={12} 
          className={isPaused ? 'text-[#E55353] fill-[#E55353]/30 animate-pulse' : isDebugActive ? 'text-[#3574F0]' : 'text-[#868A91]'} 
        />
      ),
      shortcut: 'Alt+5',
    },
    {
      id: 'git' as const,
      label: 'Git',
      icon: <GitBranch size={12} className="text-[#3574F0]" />,
      shortcut: 'Alt+9',
    },
    {
      id: 'terminal' as const,
      label: 'Terminal',
      icon: <Terminal size={12} className="text-[#3574F0]" />,
      shortcut: 'Alt+F12',
    },
    {
      id: 'problems' as const,
      label: problemsTotal > 0 ? `6: Problems (${problemsTotal})` : '6: Problems',
      icon: problemsIcon,
      shortcut: 'Alt+6',
    },
    {
      id: 'tests' as const,
      label: testStats 
        ? (testStats.failed > 0 ? `Tests (${testStats.passed}/${testStats.total})` : `Tests (${testStats.passed})`) 
        : 'Tests',
      icon: testStats && testStats.failed > 0 ? (
        <CheckCircle2 size={12} className="text-[#E05555]" />
      ) : (
        <CheckCircle2 size={12} className="text-[#59A869]" />
      ),
      shortcut: 'Alt+8',
    },
  ];

  const handleTabClick = (tabId: 'run' | 'debug' | 'terminal' | 'problems' | 'find' | 'git' | 'tests') => {
    if (isBottomOpen && bottomTab === tabId) {
      // Toggle off / minimize if already active
      onToggleOpen(false);
    } else {
      onSelectTab(tabId);
      onToggleOpen(true);
    }
  };

  return (
    <div className="h-6 bg-[#1E1F22] border-t border-[#2B2D30] px-2 flex items-center justify-between text-[11px] select-none z-10 flex-shrink-0">
      {/* Left Dock Tool Window Buttons (4: Run, Terminal, Problems, Find) */}
      <div className="flex items-center gap-0.5 h-full">
        {tabs.map((tab) => {
          const isActive = isBottomOpen && bottomTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              title={`${tab.label} (${tab.shortcut})`}
              className={`h-full px-2.5 flex items-center gap-1.5 transition-colors relative cursor-pointer font-sans text-[11px] ${
                isActive
                  ? 'bg-[#2B2D30] text-[#DFE1E5] font-semibold'
                  : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
              }`}
            >
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#3574F0]" />
              )}
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}

        {/* 4: Find Tab (appears when Find Usages or Search has results) */}
        {hasFindResult && (
          <button
            onClick={() => handleTabClick('find')}
            title="Find Usages (Alt+F7)"
            className={`h-full px-2.5 flex items-center gap-1.5 transition-colors relative cursor-pointer font-sans text-[11px] ${
              isBottomOpen && bottomTab === 'find'
                ? 'bg-[#2B2D30] text-[#DFE1E5] font-semibold'
                : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
            }`}
          >
            {isBottomOpen && bottomTab === 'find' && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#3574F0]" />
            )}
            <Search size={12} className="text-[#3574F0]" />
            <span>4: Find {findSymbol ? `("${findSymbol}")` : ''}</span>
          </button>
        )}
      </div>

      {/* Right Tool Window Toggle controls */}
      <div className="flex items-center gap-1 text-[#868A91]">
        <button
          onClick={() => onToggleOpen(!isBottomOpen)}
          title={isBottomOpen ? 'Hide Tool Window (Shift+Esc)' : 'Open Tool Window'}
          className="p-1 hover:text-[#DFE1E5] hover:bg-[#2B2D30] rounded transition-colors cursor-pointer"
        >
          {isBottomOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
      </div>
    </div>
  );
};
