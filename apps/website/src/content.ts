/* ============ UI content tables ============ */
const NOTICE = [
  ["info", "Every session says what to do"],
  ["shield-check", "The plan checked before it's saved"],
  ["history", "Changes keep the sessions you've done"],
  ["lock", "A request it declines, with the plan left as it was"],
];
const BEATS = [
  { kicker: "1 · Ask", title: "Calm questions", body: "How starting feels, where you can move, and how much time you have. No wrong answers.", icon: "list-checks" },
  { kicker: "2 · Plan", title: "A sensible week", body: "A sport that fits, then short sessions with rest days between. Each one says what to do.", icon: "calendar-days" },
  { kicker: "3 · Change", title: "Moved, not failed.", body: "Say what doesn't work. The plan changes straight away, explains the change, and keeps what you've done.", icon: "message-circle" },
];
const FEATURES = [
  ["list-checks", "A few calm questions", "How starting feels, what you'd like to try, where you can move, and how much time you have."],
  ["calendar-days", "A week that fits", "Sessions land in your free time, at the times you prefer, with rest days between."],
  ["timer", "Guided sessions", "Intervals, sets and holds are counted for you. Log a run, a set or a swim as you go."],
  ["smile", "How did it feel?", "One tap after each session, from “could have kept going” to “had to stop early”. Add a note if you like."],
  ["message-circle", "Change it by asking", "Say what doesn't work. The plan updates straight away, explains the change, and you can undo it."],
  ["feather", "Not today? That's fine", "Make it simpler, do five minutes, move it, or skip it with nothing to make up."],
  ["footprints", "Steps from your phone", "Today's count sits on Home. It stays on your phone."],
  ["shield-check", "Private by default", "Movo reads only when you're busy, never what's in your calendar. Edit any answer whenever you like."],
];
const EMPTY_ANSWERS = { comfort: null, places: [], company: [], sessions: 3, minutes: 10, slot: "morning" };
const STEP_TITLES = { 1: "How does starting feel?", 2: "What sounds good?", 3: "Start small", 4: "Sports that fit" };

export { NOTICE, BEATS, FEATURES, EMPTY_ANSWERS, STEP_TITLES };
