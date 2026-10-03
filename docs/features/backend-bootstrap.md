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

The Docker build now builds the shared contracts workspace before the backend.
The runtime preserves both workspace package boundaries for ESM exports and
includes the contracts' compiled JSON schemas and the backend planning prompt.
Only backend and contracts production dependencies are installed; Expo remains
excluded. `GEMINI_API_KEY` and `GEMINI_MODEL` are server-side configuration for
plan generation and are optional for `/health` startup.

## Verification

- `npm ci`, formatting, workspace lint/typecheck, backend build, and HTTP test:
  passed locally.
- The Docker image and Compose service served `/health` locally.
- Expo device smoke check: not applicable to this backend-only change.

The Gemini contract review updated the Docker layout described above. An isolated
production workspace-install dry run resolved 108 packages and confirmed that
backend/contracts are included while Expo and React Native are excluded. The
Docker CLI is unavailable in that review environment, so the revised image and
Compose service still require a container build and `/health` smoke check before
merge.

## Review and documentation

- [x] Acceptance criteria and verification evidence recorded here.
- [ ] One teammate approves the PR and required checks pass on GitHub.
- [x] README, development, and runtime docs updated.
- [x] No secrets are committed.
