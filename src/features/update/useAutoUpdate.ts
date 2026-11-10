import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  checkUpdate, 
  downloadUpdateWithProgress, 
  verifySha256, 
  applyUpdateAndRestart,
  getAppVersionInfo
} from '../../services/updaterService';
import { VersionMetadata, UpdateProgress, UpdateCheckStatus } from '../../types/updater';

const LOCAL_STORAGE_LAST_CHECK_KEY = 'custom_idea_last_update_check';
const LOCAL_STORAGE_IGNORED_KEY = 'custom_idea_ignored_update_versions';
const LOCAL_STORAGE_INTERVAL_KEY = 'custom_idea_update_interval';

export function useAutoUpdate(showToast?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState<UpdateCheckStatus>('idle');
  const [metadata, setMetadata] = useState<VersionMetadata | null>(null);
  const [currentVersion, setCurrentVersion] = useState('0.1.0');
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasUpdateAvailable, setHasUpdateAvailable] = useState(false);
  const downloadedBufferRef = useRef<ArrayBuffer | null>(null);

  // Lấy phiên bản thực tế từ backend khi khởi tạo
  useEffect(() => {
    getAppVersionInfo().then((info) => {
      if (info && info.version) {
        setCurrentVersion(info.version);
      }
    });
  }, []);

  // Lấy danh sách phiên bản đã bỏ qua
  const getIgnoredVersions = (): string[] => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_IGNORED_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  };

  const ignoreVersion = useCallback((ver: string) => {
    try {
      const current = getIgnoredVersions();
      if (!current.includes(ver)) {
        current.push(ver);
        localStorage.setItem(LOCAL_STORAGE_IGNORED_KEY, JSON.stringify(current));
      }
      setHasUpdateAvailable(false);
    } catch (_) {}
  }, []);

  const resetIgnoredVersions = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_IGNORED_KEY);
    showToast?.('Updates', 'Đã đặt lại danh sách phiên bản bỏ qua', 'info');
  }, [showToast]);

  // Hàm kiểm tra cập nhật (thủ công hoặc tự động)
  const checkNow = useCallback(async (isManual: boolean = true) => {
    setStatus('checking');
    setErrorMessage(null);

    if (isManual) {
      setIsModalOpen(true);
    }

    try {
      const info = await getAppVersionInfo();
      const appVer = info.version || currentVersion;
      setCurrentVersion(appVer);

      const latestMeta = await checkUpdate(appVer);
      localStorage.setItem(LOCAL_STORAGE_LAST_CHECK_KEY, new Date().toISOString());

      if (latestMeta && latestMeta.version) {
        setMetadata(latestMeta);
        const ignored = getIgnoredVersions();
        const isIgnored = ignored.includes(latestMeta.version);

        if (latestMeta.forceUpdate) {
          // Bắt buộc cập nhật: luôn mở modal bất kể isManual
          setHasUpdateAvailable(true);
          setStatus('available');
          setIsModalOpen(true);
        } else if (!isIgnored) {
          setHasUpdateAvailable(true);
          setStatus('available');

          if (isManual) {
            setIsModalOpen(true);
          } else {
            // Kiểm tra ngầm tự động: thông báo balloon không gián đoạn
            showToast?.(
              'Có bản cập nhật mới',
              `Custom IDEA v${latestMeta.version} đã sẵn sàng. Bấm vào icon Cài đặt hoặc Help để cập nhật.`,
              'info'
            );
          }
        } else {
          // Phiên bản đã bị bỏ qua
          if (isManual) {
            setStatus('available');
            setIsModalOpen(true);
          }
        }
      } else {
        setHasUpdateAvailable(false);
        if (isManual) {
          setStatus('upToDate');
        } else {
          setStatus('idle');
        }
      }
    } catch (err: any) {
      console.error('[useAutoUpdate] Check failed:', err);
      if (isManual) {
        setStatus('error');
        setErrorMessage(err?.message || 'Không thể kết nối đến máy chủ cập nhật');
      } else {
        setStatus('idle');
      }
    }
  }, [currentVersion, showToast]);

  // Hàm bắt đầu tải bản vá
  const startDownload = useCallback(async () => {
    if (!metadata || !metadata.downloadUrl) return;

    setStatus('downloading');
    setProgress({ percent: 0, receivedBytes: 0, totalBytes: metadata.size || 0 });
    setErrorMessage(null);

    try {
      const buffer = await downloadUpdateWithProgress(
        metadata.downloadUrl,
        metadata.size || 0,
        (p) => setProgress(p)
      );

      // Xác thực mã băm SHA-256 theo chuẩn MIC
      const isHashValid = await verifySha256(buffer, metadata.sha256);
      if (!isHashValid) {
        setStatus('error');
        setErrorMessage(
          'Lỗi kiểm tra toàn vẹn tệp (SHA-256 Hash Mismatch). Tệp tải về có thể bị lỗi đường truyền hoặc không trọn vẹn.'
        );
        return;
      }

      downloadedBufferRef.current = buffer;
      setStatus('readyRestart');
    } catch (err: any) {
      console.error('[useAutoUpdate] Download failed:', err);
      setStatus('error');
      setErrorMessage(err?.message || 'Lỗi khi tải file bản vá từ GitLab.');
    }
  }, [metadata]);

  const cancelDownload = useCallback(() => {
    setStatus('available');
    setProgress(null);
  }, []);

  // Hàm áp dụng cập nhật và khởi động lại
  const applyRestart = useCallback(async () => {
    if (!downloadedBufferRef.current) return;
    try {
      await applyUpdateAndRestart(downloadedBufferRef.current);
    } catch (err: any) {
      console.error('[useAutoUpdate] Restart failed:', err);
      setStatus('error');
      setErrorMessage(err?.message || 'Không thể khởi động kịch bản tự cập nhật.');
    }
  }, []);

  // Kiểm tra tự động ngầm khi khởi động IDE
  useEffect(() => {
    const checkOnStartup = () => {
      const interval = localStorage.getItem(LOCAL_STORAGE_INTERVAL_KEY) || 'daily';
      if (interval === 'never') return;

      const lastCheckStr = localStorage.getItem(LOCAL_STORAGE_LAST_CHECK_KEY);
      if (!lastCheckStr || interval === 'startup') {
        checkNow(false);
        return;
      }

      const lastCheck = new Date(lastCheckStr).getTime();
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const oneWeek = 7 * oneDay;

      if (interval === 'daily' && now - lastCheck > oneDay) {
        checkNow(false);
      } else if (interval === 'weekly' && now - lastCheck > oneWeek) {
        checkNow(false);
      }
    };

    // Delay 2 giây sau khi khởi động app để UI render mượt mà
    const timer = setTimeout(checkOnStartup, 2000);
    return () => clearTimeout(timer);
  }, [checkNow]);

  return {
    isModalOpen,
    setIsModalOpen,
    status,
    metadata,
    currentVersion,
    progress,
    errorMessage,
    hasUpdateAvailable,
    checkNow,
    startDownload,
    cancelDownload,
    applyRestart,
    ignoreVersion,
    resetIgnoredVersions
  };
}
