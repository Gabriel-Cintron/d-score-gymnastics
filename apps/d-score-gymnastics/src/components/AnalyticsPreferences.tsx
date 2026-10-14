import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { DEFAULT_CONSENT, type Consent } from '../../../../packages/telemetry/src/protocol';
import { telemetry } from '../telemetry';
import { useTheme } from '../theme';
export function AnalyticsPreferences() {
  const { colors } = useTheme();
  const [consent, setConsent] = useState<Consent>({ ...DEFAULT_CONSENT });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const refresh = () => {
      void telemetry
        .consent()
        .then(setConsent)
        .catch(() => setNotice('Analytics preferences are unavailable. Collection remains off.'));
    };
    refresh();
    return telemetry.subscribe(refresh);
  }, []);
  if (Platform.OS !== 'web') return null;
  async function update(next: Consent) {
    setBusy(true);
    try {
      await telemetry.setConsent(next);
      setConsent(next);
      setNotice('Preferences saved. Your routines stay on this device.');
    } catch {
      setNotice('Could not save analytics preferences.');
    } finally {
      setBusy(false);
    }
  }
  async function erase() {
    setBusy(true);
    try {
      await telemetry.erase();
      setNotice('Collection stopped and linked analytics deleted. Anonymous totals remain.');
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Collection stopped; deletion will retry when connected.',
      );
    } finally {
      setBusy(false);
    }
  }
  const button = (label: string, onPress: () => void, checked?: boolean) => (
    <Pressable
      accessibilityRole={checked === undefined ? 'button' : 'switch'}
      aria-checked={checked}
      {...(checked === undefined ? {} : { accessibilityState: { checked } })}
      disabled={busy || !telemetry.available}
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 12,
        minHeight: 44,
      }}
    >
      <Text style={{ color: colors.ink }}>
        {label}
        {checked === undefined ? '' : checked ? ' · On' : ' · Off'}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.muted }}>
        Both options start off. Usage measures visits and returning browser profiles. Search
        diagnostics sends short search terms and selections to help improve aliases. We never upload
        routines or scores. Sanitization cannot remove every possible personal detail; keep personal
        information out of searches.
      </Text>
      {!telemetry.available ? (
        <Text style={{ color: colors.muted }}>
          Collection is disabled in this preview, development build, or automated browser. Native
          collection is not enabled.
        </Text>
      ) : null}
      {button(
        'Share basic usage',
        () => void update({ ...consent, usage: !consent.usage }),
        consent.usage,
      )}
      {button(
        'Share search terms',
        () => void update({ ...consent, search: !consent.search }),
        consent.search,
      )}
      {button(
        'Owner test mode',
        () => void update({ ...consent, owner: !consent.owner }),
        consent.owner,
      )}
      {button('Stop collection and delete linked analytics', () => void erase())}
      <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>
        {notice ||
          'Random identifiers and analytics queues are separate from your routine backups.'}
      </Text>
    </View>
  );
}
