import type { ElementId, ExplanationParameters } from '@d-score-gymnastics/scoring';
import type { CompiledElement } from '@d-score-gymnastics/rulesets';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { summarizeElementGroups, type ElementGroupStatus } from '../element-groups';
import { explanationDetails, explanationLabel } from '../explanations';
import { formatScore } from '../format';
import { radii, useTheme, type ThemeColors } from '../theme';
import type { WorkbenchScore } from '../types';

interface ScorePanelProps {
  readonly difficultyLetterByTenths: ReadonlyMap<number, string>;
  readonly elementById: ReadonlyMap<ElementId, CompiledElement>;
  readonly elementGroups: readonly number[];
  readonly routineIsFull: boolean;
  readonly score: WorkbenchScore;
}

export function ScorePanel({
  difficultyLetterByTenths,
  elementById,
  elementGroups,
  routineIsFull,
  score,
}: ScorePanelProps) {
  const styles = useStyles();
  const groupStatuses = summarizeElementGroups(
    elementGroups,
    score.kind === 'routine' ? score.result : undefined,
    elementById,
    difficultyLetterByTenths,
    routineIsFull,
  );

  if (score.kind === 'empty') {
    return (
      <View style={styles.card}>
        <ScoreHeading total="—" />
        <ElementGroupSummary statuses={groupStatuses} />
        <View style={styles.empty}>
          <Text style={styles.emptyMark}>D</Text>
          <Text style={styles.emptyTitle}>Build a routine to begin</Text>
          <Text style={styles.emptyCopy}>
            Decisions, requirement warnings, and the complete difficulty breakdown will update here.
          </Text>
        </View>
      </View>
    );
  }

  if (score.kind === 'issues') {
    return (
      <View style={styles.card}>
        <ScoreHeading total="—" />
        <ElementGroupSummary statuses={groupStatuses} />
        <SectionTitle count={score.issues.length} title="Input issues" />
        <View style={styles.list}>
          {score.issues.map((issue, index) => (
            <Notice
              code={issue.code}
              key={`${issue.code}-${index}`}
              parameters={issue.parameters}
              tone="danger"
            />
          ))}
        </View>
      </View>
    );
  }

  if (score.kind === 'vault') {
    const { result } = score;
    return (
      <View style={styles.card}>
        <ScoreHeading total={formatScore(result.total)} />
        <View style={styles.breakdownGrid}>
          <BreakdownItem label="Vault value" value={formatScore(result.vaultDifficulty)} />
          <BreakdownItem label="Bonus" value={formatScore(result.bonus)} />
        </View>
        {result.warnings.length > 0 ? (
          <>
            <SectionTitle count={result.warnings.length} title="Warnings" />
            <View style={styles.list}>
              {result.warnings.map((warning, index) => (
                <Notice
                  code={warning.code}
                  key={`${warning.code}-${index}`}
                  parameters={warning.parameters}
                  tone="warning"
                />
              ))}
            </View>
          </>
        ) : (
          <View style={styles.cleanState}>
            <Text style={styles.cleanMark}>✓</Text>
            <Text style={styles.cleanText}>No Vault warnings</Text>
          </View>
        )}
        {result.awards.length > 0 ? (
          <>
            <SectionTitle count={result.awards.length} title="Awards" />
            <View style={styles.list}>
              {result.awards.map((award, index) => (
                <DecisionRow
                  code={award.reason}
                  key={`${award.reason}-${index}`}
                  label={`+${formatScore(award.value)}`}
                  parameters={award.reasonParameters}
                  status="counted"
                />
              ))}
            </View>
          </>
        ) : null}
      </View>
    );
  }

  const { result } = score;
  const visibleWarnings = result.warnings.filter(
    (warning) => warning.code !== 'fig.missing-element-group',
  );
  return (
    <View style={styles.card}>
      <ScoreHeading total={formatScore(result.total)} />
      <View style={styles.breakdownGrid}>
        <BreakdownItem label="Elements" value={formatScore(result.breakdown.elementDifficulty)} />
        <BreakdownItem label="Groups" value={formatScore(result.breakdown.elementGroup)} />
        <BreakdownItem label="Connections" value={formatScore(result.breakdown.connection)} />
        <BreakdownItem label="Bonus" value={formatScore(result.breakdown.bonus)} />
      </View>
      <ElementGroupSummary statuses={groupStatuses} />

      {visibleWarnings.length > 0 ? (
        <>
          <SectionTitle count={visibleWarnings.length} title="Warnings" />
          <View style={styles.list}>
            {visibleWarnings.map((warning, index) => (
              <Notice
                code={warning.code}
                key={`${warning.code}-${index}`}
                parameters={warning.parameters}
                tone="warning"
              />
            ))}
          </View>
        </>
      ) : (
        <View style={styles.cleanState}>
          <Text style={styles.cleanMark}>✓</Text>
          <Text style={styles.cleanText}>No additional composition warnings</Text>
        </View>
      )}

      <SectionTitle count={result.elementDecisions.length} title="Element decisions" />
      <View style={styles.list}>
        {result.elementDecisions.map((decision, index) => {
          const element = elementById.get(decision.elementId);
          return (
            <DecisionRow
              code={decision.reason}
              key={decision.occurrenceId}
              label={`${index + 1}. ${element?.name ?? decision.elementId}`}
              parameters={decision.reasonParameters}
              status={decision.status}
              value={formatScore(decision.creditedDifficulty)}
            />
          );
        })}
      </View>
    </View>
  );
}

function ElementGroupSummary({ statuses }: { readonly statuses: readonly ElementGroupStatus[] }) {
  const styles = useStyles();
  if (statuses.length === 0) return null;

  return (
    <View style={styles.groupSection}>
      <View style={styles.groupHeading}>
        <Text style={styles.groupTitle}>Element groups</Text>
        <Text style={styles.groupLegend}>Green = full · Yellow = partial · Red = missing</Text>
      </View>
      <View style={styles.groupGrid}>
        {statuses.map((status) => {
          const fulfilled = status.status === 'full' || status.status === 'partial';
          const detail = fulfilled
            ? `+${formatScore(status.award)} ${status.status === 'full' ? 'full' : 'partial'}`
            : status.status === 'missing'
              ? 'Missing'
              : 'Not met';
          return (
            <View
              accessibilityLabel={`Element group ${romanNumeral(status.group)}. ${fulfilled ? `${status.difficultyLetter}, ${detail}` : detail}.`}
              accessible
              key={status.group}
              style={[
                styles.groupBox,
                status.status === 'full' && styles.fullGroupBox,
                status.status === 'partial' && styles.partialGroupBox,
                status.status === 'missing' && styles.missingGroupBox,
              ]}
            >
              <Text
                style={[
                  styles.groupLabel,
                  status.status === 'full' && styles.fullGroupText,
                  status.status === 'partial' && styles.partialGroupText,
                  status.status === 'missing' && styles.missingGroupText,
                ]}
              >
                EG {romanNumeral(status.group)}
              </Text>
              <Text
                style={[
                  styles.groupDifficulty,
                  status.status === 'full' && styles.fullGroupText,
                  status.status === 'partial' && styles.partialGroupText,
                  status.status === 'missing' && styles.missingGroupText,
                ]}
              >
                {fulfilled ? status.difficultyLetter : '—'}
              </Text>
              <Text
                style={[
                  styles.groupDetail,
                  status.status === 'full' && styles.fullGroupText,
                  status.status === 'partial' && styles.partialGroupText,
                  status.status === 'missing' && styles.missingGroupText,
                ]}
              >
                {detail}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ScoreHeading({ total }: { readonly total: string }) {
  const styles = useStyles();
  return (
    <View style={styles.heading}>
      <View>
        <Text style={styles.eyebrow}>LIVE D-SCORE ESTIMATE</Text>
        <Text style={styles.headingTitle}>Difficulty score</Text>
      </View>
      <View style={styles.totalBlock}>
        <Text style={styles.total}>{total}</Text>
        <Text style={styles.totalLabel}>D-SCORE</Text>
      </View>
    </View>
  );
}

function BreakdownItem({ label, value }: { readonly label: string; readonly value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.breakdownItem}>
      <Text style={styles.breakdownValue}>{value}</Text>
      <Text style={styles.breakdownLabel}>{label}</Text>
    </View>
  );
}

function SectionTitle({ count, title }: { readonly count: number; readonly title: string }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCount}>
        <Text style={styles.sectionCountText}>{count}</Text>
      </View>
    </View>
  );
}

function Notice({
  code,
  parameters,
  tone,
}: {
  readonly code: string;
  readonly parameters: ExplanationParameters;
  readonly tone: 'danger' | 'warning';
}) {
  const styles = useStyles();
  const details = explanationDetails(parameters);
  return (
    <View style={[styles.notice, tone === 'danger' ? styles.dangerNotice : styles.warningNotice]}>
      <Text style={[styles.noticeMark, tone === 'danger' ? styles.dangerText : styles.warningText]}>
        !
      </Text>
      <View style={styles.noticeCopy}>
        <Text style={styles.noticeTitle}>{explanationLabel(code)}</Text>
        {details === undefined ? null : <Text style={styles.noticeDetails}>{details}</Text>}
        <Text style={styles.technicalCode}>{code}</Text>
      </View>
    </View>
  );
}

function DecisionRow({
  code,
  label,
  parameters,
  status,
  value,
}: {
  readonly code: string;
  readonly label: string;
  readonly parameters: ExplanationParameters;
  readonly status: 'counted' | 'excluded';
  readonly value?: string;
}) {
  const styles = useStyles();
  const details = explanationDetails(parameters);
  return (
    <View style={styles.decision}>
      <View
        style={[styles.statusMark, status === 'counted' ? styles.countedMark : styles.excludedMark]}
      >
        <Text style={styles.statusMarkText}>{status === 'counted' ? '✓' : '–'}</Text>
      </View>
      <View style={styles.decisionCopy}>
        <Text numberOfLines={2} style={styles.decisionLabel}>
          {label}
        </Text>
        <Text style={styles.decisionReason}>{explanationLabel(code)}</Text>
        {details === undefined ? null : <Text style={styles.noticeDetails}>{details}</Text>}
      </View>
      {value === undefined ? null : (
        <Text style={[styles.decisionValue, status === 'excluded' && styles.excludedValue]}>
          {value}
        </Text>
      )}
    </View>
  );
}

function romanNumeral(value: number): string {
  return ['I', 'II', 'III', 'IV', 'V'][value - 1] ?? String(value);
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    breakdownGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 18,
    },
    breakdownItem: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.medium,
      flexBasis: '46%',
      flexGrow: 1,
      padding: 12,
    },
    breakdownLabel: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: '600',
      marginTop: 2,
      textTransform: 'uppercase',
    },
    breakdownValue: {
      color: colors.ink,
      fontSize: 18,
      fontWeight: '800',
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.large,
      borderWidth: 1,
      padding: 18,
    },
    cleanMark: {
      color: colors.success,
      fontSize: 13,
      fontWeight: '900',
    },
    cleanState: {
      alignItems: 'center',
      backgroundColor: colors.successMuted,
      borderRadius: radii.small,
      flexDirection: 'row',
      gap: 8,
      marginTop: 16,
      padding: 11,
    },
    cleanText: {
      color: colors.success,
      fontSize: 12,
      fontWeight: '700',
    },
    countedMark: {
      backgroundColor: colors.success,
    },
    dangerNotice: {
      backgroundColor: colors.dangerMuted,
    },
    dangerText: {
      color: colors.danger,
    },
    decision: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      minHeight: 60,
      paddingVertical: 9,
    },
    decisionCopy: {
      flex: 1,
    },
    decisionLabel: {
      color: colors.ink,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    decisionReason: {
      color: colors.muted,
      fontSize: 10,
      marginTop: 3,
    },
    decisionValue: {
      color: colors.success,
      fontSize: 13,
      fontWeight: '800',
    },
    empty: {
      alignItems: 'center',
      paddingHorizontal: 22,
      paddingVertical: 54,
    },
    emptyCopy: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 6,
      maxWidth: 320,
      textAlign: 'center',
    },
    emptyMark: {
      color: colors.accent,
      fontSize: 34,
      fontWeight: '300',
    },
    emptyTitle: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '800',
      marginTop: 5,
    },
    eyebrow: {
      color: colors.accent,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1.1,
    },
    excludedMark: {
      backgroundColor: colors.muted,
    },
    excludedValue: {
      color: colors.muted,
    },
    fullGroupBox: {
      backgroundColor: colors.successMuted,
      borderColor: colors.success,
    },
    fullGroupText: {
      color: colors.success,
    },
    groupBox: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radii.medium,
      borderWidth: 1,
      flexBasis: '21%',
      flexGrow: 1,
      justifyContent: 'center',
      minHeight: 92,
      minWidth: 68,
      paddingHorizontal: 8,
      paddingVertical: 10,
    },
    groupDetail: {
      color: colors.muted,
      fontSize: 9,
      fontWeight: '700',
      marginTop: 2,
      textAlign: 'center',
    },
    groupDifficulty: {
      color: colors.ink,
      fontSize: 24,
      fontWeight: '900',
      lineHeight: 29,
      marginTop: 2,
    },
    groupGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
    },
    groupHeading: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    groupLabel: {
      color: colors.muted,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.7,
    },
    groupLegend: {
      color: colors.muted,
      fontSize: 8,
    },
    groupSection: {
      marginTop: 18,
    },
    groupTitle: {
      color: colors.ink,
      fontSize: 12,
      fontWeight: '800',
    },
    heading: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    headingTitle: {
      color: colors.navy,
      fontSize: 18,
      fontWeight: '800',
      marginTop: 3,
    },
    list: {
      gap: 2,
    },
    missingGroupBox: {
      backgroundColor: colors.dangerMuted,
      borderColor: colors.danger,
    },
    missingGroupText: {
      color: colors.danger,
    },
    notice: {
      alignItems: 'flex-start',
      borderRadius: radii.small,
      flexDirection: 'row',
      gap: 9,
      padding: 11,
    },
    noticeCopy: {
      flex: 1,
    },
    noticeDetails: {
      color: colors.muted,
      fontSize: 9,
      marginTop: 3,
    },
    noticeMark: {
      fontSize: 12,
      fontWeight: '900',
    },
    noticeTitle: {
      color: colors.ink,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    partialGroupBox: {
      backgroundColor: colors.warningMuted,
      borderColor: colors.warning,
    },
    partialGroupText: {
      color: colors.warning,
    },
    sectionCount: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 10,
      justifyContent: 'center',
      minWidth: 20,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    sectionCountText: {
      color: colors.muted,
      fontSize: 9,
      fontWeight: '800',
    },
    sectionHeading: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
      marginBottom: 8,
      marginTop: 20,
    },
    sectionTitle: {
      color: colors.ink,
      fontSize: 12,
      fontWeight: '800',
    },
    statusMark: {
      alignItems: 'center',
      borderRadius: 11,
      height: 22,
      justifyContent: 'center',
      width: 22,
    },
    statusMarkText: {
      color: colors.surface,
      fontSize: 11,
      fontWeight: '900',
    },
    technicalCode: {
      color: colors.muted,
      fontSize: 8,
      marginTop: 4,
    },
    total: {
      color: colors.surface,
      fontSize: 25,
      fontWeight: '900',
      letterSpacing: -0.6,
    },
    totalBlock: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: radii.medium,
      minWidth: 82,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    totalLabel: {
      color: colors.onAccentMuted,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    warningNotice: {
      backgroundColor: colors.warningMuted,
    },
    warningText: {
      color: colors.warning,
    },
  });
}
