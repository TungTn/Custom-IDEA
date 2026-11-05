export interface HistoryRevision {
  id: string;
  filePath: string;
  timestamp: string;
  displayTime: string;
  label: string;
  content: string;
  lineCount: number;
}

const STORAGE_PREFIX = 'intellij_local_history_';
const MAX_REVISIONS_PER_FILE = 40;

function formatDisplayTime(date: Date): string {
  const now = new Date();
  const isToday = now.toDateString() === date.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) {
    return `Today ${timeStr}`;
  }
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dateStr} ${timeStr}`;
}

export class LocalHistoryService {
  /**
   * Record a snapshot of a file content
   */
  public recordSnapshot(filePath: string, content: string, label: string = 'Saved'): HistoryRevision | null {
    if (!filePath || content === undefined || content === null) return null;

    const normalizedPath = filePath.replace(/\\/g, '/');
    const key = `${STORAGE_PREFIX}${normalizedPath}`;
    const revisions = this.getRevisions(normalizedPath);

    // Skip duplicate consecutive identical snapshots
    if (revisions.length > 0 && revisions[0].content === content) {
      return revisions[0];
    }

    const now = new Date();
    const newRev: HistoryRevision = {
      id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      filePath: normalizedPath,
      timestamp: now.toISOString(),
      displayTime: formatDisplayTime(now),
      label,
      content,
      lineCount: content.split('\n').length,
    };

    const updated = [newRev, ...revisions].slice(0, MAX_REVISIONS_PER_FILE);
    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      // Storage might be full, trim older revisions
      try {
        const trimmed = updated.slice(0, 15);
        localStorage.setItem(key, JSON.stringify(trimmed));
      } catch {}
    }

    return newRev;
  }

  /**
   * Get all revisions for a given file
   */
  public getRevisions(filePath: string): HistoryRevision[] {
    if (!filePath) return [];
    const normalizedPath = filePath.replace(/\\/g, '/');
    const key = `${STORAGE_PREFIX}${normalizedPath}`;
    try {
      const data = localStorage.getItem(key);
      if (data) {
        return JSON.parse(data);
      }
    } catch {}
    return [];
  }

  /**
   * Add a custom user label to the latest revision (Put Label... action)
   */
  public putLabel(filePath: string, label: string, currentContent?: string): void {
    if (!filePath || !label) return;
    const normalizedPath = filePath.replace(/\\/g, '/');
    const key = `${STORAGE_PREFIX}${normalizedPath}`;
    const revisions = this.getRevisions(normalizedPath);

    if (revisions.length > 0) {
      revisions[0].label = label;
      try {
        localStorage.setItem(key, JSON.stringify(revisions));
      } catch {}
    } else if (currentContent !== undefined) {
      this.recordSnapshot(filePath, currentContent, label);
    }
  }

  /**
   * Compute simple line diff (+added, -removed) between two text versions
   */
  public computeLineDiff(oldText: string, newText: string): { added: number; removed: number } {
    const oldLines = new Set(oldText.split('\n'));
    const newLines = new Set(newText.split('\n'));

    let added = 0;
    let removed = 0;

    for (const line of newLines) {
      if (!oldLines.has(line)) added++;
    }
    for (const line of oldLines) {
      if (!newLines.has(line)) removed++;
    }

    return { added, removed };
  }

  /**
   * Clear history for a specific file
   */
  public clearHistory(filePath: string): void {
    const normalizedPath = filePath.replace(/\\/g, '/');
    localStorage.removeItem(`${STORAGE_PREFIX}${normalizedPath}`);
  }
}

export const localHistoryService = new LocalHistoryService();
