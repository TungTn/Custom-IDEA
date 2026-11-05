import { snippetCompletion, Completion } from '@codemirror/autocomplete';

export interface LiveTemplate {
  id: string;
  abbr: string;
  desc: string;
  body: string;
  languages?: string[]; // optional specific extensions e.g. ['ts', 'js', 'java']
}

export const STORAGE_KEY_LIVE_TEMPLATES = 'intellij_live_templates';

export const DEFAULT_LIVE_TEMPLATES: LiveTemplate[] = [
  {
    id: 'lt_sout',
    abbr: 'sout',
    desc: 'Prints a string to System.out or console.log',
    body: 'System.out.println($END$);',
  },
  {
    id: 'lt_serr',
    abbr: 'serr',
    desc: 'Prints a string to System.err or console.error',
    body: 'System.err.println($END$);',
  },
  {
    id: 'lt_psvm',
    abbr: 'psvm',
    desc: 'Main method declaration',
    body: 'public static void main(String[] args) {\n    $END$\n}',
  },
  {
    id: 'lt_clg',
    abbr: 'clg',
    desc: 'console.log statement',
    body: 'console.log($EXPR$);',
  },
  {
    id: 'lt_log',
    abbr: 'log',
    desc: 'console.log statement with label',
    body: 'console.log("$EXPR$: ", $EXPR$);',
  },
  {
    id: 'lt_pf',
    abbr: 'pf',
    desc: 'Public function in Rust',
    body: 'pub fn $NAME$($PARAMS$) -> $RET$ {\n    $END$\n}',
  },
  {
    id: 'lt_fn',
    abbr: 'fn',
    desc: 'Function definition',
    body: 'function $NAME$($PARAMS$) {\n    $END$\n}',
  },
  {
    id: 'lt_fori',
    abbr: 'fori',
    desc: 'Indexed for loop',
    body: 'for (let ${i} = 0; ${i} < ${limit}; ${i}++) {\n    ${}\n}',
  },
  {
    id: 'lt_iter',
    abbr: 'iter',
    desc: 'Iteration over collection',
    body: 'for (const ${item} of ${collection}) {\n    ${}\n}',
  },
  {
    id: 'lt_try',
    abbr: 'try',
    desc: 'try / catch block',
    body: 'try {\n    $END$\n} catch (error) {\n    console.error(error);\n}',
  },
  {
    id: 'lt_todo',
    abbr: 'todo',
    desc: 'TODO comment with timestamp',
    body: '// TODO: $DATE$ - $MESSAGE$',
  },
];

/**
 * Load user live templates from localStorage, falling back to defaults.
 */
export function loadLiveTemplates(): LiveTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LIVE_TEMPLATES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse live templates from localStorage', e);
  }
  return DEFAULT_LIVE_TEMPLATES;
}

/**
 * Save user live templates to localStorage.
 */
export function saveLiveTemplates(templates: LiveTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_LIVE_TEMPLATES, JSON.stringify(templates));
    window.dispatchEvent(new CustomEvent('intellij:live-templates-changed'));
  } catch (e) {
    console.error('Failed to save live templates', e);
  }
}

/**
 * Convert IntelliJ live template body syntax to CodeMirror 6 snippet syntax:
 * - $END$ -> ${}
 * - $DATE$ -> dynamic ISO date string
 * - $VAR$ -> ${VAR}
 */
export function convertToCmSnippet(body: string): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  let res = body.replace(/\$DATE\$/g, dateStr);
  res = res.replace(/\$END\$/g, '${}');

  // Convert other $NAME$ into ${NAME}
  res = res.replace(/\$([a-zA-Z0-9_]+)\$/g, (_, varName) => {
    return `\${${varName}}`;
  });

  return res;
}

/**
 * Build CodeMirror 6 completion options for live templates
 */
export function getLiveTemplateCompletions(language?: string): Completion[] {
  const templates = loadLiveTemplates();
  const ext = (language || '').toLowerCase().replace(/^\./, '');

  return templates
    .filter((lt) => {
      if (!lt.languages || lt.languages.length === 0) return true;
      return lt.languages.includes(ext);
    })
    .map((lt) => {
      const cmSnippet = convertToCmSnippet(lt.body);
      return snippetCompletion(cmSnippet, {
        label: lt.abbr,
        detail: `[Template] ${lt.desc}`,
        type: 'snippet',
        boost: 2,
      });
    });
}
