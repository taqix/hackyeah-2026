/* Profile — the You tab, screens 9–9.6 (see README › Profile).
   One question: what do I prefer, and how does the app see me? Three layers, kept apart:
     answers    the person's own choices; only they change them    PREFERENCES.md fields
     feedback   "Would you choose this again?" per session,         proposed (no doc yet),
                and whole activities they switched off             excluded_activity_types
     summary    our assistant's description of the two above.      Never the record:
                Every statement names its source                   rebuilt from the layers
   The feedback answer and the summary go beyond the current docs: the plan contract takes
   only answers and free time slots (README › Profile › Not decided yet).
   Answers are edited with the onboarding questions themselves (9.4): same pieces, same
   PREF_OPTIONS labels, edit chrome instead of steps. Answers live on the server, one JSON
   per person, so a new phone keeps them. Ana's sessions follow home.jsx.
   3 October review: profile and settings are separate. The gear opens Settings (9.6):
   appearance, account, legal and sign out; Data and privacy (9.7) sits under it.
   Loaded before screens.jsx and wrapped in a function so its names stay local.
   Layout helpers (TopBar, Content, BottomBar, NavBar, Col, Row, H1, Kicker, Body, Section),
   Sheet (workout.jsx) and the choice pieces (TimeQuestions, Segmented from onboarding.jsx)
   resolve at render time. Registers window.PROFILE_SCREENS. */
(() => {
const { Icon, Button, IconButton, Card, SuggestionCard } = window.DS;

/* Ana on Wednesday 21 October 2026, week 3, in the stored shape (same as onboarding's SAMPLE_PREFS). */
const ANA={
  timezone:"Europe/Warsaw", starting_comfort:"starting_out", sessions_per_week:3, session_minutes:20,
  activity_interests:["walking","running"], available_locations:["outdoors","home"],
  available_equipment:[], preferred_window:[7,11], discovery_preference:"occasional",
  avoidances:["jumping"], starting_obstacles:["time"], excluded_activity_types:[],
};

const CAPTION={font:"var(--type-caption)",color:"var(--text-tertiary)",textWrap:"pretty"};
const ROW_BUTTON={display:"flex",alignItems:"center",width:"100%",border:0,background:"transparent",color:"inherit",font:"inherit",textAlign:"left",cursor:"pointer"};
const Caption=({children,style})=><span style={{...CAPTION,...style}}>{children}</span>;

/* ---------- Profile pieces ---------- */

/* Round icon shared by every profile row; `tone` picks the soft background. */
function Disc({icon,tone="accent",size=40}){
  const [bg,fg]={accent:["var(--accent-soft)","var(--accent-text)"],success:["var(--success-soft)","var(--success)"],muted:["var(--surface-sunken)","var(--text-tertiary)"]}[tone];
  return <span style={{width:size,height:size,flex:"none",borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:bg,color:fg}}><Icon name={icon} size={Math.round(size/2)}/></span>;
}

/* One group of answers, as on the onboarding review; opens that question in edit mode (9.4). */
function PrefRow({icon,title,value,divider}){
  return (
    <button type="button" style={{...ROW_BUTTON,gap:14,minHeight:52,padding:"6px 0",borderTop:divider?"1px solid var(--border-subtle)":"none"}}>
      <Disc icon={icon}/>
      <Col gap={2} style={{flex:1,minWidth:0}}>
        <span style={{font:"600 var(--text-base)/1.3 var(--font-body)"}}>{title}</span>
        <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)"}}>{value}</span>
      </Col>
      <Icon name="chevron-right" size={18} color="var(--text-tertiary)"/>
    </button>
  );
}

/* One statement of the summary. Its source is plain text; the row opens 9.3. */
function Statement({children,source,icon="list-checks",divider}){
  return (
    <button type="button" style={{...ROW_BUTTON,gap:12,padding:"12px 0",borderTop:divider?"1px solid var(--border-subtle)":"none"}}>
      <Col gap={6} style={{flex:1,minWidth:0}}>
        <span style={{font:"var(--type-body)",color:"var(--text-primary)",textWrap:"pretty"}}>{children}</span>
        <Row gap={6}><Icon name={icon} size={14} color="var(--text-tertiary)"/><Caption>{source}</Caption></Row>
      </Col>
      <Icon name="chevron-right" size={18} color="var(--text-tertiary)"/>
    </button>
  );
}

/* A stored fact behind a statement: a dated session and the answer given after it. */
function Evidence({title,detail,divider}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:12,minHeight:56,borderTop:divider?"1px solid var(--border-subtle)":"none"}}>
      <Disc icon="check" tone="success" size={32}/>
      <Col gap={2} style={{flex:1,minWidth:0}}>
        <span style={{font:"600 15px/1.3 var(--font-body)"}}>{title}</span>
        <Caption style={{color:"var(--text-secondary)"}}>{detail}</Caption>
      </Col>
    </div>
  );
}

/* A session card, activity or connection with an optional action on the right. */
function ItemRow({icon,name,meta,action,tone,divider}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:14,minHeight:60,padding:"8px 0",borderTop:divider?"1px solid var(--border-subtle)":"none"}}>
      <Disc icon={icon} tone={tone} size={36}/>
      <Col gap={2} style={{flex:1,minWidth:0}}>
        <span style={{font:"600 var(--text-base)/1.3 var(--font-body)"}}>{name}</span>
        <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)"}}>{meta}</span>
      </Col>
      {action}
    </div>
  );
}

/* Quiet note on a sunken card. */
function Note({icon,children}){
  return (
    <Card variant="sunken" padding={16}>
      <Row gap={12} style={{alignItems:"flex-start"}}>
        <Icon name={icon} size={18} color="var(--text-secondary)" style={{marginTop:1}}/>
        <span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)",textWrap:"pretty"}}>{children}</span>
      </Row>
    </Card>
  );
}

/* ---------- Screens ---------- */

/* 9 — You: the assistant's summary on top, then everything that shapes the plan. */
function You({week=3,kicker="By our assistant · updated today",body="You'd choose walk-run intervals again.",feedback="2 you'd choose again · 1 not for now"}){
  return (
    <>
      <Content pb={104} gap={20}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
          <Col gap={4}><Kicker>Ana · week {week}</Kicker><H1>About you</H1></Col>
          <IconButton icon="settings" label="Settings" variant="secondary"/>
        </div>
        <SuggestionCard tone="dawn" kicker={kicker} title="Mornings, on foot." body={body} actionLabel="See why" style={{flex:"none"}}/>
        <Col gap={0}>
          <Section>What shapes your plan</Section>
          <PrefRow icon="sprout" title="Starting point" value="Starting from scratch"/>
          <PrefRow icon="calendar-clock" title="Time" value="3 days a week · 20 min · 7:00–11:00" divider/>
          <PrefRow icon="footprints" title="Activities" value="Walk, run · new ideas now and then" divider/>
          <PrefRow icon="map-pin" title="Places" value="Outdoors, home · no equipment" divider/>
          <PrefRow icon="feather" title="Good to know" value="Avoid jumping · hardest: finding time" divider/>
          <PrefRow icon="heart" title="Your feedback" value={feedback} divider/>
        </Col>
      </Content>
      <NavBar value="you"/>
    </>
  );
}

/* 9.1 — You, first week: nothing to learn from yet, and the summary says so. */
const FirstWeek=()=><You week={1} kicker="By our assistant · from your answers" body="More once you've tried a few sessions." feedback="We ask after each session"/>;

/* 9.2 — How we see you: the summary as separate statements, each with its source. */
function Summary(){
  return (
    <>
      <TopBar left={<IconButton icon="arrow-left" label="Back"/>}/>
      <Content gap={20} pb={34}>
        <Col gap={6}><Kicker>Updated today · from your answers and feedback</Kicker><H1>How we see you</H1></Col>
        <Col gap={2}>
          <Section>What you enjoy</Section>
          <Statement source="Your answers">Moving in the morning, outdoors, for about 20 minutes.</Statement>
          <Statement source="Your feedback on 4 sessions" icon="heart" divider>Walk-run intervals and easy walks. You'd choose both again.</Statement>
        </Col>
        <Col gap={2}>
          <Section>What helps</Section>
          <Statement source="Your answers">Short sessions with nothing to set up, since finding time is the hard part.</Statement>
        </Col>
        <Col gap={2}>
          <Section>What we leave out</Section>
          <Statement source="Your answers · your feedback on 20 Oct" icon="ban">Jumping, and the hill walk for now.</Statement>
        </Col>
        <Note icon="lock">Only you change how often, how long and when. We never raise them on our own.</Note>
        <Caption>Written by our assistant from these sources. Something off? Change the answer behind it.</Caption>
      </Content>
    </>
  );
}

/* 9.3 — Why we think this: the stored facts behind one statement, and where to change them. */
function Why(){
  return (
    <>
      <Summary/>
      <Sheet label="Why we think this">
        <Row gap={12} style={{alignItems:"flex-start",padding:"0 4px"}}>
          <Col gap={6} style={{flex:1,minWidth:0}}>
            <Kicker>Why we think this</Kicker>
            <span style={{font:"var(--type-heading)",letterSpacing:"var(--tracking-tight)",textWrap:"pretty"}}>Walk-run intervals and easy walks. You'd choose both again.</span>
          </Col>
          <IconButton icon="x" label="Close"/>
        </Row>
        <Col gap={0} style={{padding:"0 4px"}}>
          <Evidence title="Walk-run intervals" detail="Monday 19 Oct · you said yes"/>
          <Evidence title="Easy walk" detail="Saturday 17 Oct · you said yes" divider/>
          <Evidence title="Walk-run intervals" detail="Monday 12 Oct · you said yes" divider/>
          <Evidence title="Walk-run intervals" detail="Wednesday 7 Oct · you said yes" divider/>
        </Col>
        <Row gap={8} style={{alignItems:"flex-start",padding:"0 4px"}}>
          <Icon name="info" size={16} color="var(--text-tertiary)" style={{marginTop:1}}/>
          <Caption>Only your answers count. A busy or skipped day never counts as a no.</Caption>
        </Row>
        <Button variant="secondary" size="lg" fullWidth>Change feedback</Button>
      </Sheet>
    </>
  );
}

/* 9.4 — Edit: time. Onboarding step 3.1 in edit chrome: no steps, one Save, and what
   saving changes. Every row on 9 opens its step like this. */
function EditTime(){
  const [p,setP]=React.useState(ANA);
  const set=(k,v)=>setP(s=>({...s,[k]:v}));
  return (
    <>
      <TopBar left={<IconButton icon="arrow-left" label="Back"/>}/>
      <Content gap={24}>
        <H1>Time</H1>
        <TimeQuestions p={p} set={set}/>
        <Note icon="calendar-clock">We plan around what's in your calendar and keep to your time of day when we can.</Note>
      </Content>
      <BottomBar>
        <Col gap={10} style={{flex:1}}>
          <Caption style={{textAlign:"center"}}>Upcoming sessions follow your answers. Done ones stay.</Caption>
          <Button size="lg" fullWidth>Save</Button>
        </Col>
      </BottomBar>
    </>
  );
}

/* 9.5 — Your feedback: per session card, never per day. Busy days and skips for time don't count. */
function YourFeedback(){
  return (
    <>
      <TopBar left={<IconButton icon="arrow-left" label="Back"/>} title="Your feedback" right={null}/>
      <Content gap={20} pb={34}>
        <Body>After each session we ask if you'd choose it again. A busy day never counts as a no.</Body>
        <Col gap={0}>
          <Section>You'd choose again</Section>
          <ItemRow icon="wind" name="Walk-run intervals" meta="Run · last done Monday"/>
          <ItemRow icon="footprints" name="Easy walk" meta="Walk · last done 17 Oct" divider/>
        </Col>
        <Col gap={0}>
          <Section>Maybe</Section>
          <ItemRow icon="person-standing" name="Gentle stretching" meta="Mobility · a new idea on 15 Oct" tone="muted"/>
        </Col>
        <Col gap={0}>
          <Section>Not for now</Section>
          <ItemRow icon="footprints" name="Hill walk" meta="Walk · tried 20 Oct" tone="muted" action={<Button variant="secondary" size="sm">Try again</Button>}/>
        </Col>
        <Col gap={8}>
          <Section>Switched off</Section>
          <Caption>Nothing switched off. A session's menu can switch off its whole activity.</Caption>
        </Col>
        <Row gap={12} style={{justifyContent:"space-between"}}>
          <Caption>Clears these answers. Your history stays.</Caption>
          <Button variant="ghost" size="sm" icon="rotate-ccw">Reset feedback</Button>
        </Row>
      </Content>
    </>
  );
}

/* A row that opens another screen. */
function LinkRow({icon,name,meta,divider}){
  return (
    <button type="button" style={{...ROW_BUTTON,gap:14,minHeight:60,padding:"8px 0",borderTop:divider?"1px solid var(--border-subtle)":"none"}}>
      <Disc icon={icon} tone="muted" size={36}/>
      <Col gap={2} style={{flex:1,minWidth:0}}>
        <span style={{font:"600 var(--text-base)/1.3 var(--font-body)"}}>{name}</span>
        {meta?<span style={{font:"var(--type-body-sm)",color:"var(--text-secondary)"}}>{meta}</span>:null}
      </Col>
      <Icon name="chevron-right" size={18} color="var(--text-tertiary)"/>
    </button>
  );
}

/* 9.6 — Settings, behind the gear: how the app looks and the account, kept apart from what
   shapes the plan. Appearance follows the phone unless the person picks. */
function Settings(){
  const [theme,setTheme]=React.useState("system");
  return (
    <>
      <TopBar left={<IconButton icon="arrow-left" label="Back"/>} title="Settings" right={null}/>
      <Content gap={24} pb={34}>
        <Col gap={12}>
          <Section>Appearance</Section>
          <Segmented label="Appearance" value={theme} onChange={setTheme} options={[{value:"system",label:"Phone"},{value:"light",label:"Light"},{value:"dark",label:"Dark"}]}/>
        </Col>
        <Col gap={0}>
          <Section>Account</Section>
          <ItemRow icon="mail" name="ana@example.com" meta="Signed in with email"/>
          <ItemRow icon="globe" name="Time zone" meta="Warsaw · from your phone" divider/>
        </Col>
        <Col gap={0}>
          <Section>Privacy</Section>
          <LinkRow icon="shield-check" name="Data and privacy" meta="Connections and what our assistant sees"/>
        </Col>
        <Col gap={0}>
          <Section>About</Section>
          <LinkRow icon="file-text" name="Terms"/>
          <LinkRow icon="lock" name="Privacy policy" divider/>
        </Col>
        <Button variant="ghost" icon="log-out" style={{alignSelf:"flex-start",marginLeft:-12}}>Sign out</Button>
      </Content>
    </>
  );
}

/* 9.7 — Data and privacy: what's connected, and exactly what our assistant sees. Notes after
   sessions now feed the description it keeps of the person (review, 3 October). */
function Sees({yes,children}){
  return (
    <Row gap={10} style={{alignItems:"flex-start"}}>
      <Icon name={yes?"check":"x"} size={18} strokeWidth={2} color={yes?"var(--success)":"var(--text-tertiary)"} title={yes?"Sees":"Never sees"} style={{marginTop:1}}/>
      <span style={{font:"var(--type-body-sm)",color:"var(--text-primary)"}}>{children}</span>
    </Row>
  );
}
function Privacy(){
  const on=<span style={{display:"inline-flex",alignItems:"center",gap:6,font:"var(--type-caption)",color:"var(--success-text)"}}><span style={{width:6,height:6,borderRadius:99,background:"var(--success)"}}></span>On</span>;
  return (
    <>
      <TopBar left={<IconButton icon="arrow-left" label="Back"/>} title="Data and privacy" right={null}/>
      <Content gap={24} pb={34}>
        <Col gap={0}>
          <Section>Connected</Section>
          <ItemRow icon="calendar" name="Calendar" meta="Uses busy times only" action={on}/>
          <ItemRow icon="footprints" name="Steps" meta="Today's count, stays on this phone" action={on} divider/>
          <div style={{opacity:.7}}><ItemRow icon="watch" name="Watch" meta="Garmin, COROS, Apple Watch" tone="muted" action={<Caption>Later</Caption>} divider/></div>
        </Col>
        <Col gap={12}>
          <Section>What our assistant sees</Section>
          <Sees yes>Your answers</Sees>
          <Sees yes>Your free times, never what's in your calendar</Sees>
          <Sees yes>Your sessions, how they felt and your notes</Sees>
          <Sees yes>Whether you'd choose a session again</Sees>
          <Sees>Your name, email or steps</Sees>
          <Caption>It builds your plan, keeps a short description of you from your sessions, and writes your summary.</Caption>
        </Col>
      </Content>
    </>
  );
}

const PROFILE_SCREENS=[
  {id:"profile",label:"9 · You",C:You},
  {id:"profile-first-week",label:"9.1 · You: first week",C:FirstWeek},
  {id:"profile-summary",label:"9.2 · Summary: how we see you",C:Summary},
  {id:"profile-why",label:"9.3 · Summary: why we think this",C:Why},
  {id:"profile-edit-time",label:"9.4 · Edit: time (onboarding 3.1)",C:EditTime},
  {id:"profile-feedback",label:"9.5 · Your feedback",C:YourFeedback},
  {id:"profile-settings",label:"9.6 · Settings",C:Settings,note:"The gear opens settings, kept apart from what shapes the plan: appearance, account, legal, sign out."},
  {id:"profile-privacy",label:"9.7 · Data and privacy",C:Privacy,note:"Under Settings. Notes after sessions now feed the assistant's description of you."},
];

Object.assign(window,{PROFILE_SCREENS});
})();
