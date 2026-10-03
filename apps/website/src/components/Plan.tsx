import { useState, useEffect, useRef, type Dispatch, type MutableRefObject, type ReactNode, type SetStateAction } from "react";
import { Icon, Button, IconButton, Badge, Tag, Card, Input, Radio, SuggestionCard, ExerciseRow, ProgressRing } from "../design-system";
import { Logic } from "../logic";
import { reducedNow, radioArrows } from "../lib";
import { Kicker, DemoBubble, Fine, DemoRow, PlanStrip, feelPhrase, WeekList, ChangeCard, demoRows } from "./shared";
import type { Breakpoint, ChatItem, Chip, DoneRecord, LastFeeling, Plan, ResultSummary, UiState } from "../types";

type SaveFeedback = Pick<DoneRecord, "feeling" | "note" | "ticked">;

interface ChatProps {
  plan: Plan; chat: ChatItem[]; busy: boolean; chipsList: Chip[]; onSend: (text: string) => void; onUndo: (n: number) => void;
  onStartOver: () => void; bp: Breakpoint; onSeePlan: (res: ResultSummary) => void; onClose?: () => void; inDialog?: boolean;
}

/* ============ dialogs ============ */
function SiteDialog({ open, onClose, className, labelledBy, children, focusAfter, fallbackFocus }: {
  open: boolean; onClose: () => void; className?: string; labelledBy: string; children?: ReactNode;
  focusAfter?: MutableRefObject<string | null>; fallbackFocus?: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null), opener = useRef<Element | null>(null), closeRef = useRef(onClose), fbRef = useRef(fallbackFocus);
  closeRef.current = onClose; if (fallbackFocus) fbRef.current = fallbackFocus;
  useEffect(() => {
    const d = ref.current;
    const h = () => {
      closeRef.current();
      const t = (focusAfter && focusAfter.current) || opener.current;
      if (focusAfter) focusAfter.current = null;
      setTimeout(() => {
        let el = (typeof t === "string" ? document.getElementById(t) : t) as HTMLElement | null;
        if ((!el || !el.isConnected) && fbRef.current) el = document.getElementById(fbRef.current);
        if (el && el.focus) el.focus();
      }, 0);
    };
    d.addEventListener("close", h);
    return () => d.removeEventListener("close", h);
  }, []);
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) { opener.current = document.activeElement; d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={"s-dialog " + (className || "")} aria-labelledby={labelledBy} onClick={e => { if (e.target === ref.current) ref.current.close(); }}>
      {open ? children : null}
    </dialog>
  );
}

function SessionDialogBody({ plan, offset, mode, ticked, setTicked, onMarkDone, onSave, onClose }: {
  plan: Plan; offset: number; mode: "session" | "feedback"; ticked: boolean[]; setTicked: Dispatch<SetStateAction<boolean[]>>;
  onMarkDone: () => void; onSave: (feedback: SaveFeedback) => void; onClose: () => void;
}) {
  const v = Logic.activeVersion(plan), s = Logic.sessionAt(v, offset);
  const [feeling, setFeeling] = useState(null);
  const [note, setNote] = useState("");
  const h2 = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (mode === "feedback" && h2.current) h2.current.focus(); }, [mode]);
  if (!s) return null;
  const date = Logic.dateAt(plan, offset), isToday = offset === plan.todayOffset;
  const close = <IconButton icon="x" label="Close" onClick={onClose} />;
  const n = s.rows.length, t = ticked.filter(Boolean).length;

  if (mode === "feedback") {
    const partial = t > 0 && t < n;
    return (
      <div className="s-dlg-in">
        <div className="s-dhead">
          <div className="s-dtitle"><Kicker>{Logic.wdName(date)} done · {s.minutes} min</Kicker><h2 id="s-dlg-h" ref={h2} tabIndex={-1} className="s-h2">{partial ? "Stopping early still counts." : "Nice and steady."}</h2></div>
          {close}
        </div>
        <div className="s-col" style={{ gap: 12 }}>
          <h3 className="s-sect" id="s-feel-h">How did it feel?</h3>
          <div role="radiogroup" aria-labelledby="s-feel-h" className="s-stack8" onKeyDown={radioArrows}>
            {Logic.FEELINGS.map(f => <Radio key={f.key} variant="card" label={f.label} description={f.key === "hard" && s.sport === "running" ? f.descRunning : f.desc} checked={feeling === f.key} onChange={() => setFeeling(f.key)} />)}
          </div>
        </div>
        <Input label="Anything to note (optional)" placeholder="Shoes, weather, how your legs feel…" value={note} onChange={setNote} />
        <Button size="lg" fullWidth icon="check" disabled={!feeling} onClick={() => onSave({ feeling, note: note.trim(), ticked })}>Save</Button>
      </div>
    );
  }

  if (s.done) {
    const any = s.done.ticked.some(Boolean);
    return (
      <div className="s-dlg-in">
        <div className="s-dhead">
          <div className="s-dtitle"><Kicker>{Logic.fmtLong(date)} · done · {s.minutes} min</Kicker><h2 id="s-dlg-h" className="s-h2">{s.title}</h2></div>
          {close}
        </div>
        <Card variant="sunken" padding={0}>
          <div className="s-loglist">{s.rows.map((r, i) => <DemoRow key={i} r={r} check={!any || s.done.ticked[i] ? "done" : "open"} />)}</div>
        </Card>
        <div className="s-col" style={{ gap: 6 }}>
          <span className="s-sub">{Logic.cap(Logic.feelingOf(s.done.feeling).phrase)}</span>
          {s.done.note ? <p className="s-bodysm">{s.done.note}</p> : null}
        </div>
        <Button variant="secondary" size="lg" fullWidth onClick={onClose}>Close</Button>
      </div>
    );
  }

  return (
    <div className="s-dlg-in">
      <div className="s-dhead">
        {isToday ? <ProgressRing size={52} value={n ? t / n : 0} label={t + "/" + n} /> : null}
        <div className="s-dtitle"><Kicker>{Logic.fmtLong(date)} · {Logic.SLOTS[s.slot].word} · {s.minutes} min</Kicker><h2 id="s-dlg-h" className="s-h2">{s.title}</h2></div>
        {close}
      </div>
      <Card variant="sunken" padding={16}>
        <p className="s-note"><Icon name="feather" size={16} style={{ color: "var(--accent-text)", flex: "none" }} /><span>{Logic.coachTip(s.sport, s.slot)}</span></p>
      </Card>
      <div className="s-col" style={{ gap: 4 }}>
        <h3 className="s-sect">The session</h3>
        <div>
          {isToday
            ? s.rows.map((r, i) => <ExerciseRow key={i} name={r.name} detail={r.detail} meta={r.meta} done={!!ticked[i]} divider={i < n - 1} onToggle={() => setTicked(tk => tk.map((x, j) => (j === i ? !x : x)))} />)
            : s.rows.map((r, i) => <DemoRow key={i} r={r} />)}
        </div>
      </div>
      {isToday
        ? <Button size="lg" fullWidth icon="check" onClick={onMarkDone}>Mark done</Button>
        : <div className="s-col" style={{ gap: 12 }}>
            <p className="s-cap">Planned for {Logic.wdName(date)}. You can mark it done on the day.</p>
            <Button variant="secondary" size="lg" fullWidth onClick={onClose}>Close</Button>
          </div>}
    </div>
  );
}

/* ============ chat ============ */
function ChatBody({ plan, chat, busy, chipsList, onSend, onUndo, onStartOver, bp, onSeePlan, onClose, inDialog }: ChatProps) {
  const [text, setText] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  /* New messages never jump the view to the end. If the first new one is out of sight,
     bring its top into view and let the reader scroll on from there. */
  useEffect(() => {
    const log = logRef.current, first = log && log.querySelector("[data-fresh]");
    if (!first) return;
    const r = first.getBoundingClientRect();
    const box = inDialog ? log.getBoundingClientRect() : { top: 64, bottom: window.innerHeight };
    if (r.top >= box.top && r.top <= box.bottom - 48) return;
    first.scrollIntoView({ block: "start", behavior: reducedNow() ? "auto" : "smooth" });
  }, [chat.length]);
  const submit = e => { e.preventDefault(); const t = text.trim(); if (!t || busy) return; setText(""); onSend(t); };
  const narrow = bp !== "desktop";
  return (
    <div className="s-chat">
      <div className="s-chathead">
        <Icon name="message-circle" size={20} style={{ color: "var(--accent-text)" }} />
        <div className="s-col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <h2 id="s-chat-h" className="s-sub">Change your plan</h2>
          <span className="s-cap">Changes apply straight away</span>
        </div>
        {inDialog ? <IconButton icon="x" label="Close" onClick={onClose} /> : null}
      </div>
      <div className="s-log" role="log" aria-live="polite" aria-labelledby="s-chat-h" ref={logRef} tabIndex={0}>
        {chat.map((m, i) => {
          const cls = "s-logitem" + (m.fresh && !reducedNow() ? " s-new" : "");
          const mark = m.fresh && !chat.slice(0, i).some(x => x.fresh) ? "" : undefined;
          if (m.kind === "user") return <div key={m.id} className={cls} data-fresh={mark}><DemoBubble me>{m.text}</DemoBubble></div>;
          if (m.kind === "coach") return <div key={m.id} className={cls} data-fresh={mark}><DemoBubble>{m.text}</DemoBubble></div>;
          if (m.kind === "checking") return (
            <div key={m.id} className={cls} data-fresh={mark}><div className="s-checking">
              <span className={reducedNow() ? "" : "s-spin"} style={{ display: "flex", color: "var(--accent-text)" }}><Icon name="loader-circle" size={18} /></span>Checking the change…
            </div></div>
          );
          if (m.kind === "refusal") return (
            <div key={m.id} className={cls} data-fresh={mark}><DemoBubble>{m.text}</DemoBubble><Fine icon="lock">Plan unchanged</Fine></div>
          );
          if (m.kind === "result") {
            const latest = !m.undone && plan.active === m.res.n && plan.versions.length === m.res.n;
            return <div key={m.id} className={cls} data-fresh={mark}><ChangeCard rows={demoRows(m.res)} kept={m.res.foot} undone={m.undone}
              onUndo={latest ? () => onUndo(m.res.n) : null} onSeePlan={narrow && !m.undone ? () => onSeePlan(m.res) : null} /></div>;
          }
          if (m.kind === "closing") return (
            <div key={m.id} className={cls} data-fresh={mark}>
              <Card variant="accent" padding={20}>
                <div className="s-col" style={{ gap: 10 }}>
                  <h3 className="s-h3">That's the journey.</h3>
                  <p className="s-bodysm">Answers, a sport, a first week, and {m.kept ? "a change that kept what you'd done" : "a change applied straight away"}. Keep asking, or start again with different answers.</p>
                  <div className="s-row" style={{ gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                    <Button variant="secondary" icon="rotate-ccw" onClick={onStartOver}>Start over</Button>
                  </div>
                </div>
              </Card>
            </div>
          );
          return null;
        })}
      </div>
      {!busy ? (
        <div className="s-chips">
          <div className="s-tags" role="group" aria-label="Suggestions">
            {chipsList.map(c => <Tag key={c.id} onClick={() => onSend(c.text)} style={{ height: 44, ...(c.accent ? { border: "1px solid var(--accent)", boxShadow: "inset 0 0 0 1px var(--accent)" } : null) }}>{c.label}</Tag>)}
          </div>
        </div>
      ) : null}
      <form className="s-compose" onSubmit={submit}>
        <input className="s-input" aria-label="Ask for a change" placeholder="Ask for a change…" maxLength={140} value={text} disabled={busy} onChange={e => setText(e.target.value)} />
        <IconButton variant="primary" icon="arrow-up" label="Send" disabled={!text.trim() || busy} onClick={submit} />
      </form>
    </div>
  );
}

/* ============ plan view ============ */
function PlanView({ plan, chat, busy, lastFeeling, status, ui, setUi, ticked, setTicked, onMarkDone, onSave, onSend, onUndo, onStartOver, bp }: {
  plan: Plan; chat: ChatItem[]; busy: boolean; lastFeeling: LastFeeling | null; status: string; ui: UiState; setUi: Dispatch<SetStateAction<UiState>>;
  ticked: boolean[]; setTicked: Dispatch<SetStateAction<boolean[]>>; onMarkDone: () => void; onSave: (feedback: SaveFeedback) => void;
  onSend: (text: string) => void; onUndo: (n: number) => void; onStartOver: () => void; bp: Breakpoint;
}) {
  const v = Logic.activeVersion(plan), p = v.params;
  const sel = ui.selectedOffset;
  const s = Logic.sessionAt(v, sel);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id); }, []);
  const focusAfter = useRef<string | null>(null);
  const chipsList = Logic.chips(plan, lastFeeling);
  const openDialog = o => { setTicked((Logic.sessionAt(v, o) || { rows: [] }).rows.map(() => false)); setUi(u => ({ ...u, selectedOffset: o, dialog: { offset: o, mode: "session" } })); };
  const closeDialog = () => setUi(u => ({ ...u, dialog: null }));
  const seePlan = res => {
    const first = Logic.sortByOffset(v.sessions).find(x => x.changedIn === v.n);
    focusAfter.current = first ? "s-row-" + first.offset : "s-strip-" + (res.rows[0] ? res.rows[0].offset : sel);
    setUi(u => ({ ...u, chatOpen: false }));
  };
  const d = Logic.dateAt(plan, sel);
  const word = Logic.dayWord(plan, sel);
  let dayCard;
  if (!s) dayCard = (
    <Card variant="sunken" padding={20}>
      <div className="s-restcard"><Icon name="leaf" size={20} style={{ color: "var(--recovery)", marginTop: 2 }} /><div className="s-col" style={{ gap: 4 }}><h2 className="s-sub">Rest day</h2><p className="s-bodysm">Nothing planned. A walk to the shop still counts.</p></div></div>
    </Card>
  );
  else if (s.done) dayCard = <SuggestionCard tone={Logic.SPORTS[s.sport].tone} kicker={word + " · done · " + feelPhrase(s)} title={s.title + "."} body="Saved. It stays like this, whatever you change next." actionLabel="View" onAction={() => openDialog(sel)} />;
  else dayCard = <SuggestionCard tone={Logic.SPORTS[s.sport].tone} kicker={word + " · " + Logic.SLOTS[s.slot].word + " · " + s.minutes + " min"} title={s.title + "."} body={s.reason} actionLabel="Open" onAction={() => openDialog(sel)} />;

  const chatProps = { plan, chat, busy, chipsList, onSend, onUndo, onStartOver, bp, onSeePlan: seePlan };
  return (
    <div className="s-wrap">
      <div className="s-plan">
        <div className="s-plan-left s-enter">
          <div className="s-planhead">
            <Kicker>Your first week · {Logic.fmtRange(plan.start)}</Kicker>
            <h1 className="s-h1" tabIndex={-1} data-page-title="">{Logic.SPORTS[p.sport].h1}</h1>
            <p className="s-body">{Logic.headerBody(plan)}</p>
            <p className="s-status" role="status" aria-live="polite">{status ? <><Icon name="circle-check" size={16} />{status}</> : null}</p>
          </div>
          <PlanStrip plan={plan} selected={sel} onSelect={o => setUi(u => ({ ...u, selectedOffset: o }))} />
          <div key={sel + "-" + v.n + "-" + (s && s.done ? "d" : "p")} className="s-xfade">{dayCard}</div>
          <section className="s-col" style={{ gap: 8 }} aria-labelledby="s-week-h">
            <h2 id="s-week-h" className="s-sect">This week</h2>
            <WeekList plan={plan} onOpen={openDialog} flashKey={v.n} />
          </section>
          <section className="s-col" style={{ gap: 8 }} aria-labelledby="s-why-h">
            <div className="s-col" style={{ gap: 4 }}>
              <h2 id="s-why-h" className="s-sect">Why this plan</h2>
              <p className="s-bodysm">Each part comes from something you told us.</p>
            </div>
            <ul className="s-whylist">
              {Logic.whyLines(plan).map(l => (
                <li key={l.key} className={l.from ? "is-chat" : ""}>
                  <span className="s-whyic"><Icon name={l.icon} size={20} /></span>
                  <span className="s-col" style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <span className="s-whyeffect">{Logic.cap(l.effect)}</span>
                    <span className="s-whycause">
                      <Icon name={l.from ? "message-circle" : "list-checks"} size={14} />
                      <span>{l.from ? "You asked in chat" : "Your answer"}<span aria-hidden="true"> · </span><span className="s-sr">: </span>{l.cause}</span>
                    </span>
                  </span>
                  {l.from ? <Badge tone="accent">Changed</Badge> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
        {bp === "desktop" ? (
          <div className="s-chatgrow">
            <Card padding={20} style={{ minHeight: 480, display: "flex", flexDirection: "column" }}>
              <ChatBody {...chatProps} />
            </Card>
          </div>
        ) : null}
      </div>
      {bp !== "desktop" ? <>
        <div className="s-bottombar"><div><Button size="lg" fullWidth icon="message-circle" onClick={() => setUi(u => ({ ...u, chatOpen: true }))}>Change plan</Button></div></div>
        <SiteDialog open={ui.chatOpen} className="s-chatsheet" labelledBy="s-chat-h" focusAfter={focusAfter} onClose={() => setUi(u => ({ ...u, chatOpen: false }))}>
          <div className="s-dlg-in"><ChatBody {...chatProps} inDialog onClose={() => setUi(u => ({ ...u, chatOpen: false }))} /></div>
        </SiteDialog>
      </> : null}
      <SiteDialog open={!!ui.dialog} labelledBy="s-dlg-h" onClose={closeDialog} fallbackFocus={ui.dialog ? "s-row-" + ui.dialog.offset : null}>
        {ui.dialog ? <SessionDialogBody plan={plan} offset={ui.dialog.offset} mode={ui.dialog.mode} ticked={ticked} setTicked={setTicked}
          onMarkDone={onMarkDone} onSave={onSave} onClose={closeDialog} /> : null}
      </SiteDialog>
    </div>
  );
}

export { SiteDialog, SessionDialogBody, ChatBody, PlanView };
