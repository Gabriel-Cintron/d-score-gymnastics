import {
  APPARATUS_IDS,
  scoreTenths,
  type ApparatusId,
  type ElementId,
  type ScoreTenths,
} from '@d-score-gymnastics/scoring';
import type { CompiledElement, CompiledRuleset, CompiledSharedRules } from './compile';
import type { CompiledApparatusRules } from './compile-apparatus-rules';
import { createFigRulesetRuntime, type FigRulesetRuntime } from './runtime';

export interface ScoringProfileRef {
  readonly id: string;
  readonly revision: string;
}
export const FIG_PROFILE: ScoringProfileRef = Object.freeze({
  id: 'fig-mag-2025-2028',
  revision: '1.0.0',
});
export interface ProfileSource {
  readonly title: string;
  readonly url: string;
  readonly locator: string;
}
export interface ElementOverride {
  readonly elementId: ElementId;
  readonly difficulty: string | ScoreTenths;
  readonly reason: string;
}
export interface ProgramBonus {
  readonly label: string;
  readonly milliPoints: number;
  readonly explanation: string;
}
export interface ScoringProfileDefinition {
  readonly ref: ScoringProfileRef;
  readonly label: string;
  readonly season: string;
  readonly sourceCutoff: string;
  readonly baseRulesetId: string;
  readonly baseRulesetVersion: string;
  readonly status: 'complete' | 'unavailable';
  readonly unavailableReason?: string;
  readonly sources: readonly ProfileSource[];
  readonly elementOverrides?: readonly ElementOverride[];
  readonly additionalElements?: readonly CompiledElement[];
  readonly excludedElementIds?: readonly ElementId[];
  readonly sharedRules?: CompiledSharedRules;
  readonly apparatusRules?: Partial<Record<ApparatusId, CompiledApparatusRules>>;
  readonly programBonusTables?: Partial<Record<ApparatusId, Readonly<Record<string, number>>>>;
  readonly programBonusLabel?: string;
  readonly excludedBonuses?: readonly string[];
}
export interface ProfileRuntime extends FigRulesetRuntime {
  readonly profile: ScoringProfileDefinition;
  readonly excludedElementIds: ReadonlySet<ElementId>;
  countingLimit(apparatus: ApparatusId): number;
  programBonus(apparatus: ApparatusId, difficulty: ScoreTenths): ProgramBonus | undefined;
}
export function profileKey(ref: ScoringProfileRef): string {
  return `${ref.id}@${ref.revision}`;
}
export function sameProfile(a: ScoringProfileRef, b: ScoringProfileRef): boolean {
  return a.id === b.id && a.revision === b.revision;
}
export function parseProfileRef(value: unknown): ScoringProfileRef | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const r = value as Record<string, unknown>;
  if (
    Object.keys(r).some((k) => k !== 'id' && k !== 'revision') ||
    typeof r.id !== 'string' ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.id) ||
    r.id.length > 120 ||
    typeof r.revision !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(r.revision) ||
    r.revision.length > 40
  )
    return undefined;
  return { id: r.id, revision: r.revision };
}
/** Immutable revisions are registered explicitly; draft definitions can never produce a runtime. */
export function createProfileRegistry(
  base: CompiledRuleset,
  definitions: readonly ScoringProfileDefinition[],
) {
  const profiles = new Map<string, ScoringProfileDefinition>();
  const runtimes = new Map<string, ProfileRuntime>();
  const catalog = new Map(base.elements.map((e) => [e.id, e]));
  const baseIds = new Set(catalog.keys());
  for (const d of definitions) {
    const key = profileKey(d.ref);
    if (
      !parseProfileRef(d.ref) ||
      profiles.has(key) ||
      d.baseRulesetId !== base.id ||
      d.baseRulesetVersion !== base.dataVersion ||
      !d.label.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(d.sourceCutoff) ||
      !d.sources.length ||
      d.sources.some((s) => !s.title || !s.locator || !s.url.startsWith('https://'))
    )
      throw new Error(`Invalid scoring profile ${key}`);
    if (d.status !== 'complete' && d.status !== 'unavailable')
      throw new Error(`Invalid profile status ${key}`);
    if (d.status === 'unavailable' && !d.unavailableReason)
      throw new Error(`Missing availability explanation ${key}`);
    for (const e of d.additionalElements ?? []) {
      if (
        baseIds.has(e.id) ||
        (catalog.has(e.id) && JSON.stringify(catalog.get(e.id)) !== JSON.stringify(e)) ||
        !APPARATUS_IDS.includes(e.apparatus) ||
        !Number.isSafeInteger(e.difficulty.tenths) ||
        e.difficulty.tenths <= 0
      )
        throw new Error(`Invalid additional element ${e.id}`);
      catalog.set(e.id, e);
    }
    profiles.set(key, d);
  }
  for (const d of definitions) {
    const ownElements = new Map(
      [...base.elements, ...(d.additionalElements ?? [])].map((e) => [e.id, e]),
    );
    const seen = new Set<ElementId>();
    for (const o of d.elementOverrides ?? []) {
      const e = ownElements.get(o.elementId);
      if (!e || seen.has(o.elementId) || !o.reason.trim())
        throw new Error(`Invalid element override ${o.elementId}`);
      seen.add(o.elementId);
      if (
        e.difficulty.kind === 'letter' &&
        (typeof o.difficulty !== 'string' || base.difficultyScale[o.difficulty] === undefined)
      )
        throw new Error(`Invalid letter override ${o.elementId}`);
      if (
        e.difficulty.kind === 'vault' &&
        (typeof o.difficulty !== 'number' ||
          !Number.isSafeInteger(o.difficulty) ||
          o.difficulty <= 0)
      )
        throw new Error(`Invalid vault override ${o.elementId}`);
    }
    for (const id of d.excludedElementIds ?? [])
      if (!ownElements.has(id)) throw new Error(`Unknown eligibility element ${id}`);
    for (const table of Object.values(d.programBonusTables ?? {}))
      for (const [dv, bonus] of Object.entries(table))
        if (!/^\d+$/.test(dv) || !Number.isSafeInteger(bonus) || bonus < 0)
          throw new Error('Invalid program bonus table');
  }
  function getProfileRuntime(ref: ScoringProfileRef): ProfileRuntime | undefined {
    const key = profileKey(ref),
      definition = profiles.get(key);
    if (!definition || definition.status !== 'complete') return undefined;
    const cached = runtimes.get(key);
    if (cached) return cached;
    const overrides = new Map((definition.elementOverrides ?? []).map((o) => [o.elementId, o]));
    const effective: CompiledRuleset = {
      ...base,
      elements: [...base.elements, ...(definition.additionalElements ?? [])].map((e) => {
        const override = overrides.get(e.id);
        if (!override) return e;
        const difficulty =
          typeof override.difficulty === 'string'
            ? {
                kind: 'letter' as const,
                letter: override.difficulty,
                tenths: scoreTenths(base.difficultyScale[override.difficulty] ?? NaN),
              }
            : { kind: 'vault' as const, tenths: scoreTenths(override.difficulty) };
        return {
          ...e,
          difficulty,
          profileAdjustment: { originalTenths: e.difficulty.tenths, reason: override.reason },
        };
      }),
      sharedRules: definition.sharedRules ?? base.sharedRules,
      apparatusRules: { ...base.apparatusRules, ...definition.apparatusRules },
    };
    const excludedElementIds = new Set(definition.excludedElementIds ?? []);
    const fig = createFigRulesetRuntime(effective, excludedElementIds);
    const runtime: ProfileRuntime = {
      ...fig,
      profile: definition,
      excludedElementIds,
      countingLimit: (a) =>
        a === 'vault'
          ? 1
          : effective.sharedRules.elementCounting[a].regularElementSlots +
            effective.sharedRules.elementCounting[a].reservedDismountSlots,
      programBonus: (apparatus, difficulty) => {
        const milliPoints = definition.programBonusTables?.[apparatus]?.[String(difficulty)];
        return milliPoints === undefined
          ? undefined
          : {
              label: definition.programBonusLabel ?? 'Domestic program bonus',
              milliPoints,
              explanation: `${definition.label} · ${definition.season}. Separate from the core D-score.`,
            };
      },
    };
    runtimes.set(key, runtime);
    return runtime;
  }
  return {
    definitions: [...profiles.values()] as readonly ScoringProfileDefinition[],
    catalogElements: [...catalog.values()] as readonly CompiledElement[],
    getProfileRuntime,
    label: (ref: ScoringProfileRef) =>
      profiles.get(profileKey(ref))?.label ?? `Unavailable ruleset: ${profileKey(ref)}`,
  };
}
