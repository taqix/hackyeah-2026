/* The planning moment between answering the last question and seeing the plan: a short,
   staged "reading your answers... drafting... checking... saving" animation that always
   ends by calling onDone, whether or not it played. */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Card, Icon } from "../../design-system";
import { planningKicker, planningSteps, type Answers, type SportKey } from "../../domain";
import { prefersReducedMotion } from "../../hooks/useMediaQuery";
import { Kicker, WeekDots } from "../common";

export interface PlanningViewProps {
  answers: Answers;
  sport: SportKey;
  today: Date;
  onDone: () => void;
}

/** How many of a step's checklist parts are ticked, one at a time, while it runs. */
const CHECKLIST_TICK_DELAYS_MS = [160, 320, 480, 640];

function stepIcon(index: number, stepsDone: number, reduced: boolean): ReactNode {
  if (index < stepsDone) {
    return (
      <span className={reduced ? "" : "s-pop"} style={{ display: "flex" }}>
        <Icon name="circle-check" size={22} style={{ color: "var(--success)" }} />
      </span>
    );
  }
  if (index === stepsDone) {
    return (
      <span className="s-spin" style={{ display: "flex", color: "var(--accent-text)" }}>
        <Icon name="loader-circle" size={22} />
      </span>
    );
  }
  return <Icon name="circle-dashed" size={22} style={{ color: "var(--text-tertiary)" }} />;
}

export function PlanningView({ answers, sport, today, onDone }: PlanningViewProps) {
  const reduced = useRef(prefersReducedMotion()).current;
  const steps = useMemo(() => planningSteps(sport, answers, today), []);
  const [stepsDone, setStepsDone] = useState(reduced ? 4 : 0);
  const [checksDone, setChecksDone] = useState(reduced ? 4 : 0);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (delayMs: number, run: () => void) => timers.push(setTimeout(run, delayMs));
    if (reduced) {
      schedule(30, () => setAnnouncement("Your first week is ready."));
      schedule(800, onDone);
    } else {
      schedule(550, () => { setStepsDone(1); setAnnouncement(steps[0].label); });
      schedule(1100, () => { setStepsDone(2); setAnnouncement(steps[1].label); });
      CHECKLIST_TICK_DELAYS_MS.forEach((delayMs, index) => schedule(1100 + delayMs, () => setChecksDone(index + 1)));
      schedule(1900, () => { setStepsDone(3); setAnnouncement(steps[2].label); });
      schedule(2300, () => { setStepsDone(4); setAnnouncement(`${steps[3].label}. Your first week is ready.`); });
      schedule(2600, onDone);
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="s-wrap">
      <div className="s-planning s-enter">
        <Card padding={24} style={{ padding: "clamp(20px, 5vw, 32px)" }}>
          <div className="s-col" style={{ gap: 24 }}>
            <div className="s-col" style={{ gap: 10 }}>
              <Kicker>{planningKicker(sport, answers)}</Kicker>
              <h1 className="s-h1" tabIndex={-1} data-page-title="">Planning your week</h1>
            </div>
            <div className="s-col" style={{ gap: 10 }}>
              {steps.map((step, index) => (
                <div key={step.label} className={"s-pstep" + (index > stepsDone ? " is-pending" : "")}>
                  <span className="s-picon">{stepIcon(index, stepsDone, reduced)}</span>
                  <span className="s-col" style={{ gap: 3, minWidth: 0 }}>
                    <span className="s-plabel">{step.label}</span>
                    {step.caption ? <span className="s-cap">{step.caption}</span> : null}
                    {step.parts ? (
                      <span className="s-checks">
                        {step.parts.map((part, partIndex) => (
                          <span key={part}>
                            {partIndex < checksDone ? <Icon name="check" size={14} style={{ color: "var(--success)" }} /> : null}
                            {part}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
            <WeekDots today={today} sessionsPerWeek={answers.sessionsPerWeek} sport={sport} phase={stepsDone >= 2 ? "fill" : "ring"} />
          </div>
        </Card>
        <p className="s-sr" aria-live="polite">{announcement}</p>
      </div>
    </div>
  );
}
