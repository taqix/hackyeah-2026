# Project instructions

Build a beginner sport app for inactive adults: preferences, sport suggestions,
AI-generated multi-day plans, completion, and feedback. Read the relevant docs
below before changing a feature.

- Monorepo: `apps/backend` (NestJS), `apps/mobile` (Expo: iOS, Android and the web
  app, deployed to GitHub Pages at `/app/`), `apps/website` (React landing page at the
  GitHub Pages root).
- Use TypeScript and shared lint/format rules. Current setup uses npm workspaces;
  pnpm is the agreed target. Follow the migration plan in `docs/development.md`.
- Follow the [coding principles](docs/code-principles.md): one home per fact, one
  responsibility per module, a pure domain layer, and no behaviour change in a refactor
  without evidence.
- Share API contracts in `packages/contracts`; keep client UI separate.
- The proof of concept uses Supabase Auth, PostgreSQL/RLS, and Edge Functions
  directly from both clients. See `docs/features/supabase-product-api.md`.
  NestJS remains available for future backend work; it is not required by this path.
- Validate requests and AI output; enforce authenticated user ownership.
- Validated chat revisions replace the active plan immediately. Preserve prior
  versions and completed activities.
- Guest entry (web only; the phone apps have none) signs in an anonymous Supabase
  user named Guest on the real API. It starts at onboarding and can be saved as an
  email account.
- The web app is the Expo web build. Desktop layouts (sidebar, docked coach, columns)
  are gated by `useLayout()`; native and web below 768 px keep the phone layout.
  See [Web app](docs/features/web-app.md).
- Branch from `develop`; target feature PRs to `develop` and release PRs to `main`.
  Include acceptance criteria, verification evidence, and one teammate approval.
- Keep secrets out of clients and Git. Keep mobile compatible with API changes.
- Hosting and AI provider/model are TBD; illness-specific behavior is deferred.
- Instruction-file override: the owner requested both files. Keep `AGENTS.md`
  authoritative and `CLAUDE.md` a forwarder. When running `setup-matt-pocock-skills`,
  write or update its `## Agent skills` block here, overriding its default file choice.

## Agent skills

- Before writing, reviewing, or debugging React Native / Expo code, read and follow
  [react-native-best-practices](.agents/skills/react-native-best-practices/SKILL.md)
  and its relevant sub-skills. See [usage conventions](docs/development.md#react-native--expo-skill).

## References

- [Architecture overview](docs/architecture.md) — hosting, how clients reach the database, AI generation, app structure
- [Product scope](docs/product.md)
- [Development, code conventions, and checks](docs/development.md)
- [Coding principles: DRY, SOLID, clean code](docs/code-principles.md)
- [Local runtime status](docs/deployment.md)
- [Feature and review template](docs/features/TEMPLATE.md)
- [Grilling session decisions](docs/grilling-summary.md)
- [Mobile review decisions, 3 October](docs/mobile-review-2026-10-03.md) — newer where they differ
- [Design reference: screens, tokens, preview](design/README.md) — read before building UI
- [Mobile app on Supabase](docs/features/mobile-supabase-integration.md) — the default backend: Supabase Auth, the remote adapter, configuration and what is deferred
- [Web app and guest mode](docs/features/web-app.md) — the Expo web build as a responsive panel, guest entry, GitHub Pages deployment
- [Mobile app on a mocked API](docs/features/mobile-mock-app.md) — the opt-in offline mock (`EXPO_PUBLIC_API_MODE=mock`), the demo account and Demo controls

The Expo app (phones and web), the Supabase product API and wearable packages exist. CI is
the GitHub Pages workflow (build on pull requests, deploy from `main`/`develop`); the NestJS
backend is planned. Do not claim planned commands or checks are already available.
