# Rules data

This directory is the human-maintained public source for bundled rulesets. The 2025–2028 MAG
directory contains 738 records across all six apparatus. Its scoring coverage is technically
complete; public release still requires the catalog wording review and publication gate documented
in `docs/data-rights.md`.

## Element record

Add an element to the `elements` list for its apparatus:

```yaml
- id: pb:mag-0180
  code:
    group: 3
    number: 106
  name: Independently drafted concise movement label
  aliases:
    - Common search name
  difficulty: D
  families: []
  roles: []
  traits: []
  source:
    documentId: mag-code-of-points
    page: 108
```

Vault uses a numeric `difficulty`, such as `1.8`. Other apparatus use a letter declared by the
manifest's `difficultyScale`. The only current role is `dismount`; use an empty list when it does
not apply. `traits` drive one-element policies and `families` group variations under a shared limit.
Every field is required so maintenance diffs remain explicit.

Element IDs are monotonic, description-neutral apparatus sequences. Never renumber or reuse one.
Names must be original project wording rather than copied Code descriptions; aliases are limited to
short factual or eponym search terms. The official code, value, classifications, and source citation
remain separate factual fields.

Shared numeric policies live in `shared-rules.yaml`; apparatus parameters live in each `rules.yaml`.
Every rules file cites applicable source pages and is validated before compilation. Edit YAML for
catalog changes, caps, thresholds, connection tables, sequence identifiers, and classification-based
limits. Focused TypeScript policies implement interactions between those parameters.

Run `pnpm rules:check` from the repository root after editing. Validation errors include the file,
field path, and corrective message. Run `pnpm rules:build` only when inspecting the normalized JSON;
never edit or commit generated output.

## Scoring fixtures

Fixtures under `fig-mag-2025-2028/fixtures/` contain ordered element references and complete
expected results in readable decimal points. The validator checks evaluator identity, references,
decision coverage, and arithmetic before tests execute every fixture against compiled data. Use
`kind: kernel` for the ruleset-independent contract, `kind: fig-element-counting` for shared FIG
behavior, `kind: fig-apparatus` for composed event policy, and `kind: fig-vault` for Vault.

See [rules-data maintenance](../../../docs/rules-data-maintenance.md) for the data/code boundary and
contributor workflow.
