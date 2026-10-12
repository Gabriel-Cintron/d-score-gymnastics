import compiledRulesetData from '@d-score-gymnastics/rulesets/compiled/fig-mag-2025-2028';
import { createFigRulesetRuntime, type CompiledRuleset } from '@d-score-gymnastics/rulesets';

export const figRuleset = compiledRulesetData as unknown as CompiledRuleset;
export const figRuntime = createFigRulesetRuntime(figRuleset);
