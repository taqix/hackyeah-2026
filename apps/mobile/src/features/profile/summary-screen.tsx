import { useRouter } from 'expo-router';

import { useAssistantSummary } from '@/api/hooks';
import type { AssistantSummary } from '@/api/types';
import { Button, Skeleton, Text } from '@/components/ui';
import { BackButton, Body, Col, Content, H1, Kicker, Screen, TopBar } from '@/components/layout';
import { useNow } from '@/lib/clock';
import { routes } from '@/navigation/routes';

import { GROUP_ORDER, GROUP_TITLES, statementIcon, summaryKicker } from './labels';
import { ErrorState, Group, Note, StatementRow } from './pieces';

/** How we see you (9.2): the summary as separate statements, each naming its source. */
export function SummaryScreen() {
  const summary = useAssistantSummary();

  return (
    <Screen>
      <TopBar left={<BackButton />} />
      <Content gap={20}>
        {summary.isPending ? (
          <SummarySkeleton />
        ) : summary.isError ? (
          <>
            <H1>How we see you</H1>
            <ErrorState title="We couldn't load the summary" onRetry={() => void summary.refetch()} />
          </>
        ) : summary.data.status === 'unavailable' ? (
          <Unavailable onRetry={() => void summary.refetch()} />
        ) : (
          <Statements summary={summary.data} />
        )}
      </Content>
    </Screen>
  );
}

function Statements({ summary }: { summary: AssistantSummary }) {
  const router = useRouter();
  const today = useNow();
  const groups = GROUP_ORDER.map((group) => ({
    group,
    statements: summary.statements.filter((s) => s.group === group),
  })).filter((g) => g.statements.length > 0);

  return (
    <>
      <Col gap={6}>
        <Kicker>{summaryKicker(summary, today)}</Kicker>
        <H1>How we see you</H1>
      </Col>
      {summary.little_data ? (
        <Note icon="sprout">This is from your answers so far. More once you&apos;ve tried a few sessions.</Note>
      ) : null}
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
      <Note icon="lock">Only you change how often, how long and when. We never raise them on our own.</Note>
      <Text variant="caption">
        Written by our assistant from these sources. Something off? Change the answer behind it.
      </Text>
    </>
  );
}

/** Generation failed: nothing waits for it, the answers on You still shape the plan. */
function Unavailable({ onRetry }: { onRetry: () => void }) {
  const router = useRouter();
  return (
    <>
      <H1>How we see you</H1>
      <Body>
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
