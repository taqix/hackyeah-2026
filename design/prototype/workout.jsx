/* In-workout tracking — screens 6.1–6.9 (see README › In-workout tracking).
   Every plan step is tracked one of three ways:
     reps      sets × reps, optional weight      Goblet squat 3 × 10 · 8 kg
     time      a duration, optionally in rounds  Knee plank 3 × 20 s, Brisk walk 5 min
     distance  time + distance, optional climb   Walk-run 24 min · 2.46 km, Swim 12 × 25 m
   Loaded before screens.jsx. The layout helpers used here (TopBar, Content, BottomBar,
   Col, Row, H1, Kicker, Body, Section) and the DS components that screens.jsx
   destructures resolve at render time. */
const { ExerciseMedia } = window.DS;

const TABULAR = {fontFamily:"var(--font-numeric)",fontVariantNumeric:"tabular-nums",letterSpacing:"var(--tracking-tight)"};
const KIND_ICON = {reps:"dumbbell",time:"timer",distance:"route"};
const H2 = ({children,style}) => <h2 style={{font:"700 var(--text-xl)/var(--leading-tight) var(--font-display)",letterSpacing:"var(--tracking-display)",margin:0,textWrap:"balance",...style}}>{children}</h2>;
const Caption = ({children,style}) => <span style={{font:"var(--type-caption)",color:"var(--text-tertiary)",textWrap:"pretty",...style}}>{children}</span>;

/* ---------- Tracking components (candidates for the design system) ---------- */

/* Session clock in the top bar. */
function Elapsed({time}){
  return (
    <span role="timer" aria-label={"Session time "+time} style={{display:"inline-flex",alignItems:"center",gap:8,height:32,padding:"0 12px",borderRadius:99,background:"var(--surface-sunken)",font:"600 15px/1 var(--font-numeric)",...TABULAR,color:"var(--text-primary)"}}>
      <span aria-hidden="true" style={{width:6,height:6,borderRadius:99,background:"var(--accent)"}}></span>{time}
    </span>
  );
}
/* Top bar for a guided session: plan sheet left, clock centre, end right. */
function SessionTop({time}){
  return <TopBar left={<IconButton icon="list-checks" label="Session plan"/>} title={<Elapsed time={time}/>} right={<IconButton icon="x" label="End session"/>}/>;
}

/* − value + . Value and unit stack so "10 reps" fits a half-width stepper.
   Tapping the number opens the numeric keypad in the app; `step` follows the equipment. */
function NumberStepper({label,value,unit,step=1,size="md",onChange}){
  const [own,setOwn]=React.useState(value);
  const v=onChange?value:own;
  const set=n=>{n=Math.max(0,Math.round(n*10)/10);onChange?onChange(n):setOwn(n);};
  const lg=size==="lg", b=lg?56:44;
  const btn=(icon,dir)=>(
    <button type="button" aria-label={(dir<0?"Decrease ":"Increase ")+label.toLowerCase()} onClick={()=>set(v+dir*step)}
      style={{width:b,height:b,flex:"none",border:0,borderRadius:99,background:"var(--surface-sunken)",color:"var(--text-primary)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0}}>
      <Icon name={icon} size={lg?24:20} strokeWidth={2}/>
    </button>
  );
  return (
    <div role="group" aria-label={label} style={{display:"flex",alignItems:"center",gap:4,height:lg?84:60,padding:lg?14:8,borderRadius:"var(--radius-control)",background:"var(--surface-card)",border:"1px solid var(--border-strong)",minWidth:0}}>
      {btn("minus",-1)}
      <span aria-live="polite" style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",alignItems:"center",gap:lg?4:3}}>
        <span style={{font:"600 "+(lg?40:22)+"px/1 var(--font-numeric)",...TABULAR}}>{v}</span>
        <span style={{font:"var(--type-caption)",color:"var(--text-tertiary)"}}>{unit}</span>
      </span>
      {btn("plus",1)}
    </div>
  );
}

/* Status disc shared by set rows and the session plan. */
function StepDisc({n,state}){
  const s={
    done:{background:"var(--accent)",color:"var(--text-on-accent)",border:"1.5px solid var(--accent)"},
    current:{background:"var(--surface-card)",color:"var(--accent-text)",border:"2px solid var(--accent)"},
    next:{background:"transparent",color:"var(--text-tertiary)",border:"1.5px solid var(--border-strong)"},
  }[state];
  return <span aria-hidden="true" style={{width:28,height:28,flex:"none",borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",font:"600 13px/1 var(--font-numeric)",...s}}>{state==="done"?<Icon name="check" size={15} strokeWidth={2.5}/>:n}</span>;
}

/* Rows that open something (edit a set, jump to an exercise) are buttons without button chrome. */
const ROW_BUTTON = {display:"flex",alignItems:"center",width:"100%",border:0,background:"transparent",color:"inherit",font:"inherit",textAlign:"left",cursor:"pointer"};

/* Done and upcoming sets. Tapping a row opens it like the current set, to fix a number. */
function SetLine({n,kg,reps,state}){
  const tone=state==="done"?"var(--text-secondary)":"var(--text-tertiary)";
  const num={font:"600 15px/1 var(--font-numeric)",...TABULAR,color:tone,textAlign:"right"};
  return (
    <button type="button" aria-label={"Set "+n+(state==="done"?", done, ":", planned, ")+reps+" reps"+(kg!=null?" at "+kg+" kg":"")} style={{...ROW_BUTTON,gap:12,height:52,padding:"0 12px",borderRadius:"var(--radius-md)"}}>
      <StepDisc n={n} state={state}/>
      <span style={{flex:1,font:"500 var(--text-base)/1 var(--font-body)",color:state==="done"?"var(--text-primary)":"var(--text-secondary)"}}>Set {n}</span>
      {kg!=null?<span style={{...num,width:56}}>{kg} kg</span>:null}
      <span style={{...num,width:64}}>{reps} reps</span>
    </button>
  );
}

/* The set being done: planned values pre-filled, so one tap on the bottom button logs it as planned. */
function CurrentSet({n,kg,reps,kgStep}){
  return (
    <div style={{background:"var(--accent-soft)",borderRadius:"var(--radius-md)",padding:12,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <StepDisc n={n} state="current"/>
        <span style={{flex:1,font:"600 var(--text-base)/1 var(--font-body)"}}>Set {n}</span>
        <span style={{font:"var(--type-caption)",color:"var(--accent-text)"}}>Now</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:kg!=null?"minmax(0,1fr) minmax(0,1fr)":"minmax(0,1fr)",gap:8}}>
        {kg!=null?<NumberStepper label="Weight" value={kg} unit="kg" step={kgStep}/>:null}
        <NumberStepper label="Reps" value={reps} unit="reps"/>
      </div>
    </div>
  );
}

function SetList({sets,current,kgStep=2}){
  return (
    <div style={{background:"var(--surface-card)",border:"1px solid var(--border-subtle)",borderRadius:"var(--radius-card)",boxShadow:"var(--shadow-card)",padding:6}}>
      {sets.map((s,i)=>i===current
        ?<CurrentSet key={i} n={i+1} kg={s.kg} reps={s.reps} kgStep={kgStep}/>
        :<SetLine key={i} n={i+1} kg={s.kg} reps={s.reps} state={i<current?"done":"next"}/>)}
      <button type="button" style={{display:"flex",alignItems:"center",gap:8,height:44,width:"100%",padding:"0 12px",border:0,borderTop:"1px solid var(--border-subtle)",background:"transparent",color:"var(--accent-text)",font:"var(--type-label)",cursor:"pointer"}}>
        <Icon name="plus" size={16} strokeWidth={2}/>Add a set
      </button>
    </div>
  );
}

/* Bottom sheet over the session. The scrim covers the status bar too. */
function Sheet({label,children}){
  return (
    <>
      <div aria-hidden="true" style={{position:"absolute",inset:0,background:"var(--overlay)"}}></div>
      <section role="dialog" aria-modal="true" aria-label={label} style={{position:"absolute",left:0,right:0,bottom:0,background:"var(--surface-raised)",borderRadius:"var(--radius-sheet) var(--radius-sheet) 0 0",boxShadow:"var(--shadow-sheet)",padding:"10px var(--gutter-screen) 34px",display:"flex",flexDirection:"column",gap:16}}>
        <span aria-hidden="true" style={{alignSelf:"center",width:36,height:5,borderRadius:99,background:"var(--border-strong)"}}></span>
        {children}
      </section>
    </>
  );
}

function MetricTile({label,value,unit}){
  return (
    <div style={{background:"var(--surface-sunken)",borderRadius:"var(--radius-md)",padding:"14px 16px",display:"flex",flexDirection:"column",gap:8}}>
      <span style={{font:"var(--type-caption)",color:"var(--text-tertiary)"}}>{label}</span>
      <span style={{display:"flex",alignItems:"baseline",gap:4}}>
        <span style={{font:"600 30px/1 var(--font-numeric)",...TABULAR}}>{value}</span>
        {unit?<span style={{font:"var(--type-label)",color:"var(--text-secondary)"}}>{unit}</span>:null}
      </span>
    </div>
  );
}

/* Rest and walking use the recovery colour; effort uses the accent. Text always names the segment too. */
const RUN_PLAN=[{k:"walk",min:5},...Array.from({length:6},()=>[{k:"run",min:1.5},{k:"walk",min:1}]).flat(),{k:"walk",min:5}];
function IntervalStrip({done,frac}){
  return (
    <Col gap={8}>
      <div aria-hidden="true" style={{display:"flex",gap:3}}>
        {RUN_PLAN.map((s,i)=>{
          const c=s.k==="run"?"var(--accent)":"var(--recovery)";
          const faint="color-mix(in oklch, "+c+" 26%, transparent)";
          const bg=i<done?c:i===done?"linear-gradient(to right, "+c+" "+frac*100+"%, "+faint+" "+frac*100+"%)":faint;
          return <span key={i} style={{flex:s.min,height:10,borderRadius:99,background:bg}}></span>;
        })}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",font:"var(--type-caption)",color:"var(--text-tertiary)"}}>
        <span>Warm-up</span><span>6 runs, walks between</span><span>Cool-down</span>
      </div>
    </Col>
  );
}

/* Route from GPS, drawn without map tiles. */
function RouteCard(){
  return (
    <figure style={{margin:0,position:"relative",height:148,borderRadius:"var(--radius-card)",background:"var(--surface-sunken)",overflow:"hidden"}}>
      <svg viewBox="0 0 350 148" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Your route, a loop that starts and ends in the same place">
        <g fill="none" stroke="var(--border-subtle)" strokeWidth="9" strokeLinecap="round">
          <path d="M-10 96 L360 68"></path>
          <path d="M116 -10 L144 160"></path>
          <path d="M266 -10 L240 160"></path>
          <path d="M-10 28 C90 40 170 16 360 24"></path>
        </g>
        <path d="M60 114 C52 86 64 60 98 52 S158 34 188 40 C216 46 240 30 266 32 C296 34 314 56 308 82 C302 106 272 116 242 112 C210 108 192 126 160 128 C126 130 102 120 78 124 C66 126 62 122 60 114 Z" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"></path>
        <circle cx="60" cy="114" r="7" fill="var(--surface-card)" stroke="var(--accent)" strokeWidth="3"></circle>
      </svg>
      <figcaption style={{position:"absolute",left:12,top:12,height:26,padding:"0 10px",display:"flex",alignItems:"center",gap:6,borderRadius:99,background:"var(--surface-card)",font:"var(--type-caption)",color:"var(--text-secondary)"}}>
        <Icon name="map-pin" size={12}/>Start and finish
      </figcaption>
    </figure>
  );
}

/* ---------- Screens ---------- */

/* 6.1 — Run, live: one continuous screen; the segment and its countdown read at arm's length. */
function RunLive(){
  return (
    <>
      <TopBar left={<IconButton icon="volume-2" label="Voice cues on"/>} title="Walk-run intervals" right={<IconButton icon="x" label="End session"/>}/>
      <Content gap={24} pb={140}>
        <section aria-label="Current interval" style={{background:"var(--accent-soft)",borderRadius:"var(--radius-xl)",padding:"26px 24px 28px",display:"flex",flexDirection:"column",gap:18}}>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between"}}>
            <span style={{font:"700 var(--text-2xl)/1 var(--font-display)",letterSpacing:"var(--tracking-display)",color:"var(--accent-text)"}}>Run</span>
            <span style={{font:"var(--type-label)",color:"var(--text-secondary)"}}>Interval 3 of 6</span>
          </div>
          <Col gap={8}>
            <span role="timer" style={{font:"700 136px/0.9 var(--font-numeric)",...TABULAR,letterSpacing:"-0.045em"}}>0:52</span>
            <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)"}}>left of this 90-second run</span>
          </Col>
          <div aria-hidden="true" style={{height:8,borderRadius:99,background:"var(--accent-soft-strong)"}}><div style={{width:"42%",height:"100%",borderRadius:99,background:"var(--accent)"}}></div></div>
          <Row gap={10}><Icon name="footprints" size={18} color="var(--recovery)"/><span style={{font:"var(--type-body)"}}>Then walk for 1 min</span></Row>
        </section>
        <IntervalStrip done={5} frac={0.42}/>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:8}}>
          <MetricTile label="Time" value="10:38"/>
          <MetricTile label="Distance" value="1.12" unit="km"/>
        </div>
        <Caption style={{textAlign:"center"}}>Voice cues say when to switch, so your phone can stay in your pocket.</Caption>
      </Content>
      <BottomBar><Button size="lg" fullWidth icon="pause">Pause</Button></BottomBar>
    </>
  );
}

/* 6.2 — Run, after: numbers come from the timer and GPS; every one stays editable. */
function RunReview(){
  return (
    <>
      <TopBar left={<span></span>} right={<IconButton icon="x" label="Close"/>}/>
      <Content gap={20}>
        <Col gap={6}><Kicker>Wednesday · walk-run intervals</Kicker><H1>All six runs done.</H1></Col>
        <RouteCard/>
        <Col gap={14}>
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:12}}>
            <Input label="Time" defaultValue="24" suffix="min" inputMode="numeric"/>
            <Input label="Distance" defaultValue="2.46" suffix="km" inputMode="decimal"/>
          </div>
          <Input label="Climb (optional)" defaultValue="12" suffix="m" inputMode="numeric" hint="Total uphill. Watches call it elevation gain."/>
        </Col>
        <Caption>Distance and climb come from your phone's GPS. Change anything that looks off.</Caption>
      </Content>
      <BottomBar><Button size="lg" fullWidth iconRight="arrow-right">Continue</Button></BottomBar>
    </>
  );
}

const SQUAT_SETS=[{kg:8,reps:10},{kg:8,reps:10},{kg:8,reps:10}];
function SetLogBody({current,time}){
  return (
    <>
      <SessionTop time={time}/>
      <Content gap={16} pb={140}>
        <ExerciseMedia shape="rect" ratio="16 / 9" label="Goblet squat demo"/>
        <Col gap={6}>
          <Kicker>Exercise 2 of 5 · 3 × 10 · 8 kg</Kicker>
          <H2>Goblet squat</H2>
          <Body style={{font:"var(--type-body-sm)"}}>Hold the weight at your chest. Sit back as if into a chair, then stand.</Body>
        </Col>
        <SetList sets={SQUAT_SETS} current={current}/>
      </Content>
    </>
  );
}

/* 6.3 — Strength: log a set. Change a number only if you did something different. */
function SetLog(){
  return (
    <>
      <SetLogBody current={1} time="08:12"/>
      <BottomBar><Button size="lg" fullWidth iconRight="check">Set 2 done</Button></BottomBar>
    </>
  );
}

/* 6.4 — Strength: rest starts by itself after a set. Recovery colour, gentle default. */
function SetRest(){
  return (
    <>
      <SetLogBody current={2} time="09:24"/>
      <Sheet label="Rest">
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"8px 8px 8px 12px",borderRadius:"var(--radius-md)",background:"var(--surface-sunken)"}}>
          <span style={{width:28,height:28,flex:"none",borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--success-soft)",color:"var(--success)"}}><Icon name="check" size={15} strokeWidth={2.5}/></span>
          <Col gap={2} style={{flex:1,minWidth:0}}>
            <span style={{font:"600 15px/1.3 var(--font-body)"}}>Set 2 saved</span>
            <span style={{font:"var(--type-caption)",color:"var(--text-secondary)",fontVariantNumeric:"tabular-nums"}}>10 reps · 8 kg</span>
          </Col>
          <Button variant="ghost" size="sm">Edit</Button>
        </div>
        <div style={{display:"flex",justifyContent:"center","--accent":"var(--recovery)"}}>
          <ProgressRing value={0.75} size={200} stroke={8}>
            <Col gap={6} style={{alignItems:"center"}}>
              <span style={{font:"var(--type-label)",color:"var(--text-secondary)"}}>Rest</span>
              <span role="timer" style={{font:"700 52px/1 var(--font-numeric)",...TABULAR}}>0:45</span>
            </Col>
          </ProgressRing>
        </div>
        <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)",textAlign:"center"}}>Next: set 3 · 10 reps · 8 kg</span>
        <Row gap={8}>
          <Button variant="secondary" size="lg">+15 s</Button>
          <Button size="lg" iconRight="arrow-right" style={{flex:1}}>Next set</Button>
        </Row>
      </Sheet>
    </>
  );
}

/* 6.5 — Time only: the demo loops inside the countdown ring. */
function Rounds({items}){
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat("+items.length+",minmax(0,1fr))",gap:8}}>
      {items.map((r,i)=>{
        const st={done:{background:"var(--surface-sunken)",color:"var(--text-secondary)",border:"1px solid transparent"},current:{background:"var(--accent-soft)",color:"var(--accent-text)",border:"1.5px solid var(--accent)"},next:{background:"transparent",color:"var(--text-tertiary)",border:"1px solid var(--border-strong)"}}[r.state];
        return (
          <span key={i} style={{height:44,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",gap:6,font:"600 14px/1 var(--font-body)",fontVariantNumeric:"tabular-nums",...st}}>
            {r.state==="done"?<Icon name="check" size={14} strokeWidth={2.5}/>:null}{r.label}
          </span>
        );
      })}
    </div>
  );
}
function TimedHold(){
  return (
    <>
      <SessionTop time="15:40"/>
      <Content gap={20} pb={140}>
        <Col gap={6}>
          <Kicker>Exercise 4 of 5 · 3 × 20 s</Kicker>
          <H2>Knee plank</H2>
          <Body style={{font:"var(--type-body-sm)"}}>Knees down, body in one line from knees to head. Keep breathing.</Body>
        </Col>
        <div style={{display:"flex",justifyContent:"center"}}>
          <ProgressRing value={0.6} size={236} stroke={8}>
            <ExerciseMedia size={204} alt="Knee plank demo"/>
          </ProgressRing>
        </div>
        <Col gap={6} style={{alignItems:"center"}}>
          <span role="timer" style={{font:"700 64px/1 var(--font-numeric)",...TABULAR}}>0:12</span>
          <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)"}}>left of 20 s · round 2 of 3</span>
        </Col>
        <Rounds items={[{state:"done",label:"20 s"},{state:"current",label:"Now"},{state:"next",label:"20 s"}]}/>
      </Content>
      <BottomBar>
        <Button variant="secondary" size="lg" icon="pause">Pause</Button>
        <Button size="lg" iconRight="check" style={{flex:1}}>Done</Button>
      </BottomBar>
    </>
  );
}

/* 6.6 — Session plan: where you are, and what to do next if a machine is taken. */
const SESSION=[
  {name:"Brisk walk",detail:"5 min",kind:"time",state:"done"},
  {name:"Goblet squat",detail:"Set 2 of 3 · 8 kg",kind:"reps",state:"current"},
  {name:"Seated row",detail:"3 × 10 · 20 kg",kind:"reps",state:"next"},
  {name:"Knee plank",detail:"3 × 20 s",kind:"time",state:"next"},
  {name:"Easy stretch",detail:"2 min",kind:"time",state:"next"},
];
function PlanStep({n,name,detail,kind,state}){
  const cur=state==="current";
  return (
    <button type="button" aria-current={cur?"step":undefined} style={{...ROW_BUTTON,gap:12,minHeight:60,padding:"8px 12px",borderRadius:"var(--radius-md)",background:cur?"var(--accent-soft)":"transparent"}}>
      <StepDisc n={n} state={state}/>
      <Col gap={2} style={{flex:1,minWidth:0}}>
        <span style={{font:"600 var(--text-base)/1.3 var(--font-body)",color:state==="done"?"var(--text-secondary)":"var(--text-primary)"}}>{name}</span>
        <span style={{display:"flex",alignItems:"center",gap:6,font:"var(--type-body-sm)",color:"var(--text-secondary)",fontVariantNumeric:"tabular-nums"}}><Icon name={KIND_ICON[kind]} size={14}/>{detail}</span>
      </Col>
      {cur?<Badge tone="accent">Now</Badge>:state==="next"?<Icon name="chevron-right" size={18} color="var(--text-tertiary)"/>:null}
    </button>
  );
}
function SessionPlan(){
  return (
    <>
      <SetLogBody current={1} time="08:12"/>
      <Sheet label="Today's plan">
        <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",padding:"0 4px"}}>
          <Section>Today's plan</Section>
          <span style={{font:"var(--type-label)",color:"var(--text-tertiary)",fontVariantNumeric:"tabular-nums"}}>8 of 20 min</span>
        </div>
        <Col gap={2}>{SESSION.map((s,i)=><PlanStep key={i} n={i+1} {...s}/>)}</Col>
        <Row gap={8} style={{padding:"0 4px",alignItems:"flex-start"}}>
          <Icon name="info" size={16} color="var(--text-tertiary)" style={{marginTop:1}}/>
          <Caption>Machine taken? Tap any exercise to do it now. The one you leave keeps its sets.</Caption>
        </Row>
      </Sheet>
    </>
  );
}

/* 6.7 — End early: what's done is saved and counts. No "missed" state. */
function EndEarly(){
  const saved=[{name:"Brisk walk",detail:"5 min"},{name:"Goblet squat",detail:"1 set · 10 reps · 8 kg"}];
  return (
    <>
      <SetLogBody current={1} time="08:12"/>
      <Sheet label="End session">
        <Col gap={8} style={{padding:"0 4px"}}>
          <span style={{font:"var(--type-heading)",letterSpacing:"var(--tracking-tight)"}}>End here?</span>
          <Body>You've moved for 8 min. Stopping early still counts — we'll save what you did.</Body>
        </Col>
        <div style={{borderRadius:"var(--radius-md)",background:"var(--surface-sunken)",padding:"4px 16px"}}>
          {saved.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,minHeight:48,borderTop:i?"1px solid var(--border-subtle)":"none"}}>
              <Icon name="check" size={16} strokeWidth={2.25} color="var(--success)"/>
              <span style={{flex:1,font:"500 15px/1.3 var(--font-body)"}}>{s.name}</span>
              <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)",fontVariantNumeric:"tabular-nums"}}>{s.detail}</span>
            </div>
          ))}
        </div>
        <Col gap={8}>
          <Button size="lg" fullWidth>End and save</Button>
          <Button size="lg" fullWidth variant="ghost">Keep going</Button>
        </Col>
      </Sheet>
    </>
  );
}

/* 6.8 — Strength, after: what was done, as logged. No plan-versus-actual comparison. */
const LOGGED=[
  {name:"Brisk walk",detail:"5 min",done:true},
  {name:"Goblet squat",detail:"3 × 10 · 8 kg",done:true},
  {name:"Seated row",detail:"10, 10, 8 reps · 20 kg",done:true},
  {name:"Knee plank",detail:"20 s, 20 s, 14 s",done:true},
  {name:"Easy stretch",detail:"Not today",done:false},
];
function StrengthReview(){
  return (
    <>
      <TopBar left={<span></span>} right={<IconButton icon="x" label="Close"/>}/>
      <Content gap={20}>
        <Col gap={6}>
          <Kicker>Wednesday · 19 min</Kicker>
          <H1>Done for today.</H1>
          <Body>Here's what you logged. Tap a line to fix it.</Body>
        </Col>
        <Card padding="4px 16px">
          {LOGGED.map((l,i)=>(
            <button key={i} type="button" style={{...ROW_BUTTON,gap:14,minHeight:68,padding:0,borderTop:i?"1px solid var(--border-subtle)":"none"}}>
              <ExerciseMedia size={44} alt={l.name} style={{opacity:l.done?1:.5}}/>
              <Col gap={2} style={{flex:1,minWidth:0}}>
                <span style={{font:"600 var(--text-base)/1.3 var(--font-body)",color:l.done?"var(--text-primary)":"var(--text-tertiary)"}}>{l.name}</span>
                <span style={{font:"var(--type-body-sm)",color:l.done?"var(--text-secondary)":"var(--text-tertiary)",fontVariantNumeric:"tabular-nums"}}>{l.detail}</span>
              </Col>
              {l.done?<Icon name="check" size={18} strokeWidth={2.25} color="var(--success)" title="Done"/>:null}
            </button>
          ))}
        </Card>
      </Content>
      <BottomBar><Button size="lg" fullWidth iconRight="arrow-right">Continue</Button></BottomBar>
    </>
  );
}

/* 6.9 — Swim, logged afterwards: the phone stays in the locker. Lengths × pool length = distance. */
const POOLS=[25,33,50];
function SwimLog(){
  const [lengths,setLengths]=React.useState(12);
  const [pool,setPool]=React.useState(25);
  return (
    <>
      <TopBar left={<IconButton icon="arrow-left" label="Back"/>} right={null}/>
      <Content gap={20}>
        <Col gap={6}>
          <Kicker>Wednesday · easy lengths · 20 min</Kicker>
          <H1>How many lengths?</H1>
          <Body>One length is one end of the pool to the other. A rough count is fine.</Body>
        </Col>
        <NumberStepper size="lg" label="Lengths" value={lengths} unit="lengths" onChange={setLengths}/>
        <Col gap={10}>
          <span style={{font:"var(--type-label)",color:"var(--text-secondary)"}}>Pool length</span>
          <Row gap={8} style={{flexWrap:"wrap"}}>
            {POOLS.map(p=><Tag key={p} selected={pool===p} onClick={()=>setPool(p)}>{p} m</Tag>)}
            <Tag>Other</Tag>
          </Row>
        </Col>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderRadius:"var(--radius-md)",background:"var(--surface-sunken)"}}>
          <span style={{font:"var(--type-label)",color:"var(--text-secondary)"}}>Distance</span>
          <span aria-live="polite" style={{font:"600 24px/1 var(--font-numeric)",...TABULAR}}>{lengths*pool} m</span>
        </div>
        <Input label="Time in the water" defaultValue="20" suffix="min" inputMode="numeric" hint="Rests at the wall count too."/>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 10px 10px 12px",borderRadius:"var(--radius-md)",border:"1px solid var(--border-subtle)"}}>
          <span style={{width:36,height:36,flex:"none",borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--info-soft)",color:"var(--info)"}}><Icon name="watch" size={18}/></span>
          <Col gap={2} style={{flex:1,minWidth:0}}>
            <span style={{font:"600 15px/1.3 var(--font-body)"}}>Swim on your watch</span>
            <span style={{font:"var(--type-caption)",color:"var(--text-secondary)",fontVariantNumeric:"tabular-nums"}}>7:04 · 22 min · 325 m</span>
          </Col>
          <Button variant="secondary" size="sm">Use</Button>
        </div>
      </Content>
      <BottomBar><Button size="lg" fullWidth iconRight="check">Save</Button></BottomBar>
    </>
  );
}

const WORKOUT_SCREENS=[
  {id:"run-live",label:"6.1 · Run: live intervals",C:RunLive},
  {id:"run-review",label:"6.2 · Run: check the numbers",C:RunReview},
  {id:"set-log",label:"6.3 · Strength: log a set",C:SetLog},
  {id:"set-rest",label:"6.4 · Strength: rest",C:SetRest},
  {id:"timed",label:"6.5 · Strength: timed hold",C:TimedHold},
  {id:"session-plan",label:"6.6 · Strength: session plan",C:SessionPlan},
  {id:"end-early",label:"6.7 · Strength: end early",C:EndEarly},
  {id:"strength-review",label:"6.8 · Strength: what you did",C:StrengthReview},
  {id:"swim-log",label:"6.9 · Swim: log afterwards",C:SwimLog},
];
