import { APPARATUS_IDS, ELEMENT_ROUTINE_APPARATUS_IDS } from '@d-score-gymnastics/scoring';
import { z } from 'zod';

import { difficultyLetterSchema, rulesDataIdSchema } from './schema';

const awardPointsSchema = z
  .number()
  .positive()
  .refine((value) => Number.isSafeInteger(value * 10), 'Award values must use increments of 0.1.');

const elementGroupIdSchema = z.number().int().positive();

export const elementCountingPolicySchema = z
  .object({
    regularElementSlots: z.number().int().nonnegative(),
    reservedDismountSlots: z.union([z.literal(0), z.literal(1)]),
    maximumPerElementGroup: z.number().int().positive(),
  })
  .strict();

export const elementGroupRequirementsSchema = z
  .object({
    regularGroups: z.record(
      z.enum(ELEMENT_ROUTINE_APPARATUS_IDS),
      z.array(elementGroupIdSchema).min(1),
    ),
    regularAwards: z
      .array(
        z
          .object({
            difficulties: z.array(difficultyLetterSchema).min(1),
            value: awardPointsSchema,
          })
          .strict(),
      )
      .min(1),
    minimumAwards: z.array(
      z
        .object({
          group: elementGroupIdSchema,
          value: awardPointsSchema,
        })
        .strict(),
    ),
    dismountAward: z
      .object({
        maximum: awardPointsSchema,
        mode: z.literal('element-difficulty'),
      })
      .strict(),
  })
  .strict();

export const sharedRulesSchema = z
  .object({
    schemaVersion: z.literal(1),
    sources: z
      .array(
        z
          .object({
            documentId: rulesDataIdSchema,
            pages: z.array(z.number().int().positive()).min(1),
          })
          .strict(),
      )
      .min(1),
    repetition: z
      .object({
        maximumCreditsPerCode: z.number().int().positive(),
      })
      .strict(),
    elementCounting: z.record(z.enum(ELEMENT_ROUTINE_APPARATUS_IDS), elementCountingPolicySchema),
    elementGroupRequirements: elementGroupRequirementsSchema,
    landingBonus: z
      .object({
        apparatus: z.array(z.enum(APPARATUS_IDS)).min(1),
        minimumDifficulty: difficultyLetterSchema,
        value: awardPointsSchema,
        vaultRequiredTrait: rulesDataIdSchema,
      })
      .strict(),
  })
  .strict();

export type ElementCountingPolicy = z.infer<typeof elementCountingPolicySchema>;
export type ElementGroupRequirements = z.infer<typeof elementGroupRequirementsSchema>;
export type SharedRules = z.infer<typeof sharedRulesSchema>;
