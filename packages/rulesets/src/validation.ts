import { APPARATUS_CODE_BY_ID, APPARATUS_IDS, type ApparatusId } from '@d-score-gymnastics/scoring';
import type { ZodError } from 'zod';

import { validateScoringFixtures } from './fixture-validation';
import type { ApparatusRulesFile } from './apparatus-rules-schema';
import type { SharedRules } from './rules-schema';
import type { ElementFile, RulesetManifest } from './schema';
import type { ScoringFixture } from './scoring-fixture';

export type DataPathSegment = number | string;

export interface ValidationIssue {
  readonly code: string;
  readonly file: string;
  readonly message: string;
  readonly path: readonly DataPathSegment[];
}

export interface ElementFileSource {
  readonly data: ElementFile;
  readonly file: string;
  readonly pathApparatus: ApparatusId;
}

export interface ApparatusRulesFileSource {
  readonly data: ApparatusRulesFile;
  readonly file: string;
  readonly pathApparatus: ApparatusId;
}

export interface ScoringFixtureSource {
  readonly data: ScoringFixture;
  readonly file: string;
}

export interface RulesetSource {
  readonly apparatusRules: readonly ApparatusRulesFileSource[];
  readonly directory: string;
  readonly elementFiles: readonly ElementFileSource[];
  readonly fixtures: readonly ScoringFixtureSource[];
  readonly manifest: RulesetManifest;
  readonly manifestFile: string;
  readonly sharedRules: SharedRules;
  readonly sharedRulesFile: string;
}

export class RulesDataValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(`Rules data has ${issues.length} validation issue${issues.length === 1 ? '' : 's'}.`);
    this.name = 'RulesDataValidationError';
    this.issues = issues;
  }
}

export function schemaValidationIssues(file: string, error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    code: `schema.${issue.code}`,
    file,
    message: issue.message,
    path: issue.path.map((segment) => (typeof segment === 'number' ? segment : String(segment))),
  }));
}

export function validateRulesetSource(source: RulesetSource): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (source.directory !== source.manifest.id) {
    issues.push({
      code: 'ruleset.directory_mismatch',
      file: source.manifestFile,
      message: `Manifest ID "${source.manifest.id}" must match directory "${source.directory}".`,
      path: ['id'],
    });
  }

  validateManifestApparatus(source, issues);

  const sourceIds = new Map<string, number>();
  source.manifest.sources.forEach((document, index) => {
    const previousIndex = sourceIds.get(document.id);
    if (previousIndex !== undefined) {
      issues.push({
        code: 'source.duplicate_id',
        file: source.manifestFile,
        message: `Source ID "${document.id}" is already defined at sources[${previousIndex}].`,
        path: ['sources', index, 'id'],
      });
      return;
    }

    sourceIds.set(document.id, index);
  });

  source.sharedRules.sources.forEach((ruleSource, index) => {
    if (!sourceIds.has(ruleSource.documentId)) {
      issues.push({
        code: 'rules.unknown_source',
        file: source.sharedRulesFile,
        message: `Source "${ruleSource.documentId}" is not declared in the manifest.`,
        path: ['sources', index, 'documentId'],
      });
    }
  });

  validateSharedRules(source, issues);

  validateElementFileCoverage(source, issues);
  validateApparatusRulesCoverage(source, sourceIds, issues);

  for (const apparatus of APPARATUS_IDS) {
    const actual =
      source.elementFiles.find(({ pathApparatus }) => pathApparatus === apparatus)?.data.elements
        .length ?? 0;
    const expected = source.manifest.catalogCoverage.expectedElements[apparatus];
    if (actual !== expected) {
      issues.push({
        code: 'catalog.coverage_mismatch',
        file: source.manifestFile,
        message: `${apparatus} contains ${actual} elements; catalogCoverage expects ${expected}.`,
        path: ['catalogCoverage', 'expectedElements', apparatus],
      });
    }
  }

  const elementIds = new Map<string, string>();
  const elementApparatus = new Map<string, ApparatusId>();
  const officialCodes = new Map<string, string>();
  const traitsByApparatus = new Map<ApparatusId, Set<string>>(
    APPARATUS_IDS.map((apparatus) => [apparatus, new Set()]),
  );
  const familiesByApparatus = new Map<ApparatusId, Set<string>>(
    APPARATUS_IDS.map((apparatus) => [apparatus, new Set()]),
  );

  for (const fileSource of source.elementFiles) {
    const { data, file, pathApparatus } = fileSource;

    if (data.apparatus !== pathApparatus) {
      issues.push({
        code: 'apparatus.path_mismatch',
        file,
        message: `File is stored under "${pathApparatus}" but declares "${data.apparatus}".`,
        path: ['apparatus'],
      });
    }

    data.elements.forEach((element, index) => {
      const elementPath = ['elements', index] as const;
      const expectedPrefix = `${APPARATUS_CODE_BY_ID[pathApparatus]}:`;

      if (!element.id.startsWith(expectedPrefix)) {
        issues.push({
          code: 'element.id_prefix',
          file,
          message: `Element ID must begin with "${expectedPrefix}" for ${pathApparatus}.`,
          path: [...elementPath, 'id'],
        });
      }

      if (
        source.manifest.catalogWording.profile === 'independent-public' &&
        !/^(?:fx|ph|sr|vt|pb|hb):mag-\d{4}$/.test(element.id)
      ) {
        issues.push({
          code: 'element.public_id_format',
          file,
          message: 'Public catalog IDs must use a neutral apparatus sequence such as fx:mag-0001.',
          path: [...elementPath, 'id'],
        });
      }

      const previousElementFile = elementIds.get(element.id);
      if (previousElementFile !== undefined) {
        issues.push({
          code: 'element.duplicate_id',
          file,
          message: `Element ID "${element.id}" is already defined in ${previousElementFile}.`,
          path: [...elementPath, 'id'],
        });
      } else {
        elementIds.set(element.id, file);
        elementApparatus.set(element.id, data.apparatus);
      }

      const officialCode = `${data.apparatus}:${element.code.group}:${element.code.number}`;
      const previousCodeFile = officialCodes.get(officialCode);
      if (previousCodeFile !== undefined) {
        issues.push({
          code: 'element.duplicate_official_code',
          file,
          message: `Official code ${element.code.group}.${element.code.number} is already defined in ${previousCodeFile}.`,
          path: [...elementPath, 'code'],
        });
      } else {
        officialCodes.set(officialCode, file);
      }

      if (!sourceIds.has(element.source.documentId)) {
        issues.push({
          code: 'element.unknown_source',
          file,
          message: `Source "${element.source.documentId}" is not declared in the manifest.`,
          path: [...elementPath, 'source', 'documentId'],
        });
      }

      if (
        typeof element.difficulty === 'string' &&
        source.manifest.difficultyScale[element.difficulty] === undefined
      ) {
        issues.push({
          code: 'element.unknown_difficulty',
          file,
          message: `Difficulty "${element.difficulty}" is not defined in difficultyScale.`,
          path: [...elementPath, 'difficulty'],
        });
      }

      validateUniqueTerms(element.name, element.aliases, file, elementPath, issues);
      validateCanonicalName(element.name, file, elementPath, issues);
      validateUniqueIds(element.families, 'families', file, elementPath, issues);
      validateUniqueRoles(element.roles, file, elementPath, issues);
      validateUniqueIds(element.traits, 'traits', file, elementPath, issues);
      const isDismount = element.roles.includes('dismount');
      const apparatusRules = source.apparatusRules.find(
        ({ pathApparatus: apparatus }) => apparatus === data.apparatus,
      )?.data;
      const shouldBeDismount =
        data.apparatus === 'floor-exercise' && apparatusRules?.apparatus === 'floor-exercise'
          ? element.traits.includes(apparatusRules.dismountRequiredTrait)
          : data.apparatus === 'vault'
            ? false
            : element.code.group === 4;
      if (isDismount !== shouldBeDismount) {
        issues.push({
          code: 'element.dismount_classification',
          file,
          message:
            data.apparatus === 'floor-exercise'
              ? `Floor dismount roles must match the "${apparatusRules?.apparatus === 'floor-exercise' ? apparatusRules.dismountRequiredTrait : 'configured'}" trait.`
              : 'Dismount roles must match the apparatus dismount group.',
          path: [...elementPath, 'roles'],
        });
      }
      element.traits.forEach((trait) => traitsByApparatus.get(data.apparatus)?.add(trait));
      element.families.forEach((family) => familiesByApparatus.get(data.apparatus)?.add(family));
    });
  }

  validateApparatusRuleSemantics(source, traitsByApparatus, familiesByApparatus, issues);

  validateScoringFixtures(source, elementApparatus, issues);

  return issues;
}

function validateApparatusRuleSemantics(
  source: RulesetSource,
  traitsByApparatus: ReadonlyMap<ApparatusId, ReadonlySet<string>>,
  familiesByApparatus: ReadonlyMap<ApparatusId, ReadonlySet<string>>,
  issues: ValidationIssue[],
): void {
  for (const ruleSource of source.apparatusRules) {
    const { data: rules, file } = ruleSource;
    const traits = traitsByApparatus.get(rules.apparatus) ?? new Set();
    const families = familiesByApparatus.get(rules.apparatus) ?? new Set();
    const difficultyReferences: readonly (readonly [string, readonly DataPathSegment[]])[] =
      rules.apparatus === 'floor-exercise'
        ? [
            [rules.connection.minimumFirstDifficulty, ['connection', 'minimumFirstDifficulty']],
            [rules.connection.minimumPartnerDifficulty, ['connection', 'minimumPartnerDifficulty']],
            [rules.connection.highPartnerMinimum, ['connection', 'highPartnerMinimum']],
          ]
        : rules.apparatus === 'still-rings'
          ? [[rules.separator.minimumDifficulty, ['separator', 'minimumDifficulty']]]
          : rules.apparatus === 'horizontal-bar'
            ? [
                [
                  rules.fifthFlight.connectedMinimumDifficulty,
                  ['fifthFlight', 'connectedMinimumDifficulty'],
                ],
                ...rules.connection.flightFlight.flatMap((band, index) => [
                  [
                    band.minimumFirst,
                    ['connection', 'flightFlight', index, 'minimumFirst'],
                  ] as const,
                  [
                    band.minimumSecond,
                    ['connection', 'flightFlight', index, 'minimumSecond'],
                  ] as const,
                ]),
                ...rules.connection.flightWithNonFlight.flatMap((band, index) => [
                  [
                    band.minimumFlight,
                    ['connection', 'flightWithNonFlight', index, 'minimumFlight'],
                  ] as const,
                  [
                    band.minimumNonFlight,
                    ['connection', 'flightWithNonFlight', index, 'minimumNonFlight'],
                  ] as const,
                ]),
              ]
            : [];
    for (const [letter, path] of difficultyReferences) {
      if (source.manifest.difficultyScale[letter] === undefined) {
        issues.push({
          code: 'apparatus_rules.unknown_difficulty',
          file,
          message: `Difficulty "${letter}" is not defined in the manifest difficultyScale.`,
          path,
        });
      }
    }

    if ('specialLimits' in rules) {
      const seenLimits = new Set<string>();
      rules.specialLimits.forEach((limit, index) => {
        const key = `${limit.kind}:${limit.id}`;
        if (seenLimits.has(key)) {
          issues.push({
            code: 'apparatus_rules.duplicate_special_limit',
            file,
            message: `Special limit "${key}" appears more than once.`,
            path: ['specialLimits', index],
          });
        }
        seenLimits.add(key);
        const declared =
          limit.kind === 'trait'
            ? traits
            : new Set([
                ...families,
                ...(rules.apparatus === 'pommel-horse'
                  ? rules.occurrenceQualifiers.russianLocation.options
                  : []),
              ]);
        if (!declared.has(limit.id)) {
          issues.push({
            code: 'apparatus_rules.unknown_classification',
            file,
            message: `${limit.kind === 'trait' ? 'Trait' : 'Family'} "${limit.id}" is not used by any ${rules.apparatus} element.`,
            path: ['specialLimits', index, 'id'],
          });
        }
      });
    }

    const requiredTraits: readonly (readonly [string, readonly DataPathSegment[]])[] =
      rules.apparatus === 'floor-exercise'
        ? [
            [rules.balanceRequirementTrait, ['balanceRequirementTrait']],
            [rules.dismountRequiredTrait, ['dismountRequiredTrait']],
          ]
        : rules.apparatus === 'pommel-horse'
          ? [
              [
                rules.occurrenceQualifiers.russianLocation.requiredTrait,
                ['occurrenceQualifiers', 'russianLocation', 'requiredTrait'],
              ],
              [rules.sequenceSeparatorTrait, ['sequenceSeparatorTrait']],
            ]
          : rules.apparatus === 'still-rings'
            ? [
                [rules.swingHandstandRequirementTrait, ['swingHandstandRequirementTrait']],
                [rules.upgradeConnection.sourceTrait, ['upgradeConnection', 'sourceTrait']],
                [rules.upgradeConnection.targetTrait, ['upgradeConnection', 'targetTrait']],
                ...rules.separator.excludedTraits.map(
                  (trait, index) => [trait, ['separator', 'excludedTraits', index]] as const,
                ),
              ]
            : rules.apparatus === 'parallel-bars'
              ? [
                  [rules.healyUpgrade.sourceTrait, ['healyUpgrade', 'sourceTrait']],
                  [rules.healyUpgrade.excludedSourceTrait, ['healyUpgrade', 'excludedSourceTrait']],
                  [rules.healyUpgrade.targetTrait, ['healyUpgrade', 'targetTrait']],
                ]
              : [];
    for (const [trait, path] of requiredTraits) {
      if (!traits.has(trait)) {
        issues.push({
          code: 'apparatus_rules.unknown_trait',
          file,
          message: `Trait "${trait}" is not used by any ${rules.apparatus} element.`,
          path,
        });
      }
    }

    if (rules.apparatus === 'pommel-horse') {
      const qualifierOptions = new Set<string>();
      rules.occurrenceQualifiers.russianLocation.options.forEach((option, index) => {
        if (qualifierOptions.has(option)) {
          issues.push({
            code: 'apparatus_rules.duplicate_occurrence_qualifier',
            file,
            message: `Occurrence qualifier "${option}" appears more than once.`,
            path: ['occurrenceQualifiers', 'russianLocation', 'options', index],
          });
        }
        qualifierOptions.add(option);
      });
    }

    if (
      rules.apparatus === 'still-rings' &&
      ![...families].some((family) => family.startsWith(`${rules.finalPositionFamilyPrefix}-`))
    ) {
      issues.push({
        code: 'apparatus_rules.unknown_family_prefix',
        file,
        message: `No still-rings family begins with "${rules.finalPositionFamilyPrefix}-".`,
        path: ['finalPositionFamilyPrefix'],
      });
    }
  }
}

function validateApparatusRulesCoverage(
  source: RulesetSource,
  sourceIds: ReadonlyMap<string, number>,
  issues: ValidationIssue[],
): void {
  for (const apparatus of APPARATUS_IDS) {
    const matching = source.apparatusRules.filter(
      (ruleSource) => ruleSource.pathApparatus === apparatus,
    );
    if (matching.length === 0) {
      issues.push({
        code: 'ruleset.missing_apparatus_rules',
        file: `${source.directory}/${apparatus}`,
        message: `Missing ${apparatus}/rules.yaml.`,
        path: [],
      });
    }

    for (const duplicate of matching.slice(1)) {
      issues.push({
        code: 'ruleset.duplicate_apparatus_rules',
        file: duplicate.file,
        message: `More than one rules file was loaded for "${apparatus}".`,
        path: [],
      });
    }
  }

  for (const ruleSource of source.apparatusRules) {
    if (ruleSource.data.apparatus !== ruleSource.pathApparatus) {
      issues.push({
        code: 'apparatus_rules.path_mismatch',
        file: ruleSource.file,
        message: `File is stored under "${ruleSource.pathApparatus}" but declares "${ruleSource.data.apparatus}".`,
        path: ['apparatus'],
      });
    }
    ruleSource.data.sources.forEach((ruleReference, index) => {
      if (!sourceIds.has(ruleReference.documentId)) {
        issues.push({
          code: 'apparatus_rules.unknown_source',
          file: ruleSource.file,
          message: `Source "${ruleReference.documentId}" is not declared in the manifest.`,
          path: ['sources', index, 'documentId'],
        });
      }
    });
  }
}

function validateSharedRules(source: RulesetSource, issues: ValidationIssue[]): void {
  const awardByDifficulty = new Map<string, { bandIndex: number; value: number }>();
  const awardByPoints = new Map<number, { bandIndex: number; letter: string; value: number }>();

  source.sharedRules.elementGroupRequirements.regularAwards.forEach((band, bandIndex) => {
    band.difficulties.forEach((letter, difficultyIndex) => {
      const previous = awardByDifficulty.get(letter);
      if (previous !== undefined) {
        issues.push({
          code: 'rules.duplicate_group_award_difficulty',
          file: source.sharedRulesFile,
          message: `Difficulty "${letter}" is already assigned by regularAwards[${previous.bandIndex}].`,
          path: [
            'elementGroupRequirements',
            'regularAwards',
            bandIndex,
            'difficulties',
            difficultyIndex,
          ],
        });
        return;
      }

      awardByDifficulty.set(letter, { bandIndex, value: band.value });
      const points = source.manifest.difficultyScale[letter];
      if (points === undefined) {
        issues.push({
          code: 'rules.unknown_group_award_difficulty',
          file: source.sharedRulesFile,
          message: `Difficulty "${letter}" is not defined by the manifest difficultyScale.`,
          path: [
            'elementGroupRequirements',
            'regularAwards',
            bandIndex,
            'difficulties',
            difficultyIndex,
          ],
        });
        return;
      }

      const existingPointsAward = awardByPoints.get(points);
      if (existingPointsAward !== undefined && existingPointsAward.value !== band.value) {
        issues.push({
          code: 'rules.ambiguous_group_award',
          file: source.sharedRulesFile,
          message: `Difficulties "${existingPointsAward.letter}" and "${letter}" have the same value but different group awards.`,
          path: ['elementGroupRequirements', 'regularAwards', bandIndex, 'value'],
        });
      } else {
        awardByPoints.set(points, { bandIndex, letter, value: band.value });
      }
    });
  });

  for (const letter of Object.keys(source.manifest.difficultyScale)) {
    if (!awardByDifficulty.has(letter)) {
      issues.push({
        code: 'rules.missing_group_award_difficulty',
        file: source.sharedRulesFile,
        message: `Difficulty "${letter}" must have a regular element-group award.`,
        path: ['elementGroupRequirements', 'regularAwards'],
      });
    }
  }

  if (
    source.manifest.difficultyScale[source.sharedRules.landingBonus.minimumDifficulty] === undefined
  ) {
    issues.push({
      code: 'rules.unknown_landing_bonus_difficulty',
      file: source.sharedRulesFile,
      message: `Difficulty "${source.sharedRules.landingBonus.minimumDifficulty}" is not defined by the manifest difficultyScale.`,
      path: ['landingBonus', 'minimumDifficulty'],
    });
  }

  const landingApparatus = new Set<string>();
  source.sharedRules.landingBonus.apparatus.forEach((apparatus, index) => {
    if (landingApparatus.has(apparatus)) {
      issues.push({
        code: 'rules.duplicate_landing_bonus_apparatus',
        file: source.sharedRulesFile,
        message: `Landing bonus apparatus "${apparatus}" appears more than once.`,
        path: ['landingBonus', 'apparatus', index],
      });
    }
    landingApparatus.add(apparatus);
  });

  const minimumAwardGroups = new Map<number, number>();
  source.sharedRules.elementGroupRequirements.minimumAwards.forEach(({ group }, index) => {
    const previousIndex = minimumAwardGroups.get(group);
    if (previousIndex !== undefined) {
      issues.push({
        code: 'rules.duplicate_minimum_group_award',
        file: source.sharedRulesFile,
        message: `Element Group ${group} already has a minimum award at minimumAwards[${previousIndex}].`,
        path: ['elementGroupRequirements', 'minimumAwards', index, 'group'],
      });
    } else {
      minimumAwardGroups.set(group, index);
    }
  });

  for (const [apparatus, groups] of Object.entries(
    source.sharedRules.elementGroupRequirements.regularGroups,
  )) {
    const groupIndexes = new Map<number, number>();
    groups.forEach((group, index) => {
      const previousIndex = groupIndexes.get(group);
      if (previousIndex !== undefined) {
        issues.push({
          code: 'rules.duplicate_required_group',
          file: source.sharedRulesFile,
          message: `Element Group ${group} already appears at regularGroups.${apparatus}[${previousIndex}].`,
          path: ['elementGroupRequirements', 'regularGroups', apparatus, index],
        });
      } else {
        groupIndexes.set(group, index);
      }
    });
  }
}

export function formatValidationIssues(issues: readonly ValidationIssue[]): string {
  return [...issues]
    .sort((left, right) => {
      const leftLocation = `${left.file}:${formatDataPath(left.path)}:${left.code}`;
      const rightLocation = `${right.file}:${formatDataPath(right.path)}:${right.code}`;
      return leftLocation.localeCompare(rightLocation);
    })
    .map((issue) => {
      const dataPath = formatDataPath(issue.path);
      const location = dataPath.length > 0 ? `${issue.file}:${dataPath}` : issue.file;
      return `- ${location} [${issue.code}] ${issue.message}`;
    })
    .join('\n');
}

function validateManifestApparatus(source: RulesetSource, issues: ValidationIssue[]): void {
  for (const apparatus of APPARATUS_IDS) {
    const matchingIndexes = source.manifest.apparatus.flatMap((candidate, index) =>
      candidate === apparatus ? [index] : [],
    );

    if (matchingIndexes.length === 0) {
      issues.push({
        code: 'manifest.missing_apparatus',
        file: source.manifestFile,
        message: `Manifest must include "${apparatus}".`,
        path: ['apparatus'],
      });
    }

    for (const duplicateIndex of matchingIndexes.slice(1)) {
      issues.push({
        code: 'manifest.duplicate_apparatus',
        file: source.manifestFile,
        message: `Apparatus "${apparatus}" appears more than once.`,
        path: ['apparatus', duplicateIndex],
      });
    }
  }
}

function validateElementFileCoverage(source: RulesetSource, issues: ValidationIssue[]): void {
  for (const apparatus of APPARATUS_IDS) {
    const matchingFiles = source.elementFiles.filter(
      (fileSource) => fileSource.pathApparatus === apparatus,
    );

    if (matchingFiles.length === 0) {
      issues.push({
        code: 'ruleset.missing_element_file',
        file: source.directory,
        message: `Missing ${apparatus}/elements.yaml.`,
        path: [],
      });
    }

    for (const duplicateFile of matchingFiles.slice(1)) {
      issues.push({
        code: 'ruleset.duplicate_element_file',
        file: duplicateFile.file,
        message: `More than one element file was loaded for "${apparatus}".`,
        path: [],
      });
    }
  }
}

function validateUniqueTerms(
  name: string,
  aliases: readonly string[],
  file: string,
  elementPath: readonly DataPathSegment[],
  issues: ValidationIssue[],
): void {
  const canonicalTerm = normalizeTerm(name);
  const aliasesByTerm = new Map<string, number>();

  aliases.forEach((alias, index) => {
    const normalizedAlias = normalizeTerm(alias);

    if (normalizedAlias === canonicalTerm) {
      issues.push({
        code: 'element.alias_matches_name',
        file,
        message: `Alias "${alias}" is equivalent to the canonical name.`,
        path: [...elementPath, 'aliases', index],
      });
    }

    const previousIndex = aliasesByTerm.get(normalizedAlias);
    if (previousIndex !== undefined) {
      issues.push({
        code: 'element.duplicate_alias',
        file,
        message: `Alias "${alias}" duplicates aliases[${previousIndex}] after normalization.`,
        path: [...elementPath, 'aliases', index],
      });
      return;
    }

    aliasesByTerm.set(normalizedAlias, index);
  });
}

function validateCanonicalName(
  name: string,
  file: string,
  elementPath: readonly DataPathSegment[],
  issues: ValidationIssue[],
): void {
  let parentheses = 0;
  let closesBeforeOpen = false;
  for (const character of name) {
    if (character === '(') parentheses += 1;
    if (character === ')') parentheses -= 1;
    if (parentheses < 0) closesBeforeOpen = true;
  }
  if (parentheses !== 0 || closesBeforeOpen) {
    issues.push({
      code: 'element.unbalanced_name_parentheses',
      file,
      message: 'Canonical name contains unbalanced parentheses.',
      path: [...elementPath, 'name'],
    });
  }

  const extractionArtifact =
    /\b(?:f wd|s traight|w ith|t hr|uppper|upperaddled)\b|el - grip|handstand\.on|\d\s+\/\s*\d/i;
  if (extractionArtifact.test(name)) {
    issues.push({
      code: 'element.suspicious_name_extraction',
      file,
      message: 'Canonical name contains a likely PDF extraction artifact.',
      path: [...elementPath, 'name'],
    });
  }
}

function validateUniqueRoles(
  roles: readonly string[],
  file: string,
  elementPath: readonly DataPathSegment[],
  issues: ValidationIssue[],
): void {
  const seenRoles = new Set<string>();

  roles.forEach((role, index) => {
    if (seenRoles.has(role)) {
      issues.push({
        code: 'element.duplicate_role',
        file,
        message: `Role "${role}" appears more than once.`,
        path: [...elementPath, 'roles', index],
      });
    }
    seenRoles.add(role);
  });
}

function validateUniqueIds(
  ids: readonly string[],
  field: 'families' | 'traits',
  file: string,
  elementPath: readonly DataPathSegment[],
  issues: ValidationIssue[],
): void {
  const seen = new Set<string>();

  ids.forEach((id, index) => {
    if (seen.has(id)) {
      issues.push({
        code: `element.duplicate_${field.slice(0, -1)}`,
        file,
        message: `${field === 'families' ? 'Family' : 'Trait'} "${id}" appears more than once.`,
        path: [...elementPath, field, index],
      });
    }
    seen.add(id);
  });
}

function normalizeTerm(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function formatDataPath(path: readonly DataPathSegment[]): string {
  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === 'number') {
      return `${formatted}[${segment}]`;
    }
    return formatted.length === 0 ? segment : `${formatted}.${segment}`;
  }, '');
}
