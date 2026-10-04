# Project instructions

Build a beginner sport app for inactive adults: preferences, sport suggestions,
AI-generated multi-day plans, completion, and feedback. Read the relevant docs
below before changing a feature.

- Monorepo: `apps/backend` (NestJS), `apps/web` (React), `apps/mobile` (Expo),
  `apps/website` (React marketing site and demo, deployed to GitHub Pages).
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
- Guest entry (web only; mobile has none) creates an isolated anonymous identity
  with seeded demo data.
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

- [Product scope](docs/product.md)
- [Development, code conventions, and checks](docs/development.md)
- [Coding principles: DRY, SOLID, clean code](docs/code-principles.md)
- [Local runtime status](docs/deployment.md)
- [Feature and review template](docs/features/TEMPLATE.md)
- [Grilling session decisions](docs/grilling-summary.md)
- [Mobile review decisions, 3 October](docs/mobile-review-2026-10-03.md) — newer where they differ
- [Design reference: screens, tokens, preview](design/README.md) — read before building UI
- [Mobile app on Supabase](docs/features/mobile-supabase-integration.md) — the default backend: Supabase Auth, the remote adapter, configuration and what is deferred
- [Mobile app on a mocked API](docs/features/mobile-mock-app.md) — the opt-in offline mock (`EXPO_PUBLIC_API_MODE=mock`), the demo account and Demo controls

An Expo starter and wearable contracts/extraction packages exist. Backend, dashboard and CI are planned;
do not claim planned commands or checks are already available.
