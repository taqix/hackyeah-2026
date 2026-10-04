/**
 * Chat 8: one conversation with the coach. Entry params: `prefill` fills the
 * box, `about` attaches a session (8.1), `intent=move` with `about` asks to
 * move a missed session at once (8.15). A valid change is the active plan
 * before its card shows; Undo is the safety net (README › Chat).
 *
 * The same panel is the /coach route (`variant="page"`: full screen on a
 * phone, a centred thread on the desktop web) and the desktop web's coach
 * dock beside the page (`variant="dock"`).
 */
import { useRouter } from 'expo-router';
import { type ReactNode, type Ref, useEffect, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, type TextInput, View } from 'react-native';
import { LayoutAnimationConfig } from 'react-native-reanimated';

import { useChatMessages, usePlannedSession, usePlanState, useUndoChatMessage } from '@/api/hooks';
import { type ChatMessage, isApiError } from '@/api/types';
import { Screen, useLayout } from '@/components/layout';
import { Button, Card, Spinner, Text } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { startOfWeek, toIsoWithOffset } from '@/lib/dates';
import { sportIcon } from '@/lib/sport-visuals';
import { routes, type ChatRouteParams } from '@/navigation/routes';
import { useTheme } from '@/theme';

import { CoachBubble, FineLine, QuickReplies } from './bubbles';
import { ChatHeader, DockHeader } from './chat-header';
import { Composer } from './composer';
import { DONE_STAYS, INTRO, MOVE_REQUEST, NOT_READY_HINT, SESSION_REPLIES } from './copy';
import { Entrance } from './entrance';
import { ExampleChips, Examples } from './examples';
import { aboutLabel, sessionQuestion, sessionRef, undoProblem } from './labels';
import { ThreadMessages } from './thread-messages';
import { ThreadScroll, type ThreadScrollHandle } from './thread-scroll';
import { useChatSend } from './use-chat-send';
import { useChatEntry } from './use-chat-entry';
import { useEscapeToClose } from './use-escape-to-close';
import { usePlanSubtitle } from './use-plan-subtitle';

export type ChatPanelProps = {
  /**
   * How the conversation was opened (prefill, about, intent). The dock stays
   * mounted between opens: when these values change they apply like a fresh
   * open (prefill fills the box, about attaches the session, intent=move sends
   * Move it). Empty params leave the box and the attachment as they are.
   */
  params: ChatRouteParams;
  /** Closes the panel: the back arrow on the page; the close button and Esc in the dock. */
  onClose: () => void;
  /** 'dock': embedded beside the page on the desktop web. 'page': the /coach route. */
  variant: 'dock' | 'page';
  /**
   * Optional: a new value per open request, so the same params apply again
   * (the same chip twice). Without it only changed params apply. Mounting the
   * dock again on the request it already applied carries on where it was
   * (the draft, the attachment) and never sends Move it twice.
   */
  openKey?: string | number;
  /**
   * Optional, dock only: false while a dock kept mounted is hidden. Esc then
   * leaves the page alone, and the box takes focus again when it reopens.
   */
  open?: boolean;
};

/** The desktop page's thread and message box: about 70 characters a line. */
const PAGE_THREAD_WIDTH = 720;

/** Web: focuses the box with the caret after its text, ready to add to it. Whether it took focus. */
function focusAtEnd(input: TextInput | null): boolean {
  // React Native Web hands over the textarea as the ref.
  const node = input as unknown as HTMLTextAreaElement | null;
  if (!node) return false;
  node.focus();
  const end = node.value.length;
  node.setSelectionRange(end, end);
  return document.activeElement === node;
}

export function ChatPanel({ params, onClose, variant, openKey, open = true }: ChatPanelProps) {
  const router = useRouter();
  const { layout } = useTheme();
  const { isDesktop, isMedium, isWide } = useLayout();
  const today = useNow();
  const dock = variant === 'dock';
  // The dock only exists on the desktop web; the page follows the window.
  const desktop = dock || isDesktop;
  // A wide page keeps the examples in a side column instead of the empty thread.
  const aside = !dock && isWide;

  const chat = useChatMessages();
  const plan = usePlanState();
  const undo = useUndoChatMessage();
  const subtitle = usePlanSubtitle(today);

  const sender = useChatSend({
    messages: chat.data,
    refetchMessages: () => chat.refetch({ cancelRefetch: false }),
    refreshPlan: () => plan.refetch(),
  });
  // Move it (8.15): the request goes at once; the coach answers with free slots.
  const entry = useChatEntry({
    params,
    openKey,
    dock,
    onMove: (sessionId) => sender.submit(MOVE_REQUEST, sessionId),
  });
  const { draft, setDraft, aboutId, setAboutId } = entry;
  const about = usePlannedSession(aboutId);
  const pendingSession = usePlannedSession(sender.pending?.aboutId);
  const busy = sender.busy || undo.isPending;
  // A message changes the plan, so there must be one (not while it builds or after it failed).
  const planReady = plan.data?.status === 'ready';

  const rootRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);
  const threadRef = useRef<ThreadScrollHandle>(null);

  // Desktop: the box is ready to type in when the panel opens and whenever an
  // open request arrives, for a mouse or keyboard (a touch screen would raise
  // its keyboard over the panel). A page that has only just loaded can refuse
  // focus for a moment, so it tries again shortly unless something else has it.
  useEffect(() => {
    if (Platform.OS !== 'web' || !desktop || !open || !window.matchMedia('(pointer: fine)').matches) return undefined;
    let tries = 10;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = () => {
      if (focusAtEnd(inputRef.current) || --tries === 0) return;
      if (document.activeElement && document.activeElement !== document.body) return;
      timer = setTimeout(attempt, 100);
    };
    attempt();
    return () => clearTimeout(timer);
  }, [desktop, open, entry.request]);

  useEscapeToClose(dock && open, rootRef, onClose);

  const sendText = (text: string) => {
    if (!planReady || undo.isPending || !sender.submit(text, aboutId)) return false;
    undo.reset();
    entry.answered();
    threadRef.current?.follow();
    return true;
  };

  const fillBox = (text: string) => {
    setDraft(text);
    inputRef.current?.focus();
    // Web: once the text is in, the caret goes after it.
    if (Platform.OS === 'web') setTimeout(() => focusAtEnd(inputRef.current), 0);
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

  // The page sits over the tab it opened from and goes back to it. The dock
  // stays beside the page, except the medium window's drawer, which would cover it.
  const showInPage = (go: () => void) => {
    go();
    if (dock && isMedium) onClose();
  };
  const onSeeWeek = (date: string) => {
    const href = routes.today({ week: startOfWeek(date), day: date });
    if (dock) showInPage(() => router.navigate(href));
    else router.dismissTo(href);
  };
  const onEditLog = (logId: string) => showInPage(() => router.push(routes.log('new', logId)));

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
    !!entry.askAbout && aboutId === entry.askAbout && !!about.data && !sender.pending && !chat.isPending;
  const showExamples = chat.isSuccess && messages.length === 0 && !sender.pending && !showSessionQuestion && !aside;
  const threadKey = `${messages.length}:${messages[messages.length - 1]?.id ?? ''}:${sender.pending?.status ?? ''}`;
  const width = !dock && isDesktop ? PAGE_THREAD_WIDTH : undefined;

  const conversation = (
    <>
      <ThreadScroll ref={threadRef} contentKey={threadKey} gutter={layout.gutter} maxWidth={width} scrollbar={desktop}>
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
        {/* What is there when the thread first shows stays put; later messages ease in (desktop). */}
        <LayoutAnimationConfig skipEntering key={chat.data ? 'thread' : 'loading'}>
          <ThreadMessages
            messages={messages}
            pending={sender.pending}
            pendingMessage={pendingMessage}
            today={today}
            busy={busy}
            animate={desktop}
            onQuickReply={(text) => void sendText(text)}
            onUndo={onUndo}
            onSeeWeek={onSeeWeek}
            onEditLog={onEditLog}
            onRetry={sender.retry}
            onEdit={onEditMessage}
          />
        </LayoutAnimationConfig>
        {showSessionQuestion && about.data ? (
          <Entrance animate={desktop}>
            <View style={styles.question}>
              <CoachBubble>{sessionQuestion(about.data, today)}</CoachBubble>
              <QuickReplies items={SESSION_REPLIES} disabled={busy} onPick={(text) => void sendText(text)} />
            </View>
          </Entrance>
        ) : null}
        {showExamples ? (
          <>
            {desktop ? <ExampleChips onPick={fillBox} /> : <Examples onPick={fillBox} />}
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
        onEscape={dock ? onClose : undefined}
        maxWidth={width}
        top={
          undo.isError ? (
            <FineLine icon="circle-alert" danger align="center" alert>
              {undoProblem(undo.error)}
            </FineLine>
          ) : plan.data && !planReady ? (
            <FineLine align="center">{NOT_READY_HINT}</FineLine>
          ) : null
        }
      />
    </>
  );

  if (dock) {
    return (
      <DockFrame ref={rootRef}>
        <DockHeader sub={subtitle} onClose={onClose} />
        {conversation}
      </DockFrame>
    );
  }
  if (!isDesktop) {
    return (
      <Screen>
        <ChatHeader sub={subtitle} onBack={onClose} />
        {conversation}
      </Screen>
    );
  }
  return (
    <Screen>
      <ChatHeader sub={subtitle} onBack={onClose} divided />
      <View style={styles.page}>
        <View style={styles.pageThread}>{conversation}</View>
        {aside ? <ExamplesAside onPick={fillBox} /> : null}
      </View>
    </Screen>
  );
}

/** The dock's root: the column the shell gives it, on the paper background, no safe-area padding. */
function DockFrame({ children, ref }: { children: ReactNode; ref: Ref<View> }) {
  const { colors } = useTheme();
  return (
    <View ref={ref} style={[styles.dock, { backgroundColor: colors.bgApp }]}>
      {children}
    </View>
  );
}

/** A wide desktop page: what can be asked stays beside the thread. A click fills the box. */
function ExamplesAside({ onPick }: { onPick: (text: string) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={[styles.aside, { borderLeftColor: colors.borderSubtle }]}
      contentContainerStyle={styles.asideContent}>
      <Examples onPick={onPick} />
      <FineLine icon="lock">{DONE_STAYS}</FineLine>
    </ScrollView>
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
  dock: { flex: 1, minHeight: 0 },
  page: { flex: 1, minHeight: 0, flexDirection: 'row' },
  pageThread: { flex: 1, minWidth: 0 },
  aside: { flexGrow: 0, width: 360, borderLeftWidth: 1 },
  asideContent: { padding: 24, gap: 12 },
  // The thread's own gap, between the question and its replies.
  question: { gap: 12 },
  loading: { paddingVertical: 32, alignItems: 'center' },
  error: { gap: 10 },
  inline: { alignSelf: 'flex-start' },
});
