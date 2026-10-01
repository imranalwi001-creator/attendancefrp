import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { isCapacitorApp } from './apiClient';

export const CURRENT_APP_VERSION = '1.0.6';

export async function initAppUpdater(): Promise<void> {
  if (!isCapacitorApp()) return;

  try {
    // 1. Notify native plugin that app loaded successfully (prevents automatic rollback)
    await CapacitorUpdater.notifyAppReady().catch((e) => {
      console.warn('[OTA] notifyAppReady warning:', e);
    });

    // 2. Fetch latest version metadata from production server
    const checkUrl = 'https://fawwazreskiperwira.com/api/app-update/check';
    const res = await fetch(checkUrl, { cache: 'no-store' });
    if (!res.ok) return;

    const data = await res.json();
    if (!data || !data.version || !data.bundleUrl) return;

    // 3. Compare with current bundle version
    const current = await CapacitorUpdater.current().catch(() => null);
    const activeVersion = current?.bundle?.version || CURRENT_APP_VERSION;

    console.log(`[OTA] Active version: ${activeVersion}, Server version: ${data.version}`);

    if (data.version !== activeVersion) {
      console.log(`[OTA] New live update detected: ${data.version}. Downloading silent bundle...`);
      const bundle = await CapacitorUpdater.download({
        url: data.bundleUrl,
        version: data.version,
      });

      console.log(`[OTA] Bundle downloaded: ${bundle.id}. Applying update...`);
      if (data.force) {
        await CapacitorUpdater.set({ id: bundle.id });
      } else {
        await CapacitorUpdater.next({ id: bundle.id });
      }
    }
  } catch (err: any) {
    console.warn('[OTA] Updater check error:', err?.message || err);
  }
}
