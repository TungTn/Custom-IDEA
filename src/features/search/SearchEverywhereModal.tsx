import React, { useState, useEffect, useRef } from 'react';
import { Search, FileCode, Command, Sparkles, X, AlignLeft, Loader2, Code2, Box, Layers, Variable } from 'lucide-react';
import { ActionItem } from '../../types';
import { invoke } from '@tauri-apps/api/core';

export type SearchTab = 'All' | 'Files' | 'Symbols' | 'Actions' | 'Text';

interface SearchEverywhereModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath?: string;
  initialTab?: SearchTab;
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
  { id: 'act-12', title: 'Search Everywhere', category: 'Actions', shortcut: 'Double Shift' },
  { id: 'act-13', title: 'Go to Symbol', category: 'Actions', shortcut: 'Ctrl+Alt+Shift+N' },
  { id: 'act-14', title: 'Go to File', category: 'Actions', shortcut: 'Ctrl+Shift+N' },
];

interface BackendSearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  file_path?: string;
  line_number?: number;
  column_number?: number;
  snippet?: string;
  symbol_kind?: string;
  score: number;
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
  initialTab = 'All',
  onSelectAction,
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [backendItems, setBackendItems] = useState<ActionItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Background trigger project indexation on projectPath change / open
  useEffect(() => {
    if (isOpen && projectPath) {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        invoke('index_project', { projectPath }).catch(err => {
          console.debug('Background index check:', err);
        });
      }
    }
  }, [isOpen, projectPath]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
      setBackendItems([]);
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Fast sub-millisecond search query from ide-index
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

          // 1. Search Files / Symbols via ide-index
          if (activeTab === 'All' || activeTab === 'Files' || activeTab === 'Symbols') {
            promises.push(
              invoke<BackendSearchResultItem[]>('search_project_index', {
                projectPath,
                query: trimmed,
                category: activeTab,
                limit: 40,
              }).catch(() => [])
            );
          } else {
            promises.push(Promise.resolve([]));
          }

          // 2. Search Text across files (full text search)
          if (activeTab === 'All' || activeTab === 'Text') {
            promises.push(
              invoke<BackendTextItem[]>('search_project_text', {
                projectPath,
                query: trimmed,
                caseSensitive: false,
                limit: 30,
              }).catch(() => [])
            );
          } else {
            promises.push(Promise.resolve([]));
          }

          const [indexRes, textRes] = await Promise.all(promises);
          const items: ActionItem[] = [];

          // Map items from ide-index
          if (Array.isArray(indexRes)) {
            indexRes.forEach(item => {
              items.push({
                id: item.id,
                title: item.title,
                shortcut: item.subtitle,
                category: (item.category === 'Symbols' ? 'Symbols' : 'Files') as any,
                filePath: item.file_path,
                lineNumber: item.line_number,
                columnNumber: item.column_number,
                snippet: item.snippet,
                icon: item.symbol_kind,
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
    }, 60); // Low latency debouncing for in-memory index

    return () => clearTimeout(timer);
  }, [query, activeTab, isOpen, projectPath]);

  if (!isOpen) return null;

  const tabs: SearchTab[] = ['All', 'Files', 'Symbols', 'Actions', 'Text'];

  // Combine matching built-in actions + backend search items
  const matchingActions = defaultActions.filter(act => {
    if (activeTab !== 'All' && activeTab !== 'Actions') return false;
    if (!query.trim()) return true;
    return (
      act.title.toLowerCase().includes(query.toLowerCase()) ||
      (act.shortcut && act.shortcut.toLowerCase().includes(query.toLowerCase()))
    );
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
      const step = e.shiftKey ? -1 : 1;
      const nextTabIdx = (tabs.indexOf(activeTab) + step + tabs.length) % tabs.length;
      setActiveTab(tabs[nextTabIdx]);
      setSelectedIndex(0);
    }
  };

  const renderItemIcon = (item: ActionItem) => {
    if (item.category === 'Actions') return <Command size={14} className="text-[#3574F0] shrink-0" />;
    if (item.category === 'Files') return <FileCode size={14} className="text-[#EDA200] shrink-0" />;
    if (item.category === 'Text') return <AlignLeft size={14} className="text-[#3574F0] shrink-0" />;
    
    // Symbols category
    if (item.category === 'Symbols') {
      const kind = (item.icon || '').toLowerCase();
      if (kind.includes('function') || kind.includes('method')) {
        return (
          <span className="w-4 h-4 rounded bg-[#3574F0]/20 text-[#3574F0] font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
            f
          </span>
        );
      }
      if (kind.includes('class') || kind.includes('struct')) {
        return (
          <span className="w-4 h-4 rounded bg-[#9876AA]/20 text-[#C792EA] font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
            C
          </span>
        );
      }
      if (kind.includes('interface') || kind.includes('trait')) {
        return (
          <span className="w-4 h-4 rounded bg-[#59A869]/20 text-[#59A869] font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
            I
          </span>
        );
      }
      if (kind.includes('enum')) {
        return (
          <span className="w-4 h-4 rounded bg-[#E5C07B]/20 text-[#E5C07B] font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
            E
          </span>
        );
      }
      return <Code2 size={14} className="text-[#59A869] shrink-0" />;
    }

    return <Sparkles size={14} className="text-[#3574F0] shrink-0" />;
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-start justify-center pt-20 z-50 select-none"
      onClick={onClose}
    >
      <div 
        className="w-[720px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
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
                {tab === 'Symbols' && (
                  <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-[#3574F0]/20 text-[#3574F0] border border-[#3574F0]/30">
                    Fast
                  </span>
                )}
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
            placeholder={
              activeTab === 'Symbols'
                ? "Search symbols by name (functions, classes, structs, enums)..."
                : activeTab === 'Files'
                ? "Search files by name or path..."
                : "Search everywhere (files, symbols, actions, or text, Tab to switch)..."
            }
            className="flex-1 bg-transparent border-none outline-none text-[#DFE1E5] text-[13px] placeholder-[#6E7178] font-sans"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[#2B2D30] border border-[#393B40] text-[#868A91]">
            ESC
          </kbd>
        </div>

        {/* Search Results */}
        <div className="max-h-[380px] overflow-y-auto py-1">
          {allItems.length === 0 ? (
            <div className="py-12 text-center text-[#868A91] text-[12px]">
              {query ? 'No matching files, symbols, or actions found' : 'Type to instantly search files, code symbols, or actions'}
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
                    {renderItemIcon(item)}
                    
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
          <span>Use ↑ ↓ to navigate, Enter to jump, Tab / Shift+Tab to switch category</span>
          <span className="text-[10px] text-[#A1A3A8]">IntelliJ IDEA Trigram Fast Index</span>
        </div>
      </div>
    </div>
  );
};
