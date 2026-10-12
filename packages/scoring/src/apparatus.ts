/** Stable apparatus identifiers used in routines, rules data, and persisted records. */
export const APPARATUS_IDS = [
  'floor-exercise',
  'pommel-horse',
  'still-rings',
  'vault',
  'parallel-bars',
  'horizontal-bar',
] as const;

export type ApparatusId = (typeof APPARATUS_IDS)[number];

/** FIG abbreviations are used only as the stable prefix of an element ID. */
export const APPARATUS_CODE_BY_ID = {
  'floor-exercise': 'fx',
  'pommel-horse': 'ph',
  'still-rings': 'sr',
  vault: 'vt',
  'parallel-bars': 'pb',
  'horizontal-bar': 'hb',
} as const satisfies Record<ApparatusId, string>;

export type ApparatusCode = (typeof APPARATUS_CODE_BY_ID)[ApparatusId];
export type ElementId = `${ApparatusCode}:${string}`;

const apparatusIds: ReadonlySet<string> = new Set(APPARATUS_IDS);

export function isApparatusId(value: string): value is ApparatusId {
  return apparatusIds.has(value);
}
