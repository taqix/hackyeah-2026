import type { PreferenceSection } from '@/api/types';
import { Body, Col, H1, Steps, useLayout } from '@/components/layout';
import { ONBOARDING_ORDER } from '@/features/onboarding/order';
import { WizardHeading } from '@/features/onboarding/wizard/heading';
import { SECTION_META } from '@/lib/preference-options';

export type OnboardingHeadingProps = {
  section: PreferenceSection;
  title: string;
  body: string;
};

/**
 * A step's heading in onboarding. Phones: the progress segments, then the
 * title and its line. The desktop wizard shows progress in its rail, so the
 * card names the step instead.
 */
export function OnboardingHeading({ section, title, body }: OnboardingHeadingProps) {
  const { isDesktop } = useLayout();
  const step = ONBOARDING_ORDER.indexOf(section) + 1;
  const total = ONBOARDING_ORDER.length;

  if (isDesktop) {
    const meta = SECTION_META[section];
    return <WizardHeading icon={meta.icon} kicker={`${meta.label} · ${step} of ${total}`} title={title} body={body} />;
  }
  return (
    <>
      <Steps step={step} total={total} />
      <Col gap={8}>
        <H1>{title}</H1>
        <Body>{body}</Body>
      </Col>
    </>
  );
}
