import React, { useEffect, useRef } from 'react';

interface MoreToolWindowsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
  onSelectTool: (toolId: string) => void;
}

export const MoreToolWindowsPopup: React.FC<MoreToolWindowsPopupProps> = ({
  isOpen,
  onClose,
  anchorRect,
  onSelectTool,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !anchorRect) return null;

  const top = Math.max(10, Math.min(anchorRect.top, window.innerHeight - 380));
  const left = anchorRect.right + 6;

  const tools: {
    id: string;
    name: string;
    shortcut?: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'find',
      name: 'Find',
      shortcut: 'Alt+Shift+U',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6.5" cy="6.5" r="4.5" stroke="#3574F0" strokeWidth="1.5" />
          <path d="M10 10L14 14" stroke="#3574F0" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M4.5 5H8.5" stroke="#85B1F8" strokeWidth="1" strokeLinecap="round" />
          <path d="M4.5 7H7.5" stroke="#85B1F8" strokeWidth="1" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'run',
      name: 'Run',
      shortcut: 'Alt+4',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 2.5V13.5L13 8L4 2.5Z" fill="#59A869" />
        </svg>
      ),
    },
    {
      id: 'debug',
      name: 'Debug',
      shortcut: 'Alt+5',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="4" fill="#E05555" />
          <path d="M8 2V4M8 12V14M2 8H4M12 8H14M3.5 3.5L5 5M11 11L12.5 12.5M3.5 12.5L5 11M11 5L12.5 3.5" stroke="#E05555" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'sonar',
      name: 'SonarQube for IDE',
      shortcut: 'Alt+8',
      icon: (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 16C4 9.92487 8.92487 5 15 5" stroke="#4B9FD5" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 16C4 12.6863 6.68629 10 10 10" stroke="#4B9FD5" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 16C4 14.3431 5.34315 13 7 13" stroke="#4B9FD5" strokeWidth="2" strokeLinecap="round" />
          <circle cx="4" cy="16" r="1.2" fill="#4B9FD5" />
        </svg>
      ),
    },
    {
      id: 'bookmarks',
      name: 'Bookmarks',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.5 2C3.5 1.72386 3.72386 1.5 4 1.5H12C12.2761 1.5 12.5 1.72386 12.5 2V14.5L8 11.5L3.5 14.5V2Z" fill="#3574F0" />
        </svg>
      ),
    },
    {
      id: 'coverage',
      name: 'Coverage',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 1.5L3 3.5V7.5C3 11 5.5 13.5 8 14.5C10.5 13.5 13 11 13 7.5V3.5L8 1.5Z" fill="#59A869" fillOpacity="0.2" stroke="#59A869" strokeWidth="1.25" />
          <path d="M5.5 7.5L7 9L10.5 5.5" stroke="#59A869" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'endpoints',
      name: 'Endpoints',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="2.5" fill="#3592F0" />
          <circle cx="3" cy="4" r="1.5" stroke="#3592F0" strokeWidth="1.2" />
          <circle cx="13" cy="4" r="1.5" stroke="#3592F0" strokeWidth="1.2" />
          <circle cx="8" cy="13.5" r="1.5" stroke="#3592F0" strokeWidth="1.2" />
          <path d="M4.5 4.5L6.5 6.5M11.5 4.5L9.5 6.5M8 10.5V12" stroke="#3592F0" strokeWidth="1.2" />
        </svg>
      ),
    },
    {
      id: 'hierarchy',
      name: 'Hierarchy',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6.5" y="2" width="3" height="3" rx="0.5" fill="#C77DBB" />
          <rect x="2" y="11" width="3" height="3" rx="0.5" fill="#C77DBB" />
          <rect x="11" y="11" width="3" height="3" rx="0.5" fill="#C77DBB" />
          <path d="M8 5V8M8 8H3.5V11M8 8H12.5V11" stroke="#C77DBB" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'learn',
      name: 'Learn',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 2L1 5.5L8 9L15 5.5L8 2Z" fill="#3574F0" />
          <path d="M3.5 7V11C3.5 12 5.5 13 8 13C10.5 13 12.5 12 12.5 11V7" stroke="#3574F0" strokeWidth="1.2" />
          <path d="M15 5.5V11.5" stroke="#3574F0" strokeWidth="1.2" />
        </svg>
      ),
    },
    {
      id: 'profiler',
      name: 'Profiler',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8.5" r="5.5" stroke="#59A869" strokeWidth="1.25" />
          <path d="M8 8.5L10.5 6" stroke="#59A869" strokeWidth="1.25" strokeLinecap="round" />
          <circle cx="8" cy="8.5" r="1.5" fill="#59A869" />
        </svg>
      ),
    },
    {
      id: 'todo',
      name: 'TODO',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="10" height="11" rx="1" stroke="#D9822B" strokeWidth="1.25" />
          <path d="M6 1.5H10V3.5H6V1.5Z" fill="#D9822B" />
          <path d="M5.5 6.5H10.5M5.5 9H10.5M5.5 11.5H8.5" stroke="#D9822B" strokeWidth="1" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <div
      ref={popupRef}
      style={{ top: `${top}px`, left: `${left}px` }}
      className="fixed z-[9999] min-w-[210px] bg-[#2B2D30] border border-[#393B40] rounded-[6px] shadow-2xl py-1 text-[#DFE1E5] font-sans select-none text-[12px]"
    >
      <div className="flex flex-col">
        {tools.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onSelectTool(item.id);
              onClose();
            }}
            className="flex items-center justify-between px-3 py-1.5 hover:bg-[#3574F0] hover:text-white transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex-shrink-0 flex items-center justify-center w-4 h-4">
                {item.icon}
              </span>
              <span className="truncate">{item.name}</span>
            </div>
            {item.shortcut && (
              <span className="text-[#868A91] group-hover:text-white/80 text-[11px] ml-4 font-mono flex-shrink-0">
                {item.shortcut}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
