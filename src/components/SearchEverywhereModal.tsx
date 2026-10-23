import React, { useState, useEffect, useRef } from 'react';
import { Search, FileCode, Check, Command, Sparkles, X, AlignLeft, Loader2 } from 'lucide-react';
import { ActionItem } from '../types';
import { invoke } from '@tauri-apps/api/core';

interface SearchEverywhereModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath?: string;
  onSelectAction: (item: ActionItem) => void;
}

const defaultActions: ActionItem[] = [
  { id: 'act-1', title: 'Rebuild Project', category: 'Actions', shortcut: 'Ctrl+F9' },
  { id: 'act-2', title: 'Run Desktop IDE', category: 'Actions', shortcut: 'Shift+F10' },
  { id: 'act-3', title: 'Stop Running Process', category: 'Actions', shortcut: 'Ctrl+F2' },
  { id: 'act-4', title: 'Toggle Terminal', category: 'Actions', shortcut: 'Alt+F12' },
  { id: 'act-5', title: 'Toggle Run Console', category: 'Actions', shortcut: 'Alt+4' },
  { id: 'act-6', title: 'Format Code', category: 'Actions', shortcut: 'Ctrl+Alt+L' },
  { id: 'act-7', title: 'Git: Commit Changes', category: 'Actions', shortcut: 'Ctrl+K' },
  { id: 'act-8', title: 'Git: Branches', category: 'Actions', shortcut: 'Branches' },
  { id: 'act-9', title: 'Settings / Preferences', category: 'Actions', shortcut: 'Ctrl+Alt+S' },
  { id: 'act-10', title: 'Go to Line', category: 'Actions', shortcut: 'Ctrl+G' },
  { id: 'act-11', title: 'Rename Symbol', category: 'Actions', shortcut: 'Shift+F6' },
];

interface BackendFileItem {
  name: string;
  path: string;
  relative_path: string;
  is_folder: boolean;
}

interface BackendTextItem {
  file_name: string;
  file_path: string;
  relative_path: string;
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
}

export const SearchEverywhereModal: React.FC<SearchEverywhereModalProps> = ({
  isOpen,
  onClose,
  projectPath = 'D:\\IDE',
  onSelectAction,
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Files' | 'Text' | 'Actions' | 'Symbols'>('All');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [backendItems, setBackendItems] = useState<ActionItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
      setBackendItems([]);
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setBackendItems([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          const promises: Promise<any>[] = [];

          if (activeTab === 'All' || activeTab === 'Files') {
            promises.push(
              invoke<BackendFileItem[]>('search_project_files', {
                projectPath,
                query: trimmed,
                limit: 30,
              }).catch(() => [])
            );
          } else {
            promises.push(Promise.resolve([]));
          }

          if (activeTab === 'All' || activeTab === 'Text' || activeTab === 'Symbols') {
            promises.push(
              invoke<BackendTextItem[]>('search_project_text', {
                projectPath,
                query: trimmed,
                caseSensitive: false,
                limit: 40,
              }).catch(() => [])
            );
          } else {
            promises.push(Promise.resolve([]));
          }

          const [filesRes, textRes] = await Promise.all(promises);

          const items: ActionItem[] = [];

          // Map files
          if (Array.isArray(filesRes)) {
            filesRes.forEach((f, idx) => {
              items.push({
                id: `file-${idx}-${f.name}`,
                title: f.name,
                shortcut: f.relative_path,
                category: 'Files',
                filePath: f.path,
              });
            });
          }

          // Map text search lines
          if (Array.isArray(textRes)) {
            textRes.forEach((t, idx) => {
              items.push({
                id: `text-${idx}-${t.file_path}-${t.line_number}`,
                title: `${t.file_name}:${t.line_number}`,
                shortcut: t.relative_path,
                category: 'Text',
                filePath: t.file_path,
                lineNumber: t.line_number,
                snippet: t.line_content,
              });
            });
          }

          setBackendItems(items);
        }
      } catch (err) {
        console.warn('Search everywhere error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, activeTab, isOpen, projectPath]);

  if (!isOpen) return null;

  const tabs: Array<'All' | 'Files' | 'Text' | 'Actions' | 'Symbols'> = [
    'All', 'Files', 'Text', 'Actions', 'Symbols'
  ];

  // Combine matching built-in actions + backend search items
  const matchingActions = defaultActions.filter(act => {
    if (activeTab !== 'All' && activeTab !== 'Actions') return false;
    if (!query.trim()) return true;
    return act.title.toLowerCase().includes(query.toLowerCase()) ||
      (act.shortcut && act.shortcut.toLowerCase().includes(query.toLowerCase()));
  });

  const allItems: ActionItem[] = [
    ...backendItems,
    ...matchingActions,
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, allItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allItems.length) % Math.max(1, allItems.length));
    } else if (e.key === 'Enter') {
      if (allItems[selectedIndex]) {
        onSelectAction(allItems[selectedIndex]);
        onClose();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const nextTabIdx = (tabs.indexOf(activeTab) + 1) % tabs.length;
      setActiveTab(tabs[nextTabIdx]);
      setSelectedIndex(0);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-start justify-center pt-20 z-50 select-none"
      onClick={onClose}
    >
      <div 
        className="w-[680px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center justify-between border-b border-[#393B40] px-3 pt-2">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedIndex(0);
                }}
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
          {isSearching ? (
            <Loader2 size={16} className="text-[#3574F0] animate-spin" />
          ) : (
            <Search size={16} className="text-[#3574F0]" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search everywhere (type file name, symbol, code text or action, Tab to switch)..."
            className="flex-1 bg-transparent border-none outline-none text-[#DFE1E5] text-[13px] placeholder-[#6E7178] font-sans"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[#2B2D30] border border-[#393B40] text-[#868A91]">
            ESC
          </kbd>
        </div>

        {/* Search Results */}
        <div className="max-h-96 overflow-y-auto py-1">
          {allItems.length === 0 ? (
            <div className="py-10 text-center text-[#868A91] text-[12px]">
              {query ? 'No matches found in project' : 'Type to search project files, symbols, or actions'}
            </div>
          ) : (
            allItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectAction(item);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-1.5 cursor-pointer text-[12px] transition-colors ${
                    isSelected ? 'bg-[#2E436E] text-white' : 'text-[#DFE1E5] hover:bg-[#35373B]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                    {item.category === 'Actions' && <Command size={14} className="text-[#3574F0] shrink-0" />}
                    {item.category === 'Files' && <FileCode size={14} className="text-[#EDA200] shrink-0" />}
                    {item.category === 'Classes' && <Sparkles size={14} className="text-[#9876AA] shrink-0" />}
                    {item.category === 'Symbols' && <Check size={14} className="text-[#59A869] shrink-0" />}
                    {item.category === 'Text' && <AlignLeft size={14} className="text-[#3574F0] shrink-0" />}
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-medium truncate">{item.title}</span>
                        {item.snippet && (
                          <span className={`text-[11px] truncate font-mono ${isSelected ? 'text-blue-100' : 'text-[#A1A3A8]'}`}>
                            {item.snippet}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {item.shortcut && (
                    <span className={`text-[11px] shrink-0 font-mono ${isSelected ? 'text-blue-200' : 'text-[#868A91]'}`}>
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
          <span>Use ↑ ↓ to navigate, Enter to jump, Tab to switch category</span>
          <span className="text-[10px] text-[#A1A3A8]">IntelliJ IDEA Search</span>
        </div>
      </div>
    </div>
  );
};
