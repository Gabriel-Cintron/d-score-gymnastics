import {
  DEFAULT_CONSENT,
  DAY,
  MAX_AGE,
  hash,
  utcDay,
  validateEvent,
  type Consent,
  type TelemetryEvent,
} from './protocol';
interface Identity {
  id: string;
  secret: string;
  deletionHash: string;
}
export interface ClientState {
  consent: Consent;
  identities: Partial<Record<'usage' | 'search', Identity>>;
  queue: TelemetryEvent[];
  deletions: Identity[];
  asked?: boolean;
  session?: { id: string; last: number; day: string; mode?: 'browser' | 'pwa' };
}
export function emptyClientState(): ClientState {
  return { consent: { ...DEFAULT_CONSENT }, identities: {}, queue: [], deletions: [] };
}
export interface ClientStore {
  change<T>(action: (state: ClientState) => T): Promise<T>;
}
export interface ClientOptions {
  store: ClientStore;
  enabled: boolean;
  endpoint: string;
  version: string;
  build: string;
  mode: () => 'browser' | 'pwa';
  now?: () => number;
  send?: typeof fetch;
  uuid?: () => string;
}
export function createTelemetryClient(options: ClientOptions) {
  const now = options.now ?? Date.now,
    uuid = options.uuid ?? (() => crypto.randomUUID()),
    send = options.send ?? fetch;
  let sending: Promise<void> | undefined,
    retryAt = 0,
    attempts = 0,
    disabled = false;
  const allowed = () => options.enabled && !disabled;
  const makeIdentity = async (): Promise<Identity> => {
    const secret = uuid() + uuid();
    return { id: uuid(), secret, deletionHash: await hash(secret) };
  };
  async function enqueue(
    type: 'usage' | 'search',
    build: (identity: Identity, state: ClientState) => TelemetryEvent | undefined,
  ): Promise<void> {
    if (!allowed()) return;
    const fresh = await makeIdentity();
    await options.store.change((state) => {
      if (
        state.consent.owner ||
        !(type === 'usage' ? state.consent.usage : state.consent.usage || state.consent.search)
      )
        return;
      const identity = state.identities[type] ?? fresh;
      state.identities[type] = identity;
      const event = build(identity, state);
      state.queue = state.queue.filter((e) => e.at > now() - MAX_AGE);
      if (event) state.queue.push(event);
      state.queue = state.queue.slice(-500);
    });
  }
  function base(identity: Identity) {
    return {
      schema: 1 as const,
      id: uuid(),
      at: now(),
      installation: identity.id,
      deletionHash: identity.deletionHash,
      platform: 'web' as const,
      mode: options.mode(),
      version: options.version,
      build: options.build,
    };
  }
  return {
    async consent(): Promise<Consent> {
      return options.store.change((s) => ({ ...s.consent }));
    },
    async setConsent(consent: Consent): Promise<void> {
      await options.store.change((s) => {
        s.consent = { ...consent };
        s.queue = s.queue.filter(
          (e) =>
            !consent.owner &&
            (e.type === 'usage' ? consent.usage : consent.usage || consent.search),
        );
        if (!consent.search) {
          s.queue = s.queue.map((e) => {
            if (e.type === 'search') {
              const safe = { ...e };
              delete safe.query;
              return safe;
            }
            if (e.type === 'selected') {
              const safe = { ...e };
              delete safe.target;
              delete safe.previous;
              return safe;
            }
            return e;
          });
        }
        if (!consent.usage || consent.owner) delete s.session;
      });
    },
    async activity(referrer = '', campaign = ''): Promise<void> {
      await enqueue('usage', (identity, s) => {
        const time = now(),
          day = utcDay(time),
          newSession = !s.session || time - s.session.last >= 30 * 60_000;
        const mode = options.mode();
        const emit = newSession || s.session?.day !== day || s.session?.mode !== mode;
        s.session = { id: newSession ? uuid() : (s.session?.id ?? uuid()), last: time, day, mode };
        return emit
          ? { ...base(identity), type: 'usage', session: s.session.id, referrer, campaign }
          : undefined;
      });
    },
    async search(event: {
      search: string;
      context: string;
      query?: string;
      count: number;
      filters: ('group' | 'minimum' | 'maximum')[];
      zero: 'none' | 'no_match' | 'filters' | 'excluded' | 'context';
    }): Promise<void> {
      await enqueue('search', (identity, s) => {
        const { query, ...counts } = event;
        return {
          ...base(identity),
          type: 'search',
          ...counts,
          ...(s.consent.search && query !== undefined ? { query } : {}),
        };
      });
    },
    async selected(event: {
      search: string;
      context: string;
      target?: string;
      previous?: string;
    }): Promise<void> {
      await enqueue('search', (identity, s) => {
        const { target, previous, ...counts } = event;
        return {
          ...base(identity),
          type: 'selected',
          ...counts,
          ...(s.consent.search && target !== undefined ? { target } : {}),
          ...(s.consent.search && previous !== undefined ? { previous } : {}),
        };
      });
    },
    async erase(): Promise<void> {
      await options.store.change((s) => {
        s.deletions.push(...Object.values(s.identities));
        s.deletions = Array.from(new Map(s.deletions.map((i) => [i.id, i])).values());
        s.identities = {};
        s.queue = [];
        s.consent = { ...DEFAULT_CONSENT };
        delete s.session;
      });
      // Explicit deletion requests work even when normal event collection is off.
      retryAt = 0;
      await this.flush();
      const pending = await options.store.change((s) => s.deletions.length);
      if (pending)
        throw new Error('Collection stopped. Deletion is queued until a connection is available.');
    },
    flush(): Promise<void> {
      if (sending) return sending;
      if (!options.enabled || now() < retryAt) return Promise.resolve();
      sending = (async () => {
        let deletion = await options.store.change((s) => s.deletions[0]);
        while (deletion) {
          const response = await send(options.endpoint + '/v1/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ installation: deletion.id, secret: deletion.secret }),
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
          });
          if (!response.ok) throw new Error('deletion unavailable');
          await options.store.change((s) => {
            s.deletions = s.deletions.filter((i) => i.id !== deletion?.id);
          });
          deletion = await options.store.change((s) => s.deletions[0]);
        }
        if (!allowed()) return;
        const batch = await options.store.change((s) => {
          s.queue = s.queue.filter((e) => validateEvent(e, now()));
          return s.queue.slice(0, 20);
        });
        if (!batch.length) return;
        const response = await send(options.endpoint + '/v1/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: batch }),
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        if (response.status === 410) {
          disabled = true;
          await options.store.change((s) => {
            s.queue = [];
          });
          return;
        }
        if (response.status === 429 || response.status >= 500) {
          const delay = Number(response.headers.get('Retry-After'));
          if (Number.isFinite(delay) && delay > 0) retryAt = now() + Math.min(delay * 1000, DAY);
          throw new Error('retry');
        }
        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) {
            await options.store.change((s) => {
              const ids = new Set(batch.map((e) => e.id));
              s.queue = s.queue.filter((e) => !ids.has(e.id));
            });
            return;
          }
          throw new Error('retry');
        }
        const body = (await response.json()) as { accepted?: unknown };
        if (!Array.isArray(body.accepted) || !body.accepted.every((id) => typeof id === 'string'))
          throw new Error('bad acknowledgement');
        const accepted = new Set(body.accepted);
        await options.store.change((s) => {
          s.queue = s.queue.filter((e) => !accepted.has(e.id));
        });
        attempts = 0;
        retryAt = 0;
      })()
        .catch(() => {
          attempts++;
          retryAt = Math.max(
            retryAt,
            now() +
              Math.min(300_000, 1000 * 2 ** Math.min(attempts, 8)) * (0.75 + Math.random() / 2),
          );
        })
        .finally(() => {
          sending = undefined;
        });
      return sending;
    },
  };
}
