import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useAssistantSummary } from '@/api/hooks';
import type { AssistantSummary } from '@/api/types';
import { Button, Skeleton, Text } from '@/components/ui';
import { BackButton, Body, Col, Content, H1, Kicker, PageHeader, Screen, TopBar, useLayout } from '@/components/layout';
import { useNow } from '@/lib/clock';
import { routes } from '@/navigation/routes';

import { GROUP_ORDER, GROUP_TITLES, statementIcon, summaryKicker } from './labels';
import { BackLink, PanelCard, Reveal, Split } from './panel';
import { ErrorState, Group, Note, StatementRow } from './pieces';

const TITLE = 'How we see you';
const LITTLE_DATA = "This is from your answers so far. More once you've tried a few sessions.";
const ONLY_YOU = 'Only you change how often, how long and when. We never raise them on our own.';
const SOURCES = 'Written by our assistant from these sources. Something off? Change the answer behind it.';

/** How we see you (9.2): the summary as separate statements, each naming its source. */
export function SummaryScreen() {
  const summary = useAssistantSummary();
  const { isDesktop } = useLayout();

  const body = summary.isPending ? (
    <SummarySkeleton />
  ) : summary.isError ? (
    <>
      <H1>{TITLE}</H1>
      <ErrorState title="We couldn't load the summary" onRetry={() => void summary.refetch()} />
    </>
  ) : summary.data.status === 'unavailable' ? (
    <Unavailable onRetry={() => void summary.refetch()} />
  ) : isDesktop ? (
    <DesktopStatements summary={summary.data} />
  ) : (
    <Statements summary={summary.data} />
  );

  if (isDesktop) {
    return (
      <Screen>
        <Content gap={24} maxWidth={1040}>
          <BackLink label="You" href="/you" />
          {body}
        </Content>
      </Screen>
    );
  }
  return (
    <Screen>
      <TopBar left={<BackButton />} />
      <Content gap={20}>{body}</Content>
    </Screen>
  );
}

function statementGroups(summary: AssistantSummary) {
  return GROUP_ORDER.map((group) => ({
    group,
    statements: summary.statements.filter((s) => s.group === group),
  })).filter((g) => g.statements.length > 0);
}

function Statements({ summary }: { summary: AssistantSummary }) {
  const router = useRouter();
  const today = useNow();
  const groups = statementGroups(summary);

  return (
    <>
      <Col gap={6}>
        <Kicker>{summaryKicker(summary, today)}</Kicker>
        <H1>{TITLE}</H1>
      </Col>
      {summary.little_data ? <Note icon="sprout">{LITTLE_DATA}</Note> : null}
      {groups.map(({ group, statements }) => (
        <Group key={group} title={GROUP_TITLES[group]} gap={2}>
          {statements.map((statement, i) => (
            <StatementRow
              key={statement.id}
              text={statement.text}
              source={statement.source_label}
              icon={statementIcon(statement)}
              divider={i > 0}
              onPress={() => router.push(routes.why(statement.id))}
            />
          ))}
        </Group>
      ))}
      <Note icon="lock">{ONLY_YOU}</Note>
      <Text variant="caption">{SOURCES}</Text>
    </>
  );
}

/** Desktop: one card per group beside a column on what the summary is and isn't. */
function DesktopStatements({ summary }: { summary: AssistantSummary }) {
  const router = useRouter();
  const today = useNow();
  const groups = statementGroups(summary);

  return (
    <>
      <Reveal>
        <PageHeader
          kicker={summaryKicker(summary, today)}
          title={TITLE}
          subtitle="Each line names where it comes from. Open one to see the facts behind it."
        />
      </Reveal>
      <Split
        stickySide
        main={groups.map(({ group, statements }, index) => (
          <Reveal key={group} order={index + 1}>
            <PanelCard title={GROUP_TITLES[group]} gap={4}>
              <View>
                {statements.map((statement, i) => (
                  <StatementRow
                    key={statement.id}
                    text={statement.text}
                    source={statement.source_label}
                    icon={statementIcon(statement)}
                    divider={i > 0}
                    onPress={() => router.push(routes.why(statement.id))}
                  />
                ))}
              </View>
            </PanelCard>
          </Reveal>
        ))}
        side={
          <Reveal order={2} style={{ gap: 16 }}>
            {summary.little_data ? <Note icon="sprout">{LITTLE_DATA}</Note> : null}
            <Note icon="lock">{ONLY_YOU}</Note>
            <Text variant="caption">{SOURCES}</Text>
            <Button
              variant="secondary"
              icon="list-checks"
              onPress={() => router.navigate('/you')}
              style={{ alignSelf: 'flex-start' }}>
              See your answers
            </Button>
          </Reveal>
        }
      />
    </>
  );
}

/** Generation failed: nothing waits for it, the answers on You still shape the plan. */
function Unavailable({ onRetry }: { onRetry: () => void }) {
  const router = useRouter();
  return (
    <>
      <H1>{TITLE}</H1>
      <Body style={{ maxWidth: 640 }}>
        Our assistant couldn&apos;t write your summary just now. Your answers still shape your plan, and you can
        change them on the You tab.
      </Body>
      <Col gap={8}>
        <Button variant="secondary" icon="refresh-cw" onPress={onRetry} style={{ alignSelf: 'flex-start' }}>
          Try again
        </Button>
        <Button variant="ghost" onPress={() => router.navigate('/you')} style={{ alignSelf: 'flex-start' }}>
          See your answers
        </Button>
      </Col>
    </>
  );
}

function SummarySkeleton() {
  return (
    <Col gap={20} accessible accessibilityLabel="Loading">
      <Col gap={10}>
        <Skeleton width="60%" height={12} />
        <Skeleton width="80%" height={36} />
      </Col>
      {[0, 1, 2].map((i) => (
        <Col key={i} gap={10}>
          <Skeleton width="35%" height={12} />
          <Skeleton height={16} />
          <Skeleton width="70%" height={16} />
          <Skeleton width="40%" height={12} />
        </Col>
      ))}
    </Col>
  );
}
