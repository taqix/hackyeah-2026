import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parsePlanInput,
  PlanValidationError,
  type PlanInput,
} from "@hackyeah/contracts/plan";

const request = (): PlanInput =>
  JSON.parse(
    readFileSync(
      new URL("./fixtures/initial.input.json", import.meta.url),
      "utf8",
    ),
  ) as PlanInput;

const openPreferenceFields = [
  "available_locations",
  "available_equipment",
  "avoidances",
] as const;

void test("accepts equipment, locations, and avoidances outside the original catalogs", () => {
  const input = request();
  input.preferences.available_locations = [
    "climbing_wall",
    "A quiet shared courtyard",
  ];
  input.preferences.available_equipment = [
    "rowing_machine",
    "A lightweight kettlebell",
  ];
  input.preferences.avoidances = [
    "overhead_movements",
    "Activities involving loud music",
  ];
  assert.deepEqual(parsePlanInput(input), input);
});

void test("open preference lists have no catalog size or individual text length cap", () => {
  const input = request();
  for (const field of openPreferenceFields) {
    input.preferences[field] = Array.from(
      { length: 50 },
      (_, index) => `${field} ${index} ${"descriptive text ".repeat(100)}`,
    );
  }
  assert.deepEqual(parsePlanInput(input), input);
});

void test("rejects blank, duplicate, and non-string values in open preference lists", () => {
  for (const field of openPreferenceFields) {
    for (const values of [
      [""],
      [" \t\n"],
      ["custom option", "custom option"],
      [123],
      [false],
      [null],
      [{}],
      [["nested option"]],
    ]) {
      const input = request();
      const preferences: Record<string, unknown> = { ...input.preferences };
      preferences[field] = values;
      assert.throws(
        () => parsePlanInput({ ...input, preferences }),
        PlanValidationError,
        `Expected rejection for ${field}: ${JSON.stringify(values)}`,
      );
    }
  }
});

void test("retains required location and equipment lists while permitting empty optional choices", () => {
  const input = request();
  input.preferences.available_equipment = [];
  input.preferences.avoidances = [];
  assert.deepEqual(parsePlanInput(input), input);
  delete input.preferences.avoidances;
  assert.deepEqual(parsePlanInput(input), input);

  const withoutLocations = { ...input.preferences };
  Reflect.deleteProperty(withoutLocations, "available_locations");
  assert.throws(
    () => parsePlanInput({ ...input, preferences: withoutLocations }),
    PlanValidationError,
  );
  const withoutEquipment = { ...input.preferences };
  Reflect.deleteProperty(withoutEquipment, "available_equipment");
  assert.throws(
    () => parsePlanInput({ ...input, preferences: withoutEquipment }),
    PlanValidationError,
  );
  input.preferences.available_locations = [];
  assert.throws(() => parsePlanInput(input), PlanValidationError);
});
