import type { ApparatusId, ElementId } from '@d-score-gymnastics/scoring';
import type { CompiledElement, CompiledPommelHorseRules } from '@d-score-gymnastics/rulesets';
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

import { APPARATUS_LABELS } from '../apparatus';
import { excludeCatalogElements, searchCatalog, type CatalogMatch } from '../catalog-search';
import {
  availablePommelFlopComponents,
  completePommelFlop,
  pommelFlopCatalog,
  type CompletedPommelFlop,
} from '../flop-builder';
import { formatDifficulty, formatOfficialCode } from '../format';
import { radii, useTheme, useThemedScrollbarStyle, type ThemeColors } from '../theme';
import { CatalogFilterControls, type DifficultyFilterOption } from './CatalogFilterControls';

type PickerMode = 'element' | 'flop';

interface CatalogPickerProps {
  readonly apparatus: ApparatusId;
  readonly difficultyLetterByTenths: ReadonlyMap<number, string>;
  readonly elements: readonly CompiledElement[];
  readonly excludedElementIds: ReadonlySet<ElementId>;
  readonly onClose: () => void;
  readonly onSelect: (element: CompiledElement) => void;
  readonly onSelectFlop: (
    components: readonly CompiledElement[],
    completed: CompletedPommelFlop,
  ) => void;
  readonly pommelRules: CompiledPommelHorseRules;
  readonly visible: boolean;
}

export function CatalogPicker({
  apparatus,
  difficultyLetterByTenths,
  elements,
  excludedElementIds,
  onClose,
  onSelect,
  onSelectFlop,
  pommelRules,
  visible,
}: CatalogPickerProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const scrollbarStyle = useThemedScrollbarStyle();
  const [elementGroup, setElementGroup] = useState<number>();
  const [flopDraft, setFlopDraft] = useState<readonly CompiledElement[]>([]);
  const [maximumDifficulty, setMaximumDifficulty] = useState<number>();
  const [minimumDifficulty, setMinimumDifficulty] = useState<number>();
  const [mode, setMode] = useState<PickerMode>('element');
  const [query, setQuery] = useState('');
  const availableElements = useMemo(
    () => excludeCatalogElements(elements, excludedElementIds),
    [elements, excludedElementIds],
  );
  const flopCatalog = useMemo(() => pommelFlopCatalog(elements), [elements]);
  const availableFlopComponents = useMemo(
    () => availablePommelFlopComponents(flopCatalog, flopDraft, pommelRules),
    [flopCatalog, flopDraft, pommelRules],
  );
  const completedFlop = useMemo(
    () => completePommelFlop(flopDraft, pommelRules, difficultyLetterByTenths),
    [difficultyLetterByTenths, flopDraft, pommelRules],
  );
  const difficultyOptions = useMemo(
    () => catalogDifficultyOptions(availableElements),
    [availableElements],
  );
  const groups = useMemo(
    () =>
      [...new Set(availableElements.map((element) => element.code.group))].sort(
        (left, right) => left - right,
      ),
    [availableElements],
  );
  const matches = useMemo(
    () =>
      mode === 'flop'
        ? searchCatalog(availableFlopComponents, query, {}, availableFlopComponents.length)
        : searchCatalog(
            availableElements,
            query,
            {
              ...(elementGroup === undefined ? {} : { elementGroup }),
              ...(maximumDifficulty === undefined ? {} : { maximumDifficulty }),
              ...(minimumDifficulty === undefined ? {} : { minimumDifficulty }),
            },
            availableElements.length,
          ),
    [
      availableElements,
      availableFlopComponents,
      elementGroup,
      maximumDifficulty,
      minimumDifficulty,
      mode,
      query,
    ],
  );
  const hasFilters =
    elementGroup !== undefined ||
    maximumDifficulty !== undefined ||
    minimumDifficulty !== undefined;

  useEffect(() => {
    setQuery('');
    setElementGroup(undefined);
    setFlopDraft([]);
    setMaximumDifficulty(undefined);
    setMinimumDifficulty(undefined);
    setMode('element');
  }, [apparatus, visible]);

  function changeMode(nextMode: PickerMode): void {
    setMode(nextMode);
    setQuery('');
  }

  function closePicker(): void {
    setFlopDraft([]);
    setMode('element');
    setQuery('');
    onClose();
  }

  function selectExactDifficulty(difficulty: number | undefined): void {
    setMinimumDifficulty(difficulty);
    setMaximumDifficulty(difficulty);
  }

  function selectMinimumDifficulty(difficulty: number | undefined): void {
    setMinimumDifficulty(difficulty);
    if (
      difficulty !== undefined &&
      maximumDifficulty !== undefined &&
      difficulty > maximumDifficulty
    ) {
      setMaximumDifficulty(undefined);
    }
  }

  function selectMaximumDifficulty(difficulty: number | undefined): void {
    setMaximumDifficulty(difficulty);
    if (
      difficulty !== undefined &&
      minimumDifficulty !== undefined &&
      difficulty < minimumDifficulty
    ) {
      setMinimumDifficulty(undefined);
    }
  }

  function clearFilters(): void {
    setElementGroup(undefined);
    setMaximumDifficulty(undefined);
    setMinimumDifficulty(undefined);
  }

  function confirmFlop(): void {
    if (completedFlop !== undefined) onSelectFlop(flopDraft, completedFlop);
  }

  return (
    <Modal
      accessibilityLabel={`${APPARATUS_LABELS[apparatus]} element catalog`}
      animationType="fade"
      onRequestClose={closePicker}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable
          accessibilityLabel="Close element search"
          accessibilityRole="button"
          onPress={closePicker}
          style={styles.scrim}
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>{mode === 'flop' ? 'BUILD FLOP' : 'ADD ELEMENT'}</Text>
              <Text style={styles.title}>{APPARATUS_LABELS[apparatus]}</Text>
            </View>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              onPress={closePicker}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          {apparatus === 'pommel-horse' ? (
            <View accessibilityRole="tablist" style={styles.modeTabs}>
              <ModeTab
                active={mode === 'element'}
                label="Element"
                onPress={() => changeMode('element')}
              />
              <ModeTab
                active={mode === 'flop'}
                label="Build a flop"
                onPress={() => changeMode('flop')}
              />
            </View>
          ) : null}

          {mode === 'flop' ? (
            <FlopDraftPanel
              completed={completedFlop}
              draft={flopDraft}
              onClear={() => setFlopDraft([])}
              onConfirm={confirmFlop}
              onUndo={() => setFlopDraft((current) => current.slice(0, -1))}
            />
          ) : null}

          <View style={styles.searchBox}>
            <Text style={styles.searchMark}>⌕</Text>
            <TextInput
              accessibilityLabel={mode === 'flop' ? 'Search valid flop parts' : 'Search elements'}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder={
                mode === 'flop' ? 'Search valid next parts' : 'Name or alias, for example Peach'
              }
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              style={styles.input}
              value={query}
            />
            {query.length > 0 ? (
              <Pressable
                accessibilityLabel="Clear search"
                onPress={() => setQuery('')}
                style={styles.clearButton}
              >
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          {mode === 'element' ? (
            <CatalogFilterControls
              apparatus={apparatus}
              difficultyOptions={difficultyOptions}
              elementGroup={elementGroup}
              groups={groups}
              maximumDifficulty={maximumDifficulty}
              minimumDifficulty={minimumDifficulty}
              onClear={clearFilters}
              onElementGroupChange={setElementGroup}
              onMaximumDifficultyChange={selectMaximumDifficulty}
              onMinimumDifficultyChange={selectMinimumDifficulty}
              onSelectExactDifficulty={selectExactDifficulty}
            />
          ) : null}

          <Text style={styles.resultCount}>
            {matches.length}{' '}
            {mode === 'flop'
              ? `valid next part${matches.length === 1 ? '' : 's'}`
              : `element${matches.length === 1 ? '' : 's'} · ${query.trim().length === 0 ? 'difficulty low to high' : 'best matches first'}`}
          </Text>

          <FlatList
            contentContainerStyle={styles.list}
            data={matches}
            keyboardShouldPersistTaps="handled"
            keyExtractor={({ element }) => element.id}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>
                  {mode === 'flop' && completedFlop !== undefined
                    ? 'This flop is ready'
                    : 'No matching element'}
                </Text>
                <Text style={styles.emptyCopy}>
                  {mode === 'flop'
                    ? completedFlop === undefined
                      ? 'Undo the last part to choose another valid path.'
                      : 'Add the completed flop or undo a part to change it.'
                    : hasFilters
                      ? 'Try a wider difficulty range or a different element group.'
                      : excludedElementIds.size > 0
                        ? 'Try another name. Elements already in this routine are hidden.'
                        : 'Try a shorter name or a common alias.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <CatalogRow
                actionLabel={mode === 'flop' ? 'Add to flop' : 'Add element'}
                match={item}
                onSelect={(element) =>
                  mode === 'flop'
                    ? setFlopDraft((current) => [...current, element])
                    : onSelect(element)
                }
              />
            )}
            style={[styles.resultsList, scrollbarStyle]}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FlopDraftPanel({
  completed,
  draft,
  onClear,
  onConfirm,
  onUndo,
}: {
  readonly completed: CompletedPommelFlop | undefined;
  readonly draft: readonly CompiledElement[];
  readonly onClear: () => void;
  readonly onConfirm: () => void;
  readonly onUndo: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.flopDraft, completed !== undefined && styles.flopDraftComplete]}>
      <View style={styles.flopDraftHeading}>
        <View style={styles.flopDraftCopy}>
          <Text style={styles.flopDraftTitle}>{completed?.name ?? 'Flop parts'}</Text>
          <Text style={styles.flopDraftSubtitle}>
            {draft.length === 0
              ? 'Add one-pommel parts in performed order.'
              : completed === undefined
                ? 'Valid so far · add another part.'
                : `${draft.length} parts · valid ${completed.difficultyLetter} sequence`}
          </Text>
        </View>
        {completed === undefined ? null : (
          <View style={styles.completedValueBadge}>
            <Text style={styles.completedValue}>{completed.difficultyLetter}</Text>
          </View>
        )}
      </View>

      {draft.length === 0 ? (
        <Text style={styles.flopDraftEmpty}>
          Only components that can still form a valid FIG flop are shown below.
        </Text>
      ) : (
        <View style={styles.flopParts}>
          {draft.map((element, index) => (
            <View key={`${element.id}-${index}`} style={styles.flopPart}>
              <View style={styles.flopPartIndex}>
                <Text style={styles.flopPartIndexText}>{index + 1}</Text>
              </View>
              <Text numberOfLines={1} style={styles.flopPartName}>
                {element.name}
              </Text>
            </View>
          ))}
        </View>
      )}

      {draft.length === 0 ? null : (
        <View style={styles.flopActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onUndo}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Undo last</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onClear}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Clear</Text>
          </Pressable>
          {completed === undefined ? null : (
            <Pressable
              accessibilityLabel={`Add ${completed.name} to routine`}
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
            >
              <Text style={styles.confirmButtonText}>Add flop to routine</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function ModeTab({
  active,
  label,
  onPress,
}: {
  readonly active: boolean;
  readonly label: string;
  readonly onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeTab,
        active && styles.modeTabActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function catalogDifficultyOptions(
  elements: readonly CompiledElement[],
): readonly DifficultyFilterOption[] {
  const labelByDifficulty = new Map<number, string>();
  for (const element of elements) {
    labelByDifficulty.set(element.difficulty.tenths, formatDifficulty(element));
  }
  return [...labelByDifficulty]
    .sort(([left], [right]) => left - right)
    .map(([value, label]) => ({ label, value }));
}

function CatalogRow({
  actionLabel,
  match,
  onSelect,
}: {
  readonly actionLabel: string;
  readonly match: CatalogMatch;
  readonly onSelect: (element: CompiledElement) => void;
}) {
  const styles = useStyles();
  const { element, matchedAlias } = match;
  return (
    <Pressable
      accessibilityLabel={`${actionLabel}: ${element.name}`}
      accessibilityRole="button"
      onPress={() => onSelect(element)}
      style={({ pressed }) => [styles.result, pressed && styles.resultPressed]}
    >
      <View style={styles.valueBadge}>
        <Text style={styles.value}>{formatDifficulty(element)}</Text>
      </View>
      <View style={styles.resultCopy}>
        <Text numberOfLines={2} style={styles.elementName}>
          {element.name}
        </Text>
        <Text style={styles.metadata}>
          {formatOfficialCode(element)}
          {matchedAlias === undefined ? '' : ` · Alias: ${matchedAlias}`}
        </Text>
      </View>
      <Text style={styles.addMark}>+</Text>
    </Pressable>
  );
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    addMark: {
      color: colors.accent,
      fontSize: 24,
      fontWeight: '400',
    },
    clearButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    clearText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '700',
    },
    closeButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    closeText: {
      color: colors.ink,
      fontSize: 25,
      lineHeight: 27,
    },
    completedValue: {
      color: colors.onAccentMuted,
      fontSize: 18,
      fontWeight: '900',
    },
    completedValueBadge: {
      alignItems: 'center',
      backgroundColor: colors.success,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    confirmButton: {
      alignItems: 'center',
      backgroundColor: colors.success,
      borderRadius: radii.small,
      justifyContent: 'center',
      marginLeft: 'auto',
      minHeight: 34,
      paddingHorizontal: 12,
    },
    confirmButtonText: {
      color: colors.surface,
      fontSize: 10,
      fontWeight: '900',
    },
    elementName: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 19,
    },
    empty: {
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 50,
    },
    emptyCopy: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 5,
      textAlign: 'center',
    },
    emptyTitle: {
      color: colors.ink,
      fontSize: 16,
      fontWeight: '700',
    },
    eyebrow: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    flopActions: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 10,
    },
    flopDraft: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      marginTop: 12,
      padding: 12,
    },
    flopDraftComplete: {
      backgroundColor: colors.successMuted,
      borderColor: colors.success,
    },
    flopDraftCopy: {
      flex: 1,
    },
    flopDraftEmpty: {
      color: colors.muted,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 8,
    },
    flopDraftHeading: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
    },
    flopDraftSubtitle: {
      color: colors.muted,
      fontSize: 10,
      marginTop: 3,
    },
    flopDraftTitle: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: '900',
    },
    flopPart: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
    },
    flopPartIndex: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 10,
      height: 20,
      justifyContent: 'center',
      width: 20,
    },
    flopPartIndexText: {
      color: colors.onAccentMuted,
      fontSize: 8,
      fontWeight: '900',
    },
    flopPartName: {
      color: colors.ink,
      flex: 1,
      fontSize: 10,
      fontWeight: '700',
    },
    flopParts: {
      gap: 6,
      marginTop: 10,
    },
    header: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    headingCopy: {
      gap: 3,
    },
    input: {
      color: colors.ink,
      flex: 1,
      fontSize: 15,
      paddingVertical: 13,
    },
    list: {
      gap: 7,
      paddingBottom: 8,
    },
    metadata: {
      color: colors.muted,
      fontSize: 11,
      marginTop: 4,
    },
    modeTab: {
      alignItems: 'center',
      borderRadius: 16,
      flex: 1,
      justifyContent: 'center',
      minHeight: 34,
      paddingHorizontal: 12,
    },
    modeTabActive: {
      backgroundColor: colors.accent,
    },
    modeTabText: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '800',
    },
    modeTabTextActive: {
      color: colors.onAccentMuted,
    },
    modeTabs: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 3,
      marginTop: 14,
      padding: 3,
    },
    overlay: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 16,
    },
    pressed: {
      opacity: 0.68,
    },
    result: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 70,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    resultCopy: {
      flex: 1,
    },
    resultCount: {
      color: colors.muted,
      fontSize: 11,
      marginBottom: 10,
      marginTop: 12,
    },
    resultPressed: {
      backgroundColor: colors.accentMuted,
      borderColor: colors.accent,
    },
    resultsList: {
      flexShrink: 1,
    },
    scrim: {
      backgroundColor: 'rgba(16, 24, 40, 0.58)',
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    searchBox: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      flexDirection: 'row',
      marginTop: 14,
      paddingHorizontal: 12,
    },
    searchMark: {
      color: colors.muted,
      fontSize: 22,
      marginRight: 8,
    },
    secondaryButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.small,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 34,
      paddingHorizontal: 10,
    },
    secondaryButtonText: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: '800',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderRadius: radii.large,
      maxHeight: '94%',
      maxWidth: 680,
      padding: 20,
      width: '100%',
    },
    title: {
      color: colors.navy,
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    value: {
      color: colors.accentDark,
      fontSize: 15,
      fontWeight: '800',
    },
    valueBadge: {
      alignItems: 'center',
      backgroundColor: colors.accentMuted,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
  });
}
