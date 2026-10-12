# Release acceptance — 1.0.0 web

- [x] Pinned installation, formatting/lint/types, unit tests and scoring fixtures pass.
- [x] Static export, five browser projects, offline/update regressions and Lighthouse pass.
- [x] Source notices, recorded permission/scope and private-file safeguards pass.
- [x] Public source starts from a clean snapshot; development history remains private.
- [x] Verified artifact uploaded without rebuilding; HTTPS and direct routes pass.
- [x] Production save/reload and backup round-trip pass; maintenance rollback is rehearsed.
- [x] Support forwarding rule, destination verification and mail DNS are configured.
- [ ] Independently confirm support email receipt from another mailbox.

The immutable commit, CI, catalog/artifact digests and deployment IDs are recorded in
verification.md. Supplemental physical-browser checks are recorded separately; no native acceptance
is claimed by this web release.

## Future iOS acceptance

Use app-store-submission.md and testflight/what-to-test.md. Run the retained combined
`pnpm release:check` plus `pnpm publication:check -- ios-app-store` for the recorded iOS scope.
Screenshots, the exact native binary, physical-iPhone SQLite persistence/sharing, TestFlight,
signing, metadata and App Review need separate evidence.
