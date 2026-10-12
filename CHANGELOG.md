# Changelog

All notable product changes are recorded here.

## [1.0.0] — Unreleased

### Added

- Explained senior men's artistic gymnastics D-score calculation across all six events.
- Reviewed 738-element catalogue and 17 human-readable rules fixtures.
- Event-specific element groups, repetition, direct connections, Pommel Horse Flop/Combined
  sequences and Russian locations, landing bonus, and dedicated Vault scoring.
- Responsive Home, onboarding, routine editor, named routine catalogue, and editable six-event
  all-around workspaces.
- Local IndexedDB/SQLite persistence, versioned backup/restore, and local-data deletion.
- Dark/light themes, safe-area support, offline PWA installation, and explicit web updates.
- Static product, About, Support, and Privacy pages at `d-score.app` with no analytics or telemetry.
- Cross-browser, accessibility, Lighthouse, store-metadata, screenshot, and publication-gate checks.

### Changed

- Renamed the product from EasyScore to D-Score Gymnastics.
- Replaced description-derived catalog IDs with stable neutral apparatus sequences and moved the
  prior ID/wording map into ignored private maintenance storage.
- Prepared public catalog label candidates and added an enforceable digest, automated risk checks,
  private human-review worksheet, and two-person approval record.
- Added the exact independence notice and authoritative World Gymnastics rules link throughout the
  app, website, repository notices, and App Store materials.
- Added discipline identity to current saved records and backups while preserving legacy import
  compatibility.
- Added a clean EAS rules-build hook and history-free public-repository snapshot workflow.
- Preserved in-progress wording reviews, rejected stale or incomplete approvals, and added
  publication-preflight coverage to CI.
- Corrected the Settings source-cutoff date and refreshed the five store-image candidates.

### Release gate

- The World Gymnastics response and all three intended channels are recorded. Publication remains
  blocked until Gabriel Dabin Cintron completes the generated catalog wording worksheet and Jose
  Gabriel Cintron approves its exact public digest.
