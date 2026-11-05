import React, { useMemo } from 'react';
import { ChevronRight, FileCode, Tag, Code, Box, GitBranch } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  kind: 'file' | 'tag' | 'class' | 'function' | 'block';
  line?: number;
}

interface EditorBreadcrumbsProps {
  filePath: string;
  content: string;
  currentLine: number;
  onNavigateToLine: (line: number) => void;
}

export const EditorBreadcrumbs: React.FC<EditorBreadcrumbsProps> = ({
  filePath,
  content,
  currentLine,
  onNavigateToLine,
}) => {
  const fileName = useMemo(() => {
    return filePath.split(/[\\/]/).pop() || 'Untitled';
  }, [filePath]);

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [
      { label: fileName, kind: 'file', line: 1 },
    ];

    if (!content || currentLine < 1) return items;

    const lines = content.split('\n');
    const clampedLine = Math.min(currentLine, lines.length);

    let activeTag: string | null = null;
    let activeTagLine = 1;
    let activeFunction: string | null = null;
    let activeFunctionLine = 1;
    let activeBlock: string | null = null;
    let activeBlockLine = 1;

    // Scan upward from currentLine to top
    for (let i = 0; i < clampedLine; i++) {
      const lineText = lines[i].trim();

      // Vue/HTML Tags
      if (lineText.startsWith('<template')) {
        activeTag = '<template>';
        activeTagLine = i + 1;
      } else if (lineText.startsWith('<script')) {
        activeTag = '<script>';
        activeTagLine = i + 1;
      } else if (lineText.startsWith('<style')) {
        activeTag = '<style>';
        activeTagLine = i + 1;
      }

      // Class or Interface
      const classMatch = /^(?:export\s+)?(?:default\s+)?(?:class|interface)\s+([a-zA-Z0-9_$]+)/.exec(lineText);
      if (classMatch) {
        activeFunction = classMatch[1];
        activeFunctionLine = i + 1;
      }

      // Function, Method, Arrow Function
      const fnMatch =
        /^(?:export\s+)?(?:async\s+)?(?:function\*?\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>|([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{)/.exec(
          lineText
        );
      if (fnMatch) {
        const name = fnMatch[1] || fnMatch[2] || fnMatch[3];
        if (name && !['if', 'for', 'while', 'switch', 'catch'].includes(name)) {
          activeFunction = `${name}()`;
          activeFunctionLine = i + 1;
        }
      }

      // Control blocks
      if (i === clampedLine - 1 || i >= clampedLine - 5) {
        if (lineText.startsWith('if ') || lineText.startsWith('if(')) {
          activeBlock = 'if (...)';
          activeBlockLine = i + 1;
        } else if (lineText.startsWith('for ') || lineText.startsWith('for(')) {
          activeBlock = 'for (...)';
          activeBlockLine = i + 1;
        } else if (lineText.startsWith('try {') || lineText.startsWith('try{')) {
          activeBlock = 'try {...}';
          activeBlockLine = i + 1;
        }
      }
    }

    if (activeTag) {
      items.push({ label: activeTag, kind: 'tag', line: activeTagLine });
    }
    if (activeFunction) {
      items.push({ label: activeFunction, kind: 'function', line: activeFunctionLine });
    }
    if (activeBlock && activeBlockLine !== activeFunctionLine) {
      items.push({ label: activeBlock, kind: 'block', line: activeBlockLine });
    }

    return items;
  }, [fileName, content, currentLine]);

  const renderKindIcon = (kind: BreadcrumbItem['kind']) => {
    switch (kind) {
      case 'file':
        return <FileCode size={12} className="text-[#3574F0] flex-shrink-0" />;
      case 'tag':
        return <Tag size={11} className="text-[#E8BF6A] flex-shrink-0" />;
      case 'function':
        return <Code size={11} className="text-[#FFC66D] flex-shrink-0" />;
      case 'class':
        return <Box size={11} className="text-[#A9B7C6] flex-shrink-0" />;
      case 'block':
        return <GitBranch size={11} className="text-[#868A91] flex-shrink-0" />;
    }
  };

  return (
    <div className="h-[22px] bg-[#1E1F22] border-t border-[#2B2D30] px-2 flex items-center gap-1 text-[11px] text-[#868A91] overflow-x-auto select-none no-scrollbar font-mono">
      {breadcrumbs.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <ChevronRight size={11} className="text-[#55585E] flex-shrink-0" />}
          <button
            onClick={() => {
              if (item.line) {
                onNavigateToLine(item.line);
              }
            }}
            className="flex items-center gap-1 hover:text-[#DFE1E5] hover:bg-[#2B2D30] px-1 py-0.5 rounded transition-colors cursor-pointer group whitespace-nowrap"
          >
            {renderKindIcon(item.kind)}
            <span className="group-hover:underline">{item.label}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};
