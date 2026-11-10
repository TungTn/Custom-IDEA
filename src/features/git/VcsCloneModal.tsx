import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  GitBranch,
  FolderOpen,
  Loader2,
  AlertCircle,
  Globe,
  Link,
  Search,
  RefreshCw,
  Lock,
  Plus,
  Check,
} from 'lucide-react';
import { FileNode } from '../../types';
import { GitLabAccount, GitLabProject } from '../../types/gitlab';
import {
  getGitLabAccounts,
  getActiveGitLabAccount,
  setActiveGitLabAccountId,
  saveGitLabAccount,
  testGitLabConnection,
  fetchGitLabProjects,
} from '../../services/gitlabService';

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

  const [activeTab, setActiveTab] = useState<'url' | 'gitlab'>('url');

  // Generic URL tab state
  const [url, setUrl] = useState('');
  const [directory, setDirectory] = useState<string>(() => getBaseDir());
  const [isCloning, setIsCloning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // GitLab tab state
  const [accounts, setAccounts] = useState<GitLabAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<GitLabAccount | null>(null);
  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<GitLabProject | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [cloneProtocol, setCloneProtocol] = useState<'https' | 'ssh'>('https');

  // Quick login state when no account exists
  const [quickHost, setQuickHost] = useState('https://gitlab.mic.vn');
  const [quickToken, setQuickToken] = useState('');
  const [quickTesting, setQuickTesting] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl('');
      setErrorMessage(null);
      setIsCloning(false);
      const base = getBaseDir();
      setDirectory(base);

      // Load GitLab accounts
      const accList = getGitLabAccounts();
      setAccounts(accList);
      const active = getActiveGitLabAccount();
      setSelectedAccount(active);
      setSelectedProject(null);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Fetch projects when selectedAccount changes or tab switches to gitlab
  useEffect(() => {
    if (isOpen && activeTab === 'gitlab' && selectedAccount) {
      loadProjects(selectedAccount, searchQuery);
    }
  }, [isOpen, activeTab, selectedAccount]);

  const loadProjects = async (account: GitLabAccount, search: string = '') => {
    setIsLoadingProjects(true);
    setProjectError(null);
    try {
      const list = await fetchGitLabProjects(account.host, account.token, search);
      setProjects(list);
    } catch (err: any) {
      console.error('Failed to fetch GitLab projects:', err);
      setProjectError(typeof err === 'string' ? err : err.message || 'Không thể tải danh sách dự án');
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleQuickAddAccount = async () => {
    if (!quickHost.trim() || !quickToken.trim()) {
      setQuickError('Vui lòng nhập Server URL và Personal Access Token.');
      return;
    }
    setQuickTesting(true);
    setQuickError(null);
    try {
      const user = await testGitLabConnection(quickHost.trim(), quickToken.trim());
      const newAcc: GitLabAccount = {
        id: `gl_${Date.now()}`,
        host: quickHost.trim(),
        token: quickToken.trim(),
        user,
        createdAt: Date.now(),
        lastVerifiedAt: Date.now(),
      };
      const updated = saveGitLabAccount(newAcc);
      setAccounts(updated);
      setSelectedAccount(newAcc);
      setActiveGitLabAccountId(newAcc.id);
      setQuickToken('');
      onShowToast('GitLab Connected', `Đã kết nối tài khoản @${user.username}`, 'success');
    } catch (err: any) {
      setQuickError(typeof err === 'string' ? err : err.message || 'Kết nối thất bại');
    } finally {
      setQuickTesting(false);
    }
  };

  const handleSelectProject = (proj: GitLabProject) => {
    setSelectedProject(proj);
    setErrorMessage(null);

    const targetUrl = cloneProtocol === 'ssh' ? proj.ssh_url_to_repo : proj.http_url_to_repo;
    setUrl(targetUrl);

    const base = getBaseDir();
    setDirectory(base ? `${base}\\${proj.name}` : proj.name);
  };

  const handleProtocolChange = (proto: 'https' | 'ssh') => {
    setCloneProtocol(proto);
    if (selectedProject) {
      setUrl(proto === 'ssh' ? selectedProject.ssh_url_to_repo : selectedProject.http_url_to_repo);
    }
  };

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl w-[760px] h-[540px] text-[#DFE1E5] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-10 px-4 bg-[#1E1F22] border-b border-[#393B40] flex items-center justify-between select-none flex-shrink-0">
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

        {/* Content Body: Sidebar + Main */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-48 bg-[#1E1F22] border-r border-[#393B40] flex flex-col p-2 gap-1 select-none flex-shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs transition-colors ${
                activeTab === 'url'
                  ? 'bg-[#2B2D30] text-white font-medium border border-[#3574F0]/40'
                  : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/50'
              }`}
            >
              <Link size={14} className={activeTab === 'url' ? 'text-[#3574F0]' : ''} />
              <span>Repository URL</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('gitlab')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs transition-colors ${
                activeTab === 'gitlab'
                  ? 'bg-[#2B2D30] text-white font-medium border border-[#FC6D26]/40'
                  : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/50'
              }`}
            >
              <Globe size={14} className={activeTab === 'gitlab' ? 'text-[#FC6D26]' : ''} />
              <div className="flex items-center justify-between flex-1">
                <span>GitLab</span>
                {accounts.length > 0 && (
                  <span className="text-[10px] bg-[#393B40] text-[#DFE1E5] px-1.5 py-0.2 rounded-full">
                    {accounts.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* Right Main Pane */}
          <div className="flex-1 flex flex-col bg-[#2B2D30] overflow-hidden p-4">
            {activeTab === 'url' ? (
              /* TAB 1: REPOSITORY URL */
              <div className="flex-1 flex flex-col justify-center gap-5 text-xs max-w-lg mx-auto w-full">
                <div>
                  <label className="block text-[#868A91] font-medium mb-1.5">
                    URL:
                  </label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://gitlab.mic.vn/group/project.git hoặc https://github.com/user/repo.git"
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
            ) : (
              /* TAB 2: GITLAB REPOSITORY EXPLORER */
              <div className="flex-1 flex flex-col overflow-hidden text-xs">
                {accounts.length === 0 ? (
                  /* Form kết nối nhanh khi chưa có tài khoản */
                  <div className="flex-1 flex flex-col justify-center items-center max-w-md mx-auto w-full gap-4">
                    <div className="text-center space-y-1">
                      <div className="w-10 h-10 rounded-full bg-[#FC6D26]/20 border border-[#FC6D26]/40 text-[#FC6D26] flex items-center justify-center mx-auto mb-2">
                        <Globe size={20} />
                      </div>
                      <h3 className="font-semibold text-sm text-white">Kết nối tài khoản GitLab</h3>
                      <p className="text-[11px] text-[#868A91]">
                        Đăng nhập bằng Personal Access Token để xem và clone repository của bạn.
                      </p>
                    </div>

                    <div className="w-full space-y-3 bg-[#1E1F22] p-4 rounded-lg border border-[#393B40]">
                      <div>
                        <label className="text-[#868A91] block mb-1">GitLab Server URL:</label>
                        <input
                          type="text"
                          value={quickHost}
                          onChange={(e) => setQuickHost(e.target.value)}
                          placeholder="https://gitlab.mic.vn"
                          className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[#868A91] block mb-1">Personal Access Token (read_api):</label>
                        <input
                          type="password"
                          value={quickToken}
                          onChange={(e) => setQuickToken(e.target.value)}
                          placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                          className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none"
                        />
                      </div>

                      {quickError && (
                        <div className="text-[11px] text-[#E05555] bg-[#362222] border border-[#E05555]/30 rounded p-2 flex items-start gap-1.5">
                          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                          <span>{quickError}</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleQuickAddAccount}
                        disabled={quickTesting || !quickHost.trim() || !quickToken.trim()}
                        className="w-full py-1.5 bg-[#3574F0] hover:bg-[#3064D0] text-white rounded font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {quickTesting ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Đang xác thực...</span>
                          </>
                        ) : (
                          <span>Đăng nhập GitLab</span>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Đã có tài khoản: Danh sách repository */
                  <div className="flex-1 flex flex-col overflow-hidden gap-3">
                    {/* Top bar: Account selector + Search + Protocol */}
                    <div className="flex items-center gap-2 select-none flex-shrink-0">
                      {/* Account selector */}
                      <select
                        value={selectedAccount?.id || ''}
                        onChange={(e) => {
                          const found = accounts.find((a) => a.id === e.target.value);
                          if (found) {
                            setSelectedAccount(found);
                            setActiveGitLabAccountId(found.id);
                          }
                        }}
                        className="bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1.5 text-xs text-white outline-none max-w-[200px]"
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            @{acc.user?.username || 'user'} ({new URL(acc.host).hostname})
                          </option>
                        ))}
                      </select>

                      {/* Search box */}
                      <div className="flex-1 relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#868A91]" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (selectedAccount) {
                              loadProjects(selectedAccount, e.target.value);
                            }
                          }}
                          placeholder="Tìm kiếm repository..."
                          className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded pl-8 pr-3 py-1.5 text-xs text-white outline-none"
                        />
                      </div>

                      {/* Protocol Toggle */}
                      <div className="flex items-center bg-[#1E1F22] border border-[#393B40] rounded p-0.5">
                        <button
                          type="button"
                          onClick={() => handleProtocolChange('https')}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                            cloneProtocol === 'https' ? 'bg-[#3574F0] text-white' : 'text-[#868A91]'
                          }`}
                        >
                          HTTPS
                        </button>
                        <button
                          type="button"
                          onClick={() => handleProtocolChange('ssh')}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                            cloneProtocol === 'ssh' ? 'bg-[#3574F0] text-white' : 'text-[#868A91]'
                          }`}
                        >
                          SSH
                        </button>
                      </div>

                      {/* Refresh button */}
                      <button
                        type="button"
                        onClick={() => selectedAccount && loadProjects(selectedAccount, searchQuery)}
                        disabled={isLoadingProjects}
                        className="p-1.5 bg-[#1E1F22] hover:bg-[#393B40] border border-[#393B40] text-[#DFE1E5] rounded transition-colors"
                        title="Tải lại danh sách"
                      >
                        <RefreshCw size={13} className={isLoadingProjects ? 'animate-spin' : ''} />
                      </button>
                    </div>

                    {/* Projects List View */}
                    <div className="flex-1 bg-[#1E1F22] border border-[#393B40] rounded overflow-y-auto min-h-0">
                      {isLoadingProjects ? (
                        <div className="h-full flex flex-col items-center justify-center text-[#868A91] gap-2">
                          <Loader2 size={18} className="animate-spin text-[#3574F0]" />
                          <span>Đang tải danh sách repository từ GitLab...</span>
                        </div>
                      ) : projectError ? (
                        <div className="p-4 text-center text-[#E05555] space-y-2">
                          <div>{projectError}</div>
                          <button
                            type="button"
                            onClick={() => selectedAccount && loadProjects(selectedAccount, searchQuery)}
                            className="px-3 py-1 bg-[#2B2D30] border border-[#393B40] text-[#DFE1E5] rounded text-xs"
                          >
                            Thử lại
                          </button>
                        </div>
                      ) : projects.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-[#868A91]">
                          Không tìm thấy repository nào.
                        </div>
                      ) : (
                        <div className="divide-y divide-[#2B2D30]">
                          {projects.map((proj) => {
                            const isSelected = selectedProject?.id === proj.id;
                            return (
                              <div
                                key={proj.id}
                                onClick={() => handleSelectProject(proj)}
                                className={`px-3 py-2.5 cursor-pointer transition-colors flex items-center justify-between ${
                                  isSelected
                                    ? 'bg-[#3574F0]/20 border-l-2 border-[#3574F0]'
                                    : 'hover:bg-[#2B2D30]/60'
                                }`}
                              >
                                <div className="space-y-0.5 min-w-0 pr-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-white truncate">
                                      {proj.path_with_namespace}
                                    </span>
                                    {proj.visibility === 'private' && (
                                      <Lock size={11} className="text-[#868A91] flex-shrink-0" />
                                    )}
                                  </div>
                                  {proj.description && (
                                    <div className="text-[11px] text-[#868A91] truncate max-w-md">
                                      {proj.description}
                                    </div>
                                  )}
                                  <div className="text-[10px] text-[#5A5D63] font-mono">
                                    {cloneProtocol === 'ssh' ? proj.ssh_url_to_repo : proj.http_url_to_repo}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-[#868A91]">
                                  {proj.default_branch && (
                                    <span className="bg-[#2B2D30] px-1.5 py-0.5 rounded text-[10px] font-mono text-[#868A91]">
                                      {proj.default_branch}
                                    </span>
                                  )}
                                  {isSelected && (
                                    <Check size={14} className="text-[#3574F0]" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Destination Directory & Selected Project URL */}
                    <div className="space-y-2 flex-shrink-0 pt-1">
                      <div>
                        <label className="block text-[#868A91] text-[11px] font-medium mb-1">
                          Directory:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={directory}
                            onChange={(e) => setDirectory(e.target.value)}
                            disabled={isCloning}
                            className="flex-1 bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] focus:outline-none rounded px-3 py-1.5 text-xs text-[#DFE1E5]"
                          />
                          <button
                            type="button"
                            onClick={handleBrowseDirectory}
                            disabled={isCloning}
                            className="px-3 py-1.5 bg-[#393B40] hover:bg-[#4E5157] text-[#DFE1E5] rounded flex items-center gap-1.5 border border-[#4E5157]"
                            title="Browse Directory"
                          >
                            <FolderOpen size={14} />
                          </button>
                        </div>
                      </div>

                      {errorMessage && (
                        <div className="flex items-start gap-2 bg-[#362222] border border-[#E05555]/40 rounded p-2 text-[#E05555]">
                          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                          <div className="text-[11px] leading-tight break-all">{errorMessage}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 px-5 bg-[#1E1F22] border-t border-[#393B40] flex items-center justify-end gap-2.5 flex-shrink-0">
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
