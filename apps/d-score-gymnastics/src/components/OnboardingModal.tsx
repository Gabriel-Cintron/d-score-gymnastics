import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PRODUCT_NAME } from '../product';
import { useTheme, type ThemeColors } from '../theme';

const STEPS = [
  {
    copy: `Build complete all-arounds or focus on one event. ${PRODUCT_NAME} updates the expected difficulty score as you work.`,
    eyebrow: 'WELCOME TO D-SCORE',
    mark: 'D',
    title: 'Plan routines with confidence',
  },
  {
    copy: 'Enter only the skills you intend to count. Connections, Pommel sequences, element groups, and warnings stay attached to the routine.',
    eyebrow: 'A CLEANER WORKFLOW',
    mark: '8',
    title: 'Counted skills, clearly explained',
  },
  {
    copy: 'Your all-arounds and routine catalogue are stored locally. Use Settings to create a backup before changing devices or clearing browser data.',
    eyebrow: 'PRIVATE BY DEFAULT',
    mark: '✓',
    title: 'Your routines stay on your device',
  },
] as const;

interface OnboardingModalProps {
  readonly onComplete: () => void;
  readonly visible: boolean;
}

export function OnboardingModal({ onComplete, visible }: OnboardingModalProps) {
  const styles = useStyles();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex] ?? STEPS[0];
  const finalStep = stepIndex === STEPS.length - 1;

  useEffect(() => {
    if (visible) setStepIndex(0);
  }, [visible]);

  return (
    <Modal
      accessibilityLabel={`${PRODUCT_NAME} quick tour`}
      animationType="fade"
      onRequestClose={onComplete}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View style={styles.layer}>
        <View accessibilityViewIsModal style={styles.card}>
          <View style={styles.visual}>
            <View style={styles.markRing}>
              <Text style={styles.mark}>{step.mark}</Text>
            </View>
            <View style={styles.orbitOne} />
            <View style={styles.orbitTwo} />
          </View>
          <View style={styles.content}>
            <Text style={styles.eyebrow}>{step.eyebrow}</Text>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.copy}>{step.copy}</Text>
            <View style={styles.dots}>
              {STEPS.map((candidate, index) => (
                <View
                  key={candidate.title}
                  style={[styles.dot, index === stepIndex && styles.activeDot]}
                />
              ))}
            </View>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={onComplete}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryText}>{finalStep ? 'Close' : 'Skip tour'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => (finalStep ? onComplete() : setStepIndex((current) => current + 1))}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryText}>{finalStep ? 'Get started' : 'Continue'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actions: { flexDirection: 'row', gap: 8, justifyContent: 'space-between', marginTop: 24 },
    activeDot: { backgroundColor: colors.accent, width: 20 },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      maxWidth: 520,
      overflow: 'hidden',
      width: '94%',
    },
    content: { padding: 24 },
    copy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 10 },
    dot: { backgroundColor: colors.border, borderRadius: 3, height: 6, width: 6 },
    dots: { flexDirection: 'row', gap: 6, marginTop: 22 },
    eyebrow: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
    layer: {
      alignItems: 'center',
      backgroundColor: 'rgba(4, 12, 24, 0.72)',
      flex: 1,
      justifyContent: 'center',
      padding: 16,
    },
    mark: { color: colors.onAccentMuted, fontSize: 38, fontWeight: '900' },
    markRing: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 46,
      height: 92,
      justifyContent: 'center',
      width: 92,
      zIndex: 2,
    },
    orbitOne: {
      borderColor: colors.onAccentMuted,
      borderRadius: 75,
      borderWidth: 1,
      height: 150,
      opacity: 0.28,
      position: 'absolute',
      width: 150,
    },
    orbitTwo: {
      borderColor: colors.onAccentMuted,
      borderRadius: 110,
      borderWidth: 1,
      height: 220,
      opacity: 0.15,
      position: 'absolute',
      width: 220,
    },
    pressed: { opacity: 0.7 },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 11,
      justifyContent: 'center',
      minHeight: 42,
      paddingHorizontal: 18,
    },
    primaryText: { color: colors.onAccentMuted, fontSize: 10, fontWeight: '900' },
    secondaryButton: {
      alignItems: 'center',
      borderRadius: 11,
      justifyContent: 'center',
      minHeight: 42,
      paddingHorizontal: 10,
    },
    secondaryText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
    title: {
      color: colors.navy,
      fontSize: 27,
      fontWeight: '900',
      letterSpacing: -0.7,
      marginTop: 5,
    },
    visual: {
      alignItems: 'center',
      backgroundColor: colors.inverseSurface,
      height: 190,
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });
}
