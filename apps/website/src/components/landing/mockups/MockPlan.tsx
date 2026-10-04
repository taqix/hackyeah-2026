import { Badge, Icon, SuggestionCard } from "../../../design-system";
import { Kicker } from "../../common";
import { MOCK_SESSIONS, MOCK_STEPS_TODAY, MOCK_WEEK } from "./data";
import { MockNav } from "./MockNav";

function MockStrip() {
  return (
    <div className="m-strip">
      {MOCK_WEEK.map(day => (
        <span key={day.date} className={`m-sday${day.today ? " is-today" : ""}${day.state ? ` is-${day.state}` : ""}`}>
          <span className="m-sini">{day.initial}</span>
          <span className="m-sdisc">
            {day.date}
            {day.state === "done" ? <span className="m-scheck"><Icon name="check" size={10} strokeWidth={3.25} /></span> : null}
          </span>
          <span className="m-sdot" />
        </span>
      ))}
    </div>
  );
}

function MockSessionList() {
  return (
    <div className="s-col" style={{ marginTop: 8 }}>
      <div className="s-row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="s-sect">This week</span>
        <span className="s-cap">1 of 3 done</span>
      </div>
      <p className="s-bodysm" style={{ marginTop: 6 }}>
        Three short sessions, with rest days between. There's no need to add more.
      </p>
      <div style={{ marginTop: 8 }}>
        {MOCK_SESSIONS.map(session => (
          <div key={session.date} className="m-srow">
            <span className="s-cday"><b>{session.day}</b><span className="s-cap">{session.date}</span></span>
            <span className="s-col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <span className="s-ctitle" style={session.end === "done" ? { color: "var(--text-secondary)" } : undefined}>
                {session.title}
              </span>
              <span className="s-cap">{session.meta}</span>
            </span>
            {session.end === "done" ? <Badge tone="success" dot>Done</Badge>
              : session.end === "today" ? <span className="s-label" style={{ color: "var(--accent-text)" }}>Today</span>
              : <Icon name="chevron-right" size={18} style={{ color: "var(--text-tertiary)" }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Home 5: the Today tab, on the Wednesday of Ana's first week. */
export function MockPlan() {
  return (
    <>
      <div className="m-content" style={{ gap: 20 }}>
        <div className="s-col" style={{ gap: 4 }}>
          <Kicker>Wednesday, 7 October · Week 1</Kicker>
          <div className="m-h1">Good morning, Ana</div>
        </div>
        <div className="s-row" style={{ justifyContent: "space-between", marginBottom: -12 }}>
          <span className="s-label" style={{ color: "var(--text-secondary)" }}>5–11 Oct · this week</span>
          <span className="s-row" style={{ gap: 14, color: "var(--text-tertiary)", opacity: 0.4 }}>
            <Icon name="chevron-left" size={18} />
            <Icon name="chevron-right" size={18} />
          </span>
        </div>
        <MockStrip />
        <SuggestionCard
          tone="dusk"
          kicker="Today · 7:00 · 20 min"
          title="Walk-run intervals."
          body="Six one-minute runs with easy walks between. Slow enough to talk."
          actionLabel="Start"
          secondaryLabel="Not today"
        />
        <div className="m-steps-today">
          <span className="m-stepdisc"><Icon name="footprints" size={20} /></span>
          <span className="s-col" style={{ gap: 2 }}>
            <span className="s-body"><b className="m-num">{MOCK_STEPS_TODAY}</b> steps today</span>
            <span className="s-cap" style={{ color: "var(--text-secondary)" }}>From your phone · updated 9:38</span>
          </span>
        </div>
        <MockSessionList />
      </div>
      <MockNav />
    </>
  );
}
