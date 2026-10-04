import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parsePlanInput,
  parsePlanOutput,
  type PlanInput,
  type PlanOutput,
} from "@hackyeah/contracts/plan";

const now = Date.parse("2026-10-01T00:00:00Z");
const fixture = <T>(name: string): T =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"),
  ) as T;

function modification(): PlanInput {
  const request = fixture<PlanInput>("modify.input");
  request.user_prompt =
    "Keep my Monday walk and add another walk that evening.";
  request.available_slots.push({
    start: "2026-10-05T18:00:00+02:00",
    duration: 3600,
  });
  return request;
}

function addition(start = "2026-10-05T18:05:00+02:00"): PlanOutput {
  const result = fixture<PlanOutput>("initial.expected-output");
  const event = result.events[0];
  if (!event || event.action !== "add") throw Error("Missing addition fixture");
  event.time_slot.start = start;
  return { events: [event], message: "Add an evening walk." };
}

for (const comfort of [
  "starting_out",
  "occasionally_active",
  "some_routine",
] as const) {
  void test(`daily override requires explicit backend authorization for ${comfort}`, () => {
    const request = modification();
    request.preferences.starting_comfort = comfort;
    for (const flag of [undefined, false]) {
      request.allow_multiple_sessions_per_day = flag;
      assert.throws(
        () => parsePlanOutput(addition(), parsePlanInput(request), now),
        /local date/,
      );
    }
    const preferences = structuredClone(request.preferences);
    request.allow_multiple_sessions_per_day = true;
    assert.deepEqual(
      parsePlanOutput(addition(), parsePlanInput(request), now),
      addition(),
    );
    assert.deepEqual(request.preferences, preferences);
  });
}

void test("creation cannot authorize multiple daily sessions and modification still needs a prompt", () => {
  const creation = fixture<PlanInput>("initial.input");
  creation.allow_multiple_sessions_per_day = true;
  assert.throws(() => parsePlanInput(creation), /only.*modification/);
  creation.allow_multiple_sessions_per_day = false;
  assert.doesNotThrow(() => parsePlanInput(creation));
  for (const user_prompt of [null, "   "]) {
    assert.throws(() =>
      parsePlanInput({
        ...modification(),
        allow_multiple_sessions_per_day: true,
        user_prompt,
      }),
    );
  }
});

void test("daily authorization preserves buffer overlap, slot fit, and protected workouts", () => {
  const request = modification();
  request.allow_multiple_sessions_per_day = true;
  request.available_slots[0]!.duration = 3600;
  assert.throws(
    () =>
      parsePlanOutput(
        addition("2026-10-05T12:20:00+02:00"),
        parsePlanInput(request),
        now,
      ),
    /overlap/,
  );
  assert.throws(
    () =>
      parsePlanOutput(
        addition("2026-10-05T20:00:00+02:00"),
        parsePlanInput(request),
        now,
      ),
    /available slot/,
  );
  request.target_window_events[0]!.status = "completed";
  assert.throws(
    () =>
      parsePlanOutput(
        { events: [{ action: "delete", id: 101 }], message: "Delete it." },
        parsePlanInput(request),
        now,
      ),
    /completed/,
  );
});

void test("daily authorization uses local dates across repeated daylight-saving hours", () => {
  const request = modification();
  request.planning_window = {
    start: "2026-10-25T00:00:00+02:00",
    duration: 90000,
  };
  request.available_slots = [
    { start: "2026-10-25T01:00:00+02:00", duration: 14400 },
  ];
  request.target_window_events = [];
  const first = addition("2026-10-25T02:05:00+02:00");
  const second = addition("2026-10-25T02:05:00+01:00");
  const result = {
    events: [...first.events, ...second.events],
    message: "Two walks as requested.",
  };
  assert.throws(
    () => parsePlanOutput(result, parsePlanInput(request), now),
    /local date/,
  );
  request.allow_multiple_sessions_per_day = true;
  assert.deepEqual(
    parsePlanOutput(result, parsePlanInput(request), now),
    result,
  );
});
