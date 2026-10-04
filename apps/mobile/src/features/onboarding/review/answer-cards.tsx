import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useSports } from '@/api/hooks';
import type { PreferenceSection } from '@/api/types';
import { Disc, Icon, PressableScale, Text } from '@/components/ui';
import { ONBOARDING_ORDER } from '@/features/onboarding/order';
import { TileGrid } from '@/features/preferences/choices';
import { SECTION_META } from '@/lib/preference-options';
import { type OnboardingDraft, stepIsComplete } from '@/state/onboarding-draft';
import { useTheme } from '@/theme';

import { answerText } from './review-rows';
import { reviewStepRoute } from './step-navigation';

type AnswerCardProps = {
  section: PreferenceSection;
  value: string;
  detail?: string;
  answered: boolean;
  onPress: () => void;
};

/** One step's answer on the desktop Review: the whole card opens the step to change it. */
function AnswerCard({ section, value, detail, answered, onPress }: AnswerCardProps) {
  const { colors, fontFamily, motion, radius } = useTheme();
  const meta = SECTION_META[section];
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={motion.pressScaleCard}
      accessibilityRole="button"
      accessibilityLabel={[meta.label, value, detail].filter(Boolean).join(', ')}
      accessibilityHint="Opens this question to change it"
      style={({ pressed, hovered }) => [
        styles.card,
        {
          borderRadius: radius.md,
          borderColor: hovered ? colors.borderStrong : colors.borderSubtle,
          backgroundColor: hovered || pressed ? colors.surfaceSunken : colors.surfaceCard,
        },
      ]}>
      <View style={styles.head}>
        <Disc icon={meta.icon} size={36} tone={answered ? 'accent' : 'quiet'} />
        <View style={styles.edit}>
          <Icon name="pencil" size={14} color={colors.accentText} />
          <Text variant="caption" tone="accent">
            Edit
          </Text>
        </View>
      </View>
      <View style={styles.words}>
        <Text variant="caption">{meta.label}</Text>
        <Text
          style={{
            fontFamily: fontFamily.bodySemibold,
            fontSize: 16,
            lineHeight: 21,
            color: answered ? colors.textPrimary : colors.textSecondary,
          }}>
          {value}
        </Text>
        {detail ? <Text variant="bodySm">{detail}</Text> : null}
      </View>
    </PressableScale>
  );
}

/**
 * The desktop Review's answers: a card per step in a grid, appearing one
 * after another. A card opens its step, whose Continue comes back here.
 */
export function AnswerCards({ draft }: { draft: OnboardingDraft }) {
  const router = useRouter();
  const sports = useSports();
  return (
    <TileGrid minItemWidth={240} fillLastRow>
      {ONBOARDING_ORDER.map((section, index) => {
        const { value, detail } = answerText(section, draft, sports.data);
        return (
          <Animated.View key={section} entering={FadeInDown.delay(80 + index * 50).duration(260)} style={styles.cell}>
            <AnswerCard
              section={section}
              value={value}
              detail={detail}
              answered={stepIsComplete(section, draft)}
              onPress={() => router.push(reviewStepRoute(section))}
            />
          </Animated.View>
        );
      })}
    </TileGrid>
  );
}

const styles = StyleSheet.create({
  cell: { flexGrow: 1 },
  card: { flexGrow: 1, gap: 14, padding: 18, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 2 },
  words: { gap: 2 },
});
