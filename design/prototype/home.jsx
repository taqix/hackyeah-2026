/* Home — the Today tab: screen 5 and states 5.1–5.15 (see README › Home).
   One question: what do I do today, and how is my week going?
   Data follows docs/product.md and the proposed weekly plan contract on
   feat/llm-plan-creation: a week summary, one explanation per session, notices,
   optional trials, unscheduled suggestions. Copy never claims automatic progress
   and never asks anyone to make up a session.
   Loaded before screens.jsx and wrapped in a function so its names stay local.
   Layout helpers (Content, Col, Row, H1, Kicker, Body, Section, NavBar) and Sheet
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

/* ---------- Data: Ana's first two weeks ---------- */

/* Ana's answers, as on the You tab (profile.jsx): walk and run, three days a week,
   20 minutes, mornings, occasional new suggestions. Week 1 as planned on Monday, 24-hour
   times. Friday sits in the evening until her chat on Wednesday evening (screen 8). */
const ANSWERS = "walk and run, three days a week, 20 minutes, mornings";
const WEEK1 = [
  {short:"Mon",day:"Monday",date:6,state:"planned",title:"Brisk walk",time:"7:00",min:20,why:"A short walk to start, at the morning time you picked. Everyone starts somewhere."},
  {short:"Tue",day:"Tuesday",date:7,state:"rest"},
  {short:"Wed",day:"Wednesday",date:8,state:"planned",title:"Walk-run intervals",time:"7:00",min:24,why:"Short runs between walks, at 7:00 like Monday."},
  {short:"Thu",day:"Thursday",date:9,state:"rest"},
  {short:"Fri",day:"Friday",date:10,state:"planned",title:"Walk-run intervals",time:"18:00",min:24,why:"The same walk-run, in the evening this time. Outside your preferred times."},
  {short:"Sat",day:"Saturday",date:11,state:"rest"},
  {short:"Sun",day:"Sunday",date:12,state:"rest"},
];
const edit = (week, changes) => week.map((d, i) => changes[i] ? {...d, ...changes[i]} : d);
const WED = edit(WEEK1, {0:{state:"done",felt:"easy"}});
const WED_DONE = edit(WED, {2:{state:"done",felt:"just right"}});
const THU = edit(WED_DONE, {4:{time:"7:00",min:18,updated:true,why:"Shorter and in the morning, as you asked: four intervals instead of six."}});
const SAT = edit(THU, {4:{state:"unlogged"}});
const SUN = edit(SAT, {4:{state:"skipped"}});

/* Week 2 is even, so "occasional" allows one optional new type. */
const WEEK2 = [
  {short:"Mon",day:"Monday",date:13,state:"planned",title:"Walk-run intervals",time:"7:00",min:24,why:"You said you'd choose this walk-run again."},
  {short:"Tue",day:"Tuesday",date:14,state:"rest"},
  {short:"Wed",day:"Wednesday",date:15,state:"rest"},
  {short:"Thu",day:"Thursday",date:16,state:"planned",title:"Gentle stretching",time:"7:00",min:20,optional:true,why:"Something new to try, if you like. You can skip it this week."},
  {short:"Fri",day:"Friday",date:17,state:"rest"},
  {short:"Sat",day:"Saturday",date:18,state:"planned",title:"Easy walk",time:"7:00",min:20,why:"An easy walk to round off the week."},
  {short:"Sun",day:"Sunday",date:19,state:"rest"},
];
const OPEN2 = WEEK2.map(({short, day, date}) => ({short, day, date, state:"open"}));
const OPEN3 = OPEN2.map(d => ({...d, date:d.date + 7}));
const LIGHTER = edit(OPEN2, {0:WEEK2[0], 5:{...WEEK2[5], why:"The other free morning this week."}});
const UNSCHEDULED = [
  {title:"Walk-run intervals",min:24,why:"You said you'd choose it again."},
  {title:"Easy walk",min:20},
  {title:"Gentle stretching",min:20,optional:true,why:"Something new, if you like."},
];
const SUMMARY1 = "Three short sessions, with rest days between. There's no need to add more.";
const SUMMARY2 = "The walk-run you'd choose again, an easy walk, and one optional stretch to try.";
const nextSession = (days, i) => days.slice(i + 1).find(d => d.state === "planned");

/* ---------- Pieces ---------- */

const STRONG = {font:"600 var(--text-base)/1.3 var(--font-body)"};
const SMALL = {font:"var(--type-body-sm)",color:"var(--text-secondary)",margin:0,textWrap:"pretty"};
const CAPTION = {font:"var(--type-caption)",color:"var(--text-tertiary)"};
const HAIRLINE_ON_TINT = "1px solid color-mix(in oklch, var(--text-primary) 10%, transparent)";
const ROW_BTN = {display:"flex",alignItems:"center",width:"100%",padding:0,border:0,background:"transparent",color:"inherit",textAlign:"left",cursor:"pointer"};
const SR_ONLY = {position:"absolute",width:1,height:1,margin:-1,overflow:"hidden",clip:"rect(0 0 0 0)",whiteSpace:"nowrap"};

function HomeHeader({kicker, name = "Ana", badge, chat = true}){
  return (
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
      <Col gap={4} style={{minWidth:0}}>
        <Row gap={8} style={{flexWrap:"wrap"}}><Kicker>{kicker}</Kicker>{badge}</Row>
        <H1>{name ? "Good morning, " + name : "Good morning"}</H1>
      </Col>
      {chat ? <IconButton icon="message-circle" label="Change plan" variant="secondary"/> : null}
    </div>
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
/* Week strip. Today is filled. Done days get a check, planned days a dot, a past session
   nobody logged a dashed ring, another selected day a ring. Never colour alone. */
function WeekStrip({days, today, selected = today, onSelect, loading}){
  return (
    <div role="group" aria-label={loading ? "This week, loading" : "This week"} style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:4}}>
      {days.map((d, i) => {
        const isToday = i === today, s = loading ? "loading" : d.state;
        const ring = onSelect && i === selected && !isToday;
        const disc = s === "loading" ? {background:"var(--surface-sunken)",color:"var(--text-tertiary)"}
          : isToday ? {background:"var(--surface-inverse)",color:"var(--text-inverse)"}
          : s === "done" ? {background:"var(--success-soft)",color:"var(--success)"}
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
      return <HeroCard icon="calendar-clock" kicker={when + " · " + d.time + " · " + d.min + " min"} title={d.title + "."} body="Not logged. If you went, you can still log it." actions={<Button variant="secondary">Log it</Button>}/>;
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

/* A past session with no outcome. Asked once, without guilt; skipping never creates catch-up. */
function CheckIn({d}){
  return (
    <Card padding={20}>
      <Col gap={12}>
        <Col gap={4}>
          <span style={CAPTION}>{d.day} · {d.time} · {d.title}</span>
          <span style={{font:"var(--type-heading)",letterSpacing:"var(--tracking-tight)"}}>Did {d.day} happen?</span>
        </Col>
        <p style={SMALL}>Log it if you went. If not, that's fine — there's nothing to make up.</p>
        <Row gap={8}><Button variant="secondary">Log it</Button><Button variant="ghost">Skip it</Button></Row>
      </Col>
    </Card>
  );
}

/* Today's steps from the phone (codex/step-counter). Without access it asks quietly and
   never shows a made-up zero. */
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
function WeekList({title = "This week", days, today, aside, summary}){
  const rows = days.map((d, i) => ({...d, i})).filter(d => d.title && d.state !== "rest" && d.state !== "open");
  return (
    <Col gap={0} style={{marginTop:8}}>
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:12}}>
        <Section>{title}</Section>
        {aside ? <span style={{...CAPTION,fontVariantNumeric:"tabular-nums"}}>{aside}</span> : null}
      </div>
      {summary ? <p style={{...SMALL,marginTop:6}}>{summary}</p> : null}
      <div style={{marginTop:8}}>{rows.map((d, k) => <SessionRow key={d.i} d={d} isToday={d.i === today} divider={k > 0}/>)}</div>
    </Col>
  );
}
/* Sessions without a time, when the calendar can't be read. Picking a day schedules one. */
function OpenList({items}){
  return (
    <Col gap={0} style={{marginTop:8}}>
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:12}}>
        <Section>This week</Section>
        <span style={CAPTION}>{items.length} to fit in</span>
      </div>
      <div style={{marginTop:8}}>{items.map((s, i) => (
        <button key={s.title} type="button" style={{...ROW_BTN,gap:14,minHeight:68,padding:"10px 0",borderTop:i ? "1px solid var(--border-subtle)" : "none"}}>
          <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
            <span style={{display:"flex",alignItems:"center",gap:8}}><span style={STRONG}>{s.title}</span>{s.optional ? <Badge>Optional</Badge> : null}</span>
            <span style={CAPTION}>{s.min} min{s.why ? " · " + s.why : ""}</span>
          </span>
          <span style={{display:"inline-flex",alignItems:"center",gap:2,font:"var(--type-label)",color:"var(--accent-text)",whiteSpace:"nowrap"}}>Pick a day<Icon name="chevron-right" size={16}/></span>
        </button>
      ))}</div>
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
/* Chat entry with starter requests. Each chip opens chat with the request filled in. */
function ChangePlan({note}){
  return (
    <Card variant="sunken" padding={20} style={{marginTop:8}}>
      <Col gap={14}>
        <Col gap={4}>
          <Section>Need a change?</Section>
          <p style={SMALL}>Say it in a sentence. Your plan updates straight away.</p>
        </Col>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          <Chip icon="timer">Shorter sessions</Chip>
          <Chip icon="calendar-days">Other days</Chip>
          <Chip icon="message-circle">Something else</Chip>
        </div>
        {note ? <span style={CAPTION}>{note}</span> : null}
      </Col>
    </Card>
  );
}

/* Notes sit above or below the hero. Accent: the plan changed. Warm: encouragement, never
   an action. Info: something about the week or the account. One sentence each. */
const NOTE = {accent:["var(--accent-soft)","var(--accent-text)"], warm:["var(--tint-peach)","var(--warm-text)"], info:["var(--info-soft)","var(--info)"]};
function Note({tone = "accent", icon, title, meta, dismiss = true, action, children}){
  const [bg, fg] = NOTE[tone];
  return (
    <section role="status" style={{display:"flex",flexDirection:"column",gap:4,padding:dismiss ? "6px 4px 16px 16px" : "14px 16px 16px",borderRadius:"var(--radius-card)",background:bg}}>
      <div style={{display:"flex",alignItems:"center",gap:8,minHeight:dismiss ? 44 : 0}}>
        <Icon name={icon} size={18} strokeWidth={2} color={fg}/>
        <span style={{...STRONG,flex:1,minWidth:0}}>{title}{meta ? <span style={{font:"var(--type-caption)",color:"var(--text-secondary)"}}> · {meta}</span> : null}</span>
        {dismiss ? <IconButton icon="x" label="Dismiss"/> : null}
      </div>
      <div style={{...SMALL,paddingRight:dismiss ? 12 : 0}}>{children}</div>
      {action}
    </section>
  );
}
/* The chat card's summary (8.3), which is the plan's change_summary, shown once on Home.
   The changed session gets an Updated tag in the list; old → new values stay in chat. */
function PlanUpdated(){
  return (
    <Note icon="check" title="Plan updated" meta="last night" action={<TextLink>See the chat</TextLink>}>
      All your sessions are at 7:00 now, and Friday is a little shorter.
    </Note>
  );
}

/* Alternatives to today's session, from the preferences draft: simpler, five minutes,
   move, or skip with nothing to make up. Anything else goes to chat. */
const NOT_TODAY = [
  {icon:"feather",title:"Make it simpler",detail:"A gentler version, still 24 min."},
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

/* Top to bottom: greeting, note, week, hero, extra card, steps, sessions, chat entry.
   The strip drives the hero; tap a day to see it. */
function HomeScreen({kicker, name, badge, note, days, today, initial = today, selectable = true, todayHero, after, steps, list, change = true}){
  const [sel, setSel] = React.useState(initial);
  const hero = sel === today && todayHero ? todayHero : <DayHero d={days[sel]} isToday={sel === today} next={nextSession(days, sel)}/>;
  return (
    <>
      <Content pb={120} gap={20}>
        <HomeHeader kicker={kicker} name={name} badge={badge}/>
        {note}
        <WeekStrip days={days} today={today} selected={sel} onSelect={selectable ? setSel : undefined}/>
        {hero}
        {after}
        {steps}
        {list}
        {change ? <ChangePlan note={typeof change === "string" ? change : null}/> : null}
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
        <HomeHeader kicker={kicker} name={name} chat={false}/>
        {children}
      </Content>
      <NavBar value="today"/>
    </>
  );
}

/* ---------- Screens ---------- */

/* 5 — Wednesday morning of week 1. Interactive: tap a day. */
const Today = ({initial}) => (
  <HomeScreen kicker="Wednesday, 8 October · Week 1" days={WED} today={2} initial={initial}
    steps={<StepCount count="3,240" at="9:38"/>}
    list={<WeekList days={WED} today={2} aside="1 of 3 done" summary={SUMMARY1}/>}/>
);
/* 5.1 — Another day selected: Friday's session to preview, with its "outside your preferred times" label. */
const FridaySelected = () => <Today initial={4}/>;
/* 5.2 — "Not today" on the hero opens alternatives instead of a guilt trip. */
const NotToday = () => <><Today/><NotTodaySheet/></>;
/* 5.3 — After completion and feedback (screen 7). */
const DoneToday = () => (
  <HomeScreen kicker="Wednesday, 8 October · Week 1" days={WED_DONE} today={2}
    steps={<StepCount count="5,906" at="9:38"/>}
    list={<WeekList days={WED_DONE} today={2} aside="2 of 3 done" summary={SUMMARY1}/>}/>
);
/* 5.4 — Thursday: a rest day, the morning after a chat revision. */
const Updated = () => (
  <HomeScreen kicker="Thursday, 9 October · Week 1" note={<PlanUpdated/>} days={THU} today={3}
    steps={<StepCount count="1,204" at="9:38"/>}
    list={<WeekList days={THU} today={3} aside="2 of 3 done" summary={SUMMARY1}/>}/>
);
/* 5.5 — Saturday: Friday passed with nothing logged. */
const CheckInDay = () => (
  <HomeScreen kicker="Saturday, 11 October · Week 1" days={SAT} today={5} after={<CheckIn d={SAT[4]}/>}
    steps={<StepCount count="860" at="9:38"/>}
    list={<WeekList days={SAT} today={5} aside="2 of 3 done" summary={SUMMARY1}/>}/>
);
/* 5.6 — Sunday: the week is done, Friday skipped without fuss; week 2 has one optional trial. */
const WeekDone = () => (
  <HomeScreen kicker="Sunday, 12 October · Week 1" days={SUN} today={6}
    todayHero={<HeroCard tone="warm" icon="sun" kicker="Week 1 · 2 sessions" title="First week, done." body="Two sessions, both at 7 in the morning. Rest today — week 2 starts tomorrow."/>}
    steps={<StepCount count="2,315" at="9:38"/>}
    list={<WeekList title="Next week" days={WEEK2} aside="13–19 Oct" summary={SUMMARY2}/>}/>
);
/* 5.7 — Right after onboarding's Build plan (4): the first plan is being generated. */
const Building = () => (
  <>
    <Content pb={120} gap={20}>
      <HomeHeader kicker="Monday, 6 October" chat={false}/>
      <WeekStrip days={WEEK1} today={0} loading/>
      <div role="status">
        <SuggestionCard tone="sage" kicker="Your first week" title="Building your week." body="Walk and run, three days a week, 20 minutes, mornings. This takes about a minute.">
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
  <PlainScreen kicker="Monday, 6 October">
    <HeroCard alert icon="calendar-x" kicker="Your first week" title="Plan didn't build." body="Something went wrong on our side. Your answers are saved, so trying again only takes a moment."
      actions={<><Button icon="rotate-ccw">Try again</Button><Button variant="ghost">Review answers</Button></>}/>
    <p style={{...CAPTION,margin:0}}>From your answers: {ANSWERS}.</p>
  </PlainScreen>
);
/* 5.9 — Monday of week 1: the first open after the plan is ready. */
const DayOne = () => (
  <HomeScreen kicker="Monday, 6 October · Week 1" days={WEEK1} today={0}
    note={<Note tone="warm" icon="sun" title="Your first week">{SUMMARY1}</Note>}
    steps={<StepCount/>}
    list={<WeekList days={WEEK1} today={0} aside="3 sessions"/>}/>
);
/* 5.10 — Partial week: fewer free slots than sessions asked for. */
const Lighter = () => (
  <HomeScreen kicker="Monday, 13 October · Week 2" days={LIGHTER} today={0}
    after={<Note tone="info" icon="calendar-range" title="A lighter week" dismiss={false}>Only two mornings are free this week, so there are two sessions. There's nothing to make up.</Note>}
    list={<WeekList days={LIGHTER} today={0} aside="2 sessions"/>}/>
);
/* 5.11 — Unscheduled week: the calendar couldn't be read, so nothing has a time. */
const NoTimes = () => (
  <HomeScreen kicker="Monday, 13 October · Week 2" days={OPEN2} today={0} selectable={false}
    todayHero={<HeroCard icon="calendar-x" kicker="Week 2 · 3 sessions" title="No times yet." body="We couldn't read your calendar, so this week's sessions don't have set times. Pick a day for each when you know your week."
      actions={<Button variant="secondary" icon="rotate-ccw">Try again</Button>}/>}
    list={<OpenList items={UNSCHEDULED}/>}/>
);
/* 5.12 — Empty week 3: nothing fits the current choices, and odd weeks bring no trial. A valid plan, not an error. */
const Quiet = () => (
  <HomeScreen kicker="Monday, 20 October · Week 3" days={OPEN3} today={0} selectable={false} change={false}
    todayHero={
      <HeroCard icon="calendar" kicker="Week 3" title="A quiet week." body="No session fits your current choices. You can change them whenever you're ready."
        actions={<><Button variant="secondary">Review choices</Button><Button variant="ghost">Open chat</Button></>}>
        <Row gap={8} style={{alignItems:"flex-start",marginTop:6,paddingTop:12,borderTop:HAIRLINE_ON_TINT}}>
          <Icon name="info" size={16} color="var(--info)" style={{marginTop:1}}/>
          <span style={{font:"var(--type-caption)",color:"var(--text-secondary)"}}>Walk and Run are both switched off in your choices.</span>
        </Row>
      </HeroCard>}/>
);
/* 5.13 — First load. Shapes match the loaded screen so nothing jumps. */
const Loading = () => (
  <>
    <Content pb={120} gap={20}>
      <span role="status" style={SR_ONLY}>Loading your plan</span>
      <Col gap={10} style={{paddingTop:2}}><Sk w={196} h={14}/><Sk w={258} h={32} r={10}/><Sk w={118} h={32} r={10}/></Col>
      <WeekStrip days={WED} today={2} loading/>
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
/* 5.14 — The plan can't be fetched. */
const Offline = () => (
  <PlainScreen kicker="Wednesday, 8 October" name={null}>
    <HeroCard alert icon="cloud-off" kicker="No connection" title="Plan won't load." body="Check your connection, then try again. Anything you've logged is safe."
      actions={<Button icon="rotate-ccw">Try again</Button>}/>
  </PlainScreen>
);
/* 5.15 — Guest demo: seeded week and history, isolated per visitor, limited chat changes. */
const Guest = () => (
  <HomeScreen kicker="Wednesday, 8 October · Week 1" name={null} badge={<Badge tone="info">Guest demo</Badge>} days={WED} today={2}
    note={<Note tone="info" icon="info" title="A sample week">Some history is filled in so you can look around. Changes only affect this demo.</Note>}
    list={<WeekList days={WED} today={2} aside="1 of 3 done" summary={SUMMARY1}/>}
    change="3 plan changes left in this demo."/>
);

window.HOME_SCREENS = [
  {id:"home",label:"5 · Home",C:Today,h:"auto"},
  {id:"home-friday",label:"5.1 · Friday selected",C:FridaySelected,h:"auto"},
  {id:"home-not-today",label:"5.2 · Not today",C:NotToday},
  {id:"home-done",label:"5.3 · Done for today",C:DoneToday,h:"auto"},
  {id:"home-updated",label:"5.4 · Rest day, plan updated",C:Updated,h:"auto"},
  {id:"home-check-in",label:"5.5 · Did it happen?",C:CheckInDay,h:"auto"},
  {id:"home-week-done",label:"5.6 · Week done",C:WeekDone,h:"auto"},
  {id:"home-building",label:"5.7 · Building the plan",C:Building},
  {id:"home-build-failed",label:"5.8 · Plan didn't build",C:BuildFailed},
  {id:"home-day-one",label:"5.9 · Day one",C:DayOne,h:"auto"},
  {id:"home-lighter",label:"5.10 · Lighter week",C:Lighter,h:"auto"},
  {id:"home-no-times",label:"5.11 · No set times",C:NoTimes,h:"auto"},
  {id:"home-quiet",label:"5.12 · Quiet week",C:Quiet},
  {id:"home-loading",label:"5.13 · Loading",C:Loading},
  {id:"home-offline",label:"5.14 · Can't load",C:Offline},
  {id:"home-guest",label:"5.15 · Guest demo",C:Guest,h:"auto"},
];
})();
