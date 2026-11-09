/**
 * Types & Data Schema for Auto Update System (MIC Studio Standard)
 */

export interface VersionMetadata {
  version: string;
  releaseDate: string;
  notes: string;
  sha256: string;
  downloadUrl: string;
  size?: number;
  forceUpdate?: boolean;
  requireSetup?: boolean;
  setupUrl?: string;
  setupSha256?: string;
  setupSize?: number;
}

export interface UpdateProgress {
  percent: number;
  receivedBytes: number;
  totalBytes: number;
  speedBytesPerSec?: number;
}

export interface AppVersionInfo {
  version: string;
  buildCommit?: string;
  buildDate?: string;
  target?: string;
  isPortable?: boolean;
  exePath?: string;
}

export type UpdateCheckStatus = 
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'available'
  | 'downloading'
  | 'readyRestart'
  | 'error';
