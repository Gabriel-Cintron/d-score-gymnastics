import { useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { chooseBackupTextFile } from '../backup-transport';
import { INDEPENDENCE_NOTICE, PRODUCT_NAME, PRODUCT_URLS, PRODUCT_VERSION } from '../product';
import type { PwaInstallAvailability, PwaInstallResult } from '../pwa';
import {
  radii,
  useTheme,
  useThemedScrollbarStyle,
  type ThemeColors,
  type ThemeMode,
} from '../theme';
import { AnalyticsPreferences } from './AnalyticsPreferences';
import { ConfirmationModal } from './ConfirmationModal';

interface RulesetSummary {
  readonly authoritativeRulesUrl: string;
  readonly officialPublicationCutoff: string;
  readonly dataVersion: string;
  readonly elementCount: number;
  readonly status: string;
}

interface SettingsScreenProps {
  readonly installAvailability: PwaInstallAvailability;
  readonly onClearLocalData: () => Promise<void>;
  readonly onExportBackup: () => Promise<void>;
  readonly onInstall: () => Promise<PwaInstallResult>;
  readonly onReplayTour: () => void;
  readonly onRestoreBackup: (text: string) => Promise<boolean>;
  readonly onThemeModeChange: (mode: ThemeMode) => void;
  readonly ready: boolean;
  readonly persistent: boolean;
  readonly ruleset: RulesetSummary;
  readonly themeMode: ThemeMode;
}

interface Notice {
  readonly kind: 'error' | 'success';
  readonly text: string;
}

export function SettingsScreen({
  installAvailability,
  onClearLocalData,
  onExportBackup,
  onInstall,
  onReplayTour,
  onRestoreBackup,
  onThemeModeChange,
  ready,
  persistent,
  ruleset,
  themeMode,
}: SettingsScreenProps) {
  const styles = useStyles();
  const [busy, setBusy] = useState(false);
  const [clearVisible, setClearVisible] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const [restoreError, setRestoreError] = useState<string>();
  const [restoreText, setRestoreText] = useState('');
  const [restoreVisible, setRestoreVisible] = useState(false);

  async function exportBackup(): Promise<void> {
    setBusy(true);
    setNotice(undefined);
    try {
      await onExportBackup();
      setNotice({
        kind: 'success',
        text: Platform.OS === 'web' ? 'Backup downloaded.' : 'Backup opened in the share sheet.',
      });
    } catch {
      setNotice({
        kind: 'error',
        text: `${PRODUCT_NAME} could not create a backup on this device.`,
      });
    } finally {
      setBusy(false);
    }
  }

  async function chooseBackup(): Promise<void> {
    setBusy(true);
    setNotice(undefined);
    try {
      const text = await chooseBackupTextFile();
      if (text !== undefined) {
        setRestoreText(text);
        setRestoreError(undefined);
        setRestoreVisible(true);
      }
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'That backup file could not be opened.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function restoreBackup(): Promise<void> {
    setBusy(true);
    setNotice(undefined);
    setRestoreError(undefined);
    try {
      const restored = await onRestoreBackup(restoreText);
      if (!restored) {
        setRestoreError(`That file is not a valid backup for this ${PRODUCT_NAME} ruleset.`);
        return;
      }
      setRestoreText('');
      setRestoreVisible(false);
      setNotice({ kind: 'success', text: 'Backup restored. Your Home workspace is ready.' });
    } catch {
      setRestoreError('The backup was valid, but it could not be restored.');
    } finally {
      setBusy(false);
    }
  }

  async function clearLocalData(): Promise<void> {
    setClearVisible(false);
    setBusy(true);
    setNotice(undefined);
    try {
      await onClearLocalData();
      setNotice({ kind: 'success', text: 'Local routines and settings were cleared.' });
    } catch {
      setNotice({
        kind: 'error',
        text: `${PRODUCT_NAME} could not clear all local data.`,
      });
    } finally {
      setBusy(false);
    }
  }

  async function installApp(): Promise<void> {
    const result = await onInstall();
    setNotice(
      result === 'accepted'
        ? { kind: 'success', text: `${PRODUCT_NAME} is installed on this device.` }
        : result === 'dismissed'
          ? { kind: 'error', text: 'Installation was dismissed. You can try again later.' }
          : result === 'instructions'
            ? {
                kind: 'success',
                text: 'On iPhone or iPad, use Safari Share > Add to Home Screen. On macOS Safari, use File > Add to Dock. Other browsers offer Install app in their menu.',
              }
            : { kind: 'error', text: 'Installation is not available on this device.' },
    );
  }

  async function reportProblem(): Promise<void> {
    await openProductPage(PRODUCT_URLS.issues, 'The issue tracker');
  }

  async function openProductPage(url: string, label: string): Promise<void> {
    try {
      await Linking.openURL(url);
    } catch {
      setNotice({ kind: 'error', text: `${label} could not be opened on this device.` });
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>APP PREFERENCES</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.introCopy}>
          Manage appearance, protect your local routines, and review the rules data behind every
          score.
        </Text>
      </View>

      {notice === undefined ? null : (
        <Text
          accessibilityRole="alert"
          style={[
            styles.notice,
            notice.kind === 'error' ? styles.noticeError : styles.noticeSuccess,
          ]}
        >
          {notice.text}
        </Text>
      )}

      <View style={styles.grid}>
        <SettingsCard
          copy={`Choose the appearance used throughout ${PRODUCT_NAME}.`}
          title="Appearance"
        >
          <View style={styles.segmentedControl}>
            {(['light', 'dark'] as const).map((mode) => (
              <Pressable
                accessibilityRole="button"
                key={mode}
                onPress={() => onThemeModeChange(mode)}
                style={({ pressed }) => [
                  styles.segment,
                  themeMode === mode && styles.segmentSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.segmentText, themeMode === mode && styles.segmentTextSelected]}
                >
                  {mode === 'light' ? '☀  Light' : '☾  Dark'}
                </Text>
              </Pressable>
            ))}
          </View>
        </SettingsCard>

        {Platform.OS === 'web' ? (
          <SettingsCard
            copy={`Install ${PRODUCT_NAME} for a focused app window and reliable offline access after the first load.`}
            title={`Install ${PRODUCT_NAME}`}
          >
            <SettingsButton
              disabled={installAvailability === 'installed'}
              label={
                installAvailability === 'installed'
                  ? 'Installed'
                  : installAvailability === 'prompt'
                    ? `Install ${PRODUCT_NAME}`
                    : 'Installation steps'
              }
              onPress={() => void installApp()}
              primary={installAvailability === 'prompt'}
            />
          </SettingsCard>
        ) : null}

        <SettingsCard
          copy="Export one versioned file containing your all-arounds, saved routines, editor state, and preferences."
          title="Backup and restore"
        >
          <View style={styles.buttonRow}>
            <SettingsButton
              disabled={busy || !ready}
              label="Export backup"
              onPress={exportBackup}
              primary
            />
            {Platform.OS === 'web' ? (
              <SettingsButton
                disabled={busy || !ready}
                label="Choose backup file"
                onPress={chooseBackup}
              />
            ) : null}
            <SettingsButton
              disabled={busy || !ready}
              label="Paste backup"
              onPress={() => {
                setRestoreText('');
                setRestoreError(undefined);
                setRestoreVisible(true);
              }}
            />
          </View>
          <Text style={styles.helperText}>
            {ready
              ? 'Restoring replaces the local workspace only after the file passes validation and you confirm the action.'
              : 'Opening local data…'}
          </Text>
        </SettingsCard>

        {Platform.OS === 'web' ? (
          <SettingsCard
            title="Help improve D-Score"
            copy="Optional, privacy-conscious usage and search diagnostics."
          >
            <AnalyticsPreferences />
          </SettingsCard>
        ) : null}

        <SettingsCard
          copy="The evaluator and catalogue are loaded from the bundled 2025–2028 MAG data package."
          title="Scoring rules"
        >
          <View style={styles.rulesetPanel}>
            <SettingsRow label="Ruleset" value="FIG MAG Senior · 2025–2028" />
            <SettingsRow label="Data version" value={ruleset.dataVersion} />
            <SettingsRow label="Source cutoff" value={ruleset.officialPublicationCutoff} />
            <SettingsRow label="Catalogue" value={`${ruleset.elementCount} elements`} />
            <SettingsRow label="Rules status" value={ruleset.status.toLocaleUpperCase('en-US')} />
          </View>
          <Text style={styles.warningText}>
            This reviewed source snapshot supports recognized-as-entered D-score planning.
            Execution, neutral deductions, and official competition decisions remain outside this
            app's scope.
          </Text>
          <View style={styles.buttonRow}>
            <SettingsButton
              label="Open official rules"
              onPress={() =>
                void openProductPage(ruleset.authoritativeRulesUrl, 'The official rules page')
              }
            />
          </View>
        </SettingsCard>

        <SettingsCard
          copy={`${PRODUCT_NAME} is a free, open-source, local-first routine planning tool. No account is required and no routine is uploaded by the app.`}
          title={`About ${PRODUCT_NAME}`}
        >
          <View style={styles.rulesetPanel}>
            <SettingsRow label="Version" value={PRODUCT_VERSION} />
            <SettingsRow label="Created by" value="Gabriel Dabin Cintron" />
            <SettingsRow label="Published by" value="Jose Gabriel Cintron" />
          </View>
          <Text style={styles.warningText}>{INDEPENDENCE_NOTICE}</Text>
          <View style={styles.buttonRow}>
            <SettingsButton label="Replay quick tour" onPress={onReplayTour} />
            <SettingsButton label="Report a problem" onPress={() => void reportProblem()} />
            <SettingsButton
              label="Support"
              onPress={() => void openProductPage(PRODUCT_URLS.support, 'Support')}
            />
            <SettingsButton
              label="Privacy"
              onPress={() => void openProductPage(PRODUCT_URLS.privacy, 'The privacy policy')}
            />
            <SettingsButton
              label="Source code"
              onPress={() => void openProductPage(PRODUCT_URLS.source, 'The source repository')}
            />
            <SettingsButton
              label="License"
              onPress={() => void openProductPage(PRODUCT_URLS.license, 'The license')}
            />
          </View>
        </SettingsCard>

        <SettingsCard
          copy="Permanently remove all locally saved all-arounds, routines, preferences, and the current editor state from this browser or device."
          title="Local routine data"
        >
          <SettingsButton
            danger
            disabled={busy || !ready || !persistent}
            label="Clear local routine data"
            onPress={() => setClearVisible(true)}
          />
        </SettingsCard>
      </View>

      <RestoreModal
        busy={busy}
        onCancel={() => {
          setRestoreVisible(false);
          setRestoreText('');
          setRestoreError(undefined);
        }}
        onChangeText={setRestoreText}
        onRestore={restoreBackup}
        {...(restoreError === undefined ? {} : { errorMessage: restoreError })}
        text={restoreText}
        visible={restoreVisible}
      />
      <ConfirmationModal
        confirmLabel="Clear everything"
        copy="This cannot be undone. Export a backup first if you may need these routines again."
        danger
        eyebrow="PERMANENT ACTION"
        onCancel={() => setClearVisible(false)}
        onConfirm={() => void clearLocalData()}
        title="Clear local routines and preferences?"
        visible={clearVisible}
      />
    </View>
  );
}

function SettingsCard({
  children,
  copy,
  title,
}: {
  readonly children: React.ReactNode;
  readonly copy: string;
  readonly title: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardCopy}>{copy}</Text>
      <View style={styles.cardContent}>{children}</View>
    </View>
  );
}

function SettingsButton({
  danger = false,
  disabled = false,
  label,
  onPress,
  primary = false,
}: {
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly primary?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primaryButton,
        danger && styles.dangerButton,
        disabled && styles.disabled,
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

function SettingsRow({ label, value }: { readonly label: string; readonly value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function RestoreModal({
  busy,
  errorMessage,
  onCancel,
  onChangeText,
  onRestore,
  text,
  visible,
}: {
  readonly busy: boolean;
  readonly errorMessage?: string;
  readonly onCancel: () => void;
  readonly onChangeText: (text: string) => void;
  readonly onRestore: () => void;
  readonly text: string;
  readonly visible: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const scrollbarStyle = useThemedScrollbarStyle();
  return (
    <Modal
      accessibilityLabel="Restore backup"
      animationType="fade"
      onRequestClose={onCancel}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View style={styles.modalLayer}>
        <Pressable
          accessibilityLabel="Cancel restore"
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.scrim}
        />
        <View accessibilityViewIsModal style={styles.modalCard}>
          <Text style={styles.eyebrow}>REPLACE LOCAL DATA</Text>
          <Text style={styles.modalTitle}>Restore {PRODUCT_NAME} backup?</Text>
          <Text style={styles.modalCopy}>
            Paste the complete backup JSON below. A valid restore replaces all current local data.
          </Text>
          <ScrollView style={[styles.restoreScroller, scrollbarStyle]}>
            <TextInput
              accessibilityLabel={`${PRODUCT_NAME} backup JSON`}
              multiline
              onChangeText={onChangeText}
              placeholder="Paste backup JSON here"
              placeholderTextColor={colors.muted}
              style={styles.restoreInput}
              value={text}
            />
          </ScrollView>
          {errorMessage === undefined ? null : (
            <Text accessibilityRole="alert" style={styles.restoreError}>
              {errorMessage}
            </Text>
          )}
          <View style={styles.modalActions}>
            <SettingsButton label="Cancel" onPress={onCancel} />
            <SettingsButton
              disabled={busy || text.trim().length === 0}
              label="Validate and restore"
              onPress={onRestore}
              primary
            />
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
    button: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 40,
      paddingHorizontal: 14,
    },
    buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    buttonText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      flexBasis: 360,
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      padding: 18,
    },
    cardContent: { marginTop: 16 },
    cardCopy: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
    cardTitle: { color: colors.navy, fontSize: 16, fontWeight: '900' },
    dangerButton: { backgroundColor: colors.dangerMuted, borderColor: colors.danger },
    dangerButtonText: { color: colors.danger },
    disabled: { opacity: 0.45 },
    eyebrow: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    helperText: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 10 },
    intro: { marginBottom: 20, maxWidth: 650 },
    introCopy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
    modalActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 16 },
    modalCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.large,
      borderWidth: 1,
      maxWidth: 620,
      padding: 20,
      width: '94%',
    },
    modalCopy: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 6 },
    modalLayer: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 16 },
    modalTitle: { color: colors.navy, fontSize: 21, fontWeight: '900', marginTop: 4 },
    notice: { borderRadius: 10, fontSize: 10, fontWeight: '700', marginBottom: 14, padding: 11 },
    noticeError: { backgroundColor: colors.dangerMuted, color: colors.danger },
    noticeSuccess: { backgroundColor: colors.successMuted, color: colors.success },
    page: { maxWidth: 1050, width: '100%' },
    pressed: { opacity: 0.68 },
    primaryButton: { backgroundColor: colors.accent, borderColor: colors.accent },
    primaryButtonText: { color: colors.onAccentMuted },
    restoreInput: {
      color: colors.ink,
      fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
      fontSize: 10,
      lineHeight: 15,
      minHeight: 180,
      padding: 12,
      textAlignVertical: 'top',
    },
    restoreError: { color: colors.danger, fontSize: 9, fontWeight: '700', marginTop: 8 },
    restoreScroller: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 14,
      maxHeight: 230,
    },
    row: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      minHeight: 36,
    },
    rowLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' },
    rowValue: { color: colors.ink, fontSize: 10, fontWeight: '800', textAlign: 'right' },
    rulesetPanel: { borderTopColor: colors.border, borderTopWidth: 1 },
    scrim: {
      backgroundColor: 'rgba(4, 12, 24, 0.64)',
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    segment: {
      alignItems: 'center',
      borderRadius: 9,
      flex: 1,
      minHeight: 42,
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    segmentedControl: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 11,
      borderWidth: 1,
      flexDirection: 'row',
      padding: 3,
    },
    segmentSelected: { backgroundColor: colors.accent },
    segmentText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
    segmentTextSelected: { color: colors.onAccentMuted },
    title: {
      color: colors.navy,
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: -0.8,
      marginTop: 4,
    },
    warningText: {
      backgroundColor: colors.warningMuted,
      borderRadius: 9,
      color: colors.warning,
      fontSize: 9,
      lineHeight: 14,
      marginTop: 12,
      padding: 10,
    },
  });
}
