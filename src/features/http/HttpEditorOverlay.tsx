import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { HttpBlockDto } from '../../bindings';
import { Play, Loader2, Globe, Send } from 'lucide-react';

interface HttpEditorOverlayProps {
  content: string;
  onRunBlock: (blockId: string) => void;
  runningBlockId: string | null;
}

export const HttpEditorOverlay: React.FC<HttpEditorOverlayProps> = ({
  content,
  onRunBlock,
  runningBlockId,
}) => {
  const [blocks, setBlocks] = useState<HttpBlockDto[]>([]);

  useEffect(() => {
    let isMounted = true;
    invoke<HttpBlockDto[]>('http_parse_file', { content })
      .then((parsed) => {
        if (isMounted) setBlocks(parsed);
      })
      .catch((err) => {
        console.warn('Failed to parse HTTP file blocks:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [content]);

  if (blocks.length === 0) {
    return (
      <div className="h-7 bg-[#25272B] border-b border-[#2B2D30] px-3 flex items-center gap-2 text-xs text-[#868A91]">
        <Globe size={13} className="text-[#3574F0]" />
        <span>HTTP Client Editor: Add <code className="text-[#DFE1E5]">GET https://...</code> to execute requests.</span>
      </div>
    );
  }

  const getMethodBadge = (method: string) => {
    const m = method.toUpperCase();
    if (m === 'GET') return 'bg-[#59A869]/20 text-[#59A869] border-[#59A869]/40';
    if (m === 'POST') return 'bg-[#3574F0]/20 text-[#3574F0] border-[#3574F0]/40';
    if (m === 'PUT') return 'bg-[#EDA200]/20 text-[#EDA200] border-[#EDA200]/40';
    if (m === 'DELETE') return 'bg-[#E06C75]/20 text-[#E06C75] border-[#E06C75]/40';
    return 'bg-[#A8ADBD]/20 text-[#A8ADBD] border-[#A8ADBD]/40';
  };

  return (
    <div className="h-8 bg-[#25272B] border-b border-[#2B2D30] px-3 flex items-center justify-between overflow-x-auto text-xs flex-shrink-0 select-none">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-[#868A91] font-medium mr-2">
          <Send size={12} className="text-[#3574F0]" />
          <span>Requests ({blocks.length}):</span>
        </div>

        {blocks.map((b) => {
          const isRunning = runningBlockId === b.id;
          return (
            <button
              key={b.id}
              onClick={() => onRunBlock(b.id)}
              disabled={isRunning}
              title={`Run ${b.method} ${b.url} (Line ${b.startLine})`}
              className={`px-2 py-0.5 rounded border flex items-center gap-1.5 font-mono text-[11px] transition-all cursor-pointer ${
                isRunning
                  ? 'bg-[#3574F0]/20 text-[#3574F0] border-[#3574F0]/50'
                  : 'bg-[#2B2D30] hover:bg-[#323438] text-[#DFE1E5] border-[#393B40]'
              }`}
            >
              {isRunning ? (
                <Loader2 size={11} className="animate-spin text-[#3574F0]" />
              ) : (
                <Play size={10} className="fill-[#59A869] text-[#59A869]" />
              )}
              <span className={`px-1 rounded text-[9px] font-bold border ${getMethodBadge(b.method)}`}>
                {b.method}
              </span>
              <span className="truncate max-w-[160px] text-[#A1A3AB]">
                {b.name || b.url.replace(/^https?:\/\//, '')}
              </span>
              <span className="text-[10px] text-[#6F737A]">L{b.startLine}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
