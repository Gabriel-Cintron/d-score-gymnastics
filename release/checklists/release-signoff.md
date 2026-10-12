# Release signoff — 1.0.0

## Web acceptance

- [ ] Pinned installation, formatting/lint/types, unit tests and rules fixtures pass.
- [ ] Static export, five browser projects, offline/update regressions and Lighthouse pass.
- [ ] Source notices, recorded permission/scope and private-file safeguards pass.
- [ ] Public repository has clean snapshot history; development archive remains private.
- [ ] All preview and production checks in web-deployment.md are evidenced.
- [ ] Artifact identity, support contact, HTTPS and rollback rehearsal are verified.

Candidate commit: CI run: Catalog digest: Artifact checksum: Source-use signer/date: Preview
deployment ID: Production deployment ID: Last known-good production recovery target: Browser/manual
evidence: Operator/date:

## Future iOS acceptance (does not block web)

Use app-store-submission.md and testflight/what-to-test.md. Run the retained combined
`pnpm release:check` plus `pnpm publication:check -- ios-app-store` for the recorded iOS scope.
Screenshots, exact native binary, physical-iPhone SQLite persistence and sharing, TestFlight,
signing, metadata and App Review require separate evidence.

iOS EAS build ID: App Store version/build: Native/device evidence: iOS operator/date:
