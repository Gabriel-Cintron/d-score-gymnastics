# Scoring kernel

## Boundary

The scoring kernel is pure TypeScript. It has no ruleset, React, storage, or platform dependency.
Its job is to validate routine references, provide resolved occurrences to a selected evaluator,
verify the evaluator's output, and aggregate the result.

```text
ordered routine + element lookup -> resolve -> ruleset evaluator -> verify -> aggregate
```

A ruleset evaluator owns decisions such as repetition, counting selection, requirements,
connections, and apparatus exceptions. This keeps FIG behavior out of shared infrastructure and
allows later NCAA and junior evaluators to reuse the same routine and result contracts.

## Input

An element routine contains an apparatus and ordered occurrences. An occurrence ID identifies one
performance in the routine; an element ID identifies its catalog definition. The distinction is
required when an element is repeated or participates in more than one claimed relationship. Optional
ruleset-owned qualifiers record scoring-relevant variants within one Code entry.

Connections identify two exact occurrences. Sequences identify two or more direct occurrences and a
ruleset-owned sequence type. Landing input identifies the performed dismount and whether it was
stuck. Vault instead contains one catalog Vault ID and an optional landing outcome.

Before invoking an evaluator, the kernel checks:

- Occurrence IDs are present and unique.
- Every element ID resolves in the selected catalog.
- Every resolved element belongs to the routine's apparatus.
- Qualifiers and relationship IDs are non-empty and unique where required.
- Relationship and landing references resolve to entered occurrences.
- The evaluator supports that apparatus.

Malformed input returns structured issues. Incomplete but well-formed gymnastics input remains the
evaluator's responsibility and should normally produce a partial result with warnings.

## Evaluation and result

An evaluator returns exactly one counted or excluded decision for every occurrence. Each decision
includes credited difficulty and a stable reason code. Additional awards are categorized as element
group, connection, or bonus; warnings also carry stable codes and occurrence references.

The kernel rejects internally inconsistent evaluator output, then returns:

- Total difficulty in integer tenths.
- Separate element-difficulty, element-group, connection, and bonus totals.
- Ordered element decisions.
- Individual awards and warnings.
- The evaluator ID used for the calculation.

Reason codes contain no display text. The current client maps them to English labels, and the same
stable codes can later map to localized explanations.

## Implemented FIG senior policy

Shared policy reads from `shared-rules.yaml` and provides:

- Ordinary same-Code Identification Number repetition exclusion.
- Highest-value regular-element selection with the four-per-group cap.
- Seven regular slots plus a counted-first reserved dismount on every element apparatus.
- Regular element-group awards, the Group I minimum, and a dismount-group award equal to its
  difficulty with the current 0.5 cap.
- Globally beneficial equal-value selection using element-group credit, followed by routine order as
  a deterministic tie-breaker.
- Partial results and stable warnings for repeated elements, missing groups, and missing, misplaced,
  or uncreditable dismounts.
- Current stick bonus eligibility and a separate single-Vault result.

Focused apparatus policies add:

- Floor strength and circle limits, balance/leap warning, multiple-salto dismount, connection
  tables, and prohibited connection pairings.
- Pommel Horse special repetition, typed flop and combined sequences, sequence separation, Russian
  location qualifiers, and highest-value resolution across overlapping limits.
- Rings consecutive-strength and final-position limits, counted swing separator dependency,
  swing-handstand warning, and direct Yamawaki/Jonasson value upgrade.
- Parallel Bars salto-family and swing-family limits plus one-rail-to-Healy value upgrades.
- Horizontal Bar flight-family and Adler limits, both connection tables, and a fifth flight only
  when its qualifying C+C pair is also selected.

Seventeen YAML fixtures contain complete expected decisions, awards, warnings, breakdowns, and
totals. Unit tests additionally cover malformed contracts and selection interactions.

## Current limit

The evaluator assumes each entered element was recognized as entered. It does not infer execution
errors, falls, holds, body-position downgrades, neutral deductions, or line violations. Warnings for
composition requirements are informational because final and execution scoring are outside the
product scope. The catalog, classifications, and reference results for the current source snapshot
have completed gymnastics review.
