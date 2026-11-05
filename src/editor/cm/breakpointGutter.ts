import { Extension, RangeSet, RangeSetBuilder } from '@codemirror/state';
import {
  gutter,
  GutterMarker,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
} from '@codemirror/view';
import { Breakpoint } from '../../types';

class BreakpointMarker extends GutterMarker {
  constructor(private isMuted: boolean = false) {
    super();
  }

  toDOM() {
    const marker = document.createElement('div');
    marker.className = 'w-3 h-3 flex items-center justify-center my-auto cursor-pointer group';
    marker.title = this.isMuted ? 'Breakpoint (Muted)' : 'Breakpoint (Click to toggle)';

    const dot = document.createElement('div');
    if (this.isMuted) {
      dot.className =
        'w-2.5 h-2.5 rounded-full border-2 border-[#E5534B] bg-transparent transition-transform group-hover:scale-125';
    } else {
      dot.className =
        'w-2.5 h-2.5 rounded-full bg-[#E5534B] shadow-sm shadow-[#E5534B]/50 transition-transform group-hover:scale-125';
    }
    marker.appendChild(dot);
    return marker;
  }
}

class ExecutionPausedMarker extends GutterMarker {
  toDOM() {
    const marker = document.createElement('div');
    marker.className = 'w-3 h-3 flex items-center justify-center my-auto text-[#E5C07B] font-bold text-xs select-none';
    marker.title = 'Execution paused here';
    marker.textContent = '▶';
    return marker;
  }
}

export function createBreakpointGutter(
  filePath: string,
  breakpoints: Breakpoint[],
  activePausedLine: { filePath: string; line: number } | null | undefined,
  onToggleBreakpoint?: (lineNumber: number) => void
): Extension {
  // Normalize current path for comparison
  const normalizedCurrent = filePath.replace(/\\/g, '/').toLowerCase();

  const activeLineBpMap = new Map<number, Breakpoint>();
  for (const bp of breakpoints) {
    const bpPath = (bp.filePath || '').replace(/\\/g, '/').toLowerCase();
    if (bpPath === normalizedCurrent || bpPath.endsWith(normalizedCurrent) || normalizedCurrent.endsWith(bpPath)) {
      activeLineBpMap.set(bp.lineNumber, bp);
    }
  }

  const isPausedOnThisFile =
    activePausedLine &&
    activePausedLine.filePath &&
    activePausedLine.line > 0 &&
    (activePausedLine.filePath.replace(/\\/g, '/').toLowerCase() === normalizedCurrent ||
      normalizedCurrent.endsWith(activePausedLine.filePath.replace(/\\/g, '/').toLowerCase()));

  const pausedLineNum = isPausedOnThisFile ? activePausedLine.line : -1;

  const bpGutter = gutter({
    class: 'cm-breakpoint-gutter bg-[#1E1F22] border-r border-[#2B2D30]/50 select-none w-5',
    markers: (view: EditorView) => {
      const builder = new RangeSetBuilder<GutterMarker>();
      const { doc } = view.state;

      for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        if (i === pausedLineNum) {
          builder.add(line.from, line.from, new ExecutionPausedMarker());
        } else if (activeLineBpMap.has(i)) {
          const bp = activeLineBpMap.get(i)!;
          builder.add(line.from, line.from, new BreakpointMarker(!bp.enabled));
        }
      }
      return builder.finish();
    },
    domEventHandlers: {
      mousedown: (view: EditorView, line, event) => {
        const mouseEv = event as MouseEvent;
        if (mouseEv.button === 0) {
          // Left click toggles breakpoint
          const lineObj = view.state.doc.lineAt(line.from);
          onToggleBreakpoint?.(lineObj.number);
          return true;
        }
        return false;
      },
    },
  });

  return bpGutter;
}

// Line highlight decoration for active paused line
const executionLineDeco = Decoration.line({
  attributes: {
    style: 'background-color: rgba(46, 91, 130, 0.35); border-left: 3px solid #E5C07B;',
  },
});

export function createActiveLineHighlighter(
  filePath: string,
  activePausedLine: { filePath: string; line: number } | null | undefined
): Extension {
  const normalizedCurrent = filePath.replace(/\\/g, '/').toLowerCase();

  const isPaused =
    activePausedLine &&
    activePausedLine.filePath &&
    activePausedLine.line > 0 &&
    (activePausedLine.filePath.replace(/\\/g, '/').toLowerCase() === normalizedCurrent ||
      normalizedCurrent.endsWith(activePausedLine.filePath.replace(/\\/g, '/').toLowerCase()));

  const targetLine = isPaused ? activePausedLine.line : -1;

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDeco(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDeco(update.view);
        }
      }

      buildDeco(view: EditorView): DecorationSet {
        if (targetLine <= 0 || targetLine > view.state.doc.lines) {
          return RangeSet.empty;
        }
        const line = view.state.doc.line(targetLine);
        return RangeSet.of([executionLineDeco.range(line.from)]);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}
