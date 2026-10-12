import { copyFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

const distributionDirectory = resolve('dist');
const siteDirectory = resolve('site');
const appDirectory = resolve(distributionDirectory, 'app');

await mkdir(appDirectory, { recursive: true });
await rename(resolve(distributionDirectory, 'index.html'), resolve(appDirectory, 'index.html'));

await Promise.all(
  ['about', 'privacy', 'support'].map(async (page) => {
    const outputDirectory = resolve(distributionDirectory, page);
    await mkdir(outputDirectory, { recursive: true });
    await copyFile(
      resolve(siteDirectory, page, 'index.html'),
      resolve(outputDirectory, 'index.html'),
    );
  }),
);

await Promise.all(
  [
    '404.html',
    'CNAME',
    'index.html',
    'robots.txt',
    'site.css',
    'sitemap.xml',
    'social-card.png',
  ].map((file) => copyFile(resolve(siteDirectory, file), resolve(distributionDirectory, file))),
);

globalThis.process.stdout.write('Assembled landing, legal, and /app web release routes.\n');
