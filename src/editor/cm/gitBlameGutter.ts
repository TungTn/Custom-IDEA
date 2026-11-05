import { Extension } from '@codemirror/state';
import { gutter, GutterMarker, EditorView } from '@codemirror/view';
import { GitBlameLineDto } from '../../bindings';

class GitBlameMarker extends GutterMarker {
  constructor(
    private readonly blame: GitBlameLineDto,
    private readonly isFirstLineOfBlock: boolean,
    private readonly isUncommitted: boolean,
    private readonly onCommitClick?: (hash: string) => void
  ) {
    super();
  }

  toDOM() {
    const el = document.createElement('div');
    el.className =
      'cm-blame-marker flex items-center justify-between px-2 text-[11px] font-sans select-none leading-none h-full transition-colors cursor-pointer group hover:bg-[#2B2D30]';

    // Top border separator for new commit block (like IntelliJ IDEA)
    if (this.isFirstLineOfBlock) {
      el.style.borderTop = '1px solid rgba(255, 255, 255, 0.08)';
    }

    // Format date: MM/DD/YYYY (or empty if uncommitted)
    let dateFormatted = '';
    const rawTime = Number(this.blame.date);
    if (!isNaN(rawTime) && rawTime > 0) {
      const d = new Date(rawTime * 1000);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      dateFormatted = `${mm}/${dd}/${yyyy}`;
    }

    // Tooltip with comprehensive commit details
    if (this.isUncommitted) {
      el.title = 'Not committed yet (Local changes)';
    } else {
      el.title = `Commit: ${this.blame.commit_hash}\nAuthor: ${this.blame.author} <${this.blame.email}>\nDate: ${dateFormatted} (${this.blame.relative_time})\n\n${this.blame.summary}`;
    }

    // Only display Date + Author on the first line of the block (IntelliJ Commit Block Grouping)
    if (this.isFirstLineOfBlock) {
      if (this.isUncommitted) {
        const uncommittedSpan = document.createElement('span');
        uncommittedSpan.className = 'text-[#7A7E85] italic text-[10.5px] truncate';
        uncommittedSpan.textContent = 'Not committed yet';
        el.appendChild(uncommittedSpan);
      } else {
        // Date (light blue / gray)
        const dateSpan = document.createElement('span');
        dateSpan.className = 'text-[#589DF6] font-medium mr-2 text-[10.5px] group-hover:underline flex-shrink-0';
        dateSpan.textContent = dateFormatted;

        // Author
        const authorSpan = document.createElement('span');
        authorSpan.className = 'text-[#A1A3AB] group-hover:text-white truncate text-[11px]';
        authorSpan.textContent = this.blame.author;

        el.appendChild(dateSpan);
        el.appendChild(authorSpan);
      }
    }

    if (this.onCommitClick && !this.isUncommitted) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onCommitClick!(this.blame.commit_hash);
      });
    }

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

      const isUncommitted =
        !b.commit_hash ||
        b.commit_hash.startsWith('0000000') ||
        b.author.toLowerCase().includes('not commit');

      // Check if previous line had the exact same commit hash
      const prevB = lineMap.get(lineNum - 1);
      const isFirstLineOfBlock =
        lineNum === 1 ||
        !prevB ||
        (isUncommitted && !prevB.commit_hash.startsWith('0000000')) ||
        (!isUncommitted && prevB.commit_hash !== b.commit_hash);

      return new GitBlameMarker(b, isFirstLineOfBlock, isUncommitted, onCommitClick);
    },
    initialSpacer: () => {
      const el = document.createElement('div');
      el.className = 'px-2 text-[11px] font-sans flex items-center justify-between';
      el.innerHTML = '<span class="mr-2">12/31/2026</span><span>AuthorName</span>';
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
      width: '145px',
      minWidth: '145px',
    },
    '.cm-git-blame-gutter .cm-gutterElement': {
      display: 'flex',
      alignItems: 'center',
      padding: '0 !important',
      boxSizing: 'border-box',
    },
  });

  return [blameGutterExtension, blameTheme];
}
