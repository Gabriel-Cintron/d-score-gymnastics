# D-Score Gymnastics app

This Expo application is the universal interface over the shared ruleset and scoring packages. It
uses React Native components on web and iOS; scoring behavior remains outside the UI in the
workspace packages.

From the repository root:

```sh
pnpm install
pnpm web
```

`pnpm web` validates and compiles rules data before starting Expo. `pnpm web:export` creates the
complete production artifact: a static product page at `/`, the calculator at `/app/`, direct About,
Support, and Privacy routes, install metadata, and conservative offline caching.

The browser shell targets current Safari, Chrome, Edge, and Firefox releases. It synchronizes
browser chrome with the selected theme, uses dynamic viewport sizing, and applies safe-area insets
on mobile. Playwright covers Chromium, Firefox, WebKit, mobile Chromium, and mobile WebKit; Axe and
Lighthouse provide accessibility, performance, best-practice, and SEO gates.

The app stores the active workbench, all-arounds, named routines, theme, and onboarding preference
locally. Web uses IndexedDB and native builds use Expo SQLite behind the same record-store boundary.
Settings provides backup/restore, local-data clearing, product links, and ruleset provenance.

Run the complete release suite from the repository root with `pnpm release:check`. Generate the five
deterministic App Store images with `pnpm screenshots:store`. Deployment and physical iPhone testing
are documented in [the release process](../../docs/release.md).

Run EAS commands from this app directory. Its `postinstall` hook builds the validated public rules
artifact during clean cloud installs; no normal Expo or EAS path reads ignored `.private` catalog
material.
