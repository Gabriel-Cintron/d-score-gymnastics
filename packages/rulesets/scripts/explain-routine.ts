import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  calculateDifficulty,
  calculateVaultDifficulty,
  indexScorableElements,
  scoreTenthsToPoints,
  type ElementRoutine,
  type VaultRoutine,
} from '@d-score-gymnastics/scoring';
import { parse, stringify } from 'yaml';

import {
  compileRuleset,
  createFigElementCountingEvaluator,
  createFigVaultEvaluator,
} from '../src/index';
import { loadRulesets } from './lib/load-rulesets';

const inputFile = process.argv[2];
if (inputFile === undefined) {
  throw new Error('Pass a YAML file containing a routine as the first argument.');
}

const dataDirectory = fileURLToPath(new URL('../data/', import.meta.url));
const loaded = await loadRulesets(dataDirectory);
if (loaded.issues.length > 0 || loaded.sources[0] === undefined) {
  throw new Error('Rules data must validate before a routine can be explained.');
}
const compiled = compileRuleset(loaded.sources[0]);
const elementLookup = indexScorableElements(compiled.elements);
const input = parse(await readFile(resolve(inputFile), 'utf8')) as { readonly routine?: unknown };
if (input.routine === undefined || typeof input.routine !== 'object') {
  throw new Error('Input YAML must contain a routine mapping.');
}

const routine = input.routine as { readonly apparatus?: unknown };
if (routine.apparatus === 'vault') {
  const outcome = calculateVaultDifficulty({
    elementLookup,
    evaluator: createFigVaultEvaluator(compiled.sharedRules),
    routine: input.routine as VaultRoutine,
  });
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.issues));
  process.stdout.write(
    stringify({
      awards: outcome.result.awards.map((award) => ({
        ...award,
        value: scoreTenthsToPoints(award.value),
      })),
      bonus: scoreTenthsToPoints(outcome.result.bonus),
      total: scoreTenthsToPoints(outcome.result.total),
      vaultDifficulty: scoreTenthsToPoints(outcome.result.vaultDifficulty),
      vaultId: outcome.result.vaultId,
      warnings: outcome.result.warnings,
    }),
  );
} else {
  const elementRoutine = input.routine as ElementRoutine;
  const evaluator = createFigElementCountingEvaluator(
    compiled.sharedRules,
    elementRoutine.apparatus,
    compiled.apparatusRules[elementRoutine.apparatus],
  );
  const outcome = calculateDifficulty({ elementLookup, evaluator, routine: elementRoutine });
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.issues));
  process.stdout.write(
    stringify({
      awards: outcome.result.awards.map((award) => ({
        ...award,
        value: scoreTenthsToPoints(award.value),
      })),
      breakdown: {
        bonus: scoreTenthsToPoints(outcome.result.breakdown.bonus),
        connection: scoreTenthsToPoints(outcome.result.breakdown.connection),
        elementDifficulty: scoreTenthsToPoints(outcome.result.breakdown.elementDifficulty),
        elementGroup: scoreTenthsToPoints(outcome.result.breakdown.elementGroup),
      },
      elementDecisions: outcome.result.elementDecisions.map((decision) => ({
        ...decision,
        creditedDifficulty: scoreTenthsToPoints(decision.creditedDifficulty),
      })),
      total: scoreTenthsToPoints(outcome.result.total),
      warnings: outcome.result.warnings,
    }),
  );
}
