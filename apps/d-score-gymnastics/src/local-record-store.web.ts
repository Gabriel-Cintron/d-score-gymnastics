import {
  CURRENT_RECORD_KEY,
  openDScoreGymnasticsDatabase,
  requestResult,
  transactionComplete,
} from './local-database';
import { LOCAL_RECORD_KEYS, type LocalRecordStore } from './local-record-store.types';

const STORE_NAMES = Object.values(LOCAL_RECORD_KEYS);

async function commitWrites(transaction: IDBTransaction, enqueue: () => void): Promise<void> {
  const completed = transactionComplete(transaction);
  try {
    enqueue();
    await completed;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // A failed asynchronous request may already have aborted the transaction.
    }
    await completed.catch(() => undefined);
    throw error;
  }
}

export const localRecordStore: LocalRecordStore = {
  async clearAll() {
    const database = await openDScoreGymnasticsDatabase();
    try {
      const transaction = database.transaction(STORE_NAMES, 'readwrite');
      await commitWrites(transaction, () => {
        STORE_NAMES.forEach((storeName) => transaction.objectStore(storeName).clear());
      });
    } finally {
      database.close();
    }
  },

  async load(key) {
    const database = await openDScoreGymnasticsDatabase();
    try {
      const transaction = database.transaction(key, 'readonly');
      const completed = transactionComplete(transaction);
      const [value] = await Promise.all([
        requestResult(transaction.objectStore(key).get(CURRENT_RECORD_KEY)),
        completed,
      ]);
      return value;
    } finally {
      database.close();
    }
  },

  async replaceAll(records) {
    const database = await openDScoreGymnasticsDatabase();
    try {
      const transaction = database.transaction(STORE_NAMES, 'readwrite');
      await commitWrites(transaction, () => {
        STORE_NAMES.forEach((storeName) => {
          transaction.objectStore(storeName).put(records[storeName], CURRENT_RECORD_KEY);
        });
      });
    } finally {
      database.close();
    }
  },

  async save(key, value) {
    const database = await openDScoreGymnasticsDatabase();
    try {
      const transaction = database.transaction(key, 'readwrite');
      await commitWrites(transaction, () => {
        transaction.objectStore(key).put(value, CURRENT_RECORD_KEY);
      });
    } finally {
      database.close();
    }
  },
};

export type { LocalRecordKey, LocalRecordStore } from './local-record-store.types';
