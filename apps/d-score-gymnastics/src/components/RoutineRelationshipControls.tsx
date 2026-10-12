import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, type ThemeColors } from '../theme';

export function DirectConnectionToggle({
  active,
  firstSlot,
  onToggle,
  secondSlot,
}: {
  readonly active: boolean;
  readonly firstSlot: number;
  readonly onToggle: () => void;
  readonly secondSlot: number;
}) {
  const styles = useStyles();
  return (
    <View style={styles.connectionGap}>
      <View style={[styles.connectionLine, active && styles.connectionLineActive]} />
      <Pressable
        accessibilityLabel={`${active ? 'Remove' : 'Add'} direct connection between slots ${firstSlot} and ${secondSlot}`}
        accessibilityRole="switch"
        aria-checked={active}
        accessibilityState={{ checked: active }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.connectionButton,
          active && styles.connectionButtonActive,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.connectionButtonText, active && styles.connectionButtonTextActive]}>
          {active ? 'Connected' : `Connect ${firstSlot}–${secondSlot}`}
        </Text>
      </Pressable>
      <View style={[styles.connectionLine, active && styles.connectionLineActive]} />
    </View>
  );
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    connectionButton: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    connectionButtonActive: {
      backgroundColor: colors.accentMuted,
      borderColor: colors.accent,
    },
    connectionButtonText: {
      color: colors.muted,
      fontSize: 9,
      fontWeight: '800',
    },
    connectionButtonTextActive: {
      color: colors.accentDark,
    },
    connectionGap: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
      marginHorizontal: 26,
      marginVertical: -3,
    },
    connectionLine: {
      backgroundColor: colors.border,
      flex: 1,
      height: 1,
    },
    connectionLineActive: {
      backgroundColor: colors.accent,
    },
    pressed: {
      opacity: 0.65,
    },
  });
}
