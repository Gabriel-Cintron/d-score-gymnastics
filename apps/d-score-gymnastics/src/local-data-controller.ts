import type { StoredLocalData } from './local-data-repository';

export type LocalSaveStatus = 'error' | 'loading' | 'saved' | 'saving';

interface ControllerOptions {
  readonly replace: (snapshot: StoredLocalData) => Promise<void>;
  readonly onStatus: (status: LocalSaveStatus, error?: unknown) => void;
  readonly delay?: number;
}

/** One writer owns every local record. A successful save always represents a complete snapshot. */
export function createLocalDataController({ replace, onStatus, delay = 150 }: ControllerOptions) {
  let revision = 0;
  let pending: { readonly snapshot: StoredLocalData; readonly revision: number } | undefined;
  let running: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function cancelTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  async function drain(): Promise<void> {
    while (pending !== undefined) {
      const next = pending;
      pending = undefined;
      try {
        await replace(next.snapshot);
      } catch (error) {
        pending ??= next;
        onStatus('error', error);
        throw error;
      }
      if (next.revision === revision && pending === undefined) onStatus('saved');
    }
  }

  function flush(): Promise<void> {
    cancelTimer();
    if (running !== undefined) return running;
    if (pending === undefined) return Promise.resolve();
    onStatus('saving');
    running = Promise.resolve()
      .then(drain)
      .finally(() => {
        running = undefined;
      });
    return running;
  }

  function schedule(snapshot: StoredLocalData): void {
    pending = { snapshot, revision: ++revision };
    onStatus('saving');
    cancelTimer();
    timer = setTimeout(() => void flush().catch(() => undefined), delay);
  }

  async function replaceSnapshot(snapshot: StoredLocalData): Promise<void> {
    cancelTimer();
    // Discard queued older work, but let an already-open transaction settle first.
    pending = { snapshot, revision: ++revision };
    onStatus('saving');
    await running?.catch(() => undefined);
    await flush();
  }

  return {
    flush,
    replace: replaceSnapshot,
    reset: replaceSnapshot,
    schedule,
    cancelScheduled() {
      cancelTimer();
      pending = undefined;
      revision += 1;
    },
  };
}
