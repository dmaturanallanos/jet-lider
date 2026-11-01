import type { WorkspaceData } from './types';
import { dayRange } from '@/utils/dates';
export function filterDemo(
  data: WorkspaceData,
  q: Record<string, string | undefined>,
): WorkspaceData {
  const query = (q.q ?? '').toLocaleLowerCase('es-CL');
  return {
    ...data,
    shifts: data.shifts.filter(
      (s) =>
        (!q.worker || s.worker_id === q.worker) &&
        (!q.type || s.type_id === q.type) &&
        (!q.shiftStatus || s.status === q.shiftStatus) &&
        (!q.location ||
          (s.location ?? '')
            .toLocaleLowerCase('es-CL')
            .includes(q.location.toLocaleLowerCase('es-CL'))),
    ),
    tasks: data.tasks.filter(
      (t) =>
        (!query || t.title.toLocaleLowerCase('es-CL').includes(query)) &&
        (!q.status || t.status === q.status) &&
        (!q.priority || t.priority === q.priority) &&
        (!q.taskWorker ||
          data.assignees.some((a) => a.task_id === t.id && a.worker_id === q.taskWorker)) &&
        (!q.dueFrom ||
          (t.due_at && Date.parse(t.due_at) >= Date.parse(dayRange(q.dueFrom).start))) &&
        (!q.dueTo || (t.due_at && Date.parse(t.due_at) < Date.parse(dayRange(q.dueTo).end))),
    ),
    entries: data.entries.filter(
      (e) =>
        (!query || e.title.toLocaleLowerCase('es-CL').includes(query)) &&
        (!q.entryType || e.type === q.entryType) &&
        (!q.author || e.created_by === q.author),
    ),
  };
}
