# Optional usage and search analytics

This update has three events only: usage activity, settled search, and search selection. It never
collects routine construction, navigation, scores, warnings, apparatus, general skill popularity,
contact fields, IP addresses, fingerprints or crash reports. The native adapter remains a no-op.

## Metrics and privacy

Users are consenting browser profiles, not exact people. Sessions expire after 30 minutes without
interaction. Only session starts and activity crossing a UTC day emit usage. DAU/WAU/MAU are
distinct installations across 1/7/30 UTC days, not sums of daily counts. Best calendar month and
peak rolling MAU are separate. Current days/months are provisional. Pre-instrumentation usage is
unknown. Lifetime totals are unfiltered. Active/history cards can filter browser/PWA and app
version/build. Acquisition and retained search-term evidence are explicitly unfiltered by
build/mode.

Usage starts off; search-text permission is separate and also off. Usage-only searches omit text,
target IDs and reformulation references. Purpose-specific identifiers are independent. Owner test
mode clears pending events and suppresses collection. The client is disabled outside d-score.app, in
development/previews and automated browsers. Tests never send real analytics.

Storage is a separate `dscore-telemetry` IndexedDB database. Backups do not carry identifiers,
consent or the outbox. Up to 20 events are batched every 30 seconds; retries preserve IDs, respect
Retry-After, and back off with jitter. The 500-event queue expires after seven days. Unavailable
analytics storage prevents collection; routine storage and offline functionality remain independent.
Explicit deletion stops collection and retains only erasure jobs until acknowledged. Removing
browser storage loses the private erasure credential. Anonymous totals remain after deletion.
Managed recovery history can retain earlier records for up to seven additional days. Do not roll
back D1 to recover application code; database recovery requires checking erasures and retention
before serving data.

Raw usage: 30 days. Search episodes: seven days. Linked activity and term evidence: 90 days. Hashed
installation registry: until deletion. Deidentified totals/history/peaks: indefinite. Daily
aggregation repairs eight UTC days for late arrivals and updates historical records. Hourly cleanup
prunes expired data. Active counts are read live; current peaks are provisional. Usage erasure
snapshots anonymous counts atomically before removing linked records. No request-body/header logging
or Worker observability is enabled. Hosting still processes network information for delivery; the
application does not persist it in analytics.

Queries settle after 750 ms; submission/selection flushes the current observation. Empty, unchanged,
and obvious sensitive queries are excluded. Actual filter values and apparatus split LOCAL contexts
but are never sent. Counts distinguish no match, filters, exclusions and sequence restrictions.
Alias ranking runs in the owner browser against public catalog names/aliases. Repeated terms and
same-context, 60-second reformulations supply evidence. Accept/reject/uncertain is a proposal
record, not a live catalog edit. Downloaded proposals require a normal source patch, search
regression and unchanged scoring fixtures. Three contributors raises priority, not legal/semantic
certainty.

## Validation

```sh
pnpm install --frozen-lockfile
pnpm analytics:test
pnpm release:web:preflight
```

The existing CI includes service types and tests. Browser tests cover the dashboard, proposals,
responsive layouts and accessibility, plus the preview/off-by-default boundary. Native declarations
stay unchanged until native capture is separately enabled and disclosed.

## Provision once, then deploy manually

Do not reuse the existing Pages-only token: it cannot deploy Workers or D1. Do not change Pages' Git
binding, origin, routes, service-worker scope, cache headers or artifact upload process.

1. Create separate **dscore-analytics-staging** and **dscore-analytics-production** D1 databases in
   the existing account, using the Free plan. Do not select a routine or unrelated database.
2. Configure Cloudflare Access applications for **admin-staging.d-score.app** and
   **admin.d-score.app**. Use one allow policy containing only the owner's verified email with the
   existing Cloudflare account login. No public/bypass policy. Record each application audience and
   the Access team domain.
3. In the existing GitHub **cloudflare-preview** / **cloudflare-production** environments, add
   `ANALYTICS_D1_ID`, `ANALYTICS_ACCESS_TEAM`, `ANALYTICS_ACCESS_AUD` as variables. Keep the
   existing account ID secret. Production retains owner approval and main-only branch restrictions.
4. Configure a separate account-scoped `CLOUDFLARE_ANALYTICS_API_TOKEN` deployment secret with D1
   Edit, Workers Scripts Edit and only the zone/domain permissions necessary for these custom Worker
   domains. Keep the Pages token untouched; no deployment secret enters PR jobs or source.
5. Run successful main CI, then **Deploy optional analytics**, target preview, with that CI run ID.
   Worker deployment uses pinned Wrangler 4.150.0, applies this service's migrations, and never
   rebuilds the web artifact. Config fails closed without D1/Access settings. workers.dev and
   preview URLs remain disabled. All admin requests independently verify signed Access JWTs.
6. In staging, verify a synthetic session/search, retry the same batch, verify counters, review a
   proposal, and test erasure. The staging collector accepts the app Origin but receives only
   explicit synthetic smoke data; the real app always targets the production collector.
7. Deploy the backend to production first, then preview/promote the existing verified Pages artifact
   using its usual workflow. Confirm both public origins, consent-off zero requests, consent-on
   upload, search-text-off redaction, offline edits, deletion and Access denial before launch.
8. Retain previous instrumented commit SHAs in `ANALYTICS_PREVIOUS_BUILDS` (comma-separated, at most
   31 previous builds), so waiting/offline clients are accepted. Update this on promotion; do not
   silently reject still-supported clients when only backend code changes.

Initial ingestion cap is **2,000 events/day**, configurable up to 10,000 after measuring D1 row
writes/index overhead. The cap is atomic, reports a known collection gap and returns retry advice.
Free limits are finite; inspect Cloudflare D1 rows read/written and database size manually. Do not
upgrade billing automatically. Public client events cannot prove a human: dedup, restricted origins,
approved builds, owner exclusion and a budget reduce pollution, but do not guarantee bot-free
counts. Use those caveats in exported impact reports; never extrapolate opt-in totals to all people.

## Recovery

Stop ingestion with `INGEST_ENABLED=false` and redeploy the same backend. Clients discard queued
telemetry after its 410 response; explicit deletion remains available. Keep D1, installation keys,
aggregate records and routine databases intact. Restore a known-good Pages artifact through the
existing manual recovery process; active service workers update through the normal tested path. A
telemetry outage must never require deleting routine data or changing catalog IDs.

Provisioning, protected staging and production smoke evidence must be recorded before calling this
update live. Preparing source/configuration alone is not an analytics deployment.
