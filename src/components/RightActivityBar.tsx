import React, { useState } from 'react';
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
  MoreVertical
} from 'lucide-react';

interface RightActivityBarProps {
  activeRightPanel: string | null;
  onToggleRightPanel: (panelId: string | null) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const RightActivityBar: React.FC<RightActivityBarProps> = ({
  activeRightPanel,
  onToggleRightPanel,
  onShowToast,
}) => {
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

  const topItems = [
    { id: 'ai', label: 'AI Assistant', icon: Sparkles, color: 'text-[#9876AA]' },
    { id: 'database', label: 'Database', icon: Database, color: 'text-[#3574F0]' },
    { id: 'cargo', label: 'Cargo / Build Tools', icon: Package, color: 'text-[#E5B567]' },
  ];

  const bottomItems = [
    { id: 'notifications', label: 'Notifications', icon: Bell, color: 'text-[#DFE1E5]' },
  ];

  const handleSendAi = () => {
    if (!aiPrompt.trim()) return;
    const userText = aiPrompt.trim();
    setAiMessages(prev => [...prev, { role: 'user', text: userText, time: 'Just now' }]);
    setAiPrompt('');
    setIsAiLoading(true);

    setTimeout(() => {
      setIsAiLoading(false);
      setAiMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: `I analyzed your project files. For "${userText}", I recommend following JetBrains conventions: using type safety in Rust / TypeScript, keeping components pure, and leveraging Monaco keybindings.`,
          time: 'Just now',
        }
      ]);
    }, 800);
  };

  return (
    <div className="flex z-20">
      {/* Sliding Content Drawer for active right panel */}
      {activeRightPanel && (
        <div className="w-[320px] bg-[#1E1F22] border-l border-[#2B2D30] flex flex-col overflow-hidden text-xs select-none">
          {/* Header */}
          <div className="h-8 bg-[#1E1F22] border-b border-[#2B2D30] px-3 flex items-center justify-between text-[#DFE1E5]">
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
                      <div>{msg.text}</div>
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
                    onClick={() => { setAiPrompt('Explain active function'); }}
                    className="px-2 py-0.5 rounded bg-[#1E1F22] hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] border border-[#393B40] text-[10px]"
                  >
                    Explain code
                  </button>
                  <button 
                    onClick={() => { setAiPrompt('Generate unit tests for this module'); }}
                    className="px-2 py-0.5 rounded bg-[#1E1F22] hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] border border-[#393B40] text-[10px]"
                  >
                    Write tests
                  </button>
                  <button 
                    onClick={() => { setAiPrompt('Refactor to improve performance'); }}
                    className="px-2 py-0.5 rounded bg-[#1E1F22] hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] border border-[#393B40] text-[10px]"
                  >
                    Refactor
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
                    onClick={handleSendAi}
                    className="p-1 bg-[#9876AA] hover:bg-[#856396] text-white rounded transition-colors"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* 2. Database Panel */}
            {activeRightPanel === 'database' && (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-[#868A91]">
                  <span>Data Sources and Drivers</span>
                  <button 
                    onClick={() => onShowToast?.('New Data Source', 'Connect to SQLite or PostgreSQL', 'info')}
                    className="text-[#3574F0] hover:underline"
                  >
                    + New
                  </button>
                </div>

                <div className="border border-[#393B40] rounded-lg bg-[#1E1F22] p-2 space-y-1">
                  <div 
                    onClick={() => setExpandedDb(!expandedDb)}
                    className="flex items-center gap-1.5 cursor-pointer text-[#DFE1E5] font-semibold"
                  >
                    {expandedDb ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <Database size={13} className="text-[#3574F0]" />
                    <span>app_database.sqlite</span>
                  </div>

                  {expandedDb && (
                    <div className="pl-5 pt-1 space-y-1 text-[#868A91] font-mono text-[11px]">
                      <div className="flex items-center gap-1.5 text-[#DFE1E5]">
                        <Table size={12} className="text-[#59A869]" />
                        <span>projects (id, name, path)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#DFE1E5]">
                        <Table size={12} className="text-[#59A869]" />
                        <span>settings (key, value)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#DFE1E5]">
                        <Table size={12} className="text-[#59A869]" />
                        <span>recent_files (file_id, timestamp)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Cargo Panel */}
            {activeRightPanel === 'cargo' && (
              <div className="p-3 space-y-3">
                <div className="text-[11px] text-[#868A91]">Cargo Build Tasks</div>
                <div className="space-y-1">
                  {['cargo check', 'cargo build', 'cargo test', 'cargo clippy', 'cargo doc'].map(cmd => (
                    <div 
                      key={cmd}
                      onClick={() => onShowToast?.('Cargo Task', `Executed: ${cmd}`, 'info')}
                      className="p-2 bg-[#1E1F22] hover:bg-[#35373B] border border-[#393B40] rounded cursor-pointer flex items-center justify-between text-xs font-mono text-[#DFE1E5]"
                    >
                      <span>{cmd}</span>
                      <Package size={12} className="text-[#E5B567]" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Notifications Panel */}
            {activeRightPanel === 'notifications' && (
              <div className="p-3 space-y-2">
                <div className="p-2.5 bg-[#1E1F22] border border-[#393B40] rounded-lg">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-white">
                    <span className="flex items-center gap-1.5 text-[#59A869]">
                      <CheckCircle2 size={13} />
                      Project Loaded
                    </span>
                    <span className="text-[#868A91] font-normal text-[10px]">Just now</span>
                  </div>
                  <div className="text-[#868A91] text-[11px] mt-1">
                    Indexing finished successfully. All workspace symbols resolved.
                  </div>
                </div>

                <div className="p-2.5 bg-[#1E1F22] border border-[#393B40] rounded-lg">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-white">
                    <span className="flex items-center gap-1.5 text-[#3574F0]">
                      <Info size={13} />
                      Git Repository
                    </span>
                    <span className="text-[#868A91] font-normal text-[10px]">2m ago</span>
                  </div>
                  <div className="text-[#868A91] text-[11px] mt-1">
                    Branch 'main' synchronized with local working tree.
                  </div>
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
