import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inventory, artifactDigest } from './lib/web-artifact.mjs';
import { publicWordingDigest } from './lib/catalog-digest.mjs';

const root = resolve(import.meta.dirname, '..');
const directory = resolve(root, globalThis.process.argv[2] ?? 'build/web-release');
const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const files = await inventory(resolve(directory, 'site'));
const rules = JSON.parse(
  await readFile(resolve(root, 'packages/rulesets/generated/fig-mag-2025-2028.json'), 'utf8'),
);
if (
  manifest.schemaVersion !== 1 ||
  manifest.commit !== commit ||
  manifest.catalogDigest !== publicWordingDigest(rules.elements) ||
  manifest.artifactDigest !== artifactDigest(files) ||
  JSON.stringify(manifest.files) !== JSON.stringify(files)
) {
  throw new Error('Release artifact does not match the checked-out commit or its asset checksums.');
}
globalThis.console.log(`Verified artifact ${manifest.artifactDigest} for ${commit}.`);
