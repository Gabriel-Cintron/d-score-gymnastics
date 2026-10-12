# Roadmap

Development proceeds from the scoring foundation outward. Product UI does not drive or contain
scoring behavior.

## 1. Foundation and architecture — complete

The pnpm workspace, strict TypeScript boundaries, pure integer scoring kernel, deterministic
results, formatting, lint, tests, and CI are established.

## 2. Rules-data pipeline and FIG MAG implementation — complete

Strict YAML schemas, semantic validation, generated runtime data, source-linked maintenance, and
human-readable scoring fixtures are complete. The reviewed 2025–2028 senior MAG ruleset contains 738
catalogue records and 17 fixtures across all six events, with a source cutoff of 10 August 2026.

## 3. Product application — complete for 1.0

The universal Expo client includes Home and onboarding, six-event routine editing, event-specific
controls, structured explanations, named routines, all-around workspaces, IndexedDB/SQLite
persistence, versioned backup/restore, Settings, dark mode, accessibility affordances, and
local-data deletion.

## 4. Release hardening and materials — complete for 1.0

The static marketing/legal site, `/app/` PWA packaging, explicit updates, browser and accessibility
automation, Lighthouse budgets, metadata, App Review notes, TestFlight plan, five deterministic
store screenshots, release validators, GitHub Pages workflow, security policy, rights register, and
operator checklists are present.

## 5. Deployment — external release gate

The remaining work is operator sign-off and deployment rather than product development:

1. Run the automated source/publication safeguards, then clear `pnpm publication:check`.
2. Purchase/configure `d-score.app`, HTTPS, support email, Apple/Expo access, and App Store Connect.
3. Create the fresh history-free public repository from the sanitized snapshot and require green CI.
4. Run the final release suite from the tagged commit and deploy the web artifact.
5. Inspect and test the exact iPhone candidate internally, submit it for App Review, and release
   manually.

See [Release process](release.md) and the checklists under `release/checklists`.

## 6. Post-release stabilization

Prioritize confirmed scoring corrections, crash or data-loss defects, browser/device regressions,
accessibility findings, and documentation drift. Keep the no-account/local-first promise unless a
separately designed feature explicitly changes it. The start/end-position connection-compatibility
model remains a possible patch after real-world use proves its value.

## 7. Gymnastics expansion

After MAG 1.0 is stable, validate a discipline registry against difficult cases from women's
artistic gymnastics, likely the first added discipline. Reuse the pure kernel, data validation,
storage, backup, and application shell; add discipline-owned events, rules, scoring policies, and
UI. Then evaluate junior/NCAA programs, other artistic disciplines, translations, and Android
release based on demand and rights availability.
