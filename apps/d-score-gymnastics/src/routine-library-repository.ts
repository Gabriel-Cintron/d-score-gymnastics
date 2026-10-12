import { localRecordStore, type LocalRecordStore } from './local-record-store';
import { LOCAL_RECORD_KEYS } from './local-record-store.types';
import type { StoredRoutineLibrary } from './routine-library';

export interface RoutineLibraryRepository {
  load(): Promise<unknown | undefined>;
  save(library: StoredRoutineLibrary): Promise<void>;
}

export function createRoutineLibraryRepository(store: LocalRecordStore): RoutineLibraryRepository {
  return {
    load: () => store.load(LOCAL_RECORD_KEYS.routineLibrary),
    save: (library) => store.save(LOCAL_RECORD_KEYS.routineLibrary, library),
  };
}

export const routineLibraryRepository = createRoutineLibraryRepository(localRecordStore);
