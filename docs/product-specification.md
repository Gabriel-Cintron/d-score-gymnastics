# Product specification

## Purpose

D-Score Gymnastics calculates an expected men's artistic gymnastics difficulty score from a routine
entered by an athlete or coach. It is a convenient planning tool, not an official competition
system.

## Version 1

Version 1 will:

- Support current FIG senior rules.
- Cover floor exercise, pommel horse, still rings, vault, parallel bars, and horizontal bar.
- Include every element needed to calculate difficulty under that ruleset.
- Let users build an ordered routine through search, autocomplete, and tap.
- Match common names, abbreviations, and misspellings while displaying canonical element names.
- Represent connections and apparatus-specific sequences explicitly.
- Calculate the D-score locally and explain every counting decision.
- Open on a Home dashboard that resumes recent work and provides intentional new-routine actions.
- Explain the product through a short first-run tour that can be replayed from Settings.
- Auto-save multiple all-around workspaces and reuse named event routines from an on-device
  catalogue.
- Export and restore one validated local-data backup from Settings.
- Work offline after the web application has loaded or been installed once.

The editor asks for the skills the athlete intends to count; uncounted choreography does not need to
be entered. The calculation result identifies which claims count and why others do not. Requirements
that depend on omitted choreography, such as the circle separating Pommel sequences, appear as clear
performance warnings. Vault uses a dedicated routine model and initially calculates one vault's
value. When one Code entry permits scoring-relevant variants, the event editor requests only the
required detail, such as a stationary Pommel Russian's location.

## Calculation behavior

The calculator assumes each selected element was recognized as entered. It does not infer execution
errors, pauses, falls, or downgrades.

Malformed input is rejected. Valid gymnastics input that is incomplete or does not receive credit
remains editable and receives a partial score with structured warnings. Examples include a missing
dismount, a repeated element, and an ineligible connection claim.

Results include, where applicable:

- Total difficulty.
- Counted element difficulty.
- Element-group or composition credit.
- Connection and sequence bonus.
- Counted and excluded elements.
- Missing requirements, invalid claims, and other warnings.

## Product principles

- Fast, minimal, and comfortable on a phone in a gym.
- Fully functional without an account or network connection.
- No advertising, monetization, or unnecessary tracking.
- Local user data by default.
- Accessible by keyboard and touch, with clear contrast and useful explanations.
- English at launch, with localization-ready identifiers and message codes.
- Open source and approachable for gymnastics-domain contributors.

Home, onboarding, and Settings organize the workflow but do not own scoring behavior. Destructive
quick-start, restore, and local-data actions require confirmation when they would replace work.

## Outside version 1

- Execution scores, neutral deductions, and final scores.
- Video recognition or automatic execution analysis.
- Accounts, cloud synchronization, team administration, or competition operation.
- Historical ruleset selection.
- Two-vault qualification or final calculations.
- Android store distribution.
- Native desktop applications.
- Skill diagrams, coaching progressions, or copied Code of Points prose.

Future rulesets may include NCAA and United States junior programs. The iPhone release reuses the
same scoring engine and rules data as web; a future Android release can use the existing Expo client
after platform testing and store preparation.

The product name intentionally permits future gymnastics disciplines, but version 1.0 presents only
men's artistic gymnastics. No interface may imply that an unavailable discipline is already
supported. Women's artistic gymnastics is the preferred first discipline-expansion study after the
MAG release is stable; it must arrive through an explicit discipline and ruleset boundary rather
than conditionals scattered through the current editor.
