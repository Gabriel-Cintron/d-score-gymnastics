import {
  scoreTenths,
  type DifficultyAward,
  type DifficultyWarning,
  type ElementDecision,
  type ElementRoutine,
  type ElementRoutineApparatusId,
  type ResolvedElementOccurrence,
  type RoutineEvaluationDraft,
  type RoutineEvaluator,
  type ScorableElement,
  type ScoreTenths,
} from '@d-score-gymnastics/scoring';

import type {
  CompiledApparatusRules,
  CompiledFloorRules,
  CompiledHorizontalBarRules,
  CompiledPommelHorseRules,
  CompiledRingsRules,
} from '../compile-apparatus-rules';
import type { CompiledElementGroupRequirements, CompiledSharedRules } from '../compile';
import type { ElementCountingPolicy } from '../rules-schema';

export const FIG_ELEMENT_COUNTING_EVALUATOR_ID = 'fig-2025-2028.element-counting' as const;

export type FigPommelSequenceComponentKind =
  'bertoncelj' | 'circle' | 'davtyan' | 'dsa' | 'dsb' | 'russian';

export interface FigPommelSequencePreview {
  readonly difficulty: ScoreTenths;
  readonly sequenceType: string;
}

export function figPommelSequenceComponentKind(
  element: ScorableElement,
): FigPommelSequenceComponentKind | undefined {
  const traits = element.traits;
  if (traits.includes('flop-circle')) return 'circle';
  if (traits.includes('flop-dsa')) return 'dsa';
  if (traits.includes('flop-dsb')) return 'dsb';
  if (traits.includes('flop-bertoncelj')) return 'bertoncelj';
  if (traits.includes('flop-davtyan')) return 'davtyan';
  if (traits.includes('flop-russian')) return 'russian';
  return undefined;
}

export function isFigPommelSequenceComponent(element: ScorableElement): boolean {
  return figPommelSequenceComponentKind(element) !== undefined;
}

export function previewFigPommelSequence(
  components: readonly ScorableElement[],
  rules: CompiledPommelHorseRules,
): FigPommelSequencePreview | undefined {
  for (const sequenceType of [rules.sequenceTypes.flop, rules.sequenceTypes.combined]) {
    const difficulty = pommelSequenceDifficulty(components, sequenceType, rules);
    if (difficulty !== undefined) return { difficulty, sequenceType };
  }
  return undefined;
}

export function isFigConnectionEligible(
  first: ScorableElement,
  second: ScorableElement,
  rules: CompiledApparatusRules,
): boolean {
  return (
    connectionValue(first, second, rules) !== undefined ||
    (rules.apparatus === 'horizontal-bar' &&
      isHorizontalBarFifthFlightElements(first, second, rules))
  );
}

interface RepetitionResult {
  readonly creditedOccurrenceIds: ReadonlySet<string>;
  readonly repeatedByOccurrenceId: ReadonlyMap<string, string>;
  readonly warnings: readonly DifficultyWarning[];
}

interface SelectionResult {
  readonly groupCounts: ReadonlyMap<number, number>;
  readonly selectedOccurrenceIds: ReadonlySet<string>;
  readonly specialExclusions: ReadonlyMap<string, Exclusion>;
  readonly warnings: readonly DifficultyWarning[];
}

interface SelectionState {
  readonly elementDifficulty: number;
  readonly groupAwards: ReadonlyMap<number, ScoreTenths>;
  readonly groupCounts: ReadonlyMap<number, number>;
  readonly selectedOccurrences: readonly ResolvedElementOccurrence[];
  readonly specialCounts: ReadonlyMap<string, number>;
}

interface ValueUpgradeClaim {
  readonly connectionId: string;
  readonly increments: readonly [ScoreTenths, ScoreTenths];
  readonly occurrenceIds: readonly [string, string];
  readonly reason: ElementDecision['reason'];
}

interface CreditedValueUpgrade {
  readonly connectionId: string;
  readonly increment: ScoreTenths;
  readonly reason: ElementDecision['reason'];
}

interface ConditionalGroupMaximum {
  readonly group: number;
  readonly maximum: number;
  readonly requiredOccurrenceIds: readonly [string, string];
}

interface GroupRequirementResult {
  readonly awards: readonly DifficultyAward[];
  readonly warnings: readonly DifficultyWarning[];
}

interface Exclusion {
  readonly parameters: Readonly<Record<string, boolean | number | string>>;
  readonly reason: ElementDecision['reason'];
}

interface SequenceCredit {
  readonly componentOccurrenceIds: readonly string[];
  readonly difficulty: ScoreTenths;
  readonly sequenceId: string;
  readonly sequenceType: string;
}

interface PreparedApparatusEvaluation {
  readonly dependencies: ReadonlyMap<string, string>;
  readonly effectiveByOccurrenceId: ReadonlyMap<string, ResolvedElementOccurrence>;
  readonly exclusions: ReadonlyMap<string, Exclusion>;
  readonly sequenceCreditByPrimaryId: ReadonlyMap<string, SequenceCredit>;
  readonly valueUpgradeClaims: readonly ValueUpgradeClaim[];
  readonly warnings: readonly DifficultyWarning[];
}

interface ApparatusEvaluationResult {
  readonly awards: readonly DifficultyAward[];
  readonly warnings: readonly DifficultyWarning[];
}

interface ApplicableSpecialLimit {
  readonly key: string;
  readonly matches: (occurrence: ResolvedElementOccurrence) => boolean;
  readonly maximum: number;
  readonly parameters: Readonly<Record<string, boolean | number | string>>;
  readonly reason: Exclusion['reason'];
}

interface EffectiveElementCountingPolicy extends ElementCountingPolicy {
  readonly conditionalGroupMaximums: readonly ConditionalGroupMaximum[];
  readonly maximumByGroup: ReadonlyMap<number, number>;
}

export function createFigElementCountingEvaluator(
  sharedRules: CompiledSharedRules,
  apparatus: ElementRoutineApparatusId,
  apparatusRules?: CompiledApparatusRules,
): RoutineEvaluator {
  const policy = sharedRules.elementCounting[apparatus];
  if (apparatusRules !== undefined && apparatusRules.apparatus !== apparatus) {
    throw new Error(
      `Cannot use ${apparatusRules.apparatus} rules to evaluate a ${apparatus} routine.`,
    );
  }

  return {
    apparatus,
    id: FIG_ELEMENT_COUNTING_EVALUATOR_ID,
    evaluate: ({ occurrences, routine }) =>
      evaluateElementCounting(occurrences, routine, policy, sharedRules, apparatus, apparatusRules),
  };
}

function evaluateElementCounting(
  occurrences: readonly ResolvedElementOccurrence[],
  routine: ElementRoutine,
  policy: ElementCountingPolicy,
  sharedRules: CompiledSharedRules,
  apparatus: ElementRoutineApparatusId,
  apparatusRules: CompiledApparatusRules | undefined,
): RoutineEvaluationDraft {
  const groupRequirements = sharedRules.elementGroupRequirements;
  const prepared = prepareApparatusEvaluation(occurrences, routine, apparatusRules);
  const effectiveOccurrences = occurrences.map(
    (occurrence) => prepared.effectiveByOccurrenceId.get(occurrence.occurrenceId) ?? occurrence,
  );
  const finalOccurrence = effectiveOccurrences.at(-1);
  const hasReservedDismount = policy.reservedDismountSlots === 1;
  const dismountCandidate =
    hasReservedDismount && finalOccurrence?.element.roles.includes('dismount') === true
      ? finalOccurrence
      : undefined;
  const repetition = evaluateRepetition(
    effectiveOccurrences.filter(({ occurrenceId }) => !prepared.exclusions.has(occurrenceId)),
    sharedRules.repetition.maximumCreditsPerCode,
    dismountCandidate?.occurrenceId,
  );
  const warnings = [...prepared.warnings, ...repetition.warnings];
  const dismountRoleExclusive = apparatus !== 'floor-exercise';
  const reservedDismount =
    dismountCandidate !== undefined &&
    repetition.creditedOccurrenceIds.has(dismountCandidate.occurrenceId)
      ? dismountCandidate
      : undefined;

  if (hasReservedDismount) {
    const nonFinalDismounts = dismountRoleExclusive
      ? effectiveOccurrences
          .slice(0, -1)
          .filter(({ element }) => element.roles.includes('dismount'))
      : [];
    if (nonFinalDismounts.length > 0) {
      warnings.push({
        code: 'fig.dismount-not-final',
        occurrenceIds: nonFinalDismounts.map(({ occurrenceId }) => occurrenceId),
        parameters: {},
      });
    }

    if (finalOccurrence?.element.roles.includes('dismount') !== true) {
      warnings.push({
        code: 'fig.missing-dismount',
        occurrenceIds: [],
        parameters: {},
      });
    } else if (reservedDismount === undefined) {
      warnings.push({
        code: 'fig.dismount-not-creditable',
        occurrenceIds: [finalOccurrence.occurrenceId],
        parameters: {},
      });
    }
  }

  const exclusions = new Map(prepared.exclusions);

  const regularCandidates = effectiveOccurrences.filter(
    (occurrence) =>
      repetition.creditedOccurrenceIds.has(occurrence.occurrenceId) &&
      !exclusions.has(occurrence.occurrenceId) &&
      occurrence.occurrenceId !== reservedDismount?.occurrenceId &&
      (!dismountRoleExclusive || !occurrence.element.roles.includes('dismount')),
  );
  const effectivePolicy = policyForRoutine(policy, routine, effectiveOccurrences, apparatusRules);
  const selection = selectRegularElements(
    regularCandidates,
    effectivePolicy,
    groupRequirements,
    apparatus,
    prepared.dependencies,
    prepared.valueUpgradeClaims,
    reservedDismount,
    apparatusRules,
  );
  warnings.push(...selection.warnings);
  const valueUpgrades = creditValueUpgrades(
    prepared.valueUpgradeClaims,
    selection.selectedOccurrenceIds,
  );
  warnings.push(...valueUpgrades.warnings);
  const elementDecisions = effectiveOccurrences.map<ElementDecision>((occurrence) => {
    const creditedOccurrenceId = repetition.repeatedByOccurrenceId.get(occurrence.occurrenceId);
    if (creditedOccurrenceId !== undefined) {
      return excludedDecision(occurrence, 'fig.element-repeated', {
        creditedOccurrenceId,
      });
    }
    const apparatusExclusion = exclusions.get(occurrence.occurrenceId);
    if (apparatusExclusion !== undefined) {
      return excludedDecision(occurrence, apparatusExclusion.reason, apparatusExclusion.parameters);
    }
    if (occurrence.occurrenceId === reservedDismount?.occurrenceId) {
      return countedDecision(occurrence, 'fig.dismount-counted', {
        slot: 'reserved-dismount',
      });
    }
    if (dismountRoleExclusive && occurrence.element.roles.includes('dismount')) {
      return excludedDecision(occurrence, 'fig.dismount-not-final', {});
    }
    if (selection.selectedOccurrenceIds.has(occurrence.occurrenceId)) {
      const sequenceCredit = prepared.sequenceCreditByPrimaryId.get(occurrence.occurrenceId);
      const valueUpgrade = valueUpgrades.byOccurrenceId.get(occurrence.occurrenceId);
      if (valueUpgrade !== undefined) {
        return countedDecision(
          occurrence,
          valueUpgrade.reason,
          { connectionId: valueUpgrade.connectionId },
          scoreTenths(occurrence.element.difficulty.tenths + valueUpgrade.increment),
        );
      }
      return sequenceCredit === undefined
        ? countedDecision(occurrence, 'fig.element-counted', { slot: 'regular' })
        : countedDecision(occurrence, 'fig.pommel-sequence-counted', {
            sequenceId: sequenceCredit.sequenceId,
            sequenceType: sequenceCredit.sequenceType,
          });
    }

    const specialExclusion = selection.specialExclusions.get(occurrence.occurrenceId);
    if (specialExclusion !== undefined) {
      return excludedDecision(occurrence, specialExclusion.reason, specialExclusion.parameters);
    }

    const group = occurrence.element.code.group;
    const groupCount = selection.groupCounts.get(group) ?? 0;
    const maximumForGroup = maximumForSelectedRoutine(
      effectivePolicy,
      group,
      selection.selectedOccurrenceIds,
    );
    return groupCount >= maximumForGroup
      ? excludedDecision(occurrence, 'fig.element-group-limit', {
          group,
          maximum: maximumForGroup,
        })
      : excludedDecision(occurrence, 'fig.element-count-limit', {
          maximum: effectivePolicy.regularElementSlots,
        });
  });

  const selectedOccurrences = regularCandidates
    .filter(({ occurrenceId }) => selection.selectedOccurrenceIds.has(occurrenceId))
    .map((occurrence) =>
      applyValueUpgrade(occurrence, valueUpgrades.byOccurrenceId.get(occurrence.occurrenceId)),
    );
  const requirementResult = evaluateGroupRequirements(
    selectedOccurrences,
    reservedDismount,
    groupRequirements,
    apparatus,
  );
  warnings.push(...requirementResult.warnings);

  const awards = [...requirementResult.awards];
  const selectedIds = new Set(
    elementDecisions
      .filter(({ status }) => status === 'counted')
      .map(({ occurrenceId }) => occurrenceId),
  );
  const apparatusResult = evaluateApparatusAwardsAndRequirements(
    effectiveOccurrences,
    routine,
    selectedIds,
    apparatusRules,
  );
  awards.push(...apparatusResult.awards);
  warnings.push(...apparatusResult.warnings);
  if (routine.landing?.outcome === 'stuck') {
    if (routine.landing.occurrenceId !== reservedDismount?.occurrenceId) {
      warnings.push({
        code: 'fig.landing-not-dismount',
        occurrenceIds: [routine.landing.occurrenceId],
        parameters: {},
      });
    } else if (
      sharedRules.landingBonus.apparatus.includes(apparatus) &&
      reservedDismount.element.difficulty.tenths >= sharedRules.landingBonus.minimumDifficulty
    ) {
      awards.push({
        component: 'bonus',
        occurrenceIds: [reservedDismount.occurrenceId],
        reason: 'fig.stick-bonus-awarded',
        reasonParameters: {},
        value: sharedRules.landingBonus.value,
      });
    } else {
      warnings.push({
        code: 'fig.stick-bonus-ineligible',
        occurrenceIds: [reservedDismount.occurrenceId],
        parameters: { apparatus, minimumDifficulty: sharedRules.landingBonus.minimumDifficulty },
      });
    }
  }

  return { awards, elementDecisions, warnings };
}

function prepareApparatusEvaluation(
  occurrences: readonly ResolvedElementOccurrence[],
  routine: ElementRoutine,
  rules: CompiledApparatusRules | undefined,
): PreparedApparatusEvaluation {
  const effectiveByOccurrenceId = new Map(
    occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  const exclusions = new Map<string, Exclusion>();
  const dependencies = new Map<string, string>();
  const sequenceCreditByPrimaryId = new Map<string, SequenceCredit>();
  const warnings: DifficultyWarning[] = [];

  if (rules?.apparatus === 'pommel-horse') {
    preparePommelSequences(
      occurrences,
      routine,
      rules,
      effectiveByOccurrenceId,
      exclusions,
      sequenceCreditByPrimaryId,
      warnings,
    );
    validatePommelOccurrenceQualifiers(
      occurrences,
      rules,
      sequenceCreditByPrimaryId,
      exclusions,
      warnings,
    );
  }
  if (rules?.apparatus === 'still-rings') {
    prepareRingsStrengthSequences(occurrences, rules, exclusions, dependencies, warnings);
  }

  const valueUpgradeClaims = prepareValueUpgradeClaims(occurrences, routine, rules, warnings);

  return {
    dependencies,
    effectiveByOccurrenceId,
    exclusions,
    sequenceCreditByPrimaryId,
    valueUpgradeClaims,
    warnings,
  };
}

function validatePommelOccurrenceQualifiers(
  occurrences: readonly ResolvedElementOccurrence[],
  rules: CompiledPommelHorseRules,
  sequenceCredits: ReadonlyMap<string, SequenceCredit>,
  exclusions: Map<string, Exclusion>,
  warnings: DifficultyWarning[],
): void {
  const sequenceComponentIds = new Set(
    [...sequenceCredits.values()].flatMap(({ componentOccurrenceIds }) => componentOccurrenceIds),
  );
  const location = rules.occurrenceQualifiers.russianLocation;
  for (const occurrence of occurrences) {
    if (
      exclusions.has(occurrence.occurrenceId) ||
      sequenceComponentIds.has(occurrence.occurrenceId) ||
      !occurrence.element.traits.includes(location.requiredTrait)
    ) {
      continue;
    }
    const matching = occurrence.qualifiers.filter((qualifier) =>
      location.options.includes(qualifier),
    );
    if (matching.length === 1) continue;
    const parameters = {
      qualifier: 'russian-location',
      validOptions: location.options.join(','),
    };
    exclusions.set(occurrence.occurrenceId, {
      parameters,
      reason: 'fig.pommel-occurrence-qualifier-required',
    });
    warnings.push({
      code: 'fig.pommel-occurrence-qualifier-required',
      occurrenceIds: [occurrence.occurrenceId],
      parameters,
    });
  }
}

interface ValidPommelSequence {
  readonly difficulty: ScoreTenths;
  readonly occurrences: readonly ResolvedElementOccurrence[];
  readonly sequenceId: string;
  readonly sequenceType: string;
}

function preparePommelSequences(
  occurrences: readonly ResolvedElementOccurrence[],
  routine: ElementRoutine,
  rules: CompiledPommelHorseRules,
  effectiveByOccurrenceId: Map<string, ResolvedElementOccurrence>,
  exclusions: Map<string, Exclusion>,
  sequenceCredits: Map<string, SequenceCredit>,
  warnings: DifficultyWarning[],
): void {
  const occurrenceById = new Map(
    occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  const valid: ValidPommelSequence[] = [];

  for (const relationship of routine.relationships ?? []) {
    if (relationship.kind !== 'sequence') continue;
    if (
      relationship.sequenceType !== rules.sequenceTypes.flop &&
      relationship.sequenceType !== rules.sequenceTypes.combined
    ) {
      warnings.push(invalidRelationshipWarning(relationship.occurrenceIds, 'unsupported-sequence'));
      continue;
    }
    const components = relationship.occurrenceIds.flatMap((occurrenceId) => {
      const occurrence = occurrenceById.get(occurrenceId);
      return occurrence === undefined ? [] : [occurrence];
    });
    const difficulty = pommelSequenceDifficulty(
      components.map(({ element }) => element),
      relationship.sequenceType,
      rules,
    );
    if (
      components.length !== relationship.occurrenceIds.length ||
      !areDirectInDeclaredOrder(components) ||
      difficulty === undefined
    ) {
      warnings.push(invalidRelationshipWarning(relationship.occurrenceIds, 'invalid-sequence'));
      continue;
    }
    valid.push({
      difficulty,
      occurrences: components,
      sequenceId: relationship.sequenceId,
      sequenceType: relationship.sequenceType,
    });
  }

  const acceptedTypes = new Set<string>();
  const acceptedSequences: ValidPommelSequence[] = [];
  const usedOccurrences = new Set<string>();
  const ordered = [...valid].sort(
    (left, right) =>
      right.difficulty - left.difficulty ||
      (left.occurrences[0]?.position ?? 0) - (right.occurrences[0]?.position ?? 0),
  );
  for (const sequence of ordered) {
    const occurrenceIds = sequence.occurrences.map(({ occurrenceId }) => occurrenceId);
    const overlapsAccepted = occurrenceIds.some((occurrenceId) =>
      usedOccurrences.has(occurrenceId),
    );
    const missingSeparator = acceptedSequences.some(
      (accepted) =>
        !pommelSequencesAreSeparated(accepted, sequence, occurrences, rules.sequenceSeparatorTrait),
    );
    if (overlapsAccepted) {
      warnings.push(invalidRelationshipWarning(occurrenceIds, 'overlapping-sequence'));
      continue;
    }
    if (acceptedTypes.has(sequence.sequenceType)) {
      const reason =
        sequence.sequenceType === rules.sequenceTypes.flop
          ? 'fig.pommel-flop-limit'
          : 'fig.pommel-combined-limit';
      const parameters = { maximum: 1 };
      for (const occurrenceId of occurrenceIds) {
        exclusions.set(occurrenceId, {
          parameters,
          reason,
        });
      }
      warnings.push({
        code: reason,
        occurrenceIds,
        parameters,
      });
      if (missingSeparator) {
        warnings.push({
          code: 'fig.pommel-sequence-separator-required',
          occurrenceIds,
          parameters: {},
        });
      }
      continue;
    }
    if (missingSeparator) {
      warnings.push({
        code: 'fig.pommel-sequence-separator-required',
        occurrenceIds,
        parameters: {},
      });
    }

    const primary = sequence.occurrences[0];
    if (primary === undefined) continue;
    acceptedTypes.add(sequence.sequenceType);
    acceptedSequences.push(sequence);
    occurrenceIds.forEach((occurrenceId) => usedOccurrences.add(occurrenceId));
    effectiveByOccurrenceId.set(primary.occurrenceId, {
      ...primary,
      element: {
        ...primary.element,
        code: {
          group: 2,
          number: `${sequence.sequenceType}-${sequence.sequenceId}`,
        },
        difficulty: { tenths: sequence.difficulty },
        families: [],
        roles: [],
        traits: [],
      },
    });
    sequenceCredits.set(primary.occurrenceId, {
      componentOccurrenceIds: occurrenceIds,
      difficulty: sequence.difficulty,
      sequenceId: sequence.sequenceId,
      sequenceType: sequence.sequenceType,
    });
    for (const component of sequence.occurrences.slice(1)) {
      exclusions.set(component.occurrenceId, {
        parameters: {
          creditedOccurrenceId: primary.occurrenceId,
          sequenceId: sequence.sequenceId,
        },
        reason: 'fig.pommel-sequence-component',
      });
    }
  }

  excludeOnePommelElementsAfterSequences(
    occurrences,
    acceptedSequences,
    rules.sequenceSeparatorTrait,
    exclusions,
    warnings,
  );
}

function pommelSequencesAreSeparated(
  first: ValidPommelSequence,
  second: ValidPommelSequence,
  occurrences: readonly ResolvedElementOccurrence[],
  separatorTrait: string,
): boolean {
  const ordered = [first, second].sort(
    (left, right) => (left.occurrences[0]?.position ?? 0) - (right.occurrences[0]?.position ?? 0),
  );
  const earlierEnd = ordered[0]?.occurrences.at(-1)?.position;
  const laterStart = ordered[1]?.occurrences[0]?.position;
  if (earlierEnd === undefined || laterStart === undefined) return false;
  return occurrences.some(
    (occurrence) =>
      occurrence.position > earlierEnd &&
      occurrence.position < laterStart &&
      occurrence.element.traits.includes(separatorTrait),
  );
}

function excludeOnePommelElementsAfterSequences(
  occurrences: readonly ResolvedElementOccurrence[],
  acceptedSequences: readonly ValidPommelSequence[],
  separatorTrait: string,
  exclusions: Map<string, Exclusion>,
  warnings: DifficultyWarning[],
): void {
  const acceptedComponentIds = new Set(
    acceptedSequences.flatMap(({ occurrences: components }) =>
      components.map(({ occurrenceId }) => occurrenceId),
    ),
  );
  for (const sequence of acceptedSequences) {
    const end = sequence.occurrences.at(-1)?.position;
    if (end === undefined) continue;
    for (const occurrence of occurrences.slice(end + 1)) {
      if (occurrence.element.traits.includes(separatorTrait)) break;
      if (
        exclusions.has(occurrence.occurrenceId) ||
        acceptedComponentIds.has(occurrence.occurrenceId) ||
        occurrence.element.traits.includes('handstand') ||
        !occurrence.element.traits.some((trait) => trait.startsWith('flop-'))
      ) {
        continue;
      }
      const parameters = { separatorTrait };
      exclusions.set(occurrence.occurrenceId, {
        parameters,
        reason: 'fig.pommel-one-pommel-after-sequence',
      });
      warnings.push({
        code: 'fig.pommel-one-pommel-after-sequence',
        occurrenceIds: [occurrence.occurrenceId],
        parameters,
      });
    }
  }
}

function pommelSequenceDifficulty(
  components: readonly ScorableElement[],
  sequenceType: string,
  rules: CompiledPommelHorseRules,
): ScoreTenths | undefined {
  const componentKinds = components.map(figPommelSequenceComponentKind);
  if (componentKinds.some((kind) => kind === undefined)) return undefined;
  const kinds = componentKinds as string[];
  if (hasThreeConsecutiveEqual(kinds)) return undefined;

  const specialStart = kinds[0] === 'bertoncelj' || kinds[0] === 'davtyan';
  const specialStartCount = kinds.filter(
    (kind) => kind === 'bertoncelj' || kind === 'davtyan',
  ).length;
  const dsaIndex = kinds.indexOf('dsa');

  if (sequenceType === rules.sequenceTypes.flop) {
    if (components.length < 3 || components.length > 4) return undefined;
    if (specialStartCount > 1 || (specialStartCount === 1 && !specialStart)) return undefined;
    if (kinds.includes('russian')) return undefined;
    if (dsaIndex >= 0 && dsaIndex !== kinds.length - 1) return undefined;
    return scoreTenths(components.length + 1 + (specialStart ? 1 : 0));
  }

  const russianIndexes = kinds.flatMap((kind, index) => (kind === 'russian' ? [index] : []));
  if (russianIndexes.length !== 1) return undefined;
  const flopKinds = kinds.filter((kind) => kind !== 'russian');
  if (flopKinds.length < 1 || flopKinds.length > 2) return undefined;
  if (specialStartCount > 1 || (specialStartCount === 1 && !specialStart)) return undefined;
  if (dsaIndex >= 0 && dsaIndex !== kinds.length - 1) return undefined;
  if (sequenceType !== rules.sequenceTypes.combined) return undefined;
  const russian = components[russianIndexes[0] ?? -1];
  if (russian === undefined) return undefined;
  const value = Math.max(4, russian.difficulty.tenths + flopKinds.length + (specialStart ? 1 : 0));
  return value >= 4 && value <= 8 ? scoreTenths(value) : undefined;
}

function hasThreeConsecutiveEqual(values: readonly string[]): boolean {
  return values.some((value, index) => value === values[index + 1] && value === values[index + 2]);
}

function prepareRingsStrengthSequences(
  occurrences: readonly ResolvedElementOccurrence[],
  rules: CompiledRingsRules,
  exclusions: Map<string, Exclusion>,
  dependencies: Map<string, string>,
  warnings: DifficultyWarning[],
): void {
  let cumulativeStrength = 0;
  let segmentStrength = 0;
  let separatorOccurrenceId: string | undefined;

  for (const occurrence of occurrences) {
    if (isRingsSeparator(occurrence, rules)) {
      separatorOccurrenceId = occurrence.occurrenceId;
      segmentStrength = 0;
      continue;
    }
    if (!rules.strengthGroups.includes(occurrence.element.code.group)) continue;

    cumulativeStrength += 1;
    segmentStrength += 1;
    if (segmentStrength > rules.maximumConsecutiveStrength) {
      exclusions.set(occurrence.occurrenceId, {
        parameters: { maximum: rules.maximumConsecutiveStrength },
        reason: 'fig.rings-strength-sequence-limit',
      });
      warnings.push({
        code: 'fig.rings-strength-sequence-limit',
        occurrenceIds: [occurrence.occurrenceId],
        parameters: { maximum: rules.maximumConsecutiveStrength },
      });
    } else if (
      cumulativeStrength > rules.maximumConsecutiveStrength &&
      separatorOccurrenceId !== undefined
    ) {
      dependencies.set(occurrence.occurrenceId, separatorOccurrenceId);
    } else if (cumulativeStrength > rules.maximumConsecutiveStrength) {
      exclusions.set(occurrence.occurrenceId, {
        parameters: { maximum: rules.maximumConsecutiveStrength },
        reason: 'fig.rings-strength-sequence-limit',
      });
      warnings.push({
        code: 'fig.rings-strength-sequence-limit',
        occurrenceIds: [occurrence.occurrenceId],
        parameters: { maximum: rules.maximumConsecutiveStrength },
      });
    }
  }
}

function prepareValueUpgradeClaims(
  occurrences: readonly ResolvedElementOccurrence[],
  routine: ElementRoutine,
  rules: CompiledApparatusRules | undefined,
  warnings: DifficultyWarning[],
): readonly ValueUpgradeClaim[] {
  if (rules?.apparatus !== 'still-rings' && rules?.apparatus !== 'parallel-bars') {
    return [];
  }

  const occurrenceById = new Map(
    occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  const claims: ValueUpgradeClaim[] = [];
  const claimedPairs = new Set<string>();
  for (const relationship of routine.relationships ?? []) {
    if (relationship.kind !== 'connection') continue;
    const [firstId, secondId] = relationship.occurrenceIds;
    const pairKey = `${firstId}->${secondId}`;
    if (claimedPairs.has(pairKey)) {
      warnings.push(invalidRelationshipWarning(relationship.occurrenceIds, 'duplicate-connection'));
      continue;
    }
    claimedPairs.add(pairKey);
    const first = occurrenceById.get(firstId);
    const second = occurrenceById.get(secondId);
    if (first === undefined || second === undefined || !areDirectInDeclaredOrder([first, second])) {
      warnings.push(invalidRelationshipWarning(relationship.occurrenceIds, 'not-direct'));
      continue;
    }

    if (
      rules.apparatus === 'still-rings' &&
      first.element.traits.includes(rules.upgradeConnection.sourceTrait) &&
      second.element.traits.includes(rules.upgradeConnection.targetTrait)
    ) {
      claims.push({
        connectionId: relationship.connectionId,
        increments: [rules.upgradeConnection.increment, scoreTenths(0)],
        occurrenceIds: relationship.occurrenceIds,
        reason: 'fig.rings-direct-upgrade',
      });
      continue;
    }

    if (
      rules.apparatus === 'parallel-bars' &&
      first.element.traits.includes(rules.healyUpgrade.sourceTrait) &&
      !first.element.traits.includes(rules.healyUpgrade.excludedSourceTrait) &&
      second.element.traits.includes(rules.healyUpgrade.targetTrait)
    ) {
      claims.push({
        connectionId: relationship.connectionId,
        increments: [
          rules.healyUpgrade.incrementPerElement,
          rules.healyUpgrade.incrementPerElement,
        ],
        occurrenceIds: relationship.occurrenceIds,
        reason: 'fig.parallel-bars-healy-upgrade',
      });
      continue;
    }

    warnings.push(invalidRelationshipWarning(relationship.occurrenceIds, 'ineligible-elements'));
  }
  return claims;
}

function creditValueUpgrades(
  claims: readonly ValueUpgradeClaim[],
  selectedOccurrenceIds: ReadonlySet<string>,
): {
  readonly byOccurrenceId: ReadonlyMap<string, CreditedValueUpgrade>;
  readonly warnings: readonly DifficultyWarning[];
} {
  const byOccurrenceId = creditedValueUpgradeMap(claims, selectedOccurrenceIds);
  const warnings: DifficultyWarning[] = [];
  for (const claim of claims) {
    if (!claim.occurrenceIds.every((occurrenceId) => selectedOccurrenceIds.has(occurrenceId))) {
      warnings.push(invalidRelationshipWarning(claim.occurrenceIds, 'not-counted'));
    }
  }
  return { byOccurrenceId, warnings };
}

function creditedValueUpgradeMap(
  claims: readonly ValueUpgradeClaim[],
  selectedOccurrenceIds: ReadonlySet<string>,
): ReadonlyMap<string, CreditedValueUpgrade> {
  const byOccurrenceId = new Map<string, CreditedValueUpgrade>();
  for (const claim of claims) {
    if (!claim.occurrenceIds.every((occurrenceId) => selectedOccurrenceIds.has(occurrenceId))) {
      continue;
    }
    claim.occurrenceIds.forEach((occurrenceId, index) => {
      const increment = claim.increments[index] ?? scoreTenths(0);
      if (increment === 0) return;
      const existing = byOccurrenceId.get(occurrenceId);
      if (existing === undefined || increment > existing.increment) {
        byOccurrenceId.set(occurrenceId, {
          connectionId: claim.connectionId,
          increment,
          reason: claim.reason,
        });
      }
    });
  }
  return byOccurrenceId;
}

function applyValueUpgrade(
  occurrence: ResolvedElementOccurrence,
  upgrade: CreditedValueUpgrade | undefined,
): ResolvedElementOccurrence {
  if (upgrade === undefined) return occurrence;
  return {
    ...occurrence,
    element: {
      ...occurrence.element,
      difficulty: {
        tenths: scoreTenths(occurrence.element.difficulty.tenths + upgrade.increment),
      },
    },
  };
}

function isRingsSeparator(
  occurrence: ResolvedElementOccurrence,
  rules: CompiledRingsRules,
): boolean {
  return (
    occurrence.element.code.group === rules.separator.group &&
    occurrence.element.difficulty.tenths >= rules.separator.minimumDifficulty &&
    !rules.separator.excludedTraits.some((trait) => occurrence.element.traits.includes(trait))
  );
}

function applicableSpecialLimits(
  occurrences: readonly ResolvedElementOccurrence[],
  rules: CompiledApparatusRules | undefined,
): readonly ApplicableSpecialLimit[] {
  const limits =
    rules?.apparatus === 'floor-exercise' ||
    rules?.apparatus === 'pommel-horse' ||
    rules?.apparatus === 'parallel-bars' ||
    rules?.apparatus === 'horizontal-bar'
      ? rules.specialLimits
      : [];
  const applicable: ApplicableSpecialLimit[] = limits.map((limit) => ({
    key: `${limit.kind}:${limit.id}`,
    matches: (occurrence) =>
      (limit.includeDismount || !occurrence.element.roles.includes('dismount')) &&
      (limit.kind === 'trait'
        ? occurrence.element.traits.includes(limit.id)
        : occurrence.element.families.includes(limit.id) ||
          occurrence.qualifiers.includes(limit.id)),
    maximum: limit.maximum,
    parameters: { limitId: limit.id, maximum: limit.maximum },
    reason: 'fig.special-repetition-limit',
  }));

  if (rules?.apparatus === 'still-rings') {
    const positionAndGroupKeys = new Set<string>();
    for (const occurrence of occurrences) {
      for (const family of occurrence.element.families) {
        if (!family.startsWith(`${rules.finalPositionFamilyPrefix}-`)) continue;
        positionAndGroupKeys.add(`${occurrence.element.code.group}:${family}`);
      }
    }
    for (const key of [...positionAndGroupKeys].sort()) {
      const [groupText, ...familyParts] = key.split(':');
      const group = Number(groupText);
      const family = familyParts.join(':');
      applicable.push({
        key: `rings-final-position:${key}`,
        matches: (occurrence) =>
          occurrence.element.code.group === group && occurrence.element.families.includes(family),
        maximum: 1,
        parameters: { family, maximum: 1 },
        reason: 'fig.rings-final-position-limit',
      });
    }
  }

  return applicable;
}

function policyForRoutine(
  policy: ElementCountingPolicy,
  routine: ElementRoutine,
  occurrences: readonly ResolvedElementOccurrence[],
  rules: CompiledApparatusRules | undefined,
): EffectiveElementCountingPolicy {
  const maximumByGroup = new Map<number, number>();
  const conditionalGroupMaximums: ConditionalGroupMaximum[] = [];
  if (rules?.apparatus === 'horizontal-bar') {
    const occurrenceById = new Map(
      occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
    );
    for (const relationship of routine.relationships ?? []) {
      if (relationship.kind !== 'connection') continue;
      const [firstId, secondId] = relationship.occurrenceIds;
      const first = occurrenceById.get(firstId);
      const second = occurrenceById.get(secondId);
      if (
        first !== undefined &&
        second !== undefined &&
        isHorizontalBarFifthFlightPair(first, second, rules)
      ) {
        conditionalGroupMaximums.push({
          group: rules.fifthFlight.group,
          maximum: rules.fifthFlight.maximumWhenQualified,
          requiredOccurrenceIds: relationship.occurrenceIds,
        });
      }
    }
    if (conditionalGroupMaximums.length > 0) {
      maximumByGroup.set(rules.fifthFlight.group, rules.fifthFlight.maximumWhenQualified);
    }
  }
  return { ...policy, conditionalGroupMaximums, maximumByGroup };
}

function isHorizontalBarFifthFlightPair(
  first: ResolvedElementOccurrence,
  second: ResolvedElementOccurrence,
  rules: CompiledHorizontalBarRules,
): boolean {
  return (
    areDirectInDeclaredOrder([first, second]) &&
    isHorizontalBarFifthFlightElements(first.element, second.element, rules)
  );
}

function isHorizontalBarFifthFlightElements(
  first: ScorableElement,
  second: ScorableElement,
  rules: CompiledHorizontalBarRules,
): boolean {
  return (
    first.traits.includes('flight') &&
    second.traits.includes('flight') &&
    first.difficulty.tenths >= rules.fifthFlight.connectedMinimumDifficulty &&
    second.difficulty.tenths >= rules.fifthFlight.connectedMinimumDifficulty
  );
}

function evaluateApparatusAwardsAndRequirements(
  occurrences: readonly ResolvedElementOccurrence[],
  routine: ElementRoutine,
  selectedIds: ReadonlySet<string>,
  rules: CompiledApparatusRules | undefined,
): ApparatusEvaluationResult {
  if (rules === undefined) return { awards: [], warnings: [] };
  const awards: DifficultyAward[] = [];
  const warnings: DifficultyWarning[] = [];
  const occurrenceById = new Map(
    occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  const claimedConnectionPairs = new Set<string>();

  if (rules.apparatus === 'floor-exercise') {
    const satisfiesBalance = occurrences.some(({ element }) =>
      element.traits.includes(rules.balanceRequirementTrait),
    );
    if (!satisfiesBalance) {
      warnings.push({
        code: 'fig.floor-missing-balance-or-leap',
        occurrenceIds: [],
        parameters: {},
      });
    }
  }
  if (rules.apparatus === 'still-rings') {
    const hasSwingHandstand = occurrences.some(
      ({ element, occurrenceId }) =>
        selectedIds.has(occurrenceId) &&
        element.traits.includes(rules.swingHandstandRequirementTrait),
    );
    if (!hasSwingHandstand) {
      warnings.push({
        code: 'fig.rings-missing-swing-handstand',
        occurrenceIds: [],
        parameters: {},
      });
    }
  }

  for (const relationship of routine.relationships ?? []) {
    if (relationship.kind !== 'connection') continue;
    if (rules.apparatus === 'still-rings' || rules.apparatus === 'parallel-bars') {
      continue;
    }
    const [firstId, secondId] = relationship.occurrenceIds;
    const pairKey = `${firstId}->${secondId}`;
    if (claimedConnectionPairs.has(pairKey)) {
      warnings.push(invalidRelationshipWarning(relationship.occurrenceIds, 'duplicate-connection'));
      continue;
    }
    claimedConnectionPairs.add(pairKey);
    const first = occurrenceById.get(firstId);
    const second = occurrenceById.get(secondId);
    if (first === undefined || second === undefined || !areDirectInDeclaredOrder([first, second])) {
      warnings.push(invalidRelationshipWarning(relationship.occurrenceIds, 'not-direct'));
      continue;
    }

    const value = connectionValue(first.element, second.element, rules);
    if (
      value === undefined &&
      rules.apparatus === 'horizontal-bar' &&
      isHorizontalBarFifthFlightPair(first, second, rules)
    ) {
      continue;
    }
    if (!selectedIds.has(firstId) || !selectedIds.has(secondId)) {
      warnings.push(invalidRelationshipWarning(relationship.occurrenceIds, 'not-counted'));
      continue;
    }
    if (value === undefined) {
      warnings.push(invalidRelationshipWarning(relationship.occurrenceIds, 'ineligible-elements'));
      continue;
    }
    awards.push({
      component: 'connection',
      occurrenceIds: [firstId, secondId],
      reason: 'fig.connection-awarded',
      reasonParameters: { connectionId: relationship.connectionId },
      value,
    });
  }

  return { awards, warnings };
}

function connectionValue(
  first: ScorableElement,
  second: ScorableElement,
  rules: CompiledApparatusRules,
): ScoreTenths | undefined {
  switch (rules.apparatus) {
    case 'floor-exercise':
      return floorConnectionValue(first, second, rules);
    case 'still-rings':
      return first.traits.includes(rules.upgradeConnection.sourceTrait) &&
        second.traits.includes(rules.upgradeConnection.targetTrait)
        ? rules.upgradeConnection.increment
        : undefined;
    case 'parallel-bars':
      return first.traits.includes(rules.healyUpgrade.sourceTrait) &&
        !first.traits.includes(rules.healyUpgrade.excludedSourceTrait) &&
        second.traits.includes(rules.healyUpgrade.targetTrait)
        ? scoreTenths(rules.healyUpgrade.incrementPerElement * 2)
        : undefined;
    case 'horizontal-bar':
      return horizontalBarConnectionValue(first, second, rules);
    case 'pommel-horse':
    case 'vault':
      return undefined;
  }
}

function floorConnectionValue(
  first: ScorableElement,
  second: ScorableElement,
  rules: CompiledFloorRules,
): ScoreTenths | undefined {
  if (
    !first.traits.includes('acrobatic') ||
    !second.traits.includes('acrobatic') ||
    (first.code.group === 4 && second.code.group === 4) ||
    (new Set([first.code.group, second.code.group]).size === 2 &&
      [first.code.group, second.code.group].every((group) => [2, 3].includes(group)))
  ) {
    return undefined;
  }
  const values = [first.difficulty.tenths, second.difficulty.tenths].sort(
    (left, right) => right - left,
  );
  const high = values[0] ?? 0;
  const low = values[1] ?? 0;
  if (
    high < rules.connection.minimumFirstDifficulty ||
    low < rules.connection.minimumPartnerDifficulty
  ) {
    return undefined;
  }
  return low >= rules.connection.highPartnerMinimum
    ? rules.connection.highValue
    : rules.connection.standardValue;
}

function horizontalBarConnectionValue(
  first: ScorableElement,
  second: ScorableElement,
  rules: CompiledHorizontalBarRules,
): ScoreTenths | undefined {
  const firstFlight = first.traits.includes('flight');
  const secondFlight = second.traits.includes('flight');
  if (firstFlight && secondFlight) {
    return maximumMatchingValue(
      rules.connection.flightFlight.flatMap((band) =>
        first.difficulty.tenths >= band.minimumFirst &&
        second.difficulty.tenths >= band.minimumSecond
          ? [band.value]
          : [],
      ),
    );
  }
  if (firstFlight === secondFlight) return undefined;
  const flight = firstFlight ? first : second;
  const nonFlight = firstFlight ? second : first;
  if (![1, 3].includes(nonFlight.code.group)) return undefined;
  return maximumMatchingValue(
    rules.connection.flightWithNonFlight.flatMap((band) =>
      flight.difficulty.tenths >= band.minimumFlight &&
      nonFlight.difficulty.tenths >= band.minimumNonFlight
        ? [band.value]
        : [],
    ),
  );
}

function maximumMatchingValue(values: readonly ScoreTenths[]): ScoreTenths | undefined {
  return values.length === 0 ? undefined : scoreTenths(Math.max(...values));
}

function invalidRelationshipWarning(
  occurrenceIds: readonly string[],
  reason: string,
): DifficultyWarning {
  return {
    code: 'fig.relationship-not-creditable',
    occurrenceIds,
    parameters: { reason },
  };
}

function areDirectInDeclaredOrder(occurrences: readonly ResolvedElementOccurrence[]): boolean {
  return occurrences.every(
    (occurrence, index) =>
      index === 0 || occurrence.position === (occurrences[index - 1]?.position ?? -2) + 1,
  );
}

function evaluateRepetition(
  occurrences: readonly ResolvedElementOccurrence[],
  maximumCreditsPerCode: number,
  priorityOccurrenceId?: string,
): RepetitionResult {
  const creditedOccurrenceIds = new Set<string>();
  const repeatedByOccurrenceId = new Map<string, string>();
  const warnings: DifficultyWarning[] = [];
  const occurrencesByCode = new Map<string, ResolvedElementOccurrence[]>();

  for (const occurrence of occurrences) {
    const code = officialCode(occurrence);
    const matching = occurrencesByCode.get(code) ?? [];
    matching.push(occurrence);
    occurrencesByCode.set(code, matching);
  }

  for (const matching of occurrencesByCode.values()) {
    const priority = matching.find(({ occurrenceId }) => occurrenceId === priorityOccurrenceId);
    const ordered =
      priority === undefined
        ? matching
        : [
            priority,
            ...matching.filter(({ occurrenceId }) => occurrenceId !== priorityOccurrenceId),
          ];
    const credited = ordered.slice(0, maximumCreditsPerCode);
    credited.forEach(({ occurrenceId }) => creditedOccurrenceIds.add(occurrenceId));
    const creditedOccurrence = credited[0];
    if (creditedOccurrence === undefined) continue;
    for (const repeated of matching.filter(
      ({ occurrenceId }) => !creditedOccurrenceIds.has(occurrenceId),
    )) {
      repeatedByOccurrenceId.set(repeated.occurrenceId, creditedOccurrence.occurrenceId);
      warnings.push({
        code: 'fig.repeated-element',
        occurrenceIds: [creditedOccurrence.occurrenceId, repeated.occurrenceId],
        parameters: {
          group: repeated.element.code.group,
          number: repeated.element.code.number,
        },
      });
    }
  }

  return { creditedOccurrenceIds, repeatedByOccurrenceId, warnings };
}

function selectRegularElements(
  candidates: readonly ResolvedElementOccurrence[],
  policy: EffectiveElementCountingPolicy,
  groupRequirements: CompiledElementGroupRequirements,
  apparatus: ElementRoutineApparatusId,
  dependencies: ReadonlyMap<string, string>,
  valueUpgradeClaims: readonly ValueUpgradeClaim[],
  reservedDismount: ResolvedElementOccurrence | undefined,
  apparatusRules: CompiledApparatusRules | undefined,
): SelectionResult {
  const candidateGroups = [
    ...new Set([
      ...candidates.map(({ element }) => element.code.group),
      ...(reservedDismount === undefined ? [] : [reservedDismount.element.code.group]),
    ]),
  ].sort((left, right) => left - right);
  const requiredGroups = [...groupRequirements.regularGroups[apparatus]].sort(
    (left, right) => left - right,
  );
  const trackedOccurrenceIds = [
    ...new Set([
      ...dependencies.values(),
      ...valueUpgradeClaims.flatMap(({ occurrenceIds }) => occurrenceIds),
      ...policy.conditionalGroupMaximums.flatMap(
        ({ requiredOccurrenceIds }) => requiredOccurrenceIds,
      ),
    ]),
  ].sort();
  const specialLimits = applicableSpecialLimits(
    [...candidates, ...(reservedDismount === undefined ? [] : [reservedDismount])],
    apparatusRules,
  );
  const specialLimitKeys = specialLimits.map(({ key }) => key);
  let states = new Map<string, SelectionState>();
  const reservedProvidesRegularGroup =
    reservedDismount !== undefined && requiredGroups.includes(reservedDismount.element.code.group);
  const emptyState: SelectionState = {
    elementDifficulty: 0,
    groupAwards: reservedProvidesRegularGroup
      ? new Map([
          [
            reservedDismount.element.code.group,
            regularGroupAward(reservedDismount, groupRequirements),
          ],
        ])
      : new Map(),
    groupCounts: reservedProvidesRegularGroup
      ? new Map([[reservedDismount.element.code.group, 1]])
      : new Map(),
    selectedOccurrences: [],
    specialCounts: new Map(
      specialLimits.map((limit) => [
        limit.key,
        reservedDismount !== undefined && limit.matches(reservedDismount) ? 1 : 0,
      ]),
    ),
  };
  states.set(
    selectionStateKey(
      emptyState,
      candidateGroups,
      requiredGroups,
      trackedOccurrenceIds,
      specialLimitKeys,
    ),
    emptyState,
  );

  for (const candidate of candidates) {
    const nextStates = new Map(states);
    for (const state of states.values()) {
      if (state.selectedOccurrences.length >= policy.regularElementSlots) {
        continue;
      }

      const group = candidate.element.code.group;
      const currentGroupCount = state.groupCounts.get(group) ?? 0;
      const maximumForGroup = policy.maximumByGroup.get(group) ?? policy.maximumPerElementGroup;
      if (currentGroupCount >= maximumForGroup) {
        continue;
      }
      const matchingSpecialLimits = specialLimits.filter((limit) => limit.matches(candidate));
      if (
        matchingSpecialLimits.some(
          (limit) => (state.specialCounts.get(limit.key) ?? 0) >= limit.maximum,
        )
      ) {
        continue;
      }
      const dependency = dependencies.get(candidate.occurrenceId);
      if (
        dependency !== undefined &&
        !state.selectedOccurrences.some(({ occurrenceId }) => occurrenceId === dependency)
      ) {
        continue;
      }

      const groupCounts = new Map(state.groupCounts);
      groupCounts.set(group, currentGroupCount + 1);
      const groupAwards = new Map(state.groupAwards);
      if (requiredGroups.includes(group)) {
        const award = regularGroupAward(candidate, groupRequirements);
        groupAwards.set(group, scoreTenths(Math.max(groupAwards.get(group) ?? 0, award)));
      }
      const specialCounts = new Map(state.specialCounts);
      matchingSpecialLimits.forEach((limit) =>
        specialCounts.set(limit.key, (specialCounts.get(limit.key) ?? 0) + 1),
      );
      const selectedState: SelectionState = {
        elementDifficulty: state.elementDifficulty + candidate.element.difficulty.tenths,
        groupAwards,
        groupCounts,
        selectedOccurrences: [...state.selectedOccurrences, candidate],
        specialCounts,
      };
      const key = selectionStateKey(
        selectedState,
        candidateGroups,
        requiredGroups,
        trackedOccurrenceIds,
        specialLimitKeys,
      );
      const existing = nextStates.get(key);
      if (existing === undefined || compareEquivalentStates(selectedState, existing) > 0) {
        nextStates.set(key, selectedState);
      }
    }
    states = nextStates;
  }

  const validStates = [...states.values()].filter((state) =>
    satisfiesConditionalGroupMaximums(state, policy),
  );
  const initialBest = validStates[0];
  if (initialBest === undefined) {
    throw new Error('Element selection produced no valid state.');
  }
  const bestState = validStates
    .slice(1)
    .reduce(
      (best, candidate) =>
        compareFinalStates(candidate, best, valueUpgradeClaims, groupRequirements) > 0
          ? candidate
          : best,
      initialBest,
    );

  const selectedOccurrenceIds = new Set(
    bestState.selectedOccurrences.map(({ occurrenceId }) => occurrenceId),
  );
  const specialExclusions = new Map<string, Exclusion>();
  const warnings: DifficultyWarning[] = [];
  for (const candidate of candidates) {
    if (selectedOccurrenceIds.has(candidate.occurrenceId)) continue;
    const bindingLimit = specialLimits.find(
      (limit) =>
        limit.matches(candidate) && (bestState.specialCounts.get(limit.key) ?? 0) >= limit.maximum,
    );
    if (bindingLimit === undefined) continue;
    specialExclusions.set(candidate.occurrenceId, {
      parameters: bindingLimit.parameters,
      reason: bindingLimit.reason,
    });
    warnings.push({
      code: bindingLimit.reason,
      occurrenceIds: [candidate.occurrenceId],
      parameters: bindingLimit.parameters,
    });
  }

  return {
    groupCounts: bestState.groupCounts,
    selectedOccurrenceIds,
    specialExclusions,
    warnings,
  };
}

function satisfiesConditionalGroupMaximums(
  state: SelectionState,
  policy: EffectiveElementCountingPolicy,
): boolean {
  const selected = new Set(state.selectedOccurrences.map(({ occurrenceId }) => occurrenceId));
  for (const [group, configuredMaximum] of policy.maximumByGroup) {
    const count = state.groupCounts.get(group) ?? 0;
    if (count <= policy.maximumPerElementGroup) continue;
    const qualifies = policy.conditionalGroupMaximums.some(
      (condition) =>
        condition.group === group &&
        count <= condition.maximum &&
        condition.requiredOccurrenceIds.every((occurrenceId) => selected.has(occurrenceId)),
    );
    if (!qualifies || count > configuredMaximum) return false;
  }
  return true;
}

function maximumForSelectedRoutine(
  policy: EffectiveElementCountingPolicy,
  group: number,
  selectedOccurrenceIds: ReadonlySet<string>,
): number {
  const qualifies = policy.conditionalGroupMaximums.some(
    (condition) =>
      condition.group === group &&
      condition.requiredOccurrenceIds.every((occurrenceId) =>
        selectedOccurrenceIds.has(occurrenceId),
      ),
  );
  return qualifies
    ? (policy.maximumByGroup.get(group) ?? policy.maximumPerElementGroup)
    : policy.maximumPerElementGroup;
}

function evaluateGroupRequirements(
  selectedOccurrences: readonly ResolvedElementOccurrence[],
  reservedDismount: ResolvedElementOccurrence | undefined,
  requirements: CompiledElementGroupRequirements,
  apparatus: ElementRoutineApparatusId,
): GroupRequirementResult {
  const awards: DifficultyAward[] = [];
  const warnings: DifficultyWarning[] = [];

  for (const group of [...requirements.regularGroups[apparatus]].sort(
    (left, right) => left - right,
  )) {
    const candidates = [
      ...selectedOccurrences,
      ...(reservedDismount === undefined ? [] : [reservedDismount]),
    ].filter(({ element }) => element.code.group === group);
    const provider = candidates.reduce<ResolvedElementOccurrence | undefined>(
      (best, candidate) =>
        best === undefined || compareGroupAwardProviders(candidate, best, requirements) > 0
          ? candidate
          : best,
      undefined,
    );

    if (provider === undefined) {
      warnings.push({
        code: 'fig.missing-element-group',
        occurrenceIds: [],
        parameters: { group },
      });
      continue;
    }

    awards.push({
      component: 'element-group',
      occurrenceIds: [provider.occurrenceId],
      reason: 'fig.element-group-awarded',
      reasonParameters: { group },
      value: regularGroupAward(provider, requirements),
    });
  }

  if (
    reservedDismount !== undefined &&
    !requirements.regularGroups[apparatus].includes(reservedDismount.element.code.group)
  ) {
    awards.push({
      component: 'element-group',
      occurrenceIds: [reservedDismount.occurrenceId],
      reason: 'fig.dismount-group-awarded',
      reasonParameters: { group: reservedDismount.element.code.group },
      value: dismountGroupAward(reservedDismount, requirements.dismountAward),
    });
  }

  return { awards, warnings };
}

function regularGroupAward(
  occurrence: ResolvedElementOccurrence,
  requirements: CompiledElementGroupRequirements,
): ScoreTenths {
  const difficulty = occurrence.element.difficulty.tenths;
  const configuredAward = requirements.regularAwardByDifficultyTenths[String(difficulty)];
  if (configuredAward === undefined) {
    throw new Error(`No element-group award is configured for ${difficulty} difficulty tenths.`);
  }

  return scoreTenths(
    Math.max(
      configuredAward,
      requirements.minimumAwardByGroup[String(occurrence.element.code.group)] ?? 0,
    ),
  );
}

function dismountGroupAward(
  occurrence: ResolvedElementOccurrence,
  policy: CompiledElementGroupRequirements['dismountAward'],
): ScoreTenths {
  switch (policy.mode) {
    case 'element-difficulty':
      return scoreTenths(Math.min(occurrence.element.difficulty.tenths, policy.maximum));
  }
}

function compareGroupAwardProviders(
  left: ResolvedElementOccurrence,
  right: ResolvedElementOccurrence,
  requirements: CompiledElementGroupRequirements,
): number {
  return (
    regularGroupAward(left, requirements) - regularGroupAward(right, requirements) ||
    left.element.difficulty.tenths - right.element.difficulty.tenths ||
    right.position - left.position
  );
}

function selectionStateKey(
  state: SelectionState,
  candidateGroups: readonly number[],
  requiredGroups: readonly number[],
  trackedOccurrenceIds: readonly string[],
  specialLimitKeys: readonly string[],
): string {
  const counts = candidateGroups.map((group) => state.groupCounts.get(group) ?? 0);
  const awards = requiredGroups.map((group) => state.groupAwards.get(group) ?? 0);
  const specialCounts = specialLimitKeys.map((key) => state.specialCounts.get(key) ?? 0);
  const selected = new Set(state.selectedOccurrences.map(({ occurrenceId }) => occurrenceId));
  const tracked = trackedOccurrenceIds.map((occurrenceId) => (selected.has(occurrenceId) ? 1 : 0));
  return `${counts.join(',')}|${awards.join(',')}|${specialCounts.join(',')}|${tracked.join(',')}`;
}

function compareEquivalentStates(left: SelectionState, right: SelectionState): number {
  return (
    left.elementDifficulty - right.elementDifficulty ||
    left.selectedOccurrences.length - right.selectedOccurrences.length ||
    compareOccurrencePositions(left.selectedOccurrences, right.selectedOccurrences)
  );
}

function compareFinalStates(
  left: SelectionState,
  right: SelectionState,
  valueUpgradeClaims: readonly ValueUpgradeClaim[],
  requirements: CompiledElementGroupRequirements,
): number {
  return (
    adjustedStateDifficulty(left, valueUpgradeClaims) -
      adjustedStateDifficulty(right, valueUpgradeClaims) ||
    adjustedStateGroupAwards(left, valueUpgradeClaims, requirements) -
      adjustedStateGroupAwards(right, valueUpgradeClaims, requirements) ||
    left.selectedOccurrences.length - right.selectedOccurrences.length ||
    compareOccurrencePositions(left.selectedOccurrences, right.selectedOccurrences)
  );
}

function adjustedStateDifficulty(
  state: SelectionState,
  claims: readonly ValueUpgradeClaim[],
): number {
  const selected = new Set(state.selectedOccurrences.map(({ occurrenceId }) => occurrenceId));
  let total = state.elementDifficulty;
  for (const upgrade of creditedValueUpgradeMap(claims, selected).values()) {
    total += upgrade.increment;
  }
  return total;
}

function adjustedStateGroupAwards(
  state: SelectionState,
  claims: readonly ValueUpgradeClaim[],
  requirements: CompiledElementGroupRequirements,
): number {
  const awards = new Map(state.groupAwards);
  const selected = new Set(state.selectedOccurrences.map(({ occurrenceId }) => occurrenceId));
  const upgrades = creditedValueUpgradeMap(claims, selected);
  for (const occurrence of state.selectedOccurrences) {
    const adjusted = applyValueUpgrade(occurrence, upgrades.get(occurrence.occurrenceId));
    const group = adjusted.element.code.group;
    if (!awards.has(group)) continue;
    awards.set(
      group,
      scoreTenths(Math.max(awards.get(group) ?? 0, regularGroupAward(adjusted, requirements))),
    );
  }
  return sumGroupAwards(awards);
}

function sumGroupAwards(awards: ReadonlyMap<number, ScoreTenths>): number {
  let total = 0;
  for (const award of awards.values()) {
    total += award;
  }
  return total;
}

function compareOccurrencePositions(
  left: readonly ResolvedElementOccurrence[],
  right: readonly ResolvedElementOccurrence[],
): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const leftPosition = left[index]?.position;
    const rightPosition = right[index]?.position;
    if (
      leftPosition !== undefined &&
      rightPosition !== undefined &&
      leftPosition !== rightPosition
    ) {
      return rightPosition - leftPosition;
    }
  }
  return 0;
}

function countedDecision(
  occurrence: ResolvedElementOccurrence,
  reason: ElementDecision['reason'],
  reasonParameters: ElementDecision['reasonParameters'],
  creditedDifficulty: ScoreTenths = occurrence.element.difficulty.tenths,
): ElementDecision {
  return {
    creditedDifficulty,
    elementId: occurrence.element.id,
    occurrenceId: occurrence.occurrenceId,
    reason,
    reasonParameters,
    status: 'counted',
  };
}

function excludedDecision(
  occurrence: ResolvedElementOccurrence,
  reason: ElementDecision['reason'],
  reasonParameters: ElementDecision['reasonParameters'],
): ElementDecision {
  return {
    creditedDifficulty: scoreTenths(0),
    elementId: occurrence.element.id,
    occurrenceId: occurrence.occurrenceId,
    reason,
    reasonParameters,
    status: 'excluded',
  };
}

function officialCode(occurrence: ResolvedElementOccurrence): string {
  return `${occurrence.element.code.group}:${occurrence.element.code.number}`;
}
