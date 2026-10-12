/** Public entry point for validated rulesets and generated catalog data. */
export { apparatusRulesFileSchema } from './apparatus-rules-schema';
export type {
  ApparatusRulesFile,
  FloorRules,
  HorizontalBarRules,
  ParallelBarsRules,
  PommelHorseRules,
  RingsRules,
  SpecialLimit,
} from './apparatus-rules-schema';
export { compileRuleset } from './compile';
export type {
  CompiledApparatusRules,
  CompiledFloorRules,
  CompiledHorizontalBarRules,
  CompiledParallelBarsRules,
  CompiledPommelHorseRules,
  CompiledRingsRules,
  CompiledVaultRules,
} from './compile-apparatus-rules';
export type {
  CompiledDifficulty,
  CompiledElement,
  CompiledElementGroupRequirements,
  CompiledRuleset,
  CompiledSharedRules,
} from './compile';
export {
  createFigElementCountingEvaluator,
  figPommelSequenceComponentKind,
  FIG_ELEMENT_COUNTING_EVALUATOR_ID,
  isFigConnectionEligible,
  isFigPommelSequenceComponent,
  previewFigPommelSequence,
} from './fig/element-counting';
export type {
  FigPommelSequenceComponentKind,
  FigPommelSequencePreview,
} from './fig/element-counting';
export { createFigVaultEvaluator, FIG_VAULT_EVALUATOR_ID } from './fig/vault';
export { createFigRulesetRuntime } from './runtime';
export type { FigRulesetRuntime } from './runtime';
export {
  apparatusIdSchema,
  difficultyLetterSchema,
  elementIdSchema,
  elementFileSchema,
  letterDifficultyElementSchema,
  rulesDataIdSchema,
  rulesetManifestSchema,
  vaultElementSchema,
} from './schema';
export type { ElementFile, LetterDifficultyElement, RulesetManifest, VaultElement } from './schema';
export {
  elementCountingPolicySchema,
  elementGroupRequirementsSchema,
  sharedRulesSchema,
} from './rules-schema';
export type { ElementCountingPolicy, ElementGroupRequirements, SharedRules } from './rules-schema';
export { KERNEL_CREDIT_ALL_EVALUATOR_ID, scoringFixtureSchema } from './scoring-fixture';
export type { ElementScoringFixture, ScoringFixture, VaultScoringFixture } from './scoring-fixture';
export {
  formatValidationIssues,
  RulesDataValidationError,
  schemaValidationIssues,
  validateRulesetSource,
} from './validation';
export type {
  DataPathSegment,
  ApparatusRulesFileSource,
  ElementFileSource,
  RulesetSource,
  ScoringFixtureSource,
  ValidationIssue,
} from './validation';
