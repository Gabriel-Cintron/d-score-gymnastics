import type { ApparatusId } from '@d-score-gymnastics/scoring';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { radii, useTheme, type ThemeColors } from '../theme';
import { DifficultyRangeSlider } from './DifficultyRangeSlider';

export interface DifficultyFilterOption {
  readonly label: string;
  readonly value: number;
}

interface CatalogFilterControlsProps {
  readonly apparatus: ApparatusId;
  readonly difficultyOptions: readonly DifficultyFilterOption[];
  readonly elementGroup: number | undefined;
  readonly groups: readonly number[];
  readonly maximumDifficulty: number | undefined;
  readonly minimumDifficulty: number | undefined;
  readonly onClear: () => void;
  readonly onElementGroupChange: (group: number | undefined) => void;
  readonly onMaximumDifficultyChange: (difficulty: number | undefined) => void;
  readonly onMinimumDifficultyChange: (difficulty: number | undefined) => void;
  readonly onSelectExactDifficulty: (difficulty: number | undefined) => void;
}

type OpenBoundary = 'maximum' | 'minimum';

export function CatalogFilterControls({
  apparatus,
  difficultyOptions,
  elementGroup,
  groups,
  maximumDifficulty,
  minimumDifficulty,
  onClear,
  onElementGroupChange,
  onMaximumDifficultyChange,
  onMinimumDifficultyChange,
  onSelectExactDifficulty,
}: CatalogFilterControlsProps) {
  const styles = useStyles();
  const [openBoundary, setOpenBoundary] = useState<OpenBoundary>();
  const hasFilters =
    minimumDifficulty !== undefined ||
    maximumDifficulty !== undefined ||
    elementGroup !== undefined;
  const exactDifficulty =
    minimumDifficulty !== undefined && minimumDifficulty === maximumDifficulty
      ? minimumDifficulty
      : undefined;
  const availableMinimumDifficulty = difficultyOptions[0]?.value;
  const availableMaximumDifficulty = difficultyOptions.at(-1)?.value;

  function selectBoundary(value: number | undefined): void {
    if (openBoundary === 'minimum') onMinimumDifficultyChange(value);
    if (openBoundary === 'maximum') onMaximumDifficultyChange(value);
    setOpenBoundary(undefined);
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterHeading}>
        <Text style={styles.filterTitle}>FILTERS</Text>
        {hasFilters ? (
          <Pressable
            accessibilityLabel="Clear catalog filters"
            accessibilityRole="button"
            onPress={() => {
              onClear();
              setOpenBoundary(undefined);
            }}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          >
            <Text style={styles.clearText}>Clear all</Text>
          </Pressable>
        ) : null}
      </View>

      {apparatus === 'vault' ? null : (
        <>
          <Text style={styles.label}>EXACT DIFFICULTY</Text>
          <ScrollView
            contentContainerStyle={styles.chipRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <FilterChip
              label="All"
              onPress={() => {
                onSelectExactDifficulty(undefined);
                setOpenBoundary(undefined);
              }}
              selected={minimumDifficulty === undefined && maximumDifficulty === undefined}
            />
            {difficultyOptions.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                onPress={() => {
                  onSelectExactDifficulty(option.value);
                  setOpenBoundary(undefined);
                }}
                selected={exactDifficulty === option.value}
              />
            ))}
          </ScrollView>
        </>
      )}

      <Text style={styles.label}>DIFFICULTY RANGE</Text>
      {apparatus === 'vault' &&
      availableMinimumDifficulty !== undefined &&
      availableMaximumDifficulty !== undefined ? (
        <DifficultyRangeSlider
          lowerValue={minimumDifficulty ?? availableMinimumDifficulty}
          maximum={availableMaximumDifficulty}
          minimum={availableMinimumDifficulty}
          onLowerValueChange={(value) =>
            onMinimumDifficultyChange(value === availableMinimumDifficulty ? undefined : value)
          }
          onUpperValueChange={(value) =>
            onMaximumDifficultyChange(value === availableMaximumDifficulty ? undefined : value)
          }
          upperValue={maximumDifficulty ?? availableMaximumDifficulty}
        />
      ) : (
        <View style={styles.rangeRow}>
          <BoundaryButton
            label="From"
            onPress={() =>
              setOpenBoundary((current) => (current === 'minimum' ? undefined : 'minimum'))
            }
            open={openBoundary === 'minimum'}
            value={difficultyLabel(minimumDifficulty, difficultyOptions)}
          />
          <Text style={styles.rangeSeparator}>to</Text>
          <BoundaryButton
            label="To"
            onPress={() =>
              setOpenBoundary((current) => (current === 'maximum' ? undefined : 'maximum'))
            }
            open={openBoundary === 'maximum'}
            value={difficultyLabel(maximumDifficulty, difficultyOptions)}
          />
        </View>
      )}

      {apparatus === 'vault' || openBoundary === undefined ? null : (
        <ScrollView
          contentContainerStyle={styles.boundaryOptions}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <FilterChip label="Any" onPress={() => selectBoundary(undefined)} selected={false} />
          {difficultyOptions.map((option) => (
            <FilterChip
              key={`${openBoundary}-${option.value}`}
              label={option.label}
              onPress={() => selectBoundary(option.value)}
              selected={
                openBoundary === 'minimum'
                  ? minimumDifficulty === option.value
                  : maximumDifficulty === option.value
              }
            />
          ))}
        </ScrollView>
      )}

      <Text style={styles.label}>{apparatus === 'vault' ? 'VAULT GROUP' : 'ELEMENT GROUP'}</Text>
      <ScrollView
        contentContainerStyle={styles.chipRow}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <FilterChip
          label="All"
          onPress={() => onElementGroupChange(undefined)}
          selected={elementGroup === undefined}
        />
        {groups.map((group) => (
          <FilterChip
            key={group}
            label={`${apparatus === 'vault' ? 'Group' : 'EG'} ${romanNumeral(group)}`}
            onPress={() => onElementGroupChange(group)}
            selected={elementGroup === group}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function BoundaryButton({
  label,
  onPress,
  open,
  value,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly open: boolean;
  readonly value: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityLabel={`${label} difficulty: ${value}`}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.boundaryButton,
        open && styles.boundaryButtonOpen,
        pressed && styles.pressed,
      ]}
    >
      <View>
        <Text style={styles.boundaryLabel}>{label}</Text>
        <Text style={styles.boundaryValue}>{value}</Text>
      </View>
      <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  onPress,
  selected,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly selected: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selectedChip,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.selectedChipText]}>{label}</Text>
    </Pressable>
  );
}

function difficultyLabel(
  difficulty: number | undefined,
  options: readonly DifficultyFilterOption[],
): string {
  if (difficulty === undefined) return 'Any';
  return options.find((option) => option.value === difficulty)?.label ?? String(difficulty / 10);
}

function romanNumeral(value: number): string {
  return ['I', 'II', 'III', 'IV', 'V'][value - 1] ?? String(value);
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    boundaryButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.small,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    boundaryButtonOpen: {
      backgroundColor: colors.accentMuted,
      borderColor: colors.accent,
    },
    boundaryLabel: {
      color: colors.muted,
      fontSize: 9,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    boundaryOptions: {
      gap: 6,
      paddingBottom: 2,
      paddingTop: 8,
    },
    boundaryValue: {
      color: colors.ink,
      fontSize: 13,
      fontWeight: '800',
      marginTop: 1,
    },
    chevron: {
      color: colors.muted,
      fontSize: 14,
    },
    chip: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 34,
      minWidth: 42,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    chipRow: {
      gap: 6,
      paddingBottom: 2,
    },
    chipText: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
    },
    clearButton: {
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    clearText: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: '800',
    },
    container: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      marginTop: 12,
      padding: 11,
    },
    filterHeading: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    filterTitle: {
      color: colors.ink,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    label: {
      color: colors.muted,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: 6,
      marginTop: 10,
    },
    pressed: {
      opacity: 0.66,
    },
    rangeRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    rangeSeparator: {
      color: colors.muted,
      fontSize: 10,
    },
    selectedChip: {
      backgroundColor: colors.navy,
      borderColor: colors.navy,
    },
    selectedChipText: {
      color: colors.surface,
    },
  });
}
