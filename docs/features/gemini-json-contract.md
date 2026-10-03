# Gemini JSON contract

This is the implemented request/response reference for the universal workout
planning exchange on `codex/gemini-plan-generation`. The backend entry point is
`generatePlan(request, options)` from `@hackyeah/backend`; `createPlan` is an alias
accepting the same contract. Types, `parsePlanInput`, `parsePlanOutput`, and schema
builders are exported from `@hackyeah/contracts/plan`.

The exchange returns validated operations. Loading database records, deriving
calendar availability, storing conversation, and applying plan revisions belong
to the calling application. This contract replaces the previous JSON format;
the old `session_minutes`, start/end slots, and description/series output are
not accepted.

## Time representation

Every time slot has exactly these fields:

```json
{
  "start": "2026-10-05T12:05:00+02:00",
  "duration": 600
}
```

`start` is an ISO 8601 date-time with an explicit UTC offset, including `Z`.
`duration` is a positive number of **seconds**, and the derived end is
`start + duration`. This representation applies to `planning_window`, each
`available_slots` entry, and each workout's `time_slot`. `preferred_duration`
and `buffer_seconds` also use seconds. A metric uses its catalog's documented
unit; it does not automatically use seconds unless it represents whole-session
duration.

`preferences.timezone` is a valid IANA timezone, such as `Europe/Warsaw`. It
determines local dates, five-minute start alignment, and Monday–Sunday week
counts. The caller calculates planning-window instants from local boundaries;
a week crossing a daylight-saving transition need not be 604800 seconds.

## Request fields

All top-level fields below are required. Empty arrays are valid where no context
is available. Additional object fields are rejected by the contract schemas.

| Field                  | Meaning                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                 | `create` adds workouts to a planning window; `modify` returns changes requested through chat.                                                       |
| `planning_window`      | Start/duration boundary for all added workouts and workouts being deleted. It can target the current week, next week, or another explicit interval. |
| `preferences`          | Required preference object described below.                                                                                                         |
| `available_slots`      | Calendar free intervals computed by the application. Supply raw free time, without subtracting the sport buffers again.                             |
| `user_description`     | Profile text for personalization. An empty string is allowed.                                                                                       |
| `sports`               | Database-derived catalog containing the sports the model can add. IDs are numeric database identifiers, not a fixed enum of English names.          |
| `previous_week_events` | Previous-week workout context.                                                                                                                      |
| `current_week_events`  | Current-week workout context.                                                                                                                       |
| `target_window_events` | Existing workouts relevant to the target planning window, including workouts beyond the current week.                                               |
| `conversation`         | Entire preceding conversation, in chronological order, as `{ "role": "user" \| "assistant", "content": "..." }` objects. Content must be non-blank. |
| `user_prompt`          | Newest non-blank user message for `modify`; must be `null` for `create`. This message is excluded from `conversation` to avoid duplication.         |

The conversation contains user and assistant messages, not system or tool roles.
It provides references for follow-ups such as “Tuesday instead.” Earlier
assistant replies do not authorize changing protected workouts. The adapter
sends the complete context and does not silently truncate it; oversized requests
fail explicitly. Chronological ordering and excluding the newest message are
caller responsibilities, not conditions the JSON validator can establish.

### Preferences

| Field                     | Required | Accepted value                                                                                    |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `timezone`                | Yes      | Valid IANA timezone.                                                                              |
| `starting_comfort`        | Yes      | `starting_out`, `occasionally_active`, `some_routine`.                                            |
| `sessions_per_week`       | Yes      | Any integer.                                                                                      |
| `preferred_duration`      | Yes      | Positive number of seconds; no fixed 5/10/20-minute enum.                                         |
| `activity_interests`      | Yes      | Unique sport IDs from `sports`; may be empty.                                                     |
| `available_locations`     | Yes      | Non-empty unique list of `home`, `outdoors`, `gym`, `pool`.                                       |
| `available_equipment`     | Yes      | Unique list of `mat`, `resistance_band`, `dumbbells`, `bicycle`, `stationary_bike`; may be empty. |
| `discovery_preference`    | Yes      | `selected_only`, `occasional`, `explore`. Empty interests require `explore`.                      |
| `preferred_times`         | No       | Unique list of `morning`, `lunch`, `evening`. These are soft preferences.                         |
| `avoidances`              | No       | Unique list of `jumping`, `floor_exercises`, `noisy_activities`.                                  |
| `starting_obstacle`       | No       | `null`, `time`, `low_energy`, `boredom`, `uncertainty`, `discomfort`.                             |
| `excluded_activity_types` | No       | Unique sport IDs from `sports`, despite the legacy field name.                                    |
| `comfortable_swimming`    | No       | Boolean or `null`.                                                                                |

The prompt interprets morning as local 07:00–11:00, lunch as 11:00–14:00, and
evening as 17:00–21:00, with the upper boundary excluded. Missing or empty
`preferred_times` means no preference.

In creation mode, preferred duration is an upper bound, and weekly frequency
limits weeks receiving additions. In modification mode, duration and frequency
are soft preferences: an explicit chat request can override them for this
request. Saved preferences are not changed. The prompt retains the preferred
values unless chat asks otherwise; structural validation does not prove that
natural-language authorization occurred.

### Existing workouts and deduplication

Sport IDs, workout IDs, preference interest/exclusion IDs and deletion IDs are
JSON numbers containing positive safe integers. Numeric strings are rejected.
For example, sport `1` is Walking and sport `2` is Gym in the examples below;
workouts `101` and `102` are existing activities, not sport IDs.

Each history entry has the same workout fields as an addition, without `action`,
and also:

| Field      | Meaning                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------- |
| `id`       | Stable numeric database workout ID.                                                            |
| `status`   | `planned`, `completed`, or `skipped`.                                                          |
| `editable` | Backend-derived Boolean after checking ownership; a client-provided flag is not authorization. |

The same ID may occur in multiple history arrays. Its complete values must match;
object key ordering is irrelevant, while array ordering is significant. The
validator counts each ID once and rejects contradictory duplicates. History
contains workouts only; calendar events are represented through free time slots.

Historical sport IDs may be absent from the current catalog. History is validated
for its generic workout shape, times, and non-blank instructions, without requiring
historical metrics to match today's catalog.

Completed workouts remain in the schedule and count toward creation frequency.
Skipped workouts do not occupy the resulting schedule and cannot be deleted.
Only known, editable, planned workouts that start strictly in the future and fit
wholly inside the planning window can be deleted.

Supply all relevant existing workouts, including adjacent workouts whose buffers
could conflict with a new workout. The array names do not enforce calendar
membership during validation.

## Sport catalog

Every sport requires `id`, `name`, `description`, and `is_gym`. `is_gym` is `1`
for gym sports and `0` for non-gym sports. IDs are unique positive safe integers
(`1` through `9007199254740991`); names and descriptions must be non-blank.
`buffer_seconds` is optional and non-negative. It applies separately before
and after a workout, defaults to 300 seconds per side, and may be zero. For
example, swimming can specify 900 seconds per side for preparation and changing.

### Non-gym sport

```json
{
  "id": 1,
  "is_gym": 0,
  "name": "Walking",
  "description": "Easy outdoor walking",
  "metrics": [
    {
      "key": "duration",
      "description": "Total workout duration in seconds",
      "required": true,
      "unit": "seconds",
      "represents_session_duration": true,
      "value_schema": {
        "type": "integer",
        "minimum": 1
      }
    },
    {
      "key": "distance",
      "description": "Estimated total distance",
      "required": false,
      "unit": "metres",
      "value_schema": {
        "type": "number",
        "minimum": 0
      }
    }
  ]
}
```

`metrics` is required and may be empty. Each metric requires `key`,
`description`, `required`, and `value_schema`; `unit` and
`represents_session_duration` are optional. Keys are unique within a sport,
at most 64 characters, and match `^[a-zA-Z][a-zA-Z0-9_]*$`.

The supported `value_schema` subset is deliberately limited:

| `type`                | Optional schema keywords                           |
| --------------------- | -------------------------------------------------- |
| `number` or `integer` | `minimum`, `maximum`, numeric `enum`.              |
| `string`              | `minLength`, `maxLength`, string `enum`, `format`. |
| `boolean`             | None.                                              |

String formats are `date`, `date-time`, `time`, and `duration`. Enums must be
non-empty and unique, and every enum member must satisfy the other constraints.
Minimum values/lengths cannot exceed maximum values/lengths. Unknown keywords,
nested objects, arrays, and null metric values are not accepted.

If `represents_session_duration` is true, the schema must be numeric, and `unit`
must be `seconds` when supplied. If that metric appears in an added workout,
its value must equal `time_slot.duration` exactly. The flag does not itself make
the metric required; `required` determines that. Other time metrics can measure
an active portion using their documented units.

### Gym sport

```json
{
  "id": 2,
  "is_gym": 1,
  "name": "Gym",
  "description": "Gentle beginner gym exercises"
}
```

Gym sports do not define `metrics` or `exercises`. They provide sport metadata
only. The model generates exercise names and instructions in gym workout output;
exercises have no database IDs and must not include `exercise_id`.

## Response and operation semantics

The response has exactly `events` and `message`:

```json
{
  "events": [],
  "message": null
}
```

`events` is an operations list, not the complete resulting schedule. Omit
unchanged workouts. To move or edit a workout, delete its ID and add the
replacement. Additions have no ID; the application assigns their IDs. There is
no replacement-link field or `update` operation.

Validation applies all deletions before comparing additions with retained
workouts, regardless of the operations' array order. A deletion cannot reference
an addition in the same response.

### Add a non-gym workout

Required fields are `action: "add"`, `sport_id`, `time_slot`, `description`,
`metrics`, and `parts`. The sport must have `is_gym: 0` in the supplied
catalog. `metrics` contains only the catalog's keys with valid scalar values;
all required metrics must appear. Optional metrics may be omitted. When the
catalog has no metrics, supply `{}`.

`parts` is an ordered non-empty list of objects with only `description`.
Every description must be non-blank and should provide actionable duration,
distance, repetitions, technique, and rest as appropriate. The user should be
able to finish the entire workout from these instructions.

### Add a gym workout

Required fields are `action: "add"`, `sport_id`, `time_slot`, `description`,
and an ordered non-empty `exercises` list. The sport must have `is_gym: 1`.
Each exercise requires non-blank `name` and `description`, plus positive
integer `sets` and `repetitions`. Repetitions are uniform across the sets of
that exercise. Exercises contain no IDs. Gym additions do not contain `metrics`
or `parts`.

Descriptions explain technique, rest, and warm-up/cool-down as appropriate.
The prompt requires all workout activity, rest, and transitions to fit within
the returned duration; free-text timing arithmetic is not checked by the JSON
validator.

### Delete a workout

```json
{
  "action": "delete",
  "id": 101
}
```

Only these two fields are permitted. Deletion is allowed only in modification
mode, using a unique eligible existing ID. Completed, skipped, past, started,
non-editable, unknown, and out-of-window workouts are protected.

### User-facing message and empty operations

For `create`, `message` must be `null`. For `modify`, it must be a non-blank
string, including when `events` is empty. The prompt asks for a concise reply in
the user's language explaining the returned changes, an impossible request,
or a clarification; it must not claim that persistence has already succeeded.

An empty operations list is valid in either mode. Empty availability bypasses
the provider for creation and returns `{ "events": [], "message": null }`.
Modification still calls the provider with empty availability so it can return
deletions or a useful reply; additions cannot fit without a supplied free slot.

## Validation and integration boundary

`parsePlanInput` validates the complete request. `parsePlanOutput(output, input,
now)` expects an already validated, backend-owned input and enforces:

- Exact request/response shapes and catalog-specific workout details, with
  unknown fields rejected and mandatory text non-blank.
- Future added starts on the local five-minute grid: local minutes divisible
  by five, zero seconds, and no fractional seconds.
- Added workouts wholly inside the planning window; their buffers must fit
  inside one supplied free slot. Buffers need not themselves lie inside the
  planning window if the free slot extends beyond it.
- No buffer overlap or second workout on the same local start date, comparing
  every addition with all retained non-skipped workouts and other additions.
- No excluded sports; `selected_only` restricts additions to selected interests.
  Gym additions require `gym` in `available_locations`.
- In creation, no deletions, no added duration above `preferred_duration`, and
  no exceeded `sessions_per_week` in a local Monday–Sunday week receiving an
  addition. Retained planned and completed workouts count toward that limit.
- In modification, known eligible deletion IDs only, with no duplicate
  deletions. Duration/frequency limits are not hard validation limits in this
  mode, but availability, protected workouts, exclusions, and scheduling rules
  still apply.
- Catalog metric formats/bounds and whole-session duration consistency. Gym
  exercise names/instructions must be non-blank, with positive integer sets and
  repetitions and no exercise IDs.

Validation does not reject an unchanged historical schedule solely for its
existing conflicts or mismatch with current preferences. Historical workout
details are not revalidated against today's sport catalog.

The prompt handles readable instructions, appropriate intensity, avoidances,
equipment/location suitability, swimming requirements, and explicit chat intent.
Applications can enforce additional content policies through `reviewContent`.
This optional hook is run after generated output validation and before returning
it; it is not called on the empty-availability creation shortcut.

The application must load owned data, derive `editable`, and recheck ownership,
completion status, and plan version when saving. Apply valid revisions
immediately in a transaction, preserve prior versions and completed activities,
and reject stale changes. The adapter itself does not implement storage or
authenticate a caller.

Input/output contract failures throw `PlanValidationError`. Provider/configuration
failures throw `PlanGenerationError`, including `INPUT_TOO_LARGE` when the
complete request exceeds 2,000,000 UTF-8 bytes. The provider request limit includes
the prompt and generated sport-specific response schema; conversation is never
silently shortened. Provider context limits can still reject a smaller request.

## Complete examples

These request/response pairs reproduce the deterministic backend fixtures. For
validation examples, use an evaluation time before the scheduled workouts, such
as `2026-10-03T10:00:00Z`. They are illustrative operations, not a persistence
receipt. The modification replaces only `101` and leaves `102` unchanged.

### Create a new plan

Request:

```json
{
  "mode": "create",
  "planning_window": {
    "start": "2026-10-05T00:00:00+02:00",
    "duration": 604800
  },
  "preferences": {
    "timezone": "Europe/Warsaw",
    "starting_comfort": "starting_out",
    "sessions_per_week": 2,
    "activity_interests": [1, 2],
    "available_locations": ["outdoors", "gym"],
    "available_equipment": [],
    "preferred_times": ["lunch", "evening"],
    "discovery_preference": "selected_only",
    "avoidances": ["jumping"],
    "starting_obstacle": "time",
    "excluded_activity_types": [],
    "comfortable_swimming": null,
    "preferred_duration": 600
  },
  "available_slots": [
    {
      "start": "2026-10-05T12:00:00+02:00",
      "duration": 1800
    },
    {
      "start": "2026-10-07T18:00:00+02:00",
      "duration": 1800
    }
  ],
  "user_description": "A beginner who works at a desk and wants a gentle start.",
  "sports": [
    {
      "id": 1,
      "is_gym": 0,
      "name": "Walking",
      "description": "Easy outdoor walking",
      "metrics": [
        {
          "key": "duration",
          "description": "Total workout duration in seconds",
          "unit": "seconds",
          "required": true,
          "represents_session_duration": true,
          "value_schema": {
            "type": "integer",
            "minimum": 1
          }
        },
        {
          "key": "distance",
          "description": "Estimated total distance",
          "unit": "metres",
          "required": false,
          "value_schema": {
            "type": "number",
            "minimum": 0
          }
        }
      ]
    },
    {
      "id": 2,
      "is_gym": 1,
      "name": "Gym",
      "description": "Gentle beginner gym exercises"
    }
  ],
  "previous_week_events": [],
  "current_week_events": [],
  "target_window_events": [],
  "conversation": [],
  "user_prompt": null
}
```

Response:

```json
{
  "events": [
    {
      "action": "add",
      "sport_id": 1,
      "time_slot": {
        "start": "2026-10-05T12:05:00+02:00",
        "duration": 600
      },
      "description": "An easy ten-minute outdoor walk.",
      "metrics": {
        "duration": 600,
        "distance": 800
      },
      "parts": [
        {
          "description": "Walk slowly for 2 minutes to warm up."
        },
        {
          "description": "Walk comfortably for 6 minutes, then slow down for 2 minutes."
        }
      ]
    },
    {
      "action": "add",
      "sport_id": 2,
      "time_slot": {
        "start": "2026-10-07T18:05:00+02:00",
        "duration": 600
      },
      "description": "Warm up with 2 minutes of gentle marching. Complete the exercises, then walk slowly for 2 minutes to cool down.",
      "exercises": [
        {
          "name": "Chair squat",
          "sets": 2,
          "repetitions": 5,
          "description": "Sit back toward a stable chair and stand slowly. Rest 30 seconds between sets. Allow 3 minutes including rest."
        },
        {
          "name": "Wall push-up",
          "sets": 2,
          "repetitions": 5,
          "description": "Keep your body straight and bend the elbows toward the wall. Rest 30 seconds between sets. Allow 3 minutes including rest."
        }
      ]
    }
  ],
  "message": null
}
```

### Modify a plan through chat

Request:

```json
{
  "mode": "modify",
  "planning_window": {
    "start": "2026-10-05T00:00:00+02:00",
    "duration": 604800
  },
  "preferences": {
    "timezone": "Europe/Warsaw",
    "starting_comfort": "starting_out",
    "sessions_per_week": 2,
    "activity_interests": [1, 2],
    "available_locations": ["outdoors", "gym"],
    "available_equipment": [],
    "preferred_times": ["lunch", "evening"],
    "discovery_preference": "selected_only",
    "avoidances": ["jumping"],
    "starting_obstacle": "time",
    "excluded_activity_types": [],
    "comfortable_swimming": null,
    "preferred_duration": 600
  },
  "available_slots": [
    {
      "start": "2026-10-05T12:00:00+02:00",
      "duration": 1800
    },
    {
      "start": "2026-10-07T18:00:00+02:00",
      "duration": 1800
    },
    {
      "start": "2026-10-06T12:00:00+02:00",
      "duration": 2400
    }
  ],
  "user_description": "A beginner who works at a desk and wants a gentle start.",
  "sports": [
    {
      "id": 1,
      "is_gym": 0,
      "name": "Walking",
      "description": "Easy outdoor walking",
      "metrics": [
        {
          "key": "duration",
          "description": "Total workout duration in seconds",
          "unit": "seconds",
          "required": true,
          "represents_session_duration": true,
          "value_schema": {
            "type": "integer",
            "minimum": 1
          }
        },
        {
          "key": "distance",
          "description": "Estimated total distance",
          "unit": "metres",
          "required": false,
          "value_schema": {
            "type": "number",
            "minimum": 0
          }
        }
      ]
    },
    {
      "id": 2,
      "is_gym": 1,
      "name": "Gym",
      "description": "Gentle beginner gym exercises"
    }
  ],
  "previous_week_events": [],
  "current_week_events": [],
  "target_window_events": [
    {
      "sport_id": 1,
      "time_slot": {
        "start": "2026-10-05T12:05:00+02:00",
        "duration": 600
      },
      "description": "An easy ten-minute outdoor walk.",
      "metrics": {
        "duration": 600,
        "distance": 800
      },
      "parts": [
        {
          "description": "Walk slowly for 2 minutes to warm up."
        },
        {
          "description": "Walk comfortably for 6 minutes, then slow down for 2 minutes."
        }
      ],
      "id": 101,
      "status": "planned",
      "editable": true
    },
    {
      "sport_id": 2,
      "time_slot": {
        "start": "2026-10-07T18:05:00+02:00",
        "duration": 600
      },
      "description": "Warm up with 2 minutes of gentle marching. Complete the exercises, then walk slowly for 2 minutes to cool down.",
      "exercises": [
        {
          "name": "Chair squat",
          "sets": 2,
          "repetitions": 5,
          "description": "Sit back toward a stable chair and stand slowly. Rest 30 seconds between sets. Allow 3 minutes including rest."
        },
        {
          "name": "Wall push-up",
          "sets": 2,
          "repetitions": 5,
          "description": "Keep your body straight and bend the elbows toward the wall. Rest 30 seconds between sets. Allow 3 minutes including rest."
        }
      ],
      "id": 102,
      "status": "planned",
      "editable": true
    }
  ],
  "conversation": [
    {
      "role": "user",
      "content": "Can we move my Monday walk?"
    },
    {
      "role": "assistant",
      "content": "Which day would work for you?"
    }
  ],
  "user_prompt": "Tuesday instead, and make that walk 15 minutes."
}
```

Response:

```json
{
  "events": [
    {
      "action": "delete",
      "id": 101
    },
    {
      "action": "add",
      "sport_id": 1,
      "time_slot": {
        "start": "2026-10-06T12:05:00+02:00",
        "duration": 900
      },
      "description": "A gentle fifteen-minute walk on Tuesday.",
      "metrics": {
        "duration": 900,
        "distance": 1200
      },
      "parts": [
        {
          "description": "Walk slowly for 3 minutes, comfortably for 9 minutes, then slowly for 3 minutes."
        }
      ]
    }
  ],
  "message": "I can move your walk to Tuesday and extend it to 15 minutes."
}
```

## Source reference

- [Shared types](../../packages/contracts/src/plan-types.ts).
- [Input schema](../../packages/contracts/src/schemas/input.schema.json) and [base output schema](../../packages/contracts/src/schemas/output.schema.json).
- [Catalog-specific output schema](../../packages/contracts/src/plan-schema.ts) and [runtime validation](../../packages/contracts/src/plan.ts).
- [Provider adapter](../../apps/backend/src/create-plan.ts) and [system prompt](../../apps/backend/prompts/plan-system.txt).
- [Feature and integration guide](gemini-plan-exchange.md).
