import type { ApparatusId } from '@d-score-gymnastics/scoring';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { APPARATUS_LABELS, APPARATUS_SHORT_LABELS } from '../apparatus';
import {
  libraryNameIsAvailable,
  MAX_LIBRARY_ITEMS,
  MAX_LIBRARY_NAME_LENGTH,
  normalizeLibraryName,
  type RoutineLibrary,
} from '../routine-library';
import { radii, useTheme, useThemedScrollbarStyle, type ThemeColors } from '../theme';

export interface NamedRoutineToSave {
  readonly apparatus: ApparatusId;
  readonly name: string;
}

interface AllAroundSwitchModalProps {
  readonly apparatuses: readonly ApparatusId[];
  readonly library: RoutineLibrary;
  readonly onCancel: () => void;
  readonly onDontSave: () => void;
  readonly onSave: (routines: readonly NamedRoutineToSave[]) => void;
  readonly reservedItemCount?: number;
  readonly visible: boolean;
}

export function AllAroundSwitchModal({
  apparatuses,
  library,
  onCancel,
  onDontSave,
  onSave,
  reservedItemCount = 0,
  visible,
}: AllAroundSwitchModalProps) {
  const styles = useStyles();
  const scrollbarStyle = useThemedScrollbarStyle();
  const [names, setNames] = useState<Partial<Record<ApparatusId, string>>>({});
  const [naming, setNaming] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const libraryHasRoom =
    library.items.length + apparatuses.length + reservedItemCount <= MAX_LIBRARY_ITEMS;
  const normalizedNames = apparatuses.map((apparatus) => ({
    apparatus,
    name: normalizeLibraryName(names[apparatus] ?? ''),
  }));
  const normalizedNameKeys = normalizedNames.map(({ name }) => name.toLocaleLowerCase('en-US'));
  const namesValid =
    libraryHasRoom &&
    normalizedNames.every(({ name }) => libraryNameIsAvailable(library, name)) &&
    new Set(normalizedNameKeys).size === normalizedNameKeys.length;

  useEffect(() => {
    if (!visible) return;
    setNames({});
    setNaming(false);
    setSubmitted(false);
  }, [apparatuses, visible]);

  function submit(): void {
    setSubmitted(true);
    if (!namesValid) return;
    onSave(normalizedNames);
  }

  return (
    <Modal
      accessibilityLabel="Switch all-arounds"
      animationType="fade"
      onRequestClose={onCancel}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.layer}
      >
        <Pressable
          accessibilityLabel="Cancel switching all-arounds"
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.scrim}
        />
        <View accessibilityViewIsModal style={styles.card}>
          <Text style={styles.eyebrow}>{naming ? 'SAVE ROUTINES' : 'SWITCH ALL-AROUNDS'}</Text>
          <Text style={styles.title}>
            {naming ? 'Name your routines' : 'Save these routines before switching?'}
          </Text>
          {naming ? (
            <>
              <Text style={styles.copy}>
                Each routine will be added to your catalogue as an independent reusable copy.
              </Text>
              <ScrollView
                contentContainerStyle={styles.nameList}
                keyboardShouldPersistTaps="handled"
                style={[styles.nameScroller, scrollbarStyle]}
              >
                {apparatuses.map((apparatus) => {
                  const normalized = normalizeLibraryName(names[apparatus] ?? '');
                  const duplicateInForm =
                    normalized.length > 0 &&
                    normalizedNames.filter(
                      (candidate) =>
                        candidate.name.toLocaleLowerCase('en-US') ===
                        normalized.toLocaleLowerCase('en-US'),
                    ).length > 1;
                  const valid = libraryNameIsAvailable(library, normalized) && !duplicateInForm;
                  return (
                    <View key={apparatus} style={styles.nameField}>
                      <View style={styles.nameLabelRow}>
                        <Text style={styles.nameLabel}>{APPARATUS_LABELS[apparatus]}</Text>
                        <Text style={styles.apparatusBadge}>
                          {APPARATUS_SHORT_LABELS[apparatus]}
                        </Text>
                      </View>
                      <TextInput
                        accessibilityLabel={`${APPARATUS_LABELS[apparatus]} routine name`}
                        autoCapitalize="sentences"
                        maxLength={MAX_LIBRARY_NAME_LENGTH}
                        onChangeText={(name) => {
                          setNames((current) => ({ ...current, [apparatus]: name }));
                          setSubmitted(false);
                        }}
                        onSubmitEditing={apparatuses.length === 1 ? submit : undefined}
                        placeholder={`Name this ${APPARATUS_SHORT_LABELS[apparatus]} routine`}
                        returnKeyType={apparatuses.length === 1 ? 'done' : 'next'}
                        style={styles.input}
                        value={names[apparatus] ?? ''}
                      />
                      {submitted && !valid ? (
                        <Text accessibilityRole="alert" style={styles.errorText}>
                          {normalized.length === 0
                            ? 'Enter a name.'
                            : duplicateInForm
                              ? 'Use a different name for each routine.'
                              : 'That name is already used.'}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
              {!libraryHasRoom ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  There is not enough room in the routine catalogue to save every routine.
                </Text>
              ) : null}
              <View style={styles.actions}>
                <DialogButton label="Cancel" onPress={onCancel} />
                <DialogButton label="Save routines & switch" onPress={submit} primary />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.copy}>
                Your all-around is saved automatically. Would you like to save its new routines to
                your routine catalogue before switching?
              </Text>
              <View style={styles.routineSummary}>
                {apparatuses.map((apparatus) => (
                  <View key={apparatus} style={styles.summaryBadge}>
                    <Text style={styles.summaryBadgeText}>{APPARATUS_SHORT_LABELS[apparatus]}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.actions}>
                <DialogButton label="Cancel" onPress={onCancel} />
                <DialogButton label="Don't save" onPress={onDontSave} />
                <DialogButton label="Save" onPress={() => setNaming(true)} primary />
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DialogButton({
  label,
  onPress,
  primary = false,
}: {
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
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, primary && styles.primaryButtonText]}>{label}</Text>
    </Pressable>
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
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'flex-end',
      marginTop: 20,
    },
    apparatusBadge: {
      color: colors.accentDark,
      fontSize: 8,
      fontWeight: '900',
    },
    button: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.small,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 40,
      minWidth: 88,
      paddingHorizontal: 13,
    },
    buttonText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.large,
      borderWidth: 1,
      maxHeight: '88%',
      maxWidth: 520,
      padding: 20,
      width: '94%',
      zIndex: 2,
    },
    copy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
    errorText: { color: colors.danger, fontSize: 9, lineHeight: 14, marginTop: 5 },
    eyebrow: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.small,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 12,
      minHeight: 42,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    layer: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 14 },
    nameField: { gap: 6 },
    nameLabel: { color: colors.ink, fontSize: 10, fontWeight: '800' },
    nameLabelRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    nameList: { gap: 13, paddingBottom: 4 },
    nameScroller: { marginTop: 16, maxHeight: 360 },
    pressed: { opacity: 0.68 },
    primaryButton: { backgroundColor: colors.accent, borderColor: colors.accent },
    primaryButtonText: { color: colors.surface },
    routineSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
    scrim: {
      backgroundColor: 'rgba(4, 10, 23, 0.72)',
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    summaryBadge: {
      alignItems: 'center',
      backgroundColor: colors.accentMuted,
      borderColor: colors.accent,
      borderRadius: 9,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 30,
      minWidth: 38,
      paddingHorizontal: 8,
    },
    summaryBadgeText: { color: colors.accentDark, fontSize: 9, fontWeight: '900' },
    title: {
      color: colors.navy,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.3,
      marginTop: 4,
    },
  });
}
