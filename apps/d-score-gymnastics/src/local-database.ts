import { LOCAL_RECORD_KEYS } from './local-record-store.types';

export const WORKBENCH_STORE_NAME = LOCAL_RECORD_KEYS.workbench;
export const ROUTINE_LIBRARY_STORE_NAME = LOCAL_RECORD_KEYS.routineLibrary;
export const APP_PREFERENCES_STORE_NAME = LOCAL_RECORD_KEYS.preferences;
export const CURRENT_RECORD_KEY = 'current';

// Keep the pre-release database name so existing local workspaces survive the public rebrand.
const DATABASE_NAME = 'easyscore';
const DATABASE_VERSION = 3;

export function openDScoreGymnasticsDatabase(): Promise<IDBDatabase> {
  if (globalThis.indexedDB === undefined) {
    return Promise.reject(new Error('Local storage is unavailable in this browser.'));
  }
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Unable to open local storage.'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(WORKBENCH_STORE_NAME)) {
        database.createObjectStore(WORKBENCH_STORE_NAME);
      }
      if (!database.objectStoreNames.contains(ROUTINE_LIBRARY_STORE_NAME)) {
        database.createObjectStore(ROUTINE_LIBRARY_STORE_NAME);
      }
      if (!database.objectStoreNames.contains(APP_PREFERENCES_STORE_NAME)) {
        database.createObjectStore(APP_PREFERENCES_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('Local storage request failed.'));
    request.onsuccess = () => resolve(request.result);
  });
}

export function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Local storage transaction was aborted.'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Local storage transaction failed.'));
    transaction.oncomplete = () => resolve();
  });
}
