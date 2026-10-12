import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { APPARATUS_IDS, type ApparatusId } from '@d-score-gymnastics/scoring';
import { parse } from 'yaml';

import type { ElementFile, RulesetManifest } from '../src/schema';
import {
  allocateNeutralElementIds,
  type CatalogElementSnapshot,
  type PrivateCatalogArchive,
} from './lib/catalog-publication';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = resolve(packageDirectory, '../..');
const dataDirectory = resolve(packageDirectory, 'data/fig-mag-2025-2028');
const archiveFile = resolve(repositoryRoot, '.private/catalog-wording/fig-mag-2025-2028.json');

async function main(): Promise<void> {
  try {
    await readFile(archiveFile, 'utf8');
    throw new Error(`Private archive already exists at ${archiveFile}; refusing to overwrite it.`);
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }

  const manifest = parse(
    await readFile(resolve(dataDirectory, 'manifest.yaml'), 'utf8'),
  ) as RulesetManifest;
  const elements: CatalogElementSnapshot[] = [];
  for (const apparatus of APPARATUS_IDS) {
    const file = parse(
      await readFile(resolve(dataDirectory, apparatus, 'elements.yaml'), 'utf8'),
    ) as ElementFile;
    for (const element of file.elements) {
      elements.push({
        aliases: [...element.aliases],
        apparatus: apparatus as ApparatusId,
        code: { ...element.code },
        id: element.id,
        name: element.name,
      });
    }
  }
  const mapping = allocateNeutralElementIds(elements);
  const archive: PrivateCatalogArchive = {
    archivedAt: new Date().toISOString(),
    elements: elements.map((element) => ({
      ...element,
      publicId: requiredMapping(mapping, element.id),
    })),
    rulesetId: manifest.id,
    schemaVersion: 1,
    sourceDataVersion: manifest.dataVersion,
    targetDataVersion: '1.0.0',
  };

  await mkdir(dirname(archiveFile), { recursive: true });
  await writeFile(archiveFile, `${JSON.stringify(archive, undefined, 2)}\n`, 'utf8');
  process.stdout.write(
    `Archived ${archive.elements.length} private catalog records at ${archiveFile}.\n`,
  );
}

function requiredMapping(mapping: ReadonlyMap<string, string>, oldId: string): string {
  const publicId = mapping.get(oldId);
  if (publicId === undefined) throw new Error(`No public ID was allocated for ${oldId}.`);
  return publicId;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

await main();
