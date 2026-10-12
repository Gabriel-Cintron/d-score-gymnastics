import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { parse, stringify } from 'yaml';

import { elementFileSchema, type ElementFile } from '../src/schema';
import {
  createPublicLabelCandidate,
  neutralElementId,
  nextNeutralSequence,
} from './lib/catalog-publication';

interface XmlText {
  readonly height: number;
  readonly left: number;
  readonly text: string;
  readonly top: number;
  readonly width: number;
}

interface TableAnchor {
  readonly number: number;
  readonly text: XmlText;
}

interface XmlPage {
  readonly number: number;
  readonly texts: readonly XmlText[];
}

interface ImportedElement {
  readonly aliases: readonly string[];
  readonly code: { readonly group: number; readonly number: number | string };
  readonly difficulty: number | string;
  readonly families: readonly string[];
  readonly id: string;
  readonly name: string;
  readonly roles: readonly string[];
  readonly source: { readonly documentId: string; readonly page: number };
  readonly traits: readonly string[];
}

interface ApparatusImport {
  readonly apparatus: ElementFile['apparatus'];
  readonly pages: readonly [number, number];
  readonly prefix: string;
}

const ELEMENT_TABLES: readonly ApparatusImport[] = [
  { apparatus: 'floor-exercise', pages: [28, 38], prefix: 'fx' },
  { apparatus: 'pommel-horse', pages: [47, 58], prefix: 'ph' },
  { apparatus: 'still-rings', pages: [63, 79], prefix: 'sr' },
  { apparatus: 'parallel-bars', pages: [96, 112], prefix: 'pb' },
  { apparatus: 'horizontal-bar', pages: [118, 134], prefix: 'hb' },
];

const DIFFICULTIES = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

/** Published elements not yet represented, or not yet named, in the base Code tables. */
const SUPPLEMENTAL_ELEMENTS: Readonly<Record<string, readonly ImportedElement[]>> = {
  'floor-exercise': [
    {
      aliases: [],
      code: { group: 1, number: 'newsletter-1-i-15' },
      difficulty: 'A',
      families: [],
      id: 'fx:mag-0046',
      name: 'Jump forward plus 1/1 rotation into front support',
      roles: [],
      source: { documentId: 'mag-newsletter-1-2025', page: 9 },
      traits: ['balance-or-leap-requirement'],
    },
    {
      aliases: [],
      code: { group: 1, number: 'newsletter-1-i-16' },
      difficulty: 'B',
      families: [],
      id: 'fx:mag-0047',
      name: 'Jump backward plus 3/2 twist into front support',
      roles: [],
      source: { documentId: 'mag-newsletter-1-2025', page: 9 },
      traits: ['balance-or-leap-requirement'],
    },
    {
      aliases: [],
      code: { group: 1, number: 'newsletter-1-i-17' },
      difficulty: 'C',
      families: [],
      id: 'fx:mag-0048',
      name: 'Jump forward plus 2/1 twist into front support',
      roles: [],
      source: { documentId: 'mag-newsletter-1-2025', page: 9 },
      traits: ['balance-or-leap-requirement'],
    },
    {
      aliases: [],
      code: { group: 1, number: 'newsletter-1-i-43' },
      difficulty: 'A',
      families: [],
      id: 'fx:mag-0049',
      name: 'Jump forward plus 1/2 rotation into momentary handstand',
      roles: [],
      source: { documentId: 'mag-newsletter-1-2025', page: 9 },
      traits: ['balance-or-leap-requirement'],
    },
    {
      aliases: [],
      code: { group: 2, number: 'newsletter-1-ii-8' },
      difficulty: 'B',
      families: [],
      id: 'fx:mag-0062',
      name: 'Dive roll plus 1/1 twist',
      roles: [],
      source: { documentId: 'mag-newsletter-1-2025', page: 9 },
      traits: ['acrobatic', 'balance-or-leap-requirement'],
    },
  ],
  'pommel-horse': [
    {
      aliases: ['Moore'],
      code: { group: 2, number: 60 },
      difficulty: 'G',
      families: ['busnari-variation'],
      id: 'ph:mag-0041',
      name: 'Moore — Bertoncelj into Busnari',
      roles: [],
      source: { documentId: 'mag-newsletter-1-2025', page: 7 },
      traits: [],
    },
    {
      aliases: ['Manukyan'],
      code: { group: 2, number: 'newsletter-3-manukyan' },
      difficulty: 'F',
      families: [],
      id: 'ph:mag-0062',
      name: 'Manukyan — Bertoncelj into Davtyan on one pommel',
      roles: [],
      source: { documentId: 'mag-newsletter-3-2025', page: 5 },
      traits: [],
    },
  ],
  vault: [
    {
      aliases: ['Olfati'],
      code: { group: 5, number: 522 },
      difficulty: 5.6,
      families: [],
      id: 'vt:mag-0082',
      name: 'Olfati — Yurchenko then tucked backward somersault plus 1/1 rotation',
      roles: [],
      source: { documentId: 'mag-newsletter-1-2025', page: 7 },
      traits: ['salto-vault'],
    },
  ],
  'parallel-bars': [
    {
      aliases: ['Hall'],
      code: { group: 2, number: 95 },
      difficulty: 'E',
      families: ['salto-five-quarter-forward'],
      id: 'pb:mag-0075',
      name: 'Hall — 5/4 forward straddled somersault plus 1/2 rotation into upper arm',
      roles: [],
      source: { documentId: 'mag-newsletter-1-2025', page: 8 },
      traits: [],
    },
    {
      aliases: ['Patron 2'],
      code: { group: 2, number: 'newsletter-3-patron-2' },
      difficulty: 'C',
      families: [],
      id: 'pb:mag-0087',
      name: 'Patron 2 — Backward swing plus 1/4-turn hop into 3/4 handstand on one rail, reverse direction',
      roles: [],
      source: { documentId: 'mag-newsletter-3-2025', page: 5 },
      traits: ['one-rail'],
    },
    {
      aliases: ['Garza'],
      code: { group: 4, number: 16 },
      difficulty: 'D',
      families: [],
      id: 'pb:mag-0162',
      name: 'Garza — Piked double forward somersault beginning in end support',
      roles: ['dismount'],
      source: { documentId: 'mag-newsletter-4-2026', page: 3 },
      traits: [],
    },
    {
      aliases: ['Vera'],
      code: { group: 4, number: 54 },
      difficulty: 'F',
      families: [],
      id: 'pb:mag-0179',
      name: 'Vera — Tucked double backward somersault plus 2/1 rotation beginning in end hang',
      roles: ['dismount'],
      source: { documentId: 'mag-newsletter-4-2026', page: 3 },
      traits: [],
    },
  ],
  'horizontal-bar': [
    {
      aliases: ['Koudinov 2'],
      code: { group: 2, number: 114 },
      difficulty: 'I',
      families: ['flight-forward-salto-over-bar'],
      id: 'hb:mag-0069',
      name: 'Koudinov 2 — Piked double forward somersault plus 1/1 rotation',
      roles: [],
      source: { documentId: 'mag-newsletter-4-2026', page: 4 },
      traits: ['flight'],
    },
  ],
};

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const xml = await readFile(options.xml, 'utf8');
  const pages = parsePages(xml);
  const existingByApparatus = await loadExistingElements(options.dataDirectory);
  const outputs = new Map<ElementFile['apparatus'], readonly ImportedElement[]>();

  for (const table of ELEMENT_TABLES) {
    const existing = existingByApparatus.get(table.apparatus) ?? [];
    outputs.set(
      table.apparatus,
      mergeSupplements(table.apparatus, importElementTable(pages, table, existing)),
    );
  }
  outputs.set(
    'vault',
    mergeSupplements('vault', importVaultTable(pages, existingByApparatus.get('vault') ?? [])),
  );

  for (const [apparatus, elements] of outputs) {
    const parsed = elementFileSchema.safeParse({
      apparatus,
      elements,
      schemaVersion: 1,
    });
    if (!parsed.success) {
      throw new Error(`Generated ${apparatus} data is invalid: ${parsed.error.message}`);
    }

    if (options.write) {
      const outputFile = resolve(options.dataDirectory, apparatus, 'elements.yaml');
      await writeFile(
        outputFile,
        stringify(parsed.data, { lineWidth: 100, sortMapEntries: false }),
        'utf8',
      );
    }
    process.stdout.write(`${apparatus}: ${elements.length} elements\n`);
  }
}

function mergeSupplements(
  apparatus: ElementFile['apparatus'],
  baseElements: readonly ImportedElement[],
): readonly ImportedElement[] {
  const byCode = new Map(baseElements.map((element) => [codeKey(element), element]));
  for (const supplement of SUPPLEMENTAL_ELEMENTS[apparatus] ?? []) {
    byCode.set(codeKey(supplement), supplement);
  }
  return sortElements(deduplicateByCode([...byCode.values()]));
}

function codeKey(element: ImportedElement): string {
  return `${element.code.group}:${element.code.number}`;
}

function parseArguments(arguments_: readonly string[]): {
  readonly dataDirectory: string;
  readonly write: boolean;
  readonly xml: string;
} {
  let dataDirectory = resolve('data/fig-mag-2025-2028');
  let write = false;
  let xml = '';

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--write') {
      write = true;
    } else if (argument === '--xml') {
      xml = resolve(requiredArgument(arguments_, ++index, '--xml'));
    } else if (argument === '--data-dir') {
      dataDirectory = resolve(requiredArgument(arguments_, ++index, '--data-dir'));
    } else {
      throw new Error(`Unknown argument "${String(argument)}".`);
    }
  }

  if (xml.length === 0) {
    throw new Error('Pass the pdftohtml XML export with --xml.');
  }
  return { dataDirectory, write, xml };
}

function requiredArgument(arguments_: readonly string[], index: number, option: string): string {
  const value = arguments_[index];
  if (value === undefined) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function parsePages(xml: string): ReadonlyMap<number, XmlPage> {
  const pages = new Map<number, XmlPage>();
  for (const match of xml.matchAll(/<page number="(\d+)"[^>]*>([\s\S]*?)<\/page>/g)) {
    const pageNumber = Number(match[1]);
    const body = match[2] ?? '';
    const texts: XmlText[] = [];
    for (const textMatch of body.matchAll(
      /<text top="(\d+)" left="(\d+)" width="(\d+)" height="(\d+)"[^>]*>([\s\S]*?)<\/text>/g,
    )) {
      texts.push({
        height: Number(textMatch[4]),
        left: Number(textMatch[2]),
        text: decodeXml(stripTags(textMatch[5] ?? ''))
          .replace(/\s+/g, ' ')
          .trim(),
        top: Number(textMatch[1]),
        width: Number(textMatch[3]),
      });
    }
    pages.set(pageNumber, { number: pageNumber, texts });
  }
  return pages;
}

function importElementTable(
  pages: ReadonlyMap<number, XmlPage>,
  table: ApparatusImport,
  existing: readonly ImportedElement[],
): readonly ImportedElement[] {
  const existingByCode = indexByCode(existing);
  const usedIds = new Set<string>();
  let nextSequence = nextNeutralSequence(
    existing.map(({ id }) => id),
    table.prefix,
  );
  const imported: ImportedElement[] = [];

  for (let pageNumber = table.pages[0]; pageNumber <= table.pages[1]; pageNumber += 1) {
    const page = requiredPage(pages, pageNumber);
    const group = extractElementGroup(page);
    const rawAnchors = extractTableAnchors(page);
    const columnBoundaries = deriveColumnBoundaries(rawAnchors, pageNumber);
    const anchors = rawAnchors.filter(
      ({ number, text }) => columnFor(text.left, columnBoundaries) === (number - 1) % 6,
    );

    const rowTops = [...new Set(anchors.map(({ text }) => text.top))]
      .sort((left, right) => left - right)
      .reduce<number[]>((clusters, top) => {
        const previous = clusters.at(-1);
        if (previous === undefined || top - previous > 4) {
          clusters.push(top);
        }
        return clusters;
      }, []);

    for (const { number, text: anchor } of anchors) {
      const column = (number - 1) % 6;
      if (columnFor(anchor.left, columnBoundaries) !== column) {
        continue;
      }
      const rowTop = closestRowTop(anchor.top, rowTops);
      const nextRowTop = rowTops.find((top) => top > rowTop + 4) ?? 800;
      const cellTexts = page.texts
        .filter(
          (text) =>
            text.top >= rowTop - 3 &&
            text.top < nextRowTop - 3 &&
            columnFor(text.left, columnBoundaries) === column,
        )
        .sort((left, right) => left.top - right.top || left.left - right.left);
      const name = correctElementName(
        table.apparatus,
        group,
        number,
        cleanElementName(
          cellTexts
            .map(({ text }) => text)
            .join(' ')
            .replace(new RegExp(`^\\s*${number}\\s*\\.\\s*`), '')
            .replace(/\b[FGHIJ]\b/g, ' '),
        ),
      );
      if (!hasElementDescription(name)) {
        continue;
      }

      const highDifficulty = cellTexts.find(
        ({ height, text }) => height >= 20 && /^[GHIJ]$/.test(text),
      )?.text;
      const difficulty = highDifficulty ?? requiredDifficulty(column);
      const previous = existingByCode.get(`${group}:${number}`);
      const id = uniqueId(
        previous?.id ?? neutralElementId(table.prefix, nextSequence++),
        table.prefix,
        group,
        number,
        usedIds,
      );
      const classification = classifyElement(table.apparatus, group, number, name);
      const aliases = correctElementAliases(
        table.apparatus,
        group,
        number,
        previous?.aliases ?? extractAliases(name),
      );
      imported.push({
        aliases,
        code: { group, number },
        difficulty,
        families: classification.families,
        id,
        name: previous?.name ?? createPublicLabelCandidate(name, aliases),
        roles:
          (group === 4 && table.apparatus !== 'floor-exercise') ||
          (table.apparatus === 'floor-exercise' && classification.traits.includes('multiple-salto'))
            ? ['dismount']
            : [],
        source: { documentId: 'mag-code-of-points', page: pageNumber },
        traits: classification.traits,
      });
    }
  }

  return sortElements(deduplicateByCode(imported));
}

function importVaultTable(
  pages: ReadonlyMap<number, XmlPage>,
  existing: readonly ImportedElement[],
): readonly ImportedElement[] {
  const existingByCode = indexByCode(existing);
  const usedIds = new Set<string>();
  let nextSequence = nextNeutralSequence(
    existing.map(({ id }) => id),
    'vt',
  );
  const imported: ImportedElement[] = [];

  for (let pageNumber = 84; pageNumber <= 91; pageNumber += 1) {
    const page = requiredPage(pages, pageNumber);
    const anchors = page.texts.filter(
      ({ left, text, top }) =>
        top >= 105 && top < 820 && /^\d{3}$/.test(text) && vaultGroupForLeft(left) !== undefined,
    );

    for (const anchor of anchors) {
      const code = Number(anchor.text);
      const group = Number(anchor.text[0]);
      const block = vaultGroupForLeft(anchor.left);
      if (block === undefined || block !== group) {
        continue;
      }
      const blockStart = 75 + (group - 1) * 230;
      const line = page.texts
        .filter(
          ({ left, top }) =>
            Math.abs(top - anchor.top) <= 2 && left >= blockStart && left < blockStart + 230,
        )
        .sort((left, right) => left.left - right.left);
      const difficultyText = line
        .filter(({ left }) => left >= blockStart + 50 && left < blockStart + 80)
        .map(({ text }) => text)
        .join('')
        .replace(/\s+/g, '');
      const difficultyMatch = /\d\.\d/.exec(difficultyText);
      const name = cleanElementName(
        line
          .filter(({ left }) => left >= blockStart + 80)
          .map(({ text }) => text)
          .join(' '),
      );
      if (difficultyMatch === null || !hasElementDescription(name)) {
        continue;
      }

      const previous = existingByCode.get(`${group}:${code}`);
      const id = uniqueId(
        previous?.id ?? neutralElementId('vt', nextSequence++),
        'vt',
        group,
        code,
        usedIds,
      );
      const aliases = previous?.aliases ?? extractAliases(name);
      imported.push({
        aliases,
        code: { group, number: code },
        difficulty: Number(difficultyMatch[0]),
        families: [],
        id,
        name: previous?.name ?? createPublicLabelCandidate(name, aliases),
        roles: [],
        source: { documentId: 'mag-code-of-points', page: pageNumber },
        traits: isSaltoVault(group, code) ? ['salto-vault'] : [],
      });
    }
  }

  return sortElements(deduplicateByCode(imported));
}

function classifyElement(
  apparatus: ElementFile['apparatus'],
  group: number,
  number: number,
  name: string,
): { readonly families: readonly string[]; readonly traits: readonly string[] } {
  const traits = new Set<string>();
  const families = new Set<string>();
  const normalized = name.toLowerCase();

  if (apparatus === 'floor-exercise') {
    if (group === 1 && number <= 48 && number !== 19 && number !== 31) traits.add('strength');
    if (group === 1 && (number === 61 || number === 62)) traits.add('one-leg-balance');
    if (group === 1 && [61, 62, 67, 68, 74, 75].includes(number)) {
      traits.add('balance-or-leap-requirement');
    }
    if (group === 1 && number >= 79 && number <= 105) traits.add('circle-flair-russian');
    if (/\b(double|triple) salto\b/.test(normalized)) traits.add('multiple-salto');
    if (group >= 2) traits.add('acrobatic');
    if (/counter salto/.test(normalized)) traits.add('counter-salto');
    if (group === 4) traits.add('single-salto-with-turn');
  }

  if (apparatus === 'pommel-horse') {
    if (group === 3 && [33, 34, 35, 39, 40, 41].includes(number)) traits.add('cross-travel-3-3');
    if (group === 3 && [57, 58, 59, 64, 65, 70].includes(number)) {
      traits.add('russian-travel-3-3');
    }
    if (group === 3 && [17, 22, 23, 29].includes(number)) traits.add('spindle-travel-3-3');
    if (group === 2 && [28, 29, 30, 34, 35, 36].includes(number)) traits.add('full-spindle');
    if (/handstand/.test(normalized) && group !== 4) traits.add('handstand');
    if (/flair/.test(normalized) && group !== 4) traits.add('flair');
    if (/russian wendeswing/.test(normalized)) traits.add('russian-wendeswing');
    if (group === 2 && [110, 111, 112, 113].includes(number)) {
      traits.add('russian-location-required');
    }
    if (
      group === 4 &&
      /russian wendeswing/.test(normalized) &&
      /on (?:the )?end/.test(normalized)
    ) {
      families.add('russian-location-end');
    }
    if (/sohn|bezugo/.test(normalized)) traits.add('sohn-bezugo');
    if (/busnari/.test(normalized)) families.add('busnari-variation');
    if (group === 3 && [64, 65, 70].includes(number)) families.add('russian-travel-variation');
    if (group === 3 && [57, 58, 59].includes(number)) families.add('tong-fei-variation');
    if (group === 3 && [22, 23].includes(number)) families.add('nin-reyes-variation');
    if (group === 2 && number === 8) traits.add('flop-circle');
    if (group === 2 && number === 38) traits.add('flop-dsa');
    if (group === 2 && number === 44) traits.add('flop-dsb');
    if (group === 2 && number === 57) traits.add('flop-bertoncelj');
    if (group === 2 && number === 69) traits.add('flop-davtyan');
    if (group === 2 && [110, 111, 112, 113].includes(number)) {
      traits.add('flop-russian');
    }
    if (
      group === 2 &&
      /circle|flair/.test(normalized) &&
      !/on 1 pommel/.test(normalized) &&
      ![...traits].some((trait) => trait.startsWith('flop-'))
    ) {
      traits.add('pommel-sequence-separator');
    }
  }

  if (apparatus === 'still-rings') {
    if (group === 1 && [75, 81, 86, 87, 88].includes(number)) {
      traits.add('swing-to-handstand');
    }
    if (group === 1 && /\b(?:back )?kip\b/.test(normalized))
      traits.add('strength-separator-excluded');
    const finalPosition = ringsFinalPosition(normalized);
    if (finalPosition !== undefined && (group === 2 || group === 3)) {
      families.add(`final-position-${finalPosition}`);
    }
    if (/yamawaki|jonasson/.test(normalized)) traits.add('yamawaki-jonasson');
  }

  if (apparatus === 'parallel-bars') {
    if ([21, 22, 29, 30, 42, 46, 48].includes(number) && group === 3) traits.add('giant-swing');
    if ([106, 107, 108, 114, 119, 120, 130, 131, 137].includes(number) && group === 3) {
      traits.add('felge-swing');
    }
    if ([5, 6, 11, 12, 15, 17, 18].includes(number) && group === 1) {
      traits.add('front-uprise-handstand');
    }
    if (/(?:one|1) (?:bar|rail)/.test(normalized)) traits.add('one-rail');
    if (group === 2 && /healy|makuts/.test(normalized)) traits.add('healy');
    if (/stradd/.test(normalized) && traits.has('one-rail')) traits.add('straddled-one-rail');
    if (group === 2 && [47, 48].includes(number)) families.add('salto-morisue');
    const saltoFamily = parallelBarsSaltoFamily(normalized);
    if (saltoFamily !== undefined) families.add(saltoFamily);
  }

  if (apparatus === 'horizontal-bar') {
    if (group === 2) traits.add('flight');
    if (/adler|stoop circle rearward/.test(normalized)) traits.add('adler');
    const flightFamily = horizontalBarFlightFamily(normalized, group, number);
    if (flightFamily !== undefined) families.add(flightFamily);
  }

  return { families: [...families].sort(), traits: [...traits].sort() };
}

function ringsFinalPosition(name: string): string | undefined {
  const positions: readonly [RegExp, string][] = [
    [/\binverted cross\b/, 'inverted-cross'],
    [/\b(?:l|v)-?cross\b|\bcross\b/, 'cross'],
    [/\binverted swallow\b/, 'inverted-swallow'],
    [/\bswallow\b|\bmaltese cross\b/, 'swallow'],
    [/\bsupport scale\b|\bplanche\b/, 'support-scale'],
    [/\bhanging scale rearwards\b|\bback lever\b/, 'hanging-scale-rearwards'],
    [/\bhanging scale frontways\b|\bfront lever\b/, 'hanging-scale-frontways'],
    [/\bstraddled l-sit\b/, 'straddled-l-sit'],
    [/\bl-sit\b/, 'l-sit'],
    [/\bv-sit\b/, 'v-sit'],
  ];
  return positions.find(([pattern]) => pattern.test(name))?.[1];
}

function parallelBarsSaltoFamily(name: string): string | undefined {
  if (/morisue/.test(name)) return 'salto-morisue';
  if (/belle/.test(name)) return 'salto-belle';
  if (/5\/4 salto fwd/.test(name)) return 'salto-five-quarter-forward';
  return undefined;
}

function horizontalBarFlightFamily(
  name: string,
  group: number,
  number: number,
): string | undefined {
  if (group === 2) {
    if ([15, 16, 18, 21, 23, 28, 29, 34, 36].includes(number)) {
      return 'flight-tkatchev-piatti';
    }
    if ([39, 40, 41, 42, 48].includes(number)) return 'flight-jaeger';
    if ([58, 60].includes(number)) return 'flight-gienger';
    if ([6, 9].includes(number)) return 'flight-markelov';
    if ([65, 66, 72, 78, 114].includes(number)) return 'flight-forward-salto-over-bar';
    if ([82, 83, 84, 88, 89, 90, 95, 96, 102, 108].includes(number)) {
      return 'flight-kovacs';
    }
  }
  if (/tkatchev|piatti/.test(name)) return 'flight-tkatchev-piatti';
  if (/kovacs|cassina|kolman|bretschneider/.test(name)) return 'flight-kovacs';
  if (/gienger/.test(name)) return 'flight-gienger';
  if (/jäger|jaeger/.test(name)) return 'flight-jaeger';
  if (/markelov/.test(name)) return 'flight-markelov';
  if (/salto fwd\. over the bar|salto forward over the bar/.test(name)) {
    return 'flight-forward-salto-over-bar';
  }
  return undefined;
}

function isSaltoVault(group: number, code: number): boolean {
  return group === 1 || group === 3 || group === 4 || (group === 2 && code >= 225) || code >= 507;
}

function extractElementGroup(page: XmlPage): number {
  const heading = page.texts
    .filter(({ top }) => top < 160)
    .sort((left, right) => left.top - right.top || left.left - right.left)
    .map(({ text }) => text)
    .join(' ');
  const match = /EG\s+((?:[IV]\s*)+):/.exec(heading);
  if (match === null) {
    throw new Error(`Could not find an element-group heading on Code page ${page.number}.`);
  }
  return romanToNumber((match[1] ?? '').replace(/\s+/g, ''));
}

function romanToNumber(value: string): number {
  const groups: Readonly<Record<string, number>> = { I: 1, II: 2, III: 3, IV: 4 };
  const number = groups[value];
  if (number === undefined) throw new Error(`Unsupported element group "${value}".`);
  return number;
}

function deriveColumnBoundaries(anchors: readonly TableAnchor[], page: number): readonly number[] {
  const starts = Array.from({ length: 6 }, (_, column) => {
    const positions = anchors
      .filter(({ number }) => (number - 1) % 6 === column)
      .map(({ text }) => text.left)
      .sort((left, right) => left - right);
    const clusters: number[][] = [];
    for (const position of positions) {
      const cluster = clusters.at(-1);
      if (cluster === undefined || position - (cluster.at(-1) ?? position) > 20) {
        clusters.push([position]);
      } else {
        cluster.push(position);
      }
    }
    const best = clusters.sort(
      (left, right) => right.length - left.length || (left[0] ?? 0) - (right[0] ?? 0),
    )[0];
    const start = best?.[0];
    if (start === undefined) {
      throw new Error(`Could not derive catalog column ${column + 1} on Code page ${page}.`);
    }
    return start;
  });
  return [0, ...starts.slice(1).map((start) => start - 3), 1262];
}

function extractTableAnchors(page: XmlPage): readonly TableAnchor[] {
  const anchors: TableAnchor[] = [];
  for (const text of page.texts) {
    if (text.top < 80 || text.top >= 800 || text.left < 20 || text.left >= 1245) continue;
    const complete = /^(\d{1,3})\.\s*/.exec(text.text);
    if (complete !== null) {
      anchors.push({ number: Number(complete[1]), text });
      continue;
    }

    const split = /^(\d{1,3})$/.exec(text.text);
    if (split === null) continue;
    const period = page.texts.find(
      (candidate) =>
        Math.abs(candidate.top - text.top) <= 2 &&
        candidate.left >= text.left + text.width - 2 &&
        candidate.left <= text.left + text.width + 8 &&
        candidate.text.startsWith('.'),
    );
    if (period !== undefined) anchors.push({ number: Number(split[1]), text });
  }
  return anchors;
}

function columnFor(left: number, boundaries: readonly number[]): number | undefined {
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    if (left >= (boundaries[index] ?? 0) && left < (boundaries[index + 1] ?? 0)) {
      return index;
    }
  }
  return undefined;
}

function requiredDifficulty(column: number): string {
  const difficulty = DIFFICULTIES[column];
  if (difficulty === undefined) throw new Error(`No difficulty exists for column ${column}.`);
  return difficulty;
}

function vaultGroupForLeft(left: number): number | undefined {
  if (left < 75 || left >= 1240) return undefined;
  return Math.floor((left - 75) / 230) + 1;
}

function closestRowTop(top: number, rowTops: readonly number[]): number {
  return rowTops.reduce((closest, candidate) =>
    Math.abs(candidate - top) < Math.abs(closest - top) ? candidate : closest,
  );
}

function cleanElementName(value: string): string {
  return value
    .replace(/\bf\s+wd\./gi, 'fwd.')
    .replace(/\bs\s+traight\b/gi, 'straight')
    .replace(/\bw\s+ith\b/gi, 'with')
    .replace(/\bt\s+hr\./gi, 'thr.')
    .replace(/\bel\s*-\s*grip\b/gi, 'el-grip')
    .replace(/\buppper\b/gi, 'upper')
    .replace(/\bstraddled\.\s+(?=cut|to)/gi, 'straddled ')
    .replace(/handstand\.on/gi, 'handstand on')
    .replace(/(\d)\s*\/\s*(\d)/g, '$1/$2')
    .replace(/[”]/g, '')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/([(])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|\s+$/g, '');
}

function correctElementName(
  apparatus: ElementFile['apparatus'],
  group: number,
  number: number,
  extracted: string,
): string {
  const corrections: Readonly<Record<string, string>> = {
    'pommel-horse:1:2': 'Forward scissor plus sideways travel; optional 1/2 turn',
    'floor-exercise:1:68': 'Endo — Backward jump plus pike-stretch or 1/1 turn into front support',
    'parallel-bars:2:4':
      'Bilozerchev - Peters / Dimic — Forward Stützkehr into one-rail handstand; optional added 1/4 or 3/4 turn into handstand',
    'parallel-bars:2:73': 'Healy into upper-arm hang; may begin in one-rail handstand',
    'parallel-bars:3:3':
      'Alsadi — Forward swing, backward straddle cut, then horizontal straight-body regrasp into bent and upper-arm support',
    'parallel-bars:3:50': 'Backward giant swing plus straddled cut into upper-arm hang',
    'horizontal-bar:1:56': 'Backward 1/2 turn passing through handstand into el-grip',
    'horizontal-bar:2:39':
      'Jäger — Backward swing into tucked or straddled forward salto to hang; el-grip start permitted',
    'horizontal-bar:2:96': 'Cassina / Pineda — Straight or piked Kovacs plus 1/1 turn',
  };
  return corrections[`${apparatus}:${group}:${number}`] ?? extracted;
}

function correctElementAliases(
  apparatus: ElementFile['apparatus'],
  group: number,
  number: number,
  extracted: readonly string[],
): readonly string[] {
  const corrections: Readonly<Record<string, readonly string[]>> = {
    'horizontal-bar:2:39': ['Jäger', 'Jaeger'],
    'horizontal-bar:2:96': ['Cassina', 'Pineda'],
  };
  return corrections[`${apparatus}:${group}:${number}`] ?? extracted;
}

function hasElementDescription(value: string): boolean {
  const normalized = value.replace(/\s+/g, ' ').trim().toLowerCase();
  return (
    /[A-Za-zÀ-ž]/.test(value) && value.length > 2 && !normalized.startsWith('prohibited for junior')
  );
}

function extractAliases(name: string): readonly string[] {
  const aliases = [...name.matchAll(/\(([^()]+)\)/g)]
    .flatMap((match) => (match[1] ?? '').split('/'))
    .map((alias) => alias.trim())
    .filter(
      (alias) =>
        /^[A-ZÀ-Ž][A-Za-zÀ-ž' -]+(?:\s\d)?$/.test(alias) &&
        !/^(?:also|with|without|max|minimum|legs|bent|straight)$/i.test(alias),
    );
  return [...new Set(aliases)];
}

function uniqueId(
  proposed: string,
  prefix: string,
  group: number,
  number: number | string,
  used: Set<string>,
): string {
  let id = proposed;
  if (used.has(id)) id = `${prefix}:${id.split(':').at(-1) ?? 'element'}-g${group}-n${number}`;
  used.add(id);
  return id;
}

function deduplicateByCode(elements: readonly ImportedElement[]): readonly ImportedElement[] {
  const byCode = new Map<string, ImportedElement>();
  for (const element of elements) {
    const key = `${element.code.group}:${element.code.number}`;
    if (byCode.has(key)) {
      throw new Error(`Imported duplicate official code ${key}.`);
    }
    byCode.set(key, element);
  }
  return [...byCode.values()];
}

function sortElements(elements: readonly ImportedElement[]): readonly ImportedElement[] {
  return [...elements].sort(
    (left, right) =>
      left.code.group - right.code.group ||
      compareCodeNumbers(left.code.number, right.code.number) ||
      left.id.localeCompare(right.id),
  );
}

function compareCodeNumbers(left: number | string, right: number | string): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'number') return -1;
  if (typeof right === 'number') return 1;
  return left.localeCompare(right);
}

function indexByCode(elements: readonly ImportedElement[]): ReadonlyMap<string, ImportedElement> {
  return new Map(
    elements.map((element) => [`${element.code.group}:${element.code.number}`, element]),
  );
}

async function loadExistingElements(
  dataDirectory: string,
): Promise<ReadonlyMap<ElementFile['apparatus'], readonly ImportedElement[]>> {
  const existing = new Map<ElementFile['apparatus'], readonly ImportedElement[]>();
  for (const apparatus of [...ELEMENT_TABLES.map(({ apparatus }) => apparatus), 'vault'] as const) {
    const file = resolve(dataDirectory, apparatus, 'elements.yaml');
    const parsed = elementFileSchema.parse(parse(await readFile(file, 'utf8')));
    existing.set(apparatus, parsed.elements as readonly ImportedElement[]);
  }
  return existing;
}

function requiredPage(pages: ReadonlyMap<number, XmlPage>, page: number): XmlPage {
  const value = pages.get(page);
  if (value === undefined) {
    throw new Error(`XML export does not include Code page ${page}.`);
  }
  return value;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, '');
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${basename(process.argv[1] ?? 'import-fig-catalog')}: ${message}\n`);
  process.exitCode = 1;
});
