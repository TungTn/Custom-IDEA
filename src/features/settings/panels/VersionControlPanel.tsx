import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, Check, Plus, Trash2, Link, Layers, Archive, X } from 'lucide-react';
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

  // Issue Navigation state
  const [issuePatterns, setIssuePatterns] = useState<Array<{ id: string; pattern: string; targetUrl: string }>>(() => {
    return formSettings.vcsIssuePatterns || [
      { id: 'ip_1', pattern: '([A-Z]+-\\d+)', targetUrl: 'https://jira.example.com/browse/$1' },
      { id: 'ip_2', pattern: '#(\\d+)', targetUrl: 'https://github.com/example/repo/issues/$1' },
    ];
  });
  const [isAddPatternOpen, setIsAddPatternOpen] = useState(false);
  const [newIssuePattern, setNewIssuePattern] = useState('');
  const [newIssueUrl, setNewIssueUrl] = useState('');

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

      {/* Sub-page: VCS > Issue Navigation */}
      {selectedId === 'vcs-issue-navigation' && (
        <div className="space-y-6 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Issue Navigation</h2>
            <p className="text-xs text-[#868A91]">Link commit message issue keys (e.g., JIRA, GitLab issue #123) to their web tracker.</p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="border border-[#393B40] rounded overflow-hidden bg-[#26282B]">
              <div className="h-8 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] font-semibold text-[#868A91]">
                <span>Issue Pattern (RegEx)</span>
                <span>Target Issue Tracker URL</span>
                <span>Action</span>
              </div>
              <div className="divide-y divide-[#393B40]/50 font-mono text-[11px]">
                {issuePatterns.map((ip) => (
                  <div key={ip.id} className="px-3 py-2 flex items-center justify-between hover:bg-[#35373B]/40">
                    <span className="text-[#3574F0] font-semibold">{ip.pattern}</span>
                    <span className="text-[#868A91] truncate max-w-xs">{ip.targetUrl}</span>
                    <button
                      onClick={() => {
                        const updated = issuePatterns.filter(i => i.id !== ip.id);
                        setIssuePatterns(updated);
                        updateSetting('vcsIssuePatterns', updated);
                      }}
                      className="text-[#868A91] hover:text-[#E05555]"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {isAddPatternOpen ? (
              <div className="p-3 bg-[#26282B] border border-[#393B40] rounded space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[#868A91] block mb-1">Issue Pattern (e.g. MIC-\d+):</label>
                    <input
                      type="text"
                      placeholder="([A-Z]+-\d+)"
                      value={newIssuePattern}
                      onChange={(e) => setNewIssuePattern(e.target.value)}
                      className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white font-mono text-[11px] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[#868A91] block mb-1">Issue URL ($1 replacement):</label>
                    <input
                      type="text"
                      placeholder="https://github.com/example/repo/issues/$1"
                      value={newIssueUrl}
                      onChange={(e) => setNewIssueUrl(e.target.value)}
                      className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white font-mono text-[11px] outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (newIssuePattern.trim() && newIssueUrl.trim()) {
                        const updated = [...issuePatterns, { id: `ip_${Date.now()}`, pattern: newIssuePattern.trim(), targetUrl: newIssueUrl.trim() }];
                        setIssuePatterns(updated);
                        updateSetting('vcsIssuePatterns', updated);
                        setNewIssuePattern('');
                        setNewIssueUrl('');
                        setIsAddPatternOpen(false);
                      }
                    }}
                    className="px-3 py-1 bg-[#3574F0] text-white rounded text-xs"
                  >
                    Add Pattern
                  </button>
                  <button onClick={() => setIsAddPatternOpen(false)} className="px-3 py-1 bg-[#35373B] text-white rounded text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddPatternOpen(true)}
                className="px-3 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-white border border-[#393B40] rounded text-xs flex items-center gap-1.5"
              >
                <Plus size={12} /> Add Issue Pattern...
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sub-page: VCS > Changelists */}
      {selectedId === 'vcs-changelists' && (
        <div className="space-y-6 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Changelists</h2>
            <p className="text-xs text-[#868A91]">Organize pending file modifications into discrete logical changelists before committing.</p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="p-4 bg-[#26282B] border border-[#393B40] rounded space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.vcsUseChangelists ?? true}
                  onChange={(e) => updateSetting('vcsUseChangelists', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white font-medium">Enable Git changelists support instead of single staging area</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer pl-6">
                <input
                  type="checkbox"
                  checked={formSettings.vcsAutoActiveChangelist ?? true}
                  onChange={(e) => updateSetting('vcsAutoActiveChangelist', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white">Automatically create new changelist on branch checkout</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer pl-6">
                <input type="checkbox" defaultChecked={true} className="accent-[#3574F0] rounded" />
                <span className="text-white">Highlight files belonging to inactive changelists in Project tree</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Sub-page: VCS > Shelve */}
      {selectedId === 'vcs-shelve' && (
        <div className="space-y-6 text-xs">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Shelve</h2>
            <p className="text-xs text-[#868A91]">Manage temporary shelved patches, separate from Git stash commits.</p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="p-4 bg-[#26282B] border border-[#393B40] rounded space-y-3.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSettings.vcsAutoShelveOnMerge ?? true}
                  onChange={(e) => updateSetting('vcsAutoShelveOnMerge', e.target.checked)}
                  className="accent-[#3574F0] rounded"
                />
                <span className="text-white font-medium">Automatically shelve local changes before Git Pull or Rebase</span>
              </label>

              <div className="space-y-1.5 pt-2 border-t border-[#393B40]/60">
                <label className="text-[#DFE1E5] block">Shelf storage folder:</label>
                <input
                  type="text"
                  value={formSettings.vcsShelfDirectory || '.idea/shelf'}
                  onChange={(e) => updateSetting('vcsShelfDirectory', e.target.value)}
                  className="w-full bg-[#1E1F22] border border-[#393B40] rounded px-2.5 py-1 text-white font-mono text-[11px] outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[#868A91]">Purge unshelved patches older than:</span>
                <select className="bg-[#1E1F22] border border-[#393B40] rounded px-3 py-1 text-white outline-none">
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="never">Never</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
