import { invoke } from '@tauri-apps/api/core';
import { GitLabAccount, GitLabProject, GitLabUser } from '../types/gitlab';

const STORAGE_KEY_ACCOUNTS = 'custom_idea_gitlab_accounts';
const STORAGE_KEY_ACTIVE = 'custom_idea_gitlab_active_id';

export function getGitLabAccounts(): GitLabAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse GitLab accounts from localStorage', e);
  }
  return [];
}

export function saveGitLabAccount(account: GitLabAccount): GitLabAccount[] {
  const accounts = getGitLabAccounts();
  const existingIdx = accounts.findIndex((a) => a.id === account.id || a.host === account.host);

  if (existingIdx >= 0) {
    accounts[existingIdx] = account;
  } else {
    accounts.push(account);
  }

  localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
  if (!getActiveGitLabAccountId()) {
    setActiveGitLabAccountId(account.id);
  }
  return accounts;
}

export function removeGitLabAccount(id: string): GitLabAccount[] {
  const accounts = getGitLabAccounts().filter((a) => a.id !== id);
  localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));

  if (getActiveGitLabAccountId() === id) {
    const nextId = accounts.length > 0 ? accounts[0].id : '';
    setActiveGitLabAccountId(nextId);
  }
  return accounts;
}

export function getActiveGitLabAccountId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_ACTIVE);
  } catch {
    return null;
  }
}

export function setActiveGitLabAccountId(id: string): void {
  if (id) {
    localStorage.setItem(STORAGE_KEY_ACTIVE, id);
  } else {
    localStorage.removeItem(STORAGE_KEY_ACTIVE);
  }
}

export function getActiveGitLabAccount(): GitLabAccount | null {
  const accounts = getGitLabAccounts();
  const activeId = getActiveGitLabAccountId();
  if (activeId) {
    const found = accounts.find((a) => a.id === activeId);
    if (found) return found;
  }
  return accounts.length > 0 ? accounts[0] : null;
}

export async function testGitLabConnection(host: string, token: string): Promise<GitLabUser> {
  const cleanHost = host.trim();
  const cleanToken = token.trim();

  if (!cleanHost) {
    throw new Error('Vui lòng nhập GitLab Server URL.');
  }
  if (!cleanToken) {
    throw new Error('Vui lòng nhập Personal Access Token.');
  }

  return await invoke<GitLabUser>('gitlab_test_connection', {
    host: cleanHost,
    token: cleanToken,
  });
}

export async function fetchGitLabProjects(
  host: string,
  token: string,
  search?: string,
  page: number = 1,
  perPage: number = 50
): Promise<GitLabProject[]> {
  const cleanHost = host.trim();
  const cleanToken = token.trim();

  if (!cleanHost || !cleanToken) {
    return [];
  }

  return await invoke<GitLabProject[]>('gitlab_list_projects', {
    host: cleanHost,
    token: cleanToken,
    search: search ? search.trim() : null,
    page,
    perPage,
  });
}
