import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { Logic } from "./logic";
import { EMPTY_ANSWERS } from "./content";
import { useBP, reducedNow, go, parseRoute } from "./lib";
import { SiteHeaderLanding, SiteFooter, DemoHeader } from "./components/chrome";
import { Landing } from "./components/Landing";
import { StepView } from "./components/Steps";
import { PlanningView } from "./components/Planning";
import { PlanView } from "./components/Plan";
import type { Answers, ChatItem, LastFeeling, NewChatItem, Plan, UiState } from "./types";

/* ============ app ============ */
function App() {
  const [hash, setHash] = useState(location.hash);
  const [navTick, setNavTick] = useState(0);
  const route = parseRoute(hash);
  const bp = useBP();
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || "light");
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [sportPick, setSportPick] = useState<string | null>(null);
  const [visited, setVisited] = useState(0);
  const [pending, setPending] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [lastFeeling, setLastFeeling] = useState<LastFeeling | null>(null);
  const [busy, setBusy] = useState(false);
  const [revisedOnce, setRevisedOnce] = useState(false);
  const [ui, setUi] = useState<UiState>({ selectedOffset: 0, dialog: null, chatOpen: false });
  const [ticked, setTicked] = useState<boolean[]>([]);
  const [status, setStatus] = useState("");
  const ids = useRef(0);
  const live = useRef<{ plan: Plan | null; lastFeeling: LastFeeling | null; revisedOnce: boolean }>(null);
  live.current = { plan, lastFeeling, revisedOnce };
  const today = Logic.startOfDay(new Date());

  const ranked = useMemo(() => Logic.scoreSports(answers), [answers]);
  const sport = sportPick && ranked.some(r => r.key === sportPick) ? sportPick : ranked[0].key;

  /* router */
  useEffect(() => {
    history.scrollRestoration = "manual";
    const h = () => { setHash(location.hash); setNavTick(t => t + 1); };
    addEventListener("hashchange", h);
    return () => removeEventListener("hashchange", h);
  }, []);
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(document.documentElement.dataset.theme || "light"));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  let redirect = null;
  if (route.view === "step") {
    const first = !answers.comfort ? 1 : !answers.places.length ? 2 : null;
    if (first && route.step > first) redirect = "#/try/" + first;
  } else if (route.view === "planning" && !pending) redirect = plan ? "#/try/plan" : "#/try/1";
  else if (route.view === "plan" && !plan) redirect = "#/try/1";
  useLayoutEffect(() => { if (redirect) location.replace(redirect); }, [redirect, hash]);

  useEffect(() => { if (route.view === "step") setVisited(v => Math.max(v, route.step)); }, [hash]);

  /* sample guest */
  useEffect(() => {
    if (route.view !== "sample") return;
    const now = new Date(), p = Logic.buildSamplePlan(Logic.startOfDay(now), now);
    setAnswers({ ...Logic.SAMPLE_ANSWERS }); setSportPick("running"); setVisited(4);
    startPlan(p);
    location.replace("#/try/plan");
  }, [hash]);

  /* focus, scroll and title on every route change */
  const firstRun = useRef(true);
  useEffect(() => {
    if (redirect || route.view === "sample") return;
    const isFirst = firstRun.current; firstRun.current = false;
    const raf = requestAnimationFrame(() => {
      if (route.anchor) {
        const sec = document.getElementById(route.anchor), h2 = sec && sec.querySelector<HTMLElement>("h2");
        /* Put the section heading just under the sticky top bar, not the section's padded edge. */
        const head = sec && (sec.querySelector(".s-sechead") || sec);
        if (head) window.scrollTo({ top: head.getBoundingClientRect().top + window.scrollY - 64 - 32, behavior: reducedNow() || isFirst ? "auto" : "smooth" });
        if (h2 && !isFirst) h2.focus({ preventScroll: true });
      } else {
        window.scrollTo(0, 0);
        const h1 = document.querySelector<HTMLElement>("main h1[data-page-title]");
        if (h1 && !isFirst) h1.focus({ preventScroll: true });
      }
      const h1 = document.querySelector("main h1[data-page-title]");
      document.title = route.view === "landing" ? "Movo · Everyone starts somewhere" : (h1 ? h1.textContent + " · Movo demo" : "Movo demo");
    });
    return () => cancelAnimationFrame(raf);
  }, [route.key, navTick, !!redirect]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("movo-site-theme", next); } catch (e) {}
    setTheme(next);
  };
  const push = (items: NewChatItem[]) => setChat(c => [...c.map(m => (m.fresh ? { ...m, fresh: false } : m)), ...items.map(m => ({ id: "m" + (++ids.current), fresh: true, ...m }) as ChatItem)]);

  function startPlan(p: Plan) {
    setPlan(p);
    setChat(Logic.openingChat(p).map((t): ChatItem => ({ id: "m" + (++ids.current), kind: "coach", text: t })));
    setLastFeeling(null); setRevisedOnce(false); setBusy(false); setStatus("");
    setUi({ selectedOffset: p.todayOffset, dialog: null, chatOpen: false });
  }
  const choose = () => {
    const now = new Date();
    startPlan(Logic.buildPlan({ answers, sport, today: Logic.startOfDay(now), now }));
    setSportPick(sport);
    setPending(true);
    go("#/try/planning");
  };
  const startOver = () => {
    setAnswers(EMPTY_ANSWERS); setSportPick(null); setVisited(0); setPending(false); setPlan(null); setChat([]);
    setLastFeeling(null); setBusy(false); setRevisedOnce(false); setStatus(""); setUi({ selectedOffset: 0, dialog: null, chatOpen: false });
    if (location.hash === "#/try/1") setNavTick(t => t + 1); else go("#/try/1");
  };
  const answerHero = v => { setAnswers(a => ({ ...a, comfort: v })); go("#/try/2"); };
  const markDone = () => setUi(u => ({ ...u, dialog: { ...u.dialog, mode: "feedback" } }));
  const save = ({ feeling, note, ticked: tk }) => {
    const o = ui.dialog.offset;
    const np = Logic.markDone(plan, o, { feeling, note, ticked: tk });
    setPlan(np);
    setUi(u => ({ ...u, dialog: null }));
    setStatus("Saved · " + Logic.feelingOf(feeling).phrase + ".");
    setLastFeeling({ feeling, offset: o });
    push(Logic.feedbackReplies(np, o, feeling, revisedOnce).map((t): NewChatItem => ({ kind: "coach", text: t })));
  };
  const send = (text: string) => {
    if (busy) return;
    push([{ kind: "user", text }, { kind: "checking", id: "checking" }]);
    setBusy(true);
    setTimeout(() => {
      const { plan: p, lastFeeling: lf, revisedOnce: ro } = live.current;
      const res = Logic.runPipeline(p, text, { lastFeeling: lf });
      setChat(c => c.filter(m => m.kind !== "checking"));
      if (res.ok === false) {
        push([{ kind: "refusal", text: res.text }]);
      } else {
        setPlan(Logic.applyEffect(p, res, new Date()));
        const items: NewChatItem[] = [{ kind: "coach", text: res.explanation }, { kind: "result", res: { n: res.n, rows: res.rows, foot: res.foot } }];
        if (!ro) items.push({ kind: "closing", kept: p.versions.some(v => v.sessions.some(x => x.done)) });
        push(items);
        setRevisedOnce(true);
      }
      setBusy(false);
    }, reducedNow() ? 300 : 700);
  };
  /* Undo the newest change: back to the plan before it, keeping anything marked done since. */
  const undo = (n: number) => {
    const p = live.current.plan;
    if (busy || !p || p.active !== n || p.versions.length !== n) return;
    setPlan(Logic.undoLast(p));
    setChat(c => c.map(m => (m.kind === "result" && m.res.n === n && !m.undone ? { ...m, undone: true } : m)));
    setStatus("Change undone.");
  };
  const skip = e => { e.preventDefault(); const m = document.getElementById("s-main"); if (m) m.focus(); };
  const toTop = () => { window.scrollTo({ top: 0, behavior: reducedNow() ? "auto" : "smooth" }); const h1 = document.querySelector<HTMLElement>("main h1[data-page-title]"); if (h1) h1.focus({ preventScroll: true }); };

  let view = null;
  const ready = !redirect && route.view !== "sample";
  if (ready) {
    if (route.view === "landing") view = <Landing answers={answers} onAnswer={answerHero} bp={bp} />;
    else if (route.view === "step") view = <StepView n={route.step} answers={answers} setAnswers={setAnswers} ranked={ranked} sport={sport} setSport={setSportPick}
      visited={Math.max(visited, route.step)} hasPlan={!!plan} onChoose={choose} bp={bp} today={today} />;
    else if (route.view === "planning") view = <PlanningView answers={answers} sport={sport} today={today}
      onDone={() => { setPending(false); location.replace("#/try/plan"); }} />;
    else if (route.view === "plan") view = <PlanView plan={plan} chat={chat} busy={busy} lastFeeling={lastFeeling} status={status} ui={ui} setUi={setUi}
      ticked={ticked} setTicked={setTicked} onMarkDone={markDone} onSave={save} onSend={send} onUndo={undo} onStartOver={startOver} bp={bp} />;
  }
  const isLanding = route.view === "landing";
  return <>
    <a className="s-skip" href="#/" onClick={skip}>Skip to content</a>
    {isLanding
      ? <SiteHeaderLanding hasPlan={!!plan} theme={theme} onTheme={toggleTheme} />
      : <DemoHeader onStartOver={startOver} theme={theme} onTheme={toggleTheme} bp={bp} />}
    <main id="s-main" tabIndex={-1}>{view}</main>
    {isLanding ? <SiteFooter onTop={toTop} /> : null}
  </>;
}

export { App };
