import React from 'react';
import { BottomTabType } from '../stores/layoutStore';

export interface ActivityBarProps {
  // Left Tool Window
  activeSideTab: string;
  isSideBarOpen: boolean;
  onToggleSideTab: (tabId: string) => void;

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
}

/**
 * Authentic JetBrains New UI Vector Icons (Extracted 100% from IntelliJ IDEA 2025.3.2)
 * Copyright 2000-2025 JetBrains s.r.o. (Apache 2.0 License)
 */
export const IjProjectIcon: React.FC<{ isActive?: boolean; className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10.5199 5.57617L10.7285 5.75H11H17C17.6904 5.75 18.25 6.30964 18.25 7V15.1667C18.25 16.0671 17.553 16.75 16.75 16.75H3.25C2.44705 16.75 1.75 16.0671 1.75 15.1667V4.83333C1.75 3.93294 2.44705 3.25 3.25 3.25H7.63795C7.69643 3.25 7.75307 3.2705 7.798 3.30794L10.5199 5.57617Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

export const IjCommitIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M19.25 9.25C19.6642 9.25 20 9.58579 20 10C20 10.4142 19.6642 10.75 19.25 10.75L13.9298 10.75C13.5787 12.6006 11.9528 14 10 14C8.04721 14 6.42125 12.6006 6.0702 10.75L0.75 10.75C0.335787 10.75 -1.92951e-07 10.4142 -1.74846e-07 10C-1.5674e-07 9.58579 0.335787 9.25 0.75 9.25L6.0702 9.25C6.42125 7.39935 8.04721 6 10 6C11.9528 6 13.5787 7.39935 13.9298 9.25L19.25 9.25ZM10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z"
      fill="currentColor"
    />
  </svg>
);

export const IjPullRequestsIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="3.75" cy="12" r="2" stroke="currentColor" strokeWidth="1.25" />
    <circle cx="3.75" cy="4" r="2" stroke="currentColor" strokeWidth="1.25" />
    <path d="M3.75 6L3.75 10" stroke="currentColor" strokeWidth="1.25" />
    <circle cx="12.25" cy="12" r="2" stroke="currentColor" strokeWidth="1.25" />
    <path d="M12.25 10L12.25 5.6C12.25 4.71634 11.5337 4 10.65 4L8 4" stroke="currentColor" strokeWidth="1.25" />
    <path d="M9.75 6L7.75 4L9.75 2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
  </svg>
);

export const IjBookmarksIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M15.5 3C15.5 2.72386 15.2761 2.5 15 2.5H5C4.72386 2.5 4.5 2.72386 4.5 3L4.50037 16.959L9.06678 13.3262L9.17127 13.25C9.70875 12.8931 10.4214 12.9185 10.934 13.3262L15.5004 16.959L15.5 3ZM17.0004 17.9961C17.0004 18.781 16.1504 19.2403 15.5043 18.8652L15.3773 18.7793L10.0004 14.5L4.62342 18.7793L4.49646 18.8652C3.85035 19.2403 3.00037 18.781 3.00037 17.9961L3 3C3 1.89543 3.89543 1 5 1H15C16.1046 1 17 1.89543 17 3L17.0004 17.9961Z"
      fill="currentColor"
    />
  </svg>
);

export const IjStructureIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2.75 1C3.16421 1 3.5 1.33579 3.5 1.75V4H6V3C6 1.89543 6.89543 1 8 1H16C17.1046 1 18 1.89543 18 3V7C18 8.10457 17.1046 9 16 9H8C6.89543 9 6 8.10457 6 7V5.5H3.5V14H6V13C6 11.8954 6.89543 11 8 11H16C17.1046 11 18 11.8954 18 13V17C18 18.1046 17.1046 19 16 19H8C6.89543 19 6 18.1046 6 17V15.5H3.5V18.25C3.5 18.6642 3.16421 19 2.75 19C2.33579 19 2 18.6642 2 18.25V1.75C2 1.33579 2.33579 1 2.75 1ZM16 12.5H8C7.72386 12.5 7.5 12.7239 7.5 13V17C7.5 17.2761 7.72386 17.5 8 17.5H16C16.2761 17.5 16.5 17.2761 16.5 17V13C16.5 12.7239 16.2761 12.5 16 12.5ZM8 2.5H16C16.2761 2.5 16.5 2.72386 16.5 3V7C16.5 7.27614 16.2761 7.5 16 7.5H8C7.72386 7.5 7.5 7.27614 7.5 7V3C7.5 2.72386 7.72386 2.5 8 2.5Z"
      fill="currentColor"
    />
  </svg>
);

export const IjMoreIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="3.5" cy="10" r="1.5" transform="rotate(-90 3.5 10)" fill="currentColor" />
    <circle cx="10" cy="10" r="1.5" transform="rotate(-90 10 10)" fill="currentColor" />
    <circle cx="16.5" cy="10" r="1.5" transform="rotate(-90 16.5 10)" fill="currentColor" />
  </svg>
);

export const IjTerminalIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9 13.2788C9 12.8646 9.33579 12.5288 9.75 12.5288L14.25 12.5C14.6642 12.5 15 12.8358 15 13.25C15 13.6642 14.6642 14 14.25 14L9.75 14.0288C9.33579 14.0288 9 13.693 9 13.2788Z"
      fill="currentColor"
    />
    <rect x="1.75" y="2.75" width="16.5" height="14.5" rx="1.25" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5.75 11.75L8.5 9L5.75 6.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IjSettingsIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3.96446 5.54781C3.63344 5.99572 3.35137 6.48132 3.12584 6.99671L4.14987 8.72634C4.61489 9.51177 4.61489 10.4882 4.14987 11.2736L3.12584 13.0033C3.35137 13.5187 3.63344 14.0043 3.96446 14.4522L5.9723 14.4302C6.88501 14.4202 7.73062 14.9084 8.17831 15.7038L9.16331 17.4539C9.43778 17.4843 9.71717 17.5 10.0007 17.5C10.2843 17.5 10.5637 17.4843 10.8382 17.4539L11.8232 15.7038C12.2709 14.9084 13.1165 14.4202 14.0292 14.4302L16.037 14.4522C16.368 14.0043 16.6501 13.5186 16.8756 13.0033L15.8516 11.2736C15.3866 10.4882 15.3866 9.51177 15.8516 8.72634L16.8756 6.99671C16.6501 6.48132 16.368 5.99572 16.037 5.54781L14.0292 5.56981C13.1165 5.57981 12.2709 5.09159 11.8232 4.29617L10.8382 2.5461C10.5637 2.51567 10.2843 2.5 10.0007 2.5C9.71717 2.5 9.43779 2.51567 9.16332 2.54609L8.17831 4.29617C7.73062 5.09159 6.88501 5.57981 5.9723 5.56981L3.96446 5.54781ZM13.6234 10C13.6234 12.0008 12.0015 13.6227 10.0007 13.6227C7.99996 13.6227 6.37802 12.0008 6.37802 10C6.37802 7.99924 7.99996 6.37729 10.0007 6.37729C12.0015 6.37729 13.6234 7.99923 13.6234 10ZM5.98873 4.0699C6.35382 4.0739 6.69206 3.87861 6.87114 3.56044L7.98752 1.57695C8.13019 1.32346 8.37572 1.14153 8.66343 1.09868C9.09976 1.03368 9.54632 1 10.0007 1C10.4552 1 10.9017 1.03368 11.3381 1.09868C11.6258 1.14154 11.8713 1.32346 12.014 1.57695L13.1303 3.56044C13.3094 3.87861 13.6477 4.0739 14.0127 4.0699L16.2875 4.04498C16.5778 4.0418 16.8576 4.16301 17.0387 4.38992C17.594 5.08559 18.0482 5.8654 18.3793 6.70716C18.4856 6.9775 18.4507 7.28065 18.3027 7.53062L17.1424 9.49053C16.9563 9.8047 16.9563 10.1953 17.1424 10.5094L18.3027 12.4694C18.4507 12.7193 18.4856 13.0225 18.3793 13.2928C18.0482 14.1346 17.594 14.9144 17.0387 15.6101C16.8576 15.837 16.5778 15.9582 16.2875 15.955L14.0128 15.9301C13.6477 15.9261 13.3094 16.1214 13.1303 16.4395L12.014 18.423C11.8713 18.6765 11.6258 18.8584 11.3381 18.9013C10.9017 18.9663 10.4552 19 10.0007 19C9.54631 19 9.09976 18.9663 8.66343 18.9013C8.37571 18.8584 8.13018 18.6765 7.98751 18.423L6.87114 16.4395C6.69206 16.1214 6.35382 15.9261 5.98873 15.9301L3.71401 15.955C3.4237 15.9582 3.14389 15.837 2.96277 15.6101C2.40752 14.9144 1.95325 14.1346 1.62217 13.2928C1.51585 13.0225 1.55076 12.7193 1.69876 12.4694L2.85913 10.5094C3.04514 10.1953 3.04514 9.8047 2.85913 9.49053L1.69876 7.53061C1.55076 7.28064 1.51584 6.97749 1.62217 6.70715C1.95325 5.86539 2.40751 5.08558 2.96276 4.38992C3.14388 4.16301 3.42369 4.0418 3.71401 4.04498L5.98873 4.0699ZM12.1234 10C12.1234 11.1723 11.1731 12.1227 10.0007 12.1227C8.82839 12.1227 7.87802 11.1723 7.87802 10C7.87802 8.82766 8.82839 7.87729 10.0007 7.87729C11.1731 7.87729 12.1234 8.82766 12.1234 10Z"
      fill="currentColor"
    />
  </svg>
);

export const IjNotificationsIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M8.67717 17.5625H11.3229C11.2515 17.7305 11.148 17.8849 11.0165 18.0164C10.7469 18.286 10.3813 18.4375 10 18.4375C9.61878 18.4375 9.25315 18.286 8.98358 18.0164C8.85202 17.8849 8.74859 17.7305 8.67717 17.5625Z"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    <path
      d="M4.67081 10.3354C4.72288 10.2313 4.74999 10.1164 4.74999 10V7C4.74999 4.97056 5.52681 3.69096 6.52723 2.90116C7.55609 2.08891 8.8818 1.75 9.99999 1.75C11.1182 1.75 12.4439 2.08891 13.4728 2.90116C14.4732 3.69096 15.25 4.97056 15.25 7V10C15.25 10.1164 15.2771 10.2313 15.3292 10.3354L17.4648 14.6067C17.6126 14.9023 17.3977 15.25 17.0672 15.25H2.93274C2.6023 15.25 2.38739 14.9023 2.53516 14.6067L4.67081 10.3354Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Authentic IntelliJ IDEA New UI - Left Tool Window Stripe (Activity Bar)
 * 100% Monochrome Vector Iconography matching JetBrains New UI
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
  const topStripeItems = [
    { 
      id: 'project', 
      label: 'Project', 
      shortcut: 'Alt+1',
      isActive: isSideBarOpen && activeSideTab === 'project',
      onClick: () => onToggleSideTab('project'),
      renderIcon: (active: boolean) => <IjProjectIcon isActive={active} />,
    },
    { 
      id: 'commit', 
      label: 'Commit', 
      shortcut: 'Alt+0',
      isActive: isSideBarOpen && activeSideTab === 'commit',
      onClick: () => onOpenCommit ? onOpenCommit() : onToggleSideTab('commit'),
      renderIcon: () => <IjCommitIcon />,
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
      id: 'bookmarks', 
      label: 'Bookmarks', 
      shortcut: 'Alt+2',
      isActive: isSideBarOpen && activeSideTab === 'bookmarks',
      onClick: () => onToggleSideTab('bookmarks'),
      renderIcon: () => <IjBookmarksIcon />,
    },
    { 
      id: 'structure', 
      label: 'Structure', 
      shortcut: 'Alt+7',
      isActive: isSideBarOpen && activeSideTab === 'structure',
      onClick: () => onToggleSideTab('structure'),
      renderIcon: () => <IjStructureIcon />,
    },
  ];

  return (
    <div className="w-10 bg-[#1E1F22] border-r border-[#2B2D30] flex flex-col justify-between py-2 select-none z-10 flex-shrink-0">
      {/* ─── Top Left Tool Window Buttons (Project, Commit, PRs, Bookmarks, Structure, More) ─── */}
      <div className="flex flex-col items-center gap-1">
        {topStripeItems.map((item) => {
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              title={`${item.label} (${item.shortcut})`}
              className={`w-8 h-8 rounded-[5px] flex items-center justify-center transition-all relative group cursor-pointer ${
                item.isActive 
                  ? 'bg-[#2B2D30] text-[#DFE1E5]' 
                  : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
              }`}
            >
              {item.renderIcon(item.isActive)}

              {/* Authentic IntelliJ active indicator stripe */}
              {item.isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] bg-[#3574F0] rounded-r" />
              )}
            </button>
          );
        })}

        {/* More tool windows (...) */}
        <button
          onClick={() => onToggleSideTab('more')}
          title="More Tool Windows"
          className="w-8 h-8 rounded-[5px] flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60 transition-colors cursor-pointer"
        >
          <IjMoreIcon />
        </button>
      </div>

      {/* ─── Bottom Tool Window Buttons (Terminal, Notifications, Settings) ─── */}
      <div className="flex flex-col items-center gap-1">
        {/* Terminal button */}
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

        {/* Notifications button */}
        <button
          onClick={() => onToggleBottomTab?.('problems')}
          title="Notifications & Problems (Alt+6)"
          className={`w-8 h-8 rounded-[5px] flex items-center justify-center transition-all relative group cursor-pointer ${
            isBottomOpen && bottomTab === 'problems'
              ? 'bg-[#2B2D30] text-[#DFE1E5]'
              : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
          }`}
        >
          <IjNotificationsIcon />
          {isBottomOpen && bottomTab === 'problems' && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] bg-[#3574F0] rounded-r" />
          )}
        </button>

        {/* Settings button */}
        <button
          onClick={() => onOpenPlugins?.()}
          title="Settings (Ctrl+Alt+S)"
          className="w-8 h-8 rounded-[5px] flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60 transition-colors cursor-pointer"
        >
          <IjSettingsIcon />
        </button>
      </div>
    </div>
  );
};
