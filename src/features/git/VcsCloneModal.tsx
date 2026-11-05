import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, GitBranch, FolderOpen, Loader2, AlertCircle } from 'lucide-react';
import { FileNode } from '../../types';

interface VcsCloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCloned: (tree: FileNode) => void;
  onShowToast: (title: string, message?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const VcsCloneModal: React.FC<VcsCloneModalProps> = ({
  isOpen,
  onClose,
  onProjectCloned,
  onShowToast,
}) => {
  const getBaseDir = () => {
    try {
      const saved = localStorage.getItem('ij_current_project_path');
      if (saved) {
        const lastSlash = Math.max(saved.lastIndexOf('/'), saved.lastIndexOf('\\'));
        return lastSlash > 0 ? saved.substring(0, lastSlash) : saved;
      }
    } catch {}
    return '';
  };

  const [url, setUrl] = useState('');
  const [directory, setDirectory] = useState<string>(() => getBaseDir());
  const [isCloning, setIsCloning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl('');
      setErrorMessage(null);
      setIsCloning(false);
      setDirectory(getBaseDir());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    setErrorMessage(null);
    try {
      const trimmed = newUrl.trim();
      if (trimmed) {
        const parts = trimmed.split('/');
        let lastPart = parts[parts.length - 1] || '';
        if (lastPart.endsWith('.git')) {
          lastPart = lastPart.slice(0, -4);
        }
        if (lastPart) {
          const base = getBaseDir();
          setDirectory(base ? `${base}\\${lastPart}` : lastPart);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  const handleBrowseDirectory = async () => {
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const picked = await invoke<string | null>('select_directory', { defaultPath: directory });
        if (picked) {
          setDirectory(picked);
        }
      }
    } catch (err) {
      console.error('Failed to select directory:', err);
    }
  };

  const handleClone = async () => {
    const trimmedUrl = url.trim();
    const trimmedDir = directory.trim();

    if (!trimmedUrl) {
      setErrorMessage('Please specify a repository URL');
      return;
    }
    if (!trimmedDir) {
      setErrorMessage('Please specify a destination directory');
      return;
    }

    setIsCloning(true);
    setErrorMessage(null);

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('git_clone', {
          url: trimmedUrl,
          targetDir: trimmedDir,
        });

        // Open newly cloned folder
        const tree = await invoke<FileNode>('open_project_by_path', { projectPath: trimmedDir });
        if (tree) {
          onShowToast('Repository Cloned', `Cloned and opened ${tree.name}`, 'success');
          onProjectCloned(tree);
          onClose();
        } else {
          throw new Error('Could not open cloned directory');
        }
      } else {
        throw new Error('Git clone requires desktop application mode with Git installed.');
      }
    } catch (err: any) {
      console.error('Git clone error:', err);
      setErrorMessage(typeof err === 'string' ? err : err.message || 'Clone failed');
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl w-[560px] text-[#DFE1E5] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-10 px-4 bg-[#1E1F22] border-b border-[#393B40] flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-[#3574F0]" />
            <span className="font-semibold text-sm">Get from Version Control</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#393B40] rounded text-[#868A91] hover:text-[#DFE1E5] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 text-xs">
          <div>
            <label className="block text-[#868A91] font-medium mb-1.5">
              URL:
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://github.com/user/repository.git"
              disabled={isCloning}
              className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] focus:outline-none rounded px-3 py-2 text-[#DFE1E5] placeholder-[#5A5D63]"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[#868A91] font-medium mb-1.5">
              Directory:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={directory}
                onChange={(e) => setDirectory(e.target.value)}
                disabled={isCloning}
                className="flex-1 bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] focus:outline-none rounded px-3 py-2 text-[#DFE1E5]"
              />
              <button
                type="button"
                onClick={handleBrowseDirectory}
                disabled={isCloning}
                className="px-3 py-2 bg-[#393B40] hover:bg-[#4E5157] text-[#DFE1E5] rounded flex items-center gap-1.5 border border-[#4E5157]"
                title="Browse Directory"
              >
                <FolderOpen size={14} />
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 bg-[#362222] border border-[#E05555]/40 rounded p-3 text-[#E05555]">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div className="whitespace-pre-wrap break-all text-[11px] leading-relaxed">
                {errorMessage}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-12 px-5 bg-[#1E1F22] border-t border-[#393B40] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isCloning}
            className="px-4 py-1.5 text-xs text-[#DFE1E5] bg-[#2B2D30] hover:bg-[#393B40] border border-[#4E5157] rounded"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleClone}
            disabled={isCloning || !url.trim()}
            className="px-5 py-1.5 text-xs text-white bg-[#3574F0] hover:bg-[#3064D0] disabled:opacity-50 disabled:cursor-not-allowed font-medium rounded flex items-center gap-2 shadow-sm"
          >
            {isCloning ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Cloning...</span>
              </>
            ) : (
              <span>Clone</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
