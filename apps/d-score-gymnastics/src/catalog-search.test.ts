import { scoreTenths, type ElementId } from '@d-score-gymnastics/scoring';
import type { CompiledElement } from '@d-score-gymnastics/rulesets';
import { describe, expect, it } from 'vitest';

import { excludeCatalogElements, searchCatalog } from './catalog-search';

const elements: readonly CompiledElement[] = [
  element('pb:basic-swing', 'Basic swing', [], 1, 1, 1),
  element('pb:mag-0134', 'Felge to handstand', ['Peach', 'Peach to handstand'], 2),
  element('pb:healy', 'Healy to support', [], 2),
  element('pb:makuts', 'Makuts', [], 3, 3),
  element('pb:high-flight', 'High flight', [], 1, 7, 2),
];

describe('catalog search', () => {
  it('returns canonical entries for maintained aliases', () => {
    expect(searchCatalog(elements, 'peach')[0]).toMatchObject({
      element: { id: 'pb:mag-0134', name: 'Felge to handstand' },
      matchedAlias: 'Peach',
    });
  });

  it('tolerates a single-character typo', () => {
    expect(searchCatalog(elements, 'pech')[0]?.element.id).toBe('pb:mag-0134');
  });

  it('ranks a canonical prefix before looser matches', () => {
    expect(searchCatalog(elements, 'heal')[0]?.element.id).toBe('pb:healy');
  });

  it('sorts the unfiltered catalog from low to high difficulty', () => {
    expect(
      searchCatalog(elements, '', {}, elements.length).map(
        ({ element: catalogElement }) => catalogElement.difficulty.tenths,
      ),
    ).toEqual([1, 3, 4, 4, 7]);
  });

  it('filters an inclusive difficulty range within an element group', () => {
    const matches = searchCatalog(
      elements,
      '',
      { elementGroup: 1, maximumDifficulty: 4, minimumDifficulty: 3 },
      elements.length,
    );

    expect(matches.map(({ element: catalogElement }) => catalogElement.id)).toEqual([
      'pb:makuts',
      'pb:mag-0134',
      'pb:healy',
    ]);
  });

  it('combines an exact difficulty with an element-group filter', () => {
    const matches = searchCatalog(
      elements,
      '',
      { elementGroup: 2, maximumDifficulty: 7, minimumDifficulty: 7 },
      elements.length,
    );

    expect(matches.map(({ element: catalogElement }) => catalogElement.id)).toEqual([
      'pb:high-flight',
    ]);
  });

  it('removes elements already present in the active routine', () => {
    const available = excludeCatalogElements(
      elements,
      new Set<ElementId>(['pb:basic-swing', 'pb:healy']),
    );

    expect(available.map(({ id }) => id)).not.toContain('pb:basic-swing');
    expect(available.map(({ id }) => id)).not.toContain('pb:healy');
    expect(available).toHaveLength(elements.length - 2);
  });
});

function element(
  id: ElementId,
  name: string,
  aliases: readonly string[],
  number: number,
  difficulty = 4,
  group = 1,
): CompiledElement {
  return {
    aliases,
    apparatus: 'parallel-bars',
    code: { group, number },
    difficulty: {
      kind: 'letter',
      letter: difficultyLetter(difficulty),
      tenths: scoreTenths(difficulty),
    },
    families: [],
    id,
    name,
    roles: [],
    source: { documentId: 'test-code', page: 1 },
    traits: [],
  };
}

function difficultyLetter(difficulty: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + difficulty - 1);
}
