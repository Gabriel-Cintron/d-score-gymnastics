# App Store and TestFlight checklist

## Account and app record

- [ ] Jose Gabriel Cintron has an active Apple Developer Program membership and is the Account
      Holder or authorized App Store Connect user.
- [ ] `eas project:info` resolves the configured project ID under `gcins-team`; relink or rename the
      EAS project before building if its remote slug still uses the former product name.
- [ ] Agreements, tax, and banking prompts required for a free app are complete.
- [ ] Create the App Store Connect record for **D-Score Gymnastics** with bundle identifier
      `com.gcinsteam.dscoregymnastics` and SKU `d-score-gymnastics-ios`.
- [ ] Select iPhone, English (U.S.), Sports, free, United States and Canada, and manual release.
- [ ] Complete Apple's age-rating questionnaire truthfully; the intended result is 4+.

## Metadata and privacy

- [ ] Copy the reviewed fields from `release/app-store/en-US/metadata.json`.
- [ ] Set the privacy answer to **Data Not Collected** only after confirming the exact build
      contains no new SDK, analytics, telemetry, ads, account, or network-backed user feature.
- [ ] Confirm the marketing, support, and privacy URLs are live over HTTPS.
- [ ] Compare the five browser-generated screenshot candidates with the tested native build; replace
      any web-only UI (such as PWA installation controls), then upload in filename order.
- [ ] Copy `review-notes.md`, add a reachable review phone number in App Store Connect, and verify
      the support inbox.

## Build and TestFlight

- [ ] From `apps/d-score-gymnastics`, inspect the EAS archive for public YAML/build hooks and the
      pre-build output for generated public rules. Neither may contain `.private` material, local
      backups, or credentials; see `docs/release.md` for commands and host requirements.
- [ ] From that app directory, run `eas build --platform ios --profile preview` for internal
      testing, then install the exact build on a supported iPhone.
- [ ] Complete every item in `release/testflight/what-to-test.md` on the physical device.
- [ ] Fix and rebuild until the candidate passes; never substitute an untested rebuild.
- [ ] From the app directory, build the submission with
      `eas build --platform ios --profile production`.
- [ ] Upload from that directory with `eas submit --platform ios --latest`, or select that same
      build manually in App Store Connect.
- [ ] Add the production build to internal TestFlight and repeat the abbreviated smoke test.

## Review and release

- [ ] Run `pnpm publication:check` from the exact release commit and confirm the iOS scope, approved
      wording digest, notice, and authoritative source link.
- [ ] Attach the exact production build to version 1.0.0 and submit for App Review.
- [ ] Respond to App Review without changing the build unless a new build is tested again.
- [ ] After approval, manually release version 1.0.0 and verify its public product page and install.
