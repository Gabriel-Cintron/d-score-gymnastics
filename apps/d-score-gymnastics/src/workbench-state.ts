import {
  APPARATUS_IDS,
  ELEMENT_ROUTINE_APPARATUS_IDS,
  isApparatusId,
  type ElementId,
  type ElementRoutineApparatusId,
  type RoutineRelationship,
} from '@d-score-gymnastics/scoring';
import type { CompiledElement } from '@d-score-gymnastics/rulesets';

import { parseProfileSelection } from './scoring-profile-state';
import type {
  LandingState,
  RelationshipState,
  RoutineEntry,
  RoutineState,
  WorkbenchState,
} from './types';

export const WORKBENCH_STATE_SCHEMA_VERSION = 3;
const PREVIOUS_WORKBENCH_STATE_SCHEMA_VERSION = 2;
const LEGACY_WORKBENCH_STATE_SCHEMA_VERSION = 1;
const MAX_STORED_ROUTINE_ELEMENTS = 32;

export interface StoredWorkbenchState extends WorkbenchState {
  readonly ruleset: {
    readonly dataRevision: string;
    readonly dataVersion: string;
    readonly disciplineId: string;
    readonly id: string;
  };
  readonly schemaVersion: typeof WORKBENCH_STATE_SCHEMA_VERSION;
}

interface WorkbenchStateContext {
  readonly disciplineId: string;
  readonly elementById: ReadonlyMap<ElementId, CompiledElement>;
  readonly rulesetId: string;
}

export const emptyRoutines: RoutineState = {
  'floor-exercise': [],
  'horizontal-bar': [],
  'parallel-bars': [],
  'pommel-horse': [],
  'still-rings': [],
};

export const emptyRelationships: RelationshipState = {
  'floor-exercise': [],
  'horizontal-bar': [],
  'parallel-bars': [],
  'pommel-horse': [],
  'still-rings': [],
};

export const emptyLandings: LandingState = {
  'floor-exercise': false,
  'horizontal-bar': false,
  'parallel-bars': false,
  'pommel-horse': false,
  'still-rings': false,
  vault: false,
};

export function createStoredWorkbenchState(
  state: WorkbenchState,
  ruleset: StoredWorkbenchState['ruleset'],
): StoredWorkbenchState {
  return {
    ...state,
    ruleset: { ...ruleset },
    schemaVersion: WORKBENCH_STATE_SCHEMA_VERSION,
  };
}

export function parseStoredWorkbenchState(
  value: unknown,
  context: WorkbenchStateContext,
): WorkbenchState | undefined {
  const record = objectRecord(value);
  if (record === undefined) return undefined;
  const ruleset = objectRecord(record.ruleset);
  const schemaVersion = record.schemaVersion;
  if (
    (schemaVersion !== WORKBENCH_STATE_SCHEMA_VERSION &&
      schemaVersion !== LEGACY_WORKBENCH_STATE_SCHEMA_VERSION &&
      schemaVersion !== PREVIOUS_WORKBENCH_STATE_SCHEMA_VERSION) ||
    ruleset?.id !== context.rulesetId ||
    (schemaVersion !== LEGACY_WORKBENCH_STATE_SCHEMA_VERSION &&
      ruleset.disciplineId !== context.disciplineId) ||
    (ruleset.disciplineId !== undefined && ruleset.disciplineId !== context.disciplineId) ||
    typeof record.nextOccurrenceNumber !== 'number' ||
    !Number.isSafeInteger(record.nextOccurrenceNumber) ||
    record.nextOccurrenceNumber < 1 ||
    typeof record.apparatus !== 'string' ||
    !isApparatusId(record.apparatus) ||
    (record.themeMode !== 'dark' && record.themeMode !== 'light')
  ) {
    return undefined;
  }

  const profiles = parseProfileSelection(record, schemaVersion !== WORKBENCH_STATE_SCHEMA_VERSION);
  if (!profiles) return undefined;
  const routines = parseRoutines(record.routines, context.elementById);
  const stuckByApparatus = parseLandings(record.stuckByApparatus);
  if (routines === undefined || stuckByApparatus === undefined) return undefined;
  const relationships = parseRelationships(record.relationships, routines);
  if (relationships === undefined) return undefined;

  const vaultId = record.vaultId;
  if (vaultId !== undefined) {
    if (typeof vaultId !== 'string') return undefined;
    const vault = context.elementById.get(vaultId as ElementId);
    if (vault?.apparatus !== 'vault') return undefined;
  }

  const derivedNextOccurrence = Math.max(
    1,
    ...Object.values(routines)
      .flat()
      .map(({ occurrenceId }) => nextNumberAfter(occurrenceId)),
  );
  return {
    ...profiles,
    apparatus: record.apparatus,
    nextOccurrenceNumber: Math.max(record.nextOccurrenceNumber, derivedNextOccurrence),
    relationships,
    routines,
    stuckByApparatus,
    themeMode: record.themeMode,
    ...(vaultId === undefined ? {} : { vaultId: vaultId as ElementId }),
  };
}

export function pruneRelationships(
  relationships: RelationshipState,
  routines: RoutineState,
): RelationshipState {
  let next = relationships;
  for (const apparatus of ELEMENT_ROUTINE_APPARATUS_IDS) {
    const indexByOccurrenceId = new Map(
      routines[apparatus].map(({ occurrenceId }, index) => [occurrenceId, index]),
    );
    const kept = relationships[apparatus].filter((relationship) =>
      relationshipIsContiguous(relationship, indexByOccurrenceId),
    );
    if (kept.length !== relationships[apparatus].length) {
      next = { ...next, [apparatus]: kept };
    }
  }
  return next;
}

function parseRoutines(
  value: unknown,
  elementById: ReadonlyMap<ElementId, CompiledElement>,
): RoutineState | undefined {
  const record = objectRecord(value);
  if (record === undefined) return undefined;
  const parsed = {} as Record<ElementRoutineApparatusId, readonly RoutineEntry[]>;
  const occurrenceIds = new Set<string>();
  for (const apparatus of ELEMENT_ROUTINE_APPARATUS_IDS) {
    const entries = record[apparatus];
    if (!Array.isArray(entries) || entries.length > MAX_STORED_ROUTINE_ELEMENTS) return undefined;
    const parsedEntries: RoutineEntry[] = [];
    for (const entryValue of entries) {
      const entry = objectRecord(entryValue);
      if (
        typeof entry?.elementId !== 'string' ||
        typeof entry.occurrenceId !== 'string' ||
        entry.occurrenceId.length === 0 ||
        occurrenceIds.has(entry.occurrenceId)
      ) {
        return undefined;
      }
      const elementId = entry.elementId as ElementId;
      if (elementById.get(elementId)?.apparatus !== apparatus) return undefined;
      const qualifiers = parseQualifiers(entry.qualifiers);
      if (qualifiers === null) return undefined;
      occurrenceIds.add(entry.occurrenceId);
      parsedEntries.push({
        elementId,
        occurrenceId: entry.occurrenceId,
        ...(qualifiers === undefined ? {} : { qualifiers }),
      });
    }
    parsed[apparatus] = parsedEntries;
  }
  return parsed;
}

function relationshipIsContiguous(
  relationship: RoutineRelationship,
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

function parseRelationships(value: unknown, routines: RoutineState): RelationshipState | undefined {
  const record = objectRecord(value);
  if (record === undefined) return undefined;
  const parsed = {} as Record<ElementRoutineApparatusId, readonly RoutineRelationship[]>;
  for (const apparatus of ELEMENT_ROUTINE_APPARATUS_IDS) {
    const relationships = record[apparatus];
    if (!Array.isArray(relationships)) return undefined;
    const occurrenceIds = new Set(routines[apparatus].map(({ occurrenceId }) => occurrenceId));
    const relationshipIds = new Set<string>();
    const parsedRelationships: RoutineRelationship[] = [];
    for (const relationshipValue of relationships) {
      const relationship = parseRelationship(relationshipValue, occurrenceIds);
      if (relationship === undefined) return undefined;
      const relationshipId =
        relationship.kind === 'connection' ? relationship.connectionId : relationship.sequenceId;
      if (relationshipIds.has(relationshipId)) return undefined;
      relationshipIds.add(relationshipId);
      parsedRelationships.push(relationship);
    }
    parsed[apparatus] = parsedRelationships;
  }
  return parsed;
}

function parseRelationship(
  value: unknown,
  validOccurrenceIds: ReadonlySet<string>,
): RoutineRelationship | undefined {
  const relationship = objectRecord(value);
  if (relationship === undefined || !Array.isArray(relationship.occurrenceIds)) return undefined;
  const occurrenceIds = relationship.occurrenceIds;
  if (
    occurrenceIds.some(
      (occurrenceId) => typeof occurrenceId !== 'string' || !validOccurrenceIds.has(occurrenceId),
    ) ||
    new Set(occurrenceIds).size !== occurrenceIds.length
  ) {
    return undefined;
  }
  if (
    relationship.kind === 'connection' &&
    typeof relationship.connectionId === 'string' &&
    relationship.connectionId.length > 0 &&
    occurrenceIds.length === 2
  ) {
    return {
      connectionId: relationship.connectionId,
      kind: 'connection',
      occurrenceIds: [occurrenceIds[0] as string, occurrenceIds[1] as string],
    };
  }
  if (
    relationship.kind === 'sequence' &&
    typeof relationship.sequenceId === 'string' &&
    relationship.sequenceId.length > 0 &&
    typeof relationship.sequenceType === 'string' &&
    relationship.sequenceType.length > 0 &&
    occurrenceIds.length >= 2
  ) {
    return {
      kind: 'sequence',
      occurrenceIds: [
        occurrenceIds[0] as string,
        occurrenceIds[1] as string,
        ...occurrenceIds.slice(2).map(String),
      ],
      sequenceId: relationship.sequenceId,
      sequenceType: relationship.sequenceType,
    };
  }
  return undefined;
}

function parseLandings(value: unknown): LandingState | undefined {
  const record = objectRecord(value);
  if (record === undefined) return undefined;
  const parsed = {} as Record<(typeof APPARATUS_IDS)[number], boolean>;
  for (const apparatus of APPARATUS_IDS) {
    if (typeof record[apparatus] !== 'boolean') return undefined;
    parsed[apparatus] = record[apparatus];
  }
  return parsed;
}

function parseQualifiers(value: unknown): readonly string[] | null | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.some((qualifier) => typeof qualifier !== 'string' || qualifier.length === 0) ||
    new Set(value).size !== value.length
  ) {
    return null;
  }
  return value.map(String);
}

function nextNumberAfter(occurrenceId: string): number {
  const match = /^routine-element-(\d+)$/.exec(occurrenceId);
  return match === null ? 1 : Number(match[1]) + 1;
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
