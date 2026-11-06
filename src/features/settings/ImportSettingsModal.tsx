import React, { useState, useCallback } from 'react';
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
  Hammer,
  FileArchive,
  FolderOpen,
  Check,
  X,
  Upload,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { IdeSettings } from './SettingsModal';
import {
  IntelliJSettingsService,
  ComponentOption,
  ImportedSettingsResult
} from '../../services/intellijSettingsService';

interface ImportSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: IdeSettings;
  onApplyImport: (result: ImportedSettingsResult) => void;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  ui: Palette,
  editor: Type,
  codestyle: AlignLeft,
  keymap: Keyboard,
  terminal: Terminal,
  general: Settings,
  projectView: FolderTree,
  database: Database,
  jdk: Cpu,
  maven: Hammer,
};

export const ImportSettingsModal: React.FC<ImportSettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onApplyImport
}) => {
  const [sourcePath, setSourcePath] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rawEntries, setRawEntries] = useState<Record<string, string> | null>(null);
  const [components, setComponents] = useState<ComponentOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Open File dialog to pick .zip/.jar
  const handlePickFile = async () => {
    try {
      setErrorMessage(null);
      const filePath = await invoke<string | null>('pick_settings_file');
      if (filePath) {
        await loadSettingsFromPath(filePath);
      }
    } catch (err: any) {
      setErrorMessage(err?.toString() || 'Failed to select archive file');
    }
  };

  // Open Folder dialog to pick options or parent directory
  const handlePickFolder = async () => {
    try {
      setErrorMessage(null);
      const folderPath = await invoke<string | null>('pick_settings_folder');
      if (folderPath) {
        await loadSettingsFromPath(folderPath);
      }
    } catch (err: any) {
      setErrorMessage(err?.toString() || 'Failed to select settings directory');
    }
  };

  // Load and parse archive or folder
  const loadSettingsFromPath = async (path: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSourcePath(path);
    try {
      const entries = await invoke<Record<string, string>>('read_settings_from_zip_or_folder', {
        sourcePath: path
      });

      if (!entries || Object.keys(entries).length === 0) {
        setErrorMessage('No valid XML settings found in the selected file or folder.');
        setRawEntries(null);
        setComponents([]);
        setSelectedIds([]);
        return;
      }

      setRawEntries(entries);
      const analyzed = IntelliJSettingsService.analyzeImportedEntries(entries);
      setComponents(analyzed);
      // Auto-select all present components by default
      const presentIds = analyzed.filter(c => c.present).map(c => c.id);
      setSelectedIds(presentIds);
    } catch (err: any) {
      setErrorMessage(err?.toString() || 'Failed to read settings from target');
      setRawEntries(null);
      setComponents([]);
      setSelectedIds([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const presentIds = components.filter(c => c.present).map(c => c.id);
    setSelectedIds(presentIds);
  };

  const handleUnselectAll = () => {
    setSelectedIds([]);
  };

  const handleImportSubmit = useCallback(() => {
    if (!rawEntries || selectedIds.length === 0) return;

    try {
      const result = IntelliJSettingsService.parseSelectedComponents(
        selectedIds,
        rawEntries,
        currentSettings
      );
      onApplyImport(result);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.toString() || 'Failed to apply selected settings');
    }
  }, [rawEntries, selectedIds, currentSettings, onApplyImport, onClose]);

  if (!isOpen) return null;

  const presentCount = components.filter(c => c.present).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-2xl bg-[#2B2D30] border border-[#3E4044] rounded-lg shadow-2xl overflow-hidden text-[#DFE1E5] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#26282B] border-b border-[#3E4044]">
          <div className="flex items-center gap-2.5">
            <Upload className="w-5 h-5 text-[#3574F0]" />
            <span className="font-semibold text-sm tracking-wide">Import IDE Settings</span>
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
          
          {/* Source Selection Buttons */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-[#9DA0A8]">Select Settings Source:</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePickFile}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#35373B] hover:bg-[#43454A] border border-[#4E5157] rounded text-xs font-medium text-white transition-all shadow-sm active:scale-[0.99]"
              >
                <FileArchive className="w-4 h-4 text-[#3574F0]" />
                Select Archive (.zip / .jar)
              </button>
              <button
                type="button"
                onClick={handlePickFolder}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#35373B] hover:bg-[#43454A] border border-[#4E5157] rounded text-xs font-medium text-white transition-all shadow-sm active:scale-[0.99]"
              >
                <FolderOpen className="w-4 h-4 text-[#E8A838]" />
                Select Folder (options/)
              </button>
            </div>

            {/* Display Selected Path */}
            {sourcePath && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1E1F22] border border-[#3E4044] rounded text-xs text-[#A8ADBD] font-mono break-all">
                <span className="text-[#3574F0] font-semibold">Source:</span>
                <span className="truncate">{sourcePath}</span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 bg-red-950/40 border border-red-800/50 rounded text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-[#9DA0A8]">
              <Loader2 className="w-6 h-6 animate-spin text-[#3574F0]" />
              <span className="text-xs">Analyzing settings archive...</span>
            </div>
          )}

          {/* Components List */}
          {!isLoading && components.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs text-[#9DA0A8]">
                <span>
                  Select components to import ({selectedIds.length} of {presentCount} available):
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

              <div className="border border-[#3E4044] rounded-md bg-[#1E1F22] divide-y divide-[#2B2D30] overflow-hidden">
                {components.map(comp => {
                  const Icon = CATEGORY_ICONS[comp.id] || Settings;
                  const isChecked = selectedIds.includes(comp.id);
                  const isPresent = comp.present;

                  return (
                    <div
                      key={comp.id}
                      onClick={() => isPresent && handleToggleSelect(comp.id)}
                      className={`flex items-start gap-3 p-3 transition-colors ${
                        !isPresent
                          ? 'opacity-40 cursor-not-allowed bg-[#222427]'
                          : isChecked
                          ? 'bg-[#2D323B] cursor-pointer hover:bg-[#343A45]'
                          : 'cursor-pointer hover:bg-[#26282B]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!isPresent}
                        onChange={() => {}} // handled by row click
                        className="mt-0.5 rounded border-[#4E5157] text-[#3574F0] focus:ring-0 focus:ring-offset-0 bg-[#2B2D30] cursor-pointer"
                      />

                      <div className="p-1 rounded bg-[#35373B] text-[#DFE1E5] shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-[#3574F0]" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white">{comp.label}</span>
                          {comp.summary && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-[#393B40] text-[#868A91] rounded truncate max-w-xs font-mono">
                              {comp.summary}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#868A91] mt-0.5">{comp.description}</p>
                      </div>

                      <div className="shrink-0 text-right">
                        {isPresent ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-green-400 font-medium">
                            <Check className="w-3 h-3" /> Available
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#6C707E]">Not in file</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!isLoading && components.length === 0 && !errorMessage && (
            <div className="text-center py-8 text-xs text-[#868A91]">
              Select an IntelliJ IDEA exported archive (<code>settings.zip</code>) or an <code>options</code> directory to preview components.
            </div>
          )}

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
            onClick={handleImportSubmit}
            disabled={!rawEntries || selectedIds.length === 0 || isLoading}
            className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#4382F7] disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-medium text-white transition-colors shadow-sm"
          >
            Import & Apply
          </button>
        </div>

      </div>
    </div>
  );
};
