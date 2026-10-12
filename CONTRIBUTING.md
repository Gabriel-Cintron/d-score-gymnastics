# Contributing to D-Score Gymnastics

D-Score Gymnastics welcomes focused bug fixes, accessibility improvements, and source-backed rules
or catalogue corrections. Open an issue before beginning a broad product or architecture change.

## Development

Use Node.js 22.22.x and pnpm 11.21.0. From the repository root:

```sh
pnpm install
pnpm check
```

Run `pnpm test:e2e` for the production browser suite. Rules changes follow the YAML-first workflow
in [Rules-data maintenance](docs/rules-data-maintenance.md): cite the governing source, update a
readable fixture when behavior changes, and run both `pnpm rules:check` and `pnpm check`.

Keep scoring logic in the platform-independent packages. The Expo application may present scorer
results but must not recreate rules policies in React components. Preserve stable discipline,
ruleset, catalogue, occurrence, and saved-data identifiers unless a migration is included.

## Source and rights hygiene

- Describe rule corrections in your own words and cite the publication and page or section.
- Do not commit rulebook scans, long copied passages, third-party artwork, or credentials.
- Do not imply endorsement by a governing body.
- Keep distribution permission records private; commit only the status and non-sensitive evidence
  reference described in [Data rights](docs/data-rights.md).

## Pull requests

- Keep changes narrow and explain user-visible behavior.
- Include tests for logic and regressions.
- Do not commit generated rules data, Expo output, browser reports, or personal device credentials.
- Confirm formatting, lint, types, unit tests, rules validation, and web export before review.
- Run `pnpm release:check` when changing release assets, public pages, metadata, or deployment code.
