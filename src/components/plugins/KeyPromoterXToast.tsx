import React, { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';

export interface KeyPromoterItem {
  id: string;
  actionName: string;
  shortcut: string;
  count: number;
}

interface KeyPromoterXToastProps {
  item: KeyPromoterItem | null;
  onDismiss: () => void;
  onDisable?: () => void;
}

export const KeyPromoterXToast: React.FC<KeyPromoterXToastProps> = ({
  item,
  onDismiss,
  onDisable
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (item) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 200);
      }, 4200);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [item, onDismiss]);

  if (!item || !isVisible) return null;

  return (
    <div className="fixed bottom-10 right-6 z-50 animate-in slide-in-from-bottom-3 fade-in duration-200 select-none">
      <div className="bg-[#2B2D30] border-2 border-[#3574F0] text-[#DFE1E5] rounded-lg shadow-2xl p-3 w-80 flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#393B40] pb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Keyboard size={14} className="text-[#3574F0]" />
            <span>Key Promoter X</span>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onDismiss, 200);
            }}
            className="text-[#868A91] hover:text-white p-0.5 rounded transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="text-xs space-y-1.5">
          <div className="text-[#868A91]">
            Mouse clicked: <span className="text-white font-medium">{item.actionName}</span>
          </div>
          <div className="flex items-center justify-between bg-[#1E1F22] px-2.5 py-1.5 rounded border border-[#393B40]">
            <span className="text-[11px] text-[#868A91]">Shortcut:</span>
            <kbd className="px-2 py-0.5 bg-[#3574F0]/20 border border-[#3574F0] text-[#3574F0] font-mono text-xs font-bold rounded shadow-sm">
              {item.shortcut}
            </kbd>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-[#868A91] pt-1">
          <span>Missed shortcut: {item.count} time{item.count > 1 ? 's' : ''}</span>
          {onDisable && (
            <button
              onClick={onDisable}
              className="hover:underline hover:text-[#DFE1E5]"
            >
              Don't show
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
