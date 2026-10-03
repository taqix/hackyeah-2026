# Grilling session summary

This records decisions agreed with the team during the product and engineering
interview. Detailed procedures live in the linked docs rather than agent files.

## Product decisions

| Topic | Agreement |
| --- | --- |
| Audience | Inactive adults unsure how to start exercising. |
| Outcome | Choose a sport and complete an encouraging beginner activity. |
| Personalization | Questionnaire and preferences inform sport suggestions and plans. |
| Working MVP sports | Gym, fitness, running, football. |
| Other sports | Clearly marked mockup/preview content until implemented. |
| Plans | AI-generated multi-day beginner plans, adjustable through chat. |
| Revisions | Valid revisions replace the active plan immediately, without a confirmation step. Preserve previous versions and completed activities. |
| Feedback | Record activity completion and how the activity felt. |
| Health scope | General wellbeing; treatment recommendations are outside the MVP. Illness-specific behavior is deferred. |
| Accounts | Email/password with Supabase Auth. |
| Guest entry | One button creates a separate anonymous identity with seeded demo data. |
| Web | Marketing pages and a dashboard supporting the same core journey. |
| Mobile | Primary client; Expo runs locally for judging. |

## Engineering decisions

- Six teammates collaborate through branches and PRs, with one teammate review.
- NestJS/TypeScript backend, React web, React Native/Expo mobile.
- `apps/backend`, `apps/web`, `apps/mobile`, and shared `packages/contracts`.
- Supabase supplies Auth and PostgreSQL; NestJS owns application logic, data
  authorization, AI integration, and runtime validation.
- Shared TypeScript, linting, and formatting conventions across environments.
- Required gates: formatting, linting, type checks, relevant tests, backend/web
  builds, and a documented Expo smoke check for affected changes.
- Keep API changes compatible with the locally running mobile demo or coordinate
  its update explicitly.
- Deploy backend/web from `main` after successful checks. Also support a manual
  CLI trigger that runs the same checked CI deployment workflow.
- Keep `AGENTS.md` and `CLAUDE.md` compact; use detailed docs and a feature template
  for procedures, acceptance criteria, verification, deployment, and rollback.
- Both instruction files were explicitly requested. Keep `AGENTS.md` authoritative
  and `CLAUDE.md` a forwarder; route setup-skill instruction edits to `AGENTS.md`
  instead of the skill's default `CLAUDE.md` target.

## Repository facts discovered after the interview

The fetched `develop` branch already contains an Expo SDK 57 starter, npm
workspaces, root mobile commands, and `package-lock.json`. Preserve this work.
pnpm remains the agreed target and requires a coordinated migration, not a
silent package-manager switch. Backend, standalone web dashboard, shared
packages, Supabase configuration, and CI remain to be built.

The team reports a push-lint service, but its configuration/check name is not
present locally. Wire its actual status into branch protection when CI is set up.

This documentation branch starts from `develop`. The documented workflow uses
feature PRs into `develop` and release PRs from `develop` into `main`.

## Deliberately deferred

- AI provider/model and detailed generation prompts.
- Hosting providers, credentials, spending limit, and implementation deadline.
- Exact questionnaire fields, suggestion rules, and multi-day horizon.
- Illness-specific plan adjustments.
- Public-launch data retention, guest cleanup, and account conversion.

These items must be settled before implementing or claiming their corresponding
capability; they are not silently chosen by this documentation plan.

## Deliverables

- [AGENTS.md](../AGENTS.md): shared compact agent instructions.
- [CLAUDE.md](../CLAUDE.md): points Claude to the shared instructions.
- [Product plan](product.md): journey, MVP boundaries, and acceptance targets.
- [Development plan](development.md): current setup, target architecture,
  conventions, PR workflow, checks, and implementation sequence.
- [Deployment plan](deployment.md): triggers, migrations, secrets, smoke checks,
  and rollback requirements.
- [Feature template](features/TEMPLATE.md): repeatable feature/review checklist.
