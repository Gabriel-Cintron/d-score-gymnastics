import { z } from 'zod';

import { difficultyLetterSchema, rulesDataIdSchema } from './schema';

const pointsSchema = z
  .number()
  .positive()
  .refine((value) => Number.isSafeInteger(value * 10), 'Values must use increments of 0.1.');

const sourceReferencesSchema = z
  .array(
    z
      .object({
        documentId: rulesDataIdSchema,
        pages: z.array(z.number().int().positive()).min(1),
      })
      .strict(),
  )
  .min(1);

const specialLimitSchema = z
  .object({
    id: rulesDataIdSchema,
    includeDismount: z.boolean(),
    kind: z.enum(['family', 'trait']),
    maximum: z.number().int().positive(),
  })
  .strict();

const floorRulesSchema = z
  .object({
    apparatus: z.literal('floor-exercise'),
    balanceRequirementTrait: rulesDataIdSchema,
    connection: z
      .object({
        highPartnerMinimum: difficultyLetterSchema,
        highValue: pointsSchema,
        minimumFirstDifficulty: difficultyLetterSchema,
        minimumPartnerDifficulty: difficultyLetterSchema,
        standardValue: pointsSchema,
      })
      .strict(),
    dismountRequiredTrait: rulesDataIdSchema,
    schemaVersion: z.literal(1),
    sources: sourceReferencesSchema,
    specialLimits: z.array(specialLimitSchema),
  })
  .strict();

const pommelHorseRulesSchema = z
  .object({
    apparatus: z.literal('pommel-horse'),
    occurrenceQualifiers: z
      .object({
        russianLocation: z
          .object({
            options: z.array(rulesDataIdSchema).min(2),
            requiredTrait: rulesDataIdSchema,
          })
          .strict(),
      })
      .strict(),
    schemaVersion: z.literal(1),
    sequenceSeparatorTrait: rulesDataIdSchema,
    sequenceTypes: z
      .object({
        combined: rulesDataIdSchema,
        flop: rulesDataIdSchema,
      })
      .strict(),
    sources: sourceReferencesSchema,
    specialLimits: z.array(specialLimitSchema),
  })
  .strict();

const ringsRulesSchema = z
  .object({
    apparatus: z.literal('still-rings'),
    finalPositionFamilyPrefix: rulesDataIdSchema,
    maximumConsecutiveStrength: z.number().int().positive(),
    schemaVersion: z.literal(1),
    separator: z
      .object({
        excludedTraits: z.array(rulesDataIdSchema),
        group: z.number().int().positive(),
        minimumDifficulty: difficultyLetterSchema,
      })
      .strict(),
    sources: sourceReferencesSchema,
    strengthGroups: z.array(z.number().int().positive()).min(1),
    swingHandstandRequirementTrait: rulesDataIdSchema,
    upgradeConnection: z
      .object({
        increment: pointsSchema,
        sourceTrait: rulesDataIdSchema,
        targetTrait: rulesDataIdSchema,
      })
      .strict(),
  })
  .strict();

const parallelBarsRulesSchema = z
  .object({
    apparatus: z.literal('parallel-bars'),
    healyUpgrade: z
      .object({
        excludedSourceTrait: rulesDataIdSchema,
        incrementPerElement: pointsSchema,
        sourceTrait: rulesDataIdSchema,
        targetTrait: rulesDataIdSchema,
      })
      .strict(),
    schemaVersion: z.literal(1),
    sources: sourceReferencesSchema,
    specialLimits: z.array(specialLimitSchema),
  })
  .strict();

const horizontalBarRulesSchema = z
  .object({
    apparatus: z.literal('horizontal-bar'),
    connection: z
      .object({
        flightFlight: z.array(
          z
            .object({
              minimumFirst: difficultyLetterSchema,
              minimumSecond: difficultyLetterSchema,
              value: pointsSchema,
            })
            .strict(),
        ),
        flightWithNonFlight: z.array(
          z
            .object({
              minimumFlight: difficultyLetterSchema,
              minimumNonFlight: difficultyLetterSchema,
              value: pointsSchema,
            })
            .strict(),
        ),
      })
      .strict(),
    fifthFlight: z
      .object({
        connectedMinimumDifficulty: difficultyLetterSchema,
        group: z.number().int().positive(),
        maximumWhenQualified: z.number().int().positive(),
      })
      .strict(),
    schemaVersion: z.literal(1),
    sources: sourceReferencesSchema,
    specialLimits: z.array(specialLimitSchema),
  })
  .strict();

const vaultRulesSchema = z
  .object({
    apparatus: z.literal('vault'),
    schemaVersion: z.literal(1),
    sources: sourceReferencesSchema,
  })
  .strict();

export const apparatusRulesFileSchema = z.discriminatedUnion('apparatus', [
  floorRulesSchema,
  pommelHorseRulesSchema,
  ringsRulesSchema,
  vaultRulesSchema,
  parallelBarsRulesSchema,
  horizontalBarRulesSchema,
]);

export type ApparatusRulesFile = z.infer<typeof apparatusRulesFileSchema>;
export type FloorRules = z.infer<typeof floorRulesSchema>;
export type HorizontalBarRules = z.infer<typeof horizontalBarRulesSchema>;
export type ParallelBarsRules = z.infer<typeof parallelBarsRulesSchema>;
export type PommelHorseRules = z.infer<typeof pommelHorseRulesSchema>;
export type RingsRules = z.infer<typeof ringsRulesSchema>;
export type SpecialLimit = z.infer<typeof specialLimitSchema>;
