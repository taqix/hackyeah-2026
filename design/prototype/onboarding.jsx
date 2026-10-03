/* Onboarding questionnaire and preferences — screens 2–4 (see README › Onboarding preferences).
   Fields, option values and labels follow docs/plan-creation/PREFERENCES.md on
   feat/llm-plan-creation, with the changes agreed in the 3 October review
   (docs/mobile-review-2026-10-03.md). The app saves only the values; labels are copy.
   Each question uses the doc's wording; screen headings group them into five steps and a review.
   The screens are clickable and apply these rules:
     - Sports come from the database catalog (codex/gemini-plan-contract: sports with ids
       and metrics). Six are suggested as chips; any other is one search away.
     - No sport picked: discovery is "explore" and the other two options are disabled.
     - At least one place; Continue stays disabled without one.
     - The preferred time of day is one window on a two-handle slider. The whole range
       means any time and saves null.
     - "No equipment" saves [] and clears the other chips.
     - Both "Good to know" questions are plain checkbox lists: nothing checked saves [].
   Removed in the review: the swimming comfort question, the bike-without-a-bicycle note,
   "Nothing to avoid" and the single-choice obstacle.
   Not asked: timezone (from the device) and excluded_activity_types (starts as []).
   Review also connects the calendar: the plan needs free time slots (LLM_SCHEMA.md
   available_slots), and calendar access must come from an explicit tap
   (docs/features/device-calendar.md on develop).
   Loaded before screens.jsx. Layout helpers (TopBar, Content, BottomBar, Steps, Col, Row,
   H1, Body, Section, Kicker) and DS components resolve at render time. */
(() => {

/* activity_interests: a sample of the sport catalog. The database owns the real list;
   `suggested` ones show as chips, the rest are found with search. */
const PREF_OPTIONS={
  starting_comfort:[
    {value:"starting_out",label:"Starting from scratch",description:"Little or no exercise lately"},
    {value:"occasionally_active",label:"Occasionally active",description:"Some movement now and then"},
    {value:"some_routine",label:"Already have some routine",description:"Moving most weeks"},
  ],
  activity_interests:[
    {value:"walking",label:"Walk",icon:"footprints",suggested:true},
    {value:"strength",label:"Strength (home or gym)",icon:"dumbbell",suggested:true},
    {value:"running",label:"Run",icon:"wind",suggested:true},
    {value:"cycling",label:"Bike",icon:"bike",suggested:true},
    {value:"swimming",label:"Swim",icon:"waves",suggested:true},
    {value:"mobility",label:"Mobility / stretching",icon:"person-standing",suggested:true},
    {value:"football",label:"Football"},
    {value:"tennis",label:"Tennis"},
    {value:"table_tennis",label:"Table tennis"},
    {value:"badminton",label:"Badminton"},
    {value:"padel",label:"Padel"},
    {value:"basketball",label:"Basketball"},
    {value:"volleyball",label:"Volleyball"},
    {value:"yoga",label:"Yoga"},
    {value:"pilates",label:"Pilates"},
    {value:"dancing",label:"Dancing"},
    {value:"hiking",label:"Hiking"},
    {value:"nordic_walking",label:"Nordic walking"},
    {value:"rowing",label:"Rowing"},
    {value:"climbing",label:"Climbing"},
    {value:"ice_skating",label:"Ice skating"},
    {value:"boxing",label:"Boxing"},
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
  starting_obstacles:[
    {value:"time",label:"Finding time"},
    {value:"low_energy",label:"Low energy"},
    {value:"boredom",label:"Boredom"},
    {value:"uncertainty",label:"Not knowing what to do"},
    {value:"discomfort",label:"Feeling uncomfortable"},
  ],
};

/* Sliders for 3.1 and Edit time (profile.jsx 9.4), matching the website: 1–7 sessions,
   5–60 min in 5s. PREFERENCES.md still lists 1, 2, 3 and 5, 10, 20 (chat keeps those)
   and is due to widen to these. Minutes number the tens and the 5-minute minimum.
   preferred_window replaces the morning, lunch and evening tiles: whole hours between
   7:00 and 21:00, the window the planner already uses, at least one hour wide. */
const hourText=h=>h+":00";
const PREF_SLIDERS={
  sessions_per_week:{label:"Sessions a week",icon:"calendar-days",range:{min:1,max:7,step:1},
    format:n=>n+(n===1?" day":" days")+" a week"},
  session_minutes:{label:"Minutes a session",icon:"timer",range:{min:5,max:60,step:5},
    format:m=>m+" min",marks:[5,10,20,30,40,50,60]},
  preferred_window:{label:"Time of day",icon:"clock",range:{min:7,max:21,step:1},marks:[7,9,11,13,15,17,19,21],
    format:w=>windowText(w)},
};
const anyTime=w=>!w||(w[0]<=PREF_SLIDERS.preferred_window.range.min&&w[1]>=PREF_SLIDERS.preferred_window.range.max);
/* "7:00–11:00", or "Any time" for the whole range (saved as null). */
const windowText=w=>anyTime(w)?"Any time":hourText(w[0])+"–"+hourText(w[1]);

/* Ana, the demo user every flow shows: Home (home.jsx) plans her week from these answers
   and the You tab (profile.jsx) shows them. The doc fixture examples/initial.input.json is
   a different person (two 10-minute sessions, walk and strength). */
const SAMPLE_PREFS={
  timezone:"Europe/Warsaw",
  starting_comfort:"starting_out",
  sessions_per_week:3,
  session_minutes:20,
  activity_interests:["walking","running"],
  available_locations:["outdoors","home"],
  available_equipment:[],
  preferred_window:[7,11],
  discovery_preference:"occasional",
  avoidances:["jumping"],
  starting_obstacles:["time"],
  excluded_activity_types:[],
};

const STEPS=5;

function usePrefs(initial){
  const [p,setP]=React.useState(()=>({...SAMPLE_PREFS,...initial}));
  const set=(k,v)=>setP(s=>({...s,[k]:v}));
  const toggle=(k,v)=>setP(s=>{const a=s[k]||[];return {...s,[k]:a.includes(v)?a.filter(x=>x!==v):[...a,v]};});
  return [p,set,toggle];
}
/* No sport picked means "explore", whatever was chosen before. */
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

/* A number on a scale: the value spelled out above a native range input, so keyboard
   and screen readers get the platform slider. A tick under the track marks every step;
   `marks` (default: every step) get a longer tick and their number, which lights up
   when it is the value. Track and thumb match the website's SliderField.
   .ob-dual is the same thumb on a transparent track, for RangeSlider's two inputs. */
const THUMB_CSS="width:28px;height:28px;border-radius:var(--radius-pill);background:var(--surface-card);border:2px solid var(--accent)";
const SLIDER_CSS=`
.ob-range{-webkit-appearance:none;appearance:none;width:100%;height:44px;margin:0;background:transparent;cursor:pointer;touch-action:pan-y}
.ob-range::-webkit-slider-runnable-track{height:6px;border-radius:var(--radius-pill);background:linear-gradient(to right,var(--accent) var(--pct),var(--border-strong) var(--pct))}
.ob-range::-moz-range-track{height:6px;border-radius:var(--radius-pill);background:var(--border-strong)}
.ob-range::-moz-range-progress{height:6px;border-radius:var(--radius-pill);background:var(--accent)}
.ob-range::-webkit-slider-thumb,.ob-dual::-webkit-slider-thumb{-webkit-appearance:none;${THUMB_CSS};margin-top:-11px;box-shadow:var(--shadow-card,0 1px 3px rgba(0,0,0,.2));transition:transform var(--dur-fast) var(--ease-out)}
.ob-range::-moz-range-thumb,.ob-dual::-moz-range-thumb{box-sizing:border-box;${THUMB_CSS}}
.ob-range:active::-webkit-slider-thumb,.ob-dual:active::-webkit-slider-thumb{transform:scale(1.1)}
.ob-range:focus-visible,.ob-dual:focus-visible{outline:none}
.ob-range:focus-visible::-webkit-slider-thumb,.ob-dual:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 4px var(--focus-ring)}
.ob-range:focus-visible::-moz-range-thumb,.ob-dual:focus-visible::-moz-range-thumb{box-shadow:0 0 0 4px var(--focus-ring)}
.ob-dual{-webkit-appearance:none;appearance:none;position:absolute;left:0;top:0;width:100%;height:44px;margin:0;background:transparent;pointer-events:none;touch-action:pan-y}
.ob-dual::-webkit-slider-runnable-track{height:6px;background:transparent}
.ob-dual::-moz-range-track{height:6px;background:transparent}
.ob-dual::-webkit-slider-thumb{pointer-events:auto;cursor:pointer}
.ob-dual::-moz-range-thumb{pointer-events:auto;cursor:pointer}
.ob-search::placeholder{color:var(--text-tertiary)}
.ob-search:focus-visible{outline:none}
.ob-field:focus-within{border-color:var(--accent)!important;box-shadow:0 0 0 4px var(--focus-ring)}`;
if(!document.getElementById("ob-slider-css")){const el=document.createElement("style");el.id="ob-slider-css";el.textContent=SLIDER_CSS;document.head.appendChild(el);}
const THUMB=28; /* the thumb's centre stops THUMB/2 short of each end; ticks follow it */
const stepsOf=range=>{const s=[];for(let v=range.min;v<=range.max;v+=range.step) s.push(v);return s;};
const RAIL={position:"absolute",left:THUMB/2,right:THUMB/2,pointerEvents:"none"};
/* Ticks and numbers under a track. `lit` says which ticks are inside the value; `on` which
   numbers are the value. */
function Ticks({range,marks,lit,on}){
  const steps=stepsOf(range), numbered=marks||steps;
  const at=v=>((v-range.min)/(range.max-range.min))*100+"%";
  return (
    <>
      <div aria-hidden="true" style={{...RAIL,top:29}}>
        {steps.map(v=><span key={v} style={{position:"absolute",top:0,left:at(v),width:2,height:numbered.includes(v)?6:4,marginLeft:-1,borderRadius:1,background:lit(v)?"var(--accent)":"var(--border-strong)",transition:"background var(--dur-fast) var(--ease-out)"}}/>)}
      </div>
      <div aria-hidden="true" style={{...RAIL,top:40}}>
        {numbered.map(v=>{const o=on(v);return (
          <span key={v} style={{position:"absolute",top:0,left:at(v),transform:"translateX(-50%)",font:"var(--type-caption)",fontWeight:o?600:undefined,color:o?"var(--accent-text)":"var(--text-tertiary)",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{v}</span>);})}
      </div>
    </>
  );
}
function SliderValue({icon,children}){
  return (
    <div aria-hidden="true" style={{display:"flex",alignItems:"center",gap:8,font:"600 var(--text-base)/1.3 var(--font-body)",color:"var(--accent-text)",fontVariantNumeric:"tabular-nums"}}>
      <Icon name={icon} size={18}/>{children}
    </div>
  );
}
function Slider({label,icon,range,value,onChange,format,marks}){
  const at=v=>((v-range.min)/(range.max-range.min))*100+"%";
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <SliderValue icon={icon}>{format(value)}</SliderValue>
      {/* The input is 44 tall with the track centred on 22; ticks start 4 below the track,
          inside the thumb's reach, so the thumb covers the one it sits on. */}
      <div style={{position:"relative",paddingBottom:12}}>
        <input type="range" className="ob-range" min={range.min} max={range.max} step={range.step} value={value}
          aria-label={label} aria-valuetext={format(value)} style={{"--pct":at(value),position:"relative",zIndex:1,display:"block"}}
          onChange={e=>onChange(Number(e.target.value))}/>
        <Ticks range={range} marks={marks} lit={v=>v<=value} on={v=>v===value}/>
      </div>
    </div>
  );
}

/* A window on one track: two native range inputs share the rail, so each thumb keeps the
   platform slider for keyboard and screen readers ("Earliest", "Latest"). The track fills
   between the thumbs; ticks and numbers follow Slider. The thumbs stay one step apart, and
   the one nearer the middle sits on top so two close thumbs can still be pulled apart. */
function RangeSlider({label,icon,range,value,onChange,format,marks}){
  const [a,b]=value;
  const f=v=>(v-range.min)/(range.max-range.min);
  const pos=v=>"calc("+THUMB/2+"px + (100% - "+THUMB+"px) * "+f(v)+")";
  const mid=(range.min+range.max)/2;
  const input=(v,which,set)=>(
    <input type="range" className="ob-dual" min={range.min} max={range.max} step={range.step} value={v}
      aria-label={which+" "+label.toLowerCase()} aria-valuetext={hourText(v)}
      style={{zIndex:which==="Earliest"?(a>mid?3:2):(b<mid?3:2)}} onChange={e=>set(Number(e.target.value))}/>
  );
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <SliderValue icon={icon}>{format(value)}</SliderValue>
      <div role="group" aria-label={label} style={{position:"relative",paddingBottom:12}}>
        <div style={{position:"relative",height:44}}>
          <span aria-hidden="true" style={{position:"absolute",left:0,right:0,top:19,height:6,borderRadius:"var(--radius-pill)",background:"var(--border-strong)"}}></span>
          <span aria-hidden="true" style={{position:"absolute",top:19,height:6,borderRadius:"var(--radius-pill)",background:"var(--accent)",left:pos(a),width:"calc((100% - "+THUMB+"px) * "+(f(b)-f(a))+")"}}></span>
          {input(a,"Earliest",v=>onChange([Math.min(v,b-range.step),b]))}
          {input(b,"Latest",v=>onChange([a,Math.max(v,a+range.step)]))}
        </div>
        <Ticks range={range} marks={marks} lit={v=>v>=a&&v<=b} on={v=>v===a||v===b}/>
      </div>
    </div>
  );
}

/* One option of a multiple-choice list: a square check, so "pick any" reads at a glance.
   Same row rhythm as the DS Radio row. */
function CheckRow({label,checked,onClick}){
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onClick}
      style={{display:"flex",alignItems:"center",gap:14,width:"100%",minHeight:48,padding:"10px 0",border:0,background:"transparent",color:"var(--text-primary)",font:"500 var(--text-base)/1.3 var(--font-body)",textAlign:"left",cursor:"pointer"}}>
      <span aria-hidden="true" style={{width:24,height:24,flex:"none",boxSizing:"border-box",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",background:checked?"var(--accent)":"var(--surface-card)",border:checked?"none":"1.5px solid var(--border-strong)",color:"var(--text-on-accent)",transition:"background var(--dur-fast) var(--ease-out)"}}>
        {checked?<Icon name="check" size={15} strokeWidth={2.5}/>:null}
      </span>
      {label}
    </button>
  );
}
function CheckList({label,options,values,onToggle}){
  return <div role="group" aria-label={label}>{options.map(o=><CheckRow key={o.value} label={o.label} checked={values.includes(o.value)} onClick={()=>onToggle(o.value)}/>)}</div>;
}

/* Search the sport catalog. Matches anywhere in the name; a pick adds it to the chips above
   and clears the field. Enter picks the first match. */
function SportSearch({selected,onAdd,initial=""}){
  const [q,setQ]=React.useState(initial);
  const t=q.trim().toLowerCase();
  const hits=t?PREF_OPTIONS.activity_interests.filter(s=>s.label.toLowerCase().includes(t)).slice(0,5):[];
  const add=v=>{if(!selected.includes(v)) onAdd(v);setQ("");};
  return (
    <Col gap={8}>
      <label className="ob-field" style={{display:"flex",alignItems:"center",gap:10,height:52,padding:"0 6px 0 16px",borderRadius:"var(--radius-control)",border:"1px solid var(--border-strong)",background:"var(--surface-card)",cursor:"text",transition:"border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)"}}>
        <Icon name="search" size={18} color="var(--text-tertiary)"/>
        <input className="ob-search" value={q} placeholder="Search more sports, like football" aria-label="Search more sports" autoComplete="off" enterKeyHint="search"
          role="combobox" aria-expanded={!!t} aria-autocomplete="list"
          onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&hits[0]){e.preventDefault();add(hits[0].value);}}}
          style={{flex:1,minWidth:0,border:0,background:"transparent",padding:0,margin:0,color:"var(--text-primary)",font:"var(--type-body)"}}/>
        {q?<IconButton icon="x" label="Clear search" size="sm" onClick={()=>setQ("")}/>:null}
      </label>
      {t?(hits.length?(
        <div role="listbox" aria-label="Sports" style={{background:"var(--surface-card)",border:"1px solid var(--border-subtle)",borderRadius:"var(--radius-md)",boxShadow:"var(--shadow-card)",padding:"4px 0"}}>
          {hits.map((s,i)=>{const on=selected.includes(s.value);return (
            <button key={s.value} type="button" role="option" aria-selected={on} onClick={()=>add(s.value)}
              style={{display:"flex",alignItems:"center",gap:12,width:"100%",minHeight:48,padding:"0 16px",border:0,borderTop:i?"1px solid var(--border-subtle)":"none",background:"transparent",color:"var(--text-primary)",font:"500 var(--text-base)/1.3 var(--font-body)",textAlign:"left",cursor:"pointer"}}>
              <span style={{flex:1}}>{s.label}</span>
              {on?<span style={{font:"var(--type-caption)",color:"var(--text-tertiary)"}}>Added</span>:<Icon name="plus" size={18} color="var(--accent-text)"/>}
            </button>);})}
        </div>
      ):<span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)"}}>No sport called “{q.trim()}” yet. Pick another, or leave it to us.</span>):null}
    </Col>
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

/* The three Time questions, shared with Edit time (profile.jsx 9.4). */
function TimeQuestions({p,set}){
  return (
    <>
      <Col gap={12}>
        <Question>How often would you like to make room for movement?</Question>
        <Slider {...PREF_SLIDERS.sessions_per_week} value={p.sessions_per_week} onChange={v=>set("sessions_per_week",v)}/>
      </Col>
      <Col gap={12}>
        <Question>What feels manageable for one session?</Question>
        <Slider {...PREF_SLIDERS.session_minutes} value={p.session_minutes} onChange={v=>set("session_minutes",v)}/>
      </Col>
      <Col gap={12}>
        <Question optional hint="Drag both ends. The whole bar means any time.">When would you prefer to move?</Question>
        <RangeSlider {...PREF_SLIDERS.preferred_window} value={p.preferred_window||[PREF_SLIDERS.preferred_window.range.min,PREF_SLIDERS.preferred_window.range.max]} onChange={v=>set("preferred_window",v)}/>
      </Col>
    </>
  );
}

/* 3.1 — Time: sessions_per_week, session_minutes, preferred_window (optional) */
function Time({initial}){
  const [p,set]=usePrefs(initial);
  return (
    <>
      <StepTop step={2}/>
      <Content>
        <Steps step={2} total={STEPS}/>
        <Col gap={8}>
          <H1>Start small</H1>
          <Body>Pick what feels easy. You can change it later.</Body>
        </Col>
        <TimeQuestions p={p} set={set}/>
      </Content>
      <Next/>
    </>
  );
}

/* 3.2 — Activities: activity_interests (catalog sport ids), discovery_preference */
function Activities({initial,search}){
  const [p,set,toggle]=usePrefs(initial);
  const none=!p.activity_interests.length;
  const discovery=discoveryOf(p);
  /* Suggested chips, then any sport added from search, so every pick can be undone here. */
  const chips=PREF_OPTIONS.activity_interests.filter(o=>o.suggested||p.activity_interests.includes(o.value));
  return (
    <>
      <StepTop step={3}/>
      <Content>
        <Steps step={3} total={STEPS}/>
        <Col gap={8}>
          <H1>What would you like to try?</H1>
          <Body>Pick any that sound good — or none, and we'll help you explore.</Body>
        </Col>
        <Col gap={12}>
          <Chips label="What would you like to try?">
            {chips.map(o=><Tag key={o.value} icon={o.icon} selected={p.activity_interests.includes(o.value)} onClick={()=>toggle("activity_interests",o.value)}>{o.label}</Tag>)}
          </Chips>
          <SportSearch selected={p.activity_interests} initial={search} onAdd={v=>toggle("activity_interests",v)}/>
        </Col>
        <Col gap={12}>
          <Question>Would you like occasional new suggestions?</Question>
          <div role="radiogroup" aria-label="Would you like occasional new suggestions?" style={{display:"flex",flexDirection:"column",gap:8}}>
            {PREF_OPTIONS.discovery_preference.map(o=><Radio key={o.value} variant="card" checked={discovery===o.value} disabled={none&&o.value!=="explore"} label={o.label} onChange={()=>set("discovery_preference",o.value)}/>)}
          </div>
          {none?<span style={{font:"var(--type-caption)",color:"var(--text-tertiary)"}}>Pick a sport to choose the other options.</span>:null}
        </Col>
      </Content>
      <Next/>
    </>
  );
}

/* 3.3 — Places: available_locations (at least one), available_equipment */
function Places({initial}){
  const [p,set,toggle]=usePrefs(initial);
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

/* 3.4 — Good to know (optional): avoidances, starting_obstacles. Two checkbox lists;
   nothing checked is a full answer, so there is no "none" option to keep in sync. */
function Extras({initial}){
  const [p,,toggle]=usePrefs(initial);
  return (
    <>
      <StepTop step={5} right={<Button variant="ghost" size="sm" style={{marginRight:-8}}>Skip</Button>}/>
      <Content>
        <Steps step={5} total={STEPS}/>
        <Col gap={8}>
          <H1>Good to know</H1>
          <Body>Both questions are optional. Tick any that apply.</Body>
        </Col>
        <Col gap={4}>
          <Question>Is there anything you would rather avoid?</Question>
          <CheckList label="Is there anything you would rather avoid?" options={PREF_OPTIONS.avoidances} values={p.avoidances} onToggle={v=>toggle("avoidances",v)}/>
        </Col>
        <Col gap={4}>
          <Question>What usually makes starting difficult?</Question>
          <CheckList label="What usually makes starting difficult?" options={PREF_OPTIONS.starting_obstacles} values={p.starting_obstacles} onToggle={v=>toggle("starting_obstacles",v)}/>
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
    <button type="button" style={{display:"flex",alignItems:"center",gap:14,width:"100%",padding:"10px 0",border:0,borderTop:divider?"1px solid var(--border-subtle)":"none",background:"transparent",color:"var(--text-primary)",textAlign:"left",cursor:"pointer"}}>
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
/* Calendar access, asked with an explicit tap. The plan is built from its free time;
   events themselves never leave the phone. `state`: off · connected · denied. */
const CALENDAR={
  off:{icon:"calendar",value:"Not connected",detail:"We only see when you're busy.",action:"Connect"},
  connected:{icon:"calendar-check",value:"Connected",detail:"Busy times only, never what's in your events."},
  denied:{icon:"calendar-x",value:"Access is off",detail:"Without it, we use your preferred times.",action:"Settings"},
};
function CalendarRow({state="off"}){
  const c=CALENDAR[state];
  return (
    <div style={{display:"flex",alignItems:"center",gap:14,padding:"10px 0",borderTop:"1px solid var(--border-subtle)"}}>
      <span style={{width:40,height:40,borderRadius:99,background:state==="denied"?"var(--surface-sunken)":"var(--accent-soft)",color:state==="denied"?"var(--text-secondary)":"var(--accent-text)",display:"flex",alignItems:"center",justifyContent:"center",flex:"none"}}><Icon name={c.icon} size={18}/></span>
      <Col gap={2} style={{flex:1,minWidth:0}}>
        <span style={{font:"var(--type-caption)",color:"var(--text-tertiary)"}}>Calendar</span>
        <span style={{font:"600 var(--text-base)/1.3 var(--font-body)"}}>{c.value}</span>
        <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)",textWrap:"pretty"}}>{c.detail}</span>
      </Col>
      {c.action?<Button variant="secondary" size="sm" style={{height:44}}>{c.action}</Button>:<Icon name="check" size={18} color="var(--success-text)"/>}
    </div>
  );
}
/* One line per step, shared with the You tab's rows (profile.jsx). */
function prefSummary(p){
  const n=p.sessions_per_week, avoid=p.avoidances||[], hard=p.starting_obstacles||[];
  return {
    time:{value:n+(n===1?" day":" days")+" a week · "+p.session_minutes+" min",detail:windowText(p.preferred_window)},
    activities:{value:p.activity_interests.length?listOf("activity_interests",p.activity_interests):"Not sure yet",detail:labelOf("discovery_preference",discoveryOf(p))},
    places:{value:listOf("available_locations",p.available_locations),detail:p.available_equipment.length?listOf("available_equipment",p.available_equipment):"No equipment"},
    extras:{value:avoid.length?"Avoid "+listOf("avoidances",avoid,true):"Nothing to avoid",detail:hard.length?"Hardest: "+listOf("starting_obstacles",hard,true):null},
  };
}
function Review({initial,calendar="off"}){
  const [p]=usePrefs(initial);
  const s=prefSummary(p);
  const rows=[
    {icon:"sprout",label:"Starting point",value:labelOf("starting_comfort",p.starting_comfort)},
    {icon:"calendar-clock",label:"Time",...s.time},
    {icon:"footprints",label:"Activities",...s.activities},
    {icon:"map-pin",label:"Places",...s.places},
    {icon:"feather",label:"Good to know",...s.extras},
  ];
  return (
    <>
      <TopBar left={<IconButton icon="arrow-left" label="Back"/>}/>
      <Content gap={20}>
        <Col gap={8}>
          <H1>Looks right?</H1>
          <Body>We'll build your first week from this. Tap anything to change it.</Body>
        </Col>
        <Col gap={0}>{rows.map((r,i)=><ReviewRow key={r.label} {...r} divider={i>0}/>)}<CalendarRow state={calendar}/></Col>
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
  {id:"time",label:"3.1 · Time",C:Time,note:"The time of day is one window on a two-handle slider, 7:00–21:00. The whole bar means any time."},
  {id:"activities",label:"3.2 · Activities",C:Activities,note:"Six suggested sports as chips; every other sport in the catalog is one search away."},
  {id:"activities-search",label:"3.2 · Activities: search",C:()=><Activities search="ten"/>,h:"auto",note:"Matches anywhere in the name. A pick joins the chips above, selected."},
  {id:"activities-none",label:"3.2 · Activities: none picked",C:()=><Activities initial={{activity_interests:[],discovery_preference:"explore"}}/>},
  {id:"places",label:"3.3 · Places",C:Places},
  {id:"extras",label:"3.4 · Good to know (optional)",C:Extras,note:"Two checkbox lists. Nothing ticked is a full answer, so there's no “Nothing to avoid”."},
  {id:"review",label:"4 · Review",C:Review,note:"Connect asks for calendar access, so sessions land in free time. Events never leave the phone."},
  {id:"review-calendar-off",label:"4.1 · Review: calendar access off",C:()=><Review calendar="denied"/>,note:"Access was refused. Settings opens the phone's settings; the plan can still be built."},
];

Object.assign(window,{ONBOARDING_SCREENS,PREF_OPTIONS,PREF_SLIDERS,SAMPLE_PREFS,Question,Chips,Segmented,Slider,RangeSlider,CheckRow,CheckList,TimeQuestions,prefSummary,windowText});
})();
