import React from 'react';

interface NyanProgressBarProps {
  progress?: number; // 0 to 100, undefined for indeterminate
  label?: string;
  className?: string;
}

export const NyanProgressBar: React.FC<NyanProgressBarProps> = ({
  progress,
  label = 'Processing...',
  className = ''
}) => {
  const isIndeterminate = progress === undefined;

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {label && <span className="text-[11px] text-[#DFE1E5] font-mono whitespace-nowrap">{label}</span>}
      <div className="relative w-40 h-4 bg-[#1E1F22] border border-[#393B40] rounded overflow-hidden flex items-center">
        {/* Rainbow Trail */}
        <div 
          className="h-full flex flex-col justify-between"
          style={{ 
            width: isIndeterminate ? '70%' : `${Math.min(100, Math.max(10, progress))}%`,
            animation: isIndeterminate ? 'nyanWave 1.2s infinite ease-in-out' : undefined
          }}
        >
          <div className="h-[2px] bg-[#E55353]" />
          <div className="h-[2px] bg-[#F1A23A]" />
          <div className="h-[2px] bg-[#FFFF55]" />
          <div className="h-[2px] bg-[#59A869]" />
          <div className="h-[2px] bg-[#3574F0]" />
          <div className="h-[2px] bg-[#9D5BD2]" />
        </div>

        {/* Nyan Cat Sprite */}
        <div 
          className="absolute -top-0.5 text-xs select-none transition-all duration-300"
          style={{ 
            left: isIndeterminate ? '65%' : `calc(${Math.min(92, Math.max(5, progress || 0))}% - 8px)`,
            animation: isIndeterminate ? 'nyanBounce 0.4s infinite alternate ease-in-out' : undefined
          }}
          title="Nyan Cat"
        >
          🐱✨
        </div>
      </div>
      {!isIndeterminate && (
        <span className="text-[10px] text-[#868A91] font-mono">{Math.round(progress)}%</span>
      )}
    </div>
  );
};
