import { describe, it, expect, vi } from 'vitest';
import { createTelemetryClient, emptyClientState, type ClientStore } from './client';
import { DAY, sanitizeTerm } from './protocol';
function fixture() {
  const state = emptyClientState();
  let at = Date.parse('2026-10-14T12:00Z');
  const store: ClientStore = {
    async change(action) {
      return action(state);
    },
  };
  const send = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
    const input = JSON.parse(String(init?.body)) as { events?: { id: string }[] };
    return Response.json({ accepted: input.events?.map((e) => e.id) ?? [] });
  });
  const client = createTelemetryClient({
    store,
    enabled: true,
    endpoint: 'https://analytics.example',
    version: '1.0.0',
    build: 'a'.repeat(40),
    mode: () => 'browser',
    now: () => at,
    send,
  });
  return {
    state,
    client,
    send,
    advance: (n: number) => {
      at += n;
    },
  };
}
describe('isolated telemetry client', () => {
  it('makes no requests or persistent identities before consent', async () => {
    const { state, client, send } = fixture();
    await client.activity();
    await client.flush();
    expect(send).not.toHaveBeenCalled();
    expect(state.identities).toEqual({});
  });
  it('only emits on session boundaries or a new UTC day', async () => {
    const { state, client, advance } = fixture();
    await client.setConsent({ usage: true, search: false, owner: false });
    await client.activity();
    await client.activity();
    expect(state.queue).toHaveLength(1);
    advance(31 * 60_000);
    await client.activity();
    expect(state.queue).toHaveLength(2);
    advance(DAY);
    await client.activity();
    expect(state.queue).toHaveLength(3);
  });
  it('keeps query text/target evidence behind separate permission and separate identifiers', async () => {
    const { state, client } = fixture();
    await client.setConsent({ usage: true, search: false, owner: false });
    await client.activity();
    await client.search({
      search: crypto.randomUUID(),
      context: crypto.randomUUID(),
      query: 'peach',
      count: 1,
      filters: [],
      zero: 'none',
    });
    expect(state.queue[1]).not.toHaveProperty('query');
    expect(state.queue[0]?.installation).not.toBe(state.queue[1]?.installation);
    await client.setConsent({ usage: true, search: true, owner: false });
    await client.search({
      search: crypto.randomUUID(),
      context: crypto.randomUUID(),
      query: 'peach',
      count: 1,
      filters: [],
      zero: 'none',
    });
    expect(state.queue[2]).toHaveProperty('query', 'peach');
    await client.setConsent({ usage: true, search: false, owner: false });
    expect(state.queue.some((e) => 'query' in e)).toBe(false);
  });
  it('retries unchanged event IDs and only removes acknowledged events', async () => {
    const { state, client, send, advance } = fixture();
    await client.setConsent({ usage: true, search: false, owner: false });
    await client.activity();
    const id = state.queue[0]?.id;
    send.mockRejectedValueOnce(new Error('offline'));
    await client.flush();
    expect(state.queue[0]?.id).toBe(id);
    advance(10_000);
    await client.flush();
    expect(JSON.parse(String(send.mock.calls[1]?.[1]?.body)).events[0].id).toBe(id);
    expect(state.queue).toEqual([]);
  });
  it('caps and expires the queue without changing routine data', async () => {
    const { state, client, advance } = fixture();
    await client.setConsent({ usage: false, search: true, owner: false });
    for (let i = 0; i < 505; i++)
      await client.search({
        search: crypto.randomUUID(),
        context: crypto.randomUUID(),
        query: 'peach',
        count: 1,
        filters: [],
        zero: 'none',
      });
    expect(state.queue).toHaveLength(500);
    advance(8 * DAY);
    await client.flush();
    expect(state.queue).toHaveLength(0);
  });
  it('owner mode purges pending events and prevents collection', async () => {
    const { state, client, send } = fixture();
    await client.setConsent({ usage: true, search: true, owner: false });
    await client.activity();
    await client.setConsent({ usage: true, search: true, owner: true });
    await client.activity();
    await client.flush();
    expect(state.queue).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });
  it('stops collection and retries authorized deletion separately', async () => {
    const { state, client, send } = fixture();
    await client.setConsent({ usage: true, search: false, owner: false });
    await client.activity();
    send.mockRejectedValueOnce(new Error('offline'));
    await expect(client.erase()).rejects.toThrow('queued');
    expect(state.consent.usage).toBe(false);
    expect(state.queue).toEqual([]);
    expect(state.deletions).toHaveLength(1);
  });
  it('screens contact information before normalizing terms', () => {
    for (const input of ['me@example.com', 'https://example.com', '555-123-4567', 'a'.repeat(65)])
      expect(sanitizeTerm(input)).toBeUndefined();
    expect(sanitizeTerm('  Péach! ')).toBe('peach');
    expect(sanitizeTerm('1/1 twist')).toBe('1 1 twist');
  });
});
