# Initial production web release — 12 October 2026

Version 1.0.0 is live at https://d-score.app/app/. The public source starts from a sanitized
snapshot; the original development history remains in the private development archive.

## Immutable release identity

- Tag: v1.0.0
- Durable release ZIP, manifest and checksum:
  https://github.com/Gabriel-Cintron/d-score-gymnastics/releases/tag/v1.0.0
- Public candidate: bf0a12ed15a8b63534a8f40db85d5ca63964aab1
- CI: https://github.com/Gabriel-Cintron/d-score-gymnastics/actions/runs/38203325114
- Catalog digest: sha256:14b273b0f56e41ce5d1297377e3d82cc438af9c86f265f6fdf4cc7fd4757c8c7
- Asset inventory digest: sha256:1cf7e9fe5674c81ea126eddb852fa2e63522bbbb39e3d81918732d7cdfca5b6b
- CI artifact ZIP SHA256: 46d907ca4a2fa55c6959ba9e04caa7d67f94d3313499f02abccb705a34778ab3
- Preview: f8841879-6688-48cb-b669-da6afd94703d
- Production: a4c9a8cd-c5bd-4c26-8d27-ca9625ff6c2f
- Production upload: https://github.com/Gabriel-Cintron/d-score-gymnastics/actions/runs/38204450357

## Verified

- Node 22.22.2, pnpm 11.21.0 and frozen installation; manifests/lockfile unchanged.
- Formatting, lint, shared/native TypeScript, 101 unit tests, 738 catalog entries and 17 scoring
  fixtures.
- All 115 browser scenarios across desktop Chromium/Firefox/WebKit and mobile Chromium/WebKit, with
  zero retries or skipped tests. Real stopped-origin offline recovery covers every project.
- Lighthouse: performance >=0.80, accessibility/best practices >=0.95, SEO >=0.90.
- Independent clean snapshot installation/build; private files, credentials, PDFs and old Git
  history excluded. Expo test-server logs are excluded from the deployment artifact.
- The identical 23-file artifact passed inventory verification, matched all preview asset checksums,
  and was uploaded to production without rebuilding.
- Production HTTPS, HTTP-to-HTTPS redirect, five direct public routes, manifest/worker MIME types,
  compression and real 404. Public source and license links resolve anonymously.
- Live acknowledged Manna edit (D-score 0.8) survives reload. Export/clear/restore/reload restores
  the disposable workspace. No JavaScript errors were recorded in that browser session.
- Maintenance rollback target 9d508256-c72a-4331-a715-1882218b03ed was selected successfully; the
  domain served its maintenance notice, the controlled app retained its work, and full application
  deployment 8b00df3f-08ca-4730-b868-e90e9a286183 was restored before final promotion.
- Cloudflare Pages Free; automatic production builds paused. Main-only deployment environments
  separate credentials from PR jobs; production requires an owner review. No application telemetry.
- support@d-score.app forwarding is active with a verified destination and configured mail DNS.
- Browser Cache TTL respects existing origin headers; /sw.js revalidates.

Cloudflare's default email obfuscation transforms the support/privacy HTML on the custom domain; the
other 21 served files match the artifact. The untransformed preview matches all 23. The service
worker still controls /app/ only. Its already-running clients are not instantly replaced by a CDN
rollback; the tested update path preserves local data.

## Explicit limits and follow-up

- Support email receipt has not been independently tested; send a test from a different mailbox.
- Supplemental physical Safari/Edge testing and native iOS/device/App Store acceptance remain
  separate.
- Fedora originals remain untouched. Copy correspondence, archive and personal backups privately
  when the partition is available; those files are not build inputs.
- Main official MAG listing dates were checked on 11 October and match the source record. Newsletter
  completeness beyond the disclosed 2026-08-10 cutoff was not independently established.
- Windows Firefox cannot launch on this host; Linux Firefox passed. No host security policy was
  changed.
- The deployment token was rotated after an echoed value; the replacement is stored in deployment
  secrets and expires 10 January 2027. Rotate it before the next deployment after that date.
- Manual catalog worksheets, samples, second approvers and signature gates are removed. Automated
  scoring/source/private-file safeguards remain; no human catalog approval is asserted.

Release operations were performed by Codex with the repository owner's authorization. See
docs/release.md for promotion/rollback and the separate iOS checklist.
