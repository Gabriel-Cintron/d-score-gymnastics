import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { hash, type TelemetryEvent } from '../../../packages/telemetry/src/protocol';
import type { Database, Statement } from './types';
const time = Date.parse('2026-10-14T12:00:00Z');
export function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_analytics.sql', import.meta.url), 'utf8'));
  class Prepared implements Statement {
    constructor(
      readonly sql: string,
      readonly params: (string | number | null)[] = [],
    ) {}
    bind(...params: (string | number | null)[]) {
      return new Prepared(this.sql, params);
    }
    async run() {
      return sqlite.prepare(this.sql).run(...this.params);
    }
    async all<T>() {
      return { results: sqlite.prepare(this.sql).all(...this.params) as T[] };
    }
    async first<T>() {
      return (sqlite.prepare(this.sql).get(...this.params) as T | undefined) ?? null;
    }
  }
  const db: Database = {
    prepare: (sql) => new Prepared(sql),
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return { db, sqlite };
}
export async function usage(
  installation: string = crypto.randomUUID(),
  at = time,
): Promise<TelemetryEvent> {
  return {
    schema: 1,
    id: crypto.randomUUID(),
    at,
    installation,
    deletionHash: await hash('secret'),
    platform: 'web',
    mode: 'browser',
    version: '1.0.0',
    build: 'a'.repeat(40),
    type: 'usage',
    session: crypto.randomUUID(),
    referrer: '',
    campaign: '',
  };
}
