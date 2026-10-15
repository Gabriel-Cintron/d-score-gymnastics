import type { CompiledRuleset } from './compile';
import { FIG_PROFILE, type ScoringProfileDefinition } from './profiles';
export function bundledProfileDefinitions(
  base: CompiledRuleset,
): readonly ScoringProfileDefinition[] {
  const sources = base.sources.map((s) => ({
    title: s.title,
    url: s.url,
    locator: s.revision ?? s.id,
  }));
  return [
    {
      ref: FIG_PROFILE,
      label: 'FIG MAG 2025–2028',
      season: '2025–2028',
      sourceCutoff: base.catalogCoverage.officialPublicationCutoff,
      baseRulesetId: base.id,
      baseRulesetVersion: base.dataVersion,
      status: 'complete',
      sources,
    },
    ...(
      [
        ['usag-mdp-level-7', 'USAG Development · Level 7'],
        ['usag-mdp-level-8', 'USAG Development · Level 8'],
        ['usag-mdp-level-9', 'USAG Development · Level 9'],
        ['usag-mdp-level-10-jn', 'USAG Development · Level 10 JN'],
        ['usag-elite-junior-2026', 'USAG Junior Elite · 2026'],
        ['usag-elite-senior-2026', 'USAG Senior Elite · 2026'],
      ] as const
    ).map(([id, label]) => ({
      ref: { id, revision: '1.0.0' },
      label,
      season: '2026',
      sourceCutoff: '2026-10-15',
      baseRulesetId: base.id,
      baseRulesetVersion: base.dataVersion,
      status: 'unavailable' as const,
      unavailableReason:
        'Not yet supported. Complete program rules and eligibility must be verified before this profile can be selected.',
      sources: [
        {
          title: 'USA Gymnastics Men’s rules and official updates',
          url: 'https://usagym.org/men/rules/',
          locator: 'Current manual and program-specific updates required',
        },
      ],
    })),
  ];
}
