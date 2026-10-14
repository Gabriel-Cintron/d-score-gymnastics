import {
  sanitizeTerm,
  type FilterType,
  type ZeroReason,
} from '../../../packages/telemetry/src/protocol';
export interface SearchObservation {
  query: string;
  context: string;
  count: number;
  filters: FilterType[];
  zero: ZeroReason;
}
interface Sink {
  search(event: {
    search: string;
    context: string;
    query?: string;
    count: number;
    filters: FilterType[];
    zero: ZeroReason;
  }): Promise<void>;
  selected(event: {
    search: string;
    context: string;
    target?: string;
    previous?: string;
  }): Promise<void>;
}
export function createSearchTracker(sink: Sink, uuid = () => crypto.randomUUID(), now = Date.now) {
  let last:
    | { key: string; id: string; query: string; context: string; at: number; zero: ZeroReason }
    | undefined;
  let failed: typeof last;
  let pending = Promise.resolve();
  function record(o: SearchObservation): string | undefined {
    const query = sanitizeTerm(o.query);
    // Discard sensitive inputs entirely, even when text permission is disabled.
    if (query === undefined) {
      last = undefined;
      if (o.query.trim()) failed = undefined;
      return undefined;
    }
    const key = JSON.stringify([query, o.context, o.count, o.filters, o.zero]);
    if (last?.key === key) return last.id;
    const id = uuid();
    if ((last && last.context !== o.context) || (failed && failed.context !== o.context))
      failed = undefined;
    last = { key, id, query, context: o.context, at: now(), zero: o.zero };
    if (o.zero === 'no_match') failed = last;
    pending = pending
      .then(() =>
        sink.search({
          search: id,
          context: o.context,
          query,
          count: o.count,
          filters: o.filters,
          zero: o.zero,
        }),
      )
      .catch(() => undefined);
    return id;
  }
  return {
    record,
    select(o: SearchObservation, target: string) {
      const id = record(o);
      if (!id) return;
      const previous =
        failed &&
        failed.id !== id &&
        failed.context === o.context &&
        now() - failed.at <= 60_000 &&
        failed.query !== sanitizeTerm(o.query)
          ? failed.id
          : undefined;
      pending = pending
        .then(() =>
          sink.selected({
            search: id,
            context: o.context,
            target,
            ...(previous ? { previous } : {}),
          }),
        )
        .catch(() => undefined);
    },
    reset() {
      last = undefined;
      failed = undefined;
    },
  };
}
