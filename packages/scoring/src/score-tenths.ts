declare const scoreTenthsBrand: unique symbol;

/** A non-negative integer number of tenths, where 4 represents 0.4 points. */
export type ScoreTenths = number & { readonly [scoreTenthsBrand]: true };

export function scoreTenths(value: number): ScoreTenths {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Score tenths must be a non-negative safe integer; received ${value}.`);
  }
  return value as ScoreTenths;
}

export function scoreTenthsFromPoints(points: number): ScoreTenths {
  return scoreTenths(points * 10);
}

export function scoreTenthsToPoints(value: ScoreTenths): number {
  return value / 10;
}

export function sumScoreTenths(values: Iterable<ScoreTenths>): ScoreTenths {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return scoreTenths(total);
}

export function isScoreTenths(value: unknown): value is ScoreTenths {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
