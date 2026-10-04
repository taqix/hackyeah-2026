import type { ComponentType } from "react";
import { ComfortStep } from "./ComfortStep";
import { PlacesStep } from "./PlacesStep";
import { SportStep } from "./SportStep";
import { TimeStep } from "./TimeStep";
import type { StepProps } from "./types";

/** One component per question, keyed by its step number. Adding a question means adding
    an entry here, not editing a conditional. */
const STEPS: Record<number, ComponentType<StepProps>> = {
  1: ComfortStep,
  2: PlacesStep,
  3: TimeStep,
  4: SportStep,
};

/** Picks the step component for the current question from the registry above. */
export function StepView(props: StepProps) {
  const Step = STEPS[props.step];
  return <Step {...props} />;
}
