import { DAY, sanitizeTerm, utcDay, validateEvent } from '../../../packages/telemetry/src/protocol';
import catalog from '../../../packages/rulesets/generated/fig-mag-2025-2028.json';
import { authorize } from './access';
import { aggregate, cleanup, erase, ingest, searchReport, summary, type Filters } from './data';
import { aliasScript } from './aliases';
import { dashboardHtml, dashboardCss, dashboardJs } from './dashboard';
import type { Env } from './types';
const ids = new Set(catalog.elements.map((e) => e.id));
const privateHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(value, { status, headers: { ...privateHeaders, ...headers } });
}
async function body(request: Request): Promise<unknown> {
  if (!request.headers.get('Content-Type')?.startsWith('application/json'))
    throw new Error('content type');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('empty');
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw new Error('size');
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return JSON.parse(new TextDecoder().decode(joined));
}
function filters(url: URL): Filters {
  const now = Date.now(),
    from = url.searchParams.get('from') ?? utcDay(now - 29 * DAY),
    to = url.searchParams.get('to') ?? utcDay(now);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
    !Number.isFinite(Date.parse(from)) ||
    !Number.isFinite(Date.parse(to)) ||
    from > to ||
    Date.parse(to) - Date.parse(from) > 366 * DAY
  )
    throw new Error('date range');
  const version = url.searchParams.get('version') ?? '',
    mode = url.searchParams.get('mode') ?? '';
  if (version && !/^\d+\.\d+\.\d+@[a-f0-9]{40}$/.test(version)) throw new Error('version');
  if (mode && !['browser', 'pwa'].includes(mode)) throw new Error('mode');
  return { from, to, version, mode };
}
export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.hostname === env.ADMIN_HOST) {
    if (!(await authorize(request, env.ACCESS_TEAM, env.ACCESS_AUD)))
      return json({ error: 'Owner access required' }, 403);
    if (
      request.method === 'GET' &&
      ['/', '/dashboard.js', '/dashboard.css', '/aliases.js'].includes(url.pathname)
    ) {
      const content =
        url.pathname === '/'
          ? dashboardHtml
          : url.pathname === '/aliases.js'
            ? aliasScript
            : url.pathname.endsWith('.js')
              ? dashboardJs
              : dashboardCss;
      return new Response(content, {
        headers: {
          ...privateHeaders,
          'Content-Type':
            url.pathname === '/'
              ? 'text/html; charset=utf-8'
              : url.pathname.endsWith('.js')
                ? 'text/javascript; charset=utf-8'
                : 'text/css; charset=utf-8',
          'Content-Security-Policy':
            "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
        },
      });
    }
    try {
      const f = filters(url);
      if (request.method === 'GET' && url.pathname === '/v1/summary')
        return json(await summary(env.DB, f, Date.now()));
      if (request.method === 'GET' && url.pathname === '/v1/search') {
        const report = await searchReport(env.DB, f);
        return json({
          ...report,
          catalog: catalog.elements.map(({ id, name, aliases }) => ({ id, name, aliases })),
        });
      }
      if (request.method === 'POST' && url.pathname === '/v1/review') {
        if (request.headers.get('Origin') !== url.origin) return json({ error: 'Origin' }, 403);
        const input = (await body(request)) as { term?: string; target?: string; status?: string };
        if (
          typeof input.term !== 'string' ||
          sanitizeTerm(input.term) !== input.term ||
          typeof input.target !== 'string' ||
          !ids.has(input.target) ||
          !['accepted', 'rejected', 'uncertain'].includes(input.status ?? '')
        )
          return json({ error: 'Invalid proposal' }, 400);
        await env.DB.prepare(
          'INSERT INTO reviews VALUES(?,?,?,?) ON CONFLICT(term,target) DO UPDATE SET status=excluded.status,updated=excluded.updated',
        )
          .bind(input.term, input.target, String(input.status), new Date().toISOString())
          .run();
        return json({
          proposal: {
            alias: input.term,
            elementId: input.target,
            status: input.status,
            note: 'Source change proposal only. Add a search regression and run scoring fixtures before reviewing and releasing. No catalog change has been applied.',
          },
        });
      }
      return json({ error: 'Not found' }, 404);
    } catch {
      return json({ error: 'Report unavailable or invalid request' }, 400);
    }
  }
  if (url.hostname !== env.COLLECTOR_HOST) return json({ error: 'Not found' }, 404);
  const origin = request.headers.get('Origin');
  if (origin !== env.APP_ORIGIN) return json({ error: 'Origin' }, 403);
  const cors = {
    'Access-Control-Allow-Origin': env.APP_ORIGIN,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: { ...privateHeaders, ...cors } });
  if (request.method !== 'POST') return json({ error: 'Method' }, 405, cors);
  try {
    const input = await body(request);
    if (url.pathname === '/v1/delete') {
      const d = input as { installation?: string; secret?: string };
      if (
        typeof d.installation !== 'string' ||
        !/^[a-f0-9-]{36}$/.test(d.installation) ||
        typeof d.secret !== 'string' ||
        !/^[a-f0-9-]{72}$/.test(d.secret) ||
        Object.keys(d).some((k) => !['installation', 'secret'].includes(k))
      )
        return json({ error: 'Invalid deletion' }, 400, cors);
      if (!(await erase(env.DB, d.installation, d.secret)))
        return json({ error: 'Invalid deletion credential' }, 403, cors);
      return json({ deleted: true }, 200, cors);
    }
    if (url.pathname !== '/v1/events') return json({ error: 'Not found' }, 404, cors);
    if (env.INGEST_ENABLED !== 'true') return json({ error: 'Collection disabled' }, 410, cors);
    const b = input as { events?: unknown };
    if (
      !Array.isArray(b.events) ||
      b.events.length < 1 ||
      b.events.length > 20 ||
      Object.keys(b).some((k) => k !== 'events')
    )
      return json({ error: 'Invalid batch' }, 400, cors);
    const events = b.events,
      now = Date.now(),
      allowed = new Set(env.ALLOWED_BUILDS.split(','));
    if (
      !events.every(
        (e) =>
          validateEvent(e, now) &&
          allowed.has(e.build) &&
          !(e.type === 'selected' && e.target !== undefined && !ids.has(e.target)),
      )
    )
      return json({ error: 'Invalid event or unapproved build' }, 400, cors);
    const limit = Math.max(1, Math.min(10000, Number(env.DAILY_EVENT_LIMIT) || 2000));
    try {
      await env.DB.prepare("UPDATE limits SET value=? WHERE key='daily' AND value<>?")
        .bind(limit, limit)
        .run();
      await ingest(env.DB, events, now);
    } catch (error) {
      if (error instanceof Error && /erased identity|invalid identity/.test(error.message))
        return json({ error: 'Invalid or erased identity' }, 400, cors);
      if (error instanceof Error && error.message.includes('ingestion budget')) {
        await env.DB.prepare(
          "INSERT OR IGNORE INTO gaps VALUES(?,'Daily ingestion budget reached')",
        )
          .bind(utcDay(now))
          .run();
        return json({ error: 'Daily budget' }, 429, { ...cors, 'Retry-After': '3600' });
      }
      return json({ error: 'Temporary collection failure' }, 503, { ...cors, 'Retry-After': '30' });
    }
    return json({ accepted: events.map((e) => e.id) }, 200, cors);
  } catch {
    return json({ error: 'Invalid request' }, 400, cors);
  }
}
export default {
  fetch: handle,
  async scheduled(controller: { cron?: string }, env: Env) {
    if (controller.cron === '37 * * * *') await cleanup(env.DB, Date.now());
    else await aggregate(env.DB, Date.now());
  },
};
