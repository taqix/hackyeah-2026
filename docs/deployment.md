# Runtime status

The [Supabase product API](features/supabase-product-api.md) now has local migration,
function, DTO, and schema artifacts. They have not been applied/deployed remotely.
Local CPU tests validate database rules and the HTTP handler; actual Supabase CLI,
Deno, Auth provider, and device/browser integration checks remain owner work.

The current backend milestone is local only. There is no cloud infrastructure,
registry, deployment workflow, or hosted API.

From the repository root, run `npm ci` and then either `npm run dev:backend`
for TypeScript watch mode or `docker compose up --build` for the containerized
backend. Both expose `GET http://localhost:3000/health`, returning
`{"status":"ok"}`. Stop Compose with `docker compose down`.

Keep local environment values in ignored `apps/backend/.env` files. The
container uses the configuration in `compose.yaml`; add any local-only values
there or through a Compose environment file when a feature needs them.

Hosting, release automation, and rollback procedures will be designed only when
the team resumes deployment work.
