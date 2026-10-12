import { scoreTenths, type ElementId } from '@d-score-gymnastics/scoring';
import type { CompiledElement } from '@d-score-gymnastics/rulesets';
import { describe, expect, it } from 'vitest';

import type { WorkbenchState } from './types';
import {
  createStoredWorkbenchState,
  emptyLandings,
  emptyRelationships,
  emptyRoutines,
  parseStoredWorkbenchState,
  pruneRelationships,
} from './workbench-state';

const parallelBarsElement = element('pb:test-skill', 'parallel-bars');
const secondParallelBarsElement = element('pb:second-test-skill', 'parallel-bars');
const pommelElement = element('ph:test-component', 'pommel-horse');
const vaultElement = element('vt:test-vault', 'vault');
const elementById: ReadonlyMap<ElementId, CompiledElement> = new Map(
  [parallelBarsElement, secondParallelBarsElement, pommelElement, vaultElement].map(
    (catalogElement) => [catalogElement.id, catalogElement],
  ),
);
const context = {
  disciplineId: 'mens-artistic-gymnastics',
  elementById,
  rulesetId: 'fig-mag-2025-2028',
};

describe('stored workbench state', () => {
  it('restores validated state and advances the occurrence counter', () => {
    const stored = createStoredWorkbenchState(workbenchState(), {
      dataRevision: '2026-08-10',
      dataVersion: '0.4.0',
      disciplineId: context.disciplineId,
      id: context.rulesetId,
    });

    expect(parseStoredWorkbenchState(stored, context)).toEqual({
      ...workbenchState(),
      nextOccurrenceNumber: 9,
    });
  });

  it('allows a prior data revision when every persisted element still exists', () => {
    const stored = createStoredWorkbenchState(workbenchState(), {
      dataRevision: '2025-01-01',
      dataVersion: '0.1.0',
      disciplineId: context.disciplineId,
      id: context.rulesetId,
    });

    expect(parseStoredWorkbenchState(stored, context)?.vaultId).toBe('vt:test-vault');
  });

  it('rejects unknown elements instead of loading stale invalid state', () => {
    const stored = createStoredWorkbenchState(workbenchState(), {
      dataRevision: '2026-08-10',
      dataVersion: '0.4.0',
      disciplineId: context.disciplineId,
      id: context.rulesetId,
    });
    const invalid = {
      ...stored,
      routines: {
        ...stored.routines,
        'parallel-bars': [{ elementId: 'pb:removed-skill', occurrenceId: 'routine-element-7' }],
      },
    };

    expect(parseStoredWorkbenchState(invalid, context)).toBeUndefined();
  });

  it('rejects relationships that reference an occurrence outside the routine', () => {
    const stored = createStoredWorkbenchState(workbenchState(), {
      dataRevision: '2026-08-10',
      dataVersion: '0.4.0',
      disciplineId: context.disciplineId,
      id: context.rulesetId,
    });
    const invalid = {
      ...stored,
      relationships: {
        ...stored.relationships,
        'parallel-bars': [
          {
            connectionId: 'invalid',
            kind: 'connection',
            occurrenceIds: ['routine-element-7', 'routine-element-404'],
          },
        ],
      },
    };

    expect(parseStoredWorkbenchState(invalid, context)).toBeUndefined();
  });

  it('removes relationships when their occurrences are no longer contiguous', () => {
    const routines = {
      ...emptyRoutines,
      'parallel-bars': [
        { elementId: parallelBarsElement.id, occurrenceId: 'one' },
        { elementId: parallelBarsElement.id, occurrenceId: 'between' },
        { elementId: parallelBarsElement.id, occurrenceId: 'two' },
      ],
    };
    const relationships = {
      ...emptyRelationships,
      'parallel-bars': [
        {
          connectionId: 'one-to-two',
          kind: 'connection' as const,
          occurrenceIds: ['one', 'two'] as const,
        },
      ],
    };

    expect(pruneRelationships(relationships, routines)['parallel-bars']).toEqual([]);
  });

  it('restores more than eight atomic occurrences used by grouped sequences', () => {
    const pommelEntries = Array.from({ length: 9 }, (_, index) => ({
      elementId: pommelElement.id,
      occurrenceId: `pommel-${index + 1}`,
    }));
    const stored = createStoredWorkbenchState(
      {
        ...workbenchState(),
        apparatus: 'pommel-horse',
        relationships: {
          ...emptyRelationships,
          'pommel-horse': [
            {
              kind: 'sequence',
              occurrenceIds: ['pommel-1', 'pommel-2', 'pommel-3'],
              sequenceId: 'stored-flop',
              sequenceType: 'pommel-flop',
            },
          ],
        },
        routines: { ...emptyRoutines, 'pommel-horse': pommelEntries },
      },
      {
        dataRevision: '2026-08-10',
        dataVersion: '0.4.0',
        disciplineId: context.disciplineId,
        id: context.rulesetId,
      },
    );

    expect(parseStoredWorkbenchState(stored, context)?.routines['pommel-horse']).toHaveLength(9);
  });
});

function workbenchState(): WorkbenchState {
  return {
    apparatus: 'parallel-bars',
    nextOccurrenceNumber: 2,
    relationships: {
      ...emptyRelationships,
      'parallel-bars': [
        {
          connectionId: 'test-connection',
          kind: 'connection',
          occurrenceIds: ['routine-element-7', 'routine-element-8'],
        },
      ],
    },
    routines: {
      ...emptyRoutines,
      'parallel-bars': [
        { elementId: parallelBarsElement.id, occurrenceId: 'routine-element-7' },
        { elementId: secondParallelBarsElement.id, occurrenceId: 'routine-element-8' },
      ],
    },
    stuckByApparatus: { ...emptyLandings, vault: true },
    themeMode: 'dark',
    vaultId: vaultElement.id,
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
