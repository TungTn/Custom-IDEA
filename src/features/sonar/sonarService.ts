import { invoke } from '@tauri-apps/api/core';
import { setSecret, getSecret, deleteSecret } from '../../services/secretService';

export interface SonarServerConfig {
  serverUrl: string;
  projectKey: string;
  token?: string;
}

export interface SonarServerStatus {
  id: string;
  version: string;
  status: 'UP' | 'DOWN' | 'STARTING' | 'RESTARTING' | 'DB_MIGRATION_NEEDED';
}

export interface SonarQualityGateStatus {
  status: 'OK' | 'WARN' | 'ERROR';
  ignoredConditions?: boolean;
  conditions?: Array<{
    status: 'OK' | 'WARN' | 'ERROR';
    metricKey: string;
    comparator: string;
    errorThreshold?: string;
    actualValue?: string;
  }>;
}

export interface SonarRemoteIssue {
  key: string;
  rule: string;
  severity: 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';
  component: string;
  project: string;
  line?: number;
  message: string;
  type: 'BUG' | 'VULNERABILITY' | 'CODE_SMELL' | 'SECURITY_HOTSPOT';
  author?: string;
  effort?: string;
  status: string;
}

export interface SonarConnection {
  id: string;
  name: string;
  serverUrl: string;
  token: string;
}

export interface SonarProjectBinding {
  bindEnabled: boolean;
  connectionId: string;
  projectKey: string;
  fileExclusions?: string[];
}

const STORAGE_KEY = 'intellij_sonarqube_config';
const CONNECTIONS_STORAGE_KEY = 'intellij_sonarqube_connections';
const BINDING_STORAGE_KEY = 'intellij_sonarqube_binding';

export function validateSonarUrl(serverUrl: string, hasToken: boolean): void {
  const trimmed = serverUrl.trim();
  if (!trimmed) return;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:') {
      const hostname = parsed.hostname.toLowerCase();
      const isLocal =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '[::1]';
      if (hasToken && !isLocal) {
        throw new Error(
          'Sending Sonar authentication credentials over insecure cleartext HTTP is prohibited. Please use HTTPS or localhost loopback.'
        );
      }
    } else if (parsed.protocol !== 'https:') {
      throw new Error(`Unsupported protocol '${parsed.protocol}'. Only HTTP (localhost) and HTTPS are supported.`);
    }
  } catch (err: any) {
    if (err.message && err.message.includes('prohibited')) throw err;
    throw new Error(`Invalid Sonar server URL: ${err.message || String(err)}`);
  }
}

export const getSavedSonarConnections = (): SonarConnection[] => {
  try {
    const raw = localStorage.getItem(CONNECTIONS_STORAGE_KEY);
    if (raw) {
      const parsed: SonarConnection[] = JSON.parse(raw);
      let needsResave = false;
      parsed.forEach((c) => {
        if (c.token) {
          setSecret('sonar', c.id, c.token).catch(() => {});
          c.token = '';
          needsResave = true;
        }
      });
      if (needsResave) {
        localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to read Sonar connections:', e);
  }
  const legacy = getSavedSonarConfig();
  return [
    {
      id: 'conn-sonar-1',
      name: 'Sonar',
      serverUrl: legacy.serverUrl || 'https://sonar.example.com',
      token: '',
    },
  ];
};

export const saveSonarConnections = (conns: SonarConnection[]) => {
  conns.forEach((c) => {
    validateSonarUrl(c.serverUrl, Boolean(c.token));
    if (c.token) {
      setSecret('sonar', c.id, c.token).catch((e) => console.warn('Failed to save Sonar token to keyring:', e));
    }
  });
  try {
    const sanitized = conns.map((c) => ({ ...c, token: '' }));
    localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (e) {
    console.error('Failed to save Sonar connections:', e);
  }
};

export const getSavedSonarBinding = (): SonarProjectBinding => {
  try {
    const raw = localStorage.getItem(BINDING_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read Sonar project binding:', e);
  }
  const conns = getSavedSonarConnections();
  const legacy = getSavedSonarConfig();
  return {
    bindEnabled: true,
    connectionId: conns[0]?.id || 'conn-sonar-1',
    projectKey: legacy.projectKey || 'mic-fe-personal-pre',
    fileExclusions: ['**/*.test.ts', '**/*.spec.ts', 'target/**', 'dist/**', 'node_modules/**'],
  };
};

export const saveSonarBinding = (binding: SonarProjectBinding) => {
  try {
    localStorage.setItem(BINDING_STORAGE_KEY, JSON.stringify(binding));
    const conns = getSavedSonarConnections();
    const activeConn = conns.find((c) => c.id === binding.connectionId) || conns[0];
    if (activeConn) {
      // Update serverUrl and projectKey without touching keyring token
      saveSonarConfig({
        serverUrl: activeConn.serverUrl,
        projectKey: binding.projectKey,
      });
    }
  } catch (e) {
    console.error('Failed to save Sonar project binding:', e);
  }
};

export const getSavedSonarConfig = (): SonarServerConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: SonarServerConfig = JSON.parse(raw);
      if (parsed.token) {
        setSecret('sonar', 'default', parsed.token).catch(() => {});
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, token: '' }));
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to read SonarQube config:', e);
  }
  return {
    serverUrl: 'https://sonar.example.com',
    projectKey: 'my-project',
    token: '',
  };
};

export const saveSonarConfig = (cfg: Partial<SonarServerConfig> & { serverUrl?: string; projectKey?: string }) => {
  if (cfg.serverUrl) {
    validateSonarUrl(cfg.serverUrl, Boolean(cfg.token));
  }
  if (cfg.token !== undefined) {
    if (cfg.token) {
      setSecret('sonar', 'default', cfg.token).catch((e) => console.warn('Failed to save Sonar token to keyring:', e));
    } else {
      deleteSecret('sonar', 'default').catch(() => {});
    }
  }
  try {
    const existing = getSavedSonarConfig();
    const merged = { ...existing, ...cfg, token: '' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.error('Failed to save SonarQube config:', e);
  }
};

export const getSonarTokenAsync = async (connectionId: string = 'default'): Promise<string> => {
  const token = await getSecret('sonar', connectionId);
  return token || '';
};

/**
 * Executes an HTTP request via Tauri IPC (ide-http) to bypass browser CORS restrictions.
 * Falls back to standard browser fetch if running outside Tauri.
 */
async function executeHttpRequest(
  method: string,
  url: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: string }> {
  try {
    const res = await invoke<{ status: number; body: string }>('http_execute_request', {
      request: {
        method,
        url,
        headers,
        body: null,
      },
    });
    return res;
  } catch {
    // Fallback to fetch
    const response = await fetch(url, {
      method,
      headers,
    });
    const body = await response.text();
    return { status: response.status, body };
  }
}

/**
 * Checks if the SonarQube server is reachable and online
 */
export async function checkSonarServer(serverUrl: string): Promise<SonarServerStatus> {
  const url = `${serverUrl.replace(/\/+$/, '')}/api/system/status`;
  const res = await executeHttpRequest('GET', url);
  if (res.status >= 200 && res.status < 300) {
    return JSON.parse(res.body);
  }
  throw new Error(`Server returned HTTP ${res.status}: ${res.body}`);
}

/**
 * Fetches the project quality gate status
 */
export async function fetchSonarQualityGate(
  serverUrl: string,
  projectKey: string,
  token?: string
): Promise<SonarQualityGateStatus> {
  validateSonarUrl(serverUrl, Boolean(token));
  const url = `${serverUrl.replace(/\/+$/, '')}/api/qualitygates/project_status?projectKey=${encodeURIComponent(projectKey)}`;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Basic ${btoa(token + ':')}`;
  }
  const res = await executeHttpRequest('GET', url, headers);
  if (res.status === 200) {
    const json = JSON.parse(res.body);
    return json.projectStatus;
  } else if (res.status === 401) {
    throw new Error('SonarQube authentication failed (HTTP 401). Please provide a valid User Token.');
  } else if (res.status === 404) {
    throw new Error(`Project "${projectKey}" was not found on SonarQube server.`);
  }
  throw new Error(`Failed to fetch Quality Gate (HTTP ${res.status}): ${res.body}`);
}

/**
 * Fetches unresolved issues for the project
 */
export async function fetchSonarIssues(
  serverUrl: string,
  projectKey: string,
  token?: string
): Promise<SonarRemoteIssue[]> {
  validateSonarUrl(serverUrl, Boolean(token));
  const url = `${serverUrl.replace(/\/+$/, '')}/api/issues/search?componentKeys=${encodeURIComponent(projectKey)}&resolved=false&ps=100`;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Basic ${btoa(token + ':')}`;
  }
  const res = await executeHttpRequest('GET', url, headers);
  if (res.status === 200) {
    const json = JSON.parse(res.body);
    return json.issues || [];
  } else if (res.status === 401) {
    throw new Error('SonarQube authentication failed (HTTP 401). Please provide a valid User Token.');
  }
  throw new Error(`Failed to fetch issues (HTTP ${res.status}): ${res.body}`);
}

/**
 * Searches for projects on the SonarQube server
 */
export async function searchSonarProjects(
  serverUrl: string,
  token?: string,
  query?: string
): Promise<Array<{ key: string; name: string }>> {
  validateSonarUrl(serverUrl, Boolean(token));
  const q = query ? `&q=${encodeURIComponent(query)}` : '';
  const url = `${serverUrl.replace(/\/+$/, '')}/api/components/search?qualifiers=TRK${q}&ps=50`;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Basic ${btoa(token + ':')}`;
  }
  try {
    const res = await executeHttpRequest('GET', url, headers);
    if (res.status === 200) {
      const json = JSON.parse(res.body);
      return (json.components || []).map((c: any) => ({ key: c.key, name: c.name || c.key }));
    }
  } catch (e) {
    console.warn('Failed to search SonarQube projects:', e);
  }
  return [];
}

/**
 * Builds the display-safe Maven CLI command to run SonarScanner (without exposing secrets).
 * The authentication token is passed via the SONAR_TOKEN environment variable.
 */
export function buildMavenSonarCommand(config: SonarServerConfig): string {
  return `mvn.cmd sonar:sonar -Dsonar.host.url=${config.serverUrl} -Dsonar.projectKey=${config.projectKey}`;
}
