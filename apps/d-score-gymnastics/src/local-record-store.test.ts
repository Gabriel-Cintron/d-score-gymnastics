import { defaultProfileSelection } from './scoring-profile-state';
import { describe, expect, it } from 'vitest';

import { createStoredAppPreferences } from './app-preferences';
import { createAppPreferencesRepository } from './app-preferences-repository';
import { createLocalDataRepository } from './local-data-repository';
import {
  LOCAL_RECORD_KEYS,
  type LocalRecordKey,
  type LocalRecordSet,
  type LocalRecordStore,
} from './local-record-store.types';
import { createRoutineLibraryRepository } from './routine-library-repository';
import { createStoredRoutineLibrary, emptyRoutineLibrary } from './routine-library';
import { createWorkbenchRepository } from './workbench-repository';
import {
  createStoredWorkbenchState,
  emptyLandings,
  emptyRelationships,
  emptyRoutines,
} from './workbench-state';

const ruleset = {
  dataRevision: '2026-08-10',
  dataVersion: '0.4.0',
  disciplineId: 'mens-artistic-gymnastics',
  id: 'fig-mag-2025-2028',
};

function memoryStore(): LocalRecordStore & { readonly records: Map<LocalRecordKey, unknown> } {
  const records = new Map<LocalRecordKey, unknown>();
  return {
    records,
    async clearAll() {
      records.clear();
    },
    async load(key) {
      return records.get(key);
    },
    async replaceAll(next: LocalRecordSet) {
      records.clear();
      Object.entries(next).forEach(([key, value]) => records.set(key as LocalRecordKey, value));
    },
    async save(key, value) {
      records.set(key, value);
    },
  };
}

describe('local record repository boundary', () => {
  it('maps each repository to its stable platform record key', async () => {
    const store = memoryStore();
    const preferences = createAppPreferencesRepository(store);
    const library = createRoutineLibraryRepository(store);
    const workbench = createWorkbenchRepository(store);

    await preferences.save(createStoredAppPreferences({ onboardingComplete: true }));
    await library.save(createStoredRoutineLibrary(emptyRoutineLibrary(), ruleset));
    await workbench.save(
      createStoredWorkbenchState(
        {
          ...defaultProfileSelection(),
          apparatus: 'floor-exercise',
          nextOccurrenceNumber: 1,
          relationships: emptyRelationships,
          routines: emptyRoutines,
          stuckByApparatus: emptyLandings,
          themeMode: 'dark',
        },
        ruleset,
      ),
    );

    expect(await preferences.load()).toEqual(store.records.get(LOCAL_RECORD_KEYS.preferences));
    expect(await library.load()).toEqual(store.records.get(LOCAL_RECORD_KEYS.routineLibrary));
    expect(await workbench.load()).toEqual(store.records.get(LOCAL_RECORD_KEYS.workbench));
  });

  it('replaces and clears the complete local dataset through one atomic store operation', async () => {
    const store = memoryStore();
    const repository = createLocalDataRepository(store);
    const data = {
      library: { library: true },
      preferences: { preferences: true },
      workbench: { workbench: true },
    } as never;

    await repository.replace(data);

    expect(Object.fromEntries(store.records)).toEqual({
      [LOCAL_RECORD_KEYS.preferences]: { preferences: true },
      [LOCAL_RECORD_KEYS.routineLibrary]: { library: true },
      [LOCAL_RECORD_KEYS.workbench]: { workbench: true },
    });

    await repository.clear();
    expect(store.records.size).toBe(0);
  });
});
