import { describe, expect, it } from 'vitest';
import { APPARATUS_IDS, type ElementId } from '@d-score-gymnastics/scoring';
import { FIG_PROFILE, profileKey } from '@d-score-gymnastics/rulesets';
import {
  defaultProfileSelection,
  effectiveProfile,
  setRoutineProfile,
  setAllAroundProfile,
  parseProfileSelection,
  profileSelectionKey,
} from './scoring-profile-state';
import {
  blankAllAroundState,
  captureRoutineState,
  applyLibraryItem,
  routineContentKey,
  createStoredRoutineLibrary,
  parseStoredRoutineLibrary,
  type SavedRoutine,
} from './routine-library';
import { createStoredWorkbenchState, parseStoredWorkbenchState } from './workbench-state';
import { recoverWorkspace } from './workspace-recovery';
import { figRuleset, catalogElementById } from './ruleset';
import { BACKUP_FORMAT, BACKUP_SCHEMA_VERSION, parseDScoreGymnasticsBackup } from './backup';
import { createStoredAppPreferences } from './app-preferences';
const other = { id: 'test-profile', revision: '1.0.0' },
  newer = { ...other, revision: '2.0.0' };
const identity = {
  id: figRuleset.id,
  dataVersion: figRuleset.dataVersion,
  dataRevision: figRuleset.dataRevision,
  disciplineId: 'mens-artistic-gymnastics' as const,
};
const context = {
  disciplineId: identity.disciplineId,
  elementById: catalogElementById,
  rulesetId: identity.id,
};
function withFloor() {
  const state = blankAllAroundState('light');
  const e = figRuleset.elements.find((e) => e.apparatus === 'floor-exercise');
  if (!e) throw new Error('Missing fixture');
  return {
    ...state,
    routines: {
      ...state.routines,
      'floor-exercise': [{ elementId: e.id, occurrenceId: 'routine-element-1' }],
    },
    nextOccurrenceNumber: 2,
  };
}
describe('workspace scoring profile selection', () => {
  it('defaults all events to FIG and overrides only the chosen event including Vault', () => {
    const original = defaultProfileSelection();
    let state = setRoutineProfile(original, 'still-rings', other);
    state = setRoutineProfile(state, 'vault', newer);
    expect(effectiveProfile(state, 'floor-exercise')).toEqual(FIG_PROFILE);
    expect(effectiveProfile(state, 'still-rings')).toEqual(other);
    expect(effectiveProfile(state, 'vault')).toEqual(newer);
    expect(original.routineScoringOverrides).toEqual({});
    expect(
      setRoutineProfile(state, 'still-rings', undefined).routineScoringOverrides['still-rings'],
    ).toBeUndefined();
    expect(
      setRoutineProfile(state, 'vault', FIG_PROFILE).routineScoringOverrides.vault,
    ).toBeUndefined();
  });
  it('bulk changes reset every override including empty events and reapplying the same default', () => {
    let state = defaultProfileSelection();
    for (const a of APPARATUS_IDS) state = setRoutineProfile(state, a, other);
    const reset = setAllAroundProfile(state, FIG_PROFILE);
    expect(reset.routineScoringOverrides).toEqual({});
    for (const a of APPARATUS_IDS) expect(effectiveProfile(reset, a)).toEqual(FIG_PROFILE);
    expect(setAllAroundProfile(state, newer).defaultScoringProfile).toEqual(newer);
  });
  it('loads an individual saved profile only into its event, independently of its former parent', () => {
    const source = setRoutineProfile(
      setAllAroundProfile(withFloor(), newer),
      'floor-exercise',
      other,
    );
    const captured = captureRoutineState(source, 'floor-exercise');
    expect(captured.defaultScoringProfile).toEqual(other);
    expect(captured.routineScoringOverrides).toEqual({});
    const item: SavedRoutine = {
      id: 'routine',
      kind: 'routine',
      apparatus: 'floor-exercise',
      name: 'A',
      state: captured,
      createdAt: '2026-10-15T12:00:00Z',
      updatedAt: '2026-10-15T12:00:00Z',
    };
    const destination = setRoutineProfile(blankAllAroundState('dark'), 'vault', newer);
    const loaded = applyLibraryItem(destination, item, 20);
    expect(loaded.defaultScoringProfile).toEqual(FIG_PROFILE);
    expect(effectiveProfile(loaded, 'floor-exercise')).toEqual(other);
    expect(effectiveProfile(loaded, 'vault')).toEqual(newer);
    expect(loaded.themeMode).toBe('dark');
    expect(loaded.routines['floor-exercise'][0]?.occurrenceId).toBe('routine-element-20');
    expect(item.state).toEqual(captured);
    expect(source.defaultScoringProfile).toEqual(newer);
  });
  it('detects profile-only content differences and recovers disagreements even on empty events', () => {
    const original = blankAllAroundState('light'),
      changed = setRoutineProfile(original, 'vault', other);
    expect(routineContentKey(original, 'vault')).not.toBe(routineContentKey(changed, 'vault'));
    expect(profileSelectionKey(original)).not.toBe(
      profileSelectionKey(setAllAroundProfile(original, other)),
    );
    const item = {
      id: 'a',
      kind: 'all-around' as const,
      name: 'A',
      state: original,
      createdAt: '2026-10-15T12:00:00Z',
      updatedAt: '2026-10-15T12:00:00Z',
    };
    const recovered = recoverWorkspace(
      { activeAllAroundId: 'a', items: [item] },
      changed,
      original,
      'recovered',
      '2026-10-15T13:00:00Z',
    );
    expect(recovered.library.items).toHaveLength(2);
    expect(effectiveProfile(recovered.workbench, 'vault')).toEqual(other);
  });
  it('preserves unknown well-formed revisions in local storage and rejects malformed current metadata', () => {
    const state = setRoutineProfile(withFloor(), 'floor-exercise', newer),
      stored = createStoredWorkbenchState(state, identity);
    expect(parseStoredWorkbenchState(stored, context)).toEqual(state);
    expect(
      parseStoredWorkbenchState(
        { ...stored, defaultScoringProfile: { id: '', revision: '1' } },
        context,
      ),
    ).toBeUndefined();
    expect(
      parseProfileSelection(
        { defaultScoringProfile: FIG_PROFILE, routineScoringOverrides: { beam: other } },
        false,
      ),
    ).toBeUndefined();
  });
  it('migrates version 2 workbench/version 3 library and version 2 backups to FIG', () => {
    const state = withFloor(),
      wb = { ...createStoredWorkbenchState(state, identity), schemaVersion: 2 };
    const old = { ...wb } as Record<string, unknown>;
    delete old.defaultScoringProfile;
    delete old.routineScoringOverrides;
    const item = {
      id: 'a',
      kind: 'all-around' as const,
      name: 'A',
      state: old,
      createdAt: '2026-10-15T12:00:00Z',
      updatedAt: '2026-10-15T12:00:00Z',
    };
    const library = { ruleset: identity, schemaVersion: 3, activeAllAroundId: 'a', items: [item] };
    expect(parseStoredWorkbenchState(old, context)?.defaultScoringProfile).toEqual(FIG_PROFILE);
    expect(
      parseStoredRoutineLibrary(library, context)?.items[0]?.state.defaultScoringProfile,
    ).toEqual(FIG_PROFILE);
    const backup = {
      format: BACKUP_FORMAT,
      schemaVersion: 2,
      disciplineId: identity.disciplineId,
      exportedAt: '2026-10-15T12:00:00Z',
      workbench: old,
      library,
      preferences: createStoredAppPreferences({ onboardingComplete: true }),
    };
    expect(
      parseDScoreGymnasticsBackup(JSON.stringify(backup), context)?.workbench.defaultScoringProfile,
    ).toEqual(FIG_PROFILE);
  });
  it('round-trips mixed metadata and rejects unsupported backup revisions before replacement', () => {
    const state = setRoutineProfile(withFloor(), 'vault', newer);
    const backup = {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      disciplineId: identity.disciplineId,
      exportedAt: '2026-10-15T12:00:00Z',
      workbench: createStoredWorkbenchState(state, identity),
      library: createStoredRoutineLibrary({ items: [] }, identity),
      preferences: createStoredAppPreferences({ onboardingComplete: true }),
    };
    expect(parseDScoreGymnasticsBackup(JSON.stringify(backup), context)?.workbench).toEqual(state);
    expect(
      parseDScoreGymnasticsBackup(JSON.stringify(backup), {
        ...context,
        supportsProfile: (ref) => profileKey(ref) === profileKey(FIG_PROFILE),
      }),
    ).toBeUndefined();
    expect(state.routines['floor-exercise'][0]?.elementId as ElementId).toBeDefined();
  });
});
