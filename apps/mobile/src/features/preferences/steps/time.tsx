import { StyleSheet } from 'react-native';

import { Question, RangeSlider, Slider } from '@/components/ui';
import { Col, Columns, useLayout } from '@/components/layout';
import { hourText, PREF_SLIDERS, windowText } from '@/lib/preference-options';

import { OnboardingHeading } from './heading';
import type { StepBodyProps } from './types';

const { sessions_per_week: SESSIONS, session_minutes: MINUTES, preferred_window: WINDOW } = PREF_SLIDERS;
/** No window (any time) sits on the whole bar. */
const WHOLE_BAR: [number, number] = [WINDOW.range.min, WINDOW.range.max];

/**
 * 3.1 Time: sessions_per_week, session_minutes and the optional preferred_window.
 * On a wide desktop the two number sliders sit side by side above the window.
 */
export function TimeStep({ draft, update, mode }: StepBodyProps) {
  const { isDesktop, isWide } = useLayout();
  // Side by side, each question keeps its slider at the bottom so the two tracks line up.
  const column = isWide ? styles.column : undefined;

  const sessions = (
    <Col gap={12} style={column}>
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
  );
  const minutes = (
    <Col gap={12} style={column}>
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
  );

  return (
    <Col gap={isDesktop ? 32 : 24}>
      {mode === 'onboarding' ? (
        <OnboardingHeading section="time" title="Start small" body="Pick what feels easy. You can change it later." />
      ) : null}
      {isDesktop ? (
        <Columns from="wide" gap={32} align="stretch">
          {sessions}
          {minutes}
        </Columns>
      ) : (
        <>
          {sessions}
          {minutes}
        </>
      )}
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

const styles = StyleSheet.create({
  column: { flex: 1, justifyContent: 'space-between' },
});
