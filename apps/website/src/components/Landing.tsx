import { Icon, Button, IconButton, Badge, Card, Radio, SuggestionCard } from "../design-system";
import { Logic } from "../logic";
import { NOTICE, BEATS, FEATURES } from "../content";
import { go } from "../lib";
import { Kicker, AppIcon, SiteSteps, DemoBubble, DemoPhone, ChangeCard } from "./shared";
import type { Answers, Breakpoint } from "../types";

interface HeroProps {
  comfort: string | null;
  onAnswer: (comfort: string) => void;
  bp: Breakpoint;
}

function QuestionCard({ comfort, onAnswer, bp }: HeroProps) {
  return (
    <Card padding={bp === "phone" ? 20 : 28}>
      <div className="s-qcard">
        <div className="s-row" style={{ gap: 14 }}><Kicker style={{ flex: "none" }}>Start here · 1 of 4</Kicker><SiteSteps filled={1} /></div>
        <div className="s-col" style={{ gap: 8 }}>
          <h2 className="s-h3">How does starting feel?</h2>
          <p className="s-bodysm">No wrong answers. This sets how gentle your first week is.</p>
        </div>
        <div className="s-answers">
          {Logic.COMFORT.map(c => (
            <button key={c.value} type="button" className={"s-answer" + (comfort === c.value ? " is-sel" : "")} aria-label={c.label + ", " + c.desc + ". Starts the demo."} onClick={() => onAnswer(c.value)}>
              <span className="s-disc44"><Icon name={c.icon} size={20} /></span>
              <span className="s-col" style={{ flex: 1, minWidth: 0, gap: 2 }}><span className="s-alabel">{c.label}</span><span className="s-adesc">{c.desc}</span></span>
              <span className="s-arrow"><Icon name="arrow-right" size={18} /></span>
            </button>
          ))}
        </div>
        <p className="s-cap">Pick one to start the demo.</p>
      </div>
    </Card>
  );
}

function Hero({ comfort, onAnswer, bp }: HeroProps) {
  return (
    <section className="s-hero" aria-labelledby="s-h1">
      <div className="s-hero-intro">
        <Kicker>Sport for beginners</Kicker>
        <h1 id="s-h1" tabIndex={-1} data-page-title="">Everyone starts somewhere.</h1>
        <p className="s-lede">For adults who want to move more and aren't sure where to start. Answer a few calm questions, get a gentle first week, then change it just by asking.</p>
        <div className="s-ctas">
          <Button size="lg" iconRight="arrow-right" onClick={() => go("#/try/1")}>Try it</Button>
          <Button size="lg" variant="secondary" icon="calendar" onClick={() => go("#/try/sample")}>See a plan</Button>
        </div>
        <p className="s-capline"><Icon name="info" size={16} />Try the demo. No account needed.</p>
      </div>
      <div className="s-hero-card"><QuestionCard comfort={comfort} onAnswer={onAnswer} bp={bp} /></div>
      <div className="s-hero-notice s-notice">
        <h2 className="s-label" style={{ fontFamily: "var(--font-body)", letterSpacing: 0 }}>Worth noticing</h2>
        <ul>{NOTICE.map(([ic, t]) => <li key={ic}><Icon name={ic} size={16} style={{ color: "var(--accent-text)" }} />{t}</li>)}</ul>
      </div>
    </section>
  );
}

/* ---- mockups: the app's own screens (design/prototype), drawn at 390 × 844 and scaled ----
   Ask = onboarding 2, Plan = Home 5 (Wednesday of Ana's first week), Change = chat 8.3. */
const MOCK_WEEK = [
  { d: "M", n: 5, state: "done" }, { d: "T", n: 6 }, { d: "W", n: 7, state: "planned", today: true }, { d: "T", n: 8 },
  { d: "F", n: 9, state: "planned" }, { d: "S", n: 10 }, { d: "S", n: 11 },
];
const MOCK_ROWS = [
  { day: "Mon", date: "5 Oct", title: "Brisk walk", meta: "20 min · felt easy", end: "done" },
  { day: "Wed", date: "7 Oct", title: "Walk-run intervals", meta: "7:00 · 20 min", end: "today" },
  { day: "Fri", date: "9 Oct", title: "Walk-run intervals", meta: "18:00 · 20 min" },
];
const MOCK_CHANGE = {
  summary: "All your sessions are at 7:00 now, and Friday is 10 minutes.",
  rows: [{ day: "Fri", date: "9 Oct", title: "Walk-run intervals", note: "Three runs instead of six.",
    diffs: [{ icon: "clock", from: "18:00", to: "7:00" }, { icon: "timer", from: "20 min", to: "10 min" }] }],
  kept: "Monday to Wednesday stay as you did them.",
};
/* The app's tab bar with the chat button beside it (design/README.md › Chat placement). */
const MockNav = () => <>
  <div className="m-nav">
    <span className="m-tab is-on"><Icon name="sun" size={22} strokeWidth={2} />Today</span>
    <span className="m-tab"><Icon name="calendar" size={22} /></span>
    <span className="m-tab"><Icon name="user-round" size={22} /></span>
  </div>
  <span className="m-chat"><Icon name="message-circle" size={24} strokeWidth={2} /></span>
</>;
function MockAsk() {
  return <>
    <div className="m-top"><IconButton icon="arrow-left" label="Back" /><span className="s-kicker">1 of 5</span></div>
    <div className="m-content" style={{ gap: 24 }}>
      <div className="s-row"><SiteSteps filled={1} total={5} /></div>
      <div className="s-col" style={{ gap: 8 }}>
        <div className="m-h1">How does starting feel?</div>
        <p className="s-body">No wrong answers. This sets how gentle your first week is.</p>
      </div>
      <div className="s-stack8">{Logic.COMFORT.map((c, i) => <Radio key={c.value} variant="card" label={c.label} description={c.desc} checked={i === 0} />)}</div>
    </div>
    <div className="m-bottom"><Button size="lg" fullWidth iconRight="arrow-right">Continue</Button></div>
  </>;
}
function MockPlan() {
  return <>
    <div className="m-content" style={{ gap: 20 }}>
      <div className="s-col" style={{ gap: 4 }}><Kicker>Wednesday, 7 October · Week 1</Kicker><div className="m-h1">Good morning, Ana</div></div>
      <div className="s-row" style={{ justifyContent: "space-between", marginBottom: -12 }}>
        <span className="s-label" style={{ color: "var(--text-secondary)" }}>5–11 Oct · this week</span>
        <span className="s-row" style={{ gap: 14, color: "var(--text-tertiary)", opacity: 0.4 }}><Icon name="chevron-left" size={18} /><Icon name="chevron-right" size={18} /></span>
      </div>
      <div className="m-strip">
        {MOCK_WEEK.map((w, i) => (
          <span key={i} className={"m-sday" + (w.today ? " is-today" : "") + (w.state ? " is-" + w.state : "")}>
            <span className="m-sini">{w.d}</span>
            <span className="m-sdisc">{w.n}{w.state === "done" ? <span className="m-scheck"><Icon name="check" size={10} strokeWidth={3.25} /></span> : null}</span>
            <span className="m-sdot"></span>
          </span>
        ))}
      </div>
      <SuggestionCard tone="dusk" kicker="Today · 7:00 · 20 min" title="Walk-run intervals." body="Six one-minute runs with easy walks between. Slow enough to talk." actionLabel="Start" secondaryLabel="Not today" />
      <div className="m-steps-today">
        <span className="m-stepdisc"><Icon name="footprints" size={20} /></span>
        <span className="s-col" style={{ gap: 2 }}>
          <span className="s-body"><b className="m-num">3,240</b> steps today</span>
          <span className="s-cap" style={{ color: "var(--text-secondary)" }}>From your phone · updated 9:38</span>
        </span>
      </div>
      <div className="s-col" style={{ marginTop: 8 }}>
        <div className="s-row" style={{ justifyContent: "space-between", alignItems: "baseline" }}><span className="s-sect">This week</span><span className="s-cap">1 of 3 done</span></div>
        <p className="s-bodysm" style={{ marginTop: 6 }}>Three short sessions, with rest days between. There's no need to add more.</p>
        <div style={{ marginTop: 8 }}>
          {MOCK_ROWS.map((r, i) => (
            <div key={i} className="m-srow">
              <span className="s-cday"><b>{r.day}</b><span className="s-cap">{r.date}</span></span>
              <span className="s-col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <span className="s-ctitle" style={r.end === "done" ? { color: "var(--text-secondary)" } : null}>{r.title}</span>
                <span className="s-cap">{r.meta}</span>
              </span>
              {r.end === "done" ? <Badge tone="success" dot>Done</Badge> : r.end === "today" ? <span className="s-label" style={{ color: "var(--accent-text)" }}>Today</span> : <Icon name="chevron-right" size={18} style={{ color: "var(--text-tertiary)" }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
    <MockNav />
  </>;
}
function MockChange() {
  return <>
    <div className="m-top" style={{ minHeight: 52 }}>
      <IconButton icon="arrow-left" label="Back" />
      <span className="s-col" style={{ alignItems: "center", gap: 2 }}><span className="s-sub">Coach</span><span className="s-cap" style={{ color: "var(--text-secondary)" }}>Running · week 1</span></span>
      <span style={{ width: 44 }}></span>
    </div>
    <div className="m-content" style={{ gap: 12 }}>
      <DemoBubble>Tell us what to change, or a workout you did. Your plan updates straight away, and you can always undo.</DemoBubble>
      <DemoBubble me>Can we keep everything to mornings this week, and make Friday shorter?</DemoBubble>
      <ChangeCard {...MOCK_CHANGE} onUndo={() => {}} onSeePlan={() => {}} seeLabel="See week" />
    </div>
    <div className="m-compose">
      <span className="s-cap" style={{ textAlign: "center", color: "var(--text-secondary)" }}>Changes apply straight away. You can undo.</span>
      <div className="s-row" style={{ gap: 8 }}>
        <span className="m-input">Message your coach…</span>
        <IconButton icon="arrow-up" label="Send" variant="primary" disabled />
      </div>
    </div>
  </>;
}

function HowSection({ bp }: { bp: Breakpoint }) {
  const scale = bp === "tablet" ? 0.46 : 0.62;
  const mocks = [<MockAsk />, <MockPlan />, <MockChange />];
  return (
    <section id="how" className="s-section" aria-labelledby="s-how-h">
      <div className="s-sechead">
        <Kicker>How it works</Kicker>
        <h2 id="s-how-h" className="s-h2" tabIndex={-1}>Ask, plan, change.</h2>
        <p className="s-body">From a few questions to a week that fits, in about a minute.</p>
      </div>
      {bp === "phone" ? <>
        <ol className="s-beatlist">
          {BEATS.map(b => (
            <li key={b.kicker}>
              <span className="s-disc44"><Icon name={b.icon} size={20} /></span>
              <span className="s-col" style={{ gap: 4 }}><Kicker>{b.kicker}</Kicker><h3 className="s-h3">{b.title}</h3><p className="s-bodysm">{b.body}</p></span>
            </li>
          ))}
        </ol>
        <div className="s-beat"><DemoPhone scale={0.62}><MockPlan /></DemoPhone></div>
      </> : (
        <div className="s-beats">
          {BEATS.map((b, i) => (
            <figure key={b.kicker} className="s-beat">
              <DemoPhone scale={scale}>{mocks[i]}</DemoPhone>
              <figcaption>
                <Kicker>{b.kicker}</Kicker>
                <h3 className="s-h3">{b.title}</h3>
                <p className="s-bodysm">{b.body}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="s-section" aria-labelledby="s-feat-h">
      <div className="s-sechead">
        <Kicker>What's inside</Kicker>
        <h2 id="s-feat-h" className="s-h2" tabIndex={-1}>Gentle by default.</h2>
        <p className="s-body">Short sessions, rest days between, and no streaks or scores. Sessions get moved, not failed.</p>
      </div>
      <ul className="s-features">
        {FEATURES.map(([ic, t, b]) => (
          <li key={t}>
            <span className="s-disc44"><Icon name={ic} size={20} /></span>
            <h3 className="s-sub">{t}</h3>
            <p className="s-bodysm">{b}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Landing({ answers, onAnswer, bp }: { answers: Answers; onAnswer: (comfort: string) => void; bp: Breakpoint }) {
  return (
    <div className="s-wrap">
      <Hero comfort={answers.comfort} onAnswer={onAnswer} bp={bp} />
      <HowSection bp={bp} />
      <FeaturesSection />
      <section className="s-band" aria-labelledby="s-band-h">
        <AppIcon size={72} style={{ boxShadow: "var(--shadow-2)" }} />
        <h2 id="s-band-h" className="s-h2">Try the journey.</h2>
        <p className="s-body">About a minute. No account needed.</p>
        <div className="s-btnrow"><Button variant="inverse" size="lg" iconRight="arrow-right" onClick={() => go("#/try/1")}>Try it</Button></div>
      </section>
    </div>
  );
}

export { QuestionCard, Hero, MOCK_WEEK, MOCK_ROWS, MOCK_CHANGE, MockNav, MockAsk, MockPlan, MockChange, HowSection, FeaturesSection, Landing };
