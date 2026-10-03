const { Icon, Button, IconButton, Badge, Tag, Card, Input, Radio, SuggestionCard, ExerciseRow, ProgressRing } = window.DS;

/* height="auto" draws the whole scroll, with a dashed fold line at the 844 viewport edge. */
function Phone({theme,height=844,children}){
  const full=height==="auto";
  const phone=(
    <div data-theme={theme} style={{width:390,height:full?"auto":height,minHeight:844,borderRadius:48,background:"var(--bg-app)",color:"var(--text-primary)",position:"relative",overflow:"hidden",boxShadow:theme==="dark"?"0 0 0 1px #2F2A25, 0 30px 60px -20px rgba(0,0,0,.5)":"0 0 0 1px #E4DCCF, 0 30px 60px -20px rgba(60,42,20,.25)",flex:"none",display:"flex",flexDirection:"column",font:"var(--type-body)"}}>
      <div style={{height:50,flex:"none",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 30px 0 34px",font:"600 15px/1 var(--font-body)"}}>
        <span>9:41</span>
        <span style={{display:"flex",gap:6,alignItems:"center"}}><Icon name="signal" size={16} strokeWidth={2}/><Icon name="wifi" size={16} strokeWidth={2}/><Icon name="battery-full" size={20} strokeWidth={1.75}/></span>
      </div>
      {children}
    </div>
  );
  return full?<div style={{position:"relative",flex:"none"}}>{phone}<Fold/></div>:phone;
}
function Fold(){
  return (
    <div aria-hidden="true" style={{position:"absolute",left:0,right:0,top:844,borderTop:"1.5px dashed var(--accent)",pointerEvents:"none",zIndex:20}}>
      <span style={{position:"absolute",left:"100%",top:-10,marginLeft:6,padding:"2px 7px",borderRadius:99,background:"var(--accent)",color:"var(--text-on-accent)",font:"600 11px/1.3 var(--font-body)"}}>Fold</span>
    </div>
  );
}

const H1 = ({children,style}) => <h1 style={{font:"var(--type-title)",letterSpacing:"var(--tracking-display)",margin:0,textWrap:"pretty",...style}}>{children}</h1>;
const Kicker = ({children}) => <span style={{font:"var(--type-label)",color:"var(--text-tertiary)"}}>{children}</span>;
const Body = ({children,style}) => <p style={{font:"var(--type-body)",color:"var(--text-secondary)",margin:0,textWrap:"pretty",...style}}>{children}</p>;
const Section = ({children}) => <span style={{font:"var(--type-section)",letterSpacing:"var(--tracking-tight)"}}>{children}</span>;
const Col = ({gap=12,children,style}) => <div style={{display:"flex",flexDirection:"column",gap,...style}}>{children}</div>;
const Row = ({gap=12,children,style}) => <div style={{display:"flex",alignItems:"center",gap,...style}}>{children}</div>;

function TopBar({left,right,title}){
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",minHeight:44}}>
      <div style={{width:44}}>{left}</div>
      {title?<span style={{font:"var(--type-subheading)"}}>{title}</span>:null}
      <div style={{width:44,display:"flex",justifyContent:"flex-end"}}>{right}</div>
    </div>
  );
}
function Content({children,gap=24,pb=160}){
  return <div style={{padding:`8px var(--gutter-screen) ${pb}px`,display:"flex",flexDirection:"column",gap,flex:1,minHeight:0}}>{children}</div>;
}
function BottomBar({children}){
  return <div style={{position:"absolute",left:0,right:0,bottom:0,padding:"20px var(--gutter-screen) 34px",background:"linear-gradient(to top, var(--bg-app) 70%, transparent)",display:"flex",gap:8}}>{children}</div>;
}
function Steps({step,total=4}){
  return <Row gap={6}>{Array.from({length:total},(_,i)=><span key={i} style={{height:4,flex:1,borderRadius:99,background:i<step?"var(--accent)":"var(--border-subtle)"}}></span>)}</Row>;
}

/* 1 — Welcome / sign in */
function Welcome(){
  return (
    <Content gap={20} pb={34}>
      <span style={{font:"600 22px/1 var(--font-display)",letterSpacing:"var(--tracking-display)",padding:"10px 0 4px"}}>Adaptive</span>
      <SuggestionCard tone="dawn" kicker="New here?" title="Find a sport you'll keep." body="A few questions, then a gentle first week. Everyone starts somewhere."/>
      <Col gap={14}>
        <Input label="Email" type="email" placeholder="you@example.com" hint="We'll sign you in, or set up a new account if it's your first time."/>
      </Col>
      <Col gap={10}>
        <Button size="lg" fullWidth iconRight="arrow-right">Continue</Button>
        <Row gap={12} style={{padding:"4px 0"}}><span style={{flex:1,height:1,background:"var(--border-subtle)"}}></span><span style={{font:"var(--type-caption)",color:"var(--text-tertiary)"}}>or</span><span style={{flex:1,height:1,background:"var(--border-subtle)"}}></span></Row>
        <Button size="lg" fullWidth variant="secondary"><GoogleMark/>Continue with Google</Button>
      </Col>
      <span style={{font:"var(--type-caption)",color:"var(--text-tertiary)",textAlign:"center",textWrap:"pretty"}}>By continuing you agree to the <a href="#">terms</a> and <a href="#">privacy policy</a>.</span>
    </Content>
  );
}
function GoogleMark(){
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" style={{marginRight:8,flex:"none"}}><path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.5 13.6 17.8 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.1 7-10.2 7-17.6z"></path><path fill="#FBBC05" d="M10.6 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-8-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l8-6.2z"></path><path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.7l-7.6-5.9c-2.1 1.4-4.8 2.3-7.9 2.3-6.2 0-11.5-4.1-13.4-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z"></path></svg>;
}

/* 2–4 — Questionnaire, preferences and review: onboarding.jsx */

/* 5 — Home, the Today tab, and its states 5.1–5.15: home.jsx */

/* Floating glass pill nav: the active tab widens and shows its label. */
const NAV_ITEMS=[{value:"today",label:"Today",icon:"sun"},{value:"plan",label:"Plan",icon:"calendar"},{value:"you",label:"You",icon:"user-round"}];
function NavBar({value}){
  return (
    <nav aria-label="Main" style={{position:"absolute",left:20,right:20,bottom:24,height:64,borderRadius:99,background:"color-mix(in oklch, var(--surface-raised) 72%, transparent)",backdropFilter:"var(--blur-bar)",WebkitBackdropFilter:"var(--blur-bar)",border:"1px solid color-mix(in oklch, var(--border-subtle) 80%, transparent)",display:"flex",alignItems:"center",padding:6,gap:4,boxShadow:"var(--shadow-2), inset 0 1px 0 color-mix(in oklch, var(--surface-raised) 60%, transparent)"}}>
      {NAV_ITEMS.map(it=>{const a=it.value===value;return (
        <button key={it.value} aria-label={it.label} title={it.label} aria-current={a?"page":undefined} style={{flex:a?1.5:1,height:52,background:a?"color-mix(in oklch, var(--text-primary) 7%, transparent)":"transparent",border:0,borderRadius:99,padding:"0 12px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:a?"var(--text-primary)":"var(--text-tertiary)",boxShadow:a?"inset 0 1px 0 color-mix(in oklch, var(--surface-raised) 70%, transparent), inset 0 0 0 1px color-mix(in oklch, var(--text-primary) 5%, transparent)":"none",transition:"all var(--dur-base) var(--ease-out)"}}>
          <Icon name={it.icon} size={22} strokeWidth={a?2:1.75}/>
          {a?<span style={{font:"600 14px/1 var(--font-body)"}}>{it.label}</span>:null}
        </button>);})}
    </nav>
  );
}
/* 6 — Activity detail */
function Activity(){
  return (
    <>
      <TopBar left={<IconButton icon="arrow-left" label="Back"/>} right={<IconButton icon="ellipsis" label="More"/>}/>
      <Content gap={16}>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:12}}>
          <Col gap={6}><Kicker>Wednesday · 24 min</Kicker><H1>Walk-run intervals</H1></Col>
          <ProgressRing value={0} size={52} label="0/3"/>
        </div>
        <SuggestionCard tone="dusk" kicker="Coach tip" title="Talk-pace is the pace." body="Slow enough to say a sentence. Stopping early still counts."/>
        <Col gap={0}>
          <Section>Today</Section>
          <ExerciseRow media name="Brisk walk" detail="5 min" meta="warm-up" divider/>
          <ExerciseRow media name="Run, then walk" detail="6 × 90 s run · 1 min walk" meta="14 min" divider/>
          <ExerciseRow media name="Slow walk" detail="5 min" meta="cool-down"/>
        </Col>
      </Content>
      <BottomBar>
        <Button variant="secondary" size="lg">Adjust</Button>
        <Button size="lg" fullWidth iconRight="arrow-right" style={{flex:1}}>Start</Button>
      </BottomBar>
    </>
  );
}

/* 7 — Completion & feedback */
function Feedback(){
  return (
    <>
      <TopBar left={<span></span>} right={<IconButton icon="x" label="Close"/>}/>
      <Content gap={24}>
        <Row gap={16}>
          <ProgressRing value={2/3} size={64} label="2/3"/>
          <Col gap={4}><Kicker>Wednesday done · 24 min</Kicker><H1>Nice and steady.</H1></Col>
        </Row>
        <Col gap={12}>
          <Section>How did it feel?</Section>
          <Col gap={8}>
            <Radio variant="card" label="Easy" description="Could have kept going"/>
            <Radio variant="card" checked label="Just right" description="Tired, but good"/>
            <Radio variant="card" label="Hard" description="Needed every walk break"/>
            <Radio variant="card" label="Too much" description="Had to stop early"/>
          </Col>
        </Col>
        <Input label="Anything to note (optional)" placeholder="Shoes, weather, how your legs feel…"/>
      </Content>
      <BottomBar><Button size="lg" fullWidth iconRight="check">Save</Button></BottomBar>
    </>
  );
}

/* 8 — Chat plan revision and its states 8.1–8.16: chat.jsx */

const SCREENS=[
  {id:"welcome",label:"1 · Sign in",C:Welcome},
  ...ONBOARDING_SCREENS, // 2–4, questionnaire, preferences and review (onboarding.jsx)
  ...HOME_SCREENS, // 5–5.15, the Today tab in every state (home.jsx)
  {id:"activity",label:"6 · Activity",C:Activity},
  ...WORKOUT_SCREENS, // 6.1–6.9, in-workout tracking (workout.jsx)
  {id:"feedback",label:"7 · Completion & feedback",C:Feedback},
  ...CHAT_SCREENS, // 8–8.16, chat plan revision in every state (chat.jsx)
  ...PROFILE_SCREENS, // 9–9.6, the You tab: answers, summary, feedback, privacy (profile.jsx)
];
Object.assign(window,{Phone,SCREENS});
