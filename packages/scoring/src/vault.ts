import type { ElementId } from './apparatus';
import type { ExplanationCode, ExplanationParameters } from './calculation';
import type { ScorableElement, VaultRoutine } from './routine';
import { isScoreTenths, sumScoreTenths, type ScoreTenths } from './score-tenths';

export interface VaultDifficultyAward {
  readonly reason: ExplanationCode;
  readonly reasonParameters: ExplanationParameters;
  readonly value: ScoreTenths;
}

export interface VaultDifficultyWarning {
  readonly code: ExplanationCode;
  readonly parameters: ExplanationParameters;
}

export interface VaultEvaluationDraft {
  readonly awards: readonly VaultDifficultyAward[];
  readonly warnings: readonly VaultDifficultyWarning[];
}

export interface VaultEvaluationContext {
  readonly routine: VaultRoutine;
  readonly vault: ScorableElement;
}

export interface VaultEvaluator {
  readonly apparatus: 'vault';
  readonly id: ExplanationCode;
  evaluate(context: VaultEvaluationContext): VaultEvaluationDraft;
}

export interface VaultDifficultyResult {
  readonly apparatus: 'vault';
  readonly awards: readonly VaultDifficultyAward[];
  readonly bonus: ScoreTenths;
  readonly evaluatorId: ExplanationCode;
  readonly total: ScoreTenths;
  readonly vaultDifficulty: ScoreTenths;
  readonly vaultId: ElementId;
  readonly warnings: readonly VaultDifficultyWarning[];
}

export type VaultCalculationIssueCode = 'vault.apparatus-mismatch' | 'vault.element-not-found';

export interface VaultCalculationIssue {
  readonly code: VaultCalculationIssueCode;
  readonly parameters: ExplanationParameters;
  readonly path: readonly string[];
}

export type VaultDifficultyCalculationOutcome =
  | { readonly issues: readonly VaultCalculationIssue[]; readonly ok: false }
  | { readonly ok: true; readonly result: VaultDifficultyResult };

export interface CalculateVaultDifficultyInput {
  readonly elementLookup: ReadonlyMap<ElementId, ScorableElement>;
  readonly evaluator: VaultEvaluator;
  readonly routine: VaultRoutine;
}

export function calculateVaultDifficulty({
  elementLookup,
  evaluator,
  routine,
}: CalculateVaultDifficultyInput): VaultDifficultyCalculationOutcome {
  const vault = elementLookup.get(routine.vaultId);
  if (vault === undefined) {
    return {
      issues: [
        {
          code: 'vault.element-not-found',
          parameters: { vaultId: routine.vaultId },
          path: ['vaultId'],
        },
      ],
      ok: false,
    };
  }

  if (vault.apparatus !== 'vault') {
    return {
      issues: [
        {
          code: 'vault.apparatus-mismatch',
          parameters: { elementApparatus: vault.apparatus, vaultId: vault.id },
          path: ['vaultId'],
        },
      ],
      ok: false,
    };
  }

  const draft = evaluator.evaluate({ routine, vault });
  for (const award of draft.awards) {
    if (!isScoreTenths(award.value)) {
      throw new Error('Vault evaluator awards must use non-negative integer tenths.');
    }
  }

  const bonus = sumScoreTenths(draft.awards.map(({ value }) => value));
  return {
    ok: true,
    result: {
      apparatus: 'vault',
      awards: [...draft.awards],
      bonus,
      evaluatorId: evaluator.id,
      total: sumScoreTenths([vault.difficulty.tenths, bonus]),
      vaultDifficulty: vault.difficulty.tenths,
      vaultId: vault.id,
      warnings: [...draft.warnings],
    },
  };
}
