import React from 'react';
import { 
  FolderTree, 
  GitBranch, 
  Bookmark, 
  Layers,
  Terminal,
  Play,
  PlaySquare,
  Bug,
  AlertCircle,
  Search,
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
  isRunning?: boolean;
  hasFindResult?: boolean;
  errorCount?: number;
  warningCount?: number;

  // Quick Action Callbacks
  onOpenCommit?: () => void;
  onOpenSearch?: () => void;
  onToggleDatabase?: () => void;
  onOpenPlugins?: () => void;
}

/**
 * Authentic IntelliJ IDEA New UI - Left Tool Window Stripe (Activity Bar)
 * - Top Group: Project (1), Commit (0), Bookmarks (2), Structure (7)
 * - Bottom Group: Git (9), Terminal (F12), Run (4), Debug (5), Problems (6), Find, Settings
 */
export const ActivityBar: React.FC<ActivityBarProps> = ({ 
  activeSideTab,
  isSideBarOpen,
  onToggleSideTab,
  bottomTab,
  isBottomOpen,
  onToggleBottomTab,
  isRunning = false,
  hasFindResult = false,
  errorCount = 0,
  warningCount = 0,
  onOpenCommit,
  onOpenPlugins,
}) => {
  const topStripeItems = [
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

  const bottomToolItems = [
    {
      id: 'git' as const,
      label: 'Git',
      badge: '9',
      shortcut: 'Alt+9',
      icon: GitBranch,
      iconColor: 'text-[#3574F0]',
      isActive: isBottomOpen && bottomTab === 'git',
      onClick: () => onToggleBottomTab?.('git'),
    },
    {
      id: 'terminal' as const,
      label: 'Terminal',
      badge: 'F12',
      shortcut: 'Alt+F12',
      icon: Terminal,
      iconColor: 'text-[#DFE1E5]',
      isActive: isBottomOpen && bottomTab === 'terminal',
      onClick: () => onToggleBottomTab?.('terminal'),
    },
    {
      id: 'run' as const,
      label: 'Run',
      badge: '4',
      shortcut: 'Alt+4',
      icon: Play,
      iconColor: isRunning ? 'text-[#3574F0] fill-[#3574F0] animate-pulse' : 'text-[#59A869]',
      isActive: isBottomOpen && bottomTab === 'run',
      onClick: () => onToggleBottomTab?.('run'),
    },
    {
      id: 'debug' as const,
      label: 'Debug',
      badge: '5',
      shortcut: 'Alt+5',
      icon: Bug,
      iconColor: 'text-[#E55353]',
      isActive: isBottomOpen && bottomTab === 'debug',
      onClick: () => onToggleBottomTab?.('debug'),
    },
    {
      id: 'problems' as const,
      label: errorCount > 0 ? `Problems (${errorCount})` : 'Problems',
      badge: '6',
      shortcut: 'Alt+6',
      icon: AlertCircle,
      iconColor: errorCount > 0 ? 'text-[#E05555]' : warningCount > 0 ? 'text-[#EDA200]' : 'text-[#59A869]',
      isActive: isBottomOpen && bottomTab === 'problems',
      onClick: () => onToggleBottomTab?.('problems'),
    },
    ...(hasFindResult || bottomTab === 'find' ? [{
      id: 'find' as const,
      label: 'Find',
      badge: '3',
      shortcut: 'Alt+3',
      icon: Search,
      iconColor: 'text-[#3574F0]',
      isActive: isBottomOpen && bottomTab === 'find',
      onClick: () => onToggleBottomTab?.('find'),
    }] : []),
  ];

  return (
    <div className="w-10 bg-[#1E1F22] border-r border-[#2B2D30] flex flex-col justify-between py-2 select-none z-10 flex-shrink-0">
      {/* ─── Top Left Tool Window Buttons (Project, Commit, Bookmarks, Structure) ─── */}
      <div className="flex flex-col items-center gap-1">
        {topStripeItems.map((item) => {
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

      {/* ─── Bottom Tool Window Buttons (Git, Terminal, Run, Debug, Problems, Settings) ─── */}
      <div className="flex flex-col items-center gap-1">
        {bottomToolItems.map((item) => {
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
              <Icon size={15} className={item.isActive ? '' : item.iconColor} />

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

        <div className="w-5 h-[1px] bg-[#2B2D30] my-0.5" />

        {/* Settings button */}
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
