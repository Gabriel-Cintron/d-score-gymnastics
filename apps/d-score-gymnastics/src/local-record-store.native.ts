import * as SQLite from 'expo-sqlite';

import {
  LOCAL_RECORD_KEYS,
  type LocalRecordKey,
  type LocalRecordStore,
} from './local-record-store.types';

// Keep the pre-release filename so development builds retain their local workspaces.
const DATABASE_NAME = 'easyscore.db';
const RECORDS_TABLE = 'local_records';
const STORE_KEYS = Object.values(LOCAL_RECORD_KEYS);

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS ${RECORDS_TABLE} (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `);
    return database;
  });
  return databasePromise;
}

async function putRecord(
  database: Pick<SQLite.SQLiteDatabase, 'runAsync'>,
  key: LocalRecordKey,
  value: unknown,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO ${RECORDS_TABLE} (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    JSON.stringify(value),
  );
}

export const localRecordStore: LocalRecordStore = {
  async clearAll() {
    const database = await openDatabase();
    await database.runAsync(`DELETE FROM ${RECORDS_TABLE}`);
  },

  async load(key) {
    const database = await openDatabase();
    const record = await database.getFirstAsync<{ readonly value: string }>(
      `SELECT value FROM ${RECORDS_TABLE} WHERE key = ?`,
      key,
    );
    return record === null ? undefined : JSON.parse(record.value);
  },

  async replaceAll(records) {
    const database = await openDatabase();
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(`DELETE FROM ${RECORDS_TABLE}`);
      for (const key of STORE_KEYS) await putRecord(transaction, key, records[key]);
    });
  },

  async save(key, value) {
    await putRecord(await openDatabase(), key, value);
  },
};

export type { LocalRecordKey, LocalRecordStore } from './local-record-store.types';
