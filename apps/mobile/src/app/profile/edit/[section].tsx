import { useLocalSearchParams } from 'expo-router';

import { asPreferenceSection } from '@/features/preferences/edit/edit-draft';
import { EditAnswersScreen } from '@/features/preferences/edit/edit-screen';

/** 9.4 Edit answers: `section` is one onboarding step. */
export default function EditAnswersRoute() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  return <EditAnswersScreen section={asPreferenceSection(section)} />;
}
