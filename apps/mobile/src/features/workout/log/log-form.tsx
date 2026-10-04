import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useCreateLog, useUpdateLog } from '@/api/hooks';
import {
  type ActivityLog,
  isApiError,
  type LogSource,
  type PlannedSession,
  type SportDefinition,
  type SportMetric,
} from '@/api/types';
import { BackButton, BottomBar, Col, Content, H1, Kicker, Screen, TopBar } from '@/components/layout';
import { Button, Text } from '@/components/ui';
import { now } from '@/lib/clock';
import { toIsoWithOffset } from '@/lib/dates';
import { sessionStart } from '@/lib/sessions';
import { routes } from '@/navigation/routes';
import { ActivityImportError, activityImport } from '@/services/activity-import';

import { FileImport, FileImported } from './file-import';
import { MetricField } from './metric-field';
import {
  type FieldValue,
  type FormValues,
  formCaption,
  formMetrics,
  importErrorMessage,
  initialValues,
  isCompact,
  parseForm,
  pickActivity,
  valuesFromImport,
} from './metric-form';

export type LogFormProps = {
  kicker: string;
  /** The planned session being logged, or null for a workout outside the plan. */
  session: PlannedSession | null;
  /** A saved log to change instead of creating one. */
  log: ActivityLog | null;
  /** Null until the person picks what they did (a new extra). */
  sport: SportDefinition | null;
  /** Shown above the fields: the sport choice for a new extra. */
  header?: ReactNode;
};

type ImportedFile = { name: string; startedAt: string | null };

/** Numbers and text two to a row (a grid once there are 2+ metrics); yes/no and chips full width. */
function fieldRows(metrics: SportMetric[]): SportMetric[][] {
  const rows: SportMetric[][] = [];
  for (const m of metrics) {
    const last = rows[rows.length - 1];
    if (metrics.length > 1 && isCompact(m) && last?.length === 1 && isCompact(last[0])) last.push(m);
    else rows.push([m]);
  }
  return rows;
}

/** When it started: the plan's time once that has passed, otherwise just now minus its length. */
function defaultStart(session: PlannedSession | null, durationSeconds: number): string {
  const n = now();
  if (session && sessionStart(session).getTime() <= n.getTime()) return session.time_slot.start;
  return toIsoWithOffset(new Date(n.getTime() - durationSeconds * 1000));
}

function saveErrorMessage(error: unknown): string {
  if (isApiError(error, 'offline')) return "You're offline. Check your connection, then try again.";
  if (isApiError(error, 'conflict') || isApiError(error, 'not_found') || isApiError(error, 'validation')) {
    return error.message;
  }
  return "We couldn't save this. Try again.";
}

/**
 * Log it (6.1, 6.2, 6.9, 6.10): the file row at the top, then one field per
 * catalog metric. The length comes pre-filled from the plan, so a session done
 * as planned is one tap. Continue saves and opens Completion & feedback (7).
 */
export function LogForm({ kicker, session, log, sport, header }: LogFormProps) {
  const router = useRouter();
  const createLog = useCreateLog();
  const updateLog = useUpdateLog();
  const metrics = sport ? formMetrics(sport) : [];

  const [values, setValues] = useState<FormValues>(() =>
    initialValues(metrics, { plannedSeconds: session?.time_slot.duration ?? null, log }),
  );
  const [file, setFile] = useState<ImportedFile | null>(
    log?.file_name ? { name: log.file_name, startedAt: null } : null,
  );
  const [beforeImport, setBeforeImport] = useState<FormValues | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const parsed = parseForm(metrics, values);
  // Field errors show once Continue was tried, then follow the typing.
  const errors = submitted && !parsed.ok ? parsed.errors : {};
  const saving = createLog.isPending || updateLog.isPending;

  const setField = (key: string, value: FieldValue) => setValues((current) => ({ ...current, [key]: value }));

  async function chooseFile() {
    setImportError(null);
    setImporting(true);
    try {
      const result = await activityImport.pickAndImport();
      if (result.status === 'cancelled') return;
      const activity = pickActivity(result.data);
      if (!activity) {
        setImportError(importErrorMessage('no-activities'));
        return;
      }
      setBeforeImport(values);
      setValues(valuesFromImport(metrics, values, activity));
      setFile({ name: result.data.source.fileName, startedAt: activity.startTime });
    } catch (error) {
      setImportError(importErrorMessage(error instanceof ActivityImportError ? error.code : null));
    } finally {
      setImporting(false);
    }
  }

  function removeFile() {
    setFile(null);
    if (beforeImport) setValues(beforeImport);
    setBeforeImport(null);
  }

  function submit() {
    if (!sport || saving) return;
    setSubmitted(true);
    setSaveError(null);
    if (!parsed.ok) return;

    const source: LogSource = file ? 'file' : log && log.source !== 'file' ? log.source : 'typed';
    const fileStart = file?.startedAt ? toIsoWithOffset(new Date(file.startedAt)) : null;
    const done = {
      onSuccess: (saved: ActivityLog) => router.replace(routes.feedback(saved.id)),
      onError: (e: unknown) => setSaveError(saveErrorMessage(e)),
    };

    if (log) {
      updateLog.mutate(
        {
          id: log.id,
          patch: {
            duration_seconds: parsed.durationSeconds,
            metrics: parsed.metrics,
            source,
            file_name: file?.name ?? null,
            ...(fileStart ? { started_at: fileStart } : null),
          },
        },
        done,
      );
      return;
    }
    createLog.mutate(
      {
        session_id: session?.id ?? null,
        sport_id: sport.id,
        started_at: fileStart ?? defaultStart(session, parsed.durationSeconds),
        duration_seconds: parsed.durationSeconds,
        source,
        file_name: file?.name ?? null,
        metrics: parsed.metrics,
      },
      done,
    );
  }

  return (
    <Screen>
      <TopBar left={<BackButton />} />
      <Content gap={20} bottomInset="bottomBar">
        <Col gap={6}>
          <Kicker>{kicker}</Kicker>
          <H1>How did it go?</H1>
        </Col>
        {header}
        {sport ? (
          <>
            {file ? (
              <FileImported name={file.name} onRemove={removeFile} />
            ) : (
              <FileImport onChoose={() => void chooseFile()} busy={importing} error={importError} />
            )}
            <View accessibilityLabel={sport.name} style={styles.fields}>
              {fieldRows(metrics).map((row) => (
                <View key={row.map((m) => m.key).join('+')} style={styles.row}>
                  {row.map((m) => (
                    <View key={m.key} style={styles.cell}>
                      <MetricField
                        metric={m}
                        value={values[m.key] ?? null}
                        error={errors[m.key]}
                        onChange={(value) => setField(m.key, value)}
                      />
                    </View>
                  ))}
                  {row.length === 1 && metrics.length > 1 && isCompact(row[0]) ? <View style={styles.cell} /> : null}
                </View>
              ))}
            </View>
            <Text variant="caption">{formCaption(metrics, sport.id, !!file)}</Text>
          </>
        ) : null}
        {saveError ? (
          <Text variant="bodySm" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
            {saveError}
          </Text>
        ) : null}
      </Content>
      <BottomBar>
        <Button size="lg" fullWidth iconRight="arrow-right" onPress={submit} loading={saving} disabled={!sport}>
          Continue
        </Button>
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cell: { flex: 1, minWidth: 0 },
});
