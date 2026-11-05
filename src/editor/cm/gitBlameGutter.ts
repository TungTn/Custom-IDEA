import { Extension } from '@codemirror/state';
import { gutter, GutterMarker, EditorView } from '@codemirror/view';
import { GitBlameLineDto } from '../../bindings';

class GitBlameMarker extends GutterMarker {
  constructor(
    private readonly blame: GitBlameLineDto,
    private readonly onCommitClick?: (hash: string) => void
  ) {
    super();
  }

  toDOM() {
    const el = document.createElement('div');
    el.className =
      'cm-blame-marker flex items-center gap-1.5 px-2.5 text-[11px] font-mono select-none leading-none h-full transition-colors group cursor-default text-[#7A7E85] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/60';

    // Tooltip with full commit info
    const dateFormatted = this.blame.date ? new Date(this.blame.date).toLocaleDateString() : '';
    el.title = `Commit: ${this.blame.commit_hash}\nAuthor: ${this.blame.author} <${this.blame.email}>\nDate: ${dateFormatted} (${this.blame.relative_time})\n\n${this.blame.summary}`;

    // Short Hash
    const hashSpan = document.createElement('span');
    hashSpan.className =
      'text-[#56A8F5] font-semibold hover:underline cursor-pointer group-hover:text-[#68B5FF]';
    hashSpan.textContent = this.blame.short_hash || this.blame.commit_hash.slice(0, 7);
    if (this.onCommitClick) {
      hashSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onCommitClick!(this.blame.commit_hash);
      });
    }

    // Author
    const authorSpan = document.createElement('span');
    authorSpan.className = 'text-[#A1A3AB] truncate max-w-[80px]';
    authorSpan.textContent = this.blame.author;

    // Relative Time
    const timeSpan = document.createElement('span');
    timeSpan.className = 'text-[#6F737A] text-[10px] ml-auto';
    timeSpan.textContent = this.blame.relative_time;

    el.appendChild(hashSpan);
    el.appendChild(authorSpan);
    el.appendChild(timeSpan);

    return el;
  }
}

export function createGitBlameGutter(
  blameLines: GitBlameLineDto[],
  onCommitClick?: (hash: string) => void
): Extension {
  const lineMap = new Map<number, GitBlameLineDto>();
  for (const b of blameLines) {
    lineMap.set(b.line, b);
  }

  const blameGutterExtension = gutter({
    class: 'cm-git-blame-gutter',
    lineMarker: (_view, line) => {
      const lineNum = _view.state.doc.lineAt(line.from).number;
      const b = lineMap.get(lineNum);
      if (!b) return null;
      return new GitBlameMarker(b, onCommitClick);
    },
    initialSpacer: () => {
      const el = document.createElement('div');
      el.className = 'px-2.5 text-[11px] font-mono';
      el.textContent = '1234567 AuthorName 10mo ago';
      return new (class extends GutterMarker {
        toDOM() {
          return el;
        }
      })();
    },
  });

  const blameTheme = EditorView.theme({
    '.cm-git-blame-gutter': {
      backgroundColor: '#1E1F22',
      borderRight: '1px solid #2B2D30',
      minWidth: '190px',
    },
    '.cm-git-blame-gutter .cm-gutterElement': {
      display: 'flex',
      alignItems: 'center',
      padding: '0 !important',
    },
  });

  return [blameGutterExtension, blameTheme];
}
