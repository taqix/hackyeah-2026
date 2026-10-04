import type { IconName } from '@/components/ui';

/** The coach's first bubble, always at the top of the thread. */
export const INTRO =
  'Tell us what to change, or a workout you did. Your plan updates straight away, and you can always undo.';

export const HINT = 'Changes apply straight away. You can undo.';
export const BUSY_HINT = 'One change at a time.';
export const DONE_STAYS = "Sessions you've done always stay as they are.";
export const OFFLINE_NOTE = "You're offline. Your plan hasn't changed.";
/** Replaces the hint while there is no plan to change yet (none, building or failed). */
export const NOT_READY_HINT = 'You can chat once your plan is ready.';

/** Home's Move it (8.15): the coach answers with free slots and "Skip it this time". */
export const MOVE_REQUEST = 'Move it';

/** 8.1: quick replies when chat opens about a session (Adjust, Ask in chat). */
export const SESSION_REPLIES = ['Make it shorter', 'Another day', 'Something gentler', 'Swap for a walk'];

export type Example = { icon: IconName; label: string; text: string };

/** Empty state (8): what can be asked. A tap fills the box; nothing is sent until Send. */
export const EXAMPLES: Example[] = [
  { icon: 'calendar-days', label: 'Move a day', text: 'Move Friday to Sunday' },
  { icon: 'clock', label: 'Change the time', text: 'Mornings only, please' },
  { icon: 'timer', label: 'Shorter or longer', text: 'Make Friday 10 minutes' },
  { icon: 'shuffle', label: 'Swap an activity', text: 'Something easier on Friday' },
  { icon: 'dumbbell', label: 'Change sport', text: 'Can I try the gym instead?' },
  { icon: 'circle-plus', label: 'Add a workout you did', text: 'I played football yesterday for an hour' },
];
