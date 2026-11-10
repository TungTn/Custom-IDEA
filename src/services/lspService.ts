import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface LspPosition {
  line: number;
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface LspDiagnostic {
  range: LspRange;
  severity?: number; // 1 = Error, 2 = Warning, 3 = Information, 4 = Hint
  code?: number | string;
  source?: string;
  message: string;
}

export interface LspPublishDiagnosticsParams {
  uri: string;
  version?: number;
  diagnostics: LspDiagnostic[];
}

export interface LspCompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string | { kind: string; value: string };
  insertText?: string;
  sortText?: string;
}

export interface LspHoverResult {
  contents: string | { kind: string; value: string } | Array<string | { kind: string; value: string }>;
  range?: LspRange;
}

export interface LspTextEdit {
  range: LspRange;
  newText: string;
}

export interface LspWorkspaceEdit {
  changes?: Record<string, LspTextEdit[]>;
  documentChanges?: Array<{
    textDocument: { uri: string; version?: number };
    edits: LspTextEdit[];
  }>;
}

export interface LspCodeAction {
  title: string;
  kind?: string;
  diagnostics?: LspDiagnostic[];
  isPreferred?: boolean;
  edit?: LspWorkspaceEdit;
  command?: {
    title: string;
    command: string;
    arguments?: any[];
  };
}

export interface LspParameterInformation {
  label: string | [number, number];
  documentation?: string | { kind: string; value: string };
}

export interface LspSignatureInformation {
  label: string;
  documentation?: string | { kind: string; value: string };
  parameters?: LspParameterInformation[];
  activeParameter?: number;
}

export interface LspSignatureHelp {
  signatures: LspSignatureInformation[];
  activeSignature?: number;
  activeParameter?: number;
}

export interface LspLocation {
  uri: string;
  range: LspRange;
}

export function pathToUri(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
}

export function uriToPath(uri: string): string {
  let p = uri.replace(/^file:\/\/\/?/, '');
  // On Windows, handle 'D:/...'
  if (/^[a-zA-Z]:/.test(p)) {
    return p.replace(/\//g, '\\');
  }
  return '/' + p;
}

export function getLanguageId(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'rs':
      return 'rust';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'py':
      return 'python';
    case 'go':
      return 'go';
    case 'json':
      return 'json';
    default:
      return 'plaintext';
  }
}

class LspService {
  private activeServers = new Map<string, string>(); // lang -> serverName
  private openedDocs = new Map<string, number>(); // uri -> version
  private diagnosticListeners = new Set<(params: LspPublishDiagnosticsParams) => void>();
  private unlistenEvent: UnlistenFn | null = null;
  private changeTimers = new Map<string, any>();

  constructor() {
    this.initDiagnosticsListener();
  }

  private async initDiagnosticsListener() {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      return;
    }
    try {
      this.unlistenEvent = await listen<LspPublishDiagnosticsParams>('lsp-diagnostics', (event) => {
        for (const listener of this.diagnosticListeners) {
          listener(event.payload);
        }
      });
    } catch (e) {
      console.warn('Failed to listen to lsp-diagnostics event:', e);
    }
  }

  public onDiagnostics(listener: (params: LspPublishDiagnosticsParams) => void): () => void {
    this.diagnosticListeners.add(listener);
    return () => {
      this.diagnosticListeners.delete(listener);
    };
  }

  public async ensureServer(lang: string, projectPath: string): Promise<string | null> {
    const langKey = lang.toLowerCase();
    if (this.activeServers.has(langKey)) {
      return this.activeServers.get(langKey)!;
    }
    try {
      const serverName = await invoke<string>('lsp_start_server', {
        lang: langKey,
        projectPath,
      });
      this.activeServers.set(langKey, serverName);
      return serverName;
    } catch (err) {
      // Server not installed or failed to start
      return null;
    }
  }

  public async openDocument(filePath: string, content: string, projectPath: string): Promise<void> {
    const lang = getLanguageId(filePath);
    if (lang === 'plaintext') return;

    const server = await this.ensureServer(lang, projectPath);
    if (!server) return;

    const uri = pathToUri(filePath);
    this.openedDocs.set(uri, 1);

    try {
      await invoke('lsp_send_notification', {
        lang,
        method: 'textDocument/didOpen',
        params: {
          textDocument: {
            uri,
            languageId: lang,
            version: 1,
            text: content,
          },
        },
      });
    } catch (e) {
      console.warn('LSP didOpen error:', e);
    }
  }

  public notifyChange(filePath: string, newContent: string): void {
    const lang = getLanguageId(filePath);
    if (lang === 'plaintext') return;

    const uri = pathToUri(filePath);
    const prevTimer = this.changeTimers.get(uri);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }

    const timer = setTimeout(async () => {
      this.changeTimers.delete(uri);
      const currentVersion = (this.openedDocs.get(uri) || 1) + 1;
      this.openedDocs.set(uri, currentVersion);

      try {
        await invoke('lsp_send_notification', {
          lang,
          method: 'textDocument/didChange',
          params: {
            textDocument: {
              uri,
              version: currentVersion,
            },
            contentChanges: [
              {
                text: newContent,
              },
            ],
          },
        });
      } catch (e) {
        console.warn('LSP didChange error:', e);
      }
    }, 180);

    this.changeTimers.set(uri, timer);
  }

  public async closeDocument(filePath: string): Promise<void> {
    const lang = getLanguageId(filePath);
    if (lang === 'plaintext') return;

    const uri = pathToUri(filePath);
    const pendingTimer = this.changeTimers.get(uri);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.changeTimers.delete(uri);
    }
    this.openedDocs.delete(uri);

    try {
      await invoke('lsp_send_notification', {
        lang,
        method: 'textDocument/didClose',
        params: {
          textDocument: { uri },
        },
      });
    } catch (e) {
      console.warn('LSP didClose error:', e);
    }
  }

  public async getCompletion(
    filePath: string,
    position: LspPosition
  ): Promise<LspCompletionItem[]> {
    const lang = getLanguageId(filePath);
    if (lang === 'plaintext') return [];

    const uri = pathToUri(filePath);
    try {
      const res = await invoke<any>('lsp_send_request', {
        lang,
        method: 'textDocument/completion',
        params: {
          textDocument: { uri },
          position,
        },
      });

      if (!res) return [];
      if (Array.isArray(res)) return res;
      if (Array.isArray(res.items)) return res.items;
      return [];
    } catch (e) {
      return [];
    }
  }

  public async getHover(
    filePath: string,
    position: LspPosition
  ): Promise<LspHoverResult | null> {
    const lang = getLanguageId(filePath);
    if (lang === 'plaintext') return null;

    const uri = pathToUri(filePath);
    try {
      const res = await invoke<any>('lsp_send_request', {
        lang,
        method: 'textDocument/hover',
        params: {
          textDocument: { uri },
          position,
        },
      });
      return res || null;
    } catch (e) {
      return null;
    }
  }

  public async getSignatureHelp(
    filePath: string,
    position: LspPosition
  ): Promise<LspSignatureHelp | null> {
    const lang = getLanguageId(filePath);
    if (lang === 'plaintext') return null;

    const uri = pathToUri(filePath);
    try {
      const res = await invoke<any>('lsp_send_request', {
        lang,
        method: 'textDocument/signatureHelp',
        params: {
          textDocument: { uri },
          position,
        },
      });
      return res || null;
    } catch (e) {
      return null;
    }
  }

  public async getDefinition(
    filePath: string,
    position: LspPosition
  ): Promise<LspLocation[] | null> {
    const lang = getLanguageId(filePath);
    if (lang === 'plaintext') return null;

    const uri = pathToUri(filePath);
    try {
      const res = await invoke<any>('lsp_send_request', {
        lang,
        method: 'textDocument/definition',
        params: {
          textDocument: { uri },
          position,
        },
      });

      if (!res) return null;
      if (Array.isArray(res)) {
        return res.map((loc) => ({
          uri: loc.uri || loc.targetUri,
          range: loc.range || loc.targetSelectionRange || loc.targetRange,
        }));
      }
      if (res.uri && res.range) {
        return [res];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  public async getCodeActions(
    filePath: string,
    range: LspRange,
    diagnostics: any[] = []
  ): Promise<LspCodeAction[]> {
    const lang = getLanguageId(filePath);
    if (lang === 'plaintext') return [];

    const uri = pathToUri(filePath);
    try {
      const res = await invoke<any>('lsp_send_request', {
        lang,
        method: 'textDocument/codeAction',
        params: {
          textDocument: { uri },
          range,
          context: {
            diagnostics,
            triggerKind: 1, // Invoked
          },
        },
      });

      if (!res || !Array.isArray(res)) return [];
      return res;
    } catch (e) {
      console.warn('LSP textDocument/codeAction error:', e);
      return [];
    }
  }

  public async formatDocument(
    filePath: string,
    options?: { tabSize?: number; insertSpaces?: boolean }
  ): Promise<LspTextEdit[]> {
    const lang = getLanguageId(filePath);
    if (lang === 'plaintext') return [];

    const uri = pathToUri(filePath);
    try {
      const res = await invoke<LspTextEdit[]>('lsp_send_request', {
        lang,
        method: 'textDocument/formatting',
        params: {
          textDocument: { uri },
          options: {
            tabSize: options?.tabSize ?? 2,
            insertSpaces: options?.insertSpaces ?? true,
          },
        },
      });

      if (!res || !Array.isArray(res)) return [];
      return res;
    } catch (e) {
      console.warn('LSP textDocument/formatting error:', e);
      return [];
    }
  }

  public async setServerPath(lang: string, customPath?: string): Promise<void> {
    try {
      await invoke('lsp_set_server_path', {
        lang,
        customPath: customPath || null,
      });
    } catch (e) {
      console.warn('lsp_set_server_path error:', e);
    }
  }

  public async renameSymbol(
    filePath: string,
    position: LspPosition,
    newName: string
  ): Promise<LspWorkspaceEdit | null> {
    const lang = getLanguageId(filePath);
    if (lang === 'plaintext') return null;

    const uri = pathToUri(filePath);
    try {
      const res = await invoke<any>('lsp_send_request', {
        lang,
        method: 'textDocument/rename',
        params: {
          textDocument: { uri },
          position,
          newName,
        },
      });

      return res || null;
    } catch (e) {
      console.warn('LSP textDocument/rename error:', e);
      return null;
    }
  }

  public async applyWorkspaceEdit(
    edit: LspWorkspaceEdit
  ): Promise<{ appliedCount: number; filesChanged: string[] }> {
    const fileEditsMap = new Map<string, LspTextEdit[]>();

    if (edit.changes) {
      for (const [uri, edits] of Object.entries(edit.changes)) {
        const filePath = uriToPath(uri);
        fileEditsMap.set(filePath, edits);
      }
    } else if (edit.documentChanges) {
      for (const docChange of edit.documentChanges) {
        if (docChange.textDocument && docChange.edits) {
          const filePath = uriToPath(docChange.textDocument.uri);
          fileEditsMap.set(filePath, docChange.edits);
        }
      }
    }

    let appliedCount = 0;
    const filesChanged: string[] = [];

    for (const [filePath, edits] of fileEditsMap.entries()) {
      try {
        let content = await invoke<string>('read_file_content', { path: filePath });
        if (content === undefined || content === null) continue;

        // Sort edits in reverse order so applying does not shift earlier line/col offsets
        const sortedEdits = [...edits].sort((a, b) => {
          if (b.range.start.line !== a.range.start.line) {
            return b.range.start.line - a.range.start.line;
          }
          return b.range.start.character - a.range.start.character;
        });

        const lines = content.split('\n');
        for (const te of sortedEdits) {
          const startLine = te.range.start.line;
          const startChar = te.range.start.character;
          const endLine = te.range.end.line;
          const endChar = te.range.end.character;

          if (startLine === endLine) {
            const currentLine = lines[startLine] || '';
            lines[startLine] =
              currentLine.substring(0, startChar) +
              te.newText +
              currentLine.substring(endChar);
          } else {
            const firstLine = (lines[startLine] || '').substring(0, startChar);
            const lastLine = (lines[endLine] || '').substring(endChar);
            const combined = firstLine + te.newText + lastLine;
            const replacementLines = combined.split('\n');
            lines.splice(startLine, endLine - startLine + 1, ...replacementLines);
          }
          appliedCount++;
        }

        const newContent = lines.join('\n');
        await invoke('save_file_content', { path: filePath, content: newContent });
        filesChanged.push(filePath);
      } catch (err) {
        console.warn('Failed to apply workspace edit for file:', filePath, err);
      }
    }

    return { appliedCount, filesChanged };
  }

  public async getReferences(
    filePath: string,
    position: LspPosition,
    includeDeclaration: boolean = true
  ): Promise<LspLocation[]> {
    const lang = getLanguageId(filePath);
    if (lang === 'plaintext') return [];

    const uri = pathToUri(filePath);
    try {
      const res = await invoke<any>('lsp_send_request', {
        lang,
        method: 'textDocument/references',
        params: {
          textDocument: { uri },
          position,
          context: { includeDeclaration },
        },
      });

      if (!res || !Array.isArray(res)) return [];
      return res.map((loc) => ({
        uri: loc.uri || loc.targetUri,
        range: loc.range || loc.targetSelectionRange || loc.targetRange,
      }));
    } catch (e) {
      console.warn('LSP textDocument/references error:', e);
      return [];
    }
  }

  public getServerName(lang: string): string | null {
    return this.activeServers.get(lang.toLowerCase()) || null;
  }
}

export const lspService = new LspService();
