import { useState, useEffect, useRef, useMemo } from "react";
import { Icon, Card } from "../design-system";
import { Logic } from "../logic";
import { reducedNow } from "../lib";
import { Kicker, MiniStrip } from "./shared";
import type { Answers } from "../types";

/* ============ planning moment ============ */
function PlanningView({ answers, sport, today, onDone }: { answers: Answers; sport: string; today: Date; onDone: () => void }) {
  const reduced = useRef(reducedNow()).current;
  const steps = useMemo(() => Logic.planningSteps(sport, answers, today), []);
  const [done, setDone] = useState(reduced ? 4 : 0);   // steps completed
  const [parts, setParts] = useState(reduced ? 4 : 0); // check parts ticked
  const [said, setSaid] = useState("");
  useEffect(() => {
    const T = [], at = (ms, f) => T.push(setTimeout(f, ms));
    if (reduced) {
      at(30, () => setSaid("Your first week is ready."));
      at(800, onDone);
    } else {
      at(550, () => { setDone(1); setSaid(steps[0].label); });
      at(1100, () => { setDone(2); setSaid(steps[1].label); });
      [160, 320, 480, 640].forEach((ms, i) => at(1100 + ms, () => setParts(i + 1)));
      at(1900, () => { setDone(3); setSaid(steps[2].label); });
      at(2300, () => { setDone(4); setSaid(steps[3].label + ". Your first week is ready."); });
      at(2600, onDone);
    }
    return () => T.forEach(clearTimeout);
  }, []);
  const icon = i => {
    if (i < done) return <span key="d" className={reduced ? "" : "s-pop"} style={{ display: "flex" }}><Icon name="circle-check" size={22} style={{ color: "var(--success)" }} /></span>;
    if (i === done) return <span key="a" className="s-spin" style={{ display: "flex", color: "var(--accent-text)" }}><Icon name="loader-circle" size={22} /></span>;
    return <Icon name="circle-dashed" size={22} style={{ color: "var(--text-tertiary)" }} />;
  };
  return (
    <div className="s-wrap">
      <div className="s-planning s-enter">
        <Card padding={24} style={{ padding: "clamp(20px, 5vw, 32px)" }}>
          <div className="s-col" style={{ gap: 24 }}>
            <div className="s-col" style={{ gap: 10 }}>
              <Kicker>{Logic.planningKicker(sport, answers)}</Kicker>
              <h1 className="s-h1" tabIndex={-1} data-page-title="">Planning your week</h1>
            </div>
            <div className="s-col" style={{ gap: 10 }}>
              {steps.map((s, i) => (
                <div key={s.label} className={"s-pstep" + (i > done ? " is-pending" : "")}>
                  <span className="s-picon">{icon(i)}</span>
                  <span className="s-col" style={{ gap: 3, minWidth: 0 }}>
                    <span className="s-plabel">{s.label}</span>
                    {s.caption ? <span className="s-cap">{s.caption}</span> : null}
                    {s.parts ? <span className="s-checks">{s.parts.map((p, j) => (
                      <span key={p}>{j < parts ? <Icon name="check" size={14} style={{ color: "var(--success)" }} /> : null}{p}</span>
                    ))}</span> : null}
                  </span>
                </div>
              ))}
            </div>
            <MiniStrip today={today} D={answers.sessions} sport={sport} phase={done >= 2 ? "fill" : "ring"} />
          </div>
        </Card>
        <p className="s-sr" aria-live="polite">{said}</p>
      </div>
    </div>
  );
}

export { PlanningView };
