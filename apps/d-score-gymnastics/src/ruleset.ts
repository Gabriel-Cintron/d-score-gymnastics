import compiledRulesetData from '@d-score-gymnastics/rulesets/compiled/fig-mag-2025-2028';
import {
  createProfileRegistry,
  createFigRulesetRuntime,
  bundledProfileDefinitions,
  type ScoringProfileRef,
  type CompiledRuleset,
} from '@d-score-gymnastics/rulesets';
export const figRuleset = compiledRulesetData as unknown as CompiledRuleset;
export const figRuntime = createFigRulesetRuntime(figRuleset);
export const profileDefinitions = bundledProfileDefinitions(figRuleset);
export const profileRegistry = createProfileRegistry(figRuleset, profileDefinitions);
export const getProfileRuntime = (ref: ScoringProfileRef) => profileRegistry.getProfileRuntime(ref);
export const profileLabel = (ref: ScoringProfileRef) => profileRegistry.label(ref);
export const catalogElementById = new Map(profileRegistry.catalogElements.map((e) => [e.id, e]));
