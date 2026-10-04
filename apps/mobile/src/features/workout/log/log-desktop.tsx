import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Col, Content, H1, Kicker, Screen } from '@/components/layout';
import { Button, Card, Disc, Text } from '@/components/ui';
import { sportIcon } from '@/lib/sport-visuals';

import { BackRow, Reveal, SplitColumns, useSplit } from '../desktop';
import { FileDropZone, FileImported } from './file-import';

/** The form beside its summary; a narrow page stacks them. */
const MAX_WIDTH = 1000;

export type LogDesktopProps = {
  kicker: string;
  /** What is being logged: the session's title, the sport, or the question while none is picked. */
  title: string;
  /** When it was planned, for a planned session. */
  planned: string | null;
  sportId: string | null;
  /** The sport choice of a workout outside the plan. */
  header?: ReactNode;
  /** The form's fields; null until a sport is known. */
  fields: ReactNode;
  caption: string | null;
  fileName: string | null;
  importing: boolean;
  importError: string | null;
  onChooseFile: () => void;
  onDropFile: (file: File) => void;
  onRemoveFile: () => void;
  saveError: string | null;
  saving: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
};

/**
 * Log it (6.1, 6.2, 6.9, 6.10) on the desktop web: the form in a card with a
 * drop area for the watch file, and a summary that keeps Continue in view.
 */
export function LogDesktop({
  kicker,
  title,
  planned,
  sportId,
  header,
  fields,
  caption,
  fileName,
  importing,
  importError,
  onChooseFile,
  onDropFile,
  onRemoveFile,
  saveError,
  saving,
  canSubmit,
  onSubmit,
}: LogDesktopProps) {
  const page = useSplit(MAX_WIDTH);

  const form = (
    <Reveal index={1}>
      <Card padding={28}>
        <Col gap={24}>
          {header}
          {fields ? (
            <>
              {fileName ? (
                <FileImported name={fileName} onRemove={onRemoveFile} detail="Read in your browser" />
              ) : (
                <FileDropZone onChoose={onChooseFile} onDropFile={onDropFile} busy={importing} error={importError} />
              )}
              {fields}
              {caption ? <Text variant="caption">{caption}</Text> : null}
            </>
          ) : null}
        </Col>
      </Card>
    </Reveal>
  );

  const summary = (
    <Reveal index={2}>
      <Card padding={24}>
        <Col gap={20}>
          <View style={styles.what}>
            <Disc icon={sportIcon(sportId)} tone="accent" size={48} />
            <Col gap={2} style={styles.fill}>
              <Text variant="subheading">{title}</Text>
              {planned ? (
                <Text variant="bodySm" tabular>
                  {planned}
                </Text>
              ) : null}
            </Col>
          </View>
          {saveError ? (
            <Text variant="bodySm" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
              {saveError}
            </Text>
          ) : null}
          <Button size="lg" fullWidth iconRight="arrow-right" onPress={onSubmit} loading={saving} disabled={!canSubmit}>
            Continue
          </Button>
        </Col>
      </Card>
    </Reveal>
  );

  return (
    <Screen>
      <Content gap={24} maxWidth={MAX_WIDTH} onLayout={page.onLayout}>
        <BackRow />
        <Reveal>
          <Col gap={6}>
            <Kicker>{kicker}</Kicker>
            <H1>How did it go?</H1>
          </Col>
        </Reveal>
        {page.split ? (
          <SplitColumns main={form} side={summary} sideWidth={page.sideWidth} />
        ) : (
          <>
            {form}
            {summary}
          </>
        )}
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  what: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  fill: { flex: 1, minWidth: 0 },
});
