import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { profileKey, sameProfile, type ScoringProfileRef } from '@d-score-gymnastics/rulesets';
import { profileDefinitions, profileLabel } from '../ruleset';
import { useTheme } from '../theme';
interface Props {
  readonly scope: 'routine' | 'all-around';
  readonly current: ScoringProfileRef;
  readonly defaultProfile: ScoringProfileRef;
  readonly overridden?: boolean;
  readonly disabled?: boolean;
  readonly onApply: (ref: ScoringProfileRef | undefined) => void;
}
export function RulesetControl({
  scope,
  current,
  defaultProfile,
  overridden = false,
  disabled = false,
  onApply,
}: Props) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [choice, setChoice] = useState<ScoringProfileRef>();
  const title = scope === 'routine' ? 'Routine ruleset' : 'All-around default ruleset';
  const control = {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 44,
    justifyContent: 'center' as const,
  };
  const selectable =
    choice === undefined
      ? scope === 'routine'
      : profileDefinitions.some((p) => p.status === 'complete' && sameProfile(p.ref, choice));
  return (
    <View style={{ marginBottom: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${profileLabel(current)}`}
        disabled={disabled}
        onPress={() => {
          setChoice(scope === 'routine' && !overridden ? undefined : current);
          setVisible(true);
        }}
        style={[control, { backgroundColor: colors.surface, opacity: disabled ? 0.5 : 1 }]}
      >
        <Text style={{ color: colors.ink, fontWeight: '700' }}>
          {title}: {profileLabel(current)} ▾
        </Text>
        {scope === 'routine' ? (
          <Text style={{ color: colors.muted }}>
            {overridden ? 'Individual override' : 'From all-around default'}
          </Text>
        ) : null}
      </Pressable>
      <Modal
        accessibilityLabel={title}
        visible={visible}
        transparent
        animationType={Platform.OS === 'web' ? 'none' : 'fade'}
        onRequestClose={() => setVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0009' }}>
          <View
            accessibilityViewIsModal
            style={{
              maxHeight: '90%',
              borderRadius: 16,
              padding: 20,
              backgroundColor: colors.surface,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{ color: colors.ink, fontSize: 22, fontWeight: '700', marginBottom: 10 }}
            >
              {title}
            </Text>
            {scope === 'all-around' ? (
              <Text style={{ color: colors.muted, marginBottom: 12 }}>
                Applies to all six routines and replaces individual overrides.
              </Text>
            ) : null}
            <ScrollView
              accessibilityRole="radiogroup"
              accessibilityLabel={title}
              keyboardShouldPersistTaps="handled"
            >
              {scope === 'routine' ? (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: choice === undefined }}
                  aria-checked={choice === undefined}
                  {...radioKeyboard(() => setChoice(undefined))}
                  onPress={() => setChoice(undefined)}
                  style={[control, { marginBottom: 8 }]}
                >
                  <Text style={{ color: colors.ink }}>
                    {choice === undefined ? '● ' : '○ '}Use all-around default
                  </Text>
                  <Text style={{ color: colors.muted }}>{profileLabel(defaultProfile)}</Text>
                </Pressable>
              ) : null}
              {profileDefinitions.map((profile) => {
                const checked = choice !== undefined && sameProfile(choice, profile.ref),
                  unavailable = profile.status !== 'complete';
                return (
                  <Pressable
                    key={profileKey(profile.ref)}
                    accessibilityRole="radio"
                    accessibilityLabel={profile.label}
                    accessibilityState={{ checked, disabled: unavailable }}
                    aria-checked={checked}
                    aria-disabled={unavailable}
                    {...(unavailable ? {} : radioKeyboard(() => setChoice(profile.ref)))}
                    disabled={unavailable}
                    onPress={() => setChoice(profile.ref)}
                    style={[
                      control,
                      { marginBottom: 8, borderColor: checked ? colors.accent : colors.border },
                    ]}
                  >
                    <Text style={{ color: colors.ink, fontWeight: '600' }}>
                      {checked ? '● ' : '○ '}
                      {profile.label}
                    </Text>
                    <Text style={{ color: colors.muted }}>
                      {unavailable
                        ? profile.unavailableReason
                        : `Revision ${profile.ref.revision} · Sources through ${profile.sourceCutoff}`}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setVisible(false)}
                style={control}
              >
                <Text style={{ color: colors.ink }}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!selectable}
                onPress={() => {
                  onApply(choice);
                  setVisible(false);
                }}
                style={[control, { opacity: selectable ? 1 : 0.5 }]}
              >
                <Text style={{ color: colors.ink, fontWeight: '700' }}>
                  {scope === 'routine' ? 'Apply to this routine' : 'Apply to all six'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function radioKeyboard(select: () => void) {
  return Platform.OS === 'web'
    ? {
        onKeyDown: (event: { key: string; preventDefault(): void; currentTarget: HTMLElement }) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            select();
          } else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) {
            event.preventDefault();
            const options = Array.from(
              event.currentTarget
                .closest('[role="radiogroup"]')
                ?.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])') ?? [],
            );
            const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
            const next =
              options[
                (options.indexOf(event.currentTarget) + direction + options.length) % options.length
              ];
            next?.focus();
            next?.click();
          }
        },
      }
    : {};
}
