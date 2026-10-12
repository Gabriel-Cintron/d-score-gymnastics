import type { CompiledElement } from '@d-score-gymnastics/rulesets';
import { scoreTenthsToPoints, type ScoreTenths } from '@d-score-gymnastics/scoring';

import { APPARATUS_SHORT_LABELS } from './apparatus';

export function formatDifficulty(element: CompiledElement): string {
  return element.difficulty.kind === 'letter'
    ? element.difficulty.letter
    : formatScore(element.difficulty.tenths);
}

export function formatScore(score: ScoreTenths): string {
  return scoreTenthsToPoints(score).toFixed(1);
}

export function formatOfficialCode(element: CompiledElement): string {
  return `${APPARATUS_SHORT_LABELS[element.apparatus]} ${romanNumeral(element.code.group)}.${String(element.code.number)}`;
}

function romanNumeral(value: number): string {
  return ['I', 'II', 'III', 'IV', 'V'][value - 1] ?? String(value);
}
