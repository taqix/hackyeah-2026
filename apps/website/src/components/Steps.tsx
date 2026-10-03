import { Icon, Button, IconButton, Badge, Tag, Card, Radio, SuggestionCard } from "../design-system";
import { Logic } from "../logic";
import { STEP_TITLES } from "../content";
import { go, radioArrows } from "../lib";
import { Kicker, SiteSteps, MiniStrip } from "./shared";
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from "react";
import type { Answers, Breakpoint } from "../types";

type RankedSport = ReturnType<typeof Logic.scoreSports>[number];

function StepFooter() {
  return <p className="s-cap">You're trying Movo as a guest. No account needed.</p>;
}

function Panel({ answers, sport, visited, today }: { answers: Answers; sport: string | null; visited: number; today: Date }) {
  const c = Logic.comfortOf(answers.comfort);
  const echoes = [...Logic.placeEchoes(answers), ...Logic.companyEchoes(answers)];
  const phase = visited >= 4 && sport ? "fill" : visited >= 3 ? "ring" : "neutral";
  const rows = [
    { name: "Starting point", step: 1, icon: c ? c.icon : "armchair", text: c ? c.panel : null, used: "how gentle the first sessions are", ph: "How starting feels" },
    { name: "Places", step: 2, icon: "tree-pine", text: answers.places.length ? Logic.cap(echoes.join(" · ")) : null, used: "which sport we suggest", ph: "Where you can move" },
    { name: "Time", step: 3, icon: "timer", text: visited >= 3 ? Logic.timeLine(answers) : null, used: "session length, days and time of day", ph: "Time you can give" },
    { name: "Sport", step: 4, icon: sport ? Logic.SPORTS[sport].icon : "goal", text: visited >= 4 && sport ? Logic.SPORTS[sport].name : null, used: "what the sessions are made of", ph: "Sport" },
  ];
  return (
    <Card padding={24} style={{ position: "sticky", top: 88 }}>
      <aside className="s-col" style={{ gap: 18 }} aria-label="Your first week">
        <div className="s-col" style={{ gap: 4 }}><h2 className="s-sect">Your first week</h2><p className="s-cap">Takes shape as you answer.</p></div>
        <MiniStrip today={today} D={answers.sessions} sport={sport} phase={phase} />
        <div>
          {rows.map(r => (
            <div key={r.name} className="s-prow">
              <Icon name={r.icon} size={20} style={{ color: r.text ? "var(--accent-text)" : "var(--text-tertiary)" }} />
              <span className="s-ptext">
                <span className={"s-pans" + (r.text ? "" : " is-empty")}>{r.text || r.ph}</span>
                {r.text ? <span className="s-cap">Used for: {r.used}</span> : null}
              </span>
              {r.text ? <button type="button" className="s-textbtn" aria-label={"Edit " + r.name.toLowerCase()} onClick={() => go("#/try/" + r.step)}>Edit</button> : null}
            </div>
          ))}
        </div>
      </aside>
    </Card>
  );
}
function summaryLine(answers: Answers, sport: string, visited: number) {
  const c = Logic.comfortOf(answers.comfort);
  const parts = [];
  if (c) parts.push(Logic.cap(c.echo));
  parts.push(...Logic.placeEchoes(answers), ...Logic.companyEchoes(answers));
  if (visited >= 3) parts.push(Logic.timeLine(answers));
  if (visited >= 4 && sport) parts.push(Logic.SPORTS[sport].name);
  return parts.length ? "So far: " + parts.join(" · ") : "";
}

function StepShell({ n, h1Id, body, bodySmall, children, cta, ctaNote, ctaNoteAbove, bp, panel, summary }: {
  n: number; h1Id: string; body: ReactNode; bodySmall?: boolean; children?: ReactNode;
  cta: { label: string; disabled?: boolean; onClick: () => void; iconRight?: null };
  ctaNote?: string | null; ctaNoteAbove?: string | null; bp: Breakpoint; panel: ReactNode; summary?: string;
}) {
  const back = () => go(n === 1 ? "#/" : "#/try/" + (n - 1));
  const phone = bp === "phone";
  const ctaBtn = <Button size="lg" iconRight={cta.iconRight === null ? undefined : "arrow-right"} disabled={cta.disabled} onClick={cta.onClick} fullWidth={phone}>{cta.label}</Button>;
  return (
    <div className="s-wrap">
      <div className="s-shell">
        <div className="s-stepcol s-enter" key={n}>
          <div className="s-progress">
            {phone ? <IconButton icon="arrow-left" label="Back" onClick={back} style={{ marginLeft: -10 }} /> : <Kicker style={{ flex: "none" }}>{n} of 4</Kicker>}
            <SiteSteps filled={n} />
            {phone ? <Kicker style={{ flex: "none" }}>{n} of 4</Kicker> : null}
          </div>
          <div className="s-stephead">
            <h1 id={h1Id} className="s-h1" tabIndex={-1} data-page-title="">{STEP_TITLES[n]}</h1>
            <p className={bodySmall ? "s-bodysm" : "s-body"}>{body}</p>
            {bp !== "desktop" && summary ? <p className="s-cap">{summary}</p> : null}
          </div>
          {children}
          {!phone ? (
            <div className="s-col" style={{ gap: 10 }}>
              {ctaNoteAbove ? <p className="s-cap">{ctaNoteAbove}</p> : null}
              <div className="s-actions">
                <Button variant="secondary" size="lg" icon="arrow-left" onClick={back}>Back</Button>
                {ctaBtn}
                {ctaNote ? <span className="s-cap">{ctaNote}</span> : null}
              </div>
            </div>
          ) : null}
          <StepFooter />
        </div>
        {bp === "desktop" ? <div style={{ alignSelf: "stretch" }}>{panel}</div> : null}
      </div>
      {phone ? (
        <div className="s-bottombar">
          <div>
            {ctaNoteAbove || ctaNote ? <p className="s-cap">{ctaNoteAbove || ctaNote}</p> : null}
            {ctaBtn}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TagGroup({ id, label, caption, children }: { id: string; label: string; caption?: string; children?: ReactNode }) {
  return (
    <div className="s-group" role="group" aria-labelledby={id}>
      <div className="s-grouphead"><h2 id={id} className="s-sect">{label}</h2>{caption ? <span className="s-cap" style={{ flex: "none" }}>{caption}</span> : null}</div>
      <div className="s-tags">{children}</div>
    </div>
  );
}

/* Labelled range input with the current value spelled out; keyboard and screen readers get the native slider. */
function SliderField({ id, label, icon, range, value, onChange, format, ends }: {
  id: string; label: string; icon: string; range: { min: number; max: number; step: number }; value: number;
  onChange: (value: number) => void; format: (value: number) => string; ends: [string, string];
}) {
  const pct = ((value - range.min) / (range.max - range.min)) * 100;
  return (
    <div className="s-group">
      <div className="s-grouphead"><h2 id={id} className="s-sect">{label}</h2></div>
      <div className="s-slider">
        <div className="s-sliderval" aria-hidden="true"><Icon name={icon} size={18} />{format(value)}</div>
        <input type="range" className="s-range" min={range.min} max={range.max} step={range.step} value={value}
          aria-labelledby={id} aria-valuetext={format(value)} style={{ "--pct": pct + "%" } as CSSProperties}
          onChange={e => onChange(Number(e.target.value))} />
        <div className="s-sliderends" aria-hidden="true"><span>{ends[0]}</span><span>{ends[1]}</span></div>
      </div>
    </div>
  );
}

function StepView({ n, answers, setAnswers, ranked, sport, setSport, visited, hasPlan, onChoose, bp, today }: {
  n: number; answers: Answers; setAnswers: Dispatch<SetStateAction<Answers>>; ranked: RankedSport[]; sport: string;
  setSport: (sport: string) => void; visited: number; hasPlan: boolean; onChoose: () => void; bp: Breakpoint; today: Date;
}) {
  const h1Id = "s-h1";
  const panel = <Panel answers={answers} sport={visited >= 4 ? sport : null} visited={visited} today={today} />;
  const summary = summaryLine(answers, sport, visited);
  const upd = patch => setAnswers(a => ({ ...a, ...patch }));
  const toggle = (field, key) => setAnswers(a => ({ ...a, [field]: a[field].includes(key) ? a[field].filter(x => x !== key) : [...a[field], key] }));
  const common = { n, h1Id, bp, panel, summary: n === 1 && !answers.comfort ? "" : summary };
  const next = () => go("#/try/" + (n + 1));

  if (n === 1) return (
    <StepShell {...common} body="No wrong answers. This sets how gentle your first week is."
      cta={{ label: "Continue", disabled: !answers.comfort, onClick: next }} ctaNote={!answers.comfort ? "Pick one to continue." : null}>
      <div role="radiogroup" aria-labelledby={h1Id} className="s-stack8" onKeyDown={radioArrows}>
        {Logic.COMFORT.map(c => <Radio key={c.value} variant="card" label={c.label} description={c.desc} checked={answers.comfort === c.value} onChange={() => upd({ comfort: c.value })} />)}
      </div>
    </StepShell>
  );
  if (n === 2) return (
    <StepShell {...common} body="We use these to suggest a sport." cta={{ label: "Continue", disabled: !answers.places.length, onClick: next }}>
      <div className="s-col" style={{ gap: 28 }}>
        <TagGroup id="s-g-places" label="Where could you move?" caption="Pick at least one.">
          {Logic.PLACES.map(p => <Tag key={p.key} icon={p.icon} selected={answers.places.includes(p.key)} onClick={() => toggle("places", p.key)} style={{ height: 44 }}>{p.label}</Tag>)}
        </TagGroup>
        <TagGroup id="s-g-company" label="Who would you move with?" caption="Optional.">
          {Logic.COMPANY.map(p => <Tag key={p.key} icon={p.icon} selected={answers.company.includes(p.key)} onClick={() => toggle("company", p.key)} style={{ height: 44 }}>{p.label}</Tag>)}
        </TagGroup>
      </div>
    </StepShell>
  );
  if (n === 3) return (
    <StepShell {...common} body="Pick what feels easy. You can change it later." cta={{ label: "Continue", onClick: next }}>
      <div className="s-col" style={{ gap: 28 }}>
        <SliderField id="s-g-often" label="How often would you like to make room for movement?" icon="calendar-days"
          range={Logic.SESSION_RANGE} value={answers.sessions} onChange={d => upd({ sessions: d })}
          format={d => d + " " + (d === 1 ? "session" : "sessions") + " a week"} ends={["1", "7"]} />
        <SliderField id="s-g-length" label="What feels manageable for one session?" icon="timer"
          range={Logic.MINUTE_RANGE} value={answers.minutes} onChange={m => upd({ minutes: m })}
          format={m => m + " min"} ends={["5 min", "60 min"]} />
        <TagGroup id="s-g-when" label="When would you prefer to move?">
          {Logic.SLOT_ORDER.map(k => <Tag key={k} icon={Logic.SLOTS[k].icon} selected={answers.slot === k} onClick={() => upd({ slot: k })} style={{ height: 44 }}>{Logic.SLOTS[k].label}</Tag>)}
        </TagGroup>
      </div>
    </StepShell>
  );
  /* step 4 */
  const sel = ranked.find(r => r.key === sport) || ranked[0];
  const S = Logic.SPORTS[sel.key];
  const isBest = ranked[0].key === sel.key;
  const sportKeys = e => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const i = ranked.findIndex(r => r.key === sel.key);
    const nx = ranked[(i + keys[e.key] + ranked.length) % ranked.length];
    setSport(nx.key);
    requestAnimationFrame(() => { const b = document.getElementById("s-sport-" + nx.key); if (b) b.focus(); });
  };
  return (
    <StepShell {...common} bodySmall body={Logic.step4Body(answers)} ctaNoteAbove={hasPlan ? "Choosing again makes a new first plan." : null}
      cta={{ label: "Choose " + S.name.toLowerCase(), onClick: onChoose }}>
      <div key={sel.key} className="s-xfade">
        <SuggestionCard size="md" tone={S.tone} kicker={(isBest ? "Best fit · " : "Your pick · ") + S.name} title={S.tagline} body={Logic.suggestionBody(sel, answers)} />
      </div>
      <div role="radiogroup" aria-label="Choose a sport" className="s-sports" onKeyDown={sportKeys}>
        {ranked.map((r, i) => {
          const sp = Logic.SPORTS[r.key], on = r.key === sel.key;
          return (
            <button key={r.key} id={"s-sport-" + r.key} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} className="s-sport" onClick={() => setSport(r.key)}>
              <span className="s-disc44"><Icon name={sp.icon} size={20} /></span>
              <span className="s-sportmain">
                <span className="s-sportname">{sp.name}{i === 0 ? <Badge tone="accent">Best fit</Badge> : null}{r.matches.map(t => <Badge key={t.key}>{t.badge}</Badge>)}</span>
                <span className="s-bodysm">{r.reason}</span>
              </span>
              <span className="s-radioind" aria-hidden="true"><span></span></span>
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}

export { StepFooter, Panel, summaryLine, StepShell, TagGroup, SliderField, StepView };
