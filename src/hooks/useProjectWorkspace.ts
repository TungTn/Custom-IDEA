import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { FileNode, OpenTab } from '../types';
import { detectLanguage } from '../utils/languageDetector';
import { useProjectStore } from '../stores';

export interface UseProjectWorkspaceOptions {
  tabs: OpenTab[];
  setTabs: React.Dispatch<React.SetStateAction<OpenTab[]>>;
  activeTabId: string | null;
  setActiveTabId: (id: string | null) => void;
  reopenProjectsOnStartup: boolean;
  refreshGitStatus: () => void | Promise<void>;
  detectDefaultConfigurations: (tree: FileNode, existing: any[]) => any[];
  setRunConfigurations: React.Dispatch<React.SetStateAction<any[]>>;
  setActiveConfigId: (id: string) => void;
  runConfigurationsLength: number;
  setPendingTargetProject: (tree: FileNode | null) => void;
  setIsOpenProjectPromptOpen: (open: boolean) => void;
  addToast: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export function useProjectWorkspace({
  tabs,
  setTabs,
  activeTabId,
  setActiveTabId,
  reopenProjectsOnStartup,
  refreshGitStatus,
  detectDefaultConfigurations,
  setRunConfigurations,
  setActiveConfigId,
  runConfigurationsLength,
  setPendingTargetProject,
  setIsOpenProjectPromptOpen,
  addToast,
}: UseProjectWorkspaceOptions) {
  const {
    files,
    setFiles,
    projectRootPath,
    setProjectRootPath,
    projectName,
    setProjectName,
    recentProjects,
    setRecentProjects,
    isIndexing,
    setIsIndexing,
  } = useProjectStore();

  const currentProjectDirectory = useMemo(() => {
    if (projectRootPath) return projectRootPath;
    if (files[0]) {
      if (files[0].isFolder) return files[0].path;
      const parts = files[0].path.replace(/\//g, '\\').split('\\');
      parts.pop();
      return parts.join('\\') || 'D:\\IDE';
    }
    return 'D:\\IDE';
  }, [projectRootPath, files]);

  // ─── Recent Projects Management ───
  const saveRecentProject = useCallback((name: string, path: string) => {
    setRecentProjects(prev => {
      const filtered = prev.filter(p => p.path !== path);
      const updated = [{ name, path }, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('ij_recent_projects', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save recent projects:', e);
      }
      return updated;
    });
  }, [setRecentProjects]);

  const handleRemoveRecentProject = useCallback((projectPath: string) => {
    setRecentProjects(prev => {
      const updated = prev.filter(p => p.path !== projectPath);
      try {
        localStorage.setItem('ij_recent_projects', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to update recent projects:', e);
      }
      return updated;
    });
  }, [setRecentProjects]);

  // ─── Load Project into IDE ───
  const loadProjectIntoIde = useCallback(
    (tree: FileNode) => {
      setProjectName(tree.name);
      setFiles([tree]);
      setProjectRootPath(tree.path);
      saveRecentProject(tree.name, tree.path);
      try {
        localStorage.setItem('ij_current_project_path', tree.path);
      } catch (e) {
        console.warn('Failed to save current project path:', e);
      }

      setRunConfigurations(prev => {
        const detected = detectDefaultConfigurations(tree, prev);
        const defaultCfg = detected.find(c => c.workingDirectory === tree.path && c.isDefault) || detected[0];
        if (defaultCfg) {
          setActiveConfigId(defaultCfg.id);
          try {
            localStorage.setItem('intellij_active_run_config_id', defaultCfg.id);
          } catch (e) {}
        }
        return detected;
      });

      // Recursively find first openable file
      const findFirstFile = (node: FileNode): FileNode | null => {
        if (!node.isFolder && node.content !== undefined) return node;
        if (node.children) {
          for (const child of node.children) {
            const f = findFirstFile(child);
            if (f) return f;
          }
        }
        return null;
      };

      const first = findFirstFile(tree);
      if (first) {
        setTabs([
          {
            id: first.id,
            title: first.name,
            path: first.path,
            content: first.content || '',
            language: first.language && first.language !== 'plaintext' ? first.language : detectLanguage(first.name),
            isDirty: false,
          },
        ]);
        setActiveTabId(first.id);
      } else {
        setTabs([]);
        setActiveTabId(null);
      }

      addToast('Project Opened', `Loaded project [${tree.name}] from ${tree.path}`, 'success');
    },
    [setProjectName, setFiles, setProjectRootPath, saveRecentProject, setRunConfigurations, detectDefaultConfigurations, setActiveConfigId, setTabs, setActiveTabId, addToast]
  );

  // Auto-detect default run configurations on initial file load
  useEffect(() => {
    if (files[0] && runConfigurationsLength === 0) {
      setRunConfigurations(prev => {
        const detected = detectDefaultConfigurations(files[0], prev);
        if (detected.length > 0) {
          const defaultCfg = detected.find(c => c.isDefault) || detected[0];
          setActiveConfigId(defaultCfg.id);
          try {
            localStorage.setItem('intellij_active_run_config_id', defaultCfg.id);
          } catch (e) {}
        }
        return detected;
      });
    }
  }, [files, detectDefaultConfigurations, runConfigurationsLength, setRunConfigurations, setActiveConfigId]);

  // ─── Project Window Operations ───
  const handleOpenNewWindow = useCallback(
    async (tree: FileNode) => {
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          await invoke('open_in_new_window', {
            projectName: tree.name,
            projectPath: tree.path,
          });
        }
        saveRecentProject(tree.name, tree.path);
        addToast('New Window Opened', `Launched new IntelliJ window for [${tree.name}]`, 'success');
      } catch (err) {
        console.error('Failed to open new window:', err);
        addToast('Open Failed', String(err), 'error');
      }
    },
    [saveRecentProject, addToast]
  );

  const handleAttachProject = useCallback(
    (tree: FileNode) => {
      setFiles(prev => [...prev, tree]);
      saveRecentProject(tree.name, tree.path);
      addToast('Project Attached', `Attached [${tree.name}] to current workspace`, 'success');
    },
    [setFiles, saveRecentProject, addToast]
  );

  const requestOpenProject = useCallback(
    (tree: FileNode) => {
      if (files.length > 0 && projectName !== 'Welcome') {
        const savedMode = localStorage.getItem('ij_project_open_mode');
        if (savedMode === 'this_window') {
          loadProjectIntoIde(tree);
        } else if (savedMode === 'new_window') {
          handleOpenNewWindow(tree);
        } else {
          setPendingTargetProject(tree);
          setIsOpenProjectPromptOpen(true);
        }
      } else {
        loadProjectIntoIde(tree);
      }
    },
    [files.length, projectName, loadProjectIntoIde, handleOpenNewWindow, setPendingTargetProject, setIsOpenProjectPromptOpen]
  );

  const handleOpenProject = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const result = await invoke<FileNode | null>('open_project_dialog', { defaultPath: null });
        if (result) {
          requestOpenProject(result);
        }
      } else {
        addToast('Open Project', 'Select a file or project folder from disk', 'info');
      }
    } catch (err) {
      console.error('Failed to open project:', err);
      addToast('Open Failed', String(err), 'error');
    }
  }, [requestOpenProject, addToast]);

  const handleOpenProjectPath = useCallback(
    async (projectPath: string) => {
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          const result = await invoke<FileNode>('open_project_by_path', { projectPath });
          if (result) {
            requestOpenProject(result);
          }
        } else {
          addToast('Open Project', `Opening ${projectPath}`, 'info');
        }
      } catch (err) {
        console.error('Failed to open project by path:', err);
        addToast('Open Failed', String(err), 'error');
      }
    },
    [requestOpenProject, addToast]
  );

  // Automatically open project if opened via new window initial project or query parameter
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;

    const resolveAndLoadProject = async () => {
      let targetPath: string | null = null;
      if (isTauri) {
        try {
          targetPath = await invoke<string | null>('get_window_initial_project');
        } catch (e) {
          console.warn('Failed to get initial project for window:', e);
        }
      }

      if (!targetPath) {
        const params = new URLSearchParams(window.location.search);
        const allPaths = params.getAll('openPath');
        if (allPaths.length > 0) {
          targetPath = allPaths[allPaths.length - 1];
        }
      }

      // Check if user has reopenProjectsOnStartup enabled and has a previously open project
      if (!targetPath && reopenProjectsOnStartup) {
        try {
          const savedPath = localStorage.getItem('ij_current_project_path');
          if (savedPath) {
            targetPath = savedPath;
          }
        } catch (e) {
          console.warn('Failed to read last project path:', e);
        }
      }

      if (targetPath && isTauri) {
        setProjectRootPath(targetPath);
        try {
          const tree = await invoke<FileNode>('open_project_by_path', { projectPath: targetPath });
          if (tree) {
            loadProjectIntoIde(tree);
          }
        } catch (err) {
          console.error('Failed to auto-load project in new window:', err);
          addToast('Open Failed', `Failed to load project at ${targetPath}`, 'error');
        }
      }
    };

    resolveAndLoadProject();
  }, [loadProjectIntoIde, addToast, reopenProjectsOnStartup, setProjectRootPath]);

  // ─── File System Watcher & Live Disk Synchronization ───
  const isSyncingRef = useRef(false);
  const lastWatchedPathRef = useRef<string | null>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const refreshGitStatusRef = useRef(refreshGitStatus);
  refreshGitStatusRef.current = refreshGitStatus;

  const syncProjectFilesFromDisk = useCallback(
    async (changedPaths?: string[]) => {
      if (isSyncingRef.current) return;
      const rootPath = projectRootPath;
      if (!rootPath) return;
      try {
        isSyncingRef.current = true;
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          setIsIndexing(true);
          const updatedTree = await invoke<FileNode>('open_project_by_path', { projectPath: rootPath });
          if (updatedTree) {
            setFiles([updatedTree]);
          }

          // Check if any open unmodified tab was modified on disk
          if (changedPaths && changedPaths.length > 0) {
            for (const p of changedPaths) {
              const normalizedP = p.replace(/\\/g, '/').toLowerCase();
              const matchingTab = tabsRef.current.find(
                t =>
                  t.path &&
                  (t.path.replace(/\\/g, '/').toLowerCase() === normalizedP ||
                    normalizedP.endsWith(t.path.replace(/\\/g, '/').toLowerCase()))
              );
              if (matchingTab && !matchingTab.isDirty) {
                try {
                  const newContent = await invoke<string>('read_file_content', { path: matchingTab.path });
                  if (newContent !== undefined) {
                    setTabs(prev => prev.map(t => (t.id === matchingTab.id ? { ...t, content: newContent } : t)));
                  }
                } catch (e) {
                  // file may be deleted or locked
                }
              }
            }
          }

          refreshGitStatusRef.current();
          setTimeout(() => setIsIndexing(false), 300);
        }
      } catch (err) {
        setIsIndexing(false);
        console.warn('Failed to sync files from disk:', err);
      } finally {
        isSyncingRef.current = false;
      }
    },
    [projectRootPath, setTabs, setFiles, setIsIndexing]
  );

  // Start file watcher ONLY when root project path changes
  useEffect(() => {
    if (!projectRootPath) return;
    if (lastWatchedPathRef.current === projectRootPath) return;
    lastWatchedPathRef.current = projectRootPath;

    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      invoke('watch_project_directory', { projectPath: projectRootPath }).catch(err => {
        console.warn('Failed to start file watcher:', err);
      });
    }
  }, [projectRootPath]);

  // Listen to live fs-event from Tauri
  useEffect(() => {
    let unlistenVfs: (() => void) | undefined;
    let debounceTimer: any = null;

    const setupFsListener = async () => {
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          unlistenVfs = await listen<{ kind: string; paths: string[]; timestamp: number }>('vfs:change', event => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              syncProjectFilesFromDisk(event.payload.paths);
            }, 100);
          });
        }
      } catch (e) {
        console.warn('Failed to listen to vfs:change:', e);
      }
    };

    setupFsListener();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (unlistenVfs) unlistenVfs();
    };
  }, [syncProjectFilesFromDisk]);

  // ─── Create New Project with Template ───
  const handleCreateNewProject = useCallback(
    async (name: string, cat: string, loc: string, createGit: boolean, addSampleCode: boolean) => {
      setProjectName(name);
      const fullDir = loc ? `${loc}\\${name}` : name;
      setProjectRootPath(fullDir);
      try {
        localStorage.setItem('ij_current_project_path', fullDir);
      } catch (e) {}

      let fileName = 'Main.java';
      let lang = 'java';
      let content = `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World from ${name}!");\n    }\n}\n`;
      let filesToCreate: [string, string][] = [];

      if (cat === 'rust') {
        fileName = 'main.rs';
        lang = 'rust';
        content = `fn main() {\n    println!("Hello, World from ${name}!");\n}\n`;
        filesToCreate = [
          ['src/main.rs', content],
          ['Cargo.toml', `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n`],
          ['.gitignore', '/target\nCargo.lock\n'],
        ];
      } else if (cat === 'python') {
        fileName = 'main.py';
        lang = 'python';
        content = `def main():\n    print("Hello from ${name}!")\n\nif __name__ == "__main__":\n    main()\n`;
        filesToCreate = [
          ['src/main.py', content],
          ['requirements.txt', '# Project dependencies\n'],
          ['.gitignore', '__pycache__/\n*.pyc\n.venv/\n'],
        ];
      } else if (cat === 'react') {
        fileName = 'App.tsx';
        lang = 'typescript';
        content = `import React from 'react';\n\nexport function App() {\n    return <h1>Hello from ${name}</h1>;\n}\n`;
        filesToCreate = [
          ['src/App.tsx', content],
          ['package.json', `{\n  "name": "${name}",\n  "private": true,\n  "version": "0.1.0"\n}\n`],
          ['.gitignore', 'node_modules/\ndist/\n'],
        ];
      } else if (cat === 'node') {
        fileName = 'index.js';
        lang = 'javascript';
        content = `console.log("Hello from ${name}!");\n`;
        filesToCreate = [
          ['src/index.js', content],
          ['package.json', `{\n  "name": "${name}",\n  "version": "1.0.0",\n  "main": "src/index.js"\n}\n`],
        ];
      } else if (cat === 'kotlin') {
        fileName = 'Main.kt';
        lang = 'kotlin';
        content = `fun main() {\n    println("Hello, World from ${name}!")\n}\n`;
        filesToCreate = [['src/Main.kt', content]];
      } else if (cat === 'html') {
        fileName = 'index.html';
        lang = 'html';
        content = `<!DOCTYPE html>\n<html>\n<head>\n  <title>${name}</title>\n</head>\n<body>\n  <h1>Welcome to ${name}</h1>\n</body>\n</html>\n`;
        filesToCreate = [
          ['index.html', content],
          ['style.css', '/* Styles */\nbody { margin: 0; }\n'],
        ];
      } else {
        filesToCreate = [
          ['src/Main.java', content],
          ['.gitignore', '*.class\n*.jar\nout/\n'],
        ];
      }

      if (!addSampleCode) {
        filesToCreate = [['README.md', `# ${name}\n\nProject initialized.`]];
      }

      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          await invoke('create_project_on_disk', {
            projectPath: fullDir,
            filesToCreate,
            initGit: createGit,
          });
        }
      } catch (err) {
        console.error('Failed to create project on disk:', err);
      }

      const newProjectNode: FileNode = {
        id: `proj-${Date.now()}`,
        name,
        path: fullDir,
        isFolder: true,
        children: filesToCreate.map(([relPath, fileContent], idx) => {
          const parts = relPath.split('/');
          return {
            id: `proj-file-${idx}-${Date.now()}`,
            name: parts[parts.length - 1],
            path: `${fullDir}\\${relPath.replace(/\//g, '\\')}`,
            isFolder: false,
            language: lang,
            content: fileContent,
          };
        }),
      };
      saveRecentProject(name, fullDir);
      addToast('Project Created on Disk', `Created project files in ${fullDir}`, 'success');
      requestOpenProject(newProjectNode);
    },
    [setProjectName, setProjectRootPath, saveRecentProject, addToast, requestOpenProject]
  );

  // ─── File Tree CRUD Operations ───
  const handleCreateFile = useCallback(
    async (parentPath?: string, fileName?: string, content?: string) => {
      if (!fileName) return;

      const targetParent = (parentPath || '').replace(/\\/g, '/');
      const fullPath = targetParent ? `${targetParent}/${fileName}` : fileName;
      const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
      const defaultTemplates: Record<string, string> = {
        rs: 'pub fn init() {\n    // Rust template\n}\n',
        ts: 'export const Component = () => {\n    return <div>Component</div>;\n};\n',
        tsx: 'import React from "react";\n\nexport const Component: React.FC = () => {\n    return <div>Component</div>;\n};\n',
        js: '// JavaScript module\nexport function init() {\n    console.log("Initialized");\n}\n',
        jsx: 'import React from "react";\n\nexport function Component() {\n    return <div>Component</div>;\n}\n',
        html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Document</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n',
        css: '/* Stylesheet */\nbody {\n  margin: 0;\n  padding: 0;\n}\n',
        http: '### Sample Request\nGET https://httpbin.org/get\n',
        yaml: 'openapi: 3.0.0\ninfo:\n  title: API Specification\n  version: 1.0.0\n',
        properties: '# Configuration Properties\napp.name=MyApplication\n',
        kts: '// Kotlin Script\nprintln("Hello from Kotlin Script")\n',
        ipynb: '{\n "cells": [],\n "metadata": {},\n "nbformat": 4,\n "nbformat_minor": 2\n}\n',
        editorconfig:
          'root = true\n\n[*]\nindent_style = space\nindent_size = 2\nend_of_line = lf\ncharset = utf-8\ntrim_trailing_whitespace = true\ninsert_final_newline = true\n',
      };
      const fileContent = content !== undefined ? content : defaultTemplates[ext] || `// ${fileName}\n\n`;

      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        try {
          await invoke('vfs_write_file', { path: fullPath, content: fileContent });
        } catch (err) {
          console.warn('VFS write error:', err);
        }
      }

      const language = detectLanguage(fileName);
      const newNode: FileNode = {
        id: fullPath,
        name: fileName,
        path: fullPath,
        isFolder: false,
        language,
        content: fileContent,
      };

      setFiles(prev => {
        if (!targetParent) return [...prev, newNode];
        const insertNode = (list: FileNode[]): FileNode[] => {
          return list.map(item => {
            const itemNorm = item.path.replace(/\\/g, '/');
            if (itemNorm === targetParent && item.isFolder) {
              return { ...item, children: [...(item.children || []), newNode] };
            }
            if (item.children) {
              return { ...item, children: insertNode(item.children) };
            }
            return item;
          });
        };
        return insertNode(prev);
      });

      const newTab: OpenTab = {
        id: fullPath,
        title: fileName,
        path: fullPath,
        content: fileContent,
        language,
        isDirty: false,
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(fullPath);
      addToast('File Created', `Created ${fileName} in ${targetParent || 'project root'}`, 'success');
    },
    [setFiles, setTabs, setActiveTabId, addToast]
  );

  const handleCreateFolder = useCallback(
    async (parentPath?: string, folderName?: string) => {
      if (!folderName) return;

      const targetParent = (parentPath || '').replace(/\\/g, '/');
      const fullPath = targetParent ? `${targetParent}/${folderName}` : folderName;

      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        try {
          await invoke('vfs_create_dir', { path: fullPath });
        } catch (err) {
          console.warn('VFS create dir error:', err);
        }
      }

      const newFolderNode: FileNode = {
        id: fullPath,
        name: folderName,
        path: fullPath,
        isFolder: true,
        children: [],
      };

      setFiles(prev => {
        if (!targetParent) return [...prev, newFolderNode];
        const insertNode = (list: FileNode[]): FileNode[] => {
          return list.map(item => {
            const itemNorm = item.path.replace(/\\/g, '/');
            if (itemNorm === targetParent && item.isFolder) {
              return { ...item, children: [...(item.children || []), newFolderNode] };
            }
            if (item.children) {
              return { ...item, children: insertNode(item.children) };
            }
            return item;
          });
        };
        return insertNode(prev);
      });

      addToast('Directory Created', `Created ${folderName} in ${targetParent || 'project root'}`, 'success');
    },
    [setFiles, addToast]
  );

  const handleDeleteFile = useCallback(
    async (node: FileNode) => {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        try {
          await invoke('vfs_delete_path', { path: node.path });
        } catch (err) {
          console.warn('vfs_delete_path error:', err);
        }
      }
      const removeNode = (list: FileNode[]): FileNode[] => {
        return list
          .filter(n => n.id !== node.id && n.path !== node.path)
          .map(n => (n.children ? { ...n, children: removeNode(n.children) } : n));
      };
      setFiles(prev => removeNode(prev));
      setTabs(prev => prev.filter(t => t.id !== node.id && (!node.path || !t.path.startsWith(node.path))));
      addToast('File Deleted', `Deleted ${node.name} permanently`, 'warning');
    },
    [setFiles, setTabs, addToast]
  );

  const handleRenameFile = useCallback(
    async (node: FileNode, newName?: string) => {
      if (!newName || newName === node.name) return;

      const normSource = node.path.replace(/\\/g, '/');
      const parentPath = normSource.includes('/') ? normSource.replace(/\/[^/]+$/, '') : '';
      const destPath = parentPath ? `${parentPath}/${newName}` : newName;

      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        try {
          await invoke('vfs_move_path', { sourcePath: node.path, destPath });
        } catch (err) {
          console.warn('VFS rename error:', err);
        }
      }

      const renameInTree = (list: FileNode[]): FileNode[] => {
        return list.map(item => {
          if (item.id === node.id || item.path === node.path) {
            const updateChildPaths = (children?: FileNode[]): FileNode[] | undefined => {
              if (!children) return undefined;
              return children.map(c => {
                const childNorm = c.path.replace(/\\/g, '/');
                const newChildPath = childNorm.startsWith(normSource + '/')
                  ? destPath + childNorm.slice(normSource.length)
                  : c.path;
                return {
                  ...c,
                  path: newChildPath,
                  id: newChildPath,
                  children: updateChildPaths(c.children),
                };
              });
            };
            return {
              ...item,
              name: newName,
              id: destPath,
              path: destPath,
              children: updateChildPaths(item.children),
            };
          }
          if (item.children) {
            return { ...item, children: renameInTree(item.children) };
          }
          return item;
        });
      };

      setFiles(prev => renameInTree(prev));

      setTabs(prev =>
        prev.map(t => {
          const tabNorm = t.path.replace(/\\/g, '/');
          if (tabNorm === normSource) {
            return { ...t, id: destPath, path: destPath, title: newName };
          }
          if (tabNorm.startsWith(normSource + '/')) {
            const newChildPath = destPath + tabNorm.slice(normSource.length);
            return { ...t, id: newChildPath, path: newChildPath };
          }
          return t;
        })
      );

      if (activeTabId === node.id || activeTabId === node.path) {
        setActiveTabId(destPath);
      }
      addToast('File Renamed', `Renamed ${node.name} to ${newName}`, 'success');
    },
    [setFiles, activeTabId, setActiveTabId, setTabs, addToast]
  );

  return {
    projectName,
    setProjectName,
    projectRootPath,
    setProjectRootPath,
    files,
    setFiles,
    recentProjects,
    setRecentProjects,
    currentProjectDirectory,
    saveRecentProject,
    handleRemoveRecentProject,
    loadProjectIntoIde,
    handleOpenNewWindow,
    handleAttachProject,
    requestOpenProject,
    handleOpenProject,
    handleOpenProjectPath,
    isIndexing,
    syncProjectFilesFromDisk,
    handleCreateNewProject,
    handleCreateFile,
    handleCreateFolder,
    handleDeleteFile,
    handleRenameFile,
  };
}
