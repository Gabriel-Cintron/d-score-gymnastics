import { describe, expect, it } from 'vitest';

import {
  scoreTenths,
  scoreTenthsFromPoints,
  scoreTenthsToPoints,
  sumScoreTenths,
} from '../src/index';

describe('integer score tenths', () => {
  it('converts readable points without floating-point accumulation', () => {
    const total = sumScoreTenths([
      scoreTenthsFromPoints(0.1),
      scoreTenthsFromPoints(0.2),
      scoreTenthsFromPoints(0.4),
    ]);

    expect(total).toBe(7);
    expect(scoreTenthsToPoints(total)).toBe(0.7);
  });

  it('rejects negative, fractional, and unsafe internal units', () => {
    expect(() => scoreTenths(-1)).toThrow(RangeError);
    expect(() => scoreTenths(1.5)).toThrow(RangeError);
    expect(() => scoreTenths(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});
