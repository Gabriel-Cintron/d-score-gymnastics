import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { replaceKnownElementIds, type PrivateCatalogArchive } from './lib/catalog-publication';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = resolve(packageDirectory, '../..');
const privateDirectory = resolve(repositoryRoot, '.private');

async function main(): Promise<void> {
  const { input, output } = parseArguments(process.argv.slice(2));
  const outputPath = resolve(repositoryRoot, output);
  if (!isInside(privateDirectory, outputPath)) {
    throw new Error(
      'Migrated development backups must be written under the ignored .private directory.',
    );
  }
  const inputPath = isAbsolute(input) ? input : resolve(repositoryRoot, input);
  if (inputPath === outputPath)
    throw new Error('Choose a different output path; input is never overwritten.');

  const archive = JSON.parse(
    await readFile(resolve(privateDirectory, 'catalog-wording/fig-mag-2025-2028.json'), 'utf8'),
  ) as PrivateCatalogArchive;
  const document = JSON.parse(await readFile(inputPath, 'utf8')) as unknown;
  const mapping = new Map(archive.elements.map(({ id, publicId }) => [id, publicId]));
  const migrated = updateRulesetVersion(replaceKnownElementIds(document, mapping));
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(migrated, undefined, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  process.stdout.write(`Migrated development backup to ${outputPath}.\n`);
}

function parseArguments(arguments_: readonly string[]): {
  readonly input: string;
  readonly output: string;
} {
  let input: string | undefined;
  let output: string | undefined;
  for (let index = 0; index < arguments_.length; index += 1) {
    const option = arguments_[index];
    if (index === 0 && option === '--') continue;
    const value = arguments_[index + 1];
    if ((option === '--input' || option === '--output') && value !== undefined) {
      if (option === '--input') input = value;
      else output = value;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete option "${String(option)}".`);
    }
  }
  if (input === undefined || output === undefined) {
    throw new Error(
      'Usage: migrate-private-backup --input <backup.json> --output .private/<backup.json>',
    );
  }
  return { input, output };
}

function isInside(directory: string, path: string): boolean {
  const child = relative(directory, path);
  return child.length > 0 && !child.startsWith('..') && !isAbsolute(child);
}

function updateRulesetVersion<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => updateRulesetVersion(item)) as T;
  if (typeof value !== 'object' || value === null) return value;
  const entries = Object.entries(value).map(([key, item]) => [key, updateRulesetVersion(item)]);
  const record = Object.fromEntries(entries) as Record<string, unknown>;
  if (record.id === 'fig-mag-2025-2028') {
    record.dataRevision = '2026-09-03';
    record.dataVersion = '1.0.0';
  }
  return record as T;
}

await main();
