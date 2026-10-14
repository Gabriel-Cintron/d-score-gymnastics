import { describe, it, expect } from 'vitest';
import { DAY, validateEvent, type TelemetryEvent } from '../../../packages/telemetry/src/protocol';
import { aggregate, erase, ingest, summary, searchReport } from './data';
const time = Date.parse('2026-10-14T12:00:00Z');
import { fixture, usage } from './test-fixture';
const f = { from: '2026-01-01', to: '2026-12-31', version: '', mode: '' };
describe('actual analytics SQL and atomic counters', () => {
  it('deduplicates retried batches and sessions without inflating installations', async () => {
    const { db } = fixture();
    const e = await usage();
    await ingest(db, [e, e], time);
    await ingest(db, [e, { ...e, id: crypto.randomUUID() }], time);
    const r = await summary(db, f, time);
    expect(r.totals.users).toBe(1);
    expect(r.totals.sessions).toBe(1);
    expect(r.active).toMatchObject({ dau: 1, wau: 1, mau: 1 });
  });
  it('does not count a new installation attached to a duplicate event ID', async () => {
    const { db } = fixture();
    const e = await usage();
    await ingest(db, [e], time);
    await ingest(db, [{ ...e, installation: crypto.randomUUID() }], time);
    expect((await summary(db, f, time)).totals.users).toBe(1);
    expect(await db.prepare('SELECT COUNT(*) count FROM registry').first()).toMatchObject({
      count: 1,
    });
  });
  it('retains historical records and lifetime uniqueness after raw data cleanup', async () => {
    const { db } = fixture();
    const e = await usage();
    const other = await usage();
    await ingest(db, [e, other], time);
    await aggregate(db, time);
    await aggregate(db, time + 100 * DAY);
    const again = await usage(e.installation, time + 100 * DAY);
    await ingest(db, [again], time + 100 * DAY);
    const r = await summary(db, f, time + 100 * DAY);
    expect(r.totals.users).toBe(2);
    expect(r.peak).toMatchObject({ mau: 2 });
    expect(r.active).toMatchObject({ mau: 1, new_users: 0, returning_users: 1 });
  });
  it('counts calendar months separately from a rolling 30-day window', async () => {
    const { db } = fixture();
    const now = Date.parse('2026-11-02T12:00Z');
    await ingest(db, [await usage(undefined, now - 4 * DAY), await usage(undefined, now)], now);
    await aggregate(db, now);
    const r = await summary(db, f, now);
    expect(r.peak).toMatchObject({ mau: 2 });
    expect(r.best).toMatchObject({ users: 1 });
  });
  it('rolls back a batch at the budget boundary', async () => {
    const { db } = fixture();
    await db.prepare('UPDATE limits SET value=1').run();
    await expect(ingest(db, [await usage(), await usage()], time)).rejects.toThrow(
      'ingestion budget',
    );
    expect((await summary(db, f, time)).totals.users).toBeUndefined();
  });
  it('requires the erasure credential and preserves anonymous lifetime totals', async () => {
    const { db } = fixture();
    const e = await usage();
    await ingest(db, [e], time);
    await erase(db, e.installation, 'wrong');
    expect((await summary(db, f, time)).active).toMatchObject({ dau: 1 });
    await erase(db, e.installation, 'secret');
    const r = await summary(db, f, time);
    expect(r.active).toMatchObject({ dau: 0 });
    expect(r.totals.users).toBe(1);
  });
  it('blocks an in-flight old event from resurrecting erased records', async () => {
    const { db } = fixture();
    const e = await usage();
    await ingest(db, [e], time);
    expect(await erase(db, e.installation, 'secret', time)).toBe(true);
    await expect(ingest(db, [{ ...e, id: crypto.randomUUID() }], time)).rejects.toThrow(
      'erased identity',
    );
    expect((await summary(db, f, time)).active).toMatchObject({ dau: 0 });
  });
  it('preserves anonymous peaks when erasure happens before scheduled aggregation', async () => {
    const { db } = fixture();
    const e = await usage();
    await ingest(db, [e], time);
    expect((await summary(db, f, time)).peak).toMatchObject({ mau: 1 });
    await erase(db, e.installation, 'secret', time);
    const report = await summary(db, f, time);
    expect(report.active).toMatchObject({ dau: 0 });
    expect(report.peak).toMatchObject({ mau: 1 });
    expect(report.best).toMatchObject({ users: 1 });
  });
  it('counts search selection once and verifies reformulation context', async () => {
    const { db } = fixture();
    const base = await usage();
    const context = crypto.randomUUID(),
      first = crypto.randomUUID(),
      second = crypto.randomUUID();
    const search: TelemetryEvent = {
      ...base,
      type: 'search',
      search: first,
      context,
      query: 'peache',
      count: 0,
      filters: [],
      zero: 'no_match',
    };
    const later: TelemetryEvent = {
      ...search,
      id: crypto.randomUUID(),
      at: time + 1000,
      search: second,
      query: 'peach',
      count: 1,
      zero: 'none',
    };
    const selected: TelemetryEvent = {
      ...base,
      id: crypto.randomUUID(),
      at: time + 2000,
      type: 'selected',
      search: second,
      context,
      target: 'pb:mag-0001',
      previous: first,
    };
    await ingest(
      db,
      [search, later, selected, { ...selected, id: crypto.randomUUID() }],
      time + 2000,
    );
    expect((await summary(db, f, time)).counts).toMatchObject({ searches: 2, selected: 1 });
    const report = await searchReport(db, f);
    expect(report.evidence).toMatchObject([
      { term: 'peache', target: 'pb:mag-0001', reformulations: 1, contributors: 1 },
    ]);
  });
  it('does not turn filter or changed-context failures into alias evidence', async () => {
    const { db } = fixture();
    const base = await usage(),
      first = crypto.randomUUID(),
      second = crypto.randomUUID();
    const search: TelemetryEvent = {
      ...base,
      type: 'search',
      search: first,
      context: crypto.randomUUID(),
      query: 'peach',
      count: 0,
      filters: ['group'],
      zero: 'filters',
    };
    const later: TelemetryEvent = {
      ...search,
      id: crypto.randomUUID(),
      search: second,
      context: crypto.randomUUID(),
      count: 1,
      zero: 'none',
    };
    await ingest(
      db,
      [
        search,
        later,
        {
          ...base,
          id: crypto.randomUUID(),
          type: 'selected',
          search: second,
          context: later.context,
          target: 'pb:mag-0001',
          previous: first,
        },
      ],
      time,
    );
    expect((await searchReport(db, f)).evidence).toEqual([]);
  });
  it('rejects unwanted fields, identifiers disguised as queries and unsupported platforms', async () => {
    const e = await usage();
    expect(validateEvent(e, time)).toBe(true);
    expect(validateEvent({ ...e, routine: 'private' }, time)).toBe(false);
    expect(validateEvent({ ...e, platform: 'ios' }, time)).toBe(false);
    expect(validateEvent({ ...e, at: time - 7 * DAY }, time)).toBe(false);
  });
});
