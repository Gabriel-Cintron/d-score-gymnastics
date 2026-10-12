import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { APPARATUS_IDS } from '@d-score-gymnastics/scoring';
import { parse, stringify } from 'yaml';

import { elementFileSchema } from '../src/schema';
import { createPublicLabelCandidate, type PrivateCatalogArchive } from './lib/catalog-publication';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = resolve(packageDirectory, '../..');
const dataDirectory = resolve(packageDirectory, 'data/fig-mag-2025-2028');
const archiveFile = resolve(repositoryRoot, '.private/catalog-wording/fig-mag-2025-2028.json');

async function main(): Promise<void> {
  const archive = JSON.parse(await readFile(archiveFile, 'utf8')) as PrivateCatalogArchive;
  if (archive.schemaVersion !== 1 || archive.rulesetId !== 'fig-mag-2025-2028') {
    throw new Error('The private catalog archive is missing or incompatible.');
  }
  const sourceById = new Map(
    archive.elements.flatMap((element) => [
      [element.id, element] as const,
      [element.publicId, element] as const,
    ]),
  );
  const idMapping = new Map(archive.elements.map(({ id, publicId }) => [id, publicId]));

  for (const apparatus of APPARATUS_IDS) {
    const path = resolve(dataDirectory, apparatus, 'elements.yaml');
    const parsed = elementFileSchema.parse(parse(await readFile(path, 'utf8')));
    const migrated = {
      ...parsed,
      elements: parsed.elements.map((element) => {
        const source = sourceById.get(element.id);
        if (source === undefined || source.apparatus !== apparatus) {
          throw new Error(`Private archive has no matching ${apparatus} record for ${element.id}.`);
        }
        return {
          ...element,
          aliases: independentAliases(source.aliases),
          id: source.publicId,
          name: createPublicLabelCandidate(source.name, source.aliases),
        };
      }),
    };
    elementFileSchema.parse(migrated);
    await writeFile(path, stringify(migrated, { lineWidth: 100, sortMapEntries: false }), 'utf8');
  }

  for (const path of await yamlFiles(dataDirectory)) {
    if (path.endsWith('/elements.yaml')) continue;
    const source = await readFile(path, 'utf8');
    const migrated = replaceIdsInText(source, idMapping);
    if (migrated !== source) await writeFile(path, migrated, 'utf8');
  }

  const importerPath = resolve(packageDirectory, 'scripts/import-fig-catalog.ts');
  const importer = await readFile(importerPath, 'utf8');
  const migratedImporter = replaceIdsInText(importer, idMapping);
  if (migratedImporter !== importer) await writeFile(importerPath, migratedImporter, 'utf8');

  for (const directory of [
    resolve(repositoryRoot, 'apps/d-score-gymnastics/src'),
    resolve(repositoryRoot, 'apps/d-score-gymnastics/e2e'),
    resolve(repositoryRoot, 'packages/rulesets/tests'),
    resolve(repositoryRoot, 'packages/scoring/tests'),
  ]) {
    for (const path of await sourceReferenceFiles(directory)) {
      const source = await readFile(path, 'utf8');
      const migrated = replaceIdsInText(source, idMapping);
      if (migrated !== source) await writeFile(path, migrated, 'utf8');
    }
  }

  process.stdout.write(
    `Migrated ${archive.elements.length} catalog elements to neutral public IDs and independent draft labels.\n`,
  );
}

function independentAliases(aliases: readonly string[]): readonly string[] {
  return [
    ...new Set(aliases.map((alias) => alias.trim()).filter((alias) => wordCount(alias) <= 5)),
  ];
}

function wordCount(value: string): number {
  return value.split(/\s+/u).filter((word) => word.length > 0).length;
}

function replaceIdsInText(source: string, mapping: ReadonlyMap<string, string>): string {
  return [...mapping.entries()]
    .sort(([left], [right]) => right.length - left.length)
    .reduce((text, [oldId, publicId]) => text.split(oldId).join(publicId), source);
}

async function yamlFiles(directory: string): Promise<readonly string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await yamlFiles(path)));
    else if (entry.isFile() && entry.name.endsWith('.yaml')) files.push(path);
  }
  return files.sort((left, right) => left.localeCompare(right, 'en-US'));
}

async function sourceReferenceFiles(directory: string): Promise<readonly string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceReferenceFiles(path)));
    else if (entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name)) files.push(path);
  }
  return files.sort((left, right) => left.localeCompare(right, 'en-US'));
}

await main();
