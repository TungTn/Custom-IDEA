import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Palette,
  Type,
  AlignLeft,
  Keyboard,
  Terminal,
  Settings,
  FolderTree,
  Database,
  Cpu,
  Download,
  FolderOpen,
  X,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { IdeSettings } from './SettingsModal';
import { IntelliJSettingsService } from '../../services/intellijSettingsService';

interface ExportSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: IdeSettings;
  onSuccessToast: (title: string, message: string) => void;
}

interface ExportItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const EXPORTABLE_COMPONENTS: ExportItem[] = [
  {
    id: 'ui',
    label: 'UI & Theme',
    description: 'Look and feel, window appearance, theme scheme',
    icon: Palette
  },
  {
    id: 'editor',
    label: 'Editor & Fonts',
    description: 'Editor typography, font family, font size, line spacing',
    icon: Type
  },
  {
    id: 'codestyle',
    label: 'Code Style Schemes',
    description: 'Code indent size, tab characters, formatting rules',
    icon: AlignLeft
  },
  {
    id: 'keymap',
    label: 'Keymaps & Shortcuts',
    description: 'Custom keyboard actions and shortcut overrides',
    icon: Keyboard
  },
  {
    id: 'terminal',
    label: 'Terminal Shell',
    description: 'Configured shell path and terminal options',
    icon: Terminal
  },
  {
    id: 'general',
    label: 'System & General',
    description: 'Confirm on exit, project open behavior, start tips',
    icon: Settings
  },
  {
    id: 'projectView',
    label: 'Project View',
    description: 'Compact middle packages, autoscroll from source',
    icon: FolderTree
  },
  {
    id: 'database',
    label: 'Database Tools & SQL',
    description: 'Data editor page size, query row limits, CSV formats',
    icon: Database
  },
  {
    id: 'jdk',
    label: 'Installed SDKs / JDKs',
    description: 'Configured Java toolchains and JDK installations',
    icon: Cpu
  }
];

export const ExportSettingsModal: React.FC<ExportSettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onSuccessToast
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    EXPORTABLE_COMPONENTS.map(c => c.id)
  );
  const [destPath, setDestPath] = useState<string>('settings.zip');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBrowseDest = async () => {
    try {
      const path = await invoke<string | null>('pick_settings_export_path', {
        defaultName: 'settings.zip'
      });
      if (path) {
        setDestPath(path);
      }
    } catch (err: any) {
      setErrorMessage(err?.toString() || 'Failed to select destination path');
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(EXPORTABLE_COMPONENTS.map(c => c.id));
  };

  const handleUnselectAll = () => {
    setSelectedIds([]);
  };

  const handleExport = async () => {
    if (!destPath || selectedIds.length === 0) return;
    setIsExporting(true);
    setErrorMessage(null);

    try {
      // 1. Gather custom JDKs from localStorage
      let customJdks: any[] | undefined;
      try {
        const raw = localStorage.getItem('intellij_custom_jdks');
        if (raw) customJdks = JSON.parse(raw);
      } catch {
        // ignore
      }

      // 2. Gather custom Keymaps from localStorage
      let customKeymap: Record<string, string[]> | undefined;
      try {
        const raw = localStorage.getItem('intellij_custom_keymap');
        if (raw) customKeymap = JSON.parse(raw);
      } catch {
        // ignore
      }

      // 3. Generate XML entries map
      const entries = IntelliJSettingsService.generateExportEntries(
        currentSettings,
        selectedIds,
        customJdks,
        customKeymap
      );

      // 4. Invoke Tauri backend to package ZIP
      await invoke('export_settings_to_zip', {
        zipPath: destPath,
        entries
      });

      onSuccessToast(
        'Settings Exported',
        `Successfully exported ${selectedIds.length} component(s) to ${destPath}`
      );
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.toString() || 'Failed to export settings archive');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-xl bg-[#2B2D30] border border-[#3E4044] rounded-lg shadow-2xl overflow-hidden text-[#DFE1E5] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#26282B] border-b border-[#3E4044]">
          <div className="flex items-center gap-2.5">
            <Download className="w-5 h-5 text-[#3574F0]" />
            <span className="font-semibold text-sm tracking-wide">Export IDE Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#35373B] text-[#9DA0A8] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          
          {/* Destination Path Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#9DA0A8]">Export to File (ZIP):</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={destPath}
                onChange={e => setDestPath(e.target.value)}
                placeholder="Path to settings.zip"
                className="flex-1 px-3 py-1.5 bg-[#1E1F22] border border-[#3E4044] focus:border-[#3574F0] rounded text-xs text-white font-mono outline-none"
              />
              <button
                type="button"
                onClick={handleBrowseDest}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#35373B] hover:bg-[#43454A] border border-[#4E5157] rounded text-xs font-medium text-white transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#3574F0]" />
                Browse...
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 bg-red-950/40 border border-red-800/50 rounded text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Component Selection Toolbar */}
          <div className="flex items-center justify-between text-xs text-[#9DA0A8] mt-1">
            <span>
              Select components to export ({selectedIds.length} of {EXPORTABLE_COMPONENTS.length}):
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="hover:text-white underline cursor-pointer"
              >
                Select All
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleUnselectAll}
                className="hover:text-white underline cursor-pointer"
              >
                Unselect All
              </button>
            </div>
          </div>

          {/* Components Checkbox List */}
          <div className="border border-[#3E4044] rounded-md bg-[#1E1F22] divide-y divide-[#2B2D30] overflow-hidden">
            {EXPORTABLE_COMPONENTS.map(comp => {
              const Icon = comp.icon;
              const isChecked = selectedIds.includes(comp.id);

              return (
                <div
                  key={comp.id}
                  onClick={() => handleToggleSelect(comp.id)}
                  className={`flex items-start gap-3 p-3 transition-colors cursor-pointer ${
                    isChecked
                      ? 'bg-[#2D323B] hover:bg-[#343A45]'
                      : 'hover:bg-[#26282B]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // handled by row click
                    className="mt-0.5 rounded border-[#4E5157] text-[#3574F0] focus:ring-0 focus:ring-offset-0 bg-[#2B2D30] cursor-pointer"
                  />

                  <div className="p-1 rounded bg-[#35373B] text-[#DFE1E5] shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-[#3574F0]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-white">{comp.label}</span>
                    <p className="text-[11px] text-[#868A91] mt-0.5">{comp.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-[#26282B] border-t border-[#3E4044]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#35373B] hover:bg-[#43454A] border border-[#4E5157] rounded text-xs font-medium text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={selectedIds.length === 0 || isExporting || !destPath}
            className="flex items-center gap-2 px-4 py-1.5 bg-[#3574F0] hover:bg-[#4382F7] disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-medium text-white transition-colors shadow-sm"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <span>Export</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
