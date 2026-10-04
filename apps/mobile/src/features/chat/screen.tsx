/**
 * Chat 8: one conversation with the coach, full screen over the tab it was
 * opened from (no tab bar). Entry params: `prefill` fills the box, `about`
 * attaches a session (8.1), `intent=move` with `about` asks to move a missed
 * session at once (8.15). A valid change is the active plan before its card
 * shows; Undo is the safety net (README › Chat).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, type TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChatMessages, usePlannedSession, usePlanState, useUndoChatMessage } from '@/api/hooks';
import { type ChatMessage, isApiError } from '@/api/types';
import { Screen } from '@/components/layout';
import { Button, Card, Spinner, Text } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { startOfWeek, toIsoWithOffset } from '@/lib/dates';
import { sportIcon } from '@/lib/sport-visuals';
import { routes, type ChatRouteParams } from '@/navigation/routes';
import { useTheme } from '@/theme';

import { CoachBubble, FineLine, QuickReplies } from './bubbles';
import { ChatHeader } from './chat-header';
import { Composer } from './composer';
import { DONE_STAYS, INTRO, MOVE_REQUEST, NOT_READY_HINT, SESSION_REPLIES } from './copy';
import { Examples } from './examples';
import { aboutLabel, sessionQuestion, sessionRef, undoProblem } from './labels';
import { ThreadMessages } from './thread-messages';
import { ThreadScroll, type ThreadScrollHandle } from './thread-scroll';
import { useChatSend } from './use-chat-send';
import { useKeyboardShown } from './use-keyboard-shown';
import { usePlanSubtitle } from './use-plan-subtitle';

export function ChatScreen() {
  const params = useLocalSearchParams<ChatRouteParams>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { layout } = useTheme();
  const today = useNow();
  const keyboardShown = useKeyboardShown();

  const chat = useChatMessages();
  const plan = usePlanState();
  const undo = useUndoChatMessage();
  const subtitle = usePlanSubtitle(today);

  const [draft, setDraft] = useState(() => params.prefill ?? '');
  const [aboutId, setAboutId] = useState<string | null>(() => params.about ?? null);
  // 8.1: opened from a session (not Move it) asks what to change, until something is sent.
  const [askAbout] = useState(() => (params.intent === 'move' ? null : (params.about ?? null)));
  const [sentThisVisit, setSentThisVisit] = useState(false);
  const about = usePlannedSession(aboutId);

  const inputRef = useRef<TextInput>(null);
  const threadRef = useRef<ThreadScrollHandle>(null);

  const sender = useChatSend({
    messages: chat.data,
    refetchMessages: () => chat.refetch({ cancelRefetch: false }),
    refreshPlan: () => plan.refetch(),
  });
  const pendingSession = usePlannedSession(sender.pending?.aboutId);
  const busy = sender.busy || undo.isPending;
  // A message changes the plan, so there must be one (not while it builds or after it failed).
  const planReady = plan.data?.status === 'ready';

  const sendText = (text: string) => {
    if (!planReady || undo.isPending || !sender.submit(text, aboutId)) return false;
    undo.reset();
    setSentThisVisit(true);
    threadRef.current?.follow();
    return true;
  };

  // Move it (8.15): the request goes at once; the coach answers with free slots.
  const moveSent = useRef(false);
  useEffect(() => {
    if (params.intent !== 'move' || !params.about || moveSent.current) return;
    moveSent.current = true;
    sender.submit(MOVE_REQUEST, params.about);
  }, [params.intent, params.about, sender]);

  const fillBox = (text: string) => {
    setDraft(text);
    inputRef.current?.focus();
  };

  const onUndo = (messageId: string) => {
    if (busy) return;
    undo.mutate(messageId);
  };

  const onEditMessage = () => {
    const message = sender.takeBack();
    if (!message) return;
    setAboutId(message.aboutId);
    fillBox(message.text);
  };

  const messages = chat.data ?? [];
  const pendingMessage: ChatMessage | null = sender.pending
    ? {
        id: 'pending',
        created_at: toIsoWithOffset(today),
        role: 'user',
        kind: 'text',
        text: sender.pending.text,
        about: pendingSession.data ? sessionRef(pendingSession.data) : null,
      }
    : null;
  const showSessionQuestion =
    !!askAbout && aboutId === askAbout && !!about.data && !sentThisVisit && !sender.pending && !chat.isPending;
  const showExamples = chat.isSuccess && messages.length === 0 && !sender.pending && !showSessionQuestion;
  const threadKey = `${messages.length}:${messages[messages.length - 1]?.id ?? ''}:${sender.pending?.status ?? ''}`;

  return (
    <Screen>
      <ChatHeader sub={subtitle} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <ThreadScroll ref={threadRef} contentKey={threadKey} gutter={layout.gutter}>
          <CoachBubble>{INTRO}</CoachBubble>
          {chat.isPending ? (
            <View style={styles.loading}>
              <Spinner accessibilityLabel="Loading the conversation" />
            </View>
          ) : chat.isError && !chat.data ? (
            <LoadProblem
              offline={isApiError(chat.error, 'offline')}
              retrying={chat.isFetching}
              onRetry={() => void chat.refetch()}
            />
          ) : null}
          <ThreadMessages
            messages={messages}
            pending={sender.pending}
            pendingMessage={pendingMessage}
            today={today}
            busy={busy}
            onQuickReply={(text) => void sendText(text)}
            onUndo={onUndo}
            onSeeWeek={(date) => router.dismissTo(routes.today({ week: startOfWeek(date), day: date }))}
            onEditLog={(logId) => router.push(routes.log('new', logId))}
            onRetry={sender.retry}
            onEdit={onEditMessage}
          />
          {showSessionQuestion && about.data ? (
            <>
              <CoachBubble>{sessionQuestion(about.data, today)}</CoachBubble>
              <QuickReplies items={SESSION_REPLIES} disabled={busy} onPick={(text) => void sendText(text)} />
            </>
          ) : null}
          {showExamples ? (
            <>
              <Examples onPick={fillBox} />
              <FineLine icon="lock">{DONE_STAYS}</FineLine>
            </>
          ) : null}
        </ThreadScroll>
        <Composer
          inputRef={inputRef}
          value={draft}
          onChangeText={setDraft}
          onSend={() => {
            if (sendText(draft)) setDraft('');
          }}
          busy={busy}
          disabled={!planReady}
          offline={sender.pending?.status === 'offline'}
          about={about.data ? { icon: sportIcon(about.data.sport_id), label: aboutLabel(about.data, today) } : null}
          onRemoveAbout={() => setAboutId(null)}
          top={
            undo.isError ? (
              <FineLine icon="circle-alert" danger align="center" alert>
                {undoProblem(undo.error)}
              </FineLine>
            ) : plan.data && !planReady ? (
              <FineLine align="center">{NOT_READY_HINT}</FineLine>
            ) : null
          }
          bottomPadding={keyboardShown ? 10 : Math.max(insets.bottom, 16)}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** The thread couldn't load: say so and offer Try again. Announced as an alert. */
function LoadProblem({ offline, retrying, onRetry }: { offline: boolean; retrying: boolean; onRetry: () => void }) {
  return (
    <Card>
      <View role="alert" style={styles.error}>
        <Text variant="bodyStrong">{"Couldn't load the conversation"}</Text>
        <Text variant="bodySm">
          {offline
            ? "You're offline. Check your connection and try again."
            : "Something went wrong on our side. Your plan hasn't changed."}
        </Text>
        <Button size="sm" variant="secondary" icon="refresh-cw" loading={retrying} onPress={onRetry} style={styles.inline}>
          Try again
        </Button>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { paddingVertical: 32, alignItems: 'center' },
  error: { gap: 10 },
  inline: { alignSelf: 'flex-start' },
});
