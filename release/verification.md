# Release implementation status — 11 October 2026

The implementation is on private branch `codex/web-release-stabilization`, draft PR #1. No release
has been published. This record separates current checks from the retained Fedora history.

## Current evidence

- Node 22.22.2 and pnpm 11.21.0 run from an ignored portable toolchain.
- Frozen installation succeeded; dependency versions and pnpm-lock.yaml are unchanged.
- Formatting, lint, shared/native TypeScript, 101 unit tests in 25 files, 738 catalog entries, 17
  scoring fixtures and complete static export passed.
- Automated publication safeguards pass without worksheets, signatures or native materials. The
  manual catalog approval machinery was removed at the user's request; no review or signature has
  been fabricated.
- The persistence controller serializes complete snapshots. Browser regressions verify atomic
  failure, unavailable/failed storage, legacy conflict recovery, the 100-item recovery limit,
  export/clear/restore, workspace switching, and update/rollback save behavior.
- Linux CI run 38199431094 passed all 115 browser scenarios across all five projects with zero
  retries/skips. WebKit uses a real stopped origin instead of its broken offline-emulation
  navigation API; reload, offline editing and reconnection are covered.
- Windows Firefox launch fails before application loading with `spawn UNKNOWN`. The installed
  executable is unsigned; no execution/security policy has been changed.
- Lighthouse passed the preserved thresholds. This Windows environment requires CHROME_PATH to point
  to the installed Playwright headless-shell binary because the default full browser cannot launch.
  The launcher now honors that override.
- CI exports once and tests that output across all five projects with zero retries/skips. Its
  Lighthouse launch failed because downloaded Chromium lacks a usable Ubuntu sandbox profile. The
  launcher now uses the runner-provided packaged Chrome in CI; thresholds remain unchanged. Final
  complete CI acceptance is pending on that launcher correction.
- The history-free source snapshot installed, passed all project checks and built independently in a
  new temporary Git repository with no .private directory or Fedora inputs.
- The local 24-file web artifact was inventoried and checksum verification passed against its commit
  and catalog digest. Generated artifacts remain ignored.
- GitHub visibility is verified private; administrative and push access are available. The
  production branch is unchanged.

## Operational work still required

- Resolve or provide equivalent browser evidence for every failing browser scenario, including
  supplemental real Safari offline testing.
- The main authoritative MAG rules page was rechecked on 11 October; its Code/Appendix/Specific
  Judges listing dates match the recorded sources. Newsletter completeness remains unverified.
- Preserve Fedora originals until two private copies of correspondence, archive and personal backups
  are possible. They are not build inputs, and no Fedora files have been changed.
- After automated acceptance, create and independently validate the history-free snapshot,
  preserve/rename the existing repository privately, and inspect the new canonical repository before
  making it public.
- Cloudflare Pages project d-score-gymnastics is accessible through the existing browser session.
  Preview 4c4a537e-0a96-4ccd-9287-9e39ccea3d9f built candidate 3c66bcf successfully. All direct
  public routes, 404, MIME types, gzip, default revalidation and absence of telemetry passed.
  Automatic production deployments are disabled; preview builds remain enabled.
- The support mailbox, domain/DNS/certificate setup, production promotion and rollback rehearsal are
  still pending operations.
- No native build/device/App Store work is required to complete web acceptance.

Follow `docs/release.md` and the web deployment checklist. The September verification remains
historical evidence only; its worksheet/second-approver requirements have been superseded.

## Historical Fedora record — superseded release requirements

The record below describes September checks. Its approval workflow is historical; use the current
web checklist instead. Native limitations do not block web acceptance.

### Local release verification — 5 September 2026

This records the current uncommitted release-preparation tree, not a tagged release or approval to
publish. Rerun the full suite against the final committed candidate after the remaining reviews.

## Completed

- `pnpm check`: formatting, ESLint, all three TypeScript projects, 98 tests in 23 files, rules
  validation, and production web export passed. Rules validation covers 738 elements and 17 scoring
  fixtures; the exported service worker precaches 16 URLs totaling about 1.47 MB.
- `pnpm publication:preflight`: passed for web, open-source repository, and iOS App Store. No
  `.private` paths are tracked. The existing private worksheet was preserved when prepared again.
- `pnpm --filter @d-score-gymnastics/app test:e2e --project=chromium --project=firefox --project=mobile-chromium`:
  23 passed; one Firefox offline-lifecycle test intentionally skipped. Includes layout, themes,
  source date/notices, direct routes, accessibility, and offline recovery.
- `pnpm test:lighthouse`: configured budgets passed for `/` and `/app/`.
- `pnpm screenshots:store`: five captures and composition passed. All five images were inspected;
  the score frame now shows its breakdown clearly and Settings shows the actual source cutoff.
- `pnpm release:validate`: metadata and five 1320 × 2868 opaque RGB screenshots passed.
- iOS Metro/Hermes export to an isolated temporary directory passed. This checks JavaScript
  bundling, not native compilation, signing, installation, or device behavior.
- Snapshot and backup-migration commands accept the documented argument separator and reject unsafe
  output locations before creating a file. `git diff --check` passed.

## Intentionally not cleared

- `pnpm publication:check` stops with **Catalog wording still requires human review and approval**.
  The current review requires 245 distinct entries: 189 automatically flagged entries combined with
  a deterministic 77-entry apparatus sample, with overlap. Review technical accuracy, independently
  written expression, aliases, and clarity; some draft labels need rewriting, not merely checking
  off. Gabriel Dabin Cintron reviews; Jose Gabriel Cintron approves.
- Local desktop/mobile WebKit could not launch because this host lacks required system libraries
  (`libicu74` and `libjpeg-turbo8`). Installing dependencies required unavailable interactive sudo.
  CI installs browser dependencies and retains both WebKit projects. A green full browser run is
  still required; the full `release:preflight`/`release:check` suite is not signed off here.
- No signed iOS build, physical-iPhone smoke test, EAS archive/pre-build inspection, TestFlight, or
  App Review was performed. Browser-sized store screenshots remain candidates until compared with
  the shipping native UI, including removal of any web-only installation controls.
- No commit, push, repository visibility change, account setup, DNS change, web deployment, or store
  submission was made. No public snapshot was produced while approval is pending.

## Handoff

Follow [the release process](../docs/release.md), starting with the private wording review. Keep the
old repository/history and `.private` archive private. Refresh screenshots and checks after wording
edits, obtain green full-browser CI and physical-device evidence, then complete the exact-artifact
sign-off before publication.

Reviewed-candidate wording digest (not yet approved):

`sha256:14b273b0f56e41ce5d1297377e3d82cc438af9c86f265f6fdf4cc7fd4757c8c7`
