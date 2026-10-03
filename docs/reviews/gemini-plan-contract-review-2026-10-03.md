# Gemini plan contract: rebase, review and fixes

- Date: 2026-10-03
- Branch: `codex/gemini-plan-contract`
- Target: fetched `origin/develop` at `42049b1`
- Original branch tip: `5795035`
- Rebased feature tip before review fixes: `882f99e`

## Result

The four feature commits were rebased onto the current remote development branch.
The rebase preserved the NestJS backend introduced on `develop` and the shared
Gemini create/modify planning exchange. All five findings below were fixed.
Three subagents handled backend integration, Docker packaging and catalog validation;
the main agent integrated the fixes, hardened provider parsing and ran final checks.
Nothing was pushed; the remote branch remains unchanged.

The session's main checkout was on `codex/gemini-plan-generation`, so work was
performed in the existing worktree for the explicitly requested contract branch.
That clean worktree was temporarily moved under the project's writable
`.worktrees/` directory with permission, then restored to its original location
at `/Users/piotrgdanski/.codex/worktrees/gemini-plan-contract/hackyeah-2026`.

## Rebase conflict resolutions

- `apps/backend/package.json`: retained Nest build/dev/production/lint commands
  and dependencies; added the contracts dependency and ESM adapter exports.
- `apps/backend/tsconfig.json`: retained Nest decorator metadata while adopting
  NodeNext, declarations and strict indexed access required by the plan modules.
- `package-lock.json`: regenerated from the development lockfile for the merged
  workspace dependencies. Kept npm; no package-manager migration.
- `README.md`: retained development's Movo README and added the Gemini docs link.

## Findings and fixes

| ID  | Priority | Finding and impact                                                                                                                                                                                                                              | Fix                                                                                                                                                                                                                                                                     | Status                            |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| F1  | P1       | The adapter requires ESM, but the newly merged Nest bootstrap used extensionless imports and `require.main`. Builds/startup would fail under the ESM backend package. Standalone backend checks also depended on contracts already being built. | Added `.js` imports and an ESM direct-entry guard; preserved Nest server behavior and decorator metadata. Added contracts build prerequisites to backend build/dev/test/typecheck scripts.                                                                              | Fixed                             |
| F2  | P1       | Docker copied only the backend manifest/source and flattened its output into the root package. The new workspace dependency, compiled contract schemas, ESM package boundary and planning prompt would be missing.                              | Build/install backend plus contracts workspaces; preserve runtime workspace layout; copy contracts output and prompt; start the backend inside its ESM package.                                                                                                         | Fixed; actual image build pending |
| F3  | P2       | Running every test through tsx loses the decorator metadata needed by Nest. The backend ESLint project also excluded tests, and existing plan tests did not satisfy its promise/unused-variable rules.                                          | Compile tests with TypeScript into ignored `.test-dist`, copy fixture/prompt assets, run emitted JavaScript, include the test TypeScript project in ESLint, explicitly void test registrations and allow deliberate rest-property omission. Apply the shared formatter. | Fixed                             |
| F4  | P2       | The provider response was assigned directly to a trusted envelope type, causing TS2322 with the development Node typings and leaving malformed envelope shape unchecked.                                                                        | Keep provider JSON as `unknown`; inspect records, candidate arrays and parts before reading text; malformed envelopes produce explicit `INVALID_RESPONSE` errors.                                                                                                       | Fixed                             |
| F5  | P2       | Integer metrics accepted fractional bounds such as `[0.1, 0.9]`, which contain no integer. A required metric then made generated workout output impossible to validate.                                                                         | Reject integer intervals when `ceil(minimum) > floor(maximum)`; preserve valid integer boundaries, one-sided bounds and fractional number metrics.                                                                                                                      | Fixed                             |

## Relevant files

- F1: [bootstrap](../../apps/backend/src/main.ts),
  [Nest module](../../apps/backend/src/app.module.ts),
  [backend scripts](../../apps/backend/package.json),
  [compiler configuration](../../apps/backend/tsconfig.json).
- F2: [Dockerfile](../../apps/backend/Dockerfile),
  [environment template](../../apps/backend/.env.example),
  [backend packaging notes](../features/backend-bootstrap.md).
- F3: [compiled test runner](../../apps/backend/scripts/test.mjs),
  [test compiler](../../apps/backend/tsconfig.test.json),
  [ESLint configuration](../../apps/backend/eslint.config.mjs),
  [health test](../../apps/backend/test/health.test.ts),
  [plan tests](../../apps/backend/test/plan.test.ts),
  [ignored generated output](../../.gitignore).
- F4: [provider parsing and errors](../../apps/backend/src/create-plan.ts),
  with malformed-envelope regressions in the plan test suite.
- F5: [metric validation](../../packages/contracts/src/plan.ts),
  [catalog regression tests](../../apps/backend/test/catalog-validation.test.ts).

## Verification evidence

| Check                                                   | Result                                                                                                                                                                                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git merge-base --is-ancestor origin/develop HEAD`      | Passed; rebased branch contains the fetched target.                                                                                                                                                                    |
| `npm ci --ignore-scripts`                               | Passed with registry/cache permission. Initial system Node 25 install emitted engine warnings.                                                                                                                         |
| `npm run test:plans`                                    | Backend/contracts build passed; all 39 backend tests passed. HTTP test required permission to bind localhost.                                                                                                          |
| `node apps/backend/scripts/test.mjs` using Node 22.23.3 | All 39 tests passed, including real HTTP `/health`, provider mocks and catalog regressions.                                                                                                                            |
| `npm run typecheck` using Node 22.23.3                  | Passed across backend, mobile, contracts and wearable-data.                                                                                                                                                            |
| `npm run lint` using Node 22.23.3                       | Passed across all workspaces. Expo required access to its local settings directory.                                                                                                                                    |
| `npm run format:check`                                  | Passed for backend source, tests and runner with the shared formatter configuration.                                                                                                                                   |
| Shared-plan/fixture/doc Prettier check                  | Passed.                                                                                                                                                                                                                |
| `npm run test:wearables`                                | 38 tests across 3 files passed; shared-contract changes preserve wearable behavior.                                                                                                                                    |
| Compiled production-entry smoke using Node 22.23.3      | Started `apps/backend/dist/main.js`; `/health` returned HTTP 200, `{status: "ok"}` and `Cache-Control: no-store`. Compiled adapter loaded its prompt/contracts and returned the expected plan using a mocked provider. |
| Isolated Docker runtime dependency dry run              | Resolved 108 production packages, including backend/contracts and excluding Expo/React Native.                                                                                                                         |
| `git diff --check`                                      | Passed.                                                                                                                                                                                                                |

The integer-metric regression failed before its fix (missing expected exception
for `[0.1, 0.9]`) and all three catalog tests passed afterward. The new malformed
provider-envelope regression covers null/scalar/array responses, invalid candidate
containers and missing or non-content parts. Existing tests retain coverage for
completed-history protection, deletions/replacements, slots/buffers, timezone/DST,
weekly frequency, catalog matching, provider failures and oversized conversations.

## Remaining limits and review requirements

- Docker is not installed here. Run `docker compose up --build` and verify
  `/health` before considering the revised image/container behavior verified.
- No live Gemini request was made. Provider acceptance of catalog-specific
  schemas still needs a smoke check with the selected model and server credentials.
- Authenticated plan endpoints, persistence transactions, ownership enforcement,
  version replacement and content policy review remain deferred integration work
  documented by the feature; the adapter itself does not persist plans.
- No mobile UI code changed and no plan UI consumes this exchange on this branch.
  Workspace mobile lint/type checks passed; no device/emulator smoke was run.
- The initial dependency install reported 38 audit vulnerabilities. No broad
  dependency upgrades were made during this focused review; the audit report
  was not triaged and is not a new verified finding attributed to this branch.
- Feature review targets `develop`; obtain the required teammate approval before
  merging. Push requires the owner's approval. Because the branch was rebased,
  a future update to its existing remote branch will require a history rewrite
  protected by `--force-with-lease`; no such update was attempted.
