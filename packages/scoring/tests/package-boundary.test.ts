import { describe, expect, it } from 'vitest';

import * as scoring from '../src/index';

describe('@d-score-gymnastics/scoring package boundary', () => {
  it('loads without platform dependencies', () => {
    expect(scoring).toBeDefined();
  });
});
