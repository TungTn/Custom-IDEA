export type TestCaseStatus = 'passed' | 'failed' | 'running' | 'ignored' | 'queued';

export interface TestCaseItem {
  id: string;
  name: string;
  suite: string;
  status: TestCaseStatus;
  durationMs: number;
  filePath: string;
  lineNumber: number;
  errorDetails?: string;
  expected?: string;
  actual?: string;
  stackTrace?: string;
  output?: string;
}

export interface TestSuiteItem {
  id: string;
  name: string;
  status: TestCaseStatus;
  durationMs: number;
  filePath?: string;
  tests: TestCaseItem[];
}

export interface TestRunSession {
  id: string;
  configName: string;
  toolchainType: 'cargo' | 'npm' | 'pytest' | 'maven' | 'gradle' | 'custom';
  startedAt: string;
  durationMs: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  ignoredTests: number;
  suites: TestSuiteItem[];
  rawOutput: string;
  isRunning: boolean;
}

export interface ProjectToolchainInfo {
  type: 'rust' | 'node' | 'java' | 'python' | 'docker';
  name: string;
  version?: string;
  path?: string;
  detected: boolean;
  buildFiles: string[];
  statusMessage?: string;
}

export const EMPTY_TEST_SESSION: TestRunSession = {
  id: '',
  configName: '',
  toolchainType: 'cargo',
  startedAt: '',
  durationMs: 0,
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  ignoredTests: 0,
  suites: [],
  rawOutput: '',
  isRunning: false,
};
