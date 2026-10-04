# Website

Movo's product website: a landing page that presents the app and leads into it. It is
deployed to GitHub Pages at https://taqix.github.io/hackyeah-2026/, next to the app's
web build at https://taqix.github.io/hackyeah-2026/app/.

React 18 + TypeScript (`strict`), built with Vite into static files. The page's
sections are hash routes (`#/how`, `#/features`), so the build works from any folder.

## Into the app

The site has no demo of its own. Every call to action is a link into the real app:

- **Try it as a guest** opens `app/guest`, which creates a guest and starts
  onboarding. The guest gets the whole app without an account, and their plan
  stays in that browser. The answers on the hero's question card open it too.
- **Sign in** opens `app/welcome`.

Old links into the demo this site used to host (`#/try`, `#/try/1`,
`#/try/sample`, …) are sent on to the guest entry.

The links are relative to the site (`./app/`), so they work under the Pages project
path. To point them somewhere else, such as an Expo dev server, set `VITE_APP_URL`
in the environment or in `apps/website/.env.local`:

```bash
VITE_APP_URL=http://localhost:8081/ npm run dev:website
```

## Commands

From the repository root:

```bash
npm run dev:website     # http://localhost:4810, hot reload
npm run build:website   # static site in apps/website/dist
npm run typecheck --workspace=@hackyeah/website
```

## Layout

The layers only depend downwards: `design-system` knows nothing about the site,
`domain` knows nothing about React, components use both, and `App` wires them up.
See [coding principles](../../docs/code-principles.md) for the rules this follows.

- `src/domain/`: plain data the page shows. `onboarding` mirrors the app's
  onboarding: how many questions it asks, and the answers to the first one.
- `src/components/`: `common/` for shared pieces, then `landing/` (with the phone
  `mockups/`) and `chrome/`. One component per file.
- `src/App.tsx`, `src/routing.ts`, `src/appLinks.ts`, `src/hooks/`, `src/a11y.ts`:
  the shell — the route, the links into the app, the theme, the breakpoint,
  per-route focus and scrolling.
- `src/design-system/`: a copy of `design/system` (tokens, fonts, styles and the
  reference components, ported to typed JSX modules that render the same markup).
  Keep it in step with `design/system` when the design changes. The one addition is
  `href` on `Button`, which renders a link that looks the same.
- `src/site.css`: page styles; every class is prefixed `s-` (`m-` in the phone
  mockups).

The phone mockups on the landing page redraw the app's Home 5, onboarding 2 and
chat 8.3 screens from `design/prototype`; update them when those screens change.
The hero's question card and the onboarding mockup show the app's first question,
so update `src/domain/onboarding.ts` when the app's onboarding changes.

## Deployment

`.github/workflows/pages.yml` builds this site together with the Expo web app
(`npm run build:pages`, see [deployment](../../docs/deployment.md)) and publishes
both to GitHub Pages: the landing page at the root, the app under `app/`. CSS is not minified on purpose: the minifier rewrites colour
values in the design tokens, which changes how the page renders.
