import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));

const [
  rootPackage,
  appPackage,
  appConfig,
  easConfig,
  metadata,
  rights,
  ruleset,
  sourceReview,
  productSource,
  supportPage,
  domain,
] = await Promise.all([
  readJson('package.json'),
  readJson('apps/d-score-gymnastics/package.json'),
  readJson('apps/d-score-gymnastics/app.json'),
  readJson('apps/d-score-gymnastics/eas.json'),
  readJson('release/app-store/en-US/metadata.json'),
  readJson('release/rights-status.json'),
  readJson('packages/rulesets/generated/fig-mag-2025-2028.json'),
  readJson('release/rules-source-review.json'),
  readFile(resolve(root, 'apps/d-score-gymnastics/src/product.ts'), 'utf8'),
  readFile(resolve(root, 'apps/d-score-gymnastics/site/support/index.html'), 'utf8'),
  readFile(resolve(root, 'apps/d-score-gymnastics/site/CNAME'), 'utf8'),
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const expectedVersion = '1.0.0';
invariant(rootPackage.version === expectedVersion, 'The root package version must be 1.0.0.');
invariant(appPackage.version === expectedVersion, 'The app package version must be 1.0.0.');
invariant(appConfig.expo.version === expectedVersion, 'The Expo version must be 1.0.0.');
invariant(metadata.app.version === expectedVersion, 'The App Store version must be 1.0.0.');
invariant(
  metadata.app.creator === 'Gabriel Dabin Cintron' &&
    metadata.app.publisher === 'Jose Gabriel Cintron',
  'Release creator and publisher identities changed.',
);
invariant(metadata.app.name.length <= 30, 'The App Store name exceeds 30 characters.');
invariant(metadata.app.subtitle.length <= 30, 'The App Store subtitle exceeds 30 characters.');
invariant(
  metadata.listing.promotionalText.length <= 170,
  'The App Store promotional text exceeds 170 characters.',
);
invariant(
  metadata.listing.description.length <= 4_000,
  'The App Store description exceeds 4,000 characters.',
);
invariant(metadata.listing.keywords.length <= 100, 'The App Store keywords exceed 100 characters.');
invariant(
  metadata.listing.whatsNew.length <= 4_000,
  "The What's New text exceeds 4,000 characters.",
);
invariant(
  metadata.app.bundleIdentifier === appConfig.expo.ios.bundleIdentifier,
  'Bundle identifiers disagree.',
);
invariant(appConfig.expo.ios.supportsTablet === false, 'Version 1.0 must remain iPhone-only.');
invariant(
  appConfig.expo.ios.infoPlist.ITSAppUsesNonExemptEncryption === false,
  'The current no-encryption export-compliance declaration changed.',
);
invariant(
  easConfig.build.development.developmentClient === true,
  'The development profile must build a development client.',
);
invariant(
  easConfig.build.preview.distribution === 'internal',
  'The preview profile must remain internal.',
);
invariant(
  easConfig.build.production.autoIncrement === true,
  'Production build numbers must auto-increment.',
);
invariant(
  appPackage.scripts.postinstall.includes('rules:build'),
  'The Expo postinstall hook must build generated public rules.',
);
invariant(
  metadata.availability.platforms.join(',') === 'IPHONE',
  'The listing must remain iPhone-only.',
);
invariant(
  metadata.availability.countries.join(',') === 'US,CA',
  'Version 1.0 availability must remain United States and Canada.',
);
invariant(
  metadata.availability.releaseMode === 'MANUAL',
  'The App Store release must remain manual.',
);
invariant(
  Object.values(metadata.privacy).every((value) => value === false),
  'The native privacy declaration remains no collection; web optional analytics is disclosed separately.',
);
const directDependencyNames = Object.keys(appPackage.dependencies ?? {});
invariant(
  directDependencyNames.every(
    (name) => !/(analytics|appcenter|firebase|posthog|segment|sentry)/iu.test(name),
  ),
  'Undeclared third-party analytics/crash SDKs are prohibited; native first-party capture remains disabled.',
);
invariant(
  rights.figDistributionPermission.requestSent === true,
  'The rights request must be recorded.',
);
invariant(
  rights.figDistributionPermission.status === 'approved',
  'The retained World Gymnastics response must be recorded as approved.',
);
invariant(
  ['web', 'open-source-repository', 'ios-app-store'].every((channel) =>
    rights.figDistributionPermission.approvedScope.includes(channel),
  ),
  'The recorded rights scope must cover every planned release channel.',
);
invariant(
  ruleset.dataVersion === '1.0.0' && ruleset.catalogWording.profile === 'independent-public',
  'Release rules must use the 1.0.0 independent-public catalog.',
);
invariant(
  ruleset.authoritativeRulesUrl === 'https://www.gymnastics.sport/site/rules/',
  'Release rules must identify the official authoritative rules page.',
);
invariant(
  metadata.listing.officialRulesUrl === ruleset.authoritativeRulesUrl,
  'App Store metadata and the ruleset must use the same official rules URL.',
);
invariant(
  sourceReview.rulesetId === ruleset.id &&
    sourceReview.checkedOn >= ruleset.catalogCoverage.officialPublicationCutoff,
  'The rules-source freshness review does not match the release ruleset.',
);
invariant(domain.trim() === 'd-score.app', 'The release CNAME must be d-score.app.');
for (const expected of [
  'https://d-score.app/',
  'https://github.com/Gabriel-Cintron/d-score-gymnastics',
  'support@d-score.app',
]) {
  invariant(productSource.includes(expected), `Product constants are missing ${expected}.`);
}
invariant(
  metadata.listing.marketingUrl === 'https://d-score.app/' &&
    metadata.listing.supportUrl === 'https://d-score.app/support/' &&
    metadata.review.contactEmail === 'support@d-score.app' &&
    supportPage.includes('support@d-score.app'),
  'Domain or support-email release material is inconsistent.',
);
invariant(
  appConfig.expo.owner === 'gcins-team' &&
    typeof appConfig.expo.extra?.eas?.projectId === 'string' &&
    appConfig.expo.extra.eas.projectId.length > 0,
  'Expo owner or EAS project linkage is incomplete.',
);

const screenshotDirectory = resolve(root, 'release/app-store/screenshots');
const expectedScreenshotWidth = 1320;
const expectedScreenshotHeight = 2868;
const pngSignature = '89504e470d0a1a0a';

async function validateOpaquePng(path, label, width, height) {
  const bytes = await readFile(path);
  invariant(bytes.subarray(0, 8).toString('hex') === pngSignature, `${label} is not a PNG.`);
  invariant(
    bytes.readUInt32BE(16) === width && bytes.readUInt32BE(20) === height,
    `${label} must be ${width} × ${height}.`,
  );
  invariant(bytes[24] === 8 && bytes[25] === 2, `${label} must be an opaque 8-bit RGB PNG.`);
}

for (const name of metadata.screenshots) {
  const path = resolve(screenshotDirectory, name);
  await access(path);
  await validateOpaquePng(path, name, expectedScreenshotWidth, expectedScreenshotHeight);
}

await validateOpaquePng(
  resolve(root, 'apps/d-score-gymnastics/assets/icon.png'),
  'The native app icon',
  1024,
  1024,
);

await Promise.all([
  access(resolve(root, 'release/app-store/en-US/review-notes.md')),
  access(resolve(root, 'release/testflight/what-to-test.md')),
  access(resolve(root, 'release/checklists/app-store-submission.md')),
  access(resolve(root, 'release/checklists/web-deployment.md')),
  access(resolve(root, 'release/checklists/release-signoff.md')),
  access(resolve(root, 'SECURITY.md')),
  access(resolve(root, 'THIRD_PARTY_NOTICES.md')),
  access(resolve(root, 'docs/data-rights.md')),
  access(resolve(root, 'docs/discipline-expansion.md')),
  access(resolve(root, 'release/rules-source-review.json')),
]);

globalThis.process.stdout.write(
  `Validated D-Score Gymnastics ${expectedVersion} metadata and ${metadata.screenshots.length} App Store screenshots.\n`,
);

const nativeTelemetry = await readFile(
  resolve(root, 'apps/d-score-gymnastics/src/telemetry.ts'),
  'utf8',
);
invariant(nativeTelemetry.includes('available: false'), 'Native analytics must remain disabled.');
