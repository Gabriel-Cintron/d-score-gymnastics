import {
  DIFFICULTY_AWARD_COMPONENTS,
  ELEMENT_ROUTINE_APPARATUS_IDS,
  isExplanationCode,
  type ExplanationCode,
} from '@d-score-gymnastics/scoring';
import { z } from 'zod';

import { elementIdSchema, rulesDataIdSchema } from './schema';

export const KERNEL_CREDIT_ALL_EVALUATOR_ID = 'foundation.credit-all-elements' as const;

const scorePointsSchema = z
  .number()
  .nonnegative()
  .refine(
    (value) => Number.isSafeInteger(value * 10),
    'Expected scores must use increments of 0.1.',
  );

const occurrenceIdSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use a lowercase occurrence ID with words separated by hyphens.',
  );

const explanationCodeSchema = z
  .string()
  .refine(isExplanationCode, 'Use a stable code such as element.counted-as-entered.')
  .transform((value) => value as ExplanationCode);

const explanationParametersSchema = z.record(
  z.string(),
  z.union([z.boolean(), z.number(), z.string()]),
);

const expectedElementDecisionSchema = z
  .object({
    occurrenceId: occurrenceIdSchema,
    elementId: elementIdSchema,
    status: z.enum(['counted', 'excluded']),
    creditedDifficulty: scorePointsSchema,
    reason: explanationCodeSchema,
    reasonParameters: explanationParametersSchema,
  })
  .strict();

const expectedAwardSchema = z
  .object({
    component: z.enum(DIFFICULTY_AWARD_COMPONENTS),
    occurrenceIds: z.array(occurrenceIdSchema),
    value: scorePointsSchema,
    reason: explanationCodeSchema,
    reasonParameters: explanationParametersSchema,
  })
  .strict();

const expectedWarningSchema = z
  .object({
    code: explanationCodeSchema,
    occurrenceIds: z.array(occurrenceIdSchema),
    parameters: explanationParametersSchema,
  })
  .strict();

const routineRelationshipSchema = z.discriminatedUnion('kind', [
  z
    .object({
      connectionId: occurrenceIdSchema,
      kind: z.literal('connection'),
      occurrenceIds: z.tuple([occurrenceIdSchema, occurrenceIdSchema]),
    })
    .strict(),
  z
    .object({
      kind: z.literal('sequence'),
      occurrenceIds: z
        .array(occurrenceIdSchema)
        .min(2)
        .transform((value) => value as [string, string, ...string[]]),
      sequenceId: occurrenceIdSchema,
      sequenceType: rulesDataIdSchema,
    })
    .strict(),
]);

const elementScoringFixtureSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.enum(['kernel', 'fig-element-counting', 'fig-apparatus']),
    id: rulesDataIdSchema,
    description: z.string().trim().min(1),
    rulesetId: rulesDataIdSchema,
    evaluatorId: explanationCodeSchema,
    routine: z
      .object({
        apparatus: z.enum(ELEMENT_ROUTINE_APPARATUS_IDS),
        occurrences: z
          .array(
            z
              .object({
                occurrenceId: occurrenceIdSchema,
                elementId: elementIdSchema,
                qualifiers: z.array(rulesDataIdSchema).optional(),
              })
              .strict(),
          )
          .min(1),
        landing: z
          .object({
            occurrenceId: occurrenceIdSchema,
            outcome: z.enum(['not-stuck', 'stuck']),
          })
          .strict()
          .optional(),
        relationships: z.array(routineRelationshipSchema).optional(),
      })
      .strict(),
    expected: z
      .object({
        total: scorePointsSchema,
        breakdown: z
          .object({
            elementDifficulty: scorePointsSchema,
            elementGroup: scorePointsSchema,
            connection: scorePointsSchema,
            bonus: scorePointsSchema,
          })
          .strict(),
        elementDecisions: z.array(expectedElementDecisionSchema),
        awards: z.array(expectedAwardSchema),
        warnings: z.array(expectedWarningSchema),
      })
      .strict(),
  })
  .strict();

const vaultExpectedAwardSchema = z
  .object({
    reason: explanationCodeSchema,
    reasonParameters: explanationParametersSchema,
    value: scorePointsSchema,
  })
  .strict();

const vaultExpectedWarningSchema = z
  .object({
    code: explanationCodeSchema,
    parameters: explanationParametersSchema,
  })
  .strict();

const vaultScoringFixtureSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('fig-vault'),
    id: rulesDataIdSchema,
    description: z.string().trim().min(1),
    rulesetId: rulesDataIdSchema,
    evaluatorId: explanationCodeSchema,
    routine: z
      .object({
        apparatus: z.literal('vault'),
        landing: z.enum(['not-stuck', 'stuck']).optional(),
        vaultId: elementIdSchema,
      })
      .strict(),
    expected: z
      .object({
        awards: z.array(vaultExpectedAwardSchema),
        bonus: scorePointsSchema,
        total: scorePointsSchema,
        vaultDifficulty: scorePointsSchema,
        vaultId: elementIdSchema,
        warnings: z.array(vaultExpectedWarningSchema),
      })
      .strict(),
  })
  .strict();

export const scoringFixtureSchema = z.union([
  elementScoringFixtureSchema,
  vaultScoringFixtureSchema,
]);

export type ScoringFixture = z.infer<typeof scoringFixtureSchema>;
export type ElementScoringFixture = z.infer<typeof elementScoringFixtureSchema>;
export type VaultScoringFixture = z.infer<typeof vaultScoringFixtureSchema>;
