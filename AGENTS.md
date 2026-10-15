# D-Score Gymnastics

- Web is the initial release; native/device/App Store evidence is a separate future gate.
- Node 22.22.2, pnpm 11.21.0; frozen install only. Do not upgrade dependencies incidentally.
- Run `pnpm release:web:preflight` or `pnpm release:web:check` for automated web acceptance.
  `pnpm check` exports once; use DSCORE_USE_EXISTING_BUILD=1 for E2E/Lighthouse.
- Preserve the pure scoring/ruleset boundary, integer tenths, stable catalog IDs and all six events.
  Labels/aliases may change without changing values/groups or scoring behavior.
- App persistence uses one 150 ms controller and serialized atomic replaceAll of workbench, active
  all-around library snapshot, and preferences. Never reintroduce independent record save timers.
- Keep easyscore database names, current record keys, existing schemas and backup migrations stable.
  Invalid/unreadable records are preserved. Unavailable storage is session-only, never autosaved.
  Restore/reset supersede older queued saves. PWA Reload awaits flush and stops on save failure.
- Fedora originals/private archive/correspondence/personal backups stay private. Do not erase them
  or publish old development history. Never include .private, PDFs, credentials, dependencies or
  generated catalogs in public snapshots. Private migration writes new outputs only.
- Catalog worksheets, samples, second approvers and signature gates have been removed at the user's
  request. Preserve automated scoring/backup/build checks, source notices, recorded rights
  conditions and private-file exclusions. Catalog digests identify contents, not approval.
- Cloudflare Pages keeps its historical Git binding to the private archive. Canonical releases use
  the manual artifact workflow in docs/release.md. A dashboard archive commit link may not resolve a
  public snapshot commit; use canonical source links and the manifest. Artifact deployment reuses
  successful main CI; verify manifest commit/catalog/assets. Never rebuild in the artifact upload
  job or expose deployment secrets to PR jobs.
- Preserve Pages cache headers on the custom domain; Browser Cache TTL should respect existing
  headers. The deployment credential expires 10 January 2027; rotate it before later deployments.
- Keep static /, /app/, /about/, /support/, /privacy/, and real 404.html; SW scope is /app/. No
  catch-all redirects, third-party Analytics or Zaraz. Only the declared optional first-party
  usage/search collector is allowed; native capture stays disabled. Keep the production origin
  stable.
- A CDN rollback cannot instantly replace an active worker. Preserve IndexedDB, test the update path
  and keep a known-good production recovery target. Preview deployments are not rollback targets.
- Changes remain reviewable by phase; environment normalization, persistence and publication changes
  should not be bundled into a single commit.

- Telemetry lives in dscore-telemetry, never routine records/backups. Consent defaults off; search
  text needs separate permission. No routine, score, apparatus, navigation or contact payloads.
  Preserve stable event IDs on retry and atomic server dedup. Alias acceptance is a proposal only.
  Collector failures never block app use. See docs/analytics.md for provisioning and retention.

- Scoring profiles use exact immutable `{ id, revision }` references. FIG remains the default;
  incomplete USAG definitions are disabled until the private manual and six-event fixtures are
  complete. See docs/scoring-profiles.md. Never substitute FIG scoring for unknown profiles.
- Applying/reapplying an all-around profile clears all six overrides. Individual routine loading
  changes only its event's effective profile. Profile changes preserve inputs and relationships.
  Workbench 3/library 4/backup 3 retain older readers; use compatible forward recovery.
- Source PDFs belong only in .private/rule-sources/. Profile digests identify content, not approval.
