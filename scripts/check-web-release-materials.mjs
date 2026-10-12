import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const json = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const [pkg, app, rules] = await Promise.all([
  json('package.json'),
  json('apps/d-score-gymnastics/package.json'),
  json('packages/rulesets/generated/fig-mag-2025-2028.json'),
]);
if (
  pkg.version !== app.version ||
  pkg.version !== rules.dataVersion ||
  rules.status !== 'complete'
) {
  throw new Error('Web release versions or ruleset completion disagree.');
}
if (rules.elements.length !== 738 || rules.id !== 'fig-mag-2025-2028') {
  throw new Error('Web release catalog inventory is inconsistent.');
}
await Promise.all(
  [
    'docs/release.md',
    'release/checklists/web-deployment.md',
    'SECURITY.md',
    'THIRD_PARTY_NOTICES.md',
  ].map((path) => access(resolve(root, path))),
);
execFileSync(globalThis.process.execPath, ['scripts/check-web-export.mjs'], {
  cwd: resolve(root, 'apps/d-score-gymnastics'),
  stdio: 'inherit',
});
globalThis.console.log(
  `Validated web release ${pkg.version}; native release materials are separate.`,
);
