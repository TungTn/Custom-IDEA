import { invoke } from '@tauri-apps/api/core';

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

export const safeInvoke = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> => {
  if (!isTauriEnvironment()) {
    console.warn(`[Platform] Non-Tauri environment: ${cmd}`, args);
    return null;
  }
  try {
    return await invoke<T>(cmd, args);
  } catch (error) {
    console.error(`[Platform] Error invoking ${cmd}:`, error);
    throw error;
  }
};

export const storage = {
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`[Storage] Failed to save key "${key}":`, e);
    }
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};
