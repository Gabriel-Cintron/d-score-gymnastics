import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRODUCT_NAME } from '../product';
import { useTheme, type ThemeColors } from '../theme';

export function PwaUpdateBanner({
  onDismiss,
  onReload,
  visible,
}: {
  readonly onDismiss: () => void;
  readonly onReload: () => void;
  readonly visible: boolean;
}) {
  const styles = useStyles();
  if (!visible) return null;

  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <View style={styles.copy}>
        <Text style={styles.title}>{PRODUCT_NAME} update available</Text>
        <Text style={styles.text}>Reload when you are ready. Your routines are saved locally.</Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Later</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onReload} style={styles.primaryButton}>
          <Text style={styles.primaryText}>Reload</Text>
        </Pressable>
      </View>
    </View>
  );
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actions: { flexDirection: 'row', gap: 7 },
    banner: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: colors.warningMuted,
      borderBottomColor: colors.warning,
      borderBottomWidth: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      justifyContent: 'space-between',
      maxWidth: 1420,
      paddingHorizontal: 18,
      paddingVertical: 9,
      width: '100%',
    },
    copy: { flex: 1, minWidth: 220 },
    primaryButton: {
      backgroundColor: colors.warning,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    primaryText: { color: colors.onAccentMuted, fontSize: 9, fontWeight: '900' },
    secondaryButton: {
      borderColor: colors.warning,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    secondaryText: { color: colors.warning, fontSize: 9, fontWeight: '900' },
    text: { color: colors.warning, fontSize: 9, marginTop: 2 },
    title: { color: colors.warning, fontSize: 10, fontWeight: '900' },
  });
}
