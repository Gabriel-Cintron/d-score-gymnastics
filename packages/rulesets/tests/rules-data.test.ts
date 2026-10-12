import { fileURLToPath } from 'node:url';

import {
  calculateDifficulty,
  calculateVaultDifficulty,
  indexScorableElements,
  scoreTenthsToPoints,
  type RoutineEvaluator,
  type ElementRoutine,
} from '@d-score-gymnastics/scoring';
import { describe, expect, it } from 'vitest';

import {
  compileRuleset,
  createFigElementCountingEvaluator,
  createFigRulesetRuntime,
  createFigVaultEvaluator,
  elementFileSchema,
  validateRulesetSource,
  type CompiledRuleset,
  type ElementScoringFixture,
} from '../src/index';
import { loadRulesets } from '../scripts/lib/load-rulesets';

const dataDirectory = fileURLToPath(new URL('../data/', import.meta.url));

describe('FIG rules data', () => {
  it('loads every apparatus and compiles decimal values to integer tenths', async () => {
    const result = await loadRulesets(dataDirectory);

    expect(result.issues).toEqual([]);
    expect(result.sources).toHaveLength(1);

    const compiled = compileRuleset(required(result.sources[0], 'Expected one ruleset.'));
    expect(compiled.status).toBe('complete');
    expect(compiled.elements).toHaveLength(738);
    expect(compiled.elements.find(({ id }) => id === 'vt:mag-0041')?.difficulty).toEqual({
      kind: 'vault',
      tenths: 18,
    });
    expect(compiled.elements.find(({ id }) => id === 'pb:mag-0134')).toMatchObject({
      aliases: ['Peach', 'Peach to handstand'],
      difficulty: { kind: 'letter', letter: 'D', tenths: 4 },
      name: 'Peach — Felge into handstand. alternative: into one rail or 1/4 rotation (Cucherat - Celen)',
    });
    expect(compiled.sharedRules).toMatchObject({
      elementCounting: {
        'floor-exercise': {
          maximumPerElementGroup: 4,
          regularElementSlots: 7,
          reservedDismountSlots: 1,
        },
        'still-rings': {
          maximumPerElementGroup: 4,
          regularElementSlots: 7,
          reservedDismountSlots: 1,
        },
      },
      elementGroupRequirements: {
        dismountAward: { maximum: 5, mode: 'element-difficulty' },
        minimumAwardByGroup: { '1': 5 },
        regularAwardByDifficultyTenths: {
          '1': 3,
          '2': 3,
          '3': 3,
          '4': 5,
          '5': 5,
        },
        regularGroups: {
          'floor-exercise': [1, 2, 3, 4],
          'still-rings': [1, 2, 3],
        },
      },
      repetition: { maximumCreditsPerCode: 1 },
    });
  });

  it('exposes a small application-facing runtime for catalogs and scoring', async () => {
    const loaded = await loadRulesets(dataDirectory);
    const source = required(loaded.sources[0], 'Expected one ruleset.');
    const runtime = createFigRulesetRuntime(compileRuleset(source));

    expect(runtime.elementsForApparatus('floor-exercise')).toHaveLength(101);
    expect(runtime.elementsForApparatus('vault')).toHaveLength(82);

    const vaultOutcome = runtime.scoreVault({
      apparatus: 'vault',
      vaultId: 'vt:mag-0041',
    });
    expect(vaultOutcome.ok).toBe(true);
    if (!vaultOutcome.ok) throw new Error('Expected a successful Vault calculation.');
    expect(vaultOutcome.result.total).toBe(18);
  });

  it('rejects a numeric difficulty on a non-vault element', async () => {
    const result = await loadRulesets(dataDirectory);
    const source = required(result.sources[0], 'Expected one ruleset.');
    const floorFile = required(
      source.elementFiles.find(({ pathApparatus }) => pathApparatus === 'floor-exercise'),
      'Expected a floor exercise file.',
    );
    const invalidFile = {
      ...floorFile.data,
      elements: floorFile.data.elements.map((element) => ({
        ...element,
        difficulty: 1.8,
      })),
    };

    expect(elementFileSchema.safeParse(invalidFile).success).toBe(false);
  });

  it('reports an element ID with the wrong apparatus prefix', async () => {
    const result = await loadRulesets(dataDirectory);
    const invalidSource = structuredClone(required(result.sources[0], 'Expected one ruleset.'));
    const floorFile = required(
      invalidSource.elementFiles.find(({ pathApparatus }) => pathApparatus === 'floor-exercise'),
      'Expected a floor exercise file.',
    );
    required(floorFile.data.elements[0], 'Expected one floor element.').id = 'ph:wrong-prefix';

    expect(validateRulesetSource(invalidSource)).toContainEqual(
      expect.objectContaining({
        code: 'element.id_prefix',
        file: 'fig-mag-2025-2028/floor-exercise/elements.yaml',
        path: ['elements', 0, 'id'],
      }),
    );
  });

  it('reports inconsistent fixture arithmetic', async () => {
    const result = await loadRulesets(dataDirectory);
    const invalidSource = structuredClone(required(result.sources[0], 'Expected one ruleset.'));
    const fixture = required(invalidSource.fixtures[0], 'Expected one fixture.');
    fixture.data.expected.total = 9.9;

    expect(validateRulesetSource(invalidSource)).toContainEqual(
      expect.objectContaining({
        code: 'fixture.total_mismatch',
        file: fixture.file,
        path: ['expected', 'total'],
      }),
    );
  });

  it('rejects a fixture whose evaluator does not match its kind', async () => {
    const result = await loadRulesets(dataDirectory);
    const invalidSource = structuredClone(required(result.sources[0], 'Expected one ruleset.'));
    const fixture = required(
      invalidSource.fixtures.find(({ data }) => data.kind === 'fig-element-counting'),
      'Expected one FIG element-counting fixture.',
    );
    fixture.data.evaluatorId = 'foundation.credit-all-elements';

    expect(validateRulesetSource(invalidSource)).toContainEqual(
      expect.objectContaining({
        code: 'fixture.evaluator_mismatch',
        file: fixture.file,
        path: ['evaluatorId'],
      }),
    );
  });

  it('requires an element-group award for every difficulty value', async () => {
    const result = await loadRulesets(dataDirectory);
    const invalidSource = structuredClone(required(result.sources[0], 'Expected one ruleset.'));
    const lowAwardBand = required(
      invalidSource.sharedRules.elementGroupRequirements.regularAwards[0],
      'Expected a low-difficulty award band.',
    );
    lowAwardBand.difficulties = lowAwardBand.difficulties.filter(
      (difficulty) => difficulty !== 'C',
    );

    expect(validateRulesetSource(invalidSource)).toContainEqual(
      expect.objectContaining({
        code: 'rules.missing_group_award_difficulty',
        file: invalidSource.sharedRulesFile,
        path: ['elementGroupRequirements', 'regularAwards'],
      }),
    );
  });

  it('selects the equal-value element that produces the higher group award', async () => {
    const loaded = await loadRulesets(dataDirectory);
    const source = required(loaded.sources[0], 'Expected one ruleset.');
    const compiled = compileRuleset(source);
    const floorPolicy = compiled.sharedRules.elementCounting['floor-exercise'];
    const evaluator = createFigElementCountingEvaluator(
      {
        ...compiled.sharedRules,
        elementCounting: {
          ...compiled.sharedRules.elementCounting,
          'floor-exercise': { ...floorPolicy, regularElementSlots: 1 },
        },
      },
      'floor-exercise',
    );
    const outcome = calculateDifficulty({
      elementLookup: indexScorableElements(compiled.elements),
      evaluator,
      routine: {
        apparatus: 'floor-exercise',
        occurrences: [
          {
            occurrenceId: 'earlier-group-two',
            elementId: 'fx:mag-0053',
          },
          { occurrenceId: 'later-group-one', elementId: 'fx:mag-0011' },
        ],
      },
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      throw new Error('Expected a successful calculation.');
    }
    expect(
      outcome.result.elementDecisions.map(({ occurrenceId, status }) => ({
        occurrenceId,
        status,
      })),
    ).toEqual([
      { occurrenceId: 'earlier-group-two', status: 'excluded' },
      { occurrenceId: 'later-group-one', status: 'counted' },
    ]);
    expect(outcome.result.awards).toContainEqual(
      expect.objectContaining({
        occurrenceIds: ['later-group-one'],
        reason: 'fig.element-group-awarded',
        value: 5,
      }),
    );
  });

  it('executes every human-readable scoring fixture against compiled data', async () => {
    const loaded = await loadRulesets(dataDirectory);
    const source = required(loaded.sources[0], 'Expected one ruleset.');
    const compiled = compileRuleset(source);
    const elementLookup = indexScorableElements(compiled.elements);

    for (const { data: fixture } of source.fixtures) {
      if (fixture.kind === 'fig-vault') {
        const outcome = calculateVaultDifficulty({
          elementLookup,
          evaluator: createFigVaultEvaluator(compiled.sharedRules),
          routine: {
            apparatus: 'vault',
            vaultId: fixture.routine.vaultId,
            ...(fixture.routine.landing === undefined ? {} : { landing: fixture.routine.landing }),
          },
        });
        if (!outcome.ok) throw new Error(`Fixture "${fixture.id}" did not produce a result.`);
        expect(
          {
            awards: outcome.result.awards.map((award) => ({
              ...award,
              value: scoreTenthsToPoints(award.value),
            })),
            bonus: scoreTenthsToPoints(outcome.result.bonus),
            total: scoreTenthsToPoints(outcome.result.total),
            vaultDifficulty: scoreTenthsToPoints(outcome.result.vaultDifficulty),
            vaultId: outcome.result.vaultId,
            warnings: outcome.result.warnings,
          },
          fixture.id,
        ).toEqual(fixture.expected);
        continue;
      }
      const evaluator = evaluatorFor(fixture, compiled);
      if (evaluator.id !== fixture.evaluatorId) {
        throw new Error(`Fixture "${fixture.id}" declares the wrong evaluator ID.`);
      }
      const outcome = calculateDifficulty({
        elementLookup,
        evaluator,
        routine: fixtureRoutine(fixture),
      });

      if (!outcome.ok) {
        throw new Error(`Fixture "${fixture.id}" did not produce a result.`);
      }

      expect(
        {
          awards: outcome.result.awards.map((award) => ({
            ...award,
            value: scoreTenthsToPoints(award.value),
          })),
          breakdown: {
            bonus: scoreTenthsToPoints(outcome.result.breakdown.bonus),
            connection: scoreTenthsToPoints(outcome.result.breakdown.connection),
            elementDifficulty: scoreTenthsToPoints(outcome.result.breakdown.elementDifficulty),
            elementGroup: scoreTenthsToPoints(outcome.result.breakdown.elementGroup),
          },
          elementDecisions: outcome.result.elementDecisions.map((decision) => ({
            ...decision,
            creditedDifficulty: scoreTenthsToPoints(decision.creditedDifficulty),
          })),
          total: scoreTenthsToPoints(outcome.result.total),
          warnings: outcome.result.warnings,
        },
        fixture.id,
      ).toEqual(fixture.expected);
    }
  });
});

function evaluatorFor(fixture: ElementScoringFixture, compiled: CompiledRuleset): RoutineEvaluator {
  if (fixture.kind === 'fig-element-counting' || fixture.kind === 'fig-apparatus') {
    return createFigElementCountingEvaluator(
      compiled.sharedRules,
      fixture.routine.apparatus,
      fixture.kind === 'fig-apparatus'
        ? compiled.apparatusRules[fixture.routine.apparatus]
        : undefined,
    );
  }

  return {
    apparatus: fixture.routine.apparatus,
    id: fixture.evaluatorId,
    evaluate: ({ occurrences }) => ({
      awards: [],
      elementDecisions: occurrences.map(({ element, occurrenceId }) => ({
        creditedDifficulty: element.difficulty.tenths,
        elementId: element.id,
        occurrenceId,
        reason: 'element.counted-as-entered',
        reasonParameters: {},
        status: 'counted',
      })),
      warnings: [],
    }),
  };
}

function fixtureRoutine(fixture: ElementScoringFixture): ElementRoutine {
  return {
    apparatus: fixture.routine.apparatus,
    occurrences: fixture.routine.occurrences.map((occurrence) => ({
      elementId: occurrence.elementId,
      occurrenceId: occurrence.occurrenceId,
      ...(occurrence.qualifiers === undefined ? {} : { qualifiers: occurrence.qualifiers }),
    })),
    ...(fixture.routine.landing === undefined ? {} : { landing: fixture.routine.landing }),
    ...(fixture.routine.relationships === undefined
      ? {}
      : { relationships: fixture.routine.relationships }),
  };
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}
