import React, { useState } from 'react';
import { X, AlertTriangle, Save, FolderGit2, ExternalLink, Layers } from 'lucide-react';
import { FileNode } from '../../types';

export interface OpenProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetProject: FileNode | null;
  currentProjectName: string;
  hasRunningProcess: boolean;
  dirtyFiles: string[];
  onOpenThisWindow: (target: FileNode) => void;
  onOpenNewWindow: (target: FileNode) => void;
  onAttachProject: (target: FileNode) => void;
}

export const OpenProjectDialog: React.FC<OpenProjectDialogProps> = ({
  isOpen,
  onClose,
  targetProject,
  currentProjectName,
  hasRunningProcess,
  dirtyFiles,
  onOpenThisWindow,
  onOpenNewWindow,
  onAttachProject,
}) => {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  if (!isOpen || !targetProject) return null;

  const handleThisWindow = () => {
    if (dontAskAgain) {
      localStorage.setItem('ij_project_open_mode', 'this_window');
    }
    onOpenThisWindow(targetProject);
    onClose();
  };

  const handleNewWindow = () => {
    if (dontAskAgain) {
      localStorage.setItem('ij_project_open_mode', 'new_window');
    }
    onOpenNewWindow(targetProject);
    onClose();
  };

  const handleAttach = () => {
    onAttachProject(targetProject);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[540px] bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl flex flex-col overflow-hidden text-[#DFE1E5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="h-9 bg-[#26282B] border-b border-[#393B40] flex items-center justify-between px-3.5">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#3574F0] flex items-center justify-center text-[10px] font-bold text-white">
              IJ
            </div>
            <span className="text-[12.5px] font-medium text-[#DFE1E5]">Open Project</span>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Dialog Content */}
        <div className="p-5 space-y-4 text-[12.5px]">
          {/* Main Question */}
          <div className="space-y-1">
            <div className="text-[13px] text-[#DFE1E5] font-normal leading-relaxed">
              Open project <span className="font-semibold text-white">"{targetProject.name}"</span> in this window or open it in a new window?
            </div>
            <div className="text-[11.5px] text-[#868A91] font-mono truncate bg-[#1E1F22] px-2 py-1 rounded border border-[#393B40]/60">
              {targetProject.path}
            </div>
          </div>

          {/* Running Process Alert */}
          {hasRunningProcess && (
            <div className="bg-[#593800]/30 border border-[#F5A623]/40 rounded p-2.5 flex items-start gap-2.5 text-[#F5A623]">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <div className="text-[12px] leading-snug">
                <span className="font-semibold">Process is running:</span> A task is currently running in <span className="font-semibold">"{currentProjectName}"</span>. Opening in this window will terminate the process.
              </div>
            </div>
          )}

          {/* Unsaved Changes Alert */}
          {dirtyFiles.length > 0 && (
            <div className="bg-[#1C3B5E]/40 border border-[#3574F0]/40 rounded p-2.5 flex items-start gap-2.5 text-[#8AB4F8]">
              <Save size={16} className="flex-shrink-0 mt-0.5" />
              <div className="text-[12px] leading-snug">
                <span className="font-semibold">Unsaved files:</span> There are unsaved changes in{' '}
                <span className="font-semibold text-white">{dirtyFiles.join(', ')}</span>. Files will be auto-saved before switching.
              </div>
            </div>
          )}

          {/* Don't ask again Checkbox */}
          <div className="pt-1 flex items-center gap-2">
            <input
              type="checkbox"
              id="dont-ask"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="accent-[#3574F0] rounded cursor-pointer"
            />
            <label htmlFor="dont-ask" className="text-[12px] text-[#868A91] cursor-pointer hover:text-[#DFE1E5]">
              Remember, don't ask again
            </label>
          </div>
        </div>

        {/* Buttons (IntelliJ style: This Window, New Window, Attach, Cancel) */}
        <div className="bg-[#26282B] border-t border-[#393B40] px-4 py-3 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={handleThisWindow}
            className="px-3.5 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded-[4px] font-medium shadow-sm transition-colors flex items-center gap-1.5"
          >
            <FolderGit2 size={13} />
            <span>This Window</span>
          </button>

          <button
            type="button"
            onClick={handleNewWindow}
            className="px-3.5 py-1.5 bg-[#35373B] hover:bg-[#3E4146] text-[#DFE1E5] rounded-[4px] font-medium transition-colors border border-[#43454A] flex items-center gap-1.5"
          >
            <ExternalLink size={13} />
            <span>New Window</span>
          </button>

          <button
            type="button"
            onClick={handleAttach}
            className="px-3.5 py-1.5 bg-[#35373B] hover:bg-[#3E4146] text-[#DFE1E5] rounded-[4px] font-medium transition-colors border border-[#43454A] flex items-center gap-1.5"
            title="Attach to current project as secondary module"
          >
            <Layers size={13} />
            <span>Attach</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] rounded-[4px] transition-colors ml-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
