import { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type PointerEvent as NativePointerEvent,
  type ViewStyle,
} from 'react-native';

import { clampDifficulty, difficultyAfterDrag, difficultyAtTrackOffset } from '../difficulty-range';
import { radii, useTheme, type ThemeColors } from '../theme';

interface DifficultyRangeSliderProps {
  readonly lowerValue: number;
  readonly maximum: number;
  readonly minimum: number;
  readonly onLowerValueChange: (value: number) => void;
  readonly onUpperValueChange: (value: number) => void;
  readonly upperValue: number;
}

type SliderThumb = 'lower' | 'upper';

interface WebKeyboardEvent {
  readonly key: string;
  readonly preventDefault: () => void;
}

interface WebPointerTarget {
  readonly closest?: (selector: string) => unknown;
}

interface WebTrackElement {
  readonly getBoundingClientRect: () => { readonly left: number; readonly width: number };
  readonly hasPointerCapture?: (pointerId: number) => boolean;
  readonly releasePointerCapture?: (pointerId: number) => void;
  readonly setPointerCapture?: (pointerId: number) => void;
}

type WebTrackStyle = ViewStyle & {
  readonly touchAction: 'none';
  readonly userSelect: 'none';
};

const ACCESSIBILITY_ACTIONS = [
  { label: 'Increase difficulty', name: 'increment' as const },
  { label: 'Decrease difficulty', name: 'decrement' as const },
];

const WEB_TRACK_STYLE: WebTrackStyle | undefined =
  Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none' } as const) : undefined;

export function DifficultyRangeSlider({
  lowerValue,
  maximum,
  minimum,
  onLowerValueChange,
  onUpperValueChange,
  upperValue,
}: DifficultyRangeSliderProps) {
  const styles = useStyles();
  const [activeThumb, setActiveThumb] = useState<SliderThumb>();
  const [trackWidth, setTrackWidth] = useState(0);
  const lower = clampDifficulty(lowerValue, minimum, maximum);
  const upper = clampDifficulty(upperValue, lower, maximum);
  const lowerStart = useRef(lower);
  const upperStart = useRef(upper);
  const currentLower = useRef(lower);
  const currentUpper = useRef(upper);
  const activePointerId = useRef<number | undefined>(undefined);
  const activePointerThumb = useRef<SliderThumb | undefined>(undefined);

  currentLower.current = lower;
  currentUpper.current = upper;

  const lowerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          lowerStart.current = lower;
          setActiveThumb('lower');
        },
        onPanResponderMove: (_, gesture) => {
          const next = clampDifficulty(
            difficultyAfterDrag(lowerStart.current, gesture.dx, trackWidth, minimum, maximum),
            minimum,
            upper,
          );
          if (next !== lower) onLowerValueChange(next);
        },
        onPanResponderRelease: () => setActiveThumb(undefined),
        onPanResponderTerminate: () => setActiveThumb(undefined),
        onStartShouldSetPanResponder: () => true,
      }),
    [lower, maximum, minimum, onLowerValueChange, trackWidth, upper],
  );
  const upperPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          upperStart.current = upper;
          setActiveThumb('upper');
        },
        onPanResponderMove: (_, gesture) => {
          const next = clampDifficulty(
            difficultyAfterDrag(upperStart.current, gesture.dx, trackWidth, minimum, maximum),
            lower,
            maximum,
          );
          if (next !== upper) onUpperValueChange(next);
        },
        onPanResponderRelease: () => setActiveThumb(undefined),
        onPanResponderTerminate: () => setActiveThumb(undefined),
        onStartShouldSetPanResponder: () => true,
      }),
    [lower, maximum, minimum, onUpperValueChange, trackWidth, upper],
  );
  const lowerProgress = progressForDifficulty(lower, minimum, maximum);
  const upperProgress = progressForDifficulty(upper, minimum, maximum);
  const lowerAccessibilityValue = difficultyAccessibilityValue(lower, minimum, upper);
  const upperAccessibilityValue = difficultyAccessibilityValue(upper, lower, maximum);

  function selectNearestBoundary(event: GestureResponderEvent): void {
    const next = difficultyAtTrackOffset(event.nativeEvent.locationX, trackWidth, minimum, maximum);
    if (Math.abs(next - lower) <= Math.abs(next - upper)) {
      onLowerValueChange(clampDifficulty(next, minimum, upper));
    } else {
      onUpperValueChange(clampDifficulty(next, lower, maximum));
    }
  }

  function updateWebThumb(thumb: SliderThumb, nextValue: number): void {
    if (thumb === 'lower') {
      const next = clampDifficulty(nextValue, minimum, currentUpper.current);
      if (next === currentLower.current) return;
      currentLower.current = next;
      onLowerValueChange(next);
      return;
    }

    const next = clampDifficulty(nextValue, currentLower.current, maximum);
    if (next === currentUpper.current) return;
    currentUpper.current = next;
    onUpperValueChange(next);
  }

  function difficultyForWebPointer(event: NativePointerEvent): number {
    const track = event.currentTarget as unknown as WebTrackElement;
    const bounds = track.getBoundingClientRect();
    return difficultyAtTrackOffset(
      event.nativeEvent.clientX - bounds.left,
      bounds.width,
      minimum,
      maximum,
    );
  }

  function beginWebPointer(event: NativePointerEvent): void {
    if (Platform.OS !== 'web' || event.nativeEvent.button !== 0) return;

    event.preventDefault();
    const next = difficultyForWebPointer(event);
    const target = event.target as unknown as WebPointerTarget;
    const thumb = target.closest?.('[aria-label="Minimum Vault difficulty"]')
      ? 'lower'
      : target.closest?.('[aria-label="Maximum Vault difficulty"]')
        ? 'upper'
        : Math.abs(next - currentLower.current) <= Math.abs(next - currentUpper.current)
          ? 'lower'
          : 'upper';

    activePointerId.current = event.nativeEvent.pointerId;
    activePointerThumb.current = thumb;
    setActiveThumb(thumb);
    updateWebThumb(thumb, next);

    const track = event.currentTarget as unknown as WebTrackElement;
    try {
      track.setPointerCapture?.(event.nativeEvent.pointerId);
    } catch {
      // Synthetic pointer events may not be capturable; normal browser pointers are.
    }
  }

  function moveWebPointer(event: NativePointerEvent): void {
    if (
      Platform.OS !== 'web' ||
      activePointerThumb.current === undefined ||
      activePointerId.current !== event.nativeEvent.pointerId
    ) {
      return;
    }

    event.preventDefault();
    updateWebThumb(activePointerThumb.current, difficultyForWebPointer(event));
  }

  function endWebPointer(event: NativePointerEvent): void {
    if (Platform.OS !== 'web' || activePointerId.current !== event.nativeEvent.pointerId) return;

    event.preventDefault();
    const track = event.currentTarget as unknown as WebTrackElement;
    try {
      if (track.hasPointerCapture?.(event.nativeEvent.pointerId)) {
        track.releasePointerCapture?.(event.nativeEvent.pointerId);
      }
    } catch {
      // The browser may already have released capture after a cancelled pointer.
    }
    activePointerId.current = undefined;
    activePointerThumb.current = undefined;
    setActiveThumb(undefined);
  }

  function adjustThumb(thumb: SliderThumb, event: AccessibilityActionEvent): void {
    const { actionName } = event.nativeEvent;
    if (actionName !== 'increment' && actionName !== 'decrement') return;
    const delta = actionName === 'increment' ? 1 : -1;
    if (thumb === 'lower') {
      onLowerValueChange(clampDifficulty(lower + delta, minimum, upper));
    } else {
      onUpperValueChange(clampDifficulty(upper + delta, lower, maximum));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.valueRow}>
        <RangeValue label="From" value={lower} />
        <Text style={styles.valueSeparator}>to</Text>
        <RangeValue label="To" value={upper} />
      </View>

      <View
        onLayout={({ nativeEvent }) => setTrackWidth(nativeEvent.layout.width)}
        onPointerCancel={Platform.OS === 'web' ? endWebPointer : undefined}
        onPointerDown={Platform.OS === 'web' ? beginWebPointer : undefined}
        onPointerMove={Platform.OS === 'web' ? moveWebPointer : undefined}
        onPointerUp={Platform.OS === 'web' ? endWebPointer : undefined}
        style={[styles.trackArea, WEB_TRACK_STYLE]}
      >
        <Pressable
          accessibilityLabel="Set Vault difficulty range"
          onPress={Platform.OS === 'web' ? undefined : selectNearestBoundary}
          style={styles.trackPressTarget}
        >
          <View style={styles.track} />
          <View
            style={[
              styles.selectedTrack,
              { left: `${lowerProgress}%`, right: `${100 - upperProgress}%` },
            ]}
          />
        </Pressable>

        <Pressable
          {...(Platform.OS === 'web' ? {} : lowerPanResponder.panHandlers)}
          {...webKeyboardProps(lower, minimum, upper, onLowerValueChange)}
          aria-valuemax={lowerAccessibilityValue.max}
          aria-valuemin={lowerAccessibilityValue.min}
          aria-valuenow={lowerAccessibilityValue.now}
          aria-valuetext={lowerAccessibilityValue.text}
          accessibilityActions={ACCESSIBILITY_ACTIONS}
          accessibilityLabel="Minimum Vault difficulty"
          accessibilityRole="adjustable"
          accessibilityValue={lowerAccessibilityValue}
          hitSlop={8}
          onAccessibilityAction={(event) => adjustThumb('lower', event)}
          style={[
            styles.thumbTarget,
            { left: `${lowerProgress}%` },
            activeThumb === 'lower' && styles.activeThumbTarget,
          ]}
        >
          <View style={[styles.thumb, activeThumb === 'lower' && styles.activeThumb]} />
        </Pressable>
        <Pressable
          {...(Platform.OS === 'web' ? {} : upperPanResponder.panHandlers)}
          {...webKeyboardProps(upper, lower, maximum, onUpperValueChange)}
          aria-valuemax={upperAccessibilityValue.max}
          aria-valuemin={upperAccessibilityValue.min}
          aria-valuenow={upperAccessibilityValue.now}
          aria-valuetext={upperAccessibilityValue.text}
          accessibilityActions={ACCESSIBILITY_ACTIONS}
          accessibilityLabel="Maximum Vault difficulty"
          accessibilityRole="adjustable"
          accessibilityValue={upperAccessibilityValue}
          hitSlop={8}
          onAccessibilityAction={(event) => adjustThumb('upper', event)}
          style={[
            styles.thumbTarget,
            { left: `${upperProgress}%` },
            activeThumb === 'upper' && styles.activeThumbTarget,
          ]}
        >
          <View style={[styles.thumb, activeThumb === 'upper' && styles.activeThumb]} />
        </Pressable>
      </View>

      <View style={styles.limitRow}>
        <Text style={styles.limitText}>{formatDifficulty(minimum)}</Text>
        <Text style={styles.stepText}>SNAPS BY 0.1</Text>
        <Text style={styles.limitText}>{formatDifficulty(maximum)}</Text>
      </View>
    </View>
  );
}

function RangeValue({ label, value }: { readonly label: string; readonly value: number }) {
  const styles = useStyles();
  return (
    <View style={styles.valueCard}>
      <Text style={styles.valueLabel}>{label}</Text>
      <Text style={styles.valueText}>{formatDifficulty(value)}</Text>
    </View>
  );
}

function progressForDifficulty(value: number, minimum: number, maximum: number): number {
  return maximum === minimum ? 0 : ((value - minimum) / (maximum - minimum)) * 100;
}

function difficultyAccessibilityValue(value: number, minimum: number, maximum: number) {
  return {
    max: maximum / 10,
    min: minimum / 10,
    now: value / 10,
    text: `${formatDifficulty(value)} difficulty`,
  };
}

function webKeyboardProps(
  value: number,
  minimum: number,
  maximum: number,
  onChange: (value: number) => void,
): { readonly onKeyDown?: (event: WebKeyboardEvent) => void } {
  if (Platform.OS !== 'web') return {};
  return {
    onKeyDown: (event) => {
      let next: number;
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowLeft':
          next = value - 1;
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          next = value + 1;
          break;
        case 'End':
          next = maximum;
          break;
        case 'Home':
          next = minimum;
          break;
        default:
          return;
      }
      event.preventDefault();
      onChange(clampDifficulty(next, minimum, maximum));
    },
  };
}

function formatDifficulty(value: number): string {
  return (value / 10).toFixed(1);
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    activeThumb: {
      borderColor: colors.accentDark,
      transform: [{ scale: 1.08 }],
    },
    activeThumbTarget: {
      zIndex: 4,
    },
    container: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.small,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    limitRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: -1,
    },
    limitText: {
      color: colors.muted,
      fontSize: 9,
      fontWeight: '700',
    },
    selectedTrack: {
      backgroundColor: colors.accent,
      borderRadius: 3,
      height: 5,
      position: 'absolute',
      top: 16,
    },
    stepText: {
      color: colors.muted,
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    thumb: {
      backgroundColor: colors.surface,
      borderColor: colors.accent,
      borderRadius: 10,
      borderWidth: 3,
      height: 20,
      width: 20,
    },
    thumbTarget: {
      alignItems: 'center',
      height: 36,
      justifyContent: 'center',
      marginLeft: -18,
      position: 'absolute',
      top: 0,
      width: 36,
      zIndex: 3,
    },
    track: {
      backgroundColor: colors.border,
      borderRadius: 3,
      height: 5,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 16,
    },
    trackArea: {
      height: 36,
      marginHorizontal: 8,
      marginTop: 7,
      position: 'relative',
    },
    trackPressTarget: {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    valueCard: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 7,
      flex: 1,
      minHeight: 39,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    valueLabel: {
      color: colors.muted,
      fontSize: 8,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    valueRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    valueSeparator: {
      color: colors.muted,
      fontSize: 10,
    },
    valueText: {
      color: colors.ink,
      fontSize: 13,
      fontWeight: '900',
      marginTop: 1,
    },
  });
}
