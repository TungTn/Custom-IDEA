import { Extension } from '@codemirror/state';
import { gutter, GutterMarker, EditorView } from '@codemirror/view';

export type GitDiffType = 'modified' | 'added' | 'deleted';

export function parseGitDiff(diffText: string): Map<number, GitDiffType> {
  const map = new Map<number, GitDiffType>();
  if (!diffText) return map;

  const lines = diffText.split('\n');
  let currentNewLine = 0;
  let hasDeletion = false;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/\+([0-9]+)(?:,([0-9]+))?/);
      if (match) {
        currentNewLine = parseInt(match[1], 10);
      }
      hasDeletion = false;
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      const type: GitDiffType = hasDeletion ? 'modified' : 'added';
      map.set(currentNewLine, type);
      currentNewLine++;
      hasDeletion = false;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      hasDeletion = true;
    } else if (!line.startsWith('\\')) {
      if (hasDeletion) {
        map.set(Math.max(1, currentNewLine), 'modified');
        hasDeletion = false;
      }
      currentNewLine++;
    }
  }

  if (hasDeletion) {
    map.set(Math.max(1, currentNewLine), 'modified');
  }

  return map;
}

class GitDiffMarker extends GutterMarker {
  constructor(private readonly type: GitDiffType) {
    super();
  }

  toDOM() {
    const el = document.createElement('div');
    el.className = 'cm-git-diff-marker w-[3px] h-full select-none transition-opacity cursor-pointer';

    if (this.type === 'modified') {
      el.className += ' bg-[#3574F0] hover:bg-[#528BF6]'; // IntelliJ Blue
      el.title = 'Line modified in Git';
    } else if (this.type === 'added') {
      el.className += ' bg-[#59A869] hover:bg-[#68C47B]'; // IntelliJ Green
      el.title = 'Line added in Git';
    } else {
      el.className += ' bg-[#E05555] hover:bg-[#EB7676]';
      el.title = 'Line deleted nearby';
    }

    return el;
  }
}

export function createGitDiffGutter(diffMap: Map<number, GitDiffType> | null): Extension {
  if (!diffMap || diffMap.size === 0) {
    return [];
  }

  const diffGutterExt = gutter({
    class: 'cm-git-diff-gutter',
    lineMarker: (_view, line) => {
      const lineNum = _view.state.doc.lineAt(line.from).number;
      const type = diffMap.get(lineNum);
      if (!type) return null;
      return new GitDiffMarker(type);
    },
    initialSpacer: () => {
      const el = document.createElement('div');
      el.className = 'w-[3px]';
      return new (class extends GutterMarker {
        toDOM() {
          return el;
        }
      })();
    },
  });

  const diffTheme = EditorView.theme({
    '.cm-git-diff-gutter': {
      width: '3px',
      minWidth: '3px',
      maxWidth: '3px',
      padding: '0 !important',
      backgroundColor: 'transparent',
    },
    '.cm-git-diff-gutter .cm-gutterElement': {
      display: 'flex',
      alignItems: 'center',
      padding: '0 !important',
      width: '3px',
    },
  });

  return [diffGutterExt, diffTheme];
}
