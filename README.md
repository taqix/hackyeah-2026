# HackYeah 2026

Project workspace for HackYeah 2026: a beginner sport app helping inactive adults choose a sport and complete encouraging activities.

## Project status

npm workspaces monorepo. The mobile app in `apps/mobile` uses Expo SDK 57, React Native, TypeScript, and Expo Router. It starts with Expo's default two-tab starter and supports Android, iOS, and web.

The agreed product plan adds NestJS, a React web dashboard, Supabase Auth/PostgreSQL, and AI-generated multi-day plans. Working MVP sports are gym, fitness, running, and football. Backend/dashboard and CI remain planned. pnpm is the target package manager; the current scaffold uses npm until a coordinated migration lands.

## Getting started

```sh
git clone https://github.com/taqix/hackyeah-2026.git
cd hackyeah-2026
npm install
npm start
```

Use a current Node.js LTS release. Scan the terminal QR code with a compatible Expo Go app, or press `a` for an Android emulator, `i` for the iOS Simulator (macOS with Xcode), or `w` for web.

Device calendar access requires a native development build; Expo Go and web return
an explicit unavailable state. See [device calendar setup and API](docs/features/device-calendar.md).

```sh
npm run android    # Open on Android
npm run ios        # Open in the iOS Simulator
npm run web        # Open in the browser
npm run typecheck  # Check TypeScript
npm run lint       # Check ESLint
```

Run installation and the commands above from the repository root. Dependencies are locked in the root `package-lock.json`.

Start editing `apps/mobile/src/app/index.tsx`. Routes and navigation live in `apps/mobile/src/app/`; shared components live in `apps/mobile/src/components/`. `apps/mobile/app.json` contains the app name, icons, splash screen, and platform settings.

To replace the example screens with a blank starting point, run `npm run reset-project --workspace=@hackyeah/mobile`. The script offers to move the starter into `apps/mobile/example/` before resetting it.

Add future applications under `apps/` and shared packages under `packages/`, each with its own `package.json`. Both directories are included in the workspace configuration. Expo detects npm workspaces automatically; no custom Metro resolution is required. See the [Expo monorepo guide](https://docs.expo.dev/guides/monorepos/).

## Repository layout

- `apps/mobile/` — Expo app, source code, assets, and starter reset utility.
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
- `docs/` — product scope, development conventions, deployment plan, and a feature template.

## Installed skills

- **setup-matt-pocock-skills** — configures issue tracking and domain documentation conventions for engineering workflows.
- **[react-native-best-practices](.agents/skills/react-native-best-practices/SKILL.md)** — required for React Native / Expo implementation, review, and debugging; see [usage conventions](docs/development.md#react-native--expo-skill).
- **ui-ux-pro-max** — provides UI and UX design guidance and supporting resources.

## Collaboration

Start feature/documentation branches from `develop` and open PRs against it. Promote reviewed releases to `main` for deployment.

## Project documentation

- [Grilling session summary](docs/grilling-summary.md)
- [Product scope](docs/product.md)
- [Six-person bootstrap plan](docs/roadmap.md)
- [Development and implementation plan](docs/development.md)
- [Wearable data extraction architecture](docs/data-extraction/README.md)
- [Wearable implementation and integration guide](docs/features/wearable-extraction.md) — run `npm run demo:wearables` or `npm run test:wearables`.
- [Deployment plan](docs/deployment.md)
- [Feature template](docs/features/TEMPLATE.md)
- [Device calendar access](docs/features/device-calendar.md)

Keep setup instructions up to date as the application takes shape. Commit environment variable templates such as `.env.example` when needed, and keep credentials in ignored local environment files.
