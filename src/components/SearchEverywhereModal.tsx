import React, { useState, useEffect, useRef } from 'react';
import { Search, FileCode, Check, Command, Sparkles, X } from 'lucide-react';
import { ActionItem } from '../types';

interface SearchEverywhereModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (item: ActionItem) => void;
}

const defaultItems: ActionItem[] = [
  { id: '1', title: 'main.rs', category: 'Files', shortcut: 'src-tauri/src/main.rs' },
  { id: '2', title: 'App.tsx', category: 'Files', shortcut: 'src/App.tsx' },
  { id: '3', title: 'Cargo.toml', category: 'Files', shortcut: 'src-tauri/Cargo.toml' },
  { id: '4', title: 'Rebuild Project', category: 'Actions', shortcut: 'Ctrl+F9' },
  { id: '5', title: 'Run Desktop IDE', category: 'Actions', shortcut: 'Shift+F10' },
  { id: '6', title: 'Toggle Terminal', category: 'Actions', shortcut: 'Alt+F12' },
  { id: '7', title: 'Format Code', category: 'Actions', shortcut: 'Ctrl+Alt+L' },
  { id: '8', title: 'Git: Commit Changes', category: 'Actions', shortcut: 'Ctrl+K' },
  { id: '9', title: 'Settings / Preferences', category: 'Actions', shortcut: 'Ctrl+Alt+S' },
  { id: '10', title: 'fn setup_terminal_pty', category: 'Symbols', shortcut: 'src-tauri/src/main.rs:18' },
  { id: '11', title: 'struct IdeState', category: 'Classes', shortcut: 'src-tauri/src/main.rs:8' },
];

export const SearchEverywhereModal: React.FC<SearchEverywhereModalProps> = ({
  isOpen,
  onClose,
  onSelectAction,
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Classes' | 'Files' | 'Symbols' | 'Actions'>('All');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tabs: Array<'All' | 'Classes' | 'Files' | 'Symbols' | 'Actions'> = [
    'All', 'Classes', 'Files', 'Symbols', 'Actions'
  ];

  const filteredItems = defaultItems.filter(item => {
    const matchesTab = activeTab === 'All' || item.category === activeTab;
    const matchesQuery = item.title.toLowerCase().includes(query.toLowerCase()) || 
                         (item.shortcut && item.shortcut.toLowerCase().includes(query.toLowerCase()));
    return matchesTab && matchesQuery;
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      if (filteredItems[selectedIndex]) {
        onSelectAction(filteredItems[selectedIndex]);
        onClose();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const nextTabIdx = (tabs.indexOf(activeTab) + 1) % tabs.length;
      setActiveTab(tabs[nextTabIdx]);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-start justify-center pt-24 z-50 select-none"
      onClick={onClose}
    >
      <div 
        className="w-[620px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center justify-between border-b border-[#393B40] px-3 pt-2">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-t transition-colors relative ${
                  activeTab === tab
                    ? 'text-[#DFE1E5] bg-[#1E1F22] border-t-2 border-[#3574F0]'
                    : 'text-[#868A91] hover:text-[#DFE1E5]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button onClick={onClose} className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5]">
            <X size={14} />
          </button>
        </div>

        {/* Input Field */}
        <div className="p-3 bg-[#1E1F22] flex items-center gap-2 border-b border-[#393B40]">
          <Search size={16} className="text-[#3574F0]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search everywhere (type to filter, Tab to switch categories)..."
            className="flex-1 bg-transparent border-none outline-none text-[#DFE1E5] text-[13px] placeholder-[#4E5157] font-sans"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[#2B2D30] border border-[#393B40] text-[#868A91]">
            ESC
          </kbd>
        </div>

        {/* Search Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-[#868A91] text-[12px]">
              No matches found
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectAction(item);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer text-[12px] transition-colors ${
                    isSelected ? 'bg-[#2E436E] text-white' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.category === 'Actions' && <Command size={14} className="text-[#3574F0]" />}
                    {item.category === 'Files' && <FileCode size={14} className="text-[#EDA200]" />}
                    {item.category === 'Classes' && <Sparkles size={14} className="text-[#9876AA]" />}
                    {item.category === 'Symbols' && <Check size={14} className="text-[#59A869]" />}
                    <span className="font-medium">{item.title}</span>
                  </div>

                  {item.shortcut && (
                    <span className={`text-[11px] ${isSelected ? 'text-blue-200' : 'text-[#868A91]'}`}>
                      {item.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="h-6 bg-[#2B2D30] border-t border-[#393B40] px-3 flex items-center justify-between text-[11px] text-[#868A91]">
          <span>Use ↑ ↓ to navigate, Enter to select, Tab to switch category</span>
          <span className="text-[10px] text-[#A1A3A8]">IntelliJ Search Everywhere</span>
        </div>
      </div>
    </div>
  );
};
