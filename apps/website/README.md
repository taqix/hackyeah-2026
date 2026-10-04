# Website

Movo's product website: a landing page that presents the app as shipped, and a
clickable demo (questions, sport choice, plan creation, marking a session done,
a chat change with Undo). It is deployed to GitHub Pages at
https://taqix.github.io/hackyeah-2026/.

React 18 + TypeScript (`strict`), built with Vite into static files. Routing is hash-based
(`#/try/1`, `#/try/plan`, …), so the build works from any folder.
`#/try/sample` opens a seeded guest plan.

## Commands

From the repository root:

```bash
npm run dev:website     # http://localhost:4810, hot reload
npm run build:website   # static site in apps/website/dist
npm run typecheck --workspace=@hackyeah/website
```

## Layout

The layers only depend downwards: `design-system` knows nothing about the demo,
`domain` knows nothing about React, components use both, and `App` wires them up.
See [coding principles](../../docs/code-principles.md) for the rules this follows.

- `src/domain/`: the demo's rules, all pure and free of React, the DOM and the
  clock, standing in for the API and the AI step. `catalog` holds the option
  tables, `answers` the questionnaire's result, `sports` the suggestion scoring,
  `sessions/` a session builder per sport, `schedule` which days sessions land on,
  `plan` a plan and its versions, `chat/` turning a message into a refusal or a new
  version, and `copy` every sentence the views show. `domain/index.ts` re-exports
  them, so views import from `"../../domain"`.
- `src/components/`: `common/` for shared pieces, then `landing/` (with the phone
  `mockups/`), `steps/`, `planning/`, `plan/` and `chrome/`. One component per file.
- `src/demo/`: the demo's state. `reducer.ts` is a pure state machine covering every
  action; `useDemo.ts` wraps it and owns the few side effects; `redirects.ts` decides
  which routes the current state allows.
- `src/App.tsx`, `src/routing.ts`, `src/hooks/`, `src/a11y.ts`: the shell — the route,
  the theme, the breakpoint, per-route focus and scrolling, keyboard helpers.
- `src/design-system/`: a copy of `design/system` (tokens, fonts, styles and the
  reference components, ported to typed JSX modules that render the same markup).
  Keep it in step with `design/system` when the design changes.
- `src/site.css`: page styles; every class is prefixed `s-` (`m-` in the phone
  mockups).

The phone mockups on the landing page redraw the app's Home 5, onboarding 2 and
chat 8.3 screens from `design/prototype`; update them when those screens change.
The page never mentions plan versions or what the demo leaves out. The website
keeps its guest demo; the mobile app has none.

## Deployment

`.github/workflows/pages.yml` runs on pushes to `main` and `develop` that touch
this folder or the lockfile. It typechecks, builds and publishes `dist/` to
GitHub Pages. CSS is not minified on purpose: the minifier rewrites colour
values in the design tokens, which changes how the page renders.
