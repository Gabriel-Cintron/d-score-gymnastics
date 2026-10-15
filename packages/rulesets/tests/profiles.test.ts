import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { APPARATUS_IDS, scoreTenths, type ElementRoutine } from '@d-score-gymnastics/scoring';
import {
  compileRuleset,
  createFigRulesetRuntime,
  createProfileRegistry,
  FIG_PROFILE,
  bundledProfileDefinitions,
  type CompiledRuleset,
  type ScoringProfileDefinition,
  type RulesetSource,
} from '../src/index';
import { loadRulesets } from '../scripts/lib/load-rulesets';
let base: CompiledRuleset;
let source: RulesetSource;
beforeAll(async () => {
  const loaded = await loadRulesets(fileURLToPath(new URL('../data/', import.meta.url)));
  const loadedSource = loaded.sources[0];
  if (!loadedSource || loaded.issues.length) throw new Error('FIG data missing');
  source = loadedSource;
  base = compileRuleset(source);
});
function definition(overrides: Partial<ScoringProfileDefinition> = {}): ScoringProfileDefinition {
  return {
    ...(bundledProfileDefinitions(base)[0] as ScoringProfileDefinition),
    ref: { id: 'test-profile', revision: '1.0.0' },
    label: 'TEST ONLY — no claim of USAG scoring',
    ...overrides,
  };
}
function result(
  runtime: ReturnType<ReturnType<typeof createProfileRegistry>['getProfileRuntime']>,
  routine: ElementRoutine,
) {
  if (!runtime) throw new Error('Runtime missing');
  const o = runtime.scoreRoutine(routine);
  if (!o.ok) throw new Error('Invalid fixture');
  return o.result;
}
describe('scoring profiles', () => {
  it('preserves FIG results on every apparatus and caches exact revisions', () => {
    const registry = createProfileRegistry(base, bundledProfileDefinitions(base)),
      runtime = registry.getProfileRuntime(FIG_PROFILE),
      fig = createFigRulesetRuntime(base);
    expect(runtime).toBe(registry.getProfileRuntime({ ...FIG_PROFILE }));
    for (const apparatus of APPARATUS_IDS) {
      const e = base.elements.find((e) => e.apparatus === apparatus);
      if (!e || !runtime) throw new Error('Missing fixture');
      if (apparatus === 'vault')
        expect(runtime.scoreVault({ apparatus, vaultId: e.id })).toEqual(
          fig.scoreVault({ apparatus, vaultId: e.id }),
        );
      else {
        const routine = { apparatus, occurrences: [{ elementId: e.id, occurrenceId: 'a' }] };
        expect(runtime.scoreRoutine(routine)).toEqual(fig.scoreRoutine(routine));
      }
    }
  });
  it('routes every existing fixture input through the FIG profile without changing the outcome', () => {
    const runtime = createProfileRegistry(base, bundledProfileDefinitions(base)).getProfileRuntime(
      FIG_PROFILE,
    );
    if (!runtime) throw new Error('FIG runtime missing');
    const previous = createFigRulesetRuntime(base);
    for (const { data: fixture } of source.fixtures) {
      if (fixture.kind === 'fig-vault') {
        const routine = {
          apparatus: 'vault' as const,
          vaultId: fixture.routine.vaultId,
          ...(fixture.routine.landing === undefined ? {} : { landing: fixture.routine.landing }),
        };
        expect(runtime.scoreVault(routine), fixture.id).toEqual(previous.scoreVault(routine));
      } else {
        const routine: ElementRoutine = {
          apparatus: fixture.routine.apparatus,
          occurrences: fixture.routine.occurrences.map((occurrence) => ({
            elementId: occurrence.elementId,
            occurrenceId: occurrence.occurrenceId,
            ...(occurrence.qualifiers === undefined ? {} : { qualifiers: occurrence.qualifiers }),
          })),
          ...(fixture.routine.landing === undefined ? {} : { landing: fixture.routine.landing }),
          ...(fixture.routine.relationships === undefined
            ? {}
            : { relationships: fixture.routine.relationships }),
        };
        expect(runtime.scoreRoutine(routine), fixture.id).toEqual(previous.scoreRoutine(routine));
      }
    }
  });
  it('shares identical new catalog IDs across profiles without changing the FIG catalog', () => {
    const element = base.elements.find((e) => e.apparatus === 'floor-exercise');
    if (!element) throw new Error('Fixture missing');
    const added = { ...element, id: 'fx:development-test' as typeof element.id };
    const first = definition({ additionalElements: [added] });
    const second = definition({
      ref: { id: 'second-test-profile', revision: '1.0.0' },
      additionalElements: [added],
    });
    const registry = createProfileRegistry(base, [first, second]);
    expect(registry.catalogElements.filter((e) => e.id === added.id)).toHaveLength(1);
    expect(
      registry.getProfileRuntime(second.ref)?.elementsForApparatus('floor-exercise'),
    ).toContainEqual(added);
    expect(base.elements.some((e) => e.id === added.id)).toBe(false);
    expect(() =>
      createProfileRegistry(base, [
        first,
        { ...second, additionalElements: [{ ...added, name: 'Conflicting definition' }] },
      ]),
    ).toThrow();
  });
  it('rejects unregistered revisions and keeps incomplete USAG profiles unavailable', () => {
    const registry = createProfileRegistry(base, bundledProfileDefinitions(base));
    expect(registry.getProfileRuntime({ ...FIG_PROFILE, revision: '9.0.0' })).toBeUndefined();
    for (const d of registry.definitions.filter((d) => d.ref.id.startsWith('usag-')))
      expect(registry.getProfileRuntime(d.ref)).toBeUndefined();
  });
  it('applies a value change before group credit without mutating the catalog', () => {
    const cross = base.elements.find(
      (e) => e.apparatus === 'still-rings' && e.code.group === 2 && e.difficulty.tenths === 3,
    );
    if (!cross) throw new Error('Missing C fixture');
    const d = definition({
      elementOverrides: [{ elementId: cross.id, difficulty: 'D', reason: 'Test value upgrade' }],
    });
    const registry = createProfileRegistry(base, [d]),
      routine: ElementRoutine = {
        apparatus: 'still-rings',
        occurrences: [{ elementId: cross.id, occurrenceId: 'a' }],
      };
    const score = result(registry.getProfileRuntime(d.ref), routine);
    expect(score.breakdown.elementDifficulty).toBe(4);
    expect(score.breakdown.elementGroup).toBe(5);
    expect(cross.difficulty.tenths).toBe(3);
    expect(
      registry
        .getProfileRuntime(d.ref)
        ?.elementsForApparatus('still-rings')
        .find((e) => e.id === cross.id)?.profileAdjustment?.reason,
    ).toBe('Test value upgrade');
  });
  it('selects using effective values, not original FIG values', () => {
    const elements = base.elements.filter(
      (e) => e.apparatus === 'floor-exercise' && e.code.group === 2,
    );
    const low = elements.find((e) => e.difficulty.tenths === 2),
      high = elements.find((e) => e.difficulty.tenths === 4);
    if (!low || !high) throw new Error('Missing selection fixtures');
    const d = definition({
      sharedRules: {
        ...base.sharedRules,
        elementCounting: {
          ...base.sharedRules.elementCounting,
          'floor-exercise': {
            regularElementSlots: 1,
            reservedDismountSlots: 0,
            maximumPerElementGroup: 4,
          },
        },
      },
      elementOverrides: [{ elementId: low.id, difficulty: 'E', reason: 'Test ordering' }],
    });
    const score = result(createProfileRegistry(base, [d]).getProfileRuntime(d.ref), {
      apparatus: 'floor-exercise',
      occurrences: [
        { elementId: high.id, occurrenceId: 'high' },
        { elementId: low.id, occurrenceId: 'low' },
      ],
    });
    expect(score.elementDecisions.find((e) => e.occurrenceId === 'low')?.status).toBe('counted');
    expect(score.elementDecisions.find((e) => e.occurrenceId === 'high')?.status).toBe('excluded');
  });
  it('excludes ineligible elements before group credit and zeroes ineligible vaults', () => {
    const e = base.elements.find((e) => e.apparatus === 'still-rings'),
      vault = base.elements.find((e) => e.apparatus === 'vault');
    if (!e || !vault) throw new Error('Missing fixtures');
    const d = definition({ excludedElementIds: [e.id, vault.id] }),
      runtime = createProfileRegistry(base, [d]).getProfileRuntime(d.ref);
    const score = result(runtime, {
      apparatus: 'still-rings',
      occurrences: [{ elementId: e.id, occurrenceId: 'a' }],
    });
    expect(score.total).toBe(0);
    expect(score.elementDecisions[0]?.reason).toBe('profile.element-not-eligible');
    const v = runtime?.scoreVault({ apparatus: 'vault', vaultId: vault.id, landing: 'stuck' });
    expect(v?.ok && v.result.total).toBe(0);
  });
  it('keeps millipoint domestic bonus separate and does not guess missing table entries', () => {
    const d = definition({ programBonusTables: { 'floor-exercise': { '55': 202 } } }),
      runtime = createProfileRegistry(base, [d]).getProfileRuntime(d.ref);
    expect(runtime?.programBonus('floor-exercise', scoreTenths(55))?.milliPoints).toBe(202);
    expect(runtime?.programBonus('floor-exercise', scoreTenths(54))).toBeUndefined();
    expect(runtime?.programBonus('vault', scoreTenths(55))).toBeUndefined();
  });
  it('rejects conflicting revisions, invalid overrides and mismatched bases', () => {
    const d = definition(),
      e = base.elements[0];
    if (!e) throw new Error('Fixture missing');
    expect(() => createProfileRegistry(base, [d, d])).toThrow();
    expect(() =>
      createProfileRegistry(base, [definition({ baseRulesetVersion: '9.0.0' })]),
    ).toThrow();
    expect(() =>
      createProfileRegistry(base, [
        definition({ elementOverrides: [{ elementId: e.id, difficulty: 'Z', reason: 'invalid' }] }),
      ]),
    ).toThrow();
    expect(() =>
      createProfileRegistry(base, [
        definition({ excludedElementIds: ['fx:missing' as typeof e.id] }),
      ]),
    ).toThrow();
  });
});
