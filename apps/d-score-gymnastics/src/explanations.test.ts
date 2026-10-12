import { describe, expect, it } from 'vitest';

import { explanationLabel } from './explanations';

describe('explanation labels', () => {
  it('distinguishes Pommel type limits from a missing separator', () => {
    expect(explanationLabel('fig.pommel-flop-limit')).toBe(
      'Only one flop sequence can receive value',
    );
    expect(explanationLabel('fig.pommel-combined-limit')).toBe(
      'Only one combined sequence can receive value',
    );
    expect(explanationLabel('fig.pommel-sequence-separator-required')).toBe(
      'There must be a circle between these Pommel sequences for credit',
    );
  });
});
