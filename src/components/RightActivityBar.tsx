import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Database, 
  Package, 
  Bell, 
  X, 
  Send, 
  RefreshCw, 
  Table, 
  Folder, 
  ChevronRight, 
  ChevronDown, 
  CheckCircle2, 
  Info,
  Maximize2,
  Settings,
  MoreVertical,
  AlertTriangle,
  AlertCircle,
  Trash2,
  CheckCheck,
  FileCode,
  Check,
  Clipboard,
  CornerDownLeft
} from 'lucide-react';

import { DataSourceConnection } from '../types/database';
import { DatabaseExplorer } from './database/DatabaseExplorer';
import { BuildToolsPanel } from './BuildToolsPanel';

export interface NotificationEntry {
  id: string;
  title: string;
  message?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

interface RightActivityBarProps {
  activeRightPanel: string | null;
  onToggleRightPanel: (panelId: string | null) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  notifications?: NotificationEntry[];
  onClearNotifications?: () => void;
  onMarkAllNotificationsRead?: () => void;
  onRemoveNotification?: (id: string) => void;
  activeFileName?: string;
  activeFileContent?: string;
  onInsertAtCaret?: (code: string) => void;
  initialAiPrompt?: string;
  dataSources?: DataSourceConnection[];
  onOpenTableData?: (dataSourceId: string, schema: string, tableName: string) => void;
  onOpenSqlConsole?: (dataSourceId: string) => void;
  onAddNewDataSource?: () => void;
  onRemoveDataSource?: (id: string) => void;
  projectPath?: string;
  onExecuteBuildTask?: (tool: string, taskName: string, command: string) => void;
  onExecuteCustomGoal?: (command: string) => void;
}

export const RightActivityBar: React.FC<RightActivityBarProps> = ({
  activeRightPanel,
  onToggleRightPanel,
  onShowToast,
  notifications = [],
  onClearNotifications,
  onMarkAllNotificationsRead,
  onRemoveNotification,
  activeFileName,
  activeFileContent,
  onInsertAtCaret,
  initialAiPrompt,
  dataSources = [],
  onOpenTableData,
  onOpenSqlConsole,
  onAddNewDataSource,
  onRemoveDataSource,
  projectPath,
  onExecuteBuildTask,
  onExecuteCustomGoal,
}) => {
  // Notifications filter state
  const [notifFilter, setNotifFilter] = useState<'all' | 'important' | 'events'>('all');

  // AI Assistant Chat state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiMessages, setAiMessages] = useState<{ role: 'ai' | 'user'; text: string; time: string }[]>([
    {
      role: 'ai',
      text: 'Hello! I am your IntelliJ AI Assistant. How can I help you with your code today?',
      time: 'Just now',
    }
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Database tool window state
  const [expandedDb, setExpandedDb] = useState(true);

  useEffect(() => {
    if (initialAiPrompt && initialAiPrompt.trim()) {
      handleSendAi(initialAiPrompt);
    }
  }, [initialAiPrompt]);

  const topItems = [
    { id: 'ai', label: 'AI Assistant', icon: Sparkles, color: 'text-[#9876AA]' },
    { id: 'database', label: 'Database', icon: Database, color: 'text-[#3574F0]' },
    { id: 'cargo', label: 'Cargo / Build Tools', icon: Package, color: 'text-[#E5B567]' },
  ];

  const bottomItems = [
    { id: 'notifications', label: 'Notifications', icon: Bell, color: 'text-[#DFE1E5]' },
  ];

  const handleSendAi = (customPrompt?: string) => {
    const textToSend = (customPrompt || aiPrompt).trim();
    if (!textToSend) return;
    setAiMessages(prev => [...prev, { role: 'user', text: textToSend, time: 'Just now' }]);
    if (!customPrompt) setAiPrompt('');
    setIsAiLoading(true);

    setTimeout(() => {
      setIsAiLoading(false);
      let response = `I analyzed your project context. For "${textToSend}", following JetBrains coding guidelines: ensure strict type definitions, avoid implicit mutations, and keep modules decoupled.`;
      
      const lower = textToSend.toLowerCase();
      if (lower.includes('explain')) {
        response = activeFileName 
          ? `### Explanation for \`${activeFileName}\`:\nThis component defines key state variables and life-cycle handlers. It adheres to IntelliJ IDEA's modular UI architecture, managing DOM layouts and background events.\n\n\`\`\`typescript\n// Example pattern from ${activeFileName}\nconst handleAction = useCallback(() => {\n  // safe immutable state transition\n}, []);\n\`\`\``
          : 'Place cursor on any file or symbol, or open a tab to get a deep context-aware explanation.';
      } else if (lower.includes('test')) {
        response = `### Unit Tests for \`${activeFileName || 'Module'}\`:\n\`\`\`typescript\ndescribe('${activeFileName || 'Module'}', () => {\n  it('should initialize and process actions correctly', () => {\n    expect(true).toBe(true);\n  });\n\n  it('should handle edge cases and null inputs gracefully', () => {\n    const result = false;\n    expect(result).toBeFalsy();\n  });\n});\n\`\`\``;
      } else if (lower.includes('refactor')) {
        response = `### Refactoring Suggestions:\n1. Extract nested callbacks into named functions.\n2. Leverage useMemo/useCallback for expensive sub-trees.\n3. Add explicit interface contracts for incoming props.\n\n\`\`\`typescript\n// Refactored clean pattern:\nexport const processSafely = <T,>(input: T): T => {\n  if (!input) throw new Error('Invalid input');\n  return Object.freeze({ ...input });\n};\n\`\`\``;
      } else if (lower.includes('bug') || lower.includes('issue')) {
        response = `### Inspection & Bug Analysis for \`${activeFileName || 'Project'}\`:\n- Checked for potential memory leaks in event listeners.\n- Verified proper dependency arrays in React hooks.\n- Ensure optional chaining (\`?.\`) when accessing dynamic properties.`;
      } else if (lower.includes('comment')) {
        response = `### Documented Code Snippet:\n\`\`\`typescript\n/**\n * Executes background process with robust error handling.\n * @param data Input payload\n * @returns Promise resolving to operation status\n */\nasync function execute(data: any): Promise<boolean> {\n  return true;\n}\n\`\`\``;
      }

      setAiMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: response,
          time: 'Just now',
        }
      ]);
    }, 600);
  };

  const renderAiText = (raw: string) => {
    const parts = raw.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const firstLineEnd = part.indexOf('\n');
        const lang = firstLineEnd !== -1 ? part.substring(3, firstLineEnd).trim() : 'code';
        const code = firstLineEnd !== -1 ? part.substring(firstLineEnd + 1, part.length - 3) : part.substring(3, part.length - 3);

        return (
          <div key={i} className="my-2 rounded border border-[#393B40] overflow-hidden bg-[#1E1F22]">
            <div className="flex items-center justify-between px-2.5 py-1 bg-[#26282B] border-b border-[#393B40] text-[10.5px] text-[#868A91] font-mono">
              <span>{lang || 'code'}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(code);
                    onShowToast?.('AI Assistant', 'Code snippet copied to clipboard', 'info');
                  }}
                  className="hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  title="Copy snippet"
                >
                  <Clipboard size={11} />
                  <span>Copy</span>
                </button>
                {onInsertAtCaret && (
                  <button
                    onClick={() => {
                      onInsertAtCaret(code);
                      onShowToast?.('AI Assistant', 'Inserted snippet at caret', 'success');
                    }}
                    className="hover:text-[#59A869] text-[#59A869]/80 flex items-center gap-1 cursor-pointer font-medium transition-colors"
                    title="Insert into active editor file at cursor"
                  >
                    <CornerDownLeft size={11} />
                    <span>Insert</span>
                  </button>
                )}
              </div>
            </div>
            <pre className="p-2 text-[11px] font-mono overflow-x-auto text-[#DFE1E5] leading-relaxed selection:bg-[#214283]">
              <code>{code}</code>
            </pre>
          </div>
        );
      }
      return <span key={i} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  const filteredNotifs = notifications.filter(n => {
    if (notifFilter === 'important') return n.type === 'error' || n.type === 'warning';
    if (notifFilter === 'events') return n.type === 'info' || n.type === 'success';
    return true;
  });

  const importantCount = notifications.filter(n => n.type === 'error' || n.type === 'warning').length;
  const eventsCount = notifications.filter(n => n.type === 'info' || n.type === 'success').length;

  return (
    <div className="flex z-20">
      {/* Sliding Content Drawer for active right panel */}
      {activeRightPanel && (
        <div className="w-[330px] bg-[#1E1F22] border-l border-[#2B2D30] flex flex-col overflow-hidden text-xs select-none">
          {/* Header */}
          <div className="h-9 bg-[#1E1F22] border-b border-[#2B2D30] px-3 flex items-center justify-between text-[#DFE1E5]">
            <div className="flex items-center gap-2 font-semibold">
              {activeRightPanel === 'ai' && (
                <>
                  <Sparkles size={14} className="text-[#9876AA]" />
                  <span>AI Assistant</span>
                </>
              )}
              {activeRightPanel === 'database' && (
                <>
                  <Database size={14} className="text-[#3574F0]" />
                  <span>Database</span>
                </>
              )}
              {activeRightPanel === 'cargo' && (
                <>
                  <Package size={14} className="text-[#E5B567]" />
                  <span>Cargo / Build</span>
                </>
              )}
              {activeRightPanel === 'notifications' && (
                <>
                  <Bell size={14} className="text-[#3574F0]" />
                  <span>Notifications</span>
                  {notifications.some(n => !n.read) && (
                    <span className="px-1.5 py-0.2 bg-[#3574F0] text-white text-[10px] font-bold rounded-full">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={() => onToggleRightPanel(null)}
                className="p-1 hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] rounded cursor-pointer"
                title="Hide Tool Window"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto">
            {/* 1. AI Assistant Panel */}
            {activeRightPanel === 'ai' && (
              <div className="h-full flex flex-col justify-between p-3 space-y-3">
                {/* Active Context Banner */}
                <div className="px-2.5 py-1.5 bg-[#25272B] border border-[#393B40] rounded flex items-center justify-between text-[11px] text-[#A1A3A8]">
                  <div className="flex items-center gap-1.5 truncate">
                    <FileCode size={12} className="text-[#9876AA]" />
                    <span className="truncate">Context: <strong className="text-white">{activeFileName || 'Workspace'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#59A869] font-mono">Ready</span>
                    <button
                      onClick={() => setAiMessages([{
                        role: 'ai',
                        text: 'Chat history cleared. How can I help you with your code?',
                        time: 'Just now'
                      }])}
                      title="Clear chat history"
                      className="text-[#868A91] hover:text-[#DFE1E5] p-0.5 rounded cursor-pointer"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {aiMessages.map((msg, idx) => (
                    <div 
                      key={idx} 
                      className={`p-2.5 rounded-lg text-xs leading-relaxed ${
                        msg.role === 'ai' 
                          ? 'bg-[#1E1F22] border border-[#393B40] text-[#DFE1E5]' 
                          : 'bg-[#2E436E] text-white ml-4'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-[#868A91] mb-1">
                        <span className="font-semibold text-[#A1A3A8]">{msg.role === 'ai' ? 'IntelliJ AI' : 'You'}</span>
                        <span>{msg.time}</span>
                      </div>
                      <div>{renderAiText(msg.text)}</div>
                    </div>
                  ))}
                  {isAiLoading && (
                    <div className="p-2.5 bg-[#1E1F22] border border-[#393B40] rounded-lg text-xs text-[#868A91] flex items-center gap-2">
                      <RefreshCw size={13} className="animate-spin text-[#9876AA]" />
                      <span>Generating response...</span>
                    </div>
                  )}
                </div>

                {/* Quick Prompts */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#393B40]/50">
                  <button 
                    onClick={() => handleSendAi(`Explain code in ${activeFileName || 'active file'}`)}
                    className="px-2 py-0.5 rounded bg-[#1E1F22] hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] border border-[#393B40] text-[10px] cursor-pointer"
                  >
                    Explain code
                  </button>
                  <button 
                    onClick={() => handleSendAi(`Generate unit tests for ${activeFileName || 'module'}`)}
                    className="px-2 py-0.5 rounded bg-[#1E1F22] hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] border border-[#393B40] text-[10px] cursor-pointer"
                  >
                    Write tests
                  </button>
                  <button 
                    onClick={() => handleSendAi('Refactor to improve performance and clarity')}
                    className="px-2 py-0.5 rounded bg-[#1E1F22] hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] border border-[#393B40] text-[10px] cursor-pointer"
                  >
                    Refactor
                  </button>
                  <button 
                    onClick={() => handleSendAi(`Find potential bugs and edge cases in ${activeFileName || 'active file'}`)}
                    className="px-2 py-0.5 rounded bg-[#1E1F22] hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] border border-[#393B40] text-[10px] cursor-pointer"
                  >
                    Find bugs
                  </button>
                  <button 
                    onClick={() => handleSendAi('Add documentation and JSDoc comments to public symbols')}
                    className="px-2 py-0.5 rounded bg-[#1E1F22] hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] border border-[#393B40] text-[10px] cursor-pointer"
                  >
                    Add comments
                  </button>
                </div>

                {/* Input box */}
                <div className="flex items-center gap-2 bg-[#1E1F22] border border-[#393B40] focus-within:border-[#9876AA] rounded-md px-2 py-1.5">
                  <input
                    type="text"
                    placeholder="Ask AI Assistant (Alt+Enter)..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendAi(); }}
                    className="flex-1 bg-transparent text-xs text-[#DFE1E5] placeholder:text-[#868A91] outline-none"
                  />
                  <button 
                    onClick={() => handleSendAi()}
                    className="p-1 bg-[#9876AA] hover:bg-[#856396] text-white rounded transition-colors cursor-pointer"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* 2. Database Panel (DataGrip) */}
            {activeRightPanel === 'database' && (
              <div className="h-full">
                <DatabaseExplorer
                  dataSources={dataSources}
                  onOpenTableData={onOpenTableData || (() => {})}
                  onOpenSqlConsole={onOpenSqlConsole || (() => {})}
                  onAddNewDataSource={onAddNewDataSource || (() => {})}
                  onRemoveDataSource={onRemoveDataSource}
                  onShowToast={onShowToast}
                />
              </div>
            )}

            {/* 3. Build Tools Panel (Cargo / NPM / Maven / Gradle) */}
            {activeRightPanel === 'cargo' && (
              <div className="h-full">
                <BuildToolsPanel
                  projectPath={projectPath}
                  onExecuteTask={onExecuteBuildTask || ((tool, task, cmd) => onShowToast?.('Build Task', `Running: ${cmd}`, 'info'))}
                  onExecuteCustomGoal={onExecuteCustomGoal || ((cmd) => onShowToast?.('Build Goal', `Running: ${cmd}`, 'info'))}
                  onShowToast={onShowToast}
                  onClose={() => onToggleRightPanel(null)}
                />
              </div>
            )}

            {/* 4. Notifications Panel */}
            {activeRightPanel === 'notifications' && (
              <div className="h-full flex flex-col">
                {/* Notification Toolbar */}
                <div className="px-3 py-2 border-b border-[#2B2D30] bg-[#1E1F22] flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setNotifFilter('all')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                        notifFilter === 'all' 
                          ? 'bg-[#2B2D30] text-white' 
                          : 'text-[#868A91] hover:text-[#DFE1E5]'
                      }`}
                    >
                      All ({notifications.length})
                    </button>
                    <button
                      onClick={() => setNotifFilter('important')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                        notifFilter === 'important' 
                          ? 'bg-[#2B2D30] text-[#E5B567]' 
                          : 'text-[#868A91] hover:text-[#DFE1E5]'
                      }`}
                    >
                      Important ({importantCount})
                    </button>
                    <button
                      onClick={() => setNotifFilter('events')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                        notifFilter === 'events' 
                          ? 'bg-[#2B2D30] text-[#3574F0]' 
                          : 'text-[#868A91] hover:text-[#DFE1E5]'
                      }`}
                    >
                      Events ({eventsCount})
                    </button>
                  </div>

                  <div className="flex items-center gap-1 text-[#868A91]">
                    <button
                      onClick={onMarkAllNotificationsRead}
                      title="Mark all as read"
                      className="p-1 hover:bg-[#2B2D30] hover:text-[#DFE1E5] rounded transition-colors cursor-pointer"
                    >
                      <CheckCheck size={13} />
                    </button>
                    <button
                      onClick={onClearNotifications}
                      title="Clear all notifications"
                      className="p-1 hover:bg-[#2B2D30] hover:text-[#E05555] rounded transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {filteredNotifs.length > 0 ? (
                    filteredNotifs.map((n) => (
                      <div 
                        key={n.id} 
                        className={`p-2.5 rounded-lg border transition-colors relative group ${
                          n.read 
                            ? 'bg-[#1E1F22] border-[#2B2D30] text-[#DFE1E5]' 
                            : 'bg-[#25272B] border-[#393B40] text-white shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-semibold text-[11px] truncate">
                            {n.type === 'error' && <AlertCircle size={13} className="text-[#E05555] shrink-0" />}
                            {n.type === 'warning' && <AlertTriangle size={13} className="text-[#E5B567] shrink-0" />}
                            {n.type === 'success' && <CheckCircle2 size={13} className="text-[#59A869] shrink-0" />}
                            {n.type === 'info' && <Info size={13} className="text-[#3574F0] shrink-0" />}
                            <span className="truncate">{n.title}</span>
                            {!n.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#3574F0] shrink-0" />
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[#868A91] whitespace-nowrap">{n.timestamp}</span>
                            <button
                              onClick={() => onRemoveNotification?.(n.id)}
                              title="Dismiss"
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] rounded transition-opacity cursor-pointer"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>

                        {n.message && (
                          <div className="text-[#868A91] text-[11px] mt-1 leading-relaxed break-words pl-4">
                            {n.message}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center p-6 text-[#868A91]">
                      <Bell size={28} className="text-[#393B40] mb-2" />
                      <div className="font-medium text-xs text-[#DFE1E5]">No Notifications</div>
                      <div className="text-[11px] text-[#868A91] mt-1">
                        IDE events and background task logs will appear here.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right Vertical Stripe Bar (Width: 40px) */}
      <div className="w-10 bg-[#1E1F22] border-l border-[#2B2D30] flex flex-col justify-between py-2 select-none">
        {/* Top items */}
        <div className="flex flex-col items-center gap-1">
          {topItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeRightPanel === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onToggleRightPanel(isActive ? null : item.id)}
                title={item.label}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors relative cursor-pointer ${
                  isActive 
                    ? 'bg-[#2B2D30] text-white' 
                    : `${item.color} hover:bg-[#2B2D30]/60`
                }`}
              >
                <Icon size={16} />
                {isActive && (
                  <div className="absolute right-0 top-1.5 bottom-1.5 w-[3px] bg-[#3574F0] rounded-l" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom items */}
        <div className="flex flex-col items-center gap-1">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeRightPanel === item.id;
            const hasUnread = item.id === 'notifications' && notifications.some(n => !n.read);
            return (
              <button
                key={item.id}
                onClick={() => onToggleRightPanel(isActive ? null : item.id)}
                title={item.label}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors relative cursor-pointer ${
                  isActive 
                    ? 'bg-[#2B2D30] text-white' 
                    : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60'
                }`}
              >
                <Icon size={16} />
                {hasUnread && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#3574F0] ring-2 ring-[#1E1F22]" />
                )}
                {isActive && (
                  <div className="absolute right-0 top-1.5 bottom-1.5 w-[3px] bg-[#3574F0] rounded-l" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
