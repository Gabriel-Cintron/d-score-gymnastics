import type { ExplanationParameters } from '@d-score-gymnastics/scoring';

const LABELS: Readonly<Record<string, string>> = {
  'fig.connection-awarded': 'Connection value awarded',
  'fig.dismount-counted': 'Counted as the dismount',
  'fig.dismount-group-awarded': 'Dismount group awarded',
  'fig.dismount-not-creditable': 'Dismount cannot receive credit',
  'fig.dismount-not-final': 'Dismount is not final',
  'fig.element-count-limit': 'Outside the counting limit',
  'fig.element-counted': 'Counted in the routine',
  'fig.element-group-awarded': 'Element group awarded',
  'fig.element-group-limit': 'Element group limit reached',
  'fig.element-repeated': 'Repeated Code element',
  'fig.floor-missing-balance-or-leap': 'Balance or leap requirement is missing',
  'fig.landing-not-dismount': 'Stick is assigned to a non-dismount',
  'fig.missing-dismount': 'A valid dismount is missing',
  'fig.missing-element-group': 'An element group is missing',
  'fig.parallel-bars-healy-upgrade': 'One-rail Healy value awarded',
  'fig.pommel-occurrence-qualifier-required': 'Russian location must be specified',
  'fig.pommel-one-pommel-after-sequence': 'One-pommel element cannot follow this sequence',
  'fig.pommel-combined-limit': 'Only one combined sequence can receive value',
  'fig.pommel-flop-limit': 'Only one flop sequence can receive value',
  'fig.pommel-sequence-component': 'Included in a Pommel sequence',
  'fig.pommel-sequence-counted': 'Pommel sequence counted',
  'fig.pommel-sequence-separator-required':
    'There must be a circle between these Pommel sequences for credit',
  'fig.relationship-not-creditable': 'Connection is not creditable',
  'fig.repeated-element': 'Repeated element',
  'fig.rings-direct-upgrade': 'Rings direct value upgrade awarded',
  'fig.rings-final-position-limit': 'Rings final-position limit reached',
  'fig.rings-missing-swing-handstand': 'Swing-to-handstand requirement is missing',
  'fig.rings-strength-sequence-limit': 'Consecutive strength limit reached',
  'fig.special-repetition-limit': 'Apparatus repetition limit reached',
  'fig.stick-bonus-awarded': 'Stick bonus awarded',
  'fig.stick-bonus-ineligible': 'Dismount is not eligible for stick bonus',
  'fig.vault-stick-ineligible': 'Vault is not eligible for stick bonus',
};

export function explanationLabel(code: string): string {
  return LABELS[code] ?? humanizeCode(code);
}

export function explanationDetails(parameters: ExplanationParameters): string | undefined {
  const entries = Object.entries(parameters);
  if (entries.length === 0) return undefined;
  return entries.map(([key, value]) => `${humanizeWord(key)}: ${String(value)}`).join(' · ');
}

function humanizeCode(code: string): string {
  const finalSegment = code.split('.').at(-1) ?? code;
  const label = humanizeWord(finalSegment);
  return `${label.charAt(0).toLocaleUpperCase('en-US')}${label.slice(1)}`;
}

function humanizeWord(value: string): string {
  return value
    .replaceAll('-', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLocaleLowerCase('en-US');
}
