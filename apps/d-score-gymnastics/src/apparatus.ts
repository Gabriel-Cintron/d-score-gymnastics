import type { ApparatusId } from '@d-score-gymnastics/scoring';

export const APPARATUS_LABELS = {
  'floor-exercise': 'Floor Exercise',
  'horizontal-bar': 'Horizontal Bar',
  'parallel-bars': 'Parallel Bars',
  'pommel-horse': 'Pommel Horse',
  'still-rings': 'Still Rings',
  vault: 'Vault',
} as const satisfies Record<ApparatusId, string>;

export const APPARATUS_SHORT_LABELS = {
  'floor-exercise': 'FX',
  'horizontal-bar': 'HB',
  'parallel-bars': 'PB',
  'pommel-horse': 'PH',
  'still-rings': 'SR',
  vault: 'VT',
} as const satisfies Record<ApparatusId, string>;
