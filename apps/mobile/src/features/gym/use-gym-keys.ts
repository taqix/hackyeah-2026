export type GymKeys = {
  /** Off while a sheet is open or on phones. */
  enabled: boolean;
  /** Space or Enter: the main button (set done, start, done, next, skip the rest). */
  onPrimary?: () => void;
  /** P: pause or resume a timed round. */
  onPause?: () => void;
  /** Up and Down arrows: reps of the open set. */
  onReps?: (step: 1 | -1) => void;
  /** Left and Right arrows: weight of the open set. */
  onWeight?: (step: 1 | -1) => void;
  /** + (or =): 15 seconds more rest. */
  onExtend?: () => void;
};

/** Keyboard shortcuts are for the desktop web (use-gym-keys.web.ts); phones have none. */
export function useGymKeys(_keys: GymKeys): void {}
