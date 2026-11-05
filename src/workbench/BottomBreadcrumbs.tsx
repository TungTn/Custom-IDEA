import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Folder, 
  FileCode, 
  ChevronRight, 
  FileText, 
  Layers, 
  Component as ComponentIcon,
  FolderOpen
} from 'lucide-react';
import { FileNode } from '../types';

export interface BottomBreadcrumbsProps {
  filePath?: string;
  projectName?: string;
  projectTree?: FileNode[];
  onSelectFile?: (file: FileNode) => void;
}

interface BreadcrumbSegment {
  label: string;
  relativePath: string;
  isFolder: boolean;
  isRoot?: boolean;
}

export const BottomBreadcrumbs: React.FC<BottomBreadcrumbsProps> = ({
  filePath = '',
  projectName = '',
  projectTree = [],
  onSelectFile,
}) => {
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Auto-close dropdown when clicking outside
  useEffect(() => {
    if (activeSegmentIndex === null) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setActiveSegmentIndex(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [activeSegmentIndex]);

  // Parse filePath into breadcrumb segments
  const segments = useMemo<BreadcrumbSegment[]>(() => {
    if (!filePath) return [];
    
    // Normalize path separators
    const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const rawParts = normalized.split('/').filter(Boolean);
    if (rawParts.length === 0) return [];

    const rootName = projectName || rawParts[0] || 'project';
    const result: BreadcrumbSegment[] = [];

    // Root project segment
    result.push({
      label: rootName,
      relativePath: '',
      isFolder: true,
      isRoot: true,
    });

    let accumulated = '';
    // Skip first part if it's identical to rootName
    const partsToProcess = rawParts[0].toLowerCase() === rootName.toLowerCase() 
      ? rawParts.slice(1) 
      : rawParts;

    partsToProcess.forEach((part, idx) => {
      accumulated = accumulated ? `${accumulated}/${part}` : part;
      const isLast = idx === partsToProcess.length - 1;
      result.push({
        label: part,
        relativePath: accumulated,
        isFolder: !isLast,
      });
    });

    return result;
  }, [filePath, projectName]);

  // Find children of a specific relative path within projectTree
  const getChildrenForPath = (relPath: string): FileNode[] => {
    if (!projectTree || projectTree.length === 0) return [];
    if (!relPath) {
      return projectTree;
    }

    const normTarget = relPath.replace(/\\/g, '/').toLowerCase();

    // Depth-first search to find node matching normTarget
    const search = (nodes: FileNode[]): FileNode[] | null => {
      for (const node of nodes) {
        const nodeNorm = (node.path || node.name).replace(/\\/g, '/').toLowerCase();
        if (nodeNorm === normTarget || nodeNorm.endsWith('/' + normTarget)) {
          return node.children || [];
        }
        if (node.children && node.children.length > 0) {
          const found = search(node.children);
          if (found !== null) return found;
        }
      }
      return null;
    };

    const result = search(projectTree);
    return result || [];
  };

  const getFileIcon = (fileName: string, isFolder: boolean) => {
    if (isFolder) {
      return <Folder size={12} className="text-[#E0A055] fill-[#E0A055]/20 flex-shrink-0" />;
    }
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'vue':
        return <span className="text-[#42B883] font-bold text-[10px] leading-none flex-shrink-0">V</span>;
      case 'ts':
      case 'tsx':
        return <span className="text-[#3574F0] font-bold text-[10px] leading-none flex-shrink-0">TS</span>;
      case 'js':
      case 'jsx':
        return <span className="text-[#F7DF1E] font-bold text-[10px] leading-none flex-shrink-0">JS</span>;
      case 'css':
      case 'scss':
      case 'less':
        return <span className="text-[#42A5F5] font-bold text-[10px] leading-none flex-shrink-0">#</span>;
      case 'json':
        return <span className="text-[#E0A055] font-bold text-[10px] leading-none flex-shrink-0">{}</span>;
      default:
        return <FileText size={12} className="text-[#868A91] flex-shrink-0" />;
    }
  };

  if (segments.length === 0) {
    return null;
  }

  const activeSegment = activeSegmentIndex !== null ? segments[activeSegmentIndex] : null;
  const activeChildren = activeSegment ? getChildrenForPath(activeSegment.relativePath) : [];

  return (
    <div className="flex items-center gap-0.5 text-[11px] text-[#868A91] select-none font-sans overflow-x-auto no-scrollbar py-0.5 relative">
      <span className="text-[#4E5157] mr-1 text-[10px]">•</span>
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        const isActive = activeSegmentIndex === idx;

        return (
          <div key={`${seg.relativePath}-${idx}`} className="flex items-center flex-shrink-0 relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Allow opening dropdown for folders to see sibling/child contents
                if (seg.isFolder) {
                  setActiveSegmentIndex(prev => prev === idx ? null : idx);
                }
              }}
              className={`flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer transition-colors max-w-[200px] truncate ${
                isActive 
                  ? 'bg-[#3574F0] text-white font-medium' 
                  : isLast 
                    ? 'text-[#DFE1E5] font-medium hover:bg-[#35373B]' 
                    : 'hover:text-[#DFE1E5] hover:bg-[#35373B]'
              }`}
              title={seg.relativePath ? `Path: ${seg.relativePath}` : projectName || 'Root'}
            >
              {seg.isRoot ? (
                <FolderOpen size={11} className="text-[#56A8F5] flex-shrink-0" />
              ) : seg.isFolder ? (
                <Folder size={11} className="text-[#CF8E6D] flex-shrink-0" />
              ) : (
                getFileIcon(seg.label, false)
              )}
              <span className="truncate">{seg.label}</span>
            </button>

            {!isLast && (
              <ChevronRight size={10} className="text-[#4E5157] mx-0.5 flex-shrink-0" />
            )}

            {/* Dropdown Popup displaying sibling & child files/folders */}
            {isActive && (
              <div 
                ref={popupRef}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-full left-0 mb-1.5 w-60 max-h-72 bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl py-1 z-50 text-xs text-[#DFE1E5] overflow-y-auto font-sans animate-in fade-in duration-100"
              >
                <div className="px-2.5 py-1 text-[10px] font-semibold text-[#868A91] uppercase tracking-wider border-b border-[#393B40] flex items-center justify-between">
                  <span className="truncate">{seg.label}</span>
                  <span className="text-[9px] opacity-70 lowercase">{activeChildren.length} items</span>
                </div>

                <div className="py-1">
                  {activeChildren.length > 0 ? (
                    activeChildren
                      .sort((a, b) => {
                        // Folders first, then alphabetical
                        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
                        return a.name.localeCompare(b.name);
                      })
                      .map((child) => (
                        <div
                          key={child.id || child.path || child.name}
                          onClick={() => {
                            setActiveSegmentIndex(null);
                            if (child.isFolder) {
                              // If folder, can open folder or no-op
                            } else {
                              onSelectFile?.(child);
                            }
                          }}
                          className={`w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-[#3574F0] hover:text-white cursor-pointer transition-colors text-left ${
                            child.path === filePath ? 'bg-[#3574F0]/30 text-white font-medium' : ''
                          }`}
                        >
                          {getFileIcon(child.name, child.isFolder)}
                          <span className="truncate flex-1">{child.name}</span>
                          {child.path === filePath && (
                            <span className="text-[10px] text-[#59A869]">active</span>
                          )}
                        </div>
                      ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-[#868A91] italic">
                      No items in this directory
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
