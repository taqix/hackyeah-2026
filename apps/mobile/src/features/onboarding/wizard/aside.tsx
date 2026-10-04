import type { ReactNode } from 'react';

import type { PreferenceSection } from '@/api/types';
import { Card, Divider, Icon, type IconName, Text } from '@/components/ui';
import { Col, Row } from '@/components/layout';
import { useTheme } from '@/theme';

/** Why each question is asked and what the answer changes in the plan (desktop aside copy). */
const STEP_NOTES: Record<PreferenceSection, { why: string; plan: string }> = {
  starting: {
    why: "Starting too hard is an easy way to lose momentum. We'd rather you finish week one wanting more.",
    plan: 'How long and how demanding your first sessions are.',
  },
  time: {
    why: 'A plan only helps if it fits your week. Small and steady beats big and rare.',
    plan: 'How many sessions we plan, how long each one is, and the hours we place them in.',
  },
  activities: {
    why: "You'll keep doing what you enjoy. Pick anything that sounds good, even if it's new to you.",
    plan: 'Which sports your sessions use, and whether we mix in something new now and then.',
  },
  places: {
    why: 'So every session works where you are, with what you have.',
    plan: 'Where sessions happen and which exercises they use. We only plan with the equipment you pick.',
  },
  extras: {
    why: 'Both questions are optional. They help us steer around what puts you off.',
    plan: "We leave out what you'd rather avoid and keep what makes starting hard in mind.",
  },
};

/** A quiet panel beside the wizard card. */
export function AsidePanel({ children }: { children: ReactNode }) {
  return (
    <Card variant="sunken" padding={24} style={{ gap: 18 }}>
      {children}
    </Card>
  );
}

/** One note in the aside: an icon and a short title over a line or two. */
export function AsideNote({ icon, title, children }: { icon: IconName; title: string; children: string }) {
  const { colors } = useTheme();
  return (
    <Col gap={6}>
      <Row gap={8}>
        <Icon name={icon} size={18} color={colors.accentText} />
        <Text variant="bodyStrong">{title}</Text>
      </Row>
      <Text variant="bodySm">{children}</Text>
    </Col>
  );
}

/** "Why we ask" and "In your plan" for one question step. */
export function StepAside({ section }: { section: PreferenceSection }) {
  const notes = STEP_NOTES[section];
  return (
    <AsidePanel>
      <AsideNote icon="circle-help" title="Why we ask">
        {notes.why}
      </AsideNote>
      <Divider />
      <AsideNote icon="sliders-horizontal" title="In your plan">
        {notes.plan}
      </AsideNote>
    </AsidePanel>
  );
}
