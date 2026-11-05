import { Extension } from '@codemirror/state';
import { autocompletion, CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete';
import { getLiveTemplateCompletions } from './snippetEngine';
import { getPostfixCompletions } from './postfixEngine';

/**
 * Creates CodeMirror 6 extension that integrates Live Templates and Postfix Completions
 * into the autocompletion stream alongside or fallback to LSP.
 */
export function createTemplateExtension(filePath: string, language?: string): Extension {
  const ext = filePath.split('.').pop() || language || '';

  return autocompletion({
    override: [
      async (context: CompletionContext): Promise<CompletionResult | null> => {
        const { state, pos } = context;
        const line = state.doc.lineAt(pos);
        const cursorInLine = pos - line.from;

        // 1. Check for Postfix completion first (e.g., expression.sout, arr.for)
        const postfixRes = getPostfixCompletions(line.text, cursorInLine, line.from, ext);
        if (postfixRes && postfixRes.options.length > 0) {
          return {
            from: postfixRes.from,
            options: postfixRes.options,
            validFor: /^\.[a-zA-Z0-9_]*$/,
          };
        }

        // 2. Check for Live Template match (e.g. sout, psvm, fori)
        const word = context.matchBefore(/[\w$]+/);
        if (!context.explicit && (!word || word.from === word.to)) {
          return null;
        }

        const templateOptions = getLiveTemplateCompletions(ext);
        if (templateOptions.length === 0) {
          return null;
        }

        // Filter templates based on what user has typed so far
        const prefix = word ? word.text.toLowerCase() : '';
        const filtered = prefix
          ? templateOptions.filter((t) => t.label.toLowerCase().startsWith(prefix))
          : templateOptions;

        if (filtered.length === 0) {
          return null;
        }

        return {
          from: word ? word.from : pos,
          options: filtered,
          validFor: /^[\w$]*$/,
        };
      },
    ],
  });
}
