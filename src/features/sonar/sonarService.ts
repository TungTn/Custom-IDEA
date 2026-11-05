import { invoke } from '@tauri-apps/api/core';

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

const STORAGE_KEY = 'intellij_sonarqube_config';

export const getSavedSonarConfig = (): SonarServerConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read SonarQube config:', e);
  }
  return {
    serverUrl: 'https://sonar-dev-bpm.mic.vn',
    projectKey: 'mic-vehicles',
    token: '',
  };
};

export const saveSonarConfig = (cfg: SonarServerConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.error('Failed to save SonarQube config:', e);
  }
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
 * Builds the standard Maven CLI command to run SonarScanner
 */
export function buildMavenSonarCommand(config: SonarServerConfig): string {
  const base = `mvn.cmd sonar:sonar -Dsonar.host.url=${config.serverUrl} -Dsonar.projectKey=${config.projectKey}`;
  if (config.token) {
    return `${base} -Dsonar.login=${config.token}`;
  }
  return base;
}
