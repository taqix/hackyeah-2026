import { Question, RangeSlider, Slider } from '@/components/ui';
import { Body, Col, H1, Steps } from '@/components/layout';
import { ONBOARDING_ORDER } from '@/features/onboarding/step-screen';
import { hourText, PREF_SLIDERS, windowText } from '@/lib/preference-options';

import type { StepBodyProps } from './types';

const { sessions_per_week: SESSIONS, session_minutes: MINUTES, preferred_window: WINDOW } = PREF_SLIDERS;
/** No window (any time) sits on the whole bar. */
const WHOLE_BAR: [number, number] = [WINDOW.range.min, WINDOW.range.max];

/** 3.1 Time: sessions_per_week, session_minutes and the optional preferred_window. */
export function TimeStep({ draft, update, mode }: StepBodyProps) {
  return (
    <Col gap={24}>
      {mode === 'onboarding' ? (
        <>
          <Steps step={ONBOARDING_ORDER.indexOf('time') + 1} total={ONBOARDING_ORDER.length} />
          <Col gap={8}>
            <H1>Start small</H1>
            <Body>Pick what feels easy. You can change it later.</Body>
          </Col>
        </>
      ) : null}
      <Col gap={12}>
        <Question>How often would you like to make room for movement?</Question>
        <Slider
          label={SESSIONS.label}
          icon={SESSIONS.icon}
          range={SESSIONS.range}
          format={SESSIONS.format}
          value={draft.sessions_per_week}
          onChange={(value) => update({ sessions_per_week: value })}
        />
      </Col>
      <Col gap={12}>
        <Question>What feels manageable for one session?</Question>
        <Slider
          label={MINUTES.label}
          icon={MINUTES.icon}
          range={MINUTES.range}
          marks={MINUTES.marks}
          format={MINUTES.format}
          value={draft.session_minutes}
          onChange={(value) => update({ session_minutes: value })}
        />
      </Col>
      <Col gap={12}>
        <Question optional hint="Drag both ends. The whole bar means any time.">
          When would you prefer to move?
        </Question>
        {/* The store saves the whole bar as null (any time). */}
        <RangeSlider
          label={WINDOW.label}
          icon={WINDOW.icon}
          range={WINDOW.range}
          marks={WINDOW.marks}
          format={([start, end]) => windowText([start, end])}
          formatValue={hourText}
          value={draft.preferred_window ?? WHOLE_BAR}
          onChange={(value) => update({ preferred_window: value })}
        />
      </Col>
    </Col>
  );
}
