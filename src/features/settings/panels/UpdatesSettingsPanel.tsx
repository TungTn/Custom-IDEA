import React, { useState, useEffect } from 'react';
import { RotateCw, CheckCircle2, ShieldCheck, HardDrive, RefreshCw, AlertCircle } from 'lucide-react';
import { SettingPanelProps } from './types';
import { useModalStore } from '../../../stores/modalStore';
import { getAppVersionInfo, DEFAULT_GITLAB_HOST, DEFAULT_PACKAGE_NAME, DEFAULT_PROJECT_ID } from '../../../services/updaterService';

export const UpdatesSettingsPanel: React.FC<SettingPanelProps> = ({
  setIsDirty,
  onShowToast,
}) => {
  const [autoCheck, setAutoCheck] = useState<boolean>(() => {
    return localStorage.getItem('custom_idea_auto_check') !== 'false';
  });

  const [interval, setIntervalVal] = useState<string>(() => {
    return localStorage.getItem('custom_idea_update_interval') || 'daily';
  });

  const [autoDownload, setAutoDownload] = useState<boolean>(() => {
    return localStorage.getItem('custom_idea_auto_download') === 'true';
  });

  const [currentVersion, setCurrentVersion] = useState('0.1.0');
  const [isPortable, setIsPortable] = useState(true);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);
  const [ignoredCount, setIgnoredCount] = useState(0);

  useEffect(() => {
    getAppVersionInfo().then((info) => {
      if (info && info.version) {
        setCurrentVersion(info.version);
        if (info.isPortable !== undefined) setIsPortable(info.isPortable);
      }
    });

    const lastCheck = localStorage.getItem('custom_idea_last_update_check');
    if (lastCheck) {
      try {
        const d = new Date(lastCheck);
        setLastCheckTime(d.toLocaleString('vi-VN'));
      } catch (_) {
        setLastCheckTime(lastCheck);
      }
    }

    try {
      const ignored = JSON.parse(localStorage.getItem('custom_idea_ignored_update_versions') || '[]');
      setIgnoredCount(ignored.length);
    } catch (_) {}
  }, []);

  const handleAutoCheckChange = (checked: boolean) => {
    setAutoCheck(checked);
    localStorage.setItem('custom_idea_auto_check', String(checked));
    setIsDirty(true);
  };

  const handleIntervalChange = (val: string) => {
    setIntervalVal(val);
    localStorage.setItem('custom_idea_update_interval', val);
    setIsDirty(true);
  };

  const handleAutoDownloadChange = (checked: boolean) => {
    setAutoDownload(checked);
    localStorage.setItem('custom_idea_auto_download', String(checked));
    setIsDirty(true);
  };

  const handleResetIgnored = () => {
    localStorage.removeItem('custom_idea_ignored_update_versions');
    setIgnoredCount(0);
    onShowToast?.('Updates', 'Đã đặt lại danh sách phiên bản bỏ qua', 'info');
  };

  const handleCheckNow = () => {
    useModalStore.getState().setIsUpdateOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-100 max-w-2xl text-xs text-[#DFE1E5]">
      {/* Title & Description */}
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Updates</h2>
        <p className="text-[#868A91] leading-relaxed">
          Cấu hình tần suất kiểm tra phiên bản mới, tự động tải xuống và kênh phân phối từ Package Registry ({DEFAULT_GITLAB_HOST}).
        </p>
      </div>

      {/* Main Options Box */}
      <div className="bg-[#1E1F22] border border-[#393B40] rounded-lg p-4 space-y-4">
        <label className="flex items-center gap-2 cursor-pointer font-medium text-white">
          <input
            type="checkbox"
            checked={autoCheck}
            onChange={(e) => handleAutoCheckChange(e.target.checked)}
            className="w-4 h-4 rounded bg-[#2B2D30] border-[#393B40] text-[#3574F0] focus:ring-0 focus:ring-offset-0"
          />
          <span>Tự động kiểm tra bản cập nhật mới (Automatically check for updates)</span>
        </label>

        {autoCheck && (
          <div className="pl-6 space-y-3 pt-1 border-t border-[#2B2D30]">
            <div className="flex items-center gap-3">
              <span className="text-[#868A91] w-36">Tần suất kiểm tra:</span>
              <select
                value={interval}
                onChange={(e) => handleIntervalChange(e.target.value)}
                className="bg-[#2B2D30] border border-[#393B40] rounded px-2.5 py-1 text-xs text-[#DFE1E5] focus:border-[#3574F0] outline-none"
              >
                <option value="startup">Mỗi khi khởi động IDE (On every startup)</option>
                <option value="daily">Hàng ngày (Daily - Khuyến nghị)</option>
                <option value="weekly">Hàng tuần (Weekly)</option>
                <option value="never">Không bao giờ (Never)</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-[#868A91]">
              <input
                type="checkbox"
                checked={autoDownload}
                onChange={(e) => handleAutoDownloadChange(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-[#2B2D30] border-[#393B40] text-[#3574F0] focus:ring-0"
              />
              <span>Tự động tải bản vá trong nền khi có bản mới</span>
            </label>
          </div>
        )}
      </div>

      {/* Registry & Distribution Info Card */}
      <div className="bg-[#1E1F22] border border-[#393B40] rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#2B2D30]">
          <span className="font-semibold text-white">Thông Tin Hạ Tầng & Bản Phát Hành</span>
          <span className="flex items-center gap-1 text-[11px] text-[#62B543]">
            <ShieldCheck size={13} />
            <span>Xác thực SHA-256</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-y-2 text-xs">
          <div>
            <span className="text-[#868A91]">Ứng dụng:</span>
            <span className="ml-2 font-medium text-white">Custom IDEA</span>
          </div>
          <div>
            <span className="text-[#868A91]">Phiên bản hiện tại:</span>
            <span className="ml-2 font-mono font-medium text-[#85B1F8]">v{currentVersion}</span>
          </div>

          <div>
            <span className="text-[#868A91]">Loại phân phối:</span>
            <span className="ml-2 font-medium text-[#DFE1E5]">
              {isPortable ? 'Windows Portable (Atomic Swapper)' : 'Installed Package'}
            </span>
          </div>
          <div>
            <span className="text-[#868A91]">Kiến trúc mục tiêu:</span>
            <span className="ml-2 font-mono text-[#DFE1E5]">x86_64-pc-windows-msvc</span>
          </div>

          <div className="col-span-2">
            <span className="text-[#868A91]">Máy chủ phân phối:</span>
            <span className="ml-2 font-mono text-[#DFE1E5]">{DEFAULT_GITLAB_HOST} (Package Registry)</span>
          </div>

          <div className="col-span-2">
            <span className="text-[#868A91]">Gói phát hành (Package):</span>
            <span className="ml-2 font-mono text-[#DFE1E5]">{DEFAULT_PACKAGE_NAME}:latest (Project ID: {DEFAULT_PROJECT_ID})</span>
          </div>

          <div className="col-span-2 pt-1 border-t border-[#2B2D30] text-[#868A91]">
            <span>Lần kiểm tra gần nhất:</span>
            <span className="ml-2 text-[#DFE1E5]">{lastCheckTime || 'Chưa kiểm tra trong phiên này'}</span>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <button
            onClick={handleCheckNow}
            className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#437EEB] text-white font-medium rounded text-xs flex items-center gap-2 transition-colors shadow-sm"
          >
            <RotateCw size={13} />
            <span>Check Now... (Kiểm tra ngay)</span>
          </button>

          {ignoredCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[#868A91] text-[11px]">{ignoredCount} phiên bản đã bỏ qua</span>
              <button
                onClick={handleResetIgnored}
                className="text-[#4B9FD5] hover:underline text-[11px]"
              >
                Đặt lại
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
