import React from 'react';
import { 
  FolderTree, 
  Search, 
  GitBranch, 
  Terminal, 
  PlaySquare, 
  Bookmark, 
  Database, 
  Boxes
} from 'lucide-react';

interface ActivityBarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({ activeTab, onTabChange }) => {
  const topItems = [
    { id: 'project', label: 'Project', icon: FolderTree, shortcut: 'Alt+1' },
    { id: 'commit', label: 'Commit / Git', icon: GitBranch, shortcut: 'Alt+0' },
    { id: 'search', label: 'Find in Files', icon: Search, shortcut: 'Ctrl+Shift+F' },
    { id: 'database', label: 'Database', icon: Database, shortcut: 'Alt+5' },
    { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark, shortcut: 'Alt+2' },
  ];

  const bottomItems = [
    { id: 'run', label: 'Run Console', icon: PlaySquare, shortcut: 'Alt+4' },
    { id: 'terminal', label: 'Terminal', icon: Terminal, shortcut: 'Alt+F12' },
    { id: 'plugins', label: 'Plugins', icon: Boxes },
  ];

  return (
    <div className="w-10 bg-[#2B2D30] border-r border-[#393B40] flex flex-col justify-between py-2 select-none z-10">
      {/* Top Icons */}
      <div className="flex flex-col items-center gap-1">
        {topItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={`${item.label} (${item.shortcut || ''})`}
              className={`w-8 h-8 rounded flex items-center justify-center transition-colors relative ${
                isActive 
                  ? 'bg-[#35373B] text-[#3574F0]' 
                  : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B]/60'
              }`}
            >
              <Icon size={17} />
              {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-[#3574F0] rounded-r" />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Icons */}
      <div className="flex flex-col items-center gap-1">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={`${item.label} (${item.shortcut || ''})`}
              className={`w-8 h-8 rounded flex items-center justify-center transition-colors relative ${
                isActive 
                  ? 'bg-[#35373B] text-[#3574F0]' 
                  : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B]/60'
              }`}
            >
              <Icon size={17} />
              {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-[#3574F0] rounded-r" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
