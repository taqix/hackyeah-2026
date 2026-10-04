import { activeVersion, dateAt, formatFullDate, SLOTS, sessionAt, weekdayInitial, weekOffsets,
  type Plan, type Session, type Version } from "../../domain";

/** What a day is, as a class and in words: today, a done session, a session, or a rest day. */
function dayState(session: Session | null, isToday: boolean, isSelected: boolean): string {
  const state = session?.done ? " is-done" : session ? " is-session" : " is-rest";
  return `s-day${isToday ? " is-today" : ""}${state}${isSelected ? " is-sel" : ""}`;
}

/** Everything a screen reader needs about a day, since the button itself shows only a number. */
function dayLabel(plan: Plan, version: Version, offset: number, session: Session | null): string {
  const parts = [formatFullDate(dateAt(plan, offset))];
  if (offset === plan.todayOffset) parts.push("today");
  if (!session) parts.push("rest day");
  else if (session.done) parts.push(session.title.toLowerCase(), "done");
  else parts.push(session.title.toLowerCase(), `${session.minutes} minutes`, SLOTS[session.slot].inPhrase);
  if (session && session.changedIn === version.number && version.number > 1) parts.push("changed");
  return parts.join(", ");
}

export interface PlanStripProps {
  plan: Plan;
  selected?: number;
  onSelect?: (offset: number) => void;
  /** Set in the landing mockups, where the strip is a picture rather than a control. */
  isStatic?: boolean;
}

/** The week as seven days, each one selectable. */
export function PlanStrip({ plan, selected, onSelect, isStatic }: PlanStripProps) {
  const version = activeVersion(plan);
  return (
    <div className="s-strip" role={isStatic ? undefined : "group"} aria-label={isStatic ? undefined : "Days this week"}>
      {weekOffsets().map(offset => {
        const date = dateAt(plan, offset);
        const session = sessionAt(version, offset);
        const className = dayState(session, offset === plan.todayOffset, selected === offset);
        const inner = (
          <>
            <span className="s-dini">{weekdayInitial(date)}</span>
            <span className="s-disc">{date.getDate()}</span>
          </>
        );
        if (isStatic) return <div key={offset} className={className}>{inner}</div>;
        return (
          <button
            key={offset}
            id={`s-strip-${offset}`}
            type="button"
            className={className}
            aria-pressed={selected === offset}
            aria-label={dayLabel(plan, version, offset, session)}
            onClick={() => onSelect?.(offset)}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
