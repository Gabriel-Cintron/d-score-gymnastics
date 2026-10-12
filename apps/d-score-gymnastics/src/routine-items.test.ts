import type { ElementId, RoutineSequence } from '@d-score-gymnastics/scoring';
import { describe, expect, it } from 'vitest';

import { buildRoutineItems, moveRoutineItem } from './routine-items';
import type { RoutineEntry } from './types';

const entries: readonly RoutineEntry[] = [
  entry('ph:first', 'first'),
  entry('ph:dsb', 'flop-one'),
  entry('ph:dsb', 'flop-two'),
  entry('ph:dsa', 'flop-three'),
  entry('ph:dismount', 'dismount'),
];
const sequence: RoutineSequence = {
  kind: 'sequence',
  occurrenceIds: ['flop-one', 'flop-two', 'flop-three'],
  sequenceId: 'flop',
  sequenceType: 'pommel-flop',
};

describe('routine items', () => {
  it('groups atomic Pommel components into one visual item', () => {
    const items = buildRoutineItems(entries, [sequence]);

    expect(items).toHaveLength(3);
    expect(items[1]).toMatchObject({ itemId: 'flop', sequence });
    expect(items[1]?.entries.map(({ occurrenceId }) => occurrenceId)).toEqual([
      'flop-one',
      'flop-two',
      'flop-three',
    ]);
  });

  it('moves a grouped sequence without separating its components', () => {
    const items = buildRoutineItems(entries, [sequence]);
    const moved = moveRoutineItem(items, 1, -1);

    expect(moved.map(({ occurrenceId }) => occurrenceId)).toEqual([
      'flop-one',
      'flop-two',
      'flop-three',
      'first',
      'dismount',
    ]);
  });
});

function entry(elementId: ElementId, occurrenceId: string): RoutineEntry {
  return { elementId, occurrenceId };
}
