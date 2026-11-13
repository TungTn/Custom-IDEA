/**
 * Checks whether a filesystem path is absolute on Windows (drive or UNC) or POSIX.
 */
export function isAbsoluteFsPath(targetPath: string): boolean {
  return (
    targetPath.startsWith('/') ||
    /^[a-zA-Z]:[\\/]/.test(targetPath) ||
    targetPath.startsWith('\\\\')
  );
}

/**
 * Resolves a potentially relative path against a workspace root directory.
 * Returns empty string if neither a workspace root nor an absolute path exists.
 */
export function resolveProjectPath(targetPath: string, projectDir?: string): string {
  const trimmed = targetPath.trim();
  if (!trimmed) return '';
  if (isAbsoluteFsPath(trimmed)) return trimmed;
  if (!projectDir) return '';
  const base = projectDir.replace(/[\\/]+$/, '').replace(/\\/g, '/');
  const rel = trimmed.replace(/\\/g, '/').replace(/^\/+/, '');
  return `${base}/${rel}`;
}
