# Six-person bootstrap plan

This plan covers the next, small integration milestone. The product scope and
later feature order remain in [product.md](product.md) and
[development.md](development.md). Assign one teammate to each seat at kickoff.

## Target for this milestone

From a clean checkout, the team can start a NestJS backend, a standalone React
web app, and the existing Expo mobile app. Web and mobile can reach the backend's
`GET /health` endpoint using documented local configuration. The team has a
short UX direction, a prioritized next-feature list, and a repeatable smoke
check. No user accounts or sport features are needed for this milestone.

## Six small ownership areas

| Seat | Owns now | Reviewable result |
| --- | --- | --- |
| 1. Integration | Coordinate app names and scripts, add root commands after app scaffolds land, keep npm workspace installation working, add baseline CI | One clean-install command and separate start/check commands for all three apps |
| 2. Backend | Scaffold `apps/backend` with NestJS, TypeScript, lint/typecheck/build scripts, and `GET /health` | API starts and returns a stable `{ "status": "ok" }` response |
| 3. Web | Scaffold `apps/web` with React and TypeScript, a minimal app shell, and local API URL configuration | Web starts independently and its development view shows backend connectivity |
| 4. Mobile | Keep the Expo starter working; replace example content with a minimal app shell and configurable API URL | Expo starts and its development view shows backend connectivity on the judging device |
| 5. Product and UX | Map the proposed beginner journey, list screens and key states, draft simple wireframes and copy, rank the first feature slice | One short UX document the web and mobile owners can use next |
| 6. QA and release readiness | Write and run a clean-checkout smoke checklist across backend, browser, and device; log setup defects and ownership | Reproducible pass/fail evidence and a short blocker list |

Seats 3 and 4 can scaffold against the agreed health response while seat 2
builds the endpoint. Seat 1 merges the wiring after those three PRs land. Seat 6
checks the integrated result, and feature owners fix any setup defects.

## Small PR sequence

1. **Agree on the seam (all six, before coding):** confirm the backend port,
   `/health` response, web origin, and the API URL format used by browser and
   physical device. Seat 1 records these in [development.md](development.md).
2. **Scaffold in parallel:** seats 2, 3, and 4 each submit one focused app PR.
   Keep their work inside their app directory and include an `.env.example` only
   where configuration is needed. Seat 5 submits the UX document; seat 6 submits
   the smoke checklist. Each PR targets `develop` and gets one teammate review.
3. **Integrate:** seat 1 adds root scripts and a minimal CI workflow after the
   app scripts exist. Preserve the current `npm run web` behavior for Expo;
   introduce an explicit command such as `npm run dev:web` for the standalone
   web app. CI checks install, lint, typecheck, and backend/web builds.
4. **Verify together:** seat 6 runs the checklist from a clean checkout, checks
   browser and device connectivity, and records issues. Seats 1–4 fix their
   respective blockers before calling the milestone complete.

Use the existing npm lockfile for these PRs. The agreed pnpm migration remains a
separate, coordinated change after the three apps start reliably; do not create
a second lockfile during bootstrap.

## Acceptance checklist

- `npm ci` succeeds from a clean checkout with one committed lockfile.
- Root commands start backend, standalone web, and Expo without confusing the
  standalone web app with Expo's web target.
- Backend health works locally; web and the judging device can reach it using
  documented API URL configuration.
- Lint and typecheck run for every app; backend and web build in CI.
- Environment templates contain placeholders only, and the README explains
  startup and the device-network address.
- The UX document names the first feature slice and unresolved product choices;
  the QA checklist records what was actually run and any remaining blockers.

## After this milestone

Plan the first product slice as a separate set of PRs using the UX document and
working app shells. That later slice can add shared product contracts, Supabase,
auth, preferences, sport suggestions, plans, and activity completion. None of
those features are part of the bootstrap acceptance check.
