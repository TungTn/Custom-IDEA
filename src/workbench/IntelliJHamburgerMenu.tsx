import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { MenuCategoryName, MenuItem } from '../types/menu';

interface IntelliJHamburgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (actionId: string) => void;
  menus: MenuCategoryName[];
  getMenuItems: (category: MenuCategoryName) => MenuItem[];
}

interface FlyoutSubmenuProps {
  items: MenuItem[];
  onSelectAction: (actionId: string) => void;
  onClose: () => void;
}

const FlyoutSubmenu: React.FC<FlyoutSubmenuProps> = ({ items, onSelectAction, onClose }) => {
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (item: MenuItem) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (item.children && item.children.length > 0) {
      setActiveChildId(item.id);
    } else {
      setActiveChildId(null);
    }
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveChildId(null);
    }, 200);
  };

  return (
    <div 
      className="absolute left-full top-[-4px] ml-1 min-w-[250px] max-w-[320px] bg-[#2B2D30] border border-[#43454A] rounded-md shadow-[0_16px_40px_rgba(0,0,0,0.7)] py-1.5 px-1 text-[12.5px] select-none z-50 animate-in fade-in duration-75"
      onMouseEnter={() => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }}
    >
      {items.map((item) => {
        if (item.isSeparator) {
          return <div key={item.id} className="h-[1px] bg-[#393B40] my-1 mx-2" />;
        }

        const Icon = item.icon;
        const hasChildren = Boolean(item.children && item.children.length > 0);
        const isOpenSub = activeChildId === item.id;
        const isChecked = item.checked;

        return (
          <div
            key={item.id}
            className="relative"
            onMouseEnter={() => handleMouseEnter(item)}
            onMouseLeave={handleMouseLeave}
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
                  : isOpenSub
                  ? 'bg-[#3574F0] text-white'
                  : 'text-[#DFE1E5] hover:bg-[#3574F0] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  {isChecked ? (
                    <Check size={13} className="text-[#3574F0] group-hover:text-white stroke-[2.5]" />
                  ) : Icon ? (
                    <Icon size={14} className={`${isOpenSub ? 'text-white' : 'text-[#868A91] group-hover:text-white'}`} />
                  ) : null}
                </div>
                <span className="truncate">{item.label}</span>
              </div>

              <div className="flex items-center gap-2 pl-2 flex-shrink-0">
                {item.shortcut && (
                  <span className={`text-[11px] font-mono ${isOpenSub ? 'text-white/90' : 'text-[#868A91] group-hover:text-white/85'}`}>
                    {item.shortcut}
                  </span>
                )}
                {hasChildren && (
                  <ChevronRight size={12} className={isOpenSub ? 'text-white' : 'text-[#868A91] group-hover:text-white'} />
                )}
              </div>
            </div>

            {hasChildren && isOpenSub && item.children && (
              <FlyoutSubmenu
                items={item.children}
                onSelectAction={onSelectAction}
                onClose={onClose}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export const IntelliJHamburgerMenu: React.FC<IntelliJHamburgerMenuProps> = ({
  isOpen,
  onClose,
  onSelectAction,
  menus,
  getMenuItems,
}) => {
  const [activeCategory, setActiveCategory] = useState<MenuCategoryName>('File');
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const childTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Reset to File when opened
  useEffect(() => {
    if (isOpen) {
      setActiveCategory('File');
      setActiveChildId(null);
    }
  }, [isOpen]);

  const handleMouseEnterChild = (item: MenuItem) => {
    if (childTimeoutRef.current) {
      clearTimeout(childTimeoutRef.current);
      childTimeoutRef.current = null;
    }
    if (item.children && item.children.length > 0) {
      setActiveChildId(item.id);
    } else {
      setActiveChildId(null);
    }
  };

  const handleMouseLeaveChild = () => {
    childTimeoutRef.current = setTimeout(() => {
      setActiveChildId(null);
    }, 200);
  };

  if (!isOpen) return null;

  const currentCategoryItems = getMenuItems(activeCategory);

  return (
    <div
      ref={menuContainerRef}
      className="absolute left-0 top-full mt-1 flex bg-[#2B2D30] border border-[#43454A] rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.75)] select-none z-50 animate-in fade-in zoom-in-95 duration-100"
      style={{ minHeight: '380px' }}
    >
      {/* ─── COLUMN 1: Categories (Left Panel) ─── */}
      <div className="w-[110px] bg-[#26282B] border-r border-[#393B40] py-1.5 px-1 flex flex-col gap-0.5 rounded-l-md">
        {menus.map((menu) => {
          const isSelected = activeCategory === menu;
          return (
            <button
              key={menu}
              onMouseEnter={() => {
                setActiveCategory(menu);
                setActiveChildId(null);
              }}
              className={`w-full text-left px-2.5 py-1 rounded-[4px] cursor-pointer transition-colors text-[12.5px] font-normal ${
                isSelected
                  ? 'bg-[#3574F0] text-white font-medium'
                  : 'text-[#DFE1E5] hover:bg-[#35373B] hover:text-white'
              }`}
            >
              {menu}
            </button>
          );
        })}
      </div>

      {/* ─── COLUMN 2: Submenu items for Active Category (Right Panel) ─── */}
      <div 
        className="w-[285px] max-h-[82vh] overflow-y-auto py-1.5 px-1 flex flex-col gap-0.5 rounded-r-md"
        onMouseEnter={() => {
          if (childTimeoutRef.current) {
            clearTimeout(childTimeoutRef.current);
            childTimeoutRef.current = null;
          }
        }}
      >
        {currentCategoryItems.map((item) => {
          if (item.isSeparator) {
            return <div key={item.id} className="h-[1px] bg-[#393B40] my-1 mx-2" />;
          }

          const Icon = item.icon;
          const hasChildren = Boolean(item.children && item.children.length > 0);
          const isHoveredOrOpen = activeChildId === item.id;
          const isChecked = item.checked;

          return (
            <div
              key={item.id}
              className="relative"
              onMouseEnter={() => handleMouseEnterChild(item)}
              onMouseLeave={handleMouseLeaveChild}
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
                    : isHoveredOrOpen
                    ? 'bg-[#3574F0] text-white'
                    : 'text-[#DFE1E5] hover:bg-[#3574F0] hover:text-white'
                }`}
              >
                {/* Left: Icon or Checkmark & Label */}
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    {isChecked ? (
                      <Check size={13} className="text-[#3574F0] group-hover:text-white stroke-[2.5]" />
                    ) : Icon ? (
                      <Icon 
                        size={14} 
                        className={isHoveredOrOpen ? 'text-white' : 'text-[#868A91] group-hover:text-white'} 
                      />
                    ) : null}
                  </div>
                  <span className="truncate">{item.label}</span>
                </div>

                {/* Right: Shortcut or Submenu arrow */}
                <div className="flex items-center gap-2 pl-2 flex-shrink-0">
                  {item.shortcut && (
                    <span 
                      className={`text-[11px] font-mono tracking-tight ${
                        isHoveredOrOpen ? 'text-white/90' : 'text-[#868A91] group-hover:text-white/85'
                      }`}
                    >
                      {item.shortcut}
                    </span>
                  )}
                  {hasChildren && (
                    <ChevronRight 
                      size={12} 
                      className={isHoveredOrOpen ? 'text-white' : 'text-[#868A91] group-hover:text-white'} 
                    />
                  )}
                </div>
              </div>

              {/* ─── COLUMN 3: Flyout Sub-submenu for Nested Items (e.g. New >, Recent Projects >) ─── */}
              {hasChildren && isHoveredOrOpen && item.children && (
                <FlyoutSubmenu
                  items={item.children}
                  onSelectAction={onSelectAction}
                  onClose={onClose}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};