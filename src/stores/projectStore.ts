import { create } from 'zustand';
import { FileNode } from '../types';
import { RecentProjectItem } from '../workbench/TopBar';

const getInitialProjectPath = (): string => {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const allPaths = params.getAll('openPath');
      if (allPaths.length > 0 && allPaths[allPaths.length - 1]) {
        return allPaths[allPaths.length - 1];
      }
      const savedPath = localStorage.getItem('ij_current_project_path');
      if (savedPath) return savedPath;
    }
  } catch (e) {}
  return '';
};

const getInitialRecentProjects = (): RecentProjectItem[] => {
  try {
    const saved = localStorage.getItem('ij_recent_projects') || localStorage.getItem('intellij_recent_projects');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [];
};

export interface ProjectState {
  files: FileNode[];
  projectRootPath: string;
  projectName: string;
  recentProjects: RecentProjectItem[];
  isIndexing: boolean;
  fileEncoding: string;
  lineEnding: 'CRLF' | 'LF';
  isReadOnly: boolean;

  setFiles: (files: FileNode[] | ((prev: FileNode[]) => FileNode[])) => void;
  setProjectRootPath: (path: string) => void;
  setProjectName: (name: string) => void;
  setRecentProjects: (projects: RecentProjectItem[] | ((prev: RecentProjectItem[]) => RecentProjectItem[])) => void;
  addRecentProject: (project: RecentProjectItem) => void;
  setIsIndexing: (indexing: boolean) => void;
  setFileEncoding: (encoding: string) => void;
  setLineEnding: (ending: 'CRLF' | 'LF') => void;
  setIsReadOnly: (readOnly: boolean | ((prev: boolean) => boolean)) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  files: [],
  projectRootPath: getInitialProjectPath(),
  projectName: '',
  recentProjects: getInitialRecentProjects(),
  isIndexing: false,
  fileEncoding: 'UTF-8',
  lineEnding: 'CRLF',
  isReadOnly: false,

  setFiles: (filesOrUpdater) =>
    set((state) => ({
      files: typeof filesOrUpdater === 'function' ? filesOrUpdater(state.files) : filesOrUpdater,
    })),

  setProjectRootPath: (path) => {
    localStorage.setItem('ij_current_project_path', path);
    set({ projectRootPath: path });
  },

  setProjectName: (name) => set({ projectName: name }),

  setRecentProjects: (projectsOrUpdater) =>
    set((state) => {
      const next = typeof projectsOrUpdater === 'function' ? projectsOrUpdater(state.recentProjects) : projectsOrUpdater;
      try {
        localStorage.setItem('ij_recent_projects', JSON.stringify(next));
        localStorage.setItem('intellij_recent_projects', JSON.stringify(next));
      } catch (e) {}
      return { recentProjects: next };
    }),

  addRecentProject: (project) =>
    set((state) => {
      const filtered = state.recentProjects.filter((p) => p.path !== project.path);
      const next = [project, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('ij_recent_projects', JSON.stringify(next));
        localStorage.setItem('intellij_recent_projects', JSON.stringify(next));
      } catch (e) {}
      return { recentProjects: next };
    }),

  setIsIndexing: (indexing) => set({ isIndexing: indexing }),
  setFileEncoding: (encoding) => set({ fileEncoding: encoding }),
  setLineEnding: (ending) => set({ lineEnding: ending }),
  setIsReadOnly: (readOnlyOrUpdater) =>
    set((state) => ({
      isReadOnly:
        typeof readOnlyOrUpdater === 'function'
          ? readOnlyOrUpdater(state.isReadOnly)
          : readOnlyOrUpdater,
    })),
}));
