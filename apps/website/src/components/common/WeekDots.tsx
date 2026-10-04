import { Icon } from "../../design-system";
import { addDays, SPORTS, sessionDayOffsets, weekdayInitial, weekOffsets, type SportKey } from "../../domain";

/** How far the week has taken shape: plain days, rings around the session days, then
    the sessions filled in with the sport's icon. */
export type WeekPhase = "neutral" | "ring" | "fill";

const PHASE_CLASS: Record<WeekPhase, string> = { neutral: "", ring: " is-ring", fill: " is-fill" };

export interface WeekDotsProps {
  today: Date;
  sessionsPerWeek: number;
  sport?: SportKey | null;
  phase: WeekPhase;
}

/** The small week strip on the question panel and the planning moment. */
export function WeekDots({ today, sessionsPerWeek, sport, phase }: WeekDotsProps) {
  const sessionDays = sessionDayOffsets(sessionsPerWeek);
  return (
    <div className="s-ministrip" aria-hidden="true">
      {weekOffsets().map(offset => {
        const date = addDays(today, offset);
        const hasSession = sessionDays.includes(offset);
        const showIcon = hasSession && phase === "fill" && !!sport;
        return (
          <div key={offset} className="s-mday">
            <span className="s-cap">{weekdayInitial(date)}</span>
            <span className={`s-mdisc${hasSession ? PHASE_CLASS[phase] : ""}`}>
              {showIcon && sport ? <Icon name={SPORTS[sport].icon} size={16} /> : date.getDate()}
            </span>
            <span className="s-mnum">{showIcon ? date.getDate() : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
