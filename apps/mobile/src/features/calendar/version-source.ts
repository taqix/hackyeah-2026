import type { PlanVersion, PlanVersionSource } from '@/api/types';
import type { IconName } from '@/components/ui';
import { formatDayDate, formatTime } from '@/lib/dates';

/** Where a plan version came from, in words and as an icon. */
export const VERSION_SOURCES: Record<PlanVersionSource, { label: string; icon: IconName }> = {
  first_plan: { label: 'First plan', icon: 'sprout' },
  weekly_plan: { label: 'Weekly plan', icon: 'calendar-range' },
  chat: { label: 'From chat', icon: 'message-circle' },
  undo: { label: 'Undo', icon: 'undo-2' },
  answers: { label: 'Your answers', icon: 'sliders-horizontal' },
};

/** "Sun 18 Oct, 19:02" */
export function versionWhen(version: PlanVersion): string {
  return `${formatDayDate(version.created_at)}, ${formatTime(version.created_at)}`;
}
