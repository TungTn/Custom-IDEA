import React from 'react';
import { IdeSettings, KeymapActionItem } from '../SettingsModal';
import { LiveTemplate } from '../../../editor/cm/snippetEngine';

export interface SettingPanelProps {
  selectedId: string;
  formSettings: IdeSettings;
  updateSetting: <K extends keyof IdeSettings>(key: K, value: IdeSettings[K]) => void;
  setFormSettings: React.Dispatch<React.SetStateAction<IdeSettings>>;
  setIsDirty: (dirty: boolean) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onOpenThemeStudio?: () => void;
  setSelectedId?: (id: string) => void;
  // Keymap specific state & handlers
  keymaps?: KeymapActionItem[];
  setKeymaps?: React.Dispatch<React.SetStateAction<KeymapActionItem[]>>;
  keymapProfile?: 'windows' | 'macos' | 'vscode' | 'eclipse' | 'netbeans';
  setKeymapProfile?: React.Dispatch<React.SetStateAction<'windows' | 'macos' | 'vscode' | 'eclipse' | 'netbeans'>>;
  // Live templates
  liveTemplates?: LiveTemplate[];
  setLiveTemplates?: React.Dispatch<React.SetStateAction<LiveTemplate[]>>;
  // Toolchain
  toolchainData?: any;
}
