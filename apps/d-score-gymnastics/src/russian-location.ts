import type { CompiledElement, CompiledPommelHorseRules } from '@d-score-gymnastics/rulesets';

export function requiresRussianLocation(
  element: CompiledElement,
  rules: CompiledPommelHorseRules,
): boolean {
  return element.traits.includes(rules.occurrenceQualifiers.russianLocation.requiredTrait);
}

export function selectedRussianLocation(
  qualifiers: readonly string[] | undefined,
  rules: CompiledPommelHorseRules,
): string | undefined {
  const options = rules.occurrenceQualifiers.russianLocation.options;
  return qualifiers?.find((qualifier) => options.includes(qualifier));
}

export function replaceRussianLocation(
  qualifiers: readonly string[] | undefined,
  location: string,
  rules: CompiledPommelHorseRules,
): readonly string[] {
  const options = rules.occurrenceQualifiers.russianLocation.options;
  if (!options.includes(location)) return [...(qualifiers ?? [])];
  return [...(qualifiers ?? []).filter((qualifier) => !options.includes(qualifier)), location];
}

export function russianLocationLabel(location: string): string {
  switch (location) {
    case 'russian-location-end':
      return 'At the end';
    case 'russian-location-between-pommels':
      return 'Between the pommels';
    default:
      return location
        .replace(/^russian-location-/, '')
        .split('-')
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' ');
  }
}
