import type { ElementId } from '@d-score-gymnastics/scoring';
import type { CompiledElement, ScoringProfileRef } from '@d-score-gymnastics/rulesets';

import {
  parseStoredAppPreferences,
  type AppPreferences,
  type StoredAppPreferences,
} from './app-preferences';
import {
  parseStoredRoutineLibrary,
  type RoutineLibrary,
  type StoredRoutineLibrary,
} from './routine-library';
import type { WorkbenchState } from './types';
import type { CurrentDisciplineId } from './product';
import { parseStoredWorkbenchState, type StoredWorkbenchState } from './workbench-state';

export const BACKUP_FORMAT = 'd-score-gymnastics-backup';
export const BACKUP_SCHEMA_VERSION = 3;
export const MAX_BACKUP_CHARACTERS = 2_000_000;
const LEGACY_BACKUP_FORMAT = 'easyscore-backup';
const LEGACY_BACKUP_SCHEMA_VERSION = 1;

export interface DScoreGymnasticsBackupDocument {
  readonly disciplineId: CurrentDisciplineId;
  readonly exportedAt: string;
  readonly format: typeof BACKUP_FORMAT;
  readonly library: StoredRoutineLibrary;
  readonly preferences: StoredAppPreferences;
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  readonly workbench: StoredWorkbenchState;
}

export interface RestoredDScoreGymnasticsBackup {
  readonly library: RoutineLibrary;
  readonly preferences: AppPreferences;
  readonly workbench: WorkbenchState;
}

interface BackupContext {
  readonly disciplineId: string;
  readonly elementById: ReadonlyMap<ElementId, CompiledElement>;
  readonly rulesetId: string;
  readonly supportsProfile?: (ref: ScoringProfileRef) => boolean;
}

export function serializeDScoreGymnasticsBackup(document: DScoreGymnasticsBackupDocument): string {
  return JSON.stringify(document, undefined, 2);
}

export function parseDScoreGymnasticsBackup(
  text: string,
  context: BackupContext,
): RestoredDScoreGymnasticsBackup | undefined {
  if (text.length === 0 || text.length > MAX_BACKUP_CHARACTERS) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  const record = objectRecord(value);
  const isCurrentBackup =
    record?.format === BACKUP_FORMAT &&
    (record.schemaVersion === BACKUP_SCHEMA_VERSION || record.schemaVersion === 2) &&
    record.disciplineId === context.disciplineId;
  const isLegacyBackup =
    record?.format === LEGACY_BACKUP_FORMAT &&
    record.schemaVersion === LEGACY_BACKUP_SCHEMA_VERSION;
  if ((!isCurrentBackup && !isLegacyBackup) || !validTimestamp(record?.exportedAt)) {
    return undefined;
  }
  const workbench = parseStoredWorkbenchState(record.workbench, context);
  const library = parseStoredRoutineLibrary(record.library, context);
  const preferences = parseStoredAppPreferences(record.preferences);
  if (workbench === undefined || library === undefined || preferences === undefined) {
    return undefined;
  }
  const supportsProfile = context.supportsProfile;
  if (supportsProfile) {
    const states = [workbench, ...library.items.map((item) => item.state)];
    if (
      states.some((state) =>
        [state.defaultScoringProfile, ...Object.values(state.routineScoringOverrides)].some(
          (ref) => !supportsProfile(ref),
        ),
      )
    )
      return undefined;
  }
  return { library, preferences, workbench };
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
