import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLocalDataController } from './local-data-controller';
import type { StoredLocalData } from './local-data-repository';

const snapshot = (id: number) =>
  ({ workbench: { id }, library: { id }, preferences: { id } }) as unknown as StoredLocalData;
const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

afterEach(() => vi.useRealTimers());

describe('complete local snapshot writer', () => {
  it('coalesces edits and writes all records after one debounce', async () => {
    vi.useFakeTimers();
    const replace = vi.fn().mockResolvedValue(undefined);
    const status = vi.fn();
    const controller = createLocalDataController({ replace, onStatus: status });
    controller.schedule(snapshot(1));
    controller.schedule(snapshot(2));
    expect(status).toHaveBeenLastCalledWith('saving');
    await vi.advanceTimersByTimeAsync(149);
    expect(replace).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(replace).toHaveBeenCalledExactlyOnceWith(snapshot(2));
    expect(status).toHaveBeenLastCalledWith('saved');
  });

  it('does not report saved while a newer edit waits behind a transaction', async () => {
    const first = deferred();
    const second = deferred();
    const replace = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const status = vi.fn();
    const controller = createLocalDataController({ replace, onStatus: status });
    controller.schedule(snapshot(1));
    const flushing = controller.flush();
    await Promise.resolve();
    controller.schedule(snapshot(2));
    first.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(status).not.toHaveBeenCalledWith('saved');
    second.resolve();
    await flushing;
    expect(replace.mock.calls.map(([value]) => value)).toEqual([snapshot(1), snapshot(2)]);
    expect(status).toHaveBeenLastCalledWith('saved');
  });

  it('retains failed work for an explicit retry', async () => {
    const failure = new Error('Quota exceeded');
    const replace = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
    const status = vi.fn();
    const controller = createLocalDataController({ replace, onStatus: status });
    controller.schedule(snapshot(1));
    await expect(controller.flush()).rejects.toThrow('Quota');
    expect(status).toHaveBeenLastCalledWith('error', failure);
    await controller.flush();
    expect(replace).toHaveBeenLastCalledWith(snapshot(1));
    expect(status).toHaveBeenLastCalledWith('saved');
  });

  it.each(['replace', 'reset'] as const)(
    '%s discards queued old saves and waits for the running transaction',
    async (operation) => {
      const first = deferred();
      const replace = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
      const controller = createLocalDataController({ replace, onStatus: vi.fn() });
      controller.schedule(snapshot(1));
      const flushing = controller.flush();
      await Promise.resolve();
      controller.schedule(snapshot(2));
      const replacing = controller[operation](snapshot(3));
      expect(replace).toHaveBeenCalledTimes(1);
      first.resolve();
      await Promise.all([flushing, replacing]);
      expect(replace.mock.calls.map(([value]) => value)).toEqual([snapshot(1), snapshot(3)]);
    },
  );

  it('a replacement proceeds even after an older write fails', async () => {
    const first = deferred();
    const replace = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const controller = createLocalDataController({ replace, onStatus: vi.fn() });
    controller.schedule(snapshot(1));
    const flushing = controller.flush().catch(() => undefined);
    await Promise.resolve();
    const replacing = controller.replace(snapshot(3));
    first.reject(new Error('old save failed'));
    await Promise.all([flushing, replacing]);
    expect(replace).toHaveBeenLastCalledWith(snapshot(3));
  });
});
