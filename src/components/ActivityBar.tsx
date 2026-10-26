import React from 'react';
import { 
  FolderTree, 
  GitBranch, 
  Bookmark, 
  Layers,
  Terminal,
  PlaySquare,
  Settings as SettingsIcon,
  HelpCircle
} from 'lucide-react';

export interface ActivityBarProps {
  // Left Tool Window
  activeSideTab: string;
  isSideBarOpen: boolean;
  onToggleSideTab: (tabId: string) => void;

  // Bottom Tool Window
  bottomTab?: 'run' | 'debug' | 'terminal' | 'problems' | 'find' | 'git' | 'tests';
  isBottomOpen?: boolean;
  onToggleBottomTab?: (tabId: 'run' | 'debug' | 'terminal' | 'problems' | 'find' | 'git' | 'tests') => void;

  // Quick Action Callbacks
  onOpenCommit?: () => void;
  onOpenSearch?: () => void;
  onToggleDatabase?: () => void;
  onOpenPlugins?: () => void;
}

/**
 * Authentic IntelliJ IDEA New UI - Left Tool Window Stripe
 * Displays primary tool window toggles (Project, Commit, Bookmarks, Structure)
 * and bottom configuration (Terminal, Run, Settings).
 */
export const ActivityBar: React.FC<ActivityBarProps> = ({ 
  activeSideTab,
  isSideBarOpen,
  onToggleSideTab,
  bottomTab,
  isBottomOpen,
  onToggleBottomTab,
  onOpenCommit,
  onOpenPlugins,
}) => {
  const stripeItems = [
    { 
      id: 'project', 
      label: 'Project', 
      badge: '1',
      icon: FolderTree, 
      shortcut: 'Alt+1',
      isActive: isSideBarOpen && activeSideTab === 'project',
      onClick: () => onToggleSideTab('project'),
    },
    { 
      id: 'commit', 
      label: 'Commit', 
      badge: '0',
      icon: GitBranch, 
      shortcut: 'Alt+0',
      isActive: isSideBarOpen && activeSideTab === 'commit',
      onClick: () => onOpenCommit ? onOpenCommit() : onToggleSideTab('commit'),
    },
    { 
      id: 'bookmarks', 
      label: 'Bookmarks', 
      badge: '2',
      icon: Bookmark, 
      shortcut: 'Alt+2',
      isActive: isSideBarOpen && activeSideTab === 'bookmarks',
      onClick: () => onToggleSideTab('bookmarks'),
    },
    { 
      id: 'structure', 
      label: 'Structure', 
      badge: '7',
      icon: Layers, 
      shortcut: 'Alt+7',
      isActive: isSideBarOpen && activeSideTab === 'structure',
      onClick: () => onToggleSideTab('structure'),
    },
  ];

  return (
    <div className="w-10 bg-[#1E1F22] border-r border-[#2B2D30] flex flex-col justify-between py-2 select-none z-10 flex-shrink-0">
      {/* Top Left Tool Window Buttons (Project 1, Commit 0, Bookmarks 2, Structure 7) */}
      <div className="flex flex-col items-center gap-1">
        {stripeItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              title={`${item.label} (${item.shortcut})`}
              className={`w-8 h-8 rounded flex items-center justify-center transition-all relative group cursor-pointer ${
                item.isActive 
                  ? 'bg-[#2B2D30] text-[#DFE1E5]' 
                  : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
              }`}
            >
              <Icon size={16} />
              
              {/* Authentic IntelliJ active indicator stripe */}
              {item.isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[#3574F0] rounded-r" />
              )}

              {/* Number Badge tooltip hint */}
              <span className="absolute -bottom-0.5 right-0.5 text-[8px] font-bold text-[#868A91] group-hover:text-white pointer-events-none opacity-80">
                {item.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom Stripe Buttons (Terminal, Run, Settings) */}
      <div className="flex flex-col items-center gap-1">
        {onToggleBottomTab && (
          <>
            <button
              onClick={() => onToggleBottomTab('terminal')}
              title="Terminal (Alt+F12)"
              className={`w-8 h-8 rounded flex items-center justify-center transition-colors relative cursor-pointer ${
                isBottomOpen && bottomTab === 'terminal'
                  ? 'bg-[#2B2D30] text-[#3574F0]'
                  : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
              }`}
            >
              <Terminal size={15} />
              {isBottomOpen && bottomTab === 'terminal' && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[#3574F0] rounded-r" />
              )}
            </button>
            <button
              onClick={() => onToggleBottomTab('run')}
              title="Run (Alt+4)"
              className={`w-8 h-8 rounded flex items-center justify-center transition-colors relative cursor-pointer ${
                isBottomOpen && bottomTab === 'run'
                  ? 'bg-[#2B2D30] text-[#59A869]'
                  : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
              }`}
            >
              <PlaySquare size={15} />
              {isBottomOpen && bottomTab === 'run' && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[#3574F0] rounded-r" />
              )}
            </button>
          </>
        )}
        <button
          onClick={() => onOpenPlugins?.()}
          title="Settings (Ctrl+Alt+S)"
          className="w-8 h-8 rounded flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60 transition-colors cursor-pointer"
        >
          <SettingsIcon size={16} />
        </button>
      </div>
    </div>
  );
};

