import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { MenuItem } from '../types/menu';

interface MenuDropdownProps {
  items: MenuItem[];
  onSelectAction: (actionId: string) => void;
  onClose: () => void;
  isSubmenu?: boolean;
}

export const MenuDropdown: React.FC<MenuDropdownProps> = ({
  items,
  onSelectAction,
  onClose,
  isSubmenu = false,
}) => {
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);
  const [flipLeft, setFlipLeft] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const submenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (dropdownRef.current && isSubmenu) {
      const rect = dropdownRef.current.getBoundingClientRect();
      if (rect.right > window.innerWidth - 10) {
        setFlipLeft(true);
      }
    }
  }, [isSubmenu]);

  const handleMouseEnterItem = (item: MenuItem) => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
      submenuTimeoutRef.current = null;
    }
    if (item.children && item.children.length > 0) {
      setActiveSubmenuId(item.id);
    } else {
      setActiveSubmenuId(null);
    }
  };

  const handleMouseLeaveItem = () => {
    submenuTimeoutRef.current = setTimeout(() => {
      setActiveSubmenuId(null);
    }, 250);
  };

  return (
    <div 
      ref={dropdownRef}
      onMouseDown={(e) => e.stopPropagation()}
      data-tauri-drag-region="false"
      className={`min-w-[260px] max-w-[320px] bg-[#2B2D30] border border-[#43454A] rounded-md shadow-2xl py-1 text-[12.5px] select-none z-50 animate-in fade-in duration-75 ${
        isSubmenu 
          ? (flipLeft ? 'absolute right-full top-[-4px] -mr-1' : 'absolute left-full top-[-4px] -ml-1')
          : 'absolute left-0 top-full mt-0.5'
      }`}
    >
      {items.map((item) => {
        if (item.isSeparator) {
          return <div key={item.id} className="h-[1px] bg-[#393B40] my-1 mx-2" />;
        }

        const Icon = item.icon;
        const hasChildren = Boolean(item.children && item.children.length > 0);
        const isSubmenuOpen = activeSubmenuId === item.id;
        const isChecked = item.checked;

        return (
          <div
            key={item.id}
            className="relative px-1"
            onMouseEnter={() => handleMouseEnterItem(item)}
            onMouseLeave={handleMouseLeaveItem}
          >
            <div
              onClick={() => {
                if (item.disabled) return;
                if (hasChildren) return;
                if (item.actionId) {
                  onSelectAction(item.actionId);
                }
                onClose();
              }}
              className={`group flex items-center justify-between px-2.5 py-1 rounded-[4px] cursor-pointer transition-colors ${
                item.disabled 
                  ? 'text-[#5A5D63] cursor-not-allowed' 
                  : isSubmenuOpen 
                    ? 'bg-[#3574F0] text-white' 
                    : 'text-[#DFE1E5] hover:bg-[#3574F0] hover:text-white'
              }`}
            >
              {/* Left: Icon or Checkmark & Label */}
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  {isChecked ? (
                    <Check size={14} className="text-[#3574F0] group-hover:text-white stroke-[2.5]" />
                  ) : Icon ? (
                    <Icon size={14} className="text-[#868A91] group-hover:text-white" />
                  ) : null}
                </div>
                <span className="truncate">{item.label}</span>
              </div>

              {/* Right: Shortcut or Submenu arrow */}
              <div className="flex items-center gap-2 pl-3 flex-shrink-0">
                {item.shortcut && (
                  <span className="text-[11px] text-[#868A91] group-hover:text-white/85 tracking-tight font-mono">
                    {item.shortcut}
                  </span>
                )}
                {hasChildren && (
                  <ChevronRight size={13} className="text-[#868A91] group-hover:text-white" />
                )}
              </div>
            </div>

            {/* Submenu Dropdown */}
            {hasChildren && isSubmenuOpen && item.children && (
              <MenuDropdown
                items={item.children}
                onSelectAction={onSelectAction}
                onClose={onClose}
                isSubmenu={true}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

