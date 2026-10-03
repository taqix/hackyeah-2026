import React, { type CSSProperties, type ReactNode } from "react";
import { Icon, Button, Badge } from "../design-system";
import { Logic } from "../logic";
import { useReduced, setInert } from "../lib";
import type { Plan, ResultSummary, Session, SessionRow } from "../types";

/* A row of a change card: the day, then each value as it was and is now. */
interface ChangeCardRow {
  day: string;
  date: string;
  title?: string;
  diffs: { icon?: string; from: string; to: string }[];
  note?: string;
}

/* ============ shared pieces ============ */
const Kicker = ({ children, style }: { children?: ReactNode; style?: CSSProperties }) => <span className="s-kicker" style={style}>{children}</span>;
/* The app icon (design/icons.html, "Monitor"): a heartbeat whose beat is the M, with the o as a bright dot at its tip.
   Hex values mirror the icon's export, which stays the same in light and dark. */
function AppIcon({ size = 32, style }: { size?: number; style?: CSSProperties }) {
  const id = "s-icon-" + React.useId().replace(/:/g, "");
  return (
    <svg className="s-appicon" viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" style={style}>
      <rect width="120" height="120" fill="#1D1914" />
      <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="8" x2="92" y1="0" y2="0">
        <stop offset="0" stopColor="#86AEE3" stopOpacity="0" /><stop offset=".55" stopColor="#86AEE3" />
      </linearGradient>
      <path d="M8 70H24L36 38L54 76L72 38L84 70H92" fill="none" stroke={"url(#" + id + ")"} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="102" cy="70" r="16" fill="#FFFBF5" opacity=".22" /><circle cx="102" cy="70" r="8.5" fill="#FFFBF5" />
    </svg>
  );
}
function SiteSteps({ filled, total = 4 }: { filled: number; total?: number }) {
  return <div className="s-bar" aria-hidden="true">{Array.from({ length: total }, (_, i) => <span key={i} className={i < filled ? "on" : ""}></span>)}</div>;
}
function DemoBubble({ me, children }: { me?: boolean; children?: ReactNode }) {
  return <div className={"s-bubble" + (me ? " is-me" : "")}>{children}</div>;
}
function Fine({ icon, children, tone }: { icon?: string; children?: ReactNode; tone?: string }) {
  return <span className="s-fine">{icon ? <Icon name={icon} size={16} style={tone ? { color: tone } : null} /> : null}<span>{children}</span></span>;
}
function DemoPhone({ scale, children }: { scale: number; children?: ReactNode }) {
  return (
    <div className="s-phone" aria-hidden="true" ref={setInert} style={{ width: 390 * scale, height: 844 * scale, borderRadius: 48 * scale }}>
      <div className="s-phone-in" style={{ transform: "scale(" + scale + ")" }}>
        <div className="s-phone-status">
          <span>9:41</span>
          <span className="s-row" style={{ gap: 6 }}><Icon name="signal" size={16} strokeWidth={2} /><Icon name="wifi" size={16} strokeWidth={2} /><Icon name="battery-full" size={20} /></span>
        </div>
        <div className="s-phone-body">{children}</div>
      </div>
    </div>
  );
}
/* Session row without a toggle (DS ExerciseRow always renders one). */
function DemoRow({ r, check }: { r: SessionRow; check?: "done" | "open" }) {
  return (
    <div className="s-drow">
      {check ? <Icon name={check === "done" ? "check" : "circle"} size={16} style={{ color: check === "done" ? "var(--success)" : "var(--text-tertiary)" }} /> : null}
      <div className="s-col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <span className="s-dname">{r.name}</span>
        <span className="s-ddetail">{r.detail}<span> · {r.meta}</span></span>
      </div>
    </div>
  );
}

/* ============ week strips ============ */
/* Mini strip used by the step panel and the planning moment. phase: neutral | ring | fill */
function MiniStrip({ today, D, sport, phase }: { today: Date; D: number; sport?: string | null; phase: "neutral" | "ring" | "fill" }) {
  const offs = Logic.OFFSETS[D] || [];
  return (
    <div className="s-ministrip" aria-hidden="true">
      {Array.from({ length: 7 }, (_, o) => {
        const d = Logic.addDays(today, o), isS = offs.includes(o);
        const cls = "s-mdisc" + (isS && phase === "ring" ? " is-ring" : "") + (isS && phase === "fill" ? " is-fill" : "");
        const showIcon = isS && phase === "fill" && sport;
        return (
          <div key={o} className="s-mday">
            <span className="s-cap">{Logic.wdInitial(d)}</span>
            <span className={cls}>{showIcon ? <Icon name={Logic.SPORTS[sport].icon} size={16} /> : d.getDate()}</span>
            <span className="s-mnum">{showIcon ? d.getDate() : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
/* Plan strip: seven day buttons (or static divs in mockups). */
function PlanStrip({ plan, selected, onSelect, isStatic }: { plan: Plan; selected?: number; onSelect?: (o: number) => void; isStatic?: boolean }) {
  const v = Logic.activeVersion(plan);
  return (
    <div className="s-strip" role={isStatic ? undefined : "group"} aria-label={isStatic ? undefined : "Days this week"}>
      {Array.from({ length: 7 }, (_, o) => {
        const d = Logic.dateAt(plan, o), s = Logic.sessionAt(v, o);
        const isToday = o === plan.todayOffset;
        const cls = "s-day" + (isToday ? " is-today" : "") + (s && s.done ? " is-done" : s ? " is-session" : " is-rest") + (selected === o ? " is-sel" : "");
        let label = Logic.fmtLong(d) + (isToday ? ", today" : "");
        if (!s) label += ", rest day";
        else if (s.done) label += ", " + s.title.toLowerCase() + ", done";
        else label += ", " + s.title.toLowerCase() + ", " + s.minutes + " minutes, " + Logic.SLOTS[s.slot].inPhrase;
        if (s && s.changedIn === v.n && v.n > 1) label += ", changed";
        const inner = <><span className="s-dini">{Logic.wdInitial(d)}</span><span className="s-disc">{d.getDate()}</span></>;
        if (isStatic) return <div key={o} className={cls}>{inner}</div>;
        return <button key={o} id={"s-strip-" + o} type="button" className={cls} aria-pressed={selected === o} aria-label={label} onClick={() => onSelect(o)}>{inner}</button>;
      })}
    </div>
  );
}
function feelPhrase(s: Session) { return Logic.feelingOf(s.done.feeling).phrase; }
/* "This week" list. Rows are buttons, or divs in mockups. */
function WeekList({ plan, onOpen, isStatic, flashKey }: { plan: Plan; onOpen?: (o: number) => void; isStatic?: boolean; flashKey?: number }) {
  const v = Logic.activeVersion(plan);
  const reduced = useReduced();
  return (
    <ul className="s-wlist">
      {Logic.sortByOffset(v.sessions).map(s => {
        const d = Logic.dateAt(plan, s.offset);
        const changed = s.changedIn === v.n && v.n > 1;
        let caption = Logic.SLOTS[s.slot].label;
        if (s.done) caption = Logic.cap(feelPhrase(s));
        const body = <>
          <span className="s-wday"><b>{Logic.wdShort(d)}</b><span className="s-cap">{Logic.fmtShort(d)}</span></span>
          <span className="s-wmain">
            <span className="s-wtitle">{s.title}{changed ? <Badge tone="accent">Changed</Badge> : null}</span>
            <span className="s-cap">{caption}</span>
          </span>
          <span className="s-wright">{s.done ? <Badge tone="success" dot>Done</Badge> : <span>{s.minutes} min</span>}<Icon name="chevron-right" size={16} style={{ color: "var(--text-tertiary)" }} /></span>
        </>;
        const label = Logic.fmtLong(d) + ", " + s.title + ", " + (s.done ? "done, " + feelPhrase(s) : s.minutes + " minutes, " + Logic.SLOTS[s.slot].inPhrase) + (changed ? ", changed" : "");
        return (
          <li key={s.id + (changed ? "-" + flashKey : "")}>
            {isStatic ? <div className="s-wrow">{body}</div>
              : <button type="button" id={"s-row-" + s.offset} className={"s-wrow" + (changed && !reduced ? " s-flash" : "")} aria-label={label} onClick={() => onOpen(s.offset)}>{body}</button>}
          </li>
        );
      })}
    </ul>
  );
}
/* Change card, as in the app's chat (mobile 8.3): already applied, with Undo on the newest change.
   rows: { day, date, title?, diffs: [{ icon?, from, to }], note? } */
function ChangeCard({ time = "Just now", summary, rows, kept, undone, onUndo, onSeePlan, seeLabel = "See plan" }: {
  time?: string; summary?: string; rows: ChangeCardRow[]; kept?: string; undone?: boolean;
  onUndo?: (() => void) | null; onSeePlan?: (() => void) | null; seeLabel?: string;
}) {
  if (undone) return (
    <section className="s-change" aria-label="Change undone">
      <div className="s-chead">
        <div className="s-row" style={{ gap: 10 }}><span className="s-rdisc is-neutral"><Icon name="undo-2" size={16} strokeWidth={2} /></span><span className="s-sub" style={{ flex: 1 }}>Change undone</span></div>
        <p className="s-bodysm">Back to how it was.</p>
      </div>
    </section>
  );
  return (
    <section className="s-change" aria-label="Plan updated">
      <div className="s-chead">
        <div className="s-row" style={{ gap: 10 }}><span className="s-rdisc"><Icon name="check" size={16} strokeWidth={2} /></span><span className="s-sub" style={{ flex: 1 }}>Plan updated</span><span className="s-cap">{time}</span></div>
        {summary ? <p className="s-bodysm">{summary}</p> : null}
      </div>
      {rows.map((r, i) => (
        <div key={i} className="s-crow">
          <span className="s-cday"><b>{r.day}</b><span className="s-cap">{r.date}</span></span>
          <span className="s-col" style={{ flex: 1, minWidth: 0, gap: 6 }}>
            {r.title ? <span className="s-ctitle">{r.title}</span> : null}
            {r.diffs.map((d, k) => (
              <span key={k} className="s-diff">
                {d.icon ? <Icon name={d.icon} size={16} style={{ color: "var(--accent-text)" }} /> : null}
                <span className="s-sr">was </span><s>{d.from}</s><Icon name="arrow-right" size={14} style={{ color: "var(--text-tertiary)" }} /><span className="s-sr">now </span><strong>{d.to}</strong>
              </span>
            ))}
            {r.note ? <span className="s-bodysm">{r.note}</span> : null}
          </span>
        </div>
      ))}
      <div className="s-cfoot">
        {kept ? <Fine icon="lock">{kept}</Fine> : null}
        {onUndo || onSeePlan ? (
          <div className="s-row" style={{ gap: 8 }}>
            {onUndo ? <Button size="sm" variant="secondary" icon="undo-2" onClick={onUndo}>Undo</Button> : null}
            <span className="s-fill"></span>
            {onSeePlan ? <Button size="sm" variant="ghost" iconRight="arrow-right" onClick={onSeePlan}>{seeLabel}</Button> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
const demoRows = (res: ResultSummary): ChangeCardRow[] => res.rows.map(r => ({ day: r.day, date: r.date, diffs: [{ from: r.was, to: r.now }] }));

export { Kicker, AppIcon, SiteSteps, DemoBubble, Fine, DemoPhone, DemoRow, MiniStrip, PlanStrip, feelPhrase, WeekList, ChangeCard, demoRows };
