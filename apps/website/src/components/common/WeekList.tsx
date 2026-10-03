import { Badge, Icon } from "../../design-system";
import { activeVersion, capitalize, dateAt, feelingPhrase, formatDayAndMonth, formatFullDate, SLOTS, sortByOffset,
  weekdayShortName, type Plan, type Session, type Version } from "../../domain";
import { usePrefersReducedMotion } from "../../hooks/useMediaQuery";

function wasChanged(session: Session, version: Version): boolean {
  return session.changedIn === version.number && version.number > 1;
}

function rowLabel(plan: Plan, session: Session, changed: boolean): string {
  const outcome = session.done
    ? `done, ${feelingPhrase(session)}`
    : `${session.minutes} minutes, ${SLOTS[session.slot].inPhrase}`;
  return `${formatFullDate(dateAt(plan, session.offset))}, ${session.title}, ${outcome}${changed ? ", changed" : ""}`;
}

export interface WeekListProps {
  plan: Plan;
  onOpen?: (offset: number) => void;
  /** Set in the landing mockups, where the list is a picture rather than a set of controls. */
  isStatic?: boolean;
  /** Changing this replays the "changed" highlight after a plan change. */
  flashKey?: number;
}

/** "This week": every session in day order. */
export function WeekList({ plan, onOpen, isStatic, flashKey }: WeekListProps) {
  const version = activeVersion(plan);
  const reducedMotion = usePrefersReducedMotion();
  return (
    <ul className="s-wlist">
      {sortByOffset(version.sessions).map(session => {
        const date = dateAt(plan, session.offset);
        const changed = wasChanged(session, version);
        const body = (
          <>
            <span className="s-wday">
              <b>{weekdayShortName(date)}</b>
              <span className="s-cap">{formatDayAndMonth(date)}</span>
            </span>
            <span className="s-wmain">
              <span className="s-wtitle">
                {session.title}
                {changed ? <Badge tone="accent">Changed</Badge> : null}
              </span>
              <span className="s-cap">{session.done ? capitalize(feelingPhrase(session)) : SLOTS[session.slot].label}</span>
            </span>
            <span className="s-wright">
              {session.done ? <Badge tone="success" dot>Done</Badge> : <span>{session.minutes} min</span>}
              <Icon name="chevron-right" size={16} style={{ color: "var(--text-tertiary)" }} />
            </span>
          </>
        );
        return (
          <li key={session.id + (changed ? `-${flashKey}` : "")}>
            {isStatic ? (
              <div className="s-wrow">{body}</div>
            ) : (
              <button
                type="button"
                id={`s-row-${session.offset}`}
                className={`s-wrow${changed && !reducedMotion ? " s-flash" : ""}`}
                aria-label={rowLabel(plan, session, changed)}
                onClick={() => onOpen?.(session.offset)}
              >
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
