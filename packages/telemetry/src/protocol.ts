/** Deliberately excludes routines, scores, apparatus, navigation and user contact fields. */
export const DAY = 86_400_000;
export const MAX_AGE = 7 * DAY;
export const CAMPAIGNS = ['launch', 'instagram', 'club', 'college'] as const;
export type FilterType = 'group' | 'minimum' | 'maximum';
export type ZeroReason = 'none' | 'no_match' | 'filters' | 'excluded' | 'context';
export interface EventBase {
  schema: 1;
  id: string;
  at: number;
  installation: string;
  deletionHash: string;
  platform: 'web';
  mode: 'browser' | 'pwa';
  version: string;
  build: string;
}
export type TelemetryEvent = EventBase &
  (
    | { type: 'usage'; session: string; referrer: string; campaign: string }
    | {
        type: 'search';
        search: string;
        context: string;
        query?: string;
        count: number;
        filters: FilterType[];
        zero: ZeroReason;
      }
    | { type: 'selected'; search: string; context: string; target?: string; previous?: string }
  );
export interface Consent {
  usage: boolean;
  search: boolean;
  owner: boolean;
}
export const DEFAULT_CONSENT: Consent = { usage: false, search: false, owner: false };
export function normalizeTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
export function sanitizeTerm(value: string): string | undefined {
  // Check BEFORE normalization: punctuation removal could disguise contact information.
  if (
    value.length > 64 ||
    /@|https?:\/\/|www\.|\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b|\b[0-9]{1,3}(?:\.[0-9]{1,3}){3}\b|\d[\d\s().+-]{5,}\d|[a-z0-9]{24}/i.test(
      value,
    )
  )
    return undefined;
  const term = normalizeTerm(value);
  return term.length > 0 && term.length <= 64 ? term : undefined;
}
export function utcDay(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}
const token = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9-]{36}$/.test(v);
export function validateEvent(input: unknown, now: number): input is TelemetryEvent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const e = input as Record<string, unknown>;
  const common = [
    'schema',
    'id',
    'at',
    'installation',
    'deletionHash',
    'platform',
    'mode',
    'version',
    'build',
    'type',
  ];
  const fields =
    e.type === 'usage'
      ? ['session', 'referrer', 'campaign']
      : e.type === 'search'
        ? ['search', 'context', 'query', 'count', 'filters', 'zero']
        : e.type === 'selected'
          ? ['search', 'context', 'target', 'previous']
          : [];
  if (fields.length === 0 || Object.keys(e).some((k) => ![...common, ...fields].includes(k)))
    return false;
  if (
    e.schema !== 1 ||
    !token(e.id) ||
    !token(e.installation) ||
    typeof e.deletionHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(e.deletionHash)
  )
    return false;
  if (
    typeof e.at !== 'number' ||
    !Number.isFinite(e.at) ||
    e.at <= now - MAX_AGE ||
    e.at > now + 300_000
  )
    return false;
  if (
    e.platform !== 'web' ||
    !['browser', 'pwa'].includes(String(e.mode)) ||
    typeof e.version !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(e.version) ||
    typeof e.build !== 'string' ||
    !/^[a-f0-9]{40}$/.test(e.build)
  )
    return false;
  if (e.type === 'usage')
    return (
      token(e.session) &&
      typeof e.referrer === 'string' &&
      (e.referrer === '' ||
        (/^[a-z0-9.-]{1,100}$/.test(e.referrer) && !/^([0-9]+\.)*[0-9]+$/.test(e.referrer))) &&
      (e.campaign === '' || CAMPAIGNS.includes(e.campaign as (typeof CAMPAIGNS)[number]))
    );
  if (!token(e.search) || !token(e.context)) return false;
  if (e.type === 'search')
    return (
      Number.isInteger(e.count) &&
      Number(e.count) >= 0 &&
      Number(e.count) <= 1000 &&
      Array.isArray(e.filters) &&
      e.filters.length <= 3 &&
      new Set(e.filters).size === e.filters.length &&
      e.filters.every((f) => ['group', 'minimum', 'maximum'].includes(f)) &&
      ['none', 'no_match', 'filters', 'excluded', 'context'].includes(String(e.zero)) &&
      (e.count === 0) === (e.zero !== 'none') &&
      (e.query === undefined || (typeof e.query === 'string' && sanitizeTerm(e.query) === e.query))
    );
  return (
    (e.target === undefined ||
      (typeof e.target === 'string' && /^[a-z0-9:-]{1,100}$/.test(e.target))) &&
    (e.previous === undefined || token(e.previous))
  );
}
export async function hash(value: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  );
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
