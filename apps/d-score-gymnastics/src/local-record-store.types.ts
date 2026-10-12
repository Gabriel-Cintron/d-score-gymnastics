export const LOCAL_RECORD_KEYS = {
  preferences: 'app-preferences',
  routineLibrary: 'routine-library',
  workbench: 'workbench',
} as const;

export type LocalRecordKey = (typeof LOCAL_RECORD_KEYS)[keyof typeof LOCAL_RECORD_KEYS];

export type LocalRecordSet = Readonly<Record<LocalRecordKey, unknown>>;

export interface LocalRecordStore {
  clearAll(): Promise<void>;
  load(key: LocalRecordKey): Promise<unknown | undefined>;
  replaceAll(records: LocalRecordSet): Promise<void>;
  save(key: LocalRecordKey, value: unknown): Promise<void>;
}
