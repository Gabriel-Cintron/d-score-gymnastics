import {
  createTelemetryClient,
  emptyClientState,
  type ClientState,
  type ClientStore,
} from '../../../packages/telemetry/src/client';
import { CAMPAIGNS, type Consent } from '../../../packages/telemetry/src/protocol';
import { PRODUCT_VERSION } from './product';
export { createSearchTracker } from './telemetry-search';
const listeners = new Set<() => void>();
declare const process: { env: { EXPO_PUBLIC_DSCORE_BUILD_SHA?: string } };
const build = process.env.EXPO_PUBLIC_DSCORE_BUILD_SHA ?? '';
const available =
  !__DEV__ &&
  typeof window !== 'undefined' &&
  window.location.origin === 'https://d-score.app' &&
  /^[a-f0-9]{40}$/.test(build) &&
  !navigator.webdriver;
let opening: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('dscore-telemetry', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Analytics preferences are unavailable.'));
    request.onblocked = () => reject(new Error('Analytics storage is blocked.'));
  }).catch((error) => {
    opening = undefined;
    throw error;
  });
  return opening;
}
const store: ClientStore = {
  async change<T>(action: (state: ClientState) => T): Promise<T> {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite'),
        object = tx.objectStore('state'),
        request = object.get('current');
      let result: T;
      request.onsuccess = () => {
        try {
          const state = (request.result ?? emptyClientState()) as ClientState;
          result = action(state);
          object.put(state, 'current');
        } catch {
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(new Error('Analytics storage is unavailable.'));
      tx.onabort = () => reject(new Error('Analytics storage is unavailable.'));
    });
  },
};
const client = createTelemetryClient({
  store,
  enabled: available,
  endpoint: 'https://analytics.d-score.app',
  version: PRODUCT_VERSION,
  build,
  mode: () => (window.matchMedia('(display-mode: standalone)').matches ? 'pwa' : 'browser'),
});
function attribution() {
  let referrer = '';
  try {
    const host = new URL(document.referrer).hostname;
    if (
      host !== location.hostname &&
      /^[a-z0-9.-]{1,100}$/.test(host) &&
      !/^([0-9]+\.)*[0-9]+$/.test(host)
    )
      referrer = host;
  } catch {
    /* No external referrer. */
  }
  const campaign = new URLSearchParams(location.search).get('utm_campaign') ?? '';
  return {
    referrer,
    campaign: CAMPAIGNS.includes(campaign as (typeof CAMPAIGNS)[number]) ? campaign : '',
  };
}
export const telemetry = {
  ...client,
  available,
  async invitation() {
    return store.change((s) => !s.asked);
  },
  async dismissInvitation() {
    await store.change((s) => {
      s.asked = true;
    });
    listeners.forEach((f) => f());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  async setConsent(consent: Consent) {
    await client.setConsent(consent);
    listeners.forEach((f) => f());
    if (consent.usage && !consent.owner) {
      const a = attribution();
      await client.activity(a.referrer, a.campaign);
    }
    await client.flush();
  },
  async erase() {
    try {
      await client.erase();
    } finally {
      listeners.forEach((f) => f());
    }
  },
  start() {
    if (!available) return () => undefined;
    let last = 0;
    const activity = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 1000) return;
      last = Date.now();
      const a = attribution();
      void client.activity(a.referrer, a.campaign).catch(() => undefined);
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') activity();
      else void client.flush();
    };
    const flush = () => void client.flush();
    activity();
    window.addEventListener('pointerdown', activity, { passive: true });
    window.addEventListener('keydown', activity);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', flush);
    window.addEventListener('online', flush);
    const timer = setInterval(flush, 30_000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', activity);
      window.removeEventListener('keydown', activity);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('online', flush);
    };
  },
};
