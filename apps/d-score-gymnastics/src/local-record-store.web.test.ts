import { afterEach, describe, expect, it, vi } from 'vitest';

import { localRecordStore } from './local-record-store.web';

afterEach(() => vi.unstubAllGlobals());

describe('unavailable browser persistence', () => {
  it('rejects reads, saves, replacements and deletion instead of pretending to persist', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(localRecordStore.load('workbench')).rejects.toThrow('unavailable');
    await expect(localRecordStore.save('workbench', {})).rejects.toThrow('unavailable');
    await expect(
      localRecordStore.replaceAll({ workbench: {}, 'routine-library': {}, 'app-preferences': {} }),
    ).rejects.toThrow('unavailable');
    await expect(localRecordStore.clearAll()).rejects.toThrow('unavailable');
  });
});
