import { APPARATUS_IDS, ELEMENT_ROLE_IDS, type ElementId } from '@d-score-gymnastics/scoring';
import { z } from 'zod';

export const rulesDataIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens.');

export const elementIdSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z]{2}:[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use an apparatus prefix and lowercase identifier, such as pb:mag-0001.',
  )
  .transform((value) => value as ElementId);

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date in YYYY-MM-DD form.');

const pointsSchema = z
  .number()
  .positive()
  .refine((value) => Number.isInteger(value * 10), 'Difficulty values must use increments of 0.1.');

export const apparatusIdSchema = z.enum(APPARATUS_IDS);

export const difficultyLetterSchema = z
  .string()
  .regex(/^[A-Z]$/, 'Use one uppercase difficulty letter.');

const sourceDocumentSchema = z
  .object({
    id: rulesDataIdSchema,
    title: z.string().trim().min(1),
    url: z.string().url(),
    publicationDate: isoDateSchema.optional(),
    revision: z.string().trim().min(1).optional(),
  })
  .strict();

export const rulesetManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: rulesDataIdSchema,
    name: z.string().trim().min(1),
    discipline: z.literal('mens-artistic-gymnastics'),
    authority: z
      .object({
        name: z.string().trim().min(1),
        url: z.string().url(),
      })
      .strict(),
    authoritativeRulesUrl: z.string().url(),
    catalogWording: z
      .object({
        profile: z.enum(['independent-public', 'private-reference']),
        revision: isoDateSchema,
      })
      .strict(),
    cycle: z.string().regex(/^\d{4}-\d{4}$/, 'Use a four-year cycle such as 2025-2028.'),
    dataVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'Use a semantic data version such as 0.1.0.'),
    dataRevision: isoDateSchema,
    status: z.enum(['draft', 'complete']),
    apparatus: z.array(apparatusIdSchema).length(APPARATUS_IDS.length),
    catalogCoverage: z
      .object({
        expectedElements: z.record(apparatusIdSchema, z.number().int().positive()),
        officialPublicationCutoff: isoDateSchema,
      })
      .strict(),
    difficultyScale: z
      .record(difficultyLetterSchema, pointsSchema)
      .refine((scale) => Object.keys(scale).length > 0, 'Define at least one difficulty value.'),
    sources: z.array(sourceDocumentSchema).min(1),
  })
  .strict();

const elementCodeSchema = z
  .object({
    group: z.number().int().min(1).max(9),
    number: z.union([z.number().int().min(1).max(9999), rulesDataIdSchema]),
  })
  .strict();

const elementSourceSchema = z
  .object({
    documentId: rulesDataIdSchema,
    page: z.number().int().positive(),
  })
  .strict();

const baseElementShape = {
  id: elementIdSchema,
  code: elementCodeSchema,
  name: z.string().trim().min(1),
  aliases: z.array(z.string().trim().min(1)),
  families: z.array(rulesDataIdSchema).default([]),
  roles: z.array(z.enum(ELEMENT_ROLE_IDS)),
  traits: z.array(rulesDataIdSchema).default([]),
  source: elementSourceSchema,
};

export const letterDifficultyElementSchema = z
  .object({
    ...baseElementShape,
    difficulty: difficultyLetterSchema,
  })
  .strict();

export const vaultElementSchema = z
  .object({
    ...baseElementShape,
    difficulty: pointsSchema,
  })
  .strict();

const letterDifficultyApparatusSchema = z.enum([
  'floor-exercise',
  'pommel-horse',
  'still-rings',
  'parallel-bars',
  'horizontal-bar',
]);

const letterDifficultyElementFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    apparatus: letterDifficultyApparatusSchema,
    elements: z.array(letterDifficultyElementSchema).min(1),
  })
  .strict();

const vaultElementFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    apparatus: z.literal('vault'),
    elements: z.array(vaultElementSchema).min(1),
  })
  .strict();

export const elementFileSchema = z.union([
  letterDifficultyElementFileSchema,
  vaultElementFileSchema,
]);

export type ElementFile = z.infer<typeof elementFileSchema>;
export type LetterDifficultyElement = z.infer<typeof letterDifficultyElementSchema>;
export type RulesetManifest = z.infer<typeof rulesetManifestSchema>;
export type VaultElement = z.infer<typeof vaultElementSchema>;
