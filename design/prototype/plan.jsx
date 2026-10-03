/* Plan — the Plan tab: screens 10 and 10.1 (see README › Plan).
   One question: what is my plan, and how did it get here? Home answers "what today";
   this tab shows every session of the week with the plan's own description (the
   contract's event `description`, or a gym `series`), and the versions behind it.
   docs/product.md: every accepted generation or chat revision is a new version; done
   sessions keep the version they belong to. Data follows home.jsx on Thursday 8 October,
   the morning after the chat change (8.3, Home 5.4).
   Loaded before screens.jsx and wrapped in a function so its names stay local.
   Layout helpers (TopBar, Content, NavBar, Col, Row, H1, Kicker, Body, Section) resolve
   at render time. Registers window.PLAN_SCREENS. */
(() => {
const { Icon, IconButton, Badge, Card } = window.DS;

const SMALL = {margin:0,font:"var(--type-body-sm)",color:"var(--text-secondary)",textWrap:"pretty"};
const CAPTION = {font:"var(--type-caption)",color:"var(--text-tertiary)"};
const ROW_BTN = {display:"flex",width:"100%",padding:0,border:0,background:"transparent",color:"inherit",font:"inherit",textAlign:"left",cursor:"pointer"};

/* Week 1, version 2 (home.jsx THU). */
const WEEK = [
  {short:"Mon",date:"5 Oct",title:"Brisk walk",time:"7:00",min:20,state:"done",felt:"easy",
    text:"A brisk walk outdoors, at a pace where you can still talk."},
  {short:"Wed",date:"7 Oct",title:"Walk-run intervals",time:"7:00",min:20,state:"done",felt:"just right",
    text:"Six one-minute runs with easy walks between. Slow enough to talk."},
  {short:"Fri",date:"9 Oct",title:"Walk-run intervals",time:"7:00",min:10,state:"planned",updated:true,
    text:"Three one-minute runs with easy walks between, in the morning as you asked."},
];

function PlanSession({d, divider}){
  const done = d.state === "done";
  return (
    <button type="button" style={{...ROW_BTN,gap:14,padding:"14px 0",borderTop:divider ? "1px solid var(--border-subtle)" : "none"}}>
      <span style={{width:44,flex:"none",display:"flex",flexDirection:"column",gap:3,paddingTop:1}}>
        <span style={{font:"600 15px/1 var(--font-body)"}}>{d.short}</span>
        <span style={CAPTION}>{d.date}</span>
      </span>
      <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:6}}>
        <span style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <span style={{font:"600 var(--text-base)/1.3 var(--font-body)",color:done ? "var(--text-secondary)" : "var(--text-primary)"}}>{d.title}</span>
          {d.updated ? <Badge tone="accent">Updated</Badge> : null}
        </span>
        <span style={{...CAPTION,color:"var(--text-secondary)",fontVariantNumeric:"tabular-nums"}}>{done ? d.min + " min · felt " + d.felt : d.time + " · " + d.min + " min"}</span>
        {done ? null : <p style={SMALL}>{d.text}</p>}
      </span>
      <span style={{flex:"none",display:"flex",alignItems:"center",alignSelf:"center"}}>
        {done ? <Badge tone="success" dot>Done</Badge> : <Icon name="chevron-right" size={18} color="var(--text-tertiary)"/>}
      </span>
    </button>
  );
}

/* 10 — Plan: this week in full, then what happens next. */
function Plan(){
  return (
    <>
      <Content pb={120} gap={20}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
          <Col gap={4} style={{minWidth:0}}>
            <Kicker>Version 2 · since Wednesday evening</Kicker>
            <H1>Your plan</H1>
          </Col>
          <IconButton icon="history" label="Plan history" variant="secondary"/>
        </div>
        <Card padding="6px 18px 4px">
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:12,padding:"12px 0 2px"}}>
            <Section>This week</Section>
            <span style={{...CAPTION,fontVariantNumeric:"tabular-nums"}}>5–11 Oct · 2 of 3 done</span>
          </div>
          {WEEK.map((d, i) => <PlanSession key={d.short} d={d} divider={i > 0}/>)}
        </Card>
        <Card variant="sunken" padding={18}>
          <Row gap={12} style={{alignItems:"flex-start"}}>
            <Icon name="calendar-range" size={18} color="var(--text-secondary)" style={{marginTop:2}}/>
            <Col gap={4} style={{flex:1,minWidth:0}}>
              <span style={{font:"600 var(--text-base)/1.3 var(--font-body)"}}>Next week, 12–18 Oct</span>
              <p style={SMALL}>Planned on Sunday from your answers and your free time that week.</p>
            </Col>
          </Row>
        </Card>
        <Row gap={10} style={{alignItems:"flex-start"}}>
          <Icon name="lock" size={16} color="var(--text-secondary)" style={{marginTop:2}}/>
          <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)",textWrap:"pretty"}}>Done sessions stay as you did them. To change what's coming, ask in chat.</span>
        </Row>
      </Content>
      <NavBar value="plan"/>
    </>
  );
}

/* 10.1 — Plan history: every accepted plan is a version; the newest is the one in use. */
const VERSIONS = [
  {n:2,active:true,when:"Wed 7 Oct, 20:14",source:"From chat",icon:"message-circle",
    text:"All your sessions are at 7:00 now, and Friday is 10 minutes.",action:"See the chat"},
  {n:1,when:"Mon 5 Oct, 6:52",source:"First plan",icon:"sprout",
    text:"Built from your answers: walk and run, three days a week, 20 minutes, mornings.",
    kept:"Monday and Wednesday were done in this version."},
];
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

window.PLAN_SCREENS = [
  {id:"plan",label:"10 · Plan",C:Plan,note:"Thursday morning, after the chat change (8.3). Upcoming sessions show the plan's own description."},
  {id:"plan-history",label:"10.1 · Plan history",C:PlanHistory,note:"Every accepted plan is a version. Undo in chat (8.4) adds a new one."},
];
})();
