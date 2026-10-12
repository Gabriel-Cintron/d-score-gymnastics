import type { ApparatusId, ElementId, RoutineRelationship } from '@d-score-gymnastics/scoring';
import type { CompiledElement, CompiledPommelHorseRules } from '@d-score-gymnastics/rulesets';
import { Fragment, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { APPARATUS_LABELS } from '../apparatus';
import { completePommelFlop } from '../flop-builder';
import { formatDifficulty, formatOfficialCode } from '../format';
import {
  requiresRussianLocation,
  russianLocationLabel,
  selectedRussianLocation,
} from '../russian-location';
import { buildRoutineItems } from '../routine-items';
import { radii, useTheme, type ThemeColors } from '../theme';
import type { RoutineEntry } from '../types';
import { DirectConnectionToggle } from './RoutineRelationshipControls';

export const MAX_ROUTINE_ELEMENTS = 8;

interface RoutineBuilderProps {
  readonly apparatus: Exclude<ApparatusId, 'vault'>;
  readonly canConnect: (first: CompiledElement, second: CompiledElement) => boolean;
  readonly difficultyLetterByTenths: ReadonlyMap<number, string>;
  readonly elementById: ReadonlyMap<ElementId, CompiledElement>;
  readonly entries: readonly RoutineEntry[];
  readonly onAdd: () => void;
  readonly onClear: () => void;
  readonly onMove: (index: number, direction: -1 | 1) => void;
  readonly onRemove: (index: number) => void;
  readonly onRussianLocationEdit: (occurrenceId: string) => void;
  readonly onStuckChange: (stuck: boolean) => void;
  readonly onToggleConnection: (firstOccurrenceId: string, secondOccurrenceId: string) => void;
  readonly pommelRules: CompiledPommelHorseRules;
  readonly relationships: readonly RoutineRelationship[];
  readonly stuck: boolean;
}

export function RoutineBuilder({
  apparatus,
  canConnect,
  difficultyLetterByTenths,
  elementById,
  entries,
  onAdd,
  onClear,
  onMove,
  onRemove,
  onRussianLocationEdit,
  onStuckChange,
  onToggleConnection,
  pommelRules,
  relationships,
  stuck,
}: RoutineBuilderProps) {
  const styles = useStyles();
  const items = buildRoutineItems(entries, relationships);
  return (
    <View style={styles.card}>
      <BuilderHeading
        count={`${items.length}/${MAX_ROUTINE_ELEMENTS}`}
        subtitle="Counted skill order"
        title={`${APPARATUS_LABELS[apparatus]} routine`}
        {...(items.length === 0 ? {} : { onClear })}
      />

      <View style={styles.slots}>
        {Array.from({ length: MAX_ROUTINE_ELEMENTS }, (_, index) => {
          const item = items[index];
          if (item === undefined) {
            const canAdd = index === items.length;
            return (
              <Pressable
                accessibilityLabel={canAdd ? `Add element in slot ${index + 1}` : undefined}
                accessibilityRole={canAdd ? 'button' : undefined}
                disabled={!canAdd}
                key={`empty-${index}`}
                onPress={onAdd}
                style={({ pressed }) => [
                  styles.emptySlot,
                  canAdd && styles.addSlot,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.slotNumber}>{index + 1}</Text>
                <Text style={[styles.emptyLabel, canAdd && styles.addLabel]}>
                  {canAdd ? '+ Add element' : 'Empty'}
                </Text>
              </Pressable>
            );
          }

          const firstEntry = item.entries[0];
          const element = elementById.get(firstEntry.elementId);
          if (element === undefined) return null;
          const componentElements = item.entries.flatMap((entry) => {
            const component = elementById.get(entry.elementId);
            return component === undefined ? [] : [component];
          });
          const flop =
            item.sequence === undefined
              ? undefined
              : completePommelFlop(componentElements, pommelRules, difficultyLetterByTenths);
          const isSequence = item.sequence !== undefined;
          const itemName = isSequence ? (flop?.name ?? 'Invalid Pommel sequence') : element.name;
          const needsRussianLocation =
            apparatus === 'pommel-horse' &&
            !isSequence &&
            requiresRussianLocation(element, pommelRules);
          const russianLocation = needsRussianLocation
            ? selectedRussianLocation(firstEntry.qualifiers, pommelRules)
            : undefined;
          const nextItem = items[index + 1];
          const nextEntry = nextItem?.entries[0];
          const nextElement =
            nextEntry === undefined ? undefined : elementById.get(nextEntry.elementId);
          const connectionEligible =
            item.sequence === undefined &&
            nextItem?.sequence === undefined &&
            nextElement !== undefined &&
            canConnect(element, nextElement);
          const connectionActive =
            connectionEligible &&
            nextEntry !== undefined &&
            relationships.some(
              (relationship) =>
                relationship.kind === 'connection' &&
                relationship.occurrenceIds[0] === firstEntry.occurrenceId &&
                relationship.occurrenceIds[1] === nextEntry.occurrenceId,
            );
          return (
            <Fragment key={item.itemId}>
              <View
                style={[
                  styles.filledSlot,
                  flop !== undefined && styles.flopSlot,
                  isSequence && flop === undefined && styles.invalidSequenceSlot,
                ]}
              >
                <View style={[styles.slotIndex, isSequence && styles.flopSlotIndex]}>
                  <Text style={styles.slotIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.elementCopy}>
                  {isSequence ? (
                    <Text style={styles.flopEyebrow}>
                      POMMEL SEQUENCE · {item.entries.length} PARTS
                    </Text>
                  ) : null}
                  <Text numberOfLines={2} style={styles.elementName}>
                    {itemName}
                  </Text>
                  <Text style={styles.elementMetadata}>
                    {isSequence
                      ? flop === undefined
                        ? 'The saved component combination is not valid under this ruleset'
                        : `${flop.difficultyLetter} value · counted as one sequence element`
                      : `${formatOfficialCode(element)} · ${formatDifficulty(element)} value`}
                  </Text>
                  {needsRussianLocation ? (
                    <Pressable
                      accessibilityLabel={`${russianLocation === undefined ? 'Choose' : 'Change'} location for ${itemName}`}
                      accessibilityRole="button"
                      onPress={() => onRussianLocationEdit(firstEntry.occurrenceId)}
                      style={({ pressed }) => [
                        styles.qualifierButton,
                        russianLocation === undefined && styles.qualifierButtonMissing,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.qualifierLabel,
                          russianLocation === undefined && styles.qualifierLabelMissing,
                        ]}
                      >
                        LOCATION
                      </Text>
                      <Text
                        style={[
                          styles.qualifierValue,
                          russianLocation === undefined && styles.qualifierValueMissing,
                        ]}
                      >
                        {russianLocation === undefined
                          ? 'Choose location'
                          : russianLocationLabel(russianLocation)}
                      </Text>
                      <Text style={styles.qualifierChange}>Change</Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.controls}>
                  <MoveButton
                    disabled={index === 0}
                    label="Move earlier"
                    onPress={() => onMove(index, -1)}
                    symbol="↑"
                  />
                  <MoveButton
                    disabled={index === items.length - 1}
                    label="Move later"
                    onPress={() => onMove(index, 1)}
                    symbol="↓"
                  />
                  <Pressable
                    accessibilityLabel={`Remove ${itemName}`}
                    accessibilityRole="button"
                    onPress={() => onRemove(index)}
                    style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.removeText}>×</Text>
                  </Pressable>
                </View>
              </View>
              {connectionEligible && nextEntry !== undefined ? (
                <DirectConnectionToggle
                  active={connectionActive}
                  firstSlot={index + 1}
                  onToggle={() =>
                    onToggleConnection(firstEntry.occurrenceId, nextEntry.occurrenceId)
                  }
                  secondSlot={index + 2}
                />
              ) : null}
            </Fragment>
          );
        })}
      </View>

      <LandingToggle disabled={items.length === 0} onChange={onStuckChange} stuck={stuck} />

      <View style={styles.previewNote}>
        <Text style={styles.previewNoteMark}>i</Text>
        <Text style={styles.previewNoteText}>
          {apparatus === 'pommel-horse'
            ? 'Enter counted skills only. The scorer warns when an omitted circle must separate Pommel sequences in the performed routine.'
            : 'Only connection claims that the current ruleset can credit are shown between routine elements.'}
        </Text>
      </View>
    </View>
  );
}

interface VaultBuilderProps {
  readonly onChoose: () => void;
  readonly onClear: () => void;
  readonly onStuckChange: (stuck: boolean) => void;
  readonly stuck: boolean;
  readonly vault?: CompiledElement;
}

export function VaultBuilder({
  onChoose,
  onClear,
  onStuckChange,
  stuck,
  vault,
}: VaultBuilderProps) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <BuilderHeading
        count={vault === undefined ? '0/1' : '1/1'}
        subtitle="Listed value"
        title="Vault selection"
        {...(vault === undefined ? {} : { onClear })}
      />

      {vault === undefined ? (
        <Pressable
          accessibilityLabel="Choose a Vault"
          accessibilityRole="button"
          onPress={onChoose}
          style={({ pressed }) => [styles.vaultEmpty, pressed && styles.pressed]}
        >
          <Text style={styles.vaultAddMark}>+</Text>
          <Text style={styles.vaultEmptyTitle}>Choose a Vault</Text>
          <Text style={styles.vaultEmptyCopy}>Search the complete FIG table</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityHint="Opens the Vault catalog"
          accessibilityLabel={`Change ${vault.name}`}
          accessibilityRole="button"
          onPress={onChoose}
          style={({ pressed }) => [styles.vaultSelected, pressed && styles.pressed]}
        >
          <View style={styles.vaultValueBadge}>
            <Text style={styles.vaultValue}>{formatDifficulty(vault)}</Text>
          </View>
          <View style={styles.elementCopy}>
            <Text style={styles.elementName}>{vault.name}</Text>
            <Text style={styles.elementMetadata}>{formatOfficialCode(vault)} · Tap to change</Text>
          </View>
        </Pressable>
      )}

      <LandingToggle disabled={vault === undefined} onChange={onStuckChange} stuck={stuck} />
    </View>
  );
}

function BuilderHeading({
  count,
  onClear,
  subtitle,
  title,
}: {
  readonly count: string;
  readonly onClear?: () => void;
  readonly subtitle: string;
  readonly title: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.heading}>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.headingActions}>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
        {onClear === undefined ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={onClear}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function MoveButton({
  disabled,
  label,
  onPress,
  symbol,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly symbol: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.moveButton,
        disabled && styles.disabledButton,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.moveText, disabled && styles.disabledText]}>{symbol}</Text>
    </Pressable>
  );
}

function LandingToggle({
  disabled,
  onChange,
  stuck,
}: {
  readonly disabled: boolean;
  readonly onChange: (stuck: boolean) => void;
  readonly stuck: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityLabel="Stuck landing"
      accessibilityRole="switch"
      aria-checked={stuck}
      accessibilityState={{ checked: stuck, disabled }}
      disabled={disabled}
      onPress={() => onChange(!stuck)}
      style={({ pressed }) => [
        styles.landingRow,
        disabled && styles.disabledRow,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.landingCopy}>
        <Text style={styles.landingTitle}>Stuck landing</Text>
        <Text style={styles.landingSubtitle}>Apply the FIG landing bonus when eligible</Text>
      </View>
      <View style={[styles.switchTrack, stuck && styles.switchTrackActive]}>
        <View style={[styles.switchThumb, stuck && styles.switchThumbActive]} />
      </View>
    </Pressable>
  );
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    addLabel: {
      color: colors.accent,
      fontWeight: '700',
    },
    addSlot: {
      backgroundColor: colors.accentMuted,
      borderColor: colors.accent,
      borderStyle: 'solid',
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.large,
      borderWidth: 1,
      padding: 18,
    },
    clearButton: {
      paddingHorizontal: 5,
      paddingVertical: 7,
    },
    clearText: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '700',
    },
    controls: {
      flexDirection: 'row',
      gap: 5,
    },
    countBadge: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    countText: {
      color: colors.ink,
      fontSize: 11,
      fontWeight: '800',
    },
    disabledButton: {
      backgroundColor: colors.surfaceMuted,
    },
    disabledRow: {
      opacity: 0.48,
    },
    disabledText: {
      color: colors.border,
    },
    elementCopy: {
      flex: 1,
    },
    elementMetadata: {
      color: colors.muted,
      fontSize: 11,
      marginTop: 4,
    },
    elementName: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 19,
    },
    emptyLabel: {
      color: colors.muted,
      flex: 1,
      fontSize: 13,
    },
    emptySlot: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderStyle: 'dashed',
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 52,
      paddingHorizontal: 13,
    },
    filledSlot: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 11,
      minHeight: 68,
      padding: 10,
    },
    flopEyebrow: {
      color: colors.accent,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.7,
      marginBottom: 3,
    },
    flopSlot: {
      backgroundColor: colors.accentMuted,
      borderColor: colors.accent,
    },
    flopSlotIndex: {
      backgroundColor: colors.accent,
    },
    heading: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    headingActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    invalidSequenceSlot: {
      backgroundColor: colors.warningMuted,
      borderColor: colors.warning,
    },
    landingCopy: {
      flex: 1,
    },
    landingRow: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.medium,
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      marginTop: 14,
      padding: 13,
    },
    landingSubtitle: {
      color: colors.muted,
      fontSize: 11,
      marginTop: 3,
    },
    landingTitle: {
      color: colors.ink,
      fontSize: 13,
      fontWeight: '700',
    },
    moveButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 8,
      height: 30,
      justifyContent: 'center',
      width: 30,
    },
    moveText: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.65,
    },
    previewNote: {
      alignItems: 'flex-start',
      backgroundColor: colors.warningMuted,
      borderRadius: radii.small,
      flexDirection: 'row',
      gap: 9,
      marginTop: 12,
      padding: 11,
    },
    previewNoteMark: {
      color: colors.warning,
      fontSize: 12,
      fontWeight: '900',
    },
    previewNoteText: {
      color: colors.warning,
      flex: 1,
      fontSize: 11,
      lineHeight: 16,
    },
    qualifierButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.accentMuted,
      borderColor: colors.accent,
      borderRadius: 7,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      marginTop: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    qualifierButtonMissing: {
      backgroundColor: colors.warningMuted,
      borderColor: colors.warning,
    },
    qualifierChange: {
      color: colors.muted,
      fontSize: 9,
      fontWeight: '700',
    },
    qualifierLabel: {
      color: colors.accentDark,
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.7,
    },
    qualifierLabelMissing: {
      color: colors.warning,
    },
    qualifierValue: {
      color: colors.ink,
      fontSize: 10,
      fontWeight: '800',
    },
    qualifierValueMissing: {
      color: colors.warning,
    },
    removeButton: {
      alignItems: 'center',
      backgroundColor: colors.dangerMuted,
      borderRadius: 8,
      height: 30,
      justifyContent: 'center',
      width: 30,
    },
    removeText: {
      color: colors.danger,
      fontSize: 20,
      lineHeight: 21,
    },
    slotIndex: {
      alignItems: 'center',
      backgroundColor: colors.navy,
      borderRadius: 18,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    slotIndexText: {
      color: colors.surface,
      fontSize: 12,
      fontWeight: '800',
    },
    slotNumber: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '800',
      width: 18,
    },
    slots: {
      gap: 8,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 4,
    },
    switchThumb: {
      backgroundColor: colors.surface,
      borderRadius: 9,
      height: 18,
      width: 18,
    },
    switchThumbActive: {
      transform: [{ translateX: 18 }],
    },
    switchTrack: {
      backgroundColor: colors.border,
      borderRadius: 12,
      padding: 3,
      width: 42,
    },
    switchTrackActive: {
      backgroundColor: colors.accent,
    },
    title: {
      color: colors.navy,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    vaultAddMark: {
      color: colors.accent,
      fontSize: 28,
      fontWeight: '300',
    },
    vaultEmpty: {
      alignItems: 'center',
      backgroundColor: colors.accentMuted,
      borderColor: colors.accent,
      borderRadius: radii.medium,
      borderStyle: 'dashed',
      borderWidth: 1,
      minHeight: 180,
      justifyContent: 'center',
      padding: 24,
    },
    vaultEmptyCopy: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 4,
    },
    vaultEmptyTitle: {
      color: colors.accentDark,
      fontSize: 16,
      fontWeight: '800',
    },
    vaultSelected: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 14,
      minHeight: 112,
      padding: 16,
    },
    vaultValue: {
      color: colors.surface,
      fontSize: 18,
      fontWeight: '900',
    },
    vaultValueBadge: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 27,
      height: 54,
      justifyContent: 'center',
      width: 54,
    },
  });
}
