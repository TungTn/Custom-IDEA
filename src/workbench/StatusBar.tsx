import { NyanProgressBar } from './plugins/NyanProgressBar';
import React, { useState, useEffect, useRef } from 'react';
import { 
  GitBranch, 
  CheckCircle2, 
  RotateCw, 
  Check, 
  Code2, 
  Lock, 
  Unlock, 
  Power, 
  Settings as SettingsIcon,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { BottomBreadcrumbs } from './BottomBreadcrumbs';
import { FileNode } from '../types';
import { usePluginStore } from '../stores/pluginStore';

export interface StatusBarProps {
  branch: string;
  cursorLine: number;
  cursorCol: number;
  encoding?: string;
  lineEnding?: string;
  tabSize?: number;
  useTabs?: boolean;
  isIndexing?: boolean;
  isRunning?: boolean;
  onOpenBranches?: () => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onToggleAi?: () => void;
  editorEngine?: 'monaco' | 'codemirror';
  onToggleEngine?: () => void;
  onSelectTabSize?: (tabSize: number, useTabs?: boolean) => void;
  onSelectLineEnding?: (lineEnding: 'CRLF' | 'LF') => void;
  onSelectEncoding?: (encoding: string) => void;
  onOpenGoToLine?: () => void;
  isReadOnly?: boolean;
  onToggleReadOnly?: () => void;
  languageName?: string;
  filePath?: string;
  projectName?: string;
  projectTree?: FileNode[];
  onSelectFile?: (file: FileNode) => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  branch,
  cursorLine,
  cursorCol,
  encoding = 'UTF-8',
  lineEnding = 'LF',
  tabSize = 4,
  useTabs = false,
  isIndexing = false,
  isRunning = false,
  onOpenBranches,
  onShowToast,
  onToggleAi,
  editorEngine,
  onToggleEngine,
  onSelectTabSize,
  onSelectLineEnding,
  onSelectEncoding,
  onOpenGoToLine,
  isReadOnly = false,
  onToggleReadOnly,
  languageName = 'Vue template',
  filePath,
  projectName = '',
  projectTree = [],
  onSelectFile,
}) => {
  const isPluginActive = usePluginStore(s => s.isPluginActive);
  const isNyanActive = isPluginActive('nyan-progress');
  const isGitToolBoxActive = isPluginActive('git-toolbox');

  const [activePopup, setActivePopup] = useState<'indent' | 'lineEnding' | 'encoding' | 'langServices' | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Click outside listener to close popups
  useEffect(() => {
    if (!activePopup) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setActivePopup(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [activePopup]);

  return (
    <div className="h-6 bg-[#1E1F22] border-t border-[#2B2D30] px-3 flex items-center justify-between text-[11px] text-[#868A91] select-none z-10 relative">
      {/* ─── Left items: Breadcrumbs when file open, else Git branch / Indexing ─── */}
      <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1 mr-2">
        {filePath ? (
          <BottomBreadcrumbs
            filePath={filePath}
            projectName={projectName}
            projectTree={projectTree}
            onSelectFile={onSelectFile}
          />
        ) : (
          <div className="flex items-center gap-3">
            {/* Git branch */}
            <div 
              onClick={onOpenBranches}
              className="flex items-center gap-1.5 hover:text-[#DFE1E5] hover:bg-[#35373B] px-1.5 py-0.5 rounded cursor-pointer transition-colors"
              title={`Current Git Branch: ${branch} (Click to switch or create branch)`}
            >
              <GitBranch size={12} className="text-[#3574F0]" />
              <span className="font-medium text-[#DFE1E5]">{branch || 'main'}</span>
              {isGitToolBoxActive && (
                <span className="text-[10px] text-[#59A869] font-mono ml-0.5" title="GitToolBox: Branch in sync with origin">
                  ↑0 ↓0
                </span>
              )}
            </div>

            {/* Nyan Progress Bar during execution */}
            {isRunning && isNyanActive && (
              <div className="border-l border-[#2B2D30] pl-3">
                <NyanProgressBar label="Running..." />
              </div>
            )}

            {/* Indexing status indicator */}
            <div className="flex items-center gap-1.5 border-l border-[#2B2D30] pl-3">
              {isIndexing ? (
                <span className="flex items-center gap-1.5 text-[#3574F0]">
                  <RotateCw size={11} className="animate-spin" />
                  Scanning project files...
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[#59A869]">
                  <CheckCircle2 size={11} />
                  All files indexed
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Right items (Matching IntelliJ IDEA 100%) ─── */}
      <div className="flex items-center gap-2 font-mono text-[11px] flex-shrink-0">
        {/* Cursor Position (Click to Go to Line:Column) */}
        <span 
          onClick={() => {
            if (onOpenGoToLine) onOpenGoToLine();
            else onShowToast?.('Cursor Position', `Line ${cursorLine}, Column ${cursorCol}`, 'info');
          }}
          className="hover:text-[#DFE1E5] hover:bg-[#35373B] px-1.5 py-0.5 rounded cursor-pointer transition-colors"
          title="Line:Column (Click to open Go to Line/Column dialog)"
        >
          {cursorLine}:{cursorCol}
        </span>

        {/* ─── Language Services Widget (Matching IntelliJ) ─── */}
        <div className="relative border-l border-[#2B2D30] pl-2 flex items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActivePopup(prev => prev === 'langServices' ? null : 'langServices');
            }}
            className={`px-1 py-0.5 rounded hover:bg-[#35373B] transition-colors flex items-center gap-1 text-[#868A91] hover:text-[#DFE1E5] cursor-pointer ${
              activePopup === 'langServices' ? 'bg-[#35373B] text-white' : ''
            }`}
            title="Language Services (ESLint, Vue/TypeScript)"
          >
            <Code2 size={12} className="text-[#DFE1E5]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#E05555] animate-pulse" title="1 problem reported" />
          </button>

          {activePopup === 'langServices' && (
            <div
              ref={popupRef}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-7 right-0 w-64 bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl p-2 z-50 text-xs font-sans text-[#DFE1E5] animate-in fade-in duration-100"
            >
              <div className="px-1 py-0.5 text-[11px] font-semibold text-[#DFE1E5]">
                Language Services
              </div>
              <div className="px-1 pb-1.5 text-[10px] text-[#868A91] border-b border-[#393B40]">
                Running on Current File
              </div>
              <div className="py-1.5 space-y-1">
                {/* ESLint Service Item */}
                <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#35373B]/50 hover:bg-[#35373B] transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-[#4B32C3] flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">ES</span>
                    <span className="text-[11px] text-[#DFE1E5]">ESLint 8.22.0</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#E05555]" title="Errors detected" />
                    <span title="Restart ESLint service" className="flex items-center cursor-pointer">
                      <Power size={11} className="text-[#59A869] hover:opacity-80" />
                    </span>
                    <span title="ESLint Settings" className="flex items-center cursor-pointer">
                      <SettingsIcon size={11} className="text-[#868A91] hover:text-white" />
                    </span>
                  </div>
                </div>

                {/* Vue + TypeScript Service Item */}
                <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#35373B] transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-[#42B883]/20 text-[#42B883] flex items-center justify-center text-[9px] font-bold flex-shrink-0">V</span>
                    <span className="text-[11px] text-[#DFE1E5]">{languageName || 'Vue'} + TypeScript 4.9.5</span>
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#59A869]" title="Service active" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Line Separator Item & Popup ─── */}
        <div className="relative border-l border-[#2B2D30] pl-2">
          <span 
            onClick={(e) => {
              e.stopPropagation();
              setActivePopup(prev => prev === 'lineEnding' ? null : 'lineEnding');
            }}
            className={`hover:text-[#DFE1E5] hover:bg-[#35373B] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
              activePopup === 'lineEnding' ? 'bg-[#35373B] text-white font-medium' : ''
            }`}
            title="Line Separator (Click to change CRLF / LF)"
          >
            {lineEnding}
          </span>

          {activePopup === 'lineEnding' && (
            <div 
              ref={popupRef}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-7 right-0 w-44 bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl p-1 z-50 text-xs font-sans text-[#DFE1E5] animate-in fade-in duration-100"
            >
              <div className="px-2.5 py-1 text-[10px] font-semibold text-[#868A91] uppercase tracking-wider border-b border-[#393B40]">
                Line Separator
              </div>
              <div className="py-1">
                {(['CRLF', 'LF'] as const).map((le) => {
                  const isSelected = lineEnding === le;
                  return (
                    <button
                      key={le}
                      onClick={() => {
                        onSelectLineEnding?.(le);
                        setActivePopup(null);
                      }}
                      className={`w-full px-2.5 py-1 flex items-center justify-between rounded hover:bg-[#3574F0] hover:text-white transition-colors text-left cursor-pointer ${
                        isSelected ? 'text-[#3574F0] font-medium' : ''
                      }`}
                    >
                      <span>{le} {le === 'CRLF' ? <span className="text-[10px] opacity-75">(Windows)</span> : <span className="text-[10px] opacity-75">(macOS/Unix)</span>}</span>
                      {isSelected && <Check size={13} className="text-[#3574F0]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ─── File Encoding Item & Popup (With Add BOM) ─── */}
        <div className="relative border-l border-[#2B2D30] pl-2">
          <span 
            onClick={(e) => {
              e.stopPropagation();
              setActivePopup(prev => prev === 'encoding' ? null : 'encoding');
            }}
            className={`hover:text-[#DFE1E5] hover:bg-[#35373B] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
              activePopup === 'encoding' ? 'bg-[#35373B] text-white font-medium' : ''
            }`}
            title="File Encoding (Click to change)"
          >
            {encoding}
          </span>

          {activePopup === 'encoding' && (
            <div 
              ref={popupRef}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-7 right-0 w-48 bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl p-1.5 z-50 text-xs font-sans text-[#DFE1E5] animate-in fade-in duration-100"
            >
              <div className="px-2 py-0.5 text-[10px] font-semibold text-[#868A91] uppercase tracking-wider border-b border-[#393B40] mb-1">
                File Encoding
              </div>

              {/* Add BOM action button (Matching IntelliJ) */}
              <button
                onClick={() => {
                  onShowToast?.('Byte Order Mark', 'UTF-8 BOM added to current file', 'info');
                  setActivePopup(null);
                }}
                className="w-full py-1 px-2.5 mb-1 bg-[#35373B] hover:bg-[#3574F0] hover:text-white text-[#DFE1E5] text-[11px] rounded text-center font-medium transition-colors cursor-pointer"
              >
                Add BOM
              </button>

              <div className="py-0.5 space-y-0.5">
                {['ISO-8859-1', 'US-ASCII', 'UTF-16', 'UTF-8'].map((enc) => {
                  const isSelected = encoding.toUpperCase() === enc.toUpperCase();
                  return (
                    <button
                      key={enc}
                      onClick={() => {
                        onSelectEncoding?.(enc);
                        setActivePopup(null);
                      }}
                      className={`w-full px-2 py-1 flex items-center justify-between rounded hover:bg-[#3574F0] hover:text-white transition-colors text-left cursor-pointer ${
                        isSelected ? 'text-[#3574F0] font-medium' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E05555]" />
                        <span>{enc}</span>
                      </div>
                      {isSelected && <Check size={13} className="text-[#3574F0]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ─── Indent Spaces Item & Popup (Matching IntelliJ) ─── */}
        <div className="relative border-l border-[#2B2D30] pl-2">
          <span 
            onClick={(e) => {
              e.stopPropagation();
              setActivePopup(prev => prev === 'indent' ? null : 'indent');
            }}
            className={`hover:text-[#DFE1E5] hover:bg-[#35373B] px-1.5 py-0.5 rounded cursor-pointer font-sans transition-colors ${
              activePopup === 'indent' ? 'bg-[#35373B] text-white font-medium' : ''
            }`}
            title="Indentation Settings (Click to change indentation)"
          >
            {useTabs ? 'Tab' : `${tabSize} spaces`}
          </span>

          {activePopup === 'indent' && (
            <div 
              ref={popupRef}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-7 right-0 w-56 bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl p-1.5 z-50 text-xs font-sans text-[#DFE1E5] animate-in fade-in duration-100"
            >
              <div className="px-2 py-1 text-[11px] font-semibold text-[#DFE1E5] border-b border-[#393B40] truncate">
                {languageName ? `${languageName} Code Style` : 'Code Style'}
              </div>

              <div className="py-1">
                {[2, 4, 8].map((size) => {
                  const isSelected = !useTabs && tabSize === size;
                  return (
                    <button
                      key={size}
                      onClick={() => {
                        onSelectTabSize?.(size, false);
                        setActivePopup(null);
                      }}
                      className={`w-full px-2 py-1 flex items-center justify-between rounded hover:bg-[#3574F0] hover:text-white transition-colors text-left cursor-pointer ${
                        isSelected ? 'text-[#3574F0] font-medium' : ''
                      }`}
                    >
                      <span>{size} spaces {size === 4 && <span className="text-[10px] opacity-75">(Standard)</span>}</span>
                      {isSelected && <Check size={13} className="text-[#3574F0]" />}
                    </button>
                  );
                })}
                <div className="my-1 border-t border-[#393B40]" />
                <button
                  onClick={() => {
                    onSelectTabSize?.(tabSize, true);
                    setActivePopup(null);
                  }}
                  className={`w-full px-2 py-1 flex items-center justify-between rounded hover:bg-[#3574F0] hover:text-white transition-colors text-left cursor-pointer ${
                    useTabs ? 'text-[#3574F0] font-medium' : ''
                  }`}
                >
                  <span>Use Tabs</span>
                  {useTabs && <Check size={13} className="text-[#3574F0]" />}
                </button>
                <div className="my-1 border-t border-[#393B40]" />
                <button
                  onClick={() => {
                    setActivePopup(null);
                    onShowToast?.('Code Style Settings', `Configure indentation rules for ${languageName || 'current file'} in Settings`, 'info');
                  }}
                  className="w-full px-2 py-1 rounded text-[11px] text-[#868A91] hover:text-white hover:bg-[#3574F0] text-left transition-colors cursor-pointer truncate"
                >
                  Configure Indents for {languageName || 'Code'}...
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Read-Only Lock Widget (Matching IntelliJ 🔓) ─── */}
        <div 
          onClick={() => {
            if (onToggleReadOnly) {
              onToggleReadOnly();
            } else {
              onShowToast?.('Read-Only Status', isReadOnly ? 'File is read-only' : 'File is editable', 'info');
            }
          }}
          className="border-l border-[#2B2D30] pl-2 pr-0.5 flex items-center cursor-pointer hover:text-white transition-colors"
          title={isReadOnly ? "File is read-only (Click to make writable)" : "File is writable (Click to make read-only)"}
        >
          {isReadOnly ? (
            <Lock size={12} className="text-[#E0A055]" />
          ) : (
            <Unlock size={12} className="text-[#868A91] hover:text-[#DFE1E5]" />
          )}
        </div>
      </div>
    </div>
  );
};
