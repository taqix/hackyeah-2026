/* Home — the Today tab: screen 5 and states 5.1–5.13 (see README › Home).
   One question: what do I do today, and how is my week going?
   Data follows docs/product.md and the plan contract on feat/llm-plan-creation
   (docs/plan-creation): each session is an event with a start time and a description,
   or a gym series; a plan can hold fewer sessions than asked (partial) or none (empty).
   Week summaries and "Outside your preferred times." are app copy computed from the plan
   and the answers. Optional sessions and the Not today choices go beyond the current
   contract (README › Home › Not decided yet). Copy never claims automatic progress and
   never asks anyone to make up a session.
   3 October review (docs/mobile-review-2026-10-03.md): plans run one week ahead and history
   is kept in full, so the week strip pages back through every past week and forward to a
   planned next week only. A missed session offers Log it and Move it; skipping lives in
   chat. No guest demo, no first-week or lighter-week notes, no unscheduled weeks.
   Chat is in the tab bar (screens.jsx NavBar), so the header has no chat button.
   Loaded before screens.jsx and wrapped in a function so its names stay local.
   Layout helpers (Content, Col, Row, H1, Kicker, Body, Section, NavBar, greeting) and Sheet
   (workout.jsx) resolve at render time. Registers window.HOME_SCREENS. */
(() => {
const { Icon, Button, IconButton, Badge, Card, SuggestionCard } = window.DS;

/* Skeleton pulse and the indeterminate bar. Both stop under reduced motion. */
if (!document.getElementById("home-motion")) {
  const css = document.createElement("style");
  css.id = "home-motion";
  css.textContent = "@keyframes home-pulse{50%{opacity:.45}}"
    + "@keyframes home-slide{from{transform:translateX(-100%)}to{transform:translateX(250%)}}"
    + "@media (prefers-reduced-motion:reduce){[data-motion]{animation:none!important}[data-motion=slide]{display:none}}";
  document.head.appendChild(css);
}

/* ---------- Data: Ana's first weeks ---------- */

/* Ana's answers, as on onboarding's review (4) and the You tab (9): walk and run, three
   days a week, 20 minutes, between 7:00 and 11:00, occasional new suggestions. Week 1
   (5–11 Oct 2026) as planned on Monday, 24-hour times. `why` is the session's description
   from the plan. Friday sits in the evening (no free morning) until her chat on Wednesday
   evening (8.3). */
const ANSWERS = "walk and run, three days a week, 20 minutes, between 7:00 and 11:00";
const WEEK1 = [
  {short:"Mon",day:"Monday",date:5,state:"planned",title:"Brisk walk",time:"7:00",min:20,why:"A brisk walk outdoors, at a pace where you can still talk."},
  {short:"Tue",day:"Tuesday",date:6,state:"rest"},
  {short:"Wed",day:"Wednesday",date:7,state:"planned",title:"Walk-run intervals",time:"7:00",min:20,why:"Six one-minute runs with easy walks between. Slow enough to talk."},
  {short:"Thu",day:"Thursday",date:8,state:"rest"},
  {short:"Fri",day:"Friday",date:9,state:"planned",title:"Walk-run intervals",time:"18:00",min:20,why:"Six one-minute runs with easy walks between. Outside your preferred times."},
  {short:"Sat",day:"Saturday",date:10,state:"rest"},
  {short:"Sun",day:"Sunday",date:11,state:"rest"},
];
const edit = (week, changes) => week.map((d, i) => changes[i] ? {...d, ...changes[i]} : d);
const WED = edit(WEEK1, {0:{state:"done",felt:"easy"}});
const WED_DONE = edit(WED, {2:{state:"done",felt:"just right"}});
const THU = edit(WED_DONE, {4:{time:"7:00",min:10,updated:true,why:"Three one-minute runs with easy walks between, in the morning as you asked."}});
const SAT = edit(THU, {4:{state:"unlogged"}});
/* Saturday's Move it opened chat (8.15), where Ana chose to skip it this time. */
const SUN = edit(SAT, {4:{state:"skipped"}});

/* Week 2 (12–18 Oct), planned on Sunday 11. "Occasional" discovery may add one new
   activity, marked optional. */
const WEEK2 = [
  {short:"Mon",day:"Monday",date:12,state:"planned",title:"Walk-run intervals",time:"7:00",min:20,why:"Six one-minute runs with easy walks between, like last week."},
  {short:"Tue",day:"Tuesday",date:13,state:"rest"},
  {short:"Wed",day:"Wednesday",date:14,state:"rest"},
  {short:"Thu",day:"Thursday",date:15,state:"planned",title:"Gentle stretching",time:"7:00",min:20,optional:true,why:"Something new to try: easy standing stretches at home. Skip it if you like."},
  {short:"Fri",day:"Friday",date:16,state:"rest"},
  {short:"Sat",day:"Saturday",date:17,state:"planned",title:"Easy walk",time:"7:00",min:20,why:"An easy walk outdoors to round off the week."},
  {short:"Sun",day:"Sunday",date:18,state:"rest"},
];
const WEEK2_WED = edit(WEEK2, {0:{state:"done",felt:"just right"}});
const OPEN3 = WEEK2.map(({short, day, date}) => ({short, day, date:date + 7, state:"open"}));
const SUMMARY1 = "Three short sessions, with rest days between. There's no need to add more.";
const SUMMARY2 = "A walk-run, an easy walk, and one optional stretch to try.";
/* Weeks as Home pages through them: the current one, history before it, and at most one
   planned week after it. */
const W1 = days => ({range:"5–11 Oct", days, summary:SUMMARY1});
const W2 = days => ({range:"12–18 Oct", days, summary:SUMMARY2});
const nextSession = (days, i) => days.slice(i + 1).find(d => d.state === "planned");

/* ---------- Pieces ---------- */

const STRONG = {font:"600 var(--text-base)/1.3 var(--font-body)"};
const SMALL = {font:"var(--type-body-sm)",color:"var(--text-secondary)",margin:0,textWrap:"pretty"};
const CAPTION = {font:"var(--type-caption)",color:"var(--text-tertiary)"};
const HAIRLINE_ON_TINT = "1px solid color-mix(in oklch, var(--text-primary) 10%, transparent)";
const ROW_BTN = {display:"flex",alignItems:"center",width:"100%",padding:0,border:0,background:"transparent",color:"inherit",textAlign:"left",cursor:"pointer"};
const SR_ONLY = {position:"absolute",width:1,height:1,margin:-1,overflow:"hidden",clip:"rect(0 0 0 0)",whiteSpace:"nowrap"};

/* The greeting follows the time of day (screens.jsx greeting); every frame is at 9:41. */
function HomeHeader({kicker, name = "Ana", hour}){
  const hello = greeting(hour);
  return (
    <Col gap={4} style={{minWidth:0}}>
      <Kicker>{kicker}</Kicker>
      <H1>{name ? hello + ", " + name : hello}</H1>
    </Col>
  );
}

function dayLabel(d, isToday){
  const what = {done:"done", planned:d.title + " at " + d.time + (d.optional ? ", optional" : ""), rest:"rest day", open:"nothing planned", unlogged:d.title + ", not logged", skipped:"skipped"}[d.state];
  return d.day + " " + d.date + (isToday ? ", today" : "") + (what ? ", " + what : "");
}
function CheckBadge(){
  return (
    <span aria-hidden="true" style={{position:"absolute",right:-3,bottom:-3,width:16,height:16,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--success)",color:"var(--surface-card)",boxShadow:"0 0 0 2px var(--bg-app)"}}>
      <Icon name="check" size={10} strokeWidth={3.25}/>
    </span>
  );
}
/* Which week the strip shows, with arrows. Back goes through every past week; forward only
   to a week that's already planned, which is at most the next one (plans are made a week
   at a time, on Sunday). Away from this week, "This week" jumps back. */
function WeekNav({label, onPrev, onNext, nextHint, onThisWeek}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:2,minHeight:36,margin:"0 -6px 0 0"}}>
      <span style={{flex:1,minWidth:0,font:"var(--type-label)",color:"var(--text-secondary)",fontVariantNumeric:"tabular-nums"}}>{label}</span>
      {onThisWeek ? <Button variant="ghost" size="sm" onClick={onThisWeek} style={{marginRight:2}}>This week</Button> : null}
      <IconButton icon="chevron-left" size="sm" label={onPrev ? "Previous week" : "No earlier weeks"} disabled={!onPrev} onClick={onPrev}/>
      <IconButton icon="chevron-right" size="sm" label={onNext ? "Next week" : nextHint} disabled={!onNext} onClick={onNext}/>
    </div>
  );
}
/* Week strip. Today is filled. Done days get a check, planned days a dot, a past session
   nobody logged a dashed ring, another selected day a ring. Never colour alone. */
function WeekStrip({days, today, selected = today, onSelect, loading}){
  return (
    <div role="group" aria-label={loading ? "This week, loading" : "Week"} style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:4}}>
      {days.map((d, i) => {
        const isToday = i === today, s = loading ? "loading" : d.state;
        const ring = onSelect && i === selected && !isToday;
        const disc = s === "loading" ? {background:"var(--surface-sunken)",color:"var(--text-tertiary)"}
          : isToday ? {background:"var(--surface-inverse)",color:"var(--text-inverse)"}
          : s === "done" ? {background:"var(--success-soft)",color:"var(--success-text)"}
          : s === "planned" ? {color:"var(--accent-text)"}
          : {color:"var(--text-tertiary)"};
        return (
          <button key={i} type="button" disabled={loading} onClick={onSelect ? () => onSelect(i) : undefined}
            aria-label={loading ? undefined : dayLabel(d, isToday)} aria-pressed={onSelect ? i === selected : undefined} aria-current={isToday ? "date" : undefined}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:"4px 0",border:0,background:"transparent",color:"inherit",cursor:onSelect ? "pointer" : "default"}}>
            <span style={{font:"var(--type-caption)",fontWeight:isToday ? 600 : 500,color:isToday ? "var(--text-primary)" : "var(--text-tertiary)"}}>{d.short[0]}</span>
            <span data-motion={s === "loading" ? "pulse" : undefined}
              style={{position:"relative",width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:99,font:"600 17px/1 var(--font-numeric)",fontVariantNumeric:"tabular-nums",
                border:s === "unlogged" && !isToday ? "1.5px dashed var(--text-tertiary)" : "none",
                boxShadow:ring ? "inset 0 0 0 2px var(--text-primary)" : "none",
                animation:s === "loading" ? "home-pulse 1.6s var(--ease-in-out) infinite" : "none",
                transition:"box-shadow var(--dur-fast) var(--ease-out)",...disc}}>
              {d.date}
              {s === "done" ? <CheckBadge/> : null}
            </span>
            <span aria-hidden="true" style={{width:5,height:5,borderRadius:99,background:s === "planned" ? "var(--accent)" : "transparent"}}></span>
          </button>
        );
      })}
    </div>
  );
}

/* Tinted hero for days without a session to start, and for plan or app states. Same slot,
   radius and title scale as SuggestionCard, so the top of Home keeps its shape. */
const HERO = {
  rest:{bg:"var(--tint-sage)",fg:"var(--recovery)"},
  done:{bg:"var(--success-soft)",fg:"var(--success)"},
  warm:{bg:"var(--tint-peach)",fg:"var(--warm-text)"},
  quiet:{bg:"var(--surface-sunken)",fg:"var(--text-secondary)"},
};
function HeroCard({tone = "quiet", icon, kicker, title, body, actions, alert, children}){
  const t = HERO[tone];
  return (
    <section role={alert ? "alert" : undefined} style={{borderRadius:"var(--radius-xl)",background:t.bg,padding:20,display:"flex",flexDirection:"column",gap:10}}>
      <span style={{alignSelf:"flex-start",display:"inline-flex",alignItems:"center",gap:6,padding:"5px 10px 5px 8px",borderRadius:99,background:"color-mix(in oklch, var(--surface-card) 72%, transparent)",font:"600 var(--text-xs)/1 var(--font-body)",color:"var(--text-secondary)"}}>
        <Icon name={icon} size={14} strokeWidth={2} color={t.fg}/>{kicker}
      </span>
      <h3 style={{font:"700 27px/1.08 var(--font-display)",letterSpacing:"-0.02em",margin:0,textWrap:"balance"}}>{title}</h3>
      {body ? <p style={{...SMALL,fontSize:15}}>{body}</p> : null}
      {actions ? <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:6}}>{actions}</div> : null}
      {children}
    </section>
  );
}
function NextRow({d}){
  return (
    <button type="button" style={{...ROW_BTN,gap:12,minHeight:56,marginTop:6,paddingTop:12,borderTop:HAIRLINE_ON_TINT}}>
      <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
        <span style={{font:"var(--type-caption)",color:"var(--text-secondary)"}}>Next · {d.day} {d.time}</span>
        <span style={STRONG}>{d.title}<span style={{fontWeight:400,color:"var(--text-secondary)"}}> · {d.min} min</span></span>
      </span>
      <Icon name="chevron-right" size={18} color="var(--text-secondary)"/>
    </button>
  );
}
/* A past session with no outcome: log it, or move it. Move it opens chat with the session
   attached (8.15), where skipping it is one option among the free days, not the first. */
const LogOrMove = () => <><Button variant="secondary" icon="check">Log it</Button><Button variant="secondary" icon="calendar-arrow-up">Move it</Button></>;
/* The hero follows the selected day: a session to start or preview, or what the day holds. */
function DayHero({d, isToday, next}){
  const when = isToday ? "Today" : d.day;
  switch (d.state){
    case "planned":
      return <SuggestionCard tone={isToday ? "dusk" : "dawn"} kicker={[when, d.time, d.min + " min", d.optional ? "optional" : null].filter(Boolean).join(" · ")}
        title={d.title + "."} body={d.why} actionLabel={isToday ? "Start" : "Preview"} secondaryLabel={isToday ? "Not today" : undefined}/>;
    case "done":
      return (
        <HeroCard tone="done" icon="check" kicker={when + " · done · " + d.min + " min"} title={isToday ? "Nice and steady." : d.title + "."} body={"You said it felt " + d.felt + "."}>
          {isToday && next ? <NextRow d={next}/> : null}
        </HeroCard>
      );
    case "unlogged":
      return <HeroCard icon="calendar-clock" kicker={when + " · " + d.time + " · " + d.min + " min"} title={d.title + "."} body="Not logged. If you went, log it. If not, move it to a day that suits you." actions={<LogOrMove/>}/>;
    case "skipped":
      return <HeroCard icon="moon" kicker={when + " · skipped"} title={d.title + "."} body="Skipped, and that's fine. There's nothing to make up."/>;
    case "open":
      return <HeroCard tone="rest" icon="feather" kicker={when} title="Nothing planned." body="A free day. Rest is part of the plan, too.">{next ? <NextRow d={next}/> : null}</HeroCard>;
    default:
      return (
        <HeroCard tone="rest" icon="feather" kicker={when + " · rest day"} title="Rest day." body={(isToday ? "Nothing planned today. " : "Nothing planned. ") + "Rest is part of the plan, too."}>
          {next ? <NextRow d={next}/> : null}
        </HeroCard>
      );
  }
}

/* A past session with no outcome, asked once, without guilt. Skipping never creates
   catch-up, and it isn't offered here: Move it leads to chat, where it is. */
function CheckIn({d}){
  return (
    <Card padding={20}>
      <Col gap={12}>
        <Col gap={4}>
          <span style={CAPTION}>{d.day} · {d.time} · {d.title}</span>
          <span style={{font:"var(--type-heading)",letterSpacing:"var(--tracking-tight)"}}>Did {d.day} happen?</span>
        </Col>
        <p style={SMALL}>Log it if you went. If not, move it to a day that suits you.</p>
        <Row gap={8}><LogOrMove/></Row>
      </Col>
    </Card>
  );
}

/* Today's steps from the phone: useStepCounter() (docs/features/system-step-counter.md on
   develop). Without access it asks quietly and never shows a made-up zero. The hook's
   other states (denied: Open Settings; unavailable; error: Try again) use the same row. */
function StepCount({count, at}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:14,minHeight:64,padding:"10px 12px",borderRadius:"var(--radius-md)",background:"var(--surface-sunken)"}}>
      <span style={{width:40,height:40,flex:"none",borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--surface-card)",color:"var(--text-secondary)"}}><Icon name="footprints" size={20}/></span>
      <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
        {count
          ? <span style={{font:"var(--type-body)",color:"var(--text-secondary)"}}><span style={{font:"600 18px/1 var(--font-numeric)",fontVariantNumeric:"tabular-nums",letterSpacing:"var(--tracking-tight)",color:"var(--text-primary)"}}>{count}</span> steps today</span>
          : <span style={STRONG}>Steps today</span>}
        <span style={{...CAPTION,color:"var(--text-secondary)"}}>{count ? "From your phone · updated " + at : "Allow motion access to see them here."}</span>
      </span>
      {count ? null : <Button variant="secondary" size="sm" style={{height:44}}>Turn on</Button>}
    </div>
  );
}

function SessionRow({d, isToday, divider}){
  const quiet = d.state !== "planned";
  const meta = d.state === "done" ? d.min + " min · felt " + d.felt : d.time + " · " + d.min + " min";
  const end = d.state === "done" ? <Badge tone="success" dot>Done</Badge>
    : d.state === "unlogged" ? <Badge>Not logged</Badge>
    : d.state === "skipped" ? <Badge>Skipped</Badge>
    : isToday ? <span style={{font:"var(--type-label)",color:"var(--accent-text)"}}>Today</span>
    : <Icon name="chevron-right" size={18} color="var(--text-tertiary)"/>;
  return (
    <button type="button" style={{...ROW_BTN,gap:14,minHeight:64,padding:"10px 0",borderTop:divider ? "1px solid var(--border-subtle)" : "none"}}>
      <span style={{width:44,flex:"none",display:"flex",flexDirection:"column",gap:3}}>
        <span style={{font:"600 15px/1 var(--font-body)"}}>{d.short}</span>
        <span style={CAPTION}>{d.date} Oct</span>
      </span>
      <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
        <span style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <span style={{...STRONG,color:quiet ? "var(--text-secondary)" : "var(--text-primary)"}}>{d.title}</span>
          {d.updated && !quiet ? <Badge tone="accent">Updated</Badge> : null}
          {d.optional ? <Badge>Optional</Badge> : null}
        </span>
        <span style={{...CAPTION,fontVariantNumeric:"tabular-nums"}}>{meta}</span>
      </span>
      {end}
    </button>
  );
}
/* A week's sessions. The aside counts what's done, or how many there are. */
function WeekList({title, week, today}){
  const rows = week.days.map((d, i) => ({...d, i})).filter(d => d.title && d.state !== "rest" && d.state !== "open");
  const done = rows.filter(d => d.state === "done").length, total = rows.filter(d => !d.optional).length;
  return (
    <Col gap={0} style={{marginTop:8}}>
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:12}}>
        <Section>{title}</Section>
        <span style={{...CAPTION,fontVariantNumeric:"tabular-nums"}}>{done ? done + " of " + total + " done" : rows.length + " sessions"}</span>
      </div>
      {week.summary ? <p style={{...SMALL,marginTop:6}}>{week.summary}</p> : null}
      <div style={{marginTop:8}}>{rows.map((d, k) => <SessionRow key={d.i} d={d} isToday={d.i === today} divider={k > 0}/>)}</div>
    </Col>
  );
}

function TextLink({children, style}){
  return (
    <button type="button" style={{alignSelf:"flex-start",display:"inline-flex",alignItems:"center",gap:6,height:44,margin:"-4px 0 -12px",padding:0,border:0,background:"transparent",color:"var(--accent-text)",font:"600 var(--text-sm)/1 var(--font-body)",cursor:"pointer",...style}}>
      {children}<Icon name="arrow-right" size={16}/>
    </button>
  );
}
function Chip({icon, children}){
  const [down, setDown] = React.useState(false);
  return (
    <button type="button" onPointerDown={() => setDown(true)} onPointerUp={() => setDown(false)} onPointerLeave={() => setDown(false)}
      style={{display:"inline-flex",alignItems:"center",gap:8,height:40,padding:"0 16px",borderRadius:"var(--radius-pill)",border:"1px solid var(--border-strong)",background:"var(--surface-card)",color:"var(--text-primary)",font:"var(--type-label)",cursor:"pointer",transform:down ? "scale(var(--press-scale))" : "none",transition:"transform var(--dur-fast) var(--ease-out)"}}>
      <Icon name={icon} size={16}/>{children}
    </button>
  );
}
/* Two starter requests. Each chip opens chat with the request filled in; anything else
   starts from chat in the tab bar, so this stays small. */
function ChangePlan(){
  return (
    <Col gap={10} style={{marginTop:8}}>
      <Section>Need a change?</Section>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        <Chip icon="timer">Shorter sessions</Chip>
        <Chip icon="calendar-days">Other days</Chip>
      </div>
    </Col>
  );
}

/* The one note Home keeps: the plan changed, with the chat card's summary (8.3), shown once.
   The changed session gets an Updated tag in the list; old → new values stay in chat.
   Other info notes (first week, lighter week) were dropped as clutter in the review. */
function PlanUpdated(){
  return (
    <section role="status" style={{display:"flex",flexDirection:"column",gap:4,padding:"6px 4px 16px 16px",borderRadius:"var(--radius-card)",background:"var(--accent-soft)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,minHeight:44}}>
        <Icon name="check" size={18} strokeWidth={2} color="var(--accent-text)"/>
        <span style={{...STRONG,flex:1,minWidth:0}}>Plan updated<span style={{font:"var(--type-caption)",color:"var(--text-secondary)"}}> · last night</span></span>
        <IconButton icon="x" label="Dismiss"/>
      </div>
      <div style={{...SMALL,paddingRight:12}}>All your sessions are at 7:00 now, and Friday is 10 minutes.</div>
      <TextLink>See the chat</TextLink>
    </section>
  );
}

/* Alternatives to today's session: simpler, five minutes, move, or skip with nothing to
   make up. Each opens chat with the request filled in, and chat updates the plan.
   The current contract has no such shortcuts yet (README › Home). */
const NOT_TODAY = [
  {icon:"feather",title:"Make it simpler",detail:"A gentler version, still 20 min."},
  {icon:"timer",title:"Five minutes instead",detail:"A short version. It still counts."},
  {icon:"calendar-clock",title:"Move it",detail:"To later today or another free day."},
  {icon:"moon",title:"Skip today",detail:"Nothing to make up. Friday stays as planned."},
];
function NotTodaySheet(){
  return (
    <Sheet label="Not today">
      <Col gap={8} style={{padding:"0 4px"}}>
        <span style={{font:"var(--type-heading)",letterSpacing:"var(--tracking-tight)"}}>Not today?</span>
        <Body>Pick what helps. The rest of your week stays as it is.</Body>
      </Col>
      <div>{NOT_TODAY.map((o, i) => (
        <button key={o.title} type="button" style={{...ROW_BTN,gap:14,minHeight:64,padding:"10px 4px",borderTop:i ? "1px solid var(--border-subtle)" : "none"}}>
          <span style={{width:44,height:44,flex:"none",borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--surface-sunken)",color:"var(--text-secondary)"}}><Icon name={o.icon} size={20}/></span>
          <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}><span style={STRONG}>{o.title}</span><span style={SMALL}>{o.detail}</span></span>
          <Icon name="chevron-right" size={18} color="var(--text-tertiary)"/>
        </button>
      ))}</div>
      <TextLink style={{marginLeft:4}}>Something else? Ask in chat</TextLink>
    </Sheet>
  );
}

const Sk = ({w = "100%", h = 14, r = 8}) => <span data-motion="pulse" style={{display:"block",width:w,height:h,borderRadius:r,background:"var(--surface-sunken)",animation:"home-pulse 1.6s var(--ease-in-out) infinite"}}></span>;
function Working({label}){
  return (
    <div role="progressbar" aria-label={label} style={{marginTop:8,height:4,borderRadius:99,background:"rgba(251,248,242,.24)",overflow:"hidden"}}>
      <div data-motion="slide" style={{width:"40%",height:"100%",borderRadius:99,background:"#FBF8F2",animation:"home-slide 1.6s var(--ease-in-out) infinite"}}></div>
    </div>
  );
}

/* ---------- Layout ---------- */

const weekWord = (w, current) => w === current ? "this week" : w === current + 1 ? "next week" : w === current - 1 ? "last week" : null;
const listTitle = (weeks, w, current) => { const word = weekWord(w, current); return word ? word[0].toUpperCase() + word.slice(1) : "Week of " + weeks[w].range; };

/* Top to bottom: greeting, note, week (with its arrows), hero, extra card, steps, sessions,
   chat starters. The strip drives the hero; tap a day to see it, or page to another week.
   `weeks` holds history before `current` and at most one planned week after it.
   `previewNext` lists next week under this week's hero (Sunday, once it's planned). */
function HomeScreen({kicker, name, hour, note, weeks, current = 0, today, initialWeek = current, initialDay = today, selectable = true, todayHero, after, steps, previewNext, change = true}){
  const [w, setW] = React.useState(initialWeek);
  const [sel, setSel] = React.useState(initialDay);
  const isCurrent = w === current, days = weeks[w].days;
  const hero = isCurrent && sel === today && todayHero ? todayHero : <DayHero d={days[sel]} isToday={isCurrent && sel === today} next={nextSession(days, sel)}/>;
  const listWeek = previewNext && isCurrent && weeks[w + 1] ? w + 1 : w;
  const word = weekWord(w, current);
  return (
    <>
      <Content pb={120} gap={20}>
        <HomeHeader kicker={kicker} name={name} hour={hour}/>
        {note}
        <Col gap={6}>
          {selectable ? <WeekNav label={weeks[w].range + (word ? " · " + word : "")}
            onPrev={w > 0 ? () => setW(w - 1) : null} onNext={w < weeks.length - 1 ? () => setW(w + 1) : null}
            nextHint={w > current ? "Plans go one week ahead" : "Next week is planned on Sunday"}
            onThisWeek={isCurrent ? null : () => { setW(current); setSel(today); }}/> : null}
          <WeekStrip days={days} today={isCurrent ? today : -1} selected={sel} onSelect={selectable ? setSel : undefined}/>
        </Col>
        {hero}
        {isCurrent ? after : null}
        {isCurrent ? steps : null}
        <WeekList title={listTitle(weeks, listWeek, current)} week={listWeek < current ? {...weeks[listWeek], summary:null} : weeks[listWeek]} today={listWeek === current ? today : -1}/>
        {change ? <ChangePlan/> : null}
      </Content>
      <NavBar value="today"/>
    </>
  );
}
/* Before a plan exists, or when it can't load: greeting and one card, nothing to tap into. */
function PlainScreen({kicker, name, children}){
  return (
    <>
      <Content pb={120} gap={20}>
        <HomeHeader kicker={kicker} name={name}/>
        {children}
      </Content>
      <NavBar value="today"/>
    </>
  );
}

/* ---------- Screens ---------- */

/* 5 — Wednesday morning of week 1. Interactive: tap a day. Both arrows are off: there are
   no earlier weeks yet, and next week is planned on Sunday. */
const Today = ({initialDay}) => (
  <HomeScreen kicker="Wednesday, 7 October · Week 1" weeks={[W1(WED)]} today={2} initialDay={initialDay}
    steps={<StepCount count="3,240" at="9:38"/>}/>
);
/* 5.1 — Another day selected: Friday's session to preview, with its "outside your preferred times" label. */
const FridaySelected = () => <Today initialDay={4}/>;
/* 5.2 — "Not today" on the hero opens alternatives instead of a guilt trip. */
const NotToday = () => <><Today/><NotTodaySheet/></>;
/* 5.3 — After completion and feedback (screen 7). */
const DoneToday = () => (
  <HomeScreen kicker="Wednesday, 7 October · Week 1" weeks={[W1(WED_DONE)]} today={2}
    steps={<StepCount count="5,906" at="9:38"/>}/>
);
/* 5.4 — Thursday: a rest day, the morning after a chat revision. */
const Updated = () => (
  <HomeScreen kicker="Thursday, 8 October · Week 1" note={<PlanUpdated/>} weeks={[W1(THU)]} today={3}
    steps={<StepCount count="1,204" at="9:38"/>}/>
);
/* 5.5 — Saturday: Friday passed with nothing logged. Log it, or Move it into chat. */
const CheckInDay = () => (
  <HomeScreen kicker="Saturday, 10 October · Week 1" weeks={[W1(SAT)]} today={5} after={<CheckIn d={SAT[4]}/>}
    steps={<StepCount count="860" at="9:38"/>}/>
);
/* 5.6 — Sunday: the week is done and celebrated, Friday skipped without fuss. Week 2 is
   planned now, so the forward arrow opens it and the list previews it. One plain line on
   why it matters; no streaks, no scores. */
const WeekDone = () => (
  <HomeScreen kicker="Sunday, 11 October · Week 1" weeks={[W1(SUN), W2(WEEK2)]} today={6} previewNext
    todayHero={
      <HeroCard tone="warm" icon="sun" kicker="Week 1 · 2 sessions" title="First week, done." body="Two sessions, both at 7 in the morning. Good work — keep it going. Rest today; week 2 starts tomorrow.">
        <Row gap={8} style={{alignItems:"flex-start",marginTop:6,paddingTop:12,borderTop:HAIRLINE_ON_TINT}}>
          <Icon name="heart" size={16} color="var(--warm-text)" style={{marginTop:1}}/>
          <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)",textWrap:"pretty"}}>Moving a little most weeks is good for your mood, your sleep and your heart.</span>
        </Row>
      </HeroCard>}
    steps={<StepCount count="2,315" at="9:38"/>}/>
);
/* 5.7 — Right after onboarding's Build plan (4): the first plan is being generated. */
const Building = () => (
  <>
    <Content pb={120} gap={20}>
      <HomeHeader kicker="Monday, 5 October"/>
      <WeekStrip days={WEEK1} today={0} loading/>
      <div role="status">
        <SuggestionCard tone="sage" kicker="Your first week" title="Building your week." body="Walk and run, three days a week, 20 minutes, between 7:00 and 11:00. This takes about a minute.">
          <Working label="Building your plan"/>
        </SuggestionCard>
      </div>
      <p style={{...CAPTION,margin:0,textAlign:"center"}}>You can leave this screen. We'll keep going.</p>
    </Content>
    <NavBar value="today"/>
  </>
);
/* 5.8 — Generation failed. No partial plan is shown; answers are kept. */
const BuildFailed = () => (
  <PlainScreen kicker="Monday, 5 October">
    <HeroCard alert icon="calendar-x" kicker="Your first week" title="Plan didn't build." body="Something went wrong on our side. Your answers are saved, so trying again only takes a moment."
      actions={<><Button icon="rotate-ccw">Try again</Button><Button variant="ghost">Review answers</Button></>}/>
    <p style={{...CAPTION,margin:0}}>From your answers: {ANSWERS}.</p>
  </PlainScreen>
);
/* 5.9 — Monday of week 1: the first open after the plan is ready. No first-week note. */
const DayOne = () => (
  <HomeScreen kicker="Monday, 5 October · Week 1" weeks={[W1(WEEK1)]} today={0} steps={<StepCount/>}/>
);
/* 5.10 — Wednesday of week 2, paged back to week 1: history in full, read-only. "This week"
   jumps back; forward stops at this week until Sunday plans the next. */
const EarlierWeek = () => (
  <HomeScreen kicker="Wednesday, 14 October · Week 2" weeks={[W1(SUN), W2(WEEK2_WED)]} current={1} today={2} initialWeek={0}
    steps={<StepCount count="4,012" at="9:38"/>}/>
);
/* 5.11 — Empty week: nothing fits the current choices ({"events": []}). A valid plan, not an error. */
const Quiet = () => (
  <HomeScreen kicker="Monday, 19 October · Week 3" weeks={[{range:"19–25 Oct", days:OPEN3}]} today={0} selectable={false} change={false}
    todayHero={
      <HeroCard icon="calendar" kicker="Week 3" title="A quiet week." body="No session fits your current choices. You can change them whenever you're ready."
        actions={<><Button variant="secondary">Review choices</Button><Button variant="ghost">Open chat</Button></>}>
        <Row gap={8} style={{alignItems:"flex-start",marginTop:6,paddingTop:12,borderTop:HAIRLINE_ON_TINT}}>
          <Icon name="info" size={16} color="var(--info)" style={{marginTop:1}}/>
          <span style={{font:"var(--type-caption)",color:"var(--text-secondary)"}}>Walk and Run are both switched off in your choices.</span>
        </Row>
      </HeroCard>}/>
);
/* 5.12 — First load. Shapes match the loaded screen so nothing jumps. */
const Loading = () => (
  <>
    <Content pb={120} gap={20}>
      <span role="status" style={SR_ONLY}>Loading your plan</span>
      <Col gap={10} style={{paddingTop:2}}><Sk w={196} h={14}/><Sk w={258} h={32} r={10}/><Sk w={118} h={32} r={10}/></Col>
      <Col gap={6}><Sk w={132} h={14}/><WeekStrip days={WED} today={2} loading/></Col>
      <Sk h={236} r={32}/>
      <Sk h={64} r={18}/>
      <Col gap={18} style={{marginTop:8}}>
        <Sk w={104} h={18}/>
        {[0, 1, 2].map(i => <Row key={i} gap={14}><Sk w={44} h={30}/><Col gap={6} style={{flex:1}}><Sk w={i === 1 ? "62%" : "48%"} h={14}/><Sk w="30%" h={10}/></Col></Row>)}
      </Col>
    </Content>
    <NavBar value="today"/>
  </>
);
/* 5.13 — The plan can't be fetched. */
const Offline = () => (
  <PlainScreen kicker="Wednesday, 7 October" name={null}>
    <HeroCard alert icon="cloud-off" kicker="No connection" title="Plan won't load." body="Check your connection, then try again. Anything you've logged is safe."
      actions={<Button icon="rotate-ccw">Try again</Button>}/>
  </PlainScreen>
);

window.HOME_SCREENS = [
  {id:"home",label:"5 · Home",C:Today,h:"auto"},
  {id:"home-friday",label:"5.1 · Friday selected",C:FridaySelected,h:"auto"},
  {id:"home-not-today",label:"5.2 · Not today",C:NotToday},
  {id:"home-done",label:"5.3 · Done for today",C:DoneToday,h:"auto"},
  {id:"home-updated",label:"5.4 · Rest day, plan updated",C:Updated,h:"auto"},
  {id:"home-check-in",label:"5.5 · Did it happen?",C:CheckInDay,h:"auto",note:"Log it, or Move it. Move it opens chat with Friday attached (8.15); skipping is offered there, not here."},
  {id:"home-week-done",label:"5.6 · Week done",C:WeekDone,h:"auto",note:"Week 2 is planned now: the forward arrow opens it. Encouragement without hype."},
  {id:"home-building",label:"5.7 · Building the plan",C:Building},
  {id:"home-build-failed",label:"5.8 · Plan didn't build",C:BuildFailed},
  {id:"home-day-one",label:"5.9 · Day one",C:DayOne,h:"auto"},
  {id:"home-earlier-week",label:"5.10 · An earlier week",C:EarlierWeek,h:"auto",note:"History goes back to the first week. Forward stops at the planned week: one week ahead at most."},
  {id:"home-quiet",label:"5.11 · Quiet week",C:Quiet},
  {id:"home-loading",label:"5.12 · Loading",C:Loading},
  {id:"home-offline",label:"5.13 · Can't load",C:Offline},
];
})();
