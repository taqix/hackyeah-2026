/* Add a workout — screens 11, 11A–11A.8 (form) and 11B–11B.6 (chat). See README › Add a workout.
   Logs something done outside the plan: an extra swim, a run with a friend, a strength
   session. Two variants of the same feature, to rate side by side and keep one:
     A  Form  pick the activity, then fill its few predefined fields
     B  Chat  say it in a sentence; our assistant fills the same fields and shows them
   Rules for both:
     - One required answer: how long (Strength: how long or one exercise; Something else:
       also a name). The rest is optional, and nothing is made up: no default distance,
       weight or reps. Chat may guess a missing detail, but always labels the guess.
     - Saved straight away, with Undo, like chat revisions (8). An added workout is history,
       not a plan session: it never changes the plan by itself and isn't counted in
       "2 of 3 done".
     - Each activity asks for its own predefined numbers (ACTIVITIES). Strength exercises are
       named by the person and counted one of three ways, as in workout.jsx: reps (weight
       optional), time, or distance.
   Data: Ana on Thursday 8 October 2026, week 1, a rest day (home.jsx 5.4). Her next session
   is Friday's walk-run, 7:00 · 10 min. Strength uses dumbbells and bodyweight only.
   Loaded before screens.jsx and wrapped in a function so its names stay local.
   Layout helpers (TopBar, Content, BottomBar, NavBar, Col, Row, H1, Kicker, Body, Section),
   Sheet (workout.jsx), Segmented (onboarding.jsx) and HOME_SCREENS resolve at render time.
   Registers window.LOG_SCREENS. */
(() => {
const { Icon, Button, IconButton, Badge, Tag, Input } = window.DS;

/* Spinner, shimmer, listening pulse and message entry. All stop under reduced motion. */
if (!document.getElementById("log-motion")) {
  const css = document.createElement("style");
  css.id = "log-motion";
  css.textContent = "@keyframes log-spin{to{transform:rotate(360deg)}}"
    + "@keyframes log-shimmer{from{background-position:100% 0}to{background-position:-100% 0}}"
    + "@keyframes log-pulse{0%{box-shadow:0 0 0 0 var(--focus-ring)}70%{box-shadow:0 0 0 14px transparent}100%{box-shadow:0 0 0 0 transparent}}"
    + "@keyframes log-bars{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}"
    + "@keyframes log-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}"
    + ".log-num:focus-within{border-color:var(--accent)!important;box-shadow:0 0 0 4px var(--focus-ring)}"
    + ".log-input::placeholder{color:var(--text-tertiary)}"
    + ".log-scroll{scrollbar-width:none}.log-scroll::-webkit-scrollbar{display:none}"
    + "@media (prefers-reduced-motion:reduce){[data-log-motion]{animation:none!important}}";
  document.head.appendChild(css);
}

const STRONG = {font:"600 var(--text-base)/1.3 var(--font-body)"};
const SMALL = {margin:0,font:"var(--type-body-sm)",color:"var(--text-secondary)",textWrap:"pretty"};
/* Tertiary captions pass 4.5:1 on cards only; captions on the page use LEGIBLE (see chat.jsx). */
const CAPTION = {font:"var(--type-caption)",color:"var(--text-tertiary)"};
const LEGIBLE = {font:"var(--type-caption)",color:"var(--text-secondary)",textWrap:"pretty"};
const LABEL = {font:"var(--type-label)",color:"var(--text-secondary)"};
const NUM = {fontFamily:"var(--font-numeric)",fontVariantNumeric:"tabular-nums",letterSpacing:"var(--tracking-tight)"};
const HAIRLINE = "1px solid var(--border-subtle)";
const ROW_BTN = {display:"flex",alignItems:"center",width:"100%",padding:0,border:0,background:"transparent",color:"inherit",font:"inherit",textAlign:"left",cursor:"pointer"};
const SR_ONLY = {position:"absolute",width:1,height:1,margin:-1,padding:0,overflow:"hidden",clip:"rect(0 0 0 0)",whiteSpace:"nowrap",border:0};

/* ---------- Data ---------- */

/* The preference draft's activity types (onboarding's activity_interests), plus anything
   else by name. `asks` is shown on the tile, so people see the few fields before tapping. */
const ACTIVITIES = [
  {value:"walking",label:"Walk",icon:"footprints",asks:"Time, distance"},
  {value:"running",label:"Run",icon:"wind",asks:"Time, distance"},
  {value:"cycling",label:"Bike",icon:"bike",asks:"Time, distance"},
  {value:"swimming",label:"Swim",icon:"waves",asks:"Time, lengths"},
  {value:"strength",label:"Strength",icon:"dumbbell",asks:"Exercises, sets"},
  {value:"mobility",label:"Stretch",icon:"person-standing",asks:"Time"},
];
const OTHER = {value:"other",label:"Something else",icon:"shapes",asks:"A game, a class, a hike: name and time"};
const ACT = Object.fromEntries([...ACTIVITIES, OTHER].map(a => [a.value, a]));
const CARDIO = ["walking","running","cycling"];
const GUIDE = {
  walking:"Only the time is needed. A rough number is fine.",
  running:"Only the time is needed. A rough number is fine.",
  cycling:"Only the time is needed. A rough number is fine.",
  swimming:"Only the time is needed. Count lengths if you like.",
  strength:"Add the exercises you remember, or just the time.",
  mobility:"Just the time. A rough number is fine.",
  other:"Give it a name and say how long.",
};

/* Today is Thursday 8 October. "Other day" offers the five days before yesterday. */
const DAYS = [{value:"today",label:"Today"},{value:"yesterday",label:"Yesterday"},{value:"other",label:"Other day"}];
const DAY_LONG = {today:"Thursday 8 October",yesterday:"Wednesday 7 October"};
const EARLIER = [{value:"tue",label:"Tue 6"},{value:"mon",label:"Mon 5"},{value:"sun",label:"Sun 4"},{value:"sat",label:"Sat 3"},{value:"fri",label:"Fri 2"}];
const QUICK_MIN = [15, 30, 45, 60];
/* The same four answers as Completion & feedback (7). */
const FELT = [{value:"easy",label:"Easy"},{value:"just_right",label:"Just right"},{value:"hard",label:"Hard"},{value:"too_much",label:"Too much"}];
const POOLS = [25, 33, 50];

/* How a strength exercise is counted: the three tracking ways of workout.jsx. */
const KINDS = [
  {value:"reps",label:"Reps",icon:"dumbbell",example:"3 × 10 · 8 kg"},
  {value:"time",label:"Time",icon:"timer",example:"3 × 30 s"},
  {value:"distance",label:"Distance",icon:"route",example:"2 km · 15 min"},
];
const KIND_ICONS = {reps:"dumbbell",time:"timer",distance:"route"};
/* Offered under the name field: exercises from the plan first, then common ones. A pick
   sets how it's counted; the numbers stay empty. */
const SUGGEST = [
  {name:"Goblet squat",kind:"reps"},
  {name:"Dumbbell row",kind:"reps"},
  {name:"Knee push-up",kind:"reps"},
  {name:"Knee plank",kind:"time"},
  {name:"Glute bridge",kind:"reps"},
  {name:"Wall sit",kind:"time"},
];
const OTHER_NAMES = ["Football","Dancing","Yoga","Hiking","Tennis"];

/* Ana's extra strength session, as logged in 11A.4 and 11B.4. */
const STRENGTH = [
  {name:"Goblet squat",kind:"reps",sets:[{reps:10,kg:8},{reps:10,kg:8},{reps:10,kg:8}]},
  {name:"Dumbbell row",kind:"reps",sets:[{reps:10,kg:6},{reps:10,kg:6},{reps:8,kg:6}]},
  {name:"Knee push-up",kind:"reps",sets:[{reps:8},{reps:8}]},
  {name:"Knee plank",kind:"time",sets:[{sec:30},{sec:30},{sec:20}]},
];

/* ---------- Formatting ---------- */

const same = a => a.every(x => x === a[0]);
const secText = s => s < 60 ? s + " s" : s % 60 ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + " min" : s / 60 + " min";
const kmText = v => (Math.round(v * 100) / 100) + " km";
const metres = m => m >= 1000 ? kmText(m / 1000) : m + " m";
const minText = m => m >= 90 && m % 30 === 0 ? m / 60 + " h" : m + " min";
/* "3 × 10 · 8 kg", "10, 10, 8 reps · 6 kg", "2 × 8", "3 × 30 s", "2 km · 15 min".
   Sets × reps and the · separator follow system/README › Numbers. */
function setsText(kind, sets){
  const done = (sets || []).filter(s => kind === "reps" ? +s.reps : kind === "time" ? +s.sec : +s.km || +s.min);
  if (!done.length) return "No numbers, and that's fine";
  if (kind === "time") { const t = done.map(s => +s.sec); return same(t) ? done.length + " × " + secText(t[0]) : t.map(secText).join(", "); }
  if (kind === "distance") return done.map(s => [+s.km ? kmText(+s.km) : null, +s.min ? s.min + " min" : null].filter(Boolean).join(" · ")).join(", ");
  const reps = done.map(s => +s.reps), kg = done.map(s => +s.kg || 0);
  const r = same(reps) ? done.length + " × " + reps[0] : reps.join(", ") + " reps";
  return r + (kg.some(Boolean) ? " · " + (same(kg) ? kg[0] : kg.join(", ")) + " kg" : "");
}

/* ---------- Form pieces (candidates for the design system) ---------- */

/* Icon in a tinted circle. `spin` turns it into the busy indicator. */
const DISC = {
  accent:["var(--accent-soft-strong)","var(--accent-text)"],
  soft:["var(--accent-soft)","var(--accent-text)"],
  neutral:["var(--surface-sunken)","var(--text-secondary)"],
  success:["var(--success-soft)","var(--success)"],
  danger:["var(--danger-soft)","var(--danger)"],
  info:["var(--info-soft)","var(--info)"],
};
function Disc({icon, tone = "accent", size = 32, spin}){
  const [bg, fg] = DISC[tone];
  return (
    <span aria-hidden="true" style={{width:size,height:size,flex:"none",borderRadius:99,background:bg,color:fg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span data-log-motion={spin ? "" : undefined} style={{display:"flex",animation:spin ? "log-spin 1.1s linear infinite" : "none"}}>
        <Icon name={icon} size={Math.round(size * 0.5)} strokeWidth={size < 40 ? 2 : 1.75}/>
      </span>
    </span>
  );
}

/* A labelled part of the form. Optional parts say "(optional)" in the label, as on 6.2 and 7. */
function Field({label, hint, children}){
  return (
    <div role="group" aria-label={label} style={{display:"flex",flexDirection:"column",gap:8}}>
      <span style={LABEL}>{label}</span>
      {children}
      {hint ? <span style={LEGIBLE}>{hint}</span> : null}
    </div>
  );
}

/* Keeps static frames clickable: a piece is controlled when it gets onChange, else it holds its own value. */
function useValue(value, onChange){
  const [own, setOwn] = React.useState(value);
  return onChange ? [value, onChange] : [own, setOwn];
}

/* Inline number field. In the app, tapping it opens the numeric keypad
   (inputMode numeric, or decimal for km). */
function Num({label, value, onChange, unit, mode = "numeric", placeholder = "–", align = "right", inputRef, style}){
  const [v, set] = useValue(value ?? "", onChange);
  const clean = t => { t = t.replace(",", "."); return mode === "decimal" ? t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1") : t.replace(/\D/g, "").slice(0, 4); };
  return (
    <label className="log-num" style={{display:"flex",alignItems:"center",gap:6,height:48,padding:"0 14px",borderRadius:"var(--radius-control)",border:"1px solid var(--border-strong)",background:"var(--surface-card)",minWidth:0,cursor:"text",transition:"border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",...style}}>
      <span style={SR_ONLY}>{label}</span>
      <input ref={inputRef} className="log-input" value={v} placeholder={placeholder} inputMode={mode} autoComplete="off" onChange={e => set(clean(e.target.value))}
        style={{flex:1,width:"100%",minWidth:0,border:0,outline:"none",background:"transparent",padding:0,margin:0,color:"var(--text-primary)",font:"600 18px/1 var(--font-numeric)",...NUM,textAlign:align}}/>
      {unit ? <span style={{font:"var(--type-label)",color:"var(--text-tertiary)",flex:"none"}}>{unit}</span> : null}
    </label>
  );
}
function Labeled({label, children}){
  return <div style={{display:"flex",flexDirection:"column",gap:6,minWidth:0}}><span style={LABEL}>{label}</span>{children}</div>;
}

/* When: today is preset. "Other day" offers the five days before yesterday, so no calendar. */
function When({value = "today", day = "tue", onChange}){
  const [v, set] = useValue(value, onChange);
  const [d, setD] = React.useState(day);
  return (
    <Col gap={10}>
      <Segmented label="When" options={DAYS} value={v} onChange={set}/>
      {v === "other"
        ? <div role="radiogroup" aria-label="Which day" style={{display:"flex",flexWrap:"wrap",gap:8}}>{EARLIER.map(o => <Tag key={o.value} selected={d === o.value} onClick={() => setD(o.value)}>{o.label}</Tag>)}</div>
        : <span style={LEGIBLE}>{DAY_LONG[v]}</span>}
    </Col>
  );
}

/* How long: four common lengths in one tap; Other opens a field for the keypad. */
function Minutes({value, onChange, label = "How long"}){
  const [v, set] = useValue(value, onChange);
  const [other, setOther] = React.useState(v != null && !QUICK_MIN.includes(v));
  const field = React.useRef(null);
  const pick = n => { setOther(false); set(n); };
  const openOther = () => { setOther(true); setTimeout(() => field.current && field.current.focus({preventScroll:true}), 0); };
  const tile = (key, on, big, small, onClick, aria) => (
    <button key={key} type="button" role="radio" aria-checked={on} aria-label={aria} onClick={onClick}
      style={{height:64,padding:0,border:0,borderRadius:"var(--radius-md)",background:on ? "var(--accent-soft)" : "var(--surface-card)",boxShadow:on ? "inset 0 0 0 1.5px var(--accent)" : "inset 0 0 0 1px var(--border-strong)",color:"var(--text-primary)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:5,cursor:"pointer",transition:"background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)"}}>
      {big}
      <span style={{font:"var(--type-caption)",color:on ? "var(--accent-text)" : "var(--text-tertiary)"}}>{small}</span>
    </button>
  );
  return (
    <Col gap={8}>
      <div role="radiogroup" aria-label={label} style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:8}}>
        {QUICK_MIN.map(n => tile(n, !other && v === n, <span style={{font:"600 22px/1 var(--font-numeric)",...NUM}}>{n}</span>, "min", () => pick(n), n + " minutes"))}
        {tile("other", other, <Icon name="pencil" size={20}/>, "Other", openOther, "Other length")}
      </div>
      {other ? <Num label="Minutes" value={v ?? ""} onChange={t => set(t === "" ? null : +t)} unit="min" align="left" inputRef={field} placeholder="Type the minutes"/> : null}
    </Col>
  );
}

/* How it felt, optional: tap again to clear. */
function Felt({value = null, onChange}){
  const [v, set] = useValue(value, onChange);
  return (
    <div role="group" aria-label="How did it feel?" style={{display:"flex",flexWrap:"wrap",gap:8}}>
      {FELT.map(f => <Tag key={f.value} selected={v === f.value} onClick={() => set(v === f.value ? null : f.value)}>{f.label}</Tag>)}
    </div>
  );
}

/* Equal-width choice between a few short labels (pool length). */
function Seg({label, options, value, onChange}){
  const [v, set] = useValue(value, onChange);
  return (
    <div role="radiogroup" aria-label={label} style={{display:"grid",gridTemplateColumns:"repeat(" + options.length + ",minmax(0,1fr))",gap:6}}>
      {options.map(o => { const on = o.value === v; return (
        <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => set(o.value)}
          style={{height:48,padding:0,border:0,borderRadius:"var(--radius-control)",background:on ? "var(--surface-inverse)" : "var(--surface-card)",boxShadow:on ? "none" : "inset 0 0 0 1px var(--border-strong)",color:on ? "var(--text-inverse)" : "var(--text-primary)",font:"600 15px/1 var(--font-body)",fontVariantNumeric:"tabular-nums",cursor:"pointer",transition:"background var(--dur-fast) var(--ease-out)"}}>{o.label}</button>); })}
    </div>
  );
}

/* Activity tile for the picker. The second line says what the next screen asks. */
function ActivityTile({a, wide, onClick}){
  const [down, setDown] = React.useState(false);
  return (
    <button type="button" onClick={onClick} onPointerDown={() => setDown(true)} onPointerUp={() => setDown(false)} onPointerLeave={() => setDown(false)}
      style={{display:"flex",flexDirection:wide ? "row" : "column",alignItems:wide ? "center" : "flex-start",gap:wide ? 14 : 10,minWidth:0,minHeight:wide ? 68 : 116,padding:wide ? "10px 14px" : "14px 12px 12px",border:0,borderRadius:"var(--radius-md)",background:"var(--surface-card)",boxShadow:"inset 0 0 0 1px var(--border-strong)",color:"var(--text-primary)",textAlign:"left",cursor:"pointer",transform:down ? "scale(var(--press-scale))" : "none",transition:"transform var(--dur-fast) var(--ease-out)"}}>
      <Disc icon={a.icon} tone="soft" size={40}/>
      <span style={{flex:wide ? 1 : "none",minWidth:0,display:"flex",flexDirection:"column",gap:3}}>
        <span style={{font:"600 15px/1.2 var(--font-body)"}}>{a.label}</span>
        <span style={{font:"var(--type-caption)",color:"var(--text-secondary)",textWrap:"pretty"}}>{a.asks}</span>
      </span>
      {wide ? <Icon name="chevron-right" size={18} color="var(--text-tertiary)"/> : null}
    </button>
  );
}

/* One logged exercise: how it's counted, its name and its sets. Opens the exercise sheet. */
function ExerciseLine({ex, divider, onClick}){
  return (
    <button type="button" onClick={onClick} style={{...ROW_BTN,gap:12,minHeight:64,padding:"10px 0",borderTop:divider ? HAIRLINE : "none"}}>
      <Disc icon={KIND_ICONS[ex.kind]} tone="neutral" size={36}/>
      <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
        <span style={STRONG}>{ex.name}</span>
        <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)",fontVariantNumeric:"tabular-nums"}}>{setsText(ex.kind, ex.sets)}</span>
      </span>
      <Icon name="chevron-right" size={18} color="var(--text-tertiary)"/>
    </button>
  );
}
function ExerciseList({items, onOpen, onAdd}){
  return (
    <div style={{background:"var(--surface-card)",border:HAIRLINE,borderRadius:"var(--radius-card)",boxShadow:"var(--shadow-card)",padding:"2px 16px"}}>
      {items.map((ex, i) => <ExerciseLine key={i} ex={ex} divider={i > 0} onClick={onOpen ? () => onOpen(i) : undefined}/>)}
      <button type="button" onClick={onAdd} style={{...ROW_BTN,gap:10,minHeight:52,borderTop:items.length ? HAIRLINE : "none",color:"var(--accent-text)",font:"600 var(--text-sm)/1 var(--font-body)"}}>
        <Icon name="plus" size={18} strokeWidth={2}/>{items.length ? "Add another exercise" : "Add an exercise"}
      </button>
    </div>
  );
}

/* How an exercise is counted. Each tile shows the notation it produces. */
function KindPicker({value, onChange}){
  return (
    <div role="radiogroup" aria-label="How do you count it?" style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}>
      {KINDS.map(k => { const on = k.value === value; return (
        <button key={k.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(k.value)}
          style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3,minWidth:0,padding:"12px 12px 11px",border:0,borderRadius:"var(--radius-md)",background:on ? "var(--accent-soft)" : "var(--surface-card)",boxShadow:on ? "inset 0 0 0 1.5px var(--accent)" : "inset 0 0 0 1px var(--border-strong)",color:"var(--text-primary)",textAlign:"left",cursor:"pointer",transition:"background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)"}}>
          <Icon name={k.icon} size={18} color={on ? "var(--accent-text)" : "var(--text-secondary)"} style={{marginBottom:6}}/>
          <span style={{font:"600 15px/1.2 var(--font-body)"}}>{k.label}</span>
          <span style={{font:"var(--type-caption)",color:on ? "var(--accent-text)" : "var(--text-secondary)",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{k.example}</span>
        </button>); })}
    </div>
  );
}

function TextButton({icon, onClick, children, style}){
  return (
    <button type="button" onClick={onClick} style={{alignSelf:"flex-start",display:"inline-flex",alignItems:"center",gap:6,height:44,padding:0,border:0,background:"transparent",color:"var(--accent-text)",font:"600 var(--text-sm)/1 var(--font-body)",cursor:"pointer",...style}}>
      {icon ? <Icon name={icon} size={16} strokeWidth={2}/> : null}{children}
    </button>
  );
}

/* The numbers of one exercise. Most beginners repeat the same set, so one line covers
   them all; "Sets weren't the same?" opens one row per set. Add a set copies the last. */
const sameSets = (kind, sets) => sets.length < 2 || sets.every(s => kind === "time" ? s.sec === sets[0].sec : s.reps === sets[0].reps && (s.kg || "") === (sets[0].kg || ""));
function SetsEditor({kind, sets, onChange, split: splitFirst}){
  const [split, setSplit] = React.useState(splitFirst ?? !sameSets(kind, sets));
  const key = kind === "time" ? "sec" : "reps", unit = kind === "time" ? "s" : "reps";
  const putAll = (k, v) => onChange(sets.map(s => ({...s, [k]:v})));
  const put = (i, k, v) => onChange(sets.map((s, j) => j === i ? {...s, [k]:v} : s));
  const count = n => onChange(Array.from({length:Math.max(1, Math.min(10, n || 1))}, (_, i) => sets[i] || {...sets[sets.length - 1]}));
  if (kind === "distance") {
    const s = sets[0] || {};
    return (
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
        <Labeled label="Distance"><Num label="Distance" value={s.km ?? ""} onChange={v => onChange([{...s, km:v}])} unit="km" mode="decimal"/></Labeled>
        <Labeled label="Time"><Num label="Time" value={s.min ?? ""} onChange={v => onChange([{...s, min:v}])} unit="min"/></Labeled>
      </div>
    );
  }
  if (!split) return (
    <Col gap={6}>
      <div style={{display:"grid",gridTemplateColumns:kind === "reps" ? "repeat(3,minmax(0,1fr))" : "repeat(2,minmax(0,1fr))",gap:8}}>
        <Labeled label="Sets"><Num label="Sets" value={sets.length} onChange={v => count(+v)}/></Labeled>
        <Labeled label={kind === "time" ? "Seconds" : "Reps"}><Num label={kind === "time" ? "Seconds each" : "Reps each"} value={sets[0][key] ?? ""} onChange={v => putAll(key, v)} unit={kind === "time" ? "s" : null}/></Labeled>
        {kind === "reps" ? <Labeled label="Weight"><Num label="Weight, optional" value={sets[0].kg ?? ""} onChange={v => putAll("kg", v)} unit="kg" mode="decimal"/></Labeled> : null}
      </div>
      <Row gap={8} style={{justifyContent:"space-between"}}>
        <span style={CAPTION}>{kind === "reps" ? "No weight? Leave it empty." : "Each round, in seconds."}</span>
        <TextButton onClick={() => setSplit(true)}>Sets weren't the same?</TextButton>
      </Row>
    </Col>
  );
  return (
    <Col gap={8}>
      {sets.map((s, i) => (
        <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
          <span aria-hidden="true" style={{width:28,height:28,flex:"none",borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--surface-sunken)",color:"var(--text-secondary)",font:"600 13px/1 var(--font-numeric)"}}>{i + 1}</span>
          <Num label={"Set " + (i + 1) + (kind === "time" ? ", seconds" : ", reps")} value={s[key] ?? ""} onChange={v => put(i, key, v)} unit={unit} style={{flex:1}}/>
          {kind === "reps" ? <Num label={"Set " + (i + 1) + ", weight"} value={s.kg ?? ""} onChange={v => put(i, "kg", v)} unit="kg" mode="decimal" style={{flex:1}}/> : null}
          <IconButton icon="x" label={"Remove set " + (i + 1)} onClick={() => onChange(sets.length > 1 ? sets.filter((_, j) => j !== i) : sets)} style={{marginRight:-6}}/>
        </div>
      ))}
      <TextButton icon="plus" onClick={() => onChange([...sets, {...sets[sets.length - 1]}])}>Add a set</TextButton>
    </Col>
  );
}

/* A short confirmation above the tab bar, with Undo. Solid, not glass: only the tab bar blurs. */
function Toast({icon = "check", detail, onUndo, children}){
  return (
    <div role="status" style={{position:"absolute",left:20,right:20,bottom:100,display:"flex",alignItems:"center",gap:12,minHeight:60,padding:"8px 6px 8px 16px",borderRadius:"var(--radius-md)",background:"var(--surface-inverse)",color:"var(--text-inverse)",boxShadow:"var(--shadow-3)",zIndex:5}}>
      <Icon name={icon} size={18} strokeWidth={2.25}/>
      <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
        <span style={{font:"600 15px/1.3 var(--font-body)"}}>{children}</span>
        {detail ? <span style={{font:"var(--type-caption)",color:"color-mix(in oklch, var(--text-inverse) 78%, transparent)"}}>{detail}</span> : null}
      </span>
      <button type="button" onClick={onUndo} style={{height:44,padding:"0 14px",border:0,borderRadius:"var(--radius-pill)",background:"transparent",color:"inherit",font:"600 15px/1 var(--font-body)",textDecoration:"underline",textUnderlineOffset:3,cursor:"pointer"}}>Undo</button>
    </div>
  );
}

/* workout.jsx's file import row (activity-file-import): one FIT or GPX file fills the form. */
const FileRow = props => window.FileImport ? React.createElement(window.FileImport, props) : null;
/* Home 5.4 (Thursday 8 October) from home.jsx, under the sheet and the toast. */
function HomeBehind(){
  const s = (window.HOME_SCREENS || []).find(x => x.id === "home-updated");
  return s ? <s.C/> : null;
}

/* ---------- 11 — Where an added workout shows up ---------- */

/* Home's week list (home.jsx SessionRow), scrolled down. An added workout sits on its day with
   an Extra tag. It isn't a plan session, so "2 of 3 done" stays as it was. */
const WEEK_ROWS = [
  {day:"Mon",date:"5 Oct",title:"Brisk walk",meta:"20 min · felt easy",done:true},
  {day:"Wed",date:"7 Oct",title:"Walk-run intervals",meta:"20 min · felt just right",done:true},
  {day:"Thu",date:"8 Oct",title:"Swim",meta:"35 min · 500 m · felt just right",done:true,extra:true},
  {day:"Fri",date:"9 Oct",title:"Walk-run intervals",meta:"7:00 · 10 min",updated:true},
];
function WeekRow({r, divider}){
  return (
    <button type="button" style={{...ROW_BTN,gap:14,minHeight:64,padding:"10px 0",borderTop:divider ? HAIRLINE : "none"}}>
      <span style={{width:44,flex:"none",display:"flex",flexDirection:"column",gap:3}}>
        <span style={{font:"600 15px/1 var(--font-body)"}}>{r.day}</span>
        <span style={LEGIBLE}>{r.date}</span>
      </span>
      <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
        <span style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <span style={{...STRONG,color:r.done ? "var(--text-secondary)" : "var(--text-primary)"}}>{r.title}</span>
          {r.extra ? <Badge>Extra</Badge> : null}
          {r.updated ? <Badge tone="accent">Updated</Badge> : null}
        </span>
        <span style={{...LEGIBLE,fontVariantNumeric:"tabular-nums"}}>{r.meta}</span>
      </span>
      {r.done ? <Badge tone="success" dot>Done</Badge> : <Icon name="chevron-right" size={18} color="var(--text-tertiary)"/>}
    </button>
  );
}
/* The list's last row is the way in for both variants: A opens 11A.1, B opens chat (11B). */
function AddRow({onClick}){
  return (
    <button type="button" onClick={onClick} style={{...ROW_BTN,gap:14,minHeight:64,padding:"10px 0",borderTop:HAIRLINE}}>
      <span style={{width:44,flex:"none",display:"flex"}}><Disc icon="plus" tone="soft" size={36}/></span>
      <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
        <span style={{...STRONG,color:"var(--accent-text)"}}>Add a workout</span>
        <span style={LEGIBLE}>Something you did outside your plan</span>
      </span>
    </button>
  );
}
function WeekWithExtra(){
  return (
    <>
      <div aria-hidden="true" style={{position:"absolute",left:0,right:0,top:50,height:28,background:"linear-gradient(var(--bg-app), transparent)",zIndex:1,pointerEvents:"none"}}></div>
      <Content pb={120} gap={20}>
        <Col gap={0} style={{marginTop:8}}>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:12}}>
            <Section>This week</Section>
            <span style={{...LEGIBLE,fontVariantNumeric:"tabular-nums"}}>2 of 3 done</span>
          </div>
          <p style={{...SMALL,marginTop:6}}>Three short sessions, with rest days between. There's no need to add more.</p>
          <div style={{marginTop:8}}>
            {WEEK_ROWS.map((r, i) => <WeekRow key={i} r={r} divider={i > 0}/>)}
            <AddRow/>
          </div>
        </Col>
        <div style={{background:"var(--surface-sunken)",borderRadius:"var(--radius-card)",padding:20,display:"flex",flexDirection:"column",gap:14,marginTop:8}}>
          <Col gap={4}>
            <Section>Need a change?</Section>
            <p style={SMALL}>Say it in a sentence. Your plan updates straight away.</p>
          </Col>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            <Tag icon="timer">Shorter sessions</Tag><Tag icon="calendar-days">Other days</Tag><Tag icon="message-circle">Something else</Tag>
          </div>
        </div>
      </Content>
      <NavBar value="today"/>
    </>
  );
}

/* ---------- A · Form ---------- */

const EMPTY = {when:"today", minutes:null, km:"", lengths:"", pool:25, felt:null, name:"", exercises:[]};
function useLog(initial){
  const [log, setLog] = React.useState(() => ({...EMPTY, ...initial}));
  return [log, (k, v) => setLog(s => ({...s, [k]:v})), setLog];
}
/* Save needs how long. Strength takes an exercise instead; Something else also needs a name. */
const canSave = (activity, log) => activity === "strength" ? !!(log.minutes || log.exercises.length)
  : activity === "other" ? !!(log.name.trim() && log.minutes) : !!log.minutes;
const blankSets = (kind, n = 3) => kind === "distance" ? [{km:"",min:""}] : Array.from({length:n}, () => kind === "time" ? {sec:""} : {reps:"",kg:""});
const savedTitle = (activity, log) => (activity === "other" ? log.name.trim() : ACT[activity].label)
  + " added to " + ({today:"today",yesterday:"yesterday"}[log.when] || "Tuesday");

/* 11A.2–11A.7 — One screen per activity: its few fields, then Save. Only how long is needed. */
function LogForm({activity, log, set, onBack, onSave, onAddExercise, onOpenExercise}){
  const a = ACT[activity];
  const lengths = +log.lengths || 0;
  return (
    <>
      <TopBar left={<IconButton icon="arrow-left" label="Back" onClick={onBack}/>} right={null}/>
      <Content gap={24} pb={150}>
        <Col gap={10}>
          <Row gap={12}><Disc icon={a.icon} tone="soft" size={44}/><H1>{a.label}</H1></Row>
          <Body>{GUIDE[activity]}</Body>
        </Col>
        {activity === "other" ? (
          <Field label="What was it?">
            <Input value={log.name} placeholder="Type a name, or pick one" onChange={v => set("name", v)}/>
            <div role="group" aria-label="Suggestions" style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {OTHER_NAMES.map(n => <Tag key={n} selected={log.name === n} onClick={() => set("name", n)}>{n}</Tag>)}
            </div>
          </Field>
        ) : null}
        <Field label="When"><When value={log.when} onChange={v => set("when", v)}/></Field>
        {activity === "strength" ? <Field label="Exercises"><ExerciseList items={log.exercises} onAdd={onAddExercise} onOpen={onOpenExercise}/></Field> : null}
        <Field label={activity === "strength" ? "How long (optional)" : "How long"}><Minutes value={log.minutes} onChange={v => set("minutes", v)}/></Field>
        {CARDIO.includes(activity) ? (
          <Field label="Distance (optional)"><Num label="Distance" value={log.km} onChange={v => set("km", v)} unit="km" mode="decimal" align="left"/></Field>
        ) : null}
        {activity === "swimming" ? (
          <Field label="Lengths (optional)" hint={lengths ? lengths + " × " + log.pool + " m pool = " + metres(lengths * log.pool) : "One length is one end of the pool to the other."}>
            <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1.6fr)",gap:8}}>
              <Num label="Lengths" value={log.lengths} onChange={v => set("lengths", v)} unit="lengths"/>
              <Seg label="Pool length" options={POOLS.map(p => ({value:p,label:p + " m"}))} value={log.pool} onChange={v => set("pool", v)}/>
            </div>
          </Field>
        ) : null}
        <Field label="How did it feel? (optional)"><Felt value={log.felt} onChange={v => set("felt", v)}/></Field>
        {CARDIO.includes(activity) ? <FileRow/> : activity === "swimming" ? <FileRow title="Swam with a watch?"/> : null}
      </Content>
      <BottomBar><Button size="lg" fullWidth iconRight="check" disabled={!canSave(activity, log)} onClick={onSave}>Save</Button></BottomBar>
    </>
  );
}

/* 11A.1 — What did you do? One tap picks the activity; its own fields come next. */
function PickSheet({onPick, onClose}){
  return (
    <Sheet label="Add a workout">
      <div style={{display:"flex",alignItems:"flex-start",gap:12,padding:"0 4px"}}>
        <Col gap={6} style={{flex:1,minWidth:0}}>
          <span style={{font:"var(--type-heading)",letterSpacing:"var(--tracking-tight)"}}>What did you do?</span>
          <p style={SMALL}>Anything you did outside your plan. A few details come next.</p>
        </Col>
        <IconButton icon="x" label="Close" onClick={onClose} style={{marginTop:-6,marginRight:-8}}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}>
        {ACTIVITIES.map(a => <ActivityTile key={a.value} a={a} onClick={onPick ? () => onPick(a.value) : undefined}/>)}
      </div>
      <ActivityTile a={OTHER} wide onClick={onPick ? () => onPick("other") : undefined}/>
    </Sheet>
  );
}

/* 11A.5–11A.6 — One exercise: its name, how it's counted, its numbers. A suggestion fills the
   name and how it's counted; the numbers stay empty, so nothing is made up. */
function ExerciseSheet({draft, setDraft, editing, split, onDone, onRemove, onClose}){
  const pick = s => setDraft(d => ({...d, name:s.name, kind:s.kind, sets:d.kind === s.kind ? d.sets : blankSets(s.kind)}));
  const kind = k => setDraft(d => k === d.kind ? d : {...d, kind:k, sets:blankSets(k, d.kind === "distance" ? 3 : d.sets.length)});
  return (
    <Sheet label={editing ? "Edit exercise" : "Add an exercise"}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"0 4px"}}>
        <span style={{flex:1,minWidth:0,font:"var(--type-heading)",letterSpacing:"var(--tracking-tight)"}}>{editing ? "Edit exercise" : "Add an exercise"}</span>
        <IconButton icon="x" label="Close" onClick={onClose} style={{marginRight:-8}}/>
      </div>
      <Field label="Name">
        <Input value={draft.name} placeholder="Type a name, or pick one" onChange={v => setDraft(d => ({...d, name:v}))}/>
        {editing ? null : (
          <div role="group" aria-label="Suggestions" style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {SUGGEST.map(s => <Tag key={s.name} selected={draft.name === s.name} onClick={() => pick(s)}>{s.name}</Tag>)}
          </div>
        )}
      </Field>
      <Field label="How do you count it?"><KindPicker value={draft.kind} onChange={kind}/></Field>
      <SetsEditor key={draft.kind} kind={draft.kind} sets={draft.sets} split={split} onChange={sets => setDraft(d => ({...d, sets}))}/>
      <Col gap={4}>
        <Button size="lg" fullWidth icon={editing ? "check" : "plus"} disabled={!draft.name.trim()} onClick={onDone}>{editing ? "Done" : "Add exercise"}</Button>
        {editing ? <Button fullWidth variant="ghost" icon="trash-2" onClick={onRemove}>Remove exercise</Button> : null}
      </Col>
    </Sheet>
  );
}

/* Stand-in for the entry on Home (11), so the clickable frame can start over. */
function AddPill({onClick}){
  return (
    <div style={{position:"absolute",left:0,right:0,bottom:104,display:"flex",justifyContent:"center",zIndex:4}}>
      <Button icon="plus" onClick={onClick} style={{boxShadow:"var(--shadow-2)"}}>Add a workout</Button>
    </div>
  );
}

/* The form with its exercise sheet, working. Used by 11A and by Edit in the chat (11B). */
function FormWithSheet({activity, log, set, onBack, onSave}){
  const [sheet, setSheet] = React.useState(null); // {index, draft}; index null = a new exercise
  const setDraft = f => setSheet(s => ({...s, draft:typeof f === "function" ? f(s.draft) : f}));
  const done = () => {
    const ex = sheet.draft;
    set("exercises", sheet.index == null ? [...log.exercises, ex] : log.exercises.map((e, i) => i === sheet.index ? ex : e));
    setSheet(null);
  };
  return (
    <>
      <LogForm activity={activity} log={log} set={set} onBack={onBack} onSave={onSave}
        onAddExercise={() => setSheet({index:null, draft:{name:"", kind:"reps", sets:blankSets("reps")}})}
        onOpenExercise={i => setSheet({index:i, draft:JSON.parse(JSON.stringify(log.exercises[i]))})}/>
      {sheet ? <ExerciseSheet draft={sheet.draft} setDraft={setDraft} editing={sheet.index != null} onDone={done}
        onRemove={() => { set("exercises", log.exercises.filter((_, i) => i !== sheet.index)); setSheet(null); }} onClose={() => setSheet(null)}/> : null}
    </>
  );
}

/* 11A — Clickable: Add a workout → What did you do? → its fields → Save → Home, with Undo. */
function FormTry(){
  const [step, setStep] = React.useState("pick"); // pick · form · home
  const [activity, setActivity] = React.useState(null);
  const [log, set, setLog] = useLog({});
  const [toast, setToast] = React.useState(null);
  const start = a => { setActivity(a); setLog({...EMPTY}); setToast(null); setStep("form"); };
  const save = () => { setToast(savedTitle(activity, log)); setStep("home"); };
  if (step === "form") return <FormWithSheet activity={activity} log={log} set={set} onBack={() => setStep("pick")} onSave={save}/>;
  return (
    <>
      <HomeBehind/>
      {step === "pick" ? <PickSheet onPick={start} onClose={() => setStep("home")}/> : null}
      {step === "home" && toast ? <Toast detail="Your plan stays as it is." onUndo={() => setToast(null)}>{toast}</Toast> : null}
      {step === "home" && !toast ? <AddPill onClick={() => setStep("pick")}/> : null}
    </>
  );
}

/* 11A.1 — the picker over Home 5.4. */
const Pick = () => <><HomeBehind/><PickSheet/></>;
/* 11A.2 — Run: a quick time and a typed distance. Feeling and file are optional. */
const RunForm = () => { const [log, set] = useLog({minutes:30, km:"3.1"}); return <LogForm activity="running" log={log} set={set}/>; };
/* 11A.3 — Swim: a typed time (Other), lengths in a 25 m pool, and how it felt. */
const SwimForm = () => { const [log, set] = useLog({minutes:35, lengths:"20", felt:"just_right"}); return <LogForm activity="swimming" log={log} set={set}/>; };
/* 11A.4 — Strength: the exercises Ana remembered, each counted its own way. */
const StrengthForm = () => { const [log, set] = useLog({minutes:30, exercises:STRENGTH}); return <LogForm activity="strength" log={log} set={set}/>; };
/* 11A.5 — Adding the first exercise: a suggestion picked, three sets of ten at 8 kg. */
function AddExercise(){
  const [log, set] = useLog({});
  const [draft, setDraft] = React.useState({name:"Goblet squat", kind:"reps", sets:[{reps:"10",kg:"8"},{reps:"10",kg:"8"},{reps:"10",kg:"8"}]});
  return <><LogForm activity="strength" log={log} set={set}/><ExerciseSheet draft={draft} setDraft={setDraft}/></>;
}
/* 11A.6 — Sets that differed: one row per set; Add a set copies the last. */
function SetsDiffer(){
  const [log, set] = useLog({exercises:STRENGTH.slice(0, 2)});
  const [draft, setDraft] = React.useState({name:"Dumbbell row", kind:"reps", sets:[{reps:"10",kg:"6"},{reps:"10",kg:"6"},{reps:"8",kg:"6"}]});
  return <><LogForm activity="strength" log={log} set={set}/><ExerciseSheet editing draft={draft} setDraft={setDraft}/></>;
}
/* 11A.7 — Something else: a name, how long, how it felt. */
const OtherForm = () => { const [log, set] = useLog({name:"Football", minutes:60, felt:"hard"}); return <LogForm activity="other" log={log} set={set}/>; };
/* 11A.8 — Saved: back on Home with a short confirmation and Undo. */
const Saved = () => <><HomeBehind/><Toast detail="Your plan stays as it is.">Swim added to today</Toast></>;

/* ---------- B · Chat pieces ----------
   They mirror chat.jsx (Bubble, Fine, Options, Surface, Head, Working, Problem, Composer), so
   logging reads like the plan chat; promote both together. New here: LogCard, the voice
   input in the Composer, and Examples for logging. */

function ChatTop({sub = "Running · week 1"}){
  return (
    <div style={{flex:"none",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px 4px",minHeight:52}}>
      <div style={{width:44}}><IconButton icon="arrow-left" label="Back"/></div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <span style={{font:"var(--type-subheading)"}}>Coach</span>
        {sub ? <span style={LEGIBLE}>{sub}</span> : null}
      </div>
      <div style={{width:44}}></div>
    </div>
  );
}

/* The conversation. anchor="end" keeps the newest message above the message box. `live`
   scrolls for real: it follows new messages and keeps the wheel from panning the board. */
function Thread({anchor = "start", live, count, children}){
  const end = anchor === "end";
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!live) return;
    const el = ref.current;
    const keep = e => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); };
    el.addEventListener("wheel", keep, {passive:true});
    return () => el.removeEventListener("wheel", keep);
  }, [live]);
  React.useEffect(() => {
    if (!live) return;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current.scrollTo({top:ref.current.scrollHeight,behavior:calm ? "auto" : "smooth"});
  }, [live, count]);
  return (
    <div ref={ref} className={live ? "log-scroll" : undefined} aria-live={live ? "polite" : undefined}
      style={{flex:1,minHeight:0,position:"relative",overflowX:"hidden",overflowY:live ? "auto" : "hidden",display:"flex",flexDirection:"column",justifyContent:end ? "flex-end" : "flex-start"}}>
      <div style={{display:"flex",flexDirection:"column",gap:12,padding:"8px var(--gutter-screen) 20px"}}>{children}</div>
      {end ? <div aria-hidden="true" style={{position:"absolute",left:0,right:0,top:0,height:36,background:"linear-gradient(var(--bg-app), transparent)",pointerEvents:"none"}}></div> : null}
    </div>
  );
}

function Bubble({me, foot, children}){
  return (
    <div style={{alignSelf:me ? "flex-end" : "flex-start",maxWidth:me ? 296 : 318,display:"flex",flexDirection:"column",alignItems:me ? "flex-end" : "flex-start",gap:6}}>
      <div style={{padding:"11px 16px",borderRadius:me ? "20px 20px 6px 20px" : "20px 20px 20px 6px",background:me ? "var(--accent)" : "var(--surface-bubble)",color:me ? "var(--text-on-accent)" : "var(--text-primary)",font:"var(--type-body)",textWrap:"pretty"}}>{children}</div>
      {foot}
    </div>
  );
}
function Fine({icon, tone, align = "start", children}){
  return (
    <span style={{...LEGIBLE,display:"flex",alignItems:"center",justifyContent:align === "center" ? "center" : align === "end" ? "flex-end" : "flex-start",gap:6,color:tone === "danger" ? "var(--danger-text)" : LEGIBLE.color}}>
      {icon ? <Icon name={icon} size={14}/> : null}{children}
    </span>
  );
}
/* Quick replies send straight away. */
function Options({items, onPick}){
  return (
    <div role="group" aria-label="Quick replies" style={{display:"flex",flexWrap:"wrap",gap:8}}>
      {items.map(t => (
        <button key={t} type="button" onClick={onPick ? () => onPick(t) : undefined}
          style={{display:"inline-flex",alignItems:"center",height:44,padding:"0 16px",borderRadius:"var(--radius-pill)",border:"1px solid var(--accent-soft-strong)",background:"var(--accent-soft)",color:"var(--accent-text)",font:"600 15px/1 var(--font-body)",whiteSpace:"nowrap",cursor:"pointer"}}>{t}</button>
      ))}
    </div>
  );
}
/* A coach message that saved nothing says so underneath, like "Plan unchanged" in 8. */
function Reply({options, onPick, foot = "Nothing saved yet", children}){
  return (
    <div style={{alignSelf:"stretch",display:"flex",flexDirection:"column",gap:10}}>
      <Bubble foot={foot ? <Fine icon="circle-dashed">{foot}</Fine> : null}>{children}</Bubble>
      {options ? <Options items={options} onPick={onPick}/> : null}
    </div>
  );
}
function Surface({label, role, live, children}){
  return <section aria-label={label} role={role} aria-live={live} style={{alignSelf:"stretch",background:"var(--surface-card)",border:HAIRLINE,borderRadius:"var(--radius-card)",boxShadow:"var(--shadow-card)",overflow:"hidden"}}>{children}</section>;
}
function Head({icon, tone, title, time, spin}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <Disc icon={icon} tone={tone} spin={spin}/>
      <span style={{flex:1,minWidth:0,font:"var(--type-subheading)"}}>{title}</span>
      {time ? <span style={{...CAPTION,whiteSpace:"nowrap"}}>{time}</span> : null}
    </div>
  );
}

/* Old value struck through, then the new one, as in the plan chat's Diff. */
function Diff({what, from, to}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:12,minHeight:28,font:"400 15px/1.35 var(--font-body)",fontVariantNumeric:"tabular-nums"}}>
      <span style={SR_ONLY}>{what + " changed from " + from + " to " + to}</span>
      <span aria-hidden="true" style={{width:96,flex:"none",...CAPTION}}>{what}</span>
      <span aria-hidden="true" style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <s style={{color:"var(--text-tertiary)",textDecorationThickness:"1.5px"}}>{from}</s>
        <Icon name="arrow-right" size={14} color="var(--text-tertiary)"/>
        <span style={{fontWeight:600}}>{to}</span>
      </span>
    </div>
  );
}

const WHEN_TEXT = {today:"Today · Thu 8 Oct", yesterday:"Yesterday · Wed 7 Oct", other:"Tue 6 Oct"};
/* The numbers a saved workout shows, in the order the form asks for them. */
function factsOf(log){
  const f = [];
  if (log.minutes) f.push(["Time", minText(log.minutes)]);
  if ((CARDIO.includes(log.activity) || (log.activity === "swimming" && !+log.lengths)) && +log.km) f.push(["Distance", kmText(+log.km)]);
  if (log.activity === "swimming" && +log.lengths) f.push(["Lengths", log.lengths + " × " + log.pool + " m"], ["Distance", metres(log.lengths * log.pool)]);
  return f;
}

/* A workout the assistant understood and saved. Every field is shown, so a misread is easy to
   spot; a guessed value is named as a guess. Felt can be answered in the card. Only the
   newest card keeps Undo and Edit. state: added · updated · removed. */
function LogCard({log, state = "added", time = "Just now", diffs = [], latest = true, onUndo, onEdit, onFelt}){
  const a = ACT[log.activity];
  if (state === "removed") return (
    <Surface label="Workout removed">
      <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:8}}>
        <Head icon="undo-2" tone="neutral" title="Workout removed" time={time}/>
        <p style={SMALL}>Nothing from this message is saved.</p>
      </div>
    </Surface>
  );
  const facts = factsOf(log);
  return (
    <Surface label={state === "updated" ? "Workout updated" : "Workout added"}>
      <div style={{padding:"16px 18px 14px",display:"flex",flexDirection:"column",gap:12}}>
        <Head icon={state === "updated" ? "pencil" : "check"} tone="accent" title={state === "updated" ? "Workout updated" : "Workout added"} time={time}/>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Disc icon={a.icon} tone="soft" size={40}/>
          <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
            <span style={STRONG}>{log.activity === "other" ? log.name : a.label}</span>
            <span style={CAPTION}>{WHEN_TEXT[log.when]}</span>
          </span>
        </div>
      </div>
      {diffs.length ? (
        <div style={{padding:"10px 18px 12px",borderTop:HAIRLINE,display:"flex",flexDirection:"column",gap:4}}>{diffs.map((d, i) => <Diff key={i} {...d}/>)}</div>
      ) : facts.length ? (
        <dl style={{margin:0,padding:"12px 18px 14px",borderTop:HAIRLINE,display:"grid",gridTemplateColumns:"repeat(" + Math.min(3, facts.length) + ",minmax(0,1fr))",gap:"12px 10px"}}>
          {facts.map(([k, v]) => (
            <div key={k} style={{display:"flex",flexDirection:"column",gap:4,minWidth:0}}>
              <dt style={CAPTION}>{k}</dt>
              <dd style={{margin:0,font:"600 18px/1.1 var(--font-numeric)",...NUM}}>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {!diffs.length && log.exercises && log.exercises.length ? (
        <div style={{padding:"2px 18px",borderTop:HAIRLINE}}>
          {log.exercises.map((ex, i) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,minHeight:52,borderTop:i ? HAIRLINE : "none"}}>
              <Icon name={KIND_ICONS[ex.kind]} size={16} color="var(--text-tertiary)"/>
              <span style={{flex:1,minWidth:0,font:"500 15px/1.3 var(--font-body)"}}>{ex.name}</span>
              <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)",fontVariantNumeric:"tabular-nums",textAlign:"right"}}>{setsText(ex.kind, ex.sets)}</span>
            </div>
          ))}
        </div>
      ) : null}
      {log.poolGuess && !diffs.length ? (
        <div style={{display:"flex",gap:12,padding:"12px 18px",borderTop:HAIRLINE}}>
          <Disc icon="info" tone="info" size={28}/>
          <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
            <span style={{font:"600 15px/1.3 var(--font-body)"}}>The pool length is a guess</span>
            <span style={SMALL}>25 m is the most common. Say so if yours was different.</span>
          </div>
        </div>
      ) : null}
      {latest && !diffs.length ? (
        <div style={{padding:"12px 18px 14px",borderTop:HAIRLINE,display:"flex",flexDirection:"column",gap:8}}>
          <span style={CAPTION}>How did it feel? (optional)</span>
          <div role="group" aria-label="How did it feel?" style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,auto))",justifyContent:"start",gap:6}}>
            {FELT.map(f => <Tag key={f.value} selected={log.felt === f.value} onClick={onFelt ? () => onFelt(log.felt === f.value ? null : f.value) : undefined} style={{padding:"0 11px",justifyContent:"center",whiteSpace:"nowrap"}}>{f.label}</Tag>)}
          </div>
        </div>
      ) : null}
      <div style={{padding:"12px 18px 14px",borderTop:HAIRLINE,display:"flex",flexDirection:"column",gap:12}}>
        <Fine icon="lock">Your plan stays as it is.</Fine>
        {latest ? (
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Button size="sm" variant="secondary" icon="undo-2" onClick={onUndo}>Undo</Button>
            <span style={{flex:1}}></span>
            <Button size="sm" variant="ghost" icon="pencil" onClick={onEdit}>Edit</Button>
          </div>
        ) : null}
      </div>
    </Surface>
  );
}

/* While the message is read and checked. Nothing is saved until it passes. */
function Working(){
  const base = "color-mix(in oklch, var(--text-primary) 7%, transparent)", glint = "color-mix(in oklch, var(--text-primary) 13%, transparent)";
  const bar = (w, h) => <span data-log-motion="" style={{display:"block",width:w,height:h,borderRadius:99,background:"linear-gradient(90deg, " + base + " 30%, " + glint + " 50%, " + base + " 70%)",backgroundSize:"200% 100%",animation:"log-shimmer 1.6s ease-in-out infinite"}}></span>;
  return (
    <Surface label="Adding your workout" role="status" live="polite">
      <div style={{padding:"16px 18px 14px",display:"flex",flexDirection:"column",gap:8}}>
        <Head icon="loader-circle" tone="accent" title="Adding your workout" spin/>
        <p style={SMALL}>Nothing is saved until it's checked.</p>
      </div>
      <div aria-hidden="true" style={{display:"flex",gap:12,padding:"14px 18px 16px",borderTop:HAIRLINE}}>
        {bar(40, 40)}
        <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:9}}>{bar("46%", 14)}{bar("30%", 12)}</div>
      </div>
    </Surface>
  );
}
function Problem({title, actions, children}){
  return (
    <Surface label={title} role="alert">
      <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:10}}>
        <Head icon="circle-alert" tone="danger" title={title}/>
        <p style={SMALL}>{children}</p>
        {actions ? <div style={{display:"flex",alignItems:"center",gap:8,marginTop:2}}>{actions}</div> : null}
      </div>
    </Surface>
  );
}

/* Empty state: what a message can look like. A tap fills the box so it can be edited first. */
const EXAMPLES = [
  {icon:"wind",label:"A run",text:"Ran 3 km in about half an hour"},
  {icon:"waves",label:"A swim",text:"Swam 20 lengths, 35 minutes"},
  {icon:"dumbbell",label:"Strength",text:"Goblet squats 3x10 with 8 kg, plank 3x30 s"},
  {icon:"shapes",label:"Anything else",text:"Played football for an hour, it was hard"},
];
function Examples({onPick}){
  return (
    <Surface label="Try saying">
      <div style={{padding:"14px 18px 4px",font:"var(--type-label)",color:"var(--text-tertiary)"}}>Try saying</div>
      {EXAMPLES.map((e, i) => (
        <button key={e.label} type="button" onClick={onPick ? () => onPick(e.text) : undefined} aria-label={e.label + ": " + e.text}
          style={{...ROW_BTN,gap:14,minHeight:62,padding:"9px 18px",borderTop:i ? HAIRLINE : "none"}}>
          <Disc icon={e.icon} tone="neutral" size={36}/>
          <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
            <span style={{font:"600 15px/1.3 var(--font-body)"}}>{e.label}</span>
            <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)"}}>“{e.text}”</span>
          </span>
          <Icon name="arrow-up-left" size={18} color="var(--text-tertiary)"/>
        </button>
      ))}
    </Surface>
  );
}

/* Level bars while listening. They stop under reduced motion. */
function Bars(){
  return (
    <span aria-hidden="true" style={{display:"flex",alignItems:"center",gap:3,height:20,flex:"none"}}>
      {[0, 1, 2, 3].map(i => <span key={i} data-log-motion="" style={{width:3,height:18,borderRadius:99,background:"var(--accent)",transformOrigin:"center",animation:"log-bars " + (0.8 + i * 0.15) + "s ease-in-out " + (i * 0.12) + "s infinite"}}></span>)}
    </span>
  );
}

/* Message box. Empty, it offers the microphone: speaking is the quickest way to log.
   state: idle · busy · listening. With onChange it is a real input that sends on Enter. */
function Composer({value, state, onChange, onSend, onMic, inputRef, hint = "Saved straight away. You can edit or undo."}){
  const busy = state === "busy", listening = state === "listening";
  const canSend = !!(value && value.trim()) && !busy;
  const placeholder = listening ? "Listening…" : busy ? "Adding your workout…" : "Tell us what you did…";
  const line = listening ? "Listening. Tap stop when you're done." : busy ? "One message at a time." : hint;
  return (
    <div style={{flex:"none",padding:"8px var(--gutter-screen) 30px",display:"flex",flexDirection:"column",gap:10,background:"var(--bg-app)"}}>
      <Fine align="center">{line}</Fine>
      <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
        <div style={{flex:1,minWidth:0,minHeight:52,display:"flex",alignItems:"center",gap:10,padding:value || listening ? "13px 18px" : "4px 4px 4px 18px",borderRadius:26,border:"1px solid " + (listening ? "var(--accent)" : "var(--border-strong)"),boxShadow:listening ? "0 0 0 4px var(--focus-ring)" : "none",background:busy ? "var(--surface-sunken)" : "var(--surface-card)"}}>
          {listening ? <Bars/> : null}
          {onChange && !listening ? (
            <input ref={inputRef} className="log-input" value={value} disabled={busy} placeholder={placeholder} aria-label="Message" enterKeyHint="send" autoComplete="off"
              onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && canSend) { e.preventDefault(); onSend(); } }}
              style={{flex:1,width:"100%",minWidth:0,border:0,outline:"none",background:"transparent",padding:0,margin:0,font:"var(--type-body)",color:"var(--text-primary)"}}/>
          ) : (
            <span style={{flex:1,minWidth:0,font:"var(--type-body)",color:value ? "var(--text-primary)" : busy ? "var(--text-secondary)" : "var(--text-tertiary)"}}>{value || placeholder}</span>
          )}
          {!value && !listening && !busy ? <IconButton icon="mic" label="Speak instead" size="sm" onClick={onMic}/> : null}
        </div>
        {listening
          ? <span data-log-motion="" style={{borderRadius:99,marginBottom:4,animation:"log-pulse 1.6s ease-out infinite"}}><IconButton icon="square" label="Stop" variant="primary" onClick={onMic}/></span>
          : <IconButton icon="arrow-up" label="Send" variant="primary" disabled={!canSend} onClick={onSend} style={{marginBottom:4}}/>}
      </div>
    </div>
  );
}

/* ---------- B · Chat: a scripted assistant ----------
   Patterns pick the fields so the board can be tried. The app gets the same fields from the
   backend and checks them against the log contract before anything is saved. */

const WORDS = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,twelve:12,fifteen:15,twenty:20,"twenty-five":25,thirty:30,"forty-five":45,forty:40,fifty:50,sixty:60};
const digits = s => s.replace(/\b(twenty-five|forty-five|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|fifty|sixty)\b/g, w => WORDS[w]);
const ACTIVITY_WORDS = [
  ["swimming", /\bsw[ia]m|\blengths?\b|\blaps?\b|\bpool\b/],
  ["cycling", /\bbik(e|ed|ing)\b|\bcycl|\brode\b/],
  ["running", /\bran\b|\bruns?\b|\brunning\b|\bjog/],
  ["walking", /\bwalk|\bhik(e|ed|ing)\b|\bstroll/],
  ["mobility", /stretch|yoga|mobility|pilates/],
];
const OTHER_WORDS = /\b(football|soccer|tennis|badminton|padel|squash|basketball|volleyball|climbing|bouldering|dancing|zumba)\b/;
const KNOWN = [
  [/goblet/, "Goblet squat", "reps"], [/squat/, "Squat", "reps"], [/\brows?\b/, "Dumbbell row", "reps"],
  [/knee push/, "Knee push-up", "reps"], [/push-?ups?/, "Push-up", "reps"], [/plank/, "Plank", "time"],
  [/bridge/, "Glute bridge", "reps"], [/lunge/, "Lunge", "reps"], [/wall sit/, "Wall sit", "time"],
  [/curl/, "Biceps curl", "reps"], [/press/, "Shoulder press", "reps"],
];
function minutesIn(s){
  if (/hour and a half|1\.5 ?h/.test(s)) return 90;
  if (/half an hour|half hour/.test(s)) return 30;
  let m = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?)\b/);
  if (m) return Math.round(+m[1] * 60);
  if (/\ban hour\b/.test(s)) return 60;
  m = s.match(/(\d+)\s*(?:min|mins|minutes?)\b/);
  return m ? +m[1] : null;
}
const kmIn = s => { const m = s.match(/(\d+(?:\.\d+)?)\s*(?:km|k|kilomet\w*)\b/); return m ? +m[1] : null; };
const lengthsIn = s => { const m = s.match(/(\d+)\s*(?:lengths?|laps?)\b/); return m ? +m[1] : null; };
const poolIn = s => { const m = s.match(/(25|33|50)\s*(?:m|metres?|meters?)?\s*pool/); return m ? +m[1] : null; };
const feltIn = s => /too much|exhaust|wiped|had to stop/.test(s) ? "too_much" : /\bhard\b|tough|tiring/.test(s) ? "hard"
  : /\beasy\b|relaxed/.test(s) ? "easy" : /just right|felt (good|great|nice|fine)/.test(s) ? "just_right" : null;
/* "goblet squats 3x10 with 8 kg" · "plank 3x30 s" · "a 30 s plank" · "some lunges" */
function exercisesIn(s){
  const out = [];
  s.split(/,|;|\bthen\b|\band\b|\bplus\b/).forEach(part => {
    const known = KNOWN.find(([re]) => re.test(part));
    const sx = part.match(/(\d+)\s*(?:x|×|sets? of)\s*(\d+)/);
    if (!known && !sx) return;
    const secs = part.match(/(\d+)\s*(?:s|secs?|seconds?)\b/), kg = part.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)\b/);
    let name = known ? known[1] : part.replace(/\d[\s\S]*$/, "").replace(/\b(i|did|do|some|a|an|the|with|at|of|also|my)\b/g, " ").replace(/\s+/g, " ").trim();
    if (!name) return;
    name = name[0].toUpperCase() + name.slice(1);
    const kind = secs ? "time" : known ? known[2] : "reps";
    const n = sx ? +sx[1] : secs ? 1 : 0;
    const per = kind === "time" ? {sec:secs ? +secs[1] : +sx[2]} : {reps:sx ? +sx[2] : "", kg:kg ? +kg[1] : ""};
    out.push({name, kind, sets:Array.from({length:n}, () => ({...per}))});
  });
  return out;
}
const HURT = /knee|hurt|pain|injur|ache|sore/;

/* Reads one message. Returns what to show: a saved workout, one question, a fix to the last
   workout, an undo, or a problem. `pending` is a workout waiting for how long. */
function assistant(raw, {pending, last, attempt}){
  const s = digits(raw.toLowerCase());
  if (/\bfail|error/.test(s) && !attempt) return {problem:true};
  if (last && /^(undo|delete|remove)\b|remove (it|that)|delete (it|that)/.test(s)) return {undo:true};
  if (last && /actually|it was|make it|should be|wrong|instead|change/.test(s)) {
    const next = {...last}, diffs = [];
    const pool = poolIn(s), lengths = lengthsIn(s), km = kmIn(s), min = minutesIn(s), felt = feltIn(s);
    if (last.activity === "swimming" && (pool && pool !== last.pool || lengths && lengths !== +last.lengths)) {
      const p = pool || last.pool, l = lengths || +last.lengths;
      if (p !== last.pool) diffs.push({what:"Pool length", from:last.pool + " m", to:p + " m"});
      if (l !== +last.lengths) diffs.push({what:"Lengths", from:String(last.lengths || "–"), to:String(l)});
      if (+last.lengths) diffs.push({what:"Distance", from:metres(last.lengths * last.pool), to:metres(l * p)});
      Object.assign(next, {pool:p, lengths:String(l), poolGuess:false});
    }
    if (km && km !== +last.km) { diffs.push({what:"Distance", from:+last.km ? kmText(+last.km) : "–", to:kmText(km)}); next.km = String(km); }
    if (min && min !== last.minutes) { diffs.push({what:"Time", from:last.minutes ? minText(last.minutes) : "–", to:minText(min)}); next.minutes = min; }
    if (felt && felt !== last.felt) { diffs.push({what:"Felt", from:last.felt ? FELT.find(f => f.value === last.felt).label : "–", to:FELT.find(f => f.value === felt).label}); next.felt = felt; }
    if (diffs.length) return {update:{next, diffs}};
  }
  const exercises = exercisesIn(s).filter(e => KNOWN.some(([re]) => re.test(e.name.toLowerCase())) || /gym|dumbbell|weights|kg/.test(s));
  const other = s.match(OTHER_WORDS);
  const found = ACTIVITY_WORDS.find(([, re]) => re.test(s));
  const activity = exercises.length || /\bgym\b|strength|weights|dumbbell/.test(s) ? "strength" : other ? "other" : found ? found[0] : pending ? pending.activity : null;
  if (!activity) return {ask:{text:"What did you do? A walk, a swim, some squats: anything counts.", options:["A walk","A run","A swim","Strength"]}};
  const base = pending && pending.activity === activity ? pending : {...EMPTY, activity};
  const log = {...base, when:/yesterday|last night/.test(s) ? "yesterday" : base.when,
    minutes:minutesIn(s) || base.minutes, km:kmIn(s) ? String(kmIn(s)) : base.km,
    lengths:lengthsIn(s) ? String(lengthsIn(s)) : base.lengths, felt:feltIn(s) || base.felt,
    name:other ? other[1][0].toUpperCase() + other[1].slice(1) : base.name,
    exercises:exercises.length ? exercises : base.exercises};
  if (activity === "swimming") { const p = poolIn(s); log.pool = p || base.pool || 25; log.poolGuess = !p && +log.lengths > 0 && !(pending && pending.poolGuess === false); }
  if (!log.minutes && !(activity === "strength" && log.exercises.length)) {
    const what = activity === "swimming" ? "How long were you in the water, roughly?" : activity === "strength" ? "How long was it, roughly? Or tell us the exercises." : "How long was it, roughly?";
    return {ask:{text:"Nice. " + what, options:["15 min","30 min","45 min","1 hour"]}, pending:log};
  }
  return {save:log, hurt:HURT.test(s)};
}

/* 11B — Clickable: tap an example, type, or tap the microphone; send; answer in the card;
   then fix it in words ("It was a 50 m pool"), Edit or Undo. "fail" shows the problem state. */
const HEARD = "Swam twenty lengths before work, about 35 minutes";
function ChatTry(){
  const [msgs, setMsgs] = React.useState([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [heard, setHeard] = React.useState(null); // the transcript while listening
  const [pending, setPending] = React.useState(null);
  const [editing, setEditing] = React.useState(null); // the card being edited in the form
  const input = React.useRef(null), timer = React.useRef(null), words = React.useRef(null), ids = React.useRef(1);
  React.useEffect(() => () => { clearTimeout(timer.current); clearInterval(words.current); }, []);
  const push = m => setMsgs(list => [...list, {...m, id:ids.current++}]);
  const patch = (id, f) => setMsgs(list => list.map(x => x.id === id ? {...x, ...f} : x));
  const cards = msgs.filter(m => m.k === "card" && (m.state === "added" || m.state === "updated"));
  const last = cards[cards.length - 1];

  const send = (raw, attempt = 0) => {
    const t = (raw ?? text).trim();
    if (!t || busy) return;
    if (!attempt) push({k:"me", text:t});
    setText(""); setBusy(true); push({k:"working"});
    timer.current = setTimeout(() => {
      const r = assistant(t, {pending, last:last && last.log, attempt});
      setMsgs(list => list.filter(m => m.k !== "working"));
      if (r.problem) push({k:"problem", text:t});
      else if (r.undo) undo(last);
      else if (r.update) push({k:"card", state:"updated", log:r.update.next, diffs:r.update.diffs, time:"Just now"});
      else if (r.ask) { push({k:"reply", text:r.ask.text, options:r.ask.options}); setPending(r.pending || null); }
      else {
        push({k:"card", state:"added", log:r.save, time:"Just now"}); setPending(null);
        if (r.hurt) push({k:"note", text:"Sorry it hurts. Plans can't take pain into account yet. If it keeps hurting, check with a doctor or physio."});
      }
      setBusy(false);
    }, 1100);
  };
  const undo = m => { if (m) patch(m.id, {state:m.state === "updated" ? "reverted" : "removed", time:"Just now"}); };
  const mic = () => {
    if (heard != null) { clearInterval(words.current); setText(heard); setHeard(null); return; }
    const all = HEARD.split(" "); let n = 0; setHeard("");
    words.current = setInterval(() => { n++; setHeard(all.slice(0, n).join(" ")); if (n >= all.length) clearInterval(words.current); }, 260);
  };

  const item = m => {
    if (m.k === "me") return <Bubble me>{m.text}</Bubble>;
    if (m.k === "working") return <Working/>;
    if (m.k === "note") return <Bubble>{m.text}</Bubble>;
    if (m.k === "reply") return <Reply options={m.options} onPick={t => send(t)}>{m.text}</Reply>;
    if (m.k === "problem") return (
      <Problem title="Couldn't add your workout" actions={<>
        <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => { setMsgs(list => list.filter(x => x.id !== m.id)); send(m.text, 1); }}>Try again</Button>
        <Button size="sm" variant="ghost" icon="list-plus" onClick={() => setEditing({pick:true})}>Use the form</Button>
      </>}>Something went wrong on our side. <b style={{fontWeight:600,color:"var(--text-primary)"}}>Nothing was saved.</b></Problem>
    );
    if (m.state === "reverted") return (
      <Surface label="Change undone"><div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:8}}>
        <Head icon="undo-2" tone="neutral" title="Change undone" time={m.time}/><p style={SMALL}>Back to how it was before this message.</p>
      </div></Surface>
    );
    return <LogCard log={m.log} state={m.state} time={m.time} diffs={m.diffs} latest={m === last}
      onUndo={() => undo(m)} onEdit={() => setEditing({id:m.id, log:m.log})} onFelt={f => patch(m.id, {log:{...m.log, felt:f}})}/>;
  };

  return (
    <>
      <ChatTop/>
      <Thread live count={msgs.length ? msgs[msgs.length - 1].id : 0}>
        <Bubble>{INTRO}</Bubble>
        {msgs.length ? null : <><Examples onPick={t => { setText(t); input.current && input.current.focus({preventScroll:true}); }}/><Fine icon="lock">Adding a workout never changes your plan.</Fine></>}
        {msgs.map(m => <div key={m.id} data-log-motion="" style={{display:"flex",flexDirection:"column",animation:"log-in var(--dur-slow) var(--ease-out)"}}>{item(m)}</div>)}
      </Thread>
      <Composer value={heard ?? text} state={busy ? "busy" : heard != null ? "listening" : undefined} onChange={setText} onSend={() => send()} onMic={mic} inputRef={input}/>
      {editing && editing.pick ? <PickSheet onPick={a => setEditing({log:{...EMPTY, activity:a}})} onClose={() => setEditing(null)}/> : null}
      {editing && !editing.pick ? <EditOverlay log={editing.log} onCancel={() => setEditing(null)} onSave={next => {
        if (editing.id) patch(editing.id, {log:{...next, poolGuess:false}, time:"Edited just now"});
        else push({k:"card", state:"added", log:next, time:"Just now"});
        setEditing(null);
      }}/> : null}
    </>
  );
}

/* Edit opens the same form as variant A, filled in. Saving replaces the card's numbers. */
function EditOverlay({log, onCancel, onSave}){
  const [draft, set] = useLog(log);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current, keep = e => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); };
    el.addEventListener("wheel", keep, {passive:true});
    return () => el.removeEventListener("wheel", keep);
  }, []);
  return (
    <div style={{position:"absolute",inset:"50px 0 0",zIndex:6,background:"var(--bg-app)",display:"flex",flexDirection:"column"}}>
      <div ref={ref} className="log-scroll" style={{flex:1,minHeight:0,overflowY:"auto"}}>
        <FormWithSheet activity={draft.activity} log={draft} set={set} onBack={onCancel} onSave={() => onSave(draft)}/>
      </div>
    </div>
  );
}

/* ---------- B · Chat: frames ---------- */

const INTRO = "What did you do? Tell us like you'd tell a friend: what it was and about how long.";
const RUN = {...EMPTY, activity:"running", minutes:30, km:"3.1"};
const SWIM = {...EMPTY, activity:"swimming", minutes:35, lengths:"20", pool:25, poolGuess:true};
const GYM = {...EMPTY, activity:"strength", exercises:STRENGTH};

/* 11B.1 — A run in one sentence: every field shown; how it felt can be tapped in the card. */
const ChatRun = () => (
  <>
    <ChatTop/>
    <Thread anchor="end">
      <Bubble>{INTRO}</Bubble>
      <Bubble me>Went for a run before work, about half an hour, 3.1 km</Bubble>
      <LogCard log={RUN}/>
    </Thread>
    <Composer/>
  </>
);
/* 11B.2 — How long is missing: one question with quick answers. Nothing is saved until then. */
const ChatDetail = () => (
  <>
    <ChatTop/>
    <Thread>
      <Bubble>{INTRO}</Bubble>
      <Bubble me>Went for a swim this morning</Bubble>
      <Reply options={["15 min","30 min","45 min","1 hour"]}>Nice. How long were you in the water, roughly?</Reply>
    </Thread>
    <Composer/>
  </>
);
/* 11B.3 — A labelled guess, fixed in words. The older card loses Undo and Edit. */
const ChatFix = () => (
  <>
    <ChatTop/>
    <Thread anchor="end">
      <Bubble me>Swam 20 lengths before work, about 35 minutes</Bubble>
      <LogCard log={SWIM} latest={false} time="9:12"/>
      <Bubble me>It was a 50 m pool</Bubble>
      <LogCard log={{...SWIM, pool:50, poolGuess:false}} state="updated" diffs={[{what:"Pool length",from:"25 m",to:"50 m"},{what:"Distance",from:"500 m",to:"1 km"}]}/>
    </Thread>
    <Composer/>
  </>
);
/* 11B.4 — Strength in one message: each exercise counted its own way, sets that differ kept apart. */
const ChatStrength = () => (
  <>
    <ChatTop/>
    <Thread anchor="end">
      <Bubble me>Dumbbells at home: goblet squats 3x10 at 8 kg, rows 10, 10, 8 at 6 kg, knee push-ups 2x8, knee plank 30, 30, 20 s</Bubble>
      <LogCard log={GYM}/>
    </Thread>
    <Composer/>
  </>
);
/* 11B.5 — Speaking: words appear as they're heard; Stop puts them in the box to check first. */
const ChatVoice = () => (
  <>
    <ChatTop/>
    <Thread>
      <Bubble>{INTRO}</Bubble>
      <Examples/>
    </Thread>
    <Composer state="listening" value={HEARD}/>
  </>
);
/* 11B.6 — Didn't work: nothing is saved. Try again, or switch to the form. */
const ChatFailed = () => (
  <>
    <ChatTop/>
    <Thread>
      <Bubble>{INTRO}</Bubble>
      <Bubble me>Went for a run before work, about half an hour, 3.1 km</Bubble>
      <Problem title="Couldn't add your workout" actions={<>
        <Button size="sm" variant="secondary" icon="refresh-cw">Try again</Button>
        <Button size="sm" variant="ghost" icon="list-plus">Use the form</Button>
      </>}>Something went wrong on our side. <b style={{fontWeight:600,color:"var(--text-primary)"}}>Nothing was saved.</b></Problem>
    </Thread>
    <Composer/>
  </>
);

window.LOG_SCREENS = [
  {id:"log-week",label:"11 · Add a workout: in your week",C:WeekWithExtra,note:"Both variants end here. Home's week list, scrolled: an added workout sits on its day with an Extra tag and doesn't count toward 2 of 3 done. The last row is the way in."},
  {id:"log-form",label:"11A · Form: try it",C:FormTry,note:"Variant A, clickable: pick an activity, fill its fields, add exercises for Strength, Save, Undo. Only how long is needed."},
  {id:"log-pick",label:"11A.1 · Form: what did you do?",C:Pick,note:"One tap. Each tile says what comes next, so the fields hold no surprises. Something else covers games and classes."},
  {id:"log-run",label:"11A.2 · Form: run",C:RunForm,note:"Walk, run and bike ask for time, then distance. Common lengths are one tap; feeling and the watch file are optional."},
  {id:"log-swim",label:"11A.3 · Form: swim",C:SwimForm,h:"auto",note:"A typed time through Other. Lengths × pool length gives the distance, as on 6.9."},
  {id:"log-strength",label:"11A.4 · Form: strength",C:StrengthForm,h:"auto",note:"Exercises are named by the person. Each is counted by reps (weight optional), time or distance. Time is optional here."},
  {id:"log-exercise",label:"11A.5 · Form: add an exercise",C:AddExercise,note:"A suggestion fills the name and how it's counted. One line covers sets that were all the same."},
  {id:"log-sets",label:"11A.6 · Form: sets that differed",C:SetsDiffer,note:"One row per set. Add a set copies the last one, so a fourth set is one tap."},
  {id:"log-other",label:"11A.7 · Form: something else",C:OtherForm,note:"A name and how long. Football, a dance class or a hike need no fields of their own."},
  {id:"log-saved",label:"11A.8 · Form: saved",C:Saved,note:"Saved straight away, with Undo. Home lists it on its day (11); the plan stays as it is."},
  {id:"log-chat",label:"11B · Chat: try it",C:ChatTry,note:"Variant B, clickable: tap an example, type or tap the microphone, send. Then try “It was a 50 m pool”, a feeling in the card, Edit, Undo or “fail”."},
  {id:"log-chat-run",label:"11B.1 · Chat: a run",C:ChatRun,note:"Saved straight away and shown field by field, so a misreading is easy to spot. How it felt is optional, in the card."},
  {id:"log-chat-detail",label:"11B.2 · Chat: needs a detail",C:ChatDetail,note:"Only how long is ever asked for. Nothing is saved until it's answered."},
  {id:"log-chat-fix",label:"11B.3 · Chat: a guess, then a fix",C:ChatFix,note:"A missing pool length is guessed and labelled as a guess. A fix in words updates it, old values struck through."},
  {id:"log-chat-strength",label:"11B.4 · Chat: strength",C:ChatStrength,note:"One message, four exercises, each counted its own way. Sets that differed stay apart."},
  {id:"log-chat-voice",label:"11B.5 · Chat: speaking",C:ChatVoice,note:"The microphone is the quickest way in. Words show as they're heard; Stop puts them in the box to check before sending."},
  {id:"log-chat-failed",label:"11B.6 · Chat: didn't work",C:ChatFailed,note:"Nothing half-saves. Try again resends the message; Use the form opens 11A.1."},
];
})();
