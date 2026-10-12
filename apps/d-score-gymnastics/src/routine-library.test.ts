import { scoreTenths, type ElementId } from '@d-score-gymnastics/scoring';
import type { CompiledElement } from '@d-score-gymnastics/rulesets';
import { describe, expect, it } from 'vitest';

import {
  allAroundHasWork,
  applyLibraryItem,
  blankAllAroundState,
  captureAllAroundState,
  captureRoutineState,
  createStoredRoutineLibrary,
  libraryNameIsAvailable,
  nextUntitledAllAroundName,
  normalizeLibraryName,
  parseStoredRoutineLibrary,
  routineContentKey,
  uncataloguedRoutineApparatuses,
  type RoutineLibrary,
  type SavedAllAround,
  type SavedRoutine,
} from './routine-library';
import type { WorkbenchState } from './types';
import { emptyLandings, emptyRelationships, emptyRoutines } from './workbench-state';

const floorOne = element('fx:one', 'floor-exercise');
const floorTwo = element('fx:two', 'floor-exercise');
const pommelOne = element('ph:one', 'pommel-horse');
const vaultOne = element('vt:one', 'vault');
const elementById: ReadonlyMap<ElementId, CompiledElement> = new Map(
  [floorOne, floorTwo, pommelOne, vaultOne].map((catalogElement) => [
    catalogElement.id,
    catalogElement,
  ]),
);
const ruleset = {
  dataRevision: '2026-08-10',
  dataVersion: '0.4.0',
  disciplineId: 'mens-artistic-gymnastics',
  id: 'fig-mag-2025-2028',
};
const context = {
  disciplineId: ruleset.disciplineId,
  elementById,
  rulesetId: ruleset.id,
};
const timestamp = '2026-08-12T12:00:00.000Z';

describe('routine library', () => {
  it('captures one event without leaking other apparatus data', () => {
    const captured = captureRoutineState(workbenchState(), 'pommel-horse');

    expect(captured.apparatus).toBe('pommel-horse');
    expect(captured.routines['pommel-horse']).toEqual([
      {
        elementId: pommelOne.id,
        occurrenceId: 'routine-element-3',
        qualifiers: ['russian-location-end'],
      },
    ]);
    expect(captured.routines['floor-exercise']).toEqual([]);
    expect(captured.vaultId).toBeUndefined();
    expect(captured.stuckByApparatus).toEqual({
      ...emptyLandings,
      'pommel-horse': true,
    });
  });

  it('round-trips valid routine and all-around snapshots', () => {
    const state = workbenchState();
    const library: RoutineLibrary = {
      activeAllAroundId: 'saved-all-around',
      items: [savedRoutine(state, 'floor-exercise'), savedAllAround(state)],
    };

    const parsed = parseStoredRoutineLibrary(createStoredRoutineLibrary(library, ruleset), context);

    expect(parsed?.items).toHaveLength(2);
    expect(parsed?.activeAllAroundId).toBe('saved-all-around');
    expect(parsed?.items[0]?.name).toBe('Floor set');
    expect(parsed?.items[1]?.kind).toBe('all-around');
  });

  it('migrates the previous snapshot library without inventing an active workspace', () => {
    const stored = createStoredRoutineLibrary(
      { activeAllAroundId: 'saved-all-around', items: [savedAllAround(workbenchState())] },
      ruleset,
    );
    const legacy = { ...stored, schemaVersion: 1 };

    const parsed = parseStoredRoutineLibrary(legacy, context);

    expect(parsed?.items).toHaveLength(1);
    expect(parsed?.activeAllAroundId).toBeUndefined();
  });

  it('accepts a blank all-around workspace', () => {
    const blank: SavedAllAround = {
      createdAt: timestamp,
      id: 'blank-all-around',
      kind: 'all-around',
      name: 'Untitled All-Around',
      state: blankAllAroundState('dark'),
      updatedAt: timestamp,
    };
    const stored = createStoredRoutineLibrary(
      { activeAllAroundId: blank.id, items: [blank] },
      ruleset,
    );

    expect(parseStoredRoutineLibrary(stored, context)?.items[0]).toMatchObject({
      id: blank.id,
      kind: 'all-around',
    });
  });

  it('rejects an active workspace ID that does not identify an all-around', () => {
    const stored = createStoredRoutineLibrary(
      {
        activeAllAroundId: 'saved-all-around',
        items: [savedRoutine(workbenchState(), 'floor-exercise'), savedAllAround(workbenchState())],
      },
      ruleset,
    );

    expect(
      parseStoredRoutineLibrary({ ...stored, activeAllAroundId: 'saved-floor' }, context),
    ).toBeUndefined();
    expect(
      parseStoredRoutineLibrary({ ...stored, activeAllAroundId: 'missing' }, context),
    ).toBeUndefined();
  });

  it('rejects stale catalog IDs and routine snapshots that contain another event', () => {
    const state = workbenchState();
    const routine = savedRoutine(state, 'floor-exercise');
    const stored = createStoredRoutineLibrary({ items: [routine] }, ruleset);
    const unknownElement = {
      ...stored,
      items: [
        {
          ...stored.items[0],
          state: {
            ...routine.state,
            routines: {
              ...routine.state.routines,
              'floor-exercise': [
                { elementId: 'fx:removed-element', occurrenceId: 'routine-element-1' },
              ],
            },
          },
        },
      ],
    };
    const leakedEvent = createStoredRoutineLibrary(
      {
        items: [
          {
            ...routine,
            state,
          },
        ],
      },
      ruleset,
    );

    expect(parseStoredRoutineLibrary(unknownElement, context)).toBeUndefined();
    expect(parseStoredRoutineLibrary(leakedEvent, context)).toBeUndefined();
  });

  it('loads a named routine with fresh occurrence and relationship IDs', () => {
    const current = {
      ...workbenchState(),
      themeMode: 'dark' as const,
    };
    const loaded = applyLibraryItem(current, savedRoutine(workbenchState(), 'floor-exercise'), 40);

    expect(loaded.apparatus).toBe('floor-exercise');
    expect(loaded.themeMode).toBe('dark');
    expect(loaded.routines['floor-exercise'].map(({ occurrenceId }) => occurrenceId)).toEqual([
      'routine-element-40',
      'routine-element-41',
    ]);
    expect(loaded.relationships['floor-exercise']).toEqual([
      {
        connectionId: 'connection:routine-element-40:routine-element-41',
        kind: 'connection',
        occurrenceIds: ['routine-element-40', 'routine-element-41'],
      },
    ]);
    expect(loaded.routines['pommel-horse']).toEqual(current.routines['pommel-horse']);
    expect(loaded.nextOccurrenceNumber).toBe(42);
  });

  it('loads a self-contained all-around snapshot and preserves the current theme', () => {
    const current: WorkbenchState = {
      ...workbenchState(),
      routines: emptyRoutines,
      relationships: emptyRelationships,
      stuckByApparatus: emptyLandings,
      themeMode: 'dark',
    };
    const loaded = applyLibraryItem(current, savedAllAround(workbenchState()), 70);

    expect(loaded.themeMode).toBe('dark');
    expect(loaded.routines['floor-exercise'][0]?.occurrenceId).toBe('routine-element-70');
    expect(loaded.routines['pommel-horse'][0]).toMatchObject({
      occurrenceId: 'routine-element-72',
      qualifiers: ['russian-location-end'],
    });
    expect(loaded.vaultId).toBe(vaultOne.id);
    expect(loaded.nextOccurrenceNumber).toBe(73);
  });

  it('normalizes names and prevents case-insensitive duplicates', () => {
    const library: RoutineLibrary = { items: [savedAllAround(workbenchState())] };

    expect(normalizeLibraryName('  Senior   set  ')).toBe('Senior set');
    expect(libraryNameIsAvailable(library, ' all-around ')).toBe(false);
    expect(libraryNameIsAvailable(library, 'Another set')).toBe(true);
    expect(allAroundHasWork(workbenchState())).toBe(true);
    expect(nextUntitledAllAroundName(library)).toBe('Untitled All-Around');
    expect(
      nextUntitledAllAroundName({
        items: [
          { ...savedAllAround(workbenchState()), id: 'untitled-1', name: 'Untitled All-Around' },
          {
            ...savedAllAround(workbenchState()),
            id: 'untitled-2',
            name: 'Untitled All-Around 2',
          },
        ],
      }),
    ).toBe('Untitled All-Around 3');
  });

  it('recognizes catalogue copies even after occurrence IDs are remapped', () => {
    const source = workbenchState();
    const catalogueRoutine = savedRoutine(source, 'floor-exercise');
    const remapped = applyLibraryItem(
      { ...blankAllAroundState('light'), nextOccurrenceNumber: 40 },
      catalogueRoutine,
      40,
    );
    const library: RoutineLibrary = { items: [catalogueRoutine] };

    expect(routineContentKey(remapped, 'floor-exercise')).toBe(
      routineContentKey(catalogueRoutine.state, 'floor-exercise'),
    );
    expect(uncataloguedRoutineApparatuses(remapped, library)).toEqual([]);
    expect(uncataloguedRoutineApparatuses(source, library)).toEqual(['pommel-horse', 'vault']);
  });
});

function savedRoutine(state: WorkbenchState, apparatus: 'floor-exercise'): SavedRoutine {
  return {
    apparatus,
    createdAt: timestamp,
    id: 'saved-floor',
    kind: 'routine',
    name: 'Floor set',
    state: captureRoutineState(state, apparatus),
    updatedAt: timestamp,
  };
}

function savedAllAround(state: WorkbenchState): SavedAllAround {
  return {
    createdAt: timestamp,
    id: 'saved-all-around',
    kind: 'all-around',
    name: 'All-around',
    state: captureAllAroundState(state),
    updatedAt: timestamp,
  };
}

function workbenchState(): WorkbenchState {
  return {
    apparatus: 'pommel-horse',
    nextOccurrenceNumber: 4,
    relationships: {
      ...emptyRelationships,
      'floor-exercise': [
        {
          connectionId: 'saved-connection',
          kind: 'connection',
          occurrenceIds: ['routine-element-1', 'routine-element-2'],
        },
      ],
    },
    routines: {
      ...emptyRoutines,
      'floor-exercise': [
        { elementId: floorOne.id, occurrenceId: 'routine-element-1' },
        { elementId: floorTwo.id, occurrenceId: 'routine-element-2' },
      ],
      'pommel-horse': [
        {
          elementId: pommelOne.id,
          occurrenceId: 'routine-element-3',
          qualifiers: ['russian-location-end'],
        },
      ],
    },
    stuckByApparatus: {
      ...emptyLandings,
      'floor-exercise': true,
      'pommel-horse': true,
      vault: true,
    },
    themeMode: 'light',
    vaultId: vaultOne.id,
  };
}

function element(id: ElementId, apparatus: CompiledElement['apparatus']): CompiledElement {
  return {
    aliases: [],
    apparatus,
    code: { group: 1, number: 1 },
    difficulty:
      apparatus === 'vault'
        ? { kind: 'vault', tenths: scoreTenths(40) }
        : { kind: 'letter', letter: 'A', tenths: scoreTenths(1) },
    families: [],
    id,
    name: id,
    roles: [],
    source: { documentId: 'test-code', page: 1 },
    traits: [],
  };
}
