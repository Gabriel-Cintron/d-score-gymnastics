import { profileLabel } from '../ruleset';
import { effectiveProfile } from '../scoring-profile-state';
import type { ApparatusId } from '@d-score-gymnastics/scoring';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
  routinesInCatalogue,
  type RoutineLibrary,
  type SavedRoutine,
} from '../routine-library';
import { radii, useTheme, useThemedScrollbarStyle, type ThemeColors } from '../theme';

type ConfirmationAction = 'delete' | 'load';

interface PendingConfirmation {
  readonly action: ConfirmationAction;
  readonly item: SavedRoutine;
}

interface RoutineLibraryModalProps {
  readonly activeApparatus: ApparatusId;
  readonly canSaveCurrent: boolean;
  readonly errorMessage?: string;
  readonly library: RoutineLibrary;
  readonly onClose: () => void;
  readonly onCreateRoutine: (name: string) => void;
  readonly onDelete: (itemId: string) => void;
  readonly onLoad: (item: SavedRoutine) => void;
  readonly onRename: (itemId: string, name: string) => void;
  readonly ready: boolean;
  readonly visible: boolean;
  readonly wouldReplaceWork: (item: SavedRoutine) => boolean;
}

export function RoutineLibraryModal({
  activeApparatus,
  canSaveCurrent,
  errorMessage,
  library,
  onClose,
  onCreateRoutine,
  onDelete,
  onLoad,
  onRename,
  ready,
  visible,
  wouldReplaceWork,
}: RoutineLibraryModalProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const scrollbarStyle = useThemedScrollbarStyle();
  const [confirmation, setConfirmation] = useState<PendingConfirmation>();
  const [editingItemId, setEditingItemId] = useState<string>();
  const [name, setName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [renameSubmitted, setRenameSubmitted] = useState(false);
  const [saveSubmitted, setSaveSubmitted] = useState(false);
  const items = useMemo(
    () =>
      [...routinesInCatalogue(library)].sort(
        (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      ),
    [library],
  );
  const normalizedName = normalizeLibraryName(name);
  const saveNameValid = libraryNameIsAvailable(library, normalizedName);
  const libraryHasRoom = library.items.length < MAX_LIBRARY_ITEMS;

  useEffect(() => {
    if (!visible) return;
    setConfirmation(undefined);
    setEditingItemId(undefined);
    setName('');
    setRenameName('');
    setRenameSubmitted(false);
    setSaveSubmitted(false);
  }, [visible]);

  function create(): void {
    setSaveSubmitted(true);
    if (!saveNameValid || !libraryHasRoom || !canSaveCurrent) return;
    onCreateRoutine(normalizedName);
    setName('');
    setSaveSubmitted(false);
  }

  function requestLoad(item: SavedRoutine): void {
    if (wouldReplaceWork(item)) {
      setConfirmation({ action: 'load', item });
      return;
    }
    onLoad(item);
    onClose();
  }

  function beginRename(item: SavedRoutine): void {
    setEditingItemId(item.id);
    setRenameName(item.name);
    setRenameSubmitted(false);
  }

  function confirmRename(item: SavedRoutine): void {
    setRenameSubmitted(true);
    const normalized = normalizeLibraryName(renameName);
    if (!libraryNameIsAvailable(library, normalized, item.id)) return;
    onRename(item.id, normalized);
    setEditingItemId(undefined);
    setRenameName('');
    setRenameSubmitted(false);
  }

  function completeConfirmation(): void {
    if (confirmation === undefined) return;
    if (confirmation.action === 'delete') {
      onDelete(confirmation.item.id);
    } else {
      onLoad(confirmation.item);
      onClose();
    }
    setConfirmation(undefined);
  }

  return (
    <Modal
      accessibilityLabel="Routine catalogue"
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable
          accessibilityLabel="Close routine catalogue"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.scrim}
        />
        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>REUSABLE ROUTINES</Text>
              <Text style={styles.title}>Routine catalogue</Text>
              <Text style={styles.subtitle}>
                Independent copies stored only on this device · {items.length} saved
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close routine catalogue"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.savePanel}>
            <Text style={styles.saveTitle}>
              Save current {APPARATUS_SHORT_LABELS[activeApparatus]} routine
            </Text>
            <Text style={styles.saveCopy}>
              Add the current {APPARATUS_LABELS[activeApparatus]} routine as a reusable copy.
            </Text>
            <TextInput
              accessibilityLabel="Routine catalogue name"
              autoCapitalize="sentences"
              maxLength={MAX_LIBRARY_NAME_LENGTH}
              onChangeText={(next) => {
                setName(next);
                setSaveSubmitted(false);
              }}
              onSubmitEditing={create}
              placeholder="Name this routine"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              style={styles.nameInput}
              value={name}
            />
            {saveSubmitted && (!saveNameValid || !canSaveCurrent) ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {!canSaveCurrent
                  ? `Build a ${APPARATUS_SHORT_LABELS[activeApparatus]} routine before saving it.`
                  : normalizedName.length === 0
                    ? 'Enter a name before saving.'
                    : 'That name is already used.'}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={!ready || !canSaveCurrent || !libraryHasRoom}
              onPress={create}
              style={({ pressed }) => [
                styles.saveButton,
                (!ready || !canSaveCurrent || !libraryHasRoom) && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.saveButtonText}>Save to catalogue</Text>
            </Pressable>
            {ready && !libraryHasRoom ? (
              <Text style={styles.helperText}>
                The library limit of {MAX_LIBRARY_ITEMS} saved items has been reached.
              </Text>
            ) : null}
          </View>

          {errorMessage === undefined ? null : (
            <Text accessibilityRole="alert" style={styles.storageError}>
              {errorMessage}
            </Text>
          )}

          <View style={styles.listHeading}>
            <Text style={styles.listTitle}>SAVED ROUTINES</Text>
            <Text style={styles.listCount}>{items.length}</Text>
          </View>
          <FlatList
            contentContainerStyle={[
              styles.listContent,
              items.length === 0 && styles.emptyListContent,
            ]}
            data={items}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>◇</Text>
                <Text style={styles.emptyTitle}>No catalogue routines yet</Text>
                <Text style={styles.emptyCopy}>
                  Save an event here or choose Save when switching all-arounds.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const editing = editingItemId === item.id;
              const renameValid = libraryNameIsAvailable(library, renameName, item.id);
              return (
                <View style={styles.itemCard}>
                  <View style={styles.itemTopRow}>
                    <View style={styles.itemBadge}>
                      <Text style={styles.itemBadgeText}>
                        {APPARATUS_SHORT_LABELS[item.apparatus]}
                      </Text>
                    </View>
                    <View style={styles.itemCopy}>
                      {editing ? (
                        <TextInput
                          accessibilityLabel={`Rename ${item.name}`}
                          autoFocus
                          maxLength={MAX_LIBRARY_NAME_LENGTH}
                          onChangeText={(next) => {
                            setRenameName(next);
                            setRenameSubmitted(false);
                          }}
                          onSubmitEditing={() => confirmRename(item)}
                          selectTextOnFocus
                          style={styles.renameInput}
                          value={renameName}
                        />
                      ) : (
                        <Text numberOfLines={1} style={styles.itemName}>
                          {item.name}
                        </Text>
                      )}
                      <Text style={styles.itemMeta}>
                        {APPARATUS_LABELS[item.apparatus]} ·{' '}
                        {profileLabel(effectiveProfile(item.state, item.apparatus))} · Updated{' '}
                        {formatLibraryDate(item.updatedAt)}
                      </Text>
                      {editing && renameSubmitted && !renameValid ? (
                        <Text accessibilityRole="alert" style={styles.renameError}>
                          {normalizeLibraryName(renameName).length === 0
                            ? 'Enter a name.'
                            : 'That name is already used.'}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.itemActions}>
                    {editing ? (
                      <>
                        <SmallButton label="Cancel" onPress={() => setEditingItemId(undefined)} />
                        <SmallButton
                          label="Save name"
                          onPress={() => confirmRename(item)}
                          primary
                        />
                      </>
                    ) : (
                      <>
                        <SmallButton
                          label="Use routine"
                          onPress={() => requestLoad(item)}
                          primary
                        />
                        <SmallButton label="Rename" onPress={() => beginRename(item)} />
                        <SmallButton
                          danger
                          label="Delete"
                          onPress={() => setConfirmation({ action: 'delete', item })}
                        />
                      </>
                    )}
                  </View>
                </View>
              );
            }}
            style={[styles.list, scrollbarStyle]}
          />
        </View>

        {confirmation === undefined ? null : (
          <View style={styles.confirmationLayer}>
            <Pressable
              accessibilityLabel="Cancel confirmation"
              accessibilityRole="button"
              onPress={() => setConfirmation(undefined)}
              style={styles.confirmationScrim}
            />
            <View accessibilityViewIsModal style={styles.confirmationCard}>
              <Text style={styles.confirmationEyebrow}>
                {confirmation.action === 'delete' ? 'DELETE ROUTINE' : 'REPLACE ROUTINE'}
              </Text>
              <Text style={styles.confirmationTitle}>
                {confirmation.action === 'delete'
                  ? `Delete “${confirmation.item.name}”?`
                  : `Use “${confirmation.item.name}”?`}
              </Text>
              <Text style={styles.confirmationCopy}>
                {confirmation.action === 'delete'
                  ? 'This permanently removes the catalogue copy from this device.'
                  : `This replaces the current ${APPARATUS_LABELS[confirmation.item.apparatus]} routine in the active all-around.`}
              </Text>
              <View style={styles.confirmationActions}>
                <SmallButton label="Cancel" onPress={() => setConfirmation(undefined)} />
                <SmallButton
                  danger={confirmation.action === 'delete'}
                  label={confirmation.action === 'delete' ? 'Delete' : 'Use routine'}
                  onPress={completeConfirmation}
                  primary={confirmation.action === 'load'}
                />
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SmallButton({
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
        styles.smallButton,
        primary && styles.smallButtonPrimary,
        danger && styles.smallButtonDanger,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.smallButtonText,
          primary && styles.smallButtonTextPrimary,
          danger && styles.smallButtonTextDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function formatLibraryDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'unknown date';
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    closeButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    closeText: { color: colors.ink, fontSize: 22, lineHeight: 23 },
    confirmationActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'flex-end',
      marginTop: 18,
    },
    confirmationCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.large,
      borderWidth: 1,
      maxWidth: 440,
      padding: 20,
      width: '90%',
      zIndex: 2,
    },
    confirmationCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
    confirmationEyebrow: {
      color: colors.warning,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
    },
    confirmationLayer: {
      alignItems: 'center',
      bottom: 0,
      justifyContent: 'center',
      left: 0,
      padding: 16,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 10,
    },
    confirmationScrim: {
      backgroundColor: 'rgba(4, 10, 23, 0.72)',
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    confirmationTitle: { color: colors.navy, fontSize: 19, fontWeight: '900', marginTop: 4 },
    disabledButton: { opacity: 0.4 },
    emptyCopy: {
      color: colors.muted,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 5,
      maxWidth: 360,
      textAlign: 'center',
    },
    emptyIcon: { color: colors.accent, fontSize: 28, fontWeight: '300' },
    emptyListContent: { flexGrow: 1 },
    emptyState: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      minHeight: 180,
      padding: 24,
    },
    emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 4 },
    errorText: { color: colors.danger, fontSize: 10, marginTop: 6 },
    eyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
    header: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      padding: 18,
      paddingBottom: 14,
    },
    headingCopy: { flex: 1 },
    helperText: { color: colors.muted, fontSize: 9, marginTop: 8 },
    itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 },
    itemBadge: {
      alignItems: 'center',
      backgroundColor: colors.accentMuted,
      borderColor: colors.accent,
      borderRadius: 10,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    itemBadgeText: { color: colors.accentDark, fontSize: 11, fontWeight: '900' },
    itemCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      padding: 13,
    },
    itemCopy: { flex: 1, minWidth: 0 },
    itemMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
    itemName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
    itemTopRow: { alignItems: 'center', flexDirection: 'row', gap: 11 },
    list: { flex: 1, minHeight: 150 },
    listContent: { gap: 8, paddingBottom: 16, paddingHorizontal: 18 },
    listCount: { color: colors.muted, fontSize: 10, fontWeight: '800' },
    listHeading: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 11,
    },
    listTitle: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
    nameInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.small,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 12,
      marginTop: 12,
      minHeight: 42,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    overlay: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 12 },
    pressed: { opacity: 0.68 },
    renameError: { color: colors.danger, fontSize: 9, marginTop: 4 },
    renameInput: {
      backgroundColor: colors.surface,
      borderColor: colors.accent,
      borderRadius: 7,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 12,
      minHeight: 36,
      paddingHorizontal: 9,
    },
    saveButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.accent,
      borderRadius: radii.small,
      justifyContent: 'center',
      marginTop: 10,
      minHeight: 39,
      paddingHorizontal: 14,
    },
    saveButtonText: { color: colors.surface, fontSize: 10, fontWeight: '900' },
    saveCopy: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
    savePanel: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      marginHorizontal: 18,
      padding: 14,
    },
    saveTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
    scrim: {
      backgroundColor: 'rgba(4, 10, 23, 0.68)',
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.large,
      borderWidth: 1,
      height: '92%',
      maxHeight: 760,
      maxWidth: 760,
      overflow: 'hidden',
      width: '96%',
      zIndex: 1,
    },
    smallButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 7,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 31,
      paddingHorizontal: 9,
    },
    smallButtonDanger: { backgroundColor: colors.dangerMuted, borderColor: colors.danger },
    smallButtonText: { color: colors.ink, fontSize: 8, fontWeight: '800' },
    smallButtonTextDanger: { color: colors.danger },
    smallButtonTextPrimary: { color: colors.surface },
    smallButtonPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
    storageError: { color: colors.danger, fontSize: 9, marginHorizontal: 18, marginTop: 10 },
    subtitle: { color: colors.muted, fontSize: 10, marginTop: 4 },
    title: { color: colors.navy, fontSize: 22, fontWeight: '900', marginTop: 3 },
  });
}
