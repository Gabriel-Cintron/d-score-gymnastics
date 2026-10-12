import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { APPARATUS_IDS, type ApparatusId } from '@d-score-gymnastics/scoring';
import {
  apparatusRulesFileSchema,
  elementFileSchema,
  rulesetManifestSchema,
  schemaValidationIssues,
  scoringFixtureSchema,
  sharedRulesSchema,
  validateRulesetSource,
  type ElementFileSource,
  type ApparatusRulesFileSource,
  type RulesetSource,
  type ScoringFixtureSource,
  type ValidationIssue,
} from '@d-score-gymnastics/rulesets';
import { parse } from 'yaml';

export interface LoadRulesetsResult {
  readonly issues: readonly ValidationIssue[];
  readonly sources: readonly RulesetSource[];
}

type ReadYamlResult =
  | { readonly kind: 'missing' }
  | { readonly issues: readonly ValidationIssue[]; readonly kind: 'invalid' }
  | { readonly kind: 'valid'; readonly value: unknown };

export async function loadRulesets(dataDirectory: string): Promise<LoadRulesetsResult> {
  const issues: ValidationIssue[] = [];
  const sources: RulesetSource[] = [];
  let directoryNames: string[];

  try {
    const entries = await readdir(dataDirectory, { withFileTypes: true });
    directoryNames = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    return {
      issues: [fileSystemIssue('.', 'ruleset.read_data_directory', error)],
      sources,
    };
  }

  if (directoryNames.length === 0) {
    return {
      issues: [
        {
          code: 'ruleset.no_directories',
          file: '.',
          message: 'No ruleset directories were found.',
          path: [],
        },
      ],
      sources,
    };
  }

  for (const directoryName of directoryNames) {
    const loaded = await loadRuleset(dataDirectory, directoryName);
    issues.push(...loaded.issues);
    if (loaded.source !== undefined) {
      sources.push(loaded.source);
    }
  }

  return { issues, sources };
}

async function loadRuleset(
  dataDirectory: string,
  directoryName: string,
): Promise<{
  readonly issues: readonly ValidationIssue[];
  readonly source?: RulesetSource;
}> {
  const issues: ValidationIssue[] = [];
  const rulesetDirectory = join(dataDirectory, directoryName);
  const manifestFile = `${directoryName}/manifest.yaml`;
  const manifestResult = await readYaml(join(rulesetDirectory, 'manifest.yaml'), manifestFile);

  if (manifestResult.kind === 'missing') {
    return {
      issues: [
        {
          code: 'ruleset.missing_manifest',
          file: manifestFile,
          message: 'Required manifest file does not exist.',
          path: [],
        },
      ],
    };
  }

  if (manifestResult.kind === 'invalid') {
    return { issues: manifestResult.issues };
  }

  const parsedManifest = rulesetManifestSchema.safeParse(manifestResult.value);
  if (!parsedManifest.success) {
    return { issues: schemaValidationIssues(manifestFile, parsedManifest.error) };
  }

  const sharedRulesFile = `${directoryName}/shared-rules.yaml`;
  const sharedRulesResult = await readYaml(
    join(rulesetDirectory, 'shared-rules.yaml'),
    sharedRulesFile,
  );
  if (sharedRulesResult.kind === 'missing') {
    return {
      issues: [
        {
          code: 'ruleset.missing_shared_rules',
          file: sharedRulesFile,
          message: 'Required shared rules file does not exist.',
          path: [],
        },
      ],
    };
  }
  if (sharedRulesResult.kind === 'invalid') {
    return { issues: sharedRulesResult.issues };
  }

  const parsedSharedRules = sharedRulesSchema.safeParse(sharedRulesResult.value);
  if (!parsedSharedRules.success) {
    return { issues: schemaValidationIssues(sharedRulesFile, parsedSharedRules.error) };
  }

  const elementFiles: ElementFileSource[] = [];
  const apparatusRules: ApparatusRulesFileSource[] = [];

  for (const apparatus of APPARATUS_IDS) {
    const file = `${directoryName}/${apparatus}/elements.yaml`;
    const fileResult = await readYaml(join(rulesetDirectory, apparatus, 'elements.yaml'), file);

    if (fileResult.kind === 'missing') {
      continue;
    }
    if (fileResult.kind === 'invalid') {
      issues.push(...fileResult.issues);
      continue;
    }

    const parsedFile = elementFileSchema.safeParse(fileResult.value);
    if (!parsedFile.success) {
      issues.push(...schemaValidationIssues(file, parsedFile.error));
      continue;
    }

    elementFiles.push({
      data: parsedFile.data,
      file,
      pathApparatus: apparatus,
    });
  }

  for (const apparatus of APPARATUS_IDS) {
    const rulesFile = `${directoryName}/${apparatus}/rules.yaml`;
    const rulesResult = await readYaml(join(rulesetDirectory, apparatus, 'rules.yaml'), rulesFile);
    if (rulesResult.kind === 'invalid') {
      issues.push(...rulesResult.issues);
    } else if (rulesResult.kind === 'valid') {
      const parsedRules = apparatusRulesFileSchema.safeParse(rulesResult.value);
      if (!parsedRules.success) {
        issues.push(...schemaValidationIssues(rulesFile, parsedRules.error));
      } else {
        apparatusRules.push({
          data: parsedRules.data,
          file: rulesFile,
          pathApparatus: apparatus,
        });
      }
    }
  }

  const loadedFixtures = await loadScoringFixtures(rulesetDirectory, directoryName);
  issues.push(...loadedFixtures.issues);

  const source: RulesetSource = {
    apparatusRules,
    directory: directoryName,
    elementFiles,
    fixtures: loadedFixtures.fixtures,
    manifest: parsedManifest.data,
    manifestFile,
    sharedRules: parsedSharedRules.data,
    sharedRulesFile,
  };
  issues.push(...validateRulesetSource(source));

  return { issues, source };
}

async function loadScoringFixtures(
  rulesetDirectory: string,
  directoryName: string,
): Promise<{
  readonly fixtures: readonly ScoringFixtureSource[];
  readonly issues: readonly ValidationIssue[];
}> {
  const fixtureDirectory = join(rulesetDirectory, 'fixtures');
  const fixtures: ScoringFixtureSource[] = [];
  const issues: ValidationIssue[] = [];
  let fileNames: string[];

  try {
    const entries = await readdir(fixtureDirectory, { withFileTypes: true });
    fileNames = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return { fixtures, issues };
    }
    return {
      fixtures,
      issues: [
        fileSystemIssue(`${directoryName}/fixtures`, 'ruleset.read_fixture_directory', error),
      ],
    };
  }

  for (const fileName of fileNames) {
    const file = `${directoryName}/fixtures/${fileName}`;
    const fileResult = await readYaml(join(fixtureDirectory, fileName), file);
    if (fileResult.kind === 'missing') {
      continue;
    }
    if (fileResult.kind === 'invalid') {
      issues.push(...fileResult.issues);
      continue;
    }

    const parsedFixture = scoringFixtureSchema.safeParse(fileResult.value);
    if (!parsedFixture.success) {
      issues.push(...schemaValidationIssues(file, parsedFixture.error));
      continue;
    }

    fixtures.push({ data: parsedFixture.data, file });
  }

  return { fixtures, issues };
}

async function readYaml(filePath: string, displayPath: string): Promise<ReadYamlResult> {
  let contents: string;

  try {
    contents = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return { kind: 'missing' };
    }
    return {
      issues: [fileSystemIssue(displayPath, 'ruleset.read_file', error)],
      kind: 'invalid',
    };
  }

  try {
    return { kind: 'valid', value: parse(contents, { uniqueKeys: true }) };
  } catch (error) {
    return {
      issues: [
        {
          code: 'yaml.parse',
          file: displayPath,
          message: errorMessage(error),
          path: [],
        },
      ],
      kind: 'invalid',
    };
  }
}

function fileSystemIssue(file: string, code: string, error: unknown): ValidationIssue {
  return {
    code,
    file,
    message: errorMessage(error),
    path: [],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

export function countElementsByApparatus(
  source: RulesetSource,
): Readonly<Record<ApparatusId, number>> {
  return Object.fromEntries(
    APPARATUS_IDS.map((apparatus) => [
      apparatus,
      source.elementFiles.find((file) => file.pathApparatus === apparatus)?.data.elements.length ??
        0,
    ]),
  ) as Record<ApparatusId, number>;
}
