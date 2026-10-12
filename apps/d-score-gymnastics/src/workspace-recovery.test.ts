import { describe, expect, it } from 'vitest';

import { blankAllAroundState, type SavedAllAround } from './routine-library';
import { recoverWorkspace } from './workspace-recovery';

const blank = blankAllAroundState('light');
const changed = { ...blank, vaultId: 'vt:mag-0001' as never };
const saved: SavedAllAround = {
  id: 'old',
  name: 'Original',
  kind: 'all-around',
  state: blank,
  createdAt: '2026-10-11T12:00:00Z',
  updatedAt: '2026-10-11T12:00:00Z',
};
const library = { activeAllAroundId: saved.id, items: [saved] };
const recover = (state: typeof blank | undefined) =>
  recoverWorkspace(library, state, blank, 'recovered', saved.updatedAt);

describe('pre-release snapshot recovery', () => {
  it('preserves both an old all-around and its newer standalone workbench', () => {
    const result = recover(changed);
    expect(result.library.items).toHaveLength(2);
    expect(result.library.items[1]).toEqual(saved);
    expect(result.library.items[0]?.name).toBe('Recovered workbench');
    expect(result.library.activeAllAroundId).toBe('recovered');
    expect(result.workbench.vaultId).toBe(changed.vaultId);
  });
  it('restores a library when there is no workbench record and does not duplicate matching records', () => {
    expect(recover(undefined).library.items).toHaveLength(1);
    expect(recover(blank).library.items).toHaveLength(1);
  });
  it('preserves a full library and blocks overwriting when recovery needs another slot', () => {
    const full = {
      ...library,
      items: Array.from({ length: 100 }, (_, i) => ({
        ...saved,
        id: i === 0 ? 'old' : `saved-${i}`,
      })),
    };
    const result = recoverWorkspace(full, changed, blank, 'recovered', saved.updatedAt);
    expect(result.blocked).toBe(true);
    expect(result.library).toEqual(full);
    expect(result.workbench).toEqual(changed);
  });
});
