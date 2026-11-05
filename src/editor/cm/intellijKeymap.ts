import { KeyBinding, EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo } from '@codemirror/commands';
import { openSearchPanel, closeSearchPanel } from '@codemirror/search';
import { toggleComment, toggleBlockComment, indentMore, indentLess } from '@codemirror/commands';

// ─── 1. Helper for Duplicate Line / Selection (IntelliJ Ctrl+D) ───
export const duplicateLine = (view: EditorView) => {
  const { state } = view;
  const changes = [];
  const newRanges = [];

  for (const range of state.selection.ranges) {
    if (range.empty) {
      const line = state.doc.lineAt(range.head);
      changes.push({
        from: line.to,
        insert: '\n' + line.text,
      });
      newRanges.push(EditorSelection.cursor(Math.min(state.doc.length, range.head + line.text.length + 1)));
    } else {
      const text = state.sliceDoc(range.from, range.to);
      changes.push({
        from: range.to,
        insert: text,
      });
      newRanges.push(EditorSelection.range(range.to, range.to + text.length));
    }
  }

  if (changes.length > 0) {
    view.dispatch({
      changes,
      selection: EditorSelection.create(newRanges),
      scrollIntoView: true,
    });
    return true;
  }
  return false;
};

// ─── 2. Helper for Delete Line (IntelliJ Ctrl+Y) ───
export const deleteLine = (view: EditorView) => {
  const { state } = view;
  const changes = [];

  for (const range of state.selection.ranges) {
    const line = state.doc.lineAt(range.head);
    let from = line.from;
    let to = line.to;

    if (line.number < state.doc.lines) {
      to += 1; // Include trailing newline
    } else if (from > 0) {
      from -= 1; // Include preceding newline if last line
    }

    changes.push({ from, to });
  }

  if (changes.length > 0) {
    view.dispatch({
      changes,
      scrollIntoView: true,
    });
    return true;
  }
  return false;
};

// ─── 3. Helper for Move Line Up (IntelliJ Alt+Shift+Up) ───
export const moveLineUp = (view: EditorView) => {
  const { state } = view;
  const sel = state.selection.main;
  const startLine = state.doc.lineAt(sel.from);
  const endLine = state.doc.lineAt(sel.to);

  if (startLine.number <= 1) return false;

  const prevLine = state.doc.line(startLine.number - 1);
  const movingText = state.sliceDoc(startLine.from, endLine.to);
  const prevText = prevLine.text;

  const replacement = movingText + '\n' + prevText;
  const newFrom = prevLine.from + (sel.from - startLine.from);
  const newTo = newFrom + (sel.to - sel.from);

  view.dispatch({
    changes: { from: prevLine.from, to: endLine.to, insert: replacement },
    selection: EditorSelection.range(newFrom, newTo),
    scrollIntoView: true,
  });
  return true;
};

// ─── 4. Helper for Move Line Down (IntelliJ Alt+Shift+Down) ───
export const moveLineDown = (view: EditorView) => {
  const { state } = view;
  const sel = state.selection.main;
  const startLine = state.doc.lineAt(sel.from);
  const endLine = state.doc.lineAt(sel.to);

  if (endLine.number >= state.doc.lines) return false;

  const nextLine = state.doc.line(endLine.number + 1);
  const movingText = state.sliceDoc(startLine.from, endLine.to);
  const nextText = nextLine.text;

  const replacement = nextText + '\n' + movingText;
  const offset = nextText.length + 1;
  const newFrom = startLine.from + offset + (sel.from - startLine.from);
  const newTo = newFrom + (sel.to - sel.from);

  view.dispatch({
    changes: { from: startLine.from, to: nextLine.to, insert: replacement },
    selection: EditorSelection.range(newFrom, newTo),
    scrollIntoView: true,
  });
  return true;
};

// ─── 5. Helper for Join Lines (IntelliJ Ctrl+Shift+J) ───
export const joinLines = (view: EditorView) => {
  const { state } = view;
  const sel = state.selection.main;
  const line = state.doc.lineAt(sel.head);

  if (line.number >= state.doc.lines) return false;

  const nextLine = state.doc.line(line.number + 1);
  const trimmedNext = nextLine.text.trimStart();
  const insertText = (line.text.endsWith(' ') || trimmedNext.startsWith(')')) ? trimmedNext : ' ' + trimmedNext;

  view.dispatch({
    changes: { from: line.to, to: nextLine.to, insert: insertText },
    selection: EditorSelection.cursor(line.to),
    scrollIntoView: true,
  });
  return true;
};

// ─── 6. Helper for Extend Selection (IntelliJ Ctrl+W) ───
export const extendSelection = (view: EditorView) => {
  const { state } = view;
  const sel = state.selection.main;

  // 1. If selection is empty, select the current word
  if (sel.empty) {
    const word = state.wordAt(sel.head);
    if (word) {
      view.dispatch({
        selection: EditorSelection.range(word.from, word.to),
      });
      return true;
    }
  }

  // 2. Expand within quotes or brackets
  const docText = state.doc.toString();
  const quotes = ['"', "'", '`'];
  for (const q of quotes) {
    const leftQ = docText.lastIndexOf(q, Math.max(0, sel.from - 1));
    const rightQ = docText.indexOf(q, sel.to);
    if (leftQ !== -1 && rightQ !== -1 && leftQ < sel.from && rightQ >= sel.to) {
      if (sel.from > leftQ + 1 || sel.to < rightQ) {
        view.dispatch({
          selection: EditorSelection.range(leftQ + 1, rightQ),
        });
        return true;
      }
      if (sel.from === leftQ + 1 && sel.to === rightQ) {
        view.dispatch({
          selection: EditorSelection.range(leftQ, rightQ + 1),
        });
        return true;
      }
    }
  }

  // 3. Expand to line bounds
  const line = state.doc.lineAt(sel.head);
  if (sel.from > line.from || sel.to < line.to) {
    view.dispatch({
      selection: EditorSelection.range(line.from, line.to),
    });
    return true;
  }

  // 4. Expand to entire line including newline
  if (line.number < state.doc.lines) {
    view.dispatch({
      selection: EditorSelection.range(line.from, line.to + 1),
    });
    return true;
  }

  return false;
};

// ─── 7. Helper for Shrink Selection (IntelliJ Ctrl+Shift+W) ───
export const shrinkSelection = (view: EditorView) => {
  const { state } = view;
  const sel = state.selection.main;
  if (sel.empty) return false;

  const word = state.wordAt(sel.head);
  if (word && (sel.from < word.from || sel.to > word.to)) {
    view.dispatch({
      selection: EditorSelection.range(word.from, word.to),
    });
    return true;
  }

  view.dispatch({
    selection: EditorSelection.cursor(sel.head),
  });
  return true;
};

// ─── 8. Helper for Select Next Occurrence (IntelliJ Alt+J) ───
export const selectNextOccurrence = (view: EditorView) => {
  const { state } = view;
  const main = state.selection.main;
  let text = state.sliceDoc(main.from, main.to);

  if (!text) {
    const word = state.wordAt(main.head);
    if (!word) return false;
    text = state.sliceDoc(word.from, word.to);
    view.dispatch({
      selection: EditorSelection.create([
        EditorSelection.range(word.from, word.to)
      ]),
    });
    return true;
  }

  const docStr = state.doc.toString();
  // Find next occurrence after the last selection
  const lastRange = state.selection.ranges[state.selection.ranges.length - 1];
  let nextIdx = docStr.indexOf(text, lastRange.to);

  // Wrap around if not found
  if (nextIdx === -1) {
    nextIdx = docStr.indexOf(text, 0);
  }

  if (nextIdx !== -1 && (nextIdx < main.from || nextIdx >= main.to)) {
    const newRanges = [...state.selection.ranges, EditorSelection.range(nextIdx, nextIdx + text.length)];
    view.dispatch({
      selection: EditorSelection.create(newRanges),
      scrollIntoView: true,
    });
    return true;
  }

  return false;
};

export const intellijCustomKeymap: readonly KeyBinding[] = [
  // IntelliJ & Eclipse Duplicate Line / Selection (Ctrl+D and Ctrl+Alt+Down)
  {
    key: 'Mod-d',
    run: duplicateLine,
    preventDefault: true,
  },
  {
    key: 'Mod-Alt-ArrowDown',
    run: duplicateLine,
    preventDefault: true,
  },
  {
    key: 'Mod-Alt-Down',
    run: duplicateLine,
    preventDefault: true,
  },
  // IntelliJ Delete Line
  {
    key: 'Mod-y',
    run: deleteLine,
    preventDefault: true,
  },
  // IntelliJ & Eclipse Move Line Up / Down (Alt+Shift+Up/Down & Alt+Up/Down)
  {
    key: 'Alt-Shift-ArrowUp',
    run: moveLineUp,
    preventDefault: true,
  },
  {
    key: 'Alt-Shift-ArrowDown',
    run: moveLineDown,
    preventDefault: true,
  },
  {
    key: 'Alt-ArrowUp',
    run: moveLineUp,
    preventDefault: true,
  },
  {
    key: 'Alt-ArrowDown',
    run: moveLineDown,
    preventDefault: true,
  },
  {
    key: 'Mod-Shift-ArrowUp',
    run: moveLineUp,
    preventDefault: true,
  },
  {
    key: 'Mod-Shift-ArrowDown',
    run: moveLineDown,
    preventDefault: true,
  },
  // IntelliJ Join Lines
  {
    key: 'Mod-Shift-j',
    run: joinLines,
    preventDefault: true,
  },
  // IntelliJ Extend / Shrink Selection
  {
    key: 'Mod-w',
    run: extendSelection,
    preventDefault: true,
  },
  {
    key: 'Mod-Shift-w',
    run: shrinkSelection,
    preventDefault: true,
  },
  // IntelliJ Multi-Caret: Select Next Occurrence
  {
    key: 'Alt-j',
    run: selectNextOccurrence,
    preventDefault: true,
  },
  // Line & Block Commenting
  {
    key: 'Mod-/',
    run: toggleComment,
  },
  {
    key: 'Mod-Shift-/',
    run: toggleBlockComment,
  },
  // Search & Replace
  {
    key: 'Mod-f',
    run: openSearchPanel,
  },
  {
    key: 'Mod-r',
    run: openSearchPanel,
  },
  {
    key: 'Escape',
    run: closeSearchPanel,
  },
  // Indentation
  {
    key: 'Tab',
    run: indentMore,
  },
  {
    key: 'Shift-Tab',
    run: indentLess,
  },
  // Undo / Redo
  {
    key: 'Mod-z',
    run: undo,
  },
  {
    key: 'Mod-Shift-z',
    run: redo,
  },
  // IntelliJ Smart Enter: Complete Current Statement (Ctrl+Shift+Enter)
  {
    key: 'Mod-Shift-Enter',
    run: smartEnter,
    preventDefault: true,
  },
  // IntelliJ Paste from History (Ctrl+Shift+V)
  {
    key: 'Mod-Shift-v',
    run: openClipboardHistory,
    preventDefault: true,
  },
  // IntelliJ Go to Test / Create Test (Ctrl+Shift+T)
  {
    key: 'Mod-Shift-t',
    run: openGoToTest,
    preventDefault: true,
  },
  // IntelliJ In-Place Rename (Shift+F6)
  {
    key: 'Shift-F6',
    run: triggerInPlaceRename,
    preventDefault: true,
  },
];

// ─── 7. Helper for IntelliJ Smart Enter (Complete Current Statement) ───
export function smartEnter(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection.main;
  const line = state.doc.lineAt(sel.head);
  const text = line.text;
  const trimmed = text.trim();
  const indent = text.match(/^\s*/)?.[0] || '';

  // Case 1: Block opening statement like `if (...)`, `for (...)`, `while (...)`, `function (...)`, `fn ...()`, etc.
  const blockKeywords = /^(if|for|while|switch|match|function|fn|class|interface|struct|enum|try|catch|finally|else|loop)\b/;
  const isBlock = blockKeywords.test(trimmed);

  if (isBlock && !trimmed.endsWith('{')) {
    // If it's a block statement without '{', insert ' {\n  \n}'
    const insertText = ' {\n' + indent + '  \n' + indent + '}';
    const insertPos = line.to;
    view.dispatch({
      changes: { from: insertPos, insert: insertText },
      selection: EditorSelection.cursor(insertPos + 4 + indent.length),
      scrollIntoView: true,
    });
    return true;
  }

  // Case 2: Statement without semicolon (JS/TS/Rust/Java/C/C++)
  if (
    !trimmed.endsWith(';') &&
    !trimmed.endsWith('{') &&
    !trimmed.endsWith('}') &&
    !trimmed.endsWith(',') &&
    !trimmed.endsWith(':') &&
    !trimmed.startsWith('//') &&
    !trimmed.startsWith('/*') &&
    trimmed.length > 0
  ) {
    const insertPos = line.to;
    const insertText = ';\n' + indent;
    view.dispatch({
      changes: { from: insertPos, insert: insertText },
      selection: EditorSelection.cursor(insertPos + insertText.length),
      scrollIntoView: true,
    });
    return true;
  }

  // Case 3: Already complete - jump to new indented line
  const insertPos = line.to;
  const insertText = '\n' + indent;
  view.dispatch({
    changes: { from: insertPos, insert: insertText },
    selection: EditorSelection.cursor(insertPos + insertText.length),
    scrollIntoView: true,
  });
  return true;
}

// ─── 8. Helper for Clipboard History (Mod-Shift-V) ───
export function openClipboardHistory(): boolean {
  window.dispatchEvent(new CustomEvent('intellij:open-clipboard-history'));
  return true;
}

// ─── 9. Helper for Go to Test (Mod-Shift-T) ───
export function openGoToTest(): boolean {
  window.dispatchEvent(new CustomEvent('intellij:goto-test'));
  return true;
}

// ─── 10. Helper for In-Place Rename (Shift-F6) ───
export function triggerInPlaceRename(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection.main;
  const wordRange = state.wordAt(sel.head);
  const word = wordRange ? state.sliceDoc(wordRange.from, wordRange.to) : '';
  window.dispatchEvent(
    new CustomEvent('intellij:inplace-rename', {
      detail: {
        word,
        from: wordRange?.from ?? sel.head,
        to: wordRange?.to ?? sel.head,
      },
    })
  );
  return true;
}
