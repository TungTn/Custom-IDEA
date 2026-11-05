import { LucideIcon } from 'lucide-react';

export interface MenuItem {
  id: string;
  label?: string;
  shortcut?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  isSeparator?: boolean;
  children?: MenuItem[];
  actionId?: string;
  checked?: boolean;
}

export type MenuCategoryName = 
  | 'File' 
  | 'Edit' 
  | 'View' 
  | 'Navigate' 
  | 'Code' 
  | 'Refactor' 
  | 'Build' 
  | 'Run' 
  | 'Tools' 
  | 'Git' 
  | 'Window'
  | 'Help';

export type MenuRegistry = Record<MenuCategoryName, MenuItem[]>;
