# Discipline expansion decision

Status: accepted for post-1.0 implementation  
Decision date: 22 August 2026

## Decision

D-Score Gymnastics will remain one product and application shell while each gymnastics discipline
owns its event model, rulesets, scoring policies, catalogue, and event-specific editor extensions.
Women's artistic gymnastics is the preferred first expansion study after the men's artistic 1.0
release is stable.

Version 1.0 adds only the low-risk compatibility seam: persisted workbench records, libraries, and
backups carry `disciplineId`. It does not generalize the current six-event model before real cases
from a second discipline define the correct contracts.

## What is already reusable

- The deterministic integer scoring pipeline and structured decision output.
- YAML parsing, schema validation, semantic checks, generated artifacts, and fixtures.
- Expo navigation, Home/onboarding/Settings shell, theme, accessibility patterns, and offline web
  delivery.
- Platform record stores, versioned backup transport, import validation, and atomic replacement.
- Named-routine and workspace concepts, after their event maps become discipline-owned.

## What is currently MAG-specific

- `ApparatusId` and the fixed six-event arrays in the scoring and ruleset packages.
- Vault and element-routine contracts that encode current MAG behavior.
- FIG MAG evaluator policies, traits, occurrence qualifiers, and Pommel/connection logic.
- Apparatus labels, event selector layout, quick-start cards, and event-specific editor controls.
- Eight-counted-element assumptions and all-around completeness rules.

That means the architecture is a strong base for other disciplines, but adding WAG is a bounded
domain extension—not just another YAML file.

## Target boundary

The second-discipline implementation should introduce a `DisciplineDefinition` (name illustrative)
that supplies:

- A stable discipline ID and ordered event definitions.
- Supported ruleset IDs and runtime evaluator factories.
- Routine kinds, count limits, and all-around structure.
- Event-specific input/editor capabilities registered by typed feature IDs.
- Persistence schema revision and compatibility/migration functions.
- Product labels and navigation metadata independent of rules prose.

The scoring kernel should move from a closed MAG apparatus union to stable discipline-qualified
event IDs only when representative WAG cases demonstrate how Vault, dance/acrobatic counting,
composition requirements, connection value, and dismount rules share or differ. Discipline packages
may implement distinct evaluators behind common calculation-result contracts.

## Guardrails

- Do not add `if discipline === ...` branches throughout React components or the shared kernel.
- Do not force unlike events through one oversized routine schema.
- Namespace stable records by discipline, ruleset, and event; reject incompatible imports.
- Keep ordinary rule changes data-driven and source-backed.
- Treat source rights and publication permission independently for every discipline and program.
- Preserve migration support for all released MAG backups.

## Expansion sequence

1. Stabilize MAG 1.0 and collect real support feedback.
2. Model several difficult WAG fixtures before changing shared interfaces.
3. Extract the smallest discipline/event registry proven by both MAG and WAG.
4. Add WAG data schemas, evaluators, fixtures, and expert review.
5. Add discipline selection and event-capability-driven UI.
6. Migrate storage/backups without invalidating MAG records.
7. Complete a separate rights and release review before exposing WAG publicly.

This approach keeps the current product expandable while avoiding a premature abstraction that would
hide real scoring differences.

## Beyond gymnastics

Another code-of-points sport could reuse the repository's engineering patterns—integer scoring,
validated data, structured decisions, fixtures, local storage, and explained results—but should not
be forced into gymnastics event or routine types. If a real second sport is pursued, begin as a
sibling domain package or product surface and extract a sport-neutral calculation contract only
after representative cases prove the overlap. The D-Score Gymnastics brand and discipline registry
remain gymnastics-specific.
