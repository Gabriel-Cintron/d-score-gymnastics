import {
  scoreTenths,
  type DifficultyAward,
  type DifficultyResult,
  type ElementDecision,
  type ElementId,
} from '@d-score-gymnastics/scoring';
import type { CompiledElement } from '@d-score-gymnastics/rulesets';
import { describe, expect, it } from 'vitest';

import { summarizeElementGroups } from './element-groups';

const elements = [
  element('fx:group-one-c', 1, 'C', 3),
  element('fx:group-two-c', 2, 'C', 3),
  element('fx:group-four-d', 4, 'D', 4),
] as const;
const elementById: ReadonlyMap<ElementId, CompiledElement> = new Map(
  elements.map((catalogElement) => [catalogElement.id, catalogElement]),
);
const difficultyLetters = new Map([
  [3, 'C'],
  [4, 'D'],
]);

describe('element group summaries', () => {
  it('distinguishes full, partial, and missing group credit', () => {
    const result = difficultyResult(
      [
        decision('group-one', elements[0], 3),
        decision('group-two', elements[1], 3),
        decision('group-four', elements[2], 4),
      ],
      [award(1, 'group-one', 5), award(2, 'group-two', 3), award(4, 'group-four', 4)],
    );

    expect(
      summarizeElementGroups([1, 2, 3, 4], result, elementById, difficultyLetters, true),
    ).toEqual([
      {
        award: 5,
        difficultyLetter: 'C',
        elementId: 'fx:group-one-c',
        group: 1,
        status: 'full',
      },
      {
        award: 3,
        difficultyLetter: 'C',
        elementId: 'fx:group-two-c',
        group: 2,
        status: 'partial',
      },
      { group: 3, status: 'missing' },
      {
        award: 4,
        difficultyLetter: 'D',
        elementId: 'fx:group-four-d',
        group: 4,
        status: 'partial',
      },
    ]);
  });

  it('keeps uncredited groups pending while the routine has open slots', () => {
    expect(
      summarizeElementGroups([1, 2, 3, 4], undefined, elementById, difficultyLetters, false),
    ).toEqual([
      { group: 1, status: 'pending' },
      { group: 2, status: 'pending' },
      { group: 3, status: 'pending' },
      { group: 4, status: 'pending' },
    ]);
  });

  it('marks uncredited groups as missing once the routine is full', () => {
    expect(
      summarizeElementGroups([1, 2, 3, 4], undefined, elementById, difficultyLetters, true),
    ).toEqual([
      { group: 1, status: 'missing' },
      { group: 2, status: 'missing' },
      { group: 3, status: 'missing' },
      { group: 4, status: 'missing' },
    ]);
  });
});

function element(
  id: ElementId,
  group: number,
  letter: string,
  difficulty: number,
): CompiledElement {
  return {
    aliases: [],
    apparatus: 'floor-exercise',
    code: { group, number: group },
    difficulty: { kind: 'letter', letter, tenths: scoreTenths(difficulty) },
    families: [],
    id,
    name: id,
    roles: [],
    source: { documentId: 'test-code', page: 1 },
    traits: [],
  };
}

function decision(
  occurrenceId: string,
  catalogElement: CompiledElement,
  difficulty: number,
): ElementDecision {
  return {
    creditedDifficulty: scoreTenths(difficulty),
    elementId: catalogElement.id,
    occurrenceId,
    reason: 'fig.element-counted',
    reasonParameters: { slot: 'regular' },
    status: 'counted',
  };
}

function award(group: number, occurrenceId: string, value: number): DifficultyAward {
  return {
    component: 'element-group',
    occurrenceIds: [occurrenceId],
    reason: 'fig.element-group-awarded',
    reasonParameters: { group },
    value: scoreTenths(value),
  };
}

function difficultyResult(
  elementDecisions: readonly ElementDecision[],
  awards: readonly DifficultyAward[],
): DifficultyResult {
  return {
    apparatus: 'floor-exercise',
    awards,
    breakdown: {
      bonus: scoreTenths(0),
      connection: scoreTenths(0),
      elementDifficulty: scoreTenths(10),
      elementGroup: scoreTenths(12),
    },
    elementDecisions,
    evaluatorId: 'fig-2025-2028.element-counting',
    total: scoreTenths(22),
    warnings: [],
  };
}
