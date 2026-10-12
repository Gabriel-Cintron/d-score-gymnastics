import {
  APPARATUS_IDS,
  scoreTenthsFromPoints,
  type ApparatusId,
  type ScoreTenths,
} from '@d-score-gymnastics/scoring';

import type {
  ApparatusRulesFile,
  FloorRules,
  HorizontalBarRules,
  ParallelBarsRules,
  PommelHorseRules,
  RingsRules,
  SpecialLimit,
} from './apparatus-rules-schema';
import type { ApparatusRulesFileSource } from './validation';

interface CompiledRuleSource {
  readonly documentId: string;
  readonly pages: readonly number[];
}

interface CompiledRulesBase {
  readonly apparatus: ApparatusId;
  readonly schemaVersion: 1;
  readonly sources: readonly CompiledRuleSource[];
}

export interface CompiledFloorRules extends CompiledRulesBase {
  readonly apparatus: 'floor-exercise';
  readonly balanceRequirementTrait: string;
  readonly connection: {
    readonly highPartnerMinimum: ScoreTenths;
    readonly highValue: ScoreTenths;
    readonly minimumFirstDifficulty: ScoreTenths;
    readonly minimumPartnerDifficulty: ScoreTenths;
    readonly standardValue: ScoreTenths;
  };
  readonly dismountRequiredTrait: string;
  readonly specialLimits: readonly SpecialLimit[];
}

export interface CompiledPommelHorseRules extends CompiledRulesBase {
  readonly apparatus: 'pommel-horse';
  readonly occurrenceQualifiers: PommelHorseRules['occurrenceQualifiers'];
  readonly sequenceSeparatorTrait: string;
  readonly sequenceTypes: PommelHorseRules['sequenceTypes'];
  readonly specialLimits: readonly SpecialLimit[];
}

export interface CompiledRingsRules extends CompiledRulesBase {
  readonly apparatus: 'still-rings';
  readonly finalPositionFamilyPrefix: string;
  readonly maximumConsecutiveStrength: number;
  readonly separator: {
    readonly excludedTraits: readonly string[];
    readonly group: number;
    readonly minimumDifficulty: ScoreTenths;
  };
  readonly strengthGroups: readonly number[];
  readonly swingHandstandRequirementTrait: string;
  readonly upgradeConnection: {
    readonly increment: ScoreTenths;
    readonly sourceTrait: string;
    readonly targetTrait: string;
  };
}

export interface CompiledParallelBarsRules extends CompiledRulesBase {
  readonly apparatus: 'parallel-bars';
  readonly healyUpgrade: {
    readonly excludedSourceTrait: string;
    readonly incrementPerElement: ScoreTenths;
    readonly sourceTrait: string;
    readonly targetTrait: string;
  };
  readonly specialLimits: readonly SpecialLimit[];
}

export interface CompiledHorizontalBarRules extends CompiledRulesBase {
  readonly apparatus: 'horizontal-bar';
  readonly connection: {
    readonly flightFlight: readonly {
      readonly minimumFirst: ScoreTenths;
      readonly minimumSecond: ScoreTenths;
      readonly value: ScoreTenths;
    }[];
    readonly flightWithNonFlight: readonly {
      readonly minimumFlight: ScoreTenths;
      readonly minimumNonFlight: ScoreTenths;
      readonly value: ScoreTenths;
    }[];
  };
  readonly fifthFlight: {
    readonly connectedMinimumDifficulty: ScoreTenths;
    readonly group: number;
    readonly maximumWhenQualified: number;
  };
  readonly specialLimits: readonly SpecialLimit[];
}

export interface CompiledVaultRules extends CompiledRulesBase {
  readonly apparatus: 'vault';
}

export type CompiledApparatusRules =
  | CompiledFloorRules
  | CompiledHorizontalBarRules
  | CompiledParallelBarsRules
  | CompiledPommelHorseRules
  | CompiledRingsRules
  | CompiledVaultRules;

export function compileApparatusRules(
  ruleSources: readonly ApparatusRulesFileSource[],
  difficultyScale: Readonly<Record<string, ScoreTenths>>,
): Readonly<Record<ApparatusId, CompiledApparatusRules>> {
  const entries = ruleSources.map(
    ({ data }) => [data.apparatus, compileOne(data, difficultyScale)] as const,
  );
  const compiled = Object.fromEntries(entries) as Partial<
    Record<ApparatusId, CompiledApparatusRules>
  >;
  for (const apparatus of APPARATUS_IDS) {
    if (compiled[apparatus] === undefined) {
      throw new Error(`Apparatus rules for "${apparatus}" were not validated before compilation.`);
    }
  }
  return compiled as Record<ApparatusId, CompiledApparatusRules>;
}

function compileOne(
  rules: ApparatusRulesFile,
  difficultyScale: Readonly<Record<string, ScoreTenths>>,
): CompiledApparatusRules {
  const base = {
    apparatus: rules.apparatus,
    schemaVersion: rules.schemaVersion,
    sources: rules.sources.map((source) => ({
      documentId: source.documentId,
      pages: [...source.pages],
    })),
  };

  switch (rules.apparatus) {
    case 'floor-exercise':
      return compileFloor(rules, base, difficultyScale);
    case 'pommel-horse':
      return {
        ...base,
        apparatus: 'pommel-horse',
        occurrenceQualifiers: {
          russianLocation: {
            options: [...rules.occurrenceQualifiers.russianLocation.options],
            requiredTrait: rules.occurrenceQualifiers.russianLocation.requiredTrait,
          },
        },
        sequenceSeparatorTrait: rules.sequenceSeparatorTrait,
        sequenceTypes: { ...rules.sequenceTypes },
        specialLimits: copyLimits(rules.specialLimits),
      };
    case 'still-rings':
      return compileRings(rules, base, difficultyScale);
    case 'vault':
      return { ...base, apparatus: 'vault' };
    case 'parallel-bars':
      return compileParallelBars(rules, base);
    case 'horizontal-bar':
      return compileHorizontalBar(rules, base, difficultyScale);
  }
}

function compileFloor(
  rules: FloorRules,
  base: CompiledRulesBase,
  difficultyScale: Readonly<Record<string, ScoreTenths>>,
): CompiledFloorRules {
  return {
    ...base,
    apparatus: 'floor-exercise',
    balanceRequirementTrait: rules.balanceRequirementTrait,
    connection: {
      highPartnerMinimum: difficulty(difficultyScale, rules.connection.highPartnerMinimum),
      highValue: points(rules.connection.highValue),
      minimumFirstDifficulty: difficulty(difficultyScale, rules.connection.minimumFirstDifficulty),
      minimumPartnerDifficulty: difficulty(
        difficultyScale,
        rules.connection.minimumPartnerDifficulty,
      ),
      standardValue: points(rules.connection.standardValue),
    },
    dismountRequiredTrait: rules.dismountRequiredTrait,
    specialLimits: copyLimits(rules.specialLimits),
  };
}

function compileRings(
  rules: RingsRules,
  base: CompiledRulesBase,
  difficultyScale: Readonly<Record<string, ScoreTenths>>,
): CompiledRingsRules {
  return {
    ...base,
    apparatus: 'still-rings',
    finalPositionFamilyPrefix: rules.finalPositionFamilyPrefix,
    maximumConsecutiveStrength: rules.maximumConsecutiveStrength,
    separator: {
      excludedTraits: [...rules.separator.excludedTraits],
      group: rules.separator.group,
      minimumDifficulty: difficulty(difficultyScale, rules.separator.minimumDifficulty),
    },
    strengthGroups: [...rules.strengthGroups],
    swingHandstandRequirementTrait: rules.swingHandstandRequirementTrait,
    upgradeConnection: {
      increment: points(rules.upgradeConnection.increment),
      sourceTrait: rules.upgradeConnection.sourceTrait,
      targetTrait: rules.upgradeConnection.targetTrait,
    },
  };
}

function compileParallelBars(
  rules: ParallelBarsRules,
  base: CompiledRulesBase,
): CompiledParallelBarsRules {
  return {
    ...base,
    apparatus: 'parallel-bars',
    healyUpgrade: {
      ...rules.healyUpgrade,
      incrementPerElement: points(rules.healyUpgrade.incrementPerElement),
    },
    specialLimits: copyLimits(rules.specialLimits),
  };
}

function compileHorizontalBar(
  rules: HorizontalBarRules,
  base: CompiledRulesBase,
  difficultyScale: Readonly<Record<string, ScoreTenths>>,
): CompiledHorizontalBarRules {
  return {
    ...base,
    apparatus: 'horizontal-bar',
    connection: {
      flightFlight: rules.connection.flightFlight.map((band) => ({
        minimumFirst: difficulty(difficultyScale, band.minimumFirst),
        minimumSecond: difficulty(difficultyScale, band.minimumSecond),
        value: points(band.value),
      })),
      flightWithNonFlight: rules.connection.flightWithNonFlight.map((band) => ({
        minimumFlight: difficulty(difficultyScale, band.minimumFlight),
        minimumNonFlight: difficulty(difficultyScale, band.minimumNonFlight),
        value: points(band.value),
      })),
    },
    fifthFlight: {
      connectedMinimumDifficulty: difficulty(
        difficultyScale,
        rules.fifthFlight.connectedMinimumDifficulty,
      ),
      group: rules.fifthFlight.group,
      maximumWhenQualified: rules.fifthFlight.maximumWhenQualified,
    },
    specialLimits: copyLimits(rules.specialLimits),
  };
}

function copyLimits(limits: readonly SpecialLimit[]): readonly SpecialLimit[] {
  return limits.map((limit) => ({ ...limit }));
}

function difficulty(scale: Readonly<Record<string, ScoreTenths>>, letter: string): ScoreTenths {
  const value = scale[letter];
  if (value === undefined) {
    throw new Error(`Difficulty "${letter}" was not validated before apparatus-rule compilation.`);
  }
  return value;
}

function points(value: number): ScoreTenths {
  return scoreTenthsFromPoints(value);
}
