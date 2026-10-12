# Release process

The first release is the static web application on Cloudflare Pages, promoted from its verified
GitHub Actions artifact. iOS follows separately; native builds, App Store screenshots, and device
signoff do not block web acceptance.

## Source use

Keep the World Gymnastics correspondence and reference wording private. Its recorded permission,
channel scope and five source-use conditions remain in `release/rights-status.json`: factual scoring
information only, independently expressed descriptions, no protected wording/artwork/branding,
independent presentation, and identification of the official Code as authoritative.

Deployment has no manual catalog worksheet, sample, second approver or signature gate.
`pnpm publication:check -- web` automatically checks the recorded permission/scope, public catalog
profile, neutral IDs, source metadata, notices/links and private-file exclusions. It does not claim
that a legal or per-entry human review occurred. Keep scoring schemas and fixtures unchanged when
editing labels; optional overlap diagnostics are inspection aids, with length-only warnings
nonblocking. Catalog digests identify artifact contents and are not approval records.

## Reproduce and validate

Use Node **22.22.2** and pnpm **11.21.0** from the repository root. CI uses Ubuntu 24.04. On
Windows, enable Corepack shims in the selected Node toolchain and put that directory first on PATH;
nested pnpm commands must not resolve a different global pnpm. Lighthouse honors CHROME_PATH locally
and uses the runner-provided packaged Chrome in CI.

```sh
pnpm install --frozen-lockfile
pnpm release:web:preflight
pnpm release:web:check
```

Both commands run the same automated technical acceptance: formatting, lint, types, unit/scoring
fixtures, production export, web materials, publication safeguards, five browser projects and
Lighthouse. The preflight alias remains for compatibility. Neither requires a human catalog
signature or reads native screenshots.

CI exports once, tests that directory with `DSCORE_USE_EXISTING_BUILD=1`, and retains `web-release`
containing `site/` and `manifest.json`. The manifest records the commit, catalog wording digest, and
every asset checksum. Deployment workflows verify it before uploading.

After accepting a candidate, retain the exact CI ZIP, its manifest and SHA256SUMS as GitHub release
assets before the CI artifact expires. Version 1.0.0 is retained at
[the release](https://github.com/Gabriel-Cintron/d-score-gymnastics/releases/tag/v1.0.0). Do not
retag or rebuild an existing release merely to update its evidence documents.

## Preserve the private handoff and public snapshot

Fedora files are not runtime prerequisites. Leave that partition and its old checkout intact until
private correspondence, catalog archive, worksheet, and personal backups can be copied. Make two
private copies and record filenames/checksums without recording contents. Never overwrite backup
originals; private migration writes new outputs.

Before exposing source history, verify repository visibility and administrator access. Rename the
existing repository privately to `Gabriel-Cintron/d-score-gymnastics-development-archive` and update
its local remote. From a clean committed candidate, create an archive outside the checkout:

```sh
pnpm release:snapshot -- --output /tmp/d-score-gymnastics-v1.0.0.tar.gz
```

Extract into a new directory, initialize Git, add the snapshot files, then run frozen installation
and the strict web checks. Create `Gabriel-Cintron/d-score-gymnastics` privately and push the first
snapshot commit. Inspect its tree for private files, old history, PDFs, credentials, dependencies,
and generated data. Require green CI before making only the new repository public. Never force-push
or expose the development archive.

## Cloudflare Pages configuration

The existing Pages project retains its original Git integration with the private development
archive. Production now uses **GitHub Actions artifact promotion** from the clean canonical
repository, without replacing the project or domain. Keep automatic Git production deployments
paused. The retained Git build settings use no framework preset:

| Field                     | Value                                               |
| ------------------------- | --------------------------------------------------- |
| Production branch         | `main`                                              |
| Root directory            | `/`                                                 |
| Build command             | `pnpm publication:check -- web && pnpm release:web` |
| Build output directory    | `apps/d-score-gymnastics/dist`                      |
| Environment: NODE_VERSION | `22.22.2`                                           |
| Environment: PNPM_VERSION | `11.21.0`                                           |

The release command generates the ruleset, runs Expo export, assembles public routes, generates the
Workbox worker, and checks required assets. Cloudflare installs workspace dependencies beforehand.
Git integration rebuilds in Cloudflare and remains an historical fallback. A canonical snapshot
commit is not in the archive's history: use its canonical source link and artifact manifest rather
than the dashboard's retained archive commit link. Do not retry a canonical commit through the old
Git binding.

For exact artifact promotion, use **Deploy verified artifact to Cloudflare Pages** in the canonical
repository. The workflow takes a successful push-to-main CI run ID and uploads its existing artifact
without rebuilding. The configured `cloudflare-preview` and `cloudflare-production` GitHub
environments use an account-scoped Pages-edit API token and account ID in deployment secrets.
Production environment approval and main-only branch policies protect promotion. The Pages-edit
token expires 10 January 2027; rotate it before later deployments. Wrangler installs in a temporary
tool directory, without changing application dependencies. A Git-integrated Pages project accepts
these manual Wrangler deployments after automatic deployments are disabled. See
[Cloudflare Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/).

Retain **Deploy GitHub Pages** as an inactive manual fallback using the same verified CI artifact.
Changing the domain to the fallback is a deliberate recovery operation.

The artifact contains `/`, `/app/`, `/about/`, `/support/`, `/privacy/`, and a real `404.html`. Do
not add a catch-all redirect. The service worker controls `/app/` only. Use Pages default
revalidation; on a custom domain, verify that its Browser Cache TTL respects the existing headers
instead of imposing a four-hour minimum on mutable files such as /sw.js. See
[Cloudflare browser caching](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/).
Leave Analytics, Zaraz, and application telemetry disabled. Default email obfuscation can transform
the support/privacy HTML on the custom domain; verify other asset hashes and the untransformed
deployment URL against the manifest.

## Accept, promote, and recover

Complete `release/checklists/web-deployment.md` on a preview before binding `d-score.app`. Verify
direct routes/status codes, MIME types, compression/cache headers, six events, persistence, backup
round-trip, offline editing, and update behavior. Test support email and public source links. Keep
previous DNS values. Local data belongs to the origin; preserve the production origin.

Record the candidate, CI run, catalog digest, asset checksum, preview ID, and browser evidence in
`release/checklists/release-signoff.md`. Tag the accepted clean public candidate `v1.0.0`, manually
promote it, and repeat smoke tests on HTTPS.

Before launch, rehearse selecting the last known-good successful **production** deployment in Pages.
Preview deployments are not rollback targets. For the first launch, review and deploy the separate
`release/maintenance` static artifact as an initial production recovery target; it does not touch
IndexedDB. Never clear user storage during rollback. CDN rollback does not immediately replace a
running service worker: clients receive the restored build through the tested update path. If that
path fails, ship a forward recovery build. See
[Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/).

Monitor deployment logs, smoke checks, and support reports manually. No paid monitoring or user
telemetry is required.

## iPhone development and internal TestFlight

The operator needs an active Apple Developer Program membership, App Store Connect access, Xcode
licensing accepted where applicable, and a registered iPhone with Developer Mode enabled for direct
development builds.

Run every EAS command from `apps/d-score-gymnastics` so EAS resolves the intended app configuration:

```sh
cd apps/d-score-gymnastics
eas login
eas project:info
eas device:create
eas build:inspect --platform ios --profile development --stage archive --output /tmp/d-score-eas-archive
# On a Mac with the iOS build tools installed:
eas build:inspect --platform ios --profile development --stage pre-build --output /tmp/d-score-eas-prebuild
eas build --platform ios --profile development
cd ../..
pnpm dev
```

The `archive` output should contain the public YAML and build hook, but no generated catalog,
`.private` material, local backups, or credentials. After dependency installation, `pre-build`
output should also contain generated public rules. The app package `postinstall` hook builds them
during a clean EAS cloud install; normal EAS builds never read the private overlay. See Expo's
[inspection stages](https://docs.expo.dev/eas/cli/#eas-buildinspect) and
[monorepo build setup](https://docs.expo.dev/build-reference/build-with-monorepos/).

Install the development client from its EAS link and connect it to the local Expo server. For a
shareable internal candidate that does not need the development server:

```sh
cd apps/d-score-gymnastics
eas build --platform ios --profile preview
```

Test the preview build on a physical iPhone using `release/testflight/what-to-test.md`. Browser
tests cannot sign off SQLite persistence, system sharing, native safe areas, keyboard behavior, or
the actual App Store binary.

## App Store submission

1. Create the App Store Connect record using bundle ID `com.gcinsteam.dscoregymnastics`.
2. Copy the reviewed `en-US` fields from `release/app-store/en-US/metadata.json`.
3. Complete the age-rating questionnaire and privacy disclosure from the exact build's behavior. The
   intended launch state is 4+ and Data Not Collected.
4. Upload the five ordered screenshots from `release/app-store/screenshots`.
5. From `apps/d-score-gymnastics`, build the production binary with
   `eas build --platform ios --profile production`.
6. From the same directory, upload that build with `eas submit --platform ios --latest` or select it
   manually.
7. Put the same production build through internal TestFlight and repeat the smoke test.
8. Attach that build to version 1.0.0, add the review notes, and submit for App Review.
9. After approval, release manually and verify the public listing and clean install.

Use `release/checklists/app-store-submission.md` as the operational record. Do not make an untested
rebuild merely to change a binary; any new binary returns through internal TestFlight.

## Version 1 limitations

- Recognized-as-entered D-score only; no execution, neutral deductions, or official result.
- No account, cloud sync, analytics, advertising, or telemetry.
- One-vault planning only; no two-vault qualification/final calculation.
- Web is English and browser-based. Planned native launch targets iPhone, United States and Canada.
- Local data should be backed up before clearing browser storage or removing the app.
