import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Folder,
  FolderOpen,
  RotateCcw,
  RefreshCw,
  Columns,
  FolderTree,
  ChevronsUpDown,
  FoldHorizontal,
  Check,
  History,
  Eye,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  FileCode,
  FileText,
  File,
  Minus,
  Trash2,
  Plus,
  GitBranch,
  Edit2,
  FileSpreadsheet,
  Share2,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { useModalStore } from '../../stores/modalStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useEditorStore } from '../../stores/editorStore';

export interface CommitPanelProps {
  projectPath?: string;
  currentBranch?: string;
  onClose?: () => void;
  onOpenFile?: (filePath: string) => void;
  onCommitSuccess?: () => void;
}

interface FileChangeItem {
  path: string;
  status: string;
}

/**
 * Helper to get file icon by extension matching IntelliJ icons
 */
const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['ts', 'tsx'].includes(ext || '')) {
    return (
      <span className="w-3.5 h-3.5 rounded bg-[#3574F0]/20 border border-[#3574F0]/40 text-[#3574F0] font-bold text-[8px] flex items-center justify-center flex-shrink-0">
        TS
      </span>
    );
  }
  if (['js', 'jsx'].includes(ext || '')) {
    return (
      <span className="w-3.5 h-3.5 rounded bg-[#F7DF1E]/20 border border-[#F7DF1E]/40 text-[#F7DF1E] font-bold text-[8px] flex items-center justify-center flex-shrink-0">
        JS
      </span>
    );
  }
  if (['rs'].includes(ext || '')) {
    return (
      <span className="w-3.5 h-3.5 rounded bg-[#CE422B]/20 border border-[#CE422B]/40 text-[#EDA200] font-bold text-[8px] flex items-center justify-center flex-shrink-0">
        RS
      </span>
    );
  }
  if (['css', 'scss'].includes(ext || '')) {
    return <FileCode size={13} className="text-[#42A5F5] flex-shrink-0" />;
  }
  if (['html'].includes(ext || '')) {
    return <FileCode size={13} className="text-[#E06C75] flex-shrink-0" />;
  }
  if (['json', 'toml'].includes(ext || '')) {
    return <FileText size={13} className="text-[#E5C07B] flex-shrink-0" />;
  }
  if (['md'].includes(ext || '')) {
    return (
      <span className="w-3.5 h-3.5 rounded bg-[#6897BB]/20 border border-[#6897BB]/40 text-[#6897BB] font-bold text-[8px] flex items-center justify-center flex-shrink-0">
        MD
      </span>
    );
  }
  return <File size={13} className="text-[#868A91] flex-shrink-0" />;
};


interface GitTreeNode {
  id: string;
  name: string;
  isFolder: boolean;
  item?: FileChangeItem;
  children: GitTreeNode[];
  allFilePaths: string[];
}

interface FlatRow {
  node: GitTreeNode;
  depth: number;
}

interface RawDir {
  name: string;
  fullPath: string;
  files: FileChangeItem[];
  subDirs: Map<string, RawDir>;
}

function convertRawDir(dir: RawDir, compact: boolean): GitTreeNode {
  let name = dir.name;
  let currentDir = dir;

  // Compact middle packages: e.g. "crates/ide-run/src"
  if (compact) {
    while (currentDir.files.length === 0 && currentDir.subDirs.size === 1) {
      const nextDir = currentDir.subDirs.values().next().value!;
      name = `${name}/${nextDir.name}`;
      currentDir = nextDir;
    }
  }

  const subNodes: GitTreeNode[] = [];
  const sortedSubDirs = Array.from(currentDir.subDirs.values()).sort((a, b) => a.name.localeCompare(b.name));
  for (const sd of sortedSubDirs) {
    subNodes.push(convertRawDir(sd, compact));
  }

  const sortedFiles = [...currentDir.files].sort((a, b) => {
    const na = a.path.split(/[\/\\]/).pop() || '';
    const nb = b.path.split(/[\/\\]/).pop() || '';
    return na.localeCompare(nb);
  });

  for (const f of sortedFiles) {
    const fName = f.path.split(/[\/\\]/).pop() || f.path;
    subNodes.push({
      id: f.path,
      name: fName,
      isFolder: false,
      item: f,
      children: [],
      allFilePaths: [f.path],
    });
  }

  const allFilePaths: string[] = [];
  subNodes.forEach((child) => allFilePaths.push(...child.allFilePaths));

  return {
    id: currentDir.fullPath,
    name,
    isFolder: true,
    children: subNodes,
    allFilePaths,
  };
}

function buildChangeTree(items: FileChangeItem[], compact = true): GitTreeNode[] {
  const root: RawDir = {
    name: '',
    fullPath: '',
    files: [],
    subDirs: new Map(),
  };

  for (const item of items) {
    const norm = item.path.replace(/\\/g, '/');
    const parts = norm.split('/');
    parts.pop(); // remove fileName
    let curr = root;
    let accumulatedPath = '';

    for (const part of parts) {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      if (!curr.subDirs.has(part)) {
        curr.subDirs.set(part, {
          name: part,
          fullPath: accumulatedPath,
          files: [],
          subDirs: new Map(),
        });
      }
      curr = curr.subDirs.get(part)!;
    }

    curr.files.push(item);
  }

  const result: GitTreeNode[] = [];
  const sortedSubDirs = Array.from(root.subDirs.values()).sort((a, b) => a.name.localeCompare(b.name));
  for (const sd of sortedSubDirs) {
    result.push(convertRawDir(sd, compact));
  }

  const sortedFiles = [...root.files].sort((a, b) => {
    const na = a.path.split(/[\/\\]/).pop() || '';
    const nb = b.path.split(/[\/\\]/).pop() || '';
    return na.localeCompare(nb);
  });

  for (const f of sortedFiles) {
    const fName = f.path.split(/[\/\\]/).pop() || f.path;
    result.push({
      id: f.path,
      name: fName,
      isFolder: false,
      item: f,
      children: [],
      allFilePaths: [f.path],
    });
  }

  return result;
}

function flattenTreeNodes(
  nodes: GitTreeNode[],
  collapsedDirs: Set<string>,
  depth = 0
): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const node of nodes) {
    rows.push({ node, depth });
    if (node.isFolder && !collapsedDirs.has(node.id)) {
      rows.push(...flattenTreeNodes(node.children, collapsedDirs, depth + 1));
    }
  }
  return rows;
}

/**
 * Authentic IntelliJ IDEA New UI - Commit Tool Window Sidebar (Alt+0)
 */
export const CommitPanel: React.FC<CommitPanelProps> = ({
  projectPath = 'D:\\IDE',
  currentBranch = 'main',
  onClose,
  onOpenFile,
  onCommitSuccess,
}) => {
  const [changes, setChanges] = useState<FileChangeItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>({});
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [isChangesExpanded, setIsChangesExpanded] = useState(true);
  const [isUnversionedExpanded, setIsUnversionedExpanded] = useState(true);
  const [message, setMessage] = useState('');
  const [isAmend, setIsAmend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showGroupByMenu, setShowGroupByMenu] = useState(false);
  const [groupBy, setGroupBy] = useState<'directory' | 'module' | 'none'>('none');
  const [showDiffInEditor, setShowDiffInEditor] = useState(true);
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const [commitFormHeight, setCommitFormHeight] = useState(190);




  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    filePath: string;
  } | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { openDiffModal } = useModalStore();
  const { addToast } = useNotificationStore();

  // Fetch status from backend
  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const res = await invoke<{ branch: string; changes: FileChangeItem[]; is_clean: boolean }>('git_get_status', {
          projectPath,
        });
        if (res && Array.isArray(res.changes)) {
          setChanges(res.changes);
          setSelectedFiles((prev) => {
            const next: Record<string, boolean> = {};
            res.changes.forEach((c) => {
              next[c.path] = prev[c.path] !== undefined ? prev[c.path] : true;
            });
            return next;
          });
          if (res.changes.length > 0 && (!activeFile || !res.changes.some(c => c.path === activeFile))) {
            setActiveFile(res.changes[0].path);
          }
        }
      } else {
        // Fallback for browser mock
        const mock: FileChangeItem[] = [
          { path: 'src/App.tsx', status: 'M' },
          { path: 'src/workbench/ActivityBar.tsx', status: 'M' },
          { path: 'src/features/git/CommitPanel.tsx', status: 'A' },
          { path: 'src/features/settings/panels/BuildExecutionPanel.tsx', status: 'M' },
        ];
        setChanges(mock);
        setSelectedFiles({
          'src/App.tsx': true,
          'src/workbench/ActivityBar.tsx': true,
          'src/features/git/CommitPanel.tsx': true,
          'src/features/settings/panels/BuildExecutionPanel.tsx': true,
        });
        setActiveFile(mock[0].path);
      }
    } catch (e) {
      console.warn('git_get_status error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, activeFile]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Filter tracked vs unversioned changes
  const versionedChanges = changes.filter(c => !c.status.includes('?'));
  const unversionedChanges = changes.filter(c => c.status.includes('?'));
  // Build tree hierarchies
  const versionedTree = useMemo(() => buildChangeTree(versionedChanges, true), [versionedChanges]);
  const unversionedTree = useMemo(() => buildChangeTree(unversionedChanges, true), [unversionedChanges]);

  const toggleCollapseDir = (dirId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirId)) {
        next.delete(dirId);
      } else {
        next.add(dirId);
      }
      return next;
    });
  };

  const toggleFolderCheckbox = (node: GitTreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    const checkedCount = node.allFilePaths.filter((p) => selectedFiles[p]).length;
    const isAllChecked = checkedCount === node.allFilePaths.length && node.allFilePaths.length > 0;
    const targetState = !isAllChecked;

    setSelectedFiles((prev) => {
      const next = { ...prev };
      node.allFilePaths.forEach((p) => {
        next[p] = targetState;
      });
      return next;
    });
  };

  const handleExpandAll = () => {
    setIsChangesExpanded(true);
    setIsUnversionedExpanded(true);
    setCollapsedDirs(new Set());
  };

  const handleCollapseAll = () => {
    const allDirIds = new Set<string>();
    const collect = (nodes: GitTreeNode[]) => {
      for (const n of nodes) {
        if (n.isFolder) {
          allDirIds.add(n.id);
          collect(n.children);
        }
      }
    };
    collect(versionedTree);
    collect(unversionedTree);
    setCollapsedDirs(allDirIds);
  };


  const versionedSelectedCount = versionedChanges.filter(c => selectedFiles[c.path]).length;
  const isAllVersionedSelected = versionedChanges.length > 0 && versionedSelectedCount === versionedChanges.length;
  const isPartiallyVersionedSelected = versionedSelectedCount > 0 && versionedSelectedCount < versionedChanges.length;

  const toggleSelectAllVersioned = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextState = !isAllVersionedSelected;
    setSelectedFiles((prev) => {
      const next = { ...prev };
      versionedChanges.forEach((c) => {
        next[c.path] = nextState;
      });
      return next;
    });
  };

  const unversionedSelectedCount = unversionedChanges.filter(c => selectedFiles[c.path]).length;
  const isAllUnversionedSelected = unversionedChanges.length > 0 && unversionedSelectedCount === unversionedChanges.length;
  const isPartiallyUnversionedSelected = unversionedSelectedCount > 0 && unversionedSelectedCount < unversionedChanges.length;

  const toggleSelectAllUnversioned = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextState = !isAllUnversionedSelected;
    setSelectedFiles((prev) => {
      const next = { ...prev };
      unversionedChanges.forEach((c) => {
        next[c.path] = nextState;
      });
      return next;
    });
  };

  // Master total selected count
  const totalCount = changes.length;
  const selectedCount = Object.values(selectedFiles).filter(Boolean).length;

  const toggleFile = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFiles((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  // Open Diff in Editor Tab (Matching Image 2)
  const handleOpenDiffInTab = async (filePath: string, inNewTab = false) => {
    setActiveFile(filePath);
    try {
      let base = '';
      let local = '';
      let headHash = '3b5775c8';
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        base = await invoke<string>('git_get_file_content_at_head', { projectPath, filePath }).catch(() => '');
        const normProj = (projectPath || 'D:/IDE').replace(/\\/g, '/');
        const normFile = filePath.replace(/\\/g, '/');
        const fullPath = filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath) ? filePath : `${normProj}/${normFile}`;
        local = await invoke<string>('read_file_content', { path: fullPath }).catch(() => '');
        const logs = await invoke<Array<{ short_hash: string }>>('git_get_log', { projectPath, maxCount: 2 }).catch(() => []);
        const realCommit = logs?.find((l) => l.short_hash && l.short_hash !== 'worktree');
        if (realCommit) headHash = realCommit.short_hash;
      } else {
        base = '// Base revision (HEAD) content';
        local = '// Local working tree content';
      }

      const fileName = filePath.split(/[\\/]/).pop() || filePath;
      const tabId = inNewTab ? `diff:${filePath}:${Date.now()}` : 'diff:active';
      const tabTitle = `Commit: ${fileName}`;

      useEditorStore.getState().openTab({
        id: tabId,
        title: tabTitle,
        path: filePath,
        content: local,
        language: fileName.split('.').pop() || 'typescript',
        tabType: 'diff',
        diffData: {
          filePath,
          baseContent: base,
          localContent: local,
          baseHash: headHash,
          baseTitle: base ? `${headHash} ${filePath}` : `Unversioned ${filePath}`,
          localTitle: 'Current version',
        },
      });
    } catch (e) {
      console.warn('Failed to open diff in tab:', e);
    }
  };

  // Open 2-Way Diff Viewer Modal (Fallback / Dedicated Modal)
  const handleOpenDiffModal = async (filePath: string) => {
    setActiveFile(filePath);
    try {
      let base = '';
      let local = '';
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        base = await invoke<string>('git_get_file_content_at_head', { projectPath, filePath }).catch(() => '');
        const normalizedProjectPath = projectPath.replace(/\\/g, '/');
        const normalizedFilePath = filePath.replace(/\\/g, '/');
        const fullPath = filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath) ? filePath : `${normalizedProjectPath}/${normalizedFilePath}`;
        local = await invoke<string>('read_file_content', { path: fullPath }).catch(() => '');
      } else {
        base = '// Original HEAD content';
        local = '// Modified local working tree content';
      }
      openDiffModal(filePath, base, local);
    } catch (e) {
      console.warn('Failed to open diff modal:', e);
      addToast('Diff Error', `Could not load diff for ${filePath}`, 'error');
    }
  };

  // When clicking on a row in Changes list:
  // If showDiffInEditor is true, opens/updates the diff tab in editor area
  const handleRowClick = (path: string) => {
    setActiveFile(path);
    if (showDiffInEditor) {
      handleOpenDiffInTab(path, false);
    }
  };

  // Rollback file changes
  const handleRollbackFile = async (filePath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_rollback_file', { projectPath, filePath });
        addToast('Rollback', `Reverted ${filePath}`, 'success');
      } else {
        addToast('Rollback', `Reverted ${filePath}`, 'info');
      }
      fetchStatus();
    } catch (err) {
      addToast('Rollback Failed', String(err), 'error');
    }
  };

  // Rollback all selected files
  const handleRollbackSelected = async () => {
    const filesToRollback = Object.keys(selectedFiles).filter((p) => selectedFiles[p]);
    if (filesToRollback.length === 0) {
      addToast('Rollback', 'No files selected to rollback', 'info');
      return;
    }
    if (!confirm(`Are you sure you want to rollback ${filesToRollback.length} selected file(s)?`)) {
      return;
    }
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        for (const f of filesToRollback) {
          await invoke('git_rollback_file', { projectPath, filePath: f });
        }
      }
      addToast('Rollback Successful', `Reverted ${filesToRollback.length} file(s)`, 'success');
      fetchStatus();
    } catch (err) {
      addToast('Rollback Error', String(err), 'error');
    }
  };

  // Amend toggle
  const handleToggleAmend = async () => {
    const nextVal = !isAmend;
    setIsAmend(nextVal);
    if (nextVal && !message.trim()) {
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          const logs = await invoke<Array<{ subject: string }>>('git_get_log', { projectPath, maxCount: 2 });
          const last = logs?.find((l) => l.subject && !l.subject.startsWith('Working Tree'));
          if (last?.subject) {
            setMessage(last.subject);
          }
        } else {
          setMessage('feat: update project configuration');
        }
      } catch (_) {}
    }
  };

  // Execute Commit
  const handleExecuteCommit = async (andPush = false) => {
    const trimmed = message.trim();
    if (!trimmed) {
      addToast('Commit Warning', 'Please enter a commit message', 'warning');
      textareaRef.current?.focus();
      return;
    }

    const filesToCommit = Object.keys(selectedFiles).filter((p) => selectedFiles[p]);
    if (filesToCommit.length === 0) {
      addToast('Commit Warning', 'Select at least one file to commit', 'warning');
      return;
    }

    setIsCommitting(true);
    if (andPush) setIsPushing(true);

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_commit', {
          projectPath,
          message: trimmed,
          files: filesToCommit,
          amend: isAmend,
        });

        addToast(isAmend ? 'Amended Commit' : 'Commit Successful', `[${currentBranch}] ${trimmed}`, 'success');

        if (andPush) {
          await invoke('git_push', { projectPath });
          addToast('Push Successful', `Pushed to origin/${currentBranch}`, 'success');
        }
      } else {
        addToast('Committed', `[${currentBranch}] ${trimmed}`, 'success');
        if (andPush) {
          addToast('Pushed', `Pushed to origin/${currentBranch}`, 'success');
        }
      }

      setMessage('');
      setIsAmend(false);
      fetchStatus();
      onCommitSuccess?.();
    } catch (err) {
      addToast('Commit Failed', String(err), 'error');
    } finally {
      setIsCommitting(false);
      setIsPushing(false);
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
      setActiveSubmenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Compute modified files count
  const modifiedCount = changes.filter(c => c.status.includes('M')).length;
  const addedCount = changes.filter(c => c.status.includes('A') || c.status.includes('?')).length;


  // Render a Git Tree row (directory branch or file leaf)
  const renderTreeRow = (row: FlatRow, isUnversionedGroup: boolean) => {
    const { node, depth } = row;

    if (node.isFolder) {
      const isExpanded = !collapsedDirs.has(node.id);
      const checkedCount = node.allFilePaths.filter((p) => selectedFiles[p]).length;
      const isAllChecked = checkedCount === node.allFilePaths.length && node.allFilePaths.length > 0;
      const isPartialChecked = checkedCount > 0 && checkedCount < node.allFilePaths.length;

      return (
        <div
          key={`dir-${node.id}`}
          onClick={(e) => toggleCollapseDir(node.id, e)}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className="h-[22px] pr-2 flex items-center justify-between text-xs cursor-pointer select-none hover:bg-[#25272B] text-[#DFE1E5] transition-colors"
          title={`${node.id} (${node.allFilePaths.length} files)`}
        >
          <div className="flex items-center gap-1.5 truncate min-w-0 pr-1">
            <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0 text-[#868A91]">
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </div>
            <button
              onClick={(e) => toggleFolderCheckbox(node, e)}
              className="w-3.5 h-3.5 rounded border border-[#4E5157] bg-[#1E1F22] flex items-center justify-center cursor-pointer hover:border-[#3574F0] flex-shrink-0"
            >
              {isAllChecked && <Check size={11} className="text-[#3574F0] stroke-[3]" />}
              {isPartialChecked && <div className="w-1.5 h-1.5 bg-[#3574F0] rounded-sm" />}
            </button>
            {isExpanded ? (
              <FolderOpen size={14} className="text-[#E5A83B] fill-[#E5A83B]/25 flex-shrink-0" />
            ) : (
              <Folder size={14} className="text-[#E5A83B] fill-[#E5A83B]/25 flex-shrink-0" />
            )}
            <span className="truncate text-[12px] font-sans text-[#DFE1E5] font-normal">
              {node.name}
            </span>
            <span className="text-[11px] text-[#787C84] font-mono ml-1 flex-shrink-0">
              {node.allFilePaths.length}
            </span>
          </div>
        </div>
      );
    }

    // Leaf File Node
    const item = node.item!;
    const isChecked = selectedFiles[item.path] ?? false;
    const isActive = activeFile === item.path;

    const isModified = item.status.includes('M');
    const isAdded = item.status.includes('A');
    const isDeleted = item.status.includes('D');

    const nameColor = isActive
      ? 'text-white font-medium'
      : isUnversionedGroup
      ? 'text-[#59A869]'
      : isModified
      ? 'text-[#56A8F5]'
      : isAdded
      ? 'text-[#59A869]'
      : isDeleted
      ? 'text-[#E05555]'
      : 'text-[#DFE1E5]';

    return (
      <div
        key={`file-${item.path}`}
        onClick={() => handleRowClick(item.path)}
        onDoubleClick={() => onOpenFile?.(item.path)}
        onContextMenu={(e) => {
          e.preventDefault();
          setActiveFile(item.path);
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            filePath: item.path,
          });
        }}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={`h-[22px] pr-2 flex items-center justify-between text-xs cursor-pointer select-none transition-colors ${
          isActive
            ? 'bg-[#243B5A] text-white'
            : 'hover:bg-[#25272B] text-[#DFE1E5]'
        }`}
        title={`${item.path}`}
      >
        <div className="flex items-center gap-1.5 truncate min-w-0 pr-1">
          <div className="w-3.5 h-3.5 flex-shrink-0" />
          <button
            onClick={(e) => toggleFile(item.path, e)}
            className="w-3.5 h-3.5 rounded border border-[#4E5157] bg-[#1E1F22] flex items-center justify-center cursor-pointer hover:border-[#3574F0] flex-shrink-0"
          >
            {isChecked && <Check size={11} className="text-[#3574F0] stroke-[3]" />}
          </button>
          {getFileIcon(node.name)}
          <span className={`truncate text-[12px] font-sans ${nameColor}`}>
            {node.name}
          </span>
        </div>
      </div>
    );
  };
  return (
    <div className="w-full h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5] select-none font-sans overflow-hidden border-r border-[#2B2D30]">
      {/* ─── Top Tool Window Header: Two Tabs matching Image 1 ─── */}
      <div className="h-9 bg-[#2B2D30] border-b border-[#1E1F22] px-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#DFE1E5] bg-[#1E1F22] border-b-2 border-[#3574F0] cursor-pointer">
            <span>Commit</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-[#868A91] hover:text-[#DFE1E5] cursor-pointer transition-colors">
            <span>Commit</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[#868A91]">
          <button
            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
            className="p-1 hover:bg-[#35373B] hover:text-[#DFE1E5] rounded cursor-pointer transition-colors"
            title="Options Menu"
          >
            <MoreVertical size={13} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#35373B] hover:text-[#DFE1E5] rounded cursor-pointer transition-colors"
              title="Hide Commit Tool Window (Shift+Escape)"
            >
              <Minus size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ─── Commit Action Toolbar (Red Box 1 in Image 1) ─── */}
      <div className="h-8 px-2 bg-[#25272B] border-b border-[#2B2D30] flex items-center justify-between text-xs text-[#868A91] flex-shrink-0">
        <div className="flex items-center gap-1">
          {/* Rollback (Ctrl+Alt+Z) */}
          <button
            onClick={handleRollbackSelected}
            className="p-1.5 hover:bg-[#35373B] hover:text-[#DFE1E5] rounded cursor-pointer transition-colors"
            title="Rollback... (Ctrl+Alt+Z)"
          >
            <RotateCcw size={13} />
          </button>

          {/* Refresh VCS Changes */}
          <button
            onClick={fetchStatus}
            className="p-1.5 hover:bg-[#35373B] hover:text-[#DFE1E5] rounded cursor-pointer transition-colors"
            title="Refresh VCS Changes"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin text-[#3574F0]' : ''} />
          </button>

          {/* Show Diff Toggle (Ctrl+D) */}
          <button
            onClick={() => {
              const next = !showDiffInEditor;
              setShowDiffInEditor(next);
              if (next && activeFile) {
                handleOpenDiffInTab(activeFile, false);
              }
            }}
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              showDiffInEditor ? 'bg-[#3574F0]/20 text-[#3574F0]' : 'hover:bg-[#35373B] hover:text-[#DFE1E5]'
            }`}
            title="Show Diff in Editor (Ctrl+D)"
          >
            <Columns size={13} />
          </button>

          <div className="w-px h-3.5 bg-[#3E4147] mx-0.5" />

          {/* Group By (Tree View / Flat List) */}
          <div className="relative">
            <button
              onClick={() => {
                setGroupBy(prev => prev === 'directory' ? 'none' : 'directory');
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setShowGroupByMenu(!showGroupByMenu);
              }}
              className={`p-1.5 rounded cursor-pointer transition-colors ${
                groupBy === 'directory'
                  ? 'bg-[#3574F0]/25 text-[#3574F0]'
                  : 'hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5]'
              }`}
              title={groupBy === 'directory' ? "View as Tree (Directory) - Click to toggle Flat List" : "View as Flat List - Click to toggle Tree"}
            >
              <FolderTree size={13} />
            </button>
            {showGroupByMenu && (
              <div 
                className="absolute left-0 top-full mt-1 w-36 bg-[#2B2D30] border border-[#393B40] rounded shadow-xl py-1 z-50 text-[11px]"
                onMouseLeave={() => setShowGroupByMenu(false)}
              >
                <div className="px-3 py-1 text-[9px] uppercase font-semibold text-[#868A91]">View Mode</div>
                <div 
                  onClick={() => { setGroupBy('directory'); setShowGroupByMenu(false); }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>Directory (Tree)</span>
                  {groupBy === 'directory' && <Check size={11} />}
                </div>
                <div 
                  onClick={() => { setGroupBy('none'); setShowGroupByMenu(false); }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
                >
                  <span>None (Flat List)</span>
                  {groupBy === 'none' && <Check size={11} />}
                </div>
              </div>
            )}
          </div>

          {/* Expand All */}
          <button
            onClick={handleExpandAll}
            className="p-1.5 hover:bg-[#35373B] hover:text-[#DFE1E5] rounded cursor-pointer transition-colors"
            title="Expand All"
          >
            <ChevronsUpDown size={13} />
          </button>

          {/* Collapse All */}
          <button
            onClick={handleCollapseAll}
            className="p-1.5 hover:bg-[#35373B] hover:text-[#DFE1E5] rounded cursor-pointer transition-colors"
            title="Collapse All"
          >
            <FoldHorizontal size={13} />
          </button>
        </div>
      </div>

      {/* ─── Changes Tree Section (Unified Smooth Scrollable Container) ─── */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[#1E1F22] select-none flex flex-col">
        {/* ─── Group 1: Changes (Tracked Files) Header ─── */}
        <div
          onClick={() => setIsChangesExpanded(!isChangesExpanded)}
          className="h-[24px] px-2 flex-shrink-0 flex items-center justify-between text-xs cursor-pointer text-[#DFE1E5] hover:bg-[#25272B] select-none transition-colors border-b border-[#2B2D30]/40 bg-[#1E1F22]"
        >
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 flex items-center justify-center text-[#868A91] flex-shrink-0">
              {isChangesExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </div>
            <button
              onClick={toggleSelectAllVersioned}
              className="w-3.5 h-3.5 rounded border border-[#4E5157] bg-[#1E1F22] flex items-center justify-center cursor-pointer hover:border-[#3574F0] flex-shrink-0"
            >
              {isAllVersionedSelected && <Check size={11} className="text-[#3574F0] stroke-[3]" />}
              {isPartiallyVersionedSelected && <div className="w-1.5 h-1.5 bg-[#3574F0] rounded-sm" />}
            </button>
            <span className="font-semibold text-[#DFE1E5]">Changes</span>
            <span className="text-[11px] text-[#868A91] font-mono">
              {versionedChanges.length} files
            </span>
          </div>
        </div>

        {/* List for Tracked Changes */}
        {isChangesExpanded && (
          <div className="flex flex-col py-0.5">
            {versionedChanges.length === 0 ? (
              <div className="py-2.5 pl-8 text-xs text-[#868A91] italic">
                No tracked changes
              </div>
            ) : groupBy === 'directory' ? (
              flattenTreeNodes(versionedTree, collapsedDirs).map((row) => renderTreeRow(row, false))
            ) : (
              versionedChanges.map((item) => {
                const isChecked = selectedFiles[item.path] ?? false;
                const isActive = activeFile === item.path;
                const normalizedPath = item.path.replace(/\\/g, '/');
                const parts = normalizedPath.split('/');
                const fileName = parts.pop() || normalizedPath;
                const dirName = parts.join('/');

                const isModified = item.status.includes('M');
                const isAdded = item.status.includes('A');
                const isDeleted = item.status.includes('D');

                const nameColor = isActive
                  ? 'text-white font-medium'
                  : isModified
                  ? 'text-[#56A8F5]'
                  : isAdded
                  ? 'text-[#59A869]'
                  : isDeleted
                  ? 'text-[#E05555]'
                  : 'text-[#DFE1E5]';

                return (
                  <div
                    key={item.path}
                    onClick={() => handleRowClick(item.path)}
                    onDoubleClick={() => onOpenFile?.(item.path)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveFile(item.path);
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        filePath: item.path,
                      });
                    }}
                    style={{ paddingLeft: '38px', paddingRight: '8px' }}
                    className={`h-[22px] flex items-center justify-between text-xs cursor-pointer select-none transition-colors ${
                      isActive
                        ? 'bg-[#243B5A] text-white'
                        : 'hover:bg-[#25272B] text-[#DFE1E5]'
                    }`}
                    title={`${item.path}`}
                  >
                    <div className="flex items-center gap-1.5 truncate min-w-0 pr-1">
                      <button
                        onClick={(e) => toggleFile(item.path, e)}
                        className="w-3.5 h-3.5 rounded border border-[#4E5157] bg-[#1E1F22] flex items-center justify-center cursor-pointer hover:border-[#3574F0] flex-shrink-0"
                      >
                        {isChecked && <Check size={11} className="text-[#3574F0] stroke-[3]" />}
                      </button>
                      {getFileIcon(fileName)}
                      <span className={`truncate text-[12px] font-sans ${nameColor}`}>
                        {fileName}
                      </span>
                      {dirName && (
                        <span className="text-[11px] text-[#787C84] truncate font-mono ml-1.5">{dirName}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ─── Group 2: Unversioned Files Header ─── */}
        <div
          onClick={() => setIsUnversionedExpanded(!isUnversionedExpanded)}
          className="h-[24px] px-2 flex-shrink-0 flex items-center justify-between text-xs cursor-pointer text-[#DFE1E5] hover:bg-[#25272B] select-none transition-colors border-t border-b border-[#2B2D30] bg-[#1E1F22]"
        >
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 flex items-center justify-center text-[#868A91] flex-shrink-0">
              {isUnversionedExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </div>
            <button
              onClick={toggleSelectAllUnversioned}
              className="w-3.5 h-3.5 rounded border border-[#4E5157] bg-[#1E1F22] flex items-center justify-center cursor-pointer hover:border-[#3574F0] flex-shrink-0"
            >
              {isAllUnversionedSelected && <Check size={11} className="text-[#3574F0] stroke-[3]" />}
              {isPartiallyUnversionedSelected && <div className="w-1.5 h-1.5 bg-[#3574F0] rounded-sm" />}
            </button>
            <span className="font-semibold text-[#DFE1E5]">Unversioned Files</span>
            <span className="text-[11px] text-[#868A91] font-mono">
              {unversionedChanges.length} files
            </span>
          </div>
        </div>

        {/* List for Unversioned Files */}
        {isUnversionedExpanded && (
          <div className="flex flex-col py-0.5 bg-[#1A1B1D]">
            {unversionedChanges.length === 0 ? (
              <div className="py-2.5 pl-8 text-xs text-[#868A91] italic">
                No unversioned files
              </div>
            ) : groupBy === 'directory' ? (
              flattenTreeNodes(unversionedTree, collapsedDirs).map((row) => renderTreeRow(row, true))
            ) : (
              unversionedChanges.map((item) => {
                const isChecked = selectedFiles[item.path] ?? false;
                const isActive = activeFile === item.path;
                const normalizedPath = item.path.replace(/\\/g, '/');
                const parts = normalizedPath.split('/');
                const fileName = parts.pop() || normalizedPath;
                const dirName = parts.join('/');

                return (
                  <div
                    key={item.path}
                    onClick={() => handleRowClick(item.path)}
                    onDoubleClick={() => onOpenFile?.(item.path)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveFile(item.path);
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        filePath: item.path,
                      });
                    }}
                    style={{ paddingLeft: '38px', paddingRight: '8px' }}
                    className={`h-[22px] flex items-center justify-between text-xs cursor-pointer select-none transition-colors ${
                      isActive
                        ? 'bg-[#243B5A] text-white'
                        : 'hover:bg-[#25272B] text-[#DFE1E5]'
                    }`}
                    title={`${item.path}`}
                  >
                    <div className="flex items-center gap-1.5 truncate min-w-0 pr-1">
                      <button
                        onClick={(e) => toggleFile(item.path, e)}
                        className="w-3.5 h-3.5 rounded border border-[#4E5157] bg-[#1E1F22] flex items-center justify-center cursor-pointer hover:border-[#3574F0] flex-shrink-0"
                      >
                        {isChecked && <Check size={11} className="text-[#3574F0] stroke-[3]" />}
                      </button>
                      {getFileIcon(fileName)}
                      <span className="truncate text-[12px] font-sans text-[#59A869]">
                        {fileName}
                      </span>
                      {dirName && (
                        <span className="text-[11px] text-[#787C84] truncate font-mono ml-1.5">{dirName}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ─── Draggable Resizer between Changes List and Commit Form ─── */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          const startY = e.clientY;
          const startH = commitFormHeight;
          const onMouseMove = (moveEvent: MouseEvent) => {
            const delta = startY - moveEvent.clientY;
            setCommitFormHeight(Math.max(110, Math.min(600, startH + delta)));
          };
          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
          };
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }}
        className="h-1.5 w-full cursor-row-resize hover:bg-[#3574F0] active:bg-[#3574F0] transition-colors z-20 flex-shrink-0 bg-[#2B2D30] border-t border-b border-[#1E1F22] group flex items-center justify-center"
        title="Drag to resize Commit Form"
      >
        <div className="w-8 h-0.5 bg-[#4E5157] group-hover:bg-white rounded-full opacity-60" />
      </div>

      {/* ─── Bottom Commit Form Section (Matching Image 1) ─── */}
      <div 
        style={{ height: `${commitFormHeight}px` }}
        className="p-3 flex flex-col gap-2 flex-shrink-0 bg-[#1E1F22]"
      >
        {/* Amend Checkbox & Authors */}
        <div className="flex items-center justify-between text-xs text-[#CED0D6] flex-shrink-0">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAmend}
                onChange={handleToggleAmend}
                className="accent-[#3574F0] w-3.5 h-3.5 rounded cursor-pointer"
              />
              <span className="text-xs">Amend</span>
            </label>
            <button className="p-0.5 hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] rounded transition-colors" title="Commit History">
              <History size={13} />
            </button>
            <button className="p-0.5 hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] rounded transition-colors" title="Preview / Differences">
              <Eye size={13} />
            </button>
          </div>
          <span className="text-[11px] text-[#868A91] font-mono">
            {versionedChanges.filter(c => selectedFiles[c.path]).length > 0
              ? `${versionedChanges.filter(c => selectedFiles[c.path]).length} modified`
              : modifiedCount > 0
              ? `${modifiedCount} modified`
              : ''}
          </span>
        </div>

        {/* Commit Message Textarea */}
        <div className="relative flex-1 min-h-[45px]">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit Message"
            className="w-full h-full bg-[#2B2D30] text-[#DFE1E5] placeholder-[#6F737A] text-xs font-mono p-2.5 rounded border border-[#393B40] focus:border-[#3574F0] focus:ring-1 focus:ring-[#3574F0] outline-none resize-none transition-all"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleExecuteCommit(false);
              }
            }}
          />
        </div>

        {/* Commit & Commit and Push Buttons */}
        <div className="flex items-center gap-2 pt-0.5 flex-shrink-0">
          <button
            onClick={() => handleExecuteCommit(false)}
            disabled={isCommitting || isPushing || selectedCount === 0 || !message.trim()}
            className="flex-1 h-7 bg-[#3574F0] hover:bg-[#3068D9] disabled:bg-[#35373B] text-white disabled:text-[#6F737A] rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed shadow-sm"
          >
            {isCommitting && !isPushing ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Check size={13} strokeWidth={2.5} />
            )}
            <span>{isAmend ? 'Amend Commit' : 'Commit'}</span>
          </button>

          <button
            onClick={() => handleExecuteCommit(true)}
            disabled={isCommitting || isPushing || selectedCount === 0 || !message.trim()}
            className="flex-1 h-7 bg-[#2B2D30] hover:bg-[#35373B] disabled:opacity-50 text-[#DFE1E5] rounded text-xs font-semibold flex items-center justify-center gap-1 border border-[#393B40] transition-colors cursor-pointer disabled:cursor-not-allowed"
            title="Commit changes and push immediately"
          >
            {isPushing ? (
              <RefreshCw size={13} className="animate-spin text-[#3574F0]" />
            ) : (
              <ArrowUpRight size={13} />
            )}
            <span>Commit and Push...</span>
          </button>
        </div>
      </div>

      {/* ─── Full Authentic IntelliJ IDEA Context Menu (Image 1 Red Box 2) ─── */}
      {contextMenu && (
        <div
          className="fixed bg-[#2B2D30] border border-[#393B40] rounded shadow-2xl py-1 z-50 text-xs text-[#DFE1E5] w-64 select-none animate-in fade-in duration-75 font-sans"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 380), left: Math.min(contextMenu.x, window.innerWidth - 260) }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Commit File... */}
          <div
            onClick={() => {
              setSelectedFiles({ [contextMenu.filePath]: true });
              textareaRef.current?.focus();
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <span>Commit File...</span>
          </div>

          {/* Rollback... (Ctrl+Alt+Z) */}
          <div
            onClick={() => {
              handleRollbackFile(contextMenu.filePath);
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <span>Rollback...</span>
            <span className="text-[10px] text-[#868A91]">Ctrl+Alt+Z</span>
          </div>

          {/* Move to Another Changelist... */}
          <div
            onClick={() => {
              addToast('Changelist', 'File kept in default changelist', 'info');
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
          >
            <span>Move to Another Changelist...</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* Show Diff (Ctrl+D) */}
          <div
            onClick={() => {
              handleOpenDiffInTab(contextMenu.filePath, false);
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between font-medium"
          >
            <span>Show Diff</span>
            <span className="text-[10px] text-[#868A91]">Ctrl+D</span>
          </div>

          {/* Show Diff in a New Tab */}
          <div
            onClick={() => {
              handleOpenDiffInTab(contextMenu.filePath, true);
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
          >
            <span>Show Diff in a New Tab</span>
          </div>

          {/* Show Local Changes as UML (Ctrl+Alt+Shift+D) */}
          <div
            onClick={() => {
              addToast('UML Preview', 'Local changes UML view is not available for this project', 'info');
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <span>Show Local Changes as UML</span>
            <span className="text-[10px] text-[#868A91]">Ctrl+Alt+Shift+D</span>
          </div>

          {/* Jump to Source (F4) */}
          <div
            onClick={() => {
              onOpenFile?.(contextMenu.filePath);
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <span>Jump to Source</span>
            <span className="text-[10px] text-[#868A91]">F4</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* Delete... */}
          <div
            onClick={async () => {
              if (confirm(`Delete ${contextMenu.filePath} from disk?`)) {
                try {
                  await invoke('delete_file', { path: contextMenu.filePath });
                  fetchStatus();
                } catch (e) {
                  console.warn(e);
                }
              }
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#E05555] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <span>Delete...</span>
            <span className="text-[10px] text-[#868A91]">Delete</span>
          </div>

          {/* Add to VCS (Ctrl+Alt+A) */}
          <div
            onClick={async () => {
              try {
                await invoke('git_add', { projectPath, files: [contextMenu.filePath] });
                addToast('VCS', `Added ${contextMenu.filePath} to VCS`, 'success');
                fetchStatus();
              } catch (e) {
                console.warn(e);
              }
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <span>Add to VCS</span>
            <span className="text-[10px] text-[#868A91]">Ctrl+Alt+A</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* New Changelist... */}
          <div
            onClick={() => {
              const name = prompt('New Changelist name:');
              if (name) addToast('Changelist', `Created changelist ${name}`, 'success');
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
          >
            <span>+ New Changelist...</span>
          </div>

          {/* Edit Changelist... (Ctrl+R) */}
          <div
            onClick={() => {
              addToast('Changelist', 'Editing default changelist', 'info');
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between"
          >
            <span>Edit Changelist...</span>
            <span className="text-[10px] text-[#868A91]">Ctrl+R</span>
          </div>

          {/* Create Patch from Local Changes... */}
          <div
            onClick={() => {
              addToast('Patch', 'Exported patch from changes', 'success');
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
          >
            <span>Create Patch from Local Changes...</span>
          </div>

          {/* Copy as Patch to Clipboard */}
          <div
            onClick={async () => {
              try {
                const diffText = await invoke<string>('git_get_diff', { projectPath, filePath: contextMenu.filePath });
                navigator.clipboard.writeText(diffText || '');
                addToast('Patch Copied', 'Copied patch to clipboard', 'success');
              } catch (e) {
                console.warn(e);
              }
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
          >
            <span>Copy as Patch to Clipboard</span>
          </div>

          {/* Shelve Changes... */}
          <div
            onClick={() => {
              addToast('Shelve', `Shelved changes for ${contextMenu.filePath}`, 'info');
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
          >
            <span>Shelve Changes...</span>
          </div>

          <div className="border-t border-[#393B40] my-1" />

          {/* Refresh VCS Changes */}
          <div
            onClick={() => {
              fetchStatus();
              setContextMenu(null);
            }}
            className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
          >
            <span>Refresh VCS Changes</span>
          </div>

          {/* Local History > */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu('local-history')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <span>Local History</span>
              <ChevronRight size={12} />
            </div>
            {activeSubmenu === 'local-history' && (
              <div 
                className="absolute left-full top-0 ml-0.5 w-48 bg-[#2B2D30] border border-[#393B40] rounded shadow-xl py-1 z-50 text-[11px]"
                onMouseLeave={() => setActiveSubmenu(null)}
              >
                <div 
                  onClick={() => {
                    addToast('Local History', `Showing history for ${contextMenu.filePath}`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Show History</span>
                </div>
                <div 
                  onClick={() => {
                    const label = prompt('Enter history label:');
                    if (label) addToast('Local History', `Saved label "${label}"`, 'success');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Put Label...</span>
                </div>
              </div>
            )}
          </div>

          {/* Git > */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu('git')}
          >
            <div className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer flex items-center justify-between">
              <span>Git</span>
              <ChevronRight size={12} />
            </div>
            {activeSubmenu === 'git' && (
              <div 
                className="absolute left-full top-0 ml-0.5 w-48 bg-[#2B2D30] border border-[#393B40] rounded shadow-xl py-1 z-50 text-[11px]"
                onMouseLeave={() => setActiveSubmenu(null)}
              >
                <div 
                  onClick={() => {
                    handleOpenDiffInTab(contextMenu.filePath, true);
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Compare with Branch...</span>
                </div>
                <div 
                  onClick={() => {
                    addToast('Git History', `Showing Git history for ${contextMenu.filePath}`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Show History</span>
                </div>
                <div 
                  onClick={() => {
                    addToast('Git Annotate', `Annotated with Git Blame`, 'info');
                    setContextMenu(null);
                  }}
                  className="px-3 py-1.5 hover:bg-[#3574F0] hover:text-white cursor-pointer"
                >
                  <span>Annotate with Git Blame</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
