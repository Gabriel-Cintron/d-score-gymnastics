import type { RoutineRelationship, RoutineSequence } from '@d-score-gymnastics/scoring';

import type { RoutineEntry } from './types';

export interface RoutineItem {
  readonly entries: readonly [RoutineEntry, ...RoutineEntry[]];
  readonly itemId: string;
  readonly sequence?: RoutineSequence;
}

export function buildRoutineItems(
  entries: readonly RoutineEntry[],
  relationships: readonly RoutineRelationship[],
): readonly RoutineItem[] {
  const indexByOccurrenceId = new Map(
    entries.map(({ occurrenceId }, index) => [occurrenceId, index]),
  );
  const sequenceByFirstOccurrenceId = new Map<string, RoutineSequence>();
  for (const relationship of relationships) {
    if (
      relationship.kind === 'sequence' &&
      relationshipIsContiguous(relationship, indexByOccurrenceId)
    ) {
      const firstOccurrenceId = relationship.occurrenceIds[0];
      if (firstOccurrenceId !== undefined && !sequenceByFirstOccurrenceId.has(firstOccurrenceId)) {
        sequenceByFirstOccurrenceId.set(firstOccurrenceId, relationship);
      }
    }
  }

  const items: RoutineItem[] = [];
  for (let index = 0; index < entries.length;) {
    const entry = entries[index];
    if (entry === undefined) break;
    const sequence = sequenceByFirstOccurrenceId.get(entry.occurrenceId);
    if (sequence === undefined) {
      items.push({ entries: [entry], itemId: entry.occurrenceId });
      index += 1;
      continue;
    }
    const sequenceEntries = entries.slice(index, index + sequence.occurrenceIds.length);
    const first = sequenceEntries[0];
    if (first === undefined) {
      index += 1;
      continue;
    }
    items.push({
      entries: [first, ...sequenceEntries.slice(1)],
      itemId: sequence.sequenceId,
      sequence,
    });
    index += sequenceEntries.length;
  }
  return items;
}

export function moveRoutineItem(
  items: readonly RoutineItem[],
  index: number,
  direction: -1 | 1,
): readonly RoutineEntry[] {
  const destination = index + direction;
  const sourceItem = items[index];
  const destinationItem = items[destination];
  if (sourceItem === undefined || destinationItem === undefined) {
    return items.flatMap(({ entries }) => entries);
  }
  const moved = [...items];
  moved[index] = destinationItem;
  moved[destination] = sourceItem;
  return moved.flatMap(({ entries }) => entries);
}

function relationshipIsContiguous(
  relationship: RoutineSequence,
  indexByOccurrenceId: ReadonlyMap<string, number>,
): boolean {
  const firstIndex = indexByOccurrenceId.get(relationship.occurrenceIds[0] ?? '');
  return (
    firstIndex !== undefined &&
    relationship.occurrenceIds.every(
      (occurrenceId, offset) => indexByOccurrenceId.get(occurrenceId) === firstIndex + offset,
    )
  );
}
