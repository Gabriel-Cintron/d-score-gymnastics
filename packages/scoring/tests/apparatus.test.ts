import { describe, expect, it } from 'vitest';

import { APPARATUS_CODE_BY_ID, APPARATUS_IDS, isApparatusId } from '../src/index';

describe('apparatus identifiers', () => {
  it('defines every MAG apparatus in competition order', () => {
    expect(APPARATUS_IDS).toEqual([
      'floor-exercise',
      'pommel-horse',
      'still-rings',
      'vault',
      'parallel-bars',
      'horizontal-bar',
    ]);
  });

  it('maps stable element ID prefixes and rejects unknown identifiers', () => {
    expect(APPARATUS_CODE_BY_ID['parallel-bars']).toBe('pb');
    expect(isApparatusId('still-rings')).toBe(true);
    expect(isApparatusId('rings')).toBe(false);
  });
});
