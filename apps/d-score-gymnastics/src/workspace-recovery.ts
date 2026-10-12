import { APPARATUS_IDS } from '@d-score-gymnastics/scoring';

import {
  activeAllAround,
  allAroundsInLibrary,
  captureAllAroundState,
  libraryNameIsAvailable,
  MAX_LIBRARY_ITEMS,
  nextUntitledAllAroundName,
  routineContentKey,
  type RoutineLibrary,
  type SavedAllAround,
} from './routine-library';
import type { WorkbenchState } from './types';

export function recoverWorkspace(
  library: RoutineLibrary,
  workbench: WorkbenchState | undefined,
  blank: WorkbenchState,
  id: string,
  now: string,
): {
  readonly library: RoutineLibrary;
  readonly workbench: WorkbenchState;
  readonly blocked: boolean;
} {
  const selected = activeAllAround(library) ?? allAroundsInLibrary(library)[0];
  if (selected !== undefined) {
    if (
      workbench === undefined ||
      APPARATUS_IDS.every(
        (apparatus) =>
          routineContentKey(selected.state, apparatus) === routineContentKey(workbench, apparatus),
      )
    ) {
      return {
        blocked: false,
        library: { ...library, activeAllAroundId: selected.id },
        workbench: workbench ?? selected.state,
      };
    }
  }
  const state = workbench ?? blank;
  if (library.items.length >= MAX_LIBRARY_ITEMS)
    return { blocked: true, library, workbench: state };
  let name = selected === undefined ? nextUntitledAllAroundName(library) : 'Recovered workbench';
  let suffix = 2;
  while (!libraryNameIsAvailable(library, name)) name = `Recovered workbench ${suffix++}`;
  const recovered: SavedAllAround = {
    createdAt: now,
    id,
    kind: 'all-around',
    name,
    state: captureAllAroundState(state),
    updatedAt: now,
  };
  return {
    blocked: false,
    library: { activeAllAroundId: id, items: [recovered, ...library.items] },
    workbench: state,
  };
}
