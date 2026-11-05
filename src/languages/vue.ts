export const vueLanguageConfiguration: any = {
  comments: {
    blockComment: ['<!--', '-->'],
  },
  brackets: [
    ['<', '>'],
    ['{', '}'],
    ['(', ')'],
    ['[', ']'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' },
    { open: '<', close: '>' },
    { open: '<!--', close: '-->' },
  ],
  surroundingPairs: [
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' },
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '<', close: '>' },
  ],
};

export const vueMonarchTokensProvider: any = {
  defaultToken: '',
  tokenPostfix: '.vue',
  keywords: [
    'import', 'export', 'default', 'from', 'as', 'const', 'let', 'var', 'function',
    'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'new', 'this', 'typeof', 'instanceof', 'void', 'delete', 'try', 'catch', 'finally',
    'throw', 'class', 'extends', 'super', 'interface', 'type', 'async', 'await', 'yield',
    'null', 'undefined', 'true', 'false', 'ref', 'reactive', 'computed', 'watch', 'watchEffect',
    'onMounted', 'onUpdated', 'onUnmounted', 'onBeforeMount', 'onBeforeUpdate', 'onBeforeUnmount',
    'defineProps', 'defineEmits', 'defineExpose', 'defineOptions', 'defineSlots', 'useRouter',
    'useRoute', 'useStore'
  ],
  typeKeywords: [
    'boolean', 'double', 'byte', 'int', 'short', 'char', 'void', 'long', 'float', 'number',
    'string', 'any', 'never', 'unknown', 'object', 'Record', 'Array', 'Promise', 'Set', 'Map'
  ],
  tokenizer: {
    root: [
      // HTML comments
      [/<!--/, 'comment', '@comment'],

      // Script tags
      [/<script\b/, { token: 'tag', next: '@scriptTag' }],

      // Style tags
      [/<style\b/, { token: 'tag', next: '@styleTag' }],

      // Template & custom component tags
      [/<\/?[a-zA-Z0-9_\-]+/, 'tag', '@tagBody'],

      // Mustache template bindings {{ ... }}
      [/\{\{/, 'delimiter.bracket', '@mustache'],

      // Script keywords outside tags (fallback)
      [/[a-zA-Z_$][\w$]*(?=\s*\()/, {
        cases: {
          '@keywords': 'keyword',
          '@default': 'function',
        }
      }],
      [/[a-zA-Z_$][\w$]*/, {
        cases: {
          '@keywords': 'keyword',
          '@typeKeywords': 'type',
          '@default': 'identifier',
        }
      }],

      // Strings
      [/"([^"\\]|\\.)*"/, 'string'],
      [/'([^'\\]|\\.)*'/, 'string'],
      [/`([^`\\]|\\.)*`/, 'string'],

      // Numbers
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/\d+/, 'number'],

      // Delimiters
      [/[{}()\[\]]/, 'delimiter.bracket'],
      [/[;,.]/, 'delimiter'],
      [/[=!<>+\-*/%&|^~?:]+/, 'operator'],

      { include: '@whitespace' },
    ],

    tagBody: [
      [/\s+/, 'white'],
      [/(@|v-on:)[a-zA-Z0-9_\-:]+/, 'keyword.directive'],
      [ /(:|v-bind:)[a-zA-Z0-9_\-:]+/, 'keyword.directive' ],
      [/v-[a-zA-Z0-9_\-]+/, 'keyword.directive'],
      [/[a-zA-Z0-9_\-]+/, 'attribute.name'],
      [/=/, 'delimiter'],
      [/"([^"\\]|\\.)*"/, 'string'],
      [/'([^'\\]|\\.)*'/, 'string'],
      [/>/, 'tag', '@pop'],
      [/\/>/, 'tag', '@pop'],
    ],

    scriptTag: [
      [/\s+/, 'white'],
      [/[a-zA-Z0-9_\-]+/, 'attribute.name'],
      [/=/, 'delimiter'],
      [/"([^"\\]|\\.)*"/, 'string'],
      [/'([^'\\]|\\.)*'/, 'string'],
      [/>/, { token: 'tag', next: '@scriptBody' }],
      [/\/>/, { token: 'tag', next: '@pop' }],
    ],

    styleTag: [
      [/\s+/, 'white'],
      [/[a-zA-Z0-9_\-]+/, 'attribute.name'],
      [/=/, 'delimiter'],
      [/"([^"\\]|\\.)*"/, 'string'],
      [/'([^'\\]|\\.)*'/, 'string'],
      [/>/, { token: 'tag', next: '@styleBody' }],
      [/\/>/, { token: 'tag', next: '@pop' }],
    ],

    mustache: [
      [/\}\}/, 'delimiter.bracket', '@pop'],
      [/[a-zA-Z_$][\w$]*(?=\s*\()/, {
        cases: {
          '@keywords': 'keyword',
          '@default': 'function',
        }
      }],
      [/[a-zA-Z_$][\w$]*/, {
        cases: {
          '@keywords': 'keyword',
          '@typeKeywords': 'type',
          '@default': 'identifier',
        }
      }],
      [/"([^"\\]|\\.)*"/, 'string'],
      [/'([^'\\]|\\.)*'/, 'string'],
      [/[0-9]+/, 'number'],
      [/[=!<>+\-*/%&|^~?:]+/, 'operator'],
      [/\s+/, 'white'],
    ],

    scriptBody: [
      [/<\/script\s*>/i, { token: 'tag', next: '@pop' }],
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@commentJs'],
      [/[A-Z_]{2,}\b/, 'constant'],
      [/[a-zA-Z_$][\w$]*(?=\s*\()/, {
        cases: {
          '@keywords': 'keyword',
          '@default': 'function',
        }
      }],
      [/[a-zA-Z_$][\w$]*/, {
        cases: {
          '@keywords': 'keyword',
          '@typeKeywords': 'type',
          '@default': 'identifier',
        }
      }],
      [/"([^"\\]|\\.)*"/, 'string'],
      [/'([^'\\]|\\.)*'/, 'string'],
      [/`/, 'string', '@templateString'],
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/\d+/, 'number'],
      [/[{}()\[\]]/, 'delimiter.bracket'],
      [/[;,.]/, 'delimiter'],
      [/[=!<>+\-*/%&|^~?:]+/, 'operator'],
      { include: '@whitespace' },
    ],

    styleBody: [
      [/<\/style\s*>/i, { token: 'tag', next: '@pop' }],
      [/\/\*/, 'comment', '@commentJs'],
      [/\/\/.*$/, 'comment'],
      [/[a-zA-Z\-]+(?=\s*:)/, 'attribute.name'],
      [/:/, 'delimiter'],
      [/#[0-9a-fA-F]{3,8}/, 'number.hex'],
      [/\d+(\.\d+)?(px|em|rem|%|vh|vw|s|ms|deg)?/, 'number'],
      [/[{}()\[\]]/, 'delimiter.bracket'],
      [/[;,.]/, 'delimiter'],
      [/"([^"\\]|\\.)*"/, 'string'],
      [/'([^'\\]|\\.)*'/, 'string'],
      [/[a-zA-Z0-9_\-\.#]+/, 'tag'],
      { include: '@whitespace' },
    ],

    templateString: [
      [/\$\{/, 'delimiter.bracket', '@templateStringExpression'],
      [/[^\\`$]+/, 'string'],
      [/\\./, 'string.escape'],
      [/`/, 'string', '@pop'],
    ],

    templateStringExpression: [
      [/\}/, 'delimiter.bracket', '@pop'],
      { include: '@scriptBody' },
    ],

    comment: [
      [/[^-]+/, 'comment'],
      [/-->/, 'comment', '@pop'],
      [/[-]/, 'comment']
    ],

    commentJs: [
      [/[^\/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[\/*]/, 'comment']
    ],

    whitespace: [
      [/[ \t\r\n]+/, 'white'],
    ]
  }
};
