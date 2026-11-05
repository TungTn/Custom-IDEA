import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { unifiedMergeView } from '@codemirror/merge';
import { darculaTheme } from './cm/darculaTheme';

interface CmDiffViewerProps {
  originalContent: string;
  modifiedContent: string;
  filePath?: string;
}

export const CmDiffViewer: React.FC<CmDiffViewerProps> = ({
  originalContent,
  modifiedContent,
  filePath,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const state = EditorState.create({
      doc: modifiedContent,
      extensions: [
        lineNumbers(),
        darculaTheme,
        EditorState.readOnly.of(true),
        unifiedMergeView({
          original: originalContent,
          highlightChanges: true,
          gutter: true,
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [originalContent, modifiedContent]);

  return (
    <div className="w-full h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5]">
      {filePath && (
        <div className="px-4 py-2 bg-[#2B2D30] border-b border-[#1E1F22] text-xs font-mono text-[#A8ADBD]">
          Comparing: {filePath}
        </div>
      )}
      <div ref={containerRef} className="flex-1 overflow-auto" />
    </div>
  );
};
