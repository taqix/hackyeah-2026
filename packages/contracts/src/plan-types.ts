/** Durations are seconds; starts are ISO 8601 timestamps with an explicit offset. */
export interface TimeSlot {
  start: string;
  duration: number;
}

export interface PlanPreferences {
  timezone: string;
  starting_comfort: 'starting_out' | 'occasionally_active' | 'some_routine';
  /** Any integer; creation treats this as the per-week session limit. */
  sessions_per_week: number;
  preferred_duration: number;
  /** Positive safe integer database sport IDs. */
  activity_interests: number[];
  available_locations: string[];
  available_equipment: string[];
  discovery_preference: 'selected_only' | 'occasional' | 'explore';
  preferred_times?: string[];
  avoidances?: string[];
  starting_obstacle?: string | null;
  excluded_activity_types?: number[];
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

interface SportBase {
  id: number;
  name: string;
  description: string;
  /** Preparation AND wrap-up allowance, each in seconds. Defaults to 300. */
  buffer_seconds?: number;
}

export type SportDefinition = SportBase & ({ is_gym: 0; metrics: SportMetric[] } | { is_gym: 1 });

export interface GymExercise {
  name: string;
  sets: number;
  repetitions: number;
  description: string;
}

export type Workout = {
  sport_id: number;
  time_slot: TimeSlot;
  description: string;
} & (
  | { metrics: Record<string, string | number | boolean>; parts: { description: string }[] }
  | { exercises: GymExercise[] }
);

export type ExistingWorkout = Workout & {
  id: number;
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

export type PlanEvent = ({ action: 'add' } & Workout) | { action: 'delete'; id: number };

export interface PlanOutput {
  events: PlanEvent[];
  /** Non-empty for modify; null for create. */
  message: string | null;
}
