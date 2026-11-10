import { invoke } from '@tauri-apps/api/core';
import { GitLabAccount, GitLabProject, GitLabUser } from '../types/gitlab';

const STORAGE_KEY_ACCOUNTS = 'custom_idea_gitlab_accounts';
const STORAGE_KEY_ACTIVE = 'custom_idea_gitlab_active_id';

interface LegacyGitLabAccount extends GitLabAccount {
  token?: string;
}

function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

export function normalizeGitLabHost(host: string): string {
  const trimmed = host.trim();
  if (!trimmed) return '';
  if (/^http:\/\//i.test(trimmed)) {
    throw new Error('HTTPS is required for GitLab authentication.');
  }
  if (/^[a-z][a-z0-9+.-]*:$/i.test(trimmed)) {
    throw new Error('Invalid GitLab Server URL.');
  }
  const withScheme = /^https:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error('Invalid GitLab Server URL.');
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname) {
    throw new Error('HTTPS is required for GitLab authentication.');
  }
  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${cleanPath}`;
}

export function getGitLabHostname(host: string): string {
  try {
    const trimmed = host.trim();
    if (!trimmed) return 'gitlab';
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withScheme).hostname;
  } catch {
    return host.trim() || 'gitlab';
  }
}

export function sanitizeRepoFolderName(pathWithNamespaceOrName: string): string {
  const cleanInput = pathWithNamespaceOrName.trim().replace(/[/\\]+$/, '');
  const lastSegment = cleanInput.split(/[/\\:]/).pop() || 'repo';
  const rawSlug = lastSegment
    .replace(/\.git$/i, '')
    .replace(/\.\./g, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .trim();
  return rawSlug || 'repo';
}

function stripToken(acc: LegacyGitLabAccount): GitLabAccount {
  const { token: _removed, ...clean } = acc;
  return clean;
}

function readRawAccounts(): LegacyGitLabAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error('Failed to parse GitLab accounts from localStorage', e);
  }
  return [];
}

export function getGitLabAccounts(): GitLabAccount[] {
  return readRawAccounts().map(stripToken);
}

export async function migrateLegacyGitLabTokens(): Promise<GitLabAccount[]> {
  const rawAccounts = readRawAccounts();
  if (!rawAccounts.some((a) => typeof a.token === 'string' && a.token.trim().length > 0)) {
    return rawAccounts.map(stripToken);
  }
  if (!isTauriRuntime()) {
    return rawAccounts.map(stripToken);
  }

  let changed = false;
  const migrated: LegacyGitLabAccount[] = [];
  for (const acc of rawAccounts) {
    if (typeof acc.token === 'string' && acc.token.trim().length > 0) {
      try {
        const normHost = normalizeGitLabHost(acc.host);
        await invoke('gitlab_save_token', {
          accountId: acc.id,
          host: normHost,
          token: acc.token.trim(),
        });
        migrated.push({ ...stripToken(acc), host: normHost });
        changed = true;
      } catch (err) {
        console.error(`Failed to migrate GitLab token for ${acc.host}:`, err);
        migrated.push(acc);
      }
    } else {
      migrated.push(acc);
    }
  }

  if (changed) {
    localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(migrated));
  }
  return migrated.map(stripToken);
}

export async function saveGitLabAccount(
  account: Omit<GitLabAccount, 'id'> & { id?: string },
  token: string
): Promise<{ accounts: GitLabAccount[]; savedAccount: GitLabAccount }> {
  const cleanHost = normalizeGitLabHost(account.host);
  const cleanToken = token.trim();
  if (!cleanHost) {
    throw new Error('Vui lòng nhập GitLab Server URL.');
  }
  if (!cleanToken) {
    throw new Error('Vui lòng nhập Personal Access Token.');
  }

  const rawAccounts = readRawAccounts();
  const existingIdx = rawAccounts.findIndex((a) => {
    try {
      return (
        (account.id && a.id === account.id) ||
        normalizeGitLabHost(a.host) === cleanHost
      );
    } catch {
      return a.id === account.id || a.host === cleanHost;
    }
  });

  // Reuse existing ID when updating the same host to avoid orphaned keyring secrets
  const targetId = existingIdx >= 0 ? rawAccounts[existingIdx].id : account.id || `gl_${Date.now()}`;
  const cleanAccount: GitLabAccount = {
    ...stripToken(account as LegacyGitLabAccount),
    id: targetId,
    host: cleanHost,
  };

  if (isTauriRuntime()) {
    await invoke('gitlab_save_token', {
      accountId: targetId,
      host: cleanHost,
      token: cleanToken,
    });
  }

  const nextAccounts = rawAccounts.map(stripToken);
  if (existingIdx >= 0) {
    nextAccounts[existingIdx] = cleanAccount;
  } else {
    nextAccounts.push(cleanAccount);
  }

  try {
    localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(nextAccounts));
  } catch (err) {
    if (existingIdx < 0 && isTauriRuntime()) {
      await invoke('gitlab_delete_token', { accountId: targetId }).catch(() => {});
    }
    throw err;
  }

  if (!getActiveGitLabAccountId()) {
    setActiveGitLabAccountId(cleanAccount.id);
  }
  return { accounts: nextAccounts, savedAccount: cleanAccount };
}

export async function removeGitLabAccount(id: string): Promise<GitLabAccount[]> {
  if (isTauriRuntime()) {
    await invoke('gitlab_delete_token', { accountId: id });
  }

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

export async function testGitLabConnection(
  host: string,
  token: string,
  allowSelfSigned: boolean = false
): Promise<GitLabUser> {
  const cleanHost = normalizeGitLabHost(host);
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
    allowSelfSigned,
  });
}

export async function fetchGitLabProjects(
  host: string,
  accountId: string,
  allowSelfSigned: boolean = false,
  search?: string,
  page: number = 1,
  perPage: number = 50
): Promise<GitLabProject[]> {
  const cleanHost = normalizeGitLabHost(host);
  const cleanId = accountId.trim();

  if (!cleanHost || !cleanId) {
    return [];
  }

  return await invoke<GitLabProject[]>('gitlab_list_projects', {
    host: cleanHost,
    accountId: cleanId,
    allowSelfSigned,
    search: search ? search.trim() : null,
    page,
    perPage,
  });
}
