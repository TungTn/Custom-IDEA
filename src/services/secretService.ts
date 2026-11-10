import { invoke } from '@tauri-apps/api/core';

const inMemoryFallback = new Map<string, string>();

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

export async function setSecret(namespace: string, key: string, value: string): Promise<void> {
  if (!isTauriRuntime()) {
    inMemoryFallback.set(`${namespace}:${key}`, value);
    return;
  }
  try {
    await invoke('app_secret_set', { namespace, key, value });
  } catch (err) {
    console.warn(`[Keyring] Failed to save secret for ${namespace}:${key}`, err);
    inMemoryFallback.set(`${namespace}:${key}`, value);
  }
}

export async function getSecret(namespace: string, key: string): Promise<string | null> {
  if (!isTauriRuntime()) {
    return inMemoryFallback.get(`${namespace}:${key}`) ?? null;
  }
  try {
    const val = await invoke<string | null>('app_secret_get', { namespace, key });
    if (val !== null && val !== undefined) return val;
    return inMemoryFallback.get(`${namespace}:${key}`) ?? null;
  } catch (err) {
    console.warn(`[Keyring] Failed to get secret for ${namespace}:${key}`, err);
    return inMemoryFallback.get(`${namespace}:${key}`) ?? null;
  }
}

export async function deleteSecret(namespace: string, key: string): Promise<void> {
  inMemoryFallback.delete(`${namespace}:${key}`);
  if (!isTauriRuntime()) return;
  try {
    await invoke('app_secret_delete', { namespace, key });
  } catch (err) {
    console.warn(`[Keyring] Failed to delete secret for ${namespace}:${key}`, err);
  }
}
