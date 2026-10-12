# Rules-data maintenance

## Maintenance contract

Ordinary scoring updates must not require application or scoring-engine code. A maintainer should be
able to add, remove, rename, revalue, regroup, or alias an element by editing human-readable rules
data and its regression fixtures.

YAML is the editable source format. It supports comments and reviewable diffs; schemas and CI
protect against indentation mistakes and invalid values. The application consumes generated
artifacts, never unvalidated YAML.

## Data responsibilities

Configuration should contain:

- Canonical element records, aliases, identifiers, groups, values, and traits.
- Counting limits, requirement values, caps, and thresholds.
- Connection and sequence tables.
- Allowed or prohibited relationships.
- Ruleset metadata, revisions, effective dates, and source references.
- Parameters consumed by apparatus-specific scoring policies.

Code should contain algorithms: choosing credited elements, resolving competing claims, and
evaluating interactions that cannot be expressed clearly as data. Configuration is not an executable
rules language, and arbitrary code is never loaded from data files.

## Source layout

```text
data/fig-mag-2025-2028/
  manifest.yaml
  shared-rules.yaml
  floor-exercise/
    elements.yaml
    rules.yaml
  pommel-horse/
  still-rings/
  vault/
  parallel-bars/
  horizontal-bar/
  fixtures/
    *.yaml
```

Stable internal IDs are independent of display names and official numbering. Decimals remain
readable in source data and compile to integer tenths. Each record or file includes enough source
information to audit it against the applicable official publication.

Public element IDs use an apparatus-prefixed, description-neutral sequence such as `pb:mag-0001`.
Sequences are monotonic within each apparatus: allocate the next unused number and never renumber or
reuse an existing ID. The separate `code.group` and `code.number` fields record the official factual
table location. Aliases contain short search terms only; the interface always displays `name`.

The manifest's `catalogWording.profile` is `independent-public` for every normal build. Approved
public names must be independently drafted descriptions, not copied Code prose; that profile alone
does not certify unreviewed candidate labels. Before the one-time migration, the old IDs, labels,
and aliases were archived under ignored `.private/catalog-wording/` storage. Only explicit private
maintenance commands may read that archive:

```sh
pnpm rules:build:private
pnpm backup:migrate:private -- --input /path/to/development-backup.json \
  --output .private/migrated-development-backup.json
```

Never move the private archive, review worksheet, or private build into a tracked path or public
artifact. A regular rules build is deliberately unable to consume it.

The manifest distinguishes three kinds of versioning:

- `schemaVersion` changes when the YAML structure changes.
- `dataVersion` identifies a reviewed catalog release and follows semantic versioning.
- `dataRevision` records the catalog update date, including wording-only changes.

Separately, `catalogCoverage.officialPublicationCutoff` records the rules-source cutoff shown in
Settings. A wording edit must not imply that newer official rules have been incorporated.

`status: draft` means the ruleset is not release-ready. It changes to `complete` only after catalog,
rule coverage, and reference results are validated. Future rulesets receive separate manifests;
inheritance is deferred until a real second ruleset establishes the right model.

`shared-rules.yaml` contains source-linked inputs consumed across apparatus: repetition, counting
slots, group caps and awards, reserved dismount policy, and landing bonus. Each apparatus
`rules.yaml` contains its classifications, limits, connection table, sequence identifiers, or other
parameters. Source decimals compile to integer tenths. Behavioral interactions remain in focused
evaluator code rather than an executable configuration language.

Traits classify one element for a policy, such as `flight` or `giant-swing`. Families group Code
entries subject to one variation limit. An occurrence qualifier records a performed variant that the
catalog entry alone cannot determine; stationary Pommel Russians currently require either
`russian-location-end` or `russian-location-between-pommels`.

## Contributor workflow

1. Add or edit a record in the relevant apparatus `elements.yaml`.
2. Keep its stable neutral ID unless the record represents a different element; new records receive
   the next apparatus sequence.
3. Draft an original concise public label, add only short factual/eponym search aliases, and include
   the exact source document and page.
4. Update or add a YAML scoring fixture when expected behavior changes.
5. Update `dataVersion` and `dataRevision` when preparing a reviewed data change.
6. Run `pnpm rules:check`, then `pnpm check`.
7. Use overlap diagnostics if helpful and correct concrete wording concerns while preserving the
   source-use conditions. There is no worksheet, sample or manual approval gate.
8. Submit the change for gymnastics and code review.

`pnpm rules:build` validates the same source and writes deterministic JSON under
`packages/rulesets/generated/`. That directory is ignored because generated files are not reviewed
or edited directly.

Validation covers YAML syntax, schema shape, all-six-apparatus and rules-file coverage, expected
catalog counts, stable ID prefixes, unique IDs and official codes, scoring increments, dismount
classification, source references, aliases, policy classifications, and difficulty letters. Errors
identify the file and data path, for example `floor-exercise/elements.yaml:elements[0].difficulty`.

Scoring fixtures use readable decimal points but are checked against integer-tenths results. Fixture
validation also checks evaluator identity, element references, occurrence and decision coverage,
award references, breakdown arithmetic, and totals. A `kind: kernel` fixture tests shared
infrastructure. A `kind: fig-element-counting` fixture executes the concrete shared FIG evaluator.
Neither kind should be described as a complete D-score until all applicable award and apparatus
policies are composed.

A `kind: fig-apparatus` fixture composes shared and apparatus policy. `kind: fig-vault` uses Vault's
separate result contract. Run the read-only explainer while authoring a fixture:

```sh
pnpm --filter @d-score-gymnastics/rulesets routine:explain data/fig-mag-2025-2028/fixtures/example.yaml
```

The catalog importer accepts XML produced by `pdftohtml -xml -hidden -i`. It preserves stable
neutral IDs and reviewed public names for existing records. A newly discovered record receives the
next neutral sequence and an unreviewed normalized draft label:

```sh
pnpm --filter @d-score-gymnastics/rulesets catalog:import -- --xml /path/to/code.xml --write
```

Review the resulting YAML diff and complete a new wording review; PDF extraction is not
authoritative by itself. A new kind of rule requires a focused policy implementation, documented
parameters, and positive and negative scoring fixtures. Unused speculative configuration is not
added.
