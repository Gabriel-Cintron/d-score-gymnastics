import { describe, expect, it } from 'vitest';

import {
  calculateVaultDifficulty,
  indexScorableElements,
  scoreTenths,
  type ScorableElement,
  type VaultEvaluator,
} from '../src/index';

const vault: ScorableElement = {
  apparatus: 'vault',
  code: { group: 3, number: 307 },
  difficulty: { tenths: scoreTenths(18) },
  families: [],
  id: 'vt:mag-0041',
  roles: [],
  traits: ['salto-vault'],
};

const evaluator: VaultEvaluator = {
  apparatus: 'vault',
  id: 'test.vault',
  evaluate: ({ routine }) => ({
    awards:
      routine.landing === 'stuck'
        ? [
            {
              reason: 'test.stick-bonus',
              reasonParameters: {},
              value: scoreTenths(1),
            },
          ]
        : [],
    warnings: [],
  }),
};

describe('vault difficulty calculation', () => {
  it('keeps the listed vault value and bonus separate', () => {
    const outcome = calculateVaultDifficulty({
      elementLookup: indexScorableElements([vault]),
      evaluator,
      routine: {
        apparatus: 'vault',
        landing: 'stuck',
        vaultId: vault.id,
      },
    });

    expect(outcome).toEqual({
      ok: true,
      result: {
        apparatus: 'vault',
        awards: [
          {
            reason: 'test.stick-bonus',
            reasonParameters: {},
            value: 1,
          },
        ],
        bonus: 1,
        evaluatorId: 'test.vault',
        total: 19,
        vaultDifficulty: 18,
        vaultId: 'vt:mag-0041',
        warnings: [],
      },
    });
  });
});
