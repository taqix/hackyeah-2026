# Website

Movo's product website: a landing page that presents the app as shipped, and a
clickable demo (questions, sport choice, plan creation, marking a session done,
a chat change with Undo). It is deployed to GitHub Pages at
https://taqix.github.io/hackyeah-2026/.

React 18 + TypeScript, built with Vite into static files. Routing is hash-based
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

- `src/logic.ts`: pure demo rules (scoring, plan generation, dates, the chat
  pipeline). They are fixed front-end rules standing in for the API and AI step.
- `src/components/`: landing page, question steps, planning moment, plan view
  with chat and dialogs. `src/App.tsx` holds routing and demo state.
- `src/design-system/`: a copy of `design/system` (tokens, fonts, styles and
  the reference components, ported to typed modules). Keep it in step with
  `design/system` when the design changes.
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
