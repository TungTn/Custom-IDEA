import { invoke } from '@tauri-apps/api/core';

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

export function dirname(p: string): string {
  const norm = normalizePath(p);
  const idx = norm.lastIndexOf('/');
  if (idx === -1) return '.';
  return norm.substring(0, idx);
}

export function resolveRelativePath(baseDir: string, relativePath: string): string {
  const normBase = normalizePath(baseDir).replace(/\/+$/, '');
  const normRel = normalizePath(relativePath).replace(/^\/+/, '');
  const parts = (normBase + '/' + normRel).split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      if (stack.length > 0 && stack[stack.length - 1] !== '..') {
        stack.pop();
      } else {
        stack.push('..');
      }
    } else {
      stack.push(part);
    }
  }
  let result = stack.join('/');
  if (/^[a-zA-Z]:/.test(normBase) && !/^[a-zA-Z]:/.test(result)) {
    result = normBase.substring(0, 2) + '/' + result;
  }
  return result;
}

export function extractStringLiteralAtPos(
  lineText: string,
  col: number
): { text: string; from: number; to: number } | null {
  const regex = /("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(lineText)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    if (col >= start && col <= end) {
      const raw = match[0];
      const unquoted = raw.slice(1, -1);
      return {
        text: unquoted,
        from: start,
        to: end,
      };
    }
  }
  return null;
}

export const KNOWN_EXTENSIONS = [
  '.vue',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.css',
  '.scss',
  '.less',
  '.svg',
  '.html',
  '.md',
  '.rs',
  '.py',
  '.java',
  '.go',
  '.cpp',
  '.c',
  '.h',
  '.sql',
  '.yaml',
  '.yml',
];

export function hasKnownExtension(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return KNOWN_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isLikelyPathString(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  if (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('//') ||
    s.startsWith('data:') ||
    s.startsWith('blob:')
  ) {
    return false;
  }
  if (
    s.startsWith('./') ||
    s.startsWith('../') ||
    s.startsWith('/') ||
    s.startsWith('@/') ||
    s.startsWith('~/')
  ) {
    return true;
  }
  if (s.includes('/') || s.includes('\\')) {
    return true;
  }
  if (hasKnownExtension(s)) {
    return true;
  }
  return false;
}

export async function checkFileExists(targetPath: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
    return false;
  }
  try {
    const exists = await invoke<boolean>('file_exists', { path: targetPath });
    if (typeof exists === 'boolean') return exists;
  } catch {
    // Fallback: try read_file_content
    try {
      await invoke<string>('read_file_content', { path: targetPath });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

const EXT_CANDIDATES = [
  '', // Exact match
  '.vue',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.scss',
  '.css',
  '.less',
  '/index.vue',
  '/index.ts',
  '/index.tsx',
  '/index.js',
  '/index.jsx',
  '/index.json',
];

export async function resolveImportPath(
  importStr: string,
  currentFilePath: string,
  projectPath?: string
): Promise<string | null> {
  if (!importStr || !isLikelyPathString(importStr)) return null;

  // Strip query/hash (e.g. ?raw or #hash)
  const cleanStr = importStr.split(/[?#]/)[0].trim();
  if (!cleanStr) return null;

  const currentNorm = normalizePath(currentFilePath);
  const currentDir = dirname(currentNorm);

  // Determine src directory
  let srcDir: string | null = null;
  const srcIdx = currentNorm.toLowerCase().lastIndexOf('/src/');
  if (srcIdx !== -1) {
    srcDir = currentNorm.substring(0, srcIdx + 4);
  } else if (projectPath) {
    const projNorm = normalizePath(projectPath);
    srcDir = projNorm + '/src';
  }

  const bases: string[] = [];
  if (cleanStr.startsWith('./') || cleanStr.startsWith('../')) {
    bases.push(resolveRelativePath(currentDir, cleanStr));
  } else if (cleanStr.startsWith('@/') || cleanStr.startsWith('~/')) {
    const rel = cleanStr.replace(/^[@~]\/?/, '');
    if (srcDir) {
      bases.push(resolveRelativePath(srcDir, rel));
    }
    if (projectPath) {
      bases.push(resolveRelativePath(normalizePath(projectPath) + '/src', rel));
      bases.push(resolveRelativePath(normalizePath(projectPath), rel));
    }
  } else if (cleanStr.startsWith('/')) {
    if (projectPath) {
      bases.push(resolveRelativePath(normalizePath(projectPath), cleanStr.substring(1)));
    }
    if (srcDir) {
      bases.push(resolveRelativePath(srcDir, cleanStr.substring(1)));
    }
  } else {
    // Bare relative
    bases.push(resolveRelativePath(currentDir, cleanStr));
    if (srcDir) bases.push(resolveRelativePath(srcDir, cleanStr));
    if (projectPath) bases.push(resolveRelativePath(normalizePath(projectPath), cleanStr));
  }

  for (const base of bases) {
    const baseHasExt = hasKnownExtension(base);
    const extsToTest = baseHasExt ? [''] : EXT_CANDIDATES;

    for (const ext of extsToTest) {
      const candidate = base + ext;
      const exists = await checkFileExists(candidate);
      if (exists) {
        return currentFilePath.includes('\\')
          ? candidate.replace(/\//g, '\\')
          : candidate;
      }
    }
  }

  return null;
}
