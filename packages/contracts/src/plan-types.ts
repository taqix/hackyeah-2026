/** Durations are seconds; starts are ISO 8601 timestamps with an explicit offset. */
export interface TimeSlot {
  start: string;
  duration: number;
}

export interface PlanPreferences {
  timezone: string;
  starting_comfort: 'starting_out' | 'occasionally_active' | 'some_routine';
  sessions_per_week: 1 | 2 | 3;
  preferred_duration: number;
  /** Database sport IDs, not a fixed list of activity names. */
  activity_interests: string[];
  available_locations: string[];
  available_equipment: string[];
  discovery_preference: 'selected_only' | 'occasional' | 'explore';
  preferred_times?: string[];
  avoidances?: string[];
  starting_obstacle?: string | null;
  excluded_activity_types?: string[];
  comfortable_swimming?: boolean | null;
}

/** A deliberately small JSON Schema subset for database-defined metric values. */
export type MetricValueSchema =
  | { type: 'number' | 'integer'; minimum?: number; maximum?: number; enum?: number[] }
  | {
      type: 'string';
      minLength?: number;
      maxLength?: number;
      enum?: string[];
      format?: 'date' | 'date-time' | 'time' | 'duration';
    }
  | { type: 'boolean' };

export interface SportMetric {
  key: string;
  description: string;
  required: boolean;
  value_schema: MetricValueSchema;
  unit?: string;
  /** Use only for a metric measuring the entire session in seconds. */
  represents_session_duration?: boolean;
}

export interface ExerciseDefinition {
  id: string;
  name: string;
  description: string;
}

interface SportBase {
  id: string;
  name: string;
  description: string;
  /** Preparation AND wrap-up allowance, each in seconds. Defaults to 300. */
  buffer_seconds?: number;
}

export type SportDefinition = SportBase &
  ({ kind: 'non_gym'; metrics: SportMetric[] } | { kind: 'gym'; exercises?: ExerciseDefinition[] });

export interface GymExercise {
  name: string;
  /** Required when the sport supplies an exercise catalog. */
  exercise_id?: string;
  sets: number;
  repetitions: number;
  description: string;
}

export type Workout = {
  sport_id: string;
  time_slot: TimeSlot;
  description: string;
} & (
  | { metrics: Record<string, string | number | boolean>; parts: { description: string }[] }
  | { exercises: GymExercise[] }
);

export type ExistingWorkout = Workout & {
  id: string;
  status: 'planned' | 'completed' | 'skipped';
  /** Set by the backend after checking ownership, never accepted as client authorization. */
  editable: boolean;
};

export interface PlanInput {
  mode: 'create' | 'modify';
  planning_window: TimeSlot;
  preferences: PlanPreferences;
  available_slots: TimeSlot[];
  user_description: string;
  sports: SportDefinition[];
  previous_week_events: ExistingWorkout[];
  current_week_events: ExistingWorkout[];
  target_window_events: ExistingWorkout[];
  /** All preceding messages in chronological order; excludes user_prompt. */
  conversation: { role: 'user' | 'assistant'; content: string }[];
  user_prompt: string | null;
}

export type PlanEvent = ({ action: 'add' } & Workout) | { action: 'delete'; id: string };

export interface PlanOutput {
  events: PlanEvent[];
  /** Non-empty for modify; null for create. */
  message: string | null;
}
