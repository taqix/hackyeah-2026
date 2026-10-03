/* Calendar — the Calendar tab: screens 10 and 10.1 (see README › Calendar).
   One question: when are my sessions, and when were they? It replaced the Plan tab in the
   3 October review (docs/mobile-review-2026-10-03.md):
     - A month of sessions only. The phone's calendar is read for busy times, but private
       events and what's in them never show here.
     - History is kept in full, so the month pages back to the first session. Plans go one
       week ahead, so nothing shows, and the month can't page, past the last planned day.
     - Chat changes land here like everywhere else; the plan's versions are a section below.
   docs/product.md: every accepted generation or chat revision is a new version; done
   sessions keep the version they belong to. Data follows Ana on Wednesday 21 October,
   week 3, as on the You tab (profile.jsx).
   Loaded before screens.jsx and wrapped in a function so its names stay local.
   Layout helpers (TopBar, Content, NavBar, Col, Row, H1, Kicker, Body, Section) resolve
   at render time. Registers window.CALENDAR_SCREENS. */
(() => {
const { Icon, IconButton, Badge } = window.DS;

const SMALL = {margin:0,font:"var(--type-body-sm)",color:"var(--text-secondary)",textWrap:"pretty"};
const CAPTION = {font:"var(--type-caption)",color:"var(--text-tertiary)"};
const ROW_BTN = {display:"flex",width:"100%",padding:0,border:0,background:"transparent",color:"inherit",font:"inherit",textAlign:"left",cursor:"pointer"};

/* ---------- Data: Ana's October ---------- */

/* Every session by date. state: done · skipped · planned. `extra` is a workout added in chat
   (8.16): history, not part of the plan. Week 3 is planned up to Sunday 25. */
const SESSIONS = {
  5:[{title:"Brisk walk",time:"7:00",min:20,state:"done",felt:"easy"}],
  7:[{title:"Walk-run intervals",time:"7:00",min:20,state:"done",felt:"just right"}],
  8:[{title:"Football",time:"19:30",min:60,state:"done",extra:true}],
  9:[{title:"Walk-run intervals",time:"7:00",min:10,state:"skipped"}],
  12:[{title:"Walk-run intervals",time:"7:00",min:20,state:"done",felt:"just right"}],
  15:[{title:"Gentle stretching",time:"7:00",min:20,state:"done",felt:"easy",optional:true}],
  17:[{title:"Easy walk",time:"7:00",min:20,state:"done",felt:"easy"}],
  19:[{title:"Walk-run intervals",time:"7:00",min:20,state:"done",felt:"just right"}],
  20:[{title:"Hill walk",time:"7:00",min:20,state:"done",felt:"hard"}],
  23:[{title:"Walk-run intervals",time:"7:00",min:20,state:"planned"}],
};
const TODAY = 21, PLANNED_TO = 25, FIRST = 5;
/* October 2026 starts on a Thursday; weeks start on Monday. */
const LEAD = 3, DAYS_IN = 31;
const WEEKDAY = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const weekdayOf = d => WEEKDAY[(LEAD + d - 1) % 7];

/* ---------- Pieces ---------- */

/* One mark per session under the date: done is filled, planned is the accent, skipped is a
   hollow ring. The day's full label says the same in words. */
const MARK = {
  done:{background:"var(--success)"},
  planned:{background:"var(--accent)"},
  skipped:{background:"transparent",boxShadow:"inset 0 0 0 1.5px var(--text-tertiary)"},
};
function dayLabel(d){
  const s = SESSIONS[d] || [];
  const what = s.length ? s.map(x => x.title + ", " + (x.state === "planned" ? "at " + x.time : x.state)).join("; ") : d > PLANNED_TO ? "not planned yet" : "no sessions";
  return weekdayOf(d) + " " + d + " October" + (d === TODAY ? ", today" : "") + ", " + what;
}
function Month({sel, onSelect}){
  const cells = [...Array.from({length:LEAD}, (_, i) => ({out:28 + i})), ...Array.from({length:DAYS_IN}, (_, i) => ({d:i + 1}))];
  while (cells.length % 7) cells.push({out:cells.length - LEAD - DAYS_IN + 1});
  return (
    <div>
      <div aria-hidden="true" style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",marginBottom:4}}>
        {WEEKDAY.map(w => <span key={w} style={{...CAPTION,textAlign:"center",fontWeight:500}}>{w[0]}</span>)}
      </div>
      <div role="grid" aria-label="October 2026" style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",rowGap:2}}>
        {cells.map((c, i) => {
          if (c.out) return <span key={i} aria-hidden="true" style={{height:52,display:"flex",justifyContent:"center",paddingTop:6,font:"500 15px/1 var(--font-numeric)",color:"var(--text-tertiary)",opacity:.45}}>{c.out}</span>;
          const d = c.d, s = SESSIONS[d] || [], today = d === TODAY, ahead = d > PLANNED_TO, picked = d === sel && !today;
          return (
            <button key={i} type="button" role="gridcell" aria-selected={d === sel} aria-current={today ? "date" : undefined} aria-label={dayLabel(d)}
              onClick={ahead ? undefined : () => onSelect(d)} disabled={ahead}
              style={{height:52,display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"2px 0 0",border:0,background:"transparent",color:"inherit",cursor:ahead ? "default" : "pointer"}}>
              <span style={{width:34,height:34,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",font:"600 15px/1 var(--font-numeric)",fontVariantNumeric:"tabular-nums",
                background:today ? "var(--surface-inverse)" : "transparent",color:today ? "var(--text-inverse)" : ahead ? "var(--text-tertiary)" : "var(--text-primary)",
                boxShadow:picked ? "inset 0 0 0 2px var(--text-primary)" : "none",opacity:ahead ? .55 : 1}}>{d}</span>
              <span aria-hidden="true" style={{display:"flex",gap:3,height:6}}>{s.map((x, k) => <span key={k} style={{width:6,height:6,borderRadius:99,...MARK[x.state]}}></span>)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
function Legend(){
  const item = (state, label) => <span style={{display:"inline-flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:99,...MARK[state]}}></span>{label}</span>;
  return <div aria-hidden="true" style={{display:"flex",flexWrap:"wrap",gap:"6px 16px",font:"var(--type-caption)",color:"var(--text-secondary)"}}>{item("done","Done")}{item("planned","Planned")}{item("skipped","Skipped")}</div>;
}

/* What the selected day holds. Upcoming sessions open the activity (6); a free day points to
   the next session. */
function SessionLine({s, divider}){
  const meta = s.state === "planned" ? s.time + " · " + s.min + " min" : s.min + " min" + (s.felt ? " · felt " + s.felt : "");
  const end = s.state === "done" ? <Badge tone="success" dot>Done</Badge> : s.state === "skipped" ? <Badge>Skipped</Badge> : <Icon name="chevron-right" size={18} color="var(--text-tertiary)"/>;
  return (
    <button type="button" style={{...ROW_BTN,alignItems:"center",gap:14,minHeight:60,padding:"8px 0",borderTop:divider ? "1px solid var(--border-subtle)" : "none"}}>
      <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
        <span style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <span style={{font:"600 var(--text-base)/1.3 var(--font-body)",color:s.state === "planned" ? "var(--text-primary)" : "var(--text-secondary)"}}>{s.title}</span>
          {s.extra ? <Badge>Extra</Badge> : null}
          {s.optional ? <Badge>Optional</Badge> : null}
        </span>
        <span style={{...CAPTION,color:"var(--text-secondary)",fontVariantNumeric:"tabular-nums"}}>{meta}</span>
      </span>
      {end}
    </button>
  );
}
function Agenda({d}){
  const s = SESSIONS[d] || [];
  const next = Object.keys(SESSIONS).map(Number).find(k => k > d && SESSIONS[k].some(x => x.state === "planned"));
  return (
    <Col gap={4} style={{padding:"14px 18px 8px",borderRadius:"var(--radius-card)",background:"var(--surface-card)",border:"1px solid var(--border-subtle)",boxShadow:"var(--shadow-card)"}}>
      <span style={{font:"var(--type-subheading)"}}>{weekdayOf(d)} {d} October{d === TODAY ? <span style={{font:"var(--type-caption)",color:"var(--text-secondary)"}}> · today</span> : null}</span>
      {s.length ? s.map((x, i) => <SessionLine key={i} s={x} divider={i > 0}/>) : (
        <Col gap={8} style={{padding:"6px 0 8px"}}>
          <p style={SMALL}>{d < FIRST ? "Before your first week." : "Nothing planned. Rest is part of the plan, too."}</p>
          {next ? <span style={{font:"var(--type-body-sm)",color:"var(--text-primary)"}}>Next · {weekdayOf(next).slice(0, 3)} {next} · {SESSIONS[next][0].time} · {SESSIONS[next][0].title}</span> : null}
        </Col>
      )}
    </Col>
  );
}

/* One version of the plan: where it came from, when, and its summary. */
function Version({v, last}){
  return (
    <div style={{display:"flex",gap:14}}>
      <div style={{width:32,flex:"none",display:"flex",flexDirection:"column",alignItems:"center"}}>
        <span aria-hidden="true" style={{width:32,height:32,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:v.active ? "var(--accent-soft-strong)" : "var(--surface-sunken)",color:v.active ? "var(--accent-text)" : "var(--text-secondary)"}}><Icon name={v.icon} size={16}/></span>
        {last ? null : <span aria-hidden="true" style={{flex:1,width:2,marginTop:6,borderRadius:99,background:"var(--border-subtle)"}}></span>}
      </div>
      <Col gap={6} style={{flex:1,minWidth:0,paddingBottom:last ? 0 : 24}}>
        <span style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <span style={{font:"var(--type-subheading)"}}>Version {v.n}</span>
          {v.active ? <Badge tone="accent">In use</Badge> : null}
        </span>
        <span style={{...CAPTION,color:"var(--text-secondary)",fontVariantNumeric:"tabular-nums"}}>{v.source} · {v.when}</span>
        <p style={{...SMALL,color:"var(--text-primary)"}}>{v.text}</p>
        {v.kept ? <span style={{display:"flex",alignItems:"center",gap:6,font:"var(--type-body-sm)",color:"var(--text-secondary)"}}><Icon name="check" size={14} color="var(--success-text)"/>{v.kept}</span> : null}
        {v.action ? (
          <button type="button" style={{alignSelf:"flex-start",display:"inline-flex",alignItems:"center",gap:6,height:44,margin:"-6px 0 -12px",padding:0,border:0,background:"transparent",color:"var(--accent-text)",font:"600 var(--text-sm)/1 var(--font-body)",cursor:"pointer"}}>{v.action}<Icon name="arrow-right" size={16}/></button>
        ) : null}
      </Col>
    </div>
  );
}
/* Every accepted plan is a version, newest first: each week's plan and each chat change. */
const VERSIONS = [
  {n:4,active:true,when:"Sun 18 Oct, 19:02",source:"Weekly plan",icon:"calendar-range",
    text:"Week 3, 19–25 Oct: walk-runs on Monday and Friday, and a hill walk to try.",
    kept:"Monday and Tuesday were done in this version."},
  {n:3,when:"Sun 11 Oct, 19:05",source:"Weekly plan",icon:"calendar-range",
    text:"Week 2, 12–18 Oct: a walk-run, an easy walk, and one optional stretch to try.",
    kept:"All three were done in this version."},
  {n:2,when:"Wed 7 Oct, 20:14",source:"From chat",icon:"message-circle",
    text:"All your sessions are at 7:00 now, and Friday is 10 minutes.",action:"See the chat"},
  {n:1,when:"Mon 5 Oct, 6:52",source:"First plan",icon:"sprout",
    text:"Built from your answers: walk and run, three days a week, 20 minutes, between 7:00 and 11:00.",
    kept:"Monday and Wednesday were done in this version."},
];

/* ---------- Screens ---------- */

/* 10 — Calendar on Wednesday 21 October. Interactive: tap a day. The month can't page back
   (Ana started on 5 October) or forward (planned up to Sunday 25). */
function Calendar(){
  const [sel, setSel] = React.useState(TODAY);
  return (
    <>
      <Content pb={120} gap={20}>
        <Col gap={4} style={{minWidth:0}}>
          <Kicker>Wednesday, 21 October · Week 3</Kicker>
          <H1>Calendar</H1>
        </Col>
        <Col gap={10}>
          <div style={{display:"flex",alignItems:"center",gap:2,margin:"0 -6px 0 0"}}>
            <span style={{flex:1,font:"var(--type-section)",letterSpacing:"var(--tracking-tight)"}}>October 2026</span>
            <IconButton icon="chevron-left" size="sm" label="No earlier sessions" disabled/>
            <IconButton icon="chevron-right" size="sm" label="Planned up to Sunday 25 October" disabled/>
          </div>
          <Month sel={sel} onSelect={setSel}/>
          <Legend/>
        </Col>
        <Agenda d={sel}/>
        <Row gap={10} style={{alignItems:"flex-start"}}>
          <Icon name="eye-off" size={16} color="var(--text-secondary)" style={{marginTop:2}}/>
          <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)",textWrap:"pretty"}}>Only your sessions show here. We read when you're busy, never what's in your calendar. Plans go one week ahead.</span>
        </Row>
        <Col gap={14} style={{marginTop:8}}>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:12}}>
            <Section>Plan history</Section>
            <span style={{...CAPTION,fontVariantNumeric:"tabular-nums"}}>{VERSIONS.length} versions</span>
          </div>
          <Version v={{...VERSIONS[0], action:"See every version"}} last/>
        </Col>
      </Content>
      <NavBar value="calendar"/>
    </>
  );
}

/* 10.1 — Plan history: every accepted plan is a version; the newest is the one in use. */
function PlanHistory(){
  return (
    <>
      <TopBar left={<IconButton icon="arrow-left" label="Back"/>} title="Plan history"/>
      <Content gap={24} pb={34}>
        <Body>Every change is saved as a new version. Done sessions keep the version they were done in.</Body>
        <div role="list" aria-label="Plan versions">
          {VERSIONS.map((v, i) => <div role="listitem" key={v.n}><Version v={v} last={i === VERSIONS.length - 1}/></div>)}
        </div>
      </Content>
    </>
  );
}

window.CALENDAR_SCREENS = [
  {id:"calendar",label:"10 · Calendar",C:Calendar,h:"auto",note:"Sessions only, never private events. Back to the first session; nothing past the planned week. Tap a day."},
  {id:"plan-history",label:"10.1 · Plan history",C:PlanHistory,h:"auto",note:"Every accepted plan is a version: each week's plan and each chat change. Undo in chat (8.4) adds one too."},
];
})();
