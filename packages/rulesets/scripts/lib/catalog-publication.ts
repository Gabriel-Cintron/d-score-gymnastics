import { createHash } from 'node:crypto';

import { APPARATUS_CODE_BY_ID, APPARATUS_IDS, type ApparatusId } from '@d-score-gymnastics/scoring';

export const PUBLIC_ELEMENT_ID_PATTERN = /^(fx|ph|sr|vt|pb|hb):mag-\d{4}$/;

export interface CatalogElementSnapshot {
  readonly aliases: readonly string[];
  readonly apparatus: ApparatusId;
  readonly code: {
    readonly group: number;
    readonly number: number | string;
  };
  readonly id: string;
  readonly name: string;
}

export interface PrivateCatalogElementRecord extends CatalogElementSnapshot {
  readonly publicId: string;
}

export interface PrivateCatalogArchive {
  readonly archivedAt: string;
  readonly elements: readonly PrivateCatalogElementRecord[];
  readonly rulesetId: string;
  readonly schemaVersion: 1;
  readonly sourceDataVersion: string;
  readonly targetDataVersion: string;
}

export interface PublicWordingElement {
  readonly aliases: readonly string[];
  readonly apparatus: ApparatusId;
  readonly id: string;
  readonly name: string;
}

export interface WordingReviewIssue {
  readonly elementId: string;
  readonly kind:
    | 'alias-too-long'
    | 'ambiguous-label'
    | 'duplicate-label'
    | 'exact-source-match'
    | 'label-too-long'
    | 'shared-source-phrase';
  readonly message: string;
}

export function allocateNeutralElementIds(
  elements: readonly CatalogElementSnapshot[],
): ReadonlyMap<string, string> {
  const mapping = new Map<string, string>();
  for (const apparatus of APPARATUS_IDS) {
    const prefix = APPARATUS_CODE_BY_ID[apparatus];
    const apparatusElements = elements.filter((element) => element.apparatus === apparatus);
    apparatusElements.forEach((element, index) => {
      mapping.set(element.id, neutralElementId(prefix, index + 1));
    });
  }
  return mapping;
}

export function neutralElementId(prefix: string, sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 9_999) {
    throw new Error(
      `Neutral element sequence must be an integer from 1 through 9999; got ${sequence}.`,
    );
  }
  return `${prefix}:mag-${String(sequence).padStart(4, '0')}`;
}

export function nextNeutralSequence(ids: readonly string[], prefix: string): number {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}:mag-(\\d{4})$`);
  return (
    ids.reduce((maximum, id) => {
      const match = pattern.exec(id);
      return Math.max(maximum, match === null ? 0 : Number(match[1]));
    }, 0) + 1
  );
}

export function replaceKnownElementIds<T>(value: T, mapping: ReadonlyMap<string, string>): T {
  if (typeof value === 'string') {
    return (mapping.get(value) ?? value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceKnownElementIds(item, mapping)) as T;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceKnownElementIds(item, mapping)]),
    ) as T;
  }
  return value;
}

export function publicWordingDigest(elements: readonly PublicWordingElement[]): string {
  const canonical = [...elements]
    .sort((left, right) => left.id.localeCompare(right.id, 'en-US'))
    .map(({ aliases, apparatus, id, name }) => ({
      aliases: [...aliases],
      apparatus,
      id,
      name,
    }));
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical)).digest('hex')}`;
}

export function findWordingReviewIssues(
  publicElements: readonly PublicWordingElement[],
  privateElements: readonly PrivateCatalogElementRecord[],
): readonly WordingReviewIssue[] {
  const sourceByPublicId = new Map(privateElements.map((element) => [element.publicId, element]));
  const idsByLabel = new Map<string, string[]>();
  const issues: WordingReviewIssue[] = [];

  for (const element of publicElements) {
    const normalizedLabel = `${element.apparatus}:${normalizeWords(element.name).join(' ')}`;
    const matchingIds = idsByLabel.get(normalizedLabel) ?? [];
    matchingIds.push(element.id);
    idsByLabel.set(normalizedLabel, matchingIds);

    if (element.name.length > 80) {
      issues.push({
        elementId: element.id,
        kind: 'label-too-long',
        message: `Public label has ${element.name.length} characters; review labels over 80.`,
      });
    }
    for (const alias of element.aliases) {
      if (normalizeWords(alias).length > 5) {
        issues.push({
          elementId: element.id,
          kind: 'alias-too-long',
          message: `Alias "${alias}" contains more than five words.`,
        });
      }
    }

    const source = sourceByPublicId.get(element.id);
    if (source === undefined) {
      issues.push({
        elementId: element.id,
        kind: 'ambiguous-label',
        message: 'No private source record exists for this public element ID.',
      });
      continue;
    }
    const sourceWords = normalizeWords(source.name);
    const publicWords = normalizeWords(element.name);
    if (sourceWords.length > 3 && sourceWords.join(' ') === publicWords.join(' ')) {
      issues.push({
        elementId: element.id,
        kind: 'exact-source-match',
        message: 'Public label exactly matches the archived source wording after normalization.',
      });
    } else {
      const phrase = firstSharedRun(sourceWords, publicWords, 6);
      if (phrase !== undefined) {
        issues.push({
          elementId: element.id,
          kind: 'shared-source-phrase',
          message: `Public label shares a six-word source phrase: "${phrase}".`,
        });
      }
    }
  }

  for (const ids of idsByLabel.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      issues.push({
        elementId: id,
        kind: 'duplicate-label',
        message: `Public label is duplicated by: ${ids.filter((candidate) => candidate !== id).join(', ')}.`,
      });
    }
  }

  return issues.sort(
    (left, right) =>
      left.elementId.localeCompare(right.elementId, 'en-US') ||
      left.kind.localeCompare(right.kind, 'en-US'),
  );
}

// Normalization produces an editorial draft, not proof of independent expression.
// Candidate wording is not evidence that source-use conditions have been met.
export function createPublicLabelCandidate(sourceName: string, aliases: readonly string[]): string {
  const sourceWithoutAliases = aliases.reduce(
    (label, alias) => label.replace(new RegExp(`\\s*\\(${escapeRegExp(alias)}\\)`, 'giu'), ''),
    sourceName.split('*')[0] ?? sourceName,
  );
  let label = sourceWithoutAliases
    .replace(/[½]/gu, '1/2')
    .replace(/[¼]/gu, '1/4')
    .replace(/[¾]/gu, '3/4')
    .replace(/\bhdspr\.(?=\s|$)|\bhdspr\b/giu, 'handspring')
    .replace(/\byur\.(?=\s|$)|\byur\b/giu, 'Yurchenko')
    .replace(/\brou\.\s*off\b/giu, 'round-off')
    .replace(/\btsuk\.(?=\s|$)|\btsuk\b/giu, 'Tsukahara')
    .replace(/\bdbl\.(?=\s|$)|\bdbl\b/giu, 'double')
    .replace(/\bfr\.(?=\s|$)|\bfr\b/giu, 'from')
    .replace(/\bsw\.(?=\s|$)|\bsw\b/giu, 'swing')
    .replace(/\bswg\.(?=\s|$)|\bswg\b/giu, 'swing')
    .replace(/\bhoriz\.(?=\s|$)|\bhoriz\b/giu, 'horizontal')
    .replace(/\binv\.(?=\s|$)|\binv\b/giu, 'inverted')
    .replace(/\bovgr\.(?=\s|$)|\bovgr\b/giu, 'overgrip')
    .replace(/\bungr\.(?=\s|$)|\bungr\b/giu, 'undergrip')
    .replace(/\bhg\.(?=\s|$)|\bhg\b/giu, 'hang')
    .replace(/\bt\.w\./giu, 'tucked plus')
    .replace(/\bp\.(?=\s|\)|$)/giu, 'piked')
    .replace(/\btuck\.(?=\s|\)|$)/giu, 'tucked')
    .replace(/\ba\.(?=\s|$)/giu, 'and')
    .replace(/(\d\/\d)\s*t\./giu, '$1 turn')
    .replace(/\bhdst\.(?=\s|$)|\bhdst\b/giu, 'handstand')
    .replace(/\bfwd\.(?=\s|$)|\bfwd\b/giu, 'forward')
    .replace(/\bbwd\.(?=\s|$)|\bbwd\b/giu, 'backward')
    .replace(/\bstr\.(?=\s|$)|\bstr\b/giu, 'straight')
    .replace(/\bstrad\.(?=\s|$)|\bstrad\b/giu, 'straddled')
    .replace(/\bsup\.(?=\s|$)|\bsup\b/giu, 'support')
    .replace(/\bw\.(?=\s|$)/giu, 'plus')
    .replace(/\bwith\b/giu, 'plus')
    .replace(/\bthr\.(?=\s|$)|\bthr\b/giu, 'passing through')
    .replace(/\bt\.(?=\s|$)|\bturns?\b/giu, 'rotation')
    .replace(/^From handstand lower to\b/iu, 'Lower out of handstand into')
    .replace(/^From ([^,]+),\s*(.+)$/iu, '$2; begins in $1')
    .replace(/\bsalto\b/giu, 'somersault')
    .replace(/\bfrom\b/giu, 'beginning in')
    .replace(/\bto\b/giu, 'into')
    .replace(/\balso\b/giu, 'alternative:')
    .replace(/\band\b/giu, 'then')
    .replace(/\((\d)\s*s\.?\)/giu, '$1-second hold')
    .replace(/\b(\d)\s*s\.?\b/giu, '$1-second hold')
    .replace(/\b([A-Z])\s*-\s*(sit|cross)\b/gu, '$1-$2')
    .replace(/\bholdor\b/giu, 'hold or')
    .replace(/\bn handstand\b/giu, 'in handstand')
    .replace(/\bmixt\b/giu, 'mixed grip')
    .replace(/\s*\(\s*/gu, ' (')
    .replace(/\s*\)\s*/gu, ') ')
    .replace(/\.(?=\s+\d-second hold)/gu, '')
    .replace(/\.;/gu, ';')
    .replace(/\.{2,}/gu, '.')
    .replace(/\s+([,.;:)])/gu, '$1')
    .replace(/([(])\s+/gu, '$1')
    .replace(/\s+/gu, ' ')
    .replace(/\s*\.\s*$/u, '')
    .trim();

  label = sentenceCase(label);
  const heading = aliases[0]?.trim();
  if (heading === undefined || heading.length === 0) return label;
  const detail = label.replace(new RegExp(`^${escapeRegExp(heading)}\\b\\s*[-—,:]?\\s*`, 'iu'), '');
  return detail.length === 0 ? heading : `${heading} — ${detail}`;
}

function sentenceCase(value: string): string {
  const first = value[0];
  return first === undefined ? value : `${first.toLocaleUpperCase('en-US')}${value.slice(1)}`;
}

function normalizeWords(value: string): readonly string[] {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()
    .split(/\s+/u)
    .filter((word) => word.length > 0);
}

function firstSharedRun(
  sourceWords: readonly string[],
  publicWords: readonly string[],
  length: number,
): string | undefined {
  if (sourceWords.length < length || publicWords.length < length) return undefined;
  const sourceRuns = new Set<string>();
  for (let index = 0; index <= sourceWords.length - length; index += 1) {
    sourceRuns.add(sourceWords.slice(index, index + length).join(' '));
  }
  for (let index = 0; index <= publicWords.length - length; index += 1) {
    const run = publicWords.slice(index, index + length).join(' ');
    if (sourceRuns.has(run)) return run;
  }
  return undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
