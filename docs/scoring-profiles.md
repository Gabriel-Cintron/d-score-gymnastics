# Bundled scoring profiles

This branch prepares the selection, scoring boundary and storage formats. **FIG MAG 2025–2028
revision 1.0.0 is the only supported profile.** The six USAG entries are disabled placeholders, not
implemented rules. Do not promote this candidate as USAG support until the missing sources, policies
and independent scoring fixtures are complete.

## Private source handoff

Place the complete current **2025–2028 USAG Men's Development Program Competition Manual** in
`.private/rule-sources/` in the canonical checkout. Keep the original filename and revision/date
pages. Include general optional rules, Level 7–10/category tables, all six apparatus chapters,
additional elements and bonus tables, plus any newer official corrections/newsletters. The Technical
Sequence Manual is outside this release. This directory is ignored; never copy PDFs or protected
descriptions into public data or documentation.

The owner is obtaining the manual from their coach. Preserve factual citations and independently
written labels. No worksheet, signature or second approver is required.

## Implementation map

- `packages/rulesets/src/profiles.ts`: exact `{ id, revision }` resolver, effective catalog,
  eligibility, profile counting policies and separate integer-thousandths program bonus tables.
- `packages/rulesets/src/profile-definitions.ts`: bundled definitions and availability. FIG reuses
  the existing evaluator; unavailable/unknown revisions never yield a runtime.
- `apps/d-score-gymnastics/src/scoring-profile-state.ts`: default/override rules, independent of UI.
- `components/RulesetControl.tsx`: shared routine/all-around selector, explicit Apply and Cancel.
- `routine-library.ts`: complete all-around capture; individual capture stores its effective profile
  and restores it only to that event. Clearing contents retains the selection.
- `App.tsx`: one profile runtime supplies scoring, catalog values, filters, connection eligibility,
  Pommel construction and explanations. Profile changes preserve entered relationships.
- Generated `scoring-profiles.json` identifies bundled revisions/status/digests. Generated
  `profile-catalog.json` supplies the existing search collector's allowed IDs; it adds no telemetry
  fields. Profile switches split search contexts locally. Profile restrictions are contextual zero
  results, not missing-alias evidence.

New workspaces use FIG. Routine overrides equal to the default are normalized away. Applying or
reapplying an all-around default clears all six overrides, including empty events. Other saved
routines and all-arounds remain independent. Unsupported local revisions preserve inputs and backup
export, with explicit unavailable scoring. They never receive a substitute FIG score.

## Source and policy matrix still required

Complete each row from the manual plus currently applicable official updates. Category variants are
needed only for scoring/eligibility differences, not awards divisions.

| Context                 | Baseline and six-event policies to verify                                                      | Availability                |
| ----------------------- | ---------------------------------------------------------------------------------------------- | --------------------------- |
| Development Level 7     | Counting/order, eligibility, additional skills, groups, dismounts, connections, Vault, bonuses | Waiting for complete manual |
| Development Level 8     | Same matrix, including actual category differences                                             | Waiting for complete manual |
| Development Level 9     | Same matrix, including group thresholds and strength-hold upgrades                             | Waiting for complete manual |
| Development Level 10 JN | Same matrix and current domestic provisions                                                    | Waiting for complete manual |
| Junior Elite 2026       | Applicable FIG baseline, eligibility/directives and exact 2026 D-only bonus table              | Incomplete; not selectable  |
| Senior Elite 2026       | Applicable FIG baseline, domestic provisions and exact 2026 D-only bonus table                 | Incomplete; not selectable  |

Start with [USAG's current men's rules index](https://usagym.org/men/rules/), the current manual,
2026 newsletters and competition directives. Do not generalize a particular competition's division
rules to the entire program or copy superseded newsletters. Do not assume every junior strength hold
gets an upgrade. Separately identify bonuses requiring execution scores as excluded.

For each supported profile, record source cutoff/citations, inherited rules and explicit overrides.
Resolve difficulty before selection, groups, dismounts and connections. Existing FIG policy
structures cover some differences; implement focused policies for differences the structures do not
represent. Synthetic TEST ONLY profiles in unit tests demonstrate mechanisms, not USAG results.

## Storage and forward recovery

Workbench schema **3**, library **4**, backup **3** add profile references. Older supported formats
migrate to FIG. Database names and record keys are unchanged. All writes still use the existing 150
ms serialized atomic controller, including matching active all-around and preferences.

A profile-only change participates in dirty/recovery comparisons. Unknown local references remain
parseable and exportable. App backup restoration rejects unavailable/unknown references before
replacement. Malformed records remain protected from automatic overwriting.

Do not edit an existing completed profile revision's scoring meaning; add a new revision and retain
the old runtime for saved work. Publish the bundled revision inventory/digests in the verified web
artifact manifest (schema 2). A future corrective build must understand these storage formats. An
older build rejects them and protects records; it cannot calculate or restore the new backups.
Prefer forward recovery over reverting the app to an incompatible storage reader. Never clear
IndexedDB as a deployment recovery action.

## Acceptance before publication

1. Complete the source matrix and actual USAG policies; enable only complete profiles.
2. Add independently specified USAG fixtures across all six events and bonus boundaries. Keep every
   existing FIG fixture unchanged.
3. Extend interaction coverage to two genuinely supported profiles: coherent values/filters/groups,
   excess entries, preserved connections/sequences, individual inheritance and bulk reset.
4. Verify current/legacy/mixed backups, rapid profile edits, switching, failed writes, offline
   reload and PWA update flushing with the new metadata.
5. Run `pnpm release:web:preflight` (all five browsers, no retries, existing Lighthouse budgets).
6. Verify a manual preview from the tested artifact, including migrations and mixed profiles.
   Production promotion remains a separate explicit operation. Native compilation/device evidence
   belongs to the later iOS work.

Telemetry consent/scope, catalog IDs and FIG values remain unchanged. No country, age, division,
ruleset or routine analytics are transmitted. No dependency or remote scoring service is added.
