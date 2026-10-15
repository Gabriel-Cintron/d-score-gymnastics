import { APPARATUS_IDS, type ApparatusId } from '@d-score-gymnastics/scoring';
import {
  FIG_PROFILE,
  parseProfileRef,
  profileKey,
  sameProfile,
  type ScoringProfileRef,
} from '@d-score-gymnastics/rulesets';
export interface ProfileSelection {
  readonly defaultScoringProfile: ScoringProfileRef;
  readonly routineScoringOverrides: Partial<Record<ApparatusId, ScoringProfileRef>>;
}
export function defaultProfileSelection(): ProfileSelection {
  return { defaultScoringProfile: { ...FIG_PROFILE }, routineScoringOverrides: {} };
}
export function effectiveProfile(
  state: ProfileSelection,
  apparatus: ApparatusId,
): ScoringProfileRef {
  return state.routineScoringOverrides[apparatus] ?? state.defaultScoringProfile;
}
export function setRoutineProfile<T extends ProfileSelection>(
  state: T,
  apparatus: ApparatusId,
  profile: ScoringProfileRef | undefined,
): T {
  const overrides = Object.fromEntries(
    Object.entries(state.routineScoringOverrides).filter(([key]) => key !== apparatus),
  );
  if (profile !== undefined && !sameProfile(profile, state.defaultScoringProfile))
    overrides[apparatus] = { ...profile };
  return { ...state, routineScoringOverrides: overrides };
}
export function setAllAroundProfile<T extends ProfileSelection>(
  state: T,
  profile: ScoringProfileRef,
): T {
  return { ...state, defaultScoringProfile: { ...profile }, routineScoringOverrides: {} };
}
export function cloneProfileSelection(state: ProfileSelection): ProfileSelection {
  return {
    defaultScoringProfile: { ...state.defaultScoringProfile },
    routineScoringOverrides: Object.fromEntries(
      Object.entries(state.routineScoringOverrides).map(([a, p]) => [a, { ...p }]),
    ),
  };
}
export function profileSelectionKey(state: ProfileSelection): string {
  return JSON.stringify([
    profileKey(state.defaultScoringProfile),
    APPARATUS_IDS.map((a) =>
      state.routineScoringOverrides[a] ? profileKey(state.routineScoringOverrides[a]) : null,
    ),
  ]);
}
export function parseProfileSelection(
  record: Record<string, unknown>,
  legacy: boolean,
): ProfileSelection | undefined {
  if (legacy) return defaultProfileSelection();
  const defaultScoringProfile = parseProfileRef(record.defaultScoringProfile),
    raw = record.routineScoringOverrides;
  if (!defaultScoringProfile || typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return undefined;
  let result: ProfileSelection = { defaultScoringProfile, routineScoringOverrides: {} };
  for (const [key, value] of Object.entries(raw)) {
    if (!APPARATUS_IDS.includes(key as ApparatusId)) return undefined;
    const ref = parseProfileRef(value);
    if (!ref) return undefined;
    result = setRoutineProfile(result, key as ApparatusId, ref);
  }
  return result;
}
