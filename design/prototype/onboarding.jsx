/* Onboarding questionnaire and preferences — screens 2–4 (see README › Onboarding preferences).
   Fields, option values and labels follow docs/plan-creation/PREFERENCES.md on
   feat/llm-plan-creation. The app saves only the values; labels are copy. Each question
   uses the doc's wording; screen headings group them into five steps and a review.
   The screens are clickable and apply the doc's rules:
     - No activity picked: discovery is "explore" and the other two options are disabled.
     - At least one place; Continue stays disabled without one.
     - The swimming check shows when Swim is picked, or a pool is picked and discovery
       is not "selected_only". Only "Yes" (true) lets a plan include swimming.
     - "No equipment" and "Nothing to avoid" save [] and clear the other chips.
       No preferred time saves []. No obstacle saves null. Both "Good to know"
       questions are optional.
   Not asked: timezone (from the device) and excluded_activity_types (starts as []).
   Loaded before screens.jsx. Layout helpers (TopBar, Content, BottomBar, Steps, Col, Row,
   H1, Body, Section, Kicker) and DS components resolve at render time. */
(() => {

const PREF_OPTIONS={
  starting_comfort:[
    {value:"starting_out",label:"Starting from scratch",description:"Little or no exercise lately"},
    {value:"occasionally_active",label:"Occasionally active",description:"Some movement now and then"},
    {value:"some_routine",label:"Already have some routine",description:"Moving most weeks"},
  ],
  sessions_per_week:[1,2,3],
  session_minutes:[5,10,20],
  preferred_times:[
    {value:"morning",label:"Morning",range:"7:00–11:00",icon:"sunrise"},
    {value:"lunch",label:"Lunchtime",range:"11:00–14:00",icon:"sun"},
    {value:"evening",label:"Evening",range:"17:00–21:00",icon:"moon"},
  ],
  activity_interests:[
    {value:"walking",label:"Walk",icon:"footprints"},
    {value:"strength",label:"Strength (home or gym)",icon:"dumbbell"},
    {value:"running",label:"Run",icon:"wind"},
    {value:"cycling",label:"Bike",icon:"bike"},
    {value:"swimming",label:"Swim",icon:"waves"},
    {value:"mobility",label:"Mobility / stretching",icon:"person-standing"},
  ],
  discovery_preference:[
    {value:"selected_only",label:"Stick to my choices"},
    {value:"occasional",label:"Occasionally try something new"},
    {value:"explore",label:"Help me explore"},
  ],
  available_locations:[
    {value:"home",label:"Home",icon:"house"},
    {value:"outdoors",label:"Outdoors",icon:"tree-pine"},
    {value:"gym",label:"Gym",icon:"building-2"},
    {value:"pool",label:"Swimming pool",icon:"waves"},
  ],
  available_equipment:[
    {value:"mat",label:"Mat"},
    {value:"resistance_band",label:"Resistance band"},
    {value:"dumbbells",label:"Dumbbells"},
    {value:"bicycle",label:"Bicycle"},
    {value:"stationary_bike",label:"Stationary bike"},
  ],
  avoidances:[
    {value:"jumping",label:"Jumping"},
    {value:"floor_exercises",label:"Floor exercises"},
    {value:"noisy_activities",label:"Noisy activities"},
  ],
  starting_obstacle:[
    {value:"time",label:"Finding time"},
    {value:"low_energy",label:"Low energy"},
    {value:"boredom",label:"Boredom"},
    {value:"uncertainty",label:"Not knowing what to do"},
    {value:"discomfort",label:"Feeling uncomfortable"},
  ],
};

/* The example user from docs/plan-creation/examples/initial.input.json. */
const SAMPLE_PREFS={
  timezone:"Europe/Warsaw",
  starting_comfort:"starting_out",
  sessions_per_week:2,
  session_minutes:10,
  activity_interests:["walking","strength"],
  available_locations:["outdoors","gym"],
  available_equipment:[],
  preferred_times:["lunch","evening"],
  discovery_preference:"selected_only",
  avoidances:["jumping"],
  starting_obstacle:"time",
  excluded_activity_types:[],
  comfortable_swimming:null,
};

const STEPS=5;

function usePrefs(initial){
  const [p,setP]=React.useState(()=>({...SAMPLE_PREFS,...initial}));
  const set=(k,v)=>setP(s=>({...s,[k]:v}));
  const toggle=(k,v)=>setP(s=>{const a=s[k]||[];return {...s,[k]:a.includes(v)?a.filter(x=>x!==v):[...a,v]};});
  return [p,set,toggle];
}
/* No activity picked means "explore", whatever was chosen before. */
const discoveryOf=p=>p.activity_interests.length?p.discovery_preference:"explore";
const lower=s=>s.charAt(0).toLowerCase()+s.slice(1);
const labelOf=(field,value)=>PREF_OPTIONS[field].find(o=>o.value===value).label;
/* Joined labels in sentence case: "Outdoors, gym". */
const listOf=(field,values,allLower)=>values.map((v,i)=>i||allLower?lower(labelOf(field,v)):labelOf(field,v)).join(", ");

/* ---------- Choice pieces (candidates for the design system) ----------
   Exported on window; the profile edit screens (profile.jsx) reuse them. */

/* A question from the doc, word for word, as a section heading. */
function Question({children,optional,hint}){
  return (
    <Col gap={4}>
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:12}}>
        <Section>{children}</Section>
        {optional?<span style={{font:"var(--type-caption)",color:"var(--text-tertiary)",flex:"none"}}>Optional</span>:null}
      </div>
      {hint?<span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)",textWrap:"pretty"}}>{hint}</span>:null}
    </Col>
  );
}

/* Multiple choice: DS Tags in a wrapping row. */
function Chips({label,children}){
  return <div role="group" aria-label={label} style={{display:"flex",flexWrap:"wrap",gap:8}}>{children}</div>;
}

/* Single choice between a few short options (numbers, yes/no). Equal widths;
   the selected option uses the Radio card's checked style. */
function Segmented({label,options,value,onChange}){
  return (
    <div role="radiogroup" aria-label={label} style={{display:"grid",gridTemplateColumns:"repeat("+options.length+",minmax(0,1fr))",gap:8}}>
      {options.map(o=>{const on=o.value===value;return (
        <button key={String(o.value)} type="button" role="radio" aria-checked={on} onClick={()=>onChange(o.value)}
          style={{height:o.unit?68:48,padding:0,border:0,borderRadius:"var(--radius-md)",background:on?"var(--accent-soft)":"var(--surface-card)",boxShadow:on?"inset 0 0 0 1.5px var(--accent)":"inset 0 0 0 1px var(--border-strong)",color:"var(--text-primary)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:5,cursor:"pointer",transition:"background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)"}}>
          <span style={{font:o.unit?"600 24px/1 var(--font-numeric)":"600 var(--text-base)/1 var(--font-body)",fontVariantNumeric:"tabular-nums",letterSpacing:o.unit?"var(--tracking-tight)":undefined}}>{o.label}</span>
          {o.unit?<span style={{font:"var(--type-caption)",color:on?"var(--accent-text)":"var(--text-tertiary)"}}>{o.unit}</span>:null}
        </button>);})}
    </div>
  );
}

/* Multiple choice with a second line, e.g. a time range. Checked style matches Radio cards. */
function CheckTile({icon,label,detail,checked,onClick}){
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onClick}
      style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3,minWidth:0,padding:"14px 12px 12px",border:0,borderRadius:"var(--radius-md)",background:checked?"var(--accent-soft)":"var(--surface-card)",boxShadow:checked?"inset 0 0 0 1.5px var(--accent)":"inset 0 0 0 1px var(--border-strong)",color:"var(--text-primary)",textAlign:"left",cursor:"pointer",transition:"background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)"}}>
      <Icon name={icon} size={20} color={checked?"var(--accent-text)":"var(--text-secondary)"} style={{marginBottom:8}}/>
      <span style={{font:"600 15px/1.2 var(--font-body)"}}>{label}</span>
      <span style={{font:"var(--type-caption)",color:"var(--text-tertiary)",fontVariantNumeric:"tabular-nums"}}>{detail}</span>
      <span aria-hidden="true" style={{position:"absolute",top:10,right:10,width:20,height:20,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:checked?"var(--accent)":"transparent",border:checked?"none":"1.5px solid var(--border-strong)",color:"var(--text-on-accent)",boxSizing:"border-box"}}>
        {checked?<Icon name="check" size={13} strokeWidth={2.5}/>:null}
      </span>
    </button>
  );
}

/* Follow-up shown only when swimming could be planned. */
function SwimCheck({value,onChange,hint="We only plan swims if you are."}){
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14,padding:16,borderRadius:"var(--radius-md)",background:"var(--surface-sunken)"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
        <Icon name="waves" size={20} color="var(--accent-text)" style={{marginTop:1}}/>
        <Col gap={2}>
          <span style={{font:"600 var(--text-base)/1.3 var(--font-body)"}}>Are you comfortable swimming?</span>
          <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)"}}>{hint}</span>
        </Col>
      </div>
      <Segmented label="Comfortable swimming" value={value} onChange={onChange} options={[{value:true,label:"Yes"},{value:false,label:"Not yet"}]}/>
    </div>
  );
}

function StepTop({step,right}){
  return <TopBar left={<IconButton icon="arrow-left" label="Back"/>} right={right||<Kicker>{step} of {STEPS}</Kicker>}/>;
}
function Next({disabled}){
  return <BottomBar><Button size="lg" fullWidth iconRight="arrow-right" disabled={disabled}>Continue</Button></BottomBar>;
}

/* ---------- Screens ---------- */

/* 2 — Starting point: starting_comfort */
function Starting({initial}){
  const [p,set]=usePrefs(initial);
  return (
    <>
      <StepTop step={1}/>
      <Content>
        <Steps step={1} total={STEPS}/>
        <Col gap={8}>
          <H1>How does starting feel?</H1>
          <Body>No wrong answers. This sets how gentle your first week is.</Body>
        </Col>
        <div role="radiogroup" aria-label="How does starting feel?" style={{display:"flex",flexDirection:"column",gap:8}}>
          {PREF_OPTIONS.starting_comfort.map(o=><Radio key={o.value} variant="card" checked={p.starting_comfort===o.value} label={o.label} description={o.description} onChange={()=>set("starting_comfort",o.value)}/>)}
        </div>
      </Content>
      <Next disabled={!p.starting_comfort}/>
    </>
  );
}

/* 3.1 — Time: sessions_per_week, session_minutes, preferred_times (optional) */
function Time({initial}){
  const [p,set,toggle]=usePrefs(initial);
  return (
    <>
      <StepTop step={2}/>
      <Content>
        <Steps step={2} total={STEPS}/>
        <Col gap={8}>
          <H1>Start small</H1>
          <Body>Pick what feels easy. You can change it later.</Body>
        </Col>
        <Col gap={12}>
          <Question>How often would you like to make room for movement?</Question>
          <Segmented label="Sessions a week" value={p.sessions_per_week} onChange={v=>set("sessions_per_week",v)}
            options={PREF_OPTIONS.sessions_per_week.map(n=>({value:n,label:String(n),unit:n===1?"day a week":"days a week"}))}/>
        </Col>
        <Col gap={12}>
          <Question>What feels manageable for one session?</Question>
          <Segmented label="Minutes a session" value={p.session_minutes} onChange={v=>set("session_minutes",v)}
            options={PREF_OPTIONS.session_minutes.map(n=>({value:n,label:String(n),unit:"min"}))}/>
        </Col>
        <Col gap={12}>
          <Question optional>When would you prefer to move?</Question>
          <div role="group" aria-label="When would you prefer to move?" style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}>
            {PREF_OPTIONS.preferred_times.map(o=><CheckTile key={o.value} icon={o.icon} label={o.label} detail={o.range} checked={p.preferred_times.includes(o.value)} onClick={()=>toggle("preferred_times",o.value)}/>)}
          </div>
        </Col>
      </Content>
      <Next/>
    </>
  );
}

/* 3.2 — Activities: activity_interests, discovery_preference */
function Activities({initial}){
  const [p,set,toggle]=usePrefs(initial);
  const none=!p.activity_interests.length;
  const discovery=discoveryOf(p);
  return (
    <>
      <StepTop step={3}/>
      <Content>
        <Steps step={3} total={STEPS}/>
        <Col gap={8}>
          <H1>What would you like to try?</H1>
          <Body>Pick any that sound good — or none, and we'll help you explore.</Body>
        </Col>
        <Chips label="What would you like to try?">
          {PREF_OPTIONS.activity_interests.map(o=><Tag key={o.value} icon={o.icon} selected={p.activity_interests.includes(o.value)} onClick={()=>toggle("activity_interests",o.value)}>{o.label}</Tag>)}
        </Chips>
        <Col gap={12}>
          <Question>Would you like occasional new suggestions?</Question>
          <div role="radiogroup" aria-label="Would you like occasional new suggestions?" style={{display:"flex",flexDirection:"column",gap:8}}>
            {PREF_OPTIONS.discovery_preference.map(o=><Radio key={o.value} variant="card" checked={discovery===o.value} disabled={none&&o.value!=="explore"} label={o.label} onChange={()=>set("discovery_preference",o.value)}/>)}
          </div>
          {none?<span style={{font:"var(--type-caption)",color:"var(--text-tertiary)"}}>Pick an activity to choose the other options.</span>:null}
        </Col>
      </Content>
      <Next/>
    </>
  );
}

/* 3.3 — Places: available_locations (at least one), available_equipment, comfortable_swimming (conditional) */
function Places({initial}){
  const [p,set,toggle]=usePrefs(initial);
  const askSwim=p.activity_interests.includes("swimming")||(p.available_locations.includes("pool")&&discoveryOf(p)!=="selected_only");
  return (
    <>
      <StepTop step={4}/>
      <Content>
        <Steps step={4} total={STEPS}/>
        <Col gap={8}>
          <H1>Where could you move?</H1>
          <Body>Pick at least one.</Body>
        </Col>
        <Chips label="Where could you move?">
          {PREF_OPTIONS.available_locations.map(o=><Tag key={o.value} icon={o.icon} selected={p.available_locations.includes(o.value)} onClick={()=>toggle("available_locations",o.value)}>{o.label}</Tag>)}
        </Chips>
        {askSwim?<SwimCheck value={p.comfortable_swimming} onChange={v=>set("comfortable_swimming",v)}/>:null}
        <Col gap={12}>
          <Question hint="We only plan with what you pick, even at a gym.">What do you have available?</Question>
          <Chips label="What do you have available?">
            {PREF_OPTIONS.available_equipment.map(o=><Tag key={o.value} selected={p.available_equipment.includes(o.value)} onClick={()=>toggle("available_equipment",o.value)}>{o.label}</Tag>)}
            <Tag selected={!p.available_equipment.length} onClick={()=>set("available_equipment",[])}>No equipment</Tag>
          </Chips>
        </Col>
      </Content>
      <Next disabled={!p.available_locations.length}/>
    </>
  );
}

/* 3.4 — Good to know (optional): avoidances, starting_obstacle */
function Extras({initial}){
  const [p,set]=usePrefs(initial);
  const avoid=p.avoidances||[];
  const nothing=Array.isArray(p.avoidances)&&!p.avoidances.length; // null until answered
  const toggleAvoid=v=>set("avoidances",avoid.includes(v)?avoid.filter(x=>x!==v):[...avoid,v]);
  return (
    <>
      <StepTop step={5} right={<Button variant="ghost" size="sm" style={{marginRight:-8}}>Skip</Button>}/>
      <Content>
        <Steps step={5} total={STEPS}/>
        <Col gap={8}>
          <H1>Good to know</H1>
          <Body>Both questions are optional.</Body>
        </Col>
        <Col gap={12}>
          <Question>Is there anything you would rather avoid?</Question>
          <Chips label="Is there anything you would rather avoid?">
            {PREF_OPTIONS.avoidances.map(o=><Tag key={o.value} selected={avoid.includes(o.value)} onClick={()=>toggleAvoid(o.value)}>{o.label}</Tag>)}
            <Tag selected={nothing} onClick={()=>set("avoidances",nothing?null:[])}>Nothing to avoid</Tag>
          </Chips>
        </Col>
        <Col gap={4}>
          <Question>What usually makes starting difficult?</Question>
          <div role="radiogroup" aria-label="What usually makes starting difficult?">
            {PREF_OPTIONS.starting_obstacle.map(o=><Radio key={o.value} checked={p.starting_obstacle===o.value} label={o.label} onChange={()=>set("starting_obstacle",p.starting_obstacle===o.value?null:o.value)}/>)}
          </div>
        </Col>
      </Content>
      <Next/>
    </>
  );
}

/* 4 — Review: every answer once, grouped like the steps. A row opens its step.
   Build plan sends the values with the device timezone. */
function ReviewRow({icon,label,value,detail,divider}){
  return (
    <button type="button" style={{display:"flex",alignItems:"center",gap:14,width:"100%",padding:"12px 0",border:0,borderTop:divider?"1px solid var(--border-subtle)":"none",background:"transparent",color:"var(--text-primary)",textAlign:"left",cursor:"pointer"}}>
      <span style={{width:40,height:40,borderRadius:99,background:"var(--accent-soft)",color:"var(--accent-text)",display:"flex",alignItems:"center",justifyContent:"center",flex:"none"}}><Icon name={icon} size={18}/></span>
      <Col gap={2} style={{flex:1,minWidth:0}}>
        <span style={{font:"var(--type-caption)",color:"var(--text-tertiary)"}}>{label}</span>
        <span style={{font:"600 var(--text-base)/1.3 var(--font-body)"}}>{value}</span>
        {detail?<span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)"}}>{detail}</span>:null}
      </Col>
      <Icon name="chevron-right" size={18} color="var(--text-tertiary)"/>
    </button>
  );
}
function Review({initial}){
  const [p]=usePrefs(initial);
  const n=p.sessions_per_week, avoid=p.avoidances||[];
  const swim=p.comfortable_swimming===true?"comfortable swimming":p.comfortable_swimming===false?"not swimming yet":null;
  const rows=[
    {icon:"sprout",label:"Starting point",value:labelOf("starting_comfort",p.starting_comfort)},
    {icon:"calendar-clock",label:"Time",value:n+(n===1?" day":" days")+" a week · "+p.session_minutes+" min",
      detail:p.preferred_times.length?listOf("preferred_times",p.preferred_times):"Any time"},
    {icon:"footprints",label:"Activities",value:p.activity_interests.length?listOf("activity_interests",p.activity_interests):"Not sure yet",
      detail:labelOf("discovery_preference",discoveryOf(p))},
    {icon:"map-pin",label:"Places",value:listOf("available_locations",p.available_locations),
      detail:[p.available_equipment.length?listOf("available_equipment",p.available_equipment):"No equipment",swim].filter(Boolean).join(", ")},
    {icon:"feather",label:"Good to know",value:avoid.length?"Avoid "+listOf("avoidances",avoid,true):"Nothing to avoid",
      detail:p.starting_obstacle?"Hardest part: "+lower(labelOf("starting_obstacle",p.starting_obstacle)):null},
  ];
  return (
    <>
      <TopBar left={<IconButton icon="arrow-left" label="Back"/>}/>
      <Content gap={20}>
        <Col gap={8}>
          <H1>Looks right?</H1>
          <Body>We'll build your first week from this. Tap anything to change it.</Body>
        </Col>
        <Col gap={0}>{rows.map((r,i)=><ReviewRow key={r.label} {...r} divider={i>0}/>)}</Col>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Icon name="globe" size={16} color="var(--text-tertiary)"/>
          <span style={{font:"var(--type-caption)",color:"var(--text-tertiary)"}}>Times use your phone's time zone, {p.timezone}.</span>
        </div>
      </Content>
      <BottomBar><Button size="lg" fullWidth iconRight="arrow-right">Build plan</Button></BottomBar>
    </>
  );
}

const ONBOARDING_SCREENS=[
  {id:"starting",label:"2 · Starting point",C:Starting},
  {id:"time",label:"3.1 · Time",C:Time},
  {id:"activities",label:"3.2 · Activities",C:Activities},
  {id:"activities-none",label:"3.2 · Activities: none picked",C:()=><Activities initial={{activity_interests:[],discovery_preference:"explore"}}/>},
  {id:"places",label:"3.3 · Places",C:Places},
  {id:"places-swim",label:"3.3 · Places: swimming check",C:()=><Places initial={{activity_interests:["walking","swimming"],available_locations:["outdoors","pool"]}}/>},
  {id:"extras",label:"3.4 · Good to know (optional)",C:Extras},
  {id:"review",label:"4 · Review",C:Review},
];

Object.assign(window,{ONBOARDING_SCREENS,PREF_OPTIONS,SAMPLE_PREFS,Question,Chips,Segmented,CheckTile,SwimCheck});
})();
