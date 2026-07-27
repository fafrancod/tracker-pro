import { parseISO } from 'date-fns';
import { taskHistory } from '@core/history/taskHistory';
import { getDayId, getWeekId } from '@core/services/taskService';
import { findTaskLocation } from '@core/store';
import type { Task } from '@core/types';

/**
 * Reposition a multi-day (or single-day) task by absolute start/end day ids.
 * Start changes use move (keeps duration temporarily), then endDayId is set.
 */
export async function rescheduleTaskSpan(opts: {
  task: Task;
  startWeekId: string;
  startDayId: string;
  nextStartDayId: string;
  nextEndDayId: string;
}): Promise<void> {
  const { task, startWeekId, startDayId } = opts;
  let nextStart = opts.nextStartDayId;
  let nextEnd = opts.nextEndDayId;
  if (nextEnd < nextStart) {
    const t = nextStart;
    nextStart = nextEnd;
    nextEnd = t;
  }

  if (nextStart !== startDayId) {
    const toDate = parseISO(`${nextStart}T00:00:00`);
    await taskHistory.move(
      startWeekId,
      startDayId,
      task,
      getWeekId(toDate),
      getDayId(toDate)
    );
  }

  // Prefer post-move location; move preserves duration so we always pin end.
  const loc = findTaskLocation(task.id);
  const currentEnd = loc?.task.endDayId ?? task.endDayId ?? nextStart;
  if (currentEnd !== nextEnd) {
    await taskHistory.update(
      loc?.weekId ?? startWeekId,
      loc?.dayId ?? nextStart,
      task.id,
      { endDayId: nextEnd }
    );
  }
}
