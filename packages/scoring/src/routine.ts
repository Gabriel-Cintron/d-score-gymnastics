import type { ApparatusId, ElementId } from './apparatus';
import type { ScoreTenths } from './score-tenths';

export const ELEMENT_ROUTINE_APPARATUS_IDS = [
  'floor-exercise',
  'pommel-horse',
  'still-rings',
  'parallel-bars',
  'horizontal-bar',
] as const;

export type ElementRoutineApparatusId = (typeof ELEMENT_ROUTINE_APPARATUS_IDS)[number];

export const ELEMENT_ROLE_IDS = ['dismount'] as const;
export type ElementRoleId = (typeof ELEMENT_ROLE_IDS)[number];

/** Ruleset-owned classification IDs used by focused apparatus policies. */
export type ElementTraitId = string;
export type ElementFamilyId = string;

export interface RoutineConnection {
  readonly connectionId: string;
  readonly kind: 'connection';
  readonly occurrenceIds: readonly [string, string];
}

export interface RoutineSequence {
  readonly kind: 'sequence';
  readonly occurrenceIds: readonly [string, string, ...string[]];
  /** A ruleset-owned identifier, such as `pommel-flop`. */
  readonly sequenceType: string;
  readonly sequenceId: string;
}

export type RoutineRelationship = RoutineConnection | RoutineSequence;

export interface RoutineLanding {
  readonly occurrenceId: string;
  readonly outcome: 'not-stuck' | 'stuck';
}

export interface RoutineElementOccurrence {
  /** Identifies this performance, even when the same catalog element appears more than once. */
  readonly occurrenceId: string;
  readonly elementId: ElementId;
  /** Ruleset-owned execution details needed when one Code entry permits multiple variants. */
  readonly qualifiers?: readonly string[];
}

export interface ElementRoutine {
  readonly apparatus: ElementRoutineApparatusId;
  readonly landing?: RoutineLanding;
  readonly occurrences: readonly RoutineElementOccurrence[];
  readonly relationships?: readonly RoutineRelationship[];
}

export interface VaultRoutine {
  readonly apparatus: 'vault';
  readonly landing?: 'not-stuck' | 'stuck';
  readonly vaultId: ElementId;
}

/** The smallest catalog view needed by scoring policies. */
export interface ScorableElement {
  readonly apparatus: ApparatusId;
  readonly code: {
    readonly group: number;
    /** Numeric table position, or a stable publication key until FIG assigns one. */
    readonly number: number | string;
  };
  readonly difficulty: {
    readonly tenths: ScoreTenths;
  };
  readonly id: ElementId;
  readonly families: readonly ElementFamilyId[];
  readonly roles: readonly ElementRoleId[];
  readonly traits: readonly ElementTraitId[];
}

export interface ResolvedElementOccurrence {
  readonly element: ScorableElement;
  readonly occurrenceId: string;
  readonly position: number;
  readonly qualifiers: readonly string[];
}

export function indexScorableElements(
  elements: readonly ScorableElement[],
): ReadonlyMap<ElementId, ScorableElement> {
  const indexed = new Map<ElementId, ScorableElement>();
  for (const element of elements) {
    if (indexed.has(element.id)) {
      throw new Error(`Cannot index duplicate element ID "${element.id}".`);
    }
    indexed.set(element.id, element);
  }
  return indexed;
}
