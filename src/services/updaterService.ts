/**
 * Auto-Update Service (MIC Studio Standard via gitlab.mic.vn)
 */
import { invoke } from '@tauri-apps/api/core';
import { VersionMetadata, UpdateProgress } from '../types/updater';

// Cấu hình mặc định cho dự án Custom IDEA trên gitlab.mic.vn
const DEFAULT_GITLAB_HOST = 'gitlab.mic.vn';
const DEFAULT_PROJECT_ID = '299';
const DEFAULT_PACKAGE_NAME = 'mic-idea';

// Token xác thực đọc/tải từ GitLab Package Registry (Project Access Token)
const READ_TOKEN = 'REDACTED';

/**
 * So sánh 2 chuỗi phiên bản SemVer (x.y.z)
 * Trả về true nếu remoteVer lớn hơn currentVer
 */
export function isNewerVersion(currentVer: string, remoteVer: string): boolean {
  if (!remoteVer) return false;
  const cParts = currentVer.replace(/^v/i, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const rParts = remoteVer.replace(/^v/i, '').split('.').map((n) => Number.parseInt(n, 10) || 0);

  for (let i = 0; i < 3; i++) {
    const c = cParts[i] || 0;
    const r = rParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

/**
 * Lấy URL metadata version.json từ GitLab Package Registry
 */
export function getMetadataUrl(customBaseUrl?: string): string {
  if (customBaseUrl) {
    return `${customBaseUrl.replace(/\/+$/, '')}/version.json`;
  }
  return `https://${DEFAULT_GITLAB_HOST}/api/v4/projects/${DEFAULT_PROJECT_ID}/packages/generic/${DEFAULT_PACKAGE_NAME}/latest/version.json`;
}

/**
 * Kiểm tra phiên bản mới từ gitlab.mic.vn
 */
export async function checkUpdate(currentVersion: string, customBaseUrl?: string): Promise<VersionMetadata | null> {
  try {
    const baseUrl = getMetadataUrl(customBaseUrl);
    // Luôn nối timestamp chống cache proxy theo Thiết luật MIC
    const url = `${baseUrl}?t=${Date.now()}`;

    const headers: Record<string, string> = {};
    if (READ_TOKEN && !customBaseUrl) {
      headers['PRIVATE-TOKEN'] = READ_TOKEN;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Timeout 8s

    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[Updater] GitLab API trả về HTTP ${res.status}`);
      return null;
    }

    const data: VersionMetadata = await res.json();
    if (data && data.version && isNewerVersion(currentVersion, data.version)) {
      return data;
    }
  } catch (err) {
    console.error('[Updater] Lỗi khi kiểm tra bản mới từ gitlab.mic.vn:', err);
  }
  return null;
}

/**
 * Tải file cập nhật nhị phân kèm streaming progress
 */
export async function downloadUpdateWithProgress(
  downloadUrl: string,
  expectedTotalBytes: number,
  onProgress: (progress: UpdateProgress) => void
): Promise<ArrayBuffer> {
  const headers: Record<string, string> = {};
  if (READ_TOKEN && downloadUrl.includes('gitlab.mic.vn')) {
    headers['PRIVATE-TOKEN'] = READ_TOKEN;
  }

  const startTime = Date.now();
  const res = await fetch(downloadUrl, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} khi tải từ ${downloadUrl}`);
  }

  const contentLength = res.headers.get('content-length');
  const total = contentLength ? Number.parseInt(contentLength, 10) : expectedTotalBytes;

  if (!res.body) {
    const buffer = await res.arrayBuffer();
    onProgress({
      percent: 100,
      receivedBytes: buffer.byteLength,
      totalBytes: buffer.byteLength
    });
    return buffer;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;

      const elapsedSec = (Date.now() - startTime) / 1000;
      const speed = elapsedSec > 0 ? received / elapsedSec : 0;
      const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;

      onProgress({
        percent,
        receivedBytes: received,
        totalBytes: total,
        speedBytesPerSec: speed
      });
    }
  }

  // Ghép toàn bộ chunks thành một Uint8Array duy nhất
  const fullArray = new Uint8Array(received);
  let position = 0;
  for (const chunk of chunks) {
    fullArray.set(chunk, position);
    position += chunk.length;
  }

  return fullArray.buffer;
}

/**
 * Kiểm tra tính toàn vẹn tệp tải về bằng SHA-256 hash (Bắt buộc theo chuẩn MIC)
 */
export async function verifySha256(buffer: ArrayBuffer, expectedSha256: string): Promise<boolean> {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const calculatedHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    const isMatch = calculatedHex.toLowerCase() === expectedSha256.trim().toLowerCase();
    if (!isMatch) {
      console.error('[Security] Mã băm SHA-256 không khớp!');
      console.error('  Mong đợi :', expectedSha256);
      console.error('  Tính được:', calculatedHex);
    }
    return isMatch;
  } catch (err) {
    console.error('[Security] Lỗi tính SHA-256:', err);
    return false;
  }
}

/**
 * Gọi backend Rust để ghi đè file .exe và kích hoạt kịch bản tự hủy update.bat
 */
export async function applyUpdateAndRestart(buffer: ArrayBuffer): Promise<void> {
  const bytes = Array.from(new Uint8Array(buffer));
  await invoke('apply_update_and_restart', { newExeBytes: bytes });
}

/**
 * Lấy thông tin phiên bản hiện tại từ backend
 */
export async function getAppVersionInfo(): Promise<{
  version: string;
  isPortable?: boolean;
  is_portable?: boolean;
  exePath?: string;
  exe_path?: string;
  build_commit?: string;
  build_date?: string;
  target?: string;
}> {
  try {
    const res = await invoke<any>('get_app_version_info');
    return {
      ...res,
      isPortable: res.is_portable ?? res.isPortable ?? false,
      exePath: res.exe_path ?? res.exePath ?? '',
    };
  } catch (_) {
    return { version: '0.1.0', build_date: 'November 2026', isPortable: true };
  }
}
