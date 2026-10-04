import { useRouter } from 'expo-router';

import { useAssistantSummary, usePlanState, useSession } from '@/api/hooks';
import { Content, PageHeader, Screen } from '@/components/layout';
import { Button } from '@/components/ui';
import { useNow } from '@/lib/clock';

import { AnswersPanel } from './answers-panel';
import { EditAnswersMenu } from './edit-answers-menu';
import { FeedbackCard } from './feedback-card';
import { JourneyCard } from './journey-card';
import { youKicker } from './labels';
import { Reveal, Split } from './panel';
import { QuickLinks } from './quick-links';
import { StatementsCard } from './statements-card';
import { SummaryCard } from './summary-card';

/**
 * You on the desktop web (9): the same layers as the phone, side by side. The
 * main column holds our assistant's summary, the answers and the statements;
 * the side column the weeks so far, the feedback and shortcuts.
 */
export function YouDashboard() {
  const router = useRouter();
  const today = useNow();
  const session = useSession();
  const planState = usePlanState();
  const summary = useAssistantSummary();
  const kicker = youKicker(session.data?.user.name, planState.data?.first_week_start, today);
  // A summary that can't be written hides with its statements; nothing waits for it.
  const summaryShown = !summary.isError && summary.data?.status !== 'unavailable';

  return (
    <Screen>
      <Content gap={28}>
        {/* Above the cards, so the open Edit answers menu covers them. */}
        <Reveal style={{ zIndex: 2 }}>
          <PageHeader
            kicker={kicker ?? undefined}
            title="About you"
            subtitle="What shapes your plan, and how our assistant sees you."
            actions={
              <>
                <EditAnswersMenu />
                <Button variant="secondary" icon="settings" onPress={() => router.push('/settings')}>
                  Settings
                </Button>
              </>
            }
          />
        </Reveal>
        <Split
          main={
            <>
              {summaryShown ? (
                <Reveal order={1}>
                  <SummaryCard today={today} />
                </Reveal>
              ) : null}
              <Reveal order={2}>
                <AnswersPanel />
              </Reveal>
              {summaryShown ? (
                <Reveal order={3}>
                  <StatementsCard today={today} />
                </Reveal>
              ) : null}
            </>
          }
          side={
            <>
              <Reveal order={2}>
                <JourneyCard today={today} />
              </Reveal>
              <Reveal order={3}>
                <FeedbackCard />
              </Reveal>
              <Reveal order={4}>
                <QuickLinks />
              </Reveal>
            </>
          }
        />
      </Content>
    </Screen>
  );
}
