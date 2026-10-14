# Web deployment checklist

This is the reusable checklist for future candidates. Completed v1.0.0 evidence is in
[verification.md](../verification.md) and [release-signoff.md](release-signoff.md). Support mail
receipt and supplemental physical-browser checks remain explicitly unverified.

## Preparation

- [ ] Retain Fedora originals until two private copies of important data are available.
- [ ] Verify archive repository remains private; canonical repository starts from the clean
      snapshot.
- [ ] Confirm automated publication safeguards pass for web and public source.
- [ ] Recheck authoritative rules sources immediately before release.
- [ ] Run `pnpm release:web:check` on the candidate; no native validation is required.
- [ ] Green CI has the verified `web-release` artifact and its manifest.
- [ ] Configure Cloudflare Pages using the exact fields in `docs/release.md`.
- [ ] Disable automatic production promotions; leave GitHub Pages fallback inactive.
- [ ] Verify domain control, HTTPS readiness, previous DNS values, support email and account access.
- [ ] Third-party Analytics and Zaraz remain disabled. Optional first-party usage/search consent,
      deletion, Access protection and offline behavior pass docs/analytics.md.

## Preview and acceptance

- [ ] Record candidate commit, CI run, catalog digest, artifact checksum and preview deployment ID.
- [ ] Load /, /app/, /about/, /support/, /privacy/ directly; unknown routes return the intended 404.
- [ ] Check JS/CSS/manifest MIME types, compression and default revalidation headers.
- [ ] Verify source/license/support links and independence notice.
- [ ] Edit all six events, including a Pommel sequence/location and Vault; verify fixture scores.
- [ ] Save, rename, load and delete routines; switch workspaces using Save/Don't save/Cancel.
- [ ] Acknowledged saves survive reload; export, clear a disposable profile, restore and reload.
- [ ] Reject malformed, incompatible and oversized imports without changing existing data.
- [ ] In all five Playwright projects: online first load, offline reload/edit, reconnect. Record
      supplemental physical Safari/Edge evidence separately.
- [ ] Verify desktop/mobile layouts at 320, 390, 768 and 1280 px, both themes and keyboard controls.
- [ ] No serious/critical Axe issues; Lighthouse meets 0.80 performance, 0.95 accessibility/best
      practices and 0.90 SEO.
- [ ] Same-origin A → B update: Later works, Reload saves first, failed save prevents reload.
- [ ] B → A recovery preserves IndexedDB; supplemental real Safari testing is recorded.
- [ ] No unexplained skipped browser coverage or unexpected data uploads.

## Promotion and recovery

- [ ] Review the separate maintenance artifact and establish an initial production rollback target.
- [ ] Rehearse Pages rollback to a successful production deployment; previews cannot be selected.
- [ ] Confirm rollback never deletes data and service-worker clients receive the restored build.
- [ ] Tag the accepted clean public candidate v1.0.0; manually deploy and record production ID.
- [ ] Bind d-score.app through Pages custom-domain setup, verify DNS/certificate and direct HTTPS
      routes.
- [ ] Repeat persistence, backup, offline and support smoke tests on the canonical origin.
- [ ] Monitor deployment logs, manual smoke checks and support reports after launch.
