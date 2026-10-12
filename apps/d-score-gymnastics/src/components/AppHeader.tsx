import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRODUCT_NAME } from '../product';
import { radii, useTheme, type ThemeColors, type ThemeMode } from '../theme';

export type AppScreen = 'editor' | 'home' | 'settings';

interface AppHeaderProps {
  readonly onBackHome: () => void;
  readonly onOpenSettings: () => void;
  readonly onThemeModeChange: (mode: ThemeMode) => void;
  readonly screen: AppScreen;
  readonly themeMode: ThemeMode;
}

export function AppHeader({
  onBackHome,
  onOpenSettings,
  onThemeModeChange,
  screen,
  themeMode,
}: AppHeaderProps) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      {screen === 'home' ? (
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>D</Text>
          </View>
          <View>
            <Text style={styles.brandName}>{PRODUCT_NAME}</Text>
            <Text style={styles.brandSubtitle}>Men's gymnastics difficulty</Text>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityLabel="Back to Home"
          accessibilityRole="button"
          onPress={onBackHome}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backIcon}>‹</Text>
          <View>
            <Text style={styles.backLabel}>HOME</Text>
            <Text style={styles.screenTitle}>
              {screen === 'editor' ? 'Routine editor' : 'Settings'}
            </Text>
          </View>
        </Pressable>
      )}

      <View style={styles.actions}>
        {screen === 'settings' ? null : (
          <Pressable
            accessibilityLabel="Open Settings"
            accessibilityRole="button"
            onPress={onOpenSettings}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
          >
            <Text style={styles.actionIcon}>⚙</Text>
            <Text style={styles.actionText}>Settings</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityLabel={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
          accessibilityRole="button"
          onPress={() => onThemeModeChange(themeMode === 'dark' ? 'light' : 'dark')}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Text style={styles.actionIcon}>{themeMode === 'dark' ? '☀' : '☾'}</Text>
          <Text style={styles.actionText}>{themeMode === 'dark' ? 'Light' : 'Dark'}</Text>
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
    actionButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      minHeight: 34,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    actionIcon: { color: colors.accent, fontSize: 13, fontWeight: '900' },
    actionText: { color: colors.ink, fontSize: 9, fontWeight: '800' },
    actions: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'flex-end',
    },
    backButton: {
      alignItems: 'center',
      borderRadius: radii.small,
      flexDirection: 'row',
      gap: 9,
      minHeight: 42,
      paddingRight: 8,
    },
    backIcon: { color: colors.accent, fontSize: 30, fontWeight: '300', lineHeight: 30 },
    backLabel: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
    brand: { alignItems: 'center', flexDirection: 'row', gap: 10 },
    brandName: { color: colors.navy, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
    brandSubtitle: { color: colors.muted, fontSize: 9, marginTop: 1 },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      justifyContent: 'space-between',
      marginBottom: 24,
      width: '100%',
    },
    logo: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 12,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    logoText: { color: colors.onAccentMuted, fontSize: 18, fontWeight: '900' },
    pressed: { opacity: 0.65 },
    screenTitle: { color: colors.navy, fontSize: 15, fontWeight: '900', marginTop: 1 },
  });
}
