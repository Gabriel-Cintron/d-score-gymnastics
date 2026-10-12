import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRuleset, formatValidationIssues } from '@d-score-gymnastics/rulesets';

import { loadRulesets } from './lib/load-rulesets';
import type { PrivateCatalogArchive } from './lib/catalog-publication';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = resolve(packageDirectory, '../..');
const archiveFile = resolve(repositoryRoot, '.private/catalog-wording/fig-mag-2025-2028.json');
const outputFile = resolve(repositoryRoot, '.private/generated/fig-mag-2025-2028.json');

async function main(): Promise<void> {
  const archive = JSON.parse(await readFile(archiveFile, 'utf8')) as PrivateCatalogArchive;
  const loaded = await loadRulesets(resolve(packageDirectory, 'data'));
  if (loaded.issues.length > 0) throw new Error(formatValidationIssues(loaded.issues));
  const source = loaded.sources.find(({ manifest }) => manifest.id === archive.rulesetId);
  if (source === undefined) throw new Error(`Ruleset ${archive.rulesetId} was not found.`);
  const compiled = compileRuleset(source);
  const privateById = new Map(archive.elements.map((element) => [element.publicId, element]));
  const privateBuild = {
    ...compiled,
    catalogWording: {
      profile: 'private-reference' as const,
      revision: compiled.catalogWording.revision,
    },
    elements: compiled.elements.map((element) => {
      const privateRecord = privateById.get(element.id);
      if (privateRecord === undefined)
        throw new Error(`Private wording is missing for ${element.id}.`);
      return { ...element, aliases: privateRecord.aliases, name: privateRecord.name };
    }),
  };
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(privateBuild, undefined, 2)}\n`, 'utf8');
  process.stdout.write(`Built private-reference rules at ${outputFile}.\n`);
}

await main();
