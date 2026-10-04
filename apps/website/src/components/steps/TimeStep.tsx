import { Tag } from "../../design-system";
import { MINUTES_RANGE, SESSIONS_PER_WEEK_RANGE, SLOTS, SLOT_ORDER } from "../../domain";
import * as route from "../../routing";
import { AnswersPanel, summaryLine } from "./AnswersPanel";
import { SliderField } from "./SliderField";
import { StepShell } from "./StepShell";
import { TagGroup } from "./TagGroup";
import type { StepProps } from "./types";

/** Step 3: how often, how long, and when. */
export function TimeStep({ step, answers, sport, visited, breakpoint, today, onAnswer }: StepProps) {
  const panel = <AnswersPanel answers={answers} sport={visited >= 4 ? sport : null} visited={visited} today={today} />;
  const summary = summaryLine(answers, sport, visited);

  return (
    <StepShell
      step={step}
      body="Pick what feels easy. You can change it later."
      cta={{ label: "Continue", onClick: () => route.navigate(route.stepPath(step + 1)) }}
      breakpoint={breakpoint}
      panel={panel}
      summary={summary}
    >
      <div className="s-col" style={{ gap: 28 }}>
        <SliderField
          id="s-g-often"
          label="How often would you like to make room for movement?"
          icon="calendar-days"
          range={SESSIONS_PER_WEEK_RANGE}
          value={answers.sessionsPerWeek}
          onChange={sessionsPerWeek => onAnswer({ sessionsPerWeek })}
          format={count => `${count} ${count === 1 ? "session" : "sessions"} a week`}
          ends={["1", "7"]}
        />
        <SliderField
          id="s-g-length"
          label="What feels manageable for one session?"
          icon="timer"
          range={MINUTES_RANGE}
          value={answers.minutes}
          onChange={minutes => onAnswer({ minutes })}
          format={minutes => `${minutes} min`}
          ends={["5 min", "60 min"]}
        />
        <TagGroup id="s-g-when" label="When would you prefer to move?">
          {SLOT_ORDER.map(key => (
            <Tag key={key} icon={SLOTS[key].icon} selected={answers.slot === key} onClick={() => onAnswer({ slot: key })} style={{ height: 44 }}>
              {SLOTS[key].label}
            </Tag>
          ))}
        </TagGroup>
      </div>
    </StepShell>
  );
}
