import React from 'react';
import { 
  Play, 
  Terminal, 
  AlertCircle, 
  Search, 
  GitBranch, 
  ChevronUp, 
  ChevronDown,
  Hammer
} from 'lucide-react';

interface BottomToolWindowBarProps {
  bottomTab: 'run' | 'terminal' | 'problems' | 'find';
  isBottomOpen: boolean;
  isRunning: boolean;
  hasFindResult?: boolean;
  findSymbol?: string;
  onSelectTab: (tabId: 'run' | 'terminal' | 'problems' | 'find') => void;
  onToggleOpen: (open: boolean) => void;
}

/**
 * Authentic IntelliJ IDEA New UI - Bottom Tool Window Dock Bar
 * Always displayed above the Status Bar to provide instant access
 * to 4: Run, Terminal (Alt+F12), Problems (Alt+6), Git, and 4: Find.
 */
export const BottomToolWindowBar: React.FC<BottomToolWindowBarProps> = ({
  bottomTab,
  isBottomOpen,
  isRunning,
  hasFindResult,
  findSymbol,
  onSelectTab,
  onToggleOpen,
}) => {
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
      id: 'terminal' as const,
      label: 'Terminal',
      icon: <Terminal size={12} className="text-[#3574F0]" />,
      shortcut: 'Alt+F12',
    },
    {
      id: 'problems' as const,
      label: 'Problems',
      icon: <AlertCircle size={12} className="text-[#59A869]" />,
      shortcut: 'Alt+6',
    },
  ];

  const handleTabClick = (tabId: 'run' | 'terminal' | 'problems' | 'find') => {
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
