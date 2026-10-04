import { useRouter } from 'expo-router';

import { useSports } from '@/api/hooks';
import type { PreferenceSection, SportDefinition } from '@/api/types';
import { ListRow } from '@/components/ui';
import { ONBOARDING_ORDER } from '@/features/onboarding/order';
import { SECTION_META, sectionSummary } from '@/lib/preference-options';
import { type OnboardingDraft, stepIsComplete } from '@/state/onboarding-draft';

import { reviewStepRoute } from './step-navigation';

const NOT_ANSWERED = 'Not answered yet';

/** A step's answer as Review shows it: the summary line and its detail, or "Not answered yet". */
export function answerText(section: PreferenceSection, draft: OnboardingDraft, sports: SportDefinition[] | undefined) {
  if (!stepIsComplete(section, draft)) return { value: NOT_ANSWERED, detail: undefined };
  const summary = sectionSummary(section, draft, sports);
  return { value: summary.value, detail: summary.detail ?? undefined };
}

/** One row per step, grouped like the steps; a row opens its step, whose back returns here. */
export function ReviewRows({ draft }: { draft: OnboardingDraft }) {
  const router = useRouter();
  const sports = useSports();
  return (
    <>
      {ONBOARDING_ORDER.map((section, index) => {
        const meta = SECTION_META[section];
        const { value, detail } = answerText(section, draft, sports.data);
        return (
          <ListRow
            key={section}
            divider={index > 0}
            icon={meta.icon}
            label={meta.label}
            title={value}
            detail={detail}
            onPress={() => router.push(reviewStepRoute(section))}
            accessibilityLabel={[meta.label, value, detail].filter(Boolean).join(', ')}
            accessibilityHint="Opens this question to change it"
          />
        );
      })}
    </>
  );
}
