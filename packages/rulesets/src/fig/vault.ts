import { type VaultEvaluator } from '@d-score-gymnastics/scoring';

import type { CompiledSharedRules } from '../compile';

export const FIG_VAULT_EVALUATOR_ID = 'fig-2025-2028.vault' as const;

export function createFigVaultEvaluator(sharedRules: CompiledSharedRules): VaultEvaluator {
  return {
    apparatus: 'vault',
    id: FIG_VAULT_EVALUATOR_ID,
    evaluate: ({ routine, vault }) => {
      if (routine.landing !== 'stuck') return { awards: [], warnings: [] };

      const eligible =
        sharedRules.landingBonus.apparatus.includes('vault') &&
        vault.difficulty.tenths >= sharedRules.landingBonus.minimumDifficulty &&
        vault.traits.includes(sharedRules.landingBonus.vaultRequiredTrait);
      if (!eligible) {
        return {
          awards: [],
          warnings: [
            {
              code: 'fig.vault-stick-ineligible',
              parameters: { vaultId: vault.id },
            },
          ],
        };
      }

      return {
        awards: [
          {
            reason: 'fig.stick-bonus-awarded',
            reasonParameters: {},
            value: sharedRules.landingBonus.value,
          },
        ],
        warnings: [],
      };
    },
  };
}
