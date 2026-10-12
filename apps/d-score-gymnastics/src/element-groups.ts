import type {
  DifficultyAward,
  DifficultyResult,
  ElementId,
  ScoreTenths,
} from '@d-score-gymnastics/scoring';
import type { CompiledElement } from '@d-score-gymnastics/rulesets';

const FULL_ELEMENT_GROUP_VALUE_TENTHS = 5;

export type ElementGroupStatus =
  | {
      readonly group: number;
      readonly status: 'missing' | 'pending';
    }
  | {
      readonly award: ScoreTenths;
      readonly difficultyLetter: string;
      readonly elementId: ElementId;
      readonly group: number;
      readonly status: 'full' | 'partial';
    };

export function summarizeElementGroups(
  groups: readonly number[],
  result: DifficultyResult | undefined,
  elementById: ReadonlyMap<ElementId, CompiledElement>,
  difficultyLetterByTenths: ReadonlyMap<number, string>,
  routineIsFull: boolean,
): readonly ElementGroupStatus[] {
  const awardByGroup = new Map<number, DifficultyAward>();
  for (const award of result?.awards ?? []) {
    if (award.component !== 'element-group') continue;
    const group = award.reasonParameters.group;
    if (typeof group !== 'number' || !groups.includes(group)) continue;
    const current = awardByGroup.get(group);
    if (current === undefined || award.value > current.value) awardByGroup.set(group, award);
  }

  return groups.map((group) => {
    const award = awardByGroup.get(group);
    const occurrenceId = award?.occurrenceIds[0];
    const decision = result?.elementDecisions.find(
      (candidate) => candidate.occurrenceId === occurrenceId,
    );
    const element = decision === undefined ? undefined : elementById.get(decision.elementId);
    if (award === undefined || element === undefined) {
      return { group, status: routineIsFull ? 'missing' : 'pending' };
    }

    const difficultyLetter =
      difficultyLetterByTenths.get(decision?.creditedDifficulty ?? element.difficulty.tenths) ??
      (element.difficulty.kind === 'letter' ? element.difficulty.letter : '?');
    return {
      award: award.value,
      difficultyLetter,
      elementId: element.id,
      group,
      status: award.value >= FULL_ELEMENT_GROUP_VALUE_TENTHS ? 'full' : 'partial',
    };
  });
}
