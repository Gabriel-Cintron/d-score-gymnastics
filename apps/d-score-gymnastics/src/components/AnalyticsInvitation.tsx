import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { telemetry } from '../telemetry';
import { useTheme } from '../theme';
export function AnalyticsInvitation({
  visible,
  onSettings,
}: {
  visible: boolean;
  onSettings: () => void;
}) {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!telemetry.available) return;
    const refresh = () =>
      void telemetry
        .invitation()
        .then(setShow)
        .catch(() => setShow(false));
    refresh();
    return telemetry.subscribe(refresh);
  }, []);
  if (!visible || !show || !telemetry.available) return null;
  const dismiss = () => {
    setShow(false);
    void telemetry.dismissInvitation().catch(() => undefined);
  };
  const button = (label: string, action: () => void) => (
    <Pressable
      accessibilityRole="button"
      onPress={action}
      style={{
        padding: 12,
        minHeight: 44,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
      }}
    >
      <Text style={{ color: colors.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    <View
      style={{ padding: 16, gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}
    >
      <Text style={{ color: colors.ink, fontWeight: '700' }}>Help improve D-Score?</Text>
      <Text style={{ color: colors.muted }}>
        Optional basic usage counts visits and searches without routines, scores or search text.
        Both analytics choices start off. Search-term sharing is a separate choice in Settings.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {button('Allow basic usage', () => {
          void telemetry
            .setConsent({ usage: true, search: false, owner: false })
            .then(dismiss)
            .catch(() => undefined);
        })}
        {button('No thanks', dismiss)}
        {button('Review choices', () => {
          dismiss();
          onSettings();
        })}
      </View>
    </View>
  );
}
