import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import { BackHandler, Keyboard, Platform, View } from 'react-native';

import { useCreateLog, useLastExercise, usePlannedSession, useSport } from '@/api/hooks';
import { type GymSession, isApiError, isGymSession } from '@/api/types';
import { Button, Icon, Text } from '@/components/ui';
import { BottomBar, Col, Content, H2, Kicker, Screen } from '@/components/layout';
import { now } from '@/lib/clock';
import { formatDayDate, toIsoWithOffset } from '@/lib/dates';
import { sessionMinutes } from '@/lib/sessions';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme';

import { EndSheet } from './end-sheet';
import { formatKg } from './format';
import {
  buildSteps,
  firstOpen,
  type GymAction,
  gymReducer,
  type GymState,
  type GymStep,
  initGymState,
  isSessionDone,
  loggedSets,
  plannedLabel,
} from './model';
import { PlanSheet } from './plan-sheet';
import { REST_EXTEND_MS, RestSheet } from './rest-sheet';
import { GymError, GymLoading, GymNotice } from './screen-states';
import { SessionTop } from './session-top';
import { SetList } from './set-list';
import { TimedPanel } from './timed-panel';

const SAVE_FAILED = "We couldn't save your session. Check your connection and try again.";

function lightTap() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Closes the gym modal: back to the activity or Today. */
function useClose() {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) router.back();
    else router.replace(routes.today());
  };
}

/** Guided gym (6.3–6.7): loads the session and the catalog, then runs it. */
export function GymSessionScreen({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const close = useClose();
  const sessionQuery = usePlannedSession(sessionId);
  const session = sessionQuery.data;
  const sportQuery = useSport(session?.sport_id);
  // Once started, the session keeps running even when saving it refetches the plan.
  const [live, setLive] = useState<{ session: GymSession; steps: GymStep[] } | null>(null);
  if (!live && session && isGymSession(session) && session.status === 'planned' && sportQuery.isSuccess) {
    const steps = buildSteps(session, sportQuery.data);
    if (steps.length) setLive({ session, steps });
  }

  if (live) return <GuidedSession session={live.session} steps={live.steps} />;
  if (sessionQuery.isError || sportQuery.isError) {
    return (
      <GymError
        title="We couldn't load this session"
        onRetry={() => {
          if (sessionQuery.isError) void sessionQuery.refetch();
          if (sportQuery.isError) void sportQuery.refetch();
        }}
        onClose={close}
      />
    );
  }
  if (!session || sportQuery.isPending) return <GymLoading onClose={close} />;

  if (session.status === 'completed' && session.log_id) {
    const logId = session.log_id;
    return (
      <GymNotice
        title="Already logged"
        body="This session is saved. Here's what you did."
        action="See what you did"
        onAction={() => router.replace(routes.gymReview(session.id, logId))}
        onClose={close}
      />
    );
  }
  if (session.status === 'skipped') {
    return (
      <GymNotice
        title="Not today"
        body="This session was skipped, so there's nothing to start."
        action="Close"
        onAction={close}
        onClose={close}
      />
    );
  }
  return (
    <GymNotice
      title="Nothing to guide here"
      body="This session has no gym exercises. Log it when you're done instead."
      action="Log it"
      onAction={() => router.replace(routes.log(session.id))}
      onClose={close}
    />
  );
}

function GuidedSession({ session, steps }: { session: GymSession; steps: GymStep[] }) {
  useKeepAwake(undefined, { suppressDeactivateWarnings: true });
  const router = useRouter();
  const close = useClose();
  const { colors } = useTheme();
  const [startedAt] = useState(() => now().getTime());
  const [state, dispatch] = useReducer(gymReducer, steps, initGymState);
  const createLog = useCreateLog();
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const step = state.steps[state.current];
  const sets = state.entries[state.current];
  const open = firstOpen(sets);
  const sessionDone = isSessionDone(state);

  const lastQuery = useLastExercise(
    step.tracking === 'reps' ? { exercise_id: step.exerciseId ?? undefined, name: step.name } : null,
  );
  const last = step.tracking === 'reps' ? (lastQuery.data ?? null) : null;
  const lastWeight = step.usesWeight ? (last?.weight_kg ?? null) : null;
  const lastLine = last
    ? `Last time, ${formatDayDate(last.date)}: ${last.sets} × ${last.reps ?? 0}${last.weight_kg != null ? ` · ${formatKg(last.weight_kg)} kg` : ''}`
    : null;

  const save = (next: GymState, endedEarly: boolean) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveError(null);
    const at = now().getTime();
    createLog.mutate(
      {
        session_id: session.id,
        sport_id: session.sport_id,
        started_at: toIsoWithOffset(new Date(startedAt)),
        duration_seconds: Math.max(1, Math.round((at - startedAt) / 1000)),
        source: 'live',
        sets: loggedSets(next, at),
        ended_early: endedEarly,
      },
      {
        onSuccess: (log) => router.replace(routes.gymReview(session.id, log.id)),
        onError: (error) => {
          savingRef.current = false;
          setSaveError(isApiError(error) && !error.retryable ? error.message : SAVE_FAILED);
        },
      },
    );
  };

  /** Dispatches, and saves the session when its last set is done. */
  const act = (action: GymAction) => {
    const next = gymReducer(state, action);
    dispatch(action);
    if (action.type === 'log-set' || action.type === 'finish-round') {
      lightTap();
      if (isSessionDone(next)) save(next, false);
    }
  };

  // Countdowns are end moments; these fire when one runs out, even after a re-render.
  const restEndsAt = state.rest?.endsAt ?? null;
  const onRestEnd = useEffectEvent(() => {
    lightTap();
    dispatch({ type: 'rest-end' });
  });
  useEffect(() => {
    if (restEndsAt == null) return;
    const id = setTimeout(onRestEnd, Math.max(0, restEndsAt - now().getTime()));
    return () => clearTimeout(id);
  }, [restEndsAt]);

  const roundEndsAt = state.round.status === 'running' ? state.round.endsAt : null;
  const onRoundEnd = useEffectEvent(() => act({ type: 'finish-round', at: now().getTime() }));
  useEffect(() => {
    if (roundEndsAt == null) return;
    const id = setTimeout(onRoundEnd, Math.max(0, roundEndsAt - now().getTime()));
    return () => clearTimeout(id);
  }, [roundEndsAt]);

  // Android back asks before leaving, like the X.
  const onBack = useEffectEvent(() => {
    if (!savingRef.current) dispatch({ type: 'sheet', sheet: 'end' });
  });
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  const bottom = (() => {
    if (sessionDone) {
      return (
        <Button size="lg" fullWidth loading={createLog.isPending} onPress={() => save(state, false)}>
          {saveError ? 'Try again' : 'Saving your session'}
        </Button>
      );
    }
    if (open === -1) {
      return (
        <Button size="lg" fullWidth iconRight="arrow-right" onPress={() => dispatch({ type: 'next-exercise' })}>
          Next exercise
        </Button>
      );
    }
    if (step.tracking === 'reps') {
      if (state.editing !== null) {
        const n = state.editing + 1;
        return (
          <Button
            size="lg"
            fullWidth
            iconRight="check"
            onPress={() => {
              Keyboard.dismiss();
              dispatch({ type: 'edit-set', set: null });
            }}>
            {`Save set ${n}`}
          </Button>
        );
      }
      return (
        <Button
          size="lg"
          fullWidth
          iconRight="check"
          onPress={() => {
            Keyboard.dismiss();
            act({ type: 'log-set', at: now().getTime(), fallbackWeight: lastWeight });
          }}>
          {`Set ${open + 1} done`}
        </Button>
      );
    }
    if (state.round.status === 'ready') {
      return (
        <Button size="lg" fullWidth icon="play" onPress={() => act({ type: 'start-round', at: now().getTime() })}>
          Start
        </Button>
      );
    }
    const paused = state.round.status === 'paused';
    return (
      <>
        <Button
          variant="secondary"
          size="lg"
          icon={paused ? 'play' : 'pause'}
          onPress={() => act({ type: paused ? 'resume-round' : 'pause-round', at: now().getTime() })}>
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button size="lg" iconRight="check" style={{ flex: 1 }} onPress={() => act({ type: 'finish-round', at: now().getTime() })}>
          Done
        </Button>
      </>
    );
  })();

  return (
    <Screen>
      <SessionTop
        startedAt={startedAt}
        onPlan={() => dispatch({ type: 'sheet', sheet: 'plan' })}
        onEnd={() => dispatch({ type: 'sheet', sheet: 'end' })}
      />
      <Content gap={step.tracking === 'time' ? 20 : 16} bottomInset="bottomBar">
        <Col gap={6}>
          <Kicker tabular>{`Exercise ${state.current + 1} of ${state.steps.length} · ${plannedLabel(step)}`}</Kicker>
          <H2>{step.name}</H2>
          {step.description ? <Text variant="bodySm">{step.description}</Text> : null}
        </Col>
        {step.tracking === 'reps' ? (
          <SetList
            step={step}
            sets={sets}
            current={open}
            editing={state.editing}
            lastWeight={lastWeight}
            last={lastLine}
            onOpen={(set) => dispatch({ type: 'edit-set', set })}
            onReps={(set, value) => dispatch({ type: 'set-reps', set, value })}
            onWeight={(set, value) => dispatch({ type: 'set-weight', set, value })}
            onAddSet={() => dispatch({ type: 'add-set' })}
          />
        ) : (
          <TimedPanel state={state} />
        )}
        {saveError && !state.sheet ? (
          <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Icon name="circle-alert" size={16} color={colors.danger} />
            <Text variant="bodySm" tone="danger" style={{ flex: 1 }}>
              {saveError}
            </Text>
          </View>
        ) : null}
      </Content>
      <BottomBar>{bottom}</BottomBar>

      <RestSheet
        state={state}
        onExtend={() => dispatch({ type: 'rest-extend', ms: REST_EXTEND_MS })}
        onSkip={() => dispatch({ type: 'rest-end' })}
        onEdit={() => dispatch({ type: 'edit-saved' })}
      />
      <PlanSheet
        state={state}
        startedAt={startedAt}
        plannedMinutes={sessionMinutes(session)}
        lastWeight={lastWeight}
        onClose={() => dispatch({ type: 'sheet', sheet: null })}
        onGoTo={(exercise) => dispatch({ type: 'go-to', exercise })}
      />
      <EndSheet
        state={state}
        startedAt={startedAt}
        saving={createLog.isPending}
        error={saveError}
        onSave={() => save(state, !sessionDone)}
        onLeave={close}
        onKeepGoing={() => dispatch({ type: 'sheet', sheet: null })}
      />
    </Screen>
  );
}

