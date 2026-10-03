import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlannedSession, useSaveFeedback } from '@/api/hooks';
import type { ActivityLog, ChooseAgain, Felt } from '@/api/types';
import { BOTTOM_BAR_CLEARANCE, BottomBar, Col, Content } from '@/components/layout';
import { Button, Input, Question, RadioCard, RadioGroup, Segmented, Text } from '@/components/ui';

import { CHOOSE_AGAIN_OPTIONS, CHOOSE_AGAIN_QUESTION, FELT_OPTIONS, FELT_QUESTION } from './copy';
import { FeedbackHeader } from './feedback-header';

/** Room for the save error above the button. */
const ERROR_SPACE = 56;

/**
 * Completion & feedback (7): how it felt (required), whether they'd choose it
 * again (optional), and a note our assistant reads. Pre-filled when editing.
 */
export function FeedbackForm({ log, onDone }: { log: ActivityLog; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const session = usePlannedSession(log.session_id);
  const save = useSaveFeedback();
  const [felt, setFelt] = useState<Felt | null>(log.feedback?.felt ?? null);
  const [chooseAgain, setChooseAgain] = useState<ChooseAgain | null>(log.feedback?.choose_again ?? null);
  const [note, setNote] = useState(log.feedback?.note ?? '');
  const title = session.data?.title ?? log.title;

  const submit = () => {
    if (!felt) return;
    save.mutate(
      { logId: log.id, feedback: { felt, choose_again: chooseAgain, note: note.trim() || null } },
      { onSuccess: onDone },
    );
  };

  return (
    <>
      <Content
        gap={24}
        bottomInset={save.isError ? BOTTOM_BAR_CLEARANCE + Math.max(insets.bottom, 20) + ERROR_SPACE : 'bottomBar'}>
        <FeedbackHeader log={log} session={log.session_id && !session.isError ? session.data : null} />
        <Col gap={12}>
          <Question>{FELT_QUESTION}</Question>
          <RadioGroup label={FELT_QUESTION}>
            {FELT_OPTIONS.map((option) => (
              <RadioCard
                key={option.value}
                label={option.label}
                description={option.description}
                checked={felt === option.value}
                onPress={() => setFelt(option.value)}
              />
            ))}
          </RadioGroup>
        </Col>
        <Col gap={12}>
          <Question optional hint={title}>
            {CHOOSE_AGAIN_QUESTION}
          </Question>
          <Segmented
            label={CHOOSE_AGAIN_QUESTION}
            options={CHOOSE_AGAIN_OPTIONS}
            value={chooseAgain}
            // Optional: tapping the chosen answer again clears it.
            onChange={(value) => setChooseAgain(value === chooseAgain ? null : value)}
          />
        </Col>
        <Input
          label="Anything to note (optional)"
          placeholder="Shoes, weather, how your legs feel…"
          hint="Our assistant reads notes when it plans your next weeks."
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
          autoCapitalize="sentences"
        />
      </Content>
      <BottomBar>
        <Col gap={12} style={{ flex: 1 }}>
          {save.isError ? (
            <View accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Text variant="bodySm" tone="danger">
                We couldn&apos;t save that. Check your connection and try again.
              </Text>
            </View>
          ) : null}
          <Button
            size="lg"
            fullWidth
            iconRight="check"
            disabled={!felt}
            loading={save.isPending}
            onPress={submit}
            accessibilityHint={felt ? undefined : 'Choose how it felt first.'}>
            {save.isError ? 'Try again' : 'Save'}
          </Button>
        </Col>
      </BottomBar>
    </>
  );
}
