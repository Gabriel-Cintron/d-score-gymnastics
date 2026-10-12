import type { CompiledElement, CompiledPommelHorseRules } from '@d-score-gymnastics/rulesets';
import {
  figPommelSequenceComponentKind,
  isFigPommelSequenceComponent,
  previewFigPommelSequence,
} from '@d-score-gymnastics/rulesets';

export interface CompletedPommelFlop {
  readonly difficulty: number;
  readonly difficultyLetter: string;
  readonly name: string;
  readonly sequenceType: string;
}

export function pommelFlopCatalog(
  elements: readonly CompiledElement[],
): readonly CompiledElement[] {
  return elements.filter(isFigPommelSequenceComponent);
}

export function availablePommelFlopComponents(
  catalog: readonly CompiledElement[],
  draft: readonly CompiledElement[],
  rules: CompiledPommelHorseRules,
): readonly CompiledElement[] {
  if (draft.length >= 4) return [];
  return catalog.filter((candidate) =>
    canCompletePommelFlop([...draft, candidate], catalog, rules),
  );
}

export function completePommelFlop(
  draft: readonly CompiledElement[],
  rules: CompiledPommelHorseRules,
  difficultyLetterByTenths: ReadonlyMap<number, string>,
): CompletedPommelFlop | undefined {
  const preview = previewFigPommelSequence(draft, rules);
  if (preview === undefined) return undefined;
  const difficultyLetter = difficultyLetterByTenths.get(preview.difficulty) ?? '?';
  const componentKinds = draft.map(figPommelSequenceComponentKind);
  const name = componentKinds.includes('russian')
    ? 'Russian flop'
    : componentKinds.some(
          (kind) => kind === 'bertoncelj' || kind === 'davtyan' || kind === 'dsa' || kind === 'dsb',
        )
      ? 'Stöckli flop'
      : 'Circle flop';
  return {
    difficulty: preview.difficulty,
    difficultyLetter,
    name: `${difficultyLetter} ${name}`,
    sequenceType: preview.sequenceType,
  };
}

function canCompletePommelFlop(
  draft: readonly CompiledElement[],
  catalog: readonly CompiledElement[],
  rules: CompiledPommelHorseRules,
): boolean {
  if (previewFigPommelSequence(draft, rules) !== undefined) return true;
  if (draft.length >= 4) return false;
  return catalog.some((candidate) => canCompletePommelFlop([...draft, candidate], catalog, rules));
}
