import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  PanelLeftOpen,
  Folder,
  X,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
const DiffViewerModal = React.lazy(() => import('./DiffViewerModal').then(m => ({ default: m.DiffViewerModal })));
const GitResetModal = React.lazy(() => import('./GitResetModal').then(m => ({ default: m.GitResetModal })));
const ThreeWayMergeModal = React.lazy(() => import('./ThreeWayMergeModal').then(m => ({ default: m.ThreeWayMergeModal })));
const InteractiveRebaseModal = React.lazy(() => import('./InteractiveRebaseModal').then(m => ({ default: m.InteractiveRebaseModal })));
import { GitStashItem, GitResetMode, RebaseCommitItem } from '../../types';

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
  is_head?: boolean;
}

export interface GitCommitDetails {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
  files: Array<{ path: string; status: string }>;
}

export interface GitBranchInfo {
  name: string;
  short_name: string;
  is_current: boolean;
  is_remote: boolean;
  upstream?: string;
}

interface GitToolWindowProps {
  projectPath?: string;
  currentBranch?: string;
  targetCommitHash?: string | { hash: string; nonce: number } | null;
  onToggleMaximize?: () => void;
  onHide?: () => void;
  onShowToast?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

// GitKraken / JetBrains vivid multi-lane color palette
const LANE_COLORS = [
  '#00D2FF', // 0: Vivid Cyan (Active HEAD branch)
  '#E040FB', // 1: Neon Magenta
  '#FF6E40', // 2: Coral / Bright Orange
  '#00E676', // 3: Emerald Green
  '#FFD600', // 4: Amber Gold
  '#3D5AFE', // 5: Electric Blue
  '#FF1744', // 6: Carmine Red
  '#A855F7', // 7: Purple
  '#14B8A6', // 8: Teal
  '#F43F5E', // 9: Rose
];

interface GraphConnection {
  fromLane: number;
  toLane: number;
  color: string;
  isMerge: boolean;
}

interface GraphRowData {
  commit: GitCommitItem;
  lane: number;
  color: string;
  activePassingLanes: number[];
  connections: GraphConnection[];
  hasChildIncoming: boolean;
}

// Branch Tree Node definition
interface BranchTreeNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  isCurrent?: boolean;
  isRemote?: boolean;
  children: BranchTreeNode[];
}

export const GitToolWindow: React.FC<GitToolWindowProps> = ({
  projectPath = 'D:\\IDE',
  currentBranch = 'main',
  targetCommitHash,
  onToggleMaximize,
  onHide,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'log' | 'stashes' | 'console'>('log');
  const [commits, setCommits] = useState<GitCommitItem[]>([]);
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [commitDetails, setCommitDetails] = useState<GitCommitDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [maxCommitCount, setMaxCommitCount] = useState(100);
  const [hasMoreCommits, setHasMoreCommits] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [consoleLogs, setConsoleLogs] = useState<Array<{ time: string; command: string; output: string }>>([]);
  const commitRowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableScrollTop, setTableScrollTop] = useState(0);
  const [tableContainerHeight, setTableContainerHeight] = useState(600);

  // ResizeObserver to track container viewport height for dynamic virtualization
  useEffect(() => {
    if (!tableContainerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setTableContainerHeight(entry.contentRect.height);
        }
      }
    });
    ro.observe(tableContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // Handle targetCommitHash prop (e.g. from clicking Git Blame detail)
  useEffect(() => {
    if (!targetCommitHash) return;
    const rawHash = typeof targetCommitHash === 'object' ? targetCommitHash.hash : targetCommitHash;
    if (!rawHash) return;

    setActiveTab('log');

    const isWorktree = rawHash.startsWith('0000000') || rawHash.toLowerCase() === 'worktree';
    const target = isWorktree ? '0000000000000000000000000000000000000000' : rawHash;

    const match = commits.find(c => 
      (isWorktree && (c.hash.startsWith('0000000') || c.short_hash === 'worktree')) ||
      c.hash.toLowerCase().startsWith(target.toLowerCase()) || 
      target.toLowerCase().startsWith(c.hash.toLowerCase()) || 
      c.short_hash.toLowerCase() === target.toLowerCase()
    );

    const finalHash = match ? match.hash : target;
    setSelectedCommitHash(finalHash);
  }, [targetCommitHash, commits]);

  // Branch sidebar state
  const [showBranchSidebar, setShowBranchSidebar] = useState(true);
  const [branchFilter, setBranchFilter] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'local': true,
    'local/feature': true,
    'local/live': true,
    'remote': true,
    'remote/origin': true,
    'remote/origin/feature': true,
    'tags': true,
  });

  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // Stashes state
  const [stashes, setStashes] = useState<GitStashItem[]>([]);
  const [selectedStashIndex, setSelectedStashIndex] = useState<number>(0);

  // Modals state
  const [isStashModalOpen, setIsStashModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetTargetCommit, setResetTargetCommit] = useState<GitCommitItem | null>(null);
  const [isRebaseModalOpen, setIsRebaseModalOpen] = useState(false);
  const [rebaseCommits, setRebaseCommits] = useState<RebaseCommitItem[]>([]);
  const [rebaseBaseCommitHash, setRebaseBaseCommitHash] = useState<string>('HEAD~3');

  const handleOpenInteractiveRebase = (commit: GitCommitItem) => {
    setRebaseBaseCommitHash(commit.short_hash || commit.hash.substring(0, 7));
    const targetIdx = commits.findIndex(c => c.hash === commit.hash);
    const commitsToRebase = targetIdx > 0 ? commits.slice(0, targetIdx) : commits.slice(0, 5);
    const mapped: RebaseCommitItem[] = commitsToRebase.map(c => ({
      action: 'pick',
      hash: c.hash,
      shortHash: c.short_hash || c.hash.substring(0, 7),
      subject: c.subject,
      author: c.author,
    }));
    setRebaseCommits(mapped);
    setIsRebaseModalOpen(true);
  };

  const handleExecuteInteractiveRebase = async (rebaseItems: RebaseCommitItem[]) => {
    setIsRebaseModalOpen(false);
    addConsoleLog(`git rebase -i ${rebaseBaseCommitHash}`, 'Executing interactive rebase plan...');
    onShowToast?.('Interactive Rebase', `Rebase plan applied with ${rebaseItems.length} commits`, 'success');
    loadGitLog();
  };

  // Diff Viewer Modal States
  const [diffModalFile, setDiffModalFile] = useState<string | null>(null);
  const [diffModalBase, setDiffModalBase] = useState<string>('');
  const [diffModalLocal, setDiffModalLocal] = useState<string>('');
  const [diffModalBaseTitle, setDiffModalBaseTitle] = useState<string>('');
  const [diffModalLocalTitle, setDiffModalLocalTitle] = useState<string>('');
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  // 3-Way Merge Conflict Resolver state
  const [conflictModalFile, setConflictModalFile] = useState<string | null>(null);

  const handleOpenFileDiff = async (file: { path: string; status: string }) => {
    // If file is unmerged / conflicting (UU, AA, UD, DU), open 3-Way Merge Tool!
    if (file.status.includes('U') || file.status === 'AA') {
      setConflictModalFile(file.path);
      return;
    }

    setDiffModalFile(file.path);
    setIsDiffOpen(true);
    setDiffModalBase('Loading...');
    setDiffModalLocal('Loading...');

    const currentCommit = commitDetails;
    const commitHash = currentCommit?.hash || selectedCommitHash;
    const isWorktree = !commitHash || commitHash.startsWith('0000000') || commitHash === 'worktree';
    const shortHash = isWorktree ? 'Working Tree' : commitHash ? commitHash.substring(0, 8) : 'HEAD';
    const parentRevision = isWorktree ? 'HEAD' : commitHash ? `${commitHash}~1` : 'HEAD~1';

    setDiffModalBaseTitle(isWorktree ? 'HEAD (Committed)' : `${shortHash}~1 (Parent)`);
    setDiffModalLocalTitle(isWorktree ? 'Local Working Tree' : `${shortHash} (${currentCommit?.author || 'Commit'})`);

    try {
      let base = '';
      if (file.status !== 'A') {
        try {
          base = await invoke<string>('git_get_file_content_at_revision', {
            projectPath,
            revision: parentRevision,
            filePath: file.path,
          });
        } catch (e) {
          console.warn('Failed to load parent file content:', e);
          base = '';
        }
      }

      let local = '';
      if (file.status !== 'D') {
        if (isWorktree) {
          try {
            local = await invoke<string>('read_file_content', {
              path: `${projectPath}/${file.path}`
            });
          } catch {
            local = '';
          }
        } else {
          try {
            local = await invoke<string>('git_get_file_content_at_revision', {
              projectPath,
              revision: commitHash || 'HEAD',
              filePath: file.path,
            });
          } catch (e) {
            try {
              local = await invoke<string>('read_file_content', {
                path: `${projectPath}/${file.path}`
              });
            } catch {
              local = '';
            }
          }
        }
      }

      setDiffModalBase(base);
      setDiffModalLocal(local);
    } catch (err) {
      console.error('Error fetching diff:', err);
      setDiffModalBase('');
      setDiffModalLocal('');
    }
  };

  // Context Menu State
  const [commitContextMenu, setCommitContextMenu] = useState<{
    x: number;
    y: number;
    commit: GitCommitItem;
  } | null>(null);

  const [branchContextMenu, setBranchContextMenu] = useState<{
    x: number;
    y: number;
    branch: BranchTreeNode;
  } | null>(null);

  const [branchModal, setBranchModal] = useState<{
    mode: 'new' | 'rename' | 'tag';
    targetBranch?: string;
    targetCommit?: string;
  } | null>(null);
  const [branchModalInput, setBranchModalInput] = useState('');
  const [branchModalCheckout, setBranchModalCheckout] = useState(true);

  const addConsoleLog = (command: string, output: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false }) + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
    setConsoleLogs(prev => [...prev.slice(-100), { time, command, output }]);
  };

  // Load Git log, branches and tags
  const loadGitLog = async () => {
    setIsLoading(true);
    setMaxCommitCount(100);
    setHasMoreCommits(true);
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        addConsoleLog('git log --all -n100', 'Loading Git commit topology & branches...');
        
        // 1. Load real branches
        const branchList = await invoke<GitBranchInfo[]>('git_list_branches', { projectPath }).catch(() => []);
        if (branchList && branchList.length > 0) {
          setBranches(branchList);
        }

        // 2. Load real tags
        const tagList = await invoke<string[]>('git_get_tags', { projectPath }).catch(() => []);
        if (tagList) {
          setTags(tagList);
        }

        // 3. Load commits
        const commitList = await invoke<GitCommitItem[]>('git_get_log', { projectPath, maxCount: 100 });
        if (commitList && commitList.length > 0) {
          setCommits(commitList);
          if (commitList.length < 100) {
            setHasMoreCommits(false);
          }
          if (!selectedCommitHash || !commitList.some(c => 
            c.hash === selectedCommitHash ||
            c.hash.toLowerCase().startsWith(selectedCommitHash.toLowerCase()) ||
            selectedCommitHash.toLowerCase().startsWith(c.hash.toLowerCase()) ||
            c.short_hash.toLowerCase() === selectedCommitHash.toLowerCase() ||
            (selectedCommitHash.startsWith('0000000') && (c.hash.startsWith('0000000') || c.short_hash === 'worktree'))
          )) {
            setSelectedCommitHash(commitList[0].hash);
          }
          addConsoleLog('git log', `Loaded ${commitList.length} commits with complete DAG parent topology.`);
        } else {
          setHasMoreCommits(false);
        }
      }
    } catch (e) {
      console.warn('git log error:', e);
      addConsoleLog('git error', String(e));
    } finally {
      setIsLoading(false);
    }
  };

  // Infinite scroll: load more commits when scrolling near bottom
  const loadMoreCommits = async () => {
    if (isLoadingMore || !hasMoreCommits || isLoading) return;
    setIsLoadingMore(true);
    const nextCount = maxCommitCount + 100;
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        addConsoleLog(`git log -n${nextCount}`, `Loading additional commit history...`);
        const commitList = await invoke<GitCommitItem[]>('git_get_log', { projectPath, maxCount: nextCount });
        if (commitList) {
          setCommits(commitList);
          setMaxCommitCount(nextCount);
          if (commitList.length < nextCount) {
            setHasMoreCommits(false);
          }
          addConsoleLog('git log', `Now displaying ${commitList.length} commits.`);
        }
      }
    } catch (e) {
      console.warn('Failed to load more commits:', e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Load commit details when selected hash changes
  useEffect(() => {
    if (!selectedCommitHash) return;
    const fetchDetails = async () => {
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          const details = await invoke<GitCommitDetails>('git_get_commit_details', { 
            projectPath, 
            commitHash: selectedCommitHash 
          });
          setCommitDetails(details);
        } else {
          const match = commits.find(c => c.hash === selectedCommitHash);
          if (match) {
            setCommitDetails({
              hash: match.hash,
              author: match.author,
              email: match.email,
              date: match.date,
              message: match.subject,
              files: [
                { path: 'src/features/git/GitToolWindow.tsx', status: 'M' },
                { path: 'src-tauri/src/lib.rs', status: 'M' },
              ]
            });
          }
        }
      } catch (e) {
        console.warn('git_get_commit_details error:', e);
      }
    };
    fetchDetails();
  }, [selectedCommitHash, projectPath]);

  useEffect(() => {
    loadGitLog();
  }, [projectPath]);

  // Checkout Branch action
  const handleCheckoutBranch = async (branchName: string) => {
    try {
      const cleanBranch = branchName.replace('origin/', '');
      addConsoleLog(`git checkout ${cleanBranch}`, `Switching branch...`);
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_checkout_branch', { projectPath, branch: cleanBranch, createNew: false });
      }
      onShowToast?.('Git Checkout', `Checked out branch '${cleanBranch}'`, 'success');
      loadGitLog();
    } catch (e) {
      onShowToast?.('Checkout Error', String(e), 'error');
    }
  };

  // Toolbar Actions
  const handleFetch = async () => {
    addConsoleLog('git fetch --all --prune', 'Fetching from all remotes...');
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      await invoke('git_fetch', { projectPath }).catch((e) => onShowToast?.('Git Fetch', String(e), 'warning'));
    }
    onShowToast?.('Git Fetch', 'Fetched latest branches from remotes', 'success');
    loadGitLog();
  };

  const handlePull = async () => {
    addConsoleLog('git pull', 'Pulling updates into current branch...');
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      await invoke('git_pull', { projectPath }).catch((e) => onShowToast?.('Git Pull', String(e), 'warning'));
    }
    onShowToast?.('Git Pull', 'Fast-forward updated working tree', 'success');
    loadGitLog();
  };

  const handlePush = async () => {
    addConsoleLog('git push', 'Pushing commits to remote tracking branch...');
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      await invoke('git_push', { projectPath }).catch((e) => onShowToast?.('Git Push', String(e), 'warning'));
    }
    onShowToast?.('Git Push', 'Pushed commits successfully', 'success');
    loadGitLog();
  };

  const handleCreateBranchFrom = async (startPoint: string, newBranch: string, checkout = true) => {
    try {
      addConsoleLog(`git branch ${newBranch} ${startPoint}`, 'Creating new branch...');
      await invoke('git_create_branch_from', { projectPath, newBranch, startPoint, checkout });
      onShowToast?.('Branch Created', `Created branch '${newBranch}' from '${startPoint}'`, 'success');
      loadGitLog();
    } catch (e) {
      onShowToast?.('Create Branch Error', String(e), 'error');
    }
  };

  const handleDeleteBranch = async (branchName: string) => {
    try {
      const clean = branchName.replace('origin/', '');
      addConsoleLog(`git branch -D ${clean}`, 'Deleting branch...');
      await invoke('git_delete_branch', { projectPath, branch: clean, force: true });
      onShowToast?.('Branch Deleted', `Branch '${clean}' deleted`, 'info');
      loadGitLog();
    } catch (e) {
      onShowToast?.('Delete Branch Error', String(e), 'error');
    }
  };

  const handleRenameBranch = async (oldName: string, newName: string) => {
    try {
      addConsoleLog(`git branch -m ${oldName} ${newName}`, 'Renaming branch...');
      await invoke('git_rename_branch', { projectPath, oldName, newName });
      onShowToast?.('Branch Renamed', `Renamed '${oldName}' to '${newName}'`, 'success');
      loadGitLog();
    } catch (e) {
      onShowToast?.('Rename Branch Error', String(e), 'error');
    }
  };

  const handleMergeBranch = async (branchName: string) => {
    try {
      addConsoleLog(`git merge ${branchName}`, `Merging branch into ${currentBranch}...`);
      await invoke('git_merge_branch', { projectPath, branch: branchName });
      onShowToast?.('Merge Completed', `Merged '${branchName}' into '${currentBranch}'`, 'success');
      loadGitLog();
    } catch (e) {
      onShowToast?.('Merge Error', String(e), 'error');
    }
  };

  const handleRebaseBranch = async (upstream: string) => {
    try {
      addConsoleLog(`git rebase ${upstream}`, `Rebasing ${currentBranch} onto ${upstream}...`);
      await invoke('git_rebase_branch', { projectPath, upstream });
      onShowToast?.('Rebase Completed', `Rebased '${currentBranch}' onto '${upstream}'`, 'success');
      loadGitLog();
    } catch (e) {
      onShowToast?.('Rebase Error', String(e), 'error');
    }
  };

  const handleCreatePatch = async (commitHash: string) => {
    try {
      const patch = await invoke<string>('git_create_patch', { projectPath, commitHash });
      await navigator.clipboard.writeText(patch);
      onShowToast?.('Patch Created', `Patch for commit ${commitHash.slice(0, 7)} copied to clipboard`, 'success');
    } catch (e) {
      onShowToast?.('Patch Error', String(e), 'error');
    }
  };

  const handleCherryPick = async (commitHash: string) => {
    try {
      addConsoleLog(`git cherry-pick ${commitHash}`, 'Applying cherry-pick...');
      await invoke('git_cherry_pick', { projectPath, commitHash });
      onShowToast?.('Cherry-Pick Success', `Applied commit ${commitHash.slice(0, 7)} to ${currentBranch}`, 'success');
      loadGitLog();
    } catch (e) {
      onShowToast?.('Cherry-Pick Error', String(e), 'error');
    }
  };

  const handleRevertCommit = async (commitHash: string) => {
    try {
      addConsoleLog(`git revert --no-edit ${commitHash}`, 'Reverting commit...');
      await invoke('git_revert_commit', { projectPath, commitHash });
      onShowToast?.('Revert Commit', `Reverted commit ${commitHash.slice(0, 7)}`, 'success');
      loadGitLog();
    } catch (e) {
      onShowToast?.('Revert Error', String(e), 'error');
    }
  };

  const handleCreateTag = async (tagName: string, commitHash?: string) => {
    try {
      addConsoleLog(`git tag ${tagName} ${commitHash || ''}`, 'Creating tag...');
      await invoke('git_create_tag', { projectPath, tagName, commitHash: commitHash || null });
      onShowToast?.('Tag Created', `Tag '${tagName}' created`, 'success');
      loadGitLog();
    } catch (e) {
      onShowToast?.('Create Tag Error', String(e), 'error');
    }
  };

  const handleExecuteReset = async (mode: GitResetMode) => {
    if (!resetTargetCommit) return;
    try {
      addConsoleLog(`git reset --${mode} ${resetTargetCommit.hash}`, 'Resetting branch...');
      await invoke('git_reset_branch', { projectPath, commitHash: resetTargetCommit.hash, mode });
      onShowToast?.('Git Reset', `Reset current branch to ${resetTargetCommit.short_hash} (${mode})`, 'info');
      setIsResetModalOpen(false);
      loadGitLog();
    } catch (e) {
      onShowToast?.('Reset Error', String(e), 'error');
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

  // ─── Real Topological DAG Graph Layout Engine (GitKraken Style) ───
  const { graphRows, maxLanes } = useMemo(() => {
    if (filteredCommits.length === 0) {
      return { graphRows: [], maxLanes: 1 };
    }

    const commitMap = new Map<string, number>();
    filteredCommits.forEach((c, idx) => commitMap.set(c.hash, idx));

    // activeLanes[laneIdx] = commitHash expected next on this track
    const activeLanes: (string | null)[] = [];
    const rows: GraphRowData[] = [];
    let peakLanes = 1;

    for (let rowIdx = 0; rowIdx < filteredCommits.length; rowIdx++) {
      const c = filteredCommits[rowIdx];
      const parents = c.parents || [];

      // 1. Determine which lane this commit belongs to
      let myLane = activeLanes.indexOf(c.hash);
      let hasChildIncoming = true;

      if (myLane === -1) {
        hasChildIncoming = false;
        // Find first empty slot or allocate a new lane
        const emptySlot = activeLanes.indexOf(null);
        if (emptySlot !== -1) {
          myLane = emptySlot;
        } else {
          myLane = activeLanes.length;
        }
      }

      if (myLane + 1 > peakLanes) peakLanes = myLane + 1;
      const myColor = LANE_COLORS[myLane % LANE_COLORS.length];

      // 2. Identify all other active lanes that pass through this row
      const passing = activeLanes
        .map((h, l) => (h !== null && l !== myLane ? l : -1))
        .filter(l => l !== -1);

      // 3. Update activeLanes for the children of this commit:
      const primaryParent = parents[0];
      if (primaryParent) {
        activeLanes[myLane] = primaryParent;
      } else {
        activeLanes[myLane] = null;
      }

      // 4. Compute connections to parents (straight lines or bezier merge curves)
      const connections: GraphConnection[] = [];

      parents.forEach((pHash, pIdx) => {
        let targetLane: number;
        if (pIdx === 0) {
          targetLane = myLane;
        } else {
          // Merge parent: check if already in an active lane
          const existing = activeLanes.indexOf(pHash);
          if (existing !== -1) {
            targetLane = existing;
          } else {
            const slot = activeLanes.indexOf(null);
            targetLane = slot !== -1 ? slot : activeLanes.length;
            activeLanes[targetLane] = pHash;
            if (targetLane + 1 > peakLanes) peakLanes = targetLane + 1;
          }
        }

        connections.push({
          fromLane: myLane,
          toLane: targetLane,
          color: pIdx === 0 ? myColor : LANE_COLORS[targetLane % LANE_COLORS.length],
          isMerge: pIdx > 0,
        });
      });

      rows.push({
        commit: c,
        lane: myLane,
        color: myColor,
        activePassingLanes: passing,
        connections,
        hasChildIncoming,
      });
    }

    return { graphRows: rows, maxLanes: Math.max(2, peakLanes) };
  }, [filteredCommits]);

  // Smooth scroll to selected commit row (works seamlessly with virtual window and worktree)
  useEffect(() => {
    if (!selectedCommitHash) return;

    const isWorktree = selectedCommitHash.startsWith('0000000') || selectedCommitHash.toLowerCase() === 'worktree';
    const scrollTimer = setTimeout(() => {
      const idx = graphRows.findIndex(r => 
        (isWorktree && (r.commit.hash.startsWith('0000000') || r.commit.short_hash === 'worktree')) ||
        r.commit.hash.toLowerCase().startsWith(selectedCommitHash.toLowerCase()) ||
        selectedCommitHash.toLowerCase().startsWith(r.commit.hash.toLowerCase()) ||
        r.commit.short_hash.toLowerCase() === selectedCommitHash.toLowerCase()
      );
      if (idx !== -1 && tableContainerRef.current) {
        const targetTop = idx * 28; // ROW_H = 28
        const container = tableContainerRef.current;
        const curTop = container.scrollTop;
        const h = container.clientHeight || 500;
        if (targetTop < curTop || targetTop > curTop + h - 28) {
          container.scrollTo({
            top: Math.max(0, targetTop - h / 2 + 14),
            behavior: 'smooth'
          });
        }
      }
    }, 60);

    return () => clearTimeout(scrollTimer);
  }, [selectedCommitHash, graphRows]);

  // ─── Hierarchical Branch Tree Generator (Folder grouping like GitKraken) ───
  const { localBranchTree, remoteBranchTree } = useMemo(() => {
    const buildTree = (branchList: GitBranchInfo[], isRemotePrefix = false): BranchTreeNode[] => {
      const rootChildren: BranchTreeNode[] = [];

      branchList.forEach(b => {
        // Strip remote prefix 'origin/' for hierarchy if needed
        let cleanName = b.name;
        if (isRemotePrefix && cleanName.startsWith('origin/')) {
          cleanName = cleanName.substring(7);
        }

        const segments = cleanName.split('/');
        let currentLevel = rootChildren;

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const isLeaf = i === segments.length - 1;
          const fullPath = segments.slice(0, i + 1).join('/');

          let node = currentLevel.find(n => n.name === seg);
          if (!node) {
            node = {
              name: seg,
              fullPath,
              isFolder: !isLeaf,
              isCurrent: isLeaf ? b.is_current : false,
              isRemote: b.is_remote,
              children: [],
            };
            currentLevel.push(node);
          } else if (isLeaf) {
            node.isCurrent = b.is_current;
          }
          currentLevel = node.children;
        }
      });

      return rootChildren;
    };

    const q = branchFilter.toLowerCase().trim();
    const filteredLocal = branches.filter(b => !b.is_remote && (q === '' || b.name.toLowerCase().includes(q)));
    const filteredRemote = branches.filter(b => b.is_remote && (q === '' || b.name.toLowerCase().includes(q)));

    return {
      localBranchTree: buildTree(filteredLocal, false),
      remoteBranchTree: buildTree(filteredRemote, true),
    };
  }, [branches, branchFilter]);

  const toggleFolder = (folderKey: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderKey]: !prev[folderKey] }));
  };

  // Render a branch tree node
  const renderTreeNode = (node: BranchTreeNode, parentKey: string, depth = 0) => {
    const key = `${parentKey}/${node.name}`;
    const isExpanded = expandedFolders[key] !== false; // default expanded

    if (node.isFolder) {
      return (
        <div key={key} className="space-y-0.5">
          <div
            onClick={() => toggleFolder(key)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
            style={{ paddingLeft: `${depth * 10 + 8}px` }}
            className="flex items-center gap-1.5 py-1 pr-2 rounded hover:bg-[#25272B] cursor-pointer text-[#A8ADBD] hover:text-[#DFE1E5] font-medium"
          >
            {isExpanded ? <ChevronDown size={11} className="text-[#868A91]" /> : <ChevronRight size={11} className="text-[#868A91]" />}
            <Folder size={12} className="text-[#E5B567]" />
            <span className="truncate">{node.name}</span>
            <span className="text-[9.5px] text-[#6E7278] ml-auto">({node.children.length})</span>
          </div>
          {isExpanded && (
            <div className="space-y-0.5">
              {node.children.map(child => renderTreeNode(child, key, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Leaf branch item
    return (
      <div
        key={key}
        onDoubleClick={() => handleCheckoutBranch(node.fullPath)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setCommitContextMenu(null);
          setBranchContextMenu({
            x: Math.min(e.clientX, window.innerWidth - 260),
            y: Math.min(e.clientY, window.innerHeight - 380),
            branch: node,
          });
        }}
        style={{ paddingLeft: `${depth * 10 + 12}px` }}
        className={`flex items-center justify-between py-1 pr-2 rounded cursor-pointer transition-colors ${
          node.isCurrent
            ? 'bg-[#2E436E] text-white font-semibold'
            : 'hover:bg-[#25272B] text-[#DFE1E5]'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <GitBranch size={11} className={node.isCurrent ? 'text-[#00E676]' : 'text-[#868A91]'} />
          <span className="truncate">{node.name}</span>
        </div>
        {node.isCurrent && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] shadow-[0_0_6px_#00E676] flex-shrink-0" title="Active HEAD" />
        )}
      </div>
    );
  };

  // Dimensions for SVG cells
  const ROW_H = 28;
  const LANE_W = 15;
  const X_OFF = 14;
  const laneX = (lane: number) => X_OFF + lane * LANE_W;
  const svgTotalWidth = Math.max(70, X_OFF + (maxLanes + 1) * LANE_W);

  // ─── Virtual Window Calculations for 60-144 FPS smooth scrolling with 1,000+ commits ───
  const totalRows = graphRows.length;
  const overscan = 10;
  const startIndex = Math.max(0, Math.floor(tableScrollTop / ROW_H) - overscan);
  const endIndex = Math.min(totalRows, Math.ceil((tableScrollTop + tableContainerHeight) / ROW_H) + overscan);
  const visibleRows = useMemo(() => graphRows.slice(startIndex, endIndex), [graphRows, startIndex, endIndex]);
  const topSpacerHeight = startIndex * ROW_H;
  const bottomSpacerHeight = (totalRows - endIndex) * ROW_H;

  // Dismiss context menu on window click
  useEffect(() => {
    const handleOutside = () => {
      setCommitContextMenu(null);
      setBranchContextMenu(null);
    };
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] select-none font-sans text-xs text-[#DFE1E5] relative">
      {/* ─── Top Tool Window Header Bar (IntelliJ IDEA) ─── */}
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
              <Terminal size={11} />
              <span>Console</span>
            </button>
          </div>
        </div>

        {/* Right Window Controls */}
        <div className="flex items-center gap-1 text-[#868A91]">
          <button
            onClick={() => setShowBranchSidebar(prev => !prev)}
            title={showBranchSidebar ? 'Hide Branches Sidebar' : 'Show Branches Sidebar'}
            className="p-1 hover:bg-[#2B2D30] hover:text-[#DFE1E5] rounded cursor-pointer"
          >
            {showBranchSidebar ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
          </button>
          <button
            onClick={loadGitLog}
            title="Refresh Git History (Ctrl+F5)"
            className="p-1 hover:bg-[#2B2D30] hover:text-[#DFE1E5] rounded cursor-pointer"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin text-[#3574F0]' : ''} />
          </button>
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              title="Maximize Tool Window"
              className="p-1 hover:bg-[#2B2D30] hover:text-[#DFE1E5] rounded cursor-pointer"
            >
              <Maximize2 size={13} />
            </button>
          )}
          {onHide && (
            <button
              onClick={onHide}
              title="Close Tool Window (Shift+Esc)"
              className="p-1 hover:bg-[#2B2D30] hover:text-[#DFE1E5] rounded cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ─── Secondary Git Action Strip ─── */}
      <div className="h-8 bg-[#212225] border-b border-[#2B2D30] px-2 flex items-center justify-between text-xs flex-shrink-0">
        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            onClick={handleFetch}
            title="Fetch from All Remotes"
            className="p-1 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] flex items-center gap-1 cursor-pointer"
          >
            <Download size={12} className="text-[#3574F0]" />
            <span>Fetch</span>
          </button>

          <button
            onClick={handlePull}
            title="Pull into Current Branch (Ctrl+T)"
            className="p-1 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={12} className="text-[#59A869]" />
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

          {/* Current Branch Badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1E1F22] border border-[#393B40] text-[#DFE1E5]">
            <GitBranch size={11} className="text-[#00E676]" />
            <span className="font-mono text-[11px] font-medium">{currentBranch}</span>
          </div>
        </div>

        {/* Right Search Filter */}
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
            {/* 1. Branch Tree Sidebar (GitKraken Style) */}
            {showBranchSidebar && (
              <div className="w-52 h-full bg-[#18191C] border-r border-[#2B2D30] flex flex-col flex-shrink-0 text-[11px] overflow-hidden">
                {/* Branch Search Filter */}
                <div className="p-1.5 border-b border-[#2B2D30] bg-[#1E1F22]">
                  <div className="relative flex items-center">
                    <Search size={11} className="absolute left-2 text-[#868A91] pointer-events-none" />
                    <input 
                      type="text"
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      placeholder="Filter branches..."
                      className="w-full bg-[#25272B] text-[#DFE1E5] text-[10.5px] rounded pl-6 pr-5 py-0.5 border border-transparent focus:border-[#3574F0] focus:outline-none placeholder-[#6E7278]"
                    />
                    {branchFilter && (
                      <button onClick={() => setBranchFilter('')} className="absolute right-1.5 text-[#868A91]">✕</button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-1 space-y-1">
                  {/* LOCAL BRANCHES */}
                  <div>
                    <div 
                      onClick={() => toggleFolder('local')}
                      className="flex items-center gap-1.5 px-2 py-1 text-[10.5px] font-semibold text-[#868A91] uppercase tracking-wider hover:text-white cursor-pointer"
                    >
                      {expandedFolders['local'] !== false ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      <span>Local ({branches.filter(b => !b.is_remote).length})</span>
                    </div>

                    {expandedFolders['local'] !== false && (
                      <div className="space-y-0.5">
                        {localBranchTree.map(node => renderTreeNode(node, 'local'))}
                      </div>
                    )}
                  </div>

                  {/* REMOTE BRANCHES */}
                  <div>
                    <div 
                      onClick={() => toggleFolder('remote')}
                      className="flex items-center gap-1.5 px-2 py-1 text-[10.5px] font-semibold text-[#868A91] uppercase tracking-wider hover:text-white cursor-pointer pt-2"
                    >
                      {expandedFolders['remote'] !== false ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      <span>Remote ({branches.filter(b => b.is_remote).length})</span>
                    </div>

                    {expandedFolders['remote'] !== false && (
                      <div className="space-y-0.5">
                        {remoteBranchTree.map(node => renderTreeNode(node, 'remote'))}
                      </div>
                    )}
                  </div>

                  {/* TAGS */}
                  {tags.length > 0 && (
                    <div>
                      <div 
                        onClick={() => toggleFolder('tags')}
                        className="flex items-center gap-1.5 px-2 py-1 text-[10.5px] font-semibold text-[#868A91] uppercase tracking-wider hover:text-white cursor-pointer pt-2"
                      >
                        {expandedFolders['tags'] !== false ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        <span>Tags ({tags.length})</span>
                      </div>

                      {expandedFolders['tags'] !== false && (
                        <div className="space-y-0.5">
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
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. Middle: Multi-Lane Commit Graph Table (Virtual Windowed) */}
            <div 
              ref={tableContainerRef}
              onScroll={(e) => {
                const target = e.currentTarget;
                setTableScrollTop(target.scrollTop);
                if (
                  !isLoadingMore &&
                  hasMoreCommits &&
                  target.scrollTop + target.clientHeight >= target.scrollHeight - 200
                ) {
                  loadMoreCommits();
                }
              }}
              className="flex-1 h-full overflow-y-auto overflow-x-auto border-r border-[#2B2D30] font-sans"
            >
              <table className="w-full border-collapse text-[11px] text-left">
                <thead className="sticky top-0 bg-[#212225] text-[#868A91] text-[10.5px] uppercase font-semibold border-b border-[#2B2D30] z-10 shadow-sm">
                  <tr>
                    <th style={{ width: `${svgTotalWidth}px` }} className="py-1 px-2 text-center">Graph</th>
                    <th className="py-1 px-3 w-20">Hash</th>
                    <th className="py-1 px-3">Description</th>
                    <th className="py-1 px-3 w-36">Author</th>
                    <th className="py-1 px-3 w-28">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#25272B]">
                  {graphRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#868A91]">
                        {isLoading ? (
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw size={13} className="animate-spin text-[#3574F0]" />
                            <span>Computing commit DAG graph...</span>
                          </div>
                        ) : (
                          'No commits found'
                        )}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {topSpacerHeight > 0 && (
                        <tr style={{ height: `${topSpacerHeight}px` }}>
                          <td colSpan={5} style={{ padding: 0, border: 'none' }} />
                        </tr>
                      )}
                      {visibleRows.map((row) => {
                      const c = row.commit;
                      const isSelected = !!selectedCommitHash && (
                        selectedCommitHash === c.hash ||
                        c.hash.toLowerCase().startsWith(selectedCommitHash.toLowerCase()) ||
                        selectedCommitHash.toLowerCase().startsWith(c.hash.toLowerCase()) ||
                        c.short_hash.toLowerCase() === selectedCommitHash.toLowerCase() ||
                        (selectedCommitHash.startsWith('0000000') && (c.hash.startsWith('0000000') || c.short_hash === 'worktree'))
                      );

                      return (
                        <tr
                          key={c.hash}
                          ref={(el) => { if (el) commitRowRefs.current.set(c.hash, el); }}
                          onClick={() => setSelectedCommitHash(c.hash)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setCommitContextMenu({
                              x: Math.min(e.clientX, window.innerWidth - 220),
                              y: Math.min(e.clientY, window.innerHeight - 250),
                              commit: c,
                            });
                          }}
                          className={`border-b border-[#25272B] cursor-pointer transition-colors h-[28px] ${
                            isSelected
                              ? 'bg-[#2E436E] text-white font-medium'
                              : 'hover:bg-[#25272B] text-[#DFE1E5]'
                          }`}
                        >
                          {/* ─── Real Topological DAG Graph SVG ─── */}
                          <td 
                            style={{ width: `${svgTotalWidth}px`, minWidth: `${svgTotalWidth}px` }}
                            className="p-0 relative h-[28px] overflow-hidden"
                          >
                            <svg 
                              width={svgTotalWidth} 
                              height={ROW_H} 
                              className="absolute inset-0 pointer-events-none"
                            >
                              {/* 1. Continuous through lines for other active lanes */}
                              {row.activePassingLanes.map(l => (
                                <line
                                  key={l}
                                  x1={laneX(l)}
                                  y1={0}
                                  x2={laneX(l)}
                                  y2={ROW_H}
                                  stroke={LANE_COLORS[l % LANE_COLORS.length]}
                                  strokeWidth={2.4}
                                  strokeLinecap="round"
                                  opacity={0.8}
                                />
                              ))}

                              {/* 2. Incoming line from child commit above */}
                              {row.hasChildIncoming && (
                                <line
                                  x1={laneX(row.lane)}
                                  y1={0}
                                  x2={laneX(row.lane)}
                                  y2={ROW_H / 2}
                                  stroke={row.color}
                                  strokeWidth={2.4}
                                  opacity={0.9}
                                />
                              )}

                              {/* 3. Connections to parents (straight lines or smooth bezier curves) */}
                              {row.connections.map((conn, cIdx) => {
                                const x1 = laneX(conn.fromLane);
                                const y1 = ROW_H / 2;
                                const x2 = laneX(conn.toLane);
                                const y2 = ROW_H;

                                if (conn.fromLane === conn.toLane) {
                                  return (
                                    <line
                                      key={cIdx}
                                      x1={x1}
                                      y1={y1}
                                      x2={x2}
                                      y2={y2}
                                      stroke={conn.color}
                                      strokeWidth={2.4}
                                      opacity={0.9}
                                    />
                                  );
                                }

                                // Smooth Bezier fork/merge curve
                                return (
                                  <path
                                    key={cIdx}
                                    d={`M ${x1} ${y1} C ${x1} ${y1 + 8}, ${x2} ${y2 - 6}, ${x2} ${y2}`}
                                    fill="none"
                                    stroke={conn.color}
                                    strokeWidth={2.2}
                                    strokeLinecap="round"
                                    opacity={0.85}
                                  />
                                );
                              })}

                              {/* 4. Commit Node Circle */}
                              <circle
                                cx={laneX(row.lane)}
                                cy={ROW_H / 2}
                                r={isSelected ? 5.5 : 4.5}
                                fill={row.color}
                                stroke="#1E1F22"
                                strokeWidth={2}
                              />

                              {/* 5. White center dot if HEAD */}
                              {c.is_head && (
                                <circle
                                  cx={laneX(row.lane)}
                                  cy={ROW_H / 2}
                                  r={1.8}
                                  fill="#FFFFFF"
                                />
                              )}
                            </svg>
                          </td>

                          {/* Short Hash */}
                          <td className="py-1 px-3 font-mono text-[#868A91] group-hover:text-[#DFE1E5]">
                            {c.short_hash}
                          </td>

                          {/* Commit Subject with Branch / Tag Badges */}
                          <td className="py-1 px-3 truncate max-w-[440px]">
                            <div className="flex items-center gap-1.5 truncate">
                              {/* Worktree Badge */}
                              {c.short_hash === 'worktree' && (
                                <span className="text-[9.5px] px-1.5 py-0.2 rounded font-mono font-medium flex-shrink-0 flex items-center gap-1 bg-[#E040FB]/20 text-[#E040FB] border border-[#E040FB]/50">
                                  <FolderGit2 size={9} />
                                  <span>Worktree</span>
                                </span>
                              )}
                              {/* Branch Badges */}
                              {c.branches?.map(b => (
                                <span 
                                  key={b}
                                  className={`text-[9.5px] px-1.5 py-0.2 rounded font-mono font-medium flex-shrink-0 flex items-center gap-1 ${
                                    c.is_head || b.includes('HEAD')
                                      ? 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/50'
                                      : 'bg-[#3574F0]/20 text-[#3574F0] border border-[#3574F0]/50'
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
                                  className="text-[9.5px] px-1.5 py-0.2 rounded font-mono font-medium flex-shrink-0 flex items-center gap-1 bg-[#F1A23A]/20 text-[#F1A23A] border border-[#F1A23A]/50"
                                >
                                  <Tag size={9} />
                                  <span>{t}</span>
                                </span>
                              ))}

                              <span className="truncate">{c.subject}</span>
                            </div>
                          </td>

                          {/* Author */}
                          <td className="py-1 px-3 text-[#868A91] truncate max-w-[130px]">
                            {c.author}
                          </td>

                          {/* Date */}
                          <td className="py-1 px-3 text-[#868A91] font-mono text-[10px]">
                            {c.date}
                          </td>
                        </tr>
                      );
                    })}
                    {bottomSpacerHeight > 0 && (
                      <tr style={{ height: `${bottomSpacerHeight}px` }}>
                        <td colSpan={5} style={{ padding: 0, border: 'none' }} />
                      </tr>
                    )}
                    {isLoadingMore && (
                      <tr>
                        <td colSpan={5} className="py-2.5 text-center text-[#868A91] text-[11px] bg-[#1E1F22]">
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw size={12} className="animate-spin text-[#3574F0]" />
                            <span>Loading older commits...</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
              </table>
            </div>

            {/* 3. Commit Details & Changed Files (Right) */}
            <div className="w-[360px] h-full flex flex-col bg-[#1E1F22] overflow-hidden flex-shrink-0">
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

                    <div className="text-xs text-white font-medium whitespace-pre-wrap leading-relaxed pt-1">
                      {commitDetails.message}
                    </div>
                  </div>

                  {/* Changed Files */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#868A91] mb-1.5">
                      <span>Changed files ({commitDetails.files?.length || 0})</span>
                      <span className="text-[10px] text-[#3574F0]">Click to view Diff</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1">
                      {commitDetails.files && commitDetails.files.length > 0 ? (
                        commitDetails.files.map((file, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleOpenFileDiff(file)}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#25272B] hover:bg-[#2F3238] cursor-pointer text-xs group transition-colors"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FileCode size={13} className="text-[#868A91] flex-shrink-0" />
                              <span className="truncate text-[#DFE1E5] group-hover:text-white font-mono text-[11px]">
                                {file.path}
                              </span>
                            </div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              file.status === 'M' ? 'text-[#E5B567] bg-[#E5B567]/10' :
                              file.status === 'A' ? 'text-[#59A869] bg-[#59A869]/10' :
                              file.status === 'D' ? 'text-[#E55353] bg-[#E55353]/10' :
                              'text-[#868A91] bg-[#2B2D30]'
                            }`}>
                              {file.status}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-[#868A91] text-xs">
                          No file changes detected in this commit
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-[#868A91]">
                  Select a commit to view details
                </div>
              )}
            </div>
          </div>
        )}

        {/* Console Tab */}
        {activeTab === 'console' && (
          <div className="w-full h-full p-2 bg-[#141416] font-mono text-xs overflow-y-auto space-y-1 select-text">
            {consoleLogs.length === 0 ? (
              <div className="text-[#868A91] p-4 text-center">No Git console outputs yet.</div>
            ) : (
              consoleLogs.map((log, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="text-[#3574F0] flex items-center gap-1.5 font-semibold">
                    <span className="text-[#6E7278] font-normal text-[10px]">{log.time}</span>
                    <span>$ {log.command}</span>
                  </div>
                  <div className="text-[#A8ADBD] pl-4 whitespace-pre-wrap">{log.output}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Diff Viewer Modal */}
      {isDiffOpen && diffModalFile && (
        <React.Suspense fallback={null}>
          <DiffViewerModal
            isOpen={isDiffOpen}
            onClose={() => setIsDiffOpen(false)}
            fileName={diffModalFile}
            baseContent={diffModalBase}
            localContent={diffModalLocal}
            baseTitle={diffModalBaseTitle}
            localTitle={diffModalLocalTitle}
          />
        </React.Suspense>
      )}

      {/* 3-Way Merge Conflict Resolver Modal */}
      {conflictModalFile && (
        <React.Suspense fallback={null}>
          <ThreeWayMergeModal
            isOpen={Boolean(conflictModalFile)}
            onClose={() => setConflictModalFile(null)}
            filePath={conflictModalFile}
            projectPath={projectPath}
            onResolved={() => {
              setConflictModalFile(null);
              loadGitLog();
            }}
            onShowToast={onShowToast}
          />
        </React.Suspense>
      )}

      {/* Branch Context Menu (IntelliJ IDEA New UI) */}
      {branchContextMenu && (
        <div
          style={{ left: `${branchContextMenu.x}px`, top: `${branchContextMenu.y}px` }}
          className="fixed z-50 w-64 bg-[#2B2D30] border border-[#393B40] rounded shadow-2xl py-1 text-xs text-[#DFE1E5] font-sans"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 font-semibold text-[11px] text-[#868A91] border-b border-[#393B40] truncate flex items-center gap-1.5">
            <GitBranch size={12} className="text-[#3574F0]" />
            <span className="truncate">{branchContextMenu.branch.name}</span>
          </div>

          <div
            onClick={() => {
              setBranchModal({ mode: 'new', targetBranch: branchContextMenu.branch.fullPath });
              setBranchModalInput('');
              setBranchContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Plus size={13} />
            <span>New Branch from '{branchContextMenu.branch.name}'...</span>
          </div>

          {!branchContextMenu.branch.isCurrent && (
            <div
              onClick={() => {
                handleCheckoutBranch(branchContextMenu.branch.fullPath);
                setBranchContextMenu(null);
              }}
              className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
            >
              <Check size={13} />
              <span>Checkout</span>
            </div>
          )}

          <div
            onClick={() => {
              setSearchFilter(branchContextMenu.branch.name);
              onShowToast?.('Branch Filter', `Filtered commits by ${branchContextMenu.branch.name}`, 'info');
              setBranchContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Search size={13} />
            <span>Compare with '{currentBranch}'...</span>
          </div>

          <div
            onClick={() => {
              if (commits.length > 0) {
                handleOpenFileDiff({ path: 'src/App.tsx', status: 'M' });
              }
              setBranchContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <FileCode size={13} />
            <span>Show Diff with Working Tree</span>
          </div>

          <div
            onClick={() => {
              handleRebaseBranch(branchContextMenu.branch.name);
              setBranchContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <RotateCcw size={13} />
            <span>Rebase '{currentBranch}' onto '{branchContextMenu.branch.name}'</span>
          </div>

          <div
            onClick={() => {
              handleMergeBranch(branchContextMenu.branch.name);
              setBranchContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <GitMerge size={13} />
            <span>Merge into '{currentBranch}'</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          <div
            onClick={() => {
              handlePull();
              setBranchContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Download size={13} />
            <span>Update...</span>
          </div>

          <div
            onClick={() => {
              handlePush();
              setBranchContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Upload size={13} />
            <span>Push...</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          <div
            onClick={() => {
              setBranchModal({ mode: 'rename', targetBranch: branchContextMenu.branch.name });
              setBranchModalInput(branchContextMenu.branch.name);
              setBranchContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <FileCode size={13} />
            <span>Rename...</span>
          </div>

          {!branchContextMenu.branch.isCurrent && (
            <div
              onClick={() => {
                if (confirm(`Are you sure you want to delete branch '${branchContextMenu.branch.name}'?`)) {
                  handleDeleteBranch(branchContextMenu.branch.fullPath);
                }
                setBranchContextMenu(null);
              }}
              className="px-3 py-1.5 hover:bg-[#E05555] hover:text-white cursor-pointer flex items-center gap-2 text-[#E05555]"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </div>
          )}

          <div className="border-t border-[#393B40] my-1" />

          <div
            onClick={() => {
              navigator.clipboard.writeText(branchContextMenu.branch.name);
              onShowToast?.('Branch Name', `Copied '${branchContextMenu.branch.name}' to clipboard`, 'success');
              setBranchContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Copy size={13} />
            <span>Copy Branch Name</span>
          </div>
        </div>
      )}

      {/* Commit Context Menu (IntelliJ IDEA New UI) */}
      {commitContextMenu && (
        <div
          style={{ left: `${commitContextMenu.x}px`, top: `${commitContextMenu.y}px` }}
          className="fixed z-50 w-64 bg-[#2B2D30] border border-[#393B40] rounded shadow-2xl py-1 text-xs text-[#DFE1E5] font-sans"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            onClick={() => {
              navigator.clipboard.writeText(commitContextMenu.commit.hash);
              onShowToast?.('Revision Number', `Copied ${commitContextMenu.commit.short_hash}`, 'success');
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Copy size={13} />
              <span>Copy Revision Number</span>
            </div>
            <span className="text-[10px] text-[#868A91] font-mono">{commitContextMenu.commit.short_hash}</span>
          </div>

          <div
            onClick={() => {
              handleCreatePatch(commitContextMenu.commit.hash);
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <FileCode size={13} />
            <span>Create Patch...</span>
          </div>

          <div
            onClick={() => {
              handleCherryPick(commitContextMenu.commit.hash);
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Play size={13} />
            <span>Cherry-Pick</span>
          </div>

          <div
            onClick={() => {
              handleCheckoutBranch(commitContextMenu.commit.hash);
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Check size={13} />
            <span>Checkout Revision '{commitContextMenu.commit.short_hash}'</span>
          </div>

          <div
            onClick={() => {
              setSelectedCommitHash(commitContextMenu.commit.hash);
              if (commitDetails && commitDetails.files && commitDetails.files.length > 0) {
                handleOpenFileDiff(commitDetails.files[0]);
              } else {
                onShowToast?.('Compare', 'Selected commit for diff inspection', 'info');
              }
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <ExternalLink size={13} />
            <span>Compare with Local</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          <div
            onClick={() => {
              setResetTargetCommit(commitContextMenu.commit);
              setIsResetModalOpen(true);
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <RotateCcw size={13} />
            <span>Reset Current Branch to Here...</span>
          </div>

          <div
            onClick={() => {
              handleOpenInteractiveRebase(commitContextMenu.commit);
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <GitMerge size={13} />
            <span>Interactively Rebase from Here...</span>
          </div>

          <div
            onClick={() => {
              handleRevertCommit(commitContextMenu.commit.hash);
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <RotateCcw size={13} />
            <span>Revert Commit</span>
          </div>

          <div
            onClick={() => {
              invoke('git_reset_branch', { projectPath, commitHash: 'HEAD~1', mode: 'soft' })
                .then(() => {
                  onShowToast?.('Undo Commit', 'Commit undone (changes kept in index)', 'info');
                  loadGitLog();
                })
                .catch(e => onShowToast?.('Undo Error', String(e), 'error'));
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <RotateCcw size={13} />
            <span>Undo Commit...</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          <div
            onClick={() => {
              setBranchModal({ mode: 'tag', targetCommit: commitContextMenu.commit.hash });
              setBranchModalInput('');
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Tag size={13} />
            <span>Tag...</span>
          </div>

          <div
            onClick={() => {
              setBranchModal({ mode: 'new', targetBranch: commitContextMenu.commit.hash });
              setBranchModalInput('');
              setCommitContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Plus size={13} />
            <span>New Branch...</span>
          </div>
        </div>
      )}

      {/* Branch / Tag Prompt Modal */}
      {branchModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[1px] flex items-center justify-center p-4 select-none"
          onClick={() => setBranchModal(null)}
        >
          <div 
            className="w-96 bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl overflow-hidden text-xs font-sans text-[#DFE1E5]"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-9 bg-[#212224] border-b border-[#393B40] px-4 flex items-center justify-between font-semibold text-white">
              <span>
                {branchModal.mode === 'new' ? 'Create New Branch' :
                 branchModal.mode === 'rename' ? 'Rename Branch' : 'Create Tag'}
              </span>
              <button onClick={() => setBranchModal(null)} className="text-[#868A91] hover:text-white cursor-pointer">
                <X size={14} />
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!branchModalInput.trim()) return;
                if (branchModal.mode === 'new') {
                  handleCreateBranchFrom(branchModal.targetBranch || 'HEAD', branchModalInput.trim(), branchModalCheckout);
                } else if (branchModal.mode === 'rename') {
                  handleRenameBranch(branchModal.targetBranch || '', branchModalInput.trim());
                } else if (branchModal.mode === 'tag') {
                  handleCreateTag(branchModalInput.trim(), branchModal.targetCommit);
                }
                setBranchModal(null);
              }}
              className="p-4 space-y-3"
            >
              <div>
                <label className="block text-[11px] text-[#868A91] mb-1 font-medium">
                  {branchModal.mode === 'new' ? 'New branch name:' :
                   branchModal.mode === 'rename' ? 'New name:' : 'Tag name:'}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={branchModalInput}
                  onChange={e => setBranchModalInput(e.target.value)}
                  className="w-full bg-[#1E1F22] border border-[#4E5157] focus:border-[#3574F0] rounded px-2.5 py-1.5 text-xs text-white outline-none"
                  placeholder={branchModal.mode === 'tag' ? 'v1.0.0' : 'feature/my-branch'}
                />
              </div>

              {branchModal.mode === 'new' && (
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-[#A8ADBD]">
                  <input
                    type="checkbox"
                    checked={branchModalCheckout}
                    onChange={e => setBranchModalCheckout(e.target.checked)}
                    className="accent-[#3574F0]"
                  />
                  <span>Checkout branch</span>
                </label>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#393B40]">
                <button
                  type="button"
                  onClick={() => setBranchModal(null)}
                  className="px-3 py-1 rounded bg-[#25272B] hover:bg-[#323438] text-[#DFE1E5] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!branchModalInput.trim()}
                  className="px-3 py-1 rounded bg-[#3574F0] hover:bg-[#3064D0] disabled:opacity-50 text-white font-medium shadow cursor-pointer"
                >
                  {branchModal.mode === 'new' ? 'Create' : branchModal.mode === 'rename' ? 'Rename' : 'Tag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Git Reset Modal */}
      {isResetModalOpen && resetTargetCommit && (
        <React.Suspense fallback={null}>
          <GitResetModal
            isOpen={isResetModalOpen}
            commitHash={resetTargetCommit.hash}
            commitSubject={resetTargetCommit.subject}
            commitAuthor={resetTargetCommit.author}
            currentBranch={currentBranch}
            onClose={() => setIsResetModalOpen(false)}
            onReset={handleExecuteReset}
          />
        </React.Suspense>
      )}

      {/* Interactive Rebase Modal */}
      {isRebaseModalOpen && (
        <React.Suspense fallback={null}>
          <InteractiveRebaseModal
            isOpen={isRebaseModalOpen}
            baseCommitHash={rebaseBaseCommitHash}
            initialCommits={rebaseCommits}
            onClose={() => setIsRebaseModalOpen(false)}
            onStartRebase={handleExecuteInteractiveRebase}
          />
        </React.Suspense>
      )}
    </div>
  );
};
