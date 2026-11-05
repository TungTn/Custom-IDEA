import { Completion, snippet } from '@codemirror/autocomplete';
import { EditorView } from '@codemirror/view';

export interface PostfixTemplate {
  name: string;
  desc: string;
  languages?: string[];
  /**
   * Generates replacement snippet for the given expression text
   */
  buildSnippet: (expr: string, lang: string) => string;
}

export const POSTFIX_TEMPLATES: PostfixTemplate[] = [
  {
    name: 'sout',
    desc: 'Prints the expression (System.out.println / console.log)',
    buildSnippet: (expr, lang) => {
      if (['java', 'kt', 'kotlin'].includes(lang)) {
        return `System.out.println(${expr});\${}`;
      }
      if (['rs', 'rust'].includes(lang)) {
        return `println!("{:#?}", ${expr});\${}`;
      }
      if (['py', 'python'].includes(lang)) {
        return `print(${expr})\${}`;
      }
      return `console.log(${expr});\${}`;
    },
  },
  {
    name: 'log',
    desc: 'Logs the expression with variable label',
    buildSnippet: (expr, lang) => {
      if (['java', 'kt', 'kotlin'].includes(lang)) {
        return `System.out.println("${expr} = " + ${expr});\${}`;
      }
      if (['rs', 'rust'].includes(lang)) {
        return `println!("${expr} = {:?}", ${expr});\${}`;
      }
      if (['py', 'python'].includes(lang)) {
        return `print(f"${expr} = {${expr}}")\${}`;
      }
      return `console.log("${expr}:", ${expr});\${}`;
    },
  },
  {
    name: 'if',
    desc: 'Wraps expression in if statement',
    buildSnippet: (expr, lang) => {
      if (['py', 'python'].includes(lang)) {
        return `if ${expr}:\n    \${}`;
      }
      if (['rs', 'rust'].includes(lang)) {
        return `if ${expr} {\n    \${}\n}`;
      }
      return `if (${expr}) {\n    \${}\n}`;
    },
  },
  {
    name: 'else',
    desc: 'Wraps inverted expression in if (!expr)',
    buildSnippet: (expr, lang) => {
      if (['py', 'python'].includes(lang)) {
        return `if not ${expr}:\n    \${}`;
      }
      if (['rs', 'rust'].includes(lang)) {
        return `if !${expr} {\n    \${}\n}`;
      }
      return `if (!${expr}) {\n    \${}\n}`;
    },
  },
  {
    name: 'not',
    desc: 'Negates the boolean expression',
    buildSnippet: (expr, lang) => {
      if (['py', 'python'].includes(lang)) {
        return `not ${expr}\${}`;
      }
      return `!${expr}\${}`;
    },
  },
  {
    name: 'for',
    desc: 'Iterates over collection or array',
    buildSnippet: (expr, lang) => {
      if (['py', 'python'].includes(lang)) {
        return `for \${item} in ${expr}:\n    \${}`;
      }
      if (['rs', 'rust'].includes(lang)) {
        return `for \${item} in ${expr} {\n    \${}\n}`;
      }
      if (['java'].includes(lang)) {
        return `for (var \${item} : ${expr}) {\n    \${}\n}`;
      }
      return `for (const \${item} of ${expr}) {\n    \${}\n}`;
    },
  },
  {
    name: 'fori',
    desc: 'Indexed iteration over length or bounds',
    buildSnippet: (expr, lang) => {
      if (['py', 'python'].includes(lang)) {
        return `for \${i} in range(len(${expr})):\n    \${}`;
      }
      if (['rs', 'rust'].includes(lang)) {
        return `for \${i} in 0..${expr}.len() {\n    \${}\n}`;
      }
      if (['java'].includes(lang)) {
        return `for (int \${i} = 0; \${i} < ${expr}.length; \${i}++) {\n    \${}\n}`;
      }
      return `for (let \${i} = 0; \${i} < ${expr}.length; \${i}++) {\n    \${}\n}`;
    },
  },
  {
    name: 'var',
    desc: 'Assigns expression to a new variable',
    buildSnippet: (expr, lang) => {
      const suggestedName = expr
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase() || 'val';
      if (['rs', 'rust'].includes(lang)) {
        return `let \${${suggestedName}} = ${expr};\${}`;
      }
      if (['py', 'python'].includes(lang)) {
        return `\${${suggestedName}} = ${expr}\${}`;
      }
      if (['java'].includes(lang)) {
        return `var \${${suggestedName}} = ${expr};\${}`;
      }
      return `const \${${suggestedName}} = ${expr};\${}`;
    },
  },
  {
    name: 'val',
    desc: 'Assigns expression to a const/immutable variable',
    buildSnippet: (expr, lang) => {
      const suggestedName = expr
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase() || 'val';
      if (['rs', 'rust'].includes(lang)) {
        return `let \${${suggestedName}} = ${expr};\${}`;
      }
      if (['py', 'python'].includes(lang)) {
        return `\${${suggestedName}} = ${expr}\${}`;
      }
      return `const \${${suggestedName}} = ${expr};\${}`;
    },
  },
  {
    name: 'return',
    desc: 'Returns the expression from current function',
    buildSnippet: (expr, _lang) => {
      return `return ${expr};\${}`;
    },
  },
  {
    name: 'null',
    desc: 'Checks if expression is null (or None)',
    buildSnippet: (expr, lang) => {
      if (['py', 'python'].includes(lang)) {
        return `if ${expr} is None:\n    \${}`;
      }
      if (['rs', 'rust'].includes(lang)) {
        return `if ${expr}.is_none() {\n    \${}\n}`;
      }
      return `if (${expr} === null) {\n    \${}\n}`;
    },
  },
  {
    name: 'nn',
    desc: 'Checks if expression is not null',
    buildSnippet: (expr, lang) => {
      if (['py', 'python'].includes(lang)) {
        return `if ${expr} is not None:\n    \${}`;
      }
      if (['rs', 'rust'].includes(lang)) {
        return `if ${expr}.is_some() {\n    \${}\n}`;
      }
      return `if (${expr} !== null && ${expr} !== undefined) {\n    \${}\n}`;
    },
  },
  {
    name: 'try',
    desc: 'Wraps expression in try/catch block',
    buildSnippet: (expr, lang) => {
      if (['py', 'python'].includes(lang)) {
        return `try:\n    ${expr}\nexcept Exception as \${e}:\n    \${}`;
      }
      return `try {\n    ${expr};\n} catch (\${error}) {\n    console.error(\${error});\n    \${}\n}`;
    },
  },
];

/**
 * Given text before cursor, find expression before '.' and dot prefix
 * e.g., for "const x = myList.fo" -> expr: "myList", dotPos: 14, filter: "fo"
 */
export function extractPostfixContext(lineText: string, cursorInLine: number): {
  exprStart: number;
  dotIndex: number;
  expr: string;
  filter: string;
} | null {
  const textBefore = lineText.slice(0, cursorInLine);
  const dotIndex = textBefore.lastIndexOf('.');
  if (dotIndex <= 0) return null;

  // The text between dot and cursor is the filter / abbreviation being typed
  const filter = textBefore.slice(dotIndex + 1);
  if (!/^[a-zA-Z0-9_]*$/.test(filter)) {
    return null;
  }

  // Find the start of the expression before the dot
  const preDot = textBefore.slice(0, dotIndex).trimEnd();
  if (!preDot) return null;

  // Track balanced parentheses, brackets, or simple identifier
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let i = preDot.length - 1;

  while (i >= 0) {
    const ch = preDot[i];
    if (ch === ')') depthParen++;
    else if (ch === '(') {
      if (depthParen > 0) depthParen--;
      else break;
    } else if (ch === ']') depthBracket++;
    else if (ch === '[') {
      if (depthBracket > 0) depthBracket--;
      else break;
    } else if (ch === '}') depthBrace++;
    else if (ch === '{') {
      if (depthBrace > 0) depthBrace--;
      else break;
    } else if (depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      // At top-level, expression terminates at semicolon, comma, operators (unless part of id)
      if ([';', ',', '=', '+', '-', '*', '/', '%', '!', '&', '|', '^', '?', ':', '\n', '\t', ' '].includes(ch)) {
        i++;
        break;
      }
    }
    i--;
  }

  const exprStart = Math.max(0, i);
  const expr = preDot.slice(exprStart).trim();
  if (!expr) return null;

  return {
    exprStart,
    dotIndex,
    expr,
    filter,
  };
}

/**
 * Builds postfix completion items matching current expression context
 */
export function getPostfixCompletions(
  lineText: string,
  cursorInLine: number,
  lineFrom: number,
  language: string
): { from: number; options: Completion[] } | null {
  const ctx = extractPostfixContext(lineText, cursorInLine);
  if (!ctx) return null;

  const { exprStart, dotIndex, expr, filter } = ctx;
  const lang = (language || '').toLowerCase().replace(/^\./, '');

  const replaceFrom = lineFrom + exprStart;
  const replaceTo = lineFrom + cursorInLine;

  const matches = POSTFIX_TEMPLATES.filter((tpl) => {
    if (tpl.languages && !tpl.languages.includes(lang)) return false;
    return tpl.name.toLowerCase().startsWith(filter.toLowerCase());
  });

  if (matches.length === 0) return null;

  const options: Completion[] = matches.map((tpl) => {
    const templateSnippet = tpl.buildSnippet(expr, lang);
    return {
      label: `.${tpl.name}`,
      detail: `[Postfix] ${tpl.desc}`,
      type: 'snippet',
      boost: 3,
      apply: (view: EditorView, _completion: Completion, _from: number, _to: number) => {
        // Use CM6 snippet insertion replacing from replaceFrom to replaceTo
        snippet(templateSnippet)(view, _completion, replaceFrom, replaceTo);
      },
    };
  });

  return {
    from: lineFrom + dotIndex,
    options,
  };
}
