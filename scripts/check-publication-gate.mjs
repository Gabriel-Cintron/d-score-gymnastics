import { execFileSync } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { publicWordingDigest } from './lib/catalog-digest.mjs';

const root = resolve(import.meta.dirname, '..');
const supportedChannels = ['web', 'open-source-repository', 'ios-app-store'];
const arguments_ = globalThis.process.argv.slice(2);
const preflight = arguments_.includes('--preflight');
const requestedChannels = arguments_.filter(
  (argument) => argument !== '--preflight' && argument !== '--',
);
const channels =
  requestedChannels.length === 0 ? ['web', 'open-source-repository'] : requestedChannels;
const officialRulesUrl = 'https://www.gymnastics.sport/site/rules/';
const independenceNotice =
  'D-Score Gymnastics is an independent project. It is not affiliated with, endorsed by, or officially authorized by World Gymnastics or the Fédération Internationale de Gymnastique (FIG).';

if (channels.some((channel) => !supportedChannels.includes(channel))) {
  throw new Error(`Choose one publication channel: ${supportedChannels.join(', ')}.`);
}

const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const readText = async (path) => readFile(resolve(root, path), 'utf8');
const [
  rights,
  ruleset,
  sourceReview,
  appPackage,
  metadata,
  productSource,
  settingsSource,
  readme,
  rightsDoc,
  landing,
  about,
  reviewNotes,
] = await Promise.all([
  readJson('release/rights-status.json'),
  readJson('packages/rulesets/generated/fig-mag-2025-2028.json'),
  readJson('release/rules-source-review.json'),
  readJson('apps/d-score-gymnastics/package.json'),
  channels.includes('ios-app-store')
    ? readJson('release/app-store/en-US/metadata.json')
    : Promise.resolve(undefined),
  readText('apps/d-score-gymnastics/src/product.ts'),
  readText('apps/d-score-gymnastics/src/components/SettingsScreen.tsx'),
  readText('README.md'),
  readText('docs/data-rights.md'),
  readText('apps/d-score-gymnastics/site/index.html'),
  readText('apps/d-score-gymnastics/site/about/index.html'),
  channels.includes('ios-app-store')
    ? readText('release/app-store/en-US/review-notes.md')
    : Promise.resolve(undefined),
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const status = rights.figDistributionPermission;
invariant(
  status.status === 'approved',
  `Public distribution is blocked while rights status is ${status.status}.`,
);
invariant(
  typeof status.evidenceReference === 'string' && status.evidenceReference.trim().length > 0,
  'Approved rights status must include a non-sensitive evidence reference.',
);
invariant(
  Array.isArray(status.approvedScope),
  'Approved rights status must list its channel scope.',
);
for (const channel of channels) {
  invariant(
    status.approvedScope.includes(channel),
    `The recorded rights scope does not include ${channel}.`,
  );
}
invariant(
  Array.isArray(status.conditions) && status.conditions.length >= 5,
  'The World Gymnastics response conditions must remain recorded.',
);

invariant(
  ruleset.catalogWording?.profile === 'independent-public',
  'A public release must use the independent-public catalog wording profile.',
);
invariant(
  ruleset.authoritativeRulesUrl === officialRulesUrl,
  'The compiled ruleset must point to the official World Gymnastics rules page.',
);
invariant(
  sourceReview.rulesetId === ruleset.id &&
    sourceReview.authoritativeRulesUrl === ruleset.authoritativeRulesUrl &&
    sourceReview.officialPublicationCutoff === ruleset.catalogCoverage.officialPublicationCutoff &&
    sourceReview.checkedOn >= sourceReview.officialPublicationCutoff,
  'The authoritative-source freshness record does not match the release ruleset.',
);
invariant(
  ruleset.elements.every((element) => /^(?:fx|ph|sr|vt|pb|hb):mag-\d{4}$/.test(element.id)),
  'Every public element must use a neutral apparatus sequence ID.',
);

const digest = publicWordingDigest(ruleset.elements);

const normalizedNotice = normalizeWhitespace(independenceNotice);
for (const [label, text] of [
  ['app product constants', productSource],
  ['README', readme],
  ['data-rights documentation', rightsDoc],
  ['landing page', landing],
  ['About page', about],
  ...(metadata === undefined
    ? []
    : [
        ['App Review notes', reviewNotes],
        ['App Store description', metadata.listing.description],
      ]),
]) {
  invariant(
    normalizeWhitespace(text).includes(normalizedNotice),
    `${label} must include the approved independence notice verbatim.`,
  );
}
invariant(
  settingsSource.includes('INDEPENDENCE_NOTICE'),
  'Settings must render the centralized independence notice.',
);
for (const [label, text] of [
  ['app product constants', productSource],
  ['README', readme],
  ['About page', about],
  ...(metadata === undefined ? [] : [['App Store metadata', JSON.stringify(metadata)]]),
]) {
  invariant(text.includes(officialRulesUrl), `${label} must link to the official rules page.`);
}
invariant(
  appPackage.scripts?.postinstall?.includes('rules:build'),
  'The Expo app postinstall hook must build the public rules package for EAS.',
);

const trackedPrivateFiles = execFileSync('git', ['ls-files', '.private'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
invariant(trackedPrivateFiles.length === 0, 'Private catalog material is tracked by Git.');
await assertNoLegacyWorkspaceSymlink();

globalThis.process.stdout.write(
  `${preflight ? 'Publication preflight passed' : 'Publication gate cleared'} for ${channels.join(', ')} with catalog digest ${digest}.\n`,
);

function normalizeWhitespace(value) {
  return String(value)
    .replace(/^\s*>\s?/gmu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

async function assertNoLegacyWorkspaceSymlink() {
  try {
    const entry = await lstat(resolve(root, 'easyscore'));
    invariant(
      !entry.isSymbolicLink(),
      'Remove the legacy easyscore workspace symlink before publication.',
    );
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
}

const profiles = await readJson('packages/rulesets/generated/scoring-profiles.json');
invariant(
  profiles.every(
    (p) =>
      ['complete', 'unavailable'].includes(p.status) &&
      /^sha256:[a-f0-9]{64}$/.test(p.scoringDigest),
  ),
  'Every bundled scoring profile must have an explicit status and scoring digest.',
);
