import { APPARATUS_IDS, type ApparatusId } from '@d-score-gymnastics/scoring';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { APPARATUS_LABELS, APPARATUS_SHORT_LABELS } from '../apparatus';
import {
  allAroundsInLibrary,
  apparatusHasWork,
  routinesInCatalogue,
  type RoutineLibrary,
  type SavedAllAround,
  type SavedRoutine,
} from '../routine-library';
import { buildRoutineItems } from '../routine-items';
import { radii, useTheme, type ThemeColors } from '../theme';
import type { WorkbenchState } from '../types';
import type { WorkspaceSaveStatus } from './AllAroundSidebar';

const APPARATUS_PAIRS: readonly (readonly ApparatusId[])[] = Array.from(
  { length: Math.ceil(APPARATUS_IDS.length / 2) },
  (_, index) => APPARATUS_IDS.slice(index * 2, index * 2 + 2),
);

interface HomeScreenProps {
  readonly currentState: WorkbenchState;
  readonly errorMessage?: string;
  readonly library: RoutineLibrary;
  readonly onContinue: () => void;
  readonly onManageAllArounds: () => void;
  readonly onNewAllAround: () => void;
  readonly onOpenAllAround: (item: SavedAllAround) => void;
  readonly onOpenCatalogue: () => void;
  readonly onOpenRoutine: (item: SavedRoutine) => void;
  readonly onOpenTour: () => void;
  readonly onStartRoutine: (apparatus: ApparatusId) => void;
  readonly ready: boolean;
  readonly saveStatus: WorkspaceSaveStatus;
}

export function HomeScreen({
  currentState,
  errorMessage,
  library,
  onContinue,
  onManageAllArounds,
  onNewAllAround,
  onOpenAllAround,
  onOpenCatalogue,
  onOpenRoutine,
  onOpenTour,
  onStartRoutine,
  ready,
  saveStatus,
}: HomeScreenProps) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const wide = width >= 860;
  const allArounds = useMemo(() => sortRecentlyUpdated(allAroundsInLibrary(library)), [library]);
  const routines = useMemo(() => sortRecentlyUpdated(routinesInCatalogue(library)), [library]);
  const active = allArounds.find((item) => item.id === library.activeAllAroundId);
  const recentAllArounds = allArounds.filter((item) => item.id !== active?.id).slice(0, 3);
  const recentRoutines = routines.slice(0, 4);
  const startedEvents = countStartedEvents(currentState);

  return (
    <View>
      <View style={[styles.hero, wide && styles.heroWide]}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>MEN'S ARTISTIC ROUTINE PLANNING</Text>
          <Text style={styles.heroTitle}>Build routines.{wide ? '\n' : ' '}Know the score.</Text>
          <Text style={styles.heroText}>
            Plan every event, understand every counting decision, and keep your routines together on
            this device.
          </Text>
        </View>
        <View style={styles.heroScore}>
          <Text style={styles.heroScoreMark}>D</Text>
          <Text style={styles.heroScoreLabel}>DIFFICULTY, EXPLAINED</Text>
        </View>
      </View>

      {errorMessage === undefined ? null : (
        <Text accessibilityRole="alert" style={styles.errorBanner}>
          {errorMessage}
        </Text>
      )}

      <View style={[styles.dashboard, wide && styles.dashboardWide]}>
        <View style={[styles.primaryColumn, wide && styles.primaryColumnWide]}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionEyebrow}>YOUR WORKSPACE</Text>
              <Text style={styles.sectionTitle}>Continue where you left off</Text>
            </View>
            <StatusPill status={saveStatus} />
          </View>

          <View style={styles.continueCard} testID="continue-workspace-card">
            <View style={styles.continueTop}>
              <View style={styles.continueIcon}>
                <Text style={styles.continueIconText}>AA</Text>
              </View>
              <View style={styles.continueCopy}>
                <Text style={styles.continueLabel}>ACTIVE ALL-AROUND</Text>
                <Text numberOfLines={1} style={styles.continueName}>
                  {active?.name ?? (ready ? 'Untitled All-Around' : 'Opening your workspace…')}
                </Text>
                <Text style={styles.continueMeta}>
                  {startedEvents}/6 events started · {saveStatusCopy(saveStatus)}
                </Text>
              </View>
            </View>
            <View style={styles.eventProgress}>
              {APPARATUS_IDS.map((apparatus) => {
                const complete = apparatusHasWork(currentState, apparatus);
                return (
                  <View key={apparatus} style={styles.progressItem}>
                    <View style={[styles.progressDot, complete && styles.progressDotComplete]} />
                    <Text style={[styles.progressText, complete && styles.progressTextComplete]}>
                      {APPARATUS_SHORT_LABELS[apparatus]}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={!ready}
              onPress={onContinue}
              style={({ pressed }) => [
                styles.continueButton,
                !ready && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.continueButtonText}>Continue editing</Text>
              <Text style={styles.continueArrow}>→</Text>
            </Pressable>
          </View>

          <View style={styles.quickActions}>
            <HomeAction
              copy="Start a clean six-event workspace"
              disabled={!ready}
              icon="＋"
              label="New all-around"
              onPress={onNewAllAround}
            />
            <HomeAction
              copy="Browse and reuse saved events"
              icon="▤"
              label="Routine catalogue"
              onPress={onOpenCatalogue}
            />
            <HomeAction
              copy="Review the three-step introduction"
              icon="?"
              label="Quick tour"
              onPress={onOpenTour}
            />
          </View>

          <View style={styles.sectionHeadingCompact}>
            <View>
              <Text style={styles.sectionEyebrow}>QUICK START</Text>
              <Text style={styles.sectionTitle}>Start an individual routine</Text>
            </View>
          </View>
          <View style={styles.apparatusGrid} testID="quick-start-grid">
            {APPARATUS_PAIRS.map((pair) => (
              <View key={pair.join(':')} style={styles.apparatusRow}>
                {pair.map((apparatus) => (
                  <Pressable
                    accessibilityLabel={`Start a new ${APPARATUS_LABELS[apparatus]} routine`}
                    accessibilityRole="button"
                    disabled={!ready}
                    key={apparatus}
                    onPress={() => onStartRoutine(apparatus)}
                    style={({ pressed }) => [
                      styles.apparatusButton,
                      !ready && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text aria-hidden style={styles.apparatusShort}>
                      {APPARATUS_SHORT_LABELS[apparatus]}
                    </Text>
                    <Text numberOfLines={1} style={styles.apparatusName}>
                      {APPARATUS_LABELS[apparatus]}
                    </Text>
                    <Text aria-hidden style={styles.apparatusArrow}>
                      →
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View
          style={[styles.secondaryColumn, wide && styles.secondaryColumnWide]}
          testID="recent-work-column"
        >
          <LibrarySection
            emptyCopy="Create another all-around to see it here."
            items={recentAllArounds}
            onManage={onManageAllArounds}
            onOpen={onOpenAllAround}
            title="Recent all-arounds"
          />
          <RoutineSection
            items={recentRoutines}
            onManage={onOpenCatalogue}
            onOpen={onOpenRoutine}
          />
          <View style={styles.localCard}>
            <View style={styles.localIcon}>
              <Text style={styles.localIconText}>⌂</Text>
            </View>
            <View style={styles.localCopy}>
              <Text style={styles.localTitle}>Private and local</Text>
              <Text style={styles.localText}>
                No account is required. Create a backup from Settings before clearing site data or
                moving devices.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export function countStartedEvents(state: WorkbenchState): number {
  return APPARATUS_IDS.filter((apparatus) => apparatusHasWork(state, apparatus)).length;
}

function HomeAction({
  copy,
  disabled = false,
  icon,
  label,
  onPress,
}: {
  readonly copy: string;
  readonly disabled?: boolean;
  readonly icon: string;
  readonly label: string;
  readonly onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.actionIcon}>
        <Text style={styles.actionIconText}>{icon}</Text>
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{label}</Text>
        <Text style={styles.actionText}>{copy}</Text>
      </View>
    </Pressable>
  );
}

function LibrarySection({
  emptyCopy,
  items,
  onManage,
  onOpen,
  title,
}: {
  readonly emptyCopy: string;
  readonly items: readonly SavedAllAround[];
  readonly onManage: () => void;
  readonly onOpen: (item: SavedAllAround) => void;
  readonly title: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.libraryCard}>
      <View style={styles.libraryHeading}>
        <Text style={styles.libraryTitle}>{title}</Text>
        <Pressable accessibilityRole="button" onPress={onManage}>
          <Text style={styles.manageText}>Manage</Text>
        </Pressable>
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>{emptyCopy}</Text>
      ) : (
        items.map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item.id}
            onPress={() => onOpen(item)}
            style={({ pressed }) => [styles.libraryItem, pressed && styles.pressed]}
          >
            <View style={styles.itemMark}>
              <Text style={styles.itemMarkText}>AA</Text>
            </View>
            <View style={styles.itemCopy}>
              <Text numberOfLines={1} style={styles.itemName}>
                {item.name}
              </Text>
              <Text style={styles.itemMeta}>
                {countStartedEvents(item.state)}/6 events · {formatDate(item.updatedAt)}
              </Text>
            </View>
            <Text style={styles.itemArrow}>›</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

function RoutineSection({
  items,
  onManage,
  onOpen,
}: {
  readonly items: readonly SavedRoutine[];
  readonly onManage: () => void;
  readonly onOpen: (item: SavedRoutine) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.libraryCard}>
      <View style={styles.libraryHeading}>
        <Text style={styles.libraryTitle}>Saved routines</Text>
        <Pressable accessibilityRole="button" onPress={onManage}>
          <Text style={styles.manageText}>View all</Text>
        </Pressable>
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>Saved event routines will appear here for quick reuse.</Text>
      ) : (
        items.map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item.id}
            onPress={() => onOpen(item)}
            style={({ pressed }) => [styles.libraryItem, pressed && styles.pressed]}
          >
            <View style={styles.itemMark}>
              <Text style={styles.itemMarkText}>{APPARATUS_SHORT_LABELS[item.apparatus]}</Text>
            </View>
            <View style={styles.itemCopy}>
              <Text numberOfLines={1} style={styles.itemName}>
                {item.name}
              </Text>
              <Text style={styles.itemMeta}>
                {routineSkillCount(item)} skills · {formatDate(item.updatedAt)}
              </Text>
            </View>
            <Text style={styles.itemArrow}>›</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

function StatusPill({ status }: { readonly status: WorkspaceSaveStatus }) {
  const styles = useStyles();
  return (
    <View style={[styles.statusPill, status === 'error' && styles.statusPillError]}>
      <View style={[styles.statusDot, status === 'error' && styles.statusDotError]} />
      <Text style={[styles.statusText, status === 'error' && styles.statusTextError]}>
        {status === 'saving'
          ? 'SAVING'
          : status === 'loading'
            ? 'OPENING'
            : status === 'error'
              ? 'SAVE ERROR'
              : 'AUTOSAVED'}
      </Text>
    </View>
  );
}

function routineSkillCount(item: SavedRoutine): number {
  if (item.apparatus === 'vault') return item.state.vaultId === undefined ? 0 : 1;
  return buildRoutineItems(
    item.state.routines[item.apparatus],
    item.state.relationships[item.apparatus],
  ).length;
}

function sortRecentlyUpdated<T extends { readonly updatedAt: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
    : 'Recently';
}

function saveStatusCopy(status: WorkspaceSaveStatus): string {
  switch (status) {
    case 'error':
      return 'local save needs attention';
    case 'loading':
      return 'opening local data';
    case 'saving':
      return 'saving locally';
    case 'saved':
      return 'saved locally';
  }
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actionCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      flexBasis: 180,
      flexDirection: 'row',
      flexGrow: 1,
      gap: 10,
      minHeight: 72,
      padding: 12,
    },
    actionCopy: { flex: 1 },
    actionIcon: {
      alignItems: 'center',
      backgroundColor: colors.accentMuted,
      borderRadius: 10,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    actionIconText: { color: colors.accentDark, fontSize: 16, fontWeight: '900' },
    actionText: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
    actionTitle: { color: colors.ink, fontSize: 11, fontWeight: '900' },
    apparatusArrow: { color: colors.accent, fontSize: 13, fontWeight: '900', marginLeft: 'auto' },
    apparatusButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 11,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: 9,
      minHeight: 52,
      minWidth: 0,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    apparatusGrid: { gap: 8, width: '100%' },
    apparatusName: { color: colors.ink, flex: 1, fontSize: 10, fontWeight: '800' },
    apparatusRow: { flexDirection: 'row', gap: 8, width: '100%' },
    apparatusShort: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: '900',
      minWidth: 22,
    },
    continueArrow: { color: colors.onAccentMuted, fontSize: 15, fontWeight: '900' },
    continueButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 11,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 18,
      minHeight: 46,
      paddingHorizontal: 15,
    },
    continueButtonText: { color: colors.onAccentMuted, fontSize: 11, fontWeight: '900' },
    continueCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.large,
      borderWidth: 1,
      marginTop: 13,
      padding: 18,
    },
    continueCopy: { flex: 1, minWidth: 0 },
    continueIcon: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 12,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    continueIconText: { color: colors.onAccentMuted, fontSize: 11, fontWeight: '900' },
    continueLabel: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
    continueMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
    continueName: { color: colors.navy, fontSize: 20, fontWeight: '900', marginTop: 2 },
    continueTop: { alignItems: 'center', flexDirection: 'row', gap: 12 },
    dashboard: { gap: 18, width: '100%' },
    dashboardWide: { alignItems: 'flex-start', flexDirection: 'row' },
    disabled: { opacity: 0.45 },
    emptyText: { color: colors.muted, fontSize: 10, lineHeight: 16, paddingVertical: 12 },
    errorBanner: {
      backgroundColor: colors.dangerMuted,
      borderRadius: radii.small,
      color: colors.danger,
      fontSize: 10,
      fontWeight: '700',
      marginBottom: 14,
      padding: 11,
    },
    eventProgress: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginTop: 18 },
    eyebrow: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.35 },
    hero: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: 22,
      marginBottom: 20,
      overflow: 'hidden',
      padding: 24,
    },
    heroCopy: { flex: 1 },
    heroScore: {
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: colors.accentMuted,
      borderRadius: 18,
      justifyContent: 'center',
      minHeight: 150,
      minWidth: 210,
      padding: 20,
    },
    heroScoreLabel: { color: colors.accentDark, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
    heroScoreMark: { color: colors.accent, fontSize: 62, fontWeight: '900', lineHeight: 68 },
    heroText: { color: colors.muted, fontSize: 13, lineHeight: 21, marginTop: 12, maxWidth: 620 },
    heroTitle: {
      color: colors.navy,
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: -1.2,
      lineHeight: 38,
      marginTop: 7,
    },
    heroWide: { alignItems: 'stretch', flexDirection: 'row' },
    itemArrow: { color: colors.muted, fontSize: 20, fontWeight: '300' },
    itemCopy: { flex: 1, minWidth: 0 },
    itemMark: {
      alignItems: 'center',
      backgroundColor: colors.accentMuted,
      borderRadius: 9,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    itemMarkText: { color: colors.accentDark, fontSize: 8, fontWeight: '900' },
    itemMeta: { color: colors.muted, fontSize: 8, marginTop: 2 },
    itemName: { color: colors.ink, fontSize: 11, fontWeight: '800' },
    libraryCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      padding: 14,
    },
    libraryHeading: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 5,
    },
    libraryItem: {
      alignItems: 'center',
      borderTopColor: colors.border,
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: 9,
      minHeight: 55,
      paddingVertical: 8,
    },
    libraryTitle: { color: colors.navy, fontSize: 13, fontWeight: '900' },
    localCard: {
      alignItems: 'flex-start',
      backgroundColor: colors.accentMuted,
      borderRadius: radii.medium,
      flexDirection: 'row',
      gap: 11,
      padding: 14,
    },
    localCopy: { flex: 1 },
    localIcon: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 9,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    localIconText: { color: colors.onAccentMuted, fontSize: 14, fontWeight: '900' },
    localText: { color: colors.accentDark, fontSize: 9, lineHeight: 14, marginTop: 3 },
    localTitle: { color: colors.accentDark, fontSize: 11, fontWeight: '900' },
    manageText: { color: colors.accent, fontSize: 9, fontWeight: '800' },
    pressed: { opacity: 0.68 },
    primaryColumn: { minWidth: 0, width: '100%' },
    primaryColumnWide: { flex: 1.65, width: 'auto' },
    progressDot: { backgroundColor: colors.border, borderRadius: 3, height: 6, width: 6 },
    progressDotComplete: { backgroundColor: colors.success },
    progressItem: { alignItems: 'center', flexDirection: 'row', gap: 5 },
    progressText: { color: colors.muted, fontSize: 8, fontWeight: '800' },
    progressTextComplete: { color: colors.ink },
    quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    secondaryColumn: { gap: 12, minWidth: 0, width: '100%' },
    secondaryColumnWide: { flex: 1, width: 'auto' },
    sectionEyebrow: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
    sectionHeading: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'space-between',
      paddingHorizontal: 2,
    },
    sectionHeadingCompact: { marginBottom: 10, marginTop: 24, paddingHorizontal: 2 },
    sectionTitle: { color: colors.navy, fontSize: 18, fontWeight: '900', marginTop: 2 },
    statusDot: { backgroundColor: colors.success, borderRadius: 3, height: 6, width: 6 },
    statusDotError: { backgroundColor: colors.danger },
    statusPill: {
      alignItems: 'center',
      backgroundColor: colors.successMuted,
      borderRadius: 12,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    statusPillError: { backgroundColor: colors.dangerMuted },
    statusText: { color: colors.success, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
    statusTextError: { color: colors.danger },
  });
}
