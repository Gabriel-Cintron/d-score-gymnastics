import {
  type ApparatusId,
  type ElementId,
  type ElementRoutine,
  type ElementRoutineApparatusId,
} from '@d-score-gymnastics/scoring';
import {
  isFigConnectionEligible,
  type CompiledElement,
  type CompiledPommelHorseRules,
} from '@d-score-gymnastics/rulesets';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';

import { applyBrowserShellTheme } from './browser-shell';
import {
  createStoredAppPreferences,
  defaultAppPreferences,
  parseStoredAppPreferences,
  type AppPreferences,
} from './app-preferences';
import { appPreferencesRepository } from './app-preferences-repository';
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  parseDScoreGymnasticsBackup,
  serializeDScoreGymnasticsBackup,
} from './backup';
import { exportBackupText } from './backup-transport';
import { AnalyticsInvitation } from './components/AnalyticsInvitation';
import { AllAroundSidebar, type WorkspaceSaveStatus } from './components/AllAroundSidebar';
import { AllAroundSwitchModal, type NamedRoutineToSave } from './components/AllAroundSwitchModal';
import { AppHeader, type AppScreen } from './components/AppHeader';
import { ApparatusSelector } from './components/ApparatusSelector';
import { CatalogPicker } from './components/CatalogPicker';
import { ConfirmationModal } from './components/ConfirmationModal';
import { HomeScreen } from './components/HomeScreen';
import { OnboardingModal } from './components/OnboardingModal';
import { PwaUpdateBanner } from './components/PwaUpdateBanner';
import { MAX_ROUTINE_ELEMENTS, RoutineBuilder, VaultBuilder } from './components/RoutineBuilder';
import { RoutineLibraryModal } from './components/RoutineLibraryModal';
import { RussianLocationModal } from './components/RussianLocationModal';
import { ScorePanel } from './components/ScorePanel';
import { SettingsScreen } from './components/SettingsScreen';
import type { CompletedPommelFlop } from './flop-builder';
import { replaceStoredLocalData } from './local-data-repository';
import { createLocalDataController } from './local-data-controller';
import { recoverWorkspace } from './workspace-recovery';
import { figRuleset, figRuntime } from './ruleset';
import {
  activeAllAround,
  allAroundsInLibrary,
  apparatusHasWork,
  applyLibraryItem,
  blankAllAroundState,
  captureAllAroundState,
  captureRoutineState,
  createStoredRoutineLibrary,
  emptyRoutineLibrary,
  libraryNameIsAvailable,
  MAX_LIBRARY_ITEMS,
  nextUntitledAllAroundName,
  normalizeLibraryName,
  parseStoredRoutineLibrary,
  routinesInCatalogue,
  uncataloguedRoutineApparatuses,
  type RoutineLibrary,
  type SavedAllAround,
  type SavedRoutine,
} from './routine-library';
import { routineLibraryRepository } from './routine-library-repository';
import {
  replaceRussianLocation,
  requiresRussianLocation,
  selectedRussianLocation,
} from './russian-location';
import { buildRoutineItems, moveRoutineItem } from './routine-items';
import { usePwaControls } from './pwa';
import { telemetry } from './telemetry';
import { CURRENT_DISCIPLINE_ID } from './product';
import { ThemeProvider, useTheme, type ThemeColors, type ThemeMode } from './theme';
import type {
  LandingState,
  RelationshipState,
  RoutineEntry,
  RoutineState,
  WorkbenchScore,
  WorkbenchState,
} from './types';
import { workbenchRepository } from './workbench-repository';
import {
  createStoredWorkbenchState,
  emptyLandings,
  emptyRelationships,
  emptyRoutines,
  parseStoredWorkbenchState,
  pruneRelationships,
} from './workbench-state';

const elementById: ReadonlyMap<ElementId, CompiledElement> = new Map(
  figRuleset.elements.map((element) => [element.id, element]),
);
const difficultyLetterByTenths: ReadonlyMap<number, string> = new Map(
  Object.entries(figRuleset.difficultyScale).map(([letter, difficulty]) => [difficulty, letter]),
);
const rulesetIdentity = {
  dataRevision: figRuleset.dataRevision,
  dataVersion: figRuleset.dataVersion,
  disciplineId: CURRENT_DISCIPLINE_ID,
  id: figRuleset.id,
};
const pommelRules: CompiledPommelHorseRules = (() => {
  const rules = figRuleset.apparatusRules['pommel-horse'];
  if (rules.apparatus !== 'pommel-horse') {
    throw new Error('The compiled Pommel Horse rules are not available.');
  }
  return rules;
})();

type PendingRussianLocation =
  | { readonly element: CompiledElement; readonly kind: 'add' }
  | {
      readonly element: CompiledElement;
      readonly kind: 'edit';
      readonly occurrenceId: string;
      readonly selectedLocation?: string;
    };

type AllAroundDestination =
  { readonly itemId: string; readonly kind: 'existing' } | { readonly kind: 'new' };

interface PendingAllAroundSwitch {
  readonly apparatuses: readonly ApparatusId[];
  readonly destination: AllAroundDestination;
}

export default function App() {
  const preferredColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    preferredColorScheme === 'dark' ? 'dark' : 'light',
  );

  return (
    <ThemeProvider mode={themeMode}>
      <BrowserShellTheme />
      <Workbench onThemeModeChange={setThemeMode} themeMode={themeMode} />
    </ThemeProvider>
  );
}

function BrowserShellTheme() {
  const { colors, mode } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    applyBrowserShellTheme(document, mode, colors);
  }, [colors, mode]);

  return null;
}

function Workbench({
  onThemeModeChange,
  themeMode,
}: {
  readonly onThemeModeChange: (mode: ThemeMode) => void;
  readonly themeMode: ThemeMode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pwa = usePwaControls();
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const [apparatus, setApparatus] = useState<ApparatusId>('floor-exercise');
  const [allAroundsVisible, setAllAroundsVisible] = useState(false);
  const [appPreferences, setAppPreferences] = useState<AppPreferences>(defaultAppPreferences);
  const [appPreferencesReady, setAppPreferencesReady] = useState(false);
  const [library, setLibrary] = useState<RoutineLibrary>(emptyRoutineLibrary);
  const [libraryError, setLibraryError] = useState<string>();
  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryRevision, setLibraryRevision] = useState(0);
  const [librarySaveStatus, setLibrarySaveStatus] = useState<WorkspaceSaveStatus>('loading');
  const [libraryWritable, setLibraryWritable] = useState(true);
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [pendingAllAroundSwitch, setPendingAllAroundSwitch] = useState<PendingAllAroundSwitch>();
  const [pendingBlankRoutine, setPendingBlankRoutine] = useState<ApparatusId>();
  const [pendingHomeRoutine, setPendingHomeRoutine] = useState<SavedRoutine>();
  const [pendingRussianLocation, setPendingRussianLocation] = useState<PendingRussianLocation>();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [relationships, setRelationships] = useState<RelationshipState>(emptyRelationships);
  const [routines, setRoutines] = useState<RoutineState>(emptyRoutines);
  const [vaultId, setVaultId] = useState<ElementId>();
  const [stuckByApparatus, setStuckByApparatus] = useState<LandingState>(emptyLandings);
  const [storageReady, setStorageReady] = useState(false);
  const [screen, setScreen] = useState<AppScreen>('home');
  const [tourVisible, setTourVisible] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const occurrenceCounter = useRef(1);
  const mutationInProgress = useRef(false);
  const persistence = useRef<ReturnType<typeof createLocalDataController> | undefined>(undefined);
  persistence.current ??= createLocalDataController({
    replace: replaceStoredLocalData,
    onStatus: (status) => {
      setLibrarySaveStatus(status);
      setLibraryError(
        status === 'error'
          ? 'Local save failed. Your work is temporary until saving succeeds; export a backup before leaving.'
          : undefined,
      );
    },
  });

  useEffect(() => {
    let active = true;
    const context = { disciplineId: CURRENT_DISCIPLINE_ID, elementById, rulesetId: figRuleset.id };
    void Promise.allSettled([
      appPreferencesRepository.load(),
      workbenchRepository.load(),
      routineLibraryRepository.load(),
    ]).then(([preferencesResult, workbenchResult, libraryResult]) => {
      if (!active) return;
      const preferencesValue =
        preferencesResult.status === 'fulfilled' ? preferencesResult.value : undefined;
      const workbenchValue =
        workbenchResult.status === 'fulfilled' ? workbenchResult.value : undefined;
      const libraryValue = libraryResult.status === 'fulfilled' ? libraryResult.value : undefined;
      const preferences = parseStoredAppPreferences(preferencesValue);
      const workbench = parseStoredWorkbenchState(workbenchValue, context);
      const restoredLibrary = parseStoredRoutineLibrary(libraryValue, context);
      const invalid =
        [preferencesResult, workbenchResult, libraryResult].some(
          (result) => result.status === 'rejected',
        ) ||
        (preferencesValue !== undefined && preferences === undefined) ||
        (workbenchValue !== undefined && workbench === undefined) ||
        (libraryValue !== undefined && restoredLibrary === undefined);
      const recovered = recoverWorkspace(
        restoredLibrary ?? emptyRoutineLibrary(),
        workbench,
        blankAllAroundState(themeMode),
        createLibraryItemId(),
        new Date().toISOString(),
      );
      const state = recovered.workbench;
      occurrenceCounter.current = state.nextOccurrenceNumber;
      setApparatus(state.apparatus);
      setRelationships(state.relationships);
      setRoutines(state.routines);
      setStuckByApparatus(state.stuckByApparatus);
      setVaultId(state.vaultId);
      onThemeModeChange(state.themeMode);
      setLibrary(recovered.library);
      setAppPreferences(preferences ?? defaultAppPreferences);
      setTourVisible(!(preferences ?? defaultAppPreferences).onboardingComplete);
      const writable = !invalid && !recovered.blocked;
      setLibraryWritable(writable);
      if (!writable) {
        setLibrarySaveStatus('error');
        setLibraryError(
          recovered.blocked
            ? 'Recovery needs space in the library. Original records are preserved. Export a backup before leaving; restore a backup with fewer saved items to resume saving.'
            : 'Local data could not be opened or validated. Original records are preserved. Your work is temporary; export a backup before leaving.',
        );
      }
      setAppPreferencesReady(true);
      setLibraryReady(true);
      setStorageReady(true);
      setWorkspaceReady(true);
    });
    return () => {
      active = false;
    };
    // Startup uses the initial theme only; subsequent appearance changes use the unified save path.
  }, [onThemeModeChange]);

  useEffect(() => {
    if (!workspaceReady || !libraryWritable || mutationInProgress.current) return;
    const now = new Date().toISOString();
    const state = currentWorkbenchState();
    persistence.current?.schedule({
      library: createStoredRoutineLibrary(
        libraryWithActiveSnapshot(library, state, now),
        rulesetIdentity,
      ),
      preferences: createStoredAppPreferences(appPreferences),
      workbench: createStoredWorkbenchState(state, rulesetIdentity),
    });
  }, [
    apparatus,
    relationships,
    routines,
    stuckByApparatus,
    themeMode,
    vaultId,
    library,
    libraryRevision,
    appPreferences,
    workspaceReady,
    libraryWritable,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const flush = () => {
      if (libraryWritable && document.visibilityState === 'hidden') {
        void persistence.current?.flush().catch(() => undefined);
      }
    };
    const pageHide = () => {
      if (libraryWritable) void persistence.current?.flush().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', flush);
    globalThis.addEventListener('pagehide', pageHide);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      globalThis.removeEventListener('pagehide', pageHide);
    };
  }, [libraryWritable]);

  async function reloadForUpdate(): Promise<void> {
    if (!libraryWritable) {
      setLibraryError(
        'Export a backup before leaving this session. Reload is blocked because local storage is unavailable.',
      );
      return;
    }
    try {
      await persistence.current?.flush();
      pwa.applyUpdate();
    } catch {
      setLibraryError(
        'The update could not be applied because your latest work could not be saved. Export a backup or retry Reload.',
      );
    }
  }

  useEffect(() => {
    setRelationships((current) =>
      pruneIneligibleConnections(pruneRelationships(current, routines), routines),
    );
  }, [routines]);

  const apparatusElements = figRuntime.elementsForApparatus(apparatus);
  const selectedElementIds = useMemo<ReadonlySet<ElementId>>(
    () =>
      apparatus === 'vault'
        ? new Set()
        : new Set(routines[apparatus].map(({ elementId }) => elementId)),
    [apparatus, routines],
  );
  const activeRoutineItemCount =
    apparatus === 'vault'
      ? 0
      : buildRoutineItems(routines[apparatus], relationships[apparatus]).length;
  const currentAllAround = activeAllAround(library);
  const catalogueCount = routinesInCatalogue(library).length;
  const elementGroups = useMemo(() => {
    if (apparatus === 'vault') return [];
    const regularGroups = figRuleset.sharedRules.elementGroupRequirements.regularGroups[apparatus];
    const dismountGroups = apparatusElements
      .filter((element) => element.roles.includes('dismount'))
      .map((element) => element.code.group);
    return [...new Set([...regularGroups, ...dismountGroups])].sort((left, right) => left - right);
  }, [apparatus, apparatusElements]);
  const selectedVault = vaultId === undefined ? undefined : elementById.get(vaultId);
  const score = useMemo<WorkbenchScore>(() => {
    if (apparatus === 'vault') {
      if (vaultId === undefined) return { kind: 'empty' };
      const outcome = figRuntime.scoreVault({
        apparatus: 'vault',
        vaultId,
        ...(stuckByApparatus.vault ? { landing: 'stuck' } : {}),
      });
      return outcome.ok
        ? { kind: 'vault', result: outcome.result }
        : { issues: outcome.issues, kind: 'issues' };
    }

    const entries = routines[apparatus];
    if (entries.length === 0) return { kind: 'empty' };
    const finalEntry = entries.at(-1);
    const routine: ElementRoutine = {
      apparatus,
      occurrences: entries.map(({ elementId, occurrenceId, qualifiers }) => ({
        elementId,
        occurrenceId,
        ...(qualifiers === undefined ? {} : { qualifiers }),
      })),
      ...(relationships[apparatus].length === 0 ? {} : { relationships: relationships[apparatus] }),
      ...(stuckByApparatus[apparatus] && finalEntry !== undefined
        ? { landing: { occurrenceId: finalEntry.occurrenceId, outcome: 'stuck' } }
        : {}),
    };
    const outcome = figRuntime.scoreRoutine(routine);
    return outcome.ok
      ? { kind: 'routine', result: outcome.result }
      : { issues: outcome.issues, kind: 'issues' };
  }, [apparatus, relationships, routines, stuckByApparatus, vaultId]);

  function selectApparatus(nextApparatus: ApparatusId): void {
    setApparatus(nextApparatus);
    setPickerVisible(false);
    setPendingRussianLocation(undefined);
  }

  function selectElement(element: CompiledElement): void {
    if (apparatus === 'vault') {
      setVaultId(element.id);
      setPickerVisible(false);
      return;
    }
    if (apparatus === 'pommel-horse' && requiresRussianLocation(element, pommelRules)) {
      setPickerVisible(false);
      setPendingRussianLocation({ element, kind: 'add' });
      return;
    }

    addRoutineElement(apparatus, element);
  }

  function addRoutineElement(
    routineApparatus: ElementRoutineApparatusId,
    element: CompiledElement,
    qualifiers?: readonly string[],
  ): void {
    updateRoutine(routineApparatus, (entries) => {
      if (
        buildRoutineItems(entries, relationships[routineApparatus]).length >=
          MAX_ROUTINE_ELEMENTS ||
        entries.some(({ elementId }) => elementId === element.id)
      ) {
        return entries;
      }
      const nextOccurrence = occurrenceCounter.current;
      occurrenceCounter.current += 1;
      return [
        ...entries,
        {
          elementId: element.id,
          occurrenceId: `routine-element-${nextOccurrence}`,
          ...(qualifiers === undefined ? {} : { qualifiers }),
        },
      ];
    });
    setPickerVisible(false);
  }

  function editRussianLocation(occurrenceId: string): void {
    const entry = routines['pommel-horse'].find(
      (candidate) => candidate.occurrenceId === occurrenceId,
    );
    const element = entry === undefined ? undefined : elementById.get(entry.elementId);
    if (
      entry === undefined ||
      element === undefined ||
      !requiresRussianLocation(element, pommelRules)
    ) {
      return;
    }
    const currentLocation = selectedRussianLocation(entry.qualifiers, pommelRules);
    setPendingRussianLocation({
      element,
      kind: 'edit',
      occurrenceId,
      ...(currentLocation === undefined ? {} : { selectedLocation: currentLocation }),
    });
  }

  function confirmRussianLocation(location: string): void {
    if (pendingRussianLocation === undefined) return;
    if (pendingRussianLocation.kind === 'add') {
      addRoutineElement(
        'pommel-horse',
        pendingRussianLocation.element,
        replaceRussianLocation(undefined, location, pommelRules),
      );
    } else {
      const occurrenceId = pendingRussianLocation.occurrenceId;
      updateRoutine('pommel-horse', (entries) =>
        entries.map((entry) =>
          entry.occurrenceId === occurrenceId
            ? {
                ...entry,
                qualifiers: replaceRussianLocation(entry.qualifiers, location, pommelRules),
              }
            : entry,
        ),
      );
    }
    setPendingRussianLocation(undefined);
  }

  function updateRoutine(
    routineApparatus: ElementRoutineApparatusId,
    update: (entries: readonly RoutineEntry[]) => readonly RoutineEntry[],
  ): void {
    setRoutines((current) => ({
      ...current,
      [routineApparatus]: update(current[routineApparatus]),
    }));
  }

  function moveElement(
    routineApparatus: ElementRoutineApparatusId,
    index: number,
    direction: -1 | 1,
  ): void {
    updateRoutine(routineApparatus, (entries) => {
      const items = buildRoutineItems(entries, relationships[routineApparatus]);
      return moveRoutineItem(items, index, direction);
    });
  }

  function removeElement(routineApparatus: ElementRoutineApparatusId, index: number): void {
    const items = buildRoutineItems(routines[routineApparatus], relationships[routineApparatus]);
    const removedOccurrenceIds = new Set(
      items[index]?.entries.map(({ occurrenceId }) => occurrenceId) ?? [],
    );
    updateRoutine(routineApparatus, (entries) =>
      entries.filter(({ occurrenceId }) => !removedOccurrenceIds.has(occurrenceId)),
    );
    if (items.length === 1) setStuck(routineApparatus, false);
  }

  function clearRoutine(routineApparatus: ElementRoutineApparatusId): void {
    updateRoutine(routineApparatus, () => []);
    setStuck(routineApparatus, false);
  }

  function toggleConnection(
    routineApparatus: ElementRoutineApparatusId,
    firstOccurrenceId: string,
    secondOccurrenceId: string,
  ): void {
    setRelationships((current) => {
      const existing = current[routineApparatus];
      const connectionIndex = existing.findIndex(
        (relationship) =>
          relationship.kind === 'connection' &&
          relationship.occurrenceIds[0] === firstOccurrenceId &&
          relationship.occurrenceIds[1] === secondOccurrenceId,
      );
      const next =
        connectionIndex === -1
          ? [
              ...existing,
              {
                connectionId: `connection:${firstOccurrenceId}:${secondOccurrenceId}`,
                kind: 'connection' as const,
                occurrenceIds: [firstOccurrenceId, secondOccurrenceId] as const,
              },
            ]
          : existing.filter((_, index) => index !== connectionIndex);
      return { ...current, [routineApparatus]: next };
    });
  }

  function selectPommelFlop(
    components: readonly CompiledElement[],
    completed: CompletedPommelFlop,
  ): void {
    if (
      apparatus !== 'pommel-horse' ||
      buildRoutineItems(routines['pommel-horse'], relationships['pommel-horse']).length >=
        MAX_ROUTINE_ELEMENTS
    ) {
      return;
    }
    const componentEntries = components.map<RoutineEntry>((component) => {
      const occurrenceNumber = occurrenceCounter.current;
      occurrenceCounter.current += 1;
      return {
        elementId: component.id,
        occurrenceId: `routine-element-${occurrenceNumber}`,
      };
    });
    const first = componentEntries[0];
    const second = componentEntries[1];
    if (first === undefined || second === undefined) return;
    const occurrenceIds = [
      first.occurrenceId,
      second.occurrenceId,
      ...componentEntries.slice(2).map(({ occurrenceId }) => occurrenceId),
    ] as const;
    const sequenceId = `sequence:${completed.sequenceType}:${occurrenceIds.join(':')}`;
    updateRoutine('pommel-horse', (entries) => [...entries, ...componentEntries]);
    setRelationships((current) => ({
      ...current,
      'pommel-horse': [
        ...current['pommel-horse'],
        {
          kind: 'sequence',
          occurrenceIds,
          sequenceId,
          sequenceType: completed.sequenceType,
        },
      ],
    }));
    setPickerVisible(false);
  }

  function clearVault(): void {
    setVaultId(undefined);
    setStuck('vault', false);
  }

  function setStuck(target: ApparatusId, stuck: boolean): void {
    setStuckByApparatus((current) => ({ ...current, [target]: stuck }));
  }

  function currentWorkbenchState(): WorkbenchState {
    return {
      apparatus,
      nextOccurrenceNumber: occurrenceCounter.current,
      relationships,
      routines,
      stuckByApparatus,
      themeMode,
      ...(vaultId === undefined ? {} : { vaultId }),
    };
  }

  function createNamedRoutine(name: string): void {
    const normalizedName = normalizeLibraryName(name);
    const source = currentWorkbenchState();
    if (
      !apparatusHasWork(source, apparatus) ||
      !libraryNameIsAvailable(library, normalizedName) ||
      library.items.length >= MAX_LIBRARY_ITEMS
    ) {
      return;
    }
    const now = new Date().toISOString();
    const item: SavedRoutine = {
      apparatus,
      createdAt: now,
      id: createLibraryItemId(),
      kind: 'routine',
      name: normalizedName,
      state: captureRoutineState(source, apparatus),
      updatedAt: now,
    };
    setLibrary((current) =>
      current.items.length < MAX_LIBRARY_ITEMS && libraryNameIsAvailable(current, normalizedName)
        ? { ...current, items: [item, ...current.items] }
        : current,
    );
    setLibraryRevision((current) => current + 1);
  }

  function renameLibraryItem(itemId: string, name: string): void {
    const normalizedName = normalizeLibraryName(name);
    const now = new Date().toISOString();
    setLibrary((current) => {
      if (!libraryNameIsAvailable(current, normalizedName, itemId)) return current;
      return {
        ...current,
        items: current.items.map((item) =>
          item.id === itemId ? { ...item, name: normalizedName, updatedAt: now } : item,
        ),
      };
    });
    setLibraryRevision((current) => current + 1);
  }

  function deleteRoutineItem(itemId: string): void {
    setLibrary((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
    }));
    setLibraryRevision((current) => current + 1);
  }

  function loadWorkbenchItem(item: SavedAllAround | SavedRoutine): void {
    const next = applyLibraryItem(currentWorkbenchState(), item, occurrenceCounter.current);
    occurrenceCounter.current = next.nextOccurrenceNumber;
    setApparatus(next.apparatus);
    setRelationships(next.relationships);
    setRoutines(next.routines);
    setStuckByApparatus(next.stuckByApparatus);
    setVaultId(next.vaultId);
    setPickerVisible(false);
    setPendingRussianLocation(undefined);
  }

  function loadRoutineItem(item: SavedRoutine): void {
    loadWorkbenchItem(item);
    setScreen('editor');
  }

  function routineItemWouldReplaceWork(item: SavedRoutine): boolean {
    return apparatusHasWork(currentWorkbenchState(), item.apparatus);
  }

  function requestAllAroundSwitch(destination: AllAroundDestination): void {
    setAllAroundsVisible(false);
    if (!workspaceReady) return;
    if (destination.kind === 'existing' && destination.itemId === library.activeAllAroundId) {
      setScreen('editor');
      return;
    }
    if (destination.kind === 'new' && library.items.length >= MAX_LIBRARY_ITEMS) {
      setLibraryError('Delete a saved item before creating another all-around.');
      return;
    }
    const apparatuses = uncataloguedRoutineApparatuses(currentWorkbenchState(), library);
    if (apparatuses.length > 0) {
      setPendingAllAroundSwitch({ apparatuses, destination });
      return;
    }
    completeAllAroundSwitch(destination, []);
  }

  function completeAllAroundSwitch(
    destination: AllAroundDestination,
    namedRoutines: readonly NamedRoutineToSave[],
  ): void {
    const source = currentWorkbenchState();
    const now = new Date().toISOString();
    const catalogueItems: SavedRoutine[] = namedRoutines.map(({ apparatus, name }) => ({
      apparatus,
      createdAt: now,
      id: createLibraryItemId(),
      kind: 'routine',
      name: normalizeLibraryName(name),
      state: captureRoutineState(source, apparatus),
      updatedAt: now,
    }));
    const target =
      destination.kind === 'existing'
        ? allAroundsInLibrary(library).find((item) => item.id === destination.itemId)
        : {
            createdAt: now,
            id: createLibraryItemId(),
            kind: 'all-around' as const,
            name: nextUntitledAllAroundName({
              ...library,
              items: [...catalogueItems, ...library.items],
            }),
            state: blankAllAroundState(themeMode, occurrenceCounter.current),
            updatedAt: now,
          };
    if (target === undefined) return;

    setLibrary((current) => {
      const currentNames = new Set(
        current.items.map((item) => item.name.toLocaleLowerCase('en-US')),
      );
      const validCatalogueItems = catalogueItems.filter((item) => {
        const key = item.name.toLocaleLowerCase('en-US');
        if (
          currentNames.has(key) ||
          normalizeLibraryName(item.name).length === 0 ||
          current.items.length + catalogueItems.length + (destination.kind === 'new' ? 1 : 0) >
            MAX_LIBRARY_ITEMS
        ) {
          return false;
        }
        currentNames.add(key);
        return true;
      });
      const savedItems = current.items.map((item) =>
        item.kind === 'all-around' && item.id === current.activeAllAroundId
          ? { ...item, state: captureAllAroundState(source), updatedAt: now }
          : item,
      );
      return {
        activeAllAroundId: target.id,
        items: [
          ...validCatalogueItems,
          ...(destination.kind === 'new' ? [target] : []),
          ...savedItems,
        ],
      };
    });
    setLibraryRevision((current) => current + 1);
    loadWorkbenchItem(target);
    setPendingAllAroundSwitch(undefined);
    setScreen('editor');
  }

  function deleteAllAround(itemId: string): void {
    const deletingActive = itemId === library.activeAllAroundId;
    if (!deletingActive) {
      setLibrary((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== itemId),
      }));
      setLibraryRevision((current) => current + 1);
      return;
    }

    const remaining = allAroundsInLibrary(library).filter((item) => item.id !== itemId);
    const now = new Date().toISOString();
    const target: SavedAllAround = remaining[0] ?? {
      createdAt: now,
      id: createLibraryItemId(),
      kind: 'all-around',
      name: nextUntitledAllAroundName({
        items: library.items.filter((item) => item.id !== itemId),
      }),
      state: blankAllAroundState(themeMode, occurrenceCounter.current),
      updatedAt: now,
    };
    setLibrary((current) => ({
      activeAllAroundId: target.id,
      items: [
        ...(remaining.length === 0 ? [target] : []),
        ...current.items.filter((item) => item.id !== itemId),
      ],
    }));
    setLibraryRevision((current) => current + 1);
    loadWorkbenchItem(target);
  }

  function goHome(): void {
    setPickerVisible(false);
    setPendingRussianLocation(undefined);
    setScreen('home');
  }

  function openSettings(): void {
    setPickerVisible(false);
    setPendingRussianLocation(undefined);
    setScreen('settings');
  }

  function requestBlankRoutine(target: ApparatusId): void {
    if (!workspaceReady) return;
    if (apparatusHasWork(currentWorkbenchState(), target)) {
      setPendingBlankRoutine(target);
      return;
    }
    beginBlankRoutine(target);
  }

  function beginBlankRoutine(target: ApparatusId): void {
    if (target === 'vault') {
      setVaultId(undefined);
    } else {
      setRoutines((current) => ({ ...current, [target]: [] }));
      setRelationships((current) => ({ ...current, [target]: [] }));
    }
    setStuck(target, false);
    setApparatus(target);
    setPendingBlankRoutine(undefined);
    setScreen('editor');
  }

  function requestHomeRoutine(item: SavedRoutine): void {
    if (routineItemWouldReplaceWork(item)) {
      setPendingHomeRoutine(item);
      return;
    }
    loadRoutineItem(item);
  }

  function completeOnboarding(): void {
    const nextPreferences = { onboardingComplete: true };
    setAppPreferences(nextPreferences);
    setTourVisible(false);
  }

  function currentLibrarySnapshot(now = new Date().toISOString()): RoutineLibrary {
    return libraryWithActiveSnapshot(library, currentWorkbenchState(), now);
  }

  async function exportBackup(): Promise<void> {
    const now = new Date().toISOString();
    const source = currentWorkbenchState();
    const librarySnapshot = currentLibrarySnapshot(now);
    const backup = serializeDScoreGymnasticsBackup({
      disciplineId: CURRENT_DISCIPLINE_ID,
      exportedAt: now,
      format: BACKUP_FORMAT,
      library: createStoredRoutineLibrary(librarySnapshot, rulesetIdentity),
      preferences: createStoredAppPreferences(appPreferences),
      schemaVersion: BACKUP_SCHEMA_VERSION,
      workbench: createStoredWorkbenchState(source, rulesetIdentity),
    });
    await exportBackupText(backup);
  }

  async function restoreBackup(text: string): Promise<boolean> {
    const restored = parseDScoreGymnasticsBackup(text, {
      disciplineId: CURRENT_DISCIPLINE_ID,
      elementById,
      rulesetId: figRuleset.id,
    });
    if (restored === undefined) return false;
    const nextLibrary = libraryWithActiveSnapshot(
      restored.library,
      restored.workbench,
      new Date().toISOString(),
    );

    mutationInProgress.current = true;
    try {
      await persistence.current?.replace({
        library: createStoredRoutineLibrary(nextLibrary, rulesetIdentity),
        preferences: createStoredAppPreferences(restored.preferences),
        workbench: createStoredWorkbenchState(restored.workbench, rulesetIdentity),
      });
      occurrenceCounter.current = restored.workbench.nextOccurrenceNumber;
      setApparatus(restored.workbench.apparatus);
      setRelationships(restored.workbench.relationships);
      setRoutines(restored.workbench.routines);
      setStuckByApparatus(restored.workbench.stuckByApparatus);
      setVaultId(restored.workbench.vaultId);
      onThemeModeChange(restored.workbench.themeMode);
      setLibrary(nextLibrary);
      setLibraryError(undefined);
      setLibrarySaveStatus('saved');
      setLibraryWritable(true);
      setLibraryRevision((current) => current + 1);
      setAppPreferences(restored.preferences);
      setTourVisible(!restored.preferences.onboardingComplete);
      setScreen('home');
      return true;
    } finally {
      mutationInProgress.current = false;
    }
  }

  async function clearAllLocalData(): Promise<void> {
    const nextThemeMode: ThemeMode = 'light';
    const state = blankAllAroundState(nextThemeMode);
    const now = new Date().toISOString();
    const item: SavedAllAround = {
      createdAt: now,
      id: createLibraryItemId(),
      kind: 'all-around',
      name: 'Untitled All-Around',
      state,
      updatedAt: now,
    };
    mutationInProgress.current = true;
    try {
      await persistence.current?.reset({
        library: createStoredRoutineLibrary(
          { activeAllAroundId: item.id, items: [item] },
          rulesetIdentity,
        ),
        preferences: createStoredAppPreferences(defaultAppPreferences),
        workbench: createStoredWorkbenchState(state, rulesetIdentity),
      });
    } finally {
      mutationInProgress.current = false;
    }
    occurrenceCounter.current = 1;
    setApparatus(state.apparatus);
    setRelationships(state.relationships);
    setRoutines(state.routines);
    setStuckByApparatus(state.stuckByApparatus);
    setVaultId(undefined);
    onThemeModeChange(nextThemeMode);
    setLibrary({ activeAllAroundId: item.id, items: [item] });
    setLibraryError(undefined);
    setLibrarySaveStatus('saved');
    setLibraryWritable(true);
    setLibraryRevision((current) => current + 1);
    setAppPreferences(defaultAppPreferences);
    setTourVisible(true);
    setScreen('home');
  }

  useEffect(() => telemetry.start(), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <PwaUpdateBanner
        onDismiss={pwa.dismissUpdate}
        onReload={() => void reloadForUpdate()}
        visible={pwa.updateAvailable}
      />
      {screen === 'home' || libraryError === undefined ? null : (
        <Text accessibilityRole="alert" style={{ color: colors.danger, padding: 12 }}>
          {libraryError}
        </Text>
      )}
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppHeader
          onBackHome={goHome}
          onOpenSettings={openSettings}
          onThemeModeChange={onThemeModeChange}
          screen={screen}
          themeMode={themeMode}
        />

        <AnalyticsInvitation
          visible={screen === 'home' && !tourVisible && libraryReady && workspaceReady}
          onSettings={openSettings}
        />

        {screen === 'home' ? (
          <HomeScreen
            currentState={currentWorkbenchState()}
            library={library}
            onContinue={() => setScreen('editor')}
            onManageAllArounds={() => setAllAroundsVisible(true)}
            onNewAllAround={() => requestAllAroundSwitch({ kind: 'new' })}
            onOpenAllAround={(item) =>
              requestAllAroundSwitch({ itemId: item.id, kind: 'existing' })
            }
            onOpenCatalogue={() => setLibraryVisible(true)}
            onOpenRoutine={requestHomeRoutine}
            onOpenTour={() => setTourVisible(true)}
            onStartRoutine={requestBlankRoutine}
            ready={libraryReady && workspaceReady}
            saveStatus={librarySaveStatus}
            {...(libraryError === undefined ? {} : { errorMessage: libraryError })}
          />
        ) : screen === 'settings' ? (
          <SettingsScreen
            onClearLocalData={clearAllLocalData}
            onExportBackup={exportBackup}
            onInstall={pwa.install}
            onReplayTour={() => setTourVisible(true)}
            onRestoreBackup={restoreBackup}
            onThemeModeChange={onThemeModeChange}
            ready={appPreferencesReady && storageReady && libraryReady && workspaceReady}
            persistent={libraryWritable}
            installAvailability={pwa.installAvailability}
            ruleset={{
              authoritativeRulesUrl: figRuleset.authoritativeRulesUrl,
              officialPublicationCutoff: figRuleset.catalogCoverage.officialPublicationCutoff,
              dataVersion: figRuleset.dataVersion,
              elementCount: figRuleset.elements.length,
              status: figRuleset.status,
            }}
            themeMode={themeMode}
          />
        ) : (
          <View style={styles.mainContent}>
            <View style={styles.activeWorkspace}>
              <View style={styles.activeWorkspaceCopy}>
                <Text style={styles.activeWorkspaceEyebrow}>ACTIVE ALL-AROUND</Text>
                <Text numberOfLines={1} style={styles.activeWorkspaceName}>
                  {currentAllAround?.name ?? 'Current local workbench'}
                </Text>
              </View>
              <View style={styles.workspaceActions}>
                <View style={styles.autoSaveBadge}>
                  <View style={styles.autoSaveDot} />
                  <Text style={styles.autoSaveText}>
                    {librarySaveStatus === 'saving'
                      ? 'SAVING'
                      : librarySaveStatus === 'error'
                        ? 'SAVE ERROR'
                        : librarySaveStatus === 'loading'
                          ? 'LOADING'
                          : 'AUTOSAVED'}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Open all-around workspaces"
                  accessibilityRole="button"
                  onPress={() => setAllAroundsVisible(true)}
                  style={({ pressed }) => [styles.libraryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.libraryButtonIcon}>AA</Text>
                  <Text style={styles.libraryButtonText}>All-arounds</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Open routine catalogue. ${catalogueCount} saved.`}
                  accessibilityRole="button"
                  onPress={() => setLibraryVisible(true)}
                  style={({ pressed }) => [styles.libraryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.libraryButtonIcon}>▤</Text>
                  <Text style={styles.libraryButtonText}>Routines</Text>
                  {catalogueCount === 0 ? null : (
                    <View style={styles.libraryCountBadge}>
                      <Text style={styles.libraryCountText}>{catalogueCount}</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </View>

            <ApparatusSelector onChange={selectApparatus} selected={apparatus} />

            <View style={[styles.workspace, isWide && styles.workspaceWide]}>
              <View style={styles.builderColumn}>
                {apparatus === 'vault' ? (
                  <VaultBuilder
                    onChoose={() => setPickerVisible(true)}
                    onClear={clearVault}
                    onStuckChange={(stuck) => setStuck('vault', stuck)}
                    stuck={stuckByApparatus.vault}
                    {...(selectedVault === undefined ? {} : { vault: selectedVault })}
                  />
                ) : (
                  <RoutineBuilder
                    apparatus={apparatus}
                    canConnect={(first, second) =>
                      isFigConnectionEligible(first, second, figRuleset.apparatusRules[apparatus])
                    }
                    difficultyLetterByTenths={difficultyLetterByTenths}
                    elementById={elementById}
                    entries={routines[apparatus]}
                    onAdd={() => setPickerVisible(true)}
                    onClear={() => clearRoutine(apparatus)}
                    onMove={(index, direction) => moveElement(apparatus, index, direction)}
                    onRemove={(index) => removeElement(apparatus, index)}
                    onRussianLocationEdit={editRussianLocation}
                    onStuckChange={(stuck) => setStuck(apparatus, stuck)}
                    onToggleConnection={(firstOccurrenceId, secondOccurrenceId) =>
                      toggleConnection(apparatus, firstOccurrenceId, secondOccurrenceId)
                    }
                    pommelRules={pommelRules}
                    relationships={relationships[apparatus]}
                    stuck={stuckByApparatus[apparatus]}
                  />
                )}
              </View>
              <View style={styles.scoreColumn}>
                <ScorePanel
                  difficultyLetterByTenths={difficultyLetterByTenths}
                  elementById={elementById}
                  elementGroups={elementGroups}
                  routineIsFull={
                    apparatus !== 'vault' && activeRoutineItemCount >= MAX_ROUTINE_ELEMENTS
                  }
                  score={score}
                />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <CatalogPicker
        apparatus={apparatus}
        elements={apparatusElements}
        excludedElementIds={selectedElementIds}
        difficultyLetterByTenths={difficultyLetterByTenths}
        onClose={() => setPickerVisible(false)}
        onSelect={selectElement}
        onSelectFlop={selectPommelFlop}
        pommelRules={pommelRules}
        visible={pickerVisible}
      />
      <RoutineLibraryModal
        activeApparatus={apparatus}
        canSaveCurrent={apparatusHasWork(currentWorkbenchState(), apparatus)}
        library={library}
        onClose={() => setLibraryVisible(false)}
        onCreateRoutine={createNamedRoutine}
        onDelete={deleteRoutineItem}
        onLoad={loadRoutineItem}
        onRename={renameLibraryItem}
        ready={libraryReady && workspaceReady}
        visible={libraryVisible}
        wouldReplaceWork={routineItemWouldReplaceWork}
        {...(libraryError === undefined ? {} : { errorMessage: libraryError })}
      />
      <AllAroundSidebar
        compact
        library={library}
        onClose={() => setAllAroundsVisible(false)}
        onDelete={deleteAllAround}
        onNew={() => requestAllAroundSwitch({ kind: 'new' })}
        onOpenCatalogue={() => {
          setAllAroundsVisible(false);
          setLibraryVisible(true);
        }}
        onRename={renameLibraryItem}
        onSelect={(itemId) => requestAllAroundSwitch({ itemId, kind: 'existing' })}
        ready={libraryReady && workspaceReady}
        saveStatus={librarySaveStatus}
        visible={allAroundsVisible}
        {...(libraryError === undefined ? {} : { errorMessage: libraryError })}
      />
      <AllAroundSwitchModal
        apparatuses={pendingAllAroundSwitch?.apparatuses ?? []}
        library={library}
        onCancel={() => setPendingAllAroundSwitch(undefined)}
        onDontSave={() => {
          if (pendingAllAroundSwitch !== undefined) {
            completeAllAroundSwitch(pendingAllAroundSwitch.destination, []);
          }
        }}
        onSave={(namedRoutines) => {
          if (pendingAllAroundSwitch !== undefined) {
            completeAllAroundSwitch(pendingAllAroundSwitch.destination, namedRoutines);
          }
        }}
        reservedItemCount={pendingAllAroundSwitch?.destination.kind === 'new' ? 1 : 0}
        visible={pendingAllAroundSwitch !== undefined}
      />
      <RussianLocationModal
        elementName={pendingRussianLocation?.element.name ?? ''}
        mode={pendingRussianLocation?.kind ?? 'add'}
        onCancel={() => setPendingRussianLocation(undefined)}
        onConfirm={confirmRussianLocation}
        options={pommelRules.occurrenceQualifiers.russianLocation.options}
        visible={pendingRussianLocation !== undefined}
        {...(pendingRussianLocation?.kind === 'edit' &&
        pendingRussianLocation.selectedLocation !== undefined
          ? { selectedLocation: pendingRussianLocation.selectedLocation }
          : {})}
      />
      <ConfirmationModal
        confirmLabel="Start blank"
        copy={
          pendingBlankRoutine === undefined
            ? ''
            : `This replaces the current ${pendingBlankRoutine === 'vault' ? 'Vault' : 'event'} work in the active all-around. Saved catalogue copies are not affected.`
        }
        eyebrow="REPLACE CURRENT EVENT"
        onCancel={() => setPendingBlankRoutine(undefined)}
        onConfirm={() => {
          if (pendingBlankRoutine !== undefined) beginBlankRoutine(pendingBlankRoutine);
        }}
        title="Start a blank routine?"
        visible={pendingBlankRoutine !== undefined}
      />
      <ConfirmationModal
        confirmLabel="Load routine"
        copy={
          pendingHomeRoutine === undefined
            ? ''
            : `Loading “${pendingHomeRoutine.name}” replaces the current ${pendingHomeRoutine.apparatus === 'vault' ? 'Vault' : 'event'} work in the active all-around. The saved catalogue copy remains unchanged.`
        }
        eyebrow="REPLACE CURRENT EVENT"
        onCancel={() => setPendingHomeRoutine(undefined)}
        onConfirm={() => {
          if (pendingHomeRoutine === undefined) return;
          loadRoutineItem(pendingHomeRoutine);
          setPendingHomeRoutine(undefined);
        }}
        title="Load this saved routine?"
        visible={pendingHomeRoutine !== undefined}
      />
      <OnboardingModal
        onComplete={completeOnboarding}
        visible={appPreferencesReady && tourVisible}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    activeWorkspace: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
      marginBottom: 20,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    activeWorkspaceCopy: {
      flex: 1,
      minWidth: 0,
    },
    activeWorkspaceEyebrow: {
      color: colors.accent,
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.9,
    },
    activeWorkspaceName: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: '900',
      marginTop: 3,
    },
    autoSaveBadge: {
      alignItems: 'center',
      backgroundColor: colors.successMuted,
      borderRadius: 12,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    autoSaveDot: {
      backgroundColor: colors.success,
      borderRadius: 3,
      height: 6,
      width: 6,
    },
    autoSaveText: {
      color: colors.success,
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    builderColumn: {
      flex: 1.25,
      minWidth: 0,
    },
    libraryButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 5,
      minHeight: 31,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    libraryButtonIcon: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '900',
    },
    libraryButtonText: {
      color: colors.ink,
      fontSize: 9,
      fontWeight: '800',
    },
    libraryCountBadge: {
      alignItems: 'center',
      backgroundColor: colors.accentMuted,
      borderRadius: 8,
      minWidth: 16,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    libraryCountText: {
      color: colors.accentDark,
      fontSize: 7,
      fontWeight: '900',
    },
    mainContent: {
      flex: 1,
      minWidth: 0,
    },
    page: {
      alignSelf: 'center',
      maxWidth: 1420,
      paddingBottom: 40,
      paddingHorizontal: 18,
      paddingTop: 18,
      width: '100%',
    },
    pressed: {
      opacity: 0.68,
    },
    safeArea: {
      backgroundColor: colors.background,
      flex: 1,
    },
    scoreColumn: {
      flex: 0.85,
      minWidth: 0,
    },
    workspace: {
      gap: 14,
      marginTop: 20,
    },
    workspaceActions: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      justifyContent: 'flex-end',
    },
    workspaceWide: {
      alignItems: 'flex-start',
      flexDirection: 'row',
    },
  });
}

function createLibraryItemId(): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId === undefined
    ? `library-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    : `library-${randomId}`;
}

function libraryWithActiveSnapshot(
  library: RoutineLibrary,
  state: WorkbenchState,
  now: string,
): RoutineLibrary {
  const selected =
    activeAllAround(library) ??
    [...allAroundsInLibrary(library)].sort(
      (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    )[0];
  if (selected !== undefined) {
    return {
      activeAllAroundId: selected.id,
      items: library.items.map((item) =>
        item.kind === 'all-around' && item.id === selected.id
          ? { ...item, state: captureAllAroundState(state), updatedAt: now }
          : item,
      ),
    };
  }

  if (library.items.length >= MAX_LIBRARY_ITEMS) return library;
  const item: SavedAllAround = {
    createdAt: now,
    id: createLibraryItemId(),
    kind: 'all-around',
    name: nextUntitledAllAroundName(library),
    state: captureAllAroundState(state),
    updatedAt: now,
  };
  return { activeAllAroundId: item.id, items: [item, ...library.items] };
}

function pruneIneligibleConnections(
  relationships: RelationshipState,
  routines: RoutineState,
): RelationshipState {
  let next = relationships;
  for (const apparatus of Object.keys(routines) as ElementRoutineApparatusId[]) {
    const entryByOccurrenceId = new Map(
      routines[apparatus].map((entry) => [entry.occurrenceId, entry]),
    );
    const kept = relationships[apparatus].filter((relationship) => {
      if (relationship.kind === 'sequence') return true;
      const firstEntry = entryByOccurrenceId.get(relationship.occurrenceIds[0]);
      const secondEntry = entryByOccurrenceId.get(relationship.occurrenceIds[1]);
      const first = firstEntry === undefined ? undefined : elementById.get(firstEntry.elementId);
      const second = secondEntry === undefined ? undefined : elementById.get(secondEntry.elementId);
      return (
        first !== undefined &&
        second !== undefined &&
        isFigConnectionEligible(first, second, figRuleset.apparatusRules[apparatus])
      );
    });
    if (kept.length !== relationships[apparatus].length) {
      next = { ...next, [apparatus]: kept };
    }
  }
  return next;
}
