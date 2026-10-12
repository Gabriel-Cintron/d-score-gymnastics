import type { ElementId } from './apparatus';
import type {
  ElementRoutine,
  ElementRoutineApparatusId,
  ResolvedElementOccurrence,
  ScorableElement,
} from './routine';
import { isScoreTenths, sumScoreTenths, type ScoreTenths } from './score-tenths';

export type ExplanationCode = `${string}.${string}`;
export type ExplanationParameters = Readonly<Record<string, boolean | number | string>>;

export interface ElementDecision {
  readonly creditedDifficulty: ScoreTenths;
  readonly elementId: ElementId;
  readonly occurrenceId: string;
  readonly reason: ExplanationCode;
  readonly reasonParameters: ExplanationParameters;
  readonly status: 'counted' | 'excluded';
}

export const DIFFICULTY_AWARD_COMPONENTS = ['element-group', 'connection', 'bonus'] as const;
export type DifficultyAwardComponent = (typeof DIFFICULTY_AWARD_COMPONENTS)[number];

export interface DifficultyAward {
  readonly component: DifficultyAwardComponent;
  readonly occurrenceIds: readonly string[];
  readonly reason: ExplanationCode;
  readonly reasonParameters: ExplanationParameters;
  readonly value: ScoreTenths;
}

export interface DifficultyWarning {
  readonly code: ExplanationCode;
  readonly occurrenceIds: readonly string[];
  readonly parameters: ExplanationParameters;
}

export interface RoutineEvaluationDraft {
  readonly awards: readonly DifficultyAward[];
  readonly elementDecisions: readonly ElementDecision[];
  readonly warnings: readonly DifficultyWarning[];
}

export interface RoutineEvaluationContext {
  readonly occurrences: readonly ResolvedElementOccurrence[];
  readonly routine: ElementRoutine;
}

export interface RoutineEvaluator {
  readonly apparatus: ElementRoutineApparatusId;
  readonly id: ExplanationCode;
  evaluate(context: RoutineEvaluationContext): RoutineEvaluationDraft;
}

export interface DifficultyBreakdown {
  readonly bonus: ScoreTenths;
  readonly connection: ScoreTenths;
  readonly elementDifficulty: ScoreTenths;
  readonly elementGroup: ScoreTenths;
}

export interface DifficultyResult {
  readonly apparatus: ElementRoutineApparatusId;
  readonly awards: readonly DifficultyAward[];
  readonly breakdown: DifficultyBreakdown;
  readonly elementDecisions: readonly ElementDecision[];
  readonly evaluatorId: ExplanationCode;
  readonly total: ScoreTenths;
  readonly warnings: readonly DifficultyWarning[];
}

export type CalculationIssueCode =
  | 'evaluator.apparatus-mismatch'
  | 'routine.duplicate-occurrence-id'
  | 'routine.duplicate-relationship-id'
  | 'routine.element-apparatus-mismatch'
  | 'routine.element-not-found'
  | 'routine.duplicate-occurrence-qualifier'
  | 'routine.empty-occurrence-qualifier'
  | 'routine.empty-occurrence-id'
  | 'routine.empty-relationship-id'
  | 'routine.landing-occurrence-not-found'
  | 'routine.relationship-duplicate-occurrence'
  | 'routine.relationship-occurrence-not-found';

export interface CalculationIssue {
  readonly code: CalculationIssueCode;
  readonly parameters: ExplanationParameters;
  readonly path: readonly (number | string)[];
}

export type DifficultyCalculationOutcome =
  | { readonly issues: readonly CalculationIssue[]; readonly ok: false }
  | { readonly ok: true; readonly result: DifficultyResult };

export interface CalculateDifficultyInput {
  readonly elementLookup: ReadonlyMap<ElementId, ScorableElement>;
  readonly evaluator: RoutineEvaluator;
  readonly routine: ElementRoutine;
}

export class EvaluationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationContractError';
  }
}

export function calculateDifficulty({
  elementLookup,
  evaluator,
  routine,
}: CalculateDifficultyInput): DifficultyCalculationOutcome {
  const issues: CalculationIssue[] = [];
  const resolvedOccurrences: ResolvedElementOccurrence[] = [];
  const occurrenceIds = new Set<string>();

  if (evaluator.apparatus !== routine.apparatus) {
    issues.push({
      code: 'evaluator.apparatus-mismatch',
      parameters: {
        evaluatorApparatus: evaluator.apparatus,
        routineApparatus: routine.apparatus,
      },
      path: ['apparatus'],
    });
  }

  routine.occurrences.forEach((occurrence, position) => {
    const path = ['occurrences', position] as const;

    if (occurrence.occurrenceId.trim().length === 0) {
      issues.push({
        code: 'routine.empty-occurrence-id',
        parameters: {},
        path: [...path, 'occurrenceId'],
      });
    } else if (occurrenceIds.has(occurrence.occurrenceId)) {
      issues.push({
        code: 'routine.duplicate-occurrence-id',
        parameters: { occurrenceId: occurrence.occurrenceId },
        path: [...path, 'occurrenceId'],
      });
    } else {
      occurrenceIds.add(occurrence.occurrenceId);
    }

    const qualifiers = new Set<string>();
    occurrence.qualifiers?.forEach((qualifier, qualifierIndex) => {
      if (qualifier.trim().length === 0) {
        issues.push({
          code: 'routine.empty-occurrence-qualifier',
          parameters: {},
          path: [...path, 'qualifiers', qualifierIndex],
        });
      } else if (qualifiers.has(qualifier)) {
        issues.push({
          code: 'routine.duplicate-occurrence-qualifier',
          parameters: { qualifier },
          path: [...path, 'qualifiers', qualifierIndex],
        });
      } else {
        qualifiers.add(qualifier);
      }
    });

    const element = elementLookup.get(occurrence.elementId);
    if (element === undefined) {
      issues.push({
        code: 'routine.element-not-found',
        parameters: { elementId: occurrence.elementId },
        path: [...path, 'elementId'],
      });
      return;
    }

    if (element.apparatus !== routine.apparatus) {
      issues.push({
        code: 'routine.element-apparatus-mismatch',
        parameters: {
          elementApparatus: element.apparatus,
          elementId: element.id,
          routineApparatus: routine.apparatus,
        },
        path: [...path, 'elementId'],
      });
      return;
    }

    resolvedOccurrences.push({
      element,
      occurrenceId: occurrence.occurrenceId,
      position,
      qualifiers: [...(occurrence.qualifiers ?? [])],
    });
  });

  validateRelationships(routine, occurrenceIds, issues);

  if (routine.landing !== undefined && !occurrenceIds.has(routine.landing.occurrenceId)) {
    issues.push({
      code: 'routine.landing-occurrence-not-found',
      parameters: { occurrenceId: routine.landing.occurrenceId },
      path: ['landing', 'occurrenceId'],
    });
  }

  if (issues.length > 0) {
    return { issues, ok: false };
  }

  const draft = evaluator.evaluate({ occurrences: resolvedOccurrences, routine });
  const orderedDecisions = validateEvaluationDraft(draft, resolvedOccurrences);
  const breakdown = buildBreakdown(orderedDecisions, draft.awards);

  return {
    ok: true,
    result: {
      apparatus: routine.apparatus,
      awards: [...draft.awards],
      breakdown,
      elementDecisions: orderedDecisions,
      evaluatorId: evaluator.id,
      total: sumScoreTenths(Object.values(breakdown)),
      warnings: [...draft.warnings],
    },
  };
}

function validateRelationships(
  routine: ElementRoutine,
  occurrenceIds: ReadonlySet<string>,
  issues: CalculationIssue[],
): void {
  const relationshipIds = new Set<string>();

  routine.relationships?.forEach((relationship, relationshipIndex) => {
    const idKey = relationship.kind === 'connection' ? 'connectionId' : 'sequenceId';
    const relationshipId =
      relationship.kind === 'connection' ? relationship.connectionId : relationship.sequenceId;
    const path = ['relationships', relationshipIndex] as const;

    if (relationshipId.trim().length === 0) {
      issues.push({
        code: 'routine.empty-relationship-id',
        parameters: { kind: relationship.kind },
        path: [...path, idKey],
      });
    } else if (relationshipIds.has(relationshipId)) {
      issues.push({
        code: 'routine.duplicate-relationship-id',
        parameters: { relationshipId },
        path: [...path, idKey],
      });
    } else {
      relationshipIds.add(relationshipId);
    }

    const referenced = new Set<string>();
    relationship.occurrenceIds.forEach((occurrenceId, occurrenceIndex) => {
      if (referenced.has(occurrenceId)) {
        issues.push({
          code: 'routine.relationship-duplicate-occurrence',
          parameters: { occurrenceId, relationshipId },
          path: [...path, 'occurrenceIds', occurrenceIndex],
        });
      } else {
        referenced.add(occurrenceId);
      }

      if (!occurrenceIds.has(occurrenceId)) {
        issues.push({
          code: 'routine.relationship-occurrence-not-found',
          parameters: { occurrenceId, relationshipId },
          path: [...path, 'occurrenceIds', occurrenceIndex],
        });
      }
    });
  });
}

function validateEvaluationDraft(
  draft: RoutineEvaluationDraft,
  occurrences: readonly ResolvedElementOccurrence[],
): ElementDecision[] {
  const occurrenceById = new Map(
    occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  const decisionByOccurrenceId = new Map<string, ElementDecision>();

  for (const decision of draft.elementDecisions) {
    const occurrence = occurrenceById.get(decision.occurrenceId);
    if (occurrence === undefined) {
      throw contractError(`Decision references unknown occurrence "${decision.occurrenceId}".`);
    }
    if (decisionByOccurrenceId.has(decision.occurrenceId)) {
      throw contractError(`More than one decision exists for "${decision.occurrenceId}".`);
    }
    if (decision.elementId !== occurrence.element.id) {
      throw contractError(`Decision for "${decision.occurrenceId}" references the wrong element.`);
    }
    assertScoreTenths(decision.creditedDifficulty, 'Decision difficulty');
    assertExplanationCode(decision.reason);
    if (decision.status === 'excluded' && decision.creditedDifficulty !== 0) {
      throw contractError('An excluded element decision must credit zero difficulty.');
    }
    decisionByOccurrenceId.set(decision.occurrenceId, decision);
  }

  const orderedDecisions = occurrences.map((occurrence) => {
    const decision = decisionByOccurrenceId.get(occurrence.occurrenceId);
    if (decision === undefined) {
      throw contractError(`No element decision exists for "${occurrence.occurrenceId}".`);
    }
    return decision;
  });

  for (const award of draft.awards) {
    if (!DIFFICULTY_AWARD_COMPONENTS.includes(award.component)) {
      throw contractError(`Award component "${String(award.component)}" is not supported.`);
    }
    assertScoreTenths(award.value, 'Award value');
    assertExplanationCode(award.reason);
    assertKnownOccurrenceIds(award.occurrenceIds, occurrenceById, 'Award');
  }

  for (const warning of draft.warnings) {
    assertExplanationCode(warning.code);
    assertKnownOccurrenceIds(warning.occurrenceIds, occurrenceById, 'Warning');
  }

  return orderedDecisions;
}

function buildBreakdown(
  decisions: readonly ElementDecision[],
  awards: readonly DifficultyAward[],
): DifficultyBreakdown {
  const awardsFor = (component: DifficultyAwardComponent): ScoreTenths =>
    sumScoreTenths(
      awards.filter((award) => award.component === component).map((award) => award.value),
    );

  return {
    bonus: awardsFor('bonus'),
    connection: awardsFor('connection'),
    elementDifficulty: sumScoreTenths(decisions.map((decision) => decision.creditedDifficulty)),
    elementGroup: awardsFor('element-group'),
  };
}

function assertKnownOccurrenceIds(
  occurrenceIds: readonly string[],
  knownOccurrences: ReadonlyMap<string, ResolvedElementOccurrence>,
  subject: string,
): void {
  for (const occurrenceId of occurrenceIds) {
    if (!knownOccurrences.has(occurrenceId)) {
      throw contractError(`${subject} references unknown occurrence "${occurrenceId}".`);
    }
  }
}

function assertScoreTenths(value: unknown, subject: string): asserts value is ScoreTenths {
  if (!isScoreTenths(value)) {
    throw contractError(`${subject} must be a non-negative integer number of tenths.`);
  }
}

function assertExplanationCode(code: string): asserts code is ExplanationCode {
  if (!isExplanationCode(code)) {
    throw contractError(`Explanation code "${code}" is not stable machine-readable form.`);
  }
}

export function isExplanationCode(value: string): value is ExplanationCode {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value);
}

function contractError(message: string): EvaluationContractError {
  return new EvaluationContractError(message);
}
