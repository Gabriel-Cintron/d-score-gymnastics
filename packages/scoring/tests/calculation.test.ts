import { describe, expect, it } from 'vitest';

import {
  calculateDifficulty,
  EvaluationContractError,
  indexScorableElements,
  scoreTenths,
  type ElementRoutine,
  type RoutineEvaluator,
  type ScorableElement,
} from '../src/index';

const ringsElements: readonly ScorableElement[] = [
  {
    apparatus: 'still-rings',
    code: { group: 1, number: 49 },
    difficulty: { tenths: scoreTenths(1) },
    families: [],
    id: 'sr:mag-0017',
    roles: [],
    traits: [],
  },
  {
    apparatus: 'still-rings',
    code: { group: 4, number: 32 },
    difficulty: { tenths: scoreTenths(2) },
    families: [],
    id: 'sr:mag-0128',
    roles: ['dismount'],
    traits: [],
  },
];

const routine: ElementRoutine = {
  apparatus: 'still-rings',
  occurrences: [
    { occurrenceId: 'kip', elementId: 'sr:mag-0017' },
    {
      occurrenceId: 'dismount',
      elementId: 'sr:mag-0128',
    },
  ],
};

const creditAllEvaluator: RoutineEvaluator = {
  apparatus: 'still-rings',
  id: 'test.credit-all-elements',
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

describe('difficulty calculation pipeline', () => {
  it('resolves occurrences in order and aggregates evaluator decisions', () => {
    const outcome = calculateDifficulty({
      elementLookup: indexScorableElements(ringsElements),
      evaluator: creditAllEvaluator,
      routine,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      throw new Error('Expected a successful calculation.');
    }

    expect(outcome.result.total).toBe(3);
    expect(outcome.result.breakdown).toEqual({
      bonus: 0,
      connection: 0,
      elementDifficulty: 3,
      elementGroup: 0,
    });
    expect(outcome.result.elementDecisions.map(({ occurrenceId }) => occurrenceId)).toEqual([
      'kip',
      'dismount',
    ]);
  });

  it('returns structured issues for malformed routine references', () => {
    const outcome = calculateDifficulty({
      elementLookup: indexScorableElements(ringsElements),
      evaluator: creditAllEvaluator,
      routine: {
        apparatus: 'still-rings',
        occurrences: [
          { occurrenceId: 'same', elementId: 'sr:mag-0017' },
          { occurrenceId: 'same', elementId: 'sr:missing-element' },
        ],
      },
    });

    expect(outcome).toEqual({
      issues: [
        {
          code: 'routine.duplicate-occurrence-id',
          parameters: { occurrenceId: 'same' },
          path: ['occurrences', 1, 'occurrenceId'],
        },
        {
          code: 'routine.element-not-found',
          parameters: { elementId: 'sr:missing-element' },
          path: ['occurrences', 1, 'elementId'],
        },
      ],
      ok: false,
    });
  });

  it('validates relationship and landing references before evaluation', () => {
    const outcome = calculateDifficulty({
      elementLookup: indexScorableElements(ringsElements),
      evaluator: creditAllEvaluator,
      routine: {
        apparatus: 'still-rings',
        landing: { occurrenceId: 'missing-landing', outcome: 'stuck' },
        occurrences: routine.occurrences,
        relationships: [
          {
            connectionId: 'direct',
            kind: 'connection',
            occurrenceIds: ['kip', 'missing-connection'],
          },
          {
            kind: 'sequence',
            occurrenceIds: ['kip', 'kip'],
            sequenceId: 'direct',
            sequenceType: 'test-sequence',
          },
        ],
      },
    });

    expect(outcome).toEqual({
      issues: [
        {
          code: 'routine.relationship-occurrence-not-found',
          parameters: {
            occurrenceId: 'missing-connection',
            relationshipId: 'direct',
          },
          path: ['relationships', 0, 'occurrenceIds', 1],
        },
        {
          code: 'routine.duplicate-relationship-id',
          parameters: { relationshipId: 'direct' },
          path: ['relationships', 1, 'sequenceId'],
        },
        {
          code: 'routine.relationship-duplicate-occurrence',
          parameters: { occurrenceId: 'kip', relationshipId: 'direct' },
          path: ['relationships', 1, 'occurrenceIds', 1],
        },
        {
          code: 'routine.landing-occurrence-not-found',
          parameters: { occurrenceId: 'missing-landing' },
          path: ['landing', 'occurrenceId'],
        },
      ],
      ok: false,
    });
  });

  it('validates occurrence qualifiers before evaluation', () => {
    const outcome = calculateDifficulty({
      elementLookup: indexScorableElements(ringsElements),
      evaluator: creditAllEvaluator,
      routine: {
        apparatus: 'still-rings',
        occurrences: [
          {
            elementId: 'sr:mag-0017',
            occurrenceId: 'kip',
            qualifiers: ['location-end', 'location-end', ''],
          },
        ],
      },
    });

    expect(outcome).toEqual({
      issues: [
        {
          code: 'routine.duplicate-occurrence-qualifier',
          parameters: { qualifier: 'location-end' },
          path: ['occurrences', 0, 'qualifiers', 1],
        },
        {
          code: 'routine.empty-occurrence-qualifier',
          parameters: {},
          path: ['occurrences', 0, 'qualifiers', 2],
        },
      ],
      ok: false,
    });
  });

  it('keeps element, group, connection, and bonus values separate', () => {
    const evaluator: RoutineEvaluator = {
      ...creditAllEvaluator,
      id: 'test.all-components',
      evaluate: (context) => ({
        ...creditAllEvaluator.evaluate(context),
        awards: [
          {
            component: 'element-group',
            occurrenceIds: ['kip'],
            reason: 'requirement.group-credited',
            reasonParameters: { group: 1 },
            value: scoreTenths(5),
          },
          {
            component: 'connection',
            occurrenceIds: ['kip', 'dismount'],
            reason: 'connection.credited',
            reasonParameters: {},
            value: scoreTenths(1),
          },
          {
            component: 'bonus',
            occurrenceIds: ['dismount'],
            reason: 'landing.stick-bonus',
            reasonParameters: {},
            value: scoreTenths(1),
          },
        ],
      }),
    };
    const outcome = calculateDifficulty({
      elementLookup: indexScorableElements(ringsElements),
      evaluator,
      routine,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      throw new Error('Expected a successful calculation.');
    }
    expect(outcome.result.breakdown).toEqual({
      bonus: 1,
      connection: 1,
      elementDifficulty: 3,
      elementGroup: 5,
    });
    expect(outcome.result.total).toBe(10);
  });

  it('rejects an evaluator that fails to explain every occurrence', () => {
    const incompleteEvaluator: RoutineEvaluator = {
      apparatus: 'still-rings',
      id: 'test.incomplete',
      evaluate: () => ({ awards: [], elementDecisions: [], warnings: [] }),
    };

    expect(() =>
      calculateDifficulty({
        elementLookup: indexScorableElements(ringsElements),
        evaluator: incompleteEvaluator,
        routine,
      }),
    ).toThrow(EvaluationContractError);
  });
});
