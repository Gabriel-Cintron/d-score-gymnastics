import { APPARATUS_IDS, type ApparatusId } from '@d-score-gymnastics/scoring';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { APPARATUS_LABELS, APPARATUS_SHORT_LABELS } from '../apparatus';
import { radii, useTheme, type ThemeColors } from '../theme';

interface ApparatusSelectorProps {
  readonly onChange: (apparatus: ApparatusId) => void;
  readonly selected: ApparatusId;
}

export function ApparatusSelector({ onChange, selected }: ApparatusSelectorProps) {
  const styles = useStyles();
  return (
    <View>
      <Text style={styles.eyebrow}>APPARATUS</Text>
      <ScrollView
        contentContainerStyle={styles.row}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {APPARATUS_IDS.map((apparatus) => {
          const isSelected = apparatus === selected;
          return (
            <Pressable
              accessibilityLabel={`Select ${APPARATUS_LABELS[apparatus]}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={apparatus}
              onPress={() => onChange(apparatus)}
              style={({ pressed }) => [
                styles.tab,
                isSelected && styles.selectedTab,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.shortLabel, isSelected && styles.selectedText]}>
                {APPARATUS_SHORT_LABELS[apparatus]}
              </Text>
              <Text style={[styles.label, isSelected && styles.selectedText]}>
                {APPARATUS_LABELS[apparatus]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    eyebrow: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.1,
      marginBottom: 10,
    },
    label: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.72,
    },
    row: {
      gap: 8,
      paddingBottom: 2,
    },
    selectedTab: {
      backgroundColor: colors.navy,
      borderColor: colors.navy,
    },
    selectedText: {
      color: colors.surface,
    },
    shortLabel: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '800',
    },
    tab: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      gap: 2,
      minWidth: 112,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
  });
}
