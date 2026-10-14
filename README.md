# D-Score Gymnastics

D-Score Gymnastics is a free, open-source, local-first difficulty calculator for competitive
gymnastics. Version 1.0 supports current senior men's artistic gymnastics across all six events.
Athletes, coaches, and judges can build counted routines, search a 738-element catalogue, and
inspect an explained D-score without creating an account or sending routine data to a server.

The calculator assumes selected elements receive technical recognition. It does not judge execution,
neutral deductions, or official competition results.

## Release status

The product, rules-data pipeline, scoring kernel, universal Expo application, public website,
privacy and support pages, App Store copy, screenshots, and release checks are prepared for version
1.0.0. The World Gymnastics response and its conditions are recorded for all intended channels.
Public distribution remains intentionally blocked until the generated independent catalog wording
review is completed and approved for its exact digest.

The current ruleset contains 738 catalogue entries and 17 human-readable fixtures. It covers typed
connections, Pommel Horse Flop/Combined sequences and locations, occurrence variants,
apparatus-specific repetition, landing bonus, element-group credit, and Vault's separate calculation
path. The source cutoff is 10 August 2026.

The Expo application provides:

- A responsive Home dashboard and replayable first-run tour.
- Six-event all-around workspaces plus a named event-routine catalogue.
- Search, difficulty and group filters, counted-skill slots, and duplicate hiding.
- Live, structured score explanations with apparatus-specific controls.
- Local persistence through IndexedDB on web and SQLite on native.
- Validated, versioned backup/restore and explicit local-data deletion.
- Dark and light themes, safe-area handling, offline web use, and explicit updates.

There is no account, advertising, crash-reporting service, or routine cloud synchronization. Web
usage and search diagnostics are optional, off by default, and controlled in Settings.

## Development

Requirements:

- Node.js 22.22.x
- pnpm 11.21.0

Install and run the normal verification suite:

```sh
pnpm install
pnpm check
```

Start the web application:

```sh
pnpm web
```

Useful commands:

```sh
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm rules:check
pnpm web:export
pnpm test:e2e
pnpm test:lighthouse
pnpm screenshots:store
pnpm release:validate
pnpm publication:preflight
pnpm release:preflight
pnpm publication:check
pnpm release:check
pnpm --filter @d-score-gymnastics/rulesets routine:explain path/to/routine.yaml
```

`pnpm release:web:check` runs automated web release checks without catalog worksheets or manual
signatures. `pnpm release:web:preflight` is a compatibility alias for the same safeguards. See the
release process for Cloudflare Pages setup, the history-free public snapshot, and future iOS work.

## Repository structure

```text
apps/d-score-gymnastics   Expo application and static release site
packages/scoring          Platform-independent scoring contracts and kernel
packages/rulesets         YAML rules, validation, compilation, and FIG MAG evaluator
release                   Store metadata, screenshots, test notes, and sign-off checklists
docs                      Product, architecture, rules, rights, and release documentation
```

## Documentation

- [Product specification](docs/product-specification.md)
- [Architecture](docs/architecture.md)
- [Scoring kernel](docs/scoring-kernel.md)
- [Roadmap](docs/roadmap.md)
- [Rules-data maintenance](docs/rules-data-maintenance.md)
- [Data rights and publication gate](docs/data-rights.md)
- [Future discipline expansion](docs/discipline-expansion.md)
- [Release process](docs/release.md)
- [Local release verification and remaining gates](release/verification.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Independence and license

D-Score Gymnastics is an independent project. It is not affiliated with, endorsed by, or officially
authorized by World Gymnastics or the Fédération Internationale de Gymnastique (FIG).

The [World Gymnastics rules page](https://www.gymnastics.sport/site/rules/) is the authoritative
source for the applicable gymnastics rules.

Original source code is available under the [MIT License](LICENSE). The MIT License does not grant
rights to third-party publications, names, marks, or source material; see
[Third-party notices](THIRD_PARTY_NOTICES.md).
