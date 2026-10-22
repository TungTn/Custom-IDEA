import React, { useState } from 'react';
import { Layers, X, Play } from 'lucide-react';

interface RunConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAndRun: (config: { name: string; command: string; args: string }) => void;
}

export const RunConfigModal: React.FC<RunConfigModalProps> = ({
  isOpen,
  onClose,
  onSaveAndRun,
}) => {
  const [name, setName] = useState('Desktop IDE');
  const [command, setCommand] = useState('cargo run');
  const [args, setArgs] = useState('--package intellij-idea-clone');
  const [workDir, setWorkDir] = useState('D:\\IDE');

  if (!isOpen) return null;

  const handleRun = () => {
    onSaveAndRun({ name, command, args });
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[500px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-10 border-b border-[#393B40] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#DFE1E5]">
            <Layers size={15} className="text-[#3574F0]" />
            <span>Run / Debug Configurations</span>
          </div>
          <button onClick={onClose} className="p-0.5 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5]">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5 text-xs text-[#DFE1E5]">
          <div>
            <label className="text-[11px] text-[#868A91] block mb-1">Configuration Name:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-[#868A91] block mb-1">Build / Run Command:</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-[#868A91] block mb-1">Arguments:</label>
            <input
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-[#868A91] block mb-1">Working Directory:</label>
            <input
              type="text"
              value={workDir}
              onChange={(e) => setWorkDir(e.target.value)}
              className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-xs text-[#DFE1E5] font-mono outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="h-11 bg-[#26282E] border-t border-[#393B40] px-4 flex items-center justify-end gap-2 text-xs">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B]"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B] border border-[#393B40]"
          >
            Apply
          </button>
          <button
            onClick={handleRun}
            className="px-3.5 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-medium flex items-center gap-1.5"
          >
            <Play size={12} className="fill-white" />
            <span>Apply & Run</span>
          </button>
        </div>
      </div>
    </div>
  );
};
