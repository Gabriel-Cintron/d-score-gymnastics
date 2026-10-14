import { describe, it, expect, vi } from 'vitest';
import { authorize } from './access';
import { handle } from './worker';
import { aliasScript } from './aliases';
import { runInNewContext } from 'node:vm';
import { fixture, usage } from './test-fixture';
import type { Env } from './types';
const env = (): Env => ({
  DB: fixture().db,
  INGEST_ENABLED: 'true',
  ALLOWED_BUILDS: 'a'.repeat(40),
  ACCESS_TEAM: 'test.cloudflareaccess.com',
  ACCESS_AUD: 'aud',
  ADMIN_HOST: 'admin.d-score.app',
  COLLECTOR_HOST: 'analytics.d-score.app',
  APP_ORIGIN: 'https://d-score.app',
  DAILY_EVENT_LIMIT: '5000',
});
describe('collector and owner access', () => {
  it('denies anonymous dashboard and API access including alternate hostnames', async () => {
    const e = env();
    for (const host of ['admin.d-score.app', 'unexpected.workers.dev'])
      for (const path of ['/', '/v1/summary', '/v1/search'])
        expect((await handle(new Request(`https://${host}${path}`), e)).status).toBe(
          host === 'admin.d-score.app' ? 403 : 404,
        );
  });
  it('rejects forged Access tokens without trusting decoded claims', async () => {
    const token =
      btoa(JSON.stringify({ alg: 'none' })) +
      '.' +
      btoa(
        JSON.stringify({
          iss: 'https://test.cloudflareaccess.com',
          aud: ['aud'],
          exp: Date.now() / 1000 + 60,
          email: 'owner@example.com',
        }),
      ) +
      '.fake';
    expect(
      await authorize(
        new Request('https://admin.d-score.app', { headers: { 'Cf-Access-Jwt-Assertion': token } }),
        'test.cloudflareaccess.com',
        'aud',
      ),
    ).toBe(false);
  });
  it('only accepts the declared app origin and build', async () => {
    const e = env(),
      event = await usage(undefined, Date.now());
    const request = (origin: string, build: string) =>
      new Request('https://analytics.d-score.app/v1/events', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [{ ...event, build }] }),
      });
    expect((await handle(request('https://evil.example', 'a'.repeat(40)), e)).status).toBe(403);
    expect((await handle(request('https://d-score.app', 'b'.repeat(40)), e)).status).toBe(400);
    expect((await handle(request('https://d-score.app', 'a'.repeat(40)), e)).status).toBe(200);
  });
  it('applies the configured daily cap atomically', async () => {
    const e = { ...env(), DAILY_EVENT_LIMIT: '1' };
    const now = Date.now();
    const r = await handle(
      new Request('https://analytics.d-score.app/v1/events', {
        method: 'POST',
        headers: { Origin: e.APP_ORIGIN, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [await usage(undefined, now), await usage(undefined, now)],
        }),
      }),
      e,
    );
    expect(r.status).toBe(429);
    expect(await e.DB.prepare('SELECT COUNT(*) count FROM registry').first()).toMatchObject({
      count: 0,
    });
  });
  it('kill switch rejects collection without denying deletion', async () => {
    const e = { ...env(), INGEST_ENABLED: 'false' };
    const r = await handle(
      new Request('https://analytics.d-score.app/v1/events', {
        method: 'POST',
        headers: { Origin: e.APP_ORIGIN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [await usage(undefined, Date.now())] }),
      }),
      e,
    );
    expect(r.status).toBe(410);
  });
  it('only ranks proposals and preserves ambiguity', () => {
    const catalog = [
      { id: 'a', name: 'Peach', aliases: [] },
      { id: 'b', name: 'Peaches', aliases: [] },
    ];
    const suggest = runInNewContext(aliasScript + ';DScoreAliases.suggest') as (
      terms: unknown[],
      evidence: unknown[],
      catalog: unknown[],
    ) => { candidates: { id: string }[]; priority: string }[];
    const result = suggest(
      [{ term: 'peache', no_match: 5, contributors: 3 }],
      [{ term: 'peache', target: 'b', contributors: 3, reformulations: 4 }],
      catalog,
    );
    expect(result[0]?.candidates[0]?.id).toBe('b');
    expect(result[0]?.candidates).toHaveLength(2);
    expect(result[0]?.priority).toBe('repeated');
    expect(catalog[0]?.aliases).toEqual([]);
  });
});

describe('signed owner token verification', () => {
  it('accepts a genuine application token and rejects wrong audiences and signatures', async () => {
    const pair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'test-key' };
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const header = encode({ alg: 'RS256', kid: 'test-key' }),
      payload = encode({
        iss: 'https://signed.cloudflareaccess.com',
        aud: ['owner-aud'],
        exp: Date.now() / 1000 + 60,
        email: 'owner@example.com',
      });
    const signature = Buffer.from(
      await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        pair.privateKey,
        new TextEncoder().encode(header + '.' + payload),
      ),
    ).toString('base64url');
    const request = (token: string) =>
      new Request('https://admin.d-score.app', { headers: { 'Cf-Access-Jwt-Assertion': token } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ keys: [jwk] })),
    );
    try {
      expect(
        await authorize(
          request(header + '.' + payload + '.' + signature),
          'signed.cloudflareaccess.com',
          'owner-aud',
        ),
      ).toBe(true);
      expect(
        await authorize(
          request(header + '.' + payload + '.' + signature),
          'signed.cloudflareaccess.com',
          'other-aud',
        ),
      ).toBe(false);
      expect(
        await authorize(
          request(header + '.' + payload + '.invalid'),
          'signed.cloudflareaccess.com',
          'owner-aud',
        ),
      ).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('catalog normalization in the shipped browser script', () => {
  it('normalizes accents and does not damage ordinary names', () => {
    const suggest = runInNewContext(aliasScript + ';DScoreAliases.suggest') as (
      terms: unknown[],
      evidence: unknown[],
      catalog: unknown[],
    ) => { known: boolean }[];
    const result = suggest(
      [{ term: 'peach', no_match: 1, contributors: 1 }],
      [],
      [{ id: 'pb:mag-0001', name: 'Péach', aliases: [] }],
    );
    expect(result[0]?.known).toBe(true);
  });
});
