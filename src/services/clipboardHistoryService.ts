export interface ClipboardEntry {
  id: string;
  text: string;
  timestamp: string;
  displayTime: string;
  preview: string;
  lineCount: number;
  charCount: number;
}

const STORAGE_KEY = 'intellij_clipboard_history';
const MAX_ENTRIES = 30;

function formatDisplayTime(date: Date): string {
  const now = new Date();
  const isToday = now.toDateString() === date.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) {
    return timeStr;
  }
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dateStr} ${timeStr}`;
}

export class ClipboardHistoryService {
  private entries: ClipboardEntry[] = [];
  private listeners: Array<(entries: ClipboardEntry[]) => void> = [];

  constructor() {
    this.loadHistory();
    this.initGlobalCopyListener();
  }

  private loadHistory() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.entries = JSON.parse(saved);
      }
    } catch {
      this.entries = [];
    }
  }

  private saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries.slice(0, MAX_ENTRIES)));
    } catch {}
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => cb([...this.entries]));
  }

  public subscribe(cb: (entries: ClipboardEntry[]) => void): () => void {
    this.listeners.push(cb);
    cb([...this.entries]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private initGlobalCopyListener() {
    if (typeof window === 'undefined') return;

    const handleCopyOrCut = () => {
      setTimeout(async () => {
        try {
          const text = await navigator.clipboard?.readText();
          if (text && text.trim()) {
            this.addEntry(text);
          }
        } catch {}
      }, 50);
    };

    window.addEventListener('copy', handleCopyOrCut);
    window.addEventListener('cut', handleCopyOrCut);
  }

  public addEntry(text: string): ClipboardEntry | null {
    if (!text || !text.trim()) return null;

    // Avoid consecutive duplicate
    if (this.entries.length > 0 && this.entries[0].text === text) {
      return this.entries[0];
    }

    const now = new Date();
    const lines = text.split('\n');
    const firstLine = lines.find((l) => l.trim().length > 0) || lines[0] || '';
    const preview = firstLine.trim().slice(0, 80);

    // Remove if already exists elsewhere in list so it jumps to top
    this.entries = this.entries.filter((e) => e.text !== text);

    const newEntry: ClipboardEntry = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text,
      timestamp: now.toISOString(),
      displayTime: formatDisplayTime(now),
      preview: preview || '(empty lines)',
      lineCount: lines.length,
      charCount: text.length,
    };

    this.entries.unshift(newEntry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES);
    }

    this.saveHistory();
    return newEntry;
  }

  public getEntries(): ClipboardEntry[] {
    return [...this.entries];
  }

  public removeEntry(id: string): void {
    this.entries = this.entries.filter((e) => e.id !== id);
    this.saveHistory();
  }

  public clearHistory(): void {
    this.entries = [];
    this.saveHistory();
  }
}

export const clipboardHistoryService = new ClipboardHistoryService();
