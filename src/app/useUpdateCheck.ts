import { useEffect, useState } from 'react';

/** Version of the code that is running now (content hash, set at build time). */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const POLL_MS = 60_000;

/** Fetches the deployed version, bypassing every cache. Returns null when offline / unknown. */
export async function fetchDeployedVersion(fetchFn: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetchFn(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === 'string' ? data.version : null;
  } catch {
    return null;
  }
}

/**
 * While the page is open, polls version.json (every minute, when the tab becomes visible
 * again and when the connection returns). true once a newer version has been deployed.
 * Off in dev: there is no version.json and the dev server reloads on every change anyway.
 */
export function useUpdateCheck(enabled = import.meta.env.PROD, fetchFn: typeof fetch = fetch): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const check = async () => {
      const deployed = await fetchDeployedVersion(fetchFn);
      if (!stopped && deployed && deployed !== APP_VERSION) setAvailable(true);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    const timer = setInterval(() => void check(), POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    void check();
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', check);
    };
  }, [enabled, fetchFn]);
  return available;
}

/** Registers the service worker (production only): newest version online, cached copy offline. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch(() => { /* game works without it */ });
}
