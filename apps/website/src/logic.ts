import type { Answers, ChangeRow, Chip, LastFeeling, PipelineResult, Plan, PlanParams, Session, SessionRow, Version } from "./types";

/* A drill table entry: a session title and its middle rows as [name, detail, meta]. */
type Drill = [string, string[][]];

/* Pure, deterministic logic: data tables, scoring, plan generation, dates and the chat pipeline.
   No markup, no page access, no UI library. Every function that needs a date takes it as a parameter. */
export const Logic = (() => {
  /* ---------- data tables ---------- */
  const COMFORT = [
    { value: "scratch", L: 0, label: "Starting from scratch", desc: "Little or no exercise lately", icon: "armchair", echo: "starting from scratch", panel: "Starting from scratch — we'll start gently" },
    { value: "occasional", L: 1, label: "Occasionally active", desc: "Some movement now and then", icon: "footprints", echo: "occasionally active", panel: "Occasionally active — a short first session" },
    { value: "routine", L: 2, label: "Already have some routine", desc: "Moving most weeks", icon: "calendar-check", echo: "some routine already", panel: "Some routine — a bit more from day one" },
  ];
  const PLACES = [
    { key: "home", label: "Home", icon: "house", echo: "at home", badge: "At home" },
    { key: "outdoors", label: "Outdoors", icon: "tree-pine", echo: "outdoors", badge: "Outdoors" },
    { key: "gym", label: "Gym", icon: "building-2", echo: "a gym nearby", badge: "Gym nearby" },
  ];
  const COMPANY = [
    { key: "alone", label: "On my own", icon: "user-round", echo: "on your own", badge: "On your own" },
    { key: "others", label: "With others", icon: "users-round", echo: "with others", badge: "With others" },
  ];
  const TAGS = [...PLACES, ...COMPANY];
  const SESSION_RANGE = { min: 1, max: 7, step: 1 };
  const MINUTE_RANGE = { min: 5, max: 60, step: 5 };
  const SLOTS = {
    morning: { key: "morning", label: "Morning", icon: "sunrise", word: "morning", plural: "mornings", Plural: "Mornings", inPhrase: "in the morning", InPhrase: "In the morning" },
    lunchtime: { key: "lunchtime", label: "Lunchtime", icon: "sun", word: "lunchtime", plural: "lunchtimes", Plural: "Lunchtimes", inPhrase: "at lunchtime", InPhrase: "At lunchtime" },
    evening: { key: "evening", label: "Evening", icon: "moon", word: "evening", plural: "evenings", Plural: "Evenings", inPhrase: "in the evening", InPhrase: "In the evening" },
  };
  const SLOT_ORDER = ["morning", "lunchtime", "evening"];
  const SPORT_ORDER = ["running", "fitness", "gym", "football"];
  const SPORTS = {
    running: { key: "running", name: "Running", icon: "footprints", tone: "sage", tagline: "Starts as walking.", h1: "Running, gently.",
      tip: "Talk-pace is the pace. Slow enough to say a sentence." },
    fitness: { key: "fitness", name: "Fitness", icon: "heart-pulse", tone: "dawn", tagline: "Nothing to buy.", h1: "Fitness, at home.",
      tip: "Move slowly and breathe out on the effort." },
    gym: { key: "gym", name: "Gym", icon: "dumbbell", tone: "dusk", tagline: "Machines first.", h1: "Gym, machines first.",
      tip: "Start on the lightest setting. Asking staff to show you a machine is normal." },
    football: { key: "football", name: "Football", icon: "goal", tone: "sage", tagline: "Start with the ball.", h1: "Football, first touches.",
      tip: "Any ball works. A wall makes a patient partner." },
  };
  const SLOT_TIPS = {
    morning: "Mornings start stiff, so the warm-up does the work.",
    lunchtime: "Fits a lunch break. Bring a top to change into.",
    evening: "After work counts. Keep the last few minutes slow.",
  };
  const WEIGHTS = {
    base:     { running: 2, fitness: 2, gym: 1, football: 1 },
    home:     { running: 0, fitness: 4, gym: -1, football: 0 },
    outdoors: { running: 3, fitness: 0, gym: -1, football: 2 },
    gym:      { running: 0, fitness: 0, gym: 5, football: 0 },
    alone:    { running: 2, fitness: 1, gym: 1, football: -2 },
    others:   { running: 0, fitness: 0, gym: 0, football: 5 },
    scratch:  { running: 1, fitness: 1, gym: 0, football: -1 },
    routine:  { running: 0, fitness: 0, gym: 1, football: 1 },
    m5:       { running: 0, fitness: 2, gym: -2, football: -1 },
    m20:      { running: 0, fitness: 0, gym: 1, football: 1 },
  };
  /* Days of the week (offsets from the start) for 1–7 sessions, spread to leave rest between where possible. */
  const OFFSETS = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 2, 4, 6], 5: [0, 1, 3, 4, 6], 6: [0, 1, 2, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
  const NUM_WORD = { 1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven" };
  const FEELINGS = [
    { key: "easy", label: "Easy", desc: "Could have kept going", phrase: "felt easy" },
    { key: "right", label: "Just right", desc: "Tired, but good", phrase: "felt just right" },
    { key: "hard", label: "Hard", desc: "Needed a few extra breaks", descRunning: "Needed every walk break", phrase: "felt hard" },
    { key: "much", label: "Too much", desc: "Had to stop early", phrase: "felt like too much" },
  ];
  const SAMPLE_ANSWERS = { comfort: "scratch", places: ["outdoors"], company: ["alone"], sessions: 3, minutes: 10, slot: "morning" };
  const UNCHANGED = " Your plan hasn't changed.";

  /* ---------- small helpers ---------- */
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const comfortOf = v => COMFORT.find(c => c.value === v) || null;
  const levelOf = v => (comfortOf(v) ? comfortOf(v).L : 0);
  const tagOf = k => TAGS.find(t => t.key === k);
  const feelingOf = k => FEELINGS.find(f => f.key === k);
  const plural = (n, one, many) => (n === 1 ? one : many);
  const fmtSec = s => (s < 60 || s % 60 ? s + " s" : s / 60 + " min");

  /* ---------- dates (local midnight arithmetic only) ---------- */
  const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const WD_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const wdName = d => WD[d.getDay()];
  const wdShort = d => WD_SHORT[d.getDay()];
  const wdInitial = d => WD[d.getDay()].charAt(0);
  const fmtShort = d => d.getDate() + " " + MON_SHORT[d.getMonth()];
  const fmtDayDate = d => wdShort(d) + " " + fmtShort(d);
  const fmtLong = d => wdName(d) + " " + d.getDate() + " " + MONTHS[d.getMonth()];
  function fmtRange(start) {
    const end = addDays(start, 6);
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear())
      return start.getDate() + "–" + end.getDate() + " " + MON_SHORT[end.getMonth()];
    return fmtShort(start) + " – " + fmtShort(end);
  }
  /* "Today", "Tomorrow" or the weekday name, for offset o in a plan. */
  function dayWord(plan, o) {
    if (o === plan.todayOffset) return "Today";
    if (o === plan.todayOffset + 1) return "Tomorrow";
    return wdName(dateAt(plan, o));
  }
  function relTime(at, now) {
    const s = Math.max(0, Math.round((now - at) / 1000));
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return m + " min ago";
    const h = Math.floor(m / 60);
    if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    const d = Math.floor(h / 24);
    return d + (d === 1 ? " day ago" : " days ago");
  }

  /* ---------- 5a. sport scoring ---------- */
  function matchedBadges(sport, a) {
    const chosen = [...a.places, ...a.company];
    return TAGS
      .map((t, i) => ({ ...t, order: i, w: WEIGHTS[t.key][sport] }))
      .filter(t => chosen.includes(t.key) && t.w > 0)
      .sort((x, y) => y.w - x.w || x.order - y.order)
      .slice(0, 2);
  }
  function reasonLine(sport, a) {
    const has = k => a.places.includes(k) || a.company.includes(k);
    if (sport === "running") {
      if (has("outdoors") && has("alone")) return "Outdoors, on your own. Starts as walking.";
      if (has("outdoors")) return "Outdoors, at your pace. Starts as walking.";
      return "Just shoes and a route. Starts as walking.";
    }
    if (sport === "fitness") return has("home") ? "Short sessions at home, nothing to buy." : "Works in a living room, nothing to buy.";
    if (sport === "gym") return has("gym") ? "You can get to a gym. Machines first, one at a time." : "Machines first, if a gym is close by.";
    return has("others") ? "With others, at walking pace to start." : "Ball skills on your own first, a kickabout later.";
  }
  function scoreSports(a: Answers) {
    return SPORT_ORDER.map((s, i) => {
      let score = WEIGHTS.base[s];
      for (const k of [...a.places, ...a.company]) score += WEIGHTS[k][s];
      if (a.comfort === "scratch") score += WEIGHTS.scratch[s];
      if (a.comfort === "routine") score += WEIGHTS.routine[s];
      if (a.minutes <= 5) score += WEIGHTS.m5[s];
      if (a.minutes >= 20) score += WEIGHTS.m20[s];
      return { key: s, order: i, score, matches: matchedBadges(s, a), reason: reasonLine(s, a) };
    }).sort((x, y) => y.score - x.score || x.order - y.order);
  }

  /* ---------- 5b. sessions ---------- */
  const row = (name, detail, meta, sec) => ({ name, detail, meta, sec });
  function spread(total, n) {
    const base = Math.floor(total / n);
    return Array.from({ length: n }, (_, i) => (i === n - 1 ? total - base * (n - 1) : base));
  }
  const RUN_BIT = [30, 60, 90], WALK_BIT = [90, 90, 60];
  /* Session length bands: short (5 min), standard (10–15 min), long (20 min and up). */
  const band = M => (M < 10 ? 0 : M < 20 ? 1 : 2);
  const rounds = M => (M < 10 ? 1 : M < 20 ? 2 : 3 + Math.floor((M - 20) / 10));
  /* Walk-run block: warm-up, as many run/walk repeats as fit, the rest is cool-down. */
  function intervals(M, L) {
    const W = M >= 20 ? 300 : 120, Cmin = M >= 20 ? 180 : 120, run = RUN_BIT[L], walk = WALK_BIT[L];
    const n = Math.max(1, Math.floor((M * 60 - W - Cmin) / (run + walk)));
    return { W, n, run, walk, C: M * 60 - W - n * (run + walk) };
  }
  /* Session variety: the first session is its own; later ones alternate the other two. */
  const variant = index => (index < 3 ? index : 1 + ((index - 1) % 2));
  const FIT_REPS = [6, 8, 10], FIT_HOLD = [15, 20, 30];
  const GYM_REPS = [8, 10, 12];
  const BALL_T = [30, 45, 60], BALL_K = [6, 8, 10];

  function buildSession(sport: string, index: number, L: number, M: number, kickabout?: boolean): { title: string; rows: SessionRow[] } {
    const R = rounds(M), B3 = band(M), v = variant(index);
    if (sport === "running") {
      if (M === 5) return { title: "Short walk", rows: [row("Easy walk", "2 min", "warm-up", 120), row("Brisk walk", "2 min", "a little quicker", 120), row("Slow walk", "1 min", "cool-down", 60)] };
      if (L === 0 && index === 0) {
        const brisk = M >= 20 ? 240 : 120, t = [M * 60 - brisk - 120, brisk, 120];
        return { title: "Easy walk", rows: [row("Easy walk", fmtSec(t[0]), "talk pace", t[0]), row("Brisk walk", fmtSec(t[1]), "a little quicker", t[1]), row("Slow walk", fmtSec(t[2]), "cool-down", t[2])] };
      }
      const iv = intervals(M, L), block = iv.n * (iv.run + iv.walk);
      return { title: "Walk-run intervals", rows: [
        row("Brisk walk", fmtSec(iv.W), "warm-up", iv.W),
        row("Run, then walk", iv.n + " × " + fmtSec(iv.run) + " run · " + fmtSec(iv.walk) + " walk", fmtSec(block), block),
        row("Slow walk", fmtSec(iv.C), "cool-down", iv.C),
      ] };
    }
    if (sport === "fitness") {
      const k = FIT_REPS[L], h = FIT_HOLD[L];
      const wu = [60, 120, 180][B3], cd = [60, 120, 120][B3];
      const sets = n => R + " × " + n;
      const MID: Drill = ([
        ["Home basics", [["Sit to stand", sets(k), "from a sturdy chair"], ["Wall push-up", sets(k), "hands on a wall"]]],
        ["Legs and core", [["Sit to stand", sets(k), "from a sturdy chair"], ["Glute bridge", sets(k), "lying on your back"], ["Knee plank", R + " × " + fmtSec(h), "knees down"]]],
        ["Arms and balance", [["Wall push-up", sets(k), "hands on a wall"], ["Bird dog", sets(k - 2) + " each side", "slow, on hands and knees"], ["Standing knee lift", sets(k - 2) + " each side", "hold a wall if needed"]]],
      ] as Drill[])[v];
      const mids = M < 10 ? MID[1].slice(0, 2) : MID[1];
      const secs = spread(M * 60 - wu - cd, mids.length);
      return { title: MID[0], rows: [
        row("March on the spot", fmtSec(wu), "warm-up", wu),
        ...mids.map((m, i) => row(m[0], m[1], m[2], secs[i])),
        row("Easy stretch", fmtSec(cd), "cool-down", cd),
      ] };
    }
    if (sport === "gym") {
      const q = GYM_REPS[L], W = [120, 180, 300][B3], c = [60, 120, 180][B3];
      const G = [["First gym visit", "Treadmill walk", "Leg press", "Seated row"], ["Lower body machines", "Exercise bike", "Leg press", "Leg curl"], ["Upper body machines", "Cross-trainer", "Chest press", "Lat pulldown"]][v];
      const secs = spread(M * 60 - W - c, 2);
      return { title: G[0], rows: [
        row(G[1], fmtSec(W), "warm-up", W),
        row(G[2], R + " × " + q, "start light", secs[0]),
        row(G[3], R + " × " + q, "start light", secs[1]),
        row("Walk and stretch", fmtSec(c), "cool-down", c),
      ] };
    }
    /* football */
    const t = BALL_T[L], k = BALL_K[L];
    const W = [60, 120, 240][B3], c = [60, 120, 180][B3];
    const warm = row("Brisk walk", fmtSec(W), "warm-up", W), cool = row("Slow walk", fmtSec(c), "cool-down", c);
    if (kickabout) {
      const mid = (M * 60 - W - c) / 60, P = Math.ceil(mid / 2), Q = mid - P;
      return { title: "Kickabout with others", rows: [warm, row("Pass back and forth", P + " min", "about 10 m apart", P * 60), row("Walking football", Q + " min", "no running, just play", Q * 60), cool] };
    }
    const drill = R + " × " + fmtSec(t);
    const B: Drill = ([
      ["First touches", [["Toe taps", drill, "sole on the ball, swap feet"], ["Inside-foot passes", R + " × " + k + " each foot", "against a wall"]]],
      ["Wall passing", [["Wall passes", R + " × " + k + " each foot", "a step back each round"], ["Stop the ball", R + " × " + k, "sole trap"]]],
      ["Dribble and walk", [["Easy dribble", drill, "walking pace, small touches"], ["Toe taps", drill, "sole on the ball"]]],
    ] as Drill[])[v];
    const secs = spread(M * 60 - W - c, 2);
    return { title: B[0], rows: [warm, ...B[1].map((m, i) => row(m[0], m[1], m[2], secs[i])), cool] };
  }

  function sessionReason(sport, index, kickabout, comfort, slot, restBefore) {
    if (kickabout) return "With others — you said you'd like company.";
    if (index === 0) {
      if (comfort === "scratch") return sport === "running" ? "Starts as walking — you said you're starting from scratch." : "Starts gently — you said you're starting from scratch.";
      if (comfort === "occasional") return "A short first session — you said you move now and then.";
      return "A bit more from day one — you already move most weeks.";
    }
    if (index === 1) return SLOTS[slot].InPhrase + " — you said " + SLOTS[slot].plural + " suit you.";
    return restBefore ? "A rest day before it, so you start fresh." : "Back to back with yesterday — keep it at talk pace.";
  }
  function coachTip(sport, slot) {
    return SPORTS[sport].tip + " " + SLOT_TIPS[slot] + " Stopping early still counts.";
  }
  const isKick = (sport, withOthers, count, index, maxIndex) => sport === "football" && withOthers && count >= 2 && index === maxIndex;

  function makeSession({ sport, index, offset, L, M, slot, kickabout, comfort, restBefore }): Session {
    const b = buildSession(sport, index, L, M, kickabout);
    return { id: "s" + index, index, offset, sport, title: b.title, rows: b.rows, minutes: M, slot,
      reason: sessionReason(sport, index, kickabout, comfort, slot, restBefore), kickabout: !!kickabout,
      done: null, doneInVersion: null, changedIn: null };
  }

  /* ---------- plans ---------- */
  function buildPlan({ answers, sport, today, now, start, todayOffset = 0, sample = false }: { answers: Answers; sport: string; today: Date; now: Date; start?: Date; todayOffset?: number; sample?: boolean }): Plan {
    const D = answers.sessions, L = levelOf(answers.comfort), M = answers.minutes, slot = answers.slot;
    const withOthers = answers.company.includes("others");
    const offs = OFFSETS[D];
    const sessions = offs.map((offset, index) => makeSession({ sport, index, offset, L, M, slot, comfort: answers.comfort,
      restBefore: index > 0 && offset - offs[index - 1] > 1,
      kickabout: isKick(sport, withOthers, D, index, D - 1) }));
    const params: PlanParams = { sport, L, M, slot, withOthers, D,
      source: { L: "answers", M: "answers", slot: "answers", sport: "answers", days: "answers" } };
    return { start: start || startOfDay(today), todayOffset, sample, active: 1, viewing: null,
      answers: JSON.parse(JSON.stringify(answers)),
      versions: [{ n: 1, label: "First plan", at: now, params, sessions }] };
  }
  function buildSamplePlan(today: Date, now: Date): Plan {
    const p = buildPlan({ answers: SAMPLE_ANSWERS, sport: "running", today, now: new Date(now.getTime() - 2 * 864e5),
      start: addDays(startOfDay(today), -2), todayOffset: 2, sample: true });
    const s0 = p.versions[0].sessions[0];
    s0.done = { feeling: "right", note: "", ticked: s0.rows.map(() => true), version: 1 };
    s0.doneInVersion = 1;
    return p;
  }
  const activeVersion = (plan: Plan): Version => plan.versions.find(v => v.n === plan.active);
  const dateAt = (plan, o) => addDays(plan.start, o);
  const sessionAt = (version, o) => version.sessions.find(s => s.offset === o) || null;
  const sortByOffset = list => list.slice().sort((a, b) => a.offset - b.offset);

  /* Mark the session at offset o done in the active version. Never creates a version. */
  function markDone(plan: Plan, o: number, { feeling, note, ticked }: { feeling: string; note: string; ticked: boolean[] }): Plan {
    const v = activeVersion(plan);
    const sessions = v.sessions.map(s => (s.offset === o ? { ...s, done: { feeling, note, ticked: ticked.slice(), version: v.n }, doneInVersion: v.n } : s));
    return { ...plan, versions: plan.versions.map(x => (x.n === v.n ? { ...v, sessions } : x)) };
  }

  /* ---------- copy helpers used by views ---------- */
  const placeEchoes = a => a.places.map(k => tagOf(k).echo);
  const companyEchoes = a => a.company.map(k => tagOf(k).echo);
  const timeLine = a => a.minutes + " min · " + a.sessions + " " + plural(a.sessions, "session", "sessions") + " · " + SLOTS[a.slot].plural;
  function step4Body(a) {
    const c = comfortOf(a.comfort);
    const parts = [c ? c.echo : null, ...placeEchoes(a), ...companyEchoes(a), a.minutes + " min", SLOTS[a.slot].plural].filter(Boolean);
    return "From your answers: " + parts.join(", ") + ".";
  }
  function suggestionBody(item, a) {
    const m = item.matches.map(t => t.echo);
    return cap([...m, a.minutes + " min", SLOTS[a.slot].plural].join(" · "));
  }
  function planningKicker(sport, a) {
    return SPORTS[sport].name + " · " + a.sessions + " " + plural(a.sessions, "session", "sessions") + " · " + a.minutes + " min · " + SLOTS[a.slot].plural;
  }
  function planningSteps(sport, a, today) {
    const c = comfortOf(a.comfort);
    const days = OFFSETS[a.sessions].map(o => wdName(addDays(today, o))).join(", ");
    return [
      { label: "Reading your answers", caption: cap([c ? c.echo : "", ...placeEchoes(a)].filter(Boolean).join(" · ") + " · " + a.minutes + " min") },
      { label: "Drafting " + a.sessions + " " + SPORTS[sport].name.toLowerCase() + " " + plural(a.sessions, "session", "sessions"), caption: days },
      { label: "Checking the plan", parts: ["Supported sport", "plan shape", "fits your days", "beginner scope"] },
      { label: "Saving your plan" },
    ];
  }
  function headerBody(plan) {
    const v = activeVersion(plan), p = v.params, D = v.sessions.length;
    const s0 = v.sessions.find(s => s.index === 0) || sortByOffset(v.sessions)[0];
    return NUM_WORD[D] + " " + plural(D, "session", "sessions") + " of " + p.M + " min, " + SLOTS[p.slot].inPhrase + ". " + (s0 ? s0.reason : "");
  }
  function levelEffect(sport, L, M) {
    if (sport === "running") {
      if (M === 5) return "every session is a short walk";
      return ["the first session is an easy walk; run bits are 30 s", "run bits start at 1 min", "run bits start at 90 s"][L];
    }
    if (sport === "fitness") return FIT_REPS[L] + " reps a set";
    if (sport === "gym") return GYM_REPS[L] + " reps a set, starting light";
    return fmtSec(BALL_T[L]) + " drills";
  }
  function whyLines(plan) {
    const v = activeVersion(plan), p = v.params, src = p.source, a = plan.answers;
    const from = k => (src[k] === "answers" ? null : src[k].version);
    const labelOfV = n => (plan.versions.find(x => x.n === n) || {}).label;
    const D = v.sessions.length;
    const sorted = sortByOffset(v.sessions), days = sorted.map(s => wdShort(dateAt(plan, s.offset))).join(", ");
    const restBetween = sorted.every((s, i) => i === 0 || s.offset - sorted[i - 1].offset > 1);
    const best = scoreSports(a)[0].key === p.sport;
    const sportCause = from("sport") ? labelOfV(from("sport")) : best ? cap([...placeEchoes(a), ...companyEchoes(a)].join(" · ")) : "Your pick";
    return [
      { key: "L", icon: "gauge", cause: from("L") ? labelOfV(from("L")) : comfortOf(a.comfort).label, effect: levelEffect(p.sport, p.L, p.M), from: from("L") },
      { key: "sport", icon: SPORTS[p.sport].icon, cause: sportCause, effect: SPORTS[p.sport].name, from: from("sport") },
      { key: "M", icon: "timer", cause: p.M + " min", effect: "each session is " + p.M + " minutes", from: from("M") },
      { key: "days", icon: "calendar-days", cause: D + " " + plural(D, "session", "sessions"), effect: D > 1 && restBetween ? days + ", with rest between" : days, from: from("days") },
      { key: "slot", icon: SLOTS[p.slot].icon, cause: SLOTS[p.slot].Plural, effect: "sessions " + SLOTS[p.slot].inPhrase, from: from("slot") },
    ];
  }
  function openingChat(plan) {
    const first = "This is your plan. Ask for a change in your own words, or pick a suggestion.";
    if (plan.sample) {
      const done = activeVersion(plan).sessions.find(s => s.done);
      return [first, wdName(dateAt(plan, done.offset)) + "'s walk is done. Whatever you change next, it stays as you did it."];
    }
    return [first, "Mark today's session done first, if you like. Whatever you change next, it stays as you did it."];
  }
  /* What the chat can actually change, so replies and chips never suggest a refused request. */
  function canChange(plan) {
    const p = activeVersion(plan).params, walkOnly = p.sport === "running" && p.M === 5;
    return { easier: p.L > 0 && !walkOnly, harder: p.L < 2 && !walkOnly, shorter: p.M > MINUTE_RANGE.min };
  }
  function feedbackReplies(plan, o, feeling, revisedOnce) {
    const day = wdName(dateAt(plan, o)), can = canChange(plan);
    const ask = can.easier ? "a bit easier" : can.shorter ? "shorter sessions" : null;
    const out = [{
      easy: can.harder ? "Saved. Felt easy? You can ask for a bit more." : "Saved. Felt easy? That's a good start.",
      right: "Saved. " + day + " stays as you did it, whatever you change next.",
      hard: ask ? "Saved. Hard is normal at first. If it stays hard, ask for " + ask + "." : "Saved. Hard is normal at first.",
      much: ask ? "Saved. Stopping early still counts. Ask for " + ask + " and the plan changes straight away." : "Saved. Stopping early still counts.",
    }[feeling]];
    if (!revisedOnce) out.push("Now try a change — " + day + " stays exactly as you did it.");
    return out;
  }
  function chips(plan: Plan, lastFeeling: LastFeeling | null): Chip[] {
    const v = activeVersion(plan), slot = v.params.slot;
    const list: Chip[] = [{ id: "slot", label: SLOTS[slot].Plural + " are busy", text: SLOTS[slot].Plural + " are busy." }];
    const next = sortByOffset(v.sessions.filter(s => !s.done && s.offset > plan.todayOffset))[0];
    if (next) { const d = wdName(dateAt(plan, next.offset)); list.push({ id: "day", label: "Busy " + d, text: "I'm busy on " + d + "." }); }
    const can = canChange(plan), f = lastFeeling && lastFeeling.feeling, struggled = f === "hard" || f === "much";
    const shorter = { id: "shorter", label: "Make it shorter", text: "Can the sessions be shorter?" };
    const easier = { id: "easier", label: "A bit easier", text: "Can it be a bit easier?" };
    if (struggled && can.easier) list.unshift({ ...easier, accent: true });
    else if (struggled && can.shorter) list.unshift({ ...shorter, accent: true });
    if (can.shorter && !(struggled && !can.easier)) list.push(shorter);
    if (can.easier && !struggled) list.push(easier);
    if (f === "easy" && can.harder) list.unshift({ id: "harder", label: "A bit harder", text: "Can it be a bit harder?" });
    return list;
  }
  const DECLINE_CHIP = { id: "marathon", label: "Plan a marathon", text: "Can you make this a marathon plan?" };

  /* ---------- 5e. chat pipeline ---------- */
  const RX = {
    health: /\b(pain|painful|hurts?|hurting|injur(y|ies|ed)|ill|illness|sick|doctor|physio|medic(al|ation|ine)|pregnan(t|cy)|asthma|diabet(es|ic)|blood pressure|heart condition)\b/,
    scope: /\b(half marathon|marathon|ultra|triathlon|twice a day|lose weight|weight loss|lose \d+)\b/,
    busy: /\bbusy\b/,
    day: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b/,
    harder: /\b(harder|more challenging|challenge|push me|too easy)\b/,
    easier: /\b(easier|easy|gentler|gentle|too hard|too much|hard|tired)\b/,
    longer: /\b(longer|more time|too short)\b/,
    shorter: /\b(shorter|short|less time|quick|quicker|no time|too long)\b/,
    rest: /\b(rest|fewer|less often|day off|recover)\b/,
    switchVerb: /\b(switch|change|try|instead|rather|swap)\b/,
  };
  const BUSY_SLOT_RX: [string, RegExp][] = [["morning", /\bmornings?\b/], ["lunchtime", /\b(lunch|lunchtimes?|midday|noon)\b/], ["evening", /\b(evenings?|after work|nights?)\b/]];
  const ASK_SLOT_RX: [string, RegExp][] = [["evening", /\b(evenings?|after work|nights?)\b/], ["morning", /\b(mornings?|before work|early)\b/], ["lunchtime", /\b(lunch|lunchtimes?|midday|noon)\b/]];
  const OTHER_RX: [RegExp, string][] = [[/climb|bouldering/, "Climbing"], [/basketball/, "Basketball"], [/volleyball/, "Volleyball"], [/swim/, "Swimming"], [/tennis/, "Tennis"], [/yoga/, "Yoga"], [/cycl|bike/, "Cycling"], [/padel/, "Padel"]];
  const SWITCH_RX: [string, RegExp][] = [["football", /\b(football|soccer)\b/], ["gym", /\bgym\b|\bmachines?\b/], ["fitness", /\bfitness\b|at home|home workout/], ["running", /\brun\b|running|\bjog/]];
  const SWAP = { morning: "evening", lunchtime: "evening", evening: "morning" };

  const refuse = (intent: string, text: string): PipelineResult => ({ ok: false, intent, text });
  const firstMatch = (list: [string, RegExp][], t: string) => { for (const [k, rx] of list) if (rx.test(t)) return k; return null; };

  function sessionsChanged(a, b) {
    return a.title !== b.title || a.slot !== b.slot || a.offset !== b.offset || a.minutes !== b.minutes || a.sport !== b.sport || JSON.stringify(a.rows) !== JSON.stringify(b.rows);
  }
  function dayCols(plan, o) { const d = dateAt(plan, o); return { offset: o, day: wdShort(d), date: fmtShort(d) }; }

  /* Builds the next version. `sessions` is the full new list (deep copies), done sessions untouched. */
  function finish(plan: Plan, intent: string, { sessions, params, label, explanation, rows, removed }: { sessions: Session[]; params: PlanParams; label: string; explanation: string; rows: ChangeRow[]; removed?: boolean }): PipelineResult {
    const v = activeVersion(plan), n = plan.versions.length + 1;
    const before = new Map(v.sessions.map(s => [s.id, s]));
    const out = sortByOffset(sessions).map(s => {
      const old = before.get(s.id);
      if (!s.done && old && sessionsChanged(old, s)) return { ...s, changedIn: n, reason: explanation };
      return s;
    });
    const anyChanged = removed || out.some(s => s.changedIn === n);
    if (!anyChanged || !rows.length) return refuse(intent, "That wouldn't change any session left this week." + UNCHANGED);
    const doneDays = sortByOffset(out.filter(s => s.done)).map(s => wdName(dateAt(plan, s.offset)));
    const foot = doneDays.length === 0 ? "Everything else stays the same."
      : doneDays.length === 1 ? doneDays[0] + " stays exactly as you did it."
      : doneDays.slice(0, -1).join(", ") + " and " + doneDays[doneDays.length - 1] + " stay exactly as you did them.";
    const src = { ...params.source };
    return { ok: true, intent, label, explanation, rows, foot, n,
      version: { n, label, at: null, params: { ...params, source: src }, sessions: out } };
  }
  const copySessions = v => JSON.parse(JSON.stringify(v.sessions));
  const copyParams = v => JSON.parse(JSON.stringify(v.params));

  function effectSlot(plan: Plan, intent, slot, explanation): PipelineResult {
    const v = activeVersion(plan), params = copyParams(v), sessions = copySessions(v);
    const rows = [];
    for (const s of sortByOffset(sessions)) {
      if (s.done || s.slot === slot) continue;
      rows.push({ ...dayCols(plan, s.offset), was: SLOTS[s.slot].label, now: SLOTS[slot].label });
      s.slot = slot;
    }
    params.slot = slot; params.source.slot = { version: plan.versions.length + 1 };
    return finish(plan, intent, { sessions, params, rows, explanation, label: "Moved to " + SLOTS[slot].plural });
  }
  function effectMove(plan: Plan, intent, o): PipelineResult {
    const v = activeVersion(plan), date = dateAt(plan, o), name = wdName(date);
    const target = sessionAt(v, o);
    if (!target) return refuse(intent, "There's nothing planned on " + name + "." + UNCHANGED);
    if (target.done) return refuse(intent, name + " is done, so it stays as you did it." + UNCHANGED);
    const occupied = new Set(v.sessions.filter(s => s.id !== target.id).map(s => s.offset));
    const order = [];
    for (let c = o + 1; c <= 6; c++) order.push(c);
    for (let c = o - 1; c >= 0; c--) order.push(c);
    const cands = order.filter(c => c > plan.todayOffset && !occupied.has(c));
    if (!cands.length) return refuse(intent, "There's no free day left this week to move it to." + UNCHANGED);
    const pick = cands.find(c => !occupied.has(c - 1) && !occupied.has(c + 1));
    const to = pick !== undefined ? pick : cands[0];
    const toName = wdName(dateAt(plan, to));
    const params = copyParams(v), sessions = copySessions(v);
    sessions.find(s => s.id === target.id).offset = to;
    params.source.days = { version: plan.versions.length + 1 };
    return finish(plan, intent, { sessions, params,
      explanation: name + "'s session moved to " + toName + " — you said " + name + " is busy.",
      label: "Moved " + name + " to " + toName,
      rows: [{ ...dayCols(plan, to), was: fmtDayDate(date), now: fmtDayDate(dateAt(plan, to)) }] });
  }
  function effectMinutes(plan: Plan, intent, dir): PipelineResult {
    const v = activeVersion(plan), M = v.params.M;
    if (dir < 0 && M <= MINUTE_RANGE.min) return refuse(intent, "Sessions are already " + M + " min, the shortest we plan." + UNCHANGED);
    if (dir > 0 && M >= MINUTE_RANGE.max) return refuse(intent, "Sessions are already " + M + " min, the longest we plan." + UNCHANGED);
    const nm = M + dir * MINUTE_RANGE.step;
    const params = copyParams(v), sessions = copySessions(v), rows = [];
    for (const s of sortByOffset(sessions)) {
      if (s.done) continue;
      const b = buildSession(s.sport, s.index, params.L, nm, s.kickabout);
      rows.push({ ...dayCols(plan, s.offset), was: s.minutes + " min", now: nm + " min" });
      s.title = b.title; s.rows = b.rows; s.minutes = nm;
    }
    params.M = nm; params.source.M = { version: plan.versions.length + 1 };
    return finish(plan, intent, { sessions, params, rows,
      explanation: dir < 0 ? "Sessions are now " + nm + " min — you asked for shorter ones. Same days, fewer rounds." : "Sessions are now " + nm + " min — you asked for longer ones. Same days, more rounds.",
      label: dir < 0 ? "Shorter sessions" : "Longer sessions" });
  }
  function levelValue(sport, L) {
    if (sport === "running") return fmtSec(RUN_BIT[L]) + " run bits";
    if (sport === "fitness") return FIT_REPS[L] + " reps";
    if (sport === "gym") return GYM_REPS[L] + " reps";
    return fmtSec(BALL_T[L]) + " drills";
  }
  function effectLevel(plan: Plan, intent, dir, lastFeeling): PipelineResult {
    const v = activeVersion(plan), p = v.params;
    if (p.sport === "running" && p.M === 5) return refuse(intent, (dir < 0 ? "At 5 min every session is already a short walk, the gentlest we plan." : "At 5 min every session is a short walk. Ask for longer sessions first.") + UNCHANGED);
    if (dir < 0 && p.L === 0) return refuse(intent, "This is already the gentlest start. Try “Make it shorter” instead." + UNCHANGED);
    if (dir > 0 && p.L === 2) return refuse(intent, "That's as much as a first week asks." + UNCHANGED);
    const nl = p.L + dir;
    const params = copyParams(v), sessions = copySessions(v), rows = [];
    for (const s of sortByOffset(sessions)) {
      if (s.done) continue;
      const b = buildSession(s.sport, s.index, nl, s.minutes, s.kickabout);
      if (b.title === s.title && JSON.stringify(b.rows) === JSON.stringify(s.rows)) continue;
      const was = b.title !== s.title ? s.title : levelValue(s.sport, p.L);
      const now = b.title !== s.title ? b.title : levelValue(s.sport, nl);
      rows.push({ ...dayCols(plan, s.offset), was, now });
      s.title = b.title; s.rows = b.rows;
    }
    params.L = nl; params.source.L = { version: plan.versions.length + 1 };
    const f = lastFeeling && lastFeeling.feeling;
    const fDay = lastFeeling ? wdName(dateAt(plan, lastFeeling.offset)) : "";
    let cause;
    if (dir < 0) cause = f === "hard" ? "you said " + fDay + " felt hard" : f === "much" ? "you said " + fDay + " felt like too much" : "you asked for easier";
    else cause = f === "easy" ? "you said " + fDay + " felt easy" : "you asked for more";
    const lead = dir < 0
      ? { running: "Shorter run bits, longer walks", fitness: "Fewer reps", gym: "Fewer reps, still light", football: "Shorter drills" }[p.sport]
      : (p.sport === "running" ? "Longer run bits" : "A few more reps");
    return finish(plan, intent, { sessions, params, rows, explanation: lead + " — " + cause + ".", label: dir < 0 ? "A bit easier" : "A bit harder" });
  }
  function effectRest(plan: Plan, intent): PipelineResult {
    const v = activeVersion(plan);
    const target = sortByOffset(v.sessions.filter(s => !s.done && s.offset > plan.todayOffset)).pop();
    if (!target || v.sessions.length <= 1) return refuse(intent, "One session is the fewest we plan this week." + UNCHANGED);
    const name = wdName(dateAt(plan, target.offset));
    const params = copyParams(v), sessions = copySessions(v).filter(s => s.id !== target.id);
    params.D = sessions.length; params.source.days = { version: plan.versions.length + 1 };
    return finish(plan, intent, { sessions, params, removed: true,
      explanation: name + " is now a rest day — you asked for more rest.", label: "One more rest day",
      rows: [{ ...dayCols(plan, target.offset), was: target.title, now: "Rest day" }] });
  }
  function effectSwitch(plan: Plan, intent, sport): PipelineResult {
    const v = activeVersion(plan), p = v.params;
    if (p.sport === sport) return refuse(intent, "This is already a " + SPORTS[sport].name.toLowerCase() + " plan." + UNCHANGED);
    const params = copyParams(v), sessions = copySessions(v), rows = [];
    const maxIndex = Math.max(...sessions.map(s => s.index));
    const live = sortByOffset(sessions.filter(s => !s.done));
    for (const s of live) {
      const kick = isKick(sport, p.withOthers, sessions.length, s.index, maxIndex);
      const b = buildSession(sport, s.index, p.L, s.minutes, kick);
      rows.push({ ...dayCols(plan, s.offset), was: s.title, now: b.title });
      Object.assign(s, { sport, title: b.title, rows: b.rows, kickabout: kick });
    }
    params.sport = sport; params.source.sport = { version: plan.versions.length + 1 };
    const fromWord = live[0].offset === plan.todayOffset ? "today" : wdName(dateAt(plan, live[0].offset));
    const lower = SPORTS[sport].name.toLowerCase();
    return finish(plan, intent, { sessions, params, rows,
      explanation: "Switched to " + lower + " from " + fromWord + " — you asked to try it.", label: "Switched to " + lower });
  }

  /* One message in, one decision out. ctx = { lastFeeling: {feeling, offset} | null } */
  function runPipeline(plan: Plan, input: string, ctx: { lastFeeling?: LastFeeling | null } = {}): PipelineResult {
    const t = String(input || "").toLowerCase().trim();
    const v = activeVersion(plan);
    const live = () => v.sessions.some(s => !s.done);
    const allDone = intent => refuse(intent, "Every session this week is done. Nothing left to change here.");
    let m;
    if (RX.health.test(t)) return refuse("health", "Plans can't take pain or health conditions into account. If something hurts or you feel unwell, check with a doctor or physio." + UNCHANGED);
    if ((m = t.match(RX.scope))) {
      const w = m[1];
      if (/marathon|ultra|triathlon/.test(w)) return refuse("scope", (/^[aeiou]/.test(w) ? "An " : "A ") + w + " is beyond a beginner plan. Sessions can get a little longer instead." + UNCHANGED);
      if (/lose|weight/.test(w)) return refuse("scope", "This plan is about moving more, not weight." + UNCHANGED);
      return refuse("scope", "That's beyond a beginner first week." + UNCHANGED);
    }
    for (const [rx, name] of OTHER_RX) if (rx.test(t)) return refuse("other-sport", name + " isn't one of the sports we plan." + UNCHANGED);
    if (RX.busy.test(t)) {
      if ((m = t.match(RX.day))) {
        if (!live()) return allDone("move");
        let o;
        if (m[1] === "today") o = plan.todayOffset;
        else if (m[1] === "tomorrow") o = plan.todayOffset + 1;
        else { const wd = WD.map(x => x.toLowerCase()).indexOf(m[1]); for (let i = 0; i < 7; i++) if (dateAt(plan, i).getDay() === wd) o = i; }
        return effectMove(plan, "move", o);
      }
      const said = firstMatch(BUSY_SLOT_RX, t);
      if (said) {
        const cur = v.params.slot;
        if (said !== cur) return refuse("busy-slot", "Sessions are already " + SLOTS[cur].inPhrase + ", not " + SLOTS[said].inPhrase + "." + UNCHANGED);
        if (!live()) return allDone("slot-swap");
        const to = SWAP[cur];
        return effectSlot(plan, "slot-swap", to, "Moved to " + SLOTS[to].plural + " — you said " + SLOTS[cur].plural + " are busy.");
      }
      return refuse("busy", "Which day or time is busy? Try “Busy Monday” or “Mornings are busy”." + UNCHANGED);
    }
    if (RX.harder.test(t)) return live() ? effectLevel(plan, "harder", +1, ctx.lastFeeling) : allDone("harder");
    if (RX.easier.test(t)) return live() ? effectLevel(plan, "easier", -1, ctx.lastFeeling) : allDone("easier");
    if (RX.longer.test(t)) return live() ? effectMinutes(plan, "longer", +1) : allDone("longer");
    if (RX.shorter.test(t)) return live() ? effectMinutes(plan, "shorter", -1) : allDone("shorter");
    const ask = firstMatch(ASK_SLOT_RX, t);
    if (ask) {
      if (ask === v.params.slot) return refuse("slot", "Sessions are already " + SLOTS[ask].inPhrase + "." + UNCHANGED);
      if (!live()) return allDone("slot");
      return effectSlot(plan, "slot", ask, "Moved to " + SLOTS[ask].plural + " — you asked for " + SLOTS[ask].plural + ".");
    }
    if (RX.rest.test(t)) return live() ? effectRest(plan, "rest") : allDone("rest");
    if (RX.switchVerb.test(t)) {
      const sp = firstMatch(SWITCH_RX, t);
      if (sp) {
        if (sp === v.params.sport) return refuse("switch", "This is already a " + SPORTS[sp].name.toLowerCase() + " plan." + UNCHANGED);
        return live() ? effectSwitch(plan, "switch", sp) : allDone("switch");
      }
    }
    return refuse("fallback", "We couldn't turn that into a plan change. Try one of the suggestions — your plan hasn't changed.");
  }
  /* Undo → the plan before the newest change. Sessions marked done since keep their outcome. */
  function undoLast(plan: Plan): Plan {
    if (plan.versions.length < 2) return plan;
    const last = plan.versions[plan.versions.length - 1], prev = plan.versions[plan.versions.length - 2];
    const done = new Map(last.sessions.filter(s => s.done).map(s => [s.id, s]));
    const sessions = prev.sessions.map(s => (!s.done && done.has(s.id) ? done.get(s.id) : s));
    return { ...plan, active: prev.n, versions: [...plan.versions.slice(0, -2), { ...prev, sessions }] };
  }
  /* Accepted change → new active version, straight away. */
  function applyEffect(plan: Plan, result: PipelineResult, now: Date): Plan {
    if (!result || !result.ok) return plan;
    const version = { ...result.version, at: now };
    return { ...plan, active: version.n, versions: [...plan.versions, version] };
  }

  return {
    COMFORT, PLACES, COMPANY, TAGS, SESSION_RANGE, MINUTE_RANGE, SLOTS, SLOT_ORDER, SPORT_ORDER, SPORTS, WEIGHTS,
    OFFSETS, FEELINGS, SAMPLE_ANSWERS, DECLINE_CHIP,
    cap, comfortOf, levelOf, tagOf, feelingOf, fmtSec,
    startOfDay, addDays, wdName, wdShort, wdInitial, fmtShort, fmtDayDate, fmtLong, fmtRange, dayWord, relTime,
    scoreSports, matchedBadges, reasonLine, buildSession, sessionReason, coachTip,
    buildPlan, buildSamplePlan, activeVersion, dateAt, sessionAt, sortByOffset, markDone,
    placeEchoes, companyEchoes, timeLine, step4Body, suggestionBody, planningKicker, planningSteps, headerBody, whyLines,
    openingChat, feedbackReplies, chips, runPipeline, applyEffect, undoLast,
  };
})();
