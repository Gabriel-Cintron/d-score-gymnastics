import type { ElementId } from '@d-score-gymnastics/scoring';
import type { CompiledElement } from '@d-score-gymnastics/rulesets';

export interface CatalogMatch {
  readonly element: CompiledElement;
  readonly matchedAlias?: string;
}

export interface CatalogFilters {
  readonly elementGroup?: number;
  readonly maximumDifficulty?: number;
  readonly minimumDifficulty?: number;
}

interface RankedTerm {
  readonly alias?: string;
  readonly score: number;
}

export function excludeCatalogElements(
  elements: readonly CompiledElement[],
  excludedElementIds: ReadonlySet<ElementId>,
): readonly CompiledElement[] {
  return elements.filter((element) => !excludedElementIds.has(element.id));
}

export function searchCatalog(
  elements: readonly CompiledElement[],
  query: string,
  filters: CatalogFilters = {},
  limit = 40,
): readonly CatalogMatch[] {
  const normalizedQuery = normalizeSearchTerm(query);
  const filteredElements = elements.filter((element) => matchesFilters(element, filters));
  if (normalizedQuery.length === 0) {
    return [...filteredElements]
      .sort(compareElementsByDifficulty)
      .slice(0, limit)
      .map((element) => ({ element }));
  }

  return filteredElements
    .map((element) => {
      const canonical = rankTerm(normalizedQuery, normalizeSearchTerm(element.name));
      const aliasMatches = element.aliases
        .map((alias) => ({ alias, score: rankTerm(normalizedQuery, normalizeSearchTerm(alias)) }))
        .filter((match): match is { alias: string; score: number } => match.score !== undefined)
        .sort((left, right) => left.score - right.score || left.alias.localeCompare(right.alias));
      const alias = aliasMatches[0];

      if (canonical === undefined && alias === undefined) return undefined;
      const canonicalScore = canonical ?? Number.POSITIVE_INFINITY;
      const aliasScore = alias === undefined ? Number.POSITIVE_INFINITY : alias.score + 1;
      const ranked: RankedTerm =
        aliasScore < canonicalScore && alias !== undefined
          ? { alias: alias.alias, score: aliasScore }
          : { score: canonicalScore };

      return { element, ranked };
    })
    .filter(
      (
        match,
      ): match is {
        element: CompiledElement;
        ranked: RankedTerm;
      } => match !== undefined,
    )
    .sort(
      (left, right) =>
        left.ranked.score - right.ranked.score ||
        compareElementsByDifficulty(left.element, right.element),
    )
    .slice(0, limit)
    .map(({ element, ranked }) => ({
      element,
      ...(ranked.alias === undefined ? {} : { matchedAlias: ranked.alias }),
    }));
}

function matchesFilters(element: CompiledElement, filters: CatalogFilters): boolean {
  const difficulty = element.difficulty.tenths;
  return (
    (filters.minimumDifficulty === undefined || difficulty >= filters.minimumDifficulty) &&
    (filters.maximumDifficulty === undefined || difficulty <= filters.maximumDifficulty) &&
    (filters.elementGroup === undefined || element.code.group === filters.elementGroup)
  );
}

export function normalizeSearchTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function rankTerm(query: string, candidate: string): number | undefined {
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 10 + lengthPenalty(query, candidate);
  if (candidate.includes(query)) return 20 + lengthPenalty(query, candidate);

  const queryTokens = query.split(' ');
  const candidateTokens = candidate.split(' ');
  let tokenScore = 0;
  for (const queryToken of queryTokens) {
    const match = bestTokenScore(queryToken, candidateTokens);
    if (match === undefined) return undefined;
    tokenScore += match;
  }
  return 40 + tokenScore + Math.max(0, candidateTokens.length - queryTokens.length);
}

function bestTokenScore(query: string, candidates: readonly string[]): number | undefined {
  let best: number | undefined;
  for (const candidate of candidates) {
    let score: number | undefined;
    if (candidate === query) score = 0;
    else if (candidate.startsWith(query)) score = 2 + lengthPenalty(query, candidate);
    else if (candidate.includes(query)) score = 6 + lengthPenalty(query, candidate);
    else if (query.length >= 4 && editDistanceWithin(query, candidate, 1)) score = 12;
    else if (query.length >= 4 && isSubsequence(query, candidate)) score = 18;

    if (score !== undefined && (best === undefined || score < best)) best = score;
  }
  return best;
}

function editDistanceWithin(left: string, right: string, maximum: number): boolean {
  if (Math.abs(left.length - right.length) > maximum) return false;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution =
        (previous[rightIndex - 1] ?? maximum + 1) +
        (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      const value = Math.min(
        (previous[rightIndex] ?? maximum + 1) + 1,
        (current[rightIndex - 1] ?? maximum + 1) + 1,
        substitution,
      );
      current.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > maximum) return false;
    previous = current;
  }

  const finalDistance = previous[right.length];
  return finalDistance !== undefined && finalDistance <= maximum;
}

function isSubsequence(query: string, candidate: string): boolean {
  let queryIndex = 0;
  for (const character of candidate) {
    if (character === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return true;
  }
  return false;
}

function lengthPenalty(query: string, candidate: string): number {
  return Math.min(9, Math.max(0, candidate.length - query.length));
}

function compareElements(left: CompiledElement, right: CompiledElement): number {
  return (
    left.code.group - right.code.group ||
    String(left.code.number).localeCompare(String(right.code.number), undefined, {
      numeric: true,
    }) ||
    left.name.localeCompare(right.name)
  );
}

function compareElementsByDifficulty(left: CompiledElement, right: CompiledElement): number {
  return left.difficulty.tenths - right.difficulty.tenths || compareElements(left, right);
}
