import type { StoredAppPreferences } from './app-preferences';
import { localRecordStore, type LocalRecordStore } from './local-record-store';
import { LOCAL_RECORD_KEYS } from './local-record-store.types';
import type { StoredRoutineLibrary } from './routine-library';
import type { StoredWorkbenchState } from './workbench-state';

export interface StoredLocalData {
  readonly library: StoredRoutineLibrary;
  readonly preferences: StoredAppPreferences;
  readonly workbench: StoredWorkbenchState;
}

export interface LocalDataRepository {
  clear(): Promise<void>;
  replace(data: StoredLocalData): Promise<void>;
}

export function createLocalDataRepository(store: LocalRecordStore): LocalDataRepository {
  return {
    clear: () => store.clearAll(),
    replace: (data) =>
      store.replaceAll({
        [LOCAL_RECORD_KEYS.preferences]: data.preferences,
        [LOCAL_RECORD_KEYS.routineLibrary]: data.library,
        [LOCAL_RECORD_KEYS.workbench]: data.workbench,
      }),
  };
}

const repository = createLocalDataRepository(localRecordStore);

export const clearStoredLocalData = () => repository.clear();
export const replaceStoredLocalData = (data: StoredLocalData) => repository.replace(data);
