import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  GitBranch,
  Search,
  Plus,
  Check,
  ChevronRight,
  ChevronDown,
  Tag,
  Settings,
  Star,
  Trash2,
  GitMerge,
  FileDiff,
  ArrowRight,
  Loader2,
  AlertCircle,
  X,
  RotateCw,
  GitPullRequest,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export interface GitBranchItem {
  name: string;
  short_name: string;
  is_current: boolean;
  is_remote: boolean;
  upstream?: string | null;
}

export interface GitBranchPopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentBranch: string;
  projectPath?: string;
  onSwitchBranch: (branch: string) => void;
  onCreateBranch?: (branch: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onRefreshGitStatus?: () => void;
}

export const GitBranchPopup: React.FC<GitBranchPopupProps> = ({
  isOpen,
  onClose,
  currentBranch,
  projectPath = 'D:\\IDE',
  onSwitchBranch,
  onCreateBranch,
  onShowToast,
  onRefreshGitStatus,
}) => {
  const [branches, setBranches] = useState<GitBranchItem[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Collapsible Tree state
  const [isLocalExpanded, setIsLocalExpanded] = useState(true);
  const [isRemoteExpanded, setIsRemoteExpanded] = useState(true);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [expandedRemotes, setExpandedRemotes] = useState<Record<string, boolean>>({ origin: true });

  // Creation & Revision Mode states
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [checkoutNewBranch, setCheckoutNewBranch] = useState(true);

  const [isCheckingOutRevision, setIsCheckingOutRevision] = useState(false);
  const [revisionInput, setRevisionInput] = useState('');

  // Flyout Submenu State
  const [selectedBranch, setSelectedBranch] = useState<GitBranchItem | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<{ top: number } | null>(null);

  // Favorites state (stored in localStorage)
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('intellij_git_favorite_branches');
      return stored ? JSON.parse(stored) : ['main', 'master', 'origin/main', 'origin/master'];
    } catch {
      return ['main', 'master', 'origin/main', 'origin/master'];
    }
  });

  const popupRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const newBranchInputRef = useRef<HTMLInputElement>(null);
  const revisionInputRef = useRef<HTMLInputElement>(null);

  const toast = (title: string, msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    if (onShowToast) {
      onShowToast(title, msg, type);
    } else {
      console.log(`[Toast ${type}] ${title}: ${msg}`);
    }
  };

  const toggleFavorite = (branchName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(branchName)
        ? prev.filter(b => b !== branchName)
        : [...prev, branchName];
      try {
        localStorage.setItem('intellij_git_favorite_branches', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Fetch branches and tags from Rust backend
  const fetchGitData = async () => {
    if (!isOpen) return;
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        // Fetch branches
        const branchList = await invoke<any[]>('git_list_branches', { projectPath });
        if (Array.isArray(branchList)) {
          const parsed: GitBranchItem[] = branchList.map((item) => {
            if (typeof item === 'string') {
              return {
                name: item,
                short_name: item,
                is_current: item === currentBranch,
                is_remote: item.startsWith('origin/') || item.startsWith('remotes/'),
              };
            }
            const shortName = item.short_name || item.name || '';
            return {
              name: item.name || shortName,
              short_name: shortName,
              is_current: item.is_current ?? (shortName === currentBranch || item.name === currentBranch),
              is_remote: item.is_remote ?? false,
              upstream: item.upstream || null,
            };
          });
          setBranches(parsed);
        }

        // Fetch tags
        try {
          const tagList = await invoke<string[]>('git_get_tags', { projectPath });
          if (Array.isArray(tagList)) {
            setTags(tagList);
          }
        } catch (tagErr) {
          console.warn('Failed to fetch tags:', tagErr);
        }
      } else {
        // Web preview fallback
        setBranches([
          { name: 'main', short_name: 'main', is_current: currentBranch === 'main', is_remote: false, upstream: 'origin/main' },
          { name: 'dev', short_name: 'dev', is_current: currentBranch === 'dev', is_remote: false, upstream: 'origin/dev' },
          { name: 'origin/main', short_name: 'origin/main', is_current: false, is_remote: true },
          { name: 'origin/dev', short_name: 'origin/dev', is_current: false, is_remote: true },
        ]);
        setTags(['v1.0.0', 'v1.1.0']);
      }
    } catch (err: any) {
      setErrorMsg(typeof err === 'string' ? err : err?.message || 'Failed to list Git branches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedBranch(null);
      setIsCreatingBranch(false);
      setIsCheckingOutRevision(false);
      setSearchQuery('');
      fetchGitData();

      // Auto-focus search input
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, projectPath, currentBranch]);

  // Click outside and Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedBranch) {
          setSelectedBranch(null);
          setSubmenuPosition(null);
        } else if (isCreatingBranch) {
          setIsCreatingBranch(false);
        } else if (isCheckingOutRevision) {
          setIsCheckingOutRevision(false);
        } else {
          onClose();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setIsCreatingBranch(true);
        setTimeout(() => newBranchInputRef.current?.focus(), 50);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, selectedBranch, isCreatingBranch, isCheckingOutRevision]);

  // Filtered branches & tags based on search query
  const filteredBranches = useMemo(() => {
    if (!searchQuery.trim()) return branches;
    const q = searchQuery.toLowerCase().trim();
    return branches.filter(
      (b) => b.short_name.toLowerCase().includes(q) || b.name.toLowerCase().includes(q)
    );
  }, [branches, searchQuery]);

  const localBranches = useMemo(() => filteredBranches.filter((b) => !b.is_remote), [filteredBranches]);
  const remoteBranches = useMemo(() => filteredBranches.filter((b) => b.is_remote), [filteredBranches]);

  // Group remote branches by remote prefix (e.g., origin)
  const remoteGroups = useMemo(() => {
    const groups: Record<string, GitBranchItem[]> = {};
    remoteBranches.forEach(b => {
      const parts = b.short_name.split('/');
      const remoteName = parts.length > 1 ? parts[0] : 'origin';
      if (!groups[remoteName]) groups[remoteName] = [];
      groups[remoteName].push(b);
    });
    return groups;
  }, [remoteBranches]);

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const q = searchQuery.toLowerCase().trim();
    return tags.filter(t => t.toLowerCase().includes(q));
  }, [tags, searchQuery]);

  if (!isOpen) return null;

  // ─── Git Actions ───

  const handleCheckout = async (targetBranch: GitBranchItem): Promise<boolean> => {
    const isRemote = targetBranch.is_remote;
    const branchToCheckout = isRemote
      ? targetBranch.short_name.replace(/^[^\/]+\//, '')
      : targetBranch.short_name;

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_checkout_branch', {
          projectPath,
          branch: targetBranch.short_name,
          createNew: false,
        });
      }
      onSwitchBranch(branchToCheckout);
      toast('Switched Branch', `Checked out branch [${branchToCheckout}]`, 'info');
      if (onRefreshGitStatus) onRefreshGitStatus();
      onClose();
      return true;
    } catch (err: any) {
      toast('Checkout Failed', typeof err === 'string' ? err : err?.message || 'Error checking out branch', 'error');
      return false;
    }
  };

  const handleCreateNewBranch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = newBranchName.trim();
    if (!trimmed) return;

    if (branches.some(b => b.short_name === trimmed)) {
      setErrorMsg(`Branch "${trimmed}" already exists.`);
      return;
    }

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_checkout_branch', {
          projectPath,
          branch: trimmed,
          createNew: true,
        });
      }
      if (checkoutNewBranch) {
        onSwitchBranch(trimmed);
      }
      if (onCreateBranch) {
        onCreateBranch(trimmed);
      }
      toast('Branch Created', `Created ${checkoutNewBranch ? 'and checked out ' : ''}[${trimmed}]`, 'success');
      if (onRefreshGitStatus) onRefreshGitStatus();
      onClose();
    } catch (err: any) {
      setErrorMsg(typeof err === 'string' ? err : err?.message || 'Failed to create branch');
    }
  };

  const handleCreateBranchFromSelected = async (targetBranch: GitBranchItem) => {
    const defaultNewName = `feature/${targetBranch.short_name.replace(/^[^\/]+\//, '')}-copy`;
    const promptName = window.prompt(`New branch name from '${targetBranch.short_name}':`, defaultNewName);
    if (!promptName || !promptName.trim()) return;

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_create_branch_from', {
          projectPath,
          newBranch: promptName.trim(),
          startPoint: targetBranch.short_name,
          checkout: true,
        });
      }
      onSwitchBranch(promptName.trim());
      toast('Branch Created', `Created and checked out [${promptName.trim()}] from [${targetBranch.short_name}]`, 'success');
      if (onRefreshGitStatus) onRefreshGitStatus();
      onClose();
    } catch (err: any) {
      toast('Create Branch Failed', typeof err === 'string' ? err : err?.message, 'error');
    }
  };

  const handleCheckoutRevision = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const rev = revisionInput.trim();
    if (!rev) return;

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_checkout_branch', {
          projectPath,
          branch: rev,
          createNew: false,
        });
      }
      onSwitchBranch(rev);
      toast('Checked Out Revision', `Checked out tag/revision [${rev}]`, 'info');
      if (onRefreshGitStatus) onRefreshGitStatus();
      onClose();
    } catch (err: any) {
      toast('Checkout Failed', typeof err === 'string' ? err : err?.message, 'error');
    }
  };

  const handleMergeIntoCurrent = async (sourceBranch: GitBranchItem) => {
    if (!window.confirm(`Merge '${sourceBranch.short_name}' into '${currentBranch}'?`)) return;

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_merge_branch', {
          projectPath,
          branch: sourceBranch.short_name,
        });
      }
      toast('Merge Succeeded', `Merged [${sourceBranch.short_name}] into [${currentBranch}]`, 'success');
      if (onRefreshGitStatus) onRefreshGitStatus();
      onClose();
    } catch (err: any) {
      toast('Merge Conflict or Error', typeof err === 'string' ? err : err?.message, 'error');
    }
  };

  const handleRebaseOnto = async (upstreamBranch: GitBranchItem) => {
    if (!window.confirm(`Rebase '${currentBranch}' onto '${upstreamBranch.short_name}'?`)) return;

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_rebase_branch', {
          projectPath,
          upstream: upstreamBranch.short_name,
        });
      }
      toast('Rebase Complete', `Rebased [${currentBranch}] onto [${upstreamBranch.short_name}]`, 'success');
      if (onRefreshGitStatus) onRefreshGitStatus();
      onClose();
    } catch (err: any) {
      toast('Rebase Failed', typeof err === 'string' ? err : err?.message, 'error');
    }
  };

  const handleDeleteBranch = async (targetBranch: GitBranchItem) => {
    if (targetBranch.is_current) {
      toast('Cannot Delete', 'Cannot delete the currently checked out branch.', 'warning');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete branch '${targetBranch.short_name}'?`)) return;

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_delete_branch', {
          projectPath,
          branch: targetBranch.short_name,
          force: false,
        });
      }
      toast('Branch Deleted', `Deleted branch [${targetBranch.short_name}]`, 'success');
      fetchGitData();
      if (onRefreshGitStatus) onRefreshGitStatus();
      setSelectedBranch(null);
    } catch (err: any) {
      toast('Delete Failed', typeof err === 'string' ? err : err?.message, 'error');
    }
  };

  const handlePullBranch = async (targetBranch: GitBranchItem, mode: 'rebase' | 'merge') => {
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        if (mode === 'rebase') {
          await invoke('git_rebase_branch', {
            projectPath,
            upstream: targetBranch.short_name,
          });
        } else {
          await invoke('git_merge_branch', {
            projectPath,
            branch: targetBranch.short_name,
          });
        }
      }
      toast(`Pull (${mode}) Succeeded`, `Pulled [${targetBranch.short_name}] into [${currentBranch}]`, 'success');
      if (onRefreshGitStatus) onRefreshGitStatus();
      onClose();
    } catch (err: any) {
      toast('Pull Failed', typeof err === 'string' ? err : err?.message, 'error');
    }
  };

  return (
    <div
      ref={popupRef}
      className="absolute left-0 top-full mt-1 w-[330px] bg-[#2B2D30] text-[#DFE1E5] border border-[#393B40] rounded-md shadow-2xl z-50 text-[12px] select-none flex flex-col overflow-visible animate-in fade-in duration-75 font-sans"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ─── Search & Header Bar ─── */}
      <div className="p-2 border-b border-[#393B40] flex items-center gap-1.5 bg-[#2B2D30] rounded-t-md">
        <div className="relative flex-1 flex items-center">
          <Search size={13} className="absolute left-2 text-[#868A91] pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for branches and actions"
            className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-2 pl-7 py-1 text-xs text-[#DFE1E5] placeholder-[#868A91] outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 p-0.5 text-[#868A91] hover:text-[#DFE1E5]"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Action icons right of search */}
        <button
          onClick={fetchGitData}
          title="Refresh branches"
          className="p-1 text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B] rounded transition-colors"
        >
          <RotateCw size={13} className={isLoading ? 'animate-spin text-[#3574F0]' : ''} />
        </button>
        <button
          title="Git Branch Settings"
          className="p-1 text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B] rounded transition-colors"
        >
          <Settings size={13} />
        </button>
      </div>

      {/* ─── Error Notification if any ─── */}
      {errorMsg && (
        <div className="px-3 py-1.5 bg-[#401C1C] text-[#FF8585] text-[11px] flex items-center gap-1.5 border-b border-[#5C2323]">
          <AlertCircle size={13} className="flex-shrink-0" />
          <span className="truncate flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="hover:text-white">
            <X size={11} />
          </button>
        </div>
      )}

      {/* ─── Quick Actions (New Branch, Checkout Revision) ─── */}
      {!isCreatingBranch && !isCheckingOutRevision ? (
        <div className="py-1 border-b border-[#393B40]">
          <div
            onClick={() => {
              setIsCreatingBranch(true);
              setTimeout(() => newBranchInputRef.current?.focus(), 50);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between transition-colors group"
          >
            <div className="flex items-center gap-2">
              <Plus size={13} className="text-[#59A869] group-hover:text-white" />
              <span className="font-medium">New Branch...</span>
            </div>
            <span className="text-[10px] text-[#868A91] group-hover:text-blue-100 font-mono">
              Ctrl+Alt+N
            </span>
          </div>

          <div
            onClick={() => {
              setIsCheckingOutRevision(true);
              setTimeout(() => revisionInputRef.current?.focus(), 50);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 transition-colors group"
          >
            <Tag size={13} className="text-[#3574F0] group-hover:text-white" />
            <span>Checkout Tag or Revision...</span>
          </div>
        </div>
      ) : isCreatingBranch ? (
        /* Inline New Branch Creation Form */
        <form onSubmit={handleCreateNewBranch} className="p-3 border-b border-[#393B40] bg-[#222427] space-y-2">
          <div className="text-[11px] font-semibold text-[#868A91] uppercase tracking-wide">
            Create New Branch
          </div>
          <input
            ref={newBranchInputRef}
            type="text"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            placeholder="New branch name..."
            className="w-full bg-[#1E1F22] border border-[#3574F0] rounded px-2 py-1 text-xs text-[#DFE1E5] outline-none"
          />
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-1.5 text-xs text-[#868A91] hover:text-[#DFE1E5] cursor-pointer">
              <input
                type="checkbox"
                checked={checkoutNewBranch}
                onChange={(e) => setCheckoutNewBranch(e.target.checked)}
                className="rounded accent-[#3574F0]"
              />
              <span>Checkout branch</span>
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsCreatingBranch(false)}
                className="px-2 py-0.5 text-xs text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30] rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newBranchName.trim()}
                className="px-2.5 py-0.5 text-xs bg-[#3574F0] text-white rounded hover:bg-[#3064D0] disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* Inline Checkout Tag/Revision Form */
        <form onSubmit={handleCheckoutRevision} className="p-3 border-b border-[#393B40] bg-[#222427] space-y-2">
          <div className="text-[11px] font-semibold text-[#868A91] uppercase tracking-wide">
            Checkout Tag or Revision
          </div>
          <input
            ref={revisionInputRef}
            type="text"
            value={revisionInput}
            onChange={(e) => setRevisionInput(e.target.value)}
            placeholder="Tag name or commit hash (e.g. v1.0.0, 7f8a3c)..."
            className="w-full bg-[#1E1F22] border border-[#3574F0] rounded px-2 py-1 text-xs text-[#DFE1E5] outline-none"
          />
          <div className="flex items-center justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setIsCheckingOutRevision(false)}
              className="px-2 py-0.5 text-xs text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30] rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!revisionInput.trim()}
              className="px-2.5 py-0.5 text-xs bg-[#3574F0] text-white rounded hover:bg-[#3064D0] disabled:opacity-50"
            >
              Checkout
            </button>
          </div>
        </form>
      )}

      {/* ─── Collapsible Tree View (Local, Remote, Tags) ─── */}
      <div className="max-h-[380px] overflow-y-auto py-1 scrollbar-thin">
        {isLoading && branches.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-xs text-[#868A91] gap-2">
            <Loader2 size={16} className="animate-spin text-[#3574F0]" />
            <span>Loading Git branches...</span>
          </div>
        ) : (
          <>
            {/* 1. Local Branches Group */}
            <div>
              <div
                onClick={() => setIsLocalExpanded(!isLocalExpanded)}
                className="px-2.5 py-1 text-[11px] font-semibold text-[#868A91] hover:text-[#DFE1E5] cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-1">
                  {isLocalExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span>Local</span>
                </div>
                <span className="text-[10px] text-[#606366] font-mono">({localBranches.length})</span>
              </div>

              {isLocalExpanded && (
                <div className="space-y-0.5">
                  {localBranches.length === 0 ? (
                    <div className="px-6 py-1 text-[11px] text-[#606366] italic">No local branches found</div>
                  ) : (
                    localBranches.map((b) => {
                      const isFav = favorites.includes(b.short_name);
                      const isSelected = selectedBranch?.name === b.name;

                      return (
                        <div
                          key={b.name}
                          onClick={() => handleCheckout(b)}
                          onMouseEnter={(e) => {
                            setSelectedBranch(b);
                            const rect = e.currentTarget.getBoundingClientRect();
                            const popupRect = popupRef.current?.getBoundingClientRect();
                            if (popupRect) {
                              setSubmenuPosition({ top: rect.top - popupRect.top });
                            }
                          }}
                          className={`group px-3 py-1 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#3574F0] text-white'
                              : b.is_current
                              ? 'bg-[#35373B]/60 text-white font-medium'
                              : 'hover:bg-[#3574F0] hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-1">
                            {b.is_current ? (
                              <Check size={12} className={isSelected ? 'text-white' : 'text-[#59A869]'} />
                            ) : (
                              <GitBranch size={12} className={isSelected ? 'text-white' : 'text-[#868A91] group-hover:text-white'} />
                            )}
                            <span className="truncate">{b.short_name}</span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Favorite star */}
                            <button
                              onClick={(e) => toggleFavorite(b.short_name, e)}
                              className={`p-0.5 ${
                                isFav
                                  ? 'text-[#E5A83B]'
                                  : 'text-transparent group-hover:text-[#868A91] hover:text-[#DFE1E5]'
                              }`}
                              title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              <Star size={11} fill={isFav ? '#E5A83B' : 'none'} />
                            </button>

                            {/* Upstream indicator */}
                            {b.upstream && (
                              <span className={`text-[10px] truncate max-w-[100px] ${isSelected ? 'text-blue-100' : 'text-[#868A91]'}`}>
                                {b.upstream}
                              </span>
                            )}

                            <ChevronRight size={11} className={isSelected ? 'text-white' : 'text-[#868A91] group-hover:text-white'} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="border-b border-[#35373B] my-1" />

            {/* 2. Remote Branches Group (Tree view: Remote -> origin -> branches) */}
            <div>
              <div
                onClick={() => setIsRemoteExpanded(!isRemoteExpanded)}
                className="px-2.5 py-1 text-[11px] font-semibold text-[#868A91] hover:text-[#DFE1E5] cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-1">
                  {isRemoteExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span>Remote</span>
                </div>
                <span className="text-[10px] text-[#606366] font-mono">({remoteBranches.length})</span>
              </div>

              {isRemoteExpanded && (
                <div className="space-y-0.5">
                  {Object.keys(remoteGroups).length === 0 ? (
                    <div className="px-6 py-1 text-[11px] text-[#606366] italic">No remote branches found</div>
                  ) : (
                    Object.entries(remoteGroups).map(([remoteName, list]) => {
                      const isExpanded = expandedRemotes[remoteName] ?? true;
                      return (
                        <div key={remoteName}>
                          <div
                            onClick={() =>
                              setExpandedRemotes(prev => ({ ...prev, [remoteName]: !isExpanded }))
                            }
                            className="px-5 py-1 text-[11px] text-[#A8ADBD] hover:text-white cursor-pointer flex items-center gap-1.5"
                          >
                            {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            <span className="font-medium">{remoteName}</span>
                          </div>

                          {isExpanded && (
                            <div className="space-y-0.5 pl-4">
                              {list.map((b) => {
                                const prefix = `${remoteName}/`;
                                const cleanName = b.short_name.startsWith(prefix)
                                  ? b.short_name.slice(prefix.length)
                                  : b.short_name;
                                const isFav =
                                  favorites.includes(b.short_name) ||
                                  cleanName === 'main' ||
                                  cleanName === 'master';
                                const isSelected = selectedBranch?.name === b.name;

                                return (
                                  <div
                                    key={b.name}
                                    onClick={() => handleCheckout(b)}
                                    onMouseEnter={(e) => {
                                      setSelectedBranch(b);
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const popupRect = popupRef.current?.getBoundingClientRect();
                                      if (popupRect) {
                                        setSubmenuPosition({ top: rect.top - popupRect.top });
                                      }
                                    }}
                                    className={`group px-3 py-1 flex items-center justify-between cursor-pointer transition-colors ${
                                      isSelected
                                        ? 'bg-[#3574F0] text-white'
                                        : 'hover:bg-[#3574F0] hover:text-white'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 pr-1">
                                      <Star
                                        size={11}
                                        fill={isFav ? '#E5A83B' : 'none'}
                                        className={isFav ? 'text-[#E5A83B]' : 'text-[#868A91]'}
                                      />
                                      <span className="truncate">{cleanName}</span>
                                    </div>

                                    <ChevronRight size={11} className={isSelected ? 'text-white' : 'text-[#868A91] group-hover:text-white'} />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* 3. Tags Section */}
            {tags.length > 0 && (
              <>
                <div className="border-b border-[#35373B] my-1" />
                <div>
                  <div
                    onClick={() => setIsTagsExpanded(!isTagsExpanded)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-[#868A91] hover:text-[#DFE1E5] cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-1">
                      {isTagsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span>Tags</span>
                    </div>
                    <span className="text-[10px] text-[#606366] font-mono">({filteredTags.length})</span>
                  </div>

                  {isTagsExpanded && (
                    <div className="space-y-0.5 pl-2">
                      {filteredTags.map((t) => (
                        <div
                          key={t}
                          onClick={() => {
                            setRevisionInput(t);
                            handleCheckoutRevision();
                          }}
                          className="px-3 py-1 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2 transition-colors"
                        >
                          <Tag size={12} className="text-[#868A91] group-hover:text-white" />
                          <span className="truncate">{t}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ─── IntelliJ IDEA Secondary Flyout Submenu ─── */}
      {selectedBranch && submenuPosition && (
        <div
          style={{ top: Math.max(0, submenuPosition.top - 10) }}
          className="absolute left-full ml-1 w-64 bg-[#2B2D30] text-[#DFE1E5] border border-[#393B40] rounded-md shadow-2xl py-1 z-50 text-[12px] animate-in fade-in duration-75 select-none"
        >
          {/* Submenu Header: Selected Branch Short Name */}
          <div className="px-3 py-1 text-[11px] font-semibold text-[#868A91] border-b border-[#393B40] truncate">
            {selectedBranch.short_name}
          </div>

          <div className="py-1">
            {/* 1. Checkout */}
            <div
              onClick={() => handleCheckout(selectedBranch)}
              className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
            >
              <Check size={13} className="text-[#59A869]" />
              <span className="truncate">
                {selectedBranch.is_remote
                  ? `Checkout '${selectedBranch.short_name}'`
                  : `Checkout`}
              </span>
            </div>

            {/* 2. New Branch from 'selected' */}
            <div
              onClick={() => handleCreateBranchFromSelected(selectedBranch)}
              className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
            >
              <Plus size={13} className="text-[#3574F0]" />
              <span className="truncate">New Branch from '{selectedBranch.short_name}'...</span>
            </div>

            {/* 3. Checkout and Rebase onto current */}
            <div
              onClick={async () => {
                const checkedOut = await handleCheckout(selectedBranch);
                if (!checkedOut) return;
                if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
                  try {
                    await invoke('git_rebase_branch', { projectPath, upstream: currentBranch });
                    toast('Rebase Complete', `Rebased '${selectedBranch.short_name}' onto '${currentBranch}'`, 'success');
                    if (onRefreshGitStatus) onRefreshGitStatus();
                  } catch (err: any) {
                    toast('Rebase Failed', typeof err === 'string' ? err : err?.message || 'Error rebasing branch', 'error');
                  }
                }
              }}
              className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
            >
              <ArrowRight size={13} className="text-[#868A91]" />
              <span className="truncate">Checkout and Rebase onto '{currentBranch}'</span>
            </div>

            <div className="border-b border-[#393B40] my-1" />

            {/* 4. Compare with Current */}
            <div
              onClick={() => {
                toast('Compare', `Comparing '${selectedBranch.short_name}' with '${currentBranch}'`, 'info');
                onClose();
              }}
              className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
            >
              <FileDiff size={13} className="text-[#3574F0]" />
              <span className="truncate">Compare with '{currentBranch}'</span>
            </div>

            {/* 5. Show Diff with Working Tree */}
            <div
              onClick={() => {
                toast('Diff', `Showing Diff of '${selectedBranch.short_name}' with Working Tree`, 'info');
                onClose();
              }}
              className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
            >
              <FileDiff size={13} className="text-[#868A91]" />
              <span className="truncate">Show Diff with Working Tree</span>
            </div>

            <div className="border-b border-[#393B40] my-1" />

            {/* 6. Rebase current onto selected */}
            <div
              onClick={() => handleRebaseOnto(selectedBranch)}
              className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
            >
              <RotateCw size={13} className="text-[#E5A83B]" />
              <span className="truncate">Rebase '{currentBranch}' onto '{selectedBranch.short_name}'</span>
            </div>

            {/* 7. Merge selected into current */}
            <div
              onClick={() => handleMergeIntoCurrent(selectedBranch)}
              className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
            >
              <GitMerge size={13} className="text-[#59A869]" />
              <span className="truncate">Merge '{selectedBranch.short_name}' into '{currentBranch}'</span>
            </div>

            <div className="border-b border-[#393B40] my-1" />

            {/* 8. Pull into current Using Rebase */}
            <div
              onClick={() => handlePullBranch(selectedBranch, 'rebase')}
              className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
            >
              <GitPullRequest size={13} className="text-[#3574F0]" />
              <span className="truncate">Pull into '{currentBranch}' Using Rebase</span>
            </div>

            {/* 9. Pull into current Using Merge */}
            <div
              onClick={() => handlePullBranch(selectedBranch, 'merge')}
              className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center gap-2"
            >
              <GitPullRequest size={13} className="text-[#59A869]" />
              <span className="truncate">Pull into '{currentBranch}' Using Merge</span>
            </div>

            {!selectedBranch.is_current && (
              <>
                <div className="border-b border-[#393B40] my-1" />
                {/* 10. Delete */}
                <div
                  onClick={() => handleDeleteBranch(selectedBranch)}
                  className="px-3 py-1.5 hover:bg-[#E05555] hover:text-white cursor-pointer flex items-center gap-2 text-[#FF8585] transition-colors"
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GitBranchPopup;
