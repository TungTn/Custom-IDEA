import React, { useState } from 'react';
import { CheckCircle2, RefreshCw, Download } from 'lucide-react';
import { SettingPanelProps } from './types';

export const BackupSyncPanel: React.FC<SettingPanelProps> = ({
  formSettings,
  onShowToast,
}) => {
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing'>('synced');
  const [lastSyncTime, setLastSyncTime] = useState('Just now');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Backup and Sync</h2>
        <p className="text-xs text-[#868A91]">Sync your IDE settings, keymaps, and themes across workstations.</p>
      </div>

      <div className="border border-[#393B40] rounded bg-[#26282B] p-4 text-xs space-y-3 max-w-xl">
        <div className="flex items-center gap-2 text-[#59A869] font-medium">
          <CheckCircle2 size={16} />
          <span>Settings are synchronized with Local Backup</span>
        </div>
        <p className="text-[#868A91]">Last synchronized: {lastSyncTime}</p>
        
        <div className="flex gap-2 pt-2">
          <button 
            onClick={() => {
              setSyncStatus('syncing');
              setTimeout(() => {
                setSyncStatus('synced');
                setLastSyncTime(new Date().toLocaleTimeString());
                onShowToast?.('Sync Finished', 'Settings uploaded and backed up successfully', 'success');
              }, 500);
            }}
            className="px-3.5 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={12} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            Sync Settings Now
          </button>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(formSettings, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'intellij-ide-settings.json';
              a.click();
              URL.revokeObjectURL(url);
              onShowToast?.('Exported', 'Saved settings to intellij-ide-settings.json', 'success');
            }}
            className="px-3 py-1.5 bg-[#2B2D30] hover:bg-[#35373B] text-[#DFE1E5] rounded border border-[#393B40] flex items-center gap-1"
          >
            <Download size={12} /> Export...
          </button>
        </div>
      </div>
    </div>
  );
};
