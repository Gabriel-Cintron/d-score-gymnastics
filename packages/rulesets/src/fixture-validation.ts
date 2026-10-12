import type { ApparatusId } from '@d-score-gymnastics/scoring';

import { FIG_ELEMENT_COUNTING_EVALUATOR_ID } from './fig/element-counting';
import { FIG_VAULT_EVALUATOR_ID } from './fig/vault';
import {
  KERNEL_CREDIT_ALL_EVALUATOR_ID,
  type ElementScoringFixture,
  type VaultScoringFixture,
} from './scoring-fixture';
import type { DataPathSegment, RulesetSource, ValidationIssue } from './validation';

interface FixtureOccurrence {
  readonly elementId: string;
  readonly index: number;
}

const breakdownComponents = ['bonus', 'connection', 'elementDifficulty', 'elementGroup'] as const;

export function validateScoringFixtures(
  source: RulesetSource,
  elementApparatus: ReadonlyMap<string, ApparatusId>,
  issues: ValidationIssue[],
): void {
  if (source.fixtures.length === 0) {
    issues.push({
      code: 'fixture.missing',
      file: source.directory,
      message: 'Ruleset must include at least one scoring fixture.',
      path: [],
    });
    return;
  }

  const fixtureIds = new Map<string, string>();

  for (const fixtureSource of source.fixtures) {
    const { data, file } = fixtureSource;
    const previousFixtureFile = fixtureIds.get(data.id);
    if (previousFixtureFile !== undefined) {
      issues.push({
        code: 'fixture.duplicate_id',
        file,
        message: `Fixture ID "${data.id}" is already defined in ${previousFixtureFile}.`,
        path: ['id'],
      });
    } else {
      fixtureIds.set(data.id, file);
    }

    if (data.rulesetId !== source.manifest.id) {
      issues.push({
        code: 'fixture.ruleset_mismatch',
        file,
        message: `Fixture rulesetId must be "${source.manifest.id}".`,
        path: ['rulesetId'],
      });
    }

    const expectedEvaluatorId =
      data.kind === 'fig-vault'
        ? FIG_VAULT_EVALUATOR_ID
        : data.kind === 'fig-element-counting' || data.kind === 'fig-apparatus'
          ? FIG_ELEMENT_COUNTING_EVALUATOR_ID
          : KERNEL_CREDIT_ALL_EVALUATOR_ID;
    if (data.evaluatorId !== expectedEvaluatorId) {
      issues.push({
        code: 'fixture.evaluator_mismatch',
        file,
        message: `Fixture kind "${data.kind}" requires evaluatorId "${expectedEvaluatorId}".`,
        path: ['evaluatorId'],
      });
    }

    if (data.kind === 'fig-vault') {
      validateVaultFixture(data, file, elementApparatus, issues);
      continue;
    }

    const occurrences = collectFixtureOccurrences(data, file, elementApparatus, issues);
    validateRoutineClaims(data, file, occurrences, issues);
    validateFixtureExpectedResult(data, file, occurrences, issues);
  }
}

function validateRoutineClaims(
  fixture: ElementScoringFixture,
  file: string,
  occurrences: ReadonlyMap<string, FixtureOccurrence>,
  issues: ValidationIssue[],
): void {
  if (
    fixture.routine.landing !== undefined &&
    !occurrences.has(fixture.routine.landing.occurrenceId)
  ) {
    issues.push({
      code: 'fixture.landing_unknown_occurrence',
      file,
      message: `Landing references unknown occurrence "${fixture.routine.landing.occurrenceId}".`,
      path: ['routine', 'landing', 'occurrenceId'],
    });
  }

  const relationshipIds = new Map<string, number>();
  fixture.routine.relationships?.forEach((relationship, index) => {
    const relationshipId =
      relationship.kind === 'connection' ? relationship.connectionId : relationship.sequenceId;
    const previous = relationshipIds.get(relationshipId);
    if (previous !== undefined) {
      issues.push({
        code: 'fixture.duplicate_relationship_id',
        file,
        message: `Relationship ID "${relationshipId}" is already used at routine.relationships[${previous}].`,
        path: ['routine', 'relationships', index],
      });
    } else {
      relationshipIds.set(relationshipId, index);
    }
    validateOccurrenceReferences(
      relationship.occurrenceIds,
      occurrences,
      file,
      ['routine', 'relationships', index, 'occurrenceIds'],
      issues,
    );
  });
}

function collectFixtureOccurrences(
  fixture: ElementScoringFixture,
  file: string,
  elementApparatus: ReadonlyMap<string, ApparatusId>,
  issues: ValidationIssue[],
): ReadonlyMap<string, FixtureOccurrence> {
  const occurrences = new Map<string, FixtureOccurrence>();

  fixture.routine.occurrences.forEach((occurrence, index) => {
    const previousOccurrence = occurrences.get(occurrence.occurrenceId);
    if (previousOccurrence !== undefined) {
      issues.push({
        code: 'fixture.duplicate_occurrence_id',
        file,
        message: `Occurrence ID "${occurrence.occurrenceId}" is already used at routine.occurrences[${previousOccurrence.index}].`,
        path: ['routine', 'occurrences', index, 'occurrenceId'],
      });
    } else {
      occurrences.set(occurrence.occurrenceId, { elementId: occurrence.elementId, index });
    }

    const qualifiers = new Set<string>();
    occurrence.qualifiers?.forEach((qualifier, qualifierIndex) => {
      if (qualifiers.has(qualifier)) {
        issues.push({
          code: 'fixture.duplicate_occurrence_qualifier',
          file,
          message: `Qualifier "${qualifier}" appears more than once.`,
          path: ['routine', 'occurrences', index, 'qualifiers', qualifierIndex],
        });
      }
      qualifiers.add(qualifier);
    });

    const apparatus = elementApparatus.get(occurrence.elementId);
    if (apparatus === undefined) {
      issues.push({
        code: 'fixture.unknown_element',
        file,
        message: `Element "${occurrence.elementId}" is not defined by this ruleset.`,
        path: ['routine', 'occurrences', index, 'elementId'],
      });
    } else if (apparatus !== fixture.routine.apparatus) {
      issues.push({
        code: 'fixture.element_apparatus_mismatch',
        file,
        message: `Element "${occurrence.elementId}" belongs to ${apparatus}, not ${fixture.routine.apparatus}.`,
        path: ['routine', 'occurrences', index, 'elementId'],
      });
    }
  });

  return occurrences;
}

function validateFixtureExpectedResult(
  fixture: ElementScoringFixture,
  file: string,
  occurrences: ReadonlyMap<string, FixtureOccurrence>,
  issues: ValidationIssue[],
): void {
  const decisions = new Map<string, number>();

  fixture.expected.elementDecisions.forEach((decision, index) => {
    const occurrence = occurrences.get(decision.occurrenceId);
    if (occurrence === undefined) {
      issues.push({
        code: 'fixture.decision_unknown_occurrence',
        file,
        message: `Decision references unknown occurrence "${decision.occurrenceId}".`,
        path: ['expected', 'elementDecisions', index, 'occurrenceId'],
      });
    } else if (occurrence.elementId !== decision.elementId) {
      issues.push({
        code: 'fixture.decision_element_mismatch',
        file,
        message: `Decision for "${decision.occurrenceId}" references the wrong element.`,
        path: ['expected', 'elementDecisions', index, 'elementId'],
      });
    }

    const previousDecisionIndex = decisions.get(decision.occurrenceId);
    if (previousDecisionIndex !== undefined) {
      issues.push({
        code: 'fixture.duplicate_decision',
        file,
        message: `A decision for "${decision.occurrenceId}" already exists at elementDecisions[${previousDecisionIndex}].`,
        path: ['expected', 'elementDecisions', index, 'occurrenceId'],
      });
    } else {
      decisions.set(decision.occurrenceId, index);
    }

    if (decision.status === 'excluded' && decision.creditedDifficulty !== 0) {
      issues.push({
        code: 'fixture.excluded_element_has_value',
        file,
        message: 'An excluded element must credit 0.0 difficulty.',
        path: ['expected', 'elementDecisions', index, 'creditedDifficulty'],
      });
    }
  });

  for (const occurrenceId of occurrences.keys()) {
    if (!decisions.has(occurrenceId)) {
      issues.push({
        code: 'fixture.missing_decision',
        file,
        message: `No expected decision exists for "${occurrenceId}".`,
        path: ['expected', 'elementDecisions'],
      });
    }
  }

  fixture.expected.awards.forEach((award, index) => {
    validateOccurrenceReferences(
      award.occurrenceIds,
      occurrences,
      file,
      ['expected', 'awards', index, 'occurrenceIds'],
      issues,
    );
  });
  fixture.expected.warnings.forEach((warning, index) => {
    validateOccurrenceReferences(
      warning.occurrenceIds,
      occurrences,
      file,
      ['expected', 'warnings', index, 'occurrenceIds'],
      issues,
    );
  });

  const expectedBreakdown = calculateExpectedBreakdown(fixture);
  for (const component of breakdownComponents) {
    const expectedValue = expectedBreakdown[component];
    if (fixture.expected.breakdown[component] !== expectedValue) {
      issues.push({
        code: 'fixture.breakdown_mismatch',
        file,
        message: `${component} must equal ${expectedValue.toFixed(1)} based on the expected decisions and awards.`,
        path: ['expected', 'breakdown', component],
      });
    }
  }

  const expectedTotal = sumFixturePoints(Object.values(fixture.expected.breakdown));
  if (fixture.expected.total !== expectedTotal) {
    issues.push({
      code: 'fixture.total_mismatch',
      file,
      message: `Total must equal ${expectedTotal.toFixed(1)} based on the expected breakdown.`,
      path: ['expected', 'total'],
    });
  }
}

function calculateExpectedBreakdown(
  fixture: ElementScoringFixture,
): ElementScoringFixture['expected']['breakdown'] {
  const awardTotal = (component: 'bonus' | 'connection' | 'element-group'): number =>
    sumFixturePoints(
      fixture.expected.awards
        .filter((award) => award.component === component)
        .map((award) => award.value),
    );

  return {
    bonus: awardTotal('bonus'),
    connection: awardTotal('connection'),
    elementDifficulty: sumFixturePoints(
      fixture.expected.elementDecisions.map((decision) => decision.creditedDifficulty),
    ),
    elementGroup: awardTotal('element-group'),
  };
}

function validateVaultFixture(
  fixture: VaultScoringFixture,
  file: string,
  elementApparatus: ReadonlyMap<string, ApparatusId>,
  issues: ValidationIssue[],
): void {
  const apparatus = elementApparatus.get(fixture.routine.vaultId);
  if (apparatus === undefined) {
    issues.push({
      code: 'fixture.unknown_element',
      file,
      message: `Vault "${fixture.routine.vaultId}" is not defined by this ruleset.`,
      path: ['routine', 'vaultId'],
    });
  } else if (apparatus !== 'vault') {
    issues.push({
      code: 'fixture.element_apparatus_mismatch',
      file,
      message: `Element "${fixture.routine.vaultId}" is not a Vault.`,
      path: ['routine', 'vaultId'],
    });
  }

  if (fixture.expected.vaultId !== fixture.routine.vaultId) {
    issues.push({
      code: 'fixture.vault_id_mismatch',
      file,
      message: 'Expected vaultId must match routine.vaultId.',
      path: ['expected', 'vaultId'],
    });
  }
  const awardTotal = sumFixturePoints(fixture.expected.awards.map(({ value }) => value));
  if (awardTotal !== fixture.expected.bonus) {
    issues.push({
      code: 'fixture.breakdown_mismatch',
      file,
      message: `bonus must equal ${awardTotal.toFixed(1)} based on expected awards.`,
      path: ['expected', 'bonus'],
    });
  }
  const total = sumFixturePoints([fixture.expected.vaultDifficulty, fixture.expected.bonus]);
  if (fixture.expected.total !== total) {
    issues.push({
      code: 'fixture.total_mismatch',
      file,
      message: `Total must equal ${total.toFixed(1)} based on Vault difficulty and bonus.`,
      path: ['expected', 'total'],
    });
  }
}

function validateOccurrenceReferences(
  occurrenceIds: readonly string[],
  occurrences: ReadonlyMap<string, unknown>,
  file: string,
  path: readonly DataPathSegment[],
  issues: ValidationIssue[],
): void {
  occurrenceIds.forEach((occurrenceId, index) => {
    if (!occurrences.has(occurrenceId)) {
      issues.push({
        code: 'fixture.unknown_occurrence_reference',
        file,
        message: `Unknown occurrence "${occurrenceId}".`,
        path: [...path, index],
      });
    }
  });
}

function sumFixturePoints(values: readonly number[]): number {
  return values.reduce((total, value) => total + value * 10, 0) / 10;
}
