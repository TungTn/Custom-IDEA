import { useState, useEffect, useCallback, useRef } from 'react';
import {
  checkUpdate,
  downloadUpdateWithProgress,
  verifySha256,
  applyUpdateAndRestart,
  getAppVersionInfo,
} from '../../services/updaterService';
import { VersionMetadata, UpdateProgress, UpdateCheckStatus } from '../../types/updater';

const LOCAL_STORAGE_LAST_CHECK_KEY = 'custom_idea_last_update_check';
const LOCAL_STORAGE_IGNORED_KEY = 'custom_idea_ignored_update_versions';
const LOCAL_STORAGE_INTERVAL_KEY = 'custom_idea_update_interval';
const LOCAL_STORAGE_AUTO_CHECK_KEY = 'custom_idea_auto_check';
const LOCAL_STORAGE_AUTO_DOWNLOAD_KEY = 'custom_idea_auto_download';
const LOCAL_STORAGE_BASE_URL_KEY = 'custom_idea_update_base_url';

function isLoopbackHttpUrl(parsed: URL): boolean {
  return (
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
  );
}

function resolveCustomUpdateBaseUrl(): string | undefined {
  const envUrl = import.meta.env?.VITE_UPDATE_BASE_URL;
  if (envUrl && envUrl.trim()) {
    try {
      const parsed = new URL(envUrl.trim());
      if (parsed.protocol === 'https:' || isLoopbackHttpUrl(parsed)) {
        return parsed.origin + parsed.pathname.replace(/\/+$/, '');
      }
    } catch (_) {}
  }

  // Runtime override via localStorage is strictly restricted to loopback mock servers
  try {
    const localUrl = localStorage.getItem(LOCAL_STORAGE_BASE_URL_KEY);
    if (localUrl && localUrl.trim()) {
      const parsed = new URL(localUrl.trim());
      if (isLoopbackHttpUrl(parsed)) {
        return parsed.origin + parsed.pathname.replace(/\/+$/, '');
      }
    }
  } catch (_) {}

  return undefined;
}

export function useAutoUpdate(
  showToast?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void
) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState<UpdateCheckStatus>('idle');
  const [metadata, setMetadata] = useState<VersionMetadata | null>(null);
  const [currentVersion, setCurrentVersion] = useState('0.1.0');
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasUpdateAvailable, setHasUpdateAvailable] = useState(false);

  const downloadedBufferRef = useRef<ArrayBuffer | null>(null);
  const downloadAbortRef = useRef<AbortController | null>(null);
  const currentVersionRef = useRef(currentVersion);
  const hasRanStartupRef = useRef(false);

  // Lấy phiên bản thực tế từ backend khi khởi tạo
  useEffect(() => {
    getAppVersionInfo().then((info) => {
      if (info && info.version) {
        currentVersionRef.current = info.version;
        setCurrentVersion(info.version);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      downloadAbortRef.current?.abort();
    };
  }, []);

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
      downloadAbortRef.current?.abort();
      downloadAbortRef.current = null;
      downloadedBufferRef.current = null;
      setProgress(null);
      setHasUpdateAvailable(false);
      setStatus('idle');
    } catch (_) {}
  }, []);

  const resetIgnoredVersions = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_IGNORED_KEY);
    showToast?.('Updates', 'Đã đặt lại danh sách phiên bản bỏ qua', 'info');
  }, [showToast]);

  const checkNow = useCallback(
    async (isManual: boolean = true) => {
      downloadAbortRef.current?.abort();
      downloadAbortRef.current = null;
      downloadedBufferRef.current = null;
      setProgress(null);
      setStatus('checking');
      setErrorMessage(null);

      if (isManual) {
        setIsModalOpen(true);
      }

      try {
        const info = await getAppVersionInfo();
        const appVer = info.version || currentVersionRef.current;
        currentVersionRef.current = appVer;
        setCurrentVersion(appVer);

        const latestMeta = await checkUpdate(appVer, resolveCustomUpdateBaseUrl());
        localStorage.setItem(LOCAL_STORAGE_LAST_CHECK_KEY, new Date().toISOString());

        if (latestMeta && latestMeta.version) {
          setMetadata(latestMeta);
          const ignored = getIgnoredVersions();
          const isIgnored = ignored.includes(latestMeta.version);

          if (latestMeta.forceUpdate) {
            setHasUpdateAvailable(true);
            setStatus('available');
            setIsModalOpen(true);
          } else if (!isIgnored) {
            setHasUpdateAvailable(true);
            setStatus('available');

            if (isManual) {
              setIsModalOpen(true);
            } else {
              const autoDownload = localStorage.getItem(LOCAL_STORAGE_AUTO_DOWNLOAD_KEY) === 'true';
              if (autoDownload && latestMeta.downloadUrl) {
                const abortController = new AbortController();
                downloadAbortRef.current = abortController;
                try {
                  setStatus('downloading');
                  const buf = await downloadUpdateWithProgress(
                    latestMeta.downloadUrl,
                    latestMeta.size || 0,
                    (p) => setProgress(p),
                    abortController.signal
                  );
                  const valid = await verifySha256(buf, latestMeta.sha256);
                  if (valid) {
                    downloadedBufferRef.current = buf;
                    downloadAbortRef.current = null;
                    setStatus('readyRestart');
                    showToast?.(
                      'Bản cập nhật đã sẵn sàng cài đặt',
                      `Custom IDEA v${latestMeta.version} đã tải xong và xác thực SHA-256. Mở Check for Updates để khởi động lại.`,
                      'success'
                    );
                    return;
                  }
                  downloadedBufferRef.current = null;
                  setProgress(null);
                  setStatus('available');
                } catch (_) {
                  downloadedBufferRef.current = null;
                  downloadAbortRef.current = null;
                  setProgress(null);
                  setStatus('available');
                }
              }
              showToast?.(
                'Có bản cập nhật mới',
                `Custom IDEA v${latestMeta.version} đã sẵn sàng. Bấm vào icon Cài đặt hoặc Help để cập nhật.`,
                'info'
              );
            }
          } else {
            if (isManual) {
              setStatus('available');
              setIsModalOpen(true);
            } else {
              setStatus('idle');
            }
          }
        } else {
          setHasUpdateAvailable(false);
          setStatus(isManual ? 'upToDate' : 'idle');
        }
      } catch (err: any) {
        console.error('[useAutoUpdate] Check failed:', err);
        downloadedBufferRef.current = null;
        setProgress(null);
        if (isManual) {
          setStatus('error');
          setErrorMessage(err?.message || 'Không thể kết nối đến máy chủ cập nhật');
        } else {
          setStatus('idle');
        }
      }
    },
    [showToast]
  );

  const startDownload = useCallback(async () => {
    if (!metadata || !metadata.downloadUrl) return;

    downloadAbortRef.current?.abort();
    const abortController = new AbortController();
    downloadAbortRef.current = abortController;
    downloadedBufferRef.current = null;

    setStatus('downloading');
    setProgress({ percent: 0, receivedBytes: 0, totalBytes: metadata.size || 0 });
    setErrorMessage(null);

    try {
      const buffer = await downloadUpdateWithProgress(
        metadata.downloadUrl,
        metadata.size || 0,
        (p) => setProgress(p),
        abortController.signal
      );

      const isHashValid = await verifySha256(buffer, metadata.sha256);
      if (!isHashValid) {
        downloadedBufferRef.current = null;
        setProgress(null);
        setStatus('error');
        setErrorMessage(
          'Lỗi kiểm tra toàn vẹn tệp (SHA-256 Hash Mismatch). Tệp tải về có thể bị lỗi đường truyền hoặc không trọn vẹn.'
        );
        return;
      }

      downloadedBufferRef.current = buffer;
      downloadAbortRef.current = null;
      setStatus('readyRestart');
    } catch (err: any) {
      downloadedBufferRef.current = null;
      downloadAbortRef.current = null;
      setProgress(null);
      if (err?.name === 'AbortError') {
        setStatus('available');
        return;
      }
      console.error('[useAutoUpdate] Download failed:', err);
      setStatus('error');
      setErrorMessage(err?.message || 'Lỗi khi tải file bản vá từ máy chủ cập nhật.');
    }
  }, [metadata]);

  const cancelDownload = useCallback(() => {
    downloadAbortRef.current?.abort();
    downloadAbortRef.current = null;
    downloadedBufferRef.current = null;
    setStatus('available');
    setProgress(null);
  }, []);

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

  // Kiểm tra tự động ngầm khi khởi động IDE (chỉ chạy đúng 1 lần)
  useEffect(() => {
    if (hasRanStartupRef.current) return;
    hasRanStartupRef.current = true;

    const checkOnStartup = () => {
      if (localStorage.getItem(LOCAL_STORAGE_AUTO_CHECK_KEY) === 'false') return;
      const interval = localStorage.getItem(LOCAL_STORAGE_INTERVAL_KEY) || 'daily';
      if (interval === 'never') return;

      const lastCheckStr = localStorage.getItem(LOCAL_STORAGE_LAST_CHECK_KEY);
      if (!lastCheckStr || interval === 'startup') {
        checkNow(false);
        return;
      }

      const lastCheck = new Date(lastCheckStr).getTime();
      if (Number.isNaN(lastCheck)) {
        checkNow(false);
        return;
      }

      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const oneWeek = 7 * oneDay;

      if (interval === 'daily' && now - lastCheck > oneDay) {
        checkNow(false);
      } else if (interval === 'weekly' && now - lastCheck > oneWeek) {
        checkNow(false);
      }
    };

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
    resetIgnoredVersions,
  };
}
