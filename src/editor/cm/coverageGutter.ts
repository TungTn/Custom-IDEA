import { Extension } from '@codemirror/state';
import { gutter, GutterMarker } from '@codemirror/view';

export type CoverageLineStatus = 'Covered' | 'Uncovered' | 'PartiallyCovered';

export interface CoverageLineItem {
  line_number: number;
  hits: number;
  status: CoverageLineStatus;
}

export interface FileCoverageData {
  file_path: string;
  lines_found: number;
  lines_hit: number;
  coverage_percent: number;
  line_details: CoverageLineItem[];
}

class CoverageGutterMarker extends GutterMarker {
  constructor(private readonly item: CoverageLineItem) {
    super();
  }

  toDOM() {
    const el = document.createElement('div');
    el.className = 'cm-coverage-marker h-full w-[3px] select-none transition-opacity cursor-pointer';

    if (this.item.status === 'Covered') {
      el.className += ' bg-[#59A869] hover:bg-[#68C47B]'; // IntelliJ Green
      el.title = `Line ${this.item.line_number}: covered (${this.item.hits} ${this.item.hits === 1 ? 'hit' : 'hits'})`;
    } else if (this.item.status === 'Uncovered') {
      el.className += ' bg-[#E06C75] hover:bg-[#FF7B86]'; // IntelliJ Red
      el.title = `Line ${this.item.line_number}: NOT covered by tests (0 hits)`;
    } else {
      el.className += ' bg-[#E5C07B] hover:bg-[#FFD782]'; // Partial Yellow
      el.title = `Line ${this.item.line_number}: partially covered`;
    }

    return el;
  }
}

export function createCoverageGutter(coverage: FileCoverageData | null): Extension {
  if (!coverage || !coverage.line_details || coverage.line_details.length === 0) {
    return [];
  }

  const map = new Map<number, CoverageLineItem>();
  for (const item of coverage.line_details) {
    map.set(item.line_number, item);
  }

  return gutter({
    class: 'cm-coverage-gutter w-[4px] min-w-[4px] max-w-[4px] px-0 bg-[#1E1F22]',
    lineMarker(view, line) {
      const lineNum = view.state.doc.lineAt(line.from).number;
      const covItem = map.get(lineNum);
      if (covItem) {
        return new CoverageGutterMarker(covItem);
      }
      return null;
    },
    initialSpacer: () => new CoverageGutterMarker({ line_number: 1, hits: 1, status: 'Covered' }),
  });
}
