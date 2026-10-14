import { describe, it, expect, vi } from 'vitest';
import { createSearchTracker } from './telemetry-search';
const settle = () => new Promise<void>((r) => setTimeout(r, 0));
describe('search observations', () => {
  it('deduplicates settled queries and orders search before selection', async () => {
    const calls: string[] = [],
      search = vi.fn(async () => {
        calls.push('search');
      }),
      selected = vi.fn(async () => {
        calls.push('selected');
      });
    const tracker = createSearchTracker({ search, selected });
    const o = { query: 'Peach', context: 'same', count: 1, filters: [], zero: 'none' as const };
    tracker.record(o);
    tracker.record(o);
    tracker.select(o, 'pb:mag-0001');
    await settle();
    expect(search).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['search', 'selected']);
  });
  it('only associates reformulations inside unchanged contexts', async () => {
    const search = vi.fn(async (_event: unknown) => {
        void _event;
      }),
      selected = vi.fn(async (_event: unknown) => {
        void _event;
      });
    const tracker = createSearchTracker({ search, selected });
    tracker.record({ query: 'peache', context: 'same', count: 0, filters: [], zero: 'no_match' });
    tracker.select(
      { query: 'peach', context: 'same', count: 1, filters: [], zero: 'none' },
      'pb:mag-0001',
    );
    await settle();
    expect(selected.mock.calls[0]?.[0]).toHaveProperty('previous');
    tracker.select(
      { query: 'peach', context: 'different', count: 1, filters: [], zero: 'none' },
      'pb:mag-0001',
    );
    await settle();
    expect(selected.mock.calls[1]?.[0]).not.toHaveProperty('previous');
  });
  it('does not record empty or sensitive search terms', async () => {
    const search = vi.fn(async (_event: unknown) => {
        void _event;
      }),
      selected = vi.fn(async (_event: unknown) => {
        void _event;
      });
    const tracker = createSearchTracker({ search, selected });
    for (const query of ['', 'me@example.com'])
      tracker.record({ query, context: 'same', count: 0, filters: [], zero: 'no_match' });
    await settle();
    expect(search).not.toHaveBeenCalled();
  });
});

it('retains a failed term through clearing the input within the same context', async () => {
  const search = vi.fn(async (_event: unknown) => {
      void _event;
    }),
    selected = vi.fn(async (_event: unknown) => {
      void _event;
    });
  const tracker = createSearchTracker({ search, selected });
  tracker.record({ query: 'peache', context: 'same', count: 0, filters: [], zero: 'no_match' });
  tracker.record({ query: '', context: 'same', count: 30, filters: [], zero: 'none' });
  tracker.select(
    { query: 'peach', context: 'same', count: 1, filters: [], zero: 'none' },
    'pb:mag-0001',
  );
  await settle();
  expect(selected.mock.calls[0]?.[0]).toHaveProperty('previous');
});
