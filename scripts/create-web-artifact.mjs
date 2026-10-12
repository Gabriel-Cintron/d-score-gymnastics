import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { relative, resolve, sep } from 'node:path';
import { inventory, artifactDigest } from './lib/web-artifact.mjs';
import { publicWordingDigest } from './lib/catalog-digest.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'build/web-release');
const exportedSite = resolve(root, 'apps/d-score-gymnastics/dist');
await mkdir(output, { recursive: true });
await cp(exportedSite, resolve(output, 'site'), {
  recursive: true,
  force: false,
  errorOnExist: true,
  // Expo's test server writes local diagnostics inside dist; they are not site assets.
  filter: (source) => !relative(exportedSite, source).split(sep).includes('.expo'),
});
const files = await inventory(resolve(output, 'site'));
const rules = JSON.parse(
  await readFile(resolve(root, 'packages/rulesets/generated/fig-mag-2025-2028.json'), 'utf8'),
);
const manifest = {
  schemaVersion: 1,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  version: JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version,
  catalogDigest: publicWordingDigest(rules.elements),
  artifactDigest: artifactDigest(files),
  files,
};
await writeFile(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {
  flag: 'wx',
});
globalThis.console.log(`Prepared ${Object.keys(files).length} verified assets at ${output}.`);
