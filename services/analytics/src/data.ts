import { DAY, hash, utcDay, type TelemetryEvent } from '../../../packages/telemetry/src/protocol';
import type { Database } from './types';

export async function ingest(db: Database, events: TelemetryEvent[], now: number): Promise<void> {
  const statements = [];
  for (const e of events) {
    const installation = await hash(e.installation);
    const purpose = e.type === 'usage' ? 'usage' : 'search';
    statements.push(
      db
        .prepare(
          'INSERT OR IGNORE INTO registry(id,purpose,deletion_hash,first_day) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM events WHERE id=?)',
        )
        .bind(installation, purpose, e.deletionHash, utcDay(e.at), e.id),
    );
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO events(id,installation,type,at,day,version,mode,session,referrer,campaign,search_id,context,query,result_count,filters,zero_reason,target,previous,received_day) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          e.id,
          installation,
          e.type,
          e.at,
          utcDay(e.at),
          `${e.version}@${e.build}`,
          e.mode,
          e.type === 'usage' ? await hash(e.session) : null,
          e.type === 'usage' ? e.referrer : null,
          e.type === 'usage' ? e.campaign : null,
          e.type !== 'usage' ? e.search : null,
          e.type !== 'usage' ? e.context : null,
          e.type === 'search' ? (e.query ?? null) : null,
          e.type === 'search' ? e.count : null,
          e.type === 'search' ? JSON.stringify(e.filters) : null,
          e.type === 'search' ? e.zero : null,
          e.type === 'selected' ? (e.target ?? null) : null,
          e.type === 'selected' ? (e.previous ?? null) : null,
          utcDay(now),
        ),
    );
  }
  await db.batch(statements);
}
export async function erase(
  db: Database,
  installation: string,
  secret: string,
  now = Date.now(),
): Promise<boolean> {
  const id = await hash(installation),
    credential = await hash(secret);
  const existing = await db
    .prepare('SELECT deletion_hash,purpose FROM registry WHERE id=?')
    .bind(id)
    .first<{ deletion_hash: string; purpose: string }>();
  if (existing && existing.deletion_hash !== credential) return false;
  const deletion = [
    db
      .prepare(
        'INSERT INTO erasures VALUES(?,?) ON CONFLICT(id) DO UPDATE SET expires=MAX(expires,excluded.expires)',
      )
      .bind(id, now + 7 * DAY),
    db.prepare('DELETE FROM registry WHERE id=? AND deletion_hash=?').bind(id, credential),
  ];
  try {
    await db.batch([
      ...(existing?.purpose === 'usage' ? snapshotStatements(db, now) : []),
      ...deletion,
    ]);
  } catch {
    await db.batch(deletion);
  } // Erasure remains available if reporting is temporarily unavailable.
  return true;
}
export function scopeFor(version: string, mode: string): string {
  return `${version || '*'}|${mode || '*'}`;
}

function snapshotStatements(db: Database, now: number) {
  const daily = db
    .prepare(
      `WITH RECURSIVE days(day,n) AS (
    SELECT ?,0 UNION ALL SELECT date(day,'-1 day'),n+1 FROM days WHERE n<7
  ), versions(version) AS (SELECT DISTINCT version FROM usage_days), modes(mode) AS (SELECT '*' UNION ALL SELECT 'browser' UNION ALL SELECT 'pwa'), scopes(version,mode) AS (
    SELECT '*',mode FROM modes UNION ALL SELECT version,mode FROM versions CROSS JOIN modes
  ) INSERT INTO summaries(day,scope,dau,wau,mau,monthly,new_users)
  SELECT d.day,s.version||'|'||s.mode,
    COUNT(DISTINCT CASE WHEN u.day=d.day THEN u.installation END),
    COUNT(DISTINCT CASE WHEN u.day>=date(d.day,'-6 day') THEN u.installation END),
    COUNT(DISTINCT CASE WHEN u.day>=date(d.day,'-29 day') THEN u.installation END),
    COUNT(DISTINCT CASE WHEN u.day>=date(d.day,'start of month') THEN u.installation END),
    COUNT(DISTINCT CASE WHEN u.day=d.day AND r.first_day=d.day THEN u.installation END)
  FROM days d CROSS JOIN scopes s LEFT JOIN usage_days u ON u.day BETWEEN MIN(date(d.day,'-29 day'),date(d.day,'start of month')) AND d.day AND (s.version='*' OR u.version=s.version) AND (s.mode='*' OR u.mode=s.mode)
  LEFT JOIN registry r ON r.id=u.installation GROUP BY d.day,s.version,s.mode
  ON CONFLICT(day,scope) DO UPDATE SET dau=excluded.dau,wau=excluded.wau,mau=excluded.mau,monthly=excluded.monthly,new_users=excluded.new_users WHERE summaries.dau<>excluded.dau OR summaries.wau<>excluded.wau OR summaries.mau<>excluded.mau OR summaries.monthly<>excluded.monthly OR summaries.new_users<>excluded.new_users`,
    )
    .bind(utcDay(now));
  return [
    daily,
    ...['mau', 'monthly'].map((metric) =>
      db
        .prepare(
          `INSERT INTO records(scope,metric,value,day) SELECT scope,?,value,day FROM (SELECT scope,day,${metric} value,ROW_NUMBER() OVER(PARTITION BY scope ORDER BY ${metric} DESC,day ASC) rank FROM summaries) WHERE rank=1 AND value>0 ON CONFLICT(scope,metric) DO UPDATE SET value=excluded.value,day=excluded.day WHERE excluded.value>records.value`,
        )
        .bind(metric),
    ),
  ];
}
export async function aggregate(db: Database, now: number): Promise<void> {
  await db.batch(snapshotStatements(db, now));
  await cleanup(db, now);
  await db
    .prepare(
      "INSERT INTO totals(key,value) VALUES('aggregated',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .bind(now)
    .run();
}
export async function cleanup(db: Database, now: number): Promise<void> {
  await db.batch([
    db
      .prepare("DELETE FROM events WHERE (type='usage' AND at<=?) OR (type<>'usage' AND at<=?)")
      .bind(now - 30 * DAY, now - 7 * DAY),
    db.prepare('DELETE FROM search_episodes WHERE at<=?').bind(now - 7 * DAY),
    ...['usage_days', 'sessions', 'selections', 'term_daily'].map((table) =>
      db.prepare(`DELETE FROM ${table} WHERE day<?`).bind(utcDay(now - 90 * DAY)),
    ),
    db.prepare('DELETE FROM erasures WHERE expires<?').bind(now),
    db.prepare('DELETE FROM budget WHERE day<?').bind(utcDay(now - 30 * DAY)),
    db.prepare('DELETE FROM reviews WHERE updated<?').bind(new Date(now - 90 * DAY).toISOString()),
  ]);
}
export interface Filters {
  from: string;
  to: string;
  version: string;
  mode: string;
}
export async function summary(db: Database, f: Filters, now: number) {
  const scope = scopeFor(f.version, f.mode),
    today = utcDay(now);
  const [totals, history, peaks, best, counts, acquisition, versions, gaps, active] =
    await Promise.all([
      db.prepare('SELECT key,value FROM totals').all<{ key: string; value: number }>(),
      db
        .prepare('SELECT * FROM summaries WHERE scope=? AND day BETWEEN ? AND ? ORDER BY day')
        .bind(scope, f.from, f.to)
        .all(),
      db
        .prepare("SELECT day,value AS mau FROM records WHERE scope=? AND metric='mau'")
        .bind(scope)
        .first(),
      db
        .prepare(
          "SELECT substr(day,1,7) AS month,value AS users FROM records WHERE scope=? AND metric='monthly'",
        )
        .bind(scope)
        .first(),
      db
        .prepare(
          "SELECT COALESCE(SUM(sessions),0) sessions,COALESCE(SUM(searches),0) searches,COALESCE(SUM(selected),0) selected FROM daily WHERE day BETWEEN ? AND ? AND (?='' OR version=?) AND (?='' OR mode=?)",
        )
        .bind(f.from, f.to, f.version, f.version, f.mode, f.mode)
        .first(),
      db
        .prepare(
          'SELECT referrer,campaign,SUM(sessions) sessions FROM acquisition WHERE day BETWEEN ? AND ? GROUP BY referrer,campaign ORDER BY sessions DESC LIMIT 50',
        )
        .bind(f.from, f.to)
        .all(),
      db.prepare('SELECT DISTINCT version FROM daily ORDER BY version').all(),
      db.prepare('SELECT * FROM gaps ORDER BY day DESC LIMIT 30').all(),
      db
        .prepare(
          `SELECT COUNT(DISTINCT CASE WHEN day=? THEN installation END) dau,COUNT(DISTINCT CASE WHEN day>=? THEN installation END) wau,COUNT(DISTINCT CASE WHEN day>=? THEN installation END) mau,COUNT(DISTINCT CASE WHEN day>=? THEN installation END) monthly,COUNT(DISTINCT CASE WHEN day>=? AND first_day>=? THEN installation END) new_users,COUNT(DISTINCT CASE WHEN day>=? AND first_day<? THEN installation END) returning_users FROM usage_days JOIN registry ON id=installation WHERE day BETWEEN ? AND ? AND (?='' OR version=?) AND (?='' OR mode=?)`,
        )
        .bind(
          today,
          utcDay(now - 6 * DAY),
          utcDay(now - 29 * DAY),
          today.slice(0, 7) + '-01',
          utcDay(now - 29 * DAY),
          utcDay(now - 29 * DAY),
          utcDay(now - 29 * DAY),
          utcDay(now - 29 * DAY),
          utcDay(now - 29 * DAY) < today.slice(0, 7) + '-01'
            ? utcDay(now - 29 * DAY)
            : today.slice(0, 7) + '-01',
          today,
          f.version,
          f.version,
          f.mode,
          f.mode,
        )
        .first<{
          dau: number;
          wau: number;
          mau: number;
          monthly: number;
          new_users: number;
          returning_users: number;
        }>(),
    ]);
  return {
    totals: Object.fromEntries(totals.results.map((r) => [r.key, r.value])),
    history: history.results,
    peak:
      active && active.mau > Number((peaks as { mau?: number } | null)?.mau ?? 0)
        ? { day: today, mau: active.mau, provisional: true }
        : peaks,
    best:
      active && active.monthly > Number((best as { users?: number } | null)?.users ?? 0)
        ? { month: today.slice(0, 7), users: active.monthly, provisional: true }
        : best,
    counts,
    acquisition: acquisition.results,
    versions: versions.results,
    gaps: gaps.results,
    active,
    definition:
      'Consenting browser profiles/installations; not exact people. UTC reporting. Lifetime totals are unfiltered; active/history counts use selected build and mode. Acquisition and term evidence are unfiltered by build/mode.',
  };
}
export async function searchReport(db: Database, f: Filters) {
  const [terms, filters, reviews, evidence] = await Promise.all([
    db
      .prepare(
        'SELECT term,SUM(searches) searches,SUM(zeros) zeros,SUM(no_match) no_match,SUM(selected) selected,COUNT(DISTINCT installation) contributors FROM term_daily WHERE day BETWEEN ? AND ? GROUP BY term ORDER BY zeros DESC,searches DESC LIMIT 100',
      )
      .bind(f.from, f.to)
      .all(),
    db
      .prepare(
        'SELECT kind,SUM(count) count FROM filter_daily WHERE day BETWEEN ? AND ? GROUP BY kind',
      )
      .bind(f.from, f.to)
      .all(),
    db.prepare('SELECT * FROM reviews').all(),
    db
      .prepare(
        "SELECT term,target,SUM(reformulations) reformulations,COUNT(DISTINCT installation) contributors FROM term_daily WHERE day BETWEEN ? AND ? AND target<>'' AND reformulations>0 GROUP BY term,target",
      )
      .bind(f.from, f.to)
      .all(),
  ]);
  return {
    terms: terms.results,
    filters: filters.results,
    reviews: reviews.results,
    evidence: evidence.results,
  };
}
