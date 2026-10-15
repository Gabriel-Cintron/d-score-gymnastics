import {
  APPARATUS_IDS,
  calculateDifficulty,
  calculateVaultDifficulty,
  indexScorableElements,
  scoreTenths,
  type ApparatusId,
  type ElementId,
  type DifficultyCalculationOutcome,
  type ElementRoutine,
  type ElementRoutineApparatusId,
  type VaultDifficultyCalculationOutcome,
  type VaultRoutine,
} from '@d-score-gymnastics/scoring';

import type { CompiledElement, CompiledRuleset } from './compile';
import { createFigElementCountingEvaluator } from './fig/element-counting';
import { createFigVaultEvaluator } from './fig/vault';

export interface FigRulesetRuntime {
  readonly ruleset: CompiledRuleset;
  elementsForApparatus(apparatus: ApparatusId): readonly CompiledElement[];
  scoreRoutine(routine: ElementRoutine): DifficultyCalculationOutcome;
  scoreVault(routine: VaultRoutine): VaultDifficultyCalculationOutcome;
}

/**
 * Creates the application-facing interface for one compiled FIG ruleset.
 * UI code does not need to know how element lookups or apparatus evaluators are assembled.
 */
export function createFigRulesetRuntime(
  ruleset: CompiledRuleset,
  excludedElementIds: ReadonlySet<ElementId> = new Set(),
): FigRulesetRuntime {
  if (ruleset.discipline !== 'mens-artistic-gymnastics') {
    throw new Error(`Cannot create a MAG runtime for discipline "${ruleset.discipline}".`);
  }

  const elementLookup = indexScorableElements(ruleset.elements);
  const elementsByApparatus = {} as Record<ApparatusId, readonly CompiledElement[]>;
  for (const apparatus of APPARATUS_IDS) {
    elementsByApparatus[apparatus] = ruleset.elements.filter(
      (element) => element.apparatus === apparatus,
    );
  }

  const evaluatorByApparatus = {} as Record<
    ElementRoutineApparatusId,
    ReturnType<typeof createFigElementCountingEvaluator>
  >;
  for (const apparatus of APPARATUS_IDS) {
    if (apparatus === 'vault') continue;
    evaluatorByApparatus[apparatus] = createFigElementCountingEvaluator(
      ruleset.sharedRules,
      apparatus,
      ruleset.apparatusRules[apparatus],
      excludedElementIds,
    );
  }

  const vaultBase = createFigVaultEvaluator(ruleset.sharedRules);
  const vaultEvaluator = {
    ...vaultBase,
    evaluate: (context: Parameters<typeof vaultBase.evaluate>[0]) =>
      excludedElementIds.has(context.vault.id)
        ? {
            awards: [],
            warnings: [
              {
                code: 'profile.element-not-eligible' as const,
                parameters: { elementId: context.vault.id },
              },
            ],
          }
        : vaultBase.evaluate(context),
  };

  return {
    ruleset,
    elementsForApparatus: (apparatus) => elementsByApparatus[apparatus],
    scoreRoutine: (routine) =>
      calculateDifficulty({
        elementLookup,
        evaluator: evaluatorByApparatus[routine.apparatus],
        routine,
      }),
    scoreVault: (routine) => {
      const vault = elementLookup.get(routine.vaultId);
      const lookup =
        excludedElementIds.has(routine.vaultId) && vault
          ? new Map(elementLookup).set(routine.vaultId, {
              ...vault,
              difficulty: { ...vault.difficulty, tenths: scoreTenths(0) },
            })
          : elementLookup;
      return calculateVaultDifficulty({
        elementLookup: lookup,
        evaluator: vaultEvaluator,
        routine,
      });
    },
  };
}
