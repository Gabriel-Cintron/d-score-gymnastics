import { describe, expect, it } from 'vitest';

import {
  allocateNeutralElementIds,
  findWordingReviewIssues,
  neutralElementId,
  nextNeutralSequence,
  publicWordingDigest,
  replaceKnownElementIds,
  type CatalogElementSnapshot,
  type PrivateCatalogElementRecord,
  type PublicWordingElement,
} from '../scripts/lib/catalog-publication';

const elements: readonly CatalogElementSnapshot[] = [
  {
    aliases: ['Named skill'],
    apparatus: 'floor-exercise',
    code: { group: 1, number: 7 },
    id: 'fx:old-description',
    name: 'Old descriptive wording',
  },
  {
    aliases: [],
    apparatus: 'floor-exercise',
    code: { group: 2, number: 1 },
    id: 'fx:another-description',
    name: 'Another old description',
  },
  {
    aliases: [],
    apparatus: 'vault',
    code: { group: 1, number: 101 },
    id: 'vt:old-vault',
    name: 'Old vault wording',
  },
];

describe('public catalog publication helpers', () => {
  it('allocates stable neutral sequences independently for each apparatus', () => {
    const mapping = allocateNeutralElementIds(elements);

    expect(Object.fromEntries(mapping)).toEqual({
      'fx:old-description': 'fx:mag-0001',
      'fx:another-description': 'fx:mag-0002',
      'vt:old-vault': 'vt:mag-0001',
    });
    expect(neutralElementId('pb', 42)).toBe('pb:mag-0042');
    expect(nextNeutralSequence(['pb:mag-0002', 'pb:mag-0042', 'pb:legacy'], 'pb')).toBe(43);
  });

  it('migrates known IDs without changing occurrence IDs or unrelated strings', () => {
    const migrated = replaceKnownElementIds(
      {
        routine: [{ elementId: 'fx:old-description', occurrenceId: 'routine-element-1' }],
        vaultId: 'vt:old-vault',
        note: 'fx:old-description is prose here and is intentionally untouched',
      },
      new Map([
        ['fx:old-description', 'fx:mag-0001'],
        ['vt:old-vault', 'vt:mag-0001'],
      ]),
    );

    expect(migrated).toEqual({
      routine: [{ elementId: 'fx:mag-0001', occurrenceId: 'routine-element-1' }],
      vaultId: 'vt:mag-0001',
      note: 'fx:old-description is prose here and is intentionally untouched',
    });
  });

  it('creates an order-independent wording digest', () => {
    const publicElements: readonly PublicWordingElement[] = elements.map((element, index) => ({
      aliases: element.aliases,
      apparatus: element.apparatus,
      id: `${element.apparatus === 'vault' ? 'vt' : 'fx'}:mag-${String(index + 1).padStart(4, '0')}`,
      name: `Independent label ${index + 1}`,
    }));

    expect(publicWordingDigest(publicElements)).toBe(
      publicWordingDigest([...publicElements].reverse()),
    );
  });

  it('flags source overlap, long aliases, long labels, and duplicate labels', () => {
    const publicElements: readonly PublicWordingElement[] = [
      {
        aliases: ['an alias with more than five words'],
        apparatus: 'floor-exercise',
        id: 'fx:mag-0001',
        name: 'This source phrase has six matching words and a deliberately very long label that exceeds eighty characters',
      },
      {
        aliases: [],
        apparatus: 'floor-exercise',
        id: 'fx:mag-0002',
        name: 'This source phrase has six matching words and a deliberately very long label that exceeds eighty characters',
      },
    ];
    const privateElements: readonly PrivateCatalogElementRecord[] = publicElements.map(
      (element, index) => ({
        ...element,
        code: { group: 1, number: index + 1 },
        id: `fx:old-${index + 1}`,
        name: 'This source phrase has six matching words before the remainder changes',
        publicId: element.id,
      }),
    );

    const kinds = findWordingReviewIssues(publicElements, privateElements).map(({ kind }) => kind);
    expect(kinds).toContain('alias-too-long');
    expect(kinds).toContain('duplicate-label');
    expect(kinds).toContain('label-too-long');
    expect(kinds).toContain('shared-source-phrase');
  });
});
