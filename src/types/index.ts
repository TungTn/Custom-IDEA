export interface FileNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileNode[];
  content?: string;
  language?: string;
}

export interface OpenTab {
  id: string;
  title: string;
  path: string;
  content: string;
  language: string;
  isDirty?: boolean;
  isPinned?: boolean;
  tabType?: 'code' | 'db-table' | 'sql-console' | 'diff';
  diffData?: {
    filePath: string;
    baseContent: string;
    localContent: string;
    baseHash?: string;
    baseTitle?: string;
    localTitle?: string;
  };
  dbMetadata?: {
    dataSourceId: string;
    schema?: string;
    tableName?: string;
    query?: string;
  };
}

export interface RunLog {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'cmd';
  timestamp: string;
}

export type RunConfigType = 'spring-boot' | 'maven' | 'gradle' | 'cargo' | 'npm' | 'python' | 'custom';

export interface RunConfiguration {
  id: string;
  name: string;
  type: RunConfigType;
  command: string;
  args: string[];
  workingDirectory?: string;
  envVars?: Record<string, string>;
  isDefault?: boolean;
}

export interface ActionItem {
  id: string;
  title: string;
  shortcut?: string;
  category: 'Classes' | 'Files' | 'Symbols' | 'Actions' | 'Text';
  icon?: string;
  filePath?: string;
  lineNumber?: number;
  columnNumber?: number;
  snippet?: string;
}

export interface UsageOccurrence {
  id: string;
  fileId: string;
  fileName: string;
  filePath: string;
  relativePath?: string;
  lineNumber: number;
  columnNumber: number;
  lineContent: string;
  matchText: string;
  matchStart: number;
  matchEnd: number;
  usageType: 'import' | 'declaration' | 'usage';
  declarationKind?: string;
  enclosingScope?: string;
}

export interface FindUsagesResult {
  symbol: string;
  occurrences: UsageOccurrence[];
}

export interface Breakpoint {
  id: string;
  filePath: string;
  fileName: string;
  lineNumber: number;
  enabled: boolean;
  condition?: string;
  logMessage?: string;
  hitCount?: number;
}

export type DebugState = 'idle' | 'running' | 'paused' | 'stopped';

export interface StackFrame {
  id: string;
  name: string;
  file: string;
  line: number;
  column?: number;
  filePath: string;
  functionName?: string;
  fileName?: string;
  lineNumber?: number;
  isAppCode?: boolean;
}

export interface VariableItem {
  name: string;
  type: string;
  value: string;
  children?: VariableItem[];
}

export interface WatchItem {
  id: string;
  expression: string;
  value?: string;
  type?: string;
  error?: string;
}

export interface ProblemItem {
  id: string;
  filePath: string;
  fileName: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  source?: string;
  code?: string;
  quickFixTitle?: string;
}

export interface GitStashItem {
  id: string;
  index: number;
  hash: string;
  message: string;
  relativeTime: string;
  branch: string;
  files?: Array<{ path: string; status: string }>;
}

export type GitResetMode = 'soft' | 'mixed' | 'hard' | 'keep';

export interface RebaseCommitItem {
  hash: string;
  shortHash: string;
  action: 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop';
  subject: string;
  author: string;
}

// ─── Auto-generated Backend DTOs from ts-rs ───
export * from '../bindings';



