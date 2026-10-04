# Feature: Web app and guest mode

Status: ready for review
Owner: web (lead) + mobile
Issue/PR: pending (branch `feature/web`)

## Problem and user outcome

The mobile app runs on Supabase and Gemini, but the only thing on the web was a
landing page with a scripted fake demo. People should be able to use the whole
product in a browser: sign in to their account, or try it as a guest with no
account, on the real API, in a layout made for a desktop rather than a
stretched phone screen.

## Scope

- Included:
  - The Expo app's web build as the web app, deployed with the landing page to
    GitHub Pages (`/hackyeah-2026/` landing, `/hackyeah-2026/app/` app).
  - A responsive desktop panel from 768 px: sidebar, docked coach, multi-column
    pages, dialogs, hover, focus and keyboard support. Every screen has a
    desktop layout.
  - Guest mode on the web: an anonymous Supabase user named Guest.
  - The landing page's fake demo is removed; its calls to action open the app.
- Deferred:
  - Step counter and device calendar on the web: the browser has neither, so
    the web hides those rows and plans from the preferred times or Google
    Calendar.
  - CAPTCHA on guest sign-in (Supabase rate limits anonymous sign-ins per IP).
  - Cleaning up old anonymous users.
- Affected areas: web, mobile (shared code; native unchanged), CI.

## Acceptance criteria

- [ ] **Guest.** On the web, Welcome and the landing page offer "Continue as
      guest"; `/app/guest` starts one directly. The guest lands in onboarding,
      gets a Gemini plan, and can log, give feedback and chat like any account.
- [ ] **Guest account.** Settings shows a guest card: "Save your progress"
      adds an email and password to the same user (plan and history stay);
      "Leave guest mode" signs out after a warning that the plan can't be
      reopened.
- [ ] **Guest off.** With anonymous sign-ins disabled, the guest action says
      "Guest mode isn't available right now. Sign in with email instead."
- [ ] **Accounts.** Email and Google sign-in work on the deployed site and
      return to `/hackyeah-2026/app/auth/callback`.
- [ ] **Desktop panel.** From 768 px, signed-in pages show the sidebar (rail
      at 768–1199 px); the coach opens docked (≥1200 px) or as a drawer; Today,
      Calendar, You, session, Log it, plan history, settings and onboarding use
      their desktop layouts; Feedback and Edit answers open as dialogs; the gym
      runner is full screen.
- [ ] **Phones unchanged.** iOS, Android and the web below 768 px render the
      phone layout; the phone apps have no guest entry.
- [ ] **Deep links.** Reloading any app URL on GitHub Pages opens that page.

## Design and compatibility

### One codebase

The web app is `apps/mobile` built with `expo export --platform web`. Logic,
API clients, hooks and copy are shared with the phone apps; only layout
differs.

- `useLayout()` (`components/layout/responsive.tsx`) gives the mode:
  `compact` below 768 px and always on native, `medium` from 768 px,
  `wide` from 1200 px. Every desktop branch is gated by it.
- Layout primitives: `Columns`, `Grid`, `PageHeader`, and `Content`, which
  centres desktop pages at 1160 px (forms narrower).
- The UI kit adds web hover and focus states, `Panel`, `StatTile`, `Tooltip`,
  `Kbd` and `webStyle`. A `Sheet` becomes a centred dialog on desktop.

### Shell (`navigation/web`)

- `WebShell` wraps the root stack. It shows only on the web from 768 px, for
  a signed-in session, on app routes. Sign-in, guest, onboarding, the gym
  runner and setup stand alone.
- **Sidebar:** Today, Calendar, You and Plan history; "Ask your coach"
  (Cmd/Ctrl K); and the account card with a Guest badge.
- **Coach dock:** `useCoachDock()` holds it, and it renders
  `features/chat/panel.tsx` (`ChatPanel`). `useOpenChat()` opens the dock on
  desktop and still pushes `/coach` on phones.
- **Dialogs:** `stack-presentation.tsx` presents `feedback/[logId]` and
  `profile/edit/[section]` as centred dialogs, with the phone layout inside.
  Everything else is a page.
- **Document:** page titles, theme colours, scrollbars and the focus ring.
  The GitHub Pages export uses Expo's SPA template, so `DocumentHead` adds the
  shared style sheet (`document-styles.ts`) at runtime.

### Guest mode

- `api.auth.signInAsGuest()` calls
  `supabase.auth.signInAnonymously({ options: { data: { name: 'Guest', full_name: 'Guest' } } })`.
  The profile trigger stores the username Guest.
- A guest's session has `provider: 'guest'` (from `is_anonymous`) and an empty
  email; check with `isGuest(user)`.
- The product API, RLS and Gemini treat a guest like any account.
- `api.auth.upgradeGuest(email, password)` calls `updateUser` on the same
  user.
- The mock backend supports both, so `EXPO_PUBLIC_API_MODE=mock` shows the
  whole flow offline.

### Redirects

On the web, auth redirects are built from the page's origin plus the router
base path (`api/remote/redirect-url.ts`). The deployed app therefore sends
`https://taqix.github.io/hackyeah-2026/app/auth/callback` and `/auth/reset`.

### Hosted Supabase settings (done 4 October 2026)

- Anonymous sign-ins are on.
- Both GitHub Pages redirect URLs are in the allowlist.
- Optional: Site URL to `https://taqix.github.io/hackyeah-2026/app/`.

## Implementation plan

Built on `feature/web` by parallel agents with file ownership, then
integrated:

- Responsive foundation
- Shell
- UI kit
- Auth and guest
- Today
- Calendar
- Chat
- You and settings
- Sessions
- Onboarding
- Deployment
- Landing page

## Verification

See the PR for the commands and results of the run on 4 October 2026.

## Local runtime and recovery

- Web app on Supabase: `npm run web` (uses `apps/mobile/.env`).
- Offline: `EXPO_PUBLIC_API_MODE=mock npx expo start --web` in `apps/mobile`;
  the demo account is `ana@example.com` with any 8+ character password.
- Pages site: `npm run build:pages`, then see [deployment](../deployment.md)
  for a local preview.
- Recovery: guest mode depends on the hosted Auth setting "Allow anonymous
  sign-ins". Turning it off makes the guest action show its unavailable
  message; accounts are unaffected.

## Review and documentation

- [ ] Acceptance criteria verified and evidence attached to the PR.
- [ ] Required checks pass and one teammate approves.
- [x] AGENTS.md, development, deployment and website docs updated.
- [x] Secrets excluded: the workflow carries only the publishable Supabase URL
      and key, which ship in the client bundle by design.
- [x] Known limitations recorded above.
