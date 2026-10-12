import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const requiredFiles = [
  'index.html',
  'app/index.html',
  'about/index.html',
  'support/index.html',
  'privacy/index.html',
  '404.html',
  'CNAME',
  'robots.txt',
  'sitemap.xml',
  'site.css',
  'manifest.json',
  'sw.js',
  'social-card.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

const distributionPath = (...parts) => resolve('dist', ...parts);

await Promise.all(requiredFiles.map((file) => access(distributionPath(file))));

const [
  landing,
  app,
  about,
  support,
  privacy,
  manifestText,
  serviceWorker,
  domain,
  robots,
  sitemap,
] = await Promise.all([
  readFile(distributionPath('index.html'), 'utf8'),
  readFile(distributionPath('app/index.html'), 'utf8'),
  readFile(distributionPath('about/index.html'), 'utf8'),
  readFile(distributionPath('support/index.html'), 'utf8'),
  readFile(distributionPath('privacy/index.html'), 'utf8'),
  readFile(distributionPath('manifest.json'), 'utf8'),
  readFile(distributionPath('sw.js'), 'utf8'),
  readFile(distributionPath('CNAME'), 'utf8'),
  readFile(distributionPath('robots.txt'), 'utf8'),
  readFile(distributionPath('sitemap.xml'), 'utf8'),
]);
const manifest = JSON.parse(manifestText);

function requireText(source, expected, message) {
  if (!source.includes(expected)) throw new Error(message);
}

requireText(landing, 'href="/app/"', 'The landing page does not link to the calculator.');
requireText(
  landing,
  '<link rel="canonical" href="https://d-score.app/"',
  'The landing page is missing its canonical production URL.',
);
requireText(landing, 'application/ld+json', 'The landing page is missing structured product data.');
requireText(
  landing,
  'prefers-color-scheme: dark',
  'The landing page is missing dark browser-chrome metadata.',
);
requireText(
  app,
  '<link rel="canonical" href="https://d-score.app/app/"',
  'The calculator is missing its canonical production URL.',
);
requireText(app, 'rel="manifest"', 'The calculator is missing its web app manifest.');
requireText(app, 'apple-touch-icon', 'The calculator is missing its Apple touch icon.');
requireText(
  about,
  'officially authorized by World Gymnastics',
  'The About page is missing its independence notice.',
);
requireText(
  about,
  'https://www.gymnastics.sport/site/rules/',
  'The About page is missing its authoritative rules link.',
);
requireText(support, 'support@d-score.app', 'The Support page is missing the support address.');
requireText(
  privacy,
  'does not collect',
  'The Privacy page is missing the no-collection disclosure.',
);
requireText(
  robots,
  'https://d-score.app/sitemap.xml',
  'robots.txt is missing the production sitemap.',
);
requireText(sitemap, 'https://d-score.app/app/', 'The sitemap does not include the calculator.');

if (domain.trim() !== 'd-score.app') {
  throw new Error('CNAME must contain only the canonical production domain.');
}
if (
  manifest.display !== 'standalone' ||
  manifest.id !== '/app/' ||
  manifest.start_url !== '/app/' ||
  manifest.scope !== '/app/'
) {
  throw new Error('The PWA manifest does not define the expected /app/ installation scope.');
}
if (!serviceWorker.includes('precacheAndRoute') || !serviceWorker.includes('/app/index.html')) {
  throw new Error('Workbox did not generate the expected precache and /app/ navigation fallback.');
}

const telemetryPatterns = [
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /api\.segment\.io/i,
  /sentry\.io\/api/i,
  /plausible\.io\/js/i,
  /posthog/i,
];
const textReleaseFiles = (await readdir(distributionPath(), { recursive: true })).filter((file) =>
  /\.(?:css|html|js|json|map|xml)$/u.test(file),
);
const publicDocuments = (
  await Promise.all(textReleaseFiles.map((file) => readFile(distributionPath(file), 'utf8')))
).join('\n');
for (const pattern of telemetryPatterns) {
  if (pattern.test(publicDocuments)) {
    throw new Error(`Unexpected analytics or telemetry reference: ${pattern.source}`);
  }
}

globalThis.process.stdout.write(
  `Validated production web release with ${requiredFiles.length} required files and no telemetry references.\n`,
);
