# Feature: local backend bootstrap

Status: ready for review
Owner: backend seat
Issue/PR: add when opened

## Problem and user outcome

The repository had only an Expo starter. A teammate needs a repeatable NestJS
start command and a stable health endpoint, including a local Docker option.

## Scope

- Included: NestJS TypeScript workspace, `GET /health`, local watch command,
  HTTP test, backend build, Dockerfile, and Docker Compose.
- Deferred: product endpoints, Supabase, AI, web dashboard, and cloud hosting.
- Affected areas: backend, root scripts, local runtime documentation.

## Acceptance criteria

- [x] `GET /health` responds with HTTP 200 and exactly `{"status":"ok"}`.
- [x] `npm run dev:backend` starts the API on port 3000, with optional `PORT`
  and `HOST` values in `apps/backend/.env`.
- [x] A real HTTP test covers the health response.
- [x] `docker compose up --build` runs the backend on local port 3000.
- [x] The Docker image contains backend runtime dependencies, not Expo.

## Design and compatibility

- API contract: `GET /health` returns a stable status body and no-store header.
- Data migration: none.
- Mobile compatibility: no existing mobile API calls are changed.
- AI behavior: not applicable.

## Verification

- `npm ci`, formatting, workspace lint/typecheck, backend build, and HTTP test:
  passed locally.
- The Docker image and Compose service served `/health` locally.
- Expo device smoke check: not applicable to this backend-only change.

## Review and documentation

- [x] Acceptance criteria and verification evidence recorded here.
- [ ] One teammate approves the PR and required checks pass on GitHub.
- [x] README, development, and runtime docs updated.
- [x] No secrets are committed.
