# Architecture

## Design goals

D-Score Gymnastics separates gymnastics rules from application behavior. The scoring engine must be
deterministic, portable, and testable without React, Expo, storage, or network access. Routine
editing and presentation remain outside the engine.

Dependency direction is one-way:

```text
Expo client
  -> rulesets
    -> scoring
```

The `scoring` package cannot import a ruleset or platform package. The `rulesets` package may use
scoring contracts and supplies validated data and apparatus policies. The Expo client consumes both.

## Repository boundaries

### `packages/scoring`

Pure TypeScript domain types and calculation behavior. It owns ordered routine occurrences, integer
scoring units, the apparatus-evaluator contract, input checks, and structured calculation results.
It also owns typed connection and sequence claims, occurrence qualifiers, landing input, and the
separate Vault calculation contract.

### `packages/rulesets`

Human-maintained rules data, schemas, validation, compilation, and concrete ruleset implementations.
FIG 2025-2028 is the first ruleset. Runtime consumers receive normalized, validated artifacts rather
than raw YAML.

The editable source uses stable apparatus and element IDs. Official group and table numbers remain
separate metadata because publications may renumber an element without changing its identity.

### `apps/d-score-gymnastics`

The universal Expo application, targeting web and iPhone in version 1 with Android available as a
future platform. Its product shell contains Home, onboarding, the focused routine editor, and
Settings. The editor provides catalog search, ordered routine entry, Vault selection, and live
explanations. The app consumes a small ruleset runtime facade; it does not assemble evaluators or
implement scoring decisions. Platform-specific storage and interaction adapters may differ, but
scoring behavior cannot.

## Scoring model

A routine is an ordered collection of atomic element occurrences. Each occurrence has its own ID and
references a stable catalog element ID, so a repeated element remains distinguishable and future
connections can reference exact performances. Ruleset-owned occurrence qualifiers distinguish
execution variants within one Code entry when the distinction affects scoring, such as the location
of a stationary Pommel Horse Russian. Vault uses a separate routine contract rather than being
forced into the multi-element model.

The shared kernel resolves occurrence and relationship references and rejects malformed input before
evaluation. A ruleset evaluator then returns one explained decision per occurrence, additional
awards, and warnings. The kernel verifies that output and aggregates a deterministic result with
separate element difficulty, element-group, connection, and bonus totals. The FIG evaluator composes
shared counting policy with focused apparatus policies. Its selection state accounts for group caps,
special repetition, reserved dismounts, dependencies, conditional fifth-flight eligibility, and
element-value upgrades. Equal-value alternatives use element-group credit before routine order as
the final tie-breaker.

Scoring values are represented internally as integer tenths. Editable rules data uses familiar
decimal notation and is converted during validation. A branded TypeScript type prevents accidental
mixing of decimal points and integer units inside scoring code. Calculation results use stable
reason codes and scalar parameters so explanations can be tested and translated without storing UI
text in the engine.

Shared scoring operations use a common pipeline. Each apparatus implements a focused evaluator for
behavior that is genuinely apparatus-specific. Rulesets compose typed parameters and policies rather
than relying on ruleset-name checks or a general-purpose rules language.

See [scoring kernel](scoring-kernel.md) for the current contracts and limits.

## Data and persistence

Rules and the element catalog ship with the application and require no runtime database. The
workbench searches compiled catalog entries in memory by canonical name and alias. Generated search
indexes remain deferred unless post-release performance evidence demonstrates a need.

The rules build parses strict, versioned YAML and then applies cross-file semantic checks. Element
records, shared policy, apparatus parameters, and scoring fixtures remain editable as YAML. Valid
decimal values compile to integer tenths in deterministic JSON. Generated artifacts are disposable
build output; YAML remains the reviewed source of truth. The catalog importer is a reproducible aid,
not a second source of truth: generated YAML is still reviewed and committed.

The Expo start and export commands build the generated rules artifact first. A ruleset runtime
indexes the artifact once and exposes apparatus catalogs plus routine and Vault scoring methods to
the application.

User workbench state is stored through a repository interface. The web implementation uses IndexedDB
and restores routines, explicit relationships, Vault and landing choices, and theme locally. Stored
records include schema and ruleset revisions, and restored element IDs are validated against the
bundled catalog. A second versioned store separates auto-saved all-around workspaces from reusable
named-event catalogue entries and records the active workspace; a third stores product preferences
such as onboarding completion. Earlier snapshot records migrate without discarding saved data, and
blank all-arounds are valid first-class workspaces. Loading a catalogue routine regenerates
occurrence and relationship IDs before replacing the target event, so identities cannot collide with
other apparatus in the active all-around.

Settings exports all three records as one versioned JSON document. Import validates the document,
ruleset identity, every catalog reference, and each nested schema before atomically replacing the
local records. Clearing data uses the same atomic store operation and requires explicit UI
confirmation. The web adapter uses IndexedDB; native builds use a matching Expo SQLite adapter.
Neither platform-specific implementation reaches into the scoring core or product shell.

The workbench keeps Pommel sequence components as atomic occurrences with an explicit sequence
relationship for scoring and persistence. Presentation groups those occurrences into one routine
card; moving or removing that card keeps the component sequence intact. The workbench stores counted
skill claims rather than every piece of choreography, so an omitted Pommel separator circle becomes
a structured performance warning instead of another routine occurrence. Connection affordances use
ruleset eligibility helpers, so the interface does not recreate FIG connection rules.

## Quality controls

- Strict TypeScript at package boundaries.
- Schema and semantic validation for all rules data.
- Explicit, human-readable scoring fixtures.
- Unit tests for shared and apparatus-specific rules.
- Cross-browser layout, accessibility, persistence, and offline-flow tests against production web
  exports.
- Reviewed catalog data and reference scores, with future rules revisions returning through the same
  validation and review flow.

An abstraction is added only when a representative scoring case requires it. The architecture is
tested against difficult event-specific cases before the full catalog is populated.

## Discipline expansion boundary

The dependency direction, pure scoring kernel, YAML validation pipeline, ruleset runtime, and
platform storage adapters are reusable foundations for other gymnastics disciplines. Saved records
and backups now include a stable `disciplineId`, preventing a future women's artistic or trampoline
record from being silently interpreted as a men's artistic routine.

The current apparatus identifiers, FIG evaluator, Vault contract, and several editor controls are
deliberately MAG-specific. Adding another discipline therefore means adding a discipline definition,
its events and evaluator policies, its validated data, and event-specific UI—not merely loading a
new catalogue. The application shell, navigation, persistence, backup transport, theming, and most
routine-library behavior can remain shared.

Version 1.0 does not perform a speculative generic rewrite. The next discipline should supply
representative hard cases first, then extract only the contracts those cases prove are shared. See
[Discipline expansion](discipline-expansion.md) for the accepted direction and migration sequence.
