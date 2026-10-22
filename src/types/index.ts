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

export interface ActionItem {
  id: string;
  title: string;
  shortcut?: string;
  category: 'Classes' | 'Files' | 'Symbols' | 'Actions';
  icon?: string;
}
