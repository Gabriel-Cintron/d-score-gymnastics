import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type PwaInstallAvailability = 'installed' | 'instructions' | 'prompt' | 'unavailable';
export type PwaInstallResult = 'accepted' | 'dismissed' | 'instructions' | 'unavailable';
export type PwaStatus = 'error' | 'ready' | 'registering' | 'unsupported' | 'update-available';

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

export interface PwaControls {
  readonly applyUpdate: () => void;
  readonly dismissUpdate: () => void;
  readonly install: () => Promise<PwaInstallResult>;
  readonly installAvailability: PwaInstallAvailability;
  readonly status: PwaStatus;
  readonly updateAvailable: boolean;
}

export function usePwaControls(): PwaControls {
  const [installAvailability, setInstallAvailability] = useState<PwaInstallAvailability>(() =>
    Platform.OS === 'web' ? (isStandalone() ? 'installed' : 'instructions') : 'unavailable',
  );
  const [status, setStatus] = useState<PwaStatus>('unsupported');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const installPrompt = useRef<BeforeInstallPromptEvent | undefined>(undefined);
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const reloadForUpdate = useRef(false);

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      typeof window === 'undefined' ||
      typeof navigator === 'undefined'
    ) {
      return;
    }

    let active = true;
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPrompt.current = event as BeforeInstallPromptEvent;
      if (active) setInstallAvailability('prompt');
    };
    const onInstalled = () => {
      installPrompt.current = undefined;
      if (active) setInstallAvailability('installed');
    };
    const onControllerChange = () => {
      if (reloadForUpdate.current) window.location.reload();
    };
    const checkForUpdates = () => {
      void registration.current?.update().catch(() => {
        if (active) setStatus('error');
      });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdates();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('online', checkForUpdates);
    document.addEventListener('visibilitychange', onVisibilityChange);

    if (!('serviceWorker' in navigator) || __DEV__) {
      setStatus('unsupported');
      return () => {
        active = false;
        window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.removeEventListener('appinstalled', onInstalled);
        window.removeEventListener('online', checkForUpdates);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };
    }

    setStatus('registering');
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/app/' })
      .then((nextRegistration) => {
        if (!active) return;
        registration.current = nextRegistration;

        const offerUpdate = () => {
          if (!active) return;
          if (navigator.serviceWorker.controller === null) {
            setStatus('ready');
            return;
          }
          setUpdateAvailable(true);
          setStatus('update-available');
        };
        const watchInstallingWorker = () => {
          const worker = nextRegistration.installing;
          if (worker === null) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') offerUpdate();
          });
        };

        if (nextRegistration.waiting !== null) offerUpdate();
        else setStatus('ready');
        nextRegistration.addEventListener('updatefound', watchInstallingWorker);
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', checkForUpdates);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const install = useCallback(async (): Promise<PwaInstallResult> => {
    if (Platform.OS !== 'web') return 'unavailable';
    if (isStandalone()) {
      setInstallAvailability('installed');
      return 'accepted';
    }

    const prompt = installPrompt.current;
    if (prompt === undefined) return 'instructions';
    await prompt.prompt();
    const choice = await prompt.userChoice;
    installPrompt.current = undefined;
    if (choice.outcome === 'accepted') {
      setInstallAvailability('installed');
      return 'accepted';
    }
    setInstallAvailability('instructions');
    return 'dismissed';
  }, []);

  const applyUpdate = useCallback(() => {
    const waiting = registration.current?.waiting;
    reloadForUpdate.current = true;
    if (waiting === null || waiting === undefined) window.location.reload();
    else waiting.postMessage({ type: 'SKIP_WAITING' });
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
    setStatus('ready');
  }, []);

  return {
    applyUpdate,
    dismissUpdate,
    install,
    installAvailability,
    status,
    updateAvailable,
  };
}

function isStandalone(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { readonly standalone?: boolean }).standalone === true
  );
}
