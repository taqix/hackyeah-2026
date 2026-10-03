# Supabase API: frontend handoff

Contract version: **1**. Prepared on 3 October 2026.
Status: **local source and contracts verified; NOT applied or deployed to hosted Supabase**.

Send this file to the web/mobile developer. It describes the implemented local
PoC contract, with complete JSON payloads that can be used as mock responses.
All IDs, sport rows, users, and dates below are synthetic. Examples form a sample
workflow; replace IDs and dates with values returned by the API when connecting.
Never replay these UUIDs against live accounts. No catalog or demo data is seeded.

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
| GET | /chat/messages | plan_id, limit, offset | ChatMessageEntity[] |
| POST | /chat | SendChatDto | {outcome, active_plan, messages} |
| GET | /completions | limit, offset | ActivityCompletionEntity[] |
| POST | /completions | CompleteActivityDto | ActivityCompletionEntity |

Pagination: limit defaults to 50 (1–100); offset defaults to 0 (0–10000).
Collections are plain arrays inside data. Fetch pages until fewer than limit
rows are returned. Reload after writes. History is newest first, completions
newest first, and chat messages oldest first. GET /chat/messages requires plan_id.
GET /schema uses the same success envelope; data contains the named schemas.
There is no realtime subscription contract in this slice.

## 3. Database schema and response entities

These tables are prepared migrations, not claims about hosted tables. Fields
below use PostgreSQL types; nested JSON shapes are defined by the payloads and
shared runtime schemas. All application tables have RLS enabled.

| Table / entity | Fields | Client access and relationships |
| --- | --- | --- |
| profile / ProfileEntity | id uuid; username text nullable; created_at timestamptz nullable; preferences jsonb nullable. Database also stores email text nullable; API omits email. | Owner read/update; id references auth.users. Signup provisions one profile. |
| sport / SportEntity | id bigint identity; name text; is_gym boolean; generation_enabled boolean; metrics jsonb | Authenticated reads; catalog writes are server/owner work. API IDs are decimal strings. API requires valid nonempty names and metric definitions even though legacy DB columns permit nulls. |
| plan / PlanEntity | id uuid; profile_id uuid; active_version_id uuid nullable; created_at timestamptz | Owner read only. One plan row per profile; active_version_id must belong to that plan and owner. |
| plan_version / PlanVersionEntity | id uuid; plan_id uuid; profile_id uuid; version integer; origin text; plan jsonb; summary text; created_at timestamptz | Owner read only. Unique plan/version number. Origin is generate or revise. plan stores a complete weekly snapshot. |
| chat_message / ChatMessageEntity | id uuid; profile_id uuid; plan_id uuid; role text; content text; outcome text nullable; plan_version_id uuid nullable; created_at timestamptz; request_id uuid | Owner read only. Role user/assistant; assistant outcome plan_updated/reply/clarification. Plan/version references enforce ownership. |
| activity_completion / ActivityCompletionEntity | id uuid; profile_id uuid; plan_version_id uuid; activity_id uuid; metrics jsonb; gym_log jsonb; feedback jsonb; completed_at timestamptz; request_id uuid | Owner read only. Completion is unique per owner/activity and retains the version it was completed against. |
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
| Availability | source: device_calendar/manual; captured_at; slots: up to 100 sorted, nonoverlapping start_at/end_at intervals with positive duration. Send only free time, never private calendar events. Chat message is 1–2000 characters; attached activity_id is optional. |
| Completion metrics | At most five number/string values matching the sport's definitions, required keys, types, and bounds. Numbers are finite and nonnegative; strings at most 200 characters. No invented values for missing optional measurements. |
| Gym actuals | gym_log: up to 20 unique exercise_id entries from the plan; each has 1–10 sets with repetitions integer 0–100 and weight_kg null or number 0–1000. Non-gym gym_log is []. |
| Feedback | effort: easy/okay/hard/too_much; enjoyment: yes/maybe/no/null; notes: string at most 1000 characters, empty when absent. All three keys required. |

In this PoC, enjoyment answers **Would you choose this again?** Null means no
opinion, not no. Okay displays as **Just right**. Send null from the completion
screen when it does not ask for an opinion. Updating/resetting an opinion later
is not implemented.

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

The actual hosted catalog is not seeded by these migrations. An empty catalog
returns data: []. Do not hardcode the sample ID or generation eligibility.
Build fields from metrics. A sport with generation_enabled false is a preview;
do not offer it as a working generation choice. Search can run on the fetched
PoC catalog; there is no ranking/suggestions endpoint.

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
the same version shape shown above, newest first. Every accepted generation or
revision increments the version. Old versions are preserved.

**Runtime availability:** the provider adapter is unconnected. After valid
prerequisites, generation returns 501 AI_NOT_CONFIGURED, not this successful
sample. Clients can mock the sample while the AI collaborator adds the adapter.

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
Change diff/Undo is not implemented; do not show a working Undo button.

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
The unconnected runtime chat adapter also returns AI_NOT_CONFIGURED after
valid prerequisites; these successes are mocks.

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

GET /completions returns the saved entity array, newest first. Join by
activity_id to show completion; keep plan_version_id for historical detail.
No completion does not establish that an activity was skipped or started.
Completion metrics, sets, and feedback cannot be edited through this API.

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
7. Log actual metrics/sets and feedback; save completion using its own UUID.
8. Refetch after successful writes and normalize Auth/gateway/network failures.

Shared monorepo import: `@hackyeah/contracts/product`. Request DTOs:
UpdateProfileDto, GeneratePlanDto, SendChatDto, CompleteActivityDto. Entities:
ProfileEntity, SportEntity, PlanEntity, PlanVersionEntity, ChatMessageEntity,
ActivityCompletionEntity. Response DTOs and apiSchemas are exported alongside
them. No client UI is shared between web and mobile.

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
| Chat change cards and Undo | Canonical diff and transactional restore as a new version |
| Workouts outside the plan | Separate extra-workout records, edit/Undo; no planned progress credit |
| Feedback management | Independently mutable opinions/reset while actual completion data remains immutable |
| Assistant profile summary | Separate specified AI call, evidence references, validation, freshness and fallback |
| Web guest demo | Isolated anonymous bootstrap, demo data and AI limits |

Profile edits do not trigger plan regeneration. Concurrent full-document edits
have no profile revision guard yet. Device steps, local appearance, calendar
permission state, and navigation do not need Supabase persistence. Private
calendar event contents never go to this API.

## 12. Owner action to make the API available

Repository instructions prohibit this agent from remote migrations/deployment;
no hosted changes were made. Applying database migrations alone does not deploy
the HTTP API or connect AI. The owner must complete these steps:

1. Confirm the intended Supabase project and review the migration files. Verify
   the changes in a disposable Supabase project before the hosted project.
2. Apply and record `20261003130000_profile_sport_workout_baseline.sql` first,
   then `20261003140000_product_persistence.sql`. They live under
   supabase/migrations. Review the earlier wearable migration separately before
   syncing the entire migration directory. No seed rows are included.
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
6. For catalog/AI success, provide reviewed enabled sport definitions and connect
   the PlanGenerator provider adapter. Until then catalog reads can be empty;
   generation returns 400 for missing prerequisites or 501 for disconnected AI.
7. Share the actual base URL and client publishable configuration securely with
   the frontend developer, then smoke-test the authenticated journey on web and
   Expo. Confirm cross-account isolation and failed-revision preservation.

Local verification already completed: 21 Supabase tests passed, workspace and
Supabase typechecks passed, and Supabase/contracts lint and formatting passed.
This does not prove hosted Auth, Deno bundling, provider integration, or actual
device/browser operation. Supabase CLI and Deno are not installed here.
