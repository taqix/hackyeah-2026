import { type Href, useRouter } from 'expo-router';

import { useAssistantSummary } from '@/api/hooks';
import type { SummaryEvidence, SummaryStatement } from '@/api/types';
import { Button, type DiscTone, type IconName, ListRow, Skeleton, Text } from '@/components/ui';
import { BackButton, Body, Col, Content, H1, Kicker, Screen, TopBar } from '@/components/layout';
import { SECTION_META } from '@/lib/preference-options';
import { routes } from '@/navigation/routes';

import { ErrorState, InfoCaption, RowsSkeleton } from './pieces';

/** Where a stored fact is changed: its answer in Profile › Edit, its session, or Your feedback. */
function evidenceTarget(evidence: SummaryEvidence): { href: Href; hint: string } {
  if (evidence.kind === 'answer' && evidence.section) {
    return { href: routes.profileEdit(evidence.section), hint: 'Opens this answer to change it' };
  }
  if (evidence.session_id) return { href: routes.session(evidence.session_id), hint: 'Opens this session' };
  return { href: '/profile/feedback', hint: 'Opens your feedback' };
}

function evidenceLook(evidence: SummaryEvidence, statement: SummaryStatement): { icon: IconName; tone: DiscTone } {
  if (evidence.kind === 'answer') {
    return { icon: evidence.section ? SECTION_META[evidence.section].icon : 'list-checks', tone: 'accent' };
  }
  return statement.group === 'leave_out' ? { icon: 'ban', tone: 'quiet' } : { icon: 'check', tone: 'success' };
}

/** Why we think this (9.3): one statement and the stored facts behind it, with where to change them. */
export function WhyScreen({ statementId }: { statementId: string }) {
  const router = useRouter();
  const summary = useAssistantSummary();
  const statement = summary.data?.statements.find((s) => s.id === statementId);

  return (
    <Screen>
      <TopBar left={<BackButton />} />
      <Content gap={20}>
        {summary.isPending ? (
          <Col gap={20} accessible accessibilityLabel="Loading">
            <Col gap={10}>
              <Skeleton width="40%" height={12} />
              <Skeleton height={24} />
              <Skeleton width="65%" height={24} />
            </Col>
            <RowsSkeleton count={3} disc={32} />
          </Col>
        ) : summary.isError ? (
          <>
            <H1>Why we think this</H1>
            <ErrorState title="We couldn't load the summary" onRetry={() => void summary.refetch()} />
          </>
        ) : !statement ? (
          <>
            <H1>Why we think this</H1>
            <Body>Our assistant has rewritten the summary since, so this statement is gone.</Body>
            <Button
              variant="secondary"
              onPress={() => router.replace('/profile/summary')}
              style={{ alignSelf: 'flex-start' }}>
              See the summary
            </Button>
          </>
        ) : (
          <Statement statement={statement} />
        )}
      </Content>
    </Screen>
  );
}

function Statement({ statement }: { statement: SummaryStatement }) {
  const router = useRouter();
  const fromFeedback = statement.evidence.some((e) => e.kind !== 'answer');
  const answerSection = statement.evidence.find((e) => e.kind === 'answer' && e.section)?.section ?? null;

  return (
    <>
      <Col gap={6}>
        <Kicker>Why we think this</Kicker>
        <Text variant="heading" accessibilityRole="header">
          {statement.text}
        </Text>
        <Text variant="caption">{statement.source_label}</Text>
      </Col>
      <Col gap={0}>
        {statement.evidence.map((evidence, i) => {
          const target = evidenceTarget(evidence);
          const look = evidenceLook(evidence, statement);
          return (
            <ListRow
              key={evidence.id}
              icon={look.icon}
              discTone={look.tone}
              discSize={32}
              title={evidence.title}
              detail={evidence.detail}
              divider={i > 0}
              onPress={() => router.push(target.href)}
              accessibilityHint={target.hint}
            />
          );
        })}
      </Col>
      <Col gap={10}>
        {fromFeedback ? <InfoCaption>Only your answers count. A busy or skipped day never counts as a no.</InfoCaption> : null}
        <InfoCaption>
          The summary never changes anything. Change the answer behind it, and the summary follows.
        </InfoCaption>
      </Col>
      {fromFeedback ? (
        <Button variant="secondary" size="lg" fullWidth onPress={() => router.push('/profile/feedback')}>
          Change feedback
        </Button>
      ) : answerSection ? (
        <Button variant="secondary" size="lg" fullWidth onPress={() => router.push(routes.profileEdit(answerSection))}>
          Change this answer
        </Button>
      ) : null}
    </>
  );
}
