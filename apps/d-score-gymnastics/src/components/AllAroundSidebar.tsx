import { profileLabel } from '../ruleset';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  allAroundsInLibrary,
  libraryNameIsAvailable,
  MAX_LIBRARY_NAME_LENGTH,
  normalizeLibraryName,
  type RoutineLibrary,
  type SavedAllAround,
} from '../routine-library';
import { radii, useTheme, useThemedScrollbarStyle, type ThemeColors } from '../theme';

export type WorkspaceSaveStatus = 'error' | 'loading' | 'saved' | 'saving';

interface AllAroundSidebarProps {
  readonly compact?: boolean;
  readonly errorMessage?: string;
  readonly library: RoutineLibrary;
  readonly onClose?: () => void;
  readonly onDelete: (itemId: string) => void;
  readonly onNew: () => void;
  readonly onOpenCatalogue: () => void;
  readonly onRename: (itemId: string, name: string) => void;
  readonly onSelect: (itemId: string) => void;
  readonly ready: boolean;
  readonly saveStatus: WorkspaceSaveStatus;
  readonly visible?: boolean;
}

export function AllAroundSidebar({
  compact = false,
  errorMessage,
  library,
  onClose,
  onDelete,
  onNew,
  onOpenCatalogue,
  onRename,
  onSelect,
  ready,
  saveStatus,
  visible = true,
}: AllAroundSidebarProps) {
  const styles = useStyles();
  const scrollbarStyle = useThemedScrollbarStyle();
  const [deleting, setDeleting] = useState<SavedAllAround>();
  const [editingId, setEditingId] = useState<string>();
  const [renameName, setRenameName] = useState('');
  const [renameSubmitted, setRenameSubmitted] = useState(false);
  const allArounds = useMemo(
    () =>
      [...allAroundsInLibrary(library)].sort(
        (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      ),
    [library],
  );

  useEffect(() => {
    if (!visible) {
      setDeleting(undefined);
      setEditingId(undefined);
      setRenameSubmitted(false);
    }
  }, [visible]);

  function beginRename(item: SavedAllAround): void {
    setEditingId(item.id);
    setRenameName(item.name);
    setRenameSubmitted(false);
  }

  function submitRename(item: SavedAllAround): void {
    setRenameSubmitted(true);
    const normalized = normalizeLibraryName(renameName);
    if (!libraryNameIsAvailable(library, normalized, item.id)) return;
    onRename(item.id, normalized);
    setEditingId(undefined);
    setRenameSubmitted(false);
  }

  const panel = (
    <View style={[styles.panel, compact && styles.compactPanel]}>
      <View style={styles.header}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>WORKSPACES</Text>
          <Text style={styles.title}>All-arounds</Text>
          <Text style={styles.subtitle}>{saveStatusLabel(saveStatus)}</Text>
        </View>
        {compact ? (
          <Pressable
            accessibilityLabel="Close all-around navigation"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!ready}
        onPress={onNew}
        style={({ pressed }) => [
          styles.newButton,
          !ready && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.newButtonIcon}>＋</Text>
        <Text style={styles.newButtonText}>New all-around</Text>
      </Pressable>

      {errorMessage === undefined ? null : (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {errorMessage}
        </Text>
      )}

      <ScrollView
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        style={[styles.list, scrollbarStyle]}
      >
        {!ready ? <Text style={styles.emptyText}>Opening your local workspaces…</Text> : null}
        {ready && allArounds.length === 0 ? (
          <Text style={styles.emptyText}>Create an all-around to start building.</Text>
        ) : null}
        {allArounds.map((item) => {
          const active = item.id === library.activeAllAroundId;
          const editing = item.id === editingId;
          const renameValid = libraryNameIsAvailable(library, renameName, item.id);
          return (
            <View key={item.id} style={[styles.item, active && styles.activeItem]}>
              {editing ? (
                <>
                  <TextInput
                    accessibilityLabel={`Rename ${item.name}`}
                    autoFocus
                    maxLength={MAX_LIBRARY_NAME_LENGTH}
                    onChangeText={(next) => {
                      setRenameName(next);
                      setRenameSubmitted(false);
                    }}
                    onSubmitEditing={() => submitRename(item)}
                    selectTextOnFocus
                    style={styles.renameInput}
                    value={renameName}
                  />
                  {renameSubmitted && !renameValid ? (
                    <Text accessibilityRole="alert" style={styles.renameError}>
                      {normalizeLibraryName(renameName).length === 0
                        ? 'Enter a name.'
                        : 'That name is already used.'}
                    </Text>
                  ) : null}
                  <View style={styles.editActions}>
                    <MiniButton label="Cancel" onPress={() => setEditingId(undefined)} />
                    <MiniButton label="Save" onPress={() => submitRename(item)} primary />
                  </View>
                </>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onSelect(item.id)}
                    style={({ pressed }) => [styles.itemMain, pressed && styles.pressed]}
                  >
                    <View style={[styles.itemMark, active && styles.activeItemMark]}>
                      <Text style={[styles.itemMarkText, active && styles.activeItemMarkText]}>
                        AA
                      </Text>
                    </View>
                    <View style={styles.itemCopy}>
                      <Text numberOfLines={2} style={styles.itemName}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {active ? 'Currently editing' : `Updated ${formatDate(item.updatedAt)}`} ·{' '}
                        {Object.keys(item.state.routineScoringOverrides).length
                          ? 'Mixed rulesets'
                          : profileLabel(item.state.defaultScoringProfile)}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={styles.itemActions}>
                    <MiniButton label="Rename" onPress={() => beginRename(item)} />
                    <MiniButton danger label="Delete" onPress={() => setDeleting(item)} />
                  </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        onPress={onOpenCatalogue}
        style={({ pressed }) => [styles.catalogueButton, pressed && styles.pressed]}
      >
        <Text style={styles.catalogueIcon}>▤</Text>
        <View style={styles.catalogueCopy}>
          <Text style={styles.catalogueTitle}>Routine catalogue</Text>
          <Text style={styles.catalogueSubtitle}>Save and reuse individual events</Text>
        </View>
      </Pressable>
    </View>
  );

  return (
    <>
      {compact ? (
        <Modal
          accessibilityLabel="All-around navigation"
          animationType="fade"
          onRequestClose={onClose}
          presentationStyle="overFullScreen"
          transparent
          visible={visible}
        >
          <View style={styles.drawerLayer}>
            <Pressable
              accessibilityLabel="Close all-around navigation"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.scrim}
            />
            {panel}
          </View>
        </Modal>
      ) : (
        panel
      )}

      <Modal
        accessibilityLabel="Delete all-around"
        animationType="fade"
        onRequestClose={() => setDeleting(undefined)}
        presentationStyle="overFullScreen"
        transparent
        visible={deleting !== undefined}
      >
        <View style={styles.confirmLayer}>
          <Pressable
            accessibilityLabel="Cancel deleting all-around"
            accessibilityRole="button"
            onPress={() => setDeleting(undefined)}
            style={styles.confirmScrim}
          />
          <View accessibilityViewIsModal style={styles.confirmCard}>
            <Text style={styles.confirmEyebrow}>DELETE ALL-AROUND</Text>
            <Text style={styles.confirmTitle}>Delete “{deleting?.name}”?</Text>
            <Text style={styles.confirmCopy}>
              This removes the all-around and its six event workspaces from this device. Catalogue
              routines are not affected.
            </Text>
            <View style={styles.confirmActions}>
              <MiniButton label="Cancel" onPress={() => setDeleting(undefined)} />
              <MiniButton
                danger
                label="Delete"
                onPress={() => {
                  if (deleting !== undefined) onDelete(deleting.id);
                  setDeleting(undefined);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function MiniButton({
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
        styles.miniButton,
        primary && styles.miniButtonPrimary,
        danger && styles.miniButtonDanger,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.miniButtonText,
          primary && styles.miniButtonPrimaryText,
          danger && styles.miniButtonDangerText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function saveStatusLabel(status: WorkspaceSaveStatus): string {
  switch (status) {
    case 'error':
      return 'Unable to save locally';
    case 'loading':
      return 'Opening local workspaces…';
    case 'saving':
      return 'Saving changes…';
    case 'saved':
      return 'All changes saved locally';
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
    : 'recently';
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    activeItem: {
      backgroundColor: colors.accentMuted,
      borderColor: colors.accent,
    },
    activeItemMark: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    activeItemMarkText: {
      color: colors.surface,
    },
    catalogueButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      margin: 12,
      padding: 11,
    },
    catalogueCopy: { flex: 1 },
    catalogueIcon: { color: colors.accent, fontSize: 17, fontWeight: '900' },
    catalogueSubtitle: { color: colors.muted, fontSize: 8, marginTop: 2 },
    catalogueTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' },
    closeButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    closeText: { color: colors.ink, fontSize: 22, lineHeight: 23 },
    compactPanel: {
      bottom: 0,
      left: 0,
      maxWidth: 360,
      position: 'absolute',
      top: 0,
      width: '88%',
      zIndex: 2,
    },
    confirmActions: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'flex-end',
      marginTop: 18,
    },
    confirmCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.large,
      borderWidth: 1,
      maxWidth: 440,
      padding: 20,
      width: '90%',
      zIndex: 2,
    },
    confirmCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
    confirmEyebrow: {
      color: colors.danger,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1,
    },
    confirmLayer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 16,
    },
    confirmScrim: {
      backgroundColor: 'rgba(4, 10, 23, 0.72)',
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    confirmTitle: {
      color: colors.navy,
      fontSize: 19,
      fontWeight: '900',
      marginTop: 5,
    },
    disabled: { opacity: 0.4 },
    drawerLayer: { flex: 1 },
    editActions: { flexDirection: 'row', gap: 6, justifyContent: 'flex-end', marginTop: 8 },
    emptyText: { color: colors.muted, fontSize: 10, lineHeight: 16, padding: 12 },
    errorText: {
      color: colors.danger,
      fontSize: 9,
      lineHeight: 14,
      paddingHorizontal: 14,
      paddingTop: 8,
    },
    eyebrow: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
    header: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
      padding: 16,
      paddingBottom: 10,
    },
    headingCopy: { flex: 1 },
    item: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      padding: 9,
    },
    itemActions: { flexDirection: 'row', gap: 5, justifyContent: 'flex-end', marginTop: 5 },
    itemCopy: { flex: 1, minWidth: 0 },
    itemMain: { alignItems: 'center', flexDirection: 'row', gap: 9 },
    itemMark: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 9,
      borderWidth: 1,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    itemMarkText: { color: colors.muted, fontSize: 9, fontWeight: '900' },
    itemMeta: { color: colors.muted, fontSize: 8, marginTop: 3 },
    itemName: { color: colors.ink, fontSize: 11, fontWeight: '800', lineHeight: 15 },
    list: { flex: 1 },
    listContent: { gap: 7, padding: 12, paddingTop: 8 },
    miniButton: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 7,
      borderWidth: 1,
      minHeight: 28,
      paddingHorizontal: 8,
      justifyContent: 'center',
    },
    miniButtonDanger: { backgroundColor: colors.dangerMuted, borderColor: colors.danger },
    miniButtonDangerText: { color: colors.danger },
    miniButtonPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
    miniButtonPrimaryText: { color: colors.surface },
    miniButtonText: { color: colors.ink, fontSize: 8, fontWeight: '800' },
    newButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: radii.small,
      flexDirection: 'row',
      gap: 7,
      justifyContent: 'center',
      marginHorizontal: 12,
      minHeight: 40,
      paddingHorizontal: 12,
    },
    newButtonIcon: { color: colors.surface, fontSize: 17, fontWeight: '700' },
    newButtonText: { color: colors.surface, fontSize: 10, fontWeight: '900' },
    panel: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.large,
      borderWidth: 1,
      maxHeight: 720,
      minHeight: 430,
      overflow: 'hidden',
      width: 240,
    },
    pressed: { opacity: 0.68 },
    renameError: { color: colors.danger, fontSize: 8, marginTop: 5 },
    renameInput: {
      backgroundColor: colors.surface,
      borderColor: colors.accent,
      borderRadius: 7,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 11,
      minHeight: 36,
      paddingHorizontal: 9,
    },
    scrim: {
      backgroundColor: 'rgba(4, 10, 23, 0.68)',
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    subtitle: { color: colors.success, fontSize: 8, marginTop: 4 },
    title: { color: colors.navy, fontSize: 19, fontWeight: '900', marginTop: 2 },
  });
}
