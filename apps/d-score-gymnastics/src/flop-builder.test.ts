import type { ElementId } from '@d-score-gymnastics/scoring';
import { describe, expect, it } from 'vitest';

import {
  availablePommelFlopComponents,
  completePommelFlop,
  pommelFlopCatalog,
} from './flop-builder';
import { figRuleset, figRuntime } from './ruleset';

const rules = figRuleset.apparatusRules['pommel-horse'];
if (rules.apparatus !== 'pommel-horse') throw new Error('Expected Pommel rules.');
const catalog = pommelFlopCatalog(figRuntime.elementsForApparatus('pommel-horse'));
const difficultyLetters = new Map(
  Object.entries(figRuleset.difficultyScale).map(([letter, difficulty]) => [difficulty, letter]),
);

describe('Pommel flop builder', () => {
  it('shows only components that can still produce a valid sequence', () => {
    const dsa = component('ph:mag-0031');

    const afterDsa = availablePommelFlopComponents(catalog, [dsa], rules);

    expect(afterDsa).toHaveLength(0);
    expect(catalog).toHaveLength(9);
  });

  it('allows repeated components required by a valid Stöckli flop', () => {
    const dsb = component('ph:mag-0033');
    const dsa = component('ph:mag-0031');

    expect(availablePommelFlopComponents(catalog, [dsb], rules)).toContain(dsb);
    expect(completePommelFlop([dsb, dsb, dsa], rules, difficultyLetters)).toEqual({
      difficulty: 4,
      difficultyLetter: 'D',
      name: 'D Stöckli flop',
      sequenceType: rules.sequenceTypes.flop,
    });
  });

  it('names a combined sequence from its Russian component', () => {
    const russian = component('ph:mag-0058');
    const dsb = component('ph:mag-0033');

    expect(completePommelFlop([russian, dsb], rules, difficultyLetters)).toMatchObject({
      difficultyLetter: 'D',
      name: 'D Russian flop',
      sequenceType: rules.sequenceTypes.combined,
    });
  });
});

function component(elementId: ElementId) {
  const element = catalog.find(({ id }) => id === elementId);
  if (element === undefined) throw new Error(`Missing test component ${elementId}.`);
  return element;
}
