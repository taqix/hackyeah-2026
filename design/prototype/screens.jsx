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

/* "Good morning" until noon, "Good afternoon" until 18:00, then "Good evening". */
const greeting=(hour=9)=>hour>=5&&hour<12?"Good morning":hour>=12&&hour<18?"Good afternoon":"Good evening";

/* 1 — Welcome: Continue with Google, or with an email address (review, 3 October). One email
   field for everyone: the app checks for an account, then asks for its password (1.1) or for
   a new one (1.2). Supabase Auth covers both. Mobile has no guest entry; the web demo keeps it.
   The Google mark is the one brand asset on the screen, as Google's sign-in rules require. */
function GoogleMark({size=20}){
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{flex:"none",display:"block"}}>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
    </svg>
  );
}
const Brand = () => <span style={{font:"600 22px/1 var(--font-display)",letterSpacing:"var(--tracking-display)",padding:"10px 0 2px"}}>Adaptive</span>;
const Legal = ({children}) => <span style={{font:"var(--type-caption)",color:"var(--text-secondary)",textAlign:"center",textWrap:"pretty"}}>{children}</span>;
function Welcome(){
  return (
    <Content gap={16} pb={34}>
      <Brand/>
      <SuggestionCard tone="dawn" style={{minHeight:216}} kicker="Welcome" title="Find a way to move you'll keep." body="A few questions, then a gentle first week. Everyone starts somewhere."/>
      <Button size="lg" fullWidth variant="secondary"><GoogleMark/>Continue with Google</Button>
      <Row gap={12}><span style={{flex:1,height:1,background:"var(--border-subtle)"}}></span><span style={{font:"var(--type-caption)",color:"var(--text-secondary)"}}>or</span><span style={{flex:1,height:1,background:"var(--border-subtle)"}}></span></Row>
      <Col gap={12}>
        <Input label="Email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"/>
        <Button size="lg" fullWidth iconRight="arrow-right">Continue with email</Button>
      </Col>
      <Legal>We'll sign you in, or set up your account if you're new. By continuing you agree to the <a href="#">terms</a> and <a href="#">privacy policy</a>.</Legal>
    </Content>
  );
}
/* 1.1–1.3 — The password step after an email. `known`: an account exists (sign in) or not
   (create one). The email is shown with a way back to change it. */
function PasswordStep({known,error}){
  return (
    <>
      <TopBar left={<IconButton icon="arrow-left" label="Back"/>}/>
      <Content gap={20} pb={34}>
        <Col gap={8}>
          <H1>{known?"Welcome back":"Create your account"}</H1>
          <Body>{known?"Enter the password for this account.":"No account uses this email yet. Pick a password to set one up."}</Body>
        </Col>
        <Row gap={12} style={{padding:"8px 8px 8px 14px",borderRadius:"var(--radius-md)",background:"var(--surface-sunken)"}}>
          <Icon name="mail" size={18} color="var(--text-secondary)"/>
          <span style={{flex:1,minWidth:0,font:"500 var(--text-base)/1.3 var(--font-body)"}}>ana@example.com</span>
          <Button variant="ghost" size="sm" style={{height:44}}>Change</Button>
        </Row>
        <Input label={known?"Password":"New password"} type="password" autoComplete={known?"current-password":"new-password"} defaultValue={error?"walkrun01":undefined}
          hint={known?undefined:"At least 8 characters."} error={error}
          suffix={<button type="button" aria-label="Show password" style={{width:44,height:44,marginRight:-12,border:0,background:"transparent",color:"var(--text-secondary)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0}}><Icon name="eye" size={20}/></button>}/>
        <Col gap={4}>
          <Button size="lg" fullWidth>{known?"Sign in":"Create account"}</Button>
          {known?<Button variant="ghost" size="sm" style={{height:44,alignSelf:"center"}}>Forgot password?</Button>:null}
        </Col>
        {known?null:<Legal>By creating an account you agree to the <a href="#">terms</a> and <a href="#">privacy policy</a>.</Legal>}
      </Content>
    </>
  );
}
const SignIn = () => <PasswordStep known/>;
const SignUp = () => <PasswordStep/>;
const SignInError = () => <PasswordStep known error="That password doesn't match. Try again, or reset it."/>;

/* 2–4 — Questionnaire, preferences and review: onboarding.jsx */

/* 5 — Home, the Today tab, and its states: home.jsx */

/* Floating glass pill nav: the active tab widens and shows its label.
   Chat placement waits on a UX test (review, 3 October), so both variants are drawn:
     tab     Today · Calendar · Chat · You. Chat is a tab like the others: its screen keeps
             the bar, with the message box above it. You stays last.
     button  Today · Calendar · You, and chat as a dark round button beside the shorter bar.
             Chat opens full screen over the current tab; its back arrow returns there.
   The board shows one variant everywhere (?chat=tab|button, tab by default) and both side
   by side in the "nav" flow. NavVariant overrides it for one frame. */
const CHAT_NAV=new URLSearchParams(location.search).get("chat")==="button"?"button":"tab";
const NavVariant=React.createContext(null);
const useChatNav=()=>React.useContext(NavVariant)||CHAT_NAV;
const NAV_ITEMS=[{value:"today",label:"Today",icon:"sun"},{value:"calendar",label:"Calendar",icon:"calendar"},{value:"chat",label:"Chat",icon:"message-circle"},{value:"you",label:"You",icon:"user-round"}];
function NavBar({value}){
  const variant=useChatNav();
  const items=variant==="button"?NAV_ITEMS.filter(it=>it.value!=="chat"):NAV_ITEMS;
  return (
    <>
      <nav aria-label="Main" style={{position:"absolute",left:20,right:variant==="button"?94:20,bottom:24,height:64,borderRadius:99,background:"color-mix(in oklch, var(--surface-raised) 72%, transparent)",backdropFilter:"var(--blur-bar)",WebkitBackdropFilter:"var(--blur-bar)",border:"1px solid color-mix(in oklch, var(--border-subtle) 80%, transparent)",display:"flex",alignItems:"center",padding:6,gap:4,boxShadow:"var(--shadow-2), inset 0 1px 0 color-mix(in oklch, var(--surface-raised) 60%, transparent)",zIndex:4}}>
        {items.map(it=>{const a=it.value===value;return (
          <button key={it.value} aria-label={it.label} title={it.label} aria-current={a?"page":undefined} style={{flex:a?2:1,minWidth:0,height:52,background:a?"color-mix(in oklch, var(--text-primary) 7%, transparent)":"transparent",border:0,borderRadius:99,padding:"0 12px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:a?"var(--text-primary)":"var(--text-tertiary)",boxShadow:a?"inset 0 1px 0 color-mix(in oklch, var(--surface-raised) 70%, transparent), inset 0 0 0 1px color-mix(in oklch, var(--text-primary) 5%, transparent)":"none",transition:"all var(--dur-base) var(--ease-out)"}}>
            <Icon name={it.icon} size={22} strokeWidth={a?2:1.75}/>
            {a?<span style={{font:"600 14px/1 var(--font-body)"}}>{it.label}</span>:null}
          </button>);})}
      </nav>
      {variant==="button"?<ChatButton/>:null}
    </>
  );
}
/* Variant B: the chat button sits level with the bar, solid and darker so it reads as the
   main way to change anything. */
function ChatButton(){
  return (
    <button type="button" aria-label="Chat" title="Chat" style={{position:"absolute",right:20,bottom:24,width:64,height:64,zIndex:4,borderRadius:99,border:0,background:"var(--surface-inverse)",color:"var(--text-inverse)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"var(--shadow-2)",cursor:"pointer",padding:0}}>
      <Icon name="message-circle" size={24} strokeWidth={2}/>
    </button>
  );
}

/* 6 — Activity: what the session holds, from the plan. Only gym sessions are tracked live
   (6.3–6.8, Start). Everything else is done the person's own way, with a watch or without,
   and logged afterwards (6.2, Log it). */
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
        <Row gap={10} style={{alignItems:"flex-start"}}>
          <Icon name="watch" size={16} color="var(--text-secondary)" style={{marginTop:2}}/>
          <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)",textWrap:"pretty"}}>Go with a watch, a timer or nothing at all. Log it when you're back.</span>
        </Row>
      </Content>
      <BottomBar>
        <Button variant="secondary" size="lg">Adjust</Button>
        <Button size="lg" fullWidth iconRight="check" style={{flex:1}}>Log it</Button>
      </BottomBar>
    </>
  );
}

/* 7 — Completion & feedback. Notes go into the description our assistant keeps of the
   person, which the planner reads (review, 3 October). */
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
        <Input label="Anything to note (optional)" placeholder="Shoes, weather, how your legs feel…" hint="Our assistant reads notes when it plans your next weeks."/>
      </Content>
      <BottomBar><Button size="lg" fullWidth iconRight="check">Save</Button></BottomBar>
    </>
  );
}

/* 8 — Chat and its states: chat.jsx */

/* Chat placement, A and B side by side: Home 5 and chat 8.3 in each variant. */
const inVariant=(variant,id)=>()=>{const s=SCREENS.find(x=>x.id===id);return <NavVariant.Provider value={variant}><s.C/></NavVariant.Provider>;};
const NAV_SCREENS=[
  {id:"nav-tab-home",label:"A · Chat as a tab · Today",C:inVariant("tab","home"),h:"auto",note:"Four tabs, You last. Chat is a peer of Today and Calendar."},
  {id:"nav-tab-chat",label:"A · Chat as a tab · Chat",C:inVariant("tab","chat-updated"),note:"The bar stays on the chat tab; the message box sits above it."},
  {id:"nav-button-home",label:"B · Chat button · Today",C:inVariant("button","home"),h:"auto",note:"A shorter bar and a dark chat button level with it, reachable from every tab."},
  {id:"nav-button-chat",label:"B · Chat button · Chat",C:inVariant("button","chat-updated"),note:"Chat opens full screen over the tab; back returns there."},
];

const SCREENS=[
  {id:"welcome",label:"1 · Welcome",C:Welcome,note:"Google in one tap, or one email field: we sign you in or set the account up. No guest entry on mobile."},
  {id:"sign-in",label:"1.1 · Email: account found",C:SignIn},
  {id:"sign-up",label:"1.2 · Email: new account",C:SignUp},
  {id:"sign-in-error",label:"1.3 · Sign in: wrong password",C:SignInError},
  ...ONBOARDING_SCREENS, // 2–4, questionnaire, preferences and review (onboarding.jsx)
  ...HOME_SCREENS, // 5–5.12, the Today tab in every state (home.jsx)
  {id:"activity",label:"6 · Activity",C:Activity,note:"Not a gym session, so nothing runs live: Log it opens 6.2 when you're back."},
  ...WORKOUT_SCREENS, // 6.2–6.8, logging afterwards and guided gym sessions (workout.jsx)
  {id:"feedback",label:"7 · Completion & feedback",C:Feedback},
  ...CHAT_SCREENS, // 8–8.16, chat: plan changes, missed sessions, workouts done (chat.jsx)
  ...PROFILE_SCREENS, // 9–9.7, the You tab: answers, summary, feedback, settings, privacy (profile.jsx)
  ...CALENDAR_SCREENS, // 10–10.1, the Calendar tab: sessions by day and the plan's versions (calendar.jsx)
  ...NAV_SCREENS, // chat placement, variants A and B
];
Object.assign(window,{Phone,SCREENS,NavBar,NavVariant,useChatNav,greeting});
