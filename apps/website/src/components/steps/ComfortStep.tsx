import { Radio } from "../../design-system";
import { COMFORT_OPTIONS } from "../../domain";
import { handleRadioArrows } from "../../a11y";
import * as route from "../../routing";
import { AnswersPanel, summaryLine } from "./AnswersPanel";
import { STEP_HEADING_ID, StepShell } from "./StepShell";
import type { StepProps } from "./types";

/** Step 1: how gentle the first week should start. */
export function ComfortStep({ step, answers, sport, visited, breakpoint, today, onAnswer }: StepProps) {
  const panel = <AnswersPanel answers={answers} sport={visited >= 4 ? sport : null} visited={visited} today={today} />;
  const summary = answers.comfort ? summaryLine(answers, sport, visited) : "";

  return (
    <StepShell
      step={step}
      body="No wrong answers. This sets how gentle your first week is."
      cta={{ label: "Continue", disabled: !answers.comfort, onClick: () => route.navigate(route.stepPath(step + 1)) }}
      ctaNote={!answers.comfort ? "Pick one to continue." : null}
      breakpoint={breakpoint}
      panel={panel}
      summary={summary}
    >
      <div role="radiogroup" aria-labelledby={STEP_HEADING_ID} className="s-stack8" onKeyDown={handleRadioArrows}>
        {COMFORT_OPTIONS.map(option => (
          <Radio
            key={option.value}
            variant="card"
            label={option.label}
            description={option.description}
            checked={answers.comfort === option.value}
            onChange={() => onAnswer({ comfort: option.value })}
          />
        ))}
      </div>
    </StepShell>
  );
}
