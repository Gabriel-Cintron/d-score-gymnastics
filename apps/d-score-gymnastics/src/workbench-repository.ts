import type { StoredWorkbenchState } from './workbench-state';
import { localRecordStore, type LocalRecordStore } from './local-record-store';
import { LOCAL_RECORD_KEYS } from './local-record-store.types';

export interface WorkbenchRepository {
  load(): Promise<unknown | undefined>;
  save(state: StoredWorkbenchState): Promise<void>;
}

export function createWorkbenchRepository(store: LocalRecordStore): WorkbenchRepository {
  return {
    load: () => store.load(LOCAL_RECORD_KEYS.workbench),
    save: (state) => store.save(LOCAL_RECORD_KEYS.workbench, state),
  };
}

export const workbenchRepository = createWorkbenchRepository(localRecordStore);
