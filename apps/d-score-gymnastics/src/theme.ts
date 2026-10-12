import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { Platform, type ViewStyle } from 'react-native';

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  readonly accent: string;
  readonly accentDark: string;
  readonly accentMuted: string;
  readonly background: string;
  readonly border: string;
  readonly danger: string;
  readonly dangerMuted: string;
  readonly ink: string;
  readonly inverseMuted: string;
  readonly inverseSurface: string;
  readonly inverseText: string;
  readonly muted: string;
  readonly navy: string;
  readonly onAccentMuted: string;
  readonly success: string;
  readonly successMuted: string;
  readonly surface: string;
  readonly surfaceMuted: string;
  readonly warning: string;
  readonly warningMuted: string;
}

export const lightColors: ThemeColors = {
  accent: '#2563eb',
  accentDark: '#1748b0',
  accentMuted: '#e8f0ff',
  background: '#f4f6f8',
  border: '#dce1e8',
  danger: '#b42318',
  dangerMuted: '#fef0ed',
  ink: '#17202d',
  inverseMuted: '#b9c3d2',
  inverseSurface: '#101828',
  inverseText: '#ffffff',
  muted: '#667085',
  navy: '#101828',
  onAccentMuted: '#ffffff',
  success: '#16794a',
  successMuted: '#eaf8f0',
  surface: '#ffffff',
  surfaceMuted: '#f8fafc',
  warning: '#9a6700',
  warningMuted: '#fff7df',
};

export const darkColors: ThemeColors = {
  accent: '#60a5fa',
  accentDark: '#bfdbfe',
  accentMuted: '#172554',
  background: '#0b1120',
  border: '#334155',
  danger: '#fb7185',
  dangerMuted: '#3b1822',
  ink: '#f8fafc',
  inverseMuted: '#94a3b8',
  inverseSurface: '#172033',
  inverseText: '#f8fafc',
  muted: '#94a3b8',
  navy: '#e2e8f0',
  onAccentMuted: '#172554',
  success: '#4ade80',
  successMuted: '#123524',
  surface: '#111827',
  surfaceMuted: '#1e293b',
  warning: '#fbbf24',
  warningMuted: '#3b2f0c',
};

interface ThemeContextValue {
  readonly colors: ThemeColors;
  readonly mode: ThemeMode;
}

const ThemeContext = createContext<ThemeContextValue>({ colors: lightColors, mode: 'light' });

export function ThemeProvider({
  children,
  mode,
}: {
  readonly children: ReactNode;
  readonly mode: ThemeMode;
}) {
  return createElement(ThemeContext.Provider, {
    children,
    value: { colors: mode === 'dark' ? darkColors : lightColors, mode },
  });
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export interface ThemedScrollbarStyle extends ViewStyle {
  readonly scrollbarColor: string;
  readonly scrollbarWidth: 'thin';
}

export function useThemedScrollbarStyle(): ThemedScrollbarStyle | undefined {
  const { colors } = useTheme();
  return useMemo(
    () =>
      Platform.OS === 'web'
        ? {
            scrollbarColor: `${colors.muted} transparent`,
            scrollbarWidth: 'thin',
          }
        : undefined,
    [colors],
  );
}

export const radii = {
  large: 20,
  medium: 14,
  small: 9,
} as const;
