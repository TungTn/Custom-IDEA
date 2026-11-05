import React, { useState } from 'react';
import { 
  GitMerge, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Edit3, 
  Layers, 
  X, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { RebaseCommitItem } from '../../types';

interface InteractiveRebaseModalProps {
  isOpen: boolean;
  baseCommitHash?: string;
  initialCommits: RebaseCommitItem[];
  onClose: () => void;
  onStartRebase: (commits: RebaseCommitItem[]) => void;
}

export const InteractiveRebaseModal: React.FC<InteractiveRebaseModalProps> = ({
  isOpen,
  baseCommitHash = 'HEAD~3',
  initialCommits,
  onClose,
  onStartRebase,
}) => {
  const [commits, setCommits] = useState<RebaseCommitItem[]>(initialCommits);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editSubject, setEditSubject] = useState('');

  // Sync when initialCommits changes
  React.useEffect(() => {
    if (initialCommits.length > 0) {
      setCommits(initialCommits);
      setSelectedIndex(0);
    }
  }, [initialCommits]);

  if (!isOpen) return null;

  const handleActionChange = (index: number, action: RebaseCommitItem['action']) => {
    setCommits(prev => prev.map((c, i) => i === index ? { ...c, action } : c));
  };

  const moveUp = () => {
    if (selectedIndex <= 0) return;
    setCommits(prev => {
      const next = [...prev];
      const temp = next[selectedIndex];
      next[selectedIndex] = next[selectedIndex - 1];
      next[selectedIndex - 1] = temp;
      return next;
    });
    setSelectedIndex(prev => prev - 1);
  };

  const moveDown = () => {
    if (selectedIndex >= commits.length - 1) return;
    setCommits(prev => {
      const next = [...prev];
      const temp = next[selectedIndex];
      next[selectedIndex] = next[selectedIndex + 1];
      next[selectedIndex + 1] = temp;
      return next;
    });
    setSelectedIndex(prev => prev + 1);
  };

  const startReword = (index: number) => {
    setEditingIndex(index);
    setEditSubject(commits[index].subject);
    handleActionChange(index, 'reword');
  };

  const saveReword = (index: number) => {
    setCommits(prev => prev.map((c, i) => i === index ? { ...c, subject: editSubject.trim() || c.subject } : c));
    setEditingIndex(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-100">
      <div 
        className="w-[720px] bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl overflow-hidden text-[#DFE1E5] font-sans select-none flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="h-9 px-3 bg-[#25272B] border-b border-[#393B40] flex items-center justify-between text-xs font-medium flex-shrink-0">
          <div className="flex items-center gap-2">
            <GitMerge size={14} className="text-[#3574F0]" />
            <span>Interactive Rebase onto {baseCommitHash.substring(0, 10)}</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="h-8 bg-[#222427] border-b border-[#393B40] px-3 flex items-center justify-between text-xs text-[#868A91] flex-shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={moveUp}
              disabled={selectedIndex <= 0}
              title="Move Up (Alt+Up)"
              className="px-2 py-1 rounded hover:bg-[#35373B] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 text-[#DFE1E5] transition-colors cursor-pointer"
            >
              <ArrowUp size={13} />
              <span>Up</span>
            </button>
            <button
              onClick={moveDown}
              disabled={selectedIndex >= commits.length - 1}
              title="Move Down (Alt+Down)"
              className="px-2 py-1 rounded hover:bg-[#35373B] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 text-[#DFE1E5] transition-colors cursor-pointer"
            >
              <ArrowDown size={13} />
              <span>Down</span>
            </button>
            <div className="w-[1px] h-3 bg-[#393B40] mx-1" />
            <button
              onClick={() => handleActionChange(selectedIndex, 'squash')}
              title="Squash into previous commit"
              className="px-2 py-1 rounded hover:bg-[#35373B] flex items-center gap-1 text-[#DFE1E5] transition-colors cursor-pointer"
            >
              <Layers size={13} className="text-[#F1A23A]" />
              <span>Squash</span>
            </button>
            <button
              onClick={() => startReword(selectedIndex)}
              title="Reword commit message"
              className="px-2 py-1 rounded hover:bg-[#35373B] flex items-center gap-1 text-[#DFE1E5] transition-colors cursor-pointer"
            >
              <Edit3 size={13} className="text-[#3574F0]" />
              <span>Reword</span>
            </button>
            <button
              onClick={() => handleActionChange(selectedIndex, 'drop')}
              title="Drop (delete) commit"
              className="px-2 py-1 rounded hover:bg-[#35373B] flex items-center gap-1 text-[#E55353] transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Drop</span>
            </button>
          </div>

          <span className="text-[11px] text-[#868A91]">
            {commits.length} commits in rebase plan
          </span>
        </div>

        {/* Commit List Table */}
        <div className="flex-1 overflow-auto bg-[#1E1F22]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#25272B] sticky top-0 text-[#868A91] border-b border-[#393B40] text-[11px]">
              <tr>
                <th className="py-1.5 px-3 w-28 font-normal">Action</th>
                <th className="py-1.5 px-3 w-24 font-normal">Hash</th>
                <th className="py-1.5 px-3 font-normal">Subject</th>
                <th className="py-1.5 px-3 w-32 font-normal">Author</th>
              </tr>
            </thead>
            <tbody>
              {commits.map((c, idx) => {
                const isSelected = selectedIndex === idx;
                const isEditing = editingIndex === idx;

                const actionColors: Record<string, string> = {
                  pick: 'text-[#59A869]',
                  reword: 'text-[#3574F0]',
                  edit: 'text-[#3574F0]',
                  squash: 'text-[#F1A23A]',
                  fixup: 'text-[#F1A23A]',
                  drop: 'text-[#E55353] line-through',
                };

                return (
                  <tr
                    key={c.hash}
                    onClick={() => setSelectedIndex(idx)}
                    className={`border-b border-[#2B2D30] cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#2E436E] text-white' : 'hover:bg-[#25272B]'
                    }`}
                  >
                    {/* Action Dropdown */}
                    <td className="py-1.5 px-3">
                      <select
                        value={c.action}
                        onChange={(e) => handleActionChange(idx, e.target.value as RebaseCommitItem['action'])}
                        className={`bg-[#2B2D30] border border-[#393B40] rounded px-1.5 py-0.5 text-xs font-mono font-medium outline-none ${actionColors[c.action] || 'text-white'}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="pick">pick</option>
                        <option value="reword">reword</option>
                        <option value="edit">edit</option>
                        <option value="squash">squash</option>
                        <option value="fixup">fixup</option>
                        <option value="drop">drop</option>
                      </select>
                    </td>

                    {/* Hash */}
                    <td className="py-1.5 px-3 font-mono text-[11px] text-[#868A91]">
                      {c.shortHash}
                    </td>

                    {/* Subject (editable if reword) */}
                    <td className="py-1.5 px-3 truncate max-w-xs">
                      {isEditing ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            autoFocus
                            value={editSubject}
                            onChange={(e) => setEditSubject(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveReword(idx);
                              else if (e.key === 'Escape') setEditingIndex(null);
                            }}
                            className="w-full bg-[#1E1F22] border border-[#3574F0] rounded px-2 py-0.5 text-xs text-white outline-none"
                          />
                          <button
                            onClick={() => saveReword(idx)}
                            className="p-1 hover:text-white text-[#59A869]"
                          >
                            <Check size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className={c.action === 'drop' ? 'line-through text-[#868A91]' : ''}>
                          {c.subject}
                        </span>
                      )}
                    </td>

                    {/* Author */}
                    <td className="py-1.5 px-3 text-[#868A91] truncate text-[11px]">
                      {c.author}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer controls */}
        <div className="h-12 bg-[#25272B] border-t border-[#393B40] px-4 flex items-center justify-between text-xs flex-shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-[#868A91]">
            <AlertCircle size={13} className="text-[#3574F0]" />
            <span>Rebase will rewrite commit history of the current branch.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded hover:bg-[#35373B] text-xs text-[#DFE1E5] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onStartRebase(commits);
                onClose();
              }}
              className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#3574F0]/85 text-white font-medium rounded text-xs transition-colors cursor-pointer shadow-sm"
            >
              Start Rebasing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
