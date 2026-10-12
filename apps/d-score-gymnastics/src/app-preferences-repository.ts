import type { StoredAppPreferences } from './app-preferences';
import { localRecordStore, type LocalRecordStore } from './local-record-store';
import { LOCAL_RECORD_KEYS } from './local-record-store.types';

export interface AppPreferencesRepository {
  load(): Promise<unknown | undefined>;
  save(preferences: StoredAppPreferences): Promise<void>;
}

export function createAppPreferencesRepository(store: LocalRecordStore): AppPreferencesRepository {
  return {
    load: () => store.load(LOCAL_RECORD_KEYS.preferences),
    save: (preferences) => store.save(LOCAL_RECORD_KEYS.preferences, preferences),
  };
}

export const appPreferencesRepository = createAppPreferencesRepository(localRecordStore);
