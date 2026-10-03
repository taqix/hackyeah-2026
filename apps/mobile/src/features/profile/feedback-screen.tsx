import { useState } from 'react';
import { StyleSheet } from 'react-native';

import {
  useFeedbackOverview,
  useResetFeedback,
  useSetOpinion,
  useSetSportExcluded,
  useSports,
} from '@/api/hooks';
import type { ActivityOpinion, ChooseAgain, FeedbackOverview, SportDefinition } from '@/api/types';
import { Button, ListRow, Sheet, Text } from '@/components/ui';
import { BackButton, Body, Col, Content, Row, Screen, TopBar } from '@/components/layout';
import { useNow } from '@/lib/clock';
import { sportIcon, sportName } from '@/lib/sport-visuals';

import { opinionMeta } from './labels';
import { ErrorState, Group, RowsSkeleton } from './pieces';

const SECTIONS: { opinion: ChooseAgain; title: string }[] = [
  { opinion: 'yes', title: "You'd choose again" },
  { opinion: 'maybe', title: 'Maybe' },
  { opinion: 'no', title: 'Not for now' },
];

/** Your feedback (9.5): yes, maybe and no per session card, never per day; and what's switched off. */
export function YourFeedbackScreen() {
  const feedback = useFeedbackOverview();
  const reset = useResetFeedback();
  const [confirming, setConfirming] = useState(false);

  const closeSheet = () => {
    setConfirming(false);
    reset.reset();
  };

  return (
    <Screen>
      <TopBar left={<BackButton />} title="Your feedback" />
      <Content gap={20}>
        <Body>After each session we ask if you&apos;d choose it again. A busy day never counts as a no.</Body>
        {feedback.isPending ? (
          <RowsSkeleton count={4} disc={36} />
        ) : feedback.isError ? (
          <ErrorState title="We couldn't load your feedback" onRetry={() => void feedback.refetch()} />
        ) : (
          <Lists overview={feedback.data} onReset={() => setConfirming(true)} />
        )}
      </Content>
      <Sheet
        visible={confirming}
        onClose={closeSheet}
        title="Reset feedback?"
        description="This clears every answer to “Would you choose this again?”. Your history, your answers and what you switched off stay. Our assistant rewrites its summary without them.">
        <Col gap={8}>
          {reset.isError ? (
            <Text variant="bodySm" tone="danger" accessibilityRole="alert">
              We couldn&apos;t reset your feedback. Try again.
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

function Lists({ overview, onReset }: { overview: FeedbackOverview; onReset: () => void }) {
  const today = useNow();
  const sports = useSports();
  const setOpinion = useSetOpinion();
  const setExcluded = useSetSportExcluded();
  const failed = setOpinion.isError || setExcluded.isError;

  return (
    <>
      {failed ? (
        <Text variant="bodySm" tone="danger" accessibilityRole="alert">
          We couldn&apos;t save that. Try again.
        </Text>
      ) : null}

      {overview.opinions.length === 0 ? (
        <Text variant="caption">
          No answers yet. After your next session, what you&apos;d choose again shows up here.
        </Text>
      ) : (
        SECTIONS.map(({ opinion, title }) => {
          const items = overview.opinions.filter((o) => o.opinion === opinion);
          if (!items.length) return null;
          return (
            <Group key={opinion} title={title} gap={2}>
              {items.map((item, i) => (
                <OpinionRow
                  key={item.activity_key}
                  item={item}
                  meta={opinionMeta(item, sports.data, today)}
                  divider={i > 0}
                  trying={setOpinion.isPending && setOpinion.variables?.activityKey === item.activity_key}
                  onTryAgain={() => setOpinion.mutate({ activityKey: item.activity_key, opinion: null })}
                />
              ))}
            </Group>
          );
        })
      )}

      <Group title="Switched off" gap={overview.excluded_sport_ids.length ? 2 : 8}>
        {overview.excluded_sport_ids.length ? (
          overview.excluded_sport_ids.map((id, i) => (
            <SwitchedOffRow
              key={id}
              sportId={id}
              sports={sports.data}
              divider={i > 0}
              busy={setExcluded.isPending && setExcluded.variables?.sportId === id}
              onSwitchOn={() => setExcluded.mutate({ sportId: id, excluded: false })}
            />
          ))
        ) : (
          <Text variant="caption">Nothing switched off. A session&apos;s menu can switch off its whole activity.</Text>
        )}
      </Group>

      <Row style={styles.reset}>
        <Text variant="caption" style={styles.fill}>
          Clears these answers. Your history stays.
        </Text>
        <Button
          variant="ghost"
          size="sm"
          icon="rotate-ccw"
          disabled={overview.opinions.length === 0}
          onPress={onReset}>
          Reset feedback
        </Button>
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
});
