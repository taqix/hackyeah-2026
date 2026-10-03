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

/* 1 — Welcome: create an account or sign in with email and password, or look around as a
   guest in one tap (docs/product.md › Accounts and guest demo). The guest button creates a
   separate anonymous account with a seeded sample week (Home 5.15). */
function Welcome({mode="create",error}){
  const create=mode==="create";
  return (
    <Content gap={16} pb={34}>
      <span style={{font:"600 22px/1 var(--font-display)",letterSpacing:"var(--tracking-display)",padding:"10px 0 2px"}}>Adaptive</span>
      <SuggestionCard tone="dawn" style={{minHeight:188}} kicker={create?"New here?":"Welcome back"} title={create?"Find a way to move you'll keep.":"Good to see you again."} body={create?"A few questions, then a gentle first week. Everyone starts somewhere.":"Sign in to see your week."}/>
      <Col gap={12}>
        <Input label="Email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" defaultValue={error?"ana@example.com":undefined}/>
        <Input label="Password" type="password" autoComplete={create?"new-password":"current-password"} defaultValue={error?"walkrun01":undefined}
          hint={create?"At least 8 characters.":undefined} error={error}
          suffix={<button type="button" aria-label="Show password" style={{width:44,height:44,marginRight:-12,border:0,background:"transparent",color:"var(--text-secondary)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0}}><Icon name="eye" size={20}/></button>}/>
      </Col>
      <Col gap={4}>
        <Button size="lg" fullWidth>{create?"Create account":"Sign in"}</Button>
        <Row gap={4} style={{justifyContent:"center",flexWrap:"wrap"}}>
          <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)"}}>{create?"Have an account?":"New here?"}</span>
          <Button variant="ghost" size="sm" style={{height:44,padding:"0 8px"}}>{create?"Sign in":"Create an account"}</Button>
          {create?null:<><span aria-hidden="true" style={{color:"var(--text-tertiary)"}}>·</span><Button variant="ghost" size="sm" style={{height:44,padding:"0 8px"}}>Forgot password?</Button></>}
        </Row>
      </Col>
      <Row gap={12}><span style={{flex:1,height:1,background:"var(--border-subtle)"}}></span><span style={{font:"var(--type-caption)",color:"var(--text-secondary)"}}>or</span><span style={{flex:1,height:1,background:"var(--border-subtle)"}}></span></Row>
      <Col gap={8}>
        <Button size="lg" fullWidth variant="secondary" icon="compass">Look around as a guest</Button>
        <span style={{font:"var(--type-caption)",color:"var(--text-secondary)",textAlign:"center",textWrap:"pretty"}}>A sample week that's yours alone. No email needed. By continuing you agree to the <a href="#">terms</a> and <a href="#">privacy policy</a>.</span>
      </Col>
    </Content>
  );
}
const SignInError = () => <Welcome mode="signin" error="That email and password don't match. Try again, or reset your password."/>;

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
          <Col gap={6}><Kicker>Today · 7:00 · 20 min</Kicker><H1>Walk-run intervals</H1></Col>
        </div>
        <SuggestionCard tone="dusk" kicker="Coach tip" title="Talk-pace is the pace." body="Slow enough to say a sentence. Stopping early still counts."/>
        <Col gap={0}>
          <Section>Today</Section>
          <ExerciseRow media mediaIcon="footprints" name="Brisk walk" detail="4 min" meta="warm-up" divider/>
          <ExerciseRow media mediaIcon="wind" name="Run, then walk" detail="6 × 1 min run · 1 min walk" meta="12 min" divider/>
          <ExerciseRow media mediaIcon="footprints" name="Slow walk" detail="4 min" meta="cool-down"/>
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
          <div role="img" aria-label="2 of 3 sessions done this week"><ProgressRing value={2/3} size={64} label="2/3"/></div>
          <Col gap={4}><Kicker>Wednesday · 20 min · 2 of 3 this week</Kicker><H1>Nice and steady.</H1></Col>
        </Row>
        <Col gap={12}>
          <Section>How did it feel?</Section>
          <div role="radiogroup" aria-label="How did it feel?" style={{display:"flex",flexDirection:"column",gap:8}}>
            <Radio variant="card" label="Easy" description="Could have kept going"/>
            <Radio variant="card" checked label="Just right" description="Tired, but good"/>
            <Radio variant="card" label="Hard" description="Needed every walk break"/>
            <Radio variant="card" label="Too much" description="Had to stop early"/>
          </div>
        </Col>
        <Input label="Anything to note (optional)" placeholder="Shoes, weather, how your legs feel…"/>
      </Content>
      <BottomBar><Button size="lg" fullWidth iconRight="check">Save</Button></BottomBar>
    </>
  );
}

/* 8 — Chat plan revision and its states 8.1–8.16: chat.jsx */

const SCREENS=[
  {id:"welcome",label:"1 · Welcome",C:Welcome,note:"Email and password, or a guest demo in one tap."},
  {id:"sign-in-error",label:"1.1 · Sign in: no match",C:SignInError},
  ...ONBOARDING_SCREENS, // 2–4, questionnaire, preferences and review (onboarding.jsx)
  ...HOME_SCREENS, // 5–5.15, the Today tab in every state (home.jsx)
  {id:"activity",label:"6 · Activity",C:Activity},
  ...WORKOUT_SCREENS, // 6.1–6.9, in-workout tracking (workout.jsx)
  {id:"feedback",label:"7 · Completion & feedback",C:Feedback},
  ...CHAT_SCREENS, // 8–8.16, chat plan revision in every state (chat.jsx)
  ...PROFILE_SCREENS, // 9–9.6, the You tab: answers, summary, feedback, privacy (profile.jsx)
  ...PLAN_SCREENS, // 10–10.1, the Plan tab: the week in full and its versions (plan.jsx)
  ...(window.LOG_SCREENS||[]), // 11–11B.6, add a workout: form (A) and chat (B) variants (log.jsx)
];
Object.assign(window,{Phone,SCREENS});
