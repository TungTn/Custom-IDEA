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
  lineNumber: number;
  columnNumber: number;
  lineContent: string;
  matchText: string;
  matchStart: number;
  matchEnd: number;
  usageType: 'import' | 'declaration' | 'usage';
}

export interface FindUsagesResult {
  symbol: string;
  occurrences: UsageOccurrence[];
}
