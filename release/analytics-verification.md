# Optional web analytics: production verification

Released 14 October 2026 (EDT), 15 October 2026 (UTC). This supplements the original web launch
record in `release/verification.md`; that record describes the earlier, uninstrumented build.

## Candidate and deployed artifact

- Source: `37ddcc12e5d9a73a783f822f59c95e70c3f5ee2b`, canonical public main.
- CI: https://github.com/Gabriel-Cintron/d-score-gymnastics/actions/runs/38674279435
- Artifact ID: `11945239613` (`web-release`).
- Download archive SHA-256: `d27411c5543ef5c7f3493844cdf46fa0a06887ce4742d89f5df93d8a45f0a97e`.
- Manifest artifact digest:
  `sha256:2bf4152492e7619c6214ef63b9b28a7cea5ee03983445adcea950ba5871fea96`.
- Catalog digest: `sha256:14b273b0f56e41ce5d1297377e3d82cc438af9c86f265f6fdf4cc7fd4757c8c7`.
- Preview Pages deployment: `04905c9f-8aa3-4574-bcb6-8594f49e02b7`.
- Production Pages deployment: `fb548d9c-d2e7-4cc0-87f3-38fb14b8720d`.
- Pages upload: https://github.com/Gabriel-Cintron/d-score-gymnastics/actions/runs/38676346727
- Backend staging: https://github.com/Gabriel-Cintron/d-score-gymnastics/actions/runs/38675064666
- Backend production: https://github.com/Gabriel-Cintron/d-score-gymnastics/actions/runs/38675898287

Both production jobs used the existing main-only protected environment and owner approval. Pages
uploaded the tested artifact without rebuilding. The private archive, original `v1.0.0` tag, Pages
Git binding, routine database, backup schemas and scoring catalog remain unchanged.

## Automated and hosted evidence

- Pinned Node 22.22.2/pnpm 11.21.0; frozen installation, formatting, lint and TypeScript pass.
- 133 unit tests, 738 catalog entries and 17 scoring fixtures pass.
- 130 Playwright scenarios pass across all five existing browser projects, without retries/skips.
- Existing Lighthouse thresholds pass: performance 0.80, accessibility/best practices 0.95, SEO
  0.90.
- Preview matches all 23 artifact assets. Production matches 21 exactly; existing Cloudflare email
  obfuscation transforms only support/privacy HTML. Direct public pages return 200; unknown routes
  return the real 404. `/sw.js` has JavaScript MIME and `public, max-age=0, must-revalidate`.
- Preview isolated-browser smoke passes acknowledged save/reload, actual offline reload/editing,
  backup export/clear/restore/reload, consent defaults off and zero unexpected uploads. The service
  worker scope remains `/app/`.
- Hosted staging verifies unchanged-event retry deduplication, three independent contributors,
  failed/rephrased/selected search evidence, ranked alias mapping, owner review/proposal download,
  CSV export, linked deletion and rejection of erased replay. Synthetic identities were confined to
  staging and erased afterwards; retained staging lifetime/peak totals are synthetic.
- Production owner dashboard loads both tabs with zero initial users/searches. Anonymous summary
  requests redirect to Access login; collector preflight returns 204 and empty batches return 400.
  No production synthetic activity has been submitted.
- A live check caught pre-existing domain-level Cloudflare RUM injection even though the Pages
  project reported Web Analytics disabled. Account Web Analytics had automatic setup enabled for
  d-score.app outside the EU. It was switched to Disable; this is independent of Pages metrics.

## Operating limits and recovery

Dashboard: https://admin.d-score.app/ (owner's existing Cloudflare account login only). Staging:
https://admin-staging.d-score.app/. Only the owner consumes an Access seat; public app visitors do
not. Zero Trust, Workers and D1 remain on Free; no paid upgrade is configured. Initial ingestion is
capped at 2,000 events/day. Inspect actual D1 usage before increasing it; never upgrade
automatically.

Usage and search-text permissions default off independently. Native collection remains disabled.
Counts represent consenting browser profiles/installations, not exact people or all app visitors.
Pre-update history is unknown. Collection start is recorded on the first accepted event; no fake
launch baseline is inserted. Daily history/peaks refresh overnight UTC. Raw usage expires after 30
days, search episodes after seven, linked evidence after 90. Minimal hashed registry and anonymous
totals/peaks persist as documented in `docs/analytics.md`.

The separate analytics deployment credential expires 10 January 2027; rotate before expiry. The
existing Pages credential is unchanged. Keep this candidate SHA in `ANALYTICS_PREVIOUS_BUILDS` when
promoting later instrumented builds so offline/waiting clients remain accepted.

For app recovery, stop promotions and select known-good production Pages deployment
`a4c9a8cd-c5bd-4c26-8d27-ca9625ff6c2f` (original uninstrumented v1.0.0). Preserve IndexedDB. Active
service workers receive restored assets through the normal update path; CDN rollback is not an
instant client replacement. Disable ingestion with `INGEST_ENABLED=false` if necessary while
retaining the deletion endpoint. Never roll back D1 merely to roll back code; preserve erasures and
retention. Alias approval only proposes a source change; it never changes the live catalog.

No native compilation, iPhone testing or App Store evidence is claimed. Physical Safari testing and
long-term traffic/capacity observations remain separate; immediate browser automation and hosted
staging do not establish long-term production reliability.

## Final live acceptance

After the domain-level RUM setting propagated, the production smoke passed in a fresh isolated
Chromium context: acknowledged persistence, offline reload/editing, backup round-trip, both
analytics permissions off, zero unexpected uploads and zero uncaught errors. No ordinary visitor
storage was accessed or cleared. The same smoke had already passed on the exact preview artifact.

The RUM defect was a hosting setting, so the verified application artifact was not rebuilt or
modified to fix it. Domain RUM stays disabled; only the declared optional collector is allowed.
