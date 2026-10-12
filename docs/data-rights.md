# Data rights and publication gate

## Purpose

D-Score Gymnastics separates the license for original source code from permission to distribute
third-party-derived rules and catalogue data. This file is an engineering and release-control
record, not legal advice. When the permission response is ambiguous, obtain qualified legal advice
before publishing.

## Material inventory

| Material                                                           | Location                                          | Release treatment                                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Original application, scoring, validation, and build code          | `apps`, `packages`, `scripts`                     | MIT License                                                                                                 |
| Original product pages, documentation, and project artwork         | `apps/d-score-gymnastics/site`, `docs`, `release` | MIT License unless noted                                                                                    |
| Open-source dependencies                                           | lockfile and built bundle                         | Their respective licenses                                                                                   |
| Factual MAG names, numbers, groups, values, and scoring parameters | `packages/rulesets/data/fig-mag-2025-2028`        | May be used under the retained World Gymnastics response; public descriptions must be independently drafted |
| Publication titles, federation name, and citations                 | rules source metadata and notices                 | Identification only; no ownership or endorsement claimed                                                    |

The repository must never contain Code of Points scans, newsletter PDFs, long copied passages, or
third-party artwork merely because they were used for review. Source citations should identify a
publication and page or section while rules behavior and fixtures are expressed in project-authored
data and prose.

## Current status

World Gymnastics replied in writing that factual scoring information may be used in an independent
application, while Code wording, illustrations, layout, and other protected expression may not be
reproduced in whole or substantial part. The response also requires independent presentation, no
protected branding, and a reference to the official Code as the authoritative source. The actual
correspondence remains in a private operator-controlled location; `release/rights-status.json`
records only its operational effect.

Store the actual correspondence in a private operator-controlled location. The committed status file
should contain only:

- `status`: `pending-response`, `approved`, or `declined`.
- `requestSent`: whether the request was sent.
- `evidenceReference`: a non-sensitive pointer to retained correspondence.
- `approvedScope`: any of `web`, `open-source-repository`, and `ios-app-store` explicitly covered.
- A short operational note.

Run the channel gate before publication:

```sh
node scripts/check-publication-gate.mjs web
node scripts/check-publication-gate.mjs open-source-repository
node scripts/check-publication-gate.mjs ios-app-store
```

## Decision paths

### Permission approved

Record the evidence reference and exact approved channels. Preserve any attribution, territory,
duration, update, revocation, branding, or notice conditions in the private release record and add
non-sensitive requirements to the public checklist. Re-run the gate for each channel. For this
release, the maintainers treat the response as sufficient for web distribution, the public source
repository, and the iOS App Store; that interpretation is an operator decision, not legal advice.

### Permission conditional or ambiguous

Do not infer that one channel covers another. Ask for clarification when the response does not
plainly cover downloadable web assets, public source/data files, and the App Store binary. If
necessary, publish only the expressly approved channel or remove the material at issue.

### Permission declined or not received

Do not publicly distribute the bundled derived catalogue. Viable product alternatives require a new
review and may include a user-supplied data import, a separately licensed dataset, an independently
developed minimal rules implementation, or a calculator that ships without the disputed catalogue.
None of those alternatives should be assumed legally sufficient without review.

## Trademark and product presentation

D-Score Gymnastics is independent and must not use FIG logos or imply federation approval. Product
pages and store copy carry this notice:

> D-Score Gymnastics is an independent project. It is not affiliated with, endorsed by, or
> officially authorized by World Gymnastics or the Fédération Internationale de Gymnastique (FIG).

Link users directly to the
[official World Gymnastics rules page](https://www.gymnastics.sport/site/rules/) as the
authoritative source. Public element labels must use the `independent-public` wording profile. The
archived reference wording and old-to-new ID map belong only under ignored `.private/` storage and
must never enter a normal build, archive, repository, or deployment.

Use the federation name only where needed to identify the ruleset or source. Recheck store artwork,
screenshots, metadata, and public pages before every release.

## Rules updates

Publication safeguards are automated. There is no per-entry worksheet or release signature
requirement. The five existing source-use conditions remain recorded in rights-status.json; scoring
schemas, fixtures, source notices, neutral IDs, channel scope and private-file exclusions remain
mandatory. Catalog digests identify build contents rather than approving wording.

Every rules-data change needs a source citation, reviewer, fixture coverage where behavior changes,
and a rights check when it introduces a new publication or data source. See
[Rules-data maintenance](rules-data-maintenance.md).
