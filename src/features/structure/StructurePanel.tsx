import React, { useState, useMemo, useEffect } from 'react';
import { 
  Layers, 
  ArrowDownAZ, 
  Eye, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  X, 
  RefreshCw,
  FolderOpen,
  Code2,
  FileCode,
  SlidersHorizontal,
  ChevronsUpDown,
  ChevronsDownUp
} from 'lucide-react';
import { OpenTab } from '../../types';

export type SymbolKind = 
  | 'class' 
  | 'interface' 
  | 'type' 
  | 'function' 
  | 'method' 
  | 'property' 
  | 'field' 
  | 'enum' 
  | 'enum-member' 
  | 'struct' 
  | 'trait' 
  | 'impl' 
  | 'hook' 
  | 'component'
  | 'constant'
  | 'module';

export type Visibility = 'public' | 'private' | 'protected';

export interface CodeSymbol {
  id: string;
  name: string;
  kind: SymbolKind;
  signature?: string;
  line: number;
  column: number;
  visibility: Visibility;
  children?: CodeSymbol[];
}

interface StructurePanelProps {
  activeTab?: OpenTab;
  onNavigateToLine: (line: number, column: number) => void;
  onClose?: () => void;
}

// Parser for various languages
export function parseSymbols(content: string, language: string = 'plaintext', fileName: string = ''): CodeSymbol[] {
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const symbols: CodeSymbol[] = [];
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const lang = language.toLowerCase();

  const isTypeScriptOrJS = ['typescript', 'javascript', 'tsx', 'jsx'].includes(lang) || 
    ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext);
  const isRust = lang === 'rust' || ext === 'rs';
  const isPython = lang === 'python' || ext === 'py';
  const isJavaOrKotlin = ['java', 'kotlin'].includes(lang) || ['java', 'kt', 'kts'].includes(ext);
  const isGo = lang === 'go' || ext === 'go';
  const isCStyle = ['c', 'cpp', 'csharp'].includes(lang) || ['c', 'cpp', 'h', 'hpp', 'cs'].includes(ext);

  if (isTypeScriptOrJS) {
    // TypeScript & JavaScript parsing
    let currentClass: CodeSymbol | null = null;
    let braceCount = 0;

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmed = lineText.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

      const isExported = /\bexport\b/.test(lineText);
      const isPublic = isExported || /\bpublic\b/.test(lineText) || (!/\bprivate\b/.test(lineText) && !/\bprotected\b/.test(lineText));
      const isPrivate = /\bprivate\b/.test(lineText);
      const isProtected = /\bprotected\b/.test(lineText);
      const visibility: Visibility = isPrivate ? 'private' : isProtected ? 'protected' : 'public';

      // Interfaces
      const ifaceMatch = lineText.match(/(?:export\s+)?interface\s+([A-Za-z0-9_$]+)(?:<[^>]+>)?/);
      if (ifaceMatch) {
        symbols.push({
          id: `sym-${lineNum}-${ifaceMatch[1]}`,
          name: ifaceMatch[1],
          kind: 'interface',
          signature: trimmed.replace(/^{.*/, ''),
          line: lineNum,
          column: lineText.indexOf(ifaceMatch[1]) + 1,
          visibility: isExported ? 'public' : 'private',
        });
        return;
      }

      // Type Aliases
      const typeMatch = lineText.match(/(?:export\s+)?type\s+([A-Za-z0-9_$]+)(?:<[^>]+>)?\s*=/);
      if (typeMatch) {
        symbols.push({
          id: `sym-${lineNum}-${typeMatch[1]}`,
          name: typeMatch[1],
          kind: 'type',
          signature: trimmed.length > 50 ? trimmed.slice(0, 50) + '...' : trimmed,
          line: lineNum,
          column: lineText.indexOf(typeMatch[1]) + 1,
          visibility: isExported ? 'public' : 'private',
        });
        return;
      }

      // Enums
      const enumMatch = lineText.match(/(?:export\s+)?enum\s+([A-Za-z0-9_$]+)/);
      if (enumMatch) {
        symbols.push({
          id: `sym-${lineNum}-${enumMatch[1]}`,
          name: enumMatch[1],
          kind: 'enum',
          signature: 'enum',
          line: lineNum,
          column: lineText.indexOf(enumMatch[1]) + 1,
          visibility: isExported ? 'public' : 'private',
        });
        return;
      }

      // Classes
      const classMatch = lineText.match(/(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)(?:\s+extends\s+[A-Za-z0-9_$.]+)?(?:\s+implements\s+[A-Za-z0-9_$,\s]+)?/);
      if (classMatch) {
        const classSym: CodeSymbol = {
          id: `sym-${lineNum}-${classMatch[1]}`,
          name: classMatch[1],
          kind: 'class',
          signature: trimmed.replace(/\{.*/, '').trim(),
          line: lineNum,
          column: lineText.indexOf(classMatch[1]) + 1,
          visibility: isExported ? 'public' : 'private',
          children: []
        };
        symbols.push(classSym);
        currentClass = classSym;
        return;
      }

      // Inside class methods/fields
      if (currentClass) {
        const methodMatch = lineText.match(/^\s*(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:async\s+)?([A-Za-z0-9_$]+)\s*\(([^)]*)\)(?::\s*([^{]+))?/);
        if (methodMatch && !['if', 'for', 'while', 'switch', 'catch'].includes(methodMatch[1])) {
          const mVis: Visibility = lineText.includes('private') ? 'private' : lineText.includes('protected') ? 'protected' : 'public';
          currentClass.children = currentClass.children || [];
          currentClass.children.push({
            id: `sym-${lineNum}-${methodMatch[1]}`,
            name: methodMatch[1],
            kind: 'method',
            signature: `(${methodMatch[2] || ''})${methodMatch[3] ? ': ' + methodMatch[3].trim() : ''}`,
            line: lineNum,
            column: lineText.indexOf(methodMatch[1]) + 1,
            visibility: mVis,
          });
          return;
        }
      }

      // React Hooks: const useXYZ = (...) => ...
      const hookMatch = lineText.match(/(?:export\s+)?const\s+(use[A-Z0-9_$]+)\s*=\s*(?:\([^)]*\)|function)/);
      if (hookMatch) {
        symbols.push({
          id: `sym-${lineNum}-${hookMatch[1]}`,
          name: hookMatch[1],
          kind: 'hook',
          signature: 'Hook',
          line: lineNum,
          column: lineText.indexOf(hookMatch[1]) + 1,
          visibility,
        });
        return;
      }

      // React Component: const MyComp: React.FC = ... or function MyComp(...)
      const compMatch = lineText.match(/(?:export\s+)?const\s+([A-Z][A-Za-z0-9_$]+)(?:\s*:\s*React\.FC(?:<[^>]+>)?)?\s*=/);
      if (compMatch) {
        symbols.push({
          id: `sym-${lineNum}-${compMatch[1]}`,
          name: compMatch[1],
          kind: 'component',
          signature: 'React Component',
          line: lineNum,
          column: lineText.indexOf(compMatch[1]) + 1,
          visibility,
        });
        return;
      }

      // Function Declarations: function myFunc(...)
      const funcMatch = lineText.match(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)(?::\s*([^{]+))?/);
      if (funcMatch) {
        const isComp = /^[A-Z]/.test(funcMatch[1]);
        symbols.push({
          id: `sym-${lineNum}-${funcMatch[1]}`,
          name: funcMatch[1],
          kind: isComp ? 'component' : 'function',
          signature: `(${funcMatch[2] || ''})${funcMatch[3] ? ': ' + funcMatch[3].trim() : ''}`,
          line: lineNum,
          column: lineText.indexOf(funcMatch[1]) + 1,
          visibility,
        });
        return;
      }

      // Arrow functions: const myFunc = (...) => ...
      const arrowMatch = lineText.match(/(?:export\s+)?(?:const|let)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)(?:\s*:\s*([^=]+))?\s*=>/);
      if (arrowMatch) {
        symbols.push({
          id: `sym-${lineNum}-${arrowMatch[1]}`,
          name: arrowMatch[1],
          kind: 'function',
          signature: `(${arrowMatch[2] || ''})${arrowMatch[3] ? ': ' + arrowMatch[3].trim() : ''}`,
          line: lineNum,
          column: lineText.indexOf(arrowMatch[1]) + 1,
          visibility,
        });
        return;
      }

      // Constants
      const constMatch = lineText.match(/(?:export\s+)?const\s+([A-Z0-9_]{3,})\b/);
      if (constMatch) {
        symbols.push({
          id: `sym-${lineNum}-${constMatch[1]}`,
          name: constMatch[1],
          kind: 'constant',
          signature: 'constant',
          line: lineNum,
          column: lineText.indexOf(constMatch[1]) + 1,
          visibility,
        });
        return;
      }
    });

  } else if (isRust) {
    // Rust parsing
    let currentImpl: CodeSymbol | null = null;

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmed = lineText.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

      const isPub = trimmed.startsWith('pub ');
      const visibility: Visibility = isPub ? 'public' : 'private';

      // struct
      const structMatch = lineText.match(/(?:pub(?:\([^)]+\))?\s+)?struct\s+([A-Za-z0-9_]+)/);
      if (structMatch) {
        symbols.push({
          id: `sym-${lineNum}-${structMatch[1]}`,
          name: structMatch[1],
          kind: 'struct',
          signature: 'struct',
          line: lineNum,
          column: lineText.indexOf(structMatch[1]) + 1,
          visibility,
        });
        return;
      }

      // enum
      const enumMatch = lineText.match(/(?:pub(?:\([^)]+\))?\s+)?enum\s+([A-Za-z0-9_]+)/);
      if (enumMatch) {
        symbols.push({
          id: `sym-${lineNum}-${enumMatch[1]}`,
          name: enumMatch[1],
          kind: 'enum',
          signature: 'enum',
          line: lineNum,
          column: lineText.indexOf(enumMatch[1]) + 1,
          visibility,
        });
        return;
      }

      // trait
      const traitMatch = lineText.match(/(?:pub(?:\([^)]+\))?\s+)?trait\s+([A-Za-z0-9_]+)/);
      if (traitMatch) {
        symbols.push({
          id: `sym-${lineNum}-${traitMatch[1]}`,
          name: traitMatch[1],
          kind: 'trait',
          signature: 'trait',
          line: lineNum,
          column: lineText.indexOf(traitMatch[1]) + 1,
          visibility,
        });
        return;
      }

      // impl block
      const implMatch = lineText.match(/impl(?:<[^>]+>)?\s+(?:([A-Za-z0-9_:]+)\s+for\s+)?([A-Za-z0-9_:]+)/);
      if (implMatch) {
        const implName = implMatch[1] ? `${implMatch[1]} for ${implMatch[2]}` : implMatch[2];
        const implSym: CodeSymbol = {
          id: `sym-${lineNum}-${implName}`,
          name: `impl ${implName}`,
          kind: 'impl',
          signature: 'impl block',
          line: lineNum,
          column: lineText.indexOf('impl') + 1,
          visibility: 'public',
          children: []
        };
        symbols.push(implSym);
        currentImpl = implSym;
        return;
      }

      // functions / methods
      const fnMatch = lineText.match(/(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*->\s*([^{]+))?/);
      if (fnMatch) {
        const fnName = fnMatch[1];
        const sig = `(${fnMatch[2] || ''})${fnMatch[3] ? ' -> ' + fnMatch[3].trim() : ''}`;
        const sym: CodeSymbol = {
          id: `sym-${lineNum}-${fnName}`,
          name: fnName,
          kind: currentImpl ? 'method' : 'function',
          signature: sig,
          line: lineNum,
          column: lineText.indexOf(fnName) + 1,
          visibility,
        };

        if (currentImpl && (lineText.startsWith('    ') || lineText.startsWith('\t'))) {
          currentImpl.children = currentImpl.children || [];
          currentImpl.children.push(sym);
        } else {
          symbols.push(sym);
        }
        return;
      }

      // modules
      const modMatch = lineText.match(/(?:pub\s+)?mod\s+([A-Za-z0-9_]+);/);
      if (modMatch) {
        symbols.push({
          id: `sym-${lineNum}-${modMatch[1]}`,
          name: modMatch[1],
          kind: 'module',
          signature: 'mod',
          line: lineNum,
          column: lineText.indexOf(modMatch[1]) + 1,
          visibility,
        });
        return;
      }
    });

  } else if (isPython) {
    // Python parsing
    let currentClass: CodeSymbol | null = null;

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmed = lineText.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const isClass = trimmed.startsWith('class ');
      const isDef = trimmed.startsWith('def ') || trimmed.startsWith('async def ');

      if (isClass) {
        const clsMatch = trimmed.match(/^class\s+([A-Za-z0-9_]+)(?:\(([^)]*)\))?:/);
        if (clsMatch) {
          const clsSym: CodeSymbol = {
            id: `sym-${lineNum}-${clsMatch[1]}`,
            name: clsMatch[1],
            kind: 'class',
            signature: clsMatch[2] ? `(${clsMatch[2]})` : 'class',
            line: lineNum,
            column: lineText.indexOf(clsMatch[1]) + 1,
            visibility: clsMatch[1].startsWith('_') ? 'private' : 'public',
            children: []
          };
          symbols.push(clsSym);
          currentClass = clsSym;
          return;
        }
      }

      if (isDef) {
        const defMatch = trimmed.match(/^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
        if (defMatch) {
          const name = defMatch[1];
          const isPriv = name.startsWith('_');
          const isMethod = lineText.startsWith('    ') || lineText.startsWith('\t');
          const sig = `(${defMatch[2] || ''})${defMatch[3] ? ' -> ' + defMatch[3].trim() : ''}`;

          const sym: CodeSymbol = {
            id: `sym-${lineNum}-${name}`,
            name,
            kind: isMethod ? 'method' : 'function',
            signature: sig,
            line: lineNum,
            column: lineText.indexOf(name) + 1,
            visibility: isPriv ? 'private' : 'public',
          };

          if (isMethod && currentClass) {
            currentClass.children = currentClass.children || [];
            currentClass.children.push(sym);
          } else {
            symbols.push(sym);
          }
        }
      }
    });

  } else if (isJavaOrKotlin) {
    // Java & Kotlin parsing
    let currentClass: CodeSymbol | null = null;

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmed = lineText.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

      const isPub = trimmed.includes('public ');
      const isPriv = trimmed.includes('private ');
      const isProt = trimmed.includes('protected ');
      const visibility: Visibility = isPriv ? 'private' : isProt ? 'protected' : 'public';

      // class / interface / enum
      const clsMatch = lineText.match(/(?:public|private|protected)?\s*(?:abstract|final|static)?\s*(class|interface|enum)\s+([A-Za-z0-9_]+)/);
      if (clsMatch) {
        const kind: SymbolKind = clsMatch[1] === 'interface' ? 'interface' : clsMatch[1] === 'enum' ? 'enum' : 'class';
        const clsSym: CodeSymbol = {
          id: `sym-${lineNum}-${clsMatch[2]}`,
          name: clsMatch[2],
          kind,
          signature: trimmed.replace(/\{.*/, '').trim(),
          line: lineNum,
          column: lineText.indexOf(clsMatch[2]) + 1,
          visibility,
          children: []
        };
        symbols.push(clsSym);
        currentClass = clsSym;
        return;
      }

      // method
      const methodMatch = lineText.match(/(?:public|private|protected)?\s*(?:static|final|synchronized|override)?\s*(?:fun\s+)?([A-Za-z0-9_<>[\]]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
      if (methodMatch && !['if', 'for', 'while', 'switch'].includes(methodMatch[2])) {
        const name = methodMatch[2];
        const retType = methodMatch[1];
        const sym: CodeSymbol = {
          id: `sym-${lineNum}-${name}`,
          name,
          kind: 'method',
          signature: `(${methodMatch[3] || ''}): ${retType}`,
          line: lineNum,
          column: lineText.indexOf(name) + 1,
          visibility,
        };

        if (currentClass) {
          currentClass.children = currentClass.children || [];
          currentClass.children.push(sym);
        } else {
          symbols.push(sym);
        }
      }
    });

  } else if (isGo) {
    // Go parsing
    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmed = lineText.trim();
      if (!trimmed || trimmed.startsWith('//')) return;

      // type Struct / Interface
      const typeMatch = lineText.match(/^type\s+([A-Za-z0-9_]+)\s+(struct|interface)/);
      if (typeMatch) {
        const isPublic = /^[A-Z]/.test(typeMatch[1]);
        symbols.push({
          id: `sym-${lineNum}-${typeMatch[1]}`,
          name: typeMatch[1],
          kind: typeMatch[2] === 'struct' ? 'struct' : 'interface',
          signature: typeMatch[2],
          line: lineNum,
          column: lineText.indexOf(typeMatch[1]) + 1,
          visibility: isPublic ? 'public' : 'private',
        });
        return;
      }

      // func
      const funcMatch = lineText.match(/^func\s+(?:\(([^)]+)\)\s+)?([A-Za-z0-9_]+)\s*\(([^)]*)\)(?:\s*([^{]+))?/);
      if (funcMatch) {
        const receiver = funcMatch[1];
        const name = funcMatch[2];
        const isPublic = /^[A-Z]/.test(name);
        const sig = `${receiver ? `(${receiver}) ` : ''}(${funcMatch[3] || ''})${funcMatch[4] ? ' ' + funcMatch[4].trim() : ''}`;
        symbols.push({
          id: `sym-${lineNum}-${name}`,
          name,
          kind: receiver ? 'method' : 'function',
          signature: sig,
          line: lineNum,
          column: lineText.indexOf(name) + 1,
          visibility: isPublic ? 'public' : 'private',
        });
      }
    });

  } else if (isCStyle) {
    // C / C++
    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmed = lineText.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

      const structMatch = lineText.match(/^(?:class|struct)\s+([A-Za-z0-9_]+)/);
      if (structMatch) {
        symbols.push({
          id: `sym-${lineNum}-${structMatch[1]}`,
          name: structMatch[1],
          kind: lineText.startsWith('class') ? 'class' : 'struct',
          signature: trimmed.replace(/\{.*/, ''),
          line: lineNum,
          column: lineText.indexOf(structMatch[1]) + 1,
          visibility: 'public',
        });
        return;
      }

      const fnMatch = lineText.match(/^([A-Za-z0-9_&*]+)\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(?:const)?\s*(?:\{|;)/);
      if (fnMatch && !['if', 'while', 'for', 'switch'].includes(fnMatch[2])) {
        symbols.push({
          id: `sym-${lineNum}-${fnMatch[2]}`,
          name: fnMatch[2],
          kind: 'function',
          signature: `(${fnMatch[3] || ''}): ${fnMatch[1]}`,
          line: lineNum,
          column: lineText.indexOf(fnMatch[2]) + 1,
          visibility: 'public',
        });
      }
    });
  }

  return symbols;
}

// IntelliJ Icon Badge Component
const SymbolBadge: React.FC<{ kind: SymbolKind; visibility: Visibility }> = ({ kind, visibility }) => {
  let letter = 'f';
  let bgColor = 'bg-[#3574F0]';
  let title = 'Symbol';

  switch (kind) {
    case 'class':
      letter = 'C';
      bgColor = 'bg-[#3574F0]'; // Blue
      title = 'Class';
      break;
    case 'interface':
      letter = 'I';
      bgColor = 'bg-[#59A869]'; // Green
      title = 'Interface';
      break;
    case 'type':
      letter = 'T';
      bgColor = 'bg-[#299999]'; // Teal
      title = 'Type Alias';
      break;
    case 'struct':
      letter = 'S';
      bgColor = 'bg-[#E8833A]'; // Orange
      title = 'Struct';
      break;
    case 'enum':
    case 'enum-member':
      letter = 'E';
      bgColor = 'bg-[#E0B050]'; // Yellow
      title = 'Enum';
      break;
    case 'trait':
      letter = 'Tr';
      bgColor = 'bg-[#40B6E0]'; // Cyan
      title = 'Trait';
      break;
    case 'impl':
      letter = 'impl';
      bgColor = 'bg-[#6B7280]'; // Slate
      title = 'Implementation';
      break;
    case 'method':
      letter = 'm';
      bgColor = 'bg-[#B37BEB]'; // Purple
      title = 'Method';
      break;
    case 'function':
      letter = 'f';
      bgColor = 'bg-[#9876AA]'; // Indigo / purple
      title = 'Function';
      break;
    case 'hook':
      letter = 'h';
      bgColor = 'bg-[#EC4899]'; // Pink
      title = 'React Hook';
      break;
    case 'component':
      letter = '⚛';
      bgColor = 'bg-[#0EA5E9]'; // React Sky Blue
      title = 'React Component';
      break;
    case 'property':
    case 'field':
      letter = 'p';
      bgColor = 'bg-[#4F8FD9]'; // Soft Blue
      title = 'Property';
      break;
    case 'constant':
      letter = 'c';
      bgColor = 'bg-[#64748B]';
      title = 'Constant';
      break;
    case 'module':
      letter = 'M';
      bgColor = 'bg-[#8B5CF6]';
      title = 'Module';
      break;
    default:
      letter = '•';
      bgColor = 'bg-[#6B7280]';
      title = 'Symbol';
  }

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0" title={`${visibility} ${title}`}>
      <div className={`w-4 h-4 rounded text-[10px] font-bold text-white flex items-center justify-center leading-none ${bgColor} shadow-sm`}>
        {letter}
      </div>
      {/* Visibility marker */}
      {visibility === 'private' && (
        <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#E55353] border border-[#1E1F22]" title="Private" />
      )}
      {visibility === 'protected' && (
        <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#E5A93C] border border-[#1E1F22]" title="Protected" />
      )}
      {visibility === 'public' && (
        <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#59A869] border border-[#1E1F22]" title="Public" />
      )}
    </div>
  );
};

export const StructurePanel: React.FC<StructurePanelProps> = ({
  activeTab,
  onNavigateToLine,
  onClose,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [sortAlpha, setSortAlpha] = useState(false);
  const [publicOnly, setPublicOnly] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Parse symbols from activeTab content
  const rawSymbols = useMemo(() => {
    if (!activeTab || !activeTab.content) return [];
    return parseSymbols(activeTab.content, activeTab.language, activeTab.title);
  }, [activeTab?.content, activeTab?.language, activeTab?.title]);

  // Initial expand all top nodes that have children
  useEffect(() => {
    const initialMap: Record<string, boolean> = {};
    rawSymbols.forEach(s => {
      if (s.children && s.children.length > 0) {
        initialMap[s.id] = true;
      }
    });
    setExpandedNodes(initialMap);
  }, [rawSymbols]);

  // Filter & Sort
  const processedSymbols = useMemo(() => {
    let list = [...rawSymbols];

    const filterSymbol = (sym: CodeSymbol): CodeSymbol | null => {
      if (publicOnly && sym.visibility !== 'public') {
        return null;
      }

      const matchQuery = !filterQuery || 
        sym.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        (sym.signature && sym.signature.toLowerCase().includes(filterQuery.toLowerCase()));

      let filteredChildren: CodeSymbol[] = [];
      if (sym.children && sym.children.length > 0) {
        filteredChildren = sym.children
          .map(filterSymbol)
          .filter((c): c is CodeSymbol => c !== null);
      }

      if (matchQuery || filteredChildren.length > 0) {
        return {
          ...sym,
          children: filteredChildren.length > 0 ? filteredChildren : sym.children
        };
      }

      return null;
    };

    list = list.map(filterSymbol).filter((s): s is CodeSymbol => s !== null);

    if (sortAlpha) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [rawSymbols, filterQuery, sortAlpha, publicOnly]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const map: Record<string, boolean> = {};
    const recurse = (items: CodeSymbol[]) => {
      items.forEach(i => {
        if (i.children && i.children.length > 0) {
          map[i.id] = true;
          recurse(i.children);
        }
      });
    };
    recurse(rawSymbols);
    setExpandedNodes(map);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  const handleSelectSymbol = (sym: CodeSymbol) => {
    setSelectedId(sym.id);
    onNavigateToLine(sym.line, sym.column);
  };

  const renderSymbolRow = (sym: CodeSymbol, depth: number = 0) => {
    const hasChildren = sym.children && sym.children.length > 0;
    const isExpanded = Boolean(expandedNodes[sym.id]);
    const isSelected = selectedId === sym.id;

    return (
      <div key={sym.id} className="flex flex-col select-none">
        <div 
          onClick={() => handleSelectSymbol(sym)}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className={`group flex items-center gap-1.5 h-6 text-xs cursor-pointer rounded-sm pr-2 transition-colors ${
            isSelected 
              ? 'bg-[#2E436E] text-white font-medium' 
              : 'text-[#DFE1E5] hover:bg-[#2B2D30]/80'
          }`}
          title={`${sym.name} (Line ${sym.line})`}
        >
          {/* Chevron for expandable */}
          {hasChildren ? (
            <button 
              onClick={(e) => toggleExpand(sym.id, e)}
              className="w-3.5 h-3.5 flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5]"
            >
              {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          ) : (
            <span className="w-3.5" />
          )}

          {/* Symbol Icon Badge */}
          <SymbolBadge kind={sym.kind} visibility={sym.visibility} />

          {/* Symbol Name */}
          <span className="truncate font-mono font-medium text-[11.5px]">
            {sym.name}
          </span>

          {/* Signature / Details */}
          {sym.signature && sym.signature !== 'class' && sym.signature !== 'struct' && (
            <span className="truncate text-[#868A91] text-[10.5px] font-mono opacity-80 max-w-[120px]">
              {sym.signature}
            </span>
          )}

          {/* Line number hint on hover */}
          <span className="ml-auto text-[10px] text-[#6E7278] font-mono opacity-0 group-hover:opacity-100 transition-opacity">
            :{sym.line}
          </span>
        </div>

        {/* Children nodes */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {sym.children!.map(child => renderSymbolRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full bg-[#1E1F22] flex flex-col overflow-hidden text-[#DFE1E5] border-r border-[#2B2D30] select-none">
      {/* Header bar */}
      <div className="h-8 px-2.5 bg-[#2B2D30]/60 border-b border-[#2B2D30] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1.5 truncate">
          <Layers size={13} className="text-[#3574F0] flex-shrink-0" />
          <span className="font-semibold text-xs tracking-wide text-[#DFE1E5]">Structure</span>
          {activeTab && (
            <span className="text-[11px] text-[#868A91] truncate font-mono">
              — {activeTab.title}
            </span>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-0.5">
          <button 
            onClick={() => setSortAlpha(prev => !prev)}
            title={sortAlpha ? "Sort Alphabetically (Active)" : "Sort by Name (A-Z)"}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
              sortAlpha ? 'bg-[#3574F0] text-white' : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B]'
            }`}
          >
            <ArrowDownAZ size={13} />
          </button>

          <button 
            onClick={() => setPublicOnly(prev => !prev)}
            title={publicOnly ? "Show Public Only (Active)" : "Filter: Show Public Members Only (+)"}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors text-xs font-bold cursor-pointer ${
              publicOnly ? 'bg-[#3574F0] text-white' : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B]'
            }`}
          >
            +
          </button>

          <button 
            onClick={expandAll}
            title="Expand All"
            className="w-6 h-6 rounded flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B] transition-colors cursor-pointer"
          >
            <ChevronsUpDown size={12} />
          </button>

          <button 
            onClick={collapseAll}
            title="Collapse All"
            className="w-6 h-6 rounded flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B] transition-colors cursor-pointer"
          >
            <ChevronsDownUp size={12} />
          </button>

          {onClose && (
            <button 
              onClick={onClose}
              title="Hide Structure Window"
              className="w-6 h-6 rounded flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#35373B] transition-colors cursor-pointer ml-0.5"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Filter Search Bar */}
      <div className="p-1.5 border-b border-[#2B2D30] bg-[#1E1F22]">
        <div className="relative flex items-center">
          <Search size={12} className="absolute left-2 text-[#868A91] pointer-events-none" />
          <input 
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter symbols..."
            className="w-full bg-[#2B2D30] text-[#DFE1E5] text-[11px] rounded pl-7 pr-6 py-1 border border-transparent focus:border-[#3574F0] focus:outline-none placeholder-[#6E7278]"
          />
          {filterQuery && (
            <button 
              onClick={() => setFilterQuery('')}
              className="absolute right-1.5 text-[#868A91] hover:text-[#DFE1E5]"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-[#35373B] scrollbar-track-transparent">
        {!activeTab ? (
          <div className="p-4 text-center text-[#868A91] text-xs flex flex-col items-center gap-2 mt-8">
            <FileCode size={28} className="opacity-40" />
            <span>No file open</span>
            <span className="text-[10px] text-[#6E7278]">Open a file to inspect its structure outline</span>
          </div>
        ) : processedSymbols.length === 0 ? (
          <div className="p-4 text-center text-[#868A91] text-xs flex flex-col items-center gap-2 mt-8">
            <Code2 size={28} className="opacity-40" />
            <span>
              {filterQuery ? 'No matching symbols' : 'No symbols found'}
            </span>
            <span className="text-[10px] text-[#6E7278]">
              {filterQuery ? `No symbols match "${filterQuery}"` : 'This file has no detectable classes, functions or types'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col py-0.5">
            {processedSymbols.map(sym => renderSymbolRow(sym, 0))}
          </div>
        )}
      </div>

      {/* Bottom status badge */}
      {activeTab && (
        <div className="h-5 px-2 bg-[#2B2D30]/40 border-t border-[#2B2D30] flex items-center justify-between text-[10px] text-[#868A91] flex-shrink-0 font-mono">
          <span>{processedSymbols.length} symbol{processedSymbols.length !== 1 ? 's' : ''}</span>
          <span className="text-[9px] uppercase tracking-wider text-[#6E7278]">{activeTab.language}</span>
        </div>
      )}
    </div>
  );
};
