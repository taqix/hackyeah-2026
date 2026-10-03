/* Chat plan revision — screen 8 and states 8.1–8.16 (see README › Chat revision).
   Product rules (docs/product.md, step 6 and "Plan generation and revisions"):
     - A valid change becomes the active plan straight away. There is no confirm step;
       Undo on the newest change is the safety net.
     - Every reply says whether the plan changed: a change card when it did,
       "Plan unchanged" under the message when it did not.
     - A change card lists each changed session once: old value struck through, then
       the new value. The day column always shows where the session is now.
     - Done sessions never change. One request runs at a time. Anything that fails
       (offline, an error, a newer plan from elsewhere) leaves the plan exactly as it was.
   Data follows Home (home.jsx): on Wednesday evening Ana asks for mornings and a shorter
   Friday; Home 5.4 shows the result with Updated tags.
   Loaded before screens.jsx and wrapped in a function so its names stay local.
   Registers window.CHAT_SCREENS. */
(() => {
const { Icon, Button, IconButton, Badge } = window.DS;

/* Spinner, skeleton shimmer and caret. All stop under reduced motion. */
if (!document.getElementById("chat-motion")) {
  const css = document.createElement("style");
  css.id = "chat-motion";
  css.textContent = "@keyframes chat-spin{to{transform:rotate(360deg)}}"
    + "@keyframes chat-shimmer{from{background-position:100% 0}to{background-position:-100% 0}}"
    + "@keyframes chat-blink{50%{opacity:0}}"
    + "@keyframes chat-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}"
    + ".chat-input::placeholder{color:var(--text-tertiary)}.chat-input:disabled::placeholder{color:var(--text-secondary)}"
    + ".chat-scroll{scrollbar-width:none}.chat-scroll::-webkit-scrollbar{display:none}"
    + "@media (prefers-reduced-motion:reduce){[data-chat-motion]{animation:none!important}}";
  document.head.appendChild(css);
}

const SMALL = {margin:0,font:"var(--type-body-sm)",color:"var(--text-secondary)",textWrap:"pretty"};
/* Tertiary text passes 4.5:1 on cards but not on the page background (4.36:1 in light),
   so captions that sit on the page use LEGIBLE. */
const CAPTION = {font:"var(--type-caption)",color:"var(--text-tertiary)"};
const LEGIBLE = {font:"var(--type-caption)",color:"var(--text-secondary)"};
const STRONG = {font:"600 15px/1.3 var(--font-body)"};
const HAIRLINE = "1px solid var(--border-subtle)";
const SR_ONLY = {position:"absolute",width:1,height:1,margin:-1,padding:0,overflow:"hidden",clip:"rect(0 0 0 0)",whiteSpace:"nowrap",border:0};
const TONES = {
  accent:["var(--accent-soft-strong)","var(--accent-text)"],
  neutral:["var(--surface-sunken)","var(--text-secondary)"],
  danger:["var(--danger-soft)","var(--danger)"],
  info:["var(--info-soft)","var(--info)"],
};

function usePress(){
  const [hover, setHover] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  return {hover, pressed, bind:{
    onMouseEnter:() => setHover(true),
    onMouseLeave:() => { setHover(false); setPressed(false); },
    onPointerDown:() => setPressed(true),
    onPointerUp:() => setPressed(false),
    onPointerCancel:() => setPressed(false),
  }};
}

/* ---------- Pieces (candidates for the design system) ---------- */

/* Icon in a tinted circle. `spin` makes it the busy indicator. */
function Disc({icon, tone = "accent", size = 32, spin = false}){
  const [bg, fg] = TONES[tone];
  return (
    <span aria-hidden="true" style={{width:size,height:size,flex:"none",borderRadius:99,background:bg,color:fg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span data-chat-motion={spin ? "" : undefined} style={{display:"flex",animation:spin ? "chat-spin 1.1s linear infinite" : "none"}}>
        <Icon name={icon} size={Math.round(size * 0.5)} strokeWidth={2}/>
      </span>
    </span>
  );
}

function ChatHeader({sub = "Running · week 1"}){
  return (
    <div style={{flex:"none",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px 4px",minHeight:52}}>
      <div style={{width:44}}><IconButton icon="arrow-left" label="Back"/></div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <span style={{font:"var(--type-subheading)"}}>Change your plan</span>
        {sub ? <span style={LEGIBLE}>{sub}</span> : null}
      </div>
      <div style={{width:44}}></div>
    </div>
  );
}

/* The conversation. anchor="end" keeps the newest message just above the message box,
   with older ones scrolled away under the header. `live` scrolls for real: it follows
   new messages (`count`) and keeps the wheel from panning the board. */
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
    <div ref={ref} className={live ? "chat-scroll" : undefined} aria-live={live ? "polite" : undefined}
      style={{flex:1,minHeight:0,position:"relative",overflowX:"hidden",overflowY:live ? "auto" : "hidden",display:"flex",flexDirection:"column",justifyContent:end ? "flex-end" : "flex-start"}}>
      <div style={{display:"flex",flexDirection:"column",gap:12,padding:"8px var(--gutter-screen) 20px"}}>{children}</div>
      {end ? <div aria-hidden="true" style={{position:"absolute",left:0,right:0,top:0,height:36,background:"linear-gradient(var(--bg-app), transparent)",pointerEvents:"none"}}></div> : null}
    </div>
  );
}

/* Coach on the left on a soft surface, you on the right in the accent.
   `context` says what a message is about; `foot` carries its status (an unsent message
   keeps full contrast and says "Not sent" underneath instead of fading). */
function Bubble({me, context, foot, children}){
  return (
    <div style={{alignSelf:me ? "flex-end" : "flex-start",maxWidth:me ? 296 : 318,display:"flex",flexDirection:"column",alignItems:me ? "flex-end" : "flex-start",gap:6}}>
      {context ? <span style={{...LEGIBLE,display:"inline-flex",alignItems:"center",gap:6}}><Icon name={context.icon} size={13}/>{context.label}</span> : null}
      <div style={{padding:"11px 16px",borderRadius:me ? "20px 20px 6px 20px" : "20px 20px 20px 6px",background:me ? "var(--accent)" : "var(--surface-bubble)",color:me ? "var(--text-on-accent)" : "var(--text-primary)",font:"var(--type-body)",textWrap:"pretty"}}><span style={SR_ONLY}>{me ? "You: " : "Coach: "}</span>{children}</div>
      {foot}
    </div>
  );
}

/* Small status line under a message, a card or above the message box. */
function Fine({icon, tone, align = "start", children}){
  return (
    <span style={{...LEGIBLE,display:"flex",alignItems:"center",justifyContent:align === "center" ? "center" : align === "end" ? "flex-end" : "flex-start",gap:6,color:tone === "danger" ? "var(--danger-text)" : LEGIBLE.color,textWrap:"pretty"}}>
      {icon ? <Icon name={icon} size={14}/> : null}{children}
    </span>
  );
}

/* Quick replies send straight away: they answer the coach, they don't edit the message. */
function Options({items, onPick}){
  return <div role="group" aria-label="Quick replies" style={{display:"flex",flexWrap:"wrap",gap:8}}>{items.map(t => <Option key={t} onClick={onPick ? () => onPick(t) : undefined}>{t}</Option>)}</div>;
}
function Option({onClick, children}){
  const {hover, pressed, bind} = usePress();
  return (
    <button type="button" onClick={onClick} {...bind} style={{display:"inline-flex",alignItems:"center",height:44,padding:"0 16px",borderRadius:"var(--radius-pill)",border:"1px solid " + (hover ? "var(--accent)" : "var(--accent-soft-strong)"),background:"var(--accent-soft)",color:"var(--accent-text)",font:"600 15px/1 var(--font-body)",whiteSpace:"nowrap",cursor:"pointer",transform:pressed ? "scale(var(--press-scale))" : "none",transition:"border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)"}}>{children}</button>
  );
}

/* A coach reply that leaves the plan as it is. */
function Reply({options, onPick, children}){
  return (
    <div style={{alignSelf:"stretch",display:"flex",flexDirection:"column",gap:10}}>
      <Bubble foot={<Fine icon="lock">Plan unchanged</Fine>}>{children}</Bubble>
      {options ? <Options items={options} onPick={onPick}/> : null}
    </div>
  );
}

function Surface({label, role, live, children}){
  return (
    <section aria-label={label} role={role} aria-live={live} style={{alignSelf:"stretch",background:"var(--surface-card)",border:HAIRLINE,borderRadius:"var(--radius-card)",boxShadow:"var(--shadow-card)",overflow:"hidden"}}>
      {children}
    </section>
  );
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

/* One attribute: icon, old value struck through, arrow, new value. No `from` = a new value. */
function Diff({icon, what, from, to, size = 15}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,font:"400 " + size + "px/1.35 var(--font-body)",fontVariantNumeric:"tabular-nums"}}>
      <span style={SR_ONLY}>{from ? what + " changed from " + from + " to " + to : what + " " + to}</span>
      <span aria-hidden="true" style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        {icon ? <Icon name={icon} size={16} color="var(--accent-text)"/> : null}
        {from ? <><s style={{color:"var(--text-tertiary)",textDecorationThickness:"1.5px"}}>{from}</s><Icon name="arrow-right" size={14} color="var(--text-tertiary)"/></> : null}
        <span style={{fontWeight:600,color:"var(--text-primary)"}}>{to}</span>
      </span>
    </div>
  );
}

/* One changed session. kind: changed · moved · swapped · added · removed.
   `was` is a swapped session's old title. */
function ChangeRow({kind = "changed", day, date, title, was, diffs = [], note}){
  const removed = kind === "removed";
  const muted = removed ? "var(--text-tertiary)" : "var(--text-primary)";
  return (
    <div style={{display:"flex",gap:12,padding:"12px 18px",borderTop:HAIRLINE}}>
      <div style={{width:44,flex:"none",display:"flex",flexDirection:"column",gap:3,paddingTop:2}}>
        <span style={{font:"600 15px/1 var(--font-body)",color:muted}}>{day}</span>
        <span style={CAPTION}>{date}</span>
      </div>
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:6}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
          <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
            {was ? <span style={{font:"var(--type-body-sm)",color:"var(--text-tertiary)"}}><span style={SR_ONLY}>Was </span><s style={{textDecorationThickness:"1.5px"}}>{was}</s></span> : null}
            <span style={{font:"600 var(--text-base)/1.3 var(--font-body)",color:muted,textDecoration:removed ? "line-through" : "none",textDecorationThickness:"1.5px"}}>{was ? <span style={SR_ONLY}>Now </span> : null}{title}</span>
          </div>
          {kind === "added" ? <Badge tone="accent">New</Badge> : removed ? <Badge>Removed</Badge> : null}
        </div>
        {diffs.map((d, i) => <Diff key={i} {...d}/>)}
        {note ? <span style={SMALL}>{note}</span> : null}
      </div>
    </div>
  );
}

/* Part of a request that was not applied, and why. */
function NotChanged({title, reason}){
  return (
    <div style={{display:"flex",gap:12,padding:"12px 18px",borderTop:HAIRLINE}}>
      <div style={{width:44,flex:"none",display:"flex"}}><Disc icon="info" tone="info" size={28}/></div>
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
        <span style={STRONG}>{title}</span>
        <span style={SMALL}>{reason}</span>
      </div>
    </div>
  );
}

function SportRow({icon, from, to}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 18px",borderTop:HAIRLINE}}>
      <div style={{width:44,flex:"none",display:"flex"}}><Disc icon={icon} size={36}/></div>
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
        <span style={CAPTION}>Sport</span>
        <Diff what="Sport" from={from} to={to} size={16}/>
      </div>
    </div>
  );
}

/* A validated revision, already active. Only the newest change offers Undo. */
function ChangeCard({time = "Just now", summary, sport, rows = [], notChanged = [], kept = "Everything else stays the same.", latest = true, undone = false, onUndo}){
  if (undone) return (
    <Surface label="Change undone">
      <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:8}}>
        <Head icon="undo-2" tone="neutral" title="Change undone" time={time}/>
        {summary ? <p style={SMALL}>{summary}</p> : null}
      </div>
    </Surface>
  );
  return (
    <Surface label="Plan updated">
      <div style={{padding:"16px 18px 14px",display:"flex",flexDirection:"column",gap:8}}>
        <Head icon="check" tone="accent" title="Plan updated" time={time}/>
        {summary ? <p style={SMALL}>{summary}</p> : null}
      </div>
      {sport ? <SportRow {...sport}/> : null}
      {rows.map((r, i) => <ChangeRow key={i} {...r}/>)}
      {notChanged.map((n, i) => <NotChanged key={i} {...n}/>)}
      {kept || latest ? (
        <div style={{padding:"12px 18px 14px",borderTop:HAIRLINE,display:"flex",flexDirection:"column",gap:12}}>
          {kept ? <Fine icon="lock">{kept}</Fine> : null}
          {latest ? (
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Button size="sm" variant="secondary" icon="undo-2" onClick={onUndo}>Undo</Button>
              <span style={{flex:1}}></span>
              <Button size="sm" variant="ghost" iconRight="arrow-right">See week</Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Surface>
  );
}

/* While a change runs, the plan in use stays active until the new one passes checks. */
function Working(){
  return (
    <Surface label="Updating your plan" role="status" live="polite">
      <div style={{padding:"16px 18px 14px",display:"flex",flexDirection:"column",gap:8}}>
        <Head icon="loader-circle" tone="accent" title="Updating your plan" spin/>
        <p style={SMALL}>Your current plan stays as it is until the new one is ready.</p>
      </div>
      <Skeleton/>
      <Skeleton short/>
    </Surface>
  );
}
function Skeleton({short}){
  /* Tinted from the text colour so the bars sit lighter than the card in dark mode too. */
  const base = "color-mix(in oklch, var(--text-primary) 7%, transparent)", glint = "color-mix(in oklch, var(--text-primary) 13%, transparent)";
  const bar = (w, h) => <span data-chat-motion="" style={{display:"block",width:w,height:h,borderRadius:99,background:"linear-gradient(90deg, " + base + " 30%, " + glint + " 50%, " + base + " 70%)",backgroundSize:"200% 100%",animation:"chat-shimmer 1.6s ease-in-out infinite"}}></span>;
  return (
    <div aria-hidden="true" style={{display:"flex",gap:12,padding:"14px 18px",borderTop:HAIRLINE}}>
      <div style={{width:44,flex:"none",display:"flex",flexDirection:"column",gap:7}}>{bar(28, 12)}{bar(40, 10)}</div>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:9}}>{bar(short ? "52%" : "74%", 14)}{bar(short ? "36%" : "58%", 12)}</div>
    </div>
  );
}

/* Something stopped a change. Always says the plan is as it was, and offers a way on. */
function Problem({icon, tone, title, actions, children}){
  return (
    <Surface label={title} role="alert">
      <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:10}}>
        <Head icon={icon} tone={tone} title={title}/>
        <p style={SMALL}>{children}</p>
        {actions ? <div style={{display:"flex",alignItems:"center",gap:8,marginTop:2}}>{actions}</div> : null}
      </div>
    </Surface>
  );
}

/* What the message is about, when chat opens from a session. */
function About({icon, label}){
  return (
    <span style={{alignSelf:"flex-start",maxWidth:"100%",display:"inline-flex",alignItems:"center",gap:6,height:32,padding:"0 4px 0 10px",borderRadius:99,background:"var(--accent-soft)",color:"var(--accent-text)",font:"600 13px/1 var(--font-body)"}}>
      <Icon name={icon} size={14}/>
      <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}</span>
      <button type="button" aria-label={"Remove " + label} style={{width:24,height:24,flex:"none",border:0,borderRadius:99,background:"transparent",color:"inherit",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0}}><Icon name="x" size={14}/></button>
    </span>
  );
}

/* Message box. state: idle · busy (a change is running) · offline.
   `top` replaces the hint line. Static frames fake focus and caret with `focused`;
   with `onChange` it is a real input that sends on Enter. */
function Composer({value, state, about, focused, top, hint = "Changes apply straight away. You can undo.", onChange, onSend, inputRef}){
  const busy = state === "busy", offline = state === "offline";
  const [hasFocus, setHasFocus] = React.useState(false);
  /* A disabled input loses focus without a blur event, so busy clears the ring. */
  const ring = focused || (hasFocus && !busy);
  const canSend = !!(value && value.trim()) && !busy && !offline;
  const placeholder = busy ? "Updating your plan…" : "Ask for a change…";
  return (
    <div style={{flex:"none",padding:"8px var(--gutter-screen) 30px",display:"flex",flexDirection:"column",gap:10,background:"var(--bg-app)"}}>
      {offline ? <OfflineNote/> : top ? top : <Fine align="center">{busy ? "One change at a time." : hint}</Fine>}
      <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
        <div style={{flex:1,minWidth:0,minHeight:52,display:"flex",flexDirection:"column",justifyContent:"center",gap:8,padding:about ? "9px 16px 13px 9px" : "13px 18px",borderRadius:about ? 24 : 26,border:"1px solid " + (ring ? "var(--accent)" : "var(--border-strong)"),boxShadow:ring ? "0 0 0 4px var(--focus-ring)" : "none",background:busy ? "var(--surface-sunken)" : "var(--surface-card)",transition:"border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)"}}>
          {about ? <About {...about}/> : null}
          {onChange ? (
            <input ref={inputRef} className="chat-input" value={value} disabled={busy} placeholder={placeholder} aria-label="Message" enterKeyHint="send" autoComplete="off"
              onChange={e => onChange(e.target.value)} onFocus={() => setHasFocus(true)} onBlur={() => setHasFocus(false)}
              onKeyDown={e => { if (e.key === "Enter" && canSend) { e.preventDefault(); onSend(); } }}
              style={{width:"100%",minWidth:0,border:0,outline:"none",background:"transparent",padding:0,margin:0,font:"var(--type-body)",color:"var(--text-primary)"}}/>
          ) : (
            <span style={{font:"var(--type-body)",color:value ? "var(--text-primary)" : busy ? "var(--text-secondary)" : "var(--text-tertiary)",paddingLeft:about ? 7 : 0}}>
              {value || placeholder}
              {focused ? <span aria-hidden="true" data-chat-motion="" style={{display:"inline-block",width:2,height:20,marginLeft:1,verticalAlign:"-4px",borderRadius:1,background:"var(--accent)",animation:"chat-blink 1.1s step-end infinite"}}></span> : null}
            </span>
          )}
        </div>
        <IconButton icon="arrow-up" label="Send" variant="primary" disabled={!canSend} onClick={onSend} style={{marginBottom:4}}/>
      </div>
    </div>
  );
}
function OfflineNote(){
  return (
    <div role="status" style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:"var(--radius-md)",background:"var(--info-soft)",color:"var(--text-primary)",font:"var(--type-body-sm)"}}>
      <Icon name="wifi-off" size={16} color="var(--info)"/>You're offline. Your plan hasn't changed.
    </div>
  );
}

function DayBreak({children}){
  return (
    <div role="separator" style={{...LEGIBLE,display:"flex",alignItems:"center",gap:12,padding:"2px 0"}}>
      <span style={{flex:1,height:1,background:"var(--border-subtle)"}}></span>{children}<span style={{flex:1,height:1,background:"var(--border-subtle)"}}></span>
    </div>
  );
}

/* An earlier change, folded. Tap to see its rows again. */
function PastChange({time, summary}){
  const {hover, bind} = usePress();
  return (
    <button type="button" aria-expanded="false" {...bind} style={{alignSelf:"stretch",display:"flex",alignItems:"center",gap:12,padding:"12px 14px",border:HAIRLINE,borderRadius:"var(--radius-md)",background:hover ? "var(--surface-sunken)" : "var(--surface-card)",textAlign:"left",color:"inherit",font:"inherit",cursor:"pointer"}}>
      <Disc icon="check" size={28}/>
      <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
        <span style={{display:"flex",alignItems:"baseline",gap:8}}><span style={STRONG}>Plan updated</span><span style={CAPTION}>{time}</span></span>
        <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)"}}>{summary}</span>
      </span>
      <Icon name="chevron-down" size={18} color="var(--text-tertiary)"/>
    </button>
  );
}

/* Empty state: what can be asked. A tap fills the message box so the wording can be edited first. */
const EXAMPLES = [
  {icon:"calendar-days",label:"Move a day",text:"Move Friday to Sunday"},
  {icon:"clock",label:"Change the time",text:"Mornings only, please"},
  {icon:"timer",label:"Shorter or longer",text:"Make Friday 10 minutes"},
  {icon:"shuffle",label:"Swap an activity",text:"Something easier on Friday"},
  {icon:"dumbbell",label:"Change sport",text:"Can I try the gym instead?"},
];
function Examples({onPick}){
  return (
    <Surface label="Try asking">
      <div style={{padding:"14px 18px 4px",font:"var(--type-label)",color:"var(--text-tertiary)"}}>Try asking</div>
      {EXAMPLES.map((e, i) => <Example key={e.label} {...e} divider={i > 0} onClick={onPick ? () => onPick(e.text) : undefined}/>)}
    </Surface>
  );
}
function Example({icon, label, text, divider, onClick}){
  const {hover, bind} = usePress();
  return (
    <button type="button" onClick={onClick} {...bind} aria-label={label + ": " + text} style={{width:"100%",display:"flex",alignItems:"center",gap:14,minHeight:62,padding:"9px 18px",border:0,borderTop:divider ? HAIRLINE : "none",background:hover ? "var(--surface-sunken)" : "transparent",textAlign:"left",color:"inherit",font:"inherit",cursor:"pointer",transition:"background var(--dur-fast) var(--ease-out)"}}>
      <Disc icon={icon} tone="neutral" size={36}/>
      <span style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:2}}>
        <span style={STRONG}>{label}</span>
        <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)"}}>“{text}”</span>
      </span>
      <Icon name="arrow-up-left" size={18} color="var(--text-tertiary)"/>
    </button>
  );
}

/* Guest demo at its limit: the message box gives way to the next step. */
function DemoLimit(){
  return (
    <div style={{flex:"none",padding:"4px var(--gutter-screen) 30px",background:"var(--bg-app)"}}>
      <Surface label="Demo changes used">
        <div style={{padding:18,display:"flex",flexDirection:"column",gap:12}}>
          <Head icon="user-round-plus" tone="accent" title="That was the last demo change"/>
          <p style={SMALL}>The guest demo includes 3 plan changes. Sign up to keep adjusting a plan of your own.</p>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:4}}>
            <Button size="lg" fullWidth>Sign up</Button>
            <Button fullWidth variant="ghost">Back to my plan</Button>
          </div>
        </div>
      </Surface>
    </div>
  );
}

/* ---------- Data ---------- */

const INTRO = "Tell us what to change. Your plan updates straight away, and you can always undo.";
const ASK = "Can we keep everything to mornings this week, and make Friday shorter?";
const TODAY = {icon:"footprints",label:"Today · Walk-run intervals"};
/* Week 1 (home.jsx): Mon 5 brisk walk 7:00 · 20 min, Wed 7 walk-run 7:00 · 20 min,
   Fri 9 walk-run 18:00 · 20 min. Wednesday evening, Monday and Wednesday done.
   Home 5.4 shows the result. Lengths are 5, 10 or 20 min (PREFERENCES.md). */
const FRIDAY = {day:"Fri",date:"9 Oct",title:"Walk-run intervals"};
const MORNINGS = {
  summary:"All your sessions are at 7:00 now, and Friday is 10 minutes.",
  rows:[{...FRIDAY,diffs:[{icon:"clock",what:"Time",from:"18:00",to:"7:00"},{icon:"timer",what:"Length",from:"20 min",to:"10 min"}],note:"Three runs instead of six."}],
  kept:"Monday to Wednesday stay as you did them.",
};

/* ---------- 8 — clickable ---------- */

/* A scripted coach so the board can be tried: keywords pick the reply. The app gets
   replies and validated revisions from the backend instead. It is Wednesday evening:
   Monday and Wednesday are done, and Friday is the session left to change. */
const LIVE_PLAN = {sport:"Running", next:{day:"Fri",date:"9 Oct",title:"Walk-run intervals",time:"18:00",min:20}, removed:null};
const LONG = {Thu:"Thursday",Fri:"Friday",Sat:"Saturday",Sun:"Sunday"};
const MOVE_TO = {thursday:["Thu","8 Oct"],tomorrow:["Thu","8 Oct"],saturday:["Sat","10 Oct"],sunday:["Sun","11 Oct"]};
const INTERVALS = {10:"Three runs instead of six.",5:"One run, with walks either side."};
const LENGTHS = [5, 10, 20]; /* session_minutes options */
const HEALTH = "Sorry to hear that. Plans can't take pain or health conditions into account yet. If it keeps hurting, check with a doctor or physio. Resting is always okay.";
const OTHER_SPORT = name => name + " isn't one of the sports we plan. Running, gym, fitness and football are.";

function coach(text, plan, attempt){
  const s = text.toLowerCase();
  const has = re => re.test(s);
  const n = plan.next, day = n ? LONG[n.day] : null;
  const say = (reply, options, extra) => ({reply, options, ...extra});
  const change = (card, next) => ({card:{kept:"Monday and Wednesday stay as you did them.", ...card}, next});

  if (has(/\bfail|error/) && !attempt) return {problem:true};
  if (has(/knee|hurt|pain|injur|sick|\bill\b|ache|sore|doctor|physio/)) return say(HEALTH, ["Pause this week","Keep my plan"]);
  if (has(/keep my plan|keep running|never ?mind|no thanks|leave it/)) return say("Okay. Nothing changes.");
  const other = s.match(/climbing|basketball|volleyball|tennis|yoga|boxing/);
  if (other) return say(OTHER_SPORT(other[0][0].toUpperCase() + other[0].slice(1)), ["Switch to gym","Keep running"]);
  if (has(/monday|wednesday|today|yesterday/)) return say("Monday and Wednesday are done, so they stay as you did them." + (n ? " Want to change " + day + "?" : ""), n ? ["Make " + day + " shorter","Move " + day] : null);
  if (has(/gym|(switch|back|go) (to )?running/)) {
    const to = has(/gym/) ? "Gym" : "Running";
    if (to === plan.sport) return say("You're on " + to.toLowerCase() + " already.");
    const title = to === "Gym" ? "Gym basics, slowly" : "Walk-run intervals";
    return change({
      summary:to === "Gym" ? "You're on gym now. Same days and times, with short sessions we walk you through step by step." : "You're back on running. Same days and times.",
      sport:{icon:to === "Gym" ? "dumbbell" : "footprints", from:plan.sport, to},
      rows:n ? [{kind:"swapped",day:n.day,date:n.date,was:n.title,title}] : [],
      kept:"Monday and Wednesday stay in your history."}, {...plan, sport:to, next:n ? {...n, title} : n});
  }
  if (has(/\badd\b|\bback\b/)) {
    if (n) return say("Your week already has three sessions, the most a beginner plan has.");
    const r = plan.removed;
    return change({summary:LONG[r.day] + " is back in your plan.", rows:[{kind:"added",day:r.day,date:r.date,title:r.title,diffs:[{icon:"clock",what:"Time",to:r.time},{icon:"timer",what:"Length",to:r.min + " min"}]}]}, {...plan, next:r, removed:null});
  }
  if (!n) return say("There's no session left to change this week. Your next week starts on Monday.", ["Add " + LONG[plan.removed.day] + " back"]);
  if (has(/pause|drop|remove|skip|cancel|fewer days|day off/)) return change({summary:day + " is a rest day now.", rows:[{kind:"removed",day:n.day,date:n.date,title:n.title}]}, {...plan, next:null, removed:n});
  if (has(/gentler activit|something gentler|walk instead|swap/)) {
    if (n.title === "Easy walk") return say(day + " is already an easy walk.");
    return change({summary:day + " is an easy walk now, at the same time.", rows:[{kind:"swapped",day:n.day,date:n.date,was:n.title,title:"Easy walk"}]}, {...plan, next:{...n, title:"Easy walk"}});
  }
  if (has(/easier|easy|lighter|simpler/)) return say("Sure. What would help most?", ["Shorter sessions","Fewer days","Gentler activities"]);
  if (has(/harder|longer|more time|hour|faster|marathon/)) return say("Plans stay gentle while you're starting out, so sessions keep the length you picked.", ["Keep my plan"]);
  const target = Object.keys(MOVE_TO).find(k => s.includes(k));
  if (target) {
    const [to, date] = MOVE_TO[target];
    if (to === n.day) return say("It's on " + LONG[to] + " already.");
    const early = s.match(/\bat ([1-6])\b/); /* before the 7:00–21:00 planning window */
    const diffs = [{icon:"calendar-days",what:"Day",from:n.day + " " + n.date.split(" ")[0],to:to + " " + date.split(" ")[0]}];
    if (early && n.time !== "7:00") diffs.push({icon:"clock",what:"Time",from:n.time,to:"7:00"});
    return change({summary:day + "'s session is on " + LONG[to] + " now" + (early ? ", starting at 7:00." : ", same time."),
      rows:[{kind:"moved",day:to,date,title:n.title,diffs}],
      notChanged:early ? [{title:"7:00, not " + early[1] + ":00",reason:"Sessions are planned between 7:00 and 21:00."}] : []},
      {...plan, next:{...n, day:to, date, time:early ? "7:00" : n.time}});
  }
  const morning = has(/morning|early|\b7(:00)?\b|before work/), evening = has(/evening|after work/);
  const shorter = has(/short|less time|quick|\bmin/);
  if (morning || evening || shorter) {
    const mins = s.match(/(\d+)\s*min/);
    const time = morning ? "7:00" : evening ? "18:00" : n.time;
    const asked = mins ? +mins[1] : null;
    /* Shorter means the next allowed length down; an asked-for length snaps to 5, 10 or 20. */
    const min = shorter ? (asked ? LENGTHS.filter(l => l <= Math.max(asked, 5)).pop() : LENGTHS.filter(l => l < n.min).pop() || n.min) : n.min;
    const snapped = asked && min !== asked ? [{title:min + " min, not " + asked,reason:"Sessions are 5, 10 or 20 minutes long."}] : [];
    const diffs = [];
    if (time !== n.time) diffs.push({icon:"clock",what:"Time",from:n.time,to:time});
    if (min !== n.min) diffs.push({icon:"timer",what:"Length",from:n.min + " min",to:min + " min"});
    if (!diffs.length) return say(day + " is already at " + n.time + " for " + n.min + " minutes, so there's nothing to update.");
    const what = [time !== n.time && "at " + time, min !== n.min && min + " minutes"].filter(Boolean).join(" and ");
    return change({summary:day + " is " + what + " now.",
      rows:[{day:n.day,date:n.date,title:n.title,diffs,note:min !== n.min && n.title === "Walk-run intervals" ? INTERVALS[min] : null}],
      notChanged:snapped},
      {...plan, next:{...n, time, min}});
  }
  if (has(/move|another day|other day/)) return say("Which day works better?", ["Thursday","Saturday","Sunday"]);
  return say("Tell us a little more: which day, and what should change?", ["Make " + day + " shorter","Move " + day + " to the morning"]);
}

/* 8 — First open, from the Home header or "Something else". Clickable: tap an example
   or type, send, then Undo. */
function Start(){
  const [plan, setPlan] = React.useState(LIVE_PLAN);
  const [msgs, setMsgs] = React.useState([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef(null), timer = React.useRef(null), ids = React.useRef(1);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  /* The box is locked while a change runs; hand focus back when it's done. */
  const typing = React.useRef(false);
  React.useEffect(() => { if (!busy && typing.current) input.current.focus(); }, [busy]);
  const push = m => setMsgs(list => [...list, {...m, id:ids.current++}]);

  const send = (raw, attempt = 0) => {
    const t = (raw ?? text).trim();
    if (!t || busy) return;
    if (!attempt) push({k:"me", text:t});
    typing.current = document.activeElement === input.current;
    setText(""); setBusy(true); push({k:"working"});
    timer.current = setTimeout(() => {
      const r = coach(t, plan, attempt);
      setMsgs(list => list.filter(m => m.k !== "working"));
      if (r.problem) push({k:"problem", text:t});
      else if (r.card) { push({k:"change", card:r.card, before:plan}); setPlan(r.next); }
      else push({k:"reply", text:r.reply, options:r.options});
      setBusy(false);
    }, 1200);
  };
  const retry = m => { setMsgs(list => list.filter(x => x.id !== m.id)); send(m.text, 1); };
  const edit = m => { setMsgs(list => list.filter(x => x.id !== m.id)); setText(m.text); input.current && input.current.focus(); };
  const undo = m => { setPlan(m.before); setMsgs(list => list.map(x => x.id === m.id ? {...x, undone:true} : x)); };
  const pick = t => { if (!busy) send(t); };
  const last = [...msgs].reverse().find(m => m.k === "change");

  const item = m => {
    if (m.k === "me") return <Bubble me>{m.text}</Bubble>;
    if (m.k === "working") return <Working/>;
    if (m.k === "problem") return (
      <Problem icon="circle-alert" tone="danger" title="Couldn't update your plan" actions={<>
        <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => retry(m)}>Try again</Button>
        <Button size="sm" variant="ghost" icon="pencil" onClick={() => edit(m)}>Edit message</Button>
      </>}>Something went wrong on our side. <b style={{fontWeight:600,color:"var(--text-primary)"}}>Your plan hasn't changed.</b></Problem>
    );
    if (m.k === "reply") return <Reply options={m.options} onPick={pick}>{m.text}</Reply>;
    return m.undone
      ? <ChangeCard undone summary="Your plan is back to how it was before this change."/>
      : <ChangeCard {...m.card} latest={m === last} onUndo={() => undo(m)}/>;
  };

  return (
    <>
      <ChatHeader sub={plan.sport + " · week 1"}/>
      <Thread live count={msgs.length ? msgs[msgs.length - 1].id : 0}>
        <Bubble>{INTRO}</Bubble>
        {msgs.length ? null : <>
          <Examples onPick={t => { setText(t); input.current && input.current.focus(); }}/>
          <Fine icon="lock">Sessions you've done always stay as they are.</Fine>
        </>}
        {msgs.map(m => (
          <div key={m.id} data-chat-motion="" style={{display:"flex",flexDirection:"column",animation:"chat-in var(--dur-slow) var(--ease-out)"}}>{item(m)}</div>
        ))}
      </Thread>
      <Composer value={text} state={busy ? "busy" : undefined} onChange={setText} onSend={() => send()} inputRef={input}/>
    </>
  );
}

/* ---------- Screens ---------- */

/* 8.1 — Opened with Adjust on an activity (screen 6): the session rides along as context. */
const FromActivity = () => (
  <>
    <ChatHeader/>
    <Thread>
      <Bubble>What would you like to change about today's walk-run intervals?</Bubble>
      <Options items={["Make it shorter","Another day","Something gentler","Swap for a walk"]}/>
    </Thread>
    <Composer value="Can I do it tomorrow instead?" focused about={TODAY}/>
  </>
);

/* 8.2 — Working. */
const Updating = () => (
  <>
    <ChatHeader/>
    <Thread>
      <Bubble>{INTRO}</Bubble>
      <Bubble me>{ASK}</Bubble>
      <Working/>
    </Thread>
    <Composer state="busy"/>
  </>
);

/* 8.3 — Applied straight away. */
const Updated = () => (
  <>
    <ChatHeader/>
    <Thread>
      <Bubble>{INTRO}</Bubble>
      <Bubble me>{ASK}</Bubble>
      <ChangeCard {...MORNINGS}/>
    </Thread>
    <Composer/>
  </>
);

/* 8.4 — Undone in place. */
const Undone = () => (
  <>
    <ChatHeader/>
    <Thread>
      <Bubble>{INTRO}</Bubble>
      <Bubble me>{ASK}</Bubble>
      <ChangeCard undone summary="Back to how it was: Friday at 18:00, for 20 minutes."/>
    </Thread>
    <Composer/>
  </>
);

/* 8.5 — A removal, then an addition. The older card loses Undo. */
const RemovedAdded = () => (
  <>
    <ChatHeader/>
    <Thread anchor="end">
      <Bubble me>Drop Friday this week, please.</Bubble>
      <ChangeCard latest={false} time="20:05" kept={null} summary="Friday is a rest day now."
        rows={[{...FRIDAY,kind:"removed"}]}/>
      <Bubble me>Actually, could I do a short walk on Saturday instead?</Bubble>
      <ChangeCard summary="Saturday has a short walk now, so the week still has three sessions."
        rows={[{kind:"added",day:"Sat",date:"10 Oct",title:"Short walk",diffs:[{icon:"clock",what:"Time",to:"7:00"},{icon:"timer",what:"Length",to:"10 min"}]}]}/>
    </Thread>
    <Composer/>
  </>
);

/* 8.6 — Sport switch on Wednesday morning: upcoming sessions swap, history stays. */
const NewSport = () => (
  <>
    <ChatHeader/>
    <Thread>
      <Bubble>{INTRO}</Bubble>
      <Bubble me>Could I switch to the gym instead?</Bubble>
      <ChangeCard summary="You're on gym now. Same days and times, with short sessions we walk you through step by step."
        sport={{icon:"dumbbell",from:"Running",to:"Gym"}}
        rows={[
          {kind:"swapped",day:"Wed",date:"Today",was:"Walk-run intervals",title:"First gym visit"},
          {...FRIDAY,kind:"swapped",was:FRIDAY.title,title:"Gym basics, slowly"},
        ]}
        kept="Monday's walk stays in your history."/>
    </Thread>
    <Composer/>
  </>
);

/* 8.7 — Partly possible, opened from Friday's activity: the valid part applies,
   the rest is explained. Sessions start between 7:00 and 21:00: a proposed rule, not in the
   current docs (README › Chat revision). */
const Partly = () => (
  <>
    <ChatHeader/>
    <Thread>
      <Bubble>What would you like to change about Friday's walk-run intervals?</Bubble>
      <Bubble me context={{icon:"footprints",label:"Fri · Walk-run intervals"}}>Can I do it on Saturday at 6 instead?</Bubble>
      <ChangeCard summary="It's on Saturday now, starting at 7:00, the earliest time we plan."
        rows={[{...FRIDAY,kind:"moved",day:"Sat",date:"10 Oct",diffs:[{icon:"calendar-days",what:"Day",from:"Fri 9",to:"Sat 10"},{icon:"clock",what:"Time",from:"18:00",to:"7:00"}]}]}
        notChanged={[{title:"7:00, not 6:00",reason:"Sessions are planned between 7:00 and 21:00."}]}/>
    </Thread>
    <Composer/>
  </>
);

/* 8.8 — History folds by day; a request that changes nothing says so. */
const NothingToChange = () => (
  <>
    <ChatHeader/>
    <Thread>
      <DayBreak>Yesterday</DayBreak>
      <Bubble me>{ASK}</Bubble>
      <PastChange time="20:14" summary="All sessions moved to 7:00. Friday is 10 minutes."/>
      <DayBreak>Today</DayBreak>
      <Bubble me>Can Friday be in the morning?</Bubble>
      <Reply>Friday is already at 7:00 since yesterday's change, so there's nothing to update.</Reply>
    </Thread>
    <Composer/>
  </>
);

/* 8.9 — A vague request gets one question with quick answers. */
const NeedsDetail = () => (
  <>
    <ChatHeader/>
    <Thread>
      <Bubble>{INTRO}</Bubble>
      <Bubble me>Make it easier.</Bubble>
      <Reply options={["Shorter sessions","Fewer days","Gentler activities"]}>Sure. What would help most?</Reply>
    </Thread>
    <Composer/>
  </>
);

/* 8.10 — Done days and sports we don't plan can't change. */
const CantChange = () => (
  <>
    <ChatHeader/>
    <Thread>
      <Bubble>{INTRO}</Bubble>
      <Bubble me>Can Monday be a run instead?</Bubble>
      <Reply options={["Today","Friday"]}>Monday is done, so it stays as you did it. Want to change an upcoming day?</Reply>
      <Bubble me>Could I try climbing?</Bubble>
      <Reply options={["Switch to gym","Keep running"]}>{OTHER_SPORT("Climbing")}</Reply>
    </Thread>
    <Composer/>
  </>
);

/* 8.11 — Pain and health conditions are out of scope: no change, no advice beyond a doctor. */
const Health = () => (
  <>
    <ChatHeader/>
    <Thread>
      <Bubble>{INTRO}</Bubble>
      <Bubble me>My knee hurts after running. Can you plan around it?</Bubble>
      <Reply options={["Pause this week","Keep my plan"]}>Sorry about your knee. Plans can't take pain or health conditions into account yet. If it keeps hurting, check with a doctor or physio. Resting is always okay.</Reply>
    </Thread>
    <Composer/>
  </>
);

/* 8.12 — A timeout, a provider failure or a result that failed validation. */
const Failed = () => (
  <>
    <ChatHeader/>
    <Thread>
      <Bubble>{INTRO}</Bubble>
      <Bubble me>{ASK}</Bubble>
      <Problem icon="circle-alert" tone="danger" title="Couldn't update your plan" actions={<>
        <Button size="sm" variant="secondary" icon="refresh-cw">Try again</Button>
        <Button size="sm" variant="ghost" icon="pencil">Edit message</Button>
      </>}>Something went wrong on our side. <b style={{fontWeight:600,color:"var(--text-primary)"}}>Your plan hasn't changed.</b></Problem>
    </Thread>
    <Composer/>
  </>
);

/* 8.13 — The plan changed elsewhere while this request ran: a stale result never overwrites it. */
const ChangedElsewhere = () => (
  <>
    <ChatHeader/>
    <Thread>
      <Bubble>{INTRO}</Bubble>
      <Bubble me>Move Friday to Saturday, please.</Bubble>
      <Problem icon="history" tone="info" title="Plan changed meanwhile" actions={<>
        <Button size="sm" variant="secondary" icon="refresh-cw">Try again</Button>
        <Button size="sm" variant="ghost" iconRight="arrow-right">See week</Button>
      </>}>Your plan was updated somewhere else while we worked on this, so <b style={{fontWeight:600,color:"var(--text-primary)"}}>nothing was overwritten.</b> Try again to use the latest version.</Problem>
    </Thread>
    <Composer/>
  </>
);

/* 8.14 — Offline: the message waits, unsent. */
const Offline = () => (
  <>
    <ChatHeader/>
    <Thread>
      <Bubble>{INTRO}</Bubble>
      <Bubble me foot={<Fine icon="circle-alert" tone="danger" align="end">Not sent · Tap to retry</Fine>}>Move Friday to Saturday, please.</Bubble>
    </Thread>
    <Composer state="offline"/>
  </>
);

/* 8.15 — Guest demo: the visitor's own seeded plan, a few AI changes. Matches Home 5.15. */
const Guest = () => (
  <>
    <ChatHeader sub="Guest demo"/>
    <Thread>
      <Bubble>This is your own demo plan, so try anything. Changes here don't affect anyone else.</Bubble>
      <Bubble me>Make Friday shorter.</Bubble>
      <ChangeCard summary="Friday is 10 minutes now." rows={[{...FRIDAY,diffs:[{icon:"timer",what:"Length",from:"20 min",to:"10 min"}],note:"Three runs instead of six."}]}/>
    </Thread>
    <Composer top={<Fine icon="info" align="center">Guest demo · 2 of 3 changes left</Fine>}/>
  </>
);

/* 8.16 — Guest demo limit reached. */
const GuestLimit = () => (
  <>
    <ChatHeader sub="Guest demo"/>
    <Thread anchor="end">
      <Bubble me>Make Friday shorter.</Bubble>
      <ChangeCard latest={false} time="9:20" kept={null} summary="Friday is 10 minutes now." rows={[{...FRIDAY,diffs:[{icon:"timer",what:"Length",from:"20 min",to:"10 min"}]}]}/>
      <Bubble me>And move it to the morning.</Bubble>
      <ChangeCard summary="Friday is a morning session now." rows={[{...FRIDAY,diffs:[{icon:"clock",what:"Time",from:"18:00",to:"7:00"}]}]}/>
    </Thread>
    <DemoLimit/>
  </>
);

window.CHAT_SCREENS = [
  {id:"chat",label:"8 · Chat: start",C:Start,note:"Clickable: tap an example or type, then send. Try “mornings”, “shorter”, “gym”, “climbing”, “my knee hurts” or “fail”, and Undo."},
  {id:"chat-activity",label:"8.1 · Chat: from an activity",C:FromActivity,note:"From Adjust (6) or “Ask in chat” on Not today (5.2). The session rides along; quick replies send at once."},
  {id:"chat-updating",label:"8.2 · Chat: updating",C:Updating,note:"One change at a time. The plan in use stays active until the new one passes validation."},
  {id:"chat-updated",label:"8.3 · Chat: plan updated",C:Updated,note:"Applied at once, no confirm step. Old values struck through, new ones bold. See week opens Home 5.4."},
  {id:"chat-undone",label:"8.4 · Chat: undone",C:Undone,note:"Undo saves the previous plan as a new version. Only the newest change offers Undo."},
  {id:"chat-removed",label:"8.5 · Chat: removed and added",C:RemovedAdded,note:"One row per session. Removed and new sessions carry a label, not just a colour. The older card loses Undo."},
  {id:"chat-sport",label:"8.6 · Chat: new sport",C:NewSport,note:"A sport switch swaps upcoming sessions only. Done sessions stay in history."},
  {id:"chat-partly",label:"8.7 · Chat: partly possible",C:Partly,note:"The day column shows where a session is now. What couldn't change is listed with a reason, never dropped silently."},
  {id:"chat-nothing",label:"8.8 · Chat: nothing to change",C:NothingToChange,note:"Earlier changes fold by day. A request that changes nothing says so."},
  {id:"chat-detail",label:"8.9 · Chat: needs a detail",C:NeedsDetail,note:"Vague asks get one question with quick answers. The plan stays as it is until one is picked."},
  {id:"chat-cant",label:"8.10 · Chat: can't change that",C:CantChange,note:"Done days are locked. Sports we don't plan get a plain no, with the four we do offered instead."},
  {id:"chat-health",label:"8.11 · Chat: health and pain",C:Health,note:"Illness-specific changes are deferred: no plan change and no advice beyond seeing a doctor."},
  {id:"chat-failed",label:"8.12 · Chat: didn't work",C:Failed,note:"Timeouts and invalid results leave the plan untouched. Try again resends the same message."},
  {id:"chat-stale",label:"8.13 · Chat: changed elsewhere",C:ChangedElsewhere,note:"A stale request never overwrites a newer plan. Try again runs on the latest version."},
  {id:"chat-offline",label:"8.14 · Chat: offline",C:Offline,note:"The message stays in the thread with Retry. Nothing is lost or half-applied."},
  {id:"chat-guest",label:"8.15 · Chat: guest demo",C:Guest,note:"Guests change only their own seeded demo plan. A counter shows what's left; Undo doesn't count."},
  {id:"chat-guest-limit",label:"8.16 · Chat: demo limit reached",C:GuestLimit,note:"At the limit the message box gives way to a clear next step."},
];
})();
