# Supabase API: frontend handoff

Contract version: **1**. Prepared on 3 October 2026; extended on 4 October 2026.
Status: **local source and contracts verified**. The 4 October migrations,
routes (late feedback, opinions, Undo, catalog seed) and the Gemini adapter are
deployed to the hosted project. The Google Calendar token route
(POST /google/token) and the google_calendar availability source are NOT
deployed yet; see section 12.

Send this file to the web/mobile developer. It describes the implemented local
PoC contract, with complete JSON payloads that can be used as mock responses.
All IDs, sport rows, users, and dates below are synthetic. Examples form a sample
workflow; replace IDs and dates with values returned by the API when connecting.
Never replay these UUIDs against live accounts. The catalog seed migration adds
the sport rows; no users, plans, or demo data are seeded.

The full mobile design has additional requirements listed at the end. Those
features are not endpoints in this contract. The earlier proposed v2 schema
does not describe the implemented API.

## 1. Connection and authentication

Base URL after owner deployment:

`https://<PROJECT_REF>.supabase.co/functions/v1/product-api`

For every application request:

`Authorization: Bearer <SUPABASE_SESSION_ACCESS_TOKEN>`

`apikey: <SUPABASE_PUBLISHABLE_KEY>`

For PUT/POST also send `Content-Type: application/json`.
Use the Supabase Auth SDK for registration, email/password, Google sign-in,
session refresh, recovery, and sign-out. This API has no login/register route.
The client must receive a session before calling it; registration may require
email confirmation first. Google and recovery redirects are owner configuration.
Web-only guest bootstrap is not implemented. Mobile has no guest entry.

Never put a service-role key in either client. Never send owner IDs in request
bodies: the server derives ownership from the verified session. Owner IDs in
response entities are informational. Do not write application history tables
directly; use these mutation endpoints.

Success: `{ data, meta: { contract_version: "1", request_id: UUID | null } }`.
Error: `{ error: { code, message, retryable }, meta }`.
Gateway/Auth/network failures can have a different shape; normalize them before
rendering. Request bodies are limited to 32 KiB.

## 2. Endpoints

All paths below are relative to the base URL, and require a session.

| Method | Path | Request | Response data |
| --- | --- | --- | --- |
| GET | /schema | None | Dictionary of named JSON schemas |
| GET | /profile | None | ProfileEntity |
| PUT | /profile | UpdateProfileDto | ProfileEntity |
| GET | /sports | None | SportEntity[] |
| GET | /plans/current | None | {plan, version} or null |
| GET | /plans/history | limit, offset | PlanVersionEntity[] |
| POST | /plans/generate | GeneratePlanDto | {plan, version} |
| POST | /plans/undo | UndoPlanDto | {plan, version} |
| GET | /chat/messages | plan_id, limit, offset | ChatMessageEntity[] |
| POST | /chat | SendChatDto | {outcome, active_plan, messages} |
| GET | /completions | limit, offset | ActivityCompletionEntity[] |
| POST | /completions | CompleteActivityDto | ActivityCompletionEntity |
| PUT | /completions/feedback | UpdateFeedbackDto | ActivityCompletionEntity |
| GET | /opinions | None | ActivityOpinionEntity[] |
| PUT | /opinions | PutOpinionDto | ActivityOpinionEntity or null |
| POST | /opinions/reset | ResetOpinionsDto ({}) | {cleared} |
| POST | /google/token | GoogleTokenDto | {access_token, expires_in} |

Pagination: limit defaults to 50 (1–100); offset defaults to 0 (0–10000).
Collections are plain arrays inside data. Fetch pages until fewer than limit
rows are returned. Reload after writes. History is newest first, completions
newest first, and chat messages oldest first. GET /chat/messages requires plan_id.
GET /opinions is not paged and returns the newest updated_at first.
GET /schema uses the same success envelope; data contains the named schemas.
There is no realtime subscription contract in this slice.

## 3. Database schema and response entities

These tables are prepared migrations, not claims about hosted tables. Fields
below use PostgreSQL types; nested JSON shapes are defined by the payloads and
shared runtime schemas. All application tables have RLS enabled.

| Table / entity | Fields | Client access and relationships |
| --- | --- | --- |
| profile / ProfileEntity | id uuid; username text nullable; created_at timestamptz nullable; preferences jsonb nullable. Database also stores email text nullable; API omits email. | Owner read/update; id references auth.users. Signup provisions one profile. |
| sport / SportEntity | id bigint identity; name text; is_gym boolean; generation_enabled boolean; metrics jsonb | Authenticated reads; catalog writes are server/owner work. API IDs are decimal strings. Names are unique ignoring case. API requires valid nonempty names and metric definitions even though legacy DB columns permit nulls. |
| plan / PlanEntity | id uuid; profile_id uuid; active_version_id uuid nullable; created_at timestamptz | Owner read only. One plan row per profile; active_version_id must belong to that plan and owner. |
| plan_version / PlanVersionEntity | id uuid; plan_id uuid; profile_id uuid; version integer; origin text; plan jsonb; summary text; created_at timestamptz | Owner read only. Unique plan/version number. Origin is generate, revise, or undo. plan stores a complete weekly snapshot. |
| chat_message / ChatMessageEntity | id uuid; profile_id uuid; plan_id uuid; role text; content text; outcome text nullable; plan_version_id uuid nullable; created_at timestamptz; request_id uuid | Owner read only. Role user/assistant; assistant outcome plan_updated/reply/clarification. Plan/version references enforce ownership. |
| activity_completion / ActivityCompletionEntity | id uuid; profile_id uuid; plan_version_id uuid; activity_id uuid; metrics jsonb; gym_log jsonb; feedback jsonb nullable; completed_at timestamptz; request_id uuid | Owner read only. Completion is unique per owner/activity and retains the version it was completed against. Only feedback can change later, through PUT /completions/feedback. |
| activity_opinion / ActivityOpinionEntity | profile_id uuid; activity_key text; title text; sport_id bigint; opinion text; last_date date; updated_at timestamptz | Owner read/write under RLS through this API. One row per owner/activity_key. sport_id references sport. The server stamps updated_at. |
| product_request_receipt / internal | profile_id uuid; request_id uuid; action text; payload jsonb; result jsonb; created_at timestamptz | No client access. Server deduplication across plan/chat/completion actions. Not a frontend entity. |

Legacy workout, tournament, and wearable storage are outside this API. Do not
dual-write completions into the legacy workout table.

IDs are UUID strings, except sport IDs: transport positive PostgreSQL bigint
values as decimal strings, never JS numbers. Dates use YYYY-MM-DD; timestamps
use ISO 8601 with Z or an explicit offset. Timezone is an IANA name. Arrays of
IDs must be unique. Unknown request fields are rejected.

### Nested contract rules

| Shape | Fields / constraints |
| --- | --- |
| Preferences | starting_comfort: starting_out/occasionally_active/some_routine; sessions_per_week: integer 1–7; session_minutes: 5–60 in steps of 5; preferred_window: null or start_hour/end_hour within 7–21, end greater than start |
| Preferences continued | activity_interests/excluded_activity_types: up to 20 catalog IDs each; discovery_preference: selected_only/occasional/explore; no interests requires explore; timezone: IANA name |
| Preferences options | available_locations: one or more of home/outdoors/gym/pool; available_equipment: mat/resistance_band/dumbbells/bicycle/stationary_bike; avoidances: jumping/floor_exercises/noisy_activities; starting_obstacles: time/low_energy/boredom/uncertainty/discomfort. Empty optional arrays are valid. |
| Sport metrics | At most five definitions with unique key; label; unit string or null; type number/text; required boolean; optional minimum/maximum. Key matches lowercase letter then up to 39 lowercase letters/digits/underscores. Numeric bounds cannot be inverted. |
| Weekly snapshot | week_start, timezone, activities: zero to seven unique planned activities within that local week, with no time overlap |
| Planned activity | id, sport_id, title (1–200 characters), description (1–2000), start_at, duration_minutes (5–60 in steps of 5), gym_exercises. Non-gym exercises are []. Version summary is 1–1000 characters. |
| Planned gym exercise | Unique id, name, sets: 1–10 objects with repetitions (integer 1–100). At most 20 exercises. No AI-generated weights. Timed sets are not implemented. |
| Availability | source: device_calendar/google_calendar/manual; captured_at; slots: up to 100 sorted, nonoverlapping start_at/end_at intervals with positive duration. Send only free time, never private calendar events. Chat message is 1–2000 characters; attached activity_id is optional. |
| Completion metrics | At most five number/string values matching the sport's definitions, required keys, types, and bounds. Numbers are finite and nonnegative; strings at most 200 characters. No invented values for missing optional measurements. |
| Gym actuals | gym_log: up to 20 unique exercise_id entries from the plan; each has 1–10 sets with repetitions integer 0–100 and weight_kg null or number 0–1000. Non-gym gym_log is []. |
| Feedback | effort: easy/okay/hard/too_much; enjoyment: yes/maybe/no/null; notes: string at most 1000 characters, empty when absent. All three keys required. A completion's feedback may be null until it is given. |
| Opinion | activity_key: 1–100 characters matching ^[a-z0-9][a-z0-9_-]*$ (for example a title slug); title: 1–200; sport_id: catalog ID; opinion: yes/maybe/no (null in PutOpinionDto clears it); last_date: YYYY-MM-DD |

In this PoC, enjoyment answers **Would you choose this again?** at log time. Null
means no opinion, not no. Okay displays as **Just right**. Send null from the
completion screen when it does not ask for an opinion. The opinion that can be
changed or reset later lives separately in /opinions (section 8).

Metric values use the catalog's declared unit. The sample duration_minutes field
is minutes. This contract has no separate display/storage scale: do not blindly
send parser seconds or meters to a field labelled minutes or kilometers. An
import fills the form locally, the person reviews it, and POST /completions saves
only the chosen measurements. Do not upload filenames, files, GPS routes, or raw
sensor samples here. The prototype's description/value_schema catalog is wider
than this implemented label/type DTO; boolean/enum fields are not supported yet.

## 4. Profile and onboarding

GET /profile after initial signup (before answers):

```json
{
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "username": null,
    "created_at": "2026-10-03T12:00:00Z",
    "preferences": null
  },
  "meta": {
    "contract_version": "1",
    "request_id": null
  }
}
```

PUT /profile replaces the entire preferences document. Keep fields from other
sections when saving one section; do not PATCH a partial document here.
It saves answers only and does not regenerate the active plan.

```json
{
  "username": "Demo",
  "preferences": {
    "starting_comfort": "starting_out",
    "sessions_per_week": 2,
    "session_minutes": 20,
    "preferred_window": {
      "start_hour": 7,
      "end_hour": 21
    },
    "activity_interests": [
      "1"
    ],
    "discovery_preference": "selected_only",
    "available_locations": [
      "outdoors"
    ],
    "available_equipment": [],
    "avoidances": [],
    "starting_obstacles": [
      "uncertainty"
    ],
    "excluded_activity_types": [],
    "timezone": "Europe/Warsaw"
  }
}
```

PUT response / subsequent GET /profile:

```json
{
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "username": "Demo",
    "created_at": "2026-10-03T12:00:00Z",
    "preferences": {
      "starting_comfort": "starting_out",
      "sessions_per_week": 2,
      "session_minutes": 20,
      "preferred_window": {
        "start_hour": 7,
        "end_hour": 21
      },
      "activity_interests": [
        "1"
      ],
      "discovery_preference": "selected_only",
      "available_locations": [
        "outdoors"
      ],
      "available_equipment": [],
      "avoidances": [],
      "starting_obstacles": [
        "uncertainty"
      ],
      "excluded_activity_types": [],
      "timezone": "Europe/Warsaw"
    }
  },
  "meta": {
    "contract_version": "1",
    "request_id": null
  }
}
```

## 5. Sport catalog

GET /sports sample response:

```json
{
  "data": [
    {
      "id": "1",
      "name": "Running",
      "is_gym": false,
      "generation_enabled": true,
      "metrics": [
        {
          "key": "duration_minutes",
          "label": "Time",
          "unit": "min",
          "type": "number",
          "required": true,
          "minimum": 0
        }
      ]
    }
  ],
  "meta": {
    "contract_version": "1",
    "request_id": null
  }
}
```

The seed migration `20261004110000_sport_catalog_seed.sql` upserts the catalog
by case-insensitive name. The working sports are Walking, Strength (the gym
sport), Running, Cycling, Swimming, Mobility, and Football, with
generation_enabled true. Tennis, Table tennis, Badminton, Padel, Basketball,
Volleyball, Yoga, Pilates, Dancing, Hiking, Nordic walking, Rowing, Climbing,
Ice skating, and Boxing are previews with generation_enabled false. Names match
the mobile mock catalog exactly, so mobile maps rows to its own sport keys by
name. IDs differ between projects: never hardcode them.

Non-gym sports have a required duration_minutes metric (label Time, unit min,
number, minimum 1). Walking, Running, Cycling, Hiking, Nordic walking, and Rowing
add an optional distance in km; Swimming adds an optional distance in m. Strength
has no metrics: its actuals are the gym_log. Build fields from metrics. A sport
with generation_enabled false is a preview; do not offer it as a working
generation choice. Search can run on the fetched catalog; there is no
ranking/suggestions endpoint. A project without the seed returns data: [].

## 6. Plan generation and current plan

POST /plans/generate, first plan:

```json
{
  "request_id": "00000000-0000-4000-8000-000000000005",
  "expected_version": 0,
  "sport_id": null,
  "week_start": "2026-10-05",
  "availability": {
    "source": "manual",
    "captured_at": "2026-10-03T12:00:00Z",
    "slots": [
      {
        "start_at": "2026-10-05T07:00:00+02:00",
        "end_at": "2026-10-05T21:00:00+02:00"
      }
    ]
  }
}
```

Sport_id is a required key: null lets mobile generate from saved preferences;
an explicit catalog ID lets web request one sport. Eligible sports are enabled
and not excluded; selected_only additionally restricts null selection to
activity_interests. Preferences must be saved first. An empty eligible catalog
is a 400 error.

Expected_version is 0 for the first plan. For later generation, pass the current
version number returned by GET /plans/current. Availability must be a real read
or explicitly supplied manual free time. Calendar denial/error is not a
successful read with no free slots. Slots: [] means no available time.

Synthetic successful POST response (also the GET /plans/current data shape):

```json
{
  "data": {
    "plan": {
      "id": "00000000-0000-4000-8000-000000000002",
      "profile_id": "00000000-0000-4000-8000-000000000001",
      "active_version_id": "00000000-0000-4000-8000-000000000003",
      "created_at": "2026-10-03T12:00:00Z"
    },
    "version": {
      "id": "00000000-0000-4000-8000-000000000003",
      "plan_id": "00000000-0000-4000-8000-000000000002",
      "profile_id": "00000000-0000-4000-8000-000000000001",
      "version": 1,
      "origin": "generate",
      "plan": {
        "week_start": "2026-10-05",
        "timezone": "Europe/Warsaw",
        "activities": [
          {
            "id": "00000000-0000-4000-8000-000000000004",
            "sport_id": "1",
            "title": "A gentle walk and jog",
            "description": "Walk comfortably, with short gentle jogs if you feel ready.",
            "start_at": "2026-10-05T09:00:00+02:00",
            "duration_minutes": 20,
            "gym_exercises": []
          }
        ]
      },
      "summary": "Your first gentle session is ready.",
      "created_at": "2026-10-03T12:00:00Z"
    }
  },
  "meta": {
    "contract_version": "1",
    "request_id": "00000000-0000-4000-8000-000000000005"
  }
}
```

No saved plan:

```json
{
  "data": null,
  "meta": {
    "contract_version": "1",
    "request_id": null
  }
}
```

Alternative saved quiet-week state:

```json
{
  "data": {
    "plan": {
      "id": "00000000-0000-4000-8000-000000000002",
      "profile_id": "00000000-0000-4000-8000-000000000001",
      "active_version_id": "00000000-0000-4000-8000-000000000003",
      "created_at": "2026-10-03T12:00:00Z"
    },
    "version": {
      "id": "00000000-0000-4000-8000-000000000003",
      "plan_id": "00000000-0000-4000-8000-000000000002",
      "profile_id": "00000000-0000-4000-8000-000000000001",
      "version": 1,
      "origin": "generate",
      "plan": {
        "week_start": "2026-10-05",
        "timezone": "Europe/Warsaw",
        "activities": []
      },
      "summary": "No session fits this week.",
      "created_at": "2026-10-03T12:00:00Z"
    }
  },
  "meta": {
    "contract_version": "1",
    "request_id": null
  }
}
```

The plan has one global active pointer. For prior weeks, history contains
snapshots and completed records retain their original version. There is no
canonical weekly/calendar projection endpoint yet; one history page is not a
complete month. Never count every historical revision as another session.

GET /plans/history returns data as an array of PlanVersionEntity objects, with
the same version shape shown above, newest first. Every accepted generation,
revision, or Undo increments the version. Old versions are preserved.

**Runtime availability:** the function plans with Gemini when the
GEMINI_API_KEY and GEMINI_MODEL secrets are set. Without them, generation
returns 501 AI_NOT_CONFIGURED after valid prerequisites instead of this sample,
which stays a valid mock response. Gemini output goes through the same
validation; output that still fails after one re-ask returns 502
INVALID_AI_OUTPUT and saves nothing. Gym sessions use exercise IDs from the
mobile exercise library, rep-tracked only, with no weights.

## 7. Chat

POST /chat for an explanation (request ID differs from generation):

```json
{
  "request_id": "00000000-0000-4000-8000-000000000010",
  "plan_id": "00000000-0000-4000-8000-000000000002",
  "expected_version": 1,
  "message": "Could you explain this session?",
  "availability": {
    "source": "manual",
    "captured_at": "2026-10-03T12:00:00Z",
    "slots": [
      {
        "start_at": "2026-10-05T07:00:00+02:00",
        "end_at": "2026-10-05T21:00:00+02:00"
      }
    ]
  }
}
```

Reply response:

```json
{
  "data": {
    "outcome": "reply",
    "active_plan": null,
    "messages": [
      {
        "id": "00000000-0000-4000-8000-000000000020",
        "profile_id": "00000000-0000-4000-8000-000000000001",
        "plan_id": "00000000-0000-4000-8000-000000000002",
        "role": "user",
        "content": "Could you explain this session?",
        "outcome": null,
        "plan_version_id": null,
        "created_at": "2026-10-03T12:00:00Z",
        "request_id": "00000000-0000-4000-8000-000000000010"
      },
      {
        "id": "00000000-0000-4000-8000-000000000021",
        "profile_id": "00000000-0000-4000-8000-000000000001",
        "plan_id": "00000000-0000-4000-8000-000000000002",
        "role": "assistant",
        "content": "Start with a comfortable walk. The plan is unchanged.",
        "outcome": "reply",
        "plan_version_id": "00000000-0000-4000-8000-000000000003",
        "created_at": "2026-10-03T12:00:00Z",
        "request_id": "00000000-0000-4000-8000-000000000010"
      }
    ]
  },
  "meta": {
    "contract_version": "1",
    "request_id": "00000000-0000-4000-8000-000000000010"
  }
}
```

For reply/clarification, active_plan: null means **no replacement in this
response**, not that the saved plan disappeared. Keep the current plan.

POST /chat for a change attached to an activity:

```json
{
  "request_id": "00000000-0000-4000-8000-000000000011",
  "plan_id": "00000000-0000-4000-8000-000000000002",
  "expected_version": 1,
  "message": "Make this session 15 minutes.",
  "activity_id": "00000000-0000-4000-8000-000000000004",
  "availability": {
    "source": "manual",
    "captured_at": "2026-10-03T12:00:00Z",
    "slots": [
      {
        "start_at": "2026-10-05T07:00:00+02:00",
        "end_at": "2026-10-05T21:00:00+02:00"
      }
    ]
  }
}
```

Validated replacement response:

```json
{
  "data": {
    "outcome": "plan_updated",
    "active_plan": {
      "plan": {
        "id": "00000000-0000-4000-8000-000000000002",
        "profile_id": "00000000-0000-4000-8000-000000000001",
        "active_version_id": "00000000-0000-4000-8000-000000000013",
        "created_at": "2026-10-03T12:00:00Z"
      },
      "version": {
        "id": "00000000-0000-4000-8000-000000000013",
        "plan_id": "00000000-0000-4000-8000-000000000002",
        "profile_id": "00000000-0000-4000-8000-000000000001",
        "version": 2,
        "origin": "revise",
        "plan": {
          "week_start": "2026-10-05",
          "timezone": "Europe/Warsaw",
          "activities": [
            {
              "id": "00000000-0000-4000-8000-000000000004",
              "sport_id": "1",
              "title": "A gentle walk and jog",
              "description": "Walk comfortably, with short gentle jogs if you feel ready.",
              "start_at": "2026-10-05T09:00:00+02:00",
              "duration_minutes": 15,
              "gym_exercises": []
            }
          ]
        },
        "summary": "Your upcoming session is now 15 minutes.",
        "created_at": "2026-10-03T12:00:00Z"
      }
    },
    "messages": [
      {
        "id": "00000000-0000-4000-8000-000000000022",
        "profile_id": "00000000-0000-4000-8000-000000000001",
        "plan_id": "00000000-0000-4000-8000-000000000002",
        "role": "user",
        "content": "Make this session 15 minutes.",
        "outcome": null,
        "plan_version_id": null,
        "created_at": "2026-10-03T12:00:00Z",
        "request_id": "00000000-0000-4000-8000-000000000011"
      },
      {
        "id": "00000000-0000-4000-8000-000000000023",
        "profile_id": "00000000-0000-4000-8000-000000000001",
        "plan_id": "00000000-0000-4000-8000-000000000002",
        "role": "assistant",
        "content": "Your upcoming session is now 15 minutes.",
        "outcome": "plan_updated",
        "plan_version_id": "00000000-0000-4000-8000-000000000013",
        "created_at": "2026-10-03T12:00:00Z",
        "request_id": "00000000-0000-4000-8000-000000000011"
      }
    ]
  },
  "meta": {
    "contract_version": "1",
    "request_id": "00000000-0000-4000-8000-000000000011"
  }
}
```

Replace the displayed active plan immediately when plan_updated succeeds.
There is no confirmation step. A completed activity cannot be altered or
removed from a same-week revision. Failed validation leaves the plan intact.
There is no server diff: build a change card by comparing the new version with
the previous one (GET /plans/history) by activity id.

To undo that revision, POST /plans/undo with the active plan and version and a
new request ID:

```json
{
  "request_id": "00000000-0000-4000-8000-000000000009",
  "plan_id": "00000000-0000-4000-8000-000000000002",
  "expected_version": 2
}
```

Response, a new active version with origin undo:

```json
{
  "data": {
    "plan": {
      "id": "00000000-0000-4000-8000-000000000002",
      "profile_id": "00000000-0000-4000-8000-000000000001",
      "active_version_id": "00000000-0000-4000-8000-000000000010",
      "created_at": "2026-10-03T12:00:00Z"
    },
    "version": {
      "id": "00000000-0000-4000-8000-000000000010",
      "plan_id": "00000000-0000-4000-8000-000000000002",
      "profile_id": "00000000-0000-4000-8000-000000000001",
      "version": 3,
      "origin": "undo",
      "plan": {
        "week_start": "2026-10-05",
        "timezone": "Europe/Warsaw",
        "activities": [
          {
            "id": "00000000-0000-4000-8000-000000000004",
            "sport_id": "1",
            "title": "A gentle walk and jog",
            "description": "Walk comfortably, with short gentle jogs if you feel ready.",
            "start_at": "2026-10-05T09:00:00+02:00",
            "duration_minutes": 20,
            "gym_exercises": []
          }
        ]
      },
      "summary": "The last change was undone.",
      "created_at": "2026-10-03T12:10:00Z"
    }
  },
  "meta": {
    "contract_version": "1",
    "request_id": "00000000-0000-4000-8000-000000000009"
  }
}
```

Undo makes no AI call and writes no chat messages. It restores the version just
before the active one when the active version came from a chat revision and
both are in the same week. Anything else returns 409 NOTHING_TO_UNDO, including
an Undo of an Undo. If a session the change touched is already logged, Undo
returns 409 UNDO_LOCKED, so a logged session never changes. A transport retry
with the same request ID and body returns the saved result.

A clarification has the same SendChatDto shape with a new request ID and a
message such as "Can you change it?". After the example revision, pass
expected_version 2. Response:

```json
{
  "data": {
    "outcome": "clarification",
    "active_plan": null,
    "messages": [
      {
        "id": "00000000-0000-4000-8000-000000000024",
        "profile_id": "00000000-0000-4000-8000-000000000001",
        "plan_id": "00000000-0000-4000-8000-000000000002",
        "role": "user",
        "content": "Can you change it?",
        "outcome": null,
        "plan_version_id": null,
        "created_at": "2026-10-03T12:00:00Z",
        "request_id": "00000000-0000-4000-8000-000000000012"
      },
      {
        "id": "00000000-0000-4000-8000-000000000025",
        "profile_id": "00000000-0000-4000-8000-000000000001",
        "plan_id": "00000000-0000-4000-8000-000000000002",
        "role": "assistant",
        "content": "Which upcoming day would you like to change?",
        "outcome": "clarification",
        "plan_version_id": "00000000-0000-4000-8000-000000000013",
        "created_at": "2026-10-03T12:00:00Z",
        "request_id": "00000000-0000-4000-8000-000000000012"
      }
    ]
  },
  "meta": {
    "contract_version": "1",
    "request_id": "00000000-0000-4000-8000-000000000012"
  }
}
```

GET /chat/messages?plan_id=<PLAN_UUID> returns persisted ChatMessageEntity
objects in data, oldest first. Both messages returned by POST are already
persisted; merge by message ID rather than adding duplicates on retry/refetch.
Quick-reply arrays and extra-workout outcomes are not part of this contract.
Without the Gemini secrets, chat also returns 501 AI_NOT_CONFIGURED after
valid prerequisites. With them, a revision keeps the IDs of activities it
keeps, mints new IDs for added ones, and returns completed and past sessions
of the week unchanged, so a client diff by activity ID stays meaningful.

## 8. Completion and feedback

POST /completions for the revised activity:

```json
{
  "plan_version_id": "00000000-0000-4000-8000-000000000013",
  "activity_id": "00000000-0000-4000-8000-000000000004",
  "request_id": "00000000-0000-4000-8000-000000000014",
  "metrics": {
    "duration_minutes": 12
  },
  "gym_log": [],
  "feedback": {
    "effort": "too_much",
    "enjoyment": null,
    "notes": "Stopped early."
  },
  "completed_at": "2026-10-05T09:12:00+02:00"
}
```

Response:

```json
{
  "data": {
    "plan_version_id": "00000000-0000-4000-8000-000000000013",
    "activity_id": "00000000-0000-4000-8000-000000000004",
    "request_id": "00000000-0000-4000-8000-000000000014",
    "metrics": {
      "duration_minutes": 12
    },
    "gym_log": [],
    "feedback": {
      "effort": "too_much",
      "enjoyment": null,
      "notes": "Stopped early."
    },
    "completed_at": "2026-10-05T09:12:00+02:00",
    "id": "00000000-0000-4000-8000-000000000015",
    "profile_id": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "contract_version": "1",
    "request_id": "00000000-0000-4000-8000-000000000014"
  }
}
```

Use the exact activity and version IDs returned by the API. Metrics must match
the sport catalog. Completed_at records the actual completion instant; the
server rejects a value more than five minutes ahead of its clock. The synthetic
dates above must be replaced when making real requests.

For a gym activity, use its exercise IDs and an actual set payload like:

```json
{
  "plan_version_id": "00000000-0000-4000-8000-000000000018",
  "activity_id": "00000000-0000-4000-8000-000000000017",
  "request_id": "00000000-0000-4000-8000-000000000016",
  "metrics": {},
  "gym_log": [
    {
      "exercise_id": "squat",
      "sets": [
        {
          "repetitions": 8,
          "weight_kg": 8
        },
        {
          "repetitions": 6,
          "weight_kg": null
        }
      ]
    }
  ],
  "feedback": {
    "effort": "too_much",
    "enjoyment": null,
    "notes": "Stopped early."
  },
  "completed_at": "2026-10-05T09:12:00+02:00"
}
```

This alternate example is valid structurally only when the referenced activity
is a gym session that contains exercise_id squat and its catalog permits the
supplied metrics. Replace the synthetic gym activity/version IDs with real
returned IDs. Never generate a planned weight. Null actual weight means unknown.

To save the log before asking for feedback, send feedback: null:

```json
{
  "plan_version_id": "00000000-0000-4000-8000-000000000013",
  "activity_id": "00000000-0000-4000-8000-000000000004",
  "request_id": "00000000-0000-4000-8000-000000000019",
  "metrics": {
    "duration_minutes": 12
  },
  "gym_log": [],
  "feedback": null,
  "completed_at": "2026-10-05T09:12:00+02:00"
}
```

Then add or change the feedback at any later time:

```json
{
  "completion_id": "00000000-0000-4000-8000-000000000015",
  "feedback": {
    "effort": "okay",
    "enjoyment": "yes",
    "notes": ""
  }
}
```

The response is the whole completion with the new feedback:

```json
{
  "data": {
    "plan_version_id": "00000000-0000-4000-8000-000000000013",
    "activity_id": "00000000-0000-4000-8000-000000000004",
    "request_id": "00000000-0000-4000-8000-000000000014",
    "metrics": {
      "duration_minutes": 12
    },
    "gym_log": [],
    "feedback": {
      "effort": "okay",
      "enjoyment": "yes",
      "notes": ""
    },
    "completed_at": "2026-10-05T09:12:00+02:00",
    "id": "00000000-0000-4000-8000-000000000015",
    "profile_id": "00000000-0000-4000-8000-000000000001"
  },
  "meta": {
    "contract_version": "1",
    "request_id": null
  }
}
```

Only the owner can change feedback; another account gets 404. A full feedback
object is required here (null is rejected).

GET /completions returns the saved entity array, newest first. Join by
activity_id to show completion; keep plan_version_id for historical detail.
No completion does not establish that an activity was skipped or started.
Completion metrics, sets, and completed_at cannot be edited through this API.

### Opinions: "Would you choose this again?"

Opinions are kept per activity, apart from completions, so they can change or
be cleared later. GET /opinions returns the account's opinions, newest first:

```json
{
  "data": [
    {
      "activity_key": "a-gentle-walk-and-jog",
      "title": "A gentle walk and jog",
      "sport_id": "1",
      "opinion": "yes",
      "last_date": "2026-10-05",
      "updated_at": "2026-10-05T09:30:00Z"
    }
  ],
  "meta": {
    "contract_version": "1",
    "request_id": null
  }
}
```

PUT /opinions saves (inserts or replaces) the opinion for one activity_key:

```json
{
  "activity_key": "a-gentle-walk-and-jog",
  "title": "A gentle walk and jog",
  "sport_id": "1",
  "opinion": "yes",
  "last_date": "2026-10-05"
}
```

Response:

```json
{
  "data": {
    "activity_key": "a-gentle-walk-and-jog",
    "title": "A gentle walk and jog",
    "sport_id": "1",
    "opinion": "yes",
    "last_date": "2026-10-05",
    "updated_at": "2026-10-05T09:30:00Z"
  },
  "meta": {
    "contract_version": "1",
    "request_id": null
  }
}
```

Send opinion: null with the same fields to clear it; the response data is then
null. POST /opinions/reset with an empty object clears every opinion of the
account and returns how many were cleared:

```json
{
  "data": {
    "cleared": 1
  },
  "meta": {
    "contract_version": "1",
    "request_id": null
  }
}
```

The client picks a stable activity_key (for example a slug of the session
title). title, sport_id, and last_date describe the latest session for display.
An unknown sport_id returns 400. Reset never touches completions, saved
answers, or excluded sports.

### Google Calendar access token

The client connects Google Calendar through Supabase Auth (Google sign-in or
identity linking with the calendar.freebusy and calendar.app.created scopes,
offline access). Supabase hands the Google access and refresh tokens to the
client once, right after that sign-in. The client keeps them on the device and
calls Google Calendar directly: it reads free/busy only, never event titles,
and may write planned sessions to a calendar the app created. Google access
tokens last about an hour. To get a new one, POST the stored refresh token:

```json
{
  "refresh_token": "synthetic-google-refresh-token"
}
```

Response:

```json
{
  "data": {
    "access_token": "synthetic-google-access-token",
    "expires_in": 3599
  },
  "meta": {
    "contract_version": "1",
    "request_id": null
  }
}
```

The function holds the OAuth client secret (function secrets
GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET) and never stores or logs
the tokens. Without both secrets it answers 501 GOOGLE_NOT_CONFIGURED. When
Google rejects the refresh token (revoked access, a changed password, or an
expired grant) it answers 409 GOOGLE_RECONNECT_REQUIRED; the client then asks
the person to reconnect Google Calendar. This is not a 401, so it never looks
like an expired Supabase session. Google outages return 502
PROVIDER_UNAVAILABLE (retryable).

Free time read from Google goes into generation and chat as availability with
source google_calendar. It is handled exactly like device_calendar: only the
slots matter, and an empty slot array still means no free time. A failed
Google read is never sent as an empty google_calendar result; the client falls
back to the device calendar or manual slots.

## 9. Empty lists, errors, and retries

Empty history, messages, or completions use the same collection envelope:

```json
{
  "data": [],
  "meta": {
    "contract_version": "1",
    "request_id": null
  }
}
```

Version conflict:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "The plan changed elsewhere. Reload it before retrying.",
    "retryable": false
  },
  "meta": {
    "contract_version": "1",
    "request_id": "00000000-0000-4000-8000-000000000011"
  }
}
```

| HTTP | Codes | Client handling |
| --- | --- | --- |
| 400 | INVALID_REQUEST | Fix fields/prerequisites; do not repeat unchanged invalid input |
| 401 | UNAUTHENTICATED | Refresh or sign in |
| 404 | NOT_FOUND | Reload the owned record; do not invent a replacement ID |
| 409 | VERSION_CONFLICT | Reload plan, confirm the intended change, create a new request ID |
| 409 | REQUEST_CONFLICT | Request ID was reused with different data/action; use a new ID for new work |
| 409 | ALREADY_COMPLETED | Reload completions and show the existing result |
| 409 | NOTHING_TO_UNDO | Hide Undo; the active version is not an undoable chat change |
| 409 | UNDO_LOCKED | Hide Undo; a session in the change is already logged |
| 409 | GOOGLE_RECONNECT_REQUIRED | Google rejected the refresh token: ask the person to reconnect Google Calendar |
| 501 | GOOGLE_NOT_CONFIGURED | The Google secrets are missing: refresh is unavailable; ask the person to reconnect when the token expires |
| 405 / 413 | METHOD_NOT_ALLOWED / PAYLOAD_TOO_LARGE | Correct method or reduce body |
| 501 | AI_NOT_CONFIGURED | Show unavailable/provider-pending state; no automatic retry loop |
| 502 / 503 | INVALID_AI_OUTPUT / PROVIDER_UNAVAILABLE / DATA_UNAVAILABLE | Display failure; respect retryable; retain the current plan |
| 500 | INTERNAL_ERROR | Display failure; retain state and respect retryable |

For transport failure, retry with **the same UUID and identical DTO**, including
availability captured_at. Generate a new UUID for each new action, including
completion. Do not reuse a successful generation UUID for chat/completion.
Receipts replay the saved result before another AI call. Receipts do not replace
version checks for a new action. Disable duplicate submits while a request runs.

## 10. Frontend integration sequence

1. Authenticate with Supabase and wait for a session.
2. Load profile and sports; show onboarding when preferences is null.
3. Save the full preferences JSON.
4. Capture manual/device free slots; generate with expected_version 0 or the
   existing active version, and a new UUID.
5. Display the returned plan snapshot; handle both no saved plan and saved
   empty week. Join completions separately.
6. Chat sends plan ID, expected version, optional attached activity ID, message,
   availability, and a new UUID. Apply only validated replacement responses.
7. Log actual metrics/sets and save the completion with its own UUID, with
   feedback or with null and PUT /completions/feedback later.
8. Read and write opinions through /opinions; Undo the newest chat change with
   POST /plans/undo.
9. Optional Google Calendar: keep the Google tokens on the device and refresh
   the access token with POST /google/token.
10. Refetch after successful writes and normalize Auth/gateway/network failures.

Shared monorepo import: `@hackyeah/contracts/product`. Request DTOs:
UpdateProfileDto, GeneratePlanDto, SendChatDto, CompleteActivityDto,
UpdateFeedbackDto, PutOpinionDto, ResetOpinionsDto, UndoPlanDto, GoogleTokenDto. Entities:
ProfileEntity, SportEntity, PlanEntity, PlanVersionEntity, ChatMessageEntity,
ActivityCompletionEntity, ActivityOpinionEntity. Response DTOs and apiSchemas
are exported alongside them. No client UI is shared between web and mobile.

Machine-readable companions in docs/api: product-api.openapi.json,
product-api.schemas.json, product-api.examples.json, and
product-api.design-examples.json. Those files and this document regenerate with
`npm run schema:product`; embedded JSON is validated against the runtime schemas.

## 11. Features still missing from the full mobile design

| Feature | Required next work |
| --- | --- |
| Weekly Home/Calendar and outcomes | Canonical weekly/calendar projection and persisted started/skipped states |
| Complete gym experience | Timed sets, actual duration, stable exercise catalog/history, last-weight prefill |
| All dynamic log fields/import states | Boolean/enum metrics, storage/display unit conversion, provenance |
| Chat change cards | Undo is implemented (POST /plans/undo). Change cards are a client diff of two versions; there is no canonical server diff |
| Workouts outside the plan | Separate extra-workout records, edit/Undo; no planned progress credit |
| Feedback management | Implemented: late/changed feedback (PUT /completions/feedback) and mutable opinions with reset (/opinions). Completion actuals remain immutable |
| Assistant profile summary | Separate specified AI call, evidence references, validation, freshness and fallback |
| Web guest demo | Isolated anonymous bootstrap, demo data and AI limits |

Profile edits do not trigger plan regeneration on the server; the mobile app
regenerates the active week itself when planning answers change. Concurrent
full-document edits have no profile revision guard yet. Device steps, local
appearance, calendar permission state, and navigation do not need Supabase
persistence. Private calendar event contents never go to this API.

## 12. Owner action to make the API available

Repository instructions prohibit this agent from remote migrations/deployment;
no hosted changes were made. Applying database migrations alone does not deploy
the HTTP API or connect AI. The owner must complete these steps:

1. Confirm the intended Supabase project and review the migration files. Verify
   the changes in a disposable Supabase project before the hosted project.
2. Apply and record `20261003130000_profile_sport_workout_baseline.sql` first,
   then `20261003140000_product_persistence.sql`,
   `20261004100000_feedback_opinions_undo.sql`, and
   `20261004110000_sport_catalog_seed.sql`. They live under
   supabase/migrations. Review the earlier wearable migration separately before
   syncing the entire migration directory. The seed adds catalog rows and
   profile rows for accounts without one; it adds no users or plans.
3. Verify signup creates singular profile rows, owner-only access works, and
   another account cannot see or modify application history. Re-run advisors.
4. Verify Auth provider/confirmation/recovery settings and allowlisted web/mobile
   redirects. Actual Google/email sign-in has not been exercised here.
5. Run the real Supabase/Deno function checks and deploy the product-api function
   from supabase/functions/product-api/index.ts with the checked-in config and
   dependencies. Supply SUPABASE_URL and a publishable key (platform legacy anon
   fallback is supported); privileged persistence uses SUPABASE_SERVICE_ROLE_KEY
   inside the function only. Never share the server-only key with a client.
   Clients receive only the project URL and publishable configuration.
6. The seed migration provides the catalog. For AI success, set the function
   secrets with `supabase secrets set GEMINI_API_KEY=<KEY> GEMINI_MODEL=<MODEL_ID>`
   (there is no default model). Without them generation and chat return 400
   for missing prerequisites or 501 AI_NOT_CONFIGURED. Undo, feedback, and
   opinions need no AI.
7. Share the actual base URL and client publishable configuration securely with
   the frontend developer, then smoke-test the authenticated journey on web and
   Expo. Confirm cross-account isolation and failed-revision preservation.
8. For Google Calendar, set the Web OAuth client that Supabase Auth uses as
   function secrets with
   `supabase secrets set GOOGLE_OAUTH_CLIENT_ID=<CLIENT_ID> GOOGLE_OAUTH_CLIENT_SECRET=<CLIENT_SECRET>`
   and redeploy product-api. In Google Cloud, enable the Google Calendar API and
   add the calendar.freebusy and calendar.app.created scopes to the consent
   screen. In Supabase Auth, turn on manual identity linking so email accounts
   can connect Google Calendar.

Local verification already completed: the Supabase tests passed (including the
Gemini adapter against canned answers and the Google token route against a
fake Google endpoint), Supabase typechecks passed, and
Supabase lint and formatting passed. This does not prove hosted Auth, Deno
bundling, a live Gemini call, or actual device/browser operation. Supabase CLI
and Deno are not installed here.
