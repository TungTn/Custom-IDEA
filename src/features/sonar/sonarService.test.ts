import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getSonarConnectedModePath, 
  exportSonarConnectedMode, 
  readSonarConnectedMode, 
  syncSonarBindingFromConnectedMode,
  SonarProjectBinding,
  SonarConnection,
  SONARLINT_CONNECTED_MODE_SCHEMA
} from './sonarService';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('sonarService - Connected Mode (.sonarlint/connectedMode.json)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (window as any).__TAURI__ = {};
  });

  describe('getSonarConnectedModePath', () => {
    it('returns .sonarlint/connectedMode.json for POSIX directory path', () => {
      expect(getSonarConnectedModePath('/home/user/project')).toBe('/home/user/project/.sonarlint/connectedMode.json');
      expect(getSonarConnectedModePath('/home/user/project/')).toBe('/home/user/project/.sonarlint/connectedMode.json');
    });

    it('returns .sonarlint/connectedMode.json for Windows directory path', () => {
      expect(getSonarConnectedModePath('D:\\mic-be\\mic-vehicles')).toBe('D:\\mic-be\\mic-vehicles/.sonarlint/connectedMode.json');
      expect(getSonarConnectedModePath('D:/IDE/')).toBe('D:/IDE/.sonarlint/connectedMode.json');
    });
  });

  describe('exportSonarConnectedMode', () => {
    it('throws error when project directory is empty', async () => {
      const binding: SonarProjectBinding = {
        bindEnabled: true,
        connectionId: 'conn-1',
        projectKey: 'mic-vehicles',
      };
      await expect(exportSonarConnectedMode('', binding)).rejects.toThrow('Project directory is required');
    });

    it('generates standard SonarQube connectedMode.json and calls save_file_content', async () => {
      const binding: SonarProjectBinding = {
        bindEnabled: true,
        connectionId: 'conn-1',
        projectKey: 'mic-vehicles',
      };
      const connection: SonarConnection = {
        id: 'conn-1',
        name: 'Sonar Enterprise',
        serverUrl: 'https://sonar-dev-bpm.mic.vn/',
        token: '',
      };

      (invoke as any).mockResolvedValueOnce(undefined);

      const res = await exportSonarConnectedMode('D:/mic-be/mic-vehicles', binding, connection);
      expect(res.filePath).toBe('D:/mic-be/mic-vehicles/.sonarlint/connectedMode.json');

      const parsed = JSON.parse(res.content);
      expect(parsed.$schema).toBe(SONARLINT_CONNECTED_MODE_SCHEMA);
      expect(parsed.sonarQubeUri).toBe('https://sonar-dev-bpm.mic.vn');
      expect(parsed.projectKey).toBe('mic-vehicles');
      expect(parsed.connectionId).toBe('Sonar Enterprise');

      expect(invoke).toHaveBeenCalledWith('save_file_content', {
        path: 'D:/mic-be/mic-vehicles/.sonarlint/connectedMode.json',
        content: res.content,
      });
    });

    it('handles SonarCloud organization binding format', async () => {
      const binding: SonarProjectBinding = {
        bindEnabled: true,
        connectionId: 'conn-cloud',
        projectKey: 'cloud-proj',
      };
      const connection: SonarConnection = {
        id: 'conn-cloud',
        name: 'my-org',
        serverUrl: 'https://sonarcloud.io',
        token: '',
      };

      (invoke as any).mockResolvedValueOnce(undefined);

      const res = await exportSonarConnectedMode('D:/IDE', binding, connection);
      const parsed = JSON.parse(res.content);
      expect(parsed.sonarCloudOrganization).toBe('my-org');
      expect(parsed.projectKey).toBe('cloud-proj');
    });
  });

  describe('readSonarConnectedMode', () => {
    it('returns null if file does not exist', async () => {
      (invoke as any).mockResolvedValueOnce(false); // file_exists

      const res = await readSonarConnectedMode('D:/IDE');
      expect(res).toBeNull();
    });

    it('reads and parses connectedMode.json when present', async () => {
      (invoke as any).mockImplementation((cmd: string) => {
        if (cmd === 'file_exists') return Promise.resolve(true);
        if (cmd === 'read_file_content') {
          return Promise.resolve(JSON.stringify({
            sonarQubeUri: 'https://sonar-dev-bpm.mic.vn',
            projectKey: 'mic-vehicles',
            connectionId: 'Sonar',
          }));
        }
        return Promise.resolve(null);
      });

      const res = await readSonarConnectedMode('D:/mic-be/mic-vehicles');
      expect(res).not.toBeNull();
      expect(res?.projectKey).toBe('mic-vehicles');
      expect(res?.sonarQubeUri).toBe('https://sonar-dev-bpm.mic.vn');
      expect(res?.connectionId).toBe('Sonar');
    });
  });

  describe('syncSonarBindingFromConnectedMode', () => {
    it('syncs binding into localStorage if file exists', async () => {
      (invoke as any).mockImplementation((cmd: string) => {
        if (cmd === 'file_exists') return Promise.resolve(true);
        if (cmd === 'read_file_content') {
          return Promise.resolve(JSON.stringify({
            sonarQubeUri: 'https://sonar-dev-bpm.mic.vn',
            projectKey: 'ins-vehicles-prod',
            connectionId: 'Sonar Prod',
          }));
        }
        return Promise.resolve(null);
      });

      const binding = await syncSonarBindingFromConnectedMode('D:/mic-be/mic-vehicles');
      expect(binding).not.toBeNull();
      expect(binding?.bindEnabled).toBe(true);
      expect(binding?.projectKey).toBe('ins-vehicles-prod');

      const savedRaw = localStorage.getItem('intellij_sonarqube_binding');
      expect(savedRaw).not.toBeNull();
      const saved = JSON.parse(savedRaw!);
      expect(saved.projectKey).toBe('ins-vehicles-prod');
    });
  });
});
