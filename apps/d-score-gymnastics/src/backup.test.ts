import { describe, expect, it } from 'vitest';

import { createStoredAppPreferences } from './app-preferences';
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  MAX_BACKUP_CHARACTERS,
  parseDScoreGymnasticsBackup,
  serializeDScoreGymnasticsBackup,
  type DScoreGymnasticsBackupDocument,
} from './backup';
import {
  blankAllAroundState,
  createStoredRoutineLibrary,
  type RoutineLibrary,
  type SavedAllAround,
} from './routine-library';
import { createStoredWorkbenchState } from './workbench-state';

const timestamp = '2026-08-14T12:00:00.000Z';
const ruleset = {
  dataRevision: '2026-08-10',
  dataVersion: '0.4.0',
  disciplineId: 'mens-artistic-gymnastics' as const,
  id: 'fig-mag-2025-2028',
};
const context = {
  disciplineId: ruleset.disciplineId,
  elementById: new Map(),
  rulesetId: ruleset.id,
};

describe('D-Score Gymnastics backup documents', () => {
  it('round-trips the workbench, library, and app preferences', () => {
    const state = blankAllAroundState('dark');
    const allAround: SavedAllAround = {
      createdAt: timestamp,
      id: 'all-around-1',
      kind: 'all-around',
      name: 'Senior AA',
      state,
      updatedAt: timestamp,
    };
    const library: RoutineLibrary = {
      activeAllAroundId: allAround.id,
      items: [allAround],
    };
    const document = backupDocument(state, library, true);

    const parsed = parseDScoreGymnasticsBackup(serializeDScoreGymnasticsBackup(document), context);

    expect(parsed).toEqual({
      library,
      preferences: { onboardingComplete: true },
      workbench: state,
    });
  });

  it('imports a legacy EasyScore version 1 backup', () => {
    const state = blankAllAroundState('light');
    const current = backupDocument(state, { items: [] }, false);
    const legacyRuleset = {
      dataRevision: ruleset.dataRevision,
      dataVersion: ruleset.dataVersion,
      id: ruleset.id,
    };
    const legacy = {
      ...current,
      format: 'easyscore-backup',
      library: {
        ...current.library,
        ruleset: legacyRuleset,
        schemaVersion: 2,
      },
      schemaVersion: 1,
      workbench: {
        ...current.workbench,
        ruleset: legacyRuleset,
        schemaVersion: 1,
      },
    };
    delete (legacy as { disciplineId?: string }).disciplineId;

    expect(parseDScoreGymnasticsBackup(JSON.stringify(legacy), context)).toEqual({
      library: { items: [] },
      preferences: { onboardingComplete: false },
      workbench: state,
    });
  });

  it('rejects another discipline or ruleset, malformed JSON, and oversized input', () => {
    const document = backupDocument(blankAllAroundState('light'), { items: [] }, false);
    const text = serializeDScoreGymnasticsBackup(document);

    expect(
      parseDScoreGymnasticsBackup(text, { ...context, disciplineId: 'womens-artistic-gymnastics' }),
    ).toBeUndefined();
    expect(
      parseDScoreGymnasticsBackup(text, { ...context, rulesetId: 'another-ruleset' }),
    ).toBeUndefined();
    expect(parseDScoreGymnasticsBackup('{not json', context)).toBeUndefined();
    expect(
      parseDScoreGymnasticsBackup('x'.repeat(MAX_BACKUP_CHARACTERS + 1), context),
    ).toBeUndefined();
  });
});

function backupDocument(
  state: ReturnType<typeof blankAllAroundState>,
  library: RoutineLibrary,
  onboardingComplete: boolean,
): DScoreGymnasticsBackupDocument {
  return {
    disciplineId: ruleset.disciplineId,
    exportedAt: timestamp,
    format: BACKUP_FORMAT,
    library: createStoredRoutineLibrary(library, ruleset),
    preferences: createStoredAppPreferences({ onboardingComplete }),
    schemaVersion: BACKUP_SCHEMA_VERSION,
    workbench: createStoredWorkbenchState(state, ruleset),
  };
}
