# Supabase-only MVP architecture

Status: historical architecture proposal; implementation scope has changed
Date: 2026-10-03

For the implemented proof of concept, use
[the product API feature](../../features/supabase-product-api.md) and
[the frontend handoff](../../api/FRONTEND_HANDOFF.md). The provider adapter,
guest bootstrap, and request limits described below are not implemented. The
current API uses the version 1 contracts documented in those files.

## Outcome and scope

The proof of concept lets an inactive adult sign in or enter as a guest, save
preferences, generate a real multi-day beginner plan with Gemini, complete an
activity, and revise the active plan through chat. The same Supabase project
serves web and mobile. A successful chat revision becomes active immediately;
earlier versions and completion records remain available.

This is the minimum working product path, not a production account lifecycle.
The four working sports remain gym, fitness, running, and football. Other sports
may be labeled previews but cannot be submitted for plan generation. Illness-
specific behavior, guest account conversion, wearable ingestion, and public-
launch retention are outside this slice.

## Architecture decision

Supabase Auth manages email/password, Google, and anonymous guest identities.
Clients use the Supabase SDK for sign-in, session refresh, and owner-scoped reads
and writes. PostgreSQL stores application data behind row-level security (RLS).
The teammate-owned Gemini Edge Function performs the two AI operations: initial
plan generation and chat revision. A PostgreSQL RPC performs the atomic plan
version change. NestJS remains in the repository but is not a runtime dependency
of this MVP path. There are no NestJS registration, login, or plan endpoints in
this slice.

The existing `docs/product.md` and `docs/development.md` describe NestJS as the
application API and AI owner. Update those documents when this design is
implemented so that the proof-of-concept runtime is described accurately.

## Units and interfaces

| Unit                   | Responsibility                                                                                                       | Boundary                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Supabase Auth          | Issue and refresh sessions for email/password, Google, and guests                                                    | Clients call Auth directly; no app password storage                                       |
| Product tables and RLS | Store preferences, plans, versions, completions, and chat history; restrict rows by Auth user ID                     | Clients may read owner data and update preferences with their JWT                         |
| Gemini Edge Function   | Authenticate caller, load owner data, call Gemini, validate generated output, request atomic save                    | One authenticated function with `generate` and `revise` actions                           |
| Plan-save RPC          | Check ownership and expected active version; insert a valid new version and switch active version in one transaction | Executable only by the Edge Function's server role; receives the verified caller ID       |
| Shared contracts       | Define request, response, plan, and error shapes                                                                     | Pure TypeScript/Zod in `packages/contracts`, compatible with clients and the Edge runtime |

The existing Gemini collaborator owns the provider adapter and prompt. The
Supabase collaborator owns function integration. This spec defines their common
input/output and persistence behavior; it does not create a second Gemini
implementation. The function's actual name can be chosen by its owner, but its
`generate` and `revise` actions must use the same contract.

## Minimal data model

- `preferences`: one row per Auth user, including selected working sport and the
  few questionnaire fields required by the plan prompt. The request schema sets
  explicit size and value limits.
- `plans`: one logical plan per owner for this proof of concept, with an
  `active_version_id` reference. A later implementation may support multiple
  plans without changing version semantics.
- `plan_versions`: immutable numbered versions, the validated structured plan
  JSON, creation time, and origin (`generate` or `revise`). Each activity has a
  stable identifier within its version.
- `activity_completions`: owner, plan version, activity identifier, completion
  time, and short feedback. It is independent of the current active version.
- `chat_messages`: owner, plan, user message, and result status. A successful
  revision records the resulting version; a failed revision records a concise
  failure state without storing provider errors or secrets.

Every user-owned table has an owner UUID tied to `auth.users.id`. RLS permits
only that owner to read their rows and update preferences. Completion writes
go through an owner-checking RPC that verifies the activity exists in the named
plan version. Anonymous Auth users receive the
`authenticated` database role, so guest isolation uses the same owner rule;
the publishable project key alone is not a guest identity. Keep privileged
Supabase and Gemini keys out of clients.

## Auth and guest flow

Clients call Supabase Auth directly for email/password signup and login, Google
OAuth, and `signInAnonymously()` for guest entry. Registration handles the
project's email-confirmation setting explicitly: when no session is returned,
the client shows a verification-required state. Google redirect URLs must be
allowlisted for each client before smoke testing.

After anonymous sign-in, a single idempotent guest-bootstrap operation seeds
demo preferences, a plan, and activity history for the caller's new Auth user ID.
Repeat calls do not duplicate rows. A guest can then use the same generation and
revision contract, subject to 10 AI requests per guest identity per day. Guest account
conversion and cleanup are later decisions.

## Plan generation and revision flow

The clients invoke the authenticated Gemini Edge Function with one of these
bounded requests:

- `generate`: `{ action: "generate", sport, expectedVersion, requestId }`.
  The function reads the caller's saved preferences and accepts only a working
  sport. It asks Gemini for a structured beginner plan. `expectedVersion` is
  `0` for an account without a plan or the current version when replacing a
  seeded guest plan.
- `revise`: `{ action: "revise", planId, expectedVersion, message, requestId }`.
  The function reads the caller's active version and bounded recent chat
  context, then asks Gemini for a complete replacement plan plus a short
  explanation of the change.

The function parses Gemini output as untrusted data. The shared schema checks
the sport, plan shape, bounded day/activity counts and durations, unique activity
IDs, schedule consistency, and beginner scope. The function invokes the plan-
save RPC only after validation. The function verifies the caller's JWT and
passes that verified user ID to a server-only RPC. The RPC rejects another
user's plan and compares `expectedVersion` with the current active
version. It inserts the new immutable version and changes the active pointer in
one transaction. `requestId` is unique per owner and action so a retry cannot
save the same revision twice. The RPC is not executable by ordinary
`authenticated` or `anon` database roles, and its privileged queries always
filter by the verified owner ID. A failed or invalid generation creates no
partial active plan.

Completion writes use the owner-checking completion RPC and refer to their
original `plan_version_id` and activity ID.
A revision never deletes or rewrites completion history. A stale simultaneous
revision reports a conflict so the client can reload the current plan and let
the user retry.

## Responses and failures

The function returns the active plan version, validated plan, and short change
summary on success. Errors use a small shared shape with a stable code and a
human-readable retry message. Invalid request input returns 400; missing or
invalid session returns 401; another user's plan is inaccessible; stale version
returns 409; provider timeout or invalid model output returns a retryable 502.
Provider failures do not change the active plan. Rate limits and payload caps
apply to guest AI calls, chat text, and generated JSON.

The clients show loading, verification-required, empty, failure, and retry
states. They do not display provider internals. Logs record operation and
request IDs without passwords, tokens, Gemini keys, or raw chat text.

## Delivery order and verification

1. Agree the shared plan/request/error schemas and the Gemini function contract
   with the two Supabase collaborators.
2. Add local Supabase configuration, product-table migration, RLS policies, and
   the atomic plan-save RPC. Keep the existing wearable migration intact.
3. Connect the collaborator's Gemini function to the schemas and RPC. Add guest
   bootstrap and AI-use limits.
4. Wire Auth and the vertical journey in clients after the function contract is
   stable. Use the existing npm workspace toolchain; migrate to pnpm only through
   the coordinated migration in `docs/development.md`.
5. Update the product, development, runtime, and feature docs to describe the
   Supabase-only proof-of-concept path.

Tests must demonstrate two-user isolation (including two guests), valid
generation, invalid Gemini output leaving the active plan unchanged, a successful
chat revision activating a new version, stale-revision conflict, idempotent
retries, and completion records surviving revisions. Run local migration and
function tests, relevant workspace lint/type checks, then a browser and Expo
device smoke journey with email/password and Google accounts. Record actual
results in the feature review document; do not treat planned checks as passed.

## Practical limits

The proof of concept relies on the Gemini Edge Function and Supabase project
that collaborators are already configuring. The exact Gemini model is their
configuration choice; the plan contract and validation are model-independent.
Supabase Edge Functions are suitable for short AI orchestration, but a provider
call that exceeds the platform response timeout must return a retryable failure.
The first slice does not promise public-launch guest retention, account
conversion, background jobs, or production rate-limit policy.
