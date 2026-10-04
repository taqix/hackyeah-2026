import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';

import { useCreateLog, useUpdateLog } from '@/api/hooks';
import { type ActivityLog, isApiError, type LogSource, type PlannedSession, type SportDefinition } from '@/api/types';
import {
  BackButton,
  BottomBar,
  Col,
  Content,
  H1,
  Kicker,
  layoutModeFor,
  Screen,
  TopBar,
  useLayout,
} from '@/components/layout';
import { Button, Text } from '@/components/ui';
import { now } from '@/lib/clock';
import { formatLongDate, toIsoWithOffset } from '@/lib/dates';
import { sessionStart, sessionTimeLabel } from '@/lib/sessions';
import { routes } from '@/navigation/routes';
import {
  ActivityImportError,
  type ActivityImportResult,
  activityImport,
  browserFile,
} from '@/services/activity-import';

import { FileImport, FileImported } from './file-import';
import { LogDesktop } from './log-desktop';
import { MetricFields } from './metric-fields';
import {
  type FieldValue,
  type FormValues,
  formCaption,
  formMetrics,
  importErrorMessage,
  initialValues,
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
  const { isDesktop, width } = useLayout();
  // A dialog on the desktop web keeps the phone layout, but the browser reads the file, not a phone.
  const readIn = layoutModeFor(width) === 'compact' ? undefined : 'Read in your browser';
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

  /** Fills the form from a picked or dropped file; Remove puts back what was typed before. */
  async function importFrom(read: () => Promise<ActivityImportResult>) {
    setImportError(null);
    setImporting(true);
    try {
      const result = await read();
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

  const chooseFile = () => importFrom(() => activityImport.pickAndImport());
  const dropFile = (dropped: File) => void importFrom(() => activityImport.importFile(browserFile(dropped)));

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

  if (isDesktop) {
    return (
      <LogDesktop
        kicker={kicker}
        title={session?.title ?? log?.title ?? sport?.name ?? 'What did you do?'}
        planned={
          session
            ? `${formatLongDate(sessionStart(session))} · ${sessionTimeLabel(session)}`
            : log
              ? formatLongDate(log.started_at)
              : null
        }
        sportId={sport?.id ?? session?.sport_id ?? null}
        header={header}
        fields={
          sport ? (
            <MetricFields sport={sport} metrics={metrics} values={values} errors={errors} onChange={setField} onSubmit={submit} />
          ) : null
        }
        caption={sport ? formCaption(metrics, sport.id, !!file) : null}
        fileName={file?.name ?? null}
        importing={importing}
        importError={importError}
        onChooseFile={() => void chooseFile()}
        onDropFile={dropFile}
        onRemoveFile={removeFile}
        saveError={saveError}
        saving={saving}
        canSubmit={!!sport}
        onSubmit={submit}
      />
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
              <FileImported name={file.name} onRemove={removeFile} detail={readIn} />
            ) : (
              <FileImport onChoose={() => void chooseFile()} onDropFile={dropFile} busy={importing} error={importError} />
            )}
            <MetricFields sport={sport} metrics={metrics} values={values} errors={errors} onChange={setField} />
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
