# Coding principles

How we write code in this repository. These are the rules a reviewer may hold a change to,
with the reasoning behind each one and examples from `apps/website`, which was refactored
to follow them. They apply to every workspace; the examples are TypeScript and React.

Two rules of thumb sit above all of the others:

1. **Write for the next reader.** Code is read far more often than it is written, and during
   a hackathon it is read by someone in a hurry. Clarity beats cleverness every time.
2. **Keep behaviour and structure separate.** Change what the code *does*, or change how it
   is *arranged* — not both in the same commit. A refactor that also fixes a bug hides both.

## Don't repeat yourself

Duplication is a maintenance bug that has not happened yet: the copies drift, and the one
nobody updated becomes wrong. Give every fact a single home.

- **Data lives in one table.** Sports, places, times of day and feelings are declared once in
  `domain/catalog.ts`. Adding an option means editing one table, not hunting for the views
  that list it.
- **Copy lives in one place.** Every sentence about a plan comes from `domain/copy.ts`, so the
  wording can be reviewed as writing rather than discovered inside markup.
- **Derive, don't restate.** The catalog stores `plural: "mornings"` and the views call
  `capitalize(...)`; it does not store `Plural: "Mornings"` as well. Two fields that must agree
  are two chances to disagree.
- **Share the shape, not just the value.** `Button` and `IconButton` read their colours from one
  `controlPalette`, so a variant cannot look different in two places.
- **Factor out the procedure, not only the constant.** Each chat change used to repeat
  "copy the plan, collect the rows, stamp the version"; that is now `startDraft` and
  `commitRevision`, and each change only describes what makes it different.

Resist the opposite mistake. Two pieces of code that merely *look* alike, and would change for
different reasons, should stay apart. Unifying them couples two unrelated decisions, and the
next change has to tear them back open.

## Single responsibility

A module should have one reason to change, and you should be able to say what it is in a
sentence. When the sentence needs an "and", split the module.

- One exported component per file, named after the file.
- A function does one thing at one level of abstraction. `buildPlan` decides a plan's shape and
  delegates each session's content to a builder; it does not also know how many reps a wall
  push-up takes.
- No "god objects". A single object exporting fifty unrelated members cannot be reasoned about,
  tested in parts, or tree-shaken. `apps/website` previously had one 629-line `Logic` object;
  it is now `domain/` with a module per responsibility and a barrel for convenience.
- No "utils" or "helpers" dumping grounds. A name that says nothing attracts code that belongs
  nowhere. `dates.ts`, `text.ts`, `a11y.ts` each say what they hold.

## Open for extension, closed for modification

Adding a case should mean adding code, not editing the same conditional in four places. Use a
table or a registry keyed by the thing that varies.

- Each sport implements `SportSessionBuilder` and is registered once in
  `domain/sessions/index.ts`. Before, adding a sport meant finding four separate `if (sport ===
  ...)` chains; now the compiler names the one thing you have left to write.
- The chat is an ordered list of rules, each of which either decides a message or passes it on,
  so a new kind of request is a new rule rather than a longer `if`-chain.
- The questionnaire's steps come from a registry keyed by step number.

Order-dependent lists are fine — but say so. The chat's rules are ordered deliberately
(refusals first), and the list documents that.

## Dependencies point one way

Layers may only know about the layer beneath them: `design-system` → nothing of ours,
`domain` → no React, `components` → `domain` and `design-system`, `App` → everything.

- **The domain layer is pure.** No markup, no `document`, no `localStorage`, and no clock of its
  own: every function that needs the date takes it as a parameter. That is what makes the rules
  testable without a browser, and what will let them move to the backend unchanged.
- **Views do not re-implement rules.** If a component computes a sentence or a date, that
  belongs in the domain layer, where it can be read next to the rest of the wording.
- **No cycles.** If two modules need each other, a third thing is hiding between them.

## Components take intent, not state

Pass a component what it needs and the actions it may trigger — never a raw state setter.
`onSaveFeedback(feedback)` can be read, logged and tested; `setUi(u => ({ ...u, dialog: null }))`
passed three levels down means every caller has to know the whole state shape, and any of them
can corrupt it.

For the same reason, state transitions belong together in one pure reducer rather than being
spread across a dozen `useState` setters. The plan demo's chat used to read the latest state
back through a mutable ref because its `setTimeout` had closed over stale values; with the
transitions in a reducer, the ref is gone and each action is a value you can test.

## Names

Names are the documentation that cannot go out of date.

- Say what it is: `minutesPerSession`, not `M`; `sessionsPerWeek`, not `D`; `activeVersion`, not
  `v`. Single-letter names are for a loop index or a mathematical formula, nothing else.
- Use the domain's words, and the same word everywhere. A "session" is never also a "workout".
- Booleans read as a claim: `hasOpenSessions`, `isWalkOnly`.
- Functions that answer a question are named for the answer (`availableAdjustments`), functions
  that act are named for the act (`markSessionDone`).
- Prefer a named constant to a literal in an expression: `DAYS_IN_WEEK`, not `7`.

## Types carry the rules

- `strict` is on, and so are `noUnusedLocals` and `noUnusedParameters`. Unused code is deleted,
  not commented out — git remembers it.
- No unexplained `any`, no casts to silence the compiler, and no `!` to assert something is
  there. If a value can be missing, handle it or state the invariant and throw with a message
  that says which invariant broke.
- Make illegal states unrepresentable. `SlotKey` is a union of three strings, so a typo is a
  compile error rather than `undefined` in a sentence.
- Prefer a discriminated union to a value that is "a string, or else an object":
  `{ kind: "answers" } | { kind: "revision"; version: number }` tells the reader what the cases
  are, and the compiler checks you handled them.
- Use `switch` over a union with an exhaustiveness check, so adding a case breaks the build
  instead of silently rendering nothing.

## Comments

Code says what; comments say why. Prefer a clear name to a comment explaining a bad one.

Write a comment when the reason is not in the code: a workaround, a deliberate order, a value
that comes from somewhere outside this file, an invariant a reader might otherwise break. Keep
the ones that already earn their place — the website's CSS is shipped unminified because the
minifier rewrites colour values, and that note must survive any cleanup.

## Refactoring safely

A refactor must not change behaviour, and "I read it carefully" is not evidence.

- Keep the old implementation until the new one is proved, then delete it in the same change.
- **Prove equivalence with a differential test**: run both versions over the whole input space
  you care about and compare the results. The `apps/website` refactor was checked this way —
  every session variant (sport × level × length × position), every answer combination, and a
  battery of chat messages against every plan, plus the design-system components rendered to
  HTML and compared string by string. It found two real mistakes that review had missed.
- Run the project's checks (`npm run typecheck`, the workspace's tests and build) before asking
  for review, and say in the PR what evidence you have.
- Keep unrelated tidying out of a feature branch. A diff that does two things gets reviewed
  for neither.

## Review checklist

- Does every new fact have exactly one home?
- Can you say each module's single responsibility in a sentence?
- Would adding the next sport, step or message kind mean editing existing conditionals?
- Does anything in `domain/` touch React, the DOM, or `new Date()` without being given it?
- Do components receive intent callbacks instead of state setters?
- Any single-letter names, `any`, `!`, or dead exports left behind?
- Are loading, empty, failure and retry states still explicit, and the keyboard and
  screen-reader behaviour unchanged?
- Is there evidence the behaviour did not change?
