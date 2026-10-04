# Runtime status

The [Supabase product API](features/supabase-product-api.md) now has local migration,
function, DTO, and schema artifacts. They have not been applied/deployed remotely.
Local CPU tests validate database rules and the HTTP handler; actual Supabase CLI,
Deno, Auth provider, and device/browser integration checks remain owner work.

The current backend milestone is local only. There is no cloud infrastructure,
registry, or hosted API; the only deployment workflow publishes the website (see
[Website](#website)).

From the repository root, run `npm ci` and then either `npm run dev:backend`
for TypeScript watch mode or `docker compose up --build` for the containerized
backend. Both expose `GET http://localhost:3000/health`, returning
`{"status":"ok"}`. Stop Compose with `docker compose down`.

Keep local environment values in ignored `apps/backend/.env` files. The
container uses the configuration in `compose.yaml`; add any local-only values
there or through a Compose environment file when a feature needs them.

AI generation is currently a server-side function, not an HTTP endpoint. See
[AI plan generation](features/ai-plan-generation.md#local-setup-and-usage) for
credentials, function usage, and container configuration. A successful health
check does not verify the AI provider.

Hosting, release automation, and rollback procedures will be designed only when
the team resumes deployment work.

## Website

The marketing site in `apps/website` is the one hosted part of the project. On
every push to `main` or `develop` that touches `apps/website/**` or
`package-lock.json`, `.github/workflows/pages.yml` typechecks it, builds it with
Vite and publishes `apps/website/dist` to GitHub Pages at
https://taqix.github.io/hackyeah-2026/. To roll back, revert the commit and push;
the workflow redeploys the previous version.
