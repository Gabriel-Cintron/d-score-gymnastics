import type {
  ApparatusId,
  CalculationIssue,
  DifficultyResult,
  ElementId,
  ElementRoutineApparatusId,
  RoutineRelationship,
  VaultCalculationIssue,
  VaultDifficultyResult,
} from '@d-score-gymnastics/scoring';

import type { ProfileSelection } from './scoring-profile-state';
import type { ThemeMode } from './theme';

export interface RoutineEntry {
  readonly elementId: ElementId;
  readonly occurrenceId: string;
  readonly qualifiers?: readonly string[];
}

export type RoutineState = Readonly<Record<ElementRoutineApparatusId, readonly RoutineEntry[]>>;
export type RelationshipState = Readonly<
  Record<ElementRoutineApparatusId, readonly RoutineRelationship[]>
>;
export type LandingState = Readonly<Record<ApparatusId, boolean>>;

export interface WorkbenchState extends ProfileSelection {
  readonly apparatus: ApparatusId;
  readonly nextOccurrenceNumber: number;
  readonly relationships: RelationshipState;
  readonly routines: RoutineState;
  readonly stuckByApparatus: LandingState;
  readonly themeMode: ThemeMode;
  readonly vaultId?: ElementId;
}

export type WorkbenchScore =
  | { readonly kind: 'empty' }
  | { readonly kind: 'unsupported'; readonly label: string }
  | {
      readonly issues: readonly (CalculationIssue | VaultCalculationIssue)[];
      readonly kind: 'issues';
    }
  | { readonly kind: 'routine'; readonly result: DifficultyResult }
  | { readonly kind: 'vault'; readonly result: VaultDifficultyResult };
