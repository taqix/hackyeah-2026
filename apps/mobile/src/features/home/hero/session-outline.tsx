import { StyleSheet, View } from 'react-native';

import { useSport } from '@/api/hooks';
import { isGymSession, type PlannedSession } from '@/api/types';
import { suggestionInk, Text } from '@/components/ui';
import { exerciseDetail } from '@/features/workout/activity/workout-text';
import { useTheme } from '@/theme';

/** More would crowd the card; the session page lists everything. */
const MAX_STEPS = 6;

/**
 * What the session holds, on the large hero: the plan's parts in order, or the
 * gym exercises with their sets. Light on the dark photo card.
 */
export function SessionOutline({ session }: { session: PlannedSession }) {
  const { fontFamily } = useTheme();
  const sport = useSport(session.sport_id).data ?? null;
  const steps = isGymSession(session)
    ? session.exercises.map((exercise) => `${exercise.name} · ${exerciseDetail(exercise, sport)}`)
    : session.parts.map((part) => part.description);
  if (!steps.length) return null;
  const shown = steps.slice(0, MAX_STEPS);
  const more = steps.length - shown.length;

  return (
    <View accessibilityLabel="In this session" style={[styles.outline, { borderTopColor: suggestionInk.track }]}>
      <View style={styles.steps}>
        {shown.map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={[styles.number, { borderColor: suggestionInk.track }]}>
              <Text style={{ fontFamily: fontFamily.displaySemibold, fontSize: 12, lineHeight: 14, color: suggestionInk.text }}>
                {i + 1}
              </Text>
            </View>
            <Text style={[styles.stepText, { fontFamily: fontFamily.bodyRegular, color: suggestionInk.body }]}>{step}</Text>
          </View>
        ))}
      </View>
      {more > 0 ? (
        <Text style={{ fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 18, color: suggestionInk.body }}>
          {`And ${more} more in the session.`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outline: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  steps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 20,
    rowGap: 10,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 200,
    minWidth: 0,
  },
  number: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 20,
  },
});
