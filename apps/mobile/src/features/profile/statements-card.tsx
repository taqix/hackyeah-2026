import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAssistantSummary } from '@/api/hooks';
import { Text, TextLink } from '@/components/ui';
import { routes } from '@/navigation/routes';

import { GROUP_ORDER, GROUP_TITLES, statementIcon, summaryKicker } from './labels';
import { PanelCard } from './panel';
import { Note, RowsSkeleton, StatementRow } from './pieces';

const TITLE = 'How we see you';

/**
 * You (desktop): the summary's statements under their groups, each naming its
 * source and opening Why we think this (9.3). Hidden with the summary card
 * when the summary can't be written; the answers still shape the plan.
 */
export function StatementsCard({ today }: { today: Date }) {
  const router = useRouter();
  const summary = useAssistantSummary();

  if (summary.isPending) {
    return (
      <PanelCard title={TITLE}>
        <RowsSkeleton count={3} disc={0} />
      </PanelCard>
    );
  }
  const data = summary.data;
  if (!data || data.status === 'unavailable' || data.statements.length === 0) return null;

  const groups = GROUP_ORDER.map((group) => ({
    group,
    statements: data.statements.filter((s) => s.group === group),
  })).filter((g) => g.statements.length > 0);

  return (
    <PanelCard
      title={TITLE}
      caption={summaryKicker(data, today)}
      gap={16}
      action={
        <TextLink onPress={() => router.push('/profile/summary')} accessibilityHint="Opens the whole summary">
          See all
        </TextLink>
      }>
      {data.little_data ? (
        <Note icon="sprout">This is from your answers so far. More once you&apos;ve tried a few sessions.</Note>
      ) : null}
      {groups.map(({ group, statements }) => (
        <View key={group} style={styles.group}>
          <Text variant="label" tone="secondary" accessibilityRole="header">
            {GROUP_TITLES[group]}
          </Text>
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
        </View>
      ))}
      <Text variant="caption">Written by our assistant from these sources. Something off? Change the answer behind it.</Text>
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  group: { gap: 2 },
});
