import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, useTheme, type ThemeColors } from '../theme';

interface ConfirmationModalProps {
  readonly confirmLabel: string;
  readonly copy: string;
  readonly danger?: boolean;
  readonly eyebrow: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly title: string;
  readonly visible: boolean;
}

export function ConfirmationModal({
  confirmLabel,
  copy,
  danger = false,
  eyebrow,
  onCancel,
  onConfirm,
  title,
  visible,
}: ConfirmationModalProps) {
  const styles = useStyles();
  return (
    <Modal
      accessibilityLabel={title}
      animationType="fade"
      onRequestClose={onCancel}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View style={styles.layer}>
        <Pressable
          accessibilityLabel="Cancel confirmation"
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.scrim}
        />
        <View accessibilityViewIsModal style={styles.card}>
          <Text style={[styles.eyebrow, danger && styles.dangerText]}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.copy}>{copy}</Text>
          <View style={styles.actions}>
            <DialogButton label="Cancel" onPress={onCancel} />
            <DialogButton danger={danger} label={confirmLabel} onPress={onConfirm} primary />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DialogButton({
  danger = false,
  label,
  onPress,
  primary = false,
}: {
  readonly danger?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly primary?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primaryButton,
        danger && styles.dangerButton,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          primary && styles.primaryButtonText,
          danger && styles.dangerButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 20 },
    button: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: 15,
    },
    buttonText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.large,
      borderWidth: 1,
      maxWidth: 440,
      padding: 22,
      width: '90%',
    },
    copy: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 8 },
    dangerButton: { backgroundColor: colors.danger, borderColor: colors.danger },
    dangerButtonText: { color: colors.surface },
    dangerText: { color: colors.danger },
    eyebrow: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
    layer: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 18 },
    pressed: { opacity: 0.65 },
    primaryButton: { backgroundColor: colors.accent, borderColor: colors.accent },
    primaryButtonText: { color: colors.onAccentMuted },
    scrim: {
      backgroundColor: 'rgba(4, 12, 24, 0.64)',
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    title: { color: colors.navy, fontSize: 20, fontWeight: '900', marginTop: 5 },
  });
}
