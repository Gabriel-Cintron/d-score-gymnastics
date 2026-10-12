import { describe, expect, it } from 'vitest';

import { clampDifficulty, difficultyAfterDrag, difficultyAtTrackOffset } from './difficulty-range';

describe('difficulty range slider math', () => {
  it('maps the track to integer tenths', () => {
    expect(difficultyAtTrackOffset(0, 440, 12, 56)).toBe(12);
    expect(difficultyAtTrackOffset(115, 440, 12, 56)).toBe(24);
    expect(difficultyAtTrackOffset(440, 440, 12, 56)).toBe(56);
  });

  it('snaps drag movement to 0.1 difficulty increments', () => {
    expect(difficultyAfterDrag(20, 15, 440, 12, 56)).toBe(22);
    expect(difficultyAfterDrag(20, -6, 440, 12, 56)).toBe(19);
  });

  it('clamps values at a selected boundary', () => {
    expect(clampDifficulty(37, 12, 32)).toBe(32);
    expect(clampDifficulty(8, 12, 56)).toBe(12);
  });
});
