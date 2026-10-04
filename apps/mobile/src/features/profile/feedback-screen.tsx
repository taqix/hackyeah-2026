import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  useFeedbackOverview,
  useResetFeedback,
  useSetOpinion,
  useSetSportExcluded,
  useSports,
} from '@/api/hooks';
import {
  type ActivityOpinion,
  type ChooseAgain,
  type FeedbackOverview,
  isApiError,
  type SportDefinition,
} from '@/api/types';
import { Button, Card, ListRow, Sheet, Text } from '@/components/ui';
import { BackButton, Body, Col, Content, PageHeader, Row, Screen, TopBar, useLayout } from '@/components/layout';
import { useNow } from '@/lib/clock';
import { sportIcon, sportName } from '@/lib/sport-visuals';

import { opinionMeta } from './labels';
import { BackLink, PanelCard, Reveal, Split } from './panel';
import { ErrorState, Group, RowsSkeleton } from './pieces';

/** The server's reason when it has one (e.g. answers can't change yet), else the calm default. */
function errorText(error: unknown, fallback: string): string {
  return isApiError(error) && error.code !== 'offline' && error.code !== 'timeout' ? error.message : fallback;
}

const SECTIONS: { opinion: ChooseAgain; title: string }[] = [
  { opinion: 'yes', title: "You'd choose again" },
  { opinion: 'maybe', title: 'Maybe' },
  { opinion: 'no', title: 'Not for now' },
];

const INTRO = "After each session we ask if you'd choose it again. A busy day never counts as a no.";

/** Your feedback (9.5): yes, maybe and no per session card, never per day; and what's switched off. */
export function YourFeedbackScreen() {
  const feedback = useFeedbackOverview();
  const reset = useResetFeedback();
  const { isDesktop } = useLayout();
  const [confirming, setConfirming] = useState(false);

  const closeSheet = () => {
    setConfirming(false);
    reset.reset();
  };

  const lists = feedback.isPending ? (
    <RowsSkeleton count={4} disc={36} />
  ) : feedback.isError ? (
    <ErrorState title="We couldn't load your feedback" onRetry={() => void feedback.refetch()} />
  ) : (
    <Lists overview={feedback.data} onReset={() => setConfirming(true)} desktop={isDesktop} />
  );

  return (
    <Screen>
      {isDesktop ? (
        <Content gap={24} maxWidth={1040}>
          <BackLink label="You" href="/you" />
          <Reveal>
            <PageHeader title="Your feedback" subtitle={INTRO} />
          </Reveal>
          {lists}
        </Content>
      ) : (
        <>
          <TopBar left={<BackButton />} title="Your feedback" />
          <Content gap={20}>
            <Body>{INTRO}</Body>
            {lists}
          </Content>
        </>
      )}
      <Sheet
        visible={confirming}
        onClose={closeSheet}
        title="Reset feedback?"
        description="This clears every answer to “Would you choose this again?”. Your history, your answers and what you switched off stay. Our assistant rewrites its summary without them.">
        <Col gap={8}>
          {reset.isError ? (
            <Text variant="bodySm" tone="danger" accessibilityRole="alert">
              {errorText(reset.error, "We couldn't reset your feedback. Try again.")}
            </Text>
          ) : null}
          <Button
            size="lg"
            fullWidth
            icon="rotate-ccw"
            loading={reset.isPending}
            onPress={() => reset.mutate(undefined, { onSuccess: () => setConfirming(false) })}>
            Reset feedback
          </Button>
          <Button variant="ghost" size="lg" fullWidth onPress={closeSheet}>
            Keep my feedback
          </Button>
        </Col>
      </Sheet>
    </Screen>
  );
}

function Lists({ overview, onReset, desktop }: { overview: FeedbackOverview; onReset: () => void; desktop: boolean }) {
  const today = useNow();
  const sports = useSports();
  const setOpinion = useSetOpinion();
  const setExcluded = useSetSportExcluded();
  const failure = setOpinion.error ?? setExcluded.error;
  const off = overview.excluded_sport_ids;

  const sections = SECTIONS.map((section) => ({
    ...section,
    items: overview.opinions.filter((o) => o.opinion === section.opinion),
  })).filter((section) => section.items.length > 0);

  const failureLine = failure ? (
    <Text variant="bodySm" tone="danger" accessibilityRole="alert">
      {errorText(failure, "We couldn't save that. Try again.")}
    </Text>
  ) : null;
  const noOpinions = (
    <Text variant="caption">No answers yet. After your next session, what you&apos;d choose again shows up here.</Text>
  );
  const nothingOff = (
    <Text variant="caption">Nothing switched off. A session&apos;s menu can switch off its whole activity.</Text>
  );
  const opinionRows = (items: ActivityOpinion[]) =>
    items.map((item, i) => (
      <OpinionRow
        key={item.activity_key}
        item={item}
        meta={opinionMeta(item, sports.data, today)}
        divider={i > 0}
        trying={setOpinion.isPending && setOpinion.variables?.activityKey === item.activity_key}
        onTryAgain={() => setOpinion.mutate({ activityKey: item.activity_key, opinion: null })}
      />
    ));
  const offRows = off.map((id, i) => (
    <SwitchedOffRow
      key={id}
      sportId={id}
      sports={sports.data}
      divider={i > 0}
      busy={setExcluded.isPending && setExcluded.variables?.sportId === id}
      onSwitchOn={() => setExcluded.mutate({ sportId: id, excluded: false })}
    />
  ));
  const resetButton = (
    <Button variant="ghost" size="sm" icon="rotate-ccw" disabled={overview.opinions.length === 0} onPress={onReset}>
      Reset feedback
    </Button>
  );

  if (desktop) {
    return (
      <>
        {failureLine}
        <Split
          stickySide
          main={
            overview.opinions.length === 0 ? (
              <Reveal order={1}>
                <PanelCard>{noOpinions}</PanelCard>
              </Reveal>
            ) : (
              sections.map(({ opinion, title, items }, index) => (
                <Reveal key={opinion} order={index + 1}>
                  <PanelCard title={title} gap={4}>
                    <View>{opinionRows(items)}</View>
                  </PanelCard>
                </Reveal>
              ))
            )
          }
          side={
            <>
              <Reveal order={2}>
                <PanelCard title="Switched off" gap={off.length ? 4 : 8}>
                  {off.length ? <View>{offRows}</View> : nothingOff}
                </PanelCard>
              </Reveal>
              <Reveal order={3}>
                <Card variant="sunken" padding={20} style={styles.resetCard}>
                  <Text variant="bodySm">Clears these answers. Your history stays.</Text>
                  <View style={styles.resetAction}>{resetButton}</View>
                </Card>
              </Reveal>
            </>
          }
        />
      </>
    );
  }

  return (
    <>
      {failureLine}

      {overview.opinions.length === 0
        ? noOpinions
        : sections.map(({ opinion, title, items }) => (
            <Group key={opinion} title={title} gap={2}>
              {opinionRows(items)}
            </Group>
          ))}

      <Group title="Switched off" gap={off.length ? 2 : 8}>
        {off.length ? offRows : nothingOff}
      </Group>

      <Row style={styles.reset}>
        <Text variant="caption" style={styles.fill}>
          Clears these answers. Your history stays.
        </Text>
        {resetButton}
      </Row>
    </>
  );
}

function OpinionRow({
  item,
  meta,
  divider,
  trying,
  onTryAgain,
}: {
  item: ActivityOpinion;
  meta: string;
  divider: boolean;
  trying: boolean;
  onTryAgain: () => void;
}) {
  return (
    <ListRow
      icon={sportIcon(item.sport_id)}
      discTone={item.opinion === 'yes' ? 'accent' : 'quiet'}
      discSize={36}
      title={item.title}
      detail={meta}
      divider={divider}
      right={
        item.opinion === 'no' ? (
          <Button
            variant="secondary"
            size="sm"
            loading={trying}
            onPress={onTryAgain}
            accessibilityLabel={`Try ${item.title} again`}
            accessibilityHint="Sets this card back to no answer">
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}

function SwitchedOffRow({
  sportId,
  sports,
  divider,
  busy,
  onSwitchOn,
}: {
  sportId: string;
  sports: SportDefinition[] | undefined;
  divider: boolean;
  busy: boolean;
  onSwitchOn: () => void;
}) {
  const name = sportName(sports, sportId);
  return (
    <ListRow
        icon={sportIcon(sportId)}
        discTone="quiet"
        discSize={36}
        title={name}
        detail="Left out of your plans"
        divider={divider}
        right={
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onPress={onSwitchOn}
            accessibilityLabel={`Switch ${name} on`}
            accessibilityHint="Plans can include it again">
            Switch on
          </Button>
        }
      />
  );
}

const styles = StyleSheet.create({
  reset: { justifyContent: 'space-between' },
  fill: { flex: 1, minWidth: 0 },
  resetCard: { gap: 8 },
  resetAction: { alignSelf: 'flex-start', marginLeft: -12 },
});
