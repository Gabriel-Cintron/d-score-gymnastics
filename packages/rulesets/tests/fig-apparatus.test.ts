import { fileURLToPath } from 'node:url';

import {
  calculateDifficulty,
  calculateVaultDifficulty,
  indexScorableElements,
  scoreTenthsToPoints,
  type DifficultyResult,
  type ElementRoutine,
  type VaultRoutine,
} from '@d-score-gymnastics/scoring';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  compileRuleset,
  createFigElementCountingEvaluator,
  createFigVaultEvaluator,
  isFigConnectionEligible,
  isFigPommelSequenceComponent,
  previewFigPommelSequence,
  type CompiledRuleset,
} from '../src/index';
import { loadRulesets } from '../scripts/lib/load-rulesets';

const dataDirectory = fileURLToPath(new URL('../data/', import.meta.url));

let compiled: CompiledRuleset;

beforeAll(async () => {
  const loaded = await loadRulesets(dataDirectory);
  if (loaded.issues.length > 0 || loaded.sources[0] === undefined) {
    throw new Error('Expected valid FIG rules data.');
  }
  compiled = compileRuleset(loaded.sources[0]);
});

describe('FIG apparatus policies', () => {
  it('reports only scorer-eligible direct connection pairs', () => {
    const rules = compiled.apparatusRules['floor-exercise'];
    if (rules.apparatus !== 'floor-exercise') throw new Error('Expected Floor rules.');
    const frontD = catalogElement('fx:mag-0051');
    const frontB = catalogElement('fx:mag-0054');
    const balance = catalogElement('fx:mag-0024');

    expect(isFigConnectionEligible(frontD, frontB, rules)).toBe(true);
    expect(isFigConnectionEligible(frontD, balance, rules)).toBe(false);
  });

  it('previews complete Pommel sequences from their atomic components', () => {
    const rules = compiled.apparatusRules['pommel-horse'];
    if (rules.apparatus !== 'pommel-horse') throw new Error('Expected Pommel rules.');
    const dsb = catalogElement('ph:mag-0033');
    const dsa = catalogElement('ph:mag-0031');
    const dismount = catalogElement('ph:mag-0100');

    expect(isFigPommelSequenceComponent(dsb)).toBe(true);
    expect(isFigPommelSequenceComponent(dismount)).toBe(false);
    expect(previewFigPommelSequence([dsb, dsb, dsa], rules)).toEqual({
      difficulty: 4,
      sequenceType: rules.sequenceTypes.flop,
    });
    expect(previewFigPommelSequence([dsb, dsa], rules)).toBeUndefined();
  });

  it('applies Floor special repetition, connections, dismount reservation, and stick bonus', () => {
    const result = calculate({
      apparatus: 'floor-exercise',
      landing: { occurrenceId: 'dismount', outcome: 'stuck' },
      occurrences: [
        { occurrenceId: 'low-strength', elementId: 'fx:mag-0003' },
        {
          occurrenceId: 'high-strength',
          elementId: 'fx:mag-0007',
        },
        { occurrenceId: 'balance', elementId: 'fx:mag-0024' },
        { occurrenceId: 'front-d', elementId: 'fx:mag-0051' },
        { occurrenceId: 'front-b', elementId: 'fx:mag-0054' },
        { occurrenceId: 'dismount', elementId: 'fx:mag-0056' },
      ],
      relationships: [
        {
          connectionId: 'front-connection',
          kind: 'connection',
          occurrenceIds: ['front-d', 'front-b'],
        },
        {
          connectionId: 'duplicate-front-connection',
          kind: 'connection',
          occurrenceIds: ['front-d', 'front-b'],
        },
      ],
    });

    expect(decision(result, 'low-strength')).toMatchObject({
      reason: 'fig.special-repetition-limit',
      status: 'excluded',
    });
    expect(result.awards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ component: 'connection', value: 1 }),
        expect.objectContaining({ component: 'bonus', value: 1 }),
      ]),
    );
    expect(result.awards.filter(({ component }) => component === 'connection')).toHaveLength(1);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'fig.relationship-not-creditable',
        parameters: { reason: 'duplicate-connection' },
      }),
    );
    expect(result.warnings.map(({ code }) => code)).not.toContain(
      'fig.floor-missing-balance-or-leap',
    );
  });

  it('credits a three-part Pommel Horse flop as one D element', () => {
    const result = calculate({
      apparatus: 'pommel-horse',
      occurrences: [
        { occurrenceId: 'dsb-one', elementId: 'ph:mag-0033' },
        { occurrenceId: 'dsb-two', elementId: 'ph:mag-0033' },
        {
          occurrenceId: 'dsa',
          elementId: 'ph:mag-0031',
        },
        {
          occurrenceId: 'dismount',
          elementId: 'ph:mag-0100',
        },
      ],
      relationships: [
        {
          kind: 'sequence',
          occurrenceIds: ['dsb-one', 'dsb-two', 'dsa'],
          sequenceId: 'flop-one',
          sequenceType: 'pommel-flop',
        },
      ],
    });

    expect(decision(result, 'dsb-one')).toMatchObject({
      creditedDifficulty: 4,
      reason: 'fig.pommel-sequence-counted',
      status: 'counted',
    });
    expect(decision(result, 'dsb-two')).toMatchObject({
      reason: 'fig.pommel-sequence-component',
      status: 'excluded',
    });
    expect(decision(result, 'dsa')).toMatchObject({
      reason: 'fig.pommel-sequence-component',
      status: 'excluded',
    });
  });

  it('requires a counted B swing to separate Rings strength sequences', () => {
    const result = calculate({
      apparatus: 'still-rings',
      occurrences: [
        { occurrenceId: 'strength-one', elementId: 'sr:mag-0037' },
        { occurrenceId: 'strength-two', elementId: 'sr:mag-0033' },
        { occurrenceId: 'strength-three', elementId: 'sr:mag-0031' },
        { occurrenceId: 'separator', elementId: 'sr:mag-0010' },
        {
          occurrenceId: 'strength-four',
          elementId: 'sr:mag-0082',
        },
        {
          occurrenceId: 'dismount',
          elementId: 'sr:mag-0134',
        },
      ],
    });

    expect(decision(result, 'separator').status).toBe('counted');
    expect(decision(result, 'strength-four').status).toBe('counted');
  });

  it('applies the Rings direct swing-to-handstand upgrade to element difficulty', () => {
    const result = calculate({
      apparatus: 'still-rings',
      occurrences: [
        {
          occurrenceId: 'jonasson',
          elementId: 'sr:mag-0016',
        },
        {
          occurrenceId: 'handstand',
          elementId: 'sr:mag-0024',
        },
        {
          occurrenceId: 'dismount',
          elementId: 'sr:mag-0134',
        },
      ],
      relationships: [
        {
          connectionId: 'rings-upgrade',
          kind: 'connection',
          occurrenceIds: ['jonasson', 'handstand'],
        },
      ],
    });

    expect(decision(result, 'jonasson')).toMatchObject({
      creditedDifficulty: 4,
      reason: 'fig.rings-direct-upgrade',
    });
    expect(result.breakdown.connection).toBe(0);
    expect(result.awards.find(({ reason }) => reason === 'fig.dismount-group-awarded')?.value).toBe(
      5,
    );
  });

  it('applies both one-rail and Healy upgrades to element difficulty', () => {
    const result = calculate({
      apparatus: 'parallel-bars',
      occurrences: [
        {
          occurrenceId: 'one-rail',
          elementId: 'pb:mag-0051',
        },
        {
          occurrenceId: 'healy',
          elementId: 'pb:mag-0066',
        },
        { occurrenceId: 'dismount', elementId: 'pb:mag-0160' },
      ],
      relationships: [
        {
          connectionId: 'healy-upgrade',
          kind: 'connection',
          occurrenceIds: ['one-rail', 'healy'],
        },
      ],
    });

    expect(decision(result, 'one-rail')).toMatchObject({
      creditedDifficulty: 4,
      reason: 'fig.parallel-bars-healy-upgrade',
    });
    expect(decision(result, 'healy')).toMatchObject({
      creditedDifficulty: 4,
      reason: 'fig.parallel-bars-healy-upgrade',
    });
    expect(result.breakdown.connection).toBe(0);
    expect(result.awards.find(({ reason }) => reason === 'fig.element-group-awarded')?.value).toBe(
      5,
    );
  });

  it('protects the final Floor dismount and includes it in the four-per-group cap', () => {
    const result = calculate({
      apparatus: 'floor-exercise',
      occurrences: [
        { occurrenceId: 'early-dismount', elementId: 'fx:mag-0056' },
        { occurrenceId: 'handspring', elementId: 'fx:mag-0050' },
        { occurrenceId: 'front-d', elementId: 'fx:mag-0051' },
        { occurrenceId: 'dive-roll', elementId: 'fx:mag-0052' },
        { occurrenceId: 'front-half', elementId: 'fx:mag-0054' },
        { occurrenceId: 'dismount', elementId: 'fx:mag-0056' },
      ],
    });

    expect(decision(result, 'early-dismount')).toMatchObject({
      reason: 'fig.element-repeated',
      status: 'excluded',
    });
    expect(decision(result, 'dismount')).toMatchObject({
      reason: 'fig.dismount-counted',
      status: 'counted',
    });
    expect(
      result.elementDecisions.filter(
        ({ elementId, status }) => elementId.startsWith('fx:') && status === 'counted',
      ),
    ).toHaveLength(4);
    expect(decision(result, 'dive-roll').reason).toBe('fig.element-group-limit');
  });

  it('rejects Floor counter-salto and two-single-twisting connection claims', () => {
    const result = calculate({
      apparatus: 'floor-exercise',
      occurrences: [
        { occurrenceId: 'front', elementId: 'fx:mag-0051' },
        { occurrenceId: 'back', elementId: 'fx:mag-0074' },
        { occurrenceId: 'twist-one', elementId: 'fx:mag-0091' },
        { occurrenceId: 'twist-two', elementId: 'fx:mag-0096' },
      ],
      relationships: [
        {
          connectionId: 'counter',
          kind: 'connection',
          occurrenceIds: ['front', 'back'],
        },
        {
          connectionId: 'single-twists',
          kind: 'connection',
          occurrenceIds: ['twist-one', 'twist-two'],
        },
      ],
    });

    expect(result.awards.filter(({ component }) => component === 'connection')).toEqual([]);
    expect(
      result.warnings.filter(
        ({ code, parameters }) =>
          code === 'fig.relationship-not-creditable' && parameters.reason === 'ineligible-elements',
      ),
    ).toHaveLength(2);
  });

  it('credits the minimum D value for a Russian plus one-flop Pommel combination', () => {
    const result = calculate({
      apparatus: 'pommel-horse',
      occurrences: [
        {
          occurrenceId: 'russian',
          elementId: 'ph:mag-0058',
        },
        { occurrenceId: 'dsb', elementId: 'ph:mag-0033' },
        {
          occurrenceId: 'dismount',
          elementId: 'ph:mag-0100',
        },
      ],
      relationships: [
        {
          kind: 'sequence',
          occurrenceIds: ['russian', 'dsb'],
          sequenceId: 'combined-one',
          sequenceType: 'pommel-combined',
        },
      ],
    });

    expect(decision(result, 'russian')).toMatchObject({
      creditedDifficulty: 4,
      reason: 'fig.pommel-sequence-counted',
      status: 'counted',
    });
    expect(decision(result, 'dsb').reason).toBe('fig.pommel-sequence-component');
  });

  it('warns about the omitted circle while crediting valid counted-skill sequence claims', () => {
    const result = calculate({
      apparatus: 'pommel-horse',
      occurrences: [
        { occurrenceId: 'flop-dsb-one', elementId: 'ph:mag-0033' },
        { occurrenceId: 'flop-dsb-two', elementId: 'ph:mag-0033' },
        {
          occurrenceId: 'flop-dsa',
          elementId: 'ph:mag-0031',
        },
        {
          occurrenceId: 'combined-russian',
          elementId: 'ph:mag-0058',
        },
        { occurrenceId: 'combined-dsb', elementId: 'ph:mag-0033' },
      ],
      relationships: [
        {
          kind: 'sequence',
          occurrenceIds: ['flop-dsb-one', 'flop-dsb-two', 'flop-dsa'],
          sequenceId: 'flop-one',
          sequenceType: 'pommel-flop',
        },
        {
          kind: 'sequence',
          occurrenceIds: ['combined-russian', 'combined-dsb'],
          sequenceId: 'combined-one',
          sequenceType: 'pommel-combined',
        },
      ],
    });

    expect(decision(result, 'combined-russian')).toMatchObject({
      reason: 'fig.pommel-sequence-counted',
      status: 'counted',
    });
    expect(result.warnings).toContainEqual({
      code: 'fig.pommel-sequence-separator-required',
      occurrenceIds: ['combined-russian', 'combined-dsb'],
      parameters: {},
    });
  });

  it('limits a second flop and warns about the omitted circle between the claims', () => {
    const result = calculate({
      apparatus: 'pommel-horse',
      occurrences: [
        { occurrenceId: 'first-dsb-one', elementId: 'ph:mag-0033' },
        { occurrenceId: 'first-dsb-two', elementId: 'ph:mag-0033' },
        {
          occurrenceId: 'first-dsa',
          elementId: 'ph:mag-0031',
        },
        { occurrenceId: 'second-dsb-one', elementId: 'ph:mag-0033' },
        { occurrenceId: 'second-dsb-two', elementId: 'ph:mag-0033' },
        {
          occurrenceId: 'second-dsa',
          elementId: 'ph:mag-0031',
        },
      ],
      relationships: [
        {
          kind: 'sequence',
          occurrenceIds: ['first-dsb-one', 'first-dsb-two', 'first-dsa'],
          sequenceId: 'first-flop',
          sequenceType: 'pommel-flop',
        },
        {
          kind: 'sequence',
          occurrenceIds: ['second-dsb-one', 'second-dsb-two', 'second-dsa'],
          sequenceId: 'second-flop',
          sequenceType: 'pommel-flop',
        },
      ],
    });

    expect(decision(result, 'second-dsb-one')).toMatchObject({
      reason: 'fig.pommel-flop-limit',
      reasonParameters: { maximum: 1 },
      status: 'excluded',
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'fig.pommel-flop-limit' }),
        expect.objectContaining({ code: 'fig.pommel-sequence-separator-required' }),
      ]),
    );
  });

  it('requires the performed Russian location and applies its repetition limit', () => {
    const result = calculate({
      apparatus: 'pommel-horse',
      occurrences: [
        {
          occurrenceId: 'end-e',
          elementId: 'ph:mag-0061',
          qualifiers: ['russian-location-end'],
        },
        {
          occurrenceId: 'end-d',
          elementId: 'ph:mag-0060',
          qualifiers: ['russian-location-end'],
        },
        {
          occurrenceId: 'unqualified',
          elementId: 'ph:mag-0059',
        },
      ],
    });

    expect(decision(result, 'end-e').status).toBe('counted');
    expect(decision(result, 'end-d')).toMatchObject({
      reason: 'fig.special-repetition-limit',
      status: 'excluded',
    });
    expect(decision(result, 'unqualified')).toMatchObject({
      reason: 'fig.pommel-occurrence-qualifier-required',
      status: 'excluded',
    });
  });

  it('selects only one Rings strength element per final position and group', () => {
    const result = calculate({
      apparatus: 'still-rings',
      occurrences: [
        { occurrenceId: 'cross-c', elementId: 'sr:mag-0037' },
        {
          occurrenceId: 'cross-e',
          elementId: 'sr:mag-0040',
        },
      ],
    });

    expect(decision(result, 'cross-c')).toMatchObject({
      reason: 'fig.rings-final-position-limit',
      status: 'excluded',
    });
    expect(decision(result, 'cross-e').status).toBe('counted');
  });

  it('counts a fifth Horizontal Bar flight only when the C+C pair is selected', () => {
    const qualifying = calculate({
      apparatus: 'horizontal-bar',
      occurrences: [
        {
          occurrenceId: 'tkatchev-c',
          elementId: 'hb:mag-0034',
        },
        {
          occurrenceId: 'jaeger-c',
          elementId: 'hb:mag-0045',
        },
        {
          occurrenceId: 'gienger-d',
          elementId: 'hb:mag-0053',
        },
        {
          occurrenceId: 'forward-e',
          elementId: 'hb:mag-0055',
        },
        {
          occurrenceId: 'markelov-g',
          elementId: 'hb:mag-0032',
        },
      ],
      relationships: [
        {
          connectionId: 'qualifying-pair',
          kind: 'connection',
          occurrenceIds: ['tkatchev-c', 'jaeger-c'],
        },
      ],
    });
    expect(qualifying.elementDecisions.filter(({ status }) => status === 'counted')).toHaveLength(
      5,
    );

    const displaced = calculate({
      apparatus: 'horizontal-bar',
      occurrences: [
        ...qualifying.elementDecisions.map(({ elementId, occurrenceId }) => ({
          elementId,
          occurrenceId,
        })),
        {
          occurrenceId: 'nonflight-one',
          elementId: 'hb:mag-0021',
        },
        { occurrenceId: 'nonflight-two', elementId: 'hb:mag-0026' },
        {
          occurrenceId: 'nonflight-three',
          elementId: 'hb:mag-0029',
        },
      ],
      relationships: [
        {
          connectionId: 'qualifying-pair',
          kind: 'connection',
          occurrenceIds: ['tkatchev-c', 'jaeger-c'],
        },
      ],
    });
    expect(
      displaced.elementDecisions.filter(
        ({ elementId, status }) =>
          compiled.elements.find(({ id }) => id === elementId)?.traits.includes('flight') ===
            true && status === 'counted',
      ),
    ).toHaveLength(4);
  });

  it('applies Parallel Bars and Vault special eligibility rules', () => {
    const parallelBars = calculate({
      apparatus: 'parallel-bars',
      occurrences: [
        { occurrenceId: 'morisue-e', elementId: 'pb:mag-0055' },
        {
          occurrenceId: 'morisue-f',
          elementId: 'pb:mag-0056',
        },
      ],
    });
    expect(decision(parallelBars, 'morisue-e')).toMatchObject({
      reason: 'fig.special-repetition-limit',
      status: 'excluded',
    });
    expect(decision(parallelBars, 'morisue-f').status).toBe('counted');

    const vaultOutcome = calculateVaultDifficulty({
      elementLookup: indexScorableElements(compiled.elements),
      evaluator: createFigVaultEvaluator(compiled.sharedRules),
      routine: { apparatus: 'vault', landing: 'stuck', vaultId: 'vt:mag-0024' },
    });
    expect(vaultOutcome.ok).toBe(true);
    if (!vaultOutcome.ok) throw new Error('Expected a Vault result.');
    expect(vaultOutcome.result.bonus).toBe(0);
    expect(vaultOutcome.result.warnings).toContainEqual(
      expect.objectContaining({ code: 'fig.vault-stick-ineligible' }),
    );
  });

  it('applies Horizontal Bar connection values and two-per-flight-family limits', () => {
    const result = calculate({
      apparatus: 'horizontal-bar',
      occurrences: [
        {
          occurrenceId: 'tkatchev-c',
          elementId: 'hb:mag-0034',
        },
        {
          occurrenceId: 'tkatchev-d',
          elementId: 'hb:mag-0035',
        },
        { occurrenceId: 'tkatchev-g', elementId: 'hb:mag-0036' },
        { occurrenceId: 'kovacs-d', elementId: 'hb:mag-0062' },
        { occurrenceId: 'kovacs-e', elementId: 'hb:mag-0063' },
        {
          occurrenceId: 'dismount',
          elementId: 'hb:mag-0118',
        },
      ],
      relationships: [
        {
          connectionId: 'flight-connection',
          kind: 'connection',
          occurrenceIds: ['tkatchev-g', 'kovacs-d'],
        },
      ],
    });

    expect(decision(result, 'tkatchev-c')).toMatchObject({
      reason: 'fig.special-repetition-limit',
      status: 'excluded',
    });
    expect(result.awards).toContainEqual(
      expect.objectContaining({ component: 'connection', value: 2 }),
    );
  });

  it('scores Vault separately and awards stick bonus only to an eligible salto vault', () => {
    const routine: VaultRoutine = {
      apparatus: 'vault',
      landing: 'stuck',
      vaultId: 'vt:mag-0041',
    };
    const outcome = calculateVaultDifficulty({
      elementLookup: indexScorableElements(compiled.elements),
      evaluator: createFigVaultEvaluator(compiled.sharedRules),
      routine,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('Expected a Vault result.');
    expect(scoreTenthsToPoints(outcome.result.total)).toBe(1.9);
    expect(outcome.result.awards).toContainEqual(
      expect.objectContaining({ reason: 'fig.stick-bonus-awarded', value: 1 }),
    );
  });
});

function calculate(routine: ElementRoutine): DifficultyResult {
  const evaluator = createFigElementCountingEvaluator(
    compiled.sharedRules,
    routine.apparatus,
    compiled.apparatusRules[routine.apparatus],
  );
  const outcome = calculateDifficulty({
    elementLookup: indexScorableElements(compiled.elements),
    evaluator,
    routine,
  });
  if (!outcome.ok) throw new Error(`Calculation failed: ${JSON.stringify(outcome.issues)}`);
  return outcome.result;
}

function decision(result: DifficultyResult, occurrenceId: string) {
  const value = result.elementDecisions.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (value === undefined) throw new Error(`Missing decision for ${occurrenceId}.`);
  return value;
}

function catalogElement(elementId: (typeof compiled.elements)[number]['id']) {
  const element = compiled.elements.find(({ id }) => id === elementId);
  if (element === undefined) throw new Error(`Missing test element ${elementId}.`);
  return element;
}
