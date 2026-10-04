import { useRouter } from 'expo-router';
import type { StyleProp, ViewStyle } from 'react-native';

import type { Preferences, SportDefinition } from '@/api/types';
import { ListRow } from '@/components/ui';
import { PREFERENCE_SECTIONS, SECTION_META, sectionLine } from '@/lib/preference-options';
import { routes } from '@/navigation/routes';

type AnswerRowsProps = {
  preferences: Preferences;
  sports: SportDefinition[] | undefined;
  rowStyle?: StyleProp<ViewStyle>;
};

/** One row per onboarding step, each opening its question to change the answer (9.4). */
export function AnswerRows({ preferences, sports, rowStyle }: AnswerRowsProps) {
  const router = useRouter();
  return PREFERENCE_SECTIONS.map((section, i) => (
    <ListRow
      key={section}
      icon={SECTION_META[section].icon}
      title={SECTION_META[section].label}
      detail={sectionLine(section, preferences, sports)}
      divider={i > 0}
      onPress={() => router.push(routes.profileEdit(section))}
      accessibilityHint="Opens this question to change your answer"
      style={rowStyle}
    />
  ));
}
