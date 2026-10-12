import { scoreTenths } from '@d-score-gymnastics/scoring';
import type { CompiledElement, CompiledPommelHorseRules } from '@d-score-gymnastics/rulesets';
import { describe, expect, it } from 'vitest';

import {
  replaceRussianLocation,
  requiresRussianLocation,
  russianLocationLabel,
  selectedRussianLocation,
} from './russian-location';

const rules = {
  apparatus: 'pommel-horse',
  occurrenceQualifiers: {
    russianLocation: {
      options: ['russian-location-end', 'russian-location-between-pommels'],
      requiredTrait: 'russian-location-required',
    },
  },
  schemaVersion: 1,
  sequenceSeparatorTrait: 'separator',
  sequenceTypes: { combined: 'pommel-combined', flop: 'pommel-flop' },
  sources: [],
  specialLimits: [],
} satisfies CompiledPommelHorseRules;

describe('Russian location input', () => {
  it('recognizes elements that need a performed-location choice', () => {
    expect(requiresRussianLocation(element(['russian-location-required']), rules)).toBe(true);
    expect(requiresRussianLocation(element([]), rules)).toBe(false);
  });

  it('replaces only the location qualifier', () => {
    expect(
      replaceRussianLocation(
        ['another-qualifier', 'russian-location-end'],
        'russian-location-between-pommels',
        rules,
      ),
    ).toEqual(['another-qualifier', 'russian-location-between-pommels']);
  });

  it('reads and labels stored locations', () => {
    expect(selectedRussianLocation(['russian-location-end'], rules)).toBe('russian-location-end');
    expect(russianLocationLabel('russian-location-between-pommels')).toBe('Between the pommels');
  });
});

function element(traits: readonly string[]): CompiledElement {
  return {
    aliases: [],
    apparatus: 'pommel-horse',
    code: { group: 2, number: 1 },
    difficulty: { kind: 'letter', letter: 'B', tenths: scoreTenths(2) },
    families: [],
    id: 'ph:test-russian',
    name: 'Test Russian',
    roles: [],
    source: { documentId: 'test', page: 1 },
    traits,
  };
}
