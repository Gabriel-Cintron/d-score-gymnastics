import {
  APPARATUS_IDS,
  ELEMENT_ROUTINE_APPARATUS_IDS,
  isApparatusId,
  type ApparatusId,
  type ElementId,
  type ElementRoutineApparatusId,
  type RoutineRelationship,
} from '@d-score-gymnastics/scoring';
import type { CompiledElement } from '@d-score-gymnastics/rulesets';

import type { RoutineEntry, WorkbenchState } from './types';
import {
  emptyLandings,
  emptyRelationships,
  emptyRoutines,
  parseStoredWorkbenchState,
  WORKBENCH_STATE_SCHEMA_VERSION,
} from './workbench-state';

export const ROUTINE_LIBRARY_SCHEMA_VERSION = 3;
const LEGACY_ROUTINE_LIBRARY_SCHEMA_VERSION = 1;
const PREVIOUS_ROUTINE_LIBRARY_SCHEMA_VERSION = 2;
export const MAX_LIBRARY_NAME_LENGTH = 80;
export const MAX_LIBRARY_ITEMS = 100;

export interface RoutineLibraryRuleset {
  readonly dataRevision: string;
  readonly dataVersion: string;
  readonly disciplineId: string;
  readonly id: string;
}

interface RoutineLibraryItemBase {
  readonly createdAt: string;
  readonly id: string;
  readonly name: string;
  readonly state: WorkbenchState;
  readonly updatedAt: string;
}

export interface SavedRoutine extends RoutineLibraryItemBase {
  readonly apparatus: ApparatusId;
  readonly kind: 'routine';
}

export interface SavedAllAround extends RoutineLibraryItemBase {
  readonly kind: 'all-around';
}

export type RoutineLibraryItem = SavedAllAround | SavedRoutine;

export interface RoutineLibrary {
  readonly activeAllAroundId?: string;
  readonly items: readonly RoutineLibraryItem[];
}

export interface StoredRoutineLibrary extends RoutineLibrary {
  readonly ruleset: RoutineLibraryRuleset;
  readonly schemaVersion: typeof ROUTINE_LIBRARY_SCHEMA_VERSION;
}

interface RoutineLibraryContext {
  readonly disciplineId: string;
  readonly elementById: ReadonlyMap<ElementId, CompiledElement>;
  readonly rulesetId: string;
}

export function emptyRoutineLibrary(): RoutineLibrary {
  return { items: [] };
}

export function createStoredRoutineLibrary(
  library: RoutineLibrary,
  ruleset: RoutineLibraryRuleset,
): StoredRoutineLibrary {
  return {
    ...(library.activeAllAroundId === undefined
      ? {}
      : { activeAllAroundId: library.activeAllAroundId }),
    items: library.items.map((item) => ({ ...item, state: cloneWorkbenchState(item.state) })),
    ruleset: { ...ruleset },
    schemaVersion: ROUTINE_LIBRARY_SCHEMA_VERSION,
  };
}

export function parseStoredRoutineLibrary(
  value: unknown,
  context: RoutineLibraryContext,
): RoutineLibrary | undefined {
  const record = objectRecord(value);
  if (record === undefined) return undefined;
  const ruleset = objectRecord(record.ruleset);
  const schemaVersion = record.schemaVersion;
  if (
    (schemaVersion !== ROUTINE_LIBRARY_SCHEMA_VERSION &&
      schemaVersion !== PREVIOUS_ROUTINE_LIBRARY_SCHEMA_VERSION &&
      schemaVersion !== LEGACY_ROUTINE_LIBRARY_SCHEMA_VERSION) ||
    ruleset?.id !== context.rulesetId ||
    (schemaVersion === ROUTINE_LIBRARY_SCHEMA_VERSION &&
      ruleset.disciplineId !== context.disciplineId) ||
    (ruleset.disciplineId !== undefined && ruleset.disciplineId !== context.disciplineId) ||
    typeof ruleset.dataRevision !== 'string' ||
    typeof ruleset.dataVersion !== 'string' ||
    !Array.isArray(record.items) ||
    record.items.length > MAX_LIBRARY_ITEMS
  ) {
    return undefined;
  }

  const parsedItems: RoutineLibraryItem[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const value of record.items) {
    const item = parseLibraryItem(value, context, {
      dataRevision: ruleset.dataRevision,
      dataVersion: ruleset.dataVersion,
      disciplineId: context.disciplineId,
      id: context.rulesetId,
    });
    if (item === undefined || ids.has(item.id) || names.has(item.name.toLocaleLowerCase('en-US'))) {
      return undefined;
    }
    ids.add(item.id);
    names.add(item.name.toLocaleLowerCase('en-US'));
    parsedItems.push(item);
  }

  if (schemaVersion === LEGACY_ROUTINE_LIBRARY_SCHEMA_VERSION) {
    return { items: parsedItems };
  }
  const activeAllAroundId = record.activeAllAroundId;
  if (
    activeAllAroundId !== undefined &&
    (typeof activeAllAroundId !== 'string' ||
      !parsedItems.some((item) => item.kind === 'all-around' && item.id === activeAllAroundId))
  ) {
    return undefined;
  }
  return {
    ...(activeAllAroundId === undefined ? {} : { activeAllAroundId }),
    items: parsedItems,
  };
}

export function captureRoutineState(state: WorkbenchState, apparatus: ApparatusId): WorkbenchState {
  const routines =
    apparatus === 'vault'
      ? emptyRoutines
      : { ...emptyRoutines, [apparatus]: cloneEntries(state.routines[apparatus]) };
  const relationships =
    apparatus === 'vault'
      ? emptyRelationships
      : {
          ...emptyRelationships,
          [apparatus]: cloneRelationships(state.relationships[apparatus]),
        };
  return {
    apparatus,
    nextOccurrenceNumber: state.nextOccurrenceNumber,
    relationships,
    routines,
    stuckByApparatus: {
      ...emptyLandings,
      [apparatus]: state.stuckByApparatus[apparatus],
    },
    themeMode: state.themeMode,
    ...(apparatus === 'vault' && state.vaultId !== undefined ? { vaultId: state.vaultId } : {}),
  };
}

export function captureAllAroundState(state: WorkbenchState): WorkbenchState {
  return cloneWorkbenchState(state);
}

export function apparatusHasWork(state: WorkbenchState, apparatus: ApparatusId): boolean {
  return apparatus === 'vault' ? state.vaultId !== undefined : state.routines[apparatus].length > 0;
}

export function allAroundHasWork(state: WorkbenchState): boolean {
  return APPARATUS_IDS.some((apparatus) => apparatusHasWork(state, apparatus));
}

export function allAroundsInLibrary(library: RoutineLibrary): readonly SavedAllAround[] {
  return library.items.filter((item): item is SavedAllAround => item.kind === 'all-around');
}

export function routinesInCatalogue(library: RoutineLibrary): readonly SavedRoutine[] {
  return library.items.filter((item): item is SavedRoutine => item.kind === 'routine');
}

export function activeAllAround(library: RoutineLibrary): SavedAllAround | undefined {
  return allAroundsInLibrary(library).find((item) => item.id === library.activeAllAroundId);
}

export function blankAllAroundState(
  themeMode: WorkbenchState['themeMode'],
  nextOccurrenceNumber = 1,
): WorkbenchState {
  return {
    apparatus: 'floor-exercise',
    nextOccurrenceNumber,
    relationships: emptyRelationships,
    routines: emptyRoutines,
    stuckByApparatus: emptyLandings,
    themeMode,
  };
}

export function nextUntitledAllAroundName(library: RoutineLibrary): string {
  const base = 'Untitled All-Around';
  if (libraryNameIsAvailable(library, base)) return base;
  let suffix = 2;
  while (!libraryNameIsAvailable(library, `${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}

export function uncataloguedRoutineApparatuses(
  state: WorkbenchState,
  library: RoutineLibrary,
): readonly ApparatusId[] {
  const catalogueKeys = new Set(
    routinesInCatalogue(library).map((item) => routineContentKey(item.state, item.apparatus)),
  );
  return APPARATUS_IDS.filter(
    (apparatus) =>
      apparatusHasWork(state, apparatus) && !catalogueKeys.has(routineContentKey(state, apparatus)),
  );
}

export function routineContentKey(state: WorkbenchState, apparatus: ApparatusId): string {
  if (apparatus === 'vault') {
    return JSON.stringify({
      apparatus,
      stuck: state.stuckByApparatus.vault,
      vaultId: state.vaultId,
    });
  }
  const entries = state.routines[apparatus];
  const indexByOccurrenceId = new Map(
    entries.map(({ occurrenceId }, index) => [occurrenceId, index]),
  );
  const relationships = state.relationships[apparatus]
    .map((relationship) => ({
      kind: relationship.kind,
      occurrenceIndexes: relationship.occurrenceIds.map((occurrenceId) =>
        indexByOccurrenceId.get(occurrenceId),
      ),
      ...(relationship.kind === 'sequence' ? { sequenceType: relationship.sequenceType } : {}),
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), 'en-US'));
  return JSON.stringify({
    apparatus,
    entries: entries.map(({ elementId, qualifiers }) => ({
      elementId,
      ...(qualifiers === undefined ? {} : { qualifiers: [...qualifiers].sort() }),
    })),
    relationships,
    stuck: state.stuckByApparatus[apparatus],
  });
}

export function normalizeLibraryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_LIBRARY_NAME_LENGTH);
}

export function libraryNameIsAvailable(
  library: RoutineLibrary,
  name: string,
  ignoredItemId?: string,
): boolean {
  const normalized = normalizeLibraryName(name).toLocaleLowerCase('en-US');
  return (
    normalized.length > 0 &&
    !library.items.some(
      (item) => item.id !== ignoredItemId && item.name.toLocaleLowerCase('en-US') === normalized,
    )
  );
}

export function applyLibraryItem(
  current: WorkbenchState,
  item: RoutineLibraryItem,
  startingOccurrenceNumber: number,
): WorkbenchState {
  if (item.kind === 'routine') {
    if (item.apparatus === 'vault') {
      if (item.state.vaultId === undefined) return current;
      return {
        ...current,
        apparatus: 'vault',
        nextOccurrenceNumber: startingOccurrenceNumber,
        stuckByApparatus: {
          ...current.stuckByApparatus,
          vault: item.state.stuckByApparatus.vault,
        },
        vaultId: item.state.vaultId,
      };
    }

    const instantiated = instantiateElementRoutine(
      item.state.routines[item.apparatus],
      item.state.relationships[item.apparatus],
      startingOccurrenceNumber,
    );
    return {
      ...current,
      apparatus: item.apparatus,
      nextOccurrenceNumber: instantiated.nextOccurrenceNumber,
      relationships: {
        ...current.relationships,
        [item.apparatus]: instantiated.relationships,
      },
      routines: { ...current.routines, [item.apparatus]: instantiated.entries },
      stuckByApparatus: {
        ...current.stuckByApparatus,
        [item.apparatus]: item.state.stuckByApparatus[item.apparatus],
      },
    };
  }

  let nextOccurrenceNumber = startingOccurrenceNumber;
  const routines = { ...emptyRoutines };
  const relationships = { ...emptyRelationships };
  for (const apparatus of ELEMENT_ROUTINE_APPARATUS_IDS) {
    const instantiated = instantiateElementRoutine(
      item.state.routines[apparatus],
      item.state.relationships[apparatus],
      nextOccurrenceNumber,
    );
    routines[apparatus] = instantiated.entries;
    relationships[apparatus] = instantiated.relationships;
    nextOccurrenceNumber = instantiated.nextOccurrenceNumber;
  }
  return {
    apparatus: item.state.apparatus,
    nextOccurrenceNumber,
    relationships,
    routines,
    stuckByApparatus: { ...item.state.stuckByApparatus },
    themeMode: current.themeMode,
    ...(item.state.vaultId === undefined ? {} : { vaultId: item.state.vaultId }),
  };
}

function parseLibraryItem(
  value: unknown,
  context: RoutineLibraryContext,
  ruleset: RoutineLibraryRuleset,
): RoutineLibraryItem | undefined {
  const record = objectRecord(value);
  const stateRecord = objectRecord(record?.state);
  if (
    record === undefined ||
    stateRecord === undefined ||
    !validStoredText(record.id, 120) ||
    !validStoredName(record.name) ||
    !validTimestamp(record.createdAt) ||
    !validTimestamp(record.updatedAt)
  ) {
    return undefined;
  }
  const state = parseStoredWorkbenchState(
    {
      ...stateRecord,
      ruleset,
      schemaVersion: WORKBENCH_STATE_SCHEMA_VERSION,
    },
    context,
  );
  if (state === undefined) return undefined;

  const base = {
    createdAt: record.createdAt,
    id: record.id,
    name: record.name,
    state,
    updatedAt: record.updatedAt,
  };
  if (record.kind === 'all-around') return { ...base, kind: 'all-around' };
  if (
    record.kind !== 'routine' ||
    typeof record.apparatus !== 'string' ||
    !isApparatusId(record.apparatus) ||
    state.apparatus !== record.apparatus ||
    !allAroundHasWork(state) ||
    !isolatesApparatus(state, record.apparatus)
  ) {
    return undefined;
  }
  return { ...base, apparatus: record.apparatus, kind: 'routine' };
}

function isolatesApparatus(state: WorkbenchState, apparatus: ApparatusId): boolean {
  if (!apparatusHasWork(state, apparatus)) return false;
  if (apparatus === 'vault') {
    return ELEMENT_ROUTINE_APPARATUS_IDS.every(
      (candidate) =>
        state.routines[candidate].length === 0 &&
        state.relationships[candidate].length === 0 &&
        !state.stuckByApparatus[candidate],
    );
  }
  return (
    state.vaultId === undefined &&
    ELEMENT_ROUTINE_APPARATUS_IDS.every(
      (candidate) =>
        candidate === apparatus ||
        (state.routines[candidate].length === 0 &&
          state.relationships[candidate].length === 0 &&
          !state.stuckByApparatus[candidate]),
    ) &&
    !state.stuckByApparatus.vault
  );
}

function instantiateElementRoutine(
  entries: WorkbenchState['routines'][ElementRoutineApparatusId],
  relationships: readonly RoutineRelationship[],
  startingOccurrenceNumber: number,
): {
  readonly entries: readonly RoutineEntry[];
  readonly nextOccurrenceNumber: number;
  readonly relationships: readonly RoutineRelationship[];
} {
  let nextOccurrenceNumber = startingOccurrenceNumber;
  const replacementByOccurrenceId = new Map<string, string>();
  const instantiatedEntries = entries.map((entry) => {
    const occurrenceId = `routine-element-${nextOccurrenceNumber}`;
    nextOccurrenceNumber += 1;
    replacementByOccurrenceId.set(entry.occurrenceId, occurrenceId);
    return {
      elementId: entry.elementId,
      occurrenceId,
      ...(entry.qualifiers === undefined ? {} : { qualifiers: [...entry.qualifiers] }),
    };
  });
  const instantiatedRelationships: RoutineRelationship[] = [];
  for (const relationship of relationships) {
    const occurrenceIds = relationship.occurrenceIds.map((occurrenceId) =>
      replacementByOccurrenceId.get(occurrenceId),
    );
    if (occurrenceIds.some((occurrenceId) => occurrenceId === undefined)) continue;
    const ids = occurrenceIds as string[];
    if (relationship.kind === 'connection') {
      const first = ids[0];
      const second = ids[1];
      if (first === undefined || second === undefined) continue;
      instantiatedRelationships.push({
        connectionId: `connection:${first}:${second}`,
        kind: 'connection',
        occurrenceIds: [first, second],
      });
      continue;
    }
    const first = ids[0];
    const second = ids[1];
    if (first === undefined || second === undefined) continue;
    const sequenceIds = [first, second, ...ids.slice(2)] as [string, string, ...string[]];
    instantiatedRelationships.push({
      kind: 'sequence',
      occurrenceIds: sequenceIds,
      sequenceId: `sequence:${relationship.sequenceType}:${sequenceIds.join(':')}`,
      sequenceType: relationship.sequenceType,
    });
  }
  return {
    entries: instantiatedEntries,
    nextOccurrenceNumber,
    relationships: instantiatedRelationships,
  };
}

function cloneWorkbenchState(state: WorkbenchState): WorkbenchState {
  return {
    apparatus: state.apparatus,
    nextOccurrenceNumber: state.nextOccurrenceNumber,
    relationships: {
      'floor-exercise': cloneRelationships(state.relationships['floor-exercise']),
      'horizontal-bar': cloneRelationships(state.relationships['horizontal-bar']),
      'parallel-bars': cloneRelationships(state.relationships['parallel-bars']),
      'pommel-horse': cloneRelationships(state.relationships['pommel-horse']),
      'still-rings': cloneRelationships(state.relationships['still-rings']),
    },
    routines: {
      'floor-exercise': cloneEntries(state.routines['floor-exercise']),
      'horizontal-bar': cloneEntries(state.routines['horizontal-bar']),
      'parallel-bars': cloneEntries(state.routines['parallel-bars']),
      'pommel-horse': cloneEntries(state.routines['pommel-horse']),
      'still-rings': cloneEntries(state.routines['still-rings']),
    },
    stuckByApparatus: { ...state.stuckByApparatus },
    themeMode: state.themeMode,
    ...(state.vaultId === undefined ? {} : { vaultId: state.vaultId }),
  };
}

function cloneEntries(entries: WorkbenchState['routines'][ElementRoutineApparatusId]) {
  return entries.map((entry) => ({
    ...entry,
    ...(entry.qualifiers === undefined ? {} : { qualifiers: [...entry.qualifiers] }),
  }));
}

function cloneRelationships(relationships: readonly RoutineRelationship[]) {
  return relationships.map((relationship) => ({
    ...relationship,
    occurrenceIds: [...relationship.occurrenceIds],
  })) as readonly RoutineRelationship[];
}

function validStoredName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_LIBRARY_NAME_LENGTH &&
    normalizeLibraryName(value) === value &&
    value.length > 0
  );
}

function validStoredText(value: unknown, maximumLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximumLength;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
