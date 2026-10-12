import {
  APPARATUS_IDS,
  ELEMENT_ROUTINE_APPARATUS_IDS,
  scoreTenthsFromPoints,
  type ApparatusId,
  type ElementId,
  type ElementRoleId,
  type ElementRoutineApparatusId,
  type ScoreTenths,
} from '@d-score-gymnastics/scoring';

import type { RulesetManifest } from './schema';
import { compileApparatusRules, type CompiledApparatusRules } from './compile-apparatus-rules';
import type { ElementCountingPolicy, SharedRules } from './rules-schema';
import { RulesDataValidationError, validateRulesetSource, type RulesetSource } from './validation';

export type CompiledDifficulty =
  | {
      readonly kind: 'letter';
      readonly letter: string;
      readonly tenths: ScoreTenths;
    }
  | {
      readonly kind: 'vault';
      readonly tenths: ScoreTenths;
    };

export interface CompiledElement {
  readonly aliases: readonly string[];
  readonly apparatus: ApparatusId;
  readonly code: {
    readonly group: number;
    readonly number: number | string;
  };
  readonly difficulty: CompiledDifficulty;
  readonly families: readonly string[];
  readonly id: ElementId;
  readonly name: string;
  readonly roles: readonly ElementRoleId[];
  readonly source: {
    readonly documentId: string;
    readonly page: number;
  };
  readonly traits: readonly string[];
}

export interface CompiledElementGroupRequirements {
  readonly dismountAward: {
    readonly maximum: ScoreTenths;
    readonly mode: 'element-difficulty';
  };
  readonly minimumAwardByGroup: Readonly<Record<string, ScoreTenths>>;
  readonly regularAwardByDifficultyTenths: Readonly<Record<string, ScoreTenths>>;
  readonly regularGroups: Readonly<Record<ElementRoutineApparatusId, readonly number[]>>;
}

export interface CompiledSharedRules {
  readonly elementCounting: Readonly<Record<ElementRoutineApparatusId, ElementCountingPolicy>>;
  readonly elementGroupRequirements: CompiledElementGroupRequirements;
  readonly landingBonus: {
    readonly apparatus: readonly ApparatusId[];
    readonly minimumDifficulty: ScoreTenths;
    readonly value: ScoreTenths;
    readonly vaultRequiredTrait: string;
  };
  readonly repetition: {
    readonly maximumCreditsPerCode: number;
  };
  readonly schemaVersion: 1;
  readonly sources: readonly {
    readonly documentId: string;
    readonly pages: readonly number[];
  }[];
}

export interface CompiledRuleset {
  readonly apparatus: readonly ApparatusId[];
  readonly apparatusRules: Readonly<Record<ApparatusId, CompiledApparatusRules>>;
  readonly authority: RulesetManifest['authority'];
  readonly authoritativeRulesUrl: string;
  readonly catalogCoverage: RulesetManifest['catalogCoverage'];
  readonly catalogWording: RulesetManifest['catalogWording'];
  readonly cycle: string;
  readonly dataRevision: string;
  readonly dataVersion: string;
  readonly difficultyScale: Readonly<Record<string, ScoreTenths>>;
  readonly discipline: 'mens-artistic-gymnastics';
  readonly elements: readonly CompiledElement[];
  readonly id: string;
  readonly name: string;
  readonly schemaVersion: 1;
  readonly sharedRules: CompiledSharedRules;
  readonly sources: RulesetManifest['sources'];
  readonly status: 'complete' | 'draft';
}

export function compileRuleset(source: RulesetSource): CompiledRuleset {
  const issues = validateRulesetSource(source);
  if (issues.length > 0) {
    throw new RulesDataValidationError(issues);
  }

  const difficultyScale = Object.fromEntries(
    Object.entries(source.manifest.difficultyScale)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([letter, points]) => [letter, pointsToTenths(points)]),
  );

  const elements = source.elementFiles
    .flatMap(({ data }) =>
      data.elements.map<CompiledElement>((element) => ({
        aliases: [...element.aliases],
        apparatus: data.apparatus,
        code: { ...element.code },
        difficulty: compileDifficulty(element.difficulty, difficultyScale),
        families: [...element.families],
        id: element.id,
        name: element.name,
        roles: [...element.roles],
        source: { ...element.source },
        traits: [...element.traits],
      })),
    )
    .sort((left, right) => {
      const apparatusDifference =
        APPARATUS_IDS.indexOf(left.apparatus) - APPARATUS_IDS.indexOf(right.apparatus);
      return (
        apparatusDifference ||
        left.code.group - right.code.group ||
        compareCodeNumbers(left.code.number, right.code.number) ||
        left.id.localeCompare(right.id)
      );
    });

  return {
    apparatus: [...source.manifest.apparatus],
    apparatusRules: compileApparatusRules(source.apparatusRules, difficultyScale),
    authority: { ...source.manifest.authority },
    authoritativeRulesUrl: source.manifest.authoritativeRulesUrl,
    catalogCoverage: {
      ...source.manifest.catalogCoverage,
      expectedElements: { ...source.manifest.catalogCoverage.expectedElements },
    },
    catalogWording: { ...source.manifest.catalogWording },
    cycle: source.manifest.cycle,
    dataRevision: source.manifest.dataRevision,
    dataVersion: source.manifest.dataVersion,
    difficultyScale,
    discipline: source.manifest.discipline,
    elements,
    id: source.manifest.id,
    name: source.manifest.name,
    schemaVersion: 1,
    sharedRules: compileSharedRules(source.sharedRules, difficultyScale),
    sources: source.manifest.sources.map((document) => ({ ...document })),
    status: source.manifest.status,
  };
}

function compareCodeNumbers(left: number | string, right: number | string): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'number') return -1;
  if (typeof right === 'number') return 1;
  return left.localeCompare(right);
}

function compileSharedRules(
  sharedRules: SharedRules,
  difficultyScale: Readonly<Record<string, ScoreTenths>>,
): CompiledSharedRules {
  const regularAwardByDifficultyTenths: Record<string, ScoreTenths> = {};
  for (const awardBand of sharedRules.elementGroupRequirements.regularAwards) {
    const award = pointsToTenths(awardBand.value);
    for (const letter of awardBand.difficulties) {
      const difficulty = difficultyScale[letter];
      if (difficulty === undefined) {
        throw new Error(`Group award difficulty "${letter}" was not validated before compilation.`);
      }
      regularAwardByDifficultyTenths[String(difficulty)] = award;
    }
  }

  const minimumAwardByGroup = Object.fromEntries(
    sharedRules.elementGroupRequirements.minimumAwards
      .map(({ group, value }) => [String(group), pointsToTenths(value)] as const)
      .sort(([left], [right]) => Number(left) - Number(right)),
  );
  const elementCounting = Object.fromEntries(
    ELEMENT_ROUTINE_APPARATUS_IDS.map((apparatus) => [
      apparatus,
      { ...sharedRules.elementCounting[apparatus] },
    ]),
  ) as Record<ElementRoutineApparatusId, ElementCountingPolicy>;
  const regularGroups = {} as Record<ElementRoutineApparatusId, readonly number[]>;
  for (const apparatus of ELEMENT_ROUTINE_APPARATUS_IDS) {
    regularGroups[apparatus] = [...sharedRules.elementGroupRequirements.regularGroups[apparatus]];
  }

  return {
    elementCounting,
    elementGroupRequirements: {
      dismountAward: {
        maximum: pointsToTenths(sharedRules.elementGroupRequirements.dismountAward.maximum),
        mode: sharedRules.elementGroupRequirements.dismountAward.mode,
      },
      minimumAwardByGroup,
      regularAwardByDifficultyTenths: Object.fromEntries(
        Object.entries(regularAwardByDifficultyTenths).sort(
          ([left], [right]) => Number(left) - Number(right),
        ),
      ),
      regularGroups,
    },
    landingBonus: {
      apparatus: [...sharedRules.landingBonus.apparatus],
      minimumDifficulty:
        difficultyScale[sharedRules.landingBonus.minimumDifficulty] ??
        missingDifficulty(sharedRules.landingBonus.minimumDifficulty),
      value: pointsToTenths(sharedRules.landingBonus.value),
      vaultRequiredTrait: sharedRules.landingBonus.vaultRequiredTrait,
    },
    repetition: { ...sharedRules.repetition },
    schemaVersion: sharedRules.schemaVersion,
    sources: sharedRules.sources.map((source) => ({
      documentId: source.documentId,
      pages: [...source.pages],
    })),
  };
}

function missingDifficulty(letter: string): never {
  throw new Error(`Landing-bonus difficulty "${letter}" was not validated before compilation.`);
}

function pointsToTenths(points: number): ScoreTenths {
  return scoreTenthsFromPoints(points);
}

function compileDifficulty(
  difficulty: number | string,
  difficultyScale: Readonly<Record<string, ScoreTenths>>,
): CompiledDifficulty {
  if (typeof difficulty === 'number') {
    return { kind: 'vault', tenths: pointsToTenths(difficulty) };
  }

  const tenths = difficultyScale[difficulty];
  if (tenths === undefined) {
    throw new Error(`Difficulty "${difficulty}" was not validated before compilation.`);
  }

  return { kind: 'letter', letter: difficulty, tenths };
}
