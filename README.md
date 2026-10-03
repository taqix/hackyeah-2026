# HackYeah 2026

Project workspace for HackYeah 2026: a beginner sport app helping inactive adults choose a sport and complete encouraging activities.

## Project status

npm workspaces monorepo. The mobile app in `apps/mobile` uses Expo SDK 57, React Native, TypeScript, and Expo Router. It starts with Expo's default two-tab starter and supports Android, iOS, and web. The NestJS backend exposes `GET /health`.

The agreed product plan adds a React web dashboard, Supabase Auth/PostgreSQL, and AI-generated multi-day plans. Working MVP sports are gym, fitness, running, and football. The standalone dashboard and product APIs remain planned. Backend development runs locally with Node.js or Docker Compose. pnpm is the target package manager; the current scaffold uses npm until a coordinated migration lands.

## Getting started

```sh
git clone https://github.com/taqix/hackyeah-2026.git
cd hackyeah-2026
npm install
npm start
```

Use a current Node.js LTS release (Node 22.6+ for the step-counter tests). Expo Go can preview the starter UI, but Android step reading requires a native build because Health Connect is not included in Expo Go. Use Android Studio / the Android SDK for Android builds, or Xcode on macOS for iOS builds.

Device calendar access requires a native development build; Expo Go and web return
an explicit unavailable state. See [device calendar setup and API](docs/features/device-calendar.md).

```sh
npm run android    # Build and open the native Android app
npm run ios        # Build and open the native iOS app
npm run web        # Open in the browser
npm run typecheck  # Check TypeScript
npm run lint       # Check ESLint
npm test --workspace=@hackyeah/mobile  # Test system step-count logic
```

## Backend

Use Node.js 22 and install from the repository root with `npm ci`. Start the API in a separate terminal:

```sh
npm run dev:backend
curl http://localhost:3000/health
```

The response is `{"status":"ok"}`. The backend binds to `0.0.0.0:3000` by default. To change it, copy `apps/backend/.env.example` to `apps/backend/.env` and set `PORT` or `HOST`. From a physical device on the same network, use `http://<your-computer-LAN-IP>:3000/health`; `localhost` on the device points to the device itself. Allow incoming traffic through your computer's firewall if needed.

To run the backend in Docker locally instead, use:

```sh
docker compose up --build
curl http://localhost:3000/health
docker compose down
```

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test:backend
npm run build:backend
```

There is no cloud deployment in this milestone. The backend runs locally at `http://localhost:3000/health`.

Run installation and the commands above from the repository root. Dependencies are locked in the root `package-lock.json`.

Start editing `apps/mobile/src/app/index.tsx`. Routes and navigation live in `apps/mobile/src/app/`; shared components live in `apps/mobile/src/components/`. `apps/mobile/app.json` contains the app name, icons, splash screen, and platform settings.

The root layout initializes a headless daily step counter. Screens can read `steps`,
`status`, and permission/retry actions from `useStepCounter` in
`apps/mobile/src/hooks/use-step-counter.ts`. iOS reads the phone's Core Motion
history; Android reads the Health Connect aggregate. No app background service is
used. See [system step counter](docs/features/system-step-counter.md) for setup,
platform limitations, and device verification.

To replace the example screens with a blank starting point, run `npm run reset-project --workspace=@hackyeah/mobile`. The script offers to move the starter into `apps/mobile/example/` before resetting it.

Add future applications under `apps/` and shared packages under `packages/`, each with its own `package.json`. Both directories are included in the workspace configuration. Expo detects npm workspaces automatically; no custom Metro resolution is required. See the [Expo monorepo guide](https://docs.expo.dev/guides/monorepos/).

## Repository layout

- `apps/mobile/` — Expo app, source code, assets, and starter reset utility.
- `apps/backend/` — NestJS API bootstrap and health endpoint.
- `packages/contracts/` — versioned runtime schemas and types, including wearable data.
- `packages/wearable-data/` — server-side extraction, FIT import, provider adapters and transactional storage.
- `supabase/migrations/` — additive backend-only wearable storage schema.
- `package.json` — workspace configuration and root commands.
- `package-lock.json` — shared dependency lockfile.
- `.agents/skills/` — project skills for compatible coding agents.
- `.claude/skills/` — skill entries for Claude Code.
- `skills-lock.json` — installed skill sources and hashes.
- `.gitignore` — excludes dependencies, build output, caches, and local environment files.
- `AGENTS.md` and `CLAUDE.md` — compact coding-agent instructions.
- `docs/` — product scope, development conventions, local runtime status, and a feature template.

## Installed skills

- **setup-matt-pocock-skills** — configures issue tracking and domain documentation conventions for engineering workflows.
- **[react-native-best-practices](.agents/skills/react-native-best-practices/SKILL.md)** — required for React Native / Expo implementation, review, and debugging; see [usage conventions](docs/development.md#react-native--expo-skill).
- **ui-ux-pro-max** — provides UI and UX design guidance and supporting resources.

## Collaboration

Start feature/documentation branches from `develop` and open PRs against it. Keep the team's review process for changes to the local backend.

## Project documentation

- [Grilling session summary](docs/grilling-summary.md)
- [Product scope](docs/product.md)
- [Six-person bootstrap plan](docs/roadmap.md)
- [Development and implementation plan](docs/development.md)
- [Wearable data extraction architecture](docs/data-extraction/README.md)
- [Wearable implementation and integration guide](docs/features/wearable-extraction.md) — run `npm run demo:wearables` or `npm run test:wearables`.
- [Runtime status](docs/deployment.md)
- [Feature template](docs/features/TEMPLATE.md)
- [FIT/GPX activity import API](docs/features/activity-file-import.md)
- [Device calendar access](docs/features/device-calendar.md)

Keep setup instructions up to date as the application takes shape. Commit environment variable templates such as `.env.example` when needed, and keep credentials in ignored local environment files.
