/** Public entry point for the platform-independent scoring engine. */
export { APPARATUS_CODE_BY_ID, APPARATUS_IDS, isApparatusId } from './apparatus';
export type { ApparatusCode, ApparatusId, ElementId } from './apparatus';
export {
  calculateDifficulty,
  DIFFICULTY_AWARD_COMPONENTS,
  EvaluationContractError,
  isExplanationCode,
} from './calculation';
export type {
  CalculateDifficultyInput,
  CalculationIssue,
  CalculationIssueCode,
  DifficultyAward,
  DifficultyAwardComponent,
  DifficultyBreakdown,
  DifficultyCalculationOutcome,
  DifficultyResult,
  DifficultyWarning,
  ElementDecision,
  ExplanationCode,
  ExplanationParameters,
  RoutineEvaluationContext,
  RoutineEvaluationDraft,
  RoutineEvaluator,
} from './calculation';
export { ELEMENT_ROLE_IDS, ELEMENT_ROUTINE_APPARATUS_IDS, indexScorableElements } from './routine';
export type {
  ElementFamilyId,
  ElementRoleId,
  ElementRoutine,
  ElementRoutineApparatusId,
  ElementTraitId,
  ResolvedElementOccurrence,
  RoutineConnection,
  RoutineElementOccurrence,
  RoutineLanding,
  RoutineRelationship,
  RoutineSequence,
  ScorableElement,
  VaultRoutine,
} from './routine';
export {
  isScoreTenths,
  scoreTenths,
  scoreTenthsFromPoints,
  scoreTenthsToPoints,
  sumScoreTenths,
} from './score-tenths';
export type { ScoreTenths } from './score-tenths';
export { calculateVaultDifficulty } from './vault';
export type {
  CalculateVaultDifficultyInput,
  VaultCalculationIssue,
  VaultCalculationIssueCode,
  VaultDifficultyAward,
  VaultDifficultyCalculationOutcome,
  VaultDifficultyResult,
  VaultDifficultyWarning,
  VaultEvaluationContext,
  VaultEvaluationDraft,
  VaultEvaluator,
} from './vault';
