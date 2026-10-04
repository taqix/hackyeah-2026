import { Question, RadioCard, RadioGroup, Text } from '@/components/ui';
import { Col, useLayout } from '@/components/layout';
import { ChoiceGrid, OptionCard } from '@/features/preferences/choices';
import { effectiveDiscovery, PREF_OPTIONS } from '@/lib/preference-options';
import { discoveryLocked, type OnboardingDraft } from '@/state/onboarding-draft';

const QUESTION = 'Would you like occasional new suggestions?';

export type DiscoveryQuestionProps = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
};

/**
 * discovery_preference: radio cards, side by side on the desktop web. With no
 * sport picked it reads explore and the other two are disabled.
 */
export function DiscoveryQuestion({ draft, update }: DiscoveryQuestionProps) {
  const { isDesktop } = useLayout();
  const locked = discoveryLocked(draft);
  const current = effectiveDiscovery(draft);
  return (
    <Col gap={isDesktop ? 16 : 12}>
      <Question>{QUESTION}</Question>
      {isDesktop ? (
        <ChoiceGrid label={QUESTION} kind="radio" minItemWidth={184}>
          {PREF_OPTIONS.discovery_preference.map((o) => (
            <OptionCard
              key={o.value}
              kind="radio"
              label={o.label}
              selected={current === o.value}
              disabled={locked && o.value !== 'explore'}
              onPress={() => update({ discovery_preference: o.value })}
            />
          ))}
        </ChoiceGrid>
      ) : (
        <RadioGroup label={QUESTION}>
          {PREF_OPTIONS.discovery_preference.map((o) => (
            <RadioCard
              key={o.value}
              label={o.label}
              checked={current === o.value}
              disabled={locked && o.value !== 'explore'}
              onPress={() => update({ discovery_preference: o.value })}
            />
          ))}
        </RadioGroup>
      )}
      {locked ? <Text variant="caption">Pick a sport to choose the other options.</Text> : null}
    </Col>
  );
}
