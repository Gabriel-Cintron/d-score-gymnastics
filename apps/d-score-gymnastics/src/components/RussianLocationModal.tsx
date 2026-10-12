import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PRODUCT_NAME } from '../product';
import { russianLocationLabel } from '../russian-location';
import { radii, useTheme, type ThemeColors } from '../theme';

interface RussianLocationModalProps {
  readonly elementName: string;
  readonly mode: 'add' | 'edit';
  readonly onCancel: () => void;
  readonly onConfirm: (location: string) => void;
  readonly options: readonly string[];
  readonly selectedLocation?: string;
  readonly visible: boolean;
}

export function RussianLocationModal({
  elementName,
  mode,
  onCancel,
  onConfirm,
  options,
  selectedLocation,
  visible,
}: RussianLocationModalProps) {
  const styles = useStyles();
  const [selection, setSelection] = useState(selectedLocation);

  useEffect(() => setSelection(selectedLocation), [selectedLocation, visible]);

  return (
    <Modal
      accessibilityLabel="Russian location"
      animationType="fade"
      onRequestClose={onCancel}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Cancel Russian location selection"
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.scrim}
        />
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text style={styles.eyebrow}>POMMEL HORSE DETAIL</Text>
          <Text style={styles.title}>Where is this Russian performed?</Text>
          <Text numberOfLines={2} style={styles.elementName}>
            {elementName}
          </Text>
          <Text style={styles.copy}>
            This location affects repetition limits, so {PRODUCT_NAME} needs it before scoring the
            element.
          </Text>

          <View accessibilityRole="radiogroup" style={styles.options}>
            {options.map((option) => {
              const selected = selection === option;
              return (
                <Pressable
                  accessibilityLabel={russianLocationLabel(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  aria-checked={selected}
                  key={option}
                  onPress={() => setSelection(option)}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>
                      {russianLocationLabel(option)}
                    </Text>
                    <Text style={styles.optionDescription}>
                      {option === 'russian-location-end'
                        ? 'Performed at the end of the horse.'
                        : 'Performed on one pommel or between the pommels.'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={selection === undefined}
              onPress={() => {
                if (selection !== undefined) onConfirm(selection);
              }}
              style={({ pressed }) => [
                styles.confirmButton,
                selection === undefined && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmText}>
                {mode === 'add' ? 'Add element' : 'Update location'}
              </Text>
            </Pressable>
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
    actions: {
      flexDirection: 'row',
      gap: 9,
      justifyContent: 'flex-end',
      marginTop: 20,
    },
    cancelButton: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: radii.small,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 42,
      paddingHorizontal: 16,
    },
    cancelText: {
      color: colors.ink,
      fontSize: 12,
      fontWeight: '700',
    },
    confirmButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: radii.small,
      justifyContent: 'center',
      minHeight: 42,
      paddingHorizontal: 17,
    },
    confirmText: {
      color: colors.surface,
      fontSize: 12,
      fontWeight: '800',
    },
    copy: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 9,
    },
    dialog: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.large,
      borderWidth: 1,
      maxWidth: 480,
      padding: 20,
      width: '92%',
    },
    disabledButton: {
      opacity: 0.42,
    },
    elementName: {
      color: colors.ink,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
      marginTop: 7,
    },
    eyebrow: {
      color: colors.accent,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1,
    },
    option: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 64,
      padding: 12,
    },
    optionCopy: {
      flex: 1,
    },
    optionDescription: {
      color: colors.muted,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },
    optionSelected: {
      backgroundColor: colors.accentMuted,
      borderColor: colors.accent,
    },
    optionTitle: {
      color: colors.ink,
      fontSize: 13,
      fontWeight: '700',
    },
    optionTitleSelected: {
      color: colors.accentDark,
    },
    options: {
      gap: 9,
      marginTop: 17,
    },
    overlay: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 16,
    },
    pressed: {
      opacity: 0.7,
    },
    radio: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 2,
      height: 20,
      justifyContent: 'center',
      width: 20,
    },
    radioDot: {
      backgroundColor: colors.surface,
      borderRadius: 4,
      height: 8,
      width: 8,
    },
    radioSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    scrim: {
      backgroundColor: 'rgba(4, 10, 23, 0.62)',
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    title: {
      color: colors.navy,
      fontSize: 21,
      fontWeight: '900',
      letterSpacing: -0.4,
      marginTop: 5,
    },
  });
}
