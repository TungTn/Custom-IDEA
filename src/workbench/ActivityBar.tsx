import React, { useState } from 'react';
import { BottomTabType } from '../stores/layoutStore';
import { MoreToolWindowsPopup } from './MoreToolWindowsPopup';

export interface ActivityBarProps {
  // Left Tool Window
  activeSideTab: string;
  isSideBarOpen: boolean;
  onToggleSideTab: (tabId: string) => void;

  // Right Tool Window
  activeRightPanel?: string | null;

  // Bottom Tool Window
  bottomTab?: BottomTabType;
  isBottomOpen?: boolean;
  onToggleBottomTab?: (tabId: BottomTabType) => void;
  isRunning?: boolean;
  hasFindResult?: boolean;
  errorCount?: number;
  warningCount?: number;

  // Quick Action Callbacks
  onOpenCommit?: () => void;
  onOpenSearch?: () => void;
  onToggleDatabase?: () => void;
  onOpenPlugins?: () => void;
  onSelectMoreTool?: (toolId: string) => void;
}

/**
 * Authentic JetBrains New UI Vector Icons with Semantic Color Accents
 * Matching IntelliJ IDEA 2025.3 New UI 100%
 */

// 1. Project Icon (Subtle Folder with Cyan Accent)
export const IjProjectIcon: React.FC<{ isActive?: boolean; className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10.5199 5.57617L10.7285 5.75H11H17C17.6904 5.75 18.25 6.30964 18.25 7V15.1667C18.25 16.0671 17.553 16.75 16.75 16.75H3.25C2.44705 16.75 1.75 16.0671 1.75 15.1667V4.83333C1.75 3.93294 2.44705 3.25 3.25 3.25H7.63795C7.69643 3.25 7.75307 3.2705 7.798 3.30794L10.5199 5.57617Z"
      stroke="#CED0D6"
      strokeWidth="1.5"
    />
  </svg>
);

// 1b. Commit Icon (IntelliJ Blue Accent commit node with vertical graph stem)
export const IjCommitIcon: React.FC<{ isActive?: boolean; className?: string }> = ({ isActive, className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2.5V7M10 13V17.5" stroke="#3574F0" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="10" cy="10" r="3.2" stroke="#3574F0" strokeWidth="1.6" fill={isActive ? "#3574F0" : "transparent"} />
    {isActive && <circle cx="10" cy="10" r="1.5" fill="#FFFFFF" />}
  </svg>
);


// 2. Structure / Compass Icon (IntelliJ Yellow Accent)
export const IjStructureIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="5.5" stroke="#F2C55C" strokeWidth="1.5" />
    <circle cx="10" cy="10" r="2" fill="#F2C55C" />
    <path d="M10 2V4.5M10 15.5V18M2 10H4.5M15.5 10H18" stroke="#F2C55C" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// 3. SonarQube Official Logo (3 concentric wave arcs #4B9FD5)
export const IjSonarIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 16C4 9.92487 8.92487 5 15 5"
      stroke="#4B9FD5"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M4 16C4 12.6863 6.68629 10 10 10"
      stroke="#4B9FD5"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M4 16C4 14.3431 5.34315 13 7 13"
      stroke="#4B9FD5"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="4" cy="16" r="1.2" fill="#4B9FD5" />
  </svg>
);

// 4. Pull Requests / GitHub Icon
export const IjPullRequestsIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="3.75" cy="12" r="2" stroke="#CED0D6" strokeWidth="1.25" />
    <circle cx="3.75" cy="4" r="2" stroke="#CED0D6" strokeWidth="1.25" />
    <path d="M3.75 6L3.75 10" stroke="#CED0D6" strokeWidth="1.25" />
    <circle cx="12.25" cy="12" r="2" stroke="#CED0D6" strokeWidth="1.25" />
    <path d="M12.25 10L12.25 5.6C12.25 4.71634 11.5337 4 10.65 4L8 4" stroke="#CED0D6" strokeWidth="1.25" />
    <path d="M9.75 6L7.75 4L9.75 2" stroke="#CED0D6" strokeWidth="1.25" strokeLinecap="round" />
  </svg>
);

// 5. Database Icon (IntelliJ Golden Yellow Cylinders)
export const IjDatabaseIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="10" cy="5" rx="6.5" ry="2.2" fill="#F2C55C" stroke="#EDA200" strokeWidth="1.2" />
    <path
      d="M3.5 5V9.5C3.5 10.7 6.4 11.7 10 11.7C13.6 11.7 16.5 10.7 16.5 9.5V5"
      stroke="#EDA200"
      strokeWidth="1.2"
      fill="#F2C55C"
      fillOpacity="0.5"
    />
    <path
      d="M3.5 9.5V14.5C3.5 15.7 6.4 16.7 10 16.7C13.6 16.7 16.5 15.7 16.5 14.5V9.5"
      stroke="#EDA200"
      strokeWidth="1.2"
      fill="#F2C55C"
      fillOpacity="0.9"
    />
  </svg>
);

// 6. More Tool Windows (...)
export const IjMoreIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="4" cy="10" r="1.5" fill="#CED0D6" />
    <circle cx="10" cy="10" r="1.5" fill="#CED0D6" />
    <circle cx="16" cy="10" r="1.5" fill="#CED0D6" />
  </svg>
);

// 7. Problems Icon (Squiggly Wave with Red Error Badge)
export const IjProblemsIcon: React.FC<{ errorCount?: number; className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3 11C4.5 11 5.5 8.5 7 8.5C8.5 8.5 9.5 11 11 11C12.5 11 13.5 8.5 15 8.5C16 8.5 16.5 9.5 17 10"
      stroke="#CED0D6"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <circle cx="15.5" cy="13.5" r="2.5" fill="#E05555" />
  </svg>
);

// 8. Settings / Docker Icon (IntelliJ Green Gear)
export const IjSettingsIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="3.2" stroke="#59A869" strokeWidth="1.5" fill="#59A869" fillOpacity="0.25" />
    <path
      d="M10 2V4M10 16V18M2 10H4M16 10H18M4.34 4.34L5.75 5.75M14.25 14.25L15.66 15.66M4.34 15.66L5.75 14.25M14.25 5.75L15.66 4.34"
      stroke="#59A869"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

// 9. Terminal Icon (IntelliJ Purple Prompt >_)
export const IjTerminalIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="3.5" width="16" height="13" rx="1.5" stroke="#C77DBB" strokeWidth="1.3" fill="#C77DBB" fillOpacity="0.15" />
    <path d="M5.5 8L8.5 10L5.5 12" stroke="#C77DBB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10.5 12H14.5" stroke="#C77DBB" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// 11. Git Branch Icon (IntelliJ Sky Blue Accent)
export const IjGitIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="6" cy="5" r="2.2" stroke="#589DF6" strokeWidth="1.3" />
    <circle cx="6" cy="15" r="2.2" stroke="#589DF6" strokeWidth="1.3" />
    <circle cx="14" cy="9" r="2.2" stroke="#589DF6" strokeWidth="1.3" />
    <path d="M6 7.2V12.8" stroke="#589DF6" strokeWidth="1.3" />
    <path d="M6 10C8.5 10 11.5 10 12.2 9.4" stroke="#589DF6" strokeWidth="1.3" />
  </svg>
);

/**
 * Authentic IntelliJ IDEA New UI - Left Tool Window Stripe (Activity Bar)
 */
export const ActivityBar: React.FC<ActivityBarProps> = ({ 
  activeSideTab,
  isSideBarOpen,
  onToggleSideTab,
  activeRightPanel,
  bottomTab,
  isBottomOpen,
  onToggleBottomTab,
  onToggleDatabase,
  onOpenPlugins,
  onSelectMoreTool,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [moreAnchorRect, setMoreAnchorRect] = useState<DOMRect | null>(null);

  const topStripeItems = [
    { 
      id: 'project', 
      label: 'Project', 
      shortcut: 'Alt+1',
      isActive: isSideBarOpen && activeSideTab === 'project',
      onClick: () => onToggleSideTab('project'),
      renderIcon: (active?: boolean) => <IjProjectIcon isActive={active} />,
    },
    { 
      id: 'commit', 
      label: 'Commit', 
      shortcut: 'Alt+0',
      isActive: isSideBarOpen && activeSideTab === 'commit',
      onClick: () => onToggleSideTab('commit'),
      renderIcon: (active?: boolean) => <IjCommitIcon isActive={active} />,
    },
    { 
      id: 'structure', 
      label: 'Structure', 
      shortcut: 'Alt+7',
      isActive: isSideBarOpen && activeSideTab === 'structure',
      onClick: () => onToggleSideTab('structure'),
      renderIcon: () => <IjStructureIcon />,
    },
    { 
      id: 'pull-requests', 
      label: 'Pull Requests', 
      shortcut: 'Alt+8',
      isActive: isSideBarOpen && activeSideTab === 'pull-requests',
      onClick: () => onToggleSideTab('pull-requests'),
      renderIcon: () => <IjPullRequestsIcon />,
    },
    { 
      id: 'database', 
      label: 'Database Explorer', 
      shortcut: '',
      isActive: activeRightPanel === 'database',
      onClick: () => onToggleDatabase ? onToggleDatabase() : onToggleSideTab('database'),
      renderIcon: () => <IjDatabaseIcon />,
    },
  ];

  const handleMoreClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMoreAnchorRect(rect);
    setIsMoreOpen((prev) => !prev);
  };

  return (
    <div className="w-10 bg-[#1E1F22] border-r border-[#2B2D30] flex flex-col justify-between py-2 select-none z-10 flex-shrink-0">
      {/* ─── Top Left Tool Window Buttons ─── */}
      <div className="flex flex-col items-center gap-1">
        {topStripeItems.map((item) => {
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
              className={`w-8 h-8 rounded-[5px] flex items-center justify-center transition-all relative group cursor-pointer ${
                item.isActive 
                  ? 'bg-[#2B2D30] text-[#DFE1E5]' 
                  : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
              }`}
            >
              {item.renderIcon(Boolean(item.isActive))}

              {/* Authentic IntelliJ active indicator stripe */}
              {item.isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] bg-[#3574F0] rounded-r" />
              )}
            </button>
          );
        })}

        {/* More tool windows (...) */}
        <button
          onClick={handleMoreClick}
          title="More Tool Windows"
          className={`w-8 h-8 rounded-[5px] flex items-center justify-center transition-colors cursor-pointer relative ${
            isMoreOpen ? 'bg-[#2B2D30] text-white' : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
          }`}
        >
          <IjMoreIcon />
        </button>
      </div>

      {/* ─── Bottom Tool Window Buttons ─── */}
      <div className="flex flex-col items-center gap-1">
        {/* Problems button (with red error badge) */}
        <button
          onClick={() => onToggleBottomTab?.('problems')}
          title="Problems & Issues (Alt+6)"
          className={`w-8 h-8 rounded-[5px] flex items-center justify-center transition-all relative group cursor-pointer ${
            isBottomOpen && bottomTab === 'problems'
              ? 'bg-[#2B2D30] text-[#DFE1E5]'
              : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
          }`}
        >
          <IjProblemsIcon />
          {isBottomOpen && bottomTab === 'problems' && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] bg-[#3574F0] rounded-r" />
          )}
        </button>

        {/* Settings button (Green Gear) */}
        <button
          onClick={() => onOpenPlugins?.()}
          title="Settings (Ctrl+Alt+S)"
          className="w-8 h-8 rounded-[5px] flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60 transition-colors cursor-pointer"
        >
          <IjSettingsIcon />
        </button>

        {/* Terminal button (Purple Prompt) */}
        <button
          onClick={() => onToggleBottomTab?.('terminal')}
          title="Terminal (Alt+F12)"
          className={`w-8 h-8 rounded-[5px] flex items-center justify-center transition-all relative group cursor-pointer ${
            isBottomOpen && bottomTab === 'terminal'
              ? 'bg-[#2B2D30] text-[#DFE1E5]'
              : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
          }`}
        >
          <IjTerminalIcon />
          {isBottomOpen && bottomTab === 'terminal' && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] bg-[#3574F0] rounded-r" />
          )}
        </button>

        {/* SonarQube for IDE button */}
        <button
          onClick={() => onToggleBottomTab?.('sonar')}
          title="SonarQube for IDE"
          className={`w-8 h-8 rounded-[5px] flex items-center justify-center transition-all relative group cursor-pointer ${
            isBottomOpen && bottomTab === 'sonar'
              ? 'bg-[#2B2D30] text-[#DFE1E5]'
              : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
          }`}
        >
          <IjSonarIcon />
          {isBottomOpen && bottomTab === 'sonar' && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] bg-[#3574F0] rounded-r" />
          )}
        </button>

        {/* Git Branch button (Sky Blue) */}
        <button
          onClick={() => onToggleBottomTab?.('git')}
          title="Git (Alt+9)"
          className={`w-8 h-8 rounded-[5px] flex items-center justify-center transition-all relative group cursor-pointer ${
            isBottomOpen && bottomTab === 'git'
              ? 'bg-[#2B2D30] text-[#DFE1E5]'
              : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
          }`}
        >
          <IjGitIcon />
          {isBottomOpen && bottomTab === 'git' && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] bg-[#3574F0] rounded-r" />
          )}
        </button>
      </div>

      {/* Floating Popover for More Tool Windows */}
      <MoreToolWindowsPopup
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        anchorRect={moreAnchorRect}
        onSelectTool={(toolId) => {
          setIsMoreOpen(false);
          onSelectMoreTool?.(toolId);
        }}
      />
    </div>
  );
};
