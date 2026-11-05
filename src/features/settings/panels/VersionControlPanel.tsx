import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, Check } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { SettingPanelProps } from './types';

export const VersionControlPanel: React.FC<SettingPanelProps> = ({
  selectedId,
  formSettings,
  updateSetting,
  setFormSettings,
  onShowToast,
}) => {
  const [gitTestStatus, setGitTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [gitTestMessage, setGitTestMessage] = useState('');

  const handleTestGit = async () => {
    setGitTestStatus('testing');
    setGitTestMessage('Testing Git executable...');
    try {
      const res = await invoke<string>('test_git_executable', { path: formSettings.gitPath || 'git' });
      setGitTestStatus('success');
      setGitTestMessage(res);
      onShowToast?.('Git Detected', res, 'success');
    } catch (err: any) {
      setGitTestStatus('error');
      setGitTestMessage(String(err));
      onShowToast?.('Git Test Failed', String(err), 'error');
    }
  };

  return (
    <div>
      {/* Sub-page: Version Control > Git */}
      {selectedId === 'vcs-git' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Git</h2>
            <p className="text-xs text-[#868A91]">Configure Git integration and path to executable.</p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div>
              <label className="text-[#868A91] block mb-1">Path to Git executable:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={formSettings.gitPath || 'git'}
                  onChange={(e) => updateSetting('gitPath', e.target.value)}
                  className="flex-1 bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none"
                />
                <button 
                  onClick={handleTestGit}
                  disabled={gitTestStatus === 'testing'}
                  className="px-3.5 py-1.5 bg-[#35373B] hover:bg-[#3E4146] text-[#DFE1E5] rounded text-xs border border-[#393B40] flex items-center gap-1.5 transition-colors"
                >
                  {gitTestStatus === 'testing' ? <RefreshCw size={12} className="animate-spin" /> : null}
                  Test
                </button>
              </div>

              {/* Git test output message */}
              {gitTestStatus === 'success' && (
                <div className="mt-2 text-xs text-[#59A869] flex items-center gap-1.5 bg-[#59A869]/10 px-2.5 py-1.5 rounded border border-[#59A869]/20 font-mono">
                  <CheckCircle2 size={13} /> {gitTestMessage}
                </div>
              )}
              {gitTestStatus === 'error' && (
                <div className="mt-2 text-xs text-[#E05555] flex items-center gap-1.5 bg-[#E05555]/10 px-2.5 py-1.5 rounded border border-[#E05555]/20 font-mono">
                  <AlertTriangle size={13} /> {gitTestMessage}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[#393B40] space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span>Auto-update if push of the current branch was rejected</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[#3574F0] rounded" />
                <span>Show commit message history and author</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: VCS Directory Mappings */}
      {selectedId === 'vcs-directory-mappings' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Directory Mappings</h2>
            <p className="text-xs text-[#868A91]">Map workspace project directories to their version control systems.</p>
          </div>

          <div className="border border-[#393B40] rounded overflow-hidden bg-[#26282B] text-xs max-w-xl">
            <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91] uppercase">
              <span>Directory</span>
              <span>VCS</span>
            </div>
            <div className="p-3 flex justify-between items-center font-mono text-xs">
              <span>&lt;Project Root&gt;</span>
              <span className="text-[#3574F0] font-semibold">Git (D:\IDE)</span>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: VCS Confirmation */}
      {selectedId === 'vcs-confirmation' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Confirmation</h2>
            <p className="text-xs text-[#868A91]">Choose actions when files are created or deleted from repository.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="font-semibold text-white block mb-1.5">When files are created:</label>
              <div className="space-y-1.5 pl-1">
                <label className="flex items-center gap-2"><input type="radio" name="createVcs" defaultChecked className="accent-[#3574F0]" /> Ask</label>
                <label className="flex items-center gap-2"><input type="radio" name="createVcs" className="accent-[#3574F0]" /> Add silently</label>
                <label className="flex items-center gap-2"><input type="radio" name="createVcs" className="accent-[#3574F0]" /> Do not add</label>
              </div>
            </div>

            <div className="pt-2 border-t border-[#393B40]">
              <label className="font-semibold text-white block mb-1.5">When files are deleted:</label>
              <div className="space-y-1.5 pl-1">
                <label className="flex items-center gap-2"><input type="radio" name="delVcs" defaultChecked className="accent-[#3574F0]" /> Ask</label>
                <label className="flex items-center gap-2"><input type="radio" name="delVcs" className="accent-[#3574F0]" /> Remove silently</label>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => onShowToast?.('Decisions Cleared', 'All "Do not ask again" choices reset', 'info')}
                className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-xs text-[#DFE1E5] rounded border border-[#393B40]"
              >
                Clear Saved Decisions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: VCS > GitHub & Cloud VCS */}
      {selectedId === 'vcs-github' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">GitHub & Cloud VCS</h2>
            <p className="text-xs text-[#868A91]">Manage GitHub, GitLab, and Bitbucket remote accounts and clone preferences.</p>
          </div>

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="text-[#868A91] block mb-1">GitHub Enterprise / Server URL:</label>
              <input
                type="text"
                value={formSettings.githubEnterpriseUrl || 'https://github.com'}
                onChange={(e) => updateSetting('githubEnterpriseUrl', e.target.value)}
                className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none"
              />
            </div>

            <div className="border border-[#393B40] rounded bg-[#26282B] p-3 space-y-2">
              {localStorage.getItem('intellij_github_user') ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#3574F0] text-white flex items-center justify-center font-bold text-[10px]">
                      GH
                    </div>
                    <div>
                      <div className="font-semibold text-white">{localStorage.getItem('intellij_github_user')}</div>
                      <div className="text-[11px] text-[#868A91]">OAuth Token (Authenticated)</div>
                    </div>
                  </div>
                  <span className="text-[#59A869] text-xs flex items-center gap-1"><Check size={13} /> Active</span>
                </div>
              ) : (
                <div className="flex items-center justify-between py-1">
                  <div className="text-xs text-[#868A91]">No GitHub accounts added yet.</div>
                  <button
                    type="button"
                    onClick={() => {
                      const u = prompt('Enter your GitHub username or token:');
                      if (u && u.trim()) {
                        localStorage.setItem('intellij_github_user', u.trim());
                        setFormSettings(prev => ({ ...prev }));
                      }
                    }}
                    className="px-2.5 py-1 text-xs bg-[#3574F0] hover:bg-[#3062D4] text-white rounded transition-colors"
                  >
                    + Log in via GitHub...
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span>Clone Repository Protocol:</span>
              <select
                value={formSettings.gitAuthType || 'token'}
                onChange={(e) => updateSetting('gitAuthType', e.target.value as any)}
                className="bg-[#2B2D30] border border-[#393B40] rounded px-3 py-1 text-white outline-none"
              >
                <option value="token">HTTPS (Personal Access Token / OAuth)</option>
                <option value="ssh">SSH (id_ed25519 / id_rsa)</option>
              </select>
            </div>

            <div>
              <label className="text-[#868A91] block mb-1">Default branch name for new repositories:</label>
              <input
                type="text"
                value={formSettings.gitDefaultBranch || 'main'}
                onChange={(e) => updateSetting('gitDefaultBranch', e.target.value)}
                className="w-48 bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1 text-white font-mono outline-none"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.gitAutoFetch ?? true}
                onChange={(e) => updateSetting('gitAutoFetch', e.target.checked)}
                className="accent-[#3574F0] rounded"
              />
              <span>Automatically fetch remote branches in background</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.gitGpgSigning ?? false}
                onChange={(e) => updateSetting('gitGpgSigning', e.target.checked)}
                className="accent-[#3574F0] rounded"
              />
              <span>Sign commits with GPG key automatically</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
