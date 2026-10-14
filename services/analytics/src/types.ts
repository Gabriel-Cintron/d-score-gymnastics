export interface Statement {
  bind(...values: (string | number | null)[]): Statement;
  run(): Promise<unknown>;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
}
export interface Env {
  DB: Database;
  INGEST_ENABLED: string;
  ALLOWED_BUILDS: string;
  ACCESS_TEAM: string;
  ACCESS_AUD: string;
  ADMIN_HOST: string;
  COLLECTOR_HOST: string;
  APP_ORIGIN: string;
  DAILY_EVENT_LIMIT: string;
}
