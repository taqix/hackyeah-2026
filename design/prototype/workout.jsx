/* Workouts — screens 6.1–6.10 (see README › Workouts and logging).
   3 October review (docs/mobile-review-2026-10-03.md): only gym sessions are tracked live,
   set by set. Every other sport is done the person's own way and logged afterwards, with one
   form for all of them: its fields are the sport's metrics from the database catalog
   (codex/gemini-plan-contract › Sport catalog), so a new sport needs a catalog row, not a
   screen. A .fit or .gpx file from a watch app can fill the form instead. No GPS, maps,
   calories or exercise videos.
   Gym steps are tracked one of two ways:
     reps   sets × reps from the plan; weight typed by the person, pre-filled from last time
     time   a hold in rounds                    Knee plank 3 × 20 s, Brisk walk 5 min
   The plan gives sets and reps; it never sets a weight (the contract's gym exercises have
   sets and repetitions only).
   Loaded before screens.jsx. The layout helpers used here (TopBar, Content, BottomBar,
   Col, Row, H1, Kicker, Body, Section) and the DS components that screens.jsx
   destructures resolve at render time. */

const TABULAR = {fontFamily:"var(--font-numeric)",fontVariantNumeric:"tabular-nums",letterSpacing:"var(--tracking-tight)"};
const KIND_ICON = {reps:"dumbbell",time:"timer",distance:"route"};
const H2 = ({children,style}) => <h2 style={{font:"700 var(--text-xl)/var(--leading-tight) var(--font-display)",letterSpacing:"var(--tracking-display)",margin:0,textWrap:"balance",...style}}>{children}</h2>;
const Caption = ({children,style}) => <span style={{font:"var(--type-caption)",color:"var(--text-tertiary)",textWrap:"pretty",...style}}>{children}</span>;

/* ---------- Log afterwards: one form for every sport but the gym ---------- */

/* A few catalog rows in the contract's shape. Each non-gym sport lists up to five metrics:
   key, description (the field label), required, value_schema and unit. The metric that
   represents the session is stored in seconds and typed in minutes. The real list lives
   in the database; these are samples for the frames. */
const DURATION = (label = "Time") => ({key:"duration",description:label,required:true,unit:"min",represents_session_duration:true,value_schema:{type:"integer",minimum:1}});
const CATALOG = {
  running:{name:"Running",metrics:[DURATION(),{key:"distance",description:"Distance",required:false,unit:"km",value_schema:{type:"number",minimum:0}}]},
  swimming:{name:"Swimming",metrics:[DURATION("Time in the water"),{key:"distance",description:"Distance",required:false,unit:"m",value_schema:{type:"integer",minimum:0}}]},
  football:{name:"Football",metrics:[DURATION()]},
};

/* One metric as a field. Numbers get the keypad (decimal when the schema allows fractions);
   a boolean is yes/no and a string enum is chips, so any catalog row can be drawn. */
function MetricField({m, value}){
  const s = m.value_schema, label = m.description + (m.required ? "" : " (optional)");
  if (s.type === "boolean") return <Col gap={8}><span style={{font:"var(--type-label)",color:"var(--text-secondary)"}}>{label}</span><Segmented label={label} value={value} onChange={()=>{}} options={[{value:true,label:"Yes"},{value:false,label:"No"}]}/></Col>;
  if (s.type === "string" && s.enum) return <Col gap={8}><span style={{font:"var(--type-label)",color:"var(--text-secondary)"}}>{label}</span><Row gap={8} style={{flexWrap:"wrap"}}>{s.enum.map(v => <Tag key={v} selected={value === v}>{v}</Tag>)}</Row></Col>;
  return <Input label={label} defaultValue={value} placeholder={m.required ? undefined : "–"} suffix={m.unit} inputMode={s.type === "integer" ? "numeric" : "decimal"}/>;
}

/* Import a workout file instead of typing (docs/features/activity-file-import.md on
   develop): the system file picker, one .fit or .gpx file, parsed on the phone. The file's
   numbers fill the form; the person still saves. The same row on every form, swims too.
   Shared on window. */
function FileImport({title = "Did it with a watch?", detail = "Import its .fit or .gpx file."}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 10px 10px 12px",borderRadius:"var(--radius-md)",border:"1px solid var(--border-subtle)"}}>
      <span style={{width:36,height:36,flex:"none",borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--info-soft)",color:"var(--info)"}}><Icon name="file-up" size={18}/></span>
      <Col gap={2} style={{flex:1,minWidth:0}}>
        <span style={{font:"600 15px/1.3 var(--font-body)"}}>{title}</span>
        <span style={{font:"var(--type-caption)",color:"var(--text-secondary)"}}>{detail}</span>
      </Col>
      <Button variant="secondary" size="sm" style={{height:44}}>Choose file</Button>
    </div>
  );
}
function FileImported({name}){
  return (
    <div role="status" style={{display:"flex",alignItems:"center",gap:12,padding:"10px 10px 10px 12px",borderRadius:"var(--radius-md)",background:"var(--success-soft)"}}>
      <span style={{width:36,height:36,flex:"none",borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--surface-card)",color:"var(--success)"}}><Icon name="check" size={18} strokeWidth={2.25}/></span>
      <Col gap={2} style={{flex:1,minWidth:0}}>
        <span style={{font:"600 15px/1.3 var(--font-body)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
        <span style={{font:"var(--type-caption)",color:"var(--text-secondary)"}}>Read on your phone</span>
      </Col>
      <Button variant="ghost" size="sm" style={{height:44}}>Remove</Button>
    </div>
  );
}

/* The form: the file row where a map used to be, then one field per metric. The session
   length is pre-filled from the plan, so a session done as planned is one tap; nothing
   else is made up. Continue goes to Completion & feedback (7). */
function LogIt({sport, kicker, values = {}, file, hint}){
  const s = CATALOG[sport];
  const needed = s.metrics.filter(m => m.required).map(m => m.description.toLowerCase());
  return (
    <>
      <TopBar left={<IconButton icon="arrow-left" label="Back"/>}/>
      <Content gap={20}>
        <Col gap={6}><Kicker>{kicker}</Kicker><H1>How did it go?</H1></Col>
        {file ? <FileImported name={file}/> : <FileImport/>}
        <div role="group" aria-label={s.name} style={{display:"grid",gridTemplateColumns:s.metrics.length > 1 ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)",gap:12}}>
          {s.metrics.map(m => <MetricField key={m.key} m={m} value={values[m.key]}/>)}
        </div>
        <Caption>{file ? "Filled from your file. Change anything that looks off." : hint || "Only the " + needed.join(" and ") + " is needed. A rough number is fine."}</Caption>
      </Content>
      <BottomBar><Button size="lg" fullWidth iconRight="arrow-right">Continue</Button></BottomBar>
    </>
  );
}
/* 6.1 — Ana's walk-run, typed: 20 min from the plan, distance left empty. */
const LogWalkRun = () => <LogIt sport="running" kicker="Wednesday · walk-run intervals" values={{duration:20}}/>;
/* 6.2 — The same form filled from a watch file. */
const LogFromFile = () => <LogIt sport="running" kicker="Wednesday · walk-run intervals" file="Morning_Run.fit" values={{duration:21,distance:"2.14"}}/>;
/* 6.9 — A swim: the same form with swimming's metrics. */
const LogSwim = () => <LogIt sport="swimming" kicker="Saturday · easy lengths · 20 min" values={{duration:20}} hint="Only the time is needed. Rests at the wall count too."/>;
/* 6.10 — Football: one metric, one field. */
const LogFootball = () => <LogIt sport="football" kicker="Thursday · football with friends · 45 min" values={{duration:45}}/>;

/* ---------- Gym: tracked live, set by set ---------- */

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

/* The set being done: reps from the plan, weight from the person's last time (or the set
   before), so one tap on the bottom button logs it. With no history the weight starts empty. */
function CurrentSet({n,kg,reps,kgStep,last}){
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
      {last?<span style={{display:"flex",alignItems:"center",gap:6,font:"var(--type-caption)",color:"var(--text-secondary)",fontVariantNumeric:"tabular-nums"}}><Icon name="history" size={14}/>{last}</span>:null}
    </div>
  );
}

function SetList({sets,current,kgStep=2,last}){
  return (
    <div style={{background:"var(--surface-card)",border:"1px solid var(--border-subtle)",borderRadius:"var(--radius-card)",boxShadow:"var(--shadow-card)",padding:6}}>
      {sets.map((s,i)=>i===current
        ?<CurrentSet key={i} n={i+1} kg={s.kg} reps={s.reps} kgStep={kgStep} last={last}/>
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
      <div aria-hidden="true" style={{position:"absolute",inset:0,background:"var(--overlay)",zIndex:5}}></div>
      <section role="dialog" aria-modal="true" aria-label={label} style={{position:"absolute",left:0,right:0,bottom:0,zIndex:6,background:"var(--surface-raised)",borderRadius:"var(--radius-sheet) var(--radius-sheet) 0 0",boxShadow:"var(--shadow-sheet)",padding:"10px var(--gutter-screen) 34px",display:"flex",flexDirection:"column",gap:16}}>
        <span aria-hidden="true" style={{alignSelf:"center",width:36,height:5,borderRadius:99,background:"var(--border-strong)"}}></span>
        {children}
      </section>
    </>
  );
}

/* Goblet squat, 3 × 10 in the plan. Ana did it at 8 kg on Monday 12 October, so 8 kg is
   pre-filled; set 1 is done, set 2 is current. */
const SQUAT_SETS=[{kg:8,reps:10},{kg:8,reps:10},{kg:8,reps:10}];
const SQUAT_LAST="Last time, Mon 12 Oct: 3 × 10 · 8 kg";
function SetLogBody({current,time}){
  return (
    <>
      <SessionTop time={time}/>
      <Content gap={16} pb={140}>
        <Col gap={6}>
          <Kicker>Exercise 2 of 5 · 3 × 10</Kicker>
          <H2>Goblet squat</H2>
          <Body style={{font:"var(--type-body-sm)"}}>Hold the weight at your chest. Sit back as if into a chair, then stand.</Body>
        </Col>
        <SetList sets={SQUAT_SETS} current={current} last={SQUAT_LAST}/>
      </Content>
    </>
  );
}

/* 6.3 — Gym: log a set. Change a number only if you did something different. */
function SetLog(){
  return (
    <>
      <SetLogBody current={1} time="08:12"/>
      <BottomBar><Button size="lg" fullWidth iconRight="check">Set 2 done</Button></BottomBar>
    </>
  );
}

/* 6.4 — Gym: rest starts by itself after a set. Recovery colour, gentle default. */
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

/* 6.5 — Time only: the countdown fills the ring. */
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
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0"}}>
          <ProgressRing value={0.6} size={236} stroke={8}>
            <Col gap={8} style={{alignItems:"center"}}>
              <span role="timer" style={{font:"700 64px/1 var(--font-numeric)",...TABULAR}}>0:12</span>
              <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)"}}>left of 20 s</span>
            </Col>
          </ProgressRing>
        </div>
        <Col gap={10}>
          <span style={{font:"var(--type-label)",color:"var(--text-secondary)",textAlign:"center"}}>Round 2 of 3</span>
          <Rounds items={[{state:"done",label:"20 s"},{state:"current",label:"Now"},{state:"next",label:"20 s"}]}/>
        </Col>
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
  {name:"Wall push-up",detail:"2 × 8",kind:"reps",state:"next"},
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

/* 6.8 — Gym, after: what was done, as logged. No plan-versus-actual comparison. */
const LOGGED=[
  {name:"Brisk walk",detail:"5 min",kind:"time",done:true},
  {name:"Goblet squat",detail:"3 × 10 · 8 kg",kind:"reps",done:true},
  {name:"Wall push-up",detail:"8, 6 reps",kind:"reps",done:true},
  {name:"Knee plank",detail:"20 s, 20 s, 14 s",kind:"time",done:true},
  {name:"Easy stretch",detail:"Not today",kind:"time",done:false},
];
function StrengthReview(){
  return (
    <>
      <TopBar left={<span></span>} right={<IconButton icon="x" label="Close"/>}/>
      <Content gap={20}>
        <Col gap={6}>
          <Kicker>Thursday · 19 min</Kicker>
          <H1>Done for today.</H1>
          <Body>Here's what you logged. Tap a line to fix it.</Body>
        </Col>
        <Card padding="4px 16px">
          {LOGGED.map((l,i)=>(
            <button key={i} type="button" style={{...ROW_BUTTON,gap:14,minHeight:64,padding:0,borderTop:i?"1px solid var(--border-subtle)":"none"}}>
              <span aria-hidden="true" style={{width:36,height:36,flex:"none",borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--surface-sunken)",color:l.done?"var(--text-secondary)":"var(--text-tertiary)"}}><Icon name={KIND_ICON[l.kind]} size={18}/></span>
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

const WORKOUT_SCREENS=[
  {id:"log-it",label:"6.1 · Log it: walk-run",C:LogWalkRun,note:"Every sport but the gym is logged afterwards, on this one form. Its fields are the sport's metrics from the catalog; the length comes from the plan."},
  {id:"log-it-file",label:"6.2 · Log it: from a .fit file",C:LogFromFile,note:"Choose file opens the system picker. A .fit or .gpx file fills the fields; the person still checks and continues."},
  {id:"set-log",label:"6.3 · Gym: log a set",C:SetLog,note:"6.3–6.8 show another sample plan: a 20-minute gym session with dumbbells. Reps come from the plan; the weight from last time."},
  {id:"set-rest",label:"6.4 · Gym: rest",C:SetRest},
  {id:"timed",label:"6.5 · Gym: timed hold",C:TimedHold},
  {id:"session-plan",label:"6.6 · Gym: session plan",C:SessionPlan},
  {id:"end-early",label:"6.7 · Gym: end early",C:EndEarly},
  {id:"strength-review",label:"6.8 · Gym: what you did",C:StrengthReview},
  {id:"swim-log",label:"6.9 · Log it: swim",C:LogSwim,note:"The same form with swimming's metrics: time in the water and distance in metres."},
  {id:"log-it-football",label:"6.10 · Log it: football",C:LogFootball,note:"A catalog sport with one metric gets one field. No screen of its own."},
];
Object.assign(window,{FileImport,FileImported,MetricField,CATALOG});
