import { describe, it, expect } from 'vitest';
import { isAbsoluteFsPath, resolveProjectPath } from './pathUtils';

describe('pathUtils', () => {
  describe('isAbsoluteFsPath', () => {
    it('recognizes POSIX root path', () => {
      expect(isAbsoluteFsPath('/home/user/project')).toBe(true);
      expect(isAbsoluteFsPath('/')).toBe(true);
    });

    it('recognizes Windows drive paths', () => {
      expect(isAbsoluteFsPath('C:\\Users\\adminlocal\\project')).toBe(true);
      expect(isAbsoluteFsPath('d:/IDE/src')).toBe(true);
      expect(isAbsoluteFsPath('Z:\\')).toBe(true);
    });

    it('recognizes Windows UNC paths', () => {
      expect(isAbsoluteFsPath('\\\\server\\share\\file.txt')).toBe(true);
    });

    it('rejects relative paths', () => {
      expect(isAbsoluteFsPath('src/App.tsx')).toBe(false);
      expect(isAbsoluteFsPath('./components/Button.tsx')).toBe(false);
      expect(isAbsoluteFsPath('../parent.txt')).toBe(false);
      expect(isAbsoluteFsPath('file.txt')).toBe(false);
    });
  });

  describe('resolveProjectPath', () => {
    it('returns empty string on empty input', () => {
      expect(resolveProjectPath('')).toBe('');
      expect(resolveProjectPath('   ')).toBe('');
    });

    it('returns absolute targetPath unchanged', () => {
      expect(resolveProjectPath('C:\\project\\file.txt', 'D:\\workspace')).toBe('C:\\project\\file.txt');
      expect(resolveProjectPath('/var/log/app.log', '/home/user')).toBe('/var/log/app.log');
    });

    it('returns empty string when projectDir is missing and path is relative', () => {
      expect(resolveProjectPath('src/index.ts')).toBe('');
      expect(resolveProjectPath('src/index.ts', '')).toBe('');
    });

    it('combines projectDir and relative path cleanly with forward slashes', () => {
      expect(resolveProjectPath('src/index.ts', 'D:\\workspace\\project')).toBe('D:/workspace/project/src/index.ts');
      expect(resolveProjectPath('./src/index.ts', 'D:\\workspace\\project\\')).toBe('D:/workspace/project/src/index.ts');
      expect(resolveProjectPath('src\\nested\\file.rs', '/home/user/project')).toBe('/home/user/project/src/nested/file.rs');
    });
  });
});
