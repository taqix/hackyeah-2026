# Gemini retry verification — 4 October 2026

Implementation based on `origin/develop` commit `c6dec62`. Calls used the configured
server-side model and key, the production adapter and system prompt, and the
synthetic `initial.input.json` and `partial.input.json` fixtures. Current time was
supplied at invocation. No plan was persisted.

| Create case | Provider statuses in order | Total time | Runtime validation |
| --- | --- | --- | --- |
| Initial: two slots, two requested sessions | 503 → 200 | 10.7 s | Passed |
| Partial: one slot, three requested sessions | 503 → 429 → 429 → 200 | 17.3 s | Passed |

The initial response contained a 10-minute walk on 5 October at 12:05 Warsaw
time, with 120/360/120-second parts, and a 10-minute gym session on 7 October at
18:05. The gym exercises were Bench Squat (2 × 8), Wall Push-Up (2 × 8), and
Standing Calf Raise (2 × 10). Creation returned `message:null`.

Runtime validation does not establish instruction quality: the gym response
assumed a bench despite empty available equipment and omitted explicit warm-up
and cool-down guidance. These require content review; transport retries do not
correct semantic prompt violations.

Exact validated partial response:

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
      "description": "An easy 10-minute outdoor walk during lunch to stretch your legs and get moving.",
      "metrics": { "duration": 600 },
      "parts": [
        {
          "description": "Start with an easy, gentle stroll for 2 minutes to loosen up after sitting.",
          "metrics": { "duration": 120 }
        },
        {
          "description": "Walk at a steady, comfortable pace for 6 minutes. Keep your effort light so speaking feels effortless.",
          "metrics": { "duration": 360 }
        },
        {
          "description": "Slow your pace down for the final 2 minutes to wrap up comfortably.",
          "metrics": { "duration": 120 }
        }
      ]
    }
  ],
  "message": null
}
```

Automated verification: all 62 backend tests passed, including recovery for every
retryable HTTP status, persistent-failure attempt limits, identical request/body
and shared deadline, and single attempts for authentication/billing failures.
Backend typecheck, lint, formatting checks and `git diff --check` passed.
