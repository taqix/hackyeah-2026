import { Icon } from "../../design-system";
import type { SessionExercise } from "../../domain";

/** Whether to show a tick: a completed exercise, or one left open. */
export type ExerciseCheck = "done" | "open";

const CHECK_ICON: Record<ExerciseCheck, string> = { done: "check", open: "circle" };
const CHECK_COLOUR: Record<ExerciseCheck, string> = { done: "var(--success)", open: "var(--text-tertiary)" };

/** One exercise, read-only. The design system's ExerciseRow always renders a toggle,
    so sessions that cannot be ticked off use this instead. */
export function ExerciseLine({ exercise, check }: { exercise: SessionExercise; check?: ExerciseCheck }) {
  return (
    <div className="s-drow">
      {check ? <Icon name={CHECK_ICON[check]} size={16} style={{ color: CHECK_COLOUR[check] }} /> : null}
      <div className="s-col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <span className="s-dname">{exercise.name}</span>
        <span className="s-ddetail">{exercise.detail}<span> · {exercise.meta}</span></span>
      </div>
    </div>
  );
}
