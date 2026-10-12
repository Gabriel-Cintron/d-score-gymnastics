import { describe, expect, it } from 'vitest';

import * as scoring from '@d-score-gymnastics/scoring';
import * as rulesets from '../src/index';

describe('@d-score-gymnastics/rulesets package boundary', () => {
  it('loads with a one-way dependency on scoring', () => {
    expect(scoring).toBeDefined();
    expect(rulesets).toBeDefined();
  });
});
