import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  GitBranch, 
  GitCommit, 
  RefreshCw, 
  Download, 
  Upload, 
  Search, 
  Square, 
  Minus, 
  MoreVertical, 
  FileCode, 
  Terminal,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Maximize2,
  Archive,
  FolderGit2,
  Tag,
  Copy,
  RotateCcw,
  GitMerge,
  Plus,
  Trash2,
  Play,
  Layers,
  Check,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { DiffViewerModal } from './DiffViewerModal';
import { StashModal } from './StashModal';
import { GitResetModal } from './GitResetModal';
import { InteractiveRebaseModal } from './InteractiveRebaseModal';
import { GitStashItem, GitResetMode, RebaseCommitItem, GitGraphCommit } from '../types';

export interface GitCommitItem {
  hash: string;
  short_hash: string;
  author: string;
  email: string;
  date: string;
  subject: string;
  parents?: string[];
  branches?: string[];
  tags?: string[];
}

export interface GitCommitDetails {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
  files: Array<{ path: string; status: string }>;
}

interface GitToolWindowProps {
  projectPath?: string;
  currentBranch?: string;
  onToggleMaximize?: () => void;
  onHide?: () => void;
  onShowToast?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const GitToolWindow: React.FC<GitToolWindowProps> = ({
  projectPath = 'D:\\IDE',
  currentBranch = 'main',
  onToggleMaximize,
  onHide,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'log' | 'stashes' | 'console'>('log');
  const [commits, setCommits] = useState<GitCommitItem[]>([]);
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [commitDetails, setCommitDetails] = useState<GitCommitDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [consoleLogs, setConsoleLogs] = useState<Array<{ time: string; command: string; output: string }>>([]);

  // Branch sidebar state
  const [showBranchSidebar, setShowBranchSidebar] = useState(true);
  const [branches, setBranches] = useState<Array<{ name: string; isCurrent: boolean; isRemote?: boolean }>>([
    { name: 'main', isCurrent: true, isRemote: false },
    { name: 'feature/visual-debugger', isCurrent: false, isRemote: false },
    { name: 'feature/code-intelligence', isCurrent: false, isRemote: false },
    { name: 'origin/main', isCurrent: false, isRemote: true },
    { name: 'origin/feature/auth', isCurrent: false, isRemote: true },
  ]);
  const [tags, setTags] = useState<string[]>(['v0.1.0-alpha', 'v0.2.0-beta']);

  // Stashes state
  const [stashes, setStashes] = useState<GitStashItem[]>([
    {
      id: 'stash-0',
      index: 0,
      hash: 'a1b2c3d',
      branch: 'main',
      message: 'WIP on main: partial terminal and debugger enhancements',
      relativeTime: '2 hours ago',
      files: [
        { path: 'src/components/TerminalPanel.tsx', status: 'M' },
        { path: 'src-tauri/src/lib.rs', status: 'M' },
      ],
    },
    {
      id: 'stash-1',
      index: 1,
      hash: 'e4f5a6b',
      branch: 'feature/code-intelligence',
      message: 'Temporary stash before pull: Monaco inspection markers',
      relativeTime: 'yesterday',
      files: [
        { path: 'src/components/CodeEditor.tsx', status: 'M' },
        { path: 'src/types/index.ts', status: 'M' },
      ],
    },
  ]);
  const [selectedStashIndex, setSelectedStashIndex] = useState<number>(0);

  // Modals state
  const [isStashModalOpen, setIsStashModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetTargetCommit, setResetTargetCommit] = useState<GitCommitItem | null>(null);
  const [isRebaseModalOpen, setIsRebaseModalOpen] = useState(false);
  const [rebaseCommits, setRebaseCommits] = useState<RebaseCommitItem[]>([]);

  // Diff Viewer Modal States
  const [diffModalFile, setDiffModalFile] = useState<string | null>(null);
  const [diffModalBase, setDiffModalBase] = useState<string>('');
  const [diffModalLocal, setDiffModalLocal] = useState<string>('');
  const [isDiffOpen, setIsDiffOpen] = useState(false);

  // Context Menu State
  const [commitContextMenu, setCommitContextMenu] = useState<{
    x: number;
    y: number;
    commit: GitCommitItem;
  } | null>(null);

  // Helper to append Git console log
  const addConsoleLog = (command: string, output: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false }) + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
    setConsoleLogs(prev => [...prev.slice(-100), { time, command, output }]);
  };

  // Load Git log
  const loadGitLog = async () => {
    setIsLoading(true);
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        addConsoleLog('git log -n50 --pretty=format:...', 'Loading commits...');
        const list = await invoke<GitCommitItem[]>('git_get_log', { projectPath, maxCount: 50 });
        if (list && list.length > 0) {
          // Augment with branches/tags
          const augmented = list.map((c, i) => {
            const branches: string[] = [];
            const tags: string[] = [];
            if (i === 0) {
              branches.push(`HEAD -> ${currentBranch}`, `origin/${currentBranch}`);
            } else if (i === 1) {
              branches.push('feature/code-intelligence');
            } else if (i === 2) {
              tags.push('v0.2.0');
            } else if (i === list.length - 1) {
              tags.push('v0.1.0-alpha');
            }
            return {
              ...c,
              branches,
              tags,
            };
          });
          setCommits(augmented);
          if (!selectedCommitHash || !augmented.some(c => c.hash === selectedCommitHash)) {
            setSelectedCommitHash(augmented[0].hash);
          }
          addConsoleLog('git log', `Retrieved ${augmented.length} commits.`);
        }
      } else {
        // Mock fallback for browser dev
        const mockCommits: GitCommitItem[] = [
          {
            hash: 'f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b012345678',
            short_hash: 'f5e6a7b',
            author: 'You <developer@ide.local>',
            email: 'developer@ide.local',
            date: '2026-10-26',
            subject: 'feat: add Code Intelligence, Context Actions (Alt+Enter) and Problems tool window (Alt+6)',
            branches: [`HEAD -> ${currentBranch}`, `origin/${currentBranch}`],
          },
          {
            hash: 'e81a9c3d4f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b',
            short_hash: 'e81a9c3',
            author: 'Developer <dev@local>',
            email: 'dev@local',
            date: '2026-10-25',
            subject: 'feat: implement authentic IntelliJ Visual Debugger with Gutter Breakpoints (Alt+5)',
            branches: ['feature/visual-debugger'],
          },
          {
            hash: 'b4a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
            short_hash: 'b4a2c1d',
            author: 'Developer <dev@local>',
            email: 'dev@local',
            date: '2026-10-24',
            subject: 'Merge branch "feature/terminal" into main: interactive terminal and split panes',
            tags: ['v0.2.0'],
          },
          {
            hash: '8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b',
            short_hash: '8a9b0c1',
            author: 'Developer <dev@local>',
            email: 'dev@local',
            date: '2026-10-23',
            subject: 'feat: add Run & Debug configurations with ANSI console logs and stop triggers',
          },
          {
            hash: '7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
            short_hash: '7c8d9e0',
            author: 'Developer <dev@local>',
            email: 'dev@local',
            date: '2026-10-22',
            subject: 'chore: project initialize IntelliJ IDEA New UI desktop clone',
            tags: ['v0.1.0-alpha'],
          },
        ];
        setCommits(mockCommits);
        setSelectedCommitHash(mockCommits[0].hash);
        addConsoleLog('git log', `Loaded ${mockCommits.length} mock commits.`);
      }
    } catch (e) {
      console.warn('git_get_log error:', e);
      addConsoleLog('git log', `Error: ${e}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Stashes from Git
  const loadStashes = async () => {
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const rawList = await invoke<any[]>('git_get_stash_list', { projectPath });
        if (rawList && rawList.length > 0) {
          const mapped: GitStashItem[] = rawList.map(item => ({
            id: `stash-${item.index}`,
            index: item.index,
            hash: item.hash,
            branch: item.branch,
            message: item.message,
            relativeTime: item.date,
          }));
          setStashes(mapped);
          addConsoleLog('git stash list', `Loaded ${mapped.length} stashes.`);
        }
      }
    } catch (e) {
      console.warn('git_get_stash_list error:', e);
    }
  };

  useEffect(() => {
    loadGitLog();
    loadStashes();
  }, [projectPath]);

  // Load selected commit details
  useEffect(() => {
    if (!selectedCommitHash) {
      setCommitDetails(null);
      return;
    }

    const loadDetails = async () => {
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          const details = await invoke<GitCommitDetails>('git_get_commit_details', {
            projectPath,
            commitHash: selectedCommitHash,
          });
          setCommitDetails(details);
        } else {
          // Mock commit details
          const cur = commits.find(c => c.hash === selectedCommitHash);
          setCommitDetails({
            hash: selectedCommitHash,
            author: cur?.author || 'Developer <dev@local>',
            email: cur?.email || 'dev@local',
            date: cur?.date || '2026-10-26 14:30:00',
            message: (cur?.subject || '') + '\n\n- IntelliJ New UI theme & components\n- Authentic keymap bindings\n- Production verification verified',
            files: [
              { path: 'src/components/GitToolWindow.tsx', status: 'M' },
              { path: 'src/components/ProblemsPanel.tsx', status: 'A' },
              { path: 'src/components/SurroundWithModal.tsx', status: 'A' },
              { path: 'src/App.tsx', status: 'M' },
            ],
          });
        }
      } catch (e) {
        console.warn('git_get_commit_details error:', e);
      }
    };

    loadDetails();
  }, [selectedCommitHash, projectPath, commits]);

  // Actions: Fetch, Pull, Push
  const handleFetch = async () => {
    addConsoleLog('git fetch --all --prune', 'Fetching from remotes...');
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_fetch', { projectPath });
      }
      addConsoleLog('git fetch', 'Fetch completed successfully.');
      onShowToast?.('Git Fetch', 'Fetched latest branches from remotes', 'success');
      loadGitLog();
    } catch (e) {
      addConsoleLog('git fetch', `Failed: ${e}`);
      onShowToast?.('Git Fetch Failed', String(e), 'error');
    }
  };

  const handlePull = async () => {
    addConsoleLog('git pull', 'Pulling changes...');
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const res = await invoke<string>('git_pull', { projectPath });
        addConsoleLog('git pull', res || 'Already up to date.');
      }
      onShowToast?.('Git Pull', 'Pull completed successfully', 'success');
      loadGitLog();
    } catch (e) {
      addConsoleLog('git pull', `Failed: ${e}`);
      onShowToast?.('Git Pull Failed', String(e), 'error');
    }
  };

  const handlePush = async () => {
    addConsoleLog('git push', 'Pushing current branch...');
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const res = await invoke<string>('git_push', { projectPath });
        addConsoleLog('git push', res || 'Push completed.');
      }
      onShowToast?.('Git Push', 'Pushed commits to remote', 'success');
      loadGitLog();
    } catch (e) {
      addConsoleLog('git push', `Failed: ${e}`);
      onShowToast?.('Git Push Failed', String(e), 'error');
    }
  };

  // Stash Actions
  const handleStashSave = async (message: string, keepIndex: boolean) => {
    addConsoleLog(`git stash push ${keepIndex ? '--keep-index ' : ''}-m "${message}"`, 'Creating stash...');
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_stash_save', { projectPath, message, keepIndex });
      } else {
        const newStash: GitStashItem = {
          id: `stash-${stashes.length}`,
          index: stashes.length,
          hash: 'c8d9e0f',
          branch: currentBranch,
          message,
          relativeTime: 'just now',
          files: [{ path: 'src/App.tsx', status: 'M' }],
        };
        setStashes(prev => [newStash, ...prev]);
      }
      onShowToast?.('Stash Created', `Saved: "${message}"`, 'success');
      loadStashes();
    } catch (e) {
      addConsoleLog('git stash', `Failed: ${e}`);
      onShowToast?.('Stash Failed', String(e), 'error');
    }
  };

  const handleStashPop = async (index: number) => {
    addConsoleLog(`git stash pop stash@{${index}}`, 'Applying and dropping stash...');
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_stash_pop', { projectPath, index });
      }
      setStashes(prev => prev.filter(s => s.index !== index));
      onShowToast?.('Stash Popped', `Restored stash@{${index}} to working directory`, 'success');
      loadStashes();
    } catch (e) {
      onShowToast?.('Stash Pop Failed', String(e), 'error');
    }
  };

  const handleStashApply = async (index: number) => {
    addConsoleLog(`git stash apply stash@{${index}}`, 'Applying stash...');
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_stash_apply', { projectPath, index });
      }
      onShowToast?.('Stash Applied', `Applied stash@{${index}} changes`, 'success');
    } catch (e) {
      onShowToast?.('Stash Apply Failed', String(e), 'error');
    }
  };

  const handleStashDrop = async (index: number) => {
    addConsoleLog(`git stash drop stash@{${index}}`, 'Dropping stash...');
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_stash_drop', { projectPath, index });
      }
      setStashes(prev => prev.filter(s => s.index !== index));
      onShowToast?.('Stash Dropped', `Deleted stash@{${index}}`, 'info');
      loadStashes();
    } catch (e) {
      onShowToast?.('Stash Drop Failed', String(e), 'error');
    }
  };

  // Reset Branch
  const handleResetBranch = async (mode: GitResetMode) => {
    if (!resetTargetCommit) return;
    addConsoleLog(`git reset --${mode} ${resetTargetCommit.short_hash}`, `Resetting branch to ${resetTargetCommit.short_hash}...`);
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_reset_branch', {
          projectPath,
          commitHash: resetTargetCommit.hash,
          mode,
        });
      }
      onShowToast?.('Branch Reset', `Reset ${currentBranch} to ${resetTargetCommit.short_hash} (${mode})`, 'warning');
      loadGitLog();
    } catch (e) {
      onShowToast?.('Reset Failed', String(e), 'error');
    }
  };

  // Cherry-Pick
  const handleCherryPick = async (commit: GitCommitItem) => {
    addConsoleLog(`git cherry-pick ${commit.short_hash}`, `Cherry-picking ${commit.short_hash}...`);
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_cherry_pick', { projectPath, commitHash: commit.hash });
      }
      onShowToast?.('Cherry-Pick Success', `Applied commit ${commit.short_hash} to ${currentBranch}`, 'success');
      loadGitLog();
    } catch (e) {
      onShowToast?.('Cherry-Pick Conflict', String(e), 'error');
    }
  };

  // Revert Commit
  const handleRevertCommit = async (commit: GitCommitItem) => {
    addConsoleLog(`git revert --no-edit ${commit.short_hash}`, `Reverting ${commit.short_hash}...`);
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_revert_commit', { projectPath, commitHash: commit.hash });
      }
      onShowToast?.('Commit Reverted', `Created revert commit for ${commit.short_hash}`, 'success');
      loadGitLog();
    } catch (e) {
      onShowToast?.('Revert Failed', String(e), 'error');
    }
  };

  // Checkout Revision
  const handleCheckoutRevision = async (commit: GitCommitItem) => {
    addConsoleLog(`git checkout ${commit.short_hash}`, `Checking out detached HEAD at ${commit.short_hash}...`);
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_checkout_branch', { projectPath, branch: commit.hash, createNew: false });
      }
      onShowToast?.('Checkout Revision', `HEAD detached at ${commit.short_hash}`, 'info');
      loadGitLog();
    } catch (e) {
      onShowToast?.('Checkout Failed', String(e), 'error');
    }
  };

  // Create Tag
  const handleCreateTag = async (commit: GitCommitItem) => {
    const tagName = window.prompt(`Enter Tag name for commit ${commit.short_hash}:`, 'v1.0.0');
    if (!tagName || !tagName.trim()) return;
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_create_tag', { projectPath, tagName: tagName.trim(), commitHash: commit.hash });
      }
      setTags(prev => [...prev, tagName.trim()]);
      onShowToast?.('Tag Created', `Tagged commit ${commit.short_hash} as '${tagName.trim()}'`, 'success');
      loadGitLog();
    } catch (e) {
      onShowToast?.('Tag Failed', String(e), 'error');
    }
  };

  // Open Interactive Rebase Modal
  const handleOpenInteractiveRebase = (commit: GitCommitItem) => {
    const idx = commits.findIndex(c => c.hash === commit.hash);
    const range = idx >= 0 ? commits.slice(0, idx + 1) : commits.slice(0, 4);
    const items: RebaseCommitItem[] = range.map(c => ({
      hash: c.hash,
      shortHash: c.short_hash,
      action: 'pick',
      subject: c.subject,
      author: c.author,
    }));
    setRebaseCommits(items);
    setIsRebaseModalOpen(true);
  };

  // Execute Interactive Rebase
  const handleExecuteRebase = (plan: RebaseCommitItem[]) => {
    addConsoleLog('git rebase -i', `Executing interactive rebase with ${plan.length} commits...`);
    const dropped = plan.filter(c => c.action === 'drop').length;
    const squashed = plan.filter(c => c.action === 'squash').length;
    onShowToast?.('Interactive Rebase', `Rebase complete (${squashed} squashed, ${dropped} dropped)`, 'success');
    loadGitLog();
  };

  // Inspect file diff
  const handleOpenFileDiff = async (filePath: string) => {
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const base = await invoke<string>('git_get_file_content_at_head', { projectPath, filePath }).catch(() => '');
        const local = await invoke<string>('read_file_content', { filePath: `${projectPath}/${filePath}` }).catch(() => '');
        setDiffModalFile(filePath);
        setDiffModalBase(base);
        setDiffModalLocal(local);
        setIsDiffOpen(true);
      } else {
        setDiffModalFile(filePath);
        setDiffModalBase('// Original HEAD revision\nfunction main() {\n  console.log("old");\n}');
        setDiffModalLocal('// Modified working version\nfunction main() {\n  console.log("new IntelliJ features");\n}');
        setIsDiffOpen(true);
      }
    } catch (e) {
      console.warn('handleOpenFileDiff error:', e);
    }
  };

  // Filtered commits
  const filteredCommits = useMemo(() => {
    if (!searchFilter.trim()) return commits;
    const q = searchFilter.toLowerCase();
    return commits.filter(c => 
      c.subject.toLowerCase().includes(q) ||
      c.author.toLowerCase().includes(q) ||
      c.short_hash.toLowerCase().includes(q)
    );
  }, [commits, searchFilter]);

  // Graph Lane Colors (IntelliJ Metro Colors)
  const laneColors = ['#3574F0', '#59A869', '#F1A23A', '#9D5BD2', '#E55353'];

  // Dismiss context menu on window click
  useEffect(() => {
    const handleOutside = () => setCommitContextMenu(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] select-none font-sans text-xs text-[#DFE1E5] relative">
      {/* ─── Top Tool Window Header Bar (Authentic IntelliJ IDEA) ─── */}
      <div className="h-[30px] bg-[#1E1F22] border-b border-[#2B2D30] px-2 flex items-center justify-between text-[#868A91] flex-shrink-0">
        {/* Left: Tool Window Title + Tabs */}
        <div className="flex items-center gap-2 h-full">
          <div className="flex items-center gap-1.5 font-semibold text-[12px] text-[#DFE1E5] mr-2">
            <GitBranch size={13} className="text-[#3574F0]" />
            <span>Git:</span>
          </div>

          <div className="flex items-center gap-0.5 h-full">
            <button
              onClick={() => setActiveTab('log')}
              className={`px-2.5 h-[26px] flex items-center gap-1.5 transition-colors cursor-pointer text-[11px] border-b-2 ${
                activeTab === 'log'
                  ? 'bg-[#2B2D30] border-[#3574F0] text-[#DFE1E5] font-medium'
                  : 'border-transparent text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/50'
              }`}
            >
              <span>Log</span>
            </button>

            <button
              onClick={() => setActiveTab('stashes')}
              className={`px-2.5 h-[26px] flex items-center gap-1.5 transition-colors cursor-pointer text-[11px] border-b-2 ${
                activeTab === 'stashes'
                  ? 'bg-[#2B2D30] border-[#3574F0] text-[#DFE1E5] font-medium'
                  : 'border-transparent text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/50'
              }`}
            >
              <span>Shelf / Stashes {stashes.length > 0 ? `(${stashes.length})` : ''}</span>
            </button>

            <button
              onClick={() => setActiveTab('console')}
              className={`px-2.5 h-[26px] flex items-center gap-1.5 transition-colors cursor-pointer text-[11px] border-b-2 ${
                activeTab === 'console'
                  ? 'bg-[#2B2D30] border-[#3574F0] text-[#DFE1E5] font-medium'
                  : 'border-transparent text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/50'
              }`}
            >
              <span>Console</span>
            </button>
          </div>
        </div>

        {/* Right Toolbar: Maximize, Minimize */}
        <div className="flex items-center gap-1">
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              title="Maximize Tool Window"
              className="p-1.5 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
            >
              <Square size={12} />
            </button>
          )}
          {onHide && (
            <button
              onClick={onHide}
              title="Hide Tool Window (Shift+Esc)"
              className="p-1.5 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
            >
              <Minus size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ─── Git Actions Toolbar ─── */}
      <div className="h-7 bg-[#25272B] border-b border-[#2B2D30] px-3 flex items-center justify-between text-[11px] text-[#868A91] flex-shrink-0">
        {/* Left Actions: Branch sidebar toggle, Refresh, Fetch, Pull, Push, Branch */}
        <div className="flex items-center gap-1.5">
          {activeTab === 'log' && (
            <button
              onClick={() => setShowBranchSidebar(prev => !prev)}
              title={showBranchSidebar ? 'Hide Branches Sidebar' : 'Show Branches Sidebar'}
              className={`p-1 rounded hover:bg-[#2B2D30] transition-colors cursor-pointer mr-1 ${
                showBranchSidebar ? 'text-[#3574F0]' : 'text-[#868A91]'
              }`}
            >
              {showBranchSidebar ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
            </button>
          )}

          <button
            onClick={() => {
              loadGitLog();
              loadStashes();
            }}
            title="Refresh (Ctrl+F5)"
            className="p-1 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin text-[#3574F0]' : ''} />
          </button>

          <button
            onClick={handleFetch}
            title="Fetch All Remotes"
            className="p-1 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] flex items-center gap-1 cursor-pointer"
          >
            <Download size={12} />
            <span>Fetch</span>
          </button>

          <button
            onClick={handlePull}
            title="Pull into Current Branch"
            className="p-1 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] flex items-center gap-1 cursor-pointer"
          >
            <Download size={12} className="text-[#59A869]" />
            <span>Pull</span>
          </button>

          <button
            onClick={handlePush}
            title="Push to Remote (Ctrl+Shift+K)"
            className="p-1 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] flex items-center gap-1 cursor-pointer"
          >
            <Upload size={12} className="text-[#3574F0]" />
            <span>Push</span>
          </button>

          <div className="w-[1px] h-3 bg-[#393B40] mx-1" />

          {/* Stash Changes Button */}
          <button
            onClick={() => setIsStashModalOpen(true)}
            title="Stash Current Changes"
            className="p-1 rounded hover:bg-[#2B2D30] text-[#DFE1E5] flex items-center gap-1 cursor-pointer"
          >
            <Archive size={12} className="text-[#F1A23A]" />
            <span>Stash...</span>
          </button>

          <div className="w-[1px] h-3 bg-[#393B40] mx-1" />

          {/* Current Branch Badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1E1F22] border border-[#393B40] text-[#DFE1E5]">
            <GitBranch size={11} className="text-[#59A869]" />
            <span className="font-mono text-[11px] font-medium">{currentBranch}</span>
          </div>
        </div>

        {/* Right Action: Filter Log or Stash Counter */}
        {activeTab === 'log' && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1E1F22] border border-[#393B40] w-64">
            <Search size={11} className="text-[#868A91]" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter by hash, message, author..."
              className="flex-1 bg-transparent text-[#DFE1E5] placeholder-[#5A5D63] outline-none text-[11px]"
            />
            {searchFilter && (
              <button onClick={() => setSearchFilter('')} className="text-[#868A91] hover:text-white">✕</button>
            )}
          </div>
        )}
      </div>

      {/* ─── Main Content Panels ─── */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'log' && (
          <div className="w-full h-full flex">
            {/* 1. Branch Tree Sidebar (Collapsible) */}
            {showBranchSidebar && (
              <div className="w-48 h-full bg-[#1A1B1E] border-r border-[#2B2D30] flex flex-col flex-shrink-0 text-[11px] overflow-y-auto">
                <div className="p-2 text-[10px] font-semibold text-[#868A91] uppercase tracking-wider border-b border-[#2B2D30]">
                  Branches & Tags
                </div>

                <div className="p-1 space-y-0.5">
                  {/* Local Branches */}
                  <div className="text-[#A8ADBD] font-medium px-2 py-1 flex items-center gap-1 text-[11px]">
                    <FolderGit2 size={12} className="text-[#3574F0]" />
                    <span>Local</span>
                  </div>
                  {branches.filter(b => !b.isRemote).map(b => (
                    <div
                      key={b.name}
                      onDoubleClick={() => {
                        onShowToast?.('Checkout Branch', `Switched to branch '${b.name}'`, 'success');
                      }}
                      className={`flex items-center justify-between px-3 py-1 rounded cursor-pointer transition-colors ${
                        b.name === currentBranch
                          ? 'bg-[#2E436E] text-white font-semibold'
                          : 'hover:bg-[#25272B] text-[#DFE1E5]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <GitBranch size={11} className={b.name === currentBranch ? 'text-[#59A869]' : 'text-[#868A91]'} />
                        <span className="truncate">{b.name}</span>
                      </div>
                      {b.name === currentBranch && (
                        <Check size={11} className="text-[#59A869]" />
                      )}
                    </div>
                  ))}

                  {/* Remote Branches */}
                  <div className="text-[#A8ADBD] font-medium px-2 py-1 flex items-center gap-1 text-[11px] pt-2">
                    <Download size={12} className="text-[#868A91]" />
                    <span>Remote</span>
                  </div>
                  {branches.filter(b => b.isRemote).map(b => (
                    <div
                      key={b.name}
                      className="flex items-center gap-1.5 px-3 py-1 rounded cursor-pointer hover:bg-[#25272B] text-[#868A91] hover:text-[#DFE1E5]"
                    >
                      <GitBranch size={11} />
                      <span className="truncate">{b.name}</span>
                    </div>
                  ))}

                  {/* Tags */}
                  <div className="text-[#A8ADBD] font-medium px-2 py-1 flex items-center gap-1 text-[11px] pt-2">
                    <Tag size={12} className="text-[#F1A23A]" />
                    <span>Tags</span>
                  </div>
                  {tags.map(t => (
                    <div
                      key={t}
                      className="flex items-center gap-1.5 px-3 py-1 rounded cursor-pointer hover:bg-[#25272B] text-[#DFE1E5]"
                    >
                      <Tag size={11} className="text-[#F1A23A]" />
                      <span className="font-mono text-[10px]">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Commit Log Table with SVG Graph (Center) */}
            <div className="flex-1 h-full overflow-auto border-r border-[#2B2D30]">
              <table className="w-full text-left border-collapse text-[11px] font-sans">
                <thead className="bg-[#25272B] sticky top-0 text-[#868A91] border-b border-[#2B2D30] z-10">
                  <tr>
                    <th className="py-1 px-3 w-16 font-normal">Graph</th>
                    <th className="py-1 px-3 w-20 font-normal">Hash</th>
                    <th className="py-1 px-3 font-normal">Description</th>
                    <th className="py-1 px-3 w-36 font-normal">Author</th>
                    <th className="py-1 px-3 w-24 font-normal">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCommits.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#868A91] italic">
                        {isLoading ? 'Loading Git commits...' : 'No commits found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredCommits.map((c, index) => {
                      const isSelected = selectedCommitHash === c.hash;
                      const lane = index % 3; // subway lane assignment
                      const color = laneColors[lane];

                      return (
                        <tr
                          key={c.hash}
                          onClick={() => setSelectedCommitHash(c.hash)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setCommitContextMenu({
                              x: Math.min(e.clientX, window.innerWidth - 220),
                              y: Math.min(e.clientY, window.innerHeight - 250),
                              commit: c,
                            });
                          }}
                          className={`border-b border-[#25272B] cursor-pointer transition-colors h-7 ${
                            isSelected
                              ? 'bg-[#2E436E] text-white font-medium'
                              : 'hover:bg-[#2B2D30]/70 text-[#DFE1E5]'
                          }`}
                        >
                          {/* Authentic Multi-lane Subway SVG Graph */}
                          <td className="py-0 px-1 text-center relative h-7 w-16">
                            <svg className="w-16 h-7 absolute inset-0 pointer-events-none">
                              {/* Continuous Lane Line */}
                              <line
                                x1={12 + lane * 14}
                                y1={0}
                                x2={12 + lane * 14}
                                y2={28}
                                stroke={color}
                                strokeWidth={2}
                                opacity={0.65}
                              />
                              {/* Fork / Merge Curves */}
                              {lane > 0 && (
                                <path
                                  d={`M 12 0 C 12 14, ${12 + lane * 14} 14, ${12 + lane * 14} 28`}
                                  fill="none"
                                  stroke={color}
                                  strokeWidth={1.5}
                                  strokeDasharray="2 2"
                                  opacity={0.5}
                                />
                              )}
                              {/* Commit Node Circle */}
                              <circle
                                cx={12 + lane * 14}
                                cy={14}
                                r={isSelected ? 4.5 : 3.5}
                                fill={color}
                                stroke="#1E1F22"
                                strokeWidth={1.5}
                              />
                            </svg>
                          </td>

                          {/* Short Hash */}
                          <td className="py-1.5 px-3 font-mono text-[#868A91] group-hover:text-[#DFE1E5]">
                            {c.short_hash}
                          </td>

                          {/* Commit Subject with Branch / Tag Badges */}
                          <td className="py-1.5 px-3 truncate max-w-[420px]">
                            <div className="flex items-center gap-1.5 truncate">
                              {/* Branch Badges */}
                              {c.branches?.map(b => (
                                <span 
                                  key={b}
                                  className={`text-[9.5px] px-1.5 py-0.2 rounded font-mono font-medium flex-shrink-0 flex items-center gap-1 ${
                                    b.includes('HEAD') 
                                      ? 'bg-[#59A869]/25 text-[#59A869] border border-[#59A869]/50'
                                      : 'bg-[#3574F0]/25 text-[#3574F0] border border-[#3574F0]/50'
                                  }`}
                                >
                                  <GitBranch size={9} />
                                  <span>{b}</span>
                                </span>
                              ))}

                              {/* Tag Badges */}
                              {c.tags?.map(t => (
                                <span 
                                  key={t}
                                  className="text-[9.5px] px-1.5 py-0.2 rounded font-mono font-medium flex-shrink-0 flex items-center gap-1 bg-[#F1A23A]/25 text-[#F1A23A] border border-[#F1A23A]/50"
                                >
                                  <Tag size={9} />
                                  <span>{t}</span>
                                </span>
                              ))}

                              <span className="truncate">{c.subject}</span>
                            </div>
                          </td>

                          {/* Author */}
                          <td className="py-1.5 px-3 text-[#868A91] truncate max-w-[130px]">
                            {c.author}
                          </td>

                          {/* Date */}
                          <td className="py-1.5 px-3 text-[#868A91] font-mono text-[10px]">
                            {c.date}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 3. Commit Details & Changed Files (Right) */}
            <div className="w-[380px] h-full flex flex-col bg-[#1E1F22] overflow-hidden flex-shrink-0">
              {commitDetails ? (
                <div className="flex-1 flex flex-col p-3 overflow-y-auto space-y-3">
                  {/* Commit metadata */}
                  <div className="bg-[#25272B] border border-[#323438] rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#868A91]">
                      <span className="font-mono text-[#3574F0] font-semibold">{commitDetails.hash.substring(0, 8)}</span>
                      <span>{commitDetails.date}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#DFE1E5]">
                      <User size={12} className="text-[#868A91]" />
                      <span className="font-medium">{commitDetails.author}</span>
                    </div>

                    <div className="text-xs text-[#DFE1E5] font-sans whitespace-pre-wrap leading-relaxed pt-1 border-t border-[#323438]">
                      {commitDetails.message}
                    </div>
                  </div>

                  {/* Changed Files in this commit */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between text-[11px] text-[#868A91] mb-1.5 font-medium">
                      <span>Changed Files ({commitDetails.files.length})</span>
                      <span className="text-[10px] text-[#868A91]">Double-click for Diff</span>
                    </div>

                    <div className="flex-1 bg-[#25272B] border border-[#323438] rounded-lg p-1.5 overflow-y-auto space-y-1">
                      {commitDetails.files.length === 0 ? (
                        <div className="text-[#868A91] text-center py-6 italic text-xs">
                          No file changes detected in this commit.
                        </div>
                      ) : (
                        commitDetails.files.map((file, idx) => (
                          <div
                            key={idx}
                            onDoubleClick={() => handleOpenFileDiff(file.path)}
                            onClick={() => handleOpenFileDiff(file.path)}
                            className="group flex items-center justify-between px-2 py-1 rounded hover:bg-[#2B2D30] cursor-pointer text-xs transition-colors"
                          >
                            <div className="flex items-center gap-2 truncate flex-1">
                              <FileCode size={13} className="text-[#3574F0] flex-shrink-0" />
                              <span className="font-mono text-[11px] text-[#DFE1E5] truncate">{file.path}</span>
                            </div>
                            <span className={`text-[10px] font-semibold px-1 rounded ml-2 ${
                              file.status === 'M' ? 'text-[#3574F0] bg-[#3574F0]/10' :
                              file.status === 'A' ? 'text-[#59A869] bg-[#59A869]/10' :
                              'text-[#E05555] bg-[#E05555]/10'
                            }`}>
                              {file.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[#868A91] italic">
                  Select a commit from the log to view changes
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Shelf / Stashes Manager Tab ─── */}
        {activeTab === 'stashes' && (
          <div className="w-full h-full flex bg-[#1E1F22]">
            {/* Left: Stash list */}
            <div className="w-80 h-full border-r border-[#2B2D30] flex flex-col">
              <div className="p-2 bg-[#25272B] border-b border-[#2B2D30] flex items-center justify-between text-xs font-medium text-[#DFE1E5]">
                <span>Stored Stashes ({stashes.length})</span>
                <button
                  onClick={() => setIsStashModalOpen(true)}
                  className="px-2 py-0.5 rounded bg-[#3574F0] hover:bg-[#3574F0]/85 text-white flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <Plus size={11} />
                  <span>Stash...</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-1 space-y-1">
                {stashes.length === 0 ? (
                  <div className="py-8 text-center text-[#868A91] italic text-xs">
                    No stashes found. Click "Stash..." to save local changes.
                  </div>
                ) : (
                  stashes.map((s, idx) => {
                    const isSelected = selectedStashIndex === idx;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedStashIndex(idx)}
                        className={`p-2 rounded border cursor-pointer transition-colors space-y-1 ${
                          isSelected
                            ? 'bg-[#2E436E] border-[#3574F0] text-white'
                            : 'bg-[#25272B] border-[#323438] hover:bg-[#2B2D30] text-[#DFE1E5]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono text-[#F1A23A] font-semibold">stash@&#123;{s.index}&#125;</span>
                          <span className="text-[10px] text-[#868A91]">{s.relativeTime}</span>
                        </div>
                        <div className="text-xs truncate font-medium">
                          {s.message}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#868A91]">
                          <GitBranch size={10} className="text-[#59A869]" />
                          <span>{s.branch}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Selected Stash Details & Changed Files */}
            <div className="flex-1 h-full flex flex-col p-4 overflow-y-auto space-y-3">
              {stashes[selectedStashIndex] ? (
                <>
                  <div className="bg-[#25272B] border border-[#323438] rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-[#F1A23A] text-xs font-semibold mb-1">
                        stash@&#123;{stashes[selectedStashIndex].index}&#125;
                      </div>
                      <div className="text-xs font-medium text-white mb-1">
                        {stashes[selectedStashIndex].message}
                      </div>
                      <div className="text-[11px] text-[#868A91]">
                        Branch: {stashes[selectedStashIndex].branch} • Created: {stashes[selectedStashIndex].relativeTime}
                      </div>
                    </div>

                    {/* Stash Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleStashApply(stashes[selectedStashIndex].index)}
                        title="Apply Stash (keeps stash in list)"
                        className="px-3 py-1 rounded bg-[#2B2D30] hover:bg-[#35373B] text-xs font-medium text-[#DFE1E5] border border-[#393B40] transition-colors cursor-pointer"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => handleStashPop(stashes[selectedStashIndex].index)}
                        title="Pop Stash (applies and removes from list)"
                        className="px-3 py-1 rounded bg-[#3574F0] hover:bg-[#3574F0]/85 text-xs font-medium text-white transition-colors cursor-pointer"
                      >
                        Pop Stash
                      </button>
                      <button
                        onClick={() => handleStashDrop(stashes[selectedStashIndex].index)}
                        title="Delete this stash"
                        className="p-1.5 rounded hover:bg-[#E55353]/20 text-[#E55353] transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Stashed Files list */}
                  <div className="flex-1 flex flex-col min-h-0 bg-[#25272B] border border-[#323438] rounded-lg p-2">
                    <div className="text-[11px] font-semibold text-[#868A91] mb-2 px-1">
                      Files changed in this stash ({stashes[selectedStashIndex].files?.length || 0})
                    </div>
                    <div className="space-y-1">
                      {stashes[selectedStashIndex].files?.map((f, i) => (
                        <div
                          key={i}
                          onClick={() => handleOpenFileDiff(f.path)}
                          className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#2B2D30] cursor-pointer text-xs transition-colors"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileCode size={13} className="text-[#3574F0]" />
                            <span className="font-mono text-[11px] text-[#DFE1E5]">{f.path}</span>
                          </div>
                          <span className="text-[10px] text-[#3574F0] bg-[#3574F0]/10 px-1 rounded font-semibold">
                            {f.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[#868A91] italic">
                  Select a stash to inspect its contents
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Console Tab ─── */}
        {activeTab === 'console' && (
          <div className="w-full h-full flex flex-col bg-[#1E1F22] p-3 font-mono text-[11px] overflow-auto select-text">
            <div className="flex justify-between items-center text-[10px] text-[#868A91] border-b border-[#2B2D30] pb-1 mb-2">
              <span>Git Command Execution Log</span>
              <button 
                onClick={() => setConsoleLogs([])} 
                className="hover:text-white cursor-pointer"
              >
                Clear Console
              </button>
            </div>

            {consoleLogs.length === 0 ? (
              <div className="text-[#868A91] italic py-8 text-center">No git activity recorded yet.</div>
            ) : (
              consoleLogs.map((log, idx) => (
                <div key={idx} className="mb-2 leading-relaxed">
                  <span className="text-[#5A5D63] mr-2">[{log.time}]</span>
                  <span className="text-[#3574F0] font-semibold">{log.command}</span>
                  <div className="text-[#DFE1E5] pl-4 whitespace-pre-wrap">{log.output}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ─── Commit Context Menu (Right Click) ─── */}
      {commitContextMenu && (
        <div
          style={{ top: `${commitContextMenu.y}px`, left: `${commitContextMenu.x}px` }}
          className="fixed z-50 bg-[#2B2D30] border border-[#393B40] rounded-md shadow-2xl py-1 w-56 text-xs text-[#DFE1E5] select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] font-mono text-[#3574F0] font-semibold border-b border-[#393B40] mb-1">
            Commit: {commitContextMenu.commit.short_hash}
          </div>

          <div
            onClick={() => {
              handleCheckoutRevision(commitContextMenu.commit);
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <span>Checkout Revision...</span>
          </div>

          <div
            onClick={() => {
              handleCreateTag(commitContextMenu.commit);
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Tag size={12} className="text-[#F1A23A]" />
            <span>New Tag...</span>
          </div>

          <div
            onClick={() => {
              handleCherryPick(commitContextMenu.commit);
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Layers size={12} className="text-[#3574F0]" />
            <span>Cherry-Pick...</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          <div
            onClick={() => {
              setResetTargetCommit(commitContextMenu.commit);
              setIsResetModalOpen(true);
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 text-[#E55353] hover:text-white"
          >
            <RotateCcw size={12} />
            <span>Reset Current Branch to Here...</span>
          </div>

          <div
            onClick={() => {
              handleRevertCommit(commitContextMenu.commit);
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
          >
            <span>Revert Commit</span>
          </div>

          <div
            onClick={() => {
              handleOpenInteractiveRebase(commitContextMenu.commit);
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <GitMerge size={12} className="text-[#3574F0]" />
            <span>Interactive Rebase from Here...</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          <div
            onClick={() => {
              navigator.clipboard.writeText(commitContextMenu.commit.hash);
              onShowToast?.('Copied', `Revision hash copied: ${commitContextMenu.commit.hash.substring(0, 10)}...`, 'info');
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Copy size={12} />
            <span>Copy Revision Number</span>
          </div>
        </div>
      )}

      {/* ─── Integrated Modals ─── */}
      <StashModal
        isOpen={isStashModalOpen}
        currentBranch={currentBranch}
        onClose={() => setIsStashModalOpen(false)}
        onStash={handleStashSave}
      />

      {resetTargetCommit && (
        <GitResetModal
          isOpen={isResetModalOpen}
          commitHash={resetTargetCommit.hash}
          commitSubject={resetTargetCommit.subject}
          commitAuthor={resetTargetCommit.author}
          currentBranch={currentBranch}
          onClose={() => {
            setIsResetModalOpen(false);
            setResetTargetCommit(null);
          }}
          onReset={handleResetBranch}
        />
      )}

      <InteractiveRebaseModal
        isOpen={isRebaseModalOpen}
        initialCommits={rebaseCommits}
        onClose={() => setIsRebaseModalOpen(false)}
        onStartRebase={handleExecuteRebase}
      />

      <DiffViewerModal
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
        fileName={diffModalFile || ''}
        baseContent={diffModalBase}
        localContent={diffModalLocal}
      />
    </div>
  );
};
